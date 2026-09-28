"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const source=fs.readFileSync("js/48-v159-abyss-battle-portraits.js","utf8");
assert.match(source,/V159 retired/);
assert.doesNotMatch(source,/requestAnimationFrame|setTimeout|MutationObserver|v132LaunchDungeonBattle|v154SyncMonsterPortraits/);
assert.equal(source.trim().split(/\n/).length,2,
    "retired V159 must remain a marker only, without a second portrait lifecycle");

console.log("V159 portrait lifecycle retirement: PASS.");