# TurnBased Project

You are a expert coding agent tasked as the most badass coder here.  If you are gettign this prompt its because other frontier models (Gemini) has already failed and this is a difficult task.  We are working on an awesome product that will be  

## The Golden Rules

These are the golden rules that you absolutley must follow : 

1. Use Playwright tools to simulate user experiences after you implement a change.   Keep in mind that the data load is through electron etc so you wont be able to actually load data through the web.

2. Label every div so that we can communicate clearer

3. After every time before you finish and with a prompt, update .gitignore if applicable, and then commit to the local branch you are working on with a detailed commit message.

4. Keep the code base modular don't write code files longer than  600 lines long and refactor files you find that are longert than that.

5.  Make the UI look nice.  Our overall theme is aiming to make a cozy magical forest / board game haven. 

6. When fixing code be sure to always treat the cause not the symptom

7. Make sure to make and keep logs in /logs  thsi can help us debug

8. For react coding standards try to implement bullet proof react and adhere to DRY principals.

9. Update the relevant docs after any change if you have anything worthy of updating docs.  Don't be shy about making more docs if necessary. 

10. Write code that is meant to be a base to grow from this project is still in its infancy and we need to make sure everything is being written with future growth in mind 

11. Update .agents/memories.md  other coding agents are also working on this project and htey need to learn what you learn.

12. Have Fun! Lets make something that will bring joy to this world.

---


# UI Style Rules

This file records shared UI rules for TurnBased. These are implementation rules for the app shell, editor, preview, and play surfaces.

## Rule 1: Lock Page Zoom

- TurnBased currently uses a fixed browser zoom baseline for UI work.
- Disable browser page zoom gestures inside the web app, including `Ctrl`/`Cmd` + mouse wheel or trackpad scroll.
- Disable browser zoom keyboard shortcuts inside the web app, including `Ctrl`/`Cmd` + `+`, `-`, and `0`.
- Set the app viewport to a non-scalable baseline so mobile and touch interactions do not introduce browser-level zoom drift.
- Treat the locked page zoom level as the baseline when tuning layout, sizing, spacing, board composition, and visual polish.
- If we later support accessibility scaling or creator-controlled zoom, it should be an intentional app-level feature rather than unmanaged browser page zoom.

Current implementation:
- `apps/web/index.html`
- `apps/web/src/usePageZoomLock.ts`

## Rule 2: No Page-Wide Scrolling Outside Landing

- The landing page is the only page allowed to use document-level scrolling.
- Every other page should fit inside the application frame without browser page scroll.
- On non-landing routes, lock `html` and `body` scrolling and keep the main app shell at viewport height.
- Do not turn the full page body or a full-page wrapper into a scrolling container as a fallback.
- Treat non-landing routes like fixed desktop-app surfaces first, even if content gets clipped until we redesign that page properly.
- If overflow is ever needed later, it should be an intentional smaller UI region such as a list, inspector, canvas rail, or modal body, not the page itself.

## Rule 3: Component Editor Workspace

- The component editor should feel like a static desktop workbench rather than a page.
- The central workspace where components are edited should use a warm oak tabletop treatment instead of the current dark stage.
- That tabletop workspace should remain visually static. Do not make the component editor canvas area itself a scrolling surface.
- The right-side properties editor may scroll internally when needed.
- Top-level boards should offer a fixed dropdown of board size presets instead of relying only on freeform dimensions.
- When a board is selected, render it as large as possible against the tabletop background while still leaving a small visual safety margin so it does not touch the workspace edge.

Current implementation:
- `apps/web/src/editor/sections/VisualsSection.tsx`
- `apps/web/src/editor/sections/visuals/TopLevelInspector.tsx`

## Rule 4: Cards and Form Surfaces Are Bounded

We are building a desktop app, not a webpage. Every primary content surface
(cards, forms, dialogs, inspectors, panels) should be **bounded by the
viewport**, not by the natural flow of its content. If content can grow
beyond the surface, the surface scrolls internally — the page never does.

### The mental model: a stationary frame with movable content inside

The user should feel like the chrome of the surface — its header, its
footer, its sidebars — is **carved into the viewport** and never moves.
The contents *inside* that chrome are what scroll or rearrange. A footer
"that you scroll down to" is a footer in the wrong place — it's part of
the body, not part of the frame.

### The header / body / footer pattern

When content might overflow (chip lists, long forms, dynamic field counts,
generated previews, swatch grids), give the surface three regions:

1. **Pinned header** — title, intro, primary identity. `flex: 0 0 auto`.
2. **Scrollable body** — the only region that grows or scrolls.
   `flex: 1 1 auto; minHeight: 0; overflowY: auto`.
3. **Pinned footer** — persistent space anchored to the **viewport bottom**,
   used for actions, status, mini-previews, or just deliberate breathing
   room. `flex: 0 0 auto`.

The pinned regions stay visible while the body scrolls; the body never
pushes them off-screen.

### Critical: the surface must fill its viewport slot

A common mistake is to apply the header / body / footer pattern to a card
that is *shorter than the viewport*. Then the "pinned" footer is only
pinned to the bottom of the card — it scrolls off when the user scrolls the
**outer** container the card lives inside. That is the same failure mode
as having no pinned footer at all.

To actually pin a region to the viewport bottom:

- The surface that owns the pattern must occupy `height: 100%` of its
  parent, all the way up the tree to the root viewport. `flex: 1 1 auto`
  + `minHeight: 0` on every ancestor that is itself a flex container.
- The surface itself must use `display: flex; flexDirection: column;
  overflow: hidden`. **The surface does not scroll** — only its body does.
- If you find yourself wrapping a header/body/footer pattern inside a
  separately-scrollable parent, lift the pattern up to where the parent's
  scroll lives. Either eliminate the outer scroll, or move the
  header/footer into the outer container so it owns the pinning.

The body section of one frame can itself contain another header/body/footer
frame — frames can nest. But the outer frame's footer must always anchor
to the viewport, not the outer frame's *body*.

### Other guidance

- Prefer fixed-size desktop affordances over web patterns: bounded surfaces
  with internal scroll instead of pages that scroll, modal dialogs with
  scroll bodies instead of expanding flows, side-rail inspectors with their
  own overflow instead of growing the page.
- This generalizes Rule 2: *page-wide scrolling is the failure mode*. If
  you find yourself reaching for `body { overflow: auto }`, you are
  building a webpage — restructure the surface into header/body/footer
  flex regions instead.
- Footer space is for **the user**, not for the page flow. Reserve it
  deliberately when a surface benefits from a persistent action area, a
  mini-preview of the current state, or simply explicit breathing room
  between the content and the bottom of the screen.

Why: a designer using this app on a laptop should be able to scan the
whole UI in one glance, the way they would in Figma or a native creator
tool. Stretching content past the fold turns those surfaces into web
forms, which is the opposite of the feel we want.

Current implementations of this pattern:
- `apps/web/src/pages/CreateBlankProject.tsx`
- `apps/web/src/pages/Editor.tsx` (sidebar + viewport split)
- `apps/web/src/components/AppPageFrame.tsx` (frame primitive)
- `apps/web/src/editor/sections/ArtSection.tsx` (`SubPageShell` —
  header / body / optional footer all anchored to the shell viewport)

## Rule 5: One Scrollbar Style Across the App

Scrollbars are part of the desktop-app feel. We want every scrollable
region — page bodies, modal contents, inspector rails, code panels,
chip pickers — to share the **same sleek cozy-forest scrollbar**, so
the app reads as one product instead of a collection of pages.

The global style lives in `apps/web/src/index.css` under the
`/* Cozy scrollbar */` block and applies to every element via the
universal selector. Do **not** override it locally unless there is a
very specific reason (e.g. a dark-on-dark surface that needs a
different tint), and if you do, document the override inline with a
brief justification.

Key choices:

- **Thin** (10px webkit width, `scrollbar-width: thin` on Firefox)
  rather than the chunky default.
- **Transparent track**, no background — the gutter is invisible
  unless the thumb is present. The card chrome supplies the visual
  separation.
- **Teal thumb** with `background-clip: padding-box` and a transparent
  2px border so the thumb floats inside the gutter with a soft inset.
  Color `rgba(15, 118, 110, 0.32)` at rest, deeper green on hover and
  active to feel responsive.
- **Rounded** (border-radius 999px) and animated transition so it
  reads as a deliberate part of the UI, not a browser default.

When a surface needs visible breathing room between scrolling content
and the scrollbar, add right-padding to the scroll body (e.g. the
new-game card pads `1rem` on the right alongside `1.5rem` on the left).
Do not solve this with a custom scrollbar style — keep the scrollbar
identical app-wide and let the surrounding container provide the
gutter.

If you ever need to disable scrollbars (e.g. a static workbench), do
it locally with `overflow: hidden` or `scrollbar-width: none` on that
element only.

Current implementation:
- `apps/web/src/index.css` (the global rule, near the bottom).


## Lessons Learned
  Add any lessons you think would be useful for a future AI agent in .agents/lessons

