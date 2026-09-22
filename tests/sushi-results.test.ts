import {afterAll,afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SushiResults} from '../src/ui/SushiResults';
import {setLocale,type Locale} from '../src/i18n';

beforeAll(()=>vi.stubGlobal('document',{documentElement:{lang:''}}));
afterEach(()=>setLocale('zh'));
afterAll(()=>vi.unstubAllGlobals());
const players=[21,20,28,23,29].map((score,index)=>({id:`p${index}`,name:['姜黄','Two','Three','Four','Five'][index],avatar:'🦊',score,puddings:[4,1,3,1,1][index]}));
const roundScores=[[7,6,7,8,10],[0,8,6,9,10],[8,8,15,8,11]];
const render=(props:Parameters<typeof SushiResults>[0])=>renderToStaticMarkup(createElement(SushiResults,props));
const points=(html:string)=>[...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].flatMap(body=>[...body[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(row=>[...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(cell=>cell[1])));

describe('Sushi final score explanation',()=>{
  it.each(['zh','en'] as Locale[])('%s: displays all standings and separately explains the shared pudding deduction',locale=>{
    setLocale(locale);const html=render({players,roundScores,winners:['p4'],selfID:'p2'});
    expect(points(html)).toEqual([
      ['10','10','11','-2','29'],['7','6','15','0','28'],['8','9','8','-2','23'],['7','0','8','+6','21'],['6','8','8','-2','20'],
    ]);
    expect(html).toContain('姜黄'); // Player-entered names are not system translations.
    expect(html).toContain(locale==='zh'?'寿司卷':'maki rolls');
    expect(html).toContain(locale==='zh'?'你':'You');
  });
  it('retains the authoritative winner when pudding breaks a tied total',()=>{
    const tied=[{...players[0],score:20,puddings:1},{...players[1],score:20,puddings:4}];
    const html=render({players:tied,roundScores:[[4,4],[4,4],[12,6]],winners:['p1'],selfID:'p0'});
    expect(html.indexOf('Two')).toBeLessThan(html.indexOf('姜黄'));
    expect(points(html)).toEqual([['4','4','6','+6','20'],['4','4','12','0','20']]);
  });
  it('does not invent a pudding score when older results lack complete round history',()=>{
    const html=render({players:[players[0]],roundScores:[[7]],winners:['p0'],selfID:'p0'});
    expect(points(html)).toEqual([['7','—','—','—','21']]);
  });
});
