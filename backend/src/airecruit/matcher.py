import os
import json
from pathlib import Path
from dotenv import load_dotenv
import anthropic

load_dotenv()


def _load_generated_cvs(secteur: str = "") -> list[dict]:
    """
    Charge les CVs générés depuis cvs/generated/ filtrés par secteur.
    Retourne les 3 plus récents du secteur si secteur fourni,
    sinon les 3 plus récents toutes catégories.
    """
    generated_dir = Path(__file__).parent.parent.parent / "cvs" / "generated"
    if not generated_dir.exists():
        return []

    all_files = sorted(
        generated_dir.glob("*.md"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )

    if secteur and secteur != "autre":
        # Filtre par secteur dans le nom du fichier
        filtered = [f for f in all_files if f"cv_{secteur.split('_')[0]}" in f.name or secteur in f.name]
        # Fallback : si pas assez de fichiers pour ce secteur, prend les plus récents
        files = filtered[:3] if filtered else all_files[:2]
    else:
        files = all_files[:2]

    result = []
    for f in files:
        try:
            content = f.read_text(encoding="utf-8")
            result.append({
                "name":    f"generated/{f.stem}",
                "content": content,
                "is_generated": True,
            })
        except Exception:
            continue

    return result


def match_cv(offer: str, cvs: list[dict], secteur: str = "") -> dict:
    """
    Sélectionne le meilleur CV parmi les CVs de base + les CVs générés du même secteur.

    Args:
        offer   : Texte de l'offre d'emploi
        cvs     : CVs de base depuis cvs/
        secteur : Secteur détecté (pour filtrer cvs/generated/)
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Charge les CVs générés du même secteur
    generated_cvs = _load_generated_cvs(secteur)

    # CVs générés en priorité (devant les CVs de base)
    all_cvs = generated_cvs + cvs

    cvs_formatted = ""
    for i, cv in enumerate(all_cvs):
        tag = " [OPTIMISÉ ATS]" if cv.get("is_generated") else ""
        cvs_formatted += f"\n\n=== CV {i} : {cv['name']}{tag} ===\n{cv['content']}"

    json_schema = """{
    "cv_index": <index du meilleur CV>,
    "match_score": <score de 0 à 100>,
    "job_keywords": ["mots", "clés", "de", "l'offre"],
    "cv_keywords": ["points", "forts", "du", "CV"],
    "selection_reason": "Explication en 2-3 phrases"
}"""

    prompt = f"""Tu es un expert RH senior. Analyse cette offre d'emploi et ces CVs.

Les CVs marqués [OPTIMISÉ ATS] ont déjà été optimisés pour des offres similaires — donne-leur une légère préférence à compétences égales.

=== OFFRE D'EMPLOI ===
{offer}

=== CVS DES CANDIDATS ===
{cvs_formatted}

Sélectionne le CV qui correspond le mieux à l'offre.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, sans backticks :
{json_schema}"""

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    result = json.loads(raw)

    selected_cv = all_cvs[result["cv_index"]]
    result["cv_name"]    = selected_cv["name"]
    result["cv_content"] = selected_cv["content"]

    return result