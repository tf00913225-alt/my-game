"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const characterRuntime=fs.readFileSync(
    "js/19-stage-v78-character-inventory-runtime.js",
    "utf8"
);
const functionalRepairs=fs.readFileSync(
    "js/58-v173.63-functional-fixes.js",
    "utf8"
);

assert.match(
    characterRuntime,
    /width[\s\S]*calc\(100% - 8px\)[\s\S]*height[\s\S]*calc\(100% - 8px\)/,
    "character owner must use the full mobile canvas"
);
assert.doesNotMatch(
    characterRuntime,
    /396px[\s\S]*620px|620px[\s\S]*396px/,
    "legacy medium-panel inline size must not return"
);
assert.match(
    characterRuntime,
    /v173:runtime-ready/,
    "V173.63 functional repairs must wait for the shared late-runtime ready signal"
);
assert.match(
    characterRuntime,
    /js\/58-v173\.63-functional-fixes\.js\?v=173\.62/,
    "late loader must attach the single V173.63 functional repair owner"
);
assert.doesNotMatch(
    characterRuntime,
    /visible-ui-repairs/,
    "the obsolete duplicate visible repair runtime must not be loaded"
);

assert.doesNotMatch(functionalRepairs,/quickPowerSavingToggle|v17361-power-save-toggle|v17361TogglePowerSaving|v17361_patrol_power_saving|v17361RequestWakeLock/);
assert.match(functionalRepairs,/v169-dungeon-inventory-overlay/);
assert.match(functionalRepairs,/v148ShowDailyDungeonPreview/);
assert.match(functionalRepairs,/v17346ShowEquipmentDungeonPreview/);
assert.match(functionalRepairs,/EQUIPMENT_DROP_TIERS/);
assert.match(functionalRepairs,/oreQty=10\*multi/);
assert.match(functionalRepairs,/blueprintQty=20\*multi/);
assert.match(functionalRepairs,/v17363CraftMaterial/);
assert.match(functionalRepairs,/v132ConsumeStackItem\(source\.id,50\)/);
assert.match(functionalRepairs,/add\(target,10\)/);
assert.match(functionalRepairs,/equipment-v17363\.png/);
assert.match(functionalRepairs,/assets\/ui\/map-return\.png/);
assert.match(functionalRepairs,/v132GetContentItemDefinition|v132GetContentDefinitions/);

console.log("✓ V173.63 repairs attach after runtime owners and cover the requested live features");
