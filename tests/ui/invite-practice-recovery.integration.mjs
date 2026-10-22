import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5250';
const engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=process.env.RECOVERY_SHOTS||`test-results/invite-practice-recovery-${engine}`;
const sizes=engine==='webkit'?[[320,568]]:[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[667,375]];
const labels={
 zh:{dialog:'加入朋友的牌桌',close:'关闭',join:'入桌',cancel:'取消',solo:'单人人机',pass:'同屏试玩',menu:'牌桌菜单',endSolo:'结束单机',endPass:'结束试玩',ready:'准备好了'},
 en:{dialog:'Join a friend’s table',close:'Close',join:'Join',cancel:'Cancel',solo:'Solo vs bots',pass:'Pass & play',menu:'Table menu',endSolo:'End solo game',endPass:'End practice',ready:'Ready'},
};
const raw=page=>page.evaluate(()=>localStorage.getItem('mocha-practice-v1'));
const checkpoint=async page=>JSON.parse(await raw(page)||'null')?.practice;
const contexts=[];
async function context(locale,viewport={width:320,height:568}){
 const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true});contexts.push(ctx);
 const page=await ctx.newPage();page.__errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>page.__errors.push(error.message));page.on('dialog',dialog=>dialog.accept());return page;
}
async function seed(page,locale,{kind='gems',difficulty='normal',suffix='checkpoint',clear=true}={}){
 await page.goto(base+'/manifest-mocha.webmanifest');
 return page.evaluate(async({locale,kind,difficulty,suffix,clear})=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');
  if(clear)localStorage.clear();
  const profile={id:`invite-recovery-${locale}-${suffix}`,name:`Recovery ${suffix}`,avatar:'🦊'};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
  const practice=createPractice(kind,kind==='drawguess'?2:kind==='gems'?2:3,profile,{language:locale},difficulty,314);writePractice(practice);
  if(readPractice()?.id!==practice.id)throw Error('Invalid seeded checkpoint');
  return {profile,id:practice.id,raw:localStorage.getItem('mocha-practice-v1')};
 },{locale,kind,difficulty,suffix,clear});
}
async function host(name){
 const ctx=await browser.newContext();contexts.push(ctx);const page=await ctx.newPage();await page.goto(base+'/manifest-mocha.webmanifest');
 const profile={id:`invite-host-${name}-${crypto.randomUUID()}`,name:`Host ${name}`,avatar:'🐼'};
 await page.evaluate(async profile=>{const{RoomClient}=await import('/src/net/client.ts');window.client=new RoomClient();window.profile=profile;await client.create(profile,'gems','cloud',{language:'en'});},profile);
 await page.waitForFunction(()=>!!client.state.room?.code);
 const room=await page.evaluate(()=>({code:client.state.room.code,invite:new URLSearchParams(new URL(client.state.inviteURL).hash.slice(1)).get('invite')}));
 return {ctx,page,profile,room};
}
async function closeHost(value){if(value?.page&&!value.page.isClosed())await value.page.evaluate(()=>client.leave()).catch(()=>{});}
async function invite(page,code,{token,keep=true,other=true}={}){
 const query=`?${keep?'keep=a%20b&':''}room=${code}&z=1+2`;const hash=token?`#invite=${token}${other?'&anchor':''}`:other?'#anchor':'';
 await page.goto(base+query+hash);await page.getByRole('dialog').waitFor();
}
async function expectCleanURL(page){const url=await page.evaluate(()=>location.href);const parsed=new URL(url);assert.equal(parsed.searchParams.has('room'),false);assert.equal(parsed.search,'?keep=a%20b&z=1+2');assert.equal(new URLSearchParams(parsed.hash.slice(1)).has('invite'),false);assert.equal(parsed.hash,'#anchor');}
async function restored(page,id){await page.waitForFunction(id=>JSON.parse(localStorage.getItem('mocha-practice-v1')||'null')?.practice?.id===id,id);await page.locator('.game-surface').waitFor();}
async function fitDialog(page,width,height){const box=await page.getByRole('dialog').boundingBox();assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function endPractice(page,locale,pass=false){await page.getByRole('button',{name:labels[locale].menu,exact:true}).click();await page.getByRole('button',{name:pass?labels[locale].endPass:labels[locale].endSolo,exact:true}).click();await page.locator('.game-surface').waitFor({state:'detached'});assert.equal(await raw(page),null);}

await fs.mkdir(out,{recursive:true});
try{
 // A valid checkpoint remains byte-for-byte dormant while a room link is only being considered.
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const page=await context(locale,{width,height}),saved=await seed(page,locale,{suffix:`${locale}-${width}`});
  await invite(page,'ZZZZZ2',{token:'local-audit'});await fitDialog(page,width,height);assert.equal(await raw(page),saved.raw);await page.getByRole('dialog').getByRole('button',{name:labels[locale].close,exact:true}).click();await restored(page,saved.id);assert.equal((await checkpoint(page)).id,saved.id);await expectCleanURL(page);await page.screenshot({path:`${out}/${locale}-${width}x${height}-restored.png`});
 }

 // Pending approval is not acceptance: cancel restores practice and clears the unconfirmed recovery hint.
 {
  const h=await host('pending'),g=await context('zh'),saved=await seed(g,'zh',{suffix:'pending'});
  try{
   await invite(g,h.room.code,{other:true});const beforePending=await raw(g);await g.getByRole('dialog').getByRole('button',{name:labels.zh.join,exact:true}).click();await h.page.waitForFunction(id=>client.state.room.pending.some(p=>p.id===id),saved.profile.id);await expect(g.getByText('等待房主同意',{exact:true})).toBeVisible();assert.equal(await raw(g),beforePending);await g.locator('.connecting-overlay').getByRole('button',{name:labels.zh.cancel,exact:true}).click();await restored(g,saved.id);await expectCleanURL(g);assert.equal(await g.evaluate(()=>sessionStorage.getItem('mocha-room-session')),null);
  }finally{await closeHost(h);}
 }

 // Rejection and authoritative 404 both fall back to the untouched checkpoint.
 {
  const h=await host('reject'),g=await context('zh'),saved=await seed(g,'zh',{suffix:'reject'});
  try{
   await invite(g,h.room.code,{other:true});await g.getByRole('dialog').getByRole('button',{name:labels.zh.join,exact:true}).click();await h.page.waitForFunction(id=>client.state.room.pending.some(p=>p.id===id),saved.profile.id);await h.page.evaluate(id=>client.approve(id,false),saved.profile.id);await g.locator('.toast').waitFor();await restored(g,saved.id);await expectCleanURL(g);
  }finally{await closeHost(h);}
 }
 {
  const g=await context('en'),saved=await seed(g,'en',{suffix:'notfound'});await invite(g,'ZZZZZ2',{other:true});assert.equal(await raw(g),saved.raw);await g.getByRole('dialog').getByRole('button',{name:labels.en.join,exact:true}).click();await g.locator('.toast').waitFor();await restored(g,saved.id);await expectCleanURL(g);
 }

 // Confirmed snapshots clear a matching checkpoint; reload and saved-session-plus-practice both resume room-first.
 {
  const h=await host('accepted'),g=await context('en'),saved=await seed(g,'en',{suffix:'accepted'});
  try{
   await invite(g,h.room.code,{token:h.room.invite,other:true});assert.equal(await raw(g),saved.raw);await g.evaluate(()=>{const remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='mocha-practice-v1')throw new DOMException('denied','SecurityError');return remove.call(this,key);};});await g.getByRole('dialog').getByRole('button',{name:labels.en.join,exact:true}).click();await g.getByRole('button',{name:labels.en.ready,exact:true}).waitFor();assert.notEqual(await raw(g),null);assert.deepEqual(g.__errors,[]);assert.match(await g.evaluate(()=>location.href),/[?&]room=/);
   await g.reload();await g.getByRole('button',{name:labels.en.ready,exact:true}).waitFor();assert.equal(await raw(g),null);assert.deepEqual(g.__errors,[]);
   await seed(g,'en',{suffix:'both',clear:false});const combined=await raw(g);assert.match(combined,/Recovery both/);await g.goto(base);await g.getByRole('button',{name:labels.en.ready,exact:true}).waitFor();assert.equal(await raw(g),null);assert.equal(await g.locator('.game-surface').count(),0);
  }finally{await closeHost(h);}
 }

 // Stale invite metadata is removed even when no practice checkpoint exists.
 {
  const page=await context('en');await seed(page,'en',{suffix:'none'});await page.evaluate(()=>localStorage.removeItem('mocha-practice-v1'));await invite(page,'ZZZZZ2',{other:true});await page.getByRole('dialog').getByRole('button',{name:labels.en.close,exact:true}).click();await page.locator('.game-library').waitFor();await expectCleanURL(page);assert.equal(await raw(page),null);
 }

 // Explicit exits and ordinary start/new-game paths remain destructive only when the user asks.
 for(const [locale,pass] of [['zh',false],['en',true]]){
  const page=await context(locale);await seed(page,locale,{suffix:`start-${locale}`});await page.evaluate(()=>localStorage.removeItem('mocha-practice-v1'));await page.goto(base);await page.locator('.cover-gems').click();await page.getByRole('button',{name:pass?labels[locale].pass:labels[locale].solo,exact:true}).click();await page.locator('.game-surface').waitFor();const first=(await checkpoint(page)).id;assert(first);await endPractice(page,locale,pass);await page.locator('.cover-gems').click();await page.getByRole('button',{name:pass?labels[locale].pass:labels[locale].solo,exact:true}).click();await page.locator('.game-surface').waitFor();assert.notEqual((await checkpoint(page)).id,first);await endPractice(page,locale,pass);
 }

 // Dormant bot and timed practice cannot advance behind an invite; restoration resumes exactly once.
 {
  const page=await context('zh');
  await page.goto(base+'/manifest-mocha.webmanifest');
  const saved=await page.evaluate(async()=>{
   const pmod=await import('/src/local/practice.ts'),b=await import('/src/core/bots/index.ts');
   const profile={id:'lifecycle-bot',name:'Lifecycle',avatar:'🦊'};localStorage.clear();localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale','zh');
   let p=pmod.createPractice('gems',2,profile,{language:'zh'},'easy',91);
   for(let i=0;i<12&&!pmod.hasPracticeBotTurn(p);i++){const cmd=b.chooseBotCommand(pmod.practiceView(p),p.players[0].id,'easy',p.revision||1);if(!cmd)break;p=pmod.applyPractice(p,cmd);}
   if(!pmod.hasPracticeBotTurn(p))throw Error('No bot turn fixture');pmod.writePractice(p);return{id:p.id,revision:p.revision,raw:localStorage.getItem('mocha-practice-v1')};
  });
  await invite(page,'ZZZZZ2',{token:'lifecycle'});await page.waitForTimeout(1800);assert.equal(await raw(page),saved.raw);await page.getByRole('dialog').getByRole('button',{name:labels.zh.close,exact:true}).click();await restored(page,saved.id);await page.waitForFunction(({id,revision})=>{const p=JSON.parse(localStorage.getItem('mocha-practice-v1')||'null')?.practice;return p?.id===id&&p.revision>revision;},{id:saved.id,revision:saved.revision});
 }
 {
  const page=await context('en');
  await page.goto(base+'/manifest-mocha.webmanifest');
  const saved=await page.evaluate(async()=>{const pmod=await import('/src/local/practice.ts');const profile={id:'lifecycle-time',name:'Timer',avatar:'🦊'};localStorage.clear();localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale','en');let p=pmod.advancePracticeClock(pmod.createPractice('drawguess',3,profile,{language:'en'},undefined,17),Date.now());const action=pmod.practiceView(p).actions[0];p=pmod.applyPractice(p,{action:action.id,values:[action.choices[0].id]});p.game.deadlineAt=Date.now()+350;pmod.writePractice(p);return{id:p.id,revision:p.revision,raw:localStorage.getItem('mocha-practice-v1')};});
  await invite(page,'ZZZZZ2',{token:'timer'});await page.waitForTimeout(900);assert.equal(await raw(page),saved.raw);await page.getByRole('dialog').getByRole('button',{name:labels.en.close,exact:true}).click();await restored(page,saved.id);await page.waitForFunction(({id,revision})=>{const p=JSON.parse(localStorage.getItem('mocha-practice-v1')||'null')?.practice;return p?.id===id&&p.revision>revision;},{id:saved.id,revision:saved.revision}, {timeout:12000});
 }
 console.log(`PASS ${engine}: invite preservation across ${sizes.length} sizes x 2 languages, pending/cancel/reject/notfound/accepted, room-first reload, explicit exits, bot and timer dormancy`);
}finally{
 await Promise.all(contexts.map(ctx=>ctx.close().catch(()=>{})));
 await browser.close();
}
