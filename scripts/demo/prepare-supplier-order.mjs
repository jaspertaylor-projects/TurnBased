// Visible UI scenes for the Moonlit Market supplier walkthrough.
// Catalog reads and downloads are real; these helpers never submit an order.
const button = (page, name) => page.getByRole('button', { name, exact: true });

export async function openSupplierOrder({ page, click }) {
  await click(button(page, 'print & share'));
  await click(page.getByRole('navigation', { name: 'Print and order tools' })
    .getByRole('button', { name: 'Prepare supplier order', exact: true }));
  await page.getByRole('region', { name: 'Prepare supplier order', exact: true }).waitFor();
}

async function reviewMatch({ page, click, fill }, component, category, query, title, variant) {
  const item = page.getByRole('article', { name: `Supplier for ${component}`, exact: true });
  await click(item.getByRole('button', { name: 'Choose supplier', exact: true }));
  const dialog = page.getByRole('dialog', { name: `Match supplier · ${component}`, exact: true });
  await dialog.getByLabel('Catalog category', { exact: true }).selectOption(category);
  await fill(dialog.getByLabel('Find a supplier product', { exact: true }), query);
  await click(dialog.getByRole('button').filter({ hasText: title }));
  await dialog.getByLabel('Supplier variant', { exact: true }).selectOption({ label: variant });
  await click(dialog.getByRole('radio', { name: /^Fit template to supplier size/ }));
  await click(button(page, 'Review match'));
  await page.waitForTimeout(2400);
}

export async function reviewDeckSupplier(ui) {
  await reviewMatch(ui, 'Moonlit Market deck', 'cards', 'white border poker',
    'Custom White Border Poker Sized Cards', 'Up to 18 cards - (S27) Smooth - Smooth');
}

export async function reviewCoinSupplier(ui) {
  await reviewMatch(ui, 'Moon coins', 'tiles', 'circle',
    'Custom Circle Game Tiles 1" Micro Size', '36 tiles/sheet - 1.6mm thick');
}

export async function applySupplierMatch({ page, click }) {
  await click(button(page, 'Apply supplier match'));
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => {
    const refresh = document.querySelector('[aria-label="Refresh supplier details"]');
    return refresh && !refresh.disabled;
  });
}

export async function downloadSupplierPackage({ page, click }) {
  const download = page.waitForEvent('download', { timeout: 120000 });
  await click(button(page, 'Download supplier package'));
  const result = await download;
  if (await result.failure()) throw new Error('The supplier package download failed.');
  await page.getByRole('status').filter({ hasText: 'Supplier package downloaded:' }).waitFor();
}
