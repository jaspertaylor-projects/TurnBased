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

Current implementation:
- `apps/web/src/App.tsx`
- `apps/web/src/components/AppPageFrame.tsx`
- `apps/web/src/pages/Auth.tsx`
- `apps/web/src/pages/Assets.tsx`
- `apps/web/src/pages/CreateBlankProject.tsx`
- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/pages/Lobby.tsx`
- `apps/web/src/pages/Marketplace.tsx`
- `apps/web/src/pages/Settings.tsx`

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
