import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = process.env.TEST_BROWSER==='webkit' ? await webkit.launch() : await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(5000);
await page.addInitScript(() => { localStorage.removeItem('mocha-practice-v1'); localStorage.setItem('mocha-profile', JSON.stringify({ id: 'keyboard-audit', name: '键盘测试', avatar: '🦊' })); });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function trapped(dialog) {
    assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Opening a dialog focuses its controls');
    const controls = dialog.locator('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]');
    await controls.first().focus();
    await page.keyboard.press('Shift+Tab');
    assert(await controls.last().evaluate(el => el === document.activeElement), 'Shift+Tab wraps within dialog');
    await page.keyboard.press('Tab');
    assert(await controls.first().evaluate(el => el === document.activeElement), 'Tab wraps within dialog');
    assert(await page.locator('.topbar').evaluate(el => !!el.closest('[inert]')), 'Background navigation stays inert');
}
try {
    await page.goto(base);
    await page.locator('.cover-gems').click();
    await trapped(page.getByRole('dialog'));
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert(await page.locator('.cover-gems').evaluate(el => el === document.activeElement), 'Closing restores cover focus');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '同屏试玩', exact: true }).click();
    await page.locator('.g-table').waitFor();
    const stock = page.getByRole('button', { name: '查看我的全部库存', exact: true });
    await stock.click();
    await trapped(page.getByRole('dialog'));
    await page.keyboard.press('Escape');
    assert(await stock.evaluate(el => el === document.activeElement), 'Inventory returns focus to stock');
    const card = page.locator('.g-market .development-card').first();
    await card.click();
    await trapped(page.getByRole('dialog'));
    await page.keyboard.press('Escape');
    assert(await card.evaluate(el => el === document.activeElement), 'Inspector returns focus to card');
    await page.getByRole('button', { name: '预留 1 级盲牌', exact: true }).click();
    await trapped(page.getByRole('dialog'));
    await page.keyboard.press('Escape');
    assert(await page.getByRole('button', { name: '预留 1 级盲牌', exact: true }).evaluate(el => el === document.activeElement), 'Action sheet returns focus to deck');
    assert.equal(await page.locator('[inert]').count(), 0, 'Closing all dialogs restores the whole table');
    await page.goto(base);
    await page.locator('.cover-century').click();
    await page.getByRole('button', { name: '同屏试玩', exact: true }).click();
    await page.locator('.ng-century').waitFor();
    const caravan = page.locator('.ng-panel').filter({ has: page.locator('h3', { hasText: '你的商队' }) });
    await caravan.scrollIntoViewIfNeeded();
    assert.deepEqual(await page.locator('.ng-pocket .ng-cubes b').allTextContents(), await caravan.locator('.ng-cubes b').allTextContents(), 'Compact inventory agrees with caravan');
    const pocket = await page.locator('.ng-pocket').boundingBox();
    const surface = await page.locator('.game-surface').boundingBox();
    assert(pocket.y >= surface.y - 1 && pocket.y + pocket.height < 844, 'Inventory remains on screen while considering merchant costs');
    await page.screenshot({ path: 'test-results/new-games/century-mobile-inventory.png' });
    assert.deepEqual(errors, []);
    console.log('PASS real App dialog keyboard controls: create table, inventory, card inspector, action sheet; Tab/Shift+Tab, Escape, background inert and restored focus; Century inventory visible while scrolling');
} finally { await browser.close(); }
