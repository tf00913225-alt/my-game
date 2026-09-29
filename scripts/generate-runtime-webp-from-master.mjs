#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd();
const masterArg=process.argv.find(arg=>arg.startsWith("--master-root="));
const dryRun=process.argv.includes("--dry-run");
if(!masterArg){ throw new Error("Usage: node scripts/generate-runtime-webp-from-master.mjs --master-root=/absolute/path/to/assets-library [--dry-run]"); }
const masterRoot=path.resolve(masterArg.slice("--master-root=".length));
const manifestPath=path.join(root,"config/monster-asset-provenance.json");
const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const failures=[];

for(const entry of manifest.assets.filter(asset=>asset.runtimeReady)){
    const source=path.join(masterRoot,entry.master.path);
    const target=path.join(root,entry.runtime.path);
    if(!fs.existsSync(source)){ failures.push(`${entry.monsterId}: Master missing ${source}`); continue; }
    if(sha(source)!==entry.master.sha256){ failures.push(`${entry.monsterId}: Master SHA-256 mismatch ${entry.master.path}`); continue; }
    if(dryRun) continue;
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const result=spawnSync("convert",[source,"-resize","1024x1536","-gravity","center","-background","none","-extent","1024x1536","-define","webp:lossless=true",target],{encoding:"utf8"});
    if(result.status!==0){ failures.push(`${entry.monsterId}: conversion failed ${(result.stderr||result.error?.message||"").trim()}`); continue; }
    entry.runtime.sha256=sha(target);
}

if(failures.length){ throw new Error("Runtime generation blocked:\n"+failures.join("\n")); }
if(!dryRun) fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log(`${dryRun?"Validated":"Generated"} ${manifest.assets.filter(asset=>asset.runtimeReady).length} runtime WebP files from verified Master PNG sources.`);
