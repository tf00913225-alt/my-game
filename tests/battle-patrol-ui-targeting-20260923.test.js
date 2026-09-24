const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

test("self target contract and allyTri animation primary anchor stay canonical",()=>{
  const main=read("js/00-main.js");
  const dungeon=read("js/42-v148-combat-dungeon-fixes.js");
  assert.match(main,/if\(targetType==="self"\)\{[\s\S]*?primary=actorIndex;[\s\S]*?ids=\[actorIndex\];[\s\S]*?\}/);
  assert.match(dungeon,/function selectedSupportPrimary\(characterIndex,queued,targets\)\{[\s\S]*?queued\.targetAlly[\s\S]*?targets\.includes\(selected\)\?selected:targets\[0\]/);
  assert.match(dungeon,/const primaryTarget=selectedSupportPrimary\(characterIndex,queued,requested\);[\s\S]*?animateSupportCast\(state,characterIndex,skill,primaryTarget,requested,"player",skill\.targetType\)/);
  assert.match(dungeon,/const primaryTarget=selectedSupportPrimary\(characterIndex,queued,targets\);[\s\S]*?animateSupportCast\(state,characterIndex,skill,primaryTarget,targets,"player",skill\.targetType\)/);
});

test("skill descriptions use percent symbols instead of 個百分點",()=>{
  const skill=read("js/60-v173.64-skill-progression-rebalance.js");
  assert.doesNotMatch(skill,/個百分點/);
});

test("battle info tab is fixed and turn countdown remains fully visible",()=>{
  const main=read("js/00-main.js");
  const css=read("css/fixed-slot-battlefield-rendering-v2.css");
  assert.doesNotMatch(main,/installBattleInfoHandleDrag|__battleInfoHandleDragInstalled|__suppressNextBattleInfoClick/);
  assert.doesNotMatch(css,/battle-info-toggle\.is-dragging|cursor:ew-resize/);
  assert.match(css,/#battleInfoToggle\.battle-info-toggle\{[\s\S]*?right:4px;[\s\S]*?touch-action:manipulation;[\s\S]*?cursor:pointer/);
  assert.match(css,/#battleActionRegion > \.turn-target-row\{[\s\S]*?z-index:18070 !important/);
  assert.match(css,/\.turn-target-row\.skill-picker-open\{[\s\S]*?bottom:calc\(var\(--battle-command-visual-height\) \+ 44px\);[\s\S]*?opacity:1/);
  assert.match(css,/\.turn-target-row\.battle-item-open\{[\s\S]*?opacity:1/);
  assert.match(css,/#battleActionRegion\.target-selecting > \.turn-target-row\{[\s\S]*?opacity:1/);
});

test("patrol navigation is a five-key shared-owner shell and appearance switch is raised",()=>{
  const html=read("index.html");
  const mainCss=read("css/00-main.css");
  const patrolCss=read("css/32-v131-patrol-appearance.css");
  const dungeon=read("js/42-v148-combat-dungeon-fixes.js");
  assert.doesNotMatch(html,/mapPageReturnFloat/);
  assert.doesNotMatch(mainCss,/\.map-page-return-float/);
  assert.match(html,/<div id="mapPageNav" class="bottom-nav map-page-nav"><\/div>/);
  assert.match(mainCss,/#app\.on-map-page #mapPageNav\{[\s\S]*?grid-template-columns:repeat\(5,1fr\)/);
  assert.match(dungeon,/labels!=="角色\|背包\|秘寶\|元素匣\|返回"/);
  assert.match(dungeon,/renderContextNav\(patrolNav,"leaveMap\(\)","patrol"\)/);
  assert.match(patrolCss,/#v131PatrolAppearanceSwitchWrap\{[\s\S]*?top:12px;/);
});

test("system contracts permanently forbid patrol duplicate return and battle-info dragging",()=>{
  const contracts=read("SYSTEM_CONTRACTS.md");
  assert.match(contracts,/Battle Info Tab 固定錨定於戰鬥畫面右下；不可拖曳、不可自由定位/);
  assert.match(contracts,/順序固定為「角色／背包／秘寶／元素匣／返回」/);
  assert.match(contracts,/回合／倒數列必須保持 100% 可見/);
});
