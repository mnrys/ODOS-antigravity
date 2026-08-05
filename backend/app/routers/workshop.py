"""
Routeur FastAPI pour l'Écran 2 : Atelier (Canvas, Piles, Corbeille).

Conforme à PRD_ecran2_atelier.md (US-1, US-2, US-8, US-9, US-10),
SCHEMA_BASE_DE_DONNEES.md (section 9) et docs/PLAN.md (Phase 5).
"""
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Trip, TripDestination, Category, Activity, ScheduledSlot, CardLayout
)
from app.schemas import (
    WorkshopResponse, WorkshopActivityNode, CardLayoutSaveRequest, CardLayoutOut,
    CategoryBase, TrashItem, TagBase, DocumentBase
)

from app.services.completeness import calculate_completeness

router = APIRouter(tags=["Workshop"])


def _calculate_default_piles(
    activities: List[Activity],
    categories: List[Category]
) -> Dict[str, Any]:
    """
    Calcule la disposition initiale automatique en piles verticales par catégorie (US-2).
    Chaque colonne de catégorie est espacée de 340px horizontalement.
    À l'intérieur d'une colonne, les cartes sont empilées verticalement avec un espacement de 160px.
    """
    disposition = {}
    cat_map = {c.id: i for i, c in enumerate(categories)}

    # Regroupement des activités par catégorie
    grouped: Dict[Optional[int], List[Activity]] = {c.id: [] for c in categories}
    grouped[None] = [] # Activités sans catégorie

    for act in activities:
        if act.categorie_id in grouped:
            grouped[act.categorie_id].append(act)
        else:
            grouped[None].append(act)

    col_index = 0
    start_x = 80
    start_y = 100
    col_width = 340
    row_height = 160

    # 1. Placement des colonnes de catégories ayant des fiches
    for cat in categories:
        acts = grouped.get(cat.id, [])
        if not acts:
            continue
        col_x = start_x + (col_index * col_width)
        for row_idx, act in enumerate(acts):
            disposition[str(act.id)] = {
                "x": col_x,
                "y": start_y + (row_idx * row_height),
                "z_index": row_idx + 1
            }
        col_index += 1

    # 2. Colonne "Sans catégorie" si nécessaire
    uncategorized = grouped.get(None, [])
    if uncategorized:
        col_x = start_x + (col_index * col_width)
        for row_idx, act in enumerate(uncategorized):
            disposition[str(act.id)] = {
                "x": col_x,
                "y": start_y + (row_idx * row_height),
                "z_index": row_idx + 1
            }
        col_index += 1

    return disposition


@router.get("/api/destinations/{destination_id}/workshop", response_model=WorkshopResponse)
def get_workshop_data(
    destination_id: int,
    db: Session = Depends(get_db)
):
    """
    Récupère l'ensemble des activités validées d'une destination pour l'Atelier.
    Charge la disposition courante (ou calcule les piles automatiques par catégorie au premier lancement).
    """
    destination = db.query(TripDestination).filter(TripDestination.id == destination_id).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination introuvable")

    trip = db.query(Trip).filter(Trip.id == destination.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage introuvable")

    # 1. Activités validées et non en corbeille
    activities = db.query(Activity).filter(
        Activity.destination_id == destination_id,
        Activity.statut_validation == "validee",
        Activity.supprime_le.is_(None)
    ).all()

    # 2. Catégories applicables (système + voyage)
    categories = db.query(Category).filter(
        (Category.trip_id == trip.id) | (Category.trip_id.is_(None))
    ).order_by(Category.ordre.asc(), Category.id.asc()).all()

    # 3. Récupération ou initialisation de la disposition (CardLayout)
    layout = db.query(CardLayout).filter(
        CardLayout.destination_id == destination_id,
        CardLayout.est_courante == 1
    ).first()

    positions = {}
    layout_name = "En cours"

    if layout and layout.disposition:
        try:
            positions = json.loads(layout.disposition)
            layout_name = layout.nom
        except Exception:
            positions = {}

    # Si aucune disposition sauvegardée, calcul automatique des piles par catégorie (US-2)
    if not positions and activities:
        positions = _calculate_default_piles(activities, categories)
        new_layout = CardLayout(
            destination_id=destination_id,
            nom="Disposition initiale",
            disposition=json.dumps(positions),
            est_courante=1,
            est_initiale=1
        )
        db.add(new_layout)
        db.commit()
        db.refresh(new_layout)
        layout_name = "Disposition initiale"

    # 4. Construction des nœuds d'activités avec calcul dérivé de l'état `is_placed` (PRD-2 US-7)
    nodes = []
    col_width = 340
    row_height = 160

    for idx, act in enumerate(activities):
        # Vérification si l'activité est déjà placée dans le planning (dérivé de ScheduledSlot)
        is_placed = db.query(ScheduledSlot).filter(ScheduledSlot.activity_id == act.id).first() is not None

        # Miniature principale
        main_photo = next((d.chemin_fichier for d in act.documents if d.est_principale == 1 and d.type_fichier == "photo"), None)
        if not main_photo:
            main_photo = next((d.chemin_fichier for d in act.documents if d.type_fichier == "photo"), None)

        has_photo = any(d.type_fichier == "photo" for d in act.documents)
        tag_count = len(act.tags)
        score = calculate_completeness(act, has_main_photo=has_photo, tag_count=tag_count)

        pos = positions.get(str(act.id))
        if pos:
            x = float(pos.get("x", 80))
            y = float(pos.get("y", 100))
            z_idx = int(pos.get("z_index", 1))
        else:
            # Position de secours si fiche ajoutée après la création de la disposition
            x = 80 + (idx % 4) * col_width
            y = 100 + (idx // 4) * row_height
            z_idx = 1

        node = WorkshopActivityNode(
            id=act.id,
            trip_id=act.trip_id,
            destination_id=act.destination_id,
            titre=act.titre,
            categorie_id=act.categorie_id,
            categorie_nom=act.category.nom if act.category else None,
            categorie_couleur=act.category.couleur if act.category else "#8E8F92",
            type_element=act.type_element or "activite",
            cout_par_personne=act.cout_par_personne or 0.0,
            cout_total=(act.cout_par_personne or 0.0) * (trip.nb_personnes or 1),
            duree_min=act.duree_min,
            note_interet=act.note_interet,
            description=act.description,
            adresse=act.adresse,
            zone_geo=act.zone_geo,
            photo_principale=main_photo,
            completude=score,
            est_placée=is_placed,
            source=act.source or "manuel",
            url_source=act.url_source,
            remarques=act.remarques,
            horaires_ouverture=act.horaires_ouverture,
            jours_fermeture=act.jours_fermeture,
            avis_utilisateurs=act.avis_utilisateurs,
            rating=act.rating,
            date_debut=act.date_debut,
            date_fin=act.date_fin,
            numero_reference=act.numero_reference,
            statut=act.statut or "non_reserve",
            tags=[TagBase.model_validate(t) for t in act.tags],
            documents=[DocumentBase.model_validate(d) for d in act.documents],
            x=x,
            y=y,
            z_index=z_idx
        )
        nodes.append(node)

    return WorkshopResponse(
        destination_id=destination.id,
        destination_nom=destination.nom,
        disposition_nom=layout_name,
        activities=nodes,
        categories=[CategoryBase.model_validate(c) for c in categories]
    )


@router.put("/api/destinations/{destination_id}/layout", response_model=CardLayoutOut)
def save_workshop_layout(
    destination_id: int,
    payload: CardLayoutSaveRequest,
    db: Session = Depends(get_db)
):
    """
    Sauvegarde ou met à jour la disposition courante des cartes sur l'Atelier (US-1, US-6).
    """
    destination = db.query(TripDestination).filter(TripDestination.id == destination_id).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination introuvable")

    # Recherche de la disposition courante
    layout = db.query(CardLayout).filter(
        CardLayout.destination_id == destination_id,
        CardLayout.est_courante == 1
    ).first()

    disp_json = json.dumps(payload.disposition)

    if layout:
        layout.disposition = disp_json
        if payload.nom:
            layout.nom = payload.nom
    else:
        layout = CardLayout(
            destination_id=destination_id,
            nom=payload.nom or "En cours",
            disposition=disp_json,
            est_courante=1,
            est_initiale=0
        )
        db.add(layout)

    db.commit()
    db.refresh(layout)

    return CardLayoutOut(
        id=layout.id,
        destination_id=layout.destination_id,
        nom=layout.nom,
        disposition=json.loads(layout.disposition or "{}"),
        est_courante=layout.est_courante,
        est_initiale=layout.est_initiale,
        created_at=layout.created_at
    )


@router.get("/api/destinations/{destination_id}/layouts", response_model=List[CardLayoutOut])
def get_workshop_layouts(
    destination_id: int,
    db: Session = Depends(get_db)
):
    """
    Récupère la liste de toutes les dispositions enregistrées pour cette destination.
    """
    layouts = db.query(CardLayout).filter(
        CardLayout.destination_id == destination_id
    ).order_by(CardLayout.created_at.desc()).all()

    result = []
    for lay in layouts:
        result.append(CardLayoutOut(
            id=lay.id,
            destination_id=lay.destination_id,
            nom=lay.nom,
            disposition=json.loads(lay.disposition or "{}"),
            est_courante=lay.est_courante,
            est_initiale=lay.est_initiale,
            created_at=lay.created_at
        ))
    return result


@router.post("/api/destinations/{destination_id}/layouts", response_model=CardLayoutOut)
def create_named_workshop_layout(
    destination_id: int,
    payload: CardLayoutSaveRequest,
    db: Session = Depends(get_db)
):
    """
    Crée une nouvelle disposition nommée (ex: "Réflexion initiale", "Itinéraire test").
    Elle devient la disposition active.
    """
    destination = db.query(TripDestination).filter(TripDestination.id == destination_id).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination introuvable")

    # Désactiver les autres dispositions
    db.query(CardLayout).filter(CardLayout.destination_id == destination_id).update({"est_courante": 0})

    new_layout = CardLayout(
        destination_id=destination_id,
        nom=payload.nom or "Nouvelle disposition",
        disposition=json.dumps(payload.disposition),
        est_courante=1,
        est_initiale=0
    )
    db.add(new_layout)
    db.commit()
    db.refresh(new_layout)

    return CardLayoutOut(
        id=new_layout.id,
        destination_id=new_layout.destination_id,
        nom=new_layout.nom,
        disposition=json.loads(new_layout.disposition or "{}"),
        est_courante=new_layout.est_courante,
        est_initiale=new_layout.est_initiale,
        created_at=new_layout.created_at
    )


@router.post("/api/destinations/{destination_id}/layouts/{layout_id}/activate", response_model=CardLayoutOut)
def activate_workshop_layout(
    destination_id: int,
    layout_id: int,
    db: Session = Depends(get_db)
):
    """
    Active une disposition nommée existante pour la destination.
    """
    layout = db.query(CardLayout).filter(
        CardLayout.id == layout_id,
        CardLayout.destination_id == destination_id
    ).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Disposition introuvable")

    db.query(CardLayout).filter(CardLayout.destination_id == destination_id).update({"est_courante": 0})
    layout.est_courante = 1
    db.commit()
    db.refresh(layout)

    return CardLayoutOut(
        id=layout.id,
        destination_id=layout.destination_id,
        nom=layout.nom,
        disposition=json.loads(layout.disposition or "{}"),
        est_courante=layout.est_courante,
        est_initiale=layout.est_initiale,
        created_at=layout.created_at
    )


@router.delete("/api/destinations/{destination_id}/layouts/{layout_id}")
def delete_workshop_layout(
    destination_id: int,
    layout_id: int,
    db: Session = Depends(get_db)
):
    """
    Supprime une disposition enregistrée.
    """
    layout = db.query(CardLayout).filter(
        CardLayout.id == layout_id,
        CardLayout.destination_id == destination_id
    ).first()
    if not layout:
        raise HTTPException(status_code=404, detail="Disposition introuvable")

    if layout.est_initiale == 1:
        raise HTTPException(status_code=400, detail="Impossible de supprimer la disposition initiale du système")

    was_active = layout.est_courante == 1
    db.delete(layout)
    db.commit()

    # Si c'était la disposition courante, réactiver la plus récente ou initiale
    if was_active:
        remaining = db.query(CardLayout).filter(
            CardLayout.destination_id == destination_id
        ).order_by(CardLayout.created_at.desc()).first()
        if remaining:
            remaining.est_courante = 1
            db.commit()

    return {"status": "success", "message": "Disposition supprimée avec succès"}


@router.post("/api/activities/{activity_id}/workshop-trash")
def move_to_workshop_trash(
    activity_id: int,
    db: Session = Depends(get_db)
):
    """
    Place une activité validée dans la corbeille propre à l'Atelier (US-8).
    La fiche est retirée du canvas mais récupérable pendant la période de grâce.
    """
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activité introuvable")

    activity.supprime_le = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "message": f"Activité '{activity.titre}' déplacée vers la corbeille de l'Atelier"}


@router.get("/api/destinations/{destination_id}/workshop-trash", response_model=List[TrashItem])
def get_workshop_trash(
    destination_id: int,
    db: Session = Depends(get_db)
):
    """
    Liste les activités validées en corbeille pour une destination spécifique (US-8).
    """
    items = db.query(Activity).filter(
        Activity.destination_id == destination_id,
        Activity.statut_validation == "validee",
        Activity.supprime_le.isnot(None)
    ).order_by(Activity.supprime_le.desc()).all()

    now = datetime.now(timezone.utc)
    result = []
    for item in items:
        suppr_date = item.supprime_le
        if suppr_date.tzinfo is None:
            suppr_date = suppr_date.replace(tzinfo=timezone.utc)
        days_passed = (now - suppr_date).days
        remaining = max(0, 30 - days_passed)

        result.append(TrashItem(
            id=item.id,
            trip_id=item.trip_id,
            titre=item.titre,
            destination_nom=item.destination.nom if item.destination else None,
            categorie_nom=item.category.nom if item.category else None,
            source=item.source or "manuel",
            statut_validation=item.statut_validation,
            supprime_le=item.supprime_le,
            jours_restants_grace=remaining
        ))

    return result


@router.post("/api/activities/{activity_id}/workshop-restore")
def restore_from_workshop_trash(
    activity_id: int,
    db: Session = Depends(get_db)
):
    """
    Restaure une activité depuis la corbeille de l'Atelier vers le canvas (US-8).
    """
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activité introuvable")

    activity.supprime_le = None
    db.commit()

    return {"status": "success", "message": f"Activité '{activity.titre}' restaurée sur le canvas"}
