# PRD — Écran 0 : Dashboard

> Document produit via la démarche `/cadre`. Toute évolution de ce périmètre doit être répercutée ici avant d'écrire du code.

**Date :** 28 juillet 2026, 21h55

---

## Problème

Sans écran d'accueil dédié, l'utilisateur devait naviguer dans un écran de travail spécifique (Atelier ou Planning) pour avoir un aperçu de l'état général de son voyage — sans jamais avoir de vue d'ensemble immédiate sur l'essentiel (dates, budget, avancement, fiches en attente) au moment où il ouvre l'application.

## Solution

Le Dashboard est l'écran d'accueil systématique au lancement d'ODOS (jamais de reprise automatique du dernier écran consulté), et reste accessible à tout moment via la barre de navigation. Il donne une vue d'ensemble immédiate du voyage en cours : identité et dates du séjour, compte à rebours avant le départ, budget global, répartition des activités par destination avec accès direct à chaque atelier, nombre d'activités déjà placées dans le planning, et une alerte si des fiches attendent d'être validées. Il est conçu dès maintenant pour pouvoir évoluer vers un sélecteur multi-voyages, sans que ce soit son rôle en V1.

## Utilisateur cible

Toto, utilisateur unique de l'application (usage solo, pas d'authentification), qui consulte le Dashboard en premier à chaque ouverture d'ODOS pour un état des lieux rapide de son voyage, avant de rejoindre l'écran de travail qui l'intéresse.

## User Stories

- **US-1** — En tant qu'utilisateur, je veux voir le Dashboard systématiquement à l'ouverture d'ODOS, afin d'avoir un état des lieux immédiat sans devoir naviguer.
- **US-2** — En tant qu'utilisateur, je veux voir le nom et les dates de mon voyage avec un compte à rebours avant le départ, afin de savoir où j'en suis dans ma préparation.
- **US-3** — En tant qu'utilisateur, je veux voir mon budget global (dépensé/prévu) en un coup d'œil, afin de suivre mes dépenses sans calcul manuel.
- **US-4** — En tant qu'utilisateur, je veux cliquer sur le budget pour voir sa ventilation détaillée, afin de comprendre où va mon argent.
- **US-5** — En tant qu'utilisateur, je veux basculer entre une ventilation par destination, par catégorie de dépense, ou par journée, afin d'analyser mon budget selon l'angle qui m'intéresse à un moment donné.
- **US-6** — En tant qu'utilisateur, je veux voir la répartition de mes activités par destination, afin d'évaluer l'avancement de chaque partie de mon voyage.
- **US-7** — En tant qu'utilisateur, je veux accéder directement à l'atelier d'une destination en cliquant dessus, afin de continuer mon travail sans navigation supplémentaire.
- **US-8** — En tant qu'utilisateur, je veux voir le nombre d'activités déjà placées dans le planning, afin de mesurer ma progression globale.
- **US-9** — En tant qu'utilisateur, je veux être alerté si des fiches attendent d'être validées, afin de ne pas les oublier dans la pile "À valider".
- **US-10** — En tant qu'utilisateur, je veux accéder au Dashboard à tout moment via la barre de navigation, afin d'y revenir sans perdre mon contexte de travail.

## Critères de succès

- Le Dashboard s'affiche systématiquement à l'ouverture d'ODOS, quel que soit le dernier écran consulté à la fermeture précédente.
- Les dates et le compte à rebours du voyage sont visibles sans clic ni navigation.
- Le budget global (dépensé/prévu) est visible immédiatement, avec un détail accessible en un clic (bascule destination/catégorie/journée).
- Chaque destination du voyage est identifiable avec son nombre d'activités, et mène directement à son atelier en un clic.
- Une fiche en attente dans la pile "À valider" génère une alerte visible sans qu'il faille aller consulter l'Écran 1.

## Hors périmètre

- La gestion de plusieurs voyages (liste, sélection, archivage des voyages passés) — reportée ; structure de données prête mais non construite en V1.
- La modification des données du voyage directement depuis le Dashboard (édition des dates, budget, etc. — ça reste dans les écrans dédiés).
- Toute notification ou rappel automatique (par exemple, alerte si le voyage approche sans activité planifiée un jour donné).

## Décisions d'implémentation

- Le Dashboard s'affiche systématiquement au lancement, sans reprise du dernier écran consulté.
- Budget global affiché au niveau du voyage entier (partagé entre toutes les destinations).
- Détail du budget accessible par clic, avec bascule à trois positions : par destination géographique / par catégorie de dépense / par journée.
- Chaque destination du voyage mène directement à son atelier propre en un clic.
- Planning affiché comme unique pour tout le voyage (pas de distinction par destination, puisqu'il est partagé).
- Alerte visible si la pile "À valider" (Écran 1) contient des fiches en attente.

## Notes complémentaires

- Prévu dès la V1 pour évoluer vers un sélecteur multi-voyages (structure de données compatible), sans que cette fonctionnalité soit construite maintenant.
- Le voyage peut avoir plusieurs destinations (ateliers séparés), mais budget et planning restent uniques et partagés à l'échelle du voyage — ne pas confondre "destination du voyage" et "catégorie de dépense" dans le code ou l'UI.
- Le budget affiché (global et par ventilation) intègre non seulement le coût des activités, mais aussi celui des blocs libres créés à la volée dans le planning (ex: "Shopping", "Frais supplémentaires") — voir `PRD_ecran3.md`.
