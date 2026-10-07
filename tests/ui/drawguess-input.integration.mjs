import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5311';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined}));
try {
 for(const locale of ['zh','en']) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=drawguess`);
  await page.locator('.dg-private-choice button').first().click();
  await page.getByLabel('Seat').selectOption('english-player-1');
  const input=page.locator('.dg-guess-form input');
  const composing='候选答案';
  await input.fill(composing);
  // Synthetic composition events exercise the browser DOM boundary only; they are not a system-IME claim.
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  assert.equal(await input.inputValue(),composing,'composing Enter keeps the draft');
  assert.equal((await page.locator('.dg-guesses').innerText()).includes(composing),false,'composing Enter does not submit a guess');
  await input.dispatchEvent('compositionend');
  const legacy='兼容候选';
  await input.fill(legacy);
  const prevented=await input.evaluate(node=>{
   const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});
   Object.defineProperty(event,'keyCode',{value:229});
   return !node.dispatchEvent(event);
  });
  assert.equal(prevented,true,'legacy keyCode 229 Enter is prevented');
  assert.equal(await input.inputValue(),legacy,'legacy composing Enter keeps the draft');
  assert.equal((await page.locator('.dg-guesses').innerText()).includes(legacy),false,'legacy composing Enter does not submit a guess');
  await input.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.dg-guess-form input')?.value==='');
  assert.equal(await input.inputValue(),'','ordinary Enter clears after authoritative local acceptance');
  assert.equal((await page.locator('.dg-guesses').innerText()).includes(legacy),true,'ordinary Enter submits the guess');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS drawguess ${engine} ${locale}: composition Enter and keyCode 229 retain drafts; ordinary Enter submits`);
 }
} finally { await browser.close(); }
