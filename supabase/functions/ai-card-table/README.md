# AI card-table suggestions

`POST /functions/v1/ai-card-table` creates a preview for one table column or a
single cell. It never writes project data. The browser reviews and applies the
returned values, checks for edits made since the request, and offers undo.

The request needs a valid `Authorization: Bearer <Supabase access token>` for a
signed-in, non-anonymous user. The handler verifies the token with Supabase
Auth. `OPTIONS` supports CORS; other methods return 405.

```json
{
  "target": { "field": "custom:points", "rowIds": ["lantern", "tea"] },
  "rows": [
    {
      "id": "lantern",
      "title": "Lantern",
      "body": "Light the market.",
      "cost": "2",
      "category": "Tools",
      "copies": 3,
      "customFields": { "points": "1" }
    },
    {
      "id": "tea",
      "title": "Moon Tea",
      "body": "Share a cup.",
      "cost": "3",
      "category": "Pantry",
      "copies": 2,
      "customFields": { "points": "2" }
    }
  ],
  "game": {
    "name": "Moonlit Market",
    "theme": "Woodland traders",
    "rules": "Gather coins or buy a card. Most points wins."
  },
  "prompt": "Suggest points that are balanced against the coin costs.",
  "modelId": "moonshotai/kimi-k2.6"
}
```

Use `title`, `body`, `cost`, `category`, `copies`, or `custom:<column key>` as
the target field. Custom keys must already exist in each target row's
`customFields`; an empty string is sufficient. A column request lists every
selected row ID; a cell request lists one. Context may include additional rows.
Artwork and unrelated project fields are omitted from the provider request.

The endpoint shares the rules writer's supported model catalog and temperature
capabilities. Without `modelId`, configuration is checked in this order:
`OPENROUTER_CARD_TABLE_MODEL`, `OPENROUTER_RULES_MODEL`,
`OPENROUTER_DEFAULT_MODEL`, then the catalog default. Administrator-disabled
models remain disabled. `OPENROUTER_API_KEY` and the usual Supabase URL, anon
key, and service-role key must be configured.

## Response and validation

Success returns `{ success: true, field, edits, model, usage, cost }`, where
`edits` contains `{ rowId, value }` in the requested order. Values are strings,
except `copies`, which is an integer. Provider output must contain every
requested ID exactly once, without extra fields or edits. Invalid, duplicate,
missing, or out-of-scope results produce an error without returning a partial
preview.

Titles must contain non-whitespace text. Copy-count suggestions must keep the
merged table at or below 2,000 cards, including unchanged context rows. Both
constraints are checked on the server before any customer debit, and the
browser checks them again before applying edits. The copy-count total does not
block suggestions for unrelated text fields in a table that already exceeds
the batch limit.

Internally, context rows receive stable short aliases (`r1`, `r2`, …). The
provider returns `{ "values": { "r1": "..." } }` with exactly the target aliases
required by its schema. The server rejects missing, duplicate, and extra keys,
then maps validated values back to the original row IDs in the public `edits`
response. Provider diagnostics record a failure category, never private row IDs
or card values.

Limits are enforced before the provider call:

| Input                              | Limit                                |
| ---------------------------------- | ------------------------------------ |
| JSON request                       | 256 KiB of UTF-8 bytes               |
| Context rows / target rows         | 200 / 100                            |
| Instruction                        | 4,000 characters; required           |
| Game name / theme / rules          | 200 / 4,000 / 60,000 characters      |
| Title / category / cost            | 200 / 200 / 100 characters           |
| Body / custom field value          | 8,000 characters                     |
| Custom fields per row / key length | 32 / 64 characters                   |
| Row ID                             | 128 characters; non-empty and unique |
| Copies                             | Whole number from 0 through 99       |

The provider response uses a strict JSON schema, at most 8,192 output tokens,
and a 120-second timeout. Title schemas and prompt instructions also guide the
model to return nonblank titles; server validation remains authoritative.

## Billing and failures

Generation is the paid operation; applying a preview makes no additional AI
call. The endpoint uses OpenRouter's returned `usage.cost` when available.
Otherwise it uses configured token prices, marked `source: "catalog_estimate"`;
absent prices are marked `source: "unknown"`. `cost.actualCostKnown`
distinguishes actual usage from an estimate. Responses include token counts,
provider USD cost, rounded provider cents, platform-fee cents, and total charged
cents. The platform fee matches the provider cents, following the existing
wallet policy.

Usage history records the authenticated user, model, target field and row
counts, token usage, cost source, and provider response ID. It excludes
instructions, rulebook text, and card contents. Invalid provider edits record
any reported provider cost but do not debit the designer. A valid paid preview
remains available if writing usage history fails; the endpoint never retries
generation automatically.

Errors return `{ "error": "..." }`: 400 for invalid input or model, 401 for
missing/invalid/anonymous auth, 402 for insufficient wallet balance, 403 for a
disabled model, 413 for excessive request size, 502 for provider or structured
response failures, and 503 for unavailable configuration/catalog/billing
services. Raw provider error bodies are not exposed. Wallet errors return no
edits and record the incurred provider cost with zero customer charge.

Run mocked checks without provider calls:

```sh
npx tsx --test supabase/functions/ai-card-table/*.test.ts
deno check supabase/functions/ai-card-table/index.ts
deno lint supabase/functions/ai-card-table
```
