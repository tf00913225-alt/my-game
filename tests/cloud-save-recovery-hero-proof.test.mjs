import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createSessionAuthority}=require('../functions/src/session-authority');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
const {classifyRetainedCanonicalOperation}=require('../functions/src/canonical-operation-classifier');

test('a genuine Hero login is retained recovery evidence while canonical and envelope revisions differ',async()=>{
    const h=storeHarness(),sessions=createSessionAuthority(h.dependencies);
    let session;
    const request=()=>({auth:{uid:h.uid,token:{auth_time:Math.floor(h.clock/1000)}},
        data:{uid:h.uid,...(session?{session}:{})}});
    session=await sessions.create(request());
    const deps={...h.dependencies,runProtected:sessions.runProtected};
    await createCanonicalSourceWriter(deps).commitInitialSources(request(),{
        operationId:'hero-proof-initial-operation-01',expectedRevision:1,selection});
    await createHeroAcquisition({...deps,now:()=>h.clock,seed:()=>1}).observeLogin({
        ...request(),data:{...request().data,expectedRevision:h.revision}});
    assert.equal(h.revision,3);
    assert.equal(h.data.get(h.root+'/account/current').serverRevision,2);
    assert.equal(h.data.has(h.root+'/recoveryArchives/2'),true);
    assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false,'an observation does not fabricate an archive');
    const operations=[...h.data].filter(([path,row])=>path.startsWith(h.root+'/operations/')&&row.kind==='hero-login-observation');
    assert.equal(operations.length,1);
    const [path,row]=operations[0],before=copy([...h.data]),writes=h.writes;
    const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
    assert.equal(classifyRetainedCanonicalOperation(row,path.split('/').at(-1),h.uid,h.revision,fail),'hero');
    assert.deepEqual([...h.data],before);
    assert.equal(h.writes,writes);
});
