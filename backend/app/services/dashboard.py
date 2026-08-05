"""
Service métier pour la consolidation des données du Dashboard (Écran 0).
cf. PRD_ecran0_dashboard.md et SCHEMA_BASE_DE_DONNEES.md
"""
from datetime import date, timedelta
from typing import List
from sqlalchemy.orm import Session
from app.models import Trip, TripDestination, Activity, Category, ScheduledSlot, SpecialBlock, Document
from app.schemas import (
    DashboardResponse, BudgetSummary, BudgetBreakdownItem, DestinationSummary
)


def compute_dashboard_data(db: Session, trip_id: int) -> DashboardResponse:
    """
    Calcule et consolide toutes les informations requises pour le Dashboard d'un voyage :
    - Compte à rebours avant le départ
    - Budget prévu vs dépensé/estimé
    - Ventilation du budget par destination / catégorie / journée
    - Répartition des activités par destination avec état de placement
    - Décompte des fiches en attente de validation (statut_validation = 'a_valider')
    """
    # 1. Récupération du voyage
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise ValueError(f"Voyage avec id {trip_id} introuvable.")

    # 2. Compte à rebours
    today = date.today()
    jours_avant_depart = (trip.date_debut - today).days
    date_fin_voyage = trip.date_debut + timedelta(days=trip.nb_jours - 1)

    # 3. Récupération des activités actives (non supprimées)
    activities = db.query(Activity).filter(
        Activity.trip_id == trip_id,
        Activity.supprime_le.is_(None)
    ).all()

    # Décompte des fiches en attente de validation
    nb_fiches_a_valider = sum(1 for a in activities if a.statut_validation == 'a_valider')

    # Seules les activités validées entrent dans le calcul d'avancement et de budget du voyage
    activities_validees = [a for a in activities if a.statut_validation == 'validee']

    # 4. Identification des activités placées dans le planning via scheduled_slots
    slots = db.query(ScheduledSlot).filter(ScheduledSlot.trip_id == trip_id).all()
    placed_activity_ids = {s.activity_id for s in slots if s.activity_id is not None}

    # 5. Calcul des coûts
    # Règle d'or 5.2 : Le prix total d'une activité vaut `cout_par_personne * nb_personnes`
    # Règle 61 PRD0 : Le budget intègre aussi le coût des special_blocks
    special_blocks = db.query(SpecialBlock).filter(SpecialBlock.trip_id == trip_id).all()

    # Totaux
    cout_activites_total = sum(a.cout_par_personne * trip.nb_personnes for a in activities_validees)
    cout_blocks_total = sum(sb.cout for sb in special_blocks)
    cout_total_estime = cout_activites_total + cout_blocks_total

    # 6. Ventilation par Destination
    destinations = db.query(TripDestination).filter(
        TripDestination.trip_id == trip_id
    ).order_by(TripDestination.ordre).all()

    par_destination: List[BudgetBreakdownItem] = []
    destinations_summary: List[DestinationSummary] = []

    for dest in destinations:
        dest_acts = [a for a in activities_validees if a.destination_id == dest.id]
        dest_acts_all = [a for a in activities if a.destination_id == dest.id and a.statut_validation == 'validee']
        nb_acts = len(dest_acts_all)
        nb_placed = sum(1 for a in dest_acts_all if a.id in placed_activity_ids)

        cost_dest = sum(a.cout_par_personne * trip.nb_personnes for a in dest_acts)
        pct = (cost_dest / cout_total_estime * 100.0) if cout_total_estime > 0 else 0.0

        par_destination.append(BudgetBreakdownItem(
            cle=str(dest.id),
            label=dest.nom,
            montant=round(cost_dest, 2),
            pourcentage=round(pct, 1),
            couleur=None
        ))

        # Récupération de la photo de couverture principale
        photo_cov = None
        for a in dest_acts_all:
            doc_p = db.query(Document).filter(
                Document.activity_id == a.id,
                Document.type_fichier == 'photo',
                Document.est_principale == 1
            ).first()
            if doc_p:
                photo_cov = doc_p.chemin_fichier
                break

        destinations_summary.append(DestinationSummary(
            id=dest.id,
            nom=dest.nom,
            ordre=dest.ordre,
            nb_activites=nb_acts,
            nb_activites_placées=nb_placed,
            photo_couverture=photo_cov
        ))

    # 7. Ventilation par Catégorie
    categories = db.query(Category).filter(
        (Category.trip_id == trip_id) | (Category.est_systeme == 1)
    ).all()

    cat_map = {c.id: c for c in categories}
    cat_costs = {}

    for a in activities_validees:
        c_id = a.categorie_id or 0
        cat_costs[c_id] = cat_costs.get(c_id, 0.0) + (a.cout_par_personne * trip.nb_personnes)

    for sb in special_blocks:
        c_id = sb.categorie_id or 0
        cat_costs[c_id] = cat_costs.get(c_id, 0.0) + sb.cout

    par_categorie: List[BudgetBreakdownItem] = []
    for c_id, cost in cat_costs.items():
        cat_obj = cat_map.get(c_id)
        label = cat_obj.nom if cat_obj else "Non catégorisé"
        couleur = cat_obj.couleur if cat_obj else "#6E7278"
        pct = (cost / cout_total_estime * 100.0) if cout_total_estime > 0 else 0.0

        par_categorie.append(BudgetBreakdownItem(
            cle=str(c_id),
            label=label,
            montant=round(cost, 2),
            pourcentage=round(pct, 1),
            couleur=couleur
        ))

    # 8. Ventilation par Journée (les jours du voyage)
    par_journee: List[BudgetBreakdownItem] = []
    day_costs = {j: 0.0 for j in range(1, trip.nb_jours + 1)}

    # Activités attribuées via slots
    for slot in slots:
        if slot.activity_id:
            act = next((a for a in activities_validees if a.id == slot.activity_id), None)
            if act and 1 <= slot.jour <= trip.nb_jours:
                day_costs[slot.jour] += (act.cout_par_personne * trip.nb_personnes)
        elif slot.special_block_id:
            sb = next((b for b in special_blocks if b.id == slot.special_block_id), None)
            if sb and 1 <= slot.jour <= trip.nb_jours:
                day_costs[slot.jour] += sb.cout

    for jour_num in range(1, trip.nb_jours + 1):
        j_date = trip.date_debut + timedelta(days=jour_num - 1)
        cost_day = day_costs[jour_num]
        pct = (cost_day / cout_total_estime * 100.0) if cout_total_estime > 0 else 0.0
        par_journee.append(BudgetBreakdownItem(
            cle=f"jour_{jour_num}",
            label=f"Jour {jour_num} ({j_date.strftime('%d/%m')})",
            montant=round(cost_day, 2),
            pourcentage=round(pct, 1),
            couleur=None
        ))

    # Assemblage de la réponse
    return DashboardResponse(
        trip_id=trip.id,
        nom_voyage=trip.nom,
        date_debut=trip.date_debut,
        date_fin=date_fin_voyage,
        nb_jours=trip.nb_jours,
        nb_personnes=trip.nb_personnes,
        jours_avant_depart=jours_avant_depart,
        budget=BudgetSummary(
            budget_total_prevu=trip.budget_total,
            cout_total_estime=round(cout_total_estime, 2),
            par_destination=par_destination,
            par_categorie=par_categorie,
            par_journee=par_journee
        ),
        destinations=destinations_summary,
        nb_activites_total=len(activities_validees),
        nb_activites_placées=len(placed_activity_ids.intersection({a.id for a in activities_validees})),
        nb_fiches_a_valider=nb_fiches_a_valider
    )
