const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

const STATUS_ASSETS=[
  "burn.webp","rage.webp","rage-icon.webp","frostbite-icon.webp","freeze.webp",
  "gravity-icon.webp","damage-down-icon.webp","stun-icon.webp","windwalk.webp",
  "stealth.webp","calm-mind.webp","defense-down-icon.webp","shield.webp",
  "petrify.webp","earth-shield.webp","rock-wall.webp","barrier.webp",
  "yuan-zu-blessing.webp","fire-momentum-icon.webp","phoenix-might-icon.webp",
  "fire-soul-resonance.webp","blood-burn.webp","stun.webp"
];

test("persistent status icons are static while body states stay pulse/static",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/frostbite:statusVisual\("","icon","statusEffects"/);
  assert.match(js,/fireMomentum:statusVisual\("","icon","activeBuffs"/);
  assert.match(js,/burn:statusVisual\("assets\/vfx\/status\/burn\.webp","pulse"/);
  assert.match(js,/freeze:statusVisual\("assets\/vfx\/status\/freeze\.webp","static"/);
  assert.doesNotMatch(js,/statDown:statusVisual/);
  assert.match(css,/\.v143-status-icon--pulse\{[\s\S]*?animation:none !important;/);
  assert.match(css,/\.v143-status-visual--pulse\{[\s\S]*?v143StatusImageBreath/);
});

test("status body art can reach card edges and remains larger than the old footprint",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/regularEnemy=side==="monster"&&!isBossIndexForVfx\(index\)/);
  assert.match(js,/const widthScale=\(regularEnemy\?1\.45:1\.40\)\*\(shellStatus\?1\.08:1\)/);
  assert.match(js,/const heightScale=\(regularEnemy\?1\.36:1\.34\)\*\(shellStatus\?1\.08:1\)/);
  assert.match(js,/anchor\.rect\.width\*widthScale/);
  assert.match(js,/cardRect\.width\*widthScale/);
  assert.match(js,/anchor\.rect\.height\*heightScale/);
  assert.match(js,/cardRect\.height\*heightScale/);
  assert.match(js,/node\.style\.backgroundSize="contain"/);
});

test("body-art statuses do not duplicate a HUD icon but detail data keeps iconSrc",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/if\(spec\.mode==="icon"\)[\s\S]*?host\.appendChild\(createStatusIcon\(type,spec\)\)[\s\S]*?else if\(existingIcon\)/);
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

  assert.match(relic,/const host=battlePage\|\|null/);
  assert.match(relicCss,/team-relic-battle-dim\{[\s\S]*?z-index:18090/);
  assert.match(relicCss,/team-relic-cinematic-active > \.v143-skill-stage\{z-index:18130/);
  assert.match(fixedCss,/turn-target-row\.skill-picker-open\{[\s\S]*?bottom:calc\(var\(--battle-command-visual-height\) \+ 44px\)/);
  assert.match(fixedCss,/#skillQuickBar\.skill-quick-bar\{[\s\S]*?top:-82px[\s\S]*?bottom:0/);
  assert.doesNotMatch(featureBoundary,/MutationObserver/);
  assert.match(v148,/trainingActive[\s\S]*?\?"training"/);
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
