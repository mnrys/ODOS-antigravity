"""
Routeur FastAPI pour la gestion des tags (classification transversale many-to-many).
cf. SCHEMA_BASE_DE_DONNEES.md, section 5.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Trip, Tag
from app.schemas import TagBase, TagCreate

router = APIRouter(prefix="/api/trips/{trip_id}/tags", tags=["Tags"])


@router.get("", response_model=List[TagBase])
def get_trip_tags(trip_id: int, db: Session = Depends(get_db)):
    """
    Récupère la liste de tous les tags associés à un voyage donné
    (pour alimenter les suggestions d'autocomplétion).
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Voyage {trip_id} introuvable"
        )
    return db.query(Tag).filter(Tag.trip_id == trip_id).order_by(Tag.nom).all()


@router.post("", response_model=TagBase, status_code=status.HTTP_201_CREATED)
def create_trip_tag(trip_id: int, tag_in: TagCreate, db: Session = Depends(get_db)):
    """
    Crée un nouveau tag pour un voyage s'il n'existe pas déjà.
    """
    nom_nettoye = tag_in.nom.strip()
    if not nom_nettoye:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nom du tag ne peut pas être vide"
        )

    # Vérification d'unicité par voyage
    tag_existant = (
        db.query(Tag)
        .filter(Tag.trip_id == trip_id, Tag.nom.ilike(nom_nettoye))
        .first()
    )
    if tag_existant:
        return tag_existant

    nouveau_tag = Tag(trip_id=trip_id, nom=nom_nettoye)
    db.add(nouveau_tag)
    db.commit()
    db.refresh(nouveau_tag)
    return nouveau_tag
