import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

const sourcePath=path.resolve(".github/scripts/abyss-live-browser-qa-v2.mjs");
const source=fs.readFileSync(sourcePath,"utf8");
function replaceRequired(input,needle,replacement,label){
    if(!input.includes(needle)){ throw new Error("Live Abyss QA could not patch "+label+"."); }
    return input.replace(needle,replacement);
}

let patched=source;

patched=replaceRequired(patched,
`async function prepareAccountFirstRuntime(client,features){
    await waitFor(client,"window.FourSymbolsStartupPolicy&&['AUTH_REQUIRED','NEED_CHARACTER','READY','OFFLINE_READY','ERROR'].includes(FourSymbolsStartupPolicy.getState())","account-first startup destination",30000);
    let state=await client.eval("FourSymbolsStartupPolicy.getState()");
`,
`async function prepareAccountFirstRuntime(client,features){
    await waitFor(client,"window.FourSymbolsStartupPolicy&&(FourSymbolsStartupPolicy.getState()==='ERROR'||['AUTH_REQUIRED','NEED_CHARACTER','READY','OFFLINE_READY'].includes(FourSymbolsStartupPolicy.getState())||(document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden&&document.getElementById('startupProgress')?.getAttribute('aria-valuenow')==='100'))","First Play/privacy/account startup destination",120000);
    let state=await client.eval("FourSymbolsStartupPolicy.getState()");
    const privacyVisible=state!=="ERROR"&&await client.eval("Boolean(document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden)");
    if(privacyVisible){
        await waitFor(client,"(()=>{const gate=document.getElementById('privacyConsentGate');const policy=gate?.contentWindow?.document?.getElementById('policyFrame');return !!(policy&&policy.contentDocument&&policy.contentDocument.readyState==='complete');})()","privacy policy document",15000);
        await client.eval("(()=>{const gate=document.getElementById('privacyConsentGate');const consent=gate.contentWindow.document;const policy=consent.getElementById('policyFrame');const root=policy.contentDocument.scrollingElement||policy.contentDocument.documentElement;policy.contentWindow.scrollTo(0,root.scrollHeight);policy.contentWindow.dispatchEvent(new Event('scroll'));return true;})()");
        await waitFor(client,"document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').disabled===false","privacy agree enabled",10000);
        await client.eval("document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').click();true");
        await waitFor(client,"window.FourSymbolsStartupPolicy&&['AUTH_REQUIRED','NEED_CHARACTER','READY','OFFLINE_READY','ERROR'].includes(FourSymbolsStartupPolicy.getState())","account-first startup destination after privacy consent",60000);
        state=await client.eval("FourSymbolsStartupPolicy.getState()");
    }
`,"First Play privacy-aware account bootstrap");

patched=replaceRequired(patched,
`    await client.eval(seedPlayerExpression(20));
    await client.eval(\`(async()=>{
`,
`    await client.eval(seedPlayerExpression(20));
    await client.eval(\`(()=>{
        try{sessionStorage.setItem('sixiang_startup_session_ready_v1','1');}catch(_){}
        if(typeof saveGame==='function'){saveGame();return true;}
        return false;
    })()\`);
    await client.send("Page.reload",{ignoreCache:true});
    await waitFor(client,"document.readyState==='complete'","saved player reload");
    await prepareAccountFirstRuntime(client,["abyss"]);
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime after saved player reload");
    await waitFor(client,abyssStyleReady,"hashed feature Abyss CSS after saved player reload");
    await client.eval(seedPlayerExpression(20));
    await client.eval(\`(async()=>{
`,"saved-player reload bootstrap");

patched=replaceRequired(patched,
`    for(let expectedStage=2;expectedStage<=4;expectedStage++){
`,
`    for(let expectedStage=2;expectedStage<=3;expectedStage++){
`,"pre-stage loop boundary");
patched=replaceRequired(patched,
`        if(expectedStage===4){ assert.equal(gate.bossGate,true,"Fourth pre-stage must unlock distinct boss gate"); }
`,
`        if(expectedStage===3){ assert.equal(gate.bossGate,true,"Fourth pre-stage must unlock distinct boss gate"); }
`,"boss-gate assertion");

patched=replaceRequired(patched,
`    await waitFor(client,"document.querySelector('.v174-abyss-selection')&&getComputedStyle(document.querySelector('.v174-abyss-selection')).display!=='none'","visible Abyss selection");

    const selection=await client.eval(\`(()=>{
`,
`    await waitFor(client,"document.querySelector('.v174-abyss-selection')&&getComputedStyle(document.querySelector('.v174-abyss-selection')).display!=='none'","visible Abyss selection");
    await waitFor(client,"Array.from(document.querySelectorAll('.v174-abyss-card-cover')).length===2&&Array.from(document.querySelectorAll('.v174-abyss-card-cover')).every(img=>img.complete&&img.naturalWidth>0&&img.naturalHeight>0)","Abyss cover image load",30000);

    const selection=await client.eval(\`(()=>{
`,"cover load wait");
patched=replaceRequired(patched,
`        const sr=selection?.getBoundingClientRect();
        const stage=document.getElementById('game-stage')?.getBoundingClientRect();
`,
`        const sr=selection?.getBoundingClientRect();
        const list=document.querySelector('.v174-abyss-card-list');
        const lr=list?.getBoundingClientRect();
        const stage=document.getElementById('game-stage')?.getBoundingClientRect();
`,"selection geometry");
patched=replaceRequired(patched,
`            selectionWidth:sr?.width||0,selectionHeight:sr?.height||0,
            selectionOverflow:selection?(selection.scrollHeight-selection.clientHeight):999,
`,
`            selectionWidth:sr?.width||0,selectionHeight:sr?.height||0,
            selectionAlignItems:selection?getComputedStyle(selection).alignItems:null,
            cardListWidth:lr?.width||0,cardListHeight:lr?.height||0,
            selectionOverflow:selection?(selection.scrollHeight-selection.clientHeight):999,
`,"selection metrics");
patched=replaceRequired(patched,
`    assert.ok(selection.w20>0&&selection.h20>0&&selection.w40>0&&selection.h40>0,"Abyss cards must have a real visible footprint");
`,
`    assert.ok(selection.w20>0&&selection.h20>0&&selection.w40>0&&selection.h40>0,"Abyss cards must have a real visible footprint");
    assert.equal(selection.selectionAlignItems,"stretch","Two-tier Abyss selection must override legacy centered cross-axis sizing");
    assert.ok(selection.cardListWidth>=Math.max(250,selection.selectionWidth*0.80),\`Abyss card list collapsed horizontally: list=\${selection.cardListWidth}px selection=\${selection.selectionWidth}px\`);
    assert.ok(selection.w20>=selection.cardListWidth*0.95&&selection.w40>=selection.cardListWidth*0.95,\`Abyss cover cards do not fill the card list: cards=\${selection.w20}/\${selection.w40}px list=\${selection.cardListWidth}px\`);
`,"Android card width assertions");

patched=replaceRequired(patched,
`        v174AbyssSelectDifficulty(20);
        v174AbyssStartEncounter();
        await new Promise(resolve=>setTimeout(resolve,1800));
`,
`        v174AbyssSelectDifficulty(20);
        const beforeRun=v174AbyssGetRunState(20);
        const encounter=document.querySelector('.v174-abyss-encounter');
        const encounterPosition={left:encounter?.style.left||null,top:encounter?.style.top||null};
        v174AbyssStartEncounter();
        const afterRun=v174AbyssGetRunState(20);
        window.__abyssQaEncounterTap={before:{x:beforeRun.x,y:beforeRun.y},after:{x:afterRun.x,y:afterRun.y},encounterPosition};
        await new Promise(resolve=>setTimeout(resolve,1800));
`,"encounter tap coordinates");
patched=replaceRequired(patched,
`    assert.deepEqual([preLaunch.hps[0],preLaunch.hps[5]],[386,1236]);

    const afterWin=await client.eval(\`(()=>{
`,
`    assert.deepEqual([preLaunch.hps[0],preLaunch.hps[5]],[724,2317]);
    const encounterTap=await client.eval(\`window.__abyssQaEncounterTap\`);
    evidence.checks.encounterTap=encounterTap;
    assert.deepEqual(encounterTap.after,encounterTap.before,"Tapping an Abyss encounter must not move the map avatar");
    assert.ok(encounterTap.encounterPosition.left&&encounterTap.encounterPosition.top,"Encounter marker position must be measurable");

    const afterWin=await client.eval(\`(()=>{
`,"Lv20 HP and encounter assertions");
patched=replaceRequired(patched,
`        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal'),pending:!!document.querySelector('.v174-abyss-node.current.pending')};
`,
`        const run=v174AbyssGetRunState(20);
        const chest=document.querySelector('.v174-abyss-chest');
        return {run,chest:!!chest,chestPosition:chest?{left:chest.style.left,top:chest.style.top}:null,portal:!!document.querySelector('.v174-abyss-portal'),pending:!!document.querySelector('.v174-abyss-node.current.pending')};
`,"chest coordinates");
patched=replaceRequired(patched,
`    assert.equal(afterWin.chest,true,"Victory must spawn a chest");
    assert.equal(afterWin.portal,false,"Portal must not render before chest claim");
`,
`    assert.equal(afterWin.chest,true,"Victory must spawn a chest");
    assert.deepEqual(afterWin.chestPosition,encounterTap.encounterPosition,"Victory chest must drop at the defeated encounter's exact map position");
    assert.equal(afterWin.portal,false,"Portal must not render before chest claim");
`,"chest drop position assertion");

patched=replaceRequired(patched,
`    await client.eval(\`document.querySelector('.v174-abyss-chest')?.click();true\`);
    await sleep(1900);
    const afterClaim=await client.eval(\`(()=>{const run=v174AbyssGetRunState(20);return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};})()\`);
`,
`    const rapidChestStart=await client.eval(\`(()=>{
        const beforeGold=Number(typeof gold!=='undefined'?gold:0);
        const first=v174AbyssClaimChest();
        const second=v174AbyssClaimChest();
        return {beforeGold,first,second,diag:v174AbyssGetInteractionDiagnostics()};
    })()\`);
    assert.equal(rapidChestStart.first,true,"First chest tap must start");
    assert.equal(rapidChestStart.second,false,"Second rapid chest tap must be rejected");
    assert.equal(rapidChestStart.diag.moving,true,"Chest claim should own the movement lock");
    await sleep(1900);
    const afterClaim=await client.eval(\`(()=>{const run=v174AbyssGetRunState(20);return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal'),gold:Number(typeof gold!=='undefined'?gold:0)};})()\`);
    evidence.checks.rapidChest={start:rapidChestStart,after:afterClaim};
    assert.equal(afterClaim.gold-rapidChestStart.beforeGold,120,"Rapid chest tapping must grant the reward exactly once");
`,"rapid chest regression");

patched=replaceRequired(patched,
`    await client.eval(\`document.querySelector('.v174-abyss-portal')?.click();true\`);
    await sleep(1900);
    let run=await client.eval(\`v174AbyssGetRunState(20)\`);
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[0,1,"ready"]);
`,
`    const rapidPortal=await client.eval(\`(()=>({first:v174AbyssUsePortal(),second:v174AbyssUsePortal(),before:v174AbyssGetRunState(20),diag:v174AbyssGetInteractionDiagnostics()}))()\`);
    assert.equal(rapidPortal.first,true,"First portal tap must start");
    assert.equal(rapidPortal.second,false,"Second rapid portal tap must be rejected");
    assert.equal(rapidPortal.before.encounterIndex,0,"Portal progress must not commit before movement completes");
    await sleep(1900);
    let run=await client.eval(\`v174AbyssGetRunState(20)\`);
    evidence.checks.rapidPortal={start:rapidPortal,after:run};
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[0,1,"ready"]);

    const rapidMove=await client.eval(\`(()=>{
        const map=document.getElementById('v141AbyssMap');
        const rect=map.getBoundingClientRect();
        const before=v174AbyssGetRunState(20);
        const eventA={clientX:rect.left+rect.width*.78,clientY:rect.top+rect.height*.54,target:{closest:()=>null}};
        const eventB={clientX:rect.left+rect.width*.20,clientY:rect.top+rect.height*.25,target:{closest:()=>null}};
        return {before,first:v174AbyssMoveByEvent(eventA),second:v174AbyssMoveByEvent(eventB),immediate:v174AbyssGetRunState(20),diag:v174AbyssGetInteractionDiagnostics()};
    })()\`);
    assert.equal(rapidMove.first,true,"First map tap must start movement");
    assert.equal(rapidMove.second,false,"Second rapid map tap must be rejected while walking");
    assert.deepEqual([rapidMove.immediate.x,rapidMove.immediate.y],[rapidMove.before.x,rapidMove.before.y],"Rapid double tap must not instantly commit coordinates");
    await sleep(1900);
    const rapidMoveAfter=await client.eval(\`v174AbyssGetRunState(20)\`);
    evidence.checks.rapidMove={start:rapidMove,after:rapidMoveAfter};
    assert.ok(rapidMoveAfter.x!==rapidMove.before.x||rapidMoveAfter.y!==rapidMove.before.y,"First movement must complete smoothly after the lock");
`,"rapid portal and movement regression");

patched=replaceRequired(patched,
`    assert.equal(bossLaunch.count,10);
    assert.equal(bossLaunch.eliteCount,9);
`,
`    assert.equal(bossLaunch.count,8);
    assert.equal(bossLaunch.eliteCount,7);
`,"Lv20 boss roster count assertions");

patched=replaceRequired(patched,
`    assert.deepEqual(bossLaunch.bosses,[{name:"東帝",hp:3090,level:20,skill:1}]);
`,
`    assert.deepEqual(bossLaunch.bosses,[{name:"東帝",hp:5793,level:20,skill:1}]);
`,"Lv20 boss HP assertion");

patched=replaceRequired(patched,
`    assert.deepEqual([lv40.pre.regularHp,lv40.pre.eliteHp],[644,2059]);
    assert.deepEqual([lv40.boss.eliteHp,lv40.boss.bosses[0].hp],[2517,5149]);
    assert.deepEqual(lv40.final.bosses,[{name:"極帝天尊",hp:5149,level:40,skill:2}]);
    assert.equal(lv40.final.eliteCount,9);
`,
`    assert.deepEqual([lv40.pre.regularHp,lv40.pre.eliteHp],[1207,3861]);
    assert.equal(lv40.boss.count,8);
    assert.deepEqual([lv40.boss.eliteHp,lv40.boss.bosses[0].hp],[4719,9654]);
    assert.equal(lv40.final.count,10);
    assert.deepEqual(lv40.final.bosses,[
        {name:"東帝天尊",hp:9654,level:40,skill:2},
        {name:"天帝天尊",hp:9654,level:40,skill:2},
        {name:"極帝天尊",hp:9654,level:40,skill:2},
        {name:"北帝天尊",hp:9654,level:40,skill:2},
        {name:"南帝天尊",hp:9654,level:40,skill:2}
    ]);
    assert.equal(lv40.final.eliteCount,5);
`,"Lv40 durability, eight-enemy boss and five-emperor assertions");

patched=replaceRequired(patched,
`    const bossLaunch=await client.eval(\`(async()=>{
        window.__abyssQaLaunch=null;
        window.v132LaunchDungeonBattle=(roster,settled)=>{window.__abyssQaLaunch={roster,settled};return true;};
`,
`    const bossLaunch=await client.eval(\`(async()=>{
        window.__abyssQaLaunch=null;
        window.__abyssQaLiveLauncher=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=(roster,settled)=>{window.__abyssQaLaunch={roster,settled};return true;};
`,"production launcher preservation");

patched=replaceRequired(patched,
`    assert.equal(lv40.final.eliteCount,5);

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
`,
`    assert.equal(lv40.final.eliteCount,5);

    const vfxLaunch=await client.eval(\`(()=>{
        const launcher=typeof window.__abyssQaLiveLauncher==='function'?window.__abyssQaLiveLauncher:window.v132LaunchDungeonBattle;
        if(typeof launcher!=='function'){return {started:false,reason:'missing-shared-launcher'};}
        if(typeof battleActive!=='undefined'&&battleActive){return {started:false,reason:'battle-already-active'};}
        if(typeof v132CloseRewardModal==='function'){try{v132CloseRewardModal();}catch(_){}}
        const roster=v174AbyssBuildRoster(20,0,0);
        const started=launcher(roster,()=>{});
        return {started:!!started};
    })()\`);
    assert.equal(vfxLaunch.started,true,\`Real Abyss battle could not start for Fire Flurry VFX QA: \${vfxLaunch.reason||'unknown'}\`);
    await waitFor(client,"document.getElementById('battlePage')?.classList.contains('active')&&document.getElementById('battlePlayerCard0')&&document.getElementById('battleMonster2')","real Abyss battle cards",15000);
    const vfxBefore=await client.eval(\`typeof v143GetAnimationDiagnostics==='function'?v143GetAnimationDiagnostics():null\`);
    assert.ok(vfxBefore,"V143 animation diagnostics are unavailable in the deployed battle runtime");
    const castTriggered=await client.eval(\`(()=>{
        if(typeof castDamageSkill!=='function'||typeof skillDatabase==='undefined'||!skillDatabase.explosiveFlurry){return false;}
        if(typeof queuedPlayerActions!=='undefined'){queuedPlayerActions[0]={action:'explosiveFlurry',target:2,targetAlly:null};}
        if(typeof selectedMonster!=='undefined'){selectedMonster=2;}
        if(typeof activeBattleCharacterIndex!=='undefined'){activeBattleCharacterIndex=0;}
        if(typeof player!=='undefined'&&player){player.sp=Math.max(999,Number(player.sp)||0);player.element='fire';}
        if(typeof getSkillLevel==='function'&&!window.__abyssQaGetSkillLevelOriginal){
            window.__abyssQaGetSkillLevelOriginal=getSkillLevel;
            const original=getSkillLevel;
            getSkillLevel=function(key,id){return id==='explosiveFlurry'?1:original.apply(this,arguments);};
        }
        castDamageSkill('explosiveFlurry');
        return true;
    })()\`);
    assert.equal(castTriggered,true,"Production Fire Explosive Flurry action could not be invoked");
    await sleep(180);
    const vfx=await client.eval(\`(()=>{
        const stage=document.getElementById('v143-skill-stage');
        const sprite=stage?.querySelector('.v143-vfx-sprite[data-skill="explosiveFlurry"]');
        const stageStyle=stage?getComputedStyle(stage):null;
        const spriteStyle=sprite?getComputedStyle(sprite):null;
        const stageRect=stage?.getBoundingClientRect();
        const spriteRect=sprite?.getBoundingClientRect();
        return {
            stage:!!stage,skill:stage?.dataset.skill||null,stageRenderer:stage?.dataset.renderer||null,display:stageStyle?.display||null,visibility:stageStyle?.visibility||null,
            opacity:stageStyle?.opacity||null,stageWidth:stageRect?.width||0,stageHeight:stageRect?.height||0,
            sprite:!!sprite,tag:sprite?.tagName||null,renderer:sprite?.dataset.renderer||null,
            targets:(sprite?.dataset.targetIndexes||'').split(',').filter(Boolean),
            spriteDisplay:spriteStyle?.display||null,spriteVisibility:spriteStyle?.visibility||null,spriteOpacity:spriteStyle?.opacity||null,
            spriteWidth:spriteRect?.width||0,spriteHeight:spriteRect?.height||0,
            diagnostics:typeof v143GetAnimationDiagnostics==='function'?v143GetAnimationDiagnostics():null
        };
    })()\`);
    evidence.checks.liveExplosiveFlurryVfx=vfx;
    assert.equal(vfx.stage,true,"Fire Flurry did not create the V143 stage");
    assert.equal(vfx.skill,"explosiveFlurry","Wrong VFX skill is active");
    assert.equal(vfx.stageRenderer,"raster-only","Fire Flurry stage is not owned by the raster-only V143 runtime");
    assert.notEqual(vfx.display,"none","V143 stage is display:none during Fire Flurry");
    assert.equal(vfx.visibility,"visible","V143 stage is hidden during Fire Flurry");
    assert.ok(Number(vfx.opacity)>0,"V143 stage opacity is zero during Fire Flurry");
    assert.ok(vfx.stageWidth>0&&vfx.stageHeight>0,"V143 stage has no geometry");
    assert.equal(vfx.sprite,true,"Fire Flurry did not create its formal Sprite VFX");
    assert.equal(vfx.tag,"I","Fire Flurry must use the V143 DOM raster Sprite node");
    assert.equal(vfx.renderer,"dom-sprite","Fire Flurry renderer is not the formal DOM raster Sprite owner");
    assert.equal(vfx.targets.length,3,"Fire Flurry must visually cover the three formal tri targets");
    assert.notEqual(vfx.spriteDisplay,"none","Fire Flurry Sprite is display:none");
    assert.equal(vfx.spriteVisibility,"visible","Fire Flurry Sprite is hidden");
    assert.ok(Number(vfx.spriteOpacity)>0,"Fire Flurry Sprite opacity is zero");
    assert.ok(vfx.spriteWidth>0&&vfx.spriteHeight>0,"Fire Flurry Sprite has no visible geometry");
    assert.ok((vfx.diagnostics?.started||0)>(vfxBefore.started||0),"V143 did not record the formal Fire Flurry animation start");
    assert.equal(vfx.diagnostics?.renderer,"dom-sprite-only","V143 diagnostics report a stale VFX renderer");
    const vfxShot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(vfxShot.data){ fs.writeFileSync(path.join(artifactDir,"abyss-live-explosive-flurry-vfx.png"),Buffer.from(vfxShot.data,"base64")); }

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
`,"formal Fire Flurry VFX verification");

const target=path.join(os.tmpdir(),`abyss-live-browser-qa-regression-${process.pid}.mjs`);
fs.writeFileSync(target,patched,"utf8");
await import(pathToFileURL(target).href+`?run=${Date.now()}`);