import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const ROOT=process.cwd();
const FIXTURE=path.join(ROOT,".fire-tower-identity-first-frame-qa.html");
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");
const escapeScript=value=>value.replace(/<\/script/gi,"<\\/script");

function findChrome(){
    const configured=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
    if(configured&&fs.existsSync(configured)){ return configured; }
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc","command -v "+name],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for Fire Tower browser QA.");
}

const registry=read("config/monster-portrait-registry.json");
const v154=escapeScript(read("js/45-v154-dev-fixes.js"));
const tower=escapeScript(read("js/gameplay-boss-tower-system.js"));
const expected=JSON.parse(registry).assetPool.entries
    .filter(entry=>entry.element==="fire"&&entry.status==="adopted")
    .reduce((map,entry)=>{map[entry.assetId]=entry;return map;},{});
const floors=[1,5,10,50,100];
const fixture=[
"<!doctype html><meta charset=\"utf-8\"><div id=\"battleMonsterArea\"></div><pre id=\"result\"></pre>",
"<script>",
"window.__fireTowerQa={pending:true,visibleFrames:[],errors:[],floors:"+JSON.stringify(floors)+"};",
"window.FourSymbolsAccountSave={getActiveUid:()=>\"browser-qa\",saveKey:uid=>\"save:\"+uid,readForUid:()=>({status:\"missing\"})};",
"window.v132DungeonRankMultipliers={elite:{maxHP:3.2,defense:1.25},boss:{maxHP:4.5,defense:1.4}};",
"window.v132BuildDungeonMonster=(name,level,element,rank)=>({name,level,element,rank,alive:true,hp:1000,maxHP:1000,attack:100,magicAttack:100,defense:100,skillChance:.4});",
"window.FourSymbolsFeatures={ensureAssets:paths=>Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error(\"decode failed: \"+path));image.src=path;})))};",
"window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve("+registry+")});",
"window.v132LaunchDungeonBattle=(roster)=>{const area=document.getElementById(\"battleMonsterArea\");area.textContent=\"\";roster.forEach(monster=>{const card=document.createElement(\"article\");card.className=\"battle-monster\";card.dataset.portraitKey=monster.portraitKey||\"\";const image=document.createElement(\"img\");const record=window.v154ResolveMonsterPortraitRecord(monster);image.src=record&&record.path||\"\";image.alt=monster.displayName||monster.name;const name=document.createElement(\"div\");name.className=\"battle-monster-name\";name.textContent=monster.displayName||monster.name;card.append(image,name);area.append(card);});const cards=[...area.querySelectorAll(\".battle-monster\")];const ready=cards.every(card=>{const image=card.querySelector(\"img\");return image.complete&&image.naturalWidth>0&&!!card.querySelector(\".battle-monster-name\").textContent;});window.__fireTowerQa.visibleFrames.push({floor:window.__fireTowerQa.floor,ready,cards:cards.map(card=>({name:card.querySelector(\".battle-monster-name\").textContent,portraitKey:card.dataset.portraitKey,complete:card.querySelector(\"img\").complete,naturalWidth:card.querySelector(\"img\").naturalWidth}))});document.documentElement.dataset.battleVisible=\"true\";return true;};",
"window.showPage=()=>{};window.renderBattle=()=>{};window.updateUI=()=>{};window.saveGame=()=>{};window.v133GetHighestCreatedCharacterLevel=()=>100;window.v132GetContentDefinitions=()=>({ores:[]});window.getExistingPartyIndexes=()=>[];window.getPartyCharacterByIndex=()=>null;window.v141ShowBlackGoldReward=()=>{};window.rebuildInventorySlots=()=>{};window.updateGoldDisplay=()=>{};",
"</script><script>"+v154+"</script><script>"+tower+"</script><script>",
"(async()=>{try{const monday=window.GameplaySystem.getWeekInfo(new Date()).key;for(const floor of window.__fireTowerQa.floors){window.__fireTowerQa.floor=floor;document.documentElement.removeAttribute(\"data-battle-visible\");document.getElementById(\"battleMonsterArea\").textContent=\"\";window.GameplaySystem.debugReloadState({tower:{weekKey:monday,element:\"fire\",completedFloor:floor-1}},new Date());const launch=window.vGameplaySelectTowerBand(floor);if(launch!==true)throw new Error(\"tower launcher API changed at floor \"+floor);await new Promise(resolve=>setTimeout(resolve,120));if(document.documentElement.dataset.battleVisible!==\"true\")throw new Error(\"battle did not become visible at floor \"+floor);const frame=window.__fireTowerQa.visibleFrames.at(-1);if(!frame.ready)throw new Error(\"first visible frame is not portrait-ready at floor \"+floor);}}catch(error){window.__fireTowerQa.errors.push(String(error&&error.stack||error));}window.__fireTowerQa.pending=false;document.getElementById(\"result\").textContent=JSON.stringify(window.__fireTowerQa);})();",
"</script>"
].join("\n");

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
fs.writeFileSync(FIXTURE,fixture);
try{
    const chrome=findChrome();
    const base=String(process.env.DEV_BASE_URL||"").trim();
    if(!base){ throw new Error("DEV_BASE_URL is required."); }
    const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=412,915","--virtual-time-budget=10000","--dump-dom",base+"/.fire-tower-identity-first-frame-qa.html"],{encoding:"utf8",timeout:30000,maxBuffer:32*1024*1024});
    if(result.status!==0){ throw new Error(result.stderr||"Chrome exited with "+result.status); }
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"Fire Tower browser QA did not produce a result.");
    const evidence=JSON.parse(match[1]);
    assert.deepEqual(evidence.errors,[]);
    assert.equal(evidence.pending,false);
    assert.equal(evidence.visibleFrames.length,floors.length);
    const expectedNames={};
    for(const frame of evidence.visibleFrames){
        assert.equal(frame.ready,true);
        frame.cards.forEach(card=>{
            const record=expected[card.portraitKey];
            assert.ok(record,card.portraitKey);
            assert.equal(card.name,record.displayName);
            assert.equal(card.complete,true);
            assert.ok(card.naturalWidth>0);
            expectedNames[frame.floor]=expectedNames[frame.floor]||card.name;
        });
    }
    assert.equal(expectedNames[100],"焰冠獅魁");
    fs.writeFileSync(path.join(ARTIFACT_DIR,"fire-tower-identity-first-frame-browser-qa.json"),JSON.stringify({floors,evidence},null,2)+"\n");
    console.log("Fire Tower identity / first-frame browser QA passed:",JSON.stringify(expectedNames));
}finally{
    try{fs.unlinkSync(FIXTURE);}catch(_){}
}
