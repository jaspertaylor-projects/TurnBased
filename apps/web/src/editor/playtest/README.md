# Playtest Lab

The lab runs the explicit two-player `market-race-v1` experiment: gather coins, buy public cards, score their numeric points, and end at the target, exhausted supply, or round limit. The local strategies are deterministic heuristics. Prose rules and card abilities remain reference material. An exported agent packet supplies public observations, legal actions, and transition rules to an external agent.

## Cards on the table

New project-card sessions and experiment batches save their card designs alongside the numeric rules. The shared template renderer draws the authored front and back using the saved row bindings. The market, draw pile, and each player's acquired cards sit on a single wooden tabletop. The draw pile displays a representative back, never the identity or face of the next hidden card. Collections show their latest twelve cards; their collection controls open an inspector for all acquired designs.

Every placement uses its template's width and height in millimeters. One uniform scale fits the entire logical tabletop into its available viewport. Entering fullscreen recomputes that single fit, preserving aspect ratios and size differences between card designs. It does not promise a monitor has a calibrated physical millimeter size. The card inspector provides a larger readable view with dimensions and front/back controls.

Fullscreen uses the browser API when available, with a bounded viewport fallback if permission or support is unavailable. The exit button and Escape return to the editor. An open card inspector consumes Escape first.

## Saved visual material

`LabRun.visuals` and `LabBatch.visuals` are optional, versioned snapshots: one template per component design set, one row binding per card design, and a shared artwork map. Quantities refer to the same definitions, so eighteen copies do not store eighteen templates or image payloads. Uploaded artwork is embedded once in the visual snapshot and participates in the project's existing deduplicated persistence/archive storage. The table renders shared SVG symbols and decodes local artwork into shared object URLs; it releases those URLs on unmount or snapshot changes.

Subsequent component edits do not alter an existing session, restart, saved batch, or replay. JSON reload and project checkpoints preserve the snapshot. Historical sessions without visual material remain playable using readable reference faces; starting a fresh project-card session captures current designs. Sample material also uses reference faces. External image URLs remain external references and still depend on their original source; upload artwork when its bytes need to travel with the design.

Run `npm run test:workshop` for protocol, frozen material, and uniform-layout regression tests. Browser checks additionally cover actual SVG rendering, fullscreen, inspector controls, and reload behavior.
