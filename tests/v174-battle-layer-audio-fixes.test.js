"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const layerCss=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");
const vfxCss=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const audio=fs.readFileSync("js/34-v141-core-systems.js","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("HP and SP resource HUD stays above persistent status VFX",()=>{
    assert.match(vfxCss,/\.v153-status-vfx-rage\{[\s\S]*?z-index:5;/);
    assert.match(
        layerCss,
        /#game-stage #battlePage \.battle-player \.hp-bar,[\s\S]*?#game-stage #battlePage \.battle-monster \.monster-sp\{[\s\S]*?position:relative !important;[\s\S]*?z-index:20 !important;/
    );
});

test("Element Box focus suppresses only the document-level skill presentation layer",()=>{
    assert.match(vfxCss,/\.v143-skill-stage\{[\s\S]*?z-index:16000;/);
    assert.match(
        layerCss,
        /body\.v162-element-box-settings-open > \.v143-skill-stage,[\s\S]*?\.skill-name-badge\.v143-caster-skill-label\{[\s\S]*?visibility:hidden !important;[\s\S]*?opacity:0 !important;/
    );
    assert.doesNotMatch(layerCss,/body\.v162-element-box-settings-open[\s\S]{0,180}\.v143-skill-stage[\s\S]{0,120}display:none/);
});

test("Skill SFX gain is exactly doubled without doubling general combat feedback",()=>{
    assert.match(audio,/const SKILL_VOLUME_SCALE=2;/);
    assert.match(audio,/function play\(kind,volumeScale\)/);
    assert.match(audio,/\(Number\(opts\.volume\)\|\|0\.16\)\*playbackGainScale/);
    assert.match(audio,/\(Number\(opts\.volume\)\|\|0\.14\)\*playbackGainScale/);
    assert.match(audio,/play\("heal",SKILL_VOLUME_SCALE\)/);
    assert.match(audio,/play\(elementKind,SKILL_VOLUME_SCALE\)/);
    assert.match(audio,/play\("explosion",SKILL_VOLUME_SCALE\)/);
    assert.match(audio,/skillVolumeScale:SKILL_VOLUME_SCALE/);
    assert.match(audio,/audioEngine\.play\("death"\)/);
    assert.match(audio,/audioEngine\.play\("dodge"\)/);
    assert.match(audio,/audioEngine\.play\(isCrit\?"crit":"damage"\)/);
    assert.doesNotMatch(audio,/audioEngine\.play\("death",SKILL_VOLUME_SCALE\)/);
    assert.doesNotMatch(audio,/audioEngine\.play\("dodge",SKILL_VOLUME_SCALE\)/);
});

console.log("\nV174 battle layer/audio fixes suite: "+passed+" tests passed.");
