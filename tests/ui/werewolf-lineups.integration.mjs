import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.CHROME_PATH||undefined}:{})});
const errors=[];await fs.mkdir('test-results/werewolf-lineups',{recursive:true});
try{
 for(const language of ['zh','en']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(language=>{localStorage.setItem('mocha-locale',language);localStorage.setItem('mocha-profile',JSON.stringify({id:'lineup-review',name:'Morgan',avatar:'🦊'}));},language);
  const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const label=(zh,en)=>language==='zh'?zh:en;
  for(const [preset,count,newRole] of [['classic9',9,null],['classic',12,null],['idiot',12,'idiot'],['wolfKing',12,'wolfKing']]){
   for(const [mode,index] of [['standard',0],['judge',1],['deal',2]]){
    await page.goto(base+'/manifest-mocha.webmanifest');await page.evaluate(()=>localStorage.removeItem('mocha-practice-v1'));await page.goto(base);await page.locator('.cover-werewolf').click();
    await page.locator('.wolf-mode-picker button').nth(index).click();await page.getByRole('combobox',{name:label('身份牌型','Role preset'),exact:true}).selectOption(preset);
    const total=await page.locator('.wolf-role-token b').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.textContent.slice(1)),0));assert.equal(total,count,'The visible lineup contains the actual player count');
    if(mode==='judge'){
     for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:932,height:430},{width:768,height:1024},{width:1440,height:900}]){
      await page.setViewportSize(size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Setup has no horizontal overflow');
      await page.locator('.wolf-composition').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/werewolf-lineups/${preset}-${language}-${size.width}.png`});
      assert(await page.locator('.wolf-composition').evaluate(e=>e.scrollWidth<=e.clientWidth),'Role lineup fits');
     }
     await page.setViewportSize({width:390,height:844});
    }
    await page.getByRole('button',{name:label('同屏试玩','Pass & play'),exact:true}).click();await page.locator('.social-table-v2').waitFor();
    let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice);assert.equal(saved.players.length,count+(mode==='judge'?1:0));assert.equal(saved.options.werewolfPreset,preset);assert.equal(saved.options.werewolfMode,mode);
    assert.equal(Object.keys(saved.game.roles).length,count,'Moderator does not receive a role');
    if(newRole){
     const seat=Object.entries(saved.game.roles).find(([,role])=>role===newRole)[0];await page.getByRole('combobox',{name:label('切换试玩座位','Switch practice seat')}).selectOption(seat);await page.getByRole('button',{name:label('查看我的身份','View my identity'),exact:true}).click();
     assert.equal(await page.locator('.identity-portrait image').getAttribute('href'),'/art/roles-wolf-expanded-v1.jpg');
     assert((await page.locator('.identity-story h2').innerText()).length>0);await page.keyboard.press('Escape');
    }
    if(language==='en')assert(!/[\u3400-\u9fff]/u.test(await page.locator('.social-table-v2').innerText()),'New role UI is fully English');
    // Reopening the saved game resets setup form defaults, but replay must retain the actual match rules.
    await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('mocha-practice-v1'));saved.practice.game.winner='好人获胜 · 狼人全部出局';localStorage.setItem('mocha-practice-v1',JSON.stringify(saved));});await page.reload();await page.locator('.social-table-v2').waitFor();await page.getByRole('button',{name:label('再来一局','Play again'),exact:true}).click();await page.locator('.social-table-v2').waitFor();
    const replay=await page.evaluate(()=>JSON.parse(localStorage.getItem('mocha-practice-v1')).practice);assert.notEqual(replay.id,saved.id);assert.deepEqual(replay.options,saved.options,'Replay retains options after reload');assert.equal(replay.players.length,saved.players.length);
   }
   console.log(`PASS ${language} ${preset}: role counts, three modes, portrait, saved-game replay and seven responsive layouts`);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
