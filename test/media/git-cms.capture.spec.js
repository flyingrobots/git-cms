import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test('capture seeded sandbox walkthrough', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await request.post('/api/cms/snapshot', {
    data: {
      slug: 'restore-demo',
      title: 'Restore Demo v1',
      body: '# Restore Demo\n\nFirst draft for the media capture.',
    },
  });

  await request.post('/api/cms/snapshot', {
    data: {
      slug: 'restore-demo',
      title: 'Restore Demo v2',
      body: '# Restore Demo\n\nSecond draft for the media capture.',
    },
  });

  await page.goto('/');
  await expect(page.locator('#draftList')).toContainText('restore-demo');
  await page.waitForTimeout(900);

  await page.getByText('restore-demo').click();
  await expect(page.locator('#titleInput')).toHaveValue('Restore Demo v2');
  await page.waitForTimeout(1200);

  await page.locator('#historySection summary').click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await page.waitForTimeout(900);

  await page.locator('.history-item').nth(1).click();
  await expect(page.locator('#historyPreview')).toBeVisible();
  await page.waitForTimeout(1500);

  const outDir = process.env.MEDIA_OUT_DIR;
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    await page.screenshot({
      path: path.join(outDir, 'git-cms-poster.png'),
      fullPage: true,
    });
  }

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.locator('#restoreBtn').click();
  await expect(page.locator('#titleInput')).toHaveValue('Restore Demo v1');
  await page.waitForTimeout(1500);
});
