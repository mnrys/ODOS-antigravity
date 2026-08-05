# Conventions du projet — ODOS Travel Planner

> Ce fichier est lu automatiquement par Claude Code au démarrage de chaque session sur ce projet.
> Il centralise les règles de travail convenues avec l'utilisateur (Moun), qui n'est pas développeur
> et doit pouvoir comprendre, suivre et faire évoluer ce projet sans dépendre d'un codeur.
>
> **Toute règle écrite ici prime sur les habitudes par défaut.** En cas de doute entre une pratique
> courante et une règle de ce fichier, c'est ce fichier qui gagne.

**Dernière mise à jour :** 2 août 2026, 16h55

---

## 1. Contexte projet

### Documents de référence — à consulter avant toute session de code

| Fichier | Rôle | Autorité |
|---|---|---|
| `BACKLOG.md` | Décisions produit et priorisation V1/V2/V3 | Ce qu'on fait et **quand** |
| `SCHEMA_BASE_DE_DONNEES.md` | Structure des données | À respecter **strictement** |
| `PRD_ecran0_dashboard.md` | Cahier des charges Écran 0 | Comportement attendu |
| `PRD_ecran1_creation.md` | Cahier des charges Écran 1 | Comportement attendu |
| `PRD_ecran2_atelier.md` | Cahier des charges Écran 2 | Comportement attendu |
| `PRD_ecran3_planning.md` | Cahier des charges Écran 3 | Comportement attendu |
| `docs/DESIGN.md` | Système de design (couleurs, typo, composants) | **Créé** — issu des itérations v1-v6, validé |
| `docs/PLAN.md` | Plan d'implémentation en 10 phases (tranches verticales) | **Créé** — référence pour la phase de code |
| `SUGGESTIONS.md` | Outillage, MCP, skills à tester, outils à construire — distinct du produit | Idées en attente, pas encore des décisions |
| `ARCHIVE_cahier_des_charges_v0.md` | Version d'origine, conservée pour mémoire | **Non contractuel** — obsolète sur de nombreux points |

**Règle de préséance en cas de contradiction entre documents :**
`PRD de l'écran concerné` > `SCHEMA_BASE_DE_DONNEES.md` > `BACKLOG.md` > `ARCHIVE_cahier_des_charges_v0.md`.
Si une contradiction est détectée, **ne pas trancher seul** : la signaler à Moun et attendre l'arbitrage.

### Stack

FastAPI (Python) + SQLAlchemy + SQLite · React 18 + Tailwind CSS · `@xyflow/react` (canvas atelier) · dnd-kit (glisser-déposer)

### Direction des modifications

Toute décision touchant à la structure de données ou au périmètre fonctionnel doit être répercutée
**dans les documents avant d'écrire du code — jamais l'inverse.** Le code suit les documents.
Un document qui décrit ce que le code fait déjà est un document mort.

---

## 2. Mode d'apprentissage — Moun apprend à coder sur ce projet

**Moun est néophyte en développement et utilise ODOS — puis ses projets suivants — comme terrain
d'apprentissage.** Cette section gouverne la manière dont toutes les autres règles de ce fichier
s'appliquent : on ne se contente pas de bien faire, on explique en faisant.

### Règle centrale

**Avant toute action de code** (créer un fichier, modifier une fonction, installer une dépendance,
lancer une commande, restructurer un module), Claude explique, en amont et en français simple :

1. **QUOI** — ce qu'il s'apprête à faire, concrètement.
2. **POURQUOI** — pourquoi cette approche plutôt qu'une autre envisageable.
3. **COMMENT** — comment ça fonctionne, en termes compréhensibles sans jargon non expliqué.

L'explication vient **avant** l'action, pas en résumé après coup — pour que Moun puisse suivre le
raisonnement, poser une question ou demander une autre approche avant que ce soit fait.

### Comment doser

- Proportionner l'explication à la nouveauté du concept. Un mécanisme déjà expliqué une fois n'a pas
  besoin d'un cours complet à chaque répétition — un rappel d'une phrase suffit
  (« même principe que pour le zoom du Planning : une préférence d'affichage, donc `localStorage` »).
- Repérer les moments où un concept vraiment nouveau apparaît, et prendre le temps qu'il faut à ce
  moment précis. C'est un investissement : bien expliqué une fois, un concept n'a plus besoin de l'être.
- Rester concret. Un exemple tiré d'ODOS vaut mieux qu'une définition abstraite.
- Ne pas transformer chaque échange en cours magistral : l'objectif est que Moun comprenne et garde la
  main sur les décisions, pas qu'il subisse un exposé. Si une explication complète serait longue, en
  donner l'essentiel et proposer d'aller plus loin si Moun le souhaite.

### Ce que ça implique concrètement

- Avant d'écrire une fonction : dire ce qu'elle va faire et pourquoi elle est découpée ainsi.
- Avant d'installer une dépendance : expliquer le problème qu'elle résout et pourquoi elle a été choisie
  plutôt qu'une alternative ou qu'une solution maison (cf. règle 5.9).
- Avant une commande en ligne de commande : dire ce qu'elle fait, pas seulement l'exécuter.
- Face à une erreur : expliquer ce qui s'est passé et comment on le diagnostique, pas seulement la corriger
  en silence — c'est souvent le meilleur moment d'apprentissage.
- Cette règle s'applique aussi bien en session Claude Code que dans ce chat de conception.

### Toujours le chemin le plus simple, toujours vérifier avant d'installer

**Règle prioritaire, qui prime sur le réflexe de proposer "la solution standard pour un développeur".**
Face à plusieurs façons d'accomplir la même chose, choisir systématiquement celle qui demande le moins
de manipulations, le moins de terminal, le moins de risque d'erreur — même si une autre est plus
habituelle ou plus "propre" techniquement. Avant de demander une installation, toujours vérifier
d'abord si l'outil est déjà présent sur la machine.

> **Cas vécu :** proposer d'installer Claude Code par PowerShell (terminal, PATH à dépanner, plusieurs
> échecs en pratique) alors que l'onglet "Code" de Claude Desktop, une interface graphique sans
> terminal, était visible dans l'application déjà ouverte et fait exactement la même chose. Puis
> demander d'installer Git sans vérifier s'il était déjà présent — il l'était. Deux détours évitables
> dans la même conversation, malgré une préférence de simplicité déjà exprimée explicitement.

Devise à appliquer : *slow is smooth, smooth is fast* — prendre le temps de comparer les options avant
de répondre coûte quelques secondes ; se tromper de chemin coûte des dizaines de minutes et de la
confusion évitable. La rapidité apparente d'une réponse immédiate n'est pas un gain si elle mène au
chemin le plus compliqué.

---

## 3. Séquence de travail obligatoire

```
/cadre  →  /design  →  /planifie  →  code
```

**Aucune étape ne peut être sautée.** Claude doit refuser de passer directement au code si le plan
n'existe pas, refuser de planifier si le design n'est pas arrêté, refuser de designer si le PRD est absent.

Cette règle est **proactive** : Claude ne doit jamais *proposer* de sauter une étape, même si l'étape
suivante semble évidente ou si Moun paraît pressé. Si Moun demande à sauter une étape, Claude explique
ce qui sera perdu et propose la voie normale.

---

## 4. Règle de validation — "banquer une validation"

**Après un test manuel satisfaisant d'une fonctionnalité, et avant toute nouvelle modification
du code, Claude Code doit demander :**

> « Veux-tu banquer cette validation ? »

Si la réponse est oui, Claude Code doit :

1. **Écrire un test automatisé** (unitaire, intégration ou bout-en-bout selon le cas) qui fige le
   comportement validé manuellement — sans attendre que Moun sache formuler lui-même le test technique.
   C'est à Claude de déduire les cas à couvrir à partir de la description fonctionnelle donnée.
2. **Faire tourner ce test** sur le code actuel pour confirmer qu'il passe.
3. **Expliquer en français simple** ce que le test vérifie, pour que Moun garde le contrôle sur ce qui
   est protégé.
4. **Ensuite seulement**, procéder aux modifications demandées, en rejouant l'ensemble des tests
   existants pour vérifier qu'aucun comportement déjà validé n'est cassé.

**Pourquoi :** sans ça, une fonctionnalité qui marchait cesse de marcher trois semaines plus tard sans
que personne s'en aperçoive. Le test est la mémoire du projet.

---

## 5. Règles d'or du code

Ces règles sont issues de cas réellement rencontrés sur ODOS. Chacune est illustrée par son cas d'origine.

### 5.1 — Aucune valeur magique en dur

Toute valeur qui apparaît plus d'une fois, ou qui pourrait changer, est une constante nommée ou une
variable — jamais un nombre posé au milieu du code.

> **Cas vécu :** la grille du Planning. Les hauteurs de créneaux avaient été écrites en dur (22 px, 88 px),
> ce qui a produit un décalage entre les libellés d'heures et les filets. La bonne forme : **une seule
> variable, la hauteur d'une heure**, dont on dérive tout le reste (`/4` pour le quart d'heure, `/2` pour
> la demie). Le zoom pilote cette variable, et tout suit automatiquement.

### 5.2 — Ne jamais stocker ce qui peut être calculé

Une donnée dupliquée est une donnée qui finira désynchronisée.

> **Cas vécus sur ODOS :**
> - Le **prix total** d'une activité n'est pas stocké : il vaut `cout_par_personne × trips.nb_personnes`,
>   calculé à l'affichage. Si le nombre de voyageurs change, tous les totaux suivent d'eux-mêmes.
> - L'état **"placée / disponible"** d'une fiche dans l'Atelier n'est pas une colonne : il se déduit de
>   l'existence d'un `scheduled_slot` pour cette activité. Impossible que le planning et l'atelier
>   racontent deux histoires différentes.

### 5.3 — Distinguer préférence d'affichage et donnée métier

Une préférence d'affichage vit dans le navigateur (`localStorage`). Une donnée du voyage vit en base.
**Ne jamais ajouter une colonne en base pour un réglage d'interface.**

> **Cas vécus :** le niveau de zoom et la granularité de grille (1/4 h / 1/2 h) sont des préférences
> d'affichage → `localStorage`, aucune colonne. Le budget ou les dates du voyage sont des données
> métier → base de données.

### 5.4 — Ne jamais réécrire silencieusement les données de l'utilisateur

Aucune action d'interface ne doit modifier, arrondir ou déplacer des données déjà saisies sans que
l'utilisateur l'ait explicitement demandé.

> **Cas vécu :** passer la grille du Planning en demi-heures ne doit **jamais** arrondir les créneaux
> existants. Un créneau posé à 10:15 reste à 10:15, simplement affiché entre deux filets. Une
> implémentation qui « nettoierait » les données à cette occasion est un défaut, pas une optimisation.

### 5.5 — Le backend est le gardien, l'interface est une commodité

Une facilité offerte côté interface ne doit jamais relâcher une contrainte côté serveur. Le backend
valide toujours dans son cas le plus strict, quelle que soit l'interface qui l'appelle.

> **Cas vécu :** le Planning peut afficher une grille en demi-heures, mais le backend continue de valider
> au quart d'heure (`% 15 == 0`) en toutes circonstances. Une fiche posée à 10:15 depuis le panneau
> latéral ou depuis le mobile reste toujours valide.

### 5.6 — Aucune couleur, taille ou espacement en dur dans les composants

Tout passe par les jetons définis dans `docs/DESIGN.md` (variables CSS ou configuration Tailwind).
Un `#3F7A55` écrit dans un composant est un bug de maintenance : le jour où la couleur change, on en
oublie forcément un.

### 5.7 — Préférer les décisions réversibles

À qualité égale, choisir la solution qu'on peut défaire. Quand une dépendance externe est engagée,
l'isoler derrière une interface stable pour pouvoir en changer sans tout casser.

> **Cas vécu :** le scraping passe par Apify, mais derrière un point d'entrée backend stable
> (`POST /ai/suggest-destination`). Si Apify devient inadapté, on remplace l'implémentation sans
> toucher au reste de l'application.

### 5.8 — Une modification, une raison

Ne pas mélanger dans un même changement une correction de bug, une nouvelle fonctionnalité et un
nettoyage de style. Si trois choses changent en même temps et que ça casse, on ne sait pas laquelle
est en cause.

### 5.9 — Pas de dépendance ajoutée sans justification

Avant d'installer une bibliothèque, vérifier qu'elle est nécessaire, maintenue, et que le problème ne
se règle pas en vingt lignes. Chaque dépendance est une dette : mises à jour, failles, incompatibilités.
Annoncer à Moun toute nouvelle dépendance, pourquoi elle est retenue, et ce qu'elle évite d'écrire à la main.

### 5.10 — Échouer bruyamment côté développeur, doucement côté utilisateur

Une erreur technique doit être visible dans les logs, avec assez de contexte pour être diagnostiquée.
Une erreur affichée à l'utilisateur doit être en français clair, dire ce qui s'est passé et quoi faire —
jamais un code d'erreur brut ni une trace technique.

### 5.11 — Cloisonner les sources externes entre elles

La panne d'une intégration externe ne doit jamais affecter les autres, ni le reste de l'application.
Chaque source est isolée dans son propre module, entourée d'une gestion d'erreur qui attrape tout ce
qui peut mal tourner et le transforme en message clair plutôt qu'en plantage propagé.

> **Cas vécu :** si le scraping Tripadvisor échoue (site indisponible, blocage anti-robot, erreur de
> l'acteur Apify), le scraping GetYourGuide et le reste d'ODOS doivent continuer de fonctionner
> normalement. Une branche malade ne doit jamais mettre l'arbre entier par terre.

---

## 6. Commentaires et lisibilité du code

**Règle fondatrice : tout code produit sur ce projet doit pouvoir être relu et compris par un
développeur humain qui découvre le fichier, sans avoir à demander d'explication à personne.**

Moun n'est pas développeur. Il doit néanmoins pouvoir faire relire ce projet par un tiers à tout moment,
ou le reprendre lui-même dans six mois. Un code juste mais illisible est un code raté sur ce projet.

### 6.1 — Ce qui doit être commenté

- **En-tête de chaque fichier** : à quoi il sert, quel écran ou quelle règle métier il porte, et le cas
  échéant le document de référence correspondant (ex : *« cf. `PRD_ecran3_planning.md`, section Granularité »*).
- **Chaque fonction non triviale** : ce qu'elle fait, ce qu'elle attend en entrée, ce qu'elle renvoie,
  et les cas particuliers qu'elle gère.
- **Toute règle métier**, systématiquement, avec un renvoi au document qui la fixe. C'est ce qui permet,
  des mois plus tard, de savoir si une ligne bizarre est un bug ou une décision.
- **Tout choix non évident** : pourquoi cette approche plutôt qu'une autre, quelle alternative a été
  écartée et pour quelle raison.
- **Toute limitation connue** ou dette assumée, avec un marqueur repérable (`# TODO`, `# LIMITE`).

### 6.2 — Ce qui ne doit pas être commenté

Un commentaire qui paraphrase le code n'apporte rien et deviendra faux au premier changement.

```python
# ✗ Inutile : le code le dit déjà
compteur = compteur + 1   # incrémente le compteur

# ✓ Utile : explique une décision qu'on ne devinerait pas
# On additionne aussi les blocs libres (special_blocks) et pas seulement les
# activités : une dépense comme "Shopping" n'est rattachée à aucune fiche.
# cf. SCHEMA_BASE_DE_DONNEES.md, "Calcul du budget"
```

**La règle en une phrase : le commentaire dit *pourquoi*, le code dit *quoi*.**

### 6.3 — Exemple de référence

Voici le niveau de commentaire attendu sur ce projet :

```python
def minutes_vers_pixels(minutes: int, hauteur_heure: int) -> float:
    """
    Convertit une durée en minutes vers une hauteur en pixels dans la grille du Planning.

    Toute la géométrie de la grille dérive d'une seule valeur — la hauteur d'une heure,
    pilotée par le curseur de zoom. On ne code jamais en dur la hauteur d'un créneau :
    le quart d'heure vaut hauteur_heure / 4, la demi-heure hauteur_heure / 2.
    cf. PRD_ecran3_planning.md, section "Granularité de la grille"

    Args:
        minutes:        durée à convertir (ex : 90 pour 1 h 30)
        hauteur_heure:  hauteur d'une heure en pixels, au niveau de zoom courant

    Returns:
        La hauteur correspondante en pixels.
    """
    return (minutes / 60) * hauteur_heure
```

### 6.4 — Un commentaire faux est pire que pas de commentaire

Quand une fonction change, son commentaire change dans le même mouvement. Un commentaire périmé envoie
le prochain lecteur — humain ou Claude — dans la mauvaise direction, avec la confiance en plus.

### 6.5 — Nommer avant de commenter

Le premier outil de lisibilité n'est pas le commentaire, c'est le nom. Un nom juste supprime le besoin
d'expliquer. `duree_totale_minutes` n'a pas besoin de commentaire ; `d` en réclame un.

Pas d'abréviation cryptique, pas de variable à une lettre en dehors d'un compteur de boucle très court.

---

## 7. Écrire du code qui évolue et se débogue

Ces règles ont un seul objectif : qu'ajouter une fonctionnalité dans six mois soit facile, et que
trouver l'origine d'un bug prenne des minutes plutôt que des heures.

### 7.1 — Une fonction, une responsabilité

Si l'on ne peut pas décrire ce que fait une fonction en une phrase sans « et », elle en fait trop.
Une fonction qui fait une seule chose se teste, se déplace et se corrige sans effet de bord.

### 7.2 — Respecter la séparation des couches

Le backend est organisé en couches, et chacune reste à sa place :

- `models.py` — la structure des données, rien d'autre
- `routers/` — recevoir la requête, valider l'entrée, appeler un service, renvoyer la réponse
- `services/` — **toute la logique métier vit ici**, et nulle part ailleurs

Une règle métier écrite dans un routeur est introuvable le jour où on la cherche, et impossible à
réutiliser depuis un autre point d'entrée. Même logique côté React : les composants affichent,
les hooks et services portent la logique.

### 7.3 — Sortir tôt plutôt qu'imbriquer

Traiter les cas d'exclusion en premier, puis dérouler le cas normal à plat. Le code profondément
imbriqué est le premier terrain des bugs difficiles.

```python
# ✓ Cas d'exclusion d'abord, cas normal ensuite, sans imbrication
if not creneau:
    return None
if creneau.verrouille:
    raise CreneauVerrouilleError(...)
# ... suite du traitement, au premier niveau
```

### 7.4 — Attendre trois répétitions avant de factoriser

Dupliquer une fois est acceptable. À la troisième occurrence, factoriser. Une abstraction créée trop
tôt, sur un seul cas, se révèle presque toujours mal découpée et coûte plus cher à défaire qu'à écrire.

### 7.5 — Explicite plutôt qu'astucieux

Entre une ligne compacte et trois lignes évidentes, choisir les trois lignes. Le code est lu bien plus
souvent qu'il n'est écrit. Aucune astuce de syntaxe qui demande de s'arrêter pour comprendre.

### 7.6 — Des messages d'erreur qui disent quoi faire

Un message d'erreur doit contenir ce qui était attendu, ce qui a été reçu, et de préférence l'identifiant
concerné.

```python
# ✗ raise ValueError("valeur invalide")
# ✓ raise ValueError(
#       f"heure_debut doit être un multiple de 15 minutes "
#       f"(reçu : {heure_debut} pour le slot {slot_id})"
#   )
```

### 7.7 — Journaliser aux points de bascule

Un log à l'entrée et à la sortie des opérations qui modifient des données, avec les identifiants
concernés. Sans ça, un bug qui ne survient qu'une fois sur dix est indébogable.

### 7.8 — Isoler ce qui vient de l'extérieur

Tout appel à un service externe (Apify, Dify, géocodage) passe par un module dédié qui traduit les
réponses vers le format d'ODOS. Le reste de l'application ne connaît jamais le format d'un tiers.
Si le fournisseur change son API, un seul fichier est touché.

### 7.9 — Le code mort se supprime

Pas de fonction commentée « au cas où », pas de branche morte. L'historique Git conserve tout : c'est
son rôle, pas celui du fichier.

---

## 8. Conventions générales

### Langue

- **Code en anglais** : noms de variables, de fonctions, de classes, de tables, de colonnes.
- **Interface en français** : tout ce que l'utilisateur lit.
- **Commentaires et explications en français**, sauf si un terme technique anglais est plus clair.
- Exception assumée : le schéma de base de données existant utilise des noms français
  (`titre`, `cout_par_personne`, `duree_min`…). **Ne pas les renommer** — la cohérence avec
  `SCHEMA_BASE_DE_DONNEES.md` prime sur la règle générale. *Reconfirmé le 1er août 2026 : la question
  d'un passage à l'anglais a été reposée à l'occasion du mapper de scraping GetYourGuide (les champs
  source y sont en anglais). Décision inchangée — un traducteur entre la source et le schéma ODOS est
  nécessaire dans tous les cas (les champs ne se correspondent pas terme à terme : prix total vs prix
  par personne, durée en texte vs minutes...), donc renommer le schéma n'aurait pas supprimé ce
  besoin. Le code du mapper lui-même reste en anglais, conformément à la règle générale — seule
  l'écriture finale en base utilise les noms français des colonnes.*

### Explications à Moun

Toujours un vocabulaire clair et non-technique. Moun doit comprendre **ce qui est fait** et **pourquoi**,
pas seulement **que c'est fait**. Quand un terme technique est incontournable, l'expliquer une fois.
Cf. section 2 pour le détail du mode d'apprentissage.

### En-têtes de documents

Dans l'en-tête de tout document généré (PRD, schéma, note, plan), indiquer la date **et l'heure** de
création ou de dernière modification — pas seulement la date — pour distinguer plusieurs versions
produites le même jour.

---

## 9. Tests

- Toute nouvelle fonctionnalité importante s'accompagne d'un test correspondant, **au fil de l'eau**
  plutôt qu'en une seule fois en fin de projet.
- Avant une modification en profondeur d'un module existant, vérifier qu'il existe des tests couvrant
  son comportement actuel ; sinon, **les écrire d'abord** (tests de non-régression rétroactifs).
- Un test doit être compréhensible : son nom décrit le comportement vérifié, en français si besoin
  (`test_bascule_granularite_ne_deplace_pas_les_creneaux`).
- Priorité aux tests qui protègent une règle métier explicitement écrite dans un PRD. Ce sont eux qui
  ont le plus de valeur.

---

## 10. Git

- Un commit = une intention, formulée en français à l'impératif
  (ex : `Ajoute la bascule de granularité 1/4h - 1/2h sur le Planning`).
- Ne jamais committer de secret (clé d'API, jeton). Ils vivent dans `.env`, jamais dans le code.
- Le fichier `.env` n'est jamais versionné ; un `.env.example` documente les variables attendues.

---

## 11. Protocole de mise à jour des documents de référence

**Aucune mise à jour autonome.** Quand une nouvelle décision émerge en cours de session, Claude la
**signale explicitement** à Moun et attend validation avant de l'inscrire où que ce soit.

**Distinction décision / suggestion :** une idée d'outillage évoquée en discussion (MCP, skill à
tester, outil à construire) qui n'est pas encore tranchée va dans `SUGGESTIONS.md`, pas dans
`BACKLOG.md`. Elle ne devient une ligne de `BACKLOG.md` que si elle concerne le produit ODOS
lui-même et qu'elle est validée par Moun comme telle.

Quand une mise à jour est validée :

1. **Régénérer le fichier complet**, jamais un bloc partiel à recoller. Moun n'a pas à éditer un fichier
   à la main.
2. **Insérer chaque ajout à l'endroit qui a du sens dans la structure existante**, pas systématiquement
   à la fin du document. Une nouvelle User Story rejoint la liste des User Stories dans l'ordre, une
   nouvelle décision technique rejoint la section "Décisions d'implémentation", un nouveau champ rejoint
   la table concernée dans le schéma. Seule une note de traçabilité de type changelog, quand le document
   en comporte une, se place en toute fin. Avant de régénérer, identifier où chaque ajout doit
   logiquement se trouver — pas seulement quoi ajouter.
3. **Vérifier par comparaison** que seules les modifications prévues apparaissent, et lister ces
   modifications dans la réponse.
4. **Donner l'instruction dans le bon ordre** : *supprimer l'ancien fichier du Projet, puis ajouter le
   nouveau.* Ajouter sans supprimer crée un doublon, pas un remplacement.

---

## 12. Points à ne jamais trancher seul

Claude doit s'arrêter et demander l'arbitrage de Moun dans ces cas :

- Contradiction détectée entre deux documents de référence
- Ajout, suppression ou renommage d'une table ou d'une colonne
- Ajout d'une dépendance externe
- Écart par rapport à une décision écrite dans un PRD ou dans le backlog
- Suppression définitive de données, quelle qu'en soit la raison
- Choix qui rendrait une décision antérieure difficilement réversible

---

*Fichier vivant — à compléter au fil des sessions si de nouvelles conventions sont validées avec Moun.*
