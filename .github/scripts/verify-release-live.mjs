import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// Shared release gate is the sole deployed SHA/version/cache verifier.
execFileSync(process.execPath,['.github/scripts/release-gate.mjs','verify-deployed'],{stdio:'inherit'});
const base=String(process.env.DEPLOY_BASE_URL||'').replace(/\/$/,'')+'/';
async function read(relative){
 const url=new URL(relative,base);url.searchParams.set('release-sha',process.env.EXPECTED_COMMIT_SHA||'');
 const response=await fetch(url,{cache:'no-store'});
 assert.equal(response.status,200,'Live release resource unavailable: '+relative);
 return response.text();
}
for(const file of ['release/release.json','release/release-update.json','build/asset-manifest.json']){
 assert.deepEqual(JSON.parse(await read(file)),JSON.parse(fs.readFileSync(file,'utf8')),'Live metadata differs from exact source: '+file);
}
assert.equal(await read('index.html'),fs.readFileSync('index.html','utf8'),'Live index differs from exact source');
const manifest=JSON.parse(fs.readFileSync('build/asset-manifest.json','utf8'));
for(const relative of [...manifest.critical.scripts,...manifest.critical.styles]){
 assert.equal(await read(relative),fs.readFileSync(relative,'utf8'),'Live critical bundle differs from exact source: '+relative);
}
console.log('Live index, release notice, release metadata and critical hashed resources verified');
