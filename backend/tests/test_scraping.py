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


@pytest.fixture(scope="function")
def client_with_db():
    """
    Initialise une base de test avec un voyage et des destinations pour tester le scraping et la capture.
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
    client = TestClient(app)

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
