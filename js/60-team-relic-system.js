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

    const RELIC_VFX_FLOOR_MS=2000;
    const RELIC_DIM_IN_MS=360;
    const RELIC_IDENTITY_REVEAL_MS=360;
    const RELIC_IDENTITY_HOLD_MS=1150;
    const RELIC_IDENTITY_EXIT_MS=420;
    const RELIC_TARGET_REVEAL_MS=420;
    const RELIC_DIM_OUT_MS=420;
    const RELIC_CUTIN_DURATION_MS=RELIC_DIM_IN_MS+RELIC_IDENTITY_REVEAL_MS+RELIC_IDENTITY_HOLD_MS+Math.max(RELIC_IDENTITY_EXIT_MS,RELIC_TARGET_REVEAL_MS);
    const RELIC_MIN_VISUAL_PROTECTION_MS=1200;
    const RELIC_DEV_HOST="dev.four-symbols-dev.pages.dev";
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
        bannerDurationMs:1800,
        presentationDurationMs:2400,
        presentationLeadGapMs:120,
        upgradeGoldBase:650,
        upgradeGoldPerLevel:180
    });

    function relicVfx(durationMs,element,defaultTarget){
        return Object.freeze({
            durationMs:Math.max(RELIC_VFX_FLOOR_MS,Math.floor(Number(durationMs)||0)),
            element:element||"normal",
            defaultTarget:defaultTarget||"allyAll"
        });
    }
    const RELIC_VFX_PRESENTATION=Object.freeze({
        relic_qiankun_flask:relicVfx(2500,"normal","allyAll"),
        relic_sun_orb:relicVfx(2250,"fire","enemyAll"),
        relic_xuanwu_seal:relicVfx(2600,"normal","allyAll"),
        relic_soul_bell:relicVfx(2500,"normal","enemyAll"),
        relic_tiangang_banner:relicVfx(2800,"normal","enemyAll"),
        relic_nine_dragon_fire:relicVfx(2550,"fire","enemyAll"),
        relic_cold_spring_jade:relicVfx(2500,"water","singleAlly"),
        relic_qinglan_feather:relicVfx(2350,"wind","allyAll"),
        relic_rock_mountain_seal:relicVfx(2600,"earth","allyAll"),
        relic_returning_wheel:relicVfx(2750,"normal","singleAlly"),
        relic_origin_talisman:relicVfx(2350,"normal","allyAll"),
        relic_broken_army_scroll:relicVfx(2250,"normal","singleEnemy"),
        relic_red_sky_war_mark:relicVfx(2300,"normal","allyAll"),
        relic_ice_mirror_heart:relicVfx(2400,"water","enemyAll"),
        relic_wind_chasing_talisman:relicVfx(2200,"wind","allyAll"),
        relic_mountain_river_cauldron:relicVfx(2650,"earth","allyAll"),
        relic_burning_star_mark:relicVfx(2250,"fire","enemyAll"),
        relic_spirit_spring_bottle:relicVfx(2450,"water","allyAll"),
        relic_demon_suppressing_seal:relicVfx(2400,"normal","allyAll"),
        relic_all_returning_array:relicVfx(2800,"normal","allyAll")
    });
    const RELIC_BATTLE_ICON_PATHS=Object.freeze({
        relic_qiankun_flask:"assets/relics/battle-icons/relic_qiankun_flask.webp",
        relic_sun_orb:"assets/relics/battle-icons/relic_sun_orb.webp",
        relic_xuanwu_seal:"assets/relics/battle-icons/relic_xuanwu_seal.webp",
        relic_soul_bell:"assets/relics/battle-icons/relic_soul_bell.webp",
        relic_tiangang_banner:"assets/relics/battle-icons/relic_tiangang_banner.webp",
        relic_nine_dragon_fire:"assets/relics/battle-icons/relic_nine_dragon_fire.webp",
        relic_cold_spring_jade:"assets/relics/battle-icons/relic_cold_spring_jade.webp",
        relic_qinglan_feather:"assets/relics/battle-icons/relic_qinglan_feather.webp",
        relic_rock_mountain_seal:"assets/relics/battle-icons/relic_rock_mountain_seal.webp",
        relic_returning_wheel:"assets/relics/battle-icons/relic_returning_wheel.webp",
        relic_origin_talisman:"assets/relics/battle-icons/relic_origin_talisman.webp",
        relic_broken_army_scroll:"assets/relics/battle-icons/relic_broken_army_scroll.webp",
        relic_red_sky_war_mark:"assets/relics/battle-icons/relic_red_sky_war_mark.webp",
        relic_ice_mirror_heart:"assets/relics/battle-icons/relic_ice_mirror_heart.webp",
        relic_wind_chasing_talisman:"assets/relics/battle-icons/relic_wind_chasing_talisman.webp",
        relic_mountain_river_cauldron:"assets/relics/battle-icons/relic_mountain_river_cauldron.webp",
        relic_burning_star_mark:"assets/relics/battle-icons/relic_burning_star_mark.webp",
        relic_spirit_spring_bottle:"assets/relics/battle-icons/relic_spirit_spring_bottle.webp",
        relic_demon_suppressing_seal:"assets/relics/battle-icons/relic_demon_suppressing_seal.webp",
        relic_all_returning_array:"assets/relics/battle-icons/relic_all_returning_array.webp"
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
            id:"relic_qiankun_flask",category:"recovery",tags:["recovery","sustain"],rarity:"blue",maxLevel:20,iconPath:"assets/relics/icons/relic_qiankun_flask.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"奇數回合結束時，穩定恢復全隊生命；高等級追加少量SP回復。",
            scalars:{healHpPercent:[[1,4],[5,4.5],[10,5],[15,6],[20,7]],spPercent:[[1,0],[9,0],[10,1],[15,1.5],[20,2]]},
            triggers:[trigger("odd_end","odd_round_end",{maxTriggersPerRound:1},[
                effect("heal_all_allies",{percentKey:"healHpPercent"}),effect("restore_sp_all",{percentKey:"spPercent",minLevel:10})
            ])],
            limitText:"無每場總次數限制；每個符合條件的奇數回合最多觸發一次。",
            nextText:{5:"HP回復提高至4.5%",10:"HP回復5%，追加1%最大SP",15:"HP 6%＋SP 1.5%",20:"HP 7%＋SP 2%"}
        },
        {
            id:"relic_sun_orb",category:"attack",tags:["attack","group"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_sun_orb.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"偶數回合開始時對敵方全體造成穩定秘寶傷害，對燃燒目標更強。",
            scalars:{damageMultiplier:[[1,.75],[10,.9],[20,1.1]],burnBonus:[[1,0],[9,0],[10,.15],[20,.25]]},
            triggers:[trigger("even_start","even_round_start",{},[
                effect("damage_all_enemies",{multiplierKey:"damageMultiplier",bonusAgainstStatus:"burn",bonusKey:"burnBonus",element:"fire"})
            ])],
            limitText:"不能暴擊，不觸發角色追擊或吸血。",
            nextText:{10:"傷害0.90×秘寶威力；燃燒目標+15%",20:"傷害1.10×；燃燒目標+25%"}
        },
        {
            id:"relic_xuanwu_seal",category:"defense",tags:["defense","shield"],rarity:"blue",maxLevel:20,iconPath:"assets/relics/icons/relic_xuanwu_seal.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"每第3回合開始為全隊建立不疊加的護盾。",
            scalars:{shieldPercent:[[1,6],[10,8],[20,10]],damageReduction:[[1,0],[19,0],[20,8]]},
            triggers:[trigger("third_start","every_n_rounds",{phase:"round_start",roundInterval:3},[
                effect("shield_all",{percentKey:"shieldPercent",durationRounds:2}),effect("buff_all",{minLevel:20,damageReductionKey:"damageReduction",durationRounds:1})
            ])],
            limitText:"同一秘寶護盾不可相加；只保留較高護盾值。",
            nextText:{10:"護盾提高至最大HP 8%",20:"護盾10%，並獲得1回合8%減傷"}
        },
        {
            id:"relic_soul_bell",category:"control",tags:["control","soft-control"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_soul_bell.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"每第4回合開始，以降攻與降命中壓制敵方全體。",
            scalars:{attackDown:[[1,10],[10,12],[20,15]],accuracyDown:[[1,0],[9,0],[10,5],[20,8]]},
            triggers:[trigger("fourth_start","every_n_rounds",{phase:"round_start",roundInterval:4},[
                effect("debuff_all_enemies",{attackDownKey:"attackDown",accuracyDownKey:"accuracyDown",durationRounds:1})
            ])],
            limitText:"BOSS套用較低效率；不造成全體硬控。",
            nextText:{10:"降攻12%並追加命中-5%",20:"降攻15%、命中-8%"}
        },
        {
            id:"relic_tiangang_banner",category:"defense",tags:["attack","defense","anti_swarm"],rarity:"orange",maxLevel:20,iconPath:"assets/relics/icons/relic_tiangang_banner.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"我方累積遭受6次敵方有效攻擊後反擊全體，敵人越多越容易累積。",
            scalars:{damageMultiplier:[[1,.65],[10,.8],[20,1]],attackDown:[[1,0],[9,0],[10,5],[20,8]]},
            triggers:[trigger("ally_hits_6","ally_hit_count",{threshold:6,resetOnTrigger:true,maxTriggersPerRound:1},[
                effect("damage_all_enemies",{multiplierKey:"damageMultiplier"}),effect("debuff_all_enemies",{minLevel:10,attackDownKey:"attackDown",durationRounds:1})
            ])],
            limitText:"觸發後受擊計數歸零；每回合最多一次。",
            nextText:{10:"全體傷害0.80×並降攻5%一回合",20:"全體傷害1.00×並降攻8%"}
        },
        {
            id:"relic_nine_dragon_fire",category:"element",tags:["attack","fire","anti_swarm"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_nine_dragon_fire.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"敵方累積完成7次有效行動後爆發全體火屬性秘寶傷害。",
            scalars:{damageMultiplier:[[1,.8],[5,.85],[10,.9],[15,1],[20,1.1]],burnChance:[[1,0],[9,0],[10,.2],[15,.25],[20,.3]],burnBonus:[[1,0],[19,0],[20,.15]]},
            triggers:[trigger("enemy_actions_7","enemy_action_count",{threshold:7,resetOnTrigger:true,maxTriggersPerRound:1},[
                effect("damage_all_enemies",{multiplierKey:"damageMultiplier",element:"fire",bonusAgainstStatus:"burn",bonusKey:"burnBonus"}),
                effect("apply_status_all_enemies",{minLevel:10,statusId:"burn",chanceKey:"burnChance",durationRounds:2})
            ])],
            limitText:"觸發後敵方行動計數歸零；每回合最多一次。",
            nextText:{5:"全體火傷提高至0.85×",10:"0.90×並有20%機率燃燒",15:"1.00×、燃燒25%",20:"1.10×、燃燒30%，燃燒目標+15%"}
        },
        {
            id:"relic_cold_spring_jade",category:"recovery",tags:["water","emergency","element"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_cold_spring_jade.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"任一隊友HP由35%以上降至35%以下時進行急救。",
            scalars:{healHpPercent:[[1,12],[10,15],[20,18]],spPercent:[[1,0],[19,0],[20,4]]},
            triggers:[trigger("hp_below_35","ally_hp_below",{hpThreshold:.35,maxTriggersPerBattle:2,cooldownRounds:3},[
                effect("heal_single_ally",{percentKey:"healHpPercent"}),effect("cleanse_single",{minLevel:10,count:1}),effect("restore_sp_single",{minLevel:20,percentKey:"spPercent"})
            ])],
            limitText:"每場最多2次，全域冷卻3回合；同一傷害事件只判定一次。",
            nextText:{10:"急救15%最大HP並解除1個一般負面",20:"急救18%HP、淨化1個可解除負面並回4%最大SP"}
        },
        {
            id:"relic_qinglan_feather",category:"buff",tags:["wind","evasion","element"],rarity:"blue",maxLevel:20,iconPath:"assets/relics/icons/relic_qinglan_feather.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"戰鬥開始時提高全隊閃避與異常抗性。",
            scalars:{evasionBonus:[[1,8],[10,10],[20,12]],resistanceBonus:[[1,8],[10,10],[20,12]],duration:[[1,2],[19,2],[20,3]]},
            triggers:[trigger("battle_start","battle_start",{oncePerBattle:true},[
                effect("buff_all",{evasionKey:"evasionBonus",resistanceKey:"resistanceBonus",durationKey:"duration"})
            ])],
            limitText:"只在開場觸發一次；維持風系靈活、防控定位。",
            nextText:{10:"閃避與異常抗性各+10%",20:"各+12%，持續3回合"}
        },
        {
            id:"relic_rock_mountain_seal",category:"defense",tags:["earth","pressure","element"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_rock_mountain_seal.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"開場提高全隊防禦，受圍攻時再產生隊伍護盾。",
            scalars:{defenseBonus:[[1,10],[10,12],[20,15]],shieldPercent:[[1,5],[10,6],[20,8]],reflectMultiplier:[[1,0],[19,0],[20,.18]]},
            triggers:[
                trigger("battle_start_defense","battle_start",{oncePerBattle:true},[effect("buff_all",{defenseKey:"defenseBonus",durationRounds:3})]),
                trigger("ally_hits_8","ally_hit_count",{threshold:8,resetOnTrigger:true,maxTriggersPerBattle:2},[
                    effect("shield_all",{percentKey:"shieldPercent",durationRounds:2}),effect("prepare_reflect",{minLevel:20,multiplierKey:"reflectMultiplier",durationRounds:1})
                ])
            ],
            limitText:"受擊護盾每場最多2次；Lv20反震只作用於下一名實際攻擊者。",
            nextText:{10:"開場防禦+12%，受擊護盾6%",20:"防禦+15%、護盾8%，追加一次反震"}
        },
        {
            id:"relic_returning_wheel",category:"special",tags:["recovery","survival"],rarity:"pink",maxLevel:20,iconPath:"assets/relics/icons/relic_returning_wheel.webp",runtimeReady:true,defaultUnlocked:true,unlockSource:null,
            description:"每場第一次致命傷害發生時阻止死亡，留下1HP後立即回復並獲得護盾。",
            scalars:{healHpPercent:[[1,15],[10,18],[20,22]],shieldPercent:[[1,8],[10,8],[20,10]]},
            triggers:[trigger("before_lethal","before_lethal_damage",{oncePerBattle:true,maxTriggersPerBattle:1},[
                effect("prevent_death",{}),effect("heal_single_ally",{percentKey:"healHpPercent",afterPreventDeath:true}),
                effect("shield_single",{percentKey:"shieldPercent",durationRounds:1}),effect("cleanse_single",{minLevel:20,count:1})
            ])],
            limitText:"整支隊伍每場只觸發一次，不是每個角色各一次。",
            nextText:{10:"保命後回復18%最大HP",20:"回復22%、護盾10%並解除1個一般負面"}
        },
        {id:"relic_origin_talisman",category:"buff",tags:["recovery","cleanse","special"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_origin_talisman.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第4回合結束淨化負面最多的隊友，並恢復全隊HP。",limitText:"第一版資料已建立，尚未開放取得。"},
        {id:"relic_broken_army_scroll",category:"attack",tags:["execute"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_broken_army_scroll.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"角色擊敗敵人後，追擊目前HP最低的存活敵人。",limitText:"每回合最多一次；秘寶與DOT擊殺不觸發。"},
        {id:"relic_red_sky_war_mark",category:"buff",tags:["attack","burst"],rarity:"orange",maxLevel:20,iconPath:"assets/relics/icons/relic_red_sky_war_mark.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"戰鬥開始時短暫提高全隊攻擊，後期追加暴擊率。",limitText:"只觸發一次，不長時間常駐。"},
        {id:"relic_ice_mirror_heart",category:"element",tags:["water","frostbite","freeze","control"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_ice_mirror_heart.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第3回合結束，對凍傷或冰封中的敵人追加水屬性秘寶傷害。",limitText:"不附加冰封，不刷新凍傷。"},
        {id:"relic_wind_chasing_talisman",category:"buff",tags:["wind","tempo"],rarity:"blue",maxLevel:20,iconPath:"assets/relics/icons/relic_wind_chasing_talisman.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第3回合開始提高隊伍節奏與閃避。",limitText:"第一版資料保留；待確認正式速度 owner 後再開放。"},
        {id:"relic_mountain_river_cauldron",category:"defense",tags:["recovery","anti_swarm"],rarity:"orange",maxLevel:20,iconPath:"assets/relics/icons/relic_mountain_river_cauldron.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"我方累積受7次有效攻擊後，恢復全隊並短暫提高防禦。",limitText:"每回合最多一次。"},
        {id:"relic_burning_star_mark",category:"element",tags:["fire","burn","attack"],rarity:"purple",maxLevel:20,iconPath:"assets/relics/icons/relic_burning_star_mark.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"偶數回合結束時對燃燒中的敵人追加火屬性秘寶傷害。",limitText:"不消耗或刷新燃燒。"},
        {id:"relic_spirit_spring_bottle",category:"recovery",tags:["sp","long-battle"],rarity:"blue",maxLevel:20,iconPath:"assets/relics/icons/relic_spirit_spring_bottle.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第3回合結束恢復全隊SP，高等級追加少量HP。",limitText:"死亡角色不受影響。"},
        {id:"relic_demon_suppressing_seal",category:"defense",tags:["buff","cleanse"],rarity:"orange",maxLevel:20,iconPath:"assets/relics/icons/relic_demon_suppressing_seal.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"開場提高異常抗性，並在首次中負面時自動淨化。",limitText:"自動淨化每場一次。"},
        {id:"relic_all_returning_array",category:"special",tags:["adaptive"],rarity:"four-symbol",maxLevel:20,iconPath:"assets/relics/icons/relic_all_returning_array.webp",runtimeReady:false,defaultUnlocked:false,unlockSource:null,description:"每第4回合開始依全隊平均HP決定回血或攻防增益。",limitText:"一次只發動回血或攻防其中一種。"}
    ];

    RELIC_CATALOG_LIST.forEach(def=>{
        const summary=window.FourSymbolsRelicSummaryCatalog&&window.FourSymbolsRelicSummaryCatalog[def.id];
        if(!summary){ throw new Error("Missing first-screen relic summary definition: "+def.id); }
        def.name=summary.name;
        def.triggerText=summary.triggerText;
        def.vfx=RELIC_VFX_PRESENTATION[def.id]||null;
        def.battleIconPath=RELIC_BATTLE_ICON_PATHS[def.id]||null;
        def.upgradeCost={
            items:[],
            goldCost:{base:RELIC_BALANCE_CONFIG.upgradeGoldBase,perLevel:RELIC_BALANCE_CONFIG.upgradeGoldPerLevel},
            formalMaterialSource:null
        };
    });
    let relicVisualReadyPromise=null;
    function nextVisualPaint(){ return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); }
    function decodeRelicIcon(path){
        return new Promise((resolve,reject)=>{const image=new Image();image.decoding="async";image.onload=()=>typeof image.decode==="function"?image.decode().then(resolve,reject):resolve();image.onerror=()=>reject(new Error("秘寶圖片無法載入："+path));image.src=path;});
    }
    function prepareRelicVisuals(){
        if(relicVisualReadyPromise){return relicVisualReadyPromise;}
        const iconPaths=[...new Set(RELIC_CATALOG_LIST.map(def=>def.iconPath).filter(Boolean))];
        const loader=window.FourSymbolsFeatures;
        const iconReady=loader&&typeof loader.ensureAssets==="function"?loader.ensureAssets(iconPaths):Promise.all(iconPaths.map(decodeRelicIcon));
        relicVisualReadyPromise=Promise.all([document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve(),iconReady]).then(()=>iconPaths).catch(error=>{relicVisualReadyPromise=null;throw error;});
        return relicVisualReadyPromise;
    }
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
    let relicVfxSequence=0;
    let relicPresentationHandoffsPending=0;
    let relicMinVisualProtectionUntil=0;
    let relicFinishHeld=false;
    let relicFinishRetryTimer=0;
    let relicCutinNode=null;
    let relicFocusedTargetCards=[];
    let relicFocusedTargetLayers=[];
    const relicPresentationLockReleases=new Set();

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
    function withSource(type,callback){
        const previous=sourceContext;
        const previousGlobal=window.__fourSymbolsBattleEffectSource;
        sourceContext={sourceType:type};
        window.__fourSymbolsBattleEffectSource=type;
        try{return callback();}
        finally{
            sourceContext=previous;
            if(previousGlobal===undefined){ delete window.__fourSymbolsBattleEffectSource; }
            else{ window.__fourSymbolsBattleEffectSource=previousGlobal; }
        }
    }
    function waitMs(ms){ return new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.floor(numeric(ms))))); }
    function isRelicDevTestingEnvironment(){
        if(typeof window==="undefined"||!window.location){ return false; }
        const host=String(window.location.hostname||"").toLowerCase();
        return host===RELIC_DEV_HOST||host==="localhost"||host==="127.0.0.1"||host==="::1";
    }
    function effectiveLoadoutRelicId(){
        return teamLoadout.relicId;
    }
    function hasLiveBattlePresentationHost(){
        return typeof document!=="undefined"&&typeof document.getElementById==="function"&&!!document.getElementById("battlePage");
    }
    function clearRelicTargetFocus(){
        relicFocusedTargetCards=[];
        relicFocusedTargetLayers=[];
        if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
            document.querySelectorAll(".team-relic-battle-target-outline").forEach(node=>node.remove());
            const holes=document.querySelector("#teamRelicBattlePresentation .team-relic-mask-holes");
            if(holes){ holes.replaceChildren(); }
        }
    }
    function cleanupRelicCutin(){
        clearRelicTargetFocus();
        const node=relicCutinNode||(typeof document!=="undefined"&&document.getElementById?document.getElementById("teamRelicBattlePresentation"):null);
        if(node&&typeof node.remove==="function"){ node.remove(); }
        if(typeof document!=="undefined"&&document.body&&document.body.classList){
            document.body.classList.remove("team-relic-cinematic-active");
        }
        relicCutinNode=null;
    }
    function relicTargetGeometry(side,index){
        const geometry=window.FourSymbolsBattlefieldRenderGeometry;
        if(geometry&&typeof geometry.getUnitGeometry==="function"){
            const resolved=geometry.getUnitGeometry(side,index);
            if(resolved&&resolved.highlightRect){ return resolved.highlightRect; }
            if(resolved&&resolved.unitRect){ return resolved.unitRect; }
        }
        const card=document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
        return card&&typeof card.getBoundingClientRect==="function"?card.getBoundingClientRect():null;
    }
    function revealRelicTargets(target){
        clearRelicTargetFocus();
        if(!relicCutinNode||!target||!Array.isArray(target.targetIds)){ return waitMs(RELIC_TARGET_REVEAL_MS); }
        const holes=relicCutinNode.querySelector(".team-relic-mask-holes");
        const focusLayer=relicCutinNode.querySelector(".team-relic-battle-target-focus-layer");
        const namespace="http://www.w3.org/2000/svg";
        target.targetIds.forEach(index=>{
            const rect=relicTargetGeometry(target.targetSide,index);
            if(!rect||rect.width<=0||rect.height<=0){ return; }
            if(holes){
                const hole=document.createElementNS(namespace,"rect");
                hole.setAttribute("x",String(Math.max(0,rect.left)));
                hole.setAttribute("y",String(Math.max(0,rect.top)));
                hole.setAttribute("width",String(Math.max(1,rect.width)));
                hole.setAttribute("height",String(Math.max(1,rect.height)));
                hole.setAttribute("rx","8");
                hole.setAttribute("fill","black");
                holes.appendChild(hole);
            }
            if(focusLayer){
                const outline=document.createElement("span");
                outline.className="team-relic-battle-target-outline";
                outline.style.left=Math.max(0,rect.left)+"px";
                outline.style.top=Math.max(0,rect.top)+"px";
                outline.style.width=Math.max(1,rect.width)+"px";
                outline.style.height=Math.max(1,rect.height)+"px";
                focusLayer.appendChild(outline);
            }
        });
        const show=()=>{ if(relicCutinNode){ relicCutinNode.classList.add("targets-visible"); } };
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(show); }else{ show(); }
        return waitMs(RELIC_TARGET_REVEAL_MS);
    }
    function beginRelicCinematic(def,target){
        if(!hasLiveBattlePresentationHost()||!def||!document.body){ return Promise.resolve(null); }
        cleanupRelicCutin();
        const node=document.createElement("div");
        const width=Math.max(1,window.innerWidth||document.documentElement.clientWidth||1);
        const height=Math.max(1,window.innerHeight||document.documentElement.clientHeight||1);
        const maskId="teamRelicViewportMask-"+String(currentBattleToken())+"-"+String(++relicVfxSequence);
        node.id="teamRelicBattlePresentation";
        node.className="team-relic-battle-presentation";
        node.setAttribute("aria-label","秘寶發動："+def.name);
        node.innerHTML='<svg class="team-relic-battle-dim" aria-hidden="true" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none">'+
            '<defs><mask id="'+maskId+'" maskUnits="userSpaceOnUse" x="0" y="0" width="'+width+'" height="'+height+'">'+
            '<rect x="0" y="0" width="'+width+'" height="'+height+'" fill="white"></rect>'+
            '<g class="team-relic-mask-holes"></g></mask></defs>'+
            '<rect class="team-relic-battle-dim-fill" x="0" y="0" width="'+width+'" height="'+height+'" fill="#000" mask="url(#'+maskId+')"></rect></svg>'+
            '<div class="team-relic-battle-target-focus-layer" aria-hidden="true"></div>'+
            '<div class="team-relic-battle-cutin"><span class="team-relic-battle-cutin-icon">'+
            '<img src="'+esc(def.battleIconPath||def.iconPath||"")+'" alt=""></span>'+
            '<span class="team-relic-battle-cutin-copy"><strong>'+esc(def.name)+'</strong></span></div>';
        document.body.appendChild(node);
        document.body.classList.add("team-relic-cinematic-active");
        relicCutinNode=node;
        const dim=()=>{ if(node===relicCutinNode){ node.classList.add("dim-visible"); } };
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(dim); }else{ dim(); }
        return waitMs(RELIC_DIM_IN_MS)
            .then(()=>{
                if(node!==relicCutinNode){ return null; }
                node.classList.add("identity-visible");
                return waitMs(RELIC_IDENTITY_REVEAL_MS);
            })
            .then(()=>{
                if(node!==relicCutinNode){ return null; }
                return waitMs(RELIC_IDENTITY_HOLD_MS);
            })
            .then(()=>{
                if(node!==relicCutinNode){ return null; }
                node.classList.add("identity-exiting");
                return Promise.all([
                    waitMs(RELIC_IDENTITY_EXIT_MS),
                    revealRelicTargets(target)
                ]).then(()=>node);
            });
    }
    function enterRelicVfxPhase(node){
        if(node&&node===relicCutinNode){ node.classList.add("vfx-running"); }
    }
    function endRelicCinematic(node){
        if(!node||node!==relicCutinNode){ cleanupRelicCutin(); return Promise.resolve(); }
        node.classList.add("releasing");
        return waitMs(RELIC_DIM_OUT_MS).then(()=>{
            if(node===relicCutinNode){ cleanupRelicCutin(); }
        });
    }
    function clearRelicFinishProtection(){
        if(relicFinishRetryTimer){ clearTimeout(relicFinishRetryTimer); relicFinishRetryTimer=0; }
        relicPresentationHandoffsPending=0;
        relicMinVisualProtectionUntil=0;
        relicFinishHeld=false;
    }
    function retryHeldBattleFinishWhenReady(){
        if(!relicFinishHeld||relicPresentationHandoffsPending>0){ return; }
        const wait=Math.max(0,relicMinVisualProtectionUntil-Date.now());
        if(wait>8){
            if(relicFinishRetryTimer){ clearTimeout(relicFinishRetryTimer); }
            relicFinishRetryTimer=setTimeout(()=>{ relicFinishRetryTimer=0; retryHeldBattleFinishWhenReady(); },wait);
            return;
        }
        relicFinishHeld=false;
        if(typeof battleActive!=="undefined"&&battleActive&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
    }
    function releaseRelicPresentationHandoff(withProtection){
        relicPresentationHandoffsPending=Math.max(0,relicPresentationHandoffsPending-1);
        if(withProtection){
            relicMinVisualProtectionUntil=Math.max(relicMinVisualProtectionUntil,Date.now()+RELIC_MIN_VISUAL_PROTECTION_MS);
        }
        retryHeldBattleFinishWhenReady();
    }
    function resetRelicPresentationQueue(){
        relicPresentationGeneration++;
        relicPresentationTail=Promise.resolve();
        relicPresentationPending=0;
        relicVfxSequence=0;
        relicVisualCollector=null;
        relicPresentationLockReleases.forEach(release=>{ try{release();}catch(_){ } });
        relicPresentationLockReleases.clear();
        cleanupRelicCutin();
        clearRelicFinishProtection();
    }
    function currentAnimationGate(){
        const director=window.v142SkillAnimationDirector;
        return director&&typeof director.getActive==="function"?director.getActive():null;
    }
    function preloadRelicVfx(defOrId){
        const id=typeof defOrId==="string"?defOrId:defOrId&&defOrId.id;
        if(!id||typeof window.v143PreloadBattleVfxAsset!=="function"){ return false; }
        try{ return !!window.v143PreloadBattleVfxAsset(id); }
        catch(error){ console.error("秘寶 VFX 預載失敗：",error); return false; }
    }
    function eligibleEnemyIndexesForRelicVfx(){
        const indexes=typeof currentBattleMonsters!=="undefined"&&Array.isArray(currentBattleMonsters)?currentBattleMonsters:[];
        return indexes.filter(index=>{
            const monster=typeof monsters!=="undefined"&&monsters?monsters[index]:null;
            if(!Number.isInteger(index)||!monster||monster.alive===false||numeric(monster.hp)<=0){ return false; }
            if(
                window.GameplaySystem&&typeof window.GameplaySystem.canDirectlyAffectMonster==="function"&&
                !window.GameplaySystem.canDirectlyAffectMonster(monster,index)
            ){ return false; }
            return true;
        });
    }
    function fallbackRelicVfxTarget(def,payload){
        const mode=def&&def.vfx&&def.vfx.defaultTarget||"allyAll";
        if(mode==="enemyAll"){
            return {targetSide:"monster",targetType:"all",targetId:null,targetIds:eligibleEnemyIndexesForRelicVfx(),category:"attack"};
        }
        if(mode==="singleEnemy"){
            const requested=payload&&Number.isInteger(payload.monsterIndex)?payload.monsterIndex:
                payload&&Number.isInteger(payload.targetIndex)?payload.targetIndex:null;
            const enemies=eligibleEnemyIndexesForRelicVfx();
            const targetId=requested!==null&&enemies.indexOf(requested)>=0?requested:(enemies.length?enemies[0]:null);
            return {targetSide:"monster",targetType:"single",targetId:targetId,targetIds:targetId===null?[]:[targetId],category:"attack"};
        }
        if(mode==="singleAlly"){
            const allies=partyIndexes().filter(index=>{ const character=characterAt(index); return character&&numeric(character.hp)>0; });
            const requested=payload&&Number.isInteger(payload.targetIndex)?payload.targetIndex:null;
            const targetId=requested!==null&&allies.indexOf(requested)>=0?requested:(allies.length?allies[0]:null);
            return {targetSide:"player",targetType:"single",targetId:targetId,targetIds:targetId===null?[]:[targetId],category:"buff"};
        }
        return {targetSide:"player",targetType:"allyAll",targetId:null,targetIds:partyIndexes().filter(index=>{ const character=characterAt(index); return character&&numeric(character.hp)>0; }),category:"buff"};
    }
    function normalizeRelicVfxOverride(override){
        if(!override||typeof override!=="object"){ return null; }
        const targetSide=override.targetSide==="monster"?"monster":"player";
        const targetType=String(override.targetType||"single");
        let ids=Array.isArray(override.targetIds)?override.targetIds.filter(Number.isInteger):[];
        if(!ids.length&&Number.isInteger(override.targetId)){ ids=[override.targetId]; }
        const targetId=targetType==="single"&&ids.length?ids[0]:null;
        return {targetSide:targetSide,targetType:targetType,targetId:targetId,targetIds:Array.from(new Set(ids)),category:override.category||"buff"};
    }
    function relicVfxTarget(def,triggerDef,payload,override){
        const forced=normalizeRelicVfxOverride(override);
        if(forced){ return forced; }
        const effects=triggerDef&&Array.isArray(triggerDef.effects)?triggerDef.effects:[];
        const types=effects.map(effectDef=>String(effectDef&&effectDef.type||""));
        if(types.some(type=>["damage_all_enemies","debuff_all_enemies","apply_status_all_enemies"].includes(type))){
            return {targetSide:"monster",targetType:"all",targetId:null,targetIds:eligibleEnemyIndexesForRelicVfx(),category:"attack"};
        }
        if(
            payload&&Number.isInteger(payload.targetIndex)&&
            types.some(type=>["heal_single_ally","restore_sp_single","shield_single","cleanse_single","prevent_death"].includes(type))
        ){
            return {targetSide:"player",targetType:"single",targetId:payload.targetIndex,targetIds:[payload.targetIndex],category:"buff"};
        }
        if(types.some(type=>["heal_all_allies","restore_sp_all","shield_all","buff_all","prepare_reflect"].includes(type))){
            return {targetSide:"player",targetType:"allyAll",targetId:null,targetIds:partyIndexes().filter(index=>{ const character=characterAt(index); return character&&numeric(character.hp)>0; }),category:"buff"};
        }
        return fallbackRelicVfxTarget(def,payload);
    }
    function relicPresentationDuration(def){
        return Math.max(520,numeric(def&&def.vfx&&def.vfx.durationMs)||RELIC_BALANCE_CONFIG.presentationDurationMs);
    }
    function playRelicVfx(def,triggerDef,payload,override,resolvedTarget){
        if(!def||!def.vfx||!hasLiveBattlePresentationHost()){ return null; }
        const director=window.v142SkillAnimationDirector;
        if(!director||typeof director.play!=="function"){ return null; }
        const target=resolvedTarget||relicVfxTarget(def,triggerDef,payload||{},override);
        if(!target||!target.targetIds.length){ return null; }
        const duration=relicPresentationDuration(def);
        const contract=Object.freeze({
            version:"battle-target-contract-v1",
            side:"player",
            targetSide:target.targetSide,
            targetType:target.targetType,
            actorIndex:0,
            targetId:target.targetId,
            targetIds:Object.freeze(target.targetIds.slice())
        });
        try{
            return director.play({
                id:def.id,name:def.name,element:def.vfx.element||"normal",
                category:target.category||"buff",targetType:target.targetType,
                duration:duration,resolveDuration:duration,tier:"relic",style:"relic"
            },{
                side:"player",actorIndex:0,targetSide:target.targetSide,
                targetId:target.targetId,targetIds:target.targetIds.slice(),
                targetContract:contract,
                key:"relic:"+String(currentBattleToken())+":"+def.id+":"+String(++relicVfxSequence)
            });
        }catch(error){
            console.error("秘寶 VFX 啟動失敗：",error);
            return null;
        }
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
    window.v174QueueRelicVisual=function(callback){ return queueRelicVisual(callback); };
    function flushRelicVisuals(list){ (list||[]).forEach(callback=>{ try{callback();}catch(error){console.error("秘寶視覺效果失敗：",error);} }); }
    function queueRelicPresentation(def,onStart,visualContext){
        if(!hasLiveBattlePresentationHost()){
            showBanner(def);
            if(typeof onStart==="function"){ onStart(); }
            return null;
        }
        const generation=relicPresentationGeneration;
        const token=currentBattleToken();
        const gate=currentAnimationGate();
        const previousTail=relicPresentationTail;
        const flow=window.FourSymbolsBattleFlow;
        const releasePresentationLock=flow&&typeof flow.acquirePresentationLock==="function"
            ?flow.acquirePresentationLock("team-relic")
            :function(){};
        relicPresentationLockReleases.add(releasePresentationLock);
        let presentationLockReleased=false;
        const unlockPresentation=()=>{
            if(presentationLockReleased){ return; }
            presentationLockReleased=true;
            relicPresentationLockReleases.delete(releasePresentationLock);
            releasePresentationLock();
        };
        let handoffReleased=false;
        const releaseHandoff=withProtection=>{
            if(handoffReleased){ return; }
            handoffReleased=true;
            releaseRelicPresentationHandoff(withProtection===true);
        };
        relicPresentationPending++;
        relicPresentationHandoffsPending++;
        let cinematicNode=null;
        let resolvedTarget=null;
        const job=Promise.resolve(previousTail).catch(()=>{}).then(()=>waitForAnimationRelease(gate)).then(()=>{
            if(generation!==relicPresentationGeneration||typeof battleActive!=="undefined"&&!battleActive||currentBattleToken()!==token){
                releaseHandoff(false);
                return null;
            }
            resolvedTarget=relicVfxTarget(
                def,
                visualContext&&visualContext.triggerDef,
                visualContext&&visualContext.payload||{},
                visualContext&&visualContext.override
            );
            if(!resolvedTarget||!resolvedTarget.targetIds.length){
                releaseHandoff(false);
                return null;
            }
            return beginRelicCinematic(def,resolvedTarget);
        }).then(node=>{
            if(!node){ return null; }
            cinematicNode=node;
            if(generation!==relicPresentationGeneration||typeof battleActive!=="undefined"&&!battleActive||currentBattleToken()!==token){
                releaseHandoff(false);
                cleanupRelicCutin();
                return null;
            }
            enterRelicVfxPhase(node);
            const relicGate=playRelicVfx(
                def,
                visualContext&&visualContext.triggerDef,
                visualContext&&visualContext.payload,
                visualContext&&visualContext.override,
                resolvedTarget
            );
            releaseHandoff(true);
            if(typeof onStart==="function"){ onStart(); }
            if(relicGate&&relicGate.promise){ return Promise.resolve(relicGate.promise).then(()=>node); }
            return waitMs(relicPresentationDuration(def)).then(()=>node);
        }).then(node=>{
            if(!node){ return; }
            return endRelicCinematic(node);
        }).catch(error=>{
            releaseHandoff(false);
            cleanupRelicCutin();
            console.error("秘寶演出序列失敗：",error);
        }).then(()=>{
            releaseHandoff(false);
            if(cinematicNode&&cinematicNode===relicCutinNode){ cleanupRelicCutin(); }
            if(generation===relicPresentationGeneration){ relicPresentationPending=Math.max(0,relicPresentationPending-1); }
            unlockPresentation();
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
        const def=id&&relicCatalog[id];
        return {relicId:def&&def.runtimeReady===true?id:null,subRelicId:null};
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
        if(teamLoadout.relicId){ preloadRelicVfx(teamLoadout.relicId); }
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
        node.innerHTML='<span class="team-relic-battle-icon"><img src="'+esc(def.battleIconPath||def.iconPath||"")+'" alt=""></span><b>秘寶・'+esc(def.name)+'</b>';
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
            flushRelicVisuals(preResolvedVisuals);
            battleLog(def.name+"｜"+currentEffectText(def,relicLevel(def.id)));
            if(typeof updateUI==="function"){ try{updateUI();}catch(_){ } }
        },{
            triggerDef:triggerDef,
            payload:payload||{}
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
            const visuals=[];
            const previousCollector=relicVisualCollector;
            relicVisualCollector=visuals;
            try{ resolveEffects(triggerDef,def,payload||{}); }
            finally{ relicVisualCollector=previousCollector; }
            if(typeof updateUI==="function"){ try{updateUI();}catch(_){ } }
            performRelicPresentation(def,triggerDef,payload||{},visuals);
            triggered=true;
        });
        return triggered;
    }

    function initializeBattleRelic(){
        relicBattleState=createBattleState(effectiveLoadoutRelicId());
        pendingBattleInit=false;
        if(relicBattleState.relicId){
            preloadRelicVfx(relicBattleState.relicId);
            const def=activeBattleRelic();
            if(def&&def.runtimeReady){
                dispatchRelicEvent("battle_start",{sourceType:"system"});
            }
        }
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
    if(window.FourSymbolsBattleFlow&&typeof window.FourSymbolsBattleFlow.subscribeRoundStart==="function"){
        window.FourSymbolsBattleFlow.subscribeRoundStart(()=>{
            if(typeof battleActive==="undefined"||!battleActive){ return; }
            if(pendingBattleInit||!relicBattleState||relicBattleState.battleToken!==currentBattleToken()){ initializeBattleRelic(); }
            cleanupPlayerMods();
            resetRoundCounters();
            dispatchRelicEvent("round_start",{sourceType:"system"});
        });
    }
    if(window.FourSymbolsBattleFlow&&typeof window.FourSymbolsBattleFlow.interceptActionFinish==="function"){
        window.FourSymbolsBattleFlow.interceptActionFinish(()=>{
            if(!hasLiveBattlePresentationHost()){ return false; }
            if(relicPresentationHandoffsPending<=0&&Date.now()>=relicMinVisualProtectionUntil){ return false; }
            relicFinishHeld=true;
            retryHeldBattleFinishWhenReady();
            return true;
        });
    }
    if(window.FourSymbolsBattleFlow&&typeof window.FourSymbolsBattleFlow.subscribeRoundEnd==="function"){
        window.FourSymbolsBattleFlow.subscribeRoundEnd(()=>{
            if(relicBattleState&&typeof battleActive!=="undefined"&&battleActive){
                dispatchRelicEvent("round_end",{sourceType:"system"});
            }
        });
    }

    function shouldHoldMonsterActionFinishForRelic(hardControlled){
        const def=activeBattleRelic();
        if(!def||!def.runtimeReady||!relicBattleState){ return false; }
        if(Object.keys(relicBattleState.reflectReady||{}).length){ return true; }
        return def.triggers.some((triggerDef,index)=>{
            const key=def.id+":"+(triggerDef.id||index);
            if(!canTrigger(triggerDef,key)){ return false; }
            if(triggerDef.type==="enemy_action_count"){
                return !hardControlled&&numeric(relicBattleState.enemyActionCount)+1>=numeric(triggerDef.threshold);
            }
            if(triggerDef.type==="ally_hit_count"){
                return numeric(relicBattleState.allyHitCount)+1>=numeric(triggerDef.threshold);
            }
            return false;
        });
    }

    if(typeof processSingleMonsterAttack==="function"){
        const previous=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const hardControlled=!!(monster&&((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||(typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))));
            const finishProbe=shouldHoldMonsterActionFinishForRelic(hardControlled);
            if(finishProbe){ relicPresentationHandoffsPending++; }
            try{
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
                            const visuals=[];
                            const previousCollector=relicVisualCollector;
                            relicVisualCollector=visuals;
                            let damage=0;
                            try{
                                damage=Math.max(1,Math.floor(getRelicPower(def.id)*numeric(reflect.multiplier)));
                                damageEnemy(monsterIndex,damage,"earth");
                            }finally{
                                relicVisualCollector=previousCollector;
                            }
                            queueRelicPresentation(def,()=>{
                                flushRelicVisuals(visuals);
                                battleLog(def.name+"反震"+damage+"點秘寶傷害。");
                                if(typeof updateUI==="function"){ try{updateUI();}catch(_){ } }
                            },{
                                payload:{monsterIndex:monsterIndex},
                                override:{targetSide:"monster",targetType:"single",targetId:monsterIndex,targetIds:[monsterIndex],category:"attack"}
                            });
                        }
                    }
                }
                return result;
            }finally{
                if(finishProbe){ releaseRelicPresentationHandoff(false); }
            }
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
    function statusOf(id){
        const state=playerRelics[id]||{unlocked:false,level:1,exp:0,seen:false};
        return isRelicDevTestingEnvironment()?Object.assign({},state,{unlocked:true,seen:true}):state;
    }
    function sortedRelics(){
        const equippedId=effectiveLoadoutRelicId();
        return RELIC_CATALOG_LIST.slice().sort((a,b)=>{
            const ae=equippedId===a.id?1:0,be=equippedId===b.id?1:0;if(ae!==be){return be-ae;}
            const au=statusOf(a.id).unlocked?1:0,bu=statusOf(b.id).unlocked?1:0;if(au!==bu){return bu-au;}
            const rr=numeric(RARITY_ORDER[b.rarity])-numeric(RARITY_ORDER[a.rarity]);if(rr){return rr;}
            return relicLevel(b.id)-relicLevel(a.id);
        });
    }
    function filterMatch(def){ return currentFilter==="all"||def.category===currentFilter||(def.tags||[]).includes(currentFilter); }
    function nextMilestone(def,level){ const keys=Object.keys(def.nextText||{}).map(Number).sort((a,b)=>a-b); return keys.find(value=>value>level)||null; }
    function currentEffectText(def,level){
        if(!def.runtimeReady){ return "秘寶能力尚未開放。"; }
        if(def.id==="relic_qiankun_flask"){ return "恢復全隊 "+valueFor(def,"healHpPercent",level).toFixed(1).replace(/\.0$/,"")+"%最大HP"+(level>=10?"，並恢復"+valueFor(def,"spPercent",level).toFixed(1).replace(/\.0$/,"")+"%最大SP":"")+"。"; }
        if(def.id==="relic_sun_orb"){
            const bonus=Math.round(valueFor(def,"burnBonus",level)*100);
            return "對敵方全體造成 "+valueFor(def,"damageMultiplier",level).toFixed(2)+"×秘寶威力"+(bonus>0?"；燃燒目標額外+"+bonus+"%":"")+"。";
        }
        if(def.id==="relic_xuanwu_seal"){ return "全隊獲得最大HP "+valueFor(def,"shieldPercent",level).toFixed(1).replace(/\.0$/,"")+"%護盾，持續2回合"+(level>=20?"，並獲得8%減傷1回合":"")+"。"; }
        if(def.id==="relic_soul_bell"){ return "敵方全體攻擊-"+Math.round(valueFor(def,"attackDown",level))+"%"+(level>=10?"、命中-"+Math.round(valueFor(def,"accuracyDown",level))+"%":"")+"，持續1回合。"; }
        if(def.id==="relic_tiangang_banner"){ return "對敵方全體造成 "+valueFor(def,"damageMultiplier",level).toFixed(2)+"×秘寶威力"+(level>=10?"並降攻"+Math.round(valueFor(def,"attackDown",level))+"%":"")+"。"; }
        if(def.id==="relic_nine_dragon_fire"){ return "對敵方全體造成 "+valueFor(def,"damageMultiplier",level).toFixed(2)+"×火屬性秘寶傷害"+(level>=10?"，燃燒機率"+Math.round(valueFor(def,"burnChance",level)*100)+"%":"")+(level>=20?"，對燃燒目標額外+15%":"")+"。"; }
        if(def.id==="relic_cold_spring_jade"){ return "急救目標 "+valueFor(def,"healHpPercent",level).toFixed(1).replace(/\.0$/,"")+"%最大HP"+(level>=10?"並淨化1個一般負面":"")+(level>=20?"、恢復4%最大SP":"")+"；HP由35%以上降至35%以下時觸發，每場最多2次，冷卻3回合。"; }
        if(def.id==="relic_qinglan_feather"){ return "全隊最終閃躲+"+Math.round(valueFor(def,"evasionBonus",level))+"個百分點、最終異常抗性+"+Math.round(valueFor(def,"resistanceBonus",level))+"個百分點，持續"+Math.round(valueFor(def,"duration",level))+"回合。"; }
        if(def.id==="relic_rock_mountain_seal"){ return "開場防禦+"+Math.round(valueFor(def,"defenseBonus",level))+"%持續3回合；受擊計數觸發時獲得"+Math.round(valueFor(def,"shieldPercent",level))+"%最大HP護盾"+(level>=20?"；Lv20護盾後準備一次18%秘寶威力反震，作用於下一名實際攻擊者":"")+"。"; }
        if(def.id==="relic_returning_wheel"){ return "阻止本場第一次死亡，保留1HP後恢復"+Math.round(valueFor(def,"healHpPercent",level))+"%最大HP並獲得"+Math.round(valueFor(def,"shieldPercent",level))+"%護盾。"; }
        return def.description;
    }

    function equipmentAllowed(){ return !(typeof battleActive!=="undefined"&&battleActive); }
    function equipRelic(id){
        const def=relicCatalog[id],owned=statusOf(id);
        if(!def||def.runtimeReady!==true||!owned.unlocked||!equipmentAllowed()){ return false; }
        preloadRelicVfx(id);
        teamLoadout.relicId=id;
        if(playerRelics[id]){ playerRelics[id].seen=true; }
        saveRelics();
        syncHomeRelicUi();
        renderRelicPage();
        return true;
    }
    function unequipRelic(){
        if(!equipmentAllowed()){ return false; }
        teamLoadout.relicId=null;
        saveRelics();
        syncHomeRelicUi();
        renderRelicPage();
        return true;
    }
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
        const owned=statusOf(def.id),equipped=effectiveLoadoutRelicId()===def.id;
        const canEquip=def.runtimeReady===true&&owned.unlocked&&equipmentAllowed();
        return '<div class="team-relic-card '+rarityClass(def)+(owned.unlocked?' unlocked':' locked')+(equipped?' equipped':'')+'">'+
            '<button type="button" class="team-relic-card-open-overlay" aria-label="查看'+esc(def.name)+'詳情" onclick="v174OpenRelicDetail(\''+esc(def.id)+'\')"></button>'+
            '<span class="team-relic-card-art">'+relicIconMarkup(def,false)+'</span>'+
            '<span class="team-relic-card-name">'+esc(def.name)+'</span>'+
            '<span class="team-relic-card-meta">'+(def.runtimeReady!==true?'效果尚未覺醒':(owned.unlocked?'Lv.'+owned.level:'尚未獲得'))+'・'+esc(CATEGORY_LABELS[def.category]||def.category)+'</span>'+
            (def.runtimeReady!==true
                ?'<button type="button" class="team-relic-equip" disabled>能力尚未開放</button>'
                :owned.unlocked
                    ?'<button type="button" class="team-relic-equip" '+(canEquip?'':'disabled')+' onclick="event.stopPropagation();v174EquipRelic(\''+esc(def.id)+'\')">'+(equipped?'已裝備':'裝備')+'</button>'
                    :'<button type="button" class="team-relic-equip" disabled>尚未獲得</button>')+
            (equipped?'<em>已裝備</em>':'')+
        '</div>';
    }
    function renderRelicList(){
        const equippedId=effectiveLoadoutRelicId();
        const ownedDef=equippedId&&relicCatalog[equippedId],ownedState=ownedDef&&statusOf(ownedDef.id);
        const current=ownedDef?'<div class="team-relic-current-card"><div class="team-relic-current-art">'+relicIconMarkup(ownedDef,true)+'</div><div class="team-relic-current-copy"><small>目前隊伍秘寶</small><b>'+esc(ownedDef.name)+' <span>Lv.'+ownedState.level+'</span></b><p>'+esc(currentEffectText(ownedDef,ownedState.level))+'</p></div><div class="team-relic-current-actions"><button onclick="v174UnequipRelic()">卸下</button><button onclick="v174OpenRelicDetail(\''+esc(ownedDef.id)+'\')">詳情</button></div></div>':
            '<div class="team-relic-current-card empty"><div class="team-relic-empty-slot">寶</div><div class="team-relic-current-copy"><small>目前隊伍秘寶</small><b>尚未裝備秘寶</b><p>每支隊伍只能啟用一件秘寶。</p></div><button class="team-relic-select-first" onclick="v174SetRelicFilter(\'all\')">選擇秘寶</button></div>';
        const filters=["all","attack","recovery","defense","buff","control","element","special"].map(key=>'<button class="'+(currentFilter===key?'active':'')+'" onclick="v174SetRelicFilter(\''+key+'\')">'+esc(CATEGORY_LABELS[key])+'</button>').join("");
        const cards=sortedRelics().filter(filterMatch).map(cardMarkup).join("");
        return '<div class="team-relic-page"><div class="team-relic-resource-line"><span>隊伍共用戰場神器</span><b>每支隊伍可裝備 1 件秘寶</b></div>'+current+
            '<div class="team-relic-tabs">'+filters+'</div><div class="team-relic-grid">'+cards+'</div></div>';
    }
    function detailMarkup(def){
        const owned=statusOf(def.id),level=owned.level,next=nextMilestone(def,level),cost=RELIC_BALANCE_CONFIG.upgradeGoldBase+RELIC_BALANCE_CONFIG.upgradeGoldPerLevel*level;
        const equipped=effectiveLoadoutRelicId()===def.id;
        const unavailable=def.runtimeReady!==true;
        return '<div class="team-relic-detail"><button class="team-relic-detail-back" onclick="v174OpenRelicPage()">‹ 返回秘寶列表</button><div class="team-relic-detail-hero '+rarityClass(def)+'">'+
            '<div class="team-relic-detail-art">'+relicIconMarkup(def,true)+'</div><h2>'+esc(def.name)+'</h2><p>'+esc(RARITY_LABELS[def.rarity]||def.rarity)+(unavailable?'・效果尚未覺醒':'・Lv.'+level+' / 20')+'</p><strong>'+esc(CATEGORY_LABELS[def.category]||def.category)+(def.tags&&def.tags.length?' / '+esc(def.tags.join('・')):'')+'</strong></div>'+
            (unavailable
                ?'<section><h3>秘寶能力</h3><p>秘寶能力尚未開放。正式 Trigger、Effect 與成長數值尚未定案，因此目前不可裝備或強化。</p></section>'
                :'<section><h3>觸發條件</h3><p>'+esc(def.triggerText||"尚未定義")+'</p></section><section><h3>秘寶效果</h3><p>'+esc(currentEffectText(def,level))+'</p></section><section><h3>觸發限制</h3><p>'+esc(def.limitText||"依秘寶設定。")+'</p></section>'+
                 '<section><h3>下一強化</h3><p>'+(level>=20?'已達最高等級。':next?'Lv.'+next+'：'+esc(def.nextText[next]):'下一個里程碑尚未到達；實際目前效果以本頁數值為準。')+'</p></section>'+
                 '<section class="team-relic-upgrade"><h3>強化</h3><p>目前 Lv.'+level+' → '+(level>=20?'MAX':'Lv.'+(level+1))+'</p><p>依目前正式秘寶養成規則消耗對應素材。</p><b>金幣 '+cost.toLocaleString("zh-TW")+'</b></section>')+
            '<div class="team-relic-detail-actions">'+
            (unavailable?'<button disabled>能力尚未開放</button>':
                (owned.unlocked&&level<20?'<button onclick="v174UpgradeRelic(\''+esc(def.id)+'\')">強化</button>':'')+
                (owned.unlocked?'<button onclick="v174EquipRelic(\''+esc(def.id)+'\')">'+(equipped?'已裝備':'裝備')+'</button>':'<button disabled>尚未獲得</button>'))+
            '</div></div>';
    }

    function modalNodes(){ return {modal:document.getElementById("homeFeatureModal"),body:document.getElementById("homeFeatureModalBody"),title:document.getElementById("homeFeatureModalTitle")}; }
    function renderRelicLoading(nodes){ nodes.modal.classList.remove("team-relic-detail-mode"); nodes.body.innerHTML='<div class="team-relic-loading" role="status" aria-live="polite">正在載入秘寶…</div>'; }
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
        currentDetailId=null; const nodes=prepareRelicModal(); if(!nodes){return false;} renderRelicLoading(nodes);
        prepareRelicVisuals().then(async()=>{if(!nodes.modal.classList.contains("team-relic-modal")){return;}Object.values(playerRelics).forEach(state=>{if(state.unlocked){state.seen=true;}});saveRelics();nodes.modal.classList.remove("team-relic-detail-mode");nodes.body.innerHTML=renderRelicList();await nextVisualPaint();try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:relic-visual-ready");}}catch(_){ }syncHomeRelicUi();}).catch(error=>{nodes.body.innerHTML='<div class="team-relic-loading team-relic-loading-error" role="alert">秘寶載入失敗。<button type="button" onclick="v174OpenRelicPage()">重新載入</button></div>';document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:"relic",error}}));});
        return true;
    }
    function openRelicDetail(id){ const def=relicCatalog[id]; if(!def){return false;} currentDetailId=id; const nodes=prepareRelicModal(); if(!nodes){return false;} renderRelicLoading(nodes); prepareRelicVisuals().then(async()=>{if(!nodes.modal.classList.contains("team-relic-modal")||currentDetailId!==id){return;}nodes.modal.classList.add("team-relic-detail-mode");nodes.body.innerHTML=detailMarkup(def);await nextVisualPaint();try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:relic-visual-ready");}}catch(_){ }}).catch(error=>{nodes.body.innerHTML='<div class="team-relic-loading team-relic-loading-error" role="alert">秘寶載入失敗。<button type="button" onclick="v174OpenRelicPage()">重新載入</button></div>';document.dispatchEvent(new CustomEvent("four-symbols:feature-local-error",{detail:{feature:"relic",error}}));});return true; }
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
        const summary=window.FourSymbolsHomeRelicSummary;
        if(summary&&typeof summary.sync==="function"){ summary.sync(); }
    }

    if(typeof openHomeFeature==="function"){
        const previous=openHomeFeature;
        openHomeFeature=function(type){ if(type==="relic"){ return openRelicPage(); } return previous.apply(this,arguments); };
    }
    if(typeof closeHomeFeature==="function"){
        const previous=closeHomeFeature;
        closeHomeFeature=function(){ const modal=document.getElementById("homeFeatureModal"); if(modal){modal.classList.remove("team-relic-modal"); const box=modal.querySelector(".home-feature-modal-box");if(box){box.classList.remove("wide");}} currentDetailId=null; return previous.apply(this,arguments); };
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
    if(isRelicDevTestingEnvironment()){
        window.v174RelicDevUnlockAllForTesting=function(){
            syncHomeRelicUi(); renderRelicPage();
            return RELIC_CATALOG_LIST.map(def=>({id:def.id,unlocked:true,seen:true,runtimeReady:def.runtimeReady,battleIconPath:def.battleIconPath}));
        };
        window.v174RelicDevPreviewPresentation=function(id){
            const def=relicCatalog[id];
            if(!def||typeof battleActive==="undefined"||!battleActive){ return false; }
            preloadRelicVfx(def);
            queueRelicPresentation(def,()=>battleLog(def.name+"｜DEV 戰鬥演出預覽"),{payload:{sourceType:"dev-presentation"}});
            return true;
        };
    }
    window.v174RelicDebugDispatch=dispatchRelicEvent;
    window.v174RelicDebugState=function(){ return relicBattleState?JSON.parse(JSON.stringify(relicBattleState)):null; };
    window.v174RelicPresentationState=function(){ return {active:relicPresentationPending>0,pending:relicPresentationPending,generation:relicPresentationGeneration}; };
    try{if(performance&&typeof performance.mark==="function"){performance.mark("four-symbols:relic-runtime-ready");}}catch(_){ }
    window.v174RelicSystem=Object.freeze({
        catalog:relicCatalog,balance:RELIC_BALANCE_CONFIG,rarityLabels:RARITY_LABELS,categoryLabels:CATEGORY_LABELS,
        cutinDurationMs:RELIC_CUTIN_DURATION_MS,minVisualProtectionMs:RELIC_MIN_VISUAL_PROTECTION_MS,
        getRelicPower:getRelicPower,getOwnedState:()=>playerRelics,getTeamLoadout:()=>teamLoadout,
        getEffectiveRelicId:effectiveLoadoutRelicId,isDevTesting:isRelicDevTestingEnvironment,
        isPresentationActive:()=>relicPresentationPending>0,
        dispatch:dispatchRelicEvent
    });

    if(typeof document!=="undefined"){
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>setTimeout(syncHomeRelicUi,0),{once:true}); }
        else{ setTimeout(syncHomeRelicUi,0); }
    }
})();
