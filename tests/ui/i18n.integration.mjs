import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5180',out='test-results/responsive';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const page=await browser.newPage({deviceScaleFactor:1});page.setDefaultTimeout(6000);
await page.addInitScript(()=>localStorage.setItem('mocha-locale','en'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function clean(){const issues=await page.locator('.game-surface').evaluate(root=>{const all=[root,...root.querySelectorAll('*')],values=all.flatMap(n=>[...n.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE).map(x=>x.textContent).concat(['aria-label','title','placeholder','alt'].map(a=>n.getAttribute(a))));return [...new Set(values.filter(v=>v&&/[\u3400-\u9fff]/u.test(v)))];});assert.deepEqual(issues,[],'English body and accessible labels contain no untranslated text');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Document fits width');}
try{
for(const viewport of [{width:320,height:568},{width:568,height:320}]){
 await page.setViewportSize(viewport);
 for(const kind of ['gems','bombs','werewolf','avalon','sushi','century','uno','codenames','undercover']){
  await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}`);await page.locator('.game-surface > div,.game-surface > section').first().waitFor();await clean();
  await page.screenshot({path:`${out}/en-${kind}-${viewport.width}.png`});console.log(`PASS English ${kind} ${viewport.width}: body, labels, screen width`);
 }
}
for(const kind of ['codenames','undercover'])for(const language of ['en','zh']){
 await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&words=${language}`);
 const selector=kind==='codenames'?'.wg-word strong':'.wg-secret strong';
 if(kind==='undercover')await page.locator('.wg-secret').click();
 const words=await page.locator(selector).allTextContents();assert(words.length>0);
 await page.getByRole('button',{name:'Toggle language'}).click();assert.deepEqual(await page.locator(selector).allTextContents(),words,'UI language preserves game words');
 assert((await page.locator('.wg-heading').textContent()).match(/[\u3400-\u9fff]/u));
 await page.getByRole('button',{name:'Toggle language'}).click();assert.deepEqual(await page.locator(selector).allTextContents(),words);assert(!(await page.locator('.wg-heading').textContent()).match(/[\u3400-\u9fff]/u));
 console.log(`PASS ${kind}: UI language switches independently of ${language} word pack`);
}
await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=uno`);
await page.getByRole('combobox',{name:'Seat'}).selectOption({label:await page.locator('option').filter({hasText:'*'}).first().textContent()});
const playable=page.locator('.ng-hand .ng-uno-card:not([disabled])').filter({hasNotText:'Wild'}).first();const before=await page.locator('.ng-hand .ng-uno-card').count();await playable.click();assert.equal(await page.locator('.ng-hand .ng-uno-card').count(),before,'Selecting must not play the card');assert.equal(await playable.getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Play card',exact:true}).click();assert.equal(await page.locator('.ng-hand .ng-uno-card').count(),before-1);
await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=century`);const own=page.locator('.ng-panel').filter({has:page.locator('h3',{hasText:'Available merchants'})});
await own.getByRole('button',{name:/^Gain /}).first().click();assert.equal(await page.locator('.action-sheet').count(),0,'Gain merchant executes directly');assert.equal(await own.locator('.ng-spice-card').count(),1);
for(const viewport of [{width:320,height:568},{width:568,height:320}]){
 await page.setViewportSize(viewport);await page.goto(base+'/tests/ui/i18n.fixture.html?kind=uno&scenario=challenge');await page.locator('.ng-challenge').waitFor();await clean();
 assert.equal(await page.locator('.ng-challenge .ng-uno-card').count(),2);assert.match(await page.locator('.ng-challenge-result').textContent(),/succeeded/i);
 await page.locator('.ng-challenge').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/en-uno-challenge-'+viewport.width+'.png'});
 for(const viewer of ['english-player-0','english-player-2']){await page.getByRole('combobox',{name:'Seat'}).selectOption(viewer);assert.equal(await page.locator('.ng-challenge').count(),0,'Only the challenger sees evidence');}
 await page.getByRole('combobox',{name:'Seat'}).selectOption('english-player-1');await page.locator('.ng-challenge .ng-action').click();assert.equal(await page.locator('.ng-challenge').count(),0);await clean();
 console.log('PASS private challenge evidence, both other seats concealed, continue reachable at '+viewport.width);
}
assert.deepEqual(errors,[]);console.log('PASS selected card play and direct merchant play; no runtime errors');
}finally{await browser.close();}
