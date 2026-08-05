# Travel Planner App — Cahier des charges complet
> Document de référence généré le 10 juillet 2026  
> À uploader dans le Projet Claude "Travel Planner App"

---

## 1. Vision du projet

Application web de planification de voyages à double panneau :
- **Panneau gauche** : planning calendrier drag & drop (agenda par jour, créneaux 15 min)
- **Panneau droit** : catalogue d'activités sous forme de fiches (style GetYourGuide)

L'utilisateur pioche des activités dans le catalogue et les glisse dans l'agenda. Un agent IA (Dify) suggère des activités, enrichit les fiches et optimise le planning.

**Cas d'usage principal** : Toto, dentiste à Agadir, planifie un voyage aux Canaries (La Palma + Tenerife, groupe de 4, août–septembre 2026).

---

## 2. Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Backend | FastAPI (Python) | API REST, logique métier |
| Base de données | SQLite + SQLAlchemy | Persistance locale |
| Frontend | React 18 + Tailwind CSS | Interface utilisateur |
| Drag & Drop | dnd-kit | Glisser-déposer + étirement |
| Agent IA | Dify (4 workflows) | Suggestions, enrichissement, chat |
| Thumbnails | GYG → Unsplash → Dify → Placeholder | Cascade automatique |
| Déploiement | Local (dev) | Poste utilisateur |

---

## 3. Architecture du projet

```
travel-planner/
├── backend/
│   ├── main.py                  ← FastAPI app + CORS
│   ├── database.py              ← SQLite init + session
│   ├── models.py                ← SQLAlchemy models
│   ├── routers/
│   │   ├── trips.py
│   │   ├── activities.py
│   │   ├── planning.py
│   │   ├── categories.py
│   │   ├── layouts.py
│   │   └── ai.py
│   ├── services/
│   │   ├── dify_service.py      ← appels Dify
│   │   ├── thumbnail_service.py ← cascade images
│   │   └── conflict_service.py  ← détection conflits + alternatives
│   ├── .env
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── PlanningCalendar.jsx    ← grille + dnd
│   │   │   ├── PlanningBlock.jsx       ← bloc activité dans le planning
│   │   │   ├── ActivityPanel.jsx       ← panneau droit (fiches + liste)
│   │   │   ├── ActivityCard.jsx        ← fiche style GYG
│   │   │   ├── CardLayout.jsx          ← mode cartes à jouer
│   │   │   ├── ActivityModal.jsx       ← panneau coulissant édition
│   │   │   ├── SpecialBlocks.jsx       ← repas / trajet / pause
│   │   │   ├── BudgetBar.jsx           ← compteur budget par jour
│   │   │   ├── TimelineBar.jsx         ← mini-vue tous les jours en haut
│   │   │   ├── ChatPanel.jsx           ← Q&A Dify escamotable
│   │   │   └── ConflictToast.jsx       ← alerte conflit + alternatives
│   │   ├── services/
│   │   │   └── api.js                  ← appels FastAPI
│   │   └── hooks/
│   │       ├── useUndoRedo.js
│   │       └── useZoom.js
│   └── package.json
└── README.md
```

---

## 4. Base de données — Modèles complets

### 4.1 trips
```sql
id                    INTEGER PRIMARY KEY
nom                   TEXT NOT NULL
destination           TEXT NOT NULL
date_debut            DATE NOT NULL
nb_jours              INTEGER NOT NULL
budget_total          REAL DEFAULT 0
planning_heure_debut  INTEGER DEFAULT 420   -- 07:00 en minutes
planning_heure_fin    INTEGER DEFAULT 1380  -- 23:00 en minutes
share_token           TEXT UNIQUE
created_at            DATETIME DEFAULT NOW
```
> Les heures sont stockées en **minutes depuis minuit** (ex: 480 = 08:00, 570 = 09:30)

### 4.2 activities
```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
titre                 TEXT NOT NULL
lieu                  TEXT
categorie_id          INTEGER FK → categories.id
duree_min             INTEGER    -- minutes (ex: 120 = 2h)
duree_max             INTEGER    -- minutes (optionnel)
cout                  REAL DEFAULT 0
description           TEXT
thumbnail_url         TEXT
horaires_ouverture    TEXT (JSON)  -- [{"j":"lun-ven","o":"09:00","f":"18:00"}]
jours_fermeture       TEXT (JSON)  -- ["lundi","mardi"]
source                TEXT DEFAULT 'manuel'  -- 'auto' | 'manuel'
remarques             TEXT
rating                REAL
statut                TEXT DEFAULT 'non_reserve'
                      -- 'non_reserve'|'en_cours'|'reserve'|'action_requise'|'annule'
url_source            TEXT    -- lien vers la page d'origine
url_reservation       TEXT    -- lien direct de réservation/paiement
completude            INTEGER DEFAULT 0  -- score 0-100
tripadvisor_consulte  INTEGER DEFAULT 0  -- 0=non, 1=oui
galerie_photos        TEXT (JSON)  -- liste d'URLs (2 photos)
created_at            DATETIME DEFAULT NOW
```

### 4.3 scheduled_slots
```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
activity_id           INTEGER FK → activities.id (nullable pour blocs spéciaux)
special_block_id      INTEGER FK → special_blocks.id (nullable)
jour                  INTEGER NOT NULL  -- 1..N (numéro du jour du voyage)
heure_debut           INTEGER NOT NULL  -- minutes depuis minuit
heure_fin             INTEGER NOT NULL  -- minutes depuis minuit
type                  TEXT DEFAULT 'activite'
                      -- 'activite'|'repas'|'trajet'|'pause'
verrouille            INTEGER DEFAULT 0  -- 0=libre|1=souple|2=fort
couleur_override      TEXT    -- couleur hex optionnelle (override catégorie)
```

### 4.4 categories
```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id (NULL = catégorie système globale)
nom                   TEXT NOT NULL
couleur               TEXT NOT NULL  -- hex, ex: "#22c55e"
icone                 TEXT           -- emoji ou nom icône
ordre                 INTEGER DEFAULT 0
est_systeme           INTEGER DEFAULT 0  -- 1 = non supprimable
```

**Catégories système par défaut (insérées à l'init) :**
```
Nature      🟩 #22c55e
Culture     🟦 #3b82f6
Gastronomie 🟨 #eab308
Logistique  🟥 #ef4444
Détente     🟪 #a855f7
```

### 4.5 card_layouts
```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
nom                   TEXT NOT NULL  -- ex: "Randonnées", "Priorités"
disposition           TEXT (JSON)
  -- {
  --   "activity_id": {
  --     "x": 120, "y": 340, "z_index": 5
  --   }, ...
  -- }
est_initiale          INTEGER DEFAULT 0  -- 1 = disposition de référence
created_at            DATETIME DEFAULT NOW
```

### 4.6 special_blocks
```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
label                 TEXT NOT NULL   -- "Déjeuner", "Trajet aéroport", "Pause"
type                  TEXT NOT NULL   -- 'repas'|'trajet'|'pause'
duree_minutes         INTEGER DEFAULT 60
cout                  REAL DEFAULT 0
icone                 TEXT            -- emoji
couleur               TEXT            -- hex
```

### 4.7 share_tokens
```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
token                 TEXT UNIQUE NOT NULL  -- UUID
created_at            DATETIME DEFAULT NOW
expires_at            DATETIME
```

---

## 5. Backend FastAPI — Routes complètes

### Voyages
```
POST   /trips                    Créer un voyage
GET    /trips                    Liste tous les voyages
GET    /trips/{id}               Détail + activités + slots
PUT    /trips/{id}               Modifier (dates, budget, plage horaire)
DELETE /trips/{id}               Supprimer
POST   /trips/{id}/share         Générer token partage → URL lecture seule
GET    /share/{token}            Lecture seule publique
```

### Activités
```
GET    /trips/{id}/activities    Liste activités du voyage
POST   /trips/{id}/activities    Créer activité manuelle
PUT    /activities/{id}          Modifier fiche
DELETE /activities/{id}          Supprimer
GET    /activities/{id}/thumbnail Récupérer thumbnail (cascade)
```

### Planning
```
GET    /trips/{id}/slots         Tous les slots du voyage
POST   /trips/{id}/slots         Déposer activité sur créneau
PUT    /slots/{id}               Déplacer ou étirer (modifier heure_debut/fin)
DELETE /slots/{id}               Retirer du planning
POST   /trips/{id}/slots/check   Vérifier conflit + retourner alternatives
POST   /trips/{id}/optimize      Optimiser ordre via Dify
```

### Catégories
```
GET    /trips/{id}/categories    Liste (système + custom)
POST   /trips/{id}/categories    Créer catégorie custom
PUT    /categories/{id}          Modifier
DELETE /categories/{id}          Supprimer (sauf système)
```

### Layouts cartes
```
GET    /trips/{id}/layouts       Liste des dispositions sauvegardées
POST   /trips/{id}/layouts       Sauvegarder disposition courante
PUT    /layouts/{id}             Mettre à jour
DELETE /layouts/{id}             Supprimer
```

### Agent IA (Dify)
```
POST   /ai/suggest               destination + nb_jours → liste activités JSON
POST   /ai/enrich                titre + lieu → fiche complète + thumbnail URL
POST   /ai/optimize              slots[] → ordre optimisé géographiquement
POST   /ai/chat                  question + contexte → réponse Dify
```

---

## 6. Services backend

### 6.1 ThumbnailService — Cascade automatique
```python
def get_thumbnail(titre: str, lieu: str) -> str:
    # 1. Scraping léger GetYourGuide (search "{titre} {lieu}")
    url = scrape_getyourguide(titre, lieu)
    if url: return url

    # 2. Unsplash API (query "{lieu} {categorie}")
    url = unsplash_search(f"{lieu} {titre}")
    if url: return url

    # 3. Dify web search → retourne URL image
    url = dify_image_search(titre, lieu)
    if url: return url

    # 4. Placeholder SVG généré (icône catégorie + couleur)
    return generate_placeholder(titre)
```

### 6.2 ConflictService — Détection + alternatives
```python
def check_conflict(trip_id, jour, heure_debut, heure_fin, exclude_slot_id=None):
    # Retourne: {"conflict": bool, "alternatives": ["09:00", "14:00", "16:30"]}
    # Vérifie: chevauchements, horaires ouverture, jours fermeture
```

### 6.3 DifyService — 4 workflows
```python
suggest_activities(destination, nb_jours, dates)
    # → JSON: [{titre, lieu, categorie, duree_min, cout, description,
    #           horaires_ouverture, jours_fermeture, thumbnail_url, rating}]

enrich_activity(titre, lieu)
    # → JSON: fiche complète mise à jour + url_thumbnail

optimize_planning(slots_with_gps)
    # → JSON: [{slot_id, nouvel_ordre, duree_trajet_minutes}]

travel_qa(question, context)
    # → TEXT: réponse en langage naturel
```

---

## 7. Frontend React — Comportements détaillés

### 7.1 Grille Planning (PlanningCalendar)

**Grille**
- N colonnes = nb_jours du voyage
- Plage horaire configurable par voyage (défaut 07:00–23:00)
- Créneaux de **15 minutes** (snap strict)
- Heures affichées à gauche en labels toutes les 30 min

**Zoom (Ctrl + molette)**
```
Niveau 1 :  8px / créneau 15min  →  1h = 32px   (vue d'ensemble)
Niveau 2 : 16px / créneau 15min  →  1h = 64px   (défaut)
Niveau 3 : 28px / créneau 15min  →  1h = 112px  (précision max)
```
- Transition instantanée (pas d'animation)
- Niveau mémorisé en localStorage
- Molette seule = scroll vertical
- **Le panneau actif = là où est le curseur** (hover détermine le panneau)

**Header de chaque colonne**
```
[Date] [Nom du jour]
Occupé: 6h30  |  Libre: 5h30
Budget: 180€ / 250€  [████████░░░░] 72%
```

**Timeline horizontale (en haut du planning)**
- Tous les jours du voyage sur une ligne
- Point coloré = activités placées, cercle vide = jour sans activité
- Clic → scroll vers ce jour

**Indicateur journée surchargée**
- Alerte visuelle si > seuil paramétrable (défaut 8h d'activités)

### 7.2 Blocs dans le planning (PlanningBlock)

**Apparence**
- Couleur de fond = couleur de la catégorie
- Titre + icône catégorie toujours visibles
- Miniature visible si :
  - Mode 1 jour : toujours
  - Mode multi-jours : seulement si zoom niveau 3 (28px)
  - Désactivable globalement via toggle
- Code couleur catégorie : activable/désactivable

**Statut (icône en haut à droite du bloc)**
```
⚪ non_reserve
🟡 en_cours
🟢 reserve
🟠 action_requise
🚫 annule  (panneau sens interdit)
```

**Interactions**
- Survol → miniature agrandie en tooltip
- Clic → panneau coulissant d'édition (s'ouvre à droite)
- Drag → déplacement avec aperçu transparent, snap 15min
- Étirement bas → ajuste heure_fin (snap 15min)
- Double-clic → panneau coulissant d'édition (idem clic)

**Blocs verrouillés**
- Texture hachurée + icône 🔒
- Verrouillé souple (niveau 1) → confirmation "Voulez-vous déplacer ce bloc ?"
- Verrouillé fort (niveau 2) → double confirmation explicite
- Usage : vols, hôtels, check-in, ferry

**Contraintes visuelles**
```
Hors horaires d'ouverture  → fond orange + warning
Jour de fermeture          → colonne rouge, dépôt bloqué
Chevauchement              → contour rouge + ConflictToast
```

**ConflictToast**
```
⚠️ Conflit détecté
"Randonnée Caldera" se termine à 15h30
"Déjeuner Los Llanos" commence à 15h00
→ [Décaler à 16h00]  [Raccourcir la randonnée]  [Ignorer]
```

### 7.3 Undo / Redo
- Ctrl+Z / Ctrl+Y
- Historique des 30 dernières actions
- Toast discret : "↩ Déplacement annulé — Observation des étoiles"

### 7.4 Sauvegarde automatique
- Appel API silencieux après chaque action
- Indicateur discret en haut : "Sauvegardé ✓" (disparaît après 2s)

### 7.5 Blocs spéciaux (barre dédiée sous la timeline)
```
🍽️ Repas (1h, vert)    🚗 Trajet (durée estimée, gris)    ☕ Pause (libre, bleu)
```
Glissables comme les activités normales.

---

## 8. Frontend React — Panneau Activités

### 8.1 Modes d'affichage
```
[🃏 Fiches]  [☰ Liste]  [🃏🃏 Cartes]
```

### 8.2 Mode Fiches (défaut)
- Grille 2 colonnes, dernière créée en premier
- Chaque carte : thumbnail + titre + lieu + durée + prix + rating + statut
- Survol → miniature agrandie
- Clic → panneau coulissant fiche complète
- **Ctrl + molette = zoom continu fluide (style Figma)**
- Molette seule = scroll

### 8.3 Mode Cartes à jouer
**Accès** : bouton toggle, page partagée (50/50) OU pleine page

**Comportements**
- Cartes librement déplaçables en x/y (position libre, pas de grille)
- **Glisser une carte sur une autre → passe automatiquement au-dessus (z-index max)**
- Clic sur une carte → passe aussi au premier plan
- Ctrl + molette = zoom continu fluide (sans niveaux fixes)
- Molette seule = scroll

**Piles**
- Au 1er lancement : piles automatiques par catégorie
- Déplaçables manuellement ensuite

**Dispositions nommées**
- Bouton [💾 Sauvegarder disposition] → saisir un nom
- Menu déroulant pour charger une disposition sauvegardée
- Bouton [↩ Retour initiale] → disposition de référence
- Bouton [🔄 Réinitialiser] → retri automatique par catégorie

**z-index sauvegardé** dans card_layouts (JSON disposition)

### 8.4 Filtres et recherche
- Recherche texte instantanée (titre, lieu)
- Filtre par catégorie (clic icône = filtre actif)
- Filtre par statut ⚪🟡🟢🟠🚫
- Filtre "Déjà placées / Disponibles"

### 8.5 Ajout manuel d'activité
Bouton [+ Nouvelle activité] → formulaire complet :
```
Titre *          Lieu *           Catégorie *
Durée min *      Durée max        Prix (4 pers)
Description      Horaires ouverture  Jours fermeture
URL Source       URL Réservation
Remarques        Thumbnail (upload OU URL)
```
Validation des champs obligatoires (*) avant soumission.

### 8.6 Panneau coulissant fiche (ActivityModal)
- S'ouvre à droite, ne masque pas le planning
- Tous les champs éditables inline (pas de formulaire séparé)
- Score de complétude : barre de progression 0–100%
- Badge "Tripadvisor consulté ✓"
- Galerie photos (thumbnail + 2 photos)
- Liens cliquables : url_source et url_reservation
- Bouton "✨ Enrichir avec Dify"
- Bouton "🗑️ Supprimer l'activité"

### 8.7 Panneau masquable
- Bouton [◀] → panneau masqué, planning pleine largeur
- Bouton [▶] → rouvrir

---

## 9. Variables d'environnement (.env)

```env
# Dify
DIFY_API_KEY=your_dify_api_key
DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_WORKFLOW_SUGGEST=workflow-xxx
DIFY_WORKFLOW_ENRICH=workflow-xxx
DIFY_WORKFLOW_OPTIMIZE=workflow-xxx
DIFY_CHATBOT_QA=chatbot-xxx

# Unsplash
UNSPLASH_ACCESS_KEY=your_unsplash_key

# App
DATABASE_URL=sqlite:///./travel_planner.db
FRONTEND_URL=http://localhost:3000
```

---

## 10. Dify — 4 workflows à configurer

### Workflow 1 : suggest_activities
```
Entrée  : destination (str), nb_jours (int), dates (str)
Sortie  : JSON liste 15-20 activités
Champs  : titre, lieu, categorie, duree_min, duree_max, cout,
          description, horaires_ouverture, jours_fermeture,
          thumbnail_url, rating, url_source, url_reservation
```

### Workflow 2 : enrich_activity
```
Entrée  : titre (str), lieu (str)
Sortie  : JSON fiche complète mise à jour
Champs  : description enrichie, horaires, jours_fermeture,
          cout, rating, thumbnail_url, galerie_photos[2],
          url_source, url_reservation
```

### Workflow 3 : optimize_planning
```
Entrée  : slots[] avec {activity_id, titre, lieu, lat, lng, jour, heure_debut}
Sortie  : JSON ordre optimisé
Champs  : [{slot_id, nouvel_ordre, duree_trajet_min, raison}]
```

### Chatbot 4 : travel_qa
```
Contexte injecté : fiche activité sélectionnée + planning du voyage
Usage            : questions libres en langage naturel
Exemples         : "À quelle heure ouvre ce site ?",
                   "Parking disponible ?",
                   "Météo prévue ce jour-là ?"
```

---

## 11. Cascade Thumbnails — Détail technique

```
get_thumbnail(titre, lieu, categorie):

1. GetYourGuide scraping léger
   → requête GET sur getyourguide.com/s/?q={titre}+{lieu}
   → extrait première image produit (pas logo/icône)
   → filtrer: exclure URLs avec 'logo','icon','avatar','banner'

2. Unsplash API
   → GET https://api.unsplash.com/search/photos
   → query: "{lieu} {categorie}"
   → retourner urls.regular de la première photo

3. Dify web search
   → appel workflow dédié avec prompt:
     "Trouve une URL d'image représentant {titre} à {lieu}.
      Retourne uniquement l'URL directe d'une image."

4. Placeholder SVG généré
   → SVG avec couleur de la catégorie + icône emoji centré
   → encodé en base64 data URL
```

---

## 12. Règles métier importantes

### Snap 15 minutes
- Tout dépôt et tout étirement snappent au multiple de 15min le plus proche
- Formule : `Math.round(minutes / 15) * 15`
- Appliqué côté frontend uniquement (backend valide juste `% 15 == 0`)

### Calcul de position pixel
```javascript
const SLOT_HEIGHT = [8, 16, 28][zoomLevel] // px par créneau 15min
const minutesToPx = (min) => (min / 15) * SLOT_HEIGHT
const pxToMinutes = (px) => Math.round((px / SLOT_HEIGHT) * 15 / 15) * 15
```

### Détection de conflit
```python
def has_conflict(slots, new_slot):
    for slot in slots:
        if slot.jour == new_slot.jour:
            if not (new_slot.heure_fin <= slot.heure_debut or
                    new_slot.heure_debut >= slot.heure_fin):
                return True
    return False
```

### Score de complétude
```python
CHAMPS_REQUIS = {
    'titre': 15, 'lieu': 10, 'categorie_id': 5,
    'duree_min': 10, 'cout': 5, 'description': 15,
    'thumbnail_url': 10, 'horaires_ouverture': 10,
    'url_reservation': 10, 'galerie_photos': 10
}
# Score = somme des poids des champs renseignés (non null, non vide)
```

---

## 13. État d'avancement au moment de la rédaction

### ✅ Déjà fonctionnel (prototype)
- Écran partagé double panneau
- Fiches activités en grille 2 colonnes (ajout manuel)
- Agenda avec drag & drop basique
- Créneaux de 15 minutes

### 🔲 À développer (v1)
- Zoom Ctrl+molette (planning + fiches)
- Étirement bas des blocs (ajuster durée)
- Mode cartes à jouer avec dispositions nommées
- Contraintes visuelles (fermeture, horaires, conflits)
- Blocs verrouillés (vols, hôtels)
- Undo/Redo
- Sauvegarde automatique
- Timeline horizontale
- Budget par jour
- Panneau coulissant d'édition
- Champ catégorie sur les fiches
- Code couleur par catégorie
- Miniature dans les créneaux (mode 1 jour)
- Panneau masquable
- Partage via token

### 🔮 Phase 2 (Collecteur IA — projet séparé)
- Agent Dify suggest_activities
- Agent Dify enrich_activity
- Agent Dify optimize_planning
- Chatbot travel_qa
- Pipeline scraping multi-sources (Apify + Firecrawl)
- Résumé avis Tripadvisor
- Badge Tripadvisor enrichi
- Score complétude automatique
- Météo par jour (OpenWeatherMap)

---

## 14. Notes de développement

- **Antigravity IDE / Cursor** : passer les sections du prompt dans l'ordre (1→5)
- **MCP** : non utilisé en v1 (API classiques). Prévu pour le Collecteur IA (phase 2)
- **Migration frontend** : le backend FastAPI est découplé — remplacer React par Vue/Svelte sans toucher le backend
- **Hébergement** : local uniquement en v1
- **Auth** : aucune en v1 (usage solo)
- **Langue** : interface en français

---

*Document généré à partir de la session de conception complète — Travel Planner App*
