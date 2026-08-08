# Prompt de session Antigravity — ODOS Phase 12 (pipeline TripAdvisor via Firecrawl)

*Document généré le 8 août 2026. À coller dans Antigravity en début de session, avec les fichiers
`CLAUDE.md`, `SCHEMA_BASE_DE_DONNEES.md` et `PLAN.md` joints.*

---

## Contexte

Tu travailles sur ODOS, une application personnelle de préparation de voyage (FastAPI + SQLAlchemy +
SQLite en backend, React 18 + Tailwind + Vite en frontend). L'utilisateur n'est pas développeur :
toutes les instructions doivent être explicites, et le code doit être commenté de façon à être
relisible par un humain lors d'une revue.

Lis `PLAN.md`, section **Phase 12 : TripAdvisor — pipeline Firecrawl, activités gratuites, résumés
d'avis**. C'est la spécification de référence. Lis aussi `CLAUDE.md` (conventions du projet, en
particulier la règle 5.11 de cloisonnement des sources) et `SCHEMA_BASE_DE_DONNEES.md` (table
`activities`, colonnes `avis_utilisateurs` et `lien_avis_tripadvisor`, et table `photos` avec sa
convention `chemin_fichier`).

## Objectif de cette session

Créer `scripts/pipeline_tripadvisor.py` : un script Python autonome, **hors du code applicatif
ODOS**, qui alimente ODOS en fiches d'activités gratuites depuis TripAdvisor.

## Contraintes non négociables

1. **Toutes les écritures dans ODOS passent par l'API FastAPI existante.** Aucune requête SQL
   directe, aucun import de modèle SQLAlchemy dans le script. Si un endpoint manque, signale-le
   avant de coder plutôt que de contourner.
2. **Firecrawl, pas Apify.** Clé API lue depuis `.env` (variable `FIRECRAWL_API_KEY`), jamais en dur
   dans le code.
3. **Extraction via le format `json` de Firecrawl**, avec un prompt en français. N'écris pas de
   sélecteurs CSS ni de parsing HTML manuel : c'est justement ce qu'on cherche à éviter.
4. **Le téléchargement des photos ne passe pas par Firecrawl.** Une fois l'URL de l'image obtenue,
   une requête HTTPS directe vers le CDN suffit (aucun crédit consommé).
5. **Le résumé des avis est produit par l'API Claude, systématiquement en français**, quelle que
   soit la langue des avis sources (constaté : espagnol, anglais, russe, polonais, allemand,
   français sur un même lieu). Il vise des conseils pratiques concrets (accès, horaires, ce qu'il
   faut prévoir), pas une paraphrase des avis.
6. **Robustesse avant fonctionnalités.** Points de contrôle sur disque, reprise après interruption,
   escalade de proxy (`basic` puis `stealth`), `--dry-run`, `--max-credits`, journal en français.
   L'utilisateur ne doit pas avoir à déboguer.

## Ordre de travail imposé

**Étape 1 — validation avant tout le reste.** Écris d'abord un script minimal qui fait *un seul*
appel Firecrawl sur cette URL, en format `json` avec un prompt en français, et affiche le résultat
brut :

```
https://www.tripadvisor.com/Attraction_Review-g187475-d1800798-Reviews-Instituto_de_Astrofisica_de_Canarias-La_Palma_Canary_Islands.html
```

**Arrête-toi là et montre le résultat à l'utilisateur avant d'écrire quoi que ce soit d'autre.**
C'est la règle du projet : valider externement avant de coder autour. Si Firecrawl ne renvoie pas de
données exploitables sur cette page, tout le reste du pipeline est à revoir — inutile de l'écrire.

**Étape 2** — seulement après validation de l'étape 1 : le pipeline complet, tel que décrit dans
`PLAN.md`.

## Points à vérifier au premier lancement

- L'URL du filtre « entrée gratuite » pour Tenerife
  (`https://www.tripadvisor.com/Attractions-g187479-Activities-zft11292-Tenerife_Canary_Islands.html`)
  a été déduite par analogie avec La Palma et **n'a pas été testée**. Le script doit échouer
  proprement avec un message explicite si elle ne renvoie rien, pas continuer silencieusement.
- La pagination des pages de listing TripAdvisor : à confirmer sur le résultat réel avant de
  l'automatiser.

## Ce qu'il ne faut PAS faire dans cette session

- Pas de webapp de présentation (un fichier HTML statique suffit, cf. « Hors périmètre »).
- Pas de GetYourGuide Tenerife (phase ultérieure).
- Pas de nouvelle colonne en base : `avis_utilisateurs` et `lien_avis_tripadvisor` existent déjà.
- Pas de modification du code applicatif ODOS (backend ou frontend) sans validation explicite.
