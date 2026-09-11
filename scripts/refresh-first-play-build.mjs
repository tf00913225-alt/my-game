#!/usr/bin/env node
import fs from "node:fs";

const qaPath=".github/scripts/run-boot-architecture-browser-qa.mjs";
let qa=fs.readFileSync(qaPath,"utf8");
qa=qa.replace(/const qaReadyFirstPlayRecord=.*?;\nconst qaStaleFirstPlayRecord=.*?;\n/s,`const qaReadyFirstPlayRecord={\n    gameVersion:String(manifest.release||""),\n    manifestVersion:manifest.firstPlay.manifestVersion,\n    assetPackVersion:manifest.firstPlay.assetPackVersion,\n    manifestHash:manifest.firstPlay.manifestHash,\n    completedAt:"2026-09-11T00:00:00.000Z",\n    assets:Object.fromEntries(manifest.firstPlay.resources.map(item=>[item.path,item.sha256]))\n};\nconst qaStaleFirstPlayRecord={...qaReadyFirstPlayRecord,manifestHash:"qa-stale-manifest",assets:{...qaReadyFirstPlayRecord.assets,"assets/ui/nav-home.png":"qa-stale-asset"}};\n`);
fs.writeFileSync(qaPath,qa);
console.log("Refreshed browser QA First Play record to derive from the current deterministic manifest.");
