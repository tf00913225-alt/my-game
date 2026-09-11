/* =====================================================
   Gameplay Center / BOSS / Four-Symbol Tower Runtime
   - One single-player owner for special-mode navigation and progression.
   - BOSS and Tower battles reuse the existing v132 dungeon battle launcher.
   - Mechanism cards are real attackable sidecar targets, never monsters.
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
    const SUMMON_NAMES=Object.freeze({
        fire:"赤燼戰侍",earth:"玄岩鎮衛",water:"寒淵潮衛",wind:"青冥迅衛"
    });

    const MECHANISM_DEFINITIONS=Object.freeze({
        shield:Object.freeze({type:"shield",kind:"護盾",name:"金剛護體",hpRatio:.18,defenseRatio:.85,priority:100,effect:"存在期間 BOSS 無法被指定或受到新的直接傷害／異常。"}),
        charge:Object.freeze({type:"charge",kind:"蓄力",name:"滅魂陣",hpRatio:.14,defenseRatio:.72,priority:90,countdown:2,effect:"倒數歸零時發動有預告的大型攻擊；破壞可取消。"}),
        heal:Object.freeze({type:"heal",kind:"圖騰",name:"血祭圖騰",hpRatio:.13,defenseRatio:.68,priority:80,healRatio:.04,effect:"存在期間，每回合恢復 BOSS 4% 最大生命。"}),
        amplify:Object.freeze({type:"amplify",kind:"法陣",name:"煞氣法陣",hpRatio:.12,defenseRatio:.72,priority:70,damageMultiplier:1.25,effect:"存在期間，BOSS 造成傷害提高 25%。"}),
        seal:Object.freeze({type:"seal",kind:"封鎖",name:"鎖脈禁制",hpRatio:.12,defenseRatio:.72,priority:60,healingMultiplier:.6,effect:"存在期間，我方治療與 SP 回復效果降低 40%。"})
    });

    const PERSONAL_BOSSES=Object.freeze([
        Object.freeze({id:"personal-20",name:"赤燼狻猊・曜牙",level:20,element:"fire",phases:1,recommendedParty:2,hpMultiplier:7.2,attackMultiplier:1.22,defenseMultiplier:1.28,traits:Object.freeze(["護盾","燃燒","雙人討伐"]),mechanisms:Object.freeze([{round:2,type:"shield"}]),firstReward:"首通金幣 1,200・藍階礦石 ×2",repeatReward:"金幣 260・白階礦石",firstGold:1200,repeatGold:260,ore:"oreLow",firstOre:2}),
        Object.freeze({id:"personal-30",name:"鎮嶽玄甲・磐魁",level:30,element:"earth",phases:1,recommendedParty:2,hpMultiplier:8,attackMultiplier:1.27,defenseMultiplier:1.34,traits:Object.freeze(["蓄力","破防","菁英增援"]),mechanisms:Object.freeze([{round:2,type:"charge"},{round:6,type:"charge"}]),summon:Object.freeze({hpBelow:.5}),firstReward:"首通金幣 1,800・藍階礦石 ×2",repeatReward:"金幣 380・藍階礦石",firstGold:1800,repeatGold:380,ore:"oreMid",firstOre:2}),
        Object.freeze({id:"personal-40",name:"寒淵螭主・霜瀾",level:40,element:"water",phases:2,recommendedParty:2,hpMultiplier:8.8,attackMultiplier:1.32,defenseMultiplier:1.4,traits:Object.freeze(["回復","凍傷","雙人討伐"]),mechanisms:Object.freeze([{round:2,type:"heal"},{hpBelow:.5,type:"charge"}]),firstReward:"首通金幣 2,600・紫階礦石 ×2",repeatReward:"金幣 520・紫階礦石",firstGold:2600,repeatGold:520,ore:"oreHigh",firstOre:2}),
        Object.freeze({id:"personal-50",name:"青冥羽君・嵐翎",level:50,element:"wind",phases:2,recommendedParty:2,hpMultiplier:9.6,attackMultiplier:1.38,defenseMultiplier:1.46,traits:Object.freeze(["閃避","護盾","菁英增援"]),mechanisms:Object.freeze([{round:2,type:"shield"},{hpBelow:.45,type:"heal"}]),summon:Object.freeze({round:4}),firstReward:"首通金幣 3,400・紫階礦石 ×3",repeatReward:"金幣 660・紫階礦石",firstGold:3400,repeatGold:660,ore:"oreHigh",firstOre:3}),
        Object.freeze({id:"personal-60",name:"業火羅剎・燼羅",level:60,element:"fire",phases:3,recommendedParty:3,hpMultiplier:11.8,attackMultiplier:1.44,defenseMultiplier:1.54,traits:Object.freeze(["護盾","蓄力","燃燒"]),mechanisms:Object.freeze([{round:2,type:"shield"},{round:5,type:"charge"},{hpBelow:.35,type:"charge"}]),firstReward:"首通金幣 4,300・橙階礦石 ×2",repeatReward:"金幣 820・紫階礦石",firstGold:4300,repeatGold:820,ore:"orePerfect",firstOre:2}),
        Object.freeze({id:"personal-70",name:"地脈天魁・崩岳",level:70,element:"earth",phases:3,recommendedParty:3,hpMultiplier:12.8,attackMultiplier:1.5,defenseMultiplier:1.62,traits:Object.freeze(["回復","增幅","菁英增援"]),mechanisms:Object.freeze([{round:2,type:"heal"},{round:5,type:"amplify"},{hpBelow:.35,type:"charge"}]),summon:Object.freeze({hpBelow:.55}),firstReward:"首通金幣 5,200・橙階礦石 ×2",repeatReward:"金幣 980・橙階礦石",firstGold:5200,repeatGold:980,ore:"orePerfect",firstOre:2}),
        Object.freeze({id:"personal-80",name:"玄潮龍侯・滄溟",level:80,element:"water",phases:3,recommendedParty:3,hpMultiplier:13.8,attackMultiplier:1.56,defenseMultiplier:1.7,traits:Object.freeze(["護盾","蓄力","回復"]),mechanisms:Object.freeze([{round:2,type:"shield"},{round:5,type:"charge"},{hpBelow:.4,type:"heal"}]),firstReward:"首通回天寶輪・金幣 6,200",repeatReward:"金幣 1,160・橙階礦石",firstGold:6200,repeatGold:1160,ore:"orePerfect",firstOre:1,relic:"relic_returning_wheel"}),
        Object.freeze({id:"personal-90",name:"九霄風煞・天翳",level:90,element:"wind",phases:4,recommendedParty:3,hpMultiplier:14.8,attackMultiplier:1.62,defenseMultiplier:1.78,traits:Object.freeze(["封鎖","護盾","菁英增援"]),mechanisms:Object.freeze([{round:2,type:"seal"},{round:4,type:"shield"},{round:7,type:"charge"},{hpBelow:.3,type:"amplify"}]),summon:Object.freeze({round:4}),firstReward:"首通金幣 7,500・橙階礦石 ×3",repeatReward:"金幣 1,360・橙階礦石",firstGold:7500,repeatGold:1360,ore:"orePerfect",firstOre:3}),
        Object.freeze({id:"personal-100",name:"太初焚世尊・赤曜",level:100,element:"fire",phases:4,recommendedParty:3,hpMultiplier:16,attackMultiplier:1.68,defenseMultiplier:1.86,traits:Object.freeze(["護盾","蓄力","回復","菁英增援"]),mechanisms:Object.freeze([{round:2,type:"shield"},{round:4,type:"charge"},{round:7,type:"heal"},{hpBelow:.3,type:"seal"}]),summon:Object.freeze({hpBelow:.6}),firstReward:"首通金幣 10,000・橙階礦石 ×4",repeatReward:"金幣 1,600・橙階礦石",firstGold:10000,repeatGold:1600,ore:"orePerfect",firstOre:4})
    ]);

    const WORLD_STAGE_PROFILES=Object.freeze([
        Object.freeze({number:1,label:"第一階段",hpFactor:.78,attackFactor:.92,defenseFactor:.94,mechanisms:Object.freeze([{round:3,type:"charge"}]),summon:null,summary:"試探攻勢與一次蓄力。"}),
        Object.freeze({number:2,label:"第二階段",hpFactor:.88,attackFactor:1,defenseFactor:1,mechanisms:Object.freeze([{round:2,type:"shield"}]),summon:null,summary:"以護盾改變攻擊優先順序。"}),
        Object.freeze({number:3,label:"第三階段",hpFactor:.96,attackFactor:1.06,defenseFactor:1.06,mechanisms:Object.freeze([{round:2,type:"heal"},{round:5,type:"amplify"}]),summon:Object.freeze({hpBelow:.55}),summary:"回復與法陣形成持久壓力，半血後呼叫兩名同元素菁英。"}),
        Object.freeze({number:4,label:"最終階段",hpFactor:1,attackFactor:1.12,defenseFactor:1.12,mechanisms:Object.freeze([{round:2,type:"charge"},{round:4,type:"amplify"},{round:7,type:"shield"}]),summon:Object.freeze({round:4}),summary:"狂暴、蓄力與護體交替，第 4 回合呼叫兩名同元素菁英。"})
    ]);

    const WORLD_BOSSES=Object.freeze([
        Object.freeze({id:"world-40",name:"萬壑鎮世神・玄岳",level:40,element:"earth",recommendedParty:2,hpMultiplier:10.2,attackMultiplier:1.38,defenseMultiplier:1.5,traits:Object.freeze(["四階段","護盾","蓄力","菁英增援"]),firstReward:"特殊首通：回天寶輪・金幣 6,000",repeatReward:"最終階段再戰：金幣 700",firstGold:6000,repeatGold:700,relic:"relic_returning_wheel"}),
        Object.freeze({id:"world-60",name:"北溟凍海尊・玄漪",level:60,element:"water",recommendedParty:3,hpMultiplier:13.2,attackMultiplier:1.48,defenseMultiplier:1.6,traits:Object.freeze(["四階段","回復","凍傷","菁英增援"]),firstReward:"特殊首通：橙階礦石 ×4・金幣 9,000",repeatReward:"最終階段再戰：金幣 1,000",firstGold:9000,repeatGold:1000,ore:"orePerfect",firstOre:4}),
        Object.freeze({id:"world-80",name:"九天裂空尊・蒼劫",level:80,element:"wind",recommendedParty:3,hpMultiplier:15.5,attackMultiplier:1.6,defenseMultiplier:1.74,traits:Object.freeze(["四階段","增幅","暈眩","菁英增援"]),firstReward:"特殊首通：橙階礦石 ×6・金幣 13,000",repeatReward:"最終階段再戰：金幣 1,400",firstGold:13000,repeatGold:1400,ore:"orePerfect",firstOre:6}),
        Object.freeze({id:"world-100",name:"劫火滅世尊・無燼",level:100,element:"fire",recommendedParty:3,hpMultiplier:18,attackMultiplier:1.72,defenseMultiplier:1.9,traits:Object.freeze(["四階段","封鎖","護盾","菁英增援"]),firstReward:"特殊首通：橙階礦石 ×8・金幣 20,000",repeatReward:"最終階段再戰：金幣 2,000",firstGold:20000,repeatGold:2000,ore:"orePerfect",firstOre:8})
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
    let mechanismSerial=0;
    let actionShieldSnapshot=false;
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
            const cleared=progress.firstClear;
            const status=!unlocked?"Lv"+definition.level+" 解鎖":type==="world"?(progress.firstClear?"已討伐":"討伐進度 "+progress.completedStages+" / 4"):(progress.firstClear?"可重複挑戰":"首通待完成");
            return '<button type="button" class="boss-select-card '+(!unlocked?'locked ':'')+(cleared?'cleared':'')+'" '+(!unlocked?'disabled aria-disabled="true"':'onclick="vGameplayOpenBossDetail(\''+type+'\',\''+definition.id+'\')"')+'><span>Lv.'+definition.level+'・'+escapeHtml(elementLabel(definition.element))+'元素</span><b>'+escapeHtml(definition.name)+'</b><small>'+escapeHtml(status)+'</small></button>';
        }).join("");
        const summary=type==="world"?"永久單人災厄討伐・階段進度獨立保存":"不限次數・依同級隊伍校準・首通獎勵僅一次";
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
        const stage=type==="world"?(progress.firstClear?4:Math.min(4,progress.completedStages+1)):null;
        const mechanismText=type==="world"?WORLD_STAGE_PROFILES[stage-1].summary:definition.traits.join("・");
        const recommended=Math.max(1,Math.floor(numeric(definition.recommendedParty,definition.level>=60?3:2)));
        return '<div class="boss-detail"><button type="button" class="boss-detail-back" onclick="vGameplayCloseBossDetail()">‹ 返回 BOSS 列表</button>'+
            '<section class="boss-hero"><small>'+(type==="world"?'世界觀災厄級・永久單人攻略':'個人挑戰・固定等級')+'</small><h3>'+escapeHtml(definition.name)+'</h3><p>Lv.'+definition.level+'・'+escapeHtml(elementLabel(definition.element))+'元素・建議 '+recommended+' 名 Lv.'+definition.level+' 角色</p><div class="boss-trait-tags">'+definition.traits.map(item=>'<span>'+escapeHtml(item)+'</span>').join("")+'</div></section>'+
            (type==="world"?worldStageTrack(progress):'')+
            '<div class="boss-detail-grid"><section><h4>戰鬥特性</h4><p>'+escapeHtml(type==="world"?'四個永久攻略階段；失敗只重打目前階段，後兩階段可能召來同元素菁英。':definition.phases+' 個戰鬥階段；強度依同級 '+recommended+' 人隊伍校準，可不限次數挑戰。')+'</p></section><section><h4>機制簡介</h4><p>'+escapeHtml(mechanismText)+'</p></section><section><h4>首次擊敗獎勵</h4><p>'+escapeHtml(definition.firstReward)+'・'+(progress.firstClear?'已領取':'尚未領取')+'</p></section><section><h4>重複掉落</h4><p>'+escapeHtml(definition.repeatReward)+'</p></section></div>'+
            '<button type="button" class="gameplay-primary-action" onclick="vGameplayStartBoss(\''+type+'\',\''+definition.id+'\')">'+(type==="world"?'挑戰'+WORLD_STAGE_PROFILES[stage-1].label:'開始挑戰')+'</button></div>';
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
    function skillMatchesElement(skillId,element){
        const database=typeof skillDatabase!=="undefined"?skillDatabase:(window.skillDatabase||{});
        const skill=database&&database[skillId];
        return !skill||!skill.element||skill.element===element;
    }
    function sameElementSkills(ids,element){
        return (ids||[]).filter(skillId=>{
            const matches=skillMatchesElement(skillId,element);
            if(!matches&&window.console&&typeof window.console.warn==="function"){
                window.console.warn("Gameplay BOSS blocked cross-element skill",skillId,"for",element);
            }
            return matches;
        });
    }
    function configureBossSkills(monster,element,stage){
        const style=ELEMENTS[element]||ELEMENTS.fire;
        const sameElementActives=sameElementSkills(style.skills,element);
        const sameElementSupports=sameElementSkills(style.supports,element);
        monster.skillIds=sameElementActives.slice(Math.max(0,3-Math.max(1,stage||1)));
        monster.v141SupportSkillIds=(stage||1)>=3?sameElementSupports.slice():[];
        monster.v132FixedSkillLoadout=true;
        monster.v141ForceSkillLevel=clamp(Math.ceil(numeric(monster.level,1)/25),1,5);
        monster.v141SkillLevel=monster.v141ForceSkillLevel;
        monster.skillChance=clamp(.48+(stage||1)*.08,.48,.82);
        if(monster.v141SupportSkillIds.length){ monster.v141AbyssAi="support"; }
    }
    function buildBossMonster(definition,options){
        const profile=options||{};
        const monster=buildBaseMonster(definition.name,definition.level,definition.element,"elite");
        const hpMultiplier=definition.hpMultiplier*numeric(profile.hpFactor,1);
        const attackMultiplier=definition.attackMultiplier*numeric(profile.attackFactor,1);
        const defenseMultiplier=numeric(definition.defenseMultiplier,1)*numeric(profile.defenseFactor,1);
        monster.maxHP=Math.max(1,Math.round(numeric(monster.maxHP,1)*hpMultiplier));
        monster.hp=monster.maxHP;
        monster.attack=Math.max(1,Math.round(numeric(monster.attack,1)*attackMultiplier));
        monster.magicAttack=Math.max(1,Math.round(numeric(monster.magicAttack,monster.attack)*attackMultiplier));
        monster.defense=Math.max(0,Math.round(numeric(monster.defense,0)*defenseMultiplier));
        monster.rank="boss";
        monster.unitKind="boss";
        monster.vGameplayBoss=true;
        monster.vGameplayBossId=definition.id;
        monster.vGameplayStage=numeric(profile.stage,1);
        configureBossSkills(monster,definition.element,monster.vGameplayStage);
        return monster;
    }
    function towerBossName(element,floor){
        const map={fire:"赤霄焚關使",earth:"玄岳鎮關使",water:"滄溟寒關使",wind:"青冥裂關使"};
        return (map[element]||"四象鎮關使")+"・第"+floor+"重";
    }
    function towerMonsterLevel(floor){ return clamp(Math.round(29+floor*.71),30,100); }
    function towerMechanismPlan(floor){
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
            const definition={
                id:"tower-"+floor,name:towerBossName(element,floor),level:level,element:element,
                hpMultiplier:clamp(5.4+floor*.065,6,11.9),
                attackMultiplier:clamp(1.14+floor*.0044,1.18,1.58),
                defenseMultiplier:clamp(1.18+floor*.0052,1.24,1.7)
            };
            return [buildBossMonster(definition,{stage:1})];
        }
        const elite=floor%5===0,count=elite?2:Math.min(4,2+Math.floor(floor/35));
        return Array.from({length:count},()=>{
            const monster=buildBaseMonster("天兵天將",level,element,elite?"elite":"regular");
            monster.vGameplayTower=true;monster.vGameplayTowerFloor=floor;
            configureBossSkills(monster,element,Math.ceil(floor/30));
            if(element==="fire"){ monster.skillChance=Math.min(.82,monster.skillChance+.08);monster.critChance=numeric(monster.critChance,5)+8; }
            if(element==="water"){ monster.v141SupportSkillIds=sameElementSkills(ELEMENTS.water.supports,"water");monster.v141AbyssAi="support"; }
            if(element==="wind"){ monster.evasion=numeric(monster.evasion,0)+8;monster.agility=numeric(monster.agility,1)*1.12; }
            if(element==="earth"){ monster.defense=Math.round(numeric(monster.defense,1)*1.18);monster.maxHP=Math.round(numeric(monster.maxHP,1)*1.12);monster.hp=monster.maxHP; }
            return monster;
        });
    }

    function activeBoss(){
        return activeBattleContext&&activeBattleContext.boss&&activeBattleContext.boss.alive!==false?activeBattleContext.boss:null;
    }
    function aliveMechanisms(){
        return activeBattleContext?(activeBattleContext.mechanisms||[]).filter(card=>card&&card.hp>0&&!card.destroyed):[];
    }
    function blockingShield(){ return aliveMechanisms().find(card=>card.type==="shield")||null; }
    function canDirectlyAffectMonster(monster){
        const boss=activeBoss();
        return !(boss&&monster===boss&&(actionShieldSnapshot||blockingShield()));
    }
    function mechanismEffectText(card){
        if(card.type==="charge"){ return "倒數 "+card.countdown+" 回合・歸零發動大型技能"; }
        return card.effect;
    }
    function mechanismInfoMarkup(card){
        return '<article class="boss-mechanism-info-card" data-type="'+escapeHtml(card.type)+'">'+
            '<b class="boss-mechanism-info-name">'+escapeHtml(card.name)+'</b>'+
            '<span class="boss-mechanism-info-kind">'+escapeHtml(card.kind)+'</span>'+
            '<span class="boss-mechanism-info-hp">HP '+Math.max(0,Math.ceil(card.hp))+' / '+card.maxHP+'</span>'+
            '<p class="boss-mechanism-info-effect">'+escapeHtml(mechanismEffectText(card))+'</p></article>';
    }
    function ensureMechanismInfoUI(){
        const page=document.getElementById("battlePage");
        if(!page){ return null; }
        let host=document.getElementById("bossMechanismInfoHost");
        if(!host){
            host=document.createElement("div");
            host.id="bossMechanismInfoHost";
            host.className="boss-mechanism-info-host";
            host.innerHTML='<button type="button" class="boss-mechanism-info-alert" aria-label="查看 BOSS 機制說明" aria-expanded="false">!</button>'+
                '<section class="boss-mechanism-info-panel" aria-label="BOSS 機制說明">'+
                '<button type="button" class="boss-mechanism-info-back">‹ 返回</button>'+
                '<div class="boss-mechanism-info-body"></div></section>';
            page.appendChild(host);
            host.querySelector(".boss-mechanism-info-alert").onclick=openMechanismInfoPanel;
            host.querySelector(".boss-mechanism-info-back").onclick=closeMechanismInfoPanel;
        }
        return {
            host:host,
            alert:host.querySelector(".boss-mechanism-info-alert"),
            panel:host.querySelector(".boss-mechanism-info-panel"),
            body:host.querySelector(".boss-mechanism-info-body")
        };
    }
    function openMechanismInfoPanel(){
        const ui=ensureMechanismInfoUI(),alive=aliveMechanisms();
        if(!ui||!alive.length){ return false; }
        ui.host.classList.add("open");
        ui.alert.setAttribute("aria-expanded","true");
        ui.body.innerHTML=alive.map(mechanismInfoMarkup).join("");
        return true;
    }
    function closeMechanismInfoPanel(){
        const host=document.getElementById("bossMechanismInfoHost");
        if(!host){ return false; }
        host.classList.remove("open");
        const alert=host.querySelector(".boss-mechanism-info-alert");
        if(alert){ alert.setAttribute("aria-expanded","false"); }
        return true;
    }
    function syncMechanismInfoUI(alive){
        const ui=ensureMechanismInfoUI();
        if(!ui){ return; }
        const hasMechanism=alive.length>0;
        ui.host.classList.toggle("has-mechanism",hasMechanism);
        if(!hasMechanism){
            ui.host.classList.remove("open");
            ui.alert.setAttribute("aria-expanded","false");
            ui.body.innerHTML="";
            return;
        }
        if(ui.host.classList.contains("open")){ ui.body.innerHTML=alive.map(mechanismInfoMarkup).join(""); }
    }
    function cleanupMechanismPresentation(){
        const area=document.getElementById("battleMonsterArea");
        if(area){
            area.classList.remove("gameplay-boss-active");
            area.querySelectorAll(".battle-monster.gameplay-boss-card").forEach(node=>node.classList.remove("gameplay-boss-card","gameplay-boss-protected"));
            const slot=area.querySelector("#bossMechanismSlot");
            if(slot){ slot.remove(); }
        }
        const host=document.getElementById("bossMechanismInfoHost");
        if(host){ host.remove(); }
    }
    function renderMechanisms(){
        const area=document.getElementById("battleMonsterArea");
        if(!area){ return; }
        let slot=document.getElementById("bossMechanismSlot");
        if(!slot){ slot=document.createElement("div");slot.id="bossMechanismSlot";slot.className="boss-mechanism-slot";slot.setAttribute("aria-label","BOSS 機制卡槽");area.appendChild(slot); }
        const alive=aliveMechanisms();
        slot.classList.toggle("active",alive.length>0);
        Array.from(slot.querySelectorAll(".boss-mechanism-card")).forEach(node=>{
            if(!alive.some(card=>card.id===node.dataset.id)&&!node.classList.contains("destroying")){ node.remove(); }
        });
        alive.forEach(card=>{
            let node=slot.querySelector('[data-id="'+card.id+'"]');
            if(!node){
                node=document.createElement("button");node.type="button";node.className="boss-mechanism-card";node.dataset.id=card.id;node.dataset.type=card.type;
                node.onclick=function(){ selectMechanism(card.id); };slot.appendChild(node);
            }
            node.classList.toggle("targetable",!!(typeof actionReady!=="undefined"&&actionReady&&typeof pendingAction!=="undefined"&&pendingAction));
            node.setAttribute("aria-label",card.name+"，"+card.kind+"，HP "+Math.max(0,Math.ceil(card.hp))+" / "+card.maxHP+"，點擊可作為攻擊目標");
            node.innerHTML='<b class="boss-mechanism-name">'+escapeHtml(card.name)+'</b><span class="boss-mechanism-kind">'+escapeHtml(card.kind)+'</span><span class="boss-mechanism-hp">HP '+Math.max(0,Math.ceil(card.hp))+' / '+card.maxHP+'</span>';
        });
        const boss=activeBoss(),bossIndex=boss&&typeof monsters!=="undefined"?monsters.indexOf(boss):-1;
        const bossCard=bossIndex>=0?document.getElementById("battleMonster"+bossIndex):null;
        area.querySelectorAll(".battle-monster.gameplay-boss-card").forEach(node=>{ if(node!==bossCard){ node.classList.remove("gameplay-boss-card","gameplay-boss-protected"); } });
        area.classList.toggle("gameplay-boss-active",!!bossCard);
        if(bossCard){
            bossCard.classList.add("gameplay-boss-card");
            bossCard.classList.toggle("gameplay-boss-protected",!!blockingShield());
            bossCard.setAttribute("aria-disabled",blockingShield()?"true":"false");
        }
        syncMechanismInfoUI(alive);
    }
    function showMechanismToast(message){
        const page=document.getElementById("battlePage");if(!page){ return; }
        const previous=page.querySelector(".boss-mechanism-toast");if(previous){ previous.remove(); }
        const toast=document.createElement("div");toast.className="boss-mechanism-toast";toast.textContent=message;page.appendChild(toast);
        setTimeout(()=>{ if(toast.parentNode){ toast.remove(); } },950);
    }
    function pulseMechanism(card){
        const node=document.querySelector('#bossMechanismSlot [data-id="'+card.id+'"]');
        if(!node){ return; }node.classList.remove("blocked-pulse");void node.offsetWidth;node.classList.add("blocked-pulse");
    }
    function reportProtectedBoss(){
        const shield=blockingShield();if(!shield){ return; }showMechanismToast("護盾尚未破除");pulseMechanism(shield);
        if(typeof addBattleLog==="function"){ addBattleLog("護盾尚未破除，必須先擊破【"+shield.name+"】。"); }
    }
    function spawnMechanism(type,sourceKey){
        const definition=MECHANISM_DEFINITIONS[type],boss=activeBoss(),context=activeBattleContext;
        if(!definition||!boss||!context){ return null; }
        const maximum=context.maxMechanisms||1;
        if(aliveMechanisms().length>=maximum){ return null; }
        const card={
            id:"mechanism-"+(++mechanismSerial),sourceKey:sourceKey||"manual-"+mechanismSerial,
            type:definition.type,unitKind:"mechanism",rank:"mechanism",kind:definition.kind,name:definition.name,
            maxHP:Math.max(1,Math.round(boss.maxHP*definition.hpRatio)),hp:0,defense:Math.max(0,Math.round(numeric(boss.defense,0)*numeric(definition.defenseRatio,.72))),
            level:boss.level,element:boss.element,effect:definition.effect,priority:definition.priority,
            countdown:definition.countdown||null,spawnedRound:typeof turn!=="undefined"?turn:1,destroyed:false
        };
        card.hp=card.maxHP;context.mechanisms.push(card);
        if(typeof addBattleLog==="function"){ addBattleLog(boss.name+"展開機制卡【"+card.name+"】！"); }
        renderMechanisms();return card;
    }
    function destroyMechanism(card,reason){
        if(!card||card.destroyed){ return; }card.hp=0;card.destroyed=true;
        const node=document.querySelector('#bossMechanismSlot [data-id="'+card.id+'"]');if(node){ node.classList.remove("targetable","target");node.classList.add("destroying"); }
        if(typeof addBattleLog==="function"){
            addBattleLog("【"+card.name+"】已被破壞。"+(card.type==="charge"&&reason!=="resolved"?"大型技能已取消。":""));
        }
        setTimeout(()=>{ if(activeBattleContext){ activeBattleContext.mechanisms=activeBattleContext.mechanisms.filter(item=>item!==card);renderMechanisms(); } },290);
    }
    function damageMechanism(card,damage,sourceName){
        if(!card||card.destroyed||card.hp<=0){ return 0; }
        const final=Math.max(1,Math.round(numeric(damage,1)));card.hp=Math.max(0,card.hp-final);
        if(typeof addBattleLog==="function"){ addBattleLog((sourceName||"攻擊")+"命中【"+card.name+"】，造成"+final+"傷害。"); }
        if(card.hp<=0){ destroyMechanism(card,"destroyed"); }else{ renderMechanisms(); }
        return final;
    }
    function buildBossSummon(element,level,index,stage){
        const suffix=index===0?"・甲":"・乙";
        const monster=buildBaseMonster((SUMMON_NAMES[element]||"四象戰侍")+suffix,level,element,"elite");
        monster.maxHP=Math.max(1,Math.round(numeric(monster.maxHP,1)*.78));
        monster.hp=monster.maxHP;
        monster.attack=Math.max(1,Math.round(numeric(monster.attack,1)*.9));
        monster.magicAttack=Math.max(1,Math.round(numeric(monster.magicAttack,monster.attack)*.9));
        monster.defense=Math.max(0,Math.round(numeric(monster.defense,0)*.95));
        monster.vGameplayBossSummon=true;
        monster.vGameplayBossId=activeBattleContext&&activeBattleContext.definitionId||null;
        configureBossSkills(monster,element,Math.max(1,Math.min(3,stage||1)));
        return monster;
    }
    function summonBossElites(){
        const context=activeBattleContext,boss=activeBoss();
        if(!context||!boss||context.summonsCreated||typeof monsters==="undefined"||!Array.isArray(monsters)||typeof currentBattleMonsters==="undefined"||!Array.isArray(currentBattleMonsters)){ return false; }
        const stage=Math.max(numeric(context.combatPhase,1),numeric(context.stage,1));
        const guards=[buildBossSummon(boss.element,boss.level,0,stage),buildBossSummon(boss.element,boss.level,1,stage)];
        guards.forEach(guard=>{
            const index=monsters.length;
            monsters.push(guard);
            currentBattleMonsters.push(index);
        });
        context.summonsCreated=true;
        if(typeof addBattleLog==="function"){ addBattleLog(boss.name+"召來兩名同元素菁英護衛助戰！"); }
        if(typeof renderBattle==="function"){ renderBattle(); }
        else if(typeof updateUI==="function"){ updateUI(); }
        return true;
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
        return [0,1,2].filter(index=>typeof getPartyCharacterByIndex==="function"&&getPartyCharacterByIndex(index));
    }
    function applyTelegraphedMajor(){
        const boss=activeBoss();if(!boss){ return; }
        if(typeof addBattleLog==="function"){ addBattleLog(boss.name+"完成【滅魂陣】，大型攻勢爆發！"); }
        partyIndexes().forEach(index=>{
            const character=getPartyCharacterByIndex(index),stats=getPartyBattleStats(index);if(!character||!stats||character.hp<=0){ return; }
            let damage=Math.max(1,Math.round(stats.maxHP*.42));
            if(character.isDefending){ damage=Math.max(1,Math.floor(damage*.5)); }
            const shield=(character.activeBuffs||[]).find(buff=>buff&&buff.type==="shield"&&numeric(buff.turnsLeft)>0&&numeric(buff.remaining)>0);
            if(shield){ const absorbed=Math.min(damage,numeric(shield.remaining));shield.remaining-=absorbed;damage-=absorbed; }
            if(damage>0){ character.hp=Math.max(0,character.hp-damage);if(typeof showPlayerHit==="function"){ showPlayerHit(damage,"hp",index,false); } }
        });
        if(typeof updateUI==="function"){ updateUI(); }
    }
    function processMechanismRound(){
        if(!activeBattleContext){ return false; }
        const round=typeof turn!=="undefined"?turn:1,boss=activeBoss();if(!boss){ return false; }
        updateBossCombatPhase();
        processBossSummonPlan(round,boss);
        aliveMechanisms().slice().forEach(card=>{
            if(card.spawnedRound>=round){ return; }
            if(card.type==="charge"){
                card.countdown=Math.max(0,numeric(card.countdown,0)-1);
                if(card.countdown<=0){ applyTelegraphedMajor();destroyMechanism(card,"resolved"); }
            }else if(card.type==="heal"){
                const amount=Math.max(1,Math.round(boss.maxHP*MECHANISM_DEFINITIONS.heal.healRatio));
                const actual=Math.max(0,Math.min(amount,boss.maxHP-boss.hp));boss.hp+=actual;
                if(actual>0&&typeof addBattleLog==="function"){ addBattleLog("【"+card.name+"】使"+boss.name+"恢復"+actual+"點生命。"); }
            }
        });
        if(typeof checkBattleEnd==="function"&&checkBattleEnd()){ return true; }
        const plans=activeBattleContext.mechanismPlan||[];
        plans.forEach((plan,index)=>{
            const key="plan-"+index;if(activeBattleContext.spawnedPlans[key]){ return; }
            const roundReady=plan.round!==undefined&&round>=plan.round;
            const hpReady=plan.hpBelow!==undefined&&boss.hp/Math.max(1,boss.maxHP)<=plan.hpBelow;
            if(roundReady||hpReady){
                const created=spawnMechanism(plan.type,key);
                if(created){ activeBattleContext.spawnedPlans[key]=true; }
            }
        });
        renderMechanisms();return false;
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
    function prioritizedMechanism(){
        return aliveMechanisms().slice().sort((a,b)=>numeric(b.priority)-numeric(a.priority))[0]||null;
    }
    function mechanismByTarget(target){
        const id=typeof target==="string"&&target.indexOf("mechanism:")===0?target.slice(10):String(target||"");
        return aliveMechanisms().find(card=>card.id===id)||null;
    }
    function selectMechanism(id){
        const card=aliveMechanisms().find(item=>item.id===id);
        if(!card||typeof battleActive==="undefined"||!battleActive||typeof battlePhase!=="undefined"&&battlePhase!=="declare"||typeof actionReady==="undefined"||!actionReady||typeof pendingAction==="undefined"||!pendingAction){ return false; }
        document.querySelectorAll(".boss-mechanism-card.target").forEach(node=>node.classList.remove("target"));
        const node=document.querySelector('#bossMechanismSlot [data-id="'+card.id+'"]');if(node){ node.classList.add("target"); }
        const targetText=document.getElementById("battleTarget");if(targetText){ targetText.textContent="目標："+card.name; }
        const action=pendingAction;actionReady=false;pendingAction=null;
        if(typeof clearBattleTargetSelectionMode==="function"){ clearBattleTargetSelectionMode(); }
        queuedPlayerActions[activeBattleCharacterIndex]={action:action,target:"mechanism:"+card.id};
        if(typeof updateUI==="function"){ updateUI(); }if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }return true;
    }
    function calculateMechanismActionDamage(characterIndex,action,card){
        const character=getPartyCharacterByIndex(characterIndex),stats=getPartyBattleStats(characterIndex);if(!character||!stats){ return {damage:1,name:"攻擊",crit:false}; }
        if(action==="normal"){
            const crit=typeof rollCritical==="function"?rollCritical(character,"physical",0):{multiplier:1,isCrit:false};
            return {damage:calculateDamage(stats.attack,card.defense,character.level,card.level,character.element,card.element,{attacker:character,target:card,critMultiplier:crit.multiplier}),name:"普通攻擊",crit:crit.isCrit};
        }
        const skill=skillDatabase[action];if(!skill||!skill.baseDamage){ return {damage:0,name:skill&&skill.name||action,crit:false}; }
        const key=typeof getPartyCharacterKey==="function"?getPartyCharacterKey(characterIndex):(character.element||"fire");
        const level=Math.max(1,numeric(getSkillLevel(key,action),1));
        const stat=skill.category==="magic"?stats.magicAttack:stats.attack;
        const crit=typeof rollCritical==="function"?rollCritical(character,skill.category,0):{multiplier:1,isCrit:false};
        return {damage:calculateSkillDamage({skill:skill,skillLevel:level,effectiveAttack:stat,target:card,casterLevel:character.level,casterElement:character.element,attacker:character,critMultiplier:crit.multiplier}),name:skill.name,crit:crit.isCrit};
    }
    function resolveMechanismAction(characterIndex,queued,previous,that,args){
        const card=mechanismByTarget(queued.target);
        if(!card){ queued.target=typeof monsters!=="undefined"?monsters.findIndex(monster=>monster&&monster.alive):-1;return previous.apply(that,args); }
        const skill=queued.action!=="normal"?skillDatabase[queued.action]:null;
        const character=getPartyCharacterByIndex(characterIndex);
        const spreads=skill&&["tri","row","column","all"].includes(skill.targetType);
        if(skill){
            const cost=skill.spCost!==undefined?skill.spCost:(skill.cost||0);
            if(!spreads){
                if(!character||character.sp<cost){ if(typeof addBattleLog==="function"){ addBattleLog("SP不足，無法攻擊機制卡。"); }finishPlayerAction();return; }
                character.sp-=cost;if(typeof showSkillNameBadge==="function"){ showSkillNameBadge(skill.name,skill.element,characterIndex); }
            }
        }
        const result=calculateMechanismActionDamage(characterIndex,queued.action,card);
        if(result.damage>0){ damageMechanism(card,result.damage,(character&&character.id?character.id+"的":"")+result.name); }
        else if(typeof addBattleLog==="function"){ addBattleLog(result.name+"無法直接破壞機制卡。需要使用傷害技能。"); }
        if(spreads){
            const fallback=currentBattleMonsters.find(index=>monsters[index]&&monsters[index].alive);
            queued.target=fallback===undefined?null:fallback;
            return previous.apply(that,args);
        }
        if(typeof updateUI==="function"){ updateUI(); }finishPlayerAction();
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
        cleanupMechanismPresentation();activeBattleContext=null;bossDetail={type:"personal",id:definition.id};if(typeof showPage==="function"){ showPage("boss"); }renderBossPage();
    }
    function completeWorldStage(definition,stage,outcome){
        const progress=state.world[definition.id];
        if(outcome&&outcome.result==="win"){
            if(stage>progress.completedStages){ progress.completedStages=stage;persist(); }
            if(stage===4){
                const first=!progress.firstClear;grantConfiguredReward(definition,first);progress.firstClear=true;progress.completedStages=4;progress.clears++;persist();
            }
        }
        cleanupMechanismPresentation();activeBattleContext=null;bossDetail={type:"world",id:definition.id};if(typeof showPage==="function"){ showPage("boss"); }renderBossPage();
    }
    function startBoss(type,id){
        if(battleStarting||typeof battleActive!=="undefined"&&battleActive){ return false; }
        const world=type==="world",definition=world?findWorld(id):findPersonal(id);if(!definition||highestCharacterLevel()<definition.level){ return false; }
        const progress=world?state.world[definition.id]:state.personal[definition.id];
        const stage=world?(progress.firstClear?4:Math.min(4,progress.completedStages+1)):1;
        const stageProfile=world?WORLD_STAGE_PROFILES[stage-1]:{stage:1,hpFactor:1,attackFactor:1,defenseFactor:1,mechanisms:definition.mechanisms,summon:definition.summon||null};
        const boss=buildBossMonster(definition,{stage:stage,hpFactor:stageProfile.hpFactor,attackFactor:stageProfile.attackFactor,defenseFactor:stageProfile.defenseFactor});
        activeBattleContext={mode:world?"world":"personal",definitionId:definition.id,stage:stage,combatPhase:1,totalPhases:world?1:definition.phases,boss:boss,bossIndex:0,mechanisms:[],mechanismPlan:(world?stageProfile.mechanisms:definition.mechanisms).map(item=>Object.assign({},item)),spawnedPlans:{},summonPlan:world?stageProfile.summon:(definition.summon||null),summonsCreated:false,maxMechanisms:definition.level>=60?2:1};
        battleStarting=true;
        const started=window.v132LaunchDungeonBattle([boss],outcome=>world?completeWorldStage(definition,stage,outcome):completePersonalBoss(definition,outcome));
        battleStarting=false;if(!started){ cleanupMechanismPresentation();activeBattleContext=null; }return !!started;
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
        cleanupMechanismPresentation();activeBattleContext=null;if(typeof showPage==="function"){ showPage("tower"); }renderTowerPage();
    }
    function startTowerFloor(floor){
        ensureCurrentTowerWeek();
        const target=clamp(Math.floor(numeric(floor,state.tower.completedFloor+1)),1,TOWER_FLOORS);
        if(battleStarting||highestCharacterLevel()<TOWER_UNLOCK_LEVEL||state.tower.pendingRelicChoice||target>state.tower.completedFloor+1){ return false; }
        const roster=buildTowerRoster(target),boss=target%10===0?roster[0]:null;
        const towerPhases=boss?(target===100?4:(target>=70?3:(target>=40?2:1))):1;
        activeBattleContext={mode:"tower",floor:target,boss:boss,bossIndex:boss?0:null,combatPhase:1,totalPhases:towerPhases,mechanisms:[],mechanismPlan:towerMechanismPlan(target),spawnedPlans:{},summonPlan:boss?towerSummonPlan(target):null,summonsCreated:false,maxMechanisms:target>=60?2:1};
        battleStarting=true;const started=window.v132LaunchDungeonBattle(roster,outcome=>completeTowerFloor(target,outcome));
        battleStarting=false;if(!started){ cleanupMechanismPresentation();activeBattleContext=null; }return !!started;
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

    if(typeof renderBattle==="function"){
        const previous=renderBattle;
        renderBattle=function(){ const result=previous.apply(this,arguments);if(activeBattleContext&&activeBoss()){ renderMechanisms(); }return result; };
    }
    if(typeof updateUI==="function"){
        const previous=updateUI;
        updateUI=function(){ const result=previous.apply(this,arguments);if(activeBattleContext&&typeof battleActive!=="undefined"&&battleActive){ renderMechanisms(); }return result; };
    }
    if(typeof startTurn==="function"){
        const previous=startTurn;
        startTurn=function(){ if(activeBattleContext&&processMechanismRound()){ return; }return previous.apply(this,arguments); };
    }
    if(typeof setBattleTargetSelectionMode==="function"){
        const previous=setBattleTargetSelectionMode;
        setBattleTargetSelectionMode=function(){ const result=previous.apply(this,arguments);if(activeBattleContext){ renderMechanisms();const boss=activeBoss(),index=boss?monsters.indexOf(boss):-1;if(blockingShield()&&index>=0){ const node=document.getElementById("battleMonster"+index);if(node){ node.classList.remove("targetable"); } } }return result; };
    }
    if(typeof clearBattleTargetSelectionMode==="function"){
        const previous=clearBattleTargetSelectionMode;
        clearBattleTargetSelectionMode=function(){ const result=previous.apply(this,arguments);document.querySelectorAll(".boss-mechanism-card").forEach(node=>node.classList.remove("targetable","target"));return result; };
    }
    if(typeof selectBattleTarget==="function"){
        const previous=selectBattleTarget;
        selectBattleTarget=function(index){ const boss=activeBoss();if(boss&&monsters[index]===boss&&blockingShield()){ reportProtectedBoss();return false; }return previous.apply(this,arguments); };
    }
    if(typeof getSkillTargets==="function"){
        const previous=getSkillTargets;
        getSkillTargets=function(){ const targets=previous.apply(this,arguments);const boss=activeBoss();return boss&&(actionShieldSnapshot||blockingShield())?targets.filter(index=>monsters[index]!==boss):targets; };
    }
    if(typeof resolveQueuedPlayerAction==="function"){
        const previous=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            const queued=queuedPlayerActions[characterIndex];
            if(queued&&activeBattleContext){
                const boss=activeBoss(),shield=blockingShield();
                if(shield&&typeof queued.target==="number"&&monsters[queued.target]===boss){ queued.target="mechanism:"+shield.id; }
                actionShieldSnapshot=!!shield;
                try{ if(mechanismByTarget(queued.target)){ return resolveMechanismAction(characterIndex,queued,previous,this,arguments); }return previous.apply(this,arguments); }
                finally{ actionShieldSnapshot=false; }
            }
            return previous.apply(this,arguments);
        };
    }
    if(typeof autoActionForCharacter==="function"){
        const previous=autoActionForCharacter;
        autoActionForCharacter=function(characterIndex,token){
            const mechanism=prioritizedMechanism();
            if(!mechanism){ return previous.apply(this,arguments); }
            const character=getPartyCharacterByIndex(characterIndex),config=getPartyAutoConfig(characterIndex);
            const autoOn=characterIndex===0?autoBattle:config.enabled;
            if(!battleActive||!character||character.hp<=0||!autoOn||token!==battleToken){ return; }
            let action=config.skill||"normal";const skill=skillDatabase[action];const key=getPartyCharacterKey(characterIndex);
            if(action!=="normal"&&(!skill||getSkillLevel(key,action)<=0||character.sp<(skill.spCost!==undefined?skill.spCost:(skill.cost||0))||["buff","passive","heal","revive"].includes(skill.category))){ action="normal"; }
            queuedPlayerActions[characterIndex]={action:action,target:"mechanism:"+mechanism.id};updateUI();finishPlayerAction();
        };
    }
    if(typeof calculateDamage==="function"){
        const previous=calculateDamage;
        calculateDamage=function(){ const result=previous.apply(this,arguments),options=arguments[6]&&typeof arguments[6]==="object"?arguments[6]:{};const amp=aliveMechanisms().find(card=>card.type==="amplify");return amp&&options.attacker===activeBoss()?Math.max(1,Math.round(result*MECHANISM_DEFINITIONS.amplify.damageMultiplier)):result; };
    }
    if(typeof castHealSkill==="function"){
        const previous=castHealSkill;
        castHealSkill=function(){
            const seal=aliveMechanisms().find(card=>card.type==="seal");if(!seal){ return previous.apply(this,arguments); }
            const before=partyIndexes().map(index=>{ const character=getPartyCharacterByIndex(index);return {index:index,hp:numeric(character&&character.hp),sp:numeric(character&&character.sp)}; });
            const result=previous.apply(this,arguments);before.forEach(entry=>{ const character=getPartyCharacterByIndex(entry.index);if(!character){ return; }const hpGain=Math.max(0,character.hp-entry.hp),spGain=Math.max(0,character.sp-entry.sp);character.hp=entry.hp+Math.floor(hpGain*MECHANISM_DEFINITIONS.seal.healingMultiplier);character.sp=entry.sp+Math.floor(spGain*MECHANISM_DEFINITIONS.seal.healingMultiplier); });
            if(typeof addBattleLog==="function"){ addBattleLog("【"+seal.name+"】使本次治療與 SP 回復降低 40%。"); }if(typeof updateUI==="function"){ updateUI(); }return result;
        };
    }
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
    window.vGameplaySelectMechanism=selectMechanism;
    window.switchBossTab=switchBossTab;

    window.GameplaySystem=Object.freeze({
        stateVersion:STATE_VERSION,
        personalBosses:PERSONAL_BOSSES,
        worldBosses:WORLD_BOSSES,
        worldStageProfiles:WORLD_STAGE_PROFILES,
        mechanisms:MECHANISM_DEFINITIONS,
        towerConfig:TOWER_CONFIG,
        getSerializableState:serializableState,
        normalizeState:normalizeState,
        getWeekInfo:utcWeekInfo,
        getTowerFloorKind:towerFloorKind,
        buildTowerRoster:buildTowerRoster,
        canDirectlyAffectMonster:canDirectlyAffectMonster,
        getActiveBattleState:function(){ return activeBattleContext?copy({mode:activeBattleContext.mode,definitionId:activeBattleContext.definitionId||null,stage:activeBattleContext.stage||null,floor:activeBattleContext.floor||null,combatPhase:activeBattleContext.combatPhase||1,totalPhases:activeBattleContext.totalPhases||1,mechanisms:aliveMechanisms()}):null; },
        debugSpawnMechanism:spawnMechanism,
        debugDamageMechanism:damageMechanism,
        debugDamageMechanismById:function(id,amount){ return damageMechanism(mechanismByTarget("mechanism:"+id),amount,"測試攻擊"); },
        debugProcessMechanismRound:processMechanismRound,
        debugReloadState:function(raw,now){ state=normalizeState(raw,now);return serializableState(); }
    });

    if(initialStateNeedsPersist||ensureCurrentTowerWeek()){ persist(); }
    if(typeof document!=="undefined"){
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",renderGameplayHub,{once:true}); }
        else{ setTimeout(renderGameplayHub,0); }
    }
})();
