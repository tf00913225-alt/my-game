"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
function setup(){
 const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8"),config=JSON.parse(fs.readFileSync("config/battle-vfx-feedback.json","utf8"));
 function animation(state="running"){return {playState:state,playbackRate:1,pause(){this.playState="paused";},play(){this.playState="running";},cancel(){this.playState="idle";}};}
 function node(){const classes=new Set();return {style:{},dataset:{},isConnected:true,children:[],tracks:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},setAttribute(){},appendChild(n){this.children.push(n);},remove(){this.isConnected=false;},getAnimations(){return this.tracks;},animate(frames,options){const a=animation();a.frames=frames;a.options=options;this.tracks.push(a);return a;}};}
 const paint=node(),idle=animation(),manualPause=animation("paused");paint.tracks.push(idle,manualPause);
 const art=node();art.querySelector=()=>paint;const card={querySelector:()=>art},entity={hp:100,alive:true};
 let projection={rect:{left:10,top:20,width:60,height:90},backgroundImage:"url(old.webp)",backgroundSize:"contain",backgroundPosition:"center",backgroundRepeat:"no-repeat"};
 let reduced=false;const released=[],body=node(),api={acquire:node,release(k,n){n.remove();released.push(n);},occlusionTrack:()=>[{opacity:1},{opacity:0}],fieldSwayTrack:()=>[{transform:"rotate(0deg)"},{transform:"rotate(4deg)"}]};
 const current={duration:2600,visualStartedAt:1000,targetIndexes:[0],targetSide:"monster",sequence:1,hitRanks:new Map([[0,0]]),hitFeedback:{config:{fieldScene:config.fieldScene,referenceDamage:168,criticalScale:1.25},replaceTrack(){}}};
 const context={window:{matchMedia:()=>({matches:reduced}),FourSymbolsHitFeedback:api,FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry:()=>({artworkProjection:projection})}},document:{body,createElement:node},state:{current},cardFor:()=>card,entityFor:()=>entity,Date:{now:()=>1000},Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf("    function clearFieldScene("),source.indexOf("    function createImpactFlash(")),context);
 return {context,current,paint,art,card,entity,idle,manualPause,released,body,setProjection(p){projection=p;},getProjection:()=>projection,setReduced(v){reduced=v;}};
}
test("temporary field planes use exact source without cloning cards/HUD and restore only their own pauses",()=>{
 const h=setup();h.context.startFieldScene(h.current);const e=h.current.fieldScene.entries.get(0);
 assert.equal(h.body.children.length,2);assert.equal(e.nodes.length,2);assert.equal(h.paint.classList.contains("v143-field-source-hidden"),true);
 assert.equal(h.idle.playState,"paused");assert.equal(h.manualPause.playState,"paused");
 assert.equal(e.nodes[0].style.backgroundImage,"url(old.webp)");assert.equal(e.nodes[0].style.width,"60px");
 h.context.reactFieldScene(h.current,99,100,false);assert.equal(e.reacted,false);
 h.context.reactFieldScene(h.current,0,100,false);assert.equal(e.reacted,true);assert.equal(e.tracks.length,4);
 h.context.reactFieldScene(h.current,0,100,false);assert.equal(e.tracks.length,4,"one reaction per owned recipient");
 h.context.clearFieldScene(h.current);assert.equal(h.current.fieldScene,null);assert.equal(h.idle.playState,"running");assert.equal(h.manualPause.playState,"paused");
 assert.equal(h.paint.classList.contains("v143-field-source-hidden"),false);assert.equal(e.hidden.playState,"idle");assert.equal(h.released.length,2);
 h.context.clearFieldScene(h.current);assert.equal(h.released.length,2,"idempotent scene cleanup");
});
test("same-entity source changes update both complete projections; dead or replaced entities cannot retain a ghost",()=>{
 const h=setup();h.context.startFieldScene(h.current);const e=h.current.fieldScene.entries.get(0);
 h.setProjection({...h.getProjection(),backgroundImage:"url(new.webp)",backgroundSize:"120px 180px",rect:{left:15,top:25,width:70,height:100}});
 h.context.syncFieldScene(h.current);for(const n of e.nodes){assert.equal(n.style.backgroundImage,"url(new.webp)");assert.equal(n.style.backgroundSize,"120px 180px");assert.equal(n.style.left,"15px");}
 h.entity.hp=0;h.context.syncFieldScene(h.current);assert.equal(h.current.fieldScene.entries.size,0);assert.equal(e.hidden.playState,"idle");assert.equal(h.released.length,2);
});
test("unavailable or replaced paint fails closed; reduced motion creates no cloned planes",()=>{
 const h=setup();h.setReduced(true);h.context.startFieldScene(h.current);assert.equal(h.current.fieldScene,undefined);assert.equal(h.idle.playState,"running");
 h.setReduced(false);h.context.startFieldScene(h.current);h.setProjection({...h.getProjection(),backgroundImage:"none"});h.context.syncFieldScene(h.current);
 assert.equal(h.current.fieldScene.entries.size,0);assert.equal(h.paint.classList.contains("v143-field-source-hidden"),false);
 const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");assert.match(css,/body\.v174-battle-reading-open \.v143-field-portrait-plane\{display:none!important/);
 assert.match(css,/body\.v174-battle-reading-open \.v143-field-source-hidden\{opacity:1!important/);
});

test("field sync finishes every geometry read before any projection write and skips identical style updates",()=>{
 const a=setup(),b=setup();a.context.startFieldScene(a.current);b.context.startFieldScene(b.current);
 const entries=[a.current.fieldScene.entries.get(0),b.current.fieldScene.entries.get(0)],events=[];
 a.current.fieldScene.entries.set(1,entries[1]);
 a.context.cardFor=(_s,i)=>[a.card,b.card][i];a.context.entityFor=(_s,i)=>[a.entity,b.entity][i];
 a.context.window.FourSymbolsBattlefieldRenderGeometry.getUnitGeometry=(_s,i)=>{events.push("read"+i);return {artworkProjection:{...a.getProjection(),rect:{left:30+i,top:40,width:60,height:90}}};};
 entries.forEach((entry,i)=>entry.nodes.forEach(node=>{node.style=new Proxy({...node.style},{set(target,k,v){events.push("write"+i);target[k]=v;return true;}});}));
 a.context.syncFieldScene(a.current);assert.deepEqual(events.slice(0,2),["read0","read1"]);assert.ok(events.slice(2).every(e=>e.startsWith("write")));
 events.length=0;a.context.syncFieldScene(a.current);assert.deepEqual(events,["read0","read1"]);
});
