"""
Tests automatisés pour la validation de la Phase 1 et de l'Écran 0 (Dashboard).
cf. PRD_ecran0_dashboard.md, SCHEMA_BASE_DE_DONNEES.md, GEMINI.md (Règle 4).
"""
import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import (
    Trip, TripDestination, Category, Activity, ScheduledSlot, SpecialBlock, Document
)
from app.services.dashboard import compute_dashboard_data
from app.main import app


# Configuration d'une base de données SQLite en mémoire pour les tests unitaires
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """
    Crée une base de données propre en mémoire pour chaque test.
    """
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Injection d'un jeu de données de test isolé
    trip = Trip(
        nom="Voyage Test Canaries",
        date_debut=date.today() + timedelta(days=30),  # Départ dans 30 jours
        nb_jours=7,
        nb_personnes=3,  # 3 personnes
        budget_total=3000.0,
        planning_heure_debut=480,
        planning_heure_fin=1320
    )
    db.add(trip)
    db.flush()

    dest1 = TripDestination(trip_id=trip.id, nom="La Palma", ordre=1)
    dest2 = TripDestination(trip_id=trip.id, nom="Tenerife", ordre=2)
    db.add_all([dest1, dest2])
    db.flush()

    cat_nature = Category(trip_id=trip.id, nom="Nature", couleur="#3F7A55", est_systeme=1)
    cat_gastro = Category(trip_id=trip.id, nom="Gastronomie", couleur="#A4553A", est_systeme=1)
    db.add_all([cat_nature, cat_gastro])
    db.flush()

    # Activité 1 validée (Nature, 50€/pers => 150€ total pour 3 pers)
    act1 = Activity(
        trip_id=trip.id,
        destination_id=dest1.id,
        categorie_id=cat_nature.id,
        titre="Rando Volcan",
        cout_par_personne=50.0,
        statut_validation="validee"
    )
    # Activité 2 validée (Gastro, 20€/pers => 60€ total pour 3 pers)
    act2 = Activity(
        trip_id=trip.id,
        destination_id=dest2.id,
        categorie_id=cat_gastro.id,
        titre="Dégustation Tapas",
        cout_par_personne=20.0,
        statut_validation="validee"
    )
    # Activité 3 en attente (À valider)
    act3_pending = Activity(
        trip_id=trip.id,
        destination_id=dest1.id,
        categorie_id=cat_nature.id,
        titre="Plage Sauvage",
        cout_par_personne=0.0,
        statut_validation="a_valider"
    )
    db.add_all([act1, act2, act3_pending])
    db.flush()

    # Bloc libre spécial (Location voiture, 300€)
    sb = SpecialBlock(
        trip_id=trip.id,
        label="Location 4x4",
        type="personnalise",
        cout=300.0
    )
    db.add(sb)
    db.flush()

    # Créneau planifié pour act1 (Jour 2)
    slot = ScheduledSlot(
        trip_id=trip.id,
        activity_id=act1.id,
        jour=2,
        heure_debut=540,
        heure_fin=720,
        type="activite"
    )
    db.add(slot)
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=test_engine)


def test_countdown_calculation(db_session):
    """
    Vérifie que le compte à rebours dynamique calcule exactement le nombre de jours restant (US-2).
    """
    trip = db_session.query(Trip).first()
    res = compute_dashboard_data(db_session, trip.id)
    assert res.jours_avant_depart == 30


def test_budget_calculation_with_travelers_and_special_blocks(db_session):
    """
    Vérifie la règle d'or 5.2 :
    - Prix d'une activité = cout_par_personne * nb_personnes
      Act1 : 50 * 3 = 150 €
      Act2 : 20 * 3 = 60 €
    - Bloc libre = 300 €
    - Total estimé = 150 + 60 + 300 = 510 €
    - Budget prévu = 3000 €
    """
    trip = db_session.query(Trip).first()
    res = compute_dashboard_data(db_session, trip.id)

    assert res.budget.budget_total_prevu == 3000.0
    assert res.budget.cout_total_estime == 510.0


def test_budget_breakdown_by_destination_and_category(db_session):
    """
    Vérifie la ventilation par destination et par catégorie (US-4, US-5).
    """
    trip = db_session.query(Trip).first()
    res = compute_dashboard_data(db_session, trip.id)

    # Par destination
    dest_costs = {item.label: item.montant for item in res.budget.par_destination}
    assert dest_costs["La Palma"] == 150.0
    assert dest_costs["Tenerife"] == 60.0

    # Par catégorie
    cat_costs = {item.label: item.montant for item in res.budget.par_categorie}
    assert cat_costs["Nature"] == 150.0
    assert cat_costs["Gastronomie"] == 60.0


def test_validation_alert_and_placed_activities(db_session):
    """
    Vérifie la détection des fiches à valider (US-9) et des fiches placées dans le planning (US-8).
    """
    trip = db_session.query(Trip).first()
    res = compute_dashboard_data(db_session, trip.id)

    # 1 fiche est en statut 'a_valider'
    assert res.nb_fiches_a_valider == 1
    # 2 fiches validées au total
    assert res.nb_activites_total == 2
    # 1 fiche placée dans le planning
    assert res.nb_activites_placées == 1


def test_api_dashboard_endpoint(db_session):
    """
    Vérifie que la route HTTP GET /api/trips/{id}/dashboard renvoie un statut 200 et les bonnes données.
    """
    # Surcharge de la dépendance de base de données pour utiliser la session de test en mémoire
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    trip = db_session.query(Trip).first()
    response = client.get(f"/api/trips/{trip.id}/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert data["nom_voyage"] == "Voyage Test Canaries"
    assert data["nb_personnes"] == 3
    assert data["nb_fiches_a_valider"] == 1
    assert data["budget"]["cout_total_estime"] == 510.0

    app.dependency_overrides.clear()
