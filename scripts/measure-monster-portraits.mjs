import fs from 'node:fs';
import crypto from 'node:crypto';
import {portraitImageMetadata} from './lib/portrait-image-metadata.mjs';

const file='config/monster-portrait-registry.json';
const registry=JSON.parse(fs.readFileSync(file,'utf8'));
const targets=Object.values(registry.groups).flat().map(row=>Object.fromEntries(registry.tupleSchema.map((key,i)=>[key,row[i]])));
const entries=[...targets.filter(t=>t.status==='existing'),...registry.assetPool.entries.filter(e=>e.status==='adopted').map(e=>({portraitKey:e.assetId,path:e.runtimePath}))];
const paths=[...new Set([...entries.map(e=>e.path),...registry.policy.legacyUniversalSoldierFiles])];
const measurements={};
for(const path of paths){
    const meta=portraitImageMetadata(path);
    if(!meta.bounds||!meta.alpha||meta.opaque)throw new Error('Portrait transparency invalid: '+path);
    measurements[path]={width:meta.width,height:meta.height,alphaBounds:meta.bounds,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')};
}
const presentation={version:1,boundsMethod:'nonzero-alpha-inclusive',classes:{STANDARD:{bodyHeight:.82,baseline:.96},ELITE:{bodyHeight:.85,baseline:.96},SMALL_BOSS:{bodyHeight:.88,baseline:.96},BIG_BOSS:{bodyHeight:.90,baseline:.96}},assets:measurements};
if(process.argv.includes('--check')){
    if(JSON.stringify(registry.presentation)!==JSON.stringify(presentation))throw new Error('Portrait presentation metadata is stale; run measure-monster-portraits.mjs --write');
}else if(process.argv.includes('--write')){
    registry.presentation=presentation;
    fs.writeFileSync(file,JSON.stringify(registry,null,2)+'\n');
}
console.log(JSON.stringify({decoded:paths.length,records:entries.length,existing:targets.filter(t=>t.status==='existing').length,planned:targets.filter(t=>t.status==='planned').length,broken:0}));
