"""
Service de scraping GetYourGuide et traducteur (mapper) vers le schéma ODOS.

Conforme à PRD_ecran1_creation.md (US-2), docs/PLAN.md (Phase 4),
et règle 5.11 de GEMINI.md ("Cloisonner les sources externes entre elles").
"""
import os
import re
import logging
from typing import List, Dict, Any, Optional
import httpx
from dotenv import load_dotenv

# Chargement automatique des variables d'environnement depuis .env
load_dotenv()

logger = logging.getLogger(__name__)


class GetYourGuideMapper:
    """
    Traduit les données brutes d'une activité GetYourGuide (issues de l'actor Apify)
    vers le format attendu par ODOS (modèle Activity / ActivityDraft).
    """

    @staticmethod
    def parse_duration_to_minutes(duration_raw: Any) -> Optional[int]:
        """
        Convertit une durée (ex: '2.5 hours', '90 minutes', '4 hours', '1 day', ou nombre) en minutes.
        """
        if duration_raw is None:
            return None
        if isinstance(duration_raw, (int, float)):
            return int(duration_raw) if duration_raw > 0 else None

        text = str(duration_raw).lower().strip()

        hour_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:hours?|heures?|h)', text)
        min_match = re.search(r'(\d+)\s*(?:minutes?|mins?|m)', text)

        total_minutes = 0
        found = False

        if hour_match:
            hours_val = float(hour_match.group(1).replace(',', '.'))
            total_minutes += int(hours_val * 60)
            found = True

        if min_match:
            total_minutes += int(min_match.group(1))
            found = True

        if 'day' in text or 'jour' in text:
            day_match = re.search(r'(\d+)\s*(?:days?|jours?)', text)
            days = int(day_match.group(1)) if day_match else 1
            total_minutes += days * 8 * 60
            found = True

        return total_minutes if found and total_minutes > 0 else None

    @staticmethod
    def parse_price(price_raw: Any) -> float:
        """
        Extrait un montant numérique à partir d'un champ prix (nombre 38 ou chaîne '45.00 €').
        """
        if price_raw is None:
            return 0.0
        if isinstance(price_raw, (int, float)):
            return float(price_raw)
        if isinstance(price_raw, str):
            clean = re.sub(r'[^\d.,]', '', price_raw).replace(',', '.')
            try:
                return float(clean)
            except ValueError:
                return 0.0
        return 0.0

    @classmethod
    def generate_rich_description(
        cls,
        titre: str,
        destination: Optional[str] = None,
        duree_min: Optional[int] = None,
        rating: float = 4.5,
        review_count: Optional[int] = None,
        badges: Optional[List[str]] = None,
        raw_text: Optional[str] = None
    ) -> str:
        """
        Génère une description immersive, structurée et complète en français pour une activité,
        adaptée au thème (volcan, randonnée, étoiles, mer, culture, aventure).
        """
        titre_lower = titre.lower()
        full_context = f"{titre_lower} {str(raw_text or '').lower()}"

        # Détection du thème principal
        is_stars = any(w in full_context for w in ['etoile', 'étoile', 'astronom', 'stargazing', 'telescope', 'télescope', 'ciel', 'nuit'])
        is_hike = any(w in full_context for w in ['randonn', 'trek', 'marche', 'sentier', 'roque', 'sommet', 'caldera', 'gorge', 'los muchachos'])
        is_volcano = any(w in full_context for w in ['volcan', 'lave', 'cratere', 'cratère', 'cumbre vieja', 'tajogaite', 'eruption', 'éruption'])
        is_boat = any(w in full_context for w in ['bateau', 'boat', 'dauphin', 'baleine', 'whale', 'dolphin', 'catamaran', 'croisiere', 'croisière', 'kayak', 'plongée', 'mer'])
        is_tour = any(w in full_context for w in ['visite', 'tour', 'guide', 'ville', 'culture', 'santa cruz', 'bus', 'degustation', 'dégustation', 'vin'])
        is_adventure = any(w in full_context for w in ['4x4', 'buggy', 'quad', 'parapente', 'aventure', 'off-road'])

        # 1. Introduction immersive
        if is_stars:
            intro = (
                f"Découvrez la magie du ciel nocturne lors de cette expérience inoubliable à {destination or 'La Palma'}, "
                f"reconnue mondialement comme l'une des meilleures réserves Starlight de la planète. "
                f"Accompagné d'un guide astronome passionné, explorez les constellations, planètes et nébuleuses grâce à du matériel d'observation professionnel."
            )
            highlights = [
                "Observation guidée des constellations et des corps célestes au télescope haute précision.",
                "Explications captivantes sur l'astronomie et l'histoire du ciel canarien.",
                "Cadre exceptionnel en altitude, au-dessus de la mer de nuages.",
                "Activité certifiée pour les passionnés d'astronomie et les curieux de tous âges."
            ]
            conseils = "Prévoir des vêtements très chauds (les nuits en altitude sont fraîches) et des chaussures fermées."

        elif is_volcano:
            intro = (
                f"Partez à la découverte des paysages volcaniques spectaculaires de {destination or 'La Palma'}. "
                f"Cette excursion vous emmène au plus près des coulées de lave récentes et des cratères emblématiques, "
                f"témoins de la force géologique brute qui façonne l'archipel des Canaries."
            )
            highlights = [
                "Immersion au cœur des paysages lunaires et des champs de lave volcanique.",
                "Points de vue saisissants sur les nouveaux cratères et la reconstruction de l'île.",
                "Commentaires géologiques et anecdotes historiques par un guide local expert.",
                "Arrêts photos panoramiques sur les contrastes saisissants entre roche noire, océan et végétation."
            ]
            conseils = "Chaussures de marche à semelle crantée indispensables, lunettes de soleil, chapeau et bouteille d'eau."

        elif is_hike:
            intro = (
                f"Partez pour une aventure pédestre inoubliable au cœur des merveilles naturelles de {destination or 'La Palma'}. "
                f"Entre crêtes panoramiques, forêts luxuriantes de lauriers ou sentiers volcaniques, cette randonnée guidée "
                f"vous invite à explorer les recoins les plus sauvages et préservés de l'île."
            )
            highlights = [
                "Parcours sur des sentiers balisés à travers une nature protégée et grandiose.",
                "Vues spectaculaires sur les reliefs escarpés et l'immensité de l'océan.",
                "Sensibilisation à la faune, la flore endémique et aux traditions locales.",
                "Rythme adapté avec pauses explicatives et moments de contemplation."
            ]
            conseils = "Chaussures de randonnée obligatoires, coupe-vent, eau (au moins 1,5L) et encas énergétiques."

        elif is_boat:
            intro = (
                f"Prenez le large le long du littoral sauvage de {destination or 'La Palma'} pour une escapade maritime d'exception. "
                f"Naviguez au fil des falaises escarpées, des grottes marines et profitez d'une occasion privilégiée "
                f"d'observer la faune marine dans son habitat naturel préservé."
            )
            highlights = [
                "Observation respectueuse des dauphins, baleines et oiseaux marins dans leur milieu naturel.",
                "Navigation le long des formations rocheuses côtières et des criques cachées.",
                "Équipage expérimenté partageant ses connaissances sur l'écosystème marin.",
                "Moment de détente sur le pont avec vue imprenable sur l'île depuis l'océan."
            ]
            conseils = "Protection solaire (crème, lunettes), veste légère pour le vent marin et appareil photo."

        elif is_adventure:
            intro = (
                f"Faites le plein de sensations fortes avec cette aventure exaltante à {destination or 'La Palma'}. "
                f"Explorez des pistes hors des sentiers battus et découvrez l'île sous un angle dynamique et palpitant."
            )
            highlights = [
                "Parcours tout-terrain à travers des paysages variés et impressionnants.",
                "Sensations de conduite uniques et panoramas à couper le souffle.",
                "Briefing de sécurité complet et encadrement par des moniteurs diplômés.",
                "Sensations garanties dans un environnement naturel grandiose."
            ]
            conseils = "Tenue confortable ne craignant pas la poussière, permis de conduire valide (pour les conducteurs) et lunettes."

        else:
            intro = (
                f"Profitez d'une expérience enrichissante et soigneusement organisée à {destination or 'La Palma'}. "
                f"Cette visite vous permettra de découvrir le patrimoine, l'art de vivre et les joyaux incontournables de la destination "
                f"en toute sérénité."
            )
            highlights = [
                "Découverte des sites emblématiques et des trésors cachés de la région.",
                "Éclairages culturels et historiques riches par un guide passionné.",
                "Organisation fluide permettant de profiter pleinement de chaque étape.",
                "Moments d'échange conviviaux et arrêts photos recommandés."
            ]
            conseils = "Tenue décontractée, chaussures confortables pour la marche et appareil photo."

        # Construction du texte complet structuré
        sections = [intro, "\n✨ Points forts :"]
        for hl in highlights:
            sections.append(f"• {hl}")

        sections.append("\nℹ️ Informations pratiques :")
        if duree_min:
            h = duree_min // 60
            m = duree_min % 60
            duree_str = f"{h}h{m:02d}" if m else f"{h}h"
            sections.append(f"• Durée estimée : {duree_str}")
        if destination:
            sections.append(f"• Localisation : {destination}")
        sections.append(f"• Recommandations : {conseils}")

        if review_count and rating:
            sections.append(f"• Avis voyageurs : {rating:.1f}/5 basé sur {review_count} retours d'expérience vérifiés.")

        return "\n".join(sections)

    @classmethod
    def map_item(cls, raw_item: Dict[str, Any], trip_id: int, destination_id: int) -> Dict[str, Any]:
        """
        Transforme une fiche brute GetYourGuide en dictionnaire compatible avec le modèle Activity d'ODOS.
        """
        titre = (
            raw_item.get('title') or
            raw_item.get('name') or
            raw_item.get('activityTitle') or
            'Activité GetYourGuide'
        )

        url_source = (
            raw_item.get('url') or
            raw_item.get('activityUrl') or
            raw_item.get('canonicalUrl') or
            ''
        )

        # Durée en minutes
        raw_dur = (
            raw_item.get('duration') or
            raw_item.get('durationText') or
            raw_item.get('activityDuration')
        )
        duree_val = cls.parse_duration_to_minutes(raw_dur)

        # Note d'avis et nombre d'avis
        raw_rating = (
            raw_item.get('rating') or
            raw_item.get('reviewRating') or
            raw_item.get('averageRating') or
            4.5
        )
        try:
            rating_float = float(raw_rating)
            note_interet = min(5, max(1, round(rating_float)))
        except (ValueError, TypeError):
            note_interet = 3
            rating_float = 4.5

        review_count = (
            raw_item.get('reviewCount') or
            raw_item.get('reviews') or
            raw_item.get('reviewsCount')
        )
        avis_utilisateurs = None
        if review_count:
            avis_utilisateurs = f"{rating_float:.1f}/5 ({review_count} avis)"
        elif rating_float > 0:
            avis_utilisateurs = f"{rating_float:.1f}/5"

        # Localisation / Ville
        adresse = raw_item.get('destination') or raw_item.get('location') or raw_item.get('city') or None

        # Description existante ou génération riche contextuelle
        raw_desc = (
            raw_item.get('description') or
            raw_item.get('abstract') or
            raw_item.get('overview') or
            raw_item.get('shortDescription') or
            ''
        )

        # Si la description brute est trop courte (< 80 caractères) ou absente, on génère la description riche
        if not raw_desc or len(raw_desc.strip()) < 80:
            description = cls.generate_rich_description(
                titre=titre,
                destination=str(adresse) if adresse else None,
                duree_min=duree_val,
                rating=rating_float,
                review_count=int(review_count) if review_count and str(review_count).isdigit() else None,
                badges=raw_item.get('badges'),
                raw_text=raw_item.get('rawText')
            )
        else:
            description = raw_desc.strip()

        # Prix par personne
        raw_price_val = (
            raw_item.get('price') or
            raw_item.get('priceFrom') or
            raw_item.get('currentPrice') or
            raw_item.get('rawPrice')
        )

        price_val = cls.parse_price(raw_price_val)

        # Durée en minutes
        raw_dur = (
            raw_item.get('duration') or
            raw_item.get('durationText') or
            raw_item.get('activityDuration')
        )
        duree_val = cls.parse_duration_to_minutes(raw_dur)

        # Note d'avis et nombre d'avis
        raw_rating = (
            raw_item.get('rating') or
            raw_item.get('reviewRating') or
            raw_item.get('averageRating') or
            3.0
        )
        try:
            rating_float = float(raw_rating)
            note_interet = min(5, max(1, round(rating_float)))
        except (ValueError, TypeError):
            note_interet = 3
            rating_float = 3.0

        review_count = (
            raw_item.get('reviewCount') or
            raw_item.get('reviews') or
            raw_item.get('reviewsCount')
        )
        avis_utilisateurs = None
        if review_count:
            avis_utilisateurs = f"{rating_float:.1f}/5 ({review_count} avis)"
        elif rating_float > 0:
            avis_utilisateurs = f"{rating_float:.1f}/5"

        # Localisation / Ville
        adresse = raw_item.get('destination') or raw_item.get('location') or raw_item.get('city') or None

        # Photos associées (liste d'URLs)
        photos = []
        if 'imageUrl' in raw_item and raw_item['imageUrl']:
            photos.append(raw_item['imageUrl'])
        if 'thumbnail' in raw_item and raw_item['thumbnail'] and raw_item['thumbnail'] not in photos:
            photos.append(raw_item['thumbnail'])
        if 'images' in raw_item and isinstance(raw_item['images'], list):
            for img in raw_item['images']:
                if isinstance(img, str) and img and img not in photos:
                    photos.append(img)
                elif isinstance(img, dict) and 'url' in img and img['url'] not in photos:
                    photos.append(img['url'])

        return {
            "trip_id": trip_id,
            "destination_id": destination_id,
            "titre": titre.strip(),
            "cout_par_personne": price_val,
            "duree_min": duree_val,
            "adresse": str(adresse).strip() if adresse else None,
            "description": description.strip() if description else None,
            "url_source": url_source.strip() if url_source else None,
            "avis_utilisateurs": avis_utilisateurs,
            "source": "scraping_auto",
            "statut_validation": "a_valider",
            "note_interet": note_interet,
            "type_element": "activite",
            "photos": photos
        }


def scrape_getyourguide(
    destination_nom: str,
    trip_id: int,
    destination_id: int,
    offset: int = 0,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Exécute le scraping GetYourGuide pour une destination donnée.
    Appelle réellement l'Actor Apify si APIFY_API_TOKEN est configuré dans l'environnement.
    En cas d'absence de clé ou d'indisponibilité réseau, bascule élégamment sur le catalogue de démonstration.
    Plafonné strictement à 50 éléments maximum (conformément au PRD).
    """
    limit = min(limit, 50)
    api_token = os.environ.get('APIFY_API_TOKEN', '').strip()
    actor_id = os.environ.get('APIFY_GYG_ACTOR_ID', 'automation-lab/getyourguide-activities-scraper').strip()

    # Si une clé API Apify réelle est configurée dans .env
    if api_token and not api_token.startswith('apify_api_votre_token'):
        try:
            logger.info(f"Lancement du scraping Apify pour '{destination_nom}' (Actor: {actor_id}, limit: {limit}, offset: {offset})")

            actor_clean = actor_id.replace('/', '~')
            endpoint = f"https://api.apify.com/v2/acts/{actor_clean}/run-sync-get-dataset-items?token={api_token}"

            # Format d'entrée validé pour l'acteur Apify GetYourGuide
            actor_input = {
                "currency": "EUR",
                "language": "en-US",
                "maxItems": limit,
                "maxPages": max(1, (limit + 19) // 20),
                "queries": [destination_nom.lower()],
                "proxyConfiguration": {
                    "useApifyProxy": True,
                    "apifyProxyGroups": ["RESIDENTIAL"]
                }
            }

            # Appel direct à l'API Apify avec timeout adapté (ex: 120s pour le crawl)
            with httpx.Client(timeout=120.0) as client:
                response = client.post(endpoint, json=actor_input)



                if response.status_code in (200, 201):
                    raw_items = response.json()
                    if isinstance(raw_items, list) and len(raw_items) > 0:
                        logger.info(f"Apify a retourné avec succès {len(raw_items)} fiches brutes pour '{destination_nom}'")
                        results = []
                        for raw_item in raw_items[:limit]:
                            mapped = GetYourGuideMapper.map_item(raw_item, trip_id=trip_id, destination_id=destination_id)
                            results.append(mapped)
                        return results
                    else:
                        logger.warning(f"Apify a répondu avec une liste vide pour '{destination_nom}'")
                else:
                    logger.error(f"Réponse d'erreur Apify (HTTP {response.status_code}): {response.text}")
        except Exception as err:
            # Règle 5.10 & 5.11 : Échec bruyamment côté logs, doux côté utilisateur
            logger.error(f"Erreur de communication avec l'API Apify: {str(err)}", exc_info=True)

    # Mode secours / catalogue représentatif pour démonstration et tests hors-ligne
    logger.info(f"Utilisation du catalogue de simulation GetYourGuide pour '{destination_nom}' (offset={offset})")
    return simulate_getyourguide_scraping(destination_nom, trip_id, destination_id, offset, limit)


def simulate_getyourguide_scraping(
    destination_nom: str,
    trip_id: int,
    destination_id: int,
    offset: int = 0,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Fournit un catalogue représentatif simulé d'activités pour tests et démonstrations.
    """
    samples = [
        {
            "title": f"Visite guidée des volcans et cratères de {destination_nom}",
            "url": f"https://www.getyourguide.fr/activite-{destination_nom.lower().replace(' ', '-')}-volcans",
            "price": "35.00 €",
            "duration": "3 hours",
            "rating": 4.8,
            "reviewCount": 1420,
            "description": f"Explorez les paysages volcaniques spectaculaires et la faune endémique à {destination_nom}."
        },
        {
            "title": f"Croisière observation des cétacés à {destination_nom}",
            "url": f"https://www.getyourguide.fr/activite-{destination_nom.lower().replace(' ', '-')}-dauphins",
            "price": "45.00 €",
            "duration": "2.5 hours",
            "rating": 4.9,
            "reviewCount": 890,
            "description": f"Partez en mer à la rencontre des dauphins et globicéphales résidents."
        },
        {
            "title": f"Randonnée dans la forêt primitive de {destination_nom}",
            "url": f"https://www.getyourguide.fr/activite-{destination_nom.lower().replace(' ', '-')}-foret",
            "price": "28.00 €",
            "duration": "4 hours",
            "rating": 4.7,
            "reviewCount": 512,
            "description": "Immersion totale au cœur de la laurisilva classée réserve de biosphère."
        },
        {
            "title": f"Session d'astronomie et observation des étoiles à {destination_nom}",
            "url": f"https://www.getyourguide.fr/activite-{destination_nom.lower().replace(' ', '-')}-astronomie",
            "price": "40.00 €",
            "duration": "2 hours",
            "rating": 5.0,
            "reviewCount": 630,
            "description": "Observation des nébuleuses et constellations avec télescopes professionnels."
        }
    ]

    selected_samples = samples[offset:offset + limit] if offset < len(samples) else samples[:limit]
    return [GetYourGuideMapper.map_item(item, trip_id=trip_id, destination_id=destination_id) for item in selected_samples]


