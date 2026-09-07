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
        bannerDurationMs:760,
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
            triggerText:"奇數回合結束時",limitText:"每個符合條件的回合最多觸發一次。",
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

    const relicCatalog=Object.freeze(Object.fromEntries(RELIC_CATALOG_LIST.map(item=>[item.id,Object.freeze(item)])));
    let playerRelics={};
    let teamLoadout={relicId:null,subRelicId:null};
    let relicBattleState=null;
    let pendingBattleInit=false;
    let currentFilter="all";
    let currentDetailId=null;
    let sourceContext=null;

    function numeric(value){ const n=Number(value); return Number.isFinite(n)?n:0; }
    function esc(value){ return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
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
            if(typeof SAVE_KEY==="undefined"||!window.localStorage){ return null; }
            const raw=localStorage.getItem(SAVE_KEY); return raw?JSON.parse(raw):null;
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
            if(typeof SAVE_KEY==="undefined"||!window.localStorage){ return false; }
            const raw=localStorage.getItem(SAVE_KEY);
            if(!raw){ return false; }
            const data=JSON.parse(raw);
            data.playerRelics=playerRelics;
            data.teamLoadout={relicId:teamLoadout.relicId,subRelicId:null};
            localStorage.setItem(SAVE_KEY,JSON.stringify(data));
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
            currentEnemyIndex:null,lastEvent:null
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
            return !!(character&&stats&&numeric(character.hp)>0&&numeric(character.hp)/Math.max(1,numeric(stats.maxHP))<numeric(triggerDef.hpThreshold));
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
            const host=document.getElementById("game-content")||document.body; if(host){ host.appendChild(node); }
        }
        node.innerHTML='<span class="team-relic-battle-icon">寶</span><b>秘寶・'+esc(def.name)+'</b>';
        node.classList.remove("show"); void node.offsetWidth; node.classList.add("show");
        clearTimeout(node.__hideTimer); node.__hideTimer=setTimeout(()=>node.classList.remove("show"),RELIC_BALANCE_CONFIG.bannerDurationMs);
    }
    function battleLog(message){ if(typeof addBattleLog==="function"){ addBattleLog("【秘寶】"+message); } }

    function healAlly(index,percent){
        const character=characterAt(index),stats=statsAt(index); if(!character||!stats||numeric(character.hp)<=0||percent<=0){ return 0; }
        const amount=Math.max(1,Math.floor(numeric(stats.maxHP)*percent/100*RELIC_BALANCE_CONFIG.healModifier));
        const actual=Math.max(0,Math.min(amount,numeric(stats.maxHP)-numeric(character.hp))); character.hp+=actual;
        if(actual>0&&typeof showPlayerHit==="function"){ withSource(SOURCE_RELIC,()=>showPlayerHit(actual,"heal",index,true)); }
        return actual;
    }
    function restoreSp(index,percent){
        const character=characterAt(index),stats=statsAt(index); if(!character||!stats||numeric(character.hp)<=0||percent<=0){ return 0; }
        const amount=Math.max(1,Math.floor(numeric(stats.maxSP)*percent/100));
        const actual=Math.max(0,Math.min(amount,numeric(stats.maxSP)-numeric(character.sp))); character.sp+=actual;
        if(actual>0&&typeof showPlayerHit==="function"){ withSource(SOURCE_RELIC,()=>showPlayerHit(actual,"sp",index,true)); }
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
        const final=Math.max(1,Math.floor(amount*(isBoss(monster)?RELIC_BALANCE_CONFIG.bossDamageModifier:1)));
        monster.hp=Math.max(0,numeric(monster.hp)-final);
        if(typeof showMonsterHit==="function"){ withSource(SOURCE_RELIC,()=>showMonsterHit(index,final,"hp",false)); }
        if(monster.hp<=0&&typeof killMonster==="function"){ withSource(SOURCE_RELIC,()=>killMonster(index)); }
        return final;
    }
    function applyEnemyDebuff(monster,attackDown,accuracyDown,duration){
        if(!monster||!monster.alive||!relicBattleState){ return; }
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

    function dispatchRelicEvent(event,payload){
        if(!relicBattleState||!relicBattleState.relicId){ return false; }
        if(payload&&payload.sourceType===SOURCE_RELIC){ return false; }
        const def=activeBattleRelic(); if(!def||!def.runtimeReady){ return false; }
        relicBattleState.lastEvent={event:event,round:currentRound()};
        let triggered=false;
        def.triggers.forEach((triggerDef,index)=>{
            const key=def.id+":"+(triggerDef.id||index);
            if(!canTrigger(triggerDef,key)||!triggerMatches(triggerDef,event,payload,key)){ return; }
            if(triggerDef.type==="ally_hp_below"&&payload){ relicBattleState.lastHpDamageEvent[key]=payload.damageEventId; }
            markTriggered(triggerDef,key);
            showBanner(def);
            resolveEffects(triggerDef,def,payload||{});
            battleLog(def.name+"發動。" );
            triggered=true;
        });
        if(triggered&&typeof updateUI==="function"){ try{updateUI();}catch(_){ } }
        return triggered;
    }

    function initializeBattleRelic(){
        relicBattleState=createBattleState(teamLoadout.relicId);
        pendingBattleInit=false;
        if(relicBattleState.relicId){ dispatchRelicEvent("battle_start",{sourceType:"system"}); }
    }

    if(typeof startBattle==="function"){
        const previous=startBattle;
        startBattle=function(){ relicBattleState=null; pendingBattleInit=true; const result=previous.apply(this,arguments); if(!battleActive){ pendingBattleInit=false; } return result; };
    }
    if(typeof startTurn==="function"){
        const previous=startTurn;
        startTurn=function(){
            const result=previous.apply(this,arguments);
            if(typeof battleActive!=="undefined"&&battleActive){
                if(pendingBattleInit||!relicBattleState||relicBattleState.battleToken!==currentBattleToken()){ initializeBattleRelic(); }
                resetRoundCounters(); cleanupPlayerMods(); dispatchRelicEvent("round_start",{sourceType:"system"});
            }
            return result;
        };
    }
    if(typeof processNextCombatant==="function"){
        const previous=processNextCombatant;
        processNextCombatant=function(){
            if(
                relicBattleState&&typeof battleActive!=="undefined"&&battleActive&&
                typeof battlePhase!=="undefined"&&battlePhase==="resolve"&&
                typeof initiativeIndex!=="undefined"&&typeof initiativeQueue!=="undefined"&&initiativeIndex>=initiativeQueue.length
            ){
                dispatchRelicEvent("round_end",{sourceType:"system"});
            }
            return previous.apply(this,arguments);
        };
    }

    if(typeof processSingleMonsterAttack==="function"){
        const previous=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const hardControlled=!!(monster&&((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||(typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))));
            const before=partyIndexes().map(index=>({index:index,hp:numeric(characterAt(index)&&characterAt(index).hp)}));
            if(relicBattleState){ relicBattleState.currentEnemyIndex=monsterIndex; }
            const result=withSource("enemy",()=>previous.apply(this,arguments));
            const hitTargets=[];
            before.forEach(entry=>{ const character=characterAt(entry.index); if(character&&numeric(character.hp)<entry.hp){ hitTargets.push(entry.index); } });
            if(relicBattleState){
                relicBattleState.currentEnemyIndex=null;
                if(!hardControlled){ relicBattleState.enemyActionCount++; dispatchRelicEvent("after_enemy_action",{sourceType:"enemy",monsterIndex:monsterIndex}); }
                if(hitTargets.length){ relicBattleState.allyHitCount++; dispatchRelicEvent("after_ally_hit",{sourceType:"enemy",monsterIndex:monsterIndex,targetIndexes:hitTargets}); }
                const reflectedIndex=hitTargets.find(index=>relicBattleState.reflectReady[String(index)]);
                if(reflectedIndex!==undefined&&monster&&monster.alive){
                    const reflect=relicBattleState.reflectReady[String(reflectedIndex)]; delete relicBattleState.reflectReady[String(reflectedIndex)];
                    const def=activeBattleRelic(); if(def){ const damage=Math.max(1,Math.floor(getRelicPower(def.id)*numeric(reflect.multiplier))); damageEnemy(monsterIndex,damage,"earth"); battleLog(def.name+"反震"+damage+"點秘寶傷害。"); }
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
                    if(numeric(character.hp)<=0){
                        dispatchRelicEvent("before_lethal_damage",{sourceType:sourceContext&&sourceContext.sourceType||"unknown",targetIndex:index,damageEventId:eventId,damage:displayAmount});
                    }
                    if(numeric(character.hp)>0){
                        dispatchRelicEvent("ally_hp_below",{sourceType:sourceContext&&sourceContext.sourceType||"unknown",targetIndex:index,damageEventId:eventId,damage:displayAmount});
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

    [["winBattle","victory"],["loseBattle","defeat"]].forEach(([name])=>{
        const previous=window[name]; if(typeof previous!=="function"){ return; }
        window[name]=function(){ const result=previous.apply(this,arguments); relicBattleState=null; pendingBattleInit=false; return result; };
    });

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
        const next=owned.level+1,cost=RELIC_BALANCE_CONFIG.upgradeGoldBase+RELIC_BALANCE_CONFIG.upgradeGoldPerLevel*(next-1);
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
        if(typeof closeHomeFeature==="function"&&!nodes.modal.classList.contains("team-relic-modal")){ try{closeHomeFeature();}catch(_){ } }
        nodes.modal.classList.add("show","team-relic-modal");
        const box=nodes.modal.querySelector(".home-feature-modal-box"); if(box){ box.classList.add("wide"); }
        if(nodes.title){ nodes.title.textContent="秘 寶"; }
        const close=nodes.modal.querySelector(".home-feature-close-btn"); if(close){ close.setAttribute("aria-label","返回主城"); close.title="返回主城"; }
        return nodes;
    }
    function openRelicPage(){
        currentDetailId=null; Object.values(playerRelics).forEach(state=>{ if(state.unlocked){state.seen=true;} }); saveRelics();
        const nodes=prepareRelicModal(); if(!nodes){ return false; } nodes.body.innerHTML=renderRelicList(); syncHomeRelicUi(); return true;
    }
    function openRelicDetail(id){ const def=relicCatalog[id]; if(!def){ return false; } currentDetailId=id; const nodes=prepareRelicModal(); if(!nodes){return false;} nodes.body.innerHTML=detailMarkup(def); return true; }
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
