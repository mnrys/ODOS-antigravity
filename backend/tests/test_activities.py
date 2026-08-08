"""
Tests automatisés pour la validation de la Phase 2 (Écran 1 — Création manuelle + Panneau complet).
cf. PRD_ecran1_creation.md (US-1, US-5, US-10, US-12) et SCHEMA_BASE_DE_DONNEES.md.
"""
import io
import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import Trip, TripDestination, Category, Activity, Document, Tag
from app.main import app


# Configuration d'une base de données SQLite en mémoire avec StaticPool
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
    Fournit un client de test avec une base de données isolée et pré-peuplée.
    """
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Création du voyage de test
    trip = Trip(
        nom="Voyage Test Phase 2",
        date_debut=date.today() + timedelta(days=15),
        nb_jours=5,
        nb_personnes=2,
        budget_total=2000.0
    )
    db.add(trip)
    db.flush()

    dest1 = TripDestination(trip_id=trip.id, nom="La Palma", ordre=1)
    dest2 = TripDestination(trip_id=trip.id, nom="Tenerife", ordre=2)
    db.add_all([dest1, dest2])
    db.flush()

    cat_nat = Category(trip_id=trip.id, nom="Nature", couleur="#3F7A55", est_systeme=1)
    cat_log = Category(trip_id=trip.id, nom="Logement", couleur="#6E7278", est_systeme=1)
    db.add_all([cat_nat, cat_log])
    db.flush()

    tag_rando = Tag(trip_id=trip.id, nom="Randonnée")
    tag_vue = Tag(trip_id=trip.id, nom="Vue panoramique")
    db.add_all([tag_rando, tag_vue])
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield client, db, trip, dest1, cat_nat, [tag_rando, tag_vue]

    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=test_engine)


def test_create_manual_activity_with_tags_and_completeness(client_with_db):
    """
    US-1 & US-10 : Vérifie la création manuelle d'une activité avec tags et provenance 'manuel'.
    Vérifie également le calcul dynamique du score de complétude et du coût total.
    """
    client, db, trip, dest1, cat_nat, tags = client_with_db

    payload = {
        "destination_id": dest1.id,
        "categorie_id": cat_nat.id,
        "type_element": "activite",
        "titre": "Ascension Roque de los Muchachos",
        "adresse": "Roque de los Muchachos, La Palma",
        "zone_geo": "nord",
        "duree_min": 180,
        "cout_par_personne": 35.0,
        "description": "Randonnée exceptionnelle sur les crêtes volcaniques au-dessus de la mer de nuages.",
        "horaires_ouverture": "09:00 - 18:00",
        "note_interet": 5,
        "statut": "non_reserve",
        "tag_ids": [tags[0].id, tags[1].id]
    }

    res = client.post(f"/api/trips/{trip.id}/activities", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["titre"] == "Ascension Roque de los Muchachos"
    assert data["source"] == "manuel"
    assert data["statut_validation"] == "validee"
    assert data["cout_par_personne"] == 35.0
    # 35€/pers * 2 personnes = 70€
    assert data["cout_total"] == 70.0
    assert len(data["tags"]) == 2
    # Score de complétude doit être élevé (titre 15 + dest 5 + adr 10 + duree 10 + cout 5 + desc 15 + horaires 10 + tags 5 + note 5 + zone 10 = 90)
    assert data["completude"] == 90


def test_adaptive_fields_by_type_element(client_with_db):
    """
    Vérifie l'enregistrement des champs spécifiques selon le type d'élément :
    - Logement : date_debut, date_fin, numero_reference
    - Vol : numero_reference, duree_min
    """
    client, db, trip, dest1, cat_nat, _ = client_with_db

    # Création Logement
    hotel_payload = {
        "destination_id": dest1.id,
        "type_element": "logement",
        "titre": "Hacienda San Jorge",
        "date_debut": "2026-10-01",
        "date_fin": "2026-10-05",
        "numero_reference": "BOOK-987654",
        "cout_par_personne": 120.0
    }
    res_hotel = client.post(f"/api/trips/{trip.id}/activities", json=hotel_payload)
    assert res_hotel.status_code == 201
    hotel_data = res_hotel.json()
    assert hotel_data["date_debut"] == "2026-10-01"
    assert hotel_data["date_fin"] == "2026-10-05"
    assert hotel_data["numero_reference"] == "BOOK-987654"

    # Création Vol
    flight_payload = {
        "destination_id": dest1.id,
        "type_element": "vol",
        "titre": "Vol Paris - Tenerife Sud",
        "numero_reference": "AF-1234",
        "duree_min": 240,
        "cout_par_personne": 250.0
    }
    res_flight = client.post(f"/api/trips/{trip.id}/activities", json=flight_payload)
    assert res_flight.status_code == 201
    flight_data = res_flight.json()
    assert flight_data["numero_reference"] == "AF-1234"
    assert flight_data["duree_min"] == 240


def test_document_upload_and_main_photo_selection(client_with_db):
    """
    US-12 : Upload d'une photo et d'un PDF rattachés à une activité.
    Vérifie la détection du type et la désignation de la photo principale.
    """
    client, db, trip, dest1, _, _ = client_with_db

    # Création d'une activité support
    act_res = client.post(f"/api/trips/{trip.id}/activities", json={
        "destination_id": dest1.id,
        "titre": "Visite Observatoire"
    })
    act_id = act_res.json()["id"]

    # 1. Upload Photo
    fake_photo_bytes = b"fake_image_content"
    photo_file = {"file": ("ciel_etoile.jpg", io.BytesIO(fake_photo_bytes), "image/jpeg")}
    res_photo = client.post(
        f"/api/activities/{act_id}/documents",
        files=photo_file,
        data={"libelle": "Ciel étoilé", "est_principale": "true"}
    )
    assert res_photo.status_code == 201
    photo_data = res_photo.json()
    assert photo_data["type_fichier"] == "photo"
    assert photo_data["est_principale"] == 1
    assert "uploads/activities/" in photo_data["chemin_fichier"]

    # 2. Upload PDF (voucher / billet)
    fake_pdf_bytes = b"%PDF-1.4 fake_pdf_content"
    pdf_file = {"file": ("billet_telescope.pdf", io.BytesIO(fake_pdf_bytes), "application/pdf")}
    res_pdf = client.post(
        f"/api/activities/{act_id}/documents",
        files=pdf_file,
        data={"libelle": "Billet électronique"}
    )
    assert res_pdf.status_code == 201
    pdf_data = res_pdf.json()
    assert pdf_data["type_fichier"] == "pdf"
    assert pdf_data["est_principale"] == 0

    # 3. Vérification des documents dans la vue détaillée
    detail_res = client.get(f"/api/activities/{act_id}")
    detail = detail_res.json()
    assert len(detail["documents"]) == 2
    assert detail["photo_principale"] == photo_data["chemin_fichier"]


def test_update_activity_full_panel(client_with_db):
    """
    US-5 : Modification de tous les champs sans exception depuis le panneau d'édition.
    """
    client, db, trip, dest1, cat_nat, tags = client_with_db

    create_res = client.post(f"/api/trips/{trip.id}/activities", json={
        "destination_id": dest1.id,
        "titre": "Titre initial",
        "cout_par_personne": 10.0
    })
    act_id = create_res.json()["id"]

    # Mise à jour complète
    update_payload = {
        "titre": "Titre modifié et complet",
        "cout_par_personne": 45.0,
        "description": "Nouvelle description enrichie",
        "remarques": "Prendre des chaussures de marche",
        "avis_utilisateurs": "Très belle vue mais venteux",
        "statut": "reserve",
        "note_interet": 4,
        "tag_ids": [tags[0].id]
    }
    update_res = client.put(f"/api/activities/{act_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()

    assert updated_data["titre"] == "Titre modifié et complet"
    assert updated_data["cout_par_personne"] == 45.0
    assert updated_data["cout_total"] == 90.0  # 45 * 2 personnes
    assert updated_data["remarques"] == "Prendre des chaussures de marche"
    assert updated_data["avis_utilisateurs"] == "Très belle vue mais venteux"
    assert updated_data["statut"] == "reserve"
    assert len(updated_data["tags"]) == 1


def test_soft_delete_activity(client_with_db):
    """
    Vérifie la mise en corbeille (soft-delete avec supprime_le) sans destruction physique.
    """
    client, db, trip, dest1, _, _ = client_with_db

    create_res = client.post(f"/api/trips/{trip.id}/activities", json={
        "destination_id": dest1.id,
        "titre": "Activité à supprimer"
    })
    act_id = create_res.json()["id"]

    # Suppression
    del_res = client.delete(f"/api/activities/{act_id}")
    assert del_res.status_code == 204

    # L'activité ne doit plus apparaître dans la liste normale
    list_res = client.get(f"/api/trips/{trip.id}/activities")
    activities = list_res.json()
    assert not any(a["id"] == act_id for a in activities)

    # Mais elle reste présente en base avec supprime_le renseigné (pour la corbeille)
    db_act = db.query(Activity).filter(Activity.id == act_id).first()
    assert db_act is not None
    assert db_act.supprime_le is not None


def test_activity_tripadvisor_link_and_consultation_detail(client_with_db):
    """
    Phase 11 — Validation du champ lien_avis_tripadvisor et du format de consultation détaillée.
    cf. PRD_ecran1_creation.md (US-13, US-14) et SCHEMA_BASE_DE_DONNEES.md.
    Vérifie :
    1. La création avec lien_avis_tripadvisor.
    2. La récupération complète pour affichage dans ActivityDetailModal (note, prix, avis, lien TripAdvisor).
    3. La modification du lien TripAdvisor via PUT.
    """
    client, db, trip, dest1, cat_nat, tags = client_with_db

    tripadvisor_url = "https://www.tripadvisor.fr/Attraction_Review-g187791-d192285-Reviews-Colosseum-Rome_Lazio.html"

    payload = {
        "destination_id": dest1.id,
        "categorie_id": cat_nat.id,
        "type_element": "activite",
        "titre": "Visite du Colisée",
        "cout_par_personne": 29.0,
        "description": "Amphithéâtre romain emblématique",
        "avis_utilisateurs": "Incontournable, réserver à l'avance",
        "lien_avis_tripadvisor": tripadvisor_url,
        "note_interet": 5,
        "statut": "non_reserve",
        "tag_ids": [tags[0].id]
    }

    # 1. Création
    create_res = client.post(f"/api/trips/{trip.id}/activities", json=payload)
    assert create_res.status_code == 201
    created_act = create_res.json()
    act_id = created_act["id"]
    assert created_act["lien_avis_tripadvisor"] == tripadvisor_url

    # 2. Récupération pour consultation détaillée
    detail_res = client.get(f"/api/activities/{act_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == act_id
    assert detail["titre"] == "Visite du Colisée"
    assert detail["lien_avis_tripadvisor"] == tripadvisor_url
    assert detail["avis_utilisateurs"] == "Incontournable, réserver à l'avance"
    assert detail["cout_total"] == 58.0  # 29 * 2 personnes
    assert detail["note_interet"] == 5
    assert len(detail["tags"]) == 1

    # 3. Mise à jour du lien
    new_url = "https://www.tripadvisor.fr/Attraction_Review-g187791-d192285-Updated.html"
    update_res = client.put(f"/api/activities/{act_id}", json={
        "lien_avis_tripadvisor": new_url
    })
    assert update_res.status_code == 200
    assert update_res.json()["lien_avis_tripadvisor"] == new_url

