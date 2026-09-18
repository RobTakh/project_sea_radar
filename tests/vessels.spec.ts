import { expect, test, type Page } from '@playwright/test';

const openPageWithoutMapTiles = async (page: Page) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
};

test('shows three demonstration vessel markers', async ({ page }) => {
  await openPageWithoutMapTiles(page);

  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
});

test('opens the matching card when a vessel is clicked', async ({ page }) => {
  await openPageWithoutMapTiles(page);
  const vessel = page.locator('[data-vessel-id="demo-2"]');

  await vessel.click();

  await expect(page.locator('[aria-label="Карточка судна demo-2"]')).toBeVisible();
  await expect(page.locator('[aria-label="Карточка судна demo-2"] dd').first()).toHaveText('demo-2');
});

test('keeps the card open when the same vessel is clicked again', async ({ page }) => {
  await openPageWithoutMapTiles(page);
  const vessel = page.locator('[data-vessel-id="demo-3"]');

  await vessel.click();
  const card = page.locator('[aria-label="Карточка судна demo-3"]');
  await expect(card).toBeVisible();

  await vessel.click();

  await expect(card).toBeVisible();
  await expect(card.locator('dd').first()).toHaveText('demo-3');
});
