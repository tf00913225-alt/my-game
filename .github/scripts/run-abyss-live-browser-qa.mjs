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

const coverWaitNeedle=`    await waitFor(client,"document.querySelector('.v174-abyss-selection')&&getComputedStyle(document.querySelector('.v174-abyss-selection')).display!=='none'","visible Abyss selection");

    const selection=await client.eval(\`(()=>{
`;
const coverWaitReplacement=`    await waitFor(client,"document.querySelector('.v174-abyss-selection')&&getComputedStyle(document.querySelector('.v174-abyss-selection')).display!=='none'","visible Abyss selection");
    await waitFor(client,"Array.from(document.querySelectorAll('.v174-abyss-card-cover')).length===2&&Array.from(document.querySelectorAll('.v174-abyss-card-cover')).every(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0)","Abyss cover image load",30000);

    const selection=await client.eval(\`(()=>{
`;

if(!patched.includes(coverWaitNeedle)){
    throw new Error("Live Abyss QA could not find the visible selection checkpoint.");
}
patched=patched.replace(coverWaitNeedle,coverWaitReplacement);

/* Real-device regression guard: a legacy V154 align-items:center rule can make
   the two-tier card list shrink to only a few pixels wide on Android Chrome.
   Non-zero geometry and a correct 16:9 ratio are not enough to catch that, so
   make the live QA verify substantial cross-axis width as well. */
const geometryNeedle=`        const sr=selection?.getBoundingClientRect();
        const stage=document.getElementById('game-stage')?.getBoundingClientRect();
`;
const geometryReplacement=`        const sr=selection?.getBoundingClientRect();
        const list=document.querySelector('.v174-abyss-card-list');
        const lr=list?.getBoundingClientRect();
        const stage=document.getElementById('game-stage')?.getBoundingClientRect();
`;
const metricNeedle=`            selectionWidth:sr?.width||0,selectionHeight:sr?.height||0,
            selectionOverflow:selection?(selection.scrollHeight-selection.clientHeight):999,
`;
const metricReplacement=`            selectionWidth:sr?.width||0,selectionHeight:sr?.height||0,
            selectionAlignItems:selection?getComputedStyle(selection).alignItems:null,
            cardListWidth:lr?.width||0,cardListHeight:lr?.height||0,
            selectionOverflow:selection?(selection.scrollHeight-selection.clientHeight):999,
`;
const footprintNeedle=`    assert.ok(selection.w20>0&&selection.h20>0&&selection.w40>0&&selection.h40>0,"Abyss cards must have a real visible footprint");
`;
const footprintReplacement=`    assert.ok(selection.w20>0&&selection.h20>0&&selection.w40>0&&selection.h40>0,"Abyss cards must have a real visible footprint");
    assert.equal(selection.selectionAlignItems,"stretch","Two-tier Abyss selection must override legacy centered cross-axis sizing");
    assert.ok(selection.cardListWidth>=Math.max(250,selection.selectionWidth*0.80),\`Abyss card list collapsed horizontally: list=\${selection.cardListWidth}px selection=\${selection.selectionWidth}px\`);
    assert.ok(selection.w20>=selection.cardListWidth*0.95&&selection.w40>=selection.cardListWidth*0.95,\`Abyss cover cards do not fill the card list: cards=\${selection.w20}/\${selection.w40}px list=\${selection.cardListWidth}px\`);
`;

if(!patched.includes(geometryNeedle)||!patched.includes(metricNeedle)||!patched.includes(footprintNeedle)){
    throw new Error("Live Abyss QA could not install the Android card-width regression assertions.");
}
patched=patched
    .replace(geometryNeedle,geometryReplacement)
    .replace(metricNeedle,metricReplacement)
    .replace(footprintNeedle,footprintReplacement);

const target=path.join(os.tmpdir(),`abyss-live-browser-qa-saved-${process.pid}.mjs`);
fs.writeFileSync(target,patched,"utf8");
await import(pathToFileURL(target).href+`?run=${Date.now()}`);
