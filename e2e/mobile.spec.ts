import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Mobile object list', () => {
  test('search list viewport can scroll without requiring a selection', async ({ page }) => {
    await page.goto('/');
    await page.locator('#toggle-left-panel').click();
    const viewport = page.locator('#object-list-viewport');
    await expect(viewport).toBeVisible({ timeout: 15_000 });

    const before = await viewport.evaluate((el) => el.scrollTop);
    await viewport.evaluate((el) => {
      el.scrollTop = 240;
    });
    const after = await viewport.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThan(before);

    // Scrolling alone must not select an object (right panel stays empty of selection).
    await expect(page.locator('.object-list-item--selected')).toHaveCount(0);
  });

  test('a short tap selects an object from the list', async ({ page }) => {
    await page.goto('/');
    await page.locator('#toggle-left-panel').click();
    const item = page.locator('.object-list-item').first();
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.click();
    await expect(page.locator('.object-list-item--selected')).toHaveCount(1, { timeout: 5_000 });
  });
});
