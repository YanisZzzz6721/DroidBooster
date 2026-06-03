"""
api.py — Backend FastAPI pour AIRecruit.
 
Lance avec :
    uvicorn api:app --reload --port 8000
 
Endpoints :
    GET  /health
    GET  /cvs
    POST /match
    POST /generate
    POST /ats
    POST /run
    POST /ats-custom
    POST /export-docx         ← NOUVEAU
    GET  /history
    GET  /history/{id}
    DELETE /history/{id}
    GET  /export-history             ← NOUVEAU
    GET  /export-history/{id}/download  ← NOUVEAU
    DELETE /export-history/{id}     ← NOUVEAU
"""


 
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
from database import (
    init_db,
    save_candidature, get_history, get_candidature, delete_candidature,
    save_export, get_export_history, get_export, delete_export,
)
from parser import parse_cv
from builder import build_docx
 
load_dotenv()
 
# ─── App ─────────────────────────────────────────────────────────────────────────
 
app = FastAPI(
    title="AIRecruit API",
    description="API de génération de lettres de motivation et d'analyse ATS",
    version="1.0.0",
)
 
# ─── CORS ────────────────────────────────────────────────────────────────────────
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
 
# ─── Init DB au démarrage ────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
 
# ─── Dossiers ────────────────────────────────────────────────────────────────────
CVS_DIR         = Path(__file__).parent / "cvs"
EXPORT_OUT_DIR  = Path(__file__).parent / "output"
UPLOAD_TMP_DIR  = Path(__file__).parent / "uploads_tmp"
 
for d in [EXPORT_OUT_DIR, UPLOAD_TMP_DIR]:
    d.mkdir(exist_ok=True)
 
# ─── Schémas Pydantic ────────────────────────────────────────────────────────────
 
class MatchResponse(BaseModel):
    cv_name:          str
    cv_content:       str
    match_score:      int
    job_keywords:     list[str]
    cv_keywords:      list[str]
    selection_reason: str
 
class GenerateRequest(BaseModel):
    offre_texte:  str
    match_result: dict
    preferences:  str = ""
 
class AtsRequest(BaseModel):
    offre_texte:  str
    match_result: dict
 
class RunRequest(BaseModel):
    offre_texte: str
    preferences: str = ""
    mode:        str = "full"
 
 
# ─── Helpers ─────────────────────────────────────────────────────────────────────
 
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
 
 
# ─── Endpoints existants ─────────────────────────────────────────────────────────
 
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
 
 
@app.get("/cvs")
def list_cvs():
    try:
        cvs = load_cvs(str(CVS_DIR))
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "count": len(cvs),
        "cvs": [{"name": cv["name"], "preview": cv["content"][:200]} for cv in cvs],
    }
 
 
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
    return {
        "lettre_md": result["corps"],
        "md_path":   result["md_path"],
        "docx_path": result["docx_path"],
        
    }
 
 
@app.post("/ats")
def ats(body: AtsRequest):
    try:
        analysis   = analyze_ats(body.offre_texte, body.match_result)
        cv_path, _ = generate_optimized_cv(body.offre_texte, body.match_result, analysis)
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
        cvs          = load_cvs(str(CVS_DIR))
        match_result = match_cv(offer_text, cvs)
        match_result = _inject_preferences(match_result, preferences)
        response     = {"match": match_result}
 
        if mode in ("full", "letter_only"):
            letter = generate_letter(match_result, offer_text)
            response["lettre_md"] = letter["corps"]
            response["docx_path"]   = letter["docx_path"]
 
        if mode in ("full", "cv_only"):
            analysis       = analyze_ats(offer_text, match_result)
            cv_path, _     = generate_optimized_cv(offer_text, match_result, analysis)
            cv_optimise_md = cv_path.read_text(encoding="utf-8")
            response["ats"] = {
                "score":            analysis["score"],
                "keywords_found":   analysis["keywords_found"],
                "keywords_missing": analysis["keywords_missing"],
                "suggestions":      analysis["suggestions"],
                "summary":          analysis["summary"],
            }
            response["cv_optimise_md"] = cv_optimise_md
 
        save_candidature(
            offre_texte    = offer_text[:2000],
            cv_nom         = match_result["cv_name"],
            match_score    = match_result.get("match_score"),
            ats_score      = response.get("ats", {}).get("score"),
            lettre_md      = response.get("lettre_md"),
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
        cv_path, _     = generate_optimized_cv(offre_texte, match_result, analysis)
        cv_optimise_md = cv_path.read_text(encoding="utf-8")
 
        save_candidature(
            offre_texte    = offre_texte[:2000],
            cv_nom         = "cv_custom",
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
 
 
# ─── Historique candidatures ─────────────────────────────────────────────────────
 
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
 
 
# ─── Export CV → DOCX ────────────────────────────────────────────────────────────
 
@app.post("/export-docx")
async def export_docx(
    cv_markdown:  str        = Form(..., description="CV en Markdown"),
    template:     UploadFile = File(...,  description="Template .docx personnel"),
    lieu:         str        = Form(default="", description="Nom du lieu / entreprise"),
):
    """
    Reçoit un CV en Markdown + un template .docx.
    Parse le Markdown, génère le DOCX via builder.py, retourne le fichier.
    """
    if not cv_markdown.strip():
        raise HTTPException(status_code=400, detail="Le CV Markdown est vide.")
 
    # Sauvegarde temporaire du template uploadé
    tmp_template = UPLOAD_TMP_DIR / f"tpl_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.docx"
    with open(tmp_template, "wb") as f:
        shutil.copyfileobj(template.file, f)
 
    try:
        # Parse du Markdown
        cv_dict = parse_cv(cv_markdown)
        if not cv_dict.get("nom"):
            raise HTTPException(
                status_code=400,
                detail="Nom introuvable. Vérifie le format : # Prénom NOM"
            )
 
        # Nom du fichier de sortie
        titre_safe = cv_dict.get("titre", "cv")
        titre_safe = titre_safe.replace(" ", "_").replace("—", "").replace("–", "").lower()
        titre_safe = re.sub(r"[^a-z0-9_]", "", titre_safe).strip("_")
        lieu_safe = lieu.strip().replace(" ", "_").lower()
        lieu_safe = re.sub(r"[^a-z0-9_]", "", lieu_safe).strip("_")
        docx_name = f"cv_{titre_safe}_{lieu_safe}.docx" if lieu_safe else f"cv_{titre_safe}.docx"
        docx_path  = EXPORT_OUT_DIR / docx_name
 
        # Génération du DOCX
        build_docx(cv_dict, str(tmp_template), str(docx_path))
 
        # Sauvegarde dans l'historique export
        save_export(
            cv_nom    = cv_dict.get("nom", "Inconnu"),
            cv_titre  = cv_dict.get("titre", ""),
            template  = template.filename or "template.docx",
            docx_path = str(docx_path),
        )
 
        # Retourne le fichier en téléchargement direct
        return FileResponse(
            path      = str(docx_path),
            filename  = docx_name,
            media_type= "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
 
    finally:
        if tmp_template.exists():
            tmp_template.unlink()
 
 
# ─── Historique exports ───────────────────────────────────────────────────────────
 
@app.get("/export-history")
def export_history(limit: int = 20):
    """Liste des derniers exports DOCX."""
    return get_export_history(limit)
 
 
@app.get("/export-history/{export_id}/download")
def export_download(export_id: int):
    """Retélécharger un DOCX depuis l'historique."""
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

@app.get("/download-lettre/{filename}")
def download_lettre(filename: str):
    """Télécharge une lettre générée en DOCX."""
    path = Path(__file__).parent / "output" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    return FileResponse(
        path=str(path),
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
 
 
@app.delete("/export-history/{export_id}")
def export_delete(export_id: int):
    """Supprime un export + le fichier DOCX associé."""
    ok = delete_export(export_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Export introuvable.")
    return {"deleted": export_id}