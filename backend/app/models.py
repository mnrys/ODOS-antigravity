"""
Modèles de données SQLAlchemy pour l'application ODOS Travel Planner.
Structure strictement alignée sur SCHEMA_BASE_DE_DONNEES.md.
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Text, Date, DateTime, ForeignKey, Table
)
from sqlalchemy.orm import relationship
from app.database import Base

# Table de liaison Many-to-Many entre Activités et Tags
activity_tags = Table(
    'activity_tags',
    Base.metadata,
    Column('activity_id', Integer, ForeignKey('activities.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)


class Trip(Base):
    """
    1. Table `trips` — Voyages.
    cf. SCHEMA_BASE_DE_DONNEES.md, section 1
    """
    __tablename__ = 'trips'

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    date_debut = Column(Date, nullable=False)
    nb_jours = Column(Integer, nullable=False)
    nb_personnes = Column(Integer, default=1, nullable=False)
    budget_total = Column(Float, default=0.0)
    planning_heure_debut = Column(Integer, default=420)  # 07:00 en minutes
    planning_heure_fin = Column(Integer, default=1380)   # 23:00 en minutes
    share_token = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    destinations = relationship("TripDestination", back_populates="trip", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="trip", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="trip", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="trip", cascade="all, delete-orphan")
    special_blocks = relationship("SpecialBlock", back_populates="trip", cascade="all, delete-orphan")
    scheduled_slots = relationship("ScheduledSlot", back_populates="trip", cascade="all, delete-orphan")


class TripDestination(Base):
    """
    2. Table `trip_destinations` — Sous-destinations d'un voyage (ex: La Palma, Tenerife).
    cf. SCHEMA_BASE_DE_DONNEES.md, section 2
    """
    __tablename__ = 'trip_destinations'

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    nom = Column(String, nullable=False)
    ordre = Column(Integer, default=0)

    # Relations
    trip = relationship("Trip", back_populates="destinations")
    activities = relationship("Activity", back_populates="destination", cascade="all, delete-orphan")
    card_layouts = relationship("CardLayout", back_populates="destination", cascade="all, delete-orphan")


class Category(Base):
    """
    8. Table `categories` — Catégories système ou personnalisées (ex: Nature, Culture, Gastronomie).
    cf. SCHEMA_BASE_DE_DONNEES.md, section 8
    """
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey('trips.id', ondelete='CASCADE'), nullable=True)  # NULL = catégorie système
    nom = Column(String, nullable=False)
    couleur = Column(String, nullable=False)  # Hex Code, ex: '#3F7A55'
    icone = Column(String, nullable=True)
    ordre = Column(Integer, default=0)
    est_systeme = Column(Integer, default=0)

    # Relations
    trip = relationship("Trip", back_populates="categories")
    activities = relationship("Activity", back_populates="category")
    special_blocks = relationship("SpecialBlock", back_populates="category")


class Activity(Base):
    """
    3. Table `activities` — Fiches activités, logements, transports, etc.
    cf. SCHEMA_BASE_DE_DONNEES.md, section 3
    """
    __tablename__ = 'activities'

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    destination_id = Column(Integer, ForeignKey('trip_destinations.id', ondelete='CASCADE'), nullable=False)
    categorie_id = Column(Integer, ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)

    type_element = Column(String, default='activite')  # 'activite'|'logement'|'restaurant'|'transport'|'vol'|'vehicule'|'autre'
    titre = Column(String, nullable=False)
    adresse = Column(String, nullable=True)
    zone_geo = Column(String, nullable=True)  # 'nord' | 'sud' | 'est' | 'ouest'
    duree_min = Column(Integer, nullable=True)
    duree_max = Column(Integer, nullable=True)
    date_debut = Column(Date, nullable=True)
    date_fin = Column(Date, nullable=True)
    numero_reference = Column(String, nullable=True)
    cout_par_personne = Column(Float, default=0.0)
    description = Column(Text, nullable=True)
    horaires_ouverture = Column(Text, nullable=True)  # JSON String
    jours_fermeture = Column(Text, nullable=True)     # JSON String
    source = Column(String, default='manuel')         # 'manuel' | 'scraping_auto' | 'claude_chrome'
    remarques = Column(Text, nullable=True)           # Notes personnelles
    avis_utilisateurs = Column(Text, nullable=True)   # Synthèse avis tiers (Tripadvisor...)
    rating = Column(Float, nullable=True)
    note_interet = Column(Integer, nullable=True)     # 1 à 5
    statut = Column(String, default='non_reserve')    # 'non_reserve'|'en_cours'|'reserve'|'action_requise'|'annule'
    statut_validation = Column(String, default='validee')  # 'a_valider' | 'validee'
    url_source = Column(String, nullable=True)
    completude = Column(Integer, default=0)
    tripadvisor_consulte = Column(Integer, default=0)
    supprime_le = Column(DateTime, nullable=True)     # NULL = actif ; datetime = corbeille
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    trip = relationship("Trip", back_populates="activities")
    destination = relationship("TripDestination", back_populates="activities")
    category = relationship("Category", back_populates="activities")
    documents = relationship("Document", back_populates="activity", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=activity_tags, back_populates="activities")
    scheduled_slots = relationship("ScheduledSlot", back_populates="activity", cascade="all, delete-orphan")


class Document(Base):
    """
    4. Table `documents` — Galerie photos et pièces jointes PDF.
    cf. SCHEMA_BASE_DE_DONNEES.md, section 4
    """
    __tablename__ = 'documents'

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey('activities.id', ondelete='CASCADE'), nullable=False)
    type_fichier = Column(String, nullable=False)  # 'photo' | 'pdf'
    chemin_fichier = Column(String, nullable=False)
    type_source = Column(String, nullable=True)    # 'scraping' | 'upload_manuel' | 'photo_terrain'
    libelle = Column(String, nullable=True)
    date_prise = Column(DateTime, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    est_principale = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    activity = relationship("Activity", back_populates="documents")


class Tag(Base):
    """
    5. Table `tags` — Tags thématiques libres.
    cf. SCHEMA_BASE_DE_DONNEES.md, section 5
    """
    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    nom = Column(String, nullable=False)

    # Relations
    trip = relationship("Trip", back_populates="tags")
    activities = relationship("Activity", secondary=activity_tags, back_populates="tags")


class ScheduledSlot(Base):
    """
    7. Table `scheduled_slots` — Créneaux planifiés sur la grille du Planning.
    cf. SCHEMA_BASE_DE_DONNEES.md, section 7
    """
    __tablename__ = 'scheduled_slots'

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    activity_id = Column(Integer, ForeignKey('activities.id', ondelete='CASCADE'), nullable=True)
    special_block_id = Column(Integer, ForeignKey('special_blocks.id', ondelete='CASCADE'), nullable=True)
    jour = Column(Integer, nullable=False)           # Jour 1, Jour 2...
    heure_debut = Column(Integer, nullable=False)    # Minutes depuis minuit (ex: 540 = 09:00)
    heure_fin = Column(Integer, nullable=False)      # Minutes depuis minuit (ex: 660 = 11:00)
    type = Column(String, default='activite')        # 'activite'|'repas'|'trajet'|'pause'
    verrouille = Column(Integer, default=0)          # 0=libre|1=souple|2=fort
    couleur_override = Column(String, nullable=True)

    # Relations
    trip = relationship("Trip", back_populates="scheduled_slots")
    activity = relationship("Activity", back_populates="scheduled_slots")
    special_block = relationship("SpecialBlock", back_populates="scheduled_slots")


class CardLayout(Base):
    """
    9. Table `card_layouts` — Dispositions de cartes sur l'Atelier (par destination).
    cf. SCHEMA_BASE_DE_DONNEES.md, section 9
    """
    __tablename__ = 'card_layouts'

    id = Column(Integer, primary_key=True, index=True)
    destination_id = Column(Integer, ForeignKey('trip_destinations.id', ondelete='CASCADE'), nullable=False)
    nom = Column(String, nullable=False)
    disposition = Column(Text, nullable=True)  # JSON string {"activity_id": {"x":.., "y":..}}
    est_courante = Column(Integer, default=0)
    est_initiale = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    destination = relationship("TripDestination", back_populates="card_layouts")


class SpecialBlock(Base):
    """
    10. Table `special_blocks` — Blocs libres/repas/trajets dans le planning (impactant le budget).
    cf. SCHEMA_BASE_DE_DONNEES.md, section 10
    """
    __tablename__ = 'special_blocks'

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    label = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'repas'|'trajet'|'pause'|'personnalise'
    categorie_id = Column(Integer, ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    duree_minutes = Column(Integer, default=60)
    cout = Column(Float, default=0.0)
    icone = Column(String, nullable=True)
    couleur = Column(String, nullable=True)

    # Relations
    trip = relationship("Trip", back_populates="special_blocks")
    category = relationship("Category", back_populates="special_blocks")
    scheduled_slots = relationship("ScheduledSlot", back_populates="special_block", cascade="all, delete-orphan")
