
/* bundled source: js/gameplay-boss-tower-system.js */
/* =====================================================
   Gameplay Center / BOSS / Four-Symbol Tower Runtime
   - One single-player owner for special-mode navigation and progression.
   - BOSS and Tower battles reuse the existing v132 dungeon battle launcher.
   - Boss objects are ordinary target entities; Shield belongs to the Boss.
===================================================== */
(function installGameplayBossTowerSystem(){
    "use strict";

    if(typeof window==="undefined"||window.__gameplayBossTowerInstalled){ return; }
    window.__gameplayBossTowerInstalled=true;

    const ACCOUNT_REPOSITORY=window.FourSymbolsAccountSave;
    const ACTIVE_UID=ACCOUNT_REPOSITORY.getActiveUid();
    const MAIN_SAVE_KEY=ACCOUNT_REPOSITORY.saveKey(ACTIVE_UID);
    const STATE_VERSION=1;
    const TOWER_UNLOCK_LEVEL=30;
    const TOWER_FLOORS=100;
    const WEEK_MS=7*24*60*60*1000;
    const UTC_WEEK_ANCHOR=Date.UTC(1970,0,5);

    const ELEMENT_ORDER=Object.freeze(["fire","earth","water","wind"]);
    const ELEMENTS=Object.freeze({
        fire:Object.freeze({label:"火",style:"高爆發・爆擊・燃燒・追擊",color:"#c85a3d",glow:"rgba(200,90,61,.3)",skills:Object.freeze(["fireRocket","explosiveFlurry","dragonSlash"]),supports:Object.freeze(["rage"])}),
        earth:Object.freeze({label:"土",style:"防禦・護盾・反傷・破防",color:"#a77a46",glow:"rgba(167,122,70,.3)",skills:Object.freeze(["stoneSlash","flyingSandStrike","dustStorm"]),supports:Object.freeze(["rockWall"])}),
        water:Object.freeze({label:"水",style:"回復・凍傷・控制・消耗",color:"#4f83bd",glow:"rgba(79,131,189,.3)",skills:Object.freeze(["waterKnife","frostPunch","floodBeast"]),supports:Object.freeze(["healSpell"])}),
        wind:Object.freeze({label:"風",style:"閃避・命中干擾・暈眩・速度",color:"#4a9d78",glow:"rgba(74,157,120,.3)",skills:Object.freeze(["stormFlurry","windCrossSlash","windHowlLightning"]),supports:Object.freeze(["dodgeSkill"])} )
    });

    /*
       BOSS difficulty is anchored to the team that should reasonably challenge
       the displayed level instead of to the player's current live stats. Lv20–50
       assumes two same-level characters; Lv60+ assumes the third slot is online.
       This preserves progression while preventing over-geared players from making
       the same fixed-level BOSS dynamically stronger every time they improve gear.
    */
    const BOSS_SUPPORT_NAMES=Object.freeze({
        fire:Object.freeze(["赤劫炎衛","燼曜戰侍"]),
        water:Object.freeze(["玄瀾霜衛","寒魄冰侍"]),
        earth:Object.freeze(["坤嶽玄衛","鎮岳戰侍"]),
        wind:Object.freeze(["蒼嵐迅衛","天罡風侍"])
    });
    const BOSS_BALANCE=Object.freeze({
        twoMemberLevelCap:59,
        objectBaseHpPerMember:180,
        objectLevelHpPerMember:28,
        reinforcementCount:2
    });

    const BOSS_OBJECT_DEFINITIONS=Object.freeze({
        shield:Object.freeze({type:"shield",kind:"護盾",name:"金剛護體",shieldRatio:.24,effect:"傷害先由 BOSS 護盾吸收，溢出才扣生命。"}),
        charge:Object.freeze({type:"charge",kind:"法器",name:"滅魂陣",hpRatio:.20,countdown:2,effect:"倒數歸零時發動大型攻擊；破壞即可取消。"}),
        heal:Object.freeze({type:"heal",kind:"圖騰",name:"血祭圖騰",hpRatio:.18,healRatio:.04,effect:"存活期間，每回合恢復 BOSS 4% 最大生命。"}),
        amplify:Object.freeze({type:"amplify",kind:"戰旗",name:"煞氣戰旗",hpRatio:.18,damageMultiplier:1.25,effect:"存活期間，BOSS 造成傷害提高 25%。"}),
        defense:Object.freeze({type:"defense",kind:"圖騰",name:"玄甲圖騰",hpRatio:.18,effect:"存活期間，BOSS 受到的傷害降低 25%。"}),
        seal:Object.freeze({type:"seal",kind:"法器",name:"鎖脈法器",hpRatio:.16,healingMultiplier:.6,effect:"存活期間，我方治療與 SP 回復降低 40%。"})
    });

    const PERSONAL_BOSSES=Object.freeze([
        Object.freeze({id:"personal-20",name:"赤焰君",level:20,element:"fire",phases:1,traits:Object.freeze(["護盾","燃燒"]),objects:Object.freeze([{round:2,type:"shield"}]),firstReward:"首通金幣 1,200・藍階礦石 ×2",repeatReward:"金幣 260・白階礦石",firstGold:1200,repeatGold:260,ore:"oreLow",firstOre:2}),
        Object.freeze({id:"personal-30",name:"獄火侯",level:30,element:"fire",phases:1,traits:Object.freeze(["蓄力","燃燒","精英援軍"]),objects:Object.freeze([{round:2,type:"charge"},{round:6,type:"charge"}]),summon:Object.freeze({hpBelow:.5}),firstReward:"首通金幣 1,800・藍階礦石 ×2",repeatReward:"金幣 380・藍階礦石",firstGold:1800,repeatGold:380,ore:"oreMid",firstOre:2}),
        Object.freeze({id:"personal-40",name:"凍海君",level:40,element:"water",phases:2,traits:Object.freeze(["回復","凍傷"]),objects:Object.freeze([{round:2,type:"heal"},{hpBelow:.5,type:"charge"}]),firstReward:"首通金幣 2,600・紫階礦石 ×2",repeatReward:"金幣 520・紫階礦石",firstGold:2600,repeatGold:520,ore:"oreHigh",firstOre:2}),
        Object.freeze({id:"personal-50",name:"霜淵侯",level:50,element:"water",phases:2,traits:Object.freeze(["護盾","回復","凍傷","精英援軍"]),objects:Object.freeze([{round:2,type:"shield"},{hpBelow:.45,type:"heal"}]),summon:Object.freeze({round:4}),firstReward:"首通金幣 3,400・紫階礦石 ×3",repeatReward:"金幣 660・紫階礦石",firstGold:3400,repeatGold:660,ore:"oreHigh",firstOre:3}),
        Object.freeze({id:"personal-60",name:"雪獄尊",level:60,element:"water",phases:3,traits:Object.freeze(["護盾","蓄力","凍傷"]),objects:Object.freeze([{round:2,type:"shield"},{round:5,type:"charge"},{hpBelow:.35,type:"charge"}]),firstReward:"首通金幣 4,300・橙階礦石 ×2",repeatReward:"金幣 820・紫階礦石",firstGold:4300,repeatGold:820,ore:"orePerfect",firstOre:2}),
        Object.freeze({id:"personal-70",name:"寒劫尊",level:70,element:"water",phases:3,traits:Object.freeze(["回復","增幅","控制","精英援軍"]),objects:Object.freeze([{round:2,type:"heal"},{round:5,type:"amplify"},{hpBelow:.35,type:"charge"}]),summon:Object.freeze({hpBelow:.55}),firstReward:"首通金幣 5,200・橙階礦石 ×2",repeatReward:"金幣 980・橙階礦石",firstGold:5200,repeatGold:980,ore:"orePerfect",firstOre:2}),
        Object.freeze({id:"personal-80",name:"凍界皇",level:80,element:"water",phases:3,traits:Object.freeze(["護盾","蓄力","回復"]),objects:Object.freeze([{round:2,type:"shield"},{round:5,type:"charge"},{hpBelow:.4,type:"heal"}]),firstReward:"首通回天寶輪・金幣 6,200",repeatReward:"金幣 1,160・橙階礦石",firstGold:6200,repeatGold:1160,ore:"orePerfect",firstOre:1,relic:"relic_returning_wheel"}),
        Object.freeze({id:"personal-90",name:"霜天皇",level:90,element:"water",phases:4,traits:Object.freeze(["封鎖","護盾","蓄力","精英援軍"]),objects:Object.freeze([{round:2,type:"seal"},{round:4,type:"shield"},{round:7,type:"charge"},{hpBelow:.3,type:"amplify"}]),summon:Object.freeze({round:4}),firstReward:"首通金幣 7,500・橙階礦石 ×3",repeatReward:"金幣 1,360・橙階礦石",firstGold:7500,repeatGold:1360,ore:"orePerfect",firstOre:3}),
        Object.freeze({id:"personal-100",name:"寒獄帝",level:100,element:"water",phases:4,traits:Object.freeze(["護盾","蓄力","回復","封鎖","精英援軍"]),objects:Object.freeze([{round:2,type:"shield"},{round:4,type:"charge"},{round:7,type:"heal"},{hpBelow:.3,type:"seal"}]),summon:Object.freeze({hpBelow:.6}),firstReward:"首通金幣 10,000・橙階礦石 ×4",repeatReward:"金幣 1,600・橙階礦石",firstGold:10000,repeatGold:1600,ore:"orePerfect",firstOre:4})
    ]);

    const WORLD_STAGE_PROFILES=Object.freeze([
        Object.freeze({number:1,label:"第一階段",hpFactor:.78,attackFactor:.92,objects:Object.freeze([{round:3,type:"charge"}]),summon:null,summary:"試探攻勢與一次蓄力。"}),
        Object.freeze({number:2,label:"第二階段",hpFactor:.88,attackFactor:1,objects:Object.freeze([{round:2,type:"shield"}]),summon:null,summary:"以護盾改變攻擊優先順序。"}),
        Object.freeze({number:3,label:"第三階段",hpFactor:.96,attackFactor:1.06,objects:Object.freeze([{round:2,type:"heal"},{round:5,type:"amplify"}]),summon:Object.freeze({hpBelow:.55}),summary:"回復與法陣形成持久壓力，生命低於 55% 時召喚兩名同元素精英援軍。"}),
        Object.freeze({number:4,label:"最終階段",hpFactor:1,attackFactor:1.12,objects:Object.freeze([{round:2,type:"charge"},{round:4,type:"amplify"},{round:7,type:"shield"}]),summon:Object.freeze({round:4}),summary:"狂暴、蓄力與護體交替，第 4 回合召喚兩名同元素精英援軍。"})
    ]);

    const WORLD_BOSSES=Object.freeze([
        Object.freeze({id:"world-40",name:"熔天君",level:40,element:"fire",traits:Object.freeze(["四階段","護盾","蓄力"]),firstReward:"特殊首通：回天寶輪・金幣 6,000",repeatReward:"最終階段再戰：金幣 700",firstGold:6000,repeatGold:700,relic:"relic_returning_wheel"}),
        Object.freeze({id:"world-60",name:"冰海皇",level:60,element:"water",traits:Object.freeze(["四階段","回復","凍傷"]),firstReward:"特殊首通：橙階礦石 ×4・金幣 9,000",repeatReward:"最終階段再戰：金幣 1,000",firstGold:9000,repeatGold:1000,ore:"orePerfect",firstOre:4}),
        Object.freeze({id:"world-80",name:"九曜龍皇",level:80,element:"fire",traits:Object.freeze(["四階段","增幅","蓄力"]),firstReward:"特殊首通：橙階礦石 ×6・金幣 13,000",repeatReward:"最終階段再戰：金幣 1,400",firstGold:13000,repeatGold:1400,ore:"orePerfect",firstOre:6}),
        Object.freeze({id:"world-100",name:"滅世天魔",level:100,element:"fire",traits:Object.freeze(["四階段","封鎖","護盾","蓄力"]),firstReward:"特殊首通：橙階礦石 ×8・金幣 20,000",repeatReward:"最終階段再戰：金幣 2,000",firstGold:20000,repeatGold:2000,ore:"orePerfect",firstOre:8})
    ]);

    const TOWER_CONFIG=Object.freeze({
        floorCount:TOWER_FLOORS,eliteEvery:5,bossEvery:10,milestones:Object.freeze([25,50,75,100]),
        elementOrder:ELEMENT_ORDER,
        relicChoices:Object.freeze([
            Object.freeze({id:"relic_nine_dragon_fire",name:"九龍神火罩"}),
            Object.freeze({id:"relic_cold_spring_jade",name:"寒泉玉珮"}),
            Object.freeze({id:"relic_qinglan_feather",name:"青嵐羽符"}),
            Object.freeze({id:"relic_rock_mountain_seal",name:"岩岳鎮印"})
        ])
    });

    function numeric(value,fallback){
        const result=Number(value);
        return Number.isFinite(result)?result:(fallback===undefined?0:fallback);
    }
    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function copy(value){ return JSON.parse(JSON.stringify(value)); }
    function dungeonRankRatio(key,numeratorRank,denominatorRank){
        const table=window.v132DungeonRankMultipliers;
        const numerator=numeric(table&&table[numeratorRank]&&table[numeratorRank][key],0);
        const denominator=numeric(table&&table[denominatorRank]&&table[denominatorRank][key],0);
        if(numerator<=0||denominator<=0){ throw new Error("Gameplay BOSS requires v132 dungeon rank multipliers."); }
        return numerator/denominator;
    }
    function expectedPartySizeForLevel(level){
        return Math.max(1,Math.floor(numeric(level,1)))<=BOSS_BALANCE.twoMemberLevelCap?2:3;
    }
    function bossBalanceProfile(level,mode,stage){
        const resolvedLevel=clamp(Math.floor(numeric(level,1)),1,100);
        const expectedPartySize=expectedPartySizeForLevel(resolvedLevel);
        const partyFactor=expectedPartySize>=3?1.75:1.55;
        const baseHp=(4.5+resolvedLevel*.045)*partyFactor;
        const baseAttack=1.12+resolvedLevel*.0045;
        const resolvedMode=mode==="world"?"world":(mode==="tower"?"tower":"personal");
        const hpModeFactor=resolvedMode==="world"?1.15:(resolvedMode==="tower"?.72:1);
        const attackModeFactor=resolvedMode==="world"?1.05:(resolvedMode==="tower"?.96:1);
        const bossHpNormalization=dungeonRankRatio("maxHP","elite","boss");
        const bossDefenseMultiplier=dungeonRankRatio("defense","boss","elite");
        return {
            level:resolvedLevel,
            mode:resolvedMode,
            expectedPartySize:expectedPartySize,
            hpMultiplier:Number((baseHp*hpModeFactor*bossHpNormalization).toFixed(2)),
            attackMultiplier:Number((baseAttack*attackModeFactor).toFixed(2)),
            defenseMultiplier:Number(bossDefenseMultiplier.toFixed(4))
        };
    }

    function utcWeekInfo(now){
        const instant=new Date(now===undefined?Date.now():now);
        const midnight=Date.UTC(instant.getUTCFullYear(),instant.getUTCMonth(),instant.getUTCDate());
        const monday=midnight-((instant.getUTCDay()+6)%7)*24*60*60*1000;
        const index=Math.floor((monday-UTC_WEEK_ANCHOR)/WEEK_MS);
        const element=ELEMENT_ORDER[((index%ELEMENT_ORDER.length)+ELEMENT_ORDER.length)%ELEMENT_ORDER.length];
        return {key:new Date(monday).toISOString().slice(0,10),element:element,index:index};
    }

    function defaultTower(now){
        const week=utcWeekInfo(now);
        return {weekKey:week.key,element:week.element,completedFloor:0,highestThisWeek:0,claimedFloors:{},historicalHighest:0,pendingRelicChoice:false};
    }
    function defaultState(now){
        return {version:STATE_VERSION,personal:{},world:{},tower:defaultTower(now)};
    }
    function normalizeState(raw,now){
        const source=raw&&typeof raw==="object"?raw:{};
        const normalized=defaultState(now);
        PERSONAL_BOSSES.forEach(definition=>{
            const entry=source.personal&&source.personal[definition.id]||{};
            normalized.personal[definition.id]={firstClear:!!entry.firstClear,clears:Math.max(0,Math.floor(numeric(entry.clears,0)))};
        });
        WORLD_BOSSES.forEach(definition=>{
            const entry=source.world&&source.world[definition.id]||{};
            normalized.world[definition.id]={
                completedStages:clamp(Math.floor(numeric(entry.completedStages,0)),0,4),
                firstClear:!!entry.firstClear,
                clears:Math.max(0,Math.floor(numeric(entry.clears,0)))
            };
            if(normalized.world[definition.id].firstClear){ normalized.world[definition.id].completedStages=4; }
        });
        const towerSource=source.tower&&typeof source.tower==="object"?source.tower:{};
        const week=utcWeekInfo(now);
        normalized.tower.historicalHighest=clamp(Math.floor(numeric(towerSource.historicalHighest,0)),0,TOWER_FLOORS);
        if(towerSource.weekKey===week.key){
            normalized.tower.weekKey=week.key;
            normalized.tower.element=week.element;
            normalized.tower.completedFloor=clamp(Math.floor(numeric(towerSource.completedFloor,0)),0,TOWER_FLOORS);
            normalized.tower.highestThisWeek=clamp(Math.floor(numeric(towerSource.highestThisWeek,normalized.tower.completedFloor)),0,TOWER_FLOORS);
            normalized.tower.claimedFloors=towerSource.claimedFloors&&typeof towerSource.claimedFloors==="object"?Object.assign({},towerSource.claimedFloors):{};
            normalized.tower.pendingRelicChoice=!!towerSource.pendingRelicChoice;
        }
        normalized.tower.historicalHighest=Math.max(normalized.tower.historicalHighest,normalized.tower.highestThisWeek);
        return normalized;
    }
    function readMainSave(){
        try{ const result=ACCOUNT_REPOSITORY.readForUid(ACTIVE_UID); return result.status==="ready"?result.save:null; }catch(_){ return null; }
    }

    const initialMainSave=readMainSave();
    const initialStoredState=initialMainSave&&initialMainSave.gameplayProgress;
    let state=normalizeState(initialStoredState);
    const initialStateNeedsPersist=JSON.stringify(initialStoredState||null)!==JSON.stringify(state);
    let bossTab="personal";
    let bossDetail=null;
    let towerOverviewOpen=false;
    let activeBattleContext=null;
    let battleStarting=false;
    let abyssSession=false;

    function ensureCurrentTowerWeek(now){
        const week=utcWeekInfo(now);
        if(state.tower.weekKey===week.key&&state.tower.element===week.element){ return false; }
        const historical=state.tower.historicalHighest;
        state.tower=defaultTower(now);
        state.tower.historicalHighest=historical;
        return true;
    }
    function serializableState(){ ensureCurrentTowerWeek();state.version=STATE_VERSION;return copy(state); }
    function persist(){
        ensureCurrentTowerWeek();
        if(typeof saveGame==="function"){ saveGame();return; }
        const save=readMainSave();
        if(save&&typeof save==="object"){
            save.gameplayProgress=serializableState();
            try{ ACCOUNT_REPOSITORY.writeForUid(ACTIVE_UID,save,{source:"boss-tower"}); }catch(_){ }
        }
    }
    function highestCharacterLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel==="function"){
            return Math.max(1,Math.floor(numeric(window.v133GetHighestCreatedCharacterLevel(),1)));
        }
        if(typeof window.v141GetHighestCharacterLevel==="function"){
            return Math.max(1,Math.floor(numeric(window.v141GetHighestCharacterLevel(),1)));
        }
        const party=[typeof player!=="undefined"?player:null,typeof player2!=="undefined"?player2:null,typeof player3!=="undefined"?player3:null].filter(Boolean);
        return party.length?Math.max.apply(null,party.map(character=>Math.max(1,Math.floor(numeric(character.level,1))))):1;
    }
    function elementLabel(key){ return ELEMENTS[key]?ELEMENTS[key].label:key; }
    function findPersonal(id){ return PERSONAL_BOSSES.find(definition=>definition.id===id)||null; }
    function findWorld(id){ return WORLD_BOSSES.find(definition=>definition.id===id)||null; }

    function abyssSummary(){
        if(typeof window.v174AbyssGetRunState!=="function"){ return "Lv20／Lv40 永久首通攻略"; }
        const twenty=window.v174AbyssGetRunState(20),forty=window.v174AbyssGetRunState(40);
        return "Lv20 "+(twenty&&twenty.completed?"已通關":"未通關")+"・Lv40 "+(forty&&forty.completed?"已通關":"未通關");
    }
    function bossHubSummary(){
        const level=highestCharacterLevel();
        const unlocked=PERSONAL_BOSSES.filter(definition=>definition.level<=level);
        const firstPending=unlocked.some(definition=>!state.personal[definition.id].firstClear);
        const worldProgress=WORLD_BOSSES.reduce((sum,definition)=>sum+state.world[definition.id].completedStages,0);
        return firstPending?"新的個人 BOSS 可攻略":"世界災厄討伐進度 "+worldProgress+" / "+(WORLD_BOSSES.length*4);
    }
    function renderGameplayHub(){
        ensureCurrentTowerWeek();
        const content=document.getElementById("gameplayHubContent");
        if(!content){ return; }
        const tower=state.tower,element=ELEMENTS[tower.element];
        content.innerHTML=
            '<button type="button" class="gameplay-mode-card boss" onclick="vGameplayOpenBoss()"><span class="gameplay-mode-copy"><h3>BOSS</h3><p>個人 BOSS・世界 BOSS</p><span class="gameplay-mode-status">'+escapeHtml(bossHubSummary())+'</span></span><span class="gameplay-mode-seal">戰</span></button>'+
            '<button type="button" class="gameplay-mode-card tower" onclick="vGameplayOpenTower()"><span class="gameplay-mode-copy"><h3>四象塔</h3><p>本週試煉：'+escapeHtml(element.label)+'元素</p><span class="gameplay-mode-status">目前最高樓層：'+tower.highestThisWeek+' / 100</span></span><span class="gameplay-mode-seal">塔</span></button>'+
            '<button type="button" class="gameplay-mode-card abyss" onclick="vGameplayOpenAbyss()"><span class="gameplay-mode-copy"><h3>深淵</h3><p>永久高難挑戰</p><span class="gameplay-mode-status">'+escapeHtml(abyssSummary())+'</span></span><span class="gameplay-mode-seal">淵</span></button>'+
            '<div class="gameplay-mode-card coming-soon" aria-disabled="true"><span class="gameplay-mode-copy"><h3>更多玩法</h3><p>新的特殊戰鬥將統一收錄於此</p><span class="gameplay-mode-status">尚未開放</span></span><span class="gameplay-mode-seal">待</span></div>';
    }

    function bossListMarkup(type){
        const definitions=type==="world"?WORLD_BOSSES:PERSONAL_BOSSES;
        const level=highestCharacterLevel();
        const cards=definitions.map(definition=>{
            const progress=type==="world"?state.world[definition.id]:state.personal[definition.id];
            const unlocked=level>=definition.level;
            const cleared=type==="world"?progress.firstClear:progress.firstClear;
            const status=!unlocked?"Lv"+definition.level+" 解鎖":type==="world"?(progress.firstClear?"已討伐":"討伐進度 "+progress.completedStages+" / 4"):(progress.firstClear?"可重複挑戰":"首通待完成");
            return '<button type="button" class="boss-select-card '+(!unlocked?'locked ':'')+(cleared?'cleared':'')+'" '+(!unlocked?'disabled aria-disabled="true"':'onclick="vGameplayOpenBossDetail(\''+type+'\',\''+definition.id+'\')"')+'><span>Lv.'+definition.level+'・'+escapeHtml(elementLabel(definition.element))+'元素</span><b>'+escapeHtml(definition.name)+'</b><small>'+escapeHtml(status)+'</small></button>';
        }).join("");
        const summary=type==="world"?"永久單人災厄討伐・階段進度獨立保存":"不限次數・固定等級・首通獎勵僅一次";
        return '<div class="boss-browser"><div class="boss-overview-line"><span>'+summary+'</span><b>最高 Lv.'+level+'</b></div><div class="boss-card-list">'+cards+'</div></div>';
    }
    function worldStageTrack(progress){
        const current=progress.firstClear?4:Math.min(4,progress.completedStages+1);
        return '<div class="boss-stage-track">'+WORLD_STAGE_PROFILES.map(profile=>{
            const className=profile.number<=progress.completedStages?"done":(profile.number===current?"current":"");
            return '<span class="'+className+'">'+escapeHtml(profile.label)+'</span>';
        }).join("")+'</div>';
    }
    function bossDetailMarkup(type,definition){
        const progress=type==="world"?state.world[definition.id]:state.personal[definition.id];
        const stage=type==="world"?(progress.firstClear?4:Math.min(4,progress.completedStages+1)):1;
        const objectText=type==="world"?WORLD_STAGE_PROFILES[stage-1].summary:definition.traits.join("・");
        const balance=bossBalanceProfile(definition.level,type==="world"?"world":"personal",stage);
        const summonPlan=type==="world"?WORLD_STAGE_PROFILES[stage-1].summon:(definition.summon||null);
        const supportText=summonPlan?"戰中同元素精英援軍 ×"+BOSS_BALANCE.reinforcementCount:"本階段無精英援軍";
        return '<div class="boss-detail"><button type="button" class="boss-detail-back" onclick="vGameplayCloseBossDetail()">‹ 返回 BOSS 列表</button>'+
            '<section class="boss-hero"><small>'+(type==="world"?'世界觀災厄級・永久單人攻略':'個人挑戰・固定等級')+'</small><h3>'+escapeHtml(definition.name)+'</h3><p>Lv.'+definition.level+'・'+escapeHtml(elementLabel(definition.element))+'元素</p><div class="boss-trait-tags">'+definition.traits.map(item=>'<span>'+escapeHtml(item)+'</span>').join("")+'</div></section>'+
            (type==="world"?worldStageTrack(progress):'')+
            '<button type="button" class="gameplay-primary-action" onclick="vGameplayStartBoss(\''+type+'\',\''+definition.id+'\')">'+(type==="world"?'挑戰'+WORLD_STAGE_PROFILES[stage-1].label:'開始挑戰')+'</button>'+
            '<div class="boss-detail-grid"><section><h4>建議陣容</h4><p>同級角色 ×'+balance.expectedPartySize+'・'+escapeHtml(supportText)+'</p></section><section><h4>戰鬥特性</h4><p>'+escapeHtml(type==="world"?'四個永久攻略階段；失敗只重打目前階段。':definition.phases+' 個戰鬥階段；可不限次數挑戰，固定等級保留角色成長感。')+'</p></section><section><h4>機制簡介</h4><p>'+escapeHtml(objectText)+'</p></section><section><h4>首次擊敗獎勵</h4><p>'+escapeHtml(definition.firstReward)+'・'+(progress.firstClear?'已領取':'尚未領取')+'</p></section><section><h4>重複掉落</h4><p>'+escapeHtml(definition.repeatReward)+'</p></section></div>'+
            '</div>';
    }
    function renderBossPage(){
        const content=document.getElementById("bossTabContent");
        if(!content){ return; }
        ["personal","world"].forEach(type=>{
            const button=document.getElementById(type==="personal"?"bossTabBtnPersonal":"bossTabBtnWorld");
            if(button){ button.classList.toggle("active",bossTab===type);button.setAttribute("aria-selected",bossTab===type?"true":"false"); }
        });
        const definition=bossDetail&&(bossDetail.type===bossTab?(bossTab==="world"?findWorld(bossDetail.id):findPersonal(bossDetail.id)):null);
        content.innerHTML=definition?bossDetailMarkup(bossTab,definition):bossListMarkup(bossTab);
        content.scrollTop=0;
    }
    function switchBossTab(type){ bossTab=type==="world"?"world":"personal";bossDetail=null;renderBossPage(); }
    function openBossDetail(type,id){
        bossTab=type==="world"?"world":"personal";
        const definition=bossTab==="world"?findWorld(id):findPersonal(id);
        if(!definition||highestCharacterLevel()<definition.level){ return false; }
        bossDetail={type:bossTab,id:definition.id};renderBossPage();return true;
    }

    function nextTowerRewardFloor(current){
        const important=[];
        for(let floor=5;floor<=TOWER_FLOORS;floor+=5){ important.push(floor); }
        return important.find(floor=>floor>current)||TOWER_FLOORS;
    }
    function towerFloorKind(floor){
        if(floor===100){ return "最終 BOSS・大型里程碑"; }
        if(TOWER_CONFIG.milestones.includes(floor)){ return floor%10===0?"守關 BOSS・大型里程碑":"精英・大型里程碑"; }
        if(floor%10===0){ return "守關 BOSS"; }
        if(floor%5===0){ return "精英層"; }
        return "普通層";
    }
    function towerChoiceMarkup(){
        if(!state.tower.pendingRelicChoice){ return ""; }
        return '<section class="tower-milestone-choice"><h3>第 50 層・元素秘寶自選匣</h3><p>從四件正式元素秘寶中選擇一件；若已持有，將轉為秘寶強化用金幣。</p><div class="tower-relic-options">'+TOWER_CONFIG.relicChoices.map(choice=>'<button type="button" onclick="vGameplayChooseTowerRelic(\''+choice.id+'\')">'+escapeHtml(choice.name)+'</button>').join("")+'</div></section>';
    }
    function towerOverviewMarkup(){
        const tower=state.tower;
        return '<div class="tower-floor-overview">'+Array.from({length:10},(_,index)=>{
            const start=index*10+1,end=start+9,done=tower.completedFloor>=end,current=tower.completedFloor>=start&&tower.completedFloor<end;
            const target=done?end:(current?tower.completedFloor+1:start);
            const enabled=done||current||start===tower.completedFloor+1;
            return '<button type="button" class="tower-floor-band '+(done?'done ':'')+(current?'current':'')+'" '+(enabled?'onclick="vGameplaySelectTowerBand('+target+')"':'disabled')+'><b>'+start+'～'+end+' 層</b><small>'+escapeHtml(end%10===0?'含第 '+end+' 層守關 BOSS':'精英與普通試煉')+(done?'・已通過':'')+'</small></button>';
        }).join("")+'</div>';
    }
    function renderTowerPage(){
        ensureCurrentTowerWeek();
        const content=document.getElementById("towerPageContent");
        if(!content){ return; }
        const tower=state.tower,element=ELEMENTS[tower.element],level=highestCharacterLevel();
        const next=Math.min(TOWER_FLOORS,tower.completedFloor+1);
        content.innerHTML='<div class="tower-home">'+towerChoiceMarkup()+
            '<section class="tower-element-hero" style="--tower-color:'+element.color+';--tower-glow:'+element.glow+'"><div><small>本週元素試煉</small><h3>'+escapeHtml(element.label)+'元素</h3><strong>'+tower.completedFloor+' / 100</strong><p>'+escapeHtml(element.style)+'</p></div></section>'+
            '<div class="tower-summary-grid"><div><small>本週最高</small><b>'+tower.highestThisWeek+' 層</b></div><div><small>歷史最高</small><b>'+tower.historicalHighest+' 層</b></div><div><small>下一層</small><b>第 '+next+' 層</b></div><div><small>下一重要獎勵</small><b>第 '+nextTowerRewardFloor(tower.completedFloor)+' 層</b></div></div>'+
            (level<TOWER_UNLOCK_LEVEL?'<div class="boss-overview-line"><span>四象塔於 Lv30 開放</span><b>目前 Lv.'+level+'</b></div>':'')+
            '<div class="tower-actions"><button type="button" class="gameplay-primary-action" '+(level<TOWER_UNLOCK_LEVEL||tower.pendingRelicChoice?'disabled':'onclick="vGameplayContinueTower()"')+'>'+(tower.completedFloor>=100?'再戰第 100 層':'繼續挑戰')+'</button><button type="button" class="tower-secondary-action" onclick="vGameplayToggleTowerOverview()">'+(towerOverviewOpen?'收起樓層一覽':'樓層一覽')+'</button></div>'+
            (towerOverviewOpen?towerOverviewMarkup():'')+'</div>';
        content.scrollTop=0;
    }

    function buildBaseMonster(name,level,element,rank){
        if(typeof window.v132BuildDungeonMonster!=="function"){ throw new Error("Gameplay BOSS requires v132BuildDungeonMonster."); }
        return window.v132BuildDungeonMonster(name,level,element,rank);
    }
    function compatibleSkillIds(element,ids){
        return (ids||[]).filter(id=>{
            const skill=typeof skillDatabase!=="undefined"&&skillDatabase?skillDatabase[id]:null;
            return !skill||!skill.element||skill.element===element;
        });
    }
    function configureBossSkills(monster,element,stage){
        const style=ELEMENTS[element]||ELEMENTS.fire;
        const resolvedStage=Math.max(1,Math.floor(numeric(stage,1)));
        monster.element=element;
        monster.skillIds=compatibleSkillIds(element,style.skills.slice(Math.max(0,3-resolvedStage)));
        monster.v141SupportSkillIds=resolvedStage>=3?compatibleSkillIds(element,style.supports):[];
        monster.v132FixedSkillLoadout=true;
        monster.v144LegalSkillPool=monster.skillIds.slice();
        monster.v141ForceSkillLevel=clamp(Math.ceil(numeric(monster.level,1)/25),1,5);
        monster.v141SkillLevel=monster.v141ForceSkillLevel;
        monster.v144SkillLevel=monster.v141ForceSkillLevel;
        monster.skillChance=clamp(.48+resolvedStage*.08,.48,.82);
        if(monster.v141SupportSkillIds.length){ monster.v141AbyssAi="support"; }
        else if(monster.v141AbyssAi==="support"){ delete monster.v141AbyssAi; }
    }
    function buildBossMonster(definition,options){
        const profile=options||{};
        const mode=profile.mode||(String(definition.id||"").indexOf("world-")===0?"world":(String(definition.id||"").indexOf("tower-")===0?"tower":"personal"));
        const balance=bossBalanceProfile(definition.level,mode,profile.stage);
        const monster=buildBaseMonster(definition.name,definition.level,definition.element,"boss");
        const hpMultiplier=balance.hpMultiplier*numeric(profile.hpFactor,1);
        const attackMultiplier=balance.attackMultiplier*numeric(profile.attackFactor,1);
        monster.maxHP=Math.max(1,Math.round(numeric(monster.maxHP,1)*hpMultiplier));
        monster.hp=monster.maxHP;
        monster.attack=Math.max(1,Math.round(numeric(monster.attack,1)*attackMultiplier));
        monster.magicAttack=Math.max(1,Math.round(numeric(monster.magicAttack,monster.attack)*attackMultiplier));
        monster.unitKind="boss";
        monster.vGameplayBoss=true;
        monster.vGameplayBossId=definition.id;
        monster.vGameplayExpectedPartySize=balance.expectedPartySize;
        monster.vGameplayStage=numeric(profile.stage,1);
        configureBossSkills(monster,definition.element,monster.vGameplayStage);
        return monster;
    }
    function buildBossSupportRoster(definition,options){
        const profile=options||{};
        const stage=Math.max(1,Math.floor(numeric(profile.stage,1)));
        const names=BOSS_SUPPORT_NAMES[definition.element]||BOSS_SUPPORT_NAMES.fire;
        return Array.from({length:BOSS_BALANCE.reinforcementCount},(_,index)=>{
            const monster=buildBaseMonster(names[index%names.length],definition.level,definition.element,"elite");
            monster.vGameplayBossSupport=true;
            monster.vGameplayBossSummon=true;
            monster.vGameplayBossId=definition.id;
            monster.vGameplayStage=stage;
            configureBossSkills(monster,definition.element,Math.max(1,stage-1));
            return monster;
        });
    }
    function towerBossName(element,floor){
        const high=floor>=80;
        const map={
            fire:high?"炎天尊":"赤焰使",
            water:high?"玄冥尊":"寒泉使",
            earth:high?"坤嶽尊":"岩岳使",
            wind:high?"巽風尊":"青嵐使"
        };
        return map[element]||"四象尊";
    }
    function towerMonsterLevel(floor){ return clamp(Math.round(29+floor*.71),30,100); }
    function towerObjectPlan(floor){
        if(floor===100){ return [{round:2,type:"shield"},{round:4,type:"charge"},{round:7,type:"heal"},{hpBelow:.3,type:"amplify"}]; }
        if(floor>=70&&floor%10===0){ return [{round:2,type:"heal"},{round:5,type:"amplify"}]; }
        if(floor>=50&&floor%10===0){ return [{round:2,type:"shield"},{round:5,type:"amplify"}]; }
        if(floor>=40&&floor%10===0){ return [{round:2,type:"shield"}]; }
        if(floor>=30&&floor%10===0){ return [{round:2,type:"charge"}]; }
        if(floor%10===0){ return [{round:3,type:"charge"}]; }
        return [];
    }
    function towerSummonPlan(floor){
        if(floor===100){ return {hpBelow:.6}; }
        if(floor>=70&&floor%10===0){ return {round:4}; }
        if(floor>=50&&floor%10===0){ return {hpBelow:.5}; }
        return null;
    }
    function buildTowerRoster(floor){
        const element=state.tower.element,level=towerMonsterLevel(floor);
        if(floor%10===0){
            const definition={id:"tower-"+floor,name:towerBossName(element,floor),level:level,element:element};
            const stage=floor===100?4:(floor>=70?3:(floor>=40?2:1));
            const boss=buildBossMonster(definition,{stage:stage,mode:"tower"});
            return [boss];
        }
        const elite=floor%5===0,count=elite?2:Math.min(4,2+Math.floor(floor/35));
        return Array.from({length:count},()=>{
            const monster=buildBaseMonster("天兵天將",level,element,elite?"elite":"regular");
            monster.vGameplayTower=true;monster.vGameplayTowerFloor=floor;
            configureBossSkills(monster,element,Math.ceil(floor/30));
            if(element==="fire"){ monster.skillChance=Math.min(.82,monster.skillChance+.08);monster.critChance=numeric(monster.critChance,5)+8; }
            if(element==="water"){ monster.v141SupportSkillIds=compatibleSkillIds(element,ELEMENTS.water.supports);monster.v141AbyssAi="support"; }
            if(element==="wind"){ monster.evasion=numeric(monster.evasion,0)+8;monster.agility=numeric(monster.agility,1)*1.12; }
            if(element==="earth"){ monster.defense=Math.round(numeric(monster.defense,1)*1.18);monster.maxHP=Math.round(numeric(monster.maxHP,1)*1.12);monster.hp=monster.maxHP; }
            return monster;
        });
    }

    function activeBoss(){
        return activeBattleContext&&activeBattleContext.boss&&activeBattleContext.boss.alive!==false
            ?activeBattleContext.boss:null;
    }

    const BOSS_REINFORCEMENT_SLOTS=Object.freeze(["ENEMY_B1","ENEMY_B5"]);
    const BOSS_OBJECT_SLOTS=Object.freeze(["ENEMY_F1","ENEMY_F5"]);
    const BOSS_FOOTPRINT_SLOTS=Object.freeze([
        "ENEMY_B2","ENEMY_B3","ENEMY_B4",
        "ENEMY_F2","ENEMY_F3","ENEMY_F4"
    ]);

    function battlefieldSlotOwner(){ return window.FourSymbolsBattlefieldSlots||null; }
    function bossIndex(){
        const context=activeBattleContext;
        if(!context||typeof monsters==="undefined"){ return null; }
        const index=Number.isInteger(context.bossIndex)?context.bossIndex:monsters.indexOf(context.boss);
        return index>=0?index:null;
    }
    function isBossIndex(index){ return Number.isInteger(index)&&index===bossIndex(); }
    function monsterAt(index){
        return typeof monsters!=="undefined"&&Number.isInteger(index)?monsters[index]||null:null;
    }
    function isBossObject(monster){ return !!monster&&monster.unitKind==="boss-object"; }
    function isBossObjectIndex(index){ return isBossObject(monsterAt(index)); }
    function recordLifecycleViolation(code,details){
        const context=activeBattleContext;
        if(!context){ return; }
        const entry=Object.assign({code:code,at:Date.now()},details||{});
        const diagnostics=context.lifecycleDiagnostics||(context.lifecycleDiagnostics=[]);
        diagnostics.push(entry);
        while(diagnostics.length>32){ diagnostics.shift(); }
        if(typeof console!=="undefined"&&typeof console.warn==="function"){
            console.warn("Boss lifecycle contract violation",entry);
        }
    }
    function releaseBossObjectSlot(index,monster,reason){
        const owner=battlefieldSlotOwner(),snapshot=bossBattlefieldSnapshot();
        if(!owner||!snapshot||!Number.isInteger(index)){ return false; }
        const released=owner.removeMonsterFromEnemySlot(snapshot,index);
        if(!released){
            recordLifecycleViolation("boss-object-slot-missing-on-retire",{index:index,reason:reason||"retired"});
        }
        if(monster){ monster.vGameplayBattlefieldSlot=null; }
        return released;
    }

    function bossBattlefieldSnapshot(){
        const context=activeBattleContext,owner=battlefieldSlotOwner();
        if(!context||!owner){ return null; }
        const index=bossIndex();
        const snapshot=context.enemySnapshot;
        /* A Boss battle owns one specialised snapshot for its entire lifetime.
           A generic renderer snapshot may contain the Boss index, but it does
           not encode the Boss footprint and must never replace this owner. */
        if(snapshot&&Number.isInteger(index)&&owner.getEnemySlotForMonster(snapshot,index)){
            if(owner.getActiveEnemySnapshot()!==snapshot){
                owner.setActiveEnemySnapshot(snapshot);
                recordLifecycleViolation("restored-boss-snapshot",{bossIndex:index});
            }
            return snapshot;
        }
        const active=owner.getActiveEnemySnapshot();
        if(active&&Number.isInteger(index)&&owner.getEnemySlotForMonster(active,index)){
            active.bossBattleSnapshot=true;
            context.enemySnapshot=active;
            recordLifecycleViolation("adopted-legacy-boss-snapshot",{bossIndex:index});
            return active;
        }
        recordLifecycleViolation("missing-boss-snapshot",{bossIndex:index});
        return null;
    }
    function assignEnemySlot(monsterIndex,slot){
        const owner=battlefieldSlotOwner(),snapshot=bossBattlefieldSnapshot();
        if(!owner||!snapshot||!slot){ return null; }
        return owner.assignMonsterToEnemySlot(snapshot,monsterIndex,slot)?slot:null;
    }
    function captureReinforcementProjection(indexes){
        const context=activeBattleContext,owner=battlefieldSlotOwner(),snapshot=bossBattlefieldSnapshot();
        if(!context||!owner||!snapshot){ return null; }
        const result={
            mode:context.mode,
            currentBattleMonsters:typeof currentBattleMonsters!=="undefined"&&Array.isArray(currentBattleMonsters)
                ?currentBattleMonsters.slice():[],
            monsterIndexes:indexes.slice(),
            monsterSlots:indexes.map(index=>{
                const monster=monsterAt(index);
                return {
                    index:index,
                    slot:monster&&monster.vGameplayBattlefieldSlot||null,
                    getEnemySlotForMonster:owner.getEnemySlotForMonster(snapshot,index)||null
                };
            }),
            snapshotMonsterIndexToSlot:Object.assign({},snapshot.monsterIndexToSlot||{}),
            snapshotSlotToMonsterIndex:Object.assign({},snapshot.slotToMonsterIndex||{}),
            dom:[]
        };
        const rectSnapshot=rect=>rect?{
            left:Number(rect.left)||0,right:Number(rect.right)||0,
            top:Number(rect.top)||0,bottom:Number(rect.bottom)||0,
            width:Number(rect.width)||0,height:Number(rect.height)||0
        }:null;
        if(typeof document!=="undefined"){
            indexes.forEach(index=>{
                const card=document.getElementById("battleMonster"+index);
                const holder=card&&card.parentElement;
                const art=card&&card.querySelector(":scope > .v174-battle-art");
                result.dom.push({
                    index:index,
                    cardSlot:card&&card.dataset&&card.dataset.slot||null,
                    holderSlot:holder&&holder.dataset&&holder.dataset.slot||null,
                    cardRect:card&&card.getBoundingClientRect?rectSnapshot(card.getBoundingClientRect()):null,
                    artRect:art&&art.getBoundingClientRect?rectSnapshot(art.getBoundingClientRect()):null
                });
            });
            const bossCard=Number.isInteger(bossIndex())?document.getElementById("battleMonster"+bossIndex()):null;
            const bossArt=bossCard&&bossCard.querySelector(":scope > .v174-battle-art");
            result.bossArtRect=bossArt&&bossArt.getBoundingClientRect?rectSnapshot(bossArt.getBoundingClientRect()):null;
            if(result.bossArtRect){
                result.dom.forEach(entry=>{
                    if(!entry.artRect){ entry.artworkClearOfBoss=null;return; }
                    const projectedSlot=entry.cardSlot||entry.holderSlot;
                    entry.artworkClearOfBoss=projectedSlot==="ENEMY_B1"
                        ?entry.artRect.right<=result.bossArtRect.left
                        :projectedSlot==="ENEMY_B5"
                            ?entry.artRect.left>=result.bossArtRect.right:null;
                });
            }
        }
        context.lastReinforcementProjection=result;
        return result;
    }
    function seedBossBattlefieldSnapshot(){
        const context=activeBattleContext,boss=activeBoss(),owner=battlefieldSlotOwner();
        if(!context||!boss||!owner||typeof monsters==="undefined"||!Array.isArray(monsters)){ return null; }
        const index=monsters.indexOf(boss);
        if(index<0){ return null; }
        const snapshot=owner.createEnemyFormationSnapshot([index],{originalFormationType:6});
        snapshot.bossBattleSnapshot=true;
        owner.setActiveEnemySnapshot(snapshot);
        context.bossIndex=index;
        context.enemySnapshot=snapshot;
        boss.vGameplayBattlefieldSlot=owner.getEnemySlotForMonster(snapshot,index);
        installBossHealthOwner(boss);
        const geometry=window.FourSymbolsBattlefieldRenderGeometry;
        if(geometry&&typeof geometry.reconcile==="function"){ geometry.reconcile(); }
        else if(typeof renderBattle==="function"){ renderBattle(); }
        return snapshot;
    }
    function releaseBossBattlefieldSnapshot(){
        const context=activeBattleContext,owner=battlefieldSlotOwner();
        if(!context||!owner){ return; }
        if(context.enemySnapshot&&owner.getActiveEnemySnapshot()===context.enemySnapshot){
            owner.clearActiveEnemySnapshot();
        }
        context.enemySnapshot=null;
    }

    function aliveBossObjects(type){
        if(!activeBattleContext||typeof monsters==="undefined"){ return []; }
        return (activeBattleContext.objectIndexes||[])
            .map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.alive&&entry.monster.hp>0&&(!type||entry.monster.objectType===type));
    }
    function bossHasObject(type){ return aliveBossObjects(type).length>0; }
    function nextBossObjectSlot(){
        const owner=battlefieldSlotOwner(),snapshot=bossBattlefieldSnapshot();
        if(owner&&snapshot){
            return BOSS_OBJECT_SLOTS.find(slot=>owner.getAssignedMonsterAtEnemySlot(snapshot,slot)===null)||null;
        }
        const used=new Set(aliveBossObjects().map(entry=>entry.monster.vGameplayBattlefieldSlot));
        return BOSS_OBJECT_SLOTS.find(slot=>!used.has(slot))||null;
    }
    function bossShield(){
        const boss=activeBoss();
        const shield=boss&&boss.vBossShield;
        return shield&&shield.current>0?shield:null;
    }
    function applyBossShield(amount){
        const boss=activeBoss();
        const value=Math.max(0,Math.round(numeric(amount,0)));
        if(!boss||!value){ return 0; }
        const shield=boss.vBossShield||{current:0,max:0};
        shield.current+=value;
        shield.max=Math.max(shield.max,shield.current);
        boss.vBossShield=shield;
        if(typeof addBattleLog==="function"){
            addBattleLog(boss.name+"獲得【金剛護體】護盾 "+value+"。");
        }
        syncBossShieldHud();
        return value;
    }
    function installBossHealthOwner(boss){
        if(!boss||boss.__bossHealthOwnerInstalled){ return; }
        let health=Math.max(0,numeric(boss.hp,boss.maxHP));
        Object.defineProperty(boss,"hp",{
            configurable:true,
            enumerable:true,
            get:function(){ return health; },
            set:function(nextValue){
                const requested=clamp(numeric(nextValue,health),0,numeric(boss.maxHP,health));
                if(requested>=health){
                    health=requested;
                    boss.vLastDamageSettlement=null;
                    syncBossShieldHud();
                    return;
                }
                const requestedDamage=health-requested;
                const reduction=bossHasObject("defense")?.25:0;
                const afterReduction=Math.max(0,Math.round(requestedDamage*(1-reduction)));
                const shield=boss.vBossShield||{current:0,max:0};
                const absorbed=Math.min(afterReduction,Math.max(0,numeric(shield.current,0)));
                shield.current=Math.max(0,numeric(shield.current,0)-absorbed);
                boss.vBossShield=shield;
                const hpDamage=Math.max(0,afterReduction-absorbed);
                health=Math.max(0,health-hpDamage);
                boss.vLastDamageSettlement={
                    requested:requestedDamage,
                    reduced:requestedDamage-afterReduction,
                    shieldAbsorbed:absorbed,
                    hpDamage:hpDamage
                };
                syncBossShieldHud();
            }
        });
        Object.defineProperty(boss,"__bossHealthOwnerInstalled",{value:true,configurable:true});
    }
    function consumeBossDamageSettlement(index){
        if(!isBossIndex(index)){ return null; }
        const boss=activeBattleContext&&activeBattleContext.boss;
        const settlement=boss&&boss.vLastDamageSettlement;
        if(boss){ boss.vLastDamageSettlement=null; }
        return settlement||null;
    }
    function syncBossShieldHud(){
        if(typeof document==="undefined"){ return; }
        const index=bossIndex();
        const card=Number.isInteger(index)?document.getElementById("battleMonster"+index):null;
        if(!card){ return; }
        const hpBar=card.querySelector(":scope > .monster-hp");
        if(!hpBar){ return; }
        let shieldOverlay=hpBar.querySelector(":scope > .boss-hp-shield-overlay");
        if(!shieldOverlay){
            shieldOverlay=document.createElement("div");
            shieldOverlay.className="boss-hp-shield-overlay";
            const label=hpBar.querySelector(":scope > .monster-bar-text");
            hpBar.insertBefore(shieldOverlay,label||null);
        }
        card.querySelectorAll(":scope > .boss-shield-hud").forEach(node=>node.remove());
        const boss=activeBattleContext&&activeBattleContext.boss;
        const shield=boss&&boss.vBossShield;
        const current=Math.max(0,numeric(shield&&shield.current,0));
        const maximum=Math.max(1,numeric(boss&&boss.maxHP,1));
        const health=Math.max(0,Math.min(maximum,numeric(boss&&boss.hp,0)));
        const total=current>0?maximum+current:maximum;
        const hpPercent=health/total*100;
        const shieldPercent=current/total*100;
        const hpInner=hpBar.querySelector(":scope > .monster-hp-inner");
        const label=hpBar.querySelector(":scope > .monster-bar-text");
        if(hpInner){ hpInner.style.width=hpPercent+"%"; }
        shieldOverlay.style.left=hpPercent+"%";
        shieldOverlay.style.width=shieldPercent+"%";
        if(label){ label.textContent=Math.floor(health)+" / "+Math.floor(maximum); }
    }

    function objectDefinition(type){
        return BOSS_OBJECT_DEFINITIONS[type]||null;
    }
    function buildBossObject(type,slot,sourceKey){
        const definition=objectDefinition(type),boss=activeBoss();
        if(!definition||!boss||type==="shield"){ return null; }
        const expected=activeBattleContext.expectedPartySize||expectedPartySizeForLevel(boss.level);
        const scaledHp=Math.round(boss.maxHP*definition.hpRatio);
        const levelFloor=Math.round((BOSS_BALANCE.objectBaseHpPerMember+boss.level*BOSS_BALANCE.objectLevelHpPerMember)*expected);
        const object=buildBaseMonster(definition.name,boss.level,boss.element,"regular");
        Object.assign(object,{
            alive:true,
            hp:Math.max(1,scaledHp,levelFloor),
            maxHP:Math.max(1,scaledHp,levelFloor),
            sp:0,
            maxSP:0,
            defense:Math.max(0,Math.round(numeric(boss.defense,0)*.4)),
            rank:"construct",
            unitKind:"boss-object",
            objectType:type,
            objectKind:definition.kind,
            objectEffect:definition.effect,
            objectSourceKey:sourceKey,
            canAct:false,
            noRewards:true,
            noKillCredit:true,
            rewardEligible:false,
            skillChance:0,
            skillIds:[],
            v141SupportSkillIds:[],
            vGameplayBattlefieldSlot:slot,
            vGameplayPortrait:definition.portrait||null,
            countdown:definition.countdown||null,
            spawnedRound:typeof turn!=="undefined"?turn:1
        });
        return object;
    }
    function spawnBossObject(type,sourceKey){
        const definition=objectDefinition(type),boss=activeBoss(),context=activeBattleContext;
        if(!definition||!boss||!context){ return null; }
        if(type==="shield"){
            const amount=Math.max(1,Math.round(boss.maxHP*definition.shieldRatio));
            return applyBossShield(amount)?{type:"shield",amount:amount}:null;
        }
        if(aliveBossObjects().length>=2){ return null; }
        const slot=nextBossObjectSlot(),owner=battlefieldSlotOwner(),snapshot=bossBattlefieldSnapshot();
        if(!slot||!owner||!snapshot||typeof monsters==="undefined"||typeof currentBattleMonsters==="undefined"){ return null; }
        const object=buildBossObject(type,slot,sourceKey);
        if(!object){ return null; }
        const index=monsters.length;
        /* Slot assignment is the commit point. Never publish an object to the
           combat roster unless the formal Boss snapshot accepted its slot. */
        if(!owner.assignMonsterToEnemySlot(snapshot,index,slot)){
            recordLifecycleViolation("boss-object-slot-rejected",{index:index,slot:slot,type:type});
            return null;
        }
        try{
            monsters.push(object);
            currentBattleMonsters.push(index);
            if(!Array.isArray(context.objectIndexes)){ context.objectIndexes=[]; }
            context.objectIndexes.push(index);
        }catch(error){
            owner.removeMonsterFromEnemySlot(snapshot,index);
            if(monsters[index]===object){ monsters.pop(); }
            const rosterIndex=currentBattleMonsters.lastIndexOf(index);
            if(rosterIndex>=0){ currentBattleMonsters.splice(rosterIndex,1); }
            if(Array.isArray(context.objectIndexes)){
                const objectIndex=context.objectIndexes.lastIndexOf(index);
                if(objectIndex>=0){ context.objectIndexes.splice(objectIndex,1); }
            }
            recordLifecycleViolation("boss-object-rollback",{index:index,slot:slot,type:type,message:String(error&&error.message||error)});
            return null;
        }
        if(typeof addBattleLog==="function"){
            addBattleLog(boss.name+"召出【"+object.name+"】！");
        }
        if(typeof renderBattle==="function"){ renderBattle(); }
        else if(typeof updateUI==="function"){ updateUI(); }
        return object;
    }

    function summonBossElites(){
        const context=activeBattleContext,boss=activeBoss();
        if(!context||!boss||context.summonsCreated||typeof monsters==="undefined"||
           !Array.isArray(monsters)||typeof currentBattleMonsters==="undefined"||
           !Array.isArray(currentBattleMonsters)){ return false; }
        const definition={id:boss.vGameplayBossId||context.definitionId||("tower-"+numeric(context.floor,0)),level:boss.level,element:boss.element};
        const stage=Math.max(numeric(context.combatPhase,1),numeric(context.stage,1));
        const guards=buildBossSupportRoster(definition,{stage:stage,mode:context.mode});
        const owner=battlefieldSlotOwner(),snapshot=bossBattlefieldSnapshot();
        if(guards.length!==BOSS_BALANCE.reinforcementCount||!owner||!snapshot||
           BOSS_REINFORCEMENT_SLOTS.some(slot=>owner.getAssignedMonsterAtEnemySlot(snapshot,slot)!==null)){
            return false;
        }
        const indexes=guards.map((_,offset)=>monsters.length+offset);
        /* Summoning is atomic. A failed Slot assignment must not mark the plan
           complete or leave a card that the renderer later places by fallback. */
        for(let supportIndex=0;supportIndex<guards.length;supportIndex++){
            if(!owner.assignMonsterToEnemySlot(snapshot,indexes[supportIndex],BOSS_REINFORCEMENT_SLOTS[supportIndex])){
                indexes.forEach(index=>owner.removeMonsterFromEnemySlot(snapshot,index));
                return false;
            }
        }
        guards.forEach((guard,supportIndex)=>{
            const index=indexes[supportIndex];
            guard.unitKind="boss-reinforcement";
            guard.canAct=true;
            guard.vGameplayBattlefieldSlot=BOSS_REINFORCEMENT_SLOTS[supportIndex];
            monsters.push(guard);
            currentBattleMonsters.push(index);
        });
        context.summonsCreated=true;
        context.supportCount=guards.length;
        if(typeof addBattleLog==="function"){ addBattleLog(boss.name+"召來兩名同元素精英援軍助戰！"); }
        if(typeof renderBattle==="function"){ renderBattle(); }
        else if(typeof updateUI==="function"){ updateUI(); }
        captureReinforcementProjection(indexes);
        return guards.length===BOSS_BALANCE.reinforcementCount;
    }
    function processBossSummonPlan(round,boss){
        const context=activeBattleContext,plan=context&&context.summonPlan;
        if(!context||!plan||context.summonsCreated||!boss){ return false; }
        const roundReady=plan.round!==undefined&&round>=numeric(plan.round,1);
        const hpReady=plan.hpBelow!==undefined&&boss.hp/Math.max(1,boss.maxHP)<=numeric(plan.hpBelow,0);
        return roundReady||hpReady?summonBossElites():false;
    }
    function partyIndexes(){
        if(typeof getExistingPartyIndexes==="function"){ return getExistingPartyIndexes(); }
        return [0,1,2,3,4,5].filter(index=>typeof getPartyCharacterByIndex==="function"&&getPartyCharacterByIndex(index));
    }
    function applyTelegraphedMajor(){
        const boss=activeBoss();if(!boss){ return; }
        if(typeof addBattleLog==="function"){ addBattleLog(boss.name+"完成【滅魂陣】，大型攻勢爆發！"); }
        partyIndexes().forEach(index=>{
            const character=getPartyCharacterByIndex(index),stats=getPartyBattleStats(index);
            if(!character||!stats||character.hp<=0){ return; }
            let damage=Math.max(1,Math.round(stats.maxHP*.42));
            if(character.isDefending){ damage=Math.max(1,Math.floor(damage*.5)); }
            const shield=(character.activeBuffs||[]).find(buff=>buff&&buff.type==="shield"&&numeric(buff.turnsLeft)>0&&numeric(buff.remaining)>0);
            if(shield){
                const absorbed=Math.min(damage,numeric(shield.remaining));
                shield.remaining-=absorbed;
                damage-=absorbed;
            }
            if(damage>0){
                character.hp=Math.max(0,character.hp-damage);
                if(typeof showPlayerHit==="function"){ showPlayerHit(damage,"hp",index,false); }
            }
        });
        if(typeof updateUI==="function"){ updateUI(); }
    }
    function retireBossObject(entry,reason){
        if(!entry||!entry.monster||!entry.monster.alive){ return; }
        entry.monster.alive=false;
        entry.monster.hp=0;
        releaseBossObjectSlot(entry.index,entry.monster,reason||"retired");
        if(typeof addBattleLog==="function"){
            addBattleLog("【"+entry.monster.name+"】消失。"+(entry.monster.objectType==="charge"&&reason!=="resolved"?"大型技能已取消。":""));
        }
        if(typeof renderBattle==="function"){ renderBattle(); }
    }
    function processBossRound(){
        if(!activeBattleContext){ return false; }
        const round=typeof turn!=="undefined"?turn:1,boss=activeBoss();
        if(!boss){ return false; }
        updateBossCombatPhase();
        processBossSummonPlan(round,boss);
        aliveBossObjects().slice().forEach(entry=>{
            const object=entry.monster;
            if(object.spawnedRound>=round){ return; }
            if(object.objectType==="charge"){
                object.countdown=Math.max(0,numeric(object.countdown,0)-1);
                if(object.countdown<=0){ applyTelegraphedMajor();retireBossObject(entry,"resolved"); }
            }else if(object.objectType==="heal"){
                const amount=Math.max(1,Math.round(boss.maxHP*BOSS_OBJECT_DEFINITIONS.heal.healRatio));
                const before=boss.hp;
                boss.hp=Math.min(boss.maxHP,boss.hp+amount);
                const actual=boss.hp-before;
                if(actual>0&&typeof showMonsterHit==="function"){ showMonsterHit(bossIndex(),actual,"heal"); }
                if(actual>0&&typeof addBattleLog==="function"){
                    addBattleLog("【"+object.name+"】使"+boss.name+"恢復"+actual+"點生命。");
                }
            }
        });
        if(typeof checkBattleEnd==="function"&&checkBattleEnd()){ return true; }
        (activeBattleContext.objectPlan||[]).forEach((plan,index)=>{
            const key="object-plan-"+index;
            if(activeBattleContext.spawnedPlans[key]){ return; }
            const roundReady=plan.round!==undefined&&round>=plan.round;
            const hpReady=plan.hpBelow!==undefined&&boss.hp/Math.max(1,boss.maxHP)<=plan.hpBelow;
            if(roundReady||hpReady){
                const created=spawnBossObject(plan.type,key);
                if(created){ activeBattleContext.spawnedPlans[key]=true; }
            }
        });
        syncBossShieldHud();
        return false;
    }
    function combatPhaseLabel(phase){ return ["第一階段","第二階段","第三階段","最終階段"][Math.max(1,Math.floor(numeric(phase,1)))-1]||("第 "+phase+" 階段"); }
    function updateBossCombatPhase(){
        const context=activeBattleContext,boss=activeBoss();
        if(!context||!boss||numeric(context.totalPhases,1)<=1){ return false; }
        const total=clamp(Math.floor(numeric(context.totalPhases,1)),1,4);
        const hpRatio=clamp(numeric(boss.hp,0)/Math.max(1,numeric(boss.maxHP,1)),0,1);
        const next=clamp(Math.floor((1-hpRatio)*total)+1,1,total);
        if(next<=numeric(context.combatPhase,1)){ return false; }
        context.combatPhase=next;
        configureBossSkills(boss,boss.element,next);
        if(typeof addBattleLog==="function"){
            addBattleLog(boss.name+"進入"+combatPhaseLabel(next)+"，行動模式改變了。");
        }
        return true;
    }

    function resolveEnemyDamageTargets(primaryIndex,targetType){
        if(!activeBattleContext){ return null; }
        const alive=(typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[])
            .filter(index=>monsterAt(index)&&monsterAt(index).alive);
        if(targetType==="all"||targetType==="enemyAll"){ return alive; }
        return alive.includes(primaryIndex)?[primaryIndex]:[];
    }
    function outgoingDamageMultiplier(attacker){
        return attacker===activeBoss()&&bossHasObject("amplify")
            ?BOSS_OBJECT_DEFINITIONS.amplify.damageMultiplier:1;
    }
    function healingMultiplier(){
        return bossHasObject("seal")?BOSS_OBJECT_DEFINITIONS.seal.healingMultiplier:1;
    }
    function onEnemyDeath(index,monster){
        if(!isBossObject(monster)){ return false; }
        releaseBossObjectSlot(index,monster,"destroyed");
        if(typeof addBattleLog==="function"){
            addBattleLog("【"+monster.name+"】已被破壞，持續效果立即停止。");
        }
        syncBossShieldHud();
        if(typeof renderBattle==="function"){ renderBattle(); }
        return true;
    }
    function cleanupBossBattlePresentation(){
        releaseBossBattlefieldSnapshot();
        if(typeof document!=="undefined"){
            const area=document.getElementById("battleMonsterArea");
            if(area){ area.classList.remove("gameplay-boss-active"); }
        }
    }
    function targetGeometry(index){
        if(typeof document==="undefined"){ return null; }
        const card=document.getElementById("battleMonster"+index);
        if(!card||typeof card.getBoundingClientRect!=="function"){ return null; }
        const rect=card.getBoundingClientRect();
        return rect.width>0&&rect.height>0?{
            left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,
            width:rect.width,height:rect.height,
            centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2
        }:null;
    }

    function inventoryDefinition(id){
        if(typeof window.v132GetOreDefinition==="function"){ return window.v132GetOreDefinition(id); }
        const content=typeof window.v132GetContentDefinitions==="function"?window.v132GetContentDefinitions():null;
        return content&&content.ores?content.ores.find(item=>item.id===id)||null:null;
    }
    function addGold(amount){ if(typeof gold!=="undefined"){ gold+=Math.max(0,Math.floor(numeric(amount))); } }
    function grantOre(id,count){
        if(!id||!count){ return true; }const definition=inventoryDefinition(id);
        return !!(definition&&typeof window.v132AddItemToInventory==="function"&&window.v132AddItemToInventory(definition,count));
    }
    function grantConfiguredReward(definition,first){
        const goldAmount=first?definition.firstGold:definition.repeatGold;addGold(goldAmount);
        if(first&&definition.ore&&!grantOre(definition.ore,definition.firstOre||1)){ addGold(500*(definition.firstOre||1)); }
        if(!first&&definition.ore&&definition.id.indexOf("personal-")===0&&!grantOre(definition.ore,1)){ addGold(500); }
        if(first&&definition.relic&&typeof window.v174RelicDevUnlock==="function"){ window.v174RelicDevUnlock(definition.relic); }
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        if(typeof window.v141ShowBlackGoldReward==="function"){ window.v141ShowBlackGoldReward({gold:goldAmount,exp:0,items:[]}); }
    }
    function completePersonalBoss(definition,outcome){
        const progress=state.personal[definition.id];
        if(outcome&&outcome.result==="win"){
            const first=!progress.firstClear;grantConfiguredReward(definition,first);progress.firstClear=true;progress.clears++;persist();
        }
        cleanupBossBattlePresentation();activeBattleContext=null;bossDetail={type:"personal",id:definition.id};if(typeof showPage==="function"){ showPage("boss"); }renderBossPage();
    }
    function completeWorldStage(definition,stage,outcome){
        const progress=state.world[definition.id];
        if(outcome&&outcome.result==="win"){
            if(stage>progress.completedStages){ progress.completedStages=stage;persist(); }
            if(stage===4){
                const first=!progress.firstClear;grantConfiguredReward(definition,first);progress.firstClear=true;progress.completedStages=4;progress.clears++;persist();
            }
        }
        cleanupBossBattlePresentation();activeBattleContext=null;bossDetail={type:"world",id:definition.id};if(typeof showPage==="function"){ showPage("boss"); }renderBossPage();
    }
    function startBoss(type,id){
        if(battleStarting||typeof battleActive!=="undefined"&&battleActive){ return false; }
        const world=type==="world",definition=world?findWorld(id):findPersonal(id);if(!definition||highestCharacterLevel()<definition.level){ return false; }
        const progress=world?state.world[definition.id]:state.personal[definition.id];
        const stage=world?(progress.firstClear?4:Math.min(4,progress.completedStages+1)):1;
        const stageProfile=world?WORLD_STAGE_PROFILES[stage-1]:{stage:1,hpFactor:1,attackFactor:1,objects:definition.objects,summon:definition.summon||null};
        const mode=world?"world":"personal";
        const balance=bossBalanceProfile(definition.level,mode,stage);
        const boss=buildBossMonster(definition,{stage:stage,mode:mode,hpFactor:stageProfile.hpFactor,attackFactor:stageProfile.attackFactor});
        activeBattleContext={mode:mode,definitionId:definition.id,stage:stage,combatPhase:1,totalPhases:world?1:definition.phases,boss:boss,bossIndex:null,expectedPartySize:balance.expectedPartySize,supportCount:0,summonPlan:stageProfile.summon,summonsCreated:false,objectIndexes:[],objectPlan:(world?stageProfile.objects:definition.objects).map(item=>Object.assign({},item)),spawnedPlans:{}};
        battleStarting=true;
        const started=window.v132LaunchDungeonBattle([boss],outcome=>world?completeWorldStage(definition,stage,outcome):completePersonalBoss(definition,outcome));
        battleStarting=false;
        if(!started){ cleanupBossBattlePresentation();activeBattleContext=null;return false; }
        seedBossBattlefieldSnapshot();
        return true;
    }

    function towerReward(floor){
        const first=!state.tower.claimedFloors[String(floor)];
        if(!first){ return false; }
        const milestone=TOWER_CONFIG.milestones.includes(floor),boss=floor%10===0,elite=floor%5===0;
        const amount=120+floor*18+(elite?180:0)+(boss?450:0)+(milestone?700:0);addGold(amount);
        state.tower.claimedFloors[String(floor)]=true;
        if(floor===50){ state.tower.pendingRelicChoice=true; }
        if(typeof window.v141ShowBlackGoldReward==="function"){ window.v141ShowBlackGoldReward({gold:amount,exp:0,items:[]}); }
        return true;
    }
    function completeTowerFloor(floor,outcome){
        if(outcome&&outcome.result==="win"){
            if(floor>state.tower.completedFloor){ state.tower.completedFloor=floor; }
            state.tower.highestThisWeek=Math.max(state.tower.highestThisWeek,floor);
            state.tower.historicalHighest=Math.max(state.tower.historicalHighest,floor);
            towerReward(floor);persist();
        }
        cleanupBossBattlePresentation();activeBattleContext=null;if(typeof showPage==="function"){ showPage("tower"); }renderTowerPage();
    }
    function startTowerFloor(floor){
        ensureCurrentTowerWeek();
        const target=clamp(Math.floor(numeric(floor,state.tower.completedFloor+1)),1,TOWER_FLOORS);
        if(battleStarting||highestCharacterLevel()<TOWER_UNLOCK_LEVEL||state.tower.pendingRelicChoice||target>state.tower.completedFloor+1){ return false; }
        const roster=buildTowerRoster(target),boss=target%10===0?roster[0]:null;
        const towerPhases=boss?(target===100?4:(target>=70?3:(target>=40?2:1))):1;
        const balance=boss?bossBalanceProfile(boss.level,"tower",towerPhases):null;
        activeBattleContext={mode:"tower",floor:target,boss:boss,bossIndex:null,combatPhase:1,totalPhases:towerPhases,expectedPartySize:balance?balance.expectedPartySize:expectedPartySizeForLevel(towerMonsterLevel(target)),supportCount:0,summonPlan:boss?towerSummonPlan(target):null,summonsCreated:false,objectIndexes:[],objectPlan:boss?towerObjectPlan(target):[],spawnedPlans:{}};
        battleStarting=true;const started=window.v132LaunchDungeonBattle(roster,outcome=>completeTowerFloor(target,outcome));
        battleStarting=false;
        if(!started){ cleanupBossBattlePresentation();activeBattleContext=null;return false; }
        if(boss){ seedBossBattlefieldSnapshot(); }
        return true;
    }
    function chooseTowerRelic(id){
        const choice=TOWER_CONFIG.relicChoices.find(item=>item.id===id);if(!choice||!state.tower.pendingRelicChoice){ return false; }
        let alreadyOwned=false;
        if(window.v174RelicSystem&&typeof window.v174RelicSystem.getOwnedState==="function"){
            const owned=window.v174RelicSystem.getOwnedState();alreadyOwned=!!(owned&&owned[id]&&owned[id].unlocked);
        }
        if(!alreadyOwned&&typeof window.v174RelicDevUnlock==="function"){ window.v174RelicDevUnlock(id); }
        else{ addGold(3000); }
        state.tower.pendingRelicChoice=false;persist();renderTowerPage();return true;
    }

    function markGameplayNav(){
        document.querySelectorAll(".nav-button").forEach(button=>button.classList.remove("active"));
        const button=document.getElementById("bossNav");if(button){ button.classList.add("active"); }
    }
    function openGameplay(){ abyssSession=false;if(typeof showPage==="function"){ showPage("gameplay"); }renderGameplayHub(); }
    function openBoss(){ abyssSession=false;bossDetail=null;if(typeof showPage==="function"){ showPage("boss"); }renderBossPage(); }
    function openTower(){ abyssSession=false;towerOverviewOpen=false;if(typeof showPage==="function"){ showPage("tower"); }renderTowerPage(); }
    function openAbyss(){
        abyssSession=true;if(typeof showPage==="function"){ showPage("dungeon"); }
        if(typeof window.v174AbyssBackToSelection==="function"){ window.v174AbyssBackToSelection(); }
        else if(typeof switchDungeonTab==="function"){ switchDungeonTab("abyss"); }
        markGameplayNav();return true;
    }
    function openDailyDungeons(){ abyssSession=false;if(typeof showPage==="function"){ showPage("dungeon"); }if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); } }

    if(typeof showPage==="function"){
        const previous=showPage;
        showPage=function(page){
            const result=previous.apply(this,arguments);
            if(page==="gameplay"){ renderGameplayHub(); }
            else if(page==="boss"){ renderBossPage(); }
            else if(page==="tower"){ renderTowerPage(); }
            else if(page==="dungeon"&&abyssSession){ markGameplayNav(); }
            return result;
        };
    }

    window.vGameplayBackToHub=openGameplay;
    window.vGameplayOpenBoss=openBoss;
    window.vGameplayOpenTower=openTower;
    window.vGameplayOpenAbyss=openAbyss;
    window.vGameplayOpenDailyDungeons=openDailyDungeons;
    window.vGameplaySwitchBossTab=switchBossTab;
    window.vGameplayOpenBossDetail=openBossDetail;
    window.vGameplayCloseBossDetail=function(){ bossDetail=null;renderBossPage(); };
    window.vGameplayStartBoss=startBoss;
    window.vGameplayContinueTower=function(){ return startTowerFloor(state.tower.completedFloor>=TOWER_FLOORS?TOWER_FLOORS:state.tower.completedFloor+1); };
    window.vGameplayToggleTowerOverview=function(){ towerOverviewOpen=!towerOverviewOpen;renderTowerPage(); };
    window.vGameplaySelectTowerBand=startTowerFloor;
    window.vGameplayChooseTowerRelic=chooseTowerRelic;
    window.vGameplayRenderHub=renderGameplayHub;
    window.vGameplayRenderBoss=renderBossPage;
    window.vGameplayRenderTower=renderTowerPage;
    window.switchBossTab=switchBossTab;

    window.FourSymbolsBossBattle=Object.freeze({
        version:"boss-target-entity-v1",
        isActive:function(){ return !!activeBoss(); },
        getBossIndex:bossIndex,
        isBossIndex:isBossIndex,
        isBossObjectIndex:isBossObjectIndex,
        getBossFootprintSlots:function(){ return BOSS_FOOTPRINT_SLOTS.slice(); },
        getReinforcementSlots:function(){ return BOSS_REINFORCEMENT_SLOTS.slice(); },
        getLastReinforcementProjection:function(){ return activeBattleContext&&copy(activeBattleContext.lastReinforcementProjection||null); },
        getLifecycleDiagnostics:function(){ return activeBattleContext&&copy(activeBattleContext.lifecycleDiagnostics||[]); },
        recordLifecycleViolation:recordLifecycleViolation,
        getObjectSlots:function(){ return BOSS_OBJECT_SLOTS.slice(); },
        resolveEnemyDamageTargets:resolveEnemyDamageTargets,
        getTargetGeometry:targetGeometry,
        getShieldState:function(){ const shield=bossShield();return shield?copy(shield):null; },
        applyShield:applyBossShield,
        consumeDamageSettlement:consumeBossDamageSettlement,
        onEnemyDeath:onEnemyDeath,
        processRound:processBossRound,
        getOutgoingDamageMultiplier:outgoingDamageMultiplier,
        getHealingMultiplier:healingMultiplier,
        syncHud:syncBossShieldHud,
        canEnemyAct:function(index){ const monster=monsterAt(index);return !!monster&&monster.alive&&monster.canAct!==false; },
        isRewardEligible:function(index){ const monster=monsterAt(index);return !!monster&&!monster.noRewards; }
    });

    window.GameplaySystem=Object.freeze({
        stateVersion:STATE_VERSION,
        personalBosses:PERSONAL_BOSSES,
        worldBosses:WORLD_BOSSES,
        worldStageProfiles:WORLD_STAGE_PROFILES,
        objects:BOSS_OBJECT_DEFINITIONS,
        towerConfig:TOWER_CONFIG,
        bossBalance:BOSS_BALANCE,
        getBossBalanceProfile:function(level,mode,stage){ return copy(bossBalanceProfile(level,mode,stage)); },
        getSerializableState:serializableState,
        normalizeState:normalizeState,
        getWeekInfo:utcWeekInfo,
        getTowerFloorKind:towerFloorKind,
        buildTowerRoster:buildTowerRoster,
        getActiveBattleState:function(){ return activeBattleContext?copy({mode:activeBattleContext.mode,definitionId:activeBattleContext.definitionId||null,stage:activeBattleContext.stage||null,floor:activeBattleContext.floor||null,combatPhase:activeBattleContext.combatPhase||1,totalPhases:activeBattleContext.totalPhases||1,bossIndex:bossIndex(),objectIndexes:(activeBattleContext.objectIndexes||[]).slice(),shield:bossShield()}):null; },
        debugSpawnBossObject:spawnBossObject,
        debugProcessBossRound:processBossRound,
        debugReloadState:function(raw,now){ state=normalizeState(raw,now);return serializableState(); }
    });

    if(initialStateNeedsPersist||ensureCurrentTowerWeek()){ persist(); }
    if(typeof document!=="undefined"){
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",renderGameplayHub,{once:true}); }
        else{ setTimeout(renderGameplayHub,0); }
    }
})();


/* bundled source: js/60-team-relic-system.js */
/* =====================================================
   Team Relic System — first production runtime
   - One relic per party loadout.
   - Relics are independent battlefield events: no skill slot, action or SP use.
   - Persistent ownership is embedded in the existing SAVE_KEY save document.
   - Battle counters are transient and reset for every battle.
===================================================== */
(function installTeamRelicSystem(){
    "use strict";

    if(typeof window==="undefined"||window.__teamRelicSystemInstalled){ return; }
    window.__teamRelicSystemInstalled=true;

    const SOURCE_RELIC="relic";
    const MAX_LEVEL=20;
    const CATEGORY_LABELS={
        all:"全部",attack:"攻擊",recovery:"回復",defense:"防禦",buff:"增益",
        control:"控制",element:"元素聯動",special:"特殊"
    };
    const RARITY_ORDER={white:0,blue:1,purple:2,orange:3,pink:4,"four-symbol":5};
    const RARITY_LABELS={white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"};

    const RELIC_BALANCE_CONFIG=Object.freeze({
        basePower:40,
        averagePartyLevelPower:5,
        relicLevelPower:8,
        bossDamageModifier:0.75,
        bossDebuffEfficiency:0.65,
        groupDamageModifier:1,
        healModifier:1,
        shieldModifier:1,
        controlModifier:1,
        burnPercent:3,
        bannerDurationMs:1400,
        presentationDurationMs:2200,
        presentationLeadGapMs:500,
        upgradeGoldBase:650,
        upgradeGoldPerLevel:180
    });

    function scalar(points,level){
        const list=(points||[]).slice().sort((a,b)=>a[0]-b[0]);
        const lv=Math.max(1,Math.min(MAX_LEVEL,Math.floor(Number(level)||1)));
        if(!list.length){ return 0; }
        if(lv<=list[0][0]){ return Number(list[0][1])||0; }
        for(let i=1;i<list.length;i++){
            const left=list[i-1],right=list[i];
            if(lv<=right[0]){
                const ratio=(lv-left[0])/Math.max(1,right[0]-left[0]);
                return (Number(left[1])||0)+((Number(right[1])||0)-(Number(left[1])||0))*ratio;
            }
        }
        return Number(list[list.length-1][1])||0;
    }

    function trigger(id,type,options,effects){
        return Object.assign({
            id:id,type:type,phase:null,threshold:null,roundInterval:null,hpThreshold:null,
            resetOnTrigger:false,maxTriggersPerRound:null,maxTriggersPerBattle:null,
            cooldownRounds:0,oncePerBattle:false,effects:effects||[]
        },options||{});
    }
    function effect(type,options){ return Object.assign({type:type,sourceType:SOURCE_RELIC},options||{}); }

    const RELIC_CATALOG_LIST=[
        {
            id:"relic_qiankun_flask",name:"乾坤玉壺",category:"recovery",tags:["recovery","sustain"],rarity:"blue",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"奇數回合結束時，穩定恢復全隊生命；高等級追加少量SP回復。",
            scalars:{healHpPercent:[[1,4],[5,4.5],[10,5],[15,6],[20,7]],spPercent:[[1,0],[9,0],[10,1],[15,1.5],[20,2]]},
            triggers:[trigger("odd_end","odd_round_end",{maxTriggersPerRound:1},[
                effect("heal_all_allies",{percentKey:"healHpPercent"}),effect("restore_sp_all",{percentKey:"spPercent",minLevel:10})
            ])],
            triggerText:"奇數回合結束時",limitText:"無每場總次數限制；每個符合條件的奇數回合最多觸發一次。",
            nextText:{5:"HP回復提高至4.5%",10:"HP回復5%，追加1%最大SP",15:"HP 6%＋SP 1.5%",20:"HP 7%＋SP 2%"}
        },
        {
            id:"relic_sun_orb",name:"烈陽神珠",category:"attack",tags:["attack","group"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"偶數回合開始時對敵方全體造成穩定秘寶傷害，對燃燒目標更強。",
            scalars:{damageMultiplier:[[1,.75],[10,.9],[20,1.1]],burnBonus:[[1,0],[9,0],[10,.15],[20,.25]]},
            triggers:[trigger("even_start","even_round_start",{},[
                effect("damage_all_enemies",{multiplierKey:"damageMultiplier",bonusAgainstStatus:"burn",bonusKey:"burnBonus",element:"fire"})
            ])],
            triggerText:"偶數回合開始時",limitText:"不能暴擊，不觸發角色追擊或吸血。",
            nextText:{10:"傷害0.90×秘寶威力；燃燒目標+15%",20:"傷害1.10×；燃燒目標+25%"}
        },
        {
            id:"relic_xuanwu_seal",name:"玄武靈印",category:"defense",tags:["defense","shield"],rarity:"blue",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"每第3回合開始為全隊建立不疊加的護盾。",
            scalars:{shieldPercent:[[1,6],[10,8],[20,10]],damageReduction:[[1,0],[19,0],[20,8]]},
            triggers:[trigger("third_start","every_n_rounds",{phase:"round_start",roundInterval:3},[
                effect("shield_all",{percentKey:"shieldPercent",durationRounds:2}),effect("buff_all",{minLevel:20,damageReductionKey:"damageReduction",durationRounds:1})
            ])],
            triggerText:"每第3回合開始時",limitText:"同一秘寶護盾不可相加；只保留較高護盾值。",
            nextText:{10:"護盾提高至最大HP 8%",20:"護盾10%，並獲得1回合8%減傷"}
        },
        {
            id:"relic_soul_bell",name:"鎮魂古鐘",category:"control",tags:["control","soft-control"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"每第4回合開始，以降攻與降命中壓制敵方全體。",
            scalars:{attackDown:[[1,10],[10,12],[20,15]],accuracyDown:[[1,0],[9,0],[10,5],[20,8]]},
            triggers:[trigger("fourth_start","every_n_rounds",{phase:"round_start",roundInterval:4},[
                effect("debuff_all_enemies",{attackDownKey:"attackDown",accuracyDownKey:"accuracyDown",durationRounds:1})
            ])],
            triggerText:"每第4回合開始時",limitText:"BOSS套用較低效率；不造成全體硬控。",
            nextText:{10:"降攻12%並追加命中-5%",20:"降攻15%、命中-8%"}
        },
        {
            id:"relic_tiangang_banner",name:"天罡戰旗",category:"defense",tags:["attack","defense","anti_swarm"],rarity:"orange",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"我方累積遭受6次敵方有效攻擊後反擊全體，敵人越多越容易累積。",
            scalars:{damageMultiplier:[[1,.65],[10,.8],[20,1]],attackDown:[[1,0],[9,0],[10,5],[20,8]]},
            triggers:[trigger("ally_hits_6","ally_hit_count",{threshold:6,resetOnTrigger:true,maxTriggersPerRound:1},[
                effect("damage_all_enemies",{multiplierKey:"damageMultiplier"}),effect("debuff_all_enemies",{minLevel:10,attackDownKey:"attackDown",durationRounds:1})
            ])],
            triggerText:"我方累積受到6次敵方有效攻擊後",limitText:"觸發後受擊計數歸零；每回合最多一次。",
            nextText:{10:"全體傷害0.80×並降攻5%一回合",20:"全體傷害1.00×並降攻8%"}
        },
        {
            id:"relic_nine_dragon_fire",name:"九龍神火罩",category:"element",tags:["attack","fire","anti_swarm"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"敵方累積完成7次有效行動後爆發全體火屬性秘寶傷害。",
            scalars:{damageMultiplier:[[1,.8],[5,.85],[10,.9],[15,1],[20,1.1]],burnChance:[[1,0],[9,0],[10,.2],[15,.25],[20,.3]],burnBonus:[[1,0],[19,0],[20,.15]]},
            triggers:[trigger("enemy_actions_7","enemy_action_count",{threshold:7,resetOnTrigger:true,maxTriggersPerRound:1},[
                effect("damage_all_enemies",{multiplierKey:"damageMultiplier",element:"fire",bonusAgainstStatus:"burn",bonusKey:"burnBonus"}),
                effect("apply_status_all_enemies",{minLevel:10,statusId:"burn",chanceKey:"burnChance",durationRounds:2})
            ])],
            triggerText:"敵方累積完成7次有效行動後",limitText:"觸發後敵方行動計數歸零；每回合最多一次。",
            nextText:{5:"全體火傷提高至0.85×",10:"0.90×並有20%機率燃燒",15:"1.00×、燃燒25%",20:"1.10×、燃燒30%，燃燒目標+15%"}
        },
        {
            id:"relic_cold_spring_jade",name:"寒泉玉珮",category:"recovery",tags:["water","emergency","element"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"任一隊友首次跌破35%最大HP時進行急救。",
            scalars:{healHpPercent:[[1,12],[10,15],[20,18]],spPercent:[[1,0],[19,0],[20,4]]},
            triggers:[trigger("hp_below_35","ally_hp_below",{hpThreshold:.35,maxTriggersPerBattle:2,cooldownRounds:3},[
                effect("heal_single_ally",{percentKey:"healHpPercent"}),effect("cleanse_single",{minLevel:10,count:1}),effect("restore_sp_single",{minLevel:20,percentKey:"spPercent"})
            ])],
            triggerText:"任一我方角色在傷害結算後低於35%最大HP時",limitText:"每場最多2次，全域冷卻3回合；同一傷害事件只判定一次。",
            nextText:{10:"急救15%最大HP並解除1個一般負面",20:"急救18%HP、淨化1個可解除負面並回4%最大SP"}
        },
        {
            id:"relic_qinglan_feather",name:"青嵐羽符",category:"buff",tags:["wind","evasion","element"],rarity:"blue",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"戰鬥開始時提高全隊閃避與異常抗性。",
            scalars:{evasionBonus:[[1,8],[10,10],[20,12]],resistanceBonus:[[1,8],[10,10],[20,12]],duration:[[1,2],[19,2],[20,3]]},
            triggers:[trigger("battle_start","battle_start",{oncePerBattle:true},[
                effect("buff_all",{evasionKey:"evasionBonus",resistanceKey:"resistanceBonus",durationKey:"duration"})
            ])],
            triggerText:"戰鬥開始時",limitText:"只在開場觸發一次；維持風系靈活、防控定位。",
            nextText:{10:"閃避與異常抗性各+10%",20:"各+12%，持續3回合"}
        },
        {
            id:"relic_rock_mountain_seal",name:"岩岳鎮印",category:"defense",tags:["earth","pressure","element"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"開場提高全隊防禦，受圍攻時再產生隊伍護盾。",
            scalars:{defenseBonus:[[1,10],[10,12],[20,15]],shieldPercent:[[1,5],[10,6],[20,8]],reflectMultiplier:[[1,0],[19,0],[20,.18]]},
            triggers:[
                trigger("battle_start_defense","battle_start",{oncePerBattle:true},[effect("buff_all",{defenseKey:"defenseBonus",durationRounds:3})]),
                trigger("ally_hits_8","ally_hit_count",{threshold:8,resetOnTrigger:true,maxTriggersPerBattle:2},[
                    effect("shield_all",{percentKey:"shieldPercent",durationRounds:2}),effect("prepare_reflect",{minLevel:20,multiplierKey:"reflectMultiplier",durationRounds:1})
                ])
            ],
            triggerText:"開場；另於我方累積受8次有效攻擊時",limitText:"受擊護盾每場最多2次；Lv20反震只作用於下一名實際攻擊者。",
            nextText:{10:"開場防禦+12%，受擊護盾6%",20:"防禦+15%、護盾8%，追加一次反震"}
        },
        {
            id:"relic_returning_wheel",name:"回天寶輪",category:"special",tags:["recovery","survival"],rarity:"pink",maxLevel:20,iconPath:"",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"每場第一次致命傷害發生時阻止死亡，留下1HP後立即回復並獲得護盾。",
            scalars:{healHpPercent:[[1,15],[10,18],[20,22]],shieldPercent:[[1,8],[10,8],[20,10]]},
            triggers:[trigger("before_lethal","before_lethal_damage",{oncePerBattle:true,maxTriggersPerBattle:1},[
                effect("prevent_death",{}),effect("heal_single_ally",{percentKey:"healHpPercent",afterPreventDeath:true}),
                effect("shield_single",{percentKey:"shieldPercent",durationRounds:1}),effect("cleanse_single",{minLevel:20,count:1})
            ])],
            triggerText:"本場第一次有我方角色將受到致命傷害時",limitText:"整支隊伍每場只觸發一次，不是每個角色各一次。",
            nextText:{10:"保命後回復18%最大HP",20:"回復22%、護盾10%並解除1個一般負面"}
        },
        {id:"relic_origin_talisman",name:"太初聖符",category:"buff",tags:["recovery","cleanse","special"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第4回合結束淨化負面最多的隊友，並恢復全隊HP。",triggerText:"每第4回合結束",limitText:"第一版資料已建立，尚未開放取得。"},
        {id:"relic_broken_army_scroll",name:"破軍殘卷",category:"attack",tags:["execute"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"角色擊敗敵人後，追擊目前HP最低的存活敵人。",triggerText:"角色攻擊／技能擊敗敵人後",limitText:"每回合最多一次；秘寶與DOT擊殺不觸發。"},
        {id:"relic_red_sky_war_mark",name:"赤霄戰紋",category:"buff",tags:["attack","burst"],rarity:"orange",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"戰鬥開始時短暫提高全隊攻擊，後期追加暴擊率。",triggerText:"戰鬥開始時",limitText:"只觸發一次，不長時間常駐。"},
        {id:"relic_ice_mirror_heart",name:"玄冰鏡心",category:"element",tags:["water","frostbite","freeze","control"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第3回合結束，對凍傷或冰封中的敵人追加水屬性秘寶傷害。",triggerText:"每第3回合結束",limitText:"不附加冰封，不刷新凍傷。"},
        {id:"relic_wind_chasing_talisman",name:"追風行符",category:"buff",tags:["wind","tempo"],rarity:"blue",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第3回合開始提高隊伍節奏與閃避。",triggerText:"每第3回合開始",limitText:"第一版資料保留；待確認正式速度 owner 後再開放。"},
        {id:"relic_mountain_river_cauldron",name:"山河寶鼎",category:"defense",tags:["recovery","anti_swarm"],rarity:"orange",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"我方累積受7次有效攻擊後，恢復全隊並短暫提高防禦。",triggerText:"我方累積受7次有效攻擊後",limitText:"每回合最多一次。"},
        {id:"relic_burning_star_mark",name:"焚星殘印",category:"element",tags:["fire","burn","attack"],rarity:"purple",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"偶數回合結束時對燃燒中的敵人追加火屬性秘寶傷害。",triggerText:"偶數回合結束",limitText:"不消耗或刷新燃燒。"},
        {id:"relic_spirit_spring_bottle",name:"靈泉法瓶",category:"recovery",tags:["sp","long-battle"],rarity:"blue",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第3回合結束恢復全隊SP，高等級追加少量HP。",triggerText:"每第3回合結束",limitText:"死亡角色不受影響。"},
        {id:"relic_demon_suppressing_seal",name:"伏魔金印",category:"defense",tags:["buff","cleanse"],rarity:"orange",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"開場提高異常抗性，並在首次中負面時自動淨化。",triggerText:"戰鬥開始；首次成功受到一般負面狀態",limitText:"自動淨化每場一次。"},
        {id:"relic_all_returning_array",name:"萬象歸元盤",category:"special",tags:["adaptive"],rarity:"four-symbol",maxLevel:20,iconPath:"",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第4回合開始依全隊平均HP決定回血或攻防增益。",triggerText:"每第4回合開始",limitText:"一次只發動回血或攻防其中一種。"}
    ];

    RELIC_CATALOG_LIST.forEach(def=>{
        def.upgradeCost={
            items:[],
            goldCost:{base:RELIC_BALANCE_CONFIG.upgradeGoldBase,perLevel:RELIC_BALANCE_CONFIG.upgradeGoldPerLevel},
            formalMaterialSource:null
        };
    });
    const relicCatalog=Object.freeze(Object.fromEntries(RELIC_CATALOG_LIST.map(item=>[item.id,Object.freeze(item)])));
    let playerRelics={};
    let teamLoadout={relicId:null,subRelicId:null};
    let relicBattleState=null;
    let pendingBattleInit=false;
    let currentFilter="all";
    let currentDetailId=null;
    let sourceContext=null;
    let relicVisualCollector=null;
    let relicPresentationTail=Promise.resolve();
    let relicPresentationPending=0;
    let relicPresentationGeneration=0;

    function numeric(value){ const n=Number(value); return Number.isFinite(n)?n:0; }
    function esc(value){ return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
    function currentRound(){ return Math.max(1,Math.floor(typeof turn!=="undefined"?numeric(turn):1)); }
    function currentBattleToken(){ return typeof battleToken!=="undefined"?battleToken:null; }
    function partyIndexes(){ return typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes().slice(0,3):[0,1,2].filter(i=>typeof getPartyCharacterByIndex==="function"&&getPartyCharacterByIndex(i)); }
    function characterAt(index){ return typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null; }
    function statsAt(index){ return typeof getPartyBattleStats==="function"?getPartyBattleStats(index):null; }
    function relicLevel(id){ return Math.max(1,Math.min(MAX_LEVEL,Math.floor(numeric(playerRelics[id]&&playerRelics[id].level)||1))); }
    function valueFor(def,key,level){ return def&&def.scalars&&def.scalars[key]?scalar(def.scalars[key],level):0; }
    function isBoss(monster){ return typeof getMonsterRank==="function"?getMonsterRank(monster)==="boss":!!(monster&&(monster.rank==="boss"||monster.isBoss)); }
    function hasStatus(entity,type){
        if(typeof window.v173HasNamedPersistentState==="function"){ try{return !!window.v173HasNamedPersistentState(entity,type);}catch(_){ } }
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(s=>s&&s.type===type&&numeric(s.turnsLeft)>0));
    }
    function withSource(type,callback){ const previous=sourceContext; sourceContext={sourceType:type}; try{return callback();}finally{sourceContext=previous;} }
    function waitMs(ms){ return new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.floor(numeric(ms))))); }
    function hasLiveBattlePresentationHost(){
        return typeof document!=="undefined"&&typeof document.getElementById==="function"&&!!document.getElementById("battlePage");
    }
    function resetRelicPresentationQueue(){
        relicPresentationGeneration++;
        relicPresentationTail=Promise.resolve();
        relicPresentationPending=0;
        relicVisualCollector=null;
    }
    function currentAnimationGate(){
        const director=window.v142SkillAnimationDirector;
        return director&&typeof director.getActive==="function"?director.getActive():null;
    }
    function waitForAnimationRelease(gate){
        if(!gate){ return Promise.resolve(); }
        const ready=gate.done?Promise.resolve():gate.promise;
        return Promise.resolve(ready).then(()=>waitMs(Math.max(0,numeric(gate.deadline)+RELIC_BALANCE_CONFIG.presentationLeadGapMs-Date.now())));
    }
    function queueRelicVisual(callback){
        if(typeof callback!=="function"){ return; }
        if(relicVisualCollector){ relicVisualCollector.push(callback); return; }
        callback();
    }
    function flushRelicVisuals(list){ (list||[]).forEach(callback=>{ try{callback();}catch(error){console.error("秘寶視覺效果失敗：",error);} }); }
    function queueRelicPresentation(def,onStart){
        if(!hasLiveBattlePresentationHost()){
            showBanner(def);
            if(typeof onStart==="function"){ onStart(); }
            return null;
        }
        const generation=relicPresentationGeneration;
        const token=currentBattleToken();
        const gate=currentAnimationGate();
        const previousTail=relicPresentationTail;
        relicPresentationPending++;
        const job=Promise.resolve(previousTail).catch(()=>{}).then(()=>waitForAnimationRelease(gate)).then(()=>{
            if(generation!==relicPresentationGeneration||typeof battleActive!=="undefined"&&!battleActive||currentBattleToken()!==token){ return; }
            showBanner(def);
            if(typeof onStart==="function"){ onStart(); }
            return waitMs(RELIC_BALANCE_CONFIG.presentationDurationMs);
        }).catch(error=>{ console.error("秘寶演出序列失敗：",error); }).then(()=>{
            if(generation===relicPresentationGeneration){ relicPresentationPending=Math.max(0,relicPresentationPending-1); }
        });
        relicPresentationTail=job;
        return job;
    }
    function normalizeOwned(raw){
        const next={};
        RELIC_CATALOG_LIST.forEach(def=>{
            const saved=raw&&raw[def.id]&&typeof raw[def.id]==="object"?raw[def.id]:{};
            next[def.id]={
                unlocked:saved.unlocked===true||(!Object.prototype.hasOwnProperty.call(saved,"unlocked")&&def.defaultUnlocked===true),
                level:Math.max(1,Math.min(MAX_LEVEL,Math.floor(numeric(saved.level)||1))),
                exp:Math.max(0,Math.floor(numeric(saved.exp))),
                seen:saved.seen===true
            };
        });
        return next;
    }
    function normalizeLoadout(raw){
        const id=raw&&typeof raw.relicId==="string"?raw.relicId:null;
        return {relicId:id&&relicCatalog[id]&&relicCatalog[id].runtimeReady?id:null,subRelicId:null};
    }
    function readSaveDocument(){
        try{
            const repository=window.FourSymbolsAccountSave;
            const uid=repository&&repository.getActiveUid();
            if(!uid){ return null; }
            const result=repository.readForUid(uid);
            return result.status==="ready"?result.save:null;
        }catch(_){ return null; }
    }
    function hydrateFromSave(){
        const data=readSaveDocument()||{};
        playerRelics=normalizeOwned(data.playerRelics);
        teamLoadout=normalizeLoadout(data.teamLoadout);
        window.playerRelics=playerRelics;
        window.teamLoadout=teamLoadout;
    }
    function persistIntoSaveDocument(){
        try{
            const repository=window.FourSymbolsAccountSave;
            const uid=repository&&repository.getActiveUid();
            if(!uid){ return false; }
            const current=repository.readForUid(uid);
            if(current.status!=="ready"){ return false; }
            const data=current.save;
            data.playerRelics=playerRelics;
            data.teamLoadout={relicId:teamLoadout.relicId,subRelicId:null};
            repository.writeForUid(uid,data,{source:"team-relic"});
            return true;
        }catch(error){ console.error("秘寶存檔整合失敗：",error); return false; }
    }
    hydrateFromSave();

    if(typeof saveGame==="function"){
        const previousSaveGame=saveGame;
        saveGame=function(){ const result=previousSaveGame.apply(this,arguments); persistIntoSaveDocument(); return result; };
    }

    function saveRelics(){
        if(typeof saveGame==="function"){ saveGame(); }
        else{ persistIntoSaveDocument(); }
    }

    function getRelicPower(id){
        const indexes=partyIndexes();
        const avg=indexes.length?indexes.reduce((sum,index)=>sum+Math.max(1,numeric(characterAt(index)&&characterAt(index).level)||1),0)/indexes.length:1;
        return Math.max(1,Math.round(RELIC_BALANCE_CONFIG.basePower+avg*RELIC_BALANCE_CONFIG.averagePartyLevelPower+relicLevel(id)*RELIC_BALANCE_CONFIG.relicLevelPower));
    }

    function createBattleState(id){
        return {
            relicId:id||null,battleToken:currentBattleToken(),round:currentRound(),enemyActionCount:0,allyHitCount:0,
            totalTriggers:0,triggerCounts:{},roundTriggerCounts:{},lastTriggerRound:{},onceUsed:{},
            lastHpDamageEvent:{},damageEventSerial:0,playerMods:{},monsterRestores:[],reflectReady:{},
            currentEnemyIndex:null,lastEvent:null,boundaryEvents:{}
        };
    }
    function activeBattleRelic(){ return relicBattleState&&relicBattleState.relicId?relicCatalog[relicBattleState.relicId]:null; }
    function resetRoundCounters(){ if(relicBattleState){ relicBattleState.roundTriggerCounts={}; relicBattleState.round=currentRound(); } }
    function cleanupPlayerMods(){
        if(!relicBattleState){ return; }
        const round=currentRound();
        Object.keys(relicBattleState.playerMods).forEach(key=>{
            relicBattleState.playerMods[key]=(relicBattleState.playerMods[key]||[]).filter(mod=>numeric(mod.expiresRound)>=round);
        });
        Object.keys(relicBattleState.reflectReady).forEach(key=>{ if(numeric(relicBattleState.reflectReady[key].expiresRound)<round){ delete relicBattleState.reflectReady[key]; } });
        const keep=[];
        relicBattleState.monsterRestores.forEach(entry=>{
            if(numeric(entry.expiresRound)>=round){ keep.push(entry); return; }
            const monster=entry.monster;
            if(!monster){ return; }
            if(entry.attack!==undefined){ monster.attack=entry.attack; }
            if(entry.magicAttack!==undefined){ monster.magicAttack=entry.magicAttack; }
            if(entry.accuracy!==undefined){ monster.accuracy=entry.accuracy; }
        });
        relicBattleState.monsterRestores=keep;
    }

    function addPlayerMod(index,mod,duration){
        if(!relicBattleState){ return; }
        const key=String(index),expires=currentRound()+Math.max(1,Math.floor(numeric(duration)||1))-1;
        relicBattleState.playerMods[key]=relicBattleState.playerMods[key]||[];
        relicBattleState.playerMods[key].push(Object.assign({expiresRound:expires,sourceType:SOURCE_RELIC},mod||{}));
    }
    function playerModTotals(index){
        const list=relicBattleState&&relicBattleState.playerMods[String(index)]||[];
        return list.reduce((out,mod)=>{
            ["attackPercent","defensePercent","evasionPercent","resistancePercent","damageReductionPercent"].forEach(key=>{out[key]+=numeric(mod[key]);});
            return out;
        },{attackPercent:0,defensePercent:0,evasionPercent:0,resistancePercent:0,damageReductionPercent:0});
    }
    function decorateStats(index,stats){
        if(!stats||!relicBattleState){ return stats; }
        const mod=playerModTotals(index),copy=Object.assign({},stats);
        if(mod.attackPercent){ copy.attack=numeric(copy.attack)*(1+mod.attackPercent/100); copy.magicAttack=numeric(copy.magicAttack)*(1+mod.attackPercent/100); }
        if(mod.defensePercent){ copy.defense=numeric(copy.defense)*(1+mod.defensePercent/100); }
        if(mod.evasionPercent){ copy.evasion=numeric(copy.evasion)+mod.evasionPercent; }
        if(mod.resistancePercent){ copy.resistance=numeric(copy.resistance)+mod.resistancePercent; copy.statusResistance=numeric(copy.statusResistance)+mod.resistancePercent; }
        return copy;
    }

    if(typeof getPartyBattleStats==="function"){
        const previous=getPartyBattleStats;
        getPartyBattleStats=function(index){ return decorateStats(index,previous.apply(this,arguments)); };
    }
    [["getMainCharacterStats",0],["getPlayer2BattleStats",1],["getPlayer3BattleStats",2]].forEach(([name,index])=>{
        const previous=window[name];
        if(typeof previous==="function"){ window[name]=function(){ return decorateStats(index,previous.apply(this,arguments)); }; }
    });

    function canTrigger(triggerDef,key){
        if(!relicBattleState||!triggerDef){ return false; }
        const round=currentRound();
        const total=numeric(relicBattleState.triggerCounts[key]);
        const inRound=numeric(relicBattleState.roundTriggerCounts[key]);
        if(triggerDef.oncePerBattle&&relicBattleState.onceUsed[key]){ return false; }
        if(triggerDef.maxTriggersPerBattle!==null&&triggerDef.maxTriggersPerBattle!==undefined&&total>=numeric(triggerDef.maxTriggersPerBattle)){ return false; }
        if(triggerDef.maxTriggersPerRound!==null&&triggerDef.maxTriggersPerRound!==undefined&&inRound>=numeric(triggerDef.maxTriggersPerRound)){ return false; }
        const last=relicBattleState.lastTriggerRound[key];
        if(last!==undefined&&numeric(triggerDef.cooldownRounds)>0&&round-last<numeric(triggerDef.cooldownRounds)){ return false; }
        return true;
    }
    function markTriggered(triggerDef,key){
        relicBattleState.totalTriggers++;
        relicBattleState.triggerCounts[key]=numeric(relicBattleState.triggerCounts[key])+1;
        relicBattleState.roundTriggerCounts[key]=numeric(relicBattleState.roundTriggerCounts[key])+1;
        relicBattleState.lastTriggerRound[key]=currentRound();
        if(triggerDef.oncePerBattle){ relicBattleState.onceUsed[key]=true; }
        if(triggerDef.resetOnTrigger){
            if(triggerDef.type==="enemy_action_count"){ relicBattleState.enemyActionCount=0; }
            if(triggerDef.type==="ally_hit_count"){ relicBattleState.allyHitCount=0; }
        }
    }
    function triggerMatches(triggerDef,event,payload,key){
        const round=currentRound();
        if(triggerDef.type==="battle_start"){ return event==="battle_start"; }
        if(triggerDef.type==="round_start"){ return event==="round_start"; }
        if(triggerDef.type==="round_end"){ return event==="round_end"; }
        if(triggerDef.type==="odd_round_start"){ return event==="round_start"&&round%2===1; }
        if(triggerDef.type==="odd_round_end"){ return event==="round_end"&&round%2===1; }
        if(triggerDef.type==="even_round_start"){ return event==="round_start"&&round%2===0; }
        if(triggerDef.type==="even_round_end"){ return event==="round_end"&&round%2===0; }
        if(triggerDef.type==="every_n_rounds"){
            const phase=triggerDef.phase||"round_start";
            return event===phase&&round%Math.max(1,numeric(triggerDef.roundInterval)||1)===0;
        }
        if(triggerDef.type==="enemy_action_count"){ return event==="after_enemy_action"&&relicBattleState.enemyActionCount>=numeric(triggerDef.threshold); }
        if(triggerDef.type==="ally_hit_count"){ return event==="after_ally_hit"&&relicBattleState.allyHitCount>=numeric(triggerDef.threshold); }
        if(triggerDef.type==="ally_hp_below"){
            if(event!=="ally_hp_below"||!payload||!Number.isInteger(payload.targetIndex)){ return false; }
            if(relicBattleState.lastHpDamageEvent[key]===payload.damageEventId){ return false; }
            const character=characterAt(payload.targetIndex),stats=statsAt(payload.targetIndex);
            const threshold=numeric(triggerDef.hpThreshold);
            if(payload.previousHpPercent!==undefined&&numeric(payload.previousHpPercent)<threshold){ return false; }
            return !!(character&&stats&&numeric(character.hp)>0&&numeric(character.hp)/Math.max(1,numeric(stats.maxHP))<threshold);
        }
        if(triggerDef.type==="ally_debuffed"){ return event==="ally_debuffed"; }
        if(triggerDef.type==="enemy_defeated"){ return event==="enemy_defeated"&&payload&&payload.sourceType!==SOURCE_RELIC; }
        if(triggerDef.type==="ally_down"){ return event==="ally_down"; }
        if(triggerDef.type==="before_lethal_damage"){ return event==="before_lethal_damage"; }
        if(triggerDef.type==="once_per_battle"){ return event===(triggerDef.phase||"once_per_battle"); }
        return false;
    }

    function showBanner(def){
        if(typeof document==="undefined"||!def){ return; }
        let node=document.getElementById("teamRelicBattleBanner");
        if(!node){
            node=document.createElement("div"); node.id="teamRelicBattleBanner"; node.className="team-relic-battle-banner";
            const host=document.getElementById("battlePage")||document.getElementById("game-content")||document.body; if(host){ host.appendChild(node); }
        }
        node.innerHTML='<span class="team-relic-battle-icon">寶</span><b>秘寶・'+esc(def.name)+'</b>';
        node.classList.remove("show"); void node.offsetWidth; node.classList.add("show");
        clearTimeout(node.__hideTimer); node.__hideTimer=setTimeout(()=>node.classList.remove("show"),RELIC_BALANCE_CONFIG.bannerDurationMs);
    }
    function battleLog(message){ if(typeof addBattleLog==="function"){ addBattleLog("【秘寶】"+message); } }

    function emitRelicPlayerHit(amount,type,index,isPositive){
        if(amount<=0||typeof showPlayerHit!=="function"){ return; }
        queueRelicVisual(()=>withSource(SOURCE_RELIC,()=>showPlayerHit(amount,type,index,isPositive)));
    }
    function emitRelicMonsterHit(index,amount,type,isCrit){
        if(amount<=0||typeof showMonsterHit!=="function"){ return; }
        queueRelicVisual(()=>withSource(SOURCE_RELIC,()=>showMonsterHit(index,amount,type,isCrit)));
    }
    function healAlly(index,percent){
        const character=characterAt(index),stats=statsAt(index); if(!character||!stats||numeric(character.hp)<=0||percent<=0){ return 0; }
        const amount=Math.max(1,Math.floor(numeric(stats.maxHP)*percent/100*RELIC_BALANCE_CONFIG.healModifier));
        const actual=Math.max(0,Math.min(amount,numeric(stats.maxHP)-numeric(character.hp))); character.hp+=actual;
        if(actual>0){ emitRelicPlayerHit(actual,"heal",index,true); }
        return actual;
    }
    function showRelicSpFloat(index,amount){
        if(amount<=0){ return; }
        emitRelicPlayerHit(amount,"sp",index,true);
    }
    function restoreSp(index,percent){
        const character=characterAt(index),stats=statsAt(index); if(!character||!stats||numeric(character.hp)<=0||percent<=0){ return 0; }
        const amount=Math.max(1,Math.floor(numeric(stats.maxSP)*percent/100));
        const actual=Math.max(0,Math.min(amount,numeric(stats.maxSP)-numeric(character.sp))); character.sp+=actual;
        if(actual>0){ showRelicSpFloat(index,actual); }
        return actual;
    }
    function cleanseOne(index){
        const character=characterAt(index); if(!character||!Array.isArray(character.statusEffects)){ return false; }
        const i=character.statusEffects.findIndex(state=>state&&state.dispellable!==false&&state.uncleansable!==true&&numeric(state.turnsLeft)>0);
        if(i<0){ return false; } character.statusEffects.splice(i,1); return true;
    }
    function applyShield(index,percent,duration,sourceId){
        const character=characterAt(index),stats=statsAt(index); if(!character||!stats||numeric(character.hp)<=0||percent<=0){ return 0; }
        character.activeBuffs=Array.isArray(character.activeBuffs)?character.activeBuffs:[];
        const amount=Math.max(1,Math.floor(numeric(stats.maxHP)*percent/100*RELIC_BALANCE_CONFIG.shieldModifier));
        const existing=character.activeBuffs.find(buff=>buff&&buff.type==="shield"&&numeric(buff.turnsLeft)>0&&numeric(buff.remaining)>0);
        if(existing){
            if(numeric(existing.remaining)>=amount){ return numeric(existing.remaining); }
            existing.remaining=amount; existing.amount=Math.max(numeric(existing.amount),amount); existing.turnsLeft=Math.max(1,Math.floor(numeric(duration)||1)); existing.v174RelicSource=sourceId;
            return amount;
        }
        character.activeBuffs.push({type:"shield",statusName:"岩盾",remaining:amount,amount:amount,turnsLeft:Math.max(1,Math.floor(numeric(duration)||1)),v174RelicSource:sourceId,sourceType:SOURCE_RELIC});
        return amount;
    }
    function damageEnemy(index,amount,element){
        const monster=typeof monsters!=="undefined"?monsters[index]:null; if(!monster||!monster.alive||amount<=0){ return 0; }
        if(window.GameplaySystem&&typeof window.GameplaySystem.canDirectlyAffectMonster==="function"&&!window.GameplaySystem.canDirectlyAffectMonster(monster,index)){
            return 0;
        }
        const final=Math.max(1,Math.floor(amount*(isBoss(monster)?RELIC_BALANCE_CONFIG.bossDamageModifier:1)));
        monster.hp=Math.max(0,numeric(monster.hp)-final);
        emitRelicMonsterHit(index,final,"hp",false);
        if(monster.hp<=0&&typeof killMonster==="function"){ withSource(SOURCE_RELIC,()=>killMonster(index)); }
        return final;
    }
    function applyEnemyDebuff(monster,attackDown,accuracyDown,duration){
        if(!monster||!monster.alive||!relicBattleState){ return; }
        if(window.GameplaySystem&&typeof window.GameplaySystem.canDirectlyAffectMonster==="function"&&!window.GameplaySystem.canDirectlyAffectMonster(monster)){
            return;
        }
        const efficiency=isBoss(monster)?RELIC_BALANCE_CONFIG.bossDebuffEfficiency:1;
        const attack=Math.max(0,attackDown*efficiency),accuracy=Math.max(0,accuracyDown*efficiency);
        const restore={monster:monster,expiresRound:currentRound()+Math.max(1,Math.floor(duration||1))-1};
        if(attack>0){ restore.attack=monster.attack; restore.magicAttack=monster.magicAttack; monster.attack=numeric(monster.attack)*(1-attack/100); monster.magicAttack=numeric(monster.magicAttack)*(1-attack/100); }
        if(accuracy>0){ restore.accuracy=monster.accuracy; monster.accuracy=numeric(monster.accuracy)*(1-accuracy/100); }
        relicBattleState.monsterRestores.push(restore);
    }
    function applyPlayerBuffAll(effectDef,def,level){
        const duration=effectDef.durationKey?valueFor(def,effectDef.durationKey,level):Math.max(1,numeric(effectDef.durationRounds)||1);
        partyIndexes().forEach(index=>{
            const mod={};
            if(effectDef.attackKey){ mod.attackPercent=valueFor(def,effectDef.attackKey,level); }
            if(effectDef.defenseKey){ mod.defensePercent=valueFor(def,effectDef.defenseKey,level); }
            if(effectDef.evasionKey){ mod.evasionPercent=valueFor(def,effectDef.evasionKey,level); }
            if(effectDef.resistanceKey){ mod.resistancePercent=valueFor(def,effectDef.resistanceKey,level); }
            if(effectDef.damageReductionKey){ mod.damageReductionPercent=valueFor(def,effectDef.damageReductionKey,level); }
            addPlayerMod(index,mod,duration);
        });
    }

    function resolveEffects(triggerDef,def,payload){
        const level=relicLevel(def.id),power=getRelicPower(def.id);
        let prevented=false;
        (triggerDef.effects||[]).forEach(eff=>{
            if(level<Math.max(1,numeric(eff.minLevel)||1)){ return; }
            if(eff.type==="damage_all_enemies"){
                const mult=valueFor(def,eff.multiplierKey,level),bonus=valueFor(def,eff.bonusKey,level);
                (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]).slice().forEach(index=>{
                    const monster=monsters[index]; if(!monster||!monster.alive){ return; }
                    const statusBonus=eff.bonusAgainstStatus&&hasStatus(monster,eff.bonusAgainstStatus)?bonus:0;
                    damageEnemy(index,power*mult*(1+statusBonus)*RELIC_BALANCE_CONFIG.groupDamageModifier,eff.element);
                });
            }else if(eff.type==="heal_all_allies"){
                const p=valueFor(def,eff.percentKey,level); partyIndexes().forEach(index=>healAlly(index,p));
            }else if(eff.type==="heal_single_ally"){
                const p=valueFor(def,eff.percentKey,level); if(payload&&Number.isInteger(payload.targetIndex)){ healAlly(payload.targetIndex,p); }
            }else if(eff.type==="restore_sp_all"){
                const p=valueFor(def,eff.percentKey,level); if(p>0){ partyIndexes().forEach(index=>restoreSp(index,p)); }
            }else if(eff.type==="restore_sp_single"){
                const p=valueFor(def,eff.percentKey,level); if(payload&&Number.isInteger(payload.targetIndex)&&p>0){ restoreSp(payload.targetIndex,p); }
            }else if(eff.type==="shield_all"){
                const p=valueFor(def,eff.percentKey,level); partyIndexes().forEach(index=>applyShield(index,p,eff.durationRounds,def.id));
            }else if(eff.type==="shield_single"){
                const p=valueFor(def,eff.percentKey,level); if(payload&&Number.isInteger(payload.targetIndex)){ applyShield(payload.targetIndex,p,eff.durationRounds,def.id); }
            }else if(eff.type==="buff_all"){
                applyPlayerBuffAll(eff,def,level);
            }else if(eff.type==="debuff_all_enemies"){
                const a=eff.attackDownKey?valueFor(def,eff.attackDownKey,level):0,acc=eff.accuracyDownKey?valueFor(def,eff.accuracyDownKey,level):0;
                (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]).forEach(index=>applyEnemyDebuff(monsters[index],a,acc,eff.durationRounds));
            }else if(eff.type==="cleanse_single"){
                if(payload&&Number.isInteger(payload.targetIndex)){ for(let i=0;i<Math.max(1,numeric(eff.count)||1);i++){ if(!cleanseOne(payload.targetIndex)){ break; } } }
            }else if(eff.type==="apply_status_all_enemies"&&eff.statusId==="burn"){
                const chance=valueFor(def,eff.chanceKey,level);
                (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]).forEach(index=>{
                    const monster=monsters[index]; if(!monster||!monster.alive||Math.random()>=chance){ return; }
                    if(window.GameplaySystem&&typeof window.GameplaySystem.canDirectlyAffectMonster==="function"&&!window.GameplaySystem.canDirectlyAffectMonster(monster,index)){ return; }
                    if(typeof applyBurnEffect==="function"){ withSource(SOURCE_RELIC,()=>applyBurnEffect(monster,eff.durationRounds||2,RELIC_BALANCE_CONFIG.burnPercent)); }
                });
            }else if(eff.type==="prevent_death"){
                if(payload&&Number.isInteger(payload.targetIndex)){ const character=characterAt(payload.targetIndex); if(character){ character.hp=Math.max(1,numeric(character.hp)); prevented=true; payload.prevented=true; } }
            }else if(eff.type==="prepare_reflect"){
                if(relicBattleState){ const mult=valueFor(def,eff.multiplierKey,level); partyIndexes().forEach(index=>{ relicBattleState.reflectReady[String(index)]={multiplier:mult,expiresRound:currentRound()+Math.max(1,numeric(eff.durationRounds)||1)-1}; }); }
            }
        });
        return prevented;
    }

    function performRelicPresentation(def,triggerDef,payload,preResolvedVisuals){
        queueRelicPresentation(def,()=>{
            if(preResolvedVisuals){ flushRelicVisuals(preResolvedVisuals); }
            else{ resolveEffects(triggerDef,def,payload||{}); }
            battleLog(def.name+"｜"+currentEffectText(def,relicLevel(def.id)));
            if(typeof updateUI==="function"){ try{updateUI();}catch(_){ } }
        });
    }

    function dispatchRelicEvent(event,payload){
        if(!relicBattleState||!relicBattleState.relicId){ return false; }
        if(payload&&payload.sourceType===SOURCE_RELIC){ return false; }
        const def=activeBattleRelic(); if(!def||!def.runtimeReady){ return false; }
        if(event==="battle_start"||event==="round_start"||event==="round_end"){
            const boundaryKey=event+":"+String(currentRound());
            if(relicBattleState.boundaryEvents[boundaryKey]){ return false; }
            relicBattleState.boundaryEvents[boundaryKey]=true;
        }
        relicBattleState.lastEvent={event:event,round:currentRound()};
        let triggered=false;
        def.triggers.forEach((triggerDef,index)=>{
            const key=def.id+":"+(triggerDef.id||index);
            if(!canTrigger(triggerDef,key)||!triggerMatches(triggerDef,event,payload,key)){ return; }
            if(triggerDef.type==="ally_hp_below"&&payload){ relicBattleState.lastHpDamageEvent[key]=payload.damageEventId; }
            markTriggered(triggerDef,key);
            if(triggerDef.type==="before_lethal_damage"&&hasLiveBattlePresentationHost()){
                const visuals=[];
                const previousCollector=relicVisualCollector;
                relicVisualCollector=visuals;
                try{ resolveEffects(triggerDef,def,payload||{}); }
                finally{ relicVisualCollector=previousCollector; }
                performRelicPresentation(def,triggerDef,payload||{},visuals);
            }else{
                performRelicPresentation(def,triggerDef,payload||{},null);
            }
            triggered=true;
        });
        return triggered;
    }

    function initializeBattleRelic(){
        relicBattleState=createBattleState(teamLoadout.relicId);
        pendingBattleInit=false;
        if(relicBattleState.relicId){ dispatchRelicEvent("battle_start",{sourceType:"system"}); }
    }

    if(typeof startBattle==="function"){
        const previous=startBattle;
        startBattle=function(){
            resetRelicPresentationQueue();
            relicBattleState=null; pendingBattleInit=true;
            const result=previous.apply(this,arguments);
            if(!battleActive){ pendingBattleInit=false; }
            return result;
        };
    }
    if(typeof startTurn==="function"){
        const previous=startTurn;
        startTurn=function(){
            if(typeof battleActive!=="undefined"&&battleActive){
                if(pendingBattleInit||!relicBattleState||relicBattleState.battleToken!==currentBattleToken()){ initializeBattleRelic(); }
                cleanupPlayerMods();
                resetRoundCounters();
                dispatchRelicEvent("round_start",{sourceType:"system"});
            }
            return previous.apply(this,arguments);
        };
    }
    if(window.FourSymbolsBattleFlow&&typeof window.FourSymbolsBattleFlow.subscribeBeforeCombatant==="function"){
        window.FourSymbolsBattleFlow.subscribeBeforeCombatant(()=>{
            if(
                relicBattleState&&typeof battleActive!=="undefined"&&battleActive&&
                typeof battlePhase!=="undefined"&&battlePhase==="resolve"&&
                typeof initiativeIndex!=="undefined"&&typeof initiativeQueue!=="undefined"&&initiativeIndex>=initiativeQueue.length
            ){
                dispatchRelicEvent("round_end",{sourceType:"system"});
            }
        });
    }

    if(typeof processSingleMonsterAttack==="function"){
        const previous=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const hardControlled=!!(monster&&((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||(typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))));
            const before=partyIndexes().map(index=>{
                const character=characterAt(index);
                const shield=(character&&Array.isArray(character.activeBuffs)?character.activeBuffs:[]).find(buff=>
                    buff&&buff.type==="shield"&&numeric(buff.turnsLeft)>0&&numeric(buff.remaining)>0
                );
                return {index:index,hp:numeric(character&&character.hp),shield:numeric(shield&&shield.remaining)};
            });
            if(relicBattleState){ relicBattleState.currentEnemyIndex=monsterIndex; }
            const result=withSource("enemy",()=>previous.apply(this,arguments));
            const hitTargets=[];
            before.forEach(entry=>{
                const character=characterAt(entry.index);
                const shield=(character&&Array.isArray(character.activeBuffs)?character.activeBuffs:[]).find(buff=>
                    buff&&buff.type==="shield"&&numeric(buff.turnsLeft)>0&&numeric(buff.remaining)>0
                );
                const shieldAfter=numeric(shield&&shield.remaining);
                if(character&&(numeric(character.hp)<entry.hp||shieldAfter<entry.shield)){ hitTargets.push(entry.index); }
            });
            if(relicBattleState){
                relicBattleState.currentEnemyIndex=null;
                if(!hardControlled){ relicBattleState.enemyActionCount++; dispatchRelicEvent("after_enemy_action",{sourceType:"enemy",monsterIndex:monsterIndex}); }
                if(hitTargets.length){ relicBattleState.allyHitCount++; dispatchRelicEvent("after_ally_hit",{sourceType:"enemy",monsterIndex:monsterIndex,targetIndexes:hitTargets}); }
                const reflectedIndex=hitTargets.find(index=>relicBattleState.reflectReady[String(index)]);
                if(reflectedIndex!==undefined&&monster&&monster.alive){
                    const reflect=relicBattleState.reflectReady[String(reflectedIndex)]; delete relicBattleState.reflectReady[String(reflectedIndex)];
                    const def=activeBattleRelic();
                    if(def){
                        queueRelicPresentation(def,()=>{
                            const damage=Math.max(1,Math.floor(getRelicPower(def.id)*numeric(reflect.multiplier)));
                            damageEnemy(monsterIndex,damage,"earth");
                            battleLog(def.name+"反震"+damage+"點秘寶傷害。");
                            if(typeof updateUI==="function"){ try{updateUI();}catch(_){ } }
                        });
                    }
                }
            }
            return result;
        };
    }

    if(typeof showPlayerHit==="function"){
        const previous=showPlayerHit;
        showPlayerHit=function(amount,type,index,isPositive){
            let displayAmount=numeric(amount);
            if(
                relicBattleState&&type==="hp"&&!isPositive&&displayAmount>0&&Number.isInteger(index)&&
                (!sourceContext||sourceContext.sourceType!==SOURCE_RELIC)
            ){
                const character=characterAt(index),stats=statsAt(index);
                if(character&&stats){
                    const reduction=Math.max(0,Math.min(80,playerModTotals(index).damageReductionPercent));
                    if(reduction>0){
                        const refund=Math.min(displayAmount,Math.floor(displayAmount*reduction/100));
                        character.hp=Math.min(numeric(stats.maxHP),numeric(character.hp)+refund); displayAmount=Math.max(0,displayAmount-refund);
                    }
                    relicBattleState.damageEventSerial++;
                    const eventId=relicBattleState.damageEventSerial;
                    const previousHp=Math.min(numeric(stats.maxHP),numeric(character.hp)+displayAmount);
                    const previousHpPercent=previousHp/Math.max(1,numeric(stats.maxHP));
                    if(numeric(character.hp)<=0){
                        dispatchRelicEvent("before_lethal_damage",{sourceType:sourceContext&&sourceContext.sourceType||"unknown",targetIndex:index,damageEventId:eventId,damage:displayAmount});
                    }
                    if(numeric(character.hp)>0){
                        dispatchRelicEvent("ally_hp_below",{sourceType:sourceContext&&sourceContext.sourceType||"unknown",targetIndex:index,damageEventId:eventId,damage:displayAmount,previousHpPercent:previousHpPercent});
                    }else{
                        dispatchRelicEvent("ally_down",{sourceType:sourceContext&&sourceContext.sourceType||"unknown",targetIndex:index,damageEventId:eventId});
                    }
                }
            }
            const args=Array.from(arguments); args[0]=displayAmount; return previous.apply(this,args);
        };
    }

    if(typeof tickStatusEffects==="function"){
        const previous=tickStatusEffects;
        tickStatusEffects=function(){ return withSource("status",()=>previous.apply(this,arguments)); };
    }

    function wrapAllyDebuffApplication(name){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(entity){
            const targetIndex=partyIndexes().find(index=>characterAt(index)===entity);
            const before=targetIndex===undefined?0:(Array.isArray(entity&&entity.statusEffects)?entity.statusEffects.length:0);
            const result=previous.apply(this,arguments);
            if(targetIndex!==undefined&&relicBattleState&&(!sourceContext||sourceContext.sourceType!==SOURCE_RELIC)){
                const after=Array.isArray(entity&&entity.statusEffects)?entity.statusEffects.length:0;
                if(result!==false&&after>before){
                    dispatchRelicEvent("ally_debuffed",{sourceType:sourceContext&&sourceContext.sourceType||"enemy",targetIndex:targetIndex});
                }
            }
            return result;
        };
    }
    ["applyBurnEffect","applyFreezeEffect","applyMonsterDebuff","applyPetrifyEffect","applyStunEffect"].forEach(wrapAllyDebuffApplication);

    if(typeof killMonster==="function"){
        const previous=killMonster;
        killMonster=function(index){
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            const source=sourceContext&&sourceContext.sourceType||"character";
            const wasAlive=!!(monster&&monster.alive!==false);
            const result=previous.apply(this,arguments);
            if(relicBattleState&&wasAlive&&monster&&monster.alive===false){ dispatchRelicEvent("enemy_defeated",{sourceType:source,monsterIndex:index}); }
            return result;
        };
    }

    if(typeof winBattle==="function"){
        const previous=winBattle;
        winBattle=function(){ const result=previous.apply(this,arguments); relicBattleState=null; pendingBattleInit=false; resetRelicPresentationQueue(); return result; };
    }
    if(typeof loseBattle==="function"){
        const previous=loseBattle;
        loseBattle=function(){ const result=previous.apply(this,arguments); relicBattleState=null; pendingBattleInit=false; resetRelicPresentationQueue(); return result; };
    }

    function rarityClass(def){ return "rarity-"+(def&&def.rarity||"white"); }
    function statusOf(id){ return playerRelics[id]||{unlocked:false,level:1,exp:0,seen:false}; }
    function sortedRelics(){
        return RELIC_CATALOG_LIST.slice().sort((a,b)=>{
            const ae=teamLoadout.relicId===a.id?1:0,be=teamLoadout.relicId===b.id?1:0;if(ae!==be){return be-ae;}
            const au=statusOf(a.id).unlocked?1:0,bu=statusOf(b.id).unlocked?1:0;if(au!==bu){return bu-au;}
            const rr=numeric(RARITY_ORDER[b.rarity])-numeric(RARITY_ORDER[a.rarity]);if(rr){return rr;}
            return relicLevel(b.id)-relicLevel(a.id);
        });
    }
    function filterMatch(def){ return currentFilter==="all"||def.category===currentFilter||(def.tags||[]).includes(currentFilter); }
    function nextMilestone(def,level){ const keys=Object.keys(def.nextText||{}).map(Number).sort((a,b)=>a-b); return keys.find(value=>value>level)||null; }
    function currentEffectText(def,level){
        if(!def.runtimeReady){ return def.description; }
        if(def.id==="relic_qiankun_flask"){ return "恢復全隊 "+valueFor(def,"healHpPercent",level).toFixed(1).replace(/\.0$/,"")+"%最大HP"+(level>=10?"，並恢復"+valueFor(def,"spPercent",level).toFixed(1).replace(/\.0$/,"")+"%最大SP":"")+"。"; }
        if(def.id==="relic_sun_orb"){ return "對敵方全體造成 "+valueFor(def,"damageMultiplier",level).toFixed(2)+"×秘寶威力；燃燒目標額外+"+Math.round(valueFor(def,"burnBonus",level)*100)+"%。"; }
        if(def.id==="relic_xuanwu_seal"){ return "全隊獲得最大HP "+valueFor(def,"shieldPercent",level).toFixed(1).replace(/\.0$/,"")+"%護盾，持續2回合"+(level>=20?"，並獲得8%減傷1回合":"")+"。"; }
        if(def.id==="relic_soul_bell"){ return "敵方全體攻擊-"+Math.round(valueFor(def,"attackDown",level))+"%"+(level>=10?"、命中-"+Math.round(valueFor(def,"accuracyDown",level))+"%":"")+"，持續1回合。"; }
        if(def.id==="relic_tiangang_banner"){ return "對敵方全體造成 "+valueFor(def,"damageMultiplier",level).toFixed(2)+"×秘寶威力"+(level>=10?"並降攻"+Math.round(valueFor(def,"attackDown",level))+"%":"")+"。"; }
        if(def.id==="relic_nine_dragon_fire"){ return "對敵方全體造成 "+valueFor(def,"damageMultiplier",level).toFixed(2)+"×火屬性秘寶傷害"+(level>=10?"，燃燒機率"+Math.round(valueFor(def,"burnChance",level)*100)+"%":"")+"。"; }
        if(def.id==="relic_cold_spring_jade"){ return "急救目標 "+valueFor(def,"healHpPercent",level).toFixed(1).replace(/\.0$/,"")+"%最大HP"+(level>=10?"並淨化1個一般負面":"")+(level>=20?"、恢復4%最大SP":"")+"。"; }
        if(def.id==="relic_qinglan_feather"){ return "全隊閃避+"+Math.round(valueFor(def,"evasionBonus",level))+"%、異常抗性+"+Math.round(valueFor(def,"resistanceBonus",level))+"%，持續"+Math.round(valueFor(def,"duration",level))+"回合。"; }
        if(def.id==="relic_rock_mountain_seal"){ return "開場防禦+"+Math.round(valueFor(def,"defenseBonus",level))+"%持續3回合；受擊計數觸發時獲得"+Math.round(valueFor(def,"shieldPercent",level))+"%最大HP護盾。"; }
        if(def.id==="relic_returning_wheel"){ return "阻止本場第一次死亡，保留1HP後恢復"+Math.round(valueFor(def,"healHpPercent",level))+"%最大HP並獲得"+Math.round(valueFor(def,"shieldPercent",level))+"%護盾。"; }
        return def.description;
    }

    function equipmentAllowed(){ return !(typeof battleActive!=="undefined"&&battleActive); }
    function equipRelic(id){
        const def=relicCatalog[id],owned=statusOf(id);
        if(!def||!def.runtimeReady||!owned.unlocked||!equipmentAllowed()){ return false; }
        teamLoadout.relicId=id; owned.seen=true; saveRelics(); syncHomeRelicUi(); renderRelicPage(); return true;
    }
    function unequipRelic(){ if(!equipmentAllowed()){ return false; } teamLoadout.relicId=null; saveRelics(); syncHomeRelicUi(); renderRelicPage(); return true; }
    function upgradeRelic(id){
        const def=relicCatalog[id],owned=statusOf(id); if(!def||!def.runtimeReady||!owned.unlocked||owned.level>=MAX_LEVEL){ return false; }
        const next=owned.level+1,pricing=def.upgradeCost&&def.upgradeCost.goldCost||{};
        const cost=numeric(pricing.base||RELIC_BALANCE_CONFIG.upgradeGoldBase)+numeric(pricing.perLevel||RELIC_BALANCE_CONFIG.upgradeGoldPerLevel)*(next-1);
        if(typeof gold==="undefined"||numeric(gold)<cost){ return false; }
        gold-=cost; owned.level=next; saveRelics(); if(typeof updateGoldDisplay==="function"){updateGoldDisplay();} syncHomeRelicUi(); renderRelicPage(id); return true;
    }

    function relicIconMarkup(def,large){
        if(def.iconPath){ return '<img src="'+esc(def.iconPath)+'" alt="" draggable="false">'; }
        return '<span class="team-relic-placeholder'+(large?' large':'')+'" aria-hidden="true"><i>寶</i><b>'+esc(def.name.slice(0,1))+'</b></span>';
    }
    function cardMarkup(def){
        const owned=statusOf(def.id),equipped=teamLoadout.relicId===def.id;
        return '<button type="button" class="team-relic-card '+rarityClass(def)+(owned.unlocked?' unlocked':' locked')+(equipped?' equipped':'')+'" onclick="v174OpenRelicDetail(\''+esc(def.id)+'\')">'+
            '<span class="team-relic-card-art">'+relicIconMarkup(def,false)+'</span><span class="team-relic-card-name">'+esc(def.name)+'</span>'+
            '<span class="team-relic-card-meta">'+(owned.unlocked?'Lv.'+owned.level:'尚未獲得')+'・'+esc(CATEGORY_LABELS[def.category]||def.category)+'</span>'+
            (equipped?'<em>已裝備</em>':'')+'</button>';
    }
    function renderRelicList(){
        const ownedDef=teamLoadout.relicId&&relicCatalog[teamLoadout.relicId],ownedState=ownedDef&&statusOf(ownedDef.id);
        const current=ownedDef?'<div class="team-relic-current-card"><div class="team-relic-current-art">'+relicIconMarkup(ownedDef,true)+'</div><div class="team-relic-current-copy"><small>目前隊伍秘寶</small><b>'+esc(ownedDef.name)+' <span>Lv.'+ownedState.level+'</span></b><p>'+esc(currentEffectText(ownedDef,ownedState.level))+'</p></div><div class="team-relic-current-actions"><button onclick="v174UnequipRelic()">卸下</button><button onclick="v174OpenRelicDetail(\''+esc(ownedDef.id)+'\')">詳情</button></div></div>':
            '<div class="team-relic-current-card empty"><div class="team-relic-empty-slot">寶</div><div class="team-relic-current-copy"><small>目前隊伍秘寶</small><b>尚未裝備秘寶</b><p>每支隊伍只能啟用一件秘寶。</p></div><button class="team-relic-select-first" onclick="v174SetRelicFilter(\'all\')">選擇秘寶</button></div>';
        const filters=["all","attack","recovery","defense","buff","control","element","special"].map(key=>'<button class="'+(currentFilter===key?'active':'')+'" onclick="v174SetRelicFilter(\''+key+'\')">'+esc(CATEGORY_LABELS[key])+'</button>').join("");
        const cards=sortedRelics().filter(filterMatch).map(cardMarkup).join("");
        return '<div class="team-relic-page"><div class="team-relic-resource-line"><span>隊伍共用戰場神器</span><b>強化：目前僅消耗金幣</b></div>'+current+
            '<div class="team-relic-tabs">'+filters+'</div><div class="team-relic-grid">'+cards+'</div></div>';
    }
    function detailMarkup(def){
        const owned=statusOf(def.id),level=owned.level,next=nextMilestone(def,level),cost=RELIC_BALANCE_CONFIG.upgradeGoldBase+RELIC_BALANCE_CONFIG.upgradeGoldPerLevel*level;
        return '<div class="team-relic-detail"><button class="team-relic-detail-back" onclick="v174OpenRelicPage()">‹ 返回秘寶列表</button><div class="team-relic-detail-hero '+rarityClass(def)+'">'+
            '<div class="team-relic-detail-art">'+relicIconMarkup(def,true)+'</div><h2>'+esc(def.name)+'</h2><p>'+esc(RARITY_LABELS[def.rarity]||def.rarity)+'・Lv.'+level+' / 20</p><strong>'+esc(CATEGORY_LABELS[def.category]||def.category)+(def.tags&&def.tags.length?' / '+esc(def.tags.join('・')):'')+'</strong></div>'+
            '<section><h3>觸發條件</h3><p>'+esc(def.triggerText||"尚未定義")+'</p></section><section><h3>秘寶效果</h3><p>'+esc(currentEffectText(def,level))+'</p></section><section><h3>觸發限制</h3><p>'+esc(def.limitText||"依秘寶設定。")+'</p></section>'+
            '<section><h3>下一強化</h3><p>'+(level>=20?'已達最高等級。':next?'Lv.'+next+'：'+esc(def.nextText[next]):'下一級提升效果數值。')+'</p></section>'+
            '<section class="team-relic-upgrade"><h3>強化</h3><p>目前 Lv.'+level+' → '+(level>=20?'MAX':'Lv.'+(level+1))+'</p><p>素材：第一版尚未啟用正式素材來源；目前只消耗金幣。</p><b>金幣 '+cost.toLocaleString("zh-TW")+'</b></section>'+
            '<div class="team-relic-detail-actions">'+
            (owned.unlocked&&def.runtimeReady&&level<20?'<button onclick="v174UpgradeRelic(\''+esc(def.id)+'\')">強化</button>':'')+
            (owned.unlocked&&def.runtimeReady?'<button onclick="v174EquipRelic(\''+esc(def.id)+'\')">'+(teamLoadout.relicId===def.id?'已裝備':'裝備')+'</button>':'<button disabled>'+(def.runtimeReady?'尚未獲得':'第一版未開放')+'</button>')+
            '</div></div>';
    }

    function modalNodes(){ return {modal:document.getElementById("homeFeatureModal"),body:document.getElementById("homeFeatureModalBody"),title:document.getElementById("homeFeatureModalTitle")}; }
    function prepareRelicModal(){
        const nodes=modalNodes(); if(!nodes.modal||!nodes.body){ return null; }
        /* Opening the relic surface must not close and immediately reopen the shared modal.
           That hide/show cycle caused visible multi-flash when invoked from Gameplay context navigation. */
        if(!nodes.modal.classList.contains("team-relic-modal")){
            nodes.modal.classList.remove("v131-shop-open");
        }
        nodes.modal.classList.add("show","team-relic-modal");
        const box=nodes.modal.querySelector(".home-feature-modal-box"); if(box){ box.classList.add("wide"); }
        if(nodes.title){ nodes.title.textContent="秘 寶"; }
        const close=nodes.modal.querySelector(".home-feature-close-btn"); if(close){ close.setAttribute("aria-label","返回主城"); close.title="返回主城"; }
        return nodes;
    }
    function openRelicPage(){
        currentDetailId=null; Object.values(playerRelics).forEach(state=>{ if(state.unlocked){state.seen=true;} }); saveRelics();
        const nodes=prepareRelicModal(); if(!nodes){ return false; } nodes.modal.classList.remove("team-relic-detail-mode"); nodes.body.innerHTML=renderRelicList(); syncHomeRelicUi(); return true;
    }
    function openRelicDetail(id){ const def=relicCatalog[id]; if(!def){ return false; } currentDetailId=id; const nodes=prepareRelicModal(); if(!nodes){return false;} nodes.modal.classList.add("team-relic-detail-mode"); nodes.body.innerHTML=detailMarkup(def); return true; }
    function renderRelicPage(preferred){ if(!document||!document.getElementById("homeFeatureModal")?.classList.contains("team-relic-modal")){return;} if(preferred||currentDetailId){openRelicDetail(preferred||currentDetailId);}else{openRelicPage();} }

    function syncHomeRelicUi(){
        if(typeof document==="undefined"){ return; }
        const home=document.getElementById("homePage"),grid=home&&home.querySelector(".home-card-grid"); if(!home||!grid){ return; }
        let tools=home.querySelector(".home-utility-actions.team-relic-home-tools");
        if(!tools){
            tools=document.createElement("div"); tools.className="home-utility-actions team-relic-home-tools";
            tools.innerHTML='<button type="button" class="home-card home-card-utility team-relic-home-entry" onclick="openHomeFeature(\'relic\')" aria-label="秘寶"><span class="home-card-icon team-relic-home-glyph">寶</span><span class="home-card-label">秘寶</span></button>'+
                '<button type="button" class="home-card home-card-utility team-element-box-home-entry" onclick="openHomeFeature(\'autoBattleSettings\')" aria-label="元素匣"><span class="home-card-icon"><img src="assets/ui/nav-element-box.png" alt="" draggable="false"></span><span class="home-card-label">元素匣</span></button>';
            grid.appendChild(tools);
        }
        const entry=tools.querySelector(".team-relic-home-entry");
        const needsAttention=!teamLoadout.relicId||Object.values(playerRelics).some(state=>state.unlocked&&!state.seen);
        let dot=entry&&entry.querySelector(".v141-notice-dot.team-relic-notice-dot");
        if(needsAttention&&!dot&&entry){ dot=document.createElement("span"); dot.className="v141-notice-dot team-relic-notice-dot"; dot.setAttribute("aria-hidden","true"); entry.appendChild(dot); }
        if(!needsAttention&&dot){ dot.remove(); }
        const roster=document.getElementById("v146HomeRoster");
        if(roster){
            let slot=roster.querySelector(".team-relic-loadout-slot"); if(!slot){ slot=document.createElement("div"); slot.className="team-relic-loadout-slot"; roster.appendChild(slot); }
            const def=teamLoadout.relicId&&relicCatalog[teamLoadout.relicId];
            slot.innerHTML=def?'<span>隊伍秘寶</span><b>'+esc(def.name)+' Lv.'+relicLevel(def.id)+'</b><small>'+esc(def.triggerText)+'</small><button onclick="openHomeFeature(\'relic\')">更換</button>':
                '<span>隊伍秘寶</span><b>尚未裝備</b><small>每隊僅能裝備1件秘寶</small><button onclick="openHomeFeature(\'relic\')">選擇</button>';
        }
    }

    if(typeof openHomeFeature==="function"){
        const previous=openHomeFeature;
        openHomeFeature=function(type){ if(type==="relic"){ return openRelicPage(); } return previous.apply(this,arguments); };
    }
    if(typeof closeHomeFeature==="function"){
        const previous=closeHomeFeature;
        closeHomeFeature=function(){ const modal=document.getElementById("homeFeatureModal"); if(modal){modal.classList.remove("team-relic-modal"); const box=modal.querySelector(".home-feature-modal-box");if(box){box.classList.remove("wide");}} currentDetailId=null; return previous.apply(this,arguments); };
    }
    if(typeof updateUI==="function"){
        const previous=updateUI; updateUI=function(){ const result=previous.apply(this,arguments); syncHomeRelicUi(); return result; };
    }
    if(typeof showPage==="function"){
        const previous=showPage; showPage=function(page){ const result=previous.apply(this,arguments); if(page==="home"){setTimeout(syncHomeRelicUi,0);} return result; };
    }

    window.v174OpenRelicPage=openRelicPage;
    window.v174OpenRelicDetail=openRelicDetail;
    window.v174SetRelicFilter=function(filter){ currentFilter=CATEGORY_LABELS[filter]?filter:"all"; currentDetailId=null; renderRelicPage(); };
    window.v174EquipRelic=equipRelic;
    window.v174UnequipRelic=unequipRelic;
    window.v174UpgradeRelic=upgradeRelic;
    window.v174RelicDevUnlock=function(id){ if(!relicCatalog[id]){return false;} playerRelics[id].unlocked=true; playerRelics[id].seen=false; saveRelics(); syncHomeRelicUi(); return true; };
    window.v174RelicDebugDispatch=dispatchRelicEvent;
    window.v174RelicDebugState=function(){ return relicBattleState?JSON.parse(JSON.stringify(relicBattleState)):null; };
    window.v174RelicPresentationState=function(){ return {pending:relicPresentationPending,generation:relicPresentationGeneration}; };
    window.v174RelicSystem=Object.freeze({
        catalog:relicCatalog,balance:RELIC_BALANCE_CONFIG,rarityLabels:RARITY_LABELS,categoryLabels:CATEGORY_LABELS,
        getRelicPower:getRelicPower,getOwnedState:()=>playerRelics,getTeamLoadout:()=>teamLoadout,
        dispatch:dispatchRelicEvent
    });

    if(typeof document!=="undefined"){
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>setTimeout(syncHomeRelicUi,0),{once:true}); }
        else{ setTimeout(syncHomeRelicUi,0); }
    }
})();
