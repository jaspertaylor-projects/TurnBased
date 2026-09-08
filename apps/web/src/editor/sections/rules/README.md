# Rulebook authoring and AI

**Draft rulebook with AI** in the rulebook header drafts the selected prose
chapters together. The designer supplies the intended rules and chooses a
writing model. The request includes the current brief, rulebook and component
table data, with no embedded artwork. Component lists and icon legends stay
connected to the project; AI changes only the selected chapter bodies.

The dialog shows a chapter-by-chapter current/proposed comparison. Nothing is
saved until **Apply N chapters**. IDs, titles, order and structured inventory
stay intact. **Undo rulebook draft** restores the previous prose while those
chapters still match the applied draft. Manual edits invalidate stale undo.
Closing or leaving the section ignores a late response, and checkpoint restore
remounts the section to invalidate requests even when the text is identical.
A missing, duplicate, unknown, empty or oversized chapter response is rejected.

Whole-rulebook generation uses the authenticated `ai-rules-writer` edge
function with `mode: rulebook`; ordinary per-chapter drafting, rewriting,
expanding and brainstorming remain in the chapter AI panels. The whole-draft
request supports 1–24 prose chapters, a 12,000-character instruction and
100,000 characters of serialized project context. Provider calls use the
existing supported model catalog, wallet and usage ledger.

Checks: `npm run test:rules:api`, `npm run test:versions`, and
`npm run test:rulebook:browser`. The browser check launches an isolated Chrome,
intercepts every AI request, and verifies preview/apply/undo, invalid replies,
cancellation, manual corrections, bounded layout and reload. It makes no paid
AI calls. Screenshots and results default to `/tmp/turnbased-rulebook-draft`.
