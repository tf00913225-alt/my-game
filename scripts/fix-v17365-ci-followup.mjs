import fs from "node:fs";

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

console.log("Restored canonical creation actions, kept Boss CSS priority-free, aligned auth tests, and covered the temporary all-monster portrait switch.");
