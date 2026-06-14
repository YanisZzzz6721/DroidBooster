import os
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from docx import Document

from airecruit.offer_parser import extract_offer_metadata

load_dotenv()

# Chemin absolu vers output/ — indépendant du répertoire courant d'uvicorn
OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 1 — Analyse de l'offre (Claude Haiku)
# ══════════════════════════════════════════════════════════════════

def _analyse_offre(offer: str, client: anthropic.Anthropic) -> dict:
    """
    Agent Offer Analyst — Claude Haiku.
    Extrait le ton, la culture, le profil exact et les pièges à éviter
    pour personnaliser la lettre au maximum.
    Retourne un dict JSON structuré.
    """
    prompt = f"""Analyse cette offre d'emploi et retourne un JSON strict avec ces 5 champs :

{{
  "ton_entreprise": "description courte du ton/style de l'entreprise (ex: startup tech agile, cabinet institutionnel, PME familiale...)",
  "valeurs_cles": ["valeur1", "valeur2", "valeur3"],
  "profil_exact": "description précise du candidat idéal selon l'offre",
  "points_differenciants": "ce qui rendra cette lettre unique et pertinente pour CETTE entreprise spécifiquement",
  "mots_a_eviter": ["mot1", "mot2"]
}}

Règles :
- "ton_entreprise" : 1 phrase courte, concrète (pas "dynamique" seul)
- "valeurs_cles" : exactement 3 valeurs tirées du texte de l'offre
- "profil_exact" : 1-2 phrases sur le candidat recherché (expérience, qualités, contexte)
- "points_differenciants" : 1 phrase sur ce qui différencie cette entreprise des autres dans le même secteur
- "mots_a_eviter" : 2-4 mots génériques ou inadaptés au contexte de cette entreprise

Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.

=== OFFRE ===
{offer}"""

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback si Haiku renvoie du markdown ou du texte autour du JSON
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        # Fallback neutre
        return {
            "ton_entreprise":       "entreprise professionnelle",
            "valeurs_cles":         [],
            "profil_exact":         "",
            "points_differenciants": "",
            "mots_a_eviter":        [],
        }


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 2 — Génération de la lettre (Claude Sonnet)
# ══════════════════════════════════════════════════════════════════

def generate_letter(match_result: dict, offer: str) -> dict:
    """
    Pipeline en 2 étapes :
      1. Haiku analyse l'offre → ton, culture, profil, différenciants
      2. Sonnet génère la lettre enrichie de cette analyse
    """
    client   = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    metadata = extract_offer_metadata(offer)

    # ── Étape 1 : analyse Haiku
    analyse = _analyse_offre(offer, client)

    # ── Construction des blocs d'analyse pour le prompt
    valeurs_str      = ", ".join(analyse.get("valeurs_cles", [])) or "non détectées"
    eviter_str       = ", ".join(analyse.get("mots_a_eviter", [])) or "aucun"
    ton_str          = analyse.get("ton_entreprise", "")
    profil_str       = analyse.get("profil_exact", "")
    differenciants_str = analyse.get("points_differenciants", "")

    # Préférences utilisateur
    preferences   = match_result.get("preferences_utilisateur", "")
    prefs_section = f"\n=== PRÉFÉRENCES UTILISATEUR ===\n{preferences}\n" if preferences else ""

    prompt = f"""Tu es un expert en rédaction de lettres de motivation percutantes et optimisées ATS.

Rédige une lettre de motivation chirurgicale en 3 paragraphes stricts.

=== ANALYSE DE L'ENTREPRISE (fournie par notre agent d'analyse) ===
Ton / style de l'entreprise : {ton_str}
Valeurs clés détectées      : {valeurs_str}
Profil exact recherché      : {profil_str}
Ce qui différencie cette entreprise : {differenciants_str}
Mots à éviter absolument    : {eviter_str}

ADAPTE le registre, le vocabulaire et les exemples mis en avant en fonction de cette analyse.
Si l'entreprise est une startup → ton direct, concret, orienté impact.
Si c'est un cabinet institutionnel → ton posé, précis, orienté rigueur.
Intègre les valeurs détectées naturellement dans le texte, sans les citer explicitement.

=== RÈGLES ABSOLUES ===

OUVERTURE :
Ne jamais commencer par "Vous", "Je suis", "Suite à", "Actuellement", "Passionné".
Le §1 pose qui est le candidat, pourquoi ce poste maintenant, et ce qui l'attire dans CET établissement précisément.
Ton : celui d'une personne qui parle à une autre personne, pas d'un CV qui se présente.
2 à 3 phrases courtes valent mieux qu'une seule phrase surchargée.
Jamais de formule générique. Maximum un adjectif par phrase.

LONGUEUR : EXACTEMENT 3 paragraphes.
§1 : 2 à 3 phrases.
§2 : EXACTEMENT 4 phrases.
§3 : EXACTEMENT 4 phrases.
Zéro phrase creuse.

PERSONNE : Rédige exclusivement à la première personne du singulier (je, mon, mes).
Jamais de troisième personne. Jamais le prénom du candidat dans le corps du texte.

FORMAT :
Prose structurée, phrases courtes et autonomes, chacune terminée par un point.
Maximum deux propositions par phrase, séparées par une virgule ou un connecteur naturel.
Aucun élément de mise en forme visuelle : pas de liste, pas de gras, pas de titre.
Jamais de formule d'appel ni de signature.

STYLE :
Ton direct, humain et confiant. Une idée par phrase. Maximum un adjectif par phrase.
Chaque phrase apporte une information nouvelle par rapport à la précédente.
Les phrases s'enchaînent avec fluidité, comme une conversation écrite soignée.

STRUCTURE OBLIGATOIRE :
§1 : Qui est le candidat + pourquoi ce poste maintenant + ce qui l'attire dans CET établissement.
     Une seule idée par proposition. Nommer l'établissement naturellement.
§2 : Faits concrets issus du CV, mots-clés de l'offre intégrés naturellement dans leur forme exacte.
     ORDRE OBLIGATOIRE : expériences citées dans l'ordre chronologique inversé — la plus récente en premier.
     Ne jamais réorganiser selon la pertinence.
     Ne jamais inventer une compétence absente du CV (barista, latte art, etc. uniquement si dans le CV).
     Ne jamais exagérer une durée — s'appuyer uniquement sur les dates exactes du CV.
§3 : Valeur ajoutée spécifique à CET établissement + disponibilité + ouverture entretien.
     Affirmer, pas supposer. Nommer l'entreprise explicitement.

RÈGLES DE FOND :
- Nommer l'entreprise dans §1 ET dans §3
- Zéro formule générique : "profil", "valeurs", "standards", "engagement", "dynamique", "motivé", "polyvalent"
- Zéro adjectif générique de bilan : "solide", "complet", "fort", "efficace", "riche"
- Si l'offre est vague, compenser par des faits précis et chiffrés du CV
- Le §3 doit dire quelque chose de spécifique à l'entreprise, pas une conclusion générique
- §3 : conclure avec une ouverture directe et chaleureuse, jamais une formule administrative
- Ne jamais inventer ni exagérer la durée d'expérience — s'appuyer uniquement sur les dates exactes du CV
- Ne jamais écrire "depuis plusieurs années" ou toute durée non vérifiable depuis le CV
- Si tu mentionnes une durée, calcule-la depuis les dates du CV
- Ne jamais utiliser les mots listés dans "Mots à éviter"

ATS — CONTRAINTE CRITIQUE :
Intègre tous les mots-clés de l'offre dans leur forme exacte (pas de synonymes).
Priorité aux mots-clés les plus fréquents dans l'offre.

=== OFFRE D'EMPLOI ===
{offer}

=== MOTS-CLÉS ATS À INTÉGRER EN PRIORITÉ ===
{', '.join(match_result['job_keywords'])}

=== POINTS FORTS DU CV ===
{', '.join(match_result['cv_keywords'])}

=== RAISON DU MATCH ===
{match_result['selection_reason']}
{prefs_section}
Réponds uniquement avec les 3 paragraphes. Pas de formule d'appel, pas de signature, pas de titre."""

    user_content = [
        {
            "type": "text",
            "text": f"=== CV SÉLECTIONNÉ : {match_result['cv_name']} ===\n{match_result['cv_content']}",
            "cache_control": {"type": "ephemeral"},
        },
        {
            "type": "text",
            "text": prompt,
        },
    ]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": user_content}],
    )

    corps = response.content[0].text.strip()

    # Nettoyage du cv_name — supprime les slashes si c'est un CV généré
    cv_name_safe = match_result['cv_name'].split("/")[-1].split("\\")[-1]
    nom_fichier  = f"lettre_{cv_name_safe}"

    # Sauvegarde Markdown
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = OUTPUT_DIR / f"{nom_fichier}.md"
    md_path.write_text(corps, encoding="utf-8")

    # Injection dans le template DOCX
    docx_path = _inject_docx(corps, metadata, nom_fichier)

    return {
        "md_path":   str(md_path),
        "docx_path": str(docx_path),
        "corps":     corps,
        "metadata":  metadata,
        "analyse_offre": analyse,   # exposé pour debug / frontend
    }


# ══════════════════════════════════════════════════════════════════
# INJECTION DOCX
# ══════════════════════════════════════════════════════════════════

def _inject_docx(corps: str, metadata: dict, nom_fichier: str) -> Path:
    template_path = Path(__file__).parent.parent.parent / "templates" / "lettre_template.docx"
    if not template_path.exists():
        raise FileNotFoundError(f"Template DOCX introuvable : {template_path}")

    doc = Document(template_path)

    mois_fr = {
        "January": "janvier", "February": "février", "March": "mars",
        "April": "avril", "May": "mai", "June": "juin",
        "July": "juillet", "August": "août", "September": "septembre",
        "October": "octobre", "November": "novembre", "December": "décembre"
    }
    date_en = datetime.now().strftime("%d %B %Y")
    for en, fr in mois_fr.items():
        date_en = date_en.replace(en, fr)

    placeholders = {
        "{{date}}":               date_en,
        "{{entreprise}}":         metadata.get("entreprise", ""),
        "{{adresse_entreprise}}": metadata.get("adresse", ""),
        "{{poste}}":              metadata.get("poste", ""),
        "{{corps}}":              corps,
    }

    for paragraph in doc.paragraphs:
        full_text = "".join(run.text for run in paragraph.runs)
        for placeholder, value in placeholders.items():
            if placeholder in full_text:
                full_text = full_text.replace(placeholder, value)
        if paragraph.runs:
            paragraph.runs[0].text = full_text
            for run in paragraph.runs[1:]:
                run.text = ""

    docx_path = OUTPUT_DIR / f"{nom_fichier}.docx"
    doc.save(docx_path)
    return docx_path
