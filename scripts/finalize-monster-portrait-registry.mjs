#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const registryPath=path.join(root,"config/monster-portrait-registry.json");
const registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
const fields=registry.tupleSchema||[];
const statusIndex=fields.indexOf("status");
const pathIndex=fields.indexOf("path");
const keyIndex=fields.indexOf("portraitKey");

if(statusIndex<0||pathIndex<0||keyIndex<0){
    throw new Error("monster portrait registry tuple schema is missing required fields");
}

const rows=Object.values(registry.groups||{}).flatMap(group=>Array.isArray(group)?group:[]);
const promoted=[];

for(const row of rows){
    if(row[statusIndex]!=="planned"){ continue; }
    const rel=String(row[pathIndex]||"");
    if(!rel.startsWith("assets/monsters/")||path.extname(rel).toLowerCase()!==".png"){ continue; }
    const absolute=path.join(root,rel);
    if(!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){ continue; }
    row[statusIndex]="existing";
    promoted.push({portraitKey:row[keyIndex],path:rel});
}

const existingTargets=rows.filter(row=>row[statusIndex]==="existing").length;
const plannedTargets=rows.filter(row=>row[statusIndex]==="planned").length;
registry.snapshot={
    portraitTargets:rows.length,
    existingTargets,
    plannedTargets,
    uniqueRuntimeNames:Number(registry.snapshot&&registry.snapshot.uniqueRuntimeNames)||104
};

fs.writeFileSync(registryPath,JSON.stringify(registry)+"\n");
console.log(JSON.stringify({promoted,existingTargets,plannedTargets},null,2));
