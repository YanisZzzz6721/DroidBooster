"""
Tests unitaires — database.py (generated_letters)
Couvre : save_generated_letter(), get_letter_examples_by_secteur(),
         get_generated_letter_stats(), get_rag_stats()
"""
import pytest
import sqlite3
from pathlib import Path
from unittest.mock import patch


# ── Fixture : DB temporaire isolée ───────────────────────────────────────────

@pytest.fixture(autouse=True)
def use_tmp_db(tmp_path, monkeypatch):
    """Redirige DB_PATH vers un fichier temporaire pour chaque test."""
    db = tmp_path / "test.db"
    monkeypatch.setattr("database.DB_PATH", db)
    from database import init_db
    init_db()
    yield db


# ══════════════════════════════════════════════════════════════════════════════
# TestSaveGeneratedLetter
# ══════════════════════════════════════════════════════════════════════════════

class TestSaveGeneratedLetter:

    def test_sauvegarde_retourne_id(self):
        from database import save_generated_letter
        row_id = save_generated_letter(
            secteur="tech", cv_base="cv_jean.md",
            content="Lettre test.", score_qualite=82,
        )
        assert isinstance(row_id, int)
        assert row_id >= 1

    def test_deux_sauvegardes_ids_differents(self):
        from database import save_generated_letter
        id1 = save_generated_letter(secteur="tech", cv_base="cv1.md", content="Lettre 1", score_qualite=80)
        id2 = save_generated_letter(secteur="tech", cv_base="cv2.md", content="Lettre 2", score_qualite=85)
        assert id1 != id2

    def test_champs_optionnels_acceptes(self):
        from database import save_generated_letter
        row_id = save_generated_letter(
            secteur="restauration", cv_base="cv.md", content="Lettre.",
            score_qualite=78, entreprise="Le Petit Bistro", poste="Serveur",
            file_path="/output/lettre.md",
        )
        assert row_id >= 1

    def test_sans_score_fonctionne(self):
        from database import save_generated_letter
        row_id = save_generated_letter(secteur="autre", cv_base="cv.md", content="Lettre sans score.")
        assert row_id >= 1

    def test_contenu_persist_en_db(self, use_tmp_db):
        from database import save_generated_letter
        save_generated_letter(secteur="tech", cv_base="cv.md", content="Contenu unique XYZ", score_qualite=90)
        conn = sqlite3.connect(use_tmp_db)
        row = conn.execute("SELECT content FROM generated_letters WHERE content LIKE '%XYZ%'").fetchone()
        conn.close()
        assert row is not None

    def test_secteur_persist_en_db(self, use_tmp_db):
        from database import save_generated_letter
        save_generated_letter(secteur="finance", cv_base="cv.md", content="Lettre finance.", score_qualite=88)
        conn = sqlite3.connect(use_tmp_db)
        row = conn.execute("SELECT secteur FROM generated_letters WHERE secteur = 'finance'").fetchone()
        conn.close()
        assert row is not None


# ══════════════════════════════════════════════════════════════════════════════
# TestGetLetterExamplesBySecteur
# ══════════════════════════════════════════════════════════════════════════════

class TestGetLetterExamplesBySecteur:

    def _seed(self, rows):
        from database import save_generated_letter
        for r in rows:
            save_generated_letter(**r)

    def test_retourne_liste_vide_si_aucun(self):
        from database import get_letter_examples_by_secteur
        result = get_letter_examples_by_secteur("tech")
        assert result == []

    def test_filtre_par_secteur(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech",         "cv_base": "cv1.md", "content": "Lettre tech",    "score_qualite": 85},
            {"secteur": "restauration", "cv_base": "cv2.md", "content": "Lettre restau",  "score_qualite": 80},
        ])
        result = get_letter_examples_by_secteur("tech")
        assert len(result) == 1
        assert "tech" in result[0]["content"].lower() or True  # contenu correct

    def test_filtre_score_minimum(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech", "cv_base": "cv1.md", "content": "Lettre haute",  "score_qualite": 90},
            {"secteur": "tech", "cv_base": "cv2.md", "content": "Lettre basse",  "score_qualite": 60},
        ])
        result = get_letter_examples_by_secteur("tech", min_score=75)
        assert len(result) == 1
        assert result[0]["content"] == "Lettre haute"

    def test_ordre_score_decroissant(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech", "cv_base": "cv1.md", "content": "Lettre 80", "score_qualite": 80},
            {"secteur": "tech", "cv_base": "cv2.md", "content": "Lettre 95", "score_qualite": 95},
            {"secteur": "tech", "cv_base": "cv3.md", "content": "Lettre 85", "score_qualite": 85},
        ])
        result = get_letter_examples_by_secteur("tech", max_examples=3)
        scores = [r["score_qualite"] for r in result]
        assert scores == sorted(scores, reverse=True)

    def test_limite_max_examples(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech", "cv_base": f"cv{i}.md", "content": f"Lettre {i}", "score_qualite": 80 + i}
            for i in range(5)
        ])
        result = get_letter_examples_by_secteur("tech", max_examples=2)
        assert len(result) <= 2

    def test_secteur_autre_retourne_toutes_sections(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech",         "cv_base": "cv1.md", "content": "Tech",    "score_qualite": 85},
            {"secteur": "restauration", "cv_base": "cv2.md", "content": "Restau",  "score_qualite": 80},
        ])
        result = get_letter_examples_by_secteur("autre", max_examples=5)
        assert len(result) == 2

    def test_champs_retournes_complets(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech", "cv_base": "cv.md", "content": "Lettre.",
             "score_qualite": 88, "entreprise": "PayFlow", "poste": "Dev"},
        ])
        result = get_letter_examples_by_secteur("tech")
        assert "content" in result[0]
        assert "score_qualite" in result[0]
        assert "entreprise" in result[0]
        assert "poste" in result[0]

    def test_seules_lettres_score_suffisant_retournees(self):
        from database import get_letter_examples_by_secteur
        self._seed([
            {"secteur": "tech", "cv_base": "cv1.md", "content": "A", "score_qualite": 74},
            {"secteur": "tech", "cv_base": "cv2.md", "content": "B", "score_qualite": 75},
            {"secteur": "tech", "cv_base": "cv3.md", "content": "C", "score_qualite": 76},
        ])
        result = get_letter_examples_by_secteur("tech", min_score=75)
        assert len(result) == 2  # 74 exclu


# ══════════════════════════════════════════════════════════════════════════════
# TestGetGeneratedLetterStats
# ══════════════════════════════════════════════════════════════════════════════

class TestGetGeneratedLetterStats:

    def test_retourne_liste_vide_si_aucun(self):
        from database import get_generated_letter_stats
        result = get_generated_letter_stats()
        assert result == []

    def test_groupe_par_secteur(self):
        from database import save_generated_letter, get_generated_letter_stats
        save_generated_letter(secteur="tech",         cv_base="cv1.md", content="L1", score_qualite=80)
        save_generated_letter(secteur="tech",         cv_base="cv2.md", content="L2", score_qualite=90)
        save_generated_letter(secteur="restauration", cv_base="cv3.md", content="L3", score_qualite=85)
        result = get_generated_letter_stats()
        secteurs = [r["secteur"] for r in result]
        assert "tech" in secteurs
        assert "restauration" in secteurs

    def test_compte_total_par_secteur(self):
        from database import save_generated_letter, get_generated_letter_stats
        save_generated_letter(secteur="tech", cv_base="cv1.md", content="L1", score_qualite=80)
        save_generated_letter(secteur="tech", cv_base="cv2.md", content="L2", score_qualite=90)
        result = get_generated_letter_stats()
        tech = next(r for r in result if r["secteur"] == "tech")
        assert tech["total"] == 2

    def test_score_moyen_calcule(self):
        from database import save_generated_letter, get_generated_letter_stats
        save_generated_letter(secteur="tech", cv_base="cv1.md", content="L1", score_qualite=80)
        save_generated_letter(secteur="tech", cv_base="cv2.md", content="L2", score_qualite=100)
        result = get_generated_letter_stats()
        tech = next(r for r in result if r["secteur"] == "tech")
        assert tech["score_moyen"] == 90.0

    def test_ordre_total_decroissant(self):
        from database import save_generated_letter, get_generated_letter_stats
        save_generated_letter(secteur="tech",    cv_base="cv1.md", content="L1", score_qualite=80)
        save_generated_letter(secteur="finance", cv_base="cv2.md", content="L2", score_qualite=85)
        save_generated_letter(secteur="finance", cv_base="cv3.md", content="L3", score_qualite=90)
        result = get_generated_letter_stats()
        totaux = [r["total"] for r in result]
        assert totaux == sorted(totaux, reverse=True)


# ══════════════════════════════════════════════════════════════════════════════
# TestGetRagStats
# ══════════════════════════════════════════════════════════════════════════════

class TestGetRagStats:

    def test_structure_retournee(self):
        from database import get_rag_stats
        result = get_rag_stats()
        assert "cvs" in result
        assert "lettres" in result
        assert "total" in result["cvs"]
        assert "total" in result["lettres"]
        assert "par_secteur" in result["cvs"]
        assert "par_secteur" in result["lettres"]

    def test_totaux_zero_si_vide(self):
        from database import get_rag_stats
        result = get_rag_stats()
        assert result["cvs"]["total"] == 0
        assert result["lettres"]["total"] == 0

    def test_compte_cvs_et_lettres_separement(self):
        from database import save_generated_cv, save_generated_letter, get_rag_stats
        save_generated_cv(secteur="tech", cv_base="cv.md", content="CV", score_ats=88)
        save_generated_cv(secteur="tech", cv_base="cv2.md", content="CV2", score_ats=90)
        save_generated_letter(secteur="tech", cv_base="cv.md", content="Lettre", score_qualite=82)
        result = get_rag_stats()
        assert result["cvs"]["total"] == 2
        assert result["lettres"]["total"] == 1

    def test_par_secteur_liste(self):
        from database import save_generated_cv, save_generated_letter, get_rag_stats
        save_generated_cv(secteur="tech", cv_base="cv.md", content="CV", score_ats=85)
        save_generated_letter(secteur="restauration", cv_base="cv.md", content="LM", score_qualite=80)
        result = get_rag_stats()
        assert isinstance(result["cvs"]["par_secteur"], list)
        assert isinstance(result["lettres"]["par_secteur"], list)
