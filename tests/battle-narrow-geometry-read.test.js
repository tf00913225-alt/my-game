"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
test("narrow artwork/HUD reads equal full official projections without measuring unrelated surfaces or retaining a stale cache",()=>{
 const source=fs.readFileSync("js/battlefield-render-geometry-adapter.js","utf8");let reads=0,styles=0,resources=0;
 const r=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const cardRect=r(18,55,80,100),paintRect=r(12,40,110,150);
 const paint={style:{},getBoundingClientRect(){reads++;return paintRect;}};
 const art={classList:{contains:()=>false},querySelector:()=>paint,getBoundingClientRect(){reads++;return cardRect;}};
 const hud={dataset:{},querySelectorAll:()=>[],querySelector:()=>null};
 const card={querySelector:()=>art,closest:()=>null,getBoundingClientRect(){reads++;return cardRect;},offsetWidth:160,offsetHeight:200};
 const paintStyle={backgroundImage:'url("first.webp")',backgroundSize:"contain",backgroundPosition:"center bottom",backgroundRepeat:"no-repeat"},cardStyle={width:"160px",height:"200px"};
 const context={document:{getElementById:id=>id==="battleMonster0"?card:null},window:{getComputedStyle(n){styles++;return n===paint?paintStyle:cardStyle;},FourSymbolsBattlePresentation:{getUnitHud:()=>hud}},
  slots:{getSlotRect:()=>cardRect},slotForElement:()=>"ENEMY_F1",resourceStateFor(){resources++;return null;},projectionFor:()=>null,Math,Number,String,Array,parseFloat};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf("    function plainRect("),source.indexOf("    function battlefieldOverlayGeometry("))+
  source.slice(source.indexOf("    function artworkProjectionFor("),source.indexOf("    function geometryForVfx(")),context);
 const full=context.unitGeometry("monster",0),fullReads=reads;reads=styles=resources=0;
 const status=context.unitGeometry("monster",0,"status");
 for(const key of Object.keys(status))assert.equal(JSON.stringify(status[key]),JSON.stringify(full[key]),"same formal status projection "+key);
 assert.equal(resources,0,"status does not compute HP/SP ratios");assert.equal(status.feedbackSafeRect,undefined);
 reads=styles=resources=0;
 const artwork=context.artworkForUnit("monster",0);assert.equal(JSON.stringify(artwork),JSON.stringify(full.artworkProjection));
 assert.equal(reads,1);assert.equal(styles,1);assert.equal(resources,0,"artwork never computes resources/HUD");
 reads=styles=0;const surface=context.hudForUnit("monster",0);assert.equal(JSON.stringify(surface),JSON.stringify(full.hudSurface));
 assert.equal(reads,1);assert.equal(styles,1);assert.equal(resources,0);assert.ok(fullReads>2);
 paint.style.backgroundImage='url("second.webp")';assert.equal(context.artworkForUnit("monster",0).backgroundImage,paint.style.backgroundImage);
 cardStyle.width="320px";assert.equal(context.hudForUnit("monster",0).scaleX,.25,"next call observes live geometry");
 assert.equal(context.artworkForUnit("monster",99),null);assert.equal(context.hudForUnit("monster",.5),null);
});

test("raster preparation snapshot reuses only formal reads inside the synchronous emit stack",()=>{
 const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8");let calls=0,revision=1;
 const current={targetSide:"monster",side:"player",actorIndex:0,config:{}},context={window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(s,i){calls++;return {artworkProjection:{revision,side:s,index:i}};},getArtworkProjection(s,i){calls++;return {revision,side:s,index:i};}}},
  activeCards:()=>[{index:0},{index:1}],cardFor:()=>({}),slotAnchor:()=>({x:10,y:20}),Map};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf("    function rasterUnitGeometry("),source.indexOf("    function slotAnchor(")),context);
 current.rasterReadSnapshot=context.captureRasterReads(current);assert.equal(calls,3);revision=2;
 assert.equal(context.rasterArtwork(current,"monster",0).revision,1);context.rasterUnitGeometry(current,"monster",1);assert.equal(calls,3);
 current.rasterReadSnapshot=null;assert.equal(context.rasterArtwork(current,"monster",0).revision,2);assert.equal(calls,4);
 assert.match(source,/try\{current.targetIndexes.slice\(\).forEach\(index=>emitSprite\(current,index\)\);\}\s*finally\{current.rasterReadSnapshot=null;\}/);
});
