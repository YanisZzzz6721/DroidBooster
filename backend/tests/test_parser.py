import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from parser import (
    _clean, _parse_contact_inline,
    _parse_experiences_h3, _parse_experiences_bold, _detect_exp_format,
    _parse_competences, _parse_formation, parse_cv,
)

# ── 1. NETTOYAGE ──────────────────────────────────────────────────────────────

class TestClean:
    def test_commentaires_html(self):
        assert "commentaire" not in _clean("<!-- commentaire -->\n# Yanis")
    def test_commentaires_html_multiline(self):
        assert "ligne 1" not in _clean("<!-- ligne 1\nligne 2 -->\n# Yanis")
    def test_backticks(self):
        r = _clean("```markdown\n# Yanis\n```")
        assert "```" not in r and "# Yanis" in r
    def test_commentaires_slash(self):
        r = _clean("# Yanis // commentaire")
        assert "commentaire" not in r and "Yanis" in r
    def test_preserve_https(self):
        assert "https://example.com" in _clean("Voir https://example.com")
    def test_vide(self):
        assert _clean("") == ""

# ── 2. CONTACT INLINE ────────────────────────────────────────────────────────

class TestContactInline:
    def test_pipe(self):
        titre, c = _parse_contact_inline("Hôte | 06 12 34 56 78 | yanis@email.com | Strasbourg")
        assert titre == "Hôte"
        assert c["tel"] == "06 12 34 56 78"
        assert c["email"] == "yanis@email.com"
    def test_point_median(self):
        _, c = _parse_contact_inline("Titre · 06 12 34 56 78 · yanis@email.com")
        assert c["email"] == "yanis@email.com"
    def test_sans_contact(self):
        titre, c = _parse_contact_inline("Hôte d'accueil")
        assert titre == "Hôte d'accueil" and c == {}

# ── 3. EXPÉRIENCES H3 ────────────────────────────────────────────────────────

class TestExperiencesH3:
    LINES = [
        "### Agent — SNCF, Strasbourg",
        "Décembre 2024 – Septembre 2025",
        "- Accueil voyageurs", "- Gestion demandes", "- Enregistrement",
        "",
        "### Vendeur — Banette",
        "Mai 2024 – Novembre 2024",
        "- Accueil", "- Encaissement",
    ]
    def test_nombre(self):      assert len(_parse_experiences_h3(self.LINES)) == 2
    def test_poste(self):       assert _parse_experiences_h3(self.LINES)[0]["poste"] == "Agent"
    def test_entreprise(self):  assert "SNCF" in _parse_experiences_h3(self.LINES)[0]["entreprise"]
    def test_date(self):        assert "Décembre 2024" in _parse_experiences_h3(self.LINES)[0]["date"]
    def test_bullets(self):     assert len(_parse_experiences_h3(self.LINES)[0]["bullets"]) == 3
    def test_vide(self):        assert _parse_experiences_h3([]) == []

# ── 4. EXPÉRIENCES BOLD ──────────────────────────────────────────────────────

class TestExperiencesBold:
    LINES = [
        "**Équipier — BioBurger, Strasbourg**",
        "*Décembre 2024 — Novembre 2025*",
        "- Accueil", "- Nettoyage",
        "**Serveur — La Couronne**",
        "*Août 2023 — Janvier 2024*",
        "- Service",
    ]
    def test_nombre(self):    assert len(_parse_experiences_bold(self.LINES)) == 2
    def test_poste(self):     assert _parse_experiences_bold(self.LINES)[0]["poste"] == "Équipier"
    def test_entreprise(self):assert "BioBurger" in _parse_experiences_bold(self.LINES)[0]["entreprise"]
    def test_date(self):      assert "Décembre 2024" in _parse_experiences_bold(self.LINES)[0]["date"]
    def test_bullets(self):   assert len(_parse_experiences_bold(self.LINES)[0]["bullets"]) == 2

# ── 5. DÉTECTION FORMAT ──────────────────────────────────────────────────────

class TestDetectFormat:
    def test_h3(self):   assert _detect_exp_format(["### Poste", "2024"]) == "h3"
    def test_bold(self): assert _detect_exp_format(["**Poste**", "*2024*"]) == "bold"
    def test_vide(self): assert _detect_exp_format([]) == "h3"

# ── 6. COMPÉTENCES ───────────────────────────────────────────────────────────

class TestCompetences:
    def test_h3_bullets(self):
        items = _parse_competences(["### Accueil", "- bullet 1", "- bullet 2"])
        assert items[0]["label"] == "Accueil" and len(items[0]["bullets"]) == 2

    def test_bold_sans_tiret(self):
        items = _parse_competences(["**Accueil** : Chaleur relationnelle"])
        assert items[0]["label"] == "Accueil" and "Chaleur" in items[0]["description"]

    def test_bullet_bold(self):
        items = _parse_competences(["- **Accueil hôtelier** : accueil physique"])
        assert items[0]["label"] == "Accueil hôtelier"

    def test_plusieurs(self):
        lines = ["**L1** : d1", "**L2** : d2", "**L3** : d3"]
        assert len(_parse_competences(lines)) == 3

    def test_lignes_vides(self):
        assert len(_parse_competences(["", "**Label** : desc", ""])) == 1

    def test_vide(self):
        assert _parse_competences([]) == []

# ── 7. FORMATION ─────────────────────────────────────────────────────────────

class TestFormation:
    def test_h3(self):
        items = _parse_formation(["### Licence — INSA Strasbourg", "2024 – présent"])
        assert items[0]["diplome"] == "Licence"
        assert items[0]["institution"] == "INSA Strasbourg"

    def test_bullet_bold(self):
        items = _parse_formation(["- **Baccalauréat mention Bien** (2022)"])
        assert "Baccalauréat" in items[0]["diplome"]
        assert "2022" in items[0]["date"]

    def test_texte_libre(self):
        items = _parse_formation(["INSA Strasbourg — Ingénieur (depuis 2022)"])
        assert len(items) == 1

    def test_filtre_vides(self):
        assert _parse_formation([""]) == []

# ── 8. PARSE_CV ──────────────────────────────────────────────────────────────

CV1 = """
# Yanis Zouggagh
**Hôte d'accueil — Relation client**

## Objectif
Disponible immédiatement.

## Expériences
### Agent — SNCF, Strasbourg
Décembre 2024 – Septembre 2025
- Accueil voyageurs
- Gestion demandes
- Enregistrement

### Vendeur — Banette
Mai 2024 – Novembre 2024
- Accueil
- Encaissement

## Compétences
- **Accueil** : Orientation, diplomatie
- **Langues** : Français natif, Anglais C1

## Formation et Diplômes
### Licence — INSA Strasbourg
2024 – présent
### Baccalauréat — Mention Bien
2022
"""

CV_H1_INLINE = "# Yanis Zouggagh — Employé restauration / Serveur\n## Profil\nTexte."
CV_COMMENTAIRES = "<!-- commentaire -->\n```markdown\n# Yanis Zouggagh\n**Réceptionniste**\n## Profil\nTexte.\n```"
CV_CONTACT = "# Yanis Zouggagh\n**Réceptionniste** | 06 12 34 56 78 | yanis@email.com\n## Profil\nTexte."

class TestParseCv:
    def test_nom(self):         assert parse_cv(CV1)["nom"] == "Yanis Zouggagh"
    def test_titre(self):       assert "accueil" in parse_cv(CV1)["titre"].lower()
    def test_sections(self):
        types = [s["type"] for s in parse_cv(CV1)["sections"]]
        assert all(t in types for t in ["profil","experiences","competences","formation"])
    def test_nb_experiences(self):
        exp = next(s for s in parse_cv(CV1)["sections"] if s["type"] == "experiences")
        assert len(exp["items"]) == 2
    def test_nb_competences(self):
        comp = next(s for s in parse_cv(CV1)["sections"] if s["type"] == "competences")
        assert len(comp["items"]) == 2
    def test_nb_formation(self):
        form = next(s for s in parse_cv(CV1)["sections"] if s["type"] == "formation")
        assert len(form["items"]) == 2
    def test_bullets_exp(self):
        exp = next(s for s in parse_cv(CV1)["sections"] if s["type"] == "experiences")
        assert len(exp["items"][0]["bullets"]) == 3
        assert len(exp["items"][1]["bullets"]) == 2
    def test_h1_inline(self):
        r = parse_cv(CV_H1_INLINE)
        assert r["nom"] == "Yanis Zouggagh"
        assert r["titre"] != ""
    def test_nettoie_commentaires(self):
        r = parse_cv(CV_COMMENTAIRES)
        assert r["nom"] == "Yanis Zouggagh"
    def test_contact_inline(self):
        r = parse_cv(CV_CONTACT)
        assert r["contact"].get("email") == "yanis@email.com"
    def test_cv_vide(self):
        r = parse_cv("")
        assert r["nom"] == "" and r["sections"] == []
