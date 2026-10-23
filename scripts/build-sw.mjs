import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(!['sw.js','_headers','_redirects'].includes(entry.name))files.push(file);}}
walk('dist');
const hash=createHash('sha256');
for(const file of files.sort()){hash.update(file);hash.update(fs.readFileSync(file));}
const cache='mocha-assets-'+hash.digest('hex').slice(0,12);
let sw=fs.readFileSync('public/sw.js','utf8').replace("'__MOCHA_CACHE__'",JSON.stringify(cache));
fs.writeFileSync('dist/sw.js',sw);
console.log(`Service worker static asset cache: ${cache}; HTML navigation is excluded`);
