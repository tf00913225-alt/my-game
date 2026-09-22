const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

const STATUS_ASSETS=[
  "burn.webp","rage.webp","rage-icon.webp","frostbite-icon.webp","freeze.webp",
  "gravity-icon.webp","damage-down-icon.webp","stun-icon.webp","windwalk.webp",
  "stealth.webp","calm-mind.webp","defense-down-icon.webp","shield.webp",
  "petrify.webp","earth-shield.webp","rock-wall.webp","barrier.webp",
  "yuan-zu-blessing.webp","fire-momentum-icon.webp","phoenix-might-icon.webp",
  "fire-soul-resonance.webp","blood-burn.webp"
];

test("persistent status icons are static while body states stay pulse/static",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/frostbite:statusVisual\("","icon","statusEffects"/);
  assert.match(js,/fireMomentum:statusVisual\("","icon","activeBuffs"/);
  assert.match(js,/burn:statusVisual\("assets\/vfx\/status\/burn\.webp","pulse"/);
  assert.match(js,/freeze:statusVisual\("assets\/vfx\/status\/freeze\.webp","static"/);
  assert.match(js,/stun:statusVisual\("assets\/vfx\/wind\/stun-loop\.png","pulse"[\s\S]*?frameColumns:4,frameRows:3,frameIndex:5/);
  assert.doesNotMatch(js,/statDown:statusVisual/);
  assert.match(css,/\.v143-status-icon--pulse\{[\s\S]*?animation:none !important;/);
  assert.match(css,/\.v143-status-visual--pulse\{[\s\S]*?v143StatusImageBreath/);
  assert.match(css,/@keyframes v143StatusImageBreath\{[\s\S]*?50%\{opacity:1\}/);
  assert.match(css,/\.v143-status-icon\{[\s\S]*?width:16px;[\s\S]*?height:16px;/);
  assert.match(css,/\.battle-status-detail-modal\{[\s\S]*?z-index:18120/);
});

test("status body art is constrained inside its own card",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/cardRect\.width\*\.82/);
  assert.match(js,/cardRect\.height\*\.84/);
  assert.match(js,/node\.style\.backgroundSize="contain"/);
  assert.match(js,/STATUS_CAROUSEL_INTERVAL_MS=1000/);
  assert.match(js,/activeBodyType=bodyTypes\.length/);
  assert.match(js,/activeBodyType!==type/);
});

test("idle card inspection yields to existing target-selection interaction",()=>{
  const js=read("js/00-main.js");
  assert.match(js,/function isBattleStatusInspectionBlocked\(\)/);
  assert.match(js,/actionReady\|\|pendingAction/);
  assert.match(js,/\.battle-monster\.targetable/);
  assert.match(js,/card\.classList\.contains\("targetable"\)[\s\S]*?selectBattleTarget\(index\)/);
  assert.match(js,/box\.classList\.contains\("ally-targetable"\)[\s\S]*?selectBattleAllyTarget\(index\)/);
  assert.match(js,/openBattleStatusDetailModal\("monster",index\)/);
  assert.match(js,/openBattleStatusDetailModal\("player",index\)/);
  assert.match(js,/增益狀態：/);
  assert.match(js,/負面狀態：/);
  assert.match(js,/剩餘 /);
});

test("all formal battle status assets are WebP files",()=>{
  for(const name of STATUS_ASSETS){
    const file=path.join(ROOT,"assets","vfx","status",name);
    assert.ok(fs.existsSync(file),name+" should exist");
    const data=fs.readFileSync(file);
    assert.ok(data.length>16,name+" should not be empty");
    assert.equal(data.subarray(0,4).toString("ascii"),"RIFF",name+" should be RIFF");
    assert.equal(data.subarray(8,12).toString("ascii"),"WEBP",name+" should be WebP");
  }
});


test("new tactical skill assets are wired to icon and cast owners",()=>{
  const main=read("js/00-main.js");
  const vfx=read("js/39-v143-skill-animation.js");
  const fire=read("js/60-v173.64-skill-progression-rebalance.js");
  const water=read("js/50-v169-water-skill-rules.js");
  assert.match(main,/fireSoulResonance:"assets\/skills\/fire-soul-resonance\.webp"/);
  assert.match(main,/bloodBurnArt:"assets\/skills\/fire-blood-burn\.webp"/);
  assert.match(main,/purifyMind:"assets\/skills\/water-purify-mind\.webp"/);
  assert.match(vfx,/fireSoulResonance:[\s\S]*?fire-soul-resonance-cast\.webp/);
  assert.match(vfx,/bloodBurnArt:[\s\S]*?blood-burn-cast\.webp/);
  assert.match(vfx,/purifyMind:[\s\S]*?purify-mind-cast\.webp/);
  assert.match(fire,/iconAssetPath:"assets\/skills\/fire-soul-resonance\.webp"/);
  assert.match(fire,/iconAssetPath:"assets\/skills\/fire-blood-burn\.webp"/);
  assert.match(water,/iconAssetPath:"assets\/skills\/water-purify-mind\.webp"/);
});
