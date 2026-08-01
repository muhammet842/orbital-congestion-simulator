import { test, expect } from '@playwright/test';

/**
 * E2E smoke tests for Orbital Congestion Simulator.
 *
 * These tests run against the production-built preview server (port 4173).
 * They verify basic app functionality without relying on implementation details.
 */

test.describe('App bootstrap', () => {
  test('page loads and renders a <canvas> element', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  });

  test('page title contains "Orbital"', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/orbital/i, { timeout: 10_000 });
  });

  test('"Historical Events" heading is visible in the left panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Historical Events')).toBeVisible({ timeout: 10_000 });
  });

  test('renders at least 7 event cards', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.event-card');
    await expect(cards).toHaveCount(7, { timeout: 10_000 });
  });
});

test.describe('Event cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the event accordion to be populated
    await page.locator('.event-card').first().waitFor({ timeout: 10_000 });
  });

  test('clicking a card marks it active', async ({ page }) => {
    const firstCard = page.locator('.event-card').first();
    await firstCard.click();
    await expect(firstCard).toHaveClass(/event-card--active/);
  });

  test('clicking a second card deactivates the first', async ({ page }) => {
    const cards = page.locator('.event-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(cards.nth(0)).not.toHaveClass(/event-card--active/);
    await expect(cards.nth(1)).toHaveClass(/event-card--active/);
  });

  test('each card has an event-type badge', async ({ page }) => {
    const badges = page.locator('.event-type-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });
});

test.describe('Language switcher', () => {
  test('language dropdown exists in the header', async ({ page }) => {
    await page.goto('/');
    const select = page.locator('#lang-select');
    await expect(select).toBeVisible({ timeout: 10_000 });
  });

  test('switching to Turkish translates orbit-layers heading', async ({ page }) => {
    await page.goto('/');
    const select = page.locator('#lang-select');
    await select.selectOption('tr');
    // "ui.orbit_layers" in Turkish is "Yörünge Katmanları"
    await expect(page.getByText('Yörünge Katmanları')).toBeVisible({ timeout: 5_000 });
  });

  test('switching back to English restores English text', async ({ page }) => {
    await page.goto('/');
    const select = page.locator('#lang-select');
    await select.selectOption('tr');
    await select.selectOption('en');
    await expect(page.getByText('Orbit Layers')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Future Projection panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#kessler-panel-btn').waitFor({ timeout: 10_000 });
  });

  test('opens from the header button and shows the scenario sliders', async ({ page }) => {
    await page.locator('#kessler-panel-btn').click();
    await expect(page.locator('#kessler-panel')).toBeVisible();
    await expect(page.locator('#kp-launch')).toBeVisible();
    await expect(page.locator('#kp-mitigation')).toBeVisible();
    await expect(page.locator('#kp-risk')).toBeVisible();
    await expect(page.locator('#kp-target-year')).toBeVisible();
  });

  test('opening the panel reveals results and a narrative without a run button', async ({ page }) => {
    await page.locator('#kessler-panel-btn').click();
    await expect(page.locator('#kp-run')).toHaveCount(0);
    await expect(page.locator('#kp-results-section')).toBeVisible();
    const narrative = page.locator('#kp-narrative');
    await expect(narrative).toBeVisible();
    await expect(narrative).not.toHaveText('');
  });

  test('closes on Escape', async ({ page }) => {
    await page.locator('#kessler-panel-btn').click();
    await expect(page.locator('#kessler-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#kessler-panel')).toHaveCount(0);
  });
});

test.describe('Left panel filters', () => {
  test('four orbit-layer chips are present and active by default', async ({ page }) => {
    await page.goto('/');
    const chips = page.locator('button[data-layer]');
    await expect(chips).toHaveCount(4, { timeout: 10_000 });
    for (let i = 0; i < 4; i++) {
      await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('search input is present and accepts text', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('#object-search');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('ISS');
    await expect(input).toHaveValue('ISS');
  });
});
