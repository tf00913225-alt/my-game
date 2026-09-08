"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");

const BASE="39767ce2b9dbfa59650b7c5fd4d52a57a2642ea5";
const current=file=>fs.readFileSync(file,"utf8");
const base=file=>cp.execFileSync("git",["show",`${BASE}:${file}`],{encoding:"utf8",maxBuffer:16*1024*1024});
const normalize=text=>text.replace(/\r\n/g,"\n").trim();

function segment(text,start,end){
    const a=text.indexOf(start);
    assert.ok(a>=0,`missing segment start: ${start}`);
    const b=end?text.indexOf(end,a):text.length;
    assert.ok(b>a,`missing segment end: ${end}`);
    return normalize(text.slice(a,b));
}

function sameSegment(file,start,end){
    assert.equal(segment(current(file),start,end),segment(base(file),start,end),`${file} battle-owned segment changed`);
}

// V131 starts with battle formation/element-card rules. Typography work begins only
// after the character/home-feature shell, so the entire battle prefix must be byte-equivalent.
sameSegment(
    "css/31-v131-fix-batch.css",
    "#game-stage #battleMonsterArea.v131-formation",
    "#game-stage #homeFeatureModal .home-feature-modal-box.wide"
);

// V146's opening combat/VFX section is followed by inventory polish. Preserve that
// full combat region, including dimensions, transforms, status popup and VFX geometry.
sameSegment(
    "css/42-v146-system-polish.css",
    "#game-stage #battlePage #battleMonsterArea",
    "#game-stage #inventoryPage .inventory-grid-scroll"
);
assert.ok(base("css/42-v146-system-polish.css").includes("#game-stage #battlePage #battleMonsterArea{transform:translateY(12px);}"));
assert.ok(current("css/42-v146-system-polish.css").includes("#game-stage #battlePage #battleMonsterArea{transform:translateY(12px);}"));

// Gameplay and relic files have explicit battle sections. Everything from those
// battle markers onward must remain identical to the starting dev snapshot.
sameSegment(
    "css/gameplay-boss-tower.css",
    "/* ---------- Boss mechanism slot ---------- */",
    null
);
sameSegment(
    "css/55-team-relic-system.css",
    "#game-stage .team-relic-battle-banner",
    null
);

console.log("Battle preservation: touched mixed CSS keeps battle typography/layout identical to starting dev.");
