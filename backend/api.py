"""
api.py — Backend FastAPI pour DroidBooster.
"""

from importlib.metadata import metadata
import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from airecruit.parser import load_offer, load_cvs
from airecruit.matcher import match_cv
from airecruit.generator import generate_letter
from airecruit.ats_analyzer import analyze_ats, generate_optimized_cv
from airecruit.offer_parser import extract_offer_metadata
from database import (
    init_db,
    save_candidature, get_history, get_candidature, delete_candidature,
    save_export, get_export_history, get_export, delete_export,
)
from parser import parse_cv
from builder import build_docx
from airecruit.scraper import search_jobs


load_dotenv()

app = FastAPI(title="DroidBooster API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

CVS_DIR        = Path(__file__).parent / "cvs"
EXPORT_OUT_DIR = Path("/Users/zouggagh/Desktop/cv_yanis")
UPLOAD_TMP_DIR = Path(__file__).parent / "uploads_tmp"

for d in [EXPORT_OUT_DIR, UPLOAD_TMP_DIR]:
    d.mkdir(exist_ok=True)


# ─── Schémas ──────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    offre_texte:  str
    match_result: dict
    preferences:  str = ""

class AtsRequest(BaseModel):
    offre_texte:  str
    match_result: dict


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _load_offer_from_text(text: str) -> str:
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Texte de l'offre vide.")
    return text.strip()

async def _load_offer_from_file(file: UploadFile) -> str:
    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".pdf", ".txt", ".md"):
        raise HTTPException(status_code=400, detail=f"Format non supporté : {suffix}")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        text = load_offer(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    return text

def _inject_preferences(match_result: dict, preferences: str) -> dict:
    if preferences and preferences.strip():
        match_result = dict(match_result)
        match_result["preferences_utilisateur"] = preferences.strip()
    return match_result


# ─── Endpoints de base ────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/cvs")
def list_cvs():
    try:
        cvs = load_cvs(str(CVS_DIR))
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"count": len(cvs), "cvs": [{"name": cv["name"], "preview": cv["content"][:200]} for cv in cvs]}

@app.post("/match")
async def match(
    offre_texte: str        = Form(default=None),
    file:        UploadFile = File(default=None),
):
    if file and file.filename:
        offer_text = await _load_offer_from_file(file)
    elif offre_texte:
        offer_text = _load_offer_from_text(offre_texte)
    else:
        raise HTTPException(status_code=400, detail="Fournis un texte ou un fichier.")
    try:
        cvs    = load_cvs(str(CVS_DIR))
        result = match_cv(offer_text, cvs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result

@app.post("/generate")
def generate(body: GenerateRequest):
    match_result = _inject_preferences(body.match_result, body.preferences)
    try:
        result = generate_letter(match_result, body.offre_texte)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"lettre_md": result["corps"], "md_path": result["md_path"], "docx_path": result["docx_path"]}

@app.post("/ats")
def ats(body: AtsRequest):
    try:
        analysis    = analyze_ats(body.offre_texte, body.match_result)
        metadata   = extract_offer_metadata(body.offre_texte)
        cv_path, _ = generate_optimized_cv(
                offer_text, match_result, analysis,
                entreprise=metadata.get("entreprise", ""),
                secteur=metadata.get("secteur", ""),
            )
        cv_optimise = cv_path.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "score":            analysis["score"],
        "keywords_found":   analysis["keywords_found"],
        "keywords_missing": analysis["keywords_missing"],
        "suggestions":      analysis["suggestions"],
        "summary":          analysis["summary"],
        "cv_optimise_md":   cv_optimise,
    }

@app.post("/run")
async def run(
    offre_texte: str        = Form(default=None),
    preferences: str        = Form(default=""),
    mode:        str        = Form(default="full"),
    file:        UploadFile = File(default=None),
):
    if file and file.filename:
        offer_text = await _load_offer_from_file(file)
    elif offre_texte:
        offer_text = _load_offer_from_text(offre_texte)
    else:
        raise HTTPException(status_code=400, detail="Fournis un texte ou un fichier.")

    try:
        # Extraction métadonnées offre
        metadata = extract_offer_metadata(offer_text)

        cvs          = load_cvs(str(CVS_DIR))
        match_result = match_cv(offer_text, cvs, secteur=metadata.get("secteur", ""))
        match_result = _inject_preferences(match_result, preferences)

        response = {"match": match_result, "metadata": metadata}

        lettre_docx_path = None

        if mode in ("full", "letter_only"):
            letter           = generate_letter(match_result, offer_text)
            lettre_docx_path = letter["docx_path"]
            response["lettre_md"]   = letter["corps"]
            response["docx_path"]   = letter["docx_path"]

        if mode in ("full", "cv_only"):
            analysis       = analyze_ats(offer_text, match_result)
            cv_path, _ = generate_optimized_cv(
                    offer_text, match_result, analysis,
                    entreprise=metadata.get("entreprise", ""),
                    secteur=metadata.get("secteur", ""),
                )
            cv_optimise_md = cv_path.read_text(encoding="utf-8")
            response["ats"] = {
                "score":            analysis["score"],
                "keywords_found":   analysis["keywords_found"],
                "keywords_missing": analysis["keywords_missing"],
                "suggestions":      analysis["suggestions"],
                "summary":          analysis["summary"],
            }
            response["cv_optimise_md"] = cv_optimise_md

        # Sauvegarde historique enrichi
        save_candidature(
            offre_texte    = offer_text[:2000],
            cv_nom         = match_result["cv_name"],
            poste          = metadata.get("poste", ""),
            entreprise     = metadata.get("entreprise", ""),
            adresse        = metadata.get("adresse", ""),
            match_score    = match_result.get("match_score"),
            ats_score      = response.get("ats", {}).get("score"),
            lettre_md      = response.get("lettre_md"),
            lettre_docx    = lettre_docx_path,
            cv_optimise_md = response.get("cv_optimise_md"),
            preferences    = preferences,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return response


@app.post("/ats-custom")
async def ats_custom(
    offre_texte: str = Form(...),
    cv_content:  str = Form(...),
    preferences: str = Form(default=""),
):
    if not offre_texte.strip():
        raise HTTPException(status_code=400, detail="Le texte de l'offre est vide.")
    if not cv_content.strip():
        raise HTTPException(status_code=400, detail="Le contenu du CV est vide.")
    try:
        metadata = extract_offer_metadata(offre_texte)
        match_result = {
            "cv_name":          "cv_custom",
            "cv_content":       cv_content,
            "match_score":      None,
            "job_keywords":     [],
            "cv_keywords":      [],
            "selection_reason": "CV fourni manuellement",
        }
        if preferences.strip():
            match_result["preferences_utilisateur"] = preferences.strip()

        analysis       = analyze_ats(offre_texte, match_result)
        cv_path, _ = generate_optimized_cv(
                offer_text, match_result, analysis,
                entreprise=metadata.get("entreprise", ""),
                secteur=metadata.get("secteur", ""),
            )
        cv_optimise_md = cv_path.read_text(encoding="utf-8")

        save_candidature(
            offre_texte    = offre_texte[:2000],
            cv_nom         = "cv_custom",
            poste          = metadata.get("poste", ""),
            entreprise     = metadata.get("entreprise", ""),
            adresse        = metadata.get("adresse", ""),
            ats_score      = analysis["score"],
            cv_optimise_md = cv_optimise_md,
            preferences    = preferences,
        )

        return {
            "score":            analysis["score"],
            "keywords_found":   analysis["keywords_found"],
            "keywords_missing": analysis["keywords_missing"],
            "suggestions":      analysis["suggestions"],
            "summary":          analysis["summary"],
            "cv_optimise_md":   cv_optimise_md,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Lettre DOCX ──────────────────────────────────────────────────────────────

@app.get("/download-lettre/{filename}")
def download_lettre(filename: str):
    path = Path(__file__).parent / "output" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    return FileResponse(
        path=str(path),
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


# ─── Historique candidatures ──────────────────────────────────────────────────

@app.get("/history")
def history(limit: int = 20):
    return {"candidatures": get_history(limit)}

@app.get("/history/{candidature_id}")
def history_detail(candidature_id: int):
    candidature = get_candidature(candidature_id)
    if not candidature:
        raise HTTPException(status_code=404, detail="Candidature introuvable.")
    return candidature

@app.delete("/history/{candidature_id}")
def history_delete(candidature_id: int):
    delete_candidature(candidature_id)
    return {"deleted": True}


# ─── Export CV → DOCX ─────────────────────────────────────────────────────────

@app.post("/export-docx")
async def export_docx(
    cv_markdown: str        = Form(...),
    template:    UploadFile = File(...),
    lieu:        str        = Form(default=""),
):
    if not cv_markdown.strip():
        raise HTTPException(status_code=400, detail="Le CV Markdown est vide.")

    tmp_template = UPLOAD_TMP_DIR / f"tpl_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.docx"
    with open(tmp_template, "wb") as f:
        shutil.copyfileobj(template.file, f)

    try:
        cv_dict = parse_cv(cv_markdown)
        if not cv_dict.get("nom"):
            raise HTTPException(status_code=400, detail="Nom introuvable. Vérifie le format : # Prénom NOM")

        titre_safe = cv_dict.get("titre", "cv")
        titre_safe = titre_safe.replace(" ", "_").replace("—", "").replace("–", "").lower()
        titre_safe = re.sub(r"[^a-z0-9_]", "", titre_safe).strip("_")

        lieu_safe = lieu.strip().replace(" ", "_").lower()
        lieu_safe = re.sub(r"[^a-z0-9_]", "", lieu_safe).strip("_")

        docx_name = f"cv_{titre_safe}_{lieu_safe}.docx" if lieu_safe else f"cv_{titre_safe}.docx"
        docx_path = EXPORT_OUT_DIR / docx_name

        build_docx(cv_dict, str(tmp_template), str(docx_path))

        save_export(
            cv_nom    = cv_dict.get("nom", "Inconnu"),
            cv_titre  = cv_dict.get("titre", ""),
            template  = template.filename or "template.docx",
            docx_path = str(docx_path),
        )

        return FileResponse(
            path       = str(docx_path),
            filename   = docx_name,
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    finally:
        if tmp_template.exists():
            tmp_template.unlink()


# ─── Historique exports ───────────────────────────────────────────────────────

@app.get("/export-history")
def export_history(limit: int = 20):
    return get_export_history(limit)

@app.get("/export-history/{export_id}/download")
def export_download(export_id: int):
    entry = get_export(export_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Export introuvable.")
    if not Path(entry["docx_path"]).exists():
        raise HTTPException(status_code=404, detail="Fichier DOCX supprimé du disque.")
    return FileResponse(
        path       = entry["docx_path"],
        filename   = Path(entry["docx_path"]).name,
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

@app.delete("/export-history/{export_id}")
def export_delete(export_id: int):
    ok = delete_export(export_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Export introuvable.")
    return {"deleted": export_id}

@app.get("/search-jobs")
def search_jobs_endpoint(
    poste: str = "",
    ville: str = "Strasbourg",
    limit: int = 20,
):
    """Recherche d'offres depuis France Travail + Indeed."""
    if not poste.strip():
        raise HTTPException(status_code=400, detail="Le champ poste est vide.")
    try:
        jobs = search_jobs(poste, ville, limit)
        return {"jobs": jobs, "count": len(jobs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 