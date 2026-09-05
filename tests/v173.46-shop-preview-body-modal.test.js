"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const css=fs.readFileSync("css/33-v132-content-expansion.css","utf8");
const content=fs.readFileSync("js/27-v132-content-expansion.js","utf8");

assert.match(content,/modal\.id="v132RewardModal"[\s\S]*?document\.body\.appendChild\(modal\)/);
assert.match(css,/\.v132-reward-modal \.v132-reward-modal-inner\.v17346-shop-preview-modal\{[\s\S]*?height:400px !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/\.v132-reward-modal \.v17346-shop-preview-modal \.v132-reward-actions\{[\s\S]*?position:static !important;/);
assert.doesNotMatch(css,/#game-stage \.v132-reward-modal \.v132-reward-modal-inner\.v17346-shop-preview-modal/);

console.log("V173.46 shop preview body-modal selector regression checks passed");
