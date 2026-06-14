#!/bin/bash
# ─── DroidBooster — Lancement de la suite de tests ───────────────────────────

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/.venv/bin/python"

# ── Couleurs ──────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║        DroidBooster — Test Suite         ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── Vérifications ─────────────────────────────────────────────────────────────

if [ ! -f "$VENV" ]; then
  echo -e "${RED}✗ Virtualenv introuvable : $VENV${RESET}"
  echo -e "  Lance d'abord : cd backend && python -m venv .venv && .venv/bin/pip install -e ."
  exit 1
fi

if [ ! -d "$BACKEND/tests" ]; then
  echo -e "${RED}✗ Dossier tests/ introuvable${RESET}"
  exit 1
fi

cd "$BACKEND"

# ── Parsing des arguments ──────────────────────────────────────────────────────

MODULE=""
VERBOSE="-v"
STOP_FIRST=""
SHOW_LOGS=""

for arg in "$@"; do
  case $arg in
    --module=*) MODULE="${arg#*=}" ;;
    --short)    VERBOSE=""         ;;
    --fail-fast) STOP_FIRST="-x"  ;;
    --logs)     SHOW_LOGS="-s"    ;;
    --help)
      echo -e "${BOLD}Usage :${RESET}"
      echo "  ./run_tests.sh                    → tous les tests"
      echo "  ./run_tests.sh --module=matcher   → tests/test_matcher.py uniquement"
      echo "  ./run_tests.sh --fail-fast        → stoppe au premier échec"
      echo "  ./run_tests.sh --short            → résumé sans détail"
      echo "  ./run_tests.sh --logs             → affiche les logs pendant les tests"
      echo ""
      exit 0
    ;;
  esac
done

# ── Cible ─────────────────────────────────────────────────────────────────────

if [ -n "$MODULE" ]; then
  TARGET="tests/test_${MODULE}.py"
  if [ ! -f "$TARGET" ]; then
    echo -e "${RED}✗ Fichier introuvable : $TARGET${RESET}"
    echo -e "  Modules disponibles :"
    ls tests/test_*.py | sed 's/tests\/test_//;s/\.py//' | sed 's/^/    /'
    exit 1
  fi
  echo -e "${YELLOW}▶ Module : ${BOLD}$MODULE${RESET}"
else
  TARGET="tests/"
  echo -e "${YELLOW}▶ Suite complète${RESET}"
fi

echo -e "${YELLOW}▶ Démarrage : $(date '+%H:%M:%S')${RESET}"
echo ""

# ── Lancement ─────────────────────────────────────────────────────────────────

set +e
"$VENV" -m pytest "$TARGET" $VERBOSE $STOP_FIRST $SHOW_LOGS --tb=short 2>&1
EXIT_CODE=$?
set -e

# ── Résultat ──────────────────────────────────────────────────────────────────

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✅  Tous les tests sont passés.${RESET}"
else
  echo -e "${RED}${BOLD}❌  Des tests ont échoué. Consulte les logs ci-dessus.${RESET}"
  echo -e "${YELLOW}   → Détail dans : backend/logs/errors.log${RESET}"
fi

echo ""
exit $EXIT_CODE
