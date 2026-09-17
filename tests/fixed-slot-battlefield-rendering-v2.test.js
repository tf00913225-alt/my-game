"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");

const ownerSource=read("js/battlefield-slot-owner.js");
const adapterSource=read("js/battlefield-render-geometry-adapter.js");
const vfxSource=read("js/39-v143-skill-animation.js");
const qaSource=read("js/54-v173.51-battle-qa.js");
const css=read("css/fixed-slot-battlefield-rendering-v2.css");
const build=read("scripts/build-production.mjs");

assert.match(ownerSource,/window\.FourSymbolsBattlefieldSlots/);
assert.match(ownerSource,/getGeometryRectFromShape/);
assert.match(ownerSource,/getSideRect/);
assert.match(adapterSource,/const slots=window\.FourSymbolsBattlefieldSlots/);
assert.doesNotMatch(adapterSource,/ENEMY_LAYOUTS\s*=|ALLY_LAYOUTS\s*=/,"render adapter must not create another Slot table");
assert.match(adapterSource,/replaceChildren\(fragment\)/,"legacy formation DOM must be reconciled into formal Slot containers");
assert.match(adapterSource,/slots\.enemyBackSlots,slots\.enemyFrontSlots/);
assert.match(adapterSource,/slots\.allyFrontSlots,slots\.allyBackSlots/);
assert.match(adapterSource,/dataset\.geometryOwner="fixed-slot"/);
assert.match(adapterSource,/neutralizeLegacyPresentationGeometry/);
assert.match(adapterSource,/style\.dataset\.geometryOwner="fixed-slot"/);
assert.match(adapterSource,/area\.classList\.remove\("battle-monsters","v131-formation","v141-fixed-formation"\)/);
assert.match(adapterSource,/area\.classList\.remove\("battle-player-row"\)/);
assert.match(adapterSource,/function isOwnedFixedStructure\(node\)/);
assert.match(adapterSource,/if\(isOwnedFixedStructure\(node\)\)\{ return; \}/,"observer must ignore its own fixed Slot rows/holders");
assert.match(adapterSource,/VFX_SCALE_CONTRACT/);
assert.match(adapterSource,/baseWidth:rect\.width/);
assert.match(adapterSource,/baseHeight:rect\.height/);
assert.match(adapterSource,/getGeometryRectFromShape\(targetSide,primarySlot,contract\.shape\)/);
assert.match(adapterSource,/getSideRect\(targetSide\)/);
assert.match(adapterSource,/applyPopupAnchor/);
assert.match(adapterSource,/slots\.getSlotRect\(slot\)/);
assert.match(adapterSource,/wrapDamagePopup/);
assert.match(adapterSource,/wrapMissPopup/);
assert.match(adapterSource,/kind==="critical"\?"20px":"18px"/);
assert.doesNotMatch(adapterSource,/rect\.width\s*\/\s*element\.offsetWidth|visualScale/,"popup scale must not be based on card bounds");

assert.match(vfxSource,/getGeometryRectFromShape/);
assert.match(vfxSource,/getSideRect/);
assert.match(vfxSource,/dataset\.geometryOwner="fixed-slot"/);
assert.match(vfxSource,/authoredSquareSize\(sprite,target\.rect/);
assert.match(vfxSource,/node\.style\.left=bounds\.centerX\+"px";[\s\S]*node\.style\.top=bounds\.centerY\+"px";/,"group/all VFX must remain centered on Fixed Slot geometry");
assert.doesNotMatch(vfxSource,/activeCards\([^)]*\)\.length\s*\*/,"VFX scale must not multiply by surviving target count");

assert.match(css,/#battleMonsterArea\.v-fixed-enemy-zone\{[\s\S]*position:relative !important;[\s\S]*height:var\(--battle-enemy-zone-height\) !important;/);
assert.match(css,/#battleMonsterArea > \.v-fixed-enemy-row\{[\s\S]*position:absolute !important;/);
assert.match(css,/#battlePlayerRow\.v-fixed-ally-zone\{[\s\S]*height:var\(--battle-ally-zone-height\) !important;/);
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\{[\s\S]*position:absolute !important;/);
assert.match(css,/\.v-fixed-enemy-slot > \.battle-monster,[\s\S]*\.v-fixed-ally-slot > \.battle-player\{[\s\S]*position:absolute !important;[\s\S]*inset:0 !important;/);
assert.match(css,/\.v174-battle-art\{[\s\S]*background-size:contain !important;[\s\S]*overflow:visible !important;/);
assert.match(css,/\.v153-status-vfx\{[\s\S]*left:50% !important;[\s\S]*top:42% !important;[\s\S]*transform:translate\(-50%,-50%\) !important;/,"status VFX must stay Slot-relative");
assert.match(css,/\.v143-skill-stage\[data-geometry-owner="fixed-slot"\]\{[\s\S]*overflow:visible !important;[\s\S]*contain:none !important;/);
assert.match(css,/\.v-fixed-slot-popup\{[\s\S]*position:fixed !important;/);
assert.match(css,/@keyframes v174BattleLungeUp/);
assert.doesNotMatch(css,/@media \(max-width:380px\)/,"fixed Slot geometry must not have a one-phone geometry override");

const safeTop=Number(css.match(/--battle-enemy-safe-top:(\d+)px/)?.[1]||0);
const artOverhang=Number(css.match(/--battle-art-overhang-top:(\d+)px/)?.[1]||0);
assert.ok(safeTop>=artOverhang+3,"enemy safe-top must cover artwork overhang plus idle lift");
assert.match(css,/#battleMonsterArea\.v-fixed-enemy-zone\{[\s\S]*top:var\(--battle-enemy-safe-top\) !important;/,"enemy zone must stay inside the portrait viewport safe region");
assert.match(css,/\.v143-vfx-sprite\[data-placement="single"\]\{\s*scale:\.88;/);
assert.match(css,/\.v143-vfx-sprite\[data-placement="group"\]\{\s*scale:\.62;/);
assert.match(css,/\.v143-vfx-sprite\[data-placement="battlefield"\]\{\s*scale:\.72;/);
assert.match(css,/\.v143-vfx-sprite\[data-placement="targetTrajectory"\],[\s\S]*?\.v143-vfx-sprite\[data-placement="trajectory"\]\{\s*scale:\.80;/);

assert.match(build,/"js\/battlefield-slot-owner\.js"/);
assert.match(build,/"js\/battlefield-render-geometry-adapter\.js"/);
assert.ok(build.indexOf('"js/battlefield-render-geometry-adapter.js"')>build.indexOf('"js/54-v173.51-battle-qa.js"'),"adapter must install after legacy presentation wrappers");
assert.match(build,/"css\/fixed-slot-battlefield-rendering-v2\.css"/);

const rects={};
const enemySlots=["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5","ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"];
enemySlots.forEach((slot,index)=>{
    const row=index<5?0:1;
    const col=index%5;
    rects[slot]={left:col*70,top:row*90,width:66,height:86,right:col*70+66,bottom:row*90+86};
});
const context={
    window:{},
    localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    document:{querySelector(selector){
        const match=selector.match(/\[data-slot="([A-Z0-9_]+)"\]/);
        const rect=match&&rects[match[1]];
        return rect?{dataset:{slot:match[1]},getBoundingClientRect(){return rect;},closest(){return null;}}:null;
    }},
    console
};
context.window.window=context.window;
context.window.document=context.document;
context.window.localStorage=context.localStorage;
vm.createContext(context);
vm.runInContext(ownerSource,context);
const owner=context.window.FourSymbolsBattlefieldSlots;
assert.ok(owner);
for(const count of [1,3,5,6,8,10]){
    const indexes=Array.from({length:count},(_,index)=>index);
    const snapshot=owner.createEnemyFormationSnapshot(indexes,{originalFormationType:count,rankWeight:()=>1});
    const before=JSON.stringify(snapshot.monsterIndexToSlot);
    owner.resolveEnemyTargets(snapshot,Math.min(1,count-1),"all",index=>index!==Math.floor(count/2));
    assert.equal(JSON.stringify(snapshot.monsterIndexToSlot),before,`formation ${count} moved after death filter`);
}

for(const allyCount of [1,2,3]){
    const indexes=Array.from({length:allyCount},(_,index)=>index);
    const formation=owner.normalizeAllyFormation(null,indexes);
    assert.equal(Object.keys(formation.characterIndexToSlot).length,allyCount);
    indexes.forEach(index=>assert.ok(owner.allySlots.includes(formation.characterIndexToSlot[index])));
}
const split=owner.normalizeAllyFormation({characterIndexToSlot:{0:"ALLY_F1",1:"ALLY_B2",2:"ALLY_F3"}},[0,1,2]);
assert.equal(split.characterIndexToSlot[1],"ALLY_B2");

const single=owner.getGeometryRectFromShape("monster","ENEMY_F3","single");
const tri=owner.getGeometryRectFromShape("monster","ENEMY_F3","tri");
const row=owner.getGeometryRectFromShape("monster","ENEMY_F3","row");
const column=owner.getGeometryRectFromShape("monster","ENEMY_F3","column");
const all=owner.getGeometryRectFromShape("monster","ENEMY_F3","all");
assert.equal(single.width,66);
assert.ok(tri.width>single.width);
assert.ok(row.width>=tri.width);
assert.ok(column.height>single.height);
assert.ok(all.width>=row.width&&all.height>=column.height);

assert.match(qaSource,/V174 battle presentation owner/);
console.log("Fixed Slot Battlefield Rendering V2 regression contract passed.");
