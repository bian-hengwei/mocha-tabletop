import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const output=`test-results/feedback-${engine}`;await fs.mkdir(output,{recursive:true});
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]],errors=[];
async function seed(page,kind,locale){
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async({kind,locale})=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');const {modules}=await import('/src/core/registry.ts');const {encodeRelayStroke}=await import('/src/core/games/drawrelay.ts');
  localStorage.clear();localStorage.setItem('mocha-locale',locale);const profile={id:'feedback-player',name:'Alexandria长名字',avatar:'🦊'};localStorage.setItem('mocha-profile',JSON.stringify(profile));
  const menu={roll:'uramaki',appetizers:['onigiri','edamame','miso'],specials:['spoon','takeout'],dessert:'fruit'};
  const p=createPractice(kind,kind==='sushi'?8:kind==='undercover'?12:6,profile,{language:locale,...(kind==='sushi'?{sushiEdition:'party',sushiMenu:menu}:kind==='drawrelay'?{relayMode:'queue'}:{})});
  if(kind==='drawrelay'){
   const pass=book=>{const step=p.game.books[book].length,id=p.players[(book+step)%6].id,values=[`${book}:${step}`];p.game=modules.drawrelay.apply(p.game,id,step%2?{action:'stroke',values:[...values,encodeRelayStroke([[90,610],[340,220],[640,610],[90,610]],3,2)]}:{action:'draft',values,text:locale==='en'?'A fox sailing a little teacup':'狐狸坐着茶杯去旅行'});p.game=modules.drawrelay.apply(p.game,id,{action:'submit',values});};
   pass(0);pass(5);for(let i=0;i<3;i++)pass(3);for(let i=0;i<2;i++)pass(4);
  }
  if(kind==='codenames')p.viewer=p.players[2].id;
  writePractice(p);if(!readPractice())throw Error(`Rejected ${kind} checkpoint`);
 },{kind,locale});
 await page.goto(base);await expect(page.locator('.game-surface')).toBeVisible();
}
async function fits(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');}
try{
 for(const locale of ['zh','en'])for(const [width,height]of sizes){
  const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  for(const kind of ['drawrelay','undercover','codenames','sushi']){
   await seed(page,kind,locale);
   if(kind==='drawrelay'){
    await page.locator('.relay-sealed button').click();await expect(page.locator('.relay-heading')).toContainText('3');
    const canvas=page.locator('.relay-paper .relay-canvas'),rect=await canvas.boundingBox();assert(rect&&rect.height>=70);
    await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.7,{steps:6});await page.mouse.up();await expect(canvas.locator('polyline')).toHaveCount(1);
    await page.screenshot({path:`${output}/${locale}-${width}x${height}-${kind}.png`});
    const tools=page.getByRole('button',{name:locale==='zh'?'画笔工具':'Drawing tools',exact:true});await tools.click();await expect(page.locator('.drawing-colors button')).toHaveCount(16);await expect(page.locator('.drawing-widths button')).toHaveCount(5);
    await page.getByRole('button',{name:locale==='zh'?'橡皮擦':'Eraser',exact:true}).click();await page.locator('.drawing-widths button').last().click();await page.screenshot({path:`${output}/${locale}-${width}x${height}-tools.png`});
    await page.setViewportSize({width:height,height:width});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(tools).toBeFocused();await page.setViewportSize({width,height});
    const r=await canvas.boundingBox();await page.mouse.move(r.x+r.width*.3,r.y+r.height*.3);await page.mouse.down();await page.mouse.move(r.x+r.width*.6,r.y+r.height*.6,{steps:4});await page.mouse.up();await expect(canvas.locator('polyline')).toHaveCount(2);await expect(canvas.locator('polyline').last()).toHaveAttribute('stroke','#ffffff');await expect(canvas.locator('polyline').last()).toHaveAttribute('stroke-width','48');
    await page.getByRole('button',{name:locale==='zh'?'撤销上一笔':'Undo stroke',exact:true}).click();await expect(canvas.locator('polyline')).toHaveCount(1);
    await page.getByRole('combobox',{name:locale==='zh'?'待办任务':'Pending tasks'}).selectOption('4:2');await page.locator('.relay-writing textarea').fill(locale==='zh'?'猜图草稿':'Guess draft');await expect(page.locator('.relay-draft-status')).toContainText(locale==='zh'?'草稿已保存':'Draft saved');
    await page.getByRole('combobox',{name:locale==='zh'?'待办任务':'Pending tasks'}).selectOption('3:3');await expect(canvas.locator('polyline')).toHaveCount(1);
    await page.reload();await page.locator('.relay-sealed button').click();await page.getByRole('combobox',{name:locale==='zh'?'待办任务':'Pending tasks'}).selectOption('4:2');await expect(page.locator('.relay-writing textarea')).toHaveValue(locale==='zh'?'猜图草稿':'Guess draft');
   }else if(kind==='undercover'){
    await expect(page.locator('.wg-dealt-players>span')).toHaveCount(12);await page.locator('.wg-secret').click();await expect(page.locator('.wg-open')).toHaveCount(1);await page.locator('.wg-secret-panel>.wg-primary').click();await expect(page.locator('.wg-open')).toHaveCount(0);
    await page.locator('.practice-switch select').selectOption('practice-1');await expect(page.locator('.wg-open')).toHaveCount(0);await expect(page.locator('.wg-speaking,.wg-odd-player,.end-banner')).toHaveCount(0);
   }else if(kind==='codenames'){
    await page.locator('.wg-mark-toggle').click();const first=page.locator('.wg-word').first();await first.click();await expect(first.locator('.wg-personal-mark')).toHaveText('?');await first.click();await expect(first.locator('.wg-personal-mark')).toHaveText('×');
    await page.locator('.practice-switch select').selectOption('practice-3');await expect(page.locator('.wg-personal-mark')).toHaveCount(0);await page.locator('.practice-switch select').selectOption('practice-2');await expect(first.locator('.wg-personal-mark')).toHaveText('×');
   }else{
    await expect(page.locator('.sushi-players button')).toHaveCount(8);await expect(page.locator('.ng-hand .ng-sushi-card')).toHaveCount(7);await page.locator('.sushi-table-menu summary').click();
   }
   await fits(page);if(kind!=='drawrelay')await page.screenshot({path:`${output}/${locale}-${width}x${height}-${kind}.png`});
  }
  await page.close();console.log('PASS',locale,width,height,'queue, tools, word dealer, private marks, Party');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
