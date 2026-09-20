import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const output = 'test-results/identity-portraits';
await fs.mkdir(output, { recursive: true });
const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.CHROME_PATH || undefined } : {}) });
const cases = { avalon: ['merlin','percival','morgana','assassin','servant','minion'], werewolf: ['wolf','seer','witch','hunter','guard','villager'] };
const viewports = [{width:320,height:568},{width:390,height:844},{width:600,height:800},{width:667,height:375},{width:844,height:390},{width:1280,height:900}];
const errors = [];
async function fullPicture(page) {
  const result = await page.locator('.identity-portrait-frame').evaluate(frame => {
    const svg = frame.querySelector('svg'), box = svg.viewBox.baseVal, matrix = svg.getScreenCTM();
    const transform = (x,y) => new DOMPoint(x,y).matrixTransform(matrix);
    const tl = transform(box.x,box.y), br = transform(box.x+box.width,box.y+box.height), bounds=frame.getBoundingClientRect();
    const clip = svg.querySelector('clipPath rect');
    return { fit:svg.getAttribute('preserveAspectRatio'), clipped:[tl.x>=bounds.left-1,tl.y>=bounds.top-1,br.x<=bounds.right+1,br.y<=bounds.bottom+1], onScreen:[tl.x>=0,tl.y>=0,br.x<=innerWidth,br.y<=innerHeight], clip:[clip.x.baseVal.value,clip.y.baseVal.value,clip.width.baseVal.value,clip.height.baseVal.value], tile:[box.x,box.y,box.width,box.height] };
  });
  assert.match(result.fit,/meet$/,'Full identity uses the complete source illustration');
  assert(result.clipped.every(Boolean),'All four edges of the illustrated tile fit the frame');
  assert(result.onScreen.every(Boolean),'The whole portrait is on screen when revealed');
  assert.deepEqual(result.clip,result.tile,'Letterboxing cannot reveal another role from the sprite');
}
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({viewport});
    page.setDefaultTimeout(6000);page.on('pageerror',error=>errors.push(error.message));
    for (const [kind,roles] of Object.entries(cases)) for (const role of roles) {
      await page.goto(`${base}/tests/ui/identity-portraits.fixture.html?kind=${kind}&role=${role}`);
      await page.getByRole('button',{name:'查看我的身份',exact:true}).click();
      await fullPicture(page);
      assert(await page.locator('.identity-hide').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.height>=36;}),'Conceal action stays reachable');
      assert(await page.locator('.identity-reveal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
      await page.screenshot({path:`${output}/${kind}-${role}-${viewport.width}x${viewport.height}.png`});
      await page.locator('.identity-seal').scrollIntoViewIfNeeded();
      await page.locator('.identity-seal').click();
      assert.equal(await page.locator('.identity-curtain').count(),0,'Bottom conceal action works after scrolling');
      assert.equal(await page.locator('[inert]').count(),0,'Closing restores the table');
    }
    // Long private knowledge must scroll independently of the always visible header.
    await page.goto(`${base}/tests/ui/identity-portraits.fixture.html?kind=werewolf&role=seer&long=1&language=en`);
    await page.locator('.identity-deck').click();await fullPicture(page);
    await page.locator('.identity-knowledge>div').last().scrollIntoViewIfNeeded();
    assert(await page.locator('.identity-hide').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Close remains visible at the end of a long journal');
    await page.locator('.identity-seal').scrollIntoViewIfNeeded();await page.locator('.identity-seal').click();
    await page.locator('.identity-deck').click();
    await page.setViewportSize({width:viewport.height,height:viewport.width});
    await page.locator('.identity-content').evaluate(el=>el.scrollTop=0);
    await fullPicture(page);await page.keyboard.press('Escape');
    assert.equal(await page.locator('.identity-curtain').count(),0,'Escape works after rotation');
    await page.close();
    console.log(`PASS all 12 role illustrations, full tile boundaries, reachable actions, long English journal and rotation at ${viewport.width}x${viewport.height}`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
