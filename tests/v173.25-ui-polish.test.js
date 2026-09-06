const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=path=>fs.readFileSync(path,"utf8");
const index=read("index.html");
const baseCss=read("css/00-main.css");
const characterCore=read("css/22-stage-v78-character-inventory-core.css");
const detailCss=read("css/23-stage-v77-inventory-detail-ui.css");
const ticketCss=read("css/33-v132-content-expansion.css");
const itemCss=read("css/38-v141-system-expansion.css");
const badgeCss=read("css/40-v143-combat-dungeon-polish.css");
const statusCss=read("css/42-v146-system-polish.css");
const frostbiteCss=read("css/45-v152-dev-fixes.css");
const v131LayoutCss=read("css/31-v131-fix-batch.css");
const lateLayoutCss=read("css/49-v169-rpg-ui.css");
const main=read("js/00-main.js");
const content=read("js/27-v132-content-expansion.js");
const oldBadgeFix=read("js/29-v134-fixes.js");
const animationTiming=read("js/37-v142-skill-animation.js");
const animationUi=read("js/39-v143-skill-animation.js");
const statusUi=read("js/41-v146-system-polish.js");
const frostbiteUi=read("js/44-v152-dev-fixes.js");
const loader=read("js/20-anonymous-20.js");

let passed=0;
function test(name,callback){
    callback();
    passed++;
    console.log("✓ "+name);
}

test("wear and sell share one exact enabled visual",()=>{
    assert.match(baseCss,/\.equip-button,\s*\.sell-button\{\s*background:linear-gradient\(180deg,#8a2a1e,#5a160e\);\s*color:#f2ead9;/);
});

test("equipment preview art and copy fit without clipping",()=>{
    assert.match(itemCss,/#itemModal \.item-modal-icon > \.v169-equipment-art\{[\s\S]*width:min\(46vw,190px\);[\s\S]*height:min\(46vw,190px\)/);
    assert.match(itemCss,/#itemModal \.item-stat-list\{[\s\S]*max-height:none !important;[\s\S]*overflow:visible !important/);
});

test("backpack ability details keep the close button outside the scroll owner",()=>{
    assert.match(detailCss,/#inventoryCharacterDetailModal \.inventory-character-detail-box\{[\s\S]*display:flex !important;[\s\S]*overflow:hidden !important/);
    assert.match(detailCss,/#inventoryCharacterDetailModal \.inventory-character-detail-grid\{[\s\S]*flex:1 1 auto !important;[\s\S]*overflow-y:auto !important/);
    assert.match(detailCss,/#inventoryCharacterDetailModal \.close-item-button\{[\s\S]*flex:0 0 auto !important/);
});

test("the ability page no longer owns a synthetic black spacer",()=>{
    assert.match(characterCore,/#characterTabContent\{[\s\S]*padding-bottom:0 !important/);
    assert.doesNotMatch(characterCore,/padding-bottom:160px/);
    assert.match(v131LayoutCss,/#homeFeatureModal #characterTabContent\{[\s\S]{0,700}padding-bottom:0 !important/);
    assert.doesNotMatch(v131LayoutCss,/padding-bottom:110px/);
    assert.doesNotMatch(lateLayoutCss,/#characterTabContent\{\s*padding-bottom:0/);
});

test("ticket preview is a complete non-scrolling 2 by 5 grid",()=>{
    assert.match(content,/v132-reward-modal-inner v132-ticket-preview-modal/);
    assert.match(content,/<button type="button" class="v132-preview-item"[\s\S]*v132OpenPreviewEquipmentDetail/);
    assert.match(ticketCss,/\.v132-ticket-preview-modal\{[\s\S]*overflow:hidden/);
    assert.match(ticketCss,/\.v132-ticket-preview-modal \.v132-preview-grid\{[\s\S]*grid-template-rows:repeat\(5,minmax\(0,1fr\)\);[\s\S]*overflow:visible/);
});

test("ticket equipment icons open the canonical item detail and return to preview",()=>{
    assert.match(content,/function openPreviewEquipmentDetail\(itemId\)[\s\S]*openEquippedItem\(item,""\)/);
    assert.match(content,/modal\.classList\.add\("v132-ticket-preview-detail"\)/);
    assert.match(content,/rewardModal\.classList\.add\("v132-detail-paused"\)/);
    assert.match(content,/returningToTicketPreview[\s\S]*rewardModal\.classList\.remove\("v132-detail-paused"\)/);
});

test("skill labels use exactly two thirds of the owning animation",()=>{
    assert.match(animationTiming,/Math\.round\(config\.duration\*2\/3\)/);
    assert.match(main,/v142GetSkillNameDisplayDuration/);
    assert.match(main,/--skill-name-display-duration/);
    assert.match(badgeCss,/animation:v143CasterLabel var\(--skill-name-display-duration,347ms\)/);
    assert.doesNotMatch(oldBadgeFix,/V134_SKILL_BADGE_MS|trimSkillBadgeLifetime/);
    assert.doesNotMatch(animationUi,/badge\.remove\(\); \} \},650/);
});

test("frostbite uses text instead of a prohibition icon",()=>{
    assert.match(frostbiteCss,/content:"凍傷禁止使用技能" !important/);
    assert.doesNotMatch(frostbiteCss,/content:"🚫"|v152-frostbite-symbol/);
    assert.doesNotMatch(frostbiteUi,/symbol\.textContent="🚫"/);
});

test("status text sits below damage and stays fully visible for one second",()=>{
    assert.match(statusUi,/rect\.top\+rect\.height\*\.86/);
    assert.match(statusCss,/animation:v146StatusPopup 1\.25s/);
    assert.match(statusCss,/10%,90%\{opacity:1/);
});

test("development cache and visible build advance to V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.62"/);
    assert.match(index,/<title>四象江湖傳 V173\.62<\/title>/);
    assert.match(index,/>V173\.62<\/div>/);
});

console.log("\n"+passed+" V173.39 UI polish tests passed.");
