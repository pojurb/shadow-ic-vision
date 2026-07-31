import { chromium } from '@playwright/test';
import fs from 'fs';

async function main() {
  console.log('Launching headless browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const artifactDir = 'C:/Users/napst/.gemini/antigravity-cli/brain/5670b6a5-bef5-4e25-a764-4528dcc650af';

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Initial Page Load state & Screenshot
  const initialTitle = await page.title();
  console.log('Page Title:', initialTitle);
  await page.screenshot({ path: `${artifactDir}/01_initial_landing.png`, fullPage: true });

  // 2. Click "+ New" button to open a new Thesis chat workspace
  console.log('Clicking "+ New" button...');
  const newBtn = page.locator('button:has-text("+ New")');
  await newBtn.click();

  // Wait for navigation to /c/<id>
  await page.waitForURL(/\/c\/.+/, { timeout: 15000 });
  console.log('Navigated to chat URL:', page.url());
  await page.screenshot({ path: `${artifactDir}/02_new_chat_workspace.png`, fullPage: true });

  // 3. Type Tesla thesis into chat textarea
  const teslaInput = "I believe TSLA automotive gross margin will remain above 20% through 2026 due to scaling FSD, Megapack energy storage, and Next-Gen platform cost reductions.";
  console.log('Entering Tesla thesis statement:', teslaInput);
  
  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill(teslaInput);
  await page.screenshot({ path: `${artifactDir}/03_typed_tesla_thesis.png`, fullPage: true });

  // 4. Submit form
  console.log('Submitting thesis...');
  const sendButton = page.locator('button[type="submit"]');
  await sendButton.click();

  // Wait for assistant response loading to finish and draft card / confirm button to appear
  console.log('Waiting for AI response and thesis draft extraction (up to 45s)...');
  const confirmBtn = page.locator('button:has-text("Confirm & Research")');
  try {
    await confirmBtn.waitFor({ state: 'visible', timeout: 45000 });
    console.log('Thesis draft extraction completed! Confirm & Research button is visible.');
  } catch (e) {
    console.log('Wait for Confirm & Research button timed out or card rendered differently:', e.message);
  }

  await page.screenshot({ path: `${artifactDir}/04_tesla_thesis_draft_response.png`, fullPage: true });

  // Capture text output of messages
  const messageTexts = await page.locator('div[class*="MessageRow"], div[class*="assistantBubble"], div[class*="draftCard"]').allInnerTexts();
  console.log('\n--- AI Response & Thesis Draft Output ---');
  console.log(messageTexts.join('\n---\n'));

  // 5. Click "Confirm & Research" if visible
  const confirmVisible = await confirmBtn.isVisible().catch(() => false);
  console.log('Confirm & Research button visible?', confirmVisible);

  if (confirmVisible) {
    console.log('Clicking "Confirm & Research"...');
    await confirmBtn.click();
    console.log('Waiting for research job to start/progress...');
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${artifactDir}/05_after_confirm_research.png`, fullPage: true });
  }

  // 6. View Research Panel
  const researchBtn = page.locator('button:has-text("View research")');
  const researchVisible = await researchBtn.isVisible().catch(() => false);
  console.log('View research button visible?', researchVisible);

  if (researchVisible) {
    console.log('Clicking "View research"...');
    await researchBtn.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${artifactDir}/06_research_panel_view.png`, fullPage: true });
  }

  // Record complete body text output
  const fullBodyText = await page.locator('body').innerText();
  fs.writeFileSync(`${artifactDir}/evaluated_tesla_full_output.txt`, fullBodyText);

  await browser.close();
  console.log('Evaluation completed successfully!');
}

main().catch(err => {
  console.error('Error during Tesla UX evaluation:', err);
  process.exit(1);
});
