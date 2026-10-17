import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/avalon-ballot-receipts-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch();
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
try{for(const locale of ['zh','en']){
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const label=(zh,en)=>locale==='zh'?zh:en;
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async locale=>{
  const {avalon}=await import('/src/core/games/avalon.ts');
  const players=Array.from({length:10},(_,i)=>({id:`ballot-${i}`,name:`Player ${i+1}`,avatar:'🦊'}));
  let game=avalon.create(players,111);game=avalon.apply(game,players[game.leader].id,{action:'propose',values:players.slice(0,3).map(p=>p.id)});
  localStorage.setItem('mocha-profile',JSON.stringify(players[0]));localStorage.setItem('mocha-locale',locale);
  const id=crypto.randomUUID();localStorage.setItem('mocha-practice-v1',JSON.stringify({at:Date.now(),practice:{id,kind:'avalon',players,game,viewer:players[0].id}}));
  const {readPractice}=await import('/src/local/practice.ts');if(readPractice()?.id!==id)throw Error('Ballot fixture checkpoint rejected');
 },locale);
 await page.goto(base);await page.locator('.social-table-v2').waitFor();
 const seats=page.locator('.practice-switch select'),instruction=page.locator('.action-dock .instruction');
 const approval=label('表决已提交','Vote submitted'),mission=label('任务牌已提交','Mission card submitted');
 async function ballot(choice){await page.locator('.council-decision').getByRole('button',{name:choice,exact:true}).click();}
 async function checkReceipt(text,name){
  await expect(instruction).toHaveText(text);await expect(instruction).toHaveAttribute('role','status');
  await expect(page.locator('.council-token')).toHaveCount(0);
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});
   const metrics=await instruction.evaluate(el=>{const box=el.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect();return{top:box.top,bottom:box.bottom,left:box.left,right:box.right,textTop:text.top,textBottom:text.bottom,textLeft:text.left,textRight:text.right};});
   assert(metrics.top>=0&&metrics.bottom<=height+1&&metrics.left>=0&&metrics.right<=width+1,`${name}: receipt reachable ${JSON.stringify(metrics)}`);
   assert(metrics.textLeft>=metrics.left-1&&metrics.textRight<=metrics.right+1&&metrics.textTop>=metrics.top-1&&metrics.textBottom<=metrics.bottom+1,`${name}: receipt not clipped`);
   const identity=page.getByRole('button',{name:label('查看我的身份','View my identity'),exact:true});await expect(identity).toBeVisible();const hit=await identity.boundingBox();assert(hit.width>=44&&hit.height>=44&&hit.y+hit.height<=height+1);
   await page.screenshot({path:`${out}/${name}-${locale}-${width}x${height}.png`});
  }
 }
 await ballot(label('赞成','Approve'));await checkReceipt(approval,'approval');
 await page.reload();await expect(instruction).toHaveText(approval);await expect(page.locator('.council-token')).toHaveCount(0);
 // Switch away and back: only the sender has a receipt, and identities remain concealed.
 await seats.selectOption('ballot-1');await expect(page.locator('.council-token')).toHaveCount(2);await expect(instruction).not.toHaveText(approval);
 await seats.selectOption('ballot-0');await expect(instruction).toHaveText(approval);await expect(page.locator('.identity-curtain')).toHaveCount(0);
 await page.getByRole('button',{name:label('查看我的身份','View my identity'),exact:true}).click();await expect(page.locator('.identity-curtain')).toBeVisible();await page.keyboard.press('Escape');await expect(instruction).toHaveText(approval);
 for(let seat=1;seat<10;seat++){await seats.selectOption(`ballot-${seat}`);await ballot(label('赞成','Approve'));}
 // The next phase has no approval receipt. Non-team members have no mission receipt.
 await expect(instruction).toHaveText(label('等待其他玩家','Waiting for other players'));
 await seats.selectOption('ballot-0');await expect(page.locator('.council-token')).not.toHaveCount(0);await expect(instruction).not.toHaveText(approval);
 await ballot(label('成功','Success'));await checkReceipt(mission,'mission');
 await page.reload();await expect(instruction).toHaveText(mission);await expect(page.locator('.council-token')).toHaveCount(0);
 await seats.selectOption('ballot-9');await expect(instruction).toHaveText(label('等待其他玩家','Waiting for other players'));await expect(page.locator('.council-token')).toHaveCount(0);
 for(const seat of [1,2]){await seats.selectOption(`ballot-${seat}`);await ballot(label('成功','Success'));}
 await seats.selectOption('ballot-0');await expect(instruction).not.toHaveText(mission);await expect(page.locator('.quest.success')).toHaveCount(1);
 await page.reload();await expect(instruction).not.toHaveText(mission);await expect(page.locator('.identity-curtain')).toHaveCount(0);
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${engine}/${locale}: actual App 10-player ballots, refresh/seat/phase receipt lifetime, hidden identities, eight sizes and rotation`);
}}finally{await browser.close();}
