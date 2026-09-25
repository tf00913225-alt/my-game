import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateMigrationBackup}=require('../functions/src/cloud-save-policy.js');
const repoSource=fs.readFileSync(new URL('../js/startup/account-save-repository.js',import.meta.url),'utf8');
const clientSource=fs.readFileSync(new URL('../js/firebase/firebase-cloud-save.js',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const values=new Map();const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const context=vm.createContext({window:null,localStorage,Date,JSON,Error,Object,Array,String,WeakSet,Set,Map});context.window=context;
 vm.runInContext(repoSource,context);
 const repo=context.FourSymbolsAccountSave;
 repo.activate('uid-a');repo.writeForUid('uid-a',{version:6,player:{id:'hero',level:10},gold:200,sharedExp:50,inventoryItems:[]},{source:'gameplay'});
 for(const suffix of repo.BACKUP_SIDECARS){values.set(repo.accountKey(suffix,'uid-a'),suffix==='bulk-sell-quality'?'white':JSON.stringify({value:1}));}
 return {repo,values,context};
}
function bundle(backup){
 const {backupKey:backupId,ownerUid,mainFingerprint,sidecarManifestFingerprint,mainRaw,metadataRaw,sidecars}=backup;
 return {schemaVersion:2,backupId,ownerUid,mainFingerprint,sidecarManifestFingerprint,mainRaw,metadataRaw,sidecars,
  sidecarManifestSha256:sha(JSON.stringify(sidecars)),backupSha256:sha(JSON.stringify({ownerUid,mainRaw,metadataRaw,sidecars}))};
}
test('UID backup is the candidate source even when legacy key is stale; sealed bytes survive later play',()=>{
 const {repo,values}=fixture();values.set(repo.LEGACY_KEY,JSON.stringify({version:6,player:{id:'old',level:1},gold:0}));
 const first=repo.createMigrationBackup('uid-a');
 assert.equal(JSON.parse(first.mainRaw).gold,200);
 repo.writeForUid('uid-a',{version:6,player:{id:'hero',level:10},gold:500,sharedExp:50,inventoryItems:[]});
 assert.equal(JSON.parse(repo.verifyMigrationBackup('uid-a',first.backupKey).mainRaw).gold,200);
 assert.equal(validateMigrationBackup(bundle(first),'uid-a').snapshot.gold,200);
 assert.equal(JSON.parse(values.get(repo.LEGACY_KEY)).gold,0);
 const second=repo.createMigrationBackup('uid-a');assert.notEqual(second.backupKey,first.backupKey);
 assert.notEqual(bundle(second).backupSha256,bundle(first).backupSha256);
 const retry=repo.createMigrationBackup('uid-a');assert.equal(retry.unchanged,true);
});
test('changed sidecars form a new revision; missing or corrupt records cannot be silently accepted',()=>{
 const {repo,values}=fixture();const first=repo.createMigrationBackup('uid-a');
 values.set(repo.accountKey('progress','uid-a'),JSON.stringify({claimed:true}));
 const second=repo.createMigrationBackup('uid-a');assert.notEqual(second.backupKey,first.backupKey);
 assert.equal(repo.verifyMigrationBackup('uid-a',first.backupKey).sidecars.progress.raw,JSON.stringify({value:1}));
 const absent={...bundle(second),sidecars:{...second.sidecars}};delete absent.sidecars.progress;
 assert.throws(()=>validateMigrationBackup(absent,'uid-a'),/sidecar inventory/);
 values.set(second.backupKey,'{corrupt');assert.throws(()=>repo.verifyMigrationBackup('uid-a',second.backupKey),e=>e.code==='migration-backup-corrupt');
 values.set(repo.accountKey('progress','uid-a'),'{bad');assert.throws(()=>repo.createMigrationBackup('uid-a'),e=>e.code==='migration-backup-sidecar-corrupt');
});
test('UID mismatch and changed raw bytes/digests fail closed',()=>{
 const {repo}=fixture(),backup=repo.createMigrationBackup('uid-a'),source=bundle(backup);
 assert.throws(()=>validateMigrationBackup(source,'uid-b'),/UID-owned backup/);
 assert.throws(()=>validateMigrationBackup({...source,mainRaw:source.mainRaw.replace('200','900')},'uid-a'),/SHA-256/);
 assert.throws(()=>validateMigrationBackup({...source,sidecars:{...source.sidecars,progress:{status:'missing',raw:null}}},'uid-a'),/SHA-256/);
 repo.activate('uid-b');assert.throws(()=>repo.verifyMigrationBackup('uid-a',backup.backupKey),e=>e.code==='account-not-active');
});
test('client submission requires a selected verified backup and sends only sealed raw bytes',async()=>{
 const {repo,values}=fixture();const backup=repo.createMigrationBackup('uid-a');
 const start=clientSource.indexOf('export async function submitLegacyMigrationCandidate(options={}){');
 const end=clientSource.indexOf('/* Creates an explicit immutable UID backup',start);
 assert.ok(start>=0&&end>start);
 const calls=[];let uid='uid-a';const context={requireSignedInUid:()=>uid,window:{FourSymbolsAccountSave:repo,crypto:webcrypto},
  TextEncoder,Uint8Array,Promise,Object,String,callTrustedFunction:async(name,payload)=>{calls.push({name,payload});return {ok:true};}};
 const shaSource=clientSource.slice(clientSource.indexOf('async function sha256(raw){'),clientSource.indexOf('async function callTrustedFunction('));
 vm.runInNewContext(shaSource+clientSource.slice(start,end).replace('export async function','async function'),context);
 await assert.rejects(context.submitLegacyMigrationCandidate(),e=>e.code==='migration-backup-owner-mismatch');
 values.set(repo.LEGACY_KEY,JSON.stringify({gold:99999}));
 await context.submitLegacyMigrationCandidate({backupKey:backup.backupKey,expectedRevision:2});
 assert.equal(calls[0].payload.backup.mainRaw,backup.mainRaw);
 assert.equal(validateMigrationBackup(JSON.parse(JSON.stringify(calls[0].payload.backup)),'uid-a').snapshot.gold,200);
 uid='uid-b';await assert.rejects(context.submitLegacyMigrationCandidate({backupKey:backup.backupKey}),e=>e.code==='ACCOUNT_CHANGED');
});
