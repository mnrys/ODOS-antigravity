"""
Service métier pour l'Écran 3 : Planning plein écran et pont Atelier ↔ Planning.

Porte toute la logique métier liée :
- à la restitution des données complètes du Planning (slots ordonnés, activités non placées, ventilation budgétaire)
- à la gestion des créneaux (création, mise à jour, déplacement, verrouillage, suppression, duplication autonome)
- à la détection stricte des conflits / chevauchements d'horaires
- à la gestion des blocs libres / spéciaux (repas, pauses, trajets, dépenses spéciales)

Conforme à :
- PRD_ecran3_planning.md (US-3, US-5, US-10, US-11, US-12, US-16, US-17, US-18, US-19, US-20, US-21, US-22)
- SCHEMA_BASE_DE_DONNEES.md (sections 7 et 10)
- GEMINI.md (Règles d'or 5.1, 5.2, 5.5, 7.2 : « toute la logique métier vit dans services/ »)
"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload

from app.models import Trip, TripDestination, Activity, Category, ScheduledSlot, SpecialBlock


def minutes_to_time_str(minutes: int) -> str:
    """
    Convertit des minutes depuis minuit en chaîne 'HH:MM' (ex: 555 -> '09:15').
    """
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


def get_trip_planning_data(db: Session, trip_id: int) -> Dict[str, Any]:
    """
    Consolide et retourne l'ensemble des données nécessaires à l'affichage du Planning :
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
        raise ValueError(f"Voyage avec id {trip_id} introuvable.")

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


def create_planning_slot(
    db: Session,
    trip_id: int,
    jour: int,
    heure_debut: int,
    heure_fin: int,
    activity_id: Optional[int] = None,
    special_block_id: Optional[int] = None,
    slot_type: str = 'activite',
    verrouille: int = 0,
    couleur_override: Optional[str] = None
) -> ScheduledSlot:
    """
    Crée un créneau planifié sur le Planning avec validation stricte du quart d'heure et des conflits.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise ValueError(f"Voyage avec id {trip_id} introuvable.")

    if heure_debut % 15 != 0:
        raise ValueError(f"L'heure de début ({minutes_to_time_str(heure_debut)}) doit être un multiple de 15 minutes.")
    if heure_fin % 15 != 0:
        raise ValueError(f"L'heure de fin ({minutes_to_time_str(heure_fin)}) doit être un multiple de 15 minutes.")
    if heure_fin <= heure_debut:
        raise ValueError("L'heure de fin doit être strictement supérieure à l'heure de début.")
    if jour < 1 or jour > trip.nb_jours:
        raise ValueError(f"Le jour {jour} est invalide pour ce voyage ({trip.nb_jours} jours prévus).")

    conflict = check_slot_overlap(
        db=db,
        trip_id=trip_id,
        jour=jour,
        heure_debut=heure_debut,
        heure_fin=heure_fin
    )
    if conflict:
        title = conflict.activity.titre if conflict.activity else (conflict.special_block.label if conflict.special_block else "une activité")
        raise ValueError(f"CONFLICT: Créneau occupé par « {title} » de {minutes_to_time_str(conflict.heure_debut)} à {minutes_to_time_str(conflict.heure_fin)}.")

    new_slot = ScheduledSlot(
        trip_id=trip_id,
        activity_id=activity_id,
        special_block_id=special_block_id,
        jour=jour,
        heure_debut=heure_debut,
        heure_fin=heure_fin,
        type=slot_type or 'activite',
        verrouille=verrouille or 0,
        couleur_override=couleur_override
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    return new_slot


def update_planning_slot(
    db: Session,
    slot_id: int,
    jour: Optional[int] = None,
    heure_debut: Optional[int] = None,
    heure_fin: Optional[int] = None,
    slot_type: Optional[str] = None,
    verrouille: Optional[int] = None,
    couleur_override: Optional[str] = None
) -> ScheduledSlot:
    """
    Met à jour un créneau planifié (déplacement, redimensionnement, verrouillage).
    """
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise ValueError(f"Créneau {slot_id} non trouvé.")

    new_jour = jour if jour is not None else slot.jour
    new_debut = heure_debut if heure_debut is not None else slot.heure_debut
    new_fin = heure_fin if heure_fin is not None else slot.heure_fin
    new_verrouille = verrouille if verrouille is not None else slot.verrouille

    is_moving = (new_jour != slot.jour or new_debut != slot.heure_debut or new_fin != slot.heure_fin)

    if (slot.verrouille or 0) > 0 and is_moving and new_verrouille != 0:
        raise ValueError("LOCKED: Ce créneau est verrouillé. Veuillez le déverrouiller explicitement avant de le déplacer.")

    if new_debut % 15 != 0 or new_fin % 15 != 0:
        raise ValueError("Les horaires doivent être des multiples de 15 minutes.")
    if new_fin <= new_debut:
        raise ValueError("L'heure de fin doit être supérieure à l'heure de début.")

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
            raise ValueError(f"CONFLICT: Créneau occupé par « {title} » de {minutes_to_time_str(conflict.heure_debut)} à {minutes_to_time_str(conflict.heure_fin)}.")

    slot.jour = new_jour
    slot.heure_debut = new_debut
    slot.heure_fin = new_fin
    slot.verrouille = new_verrouille
    if slot_type is not None:
        slot.type = slot_type
    if couleur_override is not None:
        slot.couleur_override = couleur_override

    db.commit()
    db.refresh(slot)
    return slot


def toggle_planning_slot_lock(db: Session, slot_id: int) -> ScheduledSlot:
    """
    Bascule rapide du verrouillage d'un créneau (US-11).
    """
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise ValueError(f"Créneau {slot_id} non trouvé.")

    slot.verrouille = 0 if (slot.verrouille or 0) > 0 else 1
    db.commit()
    db.refresh(slot)
    return slot


def delete_planning_slot(db: Session, slot_id: int) -> Tuple[Optional[int], Optional[int]]:
    """
    Retire un créneau du planning et renvoie (activity_id, special_block_id).
    """
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise ValueError(f"Créneau {slot_id} non trouvé.")

    activity_id = slot.activity_id
    special_block_id = slot.special_block_id

    db.delete(slot)
    db.commit()
    return activity_id, special_block_id


def duplicate_planning_slot(
    db: Session,
    slot_id: int,
    target_jour: Optional[int] = None,
    target_start: Optional[int] = None,
    target_end: Optional[int] = None,
    trip_id: Optional[int] = None
) -> ScheduledSlot:
    """
    Duplique un créneau existant (activité ou bloc libre) sur un nouveau jour/horaire (US-21, US-22).
    Crée un clone autonome.
    """
    slot = db.query(ScheduledSlot).filter(ScheduledSlot.id == slot_id).first()
    if not slot:
        raise ValueError(f"Créneau source {slot_id} non trouvé.")

    actual_trip_id = trip_id or slot.trip_id
    trip = db.query(Trip).filter(Trip.id == actual_trip_id).first()
    if not trip:
        raise ValueError(f"Voyage {actual_trip_id} non trouvé.")

    duration = (slot.heure_fin - slot.heure_debut) if (slot.heure_fin and slot.heure_debut) else 60
    jour_dest = target_jour if target_jour is not None else slot.jour
    start_dest = target_start if target_start is not None else slot.heure_debut
    end_dest = target_end if target_end is not None else (start_dest + duration)

    if start_dest % 15 != 0 or end_dest % 15 != 0:
        raise ValueError("Les horaires doivent être des multiples de 15 minutes.")
    if end_dest <= start_dest:
        raise ValueError("L'heure de fin doit être strictement supérieure à l'heure de début.")
    if jour_dest < 1 or jour_dest > trip.nb_jours:
        raise ValueError(f"Le jour {jour_dest} est invalide pour ce voyage ({trip.nb_jours} jours prévus).")

    conflict = check_slot_overlap(
        db=db,
        trip_id=actual_trip_id,
        jour=jour_dest,
        heure_debut=start_dest,
        heure_fin=end_dest
    )
    if conflict:
        title = conflict.activity.titre if conflict.activity else (conflict.special_block.label if conflict.special_block else "une activité")
        raise ValueError(f"CONFLICT: Créneau cible occupé par « {title} » de {minutes_to_time_str(conflict.heure_debut)} à {minutes_to_time_str(conflict.heure_fin)}.")

    new_activity_id = None
    new_special_block_id = None

    if slot.activity_id:
        orig_act = db.query(Activity).filter(Activity.id == slot.activity_id).first()
        new_act = Activity(
            trip_id=actual_trip_id,
            destination_id=orig_act.destination_id if orig_act else None,
            categorie_id=orig_act.categorie_id if orig_act else None,
            titre=orig_act.titre if orig_act else "Activité dupliquée",
            type_element=orig_act.type_element if orig_act else 'activite',
            statut_validation='validee',
            cout_par_personne=orig_act.cout_par_personne if orig_act else 0.0,
            duree_min=orig_act.duree_min if orig_act else duration,
            description=orig_act.description if orig_act else None,
            remarques=orig_act.remarques if orig_act else None,
            zone_geo=orig_act.zone_geo if orig_act else None,
            adresse=orig_act.adresse if orig_act else None,
            url_source=orig_act.url_source if orig_act else None,
            note_interet=orig_act.note_interet if orig_act else None,
            source='copie'
        )
        db.add(new_act)
        db.flush()
        if orig_act and orig_act.tags:
            new_act.tags = list(orig_act.tags)
        new_activity_id = new_act.id

    elif slot.special_block_id:
        orig_block = db.query(SpecialBlock).filter(SpecialBlock.id == slot.special_block_id).first()
        new_block = SpecialBlock(
            trip_id=actual_trip_id,
            label=orig_block.label if orig_block else "Bloc dupliqué",
            type=orig_block.type if orig_block else 'personnalise',
            categorie_id=orig_block.categorie_id if orig_block else None,
            duree_minutes=orig_block.duree_minutes if orig_block else duration,
            cout=orig_block.cout if orig_block else 0.0,
            icone=orig_block.icone if orig_block else None,
            couleur=orig_block.couleur if orig_block else None
        )
        db.add(new_block)
        db.flush()
        new_special_block_id = new_block.id

    new_slot = ScheduledSlot(
        trip_id=actual_trip_id,
        activity_id=new_activity_id,
        special_block_id=new_special_block_id,
        jour=jour_dest,
        heure_debut=start_dest,
        heure_fin=end_dest,
        type=slot.type or ('activite' if new_activity_id else 'special_block'),
        verrouille=0,
        couleur_override=slot.couleur_override
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    return new_slot


def create_special_block_service(
    db: Session,
    trip_id: int,
    label: str,
    block_type: str,
    categorie_id: Optional[int] = None,
    duree_minutes: int = 60,
    cout: float = 0.0,
    icone: Optional[str] = None,
    couleur: Optional[str] = None,
    jour: Optional[int] = None,
    heure_debut: Optional[int] = None
) -> Tuple[SpecialBlock, Optional[ScheduledSlot]]:
    """
    Crée un bloc spécial avec création optionnelle du créneau associé.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise ValueError(f"Voyage avec id {trip_id} introuvable.")

    new_block = SpecialBlock(
        trip_id=trip_id,
        label=label.strip(),
        type=block_type,
        categorie_id=categorie_id,
        duree_minutes=duree_minutes or 60,
        cout=cout or 0.0,
        icone=icone,
        couleur=couleur
    )
    db.add(new_block)
    db.flush()

    new_slot = None
    if jour is not None and heure_debut is not None:
        debut = heure_debut
        fin = debut + (duree_minutes or 60)
        if debut % 15 == 0 and fin % 15 == 0:
            conflict = check_slot_overlap(db, trip_id, jour, debut, fin)
            if not conflict:
                new_slot = ScheduledSlot(
                    trip_id=trip_id,
                    special_block_id=new_block.id,
                    jour=jour,
                    heure_debut=debut,
                    heure_fin=fin,
                    type=block_type,
                    couleur_override=couleur
                )
                db.add(new_slot)
                db.flush()

    db.commit()
    db.refresh(new_block)
    if new_slot:
        db.refresh(new_slot)
    return new_block, new_slot


def update_special_block_service(
    db: Session,
    block_id: int,
    label: Optional[str] = None,
    block_type: Optional[str] = None,
    categorie_id: Optional[int] = None,
    duree_minutes: Optional[int] = None,
    cout: Optional[float] = None,
    icone: Optional[str] = None,
    couleur: Optional[str] = None,
    jour: Optional[int] = None,
    heure_debut: Optional[int] = None
) -> SpecialBlock:
    """
    Met à jour un bloc spécial et synchronise son créneau associé.
    """
    block = db.query(SpecialBlock).filter(SpecialBlock.id == block_id).first()
    if not block:
        raise ValueError(f"Bloc spécial {block_id} non trouvé.")

    if label is not None:
        block.label = label.strip()
    if block_type is not None:
        block.type = block_type
    if categorie_id is not None:
        block.categorie_id = categorie_id
    if duree_minutes is not None:
        block.duree_minutes = duree_minutes
    if cout is not None:
        block.cout = cout
    if icone is not None:
        block.icone = icone
    if couleur is not None:
        block.couleur = couleur

    slot = db.query(ScheduledSlot).filter(ScheduledSlot.special_block_id == block.id).first()
    if slot:
        if jour is not None:
            slot.jour = jour
        if heure_debut is not None:
            slot.heure_debut = heure_debut
            slot.heure_fin = heure_debut + (duree_minutes or block.duree_minutes or 60)
        elif duree_minutes is not None:
            slot.heure_fin = slot.heure_debut + duree_minutes
        if block_type is not None:
            slot.type = block_type
        if couleur is not None:
            slot.couleur_override = couleur

    db.commit()
    db.refresh(block)
    return block


def delete_special_block_service(db: Session, block_id: int) -> None:
    """
    Supprime un bloc spécial et ses créneaux associés.
    """
    block = db.query(SpecialBlock).filter(SpecialBlock.id == block_id).first()
    if not block:
        raise ValueError(f"Bloc spécial {block_id} non trouvé.")

    db.delete(block)
    db.commit()
