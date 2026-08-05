"""
Service de calcul dynamique du score de complétude d'une fiche activité.
cf. SCHEMA_BASE_DE_DONNEES.md, section 6 "Score de complétude" et Règle d'or 5.2.
"""
from typing import Optional, List, Any


def calculate_completeness(
    activity: Any,
    has_main_photo: bool = False,
    tag_count: int = 0
) -> int:
    """
    Calcule le score de complétude (0 à 100) d'une fiche activité en vérifiant
    la présence effective de chacun des champs requis.

    Pondération fixée par SCHEMA_BASE_DE_DONNEES.md :
    - titre : 15 pts
    - destination_id : 5 pts
    - adresse : 10 pts
    - duree_min ou dates (pour log/vehicule) : 10 pts
    - cout_par_personne : 5 pts
    - description : 15 pts
    - photo_principale : 10 pts
    - horaires_ouverture : 10 pts
    - tags : 5 pts
    - note_interet : 5 pts
    - zone_geo : 10 pts
    Total : 100 pts

    Args:
        activity: Instance du modèle Activity ou schéma Pydantic
        has_main_photo: Vrai si au moins un document photo est rattaché
        tag_count: Nombre de tags rattachés

    Returns:
        Score entier entre 0 et 100.
    """
    score = 0

    # 1. Titre (15 pts) - Obligatoire
    if getattr(activity, "titre", None) and str(activity.titre).strip():
        score += 15

    # 2. Destination (5 pts)
    if getattr(activity, "destination_id", None):
        score += 5

    # 3. Adresse (10 pts)
    if getattr(activity, "adresse", None) and str(activity.adresse).strip():
        score += 10

    # 4. Durée ou Dates (10 pts)
    # Pour un logement ou véhicule, les dates font office de durée
    duree = getattr(activity, "duree_min", None)
    date_deb = getattr(activity, "date_debut", None)
    if (duree is not None and duree > 0) or date_deb:
        score += 10

    # 5. Coût par personne (5 pts)
    cout = getattr(activity, "cout_par_personne", None)
    if cout is not None and cout >= 0:
        score += 5

    # 6. Description (15 pts)
    if getattr(activity, "description", None) and str(activity.description).strip():
        score += 15

    # 7. Photo principale (10 pts)
    if has_main_photo:
        score += 10

    # 8. Horaires d'ouverture (10 pts)
    if getattr(activity, "horaires_ouverture", None) and str(activity.horaires_ouverture).strip():
        score += 10

    # 9. Tags (5 pts)
    if tag_count > 0:
        score += 5

    # 10. Note d'intérêt (5 pts)
    note = getattr(activity, "note_interet", None)
    if note is not None and note > 0:
        score += 5

    # 11. Zone géographique (10 pts)
    if getattr(activity, "zone_geo", None) and str(activity.zone_geo).strip():
        score += 10

    return min(100, score)
