"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=path=>fs.readFileSync(path,"utf8");
const main=read("js/00-main.js");
const economy=read("js/28-v133-economy-rebalance.js");
const shop=read("js/40-v144-rules-and-abyss.js");
const shopUi=read("js/41-v146-system-polish.js");
const elementBox=read("js/45-v154-dev-fixes.js");
const adventure=read("js/adventure/adventure-runtime-v1-20260915.js");
const city=read("js/16-stage-v54-main-city-runtime.js");
const cityCss=read("css/19-stage-v54-main-city-moderate-native-scale.css");
const relic=read("js/60-team-relic-system.js");
const relicCss=read("css/55-team-relic-system.css");
const featureIntent=read("js/20-anonymous-20.js");

function sliceThrough(source,startToken,endToken){
    const start=source.indexOf(startToken);
    assert.ok(start>=0,"missing start token: "+startToken);
    const end=source.indexOf(endToken,start);
    assert.ok(end>=0,"missing end token: "+endToken);
    return source.slice(start,end+endToken.length);
}

function emitter(){
    const listeners=new Map();
    return {
        on(type,fn){ if(!listeners.has(type)){listeners.set(type,[]);} listeners.get(type).push(fn); },
        emit(type,event={}){ for(const fn of listeners.get(type)||[]){ fn(Object.assign({type},event)); } }
    };
}

test("mobile lifecycle diagnostics distinguish reload/discard metadata while background saving",()=>{
    const source=sliceThrough(main,'const STARTUP_SESSION_READY_KEY="sixiang_startup_session_ready_v1";',"})();");
    const documentEvents=emitter(),windowEvents=emitter();
    let saves=0;
    const startup={hidden:false,dataset:{},setAttribute(){}};
    const document={
        hidden:false,
        wasDiscarded:true,
        addEventListener:(type,fn)=>documentEvents.on(type,fn),
        getElementById:id=>id==="startupLoader"?startup:null
    };
    const sessionStorage={value:"1",getItem(){return this.value;},setItem(_k,v){this.value=v;}};
    const window={
        document,sessionStorage,
        FourSymbolsStartupPolicy:{getState:()=>"READY"},
        performance:{getEntriesByType:type=>type==="navigation"?[{type:"reload"}]:[]},
        addEventListener:(type,fn)=>windowEvents.on(type,fn)
    };
    const context={window,document,Date,Number,Object,String,Boolean,Promise,sessionStorage,saveGame(){saves++;return true;}};
    vm.runInNewContext(source,context,{filename:"mobile-lifecycle-snippet.js"});

    const first=window.FourSymbolsMobileLifecycleDiagnostics.getSnapshot();
    assert.equal(first.wasDiscarded,true);
    assert.equal(first.navigationType,"reload");
    assert.equal(first.sessionPreviouslyEntered,true);
    assert.equal(startup.hidden,true,"same-tab entered session may skip the long presentation shell only");

    document.hidden=true;
    documentEvents.emit("visibilitychange");
    assert.equal(saves,1,"hidden transition must save immediately");
    documentEvents.emit("freeze");
    assert.equal(saves,2,"freeze must save immediately when supported");
    windowEvents.emit("pagehide",{persisted:false});
    assert.equal(saves,3,"pagehide must save immediately");

    const beforePageShow=saves;
    windowEvents.emit("pageshow",{persisted:true});
    documentEvents.emit("resume");
    assert.equal(saves,beforePageShow,"ordinary resume/pageshow must not rerun save/startup work");
    const final=window.FourSymbolsMobileLifecycleDiagnostics.getSnapshot();
    assert.equal(final.lastEvent,"resume");
    assert.equal(final.eventCounts.pageshow,1);
    assert.equal(final.eventCounts.resume,1);
    assert.equal(final.backgroundSaveCount,3);
});

test("shop quantity has one 999 normalizer and all final purchase math uses the normalized quantity",()=>{
    const quantitySource=sliceThrough(
        economy,
        "const SHOP_PURCHASE_MAX_QUANTITY=999;",
        "window.v133NormalizeShopQuantityInput=function(input,options){\n        if(!input){ return 1; }\n        const commit=!!(options&&options.commit);\n        const raw=String(input.value==null?\"\":input.value).trim();\n        if(raw===\"\"&&!commit){ return null; }\n        const quantity=normalizeShopPurchaseQuantity(raw);\n        input.value=String(quantity);\n        return quantity;\n    };"
    );
    const context={window:{},Number,Math,String};
    vm.runInNewContext(quantitySource,context,{filename:"shop-quantity-snippet.js"});
    assert.equal(context.normalizeShopPurchaseQuantity(1),1);
    assert.equal(context.normalizeShopPurchaseQuantity(999),999);
    assert.equal(context.normalizeShopPurchaseQuantity(1000),999);
    assert.equal(context.normalizeShopPurchaseQuantity(99999999),999);
    const input={value:"1000"};
    assert.equal(context.window.v133NormalizeShopQuantityInput(input),999);
    assert.equal(input.value,"999","visible input must immediately show 999");

    input.value="";
    assert.equal(context.window.v133NormalizeShopQuantityInput(input),null,"empty field remains a temporary editing draft");
    assert.equal(input.value,"","the default 1 must be deletable");
    assert.equal(context.window.v133NormalizeShopQuantityInput(input,{commit:true}),1);
    assert.equal(input.value,"1","blur/commit restores the minimum only after editing ends");

    assert.doesNotMatch(economy,/max="9999"|Math\.min\(9999/);
    assert.doesNotMatch(shop,/max="9999"|Math\.min\(9999/);
    assert.doesNotMatch(shopUi,/Math\.min\(9999/);
    assert.match(shop,/max="999"/);
    assert.match(shop,/oninput="v146UpdateShopTotal/);
    assert.match(shop,/onblur="v146CommitShopQuantity/);
    assert.match(shopUi,/raw===""[\s\S]*?output\.textContent="— 金幣"/);
    assert.match(shopUi,/function\(itemId\)[\s\S]*?input\.value="1"/);
    assert.match(shop,/window\.normalizeShopPurchaseQuantity\(requestedQuantity\)/);
    assert.match(shop,/const totalPrice=unitPrice\*quantity/);
    assert.match(shop,/addPotionToInventory\(itemId,quantity\)/);
    assert.match(shop,/目前金幣/);
});

function recoveryHarness({hp,sp=100,hpPotion=true,spPotion=true,returnToCityWhenEmpty=false}){
    const source=sliceThrough(
        elementBox,
        "function finishAutoRecovery(){",
        "window.v154FinishAutoRecovery=finishAutoRecovery;"
    );
    const character={id:"測試俠",hp,sp};
    let hpAttempts=0,spAttempts=0;
    const context={
        window:null,Number,Math,Array,Object,String,
        getExistingPartyIndexes:()=>[0],
        getPartyCharacterByIndex:()=>character,
        getPartyAutoConfig:()=>({enabled:true,hp:50,sp:25,returnToCityWhenEmpty}),
        getPartyBattleStats:()=>({maxHP:100,maxSP:100}),
        isElementBoxRecoveryActive:()=>true,
        normalizeAutoBattleThreshold:value=>Number(value),
        getAutoPotionId:resource=>resource==="hp"?"hpPotion":"spPotion",
        getPotionDefinition:id=>({id,recoveryPercent:50}),
        consumePotionFromInventory(id){
            if(id==="hpPotion"){hpAttempts++;return hpPotion;}
            spAttempts++;return spPotion;
        },
        rebuildInventorySlots(){},
        logElementBoxRecovery(){},
        battleActive:false
    };
    context.window=context;
    vm.runInNewContext(source,context,{filename:"element-box-recovery-snippet.js"});
    return {context,character,get hpAttempts(){return hpAttempts;},get spAttempts(){return spAttempts;}};
}

test("element box can revive HP=0 only by consuming configured HP potions",()=>{
    const withPotion=recoveryHarness({hp:0,hpPotion:true});
    assert.ok(withPotion.context.v154FinishAutoRecovery()>0);
    assert.ok(withPotion.character.hp>0,"HP=0 character must become alive only after potion recovery");
    assert.ok(withPotion.hpAttempts>0,"HP recovery must really consume the HP potion path");

    const withoutPotion=recoveryHarness({hp:0,sp:0,hpPotion:false,spPotion:true});
    assert.equal(withoutPotion.context.v154FinishAutoRecovery(),0);
    assert.equal(withoutPotion.character.hp,0,"missing HP potion must never grant free revival");
    assert.equal(withoutPotion.spAttempts,0,"SP potion must not be consumed while the character is still dead");

    const living=recoveryHarness({hp:30,hpPotion:true});
    living.context.v154FinishAutoRecovery();
    assert.ok(living.character.hp>30,"living characters still follow the existing threshold recovery");
});

test("Adventure return uses the formal Patrol exit owner and stale fight callbacks revalidate context",()=>{
    assert.match(adventure,/FourSymbolsPatrolLifecycle[\s\S]{0,220}\.exit\("adventure-return"\)/);
    assert.match(main,/window\.FourSymbolsPatrolLifecycle=Object\.freeze/);
    assert.match(main,/function exitPatrolContext\(reason\)[\s\S]{0,180}stopMonsterMovement\(\);[\s\S]{0,100}stopAutoPatrol\(\)/);
    assert.match(main,/patrolFightAnimTimeoutIds\.forEach\([\s\S]{0,100}clearTimeout/);
    assert.match(main,/const transitionGeneration=[\s\S]{0,80}patrolLifecycleGeneration/);
    assert.match(main,/transitionGeneration!==patrolLifecycleGeneration[\s\S]{0,120}!autoPatrolEnabled[\s\S]{0,120}!isPatrolMapActive\(\)/);
    assert.doesNotMatch(adventure,/autoPatrolEnabled\s*=|clearTimeout\(autoPatrolTimeoutId|clearInterval\(patrolWalkIntervalId/);
});

test("NT$99 service info is manual-only with no startup/pageshow/mutation auto-show lifecycle",()=>{
    assert.match(city,/AD_FREE_DISPLAY_POLICY=Object\.freeze\(\{mode:"manual"\}\)/);
    assert.match(city,/window\.openAdFreeServiceInfoModal=openAdFreeServiceInfoModal/);
    assert.doesNotMatch(city,/scheduleAutoShowAdFreeServiceInfo|tryAutoShowAdFreeServiceInfo|shouldAutoShowAdFreeServiceInfo|armAdFreeServiceInfo/);
    assert.doesNotMatch(city,/MutationObserver/);
    assert.doesNotMatch(city,/pageshow[\s\S]{0,160}AdFree|startup-entered[\s\S]{0,160}AdFree/);
});

test("main-city roster and relic summary are first-screen stable without executing feature-boss-relic",()=>{
    assert.match(city,/function ensureHomeRosterShell\(\)/);
    assert.match(city,/homeRosterPlaceholder/);
    assert.match(city,/team-relic-loadout-slot/);
    assert.match(city,/HOME_RELIC_SUMMARY_CATALOG/);
    assert.match(city,/FourSymbolsHomeRelicSummary/);
    assert.match(city,/function boot\(\)[\s\S]{0,180}ensureHomeRosterShell\(\)/);
    assert.match(cityCss,/team-relic-loadout-slot/);
    assert.match(cityCss,/team-relic-loadout-slot\{[\s\S]{0,180}min-height:44px/);
    assert.match(cityCss,/team-relic-loadout-slot>small\{display:none;\}/);
    assert.match(cityCss,/team-relic-loadout-slot>button\{[^}]*height:30px;[^}]*min-height:30px;/);
    assert.doesNotMatch(relic,/createElement\("div"\)[\s\S]{0,180}team-relic-loadout-slot/);
    assert.doesNotMatch(relicCss,/team-relic-loadout-slot/);
    assert.doesNotMatch(featureIntent,/ensure\("relic","home-utilities"\)/);
    assert.match(relic,/FourSymbolsHomeRelicSummary[\s\S]{0,120}summary\.sync\(\)/);
});

console.log("✓ mobile lifecycle / shop / element box / patrol / ad-free / main-city targeted regressions");
