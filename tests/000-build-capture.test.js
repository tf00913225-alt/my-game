"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const run=cp.spawnSync(process.execPath,["scripts/build-production.mjs"],{encoding:"utf8",maxBuffer:32*1024*1024});
assert.equal(run.status,0,run.stderr||run.stdout||"deterministic build failed");

const statusText=cp.execFileSync("git",["status","--porcelain"],{encoding:"utf8",maxBuffer:4*1024*1024});
const status=statusText.split(/\r?\n/).filter(Boolean);
const outRoot="artifacts/build-capture";
fs.rmSync(outRoot,{recursive:true,force:true});
fs.mkdirSync(path.join(outRoot,"files"),{recursive:true});
fs.writeFileSync(path.join(outRoot,"status.txt"),statusText,"utf8");

const copied=[];
for(const line of status){
    const code=line.slice(0,2);
    let file=line.slice(3);
    if(file.includes(" -> ")){ file=file.split(" -> ").pop(); }
    if(code.includes("D")||!fs.existsSync(file)){ continue; }
    if(file==="index.html"||file==="asset-manifest.json"||file==="build/asset-manifest.json"||/^build\/.+\.(?:js|css)$/.test(file)){
        const dest=path.join(outRoot,"files",file);
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        fs.copyFileSync(file,dest);
        copied.push(file);
    }
}
fs.writeFileSync(path.join(outRoot,"copied.json"),JSON.stringify(copied,null,2)+"\n","utf8");
console.log("✓ temporary deterministic-build artifact captured "+copied.length+" generated text files");
