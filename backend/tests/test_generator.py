"""
Tests unitaires — generator.py
Couvre : _extraire_faits_cv(), _analyse_offre(), _load_letter_examples(),
         _scorer_lettre(), _sauvegarder_lettre_rag(), generate_letter()
"""
import json
import pytest
from unittest.mock import MagicMock, patch, call


# ── Fixtures ──────────────────────────────────────────────────────────────────

OFFRE_STARTUP = """
Nous sommes PayFlow, fintech en forte croissance (Series B).
Nous cherchons un développeur backend Python senior.
Vous maîtrisez FastAPI, PostgreSQL, les architectures microservices.
Vous êtes autonome, orienté impact, à l'aise dans un environnement agile.
"""

CV_CONTENT = """# Jean Dupont
## Expériences
- Développeur Python chez Acme (2022-2024)
- Stage backend chez StartX (2021-2022)
## Compétences
- FastAPI, PostgreSQL, Docker
## Formation
- Master Informatique, Université Paris (2021)
"""

MATCH_RESULT = {
    "cv_name":    "cv_dev_python_jean.md",
    "cv_content": CV_CONTENT,
    "job_keywords": ["FastAPI", "PostgreSQL", "microservices", "Python"],
    "cv_keywords":  ["Python", "backend", "API"],
    "selection_reason": "CV correspond à 90% des critères",
    "preferences_utilisateur": "",
}

ANALYSE_VALIDE = {
    "ton_entreprise":        "startup tech agile en hyper-croissance",
    "valeurs_cles":          ["impact", "autonomie", "agilité"],
    "profil_exact":          "développeur senior Python microservices",
    "points_differenciants": "fintech Series B avec stack moderne",
    "mots_a_eviter":         ["rigoureux", "motivé"],
}

LETTRE_3P = (
    "Phrase 1 paragraphe 1. Phrase 2 paragraphe 1.\n\n"
    "Phrase 1 p2. Phrase 2 p2. Phrase 3 p2. Phrase 4 p2.\n\n"
    "Phrase 1 p3. Phrase 2 p3. Phrase 3 p3. Phrase 4 p3."
)

LETTRE_JSON = json.dumps({"p1": "Phrase 1 p1. Phrase 2 p1.", "p2": "Phrase 1 p2. Phrase 2 p2. Phrase 3 p2. Phrase 4 p2.", "p3": "Phrase 1 p3. Phrase 2 p3. Phrase 3 p3. Phrase 4 p3."})


def _mock_response(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


# ══════════════════════════════════════════════════════════════════════════════
# TestExtraireFaitsCV
# ══════════════════════════════════════════════════════════════════════════════

class TestExtraireFaitsCV:

    def _fn(self):
        from airecruit.generator import _extraire_faits_cv
        return _extraire_faits_cv

    def test_retourne_string(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("- Dev Python chez Acme (2022-2024)")
        result = fn(CV_CONTENT, client)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_utilise_haiku(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("- Fait 1")
        fn(CV_CONTENT, client)
        model = client.messages.create.call_args.kwargs.get("model", "")
        assert "haiku" in model

    def test_max_tokens_limite(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("- Fait 1")
        fn(CV_CONTENT, client)
        max_tok = client.messages.create.call_args.kwargs.get("max_tokens", 9999)
        assert max_tok <= 700

    def test_cv_vide_ne_crash_pas(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("Aucun fait trouvé.")
        result = fn("", client)
        assert isinstance(result, str)


# ══════════════════════════════════════════════════════════════════════════════
# TestAnalyseOffre
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalyseOffre:

    def _fn(self):
        from airecruit.generator import _analyse_offre
        return _analyse_offre

    def test_retourne_cinq_champs(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response(json.dumps(ANALYSE_VALIDE))
        result = fn(OFFRE_STARTUP, client)
        for key in ["ton_entreprise", "valeurs_cles", "profil_exact", "points_differenciants", "mots_a_eviter"]:
            assert key in result

    def test_valeurs_cles_liste(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response(json.dumps(ANALYSE_VALIDE))
        assert isinstance(fn(OFFRE_STARTUP, client)["valeurs_cles"], list)

    def test_json_dans_markdown_fence_parse(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response(f"```json\n{json.dumps(ANALYSE_VALIDE)}\n```")
        result = fn(OFFRE_STARTUP, client)
        assert result["ton_entreprise"] == ANALYSE_VALIDE["ton_entreprise"]

    def test_json_invalide_fallback_dict(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("Texte non JSON")
        result = fn(OFFRE_STARTUP, client)
        assert isinstance(result, dict)
        assert "ton_entreprise" in result

    def test_utilise_haiku(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response(json.dumps(ANALYSE_VALIDE))
        fn(OFFRE_STARTUP, client)
        model = client.messages.create.call_args.kwargs.get("model", "")
        assert "haiku" in model

    def test_max_tokens_econome(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response(json.dumps(ANALYSE_VALIDE))
        fn(OFFRE_STARTUP, client)
        assert client.messages.create.call_args.kwargs.get("max_tokens", 9999) <= 600


# ══════════════════════════════════════════════════════════════════════════════
# TestLoadLetterExamples
# ══════════════════════════════════════════════════════════════════════════════

class TestLoadLetterExamples:

    def test_retourne_liste(self):
        import airecruit.generator as gen
        gen._letters_cache.clear()
        with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
            result = gen._load_letter_examples("secteur_test_unique")
            assert isinstance(result, list)

    def test_cache_utilise_apres_premier_appel(self):
        import airecruit.generator as gen
        # Vide le cache
        gen._letters_cache.clear()

        exemples = [{"content": "Lettre exemple", "score_qualite": 85, "cv_base": "cv.md", "entreprise": "X", "poste": "Dev"}]

        with patch("database.get_letter_examples_by_secteur", return_value=exemples, create=True):
            r1 = gen._load_letter_examples("tech")
            r2 = gen._load_letter_examples("tech")
            assert r1 == r2

    def test_cache_expire_apres_ttl(self):
        import time
        import airecruit.generator as gen
        gen._letters_cache["finance"] = ([], time.time() - 400)  # expiré

        exemples = [{"content": "Lettre finance", "score_qualite": 80, "cv_base": "cv.md", "entreprise": "BNP", "poste": "Analyste"}]
        with patch("database.get_letter_examples_by_secteur", return_value=exemples, create=True):
            result = gen._load_letter_examples("finance")
            assert len(result) == 1


# ══════════════════════════════════════════════════════════════════════════════
# TestScorerLettre
# ══════════════════════════════════════════════════════════════════════════════

class TestScorerLettre:

    def _fn(self):
        from airecruit.generator import _scorer_lettre
        return _scorer_lettre

    def test_retourne_entier(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("87")
        result = fn(LETTRE_3P, OFFRE_STARTUP, client)
        assert isinstance(result, int)

    def test_score_entre_0_et_100(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("92")
        assert 0 <= fn(LETTRE_3P, OFFRE_STARTUP, client) <= 100

    def test_score_trop_grand_clamp_100(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("150")
        assert fn(LETTRE_3P, OFFRE_STARTUP, client) == 100

    def test_erreur_api_retourne_zero(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.side_effect = Exception("API error")
        assert fn(LETTRE_3P, OFFRE_STARTUP, client) == 0

    def test_texte_non_numerique_retourne_zero(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("pas un nombre")
        assert fn(LETTRE_3P, OFFRE_STARTUP, client) == 0

    def test_utilise_haiku(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("80")
        fn(LETTRE_3P, OFFRE_STARTUP, client)
        model = client.messages.create.call_args.kwargs.get("model", "")
        assert "haiku" in model

    def test_max_tokens_minimal(self):
        fn = self._fn()
        client = MagicMock()
        client.messages.create.return_value = _mock_response("80")
        fn(LETTRE_3P, OFFRE_STARTUP, client)
        assert client.messages.create.call_args.kwargs.get("max_tokens", 9999) <= 20


# ══════════════════════════════════════════════════════════════════════════════
# TestSauvegarderLettreRag
# ══════════════════════════════════════════════════════════════════════════════

class TestSauvegarderLettreRag:

    def _fn(self):
        from airecruit.generator import _sauvegarder_lettre_rag
        return _sauvegarder_lettre_rag

    def test_score_sous_75_ne_sauvegarde_pas(self):
        fn = self._fn()
        with patch("database.save_generated_letter", create=True) as mock_save:
            fn("Corps", 74, "tech", "cv.md", {}, None)
            mock_save.assert_not_called()

    def test_score_75_sauvegarde(self):
        fn = self._fn()
        with patch("database.save_generated_letter", return_value=1, create=True) as mock_save:
            fn("Corps", 75, "tech", "cv.md", {"entreprise": "X", "poste": "Dev"}, None)
            mock_save.assert_called_once()

    def test_score_100_sauvegarde(self):
        fn = self._fn()
        with patch("database.save_generated_letter", return_value=1, create=True) as mock_save:
            fn("Corps", 100, "tech", "cv.md", {}, None)
            mock_save.assert_called_once()

    def test_erreur_db_ne_bloque_pas(self):
        fn = self._fn()
        with patch("database.save_generated_letter", side_effect=Exception("DB error"), create=True):
            # Ne doit pas lever d'exception
            fn("Corps", 90, "tech", "cv.md", {}, None)

    def test_invalide_cache_apres_sauvegarde(self):
        import airecruit.generator as gen
        gen._letters_cache["tech"] = ([], 9999999)  # cache peuplé
        fn = self._fn()
        with patch("database.save_generated_letter", return_value=1, create=True):
            fn("Corps", 80, "tech", "cv.md", {}, None)
        assert "tech" not in gen._letters_cache


# ══════════════════════════════════════════════════════════════════════════════
# TestGenerateLetter — pipeline complet
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateLetter:

    def _setup_client(self, mock_anthropic, responses: list):
        client = MagicMock()
        client.messages.create.side_effect = responses
        mock_anthropic.return_value = client
        return client

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_retourne_champs_complets(self, mock_a, mock_meta, mock_docx, tmp_path):
        mock_meta.return_value = {"entreprise": "PayFlow", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        client = self._setup_client(mock_a, [
            _mock_response("- Dev Python chez Acme (2022-2024)"),  # étape 0 : faits CV
            _mock_response(json.dumps(ANALYSE_VALIDE)),             # étape 1 : analyse offre
            _mock_response(LETTRE_JSON),                            # étape 3 : lettre Sonnet
            _mock_response("83"),                                   # étape 4 : score
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", return_value=1, create=True):
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                result = gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        for key in ["corps", "md_path", "docx_path", "metadata", "analyse_offre", "score_qualite", "rag_exemples"]:
            assert key in result

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_quatre_appels_api(self, mock_a, mock_meta, mock_docx, tmp_path):
        """Pipeline complet = 4 appels : faits CV + analyse + lettre + score."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        client = self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response(LETTRE_JSON),
            _mock_response("88"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", return_value=1, create=True):
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        assert client.messages.create.call_count == 4

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_score_qualite_expose(self, mock_a, mock_meta, mock_docx, tmp_path):
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response(LETTRE_JSON),
            _mock_response("91"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", return_value=1, create=True):
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                result = gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        assert result["score_qualite"] == 91

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_rag_exemples_compte(self, mock_a, mock_meta, mock_docx, tmp_path):
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response(LETTRE_JSON),
            _mock_response("80"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        exemples = [{"content": "Exemple lettre", "score_qualite": 85, "cv_base": "cv.md", "entreprise": "X", "poste": "Dev"}]
        with patch("database.save_generated_letter", return_value=1, create=True):
            with patch("database.get_letter_examples_by_secteur", return_value=exemples, create=True):
                result = gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        assert result["rag_exemples"] == 1

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_fichier_md_cree(self, mock_a, mock_meta, mock_docx, tmp_path):
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response(LETTRE_JSON),
            _mock_response("78"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", return_value=1, create=True):
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        md = tmp_path / f"lettre_{MATCH_RESULT['cv_name']}.md"
        assert md.exists()

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_lettre_json_fallback_texte_brut(self, mock_a, mock_meta, mock_docx, tmp_path):
        """Si Sonnet ne renvoie pas de JSON valide, le texte brut est utilisé."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response("Lettre texte brut sans JSON."),
            _mock_response("70"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", return_value=1, create=True):
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                result = gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        assert "corps" in result
        assert len(result["corps"]) > 0

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_score_bas_ne_sauvegarde_pas_rag(self, mock_a, mock_meta, mock_docx, tmp_path):
        """Score < 75 → pas de sauvegarde en DB RAG."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response(LETTRE_JSON),
            _mock_response("60"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", create=True) as mock_save:
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        mock_save.assert_not_called()

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_score_haut_sauvegarde_rag(self, mock_a, mock_meta, mock_docx, tmp_path):
        """Score ≥ 75 → sauvegarde en DB RAG."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": "", "secteur": "tech"}
        mock_docx.return_value = tmp_path / "l.docx"
        self._setup_client(mock_a, [
            _mock_response("- Fait CV"),
            _mock_response(json.dumps(ANALYSE_VALIDE)),
            _mock_response(LETTRE_JSON),
            _mock_response("88"),
        ])
        import airecruit.generator as gen
        gen.OUTPUT_DIR = tmp_path
        with patch("database.save_generated_letter", return_value=1, create=True) as mock_save:
            with patch("database.get_letter_examples_by_secteur", return_value=[], create=True):
                gen.generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        mock_save.assert_called_once()
