import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.BASE_URL||'http://127.0.0.1:5174',folder='/tmp/tabletop-bombs-v2';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:852,height:393},deviceScaleFactor:2,isMobile:true,hasTouch:true});page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const covered=new Set();
const switchSeat=async(id)=>page.getByRole('combobox',{name:'切换座位'}).selectOption(id);
const chooseActive=async()=>{const options=await page.locator('option').evaluateAll(os=>os.map(o=>({id:o.value,active:o.textContent.includes('待操作')})));const active=options.find(o=>o.active);assert(active,'A living seat must have an action');await switchSeat(active.id);};
let nopeUsed=false;
try{
for(const seed of process.env.LAYOUT_ONLY?[]:[9,20,43]){
 await page.goto(`${url}/tests/ui/bombs-harness.html?seed=${seed}`);await page.locator('.bt-table').waitFor();for(const card of await page.locator('.bt-hand .bt-card').all()){const box=await card.boundingBox();assert(box.y+box.height<=394,'Hand card bottom must not be clipped');}await page.screenshot({path:`${folder}/initial-${seed}.png`});let complete=false;
 for(let step=0;step<350;step++){
  if((await page.locator('.bt-focus').textContent()).includes('最后的幸存者')){complete=true;break;}
  await chooseActive();const cls=await page.locator('.bt-table').getAttribute('class'),phase=cls.split('bt-phase-')[1];covered.add(phase);
  if(phase==='response'){
    if(!nopeUsed){for(const id of ['a','b','c']){await switchSeat(id);const nope=page.locator('.bt-hand').getByRole('button',{name:'否决',exact:true}).first();if(await nope.count()){await nope.click();const play=page.getByRole('button',{name:'否决这张',exact:true});if(await play.count()){await play.click();nopeUsed=true;covered.add('nope');break;}}}}
    for(const id of ['a','b','c']){if(!(await page.locator('.bt-table').getAttribute('class')).includes('bt-phase-response'))break;await switchSeat(id);const pass=page.getByRole('button',{name:/^(不否决|保持否决)$/});if(await pass.count())await pass.click();}
  }else if(phase==='target'){await page.locator('.bt-seat.targetable').first().click();}
  else if(phase==='request'){await page.locator('.bt-request').getByRole('button',{name:'拆弹',exact:true}).click();}
  else if(phase==='give'){await page.locator('.bt-hand .bt-card').first().click();await page.getByRole('button',{name:'交出这张',exact:true}).click();}
  else if(phase==='future'){await page.screenshot({path:`${folder}/future.png`});await page.getByRole('button',{name:'看好了',exact:true}).click();}
  else if(phase==='bomb'){await page.getByRole('button',{name:'使用拆弹',exact:true}).click();}
  else if(phase==='insert'){await page.getByRole('button',{name:'底部',exact:true}).click();await page.getByRole('button',{name:'放好了',exact:true}).click();}
  else if(phase==='turn'){
    const hand=page.locator('.bt-hand .bt-card');const titles=await hand.evaluateAll(cs=>cs.map(c=>c.getAttribute('aria-label')));
    let acted=false;
    // Prefer previously unseen playable effects, then draw to guarantee progress.
    for(const title of ['预见未来','索取','洗牌','攻击','跳过']){if((!covered.has(title)||(title==='预见未来'&&!covered.has('future')))&&titles.includes(title)){await hand.nth(titles.indexOf(title)).click();const play=page.getByRole('button',{name:'打出这张',exact:true});if(await play.count()){await play.click();covered.add(title);acted=true;break;}}}
    if(!acted){for(const amount of [3,2]){const marker=amount===3?'triple':'pair';if(covered.has(marker))continue;const title=titles.find(t=>titles.filter(x=>x===t).length>=amount);if(title){const same=page.locator('.bt-hand').getByRole('button',{name:title,exact:true});for(let i=0;i<amount;i++)await same.nth(i).click();const combo=page.getByRole('button',{name:amount===3?'指定牌名':'随机拿一张',exact:true});if(await combo.count()){await combo.click();covered.add(marker);acted=true;break;}else await page.getByRole('button',{name:'清空选择',exact:true}).click();}}}
    if(!acted)await page.getByRole('button',{name:/^抽牌，剩余/}).click();
  }
 }
 assert(complete,`Seed ${seed} should finish via visible UI actions`);await page.screenshot({path:`${folder}/finished-${seed}.png`});
}
for(const size of [{width:852,height:393},{width:667,height:375},{width:568,height:320}]){
 await page.setViewportSize(size);await page.goto(`${url}/tests/ui/bombs-harness.html?seed=9`);await page.locator('.bt-table').waitFor();const first=page.locator('.bt-hand .bt-card').first();const box=await first.boundingBox();assert(box.x>=0&&box.y+box.height<=size.height+1,`Complete first card in ${size.width}x${size.height}`);await first.click();assert((await page.locator('.bt-focus').textContent()).includes('选中的手牌'));await page.screenshot({path:`${folder}/layout-${size.width}.png`});await page.locator('.bt-hand').evaluate(el=>el.scrollTo({left:el.scrollWidth}));const last=await page.locator('.bt-hand .bt-card').last().boundingBox();assert(last.x>=0&&last.x+last.width<=size.width+1,`Last hand card is scroll-accessible at ${size.width}`);
}
assert.deepEqual(errors,[]);if(!process.env.LAYOUT_ONLY)for(const phase of ['turn','target','request','response','give','future','bomb','insert'])assert(covered.has(phase),`Missing ${phase}`);console.log(process.env.LAYOUT_ONLY?'PASS new bombs table: 852×393, 667×375, 568×320; complete cards and reachable hand scroll; no runtime errors':'PASS new bombs table: 3 complete UI matches, all phases, 3 viewport layouts, no runtime errors', [...covered].join(', '));
}catch(error){await page.screenshot({path:`${folder}/failure.png`});console.error(await page.locator('body').innerText());throw error;}
finally{await browser.close();}
