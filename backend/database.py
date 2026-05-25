"""
database.py — Gestion de l'historique via SQLite.
Tables :
  - candidatures : historique AIRecruit (lettres, ATS)
  - exports      : historique Export CV → DOCX
"""
 
import os
import sqlite3
from datetime import datetime
from pathlib import Path
 
DB_PATH = Path(__file__).parent / "airecruit.db"
 
 
def init_db():
    """Crée les tables si elles n'existent pas."""
    conn = sqlite3.connect(DB_PATH)
 
    # Table existante — candidatures AIRecruit
    conn.execute("""
        CREATE TABLE IF NOT EXISTS candidatures (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at     TEXT    NOT NULL,
            offre_titre    TEXT,
            offre_texte    TEXT    NOT NULL,
            cv_nom         TEXT    NOT NULL,
            match_score    INTEGER,
            ats_score      INTEGER,
            lettre_md      TEXT,
            cv_optimise_md TEXT,
            preferences    TEXT
        )
    """)
 
    # Nouvelle table — exports DOCX
    conn.execute("""
        CREATE TABLE IF NOT EXISTS exports (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            cv_nom     TEXT NOT NULL,
            cv_titre   TEXT NOT NULL,
            template   TEXT NOT NULL,
            docx_path  TEXT NOT NULL
        )
    """)
 
    conn.commit()
    conn.close()
 
 
# ─── CANDIDATURES ────────────────────────────────────────────────────────────────
 
def save_candidature(
    offre_texte:    str,
    cv_nom:         str,
    match_score:    int = None,
    ats_score:      int = None,
    lettre_md:      str = None,
    cv_optimise_md: str = None,
    offre_titre:    str = None,
    preferences:    str = None,
) -> int:
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
            offre_titre, offre_texte, cv_nom,
            match_score, ats_score, lettre_md, cv_optimise_md, preferences,
        ),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id
 
 
def get_history(limit: int = 20) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT id, created_at, offre_titre, cv_nom, match_score, ats_score
        FROM candidatures
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
 
 
def get_candidature(candidature_id: int) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM candidatures WHERE id = ?", (candidature_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
 
 
def delete_candidature(candidature_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM candidatures WHERE id = ?", (candidature_id,))
    conn.commit()
    conn.close()
    return True
 
 
# ─── EXPORTS ─────────────────────────────────────────────────────────────────────
 
def save_export(
    cv_nom:    str,
    cv_titre:  str,
    template:  str,
    docx_path: str,
) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        """
        INSERT INTO exports (created_at, cv_nom, cv_titre, template, docx_path)
        VALUES (?, ?, ?, ?, ?)
        """,
        (datetime.now().isoformat(), cv_nom, cv_titre, template, docx_path),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id
 
 
def get_export_history(limit: int = 20) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT id, created_at, cv_nom, cv_titre, template
        FROM exports
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
 
 
def get_export(export_id: int) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM exports WHERE id = ?", (export_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
 
 
def delete_export(export_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT docx_path FROM exports WHERE id = ?", (export_id,)
    ).fetchone()
    if not row:
        conn.close()
        return False
    # Supprime le fichier disque
    if os.path.exists(row[0]):
        os.remove(row[0])
    conn.execute("DELETE FROM exports WHERE id = ?", (export_id,))
    conn.commit()
    conn.close()
    return True