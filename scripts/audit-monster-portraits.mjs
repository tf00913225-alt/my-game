#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const args=new Set(process.argv.slice(2));
const strict=args.has("--strict");
const jsonMode=args.has("--json");
const root=process.cwd();

function read(rel){
    return fs.readFileSync(path.join(root,rel),"utf8");
}
function uniq(values){
    return [...new Set(values.filter(Boolean))];
}
function collectMatches(source,regex,groupIndex=1){
    const values=[];
    let match;
    while((match=regex.exec(source))!==null){ values.push(match[groupIndex]); }
    return values;
}

const registry=JSON.parse(read("config/monster-portrait-registry.json"));
const tupleFields=registry.tupleSchema;
if(!Array.isArray(tupleFields)||tupleFields.length!==7){
    throw new Error("monster portrait registry tupleSchema invalid");
}
const targets=Object.entries(registry.groups||{}).flatMap(([group,rows])=>
    (rows||[]).map(row=>{
        const target={group};
        tupleFields.forEach((field,index)=>{ target[field]=row[index]; });
        return target;
    })
);

const main=read("js/00-main.js");
const wildCore=read("js/34-v141-core-systems.js");
const daily=read("js/42-v148-combat-dungeon-fixes.js");
const bossTower=read("js/gameplay-boss-tower-system.js");
const abyss=read("js/59-abyss-two-tier-runtime.js");
const portraitRuntime=read("js/45-v154-dev-fixes.js");
const portraitTiming=read("js/48-v159-abyss-battle-portraits.js");

const errors=[];
const warnings=[];
const discovered=[];

const zoneVariables=[
    "forestMonsters","desertMonsters","iceMountainMonsters","zone4Monsters","zone5Monsters",
    "zone6Monsters","zone7Monsters","zone8Monsters","zone9Monsters","zone10Monsters"
];
zoneVariables.forEach(variable=>{
    const marker="const "+variable+" = [";
    const start=main.indexOf(marker);
    if(start<0){ errors.push("missing runtime wild array: "+variable); return; }
    const end=main.indexOf("\n];",start);
    if(end<0){ errors.push("unterminated runtime wild array: "+variable); return; }
    const block=main.slice(start,end);
    collectMatches(block,/makeZoneMonster\("([^"]+)",\s*\d+,\s*"[^"]+"/g).forEach(name=>discovered.push(name));
});

let wildSpecMatch;
const wildSpecRegex=/,\s*\d+,\s*"([^"]+)",\s*"([^"]+)",\s*WILD_ZONE_STRENGTHS/g;
while((wildSpecMatch=wildSpecRegex.exec(wildCore))!==null){
    discovered.push(wildSpecMatch[1],wildSpecMatch[2]);
}

let dailyMatch;
const dailyRegex=/(?:exp|material|gold):\{regular:"([^"]+)",elite:"([^"]+)",boss:"([^"]+)"\}/g;
while((dailyMatch=dailyRegex.exec(daily))!==null){
    discovered.push(dailyMatch[1],dailyMatch[2],dailyMatch[3]);
}

collectMatches(
    bossTower,
    /Object\.freeze\(\{id:"(?:personal|world)-\d+",name:"([^"]+)"/g
).forEach(name=>discovered.push(name));

["fire","water","earth","wind"].forEach(element=>{
    const supportRegex=new RegExp(
        element.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+
        ':Object\\.freeze\\(\\["([^"]+)","([^"]+)"\\]\\)'
    );
    const match=bossTower.match(supportRegex);
    if(!match){ errors.push("missing boss support definition for "+element); return; }
    discovered.push(match[1],match[2]);
});

["fire","water","earth","wind"].forEach(element=>{
    const towerRegex=new RegExp(
        element.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+
        ':high\\?"([^"]+)":"([^"]+)"'
    );
    const match=bossTower.match(towerRegex);
    if(!match){ errors.push("missing tower boss name definition for "+element); return; }
    discovered.push(match[1],match[2]);
});

let regionMatch;
const regionRegex=/id:"(?:east|south|heaven|north|extreme)",name:"[^"]+",emperor:"([^"]+)"/g;
while((regionMatch=regionRegex.exec(abyss))!==null){ discovered.push(regionMatch[1]); }

const finalStart=abyss.indexOf("const FINAL_TRUE_REALM_EMPERORS=");
const finalEnd=finalStart>=0?abyss.indexOf("]);",finalStart):-1;
if(finalStart<0||finalEnd<0){
    errors.push("missing FINAL_TRUE_REALM_EMPERORS");
}else{
    const finalBlock=abyss.slice(finalStart,finalEnd+3);
    collectMatches(finalBlock,/Object\.freeze\(\{name:"([^"]+)",regionIndex:\d+\}\)/g)
        .forEach(name=>discovered.push(name));
}

discovered.push("天兵天將");

const runtimeNames=uniq(discovered);
const registryNames=uniq(targets.map(target=>target.name));
const unregistered=runtimeNames.filter(name=>!registryNames.includes(name)).sort();
const orphaned=registryNames.filter(name=>!runtimeNames.includes(name)).sort();

if(unregistered.length){ errors.push("unregistered runtime monsters: "+unregistered.join("、")); }
if(orphaned.length){ errors.push("registry names absent from runtime discovery: "+orphaned.join("、")); }

const duplicateKeys=targets.map(t=>t.portraitKey).filter((key,index,all)=>all.indexOf(key)!==index);
const duplicatePaths=targets.map(t=>t.path).filter((p,index,all)=>all.indexOf(p)!==index);
if(duplicateKeys.length){ errors.push("duplicate portraitKey: "+uniq(duplicateKeys).join(", ")); }
if(duplicatePaths.length){ errors.push("duplicate portrait path: "+uniq(duplicatePaths).join(", ")); }

const existingTargets=targets.filter(target=>target.status==="existing");
const plannedTargets=targets.filter(target=>target.status==="planned");
const missingExisting=existingTargets.filter(target=>!fs.existsSync(path.join(root,target.path)));
const missingPlanned=plannedTargets.filter(target=>!fs.existsSync(path.join(root,target.path)));
const presentPlanned=plannedTargets.filter(target=>fs.existsSync(path.join(root,target.path)));
if(missingExisting.length){
    errors.push("registered existing portrait files missing: "+missingExisting.map(t=>t.path).join(", "));
}
if(presentPlanned.length){
    errors.push("portrait files exist but registry status is still planned: "+presentPlanned.map(t=>t.portraitKey).join(", "));
}
if(strict&&missingPlanned.length){
    errors.push("strict mode: planned portrait files missing: "+missingPlanned.length);
}

const invalidGeneratedAssets=[];
const generatedExisting=existingTargets.filter(target=>String(target.path||"").startsWith("assets/monsters/"));
generatedExisting.forEach(target=>{
    const expected=registry.dimensions&&registry.dimensions[target.sizeClass];
    const absolute=path.join(root,target.path);
    if(!fs.existsSync(absolute)){ return; }
    if(path.extname(target.path).toLowerCase()!==".png"){
        invalidGeneratedAssets.push({portraitKey:target.portraitKey,path:target.path,reason:"new portrait is not PNG"});
        return;
    }
    if(!expected){
        invalidGeneratedAssets.push({portraitKey:target.portraitKey,path:target.path,reason:"unknown sizeClass "+target.sizeClass});
        return;
    }
    try{
        const meta=execFileSync("identify",["-format","%wx%h|%[channels]|%[opaque]",absolute],{encoding:"utf8"}).trim();
        const [geometry,channels,opaque]=meta.split("|");
        const expectedGeometry=expected.width+"x"+expected.height;
        if(geometry!==expectedGeometry){
            invalidGeneratedAssets.push({portraitKey:target.portraitKey,path:target.path,reason:`geometry ${geometry} != ${expectedGeometry}`});
        }
        if(!/a/i.test(channels||"")){
            invalidGeneratedAssets.push({portraitKey:target.portraitKey,path:target.path,reason:"PNG has no alpha channel"});
        }else if(String(opaque||"").toLowerCase()==="true"){
            invalidGeneratedAssets.push({portraitKey:target.portraitKey,path:target.path,reason:"PNG has alpha but no transparent pixels"});
        }
    }catch(error){
        invalidGeneratedAssets.push({portraitKey:target.portraitKey,path:target.path,reason:"ImageMagick identify failed: "+String(error&&error.message||error)});
    }
});
if(invalidGeneratedAssets.length){
    errors.push("invalid generated portrait assets: "+invalidGeneratedAssets.map(item=>item.portraitKey+" ("+item.reason+")").join(", "));
}

if(!portraitRuntime.includes('MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json"')){
    errors.push("V154 portrait owner is not wired to canonical monster portrait registry");
}
if(!portraitRuntime.includes('target.status!=="existing"')){
    errors.push("V154 portrait resolver must reject planned/non-existing registry targets");
}
if(!portraitRuntime.includes('monsterPortraitByKey.get("soldier."+element)')){
    errors.push("V154 portrait resolver is missing element-keyed heavenly soldier resolution");
}
if(!portraitRuntime.includes("window.resolveMonsterPortrait")){
    errors.push("V154 portrait owner does not expose resolveMonsterPortrait(monster)");
}
if(!portraitTiming.includes("v154SyncMonsterPortraits")){
    errors.push("V159 timing bridge is not synchronized with the authoritative V154 portrait owner");
}

const soldiers=targets.filter(target=>target.group==="heavenly-soldier");
const soldierElements=soldiers.map(target=>target.element).sort();
const expectedSoldiers=["earth","fire","water","wind"];
if(JSON.stringify(soldierElements)!==JSON.stringify(expectedSoldiers)){
    errors.push("heavenly soldier registry must contain exactly earth/fire/water/wind");
}
if(soldiers.some(target=>target.sizeClass!=="standard"||target.path!==`assets/monsters/soldiers/heavenly-soldier-${target.element}.png`)){
    errors.push("heavenly soldier path/size policy mismatch");
}

if(JSON.stringify(registry.policy.trueRealmFinalDisplayOrder)!==JSON.stringify(["water","earth","fire","wind","water"])){
    errors.push("true realm final soldier display order changed");
}
if(registry.policy.extremePrestageDisplayRule!=="unresolved-do-not-invent-light-soldier"){
    errors.push("extreme prestage light-soldier guard changed");
}else{
    warnings.push("極帝領域前置四關仍是 light：未授權新增第五張光天兵，保持既有通用深淵天兵 fallback，等待顯示規則決策。");
}

const snapshot={
    portraitTargets:targets.length,
    existingTargets:existingTargets.length,
    plannedTargets:plannedTargets.length,
    uniqueRuntimeNames:registryNames.length
};
Object.entries(snapshot).forEach(([key,value])=>{
    if(Number(registry.snapshot&&registry.snapshot[key])!==value){
        errors.push(`registry snapshot ${key} expected ${value} but stored ${registry.snapshot&&registry.snapshot[key]}`);
    }
});

const report={
    ok:errors.length===0,
    strict,
    baselineDevHead:registry.baselineDevHead,
    runtimeUniqueNames:runtimeNames.length,
    registeredUniqueNames:registryNames.length,
    portraitTargets:targets.length,
    existingTargets:existingTargets.length,
    plannedTargets:plannedTargets.length,
    missingExisting:missingExisting.length,
    missingPlanned:missingPlanned.length,
    presentPlanned:presentPlanned.length,
    generatedExisting:generatedExisting.length,
    invalidGeneratedAssets,
    brokenReferenceCount:missingExisting.length+invalidGeneratedAssets.length,
    missingPlannedTargets:missingPlanned.map(target=>({
        portraitKey:target.portraitKey,
        name:target.name,
        path:target.path,
        sizeClass:target.sizeClass,
        element:target.element
    })),
    unregistered,
    orphaned,
    errors,
    warnings
};

if(jsonMode){
    process.stdout.write(JSON.stringify(report,null,2)+"\n");
}else{
    console.log("Monster Portrait Audit v1");
    console.log(`runtime names: ${report.runtimeUniqueNames}`);
    console.log(`portrait targets: ${report.portraitTargets} (existing ${report.existingTargets}, planned ${report.plannedTargets})`);
    console.log(`planned files still missing: ${report.missingPlanned}`);
    console.log(`generated existing assets validated: ${report.generatedExisting}; broken references: ${report.brokenReferenceCount}`);
    warnings.forEach(message=>console.warn("WARN: "+message));
    errors.forEach(message=>console.error("ERROR: "+message));
    console.log(report.ok?"RESULT: PASS":"RESULT: FAIL");
}

if(!report.ok){ process.exitCode=1; }
