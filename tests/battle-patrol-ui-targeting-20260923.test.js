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

test("battle log is retired and turn countdown remains fully visible",()=>{
  const main=read("js/00-main.js");
  const css=read("css/fixed-slot-battlefield-rendering-v2.css");
  assert.doesNotMatch(main,/installBattleInfoHandleDrag|__battleInfoHandleDragInstalled|__suppressNextBattleInfoClick/);
  assert.doesNotMatch(css,/battle-info-toggle\.is-dragging|cursor:ew-resize/);
  assert.doesNotMatch(css,/battleInfoToggle/,"retired battle log UI must stay absent");
  assert.match(css,/#battleActionRegion > \.turn-target-row\{[\s\S]*?z-index:18070 !important/);
  assert.match(css,/\.turn-target-row\.skill-picker-open\{\s*top:calc\(100% - var\(--battle-command-row-height\) - var\(--battle-skill-menu-top-offset\) \+ 14px\);\s*right:94px;\s*bottom:auto;/,"readable skill picker keeps its timer in the header clear of cards/Return");
  assert.match(css,/--battle-skill-menu-top-offset:188px;/);
  assert.match(css,/\.turn-target-row\.battle-item-open\{\s*top:auto;\s*bottom:calc\(var\(--battle-item-menu-bottom\) \+ var\(--battle-item-menu-height\) \+ var\(--battle-item-menu-gap\)\);\s*opacity:1;/,"item timer follows actual menu bounds, not the retired footer offset");
  assert.match(css,/\.turn-target-row\.skill-picker-open\{[^}]*opacity:1;/);
  assert.match(css,/\.turn-target-row\.battle-item-open\{[^}]*opacity:1;/);
  assert.match(css,/#battleActionRegion\.target-selecting > \.turn-target-row\{[\s\S]*?opacity:1/);
});

test("patrol navigation is a five-key shared-owner shell and appearance switch is raised",()=>{
  const html=read("index.html");
  const mainCss=read("css/00-main.css");
  const patrolCss=read("css/32-v131-patrol-appearance.css");
  const shell=read("js/04-stage-v11-native-bottom-nav-runtime.js");
  assert.doesNotMatch(html,/mapPageReturnFloat/);
  assert.doesNotMatch(mainCss,/\.map-page-return-float/);
  assert.doesNotMatch(html,/<div id="mapPageNav"/);
  assert.match(read("css/06-stage-v11-native-bottom-nav.css"),/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(shell,/\["秘寶","assets\/ui\/nav-relic-v175\.webp"/);
  assert.match(shell,/"leaveMap\(\)"/);
  assert.match(patrolCss,/#v131PatrolAppearanceSwitchWrap\{[\s\S]*?top:12px;/);
});

test("system contracts preserve patrol navigation and retire battle log UI",()=>{
  const contracts=read("SYSTEM_CONTRACTS.md");
  assert.match(contracts,/戰鬥資訊抽屜、巡怪與深淵戰鬥紀錄 UI 已退場/);
  assert.match(contracts,/順序固定為「角色／背包／秘寶／元素匣／返回」/);
  assert.match(contracts,/回合／倒數列必須保持 100% 可見/);
});
