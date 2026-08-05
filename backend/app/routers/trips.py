"""
Routeur FastAPI pour les voyages et le Dashboard.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Trip, TripDestination, Category
from app.schemas import DashboardResponse, TripUpdate, TripOut
from app.services.dashboard import compute_dashboard_data

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("", response_model=List[dict])
def list_trips(db: Session = Depends(get_db)):
    """
    Retourne la liste des voyages enregistrés.
    """
    trips = db.query(Trip).all()
    return [
        {
            "id": t.id,
            "nom": t.nom,
            "date_debut": t.date_debut,
            "nb_jours": t.nb_jours,
            "nb_personnes": t.nb_personnes,
            "budget_total": t.budget_total
        }
        for t in trips
    ]


@router.patch("/{trip_id}", response_model=TripOut)
def update_trip(trip_id: int, payload: TripUpdate, db: Session = Depends(get_db)):
    """
    Met à jour les paramètres d'un voyage (ex: budget_total, nb_personnes).
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Voyage {trip_id} introuvable")

    if payload.nom is not None:
        trip.nom = payload.nom
    if payload.date_debut is not None:
        trip.date_debut = payload.date_debut
    if payload.nb_jours is not None:
        trip.nb_jours = payload.nb_jours
    if payload.nb_personnes is not None:
        trip.nb_personnes = payload.nb_personnes
    if payload.budget_total is not None:
        trip.budget_total = payload.budget_total

    db.commit()
    db.refresh(trip)
    return trip


@router.get("/{trip_id}/dashboard", response_model=DashboardResponse)
def get_trip_dashboard(trip_id: int, db: Session = Depends(get_db)):
    """
    Retourne les données consolidées pour le Dashboard d'un voyage (Écran 0).
    """
    try:
        return compute_dashboard_data(db, trip_id)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err))
