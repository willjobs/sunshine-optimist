// @ts-check
import { test, expect } from '@playwright/test'
import { BOSTON } from './helpers/fixtures.js'
import {
  installApiMocks,
  installFontMocks,
  installPermissionsMock,
  setStoredLocation,
} from './helpers/mock-network.js'

test.beforeEach(async ({ page }) => {
  await installFontMocks(page)
  await installApiMocks(page)
  await installPermissionsMock(page, 'denied')
  await setStoredLocation(page, BOSTON)
})

test('milestone toggle cycles upcoming milestones', async ({ page }) => {
  await page.goto('/')

  const toggle = page.locator('#milestone-toggle')
  await expect(toggle).toBeEnabled()

  const initialLabel = await toggle.getAttribute('aria-label')
  const initialHeadline = await page.locator('#next-headline').textContent()

  await toggle.click()

  await expect(toggle).not.toHaveAttribute('aria-label', initialLabel || '')
  await expect(page.locator('#next-headline')).not.toHaveText(initialHeadline || '')
})

test('delta tooltip opens with keyboard and closes on escape', async ({ page }) => {
  await page.goto('/')

  const tooltipTarget = page.locator('#sunset-earliest-reference')
  await expect(tooltipTarget).toHaveAttribute('data-tooltip', /.+/)

  await tooltipTarget.focus()
  await page.keyboard.press('Enter')
  await expect(tooltipTarget).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(tooltipTarget).toHaveAttribute('aria-expanded', 'false')
})
