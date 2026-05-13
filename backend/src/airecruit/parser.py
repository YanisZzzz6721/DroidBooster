from pathlib import Path
import pdfplumber


def load_offer(path: str) -> str:
    """
    Lit une offre d'emploi depuis un fichier PDF ou TXT.
    Retourne le texte brut extrait.
    """
    file = Path(path)

    if not file.exists():
        raise FileNotFoundError(f"Fichier introuvable : {path}")

    if file.suffix.lower() == ".pdf":
        return _read_pdf(file)
    elif file.suffix.lower() in [".txt", ".md"]:
        return _read_text(file)
    else:
        raise ValueError(f"Format non supporté : {file.suffix}. Utilise un PDF ou TXT.")


def load_cvs(cvs_dir: str = "cvs") -> list[dict]:
    """
    Charge tous les CVs Markdown depuis le dossier cvs/.
    Retourne une liste de dicts : [{"name": "cv_dev", "content": "..."}]
    """
    folder = Path(cvs_dir)

    if not folder.exists():
        raise FileNotFoundError(f"Dossier CVs introuvable : {cvs_dir}")

    cvs = []
    for md_file in sorted(folder.glob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        if content:
            cvs.append({
                "name": md_file.stem,
                "content": content
            })

    if not cvs:
        raise ValueError(f"Aucun CV trouvé dans {cvs_dir}/. Ajoute des fichiers .md.")

    return cvs


def _read_pdf(file: Path) -> str:
    """Extrait le texte d'un PDF page par page."""
    text = []
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)

    if not text:
        raise ValueError(f"Impossible d'extraire du texte depuis : {file.name}. Le PDF est peut-être scanné.")

    return "\n\n".join(text)


def _read_text(file: Path) -> str:
    """Lit un fichier texte ou Markdown."""
    return file.read_text(encoding="utf-8").strip()