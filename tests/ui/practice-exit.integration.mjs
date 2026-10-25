import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER||'chromium';
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});
const out=process.env.TEST_OUTPUT||`test-results/practice-exit-${engine}`;
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const labels={zh:{menu:'牌桌菜单',end:'结束试玩',solo:'结束单机',title:'结束这局同屏试玩？',cancel:'取消',confirm:'结束当前游戏'},en:{menu:'Table menu',end:'End practice',solo:'End solo game',title:'End this pass-and-play game?',cancel:'Cancel',confirm:'End current game'}};
async function seed(page,locale,kind='gems',solo=false){
 await page.goto(base+'/manifest-mocha.webmanifest');
 const saved=await page.evaluate(async({locale,kind,solo})=>{
  const mod=await import('/src/local/practice.ts');
  const profile={id:'exit-human',name:'Exit test',avatar:'🦊'};
  localStorage.clear();sessionStorage.clear();localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
  let p=mod.createPractice(kind,kind==='gems'?2:3,profile,kind==='drawrelay'?{language:locale,relayMode:'rounds',relaySeconds:60}:{language:locale},solo?'easy':undefined,17);
  if(solo){const bots=await import('/src/core/bots/index.ts');for(let i=0;i<12&&!mod.hasPracticeBotTurn(p);i++){const cmd=bots.chooseBotCommand(mod.practiceView(p),p.players[0].id,'easy',p.revision);if(!cmd)break;p=mod.applyPractice(p,cmd);}if(!mod.hasPracticeBotTurn(p))throw Error('Missing pending bot fixture');}
  if(kind!=='gems')p=mod.advancePracticeClock(p,Date.now());
  mod.writePractice(p);return p;
 },{locale,kind,solo});
 await page.goto(base);await page.locator('.game-surface').waitFor();
 assert.equal((await stored(page)).id,saved.id,`Rejected ${kind} fixture`);return saved;
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')||'null')?.practice||null);
async function open(page,locale,solo=false){await page.getByRole('button',{name:labels[locale].menu,exact:true}).click();await page.getByRole('button',{name:solo?labels[locale].solo:labels[locale].end,exact:true}).click();await expect(page.locator('.practice-exit-modal')).toBeVisible();}
async function fit(page,width,height){const box=await page.locator('.practice-exit-modal').boundingBox();assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await fs.mkdir(out,{recursive:true});
try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',()=>{throw Error('Practice exit must not use a native dialog');});
  const saved=await seed(page,locale);await open(page,locale);const modal=page.locator('.practice-exit-modal');
  await expect(modal).toHaveAttribute('aria-label',labels[locale].title);await fit(page,width,height);
  assert(await modal.evaluate(node=>node.contains(document.activeElement)));
  for(let i=0;i<7;i++){await page.keyboard.press('Tab');assert(await modal.evaluate(node=>node.contains(document.activeElement)));}
  await page.keyboard.press('Shift+Tab');assert(await modal.evaluate(node=>node.contains(document.activeElement)));
  await page.screenshot({path:`${out}/${locale}-${width}x${height}.png`});
  await page.setViewportSize({width:height,height:width});await fit(page,height,width);
  await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(page.getByRole('button',{name:labels[locale].end,exact:true})).toBeFocused();
  assert.deepEqual(await stored(page),saved,'Escape preserves the full game/options/seat');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:locale==='zh'?'Switch to English':'切换为中文',exact:true}).click();
  const other=locale==='zh'?'en':'zh';await open(page,other);await expect(modal).toHaveAttribute('aria-label',labels[other].title);assert.deepEqual(await stored(page),saved,'Changing UI language does not redeal the game');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.getByRole('button',{name:other==='zh'?'Switch to English':'切换为中文',exact:true}).click();await open(page,locale);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:labels[locale].end,exact:true}).click();await modal.getByRole('button',{name:labels[locale].cancel,exact:true}).click();assert.deepEqual(await stored(page),saved);
  await page.getByRole('button',{name:labels[locale].end,exact:true}).click();await modal.getByRole('button',{name:labels[locale].confirm,exact:true}).click();await expect(page.locator('.game-surface')).toHaveCount(0);assert.equal(await stored(page),null);
  await page.reload();await expect(page.locator('.game-library')).toBeVisible();assert.equal(await stored(page),null);assert.deepEqual(errors,[]);await context.close();
 }
 // Hold an already scheduled bot turn beyond its delay, then cancel and resume it.
 {
  const context=await browser.newContext(),page=await context.newPage();await page.clock.install();await page.clock.pauseAt(new Date());
  const saved=await seed(page,'en','gems',true);await open(page,'en',true);await page.clock.runFor(5000);assert.deepEqual(await stored(page),saved);
  await page.locator('.practice-exit-modal').getByRole('button',{name:'Cancel',exact:true}).click();await page.clock.runFor(5000);assert((await stored(page)).revision>saved.revision);
  await page.keyboard.press('Escape');await open(page,'en',true);await page.getByRole('button',{name:'End current game',exact:true}).click();await page.clock.runFor(5000);assert.equal(await stored(page),null);await context.close();
 }
 for(const kind of ['drawguess','drawrelay']){
  const context=await browser.newContext(),page=await context.newPage();await page.clock.install();await page.clock.pauseAt(new Date());
  const initial=await seed(page,'en',kind);const deadline=initial.game.deadlineAt;await open(page,'en');const paused=await stored(page);
  assert.equal(paused.game.deadlineAt,0);assert(paused.game.pausedRemaining>0);await page.clock.runFor(120000);assert.deepEqual(await stored(page),paused);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();const resumed=await stored(page);assert.equal(resumed.id,initial.id);assert.equal(resumed.game.deadlineAt,deadline+120000);assert.equal(resumed.game.pausedRemaining,undefined);
  await page.keyboard.press('Escape');await page.clock.runFor(paused.game.pausedRemaining+20);assert((await stored(page)).revision>resumed.revision,'clock resumes after cancel');
  await open(page,'en');await page.reload();await page.locator('.game-surface').waitFor();assert.equal((await stored(page)).game.pausedRemaining,undefined,'reload cannot strand a paused checkpoint');
  await context.close();
 }
 console.log(`PASS ${engine}: practice exit, seven sizes x two languages, focus/Escape/rotation/language, cancellation/storage, bot and drawing clocks`);
}finally{await browser.close();}
