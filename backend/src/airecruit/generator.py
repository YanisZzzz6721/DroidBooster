"""
generator.py — Pipeline lettre de motivation en 4 étapes

Étape 0 : Haiku extrait les FAITS VÉRIFIABLES du CV (stoppe les hallucinations)
Étape 1 : Haiku analyse l'offre (ton, valeurs, profil exact, mots à éviter)
Étape 2 : RAG — charge les meilleures lettres passées du même secteur
Étape 3 : Sonnet génère la lettre en JSON structuré (p1/p2/p3)
Étape 4 : Haiku note la qualité (0-100) → sauvegarde en DB si score ≥ 75
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from docx import Document

from airecruit.offer_parser import extract_offer_metadata

load_dotenv()

OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"

# Cache mémoire pour les exemples de lettres (TTL 5 min)
_letters_cache: dict[str, tuple[list, float]] = {}
_CACHE_TTL = 300


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 0 — Extraction faits CV (Haiku) — anti-hallucination
# ══════════════════════════════════════════════════════════════════

def _extraire_faits_cv(cv_content: str, client: anthropic.Anthropic) -> str:
    """
    Haiku lit le CV brut et retourne UNIQUEMENT les faits vérifiables :
    postes, entreprises, dates exactes, compétences explicitement mentionnées.
    Rien d'autre. Aucune interprétation. Aucune inférence.
    """
    prompt = f"""Lis ce CV et extrais UNIQUEMENT les faits vérifiables, sous forme de liste.

Règles STRICTES :
- Copie uniquement ce qui est écrit mot pour mot dans le CV
- Pas d'interprétation, pas d'inférence, pas d'ajout
- Format : une ligne par fait, commençant par "- "
- Catégories : EXPÉRIENCES (poste | entreprise — sans les dates), COMPÉTENCES, FORMATIONS, RÉALISATIONS CONCRÈTES
- NE PAS inclure les dates, années ou durées — elles ne doivent jamais apparaître dans la lettre

Si une information n'est pas dans le CV → ne l'écris pas.

=== CV ===
{cv_content}"""

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 1 — Analyse de l'offre (Haiku)
# ══════════════════════════════════════════════════════════════════

def _analyse_offre(offer: str, client: anthropic.Anthropic) -> dict:
    """
    Extrait le ton, la culture, le profil exact et les pièges à éviter.
    Retourne un dict JSON structuré.
    """
    prompt = f"""Analyse cette offre d'emploi et retourne un JSON strict avec ces 5 champs :

{{
  "ton_entreprise": "description courte du ton/style (ex: startup tech agile, cabinet institutionnel, PME familiale...)",
  "valeurs_cles": ["valeur1", "valeur2", "valeur3"],
  "profil_exact": "description précise du candidat idéal selon l'offre (1-2 phrases)",
  "points_differenciants": "ce qui rend cette entreprise unique dans son secteur (1 phrase)",
  "mots_a_eviter": ["mot1", "mot2"]
}}

Règles :
- "ton_entreprise" : 1 phrase courte et concrète
- "valeurs_cles" : exactement 3 valeurs tirées du texte
- "profil_exact" : basé uniquement sur l'offre
- "mots_a_eviter" : 2-4 mots génériques ou inadaptés au contexte

Réponds UNIQUEMENT avec le JSON, sans markdown, sans explication.

=== OFFRE ===
{offer}"""

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {
        "ton_entreprise":        "entreprise professionnelle",
        "valeurs_cles":          [],
        "profil_exact":          "",
        "points_differenciants": "",
        "mots_a_eviter":         [],
    }


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 2 — RAG : charge les meilleures lettres passées
# ══════════════════════════════════════════════════════════════════

def _load_letter_examples(secteur: str) -> list[dict]:
    """
    Charge les meilleures lettres du même secteur depuis la DB.
    Cache mémoire 5 min pour éviter les appels DB répétés.
    """
    import time
    now = time.time()

    if secteur in _letters_cache:
        examples, ts = _letters_cache[secteur]
        if now - ts < _CACHE_TTL:
            return examples

    try:
        from database import get_letter_examples_by_secteur
        examples = get_letter_examples_by_secteur(secteur, max_examples=2, min_score=75)
    except Exception:
        examples = []

    _letters_cache[secteur] = (examples, now)
    return examples


def _format_rag_examples(examples: list[dict]) -> str:
    """Formate les exemples RAG pour injection dans le prompt."""
    if not examples:
        return ""
    lines = ["\n=== EXEMPLES DE LETTRES RÉUSSIES (même secteur, score ≥ 75) ==="]
    lines.append("Inspire-toi du style, de la structure et de la densité — pas du contenu.\n")
    for i, ex in enumerate(examples, 1):
        score = ex.get("score_qualite", "?")
        entreprise = ex.get("entreprise", "")
        header = f"--- Exemple {i} (score {score}/100{f' — {entreprise}' if entreprise else ''}) ---"
        lines.append(header)
        lines.append(ex["content"])
        lines.append("")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 3 — Génération lettre (Sonnet) en JSON structuré
# ══════════════════════════════════════════════════════════════════

def _generer_lettre_sonnet(
    faits_cv:     str,
    analyse:      dict,
    rag_section:  str,
    match_result: dict,
    offer:        str,
    preferences:  str,
    client:       anthropic.Anthropic,
) -> str:
    """
    Génère la lettre via Sonnet avec sortie JSON structurée p1/p2/p3.
    Garantit la structure même si le modèle dévie.
    """
    valeurs_str        = ", ".join(analyse.get("valeurs_cles", [])) or "non détectées"
    eviter_str         = ", ".join(analyse.get("mots_a_eviter", [])) or "aucun"
    ton_str            = analyse.get("ton_entreprise", "")
    profil_str         = analyse.get("profil_exact", "")
    differenciants_str = analyse.get("points_differenciants", "")
    prefs_section      = f"\n=== PRÉFÉRENCES UTILISATEUR ===\n{preferences}\n" if preferences else ""

    prompt = f"""Tu es un expert en lettres de motivation ATS. Génère une lettre en 3 paragraphes.

Retourne UNIQUEMENT ce JSON (sans markdown) :
{{"p1": "paragraphe 1", "p2": "paragraphe 2", "p3": "paragraphe 3"}}

=== ANALYSE DE L'ENTREPRISE ===
Ton : {ton_str}
Valeurs : {valeurs_str}
Profil recherché : {profil_str}
Différenciant : {differenciants_str}
Mots interdits : {eviter_str}

=== FAITS VÉRIFIABLES DU CV (n'invente rien d'autre) ===
{faits_cv}

=== STRUCTURE OBLIGATOIRE ===
p1 (2-3 phrases) : Qui est le candidat + pourquoi ce poste + ce qui l'attire dans CETTE entreprise (la nommer).
p2 (4 phrases exactement) : Faits concrets du CV, expériences citées dans l'ordre le plus récent en premier + mots-clés ATS intégrés naturellement.
p3 (4 phrases exactement) : Valeur ajoutée spécifique + disponibilité + ouverture entretien (nommer l'entreprise).

=== RÈGLES ABSOLUES ===
- Ne jamais commencer par "Vous", "Je suis", "Suite à", "Actuellement", "Passionné"
- Première personne uniquement (je, mon, mes) — jamais le prénom
- Aucune mise en forme : pas de liste, pas de gras, pas de titre
- Pas de formule d'appel ni de signature
- Jamais inventer une compétence absente des FAITS VÉRIFIABLES ci-dessus
- INTERDIT ABSOLU : ne jamais citer de dates, d'années, de mois ou de périodes (pas de "de 2022 à 2024", pas de "en 2023", pas de "depuis X ans", pas de "pendant 2 ans"). Les dates appartiennent au CV, pas à la lettre.
- Parler des expériences par leur nature et leur impact, jamais par leur durée ou leurs dates
- Nommer l'entreprise dans p1 ET dans p3
- Zéro mot interdit de la liste ci-dessus
- Adapter le registre au ton de l'entreprise détecté
- Chaque phrase doit apporter une information nouvelle — zéro redondance entre p1, p2 et p3
{rag_section}

=== OFFRE D'EMPLOI ===
{offer}

=== MOTS-CLÉS ATS À INTÉGRER (forme exacte) ===
{', '.join(match_result.get('job_keywords', []))}

=== RAISON DU MATCH ===
{match_result.get('selection_reason', '')}
{prefs_section}"""

    cv_block = {
        "type": "text",
        "text": f"=== CV : {match_result['cv_name']} ===\n{match_result['cv_content']}",
        "cache_control": {"type": "ephemeral"},
    }

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": [cv_block, {"type": "text", "text": prompt}]}],
    )

    raw = response.content[0].text.strip()

    # Parse JSON structuré
    try:
        data = json.loads(raw)
        return f"{data['p1']}\n\n{data['p2']}\n\n{data['p3']}"
    except (json.JSONDecodeError, KeyError):
        # Fallback : regex pour extraire le JSON
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group())
                return f"{data.get('p1','')}\n\n{data.get('p2','')}\n\n{data.get('p3','')}".strip()
            except (json.JSONDecodeError, KeyError):
                pass
        # Dernier fallback : texte brut
        return raw


# ══════════════════════════════════════════════════════════════════
# ÉTAPE 4 — Score qualité (Haiku) + sauvegarde RAG
# ══════════════════════════════════════════════════════════════════

def _scorer_lettre(corps: str, offer: str, client: anthropic.Anthropic) -> int:
    """
    Haiku note la lettre de 0 à 100 sur 4 critères :
    structure (25), faits concrets (25), ATS (25), ton (25).
    Retourne le score entier.
    """
    prompt = f"""Note cette lettre de motivation de 0 à 100.

Critères (25 pts chacun) :
1. Structure : exactement 3 paragraphes, longueurs respectées
2. Faits concrets : expériences réelles, pas de généralités
3. ATS : mots-clés de l'offre intégrés naturellement
4. Ton : adapté à l'entreprise, direct, humain

Réponds UNIQUEMENT avec un entier entre 0 et 100. Rien d'autre.

=== OFFRE ===
{offer[:500]}

=== LETTRE ===
{corps}"""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )
        score_str = response.content[0].text.strip()
        score = int(re.search(r'\d+', score_str).group())
        return min(100, max(0, score))
    except Exception:
        return 0


def _sauvegarder_lettre_rag(
    corps:    str,
    score:    int,
    secteur:  str,
    cv_base:  str,
    metadata: dict,
    md_path:  Path,
) -> None:
    """Sauvegarde la lettre en DB RAG si score ≥ 75. Invalide le cache."""
    if score < 75:
        return
    try:
        from database import save_generated_letter
        save_generated_letter(
            secteur=secteur,
            cv_base=cv_base,
            content=corps,
            score_qualite=score,
            entreprise=metadata.get("entreprise"),
            poste=metadata.get("poste"),
            file_path=str(md_path),
        )
        # Invalide le cache pour ce secteur
        _letters_cache.pop(secteur, None)
    except Exception:
        pass  # La sauvegarde RAG ne bloque jamais le pipeline


# ══════════════════════════════════════════════════════════════════
# POINT D'ENTRÉE PRINCIPAL
# ══════════════════════════════════════════════════════════════════

def generate_letter(match_result: dict, offer: str) -> dict:
    """
    Pipeline lettre en 4 étapes :
      0. Haiku extrait les faits vérifiables du CV (anti-hallucination)
      1. Haiku analyse l'offre (ton, culture, profil, différenciants)
      2. RAG charge les meilleures lettres passées du même secteur
      3. Sonnet génère la lettre en JSON structuré (p1/p2/p3)
      4. Haiku score la lettre → sauvegarde en DB si ≥ 75
    """
    client   = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    metadata = extract_offer_metadata(offer)
    secteur  = metadata.get("secteur", "autre")

    # ── 0. Extraction faits CV
    faits_cv = _extraire_faits_cv(match_result["cv_content"], client)

    # ── 1. Analyse offre
    analyse = _analyse_offre(offer, client)

    # ── 2. RAG lettres
    exemples    = _load_letter_examples(secteur)
    rag_section = _format_rag_examples(exemples)

    # ── 3. Génération Sonnet
    preferences = match_result.get("preferences_utilisateur", "")
    corps = _generer_lettre_sonnet(
        faits_cv=faits_cv,
        analyse=analyse,
        rag_section=rag_section,
        match_result=match_result,
        offer=offer,
        preferences=preferences,
        client=client,
    )

    # ── Sauvegarde fichiers
    cv_name_safe = match_result['cv_name'].split("/")[-1].split("\\")[-1]
    nom_fichier  = f"lettre_{cv_name_safe}"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path   = OUTPUT_DIR / f"{nom_fichier}.md"
    md_path.write_text(corps, encoding="utf-8")
    docx_path = _inject_docx(corps, metadata, nom_fichier)

    # ── 4. Score qualité + RAG save
    score_qualite = _scorer_lettre(corps, offer, client)
    _sauvegarder_lettre_rag(
        corps=corps,
        score=score_qualite,
        secteur=secteur,
        cv_base=cv_name_safe,
        metadata=metadata,
        md_path=md_path,
    )

    return {
        "md_path":       str(md_path),
        "docx_path":     str(docx_path),
        "corps":         corps,
        "metadata":      metadata,
        "analyse_offre": analyse,
        "score_qualite": score_qualite,
        "rag_exemples":  len(exemples),
    }


# ══════════════════════════════════════════════════════════════════
# INJECTION DOCX
# ══════════════════════════════════════════════════════════════════

def _inject_docx(corps: str, metadata: dict, nom_fichier: str) -> Path:
    template_path = Path(__file__).parent.parent.parent / "templates" / "lettre_template.docx"
    if not template_path.exists():
        raise FileNotFoundError(f"Template DOCX introuvable : {template_path}")

    doc = Document(template_path)

    mois_fr = {
        "January": "janvier", "February": "février", "March": "mars",
        "April": "avril",     "May": "mai",           "June": "juin",
        "July": "juillet",    "August": "août",        "September": "septembre",
        "October": "octobre", "November": "novembre",  "December": "décembre",
    }
    date_en = datetime.now().strftime("%d %B %Y")
    for en, fr in mois_fr.items():
        date_en = date_en.replace(en, fr)

    placeholders = {
        "{{date}}":               date_en,
        "{{entreprise}}":         metadata.get("entreprise", ""),
        "{{adresse_entreprise}}": metadata.get("adresse", ""),
        "{{poste}}":              metadata.get("poste", ""),
        "{{corps}}":              corps,
    }

    for paragraph in doc.paragraphs:
        full_text = "".join(run.text for run in paragraph.runs)
        for placeholder, value in placeholders.items():
            if placeholder in full_text:
                full_text = full_text.replace(placeholder, value)
        if paragraph.runs:
            paragraph.runs[0].text = full_text
            for run in paragraph.runs[1:]:
                run.text = ""

    docx_path = OUTPUT_DIR / f"{nom_fichier}.docx"
    doc.save(docx_path)
    return docx_path
