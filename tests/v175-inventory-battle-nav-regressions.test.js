"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");

const inventory=read("js/53-v173.50-inventory-qol.js");
const normalize=inventory.slice(inventory.indexOf("function normalizeInventoryStacksAndOrder"),inventory.indexOf("window.v17362NormalizeInventoryStacksAndOrder"));
assert.ok(normalize.indexOf("const qualityDiff=inventoryQualityRank(b)-inventoryQualityRank(a);")<normalize.indexOf("const familyDiff=(familyOrder.get"),"inventory must sort quality before family in every tab");
assert.match(inventory,/const openOnce=getChestOpenOnce\(item\);/);
assert.match(inventory,/item\.id==="equipmentChest"[\s\S]*?window\.v17346OpenEquipmentChest/);

const inventoryCss=read("css/38-v141-system-expansion.css");
assert.match(inventoryCss,/#itemModal \.item-modal-icon > \.v169-item-art\{[\s\S]*?width:min\(42vw,180px\);[\s\S]*?height:min\(42vw,180px\);/);
assert.match(inventoryCss,/#itemModal \.item-modal-icon > \.v169-item-art > img,[\s\S]*?object-fit:contain;/);

const main=read("js/00-main.js");
const hpMarkup=main.indexOf('class="monster-hp"');
const spMarkup=main.indexOf('class="monster-sp"',hpMarkup);
const nameMarkup=main.indexOf('class="battle-monster-name"',hpMarkup);
assert.ok(hpMarkup>=0&&spMarkup>hpMarkup&&nameMarkup>spMarkup,"monster name must be rendered after both resource bars");
assert.match(main,/character-showcase-choice/);
assert.match(main,/choice\.classList\.toggle\("is-current-character",selected\)/);

const bossCss=read("css/gameplay-boss-tower.css");
assert.match(bossCss,/--gameplay-boss-card-width:clamp\(118px,29%,132px\)/);
assert.match(bossCss,/--gameplay-mechanism-card-width:clamp\(123px,30%,138px\)/);
assert.doesNotMatch(bossCss,/gameplay-boss-card \.damage-popup\{\s*display:none/);

const vfx=read("js/39-v143-skill-animation.js");
assert.match(vfx,/function authoredSquareSize\(sprite,geometry,defaults\)[\s\S]*?Math\.min\(configuredMax,base\*defaults\.maxRatio\)/);
assert.match(vfx,/placement==="single"[\s\S]*?maxRatio:1\.68/);
assert.match(vfx,/placement==="targetTrajectory"[\s\S]*?maxRatio:1\.56/);
assert.match(vfx,/placement==="targetTrajectory"[\s\S]*?--v143-sprite-angle/);
const vfxCss=read("css/40-v143-combat-dungeon-polish.css");
const fireCss=read("css/56-v174-critical-ui-regressions.css");
assert.match(vfxCss,/@keyframes v143RasterTravel\{[\s\S]*?rotate\(var\(--v143-sprite-angle,0deg\)\)/);
assert.doesNotMatch(fireCss,/v174FireRocketTravel/);
assert.doesNotMatch(fireCss,/data-skill="fireRocket"/);

const html=read("index.html");
const mapNav=html.slice(html.indexOf('id="mapPageNav"'),html.indexOf('id="mapFeatureModal"'));
const navPositions=["openHomeFeature('character')","openMapInventoryOverlay()","openHomeFeature('relic')","openHomeFeature('autoBattleSettings')","leaveMap()"].map(token=>mapNav.indexOf(token));
assert.ok(navPositions.every(position=>position>=0)&&navPositions.every((position,index)=>index===0||position>navPositions[index-1]),"map navigation must be 角色、背包、秘寶、元素匣、返回");
assert.match(mapNav,/assets\/ui\/nav-relic-v175\.webp/);
assert.ok(fs.existsSync("assets/ui/nav-relic-v175.webp"),"transparent relic navigation asset must ship");
assert.doesNotMatch(html,/<button[^>]*class="gameplay-back-button v174-gameplay-home-back"[\s\S]*?<\/button>/);

const batch=JSON.parse(read("release/requirement-batches/2026-09-14-inventory-battle-nav.json"));
assert.equal(batch.requirements.length,8);
assert.ok(batch.requirements.every(item=>item.status==="IMPLEMENTED"||item.status==="VERIFIED"));
console.log("V175 inventory, battle, VFX and navigation regression checks passed");
