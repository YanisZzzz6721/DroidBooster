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
    GET  /history
    GET  /history/{id}
    DELETE /history/{id}
"""

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from airecruit.parser import load_offer, load_cvs
from airecruit.matcher import match_cv
from airecruit.generator import generate_letter
from airecruit.ats_analyzer import analyze_ats, generate_optimized_cv
from database import init_db, save_candidature, get_history, get_candidature, delete_candidature

load_dotenv()

# ─── App ─────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AIRecruit API",
    description="API de génération de lettres de motivation et d'analyse ATS",
    version="1.0.0",
)

# ─── CORS ────────────────────────────────────────────────────────────────────────
# Autorise le frontend Next.js (local + Vercel)
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

# ─── Dossier CVs ─────────────────────────────────────────────────────────────────
CVS_DIR = Path(__file__).parent / "cvs"

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
    mode:        str = "full"   # "full" | "cv_only" | "letter_only"


# ─── Helpers ─────────────────────────────────────────────────────────────────────

def _load_offer_from_text(text: str) -> str:
    """Retourne le texte directement."""
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Texte de l'offre vide.")
    return text.strip()


async def _load_offer_from_file(file: UploadFile) -> str:
    """Sauvegarde le fichier uploadé temporairement et extrait le texte."""
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
    """Injecte les préférences utilisateur dans le match_result pour le générateur."""
    if preferences and preferences.strip():
        match_result = dict(match_result)
        match_result["preferences_utilisateur"] = preferences.strip()
    return match_result


# ─── Endpoints ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Vérifie que l'API est opérationnelle."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/cvs")
def list_cvs():
    """Retourne la liste des CVs disponibles."""
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
    """
    Sélectionne le meilleur CV pour une offre donnée.
    Accepte soit un texte (form field), soit un fichier PDF/TXT.
    """
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
    """
    Génère une lettre de motivation.
    Reçoit l'offre, le résultat du match et les préférences utilisateur.
    """
    match_result = _inject_preferences(body.match_result, body.preferences)

    try:
        result = generate_letter(match_result, body.offre_texte)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "lettre_md":   result["corps"],
        "md_path":     result["md_path"],
        "docx_path":   result["docx_path"],
    }


@app.post("/ats")
def ats(body: AtsRequest):
    """
    Lance l'analyse ATS et génère un CV optimisé.
    """
    try:
        analysis     = analyze_ats(body.offre_texte, body.match_result)
        cv_path, _   = generate_optimized_cv(
            body.offre_texte, body.match_result, analysis
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
    """
    Pipeline complet en un seul appel.
    mode = "full" | "cv_only" | "letter_only"
    """
    # 1. Chargement de l'offre
    if file and file.filename:
        offer_text = await _load_offer_from_file(file)
    elif offre_texte:
        offer_text = _load_offer_from_text(offre_texte)
    else:
        raise HTTPException(status_code=400, detail="Fournis un texte ou un fichier.")

    try:
        # 2. Matching
        cvs          = load_cvs(str(CVS_DIR))
        match_result = match_cv(offer_text, cvs)
        match_result = _inject_preferences(match_result, preferences)

        response = {"match": match_result}

        # 3. Lettre de motivation
        if mode in ("full", "letter_only"):
            letter = generate_letter(match_result, offer_text)
            response["lettre_md"] = letter["corps"]

        # 4. Analyse ATS + CV optimisé
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

        # 5. Sauvegarde historique
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


# ─── Historique ──────────────────────────────────────────────────────────────────

@app.get("/history")
def history(limit: int = 20):
    """Retourne les dernières candidatures."""
    return {"candidatures": get_history(limit)}


@app.get("/history/{candidature_id}")
def history_detail(candidature_id: int):
    """Retourne une candidature complète."""
    candidature = get_candidature(candidature_id)
    if not candidature:
        raise HTTPException(status_code=404, detail="Candidature introuvable.")
    return candidature


@app.delete("/history/{candidature_id}")
def history_delete(candidature_id: int):
    """Supprime une candidature."""
    delete_candidature(candidature_id)
    return {"deleted": True}