import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:5174';
const artifacts='test-results/new-games';await fs.mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{localStorage.setItem('mocha-profile',JSON.stringify({id:'ui-new-games-test',name:'游戏验收',avatar:'🦊'}));localStorage.removeItem('mocha-practice-v1');});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(7000);
async function begin(name,mode){await page.goto(baseURL);await page.getByRole('button',{name:`选择${name}`,exact:true}).click();if(mode)await page.getByRole('combobox',{name:'比赛长度'}).selectOption(mode);await page.getByRole('button',{name:'同屏试玩',exact:true}).click();await page.locator('.ng-table').waitFor();assert.equal(await page.locator('.action-dock').count(),0);}
async function active(){const select=page.getByRole('combobox',{name:'切换试玩座位'}),options=await select.locator('option').evaluateAll(xs=>xs.map(x=>({id:x.value,label:x.textContent})));const option=options.find(x=>x.label.includes('待操作'));assert(option,'unfinished match must expose an actionable seat');await select.selectOption(option.id);}
async function confirm(){if(!await page.locator('.action-sheet').count())return;await page.locator('.action-sheet footer').getByRole('button',{name:'确认',exact:true}).click();}
async function firstChoice(){await page.locator('.action-sheet .choice').first().click();await confirm();}
async function noError(){assert.equal(await page.locator('.toast').count(),0,await page.locator('.toast').allTextContents());}
async function capture(name){await page.screenshot({path:`${artifacts}/${name}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'no document overflow');}
try{
 if(process.env.ONLY_GAME!=='century'){
 await begin('寿司小宴');let turns=0;while(!await page.locator('.end-banner').count()&&turns++<80){await page.getByRole('combobox',{name:'切换试玩座位'}).selectOption('practice-'+((turns-1)%2));await page.locator('.ng-hand .ng-sushi-card:not([disabled])').first().click();await page.getByRole('button',{name:/^确认 1 张/}).click();await noError();if(turns===1)assert.match(await page.locator('.ng-heading strong').textContent(),/仍在选牌/,'Waiting identifies the remaining chooser');}assert(await page.locator('.end-banner').count(),'Sushi must finish');assert.equal(await page.locator('.sushi-results tbody tr').count(),2,'Both final scores and round breakdowns are shown');assert.equal(await page.locator('.ng-sushi-hand-panel').count(),0,'No empty hand panel after scoring');await capture('sushi-finished');await page.getByRole('button',{name:'收起结算',exact:true}).click();await page.getByRole('button',{name:'得分明细',exact:true}).click();assert.equal(await page.locator('.sushi-results tbody tr').count(),2,'Final details can be reopened');console.log('PASS real App Sushi Go: complete three rounds via '+turns+' user selections');
 await begin('七彩接龙','single');turns=0;const seen=new Set();
 while(!await page.locator('.end-banner').count()&&turns++<700){
  await active();
  const controls=[['选择起始颜色','initial-color'],['看完了，继续','challenge-review'],['质疑 +4','challenge'],['不喊，继续','omit-call'],['指出漏喊：罚抽 2 张','catch'],['喊：剩一张！','call'],['不指出，继续','pass-call'],['接受 +4，抽牌并跳过','accept4']];let handled=false;
  for(const [name,event]of controls){if(event==='omit-call'&&seen.has('catch'))continue;const button=page.getByRole('button',{name,exact:true});if(await button.count()){
    if(event==='challenge-review'){assert.equal(await page.locator('.ng-challenge').count(),1);const seat=page.getByRole('combobox',{name:'切换试玩座位'}),current=await seat.inputValue(),other=await seat.locator('option').evaluateAll((xs,current)=>xs.map(x=>x.value).find(x=>x!==current),current);await seat.selectOption(other);assert.equal(await page.locator('.ng-challenge').count(),0,'private challenge evidence must disappear when switching seats');await seat.selectOption(current);await capture('uno-private-challenge');}
    seen.add(event);await button.click();if(event==='initial-color')await firstChoice();handled=true;break;
  }}
  if(!handled){const cards=page.locator('.ng-hand .ng-uno-card:not([disabled])');if(await cards.count()){const wild4=cards.filter({hasText:'+4'}),card=await wild4.count()?wild4.first():cards.first(),title=await card.getAttribute('aria-label');seen.add(title.includes('变色')?'wild':'play');await card.click();if(title.includes('变色'))await page.locator('.ng-uno-colors button').first().click();await page.getByRole('button',{name:'出牌',exact:true}).click();}else{const draw=page.getByRole('button',{name:'抽一张',exact:true});if(await draw.count()){seen.add('draw');await draw.click();}else{seen.add('pass');await page.getByRole('button',{name:'保留抽到的牌，结束回合',exact:true}).click();}}}
  await noError();
 }
 assert(await page.locator('.end-banner').count(),'Color Dash single round must finish');assert(seen.has('call'),'manual last-card call must be exercised');assert(seen.has('catch'),'catching a missed call must be exercised');await capture('uno-finished');console.log('PASS real App Color Dash: complete round via '+turns+' actions; '+[...seen].join(','));
 await begin('七彩接龙','match');turns=0;
 while(!await page.locator('.ng-round-result').count()&&turns++<800){await active();let handled=false;for(const name of ['选择起始颜色','喊：剩一张！','接受 +4，抽牌并跳过','看完了，继续','抽一张','保留抽到的牌，结束回合']){const button=page.getByRole('button',{name,exact:true});if(await button.count()&&(name!=='抽一张'||!await page.locator('.ng-hand .ng-uno-card:not([disabled])').count())){await button.click();if(name==='选择起始颜色')await firstChoice();handled=true;break;}}
  if(!handled){const card=page.locator('.ng-hand .ng-uno-card:not([disabled])').first(),title=await card.getAttribute('aria-label');await card.click();if(title.includes('变色'))await page.locator('.ng-uno-colors button').first().click();await page.getByRole('button',{name:'出牌',exact:true}).click();}await noError();
 }
 assert(await page.locator('.ng-round-result').count(),'500-point mode must reach round results');assert.equal(await page.locator('.end-banner').count(),0,'a low-scoring first round must not end the 500-point match');const scores=await page.locator('.ng-player>strong').allTextContents();await active();await page.getByRole('button',{name:'开始下一轮',exact:true}).click();await page.locator('.ng-edition').filter({hasText:'第 2 轮'}).waitFor();assert.deepEqual(await page.locator('.ng-player>strong').allTextContents(),scores,'scores must carry into the next round');assert.equal(await page.locator('.ng-round-result').count(),0);await capture('uno-match-next-round');console.log('PASS real App Color Dash: cumulative scores retained into round two');
 }
 await begin('香料商旅');
 const panel=(title)=>page.locator('.ng-panel').filter({has:page.locator('h3').filter({hasText:title})}).first();
 const endTurn=async()=>{await active();const rest=page.getByRole('button',{name:'休整，收回所有商人',exact:true});if(await rest.count())await rest.click();};
 // Acquire the second visible merchant: payment is made through the real choice sheet.
 await panel('商人市场').locator('.ng-spice-card').nth(1).click();await confirm();await page.getByRole('button',{name:/^支付给第 1/}).click();await firstChoice();await noError();await endTurn();await active();
 // Upgrade the same cube twice, then refresh the engine cards by resting.
 await panel('你的商队').getByRole('button',{name:/升级 2 次/}).click();await confirm();await page.getByRole('button',{name:'再升级 2 次',exact:true}).click();await page.locator('.action-sheet .choice').filter({hasText:/^1 姜黄 →/}).click();await confirm();await page.getByRole('button',{name:'再升级 1 次',exact:true}).click();await page.locator('.action-sheet .choice').filter({hasText:/^1 藏红花 →/}).click();await confirm();await noError();await endTurn();await active();
 let returned=false,claimed=false,traded=false;const coverage=new Set(['acquire','payment','upgrade']);
 // Pick actions exclusively from visible cards and resource labels. No engine or stored game access.
 const counts=async()=>page.locator('.ng-pocket .ng-cubes b').evaluateAll(xs=>xs.map(x=>Number(x.textContent)));
 const parse=(text)=>{const names=['姜黄','藏红花','豆蔻','肉桂'];return names.map(name=>Number(text.match(new RegExp(name+'\\s*(\\d+)'))?.[1]||0));};
 for(let step=0;step<320&&!(returned&&claimed&&traded);step++){
   await active();
   const discard=page.getByRole('button',{name:/^归还 \d+ 枚香料/});
   if(await discard.count()){await discard.click();const n=Number((await page.locator('.action-sheet footer small').textContent()).split('/').at(-1));for(let i=0;i<n;i++)await page.locator('.action-sheet .choice').nth(i).click();await confirm();returned=true;coverage.add('discard');continue;}
   const upgrade=page.getByRole('button',{name:/^再升级 \d+ 次/}),endUpgrade=page.getByRole('button',{name:'结束升级',exact:true});
   // With no upgradable cubes the phase exposes only its finish action.
   if(await endUpgrade.count()&&!await upgrade.count()){await endUpgrade.click();coverage.add('empty-upgrade');continue;}
   if(await upgrade.count()){
     const cubes=await counts(),goals=await panel('公开订单').locator('.ng-goal>.ng-order-cost>span').evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label')));const target=goals.map(parse).sort((a,b)=>a.reduce((n,v,i)=>n+Math.max(0,v-cubes[i])*(i+1),0)-b.reduce((n,v,i)=>n+Math.max(0,v-cubes[i])*(i+1),0))[0];
     const index=cubes.findIndex((v,i)=>i<3&&v>target[i]&&target.some((t,j)=>j>i&&t>cubes[j]));
     if(index<0)await page.getByRole('button',{name:'结束升级',exact:true}).click();else{await upgrade.click();await page.locator('.action-sheet .choice').filter({hasText:new RegExp('^1 '+['姜黄','藏红花','豆蔻'][index]+' →')}).click();await confirm();}continue;
   }
   const doneTrade=page.getByRole('button',{name:'结束交易',exact:true});if(await doneTrade.count()){traded=true;coverage.add('trade');await doneTrade.click();continue;}
   const pay=page.getByRole('button',{name:/^支付给第/});if(await pay.count()){await pay.click();await firstChoice();continue;}
   const goals=panel('公开订单').locator('.ng-goal.ng-claimable');if(await goals.count()){await page.locator('.ng-century-tabs').getByRole('button',{name:'公开订单',exact:true}).click();await goals.first().click();await page.getByRole('dialog',{name:'订单详情'}).getByRole('button',{name:'完成订单',exact:true}).click();claimed=true;coverage.add('claim');continue;}
   const hand=panel('你的商队').locator('.ng-spice-card:not([disabled])'),texts=await hand.evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label'))),cubes=await counts();
   const tradeIndex=texts.findIndex(t=>t.includes('→'));if(!traded&&tradeIndex>=0){await hand.nth(tradeIndex).click();await confirm();continue;}
   // Recruit an affordable exchange if none is available yet.
   const market=panel('商人市场').locator('.ng-spice-card:not([disabled])'),marketText=await market.locator('b>span').evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label')));let mi=marketText.findIndex(t=>{if(!t.includes('→'))return false;const cost=parse(t.split('→')[0]);return cost.every((v,i)=>v<=cubes[i]);});
   if(!traded&&mi>=0){await page.locator('.ng-century-tabs').getByRole('button',{name:'商人市场',exact:true}).click();await market.nth(mi).click();await confirm();continue;}
   const gainIndex=texts.findIndex(t=>t.startsWith('获得')),upgradeIndex=texts.findIndex(t=>t.startsWith('升级'));
   if(gainIndex>=0&&(!returned||cubes.reduce((n,v)=>n+v,0)<7)){await hand.nth(gainIndex).click();await confirm();continue;}
   if(upgradeIndex>=0){await hand.nth(upgradeIndex).click();await confirm();continue;}
   if(gainIndex>=0){await hand.nth(gainIndex).click();await confirm();continue;}
   await page.getByRole('button',{name:'休整，收回所有商人',exact:true}).click();
 }
 await noError();await capture('century-workflow');assert(returned&&claimed&&traded,'Century missing interactions: '+JSON.stringify({returned,claimed,traded}));console.log('PASS real App Century: '+[...coverage].join(','));assert.deepEqual(errors,[]);console.log('PASS no browser exceptions, duplicate docks or document overflow');
}catch(error){await page.screenshot({path:artifacts+'/failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-2500));throw error;}finally{await browser.close();}
