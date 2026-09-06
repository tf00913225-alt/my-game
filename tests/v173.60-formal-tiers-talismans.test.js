"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const content=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const rarityCss=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");
const spec=fs.readFileSync("docs/ITEM_RARITY_UI_SPEC.md","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const html=fs.readFileSync("index.html","utf8");

test("formal item tiers are six, while talismans stop at orange",()=>{
  for(const [key,label] of [["white","白階"],["blue","藍階"],["purple","紫階"],["orange","橙階"],["pink","桃紅階"],["four-symbol","四象階"]]){
    assert.ok(content.includes(`key:"${key}",label:"${label}"`),key);
    assert.ok(synthesis.includes(`${key==="four-symbol"?'"four-symbol"':key}:`),key);
  }
  assert.match(content,/TALISMAN_ACTIVATION_CHANCES=\[35,55,75,100\]/);
  assert.match(content,/TALISMAN_TIERS=FORMAL_ITEM_TIERS\.slice\(0,4\)/);
  assert.match(spec,/符咒為唯一明確例外/);
});

test("legacy item ids survive while player-facing tierKey is formal",()=>{
  assert.match(content,/id:effect\.key\+"Talisman"\+tier\.idSuffix/);
  assert.match(content,/legacyKey:"low",idSuffix:"Low"/);
  assert.match(content,/legacyKey:"perfect",idSuffix:"Perfect"/);
  assert.match(synthesis,/TIER_ALIASES=\{low:"white",mid:"blue",high:"purple",perfect:"orange"\}/);
  assert.match(qol,/low:"white",mid:"blue",high:"purple",perfect:"orange"/);
});

test("talisman resolution is two stage and max-skill aware",()=>{
  assert.match(content,/getTalismanActivationChance/);
  assert.match(content,/Math\.random\(\)\*100>=activationChance/);
  assert.match(content,/畫符失敗/);
  assert.match(content,/rollTalismanSkillHit/);
  assert.match(content,/rollStatusEffectHit/);
  assert.match(content,/definition\.talismanSkillLevel=Math\.max/);
  assert.doesNotMatch(content,/definition\.tierChance\+bonus/);
});

test("pink and four-symbol are planned but not silently injected into current drops",()=>{
  assert.match(equipment,/key:"pink",label:"桃紅階",chance:0,available:false,planned:true/);
  assert.match(equipment,/key:"four-symbol",label:"四象階",chance:0,available:false,planned:true/);
  const chest=content.match(/const CHEST_TIER_WEIGHTS=\[([\s\S]*?)\];/)[1];
  assert.ok(chest.includes('key:"white"')&&chest.includes('key:"orange"'));
  assert.ok(!chest.includes('key:"pink"')&&!chest.includes('key:"four-symbol"'));
  assert.match(synthesis,/尚未開放・數值待定/);
});

test("rarity visuals use the locked palette and four-symbol border",()=>{
  for(const hex of ["#D8D8D8","#42A5FF","#B05CFF","#FF9F38","#FF4FA7","#FF5A36","#47D6A3","#C89B45"]){
    assert.ok(rarityCss.includes(hex),hex);
  }
  assert.match(rarityCss,/v169-rarity-four-symbol/);
  assert.match(rarityCss,/2\.8s ease-in-out infinite/);
});

test("release wiring is V173.60",()=>{
  assert.ok(loader.includes('const V_ASSET_VERSION="173.60";'));
  assert.ok(html.includes("四象江湖傳 V173.60"));
});
