# ODOS Travel Planner — Backlog

> Ce fichier centralise les idées évoquées pendant les échanges de conception, classées par horizon.
> Mis à jour au fur et à mesure des sessions — chaque ajout est proposé et validé avec l'utilisateur avant d'être inscrit ici.

**Dernière mise à jour :** 1er août 2026, 20h15

---

## Légende des statuts

- 🟢 **V1** — en cours de conception/développement actif
- 🟡 **V2** — prévu, mais après le cœur fonctionnel de l'app
- 🔵 **V3 / Futur** — idée notée, pas de priorité immédiate
- ⚪ **En réflexion** — pas encore tranché, à valider avec l'utilisateur

---

## 🟢 V1 — En cours

### Architecture générale
- Numérotation officielle des écrans (utilisée dans les noms de fichiers PRD et en code) :
  - **Écran 0** — Dashboard (accueil par défaut au lancement d'ODOS)
  - **Écran 1** — Création de fiches
  - **Écran 2** — Atelier (canvas libre, avec panneau latéral Planning à la demande)
  - **Écran 3** — Planning (vue plein écran, jour/3 jours/semaine)
- **Barre de navigation persistante, toujours visible sur les 4 écrans** : Dashboard / Création / Atelier / Planning, pour passer de l'un à l'autre à tout moment
- **Dashboard (Écran 0), écran d'accueil par défaut au lancement d'ODOS** (toujours, pas de reprise du dernier écran), accessible aussi à tout moment via la barre de navigation
  - Indicateurs : nom et dates du voyage, compte à rebours avant le départ, budget global (dépensé/prévu), répartition du nombre d'activités par destination avec accès direct à chaque atelier, nombre d'activités placées dans le planning, alerte sur la pile "À valider" (écran 1) si elle contient des fiches en attente
  - Prévu dès maintenant pour évoluer vers un vrai sélecteur multi-voyages plus tard
- Écran 1 (Création) : formulaire manuel + intégration Claude for Chrome + scraping automatique par destination
- Pile "📥 À valider" comme point d'entrée unique pour toute fiche créée automatiquement (scraping ou Claude for Chrome), avant intégration à l'atelier
- Option de rejet rapide des fiches non désirées (glisser vers corbeille latérale + raccourci clavier)
  - Décision tranchée : **corbeille récupérable** pendant quelques jours (pas de suppression immédiate et définitive)
- Confirmé : les fiches issues du scraping automatique par destination arrivent bien dans l'**écran 1** (pile "À valider"), même circuit que les autres modes de création
- **PRD complet de l'écran 1 rédigé via le skill `/cadre`** (Problème, Solution, User Stories US-1 à US-12, Critères de succès, Hors périmètre, Décisions d'implémentation) — voir `PRD_ecran1_creation.md`
- Validation dans la pile "À valider" : **fiche par fiche uniquement** (mode focus séquentiel), pas de validation par lot
- La validation n'est **jamais bloquée par l'incomplétude** d'une fiche : le score de complétude reflète juste l'état, il n'empêche pas de valider (à compléter plus tard dans l'atelier si besoin)
- Les **tags sont modifiables dès l'écran 1**, au même titre que les autres champs du formulaire de validation
- Pendant la validation d'une fiche scrapée, le **lien source doit être cliquable** pour aller vérifier les données à la page d'origine avant de compléter manuellement si nécessaire

### Modèle de données à faire évoluer
- Remplacer la catégorie unique (`categorie_id`) par un **système de tags multiples** (many-to-many) pour permettre le filtrage combiné (prix, lieu, zone géographique, type d'activité...)
  - Décision tranchée : tags en **texte libre avec autocomplétion** sur les tags déjà créés (évite les doublons type "nord" / "Nord")
- Remplacer `galerie_photos` (JSON, 2 photos max) par une vraie table `documents` dédiée, supportant plusieurs sources : scraping, upload manuel, photo terrain (avec géoloc/date), et acceptant aussi des PDF (voucher, billet)
- Correction de modélisation : le **nombre de personnes est un attribut du voyage** (`trips`, ex: 4 personnes), pas de chaque activité
  - Le champ `cout` de l'activité devient un **prix par personne** ; le prix total affiché sur la fiche = `cout_par_personne × nb_personnes du voyage` (calcul automatique, pas un champ stocké)
- Temps de trajet : **pas un champ de la fiche activité**. Fonctionnalité reportée en V3 (voir plus bas) — calcul dynamique entre deux activités consécutives du planning, nécessite les coordonnées GPS (lat/lng) de chaque activité
- Champ "lieu" éclaté en trois : **destination** (liste déroulante des `trip_destinations` du voyage, auto-remplie si scraping), **adresse** (texte libre → génère un lien cliquable Google Maps), **zone géographique** (champ structuré à choix unique : nord/sud/est/ouest — pas un tag, car mutuellement exclusif et utilisé pour l'optimisation de trajet)
- Un voyage peut avoir **une ou plusieurs destinations** (`trip_destinations`), chacune avec son propre atelier (relation one-to-many, un voyage a toujours au moins une destination). Cas simple (1 destination) et cas complexe (N destinations, ex: La Palma + Tenerife) doivent fonctionner de façon identique
- Fiche activité : **un seul bouton source** (pas de bouton "Réserver" séparé) → affiche le nom du site abrégé (ex: "GetYourGuide", "visitlapalma.es") plutôt que l'URL complète, ouvre `url_source` dans un nouvel onglet. L'utilisateur vérifie tout sur la page d'origine (horaires, lieu, date) avant de réserver lui-même
- Nouveau champ **note d'intérêt** (1 à 5, 5 = à faire absolument) — saisie à la création, modifiable dans le panneau complet de la fiche (double-clic)
- **Nouveau champ `avis_utilisateurs`** (texte), distinct du champ `remarques` (qui reste les notes personnelles de l'utilisateur) : synthèse des avis d'autres voyageurs. Vide en V1 (affiche "Aucun avis pour l'instant" dans l'UI), éditable manuellement dès maintenant, alimenté automatiquement en Phase 2 par le scraping Tripadvisor + filtrage IA (voir section Phase 2)
- Description tronquée sur la fiche compacte (atelier/planning) ; texte complet réservé au panneau coulissant d'édition (section 8.6 du cahier des charges d'origine) — **décision confirmée**
- Sélection de la photo principale (miniature) : survol d'une photo dans la galerie → icône étoile en overlay pour la définir comme `est_principale`, badge/bordure pour la distinguer des autres photos
- Capture Claude for Chrome / scraping : **toutes les photos visibles sur la page source sont récupérées automatiquement** dans la galerie ; le tri (garder/supprimer) se fait ensuite manuellement au moment de la validation de la fiche

### Atelier (canvas illimité)
- Positions des cartes persistantes ("bureau réel") — disposition "en cours" auto-sauvegardée en continu
- Dispositions nommées sauvegardables (ex: "par zone géographique", "par prix") en plus de la disposition "en cours"
- Système de filtres combinables (prix, lieu, tag, type d'activité), logique ET par défaut avec bascule ET/OU
- Deux actions distinctes sur les filtres : **Surligner** (contour coloré, positions inchangées) vs **Regrouper** (réorganisation physique → proposé comme nouvelle disposition nommée)
- Pile spéciale "🤖 Suggestions IA" séparée des fiches créées manuellement
- **Corbeille propre à l'atelier**, distincte de celle de l'écran 1 : glisser une carte dedans la retire de l'espace de travail sans la supprimer (récupérable). Double-clic sur la corbeille → consulter son contenu et repêcher une fiche vers le canvas si besoin. Suppression définitive uniquement via le panneau complet de la fiche (double-clic sur la carte → bouton "Supprimer")
- Piles automatiques au premier lancement : une pile par catégorie contenant au moins une fiche (pas de pile vide affichée), disposées en ligne sur le côté
  - Si trop de catégories pour tenir sur une ligne : **regroupement automatique des piles les moins fournies dans une pile "Autres"**, dépliable
  - **Visuel** : une pile a la **même taille qu'une carte individuelle**, avec la carte du dessus visible (métaphore paquet de cartes à jouer), léger décalage/ombre pour suggérer l'épaisseur
  - Nom de la pile affiché sous la pile ; **compteur en badge détaché** (pastille numérique en coin), pas un texte accolé au nom
  - Les piles sont des éléments du canvas comme les autres cartes : elles **suivent le zoom/pan**, et peuvent être déplacées manuellement
- **Typologie de fiche élargie** (`type_element`) : au-delà des activités, une fiche peut être un logement, un transport, un vol, un véhicule ou "autre" — reprend une bonne idée identifiée en comparant avec une ancienne version du projet (non retenue dans son ensemble, cf. note ci-dessous). Le formulaire de l'écran 1 adapte les champs visibles selon le type
- Badge discret en coin de carte pour distinguer la provenance : ✏️ manuel / 🕷️ scraping automatique / 🌐 capture Claude for Chrome (extension du champ `source` existant)
- Navigation entre les ateliers des différentes destinations d'un même voyage : **onglets en haut** (ex: La Palma | Tenerife)
- **Une fiche placée dans le planning reste visible dans l'atelier mais devient très transparente/grisée** (pas de disparition complète), pour rappeler qu'elle est déjà utilisée sans perdre la trace de sa position sur le canvas. Cet état ("placée" / "disponible") est **dérivé** de l'existence d'un `scheduled_slot` lié à l'activité — pas un champ stocké en dur sur la fiche, pour éviter une désynchronisation entre planning et atelier
- **Le panneau complet de la fiche** (accessible aussi bien depuis l'écran 1 que depuis l'atelier, via double-clic) permet l'**édition de tous les champs sans exception** (prix, remarques, tags, etc.), avec accès direct au lien source pour vérification à tout moment, pas seulement à la création
- **Pas de rotation des cartes au repos** : les cartes restent parfaitement droites sur le canvas, pour un rendu net. En revanche, une carte **en cours de déplacement s'incline légèrement et grossit un peu** — c'est le seul moment où la métaphore "carte physique" s'exprime dans le mouvement (décision de la phase `/design`)

### Note technique — choix d'implémentation pour le canvas de l'atelier
Recommandation : utiliser **`@xyflow/react`** (React Flow) pour construire le canvas infini de l'atelier (zoom, pan, positionnement des cartes/piles), plutôt qu'un canvas fait main — librairie robuste et éprouvée pour ce type d'usage, évite de réinventer des mécaniques déjà résolues (idée récupérée de la comparaison avec une ancienne version du projet)

### Note de contexte — ancienne V1 (juillet 2026)
Une V1 avait été développée avec un autre outil (Antigravity/Gemini) sur une vision plus ancienne et plus restrictive du projet (pas de scraping, pas de budget, pas d'écran 1 séparé, interaction de tri façon "swipe" au lieu de piles). Cette version n'est **pas retenue comme base** — on repart du présent backlog et du schéma associé. Seules deux idées ont été récupérées (typologie élargie et `@xyflow/react`, ci-dessus). Une troisième idée (fiches réutilisables pour repas/repos) a été envisagée puis abandonnée : ce besoin est déjà couvert par les blocs spéciaux créés directement dans le planning (repas/trajet/pause, cf. section Écran 3), pas besoin d'un mécanisme de fiche dédié.

### Scraping automatique par destination
- Solution retenue pour le prototype : **Apify** (quota gratuit généreux, scrapers prêts à l'emploi pour sites comme GetYourGuide/TripAdvisor)
- **Périmètre V1 précisé en session `/planifie` du 1er août 2026 : GetYourGuide uniquement.** Tripadvisor est volontairement différé — s'ajoutera comme un second traducteur (mapper) sans toucher au mécanisme de scraping lui-même. cf. `docs/PLAN.md`, Phase 4.
- Alternative de secours : script Python maison (gratuit mais fragile, casse si le site change de structure)
- Décision réversible — interface backend stable (`POST /ai/suggest-destination`) pour pouvoir changer de solution technique sans tout casser
- **Ajouter une nouvelle source de scraping = un mapper Python dédié par source, pas une extraction dynamique par IA.** L'extraction pilotée par IA existe déjà dans la vision d'origine (agent Dify `enrich_activity`), mais reste volontairement cantonnée au projet séparé "Collecteur IA" — plus lente, moins fiable qu'un mapper codé, et coûteuse à chaque fiche plutôt qu'une fois pour toutes à l'écriture.
- **Pistes V2/V3 identifiées le 1er août 2026** (évaluation d'une stratégie multi-sources proposée par un autre outil IA, jugée trop tôt pour la V1 mais notée pour plus tard) :
  - Scraping des listings Tripadvisor (`maxcopell/tripadvisor` ou `maxcopell/tripadvisor-things-to-do-scraper`, vérifiés réels et bien établis sur Apify)
  - Scraping des sites officiels de tourisme espagnols (TurEspaña, Visit Canary Islands) — jamais spécifié, aucune User Story à ce jour
  - Détection d'activités "exclusives" par comparaison entre plusieurs sources (ex. présentes sur Tripadvisor mais absentes de GetYourGuide) — idée intéressante, non spécifiée, à cadrer via `/cadre` si elle est retenue un jour

### Intégration Claude for Chrome
- Flux réel, précisé en session `/planifie` du 1er août 2026 : Claude for Chrome n'appelle jamais une
  API directement — l'extension opère un navigateur, elle n'a pas d'action générique "envoyer un JSON
  à une API". Le mécanisme est donc : Toto visite la page d'une activité → ouvre un second onglet sur
  une page dédiée d'ODOS, "Capture rapide" (version allégée du formulaire de création) → demande à
  Claude for Chrome de lire la page source et de remplir ce formulaire → la soumission enregistre la
  fiche avec `source='claude_chrome'` et `statut_validation='a_valider'`, directement dans la pile de
  l'écran 1. Ce parcours peut être enregistré comme "raccourci" réutilisable dans l'extension, pour ne
  plus avoir à redonner les instructions à chaque nouvelle page.
- Pont technique : `POST /activities/quick-capture` reste le point d'entrée backend, mais c'est la
  page "Capture rapide" du frontend ODOS qui l'appelle lors de la soumission — jamais l'extension
  directement. Décision réversible, ce point d'entrée reste stable même si le mécanisme de saisie
  évolue.
- Même formulaire de vérification pour le manuel et le semi-automatique (décision tranchée) — la page
  "Capture rapide" n'est qu'une variante d'entrée, la fiche rejoint ensuite le même circuit de
  validation que toutes les autres.

### Écran 3 — Planning partagé
- Depuis l'atelier, bouton **"PLANNING"** dans le menu du haut (déclencheur permanent, pas lié à une carte précise) → ouvre un **panneau latéral agenda**
- Glisser-déposer une carte depuis l'atelier vers ce panneau latéral pour la placer dans le planning
- Dans le panneau latéral, choix de la vue : **1 jour** ou **3 jours** ; bouton pour basculer vers l'**écran 3 complet** (planning plein écran, sans l'atelier)
- **Plus besoin d'un panneau catalogue séparé dans l'écran 3** (l'atelier remplit ce rôle via le panneau latéral) — l'écran 3 plein écran sert au travail de planification approfondi (vue d'ensemble, ajustements fins, gestion des conflits)
- **Création de blocs à la volée directement dans une case vide** du planning (ex: "Déjeuner à la maison") : clic pour poser l'heure de début, étirement pour fixer la durée — reprend les "blocs spéciaux" du cahier des charges d'origine (repas/trajet/pause, section 7.5), sans passer par un formulaire séparé
- Plage horaire du planning : par défaut 07:00–23:00 (déjà prévu dans le modèle `trips`, `planning_heure_debut`/`fin`). Si une activité tombe hors plage (ex: vol à 5h) : **bouton ponctuel "voir plus tôt / voir plus tard"** sur le jour concerné, sans modifier le réglage global du voyage
- **Navigation par flèches gauche/droite** pour changer de jour(s) affiché(s), en vue 1 jour comme en vue 3 jours (panneau latéral de l'atelier et écran 3 plein écran), sans changer la taille de la fenêtre de jours
- **Scroll vertical à la molette** dans la zone horaire du planning (défilement des heures), indépendant du zoom — reprend le comportement déjà prévu à l'origine (section 7.1)
- **Zoom accessible de deux façons en parallèle** : raccourci Ctrl + molette (rapide, expert) et curseur de zoom visible à l'écran (accessible, pas besoin de connaître le raccourci) — les deux pilotent la même valeur
- **Granularité de la grille au choix : 1/4 h ou 1/2 h**, via un bouton de bascule à deux positions dans la barre d'outils du Planning (quart d'heure par défaut). Décision issue de la phase `/design` : la précision au quart d'heure sert au placement fin, la demi-heure offre une lecture plus calme pour la relecture d'ensemble — plutôt que de trancher, on offre les deux
  - **Le bouton ne pilote que deux choses** : le pas d'aimantation au dépôt/étirement, et la densité des filets affichés
  - **Règle absolue : la bascule ne réécrit jamais les créneaux existants.** Un créneau posé à 10:15 reste à 10:15 en affichage demi-heure, simplement placé entre deux filets. Aucun arrondi, aucun déplacement en base
  - **C'est une préférence d'affichage, pas une donnée du voyage** : stockée en `localStorage` comme le niveau de zoom, **aucune colonne ajoutée en base de données**
  - Le backend continue de valider au quart d'heure en toutes circonstances (`% 15 == 0`) — la demi-heure est une commodité de saisie côté interface, jamais une contrainte de stockage
  - Détail complet dans `PRD_ecran3_planning.md`, section "Granularité de la grille"
- **Budget** : budget de la journée affiché au-dessus de chaque colonne (déjà prévu à l'origine) + **budget global du voyage affiché en permanence dans un coin supérieur**, visible quel que soit le jour consulté
- **Blocs verrouillés** : reprend le principe d'origine (vols, hôtels, transferts protégés contre les déplacements accidentels), **avec action de déverrouillage explicite** (pas seulement un verrouillage à sens unique)
- **Gestion des conflits simplifiée par rapport au cahier des charges d'origine** : pas de suggestions d'alternatives automatiques — **le dépôt est simplement bloqué sur une case déjà occupée**, à l'utilisateur de décaler manuellement l'activité en conflit

### Identité visuelle (phase `/design`)
- Direction validée le 30 juillet 2026, après plusieurs itérations écartées (palette crème type Claude, gris froid + lime type Dribbble minimal, glassmorphism pastel)
- Principes retenus : fond off-white **chaud** avec **texture topographique en relief** générée en SVG, typographie à **graisses mixtes** dans une même phrase, cartes dont le caractère vient de la **photo** et non d'un fond coloré, accent **lime utilisé avec parcimonie** (deux emplois seulement : action primaire et halo de focus), valeurs chiffrées en **pastille noire**
- Le détail complet du système sera formalisé dans `docs/DESIGN.md` — **fichier à créer, pas encore rédigé**

---

## 🟡 V2 — Prévu après le cœur fonctionnel

- **Fiches liées** — relier une activité à une ou plusieurs autres (table `activity_links`, déjà
  prévue dans `SCHEMA_BASE_DE_DONNEES.md`). *Correction du 1er août 2026 : ce point était listé par
  erreur en V1 ci-dessus ; `SCHEMA_BASE_DE_DONNEES.md` le taguait déjà correctement "V2 atelier"
  depuis l'origine. Aucune User Story formelle n'existe pour cette fonctionnalité — décidé en session
  `/planifie` de ne rien planifier sans User Story validée. cf. `PRD_ecran2_atelier.md`, Hors périmètre.*
- Upload de photos personnelles dans les fiches, en plus des photos issues du scraping (dépôt le soir)
- Zones nommées dans l'atelier façon "frames" Miro/FigJam (ex: "Jour 1 candidats", "À décider")
- Vue "tout le séjour" en un coup d'œil dans le Planning — question ouverte : comment afficher des créneaux de 15 min lisiblement sur plusieurs semaines

> Note : le "mode focus" de l'atelier (grisage des cartes non concernées par un filtre) était initialement prévu en V2. Il est **remonté en V1** par `PRD_ecran2_atelier.md`, en option à côté du contour coloré.

---

## 🔵 V3 / Idées futures

- **Calcul automatique du temps de trajet entre deux activités consécutives du planning** (ex: observatoire 9h-11h puis Santa Cruz à midi → signaler qu'il faut 90mn de trajet, donc conflit potentiel)
  - Prérequis : ajouter les coordonnées GPS (lat/lng) à chaque activité, récupérées automatiquement à la création (scraping/géocodage) ou saisies manuellement
  - Rejoint le Workflow 3 `optimize_planning` déjà prévu dans le cahier des charges d'origine (section 10), qui utilisait déjà des coordonnées lat/lng

- Prise de photos directement dans l'app pendant le déroulement de l'activité (photo terrain géolocalisée, horodatée)
- Résumé automatique de voyage en fin de séjour (texte + photos), généré à partir des activités/notes du voyage
- Option de création d'un **livre souvenir imprimé** à partir de ce résumé, avec intégration à un service d'impression externe (type CEWE, Blurb...) — sujet à part entière nécessitant son propre cadrage

---

## Phase 2 — Collecteur IA (projet séparé, cf. cahier des charges d'origine section 13)

- Agent Dify suggest_activities
- Agent Dify enrich_activity
- Agent Dify optimize_planning
- Chatbot travel_qa
- Pipeline scraping multi-sources (Apify + Firecrawl)
- **Résumé avis Tripadvisor, avec filtrage IA** pour ne conserver que les avis apportant une astuce, un problème ou un point d'intérêt (les avis génériques du type « très bien », « super » sont écartés) → alimente le champ `avis_utilisateurs`
- Badge Tripadvisor enrichi
- Score complétude automatique
- Météo par jour (OpenWeatherMap)

---

## 🔵 Infrastructure / Futur

- **Portabilité pour hébergement sur serveur distant** : si l'application est un jour hébergée ailleurs qu'en local, elle doit pouvoir embarquer toutes ses dépendances (Python, bibliothèques, etc.) et fonctionner de façon identique sur n'importe quel serveur, sans configuration manuelle — piste envisagée : conteneurisation (ex. Docker). Sujet à part entière, non prioritaire tant que l'usage reste local (cf. section 14 du cahier des charges d'origine : "Hébergement local uniquement en v1").

## ⚪ En réflexion / à trancher

*(aucun point ouvert pour le moment)*

---

*Document vivant — à mettre à jour à chaque session de conception. Ne pas hésiter à réorganiser les priorités entre les sections V1/V2/V3 selon l'avancement réel du projet.*
