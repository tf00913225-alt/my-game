"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const marker="Shared Black-Gold Window Skin — visual-only owner";
const markerIndex=css.indexOf(marker);
assert.ok(markerIndex>=0,"shared black-gold skin marker must exist");
const skin=css.slice(markerIndex);

const requiredPalette=["#0D0C09","#171510","#201D17","#12110E","#C69A45","#F0D38A","#73582D","#EEE7D8","#B9AD98"];
requiredPalette.forEach(value=>assert.match(skin,new RegExp(value.replace("#","#"),"i"),`missing palette ${value}`));

[
    ".home-feature-modal-box",
    ".item-modal-box",
    ".inventory-classic-shell",
    ".creation-skill-detail-box",
    ".v169-rpg-dialog",
    ".v132-reward-modal-inner",
    ".home-feature-modal-title",
    ".quest-tab",
    ".v141-synthesis-tabs button",
    ".v17345-shop-tabs button",
    ".close-item-button"
].forEach(selector=>assert.ok(skin.includes(selector),`missing shared skin selector ${selector}`));

assert.match(skin,/box-shadow:\s*[\s\S]*?inset 0 0 0 1px[\s\S]*?inset 0 0 0 3px/,"window frame must use layered non-layout shadows");
assert.doesNotMatch(skin,/!important/,"visual skin must not use !important");
assert.doesNotMatch(skin,/::before|::after/,"visual skin must not add pseudo-element geometry");

const forbiddenGeometry=/\b(?:width|height|min-width|min-height|max-width|max-height|top|right|bottom|left|inset|margin|padding|gap|transform|translate|scale|position|display|flex-direction|grid-template-columns|grid-template-rows|justify-content|align-items|overflow|z-index)\s*:/i;
const declarations=skin
    .split(/\n/)
    .map(line=>line.trim())
    .filter(line=>line&&!line.startsWith("/*")&&!line.startsWith("*")&&!line.startsWith("//"));
for(const line of declarations){
    assert.doesNotMatch(line,forbiddenGeometry,`skin changed forbidden geometry property: ${line}`);
}

assert.doesNotMatch(skin,/\bborder\s*:/i,"skin must not change border width; use border-color and shadows instead");

console.log("✓ black-gold window skin is visual-only and geometry-safe");
