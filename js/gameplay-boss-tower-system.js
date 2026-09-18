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
