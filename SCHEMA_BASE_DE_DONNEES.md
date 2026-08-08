# ODOS Travel Planner — Schéma de base de données (référence technique)

> Document de référence unique pour la structure des données. Toute session de code (Claude Code, Cowork ou autre) doit s'appuyer sur ce schéma plutôt que d'en réinventer un.
> Stack : FastAPI (Python) + SQLAlchemy + SQLite + React 18 (inchangé depuis le cahier des charges d'origine).

**Dernière mise à jour :** 7 août 2026, 15h40 — ajout de `lien_avis_tripadvisor` sur `activities` (Phase 4b, résumés TripAdvisor)

---

## Vue d'ensemble des changements par rapport au cahier des charges d'origine

| Origine | Devient | Raison |
|---|---|---|
| `categorie_id` unique par activité | Catégorie **+** tags multiples (many-to-many) | Filtrage combiné (prix, lieu, zone, type...) |
| `galerie_photos` (JSON, 2 photos max) | Table `documents` dédiée, illimitée | Sources multiples (scraping, upload, terrain), photo principale désignable, **et** documents PDF (voucher, billet) en plus des photos |
| `cout` sur l'activité | `cout_par_personne` | Le nombre de voyageurs est un attribut du **voyage**, pas de l'activité |
| `lieu` (texte unique) | `destination_id` + `adresse` + `zone_geo` | Trois besoins différents : atelier cible, lien Maps, optimisation de trajet |
| Un atelier par voyage (`card_layouts.trip_id`) | Un atelier par destination (`card_layouts.destination_id`) | Voyage multi-destinations (ex: La Palma + Tenerife) |
| — | `note_interet` (1-5) | Priorité personnelle, absente à l'origine |
| — | `avis_utilisateurs` (distinct de `remarques`) | Synthèse des avis d'autres voyageurs (Tripadvisor scrapé + filtré IA en Phase 2), vide et éditable manuellement en V1 |
| — | Soft-delete généralisé (corbeille récupérable) | Écran 1 (fiches rejetées) et Atelier (corbeille) |
| — | `lien_avis_tripadvisor` | Référence vers un résumé d'avis TripAdvisor produit par la webapp externe (Phase 4b), rattachée automatiquement par correspondance nom + destination |

---

## 1. `trips` — Voyages

```sql
id                    INTEGER PRIMARY KEY
nom                   TEXT NOT NULL
date_debut            DATE NOT NULL
nb_jours              INTEGER NOT NULL
nb_personnes          INTEGER NOT NULL DEFAULT 1        -- ex: 4 pour ce voyage
budget_total          REAL DEFAULT 0
planning_heure_debut  INTEGER DEFAULT 420   -- 07:00 en minutes depuis minuit
planning_heure_fin    INTEGER DEFAULT 1380  -- 23:00 en minutes depuis minuit
share_token           TEXT UNIQUE
created_at            DATETIME DEFAULT NOW
```

## 2. `trip_destinations` — Sous-destinations d'un voyage

Un voyage a toujours **au moins une** destination. Chaque destination a son propre atelier (canvas + dispositions).

```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
nom                   TEXT NOT NULL         -- ex: "La Palma", "Tenerife"
ordre                 INTEGER DEFAULT 0
```

## 3. `activities` — Fiches activités

```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
destination_id        INTEGER FK → trip_destinations.id NOT NULL
categorie_id          INTEGER FK → categories.id        -- classification principale (couleur planning)
type_element          TEXT DEFAULT 'activite'           -- 'activite'|'logement'|'restaurant'|'transport'|'vol'|'vehicule'|'autre'
titre                 TEXT NOT NULL
adresse               TEXT                               -- texte libre → génère lien Google Maps
zone_geo              TEXT                               -- 'nord' | 'sud' | 'est' | 'ouest' (champ structuré, une seule valeur)
duree_min             INTEGER                            -- pour les fiches tenant sur une journée (activité, restaurant...)
duree_max             INTEGER
date_debut            DATE                               -- pour les fiches s'étalant sur plusieurs jours (logement, véhicule)
date_fin              DATE
numero_reference       TEXT                              -- n° de vol, référence de réservation
cout_par_personne     REAL DEFAULT 0                     -- prix total affiché = cout_par_personne × trips.nb_personnes
description           TEXT
horaires_ouverture    TEXT (JSON)
jours_fermeture       TEXT (JSON)
source                TEXT DEFAULT 'manuel'              -- 'manuel' | 'scraping_auto' | 'claude_chrome'
remarques             TEXT                               -- notes personnelles de l'utilisateur
avis_utilisateurs     TEXT                               -- synthèse des avis d'autres voyageurs (Tripadvisor scrapé +
                                                          -- filtré IA en Phase 2, complétable manuellement dès la V1).
                                                          -- Vide en V1 → affiché "Aucun avis pour l'instant" dans l'UI.
                                                          -- Distinct de `remarques` (notes personnelles vs avis tiers)
lien_avis_tripadvisor TEXT                               -- URL vers le résumé d'avis produit par la webapp TripAdvisor
                                                          -- (Phase 4b), renseignée automatiquement quand une correspondance
                                                          -- nom+destination normalisés est trouvée. NULL = aucun lien affiché
                                                          -- (pas de placeholder). Distinct de `avis_utilisateurs`.
rating                REAL
note_interet          INTEGER                            -- 1 à 5, 5 = à faire absolument
statut                TEXT DEFAULT 'non_reserve'          -- 'non_reserve'|'en_cours'|'reserve'|'action_requise'|'annule'
statut_validation     TEXT DEFAULT 'validee'              -- 'a_valider' | 'validee' (pile écran 1)
url_source             TEXT                               -- affiché en badge abrégé (ex: "GetYourGuide"), pas l'URL complète
completude             INTEGER DEFAULT 0                  -- score 0-100, cf. section 6
tripadvisor_consulte   INTEGER DEFAULT 0
supprime_le             DATETIME                           -- NULL = actif ; sinon = date de mise en corbeille (récupérable, purge auto après quelques jours)
created_at             DATETIME DEFAULT NOW
```

## 4. `documents` — Galerie et pièces jointes (remplace `galerie_photos`, généralise l'ancienne table `photos`)

```sql
id                    INTEGER PRIMARY KEY
activity_id           INTEGER FK → activities.id
type_fichier          TEXT NOT NULL       -- 'photo' | 'pdf'
chemin_fichier        TEXT NOT NULL       -- stocké physiquement sur le serveur, jamais un lien externe direct
type_source            TEXT                -- 'scraping' | 'upload_manuel' | 'photo_terrain'
libelle                TEXT                -- ex: "Voucher hôtel", "Billet ferry" — surtout utile pour les PDF
date_prise             DATETIME            -- pertinent surtout pour type_fichier = 'photo'
latitude                REAL               -- si dispo (photo terrain avec géoloc)
longitude               REAL
est_principale          INTEGER DEFAULT 0  -- 1 = miniature/thumbnail affichée partout (uniquement pour type_fichier = 'photo')
created_at              DATETIME DEFAULT NOW
```

> Un document est soit une photo (galerie, y compris photo terrain géolocalisée), soit un PDF (voucher, billet, confirmation de réservation). Les deux partagent la même table car ils suivent le même cycle de vie (upload, rattachement à une fiche, affichage dans le panneau complet) — seul `type_fichier` distingue leur traitement à l'affichage.

## 5. `tags` et `activity_tags` — Tags multiples (many-to-many)

```sql
-- tags
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
nom                   TEXT NOT NULL        -- texte libre, autocomplété sur les tags déjà créés dans ce voyage

-- activity_tags (table de liaison)
activity_id           INTEGER FK → activities.id
tag_id                INTEGER FK → tags.id
```

## 6. Score de complétude (inchangé dans le principe, pondération à ajuster)

```python
CHAMPS_REQUIS = {
    'titre': 15, 'destination_id': 5, 'adresse': 10,
    'duree_min': 10, 'cout_par_personne': 5, 'description': 15,
    'photo_principale': 10, 'horaires_ouverture': 10,
    'tags': 5, 'note_interet': 5, 'zone_geo': 10
}
# Score = somme des poids des champs renseignés (non null, non vide) — total 100
# Note : avis_utilisateurs n'entre PAS dans ce calcul (champ alimenté en Phase 2,
# une fiche V1 complète n'a normalement pas encore d'avis)
```

## 7. `scheduled_slots` — Créneaux planning (inchangé)

```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
activity_id           INTEGER FK → activities.id (nullable pour blocs spéciaux)
special_block_id      INTEGER FK → special_blocks.id (nullable)
jour                  INTEGER NOT NULL
heure_debut           INTEGER NOT NULL     -- minutes depuis minuit
heure_fin             INTEGER NOT NULL
type                  TEXT DEFAULT 'activite'   -- 'activite'|'repas'|'trajet'|'pause'
verrouille            INTEGER DEFAULT 0    -- 0=libre|1=souple|2=fort ; déverrouillage explicite requis
couleur_override      TEXT
```

**Règle de conflit (simplifiée par rapport à l'origine)** : le backend refuse toute création/déplacement de slot qui chevauche un slot existant sur le même jour — pas de suggestion d'alternative automatique, l'utilisateur décale manuellement.

**État "placée / disponible" d'une activité (atelier)** : dérivé, calculé en vérifiant s'il existe au moins un `scheduled_slot` avec cet `activity_id` — jamais stocké comme colonne sur `activities`, pour éviter une désynchronisation entre planning et atelier.

## 8. `categories` (inchangé)

```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id (NULL = catégorie système globale)
nom                   TEXT NOT NULL
couleur               TEXT NOT NULL
icone                 TEXT
ordre                 INTEGER DEFAULT 0
est_systeme           INTEGER DEFAULT 0
```

## 9. `card_layouts` — Dispositions de l'atelier (rattaché à la destination, pas au voyage)

```sql
id                    INTEGER PRIMARY KEY
destination_id        INTEGER FK → trip_destinations.id   -- changement : un atelier par destination
nom                   TEXT NOT NULL              -- ex: "En cours", "Par zone géographique", "Par prix"
disposition           TEXT (JSON)                -- { "activity_id": {"x":.., "y":.., "z_index":..} }
est_courante          INTEGER DEFAULT 0          -- 1 = disposition "bureau" auto-sauvegardée en continu
est_initiale          INTEGER DEFAULT 0          -- 1 = disposition de référence (retour possible)
created_at            DATETIME DEFAULT NOW
```

## 10. `special_blocks` (étendu pour la gestion fine du budget)

```sql
id                    INTEGER PRIMARY KEY
trip_id               INTEGER FK → trips.id
label                 TEXT NOT NULL       -- texte libre : "Déjeuner", "Sieste", "Shopping", "Plein d'essence", "Frais supplémentaires"...
type                  TEXT NOT NULL       -- 'repas'|'trajet'|'pause'|'personnalise'
categorie_id          INTEGER FK → categories.id (nullable)  -- pour ventilation budget (système ou catégorie custom du voyage)
duree_minutes         INTEGER DEFAULT 60
cout                  REAL DEFAULT 0
icone                 TEXT
couleur               TEXT
```

> `type = 'personnalise'` couvre les blocs créés librement dans le planning au-delà des trois presets d'origine (repas/trajet/pause) : n'importe quel libellé, avec un coût et une catégorie de dépense au choix. Sert aussi bien à un ajustement de coût lié à une activité (ex: "Frais supplémentaires" après une sortie bateau) qu'à une dépense totalement indépendante (ex: "Shopping").

## 11. `activity_links` — Fiches liées (nouveau, V2 atelier)

```sql
activity_id_a         INTEGER FK → activities.id
activity_id_b         INTEGER FK → activities.id
-- paire non ordonnée ; contrainte d'unicité sur (min(a,b), max(a,b))
```

---

## Notes d'implémentation importantes

### Soft-delete / corbeilles récupérables
Deux mécanismes distincts utilisent le même principe technique (`supprime_le` + purge différée), mais avec des significations différentes :
- **Écran 1** : `statut_validation = 'a_valider'` puis rejet → `supprime_le` renseigné (fiche jamais arrivée dans l'atelier)
- **Atelier** : fiche déjà validée, glissée sur la corbeille → `supprime_le` renseigné (fiche retirée du canvas mais visible dans la corbeille de l'atelier)

Une tâche de fond (ex: exécutée au démarrage du backend, ou tâche planifiée) purge définitivement les fiches dont `supprime_le` dépasse un seuil (ex: 7 jours).

### Documents — stockage local
Les fichiers (photos comme PDF) ne sont jamais stockés en base (`chemin_fichier` est juste un chemin relatif, ex: `uploads/activities/{activity_id}/{uuid}.jpg` ou `uploads/activities/{activity_id}/{uuid}.pdf`). Le dossier physique est servi par FastAPI comme fichiers statiques. L'affichage differe selon `type_fichier` : une photo s'affiche en galerie/miniature, un PDF s'affiche via un lien de téléchargement ou une prévisualisation dans le panneau complet de la fiche.

### Prix affiché
Le prix total sur une fiche n'est **jamais stocké** : il se calcule à l'affichage — `cout_par_personne × trips.nb_personnes`. Ça évite une désynchronisation si le nombre de voyageurs change en cours de route.

### Zone géographique vs tags
`zone_geo` est un champ structuré à valeur unique (nord/sud/est/ouest), volontairement séparé du système de tags libres — utilisé pour l'optimisation de trajet, qui a besoin d'une valeur fiable et non ambiguë.

### Calcul du budget — activités et blocs spéciaux
Le budget (global, par jour, par destination, par catégorie) se calcule en sommant à la fois le coût des activités (`cout_par_personne × trips.nb_personnes`) et le coût des `special_blocks` liés au voyage via leurs `scheduled_slots`. Un bloc spécial sans `categorie_id` renseigné n'apparaît que dans le total global, pas dans la ventilation par catégorie.

### Typologie de fiche
`type_element` élargit les fiches au-delà des simples activités (logement, transport, vol, véhicule...) ; le formulaire de l'écran 1 adapte les champs visibles selon ce type (ex: `numero_reference` pour un vol, `date_debut`/`date_fin` pour un logement plutôt que `duree_min`).
Un besoin de "fiche réutilisable" (ex: repas générique placé plusieurs fois) avait été envisagé puis abandonné : ce cas est déjà couvert par les **blocs spéciaux** créés directement dans le planning (repas/trajet/pause), pas besoin d'un mécanisme de fiche dédié à ça.

### `remarques` vs `avis_utilisateurs`
Deux champs texte distincts, à ne pas confondre en code ou en UI :
- `remarques` = notes **personnelles** de l'utilisateur (ex: "prévoir chaussures de marche")
- `avis_utilisateurs` = synthèse des avis **d'autres voyageurs** (source externe, Tripadvisor). Vide en V1, affiché avec un message par défaut ("Aucun avis pour l'instant") tant que le scraping Tripadvisor (Phase 2) n'est pas branché. Éditable manuellement dès la V1 si l'utilisateur veut y coller un avis pertinent trouvé lui-même.
- `lien_avis_tripadvisor` = un lien, pas un texte. Renseigné automatiquement (Phase 4b) quand la webapp TripAdvisor détecte une correspondance avec cette fiche. N'a pas de message par défaut ; simplement absent de l'affichage tant qu'aucune correspondance n'existe. Ne remplace pas `avis_utilisateurs` : les deux peuvent coexister (le premier pointe vers l'extérieur, le second est une synthèse copiée dans ODOS).

---

*Document vivant, à faire évoluer en même temps que le backlog. Toute nouvelle décision touchant à la structure de données doit être répercutée ici avant d'écrire du code.*
