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
  "fire-soul-resonance.webp","blood-burn.webp","stun.webp"
];

test("persistent status icons are static while body states stay pulse/static",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/frostbite:statusVisual\("","icon","statusEffects"/);
  assert.match(js,/fireMomentum:statusVisual\("","icon","activeBuffs"/);
  assert.match(js,/burn:statusVisual\("assets\/vfx\/status\/burn\.webp","pulse"/);
  assert.match(js,/freeze:statusVisual\("assets\/vfx\/status\/freeze\.webp","static"/);
  assert.doesNotMatch(js,/statDown:statusVisual/);
  assert.match(css,/\.v143-status-icon--pulse\{[\s\S]*?animation:none !important;/);
  assert.match(css,/\.v143-status-visual--pulse\{[\s\S]*?v143StatusImageBreath/);
});

test("status body art can reach card edges and remains larger than the old footprint",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/regularEnemy=side==="monster"&&!isBossIndexForVfx\(index\)/);
  assert.match(js,/const widthScale=\(regularEnemy\?1\.45:1\.40\)\*\(shellStatus\?1\.08:1\)/);
  assert.match(js,/const heightScale=\(regularEnemy\?1\.36:1\.34\)\*\(shellStatus\?1\.08:1\)/);
  assert.match(js,/anchor\.rect\.width\*widthScale/);
  assert.match(js,/cardRect\.width\*widthScale/);
  assert.match(js,/anchor\.rect\.height\*heightScale/);
  assert.match(js,/cardRect\.height\*heightScale/);
  assert.match(js,/node\.style\.backgroundSize="contain"/);
});

test("body-art statuses do not duplicate a HUD icon but detail data keeps iconSrc",()=>{
  const js=read("js/39-v143-skill-animation.js");
  assert.match(js,/if\(spec\.mode==="icon"\)[\s\S]*?host\.appendChild\(createStatusIcon\(type,spec\)\)[\s\S]*?else if\(existingIcon\)/);
  assert.match(js,/iconSrc:spec\.iconSrc\|\|spec\.src\|\|""/);
});

test("idle card inspection yields to existing target-selection interaction",()=>{
  const js=read("js/00-main.js");
  assert.match(js,/function isBattleStatusInspectionBlocked\(\)/);
  assert.match(js,/if\(actionRegion&&actionRegion\.classList\.contains\("target-selecting"\)\)/);
  const inspection=js.slice(js.indexOf("function isBattleStatusInspectionBlocked()"),js.indexOf("function battleStatusElementLabel"));
  assert.doesNotMatch(inspection,/actionReady|pendingAction/);
  assert.match(inspection,/#battlePage \.battle-monster\.targetable,#battlePage \.battle-player\.ally-targetable/);
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
