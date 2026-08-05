"""
Script de peuplement de la base de données SQLite avec le voyage de démonstration Canaries.
Conforme à PLAN.md (Phase 1) et SCHEMA_BASE_DE_DONNEES.md.
"""
from datetime import date, datetime
from app.database import engine, Base, SessionLocal
from app.models import (
    Trip, TripDestination, Category, Activity, Document, Tag, ScheduledSlot, SpecialBlock
)


def seed_database():
    """
    Crée les tables SQLite si elles n'existent pas déjà et réinjecte le jeu de données de test Canaries.
    """
    # Création physique des tables SQLite d'après les modèles SQLAlchemy
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Vérification si un voyage existe déjà
        existing_trip = db.query(Trip).filter(Trip.nom == "Voyage aux Canaries").first()
        if existing_trip:
            print("Le voyage 'Voyage aux Canaries' existe déjà en base.")
            return

        print("Injection du jeu de données de test 'Voyage aux Canaries'...")

        # 1. Voyage principal
        trip = Trip(
            nom="Voyage aux Canaries",
            date_debut=date(2026, 10, 10),  # Départ 10 Octobre 2026
            nb_jours=14,
            nb_personnes=4,                 # 4 voyageurs
            budget_total=2500.0,             # Budget prévu 2500 €
            planning_heure_debut=480,       # 08:00
            planning_heure_fin=1320         # 22:00
        )
        db.add(trip)
        db.flush()

        # 2. Destinations
        dest_la_palma = TripDestination(trip_id=trip.id, nom="La Palma", ordre=1)
        dest_tenerife = TripDestination(trip_id=trip.id, nom="Tenerife", ordre=2)
        db.add_all([dest_la_palma, dest_tenerife])
        db.flush()

        # 3. Catégories système / principales (DESIGN.md)
        cat_nature = Category(trip_id=trip.id, nom="Nature & Rando", couleur="#3F7A55", icone="tree", ordre=1, est_systeme=1)
        cat_culture = Category(trip_id=trip.id, nom="Culture & Visites", couleur="#395E8C", icone="landmark", ordre=2, est_systeme=1)
        cat_gastro = Category(trip_id=trip.id, nom="Restaurants & Bars", couleur="#A4553A", icone="utensils", ordre=3, est_systeme=1)
        cat_logement = Category(trip_id=trip.id, nom="Hébergement", couleur="#6B5B95", icone="home", ordre=4, est_systeme=1)
        cat_vols = Category(trip_id=trip.id, nom="Aérien / Vols", couleur="#0284C7", icone="plane", ordre=5, est_systeme=1)
        cat_vehicule = Category(trip_id=trip.id, nom="Location de véhicule", couleur="#D97706", icone="car", ordre=6, est_systeme=1)
        cat_transport = Category(trip_id=trip.id, nom="Autres transports", couleur="#6E7278", icone="bus", ordre=7, est_systeme=1)
        db.add_all([cat_nature, cat_culture, cat_gastro, cat_logement, cat_vols, cat_vehicule, cat_transport])
        db.flush()

        # 4. Tags
        tag_rando = Tag(trip_id=trip.id, nom="Randonnée")
        tag_astro = Tag(trip_id=trip.id, nom="Astronomie")
        tag_incontournable = Tag(trip_id=trip.id, nom="Must-see")
        db.add_all([tag_rando, tag_astro, tag_incontournable])
        db.flush()

        # 5. Activités La Palma
        act1 = Activity(
            trip_id=trip.id,
            destination_id=dest_la_palma.id,
            categorie_id=cat_nature.id,
            type_element="activite",
            titre="Randonnée Roque de los Muchachos",
            adresse="Roque de los Muchachos, La Palma",
            zone_geo="nord",
            duree_min=240,
            cout_par_personne=45.0,  # Coût total 2 * 45 = 90 €
            description="Superbe randonnée au sommet de La Palma longeant la Caldera de Taburiente.",
            source="manuel",
            rating=4.9,
            note_interet=5,
            statut="reserve",
            statut_validation="validee"
        )

        act2 = Activity(
            trip_id=trip.id,
            destination_id=dest_la_palma.id,
            categorie_id=cat_nature.id,
            type_element="activite",
            titre="Observation astronomique à Garafía",
            adresse="Garafía, La Palma",
            zone_geo="nord",
            duree_min=180,
            cout_par_personne=35.0,  # Coût total 2 * 35 = 70 €
            description="Session d'observation du ciel étoilé avec télescope et guide astronome.",
            source="manuel",
            rating=4.8,
            note_interet=5,
            statut="non_reserve",
            statut_validation="validee"
        )

        act3_pending = Activity(
            trip_id=trip.id,
            destination_id=dest_la_palma.id,
            categorie_id=cat_nature.id,
            type_element="activite",
            titre="Mirador de La Cumbrecita",
            adresse="El Paso, La Palma",
            zone_geo="est",
            duree_min=90,
            cout_par_personne=0.0,
            description="Point de vue spectaculaire sur le cratère central. Fiche scrapée à valider.",
            source="scraping_auto",
            url_source="https://www.getyourguide.fr/la-palma-l3200/",
            statut_validation="a_valider"  # Génère l'alerte sur le Dashboard!
        )

        # 6. Activités Tenerife
        act4 = Activity(
            trip_id=trip.id,
            destination_id=dest_tenerife.id,
            categorie_id=cat_nature.id,
            type_element="activite",
            titre="Téléphérique du Teide & Cratère",
            adresse="Parque Nacional del Teide, Tenerife",
            zone_geo="ouest",
            duree_min=180,
            cout_par_personne=40.0,  # Coût total 2 * 40 = 80 €
            description="Montée au pic du Teide en téléphérique et marche au sommet.",
            source="manuel",
            rating=4.7,
            note_interet=5,
            statut="reserve",
            statut_validation="validee"
        )

        act5 = Activity(
            trip_id=trip.id,
            destination_id=dest_tenerife.id,
            categorie_id=cat_gastro.id,
            type_element="restaurant",
            titre="Dégustation Guachinche El Cubano",
            adresse="La Orotava, Tenerife",
            zone_geo="nord",
            duree_min=90,
            cout_par_personne=25.0,  # Coût total 2 * 25 = 50 €
            description="Restaurant traditionnel canarien au milieu des vignes.",
            source="manuel",
            rating=4.6,
            note_interet=4,
            statut="non_reserve",
            statut_validation="validee"
        )

        act6_pending = Activity(
            trip_id=trip.id,
            destination_id=dest_tenerife.id,
            categorie_id=cat_culture.id,
            type_element="activite",
            titre="Visite guidée de La Orotava",
            adresse="La Orotava, Tenerife",
            zone_geo="nord",
            duree_min=120,
            cout_par_personne=15.0,
            description="Découverte de l'architecture coloniale et des balcons en bois de pin.",
            source="claude_chrome",
            statut_validation="a_valider"  # Deuxième fiche à valider!
        )

        db.add_all([act1, act2, act3_pending, act4, act5, act6_pending])
        db.flush()

        # 7. Images / Documents de couverture
        doc1 = Document(
            activity_id=act1.id,
            type_fichier="photo",
            chemin_fichier="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
            est_principale=1
        )
        doc4 = Document(
            activity_id=act4.id,
            type_fichier="photo",
            chemin_fichier="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
            est_principale=1
        )
        db.add_all([doc1, doc4])

        # 8. Special Block (Location voiture / Frais)
        sb1 = SpecialBlock(
            trip_id=trip.id,
            label="Location Voiture SUV (14 jours)",
            type="personnalise",
            categorie_id=cat_transport.id,
            duree_minutes=0,
            cout=420.0,  # 420 €
            icone="car"
        )
        db.add(sb1)
        db.flush()

        # 9. Créneaux planifiés dans le planning (Planning Slots)
        slot1 = ScheduledSlot(
            trip_id=trip.id,
            activity_id=act1.id,
            jour=2,
            heure_debut=540,   # 09:00
            heure_fin=780,     # 13:00
            type="activite"
        )
        slot2 = ScheduledSlot(
            trip_id=trip.id,
            activity_id=act4.id,
            jour=8,
            heure_debut=600,   # 10:00
            heure_fin=780,     # 13:00
            type="activite"
        )
        db.add_all([slot1, slot2])

        db.commit()
        print("Base de données initialisée avec succès avec le voyage 'Voyage aux Canaries' !")

    except Exception as e:
        db.rollback()
        print(f"Erreur lors du seeding de la base de données : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
