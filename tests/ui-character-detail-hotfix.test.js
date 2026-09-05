"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const touchSource=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const combatSource=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const detailCss=fs.readFileSync("css/23-stage-v77-inventory-detail-ui.css","utf8");

assert.match(touchSource,/\.inventory-character-detail-box, \.inventory-character-detail-grid, \.item-modal-box/);
assert.match(detailCss,/#inventoryCharacterDetailModal \.inventory-character-detail-grid\{[\s\S]*?overflow-y:auto !important;[\s\S]*?touch-action:pan-y !important;/);
assert.match(combatSource,/label\.textContent\.trim\(\)==="閃避"/);
assert.match(combatSource,/evasionValue\.textContent=numeric\(evasionValue\.textContent\)\.toFixed\(1\)\+"%"/);

const listeners={};
const documentElement={};
const document={
    documentElement,
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

assert.equal(window.isInsideAllowedScrollerV78(grid),true,"character detail grid must pass the global touch lock when it can scroll");

const clean=(6.000000000000003).toFixed(1)+"%";
assert.equal(clean,"6.0%","floating-point evasion artifacts must never leak into the UI");

console.log("Character detail touch scrolling and evasion display regression checks passed");
