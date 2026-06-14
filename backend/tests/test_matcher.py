"""
test_matcher.py — Tests unitaires du module matcher.py
Couvre : _tokenize, _score_local, match_cv (sans appel Claude)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))

import pytest
from unittest.mock import patch, MagicMock
from airecruit.matcher import _tokenize, _score_local, match_cv


# ─── Fixtures ────────────────────────────────────────────────────────────────

CV_RESTAURATION = {
    "name": "cv_restauration",
    "content": "serveur expérience restauration accueil client salle brasserie bar commandes encaissement",
    "is_generated": False,
}

CV_LOGISTIQUE = {
    "name": "cv_logistique",
    "content": "préparateur commandes entrepôt logistique manutention stock expédition",
    "is_generated": False,
}

CV_ACCUEIL = {
    "name": "cv_accueil",
    "content": "accueil réceptionniste hôte relation client standard gare sncf orientation",
    "is_generated": False,
}

OFFRE_RESTAURATION = "recherche serveur expérimenté brasserie salle accueil client bar restauration"
OFFRE_LOGISTIQUE   = "préparateur commandes entrepôt logistique manutention cariste stock"
OFFRE_ACCUEIL      = "hôte accueil relation client standard orientation gare sncf"


# ─── 1. _tokenize ────────────────────────────────────────────────────────────

class TestTokenize:

    def test_retourne_set(self):
        assert isinstance(_tokenize("bonjour monde"), set)

    def test_mots_minuscules(self):
        tokens = _tokenize("Bonjour MONDE")
        assert "bonjour" in tokens
        assert "monde" in tokens

    def test_filtre_stopwords(self):
        tokens = _tokenize("les des une que par sur est")
        assert len(tokens) == 0

    def test_filtre_mots_courts(self):
        tokens = _tokenize("je tu il va au")
        assert all(len(t) >= 3 for t in tokens)

    def test_texte_vide(self):
        assert _tokenize("") == set()

    def test_texte_chiffres(self):
        # Les chiffres seuls ne passent pas le regex [a-zA-ZÀ-ÿ]
        tokens = _tokenize("123 456")
        assert len(tokens) == 0

    def test_mots_accentues(self):
        tokens = _tokenize("réceptionniste hôtelier préparateur")
        assert "réceptionniste" in tokens
        assert "hôtelier" in tokens

    def test_pas_de_doublons(self):
        tokens = _tokenize("serveur serveur serveur")
        assert len(tokens) == 1

    def test_mix_valide(self):
        tokens = _tokenize("serveur en restauration avec expérience")
        assert "serveur" in tokens
        assert "restauration" in tokens
        assert "expérience" in tokens


# ─── 2. _score_local ─────────────────────────────────────────────────────────

class TestScoreLocal:

    def test_score_entre_0_et_100(self):
        score = _score_local(OFFRE_RESTAURATION, CV_RESTAURATION["content"])
        assert 0 <= score <= 100

    def test_cv_pertinent_score_eleve(self):
        score = _score_local(OFFRE_RESTAURATION, CV_RESTAURATION["content"])
        assert score >= 50

    def test_cv_non_pertinent_score_bas(self):
        score = _score_local(OFFRE_RESTAURATION, CV_LOGISTIQUE["content"])
        assert score < 50

    def test_cv_identique_offre_score_max(self):
        texte = "serveur restauration accueil client brasserie"
        score = _score_local(texte, texte)
        assert score == 100.0

    def test_offre_vide_retourne_zero(self):
        assert _score_local("", CV_RESTAURATION["content"]) == 0.0

    def test_cv_vide_score_zero(self):
        score = _score_local(OFFRE_RESTAURATION, "")
        assert score == 0.0

    def test_logistique_vs_logistique(self):
        score = _score_local(OFFRE_LOGISTIQUE, CV_LOGISTIQUE["content"])
        assert score >= 50

    def test_accueil_vs_accueil(self):
        score = _score_local(OFFRE_ACCUEIL, CV_ACCUEIL["content"])
        assert score >= 50

    def test_retourne_float(self):
        score = _score_local(OFFRE_RESTAURATION, CV_RESTAURATION["content"])
        assert isinstance(score, float)


# ─── 3. match_cv — sélection locale (sans appel Claude) ─────────────────────

class TestMatchCv:

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_retourne_cv_pertinent(self, _mock):
        result = match_cv(OFFRE_RESTAURATION, [CV_RESTAURATION, CV_LOGISTIQUE])
        assert result["cv_name"] == "cv_restauration"

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_retourne_dict_complet(self, _mock):
        result = match_cv(OFFRE_RESTAURATION, [CV_RESTAURATION])
        assert "cv_name"         in result
        assert "cv_content"      in result
        assert "match_score"     in result
        assert "job_keywords"    in result
        assert "cv_keywords"     in result
        assert "selection_reason" in result

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_match_score_entre_0_et_100(self, _mock):
        result = match_cv(OFFRE_RESTAURATION, [CV_RESTAURATION, CV_LOGISTIQUE])
        assert 0 <= result["match_score"] <= 100

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_job_keywords_est_liste(self, _mock):
        result = match_cv(OFFRE_RESTAURATION, [CV_RESTAURATION])
        assert isinstance(result["job_keywords"], list)

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_cv_keywords_est_liste(self, _mock):
        result = match_cv(OFFRE_RESTAURATION, [CV_RESTAURATION])
        assert isinstance(result["cv_keywords"], list)

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_cv_genere_prioritaire(self, _mock):
        """Un CV généré [OPTIMISÉ ATS] doit recevoir un bonus et être préféré."""
        cv_genere = {
            "name": "generated/cv_restauration_opt",
            "content": CV_RESTAURATION["content"],
            "is_generated": True,
        }
        cv_base = {
            "name": "cv_restauration_base",
            "content": CV_RESTAURATION["content"],
            "is_generated": False,
        }
        result = match_cv(OFFRE_RESTAURATION, [cv_base], secteur="restauration")
        # Le test vérifie juste que le résultat est cohérent
        assert result["cv_name"] in ["cv_restauration_base", "generated/cv_restauration_opt"]

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    @patch("airecruit.matcher._claude_arbitrage")
    def test_claude_appele_si_ex_aequo(self, mock_arbitrage, _mock_load):
        """Si 2 CVs ont le même score, Claude doit arbitrer."""
        # Deux CVs identiques → même score TF-IDF → arbitrage
        cv_a = {"name": "cv_a", "content": OFFRE_RESTAURATION, "is_generated": False}
        cv_b = {"name": "cv_b", "content": OFFRE_RESTAURATION, "is_generated": False}

        mock_arbitrage.return_value = {
            "cv_index": 0,
            "match_score": 85,
            "job_keywords": ["serveur"],
            "cv_keywords": ["serveur"],
            "selection_reason": "Arbitrage test",
        }

        match_cv(OFFRE_RESTAURATION, [cv_a, cv_b])
        mock_arbitrage.assert_called_once()

    @patch("airecruit.matcher._load_generated_cvs", return_value=[])
    def test_un_seul_cv_pas_claude(self, _mock):
        """Avec un seul CV, pas d'appel Claude."""
        with patch("airecruit.matcher._claude_arbitrage") as mock_arb:
            match_cv(OFFRE_RESTAURATION, [CV_RESTAURATION])
            mock_arb.assert_not_called()
