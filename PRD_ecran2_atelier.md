# PRD — Écran 2 : Atelier

> Document produit via la démarche `/cadre`. Toute évolution de ce périmètre doit être répercutée ici avant d'écrire du code.

**Date :** 1er août 2026, 10h20 (révisé — fiches liées déplacées en Hors périmètre)

---

## Problème

Sans espace de travail libre, l'utilisateur se retrouvait avec deux difficultés : d'une part, toutes les fiches d'activités mélangées sans possibilité de les comparer ou les trier visuellement avant de les engager dans le planning ; d'autre part, aucun espace de réflexion "hors planning" — chaque fiche devait immédiatement être associée à une case horaire, sans marge pour hésiter, comparer, ou organiser ses idées.

## Solution

L'Atelier est un canvas libre et illimité où toutes les fiches d'activités d'une destination peuvent être déplacées, regroupées et filtrées librement, comme des cartes physiques sur une table. L'utilisateur peut organiser ses fiches par catégorie (piles automatiques), par filtre combiné (prix, lieu, tag, type), ou par disposition personnalisée nommée et sauvegardable. Deux façons de mettre en valeur un sous-ensemble de fiches filtrées sont proposées, au choix : un contour coloré (positions inchangées) ou un grisage des fiches non concernées (mode focus). Une fiche déposée dans le planning reste visible dans l'Atelier mais devient distinctement transparente/grisée pour signaler qu'elle est déjà utilisée — cet état prime toujours sur l'affichage des filtres.

## Utilisateur cible

Toto, utilisateur unique de l'application (usage solo, pas d'authentification), qui compare et organise ses activités possibles avant de les engager dans un planning précis.

## User Stories

- **US-1** — En tant qu'utilisateur, je veux voir toutes mes fiches d'une destination sur un canvas libre, afin de les comparer visuellement avant de les placer dans le planning.
- **US-2** — En tant qu'utilisateur, je veux que mes fiches soient automatiquement regroupées en piles par catégorie au premier lancement, afin de partir d'une organisation de base sans effort.
- **US-3** — En tant qu'utilisateur, je veux pouvoir filtrer mes fiches par prix, lieu, tag et type combinés, afin de retrouver rapidement un sous-ensemble précis d'activités.
- **US-4** — En tant qu'utilisateur, je veux pouvoir choisir entre mettre en valeur par contour coloré ou par grisage des autres fiches, afin d'adapter la mise en évidence à ma préférence du moment.
- **US-5** — En tant qu'utilisateur, je veux pouvoir réorganiser physiquement mes fiches selon un filtre (les regrouper), afin de créer une nouvelle disposition basée sur ce critère (ex : toutes les randonnées ensemble).
- **US-6** — En tant qu'utilisateur, je veux sauvegarder une disposition sous un nom (ex : "par zone géographique"), afin de pouvoir y revenir plus tard sans perdre mon organisation en cours.
- **US-7** — En tant qu'utilisateur, je veux voir immédiatement, sans confusion possible, quelles fiches sont déjà placées dans le planning, afin de ne pas y revenir par erreur — même si un filtre est actif en même temps.
- **US-8** — En tant qu'utilisateur, je veux pouvoir glisser une fiche non désirée vers une corbeille propre à l'Atelier, afin de la retirer du canvas sans la supprimer définitivement.
- **US-9** — En tant qu'utilisateur, je veux pouvoir ouvrir le panneau complet d'une fiche par double-clic, afin d'éditer n'importe quel champ ou vérifier la source, directement depuis l'Atelier.
- **US-10** — En tant qu'utilisateur, je veux que mes fiches restent lisibles et identifiables sans ambiguïté à n'importe quel niveau de zoom, afin de ne jamais confondre deux activités par erreur.
- **US-11** — En tant qu'utilisateur, je veux naviguer entre les ateliers de chaque destination d'un même voyage via des onglets, afin de garder mes destinations bien séparées sans les mélanger.

## Critères de succès

- Une fiche précise se retrouve en quelques secondes grâce aux filtres, même avec un grand nombre d'activités.
- L'état "déjà placée dans le planning" est identifiable en un coup d'œil, sans jamais être confondu avec un effet de filtre.
- Une disposition personnalisée (par exemple par collection : "randonnées", "sorties bateau") peut être créée et retrouvée sans perte après fermeture de l'application.
- Une fiche reste manipulable (déplacement, ouverture, lecture) sans erreur de manipulation.
- Le contenu d'une fiche (titre, activité représentée) reste lisible sans ambiguïté à n'importe quel niveau de zoom.

## Hors périmètre

- Les zones nommées façon "cadres" (Miro/FigJam) — reporté en V2.
- L'upload de photos personnelles supplémentaires depuis l'Atelier — reporté en V2.
- La fusion ou suppression automatique de doublons de fiches.
- Les "fiches liées" (relier une activité à une ou plusieurs autres) — reporté en V2. La table
  `activity_links` existe dans `SCHEMA_BASE_DE_DONNEES.md` (déjà taguée "V2 atelier" à l'origine),
  mais aucune User Story formelle n'a été écrite pour cet écran. Décision prise en session `/planifie`
  du 1er août 2026 : pas de fonctionnalité sans User Story validée — `BACKLOG.md` sera corrigé en
  conséquence, il la listait par erreur comme V1.

## Décisions d'implémentation

- Les piles automatiques regroupent les fiches par catégorie ; les catégories les moins fournies sont regroupées dans une pile "Autres" dépliable si trop nombreuses pour tenir sur une ligne.
- Deux modes de mise en valeur des filtres coexistent en V1, au choix de l'utilisateur : contour coloré, ou grisage des fiches non concernées.
- L'état "déjà placée dans le planning" est prioritaire sur l'affichage des filtres : une fiche placée n'est jamais grisée pour une autre raison que son placement, même si elle correspond à un filtre actif.
- La pile "Suggestions IA" existe visuellement dès la V1 mais reste vide tant que la Phase 2 (agent IA) n'est pas branchée.
- La corbeille de l'Atelier est distincte de celle de l'écran 1 ; suppression définitive uniquement via le panneau complet de la fiche.

## Notes complémentaires

- Ce PRD modifie une décision antérieure du backlog : le "mode focus" (grisage) passe de V2 à V1, en option au choix à côté du contour coloré.
- Une règle de priorité d'affichage a été ajoutée suite à un conflit identifié entre deux usages du grisage (fiche placée vs fiche filtrée) — voir Décisions d'implémentation.
- Dépendance technique recommandée : `@xyflow/react` pour le canvas infini (zoom, pan, positionnement).
