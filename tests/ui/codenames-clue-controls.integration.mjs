import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5174',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch(),out=`test-results/codenames-clue-controls-${engine}`;
const sizes=[[320,568],[390,844],[430,932],[568,320],[844,390],[932,430],[768,1024],[1440,900]],measurements=[];
await fs.mkdir(out,{recursive:true});
try{for(const locale of ['zh','en'])for(const [width,height]of sizes){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/manifest-mocha.webmanifest');
 await page.evaluate(async locale=>{
  const {createPractice,writePractice,readPractice}=await import('/src/local/practice.ts');
  localStorage.clear();const profile={id:'clue-control-player',name:'Mocha',avatar:'🦊'};
  localStorage.setItem('mocha-profile',JSON.stringify(profile));localStorage.setItem('mocha-locale',locale);
  const p=createPractice('codenames',12,profile,{language:locale},undefined,5);
  p.viewer=p.game.turn==='red'?'practice-0':'practice-1';writePractice(p);
  if(!readPractice())throw Error('Rejected Codenames clue-control fixture');
 },locale);
 await page.goto(base);await expect(page.getByRole('dialog')).toHaveCount(0);
 const form=page.locator('.wg-clue-form'),input=form.locator('input'),count=form.locator('select'),submit=form.locator('button[type=submit]');
 await expect(form).toBeVisible();
 const words=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game.cards.map(c=>c.word));
 const clue=(locale==='zh'?['月光','旅程','和谐']:['Moonlight','Journey','Harmony']).find(word=>!words.includes(word));assert(clue);
 await input.fill(clue);await count.selectOption('0');await expect(form.locator('.wg-clue-guidance')).toContainText(locale==='zh'?'不相关':'Unrelated');
 await count.selectOption('unlimited');await expect(count.locator('option:checked')).toHaveText('∞');await expect(count.locator('option:checked')).toHaveAttribute('aria-label',locale==='zh'?'∞ 不限':'∞ Unlimited');await expect(form.locator('.wg-clue-guidance')).toHaveText(locale==='zh'?'不限猜测次数':'Unlimited guesses');await expect(input).toHaveValue(clue);
 async function checkTargets(){
  const boxes=await form.locator('input,select,button[type=submit]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {control:n.tagName,width:b.width,height:b.height,top:b.top,bottom:b.bottom};}));
  for(const box of boxes){assert(box.height>=44&&box.width>=44,`short clue control: ${JSON.stringify(box)}`);assert(box.top>=0&&box.bottom<=await page.evaluate(()=>innerHeight)+1,`clipped clue control: ${JSON.stringify(box)}`);}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');return boxes;
 }
 const boxes=await checkTargets();await page.screenshot({path:`${out}/${locale}-${width}x${height}-unlimited.png`});
 await page.setViewportSize({width:height,height:width});await checkTargets();await expect(count).toHaveValue('unlimited');await expect(input).toHaveValue(clue);await page.setViewportSize({width,height});
 const chosen=width===568?'unlimited':width===390?'0':'2';await count.selectOption(chosen);await submit.tap();
 await expect(form).toHaveCount(0);await expect(page.locator('.wg-clue-panel strong')).toContainText(clue);
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice.game);
 let game=await stored();assert.equal(game.clue.count,chosen==='unlimited'?'unlimited':Number(chosen));assert.equal(game.limit,chosen==='0'||chosen==='unlimited'?null:3);
 const cards=game.cards.map(c=>c.word);await page.reload();await expect(page.locator('.wg-clue-panel strong')).toContainText(clue);game=await stored();assert.deepEqual(game.cards.map(c=>c.word),cards);assert.equal(game.clue.count,chosen==='unlimited'?'unlimited':Number(chosen));
 assert.deepEqual(errors,[]);measurements.push({locale,width,height,boxes,chosen,pass:true});await page.close();
 console.log('PASS',engine,locale,width,height,'44px clue controls, zero/unlimited/numeric choice, rotation, touch submit and reload');
}}finally{await fs.writeFile(`${out}/measurements.json`,JSON.stringify({engine,measurements},null,2));await browser.close();}
