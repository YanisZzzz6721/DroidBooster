"""
database.py — Gestion de l'historique des candidatures via SQLite.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "airecruit.db"


def init_db():
    """Crée la base et la table si elles n'existent pas."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS candidatures (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at    TEXT    NOT NULL,
            offre_titre   TEXT,
            offre_texte   TEXT    NOT NULL,
            cv_nom        TEXT    NOT NULL,
            match_score   INTEGER,
            ats_score     INTEGER,
            lettre_md     TEXT,
            cv_optimise_md TEXT,
            preferences   TEXT
        )
    """)
    conn.commit()
    conn.close()


def save_candidature(
    offre_texte:    str,
    cv_nom:         str,
    match_score:    int  = None,
    ats_score:      int  = None,
    lettre_md:      str  = None,
    cv_optimise_md: str  = None,
    offre_titre:    str  = None,
    preferences:    str  = None,
) -> int:
    """Sauvegarde une candidature et retourne son id."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        """
        INSERT INTO candidatures
            (created_at, offre_titre, offre_texte, cv_nom,
             match_score, ats_score, lettre_md, cv_optimise_md, preferences)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            datetime.now().isoformat(),
            offre_titre,
            offre_texte,
            cv_nom,
            match_score,
            ats_score,
            lettre_md,
            cv_optimise_md,
            preferences,
        ),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_history(limit: int = 20) -> list[dict]:
    """Retourne les dernières candidatures."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT id, created_at, offre_titre, cv_nom,
               match_score, ats_score
        FROM candidatures
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_candidature(candidature_id: int) -> dict | None:
    """Retourne une candidature complète par son id."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM candidatures WHERE id = ?",
        (candidature_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_candidature(candidature_id: int) -> bool:
    """Supprime une candidature."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM candidatures WHERE id = ?", (candidature_id,))
    conn.commit()
    conn.close()
    return True