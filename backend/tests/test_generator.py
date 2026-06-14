"""
Tests unitaires — generator.py
Couvre : _analyse_offre(), generate_letter()
"""
import json
import pytest
from unittest.mock import MagicMock, patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

OFFRE_STARTUP = """
Nous sommes PayFlow, fintech en forte croissance (Series B).
Nous cherchons un développeur backend Python senior.
Vous maîtrisez FastAPI, PostgreSQL, les architectures microservices.
Vous êtes autonome, orienté impact, à l'aise dans un environnement agile.
"""

OFFRE_CABINET = """
Cabinet d'avocats international recrute un juriste confirmé.
Expérience de 5 ans minimum en droit des affaires.
Rigueur, précision et sens du détail indispensables.
Maîtrise de l'anglais juridique requise.
"""

MATCH_RESULT = {
    "cv_name":    "cv_dev_python_jean.md",
    "cv_content": "# Jean Dupont\n## Expériences\n- Dev Python chez Acme (2022-2024)\n## Compétences\n- FastAPI, PostgreSQL",
    "job_keywords": ["FastAPI", "PostgreSQL", "microservices", "Python"],
    "cv_keywords":  ["Python", "backend", "API"],
    "selection_reason": "CV correspond à 90% des critères de l'offre",
    "preferences_utilisateur": "",
}

ANALYSE_VALIDE = {
    "ton_entreprise":        "startup tech agile en hyper-croissance",
    "valeurs_cles":          ["impact", "autonomie", "agilité"],
    "profil_exact":          "développeur senior Python avec expérience microservices",
    "points_differenciants": "fintech Series B avec stack moderne et équipe internationale",
    "mots_a_eviter":         ["rigoureux", "motivé"],
}


def _make_haiku_response(content: str) -> MagicMock:
    """Crée un mock de réponse Anthropic."""
    msg = MagicMock()
    msg.content = [MagicMock(text=content)]
    return msg


def _make_sonnet_response(text: str = "§1 phrase.\n\n§2 phrase1. §2 phrase2. §2 phrase3. §2 phrase4.\n\n§3 phrase1. §3 phrase2. §3 phrase3. §3 phrase4.") -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


# ══════════════════════════════════════════════════════════════════════════════
# TestAnalyseOffre
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalyseOffre:
    """Tests pour _analyse_offre() — agent Haiku."""

    def _get_fn(self):
        from airecruit.generator import _analyse_offre
        return _analyse_offre

    def test_retourne_dict_avec_tous_les_champs(self):
        """Le résultat contient les 5 champs attendus."""
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response(json.dumps(ANALYSE_VALIDE))

        result = fn(OFFRE_STARTUP, client)

        assert "ton_entreprise" in result
        assert "valeurs_cles" in result
        assert "profil_exact" in result
        assert "points_differenciants" in result
        assert "mots_a_eviter" in result

    def test_valeurs_cles_est_une_liste(self):
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response(json.dumps(ANALYSE_VALIDE))

        result = fn(OFFRE_STARTUP, client)
        assert isinstance(result["valeurs_cles"], list)

    def test_mots_a_eviter_est_une_liste(self):
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response(json.dumps(ANALYSE_VALIDE))

        result = fn(OFFRE_STARTUP, client)
        assert isinstance(result["mots_a_eviter"], list)

    def test_json_avec_markdown_fence_est_parse(self):
        """Si Haiku retourne ```json ... ```, le fallback regex extrait quand même le JSON."""
        fn = self._get_fn()
        client = MagicMock()
        wrapped = f"```json\n{json.dumps(ANALYSE_VALIDE)}\n```"
        client.messages.create.return_value = _make_haiku_response(wrapped)

        result = fn(OFFRE_STARTUP, client)
        assert result["ton_entreprise"] == ANALYSE_VALIDE["ton_entreprise"]

    def test_json_invalide_retourne_fallback(self):
        """Si Haiku renvoie du texte non parsable, on obtient un dict de fallback."""
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response("Je ne suis pas du JSON.")

        result = fn(OFFRE_STARTUP, client)
        assert isinstance(result, dict)
        assert "ton_entreprise" in result
        assert isinstance(result["valeurs_cles"], list)

    def test_utilise_modele_haiku(self):
        """Vérifie que Haiku est utilisé (pas Sonnet) pour l'analyse."""
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response(json.dumps(ANALYSE_VALIDE))

        fn(OFFRE_STARTUP, client)

        call_kwargs = client.messages.create.call_args
        assert "haiku" in call_kwargs.kwargs.get("model", call_kwargs.args[0] if call_kwargs.args else "")

    def test_max_tokens_economique(self):
        """Haiku doit utiliser peu de tokens pour rester économique."""
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response(json.dumps(ANALYSE_VALIDE))

        fn(OFFRE_STARTUP, client)

        call_kwargs = client.messages.create.call_args
        max_tokens = call_kwargs.kwargs.get("max_tokens", 9999)
        assert max_tokens <= 600, f"Trop de tokens pour Haiku : {max_tokens}"

    def test_offre_vide_ne_crash_pas(self):
        """Même avec une offre vide, pas d'exception."""
        fn = self._get_fn()
        client = MagicMock()
        client.messages.create.return_value = _make_haiku_response(json.dumps(ANALYSE_VALIDE))

        result = fn("", client)
        assert isinstance(result, dict)

    def test_offre_cabinet_donne_ton_different(self):
        """Test avec une offre institutionnelle — le contenu doit varier."""
        fn = self._get_fn()
        client = MagicMock()
        analyse_cabinet = {**ANALYSE_VALIDE, "ton_entreprise": "cabinet juridique institutionnel"}
        client.messages.create.return_value = _make_haiku_response(json.dumps(analyse_cabinet))

        result = fn(OFFRE_CABINET, client)
        assert "cabinet" in result["ton_entreprise"].lower() or result["ton_entreprise"] != ""


# ══════════════════════════════════════════════════════════════════════════════
# TestGenerateLetter
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateLetter:
    """Tests pour generate_letter() — pipeline complet 2 étapes."""

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_retourne_les_champs_attendus(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        mock_meta.return_value = {"entreprise": "PayFlow", "poste": "Dev Python", "adresse": "Paris"}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        # Premier appel = Haiku (analyse), deuxième = Sonnet (lettre)
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        result = generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        assert "corps" in result
        assert "md_path" in result
        assert "docx_path" in result
        assert "metadata" in result
        assert "analyse_offre" in result

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_analyse_offre_exposee_dans_resultat(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Le résultat doit exposer l'analyse de l'offre pour le debug/frontend."""
        mock_meta.return_value = {"entreprise": "PayFlow", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        result = generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        assert result["analyse_offre"]["ton_entreprise"] == ANALYSE_VALIDE["ton_entreprise"]
        assert result["analyse_offre"]["valeurs_cles"] == ANALYSE_VALIDE["valeurs_cles"]

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_deux_appels_api_effectues(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Le pipeline doit faire exactement 2 appels API : Haiku puis Sonnet."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        assert client.messages.create.call_count == 2

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_haiku_appele_en_premier(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Le premier appel doit utiliser Haiku."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        first_call = client.messages.create.call_args_list[0]
        model_used = first_call.kwargs.get("model", "")
        assert "haiku" in model_used

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_sonnet_appele_en_second(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Le deuxième appel doit utiliser Sonnet."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        second_call = client.messages.create.call_args_list[1]
        model_used = second_call.kwargs.get("model", "")
        assert "sonnet" in model_used

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_analyse_integree_dans_prompt_sonnet(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Le prompt envoyé à Sonnet doit contenir les infos de l'analyse Haiku."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        second_call = client.messages.create.call_args_list[1]
        messages = second_call.kwargs.get("messages", [])
        full_prompt = str(messages)

        assert "startup tech agile" in full_prompt or "ton_entreprise" in full_prompt or "ANALYSE" in full_prompt

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_preferences_utilisateur_incluses(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Les préférences utilisateur doivent apparaître dans le prompt Sonnet."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        match_with_prefs = {**MATCH_RESULT, "preferences_utilisateur": "Insiste sur la rigueur"}
        generate_letter(match_with_prefs, OFFRE_STARTUP)

        second_call = client.messages.create.call_args_list[1]
        messages = second_call.kwargs.get("messages", [])
        assert "Insiste sur la rigueur" in str(messages)

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_fichier_md_cree(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Un fichier .md doit être créé dans OUTPUT_DIR."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response(json.dumps(ANALYSE_VALIDE)),
            _make_sonnet_response("Corps de la lettre test."),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        result = generate_letter(MATCH_RESULT, OFFRE_STARTUP)

        md = tmp_path / f"lettre_{MATCH_RESULT['cv_name']}.md"
        assert md.exists()
        assert md.read_text() == "Corps de la lettre test."

    @patch("airecruit.generator._inject_docx")
    @patch("airecruit.generator.extract_offer_metadata")
    @patch("airecruit.generator.anthropic.Anthropic")
    def test_haiku_json_invalide_ne_bloque_pas_sonnet(self, mock_anthropic, mock_meta, mock_docx, tmp_path):
        """Si Haiku renvoie du JSON invalide, le pipeline continue avec le fallback."""
        mock_meta.return_value = {"entreprise": "Test", "poste": "Dev", "adresse": ""}
        mock_docx.return_value = tmp_path / "lettre.docx"

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_haiku_response("TEXTE INVALIDE SANS JSON"),
            _make_sonnet_response(),
        ]
        mock_anthropic.return_value = client

        from airecruit.generator import generate_letter
        import airecruit.generator as gen_module
        gen_module.OUTPUT_DIR = tmp_path

        # Ne doit pas lever d'exception
        result = generate_letter(MATCH_RESULT, OFFRE_STARTUP)
        assert "corps" in result
