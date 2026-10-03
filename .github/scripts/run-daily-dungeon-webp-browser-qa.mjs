import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {spawn,spawnSync} from "node:child_process";
import {startServer,waitJson,Cdp} from "./runtime-browser-qa-support.mjs";

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
"window.__resultNode=document.querySelector(\"#result\");",
"window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve("+registry+")});",
"window.FourSymbolsFeatures={ensureAssets:paths=>Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.decoding=\"async\";image.onload=()=>{if(typeof image.decode===\"function\"){image.decode().catch(()=>{});}window.__dailyQa.decoded.push({path,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight});resolve();};image.onerror=()=>reject(new Error(\"browser image load failed: \"+path));image.src=path;})))};",
"</script><script>"+v154+"</script><script>",
"(async()=>{try{const expected="+JSON.stringify(expected)+";for(const type of "+JSON.stringify(types)+"){const prepared=await window.v154PrepareDailyDungeonPortraits(type);window.__dailyQa.preparations.push({type,state:prepared&&prepared.state,keys:prepared&&prepared.keys,paths:prepared&&prepared.paths,failures:prepared&&prepared.failures});if(!prepared||prepared.state!==\"ready\")throw new Error(\"daily \"+type+\" preparation was not ready\");for(const rank of [\"regular\",\"elite\",\"boss\"]){const monster={name:type,portraitKey:\"daily.\"+type+\".\"+rank,element:\"dynamic\",rank:rank};const record=window.v154ResolveMonsterPortraitRecord(monster);if(!record||record.status!==\"existing\")throw new Error(\"missing runtime record for \"+monster.portraitKey);window.__dailyQa.resolved.push({type,rank,portraitKey:monster.portraitKey,path:record.path,status:record.status});}}for(const row of expected){const image=new Image();image.src=row.path;await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(\"direct image load failed: \"+row.path));});if(typeof image.decode===\"function\")image.decode().catch(()=>{});if(!image.complete||image.naturalWidth<=0||image.naturalHeight<=0)throw new Error(\"decoded image has no dimensions: \"+row.path);}window.__dailyQa.expected=expected;await new Promise(resolve=>setTimeout(resolve,250));window.__dailyQa.pending=false;}catch(error){window.__dailyQa.errors.push(String(error&&error.stack||error));window.__dailyQa.pending=false;}window.__resultNode.textContent=JSON.stringify(window.__dailyQa);})();",
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
    fs.writeFileSync(path.join(ARTIFACT_DIR,"daily-dungeon-webp-browser-qa.json"),JSON.stringify(evidence,null,2)+"\n");
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

/* Keep the existing decode evidence, then verify the real production index,
   feature loader, launch/wave lifecycle and V154 -> V174 artwork surface.
   Only the shared read-only QA account transport is isolated. No portrait,
   render, launch or geometry owner is replaced by the fixture. */
const PREPARE_RUNTIME=`(async()=>{
    const wait=async test=>{const until=performance.now()+30000;while(!test()&&performance.now()<until)await new Promise(r=>setTimeout(r,40));if(!test())throw Error('Daily Runtime readiness timeout: '+test);};
    await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY');
    await FourSymbolsFeatures.ensure('gameplay-core','daily-portrait-qa');
    closeHomeFeature();showPage('dungeon');
    autoConfig.enabled=false;autoBattle=false;
    player.level=70;
    window.__dailyRuntimeQa={types:{},firstVisible:[],errors:[]};
    window.addEventListener('error',e=>__dailyRuntimeQa.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection',e=>__dailyRuntimeQa.errors.push(String(e.reason)));
    const registry=await (await fetch('config/monster-portrait-registry.json',{cache:'no-store'})).json();
    window.__dailyExpected=Object.fromEntries(registry.groups.daily.map(row=>[row[0],row[5]]));
    return {startup:FourSymbolsStartupPolicy.getState(),presentation:typeof FourSymbolsBattlePresentation?.applyUnit};
})()`;

function runType(type){return `(async()=>{
    const type=${JSON.stringify(type)},qa=window.__dailyRuntimeQa;
    const wait=async test=>{const until=performance.now()+15000;while(!test()&&performance.now()<until)await new Promise(r=>setTimeout(r,25));if(!test())throw Error('Daily lifecycle timeout: '+test);};
    const check=(value,message)=>{if(!value)throw Error(message);};
    const dismissNotice=async()=>{
        const modal=document.getElementById('homeFeatureModal');if(!modal?.classList.contains('show'))return;
        check(modal.classList.contains('release-update-modal')&&!modal.classList.contains('release-update-forced'),'unexpected modal obscures Daily QA');
        const button=modal.querySelector('.home-feature-close-btn[onclick="closeHomeFeature()"]');check(button,'release notice return control');
        button.click();await wait(()=>!modal.classList.contains('show'));
    };
    await dismissNotice();
    const capture=()=>[...document.querySelectorAll('#battleMonsterArea .battle-monster')].map(card=>{
        const index=Number(card.id.replace('battleMonster','')),monster=monsters[index],art=card.querySelector(':scope > .v174-battle-art');
        const style=art&&getComputedStyle(art),rect=art?.getBoundingClientRect();
        const visible=node=>{if(!node)return false;const box=node.getBoundingClientRect();if(!(box.width>0&&box.height>0&&box.right>0&&box.left<innerWidth&&box.bottom>0&&box.top<innerHeight))return false;for(let parent=node;parent;parent=parent.parentElement){const s=getComputedStyle(parent);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<=0)return false;}return true;};
        const cardPainted=visible(card),painted=visible(art);
        return {cardPainted,key:card.dataset.monsterPortraitKey,path:card.dataset.monsterPortraitPath,expected:__dailyExpected[monster.portraitKey],stage:monster.v141DungeonStage,rank:monster.rank||monster.v141BattleRank||'regular',background:style?.backgroundImage,backgroundSize:style?.backgroundSize,painted,artCount:card.querySelectorAll(':scope > .v174-battle-art').length,legacyCount:card.querySelectorAll('img.v162-abyss-battle-portrait-art').length,width:rect?.width,height:rect?.height};
    });
    const firstVisible=new Map();let sampling=true;
    const sample=()=>{if(!sampling)return;if(!document.getElementById('homeFeatureModal')?.classList.contains('show'))for(const row of capture()){if(row.cardPainted){const id=row.stage+':'+row.key;if(!firstVisible.has(id))firstVisible.set(id,row);}}requestAnimationFrame(sample);};
    requestAnimationFrame(sample);
    try{
        const entry={exp:'v132BeginExpDungeon',material:'v132BeginMaterialDungeon',gold:'v17346BeginEquipmentDungeon'}[type];
        const launch=window[entry]();
        await wait(()=>document.getElementById('v169RpgDialogLayer')?.classList.contains('show'));
        document.querySelector('#v169RpgDialogLayer .v169-rpg-dialog-actions button:last-child').click();
        await launch;
        check(window.v132ActiveDungeonRun?.dailyDungeonType===type,'formal daily launch identity');
        const waves=[];
        for(let stage=1;stage<=3;stage++){
            await wait(()=>battleActive&&monsters[currentBattleMonsters[0]]?.v141DungeonStage===stage&&!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
            await dismissNotice();
            await new Promise(requestAnimationFrame);
            const rows=capture();check(rows.length===6,'six formal enemies per wave');
            for(const row of rows){check(row.painted,'portrait must be visible: '+row.key);check(row.path===row.expected&&row.background?.includes(row.expected),'current Registry selection: '+row.key);check(row.artCount===1&&row.legacyCount===0,'single V174 surface');}
            waves.push({stage,rows});
            if(stage<3){
                if(type==='gold'){
                    // Invoke the registered completion boundary in the isolated
                    // account; no final win, reward claim or server write occurs.
                    const done=v132ActiveDungeonRun.onComplete;v132AbortDungeonBattle('qa-wave');done({result:'win',turnsUsed:1});
                }else{
                    currentBattleMonsters.forEach(i=>{monsters[i].hp=0;monsters[i].alive=false;});winBattle();
                }
            }
        }
        const first=[...firstVisible.values()];
        check(first.length>=6,'first visible frames must be sampled');
        for(const row of first){check(row.painted&&row.artCount===1&&row.legacyCount===0,'first visible card must already have single V174 artwork: '+row.key);check(row.path===row.expected&&row.background?.includes(row.expected),'first visible frame has incorrect art: '+row.key);}
        const covered=[...new Set(waves.flatMap(w=>w.rows.map(r=>r.key)))].sort();
        check(JSON.stringify(covered)===JSON.stringify(['regular','elite','boss'].map(rank=>'daily.'+type+'.'+rank).sort()),'all daily ranks must be covered');
        const snapshot=JSON.stringify(capture().map(r=>({key:r.key,path:r.path,artCount:r.artCount})));
        renderBattle();check(JSON.stringify(capture().map(r=>({key:r.key,path:r.path,artCount:r.artCount})))===snapshot,'redraw preserves selection and single surface');
        await dismissNotice();
        qa.types[type]={entry,waves,firstVisible:first,covered,redraw:true};
        return qa.types[type];
    }finally{sampling=false;}
})()`;}

const runtimeServer=await startServer(),runtimeReport={commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',viewports:[]};
let client,proc,profile;
function closeViewport(){client?.close();client=null;proc?.kill('SIGTERM');proc=null;if(profile){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}profile=null;}}
try{
    for(const [width,height] of [[360,800],[393,873],[412,915]]){
        profile=fs.mkdtempSync(path.join(os.tmpdir(),'daily-portrait-runtime-'));
        const port=9600+Math.floor(Math.random()*250);
        proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
        const targets=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
        await client.send('Page.enable');await client.send('Runtime.enable');
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        await client.send('Page.navigate',{url:runtimeServer.url});
        const prepared=await client.eval(PREPARE_RUNTIME);assert.equal(prepared.startup,'READY');assert.equal(prepared.presentation,'function');
        const viewport={width,height,types:{}};
        for(const type of types){
            viewport.types[type]=await client.eval(runType(type));
            assert.equal(await client.eval("!!document.getElementById('homeFeatureModal')?.classList.contains('show')"),false,'daily screenshot must be unobstructed');
            const shot=await client.send('Page.captureScreenshot',{format:'png'});
            fs.writeFileSync(path.join(ARTIFACT_DIR,'daily-dungeon-'+type+'-'+width+'x'+height+'.png'),Buffer.from(shot.data,'base64'));
            await client.eval("v132AbortDungeonBattle('qa-portrait');showPage('dungeon');true");
        }
        assert.deepEqual(await client.eval('__dailyRuntimeQa.errors'),[]);
        runtimeReport.viewports.push(viewport);closeViewport();
    }
    runtimeReport.passed=true;
    console.log('Daily Dungeon production Runtime presentation: PASS (3 viewports x 9 portrait keys, formal launch/waves/first-visible/redraw).');
}catch(error){runtimeReport.passed=false;runtimeReport.error=String(error.stack||error);runtimeReport.partial=await client?.eval('window.__dailyRuntimeQa').catch(()=>null);throw error;}
finally{
    fs.writeFileSync(path.join(ARTIFACT_DIR,'daily-dungeon-portrait-runtime-qa.json'),JSON.stringify(runtimeReport,null,2)+'\n');
    closeViewport();await new Promise(resolve=>runtimeServer.server.close(resolve));
}
