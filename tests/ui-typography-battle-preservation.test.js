"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");

const BASE="39767ce2b9dbfa59650b7c5fd4d52a57a2642ea5";
const GAMEPLAY_BATTLE_BASE="4a592dd4c41d7efb1a4849fbfe0cbf68598121bf";
const WORK_BASE="29b9668057846164a941fbf6617d2458d9af5476";
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

function cssRule(text,selector){
    const start=text.indexOf(selector);
    assert.ok(start>=0,`missing CSS rule: ${selector}`);
    const open=text.indexOf("{",start),end=text.indexOf("}",open);
    assert.ok(open>=0&&end>open,`invalid CSS rule: ${selector}`);
    return text.slice(start,end+1);
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

function normalizeApprovedGameplayCover16By9(text){
    return normalize(text
        .replace(
            "    width:100%;\n    min-height:0;\n    aspect-ratio:16 / 9;\n    box-sizing:border-box;",
            "    width:100%;\n    min-height:120px;\n    box-sizing:border-box;"
        )
        .replace(
            "        radial-gradient(circle at 90% 10%,rgba(209,150,54,.2),transparent 46%);\n    background-position:center;\n    background-size:cover;\n    box-shadow:",
            "        radial-gradient(circle at 90% 10%,rgba(209,150,54,.2),transparent 46%);\n    box-shadow:"
        )
        .replace(
            "#game-stage .gameplay-mode-card.coming-soon{\n    min-height:0;",
            "#game-stage .gameplay-mode-card.coming-soon{\n    min-height:88px;"
        )
    );
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
// Preserve every pre-battle Gameplay panel rule against the exact dev work base,
// except this batch's explicitly approved 16:9 Gameplay activity-cover geometry.
// The existing protected-BOSS / toast / animation tail remains anchored to the
// previously approved Gameplay battle baseline.
{
    const file="css/gameplay-boss-tower.css";
    const now=current(file);
    const workBase=at(WORK_BASE,file);
    const approved=at(GAMEPLAY_BATTLE_BASE,file);
    const newMarker="/* ---------- Boss battle portrait / mechanism UI ---------- */";
    const oldMarker="/* ---------- Boss mechanism slot ---------- */";
    const nowMarker=now.indexOf(newMarker);
    const workBaseMarker=workBase.indexOf(oldMarker);
    assert.ok(nowMarker>0,"new Gameplay BOSS battle owner marker missing");
    assert.ok(workBaseMarker>0,"work-base Gameplay BOSS battle owner marker missing");
    const nowPreBattle=now.slice(0,nowMarker);
    assert.match(nowPreBattle,/#game-stage \.gameplay-mode-card\{[\s\S]*?aspect-ratio:16 \/ 9;[\s\S]*?background-position:center;[\s\S]*?background-size:cover;/);
    assert.match(nowPreBattle,/#game-stage \.gameplay-mode-card\.coming-soon\{[\s\S]*?min-height:0;/);
    assert.equal(
        normalizeApprovedGameplayCover16By9(nowPreBattle),
        normalize(workBase.slice(0,workBaseMarker)),
        `${file} non-battle Gameplay panel rules changed outside approved 16:9 activity covers`
    );

    const protectedStart="#game-stage #battlePage .battle-monster.gameplay-boss-protected{";
    const motionStart="@media (prefers-reduced-motion:reduce){";
    assert.equal(
        segment(now,protectedStart,motionStart),
        segment(approved,protectedStart,motionStart),
        `${file} protected-BOSS/toast/legacy mechanism animations changed outside this UI requirement`
    );

    assert.match(now,/#battlePage:has\(#battleMonsterArea\.gameplay-boss-active\) \.battle-title\{[\s\S]*?visibility:hidden;[\s\S]*?opacity:0;/);
    assert.match(now,/#battleMonsterArea\.gameplay-boss-active\{[\s\S]*?margin-top:-32px;/);
    assert.match(now,/\.battle-monster\.gameplay-boss-card\[data-rank="boss"\]\{[\s\S]*?--v143-monster-card-width:clamp\(154px,38\.1%,166px\);[\s\S]*?--v143-monster-card-height:auto;[\s\S]*?aspect-ratio:9 \/ 16;/);
    assert.match(now,/\.boss-mechanism-slot\{[\s\S]*?position:relative;[\s\S]*?display:none;[\s\S]*?width:100%;[\s\S]*?margin:3px auto 0;[\s\S]*?pointer-events:none;/);
    assert.match(now,/\.boss-mechanism-slot\.active\{\s*display:flex;/);
    assert.match(now,/\.boss-mechanism-card\{[\s\S]*?width:clamp\(82px,20%,96px\);[\s\S]*?min-width:82px;[\s\S]*?aspect-ratio:9 \/ 16;[\s\S]*?flex:0 0 clamp\(82px,20%,96px\);[\s\S]*?pointer-events:auto;[\s\S]*?animation:gameplayMechanismEnter \.24s ease-out both;/);
    assert.match(now,/\.boss-mechanism-hp\{[\s\S]*?min-height:20px;[\s\S]*?font-size:11px;[\s\S]*?font-weight:900;/);
    assert.match(now,/\.boss-mechanism-info-alert\{[\s\S]*?border-radius:50%;[\s\S]*?animation:gameplayMechanismInfoAlert \.48s ease-in-out infinite;/);
    assert.match(now,/\.boss-mechanism-info-panel\{[\s\S]*?width:170px;[\s\S]*?height:302px;[\s\S]*?aspect-ratio:9 \/ 16;/);

    const bossSizingPriorityScope=[
        cssRule(now,"#game-stage #battleMonsterArea.gameplay-boss-active{"),
        cssRule(now,"#game-stage #battleMonsterArea.gameplay-boss-active .v131-monster-row{"),
        cssRule(now,'#game-stage > #app > #game-content #battlePage .battle-monster.gameplay-boss-card[data-rank="boss"]{'),
        cssRule(now,"#game-stage #battleMonsterArea .boss-mechanism-slot{"),
        cssRule(now,"#game-stage #battleMonsterArea .boss-mechanism-card{")
    ].join("\n");
    assert.doesNotMatch(bossSizingPriorityScope,/!important/,"Gameplay BOSS portrait sizing must stay specificity-driven");
    assert.doesNotMatch(now.replace(/\/\*[\s\S]*?\*\//g,""),/!important/,"Entire Gameplay Boss stylesheet declarations must remain free of priority patches");
}

// Relic battle rules are followed by a small-screen media block that owns the
// non-battle relic cards. Compare only the actual battle-owned range; the later
// card min-height is intentionally allowed to grow for readable non-battle text.
sameSegment(
    "css/55-team-relic-system.css",
    "#game-stage .team-relic-battle-banner",
    "@media(max-width:390px)"
);

console.log("Battle preservation: mixed CSS keeps battle layout at approved baselines outside the scoped Gameplay BOSS portrait/mechanism owner, approved 16:9 Gameplay covers, and retired procedural VFX selectors.");