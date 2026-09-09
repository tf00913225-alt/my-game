"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");

const BASE="39767ce2b9dbfa59650b7c5fd4d52a57a2642ea5";
const GAMEPLAY_BATTLE_BASE="4a592dd4c41d7efb1a4849fbfe0cbf68598121bf";
const current=file=>fs.readFileSync(file,"utf8");
const at=(ref,file)=>cp.execFileSync("git",["show",`${ref}:${file}`],{encoding:"utf8",maxBuffer:16*1024*1024});
const base=file=>at(BASE,file);
const normalize=text=>text.replace(/\r\n/g,"\n").trim();

function segment(text,start,end){
    const a=text.indexOf(start);
    assert.ok(a>=0,`missing segment start: ${start}`);
    const b=end?text.indexOf(end,a):text.length;
    assert.ok(b>a,`missing segment end: ${end}`);
    return normalize(text.slice(a,b));
}

function sameSegment(file,start,end,reference=BASE){
    assert.equal(segment(current(file),start,end),segment(at(reference,file),start,end),`${file} battle-owned segment changed`);
}

function retireV143EarthShieldSelector(text){
    return normalize(text.replace(
        "#battlePage .v146-defeated .v141-effect,\n#battlePage .v146-defeated .v143-earth-shield-effect{display:none !important;}",
        "#battlePage .v146-defeated .v141-effect{display:none !important;}"
    ));
}

function retireV146LegacySkillVfx(text){
    const start=text.indexOf(".v143-skill-flight{offset-anchor:50% 50%;transform-origin:50% 50%;}");
    if(start<0){ return normalize(text); }
    const end=text.indexOf(".v146-area-impact{",start);
    assert.ok(end>start,"retired V146 VFX block end missing");
    return normalize(text.slice(0,start)+text.slice(end));
}

// V131 starts with battle formation/element-card rules. Typography work begins only
// after the character/home-feature shell, so the entire battle prefix must be byte-equivalent.
sameSegment(
    "css/31-v131-fix-batch.css",
    "#game-stage #battleMonsterArea.v131-formation",
    "#game-stage #homeFeatureModal .home-feature-modal-box.wide"
);

// V146's opening combat/VFX section is followed by inventory polish. Preserve that
// full combat region byte-for-byte except the explicitly retired V143 Earth Shield
// procedural selector; the official status Sprite Sheet is now the only owner.
{
    const file="css/42-v146-system-polish.css";
    const start="#game-stage #battlePage #battleMonsterArea";
    const end="#game-stage #inventoryPage .inventory-grid-scroll";
    assert.equal(
        retireV146LegacySkillVfx(retireV143EarthShieldSelector(segment(current(file),start,end))),
        retireV146LegacySkillVfx(retireV143EarthShieldSelector(segment(at(BASE,file),start,end))),
        `${file} battle-owned segment changed outside retired V143 Earth Shield selector and V146 legacy skill VFX block`
    );
}
assert.match(base("css/42-v146-system-polish.css"),/#game-stage #battlePage #battleMonsterArea\{[\s\S]*?transform:translateY\(16px\);[\s\S]*?\}/);
assert.match(current("css/42-v146-system-polish.css"),/#game-stage #battlePage #battleMonsterArea\{[\s\S]*?transform:translateY\(16px\);[\s\S]*?\}/);
assert.doesNotMatch(current("css/42-v146-system-polish.css"),/v143-earth-shield-effect/);
assert.doesNotMatch(current("css/42-v146-system-polish.css"),/v143-skill-flight|v143-skill-field|v143-hit-impact|v146-flight-art/);

// This requirement intentionally expands the Gameplay BOSS battle UI owner: the
// redundant title is removed, the active Gameplay BOSS becomes a large 9:16 card,
// the mechanism target card becomes 9:16, and detail moves to a right-side alert.
// Preserve every pre-battle Gameplay panel rule and the existing protected-BOSS /
// toast / animation tail around that newly owned section.
{
    const file="css/gameplay-boss-tower.css";
    const now=current(file);
    const approved=at(GAMEPLAY_BATTLE_BASE,file);
    const newMarker="/* ---------- Boss battle portrait / mechanism UI ---------- */";
    const oldMarker="/* ---------- Boss mechanism slot ---------- */";
    const nowMarker=now.indexOf(newMarker);
    const approvedMarker=approved.indexOf(oldMarker);
    assert.ok(nowMarker>0,"new Gameplay BOSS battle owner marker missing");
    assert.ok(approvedMarker>0,"approved Gameplay BOSS battle owner marker missing");
    assert.equal(
        normalize(now.slice(0,nowMarker)),
        normalize(approved.slice(0,approvedMarker)),
        `${file} non-battle Gameplay panel rules changed`
    );

    const protectedStart="#game-stage #battlePage .battle-monster.gameplay-boss-protected{";
    const motionStart="@media (prefers-reduced-motion:reduce){";
    assert.equal(
        segment(now,protectedStart,motionStart),
        segment(approved,protectedStart,motionStart),
        `${file} protected-BOSS/toast/legacy mechanism animations changed outside this UI requirement`
    );

    assert.match(now,/#battlePage \.battle-title\{[\s\S]*?display:none !important;[\s\S]*?height:0 !important;/);
    assert.match(now,/\.battle-monster\.gameplay-boss-card\{[\s\S]*?--v143-monster-card-width:166px;[\s\S]*?--v143-monster-card-height:295px;[\s\S]*?aspect-ratio:9 \/ 16;/);
    assert.match(now,/\.boss-mechanism-slot\{[\s\S]*?position:relative;[\s\S]*?display:none;[\s\S]*?width:100%;[\s\S]*?pointer-events:none;/);
    assert.match(now,/\.boss-mechanism-slot\.active\{\s*display:flex;/);
    assert.match(now,/\.boss-mechanism-card\{[\s\S]*?width:78px;[\s\S]*?aspect-ratio:9 \/ 16;[\s\S]*?pointer-events:auto;[\s\S]*?animation:gameplayMechanismEnter \.24s ease-out both;/);
    assert.match(now,/\.boss-mechanism-hp\{[\s\S]*?min-height:19px;[\s\S]*?font-size:11px;[\s\S]*?font-weight:900;/);
    assert.match(now,/\.boss-mechanism-info-alert\{[\s\S]*?border-radius:50%;[\s\S]*?animation:gameplayMechanismInfoAlert \.48s ease-in-out infinite;/);
    assert.match(now,/\.boss-mechanism-info-panel\{[\s\S]*?width:170px;[\s\S]*?height:302px;[\s\S]*?aspect-ratio:9 \/ 16;/);
}

// Relic battle rules are followed by a small-screen media block that owns the
// non-battle relic cards. Compare only the actual battle-owned range; the later
// card min-height is intentionally allowed to grow for readable non-battle text.
sameSegment(
    "css/55-team-relic-system.css",
    "#game-stage .team-relic-battle-banner",
    "@media(max-width:390px)"
);

console.log("Battle preservation: mixed CSS keeps battle layout at approved baselines outside the scoped Gameplay BOSS portrait/mechanism owner and retired procedural VFX selectors.");
