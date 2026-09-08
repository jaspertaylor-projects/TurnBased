# Card Studio

Card Studio keeps table data, custom field names, template choices, and generated
card identities in `EditorProject.cardStudio`. The normal editor save, undo,
checkpoint, and portable backup paths therefore include the whole deck design.

- `model.ts` owns defaults, normalization, validation, stable copy expansion, and
  playtest adapters. `getPlaytestCards()` maps explicit cost and points columns;
  it does not infer executable behavior from prose on a card.
- `csv.ts` parses comma-separated files and tab-separated spreadsheet selections.
  Imports are validated atomically. Extra headers become custom template fields;
  IDs survive CSV roundtrips and collisions receive new IDs when appending.
- `render.ts` is the single SVG renderer for the live preview, individual SVG
  downloads, and A4/Letter print sheets. Print sheets honor card dimensions and
  copies, use explicit page breaks, and include cutting guides.
- Generated batches store compact row/copy references. Artwork and rules text
  remain in the source rows instead of being duplicated for every physical card.
  A stable fingerprint marks batches stale when the table or template changes.

Normalize **after** hydrating image blobs from IndexedDB. The URL validator does
not accept internal `idb-image://` references. Uploaded raster images are stored
as data URLs and produce self-contained print files. Linked HTTP(S) artwork needs
an internet connection when the downloaded file is opened. These exports are
prototype card fronts; manufacturing bleed and duplex backs are separate work.

The table supports up to 1,000 designs, 99 copies per row, and 2,000 cards per
batch. Deck previews render 48 cards per page to keep the workbench responsive.

Run focused checks from the repository root:

```sh
npx tsx --test apps/web/src/editor/cardStudio/cardStudio.test.ts
npm run typecheck --workspace web
```
