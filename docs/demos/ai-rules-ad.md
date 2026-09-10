# TurnBased: AI rulebook demo

This short product video shows a real AI agent writing the game's rules from a
designer's brief. The workflow is explicit: describe the game, generate five
connected chapters, review the AI's proposal, and apply the draft to the editable
rulebook. The closing scenes connect that rulebook with the component editor,
the supported market-race playtest, and printable exports.

The video is embedded on the landing page of the [live site](https://turnbased.app). Its
public files are `/demo/turnbased-ai-rules.mp4`,
`/demo/turnbased-ai-rules.jpg`, and `/demo/turnbased-ai-rules.vtt`.

## What the recording demonstrates

- A new Moonlit Market project starts with empty prose chapters.
- The designer enters a brief and clicks **Generate rulebook draft**.
- The actual `ai-rules-writer` endpoint writes five connected chapters.
- **Current** and **AI draft** appear side by side for human review.
- **Apply 5 chapters** writes the accepted proposal into the editable rulebook.
- The same project carries its component designs and can export the rulebook.

The video has burned-in captions and a separate WebVTT track. It is silent and
can be watched without audio. Generation waiting time is explicitly identified
as shortened; the final edit excludes setup work and unsuccessful takes.

The September 10, 2026 release is **84.12 seconds**, 1600 × 1000 at 25 fps,
encoded as H.264 MP4 with fast-start playback. The video is **4.09 MB**. A real
Kimi K2.6 request returned HTTP 200, and the exported project was checked against
the response: all five initially empty prose chapters exactly match the accepted
AI draft. Independent Chrome playback, seeking and decoded-frame checks passed
with no browser or media errors. The visible generation, proposal, applied
rulebook, component, playtest and export frames were inspected after rendering.
The [release manifest](ai-rules-ad-release.json) records the checks and public
asset hashes alongside the source documentation.

The card table is the prepared [Moonlit Market CSV](moonlit-market-cards.csv).
The illustrated card template and its real AI artwork were created in the
[earlier walkthrough](README.md) and imported through the normal template UI.
The new video makes a fresh rules-writing request. It does not claim that those
card assets were generated during this recording.

The playtest is TurnBased's supported market-race simulation using the authored
card costs and points. Free-form AI-written prose is not automatically compiled
into an executable game engine.

## Recording and rendering

Start the [local development stack](../development.md), then run the existing
isolated Playwright recorder:

```sh
DEMO_OUTPUT_DIR=artifacts/demos/ai-rules-ad node scripts/demo/record-session.mjs
```

Sign in through **Use local dev account**, create Moonlit Market, add a card
component named **Moonlit Market deck**, and import the earlier template from
`artifacts/demos/moonlit-market/downloads/moonlit-market-deck-template.json`.
The template is a generated local fixture, not a source file. A different
prepared template can be imported when recording another game.

[`ai-rules-ad-scenes.mjs`](../../scripts/demo/ai-rules-ad-scenes.mjs) provides
small scenes for the interactive recorder. They operate visible app controls;
they never inject a proposal or write project storage directly. Register
`observeAi({ page, output })`, then call `importCardTable({ page, click, saved })`
outside the final scene boundaries to load the CSV and generate eighteen cards.

The core scene helpers, in order, are `openAgent`, `describeGame`, `requestRules`,
`awaitProposal`, `reviewChapter`, and `applyRules`. Run `awaitProposal` between
scene boundaries to omit the remaining generation wait. Review **Concept**,
**Setup**, **Taking a Turn**, and **End Game** before applying the draft.
`showComponents`, `startPlaytest`, `playTurn`, and `exportGame` support the closing scenes.
The playtest uses the default seed of 42 and enters **Fullscreen table** before
`playTurn`. Its opponent responds automatically after the player's second action.
Each helper takes the recorder's `{ page, click, fill, saved, output }` object
as needed; `reviewChapter` also takes the chapter name and optional hold time.

For example:

```json
{"action":"run","code":"const m = await import('file://' + process.cwd() + '/scripts/demo/ai-rules-ad-scenes.mjs'); await m.openAgent({page,click});"}
```

Mark the selected scenes using the recorder's `begin` and `end` commands.
Preserve `recording-original.json` before editing the final scene manifest.
See the [recorder reference](README.md) for the full command format.

```sh
python3 scripts/demo/render-ai-ad.py
node scripts/demo/check-video.mjs artifacts/demos/ai-rules-ad/turnbased-ai-rules.mp4
```

The renderer needs FFmpeg, FFprobe, and the ASS subtitle filter. The
`DEMO_FFMPEG` and `DEMO_FFPROBE` environment variables accept executable paths
or wrapper commands, as documented in the recorder reference. It copies the
final video, an actual AI-proposal poster frame, and subtitles into
`apps/web/public/demo/` for deployment with the app.

## Evidence and source material

Raw recordings, project exports, and evidence are kept locally under the ignored
`artifacts/demos/ai-rules-ad/` directory:

| File | Purpose |
| --- | --- |
| `recording-original.json` | Unedited scene manifest and observed HTTP responses. |
| `recording.json` | Selected source intervals and final captions. |
| `commands.jsonl` | Successful recorder operations with source timestamps. |
| `ai-request.json` | Actual generation request body; no authentication headers. |
| `ai-response.json` | Actual AI response, including generated prose and model. |
| `release-evidence.json` | Duration, asset sizes, SHA-256 hashes, and HTTP statuses. |
| `project-verification.json` | Confirms empty starting prose and exact AI-response persistence in the exported game. |
| `video-qa/playback.json` | Independent Chrome playback, seeking, and decoded-frame checks. |
| `downloads/` | Rulebook and portable game exports from the real UI. |

Only the compact final media is published. Requests, raw footage, intermediate
renders, and portable project data remain local.
