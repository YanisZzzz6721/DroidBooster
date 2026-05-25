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
 
# ── Dossier racine du projet
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$DIR/backend"
FRONTEND="$DIR/frontend"
 
# ── Aide
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  echo -e "${BOLD}Usage :${NC}"
  echo "  ./start.sh          → Lance backend + frontend"
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
    echo -e "${RED}✗ Venv introuvable — lance d'abord ./start.sh${NC}"
    exit 1
  fi
 
  source .venv/bin/activate
 
  # Installe pytest si absent
  if ! python -m pytest --version &>/dev/null; then
    echo -e "${ORANGE}⚠ Installation de pytest...${NC}"
    pip install pytest -q
  fi
 
  echo -e "${TURQUOISE}Lancement des tests...${NC}"
  echo ""
  python -m pytest tests/ -v --tb=short
  exit $?
fi
 
# ════════════════════════════════════════
# VÉRIFICATIONS
# ════════════════════════════════════════
 
# Backend — venv
if [ ! -d "$BACKEND/.venv" ]; then
  echo -e "${ORANGE}⚠ Venv backend introuvable — création...${NC}"
  cd "$BACKEND"
  python3 -m venv .venv --without-pip
  curl -s https://bootstrap.pypa.io/get-pip.py | .venv/bin/python3
  .venv/bin/pip install -r requirements.txt -q 2>/dev/null || \
  .venv/bin/pip install fastapi uvicorn python-docx python-multipart python-dotenv anthropic -q
fi
 
# Frontend — node_modules
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo -e "${ORANGE}⚠ node_modules introuvable — npm install...${NC}"
  cd "$FRONTEND" && npm install -q
fi
 
# Libère les ports si occupés
for PORT in 8000 3000; do
  PID=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    echo -e "${ORANGE}⚠ Port $PORT occupé (PID $PID) → libération...${NC}"
    kill $PID 2>/dev/null
    sleep 1
  fi
done
 
# ════════════════════════════════════════
# LANCEMENT
# ════════════════════════════════════════
 
if [[ "$1" == "backend" ]]; then
  echo -e "${GREEN}✓ Backend → http://localhost:8000${NC}"
  echo -e "${GREEN}✓ API docs → http://localhost:8000/docs${NC}"
  cd "$BACKEND" && source .venv/bin/activate
  python -m uvicorn api:app --reload --port 8000
  exit 0
fi
 
if [[ "$1" == "frontend" ]]; then
  echo -e "${GREEN}✓ Frontend → http://localhost:3000${NC}"
  cd "$FRONTEND" && npm run dev
  exit 0
fi
 
# ── Mode complet : backend + frontend en parallèle
echo -e "${GREEN}✓ Backend  → http://localhost:8000${NC}"
echo -e "${GREEN}✓ Frontend → http://localhost:3000${NC}"
echo -e "${GREEN}✓ API docs → http://localhost:8000/docs${NC}"
echo ""
echo -e "  ${ORANGE}Ctrl+C pour tout arrêter${NC}"
echo ""
 
# Trap Ctrl+C pour tuer les deux process
trap 'echo ""; echo -e "${ORANGE}Arrêt...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT
 
# Lance le backend en arrière-plan
cd "$BACKEND"
source .venv/bin/activate
python -m uvicorn api:app --reload --port 8000 &
BACKEND_PID=$!
 
# Petit délai pour que le backend démarre avant le frontend
sleep 2
 
# Lance le frontend en arrière-plan
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!
 
# Attend les deux process
wait $BACKEND_PID $FRONTEND_PID
 