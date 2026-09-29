import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd();
const artifactDir=path.join(root,"artifacts/browser-qa");
const fixture=path.join(root,".fire-portrait-browser-qa.html");
const provenance=JSON.parse(fs.readFileSync(path.join(root,"config/monster-asset-provenance.json"),"utf8"));
const records=provenance.assets.filter(asset=>asset.runtimeReady);

function chrome(){
    for(const candidate of [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,"google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        if(!candidate) continue;
        const probe=spawnSync("bash",["-lc",`command -v ${candidate}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()) return probe.stdout.trim();
    }
    throw new Error("Headless Chrome/Chromium is required for fire portrait browser QA.");
}

const html=[
    "<!doctype html><meta charset=\"utf-8\"><pre id=\"result\"></pre>",
    "<script>",
    "window.__fireQa={pending:true,errors:[],decoded:[],resolved:[],battleApplied:0};",
    "window.__resultNode=document.querySelector('#result');",
    "window.__firePortraitRegistry="+JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,"config/monster-portrait-registry.json"),"utf8")))+";",
    "window.currentBattleMonsters=[];window.monsters=[];window.autoBattle=false;window.updateAutoButton=()=>{};window.openAutoBattleSettings=()=>{};window.closeAutoBattleSettings=()=>{};window.openHomeFeature=()=>{};window.closeHomeFeature=()=>{};window.applyPostBattleAutoRecovery=()=>{};window.confirmAutoBattleSettings=()=>{};window.toggleAutoBattle=()=>{};",
    "window.FourSymbolsBattlePresentation={applyUnit(card){card.dataset.presentation='v154';window.__fireQa.battleApplied++;}};",
    "</script><script src=\"js/45-v154-dev-fixes.js\"></script><script>",
    "(async()=>{try{const rows="+JSON.stringify(records)+";window.v154InstallMonsterPortraitRegistry(window.__firePortraitRegistry);for(const item of rows){const monster={name:item.displayName,portraitKey:item.portraitKey,element:'fire'};window.monsters.push(monster);window.currentBattleMonsters.push(window.monsters.length-1);const card=document.createElement('div');card.id='battleMonster'+(window.monsters.length-1);document.body.appendChild(card);const record=window.v154ResolveMonsterPortraitRecord(monster);if(!record||record.path!==item.runtime.path||record.status!=='existing')throw new Error('registry resolution mismatch: '+item.monsterId);await new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=async()=>{try{if(image.decode)await image.decode();window.__fireQa.decoded.push({monsterId:item.monsterId,path:item.runtime.path,width:image.naturalWidth,height:image.naturalHeight});resolve();}catch(error){reject(error);}};image.onerror=()=>reject(new Error('browser image load failed: '+item.runtime.path));image.src=item.runtime.path;});window.__fireQa.resolved.push({monsterId:item.monsterId,path:record.path});}window.v154SyncMonsterPortraits();await new Promise(resolve=>setTimeout(resolve,250));window.__fireQa.pending=false;}catch(error){window.__fireQa.errors.push(String(error&&error.stack||error));window.__fireQa.pending=false;}window.__resultNode.textContent=JSON.stringify(window.__fireQa);})();",
    "</script>"
].join("\n");

fs.mkdirSync(artifactDir,{recursive:true});
fs.writeFileSync(fixture,html);
try{
    const base=String(process.env.DEV_BASE_URL||"").replace(/\/$/,"");
    if(!base) throw new Error("DEV_BASE_URL is required.");
    const result=spawnSync(chrome(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=20000","--dump-dom",base+"/.fire-portrait-browser-qa.html"],{encoding:"utf8",timeout:45000,maxBuffer:32*1024*1024});
    if(result.status!==0) throw new Error(result.stderr||`Chrome exited with ${result.status}`);
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"fire portrait browser QA did not produce evidence");
    const evidence=JSON.parse(match[1]);
    fs.writeFileSync(path.join(artifactDir,"fire-portrait-browser-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    assert.deepEqual(evidence.errors,[]);
    assert.equal(evidence.pending,false);
    assert.equal(evidence.resolved.length,18);
    assert.equal(evidence.decoded.length,18);
    assert.ok(evidence.decoded.every(item=>item.width===1024&&item.height===1536));
    assert.equal(evidence.battleApplied,18);
    console.log("Fire portrait browser/battle runtime QA passed: 18/18 decoded and V154 applied.");
}finally{ try{fs.unlinkSync(fixture);}catch{} }
