# Moonlit Market: recorded design walkthrough

This is a recording plan, not a record of a completed browser run. The sequence uses a fresh recording context and the real local development account for the AI writing/art scenes. Keep the designer's existing browser context intact. The recording script owns the real requests and their observed results; this document makes no claim that a generation or recording has already succeeded.

## Story and material

Two woodland traders visit a nighttime market, gathering coins and buying delicacies and curios for prestige before dawn. Use `moonlit-market-cards.csv` in this directory: six designs, eighteen copies, numeric `cost` and custom `points` fields. Its short bodies contain flavor and immediate prestige only. Describe the CSV as a prepared design table, rather than claiming that the AI created it during the recording.

The executable experiment uses two players, two actions per turn, two starting coins, gathering two coins, a twelve-coin cap, five market slots, a target of fifteen points, and a twenty-round limit. Gathering or buying costs one action; buying spends the cost, awards points immediately, and refills the market when possible. The protocol also permits ending a turn. The game finishes at the target, an exhausted market, or the round limit. The full prose rulebook and any future card abilities remain reference material for this experiment.

Call the scoring resource **prestige** in fiction while making its correspondence to the lab's **points** explicit. Show cost and points on the printable card faces, so the paper prototype can be played from the same table.

## Suggested beats

| Beat | Visible action | Suggested caption |
| --- | --- | --- |
| Start with an idea | At `#/new`, fill **Game name** with `Moonlit Market`, **Theme or first idea** with the woodland market concept, and **Players** with `2`. Click **Create game**. | “An idea, a working title, and two players.” |
| Write a first draft | Use the actual AI writing controls and development account. Show the submitted request, the real response, and a small human revision. Require the numeric turn economy above in the prompt. | “Draft the rules with AI. Keep the design decisions yours.” |
| Make a family of cards | In **Components**, create one card deck named `Market deck`. Import the prepared CSV through **Data & copies**, replace starter rows, and bind cost and points in the shared template. Use the real art generation result if that scene succeeds. | “One editable template. Six designs. Eighteen cards.” |
| Set up a test | Open **playtest lab**. Choose **Card material → My project cards**. Confirm six designs and eighteen copies. Use the settings below and **Run experiments → Challenger strategy → Balanced**. | “Make the turn economy explicit enough to test.” |
| Keep the first playable version | In **version history**, enter `First playable prototype` under **Remember this version**, then click **Save checkpoint**. | “Keep a named version before the first test.” |
| Play one turn | Return to **playtest lab** and click **Start playtest**. Click **Gather 2 coins**, then **Buy Velvet Lantern for 4 coins, gain 4 points**. Pause on the opponent's response and transcript. | “Play a turn against a local strategy bot.” |
| Ask a balance question | Open **Run experiments** and click **Run 20 games**. Pause on the four measured results. | “Twenty seeded games, with the starting seat swapped for each seed.” |
| Look beneath the numbers | Click **Replay seed 42, challenger starts**, then **Next move** a few times. Show how the scores and market change with the transcript. Click **Return to live table** afterward. | “Replay any result, one legal move at a time.” |
| Record what to try next | Open **Playtest journal**, write the finding below, and click **Save finding**. | “Turn a result into a question for the next human playtest.” |
| Hand the game to an outside agent | Open **Agent workspace**. Show the observation and legal actions, then click **Download self-contained agent packet**. | “Export rules, public state, legal moves, and replay for an external AI agent.” |
| Keep the evidence | Save a second checkpoint named `Playtest baseline`, after the session, experiment, and finding exist. | “Keep the cards, rules, and playtest evidence together.” |
| Try a change | Optionally enter `Pricier market` under **Try an alternative** and click **Start experiment**. In the deck's **Data & copies**, change **Card 1 cost** from `1` to `2`. | “Try one change without losing the original.” |
| Compare and return | In **version history**, choose **Working draft** and expand **Market deck · Data table**. Show the changed cost. Choose `Playtest baseline` and click **Restore this version**. Reopen the table to verify cost `1`. | “See exactly what changed. Restore the baseline when you need it.” |
| Make a paper prototype | Open **print & share** and export the component sheets, rulebook, and full backup. Open the downloaded component HTML and show its sheets at actual size. | “Take your game from the screen to the table.” |

The first checkpoint deliberately precedes playtesting; the second contains the results. Restore **Playtest baseline** to retain the recorded findings and experiment. Restoring a dirty working draft creates **Safety checkpoint before switching versions**, so the unfinished cost experiment remains in history.

## Exact lab configuration and recording checks

| Accessible label | Value |
| --- | --- |
| Card material | `My project cards` / value `project` |
| Target score | `15` |
| Round limit | `20` |
| Actions / turn | `2` |
| Coins / gather | `2` |
| Starting coins | `2` |
| Coin limit | `12` |
| Market slots | `5` |
| Seed | `42` |
| Opponent strategy | `Balanced · points per action` / value `balanced` |
| Who starts a live session? | `You` / value `0` |
| Challenger strategy, in Run experiments | `Balanced` / value `balanced` |
| Number of games | `20 games · quick check` / value `20` |

The lab defaults to the **Woodland sample deck**, even in a new project with authored cards. Select the project source visibly. The default challenger is Greedy, so explicitly choose Balanced for the same-strategy comparison. Existing sessions freeze their rules and numeric card material; later setup edits apply to new sessions and experiments.

With the CSV unchanged, source inspection and a pure local simulation produced these expected recording checks:

- Initial market: Starlight Relic, Velvet Lantern, Silver Compass, Starberry Jam, Amber Tea.
- After gathering, the challenger has four coins and can buy Velvet Lantern. Buying it completes the challenger's two-action turn and triggers the opponent's response.
- Twenty Balanced-versus-Balanced games from seed 42: 10 challenger wins, 10 opponent wins, no draws, 50% challenger wins, 70% starting-seat wins, 9.5 average individual player turns, and no round-limit finishes.

These are fixture checks, not claims about what a finished recording shows. Read the actual displayed numbers before finalizing captions. If they match, a suitable finding is:

> The starting seat won 14 of 20 games in this cost-and-scoring experiment. Does first access to the market create an advantage? Compare with people playing the full rules.

The result is a small experiment under one documented heuristic. It does not establish that the game is balanced, predict human win rates, or demonstrate a language model interpreting arbitrary card powers.

## Reliable selectors and export details

Sidebar section buttons use the exact lowercase names **playtest lab**, **version history**, and **print & share**. Lab tabs use roles `tab`: **Play a game**, **Run experiments**, **Playtest journal**, and **Agent workspace**. The journal gains a count after saving a finding; a prefix match remains reliable. Component controls are inside the region **Components workbench**; its tab navigation is **Component editing tools**.

The first session button is **Start playtest**, or **Start your first session** in the empty table. It becomes **Start fresh session** while a session exists. Multiple visible **Agent packet** buttons can be ambiguous; use **Download self-contained agent packet** in the workspace. Repeated card copies can have identical purchase labels, so use the first matching legal button when necessary.

Version selections are buttons inside complementary region **Saved checkpoints**. Their accessible names include the checkpoint name plus branch/date metadata. **Working draft** compares the current design with the active checkpoint; selecting an older checkpoint compares it with its own parent. The lab's version pill contains the branch, version number, and possibly “working draft”; it does not display the checkpoint's descriptive name.

The packet export is an external-agent handoff, not a built-in model connection. It includes executable transition rules, frozen numeric card definitions, an observation with legal actions, and a separate referee replay. For fair decisions the external agent uses the public observation rather than the referee's hidden draw order. The optional response form accepts **Agent response JSON** with a legal `chosenActionId` and matching integer `expectedStep`, followed by **Validate and apply move**. Do not present a manually invented response as a real external AI turn.

In **print & share**, choose **Component → Market deck · card**, **Paper size → A4 · 210 × 297 mm**, and the intended **Face**. If the template has a back, select **Duplex first two faces**. **Include … mm bleed** is optional. Confirm the displayed dimensions, quantity, and page count, then click **Download component sheets**. At an unchanged 63 × 88 mm with no bleed, eighteen copies occupy three front sheets, or six pages with duplex backs. Read the actual count if the design dimensions changed.

The component export is HTML; open it to show the assembled print sheets. Print at 100% scale, flipping on the long edge for duplex backs. **Download rulebook** exports readable HTML. **Download full backup** exports the portable project and its history. These are prototype exports; the walkthrough should not imply a supplier order was placed or manufacturing approval was completed.

## Source references

- `apps/web/src/pages/CreateGame.tsx`
- `apps/web/src/editor/sections/PlaytestSection.tsx`
- `apps/web/src/editor/playtest/{LabConfigPanel,LabTable,LabResults}.tsx`
- `apps/web/src/editor/playtest/{simulation,packet}.ts`
- `apps/web/src/editor/sections/VersionsSection.tsx`
- `apps/web/src/editor/sections/PrintSection.tsx`
