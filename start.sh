#!/bin/bash

# ── Couleurs
GREEN='\033[0;32m'
TURQUOISE='\033[0;36m'
ORANGE='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# ── ASCII
echo -e "${TURQUOISE}${BOLD}"
echo "  ██████╗ ██████╗  ██████╗ ██╗██████╗ "
echo "  ██╔══██╗██╔══██╗██╔═══██╗██║██╔══██╗"
echo "  ██║  ██║██████╔╝██║   ██║██║██║  ██║"
echo "  ██║  ██║██╔══██╗██║   ██║██║██║  ██║"
echo "  ██████╔╝██║  ██║╚██████╔╝██║██████╔╝"
echo "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═════╝ "
echo -e "  ${ORANGE}Booster${NC}"
echo ""

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$DIR/backend"
FRONTEND="$DIR/frontend"

# ── Aide
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  echo -e "${BOLD}Usage :${NC}"
  echo "  ./start.sh          → Lance backend + frontend (réseau local)"
  echo "  ./start.sh local    → Lance en localhost uniquement"
  echo "  ./start.sh test     → Lance les tests unitaires"
  echo "  ./start.sh backend  → Lance uniquement le backend"
  echo "  ./start.sh frontend → Lance uniquement le frontend"
  echo ""
  exit 0
fi

# ════════════════════════════════════════
# MODE TEST
# ════════════════════════════════════════
if [[ "$1" == "test" ]]; then
  echo -e "${BOLD}Tests unitaires — DroidBooster backend${NC}"
  echo ""
  cd "$BACKEND" || { echo -e "${RED}✗ Dossier backend introuvable${NC}"; exit 1; }
  if [ ! -f ".venv/bin/activate" ]; then
    echo -e "${RED}✗ Venv introuvable — lance d'abord ./start.sh${NC}"; exit 1
  fi
  source .venv/bin/activate
  if ! python -m pytest --version &>/dev/null; then
    pip install pytest -q
  fi
  echo -e "${TURQUOISE}Lancement des tests...${NC}\n"
  python -m pytest tests/ -v --tb=short
  exit $?
fi

# ════════════════════════════════════════
# DÉTECTION IP RÉSEAU
# ════════════════════════════════════════
if [[ "$1" == "local" ]]; then
  HOST="localhost"
  BIND="127.0.0.1"
else
  # Détecte l'IP WiFi automatiquement
  HOST=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
  BIND="0.0.0.0"
fi

# ════════════════════════════════════════
# MET À JOUR .env.local AUTOMATIQUEMENT
# ════════════════════════════════════════
ENV_LOCAL="$FRONTEND/.env.local"
echo "NEXT_PUBLIC_API_URL=http://${HOST}:8000" > "$ENV_LOCAL"
echo -e "${TURQUOISE}✓ API configurée → http://${HOST}:8000${NC}"

# ════════════════════════════════════════
# VÉRIFICATIONS
# ════════════════════════════════════════
if [ ! -d "$BACKEND/.venv" ]; then
  echo -e "${ORANGE}⚠ Venv backend introuvable — création...${NC}"
  cd "$BACKEND"
  python3 -m venv .venv --without-pip
  curl -s https://bootstrap.pypa.io/get-pip.py | .venv/bin/python3
  .venv/bin/pip install -r requirements.txt -q 2>/dev/null
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  echo -e "${ORANGE}⚠ node_modules introuvable — npm install...${NC}"
  cd "$FRONTEND" && npm install -q
fi

# Libère les ports
for PORT in 8000 3000; do
  PID=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    echo -e "${ORANGE}⚠ Port $PORT occupé → libération...${NC}"
    kill $PID 2>/dev/null
    sleep 1
  fi
done

# ════════════════════════════════════════
# LANCEMENT
# ════════════════════════════════════════

if [[ "$1" == "backend" ]]; then
  echo -e "${GREEN}✓ Backend → http://${HOST}:8000${NC}"
  cd "$BACKEND" && source .venv/bin/activate
  python -m uvicorn api:app --reload --port 8000 --host "$BIND"
  exit 0
fi

if [[ "$1" == "frontend" ]]; then
  echo -e "${GREEN}✓ Frontend → http://${HOST}:3000${NC}"
  cd "$FRONTEND" && npm run dev -- --hostname "$BIND"
  exit 0
fi

# ── Mode complet
echo ""
echo -e "  ${GREEN}${BOLD}Application disponible sur :${NC}"
echo -e "  ${GREEN}→ Ce Mac        : http://localhost:3000${NC}"
echo -e "  ${GREEN}→ Autres appareils : http://${HOST}:3000${NC}"
echo -e "  ${GREEN}→ API docs      : http://${HOST}:8000/docs${NC}"
echo ""
echo -e "  ${ORANGE}Ctrl+C pour tout arrêter${NC}\n"

trap 'echo ""; echo -e "${ORANGE}Arrêt...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT

cd "$BACKEND"
source .venv/bin/activate
python -m uvicorn api:app --reload --port 8000 --host "$BIND" &
BACKEND_PID=$!

sleep 2

cd "$FRONTEND"
npm run dev -- --hostname "$BIND" &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID