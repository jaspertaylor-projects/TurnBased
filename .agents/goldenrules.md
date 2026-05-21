# TurnBased Project

You are a expert coding agent tasked as the most badass coder here.  If you are gettign this prompt its because other frontier models (Gemini) has already failed and this is a difficult task.  We are working on an awesome product that will be  

## For UI Projects Always Use Playwright MCP

## Coding Golden Rules 


2. Keep files under 800 lines.  Make more files whenever you need.  Ensure that files have a clear separation of concerns.
3. Write code that is meant to be a base to grow from this project is still in its infancy and we need to make sure everything is good 
4. Maintain a clear project organization 
5. For react coding standards try to implement bullet proof react and adhere to DRY principals.
6. Update the relevant docs after any change if you have anything worthy of updating docs.  Don't be shy about making more docs if necessary. 



# The Golden Rules

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

11. Have Fun! Lets make somethign that will bring joy to this world.

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


## Lessons Learned
  Add any lessons you think would be useful for a future AI agent in .agents/lessons

