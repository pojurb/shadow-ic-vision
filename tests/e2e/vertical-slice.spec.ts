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
  // Returned so a caller can scope sidebar assertions to the conversation it
  // just created. The whole suite shares one SQLite file, so several tests
  // leave behind conversations still titled "New Thesis" — matching that text
  // globally is a strict-mode violation waiting to happen.
  return data.id as string;
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
  // M011: this assumption now carries two evidence rows — the exact-match text
  // passage and a structured XBRL fact — so both of these locators resolve to
  // more than one element and must be scoped with `.first()` rather than
  // relying on there being exactly one.
  await expect(researchPanel.getByText('pending', { exact: true }).first()).toBeVisible();
  // M007: assumption status now renders via assumptionStatusBadge (a proper
  // badge, e.g. "Untested"), not the raw enum value ("untested").
  await expect(researchPanel.getByText('Assumption: Untested', { exact: true })).toBeVisible();
  // Located by content rather than by position: this assumption now carries
  // both an exact-match text passage and a structured XBRL fact, and which of
  // the two is rendered first is not a property worth pinning.
  await expect(researchPanel.locator('blockquote').filter({ hasText: 'gross margin of 81.3%' })).toBeVisible();
  await expect(researchPanel.locator('blockquote').filter({ hasText: 'us-gaap:GrossMarginRatio' })).toBeVisible();
  await expect(researchPanel.getByRole('link', { name: 'SEC Form 10-Q Q1 2026 (PLTR)' })).toBeVisible();

  // M011. The deterministic verdict and coverage ledger. These are the only
  // surfaces that report *direction* rather than retrieval, and they are
  // rendered outside `.panelContent`, so this also confirms the structural
  // placement holds in a real browser.
  await expect(researchPanel.getByTestId('thesis-verdict')).toBeVisible();
  await expect(researchPanel.getByTestId('thesis-verdict')).toContainText('THESIS HOLDING');
  await expect(researchPanel.getByTestId('coverage-ledger')).toContainText('1 of 1 assumptions');
  // The XBRL fact cleared the claim's threshold, so it is badged as supporting
  // with the signed gap. Only structured-fact evidence gets a polarity badge at
  // all — the text passage stays honestly unbadged.
  await expect(researchPanel.getByTestId('polarity-badge')).toHaveText('Supports (+1.3 vs threshold)');

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
  // M007: assumption status now renders via assumptionStatusBadge (a proper
  // badge, e.g. "Untested"), not the raw enum value ("untested").
  await expect(researchPanel.getByText('Assumption: Untested', { exact: true })).toBeVisible();
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

// M008 Slice 4. First real render of the Discovery Candidates section —
// previously only proven at the data layer (research-service.test.ts),
// never actually painted and looked at. Mocks `/api/research` directly,
// same as the two tests above, rather than seeding `discoveryCandidates`
// through a real processResearchJobs run (no Tavily key or allowlist is
// configured in the e2e webServer env, so that path would produce nothing
// to show).
test('shows the Discovery Candidates section with pending, fetched, and rejected states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
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
          statement: 'BBRI NIM remains above 6%.',
          assumptionStatus: 'untested',
          job: {
            id: '33e33d84-53c4-4b09-a38a-5ce621c65478',
            status: 'succeeded',
            error: null,
            errorCode: null,
            attemptCount: 1,
            sourceMode: 'live',
          },
          evidence: [],
        }],
        discoverySummary: {
          candidates: [
            {
              id: 'cand-rejected',
              candidateUrl: 'https://finance.aggregator.example.com/quote/BBRI',
              status: 'rejected',
              rejectionReason: 'domain_not_allowlisted',
              updatedAt: '2026-07-26T01:00:00.000Z',
            },
            {
              id: 'cand-pending',
              candidateUrl: 'https://www.bri.co.id/press-release/q2-2026-results',
              status: 'pending',
              rejectionReason: null,
              updatedAt: '2026-07-26T02:00:00.000Z',
            },
            {
              id: 'cand-fetched',
              candidateUrl: 'https://ir.bri.co.id/press/nim-update-2026',
              status: 'fetched',
              rejectionReason: null,
              updatedAt: '2026-07-26T03:00:00.000Z',
            },
          ],
        },
      }),
    });
  });

  await page.reload();
  const researchPanel = page.getByRole('complementary', { name: 'Research panel' });
  await expect(researchPanel.getByRole('heading', { name: 'Discovery Candidates' })).toBeVisible();
  await expect(researchPanel.getByText('Not allowlisted — add this domain to promote it')).toBeVisible();
  await expect(researchPanel.getByText('Pending — awaiting promotion')).toBeVisible();
  await expect(researchPanel.getByText('Fetched — classified as secondary evidence')).toBeVisible();
  await expect(researchPanel.getByRole('link', { name: 'https://finance.aggregator.example.com/quote/BBRI' })).toBeVisible();
  await expect(researchPanel.getByRole('link', { name: 'https://ir.bri.co.id/press/nim-update-2026' })).toBeVisible();
  await researchPanel.screenshot({ path: path.join(evidenceDirectory, 'discovery-candidates-section.png') });
});

// Found during live testing (2026-07-30): chat message text rendered with no
// `white-space: pre-wrap`, so real newlines in a reply (or a leaked JSON
// fence — see the `chat`/`structuredExtract` prompt split in
// `app/api/chat/route.ts`) collapsed onto one squashed line. This is the
// only layer in this repo that can verify the CSS fix actually renders
// correctly in a browser — there's no React component-testing capability
// (no `@testing-library/react`), so no unit test can assert on rendering.
test('renders chat message text with preserved whitespace, not collapsed onto one line', async ({ page }) => {
  await gotoHome(page);
  await createNewConversation(page);

  await page.getByPlaceholder('State your thesis or assumption...').fill(
    'I believe PLTR gross margin will remain above 80%.',
  );
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Confirmation required')).toBeVisible();

  const assistantMessageText = page.locator('[class*="messageText"]').last();
  await expect(assistantMessageText).toBeVisible();
  await expect(assistantMessageText).toHaveCSS('white-space', 'pre-wrap');
});

// Found during live testing (2026-07-30): the sidebar showed the literal
// string "New Thesis" for every conversation, forever — conversations.title
// was set once at creation and never updated. This is the only layer that
// can verify the fix actually reaches the visible sidebar, since it depends
// on client-side CustomEvent wiring (no React component-testing capability
// exists in this repo) and must NOT require a page reload to take effect.
test('sidebar title updates from "New Thesis" after first message, without reload', async ({ page }) => {
  await gotoHome(page);
  const conversationId = await createNewConversation(page);
  // Scoped to this conversation's own sidebar link. Earlier tests in this file
  // leave behind conversations still titled "New Thesis" in the shared e2e
  // database, so an unscoped match resolves to several elements and fails on
  // strict mode rather than on the behaviour under test. (Latent before M011;
  // fixed independently here and by a collaborator's ce8d7bc — same root cause.)
  const sidebarLink = page.locator(`a[href="/c/${conversationId}"]`);
  await expect(sidebarLink).toHaveText('New Thesis');

  await page.getByPlaceholder('State your thesis or assumption...').fill(
    'I believe PLTR gross margin will remain above 80%.',
  );
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Confirmation required')).toBeVisible();

  // Must patch in place via the CustomEvent — no page.reload() here.
  await expect(sidebarLink).toHaveText(/I believe PLTR gross margin/);
});

// M011. The clarification hard block is the only gate in this app that stops a
// user before research starts, and it is the half that cannot be verified
// anywhere but here: `draftClarificationBlock` is unit-tested, but that the
// button is genuinely un-clickable is a rendered-DOM fact. The button stays
// present-but-disabled rather than hidden, so this locator resolves either way
// and a regression is an assertion failure rather than a timeout.
test('blocks confirmation and shows the clarifying question when a measurement is ambiguous', async ({ page }) => {
  await gotoHome(page);
  await createNewConversation(page);

  await page.getByPlaceholder('State your thesis or assumption...').fill(
    'I believe PLTR gross margin will stay strong (simulate ambiguous measurement).',
  );
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Confirmation required')).toBeVisible();

  const clarification = page.getByTestId('draft-clarification');
  await expect(clarification).toBeVisible();
  await expect(clarification).toContainText('Do you mean total-company gross margin, or segment gross margin excluding one-time items?');
  await expect(page.getByRole('button', { name: 'Confirm & Research' })).toBeDisabled();
});
