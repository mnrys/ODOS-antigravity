"""
Schémas Pydantic de validation et d'échange pour l'API FastAPI.
Conforme à SCHEMA_BASE_DE_DONNEES.md.
"""
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Catégories
# ---------------------------------------------------------------------------
class CategoryBase(BaseModel):
    id: int
    nom: str
    couleur: str
    icone: Optional[str] = None
    est_systeme: int = 0

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------
class TagBase(BaseModel):
    id: int
    trip_id: int
    nom: str

    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    nom: str


# ---------------------------------------------------------------------------
# Documents & Galerie
# ---------------------------------------------------------------------------
class DocumentBase(BaseModel):
    id: int
    activity_id: int
    type_fichier: str          # 'photo' | 'pdf'
    chemin_fichier: str        # chemin relatif sur le serveur (ex: uploads/activities/1/photo.jpg)
    type_source: Optional[str] = 'upload_manuel'  # 'scraping' | 'upload_manuel' | 'photo_terrain'
    libelle: Optional[str] = None
    date_prise: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    est_principale: int = 0
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Voyages
# ---------------------------------------------------------------------------
class TripOut(BaseModel):
    id: int
    nom: str
    date_debut: date
    nb_jours: int
    nb_personnes: int
    budget_total: float

    model_config = ConfigDict(from_attributes=True)


class TripUpdate(BaseModel):
    nom: Optional[str] = None
    date_debut: Optional[date] = None
    nb_jours: Optional[int] = None
    nb_personnes: Optional[int] = None
    budget_total: Optional[float] = None


# ---------------------------------------------------------------------------
# Destinations
# ---------------------------------------------------------------------------
class DestinationBase(BaseModel):
    id: int
    trip_id: int
    nom: str
    ordre: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Activités (Création, Édition, Vue détaillée, Résumé)
# ---------------------------------------------------------------------------
class ActivityCreate(BaseModel):
    destination_id: int
    titre: str
    type_element: str = "activite"       # 'activite'|'logement'|'restaurant'|'transport'|'vol'|'vehicule'|'autre'
    categorie_id: Optional[int] = None
    adresse: Optional[str] = None
    zone_geo: Optional[str] = None      # 'nord' | 'sud' | 'est' | 'ouest'
    duree_min: Optional[int] = None
    duree_max: Optional[int] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    numero_reference: Optional[str] = None
    cout_par_personne: float = 0.0
    description: Optional[str] = None
    horaires_ouverture: Optional[str] = None
    jours_fermeture: Optional[str] = None
    source: str = "manuel"              # 'manuel' | 'scraping_auto' | 'claude_chrome'
    remarques: Optional[str] = None
    avis_utilisateurs: Optional[str] = None
    rating: Optional[float] = None
    note_interet: Optional[int] = None   # 1 à 5
    statut: str = "non_reserve"         # 'non_reserve'|'en_cours'|'reserve'|'action_requise'|'annule'
    statut_validation: str = "validee"  # 'a_valider' | 'validee'
    url_source: Optional[str] = None
    tag_ids: List[int] = Field(default_factory=list)


class ActivityUpdate(BaseModel):
    destination_id: Optional[int] = None
    titre: Optional[str] = None
    type_element: Optional[str] = None
    categorie_id: Optional[int] = None
    adresse: Optional[str] = None
    zone_geo: Optional[str] = None
    duree_min: Optional[int] = None
    duree_max: Optional[int] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    numero_reference: Optional[str] = None
    cout_par_personne: Optional[float] = None
    description: Optional[str] = None
    horaires_ouverture: Optional[str] = None
    jours_fermeture: Optional[str] = None
    source: Optional[str] = None
    remarques: Optional[str] = None
    avis_utilisateurs: Optional[str] = None
    rating: Optional[float] = None
    note_interet: Optional[int] = None
    statut: Optional[str] = None
    statut_validation: Optional[str] = None
    url_source: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class ActivityDetail(BaseModel):
    id: int
    trip_id: int
    destination_id: int
    destination_nom: Optional[str] = None
    categorie_id: Optional[int] = None
    categorie_nom: Optional[str] = None
    categorie_couleur: Optional[str] = None
    type_element: str
    titre: str
    adresse: Optional[str] = None
    zone_geo: Optional[str] = None
    duree_min: Optional[int] = None
    duree_max: Optional[int] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    numero_reference: Optional[str] = None
    cout_par_personne: float
    cout_total: float                    # Dérivé: cout_par_personne * nb_personnes
    description: Optional[str] = None
    horaires_ouverture: Optional[str] = None
    jours_fermeture: Optional[str] = None
    source: str
    remarques: Optional[str] = None
    avis_utilisateurs: Optional[str] = None
    rating: Optional[float] = None
    note_interet: Optional[int] = None
    statut: str
    statut_validation: str
    url_source: Optional[str] = None
    completude: int                      # Dérivé: calcul dynamique
    est_placée: bool = False             # Dérivé: existence d'un slot
    created_at: Optional[datetime] = None
    supprime_le: Optional[datetime] = None
    tags: List[TagBase] = Field(default_factory=list)
    documents: List[DocumentBase] = Field(default_factory=list)
    photo_principale: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ActivitySummary(BaseModel):
    id: int
    titre: str
    type_element: str
    destination_id: int
    destination_nom: Optional[str] = None
    categorie_id: Optional[int] = None
    categorie_nom: Optional[str] = None
    categorie_couleur: Optional[str] = None
    cout_par_personne: float
    cout_total: float
    note_interet: Optional[int] = None
    statut_validation: str
    source: str
    completude: int = 0
    est_placée: bool = False
    photo_principale: Optional[str] = None
    tags: List[TagBase] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TrashItem(BaseModel):
    id: int
    trip_id: int
    titre: str
    destination_nom: Optional[str] = None
    categorie_nom: Optional[str] = None
    source: str
    statut_validation: str
    supprime_le: datetime
    jours_restants_grace: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Dashboard & Statistiques
# ---------------------------------------------------------------------------
class DestinationSummary(BaseModel):
    id: int
    nom: str
    ordre: int
    nb_activites: int
    nb_activites_placées: int
    photo_couverture: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BudgetBreakdownItem(BaseModel):
    cle: str          # Identifiant (ex: ID de destination, nom de catégorie, ou jour "2026-10-10")
    label: str        # Libellé lisible par l'utilisateur
    montant: float    # Coût total calculé
    pourcentage: float
    couleur: Optional[str] = None


class BudgetSummary(BaseModel):
    budget_total_prevu: float
    cout_total_estime: float
    par_destination: List[BudgetBreakdownItem]
    par_categorie: List[BudgetBreakdownItem]
    par_journee: List[BudgetBreakdownItem]


class DashboardResponse(BaseModel):
    trip_id: int
    nom_voyage: str
    date_debut: date
    date_fin: date
    nb_jours: int
    nb_personnes: int
    jours_avant_depart: int
    budget: BudgetSummary
    destinations: List[DestinationSummary]
    nb_activites_total: int
    nb_activites_placées: int
    nb_fiches_a_valider: int


# ---------------------------------------------------------------------------
# Atelier & Dispositions (CardLayouts)
# ---------------------------------------------------------------------------
class CardLayoutSaveRequest(BaseModel):
    nom: Optional[str] = "En cours"
    disposition: Dict[str, Any] = Field(default_factory=dict)


class CardLayoutOut(BaseModel):
    id: int
    destination_id: int
    nom: str
    disposition: Dict[str, Any]
    est_courante: int
    est_initiale: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkshopActivityNode(BaseModel):
    id: int
    trip_id: int
    destination_id: int
    titre: str
    categorie_id: Optional[int] = None
    categorie_nom: Optional[str] = None
    categorie_couleur: Optional[str] = "#8E8F92"
    type_element: str
    cout_par_personne: float
    cout_total: float
    duree_min: Optional[int] = None
    note_interet: Optional[int] = None
    description: Optional[str] = None
    adresse: Optional[str] = None
    zone_geo: Optional[str] = None
    photo_principale: Optional[str] = None
    completude: int = 0
    est_placée: bool = False
    source: str
    url_source: Optional[str] = None
    remarques: Optional[str] = None
    horaires_ouverture: Optional[str] = None
    jours_fermeture: Optional[str] = None
    avis_utilisateurs: Optional[str] = None
    rating: Optional[float] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    numero_reference: Optional[str] = None
    statut: str = "non_reserve"
    tags: List[TagBase] = Field(default_factory=list)
    documents: List[DocumentBase] = Field(default_factory=list)
    x: float
    y: float
    z_index: int = 1



class WorkshopResponse(BaseModel):
    destination_id: int
    destination_nom: str
    disposition_nom: str
    activities: List[WorkshopActivityNode]
    categories: List[CategoryBase]

