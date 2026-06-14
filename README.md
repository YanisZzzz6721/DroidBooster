# DroidBooster

Application full-stack qui automatise la création de candidatures (lettres de motivation et CVs optimisés ATS) à partir d'une offre d'emploi, en s'appuyant sur l'API Claude (Anthropic).

---

## Sommaire

- [Aperçu](#aperçu)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Lancement](#lancement)
- [Pipeline IA](#pipeline-ia)
- [RAG — amélioration continue des CVs](#rag--amélioration-continue-des-cvs)
- [Structure du projet](#structure-du-projet)
- [Roadmap](#roadmap)

---

## Aperçu

DroidBooster prend une offre d'emploi (texte ou PDF) et génère automatiquement :

- une **lettre de motivation** personnalisée, rédigée par Claude, exportée en `.docx`
- un **score de compatibilité ATS** (0-100) entre l'offre et le CV sélectionné
- un **CV optimisé** intégrant les mots-clés manquants de l'offre
- un **historique complet** des candidatures, consultable par date ou par entreprise

Le projet est né d'un besoin personnel : automatiser la recherche d'emploi étudiant (restauration, accueil, logistique...) tout en gardant une qualité rédactionnelle professionnelle.

---

## Stack technique

**Backend**
- Python 3.14
- FastAPI
- SQLite
- Anthropic API (Claude Sonnet 4.6 / Haiku 4.5)
- python-docx, pdfplumber

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + design system custom
- Fetch natif

---

## Architecture

```
DroidBooster/
├── backend/
│   ├── api.py                  → API FastAPI (tous les endpoints)
│   ├── database.py             → SQLite (historique candidatures + exports)
│   ├── parser.py               → Parse un CV Markdown en structure éditable
│   ├── builder.py              → Injecte un CV parsé dans un template DOCX
│   ├── src/airecruit/
│   │   ├── parser.py           → Charge offres (PDF/TXT) + CVs Markdown
│   │   ├── matcher.py          → Sélectionne le meilleur CV via Claude
│   │   ├── generator.py        → Génère la lettre de motivation (.md + .docx)
│   │   ├── ats_analyzer.py     → Analyse ATS + génère le CV optimisé
│   │   ├── offer_parser.py     → Extrait poste/entreprise/adresse/secteur
│   │   └── scraper.py          → Recherche d'offres (Indeed)
│   ├── cvs/                    → CVs Markdown de base
│   │   └── generated/          → CVs générés automatiquement (RAG)
│   ├── output/                 → Lettres et CVs générés
│   └── templates/               → Template DOCX pour la lettre
│
└── frontend/
    ├── app/
    │   ├── page.tsx             → Page Générer (pipeline complet)
    │   ├── optimize/page.tsx    → Page Optimiser (analyse ATS)
    │   ├── export/page.tsx      → Page Exporter (CV Markdown → DOCX)
    │   ├── search/page.tsx      → Page Rechercher des offres
    │   └── history/page.tsx     → Page Historique (chronologique + par enseigne)
    ├── components/              → Sidebar, PushButton, Card, ScoreBar, Toast...
    └── lib/                      → fonctions fetch + contexte toasts
```

---

## Fonctionnalités

### Page Générer
Pipeline complet en un clic : collage ou upload de l'offre → matching du meilleur CV → génération de la lettre → analyse ATS → CV optimisé. Trois modes disponibles : pipeline complet, lettre seule, ou CV optimisé seul.

### Page Optimiser
Analyse ATS d'un CV collé manuellement face à une offre, avec score, mots-clés présents/manquants, suggestions concrètes et CV optimisé téléchargeable.

### Page Exporter
Conversion d'un CV Markdown vers un document `.docx` à partir d'un template personnel à balises (`[NOM]`, `[TITRE]`, `[SECTION:Profil]`, etc.).

### Page Rechercher
Recherche d'offres d'emploi (Indeed) par poste et ville.

### Page Historique
Deux vues :
- **Chronologique** — toutes les candidatures classées par date, avec scores Match/ATS, détail complet (offre, lettre, CV).
- **Par enseigne** — candidatures regroupées par entreprise. Pour chaque candidature : offre, CV optimisé et lettre affichés inline, copiables en un clic, téléchargeables, et possibilité de régénérer la lettre à partir du CV optimisé présent dans l'historique.

---

## Installation

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Créer un fichier `.env` dans `backend/` :

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend

```bash
cd frontend
npm install
```

Créer un fichier `.env.local` dans `frontend/` :

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Lancement

**Backend** (port 8000) :

```bash
cd backend
source .venv/bin/activate
python -m uvicorn api:app --reload --port 8000
```

**Frontend** (port 3000) :

```bash
cd frontend
npm run dev
```

- Application : http://localhost:3000
- Documentation API : http://localhost:8000/docs

---

## Pipeline IA

| Étape | Modèle | Rôle |
|---|---|---|
| Extraction métadonnées offre (poste, entreprise, adresse, secteur) | Claude Haiku 4.5 | Rapide, peu coûteux |
| Matching CV ↔ offre | Claude Sonnet 4.5 | Sélectionne le CV le plus pertinent parmi les profils disponibles |
| Génération de la lettre | Claude Sonnet 4.6 | Rédaction en 3 paragraphes stricts, respect chronologique, zéro invention |
| Analyse ATS | Claude Haiku 4.5 | Score de compatibilité + suggestions |
| Génération du CV optimisé | Claude Haiku 4.5 | Réécriture intégrant les mots-clés manquants |

---

## RAG — amélioration continue des CVs

Chaque CV optimisé généré est automatiquement sauvegardé dans `cvs/generated/`, classé par secteur d'activité (restauration, accueil, logistique, distribution, animation...).

Lors d'une nouvelle candidature dans le même secteur :

1. Le secteur de l'offre est détecté automatiquement par mots-clés
2. Le matcher charge en priorité les CVs déjà optimisés pour ce secteur
3. Les meilleurs CVs générés (score ATS ≥ 75) sont injectés comme exemples de référence dans le prompt de génération
4. Le profil, la disponibilité et les mots-clés du candidat restent **immuables** — toujours copiés depuis le CV original, jamais réécrits

Le système s'améliore donc automatiquement à chaque candidature, sans intervention manuelle.

---

## Structure du projet

Voir [Architecture](#architecture) ci-dessus pour le détail des dossiers et fichiers.

Base de données SQLite — table `candidatures` :

```
id, created_at, offre_titre, offre_texte, cv_nom, poste, entreprise,
adresse, match_score, ats_score, lettre_md, lettre_docx,
cv_optimise_md, preferences
```

---

## Roadmap

- [ ] Déploiement (backend Railway, frontend Vercel) — nécessite migration SQLite → Supabase
- [ ] Streaming des réponses Claude en temps réel
- [ ] France Travail API (en attente de validation officielle)
- [ ] Note de qualité automatique sur les lettres générées
- [ ] Multi-utilisateur + authentification

---

## Auteur

Yanis Zouggagh 