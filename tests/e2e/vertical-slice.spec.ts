import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const evidenceDirectory = path.join(
  process.cwd(),
  'docs',
  'evidence',
  'releases',
  '2026-07-04-m001-local-vertical-slice',
);

test.beforeAll(() => {
  fs.rmSync(path.join(process.cwd(), '.tmp-e2e'), { recursive: true, force: true });
  fs.mkdirSync(evidenceDirectory, { recursive: true });
});

test('captures the verified desktop slice and narrow Research drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Codex Protocol (v3)' })).toBeVisible();
  await page.getByRole('button', { name: '+ New' }).click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'State a thesis to begin' })).toBeVisible();

  await page.getByPlaceholder('State your thesis or assumption...').fill(
    'I believe PLTR gross margin will remain above 80%.',
  );
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Confirmation required')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm & Research' }).click();

  const researchPanel = page.getByRole('complementary', { name: 'Research panel' });
  await expect(researchPanel.getByText('succeeded', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText('exact_verified', { exact: true })).toBeVisible();
  await expect(researchPanel.locator('blockquote')).toContainText('gross margin of 81.3%');
  await expect(researchPanel.getByRole('link', { name: 'SEC Form 10-Q Q1 2026 (PLTR)' })).toBeVisible();

  const sidebarBox = await page.locator('body > aside').boundingBox();
  const inputBox = await page.getByPlaceholder('State your thesis or assumption...').boundingBox();
  const desktopPanelBox = await researchPanel.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(desktopPanelBox).not.toBeNull();
  expect(inputBox!.x).toBeGreaterThan(sidebarBox!.x + sidebarBox!.width);
  expect(desktopPanelBox!.x).toBeGreaterThan(inputBox!.x);

  await page.screenshot({ path: path.join(evidenceDirectory, 'desktop-pltr-verified.png') });

  await page.setViewportSize({ width: 800, height: 900 });
  const closeButton = page.getByRole('button', { name: 'Close research panel' });
  await expect(closeButton).toBeVisible();
  await expect(researchPanel).toHaveCSS('position', 'fixed');

  const drawerBox = await researchPanel.boundingBox();
  expect(drawerBox).not.toBeNull();
  expect(drawerBox!.width).toBeLessThanOrEqual(421);
  expect(Math.round(drawerBox!.x + drawerBox!.width)).toBe(800);

  await page.screenshot({ path: path.join(evidenceDirectory, 'narrow-research-drawer.png') });

  await closeButton.click();
  await expect(researchPanel).not.toBeInViewport();
  await page.getByRole('button', { name: 'View research' }).click();
  await expect(researchPanel).toBeInViewport();
});
