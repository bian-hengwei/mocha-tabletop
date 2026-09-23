import {chromium,webkit,expect} from '@playwright/test';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5174',api=process.env.TEST_API_BASE||'http://127.0.0.1:8787',engine=process.env.TEST_BROWSER||'chromium';
const out=`test-results/room-social-games-${engine}`;await fs.mkdir(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch(),errors=[];
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900]];
const games={gems:4,bombs:5,sushi:5,century:5,uno:10,doudizhu:3,guandan:4,mahjong:4,codenames:4,werewolf:6,avalon:5,undercover:3};
const blocked=['codenames','werewolf','avalon','undercover'];
const credentials=i=>({profile:{id:randomUUID(),name:i===0?'Host 长昵称 ABC':'Player '+i,avatar:i%2?'🐱':'🦊'},token:randomBytes(24).toString('hex')});
async function peer(code,cred,invite){const ws=new WebSocket(api.replace(/^http/,'ws')+'/api/rooms/'+code);const messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});ws.send(JSON.stringify({type:'hello',...cred,invite}));const c={ws,messages,send(m){ws.send(JSON.stringify({requestID:randomUUID(),...m}));},async wait(pred){for(let i=0;i<400;i++){const found=messages.find(pred);if(found)return found;await new Promise(r=>setTimeout(r,20));}throw Error('peer timeout '+JSON.stringify(messages.at(-1)));}};await c.wait(m=>m.type==='snapshot');return c;}
try{for(const [kind,count]of Object.entries(games).filter(([kind])=>!process.env.TEST_GAMES||process.env.TEST_GAMES.split(',').includes(kind))){
 const creds=Array.from({length:count},(_,i)=>credentials(i)),peers=[];
 const response=await fetch(api+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...creds[0],kind,mode:'cloud'})});assert.equal(response.status,200);const created=await response.json();
 const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({cred,created})=>{localStorage.setItem('mocha-locale','zh');localStorage.setItem('mocha-profile',JSON.stringify(cred.profile));localStorage.setItem('mocha-room-session',JSON.stringify({...cred,...created,savedAt:Date.now(),expiresAt:Date.now()+3600000}));},{cred:creds[0],created});
 try{
  await page.goto(base);await expect(page.locator('.room-code')).toContainText(created.code);
  for(const cred of creds.slice(1)){const p=await peer(created.code,cred,created.invite);peers.push(p);p.send({type:'ready',ready:true});}
  await expect(page.locator('.lobby-seat:not(.vacant)')).toHaveCount(count);await expect(page.getByRole('button',{name:'开局',exact:true})).toBeEnabled();
  await expect(page.locator('.social-chat-trigger')).toHaveCount(blocked.includes(kind)?0:1);
  await page.getByRole('button',{name:'开局',exact:true}).click();await expect(page.locator('main')).toHaveClass(/in-game/);await peers[0].wait(m=>m.type==='snapshot'&&m.room.started);
  if(blocked.includes(kind)){await expect(page.locator('.social-avatar-button,.social-chat-trigger')).toHaveCount(0);console.log('PASS blocked game UI',kind);continue;}
  for(const locale of ['zh','en']){
   if(locale==='en')await page.locator('.language-toggle').click();
   for(const [width,height]of sizes){await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(requestAnimationFrame));await expect(page.locator('.social-chat-trigger')).toBeInViewport();await expect(page.locator('.profile-chip')).toBeInViewport();
    const seats=page.locator('main .social-avatar');await expect(seats).toHaveCount(count);for(let i=0;i<count;i++)await expect(seats.nth(i),`${kind}/${locale}/${width} seat ${i}`).toBeVisible();
    if(kind==='doudizhu')assert(await page.locator('.classic-arena').evaluate(arena=>arena.scrollHeight<=arena.clientHeight+2),`${kind}/${locale}/${width} seat and turn label stay inside the arena`);
    if(kind==='mahjong'){
     const overlaps=await page.evaluate(()=>{
      const label=document.querySelector('.mj-seat.seat-self>div').getBoundingClientRect();
      return [...document.querySelectorAll('.mj-rack .mj-face')].filter(tile=>{const r=tile.getBoundingClientRect();return Math.min(label.right,r.right)>Math.max(label.left,r.left)&&Math.min(label.bottom,r.bottom)>Math.max(label.top,r.top);}).length;
     });
     assert.equal(overlaps,0,`${kind}/${locale}/${width} own-seat text must not intersect opponent tiles`);
    }
    await expect(page.locator('.topbar .social-avatar-button')).toHaveCount(0);await page.locator('.profile-chip').click();await expect(page.locator('.profile-editor')).toBeVisible();await expect(page.locator('.social-dialog')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('.profile-chip')).toBeFocused();
    // Check each table family's actual avatar opens the reaction selector.
    const avatar=page.locator('main .social-avatar-button');await expect(avatar,`${kind}/${locale}/${width} own seat avatar`).toBeVisible();await avatar.click();await expect(page.locator('.social-sticker-grid')).toBeVisible();await page.keyboard.press('Escape');
    await page.screenshot({path:`${out}/${kind}-${locale}-${width}.png`});
   }
  }
  const text='A'.repeat(280);peers[0].send({type:'social',command:{type:'chat',text}});await expect(page.locator('.social-bubble').first()).toContainText(text);await page.screenshot({path:`${out}/${kind}-bubble.png`});
  await page.locator('.social-chat-trigger').click();await expect(page.locator('.social-log')).toContainText(text);await page.keyboard.press('Escape');
  await page.locator('.social-avatar-button').click();await page.locator('.social-sticker-grid button').first().click();await expect(page.locator('.social-dialog')).toHaveCount(0);await expect(page.locator('.topbar .social-avatar-reaction')).toHaveCount(0);await expect(page.locator('main .social-avatar .social-avatar-reaction')).toHaveCount(1);await page.screenshot({path:`${out}/${kind}-reaction.png`,animations:'disabled'});
  console.log('PASS',kind,count,'players; both languages, 7 sizes, table avatar activation, incoming long bubble and outgoing reaction');
 }catch(error){await page.screenshot({path:`${out}/${kind}-failure.png`,animations:'disabled'});throw error;}
 finally{await page.keyboard.press('Escape');await page.locator('.brand .icon').click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:/^(离开牌桌|Leave table)$/}).click();for(const p of peers)p.ws.close();await ctx.close();}
}assert.deepEqual(errors,[]);}finally{await browser.close();}
