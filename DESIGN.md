# Design System — ODOS

## Product Context
- Quoi : Application web de planification de voyage personnelle — un canvas libre pour comparer des activités (Atelier), un planning au quart d'heure pour les placer dans le temps, un dashboard de suivi.
- Pour qui : Toto, utilisateur unique, usage solo, pas d'authentification.
- Espace : Outils de voyage (GetYourGuide, apps de type Oripio) croisés avec les outils à canvas libre (Miro/Notion) — mais à usage strictement personnel, pas collaboratif.
- Type : Web app (desktop-first, adaptée mobile).
- Memorable thing : « Un effet clean, pro, comme une pub Apple. Un design neat, tonique. Une webapp construite et designée par un pro — pas un générique d'IA. »

## Aesthetic Direction
- Direction : Organic Minimal — relief cartographique. Hybride entre Organic/Natural (texture topographique, tons neutres chauds) et Brutally Minimal (un seul accent chromatique, discipline typographique, zéro décoration superflue).
- Décoration : Intentionnel — une texture topographique subtile (générée en SVG, jamais une image) porte l'identité visuelle sur tous les écrans ; une seule séquence pleinement expressive est assumée, réservée à l'écran de démarrage.
- Mood : Un outil de voyage qui a l'assurance discrète d'une app Apple, réchauffé par un relief cartographique qui rappelle qu'on prépare un vrai terrain — pas un tableau de bord froid.
- Références : dribbble.com/shots/26080464-Travel-App-Design (Sujon Hossain pour Oripio) — retenu pour le fond hors-blanc chaud, la typographie à graisses mixtes, les cartes pilotées par la photo, et la parcimonie de l'accent chromatique.

## Typography
- Display/Hero : Plus Jakarta Sans (600–800) — geometric sans à l'amplitude de graisse large, permet la signature « graisses mixtes dans une même phrase » (ex. *Tenerife* **et La Palma**) sans changer de famille. Plus chaleureux qu'Inter/Helvetica, pas surexploité.
- Body : Plus Jakarta Sans (400–500) — même famille que le display, jamais une deuxième police. Choix délibéré : à l'image de SF Pro Display/Text chez Apple, Display et Body sont une seule voix, pas deux registres.
- Data/Tables : Plus Jakarta Sans, `font-variant-numeric: tabular-nums` — utilisé pour tous les montants et horaires (budget, prix, créneaux).
- Code : JetBrains Mono — non visible côté produit, réservé aux extraits techniques dans la documentation.
- Scale : 11 / 13 / 15 / 17 / 21 / 26 / 34 / 46 / 64 px.

## Color
- Approche : Restrained — un seul accent chromatique (lime), à **exactement deux emplois autorisés** (action primaire, halo de focus), plus une famille de couleurs de catégorie strictement secondaires (liseré 3px ou point 7px, jamais un fond de carte).
- Primary : `#D6F84C` (lime) — CTA primaire et halo de focus uniquement. Jamais une troisième utilisation sur un même écran.
- Secondary : `#17181A` (encre) — pastilles de valeur chiffrée (prix, budget), texte principal, actions secondaires sombres.
- Neutrals : `#F1F0ED` (fond) · `#EDEBE6` (fond réchauffé) · `#F7F6F3` (surface en retrait) · `#E6E4DF` (hairline) · `#8E8F92` (texte tertiaire) · `#55565A` (texte secondaire) · `#17181A` (texte principal). Jamais de blanc pur, jamais de gris froid, jamais de noir pur.
- Semantic :
  - Succès / réservé-confirmé : `#3F7A55` (vert nature)
  - Alerte / attention : `#B9862F` (ambre terreux)
  - Erreur : `#B4472F` (terracotta)
  - Info / lien : `#395E8C` (bleu indigo)
- Catégories (usage exclusivement en liseré ou point, jamais en fond) :
  - Nature `#3F7A55` · Culture `#395E8C` · Gastronomie `#A4553A` · Détente `#6B5B95` · Logistique `#6E7278`
- Dark mode : Aucun, décision produit explicite (« éviter l'effet sombre, nuit »). Pas de variante sombre prévue en V1 ni au-delà sauf demande future documentée.

## Spacing
- Base : 8px, avec des paliers de 4px pour les ajustements fins (padding interne de pastille, écart d'icône).
- Densité : Confortable — ODOS est un outil de réflexion et de comparaison, pas un tableau financier dense ; l'espace blanc soutient le calme visuel, sauf sur le Planning où la densité d'information impose plus de retenue (cf. Layout).
- Scale : 2xs(2) · xs(4) · sm(8) · md(16) · lg(24) · xl(32) · 2xl(48) · 3xl(64)

## Layout
- Approche : Hybrid — grid-disciplined pour Dashboard, Création et Planning (alignements stricts, l'information doit s'aligner) ; creative-editorial pour l'Atelier (le canvas libre est le concept lui-même, le discipliner le trahirait).
- Grid : Pas de grille marketing multi-colonnes — largeurs de conteneur fixes : rail de nnavigation 88px (icônes seules, desktop) · panneau latéral Planning 320px · contenu principal fluide avec largeur max.
- Max content width : 1240px.
- Border radius : sm 10–14px (pastilles, petites cartes) · md 16–20px (cartes, widgets) · lg 24–26px (cadres d'écran, panneaux) · full 999px (pills, boutons, badges).

## Motion
- Approche : Intentionnel — transitions d'état visibles mais discrètes (fondu + léger scale sur panneaux et modals, bascule fluide en glisser-déposer) ; une seule séquence pleinement expressive assumée, l'écran de démarrage.
- Easing : entrée → ease-out · sortie → ease-in · déplacement → ease-in-out.
- Duration : micro 50–100ms (survol) · court 150–250ms (soulèvement au glisser, halo de focus) · moyen 250–400ms (ouverture/fermeture de panneau, dépôt de carte) · long 400–700ms (révélation de l'écran de démarrage, transition d'écran).

## Composants clés — règles issues des itérations de conception

Ces règles ne sont pas dans le gabarit standard du skill, mais elles ont été durement gagnées au fil
des itérations (v1 → v6) et sont trop importantes pour rester seulement dans l'historique du chat.

- **Fiche activité** : le caractère visuel vient toujours de la photo (pleine largeur, méta-infos en
  overlay bas), jamais d'un fond de carte coloré. La catégorie n'apparaît qu'en liseré ou point.
- **Piles de l'Atelier** : taille strictement identique à une carte individuelle, deux épaisseurs
  décalées en dessous, compteur en pastille détachée — jamais un texte accolé au nom de la pile.
- **Cartes du canvas** : droites au repos, inclinaison légère (2–3°) et léger agrandissement
  uniquement pendant le glisser. Jamais de rotation aléatoire au repos.
- **Grille du Planning** : toute la géométrie dérive d'une seule variable, la hauteur d'une heure.
  Bascule d'affichage 1/4 h ↔ 1/2 h possible (préférence d'affichage, `localStorage`), mais ne
  déplace jamais un créneau déjà posé. Le backend valide toujours au quart d'heure.
- **Champs de formulaire** : le repos ne consomme aucun contraste (fond en retrait, zéro contour) ;
  seul l'état actif prend un contour encre + halo lime — la deuxième et dernière utilisation
  autorisée du lime après l'action primaire.

## Decisions Log

| Date | Décision | Rationale |
|---|---|---|
| 28 juillet 2026 | v1 — palette crème/clay | Écartée : trop proche des codes visuels de Claude lui-même |
| 29 juillet 2026 | v2 — gris froid + lime, inspiré Dribbble | Écartée : lime surexploité (barres de progression, toggles), effet tableur |
| 29 juillet 2026 | v3 — glassmorphism, dégradé pastel | Écartée sur retour direct : « trop simple, comme un logiciel de compta » |
| 30 juillet 2026 | **v4 — texture topographique + graisses mixtes, validée** | Analyse fine de la référence Dribbble (Oripio) : fond chaud, relief SVG, typo à graisses mixtes, cartes pilotées par la photo, lime rare, pastilles noires |
| 30 juillet 2026 | v5 — déclinaison sur les 4 écrans | Création, Atelier (vue simple + vue avec panneau Planning), Planning plein écran |
| 30–31 juillet 2026 | v6 — correction grille + états de formulaire | Géométrie de grille corrigée (une seule variable dérivée), bascule 1/4h-1/2h, 6 familles d'états de saisie |
| 31 juillet 2026 | Création initiale de `docs/DESIGN.md` | Formalisation du système validé à l'issue des itérations v1-v6, suivant le gabarit du skill `/design` |

---

*Document de référence pour toute session de code sur ODOS. Toute évolution visuelle doit être
répercutée ici avant d'être codée — cf. `CLAUDE.md`, section 1, règle de préséance des documents.*
