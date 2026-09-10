"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const zlib=require("node:zlib");

const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
const loader=fs.readFileSync("scripts/build-production.mjs","utf8");
const runtime=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const dungeonShell=fs.readFileSync("js/41-v146-system-polish.js","utf8");

function pngRgba(path){
    const file=fs.readFileSync(path);
    assert.deepEqual(Array.from(file.subarray(0,8)),[137,80,78,71,13,10,26,10]);
    let offset=8,width=0,height=0,depth=0,colorType=0;
    const compressed=[];
    while(offset<file.length){
        const length=file.readUInt32BE(offset);const type=file.toString("ascii",offset+4,offset+8);
        const data=file.subarray(offset+8,offset+8+length);offset+=12+length;
        if(type==="IHDR"){ width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];colorType=data[9]; }
        if(type==="IDAT"){ compressed.push(data); }
        if(type==="IEND"){ break; }
    }
    assert.equal(depth,8);assert.equal(colorType,6,"nav icon must be a real RGBA PNG");
    const raw=zlib.inflateSync(Buffer.concat(compressed));
    const stride=width*4,rgba=Buffer.alloc(stride*height);
    function paeth(a,b,c){ const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:(pb<=pc?b:c); }
    let cursor=0;
    for(let y=0;y<height;y++){
        const filter=raw[cursor++],rowOffset=y*stride;
        for(let x=0;x<stride;x++){
            const value=raw[cursor++],left=x>=4?rgba[rowOffset+x-4]:0,up=y?rgba[rowOffset-stride+x]:0,upperLeft=y&&x>=4?rgba[rowOffset-stride+x-4]:0;
            const decoded=filter===0?value:filter===1?(value+left)&255:filter===2?(value+up)&255:filter===3?(value+Math.floor((left+up)/2))&255:filter===4?(value+paeth(left,up,upperLeft))&255:(()=>{throw new Error("unsupported PNG filter "+filter);})();
            rgba[rowOffset+x]=decoded;
        }
    }
    return {width,height,rgba,alphaAt:(x,y)=>rgba[(y*width+x)*4+3]};
}

const bottom=html.slice(html.indexOf('<div id="bottomNav"'),html.indexOf("</div>",html.indexOf('<div id="bottomNav"'))+6);
assert.equal((bottom.match(/class="nav-button /g)||[]).length,5,"bottom navigation must remain five buttons");
assert.match(bottom,/id="bossNav"[\s\S]*onclick="showPage\('gameplay'\)"[\s\S]*aria-label="玩法"[\s\S]*title="玩法"/);
assert.match(bottom,/src="assets\/ui\/nav-gameplay\.png"/);
assert.match(bottom,/<span class="nav-sr-only">玩法<\/span>/);
assert.doesNotMatch(bottom,/nav-boss\.png|aria-label="BOSS"/);

assert.match(html,/id="gameplayPage"/);assert.match(html,/id="gameplayHubContent"/);
assert.match(html,/id="bossPage"/);assert.match(html,/id="towerPage"/);
assert.match(runtime,/vGameplayOpenBoss/);assert.match(runtime,/vGameplayOpenTower/);assert.match(runtime,/vGameplayOpenAbyss/);
assert.equal((html.match(/id="dungeonTabBtnAbyss"/g)||[]).length,0,"daily dungeon page must not expose a duplicate Abyss entry");
assert.match(dungeonShell,/abyssSelectionActive\?"v174AbyssLeaveToGameplay\(\)":"showPage\('home'\)"/);
assert.match(dungeonShell,/page\.classList\.toggle\("v146-abyss-active",abyssActive\)/,"Abyss selection must hide the old dungeon shell as well as the map");
assert.doesNotMatch(css,/!important/,"new gameplay stylesheet must not use priority patches");

const gameplayIndex=loader.indexOf("js/gameplay-boss-tower-system.js");
const relicIndex=loader.indexOf("js/60-team-relic-system.js");
assert.ok(gameplayIndex>=0&&relicIndex>=0&&gameplayIndex<relicIndex,"Gameplay mechanism integration must load before the final Team Relic wrapper");

const image=pngRgba("assets/ui/nav-gameplay.png");
assert.deepEqual([image.width,image.height],[320,320]);
assert.deepEqual([
    image.alphaAt(0,0),image.alphaAt(image.width-1,0),
    image.alphaAt(0,image.height-1),image.alphaAt(image.width-1,image.height-1)
],[0,0,0,0],"all four corners must be fully transparent");
let transparent=0,opaque=0;
for(let index=3;index<image.rgba.length;index+=4){
    if(image.rgba[index]===0){ transparent++; }
    if(image.rgba[index]===255){ opaque++; }
}
assert.ok(transparent>image.width*image.height*.05,"icon needs meaningful alpha-zero background area");
assert.ok(opaque>image.width*image.height*.25,"icon body must remain visibly opaque");

console.log("✓ Gameplay hub navigation, loader ownership and true-alpha icon checks passed.");
