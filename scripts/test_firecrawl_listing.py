"""
Test d'extraction d'une page de listing d'attractions TripAdvisor via Firecrawl.
URL cible : https://www.tripadvisor.fr/Attractions-g187475-Activities-La_Palma_Canary_Islands.html
"""
import os
import sys
import json
import urllib.request
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

def get_api_key():
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("FIRECRAWL_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

def test_listing():
    api_key = get_api_key()
    url = "https://www.tripadvisor.fr/Attractions-g187475-Activities-La_Palma_Canary_Islands.html"
    print(f"Scraping de la page de listing TripAdvisor : {url}")

    endpoint = "https://api.firecrawl.dev/v1/scrape"
    payload = {
        "url": url,
        "formats": ["extract"],
        "extract": {
            "schema": {
                "type": "object",
                "properties": {
                    "destination": {"type": "string", "description": "Nom de la destination"},
                    "attractions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "titre": {"type": "string", "description": "Nom du lieu / attraction"},
                                "categorie": {"type": "string", "description": "Ex: Parcs nationaux, Points de vue, Plages"},
                                "note": {"type": "number", "description": "Note moyenne sur 5"},
                                "nb_avis": {"type": "integer", "description": "Nombre total d'avis"},
                                "photo_url": {"type": "string", "description": "URL de l'image de couverture"},
                                "extrait_avis": {"type": "string", "description": "Court extrait ou résumé d'avis"},
                                "url_detail": {"type": "string", "description": "Lien vers la fiche détaillée TripAdvisor"}
                            },
                            "required": ["titre"]
                        },
                        "description": "Liste des attractions classées de la page"
                    }
                },
                "required": ["attractions"]
            }
        }
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            extract = data.get("data", {}).get("extract", {})
            attractions = extract.get("attractions", [])
            print(f"✅ {len(attractions)} attractions extraites avec succès !")
            for i, a in enumerate(attractions[:8], 1):
                print(f"  {i}. {a.get('titre')} ({a.get('categorie', 'N/A')}) — Note: {a.get('note')} ({a.get('nb_avis')} avis)")
                print(f"     Avis: {a.get('extrait_avis')}")
                print(f"     Lien: {a.get('url_detail')}\n")
            
            # Sauvegarde pour exploitation
            with open("scripts/la_palma_listing_sample.json", "w", encoding="utf-8") as f:
                json.dump(extract, f, indent=2, ensure_ascii=False)
            print("📄 Données sauvegardées dans scripts/la_palma_listing_sample.json")
    except Exception as e:
        print(f"Erreur : {e}")

if __name__ == "__main__":
    test_listing()
