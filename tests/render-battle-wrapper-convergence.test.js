"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const v152=fs.readFileSync("js/44-v152-dev-fixes.js","utf8");
const v154=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");

assert.doesNotMatch(
    v152,
    /if\(typeof renderBattle===\"function\"\)\{[\s\S]*?syncAbyssBattleUi\(\);[\s\S]*?\n    \}/,
    "V152 must not install a second renderBattle wrapper"
);
assert.match(
    v152,
    /window\.v152SyncAbyssBattleUi=syncAbyssBattleUi;/,
    "V152 must expose its post-render behavior as a hook"
);
assert.match(
    v154,
    /window\.v152SyncAbyssBattleUi===\"function\"\)[\s\S]*?window\.v152SyncAbyssBattleUi\(\);/,
    "V154 must invoke the V152 hook inside the surviving renderBattle wrapper"
);
assert.match(
    v154,
    /window\.v152SyncAbyssBattleUi\(\);[\s\S]*?syncMonsterPortraits\(\);/,
    "V152 abyss sync must retain its original before-portrait ordering"
);

console.log("renderBattle wrapper convergence: 4 checks passed");
