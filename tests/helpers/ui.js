import { expect } from "@playwright/test";

export const waitForLoadingOverlayToFinish = async (page, timeout = 15000) => {
  const overlay = page.locator("#loading-overlay");
  await expect(overlay).toBeHidden({ timeout });
};
