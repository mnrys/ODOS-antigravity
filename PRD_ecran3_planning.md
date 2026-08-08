# PRD — Écran 3 : Planning

> Document produit via la démarche `/cadre`. Toute évolution de ce périmètre doit être répercutée ici avant d'écrire du code.

**Date :** 30 juillet 2026, 18h05

---

## Problème

Sans écran de planning dédié, l'utilisateur devait soit rester dans l'Atelier sans vue d'ensemble temporelle claire, soit perdre le contact avec son catalogue d'activités en travaillant sur le planning. Il lui manquait un moyen de passer rapidement de la comparaison d'activités (Atelier) à leur mise en place concrète dans le temps (Planning), sans naviguer lourdement entre deux écrans complètement séparés — d'où le besoin d'un panneau latéral léger en complément d'une vue plein écran pour le travail de planification approfondi.

## Solution

Le Planning propose deux modes d'accès complémentaires : un panneau latéral léger, ouvert depuis l'Atelier, pour glisser rapidement une activité sélectionnée sur un jour proche ; et une vue plein écran dédiée, pour le travail de planification approfondi (vues jour/3 jours/semaine, navigation, gestion des conflits, budget). Une fois le voyage commencé, cette même vue sert aussi de consultation quotidienne — notamment sur mobile — pour connaître le programme du jour et accéder en un clic aux détails pratiques d'une activité (documents, adresse, itinéraire).

## Utilisateur cible

Toto, utilisateur unique de l'application (usage solo, pas d'authentification). Il utilise le Planning de deux façons distinctes : en **planification active**, principalement sur ordinateur, pour organiser et ajuster ses activités dans le temps ; et en **consultation quotidienne**, principalement sur mobile pendant le voyage, pour connaître le programme du jour et accéder rapidement aux détails pratiques d'une activité (documents, voucher, adresse).

## User Stories

- **US-1** — En tant qu'utilisateur, je veux ouvrir un panneau latéral Planning depuis l'Atelier, afin de glisser rapidement une activité sélectionnée sans quitter mon espace de comparaison.
- **US-2** — En tant qu'utilisateur, je veux basculer vers une vue Planning plein écran, afin de travailler en profondeur sur l'organisation de mon voyage.
- **US-3** — En tant qu'utilisateur, je veux choisir entre une vue jour, 3 jours ou semaine, afin d'adapter le niveau de détail à ce que je veux faire.
- **US-4** — En tant qu'utilisateur, je veux naviguer d'un pas correspondant à ma vue actuelle (jour, 3 jours ou semaine), afin de parcourir mon voyage sans changer la taille de la fenêtre affichée.
- **US-5** — En tant qu'utilisateur, je veux glisser une activité sur un créneau libre, afin de la planifier à une heure précise.
- **US-6** — En tant qu'utilisateur, je veux qu'un créneau occupé affiche le nom et la couleur de catégorie de l'activité, afin de l'identifier en un coup d'œil sans avoir à cliquer.
- **US-7** — En tant qu'utilisateur, je veux survoler un créneau occupé pour voir la fiche complète de l'activité, afin de vérifier son contenu sans quitter le planning.
- **US-8** — En tant qu'utilisateur, je veux cliquer sur une activité pour ouvrir sa fiche (notamment sur mobile), afin d'accéder à ses détails pratiques (documents, adresse) pendant le voyage.
- **US-9** — En tant qu'utilisateur, je veux cliquer sur une adresse dans une fiche pour ouvrir Google Maps, afin d'obtenir mon itinéraire facilement.
- **US-10** — En tant qu'utilisateur, je veux qu'un dépôt sur un créneau déjà occupé soit bloqué, afin d'éviter les chevauchements sans avoir besoin de suggestions automatiques.
- **US-11** — En tant qu'utilisateur, je veux verrouiller un créneau (vol, hôtel, transfert) et le déverrouiller explicitement si besoin, afin d'éviter un déplacement accidentel tout en gardant la main dessus.
- **US-12** — En tant qu'utilisateur, je veux voir le budget de la journée affiché par colonne et le budget global du voyage en permanence, afin de suivre mes dépenses sans calcul manuel.
- **US-13** — En tant qu'utilisateur, je veux zoomer via Ctrl+molette ou un curseur visible, afin d'ajuster la précision d'affichage selon ma préférence du moment.
- **US-14** — En tant qu'utilisateur, je veux ouvrir ou fermer le panneau latéral Planning depuis l'Atelier via une languette dédiée sur le bord de l'écran, afin de le consulter à tout moment même sans activité en main.
- **US-15** — En tant qu'utilisateur, je veux que le panneau latéral se révèle automatiquement quand j'approche une fiche du bord de l'écran en la faisant glisser, afin de la déposer directement sans étape intermédiaire.
- **US-16** — En tant qu'utilisateur, je veux créer un bloc libre dans une case vide du planning avec un libellé de mon choix (ex: "Sieste", "Shopping"), afin de représenter une activité non planifiée à l'avance.
- **US-17** — En tant qu'utilisateur, je veux associer un coût et une catégorie de dépense à ce bloc libre, afin qu'il soit intégré à mon suivi de budget.
- **US-18** — En tant qu'utilisateur, je veux pouvoir ajouter un bloc "frais supplémentaires" à côté d'une activité déjà planifiée, afin d'ajuster son coût réel sans modifier la fiche d'origine.
- **US-19** — En tant qu'utilisateur, je veux basculer l'affichage de la grille entre le quart d'heure et la demi-heure, afin de choisir entre précision maximale et lecture plus calme selon ce que je suis en train de faire.
- **US-20** — En tant qu'utilisateur, je veux que ce changement de granularité ne déplace jamais mes créneaux déjà posés, afin de pouvoir basculer d'un affichage à l'autre sans risque de perdre un placement précis.
- **US-21** — En tant qu'utilisateur, je veux dupliquer rapidement un créneau existant en maintenant la touche `Alt` lors du glisser-déposer (`Alt+Drag`), afin de créer un clone autonome posé sur un nouveau jour/horaire sans déplacer l'original.
- **US-22** — En tant qu'utilisateur, je veux disposer d'un bouton de duplication rapide au survol du créneau, afin de pouvoir cloner une activité facilement même sans clavier.

## Critères de succès

- Une activité peut être glissée depuis l'Atelier vers le Planning (panneau latéral) sans erreur de placement.
- Un créneau occupé affiche sans ambiguïté le nom de l'activité et sa catégorie (couleur), identifiable en un coup d'œil.
- Le survol d'un créneau occupé affiche la fiche complète de l'activité correspondante.
- Le geste `Alt+Drag` sur un créneau crée un clone autonome (activité ou bloc libre) au nouvel emplacement horaire sans déplacer le créneau d'origine.
- La fiche clonée est indépendante et peut être éditée sans altérer la fiche source (addition, photos, prix).
- Le programme du jour est consultable rapidement sur mobile, avec accès en un clic aux détails pratiques (documents, adresse, itinéraire).
- Le passage entre panneau latéral et vue plein écran se fait sans perte du travail en cours.
- La navigation (jour/3 jours/semaine) permet de retrouver n'importe quel jour du séjour en quelques clics.
- Le passage de la grille du quart d'heure à la demi-heure, puis le retour, laisse tous les créneaux exactement là où ils étaient — y compris ceux posés sur un quart d'heure non multiple de 30 minutes.

## Hors périmètre

- La vue "tout le séjour" en un coup d'œil (voir Notes complémentaires — piste V2).
- Les suggestions d'alternatives automatiques en cas de conflit : le dépôt est simplement bloqué, l'utilisateur décale manuellement.
- Le calcul automatique du temps de trajet entre deux activités consécutives (V3, dépend des coordonnées GPS).
- La gestion complète de documents génériques (voucher, billets) : le besoin est identifié ici mais la structure de données correspondante sera traitée dans `PRD_ecran1_creation.md` et `SCHEMA_BASE_DE_DONNEES.md`.
- Toute fonctionnalité de partage ou de consultation par d'autres personnes que Toto.
- Une granularité de grille autre que le quart d'heure et la demi-heure (pas de 5 min, pas de 10 min, pas d'heure pleine).

## Décisions d'implémentation

- Le mode panneau latéral et le mode plein écran affichent le même planning, sans duplication ni divergence de données.
- Vues disponibles : jour (grande), 3 jours, semaine.
- Navigation par flèches, avec un pas correspondant à la vue active (1 jour, 3 jours, ou 1 semaine).
- Créneau occupé : couleur de catégorie + nom de l'activité toujours visibles, miniature optionnelle, style visuel sobre et cohérent avec le reste de l'application.
- Survol d'un créneau occupé → affichage de la fiche complète de l'activité (pas une simple miniature agrandie).
- Sur mobile, le clic (plutôt que le survol) ouvre la fiche de l'activité, avec accès direct à ses documents et à son adresse.
- Clic sur une adresse dans une fiche → proposition d'ouverture de Google Maps.
- Dépôt sur un créneau occupé : bloqué simplement, sans suggestion d'alternative.
- Blocs verrouillés : déverrouillage explicite requis avant tout déplacement.
- Budget : affiché par jour au-dessus de chaque colonne, et budget global du voyage affiché en permanence dans un coin, quelle que soit la vue.
- Zoom : accessible à la fois par Ctrl+molette et par un curseur visible à l'écran, les deux pilotant la même valeur.
- Le bouton "Planning" du menu du haut (à côté de Dashboard/Création/Atelier) bascule directement en vue plein écran.
- L'ouverture du panneau latéral, depuis l'Atelier, est un accès distinct du bouton de menu : une languette fixe sur le bord droit de l'écran permet de l'ouvrir/fermer à volonté ; en complément, le panneau se révèle aussi automatiquement quand une fiche en cours de glissement approche du bord droit.
- Un bloc libre créé dans une case vide accepte un libellé texte libre, un coût, et une catégorie de dépense (choisie parmi les catégories système ou les catégories personnalisées du voyage) — sans distinction entre coût "prévu" et "réel" : chaque bloc porte simplement son propre montant.
- Un ajustement de coût sur une activité déjà planifiée (ex: dépense imprévue en cours d'activité) se fait en ajoutant un bloc libre à côté, plutôt qu'en modifiant le coût de la fiche d'origine.
- Le budget (par jour, global, par catégorie) intègre automatiquement le coût des blocs libres en plus de celui des activités.

### Granularité de la grille (quart d'heure / demi-heure)

- Un bouton de bascule à deux positions, **1/4 h** et **1/2 h**, est présent dans la barre d'outils du Planning, à côté du sélecteur de vue et du curseur de zoom. Le quart d'heure est la valeur par défaut.
- Ce bouton pilote exactement deux choses, et rien d'autre :
  1. **le pas d'aimantation** appliqué lors d'un dépôt, d'un déplacement ou d'un étirement de bloc ;
  2. **la densité des filets** de subdivision affichés dans la grille.
- **Règle absolue — la bascule ne réécrit jamais les créneaux existants.** Passer en affichage demi-heure ne déplace, n'arrondit ni ne modifie aucun `scheduled_slot` déjà enregistré. Un créneau posé à 10:15 reste à 10:15 : il est simplement affiché entre deux filets. Le retour en affichage quart d'heure doit rendre l'écran strictement identique à ce qu'il était avant la bascule. Toute implémentation qui recalculerait les créneaux au changement de granularité est un défaut, pas une optimisation.
- **La granularité est une préférence d'affichage, pas une donnée du voyage.** Elle est stockée localement dans le navigateur (`localStorage`), exactement comme le niveau de zoom. **Aucune colonne n'est ajoutée en base de données** — ni dans `trips`, ni ailleurs. `SCHEMA_BASE_DE_DONNEES.md` n'est pas impacté par cette décision.
- **Le backend continue de valider au quart d'heure en toutes circonstances**, indépendamment de ce que l'interface affiche : la contrainte reste `heure_debut % 15 == 0` et `heure_fin % 15 == 0`. La demi-heure est une commodité de saisie côté interface, jamais une contrainte de stockage. Cela garantit qu'une fiche posée au quart d'heure depuis un autre point d'entrée (panneau latéral, mobile, import) reste toujours valide.
- Le bouton de granularité et le curseur de zoom sont **indépendants** : changer l'un ne modifie jamais l'autre. Techniquement, toute la géométrie de la grille se calcule à partir d'une seule valeur — la hauteur d'une heure en pixels, pilotée par le zoom — dont on dérive la subdivision (divisée par 4 ou par 2 selon la granularité choisie). Aucune hauteur de créneau ne doit être écrite en dur dans le code.

## Notes complémentaires

- Le Planning n'est pas un écran autonome comme les trois autres (Dashboard, Écran 1, Atelier) : il existe sous deux formes liées — un panneau latéral intégré à l'Atelier, et une vue plein écran dédiée. Cette spécificité architecturale doit être prise en compte lors du découpage technique (`/planifie`), probablement comme un composant partagé plutôt que deux implémentations séparées.
- Une vue "tout le séjour" en un coup d'œil a été évoquée comme un plus possible, mais reportée en V2 — question ouverte : comment afficher des créneaux de 15 min lisiblement sur plusieurs semaines.
- Le besoin de documents attachés aux fiches (voucher, PDF) au-delà des photos a été identifié pendant ce cadrage — à traiter dans une mise à jour de `PRD_ecran1_creation.md` et `SCHEMA_BASE_DE_DONNEES.md`, pas dans ce PRD.
- Une réflexion sur l'hébergement de l'application (portabilité complète avec ses dépendances sur un serveur distant, type conteneur) a été évoquée — hors sujet de ce PRD, à noter dans `BACKLOG.md` comme sujet d'infrastructure séparé.
- La granularité de grille (US-19, US-20) est née de la phase `/design` : la première maquette du Planning laissait croire à une grille en demi-heures, ce qui a fait apparaître que les deux lectures avaient chacune leur intérêt selon le moment — précision pour le placement fin, calme visuel pour la relecture d'ensemble. Plutôt que de trancher entre les deux, on offre les deux.

---

*Ce PRD remplace la version du 28 juillet 2026, 21h30. Seule évolution : ajout de la granularité de grille (US-19, US-20, section "Granularité de la grille", critère de succès associé, ligne de hors-périmètre). Le reste est inchangé.*
