import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit,expect} from '@playwright/test';

const base=process.env.BASE_URL||'http://127.0.0.1:5184',engine=process.env.TEST_BROWSER||'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const out=`test-results/relay-feedback-${engine}`;
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function decode(encoded){const values=[...encoded].map(char=>alphabet.indexOf(char));const points=[];for(let index=2;index<values.length;index+=4)points.push([values[index]*32+values[index+1],values[index+2]*32+values[index+3]]);return points;}
try{
 await fs.mkdir(out,{recursive:true});
 const page=await browser.newPage({viewport:{width:700,height:600}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/tests/ui/relay-feedback.fixture.html`);
 const canvas=page.locator('svg'),strokes=async()=>JSON.parse(await page.locator('output').innerText()),marks=()=>canvas.locator('polyline,circle').count();
 const box=await canvas.boundingBox(),move=(x,y)=>page.mouse.move(box.x+box.width*x,box.y+box.height*y);
 const clear=async()=>{await page.getByText('Clear',{exact:true}).click();await expect.poll(strokes).toEqual([]);};
 const unfinished=async()=>{await move(.1,.75);await page.mouse.down();await move(.85,.25);await expect.poll(marks).toBeGreaterThan(0);};

 await move(.1,.8);await page.mouse.down();for(let index=1;index<=160;index++)await move(.1+.8*index/160,.8);
 await expect.poll(marks).toBeGreaterThan(0);assert.equal((await strokes()).length,0,'live draft is not submitted');await canvas.screenshot({path:`${out}/live-before-release.png`});
 await page.mouse.up();await expect.poll(async()=>(await strokes()).length).toBe(1);assert.deepEqual(decode((await strokes())[0]).at(-1),[921,614]);

 await clear();await move(.5,.5);await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);await expect.poll(async()=>(await strokes()).length).toBe(1);assert.equal(decode((await strokes())[0]).length,1,'a tap keeps one encoded point');await expect.poll(()=>canvas.locator('circle').count()).toBeGreaterThan(0);
 await clear();await page.mouse.click(box.x+100,box.y+100,{button:'right'});assert.equal((await strokes()).length,0,'right-click does not start a stroke');

 await unfinished();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await expect.poll(marks).toBe(0);assert.deepEqual(await strokes(),[],'blur discards an unfinished stroke');
 await unfinished();await canvas.evaluate(node=>node.dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:1})));await page.mouse.up();await expect.poll(marks).toBe(0);assert.deepEqual(await strokes(),[],'lost pointer capture discards an unfinished stroke');
 await unfinished();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});});await page.mouse.up();await expect.poll(marks).toBe(0);assert.deepEqual(await strokes(),[],'hidden document discards an unfinished stroke');

 for(const control of ['Toggle permission','New seat','Clear']){
  await unfinished();await page.getByText(control,{exact:true}).evaluate(button=>button.click());await page.mouse.up();await expect.poll(marks).toBe(0);assert.deepEqual(await strokes(),[],`${control} discards unfinished private input`);
  if(control==='Toggle permission')await page.getByText(control,{exact:true}).click();
 }

 await clear();await canvas.evaluate(node=>{
  const box=node.getBoundingClientRect(),emit=(type,x,y)=>{const event=new PointerEvent(type,{bubbles:true,pointerId:9,pointerType:'touch',isPrimary:false,button:0,buttons:1,clientX:box.x+x*box.width,clientY:box.y+y*box.height});Object.defineProperty(event,'isPrimary',{value:false});node.dispatchEvent(event);};
  emit('pointerdown',.1,.3);emit('pointermove',.8,.3);emit('pointerup',.8,.3);
 });await expect.poll(marks).toBe(0);assert.deepEqual(await strokes(),[],'an initial non-primary pointer never creates a draft or stroke');
 await canvas.evaluate(node=>{
  const box=node.getBoundingClientRect();node.setPointerCapture=()=>{};node.hasPointerCapture=()=>false;
  const emit=(type,pointerId,x,y,isPrimary=true)=>node.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId,pointerType:'touch',isPrimary,button:0,buttons:1,clientX:box.x+x*box.width,clientY:box.y+y*box.height}));
  emit('pointerdown',10,.1,.3);emit('pointermove',10,.5,.3);emit('pointerdown',11,.9,.9,false);emit('pointermove',11,.9,.1,false);emit('pointerup',11,.9,.1,false);emit('pointermove',10,.8,.3);emit('pointerup',10,.8,.3);
 });
 assert.equal((await strokes()).length,1);assert((decode((await strokes())[0])).every(([,y])=>y===230),'a second pointer cannot replace or mix the owned stroke');

 await clear();const finalEndpoint=[972,690];await canvas.evaluate((node,[finalX,finalY])=>{
  const box=node.getBoundingClientRect();node.setPointerCapture=()=>{};node.hasPointerCapture=()=>false;
  const emit=(type,x,y)=>node.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:30,pointerType:'pen',isPrimary:true,button:0,buttons:1,clientX:box.x+x/1023*box.width,clientY:box.y+y/767*box.height}));
  emit('pointerdown',100,120);for(let index=0;index<2600;index++)emit('pointermove',index%2?900:120,index%2?620:140);emit('pointermove',finalX,finalY);emit('pointerup',finalX,finalY);
 },finalEndpoint);
 assert.equal((await strokes()).length,1);const long=decode((await strokes())[0]);assert(long.length<=48);assert.deepEqual(long.at(-1),finalEndpoint,'a >2048 accepted-point zigzag retains its final unique endpoint');

 await clear();await canvas.evaluate(node=>{
  const box=node.getBoundingClientRect();node.setPointerCapture=()=>{};node.hasPointerCapture=()=>false;
  for(const type of ['pointerdown','pointermove','pointercancel','pointerup'])node.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:20,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:box.x+100,clientY:box.y+100}));
 });
 await expect.poll(marks).toBe(0);assert.deepEqual(await strokes(),[],'cancelled touch never submits');
 await canvas.press('ArrowRight');await expect.poll(async()=>(await strokes()).length).toBe(1);await expect(canvas.locator('circle[fill="none"]')).toHaveCount(1);await canvas.evaluate(node=>node.blur());await expect(canvas.locator('circle[fill="none"]')).toHaveCount(0);
 await canvas.press('Enter');await expect.poll(async()=>(await strokes()).length).toBe(2);await expect(canvas.locator('circle[fill="none"]')).toHaveCount(1);await page.getByText('Toggle permission',{exact:true}).evaluate(button=>button.click());await expect(canvas.locator('circle[fill="none"]')).toHaveCount(0);await page.getByText('Toggle permission',{exact:true}).evaluate(button=>button.click());
 await canvas.press('Enter');await expect.poll(async()=>(await strokes()).length).toBe(3);await expect(canvas.locator('circle[fill="none"]')).toHaveCount(1);await page.getByText('Clear',{exact:true}).evaluate(button=>button.click());await expect(canvas.locator('circle[fill="none"]')).toHaveCount(0);assert.deepEqual(await strokes(),[],'clear removes the keyboard cursor and strokes');
 assert.deepEqual(errors,[]);console.log(`${engine}: relay live feedback, endpoint retention, single-point SVG, right-click, blur/lostcapture/hidden, permission/seat/clear, pointer ownership, cancel, keyboard PASS`);
}finally{await browser.close();}
