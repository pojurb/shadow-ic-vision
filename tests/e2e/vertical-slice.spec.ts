import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const evidenceDirectory = path.join(
  process.cwd(), process.env.E2E_EVIDENCE_DIR || path.join('test-results', 'evidence'),
);

test.beforeAll(() => {
  fs.rmSync(path.join(process.cwd(), '.tmp-e2e'), { recursive: true, force: true });
  fs.mkdirSync(evidenceDirectory, { recursive: true });
});

async function gotoHome(page: Page) {
  const conversationsLoaded = page.waitForResponse((response) =>
    response.url().includes('/api/conversations') && response.request().method() === 'GET',
  );
  await page.goto('/');
  await conversationsLoaded;
  await expect(page.getByRole('button', { name: '+ New' })).toBeVisible();
}

async function createNewConversation(page: Page) {
  const created = page.waitForResponse((response) =>
    response.url().includes('/api/conversations') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '+ New' }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const data = await response.json() as { id?: string };
  expect(data.id).toMatch(/^[0-9a-f-]+$/);
  await expect(page).toHaveURL(new RegExp(`/c/${data.id}$`), { timeout: 15_000 });
}

test('captures the verified desktop slice and narrow Research drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHome(page);

  await expect(page.getByRole('heading', { name: 'Codex Protocol (v3)' })).toBeVisible();
  await createNewConversation(page);
  await expect(page.getByRole('heading', { name: 'State a thesis to begin' })).toBeVisible();

  await page.getByPlaceholder('State your thesis or assumption...').fill(
    'I believe PLTR gross margin will remain above 80%.',
  );
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Confirmation required')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm & Research' }).click();

  const researchPanel = page.getByRole('complementary', { name: 'Research panel' });
  await expect(researchPanel.getByText('succeeded', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText('Exact source match', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText('pending', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText('Assumption: untested', { exact: true })).toBeVisible();
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

test('shows a live IDX fail-closed state without making a network request', async ({ page }) => {
  await gotoHome(page);
  await createNewConversation(page);
  await expect(page.getByRole('heading', { name: 'State a thesis to begin' })).toBeVisible();
  await page.route('**/api/research?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        thesis: {
          id: '0ce51c8e-13b9-4dc2-ac53-306a5a7d6ec7',
          ticker: 'BBRI',
          companyName: 'PT Bank Rakyat Indonesia (Persero) Tbk',
          market: 'ID',
          coreBelief: 'NIM remains above 6%.',
        },
        items: [{
          assumptionId: '253d5af1-7158-4a06-9c64-867258a240a1',
          statement: 'BBRI NIM remains above 6%.',
          assumptionStatus: 'untested',
          job: {
            id: '33e33d84-53c4-4b09-a38a-5ce621c65478',
            status: 'degraded',
            error: 'IDX official disclosure access failed.',
            errorCode: 'idx_source_unavailable',
            attemptCount: 1,
            sourceMode: 'live',
          },
          evidence: [],
        }],
      }),
    });
  });

  await page.reload();
  const researchPanel = page.getByRole('complementary', { name: 'Research panel' });
  await expect(researchPanel.getByText(/Live official source/)).toBeVisible();
  await expect(researchPanel.getByText('idx_source_unavailable', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText('Assumption: untested', { exact: true })).toBeVisible();
  await expect(researchPanel.getByRole('button', { name: 'Retry' })).toBeVisible();
  expect(await researchPanel.locator('blockquote').count()).toBe(0);
  await page.screenshot({ path: path.join(evidenceDirectory, 'live-idx-degraded.png') });
});

test('shows OCR and derived trust classes in the Research drawer', async ({ page }) => {
  await gotoHome(page);
  await createNewConversation(page);
  await page.route('**/api/research?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        thesis: {
          id: '0ce51c8e-13b9-4dc2-ac53-306a5a7d6ec7',
          ticker: 'BBRI',
          companyName: 'PT Bank Rakyat Indonesia (Persero) Tbk',
          market: 'ID',
          coreBelief: 'NIM remains above 6%.',
        },
        decisions: [],
        items: [{
          assumptionId: '253d5af1-7158-4a06-9c64-867258a240a1',
          statement: 'BBRI revenue and NIM remain resilient.',
          assumptionStatus: 'untested',
          job: {
            id: '33e33d84-53c4-4b09-a38a-5ce621c65478',
            status: 'succeeded',
            error: null,
            errorCode: null,
            attemptCount: 1,
            sourceMode: 'mock',
          },
          evidence: [{
            id: 'ocr-evidence',
            sourceTier: 'official',
            sourceName: 'IDX screenshot fixture',
            sourceUrl: 'https://example.invalid/idx-screenshot.png',
            publishDate: '2026-04-30',
            retrievalTimestamp: '2026-07-07T00:00:00.000Z',
            exactQuote: 'NIM: 6,8%',
            impactSummary: 'Screenshot OCR matched retained visible disclosure text.',
            verificationStatus: 'ocr_matched',
            sourceFormat: 'image',
            sourceVariant: 'scanned',
            contentKind: 'screenshot',
            extractionMethod: 'ocr',
            pageNumber: 1,
            boundingBox: '[0.1,0.3,0.4,0.4]',
            interpretationStatus: 'pending',
            metadata: '{"ocrVersion":"synthetic-screenshot-ocr-1.0"}',
          }, {
            id: 'derived-evidence',
            sourceTier: 'official',
            sourceName: 'BBRI chart fixture',
            sourceUrl: 'https://example.invalid/revenue-chart.png',
            publishDate: '2026-04-30',
            retrievalTimestamp: '2026-07-07T00:00:00.000Z',
            exactQuote: '15.0%',
            impactSummary: 'Chart growth calculated deterministically from retained visual data points.',
            verificationStatus: 'derived',
            sourceFormat: 'image',
            sourceVariant: null,
            contentKind: 'chart',
            extractionMethod: 'deterministic_calculation',
            pageNumber: 4,
            boundingBox: '[0.08,0.15,0.92,0.82]',
            interpretationStatus: 'pending',
            metadata: '{"method":"chart_growth"}',
          }],
        }],
      }),
    });
  });

  await page.reload();
  const researchPanel = page.getByRole('complementary', { name: 'Research panel' });
  await expect(researchPanel.getByText('OCR matched', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText('Derived', { exact: true })).toBeVisible();
  await expect(researchPanel.getByText(/not source-exact document text/)).toBeVisible();
  await expect(researchPanel.getByText(/must keep its method visible/)).toBeVisible();
  await expect(researchPanel.getByText('image/scanned · screenshot · ocr')).toBeVisible();
  await expect(researchPanel.getByText('image · chart · deterministic_calculation')).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDirectory, 'multimodal-trust-classes.png') });
});
