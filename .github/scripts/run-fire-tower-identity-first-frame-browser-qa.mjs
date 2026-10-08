import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {spawn,spawnSync} from "node:child_process";
import {Cdp,waitJson} from "./runtime-browser-qa-support.mjs";

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

const requestedElement=String(process.env.TOWER_QA_ELEMENT||"fire").toLowerCase();
const element=["fire","wind","earth"].includes(requestedElement)?requestedElement:"fire";
// Tower element follows the actual UTC week; pin this fixture to a matching week.
const fixtureNow={fire:"2026-10-26T12:00:00.000Z",earth:"2026-10-05T12:00:00.000Z",wind:"2026-10-19T12:00:00.000Z"}[element];
const registry=read("config/monster-portrait-registry.json");
const v154=escapeScript(read("js/45-v154-dev-fixes.js"));
const tower=escapeScript(read("js/gameplay-boss-tower-system.js"));
const core=read("js/00-main.js"),ownerEnd="/* END GENERATED MONSTER BALANCE OWNER */";
assert.ok(core.startsWith("/* BEGIN GENERATED MONSTER BALANCE OWNER */")&&core.includes(ownerEnd),"formal generated MonsterBalance owner missing");
const balanceOwner=escapeScript(core.slice(0,core.indexOf(ownerEnd)+ownerEnd.length));
const expected=JSON.parse(registry).assetPool.entries
    .filter(entry=>entry.element===element&&entry.status==="adopted")
    .reduce((map,entry)=>{map[entry.assetId]=entry;return map;},{});
const floors=element==="earth"?[1,5,10,50,90]:[1,5,10,50,100];
const fixture=[
"<!doctype html><meta charset=\"utf-8\"><div id=\"battleMonsterArea\"></div><pre id=\"result\"></pre>",
"<script>",
"{const NativeDate=Date;const fixed=NativeDate.parse("+JSON.stringify(fixtureNow)+");window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};}",
"window.__fireTowerQa={pending:true,visibleFrames:[],errors:[],ownerChecks:0,legacyCalls:0,floors:"+JSON.stringify(floors)+"};",
"window.FourSymbolsAccountSave={getActiveUid:()=>\"browser-qa\",saveKey:uid=>\"save:\"+uid,readForUid:()=>({status:\"missing\"})};",
"window.v132DungeonRankMultipliers={elite:{maxHP:3.2,defense:1.25},boss:{maxHP:4.5,defense:1.4}};",
"window.v132BuildDungeonMonster=(name,level,element,rank)=>{window.__fireTowerQa.legacyCalls++;return {name,level,element,rank,alive:true,hp:1000,maxHP:1000,attack:100,magicAttack:100,defense:100,skillChance:.4};};",
"window.__decodedPortraits={};window.__assetPaths=[];window.__assetErrors=[];window.FourSymbolsFeatures={ensureAssets:paths=>{window.__assetPaths.push(...paths);return Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{window.__decodedPortraits[path]=true;resolve();};image.onerror=()=>{window.__assetErrors.push(path);reject(new Error(\"decode failed: \"+path));};image.src=path;})))}};",
"window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve("+registry+")});",
"window.v132LaunchDungeonBattle=(roster)=>{for(const monster of roster){const p=window.MonsterBalance.debug(monster),floor=window.__fireTowerQa.floor;if(monster.balanceOwner!=='MonsterBalance'||monster.mode!=='tower'||monster.level!==floor||monster.context!=='tower/floor/'+floor||Object.hasOwn(monster,'v132Dungeon')||Object.hasOwn(monster,'v132EquipmentDungeon'))throw new Error('Tower owner identity mismatch');for(const [runtime,projection] of Object.entries({maxHP:'maxHP',maxSP:'maxSP',attack:'physicalAttack',magicAttack:'magicAttack',defense:'defense',agility:'speed'})){if(monster[runtime]!==p.final[projection])throw new Error('Tower stat projection mismatch: '+runtime);}window.__fireTowerQa.ownerChecks++;}const area=document.getElementById(\"battleMonsterArea\");area.textContent=\"\";roster.forEach(monster=>{const card=document.createElement(\"article\");card.className=\"battle-monster\";card.dataset.portraitKey=monster.portraitKey||\"\";const image=document.createElement(\"img\");const record=window.v154ResolveMonsterPortraitRecord(monster);image.src=record&&record.path||\"\";image.alt=monster.displayName||monster.name;card.dataset.portraitDecodeReady=record&&window.__decodedPortraits[record.path]===true?\"true\":\"false\";const name=document.createElement(\"div\");name.className=\"battle-monster-name\";name.textContent=monster.displayName||monster.name;card.append(image,name);area.append(card);});const cards=[...area.querySelectorAll(\".battle-monster\")];const ready=cards.every(card=>card.dataset.portraitDecodeReady===\"true\"&&!!card.querySelector(\".battle-monster-name\").textContent);window.__fireTowerQa.visibleFrames.push({floor:window.__fireTowerQa.floor,ready,cards:cards.map(card=>({name:card.querySelector(\".battle-monster-name\").textContent,portraitKey:card.dataset.portraitKey,decodeReady:card.dataset.portraitDecodeReady,complete:card.querySelector(\"img\").complete,naturalWidth:card.querySelector(\"img\").naturalWidth}))});document.documentElement.dataset.battleVisible=\"true\";return true;};",
"window.showPage=()=>{};window.renderBattle=()=>{};window.updateUI=()=>{};window.saveGame=()=>{};window.v133GetHighestCreatedCharacterLevel=()=>100;window.v132GetContentDefinitions=()=>({ores:[]});window.getExistingPartyIndexes=()=>[];window.getPartyCharacterByIndex=()=>null;window.v141ShowBlackGoldReward=()=>{};window.rebuildInventorySlots=()=>{};window.updateGoldDisplay=()=>{};",
"</script><script>"+balanceOwner+"</script><script>"+v154+"</script><script>window.__originalPrepare=window.v154PreparePortraitsForEncounter;window.v154PreparePortraitsForEncounter=(monsters)=>{window.__fireTowerQa.prepareCalls=(window.__fireTowerQa.prepareCalls||0)+1;const prepared=window.__originalPrepare(monsters);window.__portraitPreparation=prepared;return prepared;};</script><script>"+tower+"</script><script>",
"(async()=>{try{const week=window.GameplaySystem.getWeekInfo(new Date());if(week.element!==\""+element+"\")throw new Error(\"fixture week element mismatch\");const monday=week.key;for(const floor of window.__fireTowerQa.floors){for(let pass=0;pass<2;pass++){window.__fireTowerQa.floor=floor;document.documentElement.removeAttribute(\"data-battle-visible\");document.getElementById(\"battleMonsterArea\").textContent=\"\";window.GameplaySystem.debugReloadState({tower:{weekKey:monday,element:\""+element+"\",completedFloor:floor-1}},new Date());const launch=window.vGameplaySelectTowerBand(floor);if(launch!==true)throw new Error(\"tower launcher API changed at floor \"+floor);await window.__portraitPreparation;await Promise.resolve();if(document.documentElement.dataset.battleVisible!==\"true\")throw new Error(\"battle did not become visible at floor \"+floor);const frame=window.__fireTowerQa.visibleFrames.at(-1);if(!frame.ready)throw new Error(\"first visible frame is not portrait-ready at floor \"+floor);}}}catch(error){window.__fireTowerQa.errors.push(String(error&&error.stack||error));}window.__fireTowerQa.prepareCalls=window.__fireTowerQa.prepareCalls||0;window.__fireTowerQa.assetPaths=window.__assetPaths;window.__fireTowerQa.assetErrors=window.__assetErrors;window.__fireTowerQa.pending=false;document.getElementById(\"result\").textContent=JSON.stringify(window.__fireTowerQa);})();",
"</script>"
].join("\n");

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
fs.writeFileSync(FIXTURE,fixture);
let browser,client,profile,deadlineTimer;
try{
    const chrome=findChrome();
    const base=String(process.env.DEV_BASE_URL||"").trim();
    if(!base){ throw new Error("DEV_BASE_URL is required."); }
    // Image preparation is asynchronous. Wait for the formal owner and the
    // actual fixture result rather than advancing Chrome's virtual clock.
    const started=Date.now(),port=9800+Math.floor(Math.random()*200);
    profile=fs.mkdtempSync(path.join(os.tmpdir(),"tower-first-frame-"));
    let launchError="";
    browser=spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=412,915","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"],{stdio:["ignore","ignore","pipe"]});
    browser.stderr.on("data",chunk=>{launchError=(launchError+chunk).slice(-4000);});
    browser.on("error",error=>{launchError=String(error);});
    const collectResult=async()=>{
        const pages=await waitJson("http://127.0.0.1:"+port+"/json/list");
        client=new Cdp(pages.find(page=>page.type==="page").webSocketDebuggerUrl);
        await client.send("Page.enable");await client.send("Runtime.enable");
        await client.send("Page.navigate",{url:base+"/.fire-tower-identity-first-frame-qa.html"});
        let result="";
        while(!result&&Date.now()-started<30000){
            result=await client.eval("document.getElementById('result')?.textContent||''");
            if(!result)await new Promise(resolve=>setTimeout(resolve,50));
        }
        return result;
    };
    const result=await Promise.race([collectResult(),new Promise((_,reject)=>{
        deadlineTimer=setTimeout(()=>reject(new Error("Fire Tower browser QA exceeded its 30-second deadline. "+launchError)),30000);
    })]);
    assert.ok(result,"Fire Tower browser QA did not produce a result within 30 seconds. "+launchError);
    const evidence=JSON.parse(result);
    fs.writeFileSync(path.join(ARTIFACT_DIR,element+"-tower-identity-first-frame-browser-qa.json"),JSON.stringify({floors,evidence},null,2)+"\n");
    assert.deepEqual(evidence.errors,[]);
    assert.equal(evidence.pending,false);
    assert.equal(evidence.legacyCalls,0,"Tower fixture must not call V132 stat owner");
    assert.equal(evidence.ownerChecks,floors.length*2*10);
    assert.equal(evidence.visibleFrames.length,floors.length*2);
    const expectedNames={};
    for(const frame of evidence.visibleFrames){
        assert.equal(frame.ready,true);
        assert.equal(frame.cards.length,10);
        frame.cards.forEach(card=>{
            const record=expected[card.portraitKey];
            assert.ok(record,card.portraitKey);
            assert.equal(card.name,record.displayName);
            assert.equal(card.decodeReady,"true");
            expectedNames[frame.floor]=expectedNames[frame.floor]||card.name;
        });
    }
    const finalExpected={fire:"焰冠獅魁",wind:"風極真君",earth:"磐山帝君"}[element];
    assert.equal(expectedNames[element==="earth"?90:100],finalExpected);
    console.log("Fire Tower identity / first-frame browser QA passed:",JSON.stringify(expectedNames));
}finally{
    clearTimeout(deadlineTimer);
    client?.close();
    if(browser){browser.kill("SIGTERM");await new Promise(resolve=>{browser.once("close",resolve);setTimeout(resolve,1000);});}
    if(profile){try{fs.rmSync(profile,{recursive:true,force:true});}catch(_){}}
    try{fs.unlinkSync(FIXTURE);}catch(_){}
}
