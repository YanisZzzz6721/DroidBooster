import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from pathlib import Path

# Override DB_PATH pour les tests
import database as db_module
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
db_module.DB_PATH = Path(_tmp_db.name)

from database import (
    init_db,
    save_candidature, get_history, get_candidature, delete_candidature,
    save_export, get_export_history, get_export, delete_export,
)


@pytest.fixture(autouse=True)
def reset_db():
    """Recrée la DB propre avant chaque test."""
    import sqlite3
    conn = sqlite3.connect(db_module.DB_PATH)
    conn.execute("DROP TABLE IF EXISTS candidatures")
    conn.execute("DROP TABLE IF EXISTS exports")
    conn.commit()
    conn.close()
    init_db()
    yield


# ── CANDIDATURES ─────────────────────────────────────────────────────────────

class TestCandidatures:

    def test_init_cree_tables(self):
        import sqlite3
        conn = sqlite3.connect(db_module.DB_PATH)
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        conn.close()
        assert "candidatures" in tables
        assert "exports" in tables

    def test_save_retourne_id(self):
        id_ = save_candidature(offre_texte="Offre test", cv_nom="cv_accueil")
        assert isinstance(id_, int) and id_ > 0

    def test_save_et_get_history(self):
        save_candidature(offre_texte="Offre 1", cv_nom="cv_accueil", ats_score=85)
        save_candidature(offre_texte="Offre 2", cv_nom="cv_restauration", ats_score=72)
        history = get_history()
        assert len(history) == 2

    def test_history_ordre_desc(self):
        save_candidature(offre_texte="Premier", cv_nom="cv_1")
        save_candidature(offre_texte="Deuxième", cv_nom="cv_2")
        history = get_history()
        assert history[0]["cv_nom"] == "cv_2"

    def test_history_limit(self):
        for i in range(5):
            save_candidature(offre_texte=f"Offre {i}", cv_nom=f"cv_{i}")
        assert len(get_history(limit=3)) == 3

    def test_get_candidature_existante(self):
        id_ = save_candidature(
            offre_texte="Offre", cv_nom="cv_accueil",
            match_score=90, ats_score=85, lettre_md="Lettre test"
        )
        c = get_candidature(id_)
        assert c is not None
        assert c["cv_nom"] == "cv_accueil"
        assert c["match_score"] == 90
        assert c["lettre_md"] == "Lettre test"

    def test_get_candidature_inexistante(self):
        assert get_candidature(9999) is None

    def test_delete_candidature(self):
        id_ = save_candidature(offre_texte="Offre", cv_nom="cv_test")
        delete_candidature(id_)
        assert get_candidature(id_) is None

    def test_delete_filtre_liste(self):
        id1 = save_candidature(offre_texte="Offre 1", cv_nom="cv_1")
        id2 = save_candidature(offre_texte="Offre 2", cv_nom="cv_2")
        delete_candidature(id1)
        history = get_history()
        ids = [h["id"] for h in history]
        assert id1 not in ids
        assert id2 in ids

    def test_champs_optionnels_null(self):
        id_ = save_candidature(offre_texte="Offre", cv_nom="cv_test")
        c = get_candidature(id_)
        assert c["match_score"] is None
        assert c["lettre_md"] is None


# ── EXPORTS ──────────────────────────────────────────────────────────────────

class TestExports:

    def test_save_export_retourne_id(self):
        id_ = save_export(cv_nom="Yanis", cv_titre="Hôte", template="tpl.docx", docx_path="/tmp/cv.docx")
        assert isinstance(id_, int) and id_ > 0

    def test_get_export_history(self):
        save_export(cv_nom="Yanis", cv_titre="Hôte", template="tpl.docx", docx_path="/tmp/cv1.docx")
        save_export(cv_nom="Yanis", cv_titre="Serveur", template="tpl.docx", docx_path="/tmp/cv2.docx")
        history = get_export_history()
        assert len(history) == 2

    def test_export_history_ordre_desc(self):
        save_export(cv_nom="Yanis", cv_titre="Hôte", template="tpl.docx", docx_path="/tmp/cv1.docx")
        save_export(cv_nom="Yanis", cv_titre="Serveur", template="tpl.docx", docx_path="/tmp/cv2.docx")
        history = get_export_history()
        assert history[0]["cv_titre"] == "Serveur"

    def test_export_history_limit(self):
        for i in range(5):
            save_export(cv_nom="Yanis", cv_titre=f"Titre {i}", template="tpl.docx", docx_path=f"/tmp/cv{i}.docx")
        assert len(get_export_history(limit=2)) == 2

    def test_get_export_existant(self):
        id_ = save_export(cv_nom="Yanis", cv_titre="Hôte", template="tpl.docx", docx_path="/tmp/cv.docx")
        e = get_export(id_)
        assert e is not None
        assert e["cv_nom"] == "Yanis"
        assert e["docx_path"] == "/tmp/cv.docx"

    def test_get_export_inexistant(self):
        assert get_export(9999) is None

    def test_delete_export_sans_fichier(self):
        id_ = save_export(cv_nom="Yanis", cv_titre="Hôte", template="tpl.docx", docx_path="/tmp/inexistant.docx")
        result = delete_export(id_)
        assert result is True
        assert get_export(id_) is None

    def test_delete_export_avec_fichier(self):
        # Crée un vrai fichier temporaire
        tmp = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
        tmp.write(b"contenu test")
        tmp.close()
        id_ = save_export(cv_nom="Yanis", cv_titre="Test", template="tpl.docx", docx_path=tmp.name)
        delete_export(id_)
        assert not os.path.exists(tmp.name)
        assert get_export(id_) is None

    def test_delete_export_inexistant(self):
        assert delete_export(9999) is False

    def test_history_champs_corrects(self):
        save_export(cv_nom="Yanis", cv_titre="Hôte", template="mon_template.docx", docx_path="/tmp/cv.docx")
        history = get_export_history()
        assert "id" in history[0]
        assert "created_at" in history[0]
        assert "cv_nom" in history[0]
        assert "cv_titre" in history[0]
        assert "template" in history[0]
        assert "docx_path" not in history[0]  # pas exposé dans la liste
