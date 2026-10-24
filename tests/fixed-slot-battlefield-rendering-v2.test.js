"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");

const ownerSource=read("js/battlefield-slot-owner.js");
const v131Source=read("js/25-v131-fix-batch.js");
const adapterSource=read("js/battlefield-render-geometry-adapter.js");
const vfxSource=read("js/39-v143-skill-animation.js");
const qaSource=read("js/54-v173.51-battle-qa.js");
const feedbackSource=read("js/battle-floating-feedback-owner.js");
const feedbackCss=read("css/battle-floating-feedback-owner.css");
const css=read("css/fixed-slot-battlefield-rendering-v2.css");
const build=read("scripts/build-production.mjs");

assert.match(ownerSource,/window\.FourSymbolsBattlefieldSlots/);
assert.match(v131Source,/function bossEnemyFormationAuthority\(owner\)/);
assert.match(v131Source,/if\(bossAuthority\.owns\)\{ return bossAuthority\.snapshot; \}/,
    "V131 must return the Boss-owned snapshot before normal formation matching");
assert.match(v131Source,/if\(bossEnemyFormationAuthority\(owner\)\.owns\)\{ return; \}/,
    "V131 enemy DOM projection must retire while the Large Boss owner is active");
assert.match(v131Source,/const activeMatches=existing&&requested\.every\(index=>!!owner\.getEnemySlotForMonster\(existing,index\)\);/);
assert.match(v131Source,/if\(activeMatches\)\{ return existing; \}/);
assert.match(ownerSource,/getGeometryRectFromShape/);
assert.match(ownerSource,/getSideRect/);
assert.match(adapterSource,/const slots=window\.FourSymbolsBattlefieldSlots/);
assert.doesNotMatch(adapterSource,/ENEMY_LAYOUTS\s*=|ALLY_LAYOUTS\s*=/,"render adapter must not create another Slot table");
assert.match(adapterSource,/replaceChildren\(fragment\)/,"legacy formation DOM must be reconciled into formal Slot containers");
assert.match(adapterSource,/slots\.getEnemyRenderSlotRows\(snapshot\)/);
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
assert.match(css,/grid-template-rows:[\s\S]*var\(--battle-enemy-region-track\)[\s\S]*var\(--battle-ally-region-track\)[\s\S]*var\(--battle-center-region-track\)/,"battle layout owns enemy, ally, then bottom operation tracks");
assert.doesNotMatch(css,/--battle-info-region-track/,"bottom info drawer must not resize battlefield tracks");
assert.match(css,/#battleMonsterArea > \.v-fixed-enemy-row\{[\s\S]*position:absolute !important;/);
assert.match(css,/#battlePlayerRow\.v-fixed-ally-zone\{[\s\S]*height:var\(--battle-ally-zone-height\) !important;/);
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\{[\s\S]*position:absolute !important;/);
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\[data-slot-row="front"\]\{top:-24px !important;\}/,"ally front row must be nearest the enemy zone");
assert.match(css,/#battlePlayerRow > \.v-fixed-ally-slot-row\[data-slot-row="back"\]\{bottom:0 !important;\}/,"ally back row must stay inside its separated row");
assert.match(css,/--battle-ally-row-gap:8px/);
assert.doesNotMatch(css,/v-fixed-mechanism-zone|MECH_L|MECH_C|MECH_R/,"retired function-card plane is absent");
assert.match(css,/\.v-fixed-enemy-slot > \.battle-monster,[\s\S]*\.v-fixed-ally-slot > \.battle-player\{[\s\S]*position:absolute !important;[\s\S]*inset:0 !important;/);
assert.match(css,/\.v174-battle-art\{[\s\S]*background-size:0 0 !important;[\s\S]*overflow:visible !important;/);
const statusPaintRule=css.match(/\.v143-status-visual\{([^}]+)\}/)[1];
assert.doesNotMatch(statusPaintRule,/(?:left|top)\s*:/,"fixed-slot CSS cannot override V143 head/body/feet placement");
assert.match(statusPaintRule,/transform:translate\(-50%,-50%\) !important;/,"status artwork remains centered around its V143-owned local anchor");
assert.match(css,/\.v143-skill-stage\[data-geometry-owner="fixed-slot"\]\{[\s\S]*overflow:visible !important;[\s\S]*contain:none !important;/);
assert.match(feedbackCss,/body > \.battle-floating-feedback\{[\s\S]*position:fixed;/);
assert.match(feedbackCss,/-webkit-text-stroke:\.85px #fff/);
assert.doesNotMatch(feedbackCss,/0 0 (?:7|8|10|14|16)px/,"canonical popup typography must not restore neon glow");
assert.match(css,/@keyframes v174BattleLungeUp/);
assert.doesNotMatch(css,/@media \(max-width:380px\)/,"fixed Slot geometry must not have a one-phone geometry override");

const safeTop=Number(css.match(/--battle-enemy-safe-top:(\d+)px/)?.[1]||0);
const artOverhang=Number(css.match(/--battle-art-overhang-top:(\d+)px/)?.[1]||0);
assert.ok(safeTop>=artOverhang+3,"enemy safe-top must cover artwork overhang plus idle lift");
assert.match(css,/#battleMonsterArea > \.v-fixed-enemy-row\[data-slot-row="back"\]\{top:calc\(var\(--battle-enemy-safe-top\) - 26px\) !important;\}/,"enemy back row must stay inside the portrait viewport safe region");
assert.doesNotMatch(css.match(/\.v143-skill-stage\[data-geometry-owner="fixed-slot"\]\{[^}]*\}/)?.[0]||"",/\bscale\s*:/,"VFX raster size must not scale its centering or flight translation");

// Execute the production sizing functions. These checks supplement, never
// replace, fully loaded battle runtime visual acceptance.
const sizingContext={window:{},spriteFrameAspectCache:new Map(),SPRITE_SCALE_MULTIPLIER:1};
vm.createContext(sizingContext);
vm.runInContext(vfxSource.match(/function clamp\([^}]+\}/)[0]+"\n"+vfxSource.match(/const PLACEMENT_SIZE_SCALE=Object\.freeze\(\{[^;]+;/)[0]+"\n"+
    vfxSource.slice(vfxSource.indexOf("    function frameAspectFor("),vfxSource.indexOf("    function requestSpriteAspect(")),sizingContext);
for(const [placement,factor] of Object.entries({single:.70,targetTrajectory:.72,trajectory:1,group:1,battlefield:1})){
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
assert.equal(portraitSprite.style.width,"105px");
assert.equal(portraitSprite.style.height,"140px");

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

assert.match(css,/--battle-enemy-region-track:54\.785fr;[\s\S]*?--battle-center-region-track:12fr;[\s\S]*?--battle-ally-region-track:45\.215fr;/,"single-line enemy identity and compact turn information fund foot badges while retaining portraits");
assert.doesNotMatch(css.match(/\[data-enemy-battlefield-profile="standard-six"\]\{([^}]+)\}/)[1],/--battle-(enemy|center|ally)-region-track/,"six-slot profile shares the structural layout instead of silently restoring the old middle gap");
assert.match(css,/height:calc\(100% - var\(--battle-bottom-safe-gap\)\) !important;/,"bottom HUD safety is real layout space, not an art translation");
assert.match(css,/--battle-bottom-safe-gap:8px;/);
assert.match(css,/--battle-top-name-reserve:44px;/);
assert.match(css,/#game-stage:has\(#releaseUpdateMarquee:not\(\[hidden\]\)\)[^{}]*\{--battle-top-name-reserve:72px;\}/);
assert.match(css,/#battleCommandRow\{[^}]*flex:0 0 var\(--battle-command-row-height\) !important;/,"outer row cannot retain old inline66px budget");
assert.match(css,/#turnTargetRow \.turn-number\{display:none;\}/,"round is shown once; countdown retains original timer");
assert.match(css,/padding-top:var\(--battle-top-name-reserve\)/,"name headroom is real layout space");
assert.match(css,/--battle-center-min-height:calc\(var\(--battle-turn-row-height\) \+ max\(var\(--battle-command-visual-height\), calc\(var\(--battle-target-prompt-height\) \+ var\(--battle-target-select-gap\)\)\) \+ 12px\);/,"bottom operations retain turn/command separation and target selection with compact safe touch controls");
assert.match(css,/#battleCommandRow\{\s*width:100%;\s*margin-right:0;/,"commands and separate utility row cannot share width");
// Quantify the structural budget independently of artwork. USB still verifies
// actual CSS layout/projection; these checks catch unsafe token combinations.
const layoutNumber=(name,unit)=>Number(css.match(new RegExp('--'+name+':([0-9.]+)'+unit+';'))?.[1]);
const enemyWeight=layoutNumber('battle-enemy-region-track','fr'),centerWeight=layoutNumber('battle-center-region-track','fr'),allyWeight=layoutNumber('battle-ally-region-track','fr');
const bottomReserve=layoutNumber('battle-bottom-safe-gap','px'),topReserve=layoutNumber('battle-top-name-reserve','px'),regionGap=layoutNumber('battle-region-gap','px');
const commandCss=read('css/00-main.css');
const commandHeight=layoutNumber('battle-command-row-height','px');
assert.ok(commandHeight*360/420>=44,'compact controls retain44px physical height at360px');
const formationSeparation=layoutNumber('battle-formation-separation','px');
assert.equal(formationSeparation,44,'single control row returns height to party separation');
const turnHeight=layoutNumber('battle-turn-row-height','px')||Number(commandCss.match(/--battle-turn-row-height:(\d+)px;/)[1]);
const centerMinimum=turnHeight+Math.max(commandHeight,layoutNumber('battle-target-prompt-height','px')+layoutNumber('battle-target-select-gap','px'))+12;
for(const contentHeight of [600,717,840]){
    const usable=contentHeight-topReserve-bottomReserve-regionGap*3-formationSeparation;
    const centerHeight=Math.max(centerMinimum,usable*centerWeight/(enemyWeight+centerWeight+allyWeight));
    const enemyHeight=(usable-centerHeight)*enemyWeight/(enemyWeight+allyWeight);
    const allyHeight=(usable-centerHeight)*allyWeight/(enemyWeight+allyWeight);
    assert.ok(centerHeight>=turnHeight+commandHeight+6&&centerHeight>=turnHeight+layoutNumber('battle-target-prompt-height','px')+layoutNumber('battle-target-select-gap','px')+6,'controls must fit without overlaying each other at '+contentHeight);
    assert.ok(centerHeight<(contentHeight-regionGap*2)*.21,'middle gap must actually decrease at '+contentHeight);
    assert.ok(enemyHeight>0&&allyHeight>0);
    assert.ok(Math.abs(contentHeight-(enemyHeight+centerHeight+allyHeight+regionGap*3+formationSeparation)-topReserve-bottomReserve)<.001,'top name and bottom safety reserves cannot be consumed by fractional tracks');
}

assert.match(css,/--battle-portrait-visible-height:min\(101\.55px, calc\(var\(--battle-portrait-safe-height\) \/ var\(--battle-art-depth, 1\)\)\);/,"normal art compensates depth before the below-HUD height limit");
assert.match(css,/--battle-portrait-visible-height:min\(105\.27px, calc\(var\(--battle-portrait-safe-height\) \/ var\(--battle-art-depth, 1\)\)\);/,"elite art retains its preferred height while compensating depth at the top HUD");
assert.match(css,/--battle-portrait-safe-height:96cqh;/,"near-row enemy paint leaves upper HUD headroom");
assert.match(css,/\[data-enemy-battlefield-profile="standard-six"\] \.v-fixed-enemy-row\[data-slot-row="back"\][^{}]*\{--battle-portrait-safe-height:90cqh;\}/,"height-limited far enemies stay smaller instead of both rows saturating the same height");
assert.match(css,/left:calc\(50% - \(50% \+ var\(--battle-art-overhang-x\)\) \/ var\(--battle-art-depth, 1\)\)/,"depth must not expand the horizontal silhouette envelope into adjacent slots");
assert.match(css,/right:calc\(50% - \(50% \+ var\(--battle-art-overhang-x\)\) \/ var\(--battle-art-depth, 1\)\)/,"width compensation stays symmetric around the canonical slot");

assert.match(fs.readFileSync("index.html","utf8"), /id="battleActionRegion"[\s\S]*?id="battleElementBoxButton"[\s\S]*?id="turnTargetRow"/,"element box shares the formal operation reserve");

assert.match(css,/\.battle-player > \.v174-battle-art\{--battle-art-depth:1;\}/,"all party rows use the same unit scale");
assert.doesNotMatch(css,/\.v-fixed-ally-slot-row\[data-slot-row="front"\][^{}]*\{[^}]*--battle-art-depth/,"party front cannot override depth");
assert.doesNotMatch(css,/#battlePlayerRow:has/,"paired back portraits cannot have a different sizing policy");
assert.match(css,/\.v-fixed-enemy-row\[data-slot-row="back"\][^{}]*\{--battle-art-depth:1\.10;\}/,"enemy far row retains depth");
// Ordinary HUD typography is owned by Fixed Slot; historical identity rules
// remain scoped to the separate Boss card contract.
assert.doesNotMatch(fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8"), /#battlePage \.battle-monster-name\.v143-monster-identity\{/);
assert.doesNotMatch(fs.readFileSync("css/45-v152-dev-fixes.css","utf8"), /#battlePage \.battle-monster-name\.v143-monster-identity\{/);
assert.match(css,/--battle-name-row-height:26px;/);
assert.match(css,/--battle-art-hud-reserve:44px;/);

assert.match(css,/\.v174-portrait-paint\{[^}]*background-size:contain/,"The single inner image paint preserves source aspect ratio");

// Initial render and profile transitions must publish the canonical semantic
// profile before any HUD is prepared; an extra later sync may not repair it.
{
    const node=()=>({dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},appendChild(){},replaceChildren(){}});
    const area=node(),page=node(),cards=[node(),node()],observed=[];
    let profile='standard-six',boss=false;
    const context={document:{getElementById:id=>id==='battleMonsterArea'?area:id==='battlePage'?page:cards[Number(id.replace('battleMonster',''))],createDocumentFragment:node,createElement:node},
        activeEnemyIndexes:()=>[0,1],activeEnemySnapshot:()=>({battlefieldProfile:profile,originalFormationType:6,migrationStatus:'canonical'}),
        bossBattleOwner:()=>boss?{getBossIndex:()=>0}:null,
        slots:{getEnemyRenderSlotRows:()=>[['ENEMY_B1'],['ENEMY_F1']],getAssignedMonsterAtEnemySlot:(_,slot)=>slot==='ENEMY_B1'?0:1,bossFootprintSlots:['ENEMY_B2','ENEMY_F2']},makeSlot:node,
        applyPresentation(){assert.equal(page.dataset.enemyBattlefieldProfile,profile);assert.equal(area.dataset.battlefieldProfile,profile);observed.push(profile);}};
    vm.createContext(context);
    vm.runInContext(adapterSource.slice(adapterSource.indexOf('function canonicalizeEnemyZone('),adapterSource.indexOf('function partyIndexes(')),context);
    for(const next of ['standard-six','legacy-ten','standard-six']){profile=next;boss=next==='legacy-ten';context.canonicalizeEnemyZone();}
    assert.deepEqual(observed,['standard-six','standard-six','legacy-ten','legacy-ten','standard-six','standard-six']);
}
assert.match(adapterSource,/hudNodes\.filter\(node=>node!==statusBadge\)/,'foot badges cannot enlarge the upper resource HUD into a body-covering rectangle');
assert.match(adapterSource,/statusBadgeRect\?statusBadgeRect\.top-4/,'floating feedback must stop above the separate foot badge band');
assert.match(css,/flex-wrap:nowrap;[\s\S]*?overflow-x:auto !important;overflow-y:hidden !important;/,'narrow Boss columns keep all original-size icons on a horizontally reachable single row');
