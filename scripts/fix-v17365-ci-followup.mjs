import fs from "node:fs";

const file="css/29-v125-character-creation-native.css";
let text=fs.readFileSync(file,"utf8");
const temporary=`/* Step two remains fixed and non-scrollable, but its actions stay in normal\n   flow so Android does not promote a second oversized compositing tile. */\n#creationPage .creation-step-two{\n    padding-bottom:0;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:static;\n    z-index:40;\n    margin-top:auto;\n}`;
const canonical=`/* Step two is a fixed, non-scrollable 1080x1920 canvas. Keep its final\n   actions anchored inside the safe area instead of letting flex-shrink\n   collapse the row when typography or browser metrics consume more room. */\n#creationPage .creation-step-two{\n    padding-bottom:154px;\n}\n\n#creationPage .creation-step-two > .creation-action-row{\n    position:absolute;\n    left:0;\n    right:0;\n    bottom:0;\n    z-index:40;\n    margin-top:0;\n}`;
if(!text.includes(temporary)){
  throw new Error("Expected temporary step-two action-row mutation was not produced by the scoped polish script.");
}
text=text.replace(temporary,canonical);
fs.writeFileSync(file,text);
console.log("Restored the canonical fixed step-two bottom-action contract before repository tests.");
