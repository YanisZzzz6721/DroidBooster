import typer
from pathlib import Path

from airecruit.parser import load_offer, load_cvs
from airecruit.matcher import match_cv
from airecruit.generator import generate_letter
from airecruit.ats_analyzer import analyze_ats, generate_optimized_cv

app = typer.Typer(help="AIRecruit — Générateur de lettres de motivation par IA")


@app.command(name="init-cvs")
def init_cvs():
    """Crée les 5 CVs Markdown de base dans le dossier cvs/."""

    cvs_dir = Path("cvs")
    cvs_dir.mkdir(exist_ok=True)

    cvs = {
        "cv_restauration.md": {
            "titre": "Étudiant ingénieur disponible en restauration rapide",
            "objectif": "Recherche d'un poste d'équipier polyvalent en restauration indépendante dans le cadre d'une année sabbatique. Rigoureux, rapide à l'apprentissage et habitué à travailler sous cadence.",
            "mots_cles": "restauration rapide, équipier polyvalent, service client, caisse, hygiène alimentaire, HACCP, cadence, travail en équipe, polyvalence, année sabbatique",
        },
        "cv_accueil.md": {
            "titre": "Étudiant ingénieur — Profil accueil et relation client",
            "objectif": "Candidature à des postes d'hôte d'accueil ou d'agent d'accueil en hôtel, entreprise ou grande structure (type SNCF) dans le cadre d'une année sabbatique. Présentation soignée, aisance relationnelle, sérieux.",
            "mots_cles": "accueil, réception, relation client, standard téléphonique, hôtel, entreprise, SNCF, présentation, organisation, aisance relationnelle, gestion agenda",
        },
        "cv_animation.md": {
            "titre": "Animateur BAFA — Centre de loisirs, périscolaire, surveillance",
            "objectif": "Animateur titulaire du BAFA avec expérience en centre de loisirs, école, collège et cours périscolaires à domicile. Disponible pour des missions d'animation, de surveillance ou d'accompagnement éducatif.",
            "mots_cles": "BAFA, animation, centre de loisirs, périscolaire, surveillance, collège, école, enfants, adolescents, encadrement, pédagogie, activités, accompagnement éducatif",
        },
        "cv_distribution.md": {
            "titre": "Étudiant ingénieur — Employé polyvalent grande distribution",
            "objectif": "Recherche d'un poste d'employé libre-service, caissier ou agent de rayon en hypermarché (Leclerc, Carrefour, Lidl) dans le cadre d'une année sabbatique. Rigoureux, ponctuel et à l'aise avec le travail en équipe.",
            "mots_cles": "grande distribution, employé libre-service, mise en rayon, caisse, inventaire, gestion des stocks, facing, relation client, Leclerc, Carrefour, Lidl, hypermarché, polyvalence",
        },
        "cv_logistique.md": {
            "titre": "Étudiant ingénieur — Agent polyvalent logistique et industrie",
            "objectif": "Disponible pour des missions en intérim dans les secteurs de la logistique de quai, manutention, agent d'usine ou ouvrier polyvalent. Profil sérieux, physiquement disponible, habitué aux environnements exigeants.",
            "mots_cles": "logistique, manutention, agent d'usine, ouvrier polyvalent, logistique de quai, intérim, entrepôt, gestion des stocks, rigueur, réactivité, environnement industriel",
        },
    }

    template = """---
titre: {titre}
objectif: {objectif}
mots_cles: {mots_cles}
---

# {titre}

## Objectif
{objectif}

## Expériences
À compléter : liste tes expériences pertinentes pour ce domaine.

## Compétences
À compléter : liste tes compétences clés pour ce domaine.

## Formation
À compléter : diplômes, certifications, BAFA, permis...
"""

    created = []
    skipped = []

    for filename, data in cvs.items():
        path = cvs_dir / filename
        if path.exists():
            skipped.append(filename)
            continue
        path.write_text(template.format(**data), encoding="utf-8")
        created.append(filename)

    if created:
        typer.echo(f"\n✓ CVs créés dans cvs/ :")
        for f in created:
            typer.echo(f"  - {f}")

    if skipped:
        typer.echo(f"\n⚠  Déjà existants (non écrasés) :")
        for f in skipped:
            typer.echo(f"  - {f}")

    typer.echo("\nOuvre chaque fichier dans VSCode et remplis tes expériences !")


@app.command()
def match(
    offer: str = typer.Argument(..., help="Chemin vers l'offre d'emploi (PDF ou TXT)"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Affiche le CV sélectionné sans générer la lettre"),
):
    """Sélectionne le meilleur CV pour une offre donnée."""
    try:
        typer.echo(f"\n🔍 Chargement de l'offre : {offer}")
        offer_text = load_offer(offer)

        typer.echo("📂 Chargement des CVs...")
        cvs = load_cvs("cvs")

        typer.echo("🤖 Analyse en cours...")
        result = match_cv(offer_text, cvs)

        typer.echo(f"\n{'=' * 50}")
        typer.echo(f"  CV sélectionné  : {result['cv_name']}")
        typer.echo(f"  Score de match  : {result['match_score']}/100")
        typer.echo(f"  Mots-clés offre : {', '.join(result['job_keywords'])}")
        typer.echo(f"  Points forts CV : {', '.join(result['cv_keywords'])}")
        typer.echo(f"  Raison          : {result['selection_reason']}")
        typer.echo(f"{'=' * 50}")

        if dry_run:
            typer.echo("\n[dry-run] Lettre non générée.")
        else:
            typer.echo("\nPour générer la lettre : airecruit run <offre>")

    except (FileNotFoundError, ValueError) as e:
        typer.echo(f"\n❌ Erreur : {e}", err=True)
        raise typer.Exit(code=1)


@app.command()
def run(
    offer: str = typer.Argument(..., help="Chemin vers l'offre d'emploi (PDF ou TXT)"),
):
    """Pipeline complet : matching + génération de lettre + analyse ATS."""
    try:
        typer.echo(f"\n🚀 Démarrage du pipeline AIRecruit")
        typer.echo(f"   Offre : {offer}\n")

        typer.echo("[1/4] 🔍 Chargement de l'offre...")
        offer_text = load_offer(offer)

        typer.echo("[2/4] 📂 Chargement des CVs...")
        cvs = load_cvs("cvs")

        typer.echo("[3/4] 🤖 Sélection du meilleur CV...")
        match_result = match_cv(offer_text, cvs)
        typer.echo(f"      ✓ CV sélectionné : {match_result['cv_name']} ({match_result['match_score']}/100)")

        typer.echo("[4/4] ✍️  Génération de la lettre de motivation...")
        letter = generate_letter(match_result, offer_text)
        typer.echo(f"      ✓ Markdown : {letter['md_path']}")
        typer.echo(f"      ✓ Word     : {letter['docx_path']}")

        typer.echo("[+]   📊 Analyse ATS...")
        ats_result = analyze_ats(offer_text, match_result)
        typer.echo(f"      ✓ Score ATS : {ats_result['score']}/100")
        typer.echo(f"      ✓ Rapport   : {ats_result['report_path']}")

        typer.echo("[+]   📝 Génération du CV optimisé...")
        cv_path, pdf_path = generate_optimized_cv(offer_text, match_result, ats_result)
        typer.echo(f"      ✓ CV Markdown : {cv_path}")
        if pdf_path:
            typer.echo(f"      ✓ CV PDF      : {pdf_path}")
        else:
            typer.echo("      ⚠️  PDF non généré — pip install weasyprint")

        typer.echo(f"\n{'=' * 50}")
        typer.echo("  ✅ Pipeline terminé avec succès !")
        typer.echo(f"{'=' * 50}\n")

    except (FileNotFoundError, ValueError) as e:
        typer.echo(f"\n❌ Erreur : {e}", err=True)
        raise typer.Exit(code=1)


@app.command()
def ats(
    offer: str = typer.Argument(..., help="Chemin vers l'offre d'emploi (PDF ou TXT)"),
):
    """Analyse ATS uniquement : score, mots-clés et suggestions d'amélioration du CV."""
    try:
        typer.echo(f"\n📊 Analyse ATS — {offer}\n")

        typer.echo("🔍 Chargement de l'offre...")
        offer_text = load_offer(offer)

        typer.echo("📂 Chargement des CVs...")
        cvs = load_cvs("cvs")

        typer.echo("🤖 Sélection du meilleur CV...")
        match_result = match_cv(offer_text, cvs)
        typer.echo(f"   ✓ CV sélectionné : {match_result['cv_name']}\n")

        typer.echo("📊 Analyse ATS en cours...")
        analysis = analyze_ats(offer_text, match_result)

        typer.echo("📝 Génération du CV optimisé...")
        cv_path, pdf_path = generate_optimized_cv(offer_text, match_result, analysis)

        typer.echo(f"\n{'=' * 50}")
        typer.echo(f"  SCORE ATS       : {analysis['score']}/100")
        typer.echo(f"  Mots-clés ✅    : {len(analysis['keywords_found'])} présents")
        typer.echo(f"  Mots-clés ❌    : {len(analysis['keywords_missing'])} manquants")
        typer.echo(f"  Suggestions 💡  : {len(analysis['suggestions'])}")
        typer.echo(f"{'=' * 50}")
        typer.echo(f"\n📄 Rapport ATS    : {analysis['report_path']}")
        typer.echo(f"📄 CV Markdown    : {cv_path}")
        if pdf_path:
            typer.echo(f"🎨 CV PDF         : {pdf_path}")
        else:
            typer.echo("⚠️  PDF non généré — installe weasyprint : pip install weasyprint")
        typer.echo("")

    except (FileNotFoundError, ValueError) as e:
        typer.echo(f"\n❌ Erreur : {e}", err=True)
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()