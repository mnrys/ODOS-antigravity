"""
Tests unitaires pour le module Planning (Écran 3 et Pont Atelier ↔ Planning).
Vérifie la conformité avec :
- PRD_ecran3_planning.md
- GEMINI.md (Règles 5.1, 5.2, 5.5, 7.6)
"""
from datetime import date
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Trip, TripDestination, Category, Activity, ScheduledSlot, SpecialBlock

# Base de données SQLite en mémoire isolée pour les tests avec StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="setup_planning_data")
def fixture_setup_planning_data(db_session):
    # Création d'un voyage de test (4 voyageurs, budget 3000 €)
    trip = Trip(
        id=1,
        nom="Voyage Test Planning",
        date_debut=date(2026, 8, 10),
        nb_jours=7,
        nb_personnes=4,
        budget_total=3000.0,
        planning_heure_debut=420,
        planning_heure_fin=1380
    )
    db_session.add(trip)

    # Destinations
    dest1 = TripDestination(id=1, trip_id=1, nom="Tenerife", ordre=1)
    db_session.add(dest1)

    # Catégories
    cat1 = Category(id=1, trip_id=1, nom="Nature & Randonnée", couleur="#3F7A55")
    cat2 = Category(id=2, trip_id=1, nom="Gastronomie", couleur="#B9862F")
    db_session.add_all([cat1, cat2])

    # Activités
    act1 = Activity(
        id=1,
        trip_id=1,
        destination_id=1,
        categorie_id=1,
        titre="Randonnée Teide",
        cout_par_personne=25.0,  # Total pour 4 = 100.0 €
        duree_min=180,
        statut_validation="validee"
    )
    act2 = Activity(
        id=2,
        trip_id=1,
        destination_id=1,
        categorie_id=2,
        titre="Dégustation Vins",
        cout_par_personne=40.0,  # Total pour 4 = 160.0 €
        duree_min=90,
        statut_validation="validee"
    )
    db_session.add_all([act1, act2])
    db_session.commit()


def test_get_planning_data_empty(client, setup_planning_data):
    """Vérifie la récupération des données de planning initiales."""
    res = client.get("/trips/1/planning")
    assert res.status_code == 200
    data = res.json()
    assert data["trip"]["nb_personnes"] == 4
    assert len(data["unplaced_activities"]) == 2
    assert len(data["slots"]) == 0
    assert data["trip"]["budget_engage"] == 0.0


def test_create_slot_15min_validation(client, setup_planning_data):
    """Règle 5.5 : Le backend doit refuser tout créneau non multiple de 15 minutes."""
    # 09:10 (550 min) n'est pas multiple de 15
    res = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 550,
        "heure_fin": 660
    })
    assert res.status_code == 400
    assert "multiple de 15 minutes" in res.json()["detail"]

    # 09:15 (555 min) à 11:30 (690 min) est valide
    res_valid = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 555,
        "heure_fin": 690
    })
    assert res_valid.status_code == 201


def test_slot_conflict_rejection(client, setup_planning_data):
    """PRD_ecran3 US-10 : Refus de chevauchement sur le même jour avec HTTP 409."""
    # Créneau 1 : Jour 1, 09:00 (540) à 12:00 (720)
    res1 = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 540,
        "heure_fin": 720
    })
    assert res1.status_code == 201

    # Créneau 2 : Jour 1, 10:00 (600) à 11:30 (690) -> Conflit !
    res2 = client.post("/trips/1/slots", json={
        "activity_id": 2,
        "jour": 1,
        "heure_debut": 600,
        "heure_fin": 690
    })
    assert res2.status_code == 409
    assert "Créneau occupé" in res2.json()["detail"]

    # Créneau 2 sur Jour 2 -> Succès (autre jour)
    res3 = client.post("/trips/1/slots", json={
        "activity_id": 2,
        "jour": 2,
        "heure_debut": 600,
        "heure_fin": 690
    })
    assert res3.status_code == 201


def test_locked_slot_protection(client, setup_planning_data):
    """PRD_ecran3 US-11 : Un créneau verrouillé ne peut être déplacé sans déverrouillage."""
    res_create = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 540,
        "heure_fin": 660,
        "verrouille": 1
    })
    slot_id = res_create.json()["slot_id"]

    # Tentative de déplacement sans déverrouiller
    res_move = client.put(f"/slots/{slot_id}", json={
        "heure_debut": 600,
        "heure_fin": 720
    })
    assert res_move.status_code == 400
    assert "verrouillé" in res_move.json()["detail"]

    # Déverrouillage explicite
    res_unlock = client.post(f"/slots/{slot_id}/toggle-lock")
    assert res_unlock.status_code == 200
    assert res_unlock.json()["verrouille"] == 0

    # Déplacement maintenant autorisé
    res_move_ok = client.put(f"/slots/{slot_id}", json={
        "heure_debut": 600,
        "heure_fin": 720
    })
    assert res_move_ok.status_code == 200


def test_budget_aggregation_with_special_blocks(client, setup_planning_data):
    """PRD_ecran3 US-12, US-17 : Budget calculé combinant activités et blocs libres."""
    # 1. Slot activité 1 (25 € × 4 = 100 €) sur Jour 1
    client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 540,
        "heure_fin": 660
    })

    # 2. Bloc spécial "Déjeuner tapas" (80 €) sur Jour 1
    client.post("/trips/1/special_blocks", json={
        "label": "Déjeuner Tapas",
        "type": "repas",
        "categorie_id": 2,
        "cout": 80.0,
        "duree_minutes": 60,
        "jour": 1,
        "heure_debut": 720
    })

    # Récupération du planning
    res = client.get("/trips/1/planning")
    assert res.status_code == 200
    data = res.json()

    # Total Jour 1 = 100 € (activité) + 80 € (repas) = 180 €
    assert data["daily_budgets"]["1"] == 180.0
    assert data["trip"]["budget_engage"] == 180.0
    assert data["category_budgets"]["Nature & Randonnée"] == 100.0
    assert data["category_budgets"]["Gastronomie"] == 80.0


def test_delete_slot_unplaces_activity(client, setup_planning_data):
    """Supprimer un créneau doit réintégrer l'activité dans les fiches non placées."""
    res_create = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 540,
        "heure_fin": 660
    })
    slot_id = res_create.json()["slot_id"]

    # Vérification qu'il reste 1 activité non placée
    res1 = client.get("/trips/1/planning")
    assert len(res1.json()["unplaced_activities"]) == 1
    assert 1 in res1.json()["placed_activity_ids"]

    # Suppression du créneau
    res_del = client.delete(f"/slots/{slot_id}")
    assert res_del.status_code == 200

    # Vérification que les 2 activités sont à nouveau disponibles
    res2 = client.get("/trips/1/planning")
    assert len(res2.json()["unplaced_activities"]) == 2
    assert 1 not in res2.json()["placed_activity_ids"]


def test_duplicate_activity_slot_success(client, setup_planning_data):
    """
    US-21 / US-22 : Dupliquer un créneau d'activité crée une nouvelle activité clone
    et un nouveau créneau sans déplacer ni altérer l'activité d'origine.
    """
    # 1. Création du créneau initial (Activité 1 sur Jour 1, 09:00 - 11:00)
    res_create = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 540,
        "heure_fin": 660
    })
    orig_slot_id = res_create.json()["slot_id"]

    # 2. Duplication sur Jour 2, 14:00 - 16:00 (840 - 960)
    res_dup = client.post(f"/trips/1/slots/{orig_slot_id}/duplicate", json={
        "jour": 2,
        "heure_debut": 840,
        "heure_fin": 960
    })
    assert res_dup.status_code == 201
    dup_data = res_dup.json()
    assert dup_data["jour"] == 2
    assert dup_data["heure_debut"] == 840
    assert dup_data["heure_fin"] == 960
    new_slot_id = dup_data["slot_id"]
    new_act_id = dup_data["activity_id"]

    # L'ID de l'activité doit être différent (clone autonome)
    assert new_act_id != 1
    assert new_slot_id != orig_slot_id

    # 3. Vérification du planning complet
    res_planning = client.get("/trips/1/planning")
    slots = res_planning.json()["slots"]
    assert len(slots) == 2

    # L'original est toujours là
    orig = next(s for s in slots if s["id"] == orig_slot_id)
    assert orig["jour"] == 1
    assert orig["heure_debut"] == 540

    # Le clone est bien présent
    clone = next(s for s in slots if s["id"] == new_slot_id)
    assert clone["jour"] == 2
    assert clone["titre"] == "Randonnée Teide"
    assert clone["cout_total"] == 100.0


def test_duplicate_special_block_slot_success(client, setup_planning_data):
    """
    US-21 : Dupliquer un bloc libre (ex: repas) crée un nouveau bloc spécial indépendant.
    """
    # 1. Création du bloc libre initial (Déjeuner à 80€ sur Jour 1, 12:00)
    res_block = client.post("/trips/1/special_blocks", json={
        "label": "Déjeuner Tapas",
        "type": "repas",
        "categorie_id": 2,
        "cout": 80.0,
        "duree_minutes": 60,
        "jour": 1,
        "heure_debut": 720
    })
    assert res_block.status_code == 201
    slot_id = res_block.json()["slot_id"]


    # 2. Duplication sur Jour 3, 19:30 - 21:00 (1170 - 1260)
    res_dup = client.post(f"/trips/1/slots/{slot_id}/duplicate", json={
        "jour": 3,
        "heure_debut": 1170,
        "heure_fin": 1260
    })
    assert res_dup.status_code == 201
    dup_data = res_dup.json()
    assert dup_data["jour"] == 3
    assert dup_data["heure_debut"] == 1170
    assert dup_data["special_block_id"] is not None


def test_duplicate_slot_conflict_rejected(client, setup_planning_data):
    """
    US-10 / US-21 : Refus de la duplication si le créneau cible chevauche un créneau existant (409 Conflict).
    """
    # 1. Créneau sur Jour 1, 09:00 - 11:00
    res_create = client.post("/trips/1/slots", json={
        "activity_id": 1,
        "jour": 1,
        "heure_debut": 540,
        "heure_fin": 660
    })
    orig_slot_id = res_create.json()["slot_id"]

    # 2. Créneau sur Jour 2, 14:00 - 16:00
    client.post("/trips/1/slots", json={
        "activity_id": 2,
        "jour": 2,
        "heure_debut": 840,
        "heure_fin": 960
    })

    # 3. Tentative de duplication sur Jour 2, 15:00 - 17:00 (chevauchement partiel)
    res_dup = client.post(f"/trips/1/slots/{orig_slot_id}/duplicate", json={
        "jour": 2,
        "heure_debut": 900,
        "heure_fin": 1020
    })
    assert res_dup.status_code == 409
    assert "Créneau cible occupé" in res_dup.json()["detail"]

