# Design Doc: Supplier Catalog / Quote Service

## 1. Overview

Build an internal backend service that maintains a normalized supplier catalog
and exposes a stable API for:

- component/product discovery
- size and layout metadata
- manufacturing constraints
- supplier-backed pricing tiers
- deterministic quote generation

This service exists to shield the main board game creation platform from
supplier site complexity. The main website will never scrape supplier pages
directly and will never contain supplier-specific parsing logic.

Primary supplier target for the first implementation is BoardGamesMaker, but the
architecture must support additional suppliers later.

## 2. Responsibilities

This service is responsible for:

- ingesting supplier catalog/product data from public supplier pages
- normalizing products, variants, layout metadata, and pricing tiers
- exposing read APIs for component discovery and configuration
- generating versioned quotes from stored pricing data
- storing quote audit records
- tracking catalog freshness and scrape health

This service is not responsible for:

- user accounts
- project storage
- end-user files/artwork
- payment processing
- supplier order placement
- browser automation checkout
- customer support workflows

## 3. External and Internal Context

### Upstream dependency

- supplier website content

### Downstream clients

- main board game creation website
- internal admin tools
- future supplier fulfillment service

### Boundary rule

The main website may only interact with this service through HTTP API. It must
not know:

- scraping selectors
- supplier DOM structure
- raw supplier pricing table formats
- supplier-specific option parsing rules

## 4. Goals

### Primary goals

- provide reliable component metadata
- expose dimensions and layout requirements for design generation
- provide deterministic pricing quotes from cached supplier data
- keep quoting fast and independent of live scraping
- support catalog refresh with change detection

### Secondary goals

- preserve raw supplier snapshots for debugging
- support catalog versioning
- enable future multi-supplier support
- make quote behavior auditable and reproducible

### Non-goals

- live supplier checkout
- user-facing commerce frontend
- real-time supplier availability polling on request path

## 5. High-Level Architecture

The system consists of three logical layers:

### A. Ingestion layer

Responsible for supplier discovery, fetch, parse, and reconciliation.

### B. Domain/API layer

Responsible for serving normalized catalog data and generating quotes.

### C. Persistence/cache layer

Responsible for catalog storage, quote storage, snapshots, and caching.

### Flow

1. scheduled jobs crawl supplier product pages
2. raw pages are stored and parsed
3. normalized records are written to the database
4. effective catalog version is published
5. downstream APIs serve only stored data
6. quote endpoint computes against stored pricing tiers

## 6. Recommended Tech Stack

### Preferred stack

- Language: TypeScript
- API framework: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Queue/jobs: BullMQ
- Cache: Redis
- Scraping: Playwright plus Cheerio
- Storage: S3-compatible object storage
- Deployment: Dockerized containers
- Logging/monitoring: structured logs plus metrics

### Rationale

- NestJS gives clean modular boundaries
- Postgres fits normalized pricing and layout records
- Redis/BullMQ is sufficient for ingestion jobs
- Playwright handles brittle supplier pages when browser automation is needed
- Cheerio allows faster parsing when plain HTML is enough

## 7. Service Modules

### catalog module

- product read APIs
- variant read APIs
- layout APIs
- pricing read APIs

### quotes module

- quote request validation
- price tier lookup
- markup/risk buffer calculation
- quote persistence
- quote audit APIs if needed

### ingestion module

- scrape run lifecycle
- queue orchestration
- fetch/parse/reconcile jobs
- snapshot storage
- freshness/version publication

### suppliers module

- supplier adapter interface
- supplier-specific discovery
- supplier-specific selectors and parsers
- fixture-based parser tests

### admin module

- scrape run status
- stale product visibility
- change summaries
- manual refresh trigger for internal ops

## 8. Core Domain Concepts

### Supplier

An external manufacturing source.

### Product

A supplier product family, such as custom cards, boards, dice, or tokens.

### Variant

A concrete configuration family within a product, such as size, material,
finish, or fold type.

### Option

A selectable value associated with a variant.

### Layout Constraint

Design-generation requirements:

- dimensions
- bleed
- safe zone
- required DPI
- panel count
- cutline requirements
- face definitions

### Price Tier

A quantity bracket with associated unit price or total price.

### Quote

A computed result for product plus variant plus quantity plus selected options.

### Catalog Version

A published snapshot identifier used for reproducible quotes.

## 9. Functional Requirements

### 9.1 Catalog ingestion

The service must:

- discover supplier product URLs
- fetch product pages
- store raw snapshots
- parse product metadata
- parse option sets
- parse layout metadata
- parse pricing tiers
- upsert normalized records
- track ingestion runs and failures

### 9.2 Product and layout APIs

The service must:

- list products by category/subcategory
- return product detail by slug or ID
- return variants for a product
- return options for a variant
- return layout constraints for a variant
- return pricing tiers for a variant

### 9.3 Quote generation

The service must:

- accept quote requests by product or variant
- validate options and quantity
- resolve applicable pricing tier
- apply configurable markup and risk rules
- return a deterministic quote
- persist the quote with catalog version

### 9.4 Versioning/freshness

The service must:

- publish a current effective catalog version
- expose last successful sync
- continue serving last known good data during scrape failures

## 10. Non-Functional Requirements

### Reliability

- quote generation must not depend on live scraping
- partial ingestion failure must not invalidate the active catalog

### Performance

- product read endpoints should typically return under 200 ms from warm cache
- quote generation should typically return under 300 ms

### Scalability

- support multiple suppliers later
- support tens of thousands of variants
- support frequent internal quote requests

### Auditability

- every quote must store source catalog version and matched pricing tier

### Maintainability

- supplier parsers must be isolated from core API logic
- parser logic must be fixture-testable from saved HTML

### Security

- service should be internal-only
- no user PII should be stored unless explicitly required
- service-to-service authentication is required

## 11. Data Model

### 11.1 suppliers

suppliers ( id uuid primary key, code text unique not null, name text not null,
base_url text not null, is_active boolean not null default true, created_at
timestamptz not null, updated_at timestamptz not null );

### 11.2 catalog_products

catalog_products ( id uuid primary key, supplier_id uuid not null references
suppliers(id), external_product_id text null, slug text unique not null, title
text not null, category text not null, subcategory text null, source_url text
not null, description text null, currency text not null default 'USD', status
text not null default 'active', raw_source_hash text null, first_seen_at
timestamptz not null, last_seen_at timestamptz not null, created_at timestamptz
not null, updated_at timestamptz not null );

### 11.3 product_variants

product_variants ( id uuid primary key, product_id uuid not null references
catalog_products(id), variant_code text not null, title text not null,
is_default boolean not null default false, status text not null default
'active', created_at timestamptz not null, updated_at timestamptz not null,
unique(product_id, variant_code) );

### 11.4 variant_options

variant_options ( id uuid primary key, variant_id uuid not null references
product_variants(id), option_group text not null, option_key text not null,
option_label text not null, option_value text not null, display_order int not
null default 0, created_at timestamptz not null, updated_at timestamptz not
null, unique(variant_id, option_group, option_key) );

### 11.5 layout_constraints

layout_constraints ( id uuid primary key, variant_id uuid not null references
product_variants(id), face_key text not null, width_mm numeric null, height_mm
numeric null, width_px int null, height_px int null, bleed_mm numeric null,
safe_zone_mm numeric null, dpi int null, panel_count int null, cutline_required
boolean not null default false, notes text null, constraints_json jsonb not null
default '{}', created_at timestamptz not null, updated_at timestamptz not null
);

### 11.6 price_tiers

price_tiers ( id uuid primary key, variant_id uuid not null references
product_variants(id), min_quantity int not null, max_quantity int null,
unit_price numeric(12,4) not null, total_price numeric(12,4) null, currency text
not null default 'USD', created_at timestamptz not null, updated_at timestamptz
not null );

### 11.7 scrape_runs

scrape_runs ( id uuid primary key, supplier_id uuid not null references
suppliers(id), run_type text not null, status text not null, started_at
timestamptz not null, finished_at timestamptz null, pages_fetched int not null
default 0, products_discovered int not null default 0, products_updated int not
null default 0, parse_failures int not null default 0, error_summary text null,
created_at timestamptz not null );

### 11.8 raw_snapshots

raw_snapshots ( id uuid primary key, scrape_run_id uuid not null references
scrape_runs(id), product_id uuid null references catalog_products(id),
source_url text not null, content_type text not null, storage_key text not null,
content_hash text not null, created_at timestamptz not null );

### 11.9 quotes

quotes ( id uuid primary key, quote_request_id text unique not null, supplier_id
uuid not null references suppliers(id), product_id uuid not null references
catalog_products(id), variant_id uuid not null references product_variants(id),
quantity int not null, currency text not null, input_options_json jsonb not
null, pricing_inputs_json jsonb not null, unit_price numeric(12,4) not null,
subtotal numeric(12,4) not null, markup_amount numeric(12,4) not null default 0,
risk_buffer_amount numeric(12,4) not null default 0, total numeric(12,4) not
null, catalog_version text not null, created_at timestamptz not null );

## 12. API Design

This is an internal API only.

### Authentication

Use one of:

- service JWT
- mTLS
- temporary internal API key for MVP

JWT is preferred.

### 12.1 Health endpoints

GET /health

- liveness only

GET /ready

- readiness of DB, Redis, and current catalog status

GET /v1/catalog/version Returns:

- supplier
- current catalogVersion
- lastSuccessfulSyncAt
- stale flag

Example response: { "supplier": "bgm", "catalogVersion": "2026-04-01T08:15:00Z",
"lastSuccessfulSyncAt": "2026-04-01T08:15:00Z", "stale": false }

### 12.2 Product APIs

GET /v1/products Query params:

- category
- subcategory
- q
- page
- pageSize
- activeOnly

GET /v1/products/:slug Returns product detail plus variants.

GET /v1/variants/:variantId Returns:

- variant metadata
- option groups
- layout metadata
- pricing metadata

GET /v1/products/:slug/layout Query params:

- variantId
- optionSelections if relevant

Returns only design-relevant layout info.

Example response: { "productSlug": "custom-poker-cards", "variantId": "var_1",
"faces": [ { "faceKey": "front", "widthMm": 63, "heightMm": 88, "bleedMm": 3,
"safeZoneMm": 2, "dpi": 300 }, { "faceKey": "back", "widthMm": 63, "heightMm":
88, "bleedMm": 3, "safeZoneMm": 2, "dpi": 300 } ], "constraints": {
"panelCount": 2, "cutlineRequired": false } }

### 12.3 Pricing APIs

GET /v1/variants/:variantId/pricing Returns price tiers.

Example response: { "variantId": "var_1", "currency": "USD", "tiers": [ {
"minQuantity": 1, "maxQuantity": 9, "unitPrice": 6.5 }, { "minQuantity": 10,
"maxQuantity": 49, "unitPrice": 4.9 }, { "minQuantity": 50, "maxQuantity": 99,
"unitPrice": 3.8 } ] }

POST /v1/quotes Request: { "quoteRequestId": "quote_abc123", "supplierCode":
"bgm", "productSlug": "custom-poker-cards", "variantId": "var_1", "quantity":
250, "currency": "USD", "optionSelections": { "stock": "linen_310gsm", "print":
"double_sided" } }

Response: { "quoteId": "qt_1", "catalogVersion": "2026-04-01T08:15:00Z",
"unitPrice": 2.45, "subtotal": 612.5, "markupAmount": 61.25, "riskBufferAmount":
18.0, "total": 691.75, "currency": "USD", "pricingSource": { "variantId":
"var_1", "matchedTier": { "minQuantity": 100, "maxQuantity": 499 } } }

## 13. Quote Computation Rules

### Base rule

1. resolve product and variant
2. validate option selections
3. select matching pricing tier by quantity
4. compute subtotal
5. apply markup
6. apply risk buffer
7. round according to configured rule
8. persist quote record

### Example formula

base_unit_price = tier.unit_price subtotal = base_unit_price * quantity
markup_amount = subtotal * markup_rate risk_buffer_amount = risk_rule(subtotal,
product, supplier) total = subtotal + markup_amount + risk_buffer_amount

### Configurable rule model

{ "defaultMarkupRate": 0.1, "categoryMarkupRates": { "cards": 0.12, "boards":
0.15 }, "riskBufferRules": { "default": { "type": "percent", "value": 0.03 } },
"rounding": { "mode": "up_to_cents" } }

### Idempotency

- quoteRequestId must be treated as idempotent
- repeated requests with identical inputs should return the existing stored
  quote if appropriate

## 14. Ingestion Pipeline

### Job types

- catalog.discoverProducts
- catalog.fetchProduct
- catalog.parseProduct
- catalog.reconcile
- catalog.fullRefresh
- catalog.verifyStaleProducts

### Flow

1. create scrape run
2. fetch discovery/category pages
3. extract product URLs
4. enqueue fetch jobs
5. fetch HTML
6. store snapshot
7. parse normalized data
8. compare against current records
9. upsert product/variant/layout/pricing data
10. publish catalog version when run succeeds

### Failure handling

- per-page retries with backoff
- parser failures logged with product context
- last known good records remain active if new parse fails
- incomplete runs do not automatically replace the active catalog version

### Change detection

Record and expose:

- product added
- product removed
- price changed
- option changed
- layout changed

## 15. Supplier Adapter Design

Each supplier must implement an adapter interface.

Suggested interface: interface SupplierCatalogAdapter { discoverProductUrls():
Promise<string[]>; fetchProduct(url: string): Promise<RawSupplierPage>;
parseProduct(page: RawSupplierPage): Promise<ParsedProduct>; }

Parsed output contract: type ParsedProduct = { product: { externalProductId?:
string; slug: string; title: string; category: string; subcategory?: string;
sourceUrl: string; description?: string; currency: string; }; variants: Array<{
variantCode: string; title: string; isDefault?: boolean; options: Array<{
optionGroup: string; optionKey: string; optionLabel: string; optionValue:
string; }>; layoutConstraints: Array<{ faceKey: string; widthMm?: number;
heightMm?: number; widthPx?: number; heightPx?: number; bleedMm?: number;
safeZoneMm?: number; dpi?: number; panelCount?: number; cutlineRequired?:
boolean; notes?: string; constraintsJson?: Record<string, unknown>; }>;
priceTiers: Array<{ minQuantity: number; maxQuantity?: number | null; unitPrice:
number; totalPrice?: number | null; currency: string; }>; }>; rawMetadata:
Record<string, unknown>; };

## 16. Caching Strategy

Use Redis for:

- product detail cache
- variant detail cache
- layout cache
- pricing cache
- optionally quote idempotency cache

### Cache key examples

- catalog:product:{slug}:{catalogVersion}
- catalog:variant:{variantId}:{catalogVersion}
- catalog:layout:{variantId}:{catalogVersion}
- catalog:pricing:{variantId}:{catalogVersion}
- quote:{quoteRequestId}

### Invalidation

Prefer versioned keys over destructive invalidation where possible.

## 17. Observability and Admin

### Metrics

Track:

- scrape success rate
- scrape duration
- pages fetched
- parser failures
- stale products
- quote request rate
- quote failure rate
- cache hit rate

### Logging

Use structured logs with:

- requestId
- scrapeRunId
- supplierCode
- productSlug
- variantId
- quoteRequestId

### Admin endpoints

- GET /v1/admin/scrape-runs
- GET /v1/admin/products/stale
- GET /v1/admin/products/changes
- POST /v1/admin/refresh

These must not be public.

## 18. Deployment Model

### MVP deployment

Acceptable initial deployment:

- API container
- worker container
- Redis
- Postgres

Prefer managed Postgres.

### Process separation

API and ingestion worker must run as separate processes even if colocated on one
host initially.

### Environments

- local
- staging
- production

## 19. Testing Requirements

### Unit tests

- pricing tier selection
- quote calculation
- option validation
- stale catalog detection

### Integration tests

- product endpoints
- quote endpoint
- admin endpoints

### Parser tests

- fixture-based HTML tests
- changed selector handling
- missing pricing section
- alternate option orderings
- malformed page handling

### Migration tests

- schema bootstrapping
- basic seed verification

## 20. Open Decisions

- whether quotes include shipping
- whether FX conversion is needed
- quote validity duration
- exact markup/risk policies
- how much raw supplier metadata to preserve in DB

Recommended defaults:

- no shipping in quote v1
- supplier-native currency only
- quote expires in 24 to 72 hours
- keep raw metadata in snapshots plus limited structured JSON

## 21. AI Agent Implementation Plan

### Phase 0

Write up a readme describing what this rep does and how to run it both locally
and host it on digtal ocean

### Phase 1

- scaffold NestJS app
- wire Prisma, Redis, BullMQ
- add health endpoints
- add config system
- add Docker setup

### Phase 2

- implement database schema
- implement catalog read endpoints
- implement DTO validation
- implement basic admin endpoints

### Phase 3

- implement quote engine
- implement quote persistence
- implement idempotency

### Phase 4

- implement ingestion framework
- scrape run lifecycle
- raw snapshot persistence
- supplier adapter interface

### Phase 5

- implement first supplier adapter
- product parsing
- layout parsing
- pricing parsing
- fixture tests

### Phase 6

- add caching
- add structured logging and metrics
- add change summaries and stale detection

### Phase 7

- harden retries, partial failure behavior, and operational visibility

## 22. Acceptance Criteria

The service is acceptable when:

1. it can ingest at least one supplier product family end-to-end
2. it can return normalized product, variant, layout, and pricing data
3. it can generate deterministic versioned quotes from stored data
4. quotes persist with audit record and catalog version
5. scrape failures do not break serving existing catalog data
6. parser logic is fixture-tested
7. API and worker are separate processes
