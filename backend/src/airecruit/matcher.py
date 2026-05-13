import os
import json
from dotenv import load_dotenv
import anthropic

load_dotenv()


def match_cv(offer: str, cvs: list[dict]) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    cvs_formatted = ""
    for i, cv in enumerate(cvs):
        cvs_formatted += f"\n\n=== CV {i} : {cv['name']} ===\n{cv['content']}"

    json_schema = """
{
    "cv_index": <index du meilleur CV>,
    "match_score": <score de 0 à 100>,
    "job_keywords": ["mots", "clés", "de", "l'offre"],
    "cv_keywords": ["points", "forts", "du", "CV"],
    "selection_reason": "Explication en 2-3 phrases"
}"""

    prompt = f"""Tu es un expert RH senior. Analyse cette offre d'emploi et ces CVs.

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

    selected_cv = cvs[result["cv_index"]]
    result["cv_name"] = selected_cv["name"]
    result["cv_content"] = selected_cv["content"]

    return result