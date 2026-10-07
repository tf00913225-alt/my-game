import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
if(baseUrl){
    const manifest=await (await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'})).json();
    assert.equal(manifest.commitSha,expected,'live QA must use exact deployed SHA');
}
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
    const system=FourSymbolsHeroSystem;const ids=FourSymbolsHeroCore.listHeroDefinitions().map(d=>d.heroId);
    const beforeAccount=system.getDomain().serialize();let account=beforeAccount;
    for(const id of ids){if(!FourSymbolsHeroCore.createDomain(account,getCharacters,calculateCharacterBaseStats,id=>skillDatabase[id]).isHeroUnlocked(id))account=FourSymbolsHeroCore.createDomain(account,getCharacters,calculateCharacterBaseStats,id=>skillDatabase[id]).unlockHeroDirect(id,123);}
    system.replaceAccountState(account);const accountBytes=JSON.stringify(account);
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
        FourSymbolsHeroBattle.setRoster([...ids,third].slice(0,count));
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
                h.hp=0;check(!getLivingParty().includes(index),'death target exclusion');check(!buildInitiativeQueue().some(e=>e.characterIndex===index),'death initiative exclusion');
                const oldSnapshot=createEnemyActionTargetSnapshot(0,battleToken),statId=FourSymbolsBattleStatistics.getCombatantIdByBattleIndex(index);
                characterSkillLoadouts.fire.skillLevels.revive=1;characterSkillLoadouts.fire.equippedSkills=['revive'];player.sp=1000;activeBattleCharacterIndex=0;Math.random=()=>0;
                resolveQueuedPlayerAction(0,battleToken); // Empty queue only exercises the normal no-action finish.
                queuedPlayerActions[0]={action:'revive',targetAlly:index};battleStatisticsBeginAction({type:'player',characterIndex:0});resolveQueuedPlayerAction(0,battleToken);
                await new Promise(r=>setTimeout(r,2300));battleStatisticsFinishAction();
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
                for(const index of [3,4]){const path=getCharacterBattleArtworkPath(getPartyCharacterByIndex(index));const image=new Image();image.src=path;await image.decode();check(image.naturalWidth===1086&&image.naturalHeight===1448,'lossless portrait canvas');check(document.getElementById('battlePlayerCard'+index).textContent.includes('怒氣'),'live Rage HUD');}
                initializeHeroBattleCombatants();check(getPartyCharacterByIndex(3).rage===0&&getPartyCharacterByIndex(3).phoenixBurnStacks===0,'fresh battle transient reset');
            }
            check(JSON.stringify(system.getDomain().serialize())===accountBytes,'battle state cannot mutate Hero Save');
            saveGame();const saved=JSON.parse(localStorage.getItem('four_symbols_save:skill-runtime-browser-qa'));check(JSON.stringify(saved.heroAccount)===accountBytes,'real save Hero isolation');check(Object.keys(saved.allyFormation.characterIndexToSlot).every(k=>Number(k)<3),'save excludes transient Hero slots');
            rows.push({count,units:cards.length,slots,initiative:queue.map(e=>e.type),statistics:initial.combatants.map(c=>c.kind),finished});
        }finally{Math.random=random;finish?.();pause();battleActive=false;clearInterval(timerId);clearTransientBattlePresentation();window.v142SkillAnimationDirector?.cancelAll?.();}
    }}finally{window.FourSymbolsHeroSystem=system;system.replaceAccountState(beforeAccount);FourSymbolsHeroBattle.setRoster([]);FourSymbolsBattlefieldSlots.hydrateAllyFormation(originalFormation,[0,1,2]);}
    return rows;
})()`;

const server=await startServer({baseUrl});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'battle-target-qa-'));
const port=9800+Math.floor(Math.random()*100);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let client;
const out=path.join(ROOT,'artifacts/browser-qa');fs.mkdirSync(out,{recursive:true});
const evidence=[];
try{
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(t=>t.type==='page');
    client=new Cdp(page.webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');
    await client.send('Page.navigate',{url:server.url});
    for(const [width,height] of [[390,844],[412,915]]){
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        const heroes=await client.eval(heroExpression);
        assert.deepEqual(heroes.map(r=>r.count),[0,1,2,3]);
        evidence.push({width,height,heroes});
        const heroPng=await client.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(out,'hero-phase2b-'+width+'.png'),Buffer.from(heroPng.data,'base64'));
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
        fs.writeFileSync(path.join(out,'battle-target-'+width+'.png'),Buffer.from(png.data,'base64'));
    }
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:true,expected,baseUrl,evidence},null,2)+'\n');
    console.log('Battle target lifecycle: 48 full-production mobile browser scenarios PASS');
}catch(error){
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:false,expected,baseUrl,evidence,error:String(error.stack||error),events:client?.events.slice(-15)},null,2)+'\n');throw error;
}finally{
    client?.close();proc.kill('SIGTERM');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
    await new Promise(resolve=>server.server.close(resolve));
}
