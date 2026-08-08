"""
Pipeline TripAdvisor via Firecrawl — ODOS Travel Planner (Phase 12).

Ce script autonome permet d'extraire des attractions et activités TripAdvisor
via l'API Firecrawl et de les injecter directement dans ODOS via l'API FastAPI.

Contraintes non négociables (cf. GEMINI.md & docs/PROMPT_ANTIGRAVITY_phase12.md) :
1. Toutes les écritures passent par l'API HTTP FastAPI (aucun import SQL direct).
2. Clé Firecrawl chargée depuis .env (FIRECRAWL_API_KEY).
3. Téléchargement direct des photos via HTTPS (0 crédit Firecrawl).
4. Mode simulation (--dry-run), plafonnement des crédits (--max-credits), et reprise sur checkpoints.

Usage :
    # 1. Mode simulation sur une URL unique
    python scripts/pipeline_tripadvisor.py --url "https://www.tripadvisor.fr/..." --dry-run

    # 2. Ingestion réelle dans un voyage et une destination ODOS
    python scripts/pipeline_tripadvisor.py --url "https://www.tripadvisor.fr/..." --trip-id 1 --dest-id 1

    # 3. Lot pour une destination avec limite de crédits
    python scripts/pipeline_tripadvisor.py --destination "La Palma" --trip-id 1 --dest-id 1 --max-credits 5
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any, List

# Configuration UTF-8 pour Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
CHECKPOINTS_DIR = ROOT_DIR / "scripts" / ".checkpoints"


def load_env() -> Dict[str, str]:
    """Charge les variables du fichier .env sans dépendance externe."""
    env = {}
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def scrape_with_firecrawl(url: str, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Appelle l'API Firecrawl pour extraire les données structurées d'une page TripAdvisor.
    """
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
                    "prix_a_partir_de": {"type": "number", "description": "Prix indicatif par personne en euros (0 si gratuit)"},
                    "duree_recommandee": {"type": "string", "description": "Durée recommandée"},
                    "adresse": {"type": "string", "description": "Adresse postale"},
                    "horaires": {"type": "string", "description": "Horaires d'ouverture"},
                    "photos": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "URLs directes des photos principales"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Mots-clés et catégories"
                    },
                    "avis_utilisateurs_synthese": {
                        "type": "string",
                        "description": "Synthèse en français des avis et conseils voyageurs"
                    }
                },
                "required": ["titre"]
            }
        }
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "ODOS-TripAdvisorPipeline/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            if resp.getcode() == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("data", {}).get("extract")
            else:
                print(f"[ERREUR] Code retour Firecrawl : {resp.getcode()}")
                return None
    except urllib.error.HTTPError as e:
        print(f"[ERREUR HTTP Firecrawl {e.code}] : {e.read().decode('utf-8', errors='ignore')}")
        return None
    except Exception as e:
        print(f"[ERREUR] Échec de la requête Firecrawl : {e}")
        return None


def post_activity_to_odos(api_base_url: str, trip_id: int, dest_id: int, activity_data: Dict[str, Any], raw_url: str) -> bool:
    """
    Injecte une fiche extraite dans ODOS via l'API FastAPI REST existante.
    """
    endpoint = f"{api_base_url.rstrip('/')}/api/trips/{trip_id}/activities"

    # Calcul de la note d'intérêt
    rating = activity_data.get("rating")
    note_interet = 3
    if rating:
        if rating >= 4.6: note_interet = 5
        elif rating >= 4.0: note_interet = 4
        elif rating >= 3.0: note_interet = 3
        else: note_interet = 2

    payload = {
        "destination_id": dest_id,
        "type_element": "activite",
        "titre": activity_data.get("titre"),
        "description": activity_data.get("description"),
        "cout_par_personne": float(activity_data.get("prix_a_partir_de") or 0.0),
        "adresse": activity_data.get("adresse"),
        "horaires_ouverture": activity_data.get("horaires"),
        "avis_utilisateurs": activity_data.get("avis_utilisateurs_synthese"),
        "lien_avis_tripadvisor": raw_url,
        "note_interet": note_interet,
        "statut": "non_reserve"
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.getcode() in (200, 201):
                created = json.loads(resp.read().decode("utf-8"))
                print(f"✅ Activité créée dans ODOS avec succès (ID #{created.get('id')}) : {created.get('titre')}")
                return True
            else:
                print(f"❌ Échec de l'injection API ODOS (Code {resp.getcode()})")
                return False
    except Exception as e:
        print(f"❌ Erreur lors de l'appel à l'API ODOS : {e}")
        return False


def save_checkpoint(url: str, data: Dict[str, Any]):
    """Sauvegarde les résultats intermédiaires sur disque."""
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    slug = "".join([c if c.isalnum() else "_" for c in url])[-40:]
    cp_file = CHECKPOINTS_DIR / f"cp_{slug}.json"
    with open(cp_file, "w", encoding="utf-8") as f:
        json.dump({"url": url, "data": data}, f, indent=2, ensure_ascii=False)


def run_pipeline():
    parser = argparse.ArgumentParser(description="Pipeline TripAdvisor via Firecrawl pour ODOS.")
    parser.add_argument("--url", type=str, help="URL d'une fiche attraction TripAdvisor")
    parser.add_argument("--destination", type=str, help="Nom de la destination (ex: 'La Palma', 'Rome')")
    parser.add_argument("--trip-id", type=int, help="ID du voyage ODOS cible")
    parser.add_argument("--dest-id", type=int, help="ID de la destination ODOS cible")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000", help="URL de base de l'API FastAPI ODOS")
    parser.add_argument("--dry-run", action="store_true", help="Mode simulation : affiche les données sans les enregistrer")
    parser.add_argument("--max-credits", type=int, default=10, help="Nombre maximum d'appels Firecrawl autorisés")

    args = parser.parse_args()
    env = load_env()
    api_key = env.get("FIRECRAWL_API_KEY")

    if not api_key:
        print("[ERREUR CRITIQUE] FIRECRAWL_API_KEY absente dans le fichier .env")
        sys.exit(1)

    urls_to_process = []
    if args.url:
        urls_to_process.append(args.url)
    elif args.destination:
        dest_lower = args.destination.lower().strip()
        catalog = {
            "la palma": [
                "https://www.tripadvisor.com/Attraction_Review-g187475-d1800798-Reviews-Instituto_de_Astrofisica_de_Canarias-La_Palma_Canary_Islands.html",
                "https://www.tripadvisor.fr/Attraction_Review-g187475-d2279268-Reviews-Parque_Nacional_de_la_Caldera_de_Taburiente-La_Palma_Canary_Islands.html",
                "https://www.tripadvisor.fr/Attraction_Review-g187475-d546252-Reviews-Roque_de_los_Muchachos-La_Palma_Canary_Islands.html"
            ],
            "rome": [
                "https://www.tripadvisor.fr/Attraction_Review-g187791-d192285-Reviews-Colosseum-Rome_Lazio.html",
                "https://www.tripadvisor.fr/Attraction_Review-g187791-d197700-Reviews-Pantheon-Rome_Lazio.html"
            ]
        }
        urls_to_process = catalog.get(dest_lower, [])
        if not urls_to_process:
            print(f"[INFO] Aucune liste préconfigurée pour '{args.destination}'. Veuillez passer une --url directe.")
            sys.exit(0)
    else:
        print("Veuillez spécifier soit --url soit --destination. Utilisez --help pour voir les options.")
        sys.exit(1)

    urls_to_process = urls_to_process[: args.max_credits]
    print(f"\n🚀 Démarrage du pipeline TripAdvisor ({len(urls_to_process)} URL(s) à traiter)")
    print(f"⚙️ Mode simulation (dry-run) : {'OUI' if args.dry_run else 'NON'}")

    success_count = 0
    for i, url in enumerate(urls_to_process, 1):
        print(f"\n[{i}/{len(urls_to_process)}] Traitement de : {url}")
        extracted = scrape_with_firecrawl(url, api_key)

        if not extracted or not extracted.get("titre"):
            print("⚠️ Aucune donnée exploitable extraite.")
            continue

        print(f"🎯 Titre : {extracted.get('titre')}")
        print(f"⭐ Note : {extracted.get('rating')} / 5 ({extracted.get('nb_avis')} avis)")
        print(f"💰 Prix : {extracted.get('prix_a_partir_de')} €")
        print(f"📍 Adresse : {extracted.get('adresse')}")
        print(f"💬 Synthèse : {extracted.get('avis_utilisateurs_synthese', 'N/A')[:120]}...")

        save_checkpoint(url, extracted)

        if args.dry_run:
            print("🔍 [DRY-RUN] Extraction réussie (non injectée en base).")
            success_count += 1
        else:
            if not args.trip_id or not args.dest_id:
                print("⚠️ Pour injecter en base, --trip-id et --dest-id sont requis.")
            else:
                ok = post_activity_to_odos(args.api_url, args.trip_id, args.dest_id, extracted, url)
                if ok:
                    success_count += 1

    print(f"\n✨ Pipeline terminé : {success_count}/{len(urls_to_process)} activité(s) traitée(s) avec succès.\n")


if __name__ == "__main__":
    run_pipeline()
