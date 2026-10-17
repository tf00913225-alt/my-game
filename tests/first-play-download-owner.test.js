'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const source=fs.readFileSync('js/startup/first-play-resource-loader.js','utf8');
const bytes=new TextEncoder().encode('verified resource');
const sha=createHash('sha256').update(bytes).digest('hex');
function fixture({corrupt=false,decodeFails=false,returning=false}={}){
 const paths=['build/code.123.js','build/style.123.css','assets/picture.123.png'];
 const resources=paths.map((path,i)=>({path,priority:'P'+i,bytes:bytes.length,sha256:sha,decode:i===2}));
 const pack={manifestHash:'pack',assetPackVersion:1,manifestVersion:1,resources};
 const storage=new Map(),requests=[],links=[],decoded=[];
 if(returning)storage.set('four_symbols_first_play_ready',JSON.stringify({manifestHash:'pack',assetPackVersion:1,assets:Object.fromEntries(paths.map(p=>[p,sha]))}));
 const c={console,Blob,URL,TextEncoder,crypto:webcrypto,CSS:{escape:x=>x},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{querySelector:()=>null,createElement:()=>({dataset:{}}),head:{appendChild:n=>links.push(n)}},
  Image:class{constructor(){this.naturalWidth=1;this.naturalHeight=1;}async decode(){decoded.push(this.src);if(decodeFails)throw Error('decode failed');}},
  fetch:async path=>{requests.push(path);if(path==='asset-manifest.json')return new Response(JSON.stringify({release:'test',firstPlay:pack}));
   return new Response(corrupt&&path===paths[0]?new Uint8Array(bytes.length):bytes,{headers:{'content-type':path.endsWith('.png')?'image/png':'text/plain'}});}};
 c.window=c;vm.runInNewContext(source,c);
 return {api:c.FourSymbolsFirstPlay,paths,requests,links,decoded,storage,repair(){corrupt=false;}};
}
(async()=>{
 const h=fixture(),progress=[];await h.api.prepare({onProgress:p=>progress.push(p)});
 for(const path of h.paths)assert.equal(h.requests.filter(p=>p===path).length,1);
 assert.equal(h.decoded.length,1,'the complete image decode gate remains');
 assert.equal(progress.at(-1).percent,100);
 assert.ok(h.storage.has('four_symbols_first_play_ready'));
 assert.equal(h.links.length,0,'verified resources must not trigger a second native preload download');
 const prior=fixture({returning:true});await prior.api.prepare();
 assert.equal(prior.links.length,3,'returning destination keeps its established native warm path');
 const bad=fixture({corrupt:true});await assert.rejects(bad.api.prepare(),/必要資源/);
 assert.equal(bad.storage.has('four_symbols_first_play_ready'),false,'bad digest cannot create completion');
 bad.repair();await bad.api.retryFailed();
 assert.equal(bad.requests.filter(p=>p===bad.paths[0]).length,2);
 assert.equal(bad.requests.filter(p=>p===bad.paths[1]).length,1,'retry retains verified successes');
 const image=fixture({decodeFails:true});await assert.rejects(image.api.prepare(),/必要資源/);
 assert.equal(image.storage.has('four_symbols_first_play_ready'),false,'decode failure cannot create completion');
 console.log('✓ First Play verifies every byte/decode without a duplicate preload; failures and retry stay closed');
})().catch(error=>{console.error(error);process.exitCode=1;});
