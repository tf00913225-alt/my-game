import { devAccessFetch } from './dev-access-fetch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
if(baseUrl){
    const manifest=await (await devAccessFetch(baseUrl+'/release-manifest.json',{cache:'no-store',signal:AbortSignal.timeout(20000)})).json();
    assert.equal(manifest.commitSha,expected,'live QA must use exact deployed SHA');
}
const out=path.resolve(process.env.LIFECYCLE_QA_OUTPUT_DIR||path.join(ROOT,'artifacts/browser-qa'));fs.mkdirSync(out,{recursive:true});
const planned=['battle-target-lifecycle.json',...[390,412].flatMap(width=>['hero-phase2b-'+width+'.png','battle-target-'+width+'.png',...['before','dead','revived'].map(stage=>'battle-target-lifecycle-'+width+'-'+stage+'.png')])];
for(const name of planned)assert.equal(fs.existsSync(path.join(out,name)),false,'refusing to overwrite existing evidence: '+name);
const terminalEvidenceDir=path.join(ROOT,'artifacts/browser-qa');
if(fs.existsSync(terminalEvidenceDir)){const existing=fs.readdirSync(terminalEvidenceDir).filter(name=>name.startsWith('terminal-visual-'));assert.equal(existing.length,0,'refusing to overwrite existing terminal visual evidence: '+existing.join(', '));}
await import('./run-terminal-visual-handoff-browser-qa.mjs');
// Read-only disposable account transport; all production bundles and target,
// attack, follow-up, damage, VFX and finish owners are real and unmodified.
const expression=`(async()=>{
    const wait=async(predicate,label)=>{const end=Date.now()+30000;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,30));if(!predicate())throw Error(label);};
    await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY','startup');
    await FourSymbolsFeatures.ensure('gameplay-core','target-lifecycle-qa');
    await FourSymbolsFeatures.ensure('feature-boss-relic','target-lifecycle-qa');
    closeHomeFeature();
    player2=buildAdditionalCharacter('QA ally B','water','male');registerAdditionalCharacter(2,player2);
    player3=buildAdditionalCharacter('QA ally C','water','male');registerAdditionalCharacter(3,player3);
    for(const i of getExistingPartyIndexes()){
        const p=getPartyCharacterByIndex(i);p.level=50;p.bonusHP=100000;p.activeBuffs=[];p.statusEffects=[];
        characterSkillLoadouts[getPartyCharacterKey(i)].equippedSkills=[];
        characterSkillLoadouts[getPartyCharacterKey(i)].skillLevels={};
    }
    const rows=[];
    for(const mode of ['manual','auto'])for(const rank of ['regular','boss'])for(const scenario of ['living','lethal','revived','dragon-surviving','dragon-lethal','revived-lethal']){
        autoBattle=false;autoConfig.enabled=false;autoConfig2.enabled=false;autoConfig3.enabled=false;
        for(const i of getExistingPartyIndexes())getPartyCharacterByIndex(i).hp=getPartyBattleStats(i).maxHP;
        const enemy=MonsterBalance.build({monsterKey:'qa.target.'+rank,name:'QA fire enemy',level:50,element:'fire',archetype:'balanced',rank,
            mode:rank==='boss'?'personalBoss':'wild',context:'qa/target-lifecycle'});
        Object.assign(enemy,{hp:100000,maxHP:100000,sp:1000,maxSP:1000,skillIds:['fireCritical'],skillChance:1,v141SupportSkillIds:[],v141ForceSkillLevel:1,v132FixedSkillLoadout:true});
        monsters=[enemy];currentZone='forest';mapCooldown=false;
        let releasePause,releaseFinish,finished=0;const badges=[],hits=[];
        const badge=showMonsterSkillNameBadge,hit=showPlayerHit,random=Math.random,retarget=retargetEnemyFollowUpSnapshot;
        try{
            startBattle(0);
            await wait(()=>battleActive&&turn>=1,'battle begin');clearInterval(timerId);
            closeHomeFeature();
            releasePause=FourSymbolsBattleFlow.acquirePauseLock('target-lifecycle-qa');
            battlePhase='declare';resolutionPhaseStarted=false;
            if(scenario.startsWith('revived'))player.hp=0;
            if(scenario==='lethal'||scenario.startsWith('dragon'))player.hp=1;
            if(scenario==='dragon-lethal')player3.hp=1;
            if(scenario==='revived-lethal')player2.hp=1;
            if(scenario.startsWith('dragon'))enemy.skillIds=['dragonSlash'];
            queuedPlayerActions={};autoBattle=mode==='auto';
            Math.random=()=>0;
            startResolutionPhase(battleToken);
            const action=initiativeQueue.find(e=>e.type==='monster'&&e.monsterIndex===0);
            if(!action?.targetSnapshot)throw Error('natural queue missing snapshot');
            if(scenario.startsWith('revived'))player.hp=getMainCharacterStats().maxHP;
            const before=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
            const beforeSp=enemy.sp;
            releaseFinish=FourSymbolsBattleFlow.interceptActionFinish(()=>{finished++;return true;});
            showMonsterSkillNameBadge=function(...args){badges.push({name:args[0],primary:args[3],targets:args[4]});return badge.apply(this,args);};
            showPlayerHit=function(...args){hits.push({index:args[2],critical:args[4]});return hit.apply(this,args);};
            // Draw only at the formal retarget boundary; unrelated hit/crit
            // rolls remain zero so Dragon's second trigger is deterministic.
            retargetEnemyFollowUpSnapshot=function(...args){
                const draw=Math.random;try{Math.random=()=>.9;return retarget.apply(this,args);}
                finally{Math.random=draw;}
            };
            processSingleMonsterAttack(0,battleToken,action.targetSnapshot);
            Math.random=()=>0;
            await wait(()=>finished===1,'follow-up completion: '+JSON.stringify({mode,rank,scenario,badges,hits}));
            await wait(()=>!window.v142SkillAnimationDirector?.getActive?.()||window.v142SkillAnimationDirector.getActive().done,'VFX completion');
            rows.push({mode,rank,scenario,before,beforeSp,after:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),badges,hits,
                snapshot:action.targetSnapshot.targets.map(t=>t.index),primary:action.targetSnapshot.primary?.index,sp:enemy.sp,cost:skillDatabase[scenario.startsWith('dragon')?'dragonSlash':'fireCritical'].spCost,finished,
                visible:document.getElementById('battlePage')?.classList.contains('active')===true&&
                    !document.getElementById('homeFeatureModal')?.classList.contains('show')&&
                    !!document.getElementById('battlePlayerCard1')?.getBoundingClientRect().height});
        }finally{
            showMonsterSkillNameBadge=badge;showPlayerHit=hit;Math.random=random;retargetEnemyFollowUpSnapshot=retarget;
            battleActive=false;battleToken++;autoBattle=false;clearInterval(timerId);
            releaseFinish?.();releasePause?.();
            window.v142SkillAnimationDirector?.cancelAll?.();
        }
    }
    return rows;
})()`;
const heroExpression=`(async()=>{
    const wait=async(fn,label)=>{const end=Date.now()+30000;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));if(!fn())throw Error(label);};
    const check=(v,label)=>{if(!v)throw Error(label);};
    await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY','startup');
    await FourSymbolsFeatures.ensure('gameplay-core','hero-foundation-qa');
    await FourSymbolsFeatures.ensure('feature-boss-relic','hero-foundation-qa');closeHomeFeature();
    player2=buildAdditionalCharacter('QA B','water','male');registerAdditionalCharacter(2,player2);
    player3=buildAdditionalCharacter('QA C','earth','male');registerAdditionalCharacter(3,player3);
    for(const p of getCharacters()){p.level=50;p.hp=100000;p.bonusHP=100000;p.activeBuffs=[];p.statusEffects=[];}
    const formationOwner=window.FourSymbolsTeamFormation;window.FourSymbolsTeamFormation={getConfirmed:()=>null};
    const system=FourSymbolsHeroSystem;const ids=FourSymbolsHeroCore.listHeroDefinitions().map(d=>d.heroId);
    const beforeAccount=system.getDomain().serialize();let account=beforeAccount;
    if(location.hostname==='dev.four-symbols-dev.pages.dev'){
        const locked=FourSymbolsHeroCore.normalizeAccountState();system.replaceAccountState(locked);
        const preview=initializeHeroBattleCombatants();
        check(JSON.stringify(preview.map(h=>h.heroId))===JSON.stringify(ids),'DEV default two Hero preview');
        check(preview.every(h=>h.combatantKind==='heroNpc'),'DEV preview formal identity');
        check(JSON.stringify(system.getDomain().serialize())===JSON.stringify(locked),'DEV preview canonical isolation');
        saveGame();const previewSave=JSON.parse(localStorage.getItem('four_symbols_save:skill-runtime-browser-qa'));
        check(JSON.stringify(previewSave.heroAccount)===JSON.stringify(locked),'DEV preview real save stays locked');
        system.replaceAccountState(beforeAccount);
    }
    // Acquisition proof comes through the isolated read-only transport fixture,
    // never a production bypass or an unverified local unlocked flag.
    window.__heroQaOwned=ids;await FourSymbolsHeroAcquisition.sync();
    account=system.getDomain().serialize();const accountBytes=JSON.stringify(account);
    const originalFormation=FourSymbolsBattlefieldSlots.getSerializableAllyFormation();
    const rows=[];
    try{for(const count of [0,1,2,3]){
        const domain=system.getDomain(),third='qa-third-hero';
        // Test-only capacity fixture: no changes to production Hero Core/Registry/schema.
        if(count===3)window.FourSymbolsHeroSystem={getDomain:()=>({...domain,
            getHeroDefinition:id=>id===third?{heroId:third,name:'QA Third Hero',element:'earth'}:domain.getHeroDefinition(id),
            isHeroUnlocked:id=>id===third||domain.isHeroUnlocked(id),
            getHeroLevel:id=>domain.getHeroLevel(id===third?ids[0]:id),
            getHeroBaseStats:id=>domain.getHeroBaseStats(id===third?ids[0]:id),
            getHeroAllocatedStats:id=>domain.getHeroAllocatedStats(id===third?ids[0]:id),
            getHeroSkillProjection:id=>domain.getHeroSkillProjection(id===third?ids[0]:id)})};
        window.FourSymbolsTeamFormation={getConfirmed:()=>({version:2,characterIndexToSlot:{0:"ALLY_F1",1:"ALLY_F2",2:"ALLY_F3"},heroIdToSlot:Object.fromEntries([...ids,third].slice(0,count).map((id,i)=>[id,"ALLY_B"+(i+1)]))})};
        const enemy=MonsterBalance.build({monsterKey:'qa.hero',name:'QA Enemy',level:50,element:'water',archetype:'balanced',rank:'regular',mode:'wild',context:'qa/hero'});
        Object.assign(enemy,{hp:100000,maxHP:100000,sp:1000,maxSP:1000,skillIds:[],skillChance:0,v141SupportSkillIds:[],v132FixedSkillLoadout:true});
        monsters=[enemy];currentZone='forest';mapCooldown=false;autoConfig.enabled=false;autoConfig2.enabled=false;autoConfig3.enabled=false;
        startBattle(0);window.FourSymbolsHeroSystem=system;clearInterval(timerId);
        const pause=FourSymbolsBattleFlow.acquirePauseLock('hero-foundation-qa');
        let finish,finished=0;const random=Math.random;
        try{
            check(getExistingPartyIndexes().length===3+count,'roster');
            const cards=getExistingPartyIndexes().map(i=>document.getElementById('battlePlayerCard'+i));check(cards.every(Boolean),'rendered six slots');
            const slots=cards.map(c=>c.dataset.slot);check(new Set(slots).size===3+count,'unique formal slots');
            const queue=buildInitiativeQueue();check(queue.filter(e=>e.type==='heroNpc').length===count,'hero initiative');check(new Set(queue.map(e=>e.type+':'+(e.characterIndex??e.monsterIndex))).size===queue.length,'unique initiative');
            const initial=FourSymbolsBattleStatistics.getSnapshot();check(initial.combatants.filter(c=>c.kind==='heroNpc').length===count,'statistics registration');
            if(count){
                const index=3+count-1,h=getPartyCharacterByIndex(index),hp=h.hp;
                check(h.combatantKind==='heroNpc'&&getPartyCharacterKey(index)===null,'Hero identity');
                check(h.level===domain.getHeroLevel(h.heroId===third?ids[0]:h.heroId),'Core level');
                Math.random=()=>.99999;check(createEnemyActionTargetSnapshot(0,battleToken).primary.index===index,'enemy selects Hero');
                finish=FourSymbolsBattleFlow.interceptActionFinish(()=>{finished++;return true;});battlePhase='resolve';activeBattleCharacterIndex=index;
                battleStatisticsBeginAction({type:'heroNpc',characterIndex:index});Math.random=()=>0;
                secondaryCharacterNormalAttack(index,0);await new Promise(r=>setTimeout(r,650));battleStatisticsFinishAction();check(enemy.hp<100000,'hero basic damage');
                const hitHp=enemy.hp;Math.random=()=>.99999;secondaryCharacterNormalAttack(index,0);await new Promise(r=>setTimeout(r,650));check(enemy.hp===hitHp,'hero basic MISS');
                h.activeBuffs=[]; // Foundation targeting excludes the separately verified Phase 2B Stealth passive.
                Math.random=()=>.99999;const target=createEnemyActionTargetSnapshot(0,battleToken);Math.random=()=>0;
                battleStatisticsBeginAction({type:'monster',monsterIndex:0});processSingleMonsterAttack(0,battleToken,target);await new Promise(r=>setTimeout(r,2200));battleStatisticsFinishAction();check(h.hp<hp,'hero incoming damage');
                const damaged=h.hp;Math.random=()=>.99999;processSingleMonsterAttack(0,battleToken,target);await new Promise(r=>setTimeout(r,2200));check(h.hp===damaged,'hero incoming MISS');
                const captureState=async(stage)=>{
                    updateSingleCharacterBars(index,h,getPartyBattleStats(index),true);
                    const card=document.getElementById('battlePlayerCard'+index),hud=FourSymbolsBattlePresentation.getUnitHud(card),art=card?.querySelector('.v174-battle-art');
                    const page=document.getElementById('battlePage'),rect=page?.getBoundingClientRect(),style=page&&getComputedStyle(page);
                    check(card&&hud&&art&&rect?.width>0&&rect?.height>0&&style?.display!=='none'&&style?.visibility==='visible'&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')&&document.getElementById('startupLoader')?.hidden===true,'visible battle and HUD for '+stage);
                    for(let node=page;node;node=node.parentElement){const x=getComputedStyle(node);check(x.display!=='none'&&x.visibility==='visible'&&Number(x.opacity)>0,'visible battle ancestor for '+stage);}
                    const hit=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,rect.left+rect.width/2)),Math.min(innerHeight-1,Math.max(0,rect.top+rect.height/2)));check(hit&&(page.contains(hit)||hit.closest('.v174-battle-hud-layer')),'battle center unobscured for '+stage);
                    const hudStyle=getComputedStyle(hud),hpBar=document.getElementById('battlePlayerHPBar'+index),paint=card.querySelector('.v174-portrait-paint');
                    check(hpBar&&hudStyle.display!=='none'&&hudStyle.visibility==='visible'&&Number(hudStyle.opacity)>0,'readable HUD and HP bar for '+stage);
                    const artFilter=getComputedStyle(art).filter,paintFilter=paint?getComputedStyle(paint).filter:'none',dim=(artFilter+' '+paintFilter).includes('brightness(0.4)');
                    check(stage==='dead'?Number.parseFloat(hpBar.style.width)===0&&dim:Number.parseFloat(hpBar.style.width)>0&&!dim,'HP and defeated filter for '+stage);
                    window.__lifecycleCapture={stage,index,hp:h.hp,down:card.classList.contains('down'),hudOpacity:hudStyle.opacity,hpBarWidth:hpBar.style.width,artFilter,paintFilter};
                    const deadline=Date.now()+30000;while(window.__lifecycleCapture&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));check(!window.__lifecycleCapture,'capture acknowledged '+stage);
                };
                if(count===1){check(h.hp>0,'pre-death HP positive');await captureState('before');}
                h.hp=0;if(count===1)await captureState('dead');check(!getLivingParty().includes(index),'death target exclusion');check(!buildInitiativeQueue().some(e=>e.characterIndex===index),'death initiative exclusion');
                const oldSnapshot=createEnemyActionTargetSnapshot(0,battleToken),statId=FourSymbolsBattleStatistics.getCombatantIdByBattleIndex(index);
                characterSkillLoadouts.fire.skillLevels.revive=1;characterSkillLoadouts.fire.equippedSkills=['revive'];player.sp=1000;activeBattleCharacterIndex=0;Math.random=()=>0;
                resolveQueuedPlayerAction(0,battleToken); // Empty queue only exercises the normal no-action finish.
                queuedPlayerActions[0]={action:'revive',targetAlly:index};battleStatisticsBeginAction({type:'player',characterIndex:0});resolveQueuedPlayerAction(0,battleToken);
                await new Promise(r=>setTimeout(r,2300));battleStatisticsFinishAction();
                if(count===1)await captureState('revived');
                check(h.hp>0&&getPartyCharacterByIndex(index)===h,'legal revive same identity');check(FourSymbolsBattleStatistics.getCombatantIdByBattleIndex(index)===statId,'revive same statistic ID');
                check(buildInitiativeQueue().some(e=>e.type==='heroNpc'&&e.characterIndex===index),'revive initiative');check(createEnemyActionTargetSnapshot(0,battleToken).targets.some(e=>e.character===h),'revive target');check(!resolveEnemyActionTargets(oldSnapshot,'all').targets.some(e=>e.character===h),'old snapshot stays closed');
                const stats=FourSymbolsBattleStatistics.getSnapshot().combatants.find(c=>c.id===statId);check(stats.damageDealt>0&&stats.damageTaken>0&&stats.criticalHits>0,'hero statistics settlement');
                h.activeBuffs.push({type:'dodgeSkill',percent:25,turnsLeft:1});check(getPartyBattleStats(index).evasion>=25,'shared Buff projection');h.statusEffects.push({type:'freeze',turnsLeft:1});check(!buildInitiativeQueue().some(e=>e.characterIndex===index),'hard control');
            }
            if(count===2){
                finish();finish=FourSymbolsBattleFlow.interceptActionFinish(()=>{notifyBattleActionFinished();finished++;return true;});
                const dog=getPartyCharacterByIndex(3),king=getPartyCharacterByIndex(4);
                for(const i of getExistingPartyIndexes()){const p=getPartyCharacterByIndex(i);p.hp=getPartyBattleStats(i).maxHP;p.activeBuffs=[];p.statusEffects=[];}
                dog.rage=0;dog.phoenixBurnStacks=0;dog.sp=0;
                const begin=(type,index)=>{const entry=type==='monster'?{type,monsterIndex:index}:{type,characterIndex:index};beginBattleDurationAction({token:battleToken,index:0,queue:[entry]});battleStatisticsBeginAction(entry);activeBattleCharacterIndex=index;};
                Math.random=()=>.99999;
                for(let n=0;n<4;n++){begin('heroNpc',3);secondaryCharacterNormalAttack(3,0);await new Promise(r=>setTimeout(r,700));}
                check(dog.rage===4&&dog.phoenixBurnStacks===4,'MISS basic Rage and Hongbao stacks');
                begin('heroNpc',3);queuedPlayerActions[3]={action:'normal',target:0};Math.random=()=>0;resolveQueuedPlayerAction(3,battleToken);
                await new Promise(r=>setTimeout(r,2300));check(dog.rage===0&&dog.phoenixBurnStacks===0&&dog.sp===0,'forced Core skill uses four Rage only');
                check(enemy.statusEffects.some(s=>s.type==='burn'),'Hero Phoenix shared Burn');
                for(const [sourceType,damageKind] of [['dot','dot'],['reflect','reflect'],['self','self'],['environment','environment']]){
                    begin('monster',0);settleBattleHpDamage(dog,1,{attacker:enemy,sourceType,damageKind});notifyBattleActionFinished();
                }
                check(dog.rage===0,'excluded damage never grants Rage');
                dog.activeBuffs=[];Math.random=()=>.7;const snapshot=createEnemyActionTargetSnapshot(0,battleToken);check(snapshot.primary.index===3,'Phase 2B enemy primary');
                begin('monster',0);Math.random=()=>.99999;processSingleMonsterAttack(0,battleToken,snapshot);await new Promise(r=>setTimeout(r,2300));check(dog.rage===1,'enemy MISS Rage');
                dog.activeBuffs=[markPersistentStateName({type:'shield',remaining:100000,turnsLeft:2},'shield')];const shieldHp=dog.hp;
                begin('monster',0);Math.random=()=>0;processSingleMonsterAttack(0,battleToken,snapshot);await new Promise(r=>setTimeout(r,2300));check(dog.hp===shieldHp&&dog.rage===2,'fully absorbed hit Rage');
                check(Math.abs(FourSymbolsBattlefieldRenderGeometry.getUnitGeometry('player',3).spProjection.ratio-2/12)<.00001,'Rage HUD geometry uses same resource projection');
                dog.hp=0;const retained=dog.rage;activeBattleCharacterIndex=0;player.sp=1000;castReviveSkill('revive',3);await new Promise(r=>setTimeout(r,2300));check(dog.hp>0&&dog.rage===retained,'death revival retains Rage');
                player.hp=1;king.rage=0;begin('heroNpc',4);Math.random=()=>.99999;secondaryCharacterNormalAttack(4,0);await new Promise(r=>setTimeout(r,700));
                check(hasNamedPersistentState(player,'stealthSkill')&&king.rage===1,'Vajra lowest HP Stealth on MISS');
                check(!canSelectHostileBattlePrimary('player',0,'single'),'Stealth targeting');consumeRoundEndDurations();check(!hasNamedPersistentState(player,'stealthSkill'),'Stealth one Round End');
                king.rage=4;king.sp=0;enemy.hp=100000;begin('heroNpc',4);queuedPlayerActions[4]={action:'normal',target:0};Math.random=()=>0;resolveQueuedPlayerAction(4,battleToken);
                await new Promise(r=>setTimeout(r,2300));check(king.rage===0&&king.sp===0&&enemy.hp<100000,'Hero Wind skill shared damage');
                for(const index of [3,4]){const path=getCharacterBattleArtworkPath(getPartyCharacterByIndex(index));const image=new Image();image.src=path;await image.decode();check(image.naturalWidth===1086&&image.naturalHeight===1448,'lossless portrait canvas');check(FourSymbolsBattlePresentation.getUnitHud(document.getElementById('battlePlayerCard'+index)).textContent.includes('怒氣'),'live Rage HUD');}
                initializeHeroBattleCombatants();check(getPartyCharacterByIndex(3).rage===0&&getPartyCharacterByIndex(3).phoenixBurnStacks===0,'fresh battle transient reset');
            }
            check(JSON.stringify(system.getDomain().serialize())===accountBytes,'battle state cannot mutate Hero Save');
            saveGame();const saved=JSON.parse(localStorage.getItem('four_symbols_save:skill-runtime-browser-qa'));check(JSON.stringify(saved.heroAccount)===accountBytes,'real save Hero isolation');check(Object.keys(saved.allyFormation.characterIndexToSlot).every(k=>Number(k)<3),'save excludes transient Hero slots');
            rows.push({count,units:cards.length,slots,initiative:queue.map(e=>e.type),statistics:initial.combatants.map(c=>c.kind),finished});
        }finally{Math.random=random;finish?.();pause();battleActive=false;clearInterval(timerId);clearTransientBattlePresentation();window.v142SkillAnimationDirector?.cancelAll?.();}
    }}finally{window.FourSymbolsHeroSystem=system;window.__heroQaOwned=[];await FourSymbolsHeroAcquisition.sync();system.replaceAccountState(beforeAccount);window.FourSymbolsTeamFormation=formationOwner;FourSymbolsBattlefieldSlots.hydrateAllyFormation(originalFormation,[0,1,2]);}
    return rows;
})()`;

const port=9800+Math.floor(Math.random()*100);
let client,server,profile,proc;
const evidence=[],visualProof=[];
try{
    let setupExpired=false;const pendingServer=startServer({baseUrl});pendingServer.then(value=>{if(setupExpired)value.server.close();},()=>{});
    let setupTimer;try{server=await Promise.race([pendingServer,new Promise((_,reject)=>{setupTimer=setTimeout(()=>reject(Error('server setup timed out')),30000);})]);}catch(error){setupExpired=true;throw error;}finally{clearTimeout(setupTimer);}
    profile=fs.mkdtempSync(path.join(os.tmpdir(),'battle-target-qa-'));
    proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(t=>t.type==='page');
    client=new Cdp(page.webSocketDebuggerUrl);const rawSend=client.send.bind(client);client.send=(method,params)=>{const ms=method==='Runtime.evaluate'&&(params?.expression===heroExpression||params?.expression===expression)?600000:30000;return new Promise((resolve,reject)=>{const t=setTimeout(()=>{client.close();reject(Error('CDP '+method+' timed out'));},ms);rawSend(method,params).then(x=>{clearTimeout(t);resolve(x);},e=>{clearTimeout(t);reject(e);});});};await client.send('Page.enable');await client.send('Runtime.enable');
    await client.send('Page.navigate',{url:server.url});
    for(const [width,height] of [[390,844],[412,915]]){
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        let heroesDone=false,heroesError=null,heroes;
        const heroTask=client.eval(heroExpression).then(value=>{heroes=value;heroesDone=true;},error=>{heroesError=error;heroesDone=true;});
        const captureDeadline=Date.now()+600000;
        while(!heroesDone){
            if(Date.now()>captureDeadline)throw Error('hero capture deadline exceeded');
            const state=await client.eval('window.__lifecycleCapture||null');
            if(state){
                assert.ok(['before','dead','revived'].includes(state.stage),'known lifecycle stage');
                assert.equal(state.down,state.stage==='dead','down class follows HP');
                if(state.stage==='dead')assert.equal(state.hp,0);else assert.ok(state.hp>0);
                const shot=await client.send('Page.captureScreenshot',{format:'png'}),bytes=Buffer.from(shot.data,'base64');
                visualProof.push({width,height,...state,expected,file:'battle-target-lifecycle-'+width+'-'+state.stage+'.png',sha256:createHash('sha256').update(bytes).digest('hex'),bytes});
                await client.eval('window.__lifecycleCapture=null');
            }else await new Promise(resolve=>setTimeout(resolve,50));
        }
        await heroTask;if(heroesError)throw heroesError;
        assert.deepEqual(visualProof.filter(item=>item.width===width).map(item=>item.stage),['before','dead','revived'],'ordered lifecycle captures per viewport');
        assert.equal(new Set(visualProof.filter(item=>item.width===width).map(item=>item.index)).size,1,'same ally across lifecycle');
        assert.deepEqual(heroes.map(r=>r.count),[0,1,2,3]);
        evidence.push({width,height,heroes});
        const heroPng=await client.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(out,'hero-phase2b-'+width+'.png'),Buffer.from(heroPng.data,'base64'),{flag:'wx'});
        const rows=await client.eval(expression);
        evidence.push({width,height,rows});
        assert.equal(rows.length,24);
        for(const r of rows){
            assert.equal(r.finished,1);assert.equal(r.visible,true);assert.ok(r.hits.some(h=>h.critical===true));
            const target=r.scenario.startsWith('revived')?1:0;
            assert.equal(r.primary,target);assert.ok(r.badges.length>0);
            const primaries=r.badges.map(b=>b.primary);
            const expectedTargets=r.scenario==='lethal'?[0,2]:r.scenario==='dragon-lethal'?[0,2,1]:
                r.scenario==='dragon-surviving'?[0,2,2]:r.scenario==='revived-lethal'?[1,2]:[target,target];
            // .9 selects C from B/C; a surviving new primary remains locked.
            assert.deepEqual(primaries,expectedTargets);
            assert.deepEqual(r.hits.map(h=>h.index),expectedTargets);
            assert.ok(r.badges.every(b=>b.targets.length===1&&b.targets[0]===b.primary));
            const attacked=new Set(expectedTargets);
            r.after.forEach((hp,index)=>{if(!attacked.has(index))assert.equal(hp,r.before[index]);});
            if(r.scenario.startsWith('revived')){assert.deepEqual(r.snapshot,[1,2]);assert.equal(r.after[0],r.before[0]);}
            if(r.scenario==='lethal'||r.scenario.startsWith('dragon'))assert.equal(r.after[0],0);
            if(r.scenario==='revived-lethal')assert.equal(r.after[1],0);
            assert.ok(r.beforeSp>=r.cost,'formal initial SP is sufficient');
            assert.equal(r.sp,r.beforeSp-r.cost,'original cost once; follow-up free');
        }
        const png=await client.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(out,'battle-target-'+width+'.png'),Buffer.from(png.data,'base64'),{flag:'wx'});
    }
    assert.equal(visualProof.length,6,'three lifecycle images for both viewport sizes');
    for(const item of visualProof){const output=path.join(out,item.file);assert.equal(fs.existsSync(output),false,'refusing to overwrite lifecycle evidence');fs.writeFileSync(output,item.bytes,{flag:'wx'});}
    const visual=visualProof.map(({bytes,...item})=>item);
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:true,expected,baseUrl,evidence,visual},null,2)+'\n',{flag:'wx'});
    console.log('Battle target lifecycle: 48 full-production mobile browser scenarios PASS');
}catch(error){
    try{fs.writeFileSync(path.join(out,'battle-target-failure-'+Date.now()+'-'+process.pid+'.json'),JSON.stringify({passed:false,expected,baseUrl,evidence,error:String(error.stack||error),events:client?.events.slice(-15)},null,2)+'\n',{flag:'wx'});}catch(writeError){console.error('Failure evidence unavailable:',writeError.message);}throw error;
}finally{
    client?.close();if(proc)proc.kill('SIGTERM');
    if(profile)fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
    if(server)await Promise.race([new Promise(resolve=>server.server.close(resolve)),new Promise(resolve=>setTimeout(()=>{server.server.closeAllConnections?.();resolve();},5000))]);
}
