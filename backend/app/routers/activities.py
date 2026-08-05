"""
Routeur FastAPI pour le CRUD des fiches activités et données associées.
cf. PRD_ecran1_creation.md (US-1, US-5, US-10) et SCHEMA_BASE_DE_DONNEES.md.
"""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Trip, TripDestination, Category, Activity, Document, Tag, activity_tags, ScheduledSlot
)
from app.schemas import (
    ActivityCreate, ActivityUpdate, ActivityDetail, ActivitySummary,
    CategoryBase, DestinationBase, TagBase, DocumentBase, TrashItem
)
from app.services.completeness import calculate_completeness

router = APIRouter(tags=["Activities"])


# ---------------------------------------------------------------------------
# Utilitaires de sérialisation
# ---------------------------------------------------------------------------
def _format_activity_detail(activity: Activity, nb_personnes: int) -> ActivityDetail:
    """
    Construit l'objet ActivityDetail complet avec calculs dérivés.
    """
    main_photo = next((d.chemin_fichier for d in activity.documents if d.est_principale == 1 and d.type_fichier == "photo"), None)
    if not main_photo:
        first_photo = next((d.chemin_fichier for d in activity.documents if d.type_fichier == "photo"), None)
        main_photo = first_photo

    has_photo = any(d.type_fichier == "photo" for d in activity.documents)
    tag_count = len(activity.tags)
    score = calculate_completeness(activity, has_main_photo=has_photo, tag_count=tag_count)
    is_placed = len(activity.scheduled_slots) > 0

    return ActivityDetail(
        id=activity.id,
        trip_id=activity.trip_id,
        destination_id=activity.destination_id,
        destination_nom=activity.destination.nom if activity.destination else None,
        categorie_id=activity.categorie_id,
        categorie_nom=activity.category.nom if activity.category else None,
        categorie_couleur=activity.category.couleur if activity.category else "#8E8F92",
        type_element=activity.type_element or "activite",
        titre=activity.titre,
        adresse=activity.adresse,
        zone_geo=activity.zone_geo,
        duree_min=activity.duree_min,
        duree_max=activity.duree_max,
        date_debut=activity.date_debut,
        date_fin=activity.date_fin,
        numero_reference=activity.numero_reference,
        cout_par_personne=activity.cout_par_personne or 0.0,
        cout_total=(activity.cout_par_personne or 0.0) * nb_personnes,
        description=activity.description,
        horaires_ouverture=activity.horaires_ouverture,
        jours_fermeture=activity.jours_fermeture,
        source=activity.source or "manuel",
        remarques=activity.remarques,
        avis_utilisateurs=activity.avis_utilisateurs,
        rating=activity.rating,
        note_interet=activity.note_interet,
        statut=activity.statut or "non_reserve",
        statut_validation=activity.statut_validation or "validee",
        url_source=activity.url_source,
        completude=score,
        est_placée=is_placed,
        created_at=activity.created_at,
        supprime_le=activity.supprime_le,
        tags=[TagBase.model_validate(t) for t in activity.tags],
        documents=[DocumentBase.model_validate(d) for d in activity.documents],
        photo_principale=main_photo
    )


# ---------------------------------------------------------------------------
# Endpoints de listage et création
# ---------------------------------------------------------------------------
@router.get("/api/trips/{trip_id}/activities", response_model=List[ActivitySummary])
def get_trip_activities(
    trip_id: int,
    destination_id: Optional[int] = Query(None),
    categorie_id: Optional[int] = Query(None),
    statut_validation: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Récupère la liste des fiches d'activités pour un voyage, avec filtres optionnels.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voyage {trip_id} introuvable"
        )

    query = db.query(Activity).filter(Activity.trip_id == trip_id)

    if not include_deleted:
        query = query.filter(Activity.supprime_le == None)

    if destination_id:
        query = query.filter(Activity.destination_id == destination_id)

    if categorie_id:
        query = query.filter(Activity.categorie_id == categorie_id)

    if statut_validation:
        query = query.filter(Activity.statut_validation == statut_validation)

    activities = query.order_by(Activity.created_at.desc()).all()

    results = []
    for act in activities:
        main_photo = next((d.chemin_fichier for d in act.documents if d.est_principale == 1 and d.type_fichier == "photo"), None)
        if not main_photo:
            first_photo = next((d.chemin_fichier for d in act.documents if d.type_fichier == "photo"), None)
            main_photo = first_photo

        has_photo = any(d.type_fichier == "photo" for d in act.documents)
        score = calculate_completeness(act, has_main_photo=has_photo, tag_count=len(act.tags))
        is_placed = len(act.scheduled_slots) > 0

        results.append(ActivitySummary(
            id=act.id,
            titre=act.titre,
            type_element=act.type_element or "activite",
            destination_id=act.destination_id,
            destination_nom=act.destination.nom if act.destination else None,
            categorie_id=act.categorie_id,
            categorie_nom=act.category.nom if act.category else None,
            categorie_couleur=act.category.couleur if act.category else "#8E8F92",
            cout_par_personne=act.cout_par_personne or 0.0,
            cout_total=(act.cout_par_personne or 0.0) * trip.nb_personnes,
            note_interet=act.note_interet,
            statut_validation=act.statut_validation or "validee",
            source=act.source or "manuel",
            completude=score,
            est_placée=is_placed,
            photo_principale=main_photo,
            tags=[TagBase.model_validate(t) for t in act.tags]
        ))

    return results


@router.post("/api/trips/{trip_id}/activities", response_model=ActivityDetail, status_code=status.HTTP_201_CREATED)
def create_activity(
    trip_id: int,
    act_in: ActivityCreate,
    db: Session = Depends(get_db)
):
    """
    Crée une nouvelle fiche activité manuellement.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voyage {trip_id} introuvable"
        )

    dest = db.query(TripDestination).filter(
        TripDestination.id == act_in.destination_id,
        TripDestination.trip_id == trip_id
    ).first()
    if not dest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Destination {act_in.destination_id} invalide pour ce voyage"
        )

    nouvelle_act = Activity(
        trip_id=trip_id,
        destination_id=act_in.destination_id,
        categorie_id=act_in.categorie_id,
        type_element=act_in.type_element,
        titre=act_in.titre.strip(),
        adresse=act_in.adresse,
        zone_geo=act_in.zone_geo,
        duree_min=act_in.duree_min,
        duree_max=act_in.duree_max,
        date_debut=act_in.date_debut,
        date_fin=act_in.date_fin,
        numero_reference=act_in.numero_reference,
        cout_par_personne=act_in.cout_par_personne,
        description=act_in.description,
        horaires_ouverture=act_in.horaires_ouverture,
        jours_fermeture=act_in.jours_fermeture,
        source=act_in.source or "manuel",
        remarques=act_in.remarques,
        avis_utilisateurs=act_in.avis_utilisateurs,
        rating=act_in.rating,
        note_interet=act_in.note_interet,
        statut=act_in.statut or "non_reserve",
        statut_validation=act_in.statut_validation or "validee",
        url_source=act_in.url_source
    )

    # Association des tags
    if act_in.tag_ids:
        tags_trouves = db.query(Tag).filter(
            Tag.id.in_(act_in.tag_ids),
            Tag.trip_id == trip_id
        ).all()
        nouvelle_act.tags = tags_trouves

    db.add(nouvelle_act)
    db.commit()
    db.refresh(nouvelle_act)

    return _format_activity_detail(nouvelle_act, trip.nb_personnes)


# ---------------------------------------------------------------------------
# Endpoints de détail, mise à jour et suppression
# ---------------------------------------------------------------------------
@router.get("/api/activities/{activity_id}", response_model=ActivityDetail)
def get_activity_detail(activity_id: int, db: Session = Depends(get_db)):
    """
    Récupère le détail complet d'une fiche activité pour le panneau d'édition.
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )
    trip = db.query(Trip).filter(Trip.id == act.trip_id).first()
    nb_pers = trip.nb_personnes if trip else 1
    return _format_activity_detail(act, nb_pers)


@router.put("/api/activities/{activity_id}", response_model=ActivityDetail)
@router.patch("/api/activities/{activity_id}", response_model=ActivityDetail)
def update_activity(
    activity_id: int,
    act_in: ActivityUpdate,
    db: Session = Depends(get_db)
):
    """
    Met à jour tous les champs modifiés d'une fiche activité (panneau complet).
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    data = act_in.model_dump(exclude_unset=True)

    # Traitement particulier des tags
    if "tag_ids" in data:
        tag_ids = data.pop("tag_ids")
        if tag_ids is not None:
            tags_trouves = db.query(Tag).filter(
                Tag.id.in_(tag_ids),
                Tag.trip_id == act.trip_id
            ).all()
            act.tags = tags_trouves

    for champ, valeur in data.items():
        setattr(act, champ, valeur)

    db.commit()
    db.refresh(act)

    trip = db.query(Trip).filter(Trip.id == act.trip_id).first()
    nb_pers = trip.nb_personnes if trip else 1
    return _format_activity_detail(act, nb_pers)


@router.delete("/api/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    """
    Place l'activité dans la corbeille (soft-delete avec supprime_le).
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    act.supprime_le = datetime.now(timezone.utc)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Données de référence pour les formulaires (Catégories et Destinations)
# ---------------------------------------------------------------------------
@router.get("/api/trips/{trip_id}/categories", response_model=List[CategoryBase])
def get_trip_categories(trip_id: int, db: Session = Depends(get_db)):
    """
    Récupère les catégories disponibles pour ce voyage.
    """
    return db.query(Category).filter(Category.trip_id == trip_id).order_by(Category.id).all()


@router.get("/api/trips/{trip_id}/destinations", response_model=List[DestinationBase])
def get_trip_destinations(trip_id: int, db: Session = Depends(get_db)):
    """
    Récupère les destinations du voyage (pour les sélecteurs).
    """
    return db.query(TripDestination).filter(TripDestination.trip_id == trip_id).order_by(TripDestination.ordre).all()


# ---------------------------------------------------------------------------
# Phase 3 : Pile "À valider" (Mode Focus) & Corbeille avec période de grâce
# cf. PRD_ecran1_creation.md (US-4, US-6, US-7, US-8, US-9, US-10, US-11)
# ---------------------------------------------------------------------------
@router.get("/api/trips/{trip_id}/pending-validation", response_model=List[ActivityDetail])
def get_pending_validation_activities(trip_id: int, db: Session = Depends(get_db)):
    """
    Récupère les fiches d'activités en attente de validation (statut_validation = 'a_valider').
    Exclut les fiches déjà rejetées ou mises en corbeille.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voyage {trip_id} introuvable"
        )

    pending = (
        db.query(Activity)
        .filter(
            Activity.trip_id == trip_id,
            Activity.statut_validation == "a_valider",
            Activity.supprime_le.is_(None)
        )
        .order_by(Activity.id.desc())
        .all()
    )

    return [_format_activity_detail(act, trip.nb_personnes) for act in pending]


@router.post("/api/activities/{activity_id}/validate", response_model=ActivityDetail)
def validate_activity(
    activity_id: int,
    act_in: Optional[ActivityUpdate] = None,
    db: Session = Depends(get_db)
):
    """
    Valide une fiche d'activité (statut_validation = 'validee') et applique
    les éventuelles modifications saisies dans le mode focus.
    La validation réussit quel que soit le score de complétude (US-6).
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    # Mise à jour des champs si fournis
    if act_in:
        data = act_in.model_dump(exclude_unset=True)
        if "tag_ids" in data:
            tag_ids = data.pop("tag_ids")
            if tag_ids is not None:
                tags_trouves = db.query(Tag).filter(
                    Tag.id.in_(tag_ids),
                    Tag.trip_id == act.trip_id
                ).all()
                act.tags = tags_trouves
        for champ, valeur in data.items():
            setattr(act, champ, valeur)

    act.statut_validation = "validee"
    act.supprime_le = None  # S'assure qu'elle n'est pas en corbeille
    db.commit()
    db.refresh(act)

    trip = db.query(Trip).filter(Trip.id == act.trip_id).first()
    nb_pers = trip.nb_personnes if trip else 1
    return _format_activity_detail(act, nb_pers)


@router.post("/api/activities/{activity_id}/reject", status_code=status.HTTP_200_OK)
def reject_activity(activity_id: int, db: Session = Depends(get_db)):
    """
    Rejette une fiche vers la corbeille (soft-delete avec horodatage).
    La fiche reste récupérable pendant sa période de grâce (US-7, US-8).
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    act.supprime_le = datetime.now(timezone.utc)
    db.commit()
    return {"status": "rejected", "id": activity_id, "message": "Fiche déplacée vers la corbeille"}


@router.get("/api/trips/{trip_id}/trash", response_model=List[TrashItem])
def get_trash_items(trip_id: int, db: Session = Depends(get_db)):
    """
    Liste les fiches placées dans la corbeille avec décompte de la période de grâce restante (30 jours).
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voyage {trip_id} introuvable"
        )

    trash_activities = (
        db.query(Activity)
        .filter(
            Activity.trip_id == trip_id,
            Activity.supprime_le.is_not(None)
        )
        .order_by(Activity.supprime_le.desc())
        .all()
    )

    now = datetime.now(timezone.utc)
    items = []
    for act in trash_activities:
        # Calcul des jours restants avant purge définitive
        supprime_at = act.supprime_le
        if supprime_at.tzinfo is None:
            supprime_at = supprime_at.replace(tzinfo=timezone.utc)
        jours_ecoules = (now - supprime_at).days
        jours_restants = max(0, 30 - jours_ecoules)

        items.append(TrashItem(
            id=act.id,
            trip_id=act.trip_id,
            titre=act.titre,
            destination_nom=act.destination.nom if act.destination else None,
            categorie_nom=act.category.nom if act.category else None,
            source=act.source or "manuel",
            statut_validation=act.statut_validation or "validee",
            supprime_le=act.supprime_le,
            jours_restants_grace=jours_restants
        ))

    return items


@router.post("/api/activities/{activity_id}/restore", response_model=ActivityDetail)
def restore_activity(activity_id: int, db: Session = Depends(get_db)):
    """
    Restaure une fiche depuis la corbeille (remet supprime_le à None).
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    act.supprime_le = None
    db.commit()
    db.refresh(act)

    trip = db.query(Trip).filter(Trip.id == act.trip_id).first()
    nb_pers = trip.nb_personnes if trip else 1
    return _format_activity_detail(act, nb_pers)


@router.delete("/api/activities/{activity_id}/purge", status_code=status.HTTP_204_NO_CONTENT)
def purge_activity(activity_id: int, db: Session = Depends(get_db)):
    """
    Suppression définitive de la fiche d'activité et de ses documents associés en base de données.
    """
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    # Suppression des documents attachés
    for doc in act.documents:
        db.delete(doc)

    db.delete(act)
    db.commit()
    return None

