"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");

const items=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const dialogue=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const css=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("supplied item art is mapped by effect, equipment slot and element",()=>{
    [
        "talismans/freeze.png","talismans/barrier.png","talismans/stealth.png",
        "blueprints/head.png","blueprints/shoulder.png","blueprints/shoes.png",
        "blueprints/hand.png","blueprints/armor.png"
    ].forEach(path=>assert.ok(items.includes("assets/items/"+path),path));
    ["fire","water","earth","wind"].forEach(element=>{
        assert.match(items,new RegExp('ticketIcon\\("'+element+'"\\)'));
        assert.ok(items.includes('"assets/items/tickets/"+elementKey+".png"'));
    });
    assert.match(items,/talismanIcon\(effect\.key,tier\.key\)/);
    assert.match(items,/blueprintIcon\(slot\.key,tier\.key\)/);
});

test("talisman and blueprint borders follow blue, purple, orange, magenta rarity order",()=>{
    const expected={low:"#3ba7ff",mid:"#a855f7",high:"#ff9f38",perfect:"#ff4fa7"};
    Object.entries(expected).forEach(([tier,color])=>{
        assert.match(css,new RegExp("v169-(?:talisman|blueprint)-art\\.v169-rarity-"+tier+"[^}]+border-color:"+color));
    });
    assert.match(css,/\.v169-item-art > img\{[^}]*object-fit:contain/);
});

test("a persisted Abyss run pauses at a progress gate without resetting its floor",()=>{
    assert.match(abyss,/let abyssMapEntered=false/);
    assert.match(abyss,/if\(!abyssState\.active\|\|!abyssMapEntered\)/);
    assert.match(abyss,/v169-abyss-progress/);
    assert.match(abyss,/繼續挑戰/);
    assert.match(abyss,/if\(!abyssState\.active\)\{ abyssState=Object\.assign/);
    assert.match(abyss,/if\(tabName!=="abyss"\)\{ abyssMapEntered=false; \}/);
    assert.match(abyss,/if\(page!=="dungeon"&&page!=="battle"\)\{ abyssMapEntered=false; \}/);
    assert.match(abyss,/raw\.phase==="portal"&&Number\(raw\.rewardVersion\|\|0\)<1/);
    assert.match(css,/\.v141-abyss-intro\.v169-abyss-resume/);
});

test("every floor starts bottom-center with its guardian and teleporter centered",()=>{
    assert.match(abyss,/x:50,y:84/);
    assert.match(abyss,/function bossPosition\(\)\{ return \[50,33\]; \}/);
    assert.match(abyss,/style="left:50%;top:10%"/);
    assert.match(abyss,/moveAbyssPlayer\(50,18/);
    assert.match(abyss,/abyssState\.x=50; abyssState\.y=84/);
});

test("floors one through four require their chest reward before portal travel",()=>{
    assert.match(abyss,/abyssState\.phase="chest"/);
    assert.match(abyss,/class="v141-abyss-portal'\+\(abyssState\.phase==="chest"\?' locked':''\)/);
    assert.match(abyss,/1:"ticketSetEarth",2:"ticketSetFire",3:"ticketSetWind",4:"ticketSetWater"/);
    assert.match(abyss,/abyssState\.phase="portal"/);
    assert.match(abyss,/v141ShowBlackGoldReward\(\{exp:0,gold:0,items:/);
    assert.match(abyss,/寶箱已開啟。請點擊上方傳送點前往下一層/);
    assert.match(css,/chest-closed\.png/);
    assert.match(css,/chest-open\.png/);
    assert.match(css,/portal\.png/);
});

test("guardian dialogue approaches first and remains a local boss-anchored bubble",()=>{
    assert.match(abyss,/window\.v141ApproachAbyssBoss=function/);
    assert.match(dialogue,/v141ApproachAbyssBoss\(openBossBubble\)/);
    assert.match(dialogue,/bossRect\.left\+bossRect\.width\/2-mapRect\.left/);
    assert.match(dialogue,/bossRect\.top-mapRect\.top-8/);
    assert.match(css,/\.v141-abyss-map > \.v143-abyss-dialogue\{[\s\S]*inset:auto !important;[\s\S]*height:auto !important;/);
    assert.match(css,/transform:translate\(-50%,-100%\)/);
    assert.doesNotMatch(css,/\.v141-abyss-map > \.v143-abyss-dialogue\{[^}]*height:100%/);
});

test("all supplied icons and Abyss portraits carry real transparency",()=>{
    const iconPaths=[
        "assets/dungeons/abyss/portal.png",
        "assets/dungeons/abyss/chest-open.png",
        "assets/dungeons/abyss/chest-closed.png",
        ...["freeze","barrier","stealth"].map(name=>"assets/items/talismans/"+name+".png"),
        ...["earth","wind","water","fire"].map(name=>"assets/items/tickets/"+name+".png"),
        ...["shoulder","armor","hand","shoes","head"].map(name=>"assets/items/blueprints/"+name+".png")
    ];
    const portraits=[
        "east-emperor.webp","south-emperor.webp","heaven-emperor.webp","north-emperor.webp","soldier.webp",
        "floor5-east-emperor.webp","floor5-heaven-emperor.webp","floor5-extreme-emperor.webp",
        "floor5-north-emperor.webp","floor5-south-emperor.webp","floor5-soldier.webp"
    ].map(name=>"assets/dungeons/abyss/"+name);
    iconPaths.concat(portraits).forEach(path=>{
        assert.ok(fs.statSync(path).size>10000,path);
        const opaque=execFileSync("identify",["-format","%[opaque]",path],{encoding:"utf8"}).trim().toLowerCase();
        assert.equal(opaque,"false",path+" must contain transparent pixels");
    });
});

console.log("\nV169 Abyss/assets flow suite: "+passed+" tests passed.");
