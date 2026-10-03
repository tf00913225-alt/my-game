"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const v154=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const v148=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const adapter=fs.readFileSync("js/battlefield-render-geometry-adapter.js","utf8");
const css=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const legacyCss=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const v174=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");

assert.doesNotMatch(v154,/v162-abyss-battle-portrait-art|syncMonsterPortraitArt/,
    "V154 must not create or maintain a legacy img portrait pipeline");
assert.match(v154,/presentation\.applyUnit\(card,"monster"\)/,
    "V154 must hand the selected record to the only presentation owner");
assert.match(v154,/monsterPortraitRegistryPromise=null/,
    "registry failure must be retryable");
assert.match(v154,/dailyPortraitPreparation\.delete\(key\)/,
    "failed preparation must not poison the session");
assert.match(v154,/ensureAssets\(\[record\.path\]\)/,
    "asset failure isolation must be per portraitKey");
assert.match(v148,/prepared\.state!=="ready"/,
    "formal daily launch must gate on Visual Ready");
assert.match(equipment,/v154PrepareDailyDungeonPortraits\("gold"\)/,
    "equipment/gold entry must use the shared preparation lifecycle");
assert.doesNotMatch(adapter,/img\.v162-abyss-battle-portrait-art/,
    "geometry must measure only formal artwork");
assert.doesNotMatch(css,/v162-abyss-battle-portrait-art/,
    "CSS must not hide a retired legacy image");
assert.doesNotMatch(legacyCss,/v162-abyss-battle-portrait-art|var\(--v152-abyss-portrait\)/,
    "CSS46 must not restore either retired artwork surface");
assert.match(v174,/function syncUnitArtwork\(card,kind\)/,
    "V174 must own artwork DOM creation and presentation");

console.log("Daily Dungeon portrait owner convergence contracts: PASS.");

/* Execute the current selection/preparation owner, including its initial
   failed registry request. Verify isolation and retry behavior rather than
   importing the old PR's cache or presentation implementation. */
(async()=>{
    const vm=require('node:vm');
    const registry=JSON.parse(fs.readFileSync('config/monster-portrait-registry.json','utf8'));
    let requests=0,failElite=true;
    const elitePath=registry.groups.daily.find(row=>row[0]==='daily.exp.elite')[5];
    const context={console:{warn(){}},fetch:async()=>{
        requests++;if(requests===1)throw Error('isolated registry failure');
        return {ok:true,json:async()=>registry};
    },FourSymbolsFeatures:{ensureAssets:async paths=>{if(failElite&&paths.includes(elitePath))throw Error('isolated elite decode failure');}}};
    context.window=context;vm.createContext(context);vm.runInContext(v154,context);
    await context.v154RequestMonsterPortraitRegistry();
    assert.equal(context.v154GetMonsterPortraitRegistryState(),'failed');
    const pending=context.v154PrepareDailyDungeonPortraits('exp');
    assert.equal(context.v154PrepareDailyDungeonPortraits('exp'),pending,'share the pending preparation');
    const failure=await pending;
    assert.equal(failure.state,'failed');assert.deepEqual(Array.from(failure.failures),['daily.exp.elite']);
    assert.equal(requests,2,'retry registry without reloading the app');
    for(const rank of ['regular','boss'])assert.equal(context.v154ResolveMonsterPortraitRecord({portraitKey:'daily.exp.'+rank}).status,'existing','one decode failure must not poison other ranks');
    assert.equal(context.v154ResolveMonsterPortraitRecord({portraitKey:'daily.exp.elite',rank:'elite'}).status,'fallback');
    failElite=false;
    const success=await context.v154PrepareDailyDungeonPortraits('exp');
    assert.equal(success.state,'ready');assert.deepEqual(Array.from(success.failures),[]);
    assert.equal(context.v154ResolveMonsterPortraitRecord({portraitKey:'daily.exp.elite'}).status,'existing','retry clears failed-key state');
    assert.equal(await context.v154PrepareDailyDungeonPortraits('exp'),success,'cache the successful preparation');
    console.log('Daily Dungeon registry/decode isolation and retry lifecycle: PASS.');
})().catch(error=>{console.error(error);process.exitCode=1;});
