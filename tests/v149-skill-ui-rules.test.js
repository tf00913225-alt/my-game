/* HISTORICAL SPEC SNAPSHOT (V149): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const css=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const animationSource=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }
function assertArray(actual,expected,message){ assert.deepEqual(Array.from(actual),expected,message); }

const DEFINITIONS={
    flameSlash:["火焰斬","fire","physical"],fireCritical:["會心一擊","fire","physical"],
    explosiveFlurry:["火爆亂擊","fire","physical"],dragonSlash:["霸龍裂天斬","fire","physical"],
    fireRocket:["火箭","fire","magic"],blazeSpell:["烈火術","fire","magic"],
    flameTornado:["烈焰龍捲","fire","magic"],phoenixCry:["火鳳天鳴","fire","magic"],
    rage:["怒火","fire","buff"],fireEX:["火元素EX","fire","passive"],
    waterKnife:["水刀斬","water","physical"],frostPunch:["冰霜拳","water","physical"],
    iceSpin:["冰旋一閃","water","physical"],frostCrush:["冰封重擊","water","physical"],
    waterBall:["水球術","water","magic"],floodBeast:["洪水猛獸","water","magic"],
    iceArrowRain:["冰霜箭雨","water","magic"],freeze:["冰封","water","magic"],
    healSpell:["治療術","water","heal"],revive:["復活術","water","revive"],waterEX:["水元素EX","water","passive"],
    stormFist:["暴風拳","wind","physical"],stormFlurry:["暴風亂擊","wind","physical"],
    windCrossSlash:["風旋十字斬","wind","physical"],dizzyFist:["暈眩猛擊","wind","physical"],
    windSpell:["狂風術","wind","magic"],stormCircle:["風焰術","wind","magic"],
    windHowlLightning:["風哮電擊","wind","magic"],stormRain:["風起雲湧","wind","magic"],
    dodgeSkill:["閃躲術","wind","buff"],stealthSkill:["隱身術","wind","buff"],
    dinghaishenzhen:["氣定神閒","wind","buff"],windEX:["風元素EX","wind","passive"],
    stoneSlash:["土石斬","earth","physical"],petrifyFist:["石盾拳","earth","physical"],
    stoneBreakSky:["石破天驚","earth","physical"],earthquakeCrush:["地裂重拳","earth","physical"],
    stoneThrow:["落石術","earth","magic"],sandWind:["滾石術","earth","magic"],
    flyingSandStrike:["飛沙瞬擊","earth","magic"],dustStorm:["地牛猛襲","earth","magic"],
    earthShield:["萬象土盾","earth","buff"],rockWall:["岩石壁壘","earth","buff"],
    barrier:["結界","earth","buff"],earthEX:["土元素EX","earth","passive"]
};

function database(){
    return Object.fromEntries(Object.entries(DEFINITIONS).map(([id,data])=>[
        id,{id,name:data[0],element:data[1],category:data[2],targetType:"single",statusEffects:[]}
    ]));
}

function bareDocument(overrides={}){
    return Object.assign({
        readyState:"complete",body:{},getElementById:()=>null,querySelector:()=>null,
        querySelectorAll:()=>[],addEventListener(){},createElement:()=>({})
    },overrides);
}

function load(overrides={}){
    const context=Object.assign({
        window:null,console,Math,Date,Number,Object,Array,Set,Map,Promise,
        skillDatabase:database(),document:bareDocument(),
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback()
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

function compact(skill){
    return [skill.learnCost,skill.maxLevel,skill.targetType,
        skill.baseDamage===undefined?null:skill.baseDamage,
        skill.damagePerLevel===undefined?null:skill.damagePerLevel,
        skill.spCost===undefined?null:skill.spCost];
}

test("V149 remains ordered, cache-busted, and keeps city/nav shop art distinct",()=>{
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.35/);
assert.match(index,/js\/01-stage-v8-touch-lock\.js\?v=173\.35/);
    assert.match(index,/id="homeIconShop"[\s\S]*assets\/ui\/home-shop\.png/);
    assert.doesNotMatch(index,/id="homeIconShop"[\s\S]{0,180}home-shop-v147\.png/);
    assert.match(loader,/const V_ASSET_VERSION="173\.35"/);
    assert.match(loader,/css\/44-v149-skill-ui-rules\.css/);
    const v148=loader.indexOf("js/42-v148-combat-dungeon-fixes.js");
    const v149=loader.indexOf("js/43-v149-skill-ui-rules.js");
    assert.ok(v148>=0&&v149>v148);
    assert.match(css,/grid-template-columns:auto 46px minmax\(0,1fr\)/);
    assert.match(css,/shop-potion-buy[\s\S]*grid-column:1 \/ -1/);
    assert.match(css,/max-width:396px/);
});

test("the Fire, Wind and Earth owner matches the authoritative costs, targets and damage",()=>{
    const s=load().skillDatabase;
    const expected={
        flameSlash:[2,5,"single",30,6,10],fireCritical:[10,5,"single",45,9,28],
        explosiveFlurry:[20,5,"tri",50,10,47],dragonSlash:[35,5,"single",165,33,65],
        fireRocket:[2,5,"tri",13,4,10],blazeSpell:[10,5,"single",45,9,28],
        flameTornado:[30,5,"single",150,30,47],phoenixCry:[35,5,"all",28,6,60],
        rage:[25,5,"allyTri",null,null,50],fireEX:[25,1,"none",null,null,null],
        stormFist:[2,5,"single",26,6,7],stormFlurry:[10,5,"tri",13,3,20],
        windCrossSlash:[15,5,"single",128,26,39],dizzyFist:[30,5,"single",141,29,55],
        windSpell:[2,5,"tri",12,3,9],stormCircle:[10,5,"tri",14,4,18],
        windHowlLightning:[15,5,"single",128,26,55],stormRain:[30,5,"all",24,5,75],
        dodgeSkill:[10,1,"allyTri",null,null,20],
        stealthSkill:[15,1,"ally",null,null,45],dinghaishenzhen:[20,1,"allyAll",null,null,77],
        windEX:[25,1,"none",null,null,null],stoneSlash:[2,5,"single",26,6,7],
        petrifyFist:[10,5,"tri",13,3,26],stoneBreakSky:[15,5,"single",128,26,42],
        earthquakeCrush:[30,5,"tri",47,9,55],stoneThrow:[2,5,"tri",12,3,7],
        sandWind:[10,5,"tri",14,4,19],flyingSandStrike:[15,5,"all",24,5,55],
        dustStorm:[30,5,"single",140,28,65],earthShield:[10,1,"allyTri",null,null,66],
        rockWall:[15,1,"allyTri",null,null,45],barrier:[20,1,"ally",null,null,40],
        earthEX:[25,1,"none",null,null,null]
    };
    assert.equal(Object.keys(expected).length,34);
    Object.entries(expected).forEach(([id,value])=>assert.deepEqual(compact(s[id]),value,id));
    assert.equal(s.waterKnife.baseDamage,undefined,"Water data is owned only by js/50");
});

test("every special percentage, duration and prerequisite is exact",()=>{
    const s=load().skillDatabase;
    assert.deepEqual([s.dragonSlash.followUpOnCriticalOrDefeat,s.dragonSlash.followUpMaxCasts],[true,2]);
    assertArray(s.flameTornado.burnPercentByLevel,[3,4,5,6,7]);
    assert.deepEqual([s.flameTornado.burnChance,s.flameTornado.guaranteedBurn,s.flameTornado.burnDuration],[100,true,1]);
    assert.deepEqual([s.phoenixCry.burnChance,s.phoenixCry.burnDuration,s.phoenixCry.burnBonusThreshold,s.phoenixCry.nextRoundDamageBonusPercent],[40,2,3,30]);
    assertArray(s.phoenixCry.burnPercentByLevel,[5,7,9,11,13]);
    assertArray(s.rage.critChanceBonusByLevel,[5,10,15,20,25]);
    assertArray(s.rage.critDamageBonusByLevel,[10,20,30,40,50]);
    assert.deepEqual([s.fireEX.damageBonusPercent,s.fireEX.critChanceBonusPercent,s.fireEX.critDamageBonusPercent,s.fireEX.statusTargetDamageBonusPercent],[10,5,5,5]);
    assertArray(s.stormFist.agilityDownByLevel,[30,40,50,60,70]);
    assertArray(s.stormFlurry.damageDownByLevel,[10,20,30,40,50]);
    assertArray(s.windCrossSlash.damageDownByLevel,[20,30,35,40,50]);
    assertArray(s.dizzyFist.missBonusByLevel,[30,45,50,55,65]);
    assertArray(s.stormRain.missBonusByLevel,[30,45,50,55,65]);
    assert.deepEqual([s.dodgeSkill.evasionBonusPercent,s.dodgeSkill.duration],[75,3]);
    assert.deepEqual([s.dinghaishenzhen.statusResistBonus,s.dinghaishenzhen.accuracyBonusPercent,s.dinghaishenzhen.duration],[65,50,3]);
    assert.equal(s.windEX.evasionBonusPercent,35);
    assertArray(s.petrifyFist.selfShieldByLevel,[100,125,150,175,200]);
    assertArray(s.stoneBreakSky.selfShieldByLevel,[100,125,150,175,200]);
    assertArray(s.earthquakeCrush.petrifyChanceByLevel,[30,35,40,45,50]);
    assertArray(s.flyingSandStrike.defenseDownByLevel,[10,15,20,25,35]);
    assertArray(s.dustStorm.petrifyChanceByLevel,[20,25,30,35,45]);
    assert.deepEqual([s.earthShield.reflectPercent,s.earthShield.duration],[50,3]);
    assert.deepEqual([s.rockWall.defenseBonusPercent,s.rockWall.duration],[35,4]);
    assert.deepEqual([s.barrier.barrierBlockCount,s.barrier.duration],[5,5]);
    assert.equal(s.earthEX.defenseBonusPercent,35);
    assertArray(s.rage.requires,["explosiveFlurry","flameTornado"]);
    assertArray(s.earthShield.requires,["stoneBreakSky","flyingSandStrike"]);
});

test("Frostbite rejects skills but allows normal actions and auto falls back",()=>{
    const party=[{id:"甲",hp:100,activeBuffs:[],statusEffects:[{type:"frostbite",turnsLeft:2}]}];
    let prepared=0,finished=0,misses=0,legacyResolved=0;
    const queued={0:{action:"iceSpin",target:0}};
    const context=load({
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:index=>party[index],
        activeBattleCharacterIndex:0,queuedPlayerActions:queued,
        prepareAction(){ prepared++; },resolveQueuedPlayerAction(){ legacyResolved++; },
        autoActionForCharacter(){ queued[0]={action:"iceSpin",target:0}; },
        finishPlayerAction(){ finished++; },showMissEffect(){ misses++; },addBattleLog(){}
    });
    context.prepareAction("iceSpin");
    context.prepareAction("normal");
    assert.equal(prepared,1,"normal action remains available");
    context.resolveQueuedPlayerAction(0,1);
    assert.equal(legacyResolved,0);
    assert.equal(finished,1,"a queued skill consumed by Frostbite ends once");
    context.autoActionForCharacter(0,1);
    assert.equal(queued[0].action,"normal");
    assert.equal(misses,2);
});

test("differently named buffs no longer reject or overwrite one another",()=>{
    const party=[
        {id:"甲",hp:500,sp:200,activeBuffs:[],statusEffects:[]},
        {id:"乙",hp:500,sp:200,activeBuffs:[{type:"barrier",turnsLeft:5,remainingBlocks:5}],statusEffects:[]}
    ];
    let legacy=0,finished=0,misses=0;
    const queued={0:{action:"dodgeSkill",targetAlly:null}};
    const context=load({
        getExistingPartyIndexes:()=>[0,1],getPartyCharacterByIndex:index=>party[index],
        queuedPlayerActions:queued,resolveQueuedPlayerAction(){ legacy++; },
        isValidAllyTargetForSkill:()=>true,
        finishPlayerAction(){ finished++; },showMissEffect(){ misses++; },addBattleLog(){},updateUI(){}
    });
    context.resolveQueuedPlayerAction(0,1);
    assert.equal(legacy,1);
    assert.equal(finished,0);
    assert.equal(misses,0);
    assert.equal(party[0].sp,200);
    assert.equal(context.isValidAllyTargetForSkill(context.skillDatabase.dodgeSkill,party[1],1),true,
        "a target with Barrier remains legal for the differently named Wind Walker state");
    assert.equal(context.v149GetBuffConflictTargets,undefined);
});

test("Fire EX adds five percent only when its target has an abnormal status",()=>{
    const party=[{id:"火俠",element:"fire",hp:100,sp:100,activeBuffs:[],statusEffects:[]}];
    const target={hp:100,alive:true,statusEffects:[{type:"burn",turnsLeft:2}]};
    const context={
        window:null,console,Math,Date,Number,Object,Array,Set,Map,Promise,
        skillDatabase:database(),document:bareDocument(),damageTarget:target,
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:index=>party[index],
        getPartyCharacterKey:()=>"fire",getSkillLevel:(key,id)=>id==="fireEX"?1:1,
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback()
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext("calculateSkillDamage=function(){return 100}; castDamageSkill=function(){return calculateSkillDamage(1,1,damageTarget,1,'fire')}",context);
    vm.runInContext(source,context);
    assert.equal(context.castDamageSkill("flameSlash"),105);
    target.statusEffects=[];
    assert.equal(context.castDamageSkill("flameSlash"),100);
});

test("Flood Beast never performs the obsolete all-enemy Freeze sweep",()=>{
    const party=[{id:"水俠",element:"water",hp:100,sp:100,activeBuffs:[],statusEffects:[]}];
    const monsters=[
        {name:"甲怪",alive:true,hp:100,level:1,spiritPoints:0,statusEffects:[]},
        {name:"乙怪",alive:true,hp:100,level:1,spiritPoints:0,statusEffects:[]}
    ];
    const context={
        window:null,console,Math,Date,Number,Object,Array,Set,Map,Promise,
        skillDatabase:database(),document:bareDocument(),monsters,currentBattleMonsters:[0,1],
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:index=>party[index],
        rollStatusEffectHit(){ throw new Error("legacy team Freeze must not roll"); },
        getMonsterEffectiveSpiritPoints:()=>0,getMonsterRank:()=>"regular",
        applyFreezeEffect(entity,duration){ entity.statusEffects.push({type:"freeze",turnsLeft:duration}); },
        addBattleLog(){},setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback()
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext("applySkillDebuffEffects=function(){}; castDamageSkill=function(){applySkillDebuffEffects(skillDatabase.floodBeast,1,monsters[0],0,1,1)}",context);
    vm.runInContext(source,context);
    context.castDamageSkill("floodBeast");
    assert.deepEqual(monsters.map(monster=>monster.statusEffects),[[],[]]);
    assert.doesNotMatch(source,/applyTeamFreezeToMonsters|applyTeamFreezeToPlayers/);
});

test("Dragon Slash follows up after an initial critical without charging SP twice",()=>{
    const math=Object.create(Math); math.random=()=>0;
    let finishes=0;
    const player={id:"火俠",element:"fire",hp:100,sp:200,activeBuffs:[],statusEffects:[]};
    const monsters=[
        {name:"敵人甲",alive:true,hp:100,statusEffects:[]},
        {name:"敵人乙",alive:true,hp:100,statusEffects:[]}
    ];
    const targets=[];
    const context={
        window:null,console,Math:math,Date,Number,Object,Array,Set,Map,Promise,
        skillDatabase:database(),document:bareDocument(),player,monsters,targets,currentBattleMonsters:[0,1],selectedMonster:1,
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>player,
        castCount:0,battleActive:true,rollCritical(){ return {isCrit:context.castCount===1,multiplier:1}; },
        finishPlayerAction(){ finishes++; },
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback()
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext("castDamageSkill=function(id){player.sp-=skillDatabase[id].spCost;targets.push(selectedMonster);castCount++;rollCritical();finishPlayerAction()}",context);
    vm.runInContext(source,context);
    context.castDamageSkill("dragonSlash");
    assert.equal(context.castCount,2);
    assert.equal(player.sp,135);
    assert.equal(finishes,1);
    assert.deepEqual(targets,[1,1]);
});

test("Dragon Slash adds a second repeat when the first repeat is critical",()=>{
    const math=Object.create(Math); math.random=()=>0;
    let finishes=0;
    const player={id:"火俠",element:"fire",hp:100,sp:200,activeBuffs:[],statusEffects:[]};
    const monsters=[{name:"敵人",alive:true,hp:999,statusEffects:[]}];
    const context={
        window:null,console,Math:math,Date,Number,Object,Array,Set,Map,Promise,
        skillDatabase:database(),document:bareDocument(),player,monsters,currentBattleMonsters:[0],selectedMonster:0,
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>player,
        castCount:0,battleActive:true,finishPlayerAction(){ finishes++; },
        rollCritical(){ return {isCrit:context.castCount<=2,multiplier:1}; },
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback()
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext("castDamageSkill=function(id){player.sp-=skillDatabase[id].spCost;castCount++;rollCritical();finishPlayerAction()}",context);
    vm.runInContext(source,context);
    context.castDamageSkill("dragonSlash");
    assert.equal(context.castCount,3);
    assert.equal(player.sp,135);
    assert.equal(finishes,1);
});

test("enemy Dragon Slash repeat preserves the active battle token",()=>{
    const math=Object.create(Math); math.random=()=>0;
    const calls=[];
    let finishes=0;
    const party=[{id:"我方",hp:100,activeBuffs:[],statusEffects:[]}];
    const monsters=[{name:"敵方",alive:true,hp:100,sp:200,skillIds:["dragonSlash"],skillChance:1,statusEffects:[]}];
    const context=load({
        Math:math,monsters,currentBattleMonsters:[0],
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:index=>party[index],
        processSingleMonsterAttack(index,token){
            calls.push([index,token]);
            this.showMonsterSkillNameBadge("霸龍裂天斬","fire",index);
            monsters[index].sp-=this.skillDatabase.dragonSlash.spCost;
            this.showPlayerHit(10,"hp",0,false,calls.length===1);
            this.finishPlayerAction();
        },
        showMonsterSkillNameBadge(){},showPlayerHit(){},finishPlayerAction(){ finishes++; },addBattleLog(){}
    });
    context.processSingleMonsterAttack(0,77);
    assert.deepEqual(calls,[[0,77],[0,77]]);
    assert.equal(monsters[0].sp,135);
    assert.equal(finishes,1);
});

test("enemy Dragon Slash adds a second repeat after a critical first repeat",()=>{
    const math=Object.create(Math); math.random=()=>0;
    const calls=[];
    let finishes=0;
    const party=[{id:"我方",hp:100,activeBuffs:[],statusEffects:[]}];
    const monsters=[{name:"敵方",alive:true,hp:100,sp:200,skillIds:["dragonSlash"],skillChance:1,statusEffects:[]}];
    const context=load({
        Math:math,monsters,currentBattleMonsters:[0],showPlayerHit(){},
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:index=>party[index],
        processSingleMonsterAttack(index,token){
            calls.push([index,token]);
            this.showMonsterSkillNameBadge("霸龍裂天斬","fire",index);
            monsters[index].sp-=this.skillDatabase.dragonSlash.spCost;
            this.showPlayerHit(10,"hp",0,false,calls.length<=2);
            this.finishPlayerAction();
        },
        showMonsterSkillNameBadge(){},finishPlayerAction(){ finishes++; },addBattleLog(){}
    });
    context.processSingleMonsterAttack(0,88);
    assert.deepEqual(calls,[[0,88],[0,88],[0,88]]);
    assert.equal(monsters[0].sp,135);
    assert.equal(finishes,1);
});

test("word-circle animation emits one circle per character without replacing sprite sheets",()=>{
    const delays=[];
    const flights=Array.from({length:4},(_,index)=>({
        dataset:{order:String(index)},style:{
            value:"100ms",getPropertyValue(){ return this.value; },
            setProperty(name,value){ this.value=value; delays[index]=value; }
        }
    }));
    const stage={classList:{add(){}},querySelectorAll:()=>flights};
    let played=null;
    const director={play(config){ played=config; return {done:true,promise:Promise.resolve()}; }};
    const context=load({
        v142SkillAnimationDirector:director,
        v143SkillAnimationManifest:{flameSlash:{sprite:{frames:12}}},
        document:bareDocument({
            querySelector:selector=>selector.includes("v149-word-phoenixCry")?stage:null
        })
    });
    context.v142SkillAnimationDirector.play({
        id:"phoenixCry",name:"火鳳天鳴",element:"fire",category:"magic",targetType:"all",duration:3200
    },{side:"player",actorIndex:0});
    assert.equal(played.id,"v149-word-phoenixCry");
    assert.equal(context.v143SkillAnimationManifest[played.id].sequence,"火鳳天鳴");
    assert.equal(context.v143SkillAnimationManifest[played.id].flightCount,4);
    assert.deepEqual(delays,["100ms","120ms","140ms","160ms"]);
    context.v142SkillAnimationDirector.play({
        id:"flameSlash",name:"火焰斬",element:"fire",category:"physical",targetType:"single",duration:760
    },{side:"player",actorIndex:0});
    assert.equal(played.id,"flameSlash");
    assert.equal(context.v143SkillAnimationManifest["v149-word-flameSlash"],undefined);
    context.v143SkillAnimationManifest.iceArrowRain={sprite:{frames:12}};
    context.v142SkillAnimationDirector.play({
        id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",targetType:"all",duration:2500
    },{side:"player",actorIndex:0});
    assert.equal(played.id,"iceArrowRain");
    assert.equal(context.v143SkillAnimationManifest["v149-word-iceArrowRain"],undefined);
    assert.match(animationSource,/const repeats=Math\.max\(1,requested\)/);
    assert.match(css,/v149-word-circle-stage \.v143-skill-flight/);
    assert.doesNotMatch(css,/data-skill="v149-word-flameSlash"/);
});

test("Barrier corners, revive brightness, rank colours and reflect label are final rules",()=>{
    assert.match(source,/remove\("dead","dying","v146-defeated"\)/);
    assert.match(source,/setTimeout\(\(\)=>syncMonsterCard\(index\),1900\)/);
    assert.match(css,/\.v149-barrier-corners i:nth-child\(4\)/);
    assert.match(css,/border-color:#c79520/);
    assert.match(css,/battle-monster\.v149-has-barrier \.v141-monster-shield-bar[\s\S]*display:none/);
    assert.doesNotMatch(css,/v149-barrier-corners[\s\S]{0,1000}content:"界"/);
    assert.match(css,/data-rank="elite"[\s\S]*#ff9f43/);
    assert.match(css,/data-rank="boss"[\s\S]*#ff5f9d/);
    assert.match(source,/反傷HP-/);
    assert.match(css,/\.v149-reflect-popup/);
});

console.log("\nV149 skill/UI rules suite: "+passed+" tests passed.");
