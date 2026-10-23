import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5208',safari=process.env.TEST_BROWSER==='webkit';
const browser=await(safari?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/word-viewport-${safari?'webkit':'chromium'}`;await fs.mkdir(out,{recursive:true});
async function fits(page){const clippedWords=await page.locator('.wg-word>strong').evaluateAll(labels=>labels.filter(el=>{const r=el.getBoundingClientRect(),card=el.parentElement.getBoundingClientRect();return el.scrollWidth>el.clientWidth+1||r.left<card.left||r.right>card.right||r.top<card.top||r.bottom>card.bottom||parseFloat(getComputedStyle(el).fontSize)<12;}).map(el=>el.textContent));assert.deepEqual(clippedWords,[],'complete word labels remain readable inside their cards');const bad=await page.locator('.game-surface,.wg-table *').evaluateAll(xs=>xs.filter(x=>x.clientHeight&&x.scrollHeight>x.clientHeight+3&&['auto','scroll','hidden'].includes(getComputedStyle(x).overflowY)&&!x.closest('.wg-help-panel')&&!x.matches('.wg-team>div,.wg-illustrated-heading,.wg-dealt-players')).map(x=>[x.className,x.clientHeight,x.scrollHeight]));assert.deepEqual(bad,[],'no gameplay vertical scrolling or hidden overflow');for(const e of await page.locator('.wg-word,.wg-odd-player,.wg-pages,.wg-secret,.wg-clue-submit,.wg-speaking>.wg-button').all()){const b=await e.boundingBox();assert(b&&b.y>=0&&b.y+b.height<=page.viewportSize().height+1,'visible game control within viewport');}}
async function effectiveKeyboardViewport(locale){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(locale=>{localStorage.setItem('mocha-locale',locale);localStorage.setItem('mocha-profile',JSON.stringify({id:'word-effective-viewport',name:'Alex',avatar:'🦊'}));},locale);
 const page=await context.newPage();
 await page.goto(base);await page.locator('.cover-codenames').click();await page.getByRole('button',{name:locale==='zh'?'同屏试玩':'Pass & play',exact:true}).click();await page.locator('.wg-table').waitFor();
 const red=await page.locator('.wg-team.wg-active.wg-red').count()>0;
 await page.locator('.practice-switch select').selectOption(red?'practice-0':'practice-1');
 for(const width of [390,568]){
  await page.setViewportSize({width,height:320});
  const input=page.locator('.wg-clue-form input');await input.fill('Viewport draft');await input.focus();
  await expect(page.locator('.wg-word')).toHaveCount(6);await expect(page.locator('.wg-pages span')).toHaveText('1 / 5');
  await fits(page);await page.screenshot({path:`${out}/actual-effective-${locale}-${width}x320.png`});
  const seen=new Set();
  do{
   await fits(page);
   for(const index of await page.locator('.wg-cell-index').allTextContents())seen.add(index);
   const next=page.locator('.wg-pages button').last();if(await next.isDisabled())break;await next.click();
  }while(true);
  assert.equal(seen.size,25,'all actual-App words remain reachable with a reduced effective viewport');
  await expect(input).toHaveValue('Viewport draft');await input.focus();
  const previous=page.locator('.wg-pages button').first();while(!await previous.isDisabled())await previous.click();
 }
 await context.close();console.log('PASS actual App',locale,'focused input at 390x320 and 568x320, all 25 words, retained draft');
}
try{for(const locale of ['zh','en'])for(const [width,height] of [[320,568],[390,844],[430,932],[390,320],[568,320],[844,390],[932,430],[768,1024],[1440,900]])for(const kind of (width===390&&height===320?['codenames']:['codenames','undercover'])){
const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(l=>localStorage.setItem('mocha-locale',l),locale);const page=await context.newPage();await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&players=max${kind==='codenames'?'&scenario=long-words':''}`);await page.locator('.wg-table').waitFor();await fits(page);
if(kind==='codenames'&&width===320&&height===568){const refrigerator=page.locator('.wg-word>strong',{hasText:'Refrigerator'});assert.equal(await refrigerator.count(),1);assert.equal(await refrigerator.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;}),1,'Refrigerator stays whole on the 320px board');}
if(kind==='codenames'&&width===568&&height===320){assert.equal(await page.locator('.wg-word').count(),6,'short landscape exposes six readable cards');assert.equal((await page.locator('.wg-word-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)),3,'short landscape uses three columns');await expect(page.locator('.wg-pages span')).toHaveText('1 / 5');}
if(kind==='codenames'&&width===568&&height===320){assert.equal(await page.locator('.wg-word>strong',{hasText:'Refrigerator'}).evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;}),1,'long words remain whole when the available width allows it');}
const overlaps=await page.locator('.wg-word,.wg-odd-player').evaluateAll(xs=>xs.flatMap((e,i)=>{const a=e.getBoundingClientRect();return xs.slice(i+1).filter(x=>{const b=x.getBoundingClientRect();return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;}).map(x=>[e.textContent,x.textContent]);}));assert.deepEqual(overlaps,[],'cards must never overlap');
const count=kind==='codenames'?25:12,seen=new Set();do{for(const text of await page.locator(kind==='codenames'?'.wg-cell-index':'.wg-dealt-players>span>b').allTextContents())seen.add(text);const next=page.locator('.wg-pages button').last();if(!await next.count()||await next.isDisabled())break;await next.click();await fits(page);}while(true);assert.equal(seen.size,count,'all words/players reachable using pages');
if(kind==='codenames'){await page.locator('.wg-key-toggle').click();await expect(page.locator('.wg-key-toggle')).toHaveAttribute('aria-pressed','true');await page.getByLabel('Seat').selectOption('english-player-2');await page.getByLabel('Seat').selectOption('english-player-0');await expect(page.locator('.wg-key-toggle')).toHaveAttribute('aria-pressed','false');if(await page.locator('.wg-clue-form').count()){await page.locator('.wg-clue-form input').fill('Orbiting');await page.locator('.wg-clue-form select').selectOption('unlimited');await fits(page);await page.locator('.wg-clue-submit').click();await expect(page.locator('.wg-clue-form')).toHaveCount(0);await fits(page);}}
else{await page.locator('.wg-secret').click();await expect(page.locator('.wg-secret')).toHaveAttribute('aria-pressed','true');await fits(page);await page.getByLabel('Seat').selectOption('english-player-1');await page.getByLabel('Seat').selectOption('english-player-0');await expect(page.locator('.wg-secret')).toHaveAttribute('aria-pressed','false');await page.locator('.wg-secret').click();await page.locator('.wg-secret-panel>.wg-primary').click();await fits(page);}
await page.locator('.wg-help-button').last().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await page.screenshot({path:`${out}/${kind}-${locale}-${width}.png`});console.log('PASS',kind,locale,width,height);await context.close();
}for(const locale of ['zh','en'])await effectiveKeyboardViewport(locale);}finally{await browser.close();}
