import fs from "node:fs";
import path from "node:path";

function read(file){ return fs.readFileSync(file,"utf8"); }
function write(file,text){ fs.writeFileSync(file,text); }
function mustReplace(file,before,after){
  const text=read(file);
  if(!text.includes(before)) throw new Error(`Missing expected source in ${file}: ${before.slice(0,120)}`);
  write(file,text.replace(before,after));
}
function replaceAllRequired(file,before,after){
  const text=read(file);
  if(!text.includes(before)) throw new Error(`Missing expected source in ${file}: ${before.slice(0,120)}`);
  write(file,text.split(before).join(after));
}
function mutateBlock(file,selector,mutator){
  const text=read(file);
  const start=text.indexOf(selector);
  if(start<0) throw new Error(`Missing selector in ${file}: ${selector}`);
  const open=text.indexOf("{",start);
  const close=text.indexOf("}",open);
  if(open<0||close<0) throw new Error(`Malformed block in ${file}: ${selector}`);
  const block=text.slice(start,close+1);
  const next=mutator(block);
  if(next===block) throw new Error(`No mutation made for ${selector} in ${file}`);
  write(file,text.slice(0,start)+next+text.slice(close+1));
}
function assertIncludes(file,needle){ if(!read(file).includes(needle)) throw new Error(`Expected ${needle} in ${file}`); }

/* Clean temporary connector staging files and keep one valid placeholder until
   the owner-supplied reference WebP is attached after this automated patch. */
const junk=[
  ".gitkeep","README-placeholder.txt","ATTACHMENT_NOTE.txt","BLOB_COMMIT.txt",
  "FINAL_TEMP.txt","NO_MORE.txt","RETRY.txt","STOP.txt","TEMP.txt","WHY.txt",
  "boss-placeholder-fire-demon.webp.b64-pointer.txt","placeholder-import-pending.txt"
];
fs.mkdirSync("assets/monsters/boss",{recursive:true});
for(const name of junk){ fs.rmSync(path.join("assets/monsters/boss",name),{force:true}); }
fs.copyFileSync("assets/dungeons/abyss/south-emperor.webp","assets/monsters/boss/boss-placeholder-fire-demon.webp");

/* Character creation: keep the fixed 1080x1920 owner, but remove the nested
   scaled scroll surface that produced black compositor tiles on Android. */
mustReplace("css/29-v125-character-creation-native.css",
`    flex:0 0 820px;\n    height:820px;\n    min-height:820px;`,
`    flex:0 0 760px;\n    height:760px;\n    min-height:760px;`);
mustReplace("css/29-v125-character-creation-native.css","    min-height:820px;\n    overflow:hidden;\n    background:#030303;","    min-height:760px;\n    overflow:hidden;\n    background:linear-gradient(180deg,#0c0912,#030303);");
mustReplace("css/29-v125-character-creation-native.css","#creationPage .creation-step-two{\n    padding-top:34px;\n    box-sizing:border-box;\n}","#creationPage .creation-step-two{\n    padding-top:18px;\n    box-sizing:border-box;\n}");
mustReplace("css/29-v125-character-creation-native.css",
`/* Step two is a fixed, non-scrollable 1080x1920 canvas. Keep its final\n   actions anchored inside the safe area instead of letting flex-shrink\n   collapse the row when typography or browser metrics consume more room. */\n#creationPage .creation-step-two{\n    padding-bottom:154px;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:absolute;\n    left:0;\n    right:0;\n    bottom:0;\n    z-index:40;\n    margin-top:0;\n}`,
`/* Step two remains fixed and non-scrollable, but its actions stay in normal\n   flow so Android does not promote a second oversized compositing tile. */\n#creationPage .creation-step-two{\n    padding-bottom:0;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:static;\n    z-index:40;\n    margin-top:auto;\n}`);

mustReplace("css/56-v174-critical-ui-regressions.css",
`    flex-basis:900px;\n    height:900px;\n    min-height:900px;`,
`    flex-basis:760px;\n    height:760px;\n    min-height:760px;`);
mustReplace("css/56-v174-critical-ui-regressions.css","#creationPage .creation-portrait-panel{\n    min-height:900px;\n}","#creationPage .creation-portrait-panel{\n    min-height:760px;\n}");
mustReplace("css/56-v174-critical-ui-regressions.css",
`/* Character creation keeps the portrait fixed while the element explanation\n   alone becomes a native vertical scroller.  The global touch owner explicitly\n   whitelists .creation-role-card; no page-local touch listener is introduced. */\n#creationPage .creation-choice-panel{\n    min-height:0 !important;\n    overflow:hidden !important;\n}\n#creationPage .creation-role-card{\n    flex:1 1 auto !important;\n    min-height:0 !important;\n    max-height:100% !important;\n    overflow-x:hidden !important;\n    overflow-y:auto !important;\n    touch-action:pan-y !important;\n    -webkit-overflow-scrolling:touch !important;\n    overscroll-behavior-y:contain !important;\n    scrollbar-gutter:stable !important;\n}`,
`/* Character creation now fits the fixed canvas without a nested scroll layer.\n   This avoids Android/WebView black compositor tiles inside the scaled stage. */\n#creationPage .creation-choice-panel{\n    min-height:0 !important;\n    overflow:visible !important;\n}\n#creationPage .creation-role-card{\n    flex:0 0 auto !important;\n    min-height:auto !important;\n    max-height:none !important;\n    overflow:visible !important;\n    touch-action:auto !important;\n    -webkit-overflow-scrolling:auto !important;\n    overscroll-behavior-y:auto !important;\n    scrollbar-gutter:auto !important;\n}`);
mustReplace("css/56-v174-critical-ui-regressions.css",
`/* Make combat artwork visibly larger without changing the established seat,\n   HP/SP, targeting or turn geometry. Player art remains contain; monsters keep\n   their existing cover treatment but gain a larger visual bleed. */\n#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit > .v174-battle-art{\n    inset:-24px -20px 30px !important;\n}\n#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit > .v174-battle-art{\n    inset:-16px !important;\n}\n`,
`/* Battle artwork sizing is owned by js/54-v173.51-battle-qa.js. */\n`);

/* Player artwork: exactly 150% of the original contain width while combat seat
   geometry and HP/SP anchors stay unchanged. */
mustReplace("js/54-v173.51-battle-qa.js",
`#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.v174-battle-art{\n    inset:-8px -8px 30px!important;\n    background-size:contain!important;background-position:center bottom!important;\n}`,
`#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.v174-battle-art{\n    inset:-8px -8px 30px!important;\n    background-size:150% auto!important;background-position:center bottom!important;\n}`);

/* Enemy resource bars: same 11px thickness as player HP/SP bars. */
mutateBlock("css/40-v143-combat-dungeon-polish.css","#game-stage #battlePage .battle-monster .monster-hp,",block=>block
  .replace("height:13px !important;","height:11px !important;")
  .replace("min-height:13px !important;","min-height:11px !important;")
  .replace("flex:0 0 13px !important;","flex:0 0 11px !important;"));
mutateBlock("css/40-v143-combat-dungeon-polish.css","#game-stage #battlePage .battle-monster .monster-bar-text",block=>block
  .replace("height:13px !important;","height:11px !important;")
  .replace("line-height:13px !important;","line-height:11px !important;"));

/* Persistent status loops: larger and centered on the actual figure rather than
   the lower card area that includes resource bars. */
mutateBlock("css/40-v143-combat-dungeon-polish.css","#game-stage #battlePage .v153-status-vfx",block=>block.replace("top:50%;","top:44%;"));
mustReplace("js/39-v143-skill-animation.js","        const scale=Number(spec.scale)||1.18;","        const scale=(Number(spec.scale)||1.18)*1.28;");

/* Boss combat card / mechanism owner: portrait 9:16 and no boss damage popup. */
mutateBlock("css/gameplay-boss-tower.css","#game-stage > #app > #game-content #battlePage .battle-monster.gameplay-boss-card[data-rank=\"boss\"]",block=>block.replace("aspect-ratio:4 / 3;","aspect-ratio:9 / 16;"));
mutateBlock("css/gameplay-boss-tower.css","#game-stage #battlePage .battle-monster.gameplay-boss-card .battle-monster-icon",block=>block.replace("aspect-ratio:3 / 1;","aspect-ratio:9 / 11;"));
mutateBlock("css/gameplay-boss-tower.css","#game-stage #battlePage .battle-monster.gameplay-boss-card .damage-popup",block=>`#game-stage #battlePage .battle-monster.gameplay-boss-card .damage-popup{\n    display:none !important;\n}`);
mutateBlock("css/gameplay-boss-tower.css","#game-stage #battleMonsterArea .boss-mechanism-card",block=>block.replace("aspect-ratio:4 / 3;","aspect-ratio:9 / 16;"));
replaceAllRequired("css/gameplay-boss-tower.css","current 4:3 ratio","current 9:16 ratio");

/* Temporary art owner: every monster uses the current Heavenly Soldier art;
   every boss uses the owner-supplied fire-demon reference until dedicated art lands. */
mustReplace("js/45-v154-dev-fixes.js",
`    const MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json";\n    const HEAVENLY_SOLDIER_ELEMENTS=new Set(["fire","water","wind","earth"]);`,
`    const MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json";\n    const HEAVENLY_SOLDIER_ELEMENTS=new Set(["fire","water","wind","earth"]);\n    const TEMPORARY_MONSTER_PORTRAIT="assets/dungeons/abyss/soldier.webp";\n    const TEMPORARY_BOSS_PORTRAIT="assets/monsters/boss/boss-placeholder-fire-demon.webp";`);
mustReplace("js/45-v154-dev-fixes.js",
`    function resolveMonsterPortraitRecord(monster,options){\n        if(!monster){ return null; }\n        const explicitKey=String(monster.portraitKey||monster.monsterPortraitKey||"").trim();`,
`    function resolveMonsterPortraitRecord(monster,options){\n        if(!monster){ return null; }\n        const temporaryBoss=monster.rank==="boss"||monster.unitKind==="boss"||monster.vGameplayBoss===true||monster.v141BattleRank==="boss";\n        return {\n            portraitKey:temporaryBoss?"temporary.boss-reference":"temporary.heavenly-soldier",\n            name:monster.name||"",\n            element:monster.element||"dynamic",\n            rank:temporaryBoss?"boss":(monster.rank||"regular"),\n            sizeClass:temporaryBoss?"boss":"regular",\n            path:temporaryBoss?TEMPORARY_BOSS_PORTRAIT:TEMPORARY_MONSTER_PORTRAIT,\n            status:"existing",\n            temporary:true\n        };\n        /* Dedicated registry resolution is intentionally retained below for the\n           later removal of this temporary all-monster presentation switch. */\n        const explicitKey=String(monster.portraitKey||monster.monsterPortraitKey||"").trim();`);

/* All formal daily dungeons are 50% easier; Abyss remains excluded by the
   existing isFormalDailyDungeonMonster/normalizeDailyDungeonMonster guard. */
mustReplace("js/47-v158-combat-tuning.js",
`    const FORMAL_DAILY_DUNGEON_TYPES=new Set(["exp","material","gold"]);`,
`    const DAILY_DUNGEON_DIFFICULTY_MULTIPLIER=.5;\n    const FORMAL_DAILY_DUNGEON_TYPES=new Set(["exp","material","gold"]);`);
mustReplace("js/47-v158-combat-tuning.js",
`            partyMultiplier:partyMultiplier,\n            levelMultiplier:levelMultiplier,\n            factor:partyMultiplier*levelMultiplier`,
`            partyMultiplier:partyMultiplier,\n            levelMultiplier:levelMultiplier,\n            difficultyMultiplier:DAILY_DUNGEON_DIFFICULTY_MULTIPLIER,\n            factor:partyMultiplier*levelMultiplier*DAILY_DUNGEON_DIFFICULTY_MULTIPLIER`);

/* Simplify boss names while keeping title/rank weight. */
const bossNames=new Map([
  ["赤曜焚牙君","赤焰君"],["燼天獄火侯","獄火侯"],["玄瀾凍海君","凍海君"],
  ["寒魄霜淵侯","霜淵侯"],["冥冰雪獄尊","雪獄尊"],["太陰寒劫尊","寒劫尊"],
  ["玄冥凍界皇","凍界皇"],["永夜霜天皇","霜天皇"],["無極寒獄帝","寒獄帝"],
  ["赤劫熔天災君","熔天君"],["玄劫冰海災皇","冰海皇"],["焚世九曜龍皇","九曜龍皇"],
  ["終劫滅世天魔","滅世天魔"],["炎極鎮天尊","炎天尊"],["赤曜鎮塔使","赤焰使"],
  ["玄冥鎮天尊","玄冥尊"],["寒泉鎮塔使","寒泉使"],["坤嶽鎮天尊","坤嶽尊"],
  ["岩岳鎮塔使","岩岳使"],["巽嵐鎮天尊","巽風尊"],["青嵐鎮塔使","青嵐使"],
  ["四象鎮塔尊","四象尊"]
]);
let gameplay=read("js/gameplay-boss-tower-system.js");
for(const [from,to] of bossNames){
  if(!gameplay.includes(from)) throw new Error(`Missing boss name ${from}`);
  gameplay=gameplay.split(from).join(to);
}
write("js/gameplay-boss-tower-system.js",gameplay);

/* Regression expectations now describe the new final product contract. */
const testDir="tests";
for(const name of fs.readdirSync(testDir)){
  if(!name.endsWith(".js")) continue;
  const file=path.join(testDir,name);
  let text=read(file);
  if(text.includes("gameplay-boss-card")&&text.includes("aspect-ratio:4")){
    text=text.split("aspect-ratio:4 \\/ 3").join("aspect-ratio:9 \\/ 16");
    text=text.split("aspect-ratio:4\\s*\\/\\s*3").join("aspect-ratio:9\\s*\\/\\s*16");
    text=text.split("4:3").join("9:16");
    write(file,text);
  }
}
mustReplace("tests/v1741-battle-gameplay-layout-order.test.js","background-size:contain!important","background-size:150% auto!important");
mustReplace("tests/v174-mobile-ui-exp-guards.test.js",
`assert.match(css,/#creationPage \\.creation-role-card\\{[\\s\\S]*overflow-y:auto !important;[\\s\\S]*touch-action:pan-y !important;/);`,
`assert.match(css,/#creationPage \\.creation-role-card\\{[\\s\\S]*overflow:visible !important;[\\s\\S]*touch-action:auto !important;/);`);
mustReplace("tests/v173.44-current-request.test.js",
`assert.match(tuning,/highestLevel<=15\\?\\.80:highestLevel<=20\\?\\.90:highestLevel<=50\\?1:1\\.05/);`,
`assert.match(tuning,/highestLevel<=15\\?\\.80:highestLevel<=20\\?\\.90:highestLevel<=50\\?1:1\\.05/);\nassert.match(tuning,/DAILY_DUNGEON_DIFFICULTY_MULTIPLIER=\\.5/);\nassert.match(tuning,/factor:partyMultiplier\\*levelMultiplier\\*DAILY_DUNGEON_DIFFICULTY_MULTIPLIER/);`);

assertIncludes("css/gameplay-boss-tower.css","aspect-ratio:9 / 16;");
assertIncludes("js/47-v158-combat-tuning.js","DAILY_DUNGEON_DIFFICULTY_MULTIPLIER=.5");
assertIncludes("js/45-v154-dev-fixes.js","temporary.boss-reference");
console.log("Applied V173.65 owner-level polish patch.");
