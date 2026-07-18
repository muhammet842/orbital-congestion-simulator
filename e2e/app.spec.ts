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

test.describe('Left panel filters', () => {
  test('four orbit-layer checkboxes are present and checked by default', async ({ page }) => {
    await page.goto('/');
    const checkboxes = page.locator('input[data-layer]');
    await expect(checkboxes).toHaveCount(4, { timeout: 10_000 });
    for (let i = 0; i < 4; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
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
