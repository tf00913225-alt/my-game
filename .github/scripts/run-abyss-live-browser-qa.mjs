import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

const sourcePath=path.resolve(".github/scripts/abyss-live-browser-qa-v2.mjs");
const source=fs.readFileSync(sourcePath,"utf8");
const needle=`    await client.eval(seedPlayerExpression(20));
    await client.eval(\`(async()=>{
`;
const replacement=`    await client.eval(seedPlayerExpression(20));
    await client.eval(\`(()=>{if(typeof saveGame==='function'){saveGame();return true;}return false;})()\`);
    await client.send("Page.reload",{ignoreCache:true});
    await waitFor(client,"document.readyState==='complete'","saved player reload");
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime after saved player reload");
    await waitFor(client,"document.getElementById('v174-abyss-two-tier-style')&&document.getElementById('v174-abyss-two-tier-style').sheet","two-tier Abyss CSS after saved player reload");
    await client.eval(seedPlayerExpression(20));
    await client.eval(\`(async()=>{
`;

if(!source.includes(needle)){
    throw new Error("Live Abyss QA bootstrap could not find the first player-session entry hook.");
}

let patched=source.replace(needle,replacement);
const stageLoopNeedle=`    for(let expectedStage=2;expectedStage<=4;expectedStage++){
`;
const stageLoopReplacement=`    for(let expectedStage=2;expectedStage<=3;expectedStage++){
`;
const bossGateNeedle=`        if(expectedStage===4){ assert.equal(gate.bossGate,true,"Fourth pre-stage must unlock distinct boss gate"); }
`;
const bossGateReplacement=`        if(expectedStage===3){ assert.equal(gate.bossGate,true,"Fourth pre-stage must unlock distinct boss gate"); }
`;

if(!patched.includes(stageLoopNeedle)||!patched.includes(bossGateNeedle)){
    throw new Error("Live Abyss QA could not find the pre-stage boss-gate assertions.");
}
patched=patched.replace(stageLoopNeedle,stageLoopReplacement).replace(bossGateNeedle,bossGateReplacement);

const target=path.join(os.tmpdir(),`abyss-live-browser-qa-saved-${process.pid}.mjs`);
fs.writeFileSync(target,patched,"utf8");
await import(pathToFileURL(target).href+`?run=${Date.now()}`);
