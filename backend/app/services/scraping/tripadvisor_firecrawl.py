"""
Service de scraping pour TripAdvisor via l'API Firecrawl.

Conforme aux règles du projet (GEMINI.md) :
- Règle 5.11 : Cloisonnement strict de la source externe (aucune panne externe ne propage d'erreur non gérée).
- Règle 8 : Code en anglais, commentaires et docstrings en français.
- Règle 6 : Documentation détaillée de chaque fonction non triviale.
"""
import os
import re
import json
import logging
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("odos.scraping.tripadvisor")


def _get_firecrawl_api_key() -> Optional[str]:
    """
    Récupère la clé d'API Firecrawl depuis les variables d'environnement ou le fichier .env.
    """
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if api_key:
        return api_key

    # Recherche manuelle dans le fichier .env si non chargée dans os.environ
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("FIRECRAWL_API_KEY="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception as e:
            logger.warning(f"Erreur lors de la lecture du .env : {e}")
    return None


def _parse_duration_to_minutes(duration_str: Optional[str]) -> Optional[int]:
    """
    Convertit une chaîne textuelle de durée (ex: '1h à 1h30', 'Plus de 3 heures', '45 min') en minutes.
    Prend la borne haute en cas de plage horaire.
    """
    if not duration_str:
        return None
    d_lower = duration_str.lower()

    # 1. Recherche des expressions composites heure + minutes (ex: '1h30', '2h 15', '1h à 1h30')
    compound_matches = re.findall(r'(\d+)\s*h(?:eures?)?\s*(\d{1,2})\b', d_lower)
    if compound_matches:
        compound_mins = [int(h) * 60 + int(m) for h, m in compound_matches]
        return max(compound_mins)

    # 2. Recherche des heures simples (ex: '3 heures', '1h')
    hours_match = re.findall(r'(\d+)\s*(?:h(?:eures?)?)\b', d_lower)
    minutes_match = re.findall(r'(\d+)\s*(?:min(?:utes?)?)\b', d_lower)

    total_minutes = 0
    if hours_match:
        total_minutes += int(hours_match[-1]) * 60
    if minutes_match:
        total_minutes += int(minutes_match[-1])

    if total_minutes > 0:
        return total_minutes

    # 3. Fallbacks usuels
    if "demi-journée" in d_lower or "half day" in d_lower:
        return 240
    if "journée" in d_lower or "full day" in d_lower:
        return 480

    return None



def _map_rating_to_interest(rating: Optional[float]) -> int:
    """
    Convertit une note sur 5 en note d'intérêt ODOS (1 à 5 étoiles).
    """
    if rating is None:
        return 3
    if rating >= 4.6:
        return 5
    if rating >= 4.0:
        return 4
    if rating >= 3.0:
        return 3
    if rating >= 2.0:
        return 2
    return 1


def scrape_tripadvisor_single_activity(url: str) -> Optional[Dict[str, Any]]:
    """
    Scrape une fiche individuelle TripAdvisor via Firecrawl et la convertit au format d'activité ODOS.

    Args:
        url: URL complète de l'attraction sur TripAdvisor.

    Returns:
        Dictionnaire au schéma d'activité ODOS ou None en cas d'échec.
    """
    api_key = _get_firecrawl_api_key()
    if not api_key:
        logger.error("FIRECRAWL_API_KEY absente dans la configuration.")
        return None

    endpoint = "https://api.firecrawl.dev/v1/scrape"
    payload = {
        "url": url,
        "formats": ["extract"],
        "extract": {
            "schema": {
                "type": "object",
                "properties": {
                    "titre": {"type": "string", "description": "Nom officiel de l'attraction"},
                    "description": {"type": "string", "description": "Description détaillée"},
                    "rating": {"type": "number", "description": "Note moyenne sur 5"},
                    "nb_avis": {"type": "integer", "description": "Nombre total d'avis"},
                    "prix_a_partir_de": {"type": "number", "description": "Prix par personne en euros"},
                    "duree_recommandee": {"type": "string", "description": "Durée recommandée"},
                    "adresse": {"type": "string", "description": "Adresse postale"},
                    "horaires": {"type": "string", "description": "Horaires d'ouverture"},
                    "photos": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "URLs directes des photos"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Mots-clés et catégories"
                    },
                    "avis_utilisateurs_synthese": {
                        "type": "string",
                        "description": "Synthèse approfondie et structurée des avis voyageurs en français, organisée en points clés clairs : 1. Astuces pratiques et conseils des voyageurs, 2. Accès et état de la route, 3. Horaires et affluence (meilleur moment), 4. Équipement recommandé et météo, 5. Réservations obligatoires ou points de vigilance."
                    }
                },
                "required": ["titre"]
            }
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=req_data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "ODOS-TravelPlanner/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            if response.getcode() != 200:
                logger.error(f"Firecrawl a répondu avec le code HTTP {response.getcode()}")
                return None

            result = json.loads(response.read().decode("utf-8"))
            data = result.get("data", {})
            extract = data.get("extract", {})

            if not extract.get("titre"):
                logger.warning(f"Aucun titre extrait pour {url}")
                return None

            rating = extract.get("rating")
            duree_str = extract.get("duree_recommandee")
            prix = float(extract.get("prix_a_partir_de") or 0.0)

            # Normalisation vers le schéma ODOS
            activity_dict = {
                "titre": extract.get("titre"),
                "cout_par_personne": prix,
                "duree_min": _parse_duration_to_minutes(duree_str),
                "adresse": extract.get("adresse"),
                "description": extract.get("description"),
                "horaires_ouverture": extract.get("horaires"),
                "url_source": url,
                "lien_avis_tripadvisor": url,
                "avis_utilisateurs": extract.get("avis_utilisateurs_synthese"),
                "source": "scraping_auto",
                "note_interet": _map_rating_to_interest(rating),
                "type_element": "activite",
                "statut": "non_reserve",
                "statut_validation": "a_valider",
                "photos": extract.get("photos", []),
                "tags": extract.get("tags", [])
            }
            return activity_dict

    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Erreur HTTP Firecrawl {e.code} : {err_content}")
        return None
    except Exception as e:
        logger.error(f"Erreur inattendue lors du scraping Firecrawl : {e}")
        return None


def scrape_tripadvisor_destination(
    destination_nom: str,
    limit: int = 10,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    Récupère des suggestions d'activités pour une destination donnée via TripAdvisor & Firecrawl.
    Gère la dégradation douce en cas de panne réseau ou de limite de quota.

    Args:
        destination_nom: Nom de la destination (ex: 'La Palma', 'Rome', 'Tenerife').
        limit: Nombre maximum de fiches à récupérer.
        offset: Décalage pour renouveler les résultats.

    Returns:
        Liste de dictionnaires d'activités prêts pour insertion ODOS.
    """
    # Normalisation du nom de destination
    dest_clean = destination_nom.lower().replace("é", "e").replace("è", "e").strip()

    # 1. Vérification prioritaire dans l'archive locale pérenne (data/tripadvisor_canaries_archive.json)
    # Permet une restitution ultra-rapide, complète et sans consommation de crédits Firecrawl
    archive_path = Path(__file__).resolve().parents[4] / "data" / "tripadvisor_canaries_archive.json"
    if archive_path.exists():
        try:
            with open(archive_path, "r", encoding="utf-8") as f:
                archive_data = json.load(f)
            
            for dest in archive_data.get("destinations", []):
                if dest.get("code", "") in dest_clean or dest.get("nom", "").lower() in dest_clean:
                    acts = dest.get("activites", [])
                    sliced = acts[offset : offset + limit] if offset < len(acts) else acts[:limit]
                    formatted_results = []
                    for item in sliced:
                        # Formatage de la synthèse d'avis détaillée
                        synth = item.get("synthese_avis_detaillee", {})
                        synth_parts = []
                        if synth.get("chiffres_cles"):
                            synth_parts.append(f"📊 {synth['chiffres_cles']}")
                        for pt in synth.get("points_structurants", []):
                            synth_parts.append(f"• **{pt.get('titre')}** : {pt.get('contenu')}")
                        synthese_texte = "\n\n".join(synth_parts) if synth_parts else item.get("presentation_courte")

                        formatted_results.append({
                            "titre": item.get("titre"),
                            "cout_par_personne": float(item.get("cout_par_personne", 0.0)),
                            "duree_min": item.get("duree_conseillee_min"),
                            "adresse": item.get("adresse"),
                            "description": item.get("presentation_courte"),
                            "horaires_ouverture": item.get("horaires_ouverture"),
                            "url_source": item.get("url_tripadvisor"),
                            "lien_avis_tripadvisor": item.get("url_tripadvisor"),
                            "avis_utilisateurs": synthese_texte,
                            "source": "scraping_auto",
                            "note_interet": int(round(item.get("note_globale", 4))),
                            "type_element": "activite",
                            "statut": "non_reserve",
                            "statut_validation": "a_valider",
                            "photos": item.get("photos", []),
                            "tags": item.get("tags", [])
                        })
                    if formatted_results:
                        logger.info(f"Archive locale TripAdvisor : {len(formatted_results)} fiches chargées pour {destination_nom}")
                        return formatted_results
        except Exception as e:
            logger.warning(f"Impossible de lire l'archive locale TripAdvisor : {e}")

    # 2. Si non présent dans l'archive locale complète, tentative d'extraction dynamique des URLs depuis l'archive ou configuration de secours
    api_key = _get_firecrawl_api_key()
    if not api_key:
        logger.warning("Scraping TripAdvisor ignoré : clé API Firecrawl non configurée.")
        return []

    # Extraction des URLs depuis l'archive si disponible
    target_urls = []
    if archive_path.exists():
        try:
            with open(archive_path, "r", encoding="utf-8") as f:
                archive_data = json.load(f)
            for dest in archive_data.get("destinations", []):
                if dest.get("code", "") in dest_clean or dest.get("nom", "").lower() in dest_clean:
                    target_urls = [act.get("url_tripadvisor") for act in dest.get("activites", []) if act.get("url_tripadvisor")]
                    break
        except Exception as e:
            logger.warning(f"Erreur lors de l'extraction des URLs depuis l'archive : {e}")

    # Fallbacks pour destinations internationales sans archive locale (ex: Rome, Paris)
    if not target_urls:
        generic_destinations_map = {
            "rome": [
                "https://www.tripadvisor.fr/Attraction_Review-g187791-d192285-Reviews-Colosseum-Rome_Lazio.html",
                "https://www.tripadvisor.fr/Attraction_Review-g187791-d197700-Reviews-Pantheon-Rome_Lazio.html",
                "https://www.tripadvisor.fr/Attraction_Review-g187791-d190130-Reviews-Trevi_Fountain-Rome_Lazio.html"
            ],
            "paris": [
                "https://www.tripadvisor.fr/Attraction_Review-g187147-d188151-Reviews-Eiffel_Tower-Paris_Ile_de_France.html",
                "https://www.tripadvisor.fr/Attraction_Review-g187147-d188757-Reviews-Louvre_Museum-Paris_Ile_de_France.html"
            ]
        }
        for key, urls in generic_destinations_map.items():
            if key in dest_clean:
                target_urls = urls
                break

    # Si aucune URL pré-référencée
    if not target_urls:
        logger.info(f"Aucune URL pré-référencée pour {destination_nom}")
        return []


    # Découpage des URLs selon offset et limit
    sliced_urls = target_urls[offset : offset + limit] if offset < len(target_urls) else target_urls[:limit]

    results = []
    for url in sliced_urls:
        act = scrape_tripadvisor_single_activity(url)
        if act:
            results.append(act)

    logger.info(f"TripAdvisor Firecrawl : {len(results)} activités extraites pour {destination_nom}")
    return results

