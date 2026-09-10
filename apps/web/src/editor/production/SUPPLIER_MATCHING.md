# Supplier matching

`SupplierMatchDialog` is shared by Components → Physical settings and Print & share. Its props are `project`, `design: ProjectDesignSet`, `onChange(project)`, and `onClose()`.

The dialog browses the local `/v1/products` catalog with category, text search, pagination, and explicit product and variant choices. It stages a match until the designer reviews and applies it. Escape, Cancel, and Close discard the selection. Catalog reads have a 15-second deadline; requests for abandoned searches cannot replace current results.

Supplier product pages establish whether the item is custom printed, stock, or unverified. Tokens can use custom printed tiles (including BoardGamesMaker’s circular tiles) or ready-made money/tokens. Stock products always retain the supplier’s appearance; linking a stock coin does not print the designer’s artwork on it. Unverified products can only be saved as references.

For printable products with supported dimensions and shape, designers can explicitly fit all template faces using the shared template resize function, or retain the existing dimensions. Fitting scales layers and text and updates the trim shape. It does not apply catalog bleed/safe-area values: cached supplier metadata can be incomplete or generic, so the interface links to current supplier specifications for review. Existing row identities and quantities remain intact. Unsupported/missing dimensions cannot resize artwork.

Application uses the latest project and verifies the original target component has not changed or disappeared. Changes elsewhere in the project are preserved. A legacy Card Studio deck is materialized into Components only on Apply. There are no supplier writes, uploads, or orders.

Matching uses the existing instance properties `catalogSlug` and `catalogVariantId` and stores readable metadata: `catalogProductTitle`, `catalogVariantTitle`, `catalogSourceUrl`, `catalogSupplierId`, `catalogSupplierName`, `catalogProductionType` (`printable`, `stock`, or `unverified`), `catalogMatchMode` (`fit-template`, `link-only`, or `stock-part`), `catalogWidthMm`, `catalogHeightMm`, `catalogShape`, `catalogOptions` (`{group,key,value}[]`), and `catalogMatchedAt`. Missing dimensions are `null`. The supplier reference is written after a requested resize so the normal template-size invalidation cannot clear the new match. Unlink removes all matching metadata and preserves the artwork.

Run the focused domain regressions with `npx tsx --test apps/web/src/editor/production/supplierMatch.test.ts`.

Run `node scripts/check-supplier-matching-browser.mjs` against the running development server for an isolated live-catalog regression. It creates a temporary browser context and a test project, matches 24 coins to a real printed tile variant, checks cancellation/reload, switches to a stock coin without changing artwork, exercises the card dialog and Escape, and checks bounded desktop/narrow layouts. It does not touch the designer’s browser profile or place catalog orders. `CODEX_BROWSER_URL`, `DEMO_CHROME_PATH`, `PLAYWRIGHT_MODULE_PATH`, and `SUPPLIER_MATCH_ARTIFACT_DIR` override defaults. The default screenshots and JSON result are in `/tmp/turnbased-supplier-matching`.
