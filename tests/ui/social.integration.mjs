import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// UI-only integration: no game-state injection, direct engine calls, or private React access.
// Run against an already running Vite server: node tests/ui/social.integration.mjs
const origin=process.env.UI_BASE_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
const output=new URL('./artifacts/',import.meta.url);await fs.mkdir(output,{recursive:true});
const results=[];
try{
for(const viewport of [{width:667,height:375},{width:844,height:390}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',d=>d.accept());
  await page.goto(origin);await page.getByPlaceholder('你的昵称').fill('小满');await page.getByRole('button',{name:'入座',exact:true}).click();
  const select=page.getByRole('combobox',{name:'切换试玩座位'});
  const viewer=async i=>{await select.selectOption(`practice-${i}`);await page.waitForTimeout(25);};
  const seats=()=>page.locator('.seat');
  const dock=label=>page.locator('.dock-actions').getByRole('button',{name:label,exact:true});
  async function submit(label,options=[]){
    await dock(label).click();
    if(await page.locator('.action-sheet').isVisible()){
      for(const option of options)await page.locator('.action-sheet .choices').getByRole('button',{name:option,exact:true}).click();
      await page.locator('.action-sheet').getByRole('button',{name:'确认',exact:true}).click();
      await page.locator('.action-sheet').waitFor({state:'hidden'});
    }
  }
  async function start(name){await page.getByRole('button',{name:`选择${name}`,exact:true}).click();if(name==='狼人杀')await page.locator('.wolf-mode-picker button').filter({hasText:'玩家操作'}).click();await page.getByRole('button',{name:'同屏试玩',exact:true}).click();await select.waitFor();}
  async function stop(){await page.getByRole('button',{name:'牌桌菜单'}).click();await page.getByRole('button',{name:'结束试玩',exact:true}).click();await select.waitFor({state:'hidden'});}
  async function inspectIdentity(){
    const count=await page.getByRole('button',{name:'查看我的身份',exact:true}).count();if(count!==1){await page.screenshot({path:new URL(`${viewport.width}-identity-regression-failure.png`,output).pathname});console.log('Identity failure DOM:',await page.locator('body').innerText());}assert.equal(count,1,'Identity starts concealed after changing viewpoint');
    await page.getByRole('button',{name:'查看我的身份',exact:true}).click();
    const role=await page.locator('.identity-story h2').textContent();assert(role&&!role.includes('我的身份'));
    await page.getByRole('button',{name:'收起身份',exact:true}).click();return role;
  }
  async function layout(label){
    const problems=await page.locator('.identity-card,.action-dock,.practice-switch,.seat,.quest-track,.night-counter').evaluateAll(nodes=>nodes.flatMap(el=>{
      const r=el.getBoundingClientRect();const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return[];
      return r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5?[{class:el.className,text:el.textContent.slice(0,40),box:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight}}]:[];
    }));
    await page.screenshot({path:new URL(`${viewport.width}-${label}.png`,output).pathname});
    results.push({viewport,label,clipping:problems});assert.deepEqual(problems,[],`Clipped social controls: ${label} ${viewport.width}`);
  }
  // Avalon: three full quests with public yes/no votes, private mission submission,
  // assassination and replay identity privacy.
  await start('阿瓦隆');
  const avalonRoles=[];for(let i=0;i<5;i++){await viewer(i);avalonRoles.push(await inspectIdentity());}
  for(let quest=0;quest<3;quest++){
    const options=await select.locator('option').allTextContents();const leader=options.findIndex(t=>t.includes('待操作'));assert(leader>=0);await viewer(leader);
    const size=[2,3,2][quest];const names=await seats().locator('b').allTextContents();
    // Tap the first player directly; the ActionSheet retains that selected seat.
    await seats().nth(0).click();for(let i=1;i<size;i++)await page.locator('.action-sheet .choices').getByRole('button',{name:names[i],exact:true}).click();
    await page.locator('.action-sheet').getByRole('button',{name:'确认',exact:true}).click();
    for(let i=0;i<5;i++){await viewer(i);await submit('队伍表决',[i<3?'赞成':'反对']);if(quest===0&&i<4)assert.equal(await page.locator('.vote-mark').count(),0,'Pending approval ballots remain secret');}
    assert.deepEqual(await page.locator('.vote-mark').allTextContents(),['✓','✓','✓','✕','✕']);
    await layout(`avalon-quest-${quest+1}`);
    for(let i=0;i<size;i++){await viewer(i);await submit('秘密任务',['成功']);}
    assert.equal(await page.locator('.quest.success').count(),quest+1);
  }
  const assassin=avalonRoles.indexOf('刺客'),merlin=avalonRoles.indexOf('梅林');await viewer(assassin);
  const merlinName=await seats().nth(merlin).locator('b').textContent();await submit('刺杀梅林',[merlinName]);await page.locator('.end-banner').waitFor();
  assert.match(await page.locator('.end-banner').textContent(),/邪恶获胜/);
  // Force the same seat across replay so changing viewer alone cannot hide a leak.
  await viewer(0);await page.getByRole('button',{name:'查看我的身份',exact:true}).click();await page.getByRole('button',{name:'再来一局',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'查看我的身份',exact:true}).count(),1,'Replay must conceal freshly dealt identity');
  await stop();

  // Werewolf: all night phases, contested sheriff election, weighted exile vote,
  // second night, and public wolf explosion after switching viewpoint.
  await start('狼人杀');const wolfRoles=[];for(let i=0;i<9;i++){await viewer(i);wolfRoles.push(await inspectIdentity());}
  const wolves=wolfRoles.map((r,i)=>r==='狼人'?i:-1).filter(i=>i>=0);
  async function night(){
    for(let i=0;i<9;i++){
      await viewer(i);if(await seats().nth(i).getAttribute('class').then(s=>s.includes('out')))continue;
      const label=(await page.locator('.dock-actions button').first().textContent()).trim();await submit(label,['狼人袭击','查验身份','守护'].includes(label)?['放弃']:[]);
    }
    for(let i=0;i<9;i++){
      await viewer(i);if(await seats().nth(i).getAttribute('class').then(s=>s.includes('out')))continue;
      const label=(await page.locator('.dock-actions button').first().textContent()).trim();await submit(label,label==='女巫用药'?['不用药']:[]);
    }
  }
  await layout('werewolf-night');await night();
  for(let i=0;i<9;i++){await viewer(i);await submit('警长竞选',[i<2?'上警':'不上警']);}
  for(let i=0;i<9;i++){await viewer(i);await submit('发言结束');}
  const sheriffName=await seats().nth(0).locator('b').textContent();for(let i=2;i<9;i++){await viewer(i);await submit('选警长',[sheriffName]);}
  assert.match(await page.locator('.night-counter').textContent(),/第 1 天/);await layout('werewolf-day');
  for(let i=0;i<9;i++){await viewer(i);await submit('发言结束');}
  const wolfName=await seats().nth(wolves[0]).locator('b').textContent();for(let i=0;i<9;i++){await viewer(i);await submit('放逐',[wolfName]);}
  // If the randomly assigned first wolf was sheriff, resolve their public badge action.
  if(wolves[0]===0){await viewer(0);await submit('移交警徽',['放弃']);}
  assert.match(await page.locator('.night-counter').textContent(),/第 2 夜/);await night();
  await viewer(wolves[1]);await submit('自爆');const other=wolfRoles.findIndex(r=>r!=='狼人');await viewer(other);
  assert.equal(await seats().nth(wolves[1]).locator('small').textContent(),'狼人','Publicly exploded wolf role is visible');
  if(wolves[1]===0){await viewer(0);await submit('移交警徽',['放弃']);}
  await layout('werewolf-explosion');
  assert.deepEqual(errors,[],'No browser runtime errors');await context.close();
  console.log(`PASS social UI flows ${viewport.width}x${viewport.height}`);
}
await fs.writeFile(new URL('social-report.json',output),JSON.stringify(results,null,2));
}finally{await browser.close();}
// The standalone Playwright import may retain process handles on macOS even after
// Chrome has exited. All contexts, reports, assertions, and browser.close finished.
console.log('PASS social integration complete');
process.exit(0);
