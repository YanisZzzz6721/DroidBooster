"""
Module d'analyse ATS (Applicant Tracking System).
"""

import json
import os
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL      = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1500

MOIS_FR = {
    1: "janvier", 2: "février", 3: "mars", 4: "avril",
    5: "mai", 6: "juin", 7: "juillet", 8: "août",
    9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre",
}

# ─── Dossier CVs générés ──────────────────────────────────────────────────────

def _get_generated_dir() -> Path:
    """Retourne le dossier cvs/generated/ et le crée si nécessaire."""
    generated_dir = Path(__file__).parent.parent.parent / "cvs" / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)
    return generated_dir


def _save_generated_cv(cv_optimise: str, cv_name: str, entreprise: str = "") -> Path:
    """
    Sauvegarde le CV optimisé dans cvs/generated/ avec un nom structuré.
    Format : cv_{cv_name}_{entreprise}_{YYYYMMDD}.md
    """
    generated_dir = _get_generated_dir()

    today    = datetime.now().strftime("%Y%m%d")
    ent_safe = entreprise.lower().replace(" ", "_")[:20] if entreprise else "unknown"
    ent_safe = "".join(c for c in ent_safe if c.isalnum() or c == "_")

    filename = f"cv_{cv_name}_{ent_safe}_{today}.md"
    path     = generated_dir / filename
    path.write_text(cv_optimise, encoding="utf-8")

    return path


# ─── Analyse ATS ─────────────────────────────────────────────────────────────

def analyze_ats(offer: str, match_result: dict, output_dir: str = "output") -> dict:
    cv_name    = match_result.get("cv_name", "cv_inconnu")
    cv_content = match_result.get("cv_content", "")

    if not cv_content:
        raise ValueError("match_result ne contient pas 'cv_content'.")

    analysis             = _call_claude(offer, cv_content, cv_name)
    report_path          = _generate_report(analysis, cv_name, output_dir)
    analysis["report_path"] = report_path

    return analysis


def _call_claude(offer: str, cv_content: str, cv_name: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""Tu es un analyseur ATS expert en recrutement.

Analyse la compatibilité entre cette offre et ce CV.

OFFRE :
\"\"\"
{offer}
\"\"\"

CV ({cv_name}) :
\"\"\"
{cv_content}
\"\"\"

Réponds UNIQUEMENT avec un JSON valide, sans backticks :

{{
  "score": <entier 0-100>,
  "keywords_found": ["mots-clés de l'offre PRÉSENTS dans le CV"],
  "keywords_missing": ["mots-clés de l'offre ABSENTS du CV"],
  "suggestions": ["3 à 5 suggestions concrètes et actionnables"],
  "summary": "2-3 phrases résumant la compatibilité"
}}

Barème : 90-100 excellent · 70-89 bon · 50-69 partiel · 0-49 faible
Suggestions = CONCRÈTES ("Ajouter HACCP dans Formation", pas "améliorer le CV")
Réponds en français."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Réponse Claude invalide :\n{raw[:300]}") from e

    for field in ["score", "keywords_found", "keywords_missing", "suggestions", "summary"]:
        if field not in data:
            raise ValueError(f"Champ manquant : '{field}'")

    data["score"] = max(0, min(100, int(data["score"])))
    return data


def _generate_report(analysis: dict, cv_name: str, output_dir: str) -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    today   = datetime.now()
    date_fr = f"{today.day} {MOIS_FR[today.month]} {today.year}"

    score       = analysis["score"]
    found       = analysis.get("keywords_found", [])
    missing     = analysis.get("keywords_missing", [])
    suggestions = analysis.get("suggestions", [])

    lines = [
        f"# Rapport ATS — {cv_name}", "",
        f"**Date :** {date_fr}", "", "---", "",
        "## Score global", "",
        f"### {score} / 100 — {_score_badge(score)}", "",
        f"`{_score_bar(score)}`", "",
        f"> {analysis['summary']}", "", "---", "",
        f"## Mots-clés présents ({len(found)})", "",
    ]
    lines += [f"- {kw}" for kw in found] if found else ["_Aucun._"]
    lines += ["", "---", "", f"## Mots-clés manquants ({len(missing)})", ""]
    lines += [f"- {kw}" for kw in missing] if missing else ["_Tous présents._"]
    lines += ["", "---", "", "## Suggestions", ""]
    lines += [f"{i}. {s}" for i, s in enumerate(suggestions, 1)] if suggestions else ["_Aucune._"]
    lines += ["", "---", "", f"*Généré par AIRecruit le {date_fr}.*"]

    report_path = output_path / f"ats_{cv_name}.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def _score_badge(score: int) -> str:
    if score >= 90: return "Excellent"
    if score >= 70: return "Bon match"
    if score >= 50: return "Match partiel"
    return "Match faible"


def _score_bar(score: int, length: int = 25) -> str:
    filled = int(round(score / 100 * length))
    return "█" * filled + "░" * (length - filled) + f"  {score}%"


# ─── Génération CV optimisé ───────────────────────────────────────────────────

def generate_optimized_cv(
    offer: str,
    match_result: dict,
    analysis: dict,
    output_dir: str = "output",
    entreprise: str = "",
) -> tuple:
    """
    Génère un CV optimisé et le sauvegarde dans :
      - output/cv_optimise_{cv_name}.md  (sortie standard)
      - cvs/generated/cv_{cv_name}_{entreprise}_{date}.md  (NOUVEAU - RAG)
    """
    cv_name    = match_result.get("cv_name", "cv_inconnu")
    cv_content = match_result.get("cv_content", "")
    client     = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    keywords_missing = ", ".join(analysis.get("keywords_missing", [])) or "aucun"
    keywords_found   = ", ".join(analysis.get("keywords_found", []))   or "aucun"
    suggestions      = "\n".join(f"- {s}" for s in analysis.get("suggestions", []))
    score_actuel     = analysis.get("score", "?")

    prompt = f"""Tu es un expert en rédaction de CV et en optimisation ATS, spécialisé dans la rédaction percutante orientée résultats.

Voici une offre d'emploi, un CV existant, et les résultats d'une analyse ATS.
Ton rôle : réécrire intégralement le CV en Markdown optimisé pour maximiser le score ATS face à cette offre.

=== OFFRE D'EMPLOI ===
{offer}

=== CV ORIGINAL ({cv_name}) ===
{cv_content}

=== RAPPORT ATS (score actuel : {score_actuel}/100) ===
Mots-clés déjà présents : {keywords_found}
Mots-clés MANQUANTS à intégrer absolument : {keywords_missing}
Suggestions d'amélioration :
{suggestions}

=== INSTRUCTIONS ===

1. STRUCTURE FIXE — en-tête OBLIGATOIRE sur 2 lignes séparées :
   # Prénom NOM
   **Titre du poste adapté à l'offre**

   Puis sections ## dans cet ordre :
   ## Profil
   ## Compétences
   ## Expériences
   ## Formation

   ⚠ INTERDIT : écrire # Prénom NOM — Titre sur une seule ligne

2. NOMBRE D'ÉLÉMENTS — CONTRAINTE ABSOLUE :
   - Compétences    : EXACTEMENT 7 entrées, ni plus ni moins
   - Expériences    : EXACTEMENT le nombre d'expériences présentes dans le CV original (max 4)
     → Ne jamais inventer une expérience absente du CV original
   - Bullets/expérience : EXACTEMENT 4 bullets par expérience, ni plus ni moins
   - Formation      : 1 ligne par diplôme, ordre chronologique inversé
   - Profil         : EXACTEMENT 3 phrases, pas une de plus :
     1. Statut + disponibilité ("En année sabbatique, disponible immédiatement à temps plein.")
     2. Compétences clés du poste en une phrase dense avec mots-clés ATS
     3. Un différenciateur concret (langue, certification, compétence rare)
     → Zéro générique ("dynamique", "motivé", "passionné")
     → Zéro répétition entre les 3 phrases

3. FORMAT STRICT :
   Compétences → **Label (3 mots max)** : description
   Règles description compétence :
   - Maximum 60 caractères par description (75 exceptionnellement pour 1 ou 2 max)
   - Vise ce qui frappe au premier regard : capacité rare, savoir-faire concret
   - Priorité aux compétences les plus valorisées dans l'offre
   - Jamais de générique ("bonne communication", "dynamique", "motivé")
   - Exemples :
     **Accueil multilingue** : Orientation voyageurs en français et anglais, flux dense
     **Gestion de crise** : Résolution autonome d'incidents clients sous pression
     **Rigueur procédurale** : Application stricte des protocoles SNCF et traçabilité
   - Expériences : TOUJOURS ordre chronologique inversé (la plus récente en premier)

   Expérience  → ### Intitulé du poste — Entreprise, Ville
                  Mois AAAA – Mois AAAA
                  - Bullet 1
                  - Bullet 2
                  - Bullet 3
                  - Bullet 4
   Formation   → ### Diplôme — Institution
                  AAAA ou AAAA – présent

4. RÉDACTION :
   - Chaque bullet commence par un verbe d'action nominalisé sans conjugaison
     Ex : "Accueil de", "Gestion de", "Coordination de", "Traitement de"
   - 1 verbe d'action + fait concret + résultat chiffré si possible
   - 12 mots maximum par bullet — sans exception
   - Zéro phrase creuse, zéro remplissage, zéro répétition entre bullets

5. OPTIMISATION ATS :
   - Intègre tous les mots-clés MANQUANTS naturellement dans bullets et profil
   - Conserve et renforce les mots-clés déjà présents
   - Priorité aux mots-clés les plus fréquents dans l'offre

6. CONTRAINTES ABSOLUES :
   - Ne jamais inventer une expérience, compétence ou diplôme absent du CV original
   - Répondre uniquement en français
   - Répondre uniquement avec le Markdown brut du CV, sans commentaire ni balise de code"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    cv_optimise = response.content[0].text.strip()

    today   = datetime.now()
    date_fr = f"{today.day} {MOIS_FR[today.month]} {today.year}"
    header  = (
        f"<!-- CV optimisé par AIRecruit le {date_fr} -->\n"
        f"<!-- Basé sur : {cv_name} | Score ATS avant optimisation : {score_actuel}/100 -->\n\n"
    )

    # ── Sauvegarde standard (output/)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    cv_path = output_path / f"cv_optimise_{cv_name}.md"
    cv_path.write_text(header + cv_optimise, encoding="utf-8")

    # ── NOUVEAU : Sauvegarde dans cvs/generated/ pour le RAG
    _save_generated_cv(header + cv_optimise, cv_name, entreprise)

    # Génération PDF (optionnel)
    try:
        from airecruit.cv_renderer import render_cv_pdf
        pdf_path = render_cv_pdf(str(cv_path), output_dir)
        return cv_path, pdf_path
    except ImportError:
        return cv_path, None