import { test, expect } from '@playwright/test';

test('Admin UI: Review lane edits apply as a new draft commit', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');
  await page.click('text=+ New Article');
  await page.fill('#slugInput', 'e2e-review');
  await page.fill('#titleInput', 'Review Base');
  await page.fill('#bodyInput', 'Live body');

  await page.click('#saveBtn');
  await expect(page.locator('#status')).toContainText('Saved');

  await page.locator('#reviewSection summary').click();
  await page.click('#createReviewBtn');
  await expect(page.locator('#reviewBanner')).toContainText('Editing review lane');
  await expect(page.locator('#saveBtn')).toContainText('Save Review Lane');
  await expect(page.locator('#publishBtn')).toBeDisabled();

  await page.fill('#titleInput', 'Review Lane Title');
  await page.fill('#bodyInput', 'Review lane body');
  await page.click('#saveBtn');
  await expect(page.locator('#status')).toContainText('Saved review lane');

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.click('#applyReviewBtn');
  await expect(page.locator('#publishBtn')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('#saveBtn')).toContainText('Save Draft', { timeout: 15000 });
  await expect(page.locator('#reviewBanner')).not.toContainText('Editing review lane', { timeout: 15000 });
  await expect(page.locator('#titleInput')).toHaveValue('Review Lane Title');
  await expect(page.locator('#bodyInput')).toHaveValue(/Review lane body/);
});
