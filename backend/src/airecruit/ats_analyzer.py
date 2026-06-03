"""
Module d'analyse ATS (Applicant Tracking System).

Analyse la compatibilité entre une offre d'emploi et le CV sélectionné :
- Score global de compatibilité (0-100)
- Mots-clés présents / manquants dans le CV
- Suggestions concrètes d'amélioration

Génère un rapport Markdown dans output/.
"""

import json
import os
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

# Modèle — options disponibles :
# "claude-haiku-4-5-20251001"  → rapide et économique
# "claude-sonnet-4-6"          → plus puissant
# "claude-opus-4-6"            → le plus puissant
MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1500

MOIS_FR = {
    1: "janvier", 2: "février", 3: "mars", 4: "avril",
    5: "mai", 6: "juin", 7: "juillet", 8: "août",
    9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre",
}


def analyze_ats(offer: str, match_result: dict, output_dir: str = "output") -> dict:
    """
    Analyse la compatibilité ATS entre une offre et le CV sélectionné.

    Args:
        offer        : Texte brut de l'offre d'emploi.
        match_result : Résultat du matcher (contient cv_name et cv_content).
        output_dir   : Dossier de sortie pour le rapport Markdown.

    Returns dict :
        score            : int (0-100)
        keywords_found   : list[str]
        keywords_missing : list[str]
        suggestions      : list[str]
        summary          : str
        report_path      : Path du rapport Markdown généré
    """
    cv_name = match_result.get("cv_name", "cv_inconnu")
    cv_content = match_result.get("cv_content", "")

    if not cv_content:
        raise ValueError("match_result ne contient pas 'cv_content'. Vérifie matcher.py.")

    analysis = _call_claude(offer, cv_content, cv_name)
    report_path = _generate_report(analysis, cv_name, output_dir)
    analysis["report_path"] = report_path

    return analysis


def _call_claude(offer: str, cv_content: str, cv_name: str) -> dict:
    """Appelle Claude pour obtenir l'analyse ATS en JSON structuré."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""Tu es un analyseur ATS (Applicant Tracking System) expert en recrutement.

Analyse la compatibilité entre cette offre d'emploi et ce CV, comme le ferait un vrai système ATS utilisé par les recruteurs.

OFFRE D'EMPLOI :
\"\"\"
{offer}
\"\"\"

CV ANALYSÉ ({cv_name}) :
\"\"\"
{cv_content}
\"\"\"

Réponds UNIQUEMENT avec un JSON valide, sans backticks, sans texte avant ou après :

{{
  "score": <entier entre 0 et 100>,
  "keywords_found": ["liste des mots-clés importants de l'offre qui sont PRÉSENTS dans le CV"],
  "keywords_missing": ["liste des mots-clés importants de l'offre qui sont ABSENTS du CV"],
  "suggestions": ["3 à 5 suggestions concrètes et actionnables pour améliorer le CV face à cette offre"],
  "summary": "2-3 phrases résumant la compatibilité globale"
}}

Barème du score :
- 90-100 : match excellent, très forte probabilité d'être retenu par l'ATS
- 70-89  : bon match, quelques ajustements suffisent
- 50-69  : match partiel, des éléments importants manquent
- 0-49   : match faible, CV peu adapté à cette offre

Règles :
- Mots-clés = les TERMES CLÉS de l'offre (compétences, qualités, certifications, expériences requises)
- Suggestions = CONCRÈTES ("Ajouter la mention HACCP dans la section Formation" pas "améliorer le CV")
- Réponds en français"""

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
        raise ValueError(f"Réponse Claude invalide (non-JSON) :\n{raw[:300]}") from e

    for field in ["score", "keywords_found", "keywords_missing", "suggestions", "summary"]:
        if field not in data:
            raise ValueError(f"Champ manquant dans la réponse Claude : '{field}'")

    data["score"] = max(0, min(100, int(data["score"])))
    return data


def _generate_report(analysis: dict, cv_name: str, output_dir: str) -> Path:
    """Génère un rapport Markdown lisible dans output/."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    today = datetime.now()
    date_fr = f"{today.day} {MOIS_FR[today.month]} {today.year}"

    score       = analysis["score"]
    found       = analysis.get("keywords_found", [])
    missing     = analysis.get("keywords_missing", [])
    suggestions = analysis.get("suggestions", [])

    lines = [
        f"# Rapport ATS — {cv_name}",
        "",
        f"**Date :** {date_fr}",
        "",
        "---",
        "",
        "## Score global de compatibilité",
        "",
        f"### {score} / 100 — {_score_badge(score)}",
        "",
        f"`{_score_bar(score)}`",
        "",
        f"> {analysis['summary']}",
        "",
        "---",
        "",
        f"## ✅ Mots-clés présents dans le CV ({len(found)})",
        "",
    ]

    lines += [f"- {kw}" for kw in found] if found else ["_Aucun mot-clé de l'offre détecté._"]

    lines += ["", "---", "", f"## ❌ Mots-clés manquants ({len(missing)})", ""]
    lines += [f"- {kw}" for kw in missing] if missing else ["_Tous les mots-clés sont présents — excellent !_"]

    lines += ["", "---", "", "## 💡 Suggestions d'amélioration", ""]
    lines += [f"{i}. {s}" for i, s in enumerate(suggestions, 1)] if suggestions else ["_Aucune suggestion._"]

    lines += ["", "---", "", f"*Rapport généré automatiquement par AIRecruit le {date_fr}.*"]

    content = "\n".join(lines)
    report_path = output_path / f"ats_{cv_name}.md"
    report_path.write_text(content, encoding="utf-8")

    return report_path


def _score_badge(score: int) -> str:
    if score >= 90:
        return "🟢 Excellent"
    elif score >= 70:
        return "🟢 Bon match"
    elif score >= 50:
        return "🟡 Match partiel"
    else:
        return "🔴 Match faible"


def _score_bar(score: int, length: int = 25) -> str:
    filled = int(round(score / 100 * length))
    empty  = length - filled
    return "█" * filled + "░" * empty + f"  {score}%"


def generate_optimized_cv(offer: str, match_result: dict, analysis: dict, output_dir: str = "output") -> Path:
    """
    Génère un CV optimisé en Markdown à partir du CV original et du rapport ATS.

    Le CV généré intègre les mots-clés manquants et applique les suggestions
    de l'analyse ATS pour maximiser le score de compatibilité.

    Args:
        offer        : Texte brut de l'offre d'emploi.
        match_result : Résultat du matcher (cv_name, cv_content).
        analysis     : Résultat de analyze_ats (keywords_missing, suggestions, etc.).
        output_dir   : Dossier de sortie.

    Returns:
        Path du CV optimisé généré (output/cv_optimise_<cv_name>.md)
    """
    cv_name    = match_result.get("cv_name", "cv_inconnu")
    cv_content = match_result.get("cv_content", "")

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    keywords_missing = ", ".join(analysis.get("keywords_missing", [])) or "aucun"
    keywords_found   = ", ".join(analysis.get("keywords_found", [])) or "aucun"
    suggestions      = "\n".join(f"- {s}" for s in analysis.get("suggestions", []))
    score_actuel     = analysis.get("score", "?")

    prompt = fprompt = f"""Tu es un expert en rédaction de CV et en optimisation ATS (Applicant Tracking Systems), spécialisé dans la rédaction percutante orientée résultats.

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

3. FORMAT STRICT — respecter ces formats ligne à ligne :
   Compétences → **Label (3 mots max)** : description
   Règles description compétence :
   - Maximum 60 caractères par description (75 exceptionnellement pour 1 ou 2 max)
   - Peut être une phrase complète courte et percutante
   - Vise ce qui frappe au premier regard : capacité rare, savoir-faire concret,
     différenciateur réel par rapport aux autres candidats
   - Priorité aux compétences les plus valorisées dans l'offre
   - Jamais de générique ("bonne communication", "dynamique", "motivé")
   - Exemples de niveau attendu :
     **Accueil multilingue** : Orientation voyageurs en français et anglais, flux dense
     **Gestion de crise** : Résolution autonome d'incidents clients sous pression
     **Rigueur procédurale** : Application stricte des protocoles SNCF et traçabilité
   - Expériences : TOUJOURS dans l'ordre chronologique inversé (la plus récente en premier)
         → Ne jamais réorganiser selon la pertinence

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

    # Ajout d'un en-tête informatif
    today    = datetime.now()
    date_fr  = f"{today.day} {MOIS_FR[today.month]} {today.year}"
    header   = (
        f"<!-- CV optimisé par AIRecruit le {date_fr} -->\n"
        f"<!-- Basé sur : {cv_name} | Score ATS avant optimisation : {score_actuel}/100 -->\n\n"
    )

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    cv_path = output_path / f"cv_optimise_{cv_name}.md"
    cv_path.write_text(header + cv_optimise, encoding="utf-8")

    # Génération du PDF graphique
    try:
        from airecruit.cv_renderer import render_cv_pdf
        pdf_path = render_cv_pdf(str(cv_path), output_dir)
        return cv_path, pdf_path
    except ImportError:
        # weasyprint non installé — retourne seulement le Markdown
        return cv_path, None