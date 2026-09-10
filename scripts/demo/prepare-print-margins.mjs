// Visible-UI preparation after supplier matching and proportional artwork fit.
// BGM sources: https://www.boardgamesmaker.com/print/custom-white-border-poker-sized-cards.html
// https://www.boardgamesmaker.com/print/circle-game-tiles-micro-1inch.html
// Both specify 1/8-inch bleed and safety margins. No project/storage APIs used.
export const PRINT_MARGIN_MM = 25.4 / 8;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const field = (page, name) => page.getByLabel(name, { exact: true });

async function number(ui, name, value) {
  await ui.fill(field(ui.page, name), String(value), 0);
  await field(ui.page, name).press('Tab');
}
async function documentPanel(ui) {
  await ui.click(ui.page.getByRole('complementary', { name: 'Template properties' })
    .getByRole('button', { name: 'Template', exact: true }));
}
async function openComponent(ui, name) {
  await ui.click(button(ui.page, 'components'));
  if (await button(ui.page, 'All components').isVisible()) await ui.click(button(ui.page, 'All components'));
  await ui.click(ui.page.locator('.component-design-card').filter({
    has: ui.page.getByRole('heading', { name, exact: true }),
  }));
  await ui.click(ui.page.getByRole('navigation', { name: 'Component editing tools' })
    .getByRole('button', { name: 'Template', exact: true }));
  await ui.click(button(ui.page, 'Front'));
  await documentPanel(ui);
  return {
    widthMm: Number(await field(ui.page, 'Template width').inputValue()),
    heightMm: Number(await field(ui.page, 'Template height').inputValue()),
  };
}
async function margins(ui) {
  await documentPanel(ui);
  await number(ui, 'Bleed', PRINT_MARGIN_MM);
  await number(ui, 'Safe inset', PRINT_MARGIN_MM);
}
async function selectBand(ui, name) {
  await ui.click(ui.page.getByRole('option', { name: `Select layer ${name}`, exact: true }));
  if (await field(ui.page, 'Shape').inputValue() !== 'rectangle' ||
      Number(await field(ui.page, 'Rotation').inputValue()) !== 0) {
    throw new Error(`${name} must remain an unrotated rectangle for this print preparation.`);
  }
}

/** Current deck must be the scratch design, proportionally fitted to its stock.
 * The known 17/88 and 77/88 band boundaries avoid losing precision by reading
 * inspector fields, which display only two decimals. Repeating this is safe.
 */
export async function prepareCardPrintMargins(ui, { deckName = 'Moonlit Market deck' } = {}) {
  const size = await openComponent(ui, deckName);
  if (!(size.widthMm > 0 && size.heightMm > 0)) throw new Error('The card trim needs valid dimensions.');
  const b = PRINT_MARGIN_MM;
  const headingBottom = size.heightMm * 17 / 88;
  const footerTop = size.heightMm * 77 / 88;
  await selectBand(ui, 'Midnight heading');
  const actualHeadingBottom = Number(await field(ui.page, 'Layer Y').inputValue()) + Number(await field(ui.page, 'Layer height').inputValue());
  if (Math.abs(actualHeadingBottom - headingBottom) > 0.02) {
    throw new Error('The heading boundary has changed. Fit the original scratch layout proportionally before preparing bleed.');
  }
  for (const [name, value] of Object.entries({
    'Layer X': -b, 'Layer Y': -b, 'Layer width': size.widthMm + 2 * b,
    'Layer height': headingBottom + b,
  })) await number(ui, name, value);
  await selectBand(ui, 'Forest footer');
  if (Math.abs(Number(await field(ui.page, 'Layer Y').inputValue()) - footerTop) > 0.02) {
    throw new Error('The footer boundary has changed. Fit the original scratch layout proportionally before preparing bleed.');
  }
  for (const [name, value] of Object.entries({
    'Layer X': -b, 'Layer Y': footerTop, 'Layer width': size.widthMm + 2 * b,
    'Layer height': size.heightMm - footerTop + b,
  })) await number(ui, name, value);
  await margins(ui);
  return { ...size, bleedMm: b, safeMm: b, headingBottom, footerTop };
}

/** Coin face backgrounds already fill the SVG bleed area automatically. */
export async function prepareCoinPrintMargins(ui, { coinName = 'Moon coins' } = {}) {
  const size = await openComponent(ui, coinName);
  await margins(ui);
  return { ...size, bleedMm: PRINT_MARGIN_MM, safeMm: PRINT_MARGIN_MM };
}

export async function preparePrintMargins(ui, options = {}) {
  return {
    cards: await prepareCardPrintMargins(ui, options),
    coins: await prepareCoinPrintMargins(ui, options),
  };
}
