#!/usr/bin/env node
import fs from "node:fs";
const file="scripts/build-production.mjs";
let source=fs.readFileSync(file,"utf8");
const from='    assets:Object.fromEntries([...declared.map(item=>[item.path,{sha256:item.digest,bytes:Buffer.byteLength(item.content)}]),...firstPlayResources.map(item=>[item.path,{sha256:item.sha256,bytes:item.bytes}])])';
const to='    assets:Object.fromEntries(declared.map(item=>[item.path,{sha256:item.digest,bytes:Buffer.byteLength(item.content)}]))';
if(!source.includes(from)){throw new Error("First Play asset-manifest patch anchor missing");}
source=source.replace(from,to);
fs.writeFileSync(file,source);
console.log("Kept raw First Play resources inside asset-manifest.firstPlay while preserving hashed-only asset-manifest.assets.");
