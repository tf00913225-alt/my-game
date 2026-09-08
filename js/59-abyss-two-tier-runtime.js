/* =====================================================
   Abyss Two-Tier Runtime — fixed Lv20/Lv40 Void Five Emperors
   Formal successor for the legacy five-floor Abyss flow.
   Reuses v132 dungeon monster construction / battle launcher and the existing
   combat engine; only Abyss difficulty, progression, rewards and presentation
   are owned here.
===================================================== */
(function installTwoTierAbyssRuntime(){
    "use strict";

    if(typeof window==="undefined"||window.__v174TwoTierAbyssInstalled){ return; }
    window.__v174TwoTierAbyssInstalled=true;

    const STORAGE_KEY="v174_abyss_state_v2";
    const LEGACY_STORAGE_KEY="v141_abyss_state";
    const STATE_VERSION=2;
    const PRE_STAGE_COUNT=4;
    const PRE_STAGE_REGULAR_COUNT=5;
    const PRE_STAGE_ELITE_COUNT=3;
    const STAGES_PER_REGION=5;
    const REGION_COUNT=5;
    const HP_DURABILITY_MULTIPLIER=1.875;

    const ABYSS_DIFFICULTIES=Object.freeze({
        20:Object.freeze({
            id:20,title:"虛空五帝・初境",shortTitle:"初境",unlockLevel:20,
            monsterLevel:20,skillLevel:1,stageHpMultipliers:Object.freeze([0.90,0.95,1.00,1.05]),
            bossEliteHpMultiplier:1.10,bossHpMultiplier:1.60,
            normalGold:120,emperorGold:500,finalGold:1500,finalExp:600,
            cover:"assets/dungeons/abyss/abyss-cover.webp"
        }),
        40:Object.freeze({
            id:40,title:"虛空五帝・真境",shortTitle:"真境",unlockLevel:40,
            monsterLevel:40,skillLevel:2,stageHpMultipliers:Object.freeze([0.90,0.95,1.00,1.05]),
            bossEliteHpMultiplier:1.10,bossHpMultiplier:1.60,
            normalGold:220,emperorGold:900,finalGold:3000,finalExp:1200,
            cover:"assets/dungeons/abyss/abyss-cover-v17343.png"
        })
    });

    const ABYSS_REGIONS=Object.freeze([
        Object.freeze({
            id:"east",name:"東帝領域",emperor:"東帝",element:"earth",elementLabel:"土",
            bossSkills:Object.freeze(["flyingSandStrike","dustStorm","stoneSlash"]),bossSupports:Object.freeze([]),
            ticketId:"ticketSetEarth",bossEntry:"進入東帝王座",bossArt:"assets/dungeons/abyss/east-emperor.webp"
        }),
        Object.freeze({
            id:"south",name:"南帝領域",emperor:"南帝",element:"fire",elementLabel:"火",
            bossSkills:Object.freeze(["explosiveFlurry","dragonSlash","fireRocket"]),bossSupports:Object.freeze([]),
            ticketId:"ticketSetFire",bossEntry:"進入南帝炎宮",bossArt:"assets/dungeons/abyss/south-emperor.webp"
        }),
        Object.freeze({
            id:"heaven",name:"天帝領域",emperor:"天帝",element:"wind",elementLabel:"風",
            bossSkills:Object.freeze(["windHowlLightning","stormFlurry","windCrossSlash"]),bossSupports:Object.freeze([]),
            ticketId:"ticketSetWind",bossEntry:"踏入天帝天域",bossArt:"assets/dungeons/abyss/heaven-emperor.webp"
        }),
        Object.freeze({
            id:"north",name:"北帝領域",emperor:"北帝",element:"water",elementLabel:"水",
            bossSkills:Object.freeze(["floodBeast","frostPunch","waterKnife"]),bossSupports:Object.freeze([]),
            ticketId:"ticketSetWater",bossEntry:"進入北帝寒境",bossArt:"assets/dungeons/abyss/north-emperor.webp"
        }),
        Object.freeze({
            id:"extreme",name:"極帝領域",emperor:"極帝天尊",displayEmperor:"極帝",element:"light",elementLabel:"光",
            bossSkills:Object.freeze([]),bossSupports:Object.freeze(["yuanZuBlessing"]),
            ticketId:null,bossEntry:"踏入極帝神域",bossArt:"assets/dungeons/abyss/floor5-extreme-emperor.webp"
        })
    ]);

    const FINAL_TRUE_REALM_EMPERORS=Object.freeze([
        Object.freeze({name:"東帝天尊",regionIndex:0}),
        Object.freeze({name:"天帝天尊",regionIndex:2}),
        Object.freeze({name:"極帝天尊",regionIndex:4}),
        Object.freeze({name:"北帝天尊",regionIndex:3}),
        Object.freeze({name:"南帝天尊",regionIndex:1})
    ]);

    const BOSS_POSITIONS=Object.freeze([[50,27],[50,27],[50,25],[50,27],[50,24]]);
    const FLOOR_MAPS=Object.freeze([
        "assets/dungeons/abyss/maps/floor-1.png",
        "assets/dungeons/abyss/maps/floor-2.png",
        "assets/dungeons/abyss/maps/floor-3.png",
        "assets/dungeons/abyss/maps/floor-4.png",
        "assets/dungeons/abyss/maps/floor-5.png"
    ]);

    function numeric(value,fallback){
        const result=Number(value);
        return Number.isFinite(result)?result:(fallback===undefined?0:fallback);
    }
    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function difficultyConfig(level){ return ABYSS_DIFFICULTIES[Number(level)===40?40:20]; }
    function stageKey(run){ return "d"+run.difficulty+"-r"+run.regionIndex+"-s"+run.encounterIndex; }
    function isBossStage(run){ return Number(run.encounterIndex)===PRE_STAGE_COUNT; }
    function isFinalBossStage(run){ return Number(run.regionIndex)===REGION_COUNT-1&&isBossStage(run); }
    function isTrueRealmFinal(level,regionIndex,encounterIndex){
        return Number(level)===40&&Number(regionIndex)===REGION_COUNT-1&&Number(encounterIndex)===PRE_STAGE_COUNT;
    }
    function stageLabel(run){ return isBossStage(run)?"帝王 BOSS":"前置關 "+(Number(run.encounterIndex)+1)+" / 4"; }
    function fiveStageProgress(run){ return (Number(run.encounterIndex)+1)+" / 5"; }

    function defaultRun(level){
        return {
            difficulty:Number(level)===40?40:20,
            active:false,regionIndex:0,encounterIndex:0,isBoss:false,
            phase:"ready",battleCompleted:false,chestSpawned:false,chestClaimed:false,
            portalUnlocked:false,regionCompleted:false,completed:false,clears:0,
            completedRegions:[false,false,false,false,false],completedStages:{},rewardClaims:{},
            x:50,y:84,message:""
        };
    }
    function defaultRoot(){
        return {version:STATE_VERSION,selectedDifficulty:null,legacyMigrated:false,runs:{20:defaultRun(20),40:defaultRun(40)}};
    }

    function normalizeRun(raw,level){
        const source=raw&&typeof raw==="object"?raw:{};
        const run=Object.assign(defaultRun(level),source);
        run.difficulty=Number(level)===40?40:20;
        run.regionIndex=clamp(Math.floor(numeric(run.regionIndex,0)),0,REGION_COUNT-1);
        run.encounterIndex=clamp(Math.floor(numeric(run.encounterIndex,0)),0,STAGES_PER_REGION-1);
        run.isBoss=isBossStage(run);
        run.x=clamp(numeric(run.x,50),4,96);
        run.y=clamp(numeric(run.y,84),8,94);
        run.completedRegions=Array.from({length:REGION_COUNT},(_,index)=>!!(Array.isArray(source.completedRegions)&&source.completedRegions[index]));
        run.completedStages=source.completedStages&&typeof source.completedStages==="object"?Object.assign({},source.completedStages):{};
        run.rewardClaims=source.rewardClaims&&typeof source.rewardClaims==="object"?Object.assign({},source.rewardClaims):{};
        const key=stageKey(run);
        const claim=run.rewardClaims[key];
        if(claim&&(claim.status==="granting"||claim.status==="claimed")){
            run.battleCompleted=true;
            run.chestSpawned=false;
            run.chestClaimed=true;
            run.completedStages[key]=true;
            if(isBossStage(run)){
                run.completedRegions[run.regionIndex]=true;
                run.regionCompleted=true;
            }
            if(isFinalBossStage(run)){
                run.completed=true;
                run.phase="complete";
                run.portalUnlocked=false;
            }else{
                run.phase="portal";
                run.portalUnlocked=true;
            }
        }else if(run.completed){
            run.phase="complete";
            run.battleCompleted=true;
            run.chestSpawned=false;
            run.chestClaimed=true;
            run.portalUnlocked=false;
            run.completedRegions=[true,true,true,true,true];
            run.regionCompleted=true;
        }else if(run.battleCompleted&&!run.chestClaimed){
            run.phase="chest";
            run.chestSpawned=true;
            run.portalUnlocked=false;
        }else if(run.chestClaimed){
            run.phase="portal";
            run.chestSpawned=false;
            run.portalUnlocked=true;
        }else{
            run.phase="ready";
            run.battleCompleted=false;
            run.chestSpawned=false;
            run.chestClaimed=false;
            run.portalUnlocked=false;
        }
        run.regionCompleted=!!run.completedRegions[run.regionIndex];
        run.active=!!run.active||run.completed||run.regionIndex>0||run.encounterIndex>0||Object.keys(run.completedStages).length>0;
        return run;
    }

    function migrateLegacy(root){
        if(root.legacyMigrated){ return root; }
        let legacy=null;
        try{ legacy=JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)||"null"); }catch(_){ legacy=null; }
        if(legacy&&typeof legacy==="object"&&(legacy.active||legacy.phase||legacy.floor||legacy.clears)){
            const run=defaultRun(40);
            run.active=!!legacy.active;
            run.clears=Math.max(0,Math.floor(numeric(legacy.clears,0)));
            run.regionIndex=clamp(Math.floor(numeric(legacy.floor,1))-1,0,REGION_COUNT-1);
            run.encounterIndex=PRE_STAGE_COUNT;
            run.isBoss=true;
            run.x=clamp(numeric(legacy.x,50),4,96);
            run.y=clamp(numeric(legacy.y,84),8,94);
            const legacyPhase=String(legacy.phase||"boss");
            if(legacyPhase==="complete"){
                run.completed=true;run.active=true;run.phase="complete";run.battleCompleted=true;run.chestClaimed=true;
                run.completedRegions=[true,true,true,true,true];run.regionCompleted=true;
            }else{
                for(let index=0;index<run.regionIndex;index++){ run.completedRegions[index]=true; }
                if(legacyPhase==="chest"){
                    run.battleCompleted=true;run.chestSpawned=true;run.phase="chest";
                }else if(legacyPhase==="portal"){
                    const key=stageKey(run);
                    run.battleCompleted=true;run.chestClaimed=true;run.portalUnlocked=run.regionIndex<REGION_COUNT-1;
                    run.completedStages[key]=true;run.completedRegions[run.regionIndex]=true;run.regionCompleted=true;
                    run.rewardClaims[key]={status:"claimed",migrated:true};
                    run.phase=run.regionIndex<REGION_COUNT-1?"portal":"complete";
                    if(run.regionIndex===REGION_COUNT-1){ run.completed=true; }
                }
            }
            run.message="舊版深淵進度已安全遷移至虛空五帝・真境。";
            root.runs[40]=normalizeRun(run,40);
        }
        root.legacyMigrated=true;
        return root;
    }

    function loadRoot(){
        let parsed=null;
        try{ parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null"); }catch(_){ parsed=null; }
        const root=defaultRoot();
        if(parsed&&typeof parsed==="object"){
            root.selectedDifficulty=Number(parsed.selectedDifficulty)===20||Number(parsed.selectedDifficulty)===40?Number(parsed.selectedDifficulty):null;
            root.legacyMigrated=!!parsed.legacyMigrated;
            root.runs[20]=normalizeRun(parsed.runs&&parsed.runs[20],20);
            root.runs[40]=normalizeRun(parsed.runs&&parsed.runs[40],40);
        }
        return migrateLegacy(root);
    }

    let rootState=loadRoot();
    let mapEntered=false;
    let battleStarting=false;
    let movementState=null;
    let interactionState=null;
    let actionSequence=0;

    function clearTransientActions(){
        movementState=null;
        interactionState=null;
    }
    function beginInteraction(kind,key){
        if(interactionState||movementState){ return null; }
        interactionState={id:++actionSequence,kind:String(kind||"action"),key:String(key||"")};
        return interactionState;
    }
    function releaseInteraction(lock){
        if(lock&&interactionState===lock){ interactionState=null; }
    }

    function normalizeRunInPlace(level){
        const key=Number(level)===40?40:20;
        const current=rootState.runs[key]&&typeof rootState.runs[key]==="object"?rootState.runs[key]:defaultRun(key);
        const normalized=normalizeRun(current,key);
        Object.keys(current).forEach(function(property){
            if(!Object.prototype.hasOwnProperty.call(normalized,property)){ delete current[property]; }
        });
        Object.assign(current,normalized);
        rootState.runs[key]=current;
        return current;
    }

    function persist(){
        rootState.version=STATE_VERSION;
        normalizeRunInPlace(20);
        normalizeRunInPlace(40);
        try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(rootState)); }catch(_){ }
    }
    persist();

    function patchExistingV143ExplosiveFlurryRenderer(){
        const manifest=window.v143SkillAnimationManifest;
        const sprite=manifest&&manifest.explosiveFlurry&&manifest.explosiveFlurry.sprite;
        if(!sprite){ return false; }
        Object.assign(sprite,{
            renderer:"canvas-crop",frameWidth:384,frameHeight:384,naturalGrid:true,alignToSlots:true
        });
        return true;
    }
    patchExistingV143ExplosiveFlurryRenderer();

    function highestCharacterLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel==="function"){
            return Math.max(1,Math.floor(numeric(window.v133GetHighestCreatedCharacterLevel(),1)));
        }
        if(typeof window.v141GetHighestCharacterLevel==="function"){
            return Math.max(1,Math.floor(numeric(window.v141GetHighestCharacterLevel(),1)));
        }
        const candidates=[];
        [typeof player!=="undefined"?player:null,typeof player2!=="undefined"?player2:null,typeof player3!=="undefined"?player3:null]
            .forEach(character=>{ if(character&&character.id){ candidates.push(numeric(character.level,1)); } });
        return candidates.length?Math.max.apply(null,candidates):1;
    }
    function isUnlocked(level){ return highestCharacterLevel()>=difficultyConfig(level).unlockLevel; }
    function currentRun(){
        const level=Number(rootState.selectedDifficulty);
        return level===20||level===40?rootState.runs[level]:null;
    }
    function currentRegion(run){ return ABYSS_REGIONS[clamp(Math.floor(numeric(run&&run.regionIndex,0)),0,REGION_COUNT-1)]; }

    function applyHpMultiplier(monster,multiplier){
        const scale=Math.max(0.01,numeric(multiplier,1))*HP_DURABILITY_MULTIPLIER;
        monster.maxHP=Math.max(1,Math.round(numeric(monster.maxHP,1)*scale));
        monster.hp=monster.maxHP;
        monster.v174AbyssHpMultiplier=scale;
        monster.v174AbyssDurabilityMultiplier=HP_DURABILITY_MULTIPLIER;
        delete monster.v141ExtraHP;
        return monster;
    }

    function makeAbyssMonster(name,config,region,rank,hpMultiplier,boss){
        if(typeof window.v132BuildDungeonMonster!=="function"){
            throw new Error("Abyss requires v132BuildDungeonMonster runtime owner.");
        }
        const monster=window.v132BuildDungeonMonster(name,config.monsterLevel,region.element,rank);
        applyHpMultiplier(monster,hpMultiplier);
        monster.v141Abyss=true;
        monster.v174TwoTierAbyss=true;
        monster.v174AbyssDifficulty=config.id;
        monster.v174AbyssRegion=region.id;
        monster.level=config.monsterLevel;
        monster.v132FixedSkillLoadout=true;
        monster.v141ForceSkillLevel=config.skillLevel;
        monster.v141SkillLevel=config.skillLevel;
        monster.v144SkillLevel=config.skillLevel;
        monster.activeBuffs=[];
        if(boss){
            monster.skillIds=region.bossSkills.slice();
            monster.v141SupportSkillIds=region.bossSupports.slice();
            monster.skillChance=region.id==="extreme"?0.78:0.72;
            if(region.id==="extreme"){ monster.v141AbyssAi="support"; }
        }else{
            monster.skillIds=Array.isArray(monster.skillIds)?monster.skillIds.slice():[];
            monster.v141SupportSkillIds=[];
        }
        return monster;
    }

    function buildTrueRealmFinalRoster(config){
        const roster=[];
        FINAL_TRUE_REALM_EMPERORS.forEach((definition,position)=>{
            const emperorRegion=ABYSS_REGIONS[definition.regionIndex];
            const boss=makeAbyssMonster(definition.name,config,emperorRegion,"boss",config.bossHpMultiplier,true);
            boss.v141FormationRow=0;
            boss.v141FormationPosition=position;
            boss.v174TrueRealmFinal=true;
            roster.push(boss);
        });
        for(let position=0;position<5;position++){
            const elite=makeAbyssMonster("天兵天將",config,ABYSS_REGIONS[4],"elite",config.bossEliteHpMultiplier,false);
            elite.v141FormationRow=1;
            elite.v141FormationPosition=position;
            elite.v174TrueRealmFinal=true;
            roster.push(elite);
        }
        return roster;
    }

    function buildRoster(level,regionIndex,encounterIndex){
        const config=difficultyConfig(level);
        const safeRegionIndex=clamp(Math.floor(numeric(regionIndex,0)),0,REGION_COUNT-1);
        const region=ABYSS_REGIONS[safeRegionIndex];
        const stage=clamp(Math.floor(numeric(encounterIndex,0)),0,STAGES_PER_REGION-1);
        const roster=[];
        if(stage<PRE_STAGE_COUNT){
            const hpMultiplier=config.stageHpMultipliers[stage];
            for(let index=0;index<PRE_STAGE_REGULAR_COUNT;index++){
                const monster=makeAbyssMonster("天兵天將",config,region,"regular",hpMultiplier,false);
                monster.v141FormationRow=1;monster.v141FormationPosition=index;roster.push(monster);
            }
            for(let index=0;index<PRE_STAGE_ELITE_COUNT;index++){
                const monster=makeAbyssMonster("天兵天將",config,region,"elite",hpMultiplier,false);
                monster.v141FormationRow=0;monster.v141FormationPosition=index;roster.push(monster);
            }
            return roster;
        }
        if(isTrueRealmFinal(config.id,safeRegionIndex,stage)){
            return buildTrueRealmFinalRoster(config);
        }
        for(let position=0;position<5;position++){
            if(position===2){
                const boss=makeAbyssMonster(region.emperor,config,region,"boss",config.bossHpMultiplier,true);
                boss.v141FormationRow=0;boss.v141FormationPosition=2;roster.push(boss);
            }else{
                const elite=makeAbyssMonster("天兵天將",config,region,"elite",config.bossEliteHpMultiplier,false);
                elite.v141FormationRow=0;elite.v141FormationPosition=position;roster.push(elite);
            }
        }
        for(let position=1;position<=3;position++){
            const elite=makeAbyssMonster("天兵天將",config,region,"elite",config.bossEliteHpMultiplier,false);
            elite.v141FormationRow=1;elite.v141FormationPosition=position;roster.push(elite);
        }
        return roster;
    }

    function cardProgress(run){
        if(run.completed){ return "已通關"; }
        if(!run.active){ return "尚未開始"; }
        const region=currentRegion(run);
        let detail=stageLabel(run);
        if(run.battleCompleted&&!run.chestClaimed){ detail+="・寶箱待領"; }
        else if(run.portalUnlocked){ detail+="・傳送點已開啟"; }
        return region.name+"・"+detail;
    }
    function cardStatus(run,locked){
        if(locked){ return {label:"未解鎖",action:"Lv"+run.difficulty+" 解鎖",className:"locked"}; }
        if(run.completed){ return {label:"已通關",action:"查看／重新挑戰",className:"complete"}; }
        if(run.active){ return {label:"攻略中",action:"繼續探索",className:"active"}; }
        return {label:"可挑戰",action:"開始挑戰",className:"ready"};
    }
    function renderDifficultyCard(level){
        const config=difficultyConfig(level),run=rootState.runs[level],locked=!isUnlocked(level),status=cardStatus(run,locked);
        return '<article class="v174-abyss-card '+status.className+'" data-difficulty="'+level+'">'+
            '<img class="v174-abyss-card-cover" src="'+config.cover+'" alt="'+escapeHtml(config.title)+'副本封面">'+
            '<div class="v174-abyss-card-shade"></div><div class="v174-abyss-card-copy">'+
            '<span class="v174-abyss-level">Lv'+level+'</span><div class="v174-abyss-card-title"><b>虛空五帝</b><strong>'+escapeHtml(config.shortTitle)+'</strong></div>'+
            '<span class="v174-abyss-state">'+escapeHtml(status.label)+'</span><small>'+escapeHtml(cardProgress(run))+'</small></div>'+
            (locked?'<div class="v174-abyss-lock"><span aria-hidden="true">鎖</span><b>Lv'+level+' 解鎖</b></div>':'')+
            '<button type="button" '+(locked?'disabled aria-disabled="true"':'onclick="v174AbyssSelectDifficulty('+level+')"')+'>'+escapeHtml(status.action)+'</button></article>';
    }
    function renderSelection(){
        return '<div class="v141-abyss-intro v174-abyss-selection"><header class="v174-abyss-selection-head"><span>深淵副本</span><b>虛空五帝</b><small>固定境界・力量成長不再被深淵同步追趕</small></header><div class="v174-abyss-card-list">'+renderDifficultyCard(20)+renderDifficultyCard(40)+'</div></div>';
    }
    function nodeClass(run,index){
        const key="d"+run.difficulty+"-r"+run.regionIndex+"-s"+index;
        if(run.completedStages[key]){ return "done"; }
        if(index===run.encounterIndex){ return run.battleCompleted&&!run.chestClaimed?"current pending":"current"; }
        return index<run.encounterIndex?"done":"locked";
    }
    function renderStageNodes(run){
        return '<div class="v174-abyss-nodes" aria-label="本區五關進度">'+Array.from({length:STAGES_PER_REGION},(_,index)=>{
            const boss=index===PRE_STAGE_COUNT;
            return '<span class="v174-abyss-node '+(boss?'boss ':'')+nodeClass(run,index)+'" title="'+(boss?'帝王 BOSS':'前置關 '+(index+1))+'"><i>'+(boss?'帝':String(index+1))+'</i></span>';
        }).join('<em></em>')+'</div>';
    }
    function renderEncounterControl(run,region){
        if(run.phase!=="ready"||run.battleCompleted){ return ""; }
        const pos=BOSS_POSITIONS[run.regionIndex]||BOSS_POSITIONS[0];
        if(isBossStage(run)){
            return '<button type="button" class="v174-abyss-encounter boss" style="left:'+pos[0]+'%;top:'+pos[1]+'%" onclick="event.stopPropagation();v174AbyssStartEncounter(event)"><span class="v174-abyss-boss-portrait" style="background-image:url(\''+region.bossArt+'\')"></span><b>'+escapeHtml(region.displayEmperor||region.emperor)+'</b><small>帝王 BOSS・點擊挑戰</small></button>';
        }
        return '<button type="button" class="v174-abyss-encounter trial" style="left:'+pos[0]+'%;top:'+pos[1]+'%" onclick="event.stopPropagation();v174AbyssStartEncounter(event)"><i>'+String(run.encounterIndex+1)+'</i><b>領域試煉</b><small>前置關 '+String(run.encounterIndex+1)+' / 4</small></button>';
    }
    function renderChest(run){
        if(!run.chestSpawned||run.chestClaimed||run.phase!=="chest"){ return ""; }
        const pos=BOSS_POSITIONS[run.regionIndex]||BOSS_POSITIONS[0];
        return '<button type="button" class="v141-abyss-chest v174-abyss-chest" style="left:'+pos[0]+'%;top:'+pos[1]+'%" onclick="event.stopPropagation();v174AbyssClaimChest()"><i></i><span>'+(isBossStage(run)?"帝王寶箱":"深淵寶箱")+'・待領</span></button>';
    }
    function portalLabel(run,region){
        if(run.encounterIndex===PRE_STAGE_COUNT-1){ return region.bossEntry; }
        if(isBossStage(run)&&run.regionIndex<REGION_COUNT-1){ return "前往"+ABYSS_REGIONS[run.regionIndex+1].name; }
        return "前往下一關";
    }
    function renderPortal(run,region){
        if(!run.portalUnlocked||!run.chestClaimed||run.phase!=="portal"||run.completed){ return ""; }
        const bossGate=run.encounterIndex===PRE_STAGE_COUNT-1;
        return '<button type="button" class="v141-abyss-portal v174-abyss-portal '+(bossGate?'boss-gate':'')+'" style="left:50%;top:10%" onclick="event.stopPropagation();v174AbyssUsePortal()"><i></i><span>'+escapeHtml(portalLabel(run,region))+'</span></button>';
    }
    function renderCompletion(run){
        const config=difficultyConfig(run.difficulty);
        return '<div class="v141-abyss-intro complete v174-abyss-complete"><div class="v174-abyss-complete-seal">破</div><h3>'+escapeHtml(config.title)+' 已通關</h3><p>極帝寶箱已領取，本次 25 場深淵進度正式完成。</p><div class="v174-abyss-complete-actions"><button type="button" onclick="v174AbyssReset('+run.difficulty+')">重新挑戰</button><button type="button" onclick="v174AbyssBackToSelection()">返回深淵選擇</button></div></div>';
    }
    function renderMap(run){
        const config=difficultyConfig(run.difficulty),region=currentRegion(run),map=FLOOR_MAPS[run.regionIndex];
        const message=run.message||(!run.battleCompleted?(isBossStage(run)?"帝王氣息逼近。前往王座發起挑戰。":"點擊試煉印記，進入本區前置戰。"):(run.chestClaimed?"寶箱已領取，傳送點已解鎖。":"戰鬥已完成，請走到寶箱領取獎勵。"));
        return '<div class="v141-abyss-shell v174-abyss-shell" data-difficulty="'+run.difficulty+'" data-region="'+region.id+'"><div class="v174-abyss-hud"><div><small>'+escapeHtml(config.title)+'</small><b>'+escapeHtml(region.name)+'</b><span>'+escapeHtml(stageLabel(run))+'・'+escapeHtml(fiveStageProgress(run))+'</span></div>'+renderStageNodes(run)+'<button type="button" class="v174-abyss-back" onclick="v174AbyssBackToSelection()" aria-label="返回深淵選擇">返</button></div><div id="v174AbyssMessage" class="v174-abyss-message">'+escapeHtml(message)+'</div><div id="v141AbyssMap" class="v141-abyss-map v174-abyss-map floor-'+String(run.regionIndex+1)+'" style="--v174-abyss-map:url(\''+map+'\')" onclick="v174AbyssMoveByEvent(event)">'+renderEncounterControl(run,region)+renderChest(run)+renderPortal(run,region)+'<div id="v141AbyssPlayer" class="v141-abyss-player" style="left:'+run.x+'%;top:'+run.y+'%"><span></span><small>玩家</small></div></div></div>';
    }
    function renderAbyss(){
        const run=currentRun();
        if(!mapEntered||!run){ return renderSelection(); }
        if(run.completed){ return renderCompletion(run); }
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(syncPlayerArt); }
        return renderMap(run);
    }
    function syncPlayerArt(){
        const target=document&&document.querySelector?document.querySelector("#v141AbyssPlayer > span"):null;
        const source=document&&document.getElementById?document.getElementById("patrolCharacterImg"):null;
        if(target&&source){
            const src=source.currentSrc||source.src||"";
            target.style.backgroundImage=src?'url("'+String(src).replace(/\"/g,"%22")+'")':"none";
            target.style.backgroundSize="contain";target.style.backgroundPosition="center";target.style.backgroundRepeat="no-repeat";
        }
    }
    function refresh(){
        const content=document&&document.getElementById?document.getElementById("dungeonTabContent"):null;
        if(content){ content.innerHTML=renderAbyss();if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(syncPlayerArt); } }
    }
    function resetStageFlags(run){
        run.isBoss=isBossStage(run);run.phase="ready";run.battleCompleted=false;run.chestSpawned=false;run.chestClaimed=false;
        run.portalUnlocked=false;run.regionCompleted=!!run.completedRegions[run.regionIndex];run.x=50;run.y=84;run.message="";
    }
    function selectDifficulty(level){
        const config=difficultyConfig(level);
        if(!isUnlocked(config.id)){ if(typeof alert==="function"){ alert("需要角色達到 Lv"+config.unlockLevel+" 才能挑戰"+config.title+"。"); }return false; }
        clearTransientActions();rootState.selectedDifficulty=config.id;
        const run=rootState.runs[config.id];if(!run.active&&!run.completed){ run.active=true; }
        mapEntered=true;persist();refresh();return true;
    }
    function resetDifficulty(level){
        const config=difficultyConfig(level),clears=Math.max(0,Math.floor(numeric(rootState.runs[config.id]&&rootState.runs[config.id].clears,0)));
        clearTransientActions();rootState.runs[config.id]=defaultRun(config.id);rootState.runs[config.id].active=true;rootState.runs[config.id].clears=clears;
        rootState.selectedDifficulty=config.id;mapEntered=true;persist();refresh();
    }
    function backToSelection(){ clearTransientActions();mapEntered=false;rootState.selectedDifficulty=null;persist();refresh(); }

    function movePlayer(x,y,callback){
        const run=currentRun();
        if(!run||movementState){ return false; }
        const startX=numeric(run.x,50),startY=numeric(run.y,84);
        const targetX=clamp(numeric(x,startX),4,96),targetY=clamp(numeric(y,startY),8,94);
        const playerEl=document&&document.getElementById?document.getElementById("v141AbyssPlayer"):null;
        const distance=Math.hypot(targetX-startX,targetY-startY);
        const duration=Math.max(0.25,Math.min(1.45,distance/38));
        const movement={id:++actionSequence,run:run,startX:startX,startY:startY,targetX:targetX,targetY:targetY};
        movementState=movement;
        const finish=function(){
            if(movementState!==movement){ return; }
            run.x=targetX;run.y=targetY;persist();
            if(playerEl&&playerEl.classList){ playerEl.classList.remove("walking"); }
            movementState=null;
            if(callback){ callback(); }
        };
        if(!playerEl){ finish();return true; }
        playerEl.style.transition="left "+duration+"s cubic-bezier(.22,.61,.36,1),top "+duration+"s cubic-bezier(.22,.61,.36,1)";
        playerEl.style.left=targetX+"%";playerEl.style.top=targetY+"%";playerEl.classList.add("walking");
        setTimeout(finish,Math.round(duration*1000)+30);
        return true;
    }
    function resolveBattleResult(result){
        const run=currentRun();if(!run){ return false; }
        clearTransientActions();
        if(result!=="win"){ run.message="挑戰失敗，本關進度未前進。整備後可再次挑戰。";persist();refresh();return false; }
        run.battleCompleted=true;run.chestSpawned=true;run.chestClaimed=false;run.portalUnlocked=false;run.phase="chest";
        run.message=(isBossStage(run)?"帝王已退場。":"試煉已通過。")+"請走到寶箱位置領取獎勵。";persist();refresh();return true;
    }
    function launchCurrentEncounter(){
        const run=currentRun();if(!run||battleStarting||run.phase!=="ready"||run.battleCompleted||movementState||interactionState){ return false; }
        battleStarting=true;const roster=buildRoster(run.difficulty,run.regionIndex,run.encounterIndex);
        if(typeof window.v132LaunchDungeonBattle!=="function"){ battleStarting=false;throw new Error("Abyss requires v132LaunchDungeonBattle runtime owner."); }
        const started=window.v132LaunchDungeonBattle(roster,function(outcome){
            battleStarting=false;if(typeof showPage==="function"){ showPage("dungeon"); }mapEntered=true;rootState.selectedDifficulty=run.difficulty;
            resolveBattleResult(outcome&&outcome.result);if(typeof switchDungeonTab==="function"){ switchDungeonTab("abyss"); }else{ refresh(); }
        });
        if(!started){ battleStarting=false; }return !!started;
    }
    function confirmBossAndLaunch(){
        const run=currentRun();if(!run||battleStarting||movementState||interactionState){ return false; }
        const region=currentRegion(run),config=difficultyConfig(run.difficulty);
        const atmosphere=config.id===20?"前方感受到強大的"+region.elementLabel+"元素氣息。"+(region.displayEmperor||region.emperor)+"正在等待挑戰者。":region.name+"天威壓境。"+(isFinalBossStage(run)?"五位天尊已降臨戰場，等待最終決戰。":(region.displayEmperor||region.emperor)+"已在王座前等待決戰。");
        if(typeof window.rpgConfirm!=="function"){ return false; }
        battleStarting=true;
        Promise.resolve(window.rpgConfirm(atmosphere,{title:region.name,confirmText:region.bossEntry,cancelText:"暫不進入"}))
            .then(function(ok){ battleStarting=false;if(ok){ launchCurrentEncounter(); } },function(){ battleStarting=false; });
        return true;
    }
    function startEncounter(){
        const run=currentRun();if(!run||run.phase!=="ready"||movementState||interactionState){ return false; }
        if(isBossStage(run)){ return confirmBossAndLaunch(); }return launchCurrentEncounter();
    }

    function contentDefinitions(){ return typeof window.v132GetContentDefinitions==="function"?window.v132GetContentDefinitions():{tickets:[]}; }
    function ticketDefinition(ticketId){ return (contentDefinitions().tickets||[]).find(item=>item&&item.id===ticketId)||null; }
    function rewardDescriptor(run){
        const config=difficultyConfig(run.difficulty),region=currentRegion(run);
        if(!isBossStage(run)){ return {kind:"normal",gold:config.normalGold,exp:0,ticket:null}; }
        if(isFinalBossStage(run)){
            const tickets=(contentDefinitions().tickets||[]).filter(item=>item&&/^ticketSet/.test(String(item.id||"")));
            const ticket=tickets.length?tickets[Math.floor(Math.random()*tickets.length)]:null;
            return {kind:"emperor",gold:config.finalGold,exp:config.finalExp,ticket:ticket};
        }
        return {kind:"emperor",gold:config.emperorGold,exp:0,ticket:ticketDefinition(region.ticketId)};
    }
    function canStoreReward(reward){ return !reward.ticket||typeof window.v132CanAddItemToInventory!=="function"||!!window.v132CanAddItemToInventory(reward.ticket,1); }
    function addRewardItem(reward){ return !reward.ticket||(typeof window.v132AddItemToInventory==="function"&&!!window.v132AddItemToInventory(reward.ticket,1)); }
    function applyCurrencyReward(reward){
        if(reward.gold>0&&typeof gold!=="undefined"){ gold+=reward.gold; }if(reward.exp>0&&typeof sharedExp!=="undefined"){ sharedExp+=reward.exp; }
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }if(typeof saveGame==="function"){ saveGame(); }
    }
    function showReward(reward){
        const items=reward.ticket?[{name:reward.ticket.name||"裝備券",count:1}]:[];
        if(typeof window.v141ShowBlackGoldReward==="function"){ window.v141ShowBlackGoldReward({exp:reward.exp||0,gold:reward.gold||0,items:items});return; }
        if(typeof window.v132ShowRewardModal==="function"){
            const lines=[];if(reward.gold){ lines.push("金幣 "+Number(reward.gold).toLocaleString("zh-TW")); }if(reward.exp){ lines.push("EXP "+Number(reward.exp).toLocaleString("zh-TW")); }if(reward.ticket){ lines.push(escapeHtml(reward.ticket.name||"裝備券")+" ×1"); }
            window.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>'+(reward.kind==="emperor"?'帝王寶箱':'深淵寶箱')+'</h3><p>'+lines.join("<br>")+'</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">收下</button></div></div>');
        }
    }
    function finalizeClaim(run,reward,key){
        run.rewardClaims[key]={status:"claimed",kind:reward.kind,gold:reward.gold,exp:reward.exp,ticketId:reward.ticket&&reward.ticket.id||null,claimedAt:Date.now()};
        run.chestSpawned=false;run.chestClaimed=true;run.completedStages[key]=true;
        if(isBossStage(run)){ run.completedRegions[run.regionIndex]=true;run.regionCompleted=true; }
        if(isFinalBossStage(run)){
            run.completed=true;run.phase="complete";run.portalUnlocked=false;run.clears=Math.max(0,Math.floor(numeric(run.clears,0)))+1;run.message="極帝寶箱已領取，虛空五帝全境通關。";
        }else{ run.phase="portal";run.portalUnlocked=true;run.message="寶箱已領取，傳送點正式解鎖。"; }
        persist();
    }
    function reconcileExistingClaim(run,key){
        const existing=run.rewardClaims[key];
        if(!(existing&&(existing.status==="granting"||existing.status==="claimed"))&&!run.chestClaimed){ return false; }
        run.chestSpawned=false;run.chestClaimed=true;run.completedStages[key]=true;
        if(isFinalBossStage(run)){ run.completed=true;run.phase="complete";run.portalUnlocked=false; }
        else{ run.phase="portal";run.portalUnlocked=true; }
        persist();refresh();return true;
    }
    function claimChest(){
        const run=currentRun();if(!run||run.phase!=="chest"||!run.battleCompleted||!run.chestSpawned){ return false; }
        const key=stageKey(run);if(reconcileExistingClaim(run,key)){ return false; }
        const lock=beginInteraction("chest",key);if(!lock){ return false; }
        const pos=BOSS_POSITIONS[run.regionIndex]||BOSS_POSITIONS[0];
        const started=movePlayer(pos[0],pos[1],function(){
            const live=currentRun();
            if(!live||live!==run||stageKey(live)!==key||live.phase!=="chest"||!live.chestSpawned||live.chestClaimed){ releaseInteraction(lock);return; }
            const reward=rewardDescriptor(live);
            if(!canStoreReward(reward)){ releaseInteraction(lock);if(typeof alert==="function"){ alert("背包空間不足，寶箱尚未領取。請整理背包後再試一次。"); }return; }
            if(!addRewardItem(reward)){ releaseInteraction(lock);if(typeof alert==="function"){ alert("背包空間不足，寶箱尚未領取。"); }return; }
            applyCurrencyReward(reward);finalizeClaim(live,reward,key);releaseInteraction(lock);refresh();showReward(reward);
        });
        if(!started){ releaseInteraction(lock);return false; }return true;
    }
    function advanceThroughPortal(){
        const run=currentRun();if(!run||run.completed||run.phase!=="portal"||!run.portalUnlocked||!run.chestClaimed){ return false; }
        const key=stageKey(run),lock=beginInteraction("portal",key);if(!lock){ return false; }
        const started=movePlayer(50,17,function(){
            const live=currentRun();
            if(!live||live!==run||stageKey(live)!==key||live.completed||live.phase!=="portal"||!live.portalUnlocked||!live.chestClaimed){ releaseInteraction(lock);return; }
            if(live.encounterIndex<PRE_STAGE_COUNT){ live.encounterIndex++; }
            else if(live.regionIndex<REGION_COUNT-1){ live.regionIndex++;live.encounterIndex=0; }
            else{ releaseInteraction(lock);return; }
            resetStageFlags(live);persist();releaseInteraction(lock);refresh();
        });
        if(!started){ releaseInteraction(lock);return false; }return true;
    }
    function moveByEvent(event){
        const run=currentRun(),map=document&&document.getElementById?document.getElementById("v141AbyssMap"):null;
        if(!run||!map||!event||movementState||interactionState){ return false; }
        if(event.target&&typeof event.target.closest==="function"&&event.target.closest("button")){ return false; }
        const rect=map.getBoundingClientRect();if(!rect.width||!rect.height){ return false; }
        const x=clamp((numeric(event.clientX)-rect.left)/rect.width*100,4,96),y=clamp((numeric(event.clientY)-rect.top)/rect.height*100,8,94);
        return movePlayer(x,y);
    }

    const previousRenderDungeonTabContent=typeof window.renderDungeonTabContent==="function"?window.renderDungeonTabContent:null;
    window.renderDungeonTabContent=function(tabName){ if(tabName==="abyss"){ return renderAbyss(); }return previousRenderDungeonTabContent?previousRenderDungeonTabContent.apply(this,arguments):""; };
    try{ if(typeof renderDungeonTabContent==="function"){ renderDungeonTabContent=window.renderDungeonTabContent; } }catch(_){ }

    window.v174AbyssDifficulties=ABYSS_DIFFICULTIES;
    window.v174AbyssRegions=ABYSS_REGIONS;
    window.v174AbyssBuildRoster=buildRoster;
    window.v174AbyssGetRootState=()=>JSON.parse(JSON.stringify(rootState));
    window.v174AbyssGetRunState=level=>JSON.parse(JSON.stringify(rootState.runs[difficultyConfig(level).id]));
    window.v174AbyssReloadState=function(){ clearTransientActions();rootState=loadRoot();persist();return window.v174AbyssGetRootState(); };
    window.v174AbyssSelectDifficulty=selectDifficulty;
    window.v174AbyssReset=resetDifficulty;
    window.v174AbyssBackToSelection=backToSelection;
    window.v174AbyssMoveByEvent=moveByEvent;
    window.v174AbyssStartEncounter=startEncounter;
    window.v174AbyssResolveBattleResult=resolveBattleResult;
    window.v174AbyssClaimChest=claimChest;
    window.v174AbyssUsePortal=advanceThroughPortal;
    window.v174RenderAbyss=renderAbyss;
    window.v174RefreshAbyss=refresh;
    window.v174AbyssGetInteractionDiagnostics=function(){
        return {moving:!!movementState,interaction:interactionState?{kind:interactionState.kind,key:interactionState.key}:null};
    };

    window.v141BuildAbyssRoster=function(floor){
        const level=Number(rootState.selectedDifficulty)===20?20:40;
        return buildRoster(level,clamp(Math.floor(numeric(floor,1))-1,0,REGION_COUNT-1),PRE_STAGE_COUNT);
    };
    window.v141StartAbyss=()=>selectDifficulty(Number(rootState.selectedDifficulty)===40?40:20);
    window.v141ResetAbyss=()=>resetDifficulty(Number(rootState.selectedDifficulty)===40?40:20);
    window.v141OpenAbyssChest=claimChest;
    window.v141UseAbyssPortal=advanceThroughPortal;
    window.v141AbyssMoveByEvent=moveByEvent;
    window.v141ChallengeAbyssBoss=startEncounter;
    window.v141HandleAbyssBossInteraction=function(event){ if(event&&event.preventDefault){ event.preventDefault(); }if(event&&event.stopPropagation){ event.stopPropagation(); }return startEncounter(); };
    window.v141LeaveAbyssMap=function(){ clearTransientActions();mapEntered=false; };
    window.v141GetAbyssState=function(){
        const run=currentRun()||rootState.runs[20];
        return Object.assign({},JSON.parse(JSON.stringify(run)),{floor:run.regionIndex+1,phase:run.completed?"complete":run.phase,mapEntered:mapEntered});
    };

    if(typeof document!=="undefined"){
        document.addEventListener("v173:runtime-ready",function(){
            patchExistingV143ExplosiveFlurryRenderer();
            if(document.getElementById("dungeonTabContent")&&typeof window.currentDungeonTab!=="undefined"&&window.currentDungeonTab==="abyss"){ refresh(); }
        },{once:true});
    }
})();