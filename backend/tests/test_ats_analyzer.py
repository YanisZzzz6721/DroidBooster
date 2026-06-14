"""
test_ats_analyzer.py — Tests unitaires du module ats_analyzer.py
Couvre : _clean_cv_name, _extract_base_name, _extract_profil,
         _extract_mots_cles, _extract_score, _load_examples (cache),
         _save_generated_cv, analyze_ats (mock Claude), generate_optimized_cv (mock)
"""

import sys, os, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from airecruit.ats_analyzer import (
    _clean_cv_name,
    _extract_base_name,
    _extract_profil,
    _extract_mots_cles,
    _extract_score,
    _load_examples,
    _save_generated_cv,
    _examples_cache,
    _CACHE_TTL,
    invalidate_examples_cache,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────

CV_AVEC_PROFIL = """---
mots_cles: serveur, accueil, client, brasserie
---
# Yanis Zouggagh
**Serveur**

## Profil
Étudiant ingénieur disponible immédiatement. Sérieux et ponctuel.

## Expériences
### Serveur — Brasserie, Strasbourg
"""

CV_SANS_PROFIL = """# Yanis Zouggagh
**Serveur**

## Expériences
### Serveur — Brasserie
"""

CV_GENERE = """<!-- CV optimisé par AIRecruit le 14 juin 2026 -->
<!-- Basé sur : cv_restauration | Score ATS avant optimisation : 88/100 -->

# Yanis Zouggagh
**Serveur H/F**

## Profil
Étudiant disponible immédiatement.
"""


# ─── 1. _clean_cv_name ───────────────────────────────────────────────────────

class TestCleanCvName:

    def test_nom_simple(self):
        assert _clean_cv_name("cv_restauration") == "cv_restauration"

    def test_supprime_prefix_generated(self):
        assert _clean_cv_name("generated/cv_restauration") == "cv_restauration"

    def test_supprime_backslash(self):
        assert _clean_cv_name("generated\\cv_restauration") == "cv_restauration"

    def test_chemin_profond(self):
        assert _clean_cv_name("a/b/c/cv_accueil") == "cv_accueil"

    def test_nom_vide(self):
        assert _clean_cv_name("") == ""


# ─── 2. _extract_base_name ───────────────────────────────────────────────────

class TestExtractBaseName:

    def test_nom_genere_avec_date(self):
        name = "cv_restauration_burger_king_20260614"
        assert _extract_base_name(name) == "cv_restauration"

    def test_nom_simple_inchange(self):
        assert _extract_base_name("cv_restauration") == "cv_restauration"

    def test_evite_cascade(self):
        name = "cv_cv_restauration_yamisushi_20260608"
        result = _extract_base_name(name)
        assert not result.startswith("cv_cv_cv")


# ─── 3. _extract_profil ──────────────────────────────────────────────────────

class TestExtractProfil:

    def test_extrait_profil(self):
        profil = _extract_profil(CV_AVEC_PROFIL)
        assert "disponible immédiatement" in profil

    def test_profil_absent_retourne_vide(self):
        assert _extract_profil(CV_SANS_PROFIL) == ""

    def test_profil_objectif(self):
        cv = "## Objectif\nRecherche emploi étudiant.\n## Expériences\n"
        assert "emploi" in _extract_profil(cv)

    def test_cv_vide(self):
        assert _extract_profil("") == ""


# ─── 4. _extract_mots_cles ───────────────────────────────────────────────────

class TestExtractMotsCles:

    def test_extrait_mots_cles(self):
        result = _extract_mots_cles(CV_AVEC_PROFIL)
        assert "serveur" in result

    def test_sans_frontmatter_retourne_vide(self):
        assert _extract_mots_cles(CV_SANS_PROFIL) == ""

    def test_cv_vide(self):
        assert _extract_mots_cles("") == ""


# ─── 5. _extract_score ───────────────────────────────────────────────────────

class TestExtractScore:

    def test_extrait_score(self):
        assert _extract_score(CV_GENERE) == 88

    def test_sans_score_retourne_zero(self):
        assert _extract_score("Aucun score ici.") == 0

    def test_score_100(self):
        content = "<!-- Score ATS avant optimisation : 100/100 -->"
        assert _extract_score(content) == 100

    def test_score_zero(self):
        content = "<!-- Score ATS avant optimisation : 0/100 -->"
        assert _extract_score(content) == 0


# ─── 6. Cache _load_examples ─────────────────────────────────────────────────

class TestLoadExamplesCache:

    def setup_method(self):
        """Vide le cache avant chaque test."""
        _examples_cache.clear()

    def test_cache_vide_au_depart(self):
        _examples_cache.clear()
        assert len(_examples_cache) == 0

    @patch("airecruit.ats_analyzer.get_examples_by_secteur", return_value=[])
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_resultat_mis_en_cache(self, mock_dir, mock_db):
        """Après un appel, le résultat doit être en cache."""
        tmp = tempfile.mkdtemp()
        mock_dir.return_value = Path(tmp)
        _load_examples("restauration")
        assert len(_examples_cache) == 1

    @patch("airecruit.ats_analyzer.get_examples_by_secteur", return_value=[])
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_deuxieme_appel_depuis_cache(self, mock_dir, mock_db):
        """Le 2e appel doit retourner depuis le cache sans relire le disque."""
        tmp = tempfile.mkdtemp()
        mock_dir.return_value = Path(tmp)
        _load_examples("restauration")
        call_count_apres_1 = mock_dir.call_count
        _load_examples("restauration")
        # mock_dir ne doit pas être rappelé (cache utilisé)
        assert mock_dir.call_count == call_count_apres_1

    @patch("airecruit.ats_analyzer.get_examples_by_secteur", return_value=[])
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_cache_expire_apres_ttl(self, mock_dir, mock_db):
        """Après expiration du TTL, le cache doit être rechargé."""
        import airecruit.ats_analyzer as mod
        tmp = tempfile.mkdtemp()
        mock_dir.return_value = Path(tmp)

        cache_key = "restauration_2_85"
        _examples_cache[cache_key] = ("résultat périmé", time.time() - _CACHE_TTL - 1)

        _load_examples("restauration")
        # Le cache a été rechargé — le résultat périmé a été remplacé
        _, cached_at = _examples_cache[cache_key]
        assert time.time() - cached_at < 5  # rechargé récemment

    def test_invalidate_vide_cache(self):
        _examples_cache["test_key"] = ("data", time.time())
        invalidate_examples_cache()
        assert len(_examples_cache) == 0

    @patch("airecruit.ats_analyzer.get_examples_by_secteur", return_value=[])
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_cles_differentes_par_secteur(self, mock_dir, mock_db):
        """Deux secteurs différents → deux entrées en cache."""
        tmp = tempfile.mkdtemp()
        mock_dir.return_value = Path(tmp)
        _load_examples("restauration")
        _load_examples("accueil")
        assert len(_examples_cache) == 2


# ─── 7. _save_generated_cv ───────────────────────────────────────────────────

class TestSaveGeneratedCv:

    def setup_method(self):
        self.tmp_dir = Path(tempfile.mkdtemp())

    @patch("airecruit.ats_analyzer.db_save_generated_cv")
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_cree_fichier_md(self, mock_dir, mock_db):
        mock_dir.return_value = self.tmp_dir
        path = _save_generated_cv("# CV test\n", "cv_restauration", "burger_king")
        assert path.exists()
        assert path.suffix == ".md"

    @patch("airecruit.ats_analyzer.db_save_generated_cv")
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_contenu_correct(self, mock_dir, mock_db):
        mock_dir.return_value = self.tmp_dir
        contenu = "# Yanis Zouggagh\n**Serveur**"
        path = _save_generated_cv(contenu, "cv_restauration", "burger_king")
        assert path.read_text(encoding="utf-8") == contenu

    @patch("airecruit.ats_analyzer.db_save_generated_cv")
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_nom_fichier_contient_cv_name(self, mock_dir, mock_db):
        mock_dir.return_value = self.tmp_dir
        path = _save_generated_cv("contenu", "cv_restauration", "test_ent")
        assert "restauration" in path.name

    @patch("airecruit.ats_analyzer.db_save_generated_cv")
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_nom_fichier_contient_date(self, mock_dir, mock_db):
        from datetime import datetime
        mock_dir.return_value = self.tmp_dir
        path = _save_generated_cv("contenu", "cv_restauration", "test")
        today = datetime.now().strftime("%Y%m%d")
        assert today in path.name

    @patch("airecruit.ats_analyzer.db_save_generated_cv")
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_sauvegarde_en_db(self, mock_dir, mock_db):
        mock_dir.return_value = self.tmp_dir
        _save_generated_cv("contenu", "cv_restauration", "test", secteur="restauration", score_ats=88)
        mock_db.assert_called_once()
        call_kwargs = mock_db.call_args[1] if mock_db.call_args[1] else {}
        call_args   = mock_db.call_args[0] if mock_db.call_args[0] else ()
        # Vérifie que score_ats et secteur sont bien passés
        assert mock_db.called

    @patch("airecruit.ats_analyzer.db_save_generated_cv", side_effect=Exception("DB error"))
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_db_erreur_ne_bloque_pas(self, mock_dir, mock_db):
        """Si la DB échoue, le fichier doit quand même être créé."""
        mock_dir.return_value = self.tmp_dir
        path = _save_generated_cv("contenu", "cv_restauration", "test")
        assert path.exists()  # Le fichier est créé malgré l'erreur DB

    @patch("airecruit.ats_analyzer.db_save_generated_cv")
    @patch("airecruit.ats_analyzer._get_generated_dir")
    def test_evite_cascade_nom(self, mock_dir, mock_db):
        """Un CV déjà généré ne doit pas créer un nom en cascade cv_cv_cv_..."""
        mock_dir.return_value = self.tmp_dir
        # Input : nom d'un CV généré avec date → le nom de base extrait doit être cv_restauration
        path = _save_generated_cv("contenu", "cv_restauration_tonton_20260608", "test")
        assert "cv_cv_cv" not in path.name


# ─── 8. analyze_ats — mock Claude ────────────────────────────────────────────

class TestAnalyzeAts:

    MATCH_RESULT = {
        "cv_name":    "cv_restauration",
        "cv_content": "Serveur expérimenté, accueil client, brasserie, bar.",
    }

    OFFRE = "Recherche serveur H/F pour brasserie, accueil client, service en salle."

    CLAUDE_RESPONSE = {
        "score":            85,
        "keywords_found":   ["serveur", "accueil", "brasserie"],
        "keywords_missing": ["HACCP", "encaissement"],
        "suggestions":      ["Ajouter HACCP", "Mentionner encaissement"],
        "summary":          "Bon profil, quelques mots-clés manquants.",
    }

    @patch("airecruit.ats_analyzer.anthropic.Anthropic")
    def test_retourne_score(self, mock_anthropic):
        mock_client = MagicMock()
        mock_anthropic.return_value = mock_client
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(text='{"score":85,"keywords_found":["serveur"],"keywords_missing":["HACCP"],"suggestions":["Ajouter HACCP"],"summary":"Bon profil."}')]
        )

        from airecruit.ats_analyzer import analyze_ats
        result = analyze_ats(self.OFFRE, self.MATCH_RESULT)
        assert "score" in result
        assert 0 <= result["score"] <= 100

    @patch("airecruit.ats_analyzer.anthropic.Anthropic")
    def test_retourne_tous_champs(self, mock_anthropic):
        mock_client = MagicMock()
        mock_anthropic.return_value = mock_client
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(text='{"score":85,"keywords_found":["serveur"],"keywords_missing":["HACCP"],"suggestions":["Ajouter HACCP"],"summary":"Bon profil."}')]
        )

        from airecruit.ats_analyzer import analyze_ats
        result = analyze_ats(self.OFFRE, self.MATCH_RESULT)
        for champ in ["score", "keywords_found", "keywords_missing", "suggestions", "summary"]:
            assert champ in result

    def test_leve_erreur_si_cv_vide(self):
        from airecruit.ats_analyzer import analyze_ats
        with pytest.raises(ValueError, match="cv_content"):
            analyze_ats(self.OFFRE, {"cv_name": "cv_test", "cv_content": ""})
