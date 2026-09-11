"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");
const zlib=require("node:zlib");

const run=cp.spawnSync(process.execPath,["scripts/build-production.mjs"],{encoding:"utf8",maxBuffer:32*1024*1024});
assert.equal(run.status,0,run.stderr||run.stdout||"deterministic build failed");

const status=cp.execFileSync("git",["status","--porcelain"],{encoding:"utf8",maxBuffer:4*1024*1024})
    .split(/\r?\n/).filter(Boolean);
const paths=[];
for(const line of status){
    const code=line.slice(0,2);
    let file=line.slice(3);
    if(file.includes(" -> ")){ file=file.split(" -> ").pop(); }
    if(code.includes("D")){ continue; }
    if(file==="index.html"||file==="asset-manifest.json"||file==="build/asset-manifest.json"||/^build\/.+\.(?:js|css)$/.test(file)){
        paths.push(file);
    }
}
const payload={status,files:{}};
for(const file of paths){
    if(fs.existsSync(file)){ payload.files[file]=fs.readFileSync(file,"utf8"); }
}
const encoded=zlib.gzipSync(Buffer.from(JSON.stringify(payload),"utf8"),{level:9}).toString("base64");
throw new Error("BUILD_CAPTURE_BEGIN"+encoded+"BUILD_CAPTURE_END");
