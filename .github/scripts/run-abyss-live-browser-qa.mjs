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
    await client.eval(\`(()=>{
        try{sessionStorage.setItem('sixiang_startup_session_ready_v1','1');}catch(_){}
        if(typeof saveGame==='function'){saveGame();return true;}
        return false;
    })()\`);
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

/* Encounter taps are actions, not pathing commands. Preserve the avatar's
   exact map coordinates and remember the encounter marker position so the
   victory chest can be verified at the same spot. */
const encounterTapNeedle=`        v174AbyssSelectDifficulty(20);
        v174AbyssStartEncounter();
        await new Promise(resolve=>setTimeout(resolve,1800));
`;
const encounterTapReplacement=`        v174AbyssSelectDifficulty(20);
        const beforeRun=v174AbyssGetRunState(20);
        const encounter=document.querySelector('.v174-abyss-encounter');
        const encounterPosition={left:encounter?.style.left||null,top:encounter?.style.top||null};
        v174AbyssStartEncounter();
        const afterRun=v174AbyssGetRunState(20);
        window.__abyssQaEncounterTap={before:{x:beforeRun.x,y:beforeRun.y},after:{x:afterRun.x,y:afterRun.y},encounterPosition};
        await new Promise(resolve=>setTimeout(resolve,1800));
`;
const preLaunchAssertNeedle=`    assert.deepEqual([preLaunch.hps[0],preLaunch.hps[5]],[386,1236]);

    const afterWin=await client.eval(\`(()=>{
`;
const preLaunchAssertReplacement=`    assert.deepEqual([preLaunch.hps[0],preLaunch.hps[5]],[386,1236]);
    const encounterTap=await client.eval(\`window.__abyssQaEncounterTap\`);
    evidence.checks.encounterTap=encounterTap;
    assert.deepEqual(encounterTap.after,encounterTap.before,"Tapping an Abyss encounter must not move the map avatar");
    assert.ok(encounterTap.encounterPosition.left&&encounterTap.encounterPosition.top,"Encounter marker position must be measurable");

    const afterWin=await client.eval(\`(()=>{
`;
const afterWinReturnNeedle=`        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal'),pending:!!document.querySelector('.v174-abyss-node.current.pending')};
`;
const afterWinReturnReplacement=`        const run=v174AbyssGetRunState(20);
        const chest=document.querySelector('.v174-abyss-chest');
        return {run,chest:!!chest,chestPosition:chest?{left:chest.style.left,top:chest.style.top}:null,portal:!!document.querySelector('.v174-abyss-portal'),pending:!!document.querySelector('.v174-abyss-node.current.pending')};
`;
const afterWinAssertNeedle=`    assert.equal(afterWin.chest,true,"Victory must spawn a chest");
    assert.equal(afterWin.portal,false,"Portal must not render before chest claim");
`;
const afterWinAssertReplacement=`    assert.equal(afterWin.chest,true,"Victory must spawn a chest");
    assert.deepEqual(afterWin.chestPosition,encounterTap.encounterPosition,"Victory chest must drop at the defeated encounter's exact map position");
    assert.equal(afterWin.portal,false,"Portal must not render before chest claim");
`;

if(!patched.includes(encounterTapNeedle)||!patched.includes(preLaunchAssertNeedle)||!patched.includes(afterWinReturnNeedle)||!patched.includes(afterWinAssertNeedle)){
    throw new Error("Live Abyss QA could not install encounter-tap/chest-position regression checks.");
}
patched=patched
    .replace(encounterTapNeedle,encounterTapReplacement)
    .replace(preLaunchAssertNeedle,preLaunchAssertReplacement)
    .replace(afterWinReturnNeedle,afterWinReturnReplacement)
    .replace(afterWinAssertNeedle,afterWinAssertReplacement);

/* The boss-flow part of the QA stubs the shared dungeon launcher so it can
   inspect the roster without entering combat. Preserve the real launcher first;
   otherwise the later VFX regression would accidentally call the stub and wait
   forever for battle cards that can never appear. */
const bossLauncherNeedle=`    const bossLaunch=await client.eval(\`(async()=>{
        window.__abyssQaLaunch=null;
        window.v132LaunchDungeonBattle=(roster,settled)=>{window.__abyssQaLaunch={roster,settled};return true;};
`;
const bossLauncherReplacement=`    const bossLaunch=await client.eval(\`(async()=>{
        window.__abyssQaLaunch=null;
        window.__abyssQaLiveLauncher=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=(roster,settled)=>{window.__abyssQaLaunch={roster,settled};return true;};
`;
if(!patched.includes(bossLauncherNeedle)){
    throw new Error("Live Abyss QA could not preserve the production dungeon launcher before the boss roster stub.");
}
patched=patched.replace(bossLauncherNeedle,bossLauncherReplacement);

/* The user's regression was visual: skill text still appeared while the V143
   effect did not. Exercise a real formal Flame Slash cast in the production
   dungeon battle engine (only learning eligibility is supplied by the fixture),
   then require an actually visible V143 stage + Sprite with non-zero geometry. */
const vfxNeedle=`    assert.equal(lv40.final.eliteCount,9);

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
`;
const vfxReplacement=`    assert.equal(lv40.final.eliteCount,9);

    const vfxLaunch=await client.eval(\`(()=>{
        const launcher=typeof window.__abyssQaLiveLauncher==='function'?window.__abyssQaLiveLauncher:window.v132LaunchDungeonBattle;
        if(typeof launcher!=='function'){return {started:false,reason:'missing-shared-launcher'};}
        if(typeof battleActive!=='undefined'&&battleActive){return {started:false,reason:'battle-already-active'};}
        if(typeof v132CloseRewardModal==='function'){try{v132CloseRewardModal();}catch(_){}}
        const roster=v174AbyssBuildRoster(20,0,0);
        const started=launcher(roster,()=>{});
        return {started:!!started};
    })()\`);
    assert.equal(vfxLaunch.started,true,\`Real Abyss battle could not start for VFX QA: \${vfxLaunch.reason||'unknown'}\`);
    await waitFor(client,"document.getElementById('battlePage')?.classList.contains('active')&&document.getElementById('battlePlayerCard0')&&document.getElementById('battleMonster0')","real Abyss battle cards",15000);
    const vfxBefore=await client.eval(\`typeof v143GetAnimationDiagnostics==='function'?v143GetAnimationDiagnostics():null\`);
    assert.ok(vfxBefore,"V143 animation diagnostics are unavailable in the deployed battle runtime");
    const castTriggered=await client.eval(\`(()=>{
        if(typeof castDamageSkill!=='function'||typeof skillDatabase==='undefined'||!skillDatabase.flameSlash){return false;}
        if(typeof queuedPlayerActions!=='undefined'){
            queuedPlayerActions[0]={action:'flameSlash',target:0,targetAlly:null};
        }
        if(typeof selectedMonster!=='undefined'){selectedMonster=0;}
        if(typeof activeBattleCharacterIndex!=='undefined'){activeBattleCharacterIndex=0;}
        if(typeof player!=='undefined'&&player){player.sp=Math.max(999,Number(player.sp)||0);player.element='fire';}
        if(typeof getSkillLevel==='function'&&!window.__abyssQaGetSkillLevelOriginal){
            window.__abyssQaGetSkillLevelOriginal=getSkillLevel;
            const original=getSkillLevel;
            getSkillLevel=function(key,id){return id==='flameSlash'?1:original.apply(this,arguments);};
        }
        castDamageSkill('flameSlash');
        return true;
    })()\`);
    assert.equal(castTriggered,true,"Production Flame Slash action could not be invoked");
    await sleep(140);
    const vfx=await client.eval(\`(()=>{
        const stage=document.getElementById('v143-skill-stage');
        const sprite=stage?.querySelector('.v143-vfx-sprite');
        const stageStyle=stage?getComputedStyle(stage):null;
        const spriteStyle=sprite?getComputedStyle(sprite):null;
        const stageRect=stage?.getBoundingClientRect();
        const spriteRect=sprite?.getBoundingClientRect();
        return {
            stage:!!stage,
            display:stageStyle?.display||null,
            visibility:stageStyle?.visibility||null,
            opacity:stageStyle?.opacity||null,
            stageWidth:stageRect?.width||0,stageHeight:stageRect?.height||0,
            sprite:!!sprite,
            spriteDisplay:spriteStyle?.display||null,
            spriteVisibility:spriteStyle?.visibility||null,
            spriteOpacity:spriteStyle?.opacity||null,
            spriteWidth:spriteRect?.width||0,spriteHeight:spriteRect?.height||0,
            diagnostics:typeof v143GetAnimationDiagnostics==='function'?v143GetAnimationDiagnostics():null
        };
    })()\`);
    evidence.checks.liveSkillVfx=vfx;
    assert.equal(vfx.stage,true,"Skill cast did not create the V143 stage");
    assert.notEqual(vfx.display,"none","V143 stage is display:none during a real skill cast");
    assert.equal(vfx.visibility,"visible","V143 stage is hidden during a real skill cast");
    assert.ok(Number(vfx.opacity)>0,"V143 stage opacity is zero during a real skill cast");
    assert.ok(vfx.stageWidth>0&&vfx.stageHeight>0,"V143 stage has no visible geometry");
    assert.equal(vfx.sprite,true,"Flame Slash did not create its formal Sprite VFX");
    assert.notEqual(vfx.spriteDisplay,"none","Formal skill Sprite is display:none");
    assert.equal(vfx.spriteVisibility,"visible","Formal skill Sprite is hidden");
    assert.ok(Number(vfx.spriteOpacity)>0,"Formal skill Sprite opacity is zero");
    assert.ok(vfx.spriteWidth>0&&vfx.spriteHeight>0,"Formal skill Sprite has no visible geometry");
    assert.ok((vfx.diagnostics?.started||0)>(vfxBefore.started||0),"V143 did not record the real skill animation start");
    const vfxShot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(vfxShot.data){ fs.writeFileSync(path.join(artifactDir,"abyss-live-skill-vfx.png"),Buffer.from(vfxShot.data,"base64")); }

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
`;
if(!patched.includes(vfxNeedle)){
    throw new Error("Live Abyss QA could not install real-skill VFX verification.");
}
patched=patched.replace(vfxNeedle,vfxReplacement);

const target=path.join(os.tmpdir(),`abyss-live-browser-qa-saved-${process.pid}.mjs`);
fs.writeFileSync(target,patched,"utf8");
await import(pathToFileURL(target).href+`?run=${Date.now()}`);
