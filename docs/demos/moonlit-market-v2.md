# Moonlit Market — AI data and the playable tabletop

This second walkthrough demonstrates the additions requested after the first
Moonlit Market video:

- Generate a consistent proposal for five rulebook chapters in one AI call,
  review it chapter by chapter, then apply it.
- Ask AI to rewrite an entire card-table column, review every before/after
  value, and apply the column atomically.
- Focus a cell and ask AI for one specific change, without changing its
  neighbors.
- Generate physical card copies from the same reusable template used for
  printing, then play those authored faces on the wooden tabletop.
- Enter fullscreen with one common scale for the whole table. Card dimensions
  and size relationships remain intact; inspect a card to read it closely or
  turn it over.

The new recording is kept separately under
`artifacts/demos/moonlit-market-v2/`; the first video is preserved. It reuses
the real AI artwork and reusable template exported in the first walkthrough.
The writing requests in this recording use the development account and real
providers. Automated regression checks intercept their AI requests.

## Completed prototype

The captioned walkthrough is **3 minutes 39.44 seconds**, saved as
`artifacts/demos/moonlit-market-v2/turnbased-game-creation.mp4` at
1600 × 1000 / 25 fps (H.264, 13.2 MB), with no audio. Selected interactions run at normal
speed; provider waits, operator pauses and unsuccessful takes are trimmed.
The raw WebM, `recording-original.json`, and `editing-notes.md` retain the
source and explain the edit. The closing shot reprises the completed table.

All five prose chapters were generated together with the dev account. A real
whole-column request then rewrote all six flavor descriptions, followed by
a real one-cell refinement for Starberry Jam. All three successful requests
returned HTTP 200. An earlier column attempt returned invalid row references;
it was rejected without altering the table or debiting the designer. The
server now uses exact short row aliases and validates the complete response
before mapping it back to the original IDs. The failed attempt remains in
the recording metadata.

The recorded game contains six designs / eighteen cards, the reusable
two-face template and embedded artwork, five prose chapters plus the component
list, two checkpoints, and one playtest finding. The seed-42 game ended
11–15 in the opponent's favor after 19 actions. Its actual cards, configuration
and visual designs stay frozen with the saved session. The finding asks
whether saving for higher-prestige cards outperforms frequent small purchases.

`downloads/` contains the portable `moonlit-market-with-history.json`, duplex
card HTML/PDF, and rulebook HTML/PDF. The card export has eighteen fronts and
eighteen backs on six A4 pages; print at actual size, flipping on the long
edge. The rulebook shows ages 8+ and 10–15 minutes. Local checkpoint saving
worked; optional remote synchronization timed out after its five-second limit.

A fresh Chrome imported the archive through the real UI and verified all
rules, card data, generated copies, embedded artwork, both faces, checkpoints,
finding, and frozen playtest state after reload. Costs, points and copy counts
match the original CSV. Every printed front contains its new AI-written body.
The verification made no AI requests and recorded no browser errors; results
and screenshots are in `verification/portable-import-verification.json` and
the adjacent files.

Final Chrome video playback and seeking checks passed with no media or page
errors. The AI previews, authored-card inspector, fullscreen table and caption
band were also inspected for readability, clipping and distortion. See
`video-qa/playback.json` and `logs/moonlit-market-v2-video-qa.log`.

## Recording route

1. Sign in with **Use local dev account**, then create Moonlit Market for two
   players and enter its woodland-market theme.
2. Create **Moonlit Market deck**. Import the previous recording's template
   via **Import template file → Use this template**. Under **Data & copies**,
   import `moonlit-market-cards.csv` and choose **Replace table**.
3. In **rulebook**, choose **Draft rulebook with AI**. Describe the setup,
   legal actions, scoring and end conditions. Generate, inspect the proposed
   chapters, and use **Apply 5 chapters**.
4. In the component table, choose **AI edit body column**. Enter a short
   flavor-writing instruction and choose **Generate suggestions**. Review
   six before/after values before **Apply 6 cells**.
5. Focus **Card 1 body**, choose **AI edit selected cell**, and request a
   more specific description. Review and **Apply 1 cell**.
6. Preview the table-bound template, then **Generate 18 cards**. In
   **playtest lab**, select **My project cards** and start a fresh session.
   Existing sessions keep the design they started with. The configuration
   button reads **Start playtest** for the first session.
7. Use **Fullscreen table**, play a few legal turns, inspect authored fronts
   and backs, and return with **Exit fullscreen table** or Escape.
8. Save a named checkpoint, export the full backup and printable sheets,
   and verify the exported game in a fresh browser.

The local market-race opponent is a strategy bot. It executes numeric
cost/points settings; freeform card powers and arbitrary rulebook prose are
reference material. The demo's rules are explicitly written to match that
supported protocol.

## Repeatable checks

Completed checks: 68 workshop tests, 47 version/persistence tests, 9 rules API
tests and 18 card-table API tests; workspace typecheck and build; scoped lint
and Deno checks; isolated rulebook, card-table and mixed-size tabletop browser
flows. Regression tests use mocked AI responses. New card-table checks also
reject unusable blank titles and copy totals above 2,000 before wallet debit.

```sh
npm run test:workshop
npm run test:versions
npm run test:rules:api
npm run test:cards:api
npm run test:rulebook:browser
npm run test:cards:ai:browser
npm run test:playtest:table:browser
```

The tabletop browser check uses the first recording's exported archive by
default; `PLAYTEST_TABLE_ARCHIVE` can point at another suitable Moonlit
Market fixture. It adds a square-card set to verify mixed physical sizes,
checks normal/fullscreen/resize geometry, acquired-card areas, front/back
inspection, native and fallback fullscreen exit, reload, and frozen replay.
