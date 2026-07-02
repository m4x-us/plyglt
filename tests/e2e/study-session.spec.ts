import { test, expect } from '@playwright/test';

/**
 * Smoke test: full user path through the app without mocks.
 * Steps:
 *   1. Language picker renders on /
 *   2. Click Italian → navigates to /learn
 *   3. Click first unlocked unit (A1 Unit 01) → navigates to /study
 *   4. StudyCard renders with a prompt and input
 *   5. Advance the card → session progresses to card 2
 */
test('core study session smoke test', async ({ page }) => {
  // ── Step 1: Language picker ──────────────────────────────────────────────
  // networkidle gives React time to hydrate — the page returns null pre-mount
  // via useSyncExternalStore, so the button doesn't exist until client hydration.
  await page.goto('/', { waitUntil: 'networkidle' });

  // Verify the Italian button is visible
  const italianButton = page.locator('button', { hasText: 'Italian' });
  await expect(italianButton).toBeVisible({ timeout: 15_000 });

  // ── Step 2: Select Italian ───────────────────────────────────────────────
  await italianButton.click();
  // handleSelect() sets LANG_PAIR_KEY then does window.location.href = "/learn"
  // Use regex to tolerate trailing slash: /learn vs /learn/
  await page.waitForURL(/\/learn/, { timeout: 15_000 });

  // ── Step 3: Unit list renders ────────────────────────────────────────────
  // Wait for pack to load — A1 Unit 01 link must appear.
  // Link href may be "/study?unit=..." with or without trailing slash.
  const unit01Link = page.locator('a[href*="a1-unit-01-greetings"]');
  await expect(unit01Link).toBeVisible({ timeout: 30_000 });

  // ── Step 4: Navigate into Unit 01 ───────────────────────────────────────
  await unit01Link.click();
  await page.waitForURL(/a1-unit-01-greetings/, { timeout: 10_000 });

  // StudyCard renders: prompt text and answer input are visible
  const answerInput = page.locator('input[placeholder="Type your answer..."]');
  await expect(answerInput).toBeVisible({ timeout: 15_000 });

  // Progress starts at card 1
  await expect(page.locator('text=/^1 \\//').first()).toBeVisible();

  // ── Step 5: Advance the card ─────────────────────────────────────────────
  // First wrong attempt
  await answerInput.fill('wrong-one');
  await answerInput.press('Enter');

  // Second wrong attempt — triggers "show answer" state (attempts ≥ 2)
  await answerInput.fill('wrong-two');
  await answerInput.press('Enter');

  // "Continue →" appears after 2 failures
  const continueBtn = page.locator('button', { hasText: 'Continue' });
  await expect(continueBtn).toBeVisible();
  await continueBtn.click();

  // Session progressed: card 2 is now shown
  await expect(page.locator('text=/^2 \\//').first()).toBeVisible({ timeout: 5_000 });
});
