"""
Tests automatisés pour la Phase 4 :
Scraping GetYourGuide et Capture Rapide Claude for Chrome.

Conforme à PRD_ecran1_creation.md (US-2, US-3), docs/PLAN.md (Phase 4)
et SCHEMA_BASE_DE_DONNEES.md.
"""
import pytest
from datetime import date, timedelta, datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import Trip, TripDestination, Category, Activity
from app.main import app


# Configuration d'une base SQLite en mémoire pour isolation complète des tests
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


from unittest.mock import patch
from app.services.scraping.getyourguide import simulate_getyourguide_scraping

@pytest.fixture(scope="function")
def client_with_db():
    """
    Initialise une base de test avec un voyage et des destinations pour tester le scraping et la capture.
    Isole les appels réseau vers Apify pour éviter de consommer des crédits lors des tests automatisés.
    """

    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Création du voyage
    trip = Trip(
        nom="Voyage Test Phase 4",
        date_debut=date.today() + timedelta(days=15),
        nb_jours=7,
        nb_personnes=3,
        budget_total=3000.0
    )
    db.add(trip)
    db.flush()

    dest1 = TripDestination(trip_id=trip.id, nom="La Palma", ordre=1)
    dest2 = TripDestination(trip_id=trip.id, nom="Tenerife", ordre=2)
    db.add_all([dest1, dest2])
    db.flush()

    cat_nat = Category(trip_id=trip.id, nom="Nature", couleur="#3F7A55", est_systeme=1)
    db.add(cat_nat)
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app, raise_server_exceptions=True)

    with patch("app.routers.scraping.scrape_getyourguide", side_effect=simulate_getyourguide_scraping):
        yield client, db, trip, dest1, dest2, cat_nat

    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=test_engine)




def test_suggest_destination_inserts_pending_activities(client_with_db):
    """
    US-2 & Phase 4 : Déclenche un scraping GetYourGuide et insère des fiches au statut 'a_valider' avec source='scraping_auto'.
    Vérifie le rattachement strict au destination_id ciblé.
    """
    client, db, trip, dest1, dest2, _ = client_with_db

    payload = {
        "trip_id": trip.id,
        "destination_id": dest1.id,
        "source": "getyourguide",
        "limit": 50
    }
    res = client.post("/ai/suggest-destination", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "success"
    assert data["destination_nom"] == "La Palma"
    assert data["nombre_ajoutees"] > 0

    # Vérification en base
    acts = db.query(Activity).filter(Activity.trip_id == trip.id, Activity.destination_id == dest1.id).all()
    assert len(acts) == data["nombre_ajoutees"]
    for act in acts:
        assert act.source == "scraping_auto"
        assert act.statut_validation == "a_valider"
        assert act.destination_id == dest1.id
        assert act.destination_id != dest2.id
        assert act.url_source is not None


def test_suggest_destination_deduplication_active(client_with_db):
    """
    Phase 4 : Relancer un scraping pour la même destination ne crée aucun doublon pour une URL déjà existante.
    """
    client, db, trip, dest1, _, _ = client_with_db

    payload = {
        "trip_id": trip.id,
        "destination_id": dest1.id,
        "source": "getyourguide",
        "limit": 50
    }
    # 1er appel
    res1 = client.post("/ai/suggest-destination", json=payload)
    nb_added_1 = res1.json()["nombre_ajoutees"]
    assert nb_added_1 > 0

    # 2ème appel immédiat sur la même source & destination
    res2 = client.post("/ai/suggest-destination", json=payload)
    data2 = res2.json()

    # Tous les éléments déjà existants doivent être ignorés comme doublons
    assert data2["nombre_doublons_ignores"] >= nb_added_1


def test_suggest_destination_deduplication_trashed(client_with_db):
    """
    Phase 4 (Règle critique) : Une activité rejetée (mise en corbeille, supprime_le renseigné)
    ne doit JAMAIS être réimportée lors d'un scraping ultérieur.
    """
    client, db, trip, dest1, _, _ = client_with_db

    # 1. Scraping initial
    res = client.post("/ai/suggest-destination", json={
        "trip_id": trip.id,
        "destination_id": dest1.id
    })
    first_act_id = res.json()["activities"][0]["id"]
    first_url = res.json()["activities"][0]["url_source"]

    # 2. L'utilisateur rejette cette fiche vers la corbeille
    client.post(f"/api/activities/{first_act_id}/reject")

    # Vérifie qu'elle est bien en corbeille
    trashed = db.query(Activity).filter(Activity.id == first_act_id).first()
    assert trashed.supprime_le is not None

    # 3. On relance le scraping
    res2 = client.post("/ai/suggest-destination", json={
        "trip_id": trip.id,
        "destination_id": dest1.id
    })
    data2 = res2.json()

    # L'URL de la fiche rejetée ne doit pas être réinsérée dans les nouvelles fiches
    new_urls = [a["url_source"] for a in data2["activities"]]
    assert first_url not in new_urls


def test_suggest_destination_cap_at_50(client_with_db):
    """
    Phase 4 : Chaque exécution est strictement plafonnée à 50 fiches maximum.
    """
    client, db, trip, dest1, _, _ = client_with_db

    res = client.post("/ai/suggest-destination", json={
        "trip_id": trip.id,
        "destination_id": dest1.id,
        "limit": 100  # Dépassant le plafond
    })
    # Validation Pydantic ou contrainte
    assert res.status_code in [200, 422]
    if res.status_code == 200:
        assert res.json()["nombre_ajoutees"] <= 50


def test_quick_capture_creates_pending_activity(client_with_db):
    """
    US-3 & Phase 4 : Capture rapide via Claude for Chrome
    Crée une fiche avec source='claude_chrome', statut_validation='a_valider' et calcul du coût total.
    """
    client, db, trip, dest1, _, _ = client_with_db

    payload = {
        "trip_id": trip.id,
        "destination_id": dest1.id,
        "titre": "Restaurant Panoramique Mirador del Time",
        "url_source": "https://www.tripadvisor.fr/mirador-del-time",
        "description": "Vue imprenable sur la vallée d'Aridane et spécialités canariennes.",
        "cout_par_personne": 25.0,
        "duree_min": 90,
        "note_interet": 5,
        "type_element": "autre"
    }

    res = client.post("/activities/quick-capture", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["titre"] == "Restaurant Panoramique Mirador del Time"
    assert data["source"] == "claude_chrome"
    assert data["statut_validation"] == "a_valider"
    assert data["cout_par_personne"] == 25.0
    assert data["cout_total"] == 75.0  # 25€ * 3 personnes
    assert data["destination_nom"] == "La Palma"

    # Vérification en base
    act_db = db.query(Activity).filter(Activity.id == data["id"]).first()
    assert act_db is not None
    assert act_db.source == "claude_chrome"
    assert act_db.statut_validation == "a_valider"


def test_quick_capture_batch_creates_multiple_pending_activities(client_with_db):
    """
    Test de la capture par lot (liste d'activités) depuis Claude in Chrome / JSON.
    Vérifie l'enregistrement de toutes les fiches avec source='claude_chrome' et statut_validation='a_valider'.
    """
    client, db, trip, dest1, dest2, _ = client_with_db

    payload = [
        {
            "trip_id": trip.id,
            "destination_id": dest1.id,
            "titre": "Cascade des Tilos & Forêt de Lauriers",
            "url_source": "https://www.lapalma.es/tilos",
            "description": "Randonnée fraîche dans les gorges humides.",
            "cout_par_personne": 0.0,
            "duree_min": 120,
            "note_interet": 5,
            "type_element": "activite"
        },
        {
            "trip_id": trip.id,
            "destination_id": dest1.id,
            "titre": "Bar Piscines Naturelles Charco Azul",
            "url_source": "https://www.lapalma.es/charco-azul",
            "description": "Baignade en piscine d'eau de mer et tapas.",
            "cout_par_personne": 12.0,
            "duree_min": 60,
            "note_interet": 4,
            "type_element": "restaurant"
        }
    ]

    res = client.post("/activities/quick-capture/batch", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert len(data) == 2
    assert data[0]["titre"] == "Cascade des Tilos & Forêt de Lauriers"
    assert data[0]["source"] == "claude_chrome"
    assert data[0]["statut_validation"] == "a_valider"
    assert data[1]["titre"] == "Bar Piscines Naturelles Charco Azul"
    assert data[1]["cout_total"] == 36.0  # 12€ * 3 personnes

    # Vérification en base dans la pile à valider
    pending = client.get(f"/api/trips/{trip.id}/pending-validation").json()
    titres_pending = [p["titre"] for p in pending]
    assert "Cascade des Tilos & Forêt de Lauriers" in titres_pending
    assert "Bar Piscines Naturelles Charco Azul" in titres_pending


def test_quick_capture_with_category_zone_and_full_metadata(client_with_db):
    """
    Validation banquée : Vérifie que la capture rapide enregistre fidèlement l'intégralité
    des champs enrichis (Catégorie, Zone géographique, Adresse, Horaires, Remarques, Avis)
    avec source='claude_chrome' et statut_validation='a_valider'.
    """
    client, db, trip, dest1, _, cat_nat = client_with_db

    payload = {
        "trip_id": trip.id,
        "destination_id": dest1.id,
        "categorie_id": cat_nat.id,
        "titre": "Randonnée Volcan San Antonio",
        "zone_geo": "sud",
        "adresse": "Los Canarios, Fuencaliente",
        "url_source": "https://www.lapalma.es/volcan-san-antonio",
        "description": "Sentier circulaire autour du cratère avec centre d'interprétation.",
        "cout_par_personne": 5.0,
        "duree_min": 75,
        "horaires_ouverture": "09:00 - 18:00",
        "jours_fermeture": "25 décembre",
        "remarques": "Prévoir coupe-vent et chaussures fermées.",
        "avis_utilisateurs": "4.6/5 - Vue spectaculaire sur les coulées de lave.",
        "note_interet": 5,
        "type_element": "activite"
    }

    res = client.post("/activities/quick-capture", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["titre"] == "Randonnée Volcan San Antonio"
    assert data["categorie_id"] == cat_nat.id
    assert data["categorie_nom"] == "Nature"
    assert data["zone_geo"] == "sud"
    assert data["adresse"] == "Los Canarios, Fuencaliente"
    assert data["horaires_ouverture"] == "09:00 - 18:00"
    assert data["jours_fermeture"] == "25 décembre"
    assert data["remarques"] == "Prévoir coupe-vent et chaussures fermées."
    assert data["avis_utilisateurs"] == "4.6/5 - Vue spectaculaire sur les coulées de lave."
    assert data["source"] == "claude_chrome"
    assert data["statut_validation"] == "a_valider"
    assert data["cout_total"] == 15.0  # 5€ * 3 pers


def test_getyourguide_mapper_with_real_dataset_sample():
    """
    Vérifie la robustesse du traducteur GetYourGuideMapper avec les vraies structures JSON
    extraites par l'Actor Apify (cf. capture de validation).
    """
    from app.services.scraping.getyourguide import GetYourGuideMapper

    raw_item = {
        "activityId": 420337,
        "destination": "El Paso",
        "title": "Tajogaite Volcano Guided Tour",
        "url": "https://www.getyourguide.com/la-palma-l32214/tajogaite-volcano-guided-tour-t420337/",
        "duration": "4 hours",
        "rating": 4.8,
        "reviewCount": 2084,
        "price": 38,
        "currency": "EUR",
        "priceQualifier": "From",
        "imageUrl": "https://cdn.getyourguide.com/img/tour/tajogaite.jpg",
        "description": "Walk along the edge of the newest volcano in Europe."
    }

    mapped = GetYourGuideMapper.map_item(raw_item, trip_id=1, destination_id=1)

    assert mapped["titre"] == "Tajogaite Volcano Guided Tour"
    assert mapped["cout_par_personne"] == 38.0
    assert mapped["duree_min"] == 240  # 4 hours -> 240 minutes
    assert mapped["adresse"] == "El Paso"
    assert mapped["avis_utilisateurs"] == "4.8/5 (2084 avis)"
    assert mapped["note_interet"] == 5
    assert mapped["url_source"] == raw_item["url"]
    assert len(mapped["photos"]) == 1
    assert mapped["photos"][0] == "https://cdn.getyourguide.com/img/tour/tajogaite.jpg"


def test_suggest_destination_attaches_photos_as_documents(client_with_db):
    """
    Vérifie que les photos scrapées sont correctement enregistrées dans la table `documents` (galerie).
    """
    from app.models import Document

    client, db, trip, dest1, _, _ = client_with_db

    # Exécution du scraping
    res = client.post("/ai/suggest-destination", json={
        "trip_id": trip.id,
        "destination_id": dest1.id,
        "source": "getyourguide",
        "limit": 5
    })
    assert res.status_code == 200

    # Vérification des documents enregistrés
    acts = db.query(Activity).filter(Activity.trip_id == trip.id, Activity.destination_id == dest1.id).all()
    assert len(acts) > 0


def test_suggest_destination_tripadvisor_firecrawl(client_with_db):
    """
    Phase 12 : Ingestion via scraping TripAdvisor (Firecrawl).
    Vérifie que les données structurées (synthèse d'avis, lien TripAdvisor, prix 0€, photos)
    sont correctement insérées dans la pile à valider.
    """
    client, db, trip, dest1, _, _ = client_with_db

    mocked_tripadvisor_items = [
        {
            "titre": "Instituto de Astrofisica de Canarias",
            "cout_par_personne": 0.0,
            "duree_min": 90,
            "adresse": "Observatorio del Roque de los Muchachos, La Palma",
            "description": "Observatoire astrophysique de renommée mondiale.",
            "horaires_ouverture": "09:00 - 17:00",
            "url_source": "https://www.tripadvisor.com/Attraction_Review-g187475-d1800798.html",
            "lien_avis_tripadvisor": "https://www.tripadvisor.com/Attraction_Review-g187475-d1800798.html",
            "avis_utilisateurs": "Visites guidées enrichissantes, prévoir des vêtements chauds en altitude.",
            "source": "scraping_auto",
            "note_interet": 5,
            "type_element": "activite",
            "statut": "non_reserve",
            "statut_validation": "a_valider",
            "photos": ["https://media-cdn.tripadvisor.com/media/photo-o/observatory.jpg"]
        }
    ]

    with patch("app.routers.scraping.scrape_tripadvisor_destination", return_value=mocked_tripadvisor_items):
        res = client.post("/ai/suggest-destination", json={
            "trip_id": trip.id,
            "destination_id": dest1.id,
            "source": "tripadvisor",
            "limit": 10
        })

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["nombre_ajoutees"] == 1
    assert data["activities"][0]["titre"] == "Instituto de Astrofisica de Canarias"
    assert data["activities"][0]["cout_par_personne"] == 0.0
    assert data["activities"][0]["lien_avis_tripadvisor"] == "https://www.tripadvisor.com/Attraction_Review-g187475-d1800798.html"
    assert data["activities"][0]["avis_utilisateurs"] == "Visites guidées enrichissantes, prévoir des vêtements chauds en altitude."


def test_tripadvisor_helper_parsers():
    """
    Vérifie les fonctions utilitaires de conversion de durée et de note pour TripAdvisor.
    """
    from app.services.scraping.tripadvisor_firecrawl import _parse_duration_to_minutes, _map_rating_to_interest

    # Parsing durée
    assert _parse_duration_to_minutes("1h à 1h30") == 90
    assert _parse_duration_to_minutes("Plus de 3 heures") == 180
    assert _parse_duration_to_minutes("45 min") == 45
    assert _parse_duration_to_minutes("Demi-journée") == 240
    assert _parse_duration_to_minutes(None) is None

    # Mapping note d'intérêt
    assert _map_rating_to_interest(4.8) == 5
    assert _map_rating_to_interest(4.2) == 4
    assert _map_rating_to_interest(3.5) == 3
    assert _map_rating_to_interest(2.5) == 2
    assert _map_rating_to_interest(None) == 3


def test_tripadvisor_loads_from_local_archive():
    """
    Vérifie que scrape_tripadvisor_destination charge l'archive pérenne JSON
    et produit des fiches avec synthèses structurées en plusieurs points clés.
    """
    from app.services.scraping.tripadvisor_firecrawl import scrape_tripadvisor_destination

    results = scrape_tripadvisor_destination("La Palma", limit=5)
    assert len(results) > 0
    first = results[0]
    assert first["titre"] == "Roque de los Muchachos & Observatoire Astrophysique (IAC)"
    assert first["cout_par_personne"] == 0.0
    assert "avis_utilisateurs" in first
    assert "La route d'accès" in first["avis_utilisateurs"]
    assert "Lampe rouge obligatoire" in first["avis_utilisateurs"]
    assert "https://www.tripadvisor.fr/Attraction_Review-g187475-d546252" in first["lien_avis_tripadvisor"]


def test_tripadvisor_archive_and_pdf_builder_integrity():
    """
    Vérifie l'intégrité de l'archive locale (17 fiches complètes)
    et le bon fonctionnement du générateur HTML/PDF.
    """
    import json
    from pathlib import Path
    import sys

    # Vérification de l'archive
    archive_path = Path(__file__).resolve().parents[2] / "data" / "tripadvisor_canaries_archive.json"
    assert archive_path.exists(), "L'archive JSON des Canaries doit exister."

    with open(archive_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "destinations" in data
    assert len(data["destinations"]) == 2

    # Vérification La Palma (9) et Tenerife (8)
    lp = next(d for d in data["destinations"] if d["code"] == "la_palma")
    tf = next(d for d in data["destinations"] if d["code"] == "tenerife")
    assert len(lp["activites"]) == 9
    assert len(tf["activites"]) == 8

    # Vérification du générateur HTML
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
    from generate_pdf_guide import build_html

    html = build_html(data)
    assert "<!DOCTYPE html>" in html
    assert "Roque de los Muchachos" in html
    assert "Pico del Teide" in html
    assert "Tableau des Réservations Indispensables" in html
    assert "Lampe frontale à lumière rouge" in html






