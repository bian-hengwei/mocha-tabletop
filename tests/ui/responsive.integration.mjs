import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5180';
const out='test-results/responsive';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const page=await browser.newPage({deviceScaleFactor:1,hasTouch:true});page.setDefaultTimeout(5000);
await page.addInitScript(()=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'responsive-test',name:'戴着眼镜的黑猫商人',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function fits(label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${label}: document must fit viewport`);}
async function costs(){const bad=await page.locator('.development-card,.g-noble').evaluateAll(cards=>cards.flatMap(card=>{const r=card.getBoundingClientRect();return [...card.querySelectorAll('.g-cost b')].filter(n=>{const x=n.getBoundingClientRect();return x.left<r.left-1||x.right>r.right+1||x.top<r.top-1||x.bottom>r.bottom+1;}).map(n=>({card:card.getAttribute('aria-label'),digit:n.textContent}));}));assert.deepEqual(bad,[],'Every cost digit remains inside its card');}
try{
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:600,height:800},{width:768,height:1024},{width:568,height:320},{width:844,height:390},{width:1280,height:720}]){
 await page.setViewportSize(viewport);
 await page.goto(base);await page.locator('.game-library').waitFor();await fits('home');assert((await page.locator('.game-cover').count())>=7);await page.screenshot({path:`${out}/home-${viewport.width}x${viewport.height}.png`});
 for(const card of await page.locator('.game-cover').all()){await card.click();await page.locator('.create-body').waitFor();await page.getByRole('button',{name:'关闭',exact:true}).click();}
 await page.goto(`${base}/tests/ui/gems-harness.html?n=4&seed=11&dense=1`);await page.locator('.g-table').waitFor();await fits('gems');await costs();
 await page.screenshot({path:`${out}/gems-${viewport.width}x${viewport.height}.png`});
 await page.getByRole('button',{name:'查看我的全部库存',exact:true}).click();await costs();const panel=await page.locator('.g-inventory').boundingBox();assert(panel.x>=0&&panel.x+panel.width<=viewport.width+1,'Inventory fits screen');await page.screenshot({path:`${out}/inventory-${viewport.width}x${viewport.height}.png`});
 await page.goto(`${base}/tests/ui/bombs-harness.html?seed=9`);await page.locator('.bt-table').waitFor();await fits('bombs');const first=page.locator('.bt-hand .bt-card').first();await first.scrollIntoViewIfNeeded();await first.click();assert((await page.locator('.bt-focus').textContent()).includes('选中的手牌'));await page.screenshot({path:`${out}/bombs-${viewport.width}x${viewport.height}.png`});
 await page.locator('.bt-hand').evaluate(el=>el.scrollTo({left:el.scrollWidth}));const last=await page.locator('.bt-hand .bt-card').last().boundingBox();assert(last.x>=0&&last.x+last.width<=viewport.width+1,'Last card is reachable');
 for(const kind of ['werewolf','avalon']){
  await page.goto(`${base}/tests/ui/social.fixture.html?kind=${kind}`);await page.locator('.seat').last().waitFor();await fits(kind);
  const overlaps=await page.locator('.seat').evaluateAll(nodes=>{const rects=nodes.map(n=>n.getBoundingClientRect()),bad=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){let a=rects[i],b=rects[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)bad.push([i,j]);}return bad;});assert.deepEqual(overlaps,[],`${kind} seats must not overlap at ${viewport.width}`);
  for(const i of [0,await page.locator('.seat').count()-1]){await page.locator('.seat').nth(i).locator('.seat-avatar').click();await page.locator('.choice.selected').waitFor();await page.getByRole('button',{name:'关闭选择',exact:true}).click();}
  await page.screenshot({path:`${out}/${kind}-${viewport.width}x${viewport.height}.png`});
 }
 await page.goto(`${base}/tests/ui/social-hosted.fixture.html?mode=judge&n=18`);await page.locator('.judge-player').last().waitFor();await fits('judge');await page.locator('.judge-next').click();await page.getByRole('button',{name:'关闭选择',exact:true}).click();await page.screenshot({path:`${out}/judge-${viewport.width}x${viewport.height}.png`});
 await page.getByRole('combobox',{name:'切换测试座位'}).selectOption('p1');await page.getByRole('button',{name:'查看我的身份',exact:true}).click();await page.getByRole('button',{name:'翻回牌背',exact:true}).click();
 console.log(`PASS ${viewport.width}x${viewport.height}: costs, inventory, hand, maximum social seats, judge controls, private identity`);
}
assert.deepEqual(errors,[]);console.log('PASS responsive UI; no runtime errors');
}finally{await browser.close();}
