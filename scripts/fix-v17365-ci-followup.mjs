import fs from "node:fs";

// This one-off follow-up runs only on the repair branch; the workflow checks out full history for baseline-regression suites.
const creationFile="css/29-v125-character-creation-native.css";
let creation=fs.readFileSync(creationFile,"utf8");
const temporary=`/* Step two remains fixed and non-scrollable, but its actions stay in normal\n   flow so Android does not promote a second oversized compositing tile. */\n#creationPage .creation-step-two{\n    padding-bottom:0;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:static;\n    z-index:40;\n    margin-top:auto;\n}`;
const canonical=`/* Step two is a fixed, non-scrollable 1080x1920 canvas. Keep its final\n   actions anchored inside the safe area instead of letting flex-shrink\n   collapse the row when typography or browser metrics consume more room. */\n#creationPage .creation-step-two{\n    padding-bottom:154px;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:absolute;\n    left:0;\n    right:0;\n    bottom:0;\n    z-index:40;\n    margin-top:0;\n}`;
if(!creation.includes(temporary)){
  throw new Error("Expected temporary step-two action-row mutation was not produced by the scoped polish script.");
}
creation=creation.replace(temporary,canonical);
fs.writeFileSync(creationFile,creation);

const bossFile="css/gameplay-boss-tower.css";
let boss=fs.readFileSync(bossFile,"utf8");
const priorityHide="#game-stage #battlePage .battle-monster.gameplay-boss-card .damage-popup{\n    display:none !important;";
const ownerHide="#game-stage #battlePage .battle-monster.gameplay-boss-card .damage-popup{\n    display:none;";
if(!boss.includes(priorityHide)){
  throw new Error("Expected temporary priority damage-popup hide was not produced by the scoped polish script.");
}
boss=boss.replace(priorityHide,ownerHide);
const staleGeometryComment=`/* Gameplay activity covers use the same 16:9 production ratio as dungeon\n   covers. Combat BOSS/mechanism cards remain independent 4:3 components. */`;
const finalGeometryComment=`/* Gameplay activity covers use the same 16:9 production ratio as dungeon\n   covers. Combat BOSS/mechanism cards remain independent 9:16 components. */`;
if(!boss.includes(staleGeometryComment)){
  throw new Error("Expected historical Gameplay BOSS 4:3 comment was not found.");
}
boss=boss.replace(staleGeometryComment,finalGeometryComment);
fs.writeFileSync(bossFile,boss);

const authTestFile="tests/firebase-auth-foundation.test.mjs";
let authTest=fs.readFileSync(authTestFile,"utf8");
const oldDialogAssertion='    assert.match(css, /\\.firebase-auth-dialog\\{[\\s\\S]*width:min\\(92vw,420px\\);[\\s\\S]*max-height:100%;[\\s\\S]*overflow-y:auto/);';
const oldCompactAssertion='    assert.match(css, /V174 compact auth over second startup scene[\\s\\S]*startup-main-city\\.[0-9a-f]{12}\\.jpg[\\s\\S]*width:min\\(calc\\(100% - 20px\\),390px\\)/);';
const newDialogAssertions=`    assert.match(css, /\\.firebase-auth-dialog\\{[\\s\\S]*width:min\\(calc\\(100% - 20px\\),390px\\);[\\s\\S]*max-height:calc\\(100dvh - 24px\\);[\\s\\S]*overflow-y:auto/);\n    assert.match(css, /startup-main-city\\.[0-9a-f]{12}\\.jpg/);\n    assert.doesNotMatch(css, /backdrop-filter\\s*:/);`;
if(!authTest.includes(oldDialogAssertion)||!authTest.includes(oldCompactAssertion)){
  throw new Error("Expected historical auth geometry assertions were not found.");
}
authTest=authTest.replace(oldDialogAssertion,newDialogAssertions).replace(oldCompactAssertion,"");
fs.writeFileSync(authTestFile,authTest);

const portraitOwnerFile="js/45-v154-dev-fixes.js";
let portraitOwner=fs.readFileSync(portraitOwnerFile,"utf8");
const genericBossDetection='        const temporaryBoss=monster.rank==="boss"||monster.unitKind==="boss"||monster.vGameplayBoss===true||monster.v141BattleRank==="boss";';
const completeBossDetection='        const temporaryBoss=monster.rank==="boss"||monster.unitKind==="boss"||monster.vGameplayBoss===true||monster.v141BattleRank==="boss"||(monster.v141Abyss===true&&monster.name!=="天兵天將"&&(Object.prototype.hasOwnProperty.call(EARLY_ABYSS_PORTRAITS,monster.name)||Object.prototype.hasOwnProperty.call(FINAL_ABYSS_PORTRAITS,monster.name)));';
if(!portraitOwner.includes(genericBossDetection)){
  throw new Error("Expected temporary Boss detection line was not produced by the scoped polish script.");
}
portraitOwner=portraitOwner.replace(genericBossDetection,completeBossDetection);
fs.writeFileSync(portraitOwnerFile,portraitOwner);

const portraitTestFile="tests/monster-portrait-runtime.test.js";
let portraitTest=fs.readFileSync(portraitTestFile,"utf8");
const oldPortraitCases=`{\n    const runtime=loadRuntime([{name:"哥布林",element:"fire"},{name:"史萊姆",element:"water"}]);\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/monsters/wild/zone-01/fire-01.png");\n    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[1]),null);\n    assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"wild.zone-01.fire-01");\n    assert.equal(runtime.cards[1].style.getPropertyValue("--v152-abyss-portrait"),"");\n}\n\n{\n    const runtime=loadRuntime(["water","earth","fire","wind","water"].map(element=>({\n        name:"天兵天將",element,v141Abyss:true\n    })));\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    assert.deepEqual(\n        runtime.cards.slice(0,5).map(card=>card.dataset.monsterPortraitKey),\n        ["soldier.water","soldier.earth","soldier.fire","soldier.wind","soldier.water"]\n    );\n}\n\n{\n    const runtime=loadRuntime([{name:"天兵天將",element:"light",v141Abyss:true}]);\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/dungeons/abyss/soldier.webp");\n    assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"legacy.abyss.天兵天將");\n}\n`;
const newPortraitCases=`{\n    const runtime=loadRuntime([{name:"哥布林",element:"fire"},{name:"史萊姆",element:"water"}]);\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    runtime.context.monsters.forEach((monster,index)=>{\n        assert.equal(runtime.context.resolveMonsterPortrait(monster),"assets/dungeons/abyss/soldier.webp");\n        assert.equal(runtime.cards[index].dataset.monsterPortraitKey,"temporary.heavenly-soldier");\n    });\n}\n\n{\n    const runtime=loadRuntime(["water","earth","fire","wind","water"].map(element=>({\n        name:"天兵天將",element,v141Abyss:true\n    })));\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    assert.deepEqual(\n        runtime.cards.slice(0,5).map(card=>card.dataset.monsterPortraitKey),\n        Array(5).fill("temporary.heavenly-soldier")\n    );\n}\n\n{\n    const runtime=loadRuntime([{name:"天兵天將",element:"light",v141Abyss:true}]);\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/dungeons/abyss/soldier.webp");\n    assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"temporary.heavenly-soldier");\n}\n\n{\n    const runtime=loadRuntime([{name:"赤焰君",element:"fire",rank:"boss",vGameplayBoss:true}]);\n    runtime.context.v154InstallMonsterPortraitRegistry(registry);\n    runtime.context.v154SyncMonsterPortraits();\n    assert.equal(runtime.context.resolveMonsterPortrait(runtime.context.monsters[0]),"assets/monsters/boss/boss-placeholder-fire-demon.webp");\n    assert.equal(runtime.cards[0].dataset.monsterPortraitKey,"temporary.boss-reference");\n}\n`;
if(!portraitTest.includes(oldPortraitCases)){
  throw new Error("Expected historical monster portrait runtime cases were not found.");
}
portraitTest=portraitTest.replace(oldPortraitCases,newPortraitCases);
portraitTest=portraitTest.replace(
  'assert.match(source,/target\\.status!=="existing"/);',
  'assert.match(source,/TEMPORARY_MONSTER_PORTRAIT="assets\\/dungeons\\/abyss\\/soldier\\.webp"/);\nassert.match(source,/TEMPORARY_BOSS_PORTRAIT="assets\\/monsters\\/boss\\/boss-placeholder-fire-demon\\.webp"/);\nassert.match(source,/target\\.status!=="existing"/);'
);
fs.writeFileSync(portraitTestFile,portraitTest);

const v154TestFile="tests/v154-current-request.test.js";
let v154Test=fs.readFileSync(v154TestFile,"utf8");
const oldAbyssPortraitTest=`test("Abyss floors 1 to 4 and floor 5 receive their exact portrait sets",()=>{\n    const earlyBosses={\n        東帝:"east-emperor.webp",南帝:"south-emperor.webp",\n        天帝:"heaven-emperor.webp",北帝:"north-emperor.webp"\n    };\n    Object.entries(earlyBosses).forEach(([bossName,asset])=>{\n        const names=[bossName,"天兵天將","天兵天將","天兵天將","天兵天將"];\n        const early=loadRuntime({\n            currentBattleMonsters:[0,1,2,3,4],\n            monsters:names.map(name=>({name,v141Abyss:true}))\n        });\n        early.context.v154SyncAbyssPortraits();\n        assert.ok(early.cards[0].style.getPropertyValue("--v152-abyss-portrait").endsWith(asset+'")'));\n        assert.match(early.cards[1].style.getPropertyValue("--v152-abyss-portrait"),/soldier\\.webp/);\n        assert.ok(early.cards[0].querySelector(".v162-abyss-battle-portrait-art").src.endsWith(asset));\n        assert.ok(early.cards[1].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("soldier.webp"));\n        assert.equal(early.cards[0].dataset.abyssPortrait,"floor1-4");\n    });\n\n    const finalNames=[\n        "東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊",\n        "天兵天將","天兵天將","天兵天將","天兵天將","天兵天將"\n    ];\n    const final=loadRuntime({\n        currentBattleMonsters:finalNames.map((_,index)=>index),\n        monsters:finalNames.map(name=>({name,v141Abyss:true}))\n    });\n    final.context.v154SyncAbyssPortraits();\n    const expected=[\n        "floor5-east-emperor.webp","floor5-heaven-emperor.webp",\n        "floor5-extreme-emperor.webp","floor5-north-emperor.webp",\n        "floor5-south-emperor.webp","floor5-soldier.webp"\n    ];\n    expected.forEach((asset,index)=>assert.ok(\n        final.cards[index].style.getPropertyValue("--v152-abyss-portrait").endsWith(asset+'")')\n    ));\n    expected.forEach((asset,index)=>assert.ok(\n        final.cards[index].querySelector(".v162-abyss-battle-portrait-art").src.endsWith(asset)\n    ));\n    assert.equal(final.cards[0].dataset.abyssPortrait,"floor5");\n    assert.equal(final.battlePage.classList.contains("v154-abyss-final"),true);\n});`;
const newAbyssPortraitTest=`test("temporary portrait switch uses the Boss reference for Abyss emperors and Heavenly Soldier art for soldiers",()=>{\n    ["東帝","南帝","天帝","北帝"].forEach(bossName=>{\n        const names=[bossName,"天兵天將","天兵天將","天兵天將","天兵天將"];\n        const early=loadRuntime({\n            currentBattleMonsters:[0,1,2,3,4],\n            monsters:names.map(name=>({name,v141Abyss:true}))\n        });\n        early.context.v154SyncAbyssPortraits();\n        assert.ok(early.cards[0].style.getPropertyValue("--v152-abyss-portrait").endsWith("boss-placeholder-fire-demon.webp\")"));\n        assert.match(early.cards[1].style.getPropertyValue("--v152-abyss-portrait"),/soldier\\.webp/);\n        assert.ok(early.cards[0].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("boss-placeholder-fire-demon.webp"));\n        assert.ok(early.cards[1].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("soldier.webp"));\n        assert.equal(early.cards[0].dataset.abyssPortrait,"floor1-4");\n    });\n\n    const finalNames=[\n        "東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊",\n        "天兵天將","天兵天將","天兵天將","天兵天將","天兵天將"\n    ];\n    const final=loadRuntime({\n        currentBattleMonsters:finalNames.map((_,index)=>index),\n        monsters:finalNames.map(name=>({name,v141Abyss:true}))\n    });\n    final.context.v154SyncAbyssPortraits();\n    for(let index=0;index<5;index++){\n        assert.ok(final.cards[index].style.getPropertyValue("--v152-abyss-portrait").endsWith("boss-placeholder-fire-demon.webp\")"));\n        assert.ok(final.cards[index].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("boss-placeholder-fire-demon.webp"));\n    }\n    assert.match(final.cards[5].style.getPropertyValue("--v152-abyss-portrait"),/soldier\\.webp/);\n    assert.ok(final.cards[5].querySelector(".v162-abyss-battle-portrait-art").src.endsWith("soldier.webp"));\n    assert.equal(final.cards[0].dataset.abyssPortrait,"floor5");\n    assert.equal(final.battlePage.classList.contains("v154-abyss-final"),true);\n});`;
if(!v154Test.includes(oldAbyssPortraitTest)){
  throw new Error("Expected historical V154 Abyss portrait test was not found.");
}
v154Test=v154Test.replace(oldAbyssPortraitTest,newAbyssPortraitTest);
fs.writeFileSync(v154TestFile,v154Test);

console.log("Restored canonical creation actions, kept Boss CSS priority-free, aligned 9:16 preservation comments, aligned auth tests, and covered temporary monster/Boss portraits including Abyss rosters.");
