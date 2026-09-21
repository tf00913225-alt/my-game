#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import {execFileSync,spawnSync} from "node:child_process";

const root=process.cwd();
const args=process.argv.slice(2);
const dryRun=args.includes("--dry-run");
const jsonMode=args.includes("--json");
const reactivateRetired=args.includes("--reactivate-retired");
const keysArg=args.find(arg=>arg.startsWith("--keys="));
const groupArg=args.find(arg=>arg.startsWith("--group="));

function fail(message){
    const payload={ok:false,error:message};
    if(jsonMode){ process.stdout.write(JSON.stringify(payload,null,2)+"\n"); }
    else{ console.error("ERROR: "+message); }
    process.exit(1);
}

function usage(){
    return [
        "Monster Portrait Fast Import",
        "",
        "Use this only after approved runtime WebP files have already been placed at the registry target paths.",
        "",
        "Examples:",
        "  npm run portrait:import -- --keys=daily.exp.boss,daily.material.regular",
        "  npm run portrait:import -- --group=daily --dry-run",
        "  npm run portrait:import -- --keys=daily.material.regular --reactivate-retired",
        "",
        "Options:",
        "  --keys=<a,b,c>            Import exact registry portrait keys.",
        "  --group=<group>            Import every target in one registry group.",
        "  --reactivate-retired       Allow explicitly selected retired targets to become existing.",
        "  --dry-run                  Validate without writing the registry.",
        "  --json                     Print machine-readable output.",
        "  --help                     Show this help."
    ].join("\n");
}

if(args.includes("--help")){
    console.log(usage());
    process.exit(0);
}

function normalizeList(value){
    return [...new Set(String(value||"").split(",").map(item=>item.trim()).filter(Boolean))];
}

if(!keysArg&&!groupArg){
    fail("refusing unscoped import; pass --keys=<portraitKey,...> or --group=<registry-group>");
}

const registryPath=path.join(root,"config/monster-portrait-registry.json");
const registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
const fields=registry.tupleSchema||[];
const keyIndex=fields.indexOf("portraitKey");
const nameIndex=fields.indexOf("name");
const sizeIndex=fields.indexOf("sizeClass");
const pathIndex=fields.indexOf("path");
const statusIndex=fields.indexOf("status");
if([keyIndex,nameIndex,sizeIndex,pathIndex,statusIndex].some(index=>index<0)){
    fail("monster portrait registry tuple schema is missing required fields");
}

const targets=Object.entries(registry.groups||{}).flatMap(([group,rows])=>
    (Array.isArray(rows)?rows:[]).map(row=>({group,row}))
);
const byKey=new Map(targets.map(target=>[String(target.row[keyIndex]),target]));
const requestedKeys=keysArg?normalizeList(keysArg.slice("--keys=".length)):[];
const requestedGroup=groupArg?String(groupArg.slice("--group=".length)).trim():"";

if(requestedGroup&&!Object.prototype.hasOwnProperty.call(registry.groups||{},requestedGroup)){
    fail("unknown registry group: "+requestedGroup);
}
const groupKeys=requestedGroup
    ?targets.filter(target=>target.group===requestedGroup).map(target=>String(target.row[keyIndex]))
    :[];
const selectedKeys=[...new Set([...requestedKeys,...groupKeys])];
if(!selectedKeys.length){ fail("selection resolved to zero portrait targets"); }

const unknown=selectedKeys.filter(key=>!byKey.has(key));
if(unknown.length){ fail("unregistered portraitKey: "+unknown.join(", ")); }

const runtimeSource=fs.readFileSync(path.join(root,"js/45-v154-dev-fixes.js"),"utf8");
if(!runtimeSource.includes('target.status!=="existing"')||
   !runtimeSource.includes("monsterPortraitByKey.has(explicitKey)")||
   !runtimeSource.includes("window.resolveMonsterPortrait")){
    fail("authoritative V154 portrait resolver contract changed; review the importer before use");
}

const dailySource=fs.readFileSync(path.join(root,"js/42-v148-combat-dungeon-fixes.js"),"utf8");
const hasDailySelection=selectedKeys.some(key=>byKey.get(key).group==="daily");
if(hasDailySelection&&!dailySource.includes("monster.portraitKey=dailyMonsterPortraitKey(type,rank)")){
    fail("daily dungeon runtime no longer assigns explicit portraitKey; refusing import");
}

const runtimeTest=spawnSync(process.execPath,["tests/monster-portrait-runtime.test.js"],{
    cwd:root,
    encoding:"utf8",
    maxBuffer:16*1024*1024
});
if(runtimeTest.error){ fail("monster portrait runtime test failed to start: "+runtimeTest.error.message); }
if(runtimeTest.status!==0){
    fail("monster portrait runtime contract test failed before import: "+String(runtimeTest.stderr||runtimeTest.stdout||"").trim());
}

function resolveFormalRuntimePath(rel,key){
    const normalized=String(rel||"").replace(/\\/g,"/");
    if(!normalized||path.isAbsolute(normalized)||normalized.split("/").includes("..")){
        fail("invalid registry asset path for "+key+": "+normalized);
    }
    if(!normalized.startsWith("assets/monsters/")){
        fail("fast import only accepts formal assets/monsters targets: "+key+" -> "+normalized);
    }
    const extension=path.extname(normalized).toLowerCase();
    if(extension===".webp"){ return {path:normalized,normalizedFrom:null}; }
    if(![".png",".jpg",".jpeg"].includes(extension)){
        fail("unsupported registry asset extension for "+key+": "+extension);
    }
    const webpCandidate=normalized.slice(0,-extension.length)+".webp";
    const webpAbsolute=path.join(root,webpCandidate);
    if(!fs.existsSync(webpAbsolute)||!fs.statSync(webpAbsolute).isFile()){
        fail("registry still points to "+extension+" and matching formal WebP is missing: "+key+" -> "+webpCandidate);
    }
    return {path:webpCandidate,normalizedFrom:normalized};
}

function validateImage(target,key){
    const row=target.row;
    const resolved=resolveFormalRuntimePath(row[pathIndex],key);
    const rel=resolved.path;
    const absolute=path.join(root,rel);
    if(!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){
        fail("approved runtime WebP is not present at registry path: "+key+" -> "+rel);
    }
    const expected=registry.dimensions&&registry.dimensions[row[sizeIndex]];
    if(!expected){ fail("unknown sizeClass for "+key+": "+String(row[sizeIndex]||"")); }

    let meta="";
    try{
        meta=execFileSync("identify",["-format","%m|%wx%h|%[channels]|%[opaque]",absolute],{encoding:"utf8"}).trim();
    }catch(error){
        fail("ImageMagick identify failed for "+key+": "+String(error&&error.message||error));
    }
    const [format,geometry,channels,opaque]=meta.split("|");
    if(String(format).toUpperCase()!=="WEBP"){
        fail("decoder format is not WEBP for "+key+": "+format);
    }
    const expectedGeometry=expected.width+"x"+expected.height;
    if(geometry!==expectedGeometry){
        fail("geometry mismatch for "+key+": "+geometry+" != "+expectedGeometry);
    }
    if(!/a/i.test(channels||"")){
        fail("alpha channel missing for "+key);
    }
    if(String(opaque||"").toLowerCase()==="true"){
        fail("transparent pixels missing for "+key);
    }
    return {rel,geometry,channels,opaque,normalizedFrom:resolved.normalizedFrom};
}

const validated=[];
const promoted=[];
const alreadyExisting=[];
for(const key of selectedKeys){
    const target=byKey.get(key);
    const row=target.row;
    const status=String(row[statusIndex]||"");
    const image=validateImage(target,key);

    if(status==="retired"&&!reactivateRetired){
        fail("retired target requires explicit --reactivate-retired authorization: "+key);
    }
    if(status!=="planned"&&status!=="retired"&&status!=="existing"){
        fail("unsupported registry status for "+key+": "+status);
    }

    if(status==="existing"&&image.normalizedFrom){
        fail("existing target still points to a non-WebP registry path: "+key+" -> "+image.normalizedFrom);
    }
    if(image.normalizedFrom&&!dryRun){ row[pathIndex]=image.rel; }

    if(status==="existing"){
        alreadyExisting.push(key);
    }else{
        promoted.push({
            portraitKey:key,
            from:status,
            to:"existing",
            path:image.rel,
            normalizedPathFrom:image.normalizedFrom
        });
        if(!dryRun){ row[statusIndex]="existing"; }
    }
    validated.push({
        portraitKey:key,
        group:target.group,
        name:String(row[nameIndex]||""),
        path:image.rel,
        statusBefore:status,
        statusAfter:"existing",
        geometry:image.geometry,
        normalizedPathFrom:image.normalizedFrom
    });
}

function statusCount(status){
    return targets.filter(target=>String(target.row[statusIndex]||"")===status).length;
}

let existingTargets=statusCount("existing");
let plannedTargets=statusCount("planned");
let retiredTargets=statusCount("retired");
if(dryRun){
    for(const item of promoted){
        if(item.from==="planned"){ plannedTargets--; }
        if(item.from==="retired"){ retiredTargets--; }
        existingTargets++;
    }
}else{
    registry.snapshot={
        portraitTargets:targets.length,
        existingTargets,
        plannedTargets,
        uniqueRuntimeNames:new Set(targets.map(target=>String(target.row[nameIndex]||"")).filter(Boolean)).size
    };
    fs.writeFileSync(registryPath,JSON.stringify(registry)+"\n");
}

const report={
    ok:true,
    dryRun,
    selected:selectedKeys.length,
    promoted,
    alreadyExisting,
    validated,
    snapshot:{
        portraitTargets:targets.length,
        existingTargets,
        plannedTargets,
        retiredTargets
    },
    runtimeContractTest:"PASS"
};

if(jsonMode){ process.stdout.write(JSON.stringify(report,null,2)+"\n"); }
else{
    console.log("Monster Portrait Fast Import");
    console.log("selected: "+report.selected);
    console.log("promoted: "+promoted.length+"; already existing: "+alreadyExisting.length);
    console.log("runtime contract: PASS");
    if(dryRun){ console.log("registry write: DRY RUN"); }
    else{ console.log("registry write: UPDATED"); }
    promoted.forEach(item=>console.log("  "+item.portraitKey+": "+item.from+" -> existing"));
    console.log("RESULT: PASS");
}
