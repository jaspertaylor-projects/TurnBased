#!/usr/bin/env bash
#
# Seed the local dev account into a running local Supabase without doing a
# full `supabase db reset`. Useful when you just want the account available
# now and don't want to lose existing local data.
#
# Idempotent — re-running is a no-op if the user already exists.
#
# Default credentials (also see supabase/seed.sql):
#   Email:    dev@turnbased.local
#   Password: dev-local-only

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Run the same seed file db reset would run, scoped to the dev-account block.
# Pipes into psql inside the supabase_db_TurnBased container so we don't have
# to hard-code host/port/creds or depend on a specific supabase-cli subcommand.
SQL=$(sed -n '/^DO \$\$/,/^END \$\$;/p' supabase/seed.sql)
if [[ -z "$SQL" ]]; then
  echo "Couldn't find the dev-account DO block in supabase/seed.sql" >&2
  exit 1
fi

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_TurnBased}"
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Postgres container '${CONTAINER}' is not running. Start the stack with 'npm run dev:local' first." >&2
  exit 1
fi

echo "Seeding dev@turnbased.local..."
echo "$SQL" | docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1

echo "Done. Sign in at http://127.0.0.1:3000/#/auth with:"
echo "  Email:    dev@turnbased.local"
echo "  Password: dev-local-only"
