"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const patrol=fs.readFileSync("js/26-v131-patrol-appearance.js","utf8");
const quests=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const questCss=fs.readFileSync("css/25-stage-v90-quest-interface-core.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function assertAsset(path,format){
    const data=fs.readFileSync(path);
    assert.ok(data.length>1000,path+" is not empty");
    if(format==="JPEG"){
        assert.deepEqual([data[0],data[1]],[0xff,0xd8],path+" format");
    }
    else{
        assert.equal(data.toString("ascii",0,4),format,path+" format");
    }
}

test("all supplied wind icons are mapped to their matching final skill owners",()=>{
    const mapping={
        stormFist:"wind-storm-fist.jpg",
        stormFlurry:"wind-storm-flurry.jpg",
        windCrossSlash:"wind-cross-slash.jpg",
        dizzyFist:"wind-dizzy-fist.jpg",
        stormCircle:"wind-storm-circle.jpg",
        windHowlLightning:"wind-howl-lightning.jpg",
        stormRain:"wind-storm-rain.jpg",
        dodgeSkill:"wind-dodge.jpg",
        stealthSkill:"wind-stealth.jpg",
        dinghaishenzhen:"wind-calm-mind.jpg",
        windEX:"wind-ex.jpg"
    };
    Object.entries(mapping).forEach(([skillId,file])=>{
        assert.match(main,new RegExp("\\b"+skillId+':"assets/skills/'+file.replaceAll(".","\\.")+'"'));
        assertAsset("assets/skills/"+file,"JPEG");
    });
    assert.match(main,/const skillIconImages=elementSkillIconMap;/);
});

test("quest milestones use bright unopened art and dim opened art after claiming",()=>{
    [
        "assets/ui/quest-chest-closed-v173.21.webp",
        "assets/ui/quest-chest-open-v173.21.webp"
    ].forEach(path=>assertAsset(path,"RIFF"));
    assert.match(quests,/closed:"assets\/ui\/quest-chest-closed-v173\.21\.webp"/);
    assert.match(quests,/open:"assets\/ui\/quest-chest-open-v173\.21\.webp"/);
    assert.match(quests,/claimed\?milestoneChestImages\.open:milestoneChestImages\.closed/);
    assert.match(questCss,/\.quest-milestone-chest\{[\s\S]*?opacity:1 !important;[\s\S]*?filter:none !important;/);
    assert.match(questCss,/\.quest-milestone\.claimed \.quest-milestone-chest\{[\s\S]*?saturate\(\.42\) brightness\(\.58\)/);
});

test("male patrol art switches front and back images for every element",()=>{
    ["fire","water","wind","earth"].forEach(element=>{
        ["front","back"].forEach(facing=>{
            const path="assets/characters/patrol-male-"+element+"-"+facing+"-v173.21.webp";
            assertAsset(path,"RIFF");
            assert.match(patrol,new RegExp(element+':[\\s\\S]*?'+facing+':"'+path.replaceAll(".","\\.")+'"'));
        });
    });
    assert.match(patrol,/const maleArt=isMaleCharacter\(character\)[\s\S]*?malePatrolArtUrls\[element\]\[facing\]/);
    assert.match(patrol,/if\(maleArt\)\{\s*img\.src=maleArt;/);
});

test("both patrol fight frames point to the newly supplied images",()=>{
    [
        "assets/battle/patrol-fight-1-v173.21.webp",
        "assets/battle/patrol-fight-2-v173.21.webp"
    ].forEach(path=>assertAsset(path,"RIFF"));
    assert.match(main,/const PATROL_FIGHT1_B64="assets\/battle\/patrol-fight-1-v173\.21\.webp";/);
    assert.match(main,/const PATROL_FIGHT2_B64="assets\/battle\/patrol-fight-2-v173\.21\.webp";/);
});

test("the development release and cache advance to V173.22",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.22"/);
    assert.match(index,/<title>四象江湖傳 V173\.22<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.22"[\s\S]*?>V173\.22<\/div>/);
    assert.match(index,/css\/25-stage-v90-quest-interface-core\.css\?v=173\.22/);
});

console.log("\n"+passed+" V173.22 new-player and supplied-asset tests passed.");
