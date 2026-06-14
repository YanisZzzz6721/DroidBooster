import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from docx import Document

from airecruit.offer_parser import extract_offer_metadata

load_dotenv()

# Chemin absolu vers output/ — indépendant du répertoire courant d'uvicorn
OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"


def generate_letter(match_result: dict, offer: str) -> dict:
    """
    Génère le texte de la lettre via Claude puis l'injecte dans le template DOCX.
    """
    client   = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    metadata = extract_offer_metadata(offer)

    # Préférences utilisateur
    preferences   = match_result.get("preferences_utilisateur", "")
    prefs_section = f"\n=== PRÉFÉRENCES UTILISATEUR ===\n{preferences}\n" if preferences else ""

    prompt = f"""Tu es un expert en rédaction de lettres de motivation percutantes et optimisées ATS.

Rédige une lettre de motivation chirurgicale en 3 paragraphes stricts.

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
    }


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