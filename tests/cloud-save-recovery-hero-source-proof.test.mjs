import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
const {snapshotDigest:digest}=require('../functions/src/canonical-snapshot');
async function fixture(retained=false){
 const h=storeHarness();await h.initial.commitInitialSources(h.request(),{operationId:'hero-source-initial-0001',expectedRevision:1,selection});
 let factory=createHeroAcquisition;
 if(retained){
  const Module=require('node:module'),load=(filename,substitute)=>{const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(require('node:path').dirname(filename));const native=m.require.bind(m);m.require=name=>Object.hasOwn(substitute,name)?substitute[name]:native(name);m._compile(fs.readFileSync(filename,'utf8'),filename);return m.exports;};
  const chapter=load(require.resolve('../functions/src/hero-chapter-source'),{'./generated/hero-chapter-qualification.json':require(retained==='story-v2'?'../functions/src/generated/hero-chapter-qualification-v2-20261020.json':'../functions/src/generated/hero-chapter-qualification-v1.json')});
  factory=load(require.resolve('../functions/src/hero-acquisition'),{'./hero-chapter-source':chapter}).createHeroAcquisition;
 }
 const hero=factory({...h.dependencies,seed:()=>123});
 const request=extra=>({...h.request(),data:{...h.request().data,...extra}});
 for(let i=0;i<7;i++){await hero.observeLogin(request({expectedRevision:h.revision}));h.advance(86400000);}
 await hero.ensureChapterTicket(request({expectedRevision:h.revision}));
 // Retain an unused expired ticket, then a second ticket with a real prefix.
 h.advance(7*86400000);await hero.ensureChapterTicket(request({expectedRevision:h.revision}));
 for(let i=0;;i++){
  const state=await hero.read(h.request());if(state.chapter.phase==='completed')break;
  if(i===3){h.advance(7*86400000);await hero.ensureChapterTicket(request({expectedRevision:h.revision}));continue;}
  const policy= h.data.get(h.root+'/heroChapterTickets/'+state.chapter.ticketId).policy;
  const node=policy.nodes.find(n=>n.id===state.chapter.nextNodeId);
  await hero.completeChapterNode(request({expectedRevision:h.revision,ticketId:state.chapter.ticketId,nodeId:state.chapter.nextNodeId,choiceId:node.type==='branch'?node.branches[0].id:null}));
 }
 return {h,hero};
}
async function proof(f,canonicalRevision=2){
 const {h,hero}=f,scope={root:h.dependencies.db.collection('serverUsers').doc(h.uid),uid:h.uid,
  envelopeRevision:h.revision,canonicalRevision,captureSha256:'a'.repeat(64)};
 const counts=[];
 const unit=async method=>h.dependencies.db.runTransaction(async tx=>{let reads=0;const result=await method({get:async ref=>{const snap=await tx.get(ref);reads+=ref.query?Math.max(1,snap.size):1;return snap;}});counts.push(reads);return result;});
 const inventory=Object.fromEntries(['heroAcquisition','heroAcquisitionHistory','heroChapter','heroChapterTickets','heroChapterSteps'].map(name=>[name,[...h.data.keys()].filter(p=>p.startsWith(h.root+'/'+name+'/')).map(p=>p.split('/').at(-1))]));
 const login=await unit(tx=>hero.verifyRetainedLogin(tx,scope)),head=await unit(tx=>hero.verifyRetainedChapterHead(tx,scope)),tickets=[],steps=[];
 for(const id of inventory.heroChapterTickets)tickets.push(await unit(tx=>hero.verifyRetainedChapterTicket(tx,scope,id)));
 for(const id of inventory.heroChapterSteps)steps.push(await unit(tx=>hero.verifyRetainedChapterStep(tx,scope,id)));
 const input={login,head,tickets,steps,inventory};return {input,counts,result:hero.closeRetainedEvidence(input)};
}
test('real seven-login and twenty-step route including unused renewal close within independent unit read bounds',async()=>{
 const f=await fixture(),before=copy([...f.h.data]),writes=f.h.writes,{input,counts,result}=await proof(f);
 assert.equal(input.steps.length,20);assert.equal(input.tickets.length,3);assert.equal(counts[0],38);assert.equal(counts[1],3);
 assert.deepEqual(counts.slice(2,5),[3,3,3]);assert.ok(counts.slice(5).every(n=>n===6));
 assert.equal(result.entitlements.length,2);for(const row of result.entitlements)assert.deepEqual(Object.keys(row).sort(),['allocationSeed','claimKey','grantedRevision','heroId','sourceId']);
 assert.equal(result.operationIds.length,30);assert.deepEqual(result.operationIds,result.ledgerIds);assert.equal(result.claimIds.length,2);
 assert.equal(result.canonicalRevision,2);assert.equal(result.envelopeRevision,f.h.revision);assert.equal(f.h.data.has(f.h.root+'/recoveryArchives/3'),false);
 assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
});
test('lawfully earned Hero rights and a complete initial projection do not certify playable adoption',async()=>{
 const f=await fixture(),before=copy([...f.h.data]),writes=f.h.writes;
 const {result}=await proof(f),{h}=f;
 const archive=h.data.get(h.root+'/recoveryArchives/2');
 assert.ok(archive?.sourceRecords,'use the original writer archive, not hand-built player sources');
 const {assembleCanonicalPlayableProjection}=require('../functions/src/canonical-snapshot');
 const bundle=assembleCanonicalPlayableProjection(h.uid,2,archive.sourceRecords);
 assert.equal(result.entitlements.length,2,'rights come from original login/chapter operations');
 assert.equal(result.claimIds.length,2);
 assert.equal(result.canonicalRevision,2);
 assert.equal(result.envelopeRevision,h.revision);
 assert.ok(result.envelopeRevision>result.canonicalRevision);
 const {createHeroGrowth}=require('../functions/src/hero-growth');
 const current=await createHeroGrowth({...h.dependencies,acquisition:f.hero}).read(h.request());
 assert.equal(current.serverRevision,result.envelopeRevision);
 // Structural completeness at the canonical cut cannot silently import later
 // rights, replay claims or authorize a public save. The existing growth Owner
 // resolves those rights; a future admission must bind that result to its cut.
 for(const grant of result.entitlements){
  assert.equal(bundle.projection.gameSave.heroAccount.heroes[grant.heroId].unlocked,false);
  assert.equal(current.heroAccount.heroes[grant.heroId].unlocked,true);
 }
 assert.equal(archive.sourceRecords.claimRecords.length,0);
 assert.equal(bundle.readyForPublication,false);
 assert.equal(bundle.projection.authoritativeStateReady,false);
 assert.equal(archive.readyForRestore,false);
 assert.equal(h.data.get(h.save).authoritativeStateReady,false);
 assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
});

test('original earned login reward materializes Hero rights into one canonical cut without reopening claims',async()=>{
 const f=await fixture(),{h}=f;
 const {createHeroGrowth}=require('../functions/src/hero-growth');
 const growth=createHeroGrowth({...h.dependencies,acquisition:f.hero});
 const intent={...h.request(),data:{...h.request().data,operationId:'hero-login-reward-v1-day3',
  expectedRevision:h.revision,milestoneDay:3}};
 const earned=await growth.claimLoginReward(intent);
 const archive=h.data.get(h.root+'/recoveryArchives/'+earned.serverRevision);
 const {assembleCanonicalPlayableProjection}=require('../functions/src/canonical-snapshot');
 const bundle=assembleCanonicalPlayableProjection(h.uid,earned.serverRevision,archive.sourceRecords);
 const before=copy([...h.data]),writes=h.writes,{result}=await proof(f,earned.serverRevision);
 assert.equal(result.canonicalRevision,earned.serverRevision);
 assert.equal(result.envelopeRevision,earned.serverRevision);
 for(const grant of result.entitlements){
  assert.equal(bundle.projection.gameSave.heroAccount.heroes[grant.heroId].unlocked,true);
 }
 // Hero reward receipts belong to uniqueClaims, not canonical claimRecords.
 // This proves original-Owner replay protection, not full recovery closure.
 assert.equal(archive.sourceRecords.claimRecords.length,0);
 for(const collection of ['operations','ledgerEntries','uniqueClaims']){
  assert.deepEqual(h.data.get(h.root+'/'+collection+'/'+intent.data.operationId).intent,earned.receipt.intent);
 }
 const replay=await growth.claimLoginReward(intent);
 assert.equal(replay.unchanged,true);
 assert.deepEqual(replay.receipt,earned.receipt);
 assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
 assert.equal(bundle.readyForPublication,false);
 assert.equal(bundle.projection.authoritativeStateReady,false);
 assert.equal(archive.readyForRestore,false);
});

test('full closure rejects missing, orphan, duplicate, foreign-capture, renewal and reordered route summaries',async()=>{
 const f=await fixture(),{input}=await proof(f);
 for(const mutate of [x=>x.tickets.shift(),x=>x.steps.pop(),x=>x.steps.push(x.steps[0]),x=>x.inventory.heroChapterSteps.push('orphan-step'),
  x=>x.tickets[0].captureSha256='b'.repeat(64),x=>x.tickets[1].startingStepSha256='b'.repeat(64),
  x=>x.head.marker.steps.reverse(),x=>x.head.claim.allocationSeed++,x=>x.inventory.heroAcquisitionHistory.pop(),
  x=>x.tickets[2].startingStepCount=0]){
  const changed=copy(input);mutate(changed);assert.throws(()=>f.hero.closeRetainedEvidence(changed),e=>e.code==='data-loss');
 }
});
test('retained units reject missing receipt and canonically resealed unknown policy without writes',async()=>{
 const f=await fixture(),ticketPath=[...f.h.data.keys()].find(p=>p.startsWith(f.h.root+'/heroChapterTickets/'));
 const ticket=f.h.data.get(ticketPath),op=f.h.root+'/operations/'+ticket.operationId,old=f.h.data.get(op);f.h.data.delete(op);
 const before=copy([...f.h.data]),writes=f.h.writes;await assert.rejects(proof(f),e=>e.code==='data-loss');assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);f.h.data.set(op,old);
 ticket.policy.nodes[0].description='unknown sealed policy';ticket.policySha256=digest(ticket.policy);const {sha256,createdAt,updatedAt,...body}=ticket;ticket.sha256=digest(body);
 for(const name of ['operations','ledgerEntries'])f.h.data.get(f.h.root+'/'+name+'/'+ticket.operationId).sourceSha256=ticket.sha256;
 await assert.rejects(proof(f),e=>e.code==='data-loss');
});

test('retained V1 route and renewal use the same unit and full-closure Owner',async()=>{
 const f=await fixture(true),before=copy([...f.h.data]),{input,counts,result}=await proof(f);
 assert.equal(input.steps.length,10);assert.equal(input.tickets.length,3);assert.equal(result.entitlements.length,2);assert.ok(counts.every(n=>n<=38));assert.deepEqual([...f.h.data],before);
});


test('retained published twenty-node policy closes unchanged original history after the current catalogue changes',async()=>{
 const f=await fixture('story-v2'),before=copy([...f.h.data]),writes=f.h.writes,{input,counts,result}=await proof(f);
 assert.equal(input.steps.length,20);assert.equal(input.tickets.length,3);assert.equal(result.entitlements.length,2);
 assert.ok(counts.every(n=>n<=38));assert.deepEqual([...f.h.data],before);assert.equal(f.h.writes,writes);
 const policy=require('../functions/src/generated/hero-chapter-qualification-v2-20261020.json');
 assert.notEqual(digest(policy),digest(require('../functions/src/generated/hero-chapter-qualification.json')));
 for(const [,row] of f.h.data)if(row.kind==='hero-chapter-ticket'&&row.policy)assert.deepEqual(row.policy,policy);
});

