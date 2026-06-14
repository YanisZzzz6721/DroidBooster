import os
import re
import json
from pathlib import Path
from dotenv import load_dotenv
import anthropic
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from logger import get_logger, log_api_call

load_dotenv()
log = get_logger(__name__)


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
        filtered = [f for f in all_files if f"cv_{secteur.split('_')[0]}" in f.name or secteur in f.name]
        files = filtered[:3] if filtered else all_files[:2]
    else:
        files = all_files[:2]

    result = []
    for f in files:
        try:
            content = f.read_text(encoding="utf-8")
            result.append({
                "name":         f"generated/{f.stem}",
                "content":      content,
                "is_generated": True,
            })
        except Exception:
            continue

    return result


def _tokenize(text: str) -> set[str]:
    """Extrait les mots significatifs d'un texte (min 3 caractères)."""
    words = re.findall(r"[a-zA-ZÀ-ÿ]{3,}", text.lower())
    stopwords = {
        "les", "des", "une", "que", "qui", "par", "sur", "est", "son",
        "ses", "dans", "avec", "pour", "vous", "nous", "ils", "elle",
        "aux", "ces", "cet", "cette", "mais", "tout", "bien", "plus",
        "très", "être", "avoir", "faire", "notre", "votre", "leur",
    }
    return {w for w in words if w not in stopwords}


def _score_local(offer: str, cv_content: str) -> float:
    """
    Score TF-IDF simplifié : ratio de mots de l'offre présents dans le CV.
    Retourne un score entre 0 et 100.
    """
    offer_tokens = _tokenize(offer)
    cv_tokens    = _tokenize(cv_content)

    if not offer_tokens:
        return 0.0

    matches = offer_tokens & cv_tokens
    return round(len(matches) / len(offer_tokens) * 100, 1)


def _claude_arbitrage(offer: str, finalistes: list[dict]) -> dict:
    """Appelle Claude uniquement pour arbitrer entre 2 CVs ex-aequo."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    cvs_formatted = ""
    for i, cv in enumerate(finalistes):
        tag = " [OPTIMISÉ ATS]" if cv.get("is_generated") else ""
        cvs_formatted += f"\n\n=== CV {i} : {cv['name']}{tag} ===\n{cv['content']}"

    json_schema = """{
    "cv_index": <0 ou 1>,
    "match_score": <score de 0 à 100>,
    "job_keywords": ["mots", "clés", "de", "l'offre"],
    "cv_keywords": ["points", "forts", "du", "CV"],
    "selection_reason": "Explication en 2-3 phrases"
}"""

    prompt = f"""Tu es un expert RH senior. Ces 2 CVs sont proches en score — choisis le meilleur pour cette offre.

Les CVs marqués [OPTIMISÉ ATS] ont déjà été optimisés pour des offres similaires — donne-leur une légère préférence à compétences égales.

=== OFFRE D'EMPLOI ===
{offer}

=== CVS FINALISTES ===
{cvs_formatted}

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, sans backticks :
{json_schema}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


def match_cv(offer: str, cvs: list[dict], secteur: str = "") -> dict:
    """
    Sélectionne le meilleur CV via scoring TF-IDF local.
    Claude n'intervient que si 2 CVs sont ex-aequo (écart < 15 points).
    """
    generated_cvs = _load_generated_cvs(secteur)
    all_cvs = generated_cvs + cvs

    # ── Scoring local ─────────────────────────────────────────────────────────
    scored = []
    for i, cv in enumerate(all_cvs):
        score = _score_local(offer, cv["content"])
        # Bonus léger pour les CVs déjà optimisés ATS
        if cv.get("is_generated"):
            score = min(100, score + 5)
        scored.append((score, i, cv))

    scored.sort(key=lambda x: x[0], reverse=True)

    best_score,  best_idx,  best_cv  = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0

    log.debug("Scores TF-IDF : %s", [(s[2]["name"], s[0]) for s in scored])

    # ── Gagnant clair → pas d'appel Claude ───────────────────────────────────
    if best_score - second_score >= 15 or len(scored) == 1:
        log.info("Match local → %s (score %.1f, écart %.1f)", best_cv["name"], best_score, best_score - second_score)
        return {
            "cv_index":        best_idx,
            "cv_name":         best_cv["name"],
            "cv_content":      best_cv["content"],
            "match_score":     int(best_score),
            "job_keywords":    list(_tokenize(offer))[:10],
            "cv_keywords":     list(_tokenize(best_cv["content"]) & _tokenize(offer))[:10],
            "selection_reason": f"Sélection locale — score TF-IDF {best_score}/100 (écart net avec le suivant).",
        }

    # ── Ex-aequo → Claude arbitre sur les 2 finalistes uniquement ────────────
    log.info("Ex-aequo (écart %.1f) → arbitrage Claude entre %s et %s",
             best_score - second_score, scored[0][2]["name"], scored[1][2]["name"])
    finalistes = [scored[0][2], scored[1][2]]
    result     = _claude_arbitrage(offer, finalistes)

    # Remapper l'index Claude (0 ou 1) vers l'index réel dans all_cvs
    cv_choisi          = finalistes[result["cv_index"]]
    result["cv_name"]  = cv_choisi["name"]
    result["cv_content"] = cv_choisi["content"]

    return result
