import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd();
const provenance=JSON.parse(fs.readFileSync(path.join(root,"config/monster-asset-provenance.json"),"utf8"));
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/monster-portrait-registry.json"),"utf8"));
const v154=fs.readFileSync(path.join(root,"js/45-v154-dev-fixes.js"),"utf8");
const v159=fs.readFileSync(path.join(root,"js/48-v159-abyss-battle-portraits.js"),"utf8");

const failures=[];
const fail=(entry,layer,reason)=>failures.push(`${entry.monsterId}｜${entry.displayName}｜${entry.runtime?.path||entry.master?.path||"(missing path)"}｜${layer}｜${reason}`);
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const tuple=registry.tupleSchema;
const index=Object.fromEntries(tuple.map((field,i)=>[field,i]));
const registryRows=Object.values(registry.groups||{}).flat();
const registryByKey=new Map(registryRows.map(row=>[row[index.portraitKey],row]));

assert.equal(provenance.schemaVersion,1,"provenance schema must be explicit");
const ready=provenance.assets.filter(entry=>entry.runtimeReady===true);
assert.ok(ready.length>0,"permanent image asset provenance must contain at least one runtime-ready entry");

for(const [label,values] of [
    ["monsterId",ready.map(entry=>entry.monsterId)],
    ["portraitKey",ready.map(entry=>entry.portraitKey)],
    ["runtime path",ready.map(entry=>entry.runtime?.path)]
]){
    const duplicates=values.filter((value,i,all)=>value&&all.indexOf(value)!==i);
    assert.deepEqual([...new Set(duplicates)],[],`duplicate provenance ${label}`);
}

for(const entry of ready){
    const {master,runtime}=entry;
    const row=registryByKey.get(entry.portraitKey);
    const sizeClass=row&&row[index.sizeClass];
    const expected=registry.dimensions&&registry.dimensions[sizeClass];

    if(entry.identityStatus!=="IDENTITY_VERIFIED") fail(entry,"identity","identityStatus must be IDENTITY_VERIFIED");
    if(!master||master.repository!=="tf00913225-alt/my-game"||master.branch!=="assets-library"||!/^[0-9a-f]{40}$/.test(master.commit||"")) fail(entry,"master-provenance","repository / branch / commit is incomplete");
    if(!master?.path?.endsWith(".png")||!/^[0-9a-f]{64}$/.test(master?.sha256||"")||!Number.isInteger(master?.width)||!Number.isInteger(master?.height)||master?.decodeVerified!==true||master?.alphaVerified!==true||!master?.source?.reference) fail(entry,"master-provenance","Master PNG path, SHA-256, dimensions, decode/alpha evidence or source declaration is missing");

    if(!row){
        fail(entry,"registry","portraitKey is absent from registry");
    }else{
        if(!expected) fail(entry,"registry",`unknown sizeClass ${sizeClass}`);
        if(row[index.name]!==entry.displayName||row[index.path]!==runtime?.path||row[index.status]!=="existing") fail(entry,"registry",`expected name/path/status ${entry.displayName}/${runtime?.path}/existing`);
    }

    if(!runtime||runtime.format!=="webp"||runtime.background!=="transparent"||runtime.fit!=="contain"||runtime.alignment!=="center"||runtime.crop!=="forbidden"||runtime.stretch!=="forbidden"||!/^[0-9a-f]{64}$/.test(runtime.sha256||"")) fail(entry,"runtime-contract","Runtime WebP recipe or output contract is incomplete");
    if(expected&&(runtime?.width!==expected.width||runtime?.height!==expected.height)) fail(entry,"runtime-contract",`runtime canvas ${runtime?.width}x${runtime?.height} != registry ${expected.width}x${expected.height}`);
    if(expected&&(runtime?.generator?.canvas?.width!==expected.width||runtime?.generator?.canvas?.height!==expected.height)) fail(entry,"runtime-contract","generator canvas must match registry sizeClass");
    if(/(?:artifact|library):/i.test(runtime?.path||"")) fail(entry,"runtime-reference","Runtime must not reference an Artifact or Library URL");

    const file=path.join(root,runtime?.path||"");
    if(!fs.existsSync(file)) { fail(entry,"runtime-file","file is missing"); continue; }
    const bytes=fs.readFileSync(file);
    if(bytes.length<1024||bytes.subarray(0,4).toString()!=="RIFF"||bytes.subarray(8,12).toString()!=="WEBP") fail(entry,"runtime-decode","invalid, empty, or fake WebP container");
    if(hash(file)!==runtime.sha256) fail(entry,"runtime-provenance","Runtime SHA-256 does not match manifest");
    const decoded=spawnSync("identify",["-format","%m|%wx%h|%[channels]|%[opaque]",file],{encoding:"utf8"});
    if(decoded.status!==0) fail(entry,"runtime-decode",`ImageMagick decode failed: ${(decoded.stderr||decoded.error?.message||"").trim()}`);
    else {
        const [format,geometry,channels,opaque]=decoded.stdout.trim().split("|");
        const expectedGeometry=expected?`${expected.width}x${expected.height}`:null;
        if(format!=="WEBP"||(expectedGeometry&&geometry!==expectedGeometry)||!/a/i.test(channels||"")||String(opaque).toLowerCase()==="true") fail(entry,"runtime-contract",`decoded ${format}|${geometry}|${channels}|opaque=${opaque}`);
    }
}

if(!v154.includes('MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json"')||!v154.includes("window.resolveMonsterPortrait")) failures.push("V154｜Portrait Owner｜js/45-v154-dev-fixes.js｜owner｜canonical registry resolver missing");
if(/v159|48-v159/i.test(v154)||/v154SyncMonsterPortraits|updateUI\s*=|requestAnimationFrame|setTimeout|MutationObserver/.test(v159)) failures.push("V159｜Retirement Audit｜js/48-v159-abyss-battle-portraits.js｜owner｜retired runtime still participates in portrait lifecycle");

assert.deepEqual(failures,[],"Permanent Image Asset Gate failed:\n"+failures.join("\n"));
console.log(`Permanent Image Asset Gate passed: ${ready.length} provenance-managed Master → Runtime → Registry entries across registry size classes; V154 sole owner; V159 retired.`);
