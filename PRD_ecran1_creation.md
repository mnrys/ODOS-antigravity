# PRD — Écran 1 : Création

> Document produit via la démarche `/cadre`. Toute évolution de ce périmètre doit être répercutée ici avant d'écrire du code.

**Date :** 27 juillet 2026 (révisé 1er août 2026, 18h20 — pont Claude for Chrome et page Capture rapide précisés ; révisé 7 août 2026, 15h40 — grille de fiches validées et US-13 à US-15 ; révisé 8 août 2026, 23h10 — mode consultation par défaut avec modale dédiée `ActivityDetailModal`, scraping multi-sources TripAdvisor/Firecrawl avec archive locale pérenne, et consignation de l'anomalie de scraping GYG sur Tenerife)

---

## Problème

L'utilisateur crée des fiches d'activités de plusieurs façons : manuellement, via scraping automatique par destination, ou via capture Claude for Chrome en visitant un site. Sans point de passage obligé, une fiche générée automatiquement pourrait apparaître directement dans l'atelier de travail sans jamais avoir été relue — au risque d'introduire des informations erronées, incomplètes, ou simplement non désirées dans l'espace où les voyages se planifient réellement. Il manque un moment dédié où chaque fiche, quelle que soit son origine, est vérifiée avant de devenir "active".

## Solution

L'écran 1 (Création) offre un point d'entrée unique pour toute nouvelle fiche : création manuelle via formulaire, ou arrivée automatique (scraping par destination, capture Claude for Chrome via une page dédiée "Capture rapide") dans une file "📥 À valider" traitée en **mode focus** (une fiche à la fois, revue séquentielle et concentrée). Pour chaque fiche, l'utilisateur peut corriger ou compléter n'importe quel champ du formulaire — y compris les tags — avant de la valider. Une fiche non désirée peut être glissée vers une corbeille récupérable (pas de suppression immédiate), consultable pendant quelques jours avant purge automatique.

Une fois validées, les fiches ne rejoignent pas seulement l'atelier de leur destination : elles s'affichent aussi dans une **grille de fiches validées**, propre à l'écran Création. Cette grille offre une vision d'ensemble, bien ordonnée, pensée pour la relecture et la présentation des activités (y compris à des tiers, ex. présenter le voyage à sa famille) — un usage distinct de l'Atelier, qui reste l'espace de travail personnel de réflexion et d'organisation. Un double-clic sur une fiche de la grille ouvre son panneau complet, dans l'un de deux modes au choix : **consultation** (lecture seule, présentation soignée et centrée avec galerie photo, métadonnées complètes et bouton de bascule vers modification) ou **modification** (édition de tous les champs, comportement historique du panneau complet).

## Utilisateur cible

Toto, utilisateur unique de l'application (usage solo, pas d'authentification), qui planifie ses propres voyages. Il alterne entre saisie manuelle rapide et alimentation automatique de son catalogue d'activités par destination, et souhaite garder le contrôle final sur ce qui entre dans son espace de travail.

## User Stories

- **US-1** — En tant qu'utilisateur, je veux créer une fiche manuellement via un formulaire complet, afin d'ajouter une activité que j'ai trouvée par moi-même.
- **US-2** — En tant qu'utilisateur, je veux que les fiches issues du scraping automatique par destination arrivent dans une pile "À valider", afin de ne jamais les voir apparaître directement dans mon atelier sans contrôle.
- **US-3** — En tant qu'utilisateur, je veux que les fiches capturées via Claude for Chrome arrivent dans la même pile "À valider", afin d'avoir un circuit de vérification unique quelle que soit la source.
- **US-4** — En tant qu'utilisateur, je veux parcourir la pile "À valider" fiche par fiche, afin de me concentrer sur chaque fiche sans distraction.
- **US-5** — En tant qu'utilisateur, je veux pouvoir corriger ou compléter n'importe quel champ (y compris les tags) pendant la validation, afin de fiabiliser la fiche avant qu'elle entre dans l'atelier.
- **US-6** — En tant qu'utilisateur, je veux pouvoir ajouter des images à une fiche pendant sa validation, afin de l'illustrer même si le scraping n'en a pas rapporté.
- **US-7** — En tant qu'utilisateur, je veux pouvoir valider une fiche incomplète, afin de ne pas être bloqué si je compte la compléter plus tard dans l'atelier.
- **US-8** — En tant qu'utilisateur, je veux pouvoir rejeter rapidement une fiche non désirée (glisser vers la corbeille ou raccourci clavier), afin de nettoyer la pile sans perdre définitivement une fiche par erreur.
- **US-9** — En tant qu'utilisateur, je veux qu'une fiche rejetée reste récupérable pendant quelques jours, afin de pouvoir revenir sur un rejet accidentel.
- **US-10** — En tant qu'utilisateur, je veux voir d'où vient chaque fiche (manuel / scraping / Claude for Chrome), afin de savoir quelle source a produit quelle information.
- **US-11** — En tant qu'utilisateur, je veux pouvoir cliquer sur le lien source pendant la validation d'une fiche scrapée, afin de vérifier les données à la page d'origine avant de compléter manuellement.
- **US-12** — En tant qu'utilisateur, je veux pouvoir joindre un document (photo ou PDF) à une fiche, afin de conserver un voucher, un billet ou une preuve de réservation directement associé à l'activité.
- **US-13** — En tant qu'utilisateur, je veux basculer la grille de fiches validées entre un mode consultation et un mode modification via un toggle dans la barre horizontale, afin de présenter mes activités simplement à quelqu'un sans risquer de les modifier par erreur.
- **US-14** — En tant qu'utilisateur, je veux qu'un double-clic sur une fiche de la grille ouvre son panneau complet dans le mode actif (consultation avec galerie photo, ou modification), afin que le comportement du double-clic reste cohérent avec le mode choisi.
- **US-15** — En tant qu'utilisateur, je veux que la grille conserve exactement sa position de défilement après la fermeture du panneau complet d'une fiche, afin de ne pas perdre ma place quand je consulte ou présente plusieurs fiches à la suite.
- **US-16** — En tant qu'utilisateur, je veux qu'une fiche affiche un résumé en français des avis TripAdvisor et un lien vers la page source, afin de savoir en quelques lignes ce que des centaines de voyageurs ont retenu d'une activité, sans avoir à lire des avis en six langues.
- **US-17** — En tant qu'utilisateur, je veux pouvoir choisir la source de scraping (GetYourGuide ou TripAdvisor) et recevoir un feedback précis sur le résultat (nombre de nouvelles fiches, doublons évités, indisponibilité de quota ou anomalie de source).

## Critères de succès

- Aucune fiche produite automatiquement (scraping ou Claude for Chrome) n'apparaît dans l'atelier sans être passée par la pile "À valider".
- Une fiche issue du scraping respecte le modèle de données et a ses champs obligatoires correctement renseignés.
- Depuis la pile, une fiche peut être complétée (champs texte, tags, images) sans effort excessif.
- Une fois validée, une fiche est immédiatement utilisable dans l'atelier de sa destination.
- Une fiche rejetée reste consultable et récupérable pendant sa période de grâce, puis disparaît après purge automatique.
- Le toggle consultation/modification change immédiatement le comportement du double-clic sur toute la grille, sans rechargement de page.
- Fermer le panneau complet d'une fiche, quel que soit le mode, restitue la grille exactement à la position de défilement précédente.
- Une fiche dont le nom et la destination correspondent (après normalisation) à une attraction TripAdvisor scrapée voit son champ `avis_utilisateurs` rempli d'un résumé en français, et son `lien_avis_tripadvisor` renseigné, sans action manuelle.
- Le scraping fournit un retour explicite à l'utilisateur : « X fiches importées dans À valider, Y doublons ignorés ».

## Hors périmètre

- Validation par lot (plusieurs fiches d'un coup) — la validation est strictement fiche par fiche.
- Notifications ou rappels si des fiches attendent depuis longtemps dans la pile.
- Tri ou pré-validation automatique par IA de la pile "À valider".

## Décisions d'implémentation

- Le même formulaire de vérification sert à la création manuelle et à la validation des fiches automatiques.
- La capture Claude for Chrome passe par une page dédiée, "Capture rapide" — version allégée du formulaire de création — puisque l'extension ne peut qu'opérer une interface, jamais appeler une API directement. Reste accessible via un lien secondaire discret sur l'Écran 1 (à côté du bouton "Nouvelle fiche manuelle", sans créer d'entrée dans la barre de navigation) et via une URL fixe, pour que l'extension puisse y naviguer directement une fois le parcours enregistré comme raccourci. cf. `docs/PLAN.md`, Phase 4.
- La pile "À valider" se parcourt fiche par fiche (mode focus), pas en vue liste multi-sélection.
- Chaque fiche affiche un badge discret indiquant sa provenance (manuel / scraping / Claude for Chrome).
- Le rejet se fait par glisser-déposer vers une corbeille latérale ou un raccourci clavier ; la suppression n'est jamais immédiate.
- La validation n'est jamais bloquée par l'incomplétude d'une fiche (le score de complétude reflète juste l'état, sans empêcher l'action).
- Le lien `url_source` d'une fiche scrapée est cliquable pendant la validation, pour vérification à la page d'origine.
- Le panneau complet de la fiche permet l'édition de tous les champs sans exception (prix, remarques, tags, etc.), avec le même accès cliquable au lien source.
- Un document joint à une fiche peut être une photo (galerie) ou un fichier PDF (voucher, billet, confirmation de réservation) ; les deux sont gérés de façon similaire, distingués uniquement par leur type.
- Le toggle consultation/modification vit dans la barre horizontale de l'écran Création, au-dessus de la grille. Mode par défaut à l'ouverture de l'écran : **consultation**.
- En mode consultation, le panneau complet ouvre le composant dédié `ActivityDetailModal` (lecture seule, galerie photo, bouton rapide pour basculer vers modification). En mode modification, il ouvre le formulaire d'édition classique `ActivityModal`.
- La position de défilement de la grille est conservée côté frontend (état de la page, pas de préférence stockée en base ni en `localStorage`) : ouvrir puis fermer le panneau complet d'une fiche ne doit jamais réinitialiser le scroll à la première ligne.
- Le lien vers un résumé TripAdvisor est affiché uniquement s'il existe (aucune correspondance trouvée = rien à afficher, pas de placeholder "aucun avis" pour ce champ spécifique — à distinguer de `avis_utilisateurs`, qui garde son message par défaut).

## Notes complémentaires & Points d'attention en cours

- Le pont technique Claude for Chrome est précisé en session `/planifie` du 1er août 2026 : l'extension
  n'ayant pas d'action générique d'appel API, elle opère une page dédiée du frontend ODOS ("Capture
  rapide") plutôt que d'appeler le backend directement. Détail complet dans `docs/PLAN.md`, Phase 4.
- **Scraping TripAdvisor & Archive locale pérenne (8 août 2026)** : Un scraper spécifique Firecrawl
  couplé à une base de données archive locale (`data/tripadvisor_canaries_archive.json`) a été mis en
  place pour fournir des synthèses structurées en plusieurs points clés (Route, Accès, Horaires,
  Équipement, Météo, Lampe rouge astronomie, Réservations).
- **Anomalie Scraping GetYourGuide sur Tenerife (Consignée le 8 août 2026)** :
  Le scraping automatique GetYourGuide pour la destination "Tenerife" n'a retourné aucune fiche
  (0 résultat importé). L'acteur Apify ou la formulation de la requête ("Tenerife" vs "Santa Cruz de
  Tenerife" ou "Tenerife, Canary Islands") doit faire l'objet d'un audit technique dédié pour restaurer
  l'alimentation automatique sur cette île.

  impact attendu sur le comportement décrit ci-dessus.
- Dépendance externe : Apify pour le scraping (quota gratuit), avec un script Python maison en solution de secours si besoin.
- Le besoin de documents joints (US-12) implique une évolution du schéma de données (table `photos` généralisée pour accepter aussi des PDF) — voir `SCHEMA_BASE_DE_DONNEES.md`.
- **Écart constaté le 7 août 2026** : ce PRD décrivait à l'origine une pile "À valider" parcourue exclusivement en vue liste fiche par fiche (US-4, "pas en vue liste multi-sélection"). En pratique, une grille de fiches validées a été ajoutée en cours de développement, sans repasser par une session `/cadre` dédiée. Le mode focus fiche par fiche reste le mécanisme de validation (US-4 à US-11, inchangées) ; la grille est la vue de résultat, nouvelle, documentée ici rétroactivement via les US-13 à US-16.
- Le lien TripAdvisor (US-16) s'appuie sur `lien_avis_tripadvisor`, nouvelle colonne de la table `activities` — voir `SCHEMA_BASE_DE_DONNEES.md`. La correspondance automatique réutilise la même logique de déduplication (nom + destination normalisés) déjà en place pour GetYourGuide (`docs/PLAN.md`, Phase 4).
