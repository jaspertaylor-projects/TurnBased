# BoardGameMaker API Guide

This documentation covers the endpoints exposed by the BoardGameMaker API Server. The server routes are prefixed with `/v1` except for health checks.

## Table of Contents
- [Health](#health)
- [Suppliers](#suppliers)
- [Admin](#admin)
- [Catalog](#catalog)
  - [Product Object](#product-object)
- [Quotes](#quotes)

---

## Health
Endpoints used for probing the service state.

### `GET /health`
Liveness probe determining if the API server process is responding.
**Response**:
```json
{ "status": "ok" }
```

### `GET /ready`
Readiness probe verifying successful connections to the database.
**Response**:
```json
{
  "status": "ok",
  "database": "connected",
  "catalogStatus": "ready"
}
```

---

## Suppliers
The catalog is multi-supplier. Every product belongs to a supplier, identified by a short `supplierCode` and exposed on product responses as `supplierId`. Ingestion is handled by a per-supplier adapter behind a shared pipeline.

| Code  | Supplier         | Source                          | Ingestion method                                    |
|-------|------------------|---------------------------------|-----------------------------------------------------|
| `bgm` | BoardGamesMaker  | https://www.boardgamesmaker.com | HTML scraping (Cheerio)                             |
| `tgc` | The Game Crafter | https://www.thegamecrafter.com  | "Wing" REST API + curated printable-product catalog |

**The Game Crafter (`tgc`)** ingests from two sources, both producing the standard product shape (**one product with a single default variant** carrying price tiers):

1. **Stock components** — pulled live from the Wing API's `/api/part` endpoint. Each part is a single SKU with built-in volume pricing. These use component-style categories: `tokens`, `dice`, `minifigs`, `people`, `vehicles`, `buildings`, `animals`, `blanks`, `pawns`, `containers`, `bags`, `money`, etc.
2. **Custom-printed products** — card decks, game boards, booklets, score pads, and boxes. These are **not exposed by any TGC catalog endpoint** (their sizes are fixed "identities" priced only at game-build time), so they are maintained as a **curated static catalog** whose specs, price tiers, and preview images are sourced from TGC's published pricing/catalog (verified June 2026). They use the categories `cards`, `boards`, `booklets`, `scorepads`, and `boxes`, and are slugged under a distinct **`tgc-print-`** prefix (e.g. `tgc-print-poker-deck`) so they never collide with a stock part of the same name. Each carries an `imageUrl` from TGC's product-image CDN.

Notes on the curated printable products:
- The Game Crafter prices **cards and boards per *sheet*** (a sheet holds a fixed number of cards/panels) and books/boxes/pads **per each**. The unit is recorded in each product's `description` and a "Priced Per" option; `priceTiers[].unitPrice` is the price of that purchasable unit.
- Two published copy tiers exist: **1+** (`minQuantity: 1`) and **100+** (`minQuantity: 100`). There is no 1000-copy tier (TGC requires a custom quote at that volume).
- Prices **exclude** TGC's $0.89/copy handling fee and optional coatings — clients/quote logic should add those separately.
- A few products carry an inferred API identity (noted in their `description`); their prices are still high-confidence.

Because category values differ across suppliers, clients that filter by category should not assume a single fixed set — omit the filter to retrieve the full catalog.

TGC slugs are namespaced to guarantee global uniqueness: stock parts use `tgc-<uri_part>` (e.g. `tgc-11-x-11-baggies`) and curated printable products use `tgc-print-<name>` (e.g. `tgc-print-poker-deck`).

> **Configuration**: TGC ingestion requires `GAMECRAFTER_USERNAME`, `GAMECRAFTER_PASSWORD`, and `GAMECRAFTER_PUBLIC_KEY` (the API Key ID) in the environment. A session is minted per run; a pre-minted `GAMECRAFTER_SESSION_ID` may be supplied instead. The username must be the TGC account username, not the email address.

---

## Admin
**Base Route**: `/v1/admin`

Administrative controls for monitoring and controlling the background scraping and ingestion engine.

### `GET /scrape-runs`
Fetches recent catalog scraping job runs.

### `GET /products/stale`
Identifies products whose cache or ingestion timestamp indicates they have not been updated recently.

### `GET /products/changes`
Lists recent structural or pricing changes detected across the catalog.

### `POST /refresh`
Triggers an immediate full ingestion run via the `IngestionService`. Defaults to the `bgm` supplier.

### `POST /refresh/:supplierCode`
Triggers an immediate full ingestion run for a specific supplier (e.g. `bgm`, `tgc`). Returns the created `ScrapeRun` record (`status: "started"`); the run proceeds asynchronously in the background. Progress can be polled via `GET /scrape-runs`. Re-running is safe — products are upserted in place by slug, so existing rows are refreshed rather than duplicated.

Example:
```
POST /v1/admin/refresh/tgc
```

---

## Catalog
**Base Route**: `/v1`

Core domain queries handling product extraction, variants, and configurations.

### `GET /products`
Retrieves a paginated list of catalog products.

**Query Parameters** (`GetProductsDto`):
- `category` (string, optional)
- `subcategory` (string, optional)
- `q` (string, optional): Search term query.
- `page` (number, optional, default: 1)
- `pageSize` (number, optional, default: 20)
- `activeOnly` (boolean, optional, default: true)

Each returned product includes an `imageUrl` field (see [Product Object](#product-object)). Results span all suppliers; the `category` / `subcategory` values vary by supplier (see [Suppliers](#suppliers)), so omit the `category` filter to retrieve products across the full multi-supplier catalog.

### `GET /products/:slug`
Fetches a specific product and its default variant matrix based on its unique slug identifier.

### `GET /variants/:variantId`
Fetches details of a specific product variant, including its explicit option sets. Option sets depend on the supplier and category.

BoardGamesMaker (`bgm`) products expose configurable option matrices:
- **Cards**: `Deck Size`, `Material`, `Print Finish`
- **Boards**: `Material`, `Print Finish`
- **Tiles**: `Tiles per Sheet`, `Print Finish`

The Game Crafter (`tgc`) products have a single default variant. Its options describe the fixed component rather than configurable choices, and are populated where available:
- `Material`, `Color`, `Number of Sides`

### `GET /products/:slug/layout`
Retrieves physical layout metadata for the specified product.
**Query Parameters**:
- `variantId` (string, optional)

### `GET /variants/:variantId/pricing`
Retrieves the tiered volume discount pricing array for a specific product variant.

### Product Object
Catalog product responses (`GET /products` items and `GET /products/:slug`) have the following shape:
```json
{
  "id": "uuid",
  "supplierId": "uuid",
  "externalProductId": "fi-8975",
  "slug": "custom-mini-us-game-deck",
  "title": "Custom 2.2X3.43 US Game Deck",
  "category": "cards",
  "subcategory": "standard",
  "shape": null,
  "sourceUrl": "https://www.boardgamesmaker.com/print/custom-mini-us-game-deck.html",
  "imageUrl": "https://cd2.boardgamesmaker.com/AttachFiles/WebsiteImages/Product_Show/FI_8974.jpg",
  "description": "Custom printed mini US-sized game deck.",
  "currency": "USD",
  "status": "active"
}
```
`imageUrl` is the primary preview image for the product, captured during ingestion (`og:image`, falling back to the main gallery image). It is an absolute URL to the supplier's CDN and may be `null` if no image was found. It is intended to be rendered directly by clients; the API does not proxy or host the image.

`description` is a free-text product description captured during ingestion, or `null` if the source provided none.

A The Game Crafter (`tgc`) product looks like:
```json
{
  "id": "uuid",
  "supplierId": "uuid",
  "externalProductId": "0DDAE2A6-371F-11E6-BF52-F30B71C3C4B9",
  "slug": "tgc-11-x-11-baggies",
  "title": "11 X 11 Baggies",
  "category": "bags",
  "subcategory": "Plastic Baggies",
  "shape": null,
  "sourceUrl": "https://www.thegamecrafter.com/parts/11-x-11-baggies",
  "imageUrl": "https://s3.amazonaws.com/preview.thegamecrafter.com/9AA02B16-C43E-11ED-8361-9686DB6D3EB3.png",
  "description": "An 11\" by 11\" plastic resealable baggie. Perfect for all your part or card holding needs.",
  "currency": "USD",
  "status": "active"
}
```

---

## Quotes
**Base Route**: `/v1/quotes`

Handles deterministically mapping product selections and configurations to explicit financial quotes including buffer pricing.

### `POST /`
Creates a formal Quote. Idempotent based strictly on a unique `quoteRequestId`.

**Body Model** (`CreateQuoteDto`):
```json
{
  "quoteRequestId": "string",  // Required: Unique request tracking ID
  "supplierCode": "string",    // Required: e.g. "bgm" or "tgc"
  "productSlug": "string",     // Required: Specific product slug
  "variantId": "string",       // Required: Specific configuration variant ID
  "quantity": 10,              // Required: Must be >= 1
  "currency": "USD",           // Optional: default "USD"
  "optionSelections": {}       // Optional: Record string dictionary of generic option keys
}
```

**Response**:
```json
{
  "quoteId": "uuid",
  "catalogVersion": "2026-06-26T00:00:00Z",
  "unitPrice": 2.99,
  "subtotal": 29.9,
  "markupAmount": 3.588,
  "riskBufferAmount": 0.897,
  "handlingAmount": 8.9,
  "total": 43.285,
  "currency": "USD",
  "pricingSource": { "variantId": "uuid", "pricingInputs": { } }
}
```

`total` = `subtotal` + `markupAmount` + `riskBufferAmount` + `handlingAmount`.

`handlingAmount` covers **The Game Crafter's flat $0.89-per-copy handling fee**, which applies **only** to TGC's curated custom-printed products (categories `cards`, `boards`, `booklets`, `scorepads`, `boxes` — identified by a `tgc-curated-` `externalProductId`). It is `0` for TGC stock parts and for all other suppliers. The fee is a pass-through added **after** markup and risk buffer, so it is not itself marked up. The per-copy rate is echoed in `pricingInputs.handlingFeePerCopy`.
