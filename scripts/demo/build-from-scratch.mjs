// Recording scenes: every change goes through the visible component editor.
// Pass the recorder's { page, click, fill }; no project/storage APIs are used.
import { fileURLToPath } from 'node:url';

export const COLORS = Object.freeze({
  parchment: '#FBF4E3', navy: '#152C3B', forest: '#2C5644', gold: '#EDC982',
  coin: '#F5D996', bronze: '#876033',
});
export const ART_PATH = fileURLToPath(new URL('../../artifacts/demos/moonlit-market/downloads/moonlit-market-art.png', import.meta.url));

const button = (page, name) => page.getByRole('button', { name, exact: true });
const field = (page, name) => page.getByLabel(name, { exact: true });
const editor = page => page.getByRole('region', { name: 'Visual template editor' });
const tools = page => page.getByRole('navigation', { name: 'Component editing tools' });

async function retryDetached(action) {
  for (let attempt = 0; ; attempt++) {
    try { return await action(); } catch (error) {
      if (attempt >= 2 || !/not attached|detached from the DOM/i.test(error.message)) throw error;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
}
async function activate(ui, target) {
  await retryDetached(() => ui.click(target));
}
async function value(ui, name, next, typed = false) {
  // Numeric values are entered atomically: intermediate digits can resize the
  // document and clamp other values. Names and text remain visibly typed.
  await retryDetached(() => ui.fill(field(ui.page, name), String(next), typed ? 12 : 0));
  await field(ui.page, name).press('Tab');
}
async function select(ui, name, next) {
  // Do not open Chrome's native popup first: closing that popup can recommit
  // its old highlighted option after selectOption has updated the field.
  const control = field(ui.page, name);
  await retryDetached(() => control.scrollIntoViewIfNeeded());
  await control.selectOption(next);
  await ui.page.waitForTimeout(200);
}
async function color(ui, name, next) {
  await value(ui, name, next);
}
async function documentPanel(ui) {
  await activate(ui, ui.page.getByRole('complementary', { name: 'Template properties' })
    .getByRole('button', { name: 'Template', exact: true }));
}
async function blank(ui) {
  await activate(ui, button(ui.page, 'Layouts'));
  await activate(ui, ui.page.getByRole('dialog', { name: 'Template layouts' })
    .getByRole('button', { name: /^Blank/ }));
  await activate(ui, ui.page.getByRole('dialog', { name: 'Replace template confirmation' })
    .getByRole('button', { name: 'Use this template', exact: true }));
  await editor(ui.page).getByText('A blank canvas.', { exact: true }).waitFor();
}
async function layer(ui, type, name, [x, y, width, height]) {
  await activate(ui, button(ui.page, `Add ${type} layer`));
  await value(ui, 'Layer name', name, true);
  for (const [label, next] of Object.entries({ 'Layer X': x, 'Layer Y': y, 'Layer width': width, 'Layer height': height })) {
    await value(ui, label, next);
  }
}
async function shape(ui, type, name, bounds, fill, stroke = 'none', strokeWidth = 0.4) {
  await layer(ui, type, name, bounds);
  if (fill === 'none') await activate(ui, button(ui.page, 'Clear fill'));
  else await color(ui, 'Fill', fill);
  if (stroke === 'none') await activate(ui, button(ui.page, 'Clear stroke'));
  else {
    await color(ui, 'Stroke', stroke);
    await value(ui, 'Stroke width', strokeWidth);
  }
  if (type === 'rectangle') await value(ui, 'Corner radius', 0);
}
async function text(ui, name, bounds, content, size, fill, { centered = false, sans = false, bold = false } = {}) {
  await layer(ui, 'text', name, bounds);
  await value(ui, 'Text content', content, true);
  await value(ui, 'Font size', size);
  await color(ui, 'Text fill', fill);
  if (sans) await select(ui, 'Font', 'sans');
  if (bold) await select(ui, 'Font weight', 'bold');
  if (centered) {
    await select(ui, 'Text alignment', 'center');
    await select(ui, 'Vertical alignment', 'middle');
  }
}

/** Start with the imported six-row deck selected, on its Template tab. */
export async function clearDeckTemplate(ui) {
  await blank(ui);
  await activate(ui, button(ui.page, 'Front'));
  await documentPanel(ui);
  await select(ui, 'Size preset', '63x88');
  await select(ui, 'Cut shape', 'rectangle');
  await value(ui, 'Cut corner radius', 2.5);
  await value(ui, 'Bleed', 3);
  await value(ui, 'Safe inset', 3);
  await color(ui, 'Face background', COLORS.parchment);
  await activate(ui, button(ui.page, 'Fit template to canvas'));
}

export async function buildCardFrame(ui) {
  await shape(ui, 'rectangle', 'Gold frame', [3, 3, 57, 82], 'none', COLORS.gold);
  await value(ui, 'Corner radius', 2);
  await shape(ui, 'rectangle', 'Midnight heading', [0, 0, 63, 17], COLORS.navy);
}

export async function buildCardBands(ui) {
  await shape(ui, 'rectangle', 'Forest footer', [0, 77, 63, 11], COLORS.forest);
  await shape(ui, 'ellipse', 'Gold cost seal', [49, 4.5, 9, 9], COLORS.gold);
}

export async function buildCardArtwork(ui, artPath = ART_PATH) {
  await layer(ui, 'image', 'Lantern market artwork', [5, 20, 53, 31]);
  // Reuse a real earlier AI artwork file, not any saved layout or layer geometry.
  await field(ui.page, 'Upload layer artwork').setInputFiles(artPath);
  await button(ui.page, 'Replace uploaded artwork').waitFor();
  await value(ui, 'Image corner radius', 1.5);
}

export async function buildCardText(ui) {
  await text(ui, 'Market card title', [5, 4, 40, 10], '{{title}}', 14, COLORS.parchment, { bold: true });
  await text(ui, 'Bound coin cost', [49, 4.5, 9, 9], '{{cost}}', 12, COLORS.navy, { centered: true, bold: true });
}

export async function buildCardFlavor(ui) {
  await text(ui, 'AI-written market flavor', [5, 54, 53, 20], '{{body}}', 10.5, COLORS.navy);
  await text(ui, 'Bound prestige and category', [5, 80, 53, 5], '{{points}} PRESTIGE · {{category}}', 8, COLORS.parchment, { sans: true, bold: true });
}

export async function buildCardBack(ui) {
  await activate(ui, button(ui.page, 'Back'));
  await documentPanel(ui);
  await color(ui, 'Face background', COLORS.navy);
  await shape(ui, 'rectangle', 'Back gold frame', [3, 3, 57, 82], 'none', COLORS.gold, 0.5);
  await value(ui, 'Corner radius', 2);
}

export async function buildCardBackMoon(ui) {
  await shape(ui, 'ellipse', 'Golden moon', [21, 18, 21, 21], COLORS.gold);
  await shape(ui, 'ellipse', 'Moon shadow', [27, 14, 21, 21], COLORS.navy);
}

export async function buildCardBackText(ui) {
  await text(ui, 'Moonlit Market wordmark', [6, 47, 51, 23], 'MOONLIT\nMARKET', 18, COLORS.parchment, { centered: true, bold: true });
  await text(ui, 'Night market motto', [6, 75, 51, 5], 'A NIGHT OF SMALL WONDERS', 7, COLORS.gold, { centered: true, sans: true });
}

export async function previewAndGenerateCards(ui) {
  await activate(ui, button(ui.page, 'Front'));
  await field(ui.page, 'Preview data row').selectOption({ label: 'Starlight Relic' });
  await ui.page.waitForTimeout(600);
  await field(ui.page, 'Preview data row').selectOption({ label: 'Starberry Jam' });
  await activate(ui, tools(ui.page).getByRole('button', { name: 'Data & copies', exact: true }));
  await activate(ui, button(ui.page, 'Generate 18 cards'));
}

/** A clean reveal between construction scenes; only changes editor view state. */
export async function showTemplateFace(ui, face = 'Front') {
  await activate(ui, button(ui.page, face));
  for (const name of ['Toggle print guides', 'Toggle canvas grid']) {
    const toggle = button(ui.page, name);
    if (await toggle.getAttribute('aria-pressed') === 'true') await activate(ui, toggle);
  }
  await activate(ui, button(ui.page, 'Fit template to canvas'));
}

/** From either component tab or gallery. Makes a separate physical token set. */
export async function createCoinSet(ui) {
  const all = button(ui.page, 'All components');
  if (await all.isVisible()) await activate(ui, all);
  await activate(ui, button(ui.page, 'New component'));
  const dialog = ui.page.getByRole('dialog', { name: 'A new piece of your game' });
  await activate(ui, dialog.getByRole('button', { name: 'Token set', exact: true }));
  await ui.fill(dialog.getByLabel('Component name'), 'Moon coins', 12);
  await activate(ui, dialog.getByRole('button', { name: 'Create component', exact: true }));
  await activate(ui, tools(ui.page).getByRole('button', { name: 'Data & copies', exact: true }));
  await value(ui, 'Card 1 title', 'Moon coin', true);
  await value(ui, 'Card 1 category', 'Currency', true);
  await value(ui, 'Card 1 copies', 24);
  await value(ui, 'Card 1 body', 'Worth one coin. Return spent coins to the market supply.', true);
  await activate(ui, tools(ui.page).getByRole('button', { name: 'Template', exact: true }));
}

export async function clearCoinTemplate(ui) {
  await blank(ui);
  await documentPanel(ui);
  await value(ui, 'Template width', 25.4);
  await value(ui, 'Template height', 25.4);
  await select(ui, 'Cut shape', 'ellipse');
  await value(ui, 'Bleed', 2);
  await value(ui, 'Safe inset', 2);
  await color(ui, 'Face background', COLORS.gold);
  await activate(ui, button(ui.page, 'Fit template to canvas'));
}

export async function buildCoinFront(ui) {
  await shape(ui, 'ellipse', 'Minted outer rim', [1.2, 1.2, 23, 23], 'none', COLORS.bronze, 0.45);
  await shape(ui, 'ellipse', 'Warm coin center', [2.5, 2.5, 20.4, 20.4], COLORS.coin);
}

export async function buildCoinValue(ui) {
  await text(ui, 'One coin', [5.2, 4, 15, 13], '1', 24, COLORS.navy, { centered: true, bold: true });
  await text(ui, 'Moon coin label', [3.7, 17, 18, 4], 'MOON COIN', 6.5, COLORS.navy, { centered: true, sans: true, bold: true });
}

export async function buildCoinBack(ui) {
  // Current token starters already have two faces. Blank keeps those faces.
  // Also support an intentionally single-face token without making Face 3.
  if (await button(ui.page, 'Back').isVisible()) await activate(ui, button(ui.page, 'Back'));
  else {
    await documentPanel(ui);
    await activate(ui, button(ui.page, 'Add face'));
  }
  await documentPanel(ui);
  await color(ui, 'Face background', COLORS.forest);
  await shape(ui, 'ellipse', 'Back minted rim', [1.2, 1.2, 23, 23], 'none', COLORS.gold, 0.45);
}

export async function buildCoinBackMoon(ui) {
  await shape(ui, 'ellipse', 'Coin moon', [7.2, 5, 11, 11], COLORS.gold);
  await shape(ui, 'ellipse', 'Coin moon shadow', [10.4, 2.8, 11, 11], COLORS.forest);
}

export async function buildCoinBackText(ui) {
  await text(ui, 'Market mint', [3.7, 17, 18, 4], 'MARKET MINT', 6, COLORS.gold, { centered: true, sans: true });
}

export async function generateCoins(ui) {
  await activate(ui, tools(ui.page).getByRole('button', { name: 'Data & copies', exact: true }));
  await activate(ui, button(ui.page, 'Generate 24 tokens'));
}
