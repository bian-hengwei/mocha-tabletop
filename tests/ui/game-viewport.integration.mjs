import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
const out=`test-results/game-viewport-${engine}`;await fs.mkdir(out,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]],errors=[],layoutIssues=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);const games=await page.evaluate(async()=>Object.keys((await import('/src/core/types.ts')).GAMES));assert.equal(games.length,12);
 for(const language of ['zh','en']){
  await page.addInitScript(language=>localStorage.setItem('mocha-locale',language),language);
  for(const [width,height]of sizes){await page.setViewportSize({width,height});
   for(const kind of games){
    await page.goto(`${base}/tests/ui/i18n.fixture.html?kind=${kind}&players=max`);await expect(page.locator('.game-surface').locator(':scope>*').first()).toBeVisible();
    const overflow=await page.locator('.game-surface').evaluate(surface=>[surface,...surface.querySelectorAll('*')].filter(node=>node instanceof HTMLElement&&node.clientHeight>0&&node.scrollHeight>node.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(node).overflowY)&&!node.matches('.illustrated-tile,.role-art')).map(node=>({class:node.className,height:node.clientHeight,content:node.scrollHeight})));
    if(overflow.length)layoutIssues.push({kind,language,width,height,overflow});
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),`${kind}: document fits viewport`);
    if(width===320||width===844)await page.screenshot({path:`${out}/${kind}-${language}-${width}.png`});
   }
   console.log(layoutIssues.some(issue=>issue.language===language&&issue.width===width)?'FAIL':'PASS','all twelve maximum-player tables within viewport',language,width,height);
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(layoutIssues,[],'All game surfaces must fit without vertical scroll or clipping');
}finally{await browser.close();}
