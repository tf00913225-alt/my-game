import fs from "node:fs";

const read=file=>fs.readFileSync(file,"utf8");
const write=(file,text)=>fs.writeFileSync(file,text);
function replaceRequired(file,before,after){
  const text=read(file);
  if(!text.includes(before)) throw new Error(`Missing expected text in ${file}: ${before.slice(0,100)}`);
  write(file,text.replace(before,after));
}
function replaceRegexRequired(file,regex,replacement){
  const text=read(file);
  if(!regex.test(text)) throw new Error(`Missing expected pattern in ${file}: ${regex}`);
  regex.lastIndex=0;
  write(file,text.replace(regex,replacement));
}

// Preserve the canonical fixed 1080x1920 step-two safe-area action contract.
replaceRequired(
  "css/29-v125-character-creation-native.css",
  `/* Step two remains fixed and non-scrollable, but its actions stay in normal\n   flow so Android does not promote a second oversized compositing tile. */\n#creationPage .creation-step-two{\n    padding-bottom:0;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:static;\n    z-index:40;\n    margin-top:auto;\n}`,
  `/* Step two is a fixed, non-scrollable 1080x1920 canvas. Keep its final\n   actions anchored inside the safe area instead of letting flex-shrink\n   collapse the row when typography or browser metrics consume more room. */\n#creationPage .creation-step-two{\n    padding-bottom:154px;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:absolute;\n    left:0;\n    right:0;\n    bottom:0;\n    z-index:40;\n    margin-top:0;\n}`
);

// Keep the Gameplay BOSS owner stylesheet priority-free and make its comments match 9:16.
replaceRequired(
  "css/gameplay-boss-tower.css",
  `#game-stage #battlePage .battle-monster.gameplay-boss-card .damage-popup{\n    display:none !important;\n}`,
  `#game-stage #battlePage .battle-monster.gameplay-boss-card .damage-popup{\n    display:none;\n}`
);
replaceRequired(
  "css/gameplay-boss-tower.css",
  `/* Gameplay activity covers use the same 16:9 production ratio as dungeon\n   covers. Combat BOSS/mechanism cards remain independent 4:3 components. */`,
  `/* Gameplay activity covers use the same 16:9 production ratio as dungeon\n   covers. Combat BOSS/mechanism cards remain independent 9:16 components. */`
);

// The compact auth dialog is the new Android-safe owner geometry; no backdrop-filter compositor.
{
  const file="tests/firebase-auth-foundation.test.mjs";
  let text=read(file);
  const oldDialog='    assert.match(css, /\\.firebase-auth-dialog\\{[\\s\\S]*width:min\\(92vw,420px\\);[\\s\\S]*max-height:100%;[\\s\\S]*overflow-y:auto/);';
  const oldCompact='    assert.match(css, /V174 compact auth over second startup scene[\\s\\S]*startup-main-city\\.[0-9a-f]{12}\\.jpg[\\s\\S]*width:min\\(calc\\(100% - 20px\\),390px\\)/);';
  if(!text.includes(oldDialog)||!text.includes(oldCompact)) throw new Error("Historical auth assertions were not found");
  text=text.replace(oldDialog,'    assert.match(css, /\\.firebase-auth-dialog\\{[\\s\\S]*width:min\\(calc\\(100% - 20px\\),390px\\);[\\s\\S]*max-height:calc\\(100dvh - 24px\\);[\\s\\S]*overflow-y:auto/);\n    assert.match(css, /startup-main-city\\.[0-9a-f]{12}\\.jpg/);\n    assert.doesNotMatch(css, /backdrop-filter\\s*:/);');
  text=text.replace(oldCompact,"");
  write(file,text);
}

// Abyss emperors are BOSSes too; temporary all-BOSS art must cover them even when rank is implicit.
replaceRequired(
  "js/45-v154-dev-fixes.js",
  '        const temporaryBoss=monster.rank==="boss"||monster.unitKind==="boss"||monster.vGameplayBoss===true||monster.v141BattleRank==="boss";',
  '        const temporaryBoss=monster.rank==="boss"||monster.unitKind==="boss"||monster.vGameplayBoss===true||monster.v141BattleRank==="boss"||(monster.v141Abyss===true&&monster.name!=="天兵天將"&&(Object.prototype.hasOwnProperty.call(EARLY_ABYSS_PORTRAITS,monster.name)||Object.prototype.hasOwnProperty.call(FINAL_ABYSS_PORTRAITS,monster.name)));'
);

// Update the focused portrait runtime regression to the temporary presentation contract.
{
  const file="tests/monster-portrait-runtime.test.js";
  let text=read(file);
  text=text.replace('assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/monsters/wild/zone-01/fire-01.png");','assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/dungeons/abyss/soldier.webp");');
  text=text.replace('assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[1]),null);','assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[1]),"assets/dungeons/abyss/soldier.webp");');
  text=text.replace('assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"wild.zone-01.fire-01");','assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"temporary.heavenly-soldier");');
  text=text.replace('assert.equal(runtime.cards[1].style.getPropertyValue("--v152-abyss-portrait"),"");','assert.equal(runtime.cards[1].dataset.monsterPortraitKey,"temporary.heavenly-soldier");');
  text=text.replace('["soldier.water","soldier.earth","soldier.fire","soldier.wind","soldier.water"]','Array(5).fill("temporary.heavenly-soldier")');
  text=text.replace('assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"legacy.abyss.天兵天將");','assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"temporary.heavenly-soldier");');
  text=text.replace(
    'assert.match(source,/target\\.status!=="existing"/);',
    'assert.match(source,/TEMPORARY_MONSTER_PORTRAIT="assets\\/dungeons\\/abyss\\/soldier\\.webp"/);\nassert.match(source,/TEMPORARY_BOSS_PORTRAIT="assets\\/monsters\\/boss\\/boss-placeholder-fire-demon\\.webp"/);\nassert.match(source,/target\\.status!=="existing"/);'
  );
  write(file,text);
}

// V154's old exact Abyss portrait set is intentionally superseded by the temporary switch.
replaceRegexRequired(
  "tests/v154-current-request.test.js",
  /test\("Abyss floors 1 to 4 and floor 5 receive their exact portrait sets",\(\)=>\{[\s\S]*?\n\}\);\n\ntest\("all six supplied floor 5 portraits/,
  `test("temporary portrait switch uses the Boss reference for Abyss emperors and Heavenly Soldier art for soldiers",()=>{\n    ["東帝","南帝","天帝","北帝"].forEach(bossName=>{\n        const names=[bossName,"天兵天將","天兵天將","天兵天將","天兵天將"];\n        const early=loadRuntime({currentBattleMonsters:[0,1,2,3,4],monsters:names.map(name=>({name,v141Abyss:true}))});\n        early.context.v154SyncAbyssPortraits();\n        assert.ok(early.cards[0].style.getPropertyValue("--v152-abyss-portrait").endsWith('boss-placeholder-fire-demon.webp")'));\n        assert.match(early.cards[1].style.getPropertyValue("--v152-abyss-portrait"),/soldier\\.webp/);\n        assert.ok(early.cards[0].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("boss-placeholder-fire-demon.webp"));\n        assert.ok(early.cards[1].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("soldier.webp"));\n        assert.equal(early.cards[0].dataset.abyssPortrait,"floor1-4");\n    });\n\n    const finalNames=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊","天兵天將","天兵天將","天兵天將","天兵天將","天兵天將"];\n    const final=loadRuntime({currentBattleMonsters:finalNames.map((_,index)=>index),monsters:finalNames.map(name=>({name,v141Abyss:true}))});\n    final.context.v154SyncAbyssPortraits();\n    for(let index=0;index<5;index++){\n        assert.ok(final.cards[index].style.getPropertyValue("--v152-abyss-portrait").endsWith('boss-placeholder-fire-demon.webp")'));\n        assert.ok(final.cards[index].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("boss-placeholder-fire-demon.webp"));\n    }\n    assert.match(final.cards[5].style.getPropertyValue("--v152-abyss-portrait"),/soldier\\.webp/);\n    assert.ok(final.cards[5].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("soldier.webp"));\n    assert.equal(final.cards[0].dataset.abyssPortrait,"floor5");\n    assert.equal(final.battlePage.classList.contains("v154-abyss-final"),true);\n});\n\ntest("all six supplied floor 5 portraits`
);

console.log("Applied scoped CI follow-up for canonical creation actions, Android-safe auth, 9:16 BOSS UI, and temporary monster/BOSS portraits.");
