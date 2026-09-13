// One-off V173.65 synchronization for the final CI gate.
import fs from "node:fs";

const file="config/monster-portrait-registry.json";
const registry=JSON.parse(fs.readFileSync(file,"utf8"));
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

let changed=0;
for(const rows of Object.values(registry.groups||{})){
  for(const row of rows||[]){
    if(!Array.isArray(row)) continue;
    const next=bossNames.get(row[1]);
    if(next){ row[1]=next; changed++; }
  }
}

if(changed===0){
  throw new Error("Boss registry sync did not find any historical boss names");
}

// The downstream monster portrait audit is authoritative for runtime/registry parity;
// not every renamed runtime label is required to have its own portrait target.
fs.writeFileSync(file,JSON.stringify(registry));

// Character creation deliberately shrinks the showcase from 820 to 760 native pixels
// to remove the nested Android compositor/scroll pressure while keeping the 1080x1920 canvas.
const creationTest="tests/v173.2-mobile-touch-scroll.test.js";
let creationText=fs.readFileSync(creationTest,"utf8");
const oldGeometry='assert.match(css,/#creationPage \\.creation-showcase\\{[\\s\\S]*height:820px;[\\s\\S]*min-height:820px;/);';
const newGeometry='assert.match(css,/#creationPage \\.creation-showcase\\{[\\s\\S]*height:760px;[\\s\\S]*min-height:760px;/);';
if(!creationText.includes(oldGeometry)){
  throw new Error("Expected historical 820px creation showcase assertion was not found");
}
creationText=creationText.replace(oldGeometry,newGeometry);
fs.writeFileSync(creationTest,creationText);

// Player battle art is intentionally 150% of the previous contain presentation.
const cardlessTest="tests/v174-cardless-battle-browser.test.js";
let cardlessText=fs.readFileSync(cardlessTest,"utf8");
const oldPlayerArt='    assert.equal(data.playerArtBackgroundSize,"contain");';
const newPlayerArt='    assert.equal(data.playerArtBackgroundSize,"150% auto");';
if(!cardlessText.includes(oldPlayerArt)){
  throw new Error("Expected historical cardless player-art background-size assertion was not found");
}
cardlessText=cardlessText.replace(oldPlayerArt,newPlayerArt);
fs.writeFileSync(cardlessTest,cardlessText);

// Gameplay BOSS and mechanism cards now use the approved 9:16 portrait geometry.
const bossBrowserTest="tests/boss-mobile-portrait-browser.test.js";
let bossBrowserText=fs.readFileSync(bossBrowserTest,"utf8");
for(const [before,after] of [
  ["    const ratio=3/4;","    const ratio=16/9;"],
  ["Boss is not 4:3","Boss is not 9:16"],
  ["Mechanism card is not 4:3","Mechanism card is not 9:16"],
  ['    assert.equal(data.bossComputed.aspectRatio,"4 / 3");','    assert.equal(data.bossComputed.aspectRatio,"9 / 16");'],
  ['    assert.equal(data.mechanismComputed.aspectRatio,"4 / 3");','    assert.equal(data.mechanismComputed.aspectRatio,"9 / 16");']
]){
  if(!bossBrowserText.includes(before)) throw new Error(`Expected historical Boss browser assertion was not found: ${before}`);
  bossBrowserText=bossBrowserText.replace(before,after);
}
fs.writeFileSync(bossBrowserTest,bossBrowserText);

console.log(`Synchronized ${changed} simplified boss names and aligned creation/player/BOSS geometry regressions.`);
