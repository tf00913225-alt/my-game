"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchSource=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const mainSource=fs.readFileSync("js/00-main.js","utf8");
const detailCss=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");

assert.match(touchSource,/data-scroll-owner="x\|y\|both"/);
assert.match(detailCss,/#inventoryCharacterDetailModal \.inventory-character-detail-grid\{[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;/);

const listeners={};
const documentElement={};
const document={
    documentElement,
    getElementById(){ return null; },
    addEventListener(type,handler){ listeners[type]=handler; }
};
const window={
    addEventListener(){},
    getComputedStyle(){ return {overflowY:"auto",overflowX:"hidden"}; }
};
const context=vm.createContext({window,document});
vm.runInContext(touchSource,context);

const grid={
    nodeType:1,
    scrollHeight:900,
    clientHeight:420,
    scrollWidth:300,
    clientWidth:300,
    parentElement:documentElement,
    matches(selector){ return selector.includes(".inventory-character-detail-grid"); }
};

const owner=window.FourSymbolsGestureArbiter.findScrollOwner(grid);
assert.equal(owner.node,grid,"character detail grid must own its vertical scroll");
assert.equal(owner.axes,"y");
grid.scrollHeight=grid.clientHeight;
assert.equal(window.FourSymbolsGestureArbiter.findScrollOwner(grid),null,"a short detail grid must not claim scrolling");

// Execute the current formatter owner rather than a retired DOM patch or a
// standalone toFixed sample. The combat value must remain unchanged.
function sourceFunction(name){
    const start=mainSource.indexOf("function "+name+"(");
    assert.ok(start>=0,"missing formal owner "+name);
    return mainSource.slice(start,mainSource.indexOf("\n}",start)+2);
}
const body={};
let shown=false;
const nodes={
    inventoryCharacterDetailStats:body,
    inventoryCharacterDetailName:{},
    inventoryCharacterDetailModal:{classList:{add(name){ shown=name==="show"; }}}
};
const renderer=vm.createContext({
    window:{},$:id=>nodes[id],inventoryCharacterIndex:0,
    getBackpackCharacter:()=>({id:"測試",level:1}),
    getInventoryCharacterCriticalStats:()=>({physical:{chance:0,multiplier:1},magic:{chance:0,multiplier:1}})
});
vm.runInContext(sourceFunction("combineEvasionRates")+sourceFunction("openInventoryCharacterDetail"),renderer);
for(const [value,expected] of [
    [renderer.combineEvasionRates([.1,.2]),"0.3%"],
    [6.000000000000003,"6.0%"], [6.26,"6.3%"], [0,"0.0%"], [150,"150.0%"]
]){
    const stats=Object.freeze({maxHP:100,maxSP:50,accuracy:10,evasion:value,statusResistance:0,antiCrit:0});
    renderer.getBackpackCharacterStats=()=>stats;
    renderer.openInventoryCharacterDetail();
    assert.equal(body.innerHTML.match(/<span>閃避<\/span>\s*<b>(.*?)<\/b>/)[1],expected);
    assert.equal(stats.evasion,value,"display formatting must not round or cap the combat stat");
    assert.equal(shown,true,"the real renderer must open the modal");
}

console.log("Character detail touch scrolling and evasion display regression checks passed");
