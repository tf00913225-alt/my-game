"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const v138=fs.readFileSync("js/25-v131-fix-batch.js","utf8");

assert.match(main,/const renderHooks=typeof window!==\"undefined\"&&Array\.isArray\(window\.FourSymbolsBattleRenderHooks\)/);
assert.match(main,/renderHooks\.forEach\(hook=>/);
assert.match(v138,/window\.FourSymbolsBattleRenderHooks=window\.FourSymbolsBattleRenderHooks\|\|\[\]/);
assert.match(v138,/applyV138BattleRenderHook/);
assert.doesNotMatch(v138,/renderBattle=function/);

console.log("V138 renderBattle hook contract passed.");
