"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
test("formal syncHud keeps same real HUD nodes without reparenting and replaces disconnected units normally",()=>{
 const source=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");let moves=0,reads=0;const moveReadCounts=[];
 const make=()=>({children:[],style:{},classList:{contains:()=>false},appendChild(n){this.insertBefore(n,null);},insertBefore(n,next){moves++;moveReadCounts.push(reads);if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);const index=next?this.children.indexOf(next):this.children.length;this.children.splice(index,0,n);n.parentNode=this;},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}});
 const body=make(),cards=[0,1].map(i=>({id:"battleMonster"+i,isConnected:true})),huds=cards.map((card,i)=>Object.assign(make(),{dataset:{index:String(i)},v174Card:card}));
 const page={classList:{contains:n=>n==="active"},querySelectorAll:()=>cards};
 const context={document:{body,getElementById:()=>page,querySelector:()=>({}),createElement:make},window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(s,i){reads++;return {hudSurface:{rect:{left:i*80,top:10,width:60,height:30},width:60,height:30,scaleX:1,scaleY:1}};}}},battleActive:true,
  prepareUnitHud:card=>huds[cards.indexOf(card)],clearUnitHud(){throw Error("active cast must preserve HUD");}};
 cards.forEach(c=>c.classList={contains:()=>false});vm.createContext(context);vm.runInContext("let hudLayer=null;\n"+source.slice(source.indexOf("let hudBatchDepth="),source.indexOf("function syncResourceNumbers(){")),context);
 context.syncHud();const initial=moves,layer=vm.runInContext("hudLayer",context);assert.equal(layer.children.length,2);
 cards[0].classList={contains:name=>name==="dead"};cards[1].classList={contains:name=>name==="down"};context.syncHud();assert.equal(huds[0].style.opacity,1,"defeated enemy HUD stays readable");assert.equal(huds[1].style.opacity,1,"downed ally HUD stays readable");cards.forEach(c=>c.classList={contains:()=>false});
 assert.ok(moveReadCounts.every(count=>count===2),"all geometry reads finish before any HUD layer move");
 for(let i=0;i<25;i++)context.syncHud();assert.equal(moves,initial,"same-parent updates perform no DOM moves");assert.deepEqual(layer.children,huds);assert.equal(huds[1].style.left,"80px");
 const beforeBatch=reads;const value=context.batchHud(()=>{context.syncHud();context.batchHud(()=>context.syncHud());assert.equal(reads,beforeBatch,"no intermediate geometry projection");return 7;});
 assert.equal(value,7);assert.equal(reads,beforeBatch+2,"nested synchronous hit batch projects once before returning");
 assert.throws(()=>context.batchHud(()=>{context.syncHud();throw Error("callback");}),/callback/);
 const afterThrow=reads;context.syncHud();assert.equal(reads,afterThrow+2,"throwing callbacks cannot leave HUD batching enabled");
 cards[0].isConnected=false;const old=huds[0];cards[0]={id:"battleMonster0",isConnected:true,classList:{contains:()=>false}};huds[0]=Object.assign(make(),{dataset:{index:"0"},v174Card:cards[0]});context.syncHud();
 assert.equal(old.parentNode,null);assert.deepEqual(layer.children,huds,"re-entry preserves original document order and node identities");assert.equal(layer.children.length,2);
});
