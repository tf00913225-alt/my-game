#!/usr/bin/env node
"use strict";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {execFileSync,spawnSync} from "node:child_process";

const root=process.cwd();
const args=process.argv.slice(2);
const masterRootArg=args.find(arg=>arg.startsWith("--master-root="));
const masterCommitArg=args.find(arg=>arg.startsWith("--master-commit="));
const keysArg=args.find(arg=>arg.startsWith("--keys="));
const groupArg=args.find(arg=>arg.startsWith("--group="));
const sourceReferenceArg=args.find(arg=>arg.startsWith("--source-reference="));
const capturedAtArg=args.find(arg=>arg.startsWith("--captured-at="));
const reactivateRetired=args.includes("--reactivate-retired");
const dryRun=args.includes("--dry-run");
const jsonMode=args.includes("--json");

function emit(payload){
    if(jsonMode) process.stdout.write(JSON.stringify(payload,null,2)+"\n");
    else if(payload.ok===false) console.error("ERROR: "+payload.error);
    else console.log(JSON.stringify(payload,null,2));
}
function fail(message){
    emit({ok:false,error:message});
    process.exit(1);
}
function normalizeList(value){
    return [...new Set(String(value||"").split(",").map(item=>item.trim()).filter(Boolean))];
}
function hash(file){
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function replaceExtension(rel,extension){
    const normalized=String(rel||"").replace(/\\/g,"/");
    const ext=path.posix.extname(normalized);
    return ext?normalized.slice(0,-ext.length)+extension:normalized+extension;
}
function runCheck(command,commandArgs,label){
    const result=spawnSync(command,commandArgs,{cwd:root,encoding:"utf8",maxBuffer:32*1024*1024});
    if(result.error||result.status!==0){
        const output=String(result.stderr||result.stdout||result.error?.message||"").trim();
        throw new Error(label+" failed"+(output?": "+output:""));
    }
}

if(args.includes("--help")){
    console.log([
        "Monster Portrait Master Finalizer",
        "",
        "One scoped transaction:",
        "assets-library Master PNG → Runtime WebP → Provenance → Registry existing → Runtime/Audit/Permanent Gate.",
        "",
        "Required:",
        "  --master-root=/absolute/path/to/assets-library",
        "  --master-commit=<40-char assets-library commit SHA>",
        "  --keys=<portraitKey,...> or --group=<registry-group>",
        "",
        "Optional:",
        "  --source-reference=<text>  Provenance reference; defaults to assets-library@<commit>.",
        "  --captured-at=YYYY-MM-DD    Provenance capture date; defaults to current date.",
        "  --reactivate-retired       Explicitly allow selected retired targets.",
        "  --dry-run                  Validate selection and Master PNG files without writing.",
        "  --json                     Print machine-readable output.",
        "",
        "Master path is deterministic: the registry target stem with .png in assets-library.",
        "Runtime canvas is deterministic: registry sizeClass dimensions."
    ].join("\n"));
    process.exit(0);
}

if(!masterRootArg) fail("--master-root is required");
if(!masterCommitArg) fail("--master-commit is required");
if(!keysArg&&!groupArg) fail("refusing unscoped finalize; pass --keys=<portraitKey,...> or --group=<registry-group>");

const masterRoot=path.resolve(masterRootArg.slice("--master-root=".length));
const masterCommit=String(masterCommitArg.slice("--master-commit=".length)).trim();
if(!/^[0-9a-f]{40}$/.test(masterCommit)) fail("--master-commit must be a full 40-character lowercase Git SHA");

const sourceReference=sourceReferenceArg
    ?String(sourceReferenceArg.slice("--source-reference=".length)).trim()
    :"assets-library@"+masterCommit;
const capturedAt=capturedAtArg
    ?String(capturedAtArg.slice("--captured-at=".length)).trim()
    :new Date().toISOString().slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(capturedAt)) fail("--captured-at must use YYYY-MM-DD");

const registryPath=path.join(root,"config/monster-portrait-registry.json");
const provenancePath=path.join(root,"config/monster-asset-provenance.json");
const originalRegistryText=fs.readFileSync(registryPath,"utf8");
const originalProvenanceText=fs.readFileSync(provenancePath,"utf8");
const registry=JSON.parse(originalRegistryText);
const provenance=JSON.parse(originalProvenanceText);
const fields=registry.tupleSchema||[];
const index=Object.fromEntries(fields.map((field,i)=>[field,i]));
for(const field of ["portraitKey","name","sizeClass","path","status"]){
    if(index[field]===undefined) fail("monster portrait registry tuple schema is missing "+field);
}

const targets=Object.entries(registry.groups||{}).flatMap(([group,rows])=>
    (Array.isArray(rows)?rows:[]).map(row=>({group,row,key:String(row[index.portraitKey])}))
);
const byKey=new Map(targets.map(target=>[target.key,target]));
const requestedKeys=keysArg?normalizeList(keysArg.slice("--keys=".length)):[];
const requestedGroup=groupArg?String(groupArg.slice("--group=".length)).trim():"";
if(requestedGroup&&!Object.prototype.hasOwnProperty.call(registry.groups||{},requestedGroup)) fail("unknown registry group: "+requestedGroup);
const groupKeys=requestedGroup?targets.filter(target=>target.group===requestedGroup).map(target=>target.key):[];
const selectedKeys=[...new Set([...requestedKeys,...groupKeys])];
if(!selectedKeys.length) fail("selection resolved to zero portrait targets");
const unknown=selectedKeys.filter(key=>!byKey.has(key));
if(unknown.length) fail("unregistered portraitKey: "+unknown.join(", "));

const prepared=[];
for(const key of selectedKeys){
    const target=byKey.get(key);
    const row=target.row;
    const status=String(row[index.status]||"");
    if(status==="retired"&&!reactivateRetired) fail("retired target requires --reactivate-retired: "+key);
    if(!["planned","existing","retired"].includes(status)) fail("unsupported registry status for "+key+": "+status);

    const sizeClass=String(row[index.sizeClass]||"");
    const expected=registry.dimensions&&registry.dimensions[sizeClass];
    if(!expected||!Number.isInteger(expected.width)||!Number.isInteger(expected.height)) fail("unknown sizeClass for "+key+": "+sizeClass);

    const registryRel=String(row[index.path]||"").replace(/\\/g,"/");
    if(!registryRel.startsWith("assets/monsters/")||registryRel.split("/").includes("..")) fail("Master finalizer only accepts formal assets/monsters targets: "+key+" -> "+registryRel);
    const masterRel=replaceExtension(registryRel,".png");
    const runtimeRel=replaceExtension(registryRel,".webp");
    const source=path.join(masterRoot,masterRel);
    if(!fs.existsSync(source)||!fs.statSync(source).isFile()) fail("Master PNG missing for "+key+": "+masterRel);

    let meta="";
    try{
        meta=execFileSync("identify",["-format","%m|%wx%h|%[channels]|%[opaque]",source],{encoding:"utf8"}).trim();
    }catch(error){
        fail("ImageMagick identify failed for Master "+key+": "+String(error&&error.message||error));
    }
    const [format,geometry,channels,opaque]=meta.split("|");
    if(String(format).toUpperCase()!=="PNG") fail("Master must decode as PNG for "+key+": "+format);
    if(!/a/i.test(channels||"")) fail("Master alpha channel missing for "+key);
    if(String(opaque||"").toLowerCase()==="true") fail("Master has no transparent pixels for "+key);
    const dimensionMatch=String(geometry||"").match(/^(\d+)x(\d+)$/);
    if(!dimensionMatch) fail("Master geometry unreadable for "+key+": "+geometry);

    prepared.push({
        key,
        target,
        status,
        sizeClass,
        expected,
        masterRel,
        source,
        masterSha:hash(source),
        masterWidth:Number(dimensionMatch[1]),
        masterHeight:Number(dimensionMatch[2]),
        runtimeRel
    });
}

if(dryRun){
    emit({
        ok:true,
        dryRun:true,
        selected:prepared.map(item=>({
            portraitKey:item.key,
            name:String(item.target.row[index.name]||""),
            status:item.status,
            sizeClass:item.sizeClass,
            runtimeCanvas:item.expected.width+"x"+item.expected.height,
            master:item.masterRel,
            runtime:item.runtimeRel
        }))
    });
    process.exit(0);
}

const runtimeBackups=new Map();
function rollback(){
    fs.writeFileSync(registryPath,originalRegistryText);
    fs.writeFileSync(provenancePath,originalProvenanceText);
    for(const [absolute,backup] of runtimeBackups){
        if(backup===null){
            try{ fs.unlinkSync(absolute); }catch(_){}
        }else{
            fs.mkdirSync(path.dirname(absolute),{recursive:true});
            fs.writeFileSync(absolute,backup);
        }
    }
}

try{
    const provenanceByKey=new Map((provenance.assets||[]).map((entry,i)=>[String(entry.portraitKey),{entry,i}]));
    const finalized=[];

    for(const item of prepared){
        const row=item.target.row;
        const runtimeAbs=path.join(root,item.runtimeRel);
        if(!runtimeBackups.has(runtimeAbs)) runtimeBackups.set(runtimeAbs,fs.existsSync(runtimeAbs)?fs.readFileSync(runtimeAbs):null);
        fs.mkdirSync(path.dirname(runtimeAbs),{recursive:true});

        const canvas=item.expected.width+"x"+item.expected.height;
        const convert=spawnSync("convert",[item.source,"-resize",canvas,"-gravity","center","-background","none","-extent",canvas,"-define","webp:lossless=true",runtimeAbs],{encoding:"utf8"});
        if(convert.error||convert.status!==0) throw new Error(item.key+" conversion failed: "+String(convert.stderr||convert.error?.message||"").trim());

        const decoded=execFileSync("identify",["-format","%m|%wx%h|%[channels]|%[opaque]",runtimeAbs],{encoding:"utf8"}).trim();
        const [format,geometry,channels,opaque]=decoded.split("|");
        if(String(format).toUpperCase()!=="WEBP"||geometry!==canvas||!/a/i.test(channels||"")||String(opaque).toLowerCase()==="true"){
            throw new Error(item.key+" Runtime WebP contract mismatch: "+decoded);
        }

        const entry={
            monsterId:item.key,
            displayName:String(row[index.name]||""),
            portraitKey:item.key,
            identityStatus:"IDENTITY_VERIFIED",
            master:{
                repository:"tf00913225-alt/my-game",
                branch:"assets-library",
                commit:masterCommit,
                path:item.masterRel,
                sha256:item.masterSha,
                width:item.masterWidth,
                height:item.masterHeight,
                format:"png",
                alphaVerified:true,
                decodeVerified:true,
                source:{
                    kind:"repository-owner supplied project PNG",
                    reference:sourceReference,
                    capturedAt,
                    rightsSourceDeclaration:"repository-owner supplied project asset; provenance recorded for game use"
                }
            },
            runtime:{
                path:item.runtimeRel,
                sha256:hash(runtimeAbs),
                format:"webp",
                width:item.expected.width,
                height:item.expected.height,
                background:"transparent",
                fit:"contain",
                alignment:"center",
                crop:"forbidden",
                stretch:"forbidden",
                generator:{
                    tool:"ImageMagick",
                    command:`convert <master.png> -resize ${canvas} -gravity center -background none -extent ${canvas} -define webp:lossless=true <runtime.webp>`,
                    canvas:{width:item.expected.width,height:item.expected.height},
                    fit:"contain",
                    alignment:"center",
                    crop:"forbidden",
                    stretch:"forbidden",
                    background:"transparent",
                    format:"webp",
                    lossless:true
                }
            },
            runtimeReady:true
        };

        const previous=provenanceByKey.get(item.key);
        if(previous) provenance.assets[previous.i]=entry;
        else{
            provenance.assets.push(entry);
            provenanceByKey.set(item.key,{entry,i:provenance.assets.length-1});
        }

        row[index.path]=item.runtimeRel;
        row[index.status]="existing";
        finalized.push({
            portraitKey:item.key,
            name:entry.displayName,
            from:item.status,
            to:"existing",
            sizeClass:item.sizeClass,
            master:item.masterRel,
            runtime:item.runtimeRel,
            runtimeCanvas:canvas
        });
    }

    const rows=targets.map(target=>target.row);
    registry.snapshot={
        ...(registry.snapshot||{}),
        portraitTargets:rows.length,
        existingTargets:rows.filter(row=>row[index.status]==="existing").length,
        plannedTargets:rows.filter(row=>row[index.status]==="planned").length,
        uniqueRuntimeNames:new Set(rows.map(row=>String(row[index.name]||"")).filter(Boolean)).size
    };

    const duplicateKeys=(provenance.assets||[]).map(entry=>String(entry.portraitKey||"")).filter((key,i,all)=>key&&all.indexOf(key)!==i);
    if(duplicateKeys.length) throw new Error("duplicate provenance portraitKey: "+[...new Set(duplicateKeys)].join(", "));

    fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2)+"\n");
    fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+"\n");

    runCheck(process.execPath,["scripts/measure-monster-portraits.mjs","--write"],"Portrait visual bounds");
    runCheck(process.execPath,["tests/monster-portrait-runtime.test.js"],"Monster portrait runtime contract");
    runCheck(process.execPath,["scripts/audit-monster-portraits.mjs"],"Monster portrait audit");
    runCheck(process.execPath,["tests/permanent-image-asset-pipeline.test.mjs"],"Permanent image asset gate");

    emit({
        ok:true,
        dryRun:false,
        finalized,
        postChecks:[
            "tests/monster-portrait-runtime.test.js",
            "scripts/audit-monster-portraits.mjs",
            "tests/permanent-image-asset-pipeline.test.mjs"
        ]
    });
}catch(error){
    rollback();
    fail("transaction rolled back: "+String(error&&error.message||error));
}
