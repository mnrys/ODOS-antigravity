"""
Script de test unitaire pour l'API Firecrawl (Scraping d'une fiche TripAdvisor).
Phase 12 — Étape 1 : Validation de l'accès et inspection des données brutes extraites.

Usage :
    python scripts/test_firecrawl_single.py
"""
import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# Configuration de l'encodage UTF-8 pour la sortie console sous Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Chargement du fichier .env depuis la racine du projet
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

def load_env(env_file):
    """Charge manuellement les variables du .env sans dépendance externe."""
    env_vars = {}
    if not env_file.exists():
        print(f"[ERREUR] Le fichier {env_file} n'existe pas.")
        return env_vars
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                env_vars[key.strip()] = val.strip()
    return env_vars

def test_firecrawl_single(url: str):
    env = load_env(ENV_PATH)
    api_key = env.get("FIRECRAWL_API_KEY")

    if not api_key:
        print("[ERREUR] FIRECRAWL_API_KEY introuvable dans le fichier .env")
        sys.exit(1)

    print(f"[1/4] Clé API Firecrawl détectée : {api_key[:6]}...{api_key[-4:]}")
    print(f"[2/4] URL cible TripAdvisor : {url}")
    print(f"[3/4] Envoi de la requête à https://api.firecrawl.dev/v1/scrape...")

    endpoint = "https://api.firecrawl.dev/v1/scrape"
    payload = {
        "url": url,
        "formats": ["markdown", "extract"],
        "extract": {
            "schema": {
                "type": "object",
                "properties": {
                    "titre": {"type": "string", "description": "Nom officiel de l'attraction ou activité"},
                    "description": {"type": "string", "description": "Description détaillée de l'activité"},
                    "rating": {"type": "number", "description": "Note moyenne sur 5 étoiles (ex: 4.5)"},
                    "nb_avis": {"type": "integer", "description": "Nombre total d'avis voyageurs"},
                    "prix_a_partir_de": {"type": "number", "description": "Prix indicatif par personne en euros"},
                    "duree_recommandee": {"type": "string", "description": "Durée recommandée de la visite (ex: 2 à 3 heures)"},
                    "adresse": {"type": "string", "description": "Adresse postale ou localisation"},
                    "horaires": {"type": "string", "description": "Horaires d'ouverture"},
                    "photos": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "URLs des principales photos de l'attraction"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Catégories ou tags (ex: Monuments, Histoire, Vue panoramique)"
                    },
                    "avis_utilisateurs_synthese": {
                        "type": "string",
                        "description": "Synthèse en 2-3 phrases des points forts et conseils récurrents laissés par les voyageurs"
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
            status = response.getcode()
            response_body = response.read().decode("utf-8")
            result = json.loads(response_body)

            print(f"[4/4] ✅ Réponse reçue avec succès (Code HTTP {status}) !")
            
            # Sauvegarde de l'échantillon brut pour analyse
            output_file = ROOT_DIR / "scripts" / "firecrawl_sample_response.json"
            with open(output_file, "w", encoding="utf-8") as out:
                json.dump(result, out, indent=2, ensure_ascii=False)
            print(f"📄 Données brutes enregistrées dans : {output_file}")

            # Analyse des données extraites
            data = result.get("data", {})
            extract = data.get("extract", {})

            print("\n" + "="*50)
            print("RÉSULTAT DE L'EXTRACTION STRUCTURÉE (TRIPADVISOR)")
            print("="*50)
            print(f"🎯 Titre : {extract.get('titre')}")
            print(f"⭐ Note : {extract.get('rating')} / 5 ({extract.get('nb_avis')} avis)")
            print(f"💰 Prix à partir de : {extract.get('prix_a_partir_de')} €")
            print(f"⏱️ Durée recommandée : {extract.get('duree_recommandee')}")
            print(f"📍 Adresse : {extract.get('adresse')}")
            print(f"🕒 Horaires : {extract.get('horaires')}")
            print(f"🏷️ Tags : {', '.join(extract.get('tags', [])) if extract.get('tags') else 'Aucun'}")
            print(f"📸 Photos extraites : {len(extract.get('photos', []))} trouvée(s)")
            print(f"\n📝 Description :\n{extract.get('description', 'Aucune')[:300]}...")
            print(f"\n💬 Synthèse des avis voyageurs :\n{extract.get('avis_utilisateurs_synthese', 'Aucune')}")
            print("="*50)

            return result

    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        print(f"\n❌ [ERREUR HTTP {e.code}] : {err_msg}")
        return None
    except Exception as e:
        print(f"\n❌ [ERREUR INATTENDUE] : {e}")
        return None

if __name__ == "__main__":
    # Test avec l'Instituto de Astrofísica de Canarias (La Palma - Attraction gratuite/scientifique)
    sample_url = "https://www.tripadvisor.com/Attraction_Review-g187475-d1800798-Reviews-Instituto_de_Astrofisica_de_Canarias-La_Palma_Canary_Islands.html"
    test_firecrawl_single(sample_url)

