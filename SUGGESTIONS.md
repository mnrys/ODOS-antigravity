# ODOS — Suggestions & outillage

> Ce fichier est distinct de `BACKLOG.md`. `BACKLOG.md` contient les décisions **produit** d'ODOS
> (les fonctionnalités de l'app elle-même). Ce fichier-ci contient les idées **d'outillage et de
> méthode de travail** évoquées en discussion — MCP, skills, outils à construire — qui n'appartiennent
> pas au produit ODOS et pourront resservir sur de futurs projets.
>
> Chaque entrée garde une trace même quand elle est écartée : ça évite de rouvrir un débat déjà tranché.

**Dernière mise à jour :** 31 juillet 2026, 09h40

---

## Connecteurs MCP

| Connecteur | Statut | Pourquoi |
|---|---|---|
| **Firecrawl** | 🟢 Recommandé — à installer | Scraping/extraction. Déjà prévu dans `BACKLOG.md` (Phase 2, pipeline scraping). Utile dès maintenant pour la veille design (extraire palette/structure d'un site de référence au lieu de capturer manuellement) |
| **Context7** | 🟢 Recommandé — utile à partir de `/planifie` | Documentation à jour pour `@xyflow/react`, `dnd-kit`, FastAPI, SQLAlchemy. Évite le code généré sur une API obsolète. Pas urgent tant qu'on n'écrit pas de code |
| **Perplexity** | 🔴 Écarté | Redondant avec la recherche web déjà native à Claude — pas de bénéfice identifié pour ce projet |
| **Playwright** | 🟡 Différé | Utile pour piloter un navigateur réel et tester ODOS automatiquement (s'articulerait avec la règle "banquer une validation" de `CLAUDE.md`), mais prématuré tant qu'il n'y a pas encore de code à tester. À reconsidérer en phase de code |

**Comment installer un connecteur (à faire par Moun, pas par Claude — je n'ai pas accès aux réglages du compte) :**
Réglages → Connecteurs → "Ajouter un connecteur personnalisé" → coller l'URL du serveur → s'authentifier si demandé → activer le connecteur dans la conversation via le bouton "+" à côté de la zone de saisie.

- Firecrawl : `https://mcp.firecrawl.dev/mcp` pour un accès gratuit sans clé (recherche/scraping simples, débit limité), ou `https://mcp.firecrawl.dev/{CLE_API}/v2/mcp` avec un compte Firecrawl gratuit pour les fonctions complètes.
- Context7 : `https://mcp.context7.com/mcp` — fonctionne sans clé (limites basses), clé gratuite optionnelle sur `context7.com/dashboard` pour des limites plus hautes.

---

## Skills — à tester avant d'installer

- Process convenu : coller/attacher le `SKILL.md` candidat dans le chat, demander une comparaison avec les skills déjà en place (`/design`, `/cadre`, `/planifie`...) avant toute installation réelle, pour éviter les doublons.
- En attente : Moun doit encore identifier les skills de design précises repérées dans le repo vu en vidéo, et les transmettre (zip recommandé).

---

## Outils à construire (pas natifs à Claude, mais réalisables en artefact)

### Playground de design interactif
Vu chez un designer : panneau latéral avec curseurs pour tester des variations de police, taille, effets sur un hero en direct.
**Pas un outil natif de Claude** — mais construisible : une page HTML/CSS/JS autonome avec des curseurs qui modifient des variables CSS en direct sur un aperçu du Dashboard ODOS (typo, taille, couleur d'accent, rayon des cartes...). Techniquement proche de ce qu'on a déjà fait avec les `design-preview-vX.html`, en la rendant interactive plutôt que figée.
**Statut :** proposé, pas encore construit. Bon candidat pour affiner `docs/DESIGN.md` avant de le figer définitivement.

### Bibliothèque d'inspiration classifiée
Vu chez le même designer : dossier de captures d'écran + une mini-webapp de classification/tri.
**Pas natif non plus**, mais réalisable : un artefact avec stockage persistant (la fonctionnalité `window.storage` disponible dans les artefacts Claude) permettant d'ajouter des références visuelles, de les taguer (style, source, ce qui plaît) et de les retrouver d'une session à l'autre — équivalent fonctionnel du dossier + outil de tri vu en vidéo, en un seul endroit.
**Statut :** proposé, pas encore construit.

---

*Document vivant — chaque suggestion évoquée en conversation qui dépasse le cadre d'une seule réponse
doit être proposée pour cette liste avant d'être considérée comme "notée".*

---

## Idées Produit (Versions Ultérieures)

*Ces idées concernent l'évolution de l'application ODOS elle-même, au-delà de la phase de planification.*

### Mode "Pendant le voyage" (Live Tracking & Geotagging)
- **Galerie Personnelle En Direct** : Si l'app est ouverte pendant que l'on réalise une activité, les photos prises vont directement s'associer à la fiche de l'activité en cours dans une "galerie personnelle".
- **Géotagging intelligent** : ODOS lit les métadonnées GPS des photos et propose automatiquement de les classer dans la bonne activité (pratique si l'on prend les photos sans ouvrir l'app sur le moment).
- **Flexibilité du tri** : Possibilité de trier au fil de l'eau (pendant l'activité), le soir au calme (tri de la journée), ou tout à la fin en rentrant de voyage.

### Mode "Retour de voyage" (Album Souvenir Automatisé)
- **Génération automatique d'album** : À la fin du voyage, ODOS compile un "album souvenir" prêt à l'emploi.
- **Contenu enrichi** : L'album intègre les protagonistes, les photos personnelles classées, des petits résumés de ce qui s'est passé, et même un encart sur les imprévus ou problèmes rencontrés.
- *Objectif : Transformer l'outil de planification en un carnet de bord et de souvenirs post-voyage.*
