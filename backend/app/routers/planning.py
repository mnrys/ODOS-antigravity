"""
Routeur FastAPI pour l'Écran 3 : Planning plein écran et pont Atelier ↔ Planning.
Gère les créneaux planifiés (ScheduledSlot), les blocs spéciaux (SpecialBlock),
la détection stricte de conflits et le calcul des budgets journaliers/globaux.

Conforme à :
- PRD_ecran3_planning.md (US-3, US-5, US-10, US-11, US-12, US-16, US-17, US-18, US-19, US-20)
- SCHEMA_BASE_DE_DONNEES.md (sections 7 et 10)
- GEMINI.md (Règles d'or 5.1, 5.2, 5.5, 7.2, 7.6)
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import Trip, TripDestination, Activity, Category, ScheduledSlot, SpecialBlock

router = APIRouter(tags=["Planning"])


# -----------------------------------------------------------------------------
# Schémas Pydantic
# -----------------------------------------------------------------------------

class SlotCreate(BaseModel):
    activity_id: Optional[int] = None
    special_block_id: Optional[int] = None
    jour: int = Field(..., ge=1, description="Numéro du jour du voyage (1-indexé)")
    heure_debut: int = Field(..., ge=0, le=1440, description="Heure de début en minutes depuis minuit (ex: 540 pour 09:00)")
    heure_fin: int = Field(..., ge=0, le=1440, description="Heure de fin en minutes depuis minuit (ex: 660 pour 11:00)")
    type: Optional[str] = 'activite'
    verrouille: Optional[int] = 0
    couleur_override: Optional[str] = None


class SlotUpdate(BaseModel):
    jour: Optional[int] = Field(None, ge=1)
    heure_debut: Optional[int] = Field(None, ge=0, le=1440)
    heure_fin: Optional[int] = Field(None, ge=0, le=1440)
    type: Optional[str] = None
    verrouille: Optional[int] = None
    couleur_override: Optional[str] = None


class SpecialBlockCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., description="'repas'|'trajet'|'pause'|'personnalise'")
    categorie_id: Optional[int] = None
    duree_minutes: Optional[int] = Field(60, ge=15, le=720)
    cout: Optional[float] = Field(0.0, ge=0.0)
    icone: Optional[str] = None
    couleur: Optional[str] = None
    # Optionnel : planification directe
    jour: Optional[int] = None
    heure_debut: Optional[int] = None


class SpecialBlockUpdate(BaseModel):
    label: Optional[str] = None
    type: Optional[str] = None
    categorie_id: Optional[int] = None
    duree_minutes: Optional[int] = None
    cout: Optional[float] = None
    icone: Optional[str] = None
    couleur: Optional[str] = None
    jour: Optional[int] = None
    heure_debut: Optional[int] = None


# -----------------------------------------------------------------------------
# Fonctions Utilitaires
# -----------------------------------------------------------------------------

def minutes_to_time_str(minutes: int) -> str:
    """Convertit des minutes depuis minuit en chaîne 'HH:MM' (ex: 555 -> '09:15')."""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def check_slot_overlap(
    db: Session,
    trip_id: int,
    jour: int,
    heure_debut: int,
    heure_fin: int,
    exclude_slot_id: Optional[int] = None
) -> Optional[ScheduledSlot]:
    """
    Vérifie si un créneau chevauche un créneau existant sur le même jour.
    Deux créneaux [A, B] et [C, D] se chevauchent si :
    max(A, C) < min(B, D) <=> (A < D et C < B)
    cf. PRD_ecran3_planning.md, section "Règle de conflit"
    """
    query = db.query(ScheduledSlot).filter(
        ScheduledSlot.trip_id == trip_id,
        ScheduledSlot.jour == jour,
        ScheduledSlot.heure_debut < heure_fin,
        ScheduledSlot.heure_fin > heure_debut
    )
    if exclude_slot_id:
        query = query.filter(ScheduledSlot.id != exclude_slot_id)

    return query.first()


# -----------------------------------------------------------------------------
# Endpoints Planning
# -----------------------------------------------------------------------------

@router.get("/api/trips/{trip_id}/planning")
@router.get("/trips/{trip_id}/planning")
def get_trip_planning(trip_id: int, db: Session = Depends(get_db)):
    """
    Retourne l'ensemble des données nécessaires à l'affichage de l'Écran 3 Planning :
    - Détails du voyage (jours, dates, personnes, budget cible, horaires de grille)
    - Destinations du voyage
    - Catégories disponibles
    - Créneaux planifiés ordonnés par jour et heure
    - Blocs spéciaux
    - Activités validées non encore placées
    - Calcul des totaux budgétaires journaliers et par catégorie
    cf. PRD_ecran3_planning.md, US-12, US-16
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage non trouvé")

    # 1. Destinations
    destinations = db.query(TripDestination).filter(
        TripDestination.trip_id == trip_id
    ).order_by(TripDestination.ordre).all()

    # 2. Catégories (système et custom du voyage)
    categories = db.query(Category).filter(
        (Category.trip_id == trip_id) | (Category.trip_id == None)
    ).order_by(Category.ordre).all()

    # 3. Créneaux planifiés avec relations
    slots = db.query(ScheduledSlot).options(
        joinedload(ScheduledSlot.activity).joinedload(Activity.category),
        joinedload(ScheduledSlot.activity).joinedload(Activity.documents),
        joinedload(ScheduledSlot.special_block).joinedload(SpecialBlock.category)
    ).filter(
        ScheduledSlot.trip_id == trip_id
    ).order_by(ScheduledSlot.jour, ScheduledSlot.heure_debut).all()

    # 4. Blocs spéciaux
    special_blocks = db.query(SpecialBlock).options(
        joinedload(SpecialBlock.category)
    ).filter(SpecialBlock.trip_id == trip_id).all()

    # 5. Activités validées non supprimées
    all_activities = db.query(Activity).options(
        joinedload(Activity.category),
        joinedload(Activity.documents)
    ).filter(
        Activity.trip_id == trip_id,
        Activity.statut_validation == 'validee',
        Activity.supprime_le == None
    ).all()

    # Identifiants des activités déjà placées dans le planning
    placed_activity_ids = {s.activity_id for s in slots if s.activity_id is not None}

    unplaced_activities = [
        act for act in all_activities if act.id not in placed_activity_ids
    ]

    # 6. Calculs des budgets
    # Somme des activités (cout_par_personne * nb_personnes) + somme des special_blocks
    total_engage = 0.0
    daily_budgets: Dict[int, float] = {j: 0.0 for j in range(1, trip.nb_jours + 1)}
    category_budgets: Dict[str, float] = {}

    formatted_slots = []
    for slot in slots:
        slot_cost = 0.0
        cat_id = None
        cat_nom = "Non catégorisé"
        cat_couleur = "#8E8F92"
        slot_title = ""
        photo_url = None
        adresse = None
        rating = None
        type_elem = slot.type

        if slot.activity:
            slot_cost = (slot.activity.cout_par_personne or 0.0) * trip.nb_personnes
            slot_title = slot.activity.titre
            type_elem = slot.activity.type_element or 'activite'
            adresse = slot.activity.adresse
            rating = slot.activity.rating
            if slot.activity.category:
                cat_id = slot.activity.category.id
                cat_nom = slot.activity.category.nom
                cat_couleur = slot.activity.category.couleur
            # Récupération de la photo principale
            if slot.activity.documents:
                main_doc = next((d for d in slot.activity.documents if d.est_principale == 1), slot.activity.documents[0])
                if main_doc and main_doc.chemin_fichier:
                    photo_url = main_doc.chemin_fichier if main_doc.chemin_fichier.startswith('http') else (main_doc.chemin_fichier if main_doc.chemin_fichier.startswith('/') else f"/{main_doc.chemin_fichier}")
        elif slot.special_block:
            slot_cost = slot.special_block.cout or 0.0
            slot_title = slot.special_block.label
            type_elem = slot.special_block.type
            if slot.special_block.couleur:
                cat_couleur = slot.special_block.couleur
            if slot.special_block.category:
                cat_id = slot.special_block.category.id
                cat_nom = slot.special_block.category.nom
                if not slot.special_block.couleur:
                    cat_couleur = slot.special_block.category.couleur

        # Cumul budget global et journalier
        total_engage += slot_cost
        if slot.jour in daily_budgets:
            daily_budgets[slot.jour] += slot_cost

        # Cumul par catégorie
        if cat_nom not in category_budgets:
            category_budgets[cat_nom] = 0.0
            category_budgets[cat_nom] += slot_cost

        formatted_slots.append({
            "id": slot.id,
            "trip_id": slot.trip_id,
            "activity_id": slot.activity_id,
            "special_block_id": slot.special_block_id,
            "jour": slot.jour,
            "heure_debut": slot.heure_debut,
            "heure_fin": slot.heure_fin,
            "heure_debut_str": minutes_to_time_str(slot.heure_debut),
            "heure_fin_str": minutes_to_time_str(slot.heure_fin),
            "duree_minutes": slot.heure_fin - slot.heure_debut,
            "type": type_elem,
            "verrouille": slot.verrouille or 0,
            "couleur_override": slot.couleur_override,
            "titre": slot_title,
            "cout_total": round(slot_cost, 2),
            "categorie_id": cat_id,
            "categorie_nom": cat_nom,
            "categorie_couleur": slot.couleur_override or cat_couleur,
            "photo_url": photo_url,
            "adresse": adresse,
            "rating": rating,
            "activity_details": {
                "id": slot.activity.id,
                "titre": slot.activity.titre,
                "cout_par_personne": slot.activity.cout_par_personne,
                "description": slot.activity.description,
                "remarques": slot.activity.remarques,
                "note_interet": slot.activity.note_interet,
                "duree_min": slot.activity.duree_min,
                "url_source": slot.activity.url_source,
                "horaires_ouverture": slot.activity.horaires_ouverture,
                "jours_fermeture": slot.activity.jours_fermeture,
                "date_debut": slot.activity.date_debut.isoformat() if slot.activity.date_debut else None,
                "date_fin": slot.activity.date_fin.isoformat() if slot.activity.date_fin else None,
                "numero_reference": slot.activity.numero_reference,
                "statut": slot.activity.statut,
                "photo_principale": photo_url
            } if slot.activity else None
        })

    # Activités non placées formatées
    formatted_unplaced = []
    for act in unplaced_activities:
        act_photo_url = None
        if act.documents:
            main_doc = next((d for d in act.documents if d.est_principale == 1), act.documents[0])
            if main_doc and main_doc.chemin_fichier:
                act_photo_url = main_doc.chemin_fichier if main_doc.chemin_fichier.startswith('http') else (main_doc.chemin_fichier if main_doc.chemin_fichier.startswith('/') else f"/{main_doc.chemin_fichier}")

        formatted_unplaced.append({
            "id": act.id,
            "destination_id": act.destination_id,
            "titre": act.titre,
            "type_element": act.type_element,
            "cout_par_personne": act.cout_par_personne or 0.0,
            "cout_total": round((act.cout_par_personne or 0.0) * trip.nb_personnes, 2),
            "duree_min": act.duree_min or 60,
            "zone_geo": act.zone_geo,
            "note_interet": act.note_interet or 0,
            "categorie_id": act.categorie_id,
            "categorie_nom": act.category.nom if act.category else "Non catégorisé",
            "categorie_couleur": act.category.couleur if act.category else "#8E8F92",
            "photo_url": act_photo_url,
            "adresse": act.adresse
        })

    return {
        "trip": {
            "id": trip.id,
            "nom": trip.nom,
            "date_debut": trip.date_debut.isoformat() if trip.date_debut else None,
            "nb_jours": trip.nb_jours,
            "nb_personnes": trip.nb_personnes,
            "budget_total": trip.budget_total or 0.0,
            "budget_engage": round(total_engage, 2),
            "planning_heure_debut": trip.planning_heure_debut or 420,  # 07:00
            "planning_heure_fin": trip.planning_heure_fin or 1380     # 23:00
        },
        "destinations": [
            {"id": d.id, "nom": d.nom, "ordre": d.ordre} for d in destinations
        ],
        "categories": [
            {"id": c.id, "nom": c.nom, "couleur": c.couleur, "icone": c.icone} for c in categories
        ],
        "slots": formatted_slots,
        "unplaced_activities": formatted_unplaced,
        "placed_activity_ids": list(placed_activity_ids),
        "daily_budgets": {k: round(v, 2) for k, v in daily_budgets.items()},
        "category_budgets": {k: round(v, 2) for k, v in category_budgets.items()}
    }


@router.post("/api/trips/{trip_id}/slots", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/slots", status_code=status.HTTP_201_CREATED)
def create_slot(trip_id: int, payload: SlotCreate, db: Session = Depends(get_db)):
    """
    Crée un créneau planifié sur le Planning.
    Règles d'or appliquées :
    - 5.5 : Le backend valide toujours au quart d'heure (% 15 == 0).
    - PRD_ecran3 : Refus automatique en cas de chevauchement (409 Conflict).
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage non trouvé")

    # 1. Validation de l'alignement sur 15 minutes (Règle 5.5)
    if payload.heure_debut % 15 != 0:
        raise HTTPException(
            status_code=400,
            detail=f"L'heure de début ({minutes_to_time_str(payload.heure_debut)}) doit être un multiple de 15 minutes."
        )
    if payload.heure_fin % 15 != 0:
        raise HTTPException(
            status_code=400,
            detail=f"L'heure de fin ({minutes_to_time_str(payload.heure_fin)}) doit être un multiple de 15 minutes."
        )
    if payload.heure_fin <= payload.heure_debut:
        raise HTTPException(
            status_code=400,
            detail="L'heure de fin doit être strictement supérieure à l'heure de début."
        )

    # 2. Validation du numéro de jour
    if payload.jour < 1 or payload.jour > trip.nb_jours:
        raise HTTPException(
            status_code=400,
            detail=f"Le jour {payload.jour} est invalide pour ce voyage ({trip.nb_jours} jours prévus)."
        )

    # 3. Vérification de conflit / chevauchement (US-10)
    conflict = check_slot_overlap(
        db=db,
        trip_id=trip_id,
        jour=payload.jour,
        heure_debut=payload.heure_debut,
        heure_fin=payload.heure_fin
    )
    if conflict:
        title = conflict.activity.titre if conflict.activity else (conflict.special_block.label if conflict.special_block else "une activité")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Créneau occupé par « {title} » de {minutes_to_time_str(conflict.heure_debut)} à {minutes_to_time_str(conflict.heure_fin)}."
        )

    # 4. Création du créneau
    new_slot = ScheduledSlot(
        trip_id=trip_id,
        activity_id=payload.activity_id,
        special_block_id=payload.special_block_id,
        jour=payload.jour,
        heure_debut=payload.heure_debut,
        heure_fin=payload.heure_fin,
        type=payload.type or 'activite',
        verrouille=payload.verrouille or 0,
        couleur_override=payload.couleur_override
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)

    return {
        "message": "Créneau créé avec succès",
        "slot_id": new_slot.id,
        "jour": new_slot.jour,
        "heure_debut": new_slot.heure_debut,
        "heure_fin": new_slot.heure_fin
    }


@router.put("/api/slots/{slot_id}")
@router.put("/slots/{slot_id}")
@router.put("/api/slots/{slot_id}/move")
@router.put("/slots/{slot_id}/move")
def update_slot(slot_id: int, payload: SlotUpdate, db: Session = Depends(get_db)):
    """
    Met à jour un créneau (déplacement, redimensionnement, verrouillage).
    Gère la protection des créneaux verrouillés (US-11).
    """
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")

    new_jour = payload.jour if payload.jour is not None else slot.jour
    new_debut = payload.heure_debut if payload.heure_debut is not None else slot.heure_debut
    new_fin = payload.heure_fin if payload.heure_fin is not None else slot.heure_fin
    new_verrouille = payload.verrouille if payload.verrouille is not None else slot.verrouille

    is_moving = (new_jour != slot.jour or new_debut != slot.heure_debut or new_fin != slot.heure_fin)

    # Protection créneau verrouillé (US-11)
    if (slot.verrouille or 0) > 0 and is_moving and new_verrouille != 0:
        raise HTTPException(
            status_code=400,
            detail="Ce créneau est verrouillé. Veuillez le déverrouiller explicitement avant de le déplacer."
        )

    # Validation du quart d'heure
    if new_debut % 15 != 0 or new_fin % 15 != 0:
        raise HTTPException(status_code=400, detail="Les horaires doivent être des multiples de 15 minutes.")
    if new_fin <= new_debut:
        raise HTTPException(status_code=400, detail="L'heure de fin doit être supérieure à l'heure de début.")

    # Vérification de conflit
    if is_moving:
        conflict = check_slot_overlap(
            db=db,
            trip_id=slot.trip_id,
            jour=new_jour,
            heure_debut=new_debut,
            heure_fin=new_fin,
            exclude_slot_id=slot.id
        )
        if conflict:
            title = conflict.activity.titre if conflict.activity else (conflict.special_block.label if conflict.special_block else "une activité")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Créneau occupé par « {title} » de {minutes_to_time_str(conflict.heure_debut)} à {minutes_to_time_str(conflict.heure_fin)}."
            )

    slot.jour = new_jour
    slot.heure_debut = new_debut
    slot.heure_fin = new_fin
    slot.verrouille = new_verrouille
    if payload.type is not None:
        slot.type = payload.type
    if payload.couleur_override is not None:
        slot.couleur_override = payload.couleur_override

    db.commit()
    return {"message": "Créneau mis à jour", "slot_id": slot.id}


@router.post("/api/slots/{slot_id}/toggle-lock")
@router.post("/slots/{slot_id}/toggle-lock")
def toggle_slot_lock(slot_id: int, db: Session = Depends(get_db)):
    """Bascule rapide du verrouillage d'un créneau (US-11)."""
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")

    slot.verrouille = 0 if (slot.verrouille or 0) > 0 else 1
    db.commit()
    return {"message": "État de verrouillage modifié", "slot_id": slot.id, "verrouille": slot.verrouille}


@router.delete("/api/slots/{slot_id}")
@router.delete("/slots/{slot_id}")
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    """Retire un créneau du planning (remet l'activité en statut disponible)."""
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Créneau non trouvé")

    activity_id = slot.activity_id
    special_block_id = slot.special_block_id

    db.delete(slot)
    db.commit()
    return {
        "message": "Créneau retiré du planning",
        "activity_id": activity_id,
        "special_block_id": special_block_id
    }


# -----------------------------------------------------------------------------
# Endpoints Blocs Spéciaux / Libres (US-16, US-17, US-18)
# -----------------------------------------------------------------------------

@router.post("/api/trips/{trip_id}/special_blocks", status_code=status.HTTP_201_CREATED)
@router.post("/api/trips/{trip_id}/special-blocks", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/special_blocks", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/special-blocks", status_code=status.HTTP_201_CREATED)
def create_special_block(trip_id: int, payload: SpecialBlockCreate, db: Session = Depends(get_db)):
    """Crée un bloc libre/spécial (repas, trajet, pause, dépense supplémentaire) avec impact budgétaire."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage non trouvé")

    new_block = SpecialBlock(
        trip_id=trip_id,
        label=payload.label.strip(),
        type=payload.type,
        categorie_id=payload.categorie_id,
        duree_minutes=payload.duree_minutes or 60,
        cout=payload.cout or 0.0,
        icone=payload.icone,
        couleur=payload.couleur
    )
    db.add(new_block)
    db.flush()

    # Si un jour et une heure de début sont spécifiés, créer directement le créneau associé
    slot_id = None
    if payload.jour is not None and payload.heure_debut is not None:
        debut = payload.heure_debut
        fin = debut + (payload.duree_minutes or 60)
        # Validation quart d'heure
        if debut % 15 == 0 and fin % 15 == 0:
            conflict = check_slot_overlap(db, trip_id, payload.jour, debut, fin)
            if not conflict:
                new_slot = ScheduledSlot(
                    trip_id=trip_id,
                    special_block_id=new_block.id,
                    jour=payload.jour,
                    heure_debut=debut,
                    heure_fin=fin,
                    type=payload.type,
                    couleur_override=payload.couleur
                )
                db.add(new_slot)
                db.flush()
                slot_id = new_slot.id

    db.commit()
    db.refresh(new_block)

    return {
        "message": "Bloc spécial créé avec succès",
        "special_block_id": new_block.id,
        "slot_id": slot_id,
        "label": new_block.label,
        "cout": new_block.cout
    }


@router.put("/api/special_blocks/{block_id}")
@router.put("/api/special-blocks/{block_id}")
@router.put("/special_blocks/{block_id}")
@router.put("/special-blocks/{block_id}")
def update_special_block(block_id: int, payload: SpecialBlockUpdate, db: Session = Depends(get_db)):
    """Met à jour un bloc spécial."""
    block = db.query(SpecialBlock).filter(SpecialBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Bloc spécial non trouvé")

    if payload.label is not None:
        block.label = payload.label.strip()
    if payload.type is not None:
        block.type = payload.type
    if payload.categorie_id is not None:
        block.categorie_id = payload.categorie_id
    if payload.duree_minutes is not None:
        block.duree_minutes = payload.duree_minutes
    if payload.cout is not None:
        block.cout = payload.cout
    if payload.icone is not None:
        block.icone = payload.icone
    if payload.couleur is not None:
        block.couleur = payload.couleur

    # Synchronisation du créneau horaire associé si présent
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.special_block_id == block.id).first()
    if slot:
        if payload.jour is not None:
            slot.jour = payload.jour
        if payload.heure_debut is not None:
            slot.heure_debut = payload.heure_debut
            slot.heure_fin = payload.heure_debut + (payload.duree_minutes or block.duree_minutes or 60)
        elif payload.duree_minutes is not None:
            slot.heure_fin = slot.heure_debut + payload.duree_minutes
        if payload.type is not None:
            slot.type = payload.type
        if payload.couleur is not None:
            slot.couleur_override = payload.couleur

    db.commit()
    return {"message": "Bloc spécial mis à jour", "block_id": block.id}


@router.delete("/api/special_blocks/{block_id}")
@router.delete("/api/special-blocks/{block_id}")
@router.delete("/special_blocks/{block_id}")
@router.delete("/special-blocks/{block_id}")
def delete_special_block(block_id: int, db: Session = Depends(get_db)):
    """Supprime un bloc spécial et les créneaux associés."""
    block = db.query(SpecialBlock).filter(SpecialBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Bloc spécial non trouvé")

    db.delete(block)
    db.commit()
    return {"message": "Bloc spécial supprimé", "block_id": block_id}
