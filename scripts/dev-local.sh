#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3000}"
EDGE_FUNCTION="${EDGE_FUNCTION:-ai-project-builder}"
RESET_DB="${RESET_DB:-0}"

EDGE_PID=""

cleanup() {
  if [[ -n "$EDGE_PID" ]] && kill -0 "$EDGE_PID" 2>/dev/null; then
    echo "Stopping local Supabase edge runtime..."
    kill "$EDGE_PID" 2>/dev/null || true
    wait "$EDGE_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    echo "Missing .env and .env.example; create .env before starting dev." >&2
    exit 1
  fi

  echo "No .env found. Creating one from .env.example..."
  cp -n .env.example .env
else
  echo "Using existing .env."
fi

echo "Starting local Supabase..."
npx supabase start

if [[ "$RESET_DB" == "1" ]]; then
  echo "Applying migrations and seed data..."
  npx supabase db reset
else
  echo "Skipping database reset. Set RESET_DB=1 to rebuild the local database."
fi

echo "Starting local Supabase edge runtime for $EDGE_FUNCTION..."
npx supabase functions serve "$EDGE_FUNCTION" --env-file .env &
EDGE_PID="$!"

echo "Starting web app at http://$WEB_HOST:$WEB_PORT..."
npm run dev --workspace web -- --host "$WEB_HOST" --port "$WEB_PORT"
