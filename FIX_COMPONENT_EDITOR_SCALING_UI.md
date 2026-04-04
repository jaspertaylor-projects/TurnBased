# Fix Component Editor Scaling UI

## What Is Actually Going Wrong

The persistent bug is that the component editor is not using one single geometry system for nested components.

A child component is stored in its parent's local coordinate space, but the editor currently renders and edits it through several different interpretations of that data:

1. parent-local space
2. board-logical space
3. rendered board space after physical board sizing
4. zoomed viewport space when drilled into a component

Those spaces are all valid, but the editor is not converting between them in one consistent pipeline. Different parts of the editor are doing different math at different times.

That is why the same inner square can:

- look one way in the top-level board view
- look slightly shifted in the drilled-in view
- feel like it can be dragged past the parent's visible edge even though clamping exists

## Best Explanation In Plain Language

The top-level view and the zoomed-in view are not actually showing the same parent box.

They look like they should be, but under the hood they are based on slightly different frame calculations.

The top-level editor renders a child after:

1. resolving the child's local frame
2. converting that into board coordinates
3. rescaling the whole board to the board's physical dimensions
4. zooming the board into the viewport

The drilled-in view also uses the drill path to compute a zoom rectangle, but that zoom rectangle is built from raw ancestor frames, not from the exact resolved frames that were already used to render the parent on screen.

So the drilled view is effectively saying:

- "zoom into the parent using the stored geometry"

while the rendered top-level canvas is saying:

- "draw the parent using the resolved and scaled geometry"

Those are close, but not identical.

That tiny disagreement is the subtle bug.

## The Most Important Specific Mismatch

The clearest root problem is this:

- `computeZoomRect(...)` in [boardLayout.ts](/home/anonymous/TheCode/TurnBased/apps/web/src/editor/boardLayout.ts#L27) walks the drill path using raw `instance.frame` values and parent `frame.width` / `frame.height`
- `buildSurfaceItem(...)` in [VisualsSection.tsx](/home/anonymous/TheCode/TurnBased/apps/web/src/editor/sections/VisualsSection.tsx#L526) renders visible items using `getResolvedBoardItemFrame(...)` or `getResolvedChildItemFrame(...)`
- after that, the editor rescales everything again into `renderedBoardSurfaceItems` in [VisualsSection.tsx](/home/anonymous/TheCode/TurnBased/apps/web/src/editor/sections/VisualsSection.tsx#L791)

So the zoom rectangle and the visible rendered frame are not guaranteed to come from the same resolved geometry.

That alone can explain why:

- the parent appears in one place and size in the overview
- the drilled version of that same parent feels offset
- the child appears to move outside the parent border

## Why The Dragging Feels Wrong

Dragging is also derived from an approximation instead of the exact rendered bounds.

In [VisualsSection.tsx](/home/anonymous/TheCode/TurnBased/apps/web/src/editor/sections/VisualsSection.tsx#L601), the drag code converts mouse movement back into local units by estimating the parent's rendered width and height from:

- viewport size
- `zoomRect`
- board constants
- parent board-space width and height

That means drag math is not reading "the actual rendered parent rectangle on screen."

It is reconstructing that rectangle indirectly.

So even when `clampItemFrame(...)` in [boardLayout.ts](/home/anonymous/TheCode/TurnBased/apps/web/src/editor/boardLayout.ts#L274) clamps the child correctly in one coordinate space, the parent border the user sees can still be coming from a slightly different coordinate path.

That produces the exact maddening feeling you described:

- the child is technically clamped
- but visually it seems to escape the parent

## Why The Previous Fix Did Not Fully Solve It

The recent recursion change in [VisualsSection.tsx](/home/anonymous/TheCode/TurnBased/apps/web/src/editor/sections/VisualsSection.tsx#L780) was still worth doing.

It improved one real problem:

- grandchildren now inherit the resolved local dimensions of the rendered parent instead of a rougher parent size

But that only fixed one layer of the stack.

The bigger mismatch is still there:

- `computeZoomRect(...)` uses one model
- `buildSurfaceItem(...)` uses another
- the board gets rescaled afterward
- drag math reconstructs the rendered geometry a third way

So the bug can absolutely persist after that patch.

## Short Version

This is not just a bad clamp value.

It is a transform-consistency bug.

The editor currently has more than one answer to the question:

"Where is this nested component really supposed to be?"

Until render, zoom, and drag all use the exact same transform chain, the top-level view and the drilled-in view will keep drifting.

## What The Real Fix Should Be

The fix should be structural, not another local tweak.

We need one canonical geometry pipeline:

1. resolve the component's frame in immediate parent-local space
2. walk ancestors to get one absolute board-logical frame
3. convert that board-logical frame once into rendered-board space
4. convert rendered-board space once into viewport space

Dragging should invert that exact same chain in reverse.

If we do that, then:

- the overview and drill view will match
- visual borders and drag clamps will agree
- nested placement will stop drifting

## Recommended Refactor Direction

The next real fix should aim for these changes:

- stop computing `zoomRect` from raw `instance.frame` data alone
- resolve ancestor frames through the same frame-resolution logic used for rendering
- stop treating `renderedBoardSurfaceItems` as a second independent geometry interpretation
- give each visible item one canonical absolute board frame before rendering
- make drag math use that same canonical rendered rectangle instead of reconstructing it from approximations

## Bottom Line

The bug persists because the editor is still mixing:

- stored frame values
- resolved/clamped child frames
- board physical scaling
- drill zoom math
- drag conversion math

in different places.

The result is that the same component hierarchy is not being described the same way everywhere in the editor.
