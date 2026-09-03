"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const itemSource=read("js/27-v132-content-expansion.js");
const touchSource=read("js/01-stage-v8-touch-lock.js");
const rewardCss=read("css/33-v132-content-expansion.css");
const itemCss=read("css/38-v141-system-expansion.css");
const assetCss=read("css/50-v169-abyss-flow.css");
const html=read("index.html");

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const brace=source.indexOf("{",start);
    let depth=0;
    let quote="";
    let escaped=false;
    for(let index=brace;index<source.length;index++){
        const char=source[index];
        if(quote){
            if(escaped){ escaped=false; }
            else if(char==="\\"){ escaped=true; }
            else if(char===quote){ quote=""; }
            continue;
        }
        if(char==='"' || char==="'" || char==="`"){ quote=char; continue; }
        if(char==="{"){ depth++; }
        if(char==="}" && --depth===0){ return source.slice(start,index+1); }
    }
    throw new Error("unterminated function "+name);
}

function pngDimensions(relative){
    const file=fs.readFileSync(path.join(root,relative));
    assert.equal(file.subarray(1,4).toString("ascii"),"PNG",relative+" must be PNG");
    return {width:file.readUInt32BE(16),height:file.readUInt32BE(20),size:file.length};
}

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("mobile ticket and talisman assets are optimized without replacing originals",()=>{
    ["fire","water","earth","wind"].forEach(name=>{
        const image=pngDimensions("assets/items/tickets/"+name+"-icon.png");
        assert.deepEqual([image.width,image.height],[384,256]);
        assert.ok(image.size<300000,name+" ticket icon should stay below 300 KB");
        assert.ok(fs.existsSync(path.join(root,"assets/items/tickets/"+name+".png")));
    });
    ["freeze","barrier","stealth"].forEach(name=>{
        const image=pngDimensions("assets/items/talismans/"+name+"-icon.png");
        assert.deepEqual([image.width,image.height],[384,576]);
        assert.ok(image.size<600000,name+" talisman icon should stay below 600 KB");
        assert.ok(fs.existsSync(path.join(root,"assets/items/talismans/"+name+".png")));
    });
});

test("legacy static inventory stacks recover their canonical presentation",()=>{
    const context=vm.createContext({Map,Object});
    vm.runInContext(`
        const inventoryItems=[
            {id:"freezeTalismanLow",name:"old",icon:"",type:"",count:100},
            {id:"oreLow",name:"old",icon:"",type:"",count:74},
            {id:"blueprintFireHeadLow",name:"old",icon:"",type:"",count:100},
            {id:"ticketSetFire",name:"old",icon:"",type:"",count:3},
            {id:"materialChest",name:"old",icon:"",type:"",count:1}
        ];
        const talismanDefinitions=[{id:"freezeTalismanLow",name:"低階冰封符",icon:"TALISMAN",type:"talisman",price:0,tierKey:"low",talismanEffect:"freeze",talismanDuration:4,tierChance:35,stats:{}}];
        const oreDefinitions=[{id:"oreLow",name:"低階礦石",icon:"ORE",type:"material",price:0,tierKey:"low",stats:{}}];
        const blueprintDefinitions=[{id:"blueprintFireHeadLow",name:"赤炎低階頭部設計圖",icon:"BLUEPRINT",type:"material",price:0,tierKey:"low",blueprintSlot:"head",setId:"setFire",stats:{}}];
        const ticketDefinitions=[{id:"ticketSetFire",name:"赤炎裝備抽獎券",icon:"TICKET",type:"ticket",price:0,setId:"setFire",stats:{}}];
        const materialChestDefinition={id:"materialChest",name:"材料寶箱",icon:"CHEST",type:"chest",price:0,stats:{}};
        function getTicketDefinition(id){ return ticketDefinitions.find(item=>item.id===id)||null; }
        ${extractFunction(itemSource,"syncTicketPresentation")}
        ${extractFunction(itemSource,"hydrateOwnedTicketPresentation")}
        ${extractFunction(itemSource,"syncStaticContentPresentation")}
        ${extractFunction(itemSource,"hydrateOwnedStaticContentPresentation")}
        ${extractFunction(itemSource,"hydrateOwnedContentPresentation")}
        hydrateOwnedContentPresentation();
        globalThis.result=inventoryItems;
    `,context);
    assert.deepEqual(
        Array.from(context.result,item=>item.icon),
        ["TALISMAN","ORE","BLUEPRINT","TICKET","CHEST"]
    );
    assert.deepEqual(Array.from(context.result,item=>item.count),[100,74,100,3,1]);
    assert.deepEqual(
        Array.from(context.result,item=>item.type),
        ["talisman","material","material","ticket","chest"]
    );
});

test("ticket choices keep image and label in separate layout boxes",()=>{
    assert.match(rewardCss,/\.v132-ticket-icon\{[\s\S]*?width:96px;[\s\S]*?height:64px;/);
    assert.match(rewardCss,/\.v132-ticket-name\{[\s\S]*?line-height:1\.4;/);
    assert.match(assetCss,/\.v132-ticket-icon \.v169-item-art\{width:100%;height:100%;\}/);
    assert.doesNotMatch(assetCss,/\.v132-ticket-icon \.v169-item-art\{width:58px;height:58px;\}/);
});

test("item preview stays inside the stage with a reachable return button",()=>{
    assert.match(itemCss,/max-height:calc\(100% - 24px\) !important/);
    assert.match(itemCss,/#itemModal \.item-modal-icon > \.v169-talisman-art\{[\s\S]*?width:150px;[\s\S]*?height:225px;/);
    assert.match(itemCss,/#itemModal \.item-modal-icon > \.v169-equipment-art\{[\s\S]*?max-height:190px;/);
    assert.match(itemCss,/#itemModal \.item-stat-list\{[\s\S]*?max-height:none !important;[\s\S]*?overflow:visible !important/);
    assert.match(touchSource,/#itemModalStats/);
    const modal=html.slice(html.indexOf('id="itemModal"'),html.indexOf('id="skillDetailModal"'));
    assert.match(modal,/class="close-item-button"[\s\S]*?>\s*返回\s*<\/button>/);
});

test("equipment reward has a visible return action and resilient image fallback",()=>{
    assert.match(itemSource,/class="v132-reward-back" onclick="v132LeaveEquipmentReward\(\)"/);
    assert.match(itemSource,/window\.v132LeaveEquipmentReward=function\(\)/);
    assert.match(itemSource,/assets\/items\/tickets\/"\+elementKey\+"-icon\.png/);
    assert.match(itemSource,/onerror="this\.hidden=true"/);
    assert.match(assetCss,/\.v169-item-art > img\[hidden\]\{display:none !important;\}/);
});

test("published development label advances to V173.39",()=>{
    assert.match(html,/<title>四象江湖傳 V173\.41<\/title>/);
    assert.match(html,/>V173\.41<\/div>/);
    assert.match(read("js/20-anonymous-20.js"),/const V_ASSET_VERSION="173\.41"/);
});

console.log("\n"+passed+" V173.39 item UI and asset tests passed.");
