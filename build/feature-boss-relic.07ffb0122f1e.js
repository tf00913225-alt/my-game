
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
        try{ const result=ACCOUNT_REPOSITORY.readForUid(ACTIVE_UID); return result.status==="ready"?result.save:null; }catch(_){ return nul