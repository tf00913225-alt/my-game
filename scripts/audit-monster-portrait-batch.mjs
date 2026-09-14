#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd();
const args=process.argv.slice(2);
const strict=args.includes("--strict");
const jsonMode=args.includes("--json");
const batchArg=args.find(arg=>arg.startsWith("--batch="));

function fail(message){
    console.error("ERROR: "+message);
    process.exit(1);
}

function readJson(rel){
    return JSON.parse(fs.readFileSync(path.join(root,rel),"utf8"));
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
    fail("missing required --batch=release/monster-portrait-batches/<file>.json");
}

const batchPath=normalizeBatchPath(batchArg.slice("--batch=".length));
const manifest=readJson(batchPath);
const registry=readJson("config/monster-portrait-registry.json");
const tupleFields=registry.tupleSchema||[];
const keyIndex=tupleFields.indexOf("portraitKey");
const pathIndex=tupleFields.indexOf("path");
const statusIndex=tupleFields.indexOf("status");
if(keyIndex<0 || pathIndex<0 || statusIndex<0){
    fail("monster portrait registry tuple schema is missing required fields");
}

const targets=Object.values(registry.groups||{}).flatMap(rows=>Array.isArray(rows)?rows:[]);
const byKey=new Map(targets.map(row=>[row[keyIndex],row]));
const committed=Array.isArray(manifest.committed)?manifest.committed.map(String):[];
const pending=Array.isArray(manifest.pending)?manifest.pending.map(String):[];
const rawBatchKeys=[...committed,...pending];
const batchKeys=[...new Set(rawBatchKeys)];

const errors=[];
const warnings=[];
if(batchKeys.length===0){ errors.push("batch manifest has no registry targets"); }
if(batchKeys.length!==rawBatchKeys.length){ errors.push("batch manifest contains duplicate portraitKey entries"); }

const unknown=batchKeys.filter(key=>!byKey.has(key));
if(unknown.length){ errors.push("batch manifest contains unregistered portraitKey: "+unknown.join(", ")); }

const auditRun=spawnSync(process.execPath,["scripts/audit-monster-portraits.mjs","--json"],{
    cwd:root,
    encoding:"utf8",
    maxBuffer:32*1024*1024
});
let globalAudit=null;
try{
    globalAudit=JSON.parse(auditRun.stdout||"{}");
}catch(error){
    errors.push("base monster portrait audit did not return valid JSON: "+String(error&&error.message||error));
}
if(auditRun.error){ errors.push("base monster portrait audit failed to run: "+auditRun.error.message); }
if(globalAudit && !globalAudit.ok){
    errors.push(...(globalAudit.errors||[]).map(message=>"base audit: "+message));
}

const batchTargets=batchKeys.filter(key=>byKey.has(key)).map(key=>{
    const row=byKey.get(key);
    const rel=String(row[pathIndex]||"");
    return {
        portraitKey:key,
        path:rel,
        status:String(row[statusIndex]||""),
        exists:Boolean(rel)&&fs.existsSync(path.join(root,rel))
    };
});

const committedTargets=committed.filter(key=>byKey.has(key)).map(key=>{
    const row=byKey.get(key);
    const rel=String(row[pathIndex]||"");
    return {portraitKey:key,path:rel,status:String(row[statusIndex]||""),exists:Boolean(rel)&&fs.existsSync(path.join(root,rel))};
});
const invalidCommitted=committedTargets.filter(target=>target.status!=="existing" || !target.exists);
if(invalidCommitted.length){
    errors.push("committed batch targets must already be existing files: "+invalidCommitted.map(target=>target.portraitKey).join(", "));
}

if(strict){
    if(String(manifest.status||"").toUpperCase()!=="COMPLETE"){
        errors.push("strict batch audit requires manifest status COMPLETE");
    }
    if(pending.length){
        errors.push("strict batch audit requires pending=[]; still pending: "+pending.join(", "));
    }
    const notExisting=batchTargets.filter(target=>target.status!=="existing");
    const missing=batchTargets.filter(target=>!target.exists);
    if(notExisting.length){
        errors.push("strict batch audit found non-existing registry status: "+notExisting.map(target=>target.portraitKey).join(", "));
    }
    if(missing.length){
        errors.push("strict batch audit found missing files: "+missing.map(target=>target.path||target.portraitKey).join(", "));
    }
}else if(pending.length){
    warnings.push(`batch is still in progress (${pending.length} pending)`);
}

const report={
    ok:errors.length===0,
    strict,
    batchPath,
    batch:Number(manifest.batch)||null,
    manifestStatus:String(manifest.status||""),
    batchTargets:batchTargets.length,
    committed:committed.length,
    pending:pending.length,
    globalPlannedTargets:globalAudit?globalAudit.plannedTargets:null,
    errors,
    warnings
};

if(jsonMode){
    process.stdout.write(JSON.stringify(report,null,2)+"\n");
}else{
    console.log("Monster Portrait Batch Audit v1");
    console.log(`batch: ${batchPath}`);
    console.log(`targets: ${report.batchTargets} (committed ${report.committed}, pending ${report.pending})`);
    console.log(`global planned targets outside/including this batch: ${report.globalPlannedTargets}`);
    warnings.forEach(message=>console.warn("WARN: "+message));
    errors.forEach(message=>console.error("ERROR: "+message));
    console.log(report.ok?"RESULT: PASS":"RESULT: FAIL");
}

if(!report.ok){ process.exitCode=1; }
