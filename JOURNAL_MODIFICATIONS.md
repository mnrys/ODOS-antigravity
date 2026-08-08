# Journal de suivi des modifications — ODOS Travel Planner

> Ce fichier consigne l'historique complet des demandes de l'utilisateur (Mounir), des réclamations, des analyses, des décisions techniques prises et des actions engagées dans le code et la documentation.
>
> **Règle :** Toute session de travail doit enrichir ce document pour garantir une traçabilité totale et le respect des conventions du projet (cf. `GEMINI.md`).

---

## Entrée du 8 août 2026 — Session 1 : Mode Consultation/Modification & Cadrage Scraping Firecrawl

### 1. Réclamations & Demandes utilisateur
- **Traçabilité & Documentation** : Consigner systématiquement toutes les actions, demandes et réclamations dans un fichier dédié (`JOURNAL_MODIFICATIONS.md`).
- **Écran Création (Écran 1)** :
  - Ajouter un bouton toggle dans la barre horizontale pour choisir entre deux modes de navigation :
    - **Mode Consultation** (mode par défaut) : double-clic ouvre la fiche en mode lecture seule (comme dans l'Atelier), centrée sur l'écran avec fond flou (`backdrop-blur`).
    - **Mode Modification** : double-clic ouvre la vue complète d'édition (`ActivityFormModal`).
  - **Fermeture de fiche** : Bouton croix (X), bouton fermer ou clic sur le fond flou en dehors de la fiche.
  - **Persistance du défilement (Scroll)** : Lors de la fermeture d'une fiche, la grille doit impérativement conserver sa position de scroll et ne pas revenir au tout début (haut de page).
- **Mise à jour des documents de référence** :
  - Intégrer les nouvelles versions de `PRD_ecran1_creation.md` (US-13 à US-16), `SCHEMA_BASE_DE_DONNEES.md` (colonne `lien_avis_tripadvisor`), et `PLAN.md` (Phases 11 et 12).
- **Scraping GetYourGuide & TripAdvisor** :
  - Apify a atteint son quota gratuit de 5$.
  - Solution alternative retenue : **Firecrawl** (1000 crédits/mois gratuits, mode stealth anti-bot, format JSON structuré).
  - Clé API Firecrawl à configurer dans `.env`.
  - Effectuer d'abord un test unitaire Firecrawl sur une URL TripAdvisor spécifique avant d'engager le pipeline complet.
- **Perspective de mise en ligne** :
  - Prévoir à terme la migration de SQLite vers PostgreSQL et hébergement en ligne (déjà préparé côté architecture via SQLAlchemy).

---

### 2. Actions engagées et état des lieux

| Action | Statut | Détails |
|---|---|---|
| Création du journal de suivi (`JOURNAL_MODIFICATIONS.md`) | ✅ Fait | Créé et initialisé à la racine du projet pour consigner toutes les requêtes et actions. |
| Mise à jour de `PRD_ecran1_creation.md` | ✅ Fait | Intégration des US-13 à US-16 et de la grille de consultation. |
| Mise à jour de `SCHEMA_BASE_DE_DONNEES.md` | ✅ Fait | Ajout de la colonne `lien_avis_tripadvisor` sur la table `activities`. |
| Mise à jour de `PLAN.md` | ✅ Fait | Ajout des Phases 11 (Toggle & Scroll) et 12 (Pipeline TripAdvisor Firecrawl). |
| Intégration de `PROMPT_ANTIGRAVITY_phase12.md` | ✅ Fait | Document de cadrage placé dans `docs/`. |
| Formatage de la clé API Firecrawl dans `.env` | ✅ Fait | `FIRECRAWL_API_KEY` intégrée et opérationnelle. |
| Backend & Schémas (`models.py`, `schemas.py`, `activities.py`) | ✅ Fait | Colonne `lien_avis_tripadvisor` ajoutée et tests `pytest` (41/41) passés avec succès. |
| Frontend — Composant `ActivityDetailModal.jsx` | ✅ Fait | Vue centrée, lecture seule, fond flou, galerie photos, détails logistiques et bouton « ✏️ Modifier ». |
| Frontend — Écran `CreationPage.jsx` | ✅ Fait | Toggle de vue Consultation / Modification, double-clic conditionnel, mémorisation & restauration du défilement (`scrollTop`). |
| Compilation Frontend (`npm run build`) | ✅ Fait | Build Vite vérifié avec 0 erreurs. |
| Phase 12 (Étape 1) — Test unitaire Firecrawl TripAdvisor | ✅ Fait | Script `scripts/test_firecrawl_single.py` exécuté avec succès : extraction structurée de titre, note, avis, prix, horaires, photos et synthèse des avis voyageurs. |

---

### 3. Fichiers impactés
- `JOURNAL_MODIFICATIONS.md` (créé et enrichi)
- `PRD_ecran1_creation.md` (mis à jour)
- `SCHEMA_BASE_DE_DONNEES.md` (mis à jour)
- `PLAN.md` (mis à jour)
- `docs/PROMPT_ANTIGRAVITY_phase12.md` (créé)
- `backend/app/models.py` (colonne `lien_avis_tripadvisor` ajoutée)
- `backend/app/schemas.py` (champ `lien_avis_tripadvisor` exposé)
- `backend/app/routers/activities.py` (mise à jour CRUD)
- `frontend/src/components/activities/ActivityDetailModal.jsx` (créé)
- `frontend/src/pages/CreationPage.jsx` (toggle de mode, double clic et persistance scroll)
- `scripts/test_firecrawl_single.py` (script de validation unitaire Firecrawl)
- `scripts/firecrawl_sample_response.json` (échantillon d'extraction structurée Colisée / TripAdvisor)
- `backend/tests/test_activities.py` (nouveau test automatisé `test_activity_tripadvisor_link_and_consultation_detail`)

---

### 4. Validation banquée
- **Fonctionnalité validée** : Mode Consultation / Mode Modification, modale centrée avec fond flou, conservation du défilement, et intégration du lien TripAdvisor.
- **Protection par test automatisé** : Test `test_activity_tripadvisor_link_and_consultation_detail` ajouté dans `backend/tests/test_activities.py`.
- **Résultat de la suite de tests globale** : **42/42 tests passés avec succès** (`pytest`).

---

### 5. Arbitrage & Décision Phase 12 (Firecrawl vs API Officielle TripAdvisor)
- **Arbitrage** : Confirmation du choix **Firecrawl** (synthèse qualitative sur l'ensemble des avis, pas de carte bancaire obligatoire, 1000 crédits/mois gratuits, intégration déjà opérationnelle).
- **Validation sur attraction scientifique / gratuite** : Test sur l'*Instituto de Astrofísica de Canarias* (La Palma) avec détection du prix à 0 €, tag Astronomie et synthèse en français validés.
- **Plan d'implémentation Phase 12** : Rédigé et approuvé.

---

### 6. Réalisations de la Phase 12 (Pipeline TripAdvisor Firecrawl)
- **Service Backend** : Création de `backend/app/services/scraping/tripadvisor_firecrawl.py` (isolation de la source, mapping schéma ODOS, parsing des durées et conversion des notes).
- **Routeur Scraping** : Mise à jour de `backend/app/routers/scraping.py` pour supporter `source="tripadvisor"` avec déduplication stricte.
- **Script CLI autonome** : Création de `scripts/pipeline_tripadvisor.py` avec options `--dry-run`, `--max-credits`, injection FastAPI REST et système de checkpoints dans `scripts/.checkpoints/`.
- **Frontend** : Activation de l'option TripAdvisor dans `frontend/src/components/activities/ScrapingModal.jsx` (build Vite validé).
- **Tests & Protection** : Ajout de `test_suggest_destination_tripadvisor_firecrawl` et `test_tripadvisor_helper_parsers` dans `backend/tests/test_scraping.py`.
- **Résultat de la suite de tests globale** : **44 / 44 tests passés avec succès** (`pytest`).

---

### 7. Guide Interactif Autonome & Améliorations de Feedback (Session du 8 août)
- **Guide Interactif Autonome** : Création du fichier [guide_interactif_canaries.html](file:///d:/Mounir/Webapp%20avec%20Gemini/guide_interactif_canaries.html) couvrant La Palma et Tenerife.
- **Correction du Scraper TripAdvisor** : Ciblage précis des incontournables réels de La Palma et Tenerife (élimination des recherches globales erratiques).
- **Feedback explicite du Scraping** : Messages clairs dans `ScrapingModal.jsx` et `scraping.py` pour distinguer les nouveaux ajouts, les doublons évités et les indisponibilités de quota.

---

### 8. Refonte Complète du Guide Interactif & Archive Pérenne TripAdvisor (8 août - Soir)
- **Réclamations & Attentes de l'utilisateur :**
  1. *Synthèse trop succincte* : 3 lignes pour plus de 1 000 avis est insuffisant. Il faut des rapports multi-points détaillant la route d'accès, les réservations indispensables, l'équipement (lampe rouge, polaire, chaussures), les meilleurs horaires et astuces de terrain.
  2. *Lien générique* : Le lien doit pointer directement sur la page officielle spécifique de l'attraction TripAdvisor.
  3. *Archive de stockage pérenne* : Tout centraliser dans un fichier archive réutilisable pour éviter de refaire des appels payants Firecrawl et alimenter diverses présentations (HTML, livre, webapp ODOS).
  4. *Qualité visuelle et ergonomie* : Respect strict du `DESIGN.md` (Plus Jakarta Sans, palette ODOS, pas de tags masquant les titres, mode magazine/livre élégant).

- **Actions engagées & Fichiers créés / modifiés :**
  1. **Archive Locale Pérenne (`data/tripadvisor_canaries_archive.json`)** : Fichier JSON complet stockant 17 attractions phares (9 pour La Palma, 8 pour Tenerife) avec URLs directes TripAdvisor, notes, avis vérifiés et synthèses en 4 à 5 points structurés.
  2. **Refonte Majeure du Guide (`guide_interactif_canaries.html`)** :
     - Conforme à `DESIGN.md` (palette de couleurs, typographie Plus Jakarta Sans, fonds chauds `#FAF8F5`, `#F1F0ED`, vert nature `#3F7A55`, accent `#D6F84C`).
     - Double mode de lecture : **Grille & Filtres thématiques** (Nature, Volcans, Astronomie, Baignade, Culture) et **Mode Magazine / Carnet de voyage** (double-page grand format, navigation chapitrée au clavier et sommaire visuel).
     - Rapports d'avis exhaustifs structurés avec encadrés thématiques clairs, badges de contexte et bouton de copie directe dans le presse-papier.
     - Liens directs TripAdvisor (`target="_blank"`).
     - Traitement des images avec fallbacks automatiques et tags repositionnés sans recouvrement des titres.
  3. **Backend (`tripadvisor_firecrawl.py`)** : Intégration de la lecture de l'archive locale en priorité pour un import instantané et sans coût dans ODOS, avec adaptation du schéma d'extraction pour les requêtes live futures.
  4. **Tests & Validation** : Ajout du test `test_tripadvisor_loads_from_local_archive` dans `backend/tests/test_scraping.py`.
  5. **Résultats** : **45 / 45 tests backend validés** (`pytest`), compilation frontend Vite sans erreur.

---

### 9. Génération du Guide PDF Hors-Ligne pour Smartphone (8 août - 22h40)
- **Demande utilisateur** : Disposer d'un document PDF complet, enrichi de détails et parfaitement lisible hors-ligne sur smartphone pour La Palma et Tenerife.
- **Actions engagées** :
  1. **Générateur PDF Haute Définition (`scripts/generate_pdf_guide.py`)** : Script Python automatisé extrayant les 17 activités de `data/tripadvisor_canaries_archive.json` et pilotant le moteur Chrome Headless avec une mise en page CSS A4 portrait spécifique.
  2. **Document PDF produit (`Guide_Canaries_Avis_TripAdvisor.pdf`)** :
     - *Couverture soignée* avec statistiques clés (+46 000 avis synthétisés, 17 activités).
     - *Sommaire & Index rapide* des 2 îles.
     - *17 fiches d'activités grand format* (1 par page) avec encadré complet des avis voyageurs (Route & Accès, Horaires & Timing, Équipement & Climat, Points de vigilance, URLs directes).
     - *Fiche Mémo Voyageur* en fin de document (Tableau des goulots d'étranglement / réservations obligatoires, check-list équipement spécifique, règles de conduite).
  3. **Bouton de téléchargement dans le Guide Web** : Ajout d'un bouton de téléchargement direct du PDF dans la barre supérieure de `guide_interactif_canaries.html`.

---

### 10. Rappel à l'Ordre & Règle d'Or : Automatisation Proactive du Cycle Test → Commit → Push (8 août - 23h05)
- **Réclamation légitime de Moun** : Les tests, commits et push doivent être pris en charge de manière proactive et systématique à la fin de chaque étape de travail, sans que l'utilisateur n'ait à le demander ou à rappeler les règles de bonne pratique. L'état du dépôt doit rester impeccable et synchronisé en permanence pour éviter tout décalage lors des relectures de code.
- **Actions immédiates exécutées** :
  1. **Banquage officiel par tests** : 46 tests validés (`pytest`), 0 échec.
  2. **Commits intentionnels créés** :
     - `88c77dc` (*Ajoute le double mode Consultation/Modification et la vue detail sur l'ecran Creation*)
     - `c5616b1` (*Integre le scraping TripAdvisor, l'archive locale Canaries, le guide interactif et le guide PDF hors-ligne*)
  3. **Push distant exécuté** : `git push origin main` effectué avec succès vers `https://github.com/mnrys/ODOS-antigravity.git`.
- **Engagement de méthode strict pour la suite** : Antigravity intègre désormais obligatoirement, à chaque clôture de tâche validée :
  1. *Test de non-régression automatique*.
  2. *Commit explicite en français*.
  3. *Git Push immédiat vers origin/main*.
  4. *Mise à jour immédiate du présent journal*.

---

### 11. Synchronisation Complète de la Documentation de Référence & Ticket d'Anomalie GYG (8 août - 23h12)
- **Demande utilisateur** : Assurer une concordance absolue et pérenne entre les documents de spécification (`PRD_ecran1_creation.md`, `BACKLOG.md`, `PLAN.md`) et le code réel développé. Consigner l'anomalie de scraping GetYourGuide sur Tenerife.
- **Actions de synchronisation documentaire engagées** :
  1. **`PRD_ecran1_creation.md`** :
     - Ajout de l'US-17 (sélection de source et retour d'information explicite).
     - Formalisation de l'ouverture par défaut en mode consultation avec le composant dédié `ActivityDetailModal`.
     - Intégration de l'architecture de scraping multi-sources TripAdvisor avec archive locale pérenne.
     - Enregistrement du point d'attention / anomalie : Scraping GYG sur Tenerife (0 fiche).
  2. **`BACKLOG.md`** :
     - Actualisation à la date du 8 août 2026, 23h10.
     - Validation V1 de la bascule Consultation/Modification et du pipeline TripAdvisor.
     - Enregistrement du ticket d'anomalie prioritaire sur le scraper GYG Tenerife.
  3. **`PLAN.md`** :
     - Validation des critères d'acceptation de la Phase 12 (Pipeline TripAdvisor, archive pérenne JSON, guide HTML interactif et guide PDF).

---

### 12. Découplage Architectural du Service Planning & Consolidation URLs TripAdvisor (8 août - 23h25)
- **Objectifs & Règles d'or appliquées** :
  - *Règle 7.2 (Séparation des couches)* : Découpler la logique métier du routeur `planning.py` vers un service dédié `app.services.planning`.
  - *Règle 5.1 & 5.7 (Données découplées)* : Découpler les URLs TripAdvisor codées en dur pour utiliser dynamiquement `data/tripadvisor_canaries_archive.json`.
  - *Règle 4 (Banquage de validation)* : Couvrir les méthodes métier du service par de nouveaux tests unitaires automatisés.
- **Actions réalisées** :
  1. **Nouveau service métier `backend/app/services/planning.py`** : Centralise la gestion des créneaux, détection des chevauchements/conflits (`check_slot_overlap`), duplication autonome de créneaux/blocs libres (`duplicate_planning_slot`), gestion des blocs spéciaux et calculs budgétaires consolidés.
  2. **Allègement du routeur `backend/app/routers/planning.py`** : Rôle restreint à la réception des requêtes HTTP, validation Pydantic et mapping des statuts (`409 Conflict`, `404`, `400`).
  3. **Consolidation `tripadvisor_firecrawl.py`** : Chargement dynamique des URLs depuis l'archive JSON unique `data/tripadvisor_canaries_archive.json`.
  4. **Validation de tests (47/47)** : 47 tests `pytest` passés avec succès (dont nouveaux tests directs du service planning).
  5. **Validation compilation frontend** : Build Vite (`npm run build`) validé avec succès (0 erreur).

---

### 13. Audit des Couleurs en Dur (~1 266 occurrences) & Arbitrage Option B (8 août - 23h40)
- **Constat & Audit** :
  - L'audit PowerShell a identifié 1 266 occurrences de classes de couleurs arbitraires en dur (`bg-[#...]`: 327, `text-[#...]`: 654, `border-[#...]`: 285) dans les composants React hérités des phases initiales.
  - Les jetons de design sémantiques `@theme` sont déjà définis et opérationnels dans `frontend/src/index.css` (`brand-success`, `brand-encre`, `brand-fond`, `brand-surface`, `brand-border`, `brand-muted`, `brand-alert`, `brand-error`, `brand-info`, `cat-*`).
- **Décision & Arbitrage (Option B retenue)** :
  - **Option A rejetée** : Un remplacement massif et automatisé de 1 266 occurrences d'un coup comporte un risque élevé de régression visuelle silencieuse (survol, contrastes, opacités conditionnelles).
  - **Option B validée** :
    1. *Règle de non-aggravation immédiate* : Tous les nouveaux composants ou fichiers créés utilisent obligatoirement les jetons `@theme` dès le départ.
    2. *Création de la Phase 13 dans `PLAN.md`* : Découpage du refactoring exhaustif par lots cohérents (13.1 Composants partagés, 13.2 Dashboard, 13.3 Création, 13.4 Atelier, 13.5 Planning) avec vérification visuelle écran par écran.

