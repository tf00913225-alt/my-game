#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const buildSource=read("scripts/build-production.mjs");
const productionSources=[...new Set(
  [...buildSource.matchAll(/["'](js\/[^"']+\.js)["']/g)].map(match=>match[1])
)].filter(relative=>fs.existsSync(path.join(ROOT,relative)));

const baseline=Object.freeze({
  updateUIWrappers:8,
  updateMonsterUIWrappers:7,
  renderBattleWrappers:0,
  mutationObservers:22,
  bodyObservers:17,
  setIntervals:16,
  globalClickListeners:13
});
const limits=Object.freeze({
  updateUIWrappers:0,
  updateMonsterUIWrappers:0,
  renderBattleWrappers:0,
  mutationObservers:11,
  bodyObservers:0,
  setIntervals:14,
  globalClickListeners:5
});

const intervalAllowlist=Object.freeze({
  "js/00-main.js":4,
  "js/25-v131-fix-batch.js":1,
  "js/28-v133-economy-rebalance.js":1,
  "js/32-v139-rested-experience.js":1,
  "js/39-v143-skill-animation.js":1,
  "js/45-v154-dev-fixes.js":1,
  "js/54-v173.51-battle-qa.js":1,
  "js/release-update-notification.js":1,
  "js/relic-progression-drop-system.js":1,
  "js/adventure/adventure-runtime-v1-20260915.js":2
});
const globalClickAllowlist=Object.freeze({
  "js/00-main.js":2,
  "js/20-anonymous-20.js":1,
  "js/31-v136-auto-battle-fix.js":1,
  "js/44-v152-dev-fixes.js":1
});

const count=(source,re)=>(source.match(re)||[]).length;
const totals={
  updateUIWrappers:0,
  updateMonsterUIWrappers:0,
  renderBattleWrappers:0,
  mutationObservers:0,
  bodyObservers:0,
  setIntervals:0,
  globalClickListeners:0
};
const perFile=[];
const failures=[];

for(const relative of productionSources){
  const source=read(relative);
  const row={
    file:relative,
    updateUIWrappers:count(source,/\bupdateUI\s*=\s*function\b/g),
    updateMonsterUIWrappers:count(source,/\bupdateMonsterUI\s*=\s*function\b/g),
    renderBattleWrappers:count(source,/\brenderBattle\s*=\s*function\b/g),
    mutationObservers:count(source,/new\s+MutationObserver\s*\(/g),
    bodyObservers:count(source,/\.observe\s*\(\s*document\.body\b/g),
    setIntervals:count(source,/\b(?:window\.|global\.)?setInterval\s*\(/g),
    globalClickListeners:count(source,/document\.addEventListener\s*\(\s*["']click["']/gs)
  };
  perFile.push(row);
  Object.keys(totals).forEach(key=>{totals[key]+=row[key];});

  if(/^js\/v\d+-/i.test(relative)){
    failures.push(relative+": production one-off vXXX runtime patch filename is forbidden");
  }
  if(row.setIntervals){
    const allowed=intervalAllowlist[relative]||0;
    if(row.setIntervals>allowed){
      failures.push(relative+": setInterval count "+row.setIntervals+" exceeds allowlist "+allowed);
    }
  }
  if(row.globalClickListeners){
    const allowed=globalClickAllowlist[relative]||0;
    if(row.globalClickListeners>allowed){
      failures.push(relative+": global document click listeners "+row.globalClickListeners+" exceed allowlist "+allowed);
    }
  }

  const clickCalls=[...source.matchAll(/document\.addEventListener\s*\(\s*["']click["'][\s\S]{0,260}/g)];
  clickCalls.forEach(match=>{
    if(/repair|schedule\w*repair/i.test(match[0])){
      failures.push(relative+": global document click listener must not schedule UI repair");
    }
  });
  if(/setInterval\s*\(\s*scheduleInventorySync|setInterval\s*\(\s*previewChests|MutationObserver\s*\(\s*scheduleRepairs|document\.addEventListener\s*\(\s*["'](?:click|change)["']\s*,\s*scheduleRepairs/.test(source)){
    failures.push(relative+": retired QA/repair polling pattern returned");
  }
}

for(const key of Object.keys(limits)){
  if(totals[key]>limits[key]){
    failures.push(key+": "+totals[key]+" exceeds architecture limit "+limits[key]);
  }
}

const delta={};
for(const key of Object.keys(baseline)){
  delta[key]={before:baseline[key],after:totals[key],change:totals[key]-baseline[key]};
}

const report={
  generatedAt:new Date().toISOString(),
  productionSourceCount:productionSources.length,
  baseline,
  limits,
  totals,
  delta,
  activeFiles:perFile.filter(row=>
    row.updateUIWrappers||row.updateMonsterUIWrappers||row.renderBattleWrappers||
    row.mutationObservers||row.bodyObservers||row.setIntervals||row.globalClickListeners
  ),
  failures
};

console.log("Battle Runtime Architecture Delta");
for(const [key,value] of Object.entries(delta)){
  const sign=value.change>0?"+":"";
  console.log("  "+key+": "+value.before+" -> "+value.after+" ("+sign+value.change+")");
}
console.log("  production sources: "+productionSources.length);

if(process.argv.includes("--write")){
  const outDir=path.join(ROOT,"artifacts","architecture");
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,"battle-runtime-architecture.json"),JSON.stringify(report,null,2)+"\n");
}

if(failures.length){
  failures.forEach(message=>console.error("ARCHITECTURE VIOLATION: "+message));
  process.exitCode=1;
}
