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

function restoreGameplayCoverBaseline(text){
    return normalize(text
        .replace(/\/\* Gameplay activity covers use the same 16:9 production ratio as dungeon\n   covers\. Combat BOSS\/mechanism cards remain independent 9:16 components\. \*\/\n/,"")
        .replace("    min-height:0;\n    aspect-ratio:16 / 9;\n    box-sizing:border-box;","    min-height:120px;\n    box-sizing:border-box;")
        .replace("#game-stage .gameplay-mode-card.coming-soon{\n    opacity:.67;","#game-stage .gameplay-mode-card.coming-soon{\n    min-height:88px;\n    opacity:.67;")
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
// redundant title is removed, both BOSS and mechanism target cards use 4:3,
// compact screens shrink both through the same owner, and detail stays in the
// existing right-side alert. This batch is additionally allowed to change only
// the Gameplay activity
// cover geometry from legacy min-heights to one explicit 16:9 ratio. Normalize
// precisely that approved change back to the work base before byte-comparing the
// rest of the pre-battle panel CSS.
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
    assert.equal(
        restoreGameplayCoverBaseline(now.slice(0,nowMarker)),
        normalize(workBase.slice(0,workBaseMarker)),
        `${file} non-battle Gameplay panel rules changed outside the approved 16:9 activity-cover geometry`
    );
    assert.match(now,/#game-stage \.gameplay-mode-card\{[\s\S]*?width:100%;[\s\S]*?min-height:0;[\s\S]*?aspect-ratio:16 \/ 9;/);
    assert.doesNotMatch(cssRule(now,"#game-stage .gameplay-mode-card.coming-soon{"),/min-height:/,"coming-soon activity uses the same 16:9 cover geometry");

    const protectedStart="#game-stage #battlePage .battle-monster.gameplay-boss-protected{";
    const motionStart="@media (prefers-reduced-motion:reduce){";
    assert.equal(
        segment(now,protectedStart,motionStart),
        segment(approved,protectedStart,motionStart),
        `${file} protected-BOSS/toast/legacy mechanism animations changed outside this UI requirement`
    );

    assert.match(now,/#battlePage:has\(#battleMonsterArea\.gameplay-boss-active\) \.battle-title\{[\s\S]*?visibility:hidden;[\s\S]*?opacity:0;/);
    assert.match(now,/#battleMonsterArea\.gameplay-boss-active\{[\s\S]*?--gameplay-boss-card-width:clamp\(148px,36\.5%,160px\);[\s\S]*?--gameplay-mechanism-card-width:clamp\(82px,20%,92px\);[\s\S]*?margin-top:-16px;/);
    assert.match(now,/\.battle-monster\.gameplay-boss-card\[data-rank="boss"\]\{[\s\S]*?--v143-monster-card-width:var\(--gameplay-boss-card-width\);[\s\S]*?--v143-monster-card-height:auto;[\s\S]*?aspect-ratio:4 \/ 3;/);
    assert.match(now,/\.boss-mechanism-slot\{[\s\S]*?position:relative;[\s\S]*?display:none;[\s\S]*?width:100%;[\s\S]*?margin:3px auto 0;[\s\S]*?pointer-events:none;/);
    assert.match(now,/\.boss-mechanism-slot\.active\{\s*display:flex;/);
    assert.match(now,/\.boss-mechanism-card\{[\s\S]*?width:var\(--gameplay-mechanism-card-width\);[\s\S]*?min-width:0;[\s\S]*?aspect-ratio:4 \/ 3;[\s\S]*?flex:0 0 var\(--gameplay-mechanism-card-width\);[\s\S]*?pointer-events:auto;[\s\S]*?animation:gameplayMechanismEnter \.24s ease-out both;/);
    assert.match(now,/\.boss-mechanism-hp\{[\s\S]*?min-height:12px;[\s\S]*?font-size:9\.5px;[\s\S]*?font-weight:900;/);
    assert.match(now,/@media \(max-height:840px\)\{[\s\S]*?--gameplay-boss-card-width:clamp\(138px,34%,150px\);[\s\S]*?--gameplay-mechanism-card-width:clamp\(78px,19\.5%,88px\);/);
    assert.match(now,/\.boss-mechanism-info-alert\{[\s\S]*?border-radius:50%;[\s\S]*?animation:gameplayMechanismInfoAlert \.48s ease-in-out infinite;/);
    assert.match(now,/\.boss-mechanism-info-panel\{[\s\S]*?width:170px;[\s\S]*?height:302px;[\s\S]*?aspect-ratio:9 \/ 16;/);

    const bossSizingPriorityScope=[
        cssRule(now,"#game-stage #battleMonsterArea.gameplay-boss-active{"),
        cssRule(now,"#game-stage #battleMonsterArea.gameplay-boss-active .v131-monster-row{"),
        cssRule(now,'#game-stage > #app > #game-content #battlePage .battle-monster.gameplay-boss-card[data-rank="boss"]{'),
        cssRule(now,"#game-stage #battleMonsterArea .boss-mechanism-slot{"),
        cssRule(now,"#game-stage #battleMonsterArea .boss-mechanism-card{")
    ].join("\n");
    assert.doesNotMatch(bossSizingPriorityScope,/!important/,"Gameplay BOSS 4:3 sizing must stay specificity-driven");
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

console.log("Battle preservation: mixed CSS keeps battle layout at approved baselines outside the scoped Gameplay BOSS 4:3/mechanism owner, approved 16:9 activity covers and retired procedural VFX selectors.");
