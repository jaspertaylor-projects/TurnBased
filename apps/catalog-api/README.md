# TurnBased catalog API

The supplier catalog and quote service lives in this npm workspace. NestJS
serves cached products, manufacturing layouts, price tiers, and quotes;
BullMQ runs supplier ingestion using Postgres and Redis. The web app calls
`/v1` through its Vite proxy. Supplier parsing stays inside this service.

## Development

From the **repository root**, use Node 22.12+ and Docker with Compose v2:

```bash
npm run dev          # catalog API + Postgres + Redis + Supabase + web
npm run dev:catalog  # catalog API + Postgres + Redis only
```

The launcher installs workspace dependencies, creates missing `.env` files,
waits for Docker health checks, generates Prisma, applies committed migrations
with `prisma migrate deploy`, seeds the two suppliers idempotently, and starts
Nest in watch mode on `http://127.0.0.1:3100`. Output is also saved in `logs/`
at the repo root. Ctrl+C stops all processes started by the launcher.
Afterward, `npm run dev:stop` stops the database/Redis/Supabase containers;
volumes and catalog data are preserved.

`apps/catalog-api/.env` contains optional supplier credentials. The full local
launcher always connects to the local Compose dependencies, independent of any
external database URL in that file. Set `CATALOG_PORT`, `CATALOG_DB_PORT`, and
`CATALOG_REDIS_PORT` in the root `.env` or shell to override 3100, 54328, and
6380; the launcher keeps the API, Compose, and Vite proxy settings in sync.
The database is separate from Supabase: `RESET_DB=1` only resets Supabase.

For manual work against the connection in `apps/catalog-api/.env`:

```bash
npm install
npm run db:generate --workspace @turnbased/catalog-api
npm run db:migrate --workspace @turnbased/catalog-api
npm run seed --workspace @turnbased/catalog-api
npm run dev --workspace @turnbased/catalog-api
```

Run `docker compose up -d --wait` first when using the default local connections.
One lockfile at the root manages all workspaces. Do not copy standalone
`node_modules`, `dist`, or a nested lockfile into this workspace.

## Catalog data

Seeding creates the `bgm` and `tgc` suppliers; it does not invent products or
prices. Existing Docker volumes retain ingested products across restarts.
On a new machine, populate the catalog explicitly:

```bash
curl -X POST http://127.0.0.1:3100/v1/admin/refresh/bgm
# Requires GAMECRAFTER_* credentials in apps/catalog-api/.env:
curl -X POST http://127.0.0.1:3100/v1/admin/refresh/tgc
curl http://127.0.0.1:3100/v1/admin/scrape-runs
curl 'http://127.0.0.1:3100/v1/products?pageSize=5'
```

Scrapes are asynchronous. Startup never automatically re-scrapes a supplier.

The original local catalog was imported into this repo's Compose database
without changing its product IDs. For another existing standalone installation,
start its Postgres container and export with `pg_dump --format=custom`, then
restore into an **empty** monorepo database before starting the API:

```bash
docker compose up -d --wait
# Replace old-catalog-db with the source container name:
docker exec old-catalog-db pg_dump -U postgres -d bgmapi --format=custom > catalog.dump
docker compose exec -T catalog-db pg_restore -U postgres -d bgmapi \
  --no-owner --no-acl --exit-on-error < catalog.dump
```

Keep database dumps and credentials out of git. Existing source files and
volumes can be kept as a rollback copy; the monorepo has no runtime dependency
on the old directory. Redis starts with a new queue to avoid replaying old jobs.

## Checks and deployment

```bash
npm run build --workspace @turnbased/catalog-api
npm run typecheck --workspace @turnbased/catalog-api
npm run test:dev
npm run test:catalog  # API must be running; optional CATALOG_API_URL override
```

Build the container from the **repo root**:

```bash
docker build -f apps/catalog-api/Dockerfile -t turnbased-catalog .
```

Set `DATABASE_URL`, `REDIS_HOST`, and `REDIS_PORT` in your deployment. Apply
migrations using `npx prisma migrate deploy` from `/app/apps/catalog-api`
before starting the container. It listens on port 3100 inside Docker. The
local Compose file only runs development dependencies; deploy the API behind
an internal gateway and configure the web host to proxy `/v1` to it. Admin
routes currently have no application authentication and are for internal use.

See [api-guide.md](api-guide.md) for the imported API contract and
[docs/design.md](docs/design.md) for the original design proposal (some future
items, including a separate ingestion worker and snapshot storage, are not
implemented). Use native `fetch()` for supplier HTTP calls.
