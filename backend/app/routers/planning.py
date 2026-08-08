"""
Routeur FastAPI pour l'Écran 3 : Planning plein écran et pont Atelier ↔ Planning.

Reçoit les requêtes HTTP, valide les entrées et délègue l'ensemble des règles métier
au service `app.services.planning` conformément à la Règle 7.2 de GEMINI.md.

Note de compatibilité sur les routes :
Chaque route est déclarée sous forme double (`/api/trips/...` et `/trips/...`) pour assurer
une compatibilité fluide avec les différents clients (anciens modules et nouveaux composants).

Conforme à :
- PRD_ecran3_planning.md (US-3, US-5, US-10, US-11, US-12, US-16, US-17, US-18, US-19, US-20, US-21, US-22)
- SCHEMA_BASE_DE_DONNEES.md (sections 7 et 10)
- GEMINI.md (Règles d'or 5.1, 5.2, 5.5, 7.2, 7.6)
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.services.planning import (
    minutes_to_time_str,
    get_trip_planning_data,
    create_planning_slot,
    update_planning_slot,
    toggle_planning_slot_lock,
    delete_planning_slot,
    duplicate_planning_slot,
    create_special_block_service,
    update_special_block_service,
    delete_special_block_service,
)

router = APIRouter(tags=["Planning"])


# -----------------------------------------------------------------------------
# Schémas Pydantic d'entrée
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


class SlotDuplicate(BaseModel):
    jour: Optional[int] = Field(None, ge=1, description="Numéro du jour cible (1-indexé)")
    heure_debut: Optional[int] = Field(None, ge=0, le=1440, description="Heure de début cible en minutes")
    heure_fin: Optional[int] = Field(None, ge=0, le=1440, description="Heure de fin cible en minutes")


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
# Endpoints Planning
# -----------------------------------------------------------------------------

@router.get("/api/trips/{trip_id}/planning")
@router.get("/trips/{trip_id}/planning")
def get_trip_planning(trip_id: int, db: Session = Depends(get_db)):
    """
    Retourne l'ensemble des données nécessaires à l'affichage du Planning :
    délègue le calcul et le formatage au service `get_trip_planning_data`.
    """
    try:
        return get_trip_planning_data(db, trip_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/api/trips/{trip_id}/slots", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/slots", status_code=status.HTTP_201_CREATED)
def create_slot(trip_id: int, payload: SlotCreate, db: Session = Depends(get_db)):
    """
    Crée un créneau planifié sur le Planning.
    Règles d'or appliquées :
    - 5.5 : Le backend valide toujours au quart d'heure (% 15 == 0).
    - PRD_ecran3 : Refus automatique en cas de chevauchement (409 Conflict).
    """
    try:
        new_slot = create_planning_slot(
            db=db,
            trip_id=trip_id,
            jour=payload.jour,
            heure_debut=payload.heure_debut,
            heure_fin=payload.heure_fin,
            activity_id=payload.activity_id,
            special_block_id=payload.special_block_id,
            slot_type=payload.type or 'activite',
            verrouille=payload.verrouille or 0,
            couleur_override=payload.couleur_override
        )
        return {
            "message": "Créneau créé avec succès",
            "slot_id": new_slot.id,
            "jour": new_slot.jour,
            "heure_debut": new_slot.heure_debut,
            "heure_fin": new_slot.heure_fin
        }
    except ValueError as e:
        err_msg = str(e)
        if err_msg.startswith("CONFLICT:"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg.replace("CONFLICT: ", ""))
        if "introuvable" in err_msg or "non trouvé" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)


@router.put("/api/slots/{slot_id}")
@router.put("/slots/{slot_id}")
@router.put("/api/slots/{slot_id}/move")
@router.put("/slots/{slot_id}/move")
def update_slot(slot_id: int, payload: SlotUpdate, db: Session = Depends(get_db)):
    """
    Met à jour un créneau (déplacement, redimensionnement, verrouillage).
    Gère la protection des créneaux verrouillés (US-11).
    """
    try:
        slot = update_planning_slot(
            db=db,
            slot_id=slot_id,
            jour=payload.jour,
            heure_debut=payload.heure_debut,
            heure_fin=payload.heure_fin,
            slot_type=payload.type,
            verrouille=payload.verrouille,
            couleur_override=payload.couleur_override
        )
        return {"message": "Créneau mis à jour", "slot_id": slot.id}
    except ValueError as e:
        err_msg = str(e)
        if err_msg.startswith("CONFLICT:"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg.replace("CONFLICT: ", ""))
        if err_msg.startswith("LOCKED:"):
            raise HTTPException(status_code=400, detail=err_msg.replace("LOCKED: ", ""))
        if "non trouvé" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)


@router.post("/api/slots/{slot_id}/toggle-lock")
@router.post("/slots/{slot_id}/toggle-lock")
def toggle_slot_lock(slot_id: int, db: Session = Depends(get_db)):
    """Bascule rapide du verrouillage d'un créneau (US-11)."""
    try:
        slot = toggle_planning_slot_lock(db, slot_id)
        return {"message": "État de verrouillage modifié", "slot_id": slot.id, "verrouille": slot.verrouille}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/api/slots/{slot_id}")
@router.delete("/slots/{slot_id}")
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    """Retire un créneau du planning (remet l'activité en statut disponible)."""
    try:
        activity_id, special_block_id = delete_planning_slot(db, slot_id)
        return {
            "message": "Créneau retiré du planning",
            "activity_id": activity_id,
            "special_block_id": special_block_id
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/api/trips/{trip_id}/slots/{slot_id}/duplicate", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/slots/{slot_id}/duplicate", status_code=status.HTTP_201_CREATED)
@router.post("/api/slots/{slot_id}/duplicate", status_code=status.HTTP_201_CREATED)
@router.post("/slots/{slot_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_slot(
    slot_id: int,
    payload: Optional[SlotDuplicate] = None,
    trip_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Duplique un créneau existant (activité ou bloc libre) sur un nouveau jour/horaire (US-21, US-22).
    """
    try:
        new_slot = duplicate_planning_slot(
            db=db,
            slot_id=slot_id,
            target_jour=payload.jour if payload else None,
            target_start=payload.heure_debut if payload else None,
            target_end=payload.heure_fin if payload else None,
            trip_id=trip_id
        )
        return {
            "message": "Créneau dupliqué avec succès",
            "slot_id": new_slot.id,
            "activity_id": new_slot.activity_id,
            "special_block_id": new_slot.special_block_id,
            "jour": new_slot.jour,
            "heure_debut": new_slot.heure_debut,
            "heure_fin": new_slot.heure_fin
        }
    except ValueError as e:
        err_msg = str(e)
        if err_msg.startswith("CONFLICT:"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg.replace("CONFLICT: ", ""))
        if "non trouvé" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)


# -----------------------------------------------------------------------------
# Endpoints Blocs Spéciaux / Libres (US-16, US-17, US-18)
# -----------------------------------------------------------------------------

@router.post("/api/trips/{trip_id}/special_blocks", status_code=status.HTTP_201_CREATED)
@router.post("/api/trips/{trip_id}/special-blocks", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/special_blocks", status_code=status.HTTP_201_CREATED)
@router.post("/trips/{trip_id}/special-blocks", status_code=status.HTTP_201_CREATED)
def create_special_block(trip_id: int, payload: SpecialBlockCreate, db: Session = Depends(get_db)):
    """Crée un bloc libre/spécial avec impact budgétaire."""
    try:
        new_block, new_slot = create_special_block_service(
            db=db,
            trip_id=trip_id,
            label=payload.label,
            block_type=payload.type,
            categorie_id=payload.categorie_id,
            duree_minutes=payload.duree_minutes or 60,
            cout=payload.cout or 0.0,
            icone=payload.icone,
            couleur=payload.couleur,
            jour=payload.jour,
            heure_debut=payload.heure_debut
        )
        return {
            "message": "Bloc spécial créé avec succès",
            "special_block_id": new_block.id,
            "slot_id": new_slot.id if new_slot else None,
            "label": new_block.label,
            "cout": new_block.cout
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/api/special_blocks/{block_id}")
@router.put("/api/special-blocks/{block_id}")
@router.put("/special_blocks/{block_id}")
@router.put("/special-blocks/{block_id}")
def update_special_block(block_id: int, payload: SpecialBlockUpdate, db: Session = Depends(get_db)):
    """Met à jour un bloc spécial."""
    try:
        block = update_special_block_service(
            db=db,
            block_id=block_id,
            label=payload.label,
            block_type=payload.type,
            categorie_id=payload.categorie_id,
            duree_minutes=payload.duree_minutes,
            cout=payload.cout,
            icone=payload.icone,
            couleur=payload.couleur,
            jour=payload.jour,
            heure_debut=payload.heure_debut
        )
        return {"message": "Bloc spécial mis à jour", "block_id": block.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/api/special_blocks/{block_id}")
@router.delete("/api/special-blocks/{block_id}")
@router.delete("/special_blocks/{block_id}")
@router.delete("/special-blocks/{block_id}")
def delete_special_block(block_id: int, db: Session = Depends(get_db)):
    """Supprime un bloc spécial et les créneaux associés."""
    try:
        delete_special_block_service(db, block_id)
        return {"message": "Bloc spécial supprimé", "block_id": block_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
