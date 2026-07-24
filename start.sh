#!/usr/bin/env bash
# One-click start script for Global Energy Transition Dashboard (macOS / Linux)
set -e

cd "$(dirname "$0")"

echo "=============================================="
echo "  Global Energy Transition Dashboard"
echo "  GEM-style multi-tracker platform"
echo "=============================================="
echo

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Please install Python 3.10+ first."
  exit 1
fi

PYTHON=$(command -v python3)
echo "Using: $($PYTHON --version)"

# Create virtual environment if missing
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment (.venv)..."
  $PYTHON -m venv .venv
fi

# Activate
# shellcheck disable=SC1091
source .venv/bin/activate

echo "Installing / updating dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo
echo "Starting server on http://localhost:8000"
echo "Press Ctrl+C to stop."
echo

# Open browser after a short delay (best-effort)
(sleep 2 && (command -v open &>/dev/null && open "http://localhost:8000" || \
             command -v xdg-open &>/dev/null && xdg-open "http://localhost:8000" || true)) &

exec uvicorn app:app --host 127.0.0.1 --port 8000 --reload
