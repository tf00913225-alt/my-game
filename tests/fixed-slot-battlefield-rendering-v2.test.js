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
const feedbackSource=read("js/battle-floating-feedback-owner.js");
const feedbackCss=read("css/battle-floating-feedback-owner.css");
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
assert.match(adapterSource,/if\(style\)\{ style\.remove\(\); \}/,"retired runtime stylesheet is removed, not replaced");
assert.match(adapterSource,/area\.classList\.remove\("battle-monsters","v131-formation","v141-fixed-formation"\)/);
assert.match(adapterSource,/area\.classList\.remove\("battle-player-row"\)/);
assert.doesNotMatch(adapterSource,/MutationObserver|function isOwnedFixedStructure\(node\)/,
    "fixed-slot reconciliation must be lifecycle-driven, not body-observer driven");
assert.match(adapterSource,/window\.vFixedSlotAfterBattleRender=reconcile/,
    "renderBattle lifecycle must invoke the canonical fixed-slot reconcile owner");
assert.match(adapterSource,/VFX_SCALE_CONTRACT/);
assert.match(adapterSource,/baseWidth:rect\.width/);
assert.match(adapterSource,/baseHeight:rect\.height/);
assert.match(adapterSource,/getGeometryRectFromShape\(targetSide,primarySlot,contract\.shape\)/);
assert.match(adapterSource,/getSideRect\(targetSide\)/);
assert.match(adapterSource,/getUnitGeometry:unitGeometry/);
assert.match(adapterSource,/getBattlefieldOverlayGeometry:battlefieldOverlayGeometry/);
assert.match(adapterSource,/slots\.getSlotRect\(slot\)/);
assert.doesNotMatch(adapterSource,/applyPopupAnchor|wrapDamagePopup|wrapMissPopup/,
    "geometry adapter must publish geometry only; floating feedback owns popup DOM and lanes");
assert.match(feedbackSource,/FourSymbolsBattleFloatingFeedback/);
assert.match(feedbackSource,/const MAX_LANES=4/);
assert.match(feedbackSource,/geometry\.feedbackSafeRect/);
assert.match(feedbackSource,/context\.queue\.push\(request\)/);
assert.doesNotMatch(feedbackSource,/getBoundingClientRect\(\).*\.26|visualScale/,
    "floating feedback must use the canonical unit geometry contract, not legacy card-percentage anchors");

assert.match(vfxSource,/getGeometryRectFromShape/);
assert.match(vfxSource,/getSideRect/);
assert.match(vfxSource,/dataset\.geometryOwner="fixed-slot"/);
assert.match(vfxSource,/authoredSquareSize\(sprite,target\.rect/);
assert.match(vfxSource,/node\.style\.left=bounds\.centerX\+"px";[\s\S]*node\.style\.top=bounds\.centerY\+"px";/,"group/all VFX must remain centered on Fixed Slot geometry");
assert.doesNotMatch(vfxSource,/activeCards\([^)]*\)\.length\s*\*/,"VFX scale must not multiply by surviving target count");

assert.match(css,/#battleMonsterArea\.v-fixed-enemy-zone\{[\s\S]*position:relative !important;[\s\S]*height:var\(--battle-enemy-zone-height\) !important;/);
assert.match(css,/grid-template-rows:[\s\S]*var\(--battle-enemy-region-track\)[\s\S]*var\(--battle-center-region-track\)[\s\S]*var\(--battle-ally-region-track\)/,"battle layout must own three proportional structural tracks");
assert.doesNotMatch(css,/--battle-info-region-track/,"bottom info drawer must not resize battlefield tracks");
assert.match(css,/#battleMonsterArea > \.v-fixed-enemy-row\{[\s\S]*position:absolute !important;/);
assert.match(css,/#battlePlayerRow\.v-fixed-ally-zone\{[\s\S]*height:var\(--battle-ally-zone-height\) !important;/);
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\{[\s\S]*position:absolute !important;/);
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\[data-slot-row="front"\]\{top:0 !important;\}/,"ally front row must be nearest the enemy zone");
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\[data-slot-row="back"\]\{bottom:0 !important;\}/,"ally back row must stay inside its separated row");
assert.match(css,/--battle-ally-row-gap:8px/);
assert.doesNotMatch(css,/v-fixed-mechanism-zone|MECH_L|MECH_C|MECH_R/,"retired function-card plane is absent");
assert.match(css,/\.v-fixed-enemy-slot > \.battle-monster,[\s\S]*\.v-fixed-ally-slot > \.battle-player\{[\s\S]*position:absolute !important;[\s\S]*inset:0 !important;/);
assert.match(css,/\.v174-battle-art\{[\s\S]*background-size:contain !important;[\s\S]*overflow:visible !important;/);
assert.match(css,/\.v143-status-visual\{[\s\S]*left:50% !important;[\s\S]*top:42% !important;[\s\S]*transform:translate\(-50%,-50%\) !important;/,"status VFX must stay Slot-relative");
assert.match(css,/\.v143-skill-stage\[data-geometry-owner="fixed-slot"\]\{[\s\S]*overflow:visible !important;[\s\S]*contain:none !important;/);
assert.match(feedbackCss,/body > \.battle-floating-feedback\{[\s\S]*position:fixed;/);
assert.match(feedbackCss,/-webkit-text-stroke:\.85px #fff/);
assert.doesNotMatch(feedbackCss,/0 0 (?:7|8|10|14|16)px/,"canonical popup typography must not restore neon glow");
assert.match(css,/@keyframes v174BattleLungeUp/);
assert.doesNotMatch(css,/@media \(max-width:380px\)/,"fixed Slot geometry must not have a one-phone geometry override");

const safeTop=Number(css.match(/--battle-enemy-safe-top:(\d+)px/)?.[1]||0);
const artOverhang=Number(css.match(/--battle-art-overhang-top:(\d+)px/)?.[1]||0);
assert.ok(safeTop>=artOverhang+3,"enemy safe-top must cover artwork overhang plus idle lift");
assert.match(css,/#battleMonsterArea > \.v-fixed-enemy-row\[data-slot-row="back"\]\{top:var\(--battle-enemy-safe-top\) !important;\}/,"enemy back row must stay inside the portrait viewport safe region");
assert.doesNotMatch(css,/\bscale\s*:/,"raster size must not scale its centering or flight translation");

// Execute the production sizing functions. These checks supplement, never
// replace, fully loaded battle runtime visual acceptance.
const sizingContext={spriteFrameAspectCache:new Map(),SPRITE_SCALE_MULTIPLIER:1};
vm.createContext(sizingContext);
vm.runInContext(vfxSource.match(/const PLACEMENT_SIZE_SCALE=Object\.freeze\(\{[^;]+;/)[0]+"\n"+
    vfxSource.slice(vfxSource.indexOf("    function frameAspectFor("),vfxSource.indexOf("    function requestSpriteAspect(")),sizingContext);
for(const [placement,factor] of Object.entries({single:.88,targetTrajectory:.80,trajectory:1,group:1,battlefield:1})){
    const sprite={dataset:{placement},style:{left:"180px",top:"240px"}};
    sizingContext.applySpriteBox(sprite,200,200,{cellAspect:1});
    assert.equal(sprite.style.width,Math.round(200*factor)+"px",placement+" owns bounded raster width");
    assert.equal(sprite.style.height,sprite.style.width,placement+" preserves frame aspect");
    assert.equal(sprite.style.left,"180px",placement+" does not move the hit anchor");
    assert.equal(sprite.style.top,"240px",placement+" does not move the hit anchor");
    assert.equal(sprite.style.scale,undefined,placement+" does not rescale the travel vector");
}
const portraitSprite={dataset:{placement:"single"},style:{}};
sizingContext.applySpriteBox(portraitSprite,200,200,{cellAspect:.75});
assert.equal(portraitSprite.style.width,"132px");
assert.equal(portraitSprite.style.height,"176px");

// Re-run the actual entry owner through initial entry, a same-battle redraw
// (BOSS reinforcements), and the next battle. No replacement render algorithm.
const transitionSource=read("js/35-v141-ui-battle.js");
const pageClasses=new Set(),overlayClasses=new Set(),timers=[];
const classes=set=>({add(...names){names.forEach(name=>set.add(name));},remove(...names){names.forEach(name=>set.delete(name));}});
const transitionPage={classList:classes(pageClasses)};
const transitionOverlay={classList:classes(overlayClasses)};
const transitionContext={
    window:{v132ActiveDungeonRun:{}},lastWildRankToken:null,battleToken:10,battleActive:true,
    gold:0,sharedExp:0,currentBattleMonsters:[0],getItemCounts(){return [];},
    rebalanceDungeonElements(){},decorateBattleCards(){},renderBattle(){},
    turnStarts:0,startTurn(){transitionContext.turnStarts++;},
    document:{getElementById(id){return id==="battlePage"?transitionPage:transitionOverlay;}},
    setTimeout(callback){timers.push(callback);}
};
vm.createContext(transitionContext);
vm.runInContext(transitionSource.slice(transitionSource.indexOf("    const startedEntryTokens="),transitionSource.indexOf("    function collectRewardSummary(")),transitionContext);
transitionContext.window.v141PrepareBattleRender();
transitionContext.window.v141AfterBattleRender();
assert.ok(pageClasses.has("v141-preparing-entry"));
transitionContext.startTurn(10);
while(timers.length)timers.shift()();
assert.ok(!pageClasses.has("v141-preparing-entry"));
assert.equal(transitionContext.turnStarts,1);
transitionContext.window.v141PrepareBattleRender();
transitionContext.window.v141AfterBattleRender();
transitionContext.startTurn(10);
assert.ok(!pageClasses.has("v141-preparing-entry"),"reinforcement redraw must not hide players or shift enemies");
assert.equal(timers.length,0,"same-battle redraw must not replay entry");
transitionContext.battleToken=11;
transitionContext.window.v141PrepareBattleRender();
transitionContext.window.v141AfterBattleRender();
assert.ok(pageClasses.has("v141-preparing-entry"),"new battle retains its real entry animation");
transitionContext.startTurn(11);
while(timers.length)timers.shift()();
assert.ok(!pageClasses.has("v141-preparing-entry"));


assert.match(build,/"js\/battlefield-slot-owner\.js"/);
assert.match(build,/"js\/battlefield-render-geometry-adapter\.js"/);
assert.match(build,/"js\/battle-floating-feedback-owner\.js"/);
assert.ok(build.indexOf('"js/battlefield-render-geometry-adapter.js"')>build.indexOf('"js/54-v173.51-battle-qa.js"'),"adapter must install after legacy presentation wrappers");
assert.ok(build.indexOf('"js/battle-floating-feedback-owner.js"')>build.indexOf('"js/battlefield-render-geometry-adapter.js"'),"feedback owner must install after canonical geometry");
assert.match(build,/"css\/fixed-slot-battlefield-rendering-v2\.css"/);
assert.match(build,/"css\/battle-floating-feedback-owner\.css"/);

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

for(const allyCount of [1,2,3,4,5,6]){
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

assert.deepEqual(JSON.parse(JSON.stringify(owner.bossFootprintSlots)),["ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_F2","ENEMY_F3","ENEMY_F4"]);

assert.match(qaSource,/V174 battle presentation owner/);
console.log("Fixed Slot Battlefield Rendering V2 regression contract passed.");
