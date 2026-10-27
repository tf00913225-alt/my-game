const authoredUiCss=require("../.github/scripts/fixtures/native-ui-css-contract.cjs");
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const css=authoredUiCss(fs.readFileSync("css/49-v169-rpg-ui.css","utf8"));
const marker="Shared Black-Gold Window Skin — visual-only owner";
const markerIndex=css.indexOf(marker);
assert.ok(markerIndex>=0,"shared black-gold skin marker must exist");
const skin=css.slice(markerIndex);

// Backpack retains its own reviewed skill-art frame; shared skin must not reclaim it.
const backpack=authoredUiCss(fs.readFileSync("css/22-stage-v78-character-inventory-core.css","utf8"));
assert.doesNotMatch(skin,/\.inventory-classic-shell/);
const backpackShell=(backpack.match(/#game-ui #inventoryPage \.inventory-classic-shell\{([^}]+)\}/)||[])[1];
assert.ok(backpackShell,"formal backpack shell owner must exist");
assert.match(backpackShell,/background:#151515;/,"backpack must retain its visible iron base");
assert.match(backpackShell,/border:1px solid transparent;/,"backpack artwork must retain its layout border");
assert.match(backpackShell,/border-image:url\('\.\.\/assets\/ui\/skill-iron-bronze\/panel\.827d9ba9a6f8\.webp'\) 115 fill \/ 10px \/ 0 stretch;/,"backpack must retain the exact reviewed artwork and filled interior");
assert.match(backpackShell,/box-shadow:0 0 10px #000c;/,"backpack must retain its depth shadow");

const requiredPalette=["#0D0C09","#171510","#201D17","#12110E","#C69A45","#F0D38A","#73582D","#EEE7D8","#B9AD98"];
requiredPalette.forEach(value=>assert.match(skin,new RegExp(value,"i"),`missing palette ${value}`));

[
    ".home-feature-modal-box",
    ".item-modal-box",
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

// Standard modal skins must not silently inherit artwork from a shared rule.
const sharedWindows=(skin.match(/#game-stage #adventurePage \.adventure-story-dialogue\{([^}]*)\}/)||[])[1];
const sharedTitles=(skin.match(/#game-stage #adventurePage \.adventure-story-chapter\{([^}]*)\}/)||[])[1];
assert.ok(sharedWindows&&sharedTitles,"shared window and title owners must exist");
assert.doesNotMatch(sharedWindows,/\bborder-image\s*:/,"shared window skin must use CSS instead of nine-slice art");
assert.doesNotMatch(sharedTitles,/\bborder-image\s*:/,"shared title skin must use CSS instead of nine-slice art");
assert.match(skin,/#game-ui #homeFeatureModal\[data-character-tab="skill"\] \.home-feature-modal-box\{[^}]*border-image:var\(--rpg-window-frame\)/,"skill tab alone must opt into its frame art");
assert.match(skin,/#game-ui #homeFeatureModal\[data-character-tab="skill"\] \.home-feature-modal-title\{[^}]*border-image:var\(--rpg-window-frame\)/,"skill title artwork must stay intact");
assert.doesNotMatch(css,/#game-ui #homeFeatureModal \.home-feature-modal-box,\s*\.v132-reward-modal-inner\.v141-affix-modal\{[^}]*border-image/,"legacy broad frame owner must be removed");
assert.match(skin,/#game-stage #battlePage \.battle-status-detail-panel,\s*#game-stage #battlePage \.battle-boss-mechanism-drawer,\s*#game-stage #adventurePage \.adventure-story-dialogue\{[^}]*border-image/,"out-of-scope HUD art must stay unchanged");

const forbiddenGeometry=new Set([
    "width","height","min-width","min-height","max-width","max-height",
    "top","right","bottom","left","inset","margin","padding","gap",
    "transform","translate","scale","position","display","flex-direction",
    "grid-template-columns","grid-template-rows","justify-content","align-items",
    "overflow","z-index"
]);
const declarations=skin
    .split(/\n/)
    .map(line=>line.trim())
    .filter(line=>line&&!line.startsWith("/*")&&!line.startsWith("*")&&!line.startsWith("//"));
for(const line of declarations){
    const match=line.match(/^([\w-]+)\s*:/);
    if(!match){ continue; }
    const property=match[1].toLowerCase();
    assert.ok(!forbiddenGeometry.has(property),`skin changed forbidden geometry property: ${line}`);
    assert.notEqual(property,"border",`skin changed border width instead of visual border color/shadows: ${line}`);
}

console.log("✓ black-gold window skin is visual-only and geometry-safe");
