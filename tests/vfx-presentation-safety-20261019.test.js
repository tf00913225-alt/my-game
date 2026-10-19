const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const animation=fs.readFileSync(path.join(root,"js/39-v143-skill-animation.js"),"utf8");
const presentation=fs.readFileSync(path.join(root,"js/54-v173.51-battle-qa.js"),"utf8");
function functionSource(source,name,next){
    const start=source.indexOf("function "+name+"(");
    const end=source.indexOf("function "+next+"(",start);
    assert.ok(start>=0&&end>start,"production function boundaries exist");
    return source.slice(start,end);
}
const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height,centerX:left+width/2,centerY:top+height/2});
function fitRuntime(side,overlay){
    const context={window:{FourSymbolsBattlefieldRenderGeometry:{getBattlefieldOverlayGeometry:()=>({rect:overlay})}},
        geometryOwner:()=>({getSideRect:()=>side}),Math,parseFloat,String,clamp:(v,min,max)=>Math.max(min,Math.min(max,v))};
    vm.createContext(context);
    vm.runInContext(functionSource(animation,"fitRangeArt","emittedSpriteTargets"),context);
    return context.fitRangeArt;
}
function assertInside(node,center,safe){
    const width=parseFloat(node.style.width),height=parseFloat(node.style.height);
    assert.ok(center.x-width/2>=safe.left-1e-8);
    assert.ok(center.x+width/2<=safe.right+1e-8);
    assert.ok(center.y-height/2>=safe.top-1e-8);
    assert.ok(center.y+height/2<=safe.bottom+1e-8);
}
test("range artwork fits the visible target side without changing aspect, target anchor or semantic bounds",()=>{
    const side=rect(10,10,400,240),overlay=rect(30,20,360,210);
    const center={x:210,y:130},bounds=rect(10,10,400,240);
    const node={style:{width:"600px",height:"300px",left:"210px",top:"130px"},dataset:{targetIndexes:"0,2,4",geometrySlots:"B1,B2,B3"}};
    const before=JSON.stringify({center,bounds,targets:node.dataset.targetIndexes,slots:node.dataset.geometrySlots});
    fitRuntime(side,overlay)(node,{targetSide:"monster"},bounds,center);
    assertInside(node,center,rect(30,20,360,210));
    assert.equal(parseFloat(node.style.width)/parseFloat(node.style.height),2);
    assert.equal(node.style.left,"210px");assert.equal(node.style.top,"130px");
    assert.equal(node.dataset.semanticWidth,"400");assert.equal(node.dataset.semanticHeight,"240");
    assert.equal(JSON.stringify({center,bounds,targets:node.dataset.targetIndexes,slots:node.dataset.geometrySlots}),before);
});
test("an edge tri anchor retains its center and footprint while fitting proportionally; small artwork is not enlarged",()=>{
    const safe=rect(0,0,360,300),fit=fitRuntime(safe,safe);
    const center={x:60,y:70},bounds=rect(0,0,360,100);
    const node={style:{width:"360px",height:"180px"},dataset:{}};
    fit(node,{targetSide:"player"},bounds,center);
    assertInside(node,center,safe);
    assert.equal(parseFloat(node.style.width)/parseFloat(node.style.height),2);
    assert.equal(node.dataset.semanticWidth,"360");assert.equal(node.dataset.semanticHeight,"100");
    const small={style:{width:"40px",height:"20px"},dataset:{}};
    fit(small,{targetSide:"player"},bounds,center);
    assert.equal(small.style.width,"40px");assert.equal(small.style.height,"20px");
});
test("low group art uses the visible side with minimal translation instead of shrinking to one slot",()=>{
    const safe=rect(0,0,360,300),center={x:180,y:240},bounds=rect(0,180,360,120);
    const node={style:{width:"360px",height:"360px"},dataset:{targetIndexes:"0,1,2"}};
    const semantic=JSON.stringify(bounds);
    fitRuntime(safe,safe)(node,{targetSide:"monster"},bounds,center,true);
    assert.equal(parseFloat(node.style.width),300);
    assert.equal(parseFloat(node.style.height),300);
    assert.equal(center.x,180);assert.equal(center.y,150);
    assertInside(node,center,safe);
    assert.equal(node.dataset.targetIndexes,"0,1,2");assert.equal(JSON.stringify(bounds),semantic);
});
test("tri geometry is the canonical three-slot footprint regardless of surviving target indexes",()=>{
    const footprint=rect(0,20,360,120);footprint.slots=["F1","F2","F3"];
    const calls=[];
    const owner={getGeometryRectFromShape(side,slot,shape){calls.push({side,slot,shape});return {...footprint,slots:footprint.slots.slice()};}};
    const context={geometryOwner:()=>owner,geometrySeedIndexes:()=>[0],geometryPrimarySlot:()=>"F2",
        geometryPrimaryAnchor:()=>({x:180,y:80}),isBossIndexForVfx:()=>false,String,Array};
    vm.createContext(context);
    vm.runInContext(functionSource(animation,"geometryBounds","placementFor"),context);
    const current={targetSide:"monster",targetType:"tri",targetId:0};
    const full=context.geometryBounds(current,[0,1,2],"group");
    const last=context.geometryBounds(current,[0],"group");
    assert.equal(JSON.stringify(full),JSON.stringify(last));
    assert.equal(last.width,360);assert.equal(last.height,120);
    assert.deepEqual(Array.from(last.slots),["F1","F2","F3"]);
    assert.deepEqual(calls,[{side:"monster",slot:"F2",shape:"tri"},{side:"monster",slot:"F2",shape:"tri"}]);
});
test("an edge primary keeps its hit identity while three-slot artwork centers across the canonical footprint",()=>{
    const safe=rect(0,0,600,600),bounds=rect(0,100,600,400);
    bounds.slots=["F1","F2","F3"];
    const primary={slot:"F1",x:100,y:300,rect:rect(0,200,200,200)};
    const context={window:{FourSymbolsBattlefieldRenderGeometry:{getBattlefieldOverlayGeometry:()=>({rect:safe})}},
        geometryOwner:()=>({getSideRect:()=>safe}),placementFor:()=>"group",emittedSpriteTargets:current=>current.targetIndexes,
        geometryBounds:()=>bounds,geometryPrimaryAnchor:()=>primary,frameAspectFor:()=>1,
        SPRITE_SCALE_MULTIPLIER:1,PLACEMENT_SIZE_SCALE:{group:1},Math,Number,String,Array,parseFloat,clamp:(v,min,max)=>Math.max(min,Math.min(max,v))};
    vm.createContext(context);
    vm.runInContext(functionSource(animation,"applySpriteBox","requestSpriteAspect")+
        functionSource(animation,"fitRangeArt","emittedSpriteTargets")+
        functionSource(animation,"placeSprite","addSprite"),context);
    const current={model:{sprite:{}},config:{},targetSide:"monster",targetId:0,targetIds:[0,1,2],targetIndexes:[0,1,2]};
    const node={style:{},dataset:{}};
    context.placeSprite(current,node,0,primary);
    assert.equal(node.style.left,"300px");assert.equal(node.style.top,"300px");
    assert.equal(parseFloat(node.style.width),600,"three strikes must not be reduced to one-slot width by an edge primary");
    assert.equal(node.dataset.geometrySlot,"F1");assert.equal(current.targetId,0);
    assert.deepEqual(current.targetIds,[0,1,2]);assert.equal(node.dataset.geometrySlots,"F1,F2,F3");
    assertInside(node,{x:300,y:300},safe);
    current.targetIndexes=[0];
    context.placeSprite(current,node,0,primary);
    assert.equal(node.style.left,"300px");assert.equal(parseFloat(node.style.width),600,"one survivor preserves the same three-slot art frame");
});
test("a single target near the visible edge keeps its hit center and source ratio without clipping",()=>{
    const safe=rect(0,0,600,600),target={slot:"F1",x:20,y:300,rect:rect(0,250,100,100)};
    const context={window:{FourSymbolsBattlefieldRenderGeometry:{getBattlefieldOverlayGeometry:()=>({rect:safe})}},
        geometryOwner:()=>({getSideRect:()=>safe}),placementFor:()=>"single",frameAspectFor:()=>2,
        SPRITE_SCALE_MULTIPLIER:1,PLACEMENT_SIZE_SCALE:{single:.70},Math,Number,String,parseFloat,
        clamp:(value,min,max)=>Math.max(min,Math.min(max,value))};
    vm.createContext(context);
    vm.runInContext(functionSource(animation,"applySpriteBox","requestSpriteAspect")+
        functionSource(animation,"fitRangeArt","emittedSpriteTargets")+
        functionSource(animation,"authoredSquareSize","placePhasedMotion")+
        functionSource(animation,"placeSprite","addSprite"),context);
    const current={model:{sprite:{}},config:{},targetSide:"monster",targetId:0,targetIds:[0]};
    const node={style:{},dataset:{}};
    context.placeSprite(current,node,0,target);
    assert.equal(node.style.left,"20px");assert.equal(node.style.top,"300px");
    assert.equal(node.dataset.geometrySlot,"F1");assert.equal(current.targetId,0);
    assert.equal(parseFloat(node.style.width)/parseFloat(node.style.height),2);
    assertInside(node,target,safe);
});
test("HUD detaches for the whole cast, returns during reading, and restores the original node on cleanup",()=>{
    function host(){return {children:[],appendChild(node){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(x=>x!==node);this.children.push(node);node.parentNode=this;},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}};}
    const body=host();let reading=false,stage=true,hit=false;
    body.classList={contains:()=>reading};
    const card=host();card.id="battleMonster0";card.isConnected=true;card.classList={contains:()=>false};
    const hud=host();hud.dataset={side:"monster",index:"0"};hud.v174Card=card;
    hud.style={removeProperty(name){delete this[name];}};card.appendChild(hud);
    const page={classList:{contains:()=>true},querySelectorAll:()=>[card]};
    const projection={rect:{left:20,top:30,width:80,height:100},width:80,height:100,scaleX:1,scaleY:1};
    const context={document:{body,getElementById:()=>page,createElement:()=>host(),querySelector(selector){return selector.split(",").some(s=>s===".v143-skill-stage"?stage:s===".v143-hit-feedback-overlay"?hit:false)?{}:null;}},
        window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry:()=>({hudSurface:projection})}},battleActive:true,
        hudLayer:null,prepareUnitHud:()=>hud,Array,Number};
    vm.createContext(context);
    vm.runInContext(functionSource(presentation,"clearUnitHud","syncHud")+functionSource(presentation,"syncHud","syncResourceNumbers"),context);
    context.syncHud();assert.equal(hud.parentNode,context.hudLayer,"cast startup has no hit overlay but HUD must remain readable");
    hit=true;context.syncHud();assert.equal(hud.parentNode,context.hudLayer);
    hit=false;context.syncHud();assert.equal(hud.parentNode,context.hudLayer,"HUD must remain above VFX during post-hit decay");
    reading=true;context.syncHud();assert.equal(hud.parentNode,card);assert.equal(context.hudLayer,null);
    reading=false;context.syncHud();assert.equal(hud.parentNode,context.hudLayer);
    stage=false;context.syncHud();assert.equal(hud.parentNode,card);assert.equal(context.hudLayer,null);
    assert.equal(card.children.filter(node=>node===hud).length,1,"restore the same live HUD without cloning");
    assert.equal(hud.style.left,undefined);assert.equal(hud.style.transform,undefined);
});
