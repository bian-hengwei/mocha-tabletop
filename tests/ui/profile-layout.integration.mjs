import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:5174';
const engine = process.env.TEST_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ executablePath: process.env.CHROME_PATH || undefined });
const output = `test-results/profile-layout-${engine}`;
await fs.mkdir(output, { recursive: true });
const sizes = [[320, 568], [390, 844], [430, 932], [844, 390], [932, 430], [768, 1024], [1440, 900], [568, 320]];

async function targets(page) {
  const small = await page.locator('.app-panel :is(button,input,select,textarea)').evaluateAll(controls => controls.flatMap(control => {
    const r = control.getBoundingClientRect();
    return r.width < 43.5 || r.height < 43.5 ? [{ name: control.getAttribute('aria-label') || control.textContent || control.tagName, width: r.width, height: r.height }] : [];
  }));
  assert.deepEqual(small, [], 'Every profile control has a 44px touch target');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
  assert(await page.locator('.avatar-grid').evaluate(grid => grid.scrollHeight <= grid.clientHeight || grid.offsetWidth - grid.clientWidth >= 6), 'Scrollable avatar choices retain a visible scrollbar gutter');
}

async function reachable(control) {
  await control.scrollIntoViewIfNeeded();
  assert(await control.evaluate(element => {
    const r = element.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1 && element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  }), 'Scrolled control is on screen and receives pointer input');
}

try {
  for (const locale of ['zh', 'en']) for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(locale => localStorage.setItem('mocha-locale', locale), locale);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    const input = page.locator('input[autocomplete="nickname"]');
    const save = page.locator('.profile-editor footer button');
    const avatars = page.locator('.avatar-grid button');
    await expect(input).toBeVisible();
    await expect(avatars).toHaveCount(48);
    await expect(save).toBeDisabled();
    await targets(page);
    await input.fill('  ');
    await expect(save).toBeDisabled();
    const name = '小猫玩家AbCdEf123456';
    await input.fill(name);
    await reachable(avatars.last());
    await avatars.last().click();
    const avatar = await avatars.last().textContent();
    await expect(avatars.last()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.avatar-preview')).toHaveText(avatar);
    assert.equal(await page.evaluate(() => localStorage.getItem('mocha-profile')), null, 'Choosing an avatar does not save');
    await page.locator('.app-panel .language-toggle').click();
    await expect(input).toHaveValue(name);
    await expect(avatars.last()).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.app-panel .language-toggle').click();
    await page.setViewportSize({ width: height, height: width });
    await targets(page);
    await expect(input).toHaveValue(name);
    await expect(avatars.last()).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width, height });
    await reachable(avatars.first());
    await page.screenshot({ path: `${output}/onboarding-${locale}-${width}x${height}.png` });
    await reachable(save);
    await save.click();
    await expect(input).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mocha-profile')));
    assert.equal(saved.name, name);
    assert.equal(saved.avatar, avatar);
    const opener = page.locator('.profile-chip');
    await opener.click();
    await targets(page);
    await input.fill('Cancelled edit');
    await avatars.first().click();
    await page.screenshot({ path: `${output}/edit-${locale}-${width}x${height}.png` });
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      assert(await page.locator('.app-panel').evaluate(panel => panel.contains(document.activeElement)), 'Focus stays inside profile dialog');
    }
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.click();
    await expect(input).toHaveValue(name);
    await expect(avatars.last()).toHaveAttribute('aria-pressed', 'true');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mocha-profile'))), saved, 'Cancel leaves stored profile unchanged');
    await input.fill('Saved edit');
    await avatars.first().click();
    await reachable(save);
    await save.click();
    await page.reload();
    await expect(opener).toContainText('Saved edit');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${locale} ${width}x${height}: touch targets, all avatars, language, rotation, save, cancel, focus and reload`);
  }
  // A reduced visual area exercises scrolling with a software keyboard; this is not device keyboard validation.
  for (const locale of ['zh', 'en']) for (const [width, height] of [[390, 310], [320, 300]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(locale => localStorage.setItem('mocha-locale', locale), locale);
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('input[autocomplete="nickname"]').fill('Keyboard draft');
    await targets(page);
    const last = page.locator('.avatar-grid button').last();
    await reachable(last);
    await last.click();
    const save = page.locator('.profile-editor footer button');
    await reachable(save);
    await page.screenshot({ path: `${output}/keyboard-${locale}-${width}x${height}.png` });
    await save.click();
    await expect(page.locator('.profile-chip')).toContainText('Keyboard draft');
    await context.close();
    console.log(`PASS ${locale} ${width}x${height}: reduced-height avatar selection and save`);
  }
} finally {
  await browser.close();
}
