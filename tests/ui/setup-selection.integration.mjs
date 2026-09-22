import {chromium,webkit,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const engine=process.env.TEST_BROWSER==='webkit'?'webkit':'chromium';
const browser=await({chromium,webkit}[engine]).launch();
const out=`test-results/setup-selection/${engine}`;
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
await fs.mkdir(out,{recursive:true});
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext();
  await context.addInitScript(locale=>{
   localStorage.setItem('mocha-locale',locale);
   localStorage.setItem('mocha-profile',JSON.stringify({id:'setup-state-player',name:'Setup player',avatar:'🐶'}));
  },locale);
  const page=await context.newPage();
  await page.goto(base);
  for(const [kind,count] of [['mahjong',4],['guandan',4],['doudizhu',3]])await expect(page.locator(`.cover-${kind} .cover-caption>span`)).toHaveText(`${count} ${locale==='zh'?'人':'players'}`);
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await page.locator('.cover-werewolf').click();
   const modes=page.locator('.mode-picker button'),hosts=page.locator('.wolf-mode-picker button');
   const create=page.getByRole('button',{name:locale==='zh'?'创建牌桌':'Create table',exact:true}),close=page.getByRole('dialog').getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true});
   await expect(create).toBeInViewport({ratio:1});await expect(close).toBeInViewport({ratio:1});
   const win=page.getByRole('combobox',{name:locale==='zh'?'胜负条件':'Victory rule',exact:true}),description=page.locator('.wolf-win-description');
   await win.selectOption('parity');await expect(description).toHaveText(locale==='zh'?'狼人存活人数达到或超过好人时获胜。':'Werewolves win when they equal or outnumber the remaining good players.');
   await win.selectOption('sides');await expect(description).toHaveText(locale==='zh'?'狼人清除全部平民或全部神职中的任一类时获胜。':'Werewolves win by eliminating every Villager or every special role.');
   await expect(win).toHaveAttribute('aria-describedby',await description.getAttribute('id'));
   await page.locator('.setup-options').evaluate(node=>node.scrollTo(0,0));
   await page.screenshot({path:`${out}/${locale}-${width}x${height}-initial.png`});
   await expect(modes.filter({has:page.locator('b')})).toHaveCount(2);
   for(const buttons of [modes,hosts]){
    for(let i=0;i<await buttons.count();i++){
     const button=buttons.nth(i);await button.focus();await button.press(i%2?'Enter':'Space');
     await expect(button).toHaveAttribute('aria-pressed','true');
     await expect(buttons.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
     await expect(buttons.and(page.locator('[aria-pressed="false"]'))).toHaveCount(await buttons.count()-1);
    }
   }
   // Returning to a prior selection and rotating must preserve the exposed state.
   await hosts.nth(1).click();await modes.nth(0).click();
   await page.setViewportSize({width:height,height:width});
   await expect(create).toBeInViewport({ratio:1});await expect(close).toBeInViewport({ratio:1});
   await expect(hosts.nth(1)).toHaveAttribute('aria-pressed','true');
   await expect(modes.nth(0)).toHaveAttribute('aria-pressed','true');
   await page.setViewportSize({width,height});
   await expect(create).toBeInViewport({ratio:1});await expect(close).toBeInViewport({ratio:1});
   await page.screenshot({path:`${out}/${locale}-${width}x${height}.png`});
   await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
   console.log(`PASS ${engine} ${locale} ${width}x${height}: keyboard and pointer mode selection, exclusive state, rotation`);
  }
  await context.close();
 }
}finally{await browser.close();}
