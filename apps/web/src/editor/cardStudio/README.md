# Card Studio

Card Studio is the table and batch-generation view inside each deck in
**Components**. Its data and editable template live in
`EditorProject.componentDesigns[instanceId]`, alongside the existing physical
component identity. Saves, checkpoints, and portable backups include the whole
design. Legacy `EditorProject.cardStudio` data appears as one original deck;
opening it moves the data into a real component without changing row identities.

- `model.ts` owns defaults, normalization, validation, stable copy expansion, and
  playtest adapters. `getPlaytestCards()` maps explicit cost and points columns;
  it does not infer executable behavior from prose on a card.
- `csv.ts` parses comma-separated files and tab-separated spreadsheet selections.
  Imports are validated atomically. Extra headers become custom template fields;
  IDs survive CSV roundtrips and collisions receive new IDs when appending.
- `render.ts` preserves legacy card rendering and delegates editable documents
  to `templateStudio/render.ts`. The shared millimeter-based renderer drives
  previews, SVG downloads, and printing for every component family.
- `templateStudio/TemplateEditor.tsx` edits faces, text, image bindings, shapes,
  grids, and tracks. Layout changes apply to every table row; individual row
  values remain independently editable. Reusable template JSON contains the
  layout and embedded layer artwork, while component JSON includes table data.
- `componentStudio/print.ts` prepares actual-size A4/Letter sheets, shaped trim
  guides, optional bleed, mirrored duplex backs, and tiled large boards.
- Generated batches store compact row/copy references. Artwork and rules text
  remain in the source rows instead of being duplicated for every physical card.
  A stable fingerprint marks batches stale when the table or template changes.

Normalize **after** hydrating image blobs from IndexedDB. The URL validator does
not accept internal `idb-image://` references. Uploaded raster images are stored
as data URLs and produce self-contained print files. Linked HTTP(S) artwork needs
an internet connection when the downloaded file is opened. These are home
prototype exports; supplier production-file validation and ordering remain
separate work.

The table supports up to 1,000 designs, 99 copies per row, and 2,000 cards per
batch. Deck previews render 48 cards per page to keep the workbench responsive.

## AI edits for a column or cell

In **Data & copies**, each editable column header has an **AI** button. It opens
a whole-column request. To work on one value, focus its table cell and choose
**AI edit selected cell** in the toolbar. Both paths accept a prompt and writing
model, then show a before/after preview. **Apply** commits the reviewed cells
together; **Cancel** leaves the table unchanged. **Undo AI edit** reverses the
last applied batch while preserving unrelated edits.

The authenticated `ai-card-table` function receives the game name, theme, full
rulebook text, and current design table. Artwork bytes are excluded. These are
real provider calls charged to the signed-in account; authentication, provider,
and wallet errors appear in the dialog. Requests support up to 100 target cells
and 200 context rows, with a 256 KB request bound. Larger tables receive an
explicit limit message instead of a partial-column edit. Standard fields and
custom fields such as `points` or `flavor` use the same workflow; AI cannot
change row IDs, ordering, or fields outside the selected scope.

`aiTableModel.ts` validates exact response row membership and performs scoped
merges into the latest table. Changed targets, added/deleted/reordered rows,
removed columns, another component, or a restored version invalidate pending
suggestions. Navigation/unmount cancels the request. Later target edits also
invalidate the dedicated AI undo, so it cannot overwrite newer work. Copies
remain integer values from 0–99 and cannot exceed the 2,000-piece batch limit.

`scripts/check-card-table-ai-browser.mjs` uses a newly launched isolated Chrome
context, signs in to the local development account, and intercepts every AI
table response. It checks review/cancel/apply, single custom cells, undo,
concurrent edits, stale requests, wallet/malformed errors, reload, and a bounded
mobile dialog without paid generations. Run it from the repository root:

```sh
node scripts/check-card-table-ai-browser.mjs
```

The script accepts `CODEX_BROWSER_URL`, `DEMO_CHROME_PATH`,
`PLAYWRIGHT_MODULE_PATH`, and `CARD_TABLE_AI_ARTIFACT_DIR`; its default report and
screenshots go to `artifacts/card-table-ai-browser/`.

Run focused checks from the repository root:

```sh
npm run test:workshop
npm run test:versions
npm run test:components:browser
npm run typecheck --workspace web
```
