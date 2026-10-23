import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import jsQR from 'jsqr';

const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const out=process.env.QR_SHOTS||'test-results/invite-qr';
const sizes=[[320,568],[390,844],[430,932],[844,390],[932,430],[768,1024],[1440,900],[568,320]];
const labels={
 zh:{menu:'牌桌菜单',leave:'离开牌桌',close:'关闭',scan:'扫码加桌',join:'加入牌桌',room:'房间码',enter:'入桌',approve:'同意Guest'},
 en:{menu:'Table menu',leave:'Leave table',close:'Close',scan:'Scan to join',join:'Join a table',room:'Room code',enter:'Join',approve:'ApproveGuest'},
};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const contexts=[];

async function pageFor(locale,name=undefined){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});contexts.push(context);
 if(name!==undefined)await context.addInitScript(({locale,name})=>{
  localStorage.setItem('mocha-locale',locale);
  localStorage.setItem('mocha-profile',JSON.stringify({id:`qr-${name}-${crypto.randomUUID()}`,name,avatar:'🦊'}));
 },{locale,name});
 else await context.addInitScript(locale=>localStorage.setItem('mocha-locale',locale),locale);
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('dialog',dialog=>dialog.accept());return page;
}

async function createRoom(page,locale){
 const invites=[];
 page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const message=JSON.parse(payload);if(typeof message.invite==='string')invites.push(message.invite);}catch{}}));
 await page.goto(base);
 await page.locator('.cover-gems').click();
 await page.locator('.mode-picker button').filter({hasText:locale==='zh'?'云端联机':'Online'}).click();
 await page.getByRole('button',{name:locale==='zh'?'创建牌桌':'Create table',exact:true}).click();
 await page.locator('.room-code').waitFor();
 const code=(await page.locator('.room-code').textContent()).replace(/[^A-Z2-9]/g,'').slice(0,6);
 await expect.poll(()=>invites.length).toBeGreaterThan(0);
 return {code,token:invites.at(-1)};
}

async function openQr(page,locale){
 await page.getByRole('button',{name:labels[locale].scan,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:labels[locale].scan});
 await dialog.waitFor();await dialog.locator('.invite-qr svg').waitFor();return dialog;
}

async function decodeQr(locator){const rendered=await locator.evaluate(async root=>{
 const svg=root.querySelector('svg');
 if(!svg)throw Error('Rendered QR SVG missing');
 const source=svg.outerHTML,image=new Image();
 image.src=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));await image.decode();
 const scale=Math.max(2,Math.ceil(660/image.naturalWidth)),canvas=document.createElement('canvas');canvas.width=image.naturalWidth*scale;canvas.height=image.naturalHeight*scale;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=false;context.drawImage(image,0,0,canvas.width,canvas.height);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height);return {width:pixels.width,height:pixels.height,pixels:Array.from(pixels.data)};
 });const result=jsQR(Uint8ClampedArray.from(rendered.pixels),rendered.width,rendered.height,{inversionAttempts:'dontInvert'});
 if(!result)throw Error('Rendered QR did not decode');return result.data;}

async function leave(page,locale){await page.getByRole('button',{name:labels[locale].menu,exact:true}).click();await page.getByRole('button',{name:labels[locale].leave,exact:true}).click();await page.locator('.game-library').waitFor();}

await fs.mkdir(out,{recursive:true});
try{
 const host=await pageFor('zh','Host');
 const first=await createRoom(host,'zh');
 const hostUrl=`${base}/?room=${first.code}#invite=${first.token}`;
 let dialog=await openQr(host,'zh');
 assert.equal(await decodeQr(dialog.locator('.invite-qr')),hostUrl);
 const svg=await dialog.locator('.invite-qr svg').evaluate(svg=>({width:svg.getAttribute('width'),height:svg.getAttribute('height'),viewBox:svg.getAttribute('viewBox'),source:svg.outerHTML}));
 assert.equal(svg.width,'220');assert.equal(svg.height,'220');assert.match(svg.viewBox,/^0 0 (\d+) \1$/);assert(svg.source.includes('fill="#ffffff"')&&svg.source.includes('#000000'));
 const [,viewWidth]=svg.viewBox.split(' ').map(Number),moduleCount=viewWidth-8;
 assert(viewWidth>=moduleCount+8,'QR must reserve four modules on each side');
 await host.keyboard.press('Escape');await expect(host.getByRole('dialog')).toHaveCount(0);await expect(host.getByRole('button',{name:labels.zh.scan,exact:true})).toBeFocused();
 assert(!(await host.locator('body').innerText()).includes(first.token));assert(!(await host.locator('body').innerHTML()).includes(first.token));

 // Actual App + isolated Worker: the ordinary room-code path remains pending until approval,
 // and the admitted player shares only the ordinary room URL.
 const guest=await pageFor('zh','Guest');await guest.goto(base);
 await guest.getByRole('button',{name:labels.zh.join,exact:true}).click();
 await guest.getByRole('textbox',{name:labels.zh.room,exact:true}).fill(first.code);
 await guest.getByRole('button',{name:labels.zh.enter,exact:true}).click();
 await guest.getByText('等待房主同意',{exact:true}).waitFor();
 await host.getByRole('button',{name:labels.zh.approve,exact:true}).click();
 await guest.locator('.lobby').waitFor();
 dialog=await openQr(guest,'zh');
 assert.equal(await decodeQr(dialog.locator('.invite-qr')),`${base}/?room=${first.code}`);
 await guest.keyboard.press('Escape');

 for(const locale of ['zh','en']){
  if(locale==='en'){
   await host.locator('.language-toggle').click();
  }
  for(const [width,height] of sizes){
   await host.setViewportSize({width,height});dialog=await openQr(host,locale);
   assert.equal(await decodeQr(dialog.locator('.invite-qr')),hostUrl,'Locale and viewport changes preserve the exact host invitation');
   const modal=await dialog.boundingBox(),trigger=await host.getByRole('button',{name:labels[locale].scan,exact:true}).boundingBox();
   assert(modal&&modal.x>=-1&&modal.y>=-1&&modal.x+modal.width<=width+1&&modal.y+modal.height<=height+1);
   assert(trigger&&trigger.width>=44&&trigger.height>=44);
   assert(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await host.screenshot({path:`${out}/${locale}-${width}x${height}.png`});
   if(width===320){
    await host.setViewportSize({width:height,height:width});
    const rotated=await dialog.boundingBox();assert(rotated&&rotated.x>=-1&&rotated.y>=-1&&rotated.x+rotated.width<=height+1&&rotated.y+rotated.height<=width+1);
    await host.screenshot({path:`${out}/${locale}-${height}x${width}-rotated-dialog.png`});
    await host.setViewportSize({width,height});
   }
   await dialog.getByRole('button',{name:labels[locale].close,exact:true}).click();
   await expect(host.getByRole('button',{name:labels[locale].scan,exact:true})).toBeFocused();
  }
 }

 // A long credential-bearing URL is decoded from the rendered pixels, with no QR endpoint.
 const longUrl=`${base}/join?campaign=${'long-value-'.repeat(55)}#invite=${'f'.repeat(96)}`;
 const render=await browser.newPage();
 await render.goto(base+'/manifest-mocha.webmanifest');
 await render.evaluate(async url=>{const{qrSvg}=await import('/src/ui/qr.ts');const root=document.createElement('div');root.id='qr-fixture';root.innerHTML=await qrSvg(url);root.style.width='420px';document.body.append(root);},longUrl);
 const requests=[];render.on('request',request=>requests.push(request.url()));
 assert.equal(await decodeQr(render.locator('#qr-fixture')),longUrl);
 assert.deepEqual(requests.filter(url=>!url.startsWith('blob:')),[]);await render.close();

 // Removing the sheet and replacing the room leaves neither the old token nor its QR DOM behind.
 await host.setViewportSize({width:390,height:844});await leave(host,'en');
 const replacement=await pageFor('en','Replacement'),second=await createRoom(replacement,'en'),secondUrl=`${base}/?room=${second.code}#invite=${second.token}`;
 assert.notEqual(second.token,first.token);assert(!(await replacement.locator('html').innerHTML()).includes(first.token));assert.equal(await replacement.locator('.invite-qr').count(),0);
 dialog=await openQr(replacement,'en');assert.equal(await decodeQr(dialog.locator('.invite-qr')),secondUrl);await replacement.keyboard.press('Escape');await leave(replacement,'en');

 // First-run onboarding can create an online room and reach the same local QR path.
 const onboard=await pageFor('zh');await onboard.goto(base);
 const profile=onboard.getByRole('dialog',{name:'个人资料'});await profile.getByPlaceholder('你的昵称').fill('新人');await profile.getByRole('button',{name:'入座',exact:true}).click();
 const onboardRoom=await createRoom(onboard,'zh');dialog=await openQr(onboard,'zh');
 assert.equal(await decodeQr(dialog.locator('.invite-qr')),`${base}/?room=${onboardRoom.code}#invite=${onboardRoom.token}`);await onboard.keyboard.press('Escape');await leave(onboard,'zh');

 console.log(`PASS invite QR: decoded host/non-host/long URLs, pending approval, onboarding, focus/cancel, stable locale, ${sizes.length*2} screenshots, rotation, room replacement and local generation`);
}finally{await browser.close();}
