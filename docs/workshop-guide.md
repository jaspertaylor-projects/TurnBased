# Workshop guide

TurnBased keeps rules, components, playtests, version history, and printable
prototypes in one project. For installation, see [local development](development.md).
For recorded examples, see [the demos](demos/README.md).

## Create, test, and export a game

After starting the local stack, open `http://127.0.0.1:3000`:

1. Choose **New game** and enter a working title, or open **My workshop**
   and try **Little Woodland**. Creating a game and its first local checkpoint
   needs no account or AI generation. The example includes five rules chapters,
   four card designs, and ten physical cards.
2. Open **Components** to create cards, boards, tokens, tiles, player mats,
   or pieces. Card Studio lives inside each card deck: edit its table or
   import CSV / pasted spreadsheet rows, bind custom fields, and generate
   copies. Every component uses the same fully editable template workspace.
   Use a column header's **AI** action or focus a cell and choose **AI edit
   selected cell**. Review the proposed values, apply them together, and undo
   the batch. Custom fields are supported; newer edits invalidate stale replies.
   Add text, images, shapes, grids, or tracks; move, resize, rotate, reorder,
   align, hide, and lock layers. Edit physical dimensions, trim shape, bleed,
   safe zones, and front/back faces in millimeters. Preview any data row and
   export/import template JSON to reuse a layout in another component.
   The **Placement** view handles interactive spaces and pieces separately
   from the template's printed artwork.
3. In **Playtest lab**, record observations or run the supported two-player
   market-race experiment. Seeded heuristic agents play explicit numeric
   cost/points rules; they do not interpret arbitrary rulebooks or card powers.
   Export an agent packet with public state and legal moves, and paste an
   external agent's JSON reply to take a validated turn. No LLM runner is
   required for the built-in simulations.
   New sessions put the designed card fronts and backs on a wooden tabletop,
   with a shared market, draw pile and each player's acquired cards. Use
   **Fullscreen table** to fit the whole table with one scale, preserving
   physical dimensions and proportions. Inspect a card to read either face.
   Session artwork stays fixed for reproducible replays.
4. In **Version history**, name checkpoints, branch an experiment, compare
   changes, and restore earlier work. Restoring saves uncheckpointed work in
   a safety checkpoint first. Browser drafts survive reloads independently
   of the selected checkpoint. Checkpoints save locally before optional cloud
   synchronization, which has a shared five-second deadline. A remote failure
   leaves the local checkpoint available and reports the sync failure.
5. In **Print & share**, select any component and download A4 or US Letter
   sheets with physical dimensions and shaped cutting guides. Print one face,
   every face separately, or duplex fronts/backs with mirrored placements.
   Large boards tile across pages with 10 mm overlap and assembly labels;
   their artwork stays at its original size. Optional bleed is supported.
   Open the HTML sheets and print at **100% / actual size**, with browser
   headers and footers off. Duplex uses **flip on the long edge**; check two
   pages for alignment first. Printable rulebooks and archives with complete
   design history are also available. Choose **Prepare supplier order** to
   match each component to a catalog product and variant, explicitly fit its
   template size, and calculate decks, sheets, stock pieces, and spares.
   Download a ZIP of 300 dpi artwork, copy maps, proofs, rules, and the editable
   backup. Confirm current production requirements, price, payment, and delivery
   with the supplier; the app does not place an order. See the
   [supplier preparation guide](../apps/web/src/editor/production/README.md).

`#/new` is the local creation path; `#/new/guided` retains guided AI setup.
Editor links accept a section, for example
`#/editor/<project-id>?section=component_editor`. Legacy `card_studio` links
open the card family within Components.

Live project snapshots, workspace files, checkpoints, and embedded artwork
are stored in IndexedDB. localStorage contains a small project index and UI
preferences. Checkpoints are not automatically pruned; download a portable
backup before clearing browser data or moving to another browser. Archives
include embedded artwork once and import as a new game. Linked HTTP(S)
artwork still needs its original source; upload it to make it portable.


## AI drafting and component data

The rulebook's **AI assist** remembers its prompt, model, mode, context
weights, theme/style selections, and Creativity setting per project. Models
that do not support Creativity show the control as unavailable. A delayed
reply cannot overwrite newer section text or a restored checkpoint. Icon
descriptions are shared with Art Studio and included in printable rulebooks.
**Draft rulebook with AI** generates selected prose chapters together from
the brief, current rules and component tables. Review the chapter-by-chapter
proposal before applying it; component inventories and icon legends stay
connected to the project. Applied prose can be undone until its targets change.
Changing a component's supplier size updates its printable template dimensions
while preserving its identity, table rows, and authored layers.

Component templates are stored in `EditorProject.componentDesigns`, keyed by
the existing physical component instance ID. This keeps the component, its
table, and its artwork in one versioned design. Old `project.cardStudio`
data appears as one original deck and moves into the component map when
opened for editing; its row IDs and copy counts are preserved. The shared
template renderer drives previews and exports. Printed grids and tracks
remain artwork until configured as interactive structures in Placement.
