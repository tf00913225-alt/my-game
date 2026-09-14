const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");

const early=read("js/35-v141-ui-battle.js");
const polish=read("js/41-v146-system-polish.js");
const finalNav=read("js/42-v148-combat-dungeon-fixes.js");
const navCss=read("css/38-v141-system-expansion.css");
const finalNavCss=read("css/45-v152-dev-fixes.css");
const vfx=read("js/39-v143-skill-animation.js");
const vfxCss=read("css/40-v143-combat-dungeon-polish.css");
const battle=read("js/54-v173.51-battle-qa.js");
const bossCss=read("css/gameplay-boss-tower.css");
const enemy=read("js/38-v143-system-fixes.js");

assert.doesNotMatch(early,/function installDungeonNavigation\(\)[\s\S]*?nav\.innerHTML=/);
assert.doesNotMatch(polish,/function dungeonNavMarkup\(/);
assert.match(finalNav,/function contextNavMarkup\(returnAction\)/);
assert.match(finalNav,/\["角色","assets\/ui\/nav-character\.png"/);
assert.match(finalNav,/\["背包","assets\/ui\/nav-backpack\.png"/);
assert.match(finalNav,/\["秘寶","assets\/ui\/nav-relic-v175\.webp"/);
assert.match(finalNav,/\["元素匣","assets\/ui\/nav-element-box\.png"/);
assert.match(finalNav,/buttons\.push\(\["返回","assets\/ui\/map-return\.png",returnAction\]\)/);
assert.match(finalNav,/\["gameplayPage","bossPage","towerPage"\]/);
assert.match(finalNav,/v148-context-nav-active/);
assert.match(navCss,/\.v148-context-nav-active #v141DungeonNav\{display:grid !important;\}/);
assert.match(navCss,/\.v148-context-nav-active #bottomNav\{display:none !important;\}/);
assert.match(finalNav,/classList\.add\("v148-context-nav"\)/);
assert.match(finalNavCss,/#v141DungeonNav\.v148-context-nav,[\s\S]*?width:420px !important;[\s\S]*?height:84px !important;/);
assert.match(finalNavCss,/#v141DungeonNav \.nav-art-button\{[\s\S]*?height:72px !important;/);

assert.match(vfx,/className="v143-vfx-frame"/);
assert.match(vfx,/frame\.style\.backgroundImage=imageValue/);
assert.match(vfxCss,/\.v143-skill-stage\{[\s\S]*?overflow:visible;[\s\S]*?contain:layout style;/);
assert.match(vfxCss,/\.v143-vfx-sprite\{[\s\S]*?overflow:visible;[\s\S]*?background-image:none !important;/);
assert.match(vfxCss,/\.v143-vfx-frame\{[\s\S]*?overflow:hidden;/);
assert.match(vfxCss,/v143-vfx-sprite-active > \.v143-vfx-frame[\s\S]*?v143RasterCastFrames/);

assert.match(battle,/battle-player\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?inset:-2px -2px 30px!important;[\s\S]*?background-size:contain!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.battle-monster-name\{[\s\S]*?top:auto!important;bottom:0!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?background-size:contain!important/);
assert.doesNotMatch(battle,/battle-monster\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?background-size:cover!important/);
assert.doesNotMatch(vfxCss,/battleMonsterArea \.v131-monster-row\{[\s\S]*?padding-bottom:18px/);
assert.match(battle,/monster-hp\{[\s\S]*?bottom:29px!important/);
assert.match(battle,/monster-sp\{[\s\S]*?bottom:16px!important/);
assert.match(enemy,/setProperty\("font-size","9px","important"\)/);
assert.match(bossCss,/gameplay-boss-card\[data-rank="boss"\][\s\S]*?overflow:visible;/);
console.log("shared nav / unclipped VFX / battle presentation regression guard passed");
