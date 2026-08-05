"""
Routeur pour le déclenchement du scraping externe et de la capture rapide.

Conforme à PRD_ecran1_creation.md (US-2, US-3) et docs/PLAN.md (Phase 4).
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Trip, TripDestination, Activity
from app.schemas import ActivityDetail
from app.routers.activities import _format_activity_detail
from app.services.scraping.getyourguide import scrape_getyourguide

router = APIRouter(tags=["Scraping & Capture"])


class SuggestDestinationRequest(BaseModel):
    trip_id: int
    destination_id: int
    source: str = "getyourguide"
    limit: int = Field(default=50, le=50)


class SuggestDestinationResponse(BaseModel):
    status: str
    message: str
    destination_nom: str
    nombre_ajoutees: int
    nombre_doublons_ignores: int
    activities: List[ActivityDetail]


class QuickCaptureRequest(BaseModel):
    trip_id: int
    destination_id: int
    titre: str
    url_source: Optional[str] = None
    description: Optional[str] = None
    cout_par_personne: Optional[float] = 0.0
    duree_min: Optional[int] = None
    note_interet: Optional[int] = 3
    type_element: Optional[str] = "activite"


@router.post("/ai/suggest-destination", response_model=SuggestDestinationResponse)
def suggest_destination(
    payload: SuggestDestinationRequest,
    db: Session = Depends(get_db)
):
    """
    Déclenche un scraping externe (GetYourGuide en V1) pour une destination ciblée.
    Applique la déduplication stricte (exclut les activités existantes et celles en corbeille).
    Plafonné à 50 activités maximum par exécution.
    """
    # 1. Vérification du voyage et de la destination
    trip = db.query(Trip).filter(Trip.id == payload.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage introuvable")

    destination = db.query(TripDestination).filter(
        TripDestination.id == payload.destination_id,
        TripDestination.trip_id == payload.trip_id
    ).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination introuvable pour ce voyage")

    # 2. Calcul du décalage (offset) pour renouveler les résultats d'une exécution à l'autre
    count_existing = db.query(Activity).filter(
        Activity.trip_id == payload.trip_id,
        Activity.destination_id == payload.destination_id
    ).count()

    # 3. Exécution du scraping cloisonné
    scraped_items = scrape_getyourguide(
        destination_nom=destination.nom,
        trip_id=payload.trip_id,
        destination_id=payload.destination_id,
        offset=count_existing,
        limit=payload.limit
    )

    # 4. Déduplication stricte : on vérifie toutes les fiches de la destination, y compris celles en corbeille
    all_known_activities = db.query(Activity.url_source).filter(
        Activity.trip_id == payload.trip_id,
        Activity.destination_id == payload.destination_id,
        Activity.url_source.isnot(None),
        Activity.url_source != ''
    ).all()
    known_urls = {row[0].strip().lower() for row in all_known_activities if row[0]}

    new_activities = []
    ignored_duplicates = 0

    for item in scraped_items:
        url = item.get("url_source", "").strip().lower()
        if url and url in known_urls:
            ignored_duplicates += 1
            continue

        act = Activity(
            trip_id=payload.trip_id,
            destination_id=payload.destination_id,
            titre=item["titre"],
            cout_par_personne=item["cout_par_personne"],
            duree_min=item["duree_min"],
            description=item["description"],
            url_source=item["url_source"],
            source="scraping_auto",
            statut_validation="a_valider",
            note_interet=item["note_interet"],
            type_element=item["type_element"],
            statut="non_reserve"
        )
        db.add(act)
        new_activities.append(act)
        if url:
            known_urls.add(url)

    db.commit()

    for act in new_activities:
        db.refresh(act)

    activity_details = [
        _format_activity_detail(a, trip.nb_personnes or 1)
        for a in new_activities
    ]

    return SuggestDestinationResponse(
        status="success",
        message=f"{len(new_activities)} fiches importées dans la pile à valider pour {destination.nom}",
        destination_nom=destination.nom,
        nombre_ajoutees=len(new_activities),
        nombre_doublons_ignores=ignored_duplicates,
        activities=activity_details
    )


@router.post("/activities/quick-capture", response_model=ActivityDetail, status_code=status.HTTP_201_CREATED)
def quick_capture(
    payload: QuickCaptureRequest,
    db: Session = Depends(get_db)
):
    """
    Enregistre une activité capturée rapidement depuis le navigateur par Claude for Chrome.
    Attribut automatiquement source='claude_chrome' et statut_validation='a_valider'.
    """
    trip = db.query(Trip).filter(Trip.id == payload.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage introuvable")

    destination = db.query(TripDestination).filter(
        TripDestination.id == payload.destination_id,
        TripDestination.trip_id == payload.trip_id
    ).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination introuvable")

    act = Activity(
        trip_id=payload.trip_id,
        destination_id=payload.destination_id,
        titre=payload.titre.strip(),
        url_source=payload.url_source.strip() if payload.url_source else None,
        description=payload.description.strip() if payload.description else None,
        cout_par_personne=payload.cout_par_personne or 0.0,
        duree_min=payload.duree_min,
        note_interet=payload.note_interet or 3,
        type_element=payload.type_element or "activite",
        source="claude_chrome",
        statut_validation="a_valider",
        statut="non_reserve"
    )
    db.add(act)
    db.commit()
    db.refresh(act)

    return _format_activity_detail(act, trip.nb_personnes or 1)
