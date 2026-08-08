# Plan : ODOS Travel Planner

> PRD source : `PRD_ecran0_dashboard.md`, `PRD_ecran1_creation.md`, `PRD_ecran2_atelier.md`, `PRD_ecran3_planning.md`
> Système de design : `docs/DESIGN.md`
> Schéma de données : `SCHEMA_BASE_DE_DONNEES.md`

## Décisions architecturales

Décisions durables qui s'appliquent à toutes les phases :

- **Routes** : `/trips`, `/trips/{id}/destinations`, `/destinations/{id}/activities`, `/activities/{id}`,
  `/activities/{id}/documents`, `/trips/{id}/tags`, `/trips/{id}/categories`, `/destinations/{id}/layouts`,
  `/trips/{id}/special_blocks`, `/trips/{id}/slots`, `/ai/suggest-destination`, `/activities/quick-capture`
- **Schema** : figé par `SCHEMA_BASE_DE_DONNEES.md` — aucune redéfinition dans ce plan, toute évolution
  de schéma passe d'abord par ce document.
- **Modèles clés** : Trip, TripDestination, Activity, Document, Tag, ScheduledSlot, Category,
  CardLayout, SpecialBlock.
- **Authentification** : aucune — application mono-utilisateur, pas de session ni de login.
- **Frontières tiers** : Apify et Claude for Chrome sont isolés derrière deux points d'entrée backend
  stables (`/ai/suggest-destination`, `/activities/quick-capture`) — jamais d'appel direct depuis le
  frontend vers un service externe. Pour Claude for Chrome spécifiquement : l'extension n'a pas
  d'action générique d'appel API, elle opère l'interface comme un utilisateur — `/activities/quick-capture`
  est donc appelée par une page dédiée du frontend ("Capture rapide"), jamais par l'extension
  directement. Détail complet en Phase 4.
- **État dérivé, jamais stocké** : l'état "placée/disponible" d'une activité se déduit de l'existence
  d'un `scheduled_slot` ; le prix total se calcule à l'affichage (`cout_par_personne × nb_personnes`) ;
  le score de complétude se recalcule à chaque lecture. Aucun de ces trois n'est une colonne stockée.
- **Préférences d'affichage vs données métier** : niveau de zoom et granularité de grille du Planning
  vivent en `localStorage`, jamais en base.
- **Système de design** : les tokens de `docs/DESIGN.md` s'appliquent dès qu'un écran est visible par
  l'utilisateur. Seule la Phase 1 (squelette technique interne) peut rester non stylée.
- **Hors périmètre confirmé** : les "fiches liées" (`activity_links`) sont reportées en V2, faute de
  User Story validée — cf. `PRD_ecran2_atelier.md`, Hors périmètre. Aucune phase ci-dessous n'y touche.

---

## Phase 1 : Squelette technique

**User stories** : Aucune — fondation technique, préalable à toute fonctionnalité.

### Ce qu'on livre
Le backend FastAPI démarre et sert les routes définies ci-dessus. La base SQLite est créée avec
l'intégralité du schéma de `SCHEMA_BASE_DE_DONNEES.md`, et un jeu de données de test est inséré : un
voyage "Canaries", ses deux destinations (La Palma, Tenerife), deux ou trois activités. Le frontend
React démarre, affiche la barre de navigation persistante (4 onglets, même si 3 mènent à des pages
encore vides) stylée avec les tokens de `docs/DESIGN.md`, et une page qui appelle une vraie route API
pour lister les activités d'une destination et les affiche à l'écran.

### Critères d'acceptation
- [ ] Le backend démarre sans erreur et sert les routes listées dans les décisions architecturales
- [ ] Les tables du schéma existent réellement en base, vérifiable via un client SQLite
- [ ] Le frontend affiche la nav persistante avec la police et les couleurs de `docs/DESIGN.md`
- [ ] La liste d'activités affichée provient d'un vrai appel réseau, jamais de données codées en dur
      dans un composant React
- [ ] Modifier une activité directement en base (hors interface) puis rafraîchir la page reflète le
      changement

## Bloquée par
- Aucune — démarrable immédiatement

---

## Phase 2 : Écran 1 — Création manuelle + panneau complet

**User stories** : US-1, US-5, US-10, US-12 (PRD1)

### Ce qu'on livre
Le formulaire de création manuelle complet, avec tous les champs pertinents du schéma et adaptation
des champs visibles selon `type_element` (ex. `numero_reference` pour un vol plutôt que `duree_min`).
Sauvegarde réelle en base. Le panneau complet d'édition (double-clic), réutilisable sur tous les
écrans, permet d'éditer tous les champs sans exception. Upload de documents (photo ou PDF), stockés
sur disque avec chemin relatif enregistré en base.

### Critères d'acceptation
- [ ] Créer une activité via le formulaire la fait apparaître en base avec tous les champs saisis
- [ ] Le formulaire adapte ses champs visibles selon le `type_element` choisi
- [ ] Le double-clic sur une fiche ouvre le panneau complet ; toute modification y persiste
- [ ] Un fichier (photo ou PDF) uploadé reste visible dans la fiche après rechargement de la page
- [ ] Le badge de provenance affiche "✏️ manuel" sur une fiche créée par ce formulaire

## Bloquée par
- Phase 1

---

## Phase 3 : Pile "À valider" — mode focus + corbeille écran 1

**User stories** : US-4, US-6, US-7, US-8, US-9, US-10, US-11 (PRD1)

### Ce qu'on livre
Vue "mode focus" présentant une fiche à la fois parmi celles au statut `a_valider` — des fiches de
test insérées manuellement avec ce statut suffisent à démontrer cette phase, sans dépendre du
scraping réel (Phase 4). Validation possible même incomplète. Rejet par glisser vers une corbeille ou
raccourci clavier, avec récupération pendant la période de grâce. Lien `url_source` cliquable pendant
la validation.

### Critères d'acceptation
- [ ] Une fiche `statut_validation='a_valider'` apparaît dans la pile, une seule à la fois
- [ ] Valider une fiche incomplète réussit sans blocage et bascule sur la fiche suivante
- [ ] Rejeter une fiche la fait apparaître dans la corbeille sans suppression réelle en base
      (`supprime_le` renseigné, ligne toujours présente)
- [ ] Une fiche rejetée peut être restaurée depuis la corbeille avant expiration du délai de grâce
- [ ] Le lien `url_source`, s'il existe, s'ouvre dans un nouvel onglet au clic

## Bloquée par
- Phase 2

---

## Phase 4 : Scraping Apify + capture Claude for Chrome

**User stories** : US-2, US-3 (PRD1)

### Ce qu'on livre
`POST /ai/suggest-destination` déclenche un scraping Apify réel pour une destination donnée et insère
les fiches résultantes en `a_valider` avec `source='scraping_auto'`. **Périmètre V1 : GetYourGuide
uniquement** — Tripadvisor est délibérément exclu de cette phase, ajoutable plus tard comme un second
traducteur (mapper) sans toucher au mécanisme lui-même.

**Déclenchement** : un bouton "Lancer un scraping" sur l'Écran 1, avec deux menus déroulants — la
source (GetYourGuide seul en V1 ; la liste s'allonge le jour où une nouvelle source est ajoutée, sans
changer ce mécanisme) et la destination (les `trip_destinations` du voyage).

**Ciblage de la destination** : le `destination_id` transmis à `/ai/suggest-destination` sert à deux
choses à la fois — il fournit le terme de recherche envoyé à l'actor Apify (le nom de la destination,
ex. "La Palma"), et il est appliqué à chaque fiche résultante. Pas d'ambiguïté possible : le bouton
cliqué détermine tout.

**Renouvellement des résultats d'une exécution à l'autre** : sans précaution, relancer un scraping sur
la même destination pourrait renvoyer exactement les mêmes 50 résultats par défaut (les plus
populaires) — qui seraient alors tous filtrés par la déduplication, pour zéro nouvelle fiche. Le point
de départ transmis à l'actor doit donc être décalé à chaque nouvelle exécution sur une même
destination (ex. à partir du nombre d'activités déjà connues pour cette destination), pour que
relancer le scraping ait un sens et fasse progressivement apparaître de nouvelles activités.

**Déduplication et plafond, plutôt qu'exhaustivité** : chaque exécution est bornée à **50 fiches
maximum**. L'objectif n'est pas de tout récupérer en un coup (une pile à valider de plusieurs
centaines de fiches serait ingérable en mode focus fiche par fiche), mais d'obtenir des lots
raisonnables, répétables. Avant d'insérer un résultat, le backend vérifie si une fiche portant la
même `url_source` existe déjà pour cette destination — **la recherche porte sur toutes les fiches
sans exception, y compris celles déjà rejetées et présentes dans la corbeille** (`supprime_le`
renseigné). Sans cette précision, une activité rejetée par l'utilisateur réapparaîtrait à chaque
nouveau scraping, ce qui viderait le rejet de son sens. Si une correspondance est trouvée, le résultat
est ignoré ; sinon, une nouvelle fiche est créée. Aucune nouvelle colonne requise, le schéma actuel
suffit. Les résultats sont insérés au fur et à mesure qu'Apify les produit, pas tous d'un coup à la
fin : rien n'est perdu si le scraping est interrompu en cours de route.

**Arrêt et reprise** : un bouton "Arrêter" pendant un scraping en cours annule l'exécution
correspondante côté Apify. Il n'existe pas de mécanisme de reprise dédié — grâce à l'insertion
incrémentale et à la déduplication par `url_source`, relancer simplement un nouveau scraping sur la
même destination revient au même : ce qui a déjà été récupéré n'est jamais dupliqué, seuls les
nouveaux résultats s'ajoutent.

**Cloisonnement entre sources** (cf. `CLAUDE.md`, règle 5.11) : le code de chaque source (GetYourGuide
aujourd'hui, une éventuelle autre source demain) est isolé dans son propre module, avec sa propre
gestion d'erreur. La panne d'une source n'affecte jamais les autres ni le reste d'ODOS — un scraping
GetYourGuide qui réussit reste acquis même si une autre source, lancée séparément, échoue.

Pour Claude for Chrome, une page dédiée du frontend, "Capture rapide" — une version allégée du
formulaire de création — est ajoutée. L'extension n'appelle jamais une API directement (elle opère un
navigateur, elle n'a pas d'action générique d'appel API) : elle lit la page source dans un onglet, puis
remplit et soumet cette page ODOS dans un autre onglet, comme le ferait Toto lui-même. La soumission
appelle `POST /activities/quick-capture`, qui enregistre la fiche avec `source='claude_chrome'`. Les
deux chemins (Apify et Capture rapide) alimentent la même pile que la Phase 3, sans logique de
validation dupliquée.

Pendant qu'un scraping Apify tourne, un indicateur "scraping en cours" reste visible à l'écran. Le
backend ne construit pas son propre système de suivi de tâches : Apify garde déjà le statut de chaque
exécution ("run"), le backend se contente de le relayer au frontend, qui interroge périodiquement un
point d'entrée léger tant que le statut n'est pas "terminé" ou "erreur". À la fin, l'indicateur se
transforme brièvement en confirmation ("3 nouvelles activités à classer") avant de s'effacer — en plus
du badge permanent de la pile "À valider" (US-9, PRD0), qui reste affiché tant que la pile n'est pas
vidée. Les deux sont distincts : la confirmation est ponctuelle, le badge est persistant.

### Critères d'acceptation
- [ ] Un appel à `/ai/suggest-destination` avec une destination réelle produit au moins une fiche
      dans la pile "À valider" avec `source='scraping_auto'`, issue de GetYourGuide
- [ ] Toutes les fiches issues d'un scraping déclenché pour une destination donnée (ex. La Palma)
      sont rattachées au bon `destination_id`, sans exception
- [ ] Une exécution ne produit jamais plus de 50 fiches
- [ ] Relancer un scraping déjà exécuté pour la même destination ne crée aucun doublon pour une
      activité déjà présente (même `url_source`) — seules les nouvelles activités s'ajoutent
- [ ] Une activité rejetée (présente dans la corbeille) ne réapparaît jamais dans un scraping
      ultérieur pour la même destination — la déduplication porte sur toutes les fiches, actives ou non
- [ ] Interrompre un scraping via le bouton "Arrêter" annule l'exécution côté Apify, et les fiches
      déjà insérées avant l'arrêt restent dans la pile "À valider" (rien n'est perdu)
- [ ] La page "Capture rapide" existe, distincte du formulaire de création manuelle, et sa soumission
      produit une fiche avec `source='claude_chrome'` et `statut_validation='a_valider'`
- [ ] Un appel de test direct à `/activities/quick-capture` avec un payload simulé fonctionne de la
      même façon, indépendamment de la page qui l'appelle
- [ ] Ces fiches passent par le mode focus de la Phase 3 sans code de validation dupliqué
- [ ] Le badge de provenance distingue visuellement 🕷️ scraping et 🌐 Claude for Chrome
- [ ] Le bouton "Lancer un scraping" et ses deux menus déroulants (source, destination) sont
      accessibles depuis l'Écran 1
- [ ] Relancer un scraping sur la même destination fait apparaître de nouvelles fiches à chaque fois
      (tant qu'il en reste à découvrir), pas systématiquement les 50 mêmes déjà connues
- [ ] Provoquer volontairement un échec du scraping GetYourGuide (ex. destination invalide) affiche
      une erreur claire côté Écran 1, sans jamais affecter le reste de l'application — la création
      manuelle, l'Atelier et le Planning restent utilisables normalement
- [ ] Un indicateur "scraping en cours" est visible dès le déclenchement et disparaît proprement à
      la fin — succès ou erreur, jamais un état bloqué indéfiniment
- [ ] À la fin d'un scraping réussi, l'indicateur affiche brièvement le nombre de nouvelles fiches
      ("3 nouvelles activités à classer") avant de s'effacer ; le badge permanent de la pile "À
      valider" reste, lui, affiché tant qu'elle n'est pas vidée
- [ ] La page "Capture rapide" est accessible via un lien secondaire depuis l'Écran 1, sans figurer
      dans la barre de navigation principale, et via une URL stable indépendante de toute session
- [ ] Ajouter Tripadvisor plus tard ne nécessite qu'un nouveau mapper, aucune modification du
      mécanisme de scraping, de la pile, ou de l'indicateur de progression

## Bloquée par
- Phase 3

---

## Phase 5 : Écran 2 — Atelier : canvas, piles, corbeille

**User stories** : US-1, US-2, US-8, US-9, US-10 (PRD2)

### Ce qu'on livre
Canvas `@xyflow/react` affichant les activités validées d'une destination. Piles automatiques par
catégorie au premier chargement, dont une pile "Suggestions IA" toujours vide en V1. Positions
persistantes (disposition "en cours" sauvegardée en continu). Corbeille de l'atelier, distincte de
celle de l'écran 1. Panneau complet accessible en double-clic (réutilise la Phase 2).

### Critères d'acceptation
- [ ] Les activités validées d'une destination s'affichent en cartes sur le canvas, regroupées en
      piles par catégorie au premier chargement
- [ ] Déplacer une carte puis recharger la page conserve sa nouvelle position
- [ ] Glisser une carte vers la corbeille de l'atelier la retire du canvas sans la supprimer
      (récupérable, distincte de la corbeille de l'écran 1)
- [ ] Le texte d'une carte reste lisible à un niveau de zoom éloigné comme rapproché
- [ ] La pile "Suggestions IA" est visible et vide

## Bloquée par
- Phase 2

---

## Phase 6 : Atelier — filtres, dispositions nommées, onglets destinations

**User stories** : US-3, US-4, US-5, US-6, US-11 (PRD2)

### Ce qu'on livre
Filtres combinables (prix, lieu, tag, type) avec bascule ET/OU. Deux modes de mise en valeur : contour
lime (Surligner) ou grisage (Regrouper propose une nouvelle disposition nommée). Sauvegarde et
rechargement de dispositions nommées. Onglets de navigation entre les destinations du voyage.

### Critères d'acceptation
- [ ] Combiner deux filtres en mode ET ne montre que les fiches correspondant aux deux ; en mode OU,
      l'une ou l'autre suffit
- [ ] Le mode "Surligner" laisse les positions inchangées ; le mode "Regrouper" réorganise
      physiquement et propose de nommer la disposition résultante
- [ ] Une disposition nommée sauvegardée puis rechargée restitue exactement les positions enregistrées
- [ ] Changer d'onglet destination affiche le canvas propre à cette destination, sans mélange

## Bloquée par
- Phase 5

---

## Phase 7 : Écran 3 — Planning plein écran : créneaux, budget, conflits, granularité

**User stories** : US-3, US-4, US-6, US-7, US-9, US-10, US-11, US-12, US-13, US-16, US-17, US-18,
US-19, US-20 (PRD3)

### Ce qu'on livre
Vue plein écran jour / 3 jours / semaine, navigation par pas adapté à la vue active. Créneaux affichés
avec couleur de catégorie et nom. Survol d'un créneau occupé → fiche complète. Clic sur une adresse →
proposition Google Maps. Dépôt sur créneau occupé bloqué, sans suggestion d'alternative. Verrouillage
et déverrouillage explicite. Budget par jour et budget global affiché en permanence. Zoom (Ctrl+molette
et curseur visible). Blocs libres avec libellé, coût et catégorie. Bloc "frais supplémentaires" à côté
d'une activité déjà planifiée. Bascule de granularité 1/4 h ↔ 1/2 h, sans jamais déplacer les créneaux
existants. Pour démontrer cette phase, la création d'un créneau se fait via une action simple depuis
le panneau complet d'une fiche — le glisser-déposer depuis l'Atelier est la Phase 8.

### Critères d'acceptation
- [ ] Les vues jour / 3 jours / semaine affichent les créneaux existants avec la couleur de leur
      catégorie
- [ ] Survoler un créneau occupé affiche la fiche complète de l'activité correspondante
- [ ] Cliquer une adresse dans une fiche propose l'ouverture de Google Maps
- [ ] Déposer sur un créneau déjà occupé est refusé, sans suggestion automatique
- [ ] Un créneau verrouillé refuse tout déplacement tant qu'il n'a pas été explicitement déverrouillé
- [ ] Le budget affiché (par jour et global) intègre à la fois les activités et les blocs libres
- [ ] Basculer la granularité 1/4 h ↔ 1/2 h ne modifie aucun `scheduled_slot` existant en base —
      vérifiable : les heures stockées sont strictement identiques avant et après la bascule
- [ ] Le backend refuse tout créneau dont l'heure n'est pas un multiple de 15 minutes, quelle que
      soit la granularité affichée côté interface

## Bloquée par
- Phase 2

---

## Phase 8 : Pont Atelier ↔ Planning

**User stories** : US-1, US-5, US-8, US-14, US-15 (PRD3) + US-7 (PRD2)

### Ce qu'on livre
Panneau latéral Planning (vue 1 jour ou 3 jours) ouvrable depuis l'Atelier via une languette fixe sur
le bord droit, avec révélation automatique quand une carte en cours de glisser approche de ce bord.
Glisser une carte du canvas vers un créneau du panneau crée réellement un `scheduled_slot`. Une fois
placée, la fiche devient très transparente dans l'Atelier — cet état, dérivé de l'existence du
`scheduled_slot`, prime toujours sur l'affichage des filtres actifs.

### Critères d'acceptation
- [ ] La languette sur le bord droit de l'Atelier ouvre et ferme le panneau latéral
- [ ] Approcher une carte en cours de glisser du bord droit révèle automatiquement le panneau
- [ ] Glisser une carte sur un créneau libre du panneau crée un `scheduled_slot` réel
- [ ] Une fiche placée apparaît très transparente dans l'Atelier même si elle correspond à un filtre
      actif en même temps — l'état "placée" reste visuellement dominant
- [ ] Le bouton de bascule vers le Planning plein écran (Phase 7) ne perd le travail en cours ni
      dans l'un ni dans l'autre

## Bloquée par
- Phase 6, Phase 7

---

## Phase 9 : Écran 0 — Dashboard

**User stories** : US-1 à US-10 (PRD0)

### Ce qu'on livre
Écran d'accueil systématique au lancement (jamais de reprise du dernier écran consulté). Nom et dates
du voyage, compte à rebours. Budget global avec bascule destination / catégorie / jour. Répartition
des activités par destination, avec accès direct à l'atelier correspondant. Nombre d'activités déjà
placées dans le planning. Alerte si la pile "À valider" contient des fiches en attente. Accès permanent
via la barre de navigation.

### Critères d'acceptation
- [ ] L'application s'ouvre systématiquement sur le Dashboard, quel que soit le dernier écran visité
      à la fermeture précédente
- [ ] Le compte à rebours affiche le bon nombre de jours avant le départ
- [ ] Cliquer sur une destination du Dashboard ouvre directement son Atelier
- [ ] La bascule destination / catégorie / jour affiche des totaux différents, cohérents avec les
      données réelles
- [ ] Une fiche en attente dans la pile "À valider" déclenche une alerte visible sur le Dashboard,
      sans avoir à ouvrir l'Écran 1

## Bloquée par
- Phase 8

---

## Phase 10 : Écran de démarrage

**User stories** : Aucune formelle — hors PRD, prototypé en amont de la phase de code
(`SplashScreen.jsx`).

### Ce qu'on livre
L'animation de particules déjà prototypée, branchée en tête d'application. Elle ne s'affiche qu'au
tout premier chargement — jamais en revenant sur le Dashboard depuis un autre écran — et révèle le
Dashboard une fois terminée.

### Critères d'acceptation
- [ ] L'animation se joue au lancement de l'application, une seule fois
- [ ] Naviguer entre les écrans ensuite ne redéclenche jamais l'animation
- [ ] Le Dashboard apparaît en fondu à la fin de l'animation, sans saut ni flash

## Bloquée par
- Phase 9

---

## Phase 11 : Écran 1 — Mode consultation/modification + persistance du scroll

**User stories** : US-13, US-14, US-15 (PRD1)

### Ce qu'on livre
Un toggle à deux positions ("Consultation" / "Modification") dans la barre horizontale de l'écran
Création, au-dessus de la grille de fiches validées. Le mode actif détermine le comportement du
double-clic sur une fiche : en consultation, le panneau complet s'ouvre en lecture seule avec galerie
photo visible, présentation centrée sur fond flou (réutilise le style déjà existant du panneau complet
de l'Atelier) ; en modification, le panneau complet garde son comportement actuel (édition de tous les
champs). Mode par défaut à l'ouverture de l'écran : consultation. Correction du bug de réinitialisation
du scroll : fermer le panneau complet, quel que soit le mode, restitue la grille exactement à sa
position de défilement précédente (état conservé côté frontend, pas en base ni en `localStorage`).

### Critères d'acceptation
- [ ] Le toggle est visible et accessible dans la barre horizontale de l'écran Création
- [ ] En mode consultation, double-cliquer une fiche ouvre un panneau en lecture seule avec galerie
      photo, sans aucun champ éditable
- [ ] En mode modification, double-cliquer une fiche ouvre le panneau complet éditable existant
      (comportement inchangé par rapport à la Phase 2)
- [ ] Changer de mode via le toggle prend effet immédiatement sur toute la grille, sans rechargement
      de page
- [ ] À l'ouverture de l'écran Création, le mode actif est "Consultation"
- [ ] Faire défiler la grille, ouvrir une fiche en double-clic, la fermer : la grille est exactement à
      la même position de défilement qu'avant l'ouverture — vérifiable sur plusieurs fiches
      consécutives à des positions de scroll différentes

## Bloquée par
- Phase 2 (grille de fiches validées et panneau complet)

---

## Phase 12 : TripAdvisor — pipeline Firecrawl, activités gratuites, résumés d'avis

**User stories** : US-16 (PRD1)

### Contexte de la décision (7-8 août 2026)

Apify a été testé et validé techniquement (voir Journal des tests ci-dessous), mais son modèle
économique ne convient pas à un usage personnel ponctuel : le crédit gratuit de 5$/mois a été épuisé
par ~50 activités GetYourGuide, et l'abonnement Starter (29$/mois récurrent) est disproportionné.

Un scraper Python maison (`requests` + `BeautifulSoup`) a également été testé le 7 août : la requête
sur une page TripAdvisor **n'a jamais abouti** (aucune réponse après 10 minutes, malgré un
`timeout=15` — comportement typique d'une protection anti-bot qui ralentit volontairement les clients
suspects plutôt que de les rejeter franchement). Conclusion : le scraping direct sans infrastructure
de contournement n'est pas viable sur TripAdvisor.

**Décision retenue : Firecrawl.** Plan gratuit à 1000 crédits/mois, sans carte bancaire, renouvelé
mensuellement. Deux avantages décisifs sur les alternatives :
1. Gère nativement l'anti-bot via son mode `proxy: "stealth"` (5 crédits/page au lieu de 1).
2. Son format de sortie `json` fait l'**extraction structurée par LLM à partir d'un prompt en
   français** — aucun sélecteur CSS à écrire ni à maintenir. C'est ce qui rend la solution tenable
   pour un projet mené par un non-développeur : une refonte du design de TripAdvisor ne casse pas le
   pipeline.

### Ce qu'on livre

Un script Python autonome (`scripts/pipeline_tripadvisor.py`), hors du code applicatif ODOS, lancé
par une seule commande. Il ne s'exécute jamais automatiquement : c'est un outil d'alimentation lancé
à la demande, par destination.

**Périmètre du premier lancement : les attractions à entrée gratuite**, sur La Palma et Tenerife.
C'est l'objectif prioritaire de l'utilisateur (repérer les activités non payantes qui n'apparaissent
pas sur GetYourGuide et dont la lecture manuelle des avis prendrait des heures).

TripAdvisor expose des URLs de filtres officiels, ce qui évite tout tri heuristique côté script :
- Entrée gratuite (`zft11292`) :
  `https://www.tripadvisor.com/Attractions-g{GEO}-Activities-zft11292-{SLUG}.html`
- Budget-friendly (`zft11309`) : même schéma, autre code de filtre.
- Codes géographiques : La Palma = `g187475`, Tenerife = `g187479`.
- **À vérifier au premier lancement** : l'URL Tenerife avec filtre gratuit n'a pas encore été testée
  (déduite par analogie). Le script doit échouer proprement avec un message explicite si l'URL ne
  renvoie pas de résultats, plutôt que de continuer silencieusement.

**Étapes du pipeline :**
1. **Liste** — Firecrawl scrape les pages de listing filtrées (pagination incluse) et en extrait
   nom, note, nombre d'avis, URL de la fiche.
2. **Détail + avis** — pour chaque attraction, Firecrawl scrape sa page (format `json`, prompt en
   français) : nom, note, adresse, `locationString`, catégorie, URL de la photo principale, et les
   avis les plus utiles (plafonnés à 15-20, pas d'exhaustivité).
3. **Photos** — l'URL de la photo obtenue à l'étape 2 est téléchargée par une requête HTTPS directe
   vers le CDN d'images. **Aucun crédit Firecrawl consommé** : les CDN d'images ne sont pas protégés
   par de l'anti-bot. Le fichier est stocké selon la convention du schéma
   (`uploads/activities/{activity_id}/{uuid}.jpg`), conformément à la règle « jamais un lien externe
   direct ».
4. **Résumé** — les avis (multilingues) sont envoyés à l'API Claude qui produit une synthèse
   pratique **en français**, orientée conseils concrets (accès, horaires, ce qu'il faut prévoir),
   pas une paraphrase des avis. Le résumé alimente `avis_utilisateurs`.
5. **Intégration ODOS** — via l'**API FastAPI d'ODOS**, jamais par écriture directe en base : le
   script réutilise ainsi la validation métier existante, et bénéficie automatiquement de ses
   évolutions futures.
   - **Correspondance trouvée** (nom + destination normalisés, même logique que la Phase 4
     GetYourGuide) : la fiche existante reçoit `avis_utilisateurs` (le résumé) et
     `lien_avis_tripadvisor` (l'URL de la page TripAdvisor). Aucun doublon créé.
   - **Aucune correspondance** : création d'une fiche `statut_validation='a_valider'`,
     `source='scraping_auto'`, `url_source` = page TripAdvisor. Elle rejoint le mode focus de la
     Phase 3 comme n'importe quelle fiche scrapée, sans code de validation dupliqué.
6. **Restitution** — génération d'un fichier HTML statique autonome
   (`sorties/tripadvisor_{destination}_{date}.html`) présentant les résultats du run : attractions
   trouvées, résumés, photos, et pour chacune si elle a été rattachée à une fiche existante ou créée
   comme nouvelle fiche. Ouvert par simple double-clic, sans serveur.

**Robustesse — exigence de premier ordre** (l'utilisateur n'est pas développeur et ne doit pas avoir
à déboguer) :
- **Points de contrôle** : l'état d'avancement est écrit sur disque après chaque attraction traitée.
  Une interruption à la 40ᵉ attraction reprend à la 40ᵉ, pas à zéro — et ne re-consomme pas les
  crédits déjà dépensés.
- **Escalade de proxy** : essai en `proxy: "basic"` (1 crédit) d'abord, bascule automatique en
  `"stealth"` (5 crédits) seulement si la page échoue. Économise jusqu'à 5× les crédits.
- **Mode `--dry-run`** : déroule tout le pipeline et affiche ce qui serait créé ou modifié, sans
  écrire ni dans ODOS ni sur le disque.
- **Plafond de crédits** : paramètre `--max-credits` qui arrête proprement le run avant d'épuiser le
  quota mensuel, avec un point de contrôle exploitable au lancement suivant.
- **Journal lisible** : une ligne par attraction, en français, indiquant l'action effectuée.
- Cloisonnement des sources respecté (`CLAUDE.md`, règle 5.11) : l'échec du scraping, du résumé ou
  du téléchargement de photo d'une attraction n'interrompt jamais le traitement des suivantes.

### Critères d'acceptation
- [x] Une seule commande lance le pipeline complet pour une destination donnée (`scripts/pipeline_tripadvisor.py`)
- [x] `--dry-run` affiche le résultat attendu sans rien écrire dans ODOS ni sur disque
- [x] Le script traite les attractions de La Palma, puis de Tenerife
- [x] Une archive locale pérenne (`data/tripadvisor_canaries_archive.json`) préserve les 17 synthèses structurées
- [x] `avis_utilisateurs` contient un résumé structuré en français (Accès, Horaires, Équipement, Lampe rouge, Réservations)
- [x] Le backend ODOS intègre la source `tripadvisor` avec priorité à l'archive pérenne
- [x] Le fichier HTML autonome `guide_interactif_canaries.html` présente les résultats en mode Grille & Magazine
- [x] Le document hors-ligne `Guide_Canaries_Avis_TripAdvisor.pdf` est généré et téléchargeable
- [x] Un échec sur une attraction n'interrompt pas le traitement des autres (cloisonnement respecté)

### Hors périmètre de cette phase
- **Webapp de présentation dédiée** : le fichier HTML statique de l'étape 6 couvre le besoin. Une
  vraie webapp (serveur, routes, base) serait un projet à part entière — à rouvrir seulement si
  l'usage réel du HTML statique montre qu'il ne suffit pas.
- **GetYourGuide Tenerife** : à traiter dans un second temps, une fois le pipeline TripAdvisor
  validé. Le même script pourra être étendu (les étapes 3 à 6 sont communes), mais ce n'est pas
  l'objectif de ce premier lancement.
- **Attractions payantes TripAdvisor** : le filtre `zft11292` les exclut volontairement. Élargir le
  périmètre est un simple changement d'URL une fois le pipeline éprouvé.

### Journal des tests réalisés (à conserver)
- **Apify `maxcopell/tripadvisor`** (7 août, La Palma) : 10 résultats, $0,05. Champs :
  `name`, `category`, `rating`, `address` (texte libre), `webUrl`, `numberOfReviews`. Pas de GPS.
- **Apify `maxcopell/tripadvisor-reviews`** (7 août) : 28 avis, $0,14. Champ clé :
  `placeInfo.locationString` (« La Palma, Canary Islands ») — **plus fiable que `address`** pour la
  correspondance destination. Avis constatés en 6 langues sur un seul lieu.
- **Scraper Python maison** (7 août) : échec, aucune réponse (anti-bot silencieux).
- **Firecrawl** : plan gratuit 1000 crédits/mois confirmé, mode `stealth` à 5 crédits/page. Test sur
  page TripAdvisor non abouti (quota anonyme partagé épuisé) — **à refaire avec la clé API
  personnelle, en tout premier**, avant d'écrire le reste du pipeline.

## Bloquée par
- Phase 3 (mode focus), Phase 11 (affichage du lien sur la fiche)
- Création d'un compte Firecrawl gratuit et obtention de la clé API
