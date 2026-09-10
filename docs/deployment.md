# Deployment

TurnBased's web application is hosted at **https://turnbased.app** through
Cloudflare Pages. The Pages project is `turnbased`, connected to
`jaspertaylor-projects/TurnBased` on the `main` branch. The existing Supabase
project reference is `vwyxnvgpofvayjnltzrf`.

The root `.node-version` selects Node 22 using Cloudflare's supported
[build-version override](https://developers.cloudflare.com/pages/configuration/build-image/#override-default-versions).

## Service boundaries

| Service | Deployment | Configuration |
| --- | --- | --- |
| Web application and demo video | Cloudflare Pages, repository root, web output `apps/web/dist` | Node 22.12+, workspace dependencies, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| AI and cloud checkpoints | Supabase edge functions | Provider credentials and service-role credentials stay server-side |
| Application database and identity | Hosted Supabase | Versioned migrations and owner-scoped access policies |
| Supplier catalog | Separate NestJS service with PostgreSQL and Redis | Requires its own host and a gateway for the public `/v1` routes |

Cloudflare Pages does not run the NestJS catalog server. The development
server's Vite proxy only exists locally. As of this release, the public
`/v1/products` path returns the web application instead of catalog JSON; live
supplier lookup is unavailable. Custom component design, prototype printing,
and portable archives remain available. Configure a catalog host and route
before presenting supplier matching as a hosted feature. Keep `/v1/admin`
private; the service currently has no application authentication on those routes.
See the [catalog deployment guide](../apps/catalog-api/README.md#checks-and-deployment).

## Release procedure

1. Run the checks in the [verification guide](verification.md), including
   Playwright against the affected workflows. `npm run build` builds all
   applications. Review the working diff and commit the release.
2. Inspect the linked backend before changing it:

   ```bash
   npx supabase projects list
   npx supabase db push --dry-run
   npx supabase functions list --project-ref vwyxnvgpofvayjnltzrf
   npx supabase secrets list --project-ref vwyxnvgpofvayjnltzrf
   ```

   Confirm the project reference and inspect any pending SQL. Do not run a
   database reset or upload the local `.env` to production. Local development
   account seeds are never part of the hosted release.
3. Deploy changed, verified backend functions explicitly:

   ```bash
   npx supabase functions deploy \
     ai-rules-writer ai-card-table ai-image-agent ai-project-builder git-proxy \
     --project-ref vwyxnvgpofvayjnltzrf
   ```

   Keep JWT verification enabled. Each deployed AI handler validates the
   caller; `git-proxy` also checks project ownership before reading or writing
   checkpoints. `OPENROUTER_API_KEY` must be configured in Supabase's secret
   store. New users may need account credit for metered features; payment and
   top-up flows are not part of the current product release.
4. Push `main`. The connected Cloudflare Pages project starts its build.
   Its build command must run from the repository root, for example
   `npm run build --workspace web`, with output `apps/web/dist`.
   Preserve the existing hosted Supabase URL and public anonymous key in the
   Pages production environment. Never publish a localhost backend URL or a
   service-role/provider key in a `VITE_` variable.
5. Check both GitHub CI and the **Cloudflare Pages** check for the pushed
   commit. They are separate systems: a successful push is not proof of a
   successful deployment, and Pages does not wait for GitHub CI.
6. Verify `https://turnbased.app` in a fresh browser. Check local game creation,
   sample components, reload persistence, the ad player, printable downloads,
   and anonymous rejection at the AI endpoints. Use an authorized account for
   a live AI request or cloud-sync check. Do not place development credentials
   on the production site.

The landing video is a static, captioned MP4 under `apps/web/public/demo/`.
Its [recording notes](demos/ai-rules-ad.md) distinguish real AI calls from
prepared design data. Raw recordings and QA output stay in ignored artifact
and log directories.

## Rollback

For a web-only regression, select the preceding successful production
Cloudflare Pages deployment and roll it back, then revert the responsible
source commit and run CI. Retain the current production environment variables.
An edge function release is independent: redeploy its last known-good source
to the same Supabase project. A web rollback does not roll back edge functions
or database migrations. Database rollback requires reviewing the migration's
data effects and a recovery plan; do not reset the hosted database.

## September 2026 release verification

The linked hosted database was checked with `db push --dry-run`; no migrations
were pending. The rules writer, card-table assistant, image assistant, project
builder, and checkpoint endpoint are deployed explicitly for this release.
The checkpoint authentication fix was verified locally with a signed-in
commit/history round trip, an ownership rejection, and a missing-token
rejection using `node scripts/check-cloud-history.mjs`. That check creates and
removes only its own temporary project and refuses a non-local backend.
