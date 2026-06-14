"""
logger.py — Module de logging structuré pour DroidBooster.

Usage dans n'importe quel module :
    from logger import get_logger
    log = get_logger(__name__)
    log.info("Message")
    log.error("Erreur", exc_info=True)
"""

import logging
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

# ─── Config ───────────────────────────────────────────────────────────────────

LOGS_DIR   = Path(__file__).parent / "logs"
LOG_FILE   = LOGS_DIR / "droidbooster.log"
ERROR_FILE = LOGS_DIR / "errors.log"

LOGS_DIR.mkdir(exist_ok=True)

# ─── Formatter ────────────────────────────────────────────────────────────────

class StructuredFormatter(logging.Formatter):
    """Format lisible en console + structuré dans les fichiers."""

    LEVEL_ICONS = {
        "DEBUG":    "🔍",
        "INFO":     "✅",
        "WARNING":  "⚠️ ",
        "ERROR":    "❌",
        "CRITICAL": "💥",
    }

    def format(self, record: logging.LogRecord) -> str:
        icon    = self.LEVEL_ICONS.get(record.levelname, "  ")
        ts      = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        module  = record.name.split(".")[-1]
        message = record.getMessage()

        base = f"{ts} {icon} [{record.levelname:<8}] {module:<20} {message}"

        # Ajoute la traceback si exception
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)

        return base


# ─── Handlers ─────────────────────────────────────────────────────────────────

def _make_console_handler() -> logging.StreamHandler:
    h = logging.StreamHandler(sys.stdout)
    h.setLevel(logging.DEBUG)
    h.setFormatter(StructuredFormatter())
    return h


def _make_file_handler() -> RotatingFileHandler:
    """Tous les logs — rotation à 5 MB, garde 3 fichiers."""
    h = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    h.setLevel(logging.DEBUG)
    h.setFormatter(StructuredFormatter())
    return h


def _make_error_handler() -> RotatingFileHandler:
    """Erreurs uniquement — rotation à 2 MB, garde 5 fichiers."""
    h = RotatingFileHandler(ERROR_FILE, maxBytes=2 * 1024 * 1024, backupCount=5, encoding="utf-8")
    h.setLevel(logging.ERROR)
    h.setFormatter(StructuredFormatter())
    return h


# ─── Root logger ──────────────────────────────────────────────────────────────

def _setup_root_logger() -> None:
    root = logging.getLogger("droidbooster")
    if root.handlers:
        return  # Déjà configuré
    root.setLevel(logging.DEBUG)
    root.addHandler(_make_console_handler())
    root.addHandler(_make_file_handler())
    root.addHandler(_make_error_handler())
    root.propagate = False


_setup_root_logger()


# ─── API publique ─────────────────────────────────────────────────────────────

def get_logger(name: str) -> logging.Logger:
    """
    Retourne un logger enfant du logger DroidBooster.

    Exemple :
        log = get_logger(__name__)
        log.info("Pipeline lancé pour %s", entreprise)
        log.error("Erreur Claude", exc_info=True)
    """
    # Normalise le nom : airecruit.matcher → droidbooster.matcher
    short = name.split(".")[-1]
    return logging.getLogger(f"droidbooster.{short}")


def log_api_call(module: str, model: str, input_tokens: int, output_tokens: int) -> None:
    """Log structuré pour chaque appel à l'API Anthropic."""
    log = get_logger("api_usage")
    log.info(
        "Claude call | module=%-20s model=%-30s in=%5d out=%5d",
        module, model, input_tokens, output_tokens,
    )


def log_pipeline_start(mode: str, entreprise: str, secteur: str) -> None:
    log = get_logger("pipeline")
    log.info("Pipeline START | mode=%-12s entreprise=%-20s secteur=%s", mode, entreprise, secteur)


def log_pipeline_end(mode: str, entreprise: str, ats_score: int | None) -> None:
    log = get_logger("pipeline")
    score_str = f"{ats_score}/100" if ats_score is not None else "N/A"
    log.info("Pipeline END   | mode=%-12s entreprise=%-20s ats=%s", mode, entreprise, score_str)


def log_error(module: str, error: Exception, context: dict | None = None) -> None:
    """Log une erreur avec contexte optionnel."""
    log = get_logger(module)
    ctx = " | ".join(f"{k}={v}" for k, v in (context or {}).items())
    log.error("ERREUR %s%s", type(error).__name__, f" | {ctx}" if ctx else "", exc_info=error)
