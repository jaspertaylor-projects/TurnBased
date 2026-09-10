# Supplier preparation

Print & share → supplier preparation gathers the physical materials for one or
more copies of a game. The designer matches each component, reviews quantities,
downloads artwork, and completes the purchase with the supplier. This workflow
does not upload a project to a supplier, create a cart, charge for manufacturing,
submit an order, or arrange delivery.

## Component matching and quantities

`SupplierMatchDialog` is shared with Components → Physical settings. It records
the supplier product and variant on the existing physical instance. Printable
products can explicitly resize the template; stock parts retain the supplier's
appearance. Linking a stock coin does not print the designer's coin artwork.
See [SUPPLIER_MATCHING.md](./SUPPLIER_MATCHING.md) for matching and stale-edit guards.

`buildProductionPlan(project, gameCopies, detailsBySlug)` is pure. It counts the
canonical design sets, validates quantities, checks supplier dimensions and
shape, and reports unmatched rulebook-only materials. Empty designs require no
purchase. Deck capacities and sheet/pack sizes round up separately for each
game; spare pieces are explicit. It does not pool partial packs across games.
Printed-goods discount tiers use game-copy counts; stock-part tiers use total
physical items. Missing, conflicting, fractional or unsupported purchasing
metadata stays unresolved rather than being guessed.

## Files in the ZIP

- `START-HERE.html`: materials, supplier links, quantities, and review steps.
- `order-plan.json`: the selected products, issues and quantities, plus every
  artwork face's physical dimensions, saved bleed/safe margins, and `orderPlaced: false`.
- `artwork/`: numbered PNG/SVG files for each used design and template face.
  PNGs use 300 dpi pixels and resolution metadata. Both formats include the
  template's saved bleed without printed cut guides. Raster artwork is embedded
  in SVGs; an image download or decoding failure rejects the export.
- `copy-map.csv`: front/back/other-face filenames and copies within one game.
  Repeated cards reuse the same artwork. Stock components have no upload artwork.
- `home-print/`: actual-size paper proofs with cut guides, separate from upload files.
- `rulebook.html`: printable instructions, including the structured icon legend.
- A design archive containing the editable project and its checkpoint history.

Export captures a project snapshot and never changes the working design.
Downloads are bounded by the package's file, face, byte, and raster-size limits.
SVGs retain live text using the template renderer's standard font families;
supplier proof review remains necessary. Original external image references in
the editable archive or home-print proofs may still require their source host;
the production PNG/SVG artwork contains embedded raster data.

## Prices and manufacturing review

The catalog is cached supplier information, not a live checkout. Known USD
prices are shown as materials estimates only. Unknown prices are not zero.
Shipping, tax, provider fees, and unlisted packaging/materials are excluded;
the plan never adds the old quote service's markup or risk buffer.

BoardGamesMaker's imported card prices are interpolated, and its tile prices
mix per-piece amounts with sheet-based tiers. Those totals remain unknown until
the supplier confirms the configured price. Some imported options are inferred.
The Game Crafter's curated printable prices use explicit per-sheet/per-item
metadata; its stock-part catalog uses per-part pricing. No price is extrapolated
beyond an applicable supplied tier or converted from another currency.

Cached bleed/safe-area values can be generic or absent. A matching trim size is
not production approval. Check the selected supplier's current template,
resolution, bleed, safe area, front/back assignment and rendered proof. For
example, BGM's [1-inch circular tiles](https://www.boardgamesmaker.com/print/circle-game-tiles-micro-1inch.html)
use 36 circles per sheet, require at least 300 dpi, and publish bleed/safe margins
that differ from the old generic catalog defaults. Rulebooks, boxes, assembly,
and additional supplies need their own arrangements unless explicitly listed.

## Real supplier handoff

BoardGamesMaker provides product-specific online artwork upload and checkout;
[an account is optional for designing and ordering](https://www.boardgamesmaker.com/faq-order.aspx).
Opening a product link does not transfer the design or place an order.

The Game Crafter documents an API-based route to a hosted cart: create/populate
a cart, then redirect to `/cart/{cart_id}` or `/checkout/cart/{cart_id}` so the
buyer reviews it and enters delivery/payment details. This is a possible future
integration, not implemented by this module. See its [cart API](https://www.thegamecrafter.com/developer/Cart.html).
Custom games and artwork additionally require a supplier session, a designer,
and a file folder; its [file upload](https://www.thegamecrafter.com/developer/File.html),
[game](https://www.thegamecrafter.com/developer/Game.html), and
[deck/card](https://www.thegamecrafter.com/developer/Deck.html) APIs describe that path.
Custom circular chits have a separate [printed-component API](https://www.thegamecrafter.com/developer/TwoSidedSluggedSet.html);
they must not be confused with stocked coins in the current catalog.

## Checks

Run `npx tsx --test apps/web/src/editor/production/*.test.ts` from the repository
root, plus `npm run typecheck --workspace web`. Binary-format tests verify ZIPs
with Python 3's standard `zipfile` reader and PNG checksums/pixels with Node's
`zlib`; the independent ZIP test skips when Python is unavailable. Browser
verification covers the actual download, image colors, proof pages and supplier
matching. Keep logs in the repository's ignored `logs/` directory.
