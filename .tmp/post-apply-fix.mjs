import fs from "node:fs";

function swap(path,before,after,label){
  let source=fs.readFileSync(path,"utf8");
  const count=source.split(before).length-1;
  if(count!==1){ throw new Error(`${label}: expected 1 match, got ${count}`); }
  source=source.replace(before,after);
  fs.writeFileSync(path,source);
}

const staticPath="tests/v174-mobile-ui-exp-guards.test.js";
let staticSource=fs.readFileSync(staticPath,"utf8");
staticSource=staticSource.split("\n").map(line=>line.startsWith("assert.match(slots,/querySelectorAll")
  ? `assert.ok(slots.includes("querySelectorAll('[onclick*=\\\"openCharacterCreation\\\"]')"),"current character creation slot selector missing");`
  : line).join("\n");
fs.writeFileSync(staticPath,staticSource);

swap("css/gameplay-boss-tower.css","--gameplay-mechanism-card-width:clamp(78px,19%,90px);","--gameplay-mechanism-card-width:clamp(82px,20%,92px);","normal mechanism paired width");
swap("css/gameplay-boss-tower.css","--gameplay-mechanism-card-width:clamp(72px,18%,84px);","--gameplay-mechanism-card-width:clamp(78px,19.5%,88px);","compact mechanism paired width");
swap("css/gameplay-boss-tower.css","    gap:2px;\n    padding:3px 4px;","    gap:1px;\n    padding:2px 3px;","mechanism inner spacing");
swap("css/gameplay-boss-tower.css","    padding:1px 5px;\n    border:1px solid color-mix(in srgb,var(--mechanism-color) 62%,transparent);","    padding:0 4px;\n    border:1px solid color-mix(in srgb,var(--mechanism-color) 62%,transparent);","mechanism kind padding");
swap("css/gameplay-boss-tower.css","    font-size:11px;\n    font-weight:900;\n    line-height:1.15;\n    letter-spacing:1px;","    font-size:10px;\n    font-weight:900;\n    line-height:11px;\n    letter-spacing:.5px;","mechanism kind type");
swap("css/gameplay-boss-tower.css","    min-height:14px;\n    overflow:hidden;\n    color:#fff0c4;\n    font-family:\"Noto Serif TC\",serif;\n    font-size:12px;\n    font-weight:900;\n    line-height:14px;","    min-height:12px;\n    overflow:hidden;\n    color:#fff0c4;\n    font-family:\"Noto Serif TC\",serif;\n    font-size:11px;\n    font-weight:900;\n    line-height:12px;","mechanism name type");
swap("css/gameplay-boss-tower.css","    min-height:14px;\n    box-sizing:border-box;\n    align-items:center;\n    justify-content:center;\n    padding:1px 2px;","    min-height:12px;\n    box-sizing:border-box;\n    align-items:center;\n    justify-content:center;\n    padding:0 2px;","mechanism hp box");
swap("css/gameplay-boss-tower.css","    font-size:10px;\n    font-weight:900;\n    line-height:1.1;\n    letter-spacing:-.25px;","    font-size:9.5px;\n    font-weight:900;\n    line-height:1.05;\n    letter-spacing:-.45px;","mechanism hp type");

const bossTestPath="tests/boss-mobile-portrait-browser.test.js";
let bossTest=fs.readFileSync(bossTestPath,"utf8");
bossTest=bossTest.replace("data.mechanismBattleWidthShare>=.18&&data.mechanismBattleWidthShare<=.26","data.mechanismBattleWidthShare>=.19&&data.mechanismBattleWidthShare<=.26");
bossTest=bossTest.replace("outside 18%-26%","outside 19%-26%");
fs.writeFileSync(bossTestPath,bossTest);

console.log("Adjusted generated source contract and compact 4:3 mechanism geometry.");
