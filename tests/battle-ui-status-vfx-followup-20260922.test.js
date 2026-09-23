const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

test("persistent body status owner keeps hard-control base fixed under the two-second rotating layer",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/const STATUS_ROTATION_MS=2000/);
  assert.match(js,/const statusRotationByUnit=new Map\(\)/);
  assert.match(js,/HARD_CONTROL_BASE:"hard-control-base"/);
  assert.match(js,/ROTATING:"rotating"/);
  assert.match(js,/HUD:"hud"/);
  assert.match(js,/freeze:statusVisual\([\s\S]*?visualLayer:STATUS_VISUAL_LAYERS\.HARD_CONTROL_BASE/);
  assert.match(js,/petrify:statusVisual\([\s\S]*?visualLayer:STATUS_VISUAL_LAYERS\.HARD_CONTROL_BASE/);
  assert.match(js,/const rotatingBodyTypes=activeBodyStatusTypesForLayer\([\s\S]*?STATUS_VISUAL_LAYERS\.ROTATING/);
  assert.match(js,/rotation\.index=\(rotation\.index\+1\)%rotatingBodyTypes\.length/);
  assert.match(js,/baseBodyTypes\.includes\(type\)/);
  assert.match(js,/type===activeRotatingBodyType/);
  assert.match(js,/syncStatusVisualEffects\(true\)/);
  assert.doesNotMatch(js,/Math\.floor\(Date\.now\(\)\/STATUS_ROTATION_MS\)/);
  assert.match(js,/stun:statusVisual\("assets\/vfx\/status\/stun\.webp","pulse"/);
  assert.match(css,/--v143-status-layer-hard-control-base:4/);
  assert.match(css,/--v143-status-layer-rotating:5/);
  assert.match(css,/--v143-status-layer-hud:20/);
  assert.match(css,/\.v143-status-visual--layer-hard-control-base\{[\s\S]*?z-index:var\(--v143-status-layer-hard-control-base\)/);
  assert.match(css,/\.v143-status-icon\{[\s\S]*?width:24px;[\s\S]*?height:24px;/);
  assert.match(css,/\.v143-status-visual--pulse\{[\s\S]*?animation:v143StatusImageBreath 2s ease-in-out infinite/);
  assert.match(css,/\.v143-status-visual-freeze\{[\s\S]*?animation:none/);
  assert.match(css,/\.v143-status-visual-petrify\{[\s\S]*?animation:none/);
});

test("battle information handles and turn timer follow the requested interaction contract",()=>{
  const html=read("index.html");
  const css=read("css/fixed-slot-battlefield-rendering-v2.css");
  const js=read("js/00-main.js");
  const stats=read("js/battle-statistics-system.js");
  assert.match(html,/id="battleInfoToggle"[\s\S]*?>戰鬥資訊<\/button>/);
  assert.ok(html.indexOf('id="battleActionRegion"')<html.indexOf('id="turnTargetRow"'),"turn row should be inside the battle action region");
  assert.match(css,/#battleActionRegion > \.turn-target-row[\s\S]*?opacity:1/);
  assert.match(css,/\.turn-target-row\.skill-picker-open,[\s\S]*?\.battle-item-open,[\s\S]*?#battleActionRegion\.target-selecting > \.turn-target-row\{[\s\S]*?opacity:\.25/);
  assert.match(css,/\.battle-info-region #battleTurnIndicator\{[\s\S]*?opacity:1/);
  assert.match(css,/\.battle-info-region\.is-expanded #battleTurnIndicator\{[\s\S]*?opacity:0/);
  assert.match(stats,/aria-label","戰鬥數據"/);
  assert.match(stats,/innerHTML="<span>戰<\/span><span>鬥<\/span><span>數<\/span><span>據<\/span>"/);
  assert.match(js,/function syncBattleUiPriorityLayer\(\)/);
  assert.match(js,/function installBattleInfoHandleDrag\(\)/);
  assert.match(css,/\.battle-info-toggle\{[\s\S]*?border:1px solid rgba\(210,158,64,\.9\);[\s\S]*?box-shadow:none;[\s\S]*?touch-action:none;[\s\S]*?cursor:ew-resize/);
  assert.match(css,/\.battle-info-region:not\(\.is-expanded\)\{[\s\S]*?background:rgba\(0,0,0,\.92\);[\s\S]*?box-shadow:none/);
  assert.match(js,/toggle\.textContent=next\?"返回":"戰鬥資訊"/);
  const mainCss=read("css/00-main.css");
  assert.match(mainCss,/\.skill-quick-button \.sq-sp-block\[hidden\]\{[\s\S]*?display:none;/);
  assert.match(mainCss,/#battlePage\{[\s\S]*?--battle-command-row-height:66px;[\s\S]*?--battle-command-art-overhang:34px;[\s\S]*?--battle-command-visual-height:calc\(var\(--battle-command-row-height\) \+ var\(--battle-command-art-overhang\)\);/);
  assert.doesNotMatch(mainCss,/--battle-center-min-height/);
  assert.doesNotMatch(css,/--battle-command-row-height:66px|--battle-command-art-overhang:34px/);
  assert.match(css,/grid-template-rows:[\s\S]*?minmax\(0,var\(--battle-center-region-track\)\)/);
  assert.match(css,/#battleActionRegion > \.turn-target-row\{[\s\S]*?position:absolute;[\s\S]*?bottom:var\(--battle-command-visual-height\)/);
});

test("interactive battlefield overlays outrank detached VFX and damage popups",()=>{
  const mainCss=read("css/00-main.css");
  const fixedCss=read("css/fixed-slot-battlefield-rendering-v2.css");
  const statsCss=read("css/battle-statistics-system.css");
  const vfxCss=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(mainCss,/#game-stage\.battle-ui-priority\{[\s\S]*?z-index:18000/);
  assert.match(fixedCss,/\.battle-info-region\{[\s\S]*?z-index:18060 !important/);
  assert.match(statsCss,/z-index:18072/);
  assert.match(vfxCss,/\.battle-status-detail-modal\{[\s\S]*?z-index:18120/);
  assert.match(vfxCss,/body\.v174-battle-reading-open > \.v143-skill-stage,[\s\S]*?visibility:hidden !important;[\s\S]*?opacity:0 !important/);
  assert.match(fixedCss,/\.battle-info-region:not\(\.is-expanded\)\{[\s\S]*?background:rgba\(0,0,0,\.92\);[\s\S]*?box-shadow:none/);
  assert.match(fixedCss,/\.battle-info-region\.is-expanded\{[\s\S]*?background:rgba\(8,8,8,\.96\);[\s\S]*?box-shadow:none/);
});

test("new skill icons and 4x3 cast sheets use dedicated WebP runtime assets",()=>{
  const main=read("js/00-main.js");
  const vfx=read("js/39-v143-skill-animation.js");
  const assets=[
    "assets/skills/fire-soul-resonance.webp",
    "assets/skills/fire-blood-burn.webp",
    "assets/skills/water-purify-mind.webp",
    "assets/vfx/fire/fire-soul-resonance-cast.webp",
    "assets/vfx/fire/blood-burn-art-cast.webp",
    "assets/vfx/water/purify-mind-cast.webp",
    "assets/vfx/status/stun.webp"
  ];
  assert.match(main,/fireSoulResonance:"assets\/skills\/fire-soul-resonance\.webp"/);
  assert.match(main,/bloodBurnArt:"assets\/skills\/fire-blood-burn\.webp"/);
  assert.match(main,/purifyMind:"assets\/skills\/water-purify-mind\.webp"/);
  assert.match(vfx,/fireSoulResonance:\{[\s\S]*?fire-soul-resonance-cast\.webp/);
  assert.match(vfx,/bloodBurnArt:\{[\s\S]*?blood-burn-art-cast\.webp/);
  assert.match(vfx,/purifyMind:\{[\s\S]*?purify-mind-cast\.webp/);
  for(const relative of assets){
    const data=fs.readFileSync(path.join(ROOT,relative));
    assert.equal(data.subarray(0,4).toString("ascii"),"RIFF",relative);
    assert.equal(data.subarray(8,12).toString("ascii"),"WEBP",relative);
  }
});

test("dense battle portraits no longer run a permanent compositor animation",()=>{
  const css=read("css/fixed-slot-battlefield-rendering-v2.css");
  const artRule=css.match(/\.v-fixed-battle-slot > \.battle-monster > \.v174-battle-art,[\s\S]*?\.v-fixed-ally-slot > \.battle-player > \.v174-battle-art\{([\s\S]*?)\n\}/);
  assert.ok(artRule,"canonical portrait art rule should exist");
  assert.match(artRule[1],/animation:none !important/);
  assert.doesNotMatch(artRule[1],/will-change:transform,filter/);
  assert.match(css,/\.v174-cardless-unit > \.v174-battle-art::after\{[\s\S]*?opacity:\.72/);
});

test("battle target selection avoids the dense compositor and unrelated global UI rebuild",()=>{
  const main=read("js/00-main.js");
  const fixed=read("css/fixed-slot-battlefield-rendering-v2.css");
  const start=main.indexOf("function selectBattleTarget(index)");
  const end=main.indexOf("function executeAction(",start);
  const selectBlock=main.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(selectBlock,/updateUI\(\)/);
  assert.match(fixed,/\.battle-monster\.v174-cardless-unit\.targetable::after,[\s\S]*?animation:none !important;[\s\S]*?filter:none !important/);
  assert.match(fixed,/\.battle-player\.v174-cardless-unit\.active-turn::after\{[\s\S]*?animation:none !important/);
});
