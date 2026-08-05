"""
Tests d'intégration pour l'Atelier (Phase 5).

Couvre :
- Génération automatique des piles de cartes par catégorie au premier chargement (US-2)
- Sauvegarde et persistance d'une disposition personnalisée de cartes (US-1, US-6)
- Mise en corbeille d'atelier et restauration (US-8)
- Calcul dérivé de l'état 'est_placée' (US-7)
"""
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Trip, TripDestination, Category, Activity, ScheduledSlot, CardLayout

# Base de données SQLite en mémoire isolée pour les tests
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


@pytest.fixture(name="setup_workshop_data")
def fixture_setup_workshop_data(db_session):
    # 1. Voyage
    trip = Trip(
        nom="Voyage Atelier Test",
        date_debut=date(2026, 10, 1),
        nb_jours=5,
        nb_personnes=3,
        budget_total=2000.0
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    # 2. Destination
    destination = TripDestination(
        trip_id=trip.id,
        nom="La Palma",
        ordre=1
    )
    db_session.add(destination)
    db_session.commit()
    db_session.refresh(destination)

    # 3. Catégories
    cat_nature = Category(nom="Nature", couleur="#3F7A55", ordre=1)
    cat_culture = Category(nom="Culture", couleur="#2C5282", ordre=2)
    db_session.add_all([cat_nature, cat_culture])
    db_session.commit()
    db_session.refresh(cat_nature)
    db_session.refresh(cat_culture)

    # 4. Activités validées
    act1 = Activity(
        trip_id=trip.id,
        destination_id=destination.id,
        categorie_id=cat_nature.id,
        titre="Randonnée Volcans",
        statut_validation="validee",
        cout_par_personne=20.0
    )
    act2 = Activity(
        trip_id=trip.id,
        destination_id=destination.id,
        categorie_id=cat_nature.id,
        titre="Cascade de Los Tilos",
        statut_validation="validee",
        cout_par_personne=10.0
    )
    act3 = Activity(
        trip_id=trip.id,
        destination_id=destination.id,
        categorie_id=cat_culture.id,
        titre="Musée Naval",
        statut_validation="validee",
        cout_par_personne=5.0
    )
    db_session.add_all([act1, act2, act3])
    db_session.commit()
    db_session.refresh(act1)
    db_session.refresh(act2)
    db_session.refresh(act3)

    return {
        "trip": trip,
        "destination": destination,
        "cat_nature": cat_nature,
        "cat_culture": cat_culture,
        "act1": act1,
        "act2": act2,
        "act3": act3
    }


def test_get_workshop_data_creates_initial_piles(client, setup_workshop_data, db_session):
    """
    Vérifie qu'à la première ouverture de l'atelier pour une destination,
    les cartes sont automatiquement regroupées en piles par catégorie (US-2).
    """
    dest_id = setup_workshop_data["destination"].id
    res = client.get(f"/api/destinations/{dest_id}/workshop")
    assert res.status_code == 200
    data = res.json()

    assert data["destination_id"] == dest_id
    assert data["disposition_nom"] == "Disposition initiale"
    assert len(data["activities"]) == 3

    # Vérification que les cartes de la même catégorie ont la même colonne X
    act1 = next(a for a in data["activities"] if a["titre"] == "Randonnée Volcans")
    act2 = next(a for a in data["activities"] if a["titre"] == "Cascade de Los Tilos")
    act3 = next(a for a in data["activities"] if a["titre"] == "Musée Naval")

    # act1 et act2 sont "Nature" -> même X, Y décalé
    assert act1["x"] == act2["x"]
    assert act2["y"] > act1["y"]

    # act3 est "Culture" -> X distinct
    assert act3["x"] != act1["x"]

    # Vérification persistance en base
    layout = db_session.query(CardLayout).filter(
        CardLayout.destination_id == dest_id,
        CardLayout.est_courante == 1
    ).first()
    assert layout is not None
    assert layout.est_initiale == 1


def test_save_workshop_layout_persists_custom_coordinates(client, setup_workshop_data):
    """
    Vérifie que le déplacement de cartes et l'enregistrement de coordonnées (US-1, US-6)
    sont fidèlement conservés lors des chargements suivants.
    """
    dest_id = setup_workshop_data["destination"].id
    act1_id = setup_workshop_data["act1"].id

    # 1. Enregistrement d'une nouvelle disposition
    payload = {
        "nom": "Disposition personnalisée",
        "disposition": {
            str(act1_id): {"x": 650.0, "y": 820.0, "z_index": 5}
        }
    }
    save_res = client.put(f"/api/destinations/{dest_id}/layout", json=payload)
    assert save_res.status_code == 200
    saved_data = save_res.json()
    assert saved_data["nom"] == "Disposition personnalisée"
    assert saved_data["disposition"][str(act1_id)]["x"] == 650.0

    # 2. Rechargement de l'atelier
    get_res = client.get(f"/api/destinations/{dest_id}/workshop")
    assert get_res.status_code == 200
    workshop_data = get_res.json()
    act1_node = next(a for a in workshop_data["activities"] if a["id"] == act1_id)
    assert act1_node["x"] == 650.0
    assert act1_node["y"] == 820.0
    assert act1_node["z_index"] == 5


def test_workshop_trash_and_restore(client, setup_workshop_data):
    """
    Vérifie le cycle de vie de la corbeille propre à l'Atelier (US-8).
    """
    dest_id = setup_workshop_data["destination"].id
    act1_id = setup_workshop_data["act1"].id

    # 1. Mise en corbeille d'atelier
    trash_res = client.post(f"/api/activities/{act1_id}/workshop-trash")
    assert trash_res.status_code == 200

    # 2. L'activité ne doit plus être renvoyée sur le canvas
    workshop_res = client.get(f"/api/destinations/{dest_id}/workshop")
    assert workshop_res.status_code == 200
    activities = workshop_res.json()["activities"]
    assert not any(a["id"] == act1_id for a in activities)

    # 3. Elle doit figurer dans la corbeille de l'atelier
    trash_list_res = client.get(f"/api/destinations/{dest_id}/workshop-trash")
    assert trash_list_res.status_code == 200
    trash_items = trash_list_res.json()
    assert len(trash_items) == 1
    assert trash_items[0]["id"] == act1_id
    assert trash_items[0]["jours_restants_grace"] == 30

    # 4. Restauration de l'activité
    restore_res = client.post(f"/api/activities/{act1_id}/workshop-restore")
    assert restore_res.status_code == 200

    # 5. Elle réapparaît sur le canvas
    workshop_after_res = client.get(f"/api/destinations/{dest_id}/workshop")
    assert workshop_after_res.status_code == 200
    activities_after = workshop_after_res.json()["activities"]
    assert any(a["id"] == act1_id for a in activities_after)


def test_workshop_activity_placed_state(client, setup_workshop_data, db_session):
    """
    Vérifie que l'état 'est_placée' est fidèlement dérivé de ScheduledSlot (US-7).
    """
    dest_id = setup_workshop_data["destination"].id
    trip_id = setup_workshop_data["trip"].id
    act1_id = setup_workshop_data["act1"].id
    act2_id = setup_workshop_data["act2"].id

    # On place act1 dans le planning
    slot = ScheduledSlot(
        trip_id=trip_id,
        activity_id=act1_id,
        jour=1,
        heure_debut=540,
        heure_fin=660,
        type="activite"
    )
    db_session.add(slot)
    db_session.commit()

    # Rechargement de l'atelier
    res = client.get(f"/api/destinations/{dest_id}/workshop")
    assert res.status_code == 200
    data = res.json()

    act1 = next(a for a in data["activities"] if a["id"] == act1_id)
    act2 = next(a for a in data["activities"] if a["id"] == act2_id)

    assert act1["est_placée"] is True
    assert act2["est_placée"] is False


def test_named_layouts_lifecycle(client, setup_workshop_data):
    """
    Vérifie la création, la liste, l'activation et la suppression de dispositions nommées (ex: 'Réflexion initiale').
    """
    dest_id = setup_workshop_data["destination"].id
    act1_id = setup_workshop_data["act1"].id

    # 1. Création d'une disposition nommée
    create_res = client.post(
        f"/api/destinations/{dest_id}/layouts",
        json={
            "nom": "Réflexion initiale",
            "disposition": {
                str(act1_id): {"x": 400.0, "y": 500.0, "z_index": 2}
            }
        }
    )
    assert create_res.status_code == 200
    created_layout = create_res.json()
    assert created_layout["nom"] == "Réflexion initiale"
    assert created_layout["est_courante"] == 1
    layout_id = created_layout["id"]

    # 2. Liste des dispositions
    list_res = client.get(f"/api/destinations/{dest_id}/layouts")
    assert list_res.status_code == 200
    layouts = list_res.json()
    assert len(layouts) >= 1
    assert any(l["nom"] == "Réflexion initiale" for l in layouts)

    # 3. Création d'une deuxième disposition
    create_res_2 = client.post(
        f"/api/destinations/{dest_id}/layouts",
        json={
            "nom": "Option B",
            "disposition": {
                str(act1_id): {"x": 800.0, "y": 900.0, "z_index": 3}
            }
        }
    )
    assert create_res_2.status_code == 200
    layout_2_id = create_res_2.json()["id"]

    # 4. Réactivation de la première disposition nommée
    activate_res = client.post(f"/api/destinations/{dest_id}/layouts/{layout_id}/activate")
    assert activate_res.status_code == 200
    active_layout = activate_res.json()
    assert active_layout["nom"] == "Réflexion initiale"
    assert active_layout["est_courante"] == 1

    # 5. Suppression de la deuxième disposition
    del_res = client.delete(f"/api/destinations/{dest_id}/layouts/{layout_2_id}")
    assert del_res.status_code == 200
