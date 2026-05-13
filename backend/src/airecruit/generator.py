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

    prompt = f"""Rédige une lettre de motivation à partir des informations fournies.

Style attendu : Écriture fluide, naturelle et humaine. Ton sérieux, motivé et professionnel, sans être scolaire ni rigide. Le texte doit être propre, maîtrisé, et aller droit au but.

Contraintes :
- Pas de listes
- Pas de tirets
- Pas de mots en gras
- Pas de répétitions inutiles
- Pas de phrases vides ou génériques
- Chaque phrase doit être utile, précise et concrète

Structure :
- Introduction claire avec le poste et l'entreprise
- Un développement centré sur les expériences les plus pertinentes
- Un second développement sur les qualités personnelles en lien avec le poste
- Une conclusion simple avec disponibilité et ouverture à un entretien

Style rédactionnel :
- Phrases fluides, bien construites, vocabulaire professionnel mais naturel
- Éviter les tournures trop classiques ou robotiques
- Garder un ton crédible et humain

=== OFFRE D'EMPLOI ===
{offer}

=== CV SÉLECTIONNÉ : {match_result['cv_name']} ===
{match_result['cv_content']}

=== MOTS CLÉS DE L'OFFRE ===
{', '.join(match_result['job_keywords'])}

=== POINTS FORTS DU CV ===
{', '.join(match_result['cv_keywords'])}

=== RAISON DU MATCH ===
{match_result['selection_reason']}

Rédige uniquement le corps de la lettre — pas de formule d'appel, pas de signature, pas de mise en forme. Juste les paragraphes."""

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