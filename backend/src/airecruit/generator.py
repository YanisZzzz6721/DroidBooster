import os
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from docx import Document

load_dotenv()


def generate_letter(match_result: dict, offer: str) -> dict:
    """
    Génère le texte de la lettre via Claude puis l'injecte dans le template DOCX.
    Retourne les chemins des fichiers générés.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""Tu es un expert en rédaction de lettres de motivation optimisées ATS.

Rédige une lettre de motivation chirurgicale, dense et percutante.

=== RÈGLES ABSOLUES ===

LONGUEUR : 3 paragraphes stricts, 3 à 4 phrases maximum par paragraphe.
Chaque phrase doit porter une information utile — zéro phrase de remplissage.

FORMAT : Aucune liste, aucun tiret, aucun gras. Prose uniquement.

STYLE : Ton professionnel, direct, humain. Pas scolaire, pas robotique.
Chaque phrase commence différemment — pas de répétition de structure.

ATS — CONTRAINTE CRITIQUE :
Intègre naturellement un maximum de mots-clés de l'offre dans le texte.
Les mots-clés doivent apparaître dans leur forme exacte (pas de synonymes).
Priorité aux mots-clés les plus fréquents dans l'offre.

STRUCTURE :
§1 — Introduction : poste visé + accroche directe sur l'expérience la plus pertinente
§2 — Expériences : 2 expériences max, faits concrets, mots-clés ATS intégrés
§3 — Conclusion : valeur ajoutée + disponibilité + ouverture entretien (2 phrases max)

=== OFFRE D'EMPLOI ===
{offer}

=== CV SÉLECTIONNÉ : {match_result['cv_name']} ===
{match_result['cv_content']}

=== MOTS-CLÉS ATS À INTÉGRER EN PRIORITÉ ===
{', '.join(match_result['job_keywords'])}

=== POINTS FORTS DU CV ===
{', '.join(match_result['cv_keywords'])}

=== RAISON DU MATCH ===
{match_result['selection_reason']}

Réponds uniquement avec les 3 paragraphes — pas de formule d'appel, pas de signature, pas de titre."""

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    corps = response.content[0].text.strip()

    # Sauvegarde Markdown
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    nom_fichier = f"lettre_{match_result['cv_name']}"
    md_path = output_dir / f"{nom_fichier}.md"
    md_path.write_text(corps, encoding="utf-8")

    # Injection dans le template DOCX
    docx_path = _inject_docx(corps, match_result, output_dir, nom_fichier)

    return {
        "md_path": str(md_path),
        "docx_path": str(docx_path),
        "corps": corps
    }


def _inject_docx(corps: str, match_result: dict, output_dir: Path, nom_fichier: str) -> Path:
    """Injecte le contenu dans le template DOCX et sauvegarde."""

    template_path = Path("templates/lettre_template.docx")
    if not template_path.exists():
        raise FileNotFoundError("Template DOCX introuvable : templates/lettre_template.docx")

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
    date_fr = date_en

    placeholders = {
        "{{date}}": date_fr,
        "{{entreprise}}": match_result.get("entreprise", ""),
        "{{adresse_entreprise}}": match_result.get("adresse_entreprise", ""),
        "{{poste}}": match_result.get("poste", ""),
        "{{corps}}": corps,
    }

    for paragraph in doc.paragraphs:
        for placeholder, value in placeholders.items():
            if placeholder in paragraph.text:
                # Reconstruire le texte complet du paragraphe
                full_text = paragraph.text
                if placeholder in full_text:
                    # Vider tous les runs sauf le premier
                    for i, run in enumerate(paragraph.runs):
                        if i == 0:
                            run.text = full_text.replace(placeholder, value)
                        else:
                            run.text = ""

    docx_path = output_dir / f"{nom_fichier}.docx"
    doc.save(docx_path)

    return docx_path