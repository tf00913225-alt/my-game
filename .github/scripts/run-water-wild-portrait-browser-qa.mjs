import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd();
const artifactDir=path.join(root,"artifacts/browser-qa");
const fixture=path.join(root,".water-wild-portrait-browser-qa.html");
const provenance=JSON.parse(fs.readFileSync(path.join(root,"config/monster-asset-provenance.json"),"utf8"));
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/monster-portrait-registry.json"),"utf8"));
const records=provenance.assets.filter(asset=>asset.runtimeReady&&/^wild\.zone-\d+\.water-01$/.test(asset.portraitKey));

function chrome(){
    for(const candidate of [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,"google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        if(!candidate) continue;
        const probe=spawnSync("bash",["-lc",`command -v ${candidate}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()) return probe.stdout.trim();
    }
    throw new Error("Headless Chrome/Chromium is required for water wild portrait browser QA.");
}

assert.equal(records.length,10,"water browser QA requires exactly ten batch-1 records");
const html=[
    "<!doctype html><meta charset=\"utf-8\"><pre id=\"result\"></pre>",
    "<script>",
    "window.__qa={pending:true,errors:[],decoded:[],firstFrame:[],redraw:[],battleApplied:0};",
    "window.__resultNode=document.querySelector('#result');",
    "window.__registry="+JSON.stringify(registry)+";",
    "window.currentBattleMonsters=[];window.monsters=[];window.autoBattle=false;window.updateAutoButton=()=>{};window.openAutoBattleSettings=()=>{};window.closeAutoBattleSettings=()=>{};window.openHomeFeature=()=>{};window.closeHomeFeature=()=>{};window.applyPostBattleAutoRecovery=()=>{};window.confirmAutoBattleSettings=()=>{};window.toggleAutoBattle=()=>{};",
    "window.FourSymbolsBattlePresentation={applyUnit(card){card.dataset.presentation='v154';window.__qa.battleApplied++;}};",
    "</script><script src=\"js/45-v154-dev-fixes.js\"></script><script>",
    "(async()=>{try{const rows="+JSON.stringify(records)+";window.v154InstallMonsterPortraitRegistry(window.__registry);for(const item of rows){const monster={name:item.displayName,portraitKey:item.portraitKey,element:'water'};window.monsters.push(monster);window.currentBattleMonsters.push(window.monsters.length-1);const card=document.createElement('div');card.id='battleMonster'+(window.monsters.length-1);document.body.appendChild(card);const record=window.v154ResolveMonsterPortraitRecord(monster);if(!record||record.path!==item.runtime.path||record.status!=='existing'||record.element!=='water')throw new Error('registry resolution mismatch: '+item.monsterId);await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{if(!image.complete||image.naturalWidth!==1024||image.naturalHeight!==1536){reject(new Error('browser image dimensions mismatch: '+item.runtime.path));return;}window.__qa.decoded.push({monsterId:item.monsterId,path:item.runtime.path,width:image.naturalWidth,height:image.naturalHeight});resolve();};image.onerror=()=>reject(new Error('browser image load failed: '+item.runtime.path));image.src=item.runtime.path;});}window.v154SyncMonsterPortraits();window.__qa.firstFrame=window.currentBattleMonsters.map(index=>{const card=document.getElementById('battleMonster'+index);return {key:card.dataset.monsterPortraitKey,path:card.dataset.monsterPortraitPath,css:card.style.getPropertyValue('--v152-abyss-portrait')};});window.v154SyncMonsterPortraits();window.__qa.redraw=window.currentBattleMonsters.map(index=>{const card=document.getElementById('battleMonster'+index);return {key:card.dataset.monsterPortraitKey,path:card.dataset.monsterPortraitPath};});const fire=window.v154ResolveMonsterPortraitRecord({name:'哥布林',portraitKey:'wild.zone-01.fire-01',element:'fire'});const wind=window.v154ResolveMonsterPortraitRecord({name:'風芽魈',portraitKey:'wild.zone-01.wind-01',element:'wind'});window.__qa.isolation={fire:fire&&fire.path,wind:wind&&wind.path};await new Promise(resolve=>setTimeout(resolve,100));window.__qa.pending=false;}catch(error){window.__qa.errors.push(String(error&&error.stack||error));window.__qa.pending=false;}window.__resultNode.textContent=JSON.stringify(window.__qa);})();",
    "</script>"
].join("\n");

fs.mkdirSync(artifactDir,{recursive:true});
fs.writeFileSync(fixture,html);
try{
    const base=String(process.env.DEV_BASE_URL||"").replace(/\/$/,"");
    if(!base) throw new Error("DEV_BASE_URL is required.");
    const result=spawnSync(chrome(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--virtual-time-budget=20000","--dump-dom",base+"/.water-wild-portrait-browser-qa.html"],{encoding:"utf8",timeout:45000,maxBuffer:32*1024*1024});
    if(result.status!==0) throw new Error(result.stderr||`Chrome exited with ${result.status}`);
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"water wild portrait browser QA did not produce evidence");
    const evidence=JSON.parse(match[1]);
    fs.writeFileSync(path.join(artifactDir,"water-wild-portrait-browser-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    assert.deepEqual(evidence.errors,[]);
    assert.equal(evidence.pending,false);
    assert.equal(evidence.decoded.length,10);
    assert.equal(evidence.firstFrame.length,10);
    assert.equal(evidence.redraw.length,10);
    assert.ok(evidence.firstFrame.every(item=>item.path&&item.css.includes(item.path)),"first frame must carry the resolved water path");
    assert.deepEqual(evidence.redraw.map(item=>item.path),evidence.firstFrame.map(item=>item.path));
    assert.match(evidence.isolation.fire,/\/fire-01\.webp$/);
    assert.match(evidence.isolation.wind,/\/wind-01\.webp$/);
    assert.ok(evidence.battleApplied>=20,"V154 must apply first frame and redraw for all ten water cards");
    console.log("Water wild portrait browser QA passed: 10/10 decoded, first-frame and redraw; fire/wind isolated.");
}finally{ try{fs.unlinkSync(fixture);}catch{} }
