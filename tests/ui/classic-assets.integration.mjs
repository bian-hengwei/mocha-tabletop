import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5174';
const browser=await(process.env.TEST_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||undefined}));
try{
 const page=await browser.newPage();await page.goto(base+'/tests/ui/classic-art.fixture.html');await page.locator('.mahjong-art').last().waitFor();
 const result=await page.evaluate(async()=>{
  const sources=[...new Set([...document.querySelectorAll('.classic-card-art img, img.classic-card-art, .classic-card-art image')].map(e=>e.getAttribute('src')||e.getAttribute('href')))];
  const failures=[];for(const src of [...sources,'/art/doudizhu.svg','/art/guandan.svg','/art/mahjong.svg']){const image=new Image();image.src=src;try{await image.decode();if(!image.naturalWidth||!image.naturalHeight)failures.push(src);}catch{failures.push(src);}}
  return{failures,sources};
 });
 assert.deepEqual(result.failures,[],'every face, tile base, back and cover decodes');assert.equal(result.sources.length,90,'54 playing cards, card back, 34 tile faces and tile base');
 assert((await page.locator('[data-rank="16"]').getAttribute('src')).endsWith('/2J.svg'),'small joker uses black artwork');assert((await page.locator('[data-rank="17"]').getAttribute('src')).endsWith('/1J.svg'),'big joker uses red artwork');
 console.log('PASS all 90 local CC0 artwork assets and three composed covers decode; joker colors match ranks');
}finally{await browser.close();}
