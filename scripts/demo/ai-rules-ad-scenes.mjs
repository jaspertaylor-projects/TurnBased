// Ad scenes for record-session.mjs. All app changes use visible UI controls.
// Run these helpers as individual scenes so genuine generation waits can be cut.
import { writeFile } from 'node:fs/promises';

export const BRIEF = 'Write a concise rulebook for Moonlit Market, a 2-player woodland trading game (ages 8+, 10–15 minutes). Use our 18 cards and 24 coin tokens. Reveal a five-card market; start with 2 coins each. Each turn: up to two actions. Gather 2 coins (cap 12), or buy a card and score its printed points, then refill. First to 15 prestige wins. If the cards run out or each player takes 20 turns, highest prestige wins; ties share victory. Card text is flavor only. Explain setup, turn order, actions and victory. Include a short worked turn example.';

const button = (page, name) => page.getByRole('button', { name, exact: true });
const controls = page => page.getByRole('navigation', { name: 'Component editing tools' });
const pause = (page, ms) => page.waitForTimeout(ms);

/** Record request/response payloads for provenance; credentials are never read. */
export function observeAi({ page, output }) {
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.url().endsWith('/ai-rules-writer')) return;
    const payload = request.postDataJSON();
    void writeFile(`${output}/ai-request.json`, JSON.stringify(payload, null, 2));
  });
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !response.url().endsWith('/ai-rules-writer')) return;
    const payload = await response.json();
    await writeFile(`${output}/ai-response.json`, JSON.stringify({ status: response.status(), ...payload }, null, 2));
  });
}

/** Prepared card data and earlier AI artwork; this preparation is outside the ad. */
export async function importCardTable({ page, click, saved }) {
  await click(button(page, 'components'));
  const deck = page.locator('.component-design-card').filter({ hasText: 'Moonlit Market deck' });
  if (await deck.count()) await click(deck);
  await click(controls(page).getByRole('button', { name: 'Data & copies', exact: true }));
  await click(button(page, 'Import'));
  await page.getByLabel('Choose CSV or TSV').setInputFiles('docs/demos/moonlit-market-cards.csv');
  await page.getByRole('dialog').getByRole('combobox').selectOption('replace');
  await click(button(page, 'Replace table'));
  await saved();
  await click(button(page, 'Generate 18 cards'));
  await saved();
  await click(button(page, 'rulebook'));
}

export async function openAgent({ page, click }) {
  await pause(page, 2500);
  await click(button(page, 'Draft rulebook with AI'));
  await pause(page, 2000);
}

export async function describeGame({ page, fill }) {
  await fill(page.getByLabel('Describe the game and how it should play'), BRIEF, 9);
  // Return the textarea to its beginning so the game idea is readable on film.
  await page.getByLabel('Describe the game and how it should play').press('Control+Home');
  await pause(page, 2500);
}

export async function requestRules({ page, click }) {
  await click(button(page, 'Generate rulebook draft'));
  await page.locator('[data-layout="rulebookDraftProgress"]').waitFor();
  await pause(page, 3500);
}

/** Call between scenes. No response mocking or manual proposal insertion. */
export async function awaitProposal({ page, output }) {
  await Promise.race([
    button(page, 'Apply 5 chapters').waitFor({ timeout: 180000 }),
    page.getByRole('dialog').getByRole('alert').waitFor({ timeout: 180000 }).then(async () => {
      throw new Error(await page.getByRole('dialog').getByRole('alert').innerText());
    }),
  ]);
  await page.screenshot({ path: `${output}/ai-proposal.png` });
  return page.getByRole('dialog').innerText();
}

export async function reviewChapter({ page, click }, name, hold = 4500) {
  await click(page.getByRole('navigation', { name: 'Draft chapters' }).getByRole('button', { name, exact: true }));
  await pause(page, hold);
  return page.locator('[data-layout="rulebookDraftComparison"] article').last().innerText();
}

export async function applyRules({ page, click, saved, output }) {
  await click(button(page, 'Apply 5 chapters'));
  await saved();
  await pause(page, 1500);
  await click(button(page, 'Next'));
  await pause(page, 2500);
  await page.screenshot({ path: `${output}/applied-rulebook.png` });
}

export async function showComponents({ page, click }) {
  await click(button(page, 'components'));
  await click(page.locator('.component-design-card').filter({ hasText: 'Moonlit Market deck' }));
  await click(controls(page).getByRole('button', { name: 'Template', exact: true }));
  await page.getByLabel('Preview data row').selectOption({ label: 'Starlight Relic' });
  await pause(page, 3000);
  await page.getByLabel('Preview data row').selectOption({ label: 'Mooncap Honey' });
  await pause(page, 2500);
}

export async function startPlaytest({ page, click, saved }) {
  await click(button(page, 'playtest lab'));
  await page.getByLabel(/^Card material/).selectOption('project');
  await click(button(page, 'Start playtest'));
  await saved();
}

export async function playTurn({ page, click }) {
  await pause(page, 1600);
  await click(button(page, 'Gather 2 coins'));
  await click(button(page, 'Buy Velvet Lantern for 4 coins, gain 4 points'));
  // The supported local opponent takes its turn automatically after this buy.
  await pause(page, 2500);
}

export async function exportGame({ page, click, saved }) {
  await click(button(page, 'print & share'));
  await pause(page, 1700);
  await click(button(page, 'Download rulebook'));
  await saved();
  await pause(page, 2500);
}
