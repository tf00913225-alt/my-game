"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");

test("persistent body statuses rotate one at a time every second",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/const STATUS_CAROUSEL_MS=1000/);
  assert.match(js,/bodyTypes\[state\.statusCarouselStep%bodyTypes\.length\]/);
  assert.match(js,/statusCarouselTimer=setTimer/);
  assert.doesNotMatch(js,/setInterval\(/);
  assert.match(js,/anchor\.rect\.width\*\.84/);
  assert.match(js,/anchor\.rect\.height\*\.88/);
  assert.match(js,/stun:statusVisual\("assets\/vfx\/status\/stun\.webp","pulse"/);
  assert.match(css,/\.v143-status-icon\{[\s\S]*?width:16px;[\s\S]*?height:16px/);
  assert.match(css,/@keyframes v143StatusImageBreath\{[\s\S]*?50%\{opacity:1\}/);
});

test("battle reading surfaces suppress transient VFX paint without pausing battle",()=>{
  const main=read("js/00-main.js");
  const stats=read("js/battle-statistics-system.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  const contract=read("SYSTEM_CONTRACTS.md");
  assert.match(main,/v174-battle-status-detail-open/);
  assert.match(main,/v174-battle-info-open/);
  assert.match(stats,/v174-battle-insight-open/);
  assert.match(css,/body\.v174-battle-status-detail-open > \.v143-skill-stage/);
  assert.match(css,/body\.v174-battle-info-open > \.damage-popup\.v152-top-damage/);
  assert.match(css,/body\.v174-battle-insight-open > \.skill-name-badge\.v143-caster-skill-label/);
  assert.doesNotMatch(stats,/acquireDrawerPause|acquirePauseLock/);
  assert.match(contract,/閱讀介面具有顯示優先權/);
});

test("battle info and stats drawer labels match the follow-up UI contract",()=>{
  const html=read("index.html");
  const main=read("js/00-main.js");
  const fixed=read("css/fixed-slot-battlefield-rendering-v2.css");
  const stats=read("js/battle-statistics-system.js");
  const statsCss=read("css/battle-statistics-system.css");
  assert.match(html,/id="battleInfoToggle"[\s\S]*?<span aria-hidden="true">戰鬥資訊<\/span>/);
  assert.doesNotMatch(html,/id="battleInfoToggle"[\s\S]{0,500}<span aria-hidden="true">⌃<\/span>/);
  assert.match(fixed,/\.battle-info-toggle\{[\s\S]*?width:92px/);
  assert.match(fixed,/\.battle-info-region #battleTurnIndicator\{[\s\S]*?left:4px;[\s\S]*?opacity:1/);
  assert.match(fixed,/\.battle-info-region\.is-expanded #battleTurnIndicator\{[\s\S]*?opacity:0/);
  assert.match(stats,/aria-label","戰鬥數據"/);
  assert.match(stats,/<header><b>戰鬥數據<\/b>/);
  assert.match(statsCss,/\.battle-insight-drawer\{[\s\S]*?z-index:220/);
  assert.match(main,/classList\.toggle\("v174-battle-info-open",next\)/);
});

test("manual countdown stays above controls and dims to 25 percent during operation selection",()=>{
  const main=read("js/00-main.js");
  const fixed=read("css/fixed-slot-battlefield-rendering-v2.css");
  assert.match(main,/turnRow\.classList\.toggle\([\s\S]*?"battle-operation-active"[\s\S]*?skillOpen \|\| itemOpen \|\| targetSelecting/);
  assert.match(main,/setBattleTargetSelectionMode[\s\S]*?syncTurnTimerWithBattlePickers\(\)/);
  assert.match(main,/setBattleAllyTargetSelectionMode[\s\S]*?syncTurnTimerWithBattlePickers\(\)/);
  assert.match(fixed,/\.turn-target-row\{[\s\S]*?z-index:95;[\s\S]*?pointer-events:none/);
  assert.match(fixed,/\.turn-target-row\.battle-operation-active\{[\s\S]*?opacity:\.25;[\s\S]*?pointer-events:none/);
});

test("new skill icons and 4x3 VFX are formally wired as WebP",()=>{
  const main=read("js/00-main.js");
  const vfx=read("js/39-v143-skill-animation.js");
  const progression=read("js/60-v173.64-skill-progression-rebalance.js");
  const files=[
    "assets/skills/water-purify-mind.webp",
    "assets/skills/fire-soul-resonance.webp",
    "assets/skills/fire-blood-burn-art.webp",
    "assets/vfx/water/purify-mind-cast.webp",
    "assets/vfx/fire/fire-soul-resonance-cast.webp",
    "assets/vfx/fire/blood-burn-art-cast.webp",
    "assets/vfx/status/stun.webp"
  ];
  for(const file of files){
    const full=path.join(ROOT,file);
    assert.ok(fs.existsSync(full),file+" missing");
    const data=fs.readFileSync(full);
    assert.ok(data.length>16,file+" empty");
    assert.equal(data.subarray(0,4).toString("ascii"),"RIFF",file);
    assert.equal(data.subarray(8,12).toString("ascii"),"WEBP",file);
  }
  assert.match(main,/purifyMind:"assets\/skills\/water-purify-mind\.webp"/);
  assert.match(main,/fireSoulResonance:"assets\/skills\/fire-soul-resonance\.webp"/);
  assert.match(main,/bloodBurnArt:"assets\/skills\/fire-blood-burn-art\.webp"/);
  assert.match(vfx,/purifyMind:[\s\S]*?purify-mind-cast\.webp/);
  assert.match(vfx,/fireSoulResonance:[\s\S]*?fire-soul-resonance-cast\.webp/);
  assert.match(vfx,/bloodBurnArt:[\s\S]*?blood-burn-art-cast\.webp/);
  assert.match(progression,/iconAssetPath:"assets\/skills\/fire-soul-resonance\.webp"/);
  assert.match(progression,/vfxAssetPath:"assets\/vfx\/fire\/blood-burn-art-cast\.webp"/);
});
