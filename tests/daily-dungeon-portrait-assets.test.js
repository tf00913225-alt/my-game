const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/monster-portrait-registry.json"),"utf8"));
const fields=registry.tupleSchema;
const index=new Map(fields.map((field,i)=>[field,i]));
const dailyRows=Object.values(registry.groups).flatMap(rows=>rows||[])
    .map(row=>Object.fromEntries(fields.map((field,i)=>[field,row[i]])))
    .filter(row=>String(row.portraitKey||"").startsWith("daily."));

assert.equal(dailyRows.length,9,"daily dungeon registry must contain all 9 portrait keys");

function webpDimensions(buffer){
    assert.equal(buffer.subarray(0,4).toString("ascii"),"RIFF","portrait must have a RIFF header");
    assert.equal(buffer.subarray(8,12).toString("ascii"),"WEBP","portrait must have a WEBP signature");
    assert.equal(buffer.readUInt32LE(4)+8,buffer.length,"portrait must not be truncated");
    let offset=12;
    while(offset+8<=buffer.length){
        const type=buffer.subarray(offset,offset+4).toString("ascii");
        const size=buffer.readUInt32LE(offset+4);
        const data=offset+8;
        assert.ok(data+size<=buffer.length,"WEBP chunk exceeds file length");
        if(type==="VP8X"){
            return [1+buffer.readUIntLE(data+4,3),1+buffer.readUIntLE(data+7,3)];
        }
        if(type==="VP8 "){
            const marker=buffer.indexOf(Buffer.from([0x9d,0x01,0x2a]),data);
            if(marker>=data&&marker+7<Math.min(data+size,buffer.length)){
                return [buffer.readUInt16LE(marker+3)&0x3fff,buffer.readUInt16LE(marker+5)&0x3fff];
            }
        }
        if(type==="VP8L"&&data+5<=buffer.length){
            const bits=buffer.readUInt32LE(data+1);
            return [1+(bits&0x3fff),1+((bits>>14)&0x3fff)];
        }
        offset=data+size+(size%2);
    }
    throw new Error("WEBP dimensions could not be decoded");
}

for(const row of dailyRows){
    assert.equal(row.status,"existing",row.portraitKey+" must be runtime-ready");
    const file=path.join(root,row.path);
    assert.ok(fs.existsSync(file),row.portraitKey+" runtime asset missing");
    const dimensions=webpDimensions(fs.readFileSync(file));
    assert.deepEqual(dimensions,[1024,1536],row.portraitKey+" must use the standard portrait canvas");
}

assert.deepEqual(
    dailyRows.map(row=>row.portraitKey).sort(),
    [
        "daily.exp.regular","daily.exp.elite","daily.exp.boss",
        "daily.material.regular","daily.material.elite","daily.material.boss",
        "daily.gold.regular","daily.gold.elite","daily.gold.boss"
    ].sort(),
    "daily registry keys must remain canonical"
);

console.log("daily dungeon portrait assets: PASS (9 valid, non-truncated 1024x1536 WebP files)");
