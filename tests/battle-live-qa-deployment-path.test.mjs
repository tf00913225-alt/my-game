import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {battleSkillTouchFloodQa} from '../.github/scripts/battle-skill-touch-flood-qa.mjs';

// Exercise the real QA helper's asset verification before battle fixture setup.
// A deliberately unavailable fixture ends the call only after hash/SHA assertions.
const fixtureStop=new Error('asset verification completed; no battle fixture');
async function verify(base,{corrupt=false,wrongSha=false}={}){
  const requests=[];let calls=0;
  const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'';
  const prefix=new URL('.',base);
  const client={eval(expression){
    if(calls++>0)return Promise.reject(fixtureStop);
    return vm.runInNewContext(expression,{
      document:{baseURI:base},location:new URL(base),URL,crypto:crypto.webcrypto,
      fetch:async url=>{
        requests.push(String(url));
        const relative=String(url).startsWith(prefix.href)?String(url).slice(prefix.href.length):null;
        if(!relative)return new Response('wrong deployment path',{status:404});
        if(relative==='release-manifest.json')return Response.json({commitSha:wrongSha?'incorrect':expected});
        if(!fs.existsSync(relative))return new Response('missing',{status:404});
        const bytes=corrupt&&relative.startsWith('build/')?Buffer.from('changed bundle'):fs.readFileSync(relative);
        return new Response(bytes);
      }
    }).then(result=>JSON.parse(JSON.stringify(result))); // CDP returnByValue boundary.
  }};
  let error;try{await battleSkillTouchFloodQa(client,'/tmp');}catch(e){error=e;}
  return {requests,calls,error};
}
for(const base of ['https://dev.four-symbols-dev.pages.dev/','https://tf00913225-alt.github.io/my-game/','http://127.0.0.1:4173/my-game/index.html']){
  test('real battle QA verifies deployed assets under '+base,async()=>{
    const result=await verify(base);
    assert.equal(result.error,fixtureStop);
    assert.equal(result.calls,2);
    assert.ok(result.requests.length>2);
    assert.ok(result.requests.every(url=>url.startsWith(new URL('.',base).href)));
    if(base.startsWith('https:'))assert.ok(result.requests.some(url=>url.endsWith('/release-manifest.json')));
  });
}
test('mounted battle QA still rejects corrupt served bundles',async()=>{
  const result=await verify('https://tf00913225-alt.github.io/my-game/',{corrupt:true});
  assert.match(result.error.message,/served bundles and original atlas/);
  assert.equal(result.calls,1);
});
test('production battle QA rejects wrong deployment SHA',async()=>{
  const result=await verify('https://tf00913225-alt.github.io/my-game/',{wrongSha:true});
  assert.notEqual(result.error,fixtureStop);
  assert.equal(result.error.code,'ERR_ASSERTION');
  assert.equal(result.calls,1);
});
