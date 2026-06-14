"""
offer_parser.py — Extraction intelligente des métadonnées d'une offre d'emploi.

Utilise Claude pour extraire depuis le texte brut de l'offre :
  - Le poste exact
  - Le nom de l'entreprise
  - L'adresse complète
  - Le secteur d'activité (pour le RAG)
"""

import json
import os
import re

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = "claude-haiku-4-5-20251001"

# Secteurs reconnus — utilisés pour filtrer les CVs générés
SECTEURS = [
    "restauration",
    "accueil",
    "logistique",
    "distribution",
    "animation",
    "informatique",
    "autre",
]

# Mots-clés par secteur pour détection rapide sans API
SECTEURS_KEYWORDS = {
    "restauration": ["serveur", "cuisinier", "barman", "restauration", "salle", "brasserie",
                     "café", "salon de thé", "burger", "pizzeria", "traiteur", "snack",
                     "équipier", "plongeur", "commis", "chef", "bioburger", "mcdonald"],
    "accueil":      ["accueil", "réceptionniste", "hôte", "hôtesse", "relation client",
                     "standard", "front desk", "agent d'accueil", "sncf", "gare"],
    "logistique":   ["logistique", "entrepôt", "préparateur", "manutention", "magasinier",
                     "cariste", "stock", "quai", "expédition", "réception", "amazon"],
    "distribution": ["grande distribution", "caissier", "mise en rayon", "employé libre-service",
                     "hypermarché", "supermarché", "lidl", "aldi", "leclerc", "carrefour", "intermarché"],
    "animation":    ["animateur", "bafa", "centre de loisirs", "périscolaire", "jeunesse",
                     "enfants", "colonie", "accm", "alsh"],
    "informatique": ["développeur", "programmer", "software", "fullstack", "backend", "frontend",
                     "devops", "data", "machine learning", "ia", "python", "javascript"],
}


def extract_offer_metadata(offer: str) -> dict:
    """
    Extrait poste, entreprise, adresse et secteur depuis le texte d'une offre.

    Returns dict :
        poste      : str
        entreprise : str
        adresse    : str
        secteur    : str  ← NOUVEAU
    """
    result = _extract_regex(offer)

    if not result["poste"] or not result["entreprise"]:
        result = _extract_claude(offer)

    # Détection secteur — keywords d'abord, Claude en fallback si "autre"
    secteur = _detect_secteur(offer, result.get("poste", ""))
    if secteur == "autre":
        secteur = _detect_secteur_claude(offer, result.get("poste", ""))
    result["secteur"] = secteur

    return result


def _detect_secteur(offer: str, poste: str = "") -> str:
    """
    Détecte le secteur depuis le texte de l'offre et le poste.
    Utilise les mots-clés d'abord — rapide et sans API.
    Si aucun match → "autre".
    """
    texte = (offer + " " + poste).lower()

    scores = {secteur: 0 for secteur in SECTEURS_KEYWORDS}

    for secteur, keywords in SECTEURS_KEYWORDS.items():
        for kw in keywords:
            if kw in texte:
                scores[secteur] += 1

    meilleur = max(scores, key=scores.get)

    if scores[meilleur] == 0:
        return "autre"

    return meilleur


def _detect_secteur_claude(offer: str, poste: str = "") -> str:
    """
    Fallback Claude si aucun keyword ne matche.
    Retourne un secteur parmi SECTEURS, ou "autre".
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    secteurs_liste = ", ".join(s for s in SECTEURS if s != "autre")

    prompt = f"""Lis cette offre d'emploi et classe-la dans l'un de ces secteurs : {secteurs_liste}, autre.

Poste : {poste or "non précisé"}

Offre :
\"\"\"{offer[:1500]}\"\"\"

Réponds UNIQUEMENT avec le nom du secteur, en minuscules, sans ponctuation ni explication."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=20,
            messages=[{"role": "user", "content": prompt}],
        )
        secteur = response.content[0].text.strip().lower()
        return secteur if secteur in SECTEURS else "autre"
    except Exception:
        return "autre"


def _extract_regex(offer: str) -> dict:
    result = {"poste": "", "entreprise": "", "adresse": ""}

    lines = [l.strip() for l in offer.split('\n') if l.strip()]

    for line in lines[:5]:
        if re.search(r'^(poste|titre|intitulé)\s*:', line, re.I):
            result["poste"] = re.split(r':', line, 1)[1].strip()
            break

    for line in lines:
        m = re.match(r'^(entreprise|société|employeur)\s*[:\-]\s*(.+)', line, re.I)
        if m:
            result["entreprise"] = m.group(2).strip()
            break

    for line in offer.split('\n'):
        m = re.search(r'\d{1,4}\s+.+\d{5}\s+\w+', line)
        if m:
            result["adresse"] = m.group(0).strip()
            break

    return result


def _extract_claude(offer: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""Analyse ce texte d'offre d'emploi et extrais les informations demandées.

OFFRE :
\"\"\"
{offer[:3000]}
\"\"\"

Réponds UNIQUEMENT avec un JSON valide, sans backticks, sans texte avant ou après :

{{
  "poste": "intitulé exact du poste proposé",
  "entreprise": "nom exact de l'entreprise qui recrute",
  "adresse": "adresse complète de l'établissement (rue, code postal, ville)"
}}

Règles :
- Si une info est absente → mets une chaîne vide ""
- Poste : intitulé exact tel qu'écrit dans l'offre
- Entreprise : nom de la société, pas le groupe parent
- Adresse : format "X rue Y, XXXXX Ville" si disponible
- Réponds uniquement en JSON, rien d'autre"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        data = json.loads(raw)
        return {
            "poste":      data.get("poste", "").strip(),
            "entreprise": data.get("entreprise", "").strip(),
            "adresse":    data.get("adresse", "").strip(),
        }
    except json.JSONDecodeError:
        return {"poste": "", "entreprise": "", "adresse": ""}