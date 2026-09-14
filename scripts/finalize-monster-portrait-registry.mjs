#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const args=process.argv.slice(2);
const dryRun=args.includes("--dry-run");
const batchArg=args.find(arg=>arg.startsWith("--batch="));

function fail(message){
    console.error("ERROR: "+message);
    process.exit(1);
}

function normalizeBatchPath(value){
    const rel=String(value||"").replace(/\\/g,"/").replace(/^\.\//,"");
    if(!rel || path.isAbsolute(rel) || rel.split("/").includes("..")){
        fail("--batch must be a repository-relative manifest path");
    }
    if(!rel.startsWith("release/monster-portrait-batches/") || !rel.endsWith(".json")){
        fail("--batch must point to release/monster-portrait-batches/*.json");
    }
    if(!fs.existsSync(path.join(root,rel))){
        fail("batch manifest not found: "+rel);
    }
    return rel;
}

if(!batchArg){
    fail("refusing unscoped finalize; pass --batch=release/monster-portrait-batches/<file>.json");
}

const batchPath=normalizeBatchPath(batchArg.slice("--batch=".length));
const registryPath=path.join(root,"config/monster-portrait-registry.json");
const manifestPath=path.join(root,batchPath);
const registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
const fields=registry.tupleSchema||[];
const statusIndex=fields.indexOf("status");
const pathIndex=fields.indexOf("path");
const keyIndex=fields.indexOf("portraitKey");

if(statusIndex<0||pathIndex<0||keyIndex<0){
    fail("monster portrait registry tuple schema is missing required fields");
}

const rows=Object.values(registry.groups||{}).flatMap(group=>Array.isArray(group)?group:[]);
const byKey=new Map(rows.map(row=>[String(row[keyIndex]),row]));
const rawBatchKeys=[
    ...(Array.isArray(manifest.committed)?manifest.committed:[]),
    ...(Array.isArray(manifest.pending)?manifest.pending:[])
].map(String);
const batchKeys=[...new Set(rawBatchKeys)];
if(!batchKeys.length){ fail("batch manifest has no registry targets"); }
if(batchKeys.length!==rawBatchKeys.length){ fail("batch manifest contains duplicate portraitKey entries"); }

const unknown=batchKeys.filter(key=>!byKey.has(key));
if(unknown.length){ fail("batch manifest contains unregistered portraitKey: "+unknown.join(", ")); }

const promoted=[];
const committed=[];
const pending=[];
for(const key of batchKeys){
    const row=byKey.get(key);
    const rel=String(row[pathIndex]||"");
    const absolute=path.join(root,rel);
    const fileExists=Boolean(rel)&&fs.existsSync(absolute)&&fs.statSync(absolute).isFile();

    if(row[statusIndex]==="planned" && fileExists){
        if(!rel.startsWith("assets/monsters/") || path.extname(rel).toLowerCase()!==".png"){
            fail("refusing to promote planned target outside new PNG asset policy: "+key+" -> "+rel);
        }
        if(!dryRun){ row[statusIndex]="existing"; }
        promoted.push({portraitKey:key,path:rel});
    }

    const effectivelyExisting=row[statusIndex]==="existing" || (dryRun && promoted.some(item=>item.portraitKey===key));
    if(effectivelyExisting && fileExists){ committed.push(key); }
    else{ pending.push(key); }
}

const existingTargets=rows.filter(row=>row[statusIndex]==="existing").length+(dryRun?promoted.length:0);
const plannedTargets=rows.length-existingTargets;
const nextManifest={
    ...manifest,
    status:pending.length?"IN_PROGRESS":"COMPLETE",
    committed,
    pending
};

if(!dryRun){
    registry.snapshot={
        portraitTargets:rows.length,
        existingTargets,
        plannedTargets,
        uniqueRuntimeNames:Number(registry.snapshot&&registry.snapshot.uniqueRuntimeNames)||104
    };
    fs.writeFileSync(registryPath,JSON.stringify(registry)+"\n");
    fs.writeFileSync(manifestPath,JSON.stringify(nextManifest,null,2)+"\n");
}

console.log(JSON.stringify({
    batchPath,
    dryRun,
    promoted,
    committed,
    pending,
    status:nextManifest.status,
    existingTargets,
    plannedTargets
},null,2));
