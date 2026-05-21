# BoardGameMaker API Guide

This documentation covers the endpoints exposed by the BoardGameMaker API Server. The server routes are prefixed with `/v1` except for health checks. 

## Table of Contents
- [Health](#health)
- [Admin](#admin)
- [Catalog](#catalog)
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
Triggers an immediate full ingestion run for the catalog via the `IngestionService`.

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

### `GET /products/:slug`
Fetches a specific product and its default variant matrix based on its unique slug identifier.

### `GET /variants/:variantId`
Fetches details of a specific product variant, including its explicit option sets:
- **Cards**: `Deck Size`, `Material`, `Print Finish`
- **Boards**: `Material`, `Print Finish`
- **Tiles**: `Tiles per Sheet`, `Print Finish`

### `GET /products/:slug/layout`
Retrieves physical layout metadata for the specified product.
**Query Parameters**:
- `variantId` (string, optional)

### `GET /variants/:variantId/pricing`
Retrieves the tiered volume discount pricing array for a specific product variant. 

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
  "supplierCode": "string",    // Required: e.g. "bgm"
  "productSlug": "string",     // Required: Specific product slug
  "variantId": "string",       // Required: Specific configuration variant ID
  "quantity": 10,              // Required: Must be >= 1
  "currency": "USD",           // Optional: default "USD"
  "optionSelections": {}       // Optional: Record string dictionary of generic option keys
}
```
