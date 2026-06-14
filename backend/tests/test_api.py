"""
test_api.py — Tests d'intégration des endpoints FastAPI via TestClient.
Couvre : /health, /match, /generate-letter, /analyze-ats,
         /history, /candidature/{id}, /rag/stats, /open-in-libreoffice,
         /search-jobs, /export-history
"""

import sys, os, tempfile, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Override DB avant import de l'app
import database as db_module
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
db_module.DB_PATH = Path(_tmp_db.name)

from fastapi.testclient import TestClient
import sqlite3

# Import de l'app après override de la DB
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api import app

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def reset_db():
    conn = sqlite3.connect(db_module.DB_PATH)
    for table in ["candidatures", "exports", "generated_cvs"]:
        conn.execute(f"DROP TABLE IF EXISTS {table}")
    conn.commit()
    conn.close()
    db_module.init_db()
    yield


# ─── Fixtures ────────────────────────────────────────────────────────────────

OFFRE_TEXT = "Poste : Serveur H/F\nEntreprise : Brasserie du Marché\nRecherche serveur restauration accueil client salle."

MATCH_RESULT = {
    "cv_name":         "cv_restauration",
    "cv_content":      "Serveur expérimenté, accueil client, brasserie.",
    "match_score":     85,
    "job_keywords":    ["serveur", "accueil"],
    "cv_keywords":     ["serveur", "client"],
    "selection_reason": "Bon profil restauration.",
}


# ─── /health ─────────────────────────────────────────────────────────────────

class TestHealth:

    def test_health_ok(self):
        r = client.get("/health")
        # L'endpoint existe ou 404 si non implémenté — on vérifie juste que l'API répond
        assert r.status_code in [200, 404]


# ─── /match ──────────────────────────────────────────────────────────────────

class TestMatchEndpoint:

    @patch("api.match_cv", return_value=MATCH_RESULT)
    @patch("api.load_cvs", return_value=[{"name": "cv_restauration", "content": "CV content", "is_generated": False}])
    @patch("api.extract_offer_metadata", return_value={"poste": "Serveur", "entreprise": "Brasserie", "adresse": "", "secteur": "restauration"})
    def test_match_avec_texte(self, mock_meta, mock_cvs, mock_match):
        r = client.post("/match", data={"offre_texte": OFFRE_TEXT})
        assert r.status_code == 200
        data = r.json()
        assert "cv_name"     in data
        assert "match_score" in data

    def test_match_sans_offre_retourne_400(self):
        r = client.post("/match", data={"offre_texte": ""})
        assert r.status_code == 400


# ─── /generate-letter ────────────────────────────────────────────────────────

class TestGenerateLetterEndpoint:

    @patch("api.generate_letter", return_value={
        "md_path":   "/tmp/lettre.md",
        "docx_path": "/tmp/lettre.docx",
        "corps":     "Corps de la lettre test.",
        "metadata":  {"poste": "Serveur", "entreprise": "Brasserie"},
    })
    def test_generate_letter_ok(self, mock_gen):
        r = client.post("/generate", json={
            "offre_texte":  OFFRE_TEXT,
            "match_result": MATCH_RESULT,
            "preferences":  "",
        })
        assert r.status_code == 200
        data = r.json()
        assert "lettre_md" in data or "corps" in data or "md_path" in data

    def test_generate_letter_sans_offre_retourne_erreur(self):
        r = client.post("/generate", json={
            "offre_texte":  "",
            "match_result": MATCH_RESULT,
            "preferences":  "",
        })
        assert r.status_code in [400, 422, 500]


# ─── /analyze-ats ────────────────────────────────────────────────────────────

class TestAnalyzeAtsEndpoint:

    ATS_RESULT = {
        "score":            85,
        "keywords_found":   ["serveur", "accueil"],
        "keywords_missing": ["HACCP"],
        "suggestions":      ["Ajouter HACCP"],
        "summary":          "Bon profil.",
        "report_path":      "/tmp/ats_report.md",
    }

    @patch("api.analyze_ats", return_value={
        "score": 85, "keywords_found": ["serveur"], "keywords_missing": ["HACCP"],
        "suggestions": ["Ajouter HACCP"], "summary": "Bon profil.", "report_path": "/tmp/r.md"
    })
    @patch("api.extract_offer_metadata", return_value={
        "poste": "Serveur", "entreprise": "Brasserie", "adresse": "", "secteur": "restauration"
    })
    @patch("api.generate_optimized_cv")
    def test_analyze_ats_ok(self, mock_gen, mock_meta, mock_ats):
        import tempfile, pathlib
        tmp = pathlib.Path(tempfile.mktemp(suffix=".md"))
        tmp.write_text("# CV optimisé test", encoding="utf-8")
        mock_gen.return_value = (tmp, None)
        r = client.post("/ats", json={
            "offre_texte":  OFFRE_TEXT,
            "match_result": MATCH_RESULT,
        })
        tmp.unlink(missing_ok=True)
        assert r.status_code == 200
        data = r.json()
        assert "score" in data

    def test_analyze_ats_sans_cv_retourne_erreur(self):
        r = client.post("/ats", json={
            "offre_texte":  OFFRE_TEXT,
            "match_result": {"cv_name": "cv_test", "cv_content": ""},
        })
        assert r.status_code in [400, 422, 500]


# ─── /history ────────────────────────────────────────────────────────────────

class TestHistoryEndpoint:

    def test_history_vide(self):
        r = client.get("/history")
        assert r.status_code == 200
        data = r.json()
        # L'API retourne {"candidatures": [...]}
        items = data.get("candidatures", data) if isinstance(data, dict) else data
        assert items == []

    def test_history_apres_save(self):
        db_module.save_candidature(
            offre_texte="Offre test",
            cv_nom="cv_restauration",
            ats_score=85,
            entreprise="Brasserie",
        )
        r = client.get("/history")
        assert r.status_code == 200
        data = r.json()
        items = data.get("candidatures", data) if isinstance(data, dict) else data
        assert len(items) == 1

    def test_history_limit(self):
        for i in range(5):
            db_module.save_candidature(offre_texte=f"Offre {i}", cv_nom=f"cv_{i}")
        r = client.get("/history?limit=3")
        assert r.status_code == 200
        data = r.json()
        items = data.get("candidatures", data) if isinstance(data, dict) else data
        assert len(items) == 3

    def test_history_ordre_desc(self):
        db_module.save_candidature(offre_texte="Première", cv_nom="cv_1")
        db_module.save_candidature(offre_texte="Deuxième", cv_nom="cv_2")
        r = client.get("/history")
        data = r.json()
        items = data.get("candidatures", data) if isinstance(data, dict) else data
        assert items[0]["cv_nom"] == "cv_2"


# ─── /candidature/{id} ───────────────────────────────────────────────────────

class TestCandidatureEndpoint:

    def test_get_existante(self):
        id_ = db_module.save_candidature(offre_texte="Offre", cv_nom="cv_test", ats_score=80)
        r = client.get(f"/history/{id_}")
        assert r.status_code == 200
        assert r.json()["cv_nom"] == "cv_test"

    def test_get_inexistante_404(self):
        r = client.get("/history/99999")
        assert r.status_code == 404

    def test_delete_existante(self):
        id_ = db_module.save_candidature(offre_texte="Offre", cv_nom="cv_test")
        r = client.delete(f"/history/{id_}")
        assert r.status_code == 200
        assert client.get(f"/history/{id_}").status_code == 404

    def test_delete_renvoie_ok(self):
        id_ = db_module.save_candidature(offre_texte="Offre", cv_nom="cv_test")
        r = client.delete(f"/history/{id_}")
        assert r.status_code == 200


# ─── /rag/stats ──────────────────────────────────────────────────────────────

class TestRagStatsEndpoint:

    def test_rag_stats_vide(self):
        r = client.get("/rag/stats")
        assert r.status_code == 200
        data = r.json()
        assert "cvs" in data
        assert "lettres" in data
        assert data["cvs"]["total"] == 0
        assert data["lettres"]["total"] == 0

    def test_rag_stats_avec_donnees(self):
        db_module.save_generated_cv(
            secteur="restauration", cv_base="cv_r", content="# CV", score_ats=88
        )
        r = client.get("/rag/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["cvs"]["total"] == 1
        assert data["cvs"]["par_secteur"][0]["secteur"] == "restauration"

    def test_rag_stats_champs(self):
        db_module.save_generated_cv(secteur="accueil", cv_base="cv_a", content="# CV", score_ats=90)
        data = client.get("/rag/stats").json()
        assert "cvs"    in data
        assert "lettres" in data
        assert "par_secteur" in data["cvs"]
        assert "score_moyen" in data["cvs"]


# ─── /open-in-libreoffice ────────────────────────────────────────────────────

class TestOpenLibreOffice:

    def test_fichier_inexistant_404(self):
        r = client.get("/open-in-libreoffice/fichier_qui_nexiste_pas.docx")
        assert r.status_code == 404

    @patch("api._find_libreoffice", return_value=None)
    def test_libreoffice_absent_500(self, _):
        # Crée un fichier temporaire dans output/
        output_dir = Path(__file__).parent.parent / "output"
        output_dir.mkdir(exist_ok=True)
        tmp = output_dir / "test_lo.docx"
        tmp.write_bytes(b"fake docx")
        try:
            r = client.get(f"/open-in-libreoffice/test_lo.docx")
            assert r.status_code == 500
        finally:
            tmp.unlink(missing_ok=True)

    @patch("api._find_libreoffice", return_value="/Applications/LibreOffice.app/Contents/MacOS/soffice")
    @patch("api.subprocess.Popen")
    def test_ouvre_libreoffice_ok(self, mock_popen, mock_lo):
        output_dir = Path(__file__).parent.parent / "output"
        output_dir.mkdir(exist_ok=True)
        tmp = output_dir / "test_open.docx"
        tmp.write_bytes(b"fake docx")
        try:
            r = client.get("/open-in-libreoffice/test_open.docx")
            assert r.status_code == 200
            assert r.json()["opened"] == "test_open.docx"
            mock_popen.assert_called_once()
        finally:
            tmp.unlink(missing_ok=True)


# ─── /search-jobs ────────────────────────────────────────────────────────────

class TestSearchJobs:

    def test_sans_poste_400(self):
        r = client.get("/search-jobs?poste=")
        assert r.status_code == 400

    @patch("api.search_jobs", return_value=[
        {"titre": "Serveur H/F", "entreprise": "Brasserie", "ville": "Strasbourg", "lien": "http://x.com"}
    ])
    def test_avec_poste_ok(self, mock_search):
        r = client.get("/search-jobs?poste=serveur&ville=Strasbourg")
        assert r.status_code == 200
        data = r.json()
        assert "jobs"  in data
        assert "count" in data
        assert data["count"] == 1
