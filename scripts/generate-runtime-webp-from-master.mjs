#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {execFileSync,spawnSync} from "node:child_process";

const root=process.cwd();
const args=process.argv.slice(2);
const masterArg=args.find(arg=>arg.startsWith("--master-root="));
const keysArg=args.find(arg=>arg.startsWith("--keys="));
const groupArg=args.find(arg=>arg.startsWith("--group="));
const dryRun=args.includes("--dry-run");
const jsonMode=args.includes("--json");

function fail(message){
    if(jsonMode) process.stdout.write(JSON.stringify({ok:false,error:message},null,2)+"\n");
    else console.error("ERROR: "+message);
    process.exit(1);
}
function normalizeList(value){
    return [...new Set(String(value||"").split(",").map(item=>item.trim()).filter(Boolean))];
}
function runtimePathFor(rel){
    const normalized=String(rel||"").replace(/\\/g,"/");
    const ext=path.posix.extname(normalized);
    return ext?normalized.slice(0,-ext.length)+".webp":normalized+".webp";
}
function hash(file){
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

if(args.includes("--help")){
    console.log([
        "Monster Portrait Runtime WebP Generator",
        "",
        "Regenerates provenance-managed Runtime WebP files from verified assets-library Master PNG files.",
        "Canvas size is derived from each registry sizeClass; it is not hardcoded to standard portraits.",
        "",
        "Required:",
        "  --master-root=/absolute/path/to/assets-library",
        "",
        "Optional scope:",
        "  --keys=<portraitKey,...>   Regenerate exact provenance entries.",
        "  --group=<registry-group>   Regenerate provenance entries in one registry group.",
        "  --dry-run                  Validate Master/provenance/registry without writing.",
        "  --json                     Print machine-readable output.",
        "",
        "Without --keys/--group, only entries already marked runtimeReady are regenerated."
    ].join("\n"));
    process.exit(0);
}
if(!masterArg) fail("Usage: node scripts/generate-runtime-webp-from-master.mjs --master-root=/absolute/path/to/assets-library [--keys=<portraitKey,...>|--group=<group>] [--dry-run]");

const masterRoot=path.resolve(masterArg.slice("--master-root=".length));
const manifestPath=path.join(root,"config/monster-asset-provenance.json");
const registryPath=path.join(root,"config/monster-portrait-registry.json");
const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
const registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
const fields=registry.tupleSchema||[];
const index=Object.fromEntries(fields.map((field,i)=>[field,i]));
for(const field of ["portraitKey","name","sizeClass","path","status"]){
    if(index[field]===undefined) fail("monster portrait registry tuple schema is missing "+field);
}
const targets=Object.entries(registry.groups||{}).flatMap(([group,rows])=>
    (Array.isArray(rows)?rows:[]).map(row=>({group,row,key:String(row[index.portraitKey])}))
);
const registryByKey=new Map(targets.map(target=>[target.key,target]));
const provenanceByKey=new Map((manifest.assets||[]).map(entry=>[String(entry.portraitKey),entry]));

const requestedKeys=keysArg?normalizeList(keysArg.slice("--keys=".length)):[];
const requestedGroup=groupArg?String(groupArg.slice("--group=".length)).trim():"";
if(requestedGroup&&!Object.prototype.hasOwnProperty.call(registry.groups||{},requestedGroup)) fail("unknown registry group: "+requestedGroup);
const groupKeys=requestedGroup?targets.filter(target=>target.group===requestedGroup).map(target=>target.key):[];
const explicitKeys=[...new Set([...requestedKeys,...groupKeys])];
const selected=explicitKeys.length
    ?explicitKeys.map(key=>{
        const entry=provenanceByKey.get(key);
        if(!entry) fail("selected portraitKey has no provenance entry: "+key);
        return entry;
    })
    :(manifest.assets||[]).filter(entry=>entry.runtimeReady===true);
if(!selected.length) fail("selection resolved to zero provenance entries");

const failures=[];
const completed=[];
for(const entry of selected){
    const key=String(entry.portraitKey||"");
    const target=registryByKey.get(key);
    if(!target){ failures.push(`${key||entry.monsterId}: registry target missing`); continue; }
    const row=target.row;
    if(String(row[index.status])==="retired"){ failures.push(`${key}: registry target is retired`); continue; }
    if(entry.identityStatus!=="IDENTITY_VERIFIED"){ failures.push(`${key}: identityStatus must be IDENTITY_VERIFIED`); continue; }

    const expected=registry.dimensions&&registry.dimensions[row[index.sizeClass]];
    if(!expected||!Number.isInteger(expected.width)||!Number.isInteger(expected.height)){
        failures.push(`${key}: unknown registry sizeClass ${row[index.sizeClass]}`);
        continue;
    }

    const source=path.join(masterRoot,String(entry.master?.path||""));
    if(!entry.master?.path?.endsWith(".png")){ failures.push(`${key}: Master path must be PNG`); continue; }
    if(!fs.existsSync(source)){ failures.push(`${key}: Master missing ${source}`); continue; }
    if(hash(source)!==entry.master.sha256){ failures.push(`${key}: Master SHA-256 mismatch ${entry.master.path}`); continue; }

    const targetRel=String(entry.runtime?.path||runtimePathFor(row[index.path])).replace(/\\/g,"/");
    if(!targetRel.startsWith("assets/monsters/")||path.posix.extname(targetRel).toLowerCase()!==".webp"){
        failures.push(`${key}: Runtime path must be an assets/monsters/*.webp target`);
        continue;
    }

    if(!dryRun){
        const targetAbs=path.join(root,targetRel);
        fs.mkdirSync(path.dirname(targetAbs),{recursive:true});
        const geometry=`${expected.width}x${expected.height}`;
        const result=spawnSync("convert",[source,"-resize",geometry,"-gravity","center","-background","none","-extent",geometry,"-define","webp:lossless=true",targetAbs],{encoding:"utf8"});
        if(result.status!==0){ failures.push(`${key}: conversion failed ${(result.stderr||result.error?.message||"").trim()}`); continue; }

        let decoded="";
        try{
            decoded=execFileSync("identify",["-format","%m|%wx%h|%[channels]|%[opaque]",targetAbs],{encoding:"utf8"}).trim();
        }catch(error){
            failures.push(`${key}: generated WebP decode failed ${String(error&&error.message||error)}`);
            continue;
        }
        const [format,decodedGeometry,channels,opaque]=decoded.split("|");
        if(String(format).toUpperCase()!=="WEBP"||decodedGeometry!==geometry||!/a/i.test(channels||"")||String(opaque).toLowerCase()==="true"){
            failures.push(`${key}: generated WebP contract mismatch ${decoded}`);
            continue;
        }

        entry.runtime={
            ...(entry.runtime||{}),
            path:targetRel,
            sha256:hash(targetAbs),
            format:"webp",
            width:expected.width,
            height:expected.height,
            background:"transparent",
            fit:"contain",
            alignment:"center",
            crop:"forbidden",
            stretch:"forbidden",
            generator:{
                tool:"ImageMagick",
                command:`convert <master.png> -resize ${geometry} -gravity center -background none -extent ${geometry} -define webp:lossless=true <runtime.webp>`,
                canvas:{width:expected.width,height:expected.height},
                fit:"contain",
                alignment:"center",
                crop:"forbidden",
                stretch:"forbidden",
                background:"transparent",
                format:"webp",
                lossless:true
            }
        };
        entry.runtimeReady=true;
        row[index.path]=targetRel;
        row[index.status]="existing";
    }

    completed.push({
        portraitKey:key,
        sizeClass:String(row[index.sizeClass]),
        canvas:`${expected.width}x${expected.height}`,
        master:entry.master.path,
        runtime:targetRel,
        dryRun
    });
}

if(failures.length) fail("Runtime generation blocked:\n"+failures.join("\n"));

if(!dryRun){
    const rows=targets.map(target=>target.row);
    registry.snapshot={
        ...(registry.snapshot||{}),
        portraitTargets:rows.length,
        existingTargets:rows.filter(row=>row[index.status]==="existing").length,
        plannedTargets:rows.filter(row=>row[index.status]==="planned").length,
        uniqueRuntimeNames:new Set(rows.map(row=>String(row[index.name]||"")).filter(Boolean)).size
    };
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
    fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+"\n");
}

const report={ok:true,dryRun,selected:selected.length,completed,runtimeReadyTotal:(manifest.assets||[]).filter(entry=>entry.runtimeReady===true).length};
if(jsonMode) process.stdout.write(JSON.stringify(report,null,2)+"\n");
else console.log(`${dryRun?"Validated":"Generated"} ${completed.length} provenance-managed Runtime WebP file(s); registry sizeClass controls every canvas.`);
