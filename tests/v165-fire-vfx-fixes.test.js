"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const zlib=require("node:zlib");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function decodeRgbaPng(path){
    const file=fs.readFileSync(path);
    assert.equal(file.subarray(0,8).toString("hex"),"89504e470d0a1a0a",path);
    const idat=[];
    let width=0,height=0,bitDepth=0,colorType=0,interlace=0;
    for(let offset=8;offset<file.length;){
        const length=file.readUInt32BE(offset);
        const type=file.toString("ascii",offset+4,offset+8);
        const data=file.subarray(offset+8,offset+8+length);
        if(type==="IHDR"){
            width=data.readUInt32BE(0);
            height=data.readUInt32BE(4);
            bitDepth=data[8];
            colorType=data[9];
            interlace=data[12];
        }else if(type==="IDAT"){
            idat.push(data);
        }
        offset+=length+12;
        if(type==="IEND"){ break; }
    }
    assert.deepEqual([width,height,bitDepth,colorType,interlace],[1536,1152,8,6,0],path);
    const raw=zlib.inflateSync(Buffer.concat(idat));
    const bytesPerPixel=4;
    const stride=width*bytesPerPixel;
    assert.equal(raw.length,height*(stride+1),path+" decompressed length");
    const pixels=Buffer.alloc(height*stride);
    let sourceOffset=0;
    function paeth(a,b,c){
        const estimate=a+b-c;
        const da=Math.abs(estimate-a),db=Math.abs(estimate-b),dc=Math.abs(estimate-c);
        return da<=db&&da<=dc?a:(db<=dc?b:c);
    }
    for(let y=0;y<height;y++){
        const filter=raw[sourceOffset++];
        assert.ok(filter>=0&&filter<=4,path+" PNG filter");
        for(let x=0;x<stride;x++){
            const value=raw[sourceOffset++];
            const left=x>=bytesPerPixel?pixels[y*stride+x-bytesPerPixel]:0;
            const up=y?pixels[(y-1)*stride+x]:0;
            const upperLeft=y&&x>=bytesPerPixel?pixels[(y-1)*stride+x-bytesPerPixel]:0;
            let predictor=0;
            if(filter===1){ predictor=left; }
            else if(filter===2){ predictor=up; }
            else if(filter===3){ predictor=Math.floor((left+up)/2); }
            else if(filter===4){ predictor=paeth(left,up,upperLeft); }
            pixels[y*stride+x]=(value+predictor)&255;
        }
    }
    return {file,width,height,pixels};
}

function cellHash(image,column,row){
    const hash=crypto.createHash("sha256");
    for(let y=0;y<384;y++){
        const start=((row*384+y)*image.width+column*384)*4;
        hash.update(image.pixels.subarray(start,start+384*4));
    }
    return hash.digest("hex");
}

function verifySheet(path,expectedHash,expectedNonzero,expectedAlphaSum){
    const image=decodeRgbaPng(path);
    assert.equal(crypto.createHash("sha256").update(image.file).digest("hex"),expectedHash,path);
    const frameHashes=[];
    for(let row=0;row<3;row++){
        for(let column=0;column<4;column++){
            frameHashes.push(cellHash(image,column,row));
        }
    }
    assert.equal(new Set(frameHashes).size,12,path+" must contain twelve distinct frames");

    const sourceHeights=[341,342,341];
    let nonzero=0,alphaSum=0,maxAlpha=0;
    for(let y=0;y<image.height;y++){
        const localY=y%384;
        const row=Math.floor(y/384);
        const isPadding=localY<21||localY>=21+sourceHeights[row];
        for(let x=0;x<image.width;x++){
            const offset=(y*image.width+x)*4;
            const alpha=image.pixels[offset+3];
            if(isPadding){
                assert.equal(
                    image.pixels.readUInt32BE(offset),0,
                    path+" padding must remain transparent"
                );
            }
            if(alpha){ nonzero++; }
            alphaSum+=alpha;
            maxAlpha=Math.max(maxAlpha,alpha);
        }
    }
    assert.deepEqual([nonzero,alphaSum,maxAlpha],[expectedNonzero,expectedAlphaSum,253],path);
}

test("Rage and Dragon Slash preserve all twelve normalized source frames",()=>{
    verifySheet(
        "assets/vfx/fire/rage-cast.png",
        "7be0f810daf8037135140711c4d09d40ecc19b062d97888d53f51be72b430133",
        935210,125072850
    );
    verifySheet(
        "assets/vfx/fire/dragon-slash-cast.png",
        "3317d75fb86c9c5f4feccb440240fcc88309f0fe195e387f46aadc227d66b723",
        1324757,207033241
    );
});

test("Fire Rocket travels from its caster to the real target group before bursting",()=>{
    assert.match(animation,/fireRocket:\{[\s\S]*?hit:\.5833333333[\s\S]*?hitFrame:7,placement:"trajectory",travelToTargets:true/);
    assert.match(animation,/node\.style\.left=actor\.x\+"px";[\s\S]*?--v143-sprite-dx",destination\.x-actor\.x\+"px"/);
    assert.match(animation,/--v143-sprite-dy",destination\.y-actor\.y\+"px"/);
    assert.match(css,/v165FireRocketTravel var\(--v143-sprite-duration,900ms\) linear 1 both/);
    assert.match(css,/@keyframes v165FireRocketTravel\{[\s\S]*?3%,24\.999%[\s\S]*?25%[\s\S]*?49\.999%[\s\S]*?50%,95%/);
    assert.match(timing,/fireRocket:\[900/);
});

test("the current cache version publishes the repaired sheets and choreography",()=>{
    assert.match(animation,/dragon-slash-cast\.png\?v=165/);
    assert.match(animation,/rage-cast\.png\?v=165/);
    assert.match(loader,/const V_ASSET_VERSION="173\.11"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.11/);
});

console.log("\nV165 Fire VFX fixes suite: "+passed+" tests passed.");
