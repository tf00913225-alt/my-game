import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {auditSharedPortraits} from '../scripts/lib/shared-portrait-audit.mjs';
const registry=JSON.parse(fs.readFileSync('config/monster-portrait-registry.json','utf8'));
const entries=registry.assetPool.entries.filter(e=>e.assetClass==='shared-npc');
assert.ok(entries.length>=50);
assert.deepEqual(auditSharedPortraits(registry),[]);
const initial=entries.slice(0,50);
assert.deepEqual(initial.map(e=>e.assetId),Array.from({length:50},(_,i)=>'NPC_SHARED_'+String(i+1).padStart(3,'0')));
// Initial immutable identity mapping; additions after 050 do not invalidate it.
const identityDigest=crypto.createHash('sha256').update(JSON.stringify(initial.map(e=>[e.assetId,e.sourcePath,e.sourceCommit,e.sourceSha256]))).digest('hex');
assert.equal(identityDigest,'040551571565558182a32dadcf9dbdb1cd7c5b66ccbe3c27cf745cc7c7ccdbb6');
for(const mutate of [
 e=>{e.assetId=entries[1].assetId;},e=>{e.sourcePath=entries[1].sourcePath;},
 e=>{e.sourceSha256=entries[1].sourceSha256;},e=>{e.element='fire';},
 e=>{e.runtimePath='assets/shared.webp';},e=>{e.exclusive=true;},e=>{e.sourceImage.alpha=false;}
]){
 const next=structuredClone(registry);mutate(next.assetPool.entries.find(e=>e.assetClass==='shared-npc'));
 assert.ok(auditSharedPortraits(next).length,'audit rejects invalid shared entry');
}
const changed=structuredClone(registry);changed.assetPool.entries.find(e=>e.assetClass==='shared-npc').sourceSha256='a'.repeat(64);
assert.ok(auditSharedPortraits(changed,registry).some(e=>e.includes('reassigned')));
const removed=structuredClone(registry);removed.assetPool.entries=removed.assetPool.entries.filter(e=>e.assetId!=='NPC_SHARED_001');
assert.ok(auditSharedPortraits(removed,registry).some(e=>e.includes('removed historical')));
const reused=structuredClone(removed);reused.assetPool.entries.push({...entries[0],assetId:'NPC_SHARED_000'});
assert.ok(auditSharedPortraits(reused,registry).some(e=>e.includes('reused historical')));
const manifest=fs.readFileSync('asset-manifest.json','utf8');
for(const e of initial){assert.doesNotMatch(manifest,new RegExp(e.assetId));assert.equal(e.status,'reserved');assert.equal(e.runtimePath,undefined);}
console.log('Shared asset ID / provenance / immutable mapping / audit rejection / Runtime manifest isolation passed.');
