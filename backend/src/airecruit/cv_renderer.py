"""
Module de rendu graphique de CV.

Parse le CV optimisé en Markdown et génère un PDF professionnel,
minimaliste et ATS-friendly via fpdf2 (pur Python, aucune dépendance système).

Dépendance :
    pip install fpdf2
"""

import re
from datetime import datetime
from pathlib import Path

from fpdf import FPDF, XPos, YPos

# ─── Palette design ─────────────────────────────────────────────────────────────

# Header sombre
H_R, H_G, H_B       = 15, 23, 42       # #0F172A — bleu nuit

# Accent (titres de sections, puces)
A_R, A_G, A_B       = 37, 99, 235      # #2563EB — bleu électrique

# Texte principal
T_R, T_G, T_B       = 30, 41, 59       # #1E293B

# Texte secondaire (tagline)
S_R, S_G, S_B       = 148, 163, 184    # #94A3B8

# Fond body
W_R, W_G, W_B       = 255, 255, 255    # blanc

# Séparateur léger
L_R, L_G, L_B       = 226, 232, 240    # #E2E8F0

MOIS_FR = {
    1: "janvier", 2: "février", 3: "mars", 4: "avril",
    5: "mai", 6: "juin", 7: "juillet", 8: "août",
    9: "septembre", 10: "octobre", 11: "novembre", 12: "décembre",
}


# ─── Classe PDF ─────────────────────────────────────────────────────────────────

class CVPDF(FPDF):
    def header(self):
        pass  # Header géré manuellement

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(180, 180, 180)
        today = datetime.now()
        date_fr = f"{today.day} {MOIS_FR[today.month]} {today.year}"
        self.cell(0, 5, f"CV généré par AIRecruit · {date_fr}", align="C")


# ─── Fonctions publiques ─────────────────────────────────────────────────────────

def render_cv_pdf(cv_md_path: str, output_dir: str = "output") -> Path:
    """
    Génère un PDF graphique à partir d'un fichier CV Markdown optimisé.

    Args:
        cv_md_path : Chemin vers le fichier .md du CV optimisé.
        output_dir : Dossier de sortie pour le PDF.

    Returns:
        Path du PDF généré.
    """
    md_path = Path(cv_md_path)
    if not md_path.exists():
        raise FileNotFoundError(f"CV Markdown introuvable : {cv_md_path}")

    content = md_path.read_text(encoding="utf-8")
    # Supprime les commentaires HTML ajoutés par ats_analyzer
    content = re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL).strip()

    sections = _parse_markdown(content)
    pdf      = _build_pdf(sections)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    stem     = md_path.stem  # ex: cv_optimise_cv_restauration
    pdf_name = stem.replace("cv_optimise_", "cv_graphique_") + ".pdf"
    pdf_path = output_path / pdf_name

    pdf.output(str(pdf_path))
    return pdf_path


# ─── Parsing Markdown ────────────────────────────────────────────────────────────

def _parse_markdown(content: str) -> dict:
    """Parse le CV Markdown en structure de données."""
    lines  = content.splitlines()
    result = {"name": "", "sections": []}
    current = None

    for line in lines:
        line = line.rstrip()

        if line.startswith("# "):
            if not result["name"]:
                result["name"] = line[2:].strip()
            continue

        if line.startswith("## "):
            if current:
                result["sections"].append(current)
            current = {"title": line[3:].strip(), "items": [], "paragraphs": []}
            continue

        if line.startswith("### ") and current:
            text = _clean_md(line[4:].strip())
            current["paragraphs"].append(("h3", text))
            continue

        if re.match(r"^[-*•]\s+", line) and current:
            text = _clean_md(re.sub(r"^[-*•]\s+", "", line).strip())
            current["items"].append(text)
            continue

        if re.match(r"^\d+\.\s+", line) and current:
            text = _clean_md(re.sub(r"^\d+\.\s+", "", line).strip())
            current["items"].append(text)
            continue

        if line and current:
            current["paragraphs"].append(("p", _clean_md(line)))

    if current:
        result["sections"].append(current)

    return result


def _clean_md(text: str) -> str:
    """Supprime la syntaxe Markdown résiduelle."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"`(.*?)`", r"\1", text)
    return text.strip()


# ─── Construction PDF ────────────────────────────────────────────────────────────

def _build_pdf(sections: dict) -> CVPDF:
    """Construit l'objet PDF complet."""
    pdf = CVPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(0, 0, 0)

    name = sections.get("name", "CV")

    # Sépare l'objectif du reste
    objectif_text = ""
    body_sections = []

    for sec in sections.get("sections", []):
        title_low = sec["title"].lower()
        if any(k in title_low for k in ("objectif", "profil", "à propos", "resume", "résumé")):
            # Prend le premier paragraphe ou premier item
            for kind, text in sec.get("paragraphs", []):
                if kind == "p" and text:
                    objectif_text = text
                    break
            if not objectif_text and sec.get("items"):
                objectif_text = sec["items"][0]
        else:
            body_sections.append(sec)

    # ── Header ──────────────────────────────────────────────────────────────────
    _draw_header(pdf, name, objectif_text)

    # ── Corps ───────────────────────────────────────────────────────────────────
    pdf.set_left_margin(18)
    pdf.set_right_margin(18)

    for sec in body_sections:
        _draw_section(pdf, sec)

    return pdf


def _draw_header(pdf: CVPDF, name: str, tagline: str):
    """Dessine le header sombre avec nom et tagline."""
    page_w = pdf.w

    # Rectangle header
    header_h = 42 if tagline else 32
    pdf.set_fill_color(H_R, H_G, H_B)
    pdf.rect(0, 0, page_w, header_h, "F")

    # Ligne d'accent en bas du header
    pdf.set_fill_color(A_R, A_G, A_B)
    pdf.rect(0, header_h - 1.5, page_w, 1.5, "F")

    # Nom
    pdf.set_xy(18, 10)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(page_w - 36, 10, _safe_text(name), new_x=XPos.LEFT, new_y=YPos.NEXT)

    # Tagline
    if tagline:
        pdf.set_x(18)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(S_R, S_G, S_B)
        pdf.multi_cell(page_w - 36, 5, _safe_text(tagline))

    # Repositionne après le header
    pdf.set_xy(18, header_h + 8)
    pdf.set_text_color(T_R, T_G, T_B)


def _draw_section(pdf: CVPDF, sec: dict):
    """Dessine une section complète (titre + contenu)."""
    page_w  = pdf.w
    margin  = 18
    content_w = page_w - margin * 2

    # ── Titre de section ────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(A_R, A_G, A_B)
    pdf.set_x(margin)
    pdf.cell(content_w, 5, _safe_text(sec["title"].upper()), new_x=XPos.LEFT, new_y=YPos.NEXT)

    # Ligne séparatrice bleue
    y = pdf.get_y()
    pdf.set_draw_color(A_R, A_G, A_B)
    pdf.set_line_width(0.4)
    pdf.line(margin, y, page_w - margin, y)
    pdf.ln(4)

    # ── Paragraphes ─────────────────────────────────────────────────────────────
    for kind, text in sec.get("paragraphs", []):
        pdf.set_x(margin)
        if kind == "h3":
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(H_R, H_G, H_B)
            pdf.multi_cell(content_w, 5, _safe_text(text))
            pdf.ln(1)
        else:
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(T_R, T_G, T_B)
            pdf.multi_cell(content_w, 5.5, _safe_text(text))
            pdf.ln(1)

    # ── Bullet points ────────────────────────────────────────────────────────────
    for item in sec.get("items", []):
        pdf.set_text_color(A_R, A_G, A_B)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_x(margin)
        pdf.cell(5, 5.5, "-")

        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(T_R, T_G, T_B)
        pdf.multi_cell(content_w - 5, 5.5, _safe_text(item))

    pdf.ln(5)

    # Séparateur léger entre sections
    y = pdf.get_y() - 3
    pdf.set_draw_color(L_R, L_G, L_B)
    pdf.set_line_width(0.2)
    pdf.line(margin, y, page_w - margin, y)
    pdf.ln(2)


def _safe_text(text: str) -> str:
    """Convertit tout le texte en latin-1 safe pour fpdf2."""
    # Remplacement des caractères Unicode courants
    replacements = {
        "\u2019": "'",  "\u2018": "'",  "\u2032": "'",
        "\u201c": '"',  "\u201d": '"',
        "\u2013": "-",  "\u2014": "-",  "\u2012": "-",
        "\u2026": "...",
        "\u00b7": ".",  "\u2022": "-",  "\u25b8": "-",
        "\u203a": ">",  "\u2039": "<",
        "\u25cf": "-",  "\u2605": "*",
        "▸": "-", "›": ">", "•": "-", "·": ".",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Encodage latin-1 — remplace tout ce qui reste par "?"
    return text.encode("latin-1", errors="replace").decode("latin-1")