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

console.log("Restored canonical creation actions and kept Boss owner CSS free of priority patches before repository tests.");
