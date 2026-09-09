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

function removeExactCssRules(text,selectors){
    let result=text;
    for(const selector of selectors){
        const needle=selector+"{";
        for(;;){
            const start=result.indexOf(needle);
            if(start<0){ break; }
            const open=result.indexOf("{",start);
            let depth=0;
            let end=-1;
            for(let i=open;i<result.length;i+=1){
                if(result[i]==="{"){ depth+=1; }
                else if(result[i]==="}"){
                    depth-=1;
                    if(depth===0){ end=i+1;break; }
                }
            }
            assert.ok(end>open,`unterminated CSS rule: ${selector}`);
            result=result.slice(0,start)+result.slice(end);
        }
    }
    return normalize(result);
}

function retireV143EarthShieldSelector(text){
    return normalize(text.replace(
        "#battlePage .v146-defeated .v141-effect,\n#battlePage .v146-defeated .v143-earth-shield-effect{display:none !important;}",
        "#battlePage .v146-defeated .v141-effect{display:none !important;}"
    ));
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
        retireV143EarthShieldSelector(segment(current(file),start,end)),
        retireV143EarthShieldSelector(segment(at(BASE,file),start,end)),
        `${file} battle-owned segment changed outside retired V143 Earth Shield selector`
    );
}
assert.ok(base("css/42-v146-system-polish.css").includes("#game-stage #battlePage #battleMonsterArea{transform:translateY(12px);}"));
assert.ok(current("css/42-v146-system-polish.css").includes("#game-stage #battlePage #battleMonsterArea{transform:translateY(12px);}"));
assert.doesNotMatch(current("css/42-v146-system-polish.css"),/v143-earth-shield-effect/);

// Gameplay has a clean battle-only tail. The 2026-09-09 BOSS-card readability
// requirement intentionally owns only the mechanism slot/base-card/HP presentation.
// Keep every other BOSS battle rule byte-equivalent to the approved gameplay base
// instead of weakening this guard for the whole tail.
{
    const file="css/gameplay-boss-tower.css";
    const start="/* ---------- Boss mechanism slot ---------- */";
    const ownedSelectors=[
        "#game-stage #battleMonsterArea .boss-mechanism-slot",
        "#game-stage #battleMonsterArea .boss-mechanism-card",
        "#game-stage #battleMonsterArea .boss-mechanism-hp,\n#game-stage #battleMonsterArea .boss-mechanism-effect",
        "#game-stage #battleMonsterArea .boss-mechanism-hp",
        "#game-stage #battleMonsterArea .boss-mechanism-effect"
    ];
    const now=segment(current(file),start,null);
    const approved=segment(at(GAMEPLAY_BATTLE_BASE,file),start,null);
    assert.equal(
        removeExactCssRules(now,ownedSelectors),
        removeExactCssRules(approved,ownedSelectors),
        `${file} non-owned BOSS battle rules changed`
    );

    // The carved-out rules still keep their established positioning/interaction
    // contract while allowing only the requested size and HP-weight changes.
    assert.match(now,/\.boss-mechanism-slot\{[\s\S]*?position:absolute;[\s\S]*?z-index:18;[\s\S]*?top:104px;[\s\S]*?left:50%;[\s\S]*?width:252px;[\s\S]*?min-height:86px;[\s\S]*?pointer-events:none;/);
    assert.match(now,/\.boss-mechanism-card\{[\s\S]*?width:120px;[\s\S]*?min-height:84px;[\s\S]*?border:2px solid var\(--mechanism-color,#d5aa56\);[\s\S]*?pointer-events:auto;[\s\S]*?animation:gameplayMechanismEnter \.24s ease-out both;/);
    assert.match(now,/\.boss-mechanism-hp\{[\s\S]*?min-height:18px;[\s\S]*?font-size:11px;[\s\S]*?font-weight:900;/);
    assert.match(now,/\.boss-mechanism-effect\{ color:#b9ad98; \}/);
}

// Relic battle rules are followed by a small-screen media block that owns the
// non-battle relic cards. Compare only the actual battle-owned range; the later
// card min-height is intentionally allowed to grow for readable non-battle text.
sameSegment(
    "css/55-team-relic-system.css",
    "#game-stage .team-relic-battle-banner",
    "@media(max-width:390px)"
);

console.log("Battle preservation: mixed CSS keeps battle layout at approved baselines outside explicit BOSS mechanism UI ownership and retired procedural VFX selectors.");