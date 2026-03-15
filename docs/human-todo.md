# Human Operations TODO Runbook

This document is for the manual work that cannot be finished purely in code. It expands the original checklist into actionable steps, expected decisions, and clear completion criteria.

## How To Use This Runbook

- Treat each item as an owner-assigned task, not just a reminder.
- When a task is completed, change its checkbox, add the completion date, and note where the evidence lives.
- If a step depends on another service decision, record that decision in this file before moving on.
- Prefer collecting screenshots, dashboard URLs, secret names, and account owners in your private team system, not in this repo.

## Recommended Order

1. Secure account access first: MFA, password manager, billing ownership.
2. Lock DNS, origin layout, and TLS.
3. Stand up production Supabase and secret storage.
4. Finalize Stripe live-mode readiness.
5. Lock Git hosting, backups, and service credentials.
6. Configure AI provider budgets and keys.
7. Finalize email, legal, and marketplace policy decisions.
8. Revisit security, backups, and documentation governance before real users or real money.

## Domain And DNS

### [x] Buy and maintain the production domain

Detailed directions:

1. Confirm which registrar account owns `turnbased.app`.
2. Turn on auto-renew so the domain does not silently expire.
3. Turn on WHOIS privacy if the registrar supports it.
4. Record the account owner, billing owner, and recovery email in the team's credential inventory.
5. Add a recurring reminder 30 days before renewal.

Done when:

- The domain is owned by the business or a designated operator account.
- Auto-renew is enabled.
- Renewal responsibility is documented outside the repo.

### [ ] Set DNS records for `turnbased.app`, `app.turnbased.app`, `play.turnbased.app`, and `git.turnbased.app`

Why this matters:

- The product depends on origin separation.
- The app, play host, and self-hosted Git service should not share the same hostname.

Detailed directions:

1. Decide the production routing targets before creating records.
2. Use this recommended hostname layout unless there is a deliberate reason not to:
   - `turnbased.app`: marketing or landing surface, or redirect to `app.turnbased.app`
   - `app.turnbased.app`: main creator/dashboard app
   - `play.turnbased.app`: isolated play runtime
   - `git.turnbased.app`: Gitea or Forgejo VPS
3. In Cloudflare DNS, create the needed `A`, `AAAA`, or `CNAME` records for each hostname.
4. Proxy `app` and `play` through Cloudflare unless there is a concrete reason not to.
5. Point `git.turnbased.app` at the VPS public IP or load balancer target used for the Git service.
6. If the apex domain should redirect rather than host content directly, configure the redirect explicitly instead of leaving it ambiguous.
7. Wait for DNS propagation and verify each hostname resolves correctly from a clean network.
8. Test all four hostnames in a browser and confirm the certificate subject matches the hostname.

Recommended evidence:

- Screenshot of Cloudflare DNS records.
- Screenshot or note showing each hostname target.
- Command output from `dig` or equivalent stored in team notes.

Done when:

- Every planned hostname resolves to the intended service.
- There is no temporary or placeholder hostname left in production settings.

### [ ] Confirm Cloudflare proxy and SSL settings are correct for each subdomain

Detailed directions:

1. In Cloudflare, verify proxy status for each record:
   - `app` and `play` should usually be proxied.
   - `git` can be proxied or DNS-only depending on your reverse-proxy setup and clone strategy.
2. Set SSL/TLS mode to a strict mode backed by valid origin certificates.
3. Confirm "Always Use HTTPS" or equivalent redirect behavior is enabled where appropriate.
4. Test direct HTTP access and confirm it redirects cleanly to HTTPS.
5. Confirm there is no mixed-content warning on the app or play host.
6. Verify WebSocket or realtime traffic still works after proxying.

Done when:

- Each hostname has an intentional proxy mode.
- HTTPS is enforced.
- No origin is relying on insecure temporary TLS shortcuts.

## Cloudflare

### [x] Create or verify the Cloudflare account and attach billing

Verify:

1. The account is owned by the business or designated operator email.
2. Billing is current.
3. At least one backup admin exists.
4. MFA is enabled for every admin.

### [x] Create Pages project(s) for web app deployment

Verify:

1. The Pages project is connected to the correct repo and branch.
2. Environment variables are not hard-coded in the build settings.
3. Build logs are accessible to the operating team.

### [x] Create R2 buckets for builds and assets

Verify:

1. Build and asset buckets are distinct.
2. Bucket names are recorded in deployment config and secrets inventory.
3. Lifecycle expectations are documented.

### [ ] Configure R2 CORS rules for browser uploads and play-host access

Why this matters:

- Browser uploads and runtime asset fetches will fail without correct CORS.
- Overly broad CORS will create avoidable exposure.

Detailed directions:

1. List every origin that needs bucket access:
   - `https://app.turnbased.app`
   - `https://play.turnbased.app`
   - local development origins if intentionally supported
2. Separate upload needs from read-only fetch needs.
3. Configure bucket CORS to allow only the required origins, methods, and headers.
4. For asset buckets, allow read methods that the play host actually needs.
5. For upload flows, allow preflight requests and only the headers used by your signed-upload flow.
6. Set a reasonable max-age for preflight caching so the browser is not constantly re-requesting policy.
7. Test from the creator app:
   - upload an asset
   - fetch the uploaded asset back
8. Test from the play host:
   - load a published build
   - load referenced assets
9. Tighten the policy if any wildcard origin or wildcard header was added during testing.

Done when:

- Browser uploads succeed from the app origin.
- Runtime fetches succeed from the play origin.
- No unnecessary wildcard CORS permissions remain.

### [ ] Configure cache rules and security headers for `play.turnbased.app`

Why this matters:

- The play host serves untrusted creator output.
- It needs stricter isolation than the main app.

Detailed directions:

1. Decide which responses should be strongly cached and which must be revalidated.
2. Configure cache rules so immutable published builds can be cached aggressively.
3. Make sure auth-sensitive or per-session responses are not cached publicly.
4. Add or confirm security headers such as:
   - `Content-Security-Policy`
   - `X-Frame-Options` or equivalent frame policy
   - `Referrer-Policy`
   - `X-Content-Type-Options`
   - `Permissions-Policy`
5. If the play host is iframe-embedded, make sure the frame policy is intentionally compatible with the embedding plan.
6. Confirm the CSP does not accidentally allow unsafe inline or overly broad script origins unless explicitly required.
7. Load the play host in a browser, inspect response headers, and confirm the intended policies are present.
8. Run one real published build through the play host and confirm nothing breaks.

Done when:

- The play host has explicit cache and security policy.
- Published builds load correctly under those constraints.

### [ ] Decide whether to use a Worker for gated build access and, if yes, enable billing/features required

Decision to make:

- Do you want direct R2/Pages access patterns, or a Cloudflare Worker mediating signed or entitlement-aware build access?

Detailed directions:

1. Write down the reason for the decision:
   - direct access for simplicity
   - Worker gate for entitlement enforcement or token validation
2. If choosing direct access:
   - confirm that all sensitive authorization happens before a URL is issued
   - confirm object URLs are scoped and revocable where needed
3. If choosing a Worker gate:
   - enable any required billing or feature flags
   - create the Worker project
   - decide how it validates room/build access
   - decide what token shape it accepts
   - define cache behavior for public vs gated assets
4. Document the final architecture in team notes and, if it changes repo architecture, add or update an ADR.

Done when:

- The access pattern is decided.
- The chosen platform features are enabled.
- The design is documented well enough that implementation can proceed without ambiguity.

## Supabase

### [ ] Create the production Supabase project

Detailed directions:

1. Create a dedicated production Supabase project, separate from local or test environments.
2. Choose the region carefully based on your expected player base and legal constraints.
3. Name the project clearly so it cannot be confused with staging.
4. Record the project ref, dashboard URL, and primary owner in your credential inventory.
5. Apply the production migrations only after verifying you are targeting the production project.

Done when:

- Production Supabase exists.
- Team operators know exactly which project is production.

### [ ] Confirm billing tier and card on file

Detailed directions:

1. Review which Supabase features you need in production:
   - auth volume
   - database size
   - backups
   - edge functions
   - storage
2. Compare expected usage with the current billing tier.
3. Add or verify the business payment method.
4. Record who receives billing alerts.

Done when:

- The project is on an intentional plan with valid billing attached.

### [ ] Store production secrets in Supabase secrets/vault

Detailed directions:

1. Make a list of production secrets:
   - Stripe keys
   - AI provider keys
   - Git service credentials
   - storage signing secrets
   - any service webhooks or JWT secrets
2. Name each secret consistently.
3. Store the secrets in the approved secret mechanism for Supabase functions.
4. Remove any production secret that is currently only sitting in local `.env` files or chat logs.
5. Rotate any secret that may already have been shared insecurely.
6. Verify each edge function reads secrets from the secure source and not from hard-coded fallback values.

Done when:

- Required production secrets exist in the secret manager.
- No production secret is only stored in local files.

### [ ] Configure auth providers and email settings

Detailed directions:

1. Decide which auth methods will be supported at launch:
   - email magic links
   - email/password
   - OAuth providers
   - anonymous guest sessions for playtests
2. Enable only the providers you actually plan to support.
3. Configure branding and sender information for auth emails.
4. Confirm guest/anonymous auth behavior matches the room join plan.
5. Test sign-up, sign-in, sign-out, password reset if applicable, and guest session creation.

Done when:

- Supported auth methods are configured and tested.
- Email branding and sender settings are intentional.

### [ ] Configure redirect URLs for app and play origins

Detailed directions:

1. List every valid redirect origin and callback path:
   - production app
   - production play host if it needs auth callbacks
   - local development hosts
   - staging if applicable
2. Add only those URLs to the Supabase allowlist.
3. Remove temporary ngrok or personal hostnames that are no longer needed.
4. Test each auth flow end-to-end and confirm redirects land on the correct origin.

Done when:

- Auth redirects succeed from approved origins only.

### [ ] Review and enable backups / retention appropriate for the chosen plan

Detailed directions:

1. Check what automated backups and retention are included in the plan.
2. Decide how much data loss is acceptable.
3. Enable the strongest backup option you can justify before onboarding meaningful production data.
4. Record restore procedures and who can perform them.

Done when:

- Backup and restore expectations are known and enabled.

### [ ] Confirm region choice is acceptable before data accumulates

Detailed directions:

1. Review expected player geography and latency sensitivity.
2. Review any regulatory or customer-location constraints.
3. Decide whether the chosen region is good enough for the next 12 months.
4. If not, recreate or migrate before production traffic grows.

Done when:

- Region choice is explicitly accepted, not accidental.

## Stripe

### [x] Create or verify Stripe account

Verify:

1. The account owner is correct.
2. MFA is enabled.
3. The legal business information matches your intended payout entity.

### [ ] Submit any required business verification

Detailed directions:

1. Open Stripe's business verification dashboard.
2. Gather requested legal documents before starting.
3. Submit business identity, beneficial ownership, and any tax information required.
4. Track any pending follow-up requests until the account is fully cleared.

Done when:

- Stripe shows the account as verified or identifies no blockers to accepting live payments.

### [ ] Add business banking / payout details

Detailed directions:

1. Add the bank account used for payouts.
2. Confirm the account belongs to the correct legal entity.
3. Complete any micro-deposit or ownership verification steps.
4. Record who can update payout settings.

Done when:

- Live payouts are configured and verified.

### [ ] Add live mode card/billing details if required

Detailed directions:

1. Make sure live mode has a valid payment method for any Stripe fees or product features that require it.
2. Confirm billing notifications go to the right finance or operator contact.

Done when:

- Stripe live mode is financially operational.

### [ ] Configure products/prices strategy

Decision to make:

- Will games be one-time purchases, bundles, subscriptions, or a mix?

Detailed directions:

1. Decide the launch pricing model.
2. Define whether pricing is per game, per creator, or per entitlement bundle.
3. Create initial products and prices in Stripe using naming that matches the marketplace model.
4. Record which product IDs map to which listing or entitlement logic.
5. Decide how discounts, refunds, and retired prices will be handled.

Done when:

- There is a documented initial pricing strategy and the corresponding live Stripe products exist.

### [ ] Create production webhook destination for Supabase edge function

Detailed directions:

1. Deploy or identify the production webhook endpoint.
2. Create a live-mode webhook endpoint in Stripe that points to that URL.
3. Subscribe only to the event types you actually need.
4. Save the webhook signing secret into Supabase secrets.
5. Send test events and confirm the webhook verifies and processes them correctly.

Done when:

- The live webhook endpoint is configured and verified end-to-end.

### [ ] Rotate test keys to live keys when ready

Detailed directions:

1. Make a clear cutover checklist so test keys are not mixed with live keys.
2. Store live publishable and secret keys in the approved secret manager.
3. Update production environment config only after confirming live products and webhook are ready.
4. Run a live-mode smoke test with a tiny real charge if appropriate.

Done when:

- Production uses live keys only where intended.
- No test key remains wired into production services.

### [ ] Confirm tax, receipts, and support email settings

Detailed directions:

1. Review whether Stripe Tax or another tax process is needed at launch.
2. Configure receipt branding and support contact email.
3. Make sure refund and support channels referenced in receipts are real and monitored.

Done when:

- Customer-facing payment communications point to valid support channels.

### [ ] Review whether Stripe Connect is needed later or not

Decision to make:

- Is TurnBased only selling first-party listings, or will it later pay out third-party creators directly?

Detailed directions:

1. Document the near-term marketplace model.
2. If creator payouts are a future roadmap item, note whether Stripe Connect is the likely path.
3. Do not prematurely adopt Connect unless revenue splitting is actually in scope soon.

Done when:

- The team has a written decision: "not now", "evaluate later", or "required for launch".

## Git Service / VPS

### [x] Create VPS account, add payment method, provision server, install Docker, deploy Gitea/Forgejo

Verify:

1. The server is reachable.
2. Docker restarts services on reboot.
3. Persistent volumes are mounted and documented.
4. Access is limited to authorized operators.

### [ ] Configure backups for Git repos and config

Why this matters:

- The Git service is a source of truth for creator projects.
- Losing repositories or config would be high-impact.

Detailed directions:

1. Decide what must be backed up:
   - repository data
   - database
   - attachment storage
   - config files
   - SSH keys and app secrets as appropriate
2. Choose a backup destination separate from the VPS.
3. Schedule automated backups.
4. Test a restore into a disposable environment.
5. Record how often backups run and who is paged if they fail.

Done when:

- Backups run automatically.
- At least one restore test has succeeded.

### [ ] Set HTTPS/TLS strategy correctly; do not rely on insecure shortcuts long term

Detailed directions:

1. Decide whether TLS terminates at Cloudflare, a reverse proxy on the VPS, or both.
2. Install valid certificates for the chosen setup.
3. Force HTTPS at the Git hostname.
4. Test both browser access and Git clone/push over HTTPS.
5. If SSH cloning is supported, document the SSH host and key process separately.

Done when:

- Git traffic is encrypted in a production-grade way.
- No operator is relying on self-signed or temporary insecure exceptions.

### [ ] Create service PAT / bot credentials and store them in Supabase secrets

Detailed directions:

1. Create the minimum-privilege machine account or token needed for automation.
2. Scope permissions narrowly.
3. Store the credential in Supabase secrets.
4. Record the credential owner, scope, and rotation plan in the credential inventory.
5. Test the credential from the production integration path.

Done when:

- Automation credentials work.
- The secret is stored securely and is rotatable.

## AI Provider Accounts

### [x] Create and fund OpenRouter account

Verify:

1. Budget controls are enabled.
2. Billing ownership is documented.
3. MFA is enabled.

### [ ] Decide model allowlist by tier

Detailed directions:

1. Define product tiers first: free, paid, internal-only, or enterprise if applicable.
2. For each tier, list which model families are allowed for:
   - code tasks
   - rules and text tasks
   - reasoning-heavy tasks
   - experimental or premium features
3. Decide which models are blocked for cost, latency, or safety reasons.
4. Record the allowlist in an internal operator document and, if it becomes code-driven, mirror it in config.

Done when:

- There is a written model allowlist per tier.

### [ ] Set provider spending caps

Detailed directions:

1. Set monthly and, if possible, daily caps at the provider level.
2. Set internal alert thresholds below the hard cap.
3. Decide who gets notified when spend spikes.

Done when:

- Cost spikes have both a hard stop and a human alert path.

### [ ] Create accounts for image/audio providers when ready

Detailed directions:

1. Do not create extra providers until the feature roadmap actually needs them.
2. When needed, repeat the same baseline setup:
   - business-owned account
   - MFA
   - payment method
   - budget cap
   - secret storage
3. Record what feature each provider is meant to support.

Done when:

- Only the providers you truly need are live and operational.

### [ ] Store provider API keys securely in secrets manager

Detailed directions:

1. Generate production keys from the provider console.
2. Store them in Supabase secrets or the approved secret manager.
3. Remove copies from local `.env` files, screenshots, or ad hoc notes.
4. Rotate any key that may already have been exposed.

Done when:

- Production provider keys are stored securely and referenced by secret name.

## Email / Transactional Comms

### [ ] Choose and configure email provider for auth and transactional emails if Supabase defaults are not sufficient

Decision to make:

- Are Supabase's default auth emails enough for launch, or do you need a dedicated provider for deliverability, branding, and support workflows?

Detailed directions:

1. Define the outbound email categories:
   - auth emails
   - purchase receipts if not handled entirely by Stripe
   - support replies
   - marketplace notifications
2. Decide whether one provider will handle all categories.
3. Choose the provider and create the production account.
4. Configure the sender identity and templates needed at launch.

Done when:

- There is a documented email provider decision and working sender setup.

### [ ] Verify sending domain if needed

Detailed directions:

1. If the provider requires domain verification, add the SPF, DKIM, and any tracking records to DNS.
2. Wait for verification to complete.
3. Send test emails to multiple inbox providers and confirm they are not obviously failing authentication.

Done when:

- The sending domain is verified and test messages authenticate successfully.

### [ ] Configure support/reply addresses

Detailed directions:

1. Decide which inbox receives support, billing, and abuse-related replies.
2. Create the mailbox or forwarding rules.
3. Make sure receipts, auth emails, and policy pages reference a monitored address.

Done when:

- Customer-facing emails point to real monitored inboxes.

## Legal / Business Basics

### [ ] Decide legal entity structure for taking payments

Detailed directions:

1. Decide whether payments flow through an individual, LLC, corporation, or other structure.
2. Confirm the structure aligns with Stripe account details and payout banking.
3. If needed, consult a lawyer or accountant before accepting live money.

Done when:

- The entity accepting payments is decided and reflected in payment and tax accounts.

### [ ] Prepare privacy policy

Detailed directions:

1. Inventory what data you collect:
   - auth information
   - game/project data
   - purchase and entitlement data
   - analytics or logs if any
2. Describe why it is collected, where it is stored, and how users can request changes or deletion.
3. Make sure the document matches actual product behavior.

Done when:

- A launch-ready privacy policy exists and can be linked from the app.

### [ ] Prepare terms of service

Detailed directions:

1. Define the service you are actually offering at launch.
2. Cover account rules, acceptable use, payment terms, IP ownership, and limitation of liability as appropriate.
3. Make sure the terms reflect the marketplace and creator workflow, not a generic SaaS template.

Done when:

- A launch-ready terms document exists and can be linked from the app.

### [ ] Prepare acceptable use policy

Detailed directions:

1. Define the misuse categories that matter here:
   - abusive user-generated content
   - infringing uploads
   - malicious code attempts
   - harassment
2. Make sure moderation and enforcement expectations are realistic.

Done when:

- AUP language exists and supports moderation decisions.

### [ ] Decide refund policy

Detailed directions:

1. Decide whether digital game purchases are final, discretionary, or condition-based.
2. Align the policy with Stripe settings, support workflow, and any legal requirements.
3. Publish the policy where customers can find it before checkout if necessary.

Done when:

- Support and finance can answer "when do we refund?" consistently.

### [ ] Decide policy for experimental engine override projects in marketplace

Detailed directions:

1. Decide whether experimental projects are:
   - never publishable
   - publishable after manual review
   - publishable with warnings
2. Align this with the existing experimental-mode messaging in product code and docs.
3. Update user-facing docs and marketplace rules once decided.

Done when:

- The policy is explicit and consistent across docs, UI, and review practice.

## App-Store-Like Policy Decisions

### [ ] Decide whether experimental engine override projects can be published publicly

Detailed directions:

1. Make the policy decision jointly between product and operations.
2. Decide whether the current default restriction remains.
3. If the answer changes, update the UI, docs, and review checklist.

Done when:

- Publishability for experimental projects is a written policy, not tribal knowledge.

### [ ] Decide what support level to promise for advanced vs experimental projects

Detailed directions:

1. Write down support guarantees for:
   - standard projects
   - advanced hook projects
   - experimental override projects
2. Clarify whether compatibility and migration guarantees differ by tier.
3. Make the promise realistic for the team size.

Done when:

- Support scope is documented and can be shown to creators.

### [ ] Decide whether AI-generated assets need special disclosure

Detailed directions:

1. Decide whether the marketplace will require creators to disclose AI-generated images, audio, text, or code.
2. Decide whether disclosure is internal-only, user-facing, or both.
3. If required, define the field or workflow needed later in product implementation.

Done when:

- Disclosure policy exists and product requirements can be derived from it.

### [ ] Decide moderation/review approach for user-generated game content

Detailed directions:

1. Decide whether moderation is manual, reactive, proactive, or some mix.
2. Define what gets reviewed before publication versus after reports.
3. Define who handles abuse, takedown, and fraud cases.

Done when:

- There is a real moderation model, even if lightweight.

## Security And Operations

### [ ] Set up password manager or secret-sharing process for team credentials

Detailed directions:

1. Choose the team's credential-sharing tool.
2. Create folders or vaults for infra, billing, DNS, and third-party services.
3. Move all important account credentials into it.
4. Remove shared plaintext credential notes from ad hoc documents.

Done when:

- Critical service access is stored in a shared secure system.

### [ ] Enable MFA on Cloudflare, Supabase, Stripe, Git service host, and AI provider accounts

Detailed directions:

1. Audit every privileged service account.
2. Turn on MFA for each human admin.
3. Record backup codes or hardware-key ownership in the secure credential system.
4. Remove any admin who cannot meet the MFA policy.

Done when:

- All privileged operator accounts are MFA-protected.

### [ ] Decide backup strategy for Postgres, Git repos, and R2 bucket metadata

Detailed directions:

1. List all data classes that need recovery planning.
2. Decide backup frequency, retention, and restore owner for each.
3. Make sure the strategy covers both the database and object metadata, not only raw files.
4. Record restore drills and their cadence.

Done when:

- There is a documented recovery strategy for every core data store.

### [ ] Decide incident response contacts and recovery process

Detailed directions:

1. Define who is on point for:
   - billing/account lockouts
   - outage response
   - abuse reports
   - payment failures
   - security incidents
2. Create a lightweight incident checklist:
   - detect
   - contain
   - communicate
   - recover
   - review
3. Record emergency contacts and escalation paths in the team's private ops system.

Done when:

- The team knows who responds when production breaks.

## Documentation And Process

### [ ] Decide commit message convention

Detailed directions:

1. Pick a convention the team will actually follow.
2. Keep it lightweight unless there is a strong release automation reason to require more structure.
3. Document a few examples.

Done when:

- New commits follow a shared convention.

### [ ] Decide release/versioning convention for engine packages

Detailed directions:

1. Decide whether package versions move independently or together.
2. Decide how breaking engine changes are communicated to published game manifests.
3. Write down the rules for patch, minor, and major bumps.

Done when:

- Package versioning policy is documented and aligns with pinned build manifests.

### [ ] Decide ADR template and governance process

Detailed directions:

1. Decide what every ADR must contain.
2. Decide when an ADR is required.
3. Decide who can mark an ADR accepted, superseded, or rejected.

Done when:

- Architecture decisions follow a repeatable format and review flow.

### [ ] Decide how AI agent context is assembled from docs and code

Detailed directions:

1. Decide which docs are canonical for AI grounding.
2. Decide how code references and docs stay in sync.
3. Decide whether a generated summary or curated index should exist beyond `Agents.md`.
4. Revisit this whenever the architecture or onboarding experience becomes confusing.

Done when:

- AI-facing project context is intentional and maintainable.
