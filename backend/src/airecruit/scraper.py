"""
scraper.py — Recherche d'offres d'emploi.
Sources :
  - France Travail API officielle (v2)
  - Indeed scraping HTML (fallback)
"""

import os
import re
import json
import time
import httpx
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent.parent / ".env")

FRANCETRAVAIL_CLIENT_ID     = os.getenv("FRANCETRAVAIL_CLIENT_ID", "")
FRANCETRAVAIL_CLIENT_SECRET = os.getenv("FRANCETRAVAIL_CLIENT_SECRET", "")

_ft_token       = None
_ft_token_expiry = 0


# ─────────────────────────────────────────
# FRANCE TRAVAIL
# ─────────────────────────────────────────

def _get_ft_token() -> str | None:
    global _ft_token, _ft_token_expiry

    if _ft_token and time.time() < _ft_token_expiry:
        return _ft_token

    if not FRANCETRAVAIL_CLIENT_ID or not FRANCETRAVAIL_CLIENT_SECRET:
        return None

    try:
        res = httpx.post(
           "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search",
            params={"realm": "/partenaire"},
            data={
                "grant_type":    "client_credentials",
                "client_id":     FRANCETRAVAIL_CLIENT_ID,
                "client_secret": FRANCETRAVAIL_CLIENT_SECRET,
                "scope": "api_offresdemploiv2",
            },
            timeout=10,
        )
        if res.status_code == 200:
            data            = res.json()
            _ft_token       = data["access_token"]
            _ft_token_expiry = time.time() + data.get("expires_in", 1200) - 60
            return _ft_token
    except Exception as e:
        print(f"France Travail auth error: {e}")

    return None


def search_france_travail(poste: str, ville: str = "", limit: int = 15) -> list[dict]:
    token = _get_ft_token()
    if not token:
        return []

    params = {
        "motsCles":       poste,
        "range":          f"0-{limit - 1}",
        "sort":           "1",
    }
    if ville:
        params["commune"] = ville

    try:
        res = httpx.get(
            "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search",
            params=params,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=10,
        )
        if res.status_code != 200:
            return []

        data   = res.json()
        offres = data.get("resultats", [])

        results = []
        for o in offres:
            results.append({
                "source":      "France Travail",
                "id":          o.get("id", ""),
                "titre":       o.get("intitule", ""),
                "entreprise":  o.get("entreprise", {}).get("nom", ""),
                "ville":       o.get("lieuTravail", {}).get("libelle", ""),
                "contrat":     o.get("typeContratLibelle", ""),
                "salaire":     o.get("salaire", {}).get("libelle", ""),
                "description": o.get("description", ""),
                "date":        o.get("dateCreation", ""),
                "url":         f"https://candidat.francetravail.fr/offres/recherche/detail/{o.get('id', '')}",
            })
        return results

    except Exception as e:
        print(f"France Travail search error: {e}")
        return []


# ─────────────────────────────────────────
# INDEED SCRAPING
# ─────────────────────────────────────────

def search_indeed(poste: str, ville: str = "Strasbourg", limit: int = 15) -> list[dict]:
    ville_query = ville or "Strasbourg"
    url = "https://fr.indeed.com/jobs"
    params = {"q": poste, "l": ville_query, "lang": "fr"}

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    try:
        with httpx.Client(http2=True, follow_redirects=True, timeout=15) as client:
            res = client.get(url, params=params, headers=headers)
        if res.status_code != 200:
            print(f"Indeed status: {res.status_code}")
            return []
        
        html = res.text
        results = []
        titles    = re.findall(r'class="jobTitle[^"]*"[^>]*><[^>]*>([^<]+)<', html)
        companies = re.findall(r'data-testid="company-name"[^>]*>([^<]+)<', html)
        cities    = re.findall(r'data-testid="text-location"[^>]*>([^<]+)<', html)

        for i, titre in enumerate(titles[:limit]):
            results.append({
                "source":      "Indeed",
                "id":          f"indeed_{i}_{hash(titre)}",
                "titre":       titre.strip(),
                "entreprise":  companies[i].strip() if i < len(companies) else "",
                "ville":       cities[i].strip() if i < len(cities) else ville_query,
                "contrat":     "",
                "salaire":     "",
                "description": f"{titre.strip()} — {companies[i].strip() if i < len(companies) else ''}",
                "date":        "",
                "url":         f"https://fr.indeed.com/jobs?q={poste}&l={ville_query}",
            })
        return results
    except Exception as e:
        print(f"Indeed error: {e}")
        return []

# ─────────────────────────────────────────
# FONCTION PRINCIPALE
# ─────────────────────────────────────────


def search_jobs(poste: str, ville: str = "", limit: int = 20) -> list[dict]:
    # France Travail désactivé temporairement — droits insuffisants
    indeed_results = search_indeed(poste, ville or "Strasbourg", limit)
    return indeed_results[:limit]