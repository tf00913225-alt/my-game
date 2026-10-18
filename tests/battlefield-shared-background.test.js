"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const asset="assets/battle/moonlit-sanctuary-depth-20261018.webp";
let battle,observer;
const makeBattle=()=>({children:[],querySelector(){return this.children.find(n=>n.className==="battle-bg-shared")||null;},insertBefore(node){this.children.unshift(node);}});
battle=makeBattle();
const context={document:{readyState:"complete",getElementById(id){
    if(id==="battlePage")return battle;
    if(id==="game-content")return {};
    throw new Error("Battle background must not read map/account state: "+id);
},createElement(){return {style:{},setAttribute(){}};}},MutationObserver:class{constructor(callback){observer=callback;}observe(){}},getComputedStyle:n=>n.style};
context.window=context;
vm.runInNewContext(fs.readFileSync("js/07-stage-v40-root-battle-background-runtime.js","utf8"),context);
const layer=battle.children[0];
assert.equal(layer.style.backgroundImage,'url("'+asset+'")');
for(const mode of ["wild","daily","equipment","tower","personalBoss","worldBoss","abyss","adventure","event"]){
    battle.mode=mode;observer();context.syncBattleBackgroundToCurrentMap();
    assert.equal(battle.children.length,1,mode+" must reuse one background layer");
    assert.equal(battle.children[0],layer,mode+" must not replace the layer on rerender");
}
battle=makeBattle();observer();
assert.equal(battle.children.length,1,"a remounted battle page acquires its background");
assert.equal(battle.children[0].style.backgroundImage,'url("'+asset+'")');
assert.equal(fs.existsSync("js/06-stage-v39-battle-map-background-runtime.js"),false,"retired map writer must not return");
assert.doesNotMatch(fs.readFileSync("scripts/build-production.mjs","utf8"),/06-stage-v39-battle-map-background-runtime/);
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
assert.ok(manifest.firstPlay.resources.some(r=>r.path===asset),"the formal asset loader must include the new battlefield image");
console.log("Shared battlefield background lifecycle and map-independent mode coverage passed.");
