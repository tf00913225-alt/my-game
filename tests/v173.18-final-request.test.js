"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const inventoryCss=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const itemCss=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function sourceFunction(source,signature){
    const start=source.indexOf(signature);
    assert.notEqual(start,-1,signature+" source");
    const opening=source.indexOf("{",start);
    let depth=0;
    let quote="";
    let escaped=false;
    for(let cursor=opening;cursor<source.length;cursor++){
        const character=source[cursor];
        if(quote){
            if(escaped){ escaped=false; }
            else if(character==="\\"){ escaped=true; }
            else if(character===quote){ quote=""; }
            continue;
        }
        if(character==='"'||character==="'"||character==="`"){ quote=character; continue; }
        if(character==="{"){ depth++; }
        if(character==="}"&&--depth===0){ return source.slice(start,cursor+1); }
    }
    throw new Error(signature+" closing brace");
}

function launchHarness(){
    const pages=[];
    const tabs=[];
    let callback=null;
    const context={
        window:null,
        abyssBattleStarting:false,
        abyssMapEntered:false,
        abyssState:{active:true,phase:"boss",floor:1,message:""},
        abyssFloors:{1:{boss:"東帝天尊"}},
        buildAbyssRoster(){ return [{name:"東帝天尊"}]; },
        setTimeout(handler){ handler(); return 1; },
        showPage(page){ pages.push(page); },
        persistAbyss(){},
        switchDungeonTab(tab){ tabs.push(tab); }
    };
    context.window=context;
    context.v132LaunchDungeonBattle=function(_roster,settled){ callback=settled; return true; };
    vm.createContext(context);
    vm.runInContext(
        sourceFunction(abyss,"function launchAbyssBossBattle(")+"\n"+
        "this.runLaunch=launchAbyssBossBattle;this.readMapEntered=function(){return abyssMapEntered;};",
        context
    );
    return {context,pages,tabs,settle(outcome){ assert.ok(callback); callback(outcome); }};
}

test("talisman artwork is border-box constrained to the inventory cell",()=>{
    const iconRule=inventoryCss.match(/#game-stage #inventoryPage \.inventory-item-classic \.inventory-icon\{[\s\S]*?\}/);
    assert.ok(iconRule);
    assert.match(iconRule[0],/width:100%;/);
    assert.match(iconRule[0],/height:100%;/);
    assert.match(iconRule[0],/min-width:0;/);
    assert.match(iconRule[0],/min-height:0;/);
    assert.match(iconRule[0],/overflow:hidden;/);
    assert.match(iconRule[0],/box-sizing:border-box;/);
    const artRule=itemCss.match(/#game-stage #inventoryPage \.inventory-item-classic \.inventory-icon > \.v169-item-art\{[\s\S]*?\}/);
    assert.ok(artRule);
    assert.match(artRule[0],/width:100%;[\s\S]*?height:100%;/);
    assert.match(artRule[0],/max-width:100%;[\s\S]*?max-height:100%;/);
    assert.match(itemCss,/\.v169-item-art\{[\s\S]*?box-sizing:border-box;/);
    assert.match(itemCss,/\.v169-item-art > img\{[\s\S]*?width:100%;height:100%;object-fit:contain;/);
});

test("an Abyss victory returns directly to the entered map and chest phase",()=>{
    const harness=launchHarness();
    assert.equal(harness.context.runLaunch(),true);
    harness.settle({result:"win"});
    assert.equal(harness.context.readMapEntered(),true);
    assert.equal(harness.context.abyssState.phase,"chest");
    assert.deepEqual(harness.pages,["dungeon"]);
    assert.deepEqual(harness.tabs,["abyss"]);
});

test("an Abyss defeat also returns directly to the entered map",()=>{
    const harness=launchHarness();
    assert.equal(harness.context.runLaunch(),true);
    harness.settle({result:"loss"});
    assert.equal(harness.context.readMapEntered(),true);
    assert.equal(harness.context.abyssState.phase,"boss");
    assert.match(harness.context.abyssState.message,/挑戰失敗/);
    assert.deepEqual(harness.pages,["dungeon"]);
    assert.deepEqual(harness.tabs,["abyss"]);
});

test("late runtime files no longer overwrite the four-element skill table",()=>{
    const downstream=["js/44-v152-dev-fixes.js","js/46-v155-dev-fixes.js","js/47-v158-combat-tuning.js"]
        .map(file=>fs.readFileSync(file,"utf8")).join("\n");
    assert.doesNotMatch(
        downstream,
        /patchSkill(?:Tuning)?\("(?:dragonSlash|phoenixCry|rage|waterKnife|frostPunch|iceSpin|frostCrush|waterBall|floodBeast|iceArrowRain|freeze|healSpell|revive|windFist|earthSlash)/
    );
    const fireWindEarth=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
    const water=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
    assert.doesNotMatch(fireWindEarth,/\bid:\s*"waterKnife"/);
    ["waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain","freeze","healSpell","revive","waterEX"]
        .forEach(id=>assert.match(water,new RegExp("\\b"+id+":\\{"),id));
});

test("the development cache release is V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.40"/);
    assert.match(index,/<title>四象江湖傳 V173\.40<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.40"[\s\S]*?>V173\.40<\/div>/);
});

console.log("\n"+passed+" V173.39 final-request tests passed.");
