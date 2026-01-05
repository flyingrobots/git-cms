import { test, expect } from '@playwright/test';

test('Admin UI: Create Draft and Publish', async ({ page }) => {
  // 1. Load Admin
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Git CMS');

  // 2. Create New Draft
  await page.click('text=+ New Article');
  await page.fill('#slugInput', 'e2e-test');
  await page.fill('#titleInput', 'E2E Title');
  await page.fill('#bodyInput', '# Hello E2E');
  
  // 3. Save
  await page.click('text=Save Draft');
  await expect(page.locator('#status')).toContainText('Saved');
  
  // 4. Verify in List
  await expect(page.locator('#draftList')).toContainText('e2e-test');
  
  // 5. Publish
  // Handle confirm dialog
  page.on('dialog', dialog => dialog.accept());
  await page.click('text=Publish');
  await expect(page.locator('#status')).toContainText('Published');
  
  // 6. Reload and Verify
  await page.reload();
  await page.click('text=e2e-test');
  await expect(page.locator('#titleInput')).toHaveValue('E2E Title');
});
