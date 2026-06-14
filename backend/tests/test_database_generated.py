"""
test_database_generated.py — Tests unitaires de la table generated_cvs.
Couvre : save_generated_cv, get_examples_by_secteur, get_generated_cv_stats
"""

import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from pathlib import Path
import sqlite3

import database as db_module

# Override DB_PATH pour les tests
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
db_module.DB_PATH = Path(_tmp_db.name)

from database import (
    init_db,
    save_generated_cv,
    get_examples_by_secteur,
    get_generated_cv_stats,
)


@pytest.fixture(autouse=True)
def reset_db():
    """Recrée la DB propre avant chaque test."""
    conn = sqlite3.connect(db_module.DB_PATH)
    conn.execute("DROP TABLE IF EXISTS generated_cvs")
    conn.execute("DROP TABLE IF EXISTS candidatures")
    conn.execute("DROP TABLE IF EXISTS exports")
    conn.commit()
    conn.close()
    init_db()
    yield


# ─── save_generated_cv ───────────────────────────────────────────────────────

class TestSaveGeneratedCv:

    def test_retourne_id(self):
        id_ = save_generated_cv(secteur="restauration", cv_base="cv_restauration", content="# CV")
        assert isinstance(id_, int) and id_ > 0

    def test_save_minimal(self):
        id_ = save_generated_cv(secteur="restauration", cv_base="cv_restauration", content="# CV")
        conn = sqlite3.connect(db_module.DB_PATH)
        row = conn.execute("SELECT * FROM generated_cvs WHERE id=?", (id_,)).fetchone()
        conn.close()
        assert row is not None

    def test_save_avec_tous_champs(self):
        id_ = save_generated_cv(
            secteur="restauration",
            cv_base="cv_restauration",
            content="# CV test",
            score_ats=88,
            entreprise="Burger King",
            file_path="/tmp/cv.md",
        )
        conn = sqlite3.connect(db_module.DB_PATH)
        conn.row_factory = sqlite3.Row
        row = dict(conn.execute("SELECT * FROM generated_cvs WHERE id=?", (id_,)).fetchone())
        conn.close()
        assert row["secteur"]    == "restauration"
        assert row["cv_base"]    == "cv_restauration"
        assert row["score_ats"]  == 88
        assert row["entreprise"] == "Burger King"
        assert row["file_path"]  == "/tmp/cv.md"

    def test_created_at_non_null(self):
        id_ = save_generated_cv(secteur="accueil", cv_base="cv_accueil", content="# CV")
        conn = sqlite3.connect(db_module.DB_PATH)
        row = conn.execute("SELECT created_at FROM generated_cvs WHERE id=?", (id_,)).fetchone()
        conn.close()
        assert row[0] is not None and row[0] != ""

    def test_champs_optionnels_null(self):
        id_ = save_generated_cv(secteur="autre", cv_base="cv_test", content="# CV")
        conn = sqlite3.connect(db_module.DB_PATH)
        conn.row_factory = sqlite3.Row
        row = dict(conn.execute("SELECT * FROM generated_cvs WHERE id=?", (id_,)).fetchone())
        conn.close()
        assert row["score_ats"]  is None
        assert row["entreprise"] is None
        assert row["file_path"]  is None

    def test_plusieurs_entrees(self):
        for i in range(5):
            save_generated_cv(secteur="restauration", cv_base=f"cv_{i}", content=f"# CV {i}", score_ats=80+i)
        conn = sqlite3.connect(db_module.DB_PATH)
        count = conn.execute("SELECT COUNT(*) FROM generated_cvs").fetchone()[0]
        conn.close()
        assert count == 5


# ─── get_examples_by_secteur ─────────────────────────────────────────────────

class TestGetExamplesBySecteur:

    def setup_method(self):
        """Insère des données de test."""
        save_generated_cv(secteur="restauration", cv_base="cv_restauration", content="CV resto 1", score_ats=90)
        save_generated_cv(secteur="restauration", cv_base="cv_restauration", content="CV resto 2", score_ats=85)
        save_generated_cv(secteur="restauration", cv_base="cv_restauration", content="CV resto 3", score_ats=70)
        save_generated_cv(secteur="accueil",      cv_base="cv_accueil",      content="CV accueil", score_ats=88)
        save_generated_cv(secteur="logistique",   cv_base="cv_logistique",   content="CV logistique", score_ats=60)

    def test_filtre_par_secteur(self):
        rows = get_examples_by_secteur("accueil")
        assert all(r["content"] == "CV accueil" for r in rows)

    def test_limite_max_examples(self):
        rows = get_examples_by_secteur("restauration", max_examples=2)
        assert len(rows) <= 2

    def test_score_min_respecte(self):
        rows = get_examples_by_secteur("restauration", min_score=85)
        assert all(r["score_ats"] >= 85 for r in rows)

    def test_ordre_score_desc(self):
        rows = get_examples_by_secteur("restauration", max_examples=3, min_score=0)
        scores = [r["score_ats"] for r in rows]
        assert scores == sorted(scores, reverse=True)

    def test_secteur_inexistant_retourne_vide(self):
        rows = get_examples_by_secteur("animation")
        assert rows == []

    def test_secteur_autre_retourne_tous(self):
        """secteur='autre' → retourne les meilleurs toutes catégories."""
        rows = get_examples_by_secteur("autre", max_examples=10, min_score=0)
        assert len(rows) > 0

    def test_min_score_trop_eleve_retourne_vide(self):
        rows = get_examples_by_secteur("restauration", min_score=99)
        assert rows == []

    def test_champs_retournes(self):
        rows = get_examples_by_secteur("restauration", max_examples=1)
        if rows:
            assert "content"   in rows[0]
            assert "score_ats" in rows[0]
            assert "cv_base"   in rows[0]

    def test_contenu_correct(self):
        rows = get_examples_by_secteur("restauration", max_examples=1, min_score=90)
        assert rows[0]["content"] == "CV resto 1"


# ─── get_generated_cv_stats ──────────────────────────────────────────────────

class TestGetGeneratedCvStats:

    def test_vide_retourne_liste_vide(self):
        assert get_generated_cv_stats() == []

    def test_retourne_stats_par_secteur(self):
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=85)
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=90)
        save_generated_cv(secteur="accueil",      cv_base="cv_a", content="CV", score_ats=80)

        stats = get_generated_cv_stats()
        secteurs = [s["secteur"] for s in stats]
        assert "restauration" in secteurs
        assert "accueil" in secteurs

    def test_total_correct(self):
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=85)
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=90)
        stats = get_generated_cv_stats()
        resto = next(s for s in stats if s["secteur"] == "restauration")
        assert resto["total"] == 2

    def test_score_moyen_correct(self):
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=80)
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=100)
        stats = get_generated_cv_stats()
        resto = next(s for s in stats if s["secteur"] == "restauration")
        assert resto["score_moyen"] == 90.0

    def test_ordre_par_total_desc(self):
        for _ in range(3):
            save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=85)
        save_generated_cv(secteur="accueil", cv_base="cv_a", content="CV", score_ats=85)

        stats = get_generated_cv_stats()
        assert stats[0]["secteur"] == "restauration"

    def test_champs_retournes(self):
        save_generated_cv(secteur="restauration", cv_base="cv_r", content="CV", score_ats=85)
        stats = get_generated_cv_stats()
        assert "secteur"     in stats[0]
        assert "total"       in stats[0]
        assert "score_moyen" in stats[0]
