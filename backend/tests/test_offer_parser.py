"""
test_offer_parser.py — Tests unitaires du module offer_parser.py
Couvre : _detect_secteur, _extract_regex, extract_offer_metadata (sans appel Claude)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))

import pytest
from unittest.mock import patch, MagicMock
from airecruit.offer_parser import (
    _detect_secteur,
    _extract_regex,
    extract_offer_metadata,
    SECTEURS,
)


# ─── Fixtures offres ─────────────────────────────────────────────────────────

OFFRE_RESTAURATION = """
Poste : Serveur H/F
Entreprise : Brasserie du Marché
Nous recherchons un serveur expérimenté pour notre brasserie.
Service en salle, accueil client, prise de commandes, bar.
"""

OFFRE_ACCUEIL = """
Poste : Hôte d'accueil
Entreprise : SNCF Gare de Strasbourg
Agent d'accueil en gare, réceptionniste, relation client, standard téléphonique.
"""

OFFRE_LOGISTIQUE = """
Poste : Préparateur de commandes
Entreprise : Amazon Fulfillment
Préparateur commandes entrepôt, manutention, stock, expédition, réception.
"""

OFFRE_DISTRIBUTION = """
Poste : Employé libre-service H/F
Entreprise : Carrefour Strasbourg
Mise en rayon, caissier, grande distribution, hypermarché.
"""

OFFRE_INFORMATIQUE = """
Poste : Développeur Fullstack
Entreprise : TechCorp
Python, JavaScript, backend, frontend, DevOps, data, machine learning.
"""

OFFRE_INCONNUE = """
Sculpteur de cristal sur commande, atelier artisanal de luxe.
Aucun mot-clé sectoriel reconnu dans cette annonce.
"""

OFFRE_AVEC_ADRESSE = """
Poste : Serveur H/F
Entreprise : Le Grand Café
12 rue de la Paix 67000 Strasbourg
"""


# ─── 1. _detect_secteur ──────────────────────────────────────────────────────

class TestDetectSecteur:

    def test_restauration(self):
        assert _detect_secteur(OFFRE_RESTAURATION) == "restauration"

    def test_accueil(self):
        assert _detect_secteur(OFFRE_ACCUEIL) == "accueil"

    def test_logistique(self):
        assert _detect_secteur(OFFRE_LOGISTIQUE) == "logistique"

    def test_distribution(self):
        assert _detect_secteur(OFFRE_DISTRIBUTION) == "distribution"

    def test_informatique(self):
        assert _detect_secteur(OFFRE_INFORMATIQUE) == "informatique"

    def test_inconnu_retourne_autre(self):
        assert _detect_secteur(OFFRE_INCONNUE) == "autre"

    def test_offre_vide_retourne_autre(self):
        assert _detect_secteur("") == "autre"

    def test_poste_aide_detection(self):
        # Le poste "barman" doit aider à détecter restauration
        assert _detect_secteur("cherche quelqu'un de dynamique", "barman") == "restauration"

    def test_retourne_str(self):
        assert isinstance(_detect_secteur(OFFRE_RESTAURATION), str)

    def test_secteur_dans_liste_connue(self):
        secteur = _detect_secteur(OFFRE_RESTAURATION)
        assert secteur in SECTEURS


# ─── 2. _extract_regex ───────────────────────────────────────────────────────

class TestExtractRegex:

    def test_extrait_poste(self):
        result = _extract_regex(OFFRE_RESTAURATION)
        assert result["poste"] == "Serveur H/F"

    def test_extrait_entreprise(self):
        result = _extract_regex(OFFRE_RESTAURATION)
        assert "Brasserie" in result["entreprise"]

    def test_extrait_adresse(self):
        result = _extract_regex(OFFRE_AVEC_ADRESSE)
        assert "Strasbourg" in result["adresse"] or result["adresse"] != ""

    def test_retourne_dict_complet(self):
        result = _extract_regex(OFFRE_RESTAURATION)
        assert "poste" in result
        assert "entreprise" in result
        assert "adresse" in result

    def test_offre_sans_structure_retourne_vide(self):
        result = _extract_regex("Texte libre sans structure claire ni label.")
        assert result["poste"] == "" or result["entreprise"] == ""

    def test_offre_vide(self):
        result = _extract_regex("")
        assert result == {"poste": "", "entreprise": "", "adresse": ""}


# ─── 3. extract_offer_metadata ───────────────────────────────────────────────

class TestExtractOfferMetadata:

    def test_retourne_secteur(self):
        result = extract_offer_metadata(OFFRE_RESTAURATION)
        assert "secteur" in result

    def test_secteur_restauration(self):
        result = extract_offer_metadata(OFFRE_RESTAURATION)
        assert result["secteur"] == "restauration"

    def test_secteur_accueil(self):
        result = extract_offer_metadata(OFFRE_ACCUEIL)
        assert result["secteur"] == "accueil"

    def test_dict_contient_tous_champs(self):
        result = extract_offer_metadata(OFFRE_RESTAURATION)
        for champ in ["poste", "entreprise", "adresse", "secteur"]:
            assert champ in result

    def test_poste_extrait(self):
        result = extract_offer_metadata(OFFRE_RESTAURATION)
        assert result["poste"] != ""

    def test_entreprise_extrait(self):
        result = extract_offer_metadata(OFFRE_RESTAURATION)
        assert result["entreprise"] != ""

    @patch("airecruit.offer_parser._detect_secteur_claude", return_value="animation")
    @patch("airecruit.offer_parser._extract_claude", return_value={"poste": "Sculpteur", "entreprise": "Atelier", "adresse": ""})
    def test_fallback_claude_si_autre(self, mock_extract, mock_claude):
        """Si keywords → 'autre', _detect_secteur_claude est appelé."""
        result = extract_offer_metadata(OFFRE_INCONNUE)
        mock_claude.assert_called_once()
        assert result["secteur"] == "animation"

    @patch("airecruit.offer_parser._detect_secteur_claude")
    def test_pas_de_fallback_si_secteur_detecte(self, mock_claude):
        """Si keywords trouvent un secteur, Claude NE doit PAS être appelé."""
        extract_offer_metadata(OFFRE_RESTAURATION)
        mock_claude.assert_not_called()

    @patch("airecruit.offer_parser._extract_claude")
    def test_regex_suffisant_pas_claude(self, mock_claude):
        """Si le regex trouve poste + entreprise, Claude ne doit pas être appelé."""
        extract_offer_metadata(OFFRE_RESTAURATION)
        mock_claude.assert_not_called()

    @patch("airecruit.offer_parser._detect_secteur_claude", return_value="autre")
    @patch("airecruit.offer_parser._extract_claude", return_value={
        "poste": "", "entreprise": "", "adresse": ""
    })
    def test_claude_appele_si_regex_echoue(self, mock_extract, mock_detect):
        """Si regex ne trouve ni poste ni entreprise, _extract_claude prend le relais."""
        extract_offer_metadata(OFFRE_INCONNUE)
        mock_extract.assert_called_once()
