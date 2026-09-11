import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const core=fs.readFileSync("js/00-main.js","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");

test("resolved UID save hydrates the exact resolved payload without a second repository read",()=>{
  assert.match(core,/hydrate:save=>loadGame\(save\)/);
  assert.match(core,/function loadGame\(resolvedSave=null\)/);
  assert.match(core,/if\(resolvedSave&&typeof resolvedSave==="object"&&!Array\.isArray\(resolvedSave\)\)\{[\s\S]*?raw=JSON\.stringify\(resolvedSave\);/);
  assert.match(startup,/FourSymbolsGameSave\.hydrate\(save\)/);
  assert.doesNotMatch(startup,/const loaded=global\.FourSymbolsGameSave&&global\.FourSymbolsGameSave\.load\(\);/);
});

test("empty verified UID still follows creation path instead of READY hydration",()=>{
  assert.match(startup,/if\(!safeCloudEmpty\(cloud,user\.uid\)\)[\s\S]*?saveResolved=true;[\s\S]*?return enterCreation\(token\)/);
});
