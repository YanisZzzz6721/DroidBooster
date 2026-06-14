"""
Module d'analyse ATS (Applicant Tracking System).
"""

import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from database import save_generated_cv as db_save_generated_cv, get_examples_by_secteur

load_dotenv()

MODEL      = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1500

OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"
CVS_DIR    = Path(__file__).parent.parent.parent / "cvs"

_examples_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 300  # secondes

MOIS_FR = {
    1: "janvier", 2: "février", 3: "mars", 4: "avril",
    5: "mai", 6: "juin", 7: "juillet", 8: "août",
    9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre",
}


def _clean_cv_name(cv_name: str) -> str:
    """Supprime les slashes si le cv_name vient de cvs/generated/."""
    return cv_name.split("/")[-1].split("\\")[-1]


def _extract_base_name(cv_name_clean: str) -> str:
    """
    Extrait le nom de base du CV original depuis un nom de CV généré.
    Ex: cv_cv_restauration_yamisushi_20260608 → cv_restauration
    Évite les noms en cascade comme cv_cv_cv_restauration_...
    """
    # Cherche un pattern de date YYYYMMDD pour identifier un CV généré
    m = re.search(r"(cv_\w+?)_\w+_\d{8}", cv_name_clean)
    if m:
        return m.group(1)
    return cv_name_clean


def _extract_profil(cv_content: str) -> str:
    """
    Extrait la section ## Profil ou ## Objectif du CV original.
    Ce texte est immuable — Claude ne peut pas le modifier.
    """
    m = re.search(
        r"##\s*(Profil|Objectif)\s*\n(.*?)(?=\n##|\Z)",
        cv_content,
        re.DOTALL | re.IGNORECASE,
    )
    if m:
        return m.group(2).strip()
    return ""


def _extract_mots_cles(cv_content: str) -> str:
    """
    Extrait les mots_cles du frontmatter YAML du CV original.
    Retourne vide si pas de frontmatter (CV généré).
    """
    m = re.search(r"mots_cles\s*:\s*(.+)", cv_content)
    if m:
        return m.group(1).strip()
    return ""


def _get_original_mots_cles(cv_name_clean: str) -> str:
    """
    Remonte au CV original depuis un nom de CV généré.
    Cherche parmi les CVs originaux dans cvs/ celui dont le nom
    est contenu dans le nom du CV généré.
    """
    for cv_file in sorted(CVS_DIR.glob("*.md")):
        stem = cv_file.stem  # ex: cv_restauration
        if stem in cv_name_clean:
            try:
                content   = cv_file.read_text(encoding="utf-8")
                mots_cles = _extract_mots_cles(content)
                if mots_cles:
                    return mots_cles
            except Exception:
                continue
    return ""


def _get_original_profil(cv_name_clean: str) -> str:
    """
    Remonte au CV original pour récupérer le profil/objectif immuable.
    """
    for cv_file in sorted(CVS_DIR.glob("*.md")):
        stem = cv_file.stem
        if stem in cv_name_clean:
            try:
                content = cv_file.read_text(encoding="utf-8")
                profil  = _extract_profil(content)
                if profil:
                    return profil
            except Exception:
                continue
    return ""


# ─── Dossier CVs générés ──────────────────────────────────────────────────────

def _get_generated_dir() -> Path:
    generated_dir = Path(__file__).parent.parent.parent / "cvs" / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)
    return generated_dir


def _save_generated_cv(cv_optimise: str, cv_name: str, entreprise: str = "", secteur: str = "", score_ats: int = None) -> Path:
    generated_dir = _get_generated_dir()
    today        = datetime.now().strftime("%Y%m%d")
    ent_safe     = entreprise.lower().replace(" ", "_")[:20] if entreprise else "unknown"
    ent_safe     = "".join(c for c in ent_safe if c.isalnum() or c == "_")
    cv_name_safe = _clean_cv_name(cv_name)

    # ── Garde-fou : évite les noms en cascade
    # Si le nom contient déjà une date YYYYMMDD, c'est un CV généré
    # → on extrait juste la base originale pour le nom du fichier
    base_match = re.search(r"(cv_\w+?)_\w+_\d{8}", cv_name_safe)
    if base_match:
        cv_name_safe = base_match.group(1)

    filename = f"cv_{cv_name_safe}_{ent_safe}_{today}.md"
    path     = generated_dir / filename
    path.write_text(cv_optimise, encoding="utf-8")

    # Sauvegarde en DB (en plus du fichier)
    try:
        db_save_generated_cv(
            secteur=secteur or "autre",
            cv_base=cv_name_safe,
            content=cv_optimise,
            score_ats=score_ats,
            entreprise=entreprise or None,
            file_path=str(path),
        )
    except Exception:
        pass  # La DB est un bonus — ne pas bloquer si elle échoue

    return path


def _extract_score(content: str) -> int:
    m = re.search(r"Score ATS avant optimisation : (\d+)/100", content)
    return int(m.group(1)) if m else 0


def _load_examples(secteur: str = "", max_examples: int = 2, min_score: int = 85) -> str:
    cache_key = f"{secteur}_{max_examples}_{min_score}"
    now = time.time()

    if cache_key in _examples_cache:
        cached_result, cached_at = _examples_cache[cache_key]
        if now - cached_at < _CACHE_TTL:
            return cached_result

    # ── Priorité DB ───────────────────────────────────────────────────────────
    try:
        rows = get_examples_by_secteur(secteur, max_examples=max_examples, min_score=min_score)
        if rows:
            examples = []
            for row in rows:
                lines = [l for l in row["content"].split("\n") if not l.startswith("<!--")]
                examples.append(f"<!-- Score ATS : {row['score_ats']}/100 -->\n" + "\n".join(lines).strip())
            result = "\n\n---EXEMPLE---\n\n".join(examples)
            _examples_cache[cache_key] = (result, now)
            return result
    except Exception:
        pass  # Fallback fichiers si la DB échoue

    # ── Fallback fichiers (système actuel inchangé) ────────────────────────────
    generated_dir = _get_generated_dir()
    all_files = sorted(
        generated_dir.glob("*.md"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    if not all_files:
        _examples_cache[cache_key] = ("", now)
        return ""
    if secteur and secteur != "autre":
        filtered   = [f for f in all_files if secteur in f.name]
        candidates = filtered if filtered else all_files
    else:
        candidates = all_files
    good_examples = []
    for f in candidates:
        try:
            content = f.read_text(encoding="utf-8")
            score   = _extract_score(content)
            if score >= min_score:
                good_examples.append((score, content))
        except Exception:
            continue
    if not good_examples:
        _examples_cache[cache_key] = ("", now)
        return ""
    good_examples.sort(key=lambda x: x[0], reverse=True)
    top      = good_examples[:max_examples]
    examples = []
    for score, content in top:
        lines = [l for l in content.split("\n") if not l.startswith("<!--")]
        examples.append(f"<!-- Score ATS : {score}/100 -->\n" + "\n".join(lines).strip())
    result = "\n\n---EXEMPLE---\n\n".join(examples)

    _examples_cache[cache_key] = (result, now)
    return result


def invalidate_examples_cache() -> None:
    """À appeler après la sauvegarde d'un nouveau CV généré."""
    _examples_cache.clear()


# ─── Analyse ATS ─────────────────────────────────────────────────────────────

def analyze_ats(offer: str, match_result: dict, output_dir: str = "output") -> dict:
    cv_name    = _clean_cv_name(match_result.get("cv_name", "cv_inconnu"))
    cv_content = match_result.get("cv_content", "")

    if not cv_content:
        raise ValueError("match_result ne contient pas 'cv_content'.")

    analysis                = _call_claude(offer, cv_content, cv_name)
    report_path             = _generate_report(analysis, cv_name)
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


def _generate_report(analysis: dict, cv_name: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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

    report_path = OUTPUT_DIR / f"ats_{cv_name}.md"
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
    secteur: str = "",
) -> tuple:
    cv_name    = _clean_cv_name(match_result.get("cv_name", "cv_inconnu"))
    cv_content = match_result.get("cv_content", "")
    client     = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    keywords_missing = ", ".join(analysis.get("keywords_missing", [])) or "aucun"
    keywords_found   = ", ".join(analysis.get("keywords_found", []))   or "aucun"
    suggestions      = "\n".join(f"- {s}" for s in analysis.get("suggestions", []))
    score_actuel     = analysis.get("score", "?")

    # ── Données immuables — toujours depuis le CV ORIGINAL ───────────────────
    # Le profil vient du CV courant si présent, sinon du CV original
    profil_original = _extract_profil(cv_content)
    if not profil_original:
        profil_original = _get_original_profil(cv_name)

    # Les mots-clés viennent du frontmatter — si CV généré, remonte à l'original
    mots_cles_cv = _extract_mots_cles(cv_content)
    if not mots_cles_cv:
        mots_cles_cv = _get_original_mots_cles(cv_name)

    immuable_section = f"""
=== DONNÉES IMMUABLES — COPIER MOT POUR MOT, NE JAMAIS MODIFIER ===
Ces informations sont figées et doivent apparaître exactement telles quelles :

PROFIL / OBJECTIF (à copier tel quel dans ## Profil) :
{profil_original}

MOTS-CLÉS CV DE BASE (à conserver et renforcer dans les bullets et compétences) :
{mots_cles_cv}

RÈGLES STRICTES :
→ La disponibilité, le statut (année sabbatique) et toutes les infos du profil
  doivent être copiées mot pour mot — ne jamais reformuler.
→ Ne jamais déduire une date de disponibilité depuis la Formation.
→ Ne jamais écrire "disponible à partir de" — toujours "disponible immédiatement".
→ Tous les mots-clés du CV de base doivent apparaître dans le CV généré.
"""

    # ── RAG : exemples du même secteur ────────────────────────────────────────
    exemples_str     = _load_examples(secteur, max_examples=2)
    exemples_section = f"""
=== EXEMPLES DE CVS BIEN RÉDIGÉS (même secteur — inspire-toi du niveau et du style) ===
{exemples_str}

""" if exemples_str else ""

    prompt = f"""Tu es un expert en rédaction de CV et en optimisation ATS, spécialisé dans la rédaction percutante orientée résultats.

Voici une offre d'emploi, un CV existant, et les résultats d'une analyse ATS.
Ton rôle : réécrire intégralement le CV en Markdown optimisé pour maximiser le score ATS face à cette offre.
{immuable_section}
{exemples_section}
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
   - Profil         : COPIER MOT POUR MOT depuis DONNÉES IMMUABLES ci-dessus
     → Ne jamais réécrire ni reformuler le profil

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
   - Intègre tous les mots-clés MANQUANTS naturellement dans bullets
   - Conserve et renforce TOUS les mots-clés du CV de base listés dans DONNÉES IMMUABLES
   - Priorité aux mots-clés les plus fréquents dans l'offre

6. CONTRAINTES ABSOLUES :
   - Ne jamais inventer une expérience, compétence ou diplôme absent du CV original
   - Ne jamais modifier la disponibilité ni le statut du candidat
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
        f"<!-- Basé sur : {cv_name} | Score ATS avant optimisation : {score_actuel}/100 -->\n"
        f"<!-- Secteur : {secteur or 'non détecté'} -->\n\n"
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cv_path = OUTPUT_DIR / f"cv_optimise_{cv_name}.md"
    cv_path.write_text(header + cv_optimise, encoding="utf-8")

    _save_generated_cv(header + cv_optimise, cv_name, entreprise, secteur=secteur, score_ats=analysis.get("score"))
    invalidate_examples_cache()

    try:
        from airecruit.cv_renderer import render_cv_pdf
        pdf_path = render_cv_pdf(str(cv_path), str(OUTPUT_DIR))
        return cv_path, pdf_path
    except ImportError:
        return cv_path, None