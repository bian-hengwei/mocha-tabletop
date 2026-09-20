import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||process.env.UI_BASE_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
const report=[];const output=new URL('./artifacts/',import.meta.url);await fs.mkdir(output,{recursive:true});
try{
for(const viewport of [{width:667,height:375},{width:844,height:390}])for(const kind of ['werewolf','avalon']){
 const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.goto(`${origin}/tests/ui/social.fixture.html?kind=${kind}`);await page.locator('.seat').last().waitFor();
 if(process.env.EQUAL_ARC==='1')await page.locator('.seat').evaluateAll(nodes=>{
   const box=nodes[0].parentElement.getBoundingClientRect(),rx=box.width*.47,ry=box.height*.43;
   const steps=1440,points=[{angle:-Math.PI/2,distance:0}];let total=0;
   for(let i=1;i<=steps;i++){const a=-Math.PI/2+(i-1)*Math.PI*2/steps,b=-Math.PI/2+i*Math.PI*2/steps;total+=Math.hypot(rx*(Math.cos(b)-Math.cos(a)),ry*(Math.sin(b)-Math.sin(a)));points.push({angle:b,distance:total});}
   nodes.forEach((node,i)=>{const target=total*i/nodes.length;const k=points.findIndex(p=>p.distance>=target);const before=points[Math.max(0,k-1)],after=points[k];const angle=before.angle+(after.angle-before.angle)*(after.distance===before.distance?0:(target-before.distance)/(after.distance-before.distance));node.style.left=(50+47*Math.cos(angle))+'%';node.style.top=(50+43*Math.sin(angle))+'%';});
 });
 const inspection=await page.locator('.seat').evaluateAll(nodes=>{
   const rects=nodes.map((e,i)=>{const r=e.getBoundingClientRect(),a=e.querySelector('.seat-avatar').getBoundingClientRect();const hit=document.elementFromPoint(a.x+a.width/2,a.y+a.height/2)?.closest('.seat');return {seat:i+1,x:r.x,y:r.y,w:r.width,h:r.height,avatarHit:hit===e};});
   const overlaps=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j],w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(w>1&&h>1)overlaps.push({seats:[a.seat,b.seat],width:w,height:h});}return {rects,overlaps};
 });
 await page.screenshot({path:new URL(`${viewport.width}-${kind}-maximum${process.env.EQUAL_ARC==='1'?'-arc':''}.png`,output).pathname});
 const inaccessible=[];for(let i=0;i<(kind==='werewolf'?18:10);i++){
  try{await page.locator('.seat').nth(i).locator('.seat-avatar').click();const selected=await page.locator('.action-sheet .choice.selected').textContent();assert.equal(selected,`玩家${i+1}`);await page.getByRole('button',{name:'关闭选择',exact:true}).click();}catch(e){inaccessible.push({seat:i+1,error:e.message});if(await page.locator('.action-sheet').isVisible())await page.getByRole('button',{name:'关闭选择',exact:true}).click();}
 }
 report.push({viewport,kind,...inspection,inaccessible});await context.close();
 console.log(`${viewport.width} ${kind}: overlaps=${inspection.overlaps.length}; blocked avatar centers=${inspection.rects.filter(r=>!r.avatarHit).map(r=>r.seat)}; click failures=${inaccessible.length}`);
}
await fs.writeFile(new URL(process.env.EQUAL_ARC==='1'?'social-max-arc-report.json':'social-max-report.json',output),JSON.stringify(report,null,2));
}finally{await browser.close();}
process.exit(report.some(r=>r.overlaps.length||r.inaccessible.length||r.rects.some(s=>!s.avatarHit))?1:0);
