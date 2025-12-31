// @ts-check
import { test, expect } from '@playwright/test';

test('app loads and displays the Sunshine Optimist brand', async ({ page }) => {
  await page.goto('/');

  // Check that the page title is correct
  await expect(page).toHaveTitle('Sunshine Optimist');

  // Check that the brand name is visible
  await expect(page.getByText('Sunshine Optimist')).toBeVisible();
});

test('app displays location input and date picker', async ({ page }) => {
  await page.goto('/');

  // Location input should be visible
  const cityInput = page.getByRole('combobox', { name: 'City' });
  await expect(cityInput).toBeVisible();
  await expect(cityInput).toHaveAttribute('placeholder', 'Enter your city');

  // Date picker should be visible
  const dateInput = page.locator('#date-input');
  await expect(dateInput).toBeVisible();

  // Today button should be visible
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
});

test('app displays share button', async ({ page }) => {
  await page.goto('/');

  // Share button should be visible
  const shareButton = page.getByRole('button', { name: /Share Your Sunlight/i });
  await expect(shareButton).toBeVisible();
});

test('share modal opens and closes', async ({ page }) => {
  await page.goto('/');

  // Click the share button
  await page.getByRole('button', { name: /Share Your Sunlight/i }).click();

  // Modal should be visible
  const modal = page.getByRole('dialog', { name: /Share your daylight/i });
  await expect(modal).toBeVisible();

  // Close button should be visible
  await expect(page.getByRole('button', { name: 'Close share dialog' })).toBeVisible();

  // Click close button
  await page.getByRole('button', { name: 'Close share dialog' }).click();

  // Modal should be hidden
  await expect(modal).not.toBeVisible();
});
