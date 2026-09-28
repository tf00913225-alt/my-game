import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const ROOT=process.cwd();
const FIXTURE=path.join(ROOT,".daily-dungeon-webp-browser-qa.html");
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
    throw new Error("Headless Chrome/Chromium is required for Daily Dungeon WebP browser QA.");
}

const registry=read("config/monster-portrait-registry.json");
const v154=escapeScript(read("js/45-v154-dev-fixes.js"));
const expected=JSON.parse(registry).groups.daily.map(row=>({
    portraitKey:row[0],name:row[1],path:row[5],status:row[6]
}));
const types=["exp","material","gold"];
const fixture=[
"<!doctype html><meta charset=\"utf-8\"><pre id=\"result\"></pre>",
"<script>",
"window.__dailyQa={pending:true,errors:[],preparations:[],decoded:[],resolved:[]};",
"window.currentBattleMonsters=[];window.monsters=[];",
"window.document.getElementById=id=>id===\"result\"?document.querySelector(\"#result\"):null;",
"window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve("+registry+")});",
"window.FourSymbolsFeatures={ensureAssets:paths=>Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.decoding=\"async\";image.onload=()=>{Promise.resolve(typeof image.decode===\"function\"?image.decode():undefined).then(()=>{window.__dailyQa.decoded.push({path,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight});resolve();},reject);};image.onerror=()=>reject(new Error(\"browser image load failed: \"+path));image.src=path;})))};",
"</script><script>"+v154+"</script><script>",
"(async()=>{try{const expected="+JSON.stringify(expected)+";for(const type of "+JSON.stringify(types)+"){const prepared=await window.v154PrepareDailyDungeonPortraits(type);window.__dailyQa.preparations.push({type,state:prepared&&prepared.state,keys:prepared&&prepared.keys,paths:prepared&&prepared.paths,failures:prepared&&prepared.failures});if(!prepared||prepared.state!==\"ready\")throw new Error(\"daily \"+type+\" preparation was not ready\");for(const rank of [\"regular\",\"elite\",\"boss\"]){const monster={name:type,portraitKey:\"daily.\"+type+\".\"+rank,element:\"dynamic\",rank:rank};const record=window.v154ResolveMonsterPortraitRecord(monster);if(!record||record.status!==\"existing\")throw new Error(\"missing runtime record for \"+monster.portraitKey);window.__dailyQa.resolved.push({type,rank,portraitKey:monster.portraitKey,path:record.path,status:record.status});}}for(const row of expected){const image=new Image();image.src=row.path;await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(\"direct image load failed: \"+row.path));});if(typeof image.decode===\"function\")await image.decode();if(!image.complete||image.naturalWidth<=0||image.naturalHeight<=0)throw new Error(\"decoded image has no dimensions: \"+row.path);}window.__dailyQa.expected=expected;window.__dailyQa.pending=false;}catch(error){window.__dailyQa.errors.push(String(error&&error.stack||error));window.__dailyQa.pending=false;}document.getElementById(\"result\").textContent=JSON.stringify(window.__dailyQa);})();",
"</script>"
].join("\n");

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
fs.writeFileSync(FIXTURE,fixture);
try{
    const chrome=findChrome();
    const base=String(process.env.DEV_BASE_URL||"").trim();
    if(!base){ throw new Error("DEV_BASE_URL is required."); }
    const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--window-size=412,915","--virtual-time-budget=15000","--dump-dom",base+"/.daily-dungeon-webp-browser-qa.html"],{encoding:"utf8",timeout:40000,maxBuffer:32*1024*1024});
    if(result.status!==0){ throw new Error(result.stderr||"Chrome exited with "+result.status); }
    const match=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"Daily Dungeon WebP browser QA did not produce a result.");
    const evidence=JSON.parse(match[1]);
    fs.writeFileSync(path.join(ARTIFACT_DIR,"daily-dungeon-webp-browser-qa.json"),JSON.stringify(evidence,null,2)+"\\n");
    assert.deepEqual(evidence.errors,[]);
    assert.equal(evidence.pending,false);
    assert.equal(evidence.preparations.length,3);
    assert.ok(evidence.preparations.every(row=>row.state==="ready"&&row.failures.length===0));
    assert.equal(evidence.resolved.length,9);
    assert.equal(evidence.decoded.length,9);
    for(const row of evidence.decoded){
        assert.equal(row.complete,true,row.path);
        assert.ok(row.naturalWidth>0,row.path);
        assert.ok(row.naturalHeight>0,row.path);
    }
    assert.deepEqual(evidence.resolved.map(row=>row.portraitKey).sort(),expected.map(row=>row.portraitKey).sort());
    console.log("Daily Dungeon WebP browser decode/lifecycle QA passed: 9/9 runtime portraits, 3/3 preparations.");
}finally{
    try{fs.unlinkSync(FIXTURE);}catch(_){}
}
