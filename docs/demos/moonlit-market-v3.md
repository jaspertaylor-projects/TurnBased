# Moonlit Market: a template from scratch and a minted coin set

This recording starts by importing the completed [v2 game](moonlit-market-v2.md)
through **print & share → Import a backup as a new game**. Its six AI-written card
rows, eighteen copies, five prose chapters, saved checkpoints, and frozen
playtest remain in the imported game. The existing card layout is then cleared
on both faces and rebuilt using the visible layer editor. No template JSON is
imported for this design, and these authoring scenes make no new AI calls.

The new style combines midnight navy (`#152C3B`), forest green (`#2C5644`), warm
parchment (`#FBF4E3`), and pale gold (`#EDC982`). The card front has a navy title
band, a round cost seal, lantern-lit artwork, the existing AI flavor text, and
a green prestige footer. Its reverse uses a crescent assembled from two
ellipses and a centered Moonlit Market wordmark. Cards stay 63 × 88 mm with
3 mm bleed and rounded corners. Title, cost, body, points, and category are
bound to the table; the real artwork from the first walkthrough is uploaded
into a newly created image layer.

The separate **Moon coins** token set contains one design repeated 24 times.
Its circular trim measures exactly 25.4 × 25.4 mm, with 2 mm bleed. A warm gold
front carries the denomination **1** and **MOON COIN**; a forest-green back
carries a crescent and **MARKET MINT**. This supplies the 24 coin tokens already
specified by the game's Setup chapter.

## UI recording helpers

[`scripts/demo/build-from-scratch.mjs`](../../scripts/demo/build-from-scratch.mjs)
exports small async scenes accepting the recorder's `{ page, click, fill }`.
They operate normal buttons, selects, numeric inputs, text fields, and the
artwork upload. They do not call project/model/storage APIs. Run them with
[`record-session.mjs`](../../scripts/demo/record-session.mjs) using its normal
interactive JSON stdin flow, documented in [the demo README](README.md).

```sh
DEMO_OUTPUT_DIR=artifacts/demos/moonlit-market-v3 \
  node scripts/demo/record-session.mjs
```

Import this existing backup through the actual application:

```text
artifacts/demos/moonlit-market-v2/downloads/moonlit-market-with-history.json
```

Open **components → Moonlit Market deck → Template** before the first helper.
The following command assumes the recorder was started at the repository
root; substitute the repository's absolute path if needed.

```json
{"action":"begin","title":"A genuinely empty canvas","caption":"Keep the design table. Build every visual layer from scratch."}
{"action":"run","code":"const m = await import('file://' + process.cwd() + '/scripts/demo/build-from-scratch.mjs'); await m.clearDeckTemplate({page,click,fill});"}
{"action":"pause","ms":1500}
{"action":"end"}
{"action":"saved"}
```

For later calls, use the same `run` code with the next function name. Each
helper is intended as a separate scene; the title/text helpers may take a
little longer with the recorder's typing delays. Do not repeat creation or
layer-adding helpers on a partially completed design: they intentionally
perform the same actions a person would and therefore add another layer/set.
Wait for **Draft saved in this browser** with the recorder's `saved` command
after each construction group and before reloading or closing. Rapid typing
can leave earlier autosaves queued; exporting the in-memory game does not
itself mean that the current browser draft has finished saving. Put these
waits outside the scene boundaries when they do not belong in the edit.

| Function, in order | Visible result / suggested caption |
| --- | --- |
| `clearDeckTemplate` | Both existing faces are empty; size and margins are explicit. |
| `buildCardFrame` | Add a gold border and midnight heading band. |
| `buildCardBands` | Add the forest footer and gold cost seal. |
| `buildCardArtwork` | Upload the earlier real AI artwork into a new image layer. |
| `buildCardText` | Bind the card name and coin cost to the table. |
| `buildCardFlavor` | Bind the existing flavor text and prestige values. |
| `buildCardBack` | Begin the empty reverse with a navy background and gold border. |
| `buildCardBackMoon` | Two simple shapes become a crescent. |
| `buildCardBackText` | Give the whole deck a shared identity. |
| `previewAndGenerateCards` | Switch preview rows, then generate all eighteen cards. |
| `createCoinSet` | Create Moon coins and set its table quantity to 24. |
| `clearCoinTemplate` | Start empty at an exact 25.4 mm circular trim. |
| `buildCoinFront` | Draw the minted rim and warm gold center. |
| `buildCoinValue` | Add the denomination and coin label. |
| `buildCoinBack` | Build the empty reverse with a forest background and gold rim. |
| `buildCoinBackMoon` | Draw the matching crescent mark. |
| `buildCoinBackText` | Add MARKET MINT to the reverse. |
| `generateCoins` | One design, twenty-four physical coins. |

`buildCardArtwork` defaults to
`artifacts/demos/moonlit-market/downloads/moonlit-market-art.png`. To use another
existing PNG/JPEG/WebP/GIF, pass its absolute filename as the second argument.
The source art is reused; the old template's geometry and layers are not.
For a clean reveal between construction scenes, call
`showTemplateFace({page,click,fill}, 'Front')` or `'Back'`. It hides grid and
print guides, clears the layer selection, and fits the chosen face to the
canvas. Current token starters already have Front and Back; the blank layout
clears both without adding another face.

## Finishing scenes and limits

Show the two component sets together, save a named checkpoint, and export a
full backup. In **print & share**, choose each **Component**, enable
**Duplex first two faces**, and download its sheets. At A4, the eighteen cards
occupy six pages with bleed excluded, or ten pages with 3 mm bleed included.
The 24 coins occupy two pages for both faces, including 2 mm bleed if enabled.
Print at 100% / actual size and flip on the long edge. The sheets include
the component trim guides and mirrored back placements.

The existing completed playtest deliberately keeps its frozen old visual
material. A new playtest captures the rebuilt card template. Authored token
coins are printable components; the current market-race lab tracks coins as
numeric resources and does not place these custom token designs on its board.
Any supplier-ordering scene must follow the currently available ordering UI;
this authoring helper does not perform checkout or place an order.

Recording clips, screenshots, generated backups, and downloads belong under
the ignored `artifacts/demos/moonlit-market-v3/` directory. The final video
duration and artifact verification will be recorded after that work finishes.

The helper verification exercised all eighteen authoring scenes in an isolated
Chrome browser using actual UI import, clear-then-type inputs, and exports,
with no AI requests. It checked new layer identities, typography, six unchanged
card rows, rules and frozen playtest, 18 generated cards, and 24 double-sided
coins. A separate UI import/edit/reload check passed after explicitly waiting
for the draft to finish saving. Inspected screenshots and the combined report
are in `artifacts/demos/moonlit-market-v3/helper-typed-verification/`, including
`authoring-verification.json` and `persistence-followup.json`.
