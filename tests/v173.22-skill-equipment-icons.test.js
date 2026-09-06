"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const main=read("js/00-main.js");
const content=read("js/27-v132-content-expansion.js");
const polish=read("js/41-v146-system-polish.js");
const loader=read("js/20-anonymous-20.js");
const index=read("index.html");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function jpegDimensions(relative){
    const data=fs.readFileSync(path.join(root,relative));
    assert.deepEqual([data[0],data[1]],[0xff,0xd8],relative+" must be JPEG");
    let offset=2;
    while(offset+8<data.length){
        while(data[offset]===0xff){ offset++; }
        const marker=data[offset++];
        if(marker===0xd8||marker===0xd9){ continue; }
        const length=data.readUInt16BE(offset);
        if(marker>=0xc0&&marker<=0xc3){
            return {width:data.readUInt16BE(offset+5),height:data.readUInt16BE(offset+3)};
        }
        offset+=length;
    }
    throw new Error("missing JPEG dimensions for "+relative);
}

function webpDimensions(relative){
    const data=fs.readFileSync(path.join(root,relative));
    assert.equal(data.toString("ascii",0,4),"RIFF",relative+" must be RIFF");
    assert.equal(data.toString("ascii",8,12),"WEBP",relative+" must be WebP");
    const type=data.toString("ascii",12,16);
    if(type==="VP8L"){
        assert.equal(data[20],0x2f,relative+" has a valid lossless header");
        return {
            width:1+data[21]+((data[22]&0x3f)<<8),
            height:1+(data[22]>>6)+(data[23]<<2)+((data[24]&0x0f)<<10)
        };
    }
    if(type==="VP8X"){
        return {
            width:1+data.readUIntLE(24,3),
            height:1+data.readUIntLE(27,3)
        };
    }
    throw new Error("unsupported WebP chunk "+type+" for "+relative);
}

const sets={
    setFire:"fire",
    setWater:"water",
    setEarth:"earth",
    setWind:"wind"
};
const pieces={
    blade:"blade",
    heavyArmor:"heavy-armor",
    boots:"boots",
    helm:"helm",
    wristguard:"wristguard"
};
const magicPieces={
    fan:"fan",
    robe:"robe",
    shoes:"shoes",
    crown:"crown",
    focus:"focus"
};

test("狂風術使用這次補上的風系技能圖示",()=>{
    const relative="assets/skills/wind-gale-spell.jpg";
    assert.match(main,/windSpell:"assets\/skills\/wind-gale-spell\.jpg"/);
    assert.deepEqual(jpegDimensions(relative),{width:120,height:120});
});

test("四元素攻擊套裝依元素與五個部位映射到二十張新圖",()=>{
    Object.entries(sets).forEach(([setId,element])=>{
        Object.entries(pieces).forEach(([pieceKey,filePart])=>{
            const relative="assets/equipment/sets/"+element+"-"+filePart+"-attack-v173.22.webp";
            assert.ok(content.includes(setId+":{"),setId+" mapping exists");
            assert.ok(content.includes(pieceKey+':"'+relative+'"'),setId+" "+pieceKey+" mapping");
            assert.deepEqual(webpDimensions(relative),{width:512,height:512});
            assert.ok(fs.statSync(path.join(root,relative)).size>100000,relative+" is not empty");
        });
    });
    assert.match(content,/return rasterItemIcon\(attackArt\[pieceKey\],null,"equipment"\);/);
});

test("四元素法師套裝依元素與五個部位映射到二十張新圖",()=>{
    Object.entries(sets).forEach(([setId,element])=>{
        Object.entries(magicPieces).forEach(([pieceKey,filePart])=>{
            const relative="assets/equipment/sets/"+element+"-"+filePart+"-magic-v173.24.webp";
            assert.ok(content.includes(setId+":{"),setId+" mapping exists");
            assert.ok(content.includes(pieceKey+':"'+relative+'"'),setId+" "+pieceKey+" mapping");
            assert.deepEqual(webpDimensions(relative),{width:512,height:512});
            assert.ok(fs.statSync(path.join(root,relative)).size>100000,relative+" is not empty");
        });
    });
    assert.match(content,/return rasterItemIcon\(magicArt\[pieceKey\],null,"equipment"\);/);
    assert.match(content,/return svgWrap\(shapes\[pieceKey\]\|\|shapes\.blade,c\.glow\);/);
});

test("既有存檔與已穿戴套裝會同步取得新版圖示",()=>{
    const definition={
        id:"setFire_blade",setId:"setFire",icon:"NEW_ATTACK_ICON",stats:{}
    };
    const inventoryItems=[{
        id:"setFire_blade",setId:"setFire",icon:"OLD_INVENTORY_ICON",stats:{}
    }];
    const equipped={
        id:"setFire_blade",setId:"setFire",icon:"OLD_EQUIPPED_ICON",stats:{}
    };
    const context={
        console,Map,Object,Array,Set,Math,Date,Number,
        inventoryItems,
        characterEquipment:{hero:{weapon:equipped}},
        document:{readyState:"loading",addEventListener(){}},
        v132GetContentDefinitions:()=>({equipmentSetItems:[definition]})
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(polish,context,{filename:"js/41-v146-system-polish.js"});
    assert.equal(inventoryItems[0].icon,"NEW_ATTACK_ICON");
    assert.equal(equipped.icon,"NEW_ATTACK_ICON");
    assert.equal(inventoryItems[0].setVariant,"attack");
    assert.equal(equipped.requiredElement,"fire");
});

test("開發版本與快取版本更新為 V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.56"/);
    assert.match(index,/<title>四象江湖傳 V173\.56<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.56"[\s\S]*?>V173\.56<\/div>/);
    assert.match(index,/js\/00-main\.js\?v=173\.56/);
});

console.log("\n"+passed+" V173.39 skill and equipment icon tests passed.");
