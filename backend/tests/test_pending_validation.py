"""
Tests automatisés pour la validation de la Phase 3 :
Pile "À valider" (Mode Focus) et Corbeille avec période de grâce.

Conforme à PRD_ecran1_creation.md (US-4, US-6, US-7, US-8, US-9, US-10, US-11)
et SCHEMA_BASE_DE_DONNEES.md.
"""
import io
import pytest
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import Trip, TripDestination, Category, Activity, Document, Tag
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
    Initialise une base de test avec un voyage, des destinations et des fiches en attente de validation.
    """
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Création du voyage
    trip = Trip(
        nom="Voyage Test Phase 3",
        date_debut=date.today() + timedelta(days=20),
        nb_jours=6,
        nb_personnes=2,
        budget_total=2500.0
    )
    db.add(trip)
    db.flush()

    dest1 = TripDestination(trip_id=trip.id, nom="La Palma", ordre=1)
    db.add(dest1)
    db.flush()

    cat_nat = Category(trip_id=trip.id, nom="Nature", couleur="#3F7A55", est_systeme=1)
    cat_cult = Category(trip_id=trip.id, nom="Culture", couleur="#A4553A", est_systeme=1)
    db.add_all([cat_nat, cat_cult])
    db.flush()

    tag_vue = Tag(trip_id=trip.id, nom="Panorama")
    db.add(tag_vue)
    db.flush()

    # Fiche 1 : en attente de validation, issue d'un scraping
    act_pending1 = Activity(
        trip_id=trip.id,
        destination_id=dest1.id,
        categorie_id=cat_nat.id,
        titre="Randonnée Volcan San Antonio",
        cout_par_personne=15.0,
        source="scraping_auto",
        statut_validation="a_valider",
        url_source="https://www.getyourguide.fr/volcan-san-antonio"
    )
    # Fiche 2 : en attente de validation, incomplète
    act_pending2 = Activity(
        trip_id=trip.id,
        destination_id=dest1.id,
        titre="Bateau Dauphins & Grottes",
        source="claude_chrome",
        statut_validation="a_valider",
        url_source="https://www.visitlapalma.es/dauphins"
    )
    # Fiche 3 : déjà validée
    act_validated = Activity(
        trip_id=trip.id,
        destination_id=dest1.id,
        categorie_id=cat_cult.id,
        titre="Musée Naval Barco de la Virgen",
        cout_par_personne=5.0,
        source="manuel",
        statut_validation="validee"
    )
    db.add_all([act_pending1, act_pending2, act_validated])
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield client, db, trip, dest1, cat_nat, [act_pending1, act_pending2, act_validated], tag_vue

    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=test_engine)


def test_get_pending_validation_activities(client_with_db):
    """
    US-4 & US-9 : Récupère uniquement les fiches au statut 'a_valider', excluant les validées.
    """
    client, db, trip, dest1, cat_nat, activities, _ = client_with_db

    res = client.get(f"/api/trips/{trip.id}/pending-validation")
    assert res.status_code == 200
    data = res.json()

    # Doit contenir exactement les 2 fiches en attente
    assert len(data) == 2
    titres = [a["titre"] for a in data]
    assert "Randonnée Volcan San Antonio" in titres
    assert "Bateau Dauphins & Grottes" in titres
    assert "Musée Naval Barco de la Virgen" not in titres


def test_validate_incomplete_activity_succeeds(client_with_db):
    """
    US-6 : La validation réussit même si la fiche est incomplète (score faible, champs vides).
    """
    client, db, trip, dest1, cat_nat, activities, _ = client_with_db
    act_incomplete = activities[1]  # Bateau Dauphins & Grottes (sans catégorie ni prix)

    res = client.post(f"/api/activities/{act_incomplete.id}/validate", json={})
    assert res.status_code == 200
    data = res.json()

    assert data["statut_validation"] == "validee"
    assert data["id"] == act_incomplete.id

    # Vérification en base : elle ne doit plus être dans la pile en attente
    pending_res = client.get(f"/api/trips/{trip.id}/pending-validation")
    assert len(pending_res.json()) == 1


def test_validate_activity_with_field_updates(client_with_db):
    """
    US-5 & US-10 : Lors de la validation, l'utilisateur peut modifier les champs et ajouter des tags.
    """
    client, db, trip, dest1, cat_nat, activities, tag_vue = client_with_db
    act_pending = activities[0]  # Randonnée Volcan San Antonio

    payload = {
        "titre": "Volcan San Antonio & Centre des Visiteurs",
        "cout_par_personne": 18.0,
        "note_interet": 4,
        "tag_ids": [tag_vue.id]
    }
    res = client.post(f"/api/activities/{act_pending.id}/validate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["titre"] == "Volcan San Antonio & Centre des Visiteurs"
    assert data["cout_par_personne"] == 18.0
    assert data["cout_total"] == 36.0  # 18€ * 2 personnes
    assert data["note_interet"] == 4
    assert data["statut_validation"] == "validee"
    assert len(data["tags"]) == 1
    assert data["tags"][0]["nom"] == "Panorama"


def test_reject_activity_moves_to_trash(client_with_db):
    """
    US-7 & US-8 : Rejeter une fiche la déplace dans la corbeille (soft-delete avec supprime_le).
    Elle disparaît de la pile 'a_valider' et de la liste standard, sans suppression physique.
    """
    client, db, trip, dest1, cat_nat, activities, _ = client_with_db
    act_to_reject = activities[0]

    # Rejet
    reject_res = client.post(f"/api/activities/{act_to_reject.id}/reject")
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

    # Ne doit plus apparaître dans la pile à valider
    pending_res = client.get(f"/api/trips/{trip.id}/pending-validation")
    assert all(a["id"] != act_to_reject.id for a in pending_res.json())

    # Ne doit plus apparaître dans la liste des activités actives
    activities_res = client.get(f"/api/trips/{trip.id}/activities")
    assert all(a["id"] != act_to_reject.id for a in activities_res.json())

    # Mais est présente dans la corbeille
    trash_res = client.get(f"/api/trips/{trip.id}/trash")
    assert trash_res.status_code == 200
    trash_items = trash_res.json()
    assert any(item["id"] == act_to_reject.id for item in trash_items)


def test_trash_countdown_and_restore(client_with_db):
    """
    US-8 & US-11 : Visualisation du décompte de grâce (30 jours) et restauration dans le catalogue.
    """
    client, db, trip, dest1, cat_nat, activities, _ = client_with_db
    act = activities[0]

    # Déplacement en corbeille
    client.post(f"/api/activities/{act.id}/reject")

    trash_res = client.get(f"/api/trips/{trip.id}/trash")
    trash_items = trash_res.json()
    item = next(i for i in trash_items if i["id"] == act.id)
    assert item["jours_restants_grace"] == 30

    # Restauration
    restore_res = client.post(f"/api/activities/{act.id}/restore")
    assert restore_res.status_code == 200
    restored = restore_res.json()
    assert restored["supprime_le"] is None

    # Doit avoir disparu de la corbeille
    trash_after = client.get(f"/api/trips/{trip.id}/trash").json()
    assert all(i["id"] != act.id for i in trash_after)

    # Réapparaît dans la liste des activités
    activities_after = client.get(f"/api/trips/{trip.id}/activities").json()
    assert any(a["id"] == act.id for a in activities_after)


def test_purge_activity_permanently(client_with_db):
    """
    US-8 : Suppression définitive (purge) d'une fiche et de ses documents associés.
    """
    client, db, trip, dest1, _, activities, _ = client_with_db
    act = activities[0]

    # Ajout d'un document lié
    doc = Document(
        activity_id=act.id,
        libelle="Photo de test",
        chemin_fichier="uploads/activities/test.jpg",
        type_fichier="photo"
    )
    db.add(doc)
    db.commit()

    # Purge définitive
    purge_res = client.delete(f"/api/activities/{act.id}/purge")
    assert purge_res.status_code == 204

    # Vérification physique en base
    assert db.query(Activity).filter(Activity.id == act.id).first() is None
    assert db.query(Document).filter(Document.activity_id == act.id).first() is None


def test_activities_filter_statut_validation_validee(client_with_db):
    """
    Règle d'or US-2 / US-4 (PRD_ecran1_creation.md) :
    Le catalogue principal ne doit afficher STRICTEMENT que les fiches ayant statut_validation == 'validee'.
    Les fiches en attente (scraping ou capture) ne doivent jamais s'y trouver avant validation.
    """
    client, db, trip, _, _, activities, _ = client_with_db
    
    # Requête avec filtre statut_validation=validee
    res = client.get(f"/api/trips/{trip.id}/activities?statut_validation=validee")
    assert res.status_code == 200
    validated_acts = res.json()

    # Seule la Fiche 3 ("Musée Naval Barco de la Virgen") est validée
    assert len(validated_acts) == 1
    assert validated_acts[0]["titre"] == "Musée Naval Barco de la Virgen"
    assert validated_acts[0]["statut_validation"] == "validee"

    # Vérifie que les fiches 'a_valider' (Fiche 1 et Fiche 2) ne sont PAS dans le catalogue
    validated_ids = [a["id"] for a in validated_acts]
    assert activities[0].id not in validated_ids # Randonnée Volcan
    assert activities[1].id not in validated_ids # Bateau Dauphins


def test_validation_workflow_transitions_from_pending_to_catalogue(client_with_db):
    """
    Validation du workflow complet Mode Focus -> Catalogue :
    Une fiche en attente validée rejoint immédiatement le catalogue et quitte le SAS.
    """
    client, db, trip, dest1, _, activities, tag_vue = client_with_db
    pending_act = activities[0] # Fiche 1 (Randonnée Volcan)

    # 1. Vérification initiale : présente dans le SAS d'attente
    pending_before = client.get(f"/api/trips/{trip.id}/pending-validation").json()
    assert any(a["id"] == pending_act.id for a in pending_before)

    # 2. Validation via l'API (simulant le clic 'Valider & Suivant' du Mode Focus)
    val_payload = {
        "titre": "Randonnée Volcan San Antonio & Teneguía (Validée)",
        "destination_id": dest1.id,
        "cout_par_personne": 18.0,
        "duree_min": 180,
        "note_interet": 5,
        "description": "Superbe randonnée au milieu des champs de lave.",
        "remarques": "Prévoir de bonnes chaussures.",
        "tag_ids": [tag_vue.id]
    }
    val_res = client.post(f"/api/activities/{pending_act.id}/validate", json=val_payload)
    assert val_res.status_code == 200

    # 3. Quitte le SAS d'attente
    pending_after = client.get(f"/api/trips/{trip.id}/pending-validation").json()
    assert all(a["id"] != pending_act.id for a in pending_after)

    # 4. Rejoint le catalogue officiel
    catalogue_res = client.get(f"/api/trips/{trip.id}/activities?statut_validation=validee").json()
    validated_item = next((a for a in catalogue_res if a["id"] == pending_act.id), None)
    assert validated_item is not None
    assert validated_item["titre"] == "Randonnée Volcan San Antonio & Teneguía (Validée)"
    assert validated_item["cout_par_personne"] == 18.0
    assert validated_item["statut_validation"] == "validee"

