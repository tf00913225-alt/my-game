"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const files=[
    "assets/items/potions/hp-potion-10-huichun.webp",
    "assets/items/potions/hp-potion-20-yangming.webp",
    "assets/items/potions/hp-potion-30-dahuan.webp",
    "assets/items/potions/sp-potion-10-ningqi.webp",
    "assets/items/potions/sp-potion-20-juqi.webp",
    "assets/items/potions/sp-potion-30-guiyuan.webp"
];

function losslessWebpInfo(relative){
    const data=fs.readFileSync(path.join(root,relative));
    assert.equal(data.toString("ascii",0,4),"RIFF",relative+" must be RIFF");
    assert.equal(data.toString("ascii",8,12),"WEBP",relative+" must be WebP");
    assert.equal(data.toString("ascii",12,16),"VP8L",relative+" must use lossless VP8L");
    assert.equal(data[20],0x2f,relative+" must have a valid VP8L signature");
    const packed=data.readUInt32LE(21);
    return {
        width:1+(packed&0x3fff),
        height:1+((packed>>>14)&0x3fff),
        alpha:(packed>>>28)&1
    };
}

for(const relative of files){
    assert.ok(fs.existsSync(path.join(root,relative)),relative+" must exist");
    const info=losslessWebpInfo(relative);
    assert.deepEqual([info.width,info.height],[1254,1254],relative+" must preserve 1254×1254 canvas");
    assert.equal(info.alpha,1,relative+" must preserve transparency");
}

const source=fs.readFileSync(path.join(root,"js/40-v144-rules-and-abyss.js"),"utf8");
const css=fs.readFileSync(path.join(root,"css/49-v169-rpg-ui.css"),"utf8");

const expected=[
    ["hpPotion10","回春散",files[0]],
    ["hpPotion20","養命丹",files[1]],
    ["hpPotion30","大還丹",files[2]],
    ["spPotion10","凝氣散",files[3]],
    ["spPotion20","聚氣丹",files[4]],
    ["spPotion30","歸元丹",files[5]]
];
for(const [id,name,relative] of expected){
    assert.ok(source.includes(id),id+" must stay on the existing save-compatible ID");
    assert.ok(source.includes('name:"'+name+'"'),name+" must be the formal visible name");
    assert.ok(source.includes('iconPath:"'+relative+'"'),relative+" must be the formal runtime asset");
}
assert.match(source,/shop-potion-summary/);
assert.match(source,/shop-potion-icon/);
assert.match(source,/v169-item-art v169-potion-art/);
assert.doesNotMatch(source,/assets\/inbox\/道具icon/);
assert.match(css,/\.shop-potion-summary\{/);
assert.match(css,/\.shop-potion-icon\{/);
assert.match(css,/\.shop-potion-icon > \.v169-item-art > img\{[\s\S]*?object-fit:contain/);

console.log("✓ six formal potion names and lossless WebP assets are wired to shop/inventory presentation");
