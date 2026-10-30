const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

test("inspection portrait and agility follow the selected combatant without stale content",()=>{
  const source=read('js/00-main.js');
  const fn=source.slice(source.indexOf('function openBattleStatusDetailModal(side,index){'),source.indexOf('\nif(typeof window!=="undefined"){',source.indexOf('function openBattleStatusDetailModal(side,index){')));
  const nodes=new Map();
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{style:{},textContent:'',setAttribute(k,v){this[k]=v;}});return nodes.get(selector);};
  const modal={dataset:{},querySelector:node,setAttribute(){}};
  let blocked=false;
  const context={isBattleStatusInspectionBlocked:()=>blocked,monsters:[{name:'敵甲',level:9,hp:10,maxHP:20,sp:0,maxSP:0,agility:99},{name:'敵乙',level:3,hp:5,maxHP:5,sp:0,maxSP:0,agility:40}],
    getPartyCharacterByIndex:()=>({name:'隊友',level:4,hp:20,sp:5}),getPartyBattleStats:()=>({maxHP:30,maxSP:10,agility:72.5}),
    getCharacterBattleDetailArtworkPath:()=>"assets/characters/battle/player_battle_male_03.webp",getMonsterAgility:m=>m.agility/2,ensureBattleStatusDetailModal:()=>modal,
    document:{getElementById:id=>({querySelector:()=>({style:{backgroundImage:id==='battleMonster1'?'none':'url("'+id+'.webp")'}})})},
    projectEnemyResource:(v,max)=>({text:v+' / '+max}),battleStatusElementLabel:()=> '火',window:{},renderBattleStatusDetailList(){},syncBattleUiPriorityLayer(){}};
  vm.createContext(context);vm.runInContext(fn,context);
  assert.equal(context.openBattleStatusDetailModal('monster',0),true);
  node('.battle-status-detail-panel').scrollTop=999;
  assert.equal(node('[data-field="agility"]').textContent,'敏捷：49.5');
  assert.match(node('.battle-status-detail-portrait').style.backgroundImage,/battleMonster0/);
  context.openBattleStatusDetailModal('player',0);
  assert.equal(modal.dataset.side,'player');
  assert.equal(modal.dataset.portraitKind,'player');
  assert.equal(node('.battle-status-detail-panel').scrollTop,0);
  assert.equal(node('[data-field="agility"]').textContent,'敏捷：72.5');
  assert.match(node('.battle-status-detail-portrait').style.backgroundImage,/player_battle_male_03\.webp/);
  assert.doesNotMatch(node('.battle-status-detail-portrait').style.backgroundImage,/readable/);
  context.openBattleStatusDetailModal('monster',1);
  assert.equal(node('.battle-status-detail-portrait').style.backgroundImage,'none');
  assert.equal(node('.battle-status-detail-portrait').textContent,'◇');
  assert.equal(node('.battle-status-detail-portrait')['aria-label'],'敵乙立繪');
  assert.equal(modal.dataset.portraitKind,'monster');
  context.getPartyCharacterByIndex=()=>({combatantKind:'heroNpc',name:'英雄',level:4,hp:20,sp:5});
  context.openBattleStatusDetailModal('player',3);
  assert.equal(modal.dataset.portraitKind,'heroNpc');
  context.openBattleStatusDetailModal('monster',1);
  blocked=true;assert.equal(context.openBattleStatusDetailModal('player',0),false);
  assert.equal(node('[data-field="agility"]').textContent,'敏捷：20');
  blocked=false;context.getPartyBattleStats=()=>null;
  context.openBattleStatusDetailModal('player',0);
  assert.equal(node('[data-field="agility"]').textContent,'敏捷：—');
});

const STATUS_ASSETS=[
  "burn.webp","rage-aura-v2.webp","rage-icon.webp","frostbite-icon.webp","freeze.webp",
  "gravity-icon.webp","damage-down-icon.webp","stun-icon.webp","windwalk.webp",
  "stealth.webp","calm-mind.webp","defense-down-icon.webp","shield.webp",
  "petrify.webp","earth-shield.webp","rock-wall.webp","barrier.webp",
  "yuan-zu-blessing.webp","fire-momentum-icon.webp","phoenix-might-icon.webp",
  "fire-soul-resonance.webp","blood-burn.webp","stun-stars-v2.webp"
];

test("persistent status icons are static while body states stay pulse/static",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/frostbite:statusVisual\("","icon","statusEffects"/);
  assert.match(js,/fireMomentum:statusVisual\("","none","activeBuffs"/);
  assert.match(js,/burn:statusVisual\("assets\/vfx\/status\/burn\.webp","pulse"/);
  assert.match(js,/freeze:statusVisual\("assets\/vfx\/status\/freeze\.webp","static"/);
  assert.doesNotMatch(js,/statDown:statusVisual/);
  assert.match(css,/\.v143-status-icon--pulse\{[\s\S]*?animation:none !important;/);
  assert.match(css,/\.v143-status-visual--pulse\{[\s\S]*?v143StatusImageBreath/);
});

test("status body art uses the projected character and per-status presentation owner",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/function placeStatusBodyVisual\(/);
  assert.match(js,/STATUS_BODY_PRESENTATION\[type\]/);
  assert.match(js,/geometry\?\.artworkProjection\?\.rect/);
  assert.match(js,/geometry\?\.portraitRect/);
  assert.match(js,/geometry\?\.hudSurface\?\.scaleX/);
  assert.match(js,/placeStatusBodyVisual\(node,side,index,type,card,anchor,presentationGeometry,presentationSnapshot\.cardRect,presentationSnapshot\.pairedFrontHudRect\)/);
  assert.match(js,/node\.style\.backgroundSize="contain"/);
});

test("body-art HUD icons require the approved successful-status gate and preserve detail iconSrc",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/if\(spec\.mode==="icon"\|\|automaticIcon\)[\s\S]*?host\.appendChild\(createStatusIcon\(type,spec\)\)[\s\S]*?else if\(existingIcon\)/);
  assert.match(js,/const automaticIcon=window\.FourSymbolsHitFeedback\?\.statusEnabled\(type,entry\)/);
  assert.match(js,/iconSrc:spec\.iconSrc\|\|spec\.src\|\|""/);
});

test("idle card inspection yields to existing target-selection interaction",()=>{
  const js=read("js/00-main.js");
  assert.match(js,/function isBattleStatusInspectionBlocked\(\)/);
  assert.match(js,/if\(actionRegion&&actionRegion\.classList\.contains\("target-selecting"\)\)/);
  const inspection=js.slice(js.indexOf("function isBattleStatusInspectionBlocked()"),js.indexOf("function battleStatusElementLabel"));
  assert.doesNotMatch(inspection,/actionReady|pendingAction/);
  assert.match(inspection,/#battlePage \.battle-monster\.targetable,#battlePage \.battle-player\.ally-targetable/);
  assert.match(js,/\.battle-monster\.targetable/);
  assert.match(js,/card\.classList\.contains\("targetable"\)[\s\S]*?selectBattleTarget\(index\)/);
  assert.match(js,/box\.classList\.contains\("ally-targetable"\)[\s\S]*?selectBattleAllyTarget\(index\)/);
  assert.match(js,/openBattleStatusDetailModal\("monster",index\)/);
  assert.match(js,/openBattleStatusDetailModal\("player",index\)/);
  assert.match(js,/增益狀態：/);
  assert.match(js,/負面狀態：/);
  assert.match(js,/剩餘 /);
});

test("battle skill owners keep target scope, duration and presentation aligned",()=>{
  const main=read("js/00-main.js");
  const bottomNav=read("js/04-stage-v11-native-bottom-nav-runtime.js");
  const v141=read("js/36-v141-content-systems.js");
  const v148=read("js/42-v148-combat-dungeon-fixes.js");
  const v155=read("js/46-v155-dev-fixes.js");
  const progression=read("js/60-v173.64-skill-progression-rebalance.js");
  const vfx=read("js/39-v143-skill-animation.js");
  const relic=read("js/60-team-relic-system.js");
  const relicCss=read("css/55-team-relic-system.css");
  const fixedCss=read("css/fixed-slot-battlefield-rendering-v2.css");
  const featureBoundary=read("js/20-anonymous-20.js");

  assert.match(main,/function getEffectiveSkillTargetType\(skill,level\)/);
  assert.match(main,/targetTypeAtMaxLevel/);
  assert.match(main,/getSkillFreezeChanceAtLevel/);
  assert.match(main,/getSkillFreezeDurationAtLevel/);
  assert.match(progression,/freeze:\{[\s\S]*?targetType:"column",targetTypeAtMaxLevel:"tri"/);
  assert.match(main,/function createBattleTargetContract[\s\S]*?targetTypeOverride/);
  assert.match(vfx,/contract&&contract\.targetType/);
  assert.match(vfx,/targetSide:targetSide,targetType:targetType/);

  const genericHeal=v141.slice(v141.indexOf('if(skillId==="healSpell")'),v141.indexOf('}else if(skillId==="barrier")'));
  const northHeal=v155.slice(v155.indexOf("function resolveNorthHeal"),v155.indexOf("window.v155ResolveNorthHeal"));
  assert.doesNotMatch(genericHeal,/cleanseAll|statusEffects=ally\.statusEffects\.filter/);
  assert.doesNotMatch(northHeal,/cleanseAll|statusEffects=ally\.statusEffects\.filter/);
  assert.match(v141,/skillId==="dodgeSkill"[\s\S]*?supportTargeting\.entries/);
  assert.match(v155,/function resolveWindEliteDodge[\s\S]*?allyTriTargeting/);
  assert.doesNotMatch(v148,/snapshotActivePartyBuffs|restoreActivePartyBuffs/);

  assert.match(relic,/document\.body\.appendChild\(node\)/);
  assert.match(relic,/function relicOverlayGeometry\(\)[\s\S]*?getBattlefieldOverlayGeometry/);
  assert.match(relic,/function revealRelicTargets\(target\)[\s\S]*?getUnitGeometry[\s\S]*?artworkProjection[\s\S]*?hpProjection/);
  assert.doesNotMatch(relic,/team-relic-mask-holes|createElementNS\(namespace,"rect"\)/);
  assert.match(relicCss,/body > \.team-relic-battle-presentation\{[\s\S]*?z-index:18090/);
  assert.match(relicCss,/team-relic-cinematic-active > \.v143-skill-stage\{z-index:18130/);
  assert.match(fixedCss,/turn-target-row\.skill-picker-open\{[\s\S]*?bottom:calc\(var\(--battle-command-visual-height\) \+ 44px\)/);
  assert.match(fixedCss,/#skillQuickBar\.skill-quick-bar\{[\s\S]*?top:-82px[\s\S]*?bottom:0/);
  assert.doesNotMatch(featureBoundary,/MutationObserver/);
  assert.match(bottomNav,/trainingActive[\s\S]*?\?"training"/);
  assert.match(v148,/FourSymbolsBottomNav\?\.syncContext\(\)/);
  assert.doesNotMatch(v148,/trainingActive[\s\S]*?\?"training"/);
});

test("all formal battle status assets are WebP files",()=>{
  for(const name of STATUS_ASSETS){
    const file=path.join(ROOT,"assets","vfx","status",name);
    assert.ok(fs.existsSync(file),name+" should exist");
    const data=fs.readFileSync(file);
    assert.ok(data.length>16,name+" should not be empty");
    assert.equal(data.subarray(0,4).toString("ascii"),"RIFF",name+" should be RIFF");
    assert.equal(data.subarray(8,12).toString("ascii"),"WEBP",name+" should be WebP");
  }
});
