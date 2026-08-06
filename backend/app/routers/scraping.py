"""
Routeur pour le déclenchement du scraping externe et de la capture rapide.

Conforme à PRD_ecran1_creation.md (US-2, US-3) et docs/PLAN.md (Phase 4).
"""
from typing import Optional, List
import unicodedata
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Trip, TripDestination, Activity, Document
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
    duree_max: Optional[int] = None
    note_interet: Optional[int] = 3
    type_element: Optional[str] = "activite"
    categorie_id: Optional[int] = None
    adresse: Optional[str] = None
    zone_geo: Optional[str] = None
    horaires_ouverture: Optional[str] = None
    jours_fermeture: Optional[str] = None
    remarques: Optional[str] = None
    avis_utilisateurs: Optional[str] = None
    statut: Optional[str] = "non_reserve"
    tag_ids: Optional[List[int]] = Field(default_factory=list)


def _normalize_title(text: Optional[str]) -> str:
    """
    Normalise un titre pour comparaison insensible aux accents, majuscules et ponctuations.
    """
    if not text:
        return ""
    norm = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8').lower()
    return re.sub(r'[^a-z0-9]', '', norm)


@router.post("/ai/suggest-destination", response_model=SuggestDestinationResponse)
def suggest_destination(
    payload: SuggestDestinationRequest,
    db: Session = Depends(get_db)
):
    """
    Déclenche la suggestion automatique d'activités pour une destination via scraping.
    Plafonné à 50 résultats maximum, avec renouvellement des résultats par offset et
    déduplication stricte par URL et titre normalisé (y compris corbeille).
    """
    # 1. Vérification de l'existence du voyage et de la destination
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
    all_known_activities = db.query(Activity.url_source, Activity.titre).filter(
        Activity.trip_id == payload.trip_id,
        Activity.destination_id == payload.destination_id
    ).all()
    known_urls = {row[0].strip().lower() for row in all_known_activities if row[0]}
    known_titles = {_normalize_title(row[1]) for row in all_known_activities if row[1]}

    new_activities = []
    ignored_duplicates = 0

    for item in scraped_items:
        url = (item.get("url_source") or "").strip().lower()
        title_norm = _normalize_title(item.get("titre"))

        # Déduplication par URL source OU par titre normalisé
        if (url and url in known_urls) or (title_norm and title_norm in known_titles):
            ignored_duplicates += 1
            continue

        act = Activity(
            trip_id=payload.trip_id,
            destination_id=payload.destination_id,
            titre=item["titre"],
            cout_par_personne=item.get("cout_par_personne", 0.0),
            duree_min=item.get("duree_min"),
            adresse=item.get("adresse"),
            description=item.get("description"),
            url_source=item.get("url_source"),
            avis_utilisateurs=item.get("avis_utilisateurs"),
            source="scraping_auto",
            statut_validation="a_valider",
            note_interet=item.get("note_interet", 3),
            type_element=item.get("type_element", "activite"),
            statut="non_reserve"
        )
        db.add(act)
        db.flush()  # Pour obtenir act.id avant l'ajout des documents/photos

        # Enregistrement des photos associées
        photos = item.get("photos", [])
        for i, photo_url in enumerate(photos):
            doc = Document(
                activity_id=act.id,
                type_fichier="photo",
                chemin_fichier=photo_url,
                type_source="scraping",
                libelle=f"Photo {i+1}",
                est_principale=1 if i == 0 else 0
            )
            db.add(doc)

        new_activities.append(act)
        if url:
            known_urls.add(url)
        if title_norm:
            known_titles.add(title_norm)

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
        categorie_id=payload.categorie_id,
        titre=payload.titre.strip(),
        adresse=payload.adresse.strip() if payload.adresse else None,
        zone_geo=payload.zone_geo.strip() if payload.zone_geo else None,
        url_source=payload.url_source.strip() if payload.url_source else None,
        description=payload.description.strip() if payload.description else None,
        cout_par_personne=payload.cout_par_personne or 0.0,
        duree_min=payload.duree_min,
        duree_max=payload.duree_max,
        horaires_ouverture=payload.horaires_ouverture.strip() if payload.horaires_ouverture else None,
        jours_fermeture=payload.jours_fermeture.strip() if payload.jours_fermeture else None,
        remarques=payload.remarques.strip() if payload.remarques else None,
        avis_utilisateurs=payload.avis_utilisateurs.strip() if payload.avis_utilisateurs else None,
        note_interet=payload.note_interet or 3,
        type_element=payload.type_element or "activite",
        source="claude_chrome",
        statut_validation="a_valider",
        statut=payload.statut or "non_reserve"
    )
    if payload.tag_ids:
        from app.models import Tag
        tags_trouves = db.query(Tag).filter(
            Tag.id.in_(payload.tag_ids),
            Tag.trip_id == payload.trip_id
        ).all()
        act.tags = tags_trouves

    db.add(act)
    db.commit()
    db.refresh(act)

    return _format_activity_detail(act, trip.nb_personnes or 1)


@router.post("/activities/quick-capture/batch", response_model=List[ActivityDetail], status_code=status.HTTP_201_CREATED)
def quick_capture_batch(
    payload_list: List[QuickCaptureRequest],
    db: Session = Depends(get_db)
):
    """
    Enregistre un lot (batch) d'activités capturées depuis Claude for Chrome / JSON.
    Attribut automatiquement source='claude_chrome' et statut_validation='a_valider'.
    """
    if not payload_list:
        return []

    # Vérification du voyage sur le premier élément
    trip_id = payload_list[0].trip_id
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Voyage introuvable")

    created_activities = []
    for item in payload_list:
        dest = db.query(TripDestination).filter(
            TripDestination.id == item.destination_id,
            TripDestination.trip_id == trip_id
        ).first()
        if not dest:
            continue

        act = Activity(
            trip_id=trip_id,
            destination_id=item.destination_id,
            categorie_id=item.categorie_id,
            titre=item.titre.strip(),
            adresse=item.adresse.strip() if item.adresse else None,
            zone_geo=item.zone_geo.strip() if item.zone_geo else None,
            url_source=item.url_source.strip() if item.url_source else None,
            description=item.description.strip() if item.description else None,
            cout_par_personne=item.cout_par_personne or 0.0,
            duree_min=item.duree_min,
            duree_max=item.duree_max,
            horaires_ouverture=item.horaires_ouverture.strip() if item.horaires_ouverture else None,
            jours_fermeture=item.jours_fermeture.strip() if item.jours_fermeture else None,
            remarques=item.remarques.strip() if item.remarques else None,
            avis_utilisateurs=item.avis_utilisateurs.strip() if item.avis_utilisateurs else None,
            note_interet=item.note_interet or 3,
            type_element=item.type_element or "activite",
            source="claude_chrome",
            statut_validation="a_valider",
            statut=item.statut or "non_reserve"
        )
        if item.tag_ids:
            from app.models import Tag
            tags_trouves = db.query(Tag).filter(
                Tag.id.in_(item.tag_ids),
                Tag.trip_id == trip_id
            ).all()
            act.tags = tags_trouves

        db.add(act)
        created_activities.append(act)

    db.commit()

    for act in created_activities:
        db.refresh(act)

    return [
        _format_activity_detail(act, trip.nb_personnes or 1)
        for act in created_activities
    ]

