import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium, webkit, expect} from '@playwright/test';

const base = process.env.BASE_URL || 'http://127.0.0.1:5344';
const name = process.env.TEST_BROWSER || 'chromium';
const browser = await (name === 'webkit' ? webkit : chromium).launch({headless: true});
const out = `test-results/drawing-feedback-${name}`;
await fs.mkdir(out, {recursive: true});
try {
 const page = await browser.newPage({viewport: {width: 700, height: 600}}), errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(`${base}/tests/ui/drawing-feedback.fixture.html`);
 const canvas = page.locator('canvas'), strokes = async () => JSON.parse(await page.locator('output').innerText());
 const pixels = async (x = 0, y = 0, width = 1, height = 1) => canvas.evaluate((node, area) => {
  const [x, y, width, height] = area;
  const data = node.getContext('2d').getImageData(Math.round(node.width * x), Math.round(node.height * y), Math.round(node.width * width), Math.round(node.height * height)).data;
  let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) count++; return count;
 }, [x, y, width, height]);
 const box = await canvas.boundingBox();
 const move = (x, y) => page.mouse.move(box.x + box.width * x, box.y + box.height * y);
 await move(.1, .8); await page.mouse.down();
 for (let i = 1; i <= 160; i++) await move(.1 + .8 * i / 160, .8);
 await expect.poll(() => pixels(.85, .7, .1, .2)).toBeGreaterThan(0);
 assert.equal((await strokes()).length, 0, 'Live preview must not submit an unfinished stroke');
 await canvas.screenshot({path: `${out}/live-before-release.png`});
 await page.mouse.up();
 await expect.poll(async () => (await strokes()).length).toBe(1);
 assert.deepEqual((await strokes())[0].points.at(-1), [900, 800]);
 assert((await strokes())[0].points.length <= 32);
 await expect.poll(() => pixels(.85, .7, .1, .2)).toBeGreaterThan(0);

 await page.getByText('Clear', {exact: true}).click();
 await move(.5, .5); await page.mouse.click(box.x + box.width * .5, box.y + box.height * .5);
 await expect.poll(() => pixels(.48, .48, .04, .04)).toBeGreaterThan(0);
 assert.equal((await strokes()).length, 1, 'A tap produces one visible point');
 await page.getByText('Clear', {exact: true}).click();
 // Native WebKit menus block subsequent automation; this fixture suppresses only
 // the menu, leaving the actual secondary-pointer down/up events intact.
 await canvas.evaluate(node => node.addEventListener('contextmenu', event => event.preventDefault(), {once: true}));
 await page.mouse.click(box.x + 100, box.y + 100, {button: 'right'});
 assert.equal((await strokes()).length, 0, 'Right-click does not draw');
 await move(.1, .6); await page.mouse.down(); await move(.8, .6);
 await expect.poll(() => pixels()).toBeGreaterThan(0);
 await page.evaluate(() => window.dispatchEvent(new Event('blur')));
 await page.mouse.up();
 await expect.poll(() => pixels()).toBe(0); assert.equal((await strokes()).length, 0, 'Blur discards a held gesture');

 for (const control of ['Toggle permission', 'New seat', 'Clear']) {
  await move(.2, .4); await page.mouse.down(); await move(.7, .4);
  await expect.poll(() => pixels()).toBeGreaterThan(0);
  // A second input source changes permission/seat while this pointer stays down.
  await page.getByText(control, {exact: true}).evaluate(button => button.click());
  await page.mouse.up(); await expect.poll(() => pixels()).toBe(0);
  assert.equal((await strokes()).length, 0, `${control} discards unfinished private input`);
  if (control === 'Toggle permission') await page.getByText(control, {exact: true}).click();
 }
 // Synthetic pointer IDs exercise ownership independently of browser mouse emulation.
 await canvas.evaluate(node => {
  const box = node.getBoundingClientRect();
  node.setPointerCapture = () => {}; node.hasPointerCapture = () => false;
  const emit = (type, pointerId, x, y) => node.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 10, button: 0, buttons: 1, clientX: box.x + x * box.width, clientY: box.y + y * box.height}));
  emit('pointerdown', 10, .1, .3); emit('pointermove', 10, .5, .3);
  emit('pointerdown', 11, .9, .9); emit('pointermove', 11, .9, .1); emit('pointerup', 11, .9, .1);
  emit('pointermove', 10, .8, .3); emit('pointerup', 10, .8, .3);
 });
 assert.equal((await strokes()).length, 1);
 assert((await strokes())[0].points.every(([, y]) => y === 300), 'A second finger cannot replace or mix the primary stroke');
 await page.getByText('Clear', {exact: true}).click();
 await canvas.evaluate(node => {
  const box = node.getBoundingClientRect(); node.setPointerCapture = () => {}; node.hasPointerCapture = () => false;
  const emit = (type, x) => node.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerId: 30, pointerType: 'pen', isPrimary: true, button: 0, buttons: 1, clientX: box.x + x * box.width, clientY: box.y + box.height * .5}));
  emit('pointerdown', 0);
  for (let i = 1; i <= 1000; i++) emit('pointermove', i / 1000);
  emit('pointerup', 1);
 });
 assert.equal((await strokes()).length, 1);
 const long = (await strokes())[0].points;
 assert(long.length <= 32); assert.deepEqual(long[0], [0, 500]); assert.deepEqual(long.at(-1), [1000, 500]);
 await page.getByText('Clear', {exact: true}).click();
 await canvas.evaluate(node => {
  const box = node.getBoundingClientRect(); node.setPointerCapture = () => {};
  for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) node.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerId: 20, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: box.x + 100, clientY: box.y + 100}));
 });
 await expect.poll(() => pixels()).toBe(0); assert.equal((await strokes()).length, 0, 'Cancelled touch never submits');
 await canvas.press('Enter'); await expect.poll(() => pixels()).toBeGreaterThan(0);
 assert.equal((await strokes()).length, 1, 'Keyboard point remains visible');
 // The actual table must reset the active canvas even when clearing an empty board.
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=drawguess`);
 await page.locator('.dg-private-choice button').first().click();
 const tableBox = await canvas.boundingBox();
 await page.mouse.move(tableBox.x + tableBox.width * .2, tableBox.y + tableBox.height * .7);
 await page.mouse.down(); await page.mouse.move(tableBox.x + tableBox.width * .8, tableBox.y + tableBox.height * .7);
 await expect.poll(() => pixels()).toBeGreaterThan(0);
 await page.getByRole('button',{name:/^(清空画布|Clear canvas)$/}).evaluate(button => {button.click();});
 await page.getByRole('button',{name:/^(确认清空画布|Confirm clear canvas)$/}).evaluate(button => {button.click();});
 await page.mouse.up(); await expect.poll(() => pixels()).toBe(0);
 assert.deepEqual(errors, []);
 console.log(`${name}: live feedback,160/1000-move endpoints,one-submit,tap,right-click,blur,permission/seat/clear,multi-touch,cancel,keyboard,table empty-clear PASS`);
} finally { await browser.close(); }
