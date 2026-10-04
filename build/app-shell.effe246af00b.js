
/* bundled source: functions/src/equipment-combat-percent-migration.js */
/* Sole equipment unit migration owner, shared by the app-shell and backend.
 * Unversioned equipment comes from the pre-V2 schema: its only Accuracy
 * producers are four-symbol armor base stats and the retired Spirit mapping.
 * This never converts character/monster/skill/buff Accuracy or raw archives.
 */
(function(root,factory){
    const api=factory();
    if(typeof module==="object"&&module.exports){ module.exports=api; }
    else{ root.FourSymbolsEquipmentCombatMigration=api; }
})(typeof window!=="undefined"?window:globalThis,function(){
    "use strict";
    const VERSION=2;
    const SET_IDS=new Set(["setFire","setWater","setEarth","setWind"]);
    const rounded=value=>Math.round(value*1e10)/1e10;
    function migrateItem(item){
        if(!item||typeof item!=="object"||Array.isArray(item)){ return item; }
        const version=item.equipmentCombatPercentUnitVersion;
        if(version===VERSION){ return item; }
        if(version!==undefined&&version!==1){ throw new Error("Unknown equipment combat unit version"); }
        const armor=SET_IDS.has(item.setId)&&
            [item.setId+"_heavyArmor",item.setId+"_robe"].includes(item.id);
        const updates={};
        for(const key of ["stats","reforgeStats"]){
            const source=item[key];
            if(source==null){ continue; }
            if(typeof source!=="object"||Array.isArray(source)){ throw new Error("Invalid equipment stats"); }
            const stats={...source};
            for(const field of ["accuracy","spirit","antiCrit","statusResistance","evasion"]){
                if(stats[field]!==undefined&&!Number.isFinite(Number(stats[field]))){
                    throw new Error("Invalid equipment combat stat: "+field);
                }
            }
            let accuracy=Number(stats.accuracy)||0;
            // Set base is replaced before any legacy-unit conversion. Reforge
            // Accuracy is never mistaken for the set's ten-point base.
            if(key==="stats"&&armor&&accuracy>=10){
                accuracy-=10;
                stats.evasion=(Number(stats.evasion)||0)+10;
            }
            if(Object.prototype.hasOwnProperty.call(stats,"accuracy")){
                if(accuracy){ stats.accuracy=rounded(accuracy*0.15); }
                else{ delete stats.accuracy; }
            }
            const spirit=Number(stats.spirit)||0;
            if(spirit){
                stats.accuracy=rounded((Number(stats.accuracy)||0)+spirit*0.3);
                stats.antiCrit=rounded((Number(stats.antiCrit)||0)+spirit*0.1);
                stats.statusResistance=rounded((Number(stats.statusResistance)||0)+spirit*0.05);
            }
            delete stats.spirit;
            updates[key]=stats;
        }
        Object.assign(item,updates,{equipmentCombatPercentUnitVersion:VERSION});
        return item;
    }
    function projectItem(item){
        return migrateItem(JSON.parse(JSON.stringify(item)));
    }
    return Object.freeze({VERSION,migrateItem,projectItem});
});


/* bundled source: js/00-main.js */
/* BEGIN GENERATED MONSTER BALANCE OWNER */
(function installMonsterBalanceAuthority(){
"use strict";
/** Canonical future player/monster contract. Phase 1: pure shadow only. */
const LEVEL_BASE = Object.freeze({physicalAttack:30,magicAttack:30,defense:30});
const LEVEL_GROWTH = Object.freeze({physicalAttack:4,magicAttack:2.75,defense:4});
const SIX_STAT_COEFFICIENTS = Object.freeze({attack:4,intelligence:2.75,vitality:50,energy:15,defense:4,agility:1});
function validateLevel(level){
  if(!Number.isSafeInteger(level)||level<1||level>100) throw new RangeError('level must be an integer from 1 to 100');
  return level;
}
function levelBase(level){
  validateLevel(level);
  return {...Object.fromEntries(Object.keys(LEVEL_BASE).map(key=>[key,LEVEL_BASE[key]+(level-1)*LEVEL_GROWTH[key]])),abilityPointBudget:(level-1)*5};
}
const CombatLevelBase = Object.freeze({preview:levelBase,base:LEVEL_BASE,growth:LEVEL_GROWTH,coefficients:SIX_STAT_COEFFICIENTS});

/** One registry for allocation and AI intent; no skill execution or invented skills. */
const define=(weights,priority,requiredCapabilities=[])=>Object.freeze({
  weights:Object.freeze(weights),aiIntent:Object.freeze({priority:Object.freeze(priority),requiredCapabilities:Object.freeze(requiredCapabilities),policy:'only-existing-carried-legal-affordable-skills'})
});
const ARCHETYPES=Object.freeze({
  physical:define({attack:30,vitality:15,defense:15,energy:15,agility:15,intelligence:10},['physicalAttack','attack']),
  magic:define({attack:10,vitality:15,defense:15,energy:15,agility:15,intelligence:30},['magicAttack','attack']),
  tank:define({vitality:30,defense:30,attack:15,energy:10,agility:10,intelligence:5},['protectAlly','shield','reduceDamage','attack'],['shield-or-protection-or-damage-reduction-or-taunt']),
  speedControl:define({agility:30,intelligence:20,energy:15,vitality:15,defense:10,attack:10},['openingBuffOrSupport','hardControlOrDebuff','attack'],['opening-support-or-control-or-debuff']),
  support:define({intelligence:25,energy:25,agility:20,vitality:15,defense:10,attack:5},['healLowHpAlly','missingImportantBuff','cleanseDebuff','attack']),
  balanced:define({attack:20,vitality:20,defense:20,intelligence:15,energy:15,agility:10},['contextAppropriateLegalSkill','attack'])
});
// Canonical tie order, independent of registry property order or creation order.
const STAT_ORDER=Object.freeze(['attack','intelligence','vitality','energy','defense','agility']);
function allocatePoints(budget,archetype){
  if(!Number.isSafeInteger(budget)||budget<0) throw new RangeError('budget must be a nonnegative integer');
  const entry=ARCHETYPES[archetype];
  if(!Object.hasOwn(ARCHETYPES,archetype)) throw new TypeError('unknown archetype');
  const shares=STAT_ORDER.map((stat,index)=>({stat,index,points:Math.floor(budget*entry.weights[stat]/100),remainder:budget*entry.weights[stat]%100}));
  const left=budget-shares.reduce((sum,row)=>sum+row.points,0);
  [...shares].sort((a,b)=>b.remainder-a.remainder||a.index-b.index).slice(0,left).forEach(row=>row.points++);
  return Object.fromEntries(shares.map(row=>[row.stat+'Points',row.points]));
}

const MODES=Object.freeze(['wild','daily','tower','abyss','adventure','personalBoss','worldBoss']);
const RANKS=Object.freeze(['regular','elite','smallBoss','boss']);
const GLOBAL_CALIBRATION=Object.freeze({hp:1,sp:1,damage:1,defense:1});
// Wild resources are HP100/SP50 plus allocation only; player per-level bonuses never apply.
const RESOURCE_BASE=Object.freeze({hp:100,sp:50,provenance:'00-main legacy resource baseline'});
const DAILY_PARTY_DURABILITY=Object.freeze({1:0.04,2:0.08,3:0.12});
const DAILY_MODE_PROFILE=Object.freeze({hp:1,defense:1,damage:1,sp:1,skillFrequency:1});
// Ten-enemy Tower calibration: keep raw six-stat conversion and rank ratios intact.
const TOWER_MODE_PROFILE=Object.freeze({hp:0.2,sp:1,damage:0.25,defense:1,speed:1});
const ABYSS_MODE_PROFILE=Object.freeze({hp:0.45,sp:1,damage:0.22,defense:1,speed:1,trueRealmFinalDamage:0.18,trueRealmFinalHp:0.9});
const ABYSS_RANK_PROFILES=Object.freeze({
  regular:Object.freeze({hp:1,sp:1,defense:1,finalDamagePressure:1}),
  elite:Object.freeze({hp:1.8,sp:1.5,defense:1.15,finalDamagePressure:1.1}),
  smallBoss:Object.freeze({hp:3.2,sp:2,defense:1.25,finalDamagePressure:1.2})
});
const ABYSS_STAGE_HP=Object.freeze([0.90,0.95,1,1.05,1.10]);
const clone=value=>JSON.parse(JSON.stringify(value));
function normalizeSpec(spec){
  if(!spec||typeof spec!=='object') throw new TypeError('monster spec required');
  const {name,level,element,archetype,rank,mode,context}=spec;
  if(typeof name!=='string'||!name.trim()) throw new TypeError('name required');
  validateLevel(level);
  if(!['fire','water','wind','earth','light'].includes(element)) throw new TypeError('explicit element required');
  if(!Object.hasOwn(ARCHETYPES,archetype)) throw new TypeError('explicit archetype required');
  if(!RANKS.includes(rank)||!MODES.includes(mode)) throw new TypeError('explicit canonical rank and mode required');
  if(typeof context!=='string'||!context.trim()) throw new TypeError('stable context ID required');
  if(['wild','daily'].includes(mode) && rank==='smallBoss') throw new TypeError('Wild/Daily do not use challenge smallBoss');
  if(rank==='boss'&&mode!=='daily') throw new TypeError('boss is Daily resource enemy only');
  const daily={};
  if(mode==='abyss'){
    if(!spec.monsterKey||![20,40].includes(level)||spec.abyssDifficulty!==level||!['east','south','heaven','north','extreme'].includes(spec.abyssRegion)||!Number.isInteger(spec.abyssStage)||spec.abyssStage<0||spec.abyssStage>4||context!==`abyss/${level}/${spec.abyssRegion}/stage/${spec.abyssStage+1}`||rank==='boss') throw new TypeError('explicit formal Abyss encounter required');
    Object.assign(daily,{abyssDifficulty:level,abyssRegion:spec.abyssRegion,abyssStage:spec.abyssStage});
  }
  if(mode==='daily'){
    if(!spec.monsterKey||!['exp','material','gold'].includes(spec.dailyType)||![1,2,3].includes(spec.wave)||!Number.isInteger(spec.slot)||spec.slot<0||spec.slot>5||![1,2,3].includes(spec.partySize)) throw new TypeError('explicit Daily encounter spec required');
    validateLevel(spec.highestPartyLevel);
    if(!Number.isFinite(spec.skillFrequency)||spec.skillFrequency<0||spec.skillFrequency>1) throw new TypeError('existing skill frequency required');
    Object.assign(daily,{dailyType:spec.dailyType,wave:spec.wave,slot:spec.slot,partySize:spec.partySize,highestPartyLevel:spec.highestPartyLevel,skillFrequency:spec.skillFrequency});
  }
  return {...daily,...(spec.monsterKey?{monsterKey:spec.monsterKey}:{}),name,level,element,archetype,rank,mode,context};
}
function preview(spec){
  const identity=normalizeSpec(spec),base=levelBase(identity.level),allocation=allocatePoints(base.abilityPointBudget,identity.archetype);
  const derived={
    maxHP:RESOURCE_BASE.hp+allocation.vitalityPoints*SIX_STAT_COEFFICIENTS.vitality,
    maxSP:RESOURCE_BASE.sp+allocation.energyPoints*SIX_STAT_COEFFICIENTS.energy,
    physicalAttack:base.physicalAttack+allocation.attackPoints*SIX_STAT_COEFFICIENTS.attack,
    magicAttack:base.magicAttack+allocation.intelligencePoints*SIX_STAT_COEFFICIENTS.intelligence,
    defense:base.defense+allocation.defensePoints*SIX_STAT_COEFFICIENTS.defense,
    speed:allocation.agilityPoints*SIX_STAT_COEFFICIENTS.agility
  };
  // Migrated modes own their rank pressure here; unmigrated modes stay neutral shadow-only.
  const migrated=['wild','daily','tower','abyss'].includes(identity.mode);
  const smallBoss=identity.mode==='tower'&&identity.rank==='smallBoss';
  const boss=identity.rank==='boss';
  const rank=migrated
    ?{id:identity.rank,status:'RANK_V1',hp:smallBoss?3:boss?2:identity.rank==='elite'?1.5:1,defense:(smallBoss||boss)?1.15:identity.rank==='elite'?1.1:1,finalDamagePressure:(smallBoss||boss)?1.15:identity.rank==='elite'?1.1:1,skillFrequency:null}
    :{id:identity.rank,status:'PENDING_PRODUCT_CALIBRATION',hp:1,defense:1,finalDamagePressure:null,skillFrequency:null};
  if(identity.mode==='abyss') Object.assign(rank,ABYSS_RANK_PROFILES[identity.rank],{status:'ABYSS_RUNTIME_V1'});
  const mode={id:identity.mode,status:identity.mode==='wild'||identity.mode==='tower'?'RUNTIME_V1':'SHADOW_BASELINE_ONLY',hp:identity.mode==='wild'?0.32:identity.mode==='tower'?TOWER_MODE_PROFILE.hp:1,sp:1,damage:identity.mode==='tower'?TOWER_MODE_PROFILE.damage:1,defense:1,speed:identity.mode==='wild'&&identity.context==='wild/zone-01'?0:1,ttkTarget:['wild','daily'].includes(identity.mode)?{maxRounds:2,player:'normal same-level progression',scope:'kill/clear wave'}:identity.mode==='tower'?{player:'normal same-floor progression',scope:'challenge floor',floorEqualsLevel:true}:null};
  if(identity.mode==='daily'){
    const solo=identity.partySize===1&&identity.highestPartyLevel<=20;
    Object.assign(mode,{...DAILY_MODE_PROFILE,status:'RUNTIME_V1',damage:solo?.5:1,partySizeDurability:DAILY_PARTY_DURABILITY[identity.partySize],skillFrequency:solo?(identity.wave===1?0:Math.min(.45,identity.skillFrequency*.60)):identity.skillFrequency,protection:{solo,noAccuracyCritBoost:solo,bossSkillCooldown:solo}});
  }
  if(identity.mode==='abyss'){
    const final=identity.level===40&&identity.abyssRegion==='extreme'&&identity.abyssStage===4;
    Object.assign(mode,ABYSS_MODE_PROFILE,{status:'RUNTIME_V1',hp:ABYSS_MODE_PROFILE.hp*ABYSS_STAGE_HP[identity.abyssStage]*(final?ABYSS_MODE_PROFILE.trueRealmFinalHp:1),damage:final?ABYSS_MODE_PROFILE.trueRealmFinalDamage:ABYSS_MODE_PROFILE.damage,ttkTarget:{scope:'challenge encounter; no two-round cap',reference:'formal unequipped party at unlock/+10/+20',trueRealmFinal:final}});
  }
  const element={id:identity.element,hp:1,defense:1,speed:1,metadata:{},provenance:'identity only'};
  if(identity.mode==='tower'){
    element.provenance='existing Tower Element Profile (pre-battle only)';
    if(identity.element==='earth'){element.hp=1.15;element.defense=1.15;}
    if(identity.element==='wind'){element.speed=1.15;element.metadata={evasionBonusPercent:15};}
    if(identity.element==='fire') element.metadata={criticalBonusPercent:15,directDamageMultiplier:1.15};
    if(identity.element==='water') element.metadata={healingMultiplier:1.15,statusAccuracyPercent:15,aiPreference:'support'};
  }
  const globalCalibration={...GLOBAL_CALIBRATION};
  const profiles={rank,mode,element,globalCalibration};
  const afterRank={...derived,maxSP:derived.maxSP*(rank.sp||1),maxHP:derived.maxHP*rank.hp,defense:derived.defense*rank.defense};
  const afterMode={...afterRank,maxHP:afterRank.maxHP*mode.hp*(mode.partySizeDurability||1),maxSP:afterRank.maxSP*mode.sp,physicalAttack:afterRank.physicalAttack*(['daily','tower','abyss'].includes(identity.mode)?1:mode.damage),magicAttack:afterRank.magicAttack*(['daily','tower','abyss'].includes(identity.mode)?1:mode.damage),defense:afterRank.defense*mode.defense,speed:afterRank.speed*mode.speed};
  const afterElement={...afterMode,maxHP:Math.round(afterMode.maxHP*element.hp),defense:['wild','daily'].includes(identity.mode)?afterMode.defense:Math.round(afterMode.defense*element.defense),speed:afterMode.speed*element.speed};
  const final={...afterElement,maxHP:afterElement.maxHP*globalCalibration.hp,maxSP:afterElement.maxSP*globalCalibration.sp,physicalAttack:afterElement.physicalAttack*globalCalibration.damage,magicAttack:afterElement.magicAttack*globalCalibration.damage,defense:afterElement.defense*globalCalibration.defense};
  return {identity,base,resourceBase:{...RESOURCE_BASE,speed:0},allocation,derived,profiles,final,finalDamagePressure:rank.finalDamagePressure===null?null:rank.finalDamagePressure*mode.damage,...(['daily','tower','abyss'].includes(identity.mode)?{legacyMultiplier:'NONE'}:{}),...(identity.mode==='daily'?{skillFrequency:mode.skillFrequency}:{}),provenance:{stats:'MonsterBalance',damagePressure:'MonsterBalance Rank Profile consumed once by core damage settlement'},aiIntent:clone(ARCHETYPES[identity.archetype].aiIntent),pendingProductDecisions:['wild','daily','tower','abyss'].includes(identity.mode)?[]:['monster per-level bonusHP +30 / bonusSP +10','rank and mode final calibration','Abyss TTK'],breakdown:[
    {step:'levelBase',formula:'30 + (level - 1) * growth; budget = (level - 1) * 5',input:identity.level,output:{...base}},
    {step:'allocation',method:'largest remainder; canonical STAT_ORDER ties',weights:{...ARCHETYPES[identity.archetype].weights},output:{...allocation}},
    {step:'sixStatConversion',coefficients:{...SIX_STAT_COEFFICIENTS},resourceBase:{...RESOURCE_BASE},output:{...derived}},
    {step:'rank',profile:{...rank},output:afterRank},{step:'mode',profile:clone(mode),output:afterMode},
    {step:'element',profile:clone(element),output:afterElement},{step:'globalCalibration',profile:{...globalCalibration},output:{...final}}
  ]};
}
function previewTower(spec,floor){
  validateLevel(floor);
  return preview({...spec,mode:'tower',context:'tower/floor/'+floor,level:floor});
}
function previewTowerRoster(spec,floor){
  validateLevel(floor);
  const ranks=floor%10===0?['smallBoss','elite','elite',...Array(7).fill('regular')]:floor%5===0?['elite','elite',...Array(8).fill('regular')]:Array(10).fill('regular');
  return ranks.map(rank=>previewTower({...spec,rank},floor));
}
function build(spec){
  if(!['wild','daily','tower','abyss'].includes(spec.mode)||!spec.monsterKey) throw new TypeError('Runtime build requires explicit migrated identity');
  const projection=preview(spec),{final,allocation,identity}=projection;
  return {...identity,...allocation,maxHP:final.maxHP,hp:final.maxHP,maxSP:final.maxSP,sp:final.maxSP,
    attack:final.physicalAttack,magicAttack:final.magicAttack,defense:final.defense,agility:final.speed,
    accuracy:0,statusResistance:0,antiCrit:0,evasion:0,alive:true,
    ...(identity.mode==='daily'?{skillChance:projection.skillFrequency,v173DailySoloProtected:projection.profiles.mode.protection.solo,v173DailyNoAccuracyCritBoost:projection.profiles.mode.protection.noAccuracyCritBoost,v173DailyBossUsedSkillLastAction:false}:{}),
    balanceOwner:'MonsterBalance',balanceProjection:projection};
}
function debug(entity){
  if(!entity||entity.balanceOwner!=='MonsterBalance'||!entity.balanceProjection) throw new TypeError('Owner entity required');
  return clone(entity.balanceProjection);
}
const MonsterBalance=Object.freeze({preview,build,debug,previewTower,previewTowerRoster,archetypes:ARCHETYPES,modes:MODES,ranks:RANKS,globalCalibration:GLOBAL_CALIBRATION});

window.MonsterBalance=MonsterBalance;
window.MonsterBalanceWildIdentities=Object.freeze({"wild.zone-01.fire-01":{"archetype":"physical","zone":"wild/zone-01","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-01.water-01":{"archetype":"balanced","zone":"wild/zone-01","reason":"No specialized capability evidence; explicit balanced default.","capabilityGap":null},"wild.zone-01.wind-01":{"archetype":"balanced","zone":"wild/zone-01","reason":"No specialized capability evidence; explicit balanced default.","capabilityGap":null},"wild.zone-01.earth-01":{"archetype":"tank","zone":"wild/zone-01","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-02.fire-01":{"archetype":"physical","zone":"wild/zone-02","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-02.water-01":{"archetype":"magic","zone":"wild/zone-02","reason":"Existing water magic damage skill pool.","capabilityGap":null},"wild.zone-02.wind-01":{"archetype":"speedControl","zone":"wild/zone-02","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-02.earth-01":{"archetype":"tank","zone":"wild/zone-02","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-03.fire-01":{"archetype":"physical","zone":"wild/zone-03","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-03.water-01":{"archetype":"magic","zone":"wild/zone-03","reason":"Existing water magic damage skill pool.","capabilityGap":null},"wild.zone-03.fire-02":{"archetype":"physical","zone":"wild/zone-03","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-03.water-02":{"archetype":"magic","zone":"wild/zone-03","reason":"Existing water magic damage skill pool.","capabilityGap":null},"wild.zone-03.wind-01":{"archetype":"speedControl","zone":"wild/zone-03","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-03.earth-01":{"archetype":"tank","zone":"wild/zone-03","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-04.fire-01":{"archetype":"physical","zone":"wild/zone-04","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-04.water-01":{"archetype":"magic","zone":"wild/zone-04","reason":"Existing water magic damage skill pool.","capabilityGap":null},"wild.zone-04.fire-02":{"archetype":"physical","zone":"wild/zone-04","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-04.water-02":{"archetype":"magic","zone":"wild/zone-04","reason":"Existing water magic damage skill pool.","capabilityGap":null},"wild.zone-04.wind-01":{"archetype":"speedControl","zone":"wild/zone-04","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-04.earth-01":{"archetype":"tank","zone":"wild/zone-04","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-05.fire-01":{"archetype":"physical","zone":"wild/zone-05","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-05.water-01":{"archetype":"support","zone":"wild/zone-05","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-05.fire-02":{"archetype":"physical","zone":"wild/zone-05","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-05.water-02":{"archetype":"support","zone":"wild/zone-05","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-05.wind-01":{"archetype":"speedControl","zone":"wild/zone-05","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-05.earth-01":{"archetype":"tank","zone":"wild/zone-05","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-06.fire-01":{"archetype":"physical","zone":"wild/zone-06","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-06.water-01":{"archetype":"support","zone":"wild/zone-06","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-06.fire-02":{"archetype":"physical","zone":"wild/zone-06","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-06.water-02":{"archetype":"support","zone":"wild/zone-06","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-06.wind-01":{"archetype":"speedControl","zone":"wild/zone-06","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-06.earth-01":{"archetype":"tank","zone":"wild/zone-06","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-07.fire-01":{"archetype":"physical","zone":"wild/zone-07","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-07.water-01":{"archetype":"support","zone":"wild/zone-07","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-07.fire-02":{"archetype":"magic","zone":"wild/zone-07","reason":"Existing elemental magic legal damage skill pool.","capabilityGap":null},"wild.zone-07.water-02":{"archetype":"support","zone":"wild/zone-07","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-07.wind-01":{"archetype":"speedControl","zone":"wild/zone-07","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-07.earth-01":{"archetype":"tank","zone":"wild/zone-07","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-08.fire-01":{"archetype":"physical","zone":"wild/zone-08","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-08.water-01":{"archetype":"support","zone":"wild/zone-08","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-08.fire-02":{"archetype":"magic","zone":"wild/zone-08","reason":"Existing elemental magic legal damage skill pool.","capabilityGap":null},"wild.zone-08.water-02":{"archetype":"support","zone":"wild/zone-08","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-08.wind-01":{"archetype":"speedControl","zone":"wild/zone-08","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-08.earth-01":{"archetype":"tank","zone":"wild/zone-08","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-09.fire-01":{"archetype":"physical","zone":"wild/zone-09","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-09.water-01":{"archetype":"support","zone":"wild/zone-09","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-09.fire-02":{"archetype":"magic","zone":"wild/zone-09","reason":"Existing elemental magic legal damage skill pool.","capabilityGap":null},"wild.zone-09.water-02":{"archetype":"support","zone":"wild/zone-09","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-09.wind-01":{"archetype":"speedControl","zone":"wild/zone-09","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-09.earth-01":{"archetype":"tank","zone":"wild/zone-09","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."},"wild.zone-10.fire-01":{"archetype":"physical","zone":"wild/zone-10","reason":"Existing elemental physical legal damage skill pool.","capabilityGap":null},"wild.zone-10.water-01":{"archetype":"support","zone":"wild/zone-10","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-10.fire-02":{"archetype":"magic","zone":"wild/zone-10","reason":"Existing elemental magic legal damage skill pool.","capabilityGap":null},"wild.zone-10.water-02":{"archetype":"support","zone":"wild/zone-10","reason":"Existing water healing support resolver; retain a legal heal utility.","capabilityGap":null},"wild.zone-10.wind-01":{"archetype":"speedControl","zone":"wild/zone-10","reason":"Existing wind agilityDown/stun legal skills; early tier uses agilityDown.","capabilityGap":null},"wild.zone-10.earth-01":{"archetype":"tank","zone":"wild/zone-10","reason":"Established rock/armored portrait identity; defensive AI capability gap is recorded.","capabilityGap":"No new tank AI or skills are introduced."}});
window.MonsterBalanceDailyIdentities=Object.freeze({"daily.exp.regular":{"archetype":"magic","reason":"Existing elemental damage pool for cultivation disciple."},"daily.exp.elite":{"archetype":"magic","reason":"Cultivation elite uses the same legal spell pool."},"daily.exp.boss":{"archetype":"balanced","reason":"Cultivation instructor has mixed damage skills."},"daily.material.regular":{"archetype":"tank","reason":"Armored ore guard; defensive allocation, no new tank AI."},"daily.material.elite":{"archetype":"physical","reason":"Ore elite uses existing physical damage skills."},"daily.material.boss":{"archetype":"tank","reason":"Ore commander is durable; no new defensive skill."},"daily.gold.regular":{"archetype":"physical","reason":"Vault guard uses existing physical damage pool."},"daily.gold.elite":{"archetype":"speedControl","reason":"Existing elemental control/debuff skills when legal; damage fallback."},"daily.gold.boss":{"archetype":"balanced","reason":"Vault manager uses mixed legal damage pool."}});
})();
/* END GENERATED MONSTER BALANCE OWNER */


/* =====================================================
   â˜… 1080 Ã— 1920 æ•´é«”ç­‰æ¯”ä¾‹ç¸®æ”¾æŽ§åˆ¶å™¨
   - éŠæˆ²é‚è¼¯èˆžå°å›ºå®š 1080 Ã— 1920
   - ä¸ä¾è³´ vw / vh æ”¹è®ŠéŠæˆ²å…§å°ºå¯¸
   - å¯¦éš›èž¢å¹•åªæ±ºå®š stage scale
   - letterbox è‡ªç„¶ç•™åœ¨ stage å¤–
===================================================== */


/* =====================================================
   â˜… COMPLETE 1080Ã—1920 STAGE CONTENT WRAPPER
   Keep existing DOM IDs/classes and game logic intact.
   All existing #app descendants are moved into one
   transformed legacy design surface.
===================================================== */
(function setupGameContentStage(){
    const app = document.getElementById("app");
    if(!app) return;

    let content = document.getElementById("game-content");

    if(!content){
        content = document.createElement("div");
        content.id = "game-content";

        while(app.firstChild){
            content.appendChild(app.firstChild);
        }

        app.appendChild(content);
    }
})();

/* Legacy V3 navigation positioning retired; FourSymbolsBottomNav owns the shell. */

const GAME_WIDTH = 1080;
const GAME_HEIGHT = 1920;

const LEGACY_WIDTH = 420;
const LEGACY_HEIGHT = 746.6666667;

/*
 * V9 MIGRATION RULE:
 * 1080Ã—1920 is the official coordinate standard for all NEW systems.
 * LEGACY_WIDTH/HEIGHT exist only for existing content compatibility.
 */

let gameStageScale = 1;
let gameStageLeft = 0;
let gameStageTop = 0;

function updateGameStageScale(){

    const stage = document.getElementById("game-stage");
    const viewport = document.getElementById("game-viewport");
    if(!stage || !viewport){
        return;
    }

    /*
       V5: use the layout viewport / actual game-viewport size,
       NOT visualViewport.width/height.

       visualViewport can become smaller when the browser is zoomed
       or when a file is opened inside a scaled preview surface.
       Using it here caused the game to shrink to the left side instead
       of centering in the real available viewport.
    */
    const vw = viewport.clientWidth || window.innerWidth || GAME_WIDTH;
    const vh = viewport.clientHeight || window.innerHeight || GAME_HEIGHT;

    const rootStyle = getComputedStyle(document.documentElement);

    const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
    const safeRight = parseFloat(rootStyle.getPropertyValue("--safe-right")) || 0;
    const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;
    const safeLeft = parseFloat(rootStyle.getPropertyValue("--safe-left")) || 0;

    const availableWidth = Math.max(1, vw - safeLeft - safeRight);
    const availableHeight = Math.max(1, vh - safeTop - safeBottom);

    gameStageScale = Math.min(
        availableWidth / GAME_WIDTH,
        availableHeight / GAME_HEIGHT
    );

    /*
       Center the 1080Ã—1920 stage inside the actual viewport.
       The stage is still clipped by #game-viewport, so it cannot
       create page scrolling.
    */
    const displayedWidth = GAME_WIDTH * gameStageScale;
    const displayedHeight = GAME_HEIGHT * gameStageScale;

    // The viewport itself is a flex centering surface. Keep the stage at its
    // native 1080x1920 layout size and only scale it visually around center.
    // This avoids transformed-layout overflow and guarantees symmetric bars.
    gameStageLeft = safeLeft + Math.max(0, (availableWidth - displayedWidth) / 2);
    gameStageTop = safeTop + Math.max(0, (availableHeight - displayedHeight) / 2);

    stage.style.left = "auto";
    stage.style.top = "auto";
    stage.style.transformOrigin = "center center";
    stage.style.transform = "scale(" + gameStageScale + ")";

    /* Keep the existing 420Ã—746.6667 legacy design surface intact.
       It is scaled once inside the 1080Ã—1920 virtual stage. */
    const content = document.getElementById("game-content");
    if(content){
        content.style.transform = "scale(" + (GAME_WIDTH / LEGACY_WIDTH) + ")";
        content.style.transformOrigin = "top left";
    }

    /* Expose useful diagnostics for testing. */
    window.GAME_VIEWPORT_WIDTH = vw;
    window.GAME_VIEWPORT_HEIGHT = vh;
    window.GAME_STAGE_SCALE = gameStageScale;
    window.GAME_STAGE_LEFT = gameStageLeft;
    window.GAME_STAGE_TOP = gameStageTop;
}

function gamePointFromClient(clientX,clientY){

    return {
        x:
            (clientX-gameStageLeft)/
            gameStageScale,

        y:
            (clientY-gameStageTop)/
            gameStageScale
    };

}

function clientPointFromGame(x,y){

    return {
        x:
            gameStageLeft+
            x*gameStageScale,

        y:
            gameStageTop+
            y*gameStageScale
    };

}


/* Convert any Pointer/Touch/Mouse event into 1080Ã—1920
   virtual game coordinates. */
function getGamePointFromEvent(event){
    let clientX = 0;
    let clientY = 0;

    if(event && event.touches && event.touches.length){
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    }else if(event && event.changedTouches && event.changedTouches.length){
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
    }else if(event){
        clientX = event.clientX ?? 0;
        clientY = event.clientY ?? 0;
    }

    return gamePointFromClient(clientX, clientY);
}

function applyGameStageTransform(){
    updateGameStageScale();
}

window.addEventListener(
    "resize",
    updateGameStageScale,
    {passive:true}
);

window.addEventListener(
    "orientationchange",
    updateGameStageScale,
    {passive:true}
);

if(window.visualViewport){

    /* visualViewport is only a resize trigger. Its dimensions are NOT
       used for the game scale because browser zoom can shrink it. */
    window.visualViewport.addEventListener(
        "resize",
        updateGameStageScale,
        {passive:true}
    );

}

updateGameStageScale();

/* V6: the viewport owns all clipping and centering. Never let a descendant
   contribute document-level scroll dimensions. */
(function enforceViewportSurface(){
    const viewport = document.getElementById("game-viewport");
    if(!viewport) return;
    viewport.style.display = "flex";
    viewport.style.alignItems = "center";
    viewport.style.justifyContent = "center";
    viewport.style.overflow = "hidden";
})();

/* V5 runtime guard: prevent legacy scrolling and keep stage centered in the layout viewport. */
(function installViewportLock(){
    const lock = () => {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.documentElement.style.overscrollBehavior = "none";
        document.body.style.overscrollBehavior = "none";
        updateGameStageScale();
    };

    window.addEventListener("resize", lock, {passive:true});
    window.addEventListener("orientationchange", lock, {passive:true});
    if(window.visualViewport){
        window.visualViewport.addEventListener("resize", lock, {passive:true});
    }
    lock();
})();

/*
   â˜… COMPLETE virtual-stage validation helpers
   These expose one consistent 1080Ã—1920 coordinate system
   for future Hotspots, Canvas/VFX and pointer interactions.
*/
window.GAME_VIRTUAL_WIDTH = GAME_WIDTH;
window.GAME_VIRTUAL_HEIGHT = GAME_HEIGHT;
window.gameToScreenPoint = clientPointFromGame;
window.screenToGamePoint = gamePointFromClient;
window.eventToGamePoint = getGamePointFromEvent;


/* =====================================================
   åŸºæœ¬è¨­å®š
===================================================== */

let SAVE_KEY=null;

function activateAccountSaveOwner(uid){
    const repository=window.FourSymbolsAccountSave;
    if(!repository){ throw new Error("Account save repository is unavailable."); }
    const activeUid=repository.activate(uid);
    SAVE_KEY=repository.saveKey(activeUid);
    return SAVE_KEY;
}

function deactivateAccountSaveOwner(){
    const repository=window.FourSymbolsAccountSave;
    if(repository){ repository.deactivate(); }
    SAVE_KEY=null;
}

window.FourSymbolsGameSave=Object.freeze({
    activate:activateAccountSaveOwner,
    deactivate:deactivateAccountSaveOwner,
    getKey:()=>SAVE_KEY,
    load:()=>loadGame(),
    hydrate:save=>loadGame(save),
    save:options=>saveGame(options),
    restoreAutoBattlePreferences:(uid,preferences)=>restoreAutoBattlePreferences(uid,preferences),
    showCreation:()=>showCreation()
});


/* =====================================================
   V173.41 â€” MOBILE SESSION RESUME / BACKGROUND SAVE
   - Startup readiness is always owned by the account-first state machine.
   - A reload inside the same browser tab preserves only non-authoritative UI context.
   - Android background/page suspension saves immediately before eviction.
===================================================== */
const STARTUP_SESSION_READY_KEY="sixiang_startup_session_ready_v1";

(function installMobileSessionResume(){

    if(window.v17341SessionResumeInstalled){ return; }
    window.v17341SessionResumeInstalled=true;

    function sessionHasEntered(){
        try{
            return window.sessionStorage.getItem(STARTUP_SESSION_READY_KEY)==="1";
        }catch(_){
            return false;
        }
    }

    function navigationType(){
        try{
            const entries=window.performance&&typeof window.performance.getEntriesByType==="function"
                ?window.performance.getEntriesByType("navigation")
                :[];
            if(entries&&entries[0]&&entries[0].type){ return String(entries[0].type); }
            if(window.performance&&window.performance.navigation){
                const legacy=Number(window.performance.navigation.type);
                return legacy===1?"reload":legacy===2?"back_forward":"navigate";
            }
        }catch(_){ }
        return "unknown";
    }

    const lifecycleDiagnostics={
        wasDiscarded:document.wasDiscarded===true,
        navigationType:navigationType(),
        sessionPreviouslyEntered:sessionHasEntered(),
        lastEvent:"install",
        lastEventAt:Date.now(),
        lastPageShowPersisted:false,
        backgroundSaveCount:0,
        eventCounts:{visibilitychange:0,pagehide:0,pageshow:0,freeze:0,resume:0}
    };

    function markLifecycleEvent(name,detail){
        lifecycleDiagnostics.lastEvent=name;
        lifecycleDiagnostics.lastEventAt=Date.now();
        if(Object.prototype.hasOwnProperty.call(lifecycleDiagnostics.eventCounts,name)){
            lifecycleDiagnostics.eventCounts[name]++;
        }
        if(name==="pageshow"){
            lifecycleDiagnostics.lastPageShowPersisted=!!(detail&&detail.persisted);
        }
    }

    function rememberEnteredSession(){
        try{
            window.sessionStorage.setItem(STARTUP_SESSION_READY_KEY,"1");
        }catch(_){ }
    }

    function persistBeforeSuspend(reason){
        try{
            const startupState=window.FourSymbolsStartupPolicy?.getState?.();
            if(startupState!=="READY"&&startupState!=="OFFLINE_READY"){
                return;
            }
            if(typeof saveGame==="function"){
                const saved=saveGame({source:"mobile-"+String(reason||"background")});
                if(saved!==false){ lifecycleDiagnostics.backgroundSaveCount++; }
            }
        }catch(_){ }
    }

    if(lifecycleDiagnostics.sessionPreviouslyEntered){
        const startupRoot=document.getElementById("startupLoader");
        if(startupRoot){
            startupRoot.hidden=true;
            startupRoot.dataset.sessionResume="1";
            startupRoot.setAttribute("aria-hidden","true");
        }
    }

    document.addEventListener("v173.20:startup-entered",rememberEnteredSession);

    document.addEventListener("visibilitychange",function(){
        markLifecycleEvent("visibilitychange",{hidden:document.hidden});
        if(document.hidden){ persistBeforeSuspend("visibility-hidden"); }
    });

    window.addEventListener("pagehide",function(event){
        markLifecycleEvent("pagehide",{persisted:!!(event&&event.persisted)});
        persistBeforeSuspend("pagehide");
    });

    window.addEventListener("pageshow",function(event){
        markLifecycleEvent("pageshow",{persisted:!!(event&&event.persisted)});
        /* Normal foreground resume never re-runs Startup. A real reload/discard
           is reconstructed by the existing account-first Startup owner. */
    });

    document.addEventListener("freeze",function(){
        markLifecycleEvent("freeze");
        persistBeforeSuspend("freeze");
    });

    document.addEventListener("resume",function(){
        markLifecycleEvent("resume");
    });

    window.FourSymbolsMobileLifecycleDiagnostics=Object.freeze({
        getSnapshot:function(){
            return Object.freeze({
                wasDiscarded:lifecycleDiagnostics.wasDiscarded,
                navigationType:lifecycleDiagnostics.navigationType,
                sessionPreviouslyEntered:lifecycleDiagnostics.sessionPreviouslyEntered,
                lastEvent:lifecycleDiagnostics.lastEvent,
                lastEventAt:lifecycleDiagnostics.lastEventAt,
                lastPageShowPersisted:lifecycleDiagnostics.lastPageShowPersisted,
                backgroundSaveCount:lifecycleDiagnostics.backgroundSaveCount,
                eventCounts:Object.freeze(Object.assign({},lifecycleDiagnostics.eventCounts))
            });
        }
    });

})();

let deleteAllCharactersInProgress=false;


const START_ATTRIBUTE_POINTS = 10;


/* =====================================================
   â˜… å…­é …èƒ½åŠ›å€¼
=====================================================

   attack      = æ”»æ“Š
   vitality    = é«”è³ª
   energy      = èƒ½é‡
   intelligence= æ™ºåŠ›
   defensePoints= é˜²ç¦¦
   agility     = æ•æ·

===================================================== */

const STAT_NAMES = {

    attack:"æ”»æ“Š",
    vitality:"é«”è³ª",
    energy:"èƒ½é‡",
    intelligence:"æ™ºåŠ›",
    defensePoints:"é˜²ç¦¦",
    agility:"æ•æ·"

};


/* =====================================================
   å…ƒç´ 
===================================================== */

const elementDatabase = {

    fire:{
        name:"ç«",
        icon:"",
        character:"ç«æ³•å¸«"
    },

    wind:{
        name:"é¢¨",
        icon:"",
        character:"é¢¨å¼“æ‰‹"
    },

    earth:{
        name:"åœŸ",
        icon:"",
        character:"åœŸé¨Žå£«"
    },

    water:{
        name:"æ°´",
        icon:"",
        character:"æ°´æˆ°å£«"
    }

};


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œemojiæ›æˆCSS
   å‹•ç•«åœ–ç¤ºï¼‰ï¼š
   çµ„å‡º<span class="elem-icon elem-icon-ç«/æ°´/é¢¨/åœŸ">
   é€™ç¨®HTMLç‰‡æ®µçš„å°å·¥å…·ï¼Œå–ä»£åŽŸæœ¬ç›´æŽ¥æŠŠ
   element.iconï¼ˆemojiå­—å…ƒï¼‰å¡žé€²å­—ä¸²è£¡
   çš„å¯«æ³•ã€‚

   ä»»ä½•åœ°æ–¹åŽŸæœ¬å¯«ã€Œelement.icon+" "+xxxã€
   é€™ç¨®å­—ä¸²çµ„åˆã€è€Œä¸”æ˜¯ç”¨innerHTMLï¼
   .innerHTML=é¡¯ç¤ºå‡ºä¾†ï¼ˆä¸æ˜¯textContentï¼‰ï¼Œ
   éƒ½å¯ä»¥æ”¹æˆå‘¼å«é€™è£¡ï¼Œç›´æŽ¥æ‹¿åˆ°å«CSSåœ–ç¤º
   çš„HTMLå­—ä¸²ã€‚
*/

function getElementIconHTML(elementKey){

    return (
        '<span class="elem-icon elem-icon-'+
        (elementKey||"fire")+
        '"></span>'
    );

}


let selectedCreationElement =
    "fire";


/*
   V130ï¼šä¸‰å€‹è§’è‰²å…±ç”¨åŒä¸€å¥—å‰µè§’ç•«é¢ã€‚
   1=ç¬¬ä¸€è§’è‰²ã€2=ç¬¬äºŒè§’è‰²ã€3=ç¬¬ä¸‰è§’è‰²ã€‚
   ç¬¬äºŒï¼ä¸‰è§’è‰²ä¸å†ç¶­è­·å¦ä¸€ä»½ç¸®å°ç‰ˆ modalã€‚
*/
let creationTargetSlot=1;


/* =====================================================
   å‰µè§’èƒ½åŠ›
   â˜… å…¨éƒ¨å¾ž0é–‹å§‹
===================================================== */

const creationStats = {

    attack:0,
    vitality:0,
    energy:0,
    intelligence:0,
    defensePoints:0,
    agility:0

};


let creationPoints =
    START_ATTRIBUTE_POINTS;


/* =====================================================
   â˜… ç¬¬äºŒè§’è‰²ï¼ˆLv.10è§£éŽ–ï¼‰

   è·Ÿç¬¬ä¸€åè§’è‰²ï¼ˆplayerï¼‰çµæ§‹å®Œå…¨å°ç¨±ï¼Œ
   ç¨ç«‹çš„ç­‰ç´š/ç¶“é©—/å±¬æ€§/HP/SPï¼Œ
   å½¼æ­¤ä¸å…±ç”¨ï¼Œåªå…±ç”¨ç¶“é©—æ± ï¼ˆåˆ†é…æ™‚è‡ªå·±é¸è¦çµ¦èª°ï¼‰ã€‚

   player2åœ¨é‚„æ²’å‰µå»ºä¹‹å‰æ˜¯nullï¼Œ
   å­˜æª”/è®€æª”ã€UIæ¸²æŸ“éƒ½è¦å…ˆåˆ¤æ–·é€™å€‹æ˜¯ä¸æ˜¯nullã€‚
===================================================== */

let player2 = null;

/* ç¬¬ä¸‰è§’è‰²è³‡æ–™æ§½ï¼šç›®å‰å…ˆä¿ç•™ç‚º nullï¼Œä¸è‡ªè¡Œç™¼æ˜Žè§£éŽ–/å‰µè§’æ¢ä»¶ã€‚èƒŒåŒ… UI å·²å®Œæ•´æ”¯æ´ç¬¬ä¸‰è§’è‰²è³‡æ–™ã€‚ */
let player3 = null;


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œè§’è‰²é™£åˆ—é‡æ§‹
   ç¬¬ä¸€éšŽæ®µï¼‰ï¼š
   ä½¿ç”¨è€…æ˜Žç¢ºè¡¨ç¤ºä¹‹å¾Œæœƒé–‹ç™¼ç¬¬ä¸‰åè§’è‰²ï¼Œ
   ç¾åœ¨çš„player/player2å…©å€‹å„è‡ªç¨ç«‹è®Šæ•¸ã€
   æ¯å€‹è§’è‰²ä¸€å¥—å‡½å¼ï¼ˆcastDamageSkill/
   castPlayer2Skillã€getMainCharacterStats/
   getPlayer2BattleStatsâ€¦â€¦ï¼‰çš„å¯«æ³•ï¼Œ
   ä¹‹å¾Œæ¯åŠ ä¸€å€‹è§’è‰²éƒ½è¦å†è¤‡è£½ä¸€ä»½ï¼Œ
   é•·æœŸæ˜¯æŠ€è¡“å‚µã€‚

   å®Œæ•´é‡æ§‹æˆcharacters[]é™£åˆ—é¢¨éšªå¾ˆé«˜
   ï¼ˆç¾æœ‰30å¹¾å€‹å‡½å¼éƒ½è¦è·Ÿè‘—å¤§æ”¹ï¼‰ï¼Œé€™æ¬¡
   å…ˆåšä½Žé¢¨éšªçš„ç¬¬ä¸€éšŽæ®µï¼šæ–°å¢žé€™å€‹
   getCharacters()è¼”åŠ©å‡½å¼ï¼Œä¹‹å¾Œæ–°å¯«çš„
   é€šç”¨é‚è¼¯ï¼ˆä¾‹å¦‚é€™æ¬¡çš„buff/debuffç³»çµ±ï¼‰
   ä¸€å¾‹å‘¼å«é€™è£¡å–å¾—ã€Œç›®å‰å­˜åœ¨çš„å…¨éƒ¨è§’è‰²ã€ï¼Œ
   ä¸è¦å†å„è‡ªç¡¬å¯«[player,player2]ã€‚

   æ•…æ„å¯«æˆã€Œæ¯æ¬¡å‘¼å«éƒ½é‡æ–°è®€å–ã€çš„å‡½å¼ï¼Œ
   ä¸æ˜¯å®£å‘Šä¸€æ¬¡çš„éœæ…‹é™£åˆ—â€”â€”å¦‚æžœå®£å‘Šæˆ
   éœæ…‹é™£åˆ—ï¼Œplayer2å¾žnullè¢«è³¦å€¼æˆçœŸæ­£çš„
   è§’è‰²ç‰©ä»¶é‚£ä¸€åˆ»ï¼Œé™£åˆ—è£¡å­˜çš„é‚„æ˜¯èˆŠçš„null
   åƒç…§ï¼Œä¸æœƒè‡ªå‹•æ›´æ–°ã€‚ç”¨å‡½å¼ç¾å ´çµ„é™£åˆ—
   å°±æ²’æœ‰é€™å€‹å•é¡Œï¼Œplayer2æ™šä¸€é»žæ‰å‰µå»º
   ä¹Ÿä¸€æ¨£æŠ“å¾—åˆ°æœ€æ–°ç‹€æ…‹ã€‚

   ä¹‹å¾ŒçœŸçš„è¦åŠ ç¬¬ä¸‰è§’è‰²æ™‚ï¼Œåªè¦åœ¨é€™å€‹é™£åˆ—
   åŠ ä¸€è¡Œã€æŠŠè§’è‰²å‰µå»º/å­˜è®€æª”é‚è¼¯æ¯”ç…§
   player2çš„æ¨¡å¼åšä¸€ä»½ï¼Œã€Œæ–°åŠŸèƒ½ã€çš„éƒ¨åˆ†
   ï¼ˆåªè¦æœ‰ç”¨é€™å€‹å‡½å¼çš„ï¼‰å¹¾ä¹Žä¸ç”¨å†æ”¹ã€‚
   ã€ŒèˆŠåŠŸèƒ½ã€ï¼ˆcastDamageSkillé€™é¡žé‚„æ²’
   é€šç”¨åŒ–çš„æ ¸å¿ƒå‡½å¼ï¼‰åˆ°æ™‚å€™æ‰éœ€è¦é€æ­¥é·ç§»ï¼Œ
   ä¸æ˜¯é€™æ¬¡çš„ç¯„åœã€‚
*/

function getCharacters(){

    return [
        player,
        player2,
        player3
    ].filter(
        character=>
            !!character
    );

}


function normalizeCharacterIdForComparison(value){
    const trimmed=String(value||"").trim();
    const normalized=typeof trimmed.normalize==="function"
        ? trimmed.normalize("NFKC")
        : trimmed;
    return normalized.toLocaleLowerCase();
}


function isCharacterIdTaken(id){
    const normalizedId=normalizeCharacterIdForComparison(id);
    return !!normalizedId && getCharacters().some(character=>
        normalizeCharacterIdForComparison(character&&character.id)===normalizedId
    );
}


let selectedCreationElement2 =
    "fire";


const creationStats2 = {

    attack:0,
    vitality:0,
    energy:0,
    intelligence:0,
    defensePoints:0,
    agility:0

};


let creationPoints2 =
    START_ATTRIBUTE_POINTS;


/* =====================================================
   çŽ©å®¶
===================================================== */

const INITIAL_CHARACTER_SKILL_POINTS=2;

const player = {

    id:"",

    element:"fire",

    level:1,

    exp:0,

    expNext:100,

    /*
       å…­é …æ ¸å¿ƒèƒ½åŠ›
    */

    attack:0,

    vitality:0,

    energy:0,

    intelligence:0,

    defensePoints:0,

    agility:0,

    /*
       æ¯æ¬¡å‡ç´šå›ºå®šç²å¾—çš„é¡å¤–HP/SP
       ï¼ˆä¸ç®—åœ¨é«”è³ª/èƒ½é‡å…¬å¼å…§ï¼Œ
       å–®ç¨ç´¯åŠ ï¼Œç¬¦åˆè¦æ ¼ã€Œå‡ç´š +30HP +10SPã€ï¼‰
    */

    bonusHP:0,

    bonusSP:0,

    /*
       ç‹€æ…‹
    */

    hp:100,

    sp:50,

    attributePoints:0,

    skillPoints:0,

    /*
       â˜… æ–°å¢žï¼šæŠ€èƒ½buffè¿½è¹¤ï¼ˆä¾‹å¦‚æ€’ç«ï¼‰ã€‚
       é™£åˆ—å­˜æ”¾ç›®å‰ç”Ÿæ•ˆä¸­çš„buffï¼Œ
       æ¯å€‹å›žåˆæœƒéžæ¸›turnsLeftï¼Œæ­¸é›¶å°±ç§»é™¤ã€‚
    */

    activeBuffs:[],

    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
       ç‹€æ…‹ç›´æŽ¥åšã€â€”â€”æ€ªç‰©çµ‚æ–¼å¯ä»¥å°çŽ©å®¶
       é™„åŠ è² é¢æ•ˆæžœäº†ï¼‰ï¼šè·Ÿæ€ªç‰©èº«ä¸Šçš„
       monster.statusEffectsæ˜¯åŒä¸€å¥—è³‡æ–™
       çµæ§‹ã€åŒä¸€å¥—å…±ç”¨å‡½å¼
       ï¼ˆapplyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       é›–ç„¶åå­—è£¡æœ‰ã€ŒMonsterã€ï¼Œä½†é€™äº›å‡½å¼
       æœ¬ä¾†å°±åªæ“ä½œå‚³é€²åŽ»çš„ç‰©ä»¶æœ¬èº«ï¼Œæ²’æœ‰
       ä»»ä½•å¯«æ­»monsterå°ˆå±¬çš„æ¬„ä½ï¼ŒçŽ©å®¶è§’è‰²
       ç‰©ä»¶ä¸€æ¨£èƒ½ç›´æŽ¥æ²¿ç”¨ï¼Œä¸ç”¨é‡å¯«ä¸€å¥—ï¼‰ã€‚
    */

    statusEffects:[],

    /*
       â˜… æ–°å¢žï¼šé˜²ç¦¦ç‹€æ…‹ã€‚
       é¸æ“‡é˜²ç¦¦ä¹‹å¾Œè¨­ç‚ºtrueï¼Œ
       ä¸‹æ¬¡è¼ªåˆ°è‡ªå·±è¡Œå‹•æ™‚ï¼ˆbeginCharacterTurn()ï¼‰
       æœƒé‡ç½®å›žfalseã€‚
    */

    isDefending:false

};


/*
   â˜… å…±ç”¨ç¶“é©—æ± 
   æˆ°é¬¥ç²å¾—çš„EXPå…ˆé€²é€™è£¡ï¼Œ
   çŽ©å®¶è‡ªè¡ŒæŒ‰æŒ‰éˆ•åˆ†é…çµ¦è§’è‰²å‡ç´šã€‚
*/

let sharedExp = 0;

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽæ–°å¢žå•†åº—
   ç³»çµ±ï¼‰ï¼šé‡‘å¹£æ˜¯è·Ÿç¶“é©—æ± ä¸€æ¨£çš„ã€Œå…±ç”¨è³‡æºã€ï¼Œ
   ä¸åˆ†è§’è‰²ï¼Œè³£è£å‚™/å®Œæˆä»»å‹™/æˆå°±ç²å¾—çš„
   é‡‘å¹£å…¨éƒ¨é€²åŒä¸€å€‹æ± å­ï¼Œå•†åº—æ¶ˆè²»ä¹Ÿæ˜¯å¾ž
   é€™è£¡æ‰£ï¼Œè·ŸsharedExpç”¨åŒä¸€ç¨®è¨­è¨ˆé‚è¼¯ã€‚
*/

let gold = 300;

/* =====================================================
   V93 â€” é–‹ç™¼æ¸¬è©¦è³‡æº
   æ¸¬è©¦æŒ‰éˆ•æ”¹æˆã€Œæ¯æŒ‰ä¸€æ¬¡å°±ç›´æŽ¥è¿½åŠ ã€ï¼š
   é‡‘å¹£ +1,000,000ï¼›å…±ç”¨ç¶“é©—æ±  +1,000,000,000ã€‚
   ä¸å†å­˜åœ¨æœ€ä½Žå€¼ã€æ°¸ä¹…éŽ–å®šæˆ–è‡ªå‹•è£œå›žæ©Ÿåˆ¶ã€‚
===================================================== */
const TEST_GOLD_GRANT=1000000;
const TEST_EXP_POOL_GRANT=1000000000;

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽæ–°å¢žå…­å€‹
   åŠŸèƒ½ï¼šå•†åº—/è§’è‰²å±•ç¤º/æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±/
   å…¬å‘Šï¼‰ï¼š
   é€™è£¡çµ±ä¸€å®£å‘Šé€™å¹¾å€‹åŠŸèƒ½éœ€è¦çš„æŒä¹…åŒ–è³‡æ–™
   è·Ÿéœæ…‹è¨­å®šè³‡æ–™ã€‚

   dailyQuestStateï¼šæ¯æ—¥ä»»å‹™é€²åº¦ï¼Œ
   dateè¨˜éŒ„ã€Œä¸Šæ¬¡é‡ç½®æ˜¯å“ªä¸€å¤©ã€ï¼Œæ¯æ¬¡çŽ©å®¶
   æ‰“é–‹ä»»å‹™æ¸…å–®æ™‚æœƒæª¢æŸ¥ä»Šå¤©çš„æ—¥æœŸè·Ÿé€™å€‹
   dateæ˜¯å¦ç›¸åŒï¼Œä¸åŒçš„è©±ä»£è¡¨è·¨å¤©äº†ï¼Œ
   é€²åº¦/é ˜å–ç‹€æ…‹å…¨éƒ¨é‡ç½®ã€‚

   bestiaryDataï¼šåœ–é‘‘ï¼Œkeyæ˜¯æ€ªç‰©åç¨±ï¼Œ
   ç´€éŒ„æœ‰æ²’æœ‰è¦‹éŽã€ç´¯è¨ˆæ“Šæ®ºæ•¸ã€‚

   achievementStateï¼šæˆå°±ï¼Œkeyæ˜¯æˆå°±idï¼Œ
   ç´€éŒ„æœ‰æ²’æœ‰å·²ç¶“é ˜å–éŽçŽå‹µ
   ï¼ˆæˆå°±æœ¬èº«é”æˆèˆ‡å¦æ˜¯å³æ™‚ç”¨
   checkAchievementCondition()åˆ¤æ–·ï¼Œ
   ä¸éœ€è¦å¦å¤–å­˜ã€Œæœ‰æ²’æœ‰é”æˆã€ï¼Œåªéœ€è¦å­˜
   ã€Œæœ‰æ²’æœ‰é ˜éŽã€ï¼Œä¸ç„¶é‡è¤‡åˆ¤æ–·é‚è¼¯æœƒ
   åˆ†æ•£åœ¨å­˜æª”/è®€æª”/ç•«é¢ä¸‰å€‹åœ°æ–¹ï¼‰ã€‚
*/

let dailyQuestState={

    date:"",

    progress:{
        checkin:0,
        killMonsters:0,
        winBattle:0
    },

    claimed:{
        checkin:false,
        killMonsters:false,
        winBattle:false
    }

};


const dailyQuestDefinitions=[

    {
        id:"checkin",
        name:"ä»Šæ—¥ç°½åˆ°",
        desc:"æ‰“é–‹æ¯æ—¥ä»»å‹™æ¸…å–®å³å®Œæˆ",
        goal:1,
        reward:{gold:50}
    },

    {
        id:"killMonsters",
        name:"æ“Šæ•—5éš»æ€ªç‰©",
        desc:"ä»Šå¤©ç´¯è¨ˆæ“Šæ•—5éš»æ€ªç‰©",
        goal:5,
        reward:{gold:100,exp:50}
    },

    {
        id:"winBattle",
        name:"æ‰“è´1å ´æˆ°é¬¥",
        desc:"ä»Šå¤©æ‰“è´ä¸€å ´å®Œæ•´æˆ°é¬¥",
        goal:1,
        reward:{gold:80}
    }

];


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä»»å‹™æ”¹æˆå…©å€‹
   åˆ†é ï¼šæ¯æ—¥ä»»å‹™ï¼å§”è¨—ä»»å‹™ï¼‰ï¼š
   å§”è¨—ä»»å‹™è·Ÿæ¯æ—¥ä»»å‹™å…±ç”¨åŒä¸€å¥—ã€Œæ¯å¤©
   é‡ç½®ã€çš„é€±æœŸï¼ˆensureDailyQuestsCurrent()
   æœƒä¸€èµ·è™•ç†å…©é‚Šï¼‰ï¼Œå·®åˆ¥åªåœ¨ç›®æ¨™æ•¸å­—
   è¨‚å¾—æ›´é«˜ã€çŽå‹µæ›´å¥½ï¼Œé¼“å‹µçŽ©å®¶çœŸçš„èŠ±
   å¿ƒåŠ›åŽ»é”æˆï¼Œä¸æ˜¯æ¯æ—¥ä»»å‹™é‚£ç¨®è¼•é¬†
   éš¨æ‰‹å®Œæˆçš„ç­‰ç´šã€‚

   é€²åº¦ä¾†æºåˆ»æ„æ²¿ç”¨è·Ÿæ¯æ—¥ä»»å‹™ä¸€æ¨£çš„
   killMonsters/winBattleäº‹ä»¶ï¼ˆè¦‹
   recordMonsterKillForBestiary()ï¼
   winBattle()è£¡ï¼Œå…©é‚Šçš„é€²åº¦æœƒåŒæ™‚è¢«
   ç´¯åŠ ï¼‰ï¼Œä¸ç”¨å¦å¤–è¨­è¨ˆã€å¦å¤–åŸ‹æ–°çš„
   è¿½è¹¤é‰¤å­ã€‚
*/

let commissionQuestState={

    date:"",

    progress:{
        killMonsters:0,
        winBattle:0
    },

    claimed:{
        killMonsters:false,
        winBattle:false
    }

};


const commissionQuestDefinitions=[

    {
        id:"killMonsters",
        name:"å§”è¨—ï¼šæ“Šæ•—15éš»æ€ªç‰©",
        desc:"ä»Šå¤©ç´¯è¨ˆæ“Šæ•—15éš»æ€ªç‰©",
        goal:15,
        reward:{gold:250}
    },

    {
        id:"winBattle",
        name:"å§”è¨—ï¼šæ‰“è´3å ´æˆ°é¬¥",
        desc:"ä»Šå¤©æ‰“è´ä¸‰å ´å®Œæ•´æˆ°é¬¥",
        goal:3,
        reward:{gold:200,exp:150}
    }

];


let bestiaryData={};


let achievementState={};


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé›¢ç·šç¶“é©—ç³»çµ±ï¼‰ï¼š
   é›¢ç·šç¶“é©—çš„æ ¸å¿ƒåƒæ•¸è·Ÿç‹€æ…‹ï¼ŒloadGame()
   è®€æª”æ™‚æœƒä¾ç…§ä¸Šæ¬¡å­˜æª”æ™‚é–“ç®—å‡º
   pendingOfflineExpï¼ŒçŽ©å®¶åœ¨ä¸»åŸŽã€Œé›¢ç·š
   ç¶“é©—ã€é‚£å¼µå¡ç‰‡æŒ‰ä¸‹é ˜å–æ‰æœƒçœŸçš„åŠ é€²
   ç¶“é©—æ± ã€‚
*/

const OFFLINE_EXP_PER_MINUTE=
    10;

const OFFLINE_EXP_MAX_MINUTES=
    480;

let pendingOfflineExp=
    0;

let offlineElapsedMinutesForDisplay=
    0;

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œã€Œåˆ‡åˆ°èƒŒæ™¯
   å†åˆ‡å›žä¾†ï¼Œåˆ°åº•æœ‰æ²’æœ‰ç®—é›¢ç·šç¶“é©—ã€ï¼‰ï¼š
   åŽŸæœ¬é›¢ç·šç¶“é©—çš„è¨ˆç®—é‚è¼¯æ•´æ®µå¯«æ­»åœ¨
   loadGame()è£¡ï¼Œåªæœ‰ç¶²é ã€Œç¬¬ä¸€æ¬¡è¼‰å…¥ã€
   æ‰æœƒåŸ·è¡Œåˆ°â€”â€”å–®ç´”åˆ‡åˆ°èƒŒæ™¯ã€å†åˆ‡å›ž
   å‰æ™¯ï¼ˆæ²’æœ‰çœŸçš„é—œé–‰åˆ†é é‡æ–°æ•´ç†ï¼‰ï¼Œ
   å®Œå…¨ä¸æœƒè§¸ç™¼è¨ˆç®—ï¼Œé€™æ˜¯ä½¿ç”¨è€…ç™¼ç¾çš„
   çœŸå¯¦æ¼æ´žï¼Œä¸æ˜¯èª¤æœƒã€‚

   æŠŠè¨ˆç®—é‚è¼¯æŠ½æˆé€™å€‹å…±ç”¨å‡½å¼ï¼Œ
   loadGame()ï¼ˆç¶²é ç¬¬ä¸€æ¬¡è¼‰å…¥ï¼‰è·Ÿ
   visibilitychangeåˆ‡å›žå‰æ™¯é€™å…©å€‹æ™‚æ©Ÿ
   éƒ½æœƒå‘¼å«é€™è£¡ï¼Œå…©ç¨®æƒ…æ³éƒ½èƒ½æ­£ç¢ºç´¯ç©
   é›¢ç·šç¶“é©—ï¼Œä¸ç”¨æ•´å€‹é‡æ–°æ•´ç†é é¢æ‰ç®—ã€‚

   å¤šæ¬¡è§¸ç™¼ä¹Ÿä¸æœƒé‡è¤‡å¤šç®—ï¼šæ¯æ¬¡éƒ½æ˜¯
   æ‹¿ã€Œç¾åœ¨æ™‚é–“ã€æ¸›ã€Œä¸Šä¸€æ¬¡è¨˜éŒ„çš„æ™‚é–“é»žã€ï¼Œ
   ç®—å®Œç«‹åˆ»æŠŠæ™‚é–“é»žæ›´æ–°æˆç¾åœ¨ï¼Œä¸‹ä¸€æ¬¡
   è§¸ç™¼åªæœƒç®—ã€Œé€™ä¸€æ®µæ–°çš„é›¢ç·šæ™‚é–“ã€ï¼Œ
   ä¸æœƒæŠŠä¹‹å‰å·²ç¶“ç®—éŽçš„å€é–“å†ç®—ä¸€æ¬¡ã€‚
*/

let lastOfflineCheckTimestamp=
    Date.now();


/* =====================================================
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå¾ˆå¤šåœ°æ–¹éƒ½è¦
   åŠ çœ‹å»£å‘Šã€ï¼Œå…ˆåšå¥½é€šç”¨æž¶æ§‹ï¼‰ï¼š

   showRewardedAd(onSuccess, onFail)â€”â€”
   å…¨éŠæˆ²ã€Œçœ‹å»£å‘Šæ›çŽå‹µã€å”¯ä¸€çš„å…¥å£ï¼Œ
   ä¸ç®¡æ˜¯é›¢ç·šç¶“é©—é›™å€ã€ä¹‹å¾Œä»»å‹™åŠ æˆã€
   å•†åº—é¡å¤–é“å…·â€¦â€¦ä»»ä½•æƒ³åŠ ã€Œçœ‹å»£å‘Šã€çš„
   åœ°æ–¹ï¼Œéƒ½å‘¼å«é€™ä¸€å€‹å‡½å¼ï¼Œå·®åˆ¥åªåœ¨
   çµ¦çš„onSuccessï¼ˆå»£å‘Šçœ‹å®Œå¾Œè¦åšä»€éº¼ï¼‰
   ä¸ä¸€æ¨£ã€‚

   â˜… é‡è¦ï¼šç›®å‰AD_SYSTEM_READYæ˜¯falseï¼Œ
   ä»£è¡¨é‚„æ²’ç”³è«‹åˆ°çœŸçš„AdSense/AdMobå¸³è™Ÿï¼Œ
   é€™è£¡å…ˆç”¨ã€Œæ¨¡æ“¬æ’­æ”¾ã€é ‚è‘—ï¼ˆé¡¯ç¤ºæç¤ºã€
   ç­‰1.5ç§’ã€ç›´æŽ¥ç•¶ä½œçœ‹å®Œï¼‰ï¼Œè®“ä½ å¯ä»¥å…ˆ
   æ¸¬è©¦ã€Œé›™å€çŽå‹µã€é€™é¡žé‚è¼¯å°ä¸å°ï¼Œä¸ç”¨
   ç­‰å»£å‘Šå¸³è™Ÿç”³è«‹ä¸‹ä¾†æ‰èƒ½æ¸¬ã€‚

   â˜… ä¹‹å¾Œç”³è«‹åˆ°çœŸçš„å»£å‘Šå¸³è™Ÿï¼ŒæŠŠ
   AD_SYSTEM_READYæ”¹æˆtrueï¼Œä¸¦ä¸”æŠŠ
   ä¸‹é¢æ¨™ç¤ºã€ŒçœŸæ­£ä¸²æŽ¥å»£å‘ŠAPIçš„åœ°æ–¹ã€
   é‚£ä¸€æ®µï¼Œæ›æˆçœŸæ­£å‘¼å«Google Ad
   Placement APIçš„adBreak()ï¼ˆæˆ–ä½ æœ€å¾Œ
   é¸ç”¨çš„å»£å‘Šæœå‹™å•†çš„APIï¼‰â€”â€”åªè¦æ”¹é€™è£¡
   ä¸€å€‹å‡½å¼ï¼Œå…¨éŠæˆ²æ‰€æœ‰ç”¨åˆ°
   showRewardedAd()çš„åœ°æ–¹æœƒä¸€èµ·è‡ªå‹•
   è®ŠæˆçœŸå»£å‘Šï¼Œä¸ç”¨ä¸€å€‹å€‹åŠŸèƒ½åˆ†åˆ¥åŽ»æ”¹ã€‚
*/

const AD_SYSTEM_READY=
    false;


function showRewardedAd(
    onSuccess,
    onFail
){

    if(!AD_SYSTEM_READY){

        /*
           â˜… æ¨¡æ“¬å»£å‘Šæ’­æ”¾ï¼ˆç›®å‰ç‹€æ…‹ï¼‰ï¼š
           é¡¯ç¤ºæç¤ºã€ç­‰1.5ç§’ã€ç›´æŽ¥è¦–ç‚º
           çœ‹å®ŒæˆåŠŸã€‚ç´”ç²¹æ˜¯ç‚ºäº†è®“ã€Œé›™å€
           çŽå‹µã€é€™é¡žé‚è¼¯ç¾åœ¨å°±èƒ½æ¸¬è©¦ï¼Œ           ä¸æ˜¯çœŸçš„å»£å‘Šã€‚
        */

        addBattleLog(
            "ï¼ˆæ¨¡æ“¬ï¼‰å»£å‘Šæ’­æ”¾ä¸­â€¦"
        );


        setTimeout(()=>{

            addBattleLog(
                "ï¼ˆæ¨¡æ“¬ï¼‰å»£å‘Šæ’­æ”¾å®Œæˆï¼"
            );


            if(onSuccess){

                onSuccess();

            }

        },1500);


        return;

    }


    /*
       â˜… çœŸæ­£ä¸²æŽ¥å»£å‘ŠAPIçš„åœ°æ–¹ï¼ˆç­‰ç”³è«‹åˆ°
       AdSense/AdMobå¸³è™Ÿå¾Œï¼ŒæŠŠä¸‹é¢é€™æ®µ
       æ›æˆçœŸæ­£çš„å‘¼å«ï¼‰ï¼š

       ç¯„ä¾‹ï¼ˆGoogle Ad Placement APIï¼Œ
       ç´”ç¶²é ç‰ˆï¼‰ï¼š

       window.adBreak({
           type:'reward',
           name:'offline-exp-double',
           beforeReward:(showAdFn)=>{
               showAdFn();
           },
           adViewed:()=>{
               onSuccess&&onSuccess();
           },
           adDismissed:()=>{
               onFail&&onFail();
           },
           adBreakDone:()=>{}
       });
    */

    if(onFail){

        onFail();

    }

}

function calculateOfflineExpSince(
    previousTimestamp
){

    if(
        !Number.isFinite(
            previousTimestamp
        )
    ){
        return;
    }


    const elapsedMs=

        Date.now()-
        previousTimestamp;


    const elapsedMinutes=

        Math.max(
            0,
            Math.floor(
                elapsedMs/60000
            )
        );


    /*
       åˆ‡èƒŒæ™¯æ™‚é–“å¤ªçŸ­ï¼ˆå°‘æ–¼1åˆ†é˜ï¼‰ä¸ç‰¹åˆ¥
       è™•ç†ï¼Œé¿å…çŽ©å®¶åªæ˜¯åˆ‡å‡ºåŽ»çœ‹ä¸€ä¸‹
       é€šçŸ¥é¦¬ä¸Šåˆ‡å›žä¾†ï¼Œä¹Ÿè·³å‡ºä¸€å‰‡ã€Œé›¢ç·š
       ç¶“é©—ã€çš„è¨Šæ¯ï¼Œæ„Ÿè¦ºå¾ˆé›œè¨Šã€‚
    */

    if(elapsedMinutes<1){
        return;
    }


    const cappedMinutes=

        Math.min(
            elapsedMinutes,
            OFFLINE_EXP_MAX_MINUTES
        );


    pendingOfflineExp=

        pendingOfflineExp+
        cappedMinutes*
        OFFLINE_EXP_PER_MINUTE;


    offlineElapsedMinutesForDisplay=

        offlineElapsedMinutesForDisplay+
        elapsedMinutes;

}


const achievementDefinitions=[

    {
        id:"firstKill",
        name:"åˆæ¬¡äº¤æ‰‹",
        desc:"ç´¯è¨ˆæ“Šæ•—1éš»æ€ªç‰©",
        reward:{gold:20},
        check:()=>
            getTotalMonsterKills()>=1
    },

    {
        id:"kill50",
        name:"å°æœ‰æˆ°ç¸¾",
        desc:"ç´¯è¨ˆæ“Šæ•—50éš»æ€ªç‰©",
        reward:{gold:100},
        check:()=>
            getTotalMonsterKills()>=50
    },

    {
        id:"kill200",
        name:"èº«ç¶“ç™¾æˆ°",
        desc:"ç´¯è¨ˆæ“Šæ•—200éš»æ€ªç‰©",
        reward:{gold:300},
        check:()=>
            getTotalMonsterKills()>=200
    },

    {
        id:"level20",
        name:"å¶„éœ²é ­è§’",
        desc:"ä»»ä¸€è§’è‰²ç­‰ç´šé”åˆ°20",
        reward:{gold:150},
        check:()=>

            player.level>=20 ||
            (
                player2 &&
                player2.level>=20
            )
    },

    {
        id:"level50",
        name:"ç¨ç•¶ä¸€é¢",
        desc:"ä»»ä¸€è§’è‰²ç­‰ç´šé”åˆ°50",
        reward:{gold:500},
        check:()=>

            player.level>=50 ||
            (
                player2 &&
                player2.level>=50
            )
    },

    {
        id:"duo",
        name:"é›™äººæˆè¡Œ",
        desc:"å‰µå»ºç¬¬äºŒä½è§’è‰²",
        reward:{gold:100},
        check:()=>
            !!player2
    },

    {
        id:"gold1000",
        name:"å°å¯Œç¿",
        desc:"é‡‘å¹£é”åˆ°1000",
        reward:{gold:100},
        check:()=>
            gold>=1000
    }

];


/* =====================================================
   V91 â€” çµ±ä¸€è—¥æ°´è³‡æ–™ä¾†æº

   å•†åº—ã€èƒŒåŒ…ã€æˆ°é¬¥éƒ½åªèªé€™å…­å€‹ potionDefinitionsã€‚
   ä¸å†ä½¿ç”¨ player.hpPotions / player.spPotions
   é€™å¥—ç¨ç«‹æˆ°é¬¥åº«å­˜ã€‚
===================================================== */

const potionDefinitions=[
    {
        id:"hpPotion10",
        name:"å›žå¾©10%HPè—¥æ°´",
        shortName:"HP 10%",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:10,
        price:20,
        stats:{}
    },
    {
        id:"spPotion10",
        name:"å›žå¾©10%SPè—¥æ°´",
        shortName:"SP 10%",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:10,
        price:25,
        stats:{}
    },
    {
        id:"hpPotion50",
        name:"å›žå¾©50%çš„HPè—¥æ°´",
        shortName:"HP 50%",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:50,
        price:80,
        stats:{}
    },
    {
        id:"spPotion50",
        name:"å›žå¾©50%çš„SPè—¥æ°´",
        shortName:"SP 50%",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:50,
        price:100,
        stats:{}
    },
    {
        id:"hpPotion100",
        name:"å›žå¾©æ‰€æœ‰HPçš„è—¥æ°´",
        shortName:"HP å…¨å›žå¾©",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:100,
        price:180,
        stats:{}
    },
    {
        id:"spPotion100",
        name:"å›žå¾©æ‰€æœ‰SPçš„è—¥æ°´",
        shortName:"SP å…¨å›žå¾©",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:100,
        price:220,
        stats:{}
    }
];

const shopItems=potionDefinitions;

/*
   50% HP/SP potions are retired from the backpack surface.
   Keep the legacy definitions readable so old saves can still be parsed
   without mutating player data; new content must not award these IDs.
*/
const RETIRED_BACKPACK_POTION_IDS=new Set([
    "hpPotion50",
    "spPotion50"
]);

/* =====================================================
   V92 â€” èƒŒåŒ…å †ç–Šè¦å‰‡
   - è£å‚™é¡žï¼šæ¯æ ¼æœ€å¤š 1 ä»¶ã€‚
   - å…¶é¤˜é¡žåž‹ï¼šæ¯æ ¼æœ€å¤š 999 ä»¶ã€‚
   - è¶…éŽä¸Šé™æœƒè‡ªå‹•å»ºç«‹ä¸‹ä¸€å€‹å †ç–Šï¼Œä¸è®“å–®æ ¼çªç ´ä¸Šé™ã€‚
===================================================== */

const INVENTORY_MAX_STACK_DEFAULT=999;

function isEquipmentInventoryType(type){
    return [
        "weapon",
        "helmet",
        "head",
        "hand",
        "shoulder",
        "armor",
        "shoes",
        "accessory",
        "ring"
    ].includes(type);
}

function getInventoryItemMaxStack(item){
    if(!item){
        return INVENTORY_MAX_STACK_DEFAULT;
    }

    return isEquipmentInventoryType(item.type)
        ? 1
        : INVENTORY_MAX_STACK_DEFAULT;
}

function cloneInventoryStackItem(item,count){
    const copy={...item};
    copy.stats=item && item.stats && typeof item.stats==="object"
        ? {...item.stats}
        : {};
    copy.count=Math.max(1,Math.floor(Number(count)||1));
    return copy;
}

function normalizeInventoryStacks(){
    const needsNormalization=inventoryItems.some(item=>{
        if(!item || !item.id){
            return true;
        }

        const count=Number(item.count);
        const maxStack=getInventoryItemMaxStack(item);

        return (
            !Number.isFinite(count) ||
            count<1 ||
            Math.floor(count)!==count ||
            count>maxStack
        );
    });

    if(!needsNormalization){
        return;
    }

    const normalized=[];

    inventoryItems.forEach(item=>{
        if(!item || !item.id){
            return;
        }

        const maxStack=getInventoryItemMaxStack(item);
        const numericCount=Number(item.count);
        let remaining=Number.isFinite(numericCount)
            ? Math.floor(numericCount)
            : 1;

        if(remaining<=0){
            return;
        }

        while(remaining>0 && normalized.length<120){
            const stackCount=Math.min(maxStack,remaining);
            normalized.push(cloneInventoryStackItem(item,stackCount));
            remaining-=stackCount;
        }

        if(remaining>0){
            console.warn(
                "èƒŒåŒ…å †ç–Šè¶…éŽ120æ ¼å®¹é‡ï¼Œå‰©é¤˜ç‰©å“æœªèƒ½æ”¾å…¥ï¼š",
                item.id,
                remaining
            );
        }
    });

    inventoryItems.length=0;
    normalized.forEach(item=>inventoryItems.push(item));
}

function getPotionDefinition(potionId){
    return potionDefinitions.find(
        item=>item.id===potionId
    )||null;
}

function getPotionEffectDescription(potionId){
    const definition=getPotionDefinition(potionId);
    if(!definition){
        return "æœªçŸ¥æ•ˆæžœ";
    }

    const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
    return definition.recoveryPercent>=100
        ? `å›žå¾©æ‰€æœ‰${resourceLabel}`
        : `å›žå¾©æœ€å¤§${resourceLabel}çš„ ${definition.recoveryPercent}%`;
}

function createPotionInventoryItem(potionId,count=1){
    const definition=getPotionDefinition(potionId);

    if(!definition){
        return null;
    }

    return{
        id:definition.id,
        name:definition.name,
        icon:definition.icon,
        type:"potion",
        resource:definition.resource,
        recoveryPercent:definition.recoveryPercent,
        count:Math.min(
            INVENTORY_MAX_STACK_DEFAULT,
            Math.max(1,Math.floor(Number(count)||1))
        ),
        price:Number.isFinite(definition.price) ? definition.price : 0,
        stats:{}
    };
}

function getPotionInventoryItems(potionId){
    return inventoryItems.filter(
        item=>item && item.id===potionId
    );
}

function getPotionInventoryItem(potionId){
    return getPotionInventoryItems(potionId)[0]||null;
}

function getPotionCount(potionId){
    return getPotionInventoryItems(potionId).reduce(
        (total,item)=>total+Math.max(0,Number(item.count)||0),
        0
    );
}

function getTotalPotionCount(resource=null){
    return potionDefinitions.reduce((total,definition)=>{
        if(resource && definition.resource!==resource){
            return total;
        }
        return total+getPotionCount(definition.id);
    },0);
}

function addPotionToInventory(potionId,amount=1){
    const definition=getPotionDefinition(potionId);
    const quantity=Math.max(1,Math.floor(Number(amount)||1));

    if(!definition){
        return false;
    }

    const stacks=getPotionInventoryItems(potionId);
    const stackFreeSpace=stacks.reduce(
        (total,item)=>
            total+Math.max(0,INVENTORY_MAX_STACK_DEFAULT-(Number(item.count)||0)),
        0
    );
    const freeSlots=Math.max(0,120-inventoryItems.length);
    const totalCapacity=
        stackFreeSpace+
        freeSlots*INVENTORY_MAX_STACK_DEFAULT;

    if(quantity>totalCapacity){
        return false;
    }

    let remaining=quantity;

    stacks.forEach(stack=>{
        if(remaining<=0){
            return;
        }

        const current=Math.max(0,Math.floor(Number(stack.count)||0));
        const space=Math.max(0,INVENTORY_MAX_STACK_DEFAULT-current);
        const add=Math.min(space,remaining);

        stack.count=current+add;
        stack.name=definition.name;
        stack.type="potion";
        stack.resource=definition.resource;
        stack.recoveryPercent=definition.recoveryPercent;
        stack.price=Number.isFinite(definition.price) ? definition.price : (Number(stack.price)||0);
        stack.stats={};
        remaining-=add;
    });

    while(remaining>0){
        const stackCount=Math.min(INVENTORY_MAX_STACK_DEFAULT,remaining);
        const created=createPotionInventoryItem(potionId,stackCount);

        if(!created){
            return false;
        }

        inventoryItems.push(created);
        remaining-=stackCount;
    }

    return true;
}

function consumePotionFromInventory(potionId,amount=1){
    let remaining=Math.max(1,Math.floor(Number(amount)||1));

    if(getPotionCount(potionId)<remaining){
        return false;
    }

    for(let index=inventoryItems.length-1;index>=0 && remaining>0;index--){
        const item=inventoryItems[index];

        if(!item || item.id!==potionId){
            continue;
        }

        const current=Math.max(0,Math.floor(Number(item.count)||0));
        const used=Math.min(current,remaining);
        const next=current-used;
        remaining-=used;

        if(next<=0){
            inventoryItems.splice(index,1);
        }else{
            item.count=next;
        }
    }

    rebuildInventorySlots();
    return true;
}

/*
   èˆŠ V90 å­˜æª”æœ‰å…©å¥—è—¥æ°´åº«å­˜ï¼š
   inventoryItems è£¡çš„ hpPotion/spPotionï¼Œ
   ä»¥åŠ player.hpPotions/player.spPotionsã€‚
   V92 ä»æœƒæŠŠå®ƒå€‘å®‰å…¨æ˜ å°„æˆ 10% è—¥æ°´ï¼Œä¸¦éµå®ˆæ¯ç–Š100ä¸Šé™ã€‚
*/
function normalizePotionInventoryFromLegacy(saveData){
    const legacyPlayer=
        saveData && saveData.player
        ? saveData.player
        : {};

    const legacyHpBattle=Number(legacyPlayer.hpPotions);
    const legacySpBattle=Number(legacyPlayer.spPotions);

    let legacyHpBag=0;
    let legacySpBag=0;

    inventoryItems.forEach(item=>{
        if(!item){
            return;
        }
        if(item.id==="hpPotion"){
            legacyHpBag+=Math.max(0,Number(item.count)||0);
        }
        if(item.id==="spPotion"){
            legacySpBag+=Math.max(0,Number(item.count)||0);
        }
    });

    for(let index=inventoryItems.length-1;index>=0;index--){
        const id=inventoryItems[index] && inventoryItems[index].id;
        if(id==="hpPotion" || id==="spPotion"){
            inventoryItems.splice(index,1);
        }
    }

    potionDefinitions.forEach(definition=>{
        getPotionInventoryItems(definition.id).forEach(item=>{
            item.name=definition.name;
            item.icon=definition.icon;
            item.type="potion";
            item.resource=definition.resource;
            item.recoveryPercent=definition.recoveryPercent;
            item.price=Number.isFinite(definition.price) ? definition.price : (Number(item.price)||0);
            item.stats={};
            item.count=Math.max(1,Math.floor(Number(item.count)||1));
        });
    });

    normalizeInventoryStacks();

    const existingHp10=getPotionCount("hpPotion10");
    const existingSp10=getPotionCount("spPotion10");

    const hpLegacyCount=Math.max(
        existingHp10,
        legacyHpBag,
        Number.isFinite(legacyHpBattle) ? Math.max(0,legacyHpBattle) : 0
    );
    const spLegacyCount=Math.max(
        existingSp10,
        legacySpBag,
        Number.isFinite(legacySpBattle) ? Math.max(0,legacySpBattle) : 0
    );

    if(hpLegacyCount>existingHp10){
        addPotionToInventory(
            "hpPotion10",
            hpLegacyCount-existingHp10
        );
    }

    if(spLegacyCount>existingSp10){
        addPotionToInventory(
            "spPotion10",
            spLegacyCount-existingSp10
        );
    }

    normalizeInventoryStacks();

    delete player.hpPotions;
    delete player.spPotions;
    rebuildInventorySlots();
}

function getAutoPotionId(resource){
    const ids=potionDefinitions
        .filter(definition=>definition.resource===resource)
        .sort((a,b)=>a.recoveryPercent-b.recoveryPercent)
        .map(definition=>definition.id);

    return ids.find(id=>getPotionCount(id)>0)||null;
}

let battleItemCategory="potion";

function getBattleTalismanInventoryItems(){
    const byId=new Map();

    inventoryItems.forEach(item=>{
        if(
            !item ||
            item.type!=="talisman" ||
            !item.id
        ){
            return;
        }

        const count=Math.max(0,Math.floor(Number(item.count)||0));
        if(count<=0){
            return;
        }

        if(!byId.has(item.id)){
            byId.set(item.id,{
                ...item,
                count:0
            });
        }

        byId.get(item.id).count+=count;
    });

    return Array.from(byId.values());
}

function setBattleItemCategory(category){
    if(category!=="potion" && category!=="talisman"){
        return;
    }

    battleItemCategory=category;
    renderBattleItemMenu();
}

function battleItemIconMarkup(item){
    const raw=String(item&&item.icon||"").trim();
    if(!raw){ return ""; }
    if(raw.indexOf("<img")>=0||raw.indexOf("<svg")>=0||raw.indexOf("<span")>=0){ return raw; }
    const escaped=raw.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return '<img src="'+escaped+'" alt="" aria-hidden="true" draggable="false" decoding="async">';
}

function renderBattleItemMenu(){
    const list=$("battlePotionList");
    const potionTab=$("battleItemPotionTab");
    const talismanTab=$("battleItemTalismanTab");

    if(!list){
        return;
    }

    const potionActive=battleItemCategory==="potion";

    if(potionTab){
        potionTab.classList.toggle("active",potionActive);
        potionTab.setAttribute("aria-selected",potionActive ? "true" : "false");
    }

    if(talismanTab){
        talismanTab.classList.toggle("active",!potionActive);
        talismanTab.setAttribute("aria-selected",!potionActive ? "true" : "false");
    }

    if(potionActive){
        const available=potionDefinitions.filter(
            definition=>getPotionCount(definition.id)>0
        );

        if(available.length===0){
            list.innerHTML=`
                <div class="battle-item-empty">
                    <strong>ç›®å‰æ²’æœ‰è£œå“</strong>
                    <span>å•†åº—è³¼è²·çš„ HPï¼SP è—¥æ°´æœƒç›´æŽ¥é¡¯ç¤ºåœ¨é€™è£¡ã€‚</span>
                </div>
            `;
            return;
        }

        list.innerHTML=available.map(definition=>{
            const count=getPotionCount(definition.id);
            const resourceLabel=definition.resource==="hp" ? "HP" : "SP";
            const effectLabel=definition.recoveryPercent>=100
                ? `${resourceLabel} å…¨å›žå¾©`
                : `${resourceLabel} +${definition.recoveryPercent}%`;
            const iconMarkup=battleItemIconMarkup(definition);

            return `
                <button
                    type="button"
                    class="battle-item-card ${definition.resource}"
                    onclick="usePotion('${definition.id}')"
                    title="${definition.name}"
                >
                    <span class="battle-item-icon">${iconMarkup}</span>
                    <span class="battle-item-name">${definition.shortName}</span>
                    <span class="battle-item-effect">${effectLabel}</span>
                    <span class="battle-item-count">Ã—${count}</span>
                </button>
            `;
        }).join("");

        return;
    }

    const talismans=getBattleTalismanInventoryItems();

    if(talismans.length===0){
        list.innerHTML=`
            <div class="battle-item-empty">
                <strong>ç›®å‰æ²’æœ‰ç¬¦å’’</strong>
                <span>ä¹‹å¾Œå–å¾—å†°å°ç¬¦ã€çµç•Œç¬¦ç­‰æˆ°é¬¥ç¬¦å’’æ™‚ï¼Œæœƒé¡¯ç¤ºåœ¨é€™å€‹é ç±¤ã€‚</span>
            </div>
        `;
        return;
    }

    /*
       ç›®å‰å°ˆæ¡ˆé‚„æ²’æœ‰æ­£å¼ç¬¦å’’ç‰©å“è¦æ ¼ï¼ˆskillIdã€æŠ€èƒ½ç­‰ç´šã€
       æ˜¯å¦æ¶ˆè€—SPã€ç›®æ¨™è¦å‰‡å°šæœªå¯«å…¥ Project Knowledgeï¼‰ï¼Œ
       æ‰€ä»¥é€™è£¡åªå¿ å¯¦åˆ—å‡ºåº«å­˜ï¼Œä¸æ“…è‡ªè®“å®ƒæ–½æ”¾æŸå€‹æŠ€èƒ½ã€‚
       ç­‰ç¬¬ä¸€å¼µæ­£å¼ç¬¦å’’è¦æ ¼ç¢ºå®šå¾Œï¼Œå†æŠŠé»žæ“Šè¡Œç‚ºæŽ¥é€²æ—¢æœ‰
       æŠ€èƒ½å¼•æ“Žï¼Œé¿å…å…ˆå¯«ä¸€å¥—éŒ¯çš„ç¬¦å’’å…¬å¼ã€‚
    */
    list.innerHTML=talismans.map(item=>{
        const linkedSkill=item.skillId && skillDatabase[item.skillId]
            ? skillDatabase[item.skillId]
            : null;
        const skillLabel=linkedSkill
            ? linkedSkill.name+(item.skillLevel ? ` Lv.${item.skillLevel}` : "")
            : "å°šæœªè¨­å®šæŠ€èƒ½";

        return `
            <button
                type="button"
                class="battle-item-card talisman"
                disabled
                title="${item.name||item.id}"
            >
                <span class="battle-item-icon">${battleItemIconMarkup(item)}</span>
                <span class="battle-item-name">${item.name||item.id}</span>
                <span class="battle-item-effect">${skillLabel}</span>
                <span class="battle-item-count">Ã—${item.count}</span>
            </button>
        `;
    }).join("");
}

/* ä¿ç•™èˆŠå‡½å¼åç¨±ï¼Œé¿å…æ—¢æœ‰ usePotion() çš„åº«å­˜åˆ·æ–°è·¯å¾‘å¤±æ•ˆã€‚ */
function renderBattlePotionMenu(){
    battleItemCategory="potion";
    renderBattleItemMenu();
}


/*
   â˜… åœ–é‘‘æ“Šæ®ºç´€éŒ„â€”â€”killMonster()è£¡å”¯ä¸€çš„
   å‘¼å«é»žï¼Œè¦‹ä¸Šé¢killMonster()çš„ä¿®æ”¹ã€‚
*/

function recordMonsterKillForBestiary(
    monster
){

    if(!monster||!monster.name){
        return;
    }


    if(!bestiaryData[monster.name]){

        bestiaryData[monster.name]={
            seen:true,
            kills:0
        };

    }


    bestiaryData[monster.name].seen=
        true;

    bestiaryData[monster.name].kills=
        (
            bestiaryData[monster.name].kills||
            0
        )+1;


    ensureDailyQuestsCurrent();

    dailyQuestState.progress.killMonsters=
        Math.min(

            dailyQuestDefinitions.find(
                q=>q.id==="killMonsters"
            ).goal,

            (
                dailyQuestState.progress.killMonsters||
                0
            )+1

        );


    /*
       â˜… æ–°å¢žï¼šå§”è¨—ä»»å‹™çš„æ“Šæ®ºé€²åº¦ï¼Œ
       è·Ÿæ¯æ—¥ä»»å‹™åŒä¸€å€‹äº‹ä»¶ä¾†æºï¼Œä¸€èµ·
       ç´¯åŠ ï¼Œä¸ç”¨å¦å¤–åŸ‹é‰¤å­ã€‚
    */

    commissionQuestState.progress.killMonsters=
        Math.min(

            commissionQuestDefinitions.find(
                q=>q.id==="killMonsters"
            ).goal,

            (
                commissionQuestState.progress.killMonsters||
                0
            )+1

        );

}


function getTotalMonsterKills(){

    return Object.values(
        bestiaryData
    ).reduce(
        (sum,entry)=>

            sum+
            (entry.kills||0),

        0
    );

}


/*
   â˜… æ¯å¤©ç¬¬ä¸€æ¬¡æ‰“é–‹æ¯æ—¥ä»»å‹™æ¸…å–®ï¼Œæˆ–æ¯å¤©
   ç¬¬ä¸€æ¬¡æ“Šæ®ºæ€ªç‰©/æ‰“è´æˆ°é¬¥æ™‚éƒ½æœƒå‘¼å«é€™è£¡ï¼Œ
   ç¢ºä¿ã€Œä»Šå¤©ã€çš„é€²åº¦ä¸æœƒæ²¿ç”¨åˆ°ã€Œæ˜¨å¤©ã€ã€‚
*/

function ensureDailyQuestsCurrent(){

    const today=

        new Date()
        .toISOString()
        .slice(0,10);


    if(
        dailyQuestState.date!==
        today
    ){

        dailyQuestState.date=
            today;

        dailyQuestState.progress={
            checkin:0,
            killMonsters:0,
            winBattle:0
        };

        dailyQuestState.claimed={
            checkin:false,
            killMonsters:false,
            winBattle:false
        };

    }


    /*
       â˜… æ–°å¢žï¼šå§”è¨—ä»»å‹™è·Ÿæ¯æ—¥ä»»å‹™å…±ç”¨
       åŒä¸€å€‹ã€Œä»Šå¤©ã€çš„æ—¥æœŸåˆ¤æ–·ï¼Œå„è‡ª
       æœ‰è‡ªå·±ç¨ç«‹çš„é€²åº¦/é ˜å–ç‹€æ…‹ï¼Œ
       äº’ä¸å½±éŸ¿ã€‚
    */

    if(
        commissionQuestState.date!==
        today
    ){

        commissionQuestState.date=
            today;

        commissionQuestState.progress={
            killMonsters:0,
            winBattle:0
        };

        commissionQuestState.claimed={
            killMonsters:false,
            winBattle:false
        };

    }

}



/* =====================================================
   â˜… åŸºç¤Žèƒ½åŠ›è¨ˆç®—
===================================================== */

const BASE_PHYSICAL_ATTACK = 30;
const BASE_MAGIC_ATTACK = 30;
const BASE_DEFENSE = 30;
const ATTACK_PER_LEVEL = 4;
const MAGIC_ATTACK_PER_LEVEL = 4;
const DEFENSE_PER_LEVEL = 3;
const ATTACK_PER_POINT = 4;
const MAGIC_ATTACK_PER_POINT = 2.75;
const DEFENSE_PER_POINT = 4;
const HP_PER_VITALITY_POINT = 50;

function getBaseStats(){
    return calculateCharacterBaseStats(player,getEquipmentBonus(player.element));
}

/* =====================================================
   è£å‚™
===================================================== */

const characterEquipment = {

    fire:{
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    },

    water:{
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    },

    wind:{
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    }

};

function migrateLegacyEquipmentStats(item){
    if(!item||typeof item!=="object"){ return item; }
    return window.FourSymbolsEquipmentCombatMigration.migrateItem(item);
}

function normalizeEquipmentSlots(equipment){
    if(!equipment || typeof equipment!=="object") return;
    if(!Object.prototype.hasOwnProperty.call(equipment,"head")) equipment.head=equipment.helmet||null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"hand")) equipment.hand=equipment.weapon||null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"shoulder")) equipment.shoulder=null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"armor")) equipment.armor=null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"shoes")) equipment.shoes=null;
    if(!Object.prototype.hasOwnProperty.call(equipment,"ring")) equipment.ring=equipment.accessory||null;
    delete equipment.weapon;
    delete equipment.helmet;
    delete equipment.accessory;
    Object.values(equipment).forEach(migrateLegacyEquipmentStats);
}


/* =====================================================
   è£å‚™åŠ æˆ
===================================================== */

normalizeEquipmentSlots(characterEquipment.fire);
normalizeEquipmentSlots(characterEquipment.water);
normalizeEquipmentSlots(characterEquipment.wind);

function getEquipmentBonus(characterId){
    const equipment=characterEquipment[characterId];
    const bonus={
        attack:0,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0,
        maxHP:0,maxSP:0,defense:0,accuracy:0,evasion:0,crit:0,criticalChance:0,
        antiCrit:0,statusAccuracy:0,statusResistance:0,criticalDamage:0
    };
    if(!equipment){ return bonus; }
    Object.values(equipment).forEach(item=>{
        if(!item){ return; }
        [item.stats,item.reforgeStats,...getSocketGemStats(item)].forEach(stats=>{
            if(!stats||typeof stats!=="object"||Array.isArray(stats)){ return; }
            Object.entries(stats).forEach(([stat,value])=>{
                if(Object.prototype.hasOwnProperty.call(bonus,stat)){
                    bonus[stat]+=Number(value)||0;
                }
            });
        });
    });
    return bonus;
}

/* Equipment rarity owns capacity; socket contents live on the equipment save object.
   Unknown gem IDs contribute nothing, so old and partially migrated saves load safely. */
const EQUIPMENT_SOCKET_CAPACITY=Object.freeze({white:0,blue:0,purple:0,orange:1,pink:2,"four-symbol":3});
const EQUIPMENT_GEMS=Object.freeze({gemVitalityI:Object.freeze({id:"gemVitalityI",name:"é«”è³ªå¯¶çŸ³",type:"gem",icon:"â—†",stats:Object.freeze({vitality:1})})});
function getEquipmentSocketCapacity(item){
    const aliases={low:"white",mid:"blue",high:"purple",perfect:"orange",red:"pink",myriad:"four-symbol"};
    if(!item){ return 0; }
    for(const value of [item.rarityKey,item.quality,item.tierKey,item.legacyTierKey]){
        const raw=String(value||"").toLowerCase();
        const key=aliases[raw]||raw;
        if(Object.prototype.hasOwnProperty.call(EQUIPMENT_SOCKET_CAPACITY,key)){
            return EQUIPMENT_SOCKET_CAPACITY[key];
        }
    }
    return 0;
}
function getSocketGemStats(item){
    const sockets=Array.isArray(item&&item.sockets)?item.sockets:[];
    return sockets.slice(0,getEquipmentSocketCapacity(item)).filter(id=>
        typeof id==="string"&&Object.prototype.hasOwnProperty.call(EQUIPMENT_GEMS,id)
    ).map(id=>EQUIPMENT_GEMS[id].stats);
}
window.FourSymbolsEquipmentGems=Object.freeze({definitions:EQUIPMENT_GEMS,capacity:getEquipmentSocketCapacity,stats:getSocketGemStats});

/* =====================================================
   V119 â€” çŽ©å®¶æˆ°é¬¥ä¸­å…­åœæ¸›ç›Šçµ±ä¸€å…¥å£

   é¢¨ç³»ã€Œé™ä½Žæ•æ·ã€èˆ‡åœŸç³»ã€Œé™ä½Žé˜²ç¦¦ã€ï¼Œä»¥åŠæ­·å²ç›¸å®¹çš„
   statDownï¼ˆå…¨å±¬æ€§é™ä½Žï¼‰ï¼Œéƒ½å…±ç”¨ statusEffects ç‹€æ…‹ç®¡ç·šã€‚
   å…ˆå‰çŽ©å®¶æœ€çµ‚èƒ½åŠ›æ²’æœ‰å®Œæ•´è®€å–é€™äº›æ¸›ç›Šï¼Œé€ æˆæ€ªç‰©å°çŽ©å®¶æ–½æ”¾æ™‚
   çœ‹å¾—åˆ°æ–‡å­—ã€å¯¦éš›æ•¸å€¼å»æ²’æœ‰ä¸‹é™ã€‚

   é€™è£¡çµ±ä¸€è¦å‰‡ï¼š
   - statDown ç‚ºæ­·å²ç›¸å®¹ç‹€æ…‹ï¼›ç¾å½¹çŽ©å®¶æŠ€èƒ½ç›®å‰æœªä½¿ç”¨ã€‚è‹¥èˆŠè³‡æ–™æˆ–æ€ªç‰©æŠ€èƒ½å¸¶å…¥ï¼Œ
     ä»é™ä½Žå°æ‡‰å…­åœé»žæ•¸ï¼›è‹¥æŠ€èƒ½æœ‰ excludedStatsï¼Œè©²å…­åœä¸é™ã€‚
   - agilityDown å†é¡å¤–é™ä½Žæœ‰æ•ˆæ•æ·ã€‚
   - defenseDown åœ¨æ‰€æœ‰é˜²ç¦¦åŠ æˆç®—å®Œå¾Œå†é™ä½Žæœ€çµ‚é˜²ç¦¦ã€‚
   - æš«æ™‚æ€§çš„ vitality / energy é™ä½Žã€Œä¸å‹•æ…‹ç¸®æ¸› maxHP / maxSPã€ï¼Œ
     é¿å…æ¸›ç›Šå‘½ä¸­çž¬é–“æŠŠç¾æœ‰ HP/SP å¼·åˆ¶è£æŽ‰ï¼›Vitality åªæä¾› Max HPã€‚
     é€™æ˜¯æ²¿ç”¨æœ¬å°ˆæ¡ˆå…ˆå‰å·²ç¢ºèªçš„æˆ°é¬¥è³‡æºç©©å®šåŽŸå‰‡ï¼Œä¸æ–°å¢žéš±æ€§æ‰£è¡€/æ‰£SPã€‚
===================================================== */
function getEffectivePlayerAbilityPoints(character,equipmentBonus,statName){
    if(!character){ return 0; }

    const basePoints=Number(character[statName])||0;
    const equipmentPoints=Number(equipmentBonus&&equipmentBonus[statName])||0;

    const statDown=getStatDownPercentFor(character,statName);

    let effective=(basePoints+equipmentPoints)*(1-statDown/100);

    if(statName==="agility"){
        const agilityDown=getMonsterDebuffValue(character,"agilityDown");
        effective*=1-agilityDown/100;
    }

    return Math.max(0,effective);
}

function calculateCharacterBaseStats(character,equipmentBonus){
    const source=character&&typeof character==="object"?character:{};
    const bonus=equipmentBonus&&typeof equipmentBonus==="object"?equipmentBonus:{};
    const level=Math.max(1,Number(source.level)||1);
    const points={};
    ["attack","intelligence","vitality","energy","defensePoints","agility"].forEach(stat=>{
        points[stat]=getEffectivePlayerAbilityPoints(source,bonus,stat);
    });
    return {
        maxHP:100+points.vitality*HP_PER_VITALITY_POINT+(Number(source.bonusHP)||0)+(Number(bonus.maxHP)||0),
        maxSP:50+points.energy*15+(Number(source.bonusSP)||0)+(Number(bonus.maxSP)||0),
        attack:BASE_PHYSICAL_ATTACK+level*ATTACK_PER_LEVEL+points.attack*ATTACK_PER_POINT,
        attackPoints:points.attack,
        defense:BASE_DEFENSE+level*DEFENSE_PER_LEVEL+points.defensePoints*DEFENSE_PER_POINT+(Number(bonus.defense)||0),
        defensePoints:points.defensePoints,
        magicAttack:BASE_MAGIC_ATTACK+level*MAGIC_ATTACK_PER_LEVEL+points.intelligence*MAGIC_ATTACK_PER_POINT,
        accuracy:Number(bonus.accuracy)||0,
        statusResistance:Number(bonus.statusResistance)||0,
        antiCrit:Number(bonus.antiCrit)||0,
        criticalChance:(Number(bonus.criticalChance)||0)+(Number(bonus.crit)||0),
        criticalDamage:Number(bonus.criticalDamage)||0,
        statusAccuracy:Number(bonus.statusAccuracy)||0,
        speed:points.agility,
        evasion:Number(bonus.evasion)||0,
        vitality:points.vitality,
        energy:points.energy,
        intelligence:points.intelligence,
        agility:points.agility
    };
}

function getPlayerDefenseDownPercent(character){
    return Math.max(0,getMonsterDebuffValue(character,"defenseDown"));
}

const FROSTBITE_FINAL_PERCENT_POINT_PENALTY=25;

/*
   é–ƒèº²ä¾†æºä¸€å¾‹ä»¥æœ€çµ‚ç™¾åˆ†é»žç›¸åŠ ï¼ç›¸æ¸›ã€‚
   çŽ©å®¶çœ‹åˆ°ã€Œé–ƒèº² +10%ã€å°±æ˜¯æœ€çµ‚é–ƒèº² +10 å€‹ç™¾åˆ†é»žï¼›
   ã€Œå‡å‚·ï¼šé–ƒèº² -25%ã€å°±æ˜¯æœ€çµ‚é–ƒèº² -25 å€‹ç™¾åˆ†é»žã€‚
   ä¸å†æŠŠå¤šå€‹é–ƒèº²ä¾†æºé€å±¤ä¹˜ç®—ã€‚
*/
function combineEvasionRates(sources){
    const total=(Array.isArray(sources)?sources:[]).reduce(
        (sum,source)=>sum+(Number(source)||0),
        0
    );
    return Math.max(0,total);
}

function getFrostbiteFinalPercentPointPenalty(entity){
    return entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
        effect&&effect.type==="frostbite"&&Number(effect.turnsLeft)>0
    )
        ?FROSTBITE_FINAL_PERCENT_POINT_PENALTY
        :0;
}

window.v173CombineEvasionRates=combineEvasionRates;
window.v173FrostbiteFinalPercentPointPenalty=FROSTBITE_FINAL_PERCENT_POINT_PENALTY;

/* æ°£å®šç¥žé–’çš„å‘½ä¸­åŠ æˆåŒæ™‚ä¾›çŽ©å®¶èˆ‡æ€ªç‰©å…±ç”¨ã€‚é¡åƒé¡¯ç¤ºç´€éŒ„
   å¯èƒ½åŒæ™‚å­˜åœ¨æ–¼ activeBuffs / v141TeamBuffsï¼Œå› æ­¤å–æœ€é«˜å€¼è€Œä¸ç›¸åŠ ã€‚ */
function getActiveAccuracyBonusPercent(entity){
    if(!entity){ return 0; }
    const entries=(entity.activeBuffs||[]).concat(entity.v141TeamBuffs||[]);
    return entries.reduce((highest,buff)=>{
        if(!buff||Number(buff.turnsLeft)<=0){ return highest; }
        const isAccuracyState=
            buff.type==="dinghaishenzhen"||
            buff.type==="resistance"||
            buff.v141BuffType==="resistance"||
            buff.statusName==="æ°£å®šç¥žé–’";
        return isAccuracyState
            ?Math.max(highest,Number(buff.accuracyBonusPercent)||0)
            :highest;
    },0);
}

function getActiveRageCriticalBonuses(entity){
    if(!entity){ return {chance:0,damage:0}; }
    const entries=(entity.v141TeamBuffs||[]).concat(entity.activeBuffs||[]);
    return entries.reduce((result,buff)=>{
        if(!buff||Number(buff.turnsLeft)<=0){ return result; }
        const isRage=buff.type==="rage"||buff.v141BuffType==="rage"||buff.statusName==="æ€’ç«";
        if(!isRage){ return result; }
        result.chance=Math.max(result.chance,Number(buff.critChanceBonusPercent)||0);
        result.damage=Math.max(result.damage,Number(buff.critDamageBonusPercent)||0);
        return result;
    },{chance:0,damage:0});
}

window.v173GetActiveAccuracyBonusPercent=getActiveAccuracyBonusPercent;
window.v173GetActiveRageCriticalBonuses=getActiveRageCriticalBonuses;

/* Final Accuracy is a percentage-point modifier, not a multiplier on raw
   Accuracy. It joins raw Accuracy only at the single hit-chance owner. */
function getFinalAccuracyBonusPercent(entity){
    const activeBonus=getActiveAccuracyBonusPercent(entity);
    const windEx=entity&&entity.element==="wind"
        ?getLearnedElementEX(entity,"wind")
        :null;
    return activeBonus+(windEx?Number(windEx.accuracyBonusPercent)||0:0);
}

window.v173GetFinalAccuracyBonusPercent=getFinalAccuracyBonusPercent;

/* Relic is a source of final Evasion points. All character getters settle
   it here before Frostbite, so party delegation cannot apply it twice. */
function getRelicFinalEvasionPercent(character){
    const index=getPartyCharacterIndex(character);
    return index>=0&&typeof window.v174GetRelicFinalEvasionPercent==="function"
        ?Number(window.v174GetRelicFinalEvasionPercent(index))||0:0;
}

/* =====================================================
   ä¸»è§’æœ€çµ‚èƒ½åŠ›
===================================================== */

function getMainCharacterStats(){
    const bonus=getEquipmentBonus(player.element);
    const base=calculateCharacterBaseStats(player,bonus);
    const characterKey=getCharacterSkillKey(player);
    const windEXLevel=characterKey?getSkillLevel(characterKey,"windEX"):0;
    const earthEXLevel=characterKey?getSkillLevel(characterKey,"earthEX"):0;
    const evasionBuffPercent=getActiveBuffPercent(player,"dodgeSkill");
    const defenseBuffPercent=getActiveBuffPercent(player,"rockWall");
    const defenseDownPercent=getPlayerDefenseDownPercent(player);
    const maxHpPassiveMultiplier=earthEXLevel>0?Math.max(1,Number(skillDatabase.earthEX.maxHpMultiplier)||1):1;
    const rawDefense=base.defense;
    const buffedDefense=rawDefense*(1+(defenseBuffPercent+(earthEXLevel>0?Number(skillDatabase.earthEX.defenseBonusPercent)||0:0))/100);
    return {
        ...base,
        maxHP:Math.round(base.maxHP*maxHpPassiveMultiplier),
        defense:Math.max(0,Math.round(buffedDefense*(1-defenseDownPercent/100))),
        accuracy:base.accuracy,
        evasion:combineEvasionRates([base.evasion,evasionBuffPercent,windEXLevel>0?Number(skillDatabase.windEX.evasionBonusPercent)||0:0,getRelicFinalEvasionPercent(player),-getFrostbiteFinalPercentPointPenalty(player)])
    };
}

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   é€šç”¨ç‰ˆæœ¬ï¼Œè®€å–è§’è‰²èº«ä¸ŠæŸå€‹buffç›®å‰çš„
   ç™¾åˆ†æ¯”æ•¸å€¼ï¼ˆæ²’æœ‰é€™å€‹buffçš„è©±å›žå‚³0ï¼‰ï¼Œ
   è·Ÿæ€ªç‰©é‚£é‚Šçš„getMonsterDebuffValue()æ˜¯
   å°ç¨±è¨­è¨ˆï¼Œä¸€å€‹è®€activeBuffsï¼ˆçŽ©å®¶çš„
   å¢žç›Šï¼‰ï¼Œä¸€å€‹è®€statusEffectsï¼ˆæ€ªç‰©çš„
   æ¸›ç›Šï¼‰ã€‚
*/

function getActiveBuffPercent(
    character,
    buffType
){

    if(!character || !character.activeBuffs){
        return 0;
    }


    const buff=

        character.activeBuffs.find(
            b=>

                b.type===buffType &&
                b.turnsLeft>0

        );


    return (
        buff
        ?
        (buff.percent||0)
        :
        0
    );

}


function hasActiveBuff(
    character,
    buffType
){

    return !!(
        character.activeBuffs &&
        character.activeBuffs.some(
            b=>

                b.type===buffType &&
                b.turnsLeft>0

        )
    );

}


/*
   â˜… æ–°å¢žï¼šç¬¬äºŒè§’è‰²çš„å®Œæ•´æˆ°é¬¥æ•¸å€¼ã€‚
   è·ŸgetMainCharacterStats()ç®—æ³•å®Œå…¨å°ç¨±ï¼Œ
   åªæ˜¯baseç›´æŽ¥ç”¨player2è‡ªå·±çš„å…­åœç®—ï¼Œ
   è£å‚™åŠ æˆæŠ“å›ºå®šçš„"player2"é€™å€‹key
   ï¼ˆä¸æ˜¯player2.elementï¼Œ
   å› ç‚ºè£å‚™æ¬„æ˜¯ç”¨è§’è‰²idå­˜çš„ï¼Œä¸æ˜¯å…ƒç´ ï¼‰ã€‚
*/

function getAdditionalCharacterBattleStats(character,characterKey){
    const bonus=getEquipmentBonus(characterKey);
    const base=calculateCharacterBaseStats(character,bonus);
        const windEXLevel=characterKey?getSkillLevel(characterKey,"windEX"):0;
    const earthEXLevel=characterKey?getSkillLevel(characterKey,"earthEX"):0;
    const evasionBuffPercent=getActiveBuffPercent(character,"dodgeSkill");
    const defenseBuffPercent=getActiveBuffPercent(character,"rockWall");
    const defenseDownPercent=getPlayerDefenseDownPercent(character);
    const maxHpPassiveMultiplier=earthEXLevel>0?Math.max(1,Number(skillDatabase.earthEX.maxHpMultiplier)||1):1;
    const rawDefense=base.defense;
    const buffedDefense=rawDefense*(1+(defenseBuffPercent+(earthEXLevel>0?Number(skillDatabase.earthEX.defenseBonusPercent)||0:0))/100);
    return {
        ...base,
        maxHP:Math.round(base.maxHP*maxHpPassiveMultiplier),
        defense:Math.max(0,Math.round(buffedDefense*(1-defenseDownPercent/100))),
        accuracy:base.accuracy,
        evasion:combineEvasionRates([base.evasion,evasionBuffPercent,windEXLevel>0?Number(skillDatabase.windEX.evasionBonusPercent)||0:0,getRelicFinalEvasionPercent(character),-getFrostbiteFinalPercentPointPenalty(character)])
    };
}

function getPlayer2BattleStats(){
    return getAdditionalCharacterBattleStats(player2,"player2");
}


function getPlayer3BattleStats(){
    return getAdditionalCharacterBattleStats(player3,"player3");
}


function getPartyBattleStats(index){
    if(index===0){ return getMainCharacterStats(); }
    if(index===1){ return getPlayer2BattleStats(); }
    if(index===2){ return getPlayer3BattleStats(); }
    return null;
}


/* =====================================================
   æ€ªç‰©
===================================================== */

const DAMAGE_ROLE_PROFILES = Object.freeze({
    single_low:Object.freeze({powerMultiplier:1.20,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    single_normal:Object.freeze({powerMultiplier:1.50,powerPerLevel:0.075,flatDamage:0,flatDamagePerLevel:0}),
    single_burst:Object.freeze({powerMultiplier:1.75,powerPerLevel:0.10,flatDamage:0,flatDamagePerLevel:0}),
    tri_damage:Object.freeze({powerMultiplier:0.95,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    aoe_damage:Object.freeze({powerMultiplier:0.70,powerPerLevel:0.04,flatDamage:0,flatDamagePerLevel:0}),
    single_control:Object.freeze({powerMultiplier:1.50,powerPerLevel:0.075,flatDamage:0,flatDamagePerLevel:0}),
    tri_control:Object.freeze({powerMultiplier:0.95,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    aoe_control:Object.freeze({powerMultiplier:0.70,powerPerLevel:0.04,flatDamage:0,flatDamagePerLevel:0}),
    single_dot:Object.freeze({powerMultiplier:1.50,powerPerLevel:0.075,flatDamage:0,flatDamagePerLevel:0}),
    tri_dot:Object.freeze({powerMultiplier:0.95,powerPerLevel:0.05,flatDamage:0,flatDamagePerLevel:0}),
    aoe_dot:Object.freeze({powerMultiplier:0.70,powerPerLevel:0.04,flatDamage:0,flatDamagePerLevel:0})
});

const FORMAL_DAMAGE_SKILL_ROLES = Object.freeze({
    flameSlash:"single_low",
    fireCritical:"single_normal",
    explosiveFlurry:"tri_damage",
    dragonSlash:"single_burst",
    fireRocket:"tri_dot",
    blazeSpell:"single_dot",
    flameTornado:"single_dot",
    phoenixCry:"aoe_dot",
    waterKnife:"single_low",
    frostPunch:"single_normal",
    iceSpin:"tri_damage",
    frostCrush:"single_burst",
    waterBall:"tri_damage",
    floodBeast:"single_normal",
    iceArrowRain:"aoe_damage",
    stormFist:"single_low",
    stormFlurry:"tri_damage",
    windCrossSlash:"single_normal",
    dizzyFist:"single_normal",
    windSpell:"tri_damage",
    stormCircle:"tri_damage",
    windHowlLightning:"single_normal",
    stormRain:"aoe_damage",
    stormSpell:"aoe_damage",
    stoneSlash:"single_low",
    petrifyFist:"tri_damage",
    stoneBreakSky:"single_normal",
    earthquakeCrush:"tri_control",
    stoneThrow:"tri_damage",
    sandWind:"tri_damage",
    flyingSandStrike:"aoe_damage",
    dustStorm:"single_control"
});

function applyDamageRoleProfile(skill,damageRole){
    const profile=DAMAGE_ROLE_PROFILES[damageRole];
    if(!skill||!profile){ return false; }

    skill.damageRole=damageRole;
    skill.powerMultiplier=profile.powerMultiplier;
    skill.powerPerLevel=profile.powerPerLevel;
    skill.flatDamage=profile.flatDamage;
    skill.flatDamagePerLevel=profile.flatDamagePerLevel;
    return true;
}

function applyFormalDamageRoleProfiles(skillIds){
    if(typeof skillDatabase==="undefined"){ return []; }
    const ids=Array.isArray(skillIds)?skillIds:Object.keys(FORMAL_DAMAGE_SKILL_ROLES);
    return ids.filter(skillId=>
        applyDamageRoleProfile(skillDatabase[skillId],FORMAL_DAMAGE_SKILL_ROLES[skillId])
    );
}

function hasDamageRoleProfile(skill){
    return !!(
        skill&&
        DAMAGE_ROLE_PROFILES[skill.damageRole]&&
        Number.isFinite(Number(skill.powerMultiplier))&&
        Number.isFinite(Number(skill.powerPerLevel))&&
        Number.isFinite(Number(skill.flatDamage))&&
        Number.isFinite(Number(skill.flatDamagePerLevel))
    );
}

function getSkillPowerAtLevel(skill,level){
    return Number(skill.powerMultiplier);
}

function getSkillFlatDamageAtLevel(skill,level){
    return Number(skill.flatDamage);
}

window.v173DamageRoleProfiles=DAMAGE_ROLE_PROFILES;
window.v173FormalDamageSkillRoles=FORMAL_DAMAGE_SKILL_ROLES;
window.v173ApplyFormalDamageRoleProfiles=applyFormalDamageRoleProfiles;
window.v173HasDamageRoleProfile=hasDamageRoleProfile;
window.v173GetSkillPowerAtLevel=getSkillPowerAtLevel;
window.v173GetSkillFlatDamageAtLevel=getSkillFlatDamageAtLevel;


/* V120_FINAL_SKILL_WIRING
   V120 SKILL UPDATE: 2026-08-24
   æœ€æ–°å››å…ƒç´ æŠ€èƒ½è¦æ ¼å·²å¥—ç”¨ï¼›èˆŠ ID å„ªå…ˆä¿ç•™ä»¥ç¶­æŒå­˜æª”ç›¸å®¹ã€‚
   V120ï¼šé¢¨ç„°è¡“ï¼é¢¨å“®é›»æ“Šæ”¹ç‚ºã€Œé™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³ã€ï¼›
   è½çŸ³è¡“ï¼æ»¾çŸ³è¡“ï¼åœ°ç‰›çŒ›è¥²çš„é™é˜²æŒçºŒæ™‚é–“æ­£å¼å®šç‚º1å›žåˆã€‚
*/
const skillDatabase = {

    /* =====================================================
       V120 æ­£å¼æŠ€èƒ½è¦æ ¼
       - æ•¸å€¼ã€å‰ç½®ã€SPã€ç¯„åœä¾ä½¿ç”¨è€… 2026-08-24 æœ€æ–°è¡¨
       - èˆŠæŠ€èƒ½ ID èƒ½æ²¿ç”¨å°±æ²¿ç”¨ï¼Œé¿å…ç ´å£žæ—¢æœ‰å­˜æª”/é…è£
       - æ–°å¢žæŠ€èƒ½æ‰å»ºç«‹æ–° ID
    ===================================================== */

    /* ===== ç«ç³»ï¼šç‰©ç† ===== */
    flameSlash:{
        id:"flameSlash", tier:1, name:"ç«ç„°æ–¬", element:"fire", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:10, spCost:8,
        description:"å°å–®é«”é€ æˆ17é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+10ã€‚"
    },
    fireCritical:{
        id:"fireCritical", tier:2, name:"æœƒå¿ƒä¸€æ“Š", element:"fire", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:39, damagePerLevel:13, spCost:15,
        description:"å°å–®é«”é€ æˆ39é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+13ã€‚", requires:["flameSlash"]
    },
    explosiveFlurry:{
        id:"explosiveFlurry", tier:3, name:"ç«çˆ†äº‚æ“Š", element:"fire", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:35, damagePerLevel:15, spCost:22,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ35é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+15ã€‚", requires:["fireCritical"]
    },
    dragonSlash:{
        id:"dragonSlash", tier:4, name:"éœ¸é¾è£‚å¤©æ–¬", element:"fire", category:"physical", targetType:"single",
        learnCost:45, maxLevel:5, baseDamage:145, damagePerLevel:25, spCost:55,
        description:"å°å–®é«”é€ æˆ145é»žåŸºç¤Žå‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+25ã€‚", requires:["explosiveFlurry"]
    },

    /* ===== ç«ç³»ï¼šæ³•è¡“ ===== */
    fireRocket:{
        id:"fireRocket", tier:1, name:"ç«ç®­", element:"fire", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:22, damagePerLevel:8, spCost:8,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ22é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+8ã€‚"
    },
    blazeSpell:{
        id:"blazeSpell", tier:2, name:"çƒˆç«è¡“", element:"fire", category:"magic", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:42, damagePerLevel:15, spCost:15,
        description:"å°å–®é«”é€ æˆ42é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼Œæœ€é«˜5ç´šï¼Œæ¯å‡1ç´šå‚·å®³+15ã€‚", requires:["fireRocket"]
    },
    flameTornado:{
        id:"flameTornado", tier:3, name:"çƒˆç„°é¾æ²", element:"fire", category:"magic", targetType:"row",
        learnCost:30, maxLevel:5, baseDamage:40, damagePerLevel:13, spCost:38,
        description:"å°ä»»ä¸€æ©«æŽ’ç›®æ¨™å„é€ æˆ40é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›30%æ©ŸçŽ‡ç‡ƒç‡’2å›žåˆï¼Œæ¯å›žåˆé€ æˆç›®æ¨™æœ€å¤§HPçš„5%/7%/12%/18%/25%å‚·å®³ã€‚",
        burnChance:30, burnDuration:2, burnPercentByLevel:[5,7,12,18,25], requires:["blazeSpell"]
    },
    phoenixCry:{
        id:"phoenixCry", tier:4, name:"ç«é³³å¤©é³´", element:"fire", category:"magic", targetType:"all",
        learnCost:45, maxLevel:5, baseDamage:53, damagePerLevel:15, spCost:62,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ53é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›50%æ©ŸçŽ‡ç‡ƒç‡’2å›žåˆï¼Œæ¯å›žåˆé€ æˆç›®æ¨™æœ€å¤§HPçš„12%/18%/25%/30%/35%å‚·å®³ã€‚",
        burnChance:50, burnDuration:2, burnPercentByLevel:[12,18,25,30,35], requires:["flameTornado"]
    },

    /* ===== ç«ç³»ï¼šå¢žç›Š ===== */
    rage:{
        id:"rage", name:"æ€’ç«", element:"fire", category:"buff", targetType:"allyAll",
        learnCost:25, maxLevel:5, spCost:50, duration:2,
        description:"æé«˜æˆ‘æ–¹æœ€å¤š3åå­˜æ´»è§’è‰²çš„çˆ†æ“ŠçŽ‡èˆ‡çˆ†æ“Šå‚·å®³ï¼ŒæŒçºŒ2å›žåˆï¼›æå‡å¹…åº¦ä¾ç­‰ç´šç‚º10%/20%/30%/40%/50%ã€‚",
        critBonusByLevel:[10,20,30,40,50], requires:["explosiveFlurry","flameTornado"]
    },

    /* ===== ç«ç³»ï¼šè¢«å‹• ===== */
    fireEX:{
        id:"fireEX", name:"ç«å…ƒç´ EX", element:"fire", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡ç«å…ƒç´ å‚·å®³10%ã€çˆ†æ“ŠçŽ‡5%ã€çˆ†æ“Šå‚·å®³5%ã€‚",
        damageBonusPercent:10, critChanceBonusPercent:5, critDamageBonusPercent:5
    },

    /* ===== æ°´ç³»ï¼šç‰©ç† ===== */
    waterKnife:{
        id:"waterKnife", tier:1, name:"æ°´åˆ€æ–¬", element:"water", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:13, damagePerLevel:3, spCost:6,
        description:"å°å–®é«”é€ æˆ13é»žåŸºç¤Žå‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    frostPunch:{
        id:"frostPunch", tier:2, name:"å†°éœœæ‹³", element:"water", category:"physical", targetType:"single",
        learnCost:10, maxLevel:5, baseDamage:30, damagePerLevel:5, spCost:17,
        description:"å°å–®é«”é€ æˆ30é»žåŸºç¤Žå‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3], requires:["waterKnife"]
    },
    iceSpin:{
        id:"iceSpin", tier:3, name:"å†°æ—‹ä¸€é–ƒ", element:"water", category:"physical", targetType:"tri",
        learnCost:20, maxLevel:5, baseDamage:25, damagePerLevel:7, spCost:20,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ25é»žåŸºç¤Žå‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["frostPunch"]
    },
    frostCrush:{
        id:"frostCrush", tier:4, name:"å†°å°é‡æ“Š", element:"water", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:100, damagePerLevel:15, spCost:50,
        description:"å°å–®é«”é€ æˆ100é»žåŸºç¤Žå‚·å®³ï¼›45%æ©ŸçŽ‡å†°å°1å›žåˆï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        freezeChance:45, freezeDuration:1, lifestealPercentByLevel:[1,1,1,2,3], requires:["iceSpin"]
    },

    /* ===== æ°´ç³»ï¼šæ³•è¡“ ===== */
    waterBall:{
        id:"waterBall", tier:1, name:"æ°´çƒè¡“", element:"water", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:17, damagePerLevel:3, spCost:8,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ17é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%/1%/1%/2%/3%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,2,3]
    },
    floodBeast:{
        id:"floodBeast", tier:2, name:"æ´ªæ°´çŒ›ç¸", element:"water", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:35, damagePerLevel:8, spCost:15,
        description:"å°å–®é«”é€ æˆ35é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["waterBall"]
    },
    iceArrowRain:{
        id:"iceArrowRain", tier:3, name:"å†°éœœç®­é›¨", element:"water", category:"magic", targetType:"all",
        learnCost:20, maxLevel:5, baseDamage:30, damagePerLevel:12, spCost:50,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ30é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›å¸å–å‚·å®³çš„1%ï¼Œç­‰é‡æ¢å¾©è‡ªèº«HPèˆ‡SPã€‚",
        lifestealPercentByLevel:[1,1,1,1,1], requires:["floodBeast"]
    },
    freeze:{
        id:"freeze", tier:4, name:"å†°å°", element:"water", category:"magic", targetType:"single",
        learnCost:25, maxLevel:1, spCost:22,
        description:"65%æ©ŸçŽ‡å†°å°å–®ä¸€ç›®æ¨™ï¼Œä½¿å…¶ç„¡æ³•è¡Œå‹•4å›žåˆï¼›ç´”æŽ§å ´æŠ€èƒ½ï¼Œä¸é€ æˆå‚·å®³ã€‚",
        freezeChance:65, freezeDuration:4, requires:["iceArrowRain"]
    },

    /* ===== æ°´ç³»ï¼šå¢žç›Š/å›žå¾© ===== */
    healSpell:{
        id:"healSpell", name:"æ²»ç™‚è¡“", element:"water", category:"heal", targetType:"ally",
        learnCost:20, maxLevel:5, baseHeal:40, healPerLevel:5, baseHealSP:15, healSPPerLevel:5, spCost:30,
        description:"æ“‡ä¸€å‹æ–¹ç›®æ¨™ï¼Œæ¢å¾©HPèˆ‡SPã€‚HPåŸºç¤Ž40ã€SPåŸºç¤Ž15ï¼Œå…©è€…æ¯å‡1ç´šåŸºç¤Žæ¢å¾©é‡+5ï¼›å¦åŠ HPæ™ºåŠ›Ã—1.25ã€SPæ™ºåŠ›Ã—0.5ï¼›æ–½æ”¾è€…æœ¬äººä¸å›žå¾©SPã€‚",
        requires:["iceArrowRain","iceSpin"]
    },
    revive:{
        id:"revive", name:"å¾©æ´»è¡“", element:"water", category:"revive", targetType:"deadAlly",
        learnCost:20, maxLevel:5, spCost:45,
        description:"æ“‡ä¸€å‹æ–¹æ­»äº¡ç›®æ¨™åŽŸåœ°å¾©æ´»ï¼Œä¾ç­‰ç´šæ¢å¾©20%/40%/60%/80%/100%æœ€å¤§HPã€‚",
        reviveHealPercentByLevel:[20,40,60,80,100], requires:["healSpell"]
    },

    /* ===== æ°´ç³»ï¼šè¢«å‹• ===== */
    waterEX:{
        id:"waterEX", name:"æ°´å…ƒç´ EX", element:"water", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡æ°´å…ƒç´ å‚·å®³5%ã€å›žå¾©ç³»æŠ€èƒ½å›žå¾©é‡5%ã€ç•°å¸¸ç‹€æ…‹æŠ—æ€§+10%ã€‚",
        damageBonusPercent:5, healBonusPercent:5, statusResistBonus:10
    },

    /* ===== é¢¨ç³»ï¼šç‰©ç† ===== */
    stormFist:{
        id:"stormFist", tier:1, name:"æš´é¢¨æ‹³", element:"wind", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°å–®é«”é€ æˆ14é»žåŸºç¤Žå‚·å®³ï¼›50%æ©ŸçŽ‡é™ä½Žæ•æ·1å›žåˆï¼Œé™ä½Ž50%/60%/70%/80%/90%ã€‚",
        agilityDownChance:50, agilityDownByLevel:[50,60,70,80,90], agilityDownDuration:1
    },
    stormFlurry:{
        id:"stormFlurry", tier:2, name:"æš´é¢¨äº‚æ“Š", element:"wind", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:20,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ28é»žåŸºç¤Žå‚·å®³ï¼›50%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/18%/21%/25%/30%ã€‚",
        damageDownChance:50, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["stormFist"]
    },
    windCrossSlash:{
        id:"windCrossSlash", tier:3, name:"é¢¨æ—‹åå­—æ–¬", element:"wind", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:90, damagePerLevel:12, spCost:39,
        description:"å°å–®é«”é€ æˆ90é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/20%/25%/30%/35%ã€‚",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormFlurry"]
    },
    dizzyFist:{
        id:"dizzyFist", tier:4, name:"æšˆçœ©çŒ›æ“Š", element:"wind", category:"physical", targetType:"single",
        learnCost:30, maxLevel:5, baseDamage:120, damagePerLevel:15, spCost:55,
        description:"å°å–®é«”é€ æˆ120é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡ä½¿ç›®æ¨™æšˆçœ©2å›žåˆï¼Œä½¿ç›®æ¨™æœ€çµ‚å‘½ä¸­çŽ‡é™ä½Ž15%/20%/25%/30%/35%ã€‚",
        stunChance:65, missBonusByLevel:[15,20,25,30,35], stunDuration:2, requires:["stormFlurry"]
    },

    /* ===== é¢¨ç³»ï¼šæ³•è¡“ ===== */
    windSpell:{
        id:"windSpell", tier:1, name:"ç‹‚é¢¨è¡“", element:"wind", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:18, damagePerLevel:2, spCost:9,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ18é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›50%æ©ŸçŽ‡é™ä½Žæ•æ·1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        agilityDownChance:50, agilityDownByLevel:[10,20,30,40,50], agilityDownDuration:1
    },
    stormCircle:{
        id:"stormCircle", tier:2, name:"é¢¨ç„°è¡“", element:"wind", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:38, damagePerLevel:9, spCost:18,
        description:"å°ä»»ä¸€æ©«æŽ’å„é€ æˆ38é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›55%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/18%/21%/25%/30%ã€‚",
        damageDownChance:55, damageDownByLevel:[15,18,21,25,30], damageDownDuration:1, requires:["windSpell"]
    },
    windHowlLightning:{
        id:"windHowlLightning", tier:3, name:"é¢¨å“®é›»æ“Š", element:"wind", category:"magic", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:95, damagePerLevel:12, spCost:39,
        description:"å°å–®é«”é€ æˆ95é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žç›®æ¨™é€ æˆçš„å‚·å®³1å›žåˆï¼Œé™ä½Ž15%/20%/25%/30%/35%ã€‚",
        damageDownChance:65, damageDownByLevel:[15,20,25,30,35], damageDownDuration:1, requires:["stormCircle"]
    },
    stormRain:{
        id:"stormRain", tier:4, name:"é¢¨èµ·é›²æ¹§", element:"wind", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›35%æ©ŸçŽ‡æšˆçœ©1å›žåˆï¼Œä½¿ç›®æ¨™æœ€çµ‚å‘½ä¸­çŽ‡é™ä½Ž15%/20%/25%/30%/35%ã€‚",
        stunChance:35, missBonusByLevel:[15,20,25,30,35], stunDuration:1, requires:["windHowlLightning"]
    },

    /* ===== é¢¨ç³»ï¼šå¢žç›Š ===== */
    dodgeSkill:{
        id:"dodgeSkill", name:"é–ƒèº²è¡“", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:10, maxLevel:1, spCost:20, duration:3,
        description:"æœ€çµ‚é–ƒèº²+5%ï¼ŒæŒçºŒ3å›žåˆã€‚", evasionBonusPercent:5,
        requires:["windCrossSlash","windHowlLightning"]
    },
    stealthSkill:{
        id:"stealthSkill", name:"éš±èº«è¡“", element:"wind", category:"buff", targetType:"ally",
        learnCost:15, maxLevel:1, spCost:25, duration:2,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™éš±èº«2å›žåˆï¼›ç„¡æ³•è¢«å–®é«”æŠ€èƒ½é¸ä¸­ï¼Œä½†ä»æœƒå—åˆ°ç¯„åœæŠ€èƒ½æ³¢åŠã€‚", requires:["dodgeSkill"]
    },
    dinghaishenzhen:{
        id:"dinghaishenzhen", name:"æ°£å®šç¥žé–’", element:"wind", category:"buff", targetType:"allyAll",
        learnCost:20, maxLevel:1, spCost:55, duration:3,
        description:"ä½¿æˆ‘æ–¹å…¨é«”ç•°å¸¸ç‹€æ…‹æŠ—æ€§æå‡35%ï¼ŒæŒçºŒ3å›žåˆã€‚", statusResistBonus:35,
        requires:["stealthSkill"]
    },

    /* ===== é¢¨ç³»ï¼šè¢«å‹• ===== */
    windEX:{
        id:"windEX", name:"é¢¨å…ƒç´ EX", element:"wind", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡é¢¨å…ƒç´ è§’è‰²çš„é–ƒèº²çŽ‡15%ã€‚", evasionBonusPercent:15
    },

    /* ===== åœŸç³»ï¼šç‰©ç† ===== */
    stoneSlash:{
        id:"stoneSlash", tier:1, name:"åœŸçŸ³æ–¬", element:"earth", category:"physical", targetType:"single",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°å–®é«”é€ æˆ14é»žåŸºç¤Žå‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    petrifyFist:{
        id:"petrifyFist", tier:2, name:"çŸ³ç›¾æ‹³", element:"earth", category:"physical", targetType:"tri",
        learnCost:10, maxLevel:5, baseDamage:28, damagePerLevel:7, spCost:26,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ28é»žåŸºç¤Žå‚·å®³ï¼›ç‚ºæˆ‘æ–¹å…¨é«”å¢žåŠ 100/125/150/175/200é»žè­·ç›¾ï¼ŒæŒçºŒ2å›žåˆã€‚",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["stoneSlash"]
    },
    stoneBreakSky:{
        id:"stoneBreakSky", tier:3, name:"çŸ³ç ´å¤©é©š", element:"earth", category:"physical", targetType:"single",
        learnCost:15, maxLevel:5, baseDamage:55, damagePerLevel:7, spCost:42,
        description:"å°å–®é«”é€ æˆ55é»žåŸºç¤Žå‚·å®³ï¼›ç‚ºæˆ‘æ–¹å…¨é«”å¢žåŠ 100/125/150/175/200é»žè­·ç›¾ï¼ŒæŒçºŒ2å›žåˆã€‚",
        allyShieldByLevel:[100,125,150,175,200], shieldDuration:2, requires:["petrifyFist"]
    },
    earthquakeCrush:{
        id:"earthquakeCrush", tier:4, name:"åœ°è£‚é‡æ‹³", element:"earth", category:"physical", targetType:"tri",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ48é»žåŸºç¤Žå‚·å®³ï¼›ç‚ºè‡ªèº«å¢žåŠ 100/150/200/250/300é»žè­·ç›¾ï¼ŒæŒçºŒ2å›žåˆã€‚",
        selfShieldByLevel:[100,150,200,250,300], shieldDuration:2, requires:["stoneBreakSky"]
    },

    /* ===== åœŸç³»ï¼šæ³•è¡“ ===== */
    stoneThrow:{
        id:"stoneThrow", tier:1, name:"è½çŸ³è¡“", element:"earth", category:"magic", targetType:"tri",
        learnCost:2, maxLevel:5, baseDamage:14, damagePerLevel:2, spCost:7,
        description:"å°åŒä¸€æ©«æŽ’å·¦ã€ä¸­ã€å³æœ€å¤š3åç›®æ¨™å„é€ æˆ14é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1
    },
    sandWind:{
        id:"sandWind", tier:2, name:"æ»¾çŸ³è¡“", element:"earth", category:"magic", targetType:"row",
        learnCost:10, maxLevel:5, baseDamage:17, damagePerLevel:5, spCost:19,
        description:"å°ä»»ä¸€æ©«æŽ’å„é€ æˆ17é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›65%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/20%/30%/40%/50%ã€‚",
        defenseDownChance:65, defenseDownByLevel:[10,20,30,40,50], defenseDownDuration:1, requires:["stoneThrow"]
    },
    flyingSandStrike:{
        id:"flyingSandStrike", tier:3, name:"é£›æ²™çž¬æ“Š", element:"earth", category:"magic", targetType:"all",
        learnCost:15, maxLevel:5, baseDamage:20, damagePerLevel:8, spCost:26,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ20é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›ä¾ç­‰ç´š25%/35%/45%/55%/65%æ©ŸçŽ‡çŸ³åŒ–ç›®æ¨™2å›žåˆï¼Œä½¿å…¶ç„¡æ³•è¡Œå‹•ã€‚",
        petrifyChanceByLevel:[25,35,45,55,65], petrifyDuration:2, requires:["sandWind"]
    },
    dustStorm:{
        id:"dustStorm", tier:4, name:"åœ°ç‰›çŒ›è¥²", element:"earth", category:"magic", targetType:"all",
        learnCost:30, maxLevel:5, baseDamage:48, damagePerLevel:14, spCost:55,
        description:"å°æ•µæ–¹å…¨é«”å„é€ æˆ48é»žåŸºç¤Žæ³•è¡“å‚·å®³ï¼›60%æ©ŸçŽ‡é™ä½Žé˜²ç¦¦1å›žåˆï¼Œé™ä½Ž10%/15%/20%/25%/30%ã€‚",
        defenseDownChance:60, defenseDownByLevel:[10,15,20,25,30], defenseDownDuration:1, requires:["flyingSandStrike"]
    },

    /* ===== åœŸç³»ï¼šå¢žç›Š ===== */
    earthShield:{
        id:"earthShield", name:"è¬è±¡åœŸç›¾", element:"earth", category:"buff", targetType:"ally",
        learnCost:10, maxLevel:1, spCost:32, duration:3,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™ç²å¾—50%åå‚·åœŸç›¾ï¼ŒæŒçºŒ3å›žåˆã€‚", reflectPercent:50,
        requires:["stoneBreakSky","flyingSandStrike"]
    },
    rockWall:{
        id:"rockWall", name:"å²©çŸ³å£å£˜", element:"earth", category:"buff", targetType:"allyAll",
        learnCost:15, maxLevel:1, spCost:45, duration:3,
        description:"ä½¿æˆ‘æ–¹å…¨é«”é˜²ç¦¦åŠ›æå‡30%ï¼ŒæŒçºŒ3å›žåˆã€‚", defenseBonusPercent:30,
        requires:["barrier"]
    },
    barrier:{
        id:"barrier", name:"çµç•Œ", element:"earth", category:"buff", targetType:"ally",
        learnCost:20, maxLevel:1, spCost:28, duration:4,
        description:"ä½¿æˆ‘æ–¹å–®ä¸€ç›®æ¨™ç²å¾—å®Œå…¨é˜²è­·ç½©ï¼Œå¯æŠµæ“‹æ‰€æœ‰å‚·å®³ï¼ŒæŒçºŒ4å›žåˆã€‚", requires:["earthShield"]
    },

    /* ===== åœŸç³»ï¼šè¢«å‹• ===== */
    earthEX:{
        id:"earthEX", name:"åœŸå…ƒç´ EX", element:"earth", category:"passive", targetType:"none",
        learnCost:25, maxLevel:1,
        description:"æ°¸ä¹…æå‡åœŸå…ƒç´ è§’è‰²çš„é˜²ç¦¦åŠ›15%ã€‚", defenseBonusPercent:15
    }
};

/* =====================================================
   V126 â€” MONSTER BOOTSTRAP CONSTANT ORDER
   Monster arrays are constructed immediately below. These four confirmed
   constants must be initialized before makeZoneMonster() calculates status
   resistance and anti-crit values.
===================================================== */
const ANTI_CRIT_MAX_PERCENT = 25;
const CRIT_CHANCE_MIN_AFTER_ANTI_CRIT = 5;

const MAX_TRAINING_MONSTERS = 8;


const BEGINNER_FOREST_NORMAL_DAMAGE_MIN=10;
const BEGINNER_FOREST_NORMAL_DAMAGE_MAX=15;

function rollBeginnerForestNormalAttackDamage(){
    return BEGINNER_FOREST_NORMAL_DAMAGE_MIN+
        Math.floor(
            Math.random()*
            (BEGINNER_FOREST_NORMAL_DAMAGE_MAX-BEGINNER_FOREST_NORMAL_DAMAGE_MIN+1)
        );
}

const forestMonsters = [

    makeZoneMonster("å“¥å¸ƒæž—",3,"fire","regular","wild.zone-01.fire-01",{mode:"wild",context:"wild/zone-01"}),
    makeZoneMonster("æ°´éˆç‹",2,"water","regular","wild.zone-01.water-01",{mode:"wild",context:"wild/zone-01"}),
    makeZoneMonster("å“¥å¸ƒæž—",3,"fire","regular","wild.zone-01.fire-01",{mode:"wild",context:"wild/zone-01"}),
    makeZoneMonster("æ°´éˆç‹",2,"water","regular","wild.zone-01.water-01",{mode:"wild",context:"wild/zone-01"}),    makeZoneMonster("å“¥å¸ƒæž—",3,"fire","regular","wild.zone-01.fire-01",{mode:"wild",context:"wild/zone-01"}),
    makeZoneMonster("æ°´éˆç‹",2,"water","regular","wild.zone-01.water-01",{mode:"wild",context:"wild/zone-01"})

];

forestMonsters.forEach(monster=>{
    monster.v173BeginnerForest=true;
});


/*
   â˜… è’æ¼ åœ°å¸¶ï¼ˆç¬¬äºŒå€ï¼‰æ€ªç‰©è³‡æ–™ã€‚
   æ•¸å€¼æ˜Žé¡¯æ¯”æ–°æ‰‹æ£®æž—ç¡¬ï¼Œ
   ä¸»è¦æ˜¯ç‚ºäº†è®“çŽ©å®¶èƒ½å¯¦éš›æ¸¬è©¦
   ç‡ƒç‡’é€™é¡žã€ŒæŒçºŒå‚·å®³ã€æ•ˆæžœâ€”â€”
   æ–°æ‰‹æ£®æž—çš„æ€ªå¤ªè„†ï¼Œé€šå¸¸ä¸€å…©ä¸‹å°±æ­»äº†ï¼Œ
   æ ¹æœ¬æ’ä¸åˆ°ç‡ƒç‡’è·³å®Œ2å›žåˆã€‚
*/

const desertMonsters = [

    makeZoneMonster("æ²™æ¼ è±ºç‹¼",16,"fire","regular","wild.zone-02.fire-01",{mode:"wild",context:"wild/zone-02"}),
    makeZoneMonster("æµªå°¾çº",15,"water","regular","wild.zone-02.water-01",{mode:"wild",context:"wild/zone-02"}),
    makeZoneMonster("æ²™æ¼ è±ºç‹¼",16,"fire","regular","wild.zone-02.fire-01",{mode:"wild",context:"wild/zone-02"}),
    makeZoneMonster("æµªå°¾çº",15,"water","regular","wild.zone-02.water-01",{mode:"wild",context:"wild/zone-02"}),
    makeZoneMonster("æ²™æ¼ è±ºç‹¼",16,"fire","regular","wild.zone-02.fire-01",{mode:"wild",context:"wild/zone-02"}),
    makeZoneMonster("æµªå°¾çº",15,"water","regular","wild.zone-02.water-01",{mode:"wild",context:"wild/zone-02"})

];


/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   å†°éœœå±±è„ˆï¼ˆç¬¬ä¸‰å€ï¼‰æ€ªç‰©è³‡æ–™ï¼ŒLv.21~30ã€‚

   1. æŠ€èƒ½æ”¹æˆå¼•ç”¨skillDatabaseè£¡ã€ŒçœŸçš„å­˜åœ¨ã€
      çš„æŠ€èƒ½IDï¼Œä¸å†è‡ªå·±äº‚å–åå­—â€”â€”çŽ©å®¶è‡ªå·±
      ä¹Ÿæœƒç”¨åˆ°ç«ç„°æ–¬ã€æ°´åˆ€æ–¬é€™äº›æŠ€èƒ½ï¼Œ
      æ€ªç‰©ç”¨åŒä¸€æ‹›ï¼ŒçŽ©å®¶ä¸€çœ‹å°±æ‡‚ï¼Œ
      ä¸æœƒè¢«å…©å¥—ä¸åŒåå­—çš„æŠ€èƒ½æžæ··ã€‚
   2. skillIdsæ”¹æˆé™£åˆ—ï¼ˆå°±ç®—ç›®å‰åªæ”¾1å€‹ï¼‰ï¼Œ
      ä¹‹å¾Œé«˜ç­‰ç´šå€åŸŸè¦æ”¾2ã€3å€‹æŠ€èƒ½æ™‚ï¼Œ
      ç›´æŽ¥å¾€é™£åˆ—è£¡åŠ å°±å¥½ï¼Œä¸ç”¨æ”¹è³‡æ–™çµæ§‹ã€‚
   3. æ–°å¢žskillChanceï¼ˆæŠ€èƒ½é‡‹æ”¾æ©ŸçŽ‡ï¼‰ï¼Œ
      æ¯å€‹å€åŸŸçš„æ©ŸçŽ‡ä¸ä¸€æ¨£ï¼Œç›´æŽ¥å¯«åœ¨
      æ€ªç‰©è³‡æ–™è£¡ï¼Œè®€å–çš„åœ°æ–¹ä¸ç”¨å¦å¤–åˆ¤æ–·
      ç¾åœ¨æ˜¯å“ªå€‹å€åŸŸã€‚
*/

const iceMountainMonsters = [

    makeZoneMonster("ç†¾ç„°ç‹¼",22,"fire","regular","wild.zone-03.fire-01",{mode:"wild",context:"wild/zone-03"}),
    makeZoneMonster("æ¾¤æœ¨å¦–",23,"water","regular","wild.zone-03.water-01",{mode:"wild",context:"wild/zone-03"}),
    makeZoneMonster("ç†¾ç„°ç‹¼",22,"fire","regular","wild.zone-03.fire-01",{mode:"wild",context:"wild/zone-03"}),
    makeZoneMonster("æ¾¤æœ¨å¦–",23,"water","regular","wild.zone-03.water-01",{mode:"wild",context:"wild/zone-03"}),
    makeZoneMonster("ç†¾ç„°ç‹¼çŽ‹",27,"fire","regular","wild.zone-03.fire-02",{mode:"wild",context:"wild/zone-03"}),
    makeZoneMonster("å¯’å†°é­”çŽ‹",28,"water","regular","wild.zone-03.water-02",{mode:"wild",context:"wild/zone-03"})

];


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   ç¬¬å››ï½žå…«å€æ€ªç‰©è³‡æ–™ï¼ŒLv.31~80ï¼Œ
   æ¯å€æŠ€èƒ½æ•¸é‡ã€æŠ€èƒ½é‡‹æ”¾æ©ŸçŽ‡éƒ½ä¸ä¸€æ¨£ï¼š

   31~40ï¼š1å€‹æŠ€èƒ½ï¼Œ55%æ©ŸçŽ‡
   41~50ï¼š2å€‹æŠ€èƒ½ï¼Œ60%æ©ŸçŽ‡
   51~60ï¼š2å€‹æŠ€èƒ½ï¼Œ65%æ©ŸçŽ‡
   61~70ï¼š3å€‹æŠ€èƒ½ï¼Œ65%æ©ŸçŽ‡
   71~80ï¼š3å€‹æŠ€èƒ½ï¼Œ70%æ©ŸçŽ‡

   æŠ€èƒ½æ± çµ±ä¸€å¾žskillDatabaseè£¡æŒ‘é¸
   ç«/æ°´ç³»çš„å‚·å®³é¡žæŠ€èƒ½ï¼Œç­‰ç´šè¶Šé«˜çš„å€åŸŸ
   æŠ€èƒ½æ± è£¡çš„æ‹›å¼ä¹Ÿè¶Šå¤šæ¨£ã€è¶Šå¼·ã€‚

   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
   ç‹€æ…‹ç›´æŽ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   é€™äº›æ‰‹å‹•æŽ’çš„æŠ€èƒ½æ± é™£åˆ—å·²ç¶“è¢«
   getMonsterSkillPoolForLevel()é€™å€‹
   çµ±ä¸€è¦å‰‡å–ä»£ï¼ˆè¦‹makeZoneMonster()
   é™„è¿‘ï¼‰ï¼Œä¸æœƒå†ç”¨åˆ°ï¼Œæ•´çµ„æ‹¿æŽ‰ã€‚
*/


/* Monster generation uses the same six-stat roles and coefficients as player characters. */

function distributeRandomPoints(
    totalPoints,
    categoryCount
){

    const base=
        Math.floor(
            totalPoints/
            categoryCount
        );


    const shares=
        new Array(categoryCount)
        .fill(base);


    let remainder=
        totalPoints-
        base*categoryCount;


    let guardIndex=
        0;

    while(remainder>0){

        shares[
            guardIndex%
            categoryCount
        ]++;

        remainder--;

        guardIndex++;

    }


    return shares;

}


function generateMonsterAttributePoints(
    level
){

    /* Monster generation assigns explicit Defense independently of Vitality. */
    const totalPoints=
        10+level*2;


    const agilityPoints=
        Math.round(
            level/3
        );


    const allocatable=
        Math.max(
            0,
            totalPoints-
            agilityPoints
        );


    const vitalityPoints=
        Math.round(
            allocatable*0.1
        );


    const randomPoolPoints=
        Math.max(
            0,
            allocatable-
            vitalityPoints
        );


    /* Stable order keeps same-level monsters deterministic. */

    const randomShares=
        distributeRandomPoints(
            randomPoolPoints,
            4
        );


    return {

        vitality:
            vitalityPoints,

        attack:
            randomShares[0],

        energy:
            randomShares[1],

        intelligence:
            randomShares[2],

        defense:
            randomShares[3],

        agility:
            agilityPoints

    };

}


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸ç‹€æ…‹
   ç›´æŽ¥åšï¼Œæˆ‘çµ¦ä½ åˆ†ç´šã€ï¼‰ï¼š
   é‡Žæ€ªæŠ€èƒ½åˆ†ç´šè¦å‰‡ï¼Œçµ±ä¸€ç”±ç­‰ç´šæ±ºå®šé‡Žæ€ª
   ã€Œæ‹¿å¾—åˆ°å“ªäº›æŠ€èƒ½ã€è·Ÿã€Œæ”¾æŠ€èƒ½çš„æ©ŸçŽ‡ã€ï¼Œ
   ä¸ç”¨åƒä»¥å‰é‚£æ¨£æ¯å€‹å€åŸŸæ‰‹å‹•æŽ’æŠ€èƒ½ID
   é™£åˆ—ã€æ‰‹å‹•æŠ“æ©ŸçŽ‡æ•¸å­—ï¼Œåªè¦çµ¦å°element+
   levelï¼Œå…¶ä»–è‡ªå‹•ç®—å¥½ï¼š

   Lv.1~10ã€€ã€€åªæœƒæ™®é€šæ”»æ“Šï¼Œä¸æœƒæ”¾æŠ€èƒ½
   Lv.11~40ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬1ç´šã€æŠ€èƒ½ï¼Œ35%æ©ŸçŽ‡
   Lv.41~70ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬2ç´šã€æŠ€èƒ½ï¼Œ45%æ©ŸçŽ‡
   Lv.71~100ã€€å¯ä»¥æ”¾åˆ°ã€Œç¬¬3ç´šã€æŠ€èƒ½ï¼Œ55%æ©ŸçŽ‡

   ã€Œç¬¬Nç´šã€æ˜¯ç´¯åŠ çš„ï¼ˆä¸æ˜¯åªçµ¦é‚£ä¸€ç´šï¼Œæ˜¯
   å¾žç¬¬1ç´šåˆ°ç¬¬Nç´šå…¨éƒ¨éƒ½å¯èƒ½æ”¾ï¼‰ï¼Œè·ŸæŠ€èƒ½
   æœ¬èº«åœ¨ç‰©ç†/æ³•è¡“éˆä¸Šç¬¬å¹¾æ‹›å°æ‡‰ï¼ˆè¦‹
   skillDatabaseè£¡æ¯å€‹æ”»æ“ŠæŠ€èƒ½æ–°å¢žçš„tier
   æ¬„ä½ï¼Œ1=å…¥é–€ã€2=ç¬¬äºŒæ‹›ã€3=ç¬¬ä¸‰æ‹›ã€
   4=æœ€å¼·æ‹›â€”â€”é‡Žæ€ªæœ€é«˜åªåˆ°3ç´šï¼Œ4ç´šçš„
   çµ‚æ¥µæŠ€èƒ½ä¸æœƒå‡ºç¾åœ¨é‡Žæ€ªèº«ä¸Šï¼‰ã€‚
*/

function getMonsterSkillTierAndChance(level){

    if(level<=10){

        return {
            maxTier:0,
            chance:0
        };

    }


    if(level<=40){

        return {
            maxTier:1,
            chance:0.35
        };

    }


    if(level<=70){

        return {
            maxTier:2,
            chance:0.45
        };

    }


    return {
        maxTier:3,
        chance:0.55
    };

}


function getMonsterSkillPoolForLevel(
    element,
    level
){

    const {maxTier}=
        getMonsterSkillTierAndChance(
            level
        );


    if(maxTier<=0){
        return [];
    }


    return Object.keys(skillDatabase)
        .filter(skillId=>{

            const skill=
                skillDatabase[skillId];


            return (
                skill.element===element&&
                (
                    skill.category===
                    "physical"||
                    skill.category===
                    "magic"
                )&&
                skill.tier&&
                skill.tier<=maxTier
            );

        });

}


function makeZoneMonster(
    name,
    level,
    element,
    rank,
    portraitKey,
    specOptions
){
    const options=specOptions||{};
    if(options.mode==="wild"){
        const identity=window.MonsterBalanceWildIdentities[portraitKey];
        if(!identity){ throw new Error("Unregistered Wild identity: "+portraitKey); }
        const monster=window.MonsterBalance.build({monsterKey:portraitKey,name,level,element,archetype:identity.archetype,rank:rank||"regular",mode:"wild",context:options.context||identity.zone});
        monster.portraitKey=portraitKey;
        monster.skillIds=getMonsterSkillPoolForLevel(element,level);
        monster.skillChance=getMonsterSkillTierAndChance(level).chance;
        if(identity.zone==="wild/zone-01"){ monster.v173BeginnerForest=true; }
        return configureBuiltMonster(monster);
    }
    // Legacy-only compatibility: Tower/Abyss/Adventure/Boss remain unmigrated.
    return makeLegacyModeMonster(name,level,element,rank,portraitKey);
}

function configureBuiltMonster(monster){
    if(typeof window.v141ConfigureMonsterSkills==="function"){ window.v141ConfigureMonsterSkills(monster); }
    if(typeof window.v144ConfigureMonsterEncounterSkills==="function"){ window.v144ConfigureMonsterEncounterSkills(monster); }
    if(typeof window.v158NormalizeMonsterDefaultEvasion==="function"){ window.v158NormalizeMonsterDefaultEvasion(monster); }
    return monster;
}

function makeLegacyModeMonster(name,level,element,rank,portraitKey){

    const points=
        generateMonsterAttributePoints(
            level
        );


    const maxHP=
        100+
        points.vitality*HP_PER_VITALITY_POINT;


    const maxSP=
        50+
        points.energy*15;


    /*
       â˜… ä¿®æ­£ï¼šskillIdsï¼skillChanceä¸å†
       ç”±å‘¼å«çš„åœ°æ–¹æ‰‹å‹•å‚³å…¥ï¼Œæ”¹æˆå‘¼å«
       getMonsterSkillPoolForLevel()ï¼
       getMonsterSkillTierAndChance()
       è‡ªå‹•ä¾level+elementç®—å¥½ï¼Œä¿è­‰åŒä¸€å€‹
       ç­‰ç´šçš„æ€ªç‰©ï¼Œä¸ç®¡åœ¨å“ªå€‹å€åŸŸã€å“ªæ¬¡
       å‘¼å«ï¼Œæ‹¿åˆ°çš„æŠ€èƒ½æ± ï¼æ–½æ”¾æ©ŸçŽ‡æ°¸é 
       ä¸€è‡´ï¼Œä¸æœƒæœ‰äº›å€åŸŸæ‰‹å‹•æ¼æ”¹ã€æ•¸å­—
       å°ä¸ä¸Šåˆ†ç´šè¦å‰‡çš„æƒ…æ³ã€‚
    */

    return configureBuiltMonster({

        name:name,
        level:level,

        maxHP:maxHP,
        hp:maxHP,

        maxSP:maxSP,
        sp:maxSP,

        /*
           â˜… å…­åœåŽŸå§‹é»žæ•¸ä¹Ÿä¸€èµ·å­˜èµ·ä¾†ï¼Œ
           æ–¹ä¾¿ä¹‹å¾ŒæŸ¥çœ‹/é™¤éŒ¯ï¼Œæˆ°é¬¥å¯¦éš›
           è®€å–çš„æ˜¯ä¸‹é¢æ›ç®—å¥½çš„attack/
           defense/magicAttack/accuracy/
           resistance/evasioné€™äº›ã€Œæœ€çµ‚æ•¸å€¼ã€ï¼Œ
           ä¸æ˜¯é€™å¹¾å€‹åŽŸå§‹é»žæ•¸ã€‚
        */

        vitalityPoints:
            points.vitality,

        attackPoints:
            points.attack,

        energyPoints:
            points.energy,

        intelligencePoints:
            points.intelligence,

        defensePoints:
            points.defense,

        agilityPoints:
            points.agility,


        attack:
            BASE_PHYSICAL_ATTACK+
            Math.max(1,Number(level)||1)*ATTACK_PER_LEVEL+
            points.attack*ATTACK_PER_POINT,

        defense:
            BASE_DEFENSE+
            Math.max(1,Number(level)||1)*DEFENSE_PER_LEVEL+
            points.defense*DEFENSE_PER_POINT,

        magicAttack:
            BASE_MAGIC_ATTACK+
            Math.max(1,Number(level)||1)*MAGIC_ATTACK_PER_LEVEL+
            points.intelligence*MAGIC_ATTACK_PER_POINT,

        accuracy:0,

        statusResistance:0,

        antiCrit:0,

        evasion:
            0,

        agility:
            points.agility,


        alive:true,
        element:element,
        portraitKey:portraitKey||undefined,

        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œä»¥å¾Œ
           ç²¾è‹±æ€ªè·ŸBOSSçš„åç¨±ä¸æœƒæœ‰çŽ‹æˆ–çš‡ï¼Œ
           æˆ‘æœƒç›´æŽ¥è·Ÿå¦³èªªèª°èª°èª°å°±æ˜¯å¥—ç”¨
           ä»€éº¼æ€ªã€ï¼‰ï¼š
           æ–°å¢žç¬¬4å€‹åƒæ•¸rankï¼Œç›´æŽ¥æ˜Žç¢ºæŒ‡å®š
           "elite"ï¼"boss"ï¼Œä¸ç”¨å†é åå­—
           çµå°¾çŒœã€‚getMonsterRank()åŽŸæœ¬å°±
           å·²ç¶“å¯«æˆã€Œå„ªå…ˆçœ‹monster.rankæ¬„ä½ï¼Œ
           æ²’æœ‰æ‰é€€å›žçœ‹åå­—çµå°¾ã€ï¼Œé€™è£¡æŽ¥ä¸Š
           ä¹‹å¾Œï¼Œå¾€å¾Œæ–°æ€ªç‰©åªè¦åœ¨
           makeZoneMonster()å‘¼å«æ™‚å¤šè£œä¸€å€‹
           åƒæ•¸å°±å¥½ï¼Œä¾‹å¦‚ï¼š
           makeZoneMonster("ç†”å²©é­”åƒ",45,
           "fire","elite")
           ä¸å¯«é€™å€‹åƒæ•¸ï¼ˆç¶­æŒ3å€‹åƒæ•¸ï¼‰çš„è©±ï¼Œ
           ç…§èˆŠç”±getMonsterRank()é€€å›žçœ‹
           åå­—çµå°¾åˆ¤æ–·ï¼ŒèˆŠè³‡æ–™å®Œå…¨ä¸ç”¨æ”¹ã€‚
        */

        rank:
            rank||
            undefined,

        skillIds:
            getMonsterSkillPoolForLevel(
                element,
                level
            ),

        skillChance:
            getMonsterSkillTierAndChance(
                level
            ).chance

    });

}


const zone4Monsters = [

    makeZoneMonster("çƒˆç„°å·¨é­”",32,"fire","regular","wild.zone-04.fire-01",{mode:"wild",context:"wild/zone-04"}),
    makeZoneMonster("æ²¼é‰¤æ€ª",33,"water","regular","wild.zone-04.water-01",{mode:"wild",context:"wild/zone-04"}),
    makeZoneMonster("çƒˆç„°å·¨é­”",32,"fire","regular","wild.zone-04.fire-01",{mode:"wild",context:"wild/zone-04"}),
    makeZoneMonster("æ²¼é‰¤æ€ª",33,"water","regular","wild.zone-04.water-01",{mode:"wild",context:"wild/zone-04"}),
    makeZoneMonster("ç‚ŽéŒ˜å·¨é­”",38,"fire","regular","wild.zone-04.fire-02",{mode:"wild",context:"wild/zone-04"}),
    makeZoneMonster("æ·±æ·µæ°´éˆçŽ‹",40,"water","regular","wild.zone-04.water-02",{mode:"wild",context:"wild/zone-04"})

];


const zone5Monsters = [

    makeZoneMonster("ç†”å²©å·¨ç¸",42,"fire","regular","wild.zone-05.fire-01",{mode:"wild",context:"wild/zone-05"}),
    makeZoneMonster("æ½®è›™å’",43,"water","regular","wild.zone-05.water-01",{mode:"wild",context:"wild/zone-05"}),
    makeZoneMonster("ç†”å²©å·¨ç¸",42,"fire","regular","wild.zone-05.fire-01",{mode:"wild",context:"wild/zone-05"}),
    makeZoneMonster("æ½®è›™å’",43,"water","regular","wild.zone-05.water-01",{mode:"wild",context:"wild/zone-05"}),
    makeZoneMonster("ç†”ç¿¼ç¸çŽ‹",48,"fire","regular","wild.zone-05.fire-02",{mode:"wild",context:"wild/zone-05"}),
    makeZoneMonster("å¯’æ½®å·¨ç¸çŽ‹",50,"water","regular","wild.zone-05.water-02",{mode:"wild",context:"wild/zone-05"})

];


const zone6Monsters = [

    makeZoneMonster("èµ¤ç‚Žä¿®ç¾…",52,"fire","regular","wild.zone-06.fire-01",{mode:"wild",context:"wild/zone-06"}),
    makeZoneMonster("é±—æ½­ç¸",53,"water","regular","wild.zone-06.water-01",{mode:"wild",context:"wild/zone-06"}),
    makeZoneMonster("èµ¤ç‚Žä¿®ç¾…",52,"fire","regular","wild.zone-06.fire-01",{mode:"wild",context:"wild/zone-06"}),
    makeZoneMonster("é±—æ½­ç¸",53,"water","regular","wild.zone-06.water-01",{mode:"wild",context:"wild/zone-06"}),
    makeZoneMonster("å…­è‡‚ä¿®ç¾…",58,"fire","regular","wild.zone-06.fire-02",{mode:"wild",context:"wild/zone-06"}),
    makeZoneMonster("çŽ„å†°ä¿®ç¾…çŽ‹",60,"water","regular","wild.zone-06.water-02",{mode:"wild",context:"wild/zone-06"})

];


const zone7Monsters = [

    makeZoneMonster("æ¥­ç«é­”å›",62,"fire","regular","wild.zone-07.fire-01",{mode:"wild",context:"wild/zone-07"}),
    makeZoneMonster("ç€¾èŠ±å§¬",63,"water","regular","wild.zone-07.water-01",{mode:"wild",context:"wild/zone-07"}),
    makeZoneMonster("æ¥­ç«é­”å›",62,"fire","regular","wild.zone-07.fire-01",{mode:"wild",context:"wild/zone-07"}),
    makeZoneMonster("ç€¾èŠ±å§¬",63,"water","regular","wild.zone-07.water-01",{mode:"wild",context:"wild/zone-07"}),
    makeZoneMonster("æ¥­ç‚Žæ³•çŽ‹",68,"fire","regular","wild.zone-07.fire-02",{mode:"wild",context:"wild/zone-07"}),
    makeZoneMonster("çµ•å†°é­”å›çŽ‹",70,"water","regular","wild.zone-07.water-02",{mode:"wild",context:"wild/zone-07"})

];


const zone8Monsters = [

    makeZoneMonster("ç„šå¤©é¾ç„",72,"fire","regular","wild.zone-08.fire-01",{mode:"wild",context:"wild/zone-08"}),
    makeZoneMonster("æµ·èœ‡å·«",73,"water","regular","wild.zone-08.water-01",{mode:"wild",context:"wild/zone-08"}),
    makeZoneMonster("ç„šå¤©é¾ç„",72,"fire","regular","wild.zone-08.fire-01",{mode:"wild",context:"wild/zone-08"}),
    makeZoneMonster("æµ·èœ‡å·«",73,"water","regular","wild.zone-08.water-01",{mode:"wild",context:"wild/zone-08"}),
    makeZoneMonster("ç„šå¤©ç‚Žé¾",78,"fire","regular","wild.zone-08.fire-02",{mode:"wild",context:"wild/zone-08"}),
    makeZoneMonster("æ¥µå¯’é¾ç„çš‡",80,"water","regular","wild.zone-08.water-02",{mode:"wild",context:"wild/zone-08"})

];


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ–°å¢ž81ï½ž90ã€
   91ï½ž100å…©å€‹åœ°å€ï¼‰ï¼š
   å»¶çºŒzone4~8çš„ç­‰ç´š/æŠ€èƒ½æ± åˆ†é…è¦å¾‹
   ï¼ˆæ¯å€è·¨10ç´šã€çŽ‹ç´šæ¯”ä¸€èˆ¬é«˜6~8ç´šã€
   æŠ€èƒ½æ± æ²¿ç”¨åŒä¸€ç³»åˆ—çš„ç¬¬3æ± â€”â€”ç›®å‰
   FIRE_SKILL_POOL_3/WATER_SKILL_POOL_3
   æ˜¯æœ€é«˜éšŽçš„æŠ€èƒ½æ± ï¼Œæ²’æœ‰æ›´é«˜ä¸€éšŽçš„æ± å­ï¼Œ
   é€™å…©å€‹æ–°åœ°å€å»¶çºŒä½¿ç”¨åŒä¸€çµ„ï¼Œç­‰ä¹‹å¾Œ
   æœ‰éœ€è¦å†æ“´å……æ–°çš„æŠ€èƒ½æ± ï¼‰ã€‚
*/

const zone9Monsters = [

    makeZoneMonster("è™›ç©ºç…‰ç„",82,"fire","regular","wild.zone-09.fire-01",{mode:"wild",context:"wild/zone-09"}),
    makeZoneMonster("éœœé¬ƒç‹¼",83,"water","regular","wild.zone-09.water-01",{mode:"wild",context:"wild/zone-09"}),
    makeZoneMonster("è™›ç©ºç…‰ç„",82,"fire","regular","wild.zone-09.fire-01",{mode:"wild",context:"wild/zone-09"}),
    makeZoneMonster("éœœé¬ƒç‹¼",83,"water","regular","wild.zone-09.water-01",{mode:"wild",context:"wild/zone-09"}),
    makeZoneMonster("ç„è¼ªé­”å°Š",88,"fire","regular","wild.zone-09.fire-02",{mode:"wild",context:"wild/zone-09"}),
    makeZoneMonster("æ°¸å‡æ·±æ·µçš‡",90,"water","regular","wild.zone-09.water-02",{mode:"wild",context:"wild/zone-09"})

];


const zone10Monsters = [

    makeZoneMonster("çµ‚ç„‰ç¥žé­”",92,"fire","regular","wild.zone-10.fire-01",{mode:"wild",context:"wild/zone-10"}),
    makeZoneMonster("çŽ„æ½®ä¿ ",93,"water","regular","wild.zone-10.water-01",{mode:"wild",context:"wild/zone-10"}),
    makeZoneMonster("çµ‚ç„‰ç¥žé­”",92,"fire","regular","wild.zone-10.fire-01",{mode:"wild",context:"wild/zone-10"}),
    makeZoneMonster("çŽ„æ½®ä¿ ",93,"water","regular","wild.zone-10.water-01",{mode:"wild",context:"wild/zone-10"}),
    makeZoneMonster("æœ«ç‚Žç¥­å¸",98,"fire","regular","wild.zone-10.fire-02",{mode:"wild",context:"wild/zone-10"}),
    makeZoneMonster("æœ«ä¸–å¯’ç¥žçš‡",100,"water","regular","wild.zone-10.water-02",{mode:"wild",context:"wild/zone-10"})

];



/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ•´å€‹æ›æŽ‰ï¼Œ
   ä»¥å¾Œéƒ½å¥—ç”¨ã€ï¼‰ï¼š
   èˆŠçš„ã€Œç²¾è‹±æ€ªåŸºæº–å€¼ Ã— 0.25ã€é€™å¥—æŠ˜æ‰£
   æ©Ÿåˆ¶ï¼Œå·²ç¶“è¢«ä¸Šé¢å…¨æ–°çš„å…­åœèƒ½åŠ›é»žåˆ†é…
   å…¬å¼å®Œå…¨å–ä»£â€”â€”makeZoneMonster()ç¾åœ¨
   ç›´æŽ¥ä¾ç…§ç­‰ç´šç®—å‡ºæœ€çµ‚æ•¸å€¼ï¼Œä¸å†éœ€è¦
   é¡å¤–ç–ŠåŠ ä¸€å±¤ç¸®æ”¾ä¿‚æ•¸ï¼Œé€™è£¡æ•´æ®µæ‹¿æŽ‰ã€‚
*/


/*
   â˜… ç›®å‰æ‰€åœ¨å€åŸŸçš„æ€ªç‰©è³‡æ–™ï¼Œ
   é€²å…¥ä¸åŒç·´åŠŸå€æ™‚æœƒé‡æ–°æŒ‡å‘å°æ‡‰çš„é™£åˆ—ã€‚
   å…¶ä»–æ‰€æœ‰å‡½å¼ï¼ˆrenderBattleã€monsterTurnã€
   respawnMonstersâ€¦ï¼‰éƒ½æ˜¯ç›´æŽ¥è®€é€™å€‹è®Šæ•¸ï¼Œ
   ä¸éœ€è¦å¦å¤–æ”¹ï¼Œåˆ‡æ›å€åŸŸåªè¦é‡æ–°è³¦å€¼å°±å¥½ã€‚
*/

let monsters =
    forestMonsters;


let currentZone =
    "forest";


/* =====================================================
   æŠ€èƒ½
===================================================== */




/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒæŠŠç«å…ƒç´ æŠ€èƒ½
   iconæ”¾å°çš„ä½ç½®ã€ï¼‰ï¼š
   10å€‹ç«ç³»æŠ€èƒ½çš„iconåœ–ç‰‡ï¼ˆä½¿ç”¨è€…ä¸Šå‚³çš„
   AIç”Ÿæˆæ’åœ–ï¼Œå·²è£åˆ‡æˆæ­£æ–¹å½¢ä¸¦å£“ç¸®æˆ
   base64å…§åµŒï¼‰ï¼Œå°æ‡‰è¦å‰‡ä¾ç…§åœ–ç‰‡å…§å®¹
   è·ŸæŠ€èƒ½åç¨±/æ•ˆæžœé…å°ï¼š
   flameSlashï¼ˆç«ç„°æ–¬ï¼Œå…¥é–€å–®é«”æ–¬æ“Šï¼‰
     â†’ ç«ç„°åŠèº«+å¼§å½¢ç«ç—•ï¼Œæœ€åŸºæœ¬çš„
       ã€ŒåŠ+ç«ã€ç•«é¢
   fireCriticalï¼ˆæœƒå¿ƒä¸€æ“Šï¼Œé«˜å‚·å®³å–®é«”ï¼‰
     â†’ åŠæ’åœ°ã€å‘¨åœçˆ†ç™¼ç’°ç‹€ç´…è‰²å…‰æ³¢ï¼Œ
       ä»£è¡¨çˆ†æ“Šçž¬é–“çš„å¼·çƒˆè¡æ“Šæ„Ÿ
   explosiveFlurryï¼ˆç«çˆ†äº‚æ“Šï¼Œä¸‰äººäº‚æ“Šï¼‰
     â†’ è§’è‰²é›™åˆ€çˆ†è£‚æ®ç ï¼Œå°æ‡‰ã€Œäº‚æ“Šã€
       çš„å‹•æ…‹æ„Ÿ
   dragonSlashï¼ˆéœ¸é¾è£‚å¤©æ–¬ï¼Œå–®é«”å¤§å‚·å®³ï¼‰
     â†’ é¾é ­+æ’•è£‚å¤©éš›çš„å…‰æŸæ–¬ï¼Œå‘¼æ‡‰
       æŠ€èƒ½åè£¡çš„ã€Œé¾ã€èˆ‡ã€Œè£‚å¤©ã€
   fireRocketï¼ˆç«ç®­ï¼Œä¸‰äººæ³•è¡“å‚·å®³ï¼‰
     â†’ å¼“+ç‡ƒç‡’çš„ç®­ï¼Œç›´æŽ¥å°æ‡‰ã€Œç®­ã€
       é€™å€‹æŠ€èƒ½å
   blazeSpellï¼ˆçƒˆç«è¡“ï¼Œå–®é«”æ³•è¡“ï¼‰
     â†’ ç´”ç²¹çš„ç«ç„°æ¼©æ¸¦æ³•é™£ï¼Œä»£è¡¨
       æ–½æ³•ç”¢ç”Ÿçš„ç«ç³»æ³•è¡“æ•ˆæžœ
   flameTornadoï¼ˆçƒˆç„°é¾æ²ï¼Œæ•´æŽ’+ç‡ƒç‡’ï¼‰
     â†’ ç«é¾ç›¤æ—‹æˆé¾æ²é¢¨çš„å½¢ç‹€ï¼Œ
       å°æ‡‰æŠ€èƒ½åè£¡çš„ã€Œé¾æ²ã€
   phoenixCryï¼ˆç«é³³å¤©é³´ï¼Œå…¨é«”+ç‡ƒç‡’ï¼‰
     â†’ ç«é³³å‡°å±•ç¿…å˜¶é³´ï¼Œç›´æŽ¥å°æ‡‰
       æŠ€èƒ½åã€Œç«é³³ã€
   rageï¼ˆæ€’ç«ï¼Œçˆ†æ“ŠçŽ‡/å‚·å®³å¢žç›Šï¼‰
     â†’ å’†å“®çš„ç«ç„°æƒ¡é­”è‡‰ï¼Œä»£è¡¨ã€Œæ€’ç«ã€
       ä¸­ç‡’çš„æ†¤æ€’æ„Ÿï¼ˆä¾ä½¿ç”¨è€…å›žå ±ï¼Œ
       è·Ÿæœƒå¿ƒä¸€æ“ŠåŽŸæœ¬é…åäº†ï¼Œé€™è£¡
       å·²ç¶“å°èª¿ï¼‰
   fireEXï¼ˆç«å…ƒç´ EXï¼Œè¢«å‹•ï¼‰
     â†’ åœ–ç‰‡æœ¬èº«å°±å¯«è‘—ã€ŒEXã€å­—æ¨£ï¼Œ
       ç›´æŽ¥å°æ‡‰
*/

const elementSkillIconMap = {
    flameSlash:"assets/skills/fire-flame-slash.jpg",
    dragonSlash:"assets/skills/fire-dragon-slash.jpg",
    explosiveFlurry:"assets/skills/fire-explosive-flurry.jpg",
    rage:"assets/skills/fire-rage.jpg",
    fireSoulResonance:"assets/skills/fire-soul-resonance.webp",
    bloodBurnArt:"assets/skills/fire-blood-burn.webp",
    blazeSpell:"assets/skills/fire-blaze-spell.jpg",
    fireCritical:"assets/skills/fire-critical.jpg",
    fireRocket:"assets/skills/fire-rocket.jpg",
    phoenixCry:"assets/skills/fire-phoenix-cry.jpg",
    flameTornado:"assets/skills/fire-flame-tornado.jpg",
    fireEX:"assets/skills/fire-ex.jpg",

    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ›æ°´å…ƒç´ ã€ï¼‰ï¼š
       10å€‹æ°´ç³»æŠ€èƒ½çš„iconï¼Œé…å°ä¾ç…§åœ–ç‰‡å…§å®¹
       è·ŸæŠ€èƒ½åç¨±/æ•ˆæžœï¼š
       waterKnifeï¼ˆæ°´åˆ€æ–¬ï¼Œå…¥é–€å–®é«”ï¼‰
         â†’ ä¸€é“éŠ³åˆ©çš„æ°´/å†°åˆƒæ–œåŠˆè€ŒéŽ
       frostPunchï¼ˆå†°éœœæ‹³ï¼Œå–®é«”ç‰©ç†ï¼‰
         â†’ ä¸€è¨˜å†°éœœæ‹³é ­æ­£é¢æ®å‡º
       iceSpinï¼ˆå†°æ—‹ä¸€é–ƒï¼Œä¸‰äººç‰©ç†ï¼‰
         â†’ æ—‹è½‰çš„å†°ç³»é£›é¢/æ‰‹è£åŠé€ åž‹ï¼Œ
           å‘¼æ‡‰æŠ€èƒ½åè£¡çš„ã€Œæ—‹ã€
       frostCrushï¼ˆå†°å°é‡æ“Šï¼Œå–®é«”å¤§å‚·å®³ï¼‰
         â†’ å†°è£½æˆ°éŽšé‡é‡ç ¸ä¸‹ï¼Œå°æ‡‰
           æŠ€èƒ½åè£¡çš„ã€Œé‡æ“Šã€
       waterBallï¼ˆæ°´çƒè¡“ï¼Œä¸‰äººæ³•è¡“ï¼‰
         â†’ ä¸€é¡†æ¼©æ¸¦ç‹€æ°´çƒï¼Œç›´æŽ¥å°æ‡‰
           æŠ€èƒ½åã€Œæ°´çƒã€
       floodBeastï¼ˆæ´ªæ°´çŒ›ç¸ï¼Œå–®é«”æ³•è¡“ï¼‰
         â†’ å·¨å¤§çš„æ°´ç³»æ€ªç¸å’†å“®ï¼Œç›´æŽ¥å°æ‡‰
           æŠ€èƒ½åã€ŒçŒ›ç¸ã€
       freezeï¼ˆå†°å°ï¼Œç´”æŽ§å ´ç„¡å‚·å®³ï¼‰
         â†’ å†°æ™¶å°–åˆºå¾žå–®ä¸€åœ°é»žçˆ†ç™¼è€Œå‡ºï¼Œ
           å‘¼æ‡‰ã€Œå†°å°ã€å›°ä½ç›®æ¨™çš„ç•«é¢
       reviveï¼ˆå¾©æ´»è¡“ï¼Œå¾©æ´»å‹æ–¹ï¼‰
         â†’ æ„›å¿ƒ+åå­—+äººå½¢å‰ªå½±ï¼Œç›´æŽ¥å°æ‡‰
           ã€Œå¾©æ´»ã€çš„é‡ç”Ÿæ„è±¡
       healSpellï¼ˆæ²»ç™‚è¡“ï¼Œæ¢å¾©HP/SPï¼‰
         â†’ é›™æ‰‹æ§è‘—ç¶ é‡‘è‰²å…‰èŠ’ï¼Œä»£è¡¨
           æ²»ç™‚çš„æº«æš–æ„Ÿè¦º
       waterEXï¼ˆæ°´å…ƒç´ EXï¼Œè¢«å‹•ï¼‰
         â†’ åœ–ç‰‡æœ¬èº«å¯«è‘—ã€ŒEXã€å­—æ¨£

       å¦å¤–ä½¿ç”¨è€…é€™æ¬¡ä¸Šå‚³äº†11å¼µåœ–ï¼Œ
       ä½†æ°´ç³»åªæœ‰10å€‹æŠ€èƒ½ï¼Œå…¶ä¸­ä¸€å¼µ
       ï¼ˆæˆç‰‡å†°ç®­å¾žå¤©è€Œé™çš„ç•«é¢ï¼‰ç›®å‰
       æ²’æœ‰å°æ‡‰çš„æŠ€èƒ½å¯ä»¥æ”¾ï¼Œå…ˆæ²’æœ‰
       ä½¿ç”¨ï¼Œå¦‚æžœä¹‹å¾Œæ°´ç³»æ–°å¢žæŠ€èƒ½
       ï¼ˆä¾‹å¦‚ç¾¤é«”æ”»æ“ŠæŠ€ï¼‰å¯ä»¥å†ç”¨ä¸Šã€‚
    */

    waterKnife:"assets/skills/water-knife.jpg",
    waterEX:"assets/skills/water-ex.jpg",
    frostPunch:"assets/skills/water-frost-punch.jpg",
    frostCrush:"assets/skills/water-frost-crush.jpg",
    iceSpin:"assets/skills/water-ice-spin.jpg",
    healSpell:"assets/skills/water-heal.jpg",
    waterBall:"assets/skills/water-ball.jpg",
    freeze:"assets/skills/water-freeze.jpg",
    revive:"assets/skills/water-revive.jpg",
    purifyMind:"assets/skills/water-purify-mind.webp",
    floodBeast:"assets/skills/water-flood-beast.jpg",

    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œæ°´å…ƒç´ 
       11æ‹›ã€æ–°å¢žçš„å†°éœœç®­é›¨æŠ€èƒ½ï¼‰ï¼š
       iceArrowRainï¼ˆå†°éœœç®­é›¨ï¼Œå…¨é«”æ³•è¡“ï¼‰
         â†’ æˆç‰‡å†°ç®­å¾žå¤©è€Œé™ï¼Œç›´æŽ¥å°æ‡‰
           ã€Œç®­é›¨ã€é€™å€‹æŠ€èƒ½åï¼Œé€™å¼µåœ–
           ä¸Šæ¬¡ä¸Šå‚³æ°´ç³»iconæ™‚å°±æœ‰çµ¦ï¼Œ
           ç•¶æ™‚æ°´ç³»åªæœ‰10æ‹›æ²’æœ‰ä½ç½®æ”¾ï¼Œ
           é€™æ¬¡å‰›å¥½ç”¨ä¸Š
    */

    iceArrowRain:"assets/skills/water-ice-arrow-rain.jpg",

    /* V173.22ï¼šè£œä¸Šç‹‚é¢¨è¡“ï¼›åˆ†èº«è¡“åœ–å°æ‡‰é–ƒèº²è¡“ã€‚ */
    windSpell:"assets/skills/wind-gale-spell.jpg",
    stormFist:"assets/skills/wind-storm-fist.jpg",
    stormFlurry:"assets/skills/wind-storm-flurry.jpg",
    windCrossSlash:"assets/skills/wind-cross-slash.jpg",
    dizzyFist:"assets/skills/wind-dizzy-fist.jpg",
    stormCircle:"assets/skills/wind-storm-circle.jpg",
    windHowlLightning:"assets/skills/wind-howl-lightning.jpg",
    stormRain:"assets/skills/wind-storm-rain.jpg",
    dodgeSkill:"assets/skills/wind-dodge.jpg",
    stealthSkill:"assets/skills/wind-stealth.jpg",
    dinghaishenzhen:"assets/skills/wind-calm-mind.jpg",
    windEX:"assets/skills/wind-ex.jpg",

    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒåœŸç³»æŠ€èƒ½iconï¼‰ï¼š
       é€™æ¬¡ä½¿ç”¨è€…ä¸Šå‚³äº†15å¼µåœ–ï¼Œå…¶ä¸­4å¼µæ˜¯ç”·è§’Qç‰ˆå·¡æ€ªèƒŒé¢ç«‹ç¹ª
       ï¼ˆä¸æ˜¯æŠ€èƒ½iconï¼Œå¦å¤–è™•ç†ï¼‰ï¼Œå‰©ä¸‹11å¼µæ˜¯æŠ€èƒ½iconå€™é¸ã€‚
       åœŸç³»ç¸½å…±12å€‹æŠ€èƒ½ï¼Œé€å¼µæ¯”å°åç¨±/æŠ€èƒ½æè¿°å¾Œé…å°ï¼š

       â˜… ä¿®æ­£ï¼ˆ2026-08-25ï¼Œä½¿ç”¨è€…æä¾›å¸¶åç¨±æ¨™ç±¤çš„åƒè€ƒåœ–é‡æ–°æ ¸å°ï¼‰ï¼š
       ä½¿ç”¨è€…æŠŠ8å¼µå€™é¸åœ–å„è‡ªæ¨™ä¸Šæ­£ç¢ºçš„æŠ€èƒ½åç¨±å‚³å›žä¾†ï¼Œ
       ç”¨åƒç´ æ¯”å°ï¼ˆä¸æ˜¯è‚‰çœ¼çŒœï¼‰ç¢ºèªæ¯å¼µæ¨™ç±¤åœ–å°æ‡‰åˆ°
       åŽŸå§‹å€™é¸åœ–è£¡çš„å“ªä¸€å¼µï¼ŒæŠ“å‡ºå¯¦éš›é…éŒ¯çš„4å€‹ï¼Œ
       ä¸¦è£œä¸Šä¸€å¼µå…¨æ–°çš„earthEXå°ˆç”¨åœ–ï¼ˆåœ–ä¸Šç›´æŽ¥å¯«è‘—
       ã€ŒEXã€å­—æ¨£ï¼Œè·Ÿfire-ex.jpgï¼water-ex.jpgåŒæ¬¾å¼ï¼‰ï¼š

       petrifyFistï¼ˆçŸ³ç›¾æ‹³ï¼Œç‰©ç†ï¼Œé€ æˆå‚·å®³+å…¨é«”è­·ç›¾ï¼‰
         â†’ æ‹³é ­å‡ºæ“Šã€èº«å¾Œæœ‰å²©çŸ³è­·ç›¾å…‰ç’°çš„ç•«é¢ã€‚åŽŸæœ¬é…å°æ­£ç¢ºï¼Œ
           æ²’æœ‰è®Šå‹•ã€‚
       stoneBreakSkyï¼ˆçŸ³ç ´å¤©é©šï¼Œç‰©ç†ï¼Œå–®é«”å¤§å‚·å®³+è­·ç›¾ï¼‰
         â†’ å·¨å¤§å²©çŸ³è£‚é–‹ã€å…‰èŠ’ç‚¸é–‹çš„ç•«é¢ï¼ˆå¸¶æ¼©æ¸¦å…‰ç’°é‚£å¼µï¼‰ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€ŒåœŸçŸ³æ–¬ã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       earthquakeCrushï¼ˆåœ°è£‚é‡æ‹³ï¼Œç‰©ç†ï¼Œä¸‰äººå‚·å®³+è‡ªèº«è­·ç›¾ï¼‰
         â†’ å·¨å¤§æ‹³é ­å½¢å²©å±¤è£‚é–‹ã€é‡‘å…‰å››å°„çš„ç•«é¢ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€Œé£›æ²™çž¬æ“Šã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       stoneThrowï¼ˆè½çŸ³è¡“ï¼Œæ³•è¡“ï¼Œä¸‰äººå‚·å®³+é™é˜²ï¼‰
         â†’ å·¨çŸ³å¾žå¤©è€Œé™çš„ç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œè½çŸ³ã€ã€‚åŽŸæœ¬é…å°
           æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       sandWindï¼ˆæ»¾çŸ³è¡“ï¼Œæ³•è¡“ï¼Œæ©«æŽ’å‚·å®³+é™é˜²ï¼‰
         â†’ å·¨çŸ³æ»¾å‹•ã€æ‹–å‡ºå…‰è·¡çš„ç•«é¢ï¼Œå°æ‡‰ã€Œæ»¾çŸ³ã€ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€Œé£›æ²™çž¬æ“Šã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       flyingSandStrikeï¼ˆé£›æ²™çž¬æ“Šï¼Œæ³•è¡“ï¼Œå…¨é«”å‚·å®³+æ©ŸçŽ‡çŸ³åŒ–ï¼‰
         â†’ é‡‘è‰²æ²™å¡µ/èƒ½é‡æ¼©æ¸¦ç•«é¢ï¼Œå°æ‡‰ã€Œé£›æ²™ã€ã€‚
           â˜…åŽŸæœ¬èª¤é…åˆ°ã€Œæ»¾çŸ³è¡“ã€ç”¨çš„é‚£å¼µåœ–ï¼Œé€™æ¬¡ä¿®æ­£ã€‚
       dustStormï¼ˆåœ°ç‰›çŒ›è¥²ï¼Œæ³•è¡“ï¼Œå…¨é«”å‚·å®³+é™é˜²ï¼‰
         â†’ å²©çŸ³å·¨ç‰›è¡é‹’çš„ç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œåœ°ç‰›ã€ã€‚åŽŸæœ¬é…å°
           æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       rockWallï¼ˆå²©çŸ³å£å£˜ï¼Œå¢žç›Šï¼Œå…¨é«”é˜²ç¦¦æå‡ï¼‰
         â†’ ä¸€æ•´æŽ’å²©çŸ³å°–å¡”ä¸¦åˆ—çš„ç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œå£å£˜ã€ã€‚åŽŸæœ¬
           é…å°æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       barrierï¼ˆçµç•Œï¼Œå¢žç›Šï¼Œå–®é«”å®Œå…¨é˜²è­·ï¼‰
         â†’ ç™¼å…‰çš„é­”æ³•é™£åœ“é ‚çµç•Œç•«é¢ï¼Œç›´æŽ¥å°æ‡‰ã€Œçµç•Œã€ã€‚åŽŸæœ¬
           é…å°æ­£ç¢ºï¼Œæ²’æœ‰è®Šå‹•ã€‚
       stoneSlashï¼ˆåœŸçŸ³æ–¬ï¼Œå…¥é–€å–®é«”ç‰©ç†æŠ€èƒ½ï¼‰
         â†’ ä½¿ç”¨è€…æ¨™æ˜Žæ˜¯ã€Œå²©çŸ³è£‚é–‹ã€å…‰æŸæ–œåŠˆã€é‚£å¼µåœ–
           ï¼ˆåŽŸæœ¬èª¤é…åˆ°ã€Œåœ°è£‚é‡æ‹³ã€ï¼Œç¾åœ¨è£œå›žæ­£ç¢ºä½ç½®ï¼‰ã€‚
       earthEXï¼ˆåœŸå…ƒç´ EXï¼Œè¢«å‹•ï¼‰
         â†’ ä½¿ç”¨è€…æ–°æä¾›çš„å°ˆç”¨ã€ŒEXã€å­—æ¨£åœ–ï¼Œè·Ÿ
           fire-ex.jpgï¼water-ex.jpgåŒæ¬¾å¼ã€‚

       â˜… earthShieldï¼ˆè¬è±¡åœŸç›¾ï¼Œå¢žç›Šï¼Œå–®é«”åå‚·è­·ç›¾ï¼‰
       ä½¿ç”¨è€…é‡æ–°æä¾›ä¸¦æ¨™æ˜Žã€Œè¬è±¡åœŸç›¾ã€å°ˆç”¨åœ–ï¼ˆé‡‘è‰²åœŸç›¾æ­£é¢
       ç‰¹å¯«ï¼‰ï¼Œè£œå›žé€™å€‹keyã€‚
    */

    petrifyFist:"assets/skills/earth-petrify-fist.jpg",
    stoneBreakSky:"assets/skills/earth-stone-break-sky.jpg",
    earthquakeCrush:"assets/skills/earth-earthquake-crush.jpg",
    stoneThrow:"assets/skills/earth-stone-throw.jpg",
    sandWind:"assets/skills/earth-sand-wind.jpg",
    flyingSandStrike:"assets/skills/earth-flying-sand-strike.jpg",
    dustStorm:"assets/skills/earth-dust-storm.jpg",
    rockWall:"assets/skills/earth-rock-wall.jpg",
    barrier:"assets/skills/earth-barrier.jpg",
    stoneSlash:"assets/skills/earth-stone-slash.jpg",
    earthEX:"assets/skills/earth-ex.jpg",
    earthShield:"assets/skills/earth-shield.jpg"
};

/*
   â˜… æ–°å¢žï¼šå–å¾—æŠ€èƒ½iconçš„CSSèƒŒæ™¯åœ–ç‰‡å­—ä¸²ï¼Œ
   ç›®å‰åªæœ‰ç«ç³»10å€‹æŠ€èƒ½æœ‰åœ–ï¼Œå…¶ä»–å…ƒç´ 
   ï¼ˆæ°´/é¢¨/åœŸï¼‰é‚„æ²’æœ‰iconï¼Œé€™è£¡çµ±ä¸€åš
   nullä¿è­·ï¼Œæ²’æœ‰å°æ‡‰åœ–ç‰‡å°±å›žå‚³ç©ºå­—ä¸²ï¼Œ
   è®“é‚£æ ¼iconæ¡†ä¿æŒåŽŸæœ¬çš„ç©ºç™½æ¨£å¼ï¼Œ
   ä¸æœƒå› ç‚ºæ‰¾ä¸åˆ°åœ–è€Œå ±éŒ¯ã€‚
*/

function getSkillIconBackgroundImage(skillId){

    const url=
        elementSkillIconMap[skillId];


    if(!url){
        return "";
    }


    return "url('"+url+"')";

}


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå‰ç½®æŠ€èƒ½è¦
   å­¸å¾—æ©Ÿåˆ¶ã€ï¼Œç›®å‰åªå¥—ç”¨åœ¨ç«/æ°´å…©ç³»ï¼Œ
   é¢¨/åœŸç³»skillDatabaseé‚„æ²’æœ‰requires
   æ¬„ä½ï¼Œä¹‹å¾Œè¦åšå†è£œï¼‰ï¼š

   æ¯å€‹æŠ€èƒ½å¯ä»¥æœ‰ä¸€å€‹requiresé™£åˆ—ï¼Œè£¡é¢
   æ”¾ã€Œéœ€è¦å“ªäº›æŠ€èƒ½idã€ï¼Œè¦å‰‡çµ±ä¸€æ˜¯
   ã€ŒORã€ï¼ˆä»»ä¸€ï¼‰é—œä¿‚â€”â€”é™£åˆ—è£¡åªè¦æœ‰
   ä»»ä½•ä¸€å€‹æŠ€èƒ½ç­‰ç´š>0ï¼Œå‰ç½®å°±ç®—é€šéŽã€‚
   å–®ä¸€å‰ç½®ç›´æŽ¥å¯«æˆé•·åº¦1çš„é™£åˆ—å³å¯
   ï¼ˆ['flameSlash']é€™ç¨®ï¼‰ï¼Œæ•ˆæžœç­‰åŒ
   ã€Œä¸€å®šè¦å­¸é€™å€‹ã€ï¼›æ²’æœ‰requiresæ¬„ä½
   æˆ–ç©ºé™£åˆ—ï¼Œä»£è¡¨æ²’æœ‰å‰ç½®é™åˆ¶ã€‚

   ä¹‹æ‰€ä»¥çµ±ä¸€ç”¨ORã€ä¸ç‰¹åˆ¥æ”¯æ´ANDï¼Œæ˜¯å› ç‚º
   ä½¿ç”¨è€…æä¾›çš„æŠ€èƒ½è¡¨è£¡ï¼Œæ‰€æœ‰å¤šé‡å‰ç½®
   çš„æ¡ˆä¾‹ï¼ˆä¾‹å¦‚ã€Œç«çˆ†äº‚æ“Šæˆ–çƒˆç„°é¾æ²å…¶ä¸€ã€ï¼‰
   å…¨éƒ¨éƒ½æ˜¯ã€ŒäºŒé¸ä¸€ã€ï¼Œæ²’æœ‰ã€Œå…©å€‹éƒ½è¦ã€
   çš„æ¡ˆä¾‹ï¼Œç”¨ä¸€ç¨®æ ¼å¼å°±å¤ ã€‚
*/

const characterSkillLoadouts = {

    fire:{
        name:"ç«æ³•å¸«",
        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           ä¹‹å‰é€™è£¡æ•…æ„è®“æ–°è§’è‰²é è¨­å…ˆå­¸æœƒ
           ç«ç„°æ–¬1ç´šï¼Œç†ç”±æ˜¯ã€Œä¸æƒ³è¦æŠ€èƒ½æ¬„
           ç©ºç©ºçš„ã€ã€‚ä½†ä½¿ç”¨è€…ç¾åœ¨æ˜Žç¢ºè¡¨ç¤º
           ä¸å¸Œæœ›å‰µè§’æ™‚è‡ªå‹•å¹«ä»–é¸æŠ€èƒ½ï¼Œ
           è¦è‡ªå·±æ±ºå®šå­¸ä»€éº¼â€”â€”æ”¹æˆå®Œå…¨ç©ºç™½ï¼Œ
           ä¸å†è‡ªå‹•å¡žä»»ä½•æŠ€èƒ½é€²åŽ»ã€‚
        */
        skillLevels:{},
        equippedSkills:[]
    },

    water:{
        name:"æ°´æˆ°å£«",
        skillLevels:{},
        equippedSkills:[]
    },

    wind:{
        name:"é¢¨å¼“æ‰‹",
        skillLevels:{},
        equippedSkills:[]
    },

    earth:{
        name:"åœŸé¨Žå£«",
        skillLevels:{},
        equippedSkills:[]
    }

};


/* =====================================================   è§’è‰²
===================================================== */

const characters = [

    {
        id:"fire",
        name:"ç«æ³•å¸«"
    },

    {
        id:"water",
        name:"æ°´æˆ°å£«"
    },

    {
        id:"wind",
        name:"é¢¨å¼“æ‰‹"
    }

];


let inventoryCharacterIndex = 0;


/* =====================================================
   èƒŒåŒ…
===================================================== */

const inventoryItems = [

    {
        id:"ironSword",
        name:"éµåŠ",
        icon:"",
        type:"weapon",
        count:1,
        price:120,
        stats:{
            attack:3
        }
    },

    {
        id:"woodStaff",
        name:"æœ¨æ³•æ–",
        icon:"",
        type:"weapon",
        count:1,
        price:100,
        stats:{
            intelligence:3
        }
    },

    {
        id:"leatherHelmet",
        name:"çš®å¸½",
        icon:"",
        type:"helmet",
        count:1,
        price:80,
        stats:{
            vitality:1
        }
    },

    {
        id:"leatherArmor",
        name:"çš®ç”²",
        icon:"",
        type:"armor",
        count:1,
        price:150,
        stats:{
            vitality:2
        }
    },

    {
        id:"leatherShoes",
        name:"çš®éž‹",
        icon:"",
        type:"shoes",
        count:1,
        price:90,
        stats:{
            agility:2
        }
    },

    {
        id:"hpPotion10",
        name:"å›žå¾©10%HPè—¥æ°´",
        icon:"",
        type:"potion",
        resource:"hp",
        recoveryPercent:10,
        count:3,
        price:20,
        stats:{}
    },

    {
        id:"spPotion10",
        name:"å›žå¾©10%SPè—¥æ°´",
        icon:"",
        type:"potion",
        resource:"sp",
        recoveryPercent:10,
        count:2,
        price:25,
        stats:{}
    }

];


const inventorySlots =
    new Array(120).fill(null);


function rebuildInventorySlots(){

    normalizeInventoryStacks();

    inventorySlots.fill(null);


    inventoryItems.forEach(
        (item,index)=>{

            if(index<120){

                inventorySlots[index] =
                    item;

            }

        }
    );

}


/* =====================================================
   æˆ°é¬¥ç‹€æ…‹
===================================================== */

let battleActive=false;

let battleToken=0;

let selectedMonster=null;

/*
   â˜… æ–°å¢žï¼šé€™å ´æˆ°é¬¥å¯¦éš›æ²å…¥çš„æ€ªç‰©ã€ŒåŽŸå§‹é™£åˆ—ç´¢å¼•ã€æ¸…å–®ã€‚
   éš¨æ©Ÿ1~3éš»ï¼Œä¸å†æ˜¯æ¯å ´éƒ½å›ºå®šæŠŠæ•´æ‰¹æ€ªéƒ½æ‹–é€²ä¾†æ‰“ã€‚
   å…¶ä»–å‡½å¼ï¼ˆæ¸²æŸ“ã€ç›®æ¨™é¸æ“‡ã€å›žåˆã€çµç®—ï¼‰
   éƒ½æ”¹æˆåªèªé€™å€‹æ¸…å–®è£¡çš„æ€ªç‰©ï¼Œ
   ä¸åœ¨æ¸…å–®å…§çš„æ€ªç‰©ç¹¼çºŒç•™åœ¨åœ°åœ–ä¸Šï¼Œä¸æœƒè¢«æ‰“ã€‚
*/

let currentBattleMonsters=[];

let turn=1;

let timer=20;

let timerId=null;

/* Every declare/resolve step owns one deterministic advance timer. */
let battleAdvanceTimeoutId=null;
let battleAdvanceScheduled=false;
/* Queue timing has one owner: this module. V142/V143 report visual time only. */
const MANUAL_RESOLUTION_START_MS=250;
const POST_ACTION_DELAY_MS=1150;
const BATTLE_DECLARE_ADVANCE_MS=MANUAL_RESOLUTION_START_MS;
const battleActionFinishObservers=new Set();
const battleBeforeCombatantObservers=new Set();
const battleRoundStartObservers=new Set();
const battleRoundEndObservers=new Set();
const battleActionFinishInterceptors=[];
let battleRoundBoundaryKeys=new Set();
const battlePresentationLocks=new Set();
let battleInputResumeToken=null;
let battleResolutionResumeToken=null;
let battleAutoActionResume=null;
let battleRoundPromptTimeoutId=null;
let battleActionNoticeTimeoutId=null;
let battleRoundPromptRelease=null;
let activeBattleStatisticsAction=null;
/*
 * Persistent Effect Duration Lifecycle
 *
 * BattleFlow owns action boundaries, so duration consumption lives here rather
 * than in a late skill module. A snapshot is captured immediately before the
 * combatant acts and consumed once by the matching action-finished signal.
 * Effects created during that action are not present in the snapshot and do
 * not lose a turn immediately. Burn and explicitly charge/round-owned states
 * stay outside this action lifecycle.
 */
const BATTLE_ACTION_DURATION_STATUS_TYPES=new Set([
    "freeze","petrify","frostbite","agilityDown","statDown","damageDown","defenseDown","stun"
]);
const BATTLE_ACTION_DURATION_EXCLUDED_BUFFS=new Set(["phoenixMight","bloodBurn"]);
const battleDurationBuffExpiryHandlers=new Set();
let battleDurationAction=null;

function battleDurationNumber(value){
    const number=Number(value);
    return Number.isFinite(number)?number:0;
}
function battleDurationEntityForEntry(entry){
    if(!entry){ return null; }
    if(entry.type==="player"){ return getPartyCharacterByIndex(entry.characterIndex); }
    if(entry.type==="monster"&&Array.isArray(monsters)){ return monsters[entry.monsterIndex]||null; }
    return null;
}
function snapshotBattleActionDuration(entity){
    return {
        buffs:new Set((entity&&Array.isArray(entity.activeBuffs)?entity.activeBuffs:[]).filter(buff=>
            buff&&battleDurationNumber(buff.turnsLeft)>0&&!buff.oneShot&&!BATTLE_ACTION_DURATION_EXCLUDED_BUFFS.has(buff.type)
        )),
        statuses:new Set((entity&&Array.isArray(entity.statusEffects)?entity.statusEffects:[]).filter(effect=>
            effect&&battleDurationNumber(effect.turnsLeft)>0&&BATTLE_ACTION_DURATION_STATUS_TYPES.has(effect.type)
        ))
    };
}
function runBattleDurationBuffExpiryHandlers(entity,buff,mirrored){
    battleDurationBuffExpiryHandlers.forEach(handler=>{
        try{ handler({entity:entity,buff:buff,mirrored:mirrored||null}); }
        catch(error){ console.error("æŒçºŒå¢žç›Šåˆ°æœŸè™•ç†å™¨å¤±æ•—ï¼š",error); }
    });
}
function expireBattleActionBuff(entity,buff){
    if(!entity||!buff||!Array.isArray(entity.activeBuffs)){ return; }
    buff.turnsLeft=Math.max(0,battleDurationNumber(buff.turnsLeft)-1);
    const mirrored=Array.isArray(entity.v141TeamBuffs)
        ?entity.v141TeamBuffs.find(item=>item&&item.displayBuff===buff):null;
    if(mirrored){ mirrored.turnsLeft=buff.turnsLeft; }
    if(buff.turnsLeft>0){ return; }

    entity.activeBuffs=entity.activeBuffs.filter(item=>item!==buff);
    if(mirrored){
        entity.v141TeamBuffs=entity.v141TeamBuffs.filter(item=>item!==mirrored);
        if(mirrored.type==="rage"){
            entity.attack=mirrored.originalAttack;
            entity.magicAttack=mirrored.originalMagicAttack;
        }else if(mirrored.type==="resistance"){
            entity.resistance=Math.max(0,battleDurationNumber(entity.resistance)-battleDurationNumber(mirrored.amount));
        }else if(mirrored.type==="dodge"){
            entity.evasion=mirrored.originalEvasion;
        }
    }

    runBattleDurationBuffExpiryHandlers(entity,buff,mirrored);
    if(typeof addBattleLog==="function"){
        addBattleLog("â³"+(buff.statusName||buff.type)+"æ•ˆæžœå·²çµæŸã€‚");
    }
}
function expireBattleActionStatus(entity,effect){
    if(!entity||!effect||!Array.isArray(entity.statusEffects)){ return; }
    effect.turnsLeft=Math.max(0,battleDurationNumber(effect.turnsLeft)-1);
    if(effect.turnsLeft>0){ return; }
    entity.statusEffects=entity.statusEffects.filter(item=>item!==effect);
    if(typeof addBattleLog==="function"){
        const name=effect.type==="freeze"?"å†°å°":effect.type==="petrify"?"çŸ³åŒ–":effect.type==="frostbite"?"å‡å‚·":effect.type;
        addBattleLog((entity.id||entity.name||"ç›®æ¨™")+"çš„"+name+"æ•ˆæžœå·²è§£é™¤ã€‚");
    }
}
function beginBattleDurationAction(event){
    const entry=event&&event.queue&&event.queue[event.index];
    const entity=battleDurationEntityForEntry(entry);
    if(!entity||battleDurationNumber(entity.hp)<=0){ battleDurationAction=null; return; }
    const snapshot=snapshotBattleActionDuration(entity);
    battleDurationAction={
        token:event.token,index:event.index,entry:entry,entity:entity,
        buffs:snapshot.buffs,statuses:snapshot.statuses
    };
}
function finishBattleDurationAction(){
    /* Action Finish is notification only. Round-End is the sole consumer. */
    battleDurationAction=null;
    if(typeof v143SyncStatusVisualEffects==="function"){
        v143SyncStatusVisualEffects(false);
    }
}
if(typeof window!=="undefined"){
    window.v175DurationLifecycleActive=true;
    window.FourSymbolsDurationLifecycle=Object.freeze({
        beginAction:beginBattleDurationAction,
        finishAction:finishBattleDurationAction,
        snapshotFor:entity=>snapshotBattleActionDuration(entity),
        registerBuffExpiryHandler(handler){
            if(typeof handler!=="function"){ return function(){}; }
            battleDurationBuffExpiryHandlers.add(handler);
            return function(){ battleDurationBuffExpiryHandlers.delete(handler); };
        }
    });
}

if(typeof window!=="undefined"){
    window.FourSymbolsBattleFlow=Object.freeze({
        subscribeActionFinished(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleActionFinishObservers.add(observer);
            return function(){ battleActionFinishObservers.delete(observer); };
        },
        subscribeBeforeCombatant(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleBeforeCombatantObservers.add(observer);
            return function(){ battleBeforeCombatantObservers.delete(observer); };
        },
        subscribeRoundStart(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleRoundStartObservers.add(observer);
            return function(){ battleRoundStartObservers.delete(observer); };
        },
        subscribeRoundEnd(observer){
            if(typeof observer!=="function"){ return function(){}; }
            battleRoundEndObservers.add(observer);
            return function(){ battleRoundEndObservers.delete(observer); };
        },
        acquirePresentationLock(owner){
            const lock={owner:String(owner||"battle-presentation")};
            battlePresentationLocks.add(lock);
            if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
            let active=true;
            return function(){
                if(!active){ return; }
                active=false;
                battlePresentationLocks.delete(lock);
                if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
                if(battlePresentationLocks.size===0){
                    resumeBattleAfterPresentationLocks();
                }
            };
        },
        isPresentationActive(){ return battlePresentationLocks.size>0; },
        acquirePauseLock(owner){
            return window.FourSymbolsBattleFlow.acquirePresentationLock("pause:"+String(owner||"battle-flow"));
        },
        isPaused(){ return battlePresentationLocks.size>0; },
        isAutoBattle(){ return !!autoBattle; },
        isBattleActive(){ return !!battleActive; },
        interceptActionFinish(interceptor){
            if(typeof interceptor!=="function"){ return function(){}; }
            battleActionFinishInterceptors.push(interceptor);
            let active=true;
            return function(){
                if(!active){ return; }
                active=false;
                const index=battleActionFinishInterceptors.lastIndexOf(interceptor);
                if(index>=0){ battleActionFinishInterceptors.splice(index,1); }
            };
        }
    });
}

function resumeBattleAfterPresentationLocks(){
    if(battlePresentationLocks.size>0||!battleActive){ return; }

    if(
        battleAutoActionResume&&
        battleAutoActionResume.token===battleToken&&
        battlePhase==="declare"
    ){
        const pending=battleAutoActionResume;
        battleAutoActionResume=null;
        autoActionForCharacter(pending.characterIndex,pending.token);
        return;
    }

    if(
        battleInputResumeToken!==null&&
        battlePhase==="declare"&&
        battleInputResumeToken===battleToken
    ){
        const resumeToken=battleInputResumeToken;
        battleInputResumeToken=null;
        beginCharacterTurn(resumeToken);
        return;
    }

    if(
        battleResolutionResumeToken!==null&&
        battlePhase==="resolve"&&
        battleResolutionResumeToken===battleToken
    ){
        const resumeToken=battleResolutionResumeToken;
        battleResolutionResumeToken=null;
        processNextCombatant(resumeToken);
    }
}

function clearBattleRoundPrompt(){
    if(battleRoundPromptTimeoutId){
        clearTimeout(battleRoundPromptTimeoutId);
        battleRoundPromptTimeoutId=null;
    }
    const prompt=typeof document!=="undefined"
        ?document.getElementById("battleRoundPrompt")
        :null;
    if(prompt){ prompt.hidden=true; }
    if(battleRoundPromptRelease){
        const release=battleRoundPromptRelease;
        battleRoundPromptRelease=null;
        release();
    }
}

function clearBattleActionNotice(){
    if(battleActionNoticeTimeoutId){
        clearTimeout(battleActionNoticeTimeoutId);
        battleActionNoticeTimeoutId=null;
    }
    const notice=typeof document!=="undefined"
        ?document.getElementById("battleActionNotice")
        :null;
    if(notice){
        notice.hidden=true;
        notice.classList.remove("show");
    }
}

function showBattleActionNotice(message){
    const page=typeof document!=="undefined"
        ?document.getElementById("battlePage")
        :null;
    if(!page){ return false; }

    clearBattleActionNotice();
    let notice=document.getElementById("battleActionNotice");
    if(!notice){
        notice=document.createElement("div");
        notice.id="battleActionNotice";
        notice.className="battle-round-prompt battle-action-notice";
        notice.setAttribute("role","status");
        notice.setAttribute("aria-live","polite");
        page.appendChild(notice);
    }
    notice.textContent=String(message||"");
    notice.hidden=false;
    notice.classList.add("show");
    battleActionNoticeTimeoutId=setTimeout(clearBattleActionNotice,1800);
    return true;
}

function showAutoBattleRoundPrompt(token){
    clearBattleRoundPrompt();
    if(!battleActive||token!==battleToken||!autoBattle){ return false; }

    const page=typeof document!=="undefined"?document.getElementById("battlePage"):null;
    if(!page){ return false; }

    let prompt=document.getElementById("battleRoundPrompt");
    if(!prompt){
        prompt=document.createElement("div");
        prompt.id="battleRoundPrompt";
        prompt.className="battle-round-prompt";
        prompt.setAttribute("role","status");
        prompt.setAttribute("aria-live","polite");
        page.appendChild(prompt);
    }

    prompt.textContent="ç¬¬ "+Math.max(1,Math.floor(Number(turn)||1))+" å›žåˆ";
    prompt.hidden=false;

    const flow=window.FourSymbolsBattleFlow;
    battleRoundPromptRelease=flow&&typeof flow.acquirePresentationLock==="function"
        ?flow.acquirePresentationLock("auto-round-prompt")
        :null;

    battleRoundPromptTimeoutId=setTimeout(()=>{
        battleRoundPromptTimeoutId=null;
        if(prompt){ prompt.hidden=true; }
        const release=battleRoundPromptRelease;
        battleRoundPromptRelease=null;
        if(release){ release(); }
    },500);
    return true;
}

function getBattleStatisticsOwner(){
    return typeof window!=="undefined"&&window.FourSymbolsBattleStatistics
        ?window.FourSymbolsBattleStatistics
        :null;
}

function getBattleStatisticsCombatantKind(character){
    const kind=character&&String(character.combatantKind||character.unitKind||"");
    if(kind==="heroNpc"||kind==="reinforcement"){ return kind; }
    return "playerCharacter";
}

function buildBattleStatisticsCombatant(characterIndex){
    const character=getPartyCharacterByIndex(characterIndex);
    if(!character){ return null; }
    const kind=getBattleStatisticsCombatantKind(character);
    const identity=String(character.id||("è§’è‰²"+(characterIndex+1)));
    return {
        id:kind+":"+characterIndex+":"+identity,
        kind:kind,
        side:"ally",
        battleIndex:characterIndex,
        name:identity,
        portrait:typeof getCharacterBattleArtworkPath==="function"
            ?getCharacterBattleArtworkPath(character)
            :""
    };
}

function beginBattleStatisticsSession(){
    activeBattleStatisticsAction=null;
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.begin!=="function"){ return false; }
    const combatants=getExistingPartyIndexes()
        .map(buildBattleStatisticsCombatant)
        .filter(Boolean);
    owner.begin({battleToken:battleToken,combatants:combatants});
    return true;
}

function finishBattleStatisticsSession(result){
    battleStatisticsFinishAction();
    const owner=getBattleStatisticsOwner();
    if(owner&&typeof owner.finish==="function"){
        owner.finish({result:String(result||"")});
    }
    closeBattleStatusDetailModal();
    setBattleInfoExpanded(false);
    syncBattleUiPriorityLayer();
    activeBattleStatisticsAction=null;
}

function battleStatisticsBeginAction(entry){
    const owner=getBattleStatisticsOwner();
    if(!owner||!entry){ activeBattleStatisticsAction=null;return; }

    const sourceId=entry.type==="player"&&typeof owner.getCombatantIdByBattleIndex==="function"
        ?owner.getCombatantIdByBattleIndex(entry.characterIndex)
        :null;
    const partyHp={};
    getExistingPartyIndexes().forEach(index=>{
        const character=getPartyCharacterByIndex(index);
        if(character){ partyHp[index]=Math.max(0,Number(character.hp)||0); }
    });
    const enemyHp={};
    currentBattleMonsters.forEach(index=>{
        const monster=monsters[index];
        if(monster){ enemyHp[index]=Math.max(0,Number(monster.hp)||0); }
    });
    activeBattleStatisticsAction={sourceId:sourceId,partyHp:partyHp,enemyHp:enemyHp};
}

function battleStatisticsFinishAction(){
    const action=activeBattleStatisticsAction;
    activeBattleStatisticsAction=null;
    const owner=getBattleStatisticsOwner();
    if(!action||!owner){ return; }

    Object.keys(action.partyHp).forEach(key=>{
        const index=Number(key);
        const character=getPartyCharacterByIndex(index);
        if(!character){ return; }
        const before=action.partyHp[key];
        const after=Math.max(0,Number(character.hp)||0);
        const targetId=typeof owner.getCombatantIdByBattleIndex==="function"
            ?owner.getCombatantIdByBattleIndex(index)
            :null;
        if(after<before&&targetId&&typeof owner.recordDamage==="function"){
            owner.recordDamage({targetId:targetId,amount:before-after});
        }else if(after>before&&action.sourceId&&typeof owner.recordHealing==="function"){
            owner.recordHealing({sourceId:action.sourceId,targetId:targetId,amount:after-before});
        }
    });

    if(action.sourceId&&typeof owner.recordDamage==="function"){
        Object.keys(action.enemyHp).forEach(key=>{
            const monster=monsters[Number(key)];
            if(!monster){ return; }
            const before=action.enemyHp[key];
            const after=Math.max(0,Number(monster.hp)||0);
            if(after<before){
                owner.recordDamage({sourceId:action.sourceId,amount:before-after});
            }
        });
    }
}

function battleStatisticsRecordCriticalByActor(character){
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.recordCritical!=="function"){ return; }
    const index=typeof getPartyCharacterIndex==="function"?getPartyCharacterIndex(character):-1;
    if(index<0||typeof owner.getCombatantIdByBattleIndex!=="function"){ return; }
    const id=owner.getCombatantIdByBattleIndex(index);
    if(id){ owner.recordCritical({id:id}); }
}

function battleStatisticsRecordDamageTakenByIndex(characterIndex,value){
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.recordDamage!=="function"||typeof owner.getCombatantIdByBattleIndex!=="function"){ return; }
    const id=owner.getCombatantIdByBattleIndex(characterIndex);
    const actual=Math.max(0,Number(value)||0);
    if(id&&actual>0){ owner.recordDamage({targetId:id,amount:actual}); }
}

function battleStatisticsRecordDamageDealtByIndex(characterIndex,value){
    const owner=getBattleStatisticsOwner();
    if(!owner||typeof owner.recordDamage!=="function"||typeof owner.getCombatantIdByBattleIndex!=="function"){ return; }
    const id=owner.getCombatantIdByBattleIndex(characterIndex);
    const actual=Math.max(0,Number(value)||0);
    if(id&&actual>0){ owner.recordDamage({sourceId:id,amount:actual}); }
}

function battleStatisticsRecordDamageDealtByActor(character,value){
    const index=typeof getPartyCharacterIndex==="function"?getPartyCharacterIndex(character):-1;
    if(index>=0){ battleStatisticsRecordDamageDealtByIndex(index,value); }
}

function notifyBattleActionFinished(){
    battleActionFinishObservers.forEach(observer=>{
        try{ observer(); }
        catch(error){ console.error("æˆ°é¬¥è¡Œå‹•å®Œæˆè§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
    });
}
function interceptBattleActionFinish(){
    for(let index=battleActionFinishInterceptors.length-1;index>=0;index--){
        try{
            if(battleActionFinishInterceptors[index]()===true){ return true; }
        }catch(error){
            console.error("æˆ°é¬¥è¡Œå‹•å®Œæˆæ””æˆªå™¨å¤±æ•—ï¼š",error);
        }
    }
    return false;
}
function notifyBeforeCombatant(token){
    const event={token:token,turn:turn,index:initiativeIndex,queue:initiativeQueue};
    beginBattleDurationAction(event);
    battleBeforeCombatantObservers.forEach(observer=>{
        try{ observer(event); }
        catch(error){ console.error("æˆ°é¬¥ä½‡åˆ—è§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
    });
}
function notifyBattleRoundBoundary(type,token){
    const roundNumber=Math.max(1,Math.floor(Number(turn)||1));
    const key=String(token)+":"+type+":"+String(roundNumber);
    if(battleRoundBoundaryKeys.has(key)){ return false; }
    battleRoundBoundaryKeys.add(key);
    const observers=type==="round_start"?battleRoundStartObservers:battleRoundEndObservers;
    observers.forEach(observer=>{
        try{ observer({token:token,turn:roundNumber,type:type}); }
        catch(error){ console.error("æˆ°é¬¥å›žåˆé‚Šç•Œè§€å¯Ÿå™¨å¤±æ•—ï¼š",error); }
    });
    if(type==="round_end"){ consumeRoundEndDurations(); }
    return true;
}
function getBattleAdvanceDelay(phase){
    if(phase==="declare"){
        /* A previous VFX must never delay the last declared action. */
        return MANUAL_RESOLUTION_START_MS;
    }
    const visualRemaining=typeof window!=="undefined"&&typeof window.v142GetRemainingAnimationMs==="function"
        ?Number(window.v142GetRemainingAnimationMs())||0:0;
    /* V142/V143 only report whether the current visual gate remains active.
       This queue owner waits for that gate, then schedules exactly one formal
       post-action beat before the next combatant. */
    return Math.max(0,visualRemaining)+POST_ACTION_DELAY_MS;
}
const BATTLE_ACTION_WATCHDOG_MS=7000;
let battleActionWatchdogTimeoutId=null;

function clearBattleActionWatchdog(){
    if(!battleActionWatchdogTimeoutId){ return; }
    clearTimeout(battleActionWatchdogTimeoutId);
    battleActionWatchdogTimeoutId=null;
}

function armBattleActionWatchdog(token,index){
    clearBattleActionWatchdog();
    battleActionWatchdogTimeoutId=setTimeout(()=>{
        battleActionWatchdogTimeoutId=null;
        if(!battleActive||token!==battleToken||index!==initiativeIndex||battleAdvanceScheduled){ return; }
        console.error("æˆ°é¬¥è¡Œå‹•è¶…éŽå®‰å…¨æœŸé™ï¼Œå·²é‡‹æ”¾æµç¨‹é–˜é–€ã€‚",{token:token,initiativeIndex:index});
        addBattleLog("æœ¬æ¬¡è¡Œå‹•æœªæ­£å¸¸å›žæ”¶ï¼Œå·²ç”±å®‰å…¨é–˜é–€å¼·åˆ¶ç¹¼çºŒã€‚");
        const director=typeof window!=="undefined"?window.v142SkillAnimationDirector:null;
        const gate=director&&typeof director.getActive==="function"?director.getActive():null;
        if(gate&&!gate.done&&typeof gate.complete==="function"){ gate.complete("combat-action-watchdog"); }
        finishPlayerAction();
    },BATTLE_ACTION_WATCHDOG_MS);
}

let monsterMoveId=null;

let respawnId=null;

/*
   â˜… æ–°å¢žï¼šç›®å‰è¼ªåˆ°èª°æ‰‹å‹•è¡Œå‹•
   ï¼ˆ0=ç¬¬ä¸€è§’è‰²ã€1=ç¬¬äºŒè§’è‰²ï¼‰ã€‚
   æ¯æ¬¡startTurn()é‡ç½®å›ž0ï¼Œ
   finishPlayerAction()çµæŸä¸€å€‹è§’è‰²çš„è¡Œå‹•å¾Œ
   å¾€å¾ŒæŽ¨ä¸€æ ¼ï¼Œç›´åˆ°æ´»è‘—çš„è§’è‰²éƒ½è¡Œå‹•éŽï¼Œ
   æ‰æœƒé€²å…¥æ€ªç‰©å›žåˆã€‚
*/

let activeBattleCharacterIndex=0;

/*
   â˜… æ–°å¢žï¼ˆçœŸæ­£æŠ“åˆ°ã€Œå®£å‘ŠéšŽæ®µè¢«é‡è¤‡è™•ç†ã€
   çš„æ ¹æºä¹‹å¾Œè£œä¸Šçš„é˜²è­·ï¼‰ï¼š

   æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚ï¼ŒsetTimeoutä¸ä¿è­‰
   æº–æ™‚è§¸ç™¼ï¼Œå¯èƒ½è¢«ç³»çµ±å»¶å¾Œã€ä¹‹å¾Œåˆè·Ÿå…¶ä»–
   è¨ˆæ™‚å™¨ã€Œä¸€æ¬¡è£œç™¼ã€ï¼Œå°Žè‡´beginCharacterTurn()
   è¢«åŒä¸€å€‹activeBattleCharacterIndexå€¼
   å‘¼å«å…©æ¬¡â€”â€”é€™ä¸æ˜¯ç¨‹å¼é‚è¼¯å¯«éŒ¯ï¼Œæ˜¯è¨ˆæ™‚å™¨
   æœ¬èº«ä¸å¯é ï¼Œå…‰é battleToken/tokenæ¯”å°
   æ“‹ä¸ä½ï¼ˆåŒä¸€å ´æˆ°é¬¥ã€tokenæ²’è®Šï¼Œåªæ˜¯
   åŒä¸€å€‹å®£å‘Šæ­¥é©Ÿè¢«è§¸ç™¼äº†å…©æ¬¡ï¼‰ã€‚

   ç”¨é€™å€‹Setè¨˜éŒ„ã€Œé€™å€‹å¤§å›žåˆè£¡ï¼Œå“ªäº›
   activeBattleCharacterIndexå·²ç¶“çœŸæ­£
   å®£å‘ŠéŽã€ï¼ŒbeginCharacterTurn()ä¸€é–‹å§‹
   å¦‚æžœç™¼ç¾ç•¶ä¸‹é€™å€‹ç´¢å¼•å·²ç¶“åœ¨æ¸…å–®è£¡ï¼Œ
   ä»£è¡¨æ˜¯é‡è¤‡/å»¶é²è£œç™¼çš„å‘¼å«ï¼Œç›´æŽ¥è·³éŽã€
   ä¸åšä»»ä½•äº‹ï¼Œä¸æœƒè®“è§’è‰²ç´¢å¼•è¢«å¤šæŽ¨é€²ã€
   ä¸æœƒè®“è‡ªå‹•åˆ¤æ–·å‡½å¼è¢«é‡è¤‡å‘¼å«ã€‚
   æ¯æ¬¡startTurn()é–‹æ–°çš„å¤§å›žåˆæ™‚æ¸…ç©ºã€‚
*/

let declaredCharacterIndexes=
    new Set();

/*
   â˜… æ–°å¢žï¼ˆçœŸæ­£è£œä¸Šå‰©ä¸‹é‚£å€‹æ¼æ´žï¼‰ï¼š
   declaredCharacterIndexesåªæ“‹å¾—ä½
   ã€ŒåŒä¸€å€‹è§’è‰²è¢«é‡è¤‡å®£å‘Šã€ï¼Œæ²’æ“‹åˆ°
   ã€Œå®£å‘ŠéšŽæ®µçµæŸã€è¦è·³é€²çµç®—éšŽæ®µã€é€™å€‹
   è½‰æ›é»žæœ¬èº«è¢«é‡è¤‡è§¸ç™¼â€”â€”beginCharacterTurn()
   åœ¨activeBattleCharacterIndexè¶…å‡ºéšŠä¼
   é•·åº¦æ™‚æœƒå‘¼å«startResolutionPhase()ï¼Œ
   ä½†é€™å€‹è½‰æ›æ²’æœ‰è¢«è¨˜éŒ„é€²é˜²é‡è¤‡æ¸…å–®ï¼Œ
   åªè¦é€™æ¬¡å‘¼å«å› ç‚ºæ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/
   è£œç™¼è¢«å¤šè§¸ç™¼ä¸€æ¬¡ï¼Œå°±æœƒæŠŠinitiativeQueueã€
   initiativeIndexã€processedInitiativeIndexes
   å…¨éƒ¨é‡æ–°è“‹éŽåŽ»ã€ç æŽ‰é‡ç·´ï¼Œç­‰æ–¼çµç®—éšŽæ®µ
   å¾žé ­é‡æ–°é–‹å§‹ä¸€æ¬¡ï¼Œå·²ç¶“è™•ç†éŽçš„æ€ªç‰©/è§’è‰²
   è¡Œå‹•æœƒè¢«é‡è¤‡åŸ·è¡Œâ€”â€”é€™æ­£æ˜¯ã€ŒåŒä¸€éš»æ€ªç‰©
   ä¸€å€‹å›žåˆæ”»æ“Šå…©æ¬¡ã€ã€Œé€£çºŒè·³å…©å€‹å›žåˆã€
   çš„çœŸæ­£åŽŸå› ã€‚

   ç”¨é€™å€‹æ——æ¨™è¨˜éŒ„ã€Œé€™å€‹å¤§å›žåˆçš„çµç®—éšŽæ®µ
   æ˜¯ä¸æ˜¯å·²ç¶“çœŸçš„é–‹å§‹éŽäº†ã€ï¼Œ
   startResolutionPhase()ä¸€é–‹å§‹å¦‚æžœç™¼ç¾
   å·²ç¶“é–‹å§‹éŽï¼Œä»£è¡¨æ˜¯é‡è¤‡/å»¶é²è£œç™¼çš„å‘¼å«ï¼Œ
   ç›´æŽ¥è·³éŽã€ä¸æœƒé‡å»ºä½‡åˆ—ã€‚
   æ¯æ¬¡startTurn()é–‹æ–°çš„å¤§å›žåˆæ™‚é‡ç½®ç‚ºfalseã€‚
*/

let resolutionPhaseStarted=
    false;

/*
   â˜… æ–°å¢žï¼ˆçœŸæ­£è£œä¸Šæœ€å¾Œä¸€å€‹æ¼æ´žï¼‰ï¼š
   è·ŸresolutionPhaseStartedåŒæ¨£çš„é“ç†ï¼Œ
   processNextCombatant()è£¡ã€Œé€™å€‹å¤§å›žåˆ
   çµç®—å®Œç•¢ã€è¦è·³åˆ°ä¸‹ä¸€å€‹å¤§å›žåˆã€çš„åˆ†æ”¯
   ï¼ˆinitiativeIndex>=initiativeQueue.length
   æ™‚turn++; startTurn(token)ï¼‰å®Œå…¨æ²’æœ‰
   é˜²é‡è¤‡ä¿è­·â€”â€”é€™å€‹åˆ†æ”¯æœ¬èº«ä¸å±¬æ–¼ä»»ä½•
   ä¸€å€‹ã€Œå·²è™•ç†çš„initiativeIndexã€ï¼Œ
   processedInitiativeIndexesé‚£å€‹Set
   æ“‹ä¸åˆ°å®ƒã€‚åªè¦é€™æ¬¡å‘¼å«å› ç‚ºæ‰‹æ©Ÿç€è¦½å™¨
   è¨ˆæ™‚å™¨å»¶é²/è£œç™¼è¢«å¤šè§¸ç™¼ä¸€æ¬¡ï¼Œå°±æœƒ
   turn++å…©æ¬¡ã€startTurn()è¢«å‘¼å«å…©æ¬¡ï¼Œ
   ç•«é¢ä¸Šæœƒçœ‹åˆ°ã€Œç¬¬8å›žåˆï¼Œé–‹å§‹ï¼
   ç¬¬9å›žåˆï¼Œé–‹å§‹ï¼ã€é€™ç¨®é€£çºŒè·³å…©è¼ªã€
   ä¸­é–“å®Œå…¨æ²’æœ‰ä»»ä½•è§’è‰²/æ€ªç‰©è¡Œå‹•çš„æƒ…æ³ã€‚

   ç”¨é€™å€‹æ——æ¨™è¨˜éŒ„ã€Œé€™å€‹å¤§å›žåˆæ˜¯ä¸æ˜¯å·²ç¶“
   çœŸçš„è§¸ç™¼éŽã€Žè·³åˆ°ä¸‹ä¸€è¼ªã€ã€ï¼Œé‡è¤‡å‘¼å«
   ç›´æŽ¥æ“‹ä¸‹ã€‚æ¯æ¬¡startTurn()çœŸæ­£é–‹å§‹
   æ–°çš„ä¸€è¼ªæ™‚é‡ç½®ç‚ºfalseã€‚
*/

let turnAdvancePending=
    false;

/*
   â˜… æ–°å¢žï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
   ä½¿ç”¨è€…æ˜Žç¢ºæŒ‡å‡ºï¼šæ­£ç¢ºçš„å›žåˆåˆ¶æ‡‰è©²æ˜¯
   ã€Œé›™æ–¹å…ˆå„è‡ªè¨­å®šå¥½é€™å›žåˆè¦åšä»€éº¼ï¼Œ
   å…¨éƒ¨è¨­å®šå®Œï¼Œæ‰ä¾æ•æ·é«˜ä½Žé–‹å§‹åŸ·è¡Œã€ï¼Œ
   ä¸æ˜¯ã€Œèª°å¿«èª°å…ˆåšï¼Œå…¶ä»–äººé€£é¸éƒ½é‚„æ²’é¸ã€ã€‚

   battlePhaseç´€éŒ„ç›®å‰é€™å€‹å¤§å›žåˆèµ°åˆ°å“ªå€‹éšŽæ®µï¼š
   "declare" = å®£å‘ŠéšŽæ®µï¼ŒçŽ©å®¶è§’è‰²ä¾åºé¸å¥½
   é€™å›žåˆè¦åšä»€éº¼ï¼ˆæ™®é€šæ”»æ“Š/æŠ€èƒ½ï¼Œå«é¸ç›®æ¨™ï¼‰ï¼Œ
   é¸å®Œå…ˆã€Œè¨˜ä½ã€ï¼Œä¸æœƒé¦¬ä¸Šå‡ºæ‰‹ã€‚

   "resolve" = çµç®—éšŽæ®µï¼ŒæŠŠæ‰€æœ‰å·²å®£å‘Šçš„çŽ©å®¶è¡Œå‹•
   è·Ÿæ€ªç‰©æ··åœ¨ä¸€èµ·ï¼Œä¾æ•æ·é«˜ä½ŽæŽ’åºï¼Œ
   ä¸€å€‹ä¸€å€‹çœŸæ­£åŸ·è¡Œã€æ‰£è¡€ã€‚

   åªæœ‰ã€Œæ™®é€šæ”»æ“Šã€ã€Œå‚·å®³æŠ€èƒ½ã€é€™ç¨®æœƒå½±éŸ¿åˆ°æ€ªç‰©ã€
   è·Ÿæ€ªç‰©å‡ºæ‰‹é †åºæœ‰æ„ç¾©é—œè¯çš„è¡Œå‹•éœ€è¦é€²åˆ°å®£å‘Š/çµç®—
   å…©éšŽæ®µï¼›é˜²ç¦¦ã€ç‰©å“ã€å¢žç›Šã€æ²»ç™‚é€™é¡žä¸ç‰½æ¶‰
   è·Ÿæ€ªç‰©æ¯”å¿«æ…¢çš„è¡Œå‹•ï¼Œç¶­æŒåŽŸæœ¬ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
   ä¸éœ€è¦é¡å¤–ç­‰å¾…ï¼Œé€™æ¨£æ‰ä¸æœƒè®“é˜²ç¦¦é€™ç¨®
   ã€Œé¦¬ä¸Šå°±è¦ç”Ÿæ•ˆã€çš„å‹•ä½œä¹Ÿè¢«è¿«å»¶é²ã€‚
*/

let battlePhase="declare";

let queuedPlayerActions={};

let mapCooldown=false;

/*
   â˜… è‡ªå‹•å·¡æ€ªé˜²å¡æ­»ï¼š
   mapCooldown åªä»£è¡¨ã€Œæš«æ™‚ç¦æ­¢é–‹æˆ°ã€ï¼Œ
   ä¸æ‡‰è©²ç›´æŽ¥ç­‰åŒæ–¼ã€Œåœæ­¢è‡ªå‹•å·¡æ€ªã€ã€‚
   å¦å¤–ä¿ç•™ timeout handleï¼Œè®“æˆ‘å€‘å¯ä»¥åˆ¤æ–·
   cooldown æ˜¯å¦çœŸçš„æœ‰ä¸€å€‹è§£é™¤æŽ’ç¨‹ã€‚
*/
let mapCooldownTimeoutId=null;

let autoBattle=false;

let actionReady=false;

let pendingAction=null;

/*
   â˜… æ–°å¢žï¼ˆä¿®æ­£è¨­å®šé¢æ¿åˆ‡æ›è§’è‰²æœƒéºå¤±æœªå„²å­˜è®Šæ›´çš„bugï¼‰ï¼š
   è¨˜éŒ„è¨­å®šé¢æ¿ç›®å‰é¡¯ç¤ºçš„æ˜¯ã€Œå“ªå€‹è§’è‰²ã€çš„è³‡æ–™ï¼Œ
   æ¯æ¬¡åˆ‡æ›è§’è‰²ä¹‹å‰ï¼Œå…ˆæŠŠç›®å‰ç•«é¢ä¸Šçš„å€¼
   å­˜å›žé€™å€‹è§’è‰²èº«ä¸Šï¼Œå†æ›é¡¯ç¤ºæ–°è§’è‰²çš„è³‡æ–™ï¼Œ
   é€™æ¨£ä½¿ç”¨è€…å¯ä»¥è‡ªç”±åˆ‡æ›Aã€Bå…©å€‹è§’è‰²èª¿æ•´ï¼Œ
   æœ€å¾Œçµ±ä¸€æŒ‰ä¸€æ¬¡ç¢ºå®šå°±å¥½ï¼Œä¸ç”¨æ¯æ›ä¸€å€‹è§’è‰²
   å°±è¦å…ˆæŒ‰ä¸€æ¬¡ç¢ºå®šï¼Œä¸ç„¶åˆ‡æ›é‚£ä¸€åˆ»
   é‚„æ²’å„²å­˜çš„èª¿æ•´æœƒç›´æŽ¥æ¶ˆå¤±ã€‚
*/

let autoSettingsCurrentCharacter=0;


const autoConfig = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    /*
       â˜… æ–°å¢žï¼šæ²’è—¥æ°´çš„è©±è‡ªå‹•å›žä¸»åŸŽã€‚
       æˆ°é¬¥çµæŸã€å›žåˆ°ç·´åŠŸå€åœ°åœ–ä¹‹å¾Œï¼Œ
       å¦‚æžœåµæ¸¬åˆ°HP/SPè—¥æ°´éƒ½ç”¨å®Œäº†ï¼Œ
       è‡ªå‹•å¹«çŽ©å®¶å°Žå›žä¸»åŸŽï¼Œ
       ä¸ç”¨è‡ªå·±è¨˜å¾—è¦å›žåŽ»è£œè²¨ã€‚
    */

    returnToCityWhenEmpty:false

};


/*
   â˜… æ–°å¢žï¼šç¬¬äºŒè§’è‰²å°ˆå±¬çš„è‡ªå‹•æˆ°é¬¥è¨­å®šã€‚
   è·Ÿç¬¬ä¸€è§’è‰²çš„autoConfigçµæ§‹ä¸€æ¨£ï¼Œ
   ä½†å®Œå…¨ç¨ç«‹ï¼Œå› ç‚ºç¬¬äºŒè§’è‰²æ˜¯è‡ªå‹•ä½œæˆ°çš„éšŠå‹ï¼Œ
   ä¸€å®šè¦æœ‰è‡ªå·±çš„æŠ€èƒ½/HPé–€æª»/SPé–€æª»è¨­å®šï¼Œ
   ä¸èƒ½å…±ç”¨ç¬¬ä¸€è§’è‰²é‚£çµ„ï¼ˆæŠ€èƒ½éƒ½ä¸ä¸€æ¨£ï¼‰ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼š
   ä¹‹å‰ç¬¬äºŒè§’è‰²æ°¸é è‡ªå‹•è¡Œå‹•ï¼Œæ²’æœ‰æ‰‹å‹•é¸é …ï¼Œ
   æ‰€ä»¥é€™è£¡åŽŸæœ¬æ²’æœ‰enabledæ¬„ä½ã€‚
   ç¾åœ¨ç¬¬äºŒè§’è‰²ä¹Ÿèƒ½æ‰‹å‹•æ“ä½œäº†ï¼Œ
   é è¨­enabled:falseï¼ˆæ‰‹å‹•ï¼‰ï¼Œ
   è·Ÿç¬¬ä¸€è§’è‰²çš„é è¨­è¡Œç‚ºä¸€è‡´ï¼Œ
   çŽ©å®¶å¯ä»¥è‡ªå·±é¸è¦æ‰‹å‹•æŽ§åˆ¶é‚„æ˜¯äº¤çµ¦AIæ‰“ã€‚
*/

const autoConfig2 = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    returnToCityWhenEmpty:false

};


/* ç¬¬ä¸‰è§’è‰²ä½¿ç”¨ç¨ç«‹çš„è‡ªå‹•æˆ°é¬¥ï¼æˆ°å¾Œè£œçµ¦è¨­å®šã€‚ */
const autoConfig3 = {

    enabled:false,

    skill:"normal",

    hp:50,

    sp:25,

    returnToCityWhenEmpty:false

};

/* The only Phase 4 local restore owner: explicit, same-UID preferences only.
 * Never hydrate a partial cloud record as a full gameplay save. */
function restoreAutoBattlePreferences(uid,preferences){
    const repository=window.FourSymbolsAccountSave;
    if(!repository||!uid||repository.getActiveUid()!==uid||SAVE_KEY!==repository.saveKey(uid)){
        throw new Error("Cloud preferences cannot be applied to a different UID.");
    }
    const local=repository.readForUid(uid);
    if(local.status!=="ready"||!local.save?.player?.id||player.id!==local.save.player.id){
        throw new Error("A verified local character is required to restore preferences.");
    }
    const keys=["autoConfig","autoConfig2","autoConfig3"];
    const fields=["enabled","skill","hp","sp","returnToCityWhenEmpty"];
    if(!preferences||typeof preferences!=="object"||Array.isArray(preferences)||
       Object.keys(preferences).length!==keys.length+1||Object.keys(preferences).some(key=>key!=="characterIds"&&!keys.includes(key))||
       !Array.isArray(preferences.characterIds)||preferences.characterIds.length!==3||
       [local.save.player,local.save.player2,local.save.player3].some((character,index)=>
           (character?.id||null)!==preferences.characterIds[index])){
        throw new Error("Cloud preferences contain unsupported fields.");
    }
    const snapshot={};
    for(const key of keys){
        const value=preferences[key];
        if(!value||typeof value!=="object"||Array.isArray(value)||
           Object.keys(value).length!==fields.length||Object.keys(value).some(field=>!fields.includes(field))||
           typeof value.enabled!=="boolean"||typeof value.returnToCityWhenEmpty!=="boolean"||
           typeof value.skill!=="string"||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value.skill)||
           !Number.isInteger(value.hp)||value.hp<0||value.hp>100||
           !Number.isInteger(value.sp)||value.sp<0||value.sp>100){
            throw new Error("Cloud preferences are invalid.");
        }
        snapshot[key]=Object.fromEntries(fields.map(field=>[field,value[field]]));
    }
    const targets={autoConfig,autoConfig2,autoConfig3};
    const previous=Object.fromEntries(keys.map(key=>[key,{...targets[key]}]));
    try{
        for(const key of keys){ Object.assign(targets[key],snapshot[key]); }
        if(saveGame({source:"cloud-preferences-restore"})!==true){
            throw new Error("Failed to save the restored preferences locally.");
        }
        return true;
    }catch(error){
        for(const key of keys){ Object.assign(targets[key],previous[key]); }
        throw error;
    }
}


/* V111ï¼šHPï¼SP è‡ªå‹•è£œçµ¦é–€æª»çµ±ä¸€ç‚º 25ï¼50ï¼75ï¼90ï¼100%ã€‚
   èˆŠå­˜æª”å¯èƒ½ä»ä¿å­˜ 20ã€30ã€40ã€60ã€70ã€80 ç­‰å€¼ï¼›
   è®€åˆ°èˆŠå€¼æ™‚å–æœ€æŽ¥è¿‘çš„æ–°é–€æª»ï¼Œé¿å…ä¸‹æ‹‰é¸å–®å‡ºç¾ç©ºç™½ã€‚ */
const AUTO_BATTLE_THRESHOLD_STEPS=[25,50,75,90,100];

function normalizeAutoBattleThreshold(value,fallback){

    const numeric=Number(value);

    if(!Number.isFinite(numeric)){
        return fallback;
    }

    return AUTO_BATTLE_THRESHOLD_STEPS.reduce(
        (best,current)=>
            Math.abs(current-numeric)<Math.abs(best-numeric)
            ? current
            : best,
        AUTO_BATTLE_THRESHOLD_STEPS[0]
    );
}


const pendingStats = {

    attack:0,

    vitality:0,

    energy:0,

    intelligence:0,

    defensePoints:0,

    agility:0

};


/*
   â˜… ç‹€æ…‹é è§’è‰²åˆ‡æ›ï¼ˆæ–°å¢žï¼‰ã€‚
   0=ç¬¬ä¸€è§’è‰²ï¼ˆplayerï¼‰ï¼Œ1=ç¬¬äºŒè§’è‰²ï¼ˆplayer2ï¼‰ã€‚
   player2ä¸å­˜åœ¨æ™‚æ°¸é åœåœ¨0ï¼Œ
   åˆ‡æ›æŒ‰éˆ•æœƒè¢«æ“‹æŽ‰ã€‚
*/

let statusCharacterIndex=0;


function getStatusCharacterObject(){

    if(statusCharacterIndex===2 && player3){
        return player3;
    }

    if(statusCharacterIndex===1 && player2){
        return player2;
    }

    return player;

}
let currentSkillCharacter =
    "fire";


let selectedInventorySlot =
    null;


/* =====================================================
   DOM
===================================================== */

function $(id){
    return document.getElementById(id);
}


/* =====================================================
   V130 â€” ä¸‰è§’è‰²å…±ç”¨ç´¢å¼•ï¼æˆ°é¬¥è³‡æ–™
===================================================== */

function getPartyCharacterByIndex(index){
    if(index===0){ return player; }
    if(index===1){ return player2; }
    if(index===2){ return player3; }
    return null;
}


function getPartyCharacterKey(index){
    if(index===0){ return "fire"; }
    if(index===1){ return "player2"; }
    if(index===2){ return "player3"; }
    return null;
}


function getPartyAutoConfig(index){
    if(index===1){ return autoConfig2; }
    if(index===2){ return autoConfig3; }
    return autoConfig;
}


function getPartyCharacterIndex(character){
    if(character===player){ return 0; }
    if(character===player2){ return 1; }
    if(character===player3){ return 2; }
    return -1;
}


function getExistingPartyIndexes(){
    return [0,1,2,3,4,5].filter(index=>!!getPartyCharacterByIndex(index));
}


function getCharacterArtworkPath(character){
    if(!character){ return ""; }

    const gender=character.gender==="male" ? "male" : "female";
    const element=elementDatabase[character.element]
        ? character.element
        : "fire";

    return "assets/characters/"+gender+"_"+element+".jpg";
}


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€ŒçŽ©å®¶æˆ°é¬¥ç«‹ç¹ªèƒ½å¦åŽ»èƒŒã€ï¼‰ï¼š
   è·ŸgetCharacterArtworkPath()å…±ç”¨åŒä¸€çµ„gender/element
   åˆ¤æ–·é‚è¼¯ï¼Œä½†å›žå‚³çš„æ˜¯å¦å¤–ç”¨rembgåŽ»èƒŒéŽçš„é€æ˜ŽPNG
   ï¼ˆassets/characters/battle_æ€§åˆ¥_å…ƒç´ .pngï¼‰ï¼Œåªçµ¦æˆ°é¬¥
   å¡ç‰‡ï¼ˆ.battle-playerçš„background-imageï¼‰é€™ä¸€å€‹ç”¨é€”
   ä½¿ç”¨ã€‚è§’è‰²å‰µå»ºé è¦½ã€èƒŒåŒ…ç«‹ç¹ªé é¢çš„å¤§åœ–ä»ç„¶å‘¼å«
   getCharacterArtworkPath()ã€ç¹¼çºŒé¡¯ç¤ºåŽŸæœ¬å¸¶å ´æ™¯èƒŒæ™¯çš„
   ç‰ˆæœ¬â€”â€”é€™å…©å€‹åœ°æ–¹çš„åœ–ç‰‡æœ¬ä¾†å°±æ˜¯åŒä¸€ä»½ç´ æå…±ç”¨ï¼Œ
   ç›´æŽ¥æŠŠä¾†æºæª”æ¡ˆæ•´å€‹æ›æˆåŽ»èƒŒç‰ˆæœƒé€£å¸¶å½±éŸ¿åˆ°é‚£äº›å…¶å¯¦
   ä½¿ç”¨è€…æ²’æœ‰è¦æ±‚æ”¹çš„ç•«é¢ï¼Œæ‰€ä»¥å¦å¤–é–‹ä¸€å€‹å‡½å¼ã€
   åªåœ¨æˆ°é¬¥å¡ç‰‡é‚£ä¸€è™•å‘¼å«ï¼Œå…¶é¤˜åœ°æ–¹å®Œå…¨ä¸å—å½±éŸ¿ã€‚
*/
function getCharacterBattleArtworkPath(character){
    if(!character){ return ""; }

    const gender=character.gender==="male" ? "male" : "female";
    const element=elementDatabase[character.element]
        ? character.element
        : "fire";

    return "assets/characters/battle_"+gender+"_"+element+".png";
}


function getCharacterDisplayNameByIndex(index){
    const character=getPartyCharacterByIndex(index);
    return character ? (character.id||("è§’è‰²"+(index+1))) : ("è§’è‰²"+(index+1));
}


/* =====================================================
   â˜… æŒ‰éˆ•æ³¢ç´‹æ“´æ•£æ•ˆæžœï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰
===================================================== */

/*
   å…¨åŸŸç›£è½æ•´å€‹æ–‡ä»¶çš„é»žæ“Š/è§¸ç¢°äº‹ä»¶ï¼Œåªè¦
   é»žåˆ°çš„ç›®æ¨™æ˜¯<button>ï¼ˆæˆ–æŒ‰éˆ•å…§éƒ¨çš„
   å­å…ƒç´ ï¼Œä¾‹å¦‚æŒ‰éˆ•è£¡çš„æ–‡å­—/åœ–ç¤ºï¼‰ï¼Œå°±åœ¨
   è§¸ç¢°åº§æ¨™çš„ä½ç½®å‹•æ…‹ç”Ÿæˆä¸€å€‹æœƒæ“´æ•£æ¶ˆå¤±çš„
   å°åœ“é»žï¼Œ0.5ç§’å¾Œè‡ªå‹•ç§»é™¤è‡ªå·±ï¼Œä¸æœƒç•™ä¸‹
   ä»»ä½•æ®˜ç•™çš„DOMåžƒåœ¾ã€‚

   ç”¨äº‹ä»¶ä»£ç†ï¼ˆç›£è½documentã€ä¸æ˜¯å€‹åˆ¥
   æŒ‰éˆ•ï¼‰çš„å¥½è™•ï¼šç¾åœ¨95å€‹æŒ‰éˆ•ã€ä»¥å¾Œä¸ç®¡
   å†æ–°å¢žå¹¾å€‹æŒ‰éˆ•ï¼Œå®Œå…¨ä¸ç”¨å¦å¤–å¯«ä¸€è¡Œ
   ç¨‹å¼ç¢¼ï¼Œå…¨éƒ¨è‡ªå‹•å¥—ç”¨åˆ°ï¼Œä¹Ÿä¸æœƒå› ç‚º
   ä¹‹å¾Œåˆå¿˜è¨˜åŠ è€Œæ¼æŽ‰ã€‚

   åŒæ™‚æ”¯æ´touchstartï¼ˆæ‰‹æ©Ÿè§¸æŽ§ï¼‰å’Œ
   mousedownï¼ˆæ»‘é¼ é»žæ“Šï¼Œæ–¹ä¾¿æ¡Œæ©Ÿç€è¦½å™¨
   æ¸¬è©¦ï¼‰ï¼Œè§¸æŽ§è£ç½®ä¸Šå…©å€‹äº‹ä»¶é€šå¸¸éƒ½æœƒ
   è§¸ç™¼ï¼Œé€™è£¡ç”¨æ——æ¨™é¿å…åŒä¸€æ¬¡é»žæ“Š
   é‡è¤‡ç”Ÿæˆå…©å€‹æ³¢ç´‹ã€‚
*/

let lastRippleTime=
    0;


function spawnButtonRipple(
    button,
    clientX,
    clientY
){

    // Item controls already receive the shared V141 pointer feedback.
    // The legacy per-button ripple uses browser pixels inside the projected
    // legacy stage and survives close/reopen, creating scrollable overflow.
    if(button.closest("#itemModal,#inventoryPage")||button.matches("#bottomNav [onclick*='inventory'],[onclick*='v148OpenContextInventory'],[onclick*='openMapInventoryOverlay']")){
        return;
    }

    const now=
        Date.now();


    if(now-lastRippleTime<80){
        return;
    }


    lastRippleTime=
        now;


    const rect=
        button.getBoundingClientRect();


    const size=

        Math.max(
            rect.width,
            rect.height
        )*
        1.4;


    const ripple=
        document.createElement("span");

    ripple.className=
        "btn-ripple";

    ripple.style.width=
        size+"px";

    ripple.style.height=
        size+"px";

    ripple.style.left=
        (clientX-rect.left-size/2)+
        "px";

    ripple.style.top=
        (clientY-rect.top-size/2)+
        "px";


    button.appendChild(
        ripple
    );


    setTimeout(()=>{

        ripple.remove();

    },520);

}


function handleGlobalButtonPress(event){

    const button=

        event.target.closest(
            "button"
        );


    if(!button){
        return;
    }


    const point=

        event.touches &&
        event.touches[0]
        ?
        event.touches[0]
        :
        event;


    spawnButtonRipple(
        button,
        point.clientX,
        point.clientY
    );

}


document.addEventListener(
    "touchstart",
    handleGlobalButtonPress,
    {passive:true}
);

document.addEventListener(
    "mousedown",
    handleGlobalButtonPress
);


/* =====================================================
   â˜… è‡ªè¨‚ä¸‹æ‹‰é¸å–®ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå–ä»£åŽŸç”Ÿ<select>ï¼‰
===================================================== */

/*
   registryï¼šè¨˜ä½æ¯ä¸€å€‹è¢«æŽ¥ç®¡çš„<select>ï¼Œ
   å°æ‡‰åˆ°å®ƒç”¢ç”Ÿå‡ºä¾†çš„é‚£çµ„å‡é¸å–®DOM
   ï¼ˆwrapper/label/listï¼‰ï¼Œ
   é—œé–‰å…¶ä»–é¸å–®ã€åŒæ­¥ç•«é¢æ™‚éƒ½è¦ç”¨åˆ°ã€‚
*/

const customDropdownRegistry={};


/*
   â˜… æ ¸å¿ƒæŠ€å·§ï¼šç”¨Object.defineProperty
   åœ¨é€™å€‹<select>ã€Œé€™ä¸€å€‹å¯¦é«”ã€ä¸Šè¦†è“‹æŽ‰
   valueé€™å€‹å±¬æ€§ï¼Œè®Šæˆæœ‰è‡ªå·±çš„get/setã€‚

   é€™æ¨£ä¸ç®¡ç¨‹å¼ç¢¼åœ¨å“ªè£¡ã€ç”¨ä»€éº¼æ–¹å¼å¯«
   select.value = "xxx"ï¼ˆç¾æœ‰å¹¾åè™•
   è®€å¯«é€™å¹¾å€‹selectçš„ç¨‹å¼ç¢¼å®Œå…¨ä¸ç”¨
   æ”¹ä¸€è¡Œï¼‰ï¼Œé€™è£¡éƒ½æ””å¾—åˆ°ï¼Œé †ä¾¿åŒæ­¥
   æ›´æ–°å‡é¸å–®çš„é¡¯ç¤ºæ–‡å­—/é¸ä¸­ç‹€æ…‹â€”â€”
   ä¸ç”¨ä¸€å€‹ä¸€å€‹åŽ»æ‰¾ç¨‹å¼ç¢¼è£¡åˆ°åº•å“ªè£¡
   å¯«äº†.value=ï¼Œé‚£æ¨£å¾ˆå®¹æ˜“æ¼æŽ‰ã€
   è€Œä¸”ä»¥å¾Œæ–°å¢žçš„ç¨‹å¼ç¢¼ä¹Ÿå¯èƒ½æ¼æŽ¥ã€‚

   çœŸæ­£çš„<option selected>ç‹€æ…‹ä¹Ÿæœƒ
   ä¸€èµ·åŒæ­¥æ›´æ–°ï¼Œä¿ç•™è·ŸåŽŸç”Ÿ<select>
   å®Œå…¨ä¸€è‡´çš„è¡Œç‚ºï¼Œåªæ˜¯å¤–è§€æ›æŽ‰ã€‚
*/

function makeSelectValueReactive(
    selectEl,
    onValueChanged
){

    let currentValue=
        String(selectEl.value);


    Object.defineProperty(
        selectEl,
        "value",
        {

            get(){
                return currentValue;
            },

            set(newValue){

                currentValue=
                    String(newValue);


                Array.from(
                    selectEl.options
                ).forEach(
                    opt=>{

                        opt.selected=
                            (
                                opt.value===
                                currentValue
                            );

                    }
                );


                onValueChanged(
                    currentValue
                );

            },

            configurable:true

        }

    );

}


/*
   æŠŠä¸€å€‹åŽŸç”Ÿ<select>ï¼ˆselectIdï¼‰æ›æˆ
   è‡ªè¨‚å‡é¸å–®ã€‚åŽŸæœ¬çš„<select>é‚„åœ¨DOMè£¡ã€
   ç¹¼çºŒç•¶ä½œçœŸæ­£çš„è³‡æ–™ä¾†æºï¼ˆåªæ˜¯éš±è—ï¼‰ï¼Œ
   changeäº‹ä»¶ç…§æ¨£æœƒåœ¨é¸é …æ”¹è®Šæ™‚çœŸçš„è¢«
   è§¸ç™¼ï¼Œæ‰€æœ‰ç¾æœ‰çš„onchangeç›£è½/
   .valueè®€å–å®Œå…¨ä¸ç”¨æ”¹ã€‚
*/

function initCustomDropdown(selectId){

    const selectEl=
        $(selectId);


    if(
        !selectEl ||
        customDropdownRegistry[selectId]
    ){
        return;
    }


    selectEl.style.display=
        "none";


    const wrapper=
        document.createElement("div");

    wrapper.className=
        "custom-dropdown";

    if(selectId.indexOf("autoSettings")===0){
        wrapper.classList.add("auto-premium-dropdown");
    }

    wrapper.id=
        selectId+"_customUI";


    const label=
        document.createElement("div");

    label.className=
        "custom-dropdown-label";


    const labelText=
        document.createElement("span");

    const arrow=
        document.createElement("span");

    arrow.className=
        "custom-dropdown-arrow";

    arrow.textContent=
        "â–¾";


    label.appendChild(
        labelText
    );

    label.appendChild(
        arrow
    );


    const list=
        document.createElement("div");

    list.className=
        "custom-dropdown-list";

    if(selectId.indexOf("autoSettings")===0){
        list.classList.add("auto-premium-dropdown-list");
    }


    wrapper.appendChild(
        label
    );

    wrapper.appendChild(
        list
    );


    selectEl.parentNode.insertBefore(
        wrapper,
        selectEl.nextSibling
    );


    customDropdownRegistry[selectId]={
        selectEl:selectEl,
        wrapper:wrapper,
        label:label,
        labelText:labelText,
        list:list
    };


    label.addEventListener(
        "click",
        event=>{

            event.stopPropagation();

            toggleCustomDropdown(
                selectId
            );

        }
    );


    /*
       é¸é …æœ¬èº«çš„valueæœ‰è®Šï¼ˆä¾‹å¦‚åˆ‡æ›è§’è‰²
       æ™‚ï¼Œç•«é¢ä¸Šé‚£é¡†selectè¢«ç¨‹å¼ç¢¼æ”¹äº†
       é¸ä¸­å€¼ï¼‰ï¼Œé€™è£¡çµ±ä¸€æ””æˆªåŒæ­¥ï¼Œ
       è¦‹ä¸Šé¢makeSelectValueReactive()
       çš„èªªæ˜Žã€‚
    */

    makeSelectValueReactive(
        selectEl,
        ()=>{

            renderCustomDropdownOptions(
                selectId
            );

        }
    );


    renderCustomDropdownOptions(
        selectId
    );

}


/*
   ä¾ç…§ç›®å‰<select>è£¡çš„<option>æ¸…å–®ï¼Œ
   é‡æ–°ç•«ä¸€æ¬¡å‡é¸å–®çš„æ¸…å–®å…§å®¹è·ŸæŒ‰éˆ•ä¸Š
   é¡¯ç¤ºçš„æ–‡å­—â€”â€”åˆå§‹åŒ–æ™‚å‘¼å«ä¸€æ¬¡ï¼Œ
   ä¹‹å¾Œ<select>çš„valueè¢«æ”¹è®Š
   ï¼ˆä¸ç®¡æ˜¯çŽ©å®¶é»žäº†å‡é¸å–®ã€é‚„æ˜¯ç¨‹å¼ç¢¼
   ç›´æŽ¥è³¦å€¼ï¼‰éƒ½æœƒé‡æ–°å‘¼å«é€™è£¡åŒæ­¥ç•«é¢ã€‚
*/

function renderCustomDropdownOptions(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(!entry){
        return;
    }


    const {
        selectEl,
        labelText,
        list
    }=entry;


    list.innerHTML=
        "";


    Array.from(
        selectEl.options
    ).forEach(
        opt=>{

            const item=
                document.createElement("div");

            item.className=
                "custom-dropdown-item";

            item.textContent=
                opt.textContent;


            const isSelected=

                opt.value===
                selectEl.value;


            if(isSelected){

                item.classList.add(
                    "selected"
                );

                labelText.textContent=
                    opt.textContent;

            }


            item.addEventListener(
                "click",
                event=>{

                    event.stopPropagation();


                    selectEl.value=
                        opt.value;


                    /*
                       æ‰‹å‹•è§¸ç™¼ä¸€æ¬¡changeäº‹ä»¶ï¼Œ
                       è·ŸåŽŸç”Ÿ<select>è¢«ä½¿ç”¨è€…
                       é¸äº†æ–°é¸é …æ™‚çš„è¡Œç‚ºä¸€è‡´ï¼Œ
                       ç¾æœ‰æŽ›åœ¨é€™å¹¾å€‹selectä¸Šçš„
                       onchangeç›£è½ï¼ˆä¾‹å¦‚
                       switchAutoSettingsCharacter()ï¼‰
                       æ‰æœƒè¢«æ­£å¸¸å‘¼å«åˆ°ã€‚
                    */

                    selectEl.dispatchEvent(

                        new Event(
                            "change",
                            {bubbles:true}
                        )

                    );


                    closeCustomDropdown(
                        selectId
                    );

                }
            );


            list.appendChild(
                item
            );

        }
    );

}


function toggleCustomDropdown(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(!entry){
        return;
    }


    const isOpen=

        entry.wrapper.classList.contains(
            "open"
        );


    /*
       æ‰“é–‹ä¸€å€‹ä¹‹å‰ï¼Œå…ˆæŠŠå…¶ä»–æ‰€æœ‰å·²ç¶“
       æ‰“é–‹çš„å‡é¸å–®é—œæŽ‰ï¼ŒåŒä¸€æ™‚é–“ç•«é¢ä¸Š
       åªæœƒæœ‰ä¸€å€‹å±•é–‹ï¼Œä¸æœƒç–Šåœ¨ä¸€èµ·ã€‚
    */

    Object.keys(
        customDropdownRegistry
    ).forEach(
        id=>{

            closeCustomDropdown(
                id
            );

        }
    );


    if(!isOpen){

        entry.wrapper.classList.add(
            "open"
        );


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å¯¦æ¸¬ç™¼ç¾çš„å•é¡Œï¼‰ï¼š
           è‡ªå‹•æˆ°é¬¥è¨­å®šé¢æ¿æœ¬èº«æœ‰
           overflow-y:autoï¼ˆè¦å¡žå…­åˆ—å…§å®¹ã€
           é¢æ¿é«˜åº¦æœ‰é™ï¼Œæœ¬ä¾†å°±éœ€è¦èƒ½æ²å‹•ï¼‰ï¼Œ
           é€™ä»£è¡¨å¦‚æžœæ¸…å–®ç•™åœ¨é¢æ¿è£¡é¢ç”¨
           position:absoluteå±•é–‹ï¼Œè¶…å‡ºé¢æ¿
           ç¯„åœçš„éƒ¨åˆ†æœƒç›´æŽ¥è¢«è£æŽ‰ï¼Œçœ‹èµ·ä¾†
           åƒé¸å–®ã€Œå±•ä¸é–‹ã€ã€‚

           è·Ÿä¹‹å‰æ¬å‹•æ•´å€‹è¨­å®šé¢æ¿æ˜¯åŒä¸€æ‹›ï¼š
           å±•é–‹çš„ç•¶ä¸‹ï¼ŒæŠŠæ¸…å–®æš«æ™‚æ¬åˆ°
           document.bodyï¼Œæ”¹ç”¨position:fixed
           é…åˆgetBoundingClientRect()é‡å‡º
           æŒ‰éˆ•çš„å¯¦éš›ä½ç½®ï¼Œè²¼è‘—æŒ‰éˆ•æ­£ä¸‹æ–¹
           é¡¯ç¤ºï¼Œä¸å†å—é¢æ¿çš„overflowé™åˆ¶ï¼›
           é—œé–‰æ™‚æ¬å›žåŽŸæœ¬åœ¨DOMè£¡çš„ä½ç½®ï¼Œ
           ç¢ºä¿ä¸‹æ¬¡é¢æ¿é‡æ–°æ‰“é–‹æ™‚ï¼Œæ¸…å–®
           é‚„æ˜¯ä¹–ä¹–è·Ÿè‘—å°çš„æŒ‰éˆ•ï¼Œä¸æœƒæ®˜ç•™
           åœ¨bodyåº•ä¸‹åˆ°è™•äº‚é£„ã€‚
        */

        moveDropdownListToBody(
            selectId
        );

    }

}


/*
   æŠŠæ¸…å–®å…ƒç´ å¾žåŽŸæœ¬çš„ä½ç½®ï¼ˆé¢æ¿è£¡é¢ï¼‰
   æ¬åˆ°document.bodyï¼Œä¸¦ä¸”ç”¨fixedå®šä½
   è²¼é½ŠlabelæŒ‰éˆ•çš„å¯¦éš›ç•«é¢åº§æ¨™â€”â€”
   é€™æ¨£ä¸ç®¡å¤–å±¤å®¹å™¨æœ‰æ²’æœ‰overflow:hidden/
   autoï¼Œéƒ½ä¸æœƒè¢«è£åˆ‡ã€‚
*/

function moveDropdownListToBody(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(!entry){
        return;
    }


    const {
        wrapper,
        label,
        list
    }=entry;


    if(!entry.originalNextSibling){

        entry.originalParent=
            list.parentNode;

        entry.originalNextSibling=
            list.nextSibling;

    }


    const labelRect=

        (label||wrapper)
        .getBoundingClientRect();


    document.body.appendChild(
        list
    );


    list.style.position=
        "fixed";

    list.style.top=
        (labelRect.bottom+4)+
        "px";

    list.style.left=
        labelRect.left+
        "px";

    list.style.width=
        labelRect.width+
        "px";

    list.style.right=
        "auto";

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œã€Œè‡ªå‹•æˆ°é¬¥
       è¨­å®šï¼ŒæŒ‰ä¸‹åŽ»é¸å–®ç®­é ­æœ‰åæ‡‰ï¼Œä½†å°±æ˜¯
       æ²’æœ‰ä¸‹æ‹‰æ¸…å–®å¯ä»¥é¸ã€ï¼‰ï¼š
       çœŸæ­£åŽŸå› æ‰¾åˆ°äº†â€”â€”é€™å€‹æ¸…å–®è¢«æ¬åˆ°
       document.bodyä¹‹å¾Œï¼Œz-indexå¯«æ­»
       5000ï¼Œé€™åœ¨ç•¶åˆï¼ˆ.home-feature-modal
       é‚„æ˜¯3200çš„å¹´ä»£ï¼‰è¶³å¤ é«˜ã€æ²’å•é¡Œã€‚
       ä½†å¾Œä¾†å› ç‚ºå¦ä¸€å€‹bugï¼ˆè¨­å®šè¦–çª—è¢«
       creationPageçš„z-index:5000è“‹ä½ï¼‰ï¼Œ
       æŠŠ.home-feature-modalæœ¬èº«æ‹‰é«˜åˆ°
       6000ï¼Œé€™å€‹æ¸…å–®çš„5000åè€Œè®Šæˆæ¯”
       å½ˆçª—æœ¬èº«çš„æ·±è‰²é®ç½©ï¼ˆz-index:6000ï¼‰
       é‚„ä½Žâ€”â€”æ¸…å–®å…¶å¯¦æœ‰æ­£å¸¸å±•é–‹ã€ä½ç½®
       ä¹Ÿç®—å°ï¼Œåªæ˜¯æ•´å€‹è¢«å½ˆçª—è‡ªå·±çš„
       åŠé€æ˜Žé»‘è‰²èƒŒæ™¯è“‹åœ¨ä¸Šé¢ï¼Œç•«é¢ä¸Š
       å®Œå…¨çœ‹ä¸åˆ°ï¼Œè·Ÿã€Œæ²’æœ‰æ¸…å–®å¯ä»¥é¸ã€
       çš„ç—‡ç‹€ä¸€æ¨¡ä¸€æ¨£ã€‚

       é€™è£¡æ‹‰é«˜åˆ°6100ï¼Œè“‹éŽç›®å‰å½ˆçª—ç³»çµ±
       ç”¨åˆ°çš„æ‰€æœ‰z-indexï¼ˆ6000ï½ž6060ï¼‰ã€‚
       â˜… æé†’ï¼šé€™å€‹æ¸…å–®æ˜¯ç”¨JSé‡measured
       getBoundingClientRect()+position:
       fixedæ¬åˆ°bodyé¡¯ç¤ºçš„ï¼ˆè¦‹ä¸Šé¢
       moveDropdownListToBody()ï¼‰ï¼Œé€™æ•´å¥—
       æ‰‹æ³•æœ¬èº«åœ¨é€™å€‹å°ˆæ¡ˆè£¡å·²ç¶“ä¸åªä¸€æ¬¡
       æ˜¯bugçš„ä¾†æºï¼Œä¹‹å¾Œå¦‚æžœåˆè¦èª¿æ•´å½ˆçª—
       ç–Šå±¤ï¼Œè¨˜å¾—å›žä¾†æª¢æŸ¥é€™è£¡çš„z-index
       æœ‰æ²’æœ‰è·Ÿè‘—èª¿æ•´éŽã€‚
    */

    list.style.zIndex=
        "6100";


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œã€ŒæŒ‰ä¸‹åŽ»
       é‚„æ˜¯æ²’åæ‡‰ã€ï¼Œé€™æ¬¡çœŸçš„æŒ–åˆ°æœ€åº•å±¤
       åŽŸå› äº†ï¼‰ï¼š
       åªæ¬ä½ç½®ã€åªä¿®z-indexéƒ½é‚„ä¸å¤ â€”â€”
       æ¸…å–®åŽŸæœ¬é CSSè¦å‰‡ã€Œ.custom-dropdown.
       open .custom-dropdown-listã€æŽ§åˆ¶
       å±•é–‹æ™‚çš„max-height/opacityï¼Œé€™æ¢
       è¦å‰‡è¦æ±‚æ¸…å–®é‚„ã€Œç•™åœ¨ã€.custom-dropdown
       è£¡é¢æ‰æœƒç”Ÿæ•ˆã€‚æ¸…å–®è¢«æ¬åˆ°
       document.bodyä¹‹å¾Œï¼Œä¸å†æ˜¯
       .custom-dropdown.opençš„å­å…ƒç´ ï¼Œ
       é€™æ¢è¦å‰‡ç›´æŽ¥å¤±æ•ˆï¼Œæ¸…å–®æ‰“å›žé è¨­çš„
       max-height:0ã€opacity:0ï¼Œç­‰æ–¼
       å®Œå…¨æ”¶åˆâ€”â€”é€™æ‰æ˜¯çœŸæ­£çš„åŽŸå› ï¼Œ
       z-indexåªæ˜¯å¦ä¸€å€‹ç–ŠåŠ çš„å•é¡Œï¼Œ
       å…©å€‹ä¸€èµ·ä¿®æ‰æœƒçœŸçš„çœ‹åˆ°æ¸…å–®ã€‚

       é€™è£¡è®“æ¸…å–®è‡ªå·±èº«ä¸Šä¹Ÿå¸¶ä¸€å€‹"open"
       classï¼ˆCSSé‚£é‚Šæ–°å¢žäº†å°æ‡‰çš„
       .custom-dropdown-list.openè¦å‰‡ï¼‰ï¼Œ
       ä¸ç®¡æ¸…å–®current DOMä½ç½®åœ¨å“ªè£¡éƒ½èƒ½
       æ­£ç¢ºå±•é–‹ã€‚
    */

    list.classList.add(
        "open"
    );

}


/*
   æŠŠæ¸…å–®æ¬å›žå®ƒåŽŸæœ¬åœ¨DOMè£¡çš„ä½ç½®ï¼Œ
   æ¸…æŽ‰fixedå®šä½ç›¸é—œçš„è¡Œå…§æ¨£å¼ï¼Œ
   æ¢å¾©æˆåŽŸæœ¬é CSS classæŽ§åˆ¶çš„æ¨£å­ã€‚
*/

function moveDropdownListBack(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(
        !entry ||
        !entry.originalParent
    ){
        return;
    }


    const {list}=
        entry;


    list.style.position=
        "";

    list.style.top=
        "";

    list.style.left=
        "";

    list.style.width=
        "";

    list.style.right=
        "";

    list.style.zIndex=
        "";


    if(
        entry.originalNextSibling &&
        entry.originalNextSibling.parentNode===
        entry.originalParent
    ){

        entry.originalParent.insertBefore(
            list,
            entry.originalNextSibling
        );

    }
    else{

        entry.originalParent.appendChild(
            list
        );

    }

}


function closeCustomDropdown(selectId){

    const entry=
        customDropdownRegistry[selectId];


    if(entry){

        entry.wrapper.classList.remove(
            "open"
        );


        /*
           â˜… æ–°å¢žï¼šè·ŸmoveDropdownListToBody()
           è£¡åŠ çš„list.classList.add("open")
           å°æ‡‰ï¼Œé—œé–‰æ™‚è¦è¨˜å¾—æ‹¿æŽ‰ï¼Œä¸ç„¶æ¸…å–®
           è¢«æ¬å›žåŽŸä½ä¹‹å¾Œstillå¸¶è‘—"open"ï¼Œ
           ä¸‹æ¬¡é‚„æ²’é»žé–‹å°±å·²ç¶“æ˜¯å±•é–‹ç‹€æ…‹ï¼Œ
           ç•«é¢æœƒæ€ªæ€ªçš„ã€‚
        */

        entry.list.classList.remove(
            "open"
        );


        moveDropdownListBack(
            selectId
        );

    }

}


/*
   é»žç•«é¢ä¸Šä»»ä½•å‡é¸å–®ä»¥å¤–çš„åœ°æ–¹ï¼Œ
   å…¨éƒ¨æ”¶åˆèµ·ä¾†ï¼Œè·ŸåŽŸç”Ÿ<select>é»ž
   å¤–é¢æœƒè‡ªå‹•é—œé–‰æ˜¯ä¸€æ¨£çš„è¡Œç‚ºã€‚
*/

document.addEventListener(
    "click",
    event=>{
        if(event&&event.target&&typeof event.target.closest==="function"&&event.target.closest("#battlePage")){
            return;
        }

        Object.keys(
            customDropdownRegistry
        ).forEach(
            id=>{

                closeCustomDropdown(
                    id
                );

            }
        );

    }
);


/* =====================================================
   â˜… å‰µè§’
===================================================== */

function selectElement(element){

    if(
        !elementDatabase[element]
    ){
        return;
    }


    selectedCreationElement =
        element;


    document
    .querySelectorAll(
        ".element-option"
    )
    .forEach(button=>{
        button.classList.remove(
            "selected"
        );
    });


    const button =
        $("element"+
            element
            .charAt(0)
            .toUpperCase()+
            element.slice(1)
        );


    if(button){

        button.classList.add(
            "selected"
        );

    }

}


function creationAdd(stat,amount){

    if(
        !Object.prototype.hasOwnProperty.call(
            creationStats,
            stat
        )
    ){
        return;
    }


    if(amount>0){

        if(
            creationPoints<=0
        ){
            return;
        }


        creationStats[stat]++;

        creationPoints--;
    }
    else{

        /*
           åªèƒ½æ‰£æŽ‰çŽ©å®¶è‡ªå·±å‰›å‰›åˆ†é…çš„é»žã€‚
        */

        if(
            creationStats[stat]<=0
        ){
            return;
        }


        creationStats[stat]--;

        creationPoints++;

    }


    updateCreationUI();

}


function updateCreationUI(){

    $("creationAttack")
        .textContent =
        creationStats.attack;


    $("creationVitality")
        .textContent =
        creationStats.vitality;


    $("creationEnergy")
        .textContent =
        creationStats.energy;


    $("creationIntelligence")
        .textContent =
        creationStats.intelligence;


    $("creationDefense")
        .textContent =
        creationStats.defensePoints;


    $("creationAgility")
        .textContent =
        creationStats.agility;


    $("creationPoints")
        .textContent =
        creationPoints;

}


/*
   â˜… ä»¥ä¸‹æ˜¯ç¬¬äºŒè§’è‰²å‰µå»ºç”¨çš„å°æ‡‰å‡½å¼ï¼Œ
   é‚è¼¯è·Ÿä¸Šé¢ä¸‰å€‹å®Œå…¨ä¸€æ¨£ï¼Œåªæ˜¯æ“ä½œ
   creationStats2/creationPoints2/
   selectedCreationElement2 é€™çµ„ç¨ç«‹è®Šæ•¸ï¼Œ
   ä¸æœƒå½±éŸ¿ç¬¬ä¸€åè§’è‰²çš„å‰µè§’è³‡æ–™ã€‚
*/

function selectElement2(element){

    if(
        !elementDatabase[element]
    ){
        return;
    }


    selectedCreationElement2 =
        element;


    document
    .querySelectorAll(
        "#secondCharacterModal .element-option"
    )
    .forEach(button=>{
        button.classList.remove(
            "selected"
        );
    });


    const button =
        $("element2"+
            element
            .charAt(0)
            .toUpperCase()+
            element.slice(1)
        );


    if(button){

        button.classList.add(
            "selected"
        );

    }

}


function creationAdd2(stat,amount){

    if(
        !Object.prototype.hasOwnProperty.call(
            creationStats2,
            stat
        )
    ){
        return;
    }


    if(amount>0){

        if(
            creationPoints2<=0
        ){
            return;
        }


        creationStats2[stat]++;

        creationPoints2--;

    }
    else{

        if(
            creationStats2[stat]<=0
        ){
            return;
        }


        creationStats2[stat]--;

        creationPoints2++;

    }


    updateCreationUI2();

}


function updateCreationUI2(){

    $("creation2Attack")
        .textContent =
        creationStats2.attack;


    $("creation2Vitality")
        .textContent =
        creationStats2.vitality;


    $("creation2Energy")
        .textContent =
        creationStats2.energy;


    $("creation2Intelligence")
        .textContent =
        creationStats2.intelligence;


    $("creation2Defense")
        .textContent =
        creationStats2.defensePoints;


    $("creation2Agility")
        .textContent =
        creationStats2.agility;


    $("creation2Points")
        .textContent =
        creationPoints2;

}


function isThirdCharacterUnlocked(){
    return !!(
        player2 &&
        player.level>=50 &&
        player2.level>=50
    );
}


function updateCreationScreenContext(){
    const subtitle=$("creationContextSubtitle");
    const submitLabel=$("creationSubmitLabel");
    const cancelButton=$("creationCancelButton");
    const primaryNextButton=$("creationPrimaryNextButton");
    const additionalStepOneActions=$("creationAdditionalStepOneActions");

    const ordinal=
        creationTargetSlot===3
        ? "ç¬¬ä¸‰å"
        : creationTargetSlot===2
        ? "ç¬¬äºŒå"
        : "ç¬¬ä¸€å";

    if(subtitle){
        subtitle.textContent=
            "é¸æ“‡ä½ çš„å…ƒç´ ä¹‹é“ï¼Œå»ºç«‹"+ordinal+"å†’éšªè€…";
    }

    if(submitLabel){
        submitLabel.textContent=
            creationTargetSlot===1
            ? "é–‹å§‹å†’éšª"
            : "å®Œæˆå‰µå»º";
    }

    if(cancelButton){
        cancelButton.hidden=creationTargetSlot===1;
    }

    if(primaryNextButton){
        primaryNextButton.hidden=creationTargetSlot!==1;
    }

    if(additionalStepOneActions){
        additionalStepOneActions.hidden=creationTargetSlot===1;
    }
}


function resetSharedCreationForm(){
    selectedCreationElement="fire";
    creationPoints=START_ATTRIBUTE_POINTS;

    Object.keys(creationStats).forEach(stat=>{
        creationStats[stat]=0;
    });

    const idInput=$("creationId");
    if(idInput){ idInput.value=""; }

    selectElement("fire");

    if(typeof selectCreationGender==="function"){
        selectCreationGender("female");
    }

    if(typeof setCreationStep==="function"){
        setCreationStep(1);
    }

    updateCreationUI();
    updateCreationScreenContext();
}


function openCharacterCreation(slotNumber){
    const slot=Number(slotNumber);

    if(battleActive || ![2,3].includes(slot)){
        return;
    }

    if(slot===2){
        if(player2){ return; }
        if(player.level<10){
            alert("ç¬¬ä¸€è§’è‰²é”åˆ° Lv.10 å¾Œæ‰èƒ½å»ºç«‹ç¬¬äºŒè§’è‰²ã€‚");
            return;
        }
    }

    if(slot===3){
        if(player3){ return; }
        if(!isThirdCharacterUnlocked()){
            alert("ç¬¬ä¸€ã€ç¬¬äºŒè§’è‰²éƒ½é”åˆ° Lv.50 å¾Œæ‰èƒ½å»ºç«‹ç¬¬ä¸‰è§’è‰²ã€‚");
            return;
        }
    }

    closeHomeFeature();
    creationTargetSlot=slot;
    resetSharedCreationForm();
    showCreation();
}


function cancelAdditionalCharacterCreation(){
    if(creationTargetSlot===1){
        return;
    }

    creationTargetSlot=1;
    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";
    updateCreationScreenContext();

    if(typeof window.syncCreationTouchMode==="function"){
        window.syncCreationTouchMode();
    }

    showPage("home");
    openHomeFeature("character");
}


function buildAdditionalCharacter(id,element,gender){
    const character={
        id:id,
        element:element,
        gender:gender==="male" ? "male" : "female",
        level:1,
        exp:0,
        expNext:100,
        attack:creationStats.attack,
        vitality:creationStats.vitality,
        energy:creationStats.energy,
        intelligence:creationStats.intelligence,
        defensePoints:creationStats.defensePoints,
        agility:creationStats.agility,
        bonusHP:0,
        bonusSP:0,
        attributePoints:creationPoints,
        skillPoints:INITIAL_CHARACTER_SKILL_POINTS,
        hp:100+creationStats.vitality*50,
        sp:50+creationStats.energy*15,
        activeBuffs:[],
        statusEffects:[],
        isDefending:false
    };

    return character;
}


function registerAdditionalCharacter(slotNumber,character){
    const characterKey=slotNumber===3 ? "player3" : "player2";
    const existing=characters.find(entry=>entry.id===characterKey);

    if(existing){
        existing.name=character.id;
    }
    else{
        characters.push({id:characterKey,name:character.id});
    }

    characterEquipment[characterKey]={
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    };

    characterSkillLoadouts[characterKey]={
        name:character.id,
        skillLevels:{},
        equippedSkills:[]
    };
}


function createAdditionalCharacter(slotNumber){
    const id=$("creationId").value.trim();

    if(!id){
        alert("è«‹å…ˆè¼¸å…¥è§’è‰² IDã€‚");
        return;
    }

    if(id.length<2){
        alert("IDè‡³å°‘éœ€è¦2å€‹å­—å…ƒã€‚");
        return;
    }

    if(isCharacterIdTaken(id)){
        alert("è§’è‰² ID ä¸èƒ½èˆ‡ç¾æœ‰è§’è‰²é‡è¤‡ã€‚");
        return;
    }

    Object.keys(creationStats).forEach(stat=>{
        creationStats[stat]=Math.max(0,Number(creationStats[stat])||0);
    });

    const page=$("creationPage");
    const gender=page && page.dataset.gender==="male" ? "male" : "female";
    const character=buildAdditionalCharacter(
        id,
        selectedCreationElement,
        gender
    );

    if(slotNumber===3){
        player3=character;
    }
    else{
        player2=character;
    }

    registerAdditionalCharacter(slotNumber,character);

    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";

    const createdSlot=slotNumber;
    creationTargetSlot=1;
    updateCreationScreenContext();

    updateUI();
    renderInventory();
    renderSkillLoadout();
    saveGame();

    if(typeof window.syncCreationTouchMode==="function"){
        window.syncCreationTouchMode();
    }

    showPage("home");
    openHomeFeature("character");
    selectCharacterForTabs(createdSlot-1);

    alert("ã€Œ"+character.id+"ã€å‰µå»ºå®Œæˆï¼");
}


function openSecondCharacterModal(){

    openCharacterCreation(2);
    return;

    if(
        battleActive ||
        player2
    ){
        return;
    }


    /*
       æ¯æ¬¡æ‰“é–‹éƒ½é‡ç½®æˆåˆå§‹ç‹€æ…‹ï¼Œ
       é¿å…ä¸Šæ¬¡æ²’å‰µå»ºå®Œã€å–æ¶ˆæŽ‰çš„æ®˜ç•™æ•¸å€¼
       å½±éŸ¿ä¸‹ä¸€æ¬¡æ‰“é–‹ã€‚
    */

    selectedCreationElement2=
        "fire";


    Object.keys(
        creationStats2
    )
    .forEach(stat=>{

        creationStats2[stat]=0;

    });


    creationPoints2=
        START_ATTRIBUTE_POINTS;


    $("creation2Id")
        .value=
        "";


    document
    .querySelectorAll(
        "#secondCharacterModal .element-option"
    )
    .forEach(button=>{
        button.classList.remove(
            "selected"
        );
    });


    const fireButton=
        $("element2Fire");


    if(fireButton){

        fireButton.classList.add(
            "selected"
        );

    }


    updateCreationUI2();


    $("secondCharacterModal")
        .classList
        .add("show");

}


function closeSecondCharacterModal(){

    $("secondCharacterModal")
        .classList
        .remove("show");

}


/*
   â˜… å»ºç«‹ç¬¬äºŒè§’è‰²ã€‚

   è·ŸcreateCharacter()é‚è¼¯å°æ‡‰ï¼Œ
   ä½†å­˜é€²player2è€Œä¸æ˜¯playerï¼Œ
   è€Œä¸”ä¸æœƒå‹•åˆ°ç›®å‰çš„éŠæˆ²ç•«é¢
   ï¼ˆä¸éœ€è¦åˆ‡æ›å‰µè§’é /éŠæˆ²é ï¼Œ
   é—œæŽ‰modalå°±å¥½ï¼Œäººé‚„åœ¨ä¸»åŸŽï¼‰ã€‚
*/

function createSecondCharacter(){

    if(player2){
        return;
    }


    const id=
        $("creation2Id")
        .value
        .trim();


    if(!id){

        alert(
            "è«‹å…ˆè¼¸å…¥è§’è‰² IDã€‚"
        );

        return;

    }


    if(id.length<2){

        alert(
            "IDè‡³å°‘éœ€è¦2å€‹å­—å…ƒã€‚"
        );

        return;

    }


    if(isCharacterIdTaken(id)){

        alert(
            "è§’è‰² ID ä¸èƒ½èˆ‡ç¾æœ‰è§’è‰²é‡è¤‡ã€‚"
        );

        return;

    }


    Object.keys(creationStats2)
    .forEach(stat=>{

        creationStats2[stat]=
            Math.max(
                0,
                Number(
                    creationStats2[stat]
                )||0
            );

    });


    player2={

        id:id,

        element:
            selectedCreationElement2,

        level:1,

        exp:0,

        expNext:100,

        attack:
            creationStats2.attack,

        vitality:
            creationStats2.vitality,

        energy:
            creationStats2.energy,

        intelligence:
            creationStats2.intelligence,

        defensePoints:
            creationStats2.defensePoints,

        agility:
            creationStats2.agility,

        bonusHP:0,

        bonusSP:0,

        attributePoints:
            creationPoints2,

        skillPoints:INITIAL_CHARACTER_SKILL_POINTS,

        hp:100,

        sp:50,

        activeBuffs:[],

    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œé‡Žæ€ªç•°å¸¸
       ç‹€æ…‹ç›´æŽ¥åšã€â€”â€”æ€ªç‰©çµ‚æ–¼å¯ä»¥å°çŽ©å®¶
       é™„åŠ è² é¢æ•ˆæžœäº†ï¼‰ï¼šè·Ÿæ€ªç‰©èº«ä¸Šçš„
       monster.statusEffectsæ˜¯åŒä¸€å¥—è³‡æ–™
       çµæ§‹ã€åŒä¸€å¥—å…±ç”¨å‡½å¼
       ï¼ˆapplyMonsterDebuff()/
       getMonsterDebuffValue()/
       isMonsterFrozen()/isMonsterPetrified()
       é›–ç„¶åå­—è£¡æœ‰ã€ŒMonsterã€ï¼Œä½†é€™äº›å‡½å¼
       æœ¬ä¾†å°±åªæ“ä½œå‚³é€²åŽ»çš„ç‰©ä»¶æœ¬èº«ï¼Œæ²’æœ‰
       ä»»ä½•å¯«æ­»monsterå°ˆå±¬çš„æ¬„ä½ï¼ŒçŽ©å®¶è§’è‰²
       ç‰©ä»¶ä¸€æ¨£èƒ½ç›´æŽ¥æ²¿ç”¨ï¼Œä¸ç”¨é‡å¯«ä¸€å¥—ï¼‰ã€‚
    */

    statusEffects:[],

        /*
           â˜… æ–°å¢žï¼šé˜²ç¦¦ç‹€æ…‹ï¼Œè·Ÿplayerçµæ§‹ä¸€è‡´ã€‚
        */

        isDefending:false

    };


    const baseHP=
        100+
        player2.vitality*50+
        player2.bonusHP;


    const baseSP=
        50+
        player2.energy*15+
        player2.bonusSP;


    player2.hp=
        baseHP;


    player2.sp=
        baseSP;


    /*
       â˜… æŠŠç¬¬äºŒè§’è‰²æŽ›é€²æ—¢æœ‰çš„
       characters / characterEquipment /
       characterSkillLoadouts é€™ä¸‰å€‹çµæ§‹ï¼Œ
       ç”¨å›ºå®šid"player2"ç•¶key
       ï¼ˆä¸ç”¨å…ƒç´ ç•¶keyï¼Œ
       é€™æ¨£å°±ç®—å…ƒç´ è·Ÿç¬¬ä¸€åè§’è‰²é‡è¤‡ä¹Ÿä¸æœƒäº’ç›¸è¦†è“‹ï¼‰ã€‚
       é€™ä¸‰å€‹çµæ§‹åŽŸæœ¬å°±æ˜¯èƒŒåŒ…é /æŠ€èƒ½é åœ¨è®€çš„è³‡æ–™ä¾†æºï¼Œ
       æŽ›é€²åŽ»ä¹‹å¾Œé‚£å…©å€‹é é¢æ‰æŠ“å¾—åˆ°ç¬¬äºŒè§’è‰²ã€‚
    */

    characters.push({

        id:"player2",

        name:
            player2.id

    });


    characterEquipment.player2={
        head:null,
        hand:null,
        shoulder:null,
        armor:null,
        shoes:null,
        ring:null
    };


    characterSkillLoadouts.player2={

        name:
            player2.id,

        skillLevels:{},

        equippedSkills:[]

    };


    closeSecondCharacterModal();


    updateUI();

    saveGame();


    alert(
        "ã€Œ"+
        player2.id+
        "ã€å‰µå»ºå®Œæˆï¼å¯ä»¥åˆ°èƒŒåŒ…é è·ŸæŠ€èƒ½é æŸ¥çœ‹ã€‚"
    );

}


/* =====================================================
   â˜… å‰µè§’å®Œæˆ
===================================================== */

let initialCharacterCreationPending=false;
async function createCharacter(){

    if(creationTargetSlot===2 || creationTargetSlot===3){
        createAdditionalCharacter(creationTargetSlot);
        return;
    }

    const id =
        $("creationId")
        .value
        .trim();


    if(!id){

        alert(
            "è«‹å…ˆè¼¸å…¥è§’è‰² IDã€‚"
        );

        return;

    }


    if(id.length<2){

        alert(
            "IDè‡³å°‘éœ€è¦2å€‹å­—å…ƒã€‚"
        );

        return;

    }


    /*
       ç¢ºä¿å…­é …èƒ½åŠ›éƒ½æ˜¯åˆæ³•æ•¸å€¼ã€‚
    */

    Object.keys(creationStats)
    .forEach(stat=>{

        creationStats[stat] =
            Math.max(
                0,
                Number(
                    creationStats[stat]
                )||0
            );

    });


    if(!window.FourSymbolsStartupPolicy||!window.FourSymbolsStartupPolicy.canCreateCharacter()){
        console.error("Character creation refused before account/save resolution.");
        return false;
    }

    if(initialCharacterCreationPending){ return false; }
    const accountSave=window.FourSymbolsAccountSave;
    const uid=window.FourSymbolsStartupPolicy.getUid();
    const firebase=window.FourSymbolsFirebase;
    let local,legacy;
    try{
        local=accountSave.readForUid(uid);
        legacy=accountSave.inspectLegacy();
    }catch(error){
        console.error("å‰µè§’å‰ç„¡æ³•é©—è­‰åŽŸè£ç½®è³‡æ–™ï¼›æœªå»ºç«‹è§’è‰²ã€‚",error);
        return false;
    }
    if(accountSave.getActiveUid()!==uid||local.status!=="empty"||
       legacy.status!=="none"||creationPoints!==0||
       !firebase||typeof firebase.createInitialCanonicalCharacter!=="function"){
        console.error("å‰µè§’éœ€è¦å…¨æ–°å¸³è™Ÿã€å®Œæ•´é…é»žèˆ‡å·²ç¢ºèªçš„é›²ç«¯æœå‹™ï¼›æœªå»ºç«‹è§’è‰²ã€‚");
        return false;
    }
    const selection={displayName:id,element:selectedCreationElement,
        gender:player.gender==="male"?"male":"female",
        attributes:Object.fromEntries(Object.keys(creationStats).map(key=>
            [key,creationStats[key]]))};
    initialCharacterCreationPending=true;
    try{
        const bootstrap=await firebase.bootstrapCloudSave();
        if(accountSave.getActiveUid()!==uid||
           !window.FourSymbolsStartupPolicy.canCreateCharacter()||
           accountSave.readForUid(uid).status!=="empty"){
            throw new Error("Account changed during creation.");
        }
        const committed=await firebase.createInitialCanonicalCharacter(
            selection,bootstrap.serverRevision);
        if(committed.authoritativeStateReady!==false||
           !Number.isSafeInteger(committed.sourceRevision)||
           accountSave.getActiveUid()!==uid||
           !window.FourSymbolsStartupPolicy.canCreateCharacter()||
           accountSave.readForUid(uid).status!=="empty"){
            throw new Error("Canonical creation response or account changed.");
        }
    }catch(error){
        initialCharacterCreationPending=false;
        console.error("å—ä¿è­·å‰µè§’æœªå®Œæˆï¼›æœ¬æ©Ÿè§’è‰²å°šæœªå»ºç«‹ã€‚",error);
        const oldAccount=String(error&&error.message||"")
            .includes("Existing accounts require the original-device migration path");
        alert(oldAccount
            ?"æ­¤å¸³è™Ÿéœ€è¦ä¿ç•™åŽŸæ‰‹æ©Ÿè§’è‰²ä¸¦èµ°é·ç§»æµç¨‹ï¼Œä¸èƒ½ç•¶ä½œå…¨æ–°å¸³è™Ÿå‰µè§’ã€‚"
            :"å‰µè§’å°šæœªå®Œæˆï¼Œè«‹ä¿æŒåŽŸå¸³è™Ÿä¸¦é‡è©¦ç›¸åŒçš„è§’è‰²é¸æ“‡ã€‚èˆŠæ‰‹æ©Ÿè§’è‰²è«‹èµ°é·ç§»æµç¨‹ã€‚");
        return false;
    }

    const previousPlayer=JSON.parse(JSON.stringify(player));
    selectedCreationElement=selection.element;
    Object.keys(creationStats).forEach(key=>{ creationStats[key]=selection.attributes[key]; });
    creationPoints=0;
    player.id=id;
    player.gender=selection.gender;

    player.element =
        selection.element;


    player.attack =
        selection.attributes.attack;

    player.vitality =
        selection.attributes.vitality;

    player.energy =
        selection.attributes.energy;

    player.intelligence =
        selection.attributes.intelligence;

    player.defensePoints =
        selection.attributes.defensePoints;

    player.agility =
        selection.attributes.agility;


    player.attributePoints =
        0;

    player.skillPoints =
        INITIAL_CHARACTER_SKILL_POINTS;


    /*
       ä¾å…­é …èƒ½åŠ›è¨ˆç®—åˆå§‹HP/SPã€‚
       ç”¨try/catchåŒ…èµ·ä¾†ï¼Œ
       å°±ç®—é€™è£¡æ„å¤–å‡ºéŒ¯ï¼Œ
       ç•«é¢ä¹Ÿå·²ç¶“åˆ‡æ›éŽåŽ»äº†ã€‚
    */

    try{

        const stats =
            getBaseStats();


        player.hp =
            stats.maxHP;


        player.sp =
            stats.maxSP;


        updatePlayerHeader();

        updateUI();

        renderInventory();

        renderSkillLoadout();

    }
    catch(error){

        console.error(
            "å‰µè§’å¾ŒçºŒåˆå§‹åŒ–ç™¼ç”ŸéŒ¯èª¤ï¼š",
            error
        );

    }


    if(saveGame()!==true){
        Object.keys(player).forEach(key=>delete player[key]);
        Object.assign(player,previousPlayer);
        console.error("å‰µè§’å­˜æª”å¤±æ•—ï¼›è§’è‰²æœªå»ºç«‹ã€‚",
            new Error("Account save commit failed."));
        initialCharacterCreationPending=false;
        return false;
    }

    initialCharacterCreationPending=false;
    window.FourSymbolsStartupPolicy.notifyCharacterCreated();
    $("creationPage").style.display="none";
    $("gameInterface").style.display="block";
    if(typeof window.syncCreationTouchMode==="function"){
        window.syncCreationTouchMode();
    }
    return true;

}


/* =====================================================
   å­˜æª”
===================================================== */

function saveGame(options={}){

    if(deleteAllCharactersInProgress){
        return false;
    }

    // Feature runtimes can request a save while the new-account creation
    // screen is open. An empty shell must not become a UID-owned character
    // save: it would block the protected first-character transaction.
    if(!player||!String(player.id||"").trim()){
        return false;
    }

    const repository=window.FourSymbolsAccountSave;
    const activeUid=repository&&repository.getActiveUid();
    if(!repository||!activeUid||SAVE_KEY!==repository.saveKey(activeUid)){
        console.error("å­˜æª”å¤±æ•—ï¼šå°šæœªå»ºç«‹å¯é©—è­‰çš„ UID ownerã€‚");
        return false;
    }

    try{

        /*
           Team Relic is intentionally loaded after the late runtime owner
           chain.  During a page reload, loadGame() reaches the core
           saveGame() once before that runtime is installed.  Preserve the
           extension fields from the existing document for that early save;
           after installation, the live window state remains authoritative.
        */

        let existingRelicSaveData=null;

        try{

            const existingRead=repository.readForUid(activeUid);
            const existingData=existingRead.status==="ready"?existingRead.save:null;

            if(
                existingData &&
                typeof existingData==="object"
            ){

                existingRelicSaveData=
                    existingData;

            }

        }
        catch(_){

            existingRelicSaveData=null;

        }

        normalizeInventoryStacks();

        const saveData = {

            version:6,

            player:player,

            /*
               â˜… ç¬¬äºŒè§’è‰²å­˜æª”ï¼ˆæ–°å¢žï¼‰ã€‚
               player2åœ¨æ²’å‰µå»ºä¹‹å‰æ˜¯nullï¼Œ
               JSON.stringify(null)æ²’å•é¡Œï¼Œ
               è®€æª”æ™‚åªè¦åˆ¤æ–·é€™å€‹æ¬„ä½æ˜¯ä¸æ˜¯nullå°±å¥½ã€‚
            */

            player2:player2,
            player3:player3,

            sharedExp:sharedExp,

            /*
               â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽ
               æ–°å¢žçš„å…­å€‹åŠŸèƒ½ï¼šå•†åº—/è§’è‰²å±•ç¤º/
               æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±/å…¬å‘Šï¼‰ï¼š
               é‡‘å¹£ã€æ¯æ—¥ä»»å‹™é€²åº¦ã€åœ–é‘‘æ“Šæ®º
               ç´€éŒ„ã€æˆå°±å®Œæˆç‹€æ…‹ï¼Œéƒ½æ˜¯æ–°å¢žçš„
               æŒä¹…åŒ–è³‡æ–™ï¼Œè·Ÿè‘—å­˜æª”ä¸€èµ·å­˜ã€‚
               è§’è‰²å±•ç¤ºã€å…¬å‘Šä¸éœ€è¦å­˜æª”
               ï¼ˆè§’è‰²å±•ç¤ºç›´æŽ¥è®€player/player2
               ç¾æœ‰è³‡æ–™ï¼Œå…¬å‘Šæ˜¯ç´”éœæ…‹æ–‡å­—ï¼‰ã€‚
            */

            gold:gold,

            dailyQuestState:
                dailyQuestState,

            /*
               â˜… æ–°å¢žï¼šå§”è¨—ä»»å‹™é€²åº¦è·Ÿæ¯æ—¥ä»»å‹™
               ä¸€æ¨£è¦å­˜æª”ã€‚
            */

            commissionQuestState:
                commissionQuestState,
            bestiaryData:
                bestiaryData,

            achievementState:
                achievementState,

            /*
               â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé›¢ç·šç¶“é©—
               ç³»çµ±ï¼‰ï¼šæ¯æ¬¡å­˜æª”éƒ½è¨˜éŒ„ã€Œé€™æ¬¡å­˜æª”
               ç•¶ä¸‹çš„æ™‚é–“ã€ï¼Œè®€æª”æ™‚æ‹¿ç¾åœ¨æ™‚é–“
               åŽ»æ¸›é€™å€‹æ™‚é–“æˆ³è¨˜ï¼Œå°±èƒ½ç®—å‡ºçŽ©å®¶
               é›¢é–‹äº†å¤šä¹…ï¼Œæ›ç®—å‡ºé›¢ç·šç¶“é©—ã€‚
            */

            lastSaveTimestamp:
                Date.now(),

            selectedCreationElement:
                selectedCreationElement,

            characterEquipment:
                characterEquipment,

            /*
               â˜… ä¿®æ­£ï¼š
               characterSkillLoadoutsï¼ˆå·²å­¸æŠ€èƒ½ã€ç­‰ç´šã€
               æˆ°é¬¥é…è£ï¼‰ä¹‹å‰å®Œå…¨æ²’æœ‰å­˜æª”ï¼Œ
               çŽ©å®¶èŠ±æŠ€èƒ½é»žå­¸çš„æŠ€èƒ½ã€å‡çš„ç­‰ç´šï¼Œ
               åªè¦é‡æ–°æ•´ç†é é¢å°±æœƒå…¨éƒ¨æ¶ˆå¤±ã€‚
               ç¾åœ¨æŠŠå®ƒåŠ é€²å­˜æª”è³‡æ–™è£¡ã€‚
            */

            characterSkillLoadouts:
                characterSkillLoadouts,

            /*
               â˜… æ–°å¢žï¼šè‡ªå‹•æˆ°é¬¥è¨­å®šå­˜æª”ã€‚
               é€™å…©çµ„åŽŸæœ¬éƒ½å®Œå…¨æ²’æœ‰å­˜æª”ï¼Œ
               æ¯æ¬¡é‡æ–°æ•´ç†/é‡é–‹ï¼Œ
               çŽ©å®¶è¨­å¥½çš„è‡ªå‹•æŠ€èƒ½/HPé–€æª»/SPé–€æª»
               éƒ½æœƒè¢«é‡ç½®å›žé è¨­å€¼ï¼Œ
               ç¾åœ¨å…©å€‹è§’è‰²çš„è¨­å®šéƒ½ä¸€èµ·å­˜èµ·ä¾†ã€‚
            */

            autoConfig:
                autoConfig,

            autoConfig2:
                autoConfig2,

            autoConfig3:
                autoConfig3,

            allyFormation:
                (
                    typeof window!=="undefined" &&
                    window.FourSymbolsBattlefieldSlots &&
                    typeof window.FourSymbolsBattlefieldSlots.getSerializableAllyFormation==="function"
                )
                ? window.FourSymbolsBattlefieldSlots.getSerializableAllyFormation()
                : (
                    existingRelicSaveData &&
                    existingRelicSaveData.allyFormation
                ),

            /*
               Team Relic persistence uses this same SAVE_KEY document.
               On the first save during reload its late runtime does not
               exist yet, so retain the previous values instead of silently
               deleting them.  Later saves read the live runtime objects.
            */

            playerRelics:
                (
                    typeof window!=="undefined" &&
                    window.playerRelics &&
                    typeof window.playerRelics==="object"
                )
                ?
                window.playerRelics
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.playerRelics
                ),

            teamLoadout:
                (
                    typeof window!=="undefined" &&
                    window.teamLoadout &&
                    typeof window.teamLoadout==="object"
                )
                ?
                window.teamLoadout
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.teamLoadout
                ),

            /*
               The formal Gameplay Center and current Abyss owners are loaded
               after the core save document. Preserve their extension fields
               during the early reload save, then use their live state once
               those runtimes have hydrated. This keeps old saves compatible
               without allowing a reload to erase first-clear progress.
            */

            gameplayProgress:
                (
                    typeof window!=="undefined" &&
                    window.GameplaySystem &&
                    typeof window.GameplaySystem.getSerializableState==="function"
                )
                ?
                window.GameplaySystem.getSerializableState()
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.gameplayProgress
                ),

            abyssProgress:
                (
                    typeof window!=="undefined" &&
                    typeof window.v174AbyssGetRootState==="function"
                )
                ?
                window.v174AbyssGetRootState()
                :
                (
                    existingRelicSaveData &&
                    existingRelicSaveData.abyssProgress
                ),

            inventoryItems:
                inventoryItems

        };


        const persistenceOptions=options&&typeof options==="object"?options:{};
        let endReleaseSaveOperation=null;
        try{
            if(
                window.FourSymbolsReleaseUpdate&&
                typeof window.FourSymbolsReleaseUpdate.beginCriticalOperation==="function"
            ){
                endReleaseSaveOperation=
                    window.FourSymbolsReleaseUpdate.beginCriticalOperation("account-save-write");
            }
        }catch(_){ }
        try{
            repository.writeForUid(activeUid,saveData,{
                source:String(persistenceOptions.source||"gameplay"),
                ...(typeof persistenceOptions.localDirty==="boolean"?{localDirty:persistenceOptions.localDirty}:{})
            });
        }finally{
            if(typeof endReleaseSaveOperation==="function"){
                endReleaseSaveOperation();
            }
        }
        return true;

    }
    catch(error){

        console.error(
            "å­˜æª”å¤±æ•—ï¼š",
            error
        );

        return false;

    }

}


/* =====================================================
   â˜… èˆŠå­˜æª”ä¿®å¾© / è®€æª”
===================================================== */

/* =====================================================
   èˆŠå­˜æª”æŠ€èƒ½å¼•ç”¨ç›¸å®¹
   - V152 æ›¾æŠŠèª¤åŠ å…¥çŽ©å®¶æŠ€èƒ½æ± çš„ fireBurstStrike é€€å½¹ã€‚
   - å¾Œå±¤ gameplay runtime ä»æœƒæ¸…ç†æ€ªç‰©èˆ‡åŸ·è¡ŒéšŽæ®µè³‡æ–™ï¼Œ
     ä½†å¸³è™Ÿ hydration å¿…é ˆåœ¨ç¬¬ä¸€æ¬¡æŠ€èƒ½ UI render å‰å…ˆæ¸…ç†çŽ©å®¶å­˜æª”å¼•ç”¨ã€‚
===================================================== */
function normalizeHydratedRetiredSkillReferences(){

    const retiredPlayerSkillIds=new Set([
        "fireBurstStrike"
    ]);

    Object.values(characterSkillLoadouts||{}).forEach(loadout=>{
        if(!loadout||typeof loadout!=="object"){ return; }

        if(loadout.skillLevels&&typeof loadout.skillLevels==="object"&&!Array.isArray(loadout.skillLevels)){
            retiredPlayerSkillIds.forEach(skillId=>delete loadout.skillLevels[skillId]);
        }

        if(Array.isArray(loadout.equippedSkills)){
            loadout.equippedSkills=loadout.equippedSkills.filter(skillId=>{
                if(retiredPlayerSkillIds.has(skillId)){ return false; }
                const skill=skillDatabase&&skillDatabase[skillId];
                return !!(skill&&skill.monsterOnly!==true);
            });
        }
    });

    [autoConfig,autoConfig2,autoConfig3].forEach(config=>{
        if(config&&retiredPlayerSkillIds.has(config.skill)){
            config.skill="normal";
        }
    });
}


function migrateLegacySixStats(character){
    if(!character||typeof character!=="object"){ return character; }
    const legacySpirit=Number(character.spirit);
    if(Number.isFinite(legacySpirit)&&legacySpirit>0){
        character.attributePoints=Math.max(0,Number(character.attributePoints)||0)+Math.max(0,legacySpirit);
    }
    delete character.spirit;
    if(!Number.isFinite(Number(character.defensePoints))){ character.defensePoints=0; }
    character.defensePoints=Math.max(0,Number(character.defensePoints)||0);
    return character;
}

function loadGame(){

    const resolvedSave=arguments[0]||null;

    try{

        /*
           Startup may already have resolved and verified the exact UID save.
           Hydrate that payload directly so READY cannot race a second repository read.
           Ordinary load callers still read the active UID repository as before.
        */

        const repository=window.FourSymbolsAccountSave;
        const activeUid=repository&&repository.getActiveUid();
        if(!repository||!activeUid||SAVE_KEY!==repository.saveKey(activeUid)){ return false; }

        let raw=null;
        if(resolvedSave&&typeof resolvedSave==="object"&&!Array.isArray(resolvedSave)){
            raw=JSON.stringify(resolvedSave);
        }else{
            const accountSave=repository.readForUid(activeUid);
            raw=accountSave.status==="ready"?JSON.stringify(accountSave.save):null;
        }

        if(!raw){

            return false;

        }


        const data =
            JSON.parse(raw);


        if(
            !data ||
            !data.player ||
            !data.player.id
        ){

            return false;

        }


        /*
           å…ˆæŠŠçŽ©å®¶è³‡æ–™è¼‰å…¥ã€‚
        */

        Object.assign(
            player,
            data.player
        );
        migrateLegacySixStats(player);


        /*
           â˜… èˆŠç‰ˆæ²’æœ‰é€™äº›èƒ½åŠ›æ™‚ï¼Œ
           å¼·åˆ¶è£œ0ã€‚
        */

        const stats = [
            "attack",
            "vitality",
            "energy",
            "intelligence",
            "defensePoints",
            "agility"
        ];


        stats.forEach(stat=>{

            const value =
                Number(
                    player[stat]
                );


            player[stat] =
                Number.isFinite(value)
                ?
                Math.max(
                    0,
                    value
                )
                :
                0;

        });


        /*
           â˜… èˆŠå­˜æª”å¯èƒ½æ²’æœ‰bonusHP/bonusSPï¼Œ
           å¼·åˆ¶è£œ0ï¼Œé¿å…å‡ç´šå…¬å¼å‡ºéŒ¯ã€‚
        */

        if(
            !Number.isFinite(
                Number(player.bonusHP)
            )
        ){

            player.bonusHP=0;

        }


        if(
            !Number.isFinite(
                Number(player.bonusSP)
            )
        ){

            player.bonusSP=0;

        }


        /*
           â˜… è®€å–å…±ç”¨ç¶“é©—æ± ï¼Œ
           èˆŠå­˜æª”æ²’æœ‰çš„è©±å°±å¾ž0é–‹å§‹ï¼Œ
           çŽ©å®¶èº«ä¸ŠåŽŸæœ¬å¡è‘—çš„expæœƒè‡ªå‹•è½‰å…¥ç¶“é©—æ± ã€‚
        */

        if(
            Number.isFinite(
                Number(data.sharedExp)
            )
        ){

            sharedExp =
                Number(
                    data.sharedExp
                );

        }
        else{

            sharedExp=0;

        }


        /* V93ï¼šèˆŠ V92 çš„ permanentTestExpPool æ¬„ä½åˆ»æ„å¿½ç•¥ï¼Œ
           æ¸¬è©¦ EXP å·²æ”¹ç‚ºæ¯æŒ‰ä¸€æ¬¡ç›´æŽ¥è¿½åŠ ï¼Œä¸å†è‡ªå‹•è£œå›žã€‚ */



        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽ
           æ–°å¢žçš„å…­å€‹åŠŸèƒ½ï¼‰ï¼š
           è®€å–é‡‘å¹£/æ¯æ—¥ä»»å‹™/åœ–é‘‘/æˆå°±ï¼Œ
           èˆŠå­˜æª”æ²’æœ‰é€™äº›æ¬„ä½çš„è©±å°±ç”¨é è¨­å€¼ï¼Œ
           ä¸æœƒè®“è®€æª”æ•´å€‹å¤±æ•—ã€‚
        */

        if(
            Number.isFinite(
                Number(data.gold)
            )
        ){

            gold=
                Number(
                    data.gold
                );

        }


        if(
            data.dailyQuestState &&
            typeof data.dailyQuestState===
            "object"
        ){

            Object.assign(
                dailyQuestState,
                data.dailyQuestState
            );

        }


        if(
            data.commissionQuestState &&
            typeof data.commissionQuestState===
            "object"
        ){

            Object.assign(
                commissionQuestState,
                data.commissionQuestState
            );

        }


        if(
            data.bestiaryData &&
            typeof data.bestiaryData===
            "object"
        ){

            Object.assign(
                bestiaryData,
                data.bestiaryData
            );

        }


        if(
            data.achievementState &&
            typeof data.achievementState===
            "object"
        ){

            Object.assign(
                achievementState,
                data.achievementState
            );

        }


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œçµ±ä¸€æ”¹ç”¨
           å…±ç”¨å‡½å¼calculateOfflineExpSince()ï¼Œ
           è·Ÿã€Œåˆ‡å›žå‰æ™¯ã€é‚£å€‹æ™‚æ©Ÿå…±ç”¨åŒä¸€ä»½
           é‚è¼¯ï¼Œä¸è¦å„è‡ªç¶­è­·ä¸€ä»½å¹¾ä¹Žä¸€æ¨£
           çš„è¨ˆç®—ï¼‰ï¼š
           è®€æª”çš„æ™‚å€™ï¼Œæ‹¿ç¾åœ¨æ™‚é–“æ¸›æŽ‰ä¸Šæ¬¡
           å­˜æª”çš„æ™‚é–“æˆ³è¨˜ï¼Œæ›ç®—å‡ºçŽ©å®¶é›¢é–‹äº†
           å¹¾åˆ†é˜ï¼Œç®—å‡ºé€™æ¬¡ã€Œå¯ä»¥é ˜å–ã€çš„
           é›¢ç·šç¶“é©—ï¼Œå­˜é€²pendingOfflineExp
           ï¼ˆä¸æœƒè‡ªå‹•åŠ é€²ç¶“é©—æ± ï¼Œè¦çŽ©å®¶è‡ªå·±
           åŽ»ä¸»åŸŽã€Œé›¢ç·šç¶“é©—ã€é‚£è£¡æŒ‰æŒ‰éˆ•æ‰æœƒ
           çœŸçš„å…¥å¸³ï¼‰ã€‚

           OFFLINE_EXP_PER_MINUTEï¼šæ¯é›¢ç·š
           1åˆ†é˜å¯ä»¥é ˜åˆ°çš„ç¶“é©—å€¼ã€‚
           OFFLINE_EXP_MAX_MINUTESï¼šé›¢ç·šç¶“é©—
           æœ€å¤šåªç®—åˆ°é€™å€‹åˆ†é˜æ•¸ï¼ˆ480åˆ†é˜ï¼
           8å°æ™‚ï¼‰ï¼Œè¶…éŽ8å°æ™‚ä¸æœƒé ˜åˆ°æ›´å¤šï¼Œ
           é¿å…çŽ©å®¶æ”¾è‘—è§’è‰²ä¸ç®¡å¥½å¹¾å¤©ï¼Œ
           ä¸€æ¬¡å›žä¾†å°±ç›´æŽ¥æŠŠç­‰ç´šè¡åˆ°é ‚ã€‚
        */

        if(
            Number.isFinite(
                Number(data.lastSaveTimestamp)
            )
        ){

            calculateOfflineExpSince(
                Number(
                    data.lastSaveTimestamp
                )
            );


            lastOfflineCheckTimestamp=
                Date.now();

        }


        if(
            Number.isFinite(
                Number(player.exp)
            ) &&
            player.exp>0
        ){

            sharedExp +=
                Number(player.exp);


            player.exp=0;

        }


        /*
           èˆŠç‰ˆå¯èƒ½é‚„æœ‰
           defense / maxHP / maxSP
           é€™äº›èˆŠæ¬„ä½ï¼Œ
           æ–°ç³»çµ±ä¸ç›´æŽ¥ä½¿ç”¨ã€‚
        */


        if(
            !player.element ||
            !elementDatabase[
                player.element
            ]
        ){

            player.element =
                "fire";

        }


        if(
            !Number.isFinite(
                Number(player.level)
            )
        ){

            player.level=1;

        }


        if(
            !Number.isFinite(
                Number(player.exp)
            )
        ){

            player.exp=0;

        }


        if(
            !Number.isFinite(
                Number(player.expNext)
            ) ||
            player.expNext<=0
        ){

            player.expNext=100;

        }


        if(
            !Number.isFinite(
                Number(
                    player.attributePoints
                )
            )
        ){

            player.attributePoints=0;

        }


        if(
            !Number.isFinite(
                Number(
                    player.skillPoints
                )
            )
        ){

            player.skillPoints=0;

        }


        /*
           â˜… è‡ªå‹•æˆ°é¬¥è¨­å®šè®€æª”ï¼ˆæ–°å¢žï¼‰ã€‚
           è·Ÿplayer2ä¸€æ¨£ï¼ŒèˆŠå­˜æª”ä¸æœƒæœ‰é€™å…©å€‹æ¬„ä½ï¼Œ
           é€™ç¨®æƒ…æ³ç›´æŽ¥ç¶­æŒç¨‹å¼ç¢¼ä¸€é–‹å§‹
           å®£å‘Šçš„é è¨­å€¼å°±å¥½ã€‚
        */

        if(data.autoConfig){

            Object.assign(
                autoConfig,
                data.autoConfig
            );

        }


        if(data.autoConfig2){

            Object.assign(
                autoConfig2,
                data.autoConfig2
            );

        }


        if(data.autoConfig3){

            Object.assign(
                autoConfig3,
                data.autoConfig3
            );

        }


        /* V111ï¼šèˆŠå­˜æª”é–€æª»é·ç§»åˆ° 25ï¼50ï¼75ï¼90ï¼100%ã€‚ */
        autoConfig.hp=normalizeAutoBattleThreshold(autoConfig.hp,50);
        autoConfig.sp=normalizeAutoBattleThreshold(autoConfig.sp,25);
        autoConfig2.hp=normalizeAutoBattleThreshold(autoConfig2.hp,50);
        autoConfig2.sp=normalizeAutoBattleThreshold(autoConfig2.sp,25);
        autoConfig3.hp=normalizeAutoBattleThreshold(autoConfig3.hp,50);
        autoConfig3.sp=normalizeAutoBattleThreshold(autoConfig3.sp,25);


        /*
           â˜… ç¬¬äºŒè§’è‰²è®€æª”ï¼ˆæ–°å¢žï¼‰ã€‚

           èˆŠå­˜æª”ï¼ˆé€™æ¬¡æ›´æ–°ä¹‹å‰å­˜çš„ï¼‰ä¸æœƒæœ‰
           data.player2é€™å€‹æ¬„ä½ï¼Œ
           é€™æ™‚å€™data.player2æ˜¯undefinedï¼Œ
           player2ç¶­æŒnullï¼Œç­‰æ–¼ã€Œé‚„æ²’å‰µå»ºéŽã€ï¼Œ
           å®Œå…¨ç¬¦åˆé æœŸï¼Œä¸éœ€è¦ç‰¹åˆ¥æ¬è³‡æ–™ã€‚

           å¦‚æžœæœ‰å­˜éŽçš„è©±ï¼Œé™¤äº†é‚„åŽŸplayer2æœ¬èº«ï¼Œ
           é‚„è¦ç¢ºä¿characters/characterEquipment/
           characterSkillLoadoutsé€™ä¸‰å€‹çµæ§‹è£¡
           éƒ½æŽ›è‘—player2å°æ‡‰çš„è³‡æ–™ï¼Œ
           ä¸ç„¶èƒŒåŒ…é /æŠ€èƒ½é æŠ“ä¸åˆ°äººã€‚
        */

        if(data.player2){

            player2=
                data.player2;
            migrateLegacySixStats(player2);

            if(
                !characters.some(
                    c=>c.id==="player2"
                )
            ){

                characters.push({

                    id:"player2",

                    name:
                        player2.id

                });

            }


            if(
                !characterEquipment.player2
            ){

                characterEquipment.player2={
                        head:null,
                        hand:null,
                        shoulder:null,
                        armor:null,
                        shoes:null,
                        ring:null
                    };

            }


            if(
                !characterSkillLoadouts.player2
            ){

                characterSkillLoadouts.player2={

                    name:
                        player2.id,

                    skillLevels:{},

                    equippedSkills:[]

                };

            }

        }


        if(data.player3){
            player3=data.player3;
            migrateLegacySixStats(player3);
            if(!characters.some(c=>c.id==="player3")){
                characters.push({id:"player3",name:player3.id});
            }
            if(!characterEquipment.player3){
                characterEquipment.player3={head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
            }
            normalizeEquipmentSlots(characterEquipment.player3);
            if(!characterSkillLoadouts.player3){
                characterSkillLoadouts.player3={name:player3.id,skillLevels:{},equippedSkills:[]};
            }
        }

        const savedAllyFormation=
            data.allyFormation && typeof data.allyFormation==="object"
            ? data.allyFormation
            : null;
        if(
            typeof window!=="undefined" &&
            window.FourSymbolsBattlefieldSlots &&
            typeof window.FourSymbolsBattlefieldSlots.hydrateAllyFormation==="function"
        ){
            window.FourSymbolsBattlefieldSlots.hydrateAllyFormation(
                savedAllyFormation,
                getExistingPartyIndexes()
            );
        }else if(typeof window!=="undefined"){
            window.__fourSymbolsPendingAllyFormation=savedAllyFormation;
        }


        /*
           â˜… æŠ€èƒ½é…è£è³‡æ–™ï¼ˆæ–°å¢žï¼‰

           è¦è™•ç†å…©ç¨®èˆŠè³‡æ–™æƒ…æ³ï¼š
           1. å®Œå…¨æ²’æœ‰ characterSkillLoadouts
              ï¼ˆæœ€æ—©çš„å­˜æª”ç‰ˆæœ¬ï¼Œé‚£æ™‚å€™æ ¹æœ¬æ²’å­˜é€™å€‹ï¼‰
           2. æœ‰å­˜ï¼Œä½†æ˜¯èˆŠæ ¼å¼
              ï¼ˆlearnedSkillsæ˜¯é™£åˆ—ï¼Œä¸æ˜¯skillLevelsç‰©ä»¶ï¼‰
              â†’ é€™ç¨®æƒ…æ³ç›´æŽ¥è¦–åŒæ²’å­˜ï¼Œ
                ç”¨é è¨­å€¼ï¼ˆç«ç„°æ–¬1ç´šï¼‰é‡æ–°é–‹å§‹ï¼Œ
                æŠ€èƒ½é»žæ•¸çŽ©å®¶é‚„åœ¨ï¼Œå¯ä»¥é‡æ–°å­¸ã€‚
        */

        if(
            data.characterSkillLoadouts
        ){

            Object.keys(
                characterSkillLoadouts
            )
            .forEach(characterId=>{

                const saved =
                    data.characterSkillLoadouts[
                        characterId
                    ];


                if(
                    saved &&
                    saved.skillLevels &&
                    typeof saved.skillLevels==="object"&&
                    !Array.isArray(
                        saved.skillLevels
                    )
                ){

                    characterSkillLoadouts[
                        characterId
                    ].skillLevels =
                        saved.skillLevels;


                    if(
                        Array.isArray(
                            saved.equippedSkills
                        )
                    ){

                        characterSkillLoadouts[
                            characterId
                        ].equippedSkills =
                            saved.equippedSkills;

                    }

                }

            });

        }


        normalizeHydratedRetiredSkillReferences();
        if(typeof window!=="undefined"&&typeof window.v17364NormalizeCrossElementEquips==="function"){
            window.v17364NormalizeCrossElementEquips();
        }


        /*
           è£å‚™è³‡æ–™
        */

        if(
            data.characterEquipment
        ){

            Object.keys(
                characterEquipment
            )
            .forEach(characterId=>{

                if(
                    data.characterEquipment[
                        characterId
                    ]
                ){

                    characterEquipment[
                        characterId
                    ] =
                        data
                        .characterEquipment[
                            characterId
                        ];

                }

            });

        }


        Object.keys(characterEquipment).forEach(function(characterId){
            normalizeEquipmentSlots(characterEquipment[characterId]);
        });

        /*
           èƒŒåŒ…è³‡æ–™
        */

        if(
            Array.isArray(
                data.inventoryItems
            )
        ){

            inventoryItems.length=0;


            data.inventoryItems
            .forEach(item=>{

                if(
                    item &&
                    item.id
                ){
                    migrateLegacyEquipmentStats(item);
                    inventoryItems.push(
                        item
                    );

                }

            });

        }


        normalizePotionInventoryFromLegacy(
            data
        );


        selectedCreationElement =
            data.selectedCreationElement ||
            player.element ||
            "fire";


        /*
           â˜… è®€æª”å¾Œé‡æ–°è¨ˆç®—HP/SPã€‚
        */

        const stats2 =
            getMainCharacterStats();


        if(
            !Number.isFinite(
                Number(player.hp)
            ) ||
            player.hp<=0
        ){

            player.hp =
                stats2.maxHP;

        }
        else{

            player.hp =
                Math.min(
                    Number(player.hp),
                    stats2.maxHP
                );

        }


        if(
            !Number.isFinite(
                Number(player.sp)
            ) ||
            player.sp<0
        ){

            player.sp =
                stats2.maxSP;

        }
        else{

            player.sp =
                Math.min(
                    Number(player.sp),
                    stats2.maxSP
                );

        }


        /*
           V137ï¼šè®€æª”åŽŸæœ¬åªæ ¡æ­£ä¸»è§’HP/SPï¼Œç¬¬äºŒã€ç¬¬ä¸‰è§’è‰²è‹¥æ˜¯èˆŠå­˜æª”
           ç¼ºæ¬„ä½ã€NaNæˆ–è¶…éŽè£å‚™å¾Œçš„æ–°ä¸Šé™ï¼Œè¦ç­‰åˆ°é€²æˆ°é¬¥æ‰æœƒè¢«ä¿®æ­£ï¼Œ
           è§’è‰²ï¼èƒŒåŒ…é åœ¨é‚£ä¹‹å‰å¯èƒ½é¡¯ç¤ºNaNæˆ–éŒ¯èª¤æ¯”ä¾‹ã€‚ä¸‰åè§’è‰²ä½¿ç”¨
           åŒä¸€å¥—è®€æª”æ­£è¦åŒ–è¦å‰‡ã€‚
        */
        [1,2].forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const stats=getPartyBattleStats(characterIndex);
            if(!character || !stats){ return; }

            character.hp=(
                !Number.isFinite(Number(character.hp)) ||
                Number(character.hp)<=0
            )
                ? stats.maxHP
                : Math.min(Number(character.hp),stats.maxHP);

            character.sp=(
                !Number.isFinite(Number(character.sp)) ||
                Number(character.sp)<0
            )
                ? stats.maxSP
                : Math.min(Number(character.sp),stats.maxSP);
        });


        /*
           â˜… æœ€é‡è¦ï¼š
           è®€æª”æˆåŠŸå¾Œæ˜Žç¢ºé¡¯ç¤ºéŠæˆ²ã€‚
        */

        $("creationPage")
            .style.display =
            "none";


        $("gameInterface")
            .style.display =
            "block";


        rebuildInventorySlots();

        updatePlayerHeader();


        /*
           â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œé‡æ–°æ•´ç†å¾Œä¸»åŸŽ
           æ¨™é¡Œåˆ—åˆè·‘å‡ºä¾†ã€çš„åŽŸå› ï¼‰ï¼š
           homePageåœ¨HTMLè£¡æ˜¯ç›´æŽ¥å¯«æ­»
           class="page active"ï¼Œè®€æª”æˆåŠŸ
           é¡¯ç¤ºéŠæˆ²ç•«é¢çš„é€™è£¡ï¼Œå¾žä¾†æ²’æœ‰çœŸçš„
           å‘¼å«éŽshowPage("home")ï¼Œå°Žè‡´
           ã€Œä¸»åŸŽ/ç·´åŠŸå€ä¸é¡¯ç¤ºæ¨™é¡Œåˆ—ã€é€™å€‹
           æ©Ÿåˆ¶ï¼ˆé showPage()è£¡åˆ‡æ›#appçš„
           no-headeré€™å€‹classï¼‰å¾žä¾†æ²’æœ‰
           æ©ŸæœƒåŸ·è¡Œåˆ°â€”â€”åªæœ‰çŽ©å®¶ä¹‹å¾Œæ‰‹å‹•é»žäº†
           å°Žè¦½åˆ—ã€çœŸçš„è§¸ç™¼ä¸€æ¬¡showPage()ï¼Œ
           æ¨™é¡Œåˆ—æ‰æœƒæ¶ˆå¤±ã€‚é€™è£¡è£œä¸Šï¼Œè®€æª”
           æˆåŠŸã€éŠæˆ²ç•«é¢é¡¯ç¤ºå‡ºä¾†çš„åŒæ™‚ï¼Œ
           å°±æ­£ç¢ºå¥—ç”¨ä¸€æ¬¡ã€‚        */

        showPage(
            "home"
        );


        updateUI();

        renderInventory();

        renderSkillLoadout();


        /*
           å­˜æˆæ–°ç‰ˆæ ¼å¼ï¼Œ
           è®“èˆŠè³‡æ–™å®Œæˆå‡ç´šã€‚
        */

        saveGame({source:"hydration-normalization"});


        return true;

    }
    catch(error){

        console.error(
            "è®€å–å­˜æª”å¤±æ•—ï¼š",
            error
        );


        return false;

    }

}


function showCreation(){

    $("gameInterface")
        .style.display =
        "none";


    $("creationPage")
        .style.display =
        "block";


    updateCreationUI();

    updateCreationScreenContext();

}


/* =====================================================
   æ¸…é™¤å­˜æª”
===================================================== */

async function resetGame(){

    if(
        typeof window.rpgConfirm!=="function" ||
        !await window.rpgConfirm(
            "ç¢ºå®šè¦åˆªé™¤è§’è‰²ä¸¦é‡æ–°å‰µå»ºå—Žï¼Ÿ",
            {
                title:"åˆªé™¤è§’è‰²",
                confirmText:"ç¢ºå®šåˆªé™¤",
                cancelText:"ä¿ç•™è§’è‰²",
                danger:true
            }
        )
    ){
        return;
    }

    deleteAllCharactersInProgress=true;

    if(autosaveIntervalId){
        clearInterval(autosaveIntervalId);
        autosaveIntervalId=null;
    }

    if(window.FourSymbolsAccountSave){ window.FourSymbolsAccountSave.removeActive(); }

    /* Abyss keeps a compatibility sidecar for pre-V173.64 saves. It belongs
       to the same single-player save and must be removed with the character. */
    try{
        const repository=window.FourSymbolsAccountSave;
        const uid=repository&&repository.getActiveUid();
        if(uid){ localStorage.removeItem(repository.accountKey("abyss-state",uid)); }
    }catch(_){ }

    creationTargetSlot=1;

    if(typeof window.allowGameNavigation==="function"){
        window.allowGameNavigation();
    }

    location.reload();

}


/* =====================================================
   V115 â€” å·¡æ€ªé å…§èƒŒåŒ…æµ®å±¤
   åªæ”¹é–‹å•Ÿæ–¹å¼ï¼›èƒŒåŒ…è³‡æ–™ã€è£å‚™ã€ç‰©å“è©³æƒ…ã€å‡ºå”®ç­‰ä»æ²¿ç”¨åŽŸå‡½å¼ã€‚
===================================================== */
let inventoryOpenContext=null;

function inventoryContextSnapshot(context){
    const sourcePage=String(context&&context.sourcePage||"map");
    return Object.freeze({
        sourcePage,
        returnAction:String(context&&context.returnAction||""),
        closeBehavior:String(context&&context.closeBehavior||"restore-source")
    });
}

function openInventoryContext(context){
    if(typeof battleActive!=="undefined"&&battleActive){ return false; }
    const normalized=inventoryContextSnapshot(context);
    showPage("inventory");
    inventoryOpenContext=normalized;
    const app=document.getElementById("app");
    if(app){ app.classList.add("inventory-context-open"); app.classList.remove("inventory-overlay-open"); }
    setMapInventoryScrollGate(true);
    return true;
}
window.openInventoryContext=openInventoryContext;

function setMapInventoryScrollGate(enabled){
    [
        document.documentElement,
        document.body,
        document.getElementById("game-viewport"),
        document.getElementById("game-stage")
    ].forEach(function(element){
        if(element){
            element.classList.toggle("inventory-scroll-active",!!enabled);
        }
    });
}

function openMapInventoryOverlay(context){
    return openInventoryContext(context);
}

function closeMapInventoryOverlay(){
    const context=inventoryOpenContext||inventoryContextSnapshot({sourcePage:"inventory"});
    inventoryOpenContext=null;
    const app=document.getElementById("app");
    if(app){ app.classList.remove("inventory-context-open","inventory-overlay-open"); }
    const inventoryPage=$("inventoryPage");

    if(typeof closeItemModal==="function"){
        closeItemModal();
    }
    if(typeof closeInventoryCharacterDetail==="function"){
        closeInventoryCharacterDetail();
    }

    if(context.sourcePage==="map"&&typeof leaveMap==="function"){
        leaveMap();
    }else if(["dungeon","gameplay","gameplayPage","boss","bossPage","tower","towerPage","training","trainingPage"].includes(context.sourcePage)){
        if(typeof showPage==="function"){
            const pageMap={dungeon:"gameplay",gameplay:"gameplay",gameplayPage:"gameplay",boss:"boss",bossPage:"boss",tower:"tower",towerPage:"tower",training:"training",trainingPage:"training"};
            showPage(pageMap[context.sourcePage]);
        }
    }else if(typeof showPage==="function"){
        showPage("home");
    }
}

/* =====================================================
   é é¢
===================================================== */

function showPage(page){

    if(page==="inventory"&&!inventoryOpenContext){
        inventoryOpenContext=inventoryContextSnapshot({sourcePage:"inventory",closeBehavior:"navigation"});
    }

    if(
        battleActive &&
        page!=="battle"
    ){
        return;
    }


    document
    .querySelectorAll(".page")
    .forEach(p=>{
        p.classList.remove(
            "active"
        );
    });


    const target =
        $(page+"Page");


    if(!target){
        return;
    }


    target.classList.add(
        "active"
    );

    /* Page activity is part of the Battle Reading Layer lifecycle. Clear a
       stale document-level paint suppressor synchronously after navigation. */
    if(typeof syncBattleUiPriorityLayer==="function"){
        syncBattleUiPriorityLayer();
    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ã€Œç·´åŠŸçªç„¶ä¸é‡æ€ªã€çš„åŽŸå› ï¼‰ï¼š
       ä¹‹å‰åªæœ‰é€éŽenterZone()ï¼ˆé‡æ–°é¸æ“‡/é€²å…¥
       ç·´åŠŸå€ï¼‰æ‰æœƒé‡æ–°æ•´ç†åœ°åœ–ä¸Šæ€ªç‰©åœ–ç¤ºçš„
       é¡¯ç¤ºç‹€æ…‹ï¼Œå–®ç´”ç”¨showPage("map")åˆ‡æ›
       é é¢å®Œå…¨ä¸æœƒåšé€™ä»¶äº‹ã€‚

       å¦‚æžœæ€ªç‰©å­˜æ´»ç‹€æ…‹è·Ÿç•«é¢åœ–ç¤ºé¡¯ç¤ºç‹€æ…‹
       åœ¨æŸå€‹æ™‚åºä¸‹ä¸å°å¿ƒå…œä¸èµ·ä¾†ï¼ˆä¾‹å¦‚å‰›æ‰“å®Œ
       ä¸€å ´æˆ°é¬¥ã€å›žåˆ°åœ°åœ–çš„é‚£å€‹çž¬é–“ï¼‰ï¼Œ
       å–®ç´”åˆ‡æ›é é¢å›žåœ°åœ–æ˜¯æ²’è¾¦æ³•ä¿®æ­£çš„â€”â€”
       åªæœ‰å›žé ­é‡æ–°é€²å…¥ç·´åŠŸå€æ‰æœƒå¼·åˆ¶é‡ç½®ï¼Œ
       é€™æ­£æ˜¯ã€Œäº‚åˆ‡é¸å–®æ‰åˆæ¢å¾©æ­£å¸¸ã€èƒŒå¾Œçš„
       çœŸæ­£åŽŸå› ï¼šä¸æ˜¯åˆ‡æ›æœ¬èº«æœ‰æ•ˆï¼Œæ˜¯åˆ‡æ›çš„
       é€”ä¸­å‰›å¥½é‡æ–°é€²å…¥äº†ç·´åŠŸå€ã€è§¸ç™¼äº†å®Œæ•´é‡ç½®ã€‚

       é€™è£¡ç›´æŽ¥è®“ã€Œåˆ‡æ›åˆ°åœ°åœ–é é¢ã€é€™å€‹å‹•ä½œï¼Œ
       æ¯æ¬¡éƒ½é †ä¾¿é‡æ–°åŒæ­¥ä¸€æ¬¡æ€ªç‰©åœ–ç¤ºçš„
       é¡¯ç¤ºç‹€æ…‹ï¼Œç¢ºä¿åªè¦çœ‹å¾—åˆ°åœ°åœ–ï¼Œ
       ç•«é¢ä¸Šé¡¯ç¤ºçš„æ€ªç‰©å°±ä¸€å®šè·Ÿå¯¦éš›è³‡æ–™ä¸€è‡´ï¼Œ
       ä¸ç”¨å†ç‰¹åœ°ç¹žåŽ»é‡æ–°é€²å…¥ç·´åŠŸå€æ‰èƒ½ä¿®æ­£ã€‚
    */

    if(
        page==="map"&&
        typeof updateMapMonsterIcons===
        "function"
    ){

        updateMapMonsterIcons();

    }


    /*
       â˜… æˆ°é¬¥ã€èƒŒåŒ…é é¢æ™‚éš±è—é ‚éƒ¨çš„è§’è‰²è³‡è¨Šåˆ—ï¼Œ
       å› ç‚ºé‚£äº›è³‡è¨Šï¼ˆç­‰ç´š/HP/SPï¼‰
       è·Ÿé€™å…©å€‹é é¢æœ¬èº«é¡¯ç¤ºçš„è§’è‰²è³‡è¨Šé‡è¤‡ï¼Œ
       çœä¸‹çš„ç©ºé–“è®“å…§å®¹å¯ä»¥å¤§ä¸€é»žã€‚
       ç”¨ #app çš„ no-header class
       çµ±ä¸€æŽ§åˆ¶ï¼Œä¹‹å¾Œå¦‚æžœé‚„æœ‰å…¶ä»–é é¢
       ä¹Ÿæƒ³æ‹¿æŽ‰é ‚éƒ¨åˆ—ï¼Œåªè¦æŠŠé ååŠ é€²
       hideHeaderPages é€™å€‹é™£åˆ—å°±å¥½ã€‚
    */

    const hideHeaderPages = [
        "battle",
        "inventory",
        "status",
        "skill",
        "home",
        "training",
        "dungeon",
        "gameplay",
        "boss",
        "tower"
    ];


    const appElement =
        $("app");


    if(appElement){

        if(
            hideHeaderPages.includes(
                page
            )
        ){

            appElement.classList.add(
                "no-header"
            );

        }
        else{

            appElement.classList.remove(
                "no-header"
            );

        }


        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–é é¢
           æ¨™é¡Œåˆ—ç²¾ç°¡æ¨¡å¼ï¼‰ï¼šåœ°åœ–é é¢ç¾åœ¨
           åªé¡¯ç¤ºåœ°åœ–åç¨±ä¸€è¡Œæ–‡å­—ï¼Œå…¶ä»–é é¢
           ï¼ˆæˆ°é¬¥/ç‹€æ…‹/æŠ€èƒ½/èƒŒåŒ…ï¼‰é‚„æ˜¯å®Œæ•´
           å…©è¡Œè§’è‰²è³‡è¨Šï¼Œåªåœ¨çœŸçš„åˆ‡åˆ°map
           é é¢æ™‚åŠ ä¸Šé€™å€‹classã€‚
        */

        appElement.classList.toggle(

            "map-header-compact",

            page==="map"

        );


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œä¸»åŸŽæ–°å¢ž
           ã€Œåˆæˆã€ã€Œç³»çµ±ã€è®Šæˆ3æŽ’å¡ç‰‡ï¼Œ
           åŽŸæœ¬ã€Œä¸èƒ½æ²å‹•ã€çš„é™åˆ¶åœ¨å…§å®¹è®Šå¤š
           ä¹‹å¾Œï¼Œé¢¨éšªæ˜¯æœƒæŠŠæ–°å¢žçš„ç¬¬3æŽ’å¡ç‰‡
           ç›´æŽ¥è£æŽ‰ã€å®Œå…¨çœ‹ä¸åˆ°â€”â€”é€™æ¯”ã€Œå¶çˆ¾
           éœ€è¦æ»‘ä¸€ä¸‹ã€åš´é‡å¾—å¤šã€‚æ”¹æˆåªæœ‰
           mapé é¢ç¶­æŒä¸èƒ½æ²å‹•ï¼ˆåœ°åœ–é é¢
           å…§å®¹é‡æ²’æœ‰è®Šã€ç¹¼çºŒé©ç”¨ï¼‰ï¼Œä¸»åŸŽ
           æ‹¿æŽ‰é€™å€‹é™åˆ¶ï¼Œæ”¹å›žå…è¨±æ²å‹•ï¼Œ
           ç¢ºä¿å…§å®¹è®Šå¤šçš„æ™‚å€™éƒ½çœ‹å¾—åˆ°ï¼Œ
           ä¸æœƒè¢«éœéœè£æŽ‰ã€‚
        */

        /*
           V89ï¼šä¸»åŸŽèˆ‡åœ°åœ–éƒ½å±¬æ–¼å›ºå®šç•«é¢ã€‚
           ä¸»åŸŽåŽŸæœ¬å› æ­·å²éœ€æ±‚è¢«æŽ’é™¤åœ¨ no-scroll-page ä¹‹å¤–ï¼Œ
           ä½†ç¾åœ¨ä¸»åŸŽå¡ç‰‡å·²èƒ½å®Œæ•´å¡žé€²å›ºå®šèˆžå°ï¼›é…åˆ #homePage
           ä¸å†ä½¿ç”¨ 100vhï¼Œæ­£å¼è®“ home/map éƒ½ä¸ç”¢ç”Ÿå¤–å±¤æ²å‹•ã€‚
        */
        appElement.classList.toggle(

            "no-scroll-page",

            page==="map" ||
            page==="home" ||
            page==="gameplay" ||
            page==="boss" ||
            page==="tower"

        );


        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–é é¢
           æ›æˆå°ˆå±¬çš„è§’è‰²/ä»»å‹™/è¿”å›žå°Žè¦½åˆ—ï¼‰ï¼š
        */

        appElement.classList.toggle(

            "on-map-page",

            page==="map"

        );


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œæ‹¿æŽ‰
           ä¸»åŸŽç«‹ç¹ªï¼‰ï¼šåŽŸæœ¬é€™è£¡æ¯æ¬¡åˆ‡åˆ°
           ä¸»åŸŽé é¢æœƒå‘¼å«showHomePortrait()
           éš¨æ©Ÿæ›ä¸€å¼µç«‹ç¹ªï¼Œåœ–ç‰‡æœ¬èº«è·Ÿç›¸é—œ
           å‡½å¼éƒ½å·²ç¶“æ•´æ®µç§»é™¤ï¼Œé€™å€‹å‘¼å«
           ä¸€ä½µæ‹¿æŽ‰ï¼Œä¸ç•™æ­»ä»£ç¢¼ã€‚
        */


        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           æˆ°é¬¥ä¸­æŠŠåº•éƒ¨ä¸»åŸŽ/ç·´åŠŸå€/ç‹€æ…‹/æŠ€èƒ½/èƒŒåŒ…
           é‚£æŽ’å°Žè¦½åˆ—ä¹Ÿä¸€ä½µè—èµ·ä¾†ï¼Œ
           æˆ°é¬¥æ™‚ç”¨ä¸åˆ°ï¼Œè—èµ·ä¾†å‰›å¥½å¤šå‡ºä¸€æˆªç©ºé–“ï¼Œ
           å°ã€Œä¸è¦æ²å‹•ã€é€™å€‹éœ€æ±‚ä¹Ÿæœ‰å¹«åŠ©ã€‚
           åªåœ¨battleé é¢è—ï¼Œå…¶ä»–é é¢
           ï¼ˆèƒŒåŒ…/ç‹€æ…‹/æŠ€èƒ½ï¼‰é‚„æ˜¯è¦çœ‹å¾—åˆ°å°Žè¦½åˆ—ï¼Œ
           ä¸ç„¶æ²’è¾¦æ³•åˆ‡æ›é é¢ã€‚
        */

        appElement.classList.toggle(
            "in-battle",
            page==="battle"
        );

        /*
           V78ï¼š
           åº•éƒ¨å°Žè¦½åˆ—ç›´æŽ¥é–‹å•Ÿçš„èƒŒåŒ…é ï¼Œ
           çœŸæ­£ scroll owner æ˜¯ .contentã€‚
        */
        appElement.classList.toggle(
            "on-inventory-page",
            page==="inventory"
        );

        /*
           V79 ROOT FIXï¼š
           ç›´æŽ¥ç”±åº•éƒ¨å°Žè¦½é€²èƒŒåŒ…æ™‚ï¼Œnative scroll owner æ˜¯ .contentã€‚
           åªæ”¹ .content çš„ touch-action ä¸å¤ ï¼Œå› ç‚º #game-viewport
           åœ¨ V5/V8 æž¶æ§‹ä¸­é•·æœŸä½¿ç”¨ touch-action:none éŽ–ä½æ•´å€‹éŠæˆ²ã€‚
           Android / Samsung Browser æœƒåœ¨æ‰‹å‹¢é–‹å§‹æ™‚æŠŠç¥–å…ˆ touch-action
           ä¸€èµ·ç´å…¥åˆ¤å®šï¼›å› æ­¤é€™è£¡æ²¿ç”¨ V64 å·²é©—è­‰çš„è§’è‰²è¦–çª—åšæ³•ï¼Œ
           åœ¨ã€ŒèƒŒåŒ…é å­˜åœ¨æœŸé–“ã€åŒæ­¥æ”¾è¡Œ html/body/viewport/stage çš„ pan-yã€‚
           é›¢é–‹èƒŒåŒ…ç«‹åˆ»ç§»é™¤ï¼Œä¸æ”¹åœ°åœ–ã€æˆ°é¬¥èˆ‡å…¶ä»–é é¢çš„æ‰‹å‹¢æ”¿ç­–ã€‚
        */
        const inventoryTouchMode =
            page==="inventory";

        [
            document.documentElement,
            document.body,
            document.getElementById("game-viewport"),
            document.getElementById("game-stage")
        ].forEach(function(element){
            if(!element){
                return;
            }
            element.classList.toggle(
                "inventory-scroll-active",
                inventoryTouchMode
            );
        });

    }


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æˆ°é¬¥è³‡è¨Šï¼è‡ªå‹•æˆ°é¬¥è¦†è“‹å±¤åªåœ¨ã€Œåœ°åœ–
       ï¼ˆå·¡é‚ï¼‰é é¢ã€é¡¯ç¤ºâ€”â€”æˆ°é¬¥é é¢æœ¬èº«
       å·²ç¶“æœ‰åŽŸæœ¬é‚£ä»½ï¼Œé€™è£¡é€™ä»½åªè² è²¬
       ã€Œé›¢é–‹æˆ°é¬¥ã€å›žåˆ°åœ°åœ–ä¹‹å¾Œé‚„èƒ½ç¹¼çºŒ
       çœ‹åˆ°ä¸Šä¸€å ´æˆ°é¬¥è³‡è¨Šã€é€™ä»¶äº‹ï¼Œ
       å…¶ä»–é é¢ï¼ˆä¸»åŸŽ/ç·´åŠŸå€é¸æ“‡/ç‹€æ…‹/
       æŠ€èƒ½/èƒŒåŒ…ï¼‰éƒ½ä¸éœ€è¦ï¼Œä¸€ä½µéš±è—ã€‚
    */

    const mapBattleOverlay=
        $("mapBattleOverlay");


    if(mapBattleOverlay){

        mapBattleOverlay.style.display=

            page==="map"
            ?
            "flex"
            :
            "none";

    }


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       é é¢åˆ‡æ›çš„ç•¶ä¸‹ï¼Œç«‹åˆ»é‡æ–°åˆ¤æ–·æœ€ä¸Šé¢
       æ¨™é¡Œåˆ—è¦é¡¯ç¤ºã€Œè§’è‰²è³‡è¨Šã€é‚„æ˜¯ã€Œåœ°åœ–+
       æ€ªç‰©è³‡è¨Šã€ï¼Œä¸ç”¨ç­‰ä¸‹ä¸€æ¬¡updateUI()
       æ‰ç”Ÿæ•ˆï¼Œåˆ‡éŽåŽ»çš„çž¬é–“å°±æ˜¯å°çš„ã€‚
    */

    updateMapPageHeader();


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼ŒçœŸæ­£æŠ“åˆ°
       ã€Œæ‰“å®Œä¸€å ´æˆ°é¬¥å›žåœ°åœ–ï¼Œå·¡æ€ªå‹•ç•«å°±å£žæŽ‰ã€
       åœ–ç‰‡è®Šå¤§ã€çš„åŽŸå› ï¼‰ï¼š
       åŽŸæœ¬åªæœ‰enterZone()â†’enterMap()é‚£æ¢è·¯å¾‘
       æœƒå‘¼å«resetPatrolCharacterToIdle()ï¼Œ
       ä½†winBattle()/loseBattle()/é€ƒè„«æˆåŠŸ
       ä¹‹å¾Œï¼Œéƒ½æ˜¯ç›´æŽ¥å‘¼å«showPage("map")
       è¿”å›žåœ°åœ–ï¼Œå®Œå…¨ç¹žéŽenterMap()â€”â€”å¦‚æžœ
       æˆ°é¬¥å‰›å¥½æ˜¯åœ¨å·¡æ€ªèµ°è·¯ä¸­ã€ç”šè‡³æ˜¯æ‰“æž¶
       ç‰¹æ•ˆæ”¾å¤§åˆ°120pxçš„é‚£ä¸€åˆ»è¢«è§¸ç™¼ï¼Œå›žä¾†
       å¾Œæ²’æœ‰ä»»ä½•æ±è¥¿æŠŠè§’è‰²åœ–ç¤ºçš„å°ºå¯¸ï¼
       ä½ç½®ï¼è¨ˆæ™‚å™¨é‡ç½®ä¹¾æ·¨ï¼Œæ‰æœƒçœ‹åˆ°åœ–ç‰‡
       äº‚è·³ã€äººç‰©è®Šå¤§ã€å·¡æ€ªä¸­æ¨™ç±¤æ¶ˆå¤±ã€‚

       æ”¹æˆåœ¨showPage()é€™è£¡çµ±ä¸€è™•ç†ï¼Œ
       ä¸ç®¡æ˜¯å¾žå“ªè£¡å‘¼å«showPage("map")ï¼Œ
       åªè¦åˆ‡åˆ°åœ°åœ–é é¢ï¼Œéƒ½æœƒä¾ç…§
       autoPatrolEnabledç›®å‰çš„ç‹€æ…‹ï¼Œ
       æ±ºå®šè¦ã€Œé‡æ–°é–‹å§‹èµ°è·¯ã€ï¼ˆå·¡æ€ªé‚„é–‹è‘—ï¼‰
       é‚„æ˜¯ã€Œå›žåˆ°ç½®ä¸­éœæ­¢ã€ï¼ˆå·¡æ€ªå·²ç¶“é—œäº†ï¼‰ï¼Œ
       å…©ç¨®æƒ…æ³éƒ½æœƒå…ˆæŠŠå°ºå¯¸/ä½ç½®é‡ç½®ä¹¾æ·¨ï¼Œ
       ä¸æœƒå†æ®˜ç•™ä»»ä½•ä¸Šä¸€å ´æˆ°é¬¥å‰çš„ç‹€æ…‹ã€‚
    */

    if(page==="map"){

        if(autoPatrolEnabled){

            startPatrolCharacterWalking();


            /*
               â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€Œæˆ°é¬¥å®Œå‡ºä¾†
               ç›´æŽ¥æ‰“æž¶å‹•ç•«ã€æ²’5ç§’åˆé€²æˆ°é¬¥ã€
               çš„åŽŸå› ï¼‰ï¼š
               è‡ªå‹•å·¡æ€ªçš„ã€Œæ¯5ç§’æª¢æŸ¥ä¸€æ¬¡ã€è¨ˆæ™‚å™¨
               ï¼ˆautoPatrolIntervalIdï¼‰ï¼ŒåŽŸæœ¬æ˜¯
               å¾žçŽ©å®¶æœ€æ—©æŒ‰ä¸‹ã€Œè‡ªå‹•å·¡æ€ªã€é‚£ä¸€åˆ»
               é–‹å§‹ç®—çš„å›ºå®šé€±æœŸï¼Œå®Œå…¨ä¸ç®¡ä¸­é–“
               æ‰“äº†å¹¾å ´æˆ°é¬¥ã€æ¯å ´æ‰“äº†å¤šä¹…â€”â€”
               æˆ°é¬¥ä¸­é€™å€‹è¨ˆæ™‚å™¨ç…§æ¨£åœ¨èƒŒæ™¯æ¯5ç§’
               è·³ä¸€æ¬¡ï¼ˆåªæ˜¯battleActive=true
               æœƒè®“å®ƒææ—©returnï¼Œä¸æœƒçœŸçš„åšäº‹ï¼‰ã€‚

               æˆ°é¬¥çµæŸã€å›žåˆ°åœ°åœ–çš„çž¬é–“ï¼Œå¦‚æžœ
               å‰›å¥½å¡åœ¨é€™å€‹è¨ˆæ™‚å™¨ã€Œé€™æ¬¡è¦è·³å‹•ã€
               çš„æ™‚é–“é»žé™„è¿‘ï¼Œå°±æœƒå¹¾ä¹Žæ˜¯æˆ°é¬¥ä¸€
               çµæŸé¦¬ä¸Šåˆè§¸ç™¼ä¸‹ä¸€æ¬¡æª¢æŸ¥â€”â€”å¯èƒ½
               åªé–“éš”é›¶é»žå¹¾ç§’ï¼Œå®Œå…¨è·Ÿé€™å ´æˆ°é¬¥
               æ‰“äº†å¤šä¹…ç„¡é—œï¼Œé€™æ‰æ˜¯ã€Œæ²’5ç§’åˆ
               é€²æˆ°é¬¥ã€çš„çœŸæ­£åŽŸå› ï¼Œä¸æ˜¯é‡è©¦
               é‚è¼¯çš„å•é¡Œã€‚

               ä¿®æ³•ï¼šæ¯æ¬¡çœŸçš„å›žåˆ°åœ°åœ–é é¢æ™‚ï¼Œ
               æŠŠé€™å€‹è¨ˆæ™‚å™¨æ¸…æŽ‰ã€é‡æ–°å•Ÿå‹•ä¸€å€‹
               æ–°çš„ï¼Œè®“ã€Œ5ç§’ã€ä¿è­‰æ˜¯å¾žã€Œå›žåˆ°
               åœ°åœ–çš„é€™ä¸€åˆ»ã€é–‹å§‹ç®—ï¼Œä¸æœƒå†
               æ²¿ç”¨æˆ°é¬¥å‰å°±å·²ç¶“åœ¨è·‘ã€è·Ÿé€™æ¬¡
               æˆ°é¬¥çµæŸæ™‚é–“é»žå®Œå…¨ç„¡é—œçš„èˆŠæ™‚é˜ã€‚
            */

            if(autoPatrolIntervalId){

                clearInterval(
                    autoPatrolIntervalId
                );

                autoPatrolIntervalId=null;

            }

            if(autoPatrolTimeoutId){

                clearTimeout(
                    autoPatrolTimeoutId
                );

                autoPatrolTimeoutId=null;

            }

            scheduleAutoPatrolCheck(5000);

        }
        else{

            resetPatrolCharacterToIdle();

        }

    }


    if(page==="skill"){
        renderSkillLoadout();
    }


    if(page==="inventory"){
        renderInventory();
    }


    /*
       â˜… æ–°å¢žï¼šå‰¯æœ¬/BOSSé é¢ä¸€é–‹å•Ÿå°±é¡¯ç¤º
       ç¬¬ä¸€å€‹åˆ†é çš„å…§å®¹ï¼Œä¸ç”¨çŽ©å®¶è‡ªå·±
       å…ˆé»žä¸€æ¬¡åˆ†é æŒ‰éˆ•æ‰çœ‹å¾—åˆ°æ±è¥¿ã€‚
    */

    if(page==="dungeon"){

        switchDungeonTab(
            "daily"
        );

    }


    if(page==="boss"){

        switchBossTab(
            "personal"
        );

    }


    updateUI();
    if(typeof window.v148SyncContextNavigation==="function"){
        window.v148SyncContextNavigation();
    }else{ window.FourSymbolsBottomNav?.syncContext(); }

}


/* =====================================================
   åœ°åœ–
===================================================== */

/*
   â˜… ç·´åŠŸå€åˆ‡æ›ã€‚

   ä¹‹å‰ã€Œè’æ¼ åœ°å¸¶ã€åªæ˜¯è¦æ ¼æ›¸è£¡çš„éŽ–ä½ä½”ä½å¡ï¼Œ
   å®Œå…¨æ²’æœ‰çœŸæ­£çš„åœ°åœ–è·Ÿæ€ªç‰©è³‡æ–™ã€‚
   ç¾åœ¨è£œä¸Šï¼šé”åˆ°Lv.11å°±èƒ½çœŸçš„é€²åŽ»ï¼Œ
   æ€ªç‰©æ›æˆdesertMonstersï¼ˆæ˜Žé¡¯æ¯”æ–°æ‰‹æ£®æž—ç¡¬ï¼‰ï¼Œ
   æ–¹ä¾¿æ¸¬è©¦ç‡ƒç‡’ä¹‹é¡žéœ€è¦æ€ªç‰©æ’ä¹…ä¸€é»žæ‰çœ‹å¾—å‡ºæ•ˆæžœçš„æŠ€èƒ½ã€‚
*/

/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚æ–°å¢ž5å€‹å€åŸŸå¾Œï¼Œ
   æ”¹ç”¨è³‡æ–™é©…å‹•çš„æ–¹å¼æ•´ç†ï¼Œé¿å…æ¯åŠ ä¸€å€‹
   å€åŸŸå°±è¦åœ¨å¥½å¹¾å€‹å‡½å¼è£¡å„è‡ªè¤‡è£½è²¼ä¸Š
   ä¸€æ®µå¹¾ä¹Žä¸€æ¨£çš„ifåˆ¤æ–·ï¼Œä¹‹å¾Œè¦å†åŠ 
   ç¬¬9ã€10å€ä¹Ÿåªè¦åœ¨é€™ä»½æ¸…å–®è£¡åŠ ä¸€ç­†ï¼‰ã€‚
*/

const zoneConfig = {

    forest:{
        requiredLevel:0,
        monsters:()=>forestMonsters,
        title:"æ–°æ‰‹æ£®æž—",
        desc:"Lv.1ï½ž10ï½œä¸€èˆ¬ç·´åŠŸå€æœ€å¤š6éš»æ€ªç‰©",
        levelRange:"Lv.1ï½ž10"
    },

    desert:{
        requiredLevel:11,
        monsters:()=>desertMonsters,
        title:"è’æ¼ åœ°å¸¶",
        desc:"Lv.11ï½ž20ï½œæ€ªç‰©æ˜Žé¡¯è¼ƒå¼·ï¼Œé©åˆæ¸¬è©¦æŠ€èƒ½æ•ˆæžœ",
        levelRange:"Lv.11ï½ž20"
    },

    ice:{
        requiredLevel:21,
        monsters:()=>iceMountainMonsters,
        title:"å†°éœœå±±è„ˆ",
        desc:"Lv.21ï½ž30ï½œæ€ªç‰©é–‹å§‹æœ‰å±¬æ€§ã€æœƒæ–½æ”¾æŠ€èƒ½",
        levelRange:"Lv.21ï½ž30"
    },

    zone4:{
        requiredLevel:31,
        monsters:()=>zone4Monsters,
        title:"ç†”å²©æ·±æ·µ",
        desc:"Lv.31ï½ž40ï½œæ€ªç‰©æŠ€èƒ½1å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡55%",
        levelRange:"Lv.31ï½ž40"
    },

    zone5:{
        requiredLevel:41,
        monsters:()=>zone5Monsters,
        title:"å·¨ç¸è’åŽŸ",
        desc:"Lv.41ï½ž50ï½œæ€ªç‰©æŠ€èƒ½2å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡60%",
        levelRange:"Lv.41ï½ž50"
    },

    zone6:{
        requiredLevel:51,
        monsters:()=>zone6Monsters,
        title:"ä¿®ç¾…æˆ°å ´",
        desc:"Lv.51ï½ž60ï½œæ€ªç‰©æŠ€èƒ½2å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡65%",
        levelRange:"Lv.51ï½ž60"
    },

    zone7:{
        requiredLevel:61,
        monsters:()=>zone7Monsters,
        title:"é­”å›ç¥­å£‡",
        desc:"Lv.61ï½ž70ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡65%",
        levelRange:"Lv.61ï½ž70"
    },

    zone8:{
        requiredLevel:71,
        monsters:()=>zone8Monsters,
        title:"é¾ç„æ·±æ·µ",
        desc:"Lv.71ï½ž80ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡70%",
        levelRange:"Lv.71ï½ž80"
    },

    zone9:{
        requiredLevel:81,
        monsters:()=>zone9Monsters,
        title:"è™›ç©ºç›¡é ­",
        desc:"Lv.81ï½ž90ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡70%",
        levelRange:"Lv.81ï½ž90"
    },

    zone10:{
        requiredLevel:91,
        monsters:()=>zone10Monsters,
        title:"çµ‚ç„‰ä¹‹å¢ƒ",
        desc:"Lv.91ï½ž100ï½œæ€ªç‰©æŠ€èƒ½3å€‹ï¼Œæ–½æ”¾æ©ŸçŽ‡70%",
        levelRange:"Lv.91ï½ž100"
    }

};


function enterZone(zoneName){

    if(battleActive){
        return;
    }


    const config=
        zoneConfig[zoneName];


    if(!config){
        return;
    }


    if(player.level<config.requiredLevel){

        alert(
            "éœ€è¦é”åˆ° Lv."+
            config.requiredLevel+
            "æ‰èƒ½é€²å…¥"+
            config.title.replace(
                /^\S+\s/,
                ""
            )+
            "ã€‚"
        );

        return;

    }


    currentZone=
        zoneName;


    monsters=
        config.monsters();


    monsters.forEach(
        monster=>{

            monster.alive=true;

            monster.hp=
                monster.maxHP;

            monster.sp=
                monster.maxSP;

            monster.statusEffects=[];

        }
    );


    updateMapZoneLabels();

    updateMapMonsterIcons();

    enterMap();

}


function updateMapZoneLabels(){

    const title =
        $("mapPageTitle");


    const desc =
        $("mapPageDesc");


    /*
       â˜… ä¿®æ­£ï¼ˆæ”¹ç”¨zoneConfigçµ±ä¸€ç®¡ç†ï¼Œ
       ä¸ç”¨å†æ¯åŠ ä¸€å€‹å€åŸŸå°±è¤‡è£½è²¼ä¸Š
       ä¸€æ•´æ®µif-elseï¼‰ã€‚
    */

    const config=

        zoneConfig[currentZone]
        ||
        zoneConfig.forest;


    if(title){

        title.textContent=
            config.title;

    }


    if(desc){

        desc.textContent=
            config.desc;

    }

}


function updateMapMonsterIcons(){

    /*
       â˜… ä¿®æ­£ï¼ˆåœ°åœ–é‡æ–°è¨­è¨ˆï¼‰ï¼š
       åŽŸæœ¬ç›´æŽ¥ç”¨element.textContentå¯«å…¥emojiï¼Œ
       ä½†ç¾åœ¨æ€ªç‰©å¡ç‰‡å…§éƒ¨æ”¹æˆ
       icon/name/levelä¸‰å€‹ç¨ç«‹çš„å­å…ƒç´ ï¼Œ
       è¦åˆ†åˆ¥å¯«å…¥å°æ‡‰çš„æ¬„ä½ï¼Œ
       ä¸èƒ½å†æ•´å€‹è“‹æŽ‰ï¼ˆé‚£æ¨£åç¨±è·Ÿç­‰ç´šéƒ½æœƒæ¶ˆå¤±ï¼‰ã€‚
    */

    monsters.forEach(
        (monster,index)=>{

            const element =
                $("mapMonster"+index);


            if(!element){
                return;
            }


            const icon =
                monster.name==="æ²™æ¼ è±ºç‹¼"
                ?
                ""
                :
                monster.name==="æ²™è "
                ?
                ""
                :
                monster.name==="å²èŠå§†"
                ?
                ""
                :
                "";


            const iconEl=
                element.querySelector(
                    ".map-monster-icon"
                );


            const nameEl=
                element.querySelector(
                    ".map-monster-name"
                );


            const levelEl=
                element.querySelector(
                    ".map-monster-level"
                );


            if(iconEl){

                iconEl.textContent=
                    icon;

            }


            if(nameEl){

                nameEl.textContent=
                    monster.name;

            }


            if(levelEl){

                levelEl.textContent=
                    "Lv."+
                    monster.level;

            }


            /*
               â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œåœ°åœ–ä¸å†
               é¡¯ç¤ºæ€ªç‰©åœ–ç¤ºï¼Œæ”¹æˆå›ºå®šæ™‚é–“è‡ªå‹•
               è§¸ç™¼æˆ°é¬¥ï¼‰ï¼š
               é€™è£¡åŽŸæœ¬è² è²¬ä¾å­˜æ´»ç‹€æ…‹åˆ‡æ›åœ–ç¤º
               é¡¯ç¤º/éš±è—ï¼Œä½†ç¾åœ¨æ•´å€‹.map-monster
               å·²ç¶“åœ¨CSSè£¡æ°¸ä¹…è¨­æˆdisplay:noneï¼Œ
               ä¸éœ€è¦å†ç”±JSé€™è£¡å¦å¤–æŽ§åˆ¶é¡¯ç¤ºç‹€æ…‹ï¼Œ
               ä¹Ÿä¸èƒ½å†è¨­inlineçš„displayï¼Œ
               ä¸ç„¶è¡Œå…§æ¨£å¼çš„å„ªå…ˆæ¬Šæœƒè“‹æŽ‰CSSçš„
               display:noneï¼Œè®“åœ–ç¤ºåˆè·‘å‡ºä¾†ã€‚
               é€™è£¡åªä¿ç•™ä¸Šé¢icon/name/level
               æ–‡å­—å…§å®¹çš„æ›´æ–°ï¼ˆé›–ç„¶åœ–ç¤ºä¸æœƒé¡¯ç¤ºï¼Œ
               ä½†ä¿ç•™é€™éƒ¨åˆ†é‚è¼¯ä»¥é˜²ä¹‹å¾Œåˆè¦
               é‡æ–°å•Ÿç”¨ï¼‰ï¼Œæ‹¿æŽ‰displayçš„è¨­å®šã€‚
            */

        }
    );

}


/*
   â˜… æ›´æ–°ç·´åŠŸå€åˆ—è¡¨é é¢è£¡ï¼Œè’æ¼ åœ°å¸¶é‚£å¼µå¡ç‰‡çš„
   éŽ–å®šç‹€æ…‹è·ŸæŒ‰éˆ•ã€‚
   é”åˆ°Lv.11ä¹‹å¾Œå¡ç‰‡æœƒè§£éŽ–ã€é¡¯ç¤ºã€Œé€²å…¥åœ°åœ–ã€æŒ‰éˆ•ï¼Œ
   åœ¨é€™ä¹‹å‰ä¿æŒåŽŸæœ¬éŽ–ä½çš„æ¨£å­ã€‚
*/

function updateTrainingZoneLocks(){

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œç·´åŠŸå€æ”¹ç‰ˆï¼Œ
       ç´”æ–‡å­—åˆ—è¡¨å–ä»£å¡ç‰‡ï¼‰ï¼š
       åŽŸæœ¬æ“ä½œçš„æ˜¯å¡ç‰‡è£¡çš„.map-descæ–‡å­—/
       æŒ‰éˆ•å€å¡Šï¼Œé€™äº›å…ƒç´ å·²ç¶“ä¸å­˜åœ¨äº†ã€‚
       æ”¹æˆå–®ç´”åˆ‡æ›.training-zone-itemçš„
       .lockedé€™å€‹classï¼ˆç´”CSSèª¿æš—ï¼Œ
       ä¸éš±è—æ–‡å­—æœ¬èº«ï¼Œé»žä¸‹åŽ»é‚„æ˜¯èƒ½çœ‹
       è³‡è¨Šæ¡†ã€åªæ˜¯è³‡è¨Šæ¡†è£¡çš„é€²å…¥æŒ‰éˆ•æœƒè¢«
       æ›æˆã€Œéœ€è¦Lv.Xã€çš„æç¤ºï¼Œé‚è¼¯ç§»åˆ°
       openTrainingZoneInfo()è£¡è™•ç†ï¼‰ï¼Œ
       é€™è£¡åªè² è²¬ã€Œæ–‡å­—è¦ä¸è¦èª¿æš—ã€é€™ä»¶äº‹ã€‚

       idå°ç…§æ²¿ç”¨æ–°HTMLè£¡çš„
       trainingZoneItem_deserté€™ç¨®å‘½å
       è¦å‰‡ã€‚
    */

    const lockableZones=[

        {key:"desert",itemId:"trainingZoneItem_desert"},        {key:"ice",itemId:"trainingZoneItem_ice"},
        {key:"zone4",itemId:"trainingZoneItem_zone4"},
        {key:"zone5",itemId:"trainingZoneItem_zone5"},
        {key:"zone6",itemId:"trainingZoneItem_zone6"},
        {key:"zone7",itemId:"trainingZoneItem_zone7"},
        {key:"zone8",itemId:"trainingZoneItem_zone8"},
        {key:"zone9",itemId:"trainingZoneItem_zone9"},
        {key:"zone10",itemId:"trainingZoneItem_zone10"}

    ];


    lockableZones.forEach(entry=>{

        const config=
            zoneConfig[entry.key];


        const item=
            $(entry.itemId);


        if(
            !config ||
            !item
        ){
            return;
        }


        item.classList.toggle(

            "locked",

            player.level<
            config.requiredLevel

        );

    });

}


/*
   â˜… ç¬¬äºŒè§’è‰²è§£éŽ–æç¤ºã€‚
   Lv.10ä¹‹å¾Œã€é‚„æ²’å‰µå»ºç¬¬äºŒè§’è‰²æ™‚é¡¯ç¤ºï¼Œ
   å‰µå»ºå®Œæˆå¾Œå°±ä¸æœƒå†é¡¯ç¤ºé€™å¼µå¡ç‰‡äº†ã€‚
*/

function updateSecondCharacterBanner(){

    const banner=
        $("secondCharacterBanner");


    if(!banner){
        return;
    }


    banner.style.display=

        (
            player.level>=10 &&
            !player2
        )
        ?
        "block"
        :
        "none";

}


function enterMap(){

    if(battleActive){
        return;
    }


    showPage("map");


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå·¡æ€ªé é¢
       èƒŒæ™¯ä¾åœ°å€å‹•æ…‹åˆ‡æ›ï¼‰ï¼šæ¯æ¬¡é€²å…¥
       åœ°åœ–é é¢ï¼Œå¥—ç”¨ç›®å‰é€™å€‹åœ°å€
       ï¼ˆcurrentZoneï¼‰å°æ‡‰çš„èƒŒæ™¯åœ–ã€‚
    */

    applyMapZoneBackground(
        currentZone
    );


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯æ¬¡é€²å…¥åœ°åœ–é é¢ï¼Œå·¡æ€ªè§’è‰²åœ–ç¤ºå›žåˆ°
       ç½®ä¸­éœæ­¢ã€æ­£é¢åœ–çš„é è¨­ç‹€æ…‹â€”â€”ä¸ç®¡
       ä¸Šä¸€æ¬¡é›¢é–‹åœ°åœ–æ™‚èµ°åˆ°å“ªã€è‡ªå‹•å·¡æ€ª
       é–‹è‘—é‚„é—œè‘—ï¼Œé€™è£¡éƒ½é‡æ–°æ­¸é›¶ã€‚
    */

    resetPatrolCharacterToIdle();


    /*
       â˜… æ¯æ¬¡é€²åœ°åœ–ï¼ŒçŽ©å®¶æ£‹ç›¤åº§æ¨™é‡ç½®å›žä¸­å¤®ï¼Œ
       è·Ÿéš¨æ–¹å¡Šçš„è·¯å¾‘ç´€éŒ„ä¹Ÿä¸€ä½µæ¸…ç©ºï¼Œ
       é¿å…å¸¶è‘—ä¸Šæ¬¡æ®˜ç•™çš„ä½ç½®è³‡æ–™ã€‚
    */

    playerGridCol=5;

    playerGridRow=5;

    playerPathHistory=[
        {col:5,row:5}
    ];


    const playerEl=
        $("mapPlayer");


    if(playerEl){

        const pos=
            gridCellToPercent({
                col:5,
                row:5
            });


        playerEl.style.left=
            pos.x+"%";


        playerEl.style.top=
            pos.y+"%";

    }


    updateMapPlayerCard();

    updateFollowerPosition();


    startMonsterMovement();

}


function leaveMap(){

    if(!exitPatrolContext("leave-map")){
        return;
    }

    showPage("training");

}


/* =====================================================
   è‡ªå‹•å·¡æ€ª
===================================================== */

/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
   ã€Œè‡ªå‹•å·¡æ€ªã€è·Ÿã€Œè‡ªå‹•æˆ°é¬¥ã€æ˜¯å…©ä»¶ç¨ç«‹çš„äº‹ï¼š
   è‡ªå‹•æˆ°é¬¥æŽ§åˆ¶çš„æ˜¯ã€Œæˆ°é¬¥é–‹å§‹ä¹‹å¾Œï¼Œè§’è‰²è¦ä¸è¦
   è‡ªå‹•å‡ºæ‰‹ã€ï¼›è‡ªå‹•å·¡æ€ªæŽ§åˆ¶çš„æ˜¯ã€Œæˆ°é¬¥å¤–ï¼Œ
   è¦ä¸è¦è‡ªå‹•åŽ»æ‰¾æ€ªç‰©æ‰“ã€ã€‚å…©è€…äº’ä¸ä¾è³´ï¼Œ
   å¯ä»¥åªé–‹ä¸€å€‹ï¼Œä¹Ÿå¯ä»¥å…©å€‹éƒ½é–‹ã€‚

   å¯¦ä½œä¸Šå¾ˆå–®ç´”ï¼šæŒ‰ä¸‹åŽ»ä¹‹å¾Œï¼Œæ¯4ç§’æª¢æŸ¥ä¸€æ¬¡
   ç›®å‰åœ°åœ–ä¸Šï¼ˆmonsters[0]~monsters[MAX_
   TRAINING_MONSTERS-1]ï¼‰é‚„æœ‰æ²’æœ‰æ´»è‘—çš„æ€ªç‰©ï¼Œ
   æœ‰çš„è©±ç›´æŽ¥å‘¼å«startBattle()å°ç¬¬ä¸€éš»æ´»è‘—çš„
   æ€ªç‰©é–‹æˆ°â€”â€”ä¸ç”¨çœŸçš„æ¨¡æ“¬çŽ©å®¶åœ¨åœ°åœ–ä¸Šèµ°éŽåŽ»ï¼Œ
   å–®ç´”åªæ˜¯ã€Œå®šæœŸè‡ªå‹•è§¸ç™¼æˆ°é¬¥ã€ã€‚

   å¦‚æžœç›®å‰å·²ç¶“åœ¨æˆ°é¬¥ä¸­ï¼ˆbattleActiveï¼‰ï¼Œ
   é€™æ¬¡æª¢æŸ¥å°±è·³éŽã€ä»€éº¼éƒ½ä¸åšï¼Œç­‰ä¸‹ä¸€æ¬¡
   4ç§’å¾Œå†æª¢æŸ¥â€”â€”æˆ°é¬¥çµæŸå¾Œï¼Œä¸‹ä¸€æ¬¡æª¢æŸ¥
   è‡ªç„¶å°±æœƒæŠ“åˆ°é‚„æ´»è‘—çš„æ€ªç‰©ç¹¼çºŒæ‰“ï¼Œ
   ä¸éœ€è¦é¡å¤–è™•ç†ã€Œæˆ°é¬¥çµæŸå¾Œè¦ä¸è¦æ¢å¾©ã€ï¼Œ
   setIntervalæœ¬ä¾†å°±æœƒä¸€ç›´æ¯4ç§’åŸ·è¡Œä¸€æ¬¡ã€‚
*/

let autoPatrolEnabled=
    false;

let autoPatrolIntervalId=
    null;

/*
   â˜… æœ€çµ‚ä¿®æ­£ï¼šè‡ªå‹•å·¡æ€ªæ”¹ç”¨ã€Œå–®æ¬¡5ç§’æŽ’ç¨‹ + è‡ªæˆ‘çºŒæŽ’ã€
   å–ä»£å–®ç´”ä¾è³´setIntervalã€‚
   é€™ä»ç„¶ç¶­æŒåŽŸæœ¬ã€Œæ¯5ç§’æª¢æŸ¥ä¸€æ¬¡ã€çš„éŠæˆ²æ©Ÿåˆ¶ï¼Œ
   ä½†æˆ°é¬¥åˆ‡é ã€æ‰‹æ©ŸèƒŒæ™¯å–šé†’ã€è¨ˆæ™‚å™¨è¢«æ¸…é™¤ç­‰æƒ…æ³ä¸‹ï¼Œ
   ä¸‹ä¸€æ¬¡æª¢æŸ¥æœƒé‡æ–°å»ºç«‹ï¼Œä¸æœƒå› è¨ˆæ™‚å™¨å¤±æ•ˆè€Œæ°¸ä¹…åœæ­¢ã€‚
*/
let autoPatrolTimeoutId=
    null;


/*
   â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå·¡æ€ªèµ°è·¯å‹•ç•«ï¼‰ï¼š
   å››å¼µåœ–åˆ†åˆ¥æ˜¯ï¼šéœæ­¢/å¾€ä¸‹èµ°ç”¨çš„æ­£é¢åœ–ã€
   å¾€ä¸Šèµ°ç”¨çš„èƒŒé¢åœ–ã€é€²å…¥æˆ°é¬¥å‰ç‰¹æ•ˆç”¨çš„
   å…©å¼µæ‰“æž¶åœ–ï¼Œå…¨éƒ¨è½‰æˆbase64å…§åµŒï¼Œ
   å–®ä¸€HTMLæª”æ¡ˆä¸ä¾è³´å¤–éƒ¨åœ–ç‰‡è·¯å¾‘ã€‚
*/

const PATROL_CHAR_FRONT_B64="assets/characters/patrol-character.png";

const PATROL_CHAR_BACK_B64="assets/characters/patrol-back.png";

const PATROL_FIGHT1_B64="assets/battle/patrol-fight-1-v173.21.webp";

const PATROL_FIGHT2_B64="assets/battle/patrol-fight-2-v173.21.webp";

/*
   Patrol artwork bridge:
   - js/26-v131-patrol-appearance.js is the formal appearance owner.
   - Core patrol lifecycle may request front/back facing, but must not replace
     the selected character's gender/element artwork once that owner is ready.
   - The legacy PNG pair remains only as a pre-feature fallback.
*/
function applyPatrolCharacterArtwork(facingBack){

    const img=
        $("patrolCharacterImg");

    if(!img){
        return false;
    }

    img.style.transform=
        "none";

    if(
        typeof window!=="undefined" &&
        typeof window.v131ApplyPatrolArt==="function"
    ){

        window.v131ApplyPatrolArt(
            !!facingBack
        );

        return true;

    }

    img.src=
        facingBack
        ? PATROL_CHAR_BACK_B64
        : PATROL_CHAR_FRONT_B64;

    return false;

}



let patrolWalkIntervalId=
    null;

let patrolCurrentTop=
    37;

/*
   â˜… é˜²æ­¢ã€Œæ­£åœ¨æ’­æ”¾æ‰“æž¶ç‰¹æ•ˆã€çš„ç•¶ä¸‹ï¼Œ
   å‰›å¥½è¢«å·¡æ€ªèµ°è·¯çš„è¨ˆæ™‚å™¨æ‰“æ–·ã€æŠŠç•«é¢
   æ›å›žæ­£é¢/èƒŒé¢åœ–â€”â€”è¦‹
   movePatrolCharacterRandomly()é–‹é ­
   çš„åˆ¤æ–·ã€‚
*/

let patrolInFightAnimation=
    false;

let patrolFightAnimTimeoutIds=
    [];

/*
   â˜… æ–°å¢žï¼šæ‰¾åˆ°æ€ªç‰©ã€æ­£åœ¨æ’­1ç§’é˜æ‰“æž¶ç‰¹æ•ˆã€
   ä½†çœŸæ­£çš„startBattle()é‚„æ²’è¢«å‘¼å«çš„é€™æ®µ
   ç©ºæª”ï¼Œæ“‹æŽ‰runAutoPatrolCheck()é‡è¤‡è§¸ç™¼ã€‚
   è¦‹runAutoPatrolCheck()é–‹é ­çš„åˆ¤æ–·ã€‚
*/

let patrolBattleTransitionPending=
    false;

let patrolLifecycleGeneration=
    0;

function isPatrolMapActive(){
    const mapPageElement=$("mapPage");
    return !!(
        mapPageElement &&
        mapPageElement.classList.contains("active")
    );
}


/*
   â˜… é€²å…¥åœ°åœ–é é¢æ™‚ï¼ˆenterZone()ï¼
   showPage()åˆ‡åˆ°mapçš„æ™‚å€™ï¼‰å‘¼å«ï¼Œ
   è®“è§’è‰²å›žåˆ°ã€Œéœæ­¢ç½®ä¸­ã€æ­£é¢åœ–ã€çš„
   é è¨­ç‹€æ…‹ï¼Œä¸ç®¡ä¹‹å‰å·¡æ€ªèµ°åˆ°å“ªè£¡åŽ»äº†ã€‚
*/

function resetPatrolCharacterToIdle(){

    patrolFightAnimTimeoutIds.forEach(
        id=>clearTimeout(id)
    );

    patrolFightAnimTimeoutIds=
        [];

    patrolInFightAnimation=
        false;

    patrolBattleTransitionPending=
        false;


    const wrap=
        $("patrolCharacterWrap");

    const img=
        $("patrolCharacterImg");

    const label=
        $("patrolCharacterLabel");


    if(wrap){

        wrap.style.left=
            "50%";

        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œè·Ÿ
           movePatrolCharacterRandomly()
           çš„22%~52%æ–°ç¯„åœä¿æŒä¸€è‡´ï¼‰ï¼š
           åŽŸæœ¬50%å·²ç¶“è¶…å‡ºæ–°çš„ç§»å‹•ç¯„åœï¼Œ
           æ”¹æˆæ–°ç¯„åœçš„ä¸­é–“å€¼ï¼ˆ37%ï¼‰ï¼Œ
           éœæ­¢ç‹€æ…‹çš„ä½ç½®ä¹Ÿæœƒè½åœ¨åˆç†ç¯„åœ
           å…§ï¼Œä¸æœƒä¸€é–‹å§‹å°±è²¼è¿‘æˆ°é¬¥è³‡è¨Šæ¡†ã€‚
        */

        wrap.style.top=
            "37%";

    }


    if(img){

        img.style.width=
            "70px";

        applyPatrolCharacterArtwork(
            false
        );

    }


    if(label){

        label.style.display=
            "none";

    }


    patrolCurrentTop=
        37;

}


/*
   â˜… å·¡æ€ªèµ°è·¯ï¼šæ¯éš”ä¸€æ®µæ™‚é–“æ›ä¸€å€‹éš¨æ©Ÿåº§æ¨™ï¼Œ
   é€éŽCSS transitionè‡ªç„¶ç§»å‹•éŽåŽ»ï¼›è·ŸèˆŠåº§æ¨™
   æ¯”è¼ƒYè»¸ï¼ˆtopï¼‰ï¼Œè®Šå°ï¼å¾€ä¸Šèµ°ï¼æ›èƒŒé¢åœ–ï¼Œ
   è®Šå¤§æˆ–ä¸è®Šï¼å¾€ä¸‹èµ°ï¼åŽŸåœ°ï¼æ›æ­£é¢åœ–ã€‚
*/

function movePatrolCharacterRandomly(){

    if(patrolInFightAnimation){
        return;
    }


    const wrap=
        $("patrolCharacterWrap");

    const img=
        $("patrolCharacterImg");


    if(
        !wrap ||
        !img
    ){
        return;
    }


    const newLeft=
        20+
        Math.random()*60;

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå·¡æ€ª
       äººç‰©ä¸è¦è¶…å‡ºæˆ°é¬¥è³‡è¨Šçš„ä¸Šç·£ã€ï¼‰ï¼š
       åœ°åœ–é é¢ä¸‹æ–¹çš„è‡ªå‹•æˆ°é¬¥/è‡ªå‹•å·¡æ€ª/
       æˆ°é¬¥è³‡è¨Šé‚£å€‹å€å¡Šæ˜¯position:fixed
       è²¼åœ¨èž¢å¹•åº•éƒ¨çš„ï¼Œè·Ÿé€™è£¡ç”¨ã€Œç›¸å°
       #mapPageé«˜åº¦çš„ç™¾åˆ†æ¯”ã€åœ¨ç§»å‹•çš„
       å·¡æ€ªè§’è‰²ï¼Œå…©è€…çš„åº§æ¨™ç³»çµ±åŽŸæœ¬æ²’æœ‰
       å°é½Šâ€”â€”åŽŸæœ¬56%çš„ç§»å‹•ç¯„åœï¼Œå¾ˆå®¹æ˜“
       ç®—åˆ°è²¼è¿‘æˆ–è“‹éŽé‚£å€‹å›ºå®šå€å¡Šçš„ä¸Šç·£ã€‚
       ç¯„åœå¾ž22%~78%æ”¶çª„æˆ22%~52%ï¼Œ
       ç¢ºä¿è§’è‰²ç§»å‹•çš„æœ€ä½Žé»žé‚„æ˜¯ç•™åœ¨
       æˆ°é¬¥è³‡è¨Šæ¡†ä¸Šç·£ä¹‹ä¸Šï¼Œä¸æœƒç–Šåˆ°ã€‚
    */

    const newTop=
        22+
        Math.random()*30;

    const movingUp=
        newTop<patrolCurrentTop;


    applyPatrolCharacterArtwork(
        movingUp
    );


    wrap.style.left=
        newLeft+"%";

    wrap.style.top=
        newTop+"%";


    patrolCurrentTop=
        newTop;

}


function startPatrolCharacterWalking(){

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼‰ï¼š
       æ¯æ¬¡çœŸæ­£é–‹å§‹èµ°è·¯ä¹‹å‰ï¼Œå…ˆæŠŠå¯èƒ½æ®˜ç•™
       çš„æ‰“æž¶ç‰¹æ•ˆç‹€æ…‹æ¸…ä¹¾æ·¨ï¼ˆå°ºå¯¸æ”¾å¤§åˆ°
       120pxã€é‚„æ²’æ’­å®Œçš„ç‰¹æ•ˆè¨ˆæ™‚å™¨ï¼‰ï¼Œ
       ä¸ç„¶å‰›å¥½åœ¨ç‰¹æ•ˆæ’­æ”¾ä¸­è¢«å«å›žé€™è£¡
       ï¼ˆä¾‹å¦‚æˆ°é¬¥å‰›çµæŸã€å›žåˆ°åœ°åœ–æ™‚ï¼‰ï¼Œ
       è§’è‰²æœƒå¡åœ¨æ”¾å¤§çš„æ¨£å­ç¹¼çºŒèµ°ã€‚
    */

    patrolFightAnimTimeoutIds.forEach(
        id=>clearTimeout(id)
    );

    patrolFightAnimTimeoutIds=
        [];

    patrolInFightAnimation=
        false;

    patrolBattleTransitionPending=
        false;


    const img=
        $("patrolCharacterImg");


    if(img){

        img.style.width=
            "70px";

    }


    const label=
        $("patrolCharacterLabel");


    if(label){

        label.style.display=
            "inline-block";

    }


    movePatrolCharacterRandomly();


    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

    }


    patrolWalkIntervalId=
        setInterval(
            movePatrolCharacterRandomly,
            2200
        );

}


function stopPatrolCharacterWalking(){

    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

        patrolWalkIntervalId=
            null;

    }


    resetPatrolCharacterToIdle();

}


/*
   â˜… é€²å…¥æˆ°é¬¥å‰1ç§’é˜çš„æ‰“æž¶ç‰¹æ•ˆï¼šå…©å¼µåœ–
   å„é¡¯ç¤º0.5ç§’ã€éœæ­¢ä¸å‹•ï¼ˆä¸ç”¨CSSå‹•ç•«ï¼Œ
   å–®ç´”æ›åœ–ï¼‰ï¼Œæ’­å®Œå‘¼å«callback
   ï¼ˆrunAutoPatrolCheck()é‚£é‚ŠæœƒæŽ¥
   startBattle()ï¼‰ã€‚
*/

function playPatrolFightAnimation(callback){

    patrolInFightAnimation=
        true;


    const img=
        $("patrolCharacterImg");

    const label=
        $("patrolCharacterLabel");


    if(label){

        label.style.display=
            "none";

    }


    if(img){

        img.style.width=
            "120px";

        img.style.transform=
            "none";

        img.src=
            PATROL_FIGHT1_B64;

    }


    const t1=
        setTimeout(()=>{

            patrolFightAnimTimeoutIds=
                patrolFightAnimTimeoutIds.filter(id=>id!==t1);

            if(img){

                img.style.transform=
                    "none";

                img.src=
                    PATROL_FIGHT2_B64;

            }

        },500);


    const t2=
        setTimeout(()=>{

            patrolFightAnimTimeoutIds=
                patrolFightAnimTimeoutIds.filter(id=>id!==t2);

            patrolInFightAnimation=
                false;


            if(img){

                img.style.width=
                    "70px";

                applyPatrolCharacterArtwork(
                    false
                );

            }


            if(callback){

                callback();

            }

        },1000);


    patrolFightAnimTimeoutIds.push(
        t1,
        t2
    );

}


function toggleAutoPatrol(){

    autoPatrolEnabled=
        !autoPatrolEnabled;


    const button=
        $("autoPatrolButton");


    if(autoPatrolEnabled){

        if(button){

            button.textContent=
                "â¹ åœæ­¢å·¡æ€ª";

            button.classList.add(
                "active"
            );

        }


        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå·¡æ€ª
           é é¢å·¦ä¸Šè§’æ–°å¢žå°æŒ‰éˆ•ï¼Œå·¡æ€ªå¿«æ·
           é–‹å•Ÿ/åœæ­¢ã€ï¼‰ï¼š
           è·Ÿä¸Šé¢autoPatrolButtonåŒä¸€å¥—é‚è¼¯ï¼Œ
           åŒæ­¥æ›´æ–°å·¦ä¸Šè§’é€™é¡†å°å¿«æ·éˆ•ã€‚
        */

        const quickPatrolBtn=
            $("quickAutoPatrolToggle");


        if(quickPatrolBtn){

            /*
               â˜… ä¿®æ­£ï¼ˆé…åˆå¿«æ·éˆ•æ”¹æˆç´”åœ–ç¤ºéˆ•ï¼‰ï¼š
               ä¸èƒ½å†å¯«textContentï¼ŒæœƒæŠŠè£¡é¢
               é–‹/é—œå…©å¼µ<img>æ´—æŽ‰ï¼Œæ”¹æˆåªåˆ‡æ›
               activeé€™å€‹classï¼ˆCSSæœƒè‡ªå‹•æ±ºå®š
               é¡¯ç¤ºå“ªä¸€å¼µåœ–ï¼‰ï¼Œæ–‡å­—èªªæ˜Žæ”¹æ”¾åˆ°
               aria-labelã€‚
            */

            quickPatrolBtn.setAttribute(
                "aria-label",
                "è‡ªå‹•å·¡æ€ªï¼ˆé–‹å•Ÿä¸­ï¼‰"
            );

            quickPatrolBtn.classList.add(
                "active"
            );

        }


        scheduleAutoPatrolCheck(5000);


        /*
           â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           æŒ‰ä¸‹é–‹å§‹å·¡æ€ªçš„åŒæ™‚ï¼Œè®“è§’è‰²é–‹å§‹
           åœ¨åœ°åœ–ä¸Šèµ°å‹•ã€‚
        */

        startPatrolCharacterWalking();


        addBattleLog(
            "è‡ªå‹•å·¡æ€ªé–‹å§‹ï¼Œ"+
            "æ¯5ç§’è‡ªå‹•å°‹æ‰¾æ€ªç‰©æˆ°é¬¥ã€‚"
        );

    }
    else{

        stopAutoPatrol();

    }

}


function stopAutoPatrol(){

    autoPatrolEnabled=
        false;

    patrolLifecycleGeneration++;


    if(autoPatrolIntervalId){

        clearInterval(
            autoPatrolIntervalId
        );

        autoPatrolIntervalId=
            null;

    }

    if(autoPatrolTimeoutId){

        clearTimeout(
            autoPatrolTimeoutId
        );

        autoPatrolTimeoutId=
            null;

    }


    const button=
        $("autoPatrolButton");


    if(button){

        button.textContent=
            "â–¶ å•Ÿå‹•";

        button.classList.remove(
            "active"
        );

    }


    /*
       â˜… æ–°å¢žï¼šè·Ÿä¸Šé¢toggleAutoPatrol()è£¡
       é–‹å•Ÿæ™‚çš„æ›´æ–°æ˜¯åŒä¸€çµ„ï¼Œé€™è£¡æ˜¯é—œé–‰
       ç‹€æ…‹çš„åŒæ­¥ã€‚
    */

    const quickPatrolBtn=
        $("quickAutoPatrolToggle");


    if(quickPatrolBtn){

        quickPatrolBtn.setAttribute(
            "aria-label",
            "è‡ªå‹•å·¡æ€ªï¼ˆé—œé–‰ï¼‰"
        );

        quickPatrolBtn.classList.remove(
            "active"
        );

    }


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       åœæ­¢å·¡æ€ªçš„åŒæ™‚ï¼Œè®“è§’è‰²åœä¸‹ä¾†ã€
       å›žåˆ°ç½®ä¸­éœæ­¢çš„æ­£é¢åœ–ç‹€æ…‹ã€‚
    */

    stopPatrolCharacterWalking();

}


function exitPatrolContext(reason){

    if(battleActive){
        return false;
    }

    stopMonsterMovement();
    stopAutoPatrol();

    if(typeof window!=="undefined"){
        window.v173PatrolLastExitReason=String(reason||"unknown");
    }

    return true;
}

if(typeof window!=="undefined"){
    window.FourSymbolsPatrolLifecycle=Object.freeze({
        exit:exitPatrolContext,
        isActive:function(){
            return autoPatrolEnabled&&isPatrolMapActive();
        }
    });
}


function runAutoPatrolCheck(){

    /*
       â˜… é™¤éŒ¯ç”¨ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œè¿½è¹¤
       ã€Œæˆ°é¬¥çµæŸå›žåœ°åœ–å¾Œï¼Œè‡ªå‹•å·¡æ€ªæ²’æœ‰
       ç¹¼çºŒã€çš„åŽŸå› ï¼‰ï¼šå°å‡ºæ¯æ¬¡é€™å€‹å‡½å¼è¢«
       å‘¼å«æ™‚ï¼Œä¸‰å€‹é—œéµæ——æ¨™çš„ç•¶ä¸‹ç‹€æ…‹ã€‚
       å¦‚æžœæˆ°é¬¥çµæŸå¾Œé€™è¡Œå®Œå…¨ä¸å†å‡ºç¾ï¼Œ
       ä»£è¡¨setIntervalæœ¬èº«åœäº†ï¼›å¦‚æžœæœ‰
       å‡ºç¾ã€ä½†æŸå€‹æ——æ¨™å¡åœ¨ä¸è©²æœ‰çš„å€¼ï¼Œ
       å°±èƒ½ç›´æŽ¥çœ‹å‡ºæ˜¯å“ªå€‹æ——æ¨™çš„å•é¡Œã€‚
    */

    addBattleLog(
        "runAutoPatrolCheckï¼Œ"+
        "autoPatrolEnabled="+
        autoPatrolEnabled+
        "ï¼ŒbattleActive="+
        battleActive+
        "ï¼ŒpatrolBattleTransitionPending="+
        patrolBattleTransitionPending+
        "ï¼ŒmapCooldown="+
        mapCooldown
    );


    /*
       é˜²å‘†ï¼šå¦‚æžœäººå·²ç¶“ä¸åœ¨åœ°åœ–é é¢äº†
       ï¼ˆä¾‹å¦‚æ‰‹å‹•é»žäº†é›¢é–‹åœ°åœ–ï¼Œä½†å› ç‚ºæŸç¨®
       åŽŸå› stopAutoPatrol()æ²’è¢«å‘¼å«åˆ°ï¼‰ï¼Œ
       é€™è£¡é¡å¤–æ“‹ä¸€æ¬¡ï¼Œä¸æœƒåœ¨åˆ¥çš„é é¢
       æ†‘ç©ºè§¸ç™¼æˆ°é¬¥ã€‚

       patrolBattleTransitionPendingï¼š
       å·²ç¶“æ‰¾åˆ°æ€ªç‰©ã€æ­£åœ¨æ’­1ç§’é˜æ‰“æž¶ç‰¹æ•ˆã€
       ä½†çœŸæ­£çš„startBattle()é‚„æ²’è¢«å‘¼å«çš„
       é€™æ®µç©ºæª”ï¼ŒbattleActiveé‚„æ˜¯falseï¼Œ
       å¦‚æžœä¸é¡å¤–æ“‹ä¸€æ¬¡ï¼Œå‰›å¥½ç¢°ä¸Šä¸‹ä¸€æ¬¡
       setIntervalè§¸ç™¼ï¼Œæœƒé‡è¤‡æ‰¾æ€ªç‰©ã€
       é‡è¤‡æ’­ç‰¹æ•ˆã€‚
    */

    if(
        !autoPatrolEnabled ||
        battleActive ||
        patrolBattleTransitionPending
    ){
        return;
    }


    /*
       â˜… é—œéµä¿®æ­£ï¼š
       mapCooldown=true æ™‚ã€Œåªèƒ½è·³éŽæœ¬æ¬¡æª¢æŸ¥ã€ï¼Œ
       çµ•å°ä¸èƒ½å‘¼å« stopAutoPatrol()ã€‚

       å¦‚æžœ cooldown æ²’æœ‰ä»»ä½•è§£é™¤è¨ˆæ™‚å™¨ï¼Œä»£è¡¨
       æŸæ¢æˆ°é¬¥çµæŸè·¯å¾‘éºæ¼äº†è§£é™¤æŽ’ç¨‹ï¼›æ­¤æ™‚åœ¨
       ç¢ºèªå·²ä¸åœ¨æˆ°é¬¥ã€ä¹Ÿæ²’æœ‰é€²æˆ°é¬¥éŽæ¸¡å¾Œï¼Œ
       ç›´æŽ¥æ¸…æŽ‰é€™å€‹æ®˜ç•™æ——æ¨™ï¼Œé¿å…è‡ªå‹•å·¡æ€ªæ°¸ä¹…å¡ä½ã€‚
    */
    if(mapCooldown){

        if(!mapCooldownTimeoutId){

            mapCooldown=false;

            addBattleLog(
                "åµæ¸¬åˆ°æ®˜ç•™mapCooldownï¼Œè‡ªå‹•è§£é™¤ï¼Œå·¡æ€ªç¹¼çºŒã€‚"
            );

        }
        else{

            /*
               cooldownæœŸé–“åªæ˜¯ä¸é–‹æˆ°ï¼Œä¸æ˜¯åœæ­¢å·¡æ€ªã€‚
               ç¢ºä¿å†·å»æœŸé–“çµæŸå¾Œä»æœƒæœ‰ä¸‹ä¸€æ¬¡æª¢æŸ¥ã€‚
            */
            scheduleAutoPatrolCheck(5000);

            return;

        }

    }


    if(
        !isPatrolMapActive()
    ){

        stopAutoPatrol();

        return;

    }


    /*
       â˜… è‡ªå‹•å·¡æ€ªæ——æ¨™ä»ç‚ºtrueæ™‚ï¼Œé€™è£¡ç¢ºä¿
       ä¸‹ä¸€å€‹5ç§’æª¢æŸ¥è¨ˆæ™‚å™¨å­˜åœ¨ã€‚
    */
    ensureAutoPatrolInterval();


    for(
        let i=0;
        i<MAX_TRAINING_MONSTERS;
        i++
    ){

        const monster=
            monsters[i];


        if(
            monster &&
            monster.alive
        ){

            /*
               â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
               æ‰¾åˆ°æ€ªç‰©ä¸å†ç›´æŽ¥é–‹æˆ°ï¼Œå…ˆæ’­
               1ç§’é˜çš„æ‰“æž¶ç‰¹æ•ˆå‹•ç•«ï¼ˆå…©å¼µåœ–
               å„0.5ç§’ï¼‰ï¼Œæ’­å®Œæ‰çœŸæ­£å‘¼å«
               startBattle()â€”â€”è¦–è¦ºä¸Šåƒæ˜¯
               ã€Œè§’è‰²å·¡é‚é€”ä¸­é‡åˆ°æ€ªç‰©ã€
               æ‰“èµ·ä¾†äº†ï¼Œç•«é¢æ‰åˆ‡é€²æˆ°é¬¥ã€ã€‚
            */

            patrolBattleTransitionPending=
                true;

            const transitionGeneration=
                patrolLifecycleGeneration;


            playPatrolFightAnimation(
                ()=>{

                    patrolBattleTransitionPending=
                        false;

                    if(
                        transitionGeneration!==patrolLifecycleGeneration ||
                        !autoPatrolEnabled ||
                        !isPatrolMapActive()
                    ){                        return;
                    }

                    /*
                       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œ
                       ä¸Šä¸€ç‰ˆçš„å¿«é€Ÿé‡è©¦æ”¹éŽé ­äº†ï¼‰ï¼š
                       ä¹‹å‰åœ¨é€™è£¡åŠ äº†ã€ŒmapCooldown
                       ä¸€è§£é™¤å°±ç«‹åˆ»é‡è©¦ã€çš„é‚è¼¯ï¼Œ
                       çµæžœè®Šæˆæˆ°é¬¥çµæŸã€3ç§’ä¿è­·æœŸ
                       ä¸€éŽé¦¬ä¸Šåˆé€²ä¸‹ä¸€å ´ï¼Œå®Œå…¨æ²’æœ‰
                       ã€Œå·¡é‚èµ°5ç§’å†é‡æ•µã€çš„ç¯€å¥æ„Ÿï¼Œ
                       æ•´å€‹5ç§’é€±æœŸçš„è¨­è¨ˆç­‰æ–¼è¢«æž¶ç©ºã€‚

                       æ‹¿æŽ‰é‚£æ®µè¼ªè©¢ï¼Œæ”¹å›žå–®ç´”ï¼š
                       é€™æ¬¡å¦‚æžœè¢«mapCooldownæ“‹ä¸‹ï¼Œ
                       å°±è®“å®ƒæ“‹ä¸‹ï¼Œå®‰åˆ†ç­‰ä¸‹ä¸€æ¬¡
                       5ç§’çš„setIntervalè‡ªç„¶å†æª¢æŸ¥
                       ä¸€æ¬¡å°±å¥½ï¼Œä¸å¼·è¡Œæ’éšŠã€‚
                    */

                    startBattle(i);

                    /*
                       å¦‚æžœé€™æ¬¡é€²å…¥æˆ°é¬¥è¢«å…¶ä»–ä¿è­·æ¢ä»¶æ“‹ä¸‹ï¼Œ
                       ä¸èƒ½è®“è‡ªå‹•å·¡æ€ªå› æ­¤å¤±åŽ»ä¸‹ä¸€æ¬¡æª¢æŸ¥ã€‚
                    */
                    if(
                        autoPatrolEnabled &&
                        !battleActive
                    ){

                        scheduleAutoPatrolCheck(5000);

                    }

                }
            );

            return;

        }

    }

    /*
       é€™æ¬¡æ²’æœ‰æ´»æ€ªå¯æ‰“ï¼ˆä¾‹å¦‚æ€ªç‰©æ­£åœ¨2ç§’é‡ç”Ÿï¼‰ï¼Œ
       ä»ç„¶è¦ä¿ç•™ä¸‹ä¸€å€‹5ç§’å·¡æ€ªæª¢æŸ¥ã€‚
    */
    scheduleAutoPatrolCheck(5000);

}


/* =====================================================
   â˜… åœ°åœ–é‡æ–°è¨­è¨ˆï¼šæ£‹ç›¤èµ°ä½ç³»çµ±

   æŠŠåœ°åœ–åˆ‡æˆ10x10çš„æ ¼å­ï¼ˆæ¯æ ¼=10%å¯¬é«˜ï¼‰ï¼Œ
   çŽ©å®¶çš„åº§æ¨™ä¸å†æ˜¯ä»»æ„åƒç´ /ç™¾åˆ†æ¯”ï¼Œ
   è€Œæ˜¯ã€Œç¬¬å¹¾æ ¼ã€ç¬¬å¹¾åˆ—ã€é€™ç¨®æ£‹ç›¤åº§æ¨™ã€‚

   é»žæ“Šåœ°åœ–æ™‚ï¼Œä¸å†æ˜¯ç›´æŽ¥æŠŠçŽ©å®¶çž¬é–“è²¼åˆ°
   é»žæ“Šçš„ä½ç½®ï¼Œè€Œæ˜¯å…ˆç®—å‡ºä¸€æ¢ã€Œä¸€æ ¼ä¸€æ ¼èµ°éŽåŽ»ã€
   çš„è·¯å¾‘ï¼Œç„¶å¾Œæ­é…CSSçš„0.22ç§’transitionï¼Œ
   ä¸€æ­¥ä¸€æ­¥çœŸæ­£èµ°éŽåŽ»ï¼Œçœ‹èµ·ä¾†æ‰åƒåœ¨ç§»å‹•ï¼Œ
   ä¸æ˜¯çž¬é–“ç§»å‹•ã€‚

   ç¬¬äºŒè§’è‰²ï¼ˆå­˜åœ¨çš„è©±ï¼‰ä¸æœƒè‡ªå·±èµ°ï¼Œ
   æ˜¯è·Ÿåœ¨ç¬¬ä¸€è§’è‰²å¾Œé¢çš„ã€Œè·Ÿéš¨æ–¹å¡Šã€ï¼Œ
   è®€å–çŽ©å®¶æœ€è¿‘èµ°éŽçš„è·¯å¾‘ç´€éŒ„ï¼Œ
   æ…¢å€‹å¹¾æ­¥è·ŸéŽåŽ»ï¼Œåƒè·Ÿç­è·Ÿè‘—éšŠé•·ï¼Œ
   ä¸æ˜¯è‡ªå·±äº‚è·‘çš„ç¨ç«‹è§’è‰²ã€‚
===================================================== */

const MAP_GRID_SIZE=10;

let playerGridCol=5;

let playerGridRow=5;

let isPlayerWalking=false;

let playerPathHistory=[
    {col:5,row:5}
];


function percentToGridCell(x,y){

    return {

        col:
            Math.max(
                0,
                Math.min(
                    MAP_GRID_SIZE-1,
                    Math.floor(
                        x/MAP_GRID_SIZE
                    )
                )
            ),

        row:
            Math.max(
                0,
                Math.min(
                    MAP_GRID_SIZE-1,
                    Math.floor(
                        y/MAP_GRID_SIZE
                    )
                )
            )

    };

}


function gridCellToPercent(cell){

    return {

        x:
            cell.col*MAP_GRID_SIZE+
            MAP_GRID_SIZE/2,

        y:
            cell.row*MAP_GRID_SIZE+
            MAP_GRID_SIZE/2

    };

}


/*
   ä¸€æ­¥ä¸€æ­¥é€¼è¿‘çµ‚é»žçš„ç°¡å–®è·¯å¾‘ç”Ÿæˆ
   ï¼ˆé€™å¼µåœ°åœ–ç›®å‰æ²’æœ‰éšœç¤™ç‰©ï¼Œ
   æ‰€ä»¥ç”¨æœ€ç›´æŽ¥çš„ã€Œæ¯æ­¥åŒæ™‚ä¿®æ­£æ©«å‘/ç¸±å‘ã€
   èµ°æ³•å°±å¤ äº†ï¼Œæ–œç·šæœ€çŸ­è·¯å¾‘ï¼Œ
   ä¹‹å¾Œå¦‚æžœåœ°åœ–åŠ äº†éšœç¤™ç‰©è¦ç¹žè·¯ï¼Œ
   é€™å€‹å‡½å¼å¯ä»¥å†æ›æˆæ­£å¼çš„A*ä¹‹é¡žçš„æ¼”ç®—æ³•ï¼‰ã€‚
*/

function buildGridPath(start,end){

    const path=[];

    let col=start.col;

    let row=start.row;

    let guard=0;


    while(
        (
            col!==end.col ||
            row!==end.row
        ) &&
        guard<40
    ){

        if(col<end.col){
            col++;
        }
        else if(col>end.col){
            col--;
        }


        if(row<end.row){
            row++;
        }
        else if(row>end.row){
            row--;
        }


        path.push({
            col:col,
            row:row
        });


        guard++;

    }


    return path;

}


function movePlayer(event){

    /*
       â˜… mapCooldown åªç”¨ä¾†æ“‹ã€Œè§¸ç™¼æ–°æˆ°é¬¥ã€ï¼Œ
       ä¸æ“‹ç§»å‹•æœ¬èº«ï¼Œé‚£å€‹åˆ¤æ–·åœ¨
       checkMapDistance() è£¡é¢å·²ç¶“æœ‰è™•ç†ã€‚
    */

    if(
        battleActive ||
        isPlayerWalking
    ){
        return;
    }


    if(
        event.target.closest(
            ".map-monster"
        )
    ){
        return;
    }


    const map =
        $("gameMap");


    const rect =
        map.getBoundingClientRect();

    /*
       èž¢å¹• Pointer/Touâ€‹â€‹ch åº§æ¨™å…ˆè½‰æˆ
       1080Ã—1920 è™›æ“¬éŠæˆ²åº§æ¨™ï¼Œå†åšåœ°åœ–åˆ¤å®šã€‚
       ä¸ç›´æŽ¥æŠŠ clientX/clientY ç•¶æˆéŠæˆ²åº§æ¨™ã€‚
    */

    const point =
        gamePointFromClient(
            event.clientX,
            event.clientY
        );

    const mapTopLeft =
        gamePointFromClient(
            rect.left,
            rect.top
        );

    const mapBottomRight =
        gamePointFromClient(
            rect.right,
            rect.bottom
        );

    const virtualMapWidth =
        mapBottomRight.x-mapTopLeft.x;

    const virtualMapHeight =
        mapBottomRight.y-mapTopLeft.y;

    let x =
        (
            point.x-mapTopLeft.x
        )/
        virtualMapWidth*
        100;


    let y =
        (
            point.y-mapTopLeft.y
        )/
        virtualMapHeight*
        100;


    x=
        Math.max(
            0,
            Math.min(
                100,
                x
            )
        );


    y=
        Math.max(
            0,
            Math.min(
                100,
                y
            )
        );


    const targetCell=
        percentToGridCell(
            x,
            y
        );


    const path=
        buildGridPath(
            {
                col:playerGridCol,
                row:playerGridRow
            },
            targetCell
        );


    if(path.length===0){
        return;
    }


    walkPlayerPath(
        path
    );

}


/*
   æŠŠæ•´æ¢è·¯å¾‘æ‹†æˆä¸€æ­¥ä¸€æ­¥èµ°ï¼Œ
   æ¯ä¸€æ­¥ä¹‹é–“é–“éš”240msï¼Œ
   è®“çŽ©å®¶çœ‹å¾—å‡ºä¾†è§’è‰²æ˜¯çœŸçš„åœ¨ç§»å‹•ï¼Œ
   ä¸æ˜¯çž¬é–“è²¼éŽåŽ»ã€‚
*/

function walkPlayerPath(path){

    isPlayerWalking=true;


    let i=0;


    function stepNext(){

        if(battleActive){

            isPlayerWalking=false;

            return;

        }


        if(i>=path.length){

            isPlayerWalking=false;


            const finalPos=
                gridCellToPercent({
                    col:playerGridCol,
                    row:playerGridRow
                });


            checkMapDistance(
                finalPos.x,
                finalPos.y
            );


            return;

        }


        const cell=
            path[i++];


        playerGridCol=
            cell.col;


        playerGridRow=
            cell.row;


        const pos=
            gridCellToPercent(
                cell
            );


        const playerEl=
            $("mapPlayer");


        if(playerEl){

            playerEl.style.left=
                pos.x+"%";


            playerEl.style.top=
                pos.y+"%";

        }


        playerPathHistory.unshift({
            col:cell.col,
            row:cell.row
        });


        if(
            playerPathHistory.length>6
        ){

            playerPathHistory.pop();

        }


        updateFollowerPosition();


        setTimeout(
            stepNext,
            240
        );

    }


    stepNext();

}


/*
   â˜… ç¬¬äºŒè§’è‰²è·Ÿéš¨æ–¹å¡Šçš„ä½ç½®æ›´æ–°ã€‚
   ä¸æ˜¯å³æ™‚è²¼åœ¨çŽ©å®¶æ—é‚Šï¼Œ
   è€Œæ˜¯è®€ã€ŒçŽ©å®¶å¹¾æ­¥ä¹‹å‰èµ°éŽçš„ä½ç½®ã€ï¼Œ
   æ¨¡æ“¬è·Ÿåœ¨å¾Œé¢èµ°çš„æ„Ÿè¦ºï¼Œ
   ä¸æœƒè·Ÿç¬¬ä¸€è§’è‰²é‡ç–Šåœ¨åŒä¸€æ ¼ã€‚
*/

function updateFollowerPosition(){

    if(!player2){
        return;
    }


    const followerEl=
        $("mapFollower");


    if(!followerEl){
        return;
    }


    const laggedCell=

        playerPathHistory[
            Math.min(
                2,
                playerPathHistory.length-1
            )
        ];


    if(!laggedCell){
        return;
    }


    const pos=
        gridCellToPercent(
            laggedCell
        );


    followerEl.style.left=
        pos.x+"%";


    followerEl.style.top=
        pos.y+"%";

}


/*
   â˜… æ›´æ–°åœ°åœ–ä¸ŠçŽ©å®¶å¡ç‰‡ã€è·Ÿéš¨æ–¹å¡Šçš„
   åå­—/ç­‰ç´š/åœ–ç¤ºé¡¯ç¤ºï¼Œ
   é€²åœ°åœ–ã€å‡ç´šä¹‹å¾Œéƒ½è¦å‘¼å«é€™è£¡åˆ·æ–°ä¸€æ¬¡ã€‚
*/

function updateMapPlayerCard(){

    const nameEl=
        $("mapPlayerName");


    const levelEl=
        $("mapPlayerLevel");


    const iconEl=
        $("mapPlayerIcon");


    if(nameEl){

        nameEl.textContent=

            player.id||
            "çŽ©å®¶";

    }


    if(levelEl){

        levelEl.textContent=

            "Lv."+
            player.level;

    }


    if(iconEl){

        iconEl.textContent=

            elementDatabase[
                player.element
            ]
            ?
            elementDatabase[
                player.element
            ].icon
            :
            "";

    }


    const followerEl=
        $("mapFollower");


    const followerIdEl=
        $("mapFollowerId");


    const followerLevelEl=
        $("mapFollowerLevel");


    if(followerEl){

        followerEl.style.display=

            player2
            ?
            "flex"
            :
            "none";

    }


    if(player2){

        if(followerIdEl){

            followerIdEl.textContent=
                player2.id;

        }


        if(followerLevelEl){

            followerLevelEl.textContent=

                "Lv."+
                player2.level;

        }

    }

}


function checkMapDistance(px,py){

    if(
        battleActive ||
        mapCooldown
    ){
        return;
    }


    for(
        let i=0;
        i<MAX_TRAINING_MONSTERS;
        i++
    ){

        const monster =
            monsters[i];


        if(
            !monster ||
            !monster.alive
        ){
            continue;
        }


        const distance =
            Math.hypot(
                px-monster.x,
                py-monster.y
            );


        if(distance<16){

            startBattle(i);

            return;

        }

    }

}


/* =====================================================
   â˜… è‡ªå‹•å·¡æ€ªï¼åœ°åœ–å†·å»çµ±ä¸€ç®¡ç†

   mapCooldown æ˜¯ã€Œä¸èƒ½ç«‹åˆ»é–‹ä¸‹ä¸€å ´æˆ°é¬¥ã€çš„
   ä¿è­·æœŸï¼Œä¸æ˜¯ã€Œåœæ­¢è‡ªå‹•å·¡æ€ªã€ã€‚
   æ‰€æœ‰æˆ°é¬¥çµæŸè·¯å¾‘éƒ½é€éŽé€™å€‹å‡½å¼è§£é™¤ï¼Œ
   é¿å…ä¸åŒçµç®—è·¯å¾‘å„è‡ª setTimeout é€ æˆ
   cooldown ç‹€æ…‹ä¸åŒæ­¥ã€‚
===================================================== */

function setMapCooldown(duration){

    if(mapCooldownTimeoutId){

        clearTimeout(
            mapCooldownTimeoutId
        );

        mapCooldownTimeoutId=null;

    }


    mapCooldown=true;


    if(!duration || duration<=0){

        mapCooldown=false;

        return;

    }


    mapCooldownTimeoutId=
        setTimeout(()=>{

            mapCooldown=false;

            mapCooldownTimeoutId=null;

        },duration);

}


/*
   â˜… é˜²å‘†ï¼šè‡ªå‹•å·¡æ€ªé–‹è‘—ã€å·²ç¶“å›žåˆ°åœ°åœ–ã€
   ä¹Ÿæ²’æœ‰æ­£åœ¨æˆ°é¬¥ï¼é€²æˆ°é¬¥éŽæ¸¡æ™‚ï¼Œ
   ç¢ºä¿5ç§’å·¡æ€ªè¨ˆæ™‚å™¨å­˜åœ¨ã€‚
*/
function scheduleAutoPatrolCheck(delay=5000){

    /*
       â˜… æœ€çµ‚ä¿®æ­£ï¼šè‡ªå‹•å·¡æ€ªçš„ã€ŒæŽ’ç¨‹ç”Ÿå‘½é€±æœŸã€ä¸èƒ½ä¾è³´
       battleActive çš„ç•¶ä¸‹ç‹€æ…‹ã€‚

       èˆŠç‰ˆåœ¨æˆ°é¬¥æœŸé–“æœƒåœæ­¢ï¼ä¸å»ºç«‹ä¸‹ä¸€å€‹ timeoutï¼Œ
       ç„¶å¾ŒæŠŠã€Œæˆ°é¬¥çµæŸå¾Œä¸€å®šæœƒé‡æ–°æŽ’ç¨‹ã€å¯„è¨—åœ¨å„å€‹
       çµç®—è·¯å¾‘ä¸Šï¼›åªè¦å…¶ä¸­ä»»ä½•ä¸€æ¢è·¯å¾‘æ²’æœ‰é‡æ–°æŽ’ç¨‹ï¼Œ
       è‡ªå‹•å·¡æ€ªå°±æœƒæ°¸ä¹…åœæ­¢ã€‚

       ç¾åœ¨æ”¹æˆï¼šåªè¦ autoPatrolEnabled=true ä¸”ä»åœ¨åœ°åœ–ï¼Œ
       æŽ’ç¨‹å™¨æœ¬èº«æ°¸é ç¶­æŒï¼›æˆ°é¬¥ä¸­åªæ˜¯ runAutoPatrolCheck
       æš«æ™‚ä¸é–‹æˆ°ã€‚æˆ°é¬¥çµæŸæ™‚å¦‚æžœé‡æ–°æŽ’ç¨‹ï¼Œæœƒå…ˆæ¸…æŽ‰èˆŠçš„
       timeoutï¼Œå› æ­¤ä¸æœƒç”¢ç”Ÿé›™é‡å·¡æ€ªã€‚

       é€™ä¸æ”¹è®ŠéŠæˆ²æ©Ÿåˆ¶ï¼šå¯¦éš›å°‹æ€ªä»ç„¶ç¶­æŒ5ç§’ä¸€æ¬¡ã€‚
    */

    if(autoPatrolTimeoutId){

        clearTimeout(
            autoPatrolTimeoutId
        );

        autoPatrolTimeoutId=
            null;

    }

    if(!autoPatrolEnabled){
        return;
    }

    const mapPageElement=
        $("mapPage");

    if(
        !mapPageElement ||
        !mapPageElement.classList.contains("active")
    ){
        return;
    }

    autoPatrolTimeoutId=
        setTimeout(()=>{

            autoPatrolTimeoutId=
                null;

            if(!autoPatrolEnabled){
                return;
            }

            const mapPage=
                $("mapPage");

            if(
                !mapPage ||
                !mapPage.classList.contains("active")
            ){
                return;
            }

            /*
               æˆ°é¬¥ä¸­ï¼é€²æˆ°é¬¥éŽæ¸¡ä¸­åªè·³éŽé€™ä¸€æ¬¡ï¼Œ
               ä¸ä»£è¡¨åœæ­¢è‡ªå‹•å·¡æ€ªï¼›callbackæœ€å¾Œä»æœƒ
               è£œä¸Šä¸‹ä¸€å€‹5ç§’æŽ’ç¨‹ã€‚
            */
            runAutoPatrolCheck();

            if(
                autoPatrolEnabled &&
                $("mapPage") &&
                $("mapPage").classList.contains("active") &&
                !autoPatrolTimeoutId
            ){
                scheduleAutoPatrolCheck(5000);
            }

        },delay);

}


/*
   ç›¸å®¹èˆŠç¨‹å¼å‘¼å«åç¨±ã€‚
   ç¾æœ‰åŠŸèƒ½ä»å¯å‘¼å«ensureAutoPatrolInterval()ï¼Œ
   ä½†å¯¦éš›ä¸Šæ”¹ç”±æ–°çš„è‡ªæˆ‘çºŒæŽ’æ©Ÿåˆ¶è² è²¬ã€‚
*/
function ensureAutoPatrolInterval(){

    if(
        !autoPatrolEnabled ||
        battleActive ||
        patrolBattleTransitionPending
    ){
        return;
    }

    const mapPageElement=
        $("mapPage");

    if(
        !mapPageElement ||
        !mapPageElement.classList.contains("active")
    ){
        return;
    }

    /*
       åªè¦æ²’æœ‰ä¸‹ä¸€æ¬¡æŽ’ç¨‹ï¼Œå°±è£œå›ž5ç§’ã€‚
       ä¸ä½¿ç”¨ã€Œinterval handle æ˜¯å¦å­˜åœ¨ã€åˆ¤æ–·ï¼Œ
       é¿å…handleå­˜åœ¨ä½†å¯¦éš›å¾ªç’°å·²å¤±æ•ˆçš„æƒ…æ³ã€‚
    */
    if(!autoPatrolTimeoutId){

        scheduleAutoPatrolCheck(5000);

    }

}


/* =====================================================
   é–‹å§‹æˆ°é¬¥
===================================================== */

function clearTransientBattlePresentation(){
    if(typeof window==="undefined"){ return; }
    const feedback=window.FourSymbolsBattleFloatingFeedback;
    if(feedback&&typeof feedback.clear==="function"){ feedback.clear(); }
    const presentation=window.FourSymbolsBattlePresentation;
    if(presentation&&typeof presentation.cleanupEscape==="function"){ presentation.cleanupEscape(); }
}

function startBattle(triggerIndex){

    if(
        battleActive ||
        mapCooldown
    ){

        /*
           â˜… é™¤éŒ¯ç”¨ï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼Œè¿½è¹¤
           è‡ªå‹•å·¡æ€ªæ‰¾åˆ°æ€ªç‰©ã€å»æ²’æœ‰çœŸçš„
           é€²å…¥æˆ°é¬¥çš„æƒ…æ³ï¼‰ï¼šå°å‡ºæ˜¯è¢«
           battleActiveé‚„æ˜¯mapCooldown
           æ“‹ä¸‹ä¾†çš„ã€‚
        */

        addBattleLog(
            "startBattleè¢«æ“‹ä¸‹ï¼Œ"+
            "battleActive="+
            battleActive+
            "ï¼ŒmapCooldown="+
            mapCooldown
        );

        return;
    }


    battleActive=true;

    /*
       é€²å…¥çœŸæ­£æˆ°é¬¥æ™‚ï¼Œå–æ¶ˆä¸Šä¸€å€‹åœ°åœ– cooldown
       çš„è§£é™¤æŽ’ç¨‹ï¼›æˆ°é¬¥æœŸé–“ç”± battleActive æŽ§åˆ¶
       ä¸å…è¨±å†æ¬¡é–‹æˆ°ã€‚
    */
    if(mapCooldownTimeoutId){

        clearTimeout(
            mapCooldownTimeoutId
        );

        mapCooldownTimeoutId=null;

    }

    mapCooldown=true;

    battleToken++;
    clearTransientBattlePresentation();
    battleRoundBoundaryKeys=new Set();
    battlePresentationLocks.clear();
    battleInputResumeToken=null;
    battleResolutionResumeToken=null;
    battleAutoActionResume=null;
    battleResolutionResumeToken=null;
    clearBattleRoundPrompt();


    stopMonsterMovement();

    clearInterval(timerId);

    if(battleAdvanceTimeoutId){
        clearTimeout(battleAdvanceTimeoutId);
        battleAdvanceTimeoutId=null;
    }
    clearBattleActionWatchdog();
    battleAdvanceScheduled=false;


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…å›žå ±ï¼‰ï¼š
       é€²å…¥æˆ°é¬¥çš„ç•¶ä¸‹ï¼ŒæŠŠå·¡æ€ªèµ°è·¯çš„è¨ˆæ™‚å™¨
       æš«åœæŽ‰â€”â€”åŽŸæœ¬é€™å€‹è¨ˆæ™‚å™¨å®Œå…¨æ²’æœ‰åœ¨
       é€²å…¥æˆ°é¬¥æ™‚åœæ­¢ï¼Œåªæ˜¯å› ç‚ºæˆ°é¬¥ç•«é¢æŠŠ
       åœ°åœ–è“‹ä½æ‰ã€Œçœ‹ä¸åˆ°ã€è€Œå·²ï¼Œå¯¦éš›ä¸Šé‚„åœ¨
       èƒŒæ™¯æ¯2.2ç§’åŸ·è¡Œä¸€æ¬¡ï¼Œè®€ç§’æ²’æœ‰çœŸçš„
       åœæ­¢ã€‚æˆ°é¬¥çµæŸå›žåˆ°åœ°åœ–æ™‚ï¼ŒshowPage()
       è£¡å·²ç¶“æœƒä¾autoPatrolEnabledé‡æ–°å‘¼å«
       startPatrolCharacterWalking()æ­£å¸¸
       æ¢å¾©ï¼Œé€™è£¡åªè² è²¬ã€Œé€²æˆ°é¬¥å°±å…ˆæš«åœã€
       é€™ä¸€åŠã€‚
    */

    if(patrolWalkIntervalId){

        clearInterval(
            patrolWalkIntervalId
        );

        patrolWalkIntervalId=
            null;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆé˜²å‘†ï¼‰ï¼š
       æ–°æˆ°é¬¥é–‹å§‹æ™‚ï¼Œå¼·åˆ¶æ”¶åˆä»»ä½•å¯èƒ½æ®˜ç•™
       é–‹è‘—çš„å­é¸å–®ï¼ˆä¾‹å¦‚ä¸Šä¸€å ´æˆ°é¬¥çµæŸæ™‚
       å¿˜äº†é—œçš„ç‰©å“æ¬„é¸å–®ï¼‰ï¼Œç¢ºä¿æ¯å ´æˆ°é¬¥
       éƒ½æ˜¯ä¹¾æ·¨çš„ç•«é¢é–‹å§‹ï¼Œä¸æœƒå»¶çºŒä¸Šä¸€å ´
       æ®˜ç•™çš„UIç‹€æ…‹ã€‚
    */

    closeMenus();


    selectedMonster =
        triggerIndex;


    turn=1;

    actionReady=false;

    pendingAction=null;


    /*
       â˜… æ–°æˆ°é¬¥é–‹å§‹ï¼Œæ¸…æŽ‰ä¸Šä¸€å ´çš„buffæ®˜ç•™
       ï¼ˆä¾‹å¦‚æ€’ç«ä¸æœƒå»¶çºŒåˆ°ä¸‹ä¸€å ´æˆ°é¬¥ï¼‰ï¼Œ
       é˜²ç¦¦ç‹€æ…‹ä¹Ÿä¸€ä½µé‡ç½®ï¼Œé¿å…æ®˜ç•™ã€‚
    */

    player.activeBuffs=[];

    player.statusEffects=[];

    player.isDefending=false;


    /*
       â˜… æ–°å¢žï¼šç¬¬äºŒè§’è‰²åƒæˆ°åˆå§‹åŒ–ã€‚
       å¦‚æžœçŽ©å®¶å·²ç¶“å‰µå»ºç¬¬äºŒè§’è‰²ï¼Œ
       æ¯å ´æ–°æˆ°é¬¥é–‹å§‹éƒ½æŠŠä»–çš„HP/SPè£œæ»¿ï¼Œ
       ä¸¦æ¸…æŽ‰ä¸Šä¸€å ´å¯èƒ½æ®˜ç•™çš„buffï¼Œ
       é€™æ¨£ä»–æ‰èƒ½çœŸæ­£ä¸€èµ·ä¸Šå ´æˆ°é¬¥ã€‚
    */

    if(player2){

        const stats2=
            getPlayer2BattleStats();


        player2.hp=Number.isFinite(Number(player2.hp))
            ? Math.max(0,Math.min(stats2.maxHP,Number(player2.hp)))
            : stats2.maxHP;

        player2.sp=Number.isFinite(Number(player2.sp))
            ? Math.max(0,Math.min(stats2.maxSP,Number(player2.sp)))
            : stats2.maxSP;


        player2.activeBuffs=[];

        player2.statusEffects=[];

        player2.isDefending=false;

    }

    if(player3){

        const stats3=
            getPartyBattleStats(2);

        player3.hp=Number.isFinite(Number(player3.hp))
            ? Math.max(0,Math.min(stats3.maxHP,Number(player3.hp)))
            : stats3.maxHP;
        player3.sp=Number.isFinite(Number(player3.sp))
            ? Math.max(0,Math.min(stats3.maxSP,Number(player3.sp)))
            : stats3.maxSP;
        player3.activeBuffs=[];
        player3.statusEffects=[];
        player3.isDefending=false;

    }

    /*
       â˜… éš¨æ©Ÿæ±ºå®šé€™å ´æˆ°é¬¥æ²å…¥å¹¾éš»æ€ªç‰©ï¼ˆ1ï½ž3éš»ï¼‰ï¼Œ
       è§¸ç™¼çš„é‚£éš»ä¸€å®šåœ¨è£¡é¢ï¼Œ
       å…¶é¤˜å¾žã€Œå…¶ä»–é‚„æ´»è‘—çš„æ€ªç‰©ã€è£¡éš¨æ©ŸæŠ½ï¼Œ
       ä¸å¤ éš¨ä¾¿ä½ æŠ½å¤šå°‘å°±æŠ½å¤šå°‘ï¼ˆä¸æœƒç¡¬æ¹Šï¼‰ã€‚
       æ²’è¢«æŠ½åˆ°çš„æ€ªç‰©ç•™åœ¨åœ°åœ–ä¸ŠåŽŸåœ°ä¸å‹•ï¼Œä¸å—å½±éŸ¿ã€‚
    */

    const alivePool =
        monsters
        .slice(
            0,
            MAX_TRAINING_MONSTERS
        )
        .map(
            (m,i)=>
                (
                    m &&
                    m.alive &&
                    i!==triggerIndex
                )
                ?
                i
                :
                null
        )
        .filter(
            i=>i!==null
        );


    for(
        let i=
            alivePool.length-1;
        i>0;
        i--
    ){

        const j =
            Math.floor(
                Math.random()*
                (i+1)
            );

        const temp =
            alivePool[i];

        alivePool[i] =
            alivePool[j];

        alivePool[j] =
            temp;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       å¾žå†°éœœå±±è„ˆé–‹å§‹çš„æ‰€æœ‰å€åŸŸï¼Œæ€ªç‰©ä¸€æ¬¡
       å‡ºç¾çš„æ•¸é‡æ”¹æˆ3~6éš»ï¼ˆåŽŸæœ¬æ–°æ‰‹æ£®æž—ã€
       è’æ¼ åœ°å¸¶ç¶­æŒ1~3éš»ä¸è®Šï¼Œé€™å…©å€æ˜¯
       æ¯”è¼ƒæ—©æœŸã€ç°¡å–®çš„ç·´åŠŸå€ï¼Œä¸éœ€è¦
       è·Ÿè‘—ä¸€èµ·è®Šå‹•ï¼‰ã€‚
    */

    const isHighTierZone=

        currentZone!=="forest"&&
        currentZone!=="desert";


    const targetGroupSize =

        isHighTierZone
        ?
        (
            3+
            Math.floor(
                Math.random()*4
            )
        )
        :
        (
            1+
            Math.floor(
                Math.random()*3
            )
        );


    const extraCount =
        Math.min(
            targetGroupSize-1,
            alivePool.length
        );


    currentBattleMonsters = [
        triggerIndex,
        ...alivePool.slice(
            0,
            extraCount
        )
    ]
    .sort(
        (a,b)=>a-b
    );


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ä¸€å€‹bugï¼‰ï¼š
       æ€ªç‰©å¦‚æžœåœ¨ä¸Šä¸€å ´æˆ°é¬¥ä¸­æ´»è‘—é€ƒéŽä¸€åŠ«
       ï¼ˆæ²’è¢«æ‰“æ­»ï¼‰ï¼Œèº«ä¸Šæ®˜ç•™çš„ç‡ƒç‡’/å†°å°ç‹€æ…‹
       å®Œå…¨æ²’æœ‰è¢«æ¸…æŽ‰â€”â€”respawnMonsters()
       åªæœƒæ¸…ã€Œé‡ç”Ÿçš„æ€ªç‰©ã€çš„ç‹€æ…‹ï¼Œ
       é€™éš»æ—¢æ²’æ­»ã€ä¹Ÿæ²’é‡ç”Ÿï¼Œ
       ç‹€æ…‹å°±ä¸€è·¯å¸¶åˆ°ä¸‹ä¸€å ´æˆ°é¬¥ï¼Œ
       ç•«é¢ä¸Šæœƒçœ‹åˆ°ç‰ å¹³ç™½ç„¡æ•…è£¹è‘—ä¸€å±¤
       ç‡ƒç‡’çš„æ©˜ç´…è‰²ï¼Œå…¶å¯¦æ˜¯ä¸Šä¸€å ´æˆ°é¬¥
       æ®˜ç•™çš„ç‡ƒç‡’ç‰¹æ•ˆæ²’æ¶ˆæŽ‰ã€‚
       é€™è£¡åœ¨æ¯å ´æ–°æˆ°é¬¥é–‹å§‹æ™‚ï¼Œ
       æŠŠé€™å ´çœŸæ­£æ²å…¥æˆ°é¬¥çš„æ€ªç‰©
       statusEffectséƒ½é‡ç½®ä¹¾æ·¨ã€‚
    */

    currentBattleMonsters.forEach(
        i=>{

            if(monsters[i]){

                monsters[i].statusEffects=[];

            }

        }
    );


    currentBattleMonsters
    .forEach(index=>{

        const monster =
            monsters[index];

        monster.alive=true;

        monster.hp =
            monster.maxHP;

        monster.sp =
            monster.maxSP;

        /*
           â˜… æ¸…æŽ‰ä¸Šä¸€å ´æˆ°é¬¥å¯èƒ½æ®˜ç•™çš„
           ç‡ƒç‡’ä¹‹é¡žçš„ç‹€æ…‹æ•ˆæžœï¼Œ
           æ¯å ´æˆ°é¬¥éƒ½æ˜¯å…¨æ–°é–‹å§‹ã€‚
        */

        monster.statusEffects=[];

    });


    renderBattle();

    showPage("battle");


    autoBattle =
        autoConfig.enabled;


    syncBattleAutoSettings();

    updateAutoButton();

    beginBattleStatisticsSession();


    selectBattleTarget(
        triggerIndex
    );


    clearBattleLog();


    addBattleLog(
        "æˆ°é¬¥é–‹å§‹ï¼"
    );


    addBattleLog(
        "æ•µäººå…±æœ‰"+
        currentBattleMonsters.length+
        "éš»ã€‚"
    );


    startTurn(
        battleToken
    );

}


/* =====================================================
   å›žåˆ
===================================================== */

function startTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }

    notifyBattleRoundBoundary("round_start",token);

    const bossRoundOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    if(bossRoundOwner&&typeof bossRoundOwner.processRound==="function"&&
       bossRoundOwner.processRound()===true){
        return;
    }


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯å€‹å¤§å›žåˆé–‹å§‹çš„æ™‚å€™ï¼Œåœ¨æˆ°é¬¥ç´€éŒ„
       åŠ ä¸€è¡Œã€Œç¬¬Xå›žåˆï¼Œé–‹å§‹ï¼ã€ï¼Œ
       è®“çŽ©å®¶æ¸…æ¥šçœ‹åˆ°æ–°çš„ä¸€è¼ªå¾žé€™è£¡é–‹å§‹ï¼Œ
       è·Ÿä¸Šä¸€è¼ªçš„å…§å®¹æœ‰æ˜Žç¢ºåˆ†éš”ã€‚
    */

    addBattleLog(
        "ç¬¬"+
        turn+
        "å›žåˆï¼Œé–‹å§‹ï¼"
    );


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       ã€Œæˆ°é¬¥è³‡è¨Šã€æ¡†ä¸Šæ–¹é‚£å€‹å›ºå®šé¡¯ç¤ºçš„
       å›žåˆæ•¸æ¨™ç±¤ï¼Œè·Ÿè‘—é€™è£¡åŒæ­¥æ›´æ–°â€”â€”
       é€™å€‹æ¨™ç±¤ä¸æ˜¯æˆ°é¬¥ç´€éŒ„è£¡æœƒè¢«æ²å‹•æ²–æŽ‰
       çš„ä¸€è¡Œå­—ï¼Œæ˜¯ç¨ç«‹çš„å°æ¨™ç±¤ï¼Œéš¨æ™‚éƒ½
       çœ‹å¾—åˆ°ç›®å‰æ˜¯ç¬¬å¹¾è¼ªï¼Œå…©å€‹åœ°æ–¹
       ï¼ˆæˆ°é¬¥é é¢/å·¡é‚é é¢ï¼‰éƒ½è¦ä¸€èµ·æ›´æ–°ã€‚
    */

    const turnIndicator=
        $("battleTurnIndicator");


    if(turnIndicator){

        turnIndicator.textContent=
            "ç¬¬"+turn+"å›žåˆ";

    }


    const mapTurnIndicator=
        $("mapBattleTurnIndicator");


    if(mapTurnIndicator){

        mapTurnIndicator.textContent=
            "ç¬¬"+turn+"å›žåˆ";

    }


    /*
       â˜… æ¯å›žåˆé–‹å§‹å…ˆè™•ç†ç‡ƒç‡’å‚·å®³è·ŸbuffæŒçºŒæ™‚é–“ï¼Œ
       é€™æ¨£æ‰æœƒæœ‰ã€Œå›žåˆåˆ¶DoTã€çš„æ„Ÿè¦ºï¼Œ
       è€Œä¸æ˜¯ç‡ƒç‡’åªå¥—ç”¨ä¸€æ¬¡å°±æ²’äº‹äº†ã€‚

       å¦‚æžœç‡ƒç‡’å‚·å®³æ­£å¥½æŠŠæœ€å¾Œä¸€éš»æ€ªæ‰“æ­»ï¼Œ
       è¦å…ˆåˆ¤æ–·æˆ°é¬¥æ˜¯å¦çµæŸï¼Œ
       çµæŸçš„è©±å°±ä¸è¦å†å¾€ä¸‹é–‹æ–°å›žåˆã€‚
    */

    /* Round Start only projects already-settled state. */
    if(typeof window!=="undefined"&&typeof window.v143SyncStatusVisualEffects==="function"){
        window.v143SyncStatusVisualEffects();
    }


    if(
        checkBattleEnd()
    ){
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
       æ–°çš„ä¸€å€‹å¤§å›žåˆé–‹å§‹ï¼Œä¸æ˜¯é¦¬ä¸ŠæŽ’æ•æ·ã€
       é¦¬ä¸Šé–‹æ‰“ï¼Œè€Œæ˜¯å…ˆé€²å…¥ã€Œå®£å‘ŠéšŽæ®µã€â€”â€”
       çŽ©å®¶è§’è‰²ä¾åºé¸å¥½é€™å›žåˆè¦åšä»€éº¼
       ï¼ˆä½†ä¸æœƒé¦¬ä¸ŠåŸ·è¡Œï¼‰ï¼Œ
       å…¨éƒ¨äººéƒ½é¸å¥½ä¹‹å¾Œï¼Œ
       æ‰æœƒé€²å…¥ã€Œçµç®—éšŽæ®µã€ä¾æ•æ·é«˜ä½ŽçœŸæ­£å‡ºæ‰‹ã€‚
       é€™è£¡ä¸å†ç›´æŽ¥å‘¼å«processNextCombatant()ï¼Œ
       æ”¹æˆå‘¼å«beginCharacterTurn()é–‹å§‹å®£å‘Šæµç¨‹ã€‚
    */

    battlePhase=
        "declare";


    activeBattleCharacterIndex=0;


    declaredCharacterIndexes=
        new Set();


    resolutionPhaseStarted=
        false;


    turnAdvancePending=
        false;


    queuedPlayerActions={};


    updateActionHudVisibility();


    /* Auto Battle owns a short, tracked presentation lock before the first
       declaration/action of the newly established round. Manual battle keeps
       the existing timing unchanged. */
    showAutoBattleRoundPrompt(token);
    beginCharacterTurn(token);

}


/*
   â˜… æ–°å¢žï¼šå–å¾—ç›®å‰æ´»è‘—ã€æœƒä¸Šå ´çš„éšŠä¼æˆå“¡ï¼Œ
   ä¾åºï¼ˆç¬¬ä¸€è§’è‰²ã€ç¬¬äºŒè§’è‰²ï¼‰æŽ’åˆ—ã€‚
   ç¬¬äºŒè§’è‰²ä¸å­˜åœ¨æˆ–å·²ç¶“å€’ä¸‹å°±ä¸æœƒå‡ºç¾åœ¨é€™è£¡ï¼Œ
   beginCharacterTurn()ç”¨é€™å€‹æ¸…å–®åˆ¤æ–·
   é‚„æœ‰æ²’æœ‰äººæ²’è¡Œå‹•éŽã€‚
*/

function getLivingParty(){
    return getExistingPartyIndexes().filter(index=>{
        const character=getPartyCharacterByIndex(index);
        return character && character.hp>0;
    });

}


/*
   â˜… æ–°å¢žï¼šè™•ç†ã€Œç›®å‰é€™å€‹è§’è‰²ã€çš„è¡Œå‹•éšŽæ®µã€‚
   è·ŸåŽŸæœ¬startTurn()è£¡ç›´æŽ¥å¯«æ­»æ“ä½œplayerçš„é‚è¼¯
   å¹¾ä¹Žä¸€æ¨£ï¼Œåªæ˜¯æ›æˆçœ‹
   activeBattleCharacterIndexæŒ‡å‘èª°ï¼Œ
   è¼ªåˆ°ç¬¬äºŒè§’è‰²æ™‚ï¼Œç•«é¢ä¸Šæœƒæç¤ºã€
   ä¹Ÿæœƒåˆ‡æ›æŠ€èƒ½é¸å–®é¡¯ç¤ºçš„æŠ€èƒ½ä¾†æºã€‚
*/

function beginCharacterTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }

    if(battlePresentationLocks.size>0){
        battleInputResumeToken=token;
        updateActionHudVisibility();
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£çš„æ ¹æºä¿®æ³•ï¼‰ï¼š
       æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚setTimeoutä¸ä¿è­‰
       æº–æ™‚è§¸ç™¼ï¼Œå¯èƒ½è¢«å»¶å¾Œã€ä¹‹å¾Œåˆè·Ÿå…¶ä»–
       è¨ˆæ™‚å™¨ä¸€æ¬¡è£œç™¼ï¼Œå°Žè‡´é€™å€‹å‡½å¼è¢«åŒä¸€å€‹
       activeBattleCharacterIndexå€¼å‘¼å«
       ç¬¬äºŒæ¬¡ã€‚

       é€™è£¡ç”¨declaredCharacterIndexesé€™å€‹Set
       æ“‹æŽ‰é‡è¤‡ï¼šå¦‚æžœç›®å‰é€™å€‹
       activeBattleCharacterIndexåœ¨é€™å€‹å¤§å›žåˆ
       è£¡å·²ç¶“çœŸæ­£å®£å‘ŠéŽä¸€æ¬¡ï¼Œä»£è¡¨é€™æ¬¡å‘¼å«æ˜¯
       è¨ˆæ™‚å™¨å»¶é²è£œç™¼çš„é‡è¤‡/éŽæœŸå‘¼å«ï¼Œç›´æŽ¥
       returnï¼Œä¸æœƒå†è®“è§’è‰²ç´¢å¼•è¢«å¤šæŽ¨é€²ã€
       ä¸æœƒè®“autoAction()/player2AutoAction()
       è¢«é‡è¤‡å‘¼å«ï¼Œä¹Ÿå°±ä¸æœƒå†ç™¼ç”Ÿã€Œå…¶ä¸­ä¸€å€‹
       è§’è‰²çš„å®£å‘Šè¢«è·³éŽã€çš„æƒ…æ³ã€‚
    */

    if(
        declaredCharacterIndexes.has(
            activeBattleCharacterIndex
        )
    ){

        addBattleLog(
            "åµæ¸¬åˆ°é‡è¤‡çš„"+
            "beginCharacterTurnå‘¼å«"+
            "ï¼ˆactiveBattleCharacterIndex="+
            activeBattleCharacterIndex+
            "å·²ç¶“å®£å‘ŠéŽï¼‰ï¼Œå·²æ“‹ä¸‹ã€‚"
        );

        return;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
       é€™å€‹å‡½å¼ç¾åœ¨æ˜¯ã€Œå®£å‘ŠéšŽæ®µã€çš„è¿´åœˆæœ¬é«”ï¼Œ
       æ¯æ¬¡è¢«å‘¼å«éƒ½ä»£è¡¨ã€Œè¼ªåˆ°ä¸‹ä¸€å€‹è§’è‰²å®£å‘Šã€ã€‚
       å¦‚æžœæ´»è‘—çš„è§’è‰²éƒ½å®£å‘Šå®Œäº†ï¼Œ
       å°±ä¸å†ç­‰æ–°çš„è¼¸å…¥ï¼Œç›´æŽ¥é€²å…¥çµç®—éšŽæ®µã€‚
    */

    while(activeBattleCharacterIndex<3){
        const candidate=getPartyCharacterByIndex(activeBattleCharacterIndex);
        if(candidate && candidate.hp>0){
            break;
        }
        activeBattleCharacterIndex++;
    }

    if(activeBattleCharacterIndex>=3){

        startResolutionPhase(
            token
        );

        return;

    }


    /*
       â˜… åˆ°é€™è£¡ä»£è¡¨é€™å€‹ç´¢å¼•çœŸçš„è¦é–‹å§‹å®£å‘Šäº†ï¼Œ
       ç«‹åˆ»æ¨™è¨˜èµ·ä¾†â€”â€”ä¸€å®šè¦åœ¨é€™è£¡æ¨™è¨˜
       ï¼ˆè€Œä¸æ˜¯ç­‰å®£å‘Šå®Œæˆæ‰æ¨™è¨˜ï¼‰ï¼Œå› ç‚º
       é‡è¤‡å‘¼å«å¯èƒ½ç™¼ç”Ÿåœ¨å®£å‘Šã€Œé€²è¡Œä¸­ã€
       çš„ä»»ä½•æ™‚é–“é»žï¼Œè¶Šæ—©æ¨™è¨˜è¶Šèƒ½æ“‹ä½
       å¾ŒçºŒçš„é‡è¤‡å‘¼å«ã€‚
    */

    declaredCharacterIndexes.add(
        activeBattleCharacterIndex
    );


    actionReady=false;

    pendingAction=null;

    closeMenus();
    clearBattleTargetSelectionMode();


    /*
       â˜… è¼ªåˆ°é€™å€‹è§’è‰²è¡Œå‹•æ™‚ï¼Œ
       æŠŠä»–ä¸Šä¸€æ¬¡è¨­çš„é˜²ç¦¦ç‹€æ…‹æ¸…æŽ‰â€”â€”
       é˜²ç¦¦åªä¿è­·åˆ°ã€Œä¸‹ä¸€æ¬¡è¼ªåˆ°è‡ªå·±ã€ç‚ºæ­¢ï¼Œ
       ç¾åœ¨æ—¢ç„¶è¼ªåˆ°è‡ªå·±äº†ï¼Œé€™æ¬¡ä¿è­·å·²ç¶“ç”¨å®Œï¼Œ
       è¦å˜›é‡æ–°é¸é˜²ç¦¦ã€è¦å˜›åšåˆ¥çš„äº‹ã€‚
    */

    const currentActingCharacter=
        getPartyCharacterByIndex(activeBattleCharacterIndex);


    if(currentActingCharacter){

        currentActingCharacter.isDefending=
            false;

    }


    timer=20;


    $("turnNumber")
        .textContent =
        turn;


    updateTimer();


    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       ä¹‹å‰ä¸ç®¡æ˜¯æ‰‹å‹•é‚„æ˜¯å…¨è‡ªå‹•ï¼Œå®£å‘ŠéšŽæ®µ
       éƒ½æœƒå…ˆé¡¯ç¤ºã€Œè¼ªåˆ°èª°ã€çš„é»ƒè‰²é–ƒçˆå¤–æ¡†ï¼Œ
       è€Œä¸”è‡ªå‹•åˆ¤æ–·é‚„è¦ç­‰1000msæ‰æœƒçœŸæ­£å‡ºæ‰‹ï¼Œ
       ç­‰æ–¼å…¨è‡ªå‹•æ¨¡å¼ä¸‹ï¼Œæ¯å€‹è§’è‰²å‡ºæ‰‹å‰
       éƒ½è¦å…ˆé–ƒä¸€ä¸‹ã€ç­‰ä¸€ä¸‹ï¼Œçœ‹èµ·ä¾†åƒæ˜¯
       ã€Œé‚„è¦æŽ’éšŠç­‰ã€ï¼Œä¸å¤ ä¿è½ã€‚

       æ”¹æˆï¼šåªæœ‰çœŸæ­£éœ€è¦çŽ©å®¶è‡ªå·±é¸æ“‡çš„æ™‚å€™
       ï¼ˆé€™å€‹è§’è‰²ä¸æ˜¯è‡ªå‹•ï¼‰ï¼Œæ‰é¡¯ç¤ºé–ƒçˆå¤–æ¡†ï¼Œ
       æé†’çŽ©å®¶è©²åšé¸æ“‡äº†ï¼›å¦‚æžœæ˜¯è‡ªå‹•è§’è‰²ï¼Œ
       ä¸éœ€è¦é€™å€‹æé†’ï¼ˆåæ­£ä¹Ÿä¸ç”¨çŽ©å®¶åšä»»ä½•äº‹ï¼‰ï¼Œ
       ç›´æŽ¥è·³éŽé–ƒçˆã€‚
    */

    /* active-turn is a manual-control presentation projection, not a second
       turn-state owner. Always retire the preceding character's projection
       before deciding whether the current character needs manual input. */
    clearActiveCharacterHighlight();

    if(!autoOn){

        updateActiveCharacterHighlight();

    }


    populateSkillQuickBar();


    clearInterval(timerId);


    timerId =
        setInterval(()=>{

            if(
                !battleActive ||
                token!==battleToken
            ){

                clearInterval(
                    timerId
                );

                return;

            }


            timer--;

            updateTimer();


            if(timer<=0){

                clearInterval(
                    timerId
                );

                timeoutTurn(token);

            }

        },1000);


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé‚è¼¯åéŽä¾†ï¼‰ï¼š
       å®£å‘ŠéšŽæ®µï¼ˆç­‰çŽ©å®¶é¸æ“‡è¦åšä»€éº¼ï¼‰
       ä¸æ‡‰è©²æ”¾å¤§æˆ°é¬¥ç´€éŒ„ï¼Œç¶­æŒå°å°ä¸€å¡Šå°±å¥½ï¼Œ
       æ”¾å¤§äº¤çµ¦çµç®—éšŽæ®µè² è²¬
       ï¼ˆstartResolutionPhase()é‚£é‚Šè™•ç†ï¼‰ï¼Œ
       é€™è£¡æŠŠåŽŸæœ¬ã€Œè¼ªåˆ°æ‰‹å‹•è§’è‰²å°±æ”¾å¤§ã€çš„é‚è¼¯æ‹¿æŽ‰ã€‚
    */


    if(autoOn){

        const scheduledAutoCharacterIndex=activeBattleCharacterIndex;

        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒåŠ å¿«ç¯€å¥ï¼‰ï¼š
           åŽŸæœ¬1000msæ‰æœƒçœŸæ­£å‡ºæ‰‹ï¼Œé€™æ˜¯å°ˆé–€
           ç•™çµ¦ã€ŒçŽ©å®¶è‡ªå·±é¸ã€ç”¨çš„æ€è€ƒæ™‚é–“ï¼Œ
           å…¨è‡ªå‹•è§’è‰²ä¸éœ€è¦é€™å€‹ç­‰å¾…ï¼Œ
           èª¿å¿«åˆ°150msï¼ˆä¿ç•™æ¥µçŸ­çš„å»¶é²åªæ˜¯
           é¿å…çž¬é–“è§¸ç™¼é€ æˆçš„æ½›åœ¨æ™‚åºå•é¡Œï¼Œ
           ä¸æ˜¯åˆ»æ„ç•™çµ¦çŽ©å®¶çœ‹çš„ç­‰å¾…æ™‚é–“ï¼‰ã€‚
        */

        setTimeout(()=>{

            if(
                !battleActive ||
                token!==battleToken
            ){
                return;
            }

            if(battlePresentationLocks.size>0){
                battleAutoActionResume={
                    token:token,
                    characterIndex:scheduledAutoCharacterIndex
                };
                return;
            }


            /*
               â˜… æ–°å¢žï¼ˆé˜²è­·ç¶²ï¼Œè™•ç†ã€Œæ‰“äº†å¹¾è¼ª
               è‡ªå‹•æˆ°é¬¥çªç„¶å®Œå…¨å¡ä½ä¸å‹•ã€
               ä½†æ€ªç‰©é‚„æ˜¯æŒçºŒå‡ºæ‰‹ã€çš„å•é¡Œï¼‰ï¼š

               ç›®å‰æ‰¾ä¸åˆ°è®“è‡ªå‹•åˆ¤æ–·å¡ä½çš„
               ç¢ºåˆ‡è§¸ç™¼æ¢ä»¶ï¼Œä½†ç”¨try-catchåŒ…ä½
               é€™è£¡è‡³å°‘èƒ½ç¢ºä¿ï¼šè¬ä¸€è‡ªå‹•åˆ¤æ–·å…§éƒ¨
               çœŸçš„å› ç‚ºæŸç¨®ç‰¹æ®Šè³‡æ–™ç‹€æ…‹æ‹‹å‡ºä¾‹å¤–ï¼Œ
               ä¸æœƒæ•´å€‹å®‰éœå¡æ­»ã€ä»€éº¼éƒ½ä¸æœƒç™¼ç”Ÿâ€”â€”
               æœƒæŠŠéŒ¯èª¤å…§å®¹å°åœ¨æˆ°é¬¥ç´€éŒ„è£¡è®“ä½ çœ‹åˆ°
               ï¼ˆä¹‹å¾Œå›žå ±çµ¦æˆ‘ï¼‰ï¼Œä¸¦ä¸”å¼·åˆ¶å‘¼å«
               finishPlayerAction()è®“æˆ°é¬¥
               ç¹¼çºŒå¾€ä¸‹èµ°ï¼Œä¸æœƒå¡åœ¨åŽŸåœ°ã€‚
            */

            try{

                battleStatisticsBeginAction({
                    type:"player",
                    characterIndex:scheduledAutoCharacterIndex
                });

                autoActionForCharacter(
                    scheduledAutoCharacterIndex,
                    token
                );

            }
            catch(error){

                console.error(
                    "è‡ªå‹•åˆ¤æ–·ç™¼ç”Ÿä¾‹å¤–ï¼š",
                    error
                );

                addBattleLog(
                    "è‡ªå‹•åˆ¤æ–·ç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
                    (error&&error.message)+
                    "ï¼‰ï¼Œå·²å¼·åˆ¶ç•¥éŽé€™å›žåˆã€‚"
                );

                finishPlayerAction();

            }

        },150);

    }

}


/*
   â˜… æ–°å¢žï¼šåˆ‡æ›è§’è‰²æ™‚ï¼Œ
   åœ¨ç•«é¢ä¸Šé«˜äº®ã€Œç›®å‰æ­£åœ¨è¡Œå‹•ã€çš„é‚£å¼µå¡ï¼Œ
   è®“çŽ©å®¶æ¸…æ¥šçŸ¥é“ç¾åœ¨æ˜¯èª°çš„å›žåˆã€‚
*/

/*
   â˜… æ–°å¢žï¼šå¡«å…¥å¸¸é§æŠ€èƒ½å¿«æ·åˆ—çš„4å€‹æ ¼å­ï¼Œ
   å…§å®¹æ˜¯ã€Œç›®å‰è¼ªåˆ°èª°è¡Œå‹•ã€é‚£å€‹è§’è‰²è£å‚™çš„æŠ€èƒ½ï¼Œ
   è·ŸèˆŠç‰ˆopenSkillMenu()å½ˆçª—çš„åˆ¤æ–·é‚è¼¯ä¸€è‡´
   ï¼ˆSPå¤ ä¸å¤ ã€ç­‰ç´šé è¦½ï¼‰ï¼Œåªæ˜¯æ”¹æˆå¸¸é§é¡¯ç¤ºï¼Œ
   ä¸ç”¨å¦å¤–é»žã€ŒæŠ€èƒ½ã€æŒ‰éˆ•æ‰çœ‹å¾—åˆ°ã€‚
*/

function bumpBattleRuntimeMetric(name,amount){
    if(typeof window==="undefined"){ return; }
    const metrics=window.FourSymbolsBattleRuntimeMetrics;
    if(!metrics||metrics.enabled!==true||!metrics.counters){ return; }
    const delta=Number.isFinite(Number(amount))?Number(amount):1;
    metrics.counters[name]=(Number(metrics.counters[name])||0)+delta;
}

if(typeof window!=="undefined"&&!window.FourSymbolsBattleRuntimeMetrics){
    const counters={
        updateUI:0,
        updateMonsterUI:0,
        syncMonsterPortraits:0,
        quickBarPopulate:0,
        quickBarRebuild:0,
        repairScheduler:0
    };
    window.FourSymbolsBattleRuntimeMetrics={
        enabled:false,
        counters:counters,
        reset:function(){ Object.keys(counters).forEach(key=>{ counters[key]=0; }); },
        snapshot:function(){ return Object.assign({},counters); }
    };
}

function isCanonicalSkillQuickBarButton(button){
    if(!button||!button.classList||!button.classList.contains("skill-quick-button")){ return false; }
    return [
        ".sq-icon-wrap",".sq-icon-image",".sq-icon-fallback",".sq-sp-block",
        ".sq-name",".sq-cost",".v135-sq-scope"
    ].every(selector=>!!button.querySelector(selector));
}

function ensureSkillQuickBarButtons(bar){
    let buttons=Array.from(bar.children).filter(node=>node.classList&&node.classList.contains("skill-quick-button"));
    if(
        bar.children.length===4&&
        buttons.length===4&&
        buttons.every(isCanonicalSkillQuickBarButton)
    ){
        return buttons;
    }

    bar.replaceChildren();

    for(let i=0;i<4;i++){
        const button=document.createElement("button");
        button.className="skill-quick-button";
        button.type="button";
        button.dataset.slot=String(i);
        button.innerHTML=
            '<span class="sq-icon-wrap"><span class="sq-icon-image"></span><span class="sq-icon-fallback"></span><span class="sq-sp-block" hidden>SPä¸è¶³</span></span>'+
            '<span class="sq-name"></span>'+
            '<span class="sq-cost"></span>'+
            '<span class="v135-sq-scope"></span>';
        button.onclick=()=>{
            const skillId=button.dataset.skillId||"";
            if(skillId&&!button.disabled){ prepareAction(skillId); }
        };
        bar.appendChild(button);
    }

    bumpBattleRuntimeMetric("quickBarRebuild");
    buttons=Array.from(bar.children);
    return buttons;
}

function syncSkillQuickBarButton(button,skillId,skill,skillLevel,spCost,enoughSP){
    const iconImage=button.querySelector(".sq-icon-image");
    const iconFallback=button.querySelector(".sq-icon-fallback");
    const spBlock=button.querySelector(".sq-sp-block");
    const nameNode=button.querySelector(".sq-name");
    const costNode=button.querySelector(".sq-cost");
    const scopeNode=button.querySelector(".v135-sq-scope");

    button.dataset.skillId=skillId||"";

    if(!skillId||!skill){
        button.disabled=true;
        button.classList.remove("sp-insufficient");
        if(iconImage){ iconImage.style.backgroundImage=""; iconImage.hidden=true; }
        if(iconFallback){ iconFallback.innerHTML=""; iconFallback.hidden=false; }
        if(spBlock){ spBlock.hidden=true; }
        if(nameNode){ nameNode.textContent=skillId?"è³‡æ–™éŒ¯èª¤":"ï¼ˆç©ºï¼‰"; }
        if(costNode){ costNode.textContent="â€”"; }
        if(scopeNode){ scopeNode.textContent=""; }
        return;
    }

    button.disabled=!enoughSP;
    button.classList.toggle("sp-insufficient",!enoughSP);

    const iconBackground=typeof getSkillIconBackgroundImage==="function"
        ?getSkillIconBackgroundImage(skillId):"";

    if(iconImage){
        iconImage.hidden=!iconBackground;
        if(iconBackground&&iconImage.style.backgroundImage!==iconBackground){
            iconImage.style.backgroundImage=iconBackground;
        }else if(!iconBackground){
            iconImage.style.backgroundImage="";
        }
    }
    if(iconFallback){
        const fallback=!iconBackground&&typeof getElementIconHTML==="function"
            ?getElementIconHTML(skill.element):"";
        iconFallback.hidden=!!iconBackground;
        if(iconFallback.innerHTML!==fallback){ iconFallback.innerHTML=fallback; }
    }

    if(spBlock){ spBlock.hidden=!!enoughSP; }
    if(nameNode){
        const text=skill.name+(skillLevel>0?" Lv."+skillLevel:"");
        if(nameNode.textContent!==text){ nameNode.textContent=text; }
    }
    if(costNode){
        const text="æ¶ˆè€— "+spCost+" SP";
        if(costNode.textContent!==text){ costNode.textContent=text; }
    }

    const formalSpec=typeof window!=="undefined"?window.FourSymbolsSkillSpec:null;
    if(scopeNode){
        const targetLabel=formalSpec&&typeof formalSpec.targetLabel==="function"
            ?formalSpec.targetLabel(skill,Math.max(1,skillLevel||1))
            :(typeof window!=="undefined"&&typeof window.v135GetSkillTargetScopeLabel==="function"
                ?window.v135GetSkillTargetScopeLabel(skill):"");
        if(scopeNode.textContent!==targetLabel){ scopeNode.textContent=targetLabel; }
    }
}

function populateSkillQuickBar(){

    bumpBattleRuntimeMetric("quickBarPopulate");

    const overlay=$("skillQuickBar");
    if(overlay){
        overlay.classList.remove("show");
    }

    syncTurnTimerWithBattlePickers();

    const bar=$("skillQuickBarGrid");
    if(!bar){
        return;
    }

    const autoOn=
        activeBattleCharacterIndex===0
        ?autoBattle
        :getPartyAutoConfig(activeBattleCharacterIndex).enabled;

    if(!battleActive||autoOn){
        return;
    }

    const activeCharacterId=getPartyCharacterKey(activeBattleCharacterIndex);
    const activeCharacterObj=getPartyCharacterByIndex(activeBattleCharacterIndex);
    const character=characterSkillLoadouts[activeCharacterId];
    const buttons=ensureSkillQuickBarButtons(bar);

    for(let i=0;i<4;i++){
        const skillId=character&&Array.isArray(character.equippedSkills)
            ?character.equippedSkills[i]
            :null;
        const skill=skillId?skillDatabase[skillId]:null;

        if(!skillId||!skill||!activeCharacterObj){
            syncSkillQuickBarButton(buttons[i],skillId,skill,0,0,false);
            continue;
        }

        const skillLevel=getSkillLevel(activeCharacterId,skillId);
        const spCost=skill.spCost!==undefined?skill.spCost:(skill.cost||0);
        const enoughSP=activeCharacterObj.sp>=spCost;
        syncSkillQuickBarButton(buttons[i],skillId,skill,skillLevel,spCost,enoughSP);
    }
}

function syncTurnTimerWithBattlePickers(){

    const skillOverlay=$("skillQuickBar");
    const itemOverlay=$("itemMenu");
    const turnRow=$("turnTargetRow");

    if(!turnRow){
        return;
    }

    const skillOpen=!!(
        skillOverlay &&
        skillOverlay.classList.contains("show")
    );

    const itemOpen=!!(
        itemOverlay &&
        itemOverlay.classList.contains("show")
    );

    turnRow.classList.toggle(
        "skill-picker-open",
        skillOpen && !itemOpen
    );

    turnRow.classList.toggle(
        "battle-item-open",
        itemOpen
    );
}


function toggleSkillQuickBar(){

    const overlay=
        $("skillQuickBar");


    if(!overlay){
        return;
    }


    const grid=
        $("skillQuickBarGrid");


    /*
       å¦‚æžœç›®å‰æ˜¯ç©ºçš„ï¼ˆä¾‹å¦‚é‚„æ²’è¼ªåˆ°çŽ©å®¶ã€
       æˆ–æ˜¯è‡ªå‹•æˆ°é¬¥é–‹å•Ÿä¸­ï¼ŒpopulateSkillQuickBar()
       æ²’æœ‰å¡«å…¥ä»»ä½•æŒ‰éˆ•ï¼‰ï¼Œå°±ä¸è¦æ‰“é–‹ä¸€å€‹
       ç©ºç©ºçš„è¦†è“‹å±¤ã€‚
    */

    if(
        !overlay.classList.contains("show") &&
        grid &&
        grid.innerHTML.trim()===""
    ){
        return;
    }


    overlay.classList.toggle(
        "show"
    );

    syncTurnTimerWithBattlePickers();

}


function getBattleActionDisplayName(actionType){

    if(actionType==="normal"){
        return "æ™®é€šæ”»æ“Š";
    }

    const skill=
        skillDatabase[actionType];

    return (
        skill && skill.name
        ? skill.name
        : actionType
    );
}


function getBattleActionTargetType(actionType,characterIndex){
    if(actionType==="normal"){ return "single"; }
    const skill=skillDatabase[actionType];
    if(!skill){ return "single"; }
    const key=getPartyCharacterKey(characterIndex);
    const level=key?getSkillLevel(key,actionType):1;
    return normalizeBattleTargetType(getEffectiveSkillTargetType(skill,Math.max(1,level||1)));
}

function setBattleTargetSelectionMode(actionType){
    const region=$("battleActionRegion");
    const promptAction=$("battleTargetPromptAction");
    const targetType=getBattleActionTargetType(actionType,activeBattleCharacterIndex);

    if(region){ region.classList.add("target-selecting"); }
    if(promptAction){ promptAction.textContent="é¸æ“‡ ["+getBattleActionDisplayName(actionType)+"]"; }
    currentBattleMonsters.forEach(index=>{
        const card=$("battleMonster"+index);
        if(card){ card.classList.toggle("targetable",canSelectHostileBattlePrimary("monster",index,targetType)); }
    });
    const targetText=$("battleTarget");
    if(targetText){ targetText.textContent="ç›®æ¨™ï¼šè«‹é¸æ“‡"; }
}

function clearBattleTargetSelectionMode(){

    const region=$("battleActionRegion");

    if(region){
        region.classList.remove("target-selecting");
    }
    document
        .querySelectorAll(
            ".battle-monster.targetable, .battle-monster.target, "+
            ".battle-player.ally-targetable, .battle-player.ally-target"
        )
        .forEach(card=>{
            card.classList.remove(
                "targetable",
                "target",
                "ally-targetable",
                "ally-target"
            );
        });
}



/* =====================================================
   V119 â€” æˆ‘æ–¹å–®é«”æŠ€èƒ½ç›®æ¨™é¸æ“‡
   æ²»ç™‚è¡“ï¼å¾©æ´»è¡“ï¼éš±èº«è¡“ï¼è¬è±¡åœŸç›¾ï¼çµç•Œä½¿ç”¨ç¾æœ‰çŽ©å®¶å¡ç‰‡é¸äººï¼Œ
   ä¸å†å¯«æ­»åªå°è§’è‰²ä¸€è™Ÿè‡ªå·±ç”Ÿæ•ˆã€‚å…¨é«”æŠ€èƒ½ä»ç›´æŽ¥å®£å‘Šï¼Œä¸å¤šä¸€æ­¥é¸æ“‡ã€‚
===================================================== */
function getBattleCharacterByIndex(index){
    return getPartyCharacterByIndex(index);
}

function isValidAllyTargetForSkill(skill,character,index){
    if(!skill || !character){ return false; }

    if(skill.targetType==="deadAlly"){
        return character.hp<=0;
    }

    return character.hp>0;
}

function setBattleAllyTargetSelectionMode(actionType){
    const skill=skillDatabase[actionType];
    const region=$("battleActionRegion");
    const promptAction=$("battleTargetPromptAction");

    if(region){ region.classList.add("target-selecting"); }

    if(promptAction){
        promptAction.textContent="é¸æ“‡ ["+getBattleActionDisplayName(actionType)+"] çš„æˆ‘æ–¹ç›®æ¨™";
    }

    currentBattleMonsters.forEach(index=>{
        const card=$("battleMonster"+index);
        if(card){ card.classList.remove("targetable","target"); }
    });

    [0,1,2].forEach(index=>{
        const character=getBattleCharacterByIndex(index);
        const card=$("battlePlayerCard"+index);
        if(card){
            card.classList.toggle(
                "ally-targetable",
                isValidAllyTargetForSkill(skill,character,index)
            );
        }
    });

    const targetText=$("battleTarget");
    if(targetText){ targetText.textContent="ç›®æ¨™ï¼šè«‹é¸æ“‡æˆ‘æ–¹è§’è‰²"; }
}

function selectBattleAllyTarget(index){
    if(
        !battleActive ||
        battlePhase!=="declare" ||
        !actionReady ||
        !pendingAction
    ){
        return;
    }

    const skill=skillDatabase[pendingAction];
    const character=getBattleCharacterByIndex(index);

    if(
        !skill ||
        !(skill.targetType==="ally" || skill.targetType==="allyTri" || skill.targetType==="deadAlly") ||
        !isValidAllyTargetForSkill(skill,character,index)
    ){
        return;
    }

    const action=pendingAction;
    actionReady=false;
    pendingAction=null;

    clearBattleTargetSelectionMode();

    queuedPlayerActions[activeBattleCharacterIndex]={
        action:action,
        target:null,
        targetAlly:index
    };

    finishPlayerAction();
}


/* V99 â€” åœ¨å·²é¸æŠ€èƒ½ã€ç­‰å¾…é»žæ€ªç‰©ç›®æ¨™çš„éšŽæ®µå…è¨±ã€Œè¿”å›žã€ã€‚
   åªå–æ¶ˆå°šæœªé€é€² queuedPlayerActions çš„æš«å­˜å®£å‘Šï¼Œä¸æŽ¨é€²å›žåˆã€
   ä¸é‡è¨­è¨ˆæ™‚å™¨ï¼Œä¹Ÿä¸æ‰£ SPï¼›è‹¥å‰›æ‰èª¤é¸çš„æ˜¯æŠ€èƒ½ï¼Œå°±ç›´æŽ¥å›žåˆ°
   åŒä¸€è§’è‰²çš„æŠ€èƒ½é¸æ“‡æ¡†ï¼Œæ™®é€šæ”»æ“Šå‰‡å›žåˆ°äº”é¡†æˆ°é¬¥æŒ‡ä»¤ã€‚ */
function returnFromBattleTargetSelection(){

    if(
        !battleActive ||
        battlePhase!=="declare" ||
        !actionReady ||
        !pendingAction
    ){
        return;
    }

    const cancelledAction=pendingAction;

    actionReady=false;
    pendingAction=null;

    clearBattleTargetSelectionMode();

    const targetText=$("battleTarget");
    if(targetText){
        targetText.textContent="ç›®æ¨™ï¼šå°šæœªé¸æ“‡";
    }

    if(cancelledAction!=="normal" && skillDatabase[cancelledAction]){
        populateSkillQuickBar();
        const overlay=$("skillQuickBar");
        if(overlay){
            overlay.classList.add("show");
        }
        syncTurnTimerWithBattlePickers();
    }
}


function clearActiveCharacterHighlight(){

    [0,1,2].forEach(i=>{
        const card=$("battlePlayerCard"+i);
        if(card){
            card.classList.remove(
                "active-turn"
            );
        }
    });
}


function updateActiveCharacterHighlight(){

    for(
        let i=0;
        i<3;
        i++
    ){

        const card=
            $("battlePlayerCard"+i);


        if(!card){
            continue;
        }


        card.classList.toggle(
            "active-turn",
            i===
            activeBattleCharacterIndex
        );

    }

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œç‰ˆé¢é‡æ–°è¨­è¨ˆï¼‰ï¼š
       åŽŸæœ¬é€™è£¡æœƒæ‰¾å·¦å´ç›´æ›¸çš„activeTurnLabel
       çª„æ¢ï¼ŒæŠŠç›®å‰è¼ªåˆ°èª°çš„åå­—å¯«é€²åŽ»ã€‚
       é€™å€‹å…ƒç´ å·²ç¶“æ‹¿æŽ‰ï¼ˆæ”¹æˆã€ŒæŠ€èƒ½ã€æŒ‰éˆ•ï¼‰ï¼Œ
       ç¾åœ¨ã€Œè¼ªåˆ°èª°ã€å–®ç´”é ä¸Šé¢
       battlePlayerCardçš„active-turnå¤–æ¡†
       é«˜äº®é¡¯ç¤ºï¼Œä¸éœ€è¦å¦å¤–çš„æ–‡å­—æ¨™ç±¤ã€‚
    */

}


function updateTimer(){

    const timerEl=
        $("timer");


    timerEl.textContent =
        timer;


    timerEl.classList
        .toggle(
            "danger",
            timer<=5
        );


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       æ¯è®€ç§’ä¸€æ¬¡ï¼Œæ•¸å­—å°±çªç„¶æ”¾å¤§å†çž¬é–“ç¸®å°ï¼Œ
       è£½é€ ã€Œè·³å‹•ã€çš„æ„Ÿè¦ºï¼Œè®“å€’æ•¸è¨ˆæ™‚
       æ›´é¡¯çœ¼ã€æ›´å®¹æ˜“æ³¨æ„åˆ°æ™‚é–“åœ¨æµé€ã€‚
       ç”¨ç§»é™¤å†å¼·åˆ¶è§¸ç™¼reflowå†åŠ å›žclassçš„
       æ–¹å¼ï¼Œç¢ºä¿é€£çºŒå…©æ¬¡éƒ½æ˜¯åŒä¸€å€‹æ•¸å­—
       ï¼ˆä¾‹å¦‚éƒ½è·³éŽ5ç§’çš„é–€æª»ï¼‰æ™‚ï¼Œ
       å‹•ç•«é‚„æ˜¯èƒ½é‡æ–°æ’­æ”¾ä¸€æ¬¡ï¼Œä¸æœƒå› ç‚º
       classæ²’æœ‰è®ŠåŒ–è€Œè¢«ç€è¦½å™¨å¿½ç•¥ã€‚
    */

    timerEl.classList
        .remove("timer-tick");


    void timerEl.offsetWidth;


    timerEl.classList
        .add("timer-tick");

}


function timeoutTurn(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    addBattleLog(
        "â° æ™‚é–“åˆ°ï¼Œæœ¬å›žåˆæ²’æœ‰è¡Œå‹•ã€‚"
    );


    actionReady=false;

    pendingAction=null;


    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œå¾¹åº•æª¢æŸ¥å¾Œ
       æŠ“åˆ°çš„å¦ä¸€å€‹æ½›åœ¨é¢¨éšªï¼‰ï¼š
       é€™è£¡åŽŸæœ¬è‡ªå·±åˆé‡å¯«äº†ä¸€æ¬¡ã€Œå®£å‘Šé€¾æ™‚
       å¾€ä¸‹ä¸€ä½ã€è·Ÿã€Œçµç®—é€¾æ™‚å¾€ä¸‹ä¸€å€‹
       initiativeIndexã€çš„é‚è¼¯ï¼Œè·Ÿ
       finishPlayerAction()è£¡è™•ç†çš„æ˜¯åŒä¸€ä»¶äº‹ï¼Œ
       å»æ˜¯å…©ä»½å®Œå…¨ç¨ç«‹ã€äº’ä¸çŸ¥æƒ…çš„å¯¦ä½œ
       ï¼ˆé€£delayæ™‚é–“éƒ½ä¸ä¸€æ¨£ï¼Œä¸€å€‹120msã€
       ä¸€å€‹1200ms/1700msï¼‰ã€‚

       å…©å¥—å¯¦ä½œå„è‡ªç¶­è­·åŒä¸€ä»½ç‹€æ…‹
       ï¼ˆactiveBattleCharacterIndexï¼
       initiativeIndexï¼‰ï¼Œåªè¦æ—¥å¾Œæ”¹ä¸€é‚Šã€
       å¿˜äº†æ”¹å¦ä¸€é‚Šï¼Œæˆ–æ˜¯é€™è£¡çœŸçš„è¢«è§¸ç™¼åˆ°
       è·ŸfinishPlayerAction()åŒæ™‚æ¶è‘—æŽ¨é€²ï¼Œ
       å°±æœƒè£½é€ å‡ºç´¢å¼•è¢«æŽ¨é€²å…©æ¬¡ã€
       æŸå€‹è§’è‰²æˆ–æ€ªç‰©çš„è¡Œå‹•è¢«è·³éŽçš„é‚£é¡žå•é¡Œ
       â€”â€”é€™æ­£æ˜¯é€™å¹¾è¼ªä¸€ç›´åœ¨æŠ“çš„bugåž‹æ…‹ã€‚

       æ”¹æˆç›´æŽ¥å‘¼å«finishPlayerAction()ï¼Œ
       è®“ã€Œæ€Žéº¼æŽ¨é€²åˆ°ä¸‹ä¸€ä½ã€æ°¸é åªæœ‰
       ä¸€å€‹åœ°æ–¹åœ¨åšæ±ºå®šï¼Œé€™è£¡ä¸å†è‡ªå·±ç¶­è­·
       ç¬¬äºŒå¥—é‚è¼¯ã€‚
    */

    finishPlayerAction();

}


/* =====================================================
   è¡Œå‹•
===================================================== */

function prepareAction(type){

    /*
       â˜… ä¿®æ­£ï¼š
       åŽŸæœ¬é€™è£¡æ°¸é æª¢æŸ¥player.spã€
       æ°¸é å‡è¨­æ“ä½œçš„æ˜¯ç¬¬ä¸€è§’è‰²ã€‚
       ç¾åœ¨æ”¹æˆå…ˆçœ‹
       activeBattleCharacterIndexæ˜¯èª°çš„å›žåˆï¼Œ
       ç”¨å°æ‡‰è§’è‰²çš„æŠ€èƒ½é»ž/SP/è‡ªå‹•ç‹€æ…‹ä¾†åˆ¤æ–·ã€‚
    */

    const activeCharacter=
        getPartyCharacterByIndex(activeBattleCharacterIndex);

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    if(
        !battleActive ||
        battlePhase!=="declare" ||
        !activeCharacter ||
        activeCharacter.hp<=0 ||
        autoOn ||
        actionReady
    ){
        return;
    }


    const skill =
        skillDatabase[type];

    if(type!=="normal"&&(!skill||skill.category==="passive")){ return; }

    const activeSkillKey=getPartyCharacterKey(activeBattleCharacterIndex);
    const activeLoadout=characterSkillLoadouts[activeSkillKey];


    if(
        type!=="normal"&&
        skill
    ){
        if(!activeLoadout||!(activeLoadout.skillLevels&&Number(activeLoadout.skillLevels[type])>0)||
            !Array.isArray(activeLoadout.equippedSkills)||!activeLoadout.equippedSkills.includes(type)){
            addBattleLog("å°šæœªå­¸æœƒæˆ–è£å‚™ã€Œ"+skill.name+"ã€ã€‚");
            return;
        }

        const spCost =
            skill.spCost!==undefined
            ?
            skill.spCost
            :
            skill.cost;


        if(
            activeCharacter.sp<spCost
        ){

            addBattleLog(
                "SPä¸è¶³ï¼Œç„¡æ³•ä½¿ç”¨"+
                skill.name
            );

            return;

        }


        /*
           â˜… ä¿®æ­£ï¼ˆé‡è¦ï¼Œä¾ç…§ä½¿ç”¨è€…æ˜Žç¢ºæŒ‡æ­£ï¼‰ï¼š
           å¢žç›Š/æ²»ç™‚/å¾©æ´»é€™é¡žæŠ€èƒ½ä¹‹å‰æ˜¯ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
           å®Œå…¨ç¹žéŽå®£å‘Š/çµç®—æ©Ÿåˆ¶ã€‚

           ä½†çŽ©å®¶æ˜Žç¢ºæŒ‡å‡ºï¼šå›žåˆåˆ¶çš„æ ¸å¿ƒç²¾ç¥žæ˜¯
           ã€Œæ‰€æœ‰è¡Œå‹•éƒ½è¦ç…§æ•æ·é †åºçµç®—ã€ï¼Œ
           æ²»ç™‚/å¢žç›Šä¹Ÿä¸ä¾‹å¤–â€”â€”æ•æ·å¤ªä½Žçš„è©±ï¼Œ
           æƒ³å¹«éšŠå‹è£œè¡€ï¼Œå¯èƒ½é‚„æ²’è¼ªåˆ°ä½ ï¼Œ
           éšŠå‹å·²ç¶“è¢«æ‰“æ­»äº†ï¼Œé€™æ‰æ˜¯æ•æ·é€™å€‹æ•¸å€¼
           è©²æœ‰çš„é‡è¦æ€§ï¼Œä¸èƒ½è®“æ²»ç™‚/å¢žç›Šè®Šæˆ
           ã€Œç„¡è¦–é †åºã€é»žäº†å°±ç”Ÿæ•ˆã€çš„ç‰¹ä¾‹ã€‚

           æ”¹æˆè·Ÿå‚·å®³æŠ€èƒ½ä¸€æ¨£ï¼Œå…ˆã€Œå®£å‘Šã€å­˜èµ·ä¾†ï¼Œ
           ç­‰çµç®—éšŽæ®µç…§æ•æ·é †åºæ‰çœŸæ­£ç”Ÿæ•ˆã€‚
        */

        if(
            skill.category==="buff"||
            skill.category==="heal"||
            skill.category==="revive"
        ){

            /* å–®é«”æˆ‘æ–¹æŠ€èƒ½å…ˆé¸è§’è‰²ï¼›å…¨é«”æŠ€èƒ½ç¶­æŒç›´æŽ¥å®£å‘Šã€‚ */
            if(skill.targetType==="ally" || skill.targetType==="allyTri" || skill.targetType==="deadAlly"){

                const hasValidTarget=[0,1,2].some(index=>
                    isValidAllyTargetForSkill(
                        skill,
                        getBattleCharacterByIndex(index),
                        index
                    )
                );

                if(!hasValidTarget){
                    const rejectionMessage=skill.targetType==="deadAlly"
                        ? "æˆ‘æ–¹ç›®å‰æ²’æœ‰äººæ­»äº¡ï¼Œç„¡æ³•ä½¿ç”¨å¾©æ´»è¡“ã€‚"
                        : "ç›®å‰æ²’æœ‰å¯é¸æ“‡çš„å‹æ–¹ç›®æ¨™ã€‚";
                    addBattleLog(rejectionMessage);
                    showBattleActionNotice(rejectionMessage);
                    return;
                }

                actionReady=true;
                pendingAction=type;
                closeMenus();
                setBattleAllyTargetSelectionMode(type);
                return;
            }

            actionReady=true;

            queuedPlayerActions[activeBattleCharacterIndex]={
                action:type,
                target:null,
                targetAlly:null
            };

            closeMenus();
            updateUI();
            finishPlayerAction();
            return;
        }

    }


    const hostileTargetType=getBattleActionTargetType(type,activeBattleCharacterIndex);

    const hasSelectablePrimary=currentBattleMonsters.some(index=>
        canSelectHostileBattlePrimary("monster",index,hostileTargetType)
    );
    if(!hasSelectablePrimary){
        addBattleLog("ç›®å‰æ²’æœ‰å¯è¢«"+getBattleActionDisplayName(type)+"é¸ä¸­çš„ç›®æ¨™ã€‚");
        return;
    }

    actionReady=true;
    pendingAction=type;
    closeMenus();
    setBattleTargetSelectionMode(type);

}


function selectBattleTarget(index){

    if(
        !battleActive ||
        !monsters[index] ||
        !monsters[index].alive
    ){
        return;
    }

    /* During a real hostile-target declaration, Stealth and the formal
       Target Shape gate primary selection. Outside declaration mode this
       helper may still project an already-resolved/programmatic target
       (Boss objects, QA, replay/presentation) without inventing an action. */
    if(actionReady&&pendingAction){
        const targetType=getBattleActionTargetType(pendingAction,activeBattleCharacterIndex);
        if(!canSelectHostileBattlePrimary("monster",index,targetType)){ return; }
    }

    selectedMonster=index;


    document
    .querySelectorAll(
        ".battle-monster"
    )
    .forEach(card=>{
        card.classList.remove(
            "target"
        );
    });


    const target =
        $("battleMonster"+index);


    if(target){

        target.classList.add(
            "target"
        );

    }


    $("battleTarget")
        .textContent =

        "ç›®æ¨™ï¼š"+
        monsters[index].name;


    /*
       â˜… ä¿®æ­£ï¼š
       åŽŸæœ¬åªæª¢æŸ¥å…¨åŸŸçš„autoBattleï¼Œ
       ç¾åœ¨è¦çœ‹ç›®å‰è¼ªåˆ°èª°çš„å›žåˆï¼Œ
       ç”¨å°æ‡‰è§’è‰²çš„è‡ªå‹•é–‹é—œä¾†åˆ¤æ–·ã€‚
    */

    const autoOn=
        activeBattleCharacterIndex===0
        ? autoBattle
        : getPartyAutoConfig(activeBattleCharacterIndex).enabled;


    if(
        actionReady &&
        pendingAction &&
        !autoOn
    ){

        const action =
            pendingAction;


        actionReady=false;

        pendingAction=null;

        clearBattleTargetSelectionMode();


        /*
           â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
           é»žé¸ç›®æ¨™ä¹‹å¾Œï¼Œä¸å†é¦¬ä¸ŠåŸ·è¡Œæ”»æ“Šï¼Œ
           è€Œæ˜¯å…ˆæŠŠã€Œé€™å€‹è§’è‰²æ±ºå®šè¦åšçš„äº‹ã€
           å­˜é€²queuedPlayerActionsï¼Œ
           ç­‰æ‰€æœ‰æ´»è‘—çš„è§’è‰²éƒ½é¸å¥½äº†ï¼Œ
           æ‰æœƒåœ¨çµç®—éšŽæ®µä¾æ•æ·é †åºçœŸæ­£å‡ºæ‰‹ã€‚
        */

        queuedPlayerActions[
            activeBattleCharacterIndex
        ]={

            action:action,

            target:index

        };


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
           ä¸éœ€è¦åœ¨å®£å‘ŠéšŽæ®µå°±å…ˆå°ä¸€è¡Œ
           ã€Œå·²é¸æ“‡XXï¼Œç›®æ¨™ï¼šYYã€æµªè²»ç•«é¢ç©ºé–“ã€
           æµªè²»æ™‚é–“è®“çŽ©å®¶ç­‰ï¼Œç›´æŽ¥é€²çµç®—éšŽæ®µï¼Œ
           ç­‰çœŸæ­£é€ æˆå‚·å®³çš„é‚£ä¸€åˆ»ï¼Œ
           å†é¡¯ç¤ºã€Œèª°ç”¨äº†ä»€éº¼æŠ€èƒ½æ‰“äº†èª°ã€
           é€ æˆå¤šå°‘å‚·å®³ã€åˆä½µæˆä¸€è¡Œå°±å¥½ã€‚
        */

        finishPlayerAction();

    }

}


function executeAction(action){

    /*
       â˜… ä¿®æ­£ï¼š
       åŽŸæœ¬é€™è£¡æ°¸é æ“ä½œç¬¬ä¸€è§’è‰²ã€‚
       ç¾åœ¨å…ˆåˆ¤æ–·ç›®å‰æ˜¯ä¸æ˜¯ç¬¬äºŒè§’è‰²çš„å›žåˆï¼Œ
       æ˜¯çš„è©±èµ°player2å°ˆå±¬çš„æ–½æ”¾å‡½å¼
       ï¼ˆcastPlayer2Skill/player2NormalAttackï¼‰ï¼Œ
       ä¸¦ä¸”è¦è‡ªå·±å‘¼å«finishPlayerAction()
       å¾€ä¸‹æŽ¨é€²åˆ°ä¸‹ä¸€ä½è§’è‰²/æ€ªç‰©å›žåˆ
       ï¼ˆplayer2çš„å‡½å¼æœ¬èº«ä¸æœƒè‡ªå‹•å‘¼å«é€™å€‹ï¼Œ
       å› ç‚ºè‡ªå‹•æ¨¡å¼é‚£é‚Šä¹Ÿæ˜¯å‘¼å«å®Œæ‰å‘¼å«ä¸€æ¬¡ï¼Œ
       æ‰‹å‹•é€™é‚Šè¦å°ç¨±è™•ç†ï¼‰ã€‚
    */

    const isPlayer2Turn=

        activeBattleCharacterIndex===1;


    if(isPlayer2Turn){

        if(action==="normal"){

            player2NormalAttack(
                selectedMonster
            );


            updateUI();

            finishPlayerAction();

            return;

        }


        const skill2=
            skillDatabase[action];


        if(
            skill2 &&
            skill2.category!=="buff"&&
            skill2.category!=="passive"&&
            skill2.category!=="heal"&&
            skill2.category!=="revive"
        ){

            castPlayer2Skill(
                action,
                selectedMonster
            );


            updateUI();

            finishPlayerAction();

            return;

        }


        return;

    }


    if(action==="normal"){
        normalAttack();
        return;
    }

    if(action==="windArrow"){
        windArrowAttack();
        return;
    }


    /*
       â˜… æ–°ç‰ˆè³‡æ–™é©…å‹•æŠ€èƒ½ï¼ˆç«ç³»10å€‹æŠ€èƒ½è£¡ï¼Œ
       æœ‰å‚·å®³è¼¸å‡ºçš„8å€‹éƒ½æœƒèµ°é€™è£¡ï¼Œ
       æ°´ç³»çš„å‚·å®³æŠ€èƒ½ä¹‹å¾Œä¹Ÿæœƒèµ°é€™è£¡ï¼‰ã€‚
       æ€’ç«ï¼ˆbuffï¼‰ã€æ²»ç™‚è¡“ï¼ˆhealï¼‰ã€
       å¾©æ´»è¡“ï¼ˆreviveï¼‰éƒ½ä¸æœƒèµ°åˆ°é€™è£¡ï¼Œ
       å› ç‚ºprepareAction()å·²ç¶“æŠŠå®ƒå€‘æ””æˆªæŽ‰äº†ï¼Œ
       é€™è£¡å¤šæŽ’é™¤ä¸€æ¬¡ç´”ç²¹æ˜¯é˜²å‘†ï¼Œ
       é¿å…è¬ä¸€æœ‰æŠ€èƒ½ç¹žéŽprepareAction()
       èª¤æŠŠæ²»ç™‚/å¾©æ´»æŠ€èƒ½ç•¶æˆå‚·å®³æŠ€èƒ½ä¾†æ‰“ã€‚
    */

    const skill =
        skillDatabase[action];


    if(
        skill &&
        skill.category!=="buff"&&
        skill.category!=="passive"&&
        skill.category!=="heal"&&
        skill.category!=="revive"
    ){

        castDamageSkill(action);

        return;

    }

}


/* =====================================================
   å‚·å®³
===================================================== */

/*
   V173.38ï¼šçŽ©å®¶ã€æ€ªç‰©ã€æ™®é€šæ”»æ“Šèˆ‡æŠ€èƒ½å…±ç”¨å”¯ä¸€æ­£å¼å‚·å®³ ownerã€‚
   é †åºï¼šç­‰ç´šã€å…ƒç´ ã€é˜²ç¦¦ã€æ™®é€šå¢žå‚·åŠ ç®—æ¡¶ã€çˆ†æ“Šã€æ•µæ–¹å£“åŠ›ã€
   æŠ€èƒ½å‚·å®³é ç®—ã€95%ï½ž105% æµ®å‹•ã€‚
*/

const LEVEL_DIFF_FACTOR_PER_LEVEL_PHYSICAL = 0.01;
const LEVEL_DIFF_FACTOR_MIN_PHYSICAL = 0.85;
const LEVEL_DIFF_FACTOR_MAX_PHYSICAL = 1.15;

const DAMAGE_FORMULA_BASE_CONSTANT = 400;
const DAMAGE_FORMULA_PER_TARGET_LEVEL = 10;
const NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX = 1.50;
const FINAL_CRITICAL_MULTIPLIER_MAX = 2.25;

const ENEMY_PRESSURE_RANK_BONUS = Object.freeze({
    regular:0,
    elite:0.10,
    boss:0.20
});
const ENEMY_PRESSURE_DAILY_DUNGEON_BONUS = 0.05;
const ENEMY_PRESSURE_ABYSS_BONUS = 0.15;

function getDamageFormulaConstant(targetLevel){
    const resolvedTargetLevel=Math.max(1,Number(targetLevel)||1);
    return DAMAGE_FORMULA_BASE_CONSTANT+resolvedTargetLevel*DAMAGE_FORMULA_PER_TARGET_LEVEL;
}

function getDamageLevelMultiplier(casterLevel,targetLevel){
    const levelDiff=(Number(casterLevel)||1)-(Number(targetLevel)||1);
    return Math.max(
        LEVEL_DIFF_FACTOR_MIN_PHYSICAL,
        Math.min(LEVEL_DIFF_FACTOR_MAX_PHYSICAL,1+levelDiff*LEVEL_DIFF_FACTOR_PER_LEVEL_PHYSICAL)
    );
}

window.v173GetDamageFormulaConstant=getDamageFormulaConstant;
window.v173GetDamageLevelMultiplier=getDamageLevelMultiplier;

const ELEMENT_COUNTER_MAP = {
    earth:"water",
    water:"fire",
    fire:"wind",
    wind:"earth"
};
const ELEMENT_ADVANTAGE_MULTIPLIER = 1.20;
const ELEMENT_DISADVANTAGE_MULTIPLIER = 0.85;

function getElementalDamageMultiplier(casterElement,targetElement){
    if(!casterElement||!targetElement){ return 1; }
    if(ELEMENT_COUNTER_MAP[casterElement]===targetElement){ return ELEMENT_ADVANTAGE_MULTIPLIER; }
    if(ELEMENT_COUNTER_MAP[targetElement]===casterElement){ return ELEMENT_DISADVANTAGE_MULTIPLIER; }
    return 1;
}

function getDamageContextAttacker(options){
    if(options&&options.attacker){ return options.attacker; }
    if(typeof window.v155GetCurrentDamageActor==="function"){
        return window.v155GetCurrentDamageActor();
    }
    return window.v149CurrentDamageActor||null;
}

function getOrdinaryDamageBonusPercent(options){
    const resolved=options&&typeof options==="object"?options:{};
    const attacker=getDamageContextAttacker(resolved);
    const target=resolved.target||null;
    const skill=resolved.skill||null;
    let total=0;

    if(attacker&&typeof getElementDamagePassiveMultiplier==="function"){
        total+=(Math.max(0,Number(getElementDamagePassiveMultiplier(attacker))||1)-1)*100;
    }
    if(
        attacker&&target&&attacker.element==="fire"&&
        typeof getLearnedElementEX==="function"&&getLearnedElementEX(attacker,"fire")&&
        Array.isArray(target.statusEffects)&&
        target.statusEffects.some(effect=>effect&&Number(effect.turnsLeft)>0)
    ){
        total+=Number(skillDatabase.fireEX&&skillDatabase.fireEX.statusTargetDamageBonusPercent)||0;
    }
    if(attacker&&typeof window.v155GetPhoenixMightMultiplier==="function"){
        total+=(Math.max(0,Number(window.v155GetPhoenixMightMultiplier(attacker))||1)-1)*100;
    }
    if(skill&&Number.isFinite(Number(skill.damageBonusPercent))){
        total+=Number(skill.damageBonusPercent);
    }
    if(attacker&&typeof window!=="undefined"&&window.FourSymbolsSkillDamageContext&&
        window.FourSymbolsSkillDamageContext.attacker===attacker&&
        window.FourSymbolsSkillDamageContext.skill===skill){
        total+=Number(window.FourSymbolsSkillDamageContext.directSkillBonusPercent)||0;
    }

    const extras=Array.isArray(resolved.ordinaryDamageBonusPercent)
        ?resolved.ordinaryDamageBonusPercent
        :[resolved.ordinaryDamageBonusPercent];
    extras.forEach(value=>{
        if(Number.isFinite(Number(value))){ total+=Number(value); }
    });

    if(attacker&&typeof getOutgoingDamageDownPercent==="function"){
        total-=getOutgoingDamageDownPercent(attacker);
    }
    return Math.max(-100,Math.min(50,total));
}

function getOrdinaryDamageMultiplier(options){
    return Math.max(
        0,
        Math.min(NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX,1+getOrdinaryDamageBonusPercent(options)/100)
    );
}

function isPartyDamageTarget(entity){
    return !!(
        entity&&typeof getPartyCharacterIndex==="function"&&getPartyCharacterIndex(entity)>=0
    );
}

function getEnemyPressureMultiplier(attacker,target){
    if(!attacker||!target||isPartyDamageTarget(attacker)||!isPartyDamageTarget(target)){
        return 1;
    }
    if(["wild","daily","tower","abyss"].includes(attacker.mode)&&attacker.balanceOwner==="MonsterBalance"){
        return attacker.balanceProjection.finalDamagePressure;
    }
    const rank=typeof getMonsterRank==="function"?getMonsterRank(attacker):"regular";
    let bonus=ENEMY_PRESSURE_RANK_BONUS[rank]||0;
    if(attacker.v141Abyss){ bonus+=ENEMY_PRESSURE_ABYSS_BONUS; }
    else if(attacker.v132Dungeon||attacker.v132EquipmentDungeon){
        bonus+=ENEMY_PRESSURE_DAILY_DUNGEON_BONUS;
    }
    return 1+bonus;
}

function getDamageBudgetMultiplier(skillOrOptions){
    const options=skillOrOptions&&typeof skillOrOptions==="object"?skillOrOptions:{};
    const skill=options.skill||options;
    const explicit=Number(options.damageBudgetMultiplier);
    const configured=Number(skill&&skill.damageBudgetMultiplier);
    if(Number.isFinite(explicit)){ return Math.max(0,explicit); }
    if(Number.isFinite(configured)){ return Math.max(0,configured); }
    return 1;
}

window.v173GetOrdinaryDamageBonusPercent=getOrdinaryDamageBonusPercent;
window.v173GetOrdinaryDamageMultiplier=getOrdinaryDamageMultiplier;
window.v173GetEnemyPressureMultiplier=getEnemyPressureMultiplier;
window.v173GetDamageBudgetMultiplier=getDamageBudgetMultiplier;

/* Tower modifiers only project explicit tower metadata into the canonical owners. */
function getTowerDirectDamageMultiplier(attacker,damageOptions){
    const options=damageOptions||{};
    const kind=String(options.damageKind||"direct");
    const skill=options.skill;
    const directSkill=!skill||skill.category==="physical"||skill.category==="magic";
    return attacker&&attacker.vGameplayTower===true&&attacker.canAct!==false&&
        attacker.vGameplayBossObject!==true&&kind==="direct"&&directSkill
        ?Math.max(1,Number(attacker.vTowerDirectDamageMultiplier)||1):1;
}
function getTowerStatusAccuracyBonus(caster){
    return caster&&caster.vGameplayTower===true&&caster.canAct!==false
        ?Number(caster.vTowerStatusAccuracyPercent)||0:0;
}
function getMonsterCriticalChance(monster,targetAntiCrit=0){
    const rage=getActiveRageCriticalBonuses(monster);
    const towerBonus=monster&&monster.vGameplayTower===true?Number(monster.vTowerCriticalBonusPercent)||0:0;
    const baseChance=10+rage.chance+towerBonus;
    const chance=monster&&monster.vGameplayTower===true?Math.min(CRIT_CHANCE_MAX,baseChance):baseChance;
    return Math.max(CRIT_CHANCE_MIN_AFTER_ANTI_CRIT,chance-(Number(targetAntiCrit)||0));
}
function calculateDamage(
    attack,
    defense,
    casterLevel,
    targetLevel,
    casterElement,
    targetElement,
    damageOptions
){
    const options=damageOptions&&typeof damageOptions==="object"?damageOptions:{};
    const safeAttack=Math.max(0,Number(attack)||0);
    const safeDefense=Math.max(0,Number(defense)||0);
    const levelFactor=getDamageLevelMultiplier(casterLevel,targetLevel);
    /* Element counter is character DNA, never the skill visual identity. */
    const attacker=getDamageContextAttacker(options);
    const elementFactor=getElementalDamageMultiplier((attacker&&attacker.element)||casterElement,targetElement);
    const formulaConstant=getDamageFormulaConstant(targetLevel);
    const defenseFactor=formulaConstant/(formulaConstant+safeDefense);
    const ordinaryFactor=getOrdinaryDamageMultiplier(options);
    const requestedCrit=Number(options.critMultiplier);
    const criticalFactor=Number.isFinite(requestedCrit)
        ?Math.max(1,Math.min(FINAL_CRITICAL_MULTIPLIER_MAX,requestedCrit))
        :1;
    const pressureFactor=getEnemyPressureMultiplier(attacker,options.target||null);
    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    const bossDamageFactor=bossOwner&&typeof bossOwner.getOutgoingDamageMultiplier==="function"
        ?Math.max(0,Number(bossOwner.getOutgoingDamageMultiplier(attacker))||0):1;
    const towerFactor=getTowerDirectDamageMultiplier(attacker,options);
    const budgetFactor=getDamageBudgetMultiplier(options);
    const randomFactor=0.95+Math.random()*0.10;

    const result=
        safeAttack*levelFactor*elementFactor*defenseFactor*
        ordinaryFactor*criticalFactor*pressureFactor*bossDamageFactor*towerFactor*budgetFactor*randomFactor;

    if(!Number.isFinite(result)){ return 1; }
    return Math.max(1,Math.round(result));
}

/* =====================================================
   å‘½ä¸­ï¼é–ƒèº²å”¯ä¸€æ­£å¼å…¬å¼ Owner

   æœ€çµ‚å‘½ä¸­çŽ‡ =
   95 + å‘½ä¸­% + æœ€çµ‚å‘½ä¸­åŠ æˆ
   - ç›®æ¨™æœ€çµ‚é–ƒèº² - æœ€çµ‚å‘½ä¸­ä¸‹é™ã€‚

   æ‰€æœ‰ç™¾åˆ†æ¯”æ•ˆæžœçš†æ˜¯ã€Œæœ€çµ‚ç™¾åˆ†é»žã€åŠ æ¸›ï¼Œä¸å†å…ˆå°é ‚å‘½ä¸­å¾Œ
   ä¹˜ä¸Š (1 - é–ƒèº²çŽ‡)ã€‚æœ€å¾Œçµ±ä¸€é™åˆ¶åœ¨ 5%ï½ž99%ã€‚
   æ™®é€šæ€ªç‰©æœªæ˜Žç¢ºæŒ‡å®š evasion æ™‚ç‚º 0%ï¼›ç­‰ç´šä¸å½±éŸ¿å‘½ä¸­ï¼é–ƒé¿ã€‚
===================================================== */

const HIT_CHANCE_BASE = 95;
const HIT_CHANCE_MIN_PERCENT = 5;
const HIT_CHANCE_MAX_PERCENT = 99;


/* Evasion, Accuracy, Status Resistance, and Speed are explicit monster combat fields. */

function getMonsterEvasion(monster){

    if(!monster){ return 0; }

    const base=monster.evasion!==undefined
        ?Number(monster.evasion)||0
        :0;

    const frostbitePenalty=getFrostbiteFinalPercentPointPenalty(monster);

    return combineEvasionRates([
        base,
        -frostbitePenalty
    ]);

}


/*
   â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œé‡æ–°è¨­è¨ˆæšˆçœ©
   çŒ›æ“Šçš„æšˆçœ©æ•ˆæžœç®—æ³•ï¼‰ï¼š
   åŽŸæœ¬stuné€™å€‹æ¸›ç›Šæ˜¯åœ¨é€™è£¡ï¼ˆå‘½ä¸­å€¼æœ¬èº«ï¼‰
   æ‰“æŠ˜æ‰£ï¼Œå†è®“æ‰“å®ŒæŠ˜çš„å‘½ä¸­å€¼åŽ»è·‘æ­£å¸¸çš„
   å‘½ä¸­å…¬å¼ï¼Œç­‰æ–¼æ˜¯ã€Œé–“æŽ¥ã€å½±éŸ¿æœ€çµ‚æ©ŸçŽ‡ï¼Œ
   ä½¿ç”¨è€…æœ€æ–°çµ¦çš„æ•¸å€¼æ˜¯ã€Œé™ä½Žæ©ŸçŽ‡ç”±æŠ€èƒ½
   ç­‰ç´šä½Žè‡³é«˜ç‚º-15%/-20%/-25%/-30%/-35%ã€ï¼Œè®€èµ·ä¾†æ˜¯
   ç›´æŽ¥å¾žæœ€çµ‚å‘½ä¸­æ©ŸçŽ‡æ‰£æŽ‰é€™å€‹%æ•¸ï¼Œä¸æ˜¯
   åœ¨å‘½ä¸­å€¼é€™å±¤æ‰“æŠ˜â€”â€”å…©ç¨®ç®—æ³•ç®—å‡ºä¾†çš„
   æœ€çµ‚å‘½ä¸­çŽ‡ä¸ä¸€æ¨£ï¼Œç…§å­—é¢æ„æ€æ”¹æˆ
   ã€Œç›´æŽ¥æ‰£ã€ï¼Œé€™è£¡æ‹¿æŽ‰stunï¼Œåªç•™
   statDownï¼ˆå…¨å±¬æ€§ä¸‹é™é¡ždebuffæ‰æœƒå‹•åˆ°
   å‘½ä¸­å€¼æœ¬èº«ï¼‰ï¼Œæšˆçœ©çš„æ‰£æ¸›ç§»åˆ°
   rollHitChance()è£¡è™•ç†ï¼ˆè¦‹è©²å‡½å¼æ—çš„
   èªªæ˜Žï¼‰ï¼Œå‘¼å«æ™‚æ©Ÿæ˜¯ã€Œé€™éš»æ€ªç‰©çœŸçš„è¦
   å‡ºæ‰‹æ”»æ“Šã€çš„é‚£ä¸€åˆ»ï¼Œæ¯”è¼ƒç¬¦åˆã€Œå‘½ä¸­çŽ‡
   é™ä½Žã€é€™å€‹æè¿°çš„å­—é¢æ„æ€ã€‚
*/

function getMonsterAccuracy(monster){

    const base=

        monster.accuracy!==undefined
        ? monster.accuracy
        : 0;


    return Math.max(0,Number(base)||0);

}


function getMonsterAgility(monster){

    const base=

        monster.agility!==undefined
        ? monster.agility
        : monster.level*1.2;


    const agilityDown=
        getMonsterDebuffValue(
            monster,
            "agilityDown"
        );
    const statDown=
        getStatDownPercentFor(
            monster,
            "agility"
        );


    return Math.max(
        0,
        base*
        (1-agilityDown/100)*
        (1-statDown/100)
    );

}


/*
   â˜… æ–°å¢žï¼ˆé‡è¦ï¼‰ï¼šæ•æ·æŽ’åºçš„è¡Œå‹•é †åºç³»çµ±ã€‚

   è¦æ ¼ï¼šã€Œé›™æ–¹ä¾æ•æ·é«˜ä½Žé †åºå…ˆå¾Œå‡ºæ‰‹è¡Œå‹•ã€â€”â€”
   ä¹‹å‰æ˜¯ã€ŒçŽ©å®¶å…¨éƒ¨è¡Œå‹•å®Œï¼Œæ€ªç‰©æ‰é–‹å§‹æ”»æ“Šã€ï¼Œ
   å…©é‚Šå„è‡ªä¸€æ‰¹ï¼Œç¾åœ¨æ”¹æˆçŽ©å®¶è·Ÿæ€ªç‰©æ··åœ¨ä¸€èµ·ï¼Œ
   ä¾æ•æ·ï¼ˆå«è£å‚™åŠ æˆï¼‰ç”±é«˜åˆ°ä½ŽæŽ’ä¸€ä»½è¡Œå‹•æ¸…å–®ï¼Œ
   é€™ä»½æ¸…å–®åœ¨æ¯å€‹ã€Œå¤§å›žåˆã€é–‹å§‹æ™‚é‡æ–°ç®—ä¸€æ¬¡
   ï¼ˆinitiativeQueueï¼‰ï¼Œ
   ç„¶å¾Œä¸€å€‹ä¸€å€‹ç…§é †åºè™•ç†ï¼ˆprocessNextCombatant()ï¼‰ï¼Œ
   è¼ªåˆ°èª°ã€èª°æ‰è¡Œå‹•ã€‚

   æ•æ·ç›¸åŒæ™‚ä½ è¦æ±‚ã€Œä¸€æ¨£å°±æ˜¯éš¨æ©Ÿã€ï¼Œ
   æ‰€ä»¥æŽ’åºæ™‚é¡å¤–åŠ ä¸€å€‹å°çš„éš¨æ©Ÿäº‚æ•¸å†æ¯”è¼ƒï¼Œ
   æ•æ·ç›¸åŒçš„æƒ…æ³ä¸‹é †åºæœƒéš¨æ©Ÿæ´—ç‰Œï¼Œ
   ä¸æœƒæ¯æ¬¡éƒ½å›ºå®šåŒä¸€å€‹äººå…ˆæ‰‹ã€‚
*/

let initiativeQueue=[];

/*
   â˜… æ–°å¢žï¼šè·ŸdeclaredCharacterIndexesåŒä¸€ç¨®
   é˜²è­·ï¼Œæ“‹æŽ‰æ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/è£œç™¼
   å°Žè‡´processNextCombatant()è¢«åŒä¸€å€‹
   initiativeIndexé‡è¤‡å‘¼å«çš„å•é¡Œã€‚
   æ¯æ¬¡startResolutionPhase()é–‹å§‹æ–°çš„
   çµç®—éšŽæ®µæ™‚æ¸…ç©ºã€‚
*/

let processedInitiativeIndexes=
    new Set();

let initiativeIndex=0;


function buildInitiativeQueue(){

    const list=[];

    getExistingPartyIndexes().forEach(characterIndex=>{
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character || character.hp<=0){ return; }

        list.push({
            type:"player",
            characterIndex:characterIndex,
            agility:getPartyBattleStats(characterIndex).agility
        });
    });


    currentBattleMonsters.forEach(
        i=>{

            if(
                monsters[i] &&
                monsters[i].alive &&
                monsters[i].canAct!==false
            ){

                list.push({

                    type:"monster",

                    monsterIndex:i,

                    agility:
                        getMonsterAgility(
                            monsters[i]
                        )

                });

            }

        }
    );


    /*
       â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ä¹‹å¾Œï¼Œé€™è£¡æ”¹å›žå–®ç´”æŽ’åºï¼‰ï¼š
       ä¹‹å‰é€™è£¡æœ‰å€‹ã€Œç¬¬ä¸€å›žåˆå¼·åˆ¶çŽ©å®¶æŽ’æœ€å‰é¢ã€çš„
       ç‰¹æ®Šè™•ç†ï¼Œæ˜¯åœ¨é‚„æ²’æœ‰å®£å‘Š/çµç®—å…©éšŽæ®µä¹‹å‰
       çš„æš«æ™‚è§£æ³•ã€‚

       ç¾åœ¨æœ‰äº†å®£å‘ŠéšŽæ®µï¼ŒçŽ©å®¶æœ¬ä¾†å°±ä¸€å®šæœƒåœ¨
       çµç®—é–‹å§‹ã€Œä¹‹å‰ã€æŠŠé€™å›žåˆè¦åšä»€éº¼æ±ºå®šå¥½ï¼Œ
       ä¸ç®¡ç¬¬å¹¾å›žåˆéƒ½ä¸€æ¨£ï¼Œæ‰€ä»¥é€™å€‹ç‰¹æ®Šè™•ç†
       å·²ç¶“ä¸éœ€è¦äº†â€”â€”çµç®—éšŽæ®µå–®ç´”ä¾æ•æ·é«˜ä½ŽæŽ’åºå°±å¥½ï¼Œ
       æ•æ·å¿«çš„æ€ªç‰©ä¾ç„¶å¯ä»¥æ¶åˆ°ã€Œçµç®—é †åºã€çš„å…ˆæ‰‹ï¼Œ
       ä½†é‚£å·²ç¶“æ˜¯çŽ©å®¶æ±ºå®šå¥½è¡Œå‹•ä¹‹å¾Œçš„äº‹äº†ï¼Œ
       ä¸æœƒå†æœ‰ã€Œé‚„æ²’è¨­å®šå°±å…ˆæŒ¨æ‰“ã€çš„å•é¡Œã€‚
    */

    list.sort(
        (a,b)=>

            (
                b.agility+
                Math.random()*0.01
            )-
            (
                a.agility+
                Math.random()*0.01
            )

    );


    return list;

}


/*
   â˜… æ–°å¢žï¼šæ•´å€‹å›žåˆçš„ç¸½èª¿åº¦å™¨ã€‚
   æ¯æ¬¡ä¸€å€‹combatantï¼ˆä¸ç®¡æ˜¯è§’è‰²é‚„æ˜¯æ€ªç‰©ï¼‰
   è¡Œå‹•çµæŸï¼Œéƒ½æœƒå‘¼å«é€™è£¡ï¼Œ
   å¾€initiativeQueueçš„ä¸‹ä¸€ä½æŽ¨é€²ã€‚
   æ¸…å–®è·‘å®Œå°±ä»£è¡¨é€™å€‹å¤§å›žåˆçµæŸï¼Œ
   é–‹ä¸‹ä¸€è¼ªï¼ˆå›žåˆæ•¸+1ã€é‡æ–°çµç®—ç‡ƒç‡’/buffã€
   é‡æ–°æŽ’ä¸€æ¬¡æ–°çš„è¡Œå‹•é †åºï¼‰ã€‚
*/

/*
   â˜… æ–°å¢žï¼šé–‹å§‹çµç®—éšŽæ®µã€‚
   å®£å‘ŠéšŽæ®µå…¨éƒ¨äººéƒ½é¸å¥½ä¹‹å¾Œæ‰æœƒå‘¼å«é€™è£¡ï¼Œ
   æŠŠã€Œå·²å®£å‘Šçš„çŽ©å®¶è¡Œå‹•ã€è·Ÿã€Œæ€ªç‰©ã€
   æ··åœ¨ä¸€èµ·ï¼Œä¾æ•æ·é«˜ä½ŽæŽ’ä¸€ä»½åŸ·è¡Œé †åºï¼Œ
   ç„¶å¾Œé–‹å§‹ä¸€å€‹ä¸€å€‹çœŸæ­£åŸ·è¡Œã€‚
*/

function startResolutionPhase(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£æŠ“åˆ°ã€ŒåŒä¸€éš»æ€ªç‰©ä¸€å€‹å›žåˆ
       æ”»æ“Šå…©æ¬¡ã€ã€Œé€£çºŒè·³å…©å€‹å›žåˆã€çš„æ ¹æºï¼‰ï¼š
       é€™è£¡å¦‚æžœå·²ç¶“çœŸçš„åŸ·è¡ŒéŽä¸€æ¬¡ï¼Œä»£è¡¨é€™æ¬¡
       å‘¼å«æ˜¯æ‰‹æ©Ÿç€è¦½å™¨è¨ˆæ™‚å™¨å»¶é²/è£œç™¼é€ æˆçš„
       é‡è¤‡å‘¼å«â€”â€”ç›´æŽ¥æ“‹ä¸‹ï¼Œä¸æœƒé‡æ–°å»ºç«‹
       initiativeQueueã€ä¸æœƒæŠŠinitiativeIndex
       è·ŸprocessedInitiativeIndexesç æŽ‰é‡ç·´ï¼Œ
       å·²ç¶“åœ¨é€²è¡Œä¸­çš„çµç®—éšŽæ®µä¸æœƒè¢«æ‰“æ–·ã€
       é‡æ–°å¾žé ­é–‹å§‹ä¸€æ¬¡ã€‚
    */

    if(resolutionPhaseStarted){

        addBattleLog(
            "åµæ¸¬åˆ°é‡è¤‡çš„"+
            "startResolutionPhaseå‘¼å«ï¼Œ"+
            "å·²æ“‹ä¸‹ã€‚"
        );

        return;

    }


    resolutionPhaseStarted=
        true;


    battlePhase=
        "resolve";


    updateActionHudVisibility();


    /*
       â˜… æ–°å¢žï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼‰ï¼š
       å®£å‘ŠéšŽæ®µçµæŸã€çœŸæ­£é€²å…¥çµç®—éšŽæ®µï¼ˆé–‹å§‹
       ä¾æ•æ·é †åºå‡ºæ‰‹ï¼‰çš„é€™ä¸€åˆ»ï¼ŒæŠŠå…©å¼µçŽ©å®¶
       å¡ç‰‡ä¸Šã€Œè¼ªåˆ°èª°å®£å‘Šã€çš„é»ƒè‰²é–ƒçˆå¤–æ¡†
       å…¨éƒ¨æ‹¿æŽ‰â€”â€”å®£å‘Šå·²ç¶“çµæŸäº†ï¼Œé€™å€‹æç¤º
       çš„ä»»å‹™ä¹ŸçµæŸäº†ï¼Œç¹¼çºŒé–ƒçˆåè€Œè®“äººæžä¸æ¸…æ¥š
       ã€Œç¾åœ¨åˆ°åº•æ˜¯èª°åœ¨è¡Œå‹•ã€ï¼Œæ‹¿æŽ‰ä¹‹å¾Œç•«é¢
       æ›´ä¹¾æ·¨ï¼Œä¹Ÿä¸æœƒå†è·Ÿæ”»æ“Š/å—æ“Šå‹•ç•«çš„
       ç–Šæ”¾é †åºæ‰“æž¶ã€‚
    */

    clearActiveCharacterHighlight();
    clearBattleTargetSelectionMode();


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸçš„æŠ“åˆ°ä¸€å€‹åš´é‡bugï¼Œæ„Ÿè¬ä½ æŠ“å‡ºä¾†ï¼‰ï¼š

       é˜²ç¦¦åŽŸæœ¬è·Ÿæ”»æ“Šä¸€æ¨£ï¼Œè¢«æŽ’é€²ä¾æ•æ·é«˜ä½Ž
       åŸ·è¡Œçš„çµç®—ä½‡åˆ—è£¡â€”â€”é€™æ˜¯éŒ¯çš„ã€‚
       å¦‚æžœé˜²ç¦¦è§’è‰²çš„æ•æ·æ¯”æ”»æ“Šä»–çš„æ€ªç‰©ä½Žï¼Œ
       æ•æ·æŽ’åºæœƒè®“æ€ªç‰©ã€Œå…ˆã€å‡ºæ‰‹ã€
       é˜²ç¦¦è§’è‰²ã€Œå¾Œã€å‡ºæ‰‹ï¼Œ
       ç­‰æ–¼è§’è‰²çš„é˜²ç¦¦å§¿æ…‹æ ¹æœ¬é‚„æ²’ç”Ÿæ•ˆï¼Œ
       æ”»æ“Šå°±å·²ç¶“æ‰“å®Œäº†ï¼Œé˜²ç¦¦å½¢åŒè™›è¨­ï¼Œ
       é€™æ­£æ˜¯ã€Œæœ‰é˜²ç¦¦è·Ÿæ²’é˜²ç¦¦å‚·å®³ä¸€æ¨£ã€çš„çœŸæ­£åŽŸå› ã€‚

       é˜²ç¦¦çš„æœ¬è³ªæ˜¯ã€Œé€™æ•´å€‹å›žåˆéƒ½è¦ç”Ÿæ•ˆçš„ä¿è­·ã€ï¼Œ
       ä¸æ‡‰è©²è·Ÿæ”»æ“Šä¸€æ¨£å—æ•æ·é †åºå½±éŸ¿â€”â€”
       ä¸ç®¡èª°å¿«èª°æ…¢ï¼Œåªè¦é€™å›žåˆå®£å‘Šäº†é˜²ç¦¦ï¼Œ
       å°±æ‡‰è©²åœ¨æ€ªç‰©å‡ºæ‰‹ã€Œä¹‹å‰ã€å°±å·²ç¶“ç”Ÿæ•ˆã€‚

       ä¿®æ­£æ–¹å¼ï¼šåœ¨çµç®—éšŽæ®µçœŸæ­£é–‹å§‹ï¼ˆæŽ’æ€ªç‰©å‡ºæ‰‹ï¼‰
       ä¹‹å‰ï¼Œå…ˆè·‘ä¸€æ¬¡ã€Œé˜²ç¦¦é å…ˆå¥—ç”¨ã€ï¼Œ
       æŠŠæ‰€æœ‰é€™å›žåˆå®£å‘Šé˜²ç¦¦çš„è§’è‰²ç›´æŽ¥å¥—ç”¨é˜²ç¦¦ç‹€æ…‹ï¼Œ
       ä¹‹å¾Œæ‰æŽ’æ•æ·é †åºã€è™•ç†æ€ªç‰©æ”»æ“Šâ€”â€”
       é€™æ¨£é˜²ç¦¦ä¸€å®šæœƒåœ¨ä»»ä½•æ€ªç‰©å‡ºæ‰‹ä¹‹å‰å°±å·²ç¶“ç”Ÿæ•ˆã€‚
    */

    getExistingPartyIndexes().forEach(
        characterIndex=>{

            const queued=

                queuedPlayerActions[
                    characterIndex
                ];


            if(
                queued &&
                queued.action==="defend"
            ){

                setDefendingState(
                    characterIndex
                );


                delete queuedPlayerActions[
                    characterIndex
                ];

            }

        }
    );


    initiativeQueue=
        buildInitiativeQueue();


    initiativeIndex=0;


    /*
       â˜… æ–°å¢žï¼ˆè·Ÿå®£å‘ŠéšŽæ®µç”¨åŒä¸€å¥—é˜²è­·ï¼Œ
       åŽŸå› ä¸€æ¨£ï¼šæ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚
       setTimeoutå¯èƒ½è¢«å»¶é²ã€è£œç™¼ï¼Œå°Žè‡´
       processNextCombatant()è¢«åŒä¸€å€‹
       initiativeIndexå‘¼å«å…©æ¬¡â€”â€”é€™æ¥µå¯èƒ½
       å°±æ˜¯ã€ŒåŒä¸€éš»æ€ªç‰©åŒä¸€å€‹ä½ç½®é€£çºŒæ”»æ“Š
       å…©æ¬¡ã€çš„çœŸæ­£åŽŸå› ï¼Œä¸æ˜¯æ€ªç‰©è³‡æ–™
       æˆ–æ©ŸçŽ‡çš„å•é¡Œã€‚
    */

    processedInitiativeIndexes=
        new Set();


    /*
       â˜… æ–°å¢žï¼ˆè£œä¸Šé˜²è­·ç¶²çš„ç¼ºå£ï¼‰ï¼š
       ä¹‹å‰çš„try-catché˜²è­·ç¶²åªåŒ…ä½å®£å‘ŠéšŽæ®µ
       å‰å…©ä½è§’è‰²çš„è‡ªå‹•åˆ¤æ–·ï¼Œç¬¬ä¸‰æ¬¡å‘¼å«
       beginCharacterTurn()ï¼ˆç´¢å¼•è¶…éŽéšŠä¼é•·åº¦ã€
       æº–å‚™è·³ä¾†é€™è£¡ï¼‰æ˜¯é€éŽå¦ä¸€å€‹ç¨ç«‹çš„è¨ˆæ™‚å™¨
       åŸ·è¡Œçš„ï¼Œä¸åœ¨åŽŸæœ¬çš„ä¿è­·ç¯„åœå…§â€”â€”å¦‚æžœ
       processNextCombatant()ä¸€é–‹å§‹åŸ·è¡Œå°±å‡ºéŒ¯ï¼Œ
       é€™å€‹éŒ¯èª¤æœƒè¢«å®Œå…¨åžæŽ‰ã€ä¸æœƒé¡¯ç¤ºåœ¨ç•«é¢ä¸Šï¼Œ
       çŽ©å®¶åªæœƒçœ‹åˆ°ã€Œè·³åŽ»çµç®—éšŽæ®µã€ä¹‹å¾Œ
       ä»€éº¼éƒ½æ²’æœ‰ç™¼ç”Ÿï¼Œé€™æ­£æ˜¯é€™æ¬¡é™¤éŒ¯è¨Šæ¯
       åœåœ¨é€™è£¡çš„çœŸæ­£åŽŸå› ã€‚

       é€™è£¡è£œä¸ŠåŒæ¨£çš„try-catchï¼Œç¢ºä¿çµç®—éšŽæ®µ
       ä¸ç®¡åœ¨å“ªå€‹ç’°ç¯€å‡ºéŒ¯ï¼Œéƒ½æœƒé¡¯ç¤ºå‡ºä¾†ã€
       ä¸¦ä¸”ç›¡é‡è®“éŠæˆ²ç¹¼çºŒå¾€ä¸‹èµ°ã€‚
    */

    try{

        processNextCombatant(
            token
        );

    }
    catch(error){

        console.error(
            "çµç®—éšŽæ®µç™¼ç”Ÿä¾‹å¤–ï¼š",
            error
        );

        addBattleLog(
            "çµç®—éšŽæ®µç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
            (error&&error.message)+
            "ï¼‰ï¼Œå˜—è©¦å¼·åˆ¶ç¹¼çºŒã€‚"
        );


        initiativeIndex++;

        setTimeout(()=>{

            if(
                battleActive &&
                token===battleToken
            ){

                processNextCombatant(
                    token
                );

            }

        },500);

    }

}


function processNextCombatant(token){

    if(
        !battleActive ||
        token!==battleToken
    ){
        return;
    }

    if(battlePresentationLocks.size>0&&battlePhase==="resolve"){
        battleResolutionResumeToken=token;
        updateActionHudVisibility();
        return;
    }
    battleResolutionResumeToken=null;

    notifyBeforeCombatant(token);

    if(checkBattleEnd()){
        return;
    }


    if(
        initiativeIndex>=
        initiativeQueue.length
    ){

        /*
           â˜… ä¿®æ­£ï¼ˆè£œä¸Šæœ€å¾Œä¸€å€‹æ¼æ´žï¼Œè¦‹ä¸Šé¢
           turnAdvancePendingå®£å‘Šè™•çš„èªªæ˜Žï¼‰ï¼š
           é€™å€‹è½‰æ›å¦‚æžœå·²ç¶“è§¸ç™¼éŽï¼Œä»£è¡¨é€™æ¬¡
           å‘¼å«æ˜¯è¨ˆæ™‚å™¨å»¶é²è£œç™¼çš„é‡è¤‡å‘¼å«ï¼Œ
           ç›´æŽ¥æ“‹ä¸‹ï¼Œä¸æœƒturn++å…©æ¬¡ã€
           startTurn()ä¸æœƒè¢«å‘¼å«å…©æ¬¡ã€‚
        */

        if(turnAdvancePending){

            addBattleLog(
                "åµæ¸¬åˆ°é‡è¤‡çš„"+
                "ã€Œè·³åˆ°ä¸‹ä¸€è¼ªã€å‘¼å«ï¼Œ"+
                "å·²æ“‹ä¸‹ã€‚"
            );

            return;

        }


        turnAdvancePending=
            true;


        notifyBattleRoundBoundary("round_end",token);

        if(checkBattleEnd()){
            return;
        }


        turn++;

        startTurn(token);

        return;

    }


    /*
       â˜… ä¿®æ­£ï¼ˆçœŸæ­£çš„æ ¹æºä¿®æ³•ï¼Œè·Ÿå®£å‘ŠéšŽæ®µ
       åŒä¸€å¥—é‚è¼¯ï¼‰ï¼š
       æ‰‹æ©Ÿç€è¦½å™¨èƒŒæ™¯åŸ·è¡Œæ™‚setTimeoutå¯èƒ½è¢«
       å»¶é²ã€ä¹‹å¾Œè£œç™¼ï¼Œå°Žè‡´é€™å€‹å‡½å¼è¢«åŒä¸€å€‹
       initiativeIndexå‘¼å«ç¬¬äºŒæ¬¡â€”â€”é€™æ­£æ˜¯
       ã€ŒåŒä¸€éš»æ€ªç‰©åŒä¸€å€‹ä½ç½®é€£çºŒæ”»æ“Šå…©æ¬¡ã€
       çš„çœŸæ­£åŽŸå› ã€‚é€™è£¡æ“‹æŽ‰é‡è¤‡ï¼šé€™å€‹
       initiativeIndexå¦‚æžœå·²ç¶“è™•ç†éŽï¼Œä»£è¡¨
       é€™æ¬¡å‘¼å«æ˜¯å»¶é²è£œç™¼çš„é‡è¤‡å‘¼å«ï¼Œç›´æŽ¥
       returnï¼Œä¸æœƒè®“åŒä¸€ä½æ€ªç‰©/çŽ©å®¶çš„è¡Œå‹•
       è¢«åŸ·è¡Œç¬¬äºŒæ¬¡ã€‚
    */

    if(
        processedInitiativeIndexes.has(
            initiativeIndex
        )
    ){

        addBattleLog(
            "åµæ¸¬åˆ°é‡è¤‡çš„"+
            "processNextCombatantå‘¼å«"+
            "ï¼ˆinitiativeIndex="+
            initiativeIndex+
            "å·²ç¶“è™•ç†éŽï¼‰ï¼Œå·²æ“‹ä¸‹ã€‚"
        );

        return;

    }


    processedInitiativeIndexes.add(
        initiativeIndex
    );

    armBattleActionWatchdog(token,initiativeIndex);


    const entry=

        initiativeQueue[
            initiativeIndex
        ];


    if(entry.type==="player"){

        /*
           é€™å€‹è§’è‰²æœ‰å¯èƒ½åœ¨é€™å€‹å¤§å›žåˆ
           æ›´æ—©ä¹‹å‰å°±å·²ç¶“é™£äº¡
           ï¼ˆè¢«æ€ªç‰©æ‰“æ­»ï¼Œæˆ–ç¬¬äºŒè§’è‰²å€’ä¸‹ï¼‰ï¼Œ
           ç›´æŽ¥è·³éŽï¼Œä¸ä½”ç”¨è¡Œå‹•ã€‚
        */

        const character=
            getPartyCharacterByIndex(entry.characterIndex);


        if(
            !character ||
            character.hp<=0
        ){

            initiativeIndex++;


            processNextCombatant(
                token
            );

            return;

        }


        if(isMonsterFrozen(character)){

            addBattleLog(
                (character.id||"ä½ ")+
                "è¢«å†°å°ï¼Œç„¡æ³•è¡Œå‹•ã€‚"
            );

            finishPlayerAction();

            return;
        }

        if(isMonsterPetrified(character)){

            addBattleLog(
                (character.id||"ä½ ")+
                "è¢«çŸ³åŒ–ï¼Œç„¡æ³•è¡Œå‹•ã€‚"
            );

            finishPlayerAction();

            return;
        }


        activeBattleCharacterIndex=

            entry.characterIndex;


        /*
           â˜… ä¿®æ­£ï¼ˆé‡æ–°è¨­è¨ˆå›žåˆåˆ¶ï¼‰ï¼š
           çµç®—éšŽæ®µä¸å†é‡æ–°å‘¼å«
           beginCharacterTurn()ç­‰æ–°çš„è¼¸å…¥ï¼Œ
           è€Œæ˜¯æŠŠé€™å€‹è§’è‰²åœ¨å®£å‘ŠéšŽæ®µ
           å·²ç¶“é¸å¥½çš„è¡Œå‹•ï¼ˆqueuedPlayerActionsï¼‰
           çœŸæ­£æ‹¿å‡ºä¾†åŸ·è¡Œã€‚
        */

        battleStatisticsBeginAction({
            type:"player",
            characterIndex:entry.characterIndex
        });

        try{
            resolveQueuedPlayerAction(
                entry.characterIndex,
                token
            );
        }catch(error){
            console.error("çµç®—çŽ©å®¶è¡Œå‹•æ™‚ç™¼ç”Ÿæœªæ””æˆªä¾‹å¤–ï¼š",error);
            addBattleLog("çµç®—çŽ©å®¶è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼Œå·²ç”±å®‰å…¨é–˜é–€ç¹¼çºŒã€‚");
            finishPlayerAction();
        }

    }
    else{

        const actingMonster=monsters[entry.monsterIndex];
        if(!actingMonster||!actingMonster.alive||actingMonster.canAct===false){
            initiativeIndex++;
            processNextCombatant(token);
            return;
        }

        battleStatisticsBeginAction({
            type:"monster",
            monsterIndex:entry.monsterIndex
        });

        try{
            processSingleMonsterAttack(
                entry.monsterIndex,
                token
            );
        }catch(error){
            console.error("çµç®—æ•µæ–¹è¡Œå‹•æ™‚ç™¼ç”Ÿæœªæ””æˆªä¾‹å¤–ï¼š",error);
            addBattleLog("çµç®—æ•µæ–¹è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼Œå·²ç”±å®‰å…¨é–˜é–€ç¹¼çºŒã€‚");
            finishPlayerAction();
        }

    }

}


/*
   â˜… æ–°å¢žï¼šæŠŠå®£å‘ŠéšŽæ®µé¸å¥½ã€å­˜èµ·ä¾†çš„è¡Œå‹•
   çœŸæ­£æ‹¿å‡ºä¾†åŸ·è¡Œã€‚

   è‡ªå‹•æˆ°é¬¥çš„è§’è‰²ä¸æœƒèµ°åˆ°é€™è£¡â€”â€”ä»–å€‘åœ¨
   å®£å‘ŠéšŽæ®µè¼ªåˆ°è‡ªå·±æ™‚å°±å·²ç¶“ç›´æŽ¥åŸ·è¡Œå®Œäº†
   ï¼ˆautoAction()/player2AutoAction()ï¼‰ï¼Œ
   é€™è£¡è™•ç†çš„éƒ½æ˜¯æ‰‹å‹•è§’è‰²å®£å‘ŠéšŽæ®µ
   å­˜ä¸‹ä¾†çš„æ™®é€šæ”»æ“Š/å‚·å®³æŠ€èƒ½ã€‚
*/

function resolveQueuedPlayerAction(characterIndex,token){

    const queued=

        queuedPlayerActions[
            characterIndex
        ];


    if(!queued){

        /*
           é˜²å‘†ï¼šç†è«–ä¸Šå®£å‘ŠéšŽæ®µæ¯å€‹æ´»è‘—çš„
           æ‰‹å‹•è§’è‰²éƒ½æ‡‰è©²æœ‰å­˜åˆ°ä¸€ç­†è¡Œå‹•ï¼Œ
           è¬ä¸€çœŸçš„æ²’æœ‰ï¼ˆä¾‹å¦‚é€¾æ™‚æ²’é¸ï¼‰ï¼Œ
           ç›´æŽ¥è·³éŽï¼Œä¸å¡ä½çµç®—æµç¨‹ã€‚
        */

        finishPlayerAction();

        return;

    }


    const isAdditionalCharacter=
        characterIndex>0;


    /*
       â˜… ä¿®æ­£ï¼ˆé‡è¦ï¼Œä¾ç…§ä½¿ç”¨è€…æ˜Žç¢ºæŒ‡æ­£ï¼‰ï¼š
       é˜²ç¦¦ã€è—¥æ°´ã€å¢žç›Š/æ²»ç™‚/å¾©æ´»é€™å¹¾ç¨®
       ä¹‹å‰éƒ½æ˜¯ã€Œé¸äº†å°±ç«‹åˆ»ç”Ÿæ•ˆã€ï¼Œ
       ç¾åœ¨å…¨éƒ¨æ”¹æˆè·Ÿæ”»æ“Šä¸€æ¨£å…ˆå®£å‘Šå†çµç®—ï¼Œ
       é€™è£¡è¦è£œä¸Šå°æ‡‰çš„åŸ·è¡Œåˆ†æ”¯ã€‚

       é€™å¹¾ç¨®éƒ½ä¸éœ€è¦ç›®æ¨™ï¼ˆtargetæ˜¯nullï¼‰ï¼Œ
       è·Ÿéœ€è¦é¸æ€ªç‰©ç•¶ç›®æ¨™çš„æ™®é€šæ”»æ“Š/å‚·å®³æŠ€èƒ½
       åˆ†é–‹è™•ç†ã€‚
    */

    if(queued.action==="defend"){

        applyDefendEffect(
            characterIndex
        );

        return;

    }


    if(queued.action==="escape"){

        resolveEscapeAttempt(
            characterIndex
        );

        return;

    }


    if(queued.action==="potion"){

        activeBattleCharacterIndex=
            characterIndex;


        applyPotionEffect(
            queued.potionId,
            characterIndex
        );

        return;

    }


    const queuedSkill=
        skillDatabase[
            queued.action
        ];


    if(
        queuedSkill &&
        (
            queuedSkill.category==="buff"||
            queuedSkill.category==="heal"||
            queuedSkill.category==="revive"
        )
    ){

        /*
           ç›®å‰å¢žç›Š/æ²»ç™‚/å¾©æ´»åªæ”¯æ´ç¬¬ä¸€è§’è‰²ï¼Œ
           è·ŸprepareAction()è£¡çš„é™åˆ¶ä¸€è‡´ã€‚
        */

        activeBattleCharacterIndex=
            characterIndex;


        /*
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼ŒæŽ¥ä¸Šæ–°å¢žçš„
           é¢¨ç³»/åœŸç³»å¢žç›ŠæŠ€èƒ½ï¼‰ï¼š
           åŽŸæœ¬é€™è£¡ä¸ç®¡æŽ’çš„æ˜¯å“ªå€‹å¢žç›ŠæŠ€èƒ½ï¼Œ
           ä¸€å¾‹ç¡¬å‘¼å«castRageBuff()â€”â€”é€™ä»£è¡¨
           å¦‚æžœçŽ©å®¶æŽ’çš„æ˜¯æ–°å¢žçš„é–ƒèº²è¡“/å²©çŸ³
           å£å£˜/è¬è±¡åœŸç›¾/çµç•Œ/éš±èº«è¡“/ç³§è‰
           å…ˆè¡Œï¼Œå¯¦éš›ä¸ŠæœƒéŒ¯èª¤åœ°åŸ·è¡Œã€Œæ€’ç«ã€
           çš„é‚è¼¯ï¼Œä¸æ˜¯çŽ©å®¶çœŸæ­£é¸çš„æŠ€èƒ½ã€‚

           æ”¹æˆæŠŠqueued.actionï¼ˆçœŸæ­£çš„æŠ€èƒ½IDï¼‰
           å‚³é€²åŽ»ï¼ŒcastBuffSkill()å…§éƒ¨æœƒä¾
           æŠ€èƒ½IDåˆ†æµåˆ°æ­£ç¢ºçš„æ•ˆæžœã€‚
        */

        if(queuedSkill.category==="buff"){

            castBuffSkill(
                queued.action,
                queued.targetAlly
            );

        }
        else if(queuedSkill.category==="heal"){

            castHealSkill(
                queued.action,
                queued.targetAlly
            );

        }
        else{

            castReviveSkill(
                queued.action,
                queued.targetAlly
            );

        }


        return;

    }


    if(
        queued.target!==null &&
        queued.target!==undefined
    ){

        selectedMonster=
            queued.target;

    }


    if(isAdditionalCharacter){

        try{

            if(queued.action==="normal"){

                secondaryCharacterNormalAttack(
                    characterIndex,
                    queued.target
                );

            }
            else{
                castSecondaryCharacterSkill(
                    characterIndex,
                    queued.action,
                    queued.target
                );

            }

        }
        catch(error){

            /*
               â˜… æ–°å¢žï¼ˆé˜²è­·ç¶²è£œåˆ°æœ€å¾Œä¸€å€‹ç¼ºå£ï¼‰ï¼š
               processNextCombatant()ã€
               beginCharacterTurn()çš„è‡ªå‹•åˆ¤æ–·
               éƒ½å·²ç¶“æœ‰try-catchï¼Œå”¯ç¨ã€Œçµç®—éšŽæ®µ
               çœŸæ­£åŸ·è¡ŒçŽ©å®¶/ç¬¬äºŒè§’è‰²è¡Œå‹•ã€é€™ä¸€æ®µ
               å®Œå…¨æ²’æœ‰â€”â€”ä»»ä½•ä¸€å€‹æŠ€èƒ½æ–½æ”¾å‡½å¼
               è£¡é¢ï¼Œåªè¦æœ‰ä»»ä½•ä¸€è¡Œæ„å¤–æ‹‹å‡ºä¾‹å¤–
               ï¼ˆä¾‹å¦‚è³‡æ–™æ²’å°é½Šã€undefinedå­˜å–ï¼‰ï¼Œ
               æ•´æ¢çµç®—éˆå°±æœƒåœ¨é€™ä¸€åˆ»ç„¡è²æ–·æŽ‰ï¼Œ
               çŽ©å®¶åªæœƒçœ‹åˆ°ç•«é¢åœä½ï¼Œä»€éº¼æç¤º
               éƒ½æ²’æœ‰ï¼Œç—‡ç‹€è·Ÿã€Œå¡ä½ä¸å‹•ã€ä¸€æ¨¡ä¸€æ¨£ã€‚

               è£œä¸Šè·Ÿå…¶ä»–åœ°æ–¹ä¸€è‡´çš„é˜²è­·ï¼šå°å‡º
               çœŸæ­£çš„éŒ¯èª¤å…§å®¹åˆ°æˆ°é¬¥ç´€éŒ„ï¼ˆä¸ç”¨å†
               é çŒœçš„ï¼‰ï¼Œä¸¦å¼·åˆ¶å‘¼å«
               finishPlayerAction()è®“æˆ°é¬¥
               ç¹¼çºŒå¾€ä¸‹èµ°ï¼Œä¸æœƒå¡æ­»åœ¨é€™ä¸€æ­¥ã€‚
            */

            console.error(
                "çµç®—ç¬¬äºŒè§’è‰²è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼š",
                error
            );

            addBattleLog(
                "çµç®—è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
                (error&&error.message)+
                "ï¼‰ï¼Œå·²å¼·åˆ¶ç¹¼çºŒã€‚"
            );

            finishPlayerAction();

        }

    }
    else{

        try{

            if(queued.action==="normal"){

                normalAttack();

            }
            else{

                castDamageSkill(
                    queued.action
                );

            }

        }
        catch(error){

            console.error(
                "çµç®—ç¬¬ä¸€è§’è‰²è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼š",
                error
            );

            addBattleLog(
                "çµç®—è¡Œå‹•æ™‚ç™¼ç”Ÿä¾‹å¤–ï¼ˆ"+
                (error&&error.message)+
                "ï¼‰ï¼Œå·²å¼·åˆ¶ç¹¼çºŒã€‚"
            );

            finishPlayerAction();

        }

    }

}


/*
   å‘½ä¸­åˆ¤å®šçš„æ‰€æœ‰åŠ æ¸›æ•ˆæžœéƒ½åœ¨æœ€å¾Œä»¥ç™¾åˆ†é»žçµç®—ã€‚
   directChanceReductionPercent æ˜¯æœ€çµ‚å‘½ä¸­ä¸‹é™ï¼Œ
   directChanceBonusPercent æ˜¯æœ€çµ‚å‘½ä¸­æå‡ã€‚
   ç›®æ¨™é–ƒèº²åŒæ¨£ç›´æŽ¥æ‰£é™¤ç™¾åˆ†é»žï¼Œæœ€å¾Œæ‰çµ±ä¸€ clamp 5%ï½ž99%ã€‚
*/

function calculateHitChancePercent(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    const chance=
        HIT_CHANCE_BASE+
        (Number(casterAccuracy)||0)+
        (Number(directChanceBonusPercent)||0)-
        Math.max(0,Number(targetEvasion)||0)-
        Math.max(0,Number(directChanceReductionPercent)||0);

    const normalFinalChance=Math.max(
        HIT_CHANCE_MIN_PERCENT,
        Math.min(HIT_CHANCE_MAX_PERCENT,chance)
    );
    const windEx=targetCharacter&&targetCharacter.element==="wind"
        ?getLearnedElementEX(targetCharacter,"wind"):null;
    const lowHp=targetCharacter&&Number(targetCharacter.hp)<Number(getPartyBattleStats(getPartyCharacterIndex(targetCharacter))?.maxHP)*0.25;
    return windEx&&lowHp
        ?Math.min(normalFinalChance,Number(windEx.lowHpFinalHitCapPercent)||50)
        :normalFinalChance;
}

function rollHitChance(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    return Math.random()*100<calculateHitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent,
        directChanceBonusPercent,
        targetCharacter
    );
}

window.v173GetHitChancePercent=calculateHitChancePercent;


/* =====================================================
   V173.38 æŠ€èƒ½å‚·å®³ï¼šæœ‰æ•ˆæ”»æ“Š Ã— damageRole ï¼‹æ­£å¼ flatDamageï¼Œ
   å†ä¸”åªäº¤çµ¦ calculateDamage() ä¸€æ¬¡ã€‚èˆŠå¼äº”åƒæ•¸å‘¼å«åŠ
   å°šæœªé·ç§»æŠ€èƒ½ä¿ç•™å›ºå®šå‚·å®³å›žé€€ï¼Œä¾›æ­·å²æµç¨‹ç›¸å®¹ã€‚
===================================================== */

function getSkillRawAttack(skill,skillLevel,effectiveAttack){
    const attack=Math.max(0,Number(effectiveAttack)||0);
    const skillDamage=getSkillDamageAtLevel(skill,skillLevel);
    if(hasDamageRoleProfile(skill)){
        return attack*getSkillPowerAtLevel(skill,skillLevel)+skillDamage;
    }
    return attack+skillDamage;
}

window.v173GetSkillRawAttack=getSkillRawAttack;

function calculateSkillDamage(skillOrOptions,statBonus,monster,casterLevel,casterElement){
    if(skillOrOptions&&typeof skillOrOptions==="object"&&skillOrOptions.skill){
        const options=skillOrOptions;
        const target=options.target||{};
        const explicitDefense=Number(options.targetDefense);
        const targetDefense=Number.isFinite(explicitDefense)
            ?explicitDefense
            :getMonsterEffectiveDefense(target);

        return calculateDamage(
            getSkillRawAttack(options.skill,options.skillLevel,options.effectiveAttack),
            targetDefense,
            options.casterLevel,
            target.level,
            options.casterElement,
            target.element,
            Object.assign({},options,{
                damageBudgetMultiplier:getDamageBudgetMultiplier(options)
            })
        );
    }

    return calculateDamage(
        (Number(skillOrOptions)||0)+ßn½ç¶òµë(š+myÙMÑ…ÑÕÍ	…‘•Ì ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–>«šnÓšZÃ’â–ò×–6‡¾ò#–në–ºi¥“¾ò'¾ò0(€€€€€€ƒž>û–r£šRçš"C–B3šfšnÓšZÃž²³’â¢žK¢&Ë¢Þž²³’ê3¢žK¢&È(€€€€€€ƒ¾ò#–¶c–r£žj¢¦Ç¾ò'–B¢«žj‰Õ™›–r[ž’ëŽ(€€€€¨¼((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•ÉMÑ…ÑÕÍ	…‘” (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤(€€€€€€€€¤ì(€€€ô¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•ÉMÑ…ÑÕÍ	…‘” (€€€¥¹‘•à°(€€€¡…É…Ñ•È(¥ì((€€€½¹ÍÐÍÑ…ÑÕÍÉ•„ô ‰‰…ÑÑ±•A±…å•ÉMÑ…ÑÕÌˆ­¥¹‘•à¤ì(€€€¥˜ …ÍÑ…ÑÕÍÉ•„¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ…ÁÁ±åMÑ…ÑÕÌô ¤ôùì(€€€€€€€¥˜ (€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜˜(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÍMÑ…ÑÕÍ™Ñ•ÉA±…å•ÉU¥UÁ‘…Ñ”ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹ØÄÐÍMÑ…ÑÕÍ™Ñ•ÉA±…å•ÉU¥UÁ‘…Ñ”¡¥¹‘•à±¡…É…Ñ•È¤ì(€€€€€€€ô(€€€ôì((€€€½¹ÍÐÍ¡•‘Õ±•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹ØÄÐÍM¡•‘Õ±•A±…å•ÉMÑ…ÑÕÍU¥UÁ‘…Ñ”é¹Õ±°ì(€€€¥˜¡ÑåÁ•½˜Í¡•‘Õ±•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€É•ÑÕÉ¸Í¡•‘Õ±•È¡¥¹‘•à±…ÁÁ±åMÑ…ÑÕÌ¤ì(€€€ô((€€€É•ÑÕÉ¸…ÁÁ±åMÑ…ÑÕÌ ¤ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•	…ÑÑ±•A±…å•É	…ÉÌ ¥ì((€€€ÕÁ‘…Ñ•A±…å•ÉMÑ…ÑÕÍ	…‘•Ì ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–>«šnÓšZÃž²³’â¢žK¢&Ëžj¢†šŠw¾ò0(€€€€€€ƒ¢3’âQ¡ÁQ•áÐ½ÍÁQ•áÓšb¿žR (€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡Àµ‰…ÈµÑ•áÐˆ¤(€€€€€€ƒ–:ï–£–~š&ûž²³’â–/ž²›–B#žj–žÒƒ¾ò0(€€€€€€ƒ–ÂÇžº_–*ƒ’êž²³’ê3–ò×–6‡’æšÂã¦ƒš*O–"Ã–B3’â–/Ž(€€€€€€ƒšRçš"C–"–"—šnÓšZÃ–§–ò×–6‡–B¢«žj¢†šŠw¾ò0(€€€€€€ƒšZ–¶_–žÒƒ’æšRçš"C–r£¢¦Ë–ò×–6‡žjž¾–r7–Ÿš&û¾ò0(€€€€€€ƒ’â7šrš*O¦2¿Ž(€€€€¨¼((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•É	…ÉÌ (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤°(€€€€€€€€€€€•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤(€€€€€€€€¤ì(€€€ô¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•M¥¹±•¡…É…Ñ•É	…ÉÌ (€€€¥¹‘•à°(€€€¡…É…Ñ•È°(€€€ÍÑ…ÑÌ(¥ì((€€€½¹ÍÐ…Éô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ­¥¹‘•à¤ì(((€€€¥˜ ……É¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3šÒï¢F_¢š’ê»¾ò0(€€€€€€ƒš¶ï’ê‡š&7šj_Ž7¾ò'¾òh(€€€€€€ƒš¾?š²‡¢†šŠwšnÓšZÃžjšf–g¾ò3¦‚’úÿšª‹š~—¢žK¢&Ëšb¿–B˜(€€€€€€ƒ–ÞËžÚO–K’â/¾ò!¡ÀðôÃ¾ò'¾ò3šb¿žj¢¦Ç–*ƒ’â(¹‘½Ý¸(€€€€€€ƒ¢ºO–6‡ž&¢º+šj_¾ò3šÒï¢F_–ÂÇš*(¹‘½Ý»š.ÿš:'žÚ·š2(€€€€€€ƒ–:šr³’ê»–ê›Ž¦g–/–÷–ò?šr³’ú–ÂÇšb¿–R¿’â¢Êƒ¢Ê°(€€€€€€ƒ–B3š¶—Ž3žV¯¦v‹¢†šŠwŽ7¢ÞŽ3¢žK¢&Ë–¾›¦jm¡ÃŽ7žj(€€€€€€ƒ–rÃšZç¾ò3–6‡ž&žjšb;šj_–Û–¾›’æšb¿–B3’â’îÛ’ê/žj(€€€€€€ƒ–îÛ’òã¾ò#¦÷šb¿š*)¡Ãž.š/–>7šbƒ–"ÃžV¯¦v‹’â+¾ò'¾ò0(€€€€€€ƒšRû–r£¦g¢Ž‡’â¢Öß¢fWžB¾ò3’â7žR£–>›–’[š&û–rÃšZä(€€€€€€ƒ¦7¢’–"“šZÝ¡…É…Ñ•È¹¡ÀðôÃŽ(€€€€¨¼((€€€…É¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€‰‘½Ý¸ˆ°(€€€€€€€¡…É…Ñ•È¹¡ÀðôÀ(€€€€¤ì(((€€€½¹ÍÐ¡Á	…È€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É!A	…Èˆ­¥¹‘•à¤ì(((€€€½¹ÍÐÍÁ	…È€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•ÉMA	…Èˆ­¥¹‘•à¤ì(((€€€½¹ÍÐÍ¡¥•±‘	…È€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•ÉM¡¥•±‘	…Èˆ­¥¹‘•à¤ì(((€€€½¹ÍÐ¡ÁA•É•¹Ð€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€ÄÀÀ°(€€€€€€€€€€€€€€€¡…É…Ñ•È¹¡À¼(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@¨(€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€¥˜¡¡Á	…È¥ì((€€€€€€€¡Á	…È¹ÍÑå±”¹Ý¥‘Ñ €ô(€€€€€€€€€€€¡ÁA•É•¹Ð¬(€€€€€€€€€€€€ˆ”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢¶ßžnûšV#šzsžRš"Cžj¢¦Ç¾ò0(€€€€€€ƒš"GšZç¢†¦?šŠw¢š–Š{–*ƒž¶'–ó¦Vß–ê›žjžf÷¢&Ë¢†¦?šŠwŽ7¾ò'¾òh(€€€€€€ƒžf÷¢&Ë¢&Ë–†+žÞ+š:—–r£žÒ¢&Ë¢†¦?–>Ï–Ó¦Z/–ž/¾ò!±•™Ðõ¡ÁA•É•¹Ó¾ò'¾ò0(€€€€€€ƒ–¾³–ê›¾òw¢¶ßžnû–&§¦’c¦?’öQµ…á!Cžjš¾S’ú/¾ò3¢Þ¢†šŠwšr³¢ê¯žR (€€€€€€ƒ–B3’â–-µ…á!C–~ëšê[š>ožº_¾ò3¢Ú–ë–ºç–f£žj¦£–"–nƒž
è(€€€€€€€¹¡Àµ‰…Ëšr³¢ê­½Ù•É™±½Üé¡¥‘‘•»šr¢«–.W¢Š¯¢Žš:'¾ò0(€€€€€€ƒ’â7šržV¯–ëš‚óžÞk–’[Ž(€€€€¨¼((€€€¥˜¡Í¡¥•±‘	…È¥ì((€€€€€€€½¹ÍÐÍ¡¥•±‘	Õ™˜ô((€€€€€€€€€€€€¡¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤(€€€€€€€€€€€€¹™¥¹ (€€€€€€€€€€€€€€€ˆôø((€€€€€€€€€€€€€€€€€€€ˆ¹ÑåÁ”ôôô‰Í¡¥•±ˆ˜˜(€€€€€€€€€€€€€€€€€€€ˆ¹ÑÕÉ¹Í1•™ÐøÀ˜˜(€€€€€€€€€€€€€€€€€€€ˆ¹É•µ…¥¹¥¹œøÀ((€€€€€€€€€€€€¤ì(((€€€€€€€½¹ÍÐÍ¡¥•±‘A•É•¹Ðô((€€€€€€€€€€€Í¡¥•±‘	Õ™˜(€€€€€€€€€€€€ü(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€Í¡¥•±‘	Õ™˜¹É•µ…¥¹¥¹œ¼(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@¨(€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤(€€€€€€€€€€€€è(€€€€€€€€€€€€Àì(((€€€€€€€Í¡¥•±‘	…È¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€¡ÁA•É•¹Ð¬(€€€€€€€€€€€€ˆ”ˆì((€€€€€€€Í¡¥•±‘	…È¹ÍÑå±”¹Ý¥‘Ñ ô(€€€€€€€€€€€Í¡¥•±‘A•É•¹Ð¬(€€€€€€€€€€€€ˆ”ˆì((€€€ô(((€€€¥˜¡ÍÁ	…È¥ì((€€€€€€€ÍÁ	…È¹ÍÑå±”¹Ý¥‘Ñ €ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€ÄÀÀ°(€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹ÍÀ¼(€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@¨(€€€€€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€ˆ”ˆì((€€€ô(((€€€½¹ÍÐ¡ÁQ•áÐ€ô(€€€€€€€…É¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹¡Àµ‰…ÈµÑ•áÐˆ(€€€€€€€€¤ì(((€€€½¹ÍÐÍÁQ•áÐ€ô(€€€€€€€…É¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹ÍÀµ‰…ÈµÑ•áÐˆ(€€€€€€€€¤ì(((€€€¥˜¡¡ÁQ•áÐ¥ì((€€€€€€€¡ÁQ•áÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€¡…É…Ñ•È¹¡À¬(€€€€€€€€€€€€ˆ¼ˆ¬(€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@ì((€€€ô(((€€€¥˜¡ÍÁQ•áÐ¥ì((€€€€€€€ÍÁQ•áÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€¡…É…Ñ•È¹ÍÀ¬(€€€€€€€€€€€€ˆ¼ˆ¬(€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@ì((€€€ô()ô(()™Õ¹Ñ¥½¸Í¡½Ý…µ…•A½ÁÕÀ¡•±•µ•¹Ð±Ñ•áÐ±ÑåÁ”±¥ÍÉ¥Ð¥ì((€€€½¹ÍÐ™••‘‰…¬õÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ(€€€€€€€€ýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½…Ñ¥¹••‘‰…¬(€€€€€€€€é¹Õ±°ì((€€€¥˜ …™••‘‰…­ññÑåÁ•½˜™••‘‰…¬¹•µ¥Ð„ôô‰™Õ¹Ñ¥½¸‰ñð…•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€½¹ÍÐÕ¹¥ÐõÑåÁ•½˜™••‘‰…¬¹¥‘•¹Ñ¥™åU¹¥Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€ý™••‘‰…¬¹¥‘•¹Ñ¥™åU¹¥Ð¡•±•µ•¹Ð¤(€€€€€€€€é¹Õ±°ì((€€€¥˜ …Õ¹¥Ð¥ì(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô(((€€€É•ÑÕÉ¸™••‘‰…¬¹•µ¥Ð¡ì(€€€€€€€Í¥‘”éÕ¹¥Ð¹Í¥‘”°(€€€€€€€¥¹‘•àéÕ¹¥Ð¹¥¹‘•à°(€€€€€€€­¥¹éÑåÁ”ôôô‰¡•…°ˆ(€€€€€€€€€€€€ü‰¡•…°ˆ(€€€€€€€€€€€€éÑåÁ”ôôô‰ÍÀˆ(€€€€€€€€€€€€€€€€ü‰ÍÀˆ(€€€€€€€€€€€€€€€€éÑåÁ”ôôô‰µ¥ÍÌˆ(€€€€€€€€€€€€€€€€€€€€ü‰µ¥ÍÌˆ(€€€€€€€€€€€€€€€€€€€€éÑåÁ”ôôô‰Í¡¥•±ˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü‰Í¡¥•±ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è‰‘…µ…”ˆ°(€€€€€€€Ñ•áÐéÑ•áÐ°(€€€€€€€É¥Ñ¥…°è„…¥ÍÉ¥Ð°(€€€€€€€Í½ÕÉ”è‰½É”µ•¹ÑÉäˆ(€€€ô¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒ–Ãš^/’â¦Z–Â#–Æ³žj¦Žo¢†3–r[ž’ë¾ò3’öÿžR£¢’â+–
Ïžj(€€ƒ–r[ž&žnÓš:—¢ö'š"A‰…Í”ØÓ–Ÿ–Ö3–r£¦g¢Ž‡¾ò0(€€ƒ¢Þ¢žK¢&Ë–r[ž&¾ò!‰…ÑÑ±•A±…å•É…ÉÀ¼Çžj(€€‰…­É½Õ¹µ¥µ…—¾ò'žR£–B3’âž¢»–kšÎWŠSŠP(€€ƒ–Z»’â!Q53šªSš†#’â7’úw¢ÎÓ–’[¦£–r[ž&šªSš†#¾ò0(€€ƒ¢’¢Ž÷¦g–/šªSš†#–"Ã–"—žj–rÃšZç’æ’â7šršr$(€€ƒ–r[ž&¢Þ¿–úG–’ÇšV#Ž–r[ž&šÚ#–’Çžj–V?¦†3Ž(¨¼()½¹ÍÐ%}MA%9}AI=)Q%1}%5ô(€€€€‰…ÍÍ•ÑÌ½‰…ÑÑ±”½¥”µÍÁ¥¸µÁÉ½©•Ñ¥±”¹Ý•‰Àˆì(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Ãš^/’â¦Z–Â#–Æ°(€€ƒšRïšN+–.WžV¯¾ò'¾òh(€€ƒ¢ºO’â+¦v‹¦
–ò×–r[–ú{šZ÷šÎW¢–6‡ž&¦Žo–"Ã¢Š¯š&O’â·žj(€€ƒš«ž&§–6‡ž&¾ò3’â·¦Sš^/¢ö'ŽšRû–’Ÿ¾ò3š*×¦SšfšÞ‡–ë¾ò0(€€ƒžVÛš"C¦g–/š*¢÷žjšRïšN+ž&çšV#Ž((€€ƒ¢Þ}Í¡½ÝM­¥±±9…µ•	…‘” §’âš¢š:o–r (€€‘½Õµ•¹Ð¹‰½‘ç–êW’â/ŽžR¡•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€ƒ¦?–êŸš¢g¾ò3’â7žVÛ–6‡ž&žj–¶C–žÒƒ¾ò3¦ÿ–7¢Š¯–6‡ž&(€€ƒ¢«–ÞÇžjÑÉ…¹Í™½É·–.WžV¯–nÃ’ö?¾ò#–:–nƒ¢š,(€€Í¡½ÝM­¥±±9…µ•	…‘” §š^¦
+žj¢ª«šb;¾ò'Ž((€€…ÍÑ•É¡…É…Ñ•É%¹‘•ã¾òhÀ÷ž²³’â¢žK¢&ËŽ(€€€Ä÷ž²³’ê3¢žK¢&Ë¾ò3šÆë–ºk¦Žo¢†3¢Öß¦î{šb¿–N«–ò×ž:§–ºÛ–6‡Ž(€€Ñ…É•Ñ5½¹ÍÑ•É%¹‘•ã¾òk¦Žo¢†3žÖ¦î{šb¿–N«¦jïš«ž&§–6‡Ž((€€ƒ–>«¢Êƒ¢Ê³Ž3žV¯¦v‹’â+¦Žo’â’â/Ž7¾ò3’â7–k’îï’öW–
ß–ºÌ¼(€€ƒ–F÷’â·–"“–ºk¾ò3–Fó–>¯ž®¿¢¦Ëš&M5%MO¦
šb¿¢¦Ëš&¢†¾ò0(€€ƒ¢Þ¦g–/–÷–ò?–º3–£ž‡¦^s¾ò3–§’îÛ’ê/–"¦Z/¢fWžBŽ(¨¼()™Õ¹Ñ¥½¸Á±…å%•MÁ¥¹AÉ½©•Ñ¥±” (€€€…ÍÑ•É¡…É…Ñ•É%¹‘•à°(€€€Ñ…É•Ñ5½¹ÍÑ•É%¹‘•à(¥ì((€€€½¹ÍÐ…ÍÑ•É…Éô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€…ÍÑ•É¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€½¹ÍÐÑ…É•Ñ…Éô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ¬(€€€€€€€€€€€Ñ…É•Ñ5½¹ÍÑ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€€……ÍÑ•É…Éñð(€€€€€€€€…Ñ…É•Ñ…É(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ…ÍÑ•ÉI•Ðô(€€€€€€€…ÍÑ•É…É¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐÑ…É•ÑI•Ðô(€€€€€€€Ñ…É•Ñ…É¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐÁÉ½©•Ñ¥±”ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰¥µœˆ(€€€€€€€€¤ì(((€€€ÁÉ½©•Ñ¥±”¹ÍÉŒô(€€€€€€€%}MA%9}AI=)Q%1}%5ì((€€€ÁÉ½©•Ñ¥±”¹±…ÍÍ9…µ”ô(€€€€€€€€‰¥”µÍÁ¥¸µÁÉ½©•Ñ¥±”ˆì((€€€½¹ÍÐÍÑ…ÉÑA½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€…ÍÑ•ÉI•Ð¹±•™Ð¬(€€€€€€€€€€€…ÍÑ•ÉI•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€…ÍÑ•ÉI•Ð¹Ñ½À¬(€€€€€€€€€€€…ÍÑ•ÉI•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€½¹ÍÐ•¹‘A½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€Ñ…É•ÑI•Ð¹±•™Ð¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ñ½À¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹±•™Ðô(€€€€€€€ÍÑ…ÉÑA½¥¹Ð¹à¬‰Áàˆì((€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹Ñ½Àô(€€€€€€€ÍÑ…ÉÑA½¥¹Ð¹ä¬‰Áàˆì((€€€½¹ÍÐ½Ù•É±…å1…å•È€ô(€€€€€€€€ ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ñð(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì((€€€½Ù•É±…å1…å•È¹…ÁÁ•¹‘¡¥± (€€€€€€€ÁÉ½©•Ñ¥±”(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ–òß–"Û¢žãžfñÉ•™±½ß¾òh(€€€€€€ƒ¢Öß¦î{žj±•™Ð½Ñ½Ã–&o¢¢·–ºk–º3¾ò3ž?¢š÷–f£¦
šÊH(€€€€€€ƒžrš¶žV¯–ë¦g’â–æ¾ò3–ššzs¦š³’â+–r£–B3’â¢ò¨(€€€€€€ƒ’ê/’îÛ–ú«žJÃ¢Ž‡š*)±•™Ð½Ñ½ÃšRçš"CžÖ¦î{–êŸš¢g¾ò0(€€€€€€ÑÉ…¹Í¥Ñ¥½»šržnÓš:—¢ÞÏ¦;–:ïŽžr/’â7–"Ã¦Žo¢†0(€€€€€€ƒ¦;ž¢/ŽžR¡Ù½¥ÁÉ½©•Ñ¥±”¹½™™Í•Ñ]¥‘Ñ (€€€€€€ƒ–òß¢þ¯ž?¢š÷–f£–#žº_’âš²‡žn»–&7žjž&#¦v‹¾ò0(€€€€€€ƒžŠë¢ª7Ž3¢Öß¦î{Ž7–ÞËžÚOžRšV#¾ò3š:—’â/’ú(€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ—¢Ž‡šRçš"CžÖ¦î{–êŸš¢d(€€€€€€ƒš&7šržržj¢žãžfñÑÉ…¹Í¥Ñ¥½»–.WžV¯Ž(€€€€¨¼((€€€Ù½¥ÁÉ½©•Ñ¥±”¹½™™Í•Ñ]¥‘Ñ ì(((€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤ôùì((€€€€€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€•¹‘A½¥¹Ð¹à¬‰Áàˆì((€€€€€€€ÁÉ½©•Ñ¥±”¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€•¹‘A½¥¹Ð¹ä¬‰Áàˆì((€€€€€€€ÁÉ½©•Ñ¥±”¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰…ÉÉ¥Ù•ˆ(€€€€€€€€¤ì((€€€ô¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€ÁÉ½©•Ñ¥±”€˜˜(€€€€€€€€€€€ÁÉ½©•Ñ¥±”¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€ÁÉ½©•Ñ¥±”¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€ÁÉ½©•Ñ¥±”(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô°ÔÀÀ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3ž¯žº·š*¢÷žj(€€ƒ’â'žfó¦Žo¢†3ž&çšV#¾ò3žÒQML½)O–.WžV¯¾ò'¾òh(€€Í½ÕÉ•…É‘%“šb¿šZ÷šÎW¢žj–6‡ž&=4¥(€€ƒ¾ò#’ú/–š‰‰…ÑÑ±•A±…å•É…ÉÀ‹¾ò'¾ò0(€€Ñ…É•Ñ%¹‘•á•Ïšb¿¦gš²‡ž¯žº·–¾›¦još&O’â·žj(€€ƒš«ž&§žÒ‹–òW¦f–"_¾ò#šr–’hÏ–/¾ò3–Â7š'’â´¿–Þ˜¿–>Ï¾ò'Ž((€€ƒš¾?’âžfóž¯žº·¾òh(€€€Ä¸ƒ–ú{šZ÷šÎW¢–6‡ž&’â·–þ–ëžfó¾ò3žR (€€€€€•±•µ•¹Ð¹…¹¥µ…Ñ” §¾ò!]•ˆ¹¥µ…Ñ¥½¹Ì(€€€€€A'¾ò'¦Žo–BGžn»š¢g–6‡ž&’â·–þ¾ò3¦Žo¢†3¦;ž¢/’â´(€€€€€ƒšr³¦®Sšr’úw¦Žo¢†3šZç–BG¢«–.Wš^/¢ö'¾ò3žr/¢Öß’ú(€€€€€ƒ–?žržjšrwžn»š¢g¦Žo¦;–:ï¾ò3’â7šb¿š¶ïšvÿ–rÀ(€€€€€ƒ–æÏžžïŽ(€€€È¸ƒ–"Ã¦Sžjžz³¦ZO¾ò3ž¯žº·šr³¦®SšÚ#–’Ç¾ò3–:–rÀ(€€€€€ƒž
ã¦Z/’â–Â?žú“ž¯¢*ÇžÊK–¶C¾ò ã¦†¾ò3–B¢«–ú (€€€€€ƒ’â7–B3¢žK–ê›–fÓ–Â–7šÞ‡–ë¾ò'Ž(€€€Ì¸ƒ’â'žfó’æ/¦ZOšVš?–*ƒ’â¦î{¦î{šf¦ZO–Þ¸(€€€€€ƒ¾ò#š¾?žfó¦ZO¦jPàÁµÏš&7žfó–Â¾ò'¾ò3’â7šr’â'žfð(€€€€€ƒžr/¢Öß’ú–?–B3’âžfó¢’¢Ž÷¢Êó’â+¾ò3š¾S¢òšr$(€€€€€ƒŽ3¦žê3žfó–ÂŽ7žjž¾––?šŽ((€€ƒš&šr'–.Wš/žRš"Cžj=7–žÒƒ–.WžV¯šJ·–º3¦÷šr(€€ƒ¢«–ÞÇžžï¦f“¾ò3’â7šržVg–r£žV¯¦v‹’â+žÒ¿ž¦7Ž(¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§žR£ž¯žº´(€€ƒšRïšN+ž:§–ºÛšf’æ¢ššr'–B3š¢žj¦Žo¢†3ž&çšV#¾ò'¾òh(€€ƒ–:šr³¦g¢Ž‡–>«š:—–>_Ž3š«ž&§žÒ‹–òW¦f–"_Ž7¾ò0(€€ƒ–¾¯š¶ïžÖ–è‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•ã–:ïš&ø(€€ƒžn»š¢g–žÒƒ¾ò3–>«¢÷žR£–r£Ž3ž:§–ºÛ–Âš«ž&§Ž7¦g–,(€€ƒšZç–BGŽšRçš"CžnÓš:—š:—–>_Ž3žn»š¢e=4¥“žj¦f–"_Ž7¾ò0(€€ƒš&Ož:§–ºÛ¾ò ‰‰…ÑÑ±•A±…å•É…Éˆ­¥¹‘•ã¾ò$(€€ƒ¢Þš&Oš«ž&§¾ò ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•ã¾ò$(€€ƒ–§ž¢»šZç–BG¦÷¢÷–ÇžR£–B3’â––_–.WžV¯¦
?¢ò¿¾ò3’â7žR (€€ƒ–¾¯–§’î÷–æû’æ;’âš¢žjž¢/–ò?žŠóŽ(¨¼()™Õ¹Ñ¥½¸Á±…å¥É•I½­•Ñ¹¥µ…Ñ¥½¸ (€€€Í½ÕÉ•…É‘%°(€€€Ñ…É•Ñ±•µ•¹Ñ%‘Ì(¥ì((€€€½¹ÍÐÍ½ÕÉ•°ô(€€€€€€€€¡Í½ÕÉ•…É‘%¤ì(((€€€¥˜ …Í½ÕÉ•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÍ½ÕÉ•I•Ðô(€€€€€€€Í½ÕÉ•°¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì((€€€½¹ÍÐÍ½ÕÉ•A½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€Í½ÕÉ•I•Ð¹±•™Ð¬(€€€€€€€€€€€Í½ÕÉ•I•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€Í½ÕÉ•I•Ð¹Ñ½À¬(€€€€€€€€€€€Í½ÕÉ•I•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€½¹ÍÐÍÑ…ÉÑ`€ô(€€€€€€€Í½ÕÉ•A½¥¹Ð¹àì((€€€½¹ÍÐÍÑ…ÉÑd€ô(€€€€€€€Í½ÕÉ•A½¥¹Ð¹äì(((€€€Ñ…É•Ñ±•µ•¹Ñ%‘Ì¹™½É…  (€€€€€€€€¡Ñ…É•Ñ±•µ•¹Ñ%±¤¤ôùì((€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€€€€€™¥É•=¹•I½­•Ð (€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑ`°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑd°(€€€€€€€€€€€€€€€€€€€Ñ…É•Ñ±•µ•¹Ñ%(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ô±¤¨àÀ¤ì((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸™¥É•=¹•I½­•Ð (€€€ÍÑ…ÉÑ`°(€€€ÍÑ…ÉÑd°(€€€Ñ…É•Ñ±•µ•¹Ñ%(¥ì((€€€½¹ÍÐÑ…É•Ñ°ô(€€€€€€€€¡Ñ…É•Ñ±•µ•¹Ñ%¤ì(((€€€¥˜ …Ñ…É•Ñ°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÑ…É•ÑI•Ðô(€€€€€€€Ñ…É•Ñ°¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì((€€€½¹ÍÐÑ…É•ÑA½¥¹Ð€ô(€€€€€€€…µ•A½¥¹ÑÉ½µ±¥•¹Ð (€€€€€€€€€€€Ñ…É•ÑI•Ð¹±•™Ð¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ý¥‘Ñ ¼È°(€€€€€€€€€€€Ñ…É•ÑI•Ð¹Ñ½À¬(€€€€€€€€€€€Ñ…É•ÑI•Ð¹¡•¥¡Ð¼È(€€€€€€€€¤ì((€€€½¹ÍÐ•¹‘`€ô(€€€€€€€Ñ…É•ÑA½¥¹Ð¹àì((€€€½¹ÍÐ•¹‘d€ô(€€€€€€€Ñ…É•ÑA½¥¹Ð¹äì(((€€€½¹ÍÐ…¹±••œô((€€€€€€€5…Ñ ¹…Ñ…¸È (€€€€€€€€€€€•¹‘dµÍÑ…ÉÑd°(€€€€€€€€€€€•¹‘`µÍÑ…ÉÑ`(€€€€€€€€¤¨(€€€€€€€€ÄàÀ½5…Ñ ¹A$ì(((€€€½¹ÍÐÉ½­•Ðô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì((€€€É½­•Ð¹±…ÍÍ9…µ”ô(€€€€€€€€‰™¥É”µÉ½­•ÐµÁÉ½©•Ñ¥±”ˆì((€€€É½­•Ð¹ÍÑå±”¹±•™Ðô(€€€€€€€ÍÑ…ÉÑ`¬‰Áàˆì((€€€É½­•Ð¹ÍÑå±”¹Ñ½Àô(€€€€€€€ÍÑ…ÉÑd¬‰Áàˆì((€€€É½­•Ð¹ÍÑå±”¹ÑÉ…¹Í™½É´ô((€€€€€€€€‰ÑÉ…¹Í±…Ñ” ´ÔÀ”°´ÔÀ”¤É½Ñ…Ñ” ˆ¬(€€€€€€€…¹±••œ¬(€€€€€€€€‰‘•œ¤ˆì(((€€€½¹ÍÐ½Ù•É±…å1…å•È€ô(€€€€€€€€ ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ñð(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì((€€€½Ù•É±…å1…å•È¹…ÁÁ•¹‘¡¥± (€€€€€€€É½­•Ð(€€€€¤ì(((€€€½¹ÍÐ™±¥¡Ñ5Ìô(€€€€€€€€ÐÈÀì(((€€€½¹ÍÐ…¹¥´ô((€€€€€€€É½­•Ð¹…¹¥µ…Ñ” (€€€€€€€€€€€l(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€±•™ÐéÍÑ…ÉÑ`¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€Ñ½ÀéÍÑ…ÉÑd¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÀ(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€±•™Ðé•¹‘`¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€Ñ½Àé•¹‘d¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÄ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€t°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸é™±¥¡Ñ5Ì°(€€€€€€€€€€€€€€€•…Í¥¹œè‰•…Í”µ¥¸ˆ(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€…¹¥´¹½¹™¥¹¥Í ô ¤ôùì((€€€€€€€É½­•Ð¹É•µ½Ù” ¤ì(((€€€€€€€ÍÁ…Ý¹¥É•MÁ…É­	ÕÉÍÐ (€€€€€€€€€€€•¹‘`°(€€€€€€€€€€€•¹‘d(€€€€€€€€¤ì((€€€ôì()ô(()™Õ¹Ñ¥½¸ÍÁ…Ý¹¥É•MÁ…É­	ÕÉÍÐ (€€€à°(€€€ä(¥ì((€€€½¹ÍÐÍÁ…É­½Õ¹Ðô(€€€€€€€€àì((€€€™½È (€€€€€€€±•Ð¤ôÀì(€€€€€€€¤ñÍÁ…É­½Õ¹Ðì(€€€€€€€¤¬¬(€€€€¥ì((€€€€€€€½¹ÍÐÍÁ…É¬ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì((€€€€€€€ÍÁ…É¬¹±…ÍÍ9…µ”ô(€€€€€€€€€€€€‰™¥É”µÉ½­•ÐµÍÁ…É¬ˆì((€€€€€€€ÍÁ…É¬¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€à¬‰Áàˆì((€€€€€€€ÍÁ…É¬¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€ä¬‰Áàˆì(((€€€€€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€ÍÁ…É¬(€€€€€€€€¤ì(((€€€€€€€½¹ÍÐ…¹±”ô((€€€€€€€€€€€€ (€€€€€€€€€€€€€€€5…Ñ ¹A$¨È©¤¼(€€€€€€€€€€€€€€€ÍÁ…É­½Õ¹Ð(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€¡5…Ñ ¹É…¹‘½´ ¤¨À¸Ô¤ì(((€€€€€€€½¹ÍÐ‘¥ÍÑ…¹”ô((€€€€€€€€€€€€Äà¬(€€€€€€€€€€€5…Ñ ¹É…¹‘½´ ¤¨ÄØì(((€€€€€€€½¹ÍÐÍÁÉ•…ô((€€€€€€€€€€€ÍÁ…É¬¹…¹¥µ…Ñ” (€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€±•™Ðéà¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€Ñ½Àéä¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€½Á…¥ÑäèÄ°(€€€€€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÀ(€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€±•™Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€à¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹½Ì¡…¹±”¤©‘¥ÍÑ…¹”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€Ñ½Àè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ä¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹Í¥¸¡…¹±”¤©‘¥ÍÑ…¹”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬‰Áàˆ°(€€€€€€€€€€€€€€€€€€€€€€€½Á…¥ÑäèÀ°(€€€€€€€€€€€€€€€€€€€€€€€½™™Í•ÐèÄ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸èÌàÀ°(€€€€€€€€€€€€€€€€€€€•…Í¥¹œè‰•…Í”µ½ÕÐˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(((€€€€€€€ÍÁÉ•…¹½¹™¥¹¥Í ô ¤ôùì((€€€€€€€€€€€ÍÁ…É¬¹É•µ½Ù” ¤ì((€€€€€€€ôì((€€€ô()ô(()™Õ¹Ñ¥½¸™¥¹‘	…ÑÑ±•M­¥±±	åAÉ•Í•¹Ñ…Ñ¥½¸¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”¥ì(€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€½¹ÍÐ¥‘Ìõ=‰©•Ð¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤ì(€€€™½È¡±•Ð¥¹‘•àôÀí¥¹‘•àñ¥‘Ì¹±•¹Ñ í¥¹‘•à¬¬¥ì(€€€€€€€½¹ÍÐÍ­¥±°õÍ­¥±±…Ñ…‰…Í•m¥‘Ím¥¹‘•áutì(€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°˜™Í­¥±°¹¹…µ”ôôõÍ­¥±±9…µ”˜˜(€€€€€€€€€€€€ …•±•µ•¹ÑQåÁ•ñð…Í­¥±°¹•±•µ•¹ÑññÍ­¥±°¹•±•µ•¹Ðôôõ•±•µ•¹ÑQåÁ”¤(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸Í­¥±°ì(€€€€€€€ô(€€€ô(€€€É•ÑÕÉ¸¹Õ±°ì)ô()™Õ¹Ñ¥½¸…Ñ¥Ù•	…ÑÑ±•Q…É•Ñ%‘Ì¡Í¥‘”±¥¹±Õ‘••™•…Ñ•¥ì(€€€¥˜¡Í¥‘”ôôô‰µ½¹ÍÑ•Èˆ¥ì(€€€€€€€É•ÑÕÉ¸€¡ÉÉ…ä¹¥ÍÉÉ…ä¡ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¤ýÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌémt¤¹™¥±Ñ•È¡¥¹‘•àôùì(€€€€€€€€€€€½¹ÍÐµ½¹ÍÑ•Èõµ½¹ÍÑ•ÉÍm¥¹‘•átì(€€€€€€€€€€€É•ÑÕÉ¸€„„¡µ½¹ÍÑ•È˜˜¡¥¹±Õ‘••™•…Ñ•‘ññµ½¹ÍÑ•È¹…±¥Ù”„ôõ™…±Í”˜™9Õµ‰•È¡µ½¹ÍÑ•È¹¡À¤øÀ¤¤ì(€€€€€€€ô¤ì(€€€ô(€€€É•ÑÕÉ¸•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™¥±Ñ•È¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€É•ÑÕÉ¸€„„¡¡…É…Ñ•È˜˜¡¥¹±Õ‘••™•…Ñ•‘ññ9Õµ‰•È¡¡…É…Ñ•È¹¡À¤øÀ¤¤ì(€€€ô¤ì)ô((¼¨½µ‰…Ð½Ý¹ÌÑ…É•ÐÍ•±•Ñ¥½¸¸Q¡¥Ì½¹ÑÉ…Ð¥ÌÉ•…Ñ•‰•™½É”XÄÐÈ½XÄÐÌÍ•”(€€Ñ¡”…ÍÐ°Í¼Ñ¡”Y`ÉÕ¹Ñ¥µ”¹•Ù•ÈÉ•…‘ÌÑ¡”…Ñ¥½¸ÅÕ•Õ”°¡¥Ð½É‘•È½È±¥Ù”(€€ÍÕÉÙ¥Ù½È‰½Õ¹‘ÌÑ¼Õ•ÍÌ¥ÑÌÁÉ¥µ…ÉäÑ…É•Ð½ÈÍ•µ…¹Ñ¥Œ™½½ÑÁÉ¥¹Ð¸€¨¼)™Õ¹Ñ¥½¸É•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð¡Í¥‘”±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±…Ñ½É%¹‘•à±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘•=Ù•ÉÉ¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”¥ì(€€€½¹ÍÐÍ­¥±°õÍ­¥±±9…µ”ôôô‹šf»¦kšRïšN(ˆ(€€€€€€€€ýí¥è‰¹½Éµ…°ˆ±Ñ…É•ÑQåÁ”è‰Í¥¹±”ˆ±…Ñ•½Éäè‰Á¡åÍ¥…°‰ô(€€€€€€€€é™¥¹‘	…ÑÑ±•M­¥±±	åAÉ•Í•¹Ñ…Ñ¥½¸¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”¤ì(€€€½¹ÍÐÑ…É•ÑQåÁ”õMÑÉ¥¹œ¡Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘•ññÍ­¥±°˜™Í­¥±°¹Ñ…É•ÑQåÁ•ñð‰Í¥¹±”ˆ¤ì(€€€½¹ÍÐÍ…µ•M¥‘”ô½…±±ä½¤¹Ñ•ÍÐ¡Ñ…É•ÑQåÁ”¥ñð½¡•…±ñÉ•Ù¥Ù•ñ‰Õ™˜¼¹Ñ•ÍÐ¡MÑÉ¥¹œ¡Í­¥±°˜™Í­¥±°¹…Ñ•½Éåñðˆˆ¤¤ì(€€€½¹ÍÐÑ…É•ÑM¥‘”õÑ…É•ÑM¥‘•=Ù•ÉÉ¥‘”ôôô‰Á±…å•È‰ññÑ…É•ÑM¥‘•=Ù•ÉÉ¥‘”ôôô‰µ½¹ÍÑ•Èˆ(€€€€€€€€ýÑ…É•ÑM¥‘•=Ù•ÉÉ¥‘”(€€€€€€€€è¡Í…µ•M¥‘”ýÍ¥‘”è¡Í¥‘”ôôô‰Á±…å•Èˆü‰µ½¹ÍÑ•Èˆè‰Á±…å•Èˆ¤¤ì(€€€½¹ÍÐ•áÁ±¥¥Ñ%‘ÌõÉÉ…ä¹¥ÍÉÉ…ä¡Ñ…É•Ñ%‘Ì¤ýÑ…É•Ñ%‘Ì¹Í±¥” ¤émtì(€€€±•ÐÁÉ¥µ…ÉäõÑ…É•Ñ%„ôõÕ¹‘•™¥¹•˜™Ñ…É•Ñ%„ôõ¹Õ±°ýÑ…É•Ñ%é¹Õ±°ì(€€€±•Ð¥‘Ìõ•áÁ±¥¥Ñ%‘Ìì((€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰Í•±˜ˆ¥ì(€€€€€€€ÁÉ¥µ…Éäõ…Ñ½É%¹‘•àì(€€€€€€€¥‘Ìõm…Ñ½É%¹‘•átì(€€€ô((€€€¥˜ …¥‘Ì¹±•¹Ñ ¥ì(€€€€€€€±•ÐÅÕ•Õ•õ¹Õ±°ì(€€€€€€€¥˜¡Í¥‘”ôôô‰Á±…å•Èˆ˜™ÑåÁ•½˜ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ì„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€ÅÕ•Õ•õÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ì˜™ÅÕ•Õ•‘A±…å•ÉÑ¥½¹Ím…Ñ½É%¹‘•átì(€€€€€€€ô(€€€€€€€¥˜¡ÁÉ¥µ…Éäôôõ¹Õ±°˜™ÅÕ•Õ•¥ì(€€€€€€€€€€€ÁÉ¥µ…ÉäõÑ…É•ÑM¥‘”ôôô‰µ½¹ÍÑ•ÈˆýÅÕ•Õ•¹Ñ…É•ÐéÅÕ•Õ•¹Ñ…É•Ñ±±äì(€€€€€€€ô(€€€€€€€¥˜¡ÁÉ¥µ…Éäôôõ¹Õ±°˜™Í¥‘”ôôô‰Á±…å•Èˆ˜™Ñ…É•ÑM¥‘”ôôô‰µ½¹ÍÑ•Èˆ˜™ÑåÁ•½˜Í•±•Ñ•‘5½¹ÍÑ•È„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€ÁÉ¥µ…ÉäõÍ•±•Ñ•‘5½¹ÍÑ•Èì(€€€€€€€ô((€€€€€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰…±°‰ññÑ…É•ÑQåÁ”ôôô‰…±±å±°ˆ¥ì(€€€€€€€€€€€¥‘Ìõ…Ñ¥Ù•	…ÑÑ±•Q…É•Ñ%‘Ì¡Ñ…É•ÑM¥‘”±™…±Í”¤ì(€€€€€€€õ•±Í”¥˜¡Ñ…É•ÑM¥‘”ôôô‰µ½¹ÍÑ•Èˆ˜™9Õµ‰•È¹¥Í%¹Ñ••È¡ÁÉ¥µ…Éä¤˜˜½x¡ÑÉ¥ñÉ½Ýñ½±Õµ¹ñ¡½É¥é½¹Ñ…°´Ì¤½¤¹Ñ•ÍÐ¡Ñ…É•ÑQåÁ”¤¥ì(€€€€€€€€€€€¥‘ÌõÑåÁ•½˜•ÑM­¥±±Q…É•ÑÌôôô‰™Õ¹Ñ¥½¸ˆý•ÑM­¥±±Q…É•ÑÌ¡ÁÉ¥µ…Éä±Ñ…É•ÑQåÁ”¤émÁÉ¥µ…Éåtì(€€€€€€€õ•±Í”¥˜¡Ñ…É•ÑM¥‘”ôôô‰Á±…å•Èˆ˜™9Õµ‰•È¹¥Í%¹Ñ••È¡ÁÉ¥µ…Éä¤˜˜½x¡ÑÉ¥ñ…±±åQÉ¥ñÉ½Ýñ½±Õµ¸¤½¤¹Ñ•ÍÐ¡Ñ…É•ÑQåÁ”¤¥ì(€€€€€€€€€€€½¹ÍÐ½Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•™¥•±‘M±½ÑÌé¹Õ±°ì(€€€€€€€€€€€½¹ÍÐ™½Éµ…Ñ¥½¸õ½Ý¹•È˜™ÑåÁ•½˜½Ý¹•È¹•¹ÍÕÉ•±±å½Éµ…Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ý½Ý¹•È¹•¹ÍÕÉ•±±å½Éµ…Ñ¥½¸¡•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¤é¹Õ±°ì(€€€€€€€€€€€¥‘Ìõ™½Éµ…Ñ¥½¸˜™ÑåÁ•½˜½Ý¹•È¹É•Í½±Ù•±±åQ…É•ÑÌôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ý½Ý¹•È¹É•Í½±Ù•±±åQ…É•ÑÌ¡™½Éµ…Ñ¥½¸±ÁÉ¥µ…Éä±Ñ…É•ÑQåÁ”±¥¹‘•àôùì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€„„¡¡…É…Ñ•È˜™9Õµ‰•È¡¡…É…Ñ•È¹¡À¤øÀ¤ì(€€€€€€€€€€€€€€€ô¤émÁÉ¥µ…Éåtì(€€€€€€€õ•±Í”¥˜¡ÁÉ¥µ…Éä„ôõ¹Õ±°˜™ÁÉ¥µ…Éä„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€¥‘ÌõmÁÉ¥µ…Éåtì(€€€€€€€õ•±Í”¥˜¡Í…µ•M¥‘”¥ì(€€€€€€€€€€€¥‘Ìõ…Ñ¥Ù•	…ÑÑ±•Q…É•Ñ%‘Ì¡Ñ…É•ÑM¥‘”±™…±Í”¤ì(€€€€€€€€€€€ÁÉ¥µ…Éäõ¥‘Ì¹±•¹Ñ ý¥‘ÍlÁté¹Õ±°ì(€€€€€€€ô(€€€ô((€€€¥‘ÌõÉÉ…ä¹™É½´¡¹•ÜM•Ð¡¥‘Ì¹™¥±Ñ•È¡9Õµ‰•È¹¥Í%¹Ñ••È¤¤¤ì(€€€¥˜¡Ñ…É•ÑQåÁ”ôôô‰…±°‰ññÑ…É•ÑQåÁ”ôôô‰…±±å±°ˆ¥ìÁÉ¥µ…Éäõ¹Õ±°ìô(€€€•±Í”¥˜¡ÁÉ¥µ…Éäôôõ¹Õ±°˜™¥‘Ì¹±•¹Ñ ¥ìÁÉ¥µ…Éäõ¥‘ÍlÁtìô((€€€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡ì(€€€€€€€Ù•ÉÍ¥½¸è‰‰…ÑÑ±”µÑ…É•Ðµ½¹ÑÉ…ÐµØÄˆ°(€€€€€€€Í¥‘”éÍ¥‘”°(€€€€€€€Ñ…É•ÑM¥‘”éÑ…É•ÑM¥‘”°(€€€€€€€Ñ…É•ÑQåÁ”éÑ…É•ÑQåÁ”°(€€€€€€€…Ñ½É%¹‘•àé9Õµ‰•È¹¥Í%¹Ñ••È¡…Ñ½É%¹‘•à¤ý…Ñ½É%¹‘•àèÀ°(€€€€€€€Ñ…É•Ñ%éÁÉ¥µ…Éä°(€€€€€€€Ñ…É•Ñ%‘Ìé=‰©•Ð¹™É••é”¡¥‘Ì¹Í±¥” ¤¤(€€€ô¤ì)ô()Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ðõ=‰©•Ð¹™É••é”¡ì(€€€Ù•ÉÍ¥½¸è‰‰…ÑÑ±”µÑ…É•Ðµ½¹ÑÉ…ÐµØÄˆ°(€€€É•…Ñ”éÉ•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð)ô¤ì()™Õ¹Ñ¥½¸•ÑM­¥±±9…µ•	…‘•ÕÉ…Ñ¥½¸¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”¥ì((€€€¥˜ (€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ€˜˜(€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÉ•ÑM­¥±±9…µ•¥ÍÁ±…åÕÉ…Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€½¹ÍÐ‘ÕÉ…Ñ¥½¸ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹ØÄÐÉ•ÑM­¥±±9…µ•¥ÍÁ±…åÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€Í­¥±±9…µ”°(€€€€€€€€€€€€€€€€€€€•±•µ•¹ÑQåÁ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€¥˜¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡‘ÕÉ…Ñ¥½¸¤€˜˜‘ÕÉ…Ñ¥½¸øÀ¥ì(€€€€€€€€€€€É•ÑÕÉ¸5…Ñ ¹É½Õ¹¡‘ÕÉ…Ñ¥½¸¤ì(€€€€€€€ô(€€€ô((€€€É•ÑÕÉ¸5…Ñ ¹É½Õ¹ ÔÈÀ¨È¼Ì¤ì)ô(()™Õ¹Ñ¥½¸Í¡½ÝM­¥±±9…µ•	…‘”¡Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±¡…É…Ñ•É%¹‘•à±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”¥ì((€€€½¹ÍÐÑ…É•Ñ½¹ÑÉ…ÐõÉ•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð (€€€€€€€€‰Á±…å•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±9Õµ‰•È¹¥Í%¹Ñ••È¡¡…É…Ñ•É%¹‘•à¤ý¡…É…Ñ•É%¹‘•àèÀ±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”(€€€€¤ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶¢žšÆëŽ3šZ–¶_šr–#¢Š¯¢N/’ö?Ž(€€€€€€ƒ–>#¢ÞÏ–"Ãšr–&7¦v‹Ž7žjš‚çšr³–:–nƒ¾ò'¾òh(€€€€€€ƒ’æ/–&7š*+šZ–¶_–žÒƒžnÓš:—–†{¦Ë¢žK¢&Ë–6‡ž&¢Ž‡¦vˆ(€€€€€€ƒžVÛ–¶C–žÒƒŽ’ö¢žK¢&Ë–6‡ž&šRïšN+žjžz³¦ZOšršJ·šRø(€€€€€€ƒŽ3–&7–
ûŽ7–.WžV¯¾ò!ÑÉ…¹Í™½É·’ö7žžï¾ò'¾ò0(€€€€€€MO¢š?–&¾òk’îï’öWšr'’ösžR£’âµÑÉ…¹Í™½É·žj–žÒƒ¾ò0(€€€€€€ƒšr–îëž®/’â–/šZÃžjžZ+šRû–Æ“¾ò3š*+–ºš&šr'–¶C–žÒƒžj(€€€€€€ƒžZ+šRû¦‚–ê?¦^s¦Ë¦g–/–Æ¦£ž¾–r7¢Ž‡ŠSŠS’â7žº‡–¶C–žÒ€(€€€€€€ƒžjèµ¥¹‘•ã¢¢·–’k¦®c¾ò3¦÷¢ÞÏ’â7–ë¦g–/ž¾–r7–:ï¢Þ|(€€€€€€ƒ–’[¦v‹žjšvÇ¢–ÿš¾S¢òŽš*¢÷–B7ž¢ÇšZ–¶_–&o––÷šb¿–6‡ž&žj(€€€€€€ƒ–¶C–žÒƒ¾ò3–6‡ž&–&o––÷–r£šRïšN+žz³¦ZOšr%ÑÉ…¹Í™½É·–r£¢ÞG¾ò0(€€€€€€ƒ¦g–ÂÇšb¿’â7žº…èµ¥¹‘•ã¢¢·–’k¦®c¦÷šÊKžR£žjžrš¶–:–nƒŽ((€€€€€€ƒšRçš"C’â7–7žVÛ–6‡ž&žj–¶C–žÒƒ¾ò3žnÓš:—š:o–"À(€€€€€€‘½Õµ•¹Ð¹‰½‘ç–êW’â/¾ò#’â7šr¢Š¯’îï’öW–.WžV¬(€€€€€€ƒšÎ‹–>+žj–rÃšZç¾ò'¾ò3žR¡•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€€€€€ƒ¦?–ë–6‡ž&žn»–&7–r£žV¯¦v‹’â+žj–¾›¦jo–êŸš¢g¾ò0(€€€€€€ƒ–7žR¡Á½Í¥Ñ¥½¸é™¥á•“š*+šZ–¶_žÊûšê[žZ+–r (€€€€€€ƒ–6‡ž&š¶’â+šZçŠSŠS¦gš¢šZ–¶_žjžZ+šRû¦‚–ê<(€€€€€€ƒ–ÂÇšb¿žnã–Â7šZóšVÓ–/¦‚¦v‹–r£š¾S¢ò¾ò0(€€€€€€ƒ’â7šr–7¢Š¯–6‡ž&¢«–ÞÇžj–.WžV¯–nÃ’ö?Ž(€€€€¨¼((€€€½¹ÍÐÉ•Ðô(€€€€€€€•±•µ•¹Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐ‰…‘”€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€‰…‘”¹±…ÍÍ9…µ”ô‰Í­¥±°µ¹…µ”µ‰…‘”ˆì(€€€‰…‘”¹‘…Ñ…Í•Ð¹Í­¥±±±•µ•¹ÐõMÑÉ¥¹œ¡•±•µ•¹ÑQåÁ•ñð‰¹½Éµ…°ˆ¤ì(((€€€‰…‘”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€Í­¥±±9…µ”ì((€€€½¹ÍÐ‰…‘•ÕÉ…Ñ¥½¸ô(€€€€€€€•ÑM­¥±±9…µ•	…‘•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€Í­¥±±9…µ”°(€€€€€€€€€€€•±•µ•¹ÑQåÁ”(€€€€€€€€¤ì((€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€ˆ´µÍ­¥±°µ¹…µ”µ‘¥ÍÁ±…äµ‘ÕÉ…Ñ¥½¸ˆ°(€€€€€€€‰…‘•ÕÉ…Ñ¥½¸¬‰µÌˆ(€€€€¤ì(€€€‰…‘”¹‘…Ñ…Í•Ð¹Í­¥±±±•µ•¹ÐõMÑÉ¥¹œ¡•±•µ•¹ÑQåÁ•ñð‰¹½Éµ…°ˆ¤ì)½¹ÍÐ‰…‘•A½¥¹ÐõíàéÉ•Ð¹±•™Ð­É•Ð¹Ý¥‘Ñ ¼È±äéÉ•Ð¹Ñ½Áôì((€€€‰…‘”¹ÍÑå±”¹±•™Ðõ‰…‘•A½¥¹Ð¹à¬‰Áàˆì(€€€‰…‘”¹ÍÑå±”¹Ñ½Àõ‰…‘•A½¥¹Ð¹ä¬‰Áàˆì(€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡‰…‘”¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€‰…‘”€˜˜(€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€‰…‘”(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô±‰…‘•ÕÉ…Ñ¥½¸¤ì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ€˜˜ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘” ‰Á±…å•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”°(€€€€€€€€€€€¡…É…Ñ•É%¹‘•áñðÀ±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%‘Ì±Ñ…É•Ñ½¹ÑÉ…Ð(€€€€€€€€¤ì(€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§šZ÷šRûš*¢÷šf(€€ƒ’æ¢š¢ÞÏš*¢÷–B7ž¢Ç¾ò'¾òh(€€ƒ¢Þ}Í¡½ÝM­¥±±9…µ•	…‘” §–æû’æ;’âš¢‡’âš¢¾ò0(€€ƒ–R¿’â–Þ»–"—šb¿žn»š¢g–žÒƒ–úx(€€‰…ÑÑ±•A±…å•É…É­¡…É…Ñ•É%¹‘•à(€€ƒš>oš"A‰…ÑÑ±•5½¹ÍÑ•È­µ½¹ÍÑ•É%¹‘•ãŠSŠP(€€ƒš«ž&§šRïšN+šf–B3š¢–>¿¢÷¢žãžfó–6‡ž&–&7–
û–.WžV¬(€€ƒ¾ò!±Õ¹•5½¹ÍÑ•É…É §¾ò'¾ò3š&’î—¦g¢Ž„(€€ƒ’âš¢’â7žVÛ–6‡ž&žj–¶C–žÒƒŽš:o–r (€€‘½Õµ•¹Ð¹‰½‘ç–êW’â/ŽžR¡Á½Í¥Ñ¥½¸é™¥á•(€€ƒžZ+–r£š«ž&§–6‡ž&š¶’â+šZç¾ò3–:–nƒ¢Þ|(€€Í¡½ÝM­¥±±9…µ•	…‘” §–º3–£žnã–B3Ž(¨¼()™Õ¹Ñ¥½¸Í¡½Ý5½¹ÍÑ•ÉM­¥±±9…µ•	…‘” (€€€Í­¥±±9…µ”°(€€€•±•µ•¹ÑQåÁ”°(€€€µ½¹ÍÑ•É%¹‘•à°(€€€Ñ…É•Ñ%°(€€€Ñ…É•Ñ%‘Ì°(€€€Ñ…É•ÑM¥‘”°(€€€Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”(¥ì((€€€½¹ÍÐÑ…É•Ñ½¹ÑÉ…ÐõÉ•…Ñ•	…ÑÑ±•Q…É•Ñ½¹ÑÉ…Ð (€€€€€€€€‰µ½¹ÍÑ•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”±9Õµ‰•È¹¥Í%¹Ñ••È¡µ½¹ÍÑ•É%¹‘•à¤ýµ½¹ÍÑ•É%¹‘•àèÀ±Ñ…É•Ñ%±Ñ…É•Ñ%‘Ì±Ñ…É•ÑM¥‘”±Ñ…É•ÑQåÁ•=Ù•ÉÉ¥‘”(€€€€¤ì((€€€½¹ÍÐ•±•µ•¹Ðô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ¬(€€€€€€€€€€€µ½¹ÍÑ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÉ•Ðô(€€€€€€€•±•µ•¹Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(((€€€½¹ÍÐ‰…‘”ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€‰…‘”¹±…ÍÍ9…µ”ô‰Í­¥±°µ¹…µ”µ‰…‘”ˆì(€€€‰…‘”¹‘…Ñ…Í•Ð¹Í­¥±±±•µ•¹ÐõMÑÉ¥¹œ¡•±•µ•¹ÑQåÁ•ñð‰¹½Éµ…°ˆ¤ì(((€€€‰…‘”¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€Í­¥±±9…µ”ì((€€€½¹ÍÐ‰…‘•ÕÉ…Ñ¥½¸ô(€€€€€€€•ÑM­¥±±9…µ•	…‘•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€Í­¥±±9…µ”°(€€€€€€€€€€€•±•µ•¹ÑQåÁ”(€€€€€€€€¤ì((€€€‰…‘”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€ˆ´µÍ­¥±°µ¹…µ”µ‘¥ÍÁ±…äµ‘ÕÉ…Ñ¥½¸ˆ°(€€€€€€€‰…‘•ÕÉ…Ñ¥½¸¬‰µÌˆ(€€€€¤ì(€€€‰…‘”¹‘…Ñ…Í•Ð¹Í­¥±±±•µ•¹ÐõMÑÉ¥¹œ¡•±•µ•¹ÑQåÁ•ñð‰¹½Éµ…°ˆ¤ì)½¹ÍÐ‰…‘•A½¥¹ÐõíàéÉ•Ð¹±•™Ð­É•Ð¹Ý¥‘Ñ ¼È±äéÉ•Ð¹Ñ½Áôì((€€€‰…‘”¹ÍÑå±”¹±•™Ðõ‰…‘•A½¥¹Ð¹à¬‰Áàˆì(€€€‰…‘”¹ÍÑå±”¹Ñ½Àõ‰…‘•A½¥¹Ð¹ä¬‰Áàˆì(€€€‘½Õµ•¹Ð¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡‰…‘”¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€¥˜ (€€€€€€€€€€€‰…‘”€˜˜(€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”(€€€€€€€€¥ì((€€€€€€€€€€€‰…‘”¹Á…É•¹Ñ9½‘”¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€‰…‘”(€€€€€€€€€€€€¤ì((€€€€€€€ô((€€€ô±‰…‘•ÕÉ…Ñ¥½¸¤ì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ€˜˜ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÄÐÉA±…åM­¥±±¹¥µ…Ñ¥½¹É½µ	…‘” ‰µ½¹ÍÑ•Èˆ±Í­¥±±9…µ”±•±•µ•¹ÑQåÁ”°(€€€€€€€€€€€µ½¹ÍÑ•É%¹‘•áñðÀ±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%±Ñ…É•Ñ½¹ÑÉ…Ð¹Ñ…É•Ñ%‘Ì±Ñ…É•Ñ½¹ÑÉ…Ð(€€€€€€€€¤ì(€€€ô()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š.ÿš:'šZ÷šRûš*¢÷šf(€€ƒ¢ÞÏ–éMCšÚ#¢_šVã–¶_žj–.WžV¯¾ò'¾òh(€€ƒ’æ/–&7š¾?š²‡šZ÷šRûš*¢÷¾ò3¦÷šr–>›–’[¢ÞÏ–ë’â–,(€€ƒŽ0µaaMCŽ7žjšÖ»–.WšZ–¶_¾ò3š>C¦Kš&’ê–’k–ÂEMCŽ(€€ƒ’öÿžR£¢¢šë–ú_¦g–/š>Cž’ë’â7¦r¢š¾ò3žnÓš:—š.ÿš:'Ž(€€ƒ’þwžVg¦g–/–÷–ò?šr³¢ê¯¾ò#¢ºOš&šr'–Fó–>¯žj–rÃšZä(€€ƒ¦
šb¿¢÷š¶–âã¦/’ösŽ’â7šr–fÓ¦2¿¾ò'¾ò0(€€ƒ’ö–÷–ò?–Ÿ–ºçšâž¦ë¾ò3’â7–7–k’îï’öW¦†¿ž’ëŽ(¨¼()™Õ¹Ñ¥½¸Í¡½ÝA±…å•ÉMÁA½ÁÕÀ¡…µ½Õ¹Ð±¡…É…Ñ•É%¹‘•à¥ì((€€€É•ÑÕÉ¸ì()ô(()™Õ¹Ñ¥½¸±Õ¹•A±…å•É…É¡¡…É…Ñ•É%¹‘•à¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µÕÀˆ(€€€€¤ì(((€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µÕÀˆ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µÕÀˆ(€€€€€€€€¤ì((€€€ô°ÐÔÀ¤ì()ô(()™Õ¹Ñ¥½¸±Õ¹•5½¹ÍÑ•É…É¡¥¹‘•à¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µ‘½Ý¸ˆ(€€€€¤ì(((€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µ‘½Ý¸ˆ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰…ÑÑ…­•Èµ±Õ¹”µ‘½Ý¸ˆ(€€€€€€€€¤ì((€€€ô°ÐÔÀ¤ì()ô(((¼¨(€€ƒŠbƒ¦Z¦ÿ–.WžV¯¾ò#šZÃ–Š{¾ò'¾òh(€€ƒ¢Þ}±Õ¹—šb¿–B3’âž¢»–¾¯šÎW¾ò3–>«šb¿š>o’â–-±…ÍÏ¾ò0(€€ƒ––_žR£–r£Ž3¢êË¦;šRïšN(¿š*×š*_žVÃ–âãž.š/Ž7žj¦
–/žn»š¢g¢ê¯’â+Ž(¨¼()™Õ¹Ñ¥½¸Í¡½Ý½‘•¹¥µ…Ñ¥½¸¡•±•µ•¹Ð¥ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰‘½‘”µ‰…¬ˆ(€€€€¤ì(((€€€Ù½¥•±•µ•¹Ð¹½™™Í•Ñ]¥‘Ñ ì(((€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰‘½‘”µ‰…¬ˆ(€€€€¤ì(((€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰‘½‘”µ‰…¬ˆ(€€€€€€€€¤ì((€€€ô°ÐÔÀ¤ì()ô(((¼¨(€€ƒ–B3šf¢fWžBŽ3šRïšN+šÊK–F÷’â·Ž7¢ÞŽ3žVÃ–âãž.š/šÊKžRšV#Ž4(€€ƒ¦g–§ž¢¹µ¥ÍÏž.šÎ¾òh(€€ƒžn»š¢g–6‡ž&šJ·šRû¦Z¦ÿ–.WžV¯¾ò0(€€ƒ’â›¢ÞÏ–ë’â–/žÃžf÷¢&ËžjšZ–¶_š>Cž’ëŽ((€€¥ÍA±…å•ÉQ…É•ÐõÑÉÕ—šf–Â7¢Æ‡šb¿ž:§–ºÛ¢«–ÞÇžj–6‡ž&¾ò0(€€ƒ–B›–&žR¡¥¹‘•ã–:ïš*Oš«ž&§–6‡ž&Ž(¨¼()™Õ¹Ñ¥½¸Í¡½Ý5¥ÍÍ™™•Ð¡¥ÍA±…å•ÉQ…É•Ð±¥¹‘•à±Ñ•áÐ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€¥ÍA±…å•ÉQ…É•ÐõÑÉÕ—šf¾ò0(€€€€€€¥¹‘•ãž>û–r£’î¢†£Ž3ž²³–æû–ò×ž:§–ºÛ–6‡Ž4(€€€€€€ƒ¾ò À÷ž²³’â¢žK¢&ËŽÄ÷ž²³’ê3¢žK¢&Ë¾ò'¾ò0(€€€€€€ƒ’â7–7šÂã¦ƒš*M‰…ÑÑ±•A±…å•ÉI½ß¢Ž‡ž²³’â–ò×–6‡¾ò0(€€€€€€ƒ¦gš¢ž²³’ê3¢žK¢&Ë¢Š¯šRïšN+šÊK–F÷’â·šf¾ò0(€€€€€€ƒ¦Z¦ÿ–.WžV¯š&7šr–ëž>û–r£š¶žŠëžj–6‡ž&’â+Ž(€€€€¨¼((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€¥ÍA±…å•ÉQ…É•Ð(€€€€€€€€ü(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¥¹‘•áñðÀ¤(€€€€€€€€¤(€€€€€€€€è(€€€€€€€€ ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í¡½Ý½‘•¹¥µ…Ñ¥½¸ (€€€€€€€•±•µ•¹Ð(€€€€¤ì(((€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€•±•µ•¹Ð°(€€€€€€€Ñ•áÑñð‰5%MLˆ°(€€€€€€€€‰µ¥ÍÌˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½ÝA±…å•É!¥Ð¡…µ½Õ¹Ð±ÑåÁ”±¡…É…Ñ•É%¹‘•à±¥ÍA½Í¥Ñ¥Ù”±¥ÍÉ¥Ð¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì(((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ–7š²‡’þ»š¶¾ò#žržjš*O–"Ã¦ëšò?žj–rÃšZç¾ò'¾òh(€€€€€€ƒ’â+š²‡–>«š:K¦f“’êÑåÁ”ôôô‰¡•…°‹¾ò3’öMC¢^—šÂÐ(€€€€€€ƒš‹–ú§žR£žjšb½ÑåÁ”ôôô‰ÍÀ‹¾ò3’â7šb¼‰¡•…°‹¾ò0(€€€€€€ƒšò?žÚË’æ/¦¶k¾ò3–ZuMC¢^—šÂÓš‹–ú§žjšf–g¦
šb¿šr(€€€€€€ƒ¢ª“¢žãžfó¦r–.WŠSŠS–B3’â–/š‚çšr³–V?¦†3¾ò#žR£¢Îšê@(€€€€€€ƒž¢»¦†{žj–¶_’âË–:ïž2sšâ³Ž3¦gšb¿š¶¦v‹¦
¢Êƒ¦v‹šV#šzsŽ4(€€€€€€ƒšr³’ú–ÂÇ’â7–>¿¦vƒ¾ò0‰ÍÀ‹¦g–/–¶_’âË–B3šf’î¢† (€€€€€€ƒŽ3¦gšb½MCŽ7¾ò3šÊK¢ú›šÎW–B3šf–"¢ú£Ž3šb¿š‹–ú¤(€€€€€€ƒ¦
šb¿šÖ–’ÇŽ7¾ò'Ž((€€€€€€ƒ¦g¢Ž‡¦–âÛžfóž>û’ê–>›’â–/–nƒž
ë–B3š¢–:–nƒ¦ƒš"Cžj(€€€€€€‰ÕŸ¾òk’â/¦v‹¦†¿ž’ëžj¬¼·ž²›¢f¾ò3’æ–>«¢ª7–ú\(€€€€€€ÑåÁ”ôôô‰¡•…°‹¾ò1MC¢^—šÂÓš‹–ú§žjšf–d(€€€€€€ƒšr¦†¿ž’ëš"CŽ0´ÔÁMCŽ7¦gž¢»¢ª“–Â;’êëžj¢ÊƒšVã¾ò0(€€€€€€ƒšb;šb;šb¿–r£¢Žs¢† ¿¢Žs¦¶S–6ï¦†¿ž’ë¢Êƒ¢fŽ((€€€€€€ƒšRçš"Cšb;žŠë–
Ï’â–-¥ÍA½Í¥Ñ¥Ù—–>šVã¾ò0(€€€€€€ƒ’â7–7¦vƒ–¶_’âË–:ïž2s¾ò3¦g¢Ž‡–Fó–>¯žjš¾?–/–rÃšZä(€€€€€€ƒ¦÷¢š¢«–ÞÇšb;žŠë¢²ošâš–kŽ3¦gš²‡šb¿š¶¦v‹šV#šzp(€€€€€€ƒ¦
šb¿¢Êƒ¦v‹šV#šzsŽ7¾ò3–§–-‰ÕŸ’âš²‡’þ»––÷¾ò0(€€€€€€ƒ’î—–ú3’æ’â7šr–7šr'¦†{’òóŽ1ÑåÁ—–¶_’âËšÊKš*((€€€€€€ƒš~C–/ššÎ¢š»¦Ë–:ïŽ7¢3šò?š:'žjž.šÎŽ(€€€€¨¼((€€€€¼¨…µ…”Á½ÁÕÀÉ•…Ñ¥½¸¥ÌÑ¡”¡¥Ðµ™••‘‰…¬½Ý¹•È¸Q¡”…ÉÉ½½Ð¹•Ù•È(€€€€€€É••¥Ù•Ì„‰½É‘•È½Í¡…‘½Ü¡¥ÐÍÑ…Ñ”ìÁ½Í¥Ñ¥Ù”!•…°½M@™••‘‰…¬Ñ¡•É•™½É”(€€€€€€…¹¹½Ð…¥‘•¹Ñ…±±ä¥¹¡•É¥Ð‘…µ…”Í•µ…¹Ñ¥Ì¸€¨¼((€€€¥˜ (€€€€€€€…µ½Õ¹Ð„ôõÕ¹‘•™¥¹•€˜˜(€€€€€€€…µ½Õ¹Ð„ôõ¹Õ±°(€€€€¥ì((€€€€€€€½¹ÍÐÁÉ•™¥à€ô(€€€€€€€€€€€¥ÍA½Í¥Ñ¥Ù”(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆ¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆ´ˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3š«ž&§š&Ož:§–ºØ(€€€€€€€€€€ƒž"šN+šf’æ¢ššr'šV#šzs¾ò3¢Þ}Í¡½Ý5½¹ÍÑ•É!¥Ð ¤(€€€€€€€€€€ƒ¦
¦
+ž:§–ºÛš&Oš«ž&§ž"šN+žj–F#ž>ûšZç–ò?’â¢Ó¾ò'¾òh(€€€€€€€€€€¥ÍÉ¥Óž
éÑÉÕ—šf¾ò3šVã–¶_–&7¦v‹–*ƒÂ~J—¾ò0(€€€€€€€€€€ƒ’â›š*)¥ÍÉ¥Ó–
ÏžÖ™Í¡½Ý…µ…•A½ÁÕÀ §¾ò0(€€€€€€€€€€ƒ¢ºO–º––_’â(¹É¥Ñ¥…°µÁ½ÁÕÃš¢–ò<(€€€€€€€€€€ƒ¾ò#–¶_šnÓ–’ŸŽ¦†?¢&ËšnÓ¦Kžn»¾ò'¾ò3¢Þž:§–ºÛ–Â4(€€€€€€€€€€ƒš«ž&§ž"šN+šfžr/–"ÃžjšV#šzs–B3’â––_Ž(€€€€€€€€¨¼((€€€€€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€€€€€•±•µ•¹Ð°(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€¥ÍÉ¥Ð(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¬(€€€€€€€€€€€ÁÉ•™¥à¬(€€€€€€€€€€€…µ½Õ¹Ð¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€ÑåÁ”ôôô‰ÍÀˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰M@ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‰!@ˆ(€€€€€€€€€€€€¤°(€€€€€€€€€€€ÑåÁ”°(€€€€€€€€€€€¥ÍÉ¥Ð(€€€€€€€€¤ì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢¶ßžnû–
ß–ºÏš¦–"Ø¸¸»¦†¿ž’ëžf÷¢&È(€€ƒšVã–¶_š&¦f“–.WžV¯¾ò3–š¾òil´ÔØÝwŽ7¾ò'¾òh(€€ƒ¢Þ}Í¡½ÝA±…å•É!¥Ð §–B3š¢š&ù‰…ÑÑ±•A±…å•É…É“–žÒƒ¾ò0(€€ƒ’öžR£–Â#–Æ³žjÍ¡¥•±“¦†{–z/¾ò#žf÷¢&ËšZ–¶_¾ò3¢š,¹‘…µ…”µÁ½ÁÕÀ¸(€€Í¡¥•±µÁ½ÁÕÃ¾ò'¾ò3¢Þ’â¢"±!Cš:'¢†žjžÒ–¶_šb;žŠë–6–"¦Z/’ú¾ò0(€€ƒ’î¢†£Ž3¦gšb¿¢¶ßžnûš&o’â/’úžj¦?¾ò3’â7šb¿žržjš&¢†Ž7Ž(¨¼)™Õ¹Ñ¥½¸Í¡½ÝM¡¥•±‘‰Í½Éˆ¡¡…É…Ñ•É%¹‘•à±…‰Í½É‰•¥ì((€€€¥˜ ……‰Í½É‰•ñð…‰Í½É‰•ðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€ ‰‰…ÑÑ±•A±…å•É…Éˆ¬(€€€€€€€€€€€€¡¡…É…Ñ•É%¹‘•áñðÀ¤(€€€€€€€€¤ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€•±•µ•¹Ð°(€€€€€€€€ˆ´ˆ­…‰Í½É‰•°(€€€€€€€€‰Í¡¥•±ˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½Ý5½¹ÍÑ•É!¥Ð¡¥¹‘•à±…µ½Õ¹Ð±ÑåÁ”±¥ÍÉ¥Ð¥ì(€€€½¹ÍÐ•±•µ•¹Ðô ‰‰…ÑÑ±•5½¹ÍÑ•Èˆ­¥¹‘•à¤ì(€€€¥˜ …•±•µ•¹Ñññ…µ½Õ¹ÐôôõÕ¹‘•™¥¹•‘ññ…µ½Õ¹Ðôôõ¹Õ±°¥ìÉ•ÑÕÉ¸ìô((€€€½¹ÍÐ‰½ÍÍ=Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€½¹ÍÐÍ•ÑÑ±•µ•¹ÐõÑåÁ”ôôô‰¡Àˆ˜™‰½ÍÍ=Ý¹•È˜™ÑåÁ•½˜‰½ÍÍ=Ý¹•È¹½¹ÍÕµ•…µ…•M•ÑÑ±•µ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€ý‰½ÍÍ=Ý¹•È¹½¹ÍÕµ•…µ…•M•ÑÑ±•µ•¹Ð¡¥¹‘•à¤é¹Õ±°ì((€€€¥˜¡Í•ÑÑ±•µ•¹Ð¥ì(€€€€€€€¥˜¡Í•ÑÑ±•µ•¹Ð¹Í¡¥•±‘‰Í½É‰•øÀ¥ì(€€€€€€€€€€€Í¡½Ý…µ…•A½ÁÕÀ¡•±•µ•¹Ð°ˆ´ˆ­Í•ÑÑ±•µ•¹Ð¹Í¡¥•±‘‰Í½É‰•°‰Í¡¥•±ˆ±™…±Í”¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í•ÑÑ±•µ•¹Ð¹¡Á…µ…”øÀ¥ì(€€€€€€€€€€€Í¡½Ý…µ…•A½ÁÕÀ¡•±•µ•¹Ð°ˆ´ˆ­Í•ÑÑ±•µ•¹Ð¹¡Á…µ…”¬‰!@ˆ°‰¡Àˆ±¥ÍÉ¥Ð¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÁÉ•™¥àõÑåÁ”ôôô‰¡•…°ˆüˆ¬ˆèˆ´ˆì(€€€Í¡½Ý…µ…•A½ÁÕÀ (€€€€€€€•±•µ•¹Ð°(€€€€€€€ÁÉ•™¥à­…µ½Õ¹Ð¬¡ÑåÁ”ôôô‰ÍÀˆü‰M@ˆè‰!@ˆ¤°(€€€€€€€ÑåÁ”°(€€€€€€€¥ÍÉ¥Ð(€€€€¤ì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš«ž&§¦7žR|(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•ÍÁ…Ý¹5½¹ÍÑ•ÉÌ ¥ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡’â7–"¦vKžÒžjžf÷¾ò0(€€€€€€ƒš¾?š²‡¦÷š*+–£¦ Û¦jïš«ž&§¦7žö»’ö7žö»¾ò/–n{šîÿ¢†¾ò0(€€€€€€ƒž>û–r£š"Ã¦²—–>«šrš6Ë–”ÅøÏ¦jï¾ò0(€€€€€€ƒ–Û¦’cšÊKš¶ïžjš«ž&§’â7š'¢¦Ë¢Š¯–.W–"À(€€€€€€ƒ¾ò#’â7žÛšÊKš¶ïžjš«ž&§’æšrš¾?š²‡š"Ã¦²—–ú3žªžÛ¢ÞÏ’ö7žö»¾ò'Ž(€€€€€€ƒšRçš"C–>«¢fWžBŽ3žržj–ÞËžÚOš¶ï’ê‡Ž7žjš«ž&§Ž(€€€€¨¼((€€€µ½¹ÍÑ•ÉÌ(€€€€¹Í±¥” (€€€€€€€€À°(€€€€€€€5a}QI%9%9}5=9MQIL(€€€€¤(€€€€¹™½É…  (€€€€€€€€¡µ½¹ÍÑ•È±¥¹‘•à¤ôùì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹…±¥Ù”(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€µ½¹ÍÑ•È¹…±¥Ù”õÑÉÕ”ì((€€€€€€€€€€€µ½¹ÍÑ•È¹¡À€ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹µ…á!@ì((€€€€€€€€€€€µ½¹ÍÑ•È¹ÍÀ€ô(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹µ…áM@ì(((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#šâžBšºcžVgž¢/–ò?žŠó¾ò'¾òh(€€€€€€€€€€€€€€ƒ¦g¢Ž‡–:šr³¦
–r£¦7šZÃ¢¢#žº_š«ž&§žjà½ç–êŸš¢gŽ(€€€€€€€€€€€€€€ƒšnÓšZÃ–rÃ–r[–r[ž’ëžj’ö7žö»¾ò3’öš«ž&§–ÞËžÚL(€€€€€€€€€€€€€€ƒ’â7–7–Þ‡¦
?Ž–r[ž’ë’æšVÓ–/¦jÇ¢^?’ê¾ò0(€€€€€€€€€€€€€€ƒ¦gšº×–º3–£žR£’â7–"Ã’ê¾ò3š.ÿš:'Ž(€€€€€€€€€€€€€€ƒšZÃ–6–~¾ò#–Ã¦rs–ÆÇ¢#’æ/–ú3¾ò'žjš«ž&§¢ÎšZd(€€€€€€€€€€€€€€ƒšr³’ú–ÂÇšÊKšr%à½ç¦g–§–/š²’ö7¾ò0(€€€€€€€€€€€€€€ƒžVg¢F_¦gšº×–Â7–º–G’ú¢ª«–>«šržº_–è(€€€€€€€€€€€€€€ƒšÊKšr'š?žú§žj9…;¾ò3šâš:'š¾S¢ò’æûšÞ£Ž(€€€€€€€€€€€€¨¼((€€€€€€€ô(€€€€¤ì()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¦gš²‡žržjžÖÇ’âš:'’ê¾ò'¾òh(€€ƒ¦g¢Ž‡’æ/–&7–ÞËžÚO¢Š¯šRçš"CŽ3¦Ë–—–rÃ–r[–ÂÇ¢«–.Wš¾<ÓžžH(€€ƒ¢žãžfó’âš²‡š"Ã¦²—Ž7¾ò3’ö’öÿžR£¢¦gš²‡šb;žŠë¢ššÆ¾òh(€€ƒ¦Ë–—–rÃ–r[–ú3–þ¦‚#–#š2'Ž3¢«–.W–Þ‡š«Ž7š2'¦"W¾ò0(€€ƒš&7šr¦Z/–ž/š¾<ÓžžK¢«–.Wš"Ã¦²—ŠSŠS¦gš¶šb¿–ú3’ú(€€ƒ–r¡Ñ½±•ÕÑ½A…ÑÉ½° ¤½ÉÕ¹ÕÑ½A…ÑÉ½±¡•¬ ¤(€€ƒ¾ò#–rÃ–r[¦‚¦v‹¢«–.Wš"Ã¦²—¦v‹švÿš^¦
+¦
¦†šZÃš2'¦"W¾ò$(€€ƒ–kžj’ê/¾ò3–§––_¦
?¢ò¿–kžjšb¿–B3’â’îÛ’ê/¾ò3–6ï–B¢¨(€€ƒž6£ž®/¦/’ösŽ’êK’â7ž~—¦O–Â7šZç–¶c–r£¾ò3š&7šr–ëž>ø(€€ƒŽ3¢«–.W–Þ‡š«¦÷¦
šÊKš2'¾ò3–ÂÇ¢«–ÞÇš&O¢Öß’úŽ4(€€ƒ¦gž¢»¢†3ž
ëŠSŠS–nƒž
ëžrš¶–r£¢3šf¿¦/’ösžj–Û–¾›šb¼(€€ƒ¦g¢Ž‡¦g––_Ž3¦Ë–rÃ–r[–ÂÇ¢«–.W¦Z/–ž/Ž7žj¢"+¦
?¢ò¿¾ò0(€€ƒ¢Þ’öÿžR£¢š2'žj¦
¦†š2'¦"W–º3–£ž‡¦^sŽ((€€ƒ–÷–ò?–B7ž¢ÇŽ–Fó–>¯žj–rÃšZç¾ò!•¹Ñ•Éi½¹” §Ž(€€Ý¥¹	…ÑÑ±” §’æ/–ú3Ž¦¢¯š"C–*’æ/–ú3Š›¾ò'¦÷žÚ·š2(€€ƒ’â7–.W¾ò3’ö–÷–ò?šr³¦®SšRçš"Cž¦ëžjŠSŠSž>û–r (€€ƒŽ3¢š’â7¢šš¾<ÓžžK¢«–.Wš"Ã¦²—Ž7–R¿’âžj¦Z/¦^sšb¼(€€Ñ½±•ÕÑ½A…ÑÉ½° §¦
¦†š2'¦"W¾ò3’â7šr–7šr$(€€ƒ¦Ë–rÃ–r[–ÂÇ¢«–.W¢žãžfóžj¢†3ž
ëŽ(¨¼()™Õ¹Ñ¥½¸ÍÑ…ÉÑ5½¹ÍÑ•É5½Ù•µ•¹Ð ¥ì((€€€€¼¨(€€€€€€ƒšVš?žVgž¦ë¾òk¢«–.W–Þ‡š«žj¦Z/¦^s–>«’ê“žÖ˜(€€€€€€Ñ½±•ÕÑ½A…ÑÉ½° §¢fWžB¾ò3¦g¢Ž‡’â7–4(€€€€€€ƒ¢«–.W–V–.W’îï’öW¢¢#šf–f£Ž(€€€€¨¼()ô(()™Õ¹Ñ¥½¸ÍÑ½Á5½¹ÍÑ•É5½Ù•µ•¹Ð ¥ì((€€€€¼¨(€€€€€€ƒšVš?žVgž¦ë¾ò3–:–nƒ–B3’â+ŠSŠSžrš¶žj–sš¶‹¦
?¢ò¼(€€€€€€ƒ–r¡ÍÑ½ÁÕÑ½A…ÑÉ½° §¾ò3–Fó–>¯¦g¢Ž‡’â7šr(€€€€€€ƒšr'’îï’öW’ösžR£¾ò3žÒSžÊçšb¿ž
ë’ê¢ºO¢"+žj–Fó–>¯¦îx(€€€€€€ƒ¾ò!±•…Ù•5…À §ŽÍÑ…ÉÑ	…ÑÑ±” §Š›¾ò$(€€€€€€ƒ’â7žR£’â–/’â–/šRçš:'Ž’â7šr–fÓ¦2¿Ž(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–6žÒh(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸¡•­1•Ù•±UÀ¡Ñ…É•Ñ¡…É…Ñ•È¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦gšVÓ–/–÷–ò?–¾¯š¶ï–>«¢ª5Á±…å•Ë¾ò0(€€€€€€ƒž²³’ê3¢žK¢&ËšÊK¢ú›šÎW¦?¦;¦g¢Ž‡–6žÒkŽ(€€€€€€ƒšRçš"C–>¿’î—–
Ï–—¢š–6žÒkžj¢žK¢&Ëž&§’îÛ¾ò0(€€€€€€ƒ’â7–
Ïžj¢¦Ç¦‚C¢¢·¦
šb½Á±…å•È(€€€€€€ƒ¾ò#’þwžVg¢"+žj–Fó–>¯šZç–ò?žnã–ºç¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€Ñ…É•Ñ¡…É…Ñ•Éñð(€€€€€€€Á±…å•Èì(((€€€±•Ð±•Ù•±ÌôÀì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¦bË–F¾òh(€€€€€€ƒš¶–âãššÎ’â/¦g–-Ý¡¥±—šr–’k¢ÞDÇš²„(€€€€€€ƒ¾ò!‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•Ëš¾?š²‡¦÷–>«žÖ˜(€€€€€€ƒ–&o––ôÇžÒkžj¦?¾ò'¾ò0(€€€€€€ƒ’ö¦
šb¿–*ƒ’â–/’þw¦j«’â+¦fC¾ò0(€€€€€€ƒ¦ÿ–7’îï’öWš"GšÊK¦‚CšZg–"Ãžj¢ÎšZgžVÃ–âà(€€€€€€ƒ¾ò#’ú/–š¢"+–¶cšªSžj•áÁ9•áÓ–Ž{š:'¾ò$(€€€€€€ƒ–Â;¢Ó¦g¢Ž‡¢ÞG–ë¦n‹¢¶sžj¢þÓ–r#š²‡šVã¾ò0(€€€€€€ƒ’âš²‡ž"–Š{–æûžfûžÒkŽž3–ë–’§šZšVã–¶_žjš*¢÷¦î{Ž(€€€€€€€ÈÀÃžÒk–Â7žn»–&7¦+š"Ë¦Ë–ê›’ú¢ª«–ÞËžÚO¦v{–âã–’k¾ò0(€€€€€€ƒš¶–âãž:§šÎW’â7–>¿¢÷’âš²‡¢žãžfó–"Ã¦g–/’â+¦fCŽ(€€€€¨¼((€€€Ý¡¥±” (€€€€€€€¡…É…Ñ•È¹•áÀøô(€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ€˜˜(€€€€€€€±•Ù•±ÌðÈÀÀ(€€€€¥ì((€€€€€€€¡…É…Ñ•È¹•áÀ€´ô(€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐì(((€€€€€€€¡…É…Ñ•È¹±•Ù•°¬¬ì(((€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ¬Ä°(€€€€€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ¨Ä¸È(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(((€€€€€€€¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ€¬ô€Ôì((€€€€€€€¡…É…Ñ•È¹Í­¥±±A½¥¹ÑÌ€¬ô€Èì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ¢š?š‚ó¢ššÆ¾òh(€€€€€€€€€€ƒ–6žÒk–në–ºh€¬ÌÀƒšr–’!CŽ¬ÄÀƒšr–’MC¾ò0(€€€€€€€€€€ƒ¢Þ¦®S¢Î¨¿¢÷¦?¦7¦î{–*ƒš"C–"¦Z/žÒ¿–*ƒŽ(€€€€€€€€¨¼((€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍ!@€¬ô€ÌÀì((€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍM@€¬ô€ÄÀì(((€€€€€€€±•Ù•±Ì¬¬ì((€€€ô(((€€€¥˜¡±•Ù•±ÌøÀ¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh€€€€€€€€€€ƒ¦g¢Ž‡¢Þ’æ/–&7š"Ã¦²—–.w–"§¢Žs¢†šb¿–B3’âž¢»–V?¦†3ŠSŠP(€€€€€€€€€€ƒ–6žÒkžVÛ’â/žnÓš:—š*)!@½MC–òß–"Û¢Žsšîÿ¾ò0(€€€€€€€€€€ƒ¢Þ’öƒ¢¢·–ºkžjŽ1!C’ö;šZñ`”½MC’ö;šZñ`—Ž4(€€€€€€€€€€ƒ¢«–.W¢Žs¢^—šÂÓ¦Zšªï–º3–£ž‡¦^s¾ò0(€€€€€€€€€€ƒ¦nš«’öƒšr¢šë–ú_Ž3šb;šb;¦
šÊK–"Ã¦Zšªï¾ò0€€€€€€€€€€ƒ–º¢«–ÞÇ–ÂÇ¢Žs’êŽ7Ž((€€€€€€€€€€ƒš.ÿš:'–òß–"Û¢Žsšîÿ¾ò3–>«¦7šZÃ¢¢#žº_’âš²„(€€€€€€€€€€ÕÉÉ•¹Ð¡À½ÍÃžj’â+¦fC–’û’ö?¾ò#¦ÿ–7¢Ú¦;šZÃžjµ…á!@½µ…áMC¾ò'¾ò0(€€€€€€€€€€ƒ’â7šr–æÏžf÷ž‡šV¢º+š"C–£šîÿŽ((€€€€€€€€€€Á±…å•ÈËšÊKšr%•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ §–>¿’î—žR (€€€€€€€€€€ƒ¾ò#¦
–/–÷–ò?–¾¯š¶ïžº]Á±…å•Ëžj¾ò'¾ò0(€€€€€€€€€€ƒšRçžR£¢Þ}•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉMÑ…ÑÌ ¤(€€€€€€€€€€Á±…å•ÈË–"šR¿–B3’â––_–³–ò?ž>ûžº_’âš²‡Ž(€€€€€€€€¨¼((€€€€€€€±•Ðµ…á!@ì((€€€€€€€±•Ðµ…áM@ì(((€€€€€€€¥˜¡¡…É…Ñ•ÈôôõÁ±…å•È¥ì((€€€€€€€€€€€½¹ÍÐÍÑ…ÑÌ€ô(€€€€€€€€€€€€€€€•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì(((€€€€€€€€€€€µ…á!@ô(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…á!@ì((€€€€€€€€€€€µ…áM@ô(€€€€€€€€€€€€€€€ÍÑ…ÑÌ¹µ…áM@ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€½¹ÍÐ¡…É…Ñ•É%¹‘•àô(€€€€€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É%¹‘•à (€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€½¹ÍÐ‰½¹ÕÌÈ€ô(€€€€€€€€€€€€€€€•ÑÅÕ¥Áµ•¹Ñ	½¹ÕÌ (€€€€€€€€€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä (€€€€€€€€€€€€€€€€€€€€€€€¡…É…Ñ•É%¹‘•à(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€µ…á!@ô(€€€€€€€€€€€€€€€€ÄÀÀ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä¨ÔÀ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍ!@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹µ…á!@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹Ù¥Ñ…±¥Ñä¨ÔÀì(((€€€€€€€€€€€µ…áM@ô(€€€€€€€€€€€€€€€€ÔÀ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹•¹•Éä¨ÄÔ¬(€€€€€€€€€€€€€€€¡…É…Ñ•È¹‰½¹ÕÍM@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹µ…áM@¬(€€€€€€€€€€€€€€€‰½¹ÕÌÈ¹•¹•Éä¨ÄÔì((€€€€€€€ô(((€€€€€€€¡…É…Ñ•È¹¡À€ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€¡…É…Ñ•È¹¡À°(€€€€€€€€€€€€€€€µ…á!@(€€€€€€€€€€€€¤ì(((€€€€€€€¡…É…Ñ•È¹ÍÀ€ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€¡…É…Ñ•È¹ÍÀ°(€€€€€€€€€€€€€€€µ…áM@(€€€€€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3žÚO¦¦_–ð(€€€€€€€€€€ƒ–"¦7–6žÒkžjšf–g¾ò3žnÓš:—¦î{¦ã–ÂÇ––÷¾ò0(€€€€€€€€€€ƒ’â7¢š–7¢ÞÏ–ë¢š[žª_¦†¿ž’ë–F+ž~—Ž7¾ò3–ú3žê0(€€€€€€€€€€ƒ–>#¢Žs–Ž3–â3šro–6žÒkžjšf–g–>¿’î—¢ÞÏ–è(€€€€€€€€€€ƒ’â–/¢¢+š¿š†¾ò3¦†¿ž’éaac–6–"ÁacžÒkŽ7¾ò'¾òh(€€€€€€€€€€¡•­1•Ù•±UÀ §žn»–&7–>«šr'’â–/–Fó–>¬(€€€€€€€€€€ƒ’úšêCŠSŠQ‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È ¤(€€€€€€€€€€ƒ¾ò#žÚO¦¦_šÆƒ–"¦7¦‚¦v‹š2'Ž3–"¦7žÚO¦¦_–óžÖ˜(€€€€€€€€€€cŽ7¦
–/š2'¦"W¾ò'¾ò3š&’î—¦g¢Ž‡žj’þ»šRä(€€€€€€€€€€ƒ–>«–öÇ¦~ÿ¦g–/šÖž¢/¾ò3’â7šr¢ª“–
ß–Û’îX(€€€€€€€€€€ƒš–ŠŽ((€€€€€€€€€€ƒ–:šr³–6žÒkžVÛ’â/šr–òß–"Û¢ÞÏ–ë’â–/¢š(€€€€€€€€€€ƒš&/–.Wš2'Ž3žŠë–ºkŽ7š&7¢÷¦^sš:'žj(€€€€€€€€€€±•Ù•±5½‘…³–ö#žª_¾ò3ž:§–ºÛ¢«–ÞÇ’âï–.T(€€€€€€€€€€ƒ¦î{–"¦7Žšr–úžj–ÂÇšb¿Ž3¦î{’â/–:ï¦š³’â((€€€€€€€€€€ƒžRšV#Ž7¾ò3’â7¦r¢š¦†7–’[–7¢ÞÏ’â–Æ(€€€€€€€€€€ƒžŠë¢ª4¿–F+ž~—¢š[žª_š&7¢÷žæóžê3šN7’ösŠSŠP(€€€€€€€€€€ƒ¦g¦£–"žÚ·š2š.ÿš:'Ž((€€€€€€€€€€ƒ’öž:§–ºÛ–ú3’úšb;žŠë¢†£ž’ë¦
šb¿šÏ¢šŽ3šr$(€€€€€€€€€€ƒ–F+ž~—Ž7¾ò3–>«šb¿’â7¢š¦
ž¢»¢šš2'žŠë–ºkžj(€€€€€€€€€€ƒ–ö‹–ò?¾ò3šRçš"C¢Þž6Ë–ú]aC–B3’âž¢»¢òW¦<(€€€€€€€€€€Ñ½…ÍÓ¦kž~—¾ò#¢š-Í¡½Ý1•Ù•±UÁQ½…ÍÐ §¾ò'¾ò0(€€€€€€€€€€ƒ’â7šN/šN7’ösŽžr/¦;–ÂÇ¢«–.WšÚ#–’ÇŽ((€€€€€€€€€€±•Ù•±5½‘…³¦g–/–ö#–ë¢š[žª_šr³¢ê¯Ž(€€€€€€€€€€±½Í•1•Ù•±5½‘…° §¦÷–#’þwžVg–r (€€€€€€€€€€ƒž¢/–ò?žŠó¢Ž‡šÊK–"«¾ò3–>«šb¿’â7–7–ú{¦g¢Ž„(€€€€€€€€€€ƒ¢žãžfó¦†¿ž’ëŽ(€€€€€€€€¨¼((€€€€€€€Í¡½Ý1•Ù•±UÁQ½…ÍÐ (€€€€€€€€€€€¡…É…Ñ•ÈôôõÁ±…å•È(€€€€€€€€€€€€ü(€€€€€€€€€€€€¡Á±…å•È¹¥‘ñð‹’ö€ˆ¤(€€€€€€€€€€€€è(€€€€€€€€€€€¡…É…Ñ•È¹¥°(€€€€€€€€€€€¡…É…Ñ•È¹±•Ù•°(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š2'–6žÒkžj(€€€€€€ƒšf–g¾ò3’â+¦v‹¦‚·–?š†žjž¶'žÒkšÊKšr'¢Þ¢F\(€€€€€€ƒ–Š{–*ƒŽ7¾ò'¾òh(€€€€€€ƒ’â7žº‡šr'šÊKšr'žržj–6žÒk¾ò!±•Ù•±ÌøÃ¾ò'¾ò0(€€€€€€ƒ¦÷–Fó–>¯’âš²‡¾ò3¦‚’úÿ–B3š¶—––÷žn»–&7žjž¶'žÒh(€€€€€€ƒšVã–¶_¾ò3š"Cšr³–ú#’ö;¾ò#š&û’â7–"Ã–žÒƒ–ÂÇžnÓš:”(€€€€€€É•ÑÕÉ»¾ò'¾ò3šÊKšr'–&¿’ösžR£Ž(€€€€¨¼((€€€É•™É•Í¡¡…É…Ñ•ÉÙ…Ñ…É1•Ù•±Ì ¤ì(((€€€Í…Ù•…µ” ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•1•Ù•±5½‘…° ¥ì((€€€€ ‰±•Ù•±5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒžÚO¦¦_šÆƒ–"¦4(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô((€€ƒ¢š?š‚ó’êSŽ–·¾òh(€€aC–#¦Ë–—–ÇžR£žÚO¦¦_šÆƒ¾ò0(€€ƒ’â7šrš"Ã¦²—’âžÖCšv–ÂÇ¢«–.W–6žÒkŽ(€€ƒž:§–ºÛ–n{–"Ã’âï–~;–ú3¾ò3¢«¢†3š2'Ž3–"¦7žÚO¦¦_–óŽ4(€€ƒš*+žÚO¦¦_šÆƒžjaC–"žÖ›¢žK¢&Ë¾ò0(€€ƒš&7šržrš¶¢žãžfó–6žÒk–"“–ºkŽ((€€ƒžn»–&7¦+š"Ë¢Ž‡–R¿’âšNšr'–º3šVÓž¶'žÒh¿–Æ³šŸžÎïžÖÇžj(€€ƒ¢žK¢&Ëšb¿’âï¢žK¾ò!Á±…å•Ë¾ò3’æ–ÂÇšb¿–&×¢žKšf¦ãžj–žÒƒ¾ò'Ž(€€ƒšÂÓš"Ã–Ž¯¾ò?¦Š£–òOš&/žn»–&7–>«šr'¢Žw–
gš²¾ò0(€€ƒ–Âkšr«šr'ž6£ž®/ž¶'žÒkžÎïžÖÄ(€€ƒ¾ò#¢š?š‚ó’ê3šr'¢¢ïšb;Ž3–’k¢žK¢&Ë–B3šfš"Ã¦²—Ž7šb¿šr«’ú–*¢÷¾ò'¾ò0(€€ƒš&’î—–"¦7š2'¦"W–#–>«¦Z/šRûžÖ›’âï¢žK¾ò0(€€ƒ–Û¦’c¢žK¢&Ë¦†¿ž’ëŽ3–Âkšr«¦Z/šRûŽ7Ž((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð•áÁQ½…ÍÑQ¥µ•Èõ¹Õ±°ì(()™Õ¹Ñ¥½¸Í¡½ÝáÁQ½…ÍÐ¡…µ½Õ¹Ð¥ì((€€€½¹ÍÐÑ½…ÍÐ€ô(€€€€€€€€ ‰•áÁQ½…ÍÐˆ¤ì(((€€€¥˜ …Ñ½…ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Ñ½…ÍÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€‹ž6Ë–ú\ˆ¬(€€€€€€€…µ½Õ¹Ð¬(€€€€€€€€‰aC¾ò#–ÞË–¶c–—žÚO¦¦_šÆƒ¾ò$ˆì(((€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€•áÁQ½…ÍÑQ¥µ•È(€€€€¤ì(((€€€•áÁQ½…ÍÑQ¥µ•È€ô(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÈØÀÀ¤ì()ô(()±•Ð±•Ù•±UÁQ½…ÍÑQ¥µ•Èõ¹Õ±°ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–6žÒkžjšf–d(€€ƒ–>¿’î—¢ÞÏ–ë’â–/¢¢+š¿š†¾ò3¦†¿ž’éaac–6–"ÁacžÒkŽ7¾ò'¾òh(€€ƒ¢Þ}Í¡½ÝáÁQ½…ÍÐ §–B3’â––_–¾¯šÎW¾ò3¦v{¦bïšZßŽ(€€ƒ¢«–.WšÚ#–’Ç¾ò3’â7¦r¢šž:§–ºÛš2'žŠë–ºkŽ(¨¼()™Õ¹Ñ¥½¸Í¡½Ý1•Ù•±UÁQ½…ÍÐ¡¡…É…Ñ•É9…µ”±±•Ù•°¥ì((€€€½¹ÍÐÑ½…ÍÐô(€€€€€€€€ ‰±•Ù•±UÁQ½…ÍÐˆ¤ì(((€€€¥˜ …Ñ½…ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Ñ½…ÍÐ¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€¡…É…Ñ•É9…µ”¬(€€€€€€€€‹–6–"Àˆ¬(€€€€€€€±•Ù•°¬(€€€€€€€€‹žÒk¾òˆì(((€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€±•Ù•±UÁQ½…ÍÑQ¥µ•È(€€€€¤ì(((€€€±•Ù•±UÁQ½…ÍÑQ¥µ•Èô(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€Ñ½…ÍÐ¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÈØÀÀ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š2'–6žÒkžj(€€ƒšf–g¾ò3’â+¦v‹¦‚·–?š†žjž¶'žÒkšÊKšr'¢Þ¢F_–Š{–*ƒŽ7¾ò'¾òh(€€ƒ–>«šnÓšZÃ¢žK¢&Ë–ö#žª_¦‚·–?¦
–§–/ž¶'žÒkšZ–¶_¾ò0(€€ƒ’â7¦7žV¯šVÓ–/–ö#žª_–Ÿ–ºç¾ò#¦7žV¯šVÓ–/–ö#žª\(€€¥¹¹•É!Q53šrš*+ž:§–ºÛš¶–r£žr/žj–"¦‚ŠSŠP(€€ƒ’ú/–šžÚO¦¦_šÆƒ–"¦7šr³¢ê¯ŠSŠS’â¢ÖßšÒ_š:'¾ò0(€€ƒ’æ/–&7¢fWžBŽ3¢«–.Wš"Ã¦²—¢¢·–ºk¢ÞÏ–ëž¦ëžfô(€€ƒš*¢÷¦‚Ž7–ÂÇšb¿–B3’âž¢¹‰ÕŸ¾ò3¦g¢Ž‡šRçžR (€€ƒ¦w–Â7šŸšnÓšZÃ¾ò3–º'–£–ú#–’k¾ò'Ž((€€ƒ¢žK¢&Ë–ö#žª_šÊK¦Z/¢F_žjšf–g¾ò0 §šrš&û’â7–"À(€€ƒ–Â7š%¥“ŽžnÓš:•É•ÑÕÉ»¾ò3–Fó–>¯¦g–/–÷–ò<(€€ƒ’â7šr–ë¦2¿¾ò3–>¿’î—šRû–þ–r¡¡•­1•Ù•±UÀ ¤(€€ƒ¢Ž‡ž‡šŠw’îÛ–Fó–>¯Ž(¨¼()™Õ¹Ñ¥½¸É•™É•Í¡¡…É…Ñ•ÉÙ…Ñ…É1•Ù•±Ì ¥ì(€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ±•Ù•±°ô ‰¡…É…Ñ•ÉÙ…Ñ…É1•Ù•°ˆ­¥¹‘•à¤ì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€¥˜¡±•Ù•±°€˜˜¡…É…Ñ•È¥ì(€€€€€€€€€€€±•Ù•±°¹Ñ•áÑ½¹Ñ•¹Ðô‰1Ø¸ˆ­¡…É…Ñ•È¹±•Ù•°ì(€€€€€€€ô(€€€ô¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ’âï–~;’òGš¿¾ò#–7¢Êï–n{šîý!@½MC¾ò$((€€ƒ’æ/–&7š*+Ž3š"Ã¦²—–.w–"¤¿–6žÒk¢«–.W¢Žsšîý!CŽMCŽ7š.ÿš:'’æ/–ú3¾ò0(€€ƒ¢^—šÂÓžR£–º3–ÂÇšÊKšr'–Û’î[–n{¢†š&/šº×’ê¾ò0(€€ƒ¦+š"Ë¢Ž‡žn»–&7’æ¦
šÊKšr'žrš¶žj–V–ê\¿¦G–æžÎïžÖÄ(€€ƒ–>¿’î—¢ÊßšZÃ¢^—šÂÓ¾ò#Ž3¦G–æŽ7žn»–&7–>«šb¿¢3–2–R»–ëšfžj¦†¿ž’ëšZ–¶_¾ò0(€€ƒšÊKšr'žržj¢Š¯¢¢c¦2Ž’æšÊK–rÃšZç¢*Ç¾ò'Ž((€€ƒ–#žR£šr–Z»žÒSžjšZç–ò?¢Žs’â+¦g–/žòë–>¾òh(€€ƒ–n{’âï–~;–>¿’î—–7¢Êï’òGš¿¾ò3žnÓš:—–n{šîý!@½MC¾ò0(€€ƒ’â7¦r¢š¢^—šÂÓŽ’â7¦r¢š¦G–æŽ(€€ƒ’æ/–ú3–ššzs¢š–kžrš¶žj–V–ê_žÎïžÖÇ¾ò0(€€ƒ¦g–/–÷–ò?–>¿’î—–7šNÓ–š"[šnÿš>oš:'Ž(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ’âï–~;žÒSšZ–¶_¦ã–Z»ŠSŠS–ÇžR£–ö#–ë¢š[žª\(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ðô(€€€¹Õ±°ì()±•Ð¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ðô(€€€¹Õ±°ì()±•Ð¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œô(€€€¹Õ±°ì((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢žK¢&Ë¢š[žª_¦jÇ¢^<(€€ƒ–¦Ë’ú¦‚¦v‹¢Ž‡–’k¦’cžjžº·¦‚·–"š>o–6–†+¾ò'¾òh(€€ƒ¢¢c’ö?¦gš²‡–¦‚¦v‹¦Ë’úšf¾ò3¦‚š&/¦jÇ¢^?’ê–N«’â–,(€€ƒŽ3Š^¢žK¢&Ë–B7ŠZÛŽ7žj–6–†+¾ò1É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¤(€€ƒš¶ã’ö7šf¢š¢Êƒ¢Ê³š*+–ºžj¦†¿ž’ëž.š/š‹–ú§–n{’ú¾ò0(€€ƒ’â7žÛ–"¢ÖÃ’æ/–ú3¾ò3¦
–/¦‚¦v‹–Z»ž6£¢Š¯’öÿžR£šf(€€ƒ¾ò#’ú/–š’æ/–ú3–>¿¢÷¦
šr'–Û’î[–žR£–‚Óšf¿¾ò'šr(€€ƒ’âžnÓžÚ·š2¦jÇ¢^?Žš&û’â7–n{’úŽ(¨¼()±•Ð¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…Éô(€€€¹Õ±°ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3’âï–~;ž®/žæ«¦j£š¦|(€€ƒ–"š>o¾ò'¾òk–§–ò×–rY‰…Í”ØÓ–Ÿ–Ö3¾ò3š¾?š²‡¦Ë–—’âï–~8(€€ƒ¦‚¦v‹šf¾ò!Í¡½ÝA…” §¢Ž‡–Fó–>¯¾ò3¢š/’â/¦vˆ(€€Í¡½Ý!½µ•A½ÉÑÉ…¥Ð §žj–Fó–>¯¦î{¾ò'¦j£š¦š2G’â–òÔ(€€ƒ¦†¿ž’ë¾ò3’â7šb¿š"Ã¦²—žR£žj¢žK¢&Ë–6‡ž&–r[¾ò3šb¿¦†7–’X(€€ƒšê[–
gžjž®/žæ«Ž(¨¼((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XàäƒŠPƒ’îï–.g’î/¦v‹–Â#žR£š&/–.‹š¢‡–ò<(€€ƒ’îï–.g’öÿžR €ÅÕ•ÍÑQ…‰	½‘äƒ’ösž
ë–R¿’â–Ÿ–ÆÍÉ½±°½Ý¹•ËŽ(€€ƒ¦+š"Ëšr–’[–Æ“–:šr°Ñ½Õ µ…Ñ¥½¸é¹½¹—¾ò3–nƒš¶“–>«–r£’îï–.g¢š[žª\(€€ƒ¦Z/–Všr¦ZOšRû¢†0Á…¸µç¾òo’â7šZÃ–ŠxÑ½Õ ½Á½¥¹Ñ•È±¥ÍÑ•¹•ËŽ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)™Õ¹Ñ¥½¸Í•ÑEÕ•ÍÑQ½Õ¡5½‘”¡…Ñ¥Ù”¥ì((€€€l(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤(€€€t¹™½É… ¡™Õ¹Ñ¥½¸¡•±•µ•¹Ð¥ì((€€€€€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰ÅÕ•ÍÐµÍÉ½±°µ…Ñ¥Ù”ˆ°(€€€€€€€€€€€€„……Ñ¥Ù”(€€€€€€€€¤ì((€€€ô¤ì()ô(()™Õ¹Ñ¥½¸½Á•¹!½µ••…ÑÕÉ”¡ÑåÁ”¥ì((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì((€€€½¹ÍÐÑ¥Ñ±•°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(((€€€¥˜ (€€€€€€€€…µ½‘…°ñð(€€€€€€€€…Ñ¥Ñ±•°ñð(€€€€€€€€…‰½‘å°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±½Í•!½µ••…ÑÕÉ” ¤ì(((€€€¥˜¡ÑåÁ”ôôô‰É•ÍÐˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹’âï–~;’òGš¼ˆì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3–Þ‡š¨(€€€€€€€€€€ƒ¦‚¦v‹š2'¢«–.Wš"Ã¦²—¢ÞÏ–ëž¦ëžf÷š*¢÷¦‚¦v‹Ž7¾ò0(€€€€€€€€€€ƒ¢þ÷š~—–ú3žfóž>û–B3’â–-‰ÕŸ–Û–¾›–öÇ¦~ÿ’â'–,(€€€€€€€€€€ƒ–rÃšZç¾ò3¦g¢Ž‡¦‚’úÿ’â¢Öß’þ»š:'¾ò'¾òh(€€€€€€€€€€ƒ¦g–/–"šR¿–>«–Fó–>­‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° ¤(€€€€€€€€€€ƒš*)¡½µ•I•ÍÑ…É“–¦Ë’ú¾ò3–ú{’úšÊKšr$(€€€€€€€€€€ƒšâž¦ë¦9‰½‘å³šr³¢ê¯žj¥¹¹•É!Q53Ž(€€€€€€€€€€ƒ–ššzsŽ3’â+’âš²‡Ž7¦Z/žjšb¿žR¡¥¹¹•É!Q50ô(€€€€€€€€€€ƒšVÓšº×¢N/š:'žj¦†{–z/¾ò#’ú/–šŽ3¢žK¢&ËŽ7ŠSŠP(€€€€€€€€€€ƒ¢Ž‡¦v‹šr'¦‚·–?–"š>o–"_Ž–"¦‚š2'¦"WŽ(€€€€€€€€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò'¾ò3¦
’êošºcžVd(€€€€€€€€€€!Q53šr’âžnÓžVg–r¡‰½‘å³¢Ž‡¾ò3¦gš²‡–’ú(€€€€€€€€€€ƒžj–Ÿ–ºç–>«šb¿Ž3–*ƒŽ7–r£–ú3¦v‹¾ò3’â7šb¼(€€€€€€€€€€ƒŽ3–>[’îŽ7¾ò3ž:§–ºÛšržr/–"Ã’â+’âš²‡žj¢"((€€€€€€€€€€ƒžV¯¦v‹–6‡–r£šr’â+¦v‹ŽšZÃ–Ÿ–ºç¢Š¯š:£–"À(€€€€€€€€€€ƒ’â/¦v‹žr/’â7–"Ã¾ò#¢ššîû–.W–ú#–’kš&7žr/–ú_–"Ã¾ò0(€€€€€€€€€€ƒžRk¢Ïžr/¢Öß’ú–?šVÓ–/ž¦ëžf÷¾ò3–nƒž
ë¢žK¢&È(€€€€€€€€€€ƒ¦‚¦
–-¡…É…Ñ•ÉQ…‰½¹Ñ•¹Óšr³¢ê¬(€€€€€€€€€€ƒ–nƒž
ëŽ3–"¦‚¦®c–ê›¢š’â¢ÓŽ7žj¦ršÆ¾ò0(€€€€€€€€€€ƒ’þwžVg’ê’â–/–në–ºkžjµ¥¸µ¡•¥¡Ó¾ò0(€€€€€€€€€€ƒž¦ë¢F_žjšf–gžr/¢Öß’ú–ÂÇšb¿’â–’Ÿ–†((€€€€€€€€€€ƒž¦ëžf÷š†š†¾ò'Ž((€€€€€€€€€€ƒ’þ»šÎW¾òk¢Þ–Û’î[žR¡¥¹¹•É!Q50÷šVÓšº×¢N/š:$(€€€€€€€€€€ƒžj–"šR¿’âš¢¾ò3–#šâž¦é‰½‘å³¾ò3’þw¢¶$(€€€€€€€€€€ƒš¾?š²‡¦Z/¢š[žª_¦÷šb¿’æûšÞ£žj¢Öß¦î{¾ò3’â7žº„(€€€€€€€€€€ƒ’â+’âš²‡¦Z/žjšb¿’î¦êó¦†{–z/Ž(€€€€€€€€¨¼((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì((€€€€€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€€€€€€ ‰¡½µ•I•ÍÑ…Éˆ¤°(€€€€€€€€€€€‰½‘å°(€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰•áÁA½½°ˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹žÚO¦¦_šÆƒ–"¦4ˆì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òk¢Þ’â+¦v‹Ž3’âï–~;’òGš¿Ž7–B3’â–,(€€€€€€€€€€‰ÕŸŽ–B3’â–/’þ»šÎW¾ò3–#šâž¦é‰½‘å³Ž(€€€€€€€€¨¼((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì((€€€€€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€€€€€€ ‰¡½µ•áÁA½½±…Éˆ¤°(€€€€€€€€€€€‰½‘å°(€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰Í¡½Àˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹–V–ê\ˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉM¡½Á½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰¡…É…Ñ•Èˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹¢žK¢&Èˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¢žK¢&Ë¦‚¦v‹–Ÿ–ºçš¾S¢ò–’h(€€€€€€€€€€ƒ¾ò#–¦Ë’úžjšVÓ¦‚–Ÿ–ºç¾ò'¾ò3––_žR£–*ƒ–¾°(€€€€€€€€€€ƒš¢–ò?¾ò1±½Í•!½µ••…ÑÕÉ” §¦^s¦Z'šf(€€€€€€€€€€ƒšr¢«–.Wš.ÿš:'¾ò3’â7–öÇ¦~ÿ–Û’î[’â¢"³–’Ÿ–Â<(€€€€€€€€€€ƒžj¢š[žª_Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ‰½àô((€€€€€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡‰½à¥ì((€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€€€€€‰Ý¥‘”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢š[žª_¢š(€€€€€€€€€€ƒšRû–’Ÿ–"Ãš:—¢þGšîÿž&#¾ò'¾òk–Ÿ–Æ“¢š[žª_¢º+š"@(€€€€€€€€€€€ÄÀÁÙß’æ/–ú3¾ò3–’[–Æ“¦»žö§¾ò ¹¡½µ”µ™•…ÑÕÉ”´(€€€€€€€€€€µ½‘…³¾ò'šr³¢ê¯¦
šr$ÈÁÁãžjÁ…‘‘¥¹Ÿ¾ò0(€€€€€€€€€€ƒšr¢ºO–Ÿ–Æ“¢š[žª_¢Ú–ë¢z‹–æWŽžR‹žRšÂÓ–æÌ(€€€€€€€€€€ƒš6Ë–.WŽ¦g¢Ž‡¦‚’úÿš*+–’[–Æ“¦»žö§žjÁ…‘‘¥¹œ(€€€€€€€€€€ƒ’æšRÛš:'¾ò3–§–Æ“’â¢Öß¢fWžBš&7šržržj¢Êó¦ö((€€€€€€€€€€ƒ¢z‹–æW¦
+žÞŽ(€€€€€€€€¨¼((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰¹¼µÁ…‘‘¥¹œˆ(€€€€€€€€¤ì(((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¡…É…Ñ•ÉM¡½Ý…Í•½¹Ñ•¹Ð ¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òk¦‚C¢¢·’âš&O¦Z/–ÂÇ¦ãž²³’â¢žK¢&ËŽ(€€€€€€€€€€ƒ¦†¿ž’ë¢÷–*o–ó–"¦‚ŠSŠSšRç–Fó–>¬(€€€€€€€€€€Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì À§¢3’â7šb¼(€€€€€€€€€€ƒžnÓš:•ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ ‰ÍÑ…ÑÕÌˆ§¾ò0(€€€€€€€€€€ƒ¦gš¢’â'–/¦‚¦v‹žj¢žK¢&Ëž.š/–ú{’â¦Z/–ž,(€€€€€€€€€€ƒ–ÂÇšb¿–B3š¶—žj¾ò3’â7žR£ž¶'ž:§–ºÛ¢«–ÞÇ¦î{’âš²„(€€€€€€€€€€ƒ¦‚·–?š&7–Â7¦ö+Ž(€€€€€€€€¨¼((€€€€€€€Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì (€€€€€€€€€€€€À(€€€€€€€€¤ì((€€€€€€€ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ (€€€€€€€€€€€€‰ÍÑ…ÑÕÌˆ(€€€€€€€€¤ì((€€€€€€€¥˜¡Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¤ì(€€€€€€€ô((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰™½Éµ…Ñ¥½¸ˆ¥ì(€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô‹’ö#¦fŒˆì(€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹Ù¥á•‘I•¹‘•É±±å½Éµ…Ñ¥½¹½¹Ñ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€üÝ¥¹‘½Ü¹Ù¥á•‘I•¹‘•É±±å½Éµ…Ñ¥½¹½¹Ñ•¹Ð ¤(€€€€€€€€€€€€è€ˆˆì(€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰½™™±¥¹•áÀˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹¦n‹žÞkžÚO¦¦\ˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É=™™±¥¹•áÁ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰ÅÕ•ÍÐˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹’îï–.dˆì((€€€€€€€€¼¨(€€€€€€€€€€Xàç¾òk’îï–.g’â7–7šÊÿžR£–V–ê_žj’â¢"°É½Ü½‰ÕÑÑ½¸ƒž&#–z/Ž(€€€€€€€€€€ƒ–>«–r£’îï–.g¦Z/–Všr¦ZO––_žR£–Â#žR µ½‘…°ƒžÖCšž/¢"š&/–.‹š¢‡–ò?Ž(€€€€€€€€¨¼(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€‰ÅÕ•ÍÐµµ½‘”ˆ(€€€€€€€€¤ì((€€€€€€€Í•ÑEÕ•ÍÑQ½Õ¡5½‘” (€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì((€€€€€€€•¹ÍÕÉ•…¥±åEÕ•ÍÑÍÕÉÉ•¹Ð ¤ì((€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÌ¹¡•­¥¸ô(€€€€€€€€€€€€Äì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉEÕ•ÍÑQ…‰½¹Ñ•¹Ð (€€€€€€€€€€€€€€€€‰‘…¥±äˆ(€€€€€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰…¡¥•Ù•µ•¹Ðˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹š"C–ÂÄˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¡¥•Ù•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰…¹¹½Õ¹•µ•¹Ðˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹–³–F(ˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰ÍåÍÑ•´ˆ¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹žÎïžÖÄˆì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉMåÍÑ•µ½¹Ñ•¹Ð ¤ì((€€€ô(€€€•±Í”¥˜¡ÑåÁ”ôôô‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ìˆ¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢«–.T(€€€€€€€€€€ƒš"Ã¦²—šRû¦Ë’â/¦v‹–Â;¢š÷–"_¾ò3š2'’â/–:ï¢ÞÏ–è(€€€€€€€€€€ƒ¢¢·–ºk¢š[žª_Ž7¾ò'¾òh(€€€€€€€€€€ƒ–:šr°…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°(€€€€€€€€€€ƒ¦
––_šb¿¢«–ÞÇ–ršÎWž'¦.óžº]Á½Í¥Ñ¥½¸è(€€€€€€€€€€™¥á•“–êŸš¢gŽ–>›–’[šB³–"Á‘½Õµ•¹Ð¹‰½‘ä(€€€€€€€€€€ƒ–êW’â/¦†¿ž’ë¾ò3ž&÷šÚ%‰…ÑÑ±•A…—žj(€€€€€€€€€€‘¥ÍÁ±…äé¹½¹—Ž¢†3–Ÿš¢–ò?¢š¢N/ž¶$(€€€€€€€€€€ƒ––÷–æû–Æ“–V?¦†3¾ò3š~—¢¶'–ú3–ÂÇšb¿¦g’âšVÓ––\(€€€€€€€€€€ƒ¢«¢¢–ºk’ö7¦
?¢ò¿šr³¢ê¯–ºçšbO–r£Ž3’â7–r (€€€€€€€€€€ƒš"Ã¦²—’â·Ž7žjš–Š–ë¦2¿¾ò3š&7šršr$(€€€€€€€€€€ƒŽ3š2'’â/–:ïšÊK–>7š'Ž7žjž.šÎŽ((€€€€€€€€€€ƒ¦g¢Ž‡’â7’þ»¦
––_¢"+¦
?¢ò¿¾ò3¢3šb¿žnÓš:”(€€€€€€€€€€ƒšRçžR£šVÓ–/¦+š"Ë–ÇžR£Ž–ÞËžÚO¦¦_¢¶'¦8(€€€€€€€€€€ƒ–ú#–’kš²‡¦÷š¶–âã¦/’ösžj(€€€€€€€€€€½Á•¹!½µ••…ÑÕÉ” §–ö#žª_žÎïžÖÇŠSŠP(€€€€€€€€€€ƒ–žR£–B3’â–,…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°(€€€€€€€€€€ƒ¾ò#š²’ö4¿’â/š.'¦ã–Z»–º3–£’â7žR£¦7–k¾ò'¾ò0(€€€€€€€€€€ƒ’öžR¡‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° ¤(€€€€€€€€€€ƒ–†{¦Ë¦g–/–ö#žª_žj‰½‘ç¾ò3¢ÞŽ3’òGš¿Ž4(€€€€€€€€€€ƒŽ3žÚO¦¦_šÆƒ–"¦7Ž7žR£žjšb¿–B3’âš.o¾ò0(€€€€€€€€€€ƒ’â7–7¦r¢š¢«–ÞÇžº_–êŸš¢gŽ¢«–ÞÇžº„(€€€€€€€€€€èµ¥¹‘•ãŽ(€€€€€€€€¨¼((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—¢¢·–ºhˆì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3–Þ‡š¨(€€€€€€€€€€ƒ¦‚¦v‹š2'¢«–.Wš"Ã¦²—¢ÞÏ–ëž¦ëžf÷š*¢÷¦‚¦v‹Ž7¾ò'¾òh(€€€€€€€€€€ƒžrš¶–:–nƒš&û–"Ã’êŠSŠS¦g–/–"šR¿–ú{¦‚·–"Ã–Âø(€€€€€€€€€€ƒ–>«žR¡‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° §š*((€€€€€€€€€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³–¦Ë’ú¾ò0(€€€€€€€€€€ƒ–ú{’úšÊKšâž¦ë¦9‰½‘å³šr³¢ê¯žj¥¹¹•É!Q53Ž(€€€€€€€€€€ƒ–ššzs’â+’âš²‡¦Z/žjšb¿Ž3¢žK¢&ËŽ7¾ò#žR (€€€€€€€€€€¥¹¹•É!Q50÷šVÓšº×¢N/š:'¾ò3¢Ž‡¦v‹šr'¦‚·–<(€€€€€€€€€€ƒ–"š>o–"_Ž–"¦‚š2'¦"WŽ(€€€€€€€€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò'¾ò1±½Í•!½µ••…ÑÕÉ” ¤(€€€€€€€€€€ƒ–>«šrš*+Ž3–¢ÖÃžj–¶C¦‚¦v‹Ž7¾ò#’ú/–š(€€€€€€€€€€Í­¥±±A…—¾ò'š¶ã’ö7¾ò3’â›’â7šršâš:$(€€€€€€€€€€‰½‘å°¹¥¹¹•É!Q53šr³¢ê¯¦
–Æ“ŠSŠS¦
–Æ(€€€€€€€€€€ƒ¢žK¢&Ë¦‚žj–’[šºó¾ò#¦‚·–<¯–"¦‚š2'¦"T¬(€€€€€€€€€€ƒ’â–/–nƒž
ëŽ3–"¦‚¢šž¶'¦®cŽ7¢3’þwžVd(€€€€€€€€€€ƒ–në–ºk¦®c–ê›žjž¦é¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò$(€€€€€€€€€€ƒšr’âžnÓ–6‡–r¡‰½‘å³¢Ž‡¾ò3¦gš²‡–’úžj(€€€€€€€€€€ƒ¢¢·–ºk¦v‹švÿ–>«šb¿Ž3–*ƒŽ7–r£–º–ú3¦v‹¾ò0(€€€€€€€€€€ƒ’â7šb¿Ž3–>[’îŽ7–ºŽž:§–ºÛžr/–"Ãžj–ÂÇšb¼(€€€€€€€€€€ƒ’öÿžR£¢š"«–r[¦
š¢¾òk’â+¦v‹¦
šb¿¢žK¢&Ë¦‚žj(€€€€€€€€€€ƒ–"¦‚š2'¦"W¾ò3’â/¦v‹’â–’Ÿ–†+ž¦ëžf÷¾ò#¦
–,(€€€€€€€€€€ƒž¦ëžj¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¾ò'¾ò0(€€€€€€€€€€ƒ¢¢·–ºk¦v‹švÿšr³¢ê¯–Û–¾›¦
–r£¾ò3–>«šb¿¢Š¬(€€€€€€€€€€ƒš:£–"ÃšnÓ’â/¦v‹¾ò3žV¯¦v‹’â+–º3–£žr/’â7–"ÃŽ((€€€€€€€€€€ƒ¢ÞŽ3’âï–~;’òGš¿Ž7Ž3žÚO¦¦_šÆƒ–"¦7Ž4(€€€€€€€€€€ƒ–B3’â–-‰ÕŸŽ–B3’â–/’þ»šÎW¾òk–#šâž¦è(€€€€€€€€€€‰½‘å³¾ò3’þw¢¶'š¾?š²‡¦Z/¢š[žª_¦÷šb¿’æûšÞ (€€€€€€€€€€ƒ¢Öß¦î{Ž(€€€€€€€€¨¼((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì(((€€€€€€€½¹ÍÐÁ…¹•°ô(€€€€€€€€€€€€ ‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•°ˆ¤ì(((€€€€€€€¥˜¡Á…¹•°¥ì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3¦g’êl(€€€€€€€€€€€€€€ƒš2'¦"W¦÷šÊK–>7š'Ž7¾ò/Ž3¢¢·–ºk¦‚¦v‹¦vƒ’â+¦vˆ(€€€€€€€€€€€€€€ƒ–ú#¦sŽ7¾ò'¾òh(€€€€€€€€€€€€€€ƒžrš¶žj–:–nƒš&û–"Ã’êŠSŠS’â+¦v‹¦gšº×–>¨(€€€€€€€€€€€€€€ƒšâš:'Ž3¢†3–ŸŽ7–ºk’ö7š¢–ò?¾ò3’ö(€€€€€€€€€€€€€€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³¦g–,(€€€€€€€€€€€€€€ƒ–žÒƒšr³¢ê¯žjML±…ÍÌ(€€€€€€€€€€€€€€ƒ¾ò ¹…ÕÑ¼µÍ•ÑÑ¥¹Ìµ•áÁ…¹‘•“¾ò$(€€€€€€€€€€€€€€ƒ–¾¯š¶ï’êÁ½Í¥Ñ¥½¸é…‰Í½±ÕÑ—¾òl(€€€€€€€€€€€€€€Ñ½ÀèÃ¾òm±•™ÐèÃ¾òmÉ¥¡ÐèÃ¾òl(€€€€€€€€€€€€€€¡•¥¡ÐèÌØÁÁã¾òmèµ¥¹‘•àèäà(€€€€€€€€€€€€€€ƒ¾ò#–:šr³šb¿¢¢·¢¢#žÖ™‰…ÑÑ±•A…—¢Ž„(€€€€€€€€€€€€€€ƒŽ3¢N/–r£¢žK¢&Ë–6‡ž&3’â+¦v‹Ž7¦
ž¢»žR£šÎW¾ò'Ž(€€€€€€€€€€€€€€ƒ¢†3–Ÿš¢–ò?šâš"@ˆ‹’æ/–ú3¾ò3ž?¢š÷–f£šr(€€€€€€€€€€€€€€™…±±‰…¯–n{¦g–-±…ÍÏšr³¢ê¯žj¢¢·–ºk¾ò0(€€€€€€€€€€€€€€ƒž¶'šZó¦v‹švÿ¦
šb½Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ—¾ò0(€€€€€€€€€€€€€€ƒ¢3’âS–nƒž
è¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½à(€€€€€€€€€€€€€€ƒšÊKšr'¢¢µÁ½Í¥Ñ¥½»¾ò3šr¢þGžjŽ3–ÞË–ºk’ö4(€€€€€€€€€€€€€€ƒž–[–#Ž7¢º+š"@¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°(€€€€€€€€€€€€€€ƒšr³¢ê¯¾ò!Á½Í¥Ñ¥½¸é™¥á•í¥¹Í•ÐèÃ¾ò'¾ò0(€€€€€€€€€€€€€€ƒ¦v‹švÿ–ÂÇšršVÓ–/¢Êó¦ö+¦
–/–£¢z‹–æW¦»žö¤(€€€€€€€€€€€€€€ƒžj–Þ›’â+¢žKŠSŠS¦g–ÂÇšb¿Ž3¦vƒ’â+¦v‹–ú#¦sŽ4(€€€€€€€€€€€€€€ƒžj–:–nƒ¾òo–r¡M…µÍÕ¹œ	É½ÝÍ•Ë¦g¦†x(€€€€€€€€€€€€€€ƒš&/š¦ž?¢š÷–f£’â+¾ò3¦gž¢»Ž1Á½Í¥Ñ¥½¸è(€€€€€€€€€€€€€€…‰Í½±ÕÑ—¦–ë¦‚Cšržjš:Kž&#’ö7žö»Ž4(€€€€€€€€€€€€€€ƒ¦
–âã–âã’òÓ¦j£¦î{šN+–êŸš¢g–Â7’â7šê[¾ò#–Â“–Ø(€€€€€€€€€€€€€€ƒžÚË–v–"_šîG–è¿šîG–—Ž¢š[žª_¦®c–ê›šÖ»–.T(€€€€€€€€€€€€€€ƒžjšf–g¾ò'¾ò3¦g–ÂÇšb¿Ž3š2'¦"W¦÷šÊK–>7š'Ž4(€€€€€€€€€€€€€€ƒžj–:–nƒŽ((€€€€€€€€€€€€€€ƒ¦g¢Ž‡’â7¢÷–>«šâ¢†3–Ÿš¢–ò?¾ò3¢šŽ3šb;žŠè(€€€€€€€€€€€€€€ƒ¢N/š:'Ž5±…ÍÏšr³¢ê¯žj¢¢·–ºk¾òkšRçš"@(€€€€€€€€€€€€€€Á½Í¥Ñ¥½¸éÍÑ…Ñ¥Ž¡•¥¡Ðé…ÕÑ¿¾ò0(€€€€€€€€€€€€€€ƒ¢ºO¦v‹švÿžržj–n{–"À¡½µ••…ÑÕÉ•5½‘…±	½‘ä(€€€€€€€€€€€€€€ƒžjš¶–âãšZ’îÛšÖ¢Ž‡¦v‹¾ò3¢ÞŽ3’òGš¿Ž4(€€€€€€€€€€€€€€ƒŽ3žÚO¦¦_šÆƒ–"¦7Ž7¦
’êo’âš¢š¶–âã¦†¿ž’ëŽ(€€€€€€€€€€€€€€ƒš¶–âã–B–ú_–"Ã¦î{šN+’ê/’îÛŽ(€€€€€€€€€€€€¨¼((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô(€€€€€€€€€€€€€€€€‰ÍÑ…Ñ¥Œˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹Ñ½Àô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹±•™Ðô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹É¥¡Ðô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹‰½ÑÑ½´ô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹¡•¥¡Ðô(€€€€€€€€€€€€€€€€‰…ÕÑ¼ˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹é%¹‘•àô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹µ…á!•¥¡Ðô(€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€Á…¹•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰™±½…Ñ¥¹œµµ½‘…°ˆ(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€€€€€€€€€Á…¹•°°(€€€€€€€€€€€€€€€‰½‘å°(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€Á…¹•°¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€€€€€‰™±•àˆì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢šršZÃ¢ššÆ¾ò3Ž3ž
ë’î¦êóšr'šf–d(€€€€€€€€€€ƒ¢«–.Wš"Ã¦²—¢¢·–ºk¦‚¦v‹–ú#žö»’â·¾ò3šr'šf–g–ú#¦vƒ’â/¦v‹¾ò3¦÷š*((€€€€€€€€€€ƒ–º–në–ºkžö»’â·¾òoš*+šVÓ–/¦‚¦v‹šRû–’Ÿ¢ºOšZ–¶_¦÷¢÷–†{¦Ë–:ï¾ò0(€€€€€€€€€€ƒ’â7¢š¢ºO’î[š6Ë–.WŽ7¾ò'¾òh(€€€€€€€€€€ƒ¦g¢Ž‡–:šr³’úwžŸšnÓš^§’â¢ò«žj¢ššÆ–*ƒ’ê‘½¬µ‰½ÑÑ½·š¢–ò<(€€€€€€€€€€ƒ¾ò#š"Ã¦²—’â·¢ºO¢š[žª_¢Êó¦ö+žV¯¦v‹’â/žÞžjš"Ã¦²—¢Î¢¢+š†¾ò'¾ò3¦gš¶šb¼(€€€€€€€€€€ƒŽ3šr'šf–gžö»’â·Žšr'šf–g¦vƒ’â/¦v‹Ž7žj–:–nƒŠSŠSš"Ã¦²—’â·¢Êó–êWŽ(€€€€€€€€€€ƒ’â7–r£š"Ã¦²—’â·žö»’â·¾ò3–§ž¢»ž.š/’ê“šnÿ–ëž>ûŽ’öÿžR£¢ž>û–r (€€€€€€€€€€ƒšb;žŠë¢ššÆŽ3¦÷–në–ºkžö»’â·Ž7¾ò3šRçš"C–º3–£’â7–7–*‘½¬µ‰½ÑÑ½´(€€€€€€€€€€ƒ¦g–-±…ÍÏ¾ò3’â7žº‡–r£’â7–r£š"Ã¦²—’â·¦÷žÚ·š2(€€€€€€€€€€€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…³¦‚C¢¢·žjžö»’â·¦†¿ž’ëŽ((€€€€€€€€€€ƒ–B3šfš*+¢š[žª_šr³¢ê¯¾ò ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½ã¾ò'žj(€€€€€€€€€€µ…àµ¡•¥¡ÓšRû–¾³–"ÀäÙ‘Ù£¾ò#–:šr³š"Ã¦²—’â·–>«šr$àÁ‘Ù£¾ò0(€€€€€€€€€€ƒ¦v{š"Ã¦²—’â·–ÞËžÚOšb¼äÙ‘Ù£¾ò3¦g¢Ž‡žÖÇ’âš"C’â7–"š–Š¦÷žR (€€€€€€€€€€€äÙ‘Ù£¾ò'¾ò3žn‡¦?¢ºO–Ÿ–ºç’âš²‡–ÂÇ¢÷–º3šVÓ¦†¿ž’ëŽ’â7žR£š6Ë–.WŽ(€€€€€€€€¨¼((€€€€€€€½¹ÍÐÍ•ÑÑ¥¹Í	½àô(€€€€€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡Í•ÑÑ¥¹Í	½à¥ì((€€€€€€€€€€€Í•ÑÑ¥¹Í	½à¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€‰µ…àµ¡•¥¡Ðˆ°(€€€€€€€€€€€€€€€€ˆäÙ‘Ù ˆ°(€€€€€€€€€€€€€€€€‰¥µÁ½ÉÑ…¹Ðˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€½¹ÍÐ¡…É…Ñ•ÉM•±•Ðô(€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ¤ì(((€€€€€€€¥˜¡¡…É…Ñ•ÉM•±•Ð¥ì((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸Àô(€€€€€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Àˆ¤ì(((€€€€€€€€€€€¥˜¡½ÁÑ¥½¸À¥ì((€€€€€€€€€€€€€€€½ÁÑ¥½¸À¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€€€€€€€€Á±…å•È¹¥‘ñð(€€€€€€€€€€€€€€€€€€€€‹¢žK¢&ÈÄˆì((€€€€€€€€€€€ô(((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸Äô(€€€€€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Äˆ¤ì(((€€€€€€€€€€€¥˜¡½ÁÑ¥½¸Ä¥ì((€€€€€€€€€€€€€€€½ÁÑ¥½¸Ä¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€Á±…å•ÈÈ¹¥(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€‹¢žK¢&ÈË¾ò#–Âkšr«–&×–îë¾ò$ˆì(((€€€€€€€€€€€€€€€½ÁÑ¥½¸Ä¹‘¥Í…‰±•ô(€€€€€€€€€€€€€€€€€€€€…Á±…å•ÈÈì((€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸Èô(€€€€€€€€€€€€€€€€ ‰…ÕÑ½M•ÑÑ¥¹Í¡…É=ÁÑ¥½¸Èˆ¤ì((€€€€€€€€€€€¥˜¡½ÁÑ¥½¸È¥ì(€€€€€€€€€€€€€€€½ÁÑ¥½¸È¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€€€€€€€€Á±…å•ÈÌ(€€€€€€€€€€€€€€€€€€€€üÁ±…å•ÈÌ¹¥(€€€€€€€€€€€€€€€€€€€€è€‹¢žK¢&ÈÏ¾ò#–Âkšr«–&×–îë¾ò$ˆì(€€€€€€€€€€€€€€€½ÁÑ¥½¸È¹‘¥Í…‰±•ô…Á±…å•ÈÌì(€€€€€€€€€€€ô(((€€€€€€€€€€€¡…É…Ñ•ÉM•±•Ð¹Ù…±Õ”ôˆÀˆì((€€€€€€€ô(((€€€€€€€ÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È (€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì((€€€ô(((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€•±•µ•¹Ð°(€€€‰½‘å°(¥ì((€€€¥˜ …•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ðô(€€€€€€€•±•µ•¹Ðì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ðô(€€€€€€€•±•µ•¹Ð¹Á…É•¹Ñ9½‘”ì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œô(€€€€€€€•±•µ•¹Ð¹¹•áÑM¥‰±¥¹œì(((€€€‰½‘å°¹…ÁÁ•¹‘¡¥± (€€€€€€€•±•µ•¹Ð(€€€€¤ì(((€€€•±•µ•¹Ð¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰‰±½¬ˆì()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢žK¢&Ë¦‚¦v‹¢š¢ô(€€ƒ–r£–B3’â–/¢š[žª_¢Ž‡–"š>o–"¦‚¾ò'¾òh(€€ƒš*+Ž3–’úžj–žÒƒš¶ã’ö7Ž7¦gšº×¦
?¢ò¿š*÷š"Cž6£ž®,(€€ƒ–÷–ò?¾ò1±½Í•!½µ••…ÑÕÉ” §¾ò#šVÓ–/¦^s¢š[žª_¾ò$(€€ƒ¢Þ}ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §¾ò#–>«šb¿š>o’â–,(€€ƒ–"¦‚Ž¢š[žª_¦
¦Z/¢F_¾ò'¦÷¢šžR£–"Ã–B3’â––_š¶ã’ö4(€€ƒ¦
?¢ò¿¾ò3’â7¢š¦7¢’–¾¯–§š²‡Ž(¨¼()™Õ¹Ñ¥½¸É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¥ì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk–#š*+–>¿¢÷¢Š¯¦jÇ¢^?žjžº·¦‚·–"š>l(€€€€€€ƒ–6–†+š‹–ú§¦†¿ž’ë¾ò3’â7žº‡¦gš²‡–žjšb¿–N«–,(€€€€€€ƒ¦‚¦v‹¾ò3¦÷¢š–#¢fWžB¾ò3¢Þ}¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð(€€€€€€ƒšb¿’â7šb½¹Õ±³ž‡¦^s¾ò#ž6£ž®/žj’â’î÷ž.š/¾ò'Ž(€€€€¨¼((€€€¥˜¡¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É¥ì((€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€ˆˆì(((€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…Éô(€€€€€€€€€€€¹Õ±°ì((€€€ô(((€€€¥˜ …¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰¹½¹”ˆì(((€€€¥˜ (€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œ€˜˜(€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œ¹Á…É•¹Ñ9½‘”ôôô(€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð(€€€€¥ì((€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð¹¥¹Í•ÉÑ	•™½É” (€€€€€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð°(€€€€€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œ(€€€€€€€€¤ì((€€€ô(€€€•±Í”¥˜¡¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð¥ì((€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ð¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ð(€€€€€€€€¤ì((€€€ô(((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘±•µ•¹Ðô(€€€€€€€¹Õ±°ì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘A…É•¹Ðô(€€€€€€€¹Õ±°ì((€€€¡½µ••…ÑÕÉ•	½ÉÉ½Ý•‘9•áÑM¥‰±¥¹œô(€€€€€€€¹Õ±°ì()ô(()™Õ¹Ñ¥½¸±½Í•!½µ••…ÑÕÉ” ¥ì((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì((€€€½¹ÍÐÉ•±•…Í•UÁ‘…Ñ”ô(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”ì(€€€¥˜ (€€€€€€€É•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í”ôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€É•±•…Í•UÁ‘…Ñ”¹Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í” ¤(€€€€¥ì(€€€€€€€¥˜¡ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€É•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€ô((€€€¥˜ (€€€€€€€É•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹½¹M¡…É•‘5½‘…±±½Í•ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€É•±•…Í•UÁ‘…Ñ”¹½¹M¡…É•‘5½‘…±±½Í• ¤ì(€€€ô(((€€€¥˜¡µ½‘…°¥ì((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¦^s¦Z'¢š[žª_šf¾ò3–ššzs––_žR£¦8(€€€€€€€€€€ƒŽ3¢žK¢&Ë¦‚¦v‹žR£žj–*ƒ–¾³š¢–ò?Ž7¾ò3’â’öÔ(€€€€€€€€€€ƒš.ÿš:'¾ò3’â7šr–öÇ¦~ÿ’â/š²‡¦Z/–V–ê\¿’îï–.d(€€€€€€€€€€ƒ¦gž¢»’â¢"³–’Ÿ–Â?žj¢š[žª_Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ‰½àô((€€€€€€€€€€€µ½‘…°¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡‰½à¥ì((€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Ý¥‘”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¢Þ’â+¦v‹–*Ý¥‘—šb¿–B3’âžÖ¾ò0(€€€€€€€€€€ƒ¦^s¦Z'¢š[žª_šf–’[–Æ“¦»žö§žj¹¼µÁ…‘‘¥¹œ(€€€€€€€€€€ƒ’æ¢š’â’ö×š.ÿš:'Ž(€€€€€€€€¨¼((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰¹¼µÁ…‘‘¥¹œˆ(€€€€€€€€¤ì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk¢Þ}¹¼µÁ…‘‘¥¹Ÿ–B3’âžÖšRÛ–ÂûŠSŠP(€€€€€€€€€€ƒ¢«–.Wš"Ã¦²—¢¢·–ºk¢š[žª_žR£žj‘½¬µ‰½ÑÑ½´(€€€€€€€€€€ƒ¾ò#¢Êó–êW¦†¿ž’ë¾ò'’æ¢š’â’ö×š.ÿš:'¾ò3’â7šr(€€€€€€€€€€ƒ¢ºO’â/š²‡¦Z/–V–ê\¿’îï–.g¦gž¢»’â¢"³žö»’â´(€€€€€€€€€€ƒ¢š[žª_¢Š¯¢ª“––_žR£¢Êó–êWš¢–ò?Ž(€€€€€€€€¨¼((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰‘½¬µ‰½ÑÑ½´ˆ(€€€€€€€€¤ì((€€€€€€€€¼¨Xàç¾òk’îï–.g–Â#žR£ž&#–z/¢"ž–[–ÆÁ…¸µäƒ–>«–r£’îï–.g¦Z/–Všf–¶c–r£Ž€¨¼(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰ÅÕ•ÍÐµµ½‘”ˆ(€€€€€€€€¤ì((€€€ô((€€€Í•ÑEÕ•ÍÑQ½Õ¡5½‘” (€€€€€€€™…±Í”(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òk¢Þ}Ý¥‘”½¹¼µÁ…‘‘¥¹Ÿšb¿–B3’âžÖ(€€€€€€ƒšRÛ–Âû–.W’ös¾ò3¦^s¦Z'¢š[žª_šfš*+¾òš2'¦"W¦7žö»–nx(€€€€€€ƒ¦jÇ¢^?¾ò3¦ÿ–7’â/š²‡¦Z/–V–ê\¿’îï–.g¦gž¢»’â¢"°(€€€€€€ƒ¢š[žª_šfšºcžVg¦†¿ž’ëŽ(€€€€¨¼((€€€½¹ÍÐ¡•±Á	Ñ¸ô(€€€€€€€€ ‰ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡¡•±Á	Ñ¸¥ì((€€€€€€€¡•±Á	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3¢«–.Wš"Ã¦²—žjš†¸¸»––_žR£’â˜(€€€€€€ƒšr–úš2'¦"W–7š"Ã¦²—’â·š‚çšr³šÊKšr'–>7š'Ž7š^¦
+¦
–ò×š"«–r[¾ò0(€€€€€€ƒŽ3–£–Æ³šŸš*¢÷¦‚C¢š÷Ž7š2'¦"W–ëž>û–r£¢«–.Wš"Ã¦²—¢¢·–ºk¢š[žª_’â+¾ò'¾òh(€€€€€€ƒ¢Þ’â+¦v‰ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½»–B3’â–-‰ÕŸŽšò?’ê–B3’â–/–rÃšZä(€€€€€€ƒšÊK¦7žö»ŠSŠQÍ­¥±±AÉ•Ù¥•Ý!•…‘•É	ÕÑÑ½»–>«šr'–r (€€€€€€ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §¢Ž‡¢Š¯¢¢·š"C¦†¿ž’è¿¦jÇ¢^?¾ò3–>«¢šž:§–ºØ(€€€€€€ƒ¦Ë¦;’âš²‡¢žK¢&Ë¢š[žª_žjŽ3š*¢÷Ž7–"¦‚¾ò3¦g¦†š2'¦"Wžj(€€€€€€¥¹±¥¹”ÍÑå±”¹‘¥ÍÁ±…çšr–s–r ‰¥¹±¥¹”µ‰±½¬‹¾ò0(€€€€€€ƒ’æ/–ú3’â7žº‡¦Z/’î¦êó¢š[žª_¾ò#¢«–.Wš"Ã¦²—¢¢·–ºkŽ–V–ê_Ž’îï–.gŠ›Š›¾ò$(€€€€€€ƒ¦÷šršºcžVg¦†¿ž’ë¾ò3–nƒž
ë–"–"¦‚¢Þ¦^s¢š[žª_šb¿–§šŠw’â7–B3¢Þ¿–úG¾ò0(€€€€€€ƒ¦^s¢š[žª_¦
¦
+–:šr³šÊKšr'¦7žö»–"Ã–ºŽ¦g¢Ž‡¢Žs’â+¢Þ|(€€€€€€ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½»’âš¢žjšRÛ–Âû¦7žö»Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±AÉ•Ù¥•Ý	Ñ¸ô(€€€€€€€€ ‰Í­¥±±AÉ•Ù¥•Ý!•…‘•É	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡Í­¥±±AÉ•Ù¥•Ý	Ñ¸¥ì((€€€€€€€Í­¥±±AÉ•Ù¥•Ý	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¤ì((€€€¥˜¡Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”¥ì(€€€€€€€Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¤ì(€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3¢žK¢&Ë¦‚¦v‹šVÓ–B (€€ƒ¢Žw–
d¿¢÷–*o–ð¿š*¢÷’â'–/–"¦‚¾ò'¾òh(€€ƒ¢Þ}‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° §šb¿–B3’âš.o¾ò0(€€ƒ–>«šb¿¦gš²‡–žjšb¿šVÓ–/¢3–2¿ž.š,¿š*¢÷¦‚¦vˆ(€€ƒ¾ò#šr³’ú–ÂÇ–¶c–r£Ž–ÞËžÚOšâ³¢¦›ž¦§–ºkžj–º3šVÓ¦‚¦v‹¾ò0(€€ƒ’â7šb¿¦7–¾¯’â––_šZÃžj¾ò'¾ò3–†{¦Ë¢žK¢&Ë¢š[žª_¢Ž‡žj(€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó–ºç–f£–:–rÃ¦†¿ž’ëŽ((€€ƒ–"š>o–"¦‚šf¾ò3–#š*+Ž3’â+’â–/–"¦‚–¢ÖÃžj(€€ƒ¦‚¦v‹Ž7š¶ã’ö7¾ò3–7–šZÃžj¦‚¦v‹¦Ë’úŠSŠP(€€ƒ–B3’âšf¦ZO–>«šršr'’â–/¦‚¦v‹¢Š¯–¢ÖÃ¾ò3’â7šr(€€ƒ–§–/–"¦‚žj–Ÿ–ºçžZ+–r£’â¢ÖßŽ(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â+¦v‹¦‚·–<(€€ƒš‚çšr³šÊK–>7š'Ž7ŠSŠS¦g–/–V?¦†3šb¿žržj¾ò3’æ/–&4(€€ƒ¦‚·–?žj½¹±¥¯–>«šb¿–"š>o–"¦‚¾ò3–º3–£šÊKšr$(€€ƒžržj–"š>o¢žK¢&Ë¾ò'¾òh(€€ƒ¦î{¦‚·–?šf¾ò3š*+ž.š,¿¢3–2¿š*¢÷’â'–/¦‚¦vˆ(€€ƒ–B¢«žjŽ3žn»–&7š¶–r£žr/–N«–/¢žK¢&ËŽ7ž.š,(€€ƒ’âš²‡–£¦£¢¢·š"C–B3’â–/¢žK¢&Ë¾ò3’â›–Fó–>¯’â'–,(€€ƒ¦‚¦v‹–B¢«žjžV¯¦v‹šnÓšZÃ–÷–ò?ŠSŠS’â7žº‡ž:§–ºØ(€€ƒž>û–r£š¶–r£žr/–N«–/–"¦‚¾ò3–"––÷’æ/–ú3žV¯¦vˆ(€€ƒ¦÷šb¿–Â7žj¾ò3’â7žR£ž¶'ž:§–ºÛ¢«–ÞÇ–7¦î{’âš²„(€€ƒ–"¦‚š&7šnÓšZÃŽ((€€ƒ’â'–/¦‚¦v‹žR£žjž.š/¢º+šVãš‚ó–ò?’â7’âš¢Œ(€€ƒ¾ò!ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•à¼(€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•ãšb¼Ãš"XÇžjšVã–¶_¾ò0(€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Ëšb¼‰™¥É”‹¾ò<(€€€‰Á±…å•ÈÈ‹¦gž¢»–¶_’âË¾ò'¾ò3¦g¢Ž‡–B¢«¢ö'š>l(€€ƒš"C–Â7žjš‚ó–ò?–7¢Î›–ó¾ò3’â7šb¿’â'–/¦÷¢÷–ÇžR (€€ƒ–B3’â–/šVã–¶_Ž(¨¼()™Õ¹Ñ¥½¸Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì¡Ñ…É•Ñ%¹‘•à¥ì((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡Ñ…É•Ñ%¹‘•à¤ì((€€€¥˜ …Ñ…É•Ñ¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•àô(€€€€€€€Ñ…É•Ñ%¹‘•àì((€€€=‰©•Ð¹­•åÌ (€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€¤¹™½É…  (€€€€€€€ÍÑ…Ðôùì((€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñtô(€€€€€€€€€€€€€€€€Àì((€€€€€€€ô(€€€€¤ì((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì(((€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àô(€€€€€€€Ñ…É•Ñ%¹‘•àì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì(((€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èô(€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä¡Ñ…É•Ñ%¹‘•à¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ¢ºO¢Š¯¦ã’â·žj¦‚·–?šr'¢š[¢šë’â+žj–6–"”(€€€€€€ƒ¾ò#’ú/–š–’[–r#¢º+’ê»¾ò'¾ò3ž:§–ºÛš&7žr/–ú_–ë’ú(€€€€€€ƒžn»–&7¦ãžjšb¿–N«’â–/¢žK¢&ËŽ(€€€€¨¼((€€€lÀ°Ä°Ét¹™½É…  (€€€€€€€¤ôùì((€€€€€€€€€€€½¹ÍÐ…Ù…Ñ…É°ô(€€€€€€€€€€€€€€€€ ‰¡…É…Ñ•ÉÙ…Ñ…Èˆ­¤¤ì(((€€€€€€€€€€€¥˜¡…Ù…Ñ…É°¥ì(€€€€€€€€€€€€€€€½¹ÍÐÍ•±•Ñ•õ¤ôôõÑ…É•Ñ%¹‘•àì(€€€€€€€€€€€€€€€…Ù…Ñ…É°¹ÍÑå±”¹½Á…¥ÑäõÍ•±•Ñ•€ü€ˆÄˆ€è€ˆ¸Ôˆì(€€€€€€€€€€€€€€€…Ù…Ñ…É°¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÕÉÉ•¹Ðµ¡…É…Ñ•Èˆ±Í•±•Ñ•¤ì(€€€€€€€€€€€€€€€½¹ÍÐ¡½¥”õ…Ù…Ñ…É°¹±½Í•ÍÐ ˆ¹¡…É…Ñ•ÈµÍ¡½Ý…Í”µ¡½¥”ˆ¤ì(€€€€€€€€€€€€€€€¥˜¡¡½¥”¥ì¡½¥”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÕÉÉ•¹Ðµ¡…É…Ñ•Èˆ±Í•±•Ñ•¤ìô(€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡Ñ…‰9…µ”¥ì((€€€É•ÍÑ½É•	½ÉÉ½Ý•‘±•µ•¹Ð ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢þS–n{š†š†(€€€€€€ƒš^¦
+–’k’â–/¾òš2'¦"WŽ7¾ò3–>«–r£¢÷–*o–ó–"¦‚(€€€€€€ƒ¦†¿ž’ë¾ò'¾òh(€€€€€€ƒš¾?š²‡–"–"¦‚¦÷¦7šZÃ–"“šZß’âš²‡¾ò3–"–"À(€€€€€€€‰ÍÑ…ÑÕÌ‹š&7¦†¿ž’ë¾ò3–"–"Ã–Û’î[–"¦‚(€€€€€€ƒ¾ò#žÚO¦¦_šÆƒ–"¦4¿š*¢ô¿¢3–2¾ò'¢«–.W¦jÇ¢^?¾ò0(€€€€€€ƒ’â7žR£–r£š¾?–/–"¦‚–B¢«¢fWžBŽ(€€€€¨¼((€€€½¹ÍÐ¡•±Á	Ñ¸ô(€€€€€€€€ ‰ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡¡•±Á	Ñ¸¥ì((€€€€€€€¡•±Á	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€Ñ…‰9…µ”ôôô‰ÍÑ…ÑÕÌˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¥¹±¥¹”µ‰±½¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–£š*¢÷¦‚C¢šô(€€€€€€ƒšZ–¶_š2'¦"W¾ò3š'¢¦ËšRû–r£š*¢÷¦‚¦v‹žj¢þS–nx(€€€€€€ƒ’â/¦v‹Ž7¾ò'¾òh(€€€€€€ƒ¢Þ}ÍÑ…ÑÕÍ!•±Á	ÕÑÑ½»–B3’â––_¦
?¢ò¿¾ò3–>«šr$(€€€€€€ƒ–"–"ÃŽ3š*¢÷Ž7–"¦‚š&7¦†¿ž’ë¾ò3–Û’î[–"¦‚(€€€€€€ƒ¢«–.W¦jÇ¢^?Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±AÉ•Ù¥•Ý	Ñ¸ô(€€€€€€€€ ‰Í­¥±±AÉ•Ù¥•Ý!•…‘•É	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡Í­¥±±AÉ•Ù¥•Ý	Ñ¸¥ì((€€€€€€€Í­¥±±AÉ•Ù¥•Ý	Ñ¸¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€Ñ…‰9…µ”ôôô‰Í­¥±°ˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¥¹±¥¹”µ‰±½¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ðˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁ…•%‘5…Àõì(€€€€€€€ÍÑ…ÑÕÌè‰ÍÑ…ÑÕÍA…”ˆ°(€€€€€€€¥¹Ù•¹Ñ½Éäè‰¥¹Ù•¹Ñ½ÉåA…”ˆ°(€€€€€€€Í­¥±°è‰Í­¥±±A…”ˆ°(€€€€€€€•áÁA½½°è‰¡½µ•áÁA½½±…Éˆ(€€€ôì(((€€€½¹ÍÐÁ…•°ô(€€€€€€€€ (€€€€€€€€€€€Á…•%‘5…ÁmÑ…‰9…µ•t(€€€€€€€€¤ì(((€€€¥˜ …Á…•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‰½ÉÉ½Ý±•µ•¹Ñ%¹Ñ½5½‘…° (€€€€€€€Á…•°°(€€€€€€€½¹Ñ…¥¹•È(€€€€¤ì((€€€¥˜¡Ý¥¹‘½Ü¹ØÜáÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÜáÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐ ¤ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â+¦v‹–ÞËžÚL(€€€€€€ƒ–>¿’î—–"š>o¢žK¢&Ë’ê¾ò3’â/¦v‹žº·¦‚·¦
š:Kš.ÿš:'Ž7¾ò'¾òh(€€€€€€ƒ¦g’â'–/¦‚¦v‹–B¢«–:šr³–ÂÇšr'žjŽ3Š^¢žK¢&Ë–B7ŠZÛŽ4(€€€€€€ƒžº·¦‚·–"š>o–6–†+¾ò3–¦Ë¢žK¢&Ë¢š[žª_’æ/–ú3¢Þ|(€€€€€€ƒ’â+šZçšZÃ–*ƒžj¦‚·–?¦ãšN¦7¢’’ê¾ò3¦g¢Ž‡š*+–º(€€€€€€ƒ¦jÇ¢^?š:'ŠSŠS–>«–r£Ž3–¦Ë¢žK¢&Ë¢š[žª_¦†¿ž’ëŽ4(€€€€€€ƒ¦g–/š–Š¦jÇ¢^?¾ò3¦‚¦v‹šr³¢ê¯–ššzs’æ/–ú3¢Š¬(€€€€€€ƒ–Z»ž6£–žR£–r£–"—žj–rÃšZç¾ò3’â7–>_–öÇ¦~ü(€€€€€€ƒ¾ò#–nƒž
ëšb¿–r£–¦Ë’úŽžŠë–ºk¢š¦†¿ž’ëžj¦g–,(€€€€€€ƒšf¦ZO¦î{š&7¦jÇ¢^?¾ò3’â7šb¿–¾¯š¶ï–r£¦‚¦v‹šr³¢ê¬(€€€€€€ƒžjMO’â+¾ò'Ž(€€€€¨¼((€€€½¹ÍÐÍÝ¥Ñ¡…É‘%‘5…Àõì(€€€€€€€ÍÑ…ÑÕÌè‰ÍÑ…ÑÕÍ¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ°(€€€€€€€¥¹Ù•¹Ñ½Éäè‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ°(€€€€€€€Í­¥±°è‰Í­¥±±¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ(€€€ôì(((€€€½¹ÍÐÍÝ¥Ñ¡…Éô(€€€€€€€€ (€€€€€€€€€€€ÍÝ¥Ñ¡…É‘%‘5…ÁmÑ…‰9…µ•t(€€€€€€€€¤ì(((€€€¥˜¡ÍÝ¥Ñ¡…É¥ì((€€€€€€€ÍÝ¥Ñ¡…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì(((€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…Éô(€€€€€€€€€€€ÍÝ¥Ñ¡…Éì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ¦‚’úÿ¢ºOžn»–&7¦ã’â·žj–"¦‚š2'¦"Wšr$(€€€€€€ƒ¢š[¢šë’â+žj–6–"—¾ò#’ú/–š–êW¢&Ë–>7žf÷¾ò'¾ò0(€€€€€€ƒž:§–ºÛš&7žr/–ú_–ë’úžn»–&7š¶–r£žr/–N«–/–"¦‚Ž(€€€€¨¼((€€€l‰áÁA½½°ˆ°‰MÑ…ÑÕÌˆ°‰M­¥±°‰t¹™½É…  (€€€€€€€¹…µ”ôùì((€€€€€€€€€€€½¹ÍÐ‰Ñ¸ô(€€€€€€€€€€€€€€€€ ‰¡…É…Ñ•ÉQ…‰	Ñ¸ˆ­¹…µ”¤ì(((€€€€€€€€€€€¥˜¡‰Ñ¸¥ì((€€€€€€€€€€€€€€€‰Ñ¸¹ÍÑå±”¹½Á…¥Ñäô((€€€€€€€€€€€€€€€€€€€¹…µ”¹Ñ½1½Ý•É…Í” ¤ôôô(€€€€€€€€€€€€€€€€€€€Ñ…‰9…µ”¹Ñ½1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆ¸ÔÔˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¥ì((€€€½¹ÍÐÙ…±Õ”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡½±¥ñðÀ¤¤ì((€€€l(€€€€€€€€ ‰¡½µ•½±‘Y…±Õ”ˆ¤°(€€€€€€€€ ‰¥¹Ù•¹Ñ½Éå½±‘Y…±Õ”ˆ¤°(€€€€€€€€ ‰ØÄÐÙ!½µ•I½ÍÑ•É½±‘Y…±Õ”ˆ¤(€€€t¹™½É… ¡•°ôùì(€€€€€€€¥˜¡•°¥ì(€€€€€€€€€€€•°¹Ñ•áÑ½¹Ñ•¹ÐõÙ…±Õ”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(€€€€€€€ô(€€€ô¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ–V–ê\(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•ÉM¡½Á½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐ…É‘ÌõÍ¡½Á%Ñ•µÌ¹µ…À¡Í¡½Á%Ñ•´ôùì(€€€€€€€½¹ÍÐ½Õ¹Ðõ•ÑA½Ñ¥½¹½Õ¹Ð¡Í¡½Á%Ñ•´¹¥¤ì(€€€€€€€½¹ÍÐÉ•Í½ÕÉ•1…‰•°õÍ¡½Á%Ñ•´¹É•Í½ÕÉ”ôôô‰¡Àˆ€ü€‰!@ˆ€è€‰M@ˆì(€€€€€€€½¹ÍÐ•™™•ÑQ•áÐõÍ¡½Á%Ñ•´¹É•½Ù•ÉåA•É•¹ÐøôÄÀÀ(€€€€€€€€€€€€üƒ–n{–ú§š&šr$‘íÉ•Í½ÕÉ•1…‰•±õ€(€€€€€€€€€€€€èƒ–n{–ú§šr–’œ‘íÉ•Í½ÕÉ•1…‰•±÷žj€‘íÍ¡½Á%Ñ•´¹É•½Ù•ÉåA•É•¹Ñô•€ì((€€€€€€€½¹ÍÐ¡…ÍAÉ¥”õ9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í¡½Á%Ñ•´¹ÁÉ¥”¤ì(€€€€€€€½¹ÍÐ‘¥Í…‰±•ô…¡…ÍAÉ¥”ñð½±ñÍ¡½Á%Ñ•´¹ÁÉ¥”ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¹Q•áÐô…¡…ÍAÉ¥”(€€€€€€€€€€€€ü€‹–çš‚ó–ú–ºhˆ(€€€€€€€€€€€€è€‘íÍ¡½Á%Ñ•´¹ÁÉ¥•ôƒ¦G–æ€ì((€€€€€€€É•ÑÕÉ¸€(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ…É€‘íÍ¡½Á%Ñ•´¹É•Í½ÕÉ•ôˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ…Éµ¡•…ˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÑåÁ”ˆø‘íÉ•Í½ÕÉ•1…‰•±ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÍÑ½¬ˆûš2šr$€‘í½Õ¹Ñôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ¹…µ”ˆø‘íÍ¡½Á%Ñ•´¹¹…µ•ôð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ•™™•Ðˆø‘í•™™•ÑQ•áÑôð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÁÕÉ¡…Í”µÉ½Üˆø(€€€€€€€€€€€€€€€€€€€€ñ±…‰•°™½Èô‰Í¡½ÁEÕ…¹Ñ¥Ñä´‘íÍ¡½Á%Ñ•´¹¥‘ôˆûšVã¦<ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€¥ô‰Í¡½ÁEÕ…¹Ñ¥Ñä´‘íÍ¡½Á%Ñ•´¹¥‘ôˆ(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µÅÕ…¹Ñ¥Ñäˆ(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑµ½‘”ô‰¹Õµ•É¥Œˆ(€€€€€€€€€€€€€€€€€€€€€€€µ¥¸ôˆÄˆ(€€€€€€€€€€€€€€€€€€€€€€€µ…àôˆääääˆ(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ•ÀôˆÄˆ(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”ôˆÄˆ(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸Í¡½ÀµÁ½Ñ¥½¸µ‰Õäˆ(€€€€€€€€€€€€€€€€€€€€€€€€‘í‘¥Í…‰±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ô(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬ô‰‰ÕåM¡½Á%Ñ•´ œ‘íÍ¡½Á%Ñ•´¹¥‘ôœ±‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% Í¡½ÁEÕ…¹Ñ¥Ñä´‘íÍ¡½Á%Ñ•´¹¥‘ôœ¤¹Ù…±Õ”¤ˆ(€€€€€€€€€€€€€€€€€€€€ø‘í‰ÕÑÑ½¹Q•áÑôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ì(€€€ô¤¹©½¥¸ ˆˆ¤ì((€€€É•ÑÕÉ¸€(€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ¥¹Ñ•É™…”ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ¹½Ñ”ˆû–>«¢Ê§–R¸!C¾ò=M@ƒ–n{–ú§¢^—šÂÐð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í¡½ÀµÁ½Ñ¥½¸µ±¥ÍÐˆø‘í…É‘Íôð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€ì)ô(()™Õ¹Ñ¥½¸‰ÕåM¡½Á%Ñ•´¡¥Ñ•µ%±É•ÅÕ•ÍÑ•‘EÕ…¹Ñ¥Ñä¥ì((€€€½¹ÍÐÍ¡½Á%Ñ•´õ•ÑA½Ñ¥½¹•™¥¹¥Ñ¥½¸¡¥Ñ•µ%¤ì((€€€¥˜ …Í¡½Á%Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í¡½Á%Ñ•´¹ÁÉ¥”¤¥ì(€€€€€€€…±•ÉÐ ‹¦g–/¢^—šÂÓžj–çš‚ó–Âkšr«¢¢·–ºkŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÅÕ…¹Ñ¥Ñäõ5…Ñ ¹µ…à (€€€€€€€€Ä°(€€€€€€€5…Ñ ¹µ¥¸ ääää±5…Ñ ¹™±½½È¡9Õµ‰•È¡É•ÅÕ•ÍÑ•‘EÕ…¹Ñ¥Ñä¥ñðÄ¤¤(€€€€¤ì((€€€½¹ÍÐÑ½Ñ…±AÉ¥”õÍ¡½Á%Ñ•´¹ÁÉ¥”©ÅÕ…¹Ñ¥Ñäì((€€€¥˜¡½±ñÑ½Ñ…±AÉ¥”¥ì(€€€€€€€…±•ÉÐ ‹¦G–æ’â7–’ƒ¾ò3šr³š²‡¦r¢š€ˆ­Ñ½Ñ…±AÉ¥”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤¬ˆƒ¦G–æŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ ……‘‘A½Ñ¥½¹Q½%¹Ù•¹Ñ½Éä¡¥Ñ•µ%±ÅÕ…¹Ñ¥Ñä¤¥ì(€€€€€€€…±•ÉÐ ‹¢3–2–ÞËšîÿ¾ò3š"[¢¦Ë¢^—šÂÓ–ÞËšÊKšr'–>¿žR£žj–‚žZ+ž¦ë¦ZOŽˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½±õ½±µÑ½Ñ…±AÉ¥”ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì(€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(€€€Í…Ù•…µ” ¤ì((€€€½¹ÍÐ‰½‘å°ô ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì((€€€¥˜¡‰½‘å°¥ì(€€€€€€€‰½‘å°¹¥¹¹•É!Q50õÉ•¹‘•ÉM¡½Á½¹Ñ•¹Ð ¤ì(€€€ô)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¢žK¢&Ë–ÆWž’è(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–>¢–r[¦
ž¢¸(€€ƒŽ3’â+¦v‹¦†¿ž’ë–ÞË¦Z/šRø¿šr«¦Z/šRû¢žK¢&Ë¾ò3’â/¦v‹–"š>l(€€ƒ¢Žw–
d¿¢÷–*o–ð¿š*¢÷Ž7žj¢žK¢&Ë¦‚¦v‹¾ò'¾òh((€€ƒ’â+š:K¾òk¢žK¢&Ë¦‚·–?š‚ó¾ò3–ÞË–&×–îëžj¢žK¢&Ë¦†¿ž’è(€€ƒ–Æ³šŸ–r[ž’è¯–B7ž¢Ä¯ž¶'žÒk¾ò3¦
šÊK–&×–îëžj¾ò#žn»–&4(€€ƒ–>«šr'ž²³’ê3¢žK¢&Ë¦g–/’ö7žö»¾ò'¦†¿ž’ë¦:[¦‚´¯¢ž¦:X(€€ƒšŠw’îÛ¾ò3¦î{’â/–:ï–ššzsšŠw’îÛ–ÞËžÚO¦Sš"C–ÂÇžnÓš:”(€€ƒ¢ÞÏ–ë–&×–îë¢š[žª_Ž((€€ƒ’â/š:K¾òk’â'–/š2'¦"W¾ò#¢Žw–
d¿¢÷–*o–ð¿š*¢÷¾ò'¾ò0(€€ƒžnÓš:—–Â;–:ïž>ûš"Cžj¢3–2¿ž.š,¿š*¢÷¦‚¦v‹ŠSŠP(€€ƒ¦g’â'–/¦‚¦v‹šr³¢ê¯–ÞËžÚOšr'¢žK¢&Ë–"š>ožº·¦‚´(€€ƒ¾ò!¡…¹•%¹Ù•¹Ñ½Éå¡…É…Ñ•È¼(€€¡…¹•MÑ…ÑÕÍ¡…É…Ñ•È¼(€€¡…¹•M­¥±±¡…É…Ñ•ÉÉÉ½ß¾ò'¾ò3’â7žR£–r (€€ƒ¦g¢Ž‡¦7šZÃ–k’â––_¢žK¢&Ë–"š>o¦
?¢ò¿¾ò3žnÓš:—šÊÿžR (€€ƒž>ûš"CŽ–ÞËžÚOšâ³¢¦›¦;žj¦‚¦v‹–ÂÇ––÷Ž(¨¼()™Õ¹Ñ¥½¸É•¹‘•É¡…É…Ñ•ÉM¡½Ý…Í•½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐÍ±½ÑÌõl(€€€€€€€Á±…å•È°(€€€€€€€Á±…å•ÈÈ°(€€€€€€€Á±…å•ÈÌ(€€€tì(((€€€±•Ð¡Ñµ°ô((€€€€€€€€œñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…ÀèÄÁÁàìœ¬(€€€€€€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ðé•¹Ñ•Èíµ…É¥¸µ‰½ÑÑ½´èáÁàìˆøœì(((€€€Í±½ÑÌ¹™½É…  (€€€€€€€€¡¡…É…Ñ•È±Í±½Ñ%¹‘•à¤ôùì((€€€€€€€€€€€¥˜¡¡…É…Ñ•È¥ì(€€€€€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰¡…É…Ñ•ÈµÍ¡½Ý…Í”µ¡½¥”ˆÍÑå±”ô‰Ý¥‘Ñ èàÙÁàíÑ•áÐµ…±¥¸é•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€ÕÉÍ½ÈéÁ½¥¹Ñ•Èìˆ½¹±¥¬ô‰Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì œ¬(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•à¬(€€€€€€€€€€€€€€€€€€€€œ¤ìˆøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰¡…É…Ñ•ÉÙ…Ñ…Èœ¬(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•à¬(€€€€€€€€€€€€€€€€€€€€œˆ±…ÍÌô‰¡…É…Ñ•ÈµÍ¡½Ý…Í”µ…Ù…Ñ…ÈˆÍÑå±”ô‰Ý¥‘Ñ èÔÙÁàí¡•¥¡ÐèÔÙÁàíµ…É¥¸èÀ…ÕÑ¼ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈµÉ…‘¥ÕÌèÔÀ”í‰…­É½Õ¹µ½±½ÈèŒÄÔÄÀÁ„í‰…­É½Õ¹µ¥µ…”éÕÉ°¡pœœ¬(€€€€€€€€€€€€€€€€€€€•Ñ¡…É…Ñ•ÉÉÑÝ½É­A…Ñ ¡¡…É…Ñ•È¤¬(€€€€€€€€€€€€€€€€€€€€pœ¤í‰…­É½Õ¹µÍ¥é”é½Ù•Èí‰…­É½Õ¹µÁ½Í¥Ñ¥½¸é•¹Ñ•È€Äà”ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈèÉÁàÍ½±¥€˜ÁˆÐÈäí‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ðé•¹Ñ•Èí™½¹ÐµÍ¥é”èÄáÁàíÑÉ…¹Í¥Ñ¥½¸é½Á…¥Ñä€¸ÄÕÌìˆøœ¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí™½¹ÐµÝ•¥¡Ðé‰½±íµ…É¥¸µÑ½ÀèÉÁàìœ¬(€€€€€€€€€€€€€€€€€€€€Ý¡¥Ñ”µÍÁ…”é¹½ÝÉ…Àí½Ù•É™±½Üé¡¥‘‘•¸íÑ•áÐµ½Ù•É™±½Üé•±±¥ÁÍ¥Ììˆøœ¬(€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È¹¥¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š2'–6žÒh(€€€€€€€€€€€€€€€€€€€€€€ƒžjšf–g¾ò3’â+¦v‹¦‚·–?š†žjž¶'žÒkšÊKšr'¢Þ¢F\(€€€€€€€€€€€€€€€€€€€€€€ƒ–Š{–*ƒŽ7¾ò'¾òh(€€€€€€€€€€€€€€€€€€€€€€ƒ¦g–/ž¶'žÒkšZ–¶_–:šr³šÊKšr%¥“¾ò3žÒSžÊçšb¼(€€€€€€€€€€€€€€€€€€€€€€É•¹‘•É¡…É…Ñ•ÉM¡½Ý…Í•½¹Ñ•¹Ð ¤(€€€€€€€€€€€€€€€€€€€€€€ƒžÖ–¶_’âËšfžVÛ’â/žº_––÷žnÓš:—–¾¯š¶ï¦É!Q53¾ò0(€€€€€€€€€€€€€€€€€€€€€€ƒ¦g–/–÷–ò?–>«šr'Ž3š&O¦Z/¢žK¢&Ë–ö#žª_¦
’â–"ïŽ4(€€€€€€€€€€€€€€€€€€€€€€ƒšr¢Š¯–Fó–>¯’âš²‡¾ò3’æ/–ú3’â7žº‡ž¶'žÒkš;¦êó¢º((€€€€€€€€€€€€€€€€€€€€€€ƒ¾ò#’ú/–š–:ïžÚO¦¦_šÆƒ–"¦7¦‚¦v‹š2'–"¦7Ž(€€€€€€€€€€€€€€€€€€€€€€ƒ¢žK¢&Ë–6žÒk’ê¾ò'¾ò3¦gšº×–¶_’âËš^§–ÂÇ–ÞËžÚL(€€€€€€€€€€€€€€€€€€€€€€ƒ¦cš¶ï–r£žV¯¦v‹’â+¾ò3šÊKšr'’êëšr–7–n{’úšnÓšZÀ(€€€€€€€€€€€€€€€€€€€€€€ƒ–ºŠSŠS’â7šb¿¢ÎšZgšÊKžº_–Â7¾ò3šb¿žV¯¦v‹š‚çšr°(€€€€€€€€€€€€€€€€€€€€€€ƒšÊK¢Š¯¦kž~—¢š¦7žV¯Ž((€€€€€€€€€€€€€€€€€€€€€€ƒ–*ƒ’â–-¥“¾ò3¢ºM¡•­1•Ù•±UÀ §–6žÒh(€€€€€€€€€€€€€€€€€€€€€€ƒžfóžRžjžVÛ’â/–>¿’î—žnÓš:—š&û–"Ã¦g–/–žÒƒŽ(€€€€€€€€€€€€€€€€€€€€€€ƒ–>«šnÓšZÃ¦g’â–Â?–†+šZ–¶_¾ò3’â7žR£¦7žV¯šVÓ–,(€€€€€€€€€€€€€€€€€€€€€€ƒ–ö#žª_¾ò#¦7žV¯šVÓ–/–ö#žª_šrš*+ž:§–ºÛš¶–r£žr,(€€€€€€€€€€€€€€€€€€€€€€ƒžj–"¦‚–Ÿ–ºç’æ’â¢ÖßšÒ_š:'¾ò3’æ/–&7š&7’þ»¦8(€€€€€€€€€€€€€€€€€€€€€€ƒ–B3’â¦†{–z/žj‰ÕŸ¾ò'Ž(€€€€€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰¡…É…Ñ•ÉÙ…Ñ…É1•Ù•°œ¬(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•à¬(€€€€€€€€€€€€€€€€€€€€œˆÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÁÁàí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€€€€€€€€€‰1Ø¸ˆ­¡…É…Ñ•È¹±•Ù•°¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€½¹ÍÐ•±¥¥‰±”ô(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•àôôôÄ(€€€€€€€€€€€€€€€€€€€€üÁ±…å•È¹±•Ù•°øôÄÀ(€€€€€€€€€€€€€€€€€€€€è¥ÍQ¡¥É‘¡…É…Ñ•ÉU¹±½­• ¤ì((€€€€€€€€€€€€€€€½¹ÍÐÕ¹±½­Q•áÐô(€€€€€€€€€€€€€€€€€€€Í±½Ñ%¹‘•àôôôÄ(€€€€€€€€€€€€€€€€€€€€ü€‰1Ø¸ÄÃ¢ž¦:Xˆ(€€€€€€€€€€€€€€€€€€€€è€‹–&7–§–B7žj1Ø¸ÔÀˆì(((€€€€€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰Ý¥‘Ñ èØÙÁàíÑ•áÐµ…±¥¸é•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€ÕÉÍ½ÈéÁ½¥¹Ñ•Èí½Á…¥Ñäèœ¬(€€€€€€€€€€€€€€€€€€€€¡•±¥¥‰±”üˆÄˆèˆ¸ÔÔˆ¤¬(€€€€€€€€€€€€€€€€€€€€œìˆ½¹±¥¬ôˆœ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€•±¥¥‰±”(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‰±½Í•!½µ••…ÑÕÉ” ¤í½Á•¹¡…É…Ñ•ÉÉ•…Ñ¥½¸ ˆ¬¡Í±½Ñ%¹‘•à¬Ä¤¬ˆ¤ìˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€œˆøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰Ý¥‘Ñ èÐÁÁàí¡•¥¡ÐèÐÁÁàíµ…É¥¸èÀ…ÕÑ¼ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈµÉ…‘¥ÕÌèÔÀ”í‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ð ÄØÁ‘•œ°ŒÈÐÅŒÄÈ°ŒÄÔÄÀÁ„¤ìœ¬(€€€€€€€€€€€€€€€€€€€€‰½É‘•ÈèÉÁà‘…Í¡•€Œá„Ù„Í„í‘¥ÍÁ±…äé™±•àí…±¥¸µ¥Ñ•µÌé•¹Ñ•Èìœ¬(€€€€€€€€€€€€€€€€€€€€©ÕÍÑ¥™äµ½¹Ñ•¹Ðé•¹Ñ•Èí™½¹ÐµÍ¥é”èÄÙÁàìˆøœ¬(€€€€€€€€€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí™½¹ÐµÝ•¥¡Ðé‰½±íµ…É¥¸µÑ½ÀèÉÁàìœ¬(€€€€€€€€€€€€€€€€€€€€½±½ÈèŒá„á„á„ìˆøœ¬(€€€€€€€€€€€€€€€€€€€€‹šr«¢ž¦:Xˆ¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÁÁàí½±½ÈèŒÝ„Ù˜ÕŒìˆøœ¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€•±¥¥‰±”(€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€‹¦î{šN+–&×–îèˆ(€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€Õ¹±½­Q•áÐ(€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€¡Ñµ°¬ô(€€€€€€€€ˆð½‘¥Øøˆì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7šb¿¢šš2'’â/–:ì(€€€€€€ƒ–"š>o–"Ã–:šr³¦‚¦v‹¾ò3šb¿¢ššVÓ–B#–"Ã–B3’â–,(€€€€€€ƒžV¯¦v‹¢Ž‡Ž7¾ò'¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡šb¿’â'–/Ž3–Â;¦‚Ž7š2'¦"W¾ò3¦î{’â/–:ïšr(€€€€€€ƒ¦^sš:'¦g–/¢š[žª_Ž¢ÞÏ–:ï¢3–2¿ž.š,¿š*¢ô(€€€€€€ƒ¦‚¦v‹ŽšRçš"C’â'–/Ž3–"¦‚Ž7š2'¦"W¾ò3¦î{’â/–:ì(€€€€€€ƒ–Fó–>­ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §ŠSŠS’â7šr¦^sš:$(€€€€€€ƒ¢š[žª_¾ò3šb¿š*+–Â7š'¦‚¦v‹žj–Ÿ–ºçŽ3–Ž7¦È(€€€€€€€¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ó¦g–/–ºç–f£¢Ž„(€€€€€€ƒ–:–rÃ¦†¿ž’ë¾ò3¢Þ’æ/–&7–žR£’âï–~;’òGš¼¿žÚO¦¦_šÆ€(€€€€€€ƒ–6‡ž&šb¿–B3’âš.o¾ò3–>«šb¿¦gš²‡–žjšb¿šVÓ¦‚Ž(€€€€¨¼((€€€¡Ñµ°¬ô((€€€€€€€€œñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…ÀèÙÁàíµ…É¥¸µ‰½ÑÑ½´èÙÁàìˆøœ¬((€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰¡…É…Ñ•ÉQ…‰	Ñ¹áÁA½½°ˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÙÁàí™½¹ÐµÍ¥é”èÄáÁàíµ¥¸µ¡•¥¡ÐèÔÉÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡p•áÁA½½±pœ¤ˆøœ¬(€€€€€€€€‹žÚO¦¦_šÆƒ–"¦4ˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰¡…É…Ñ•ÉQ…‰	Ñ¹MÑ…ÑÕÌˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÙÁàí™½¹ÐµÍ¥é”èÄáÁàíµ¥¸µ¡•¥¡ÐèÔÉÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡pÍÑ…ÑÕÍpœ¤ˆøœ¬(€€€€€€€€‹¢÷–*o–ðˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰¡…É…Ñ•ÉQ…‰	Ñ¹M­¥±°ˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÙÁàí™½¹ÐµÍ¥é”èÄáÁàíµ¥¸µ¡•¥¡ÐèÔÉÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ¡pÍ­¥±±pœ¤ˆøœ¬(€€€€€€€€‹š*¢ôˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3Ž3š*¢ô(€€€€€€€€€€ƒ¦‚¦v‹’â7¢÷š6Ë–.W¾ò3–Â;¢Ó’â/¦v‹š*¢÷žr,(€€€€€€€€€€ƒ’â7–"ÃŽ7¾ò'¾òh(€€€€€€€€€€ƒ–:šr±µ¥¸µ¡•¥¡Ó–¾¯š¶ìÐàÁÁã¾ò3–r (€€€€€€€€€€ƒš&/š¦ž?¢š÷–f£¾ò#–Â“–ÛžÚË–v–"_¦
¦†¿ž’ë¢F\(€€€€€€€€€€ƒžjM…µÍÕ¹œ	É½ÝÍ•Ë¾ò'–¾›¦jo–>¿¢šX(€€€€€€€€€€ƒ¦®c–ê›š¾S¢òž~»žjšf–g¾ò0ÐàÁÁã¦g–,(€€€€€€€€€€ƒ’â/¦fCž†³šb¿š¾Qµ…àµ¡•¥¡ÐèØÁ‘Ù£¦
(€€€€€€€€€€ƒ¦®c¾ò1MO¢š?–&¢Ž…µ¥¸µ¡•¥¡Ó–«–#š²((€€€€€€€€€€ƒš¾Qµ…àµ¡•¥¡Ó¦®c¾ò3ž¶'šZó¦g–/–ºç–f (€€€€€€€€€€ƒšÂã¦ƒ¢Ï–ÂDÐàÁÁã¦®c¾ò3¢Þ–’[–Æ(€€€€€€€€€€€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½ã¢«–ÞÄ(€€€€€€€€€€ƒžj¦®c–ê›’â+¦fC¾ò àÁ‘Ù£¾ò<¹Ý¥‘—šf(€€€€€€€€€€€äÙ‘Ù£¾ò'šNƒ–r£’â¢Öß¾ò3–ºçšbO–§–Æ“¦ô(€€€€€€€€€€ƒ¢Ú–ëŽ¢º+š"CŽ3–’[–Æ“–ºç–f ¯–Ÿ–Æ(€€€€€€€€€€ƒ–ºç–f£Ž7–§–/¦÷¢šš6Ë–.Wžj–Þ‹ž.š6Ë–.W¾ò0(€€€€€€€€€€ƒš&/š¦’â+–ú#–ºçšbO–6‡’ö?Žš¢šë–º3– (€€€€€€€€€€ƒš6Ë’â7–.WŽ((€€€€€€€€€€ƒšRçš"Aµ¥¸ ÐàÁÁà°ÔÁ‘Ù §ŠSŠS–Ÿ–ºä(€€€€€€€€€€ƒ¢ò–’kžj–"¦‚¾ò#¢÷–*o–ó¾ò'¦
šb¿žn‡¦<(€€€€€€€€€€ƒš*OšîüÐàÁÁã¦g–/žBšÏ–ó¾ò3’ö¢z‹–æT(€€€€€€€€€€ƒžržjž~»žjšf–gšr¢«–.W¢ºOš¶—¾ò0(€€€€€€€€€€ƒ’â7šrž†³šJC–ë–§–Æ“¦÷¢šš6Ë–.Wžj(€€€€€€€€€€ƒ¢†wžª¾ò3–B3šf–nƒž
ëš¾?š²‡žº_–ë’úžj(€€€€€€€€€€ƒ¦
šb¿–B3’â–/–në–ºk–ó¾ò#’â7šr–nƒž
è(€€€€€€€€€€ƒ–"–"¦‚¢3šRç¢º+¾ò'¾ò3–:šr³Ž3–"–"¦‚(€€€€€€€€€€ƒ–’Ÿ–Â?’â7¢ÞÏ–.WŽ7žj¦ršÆ¦
šb¿šr'’þwžVgŽ(€€€€€€€€¨¼((€€€€€€€€œñ‘¥Ø¥ô‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ðˆœ¬(€€€€€€€€ÍÑå±”ô‰™±•àèÄ€Ä…ÕÑ¼í¡•¥¡Ðé…ÕÑ¼íµ¥¸µ¡•¥¡ÐèÀíµ…àµ¡•¥¡Ðé¹½¹”í½Ù•É™±½Üµäé…ÕÑ¼í½Ù•É™±½Üµàé¡¥‘‘•¸ìµÝ•‰­¥Ðµ½Ù•É™±½ÜµÍÉ½±±¥¹œéÑ½Õ í½Ù•ÉÍÉ½±°µ‰•¡…Ù¥½Èµäé½¹Ñ…¥¸íÑ½Õ µ…Ñ¥½¸éÁ…¸µäí‰½àµÍ¥é¥¹œé‰½É‘•Èµ‰½àìˆøð½‘¥Øøœì(((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒš¾?š^—’îï–.d(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¦n‹žÞkžÚO¦¦\(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É=™™±¥¹•áÁ½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐ¡½ÕÉÌô((€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€½™™±¥¹•±…ÁÍ•‘5¥¹ÕÑ•Í½É¥ÍÁ±…ä¼ØÀ(€€€€€€€€¤ì((€€€½¹ÍÐµ¥¹ÕÑ•Ìô((€€€€€€€½™™±¥¹•±…ÁÍ•‘5¥¹ÕÑ•Í½É¥ÍÁ±…ä”(€€€€€€€€ØÀì(((€€€½¹ÍÐ…ÁÁ•‘9½Ñ¥”ô((€€€€€€€½™™±¥¹•±…ÁÍ•‘5¥¹ÕÑ•Í½É¥ÍÁ±…äø(€€€€€€€=1%9}aA}5a}5%9UQL(€€€€€€€€ü(€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½Èè”ààÌÙˆíµ…É¥¸µÑ½ÀèÑÁàìˆøœ¬(€€€€€€€€‹¾ò#¦n‹žÞkžÚO¦¦_šr–’k–>«¢¢#žº\ã–Â?šf¾ò3¢Ú¦;žj¦£–"’â7šr¦†7–’[žÒ¿ž¦7¾ò$ˆ¬(€€€€€€€€ˆð½‘¥Øøˆ(€€€€€€€€è(€€€€€€€€ˆˆì(((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àìˆøœ¬((€€€€€€€€‹¦n‹žÞkšf¦ZO¾òhˆ­¡½ÕÉÌ¬‹–Â?šfˆ­µ¥¹ÕÑ•Ì¬‹–"¦B`ñ‰Èøˆ¬((€€€€€€€€‹–>¿¦‚c–>[¦n‹žÞkžÚO¦¦_¾òhˆ¬(€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰½±½Èè˜ÁˆÐÈäí™½¹ÐµÝ•¥¡Ðé‰½±ìˆøœ¬(€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀ¬(€€€€€€€€ˆð½ÍÁ…¸øˆ¬(€€€€€€€€‰a@ˆ¬((€€€€€€€…ÁÁ•‘9½Ñ¥”¬((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèˆÍ„ÔáŒíµ…É¥¸µÑ½ÀèáÁàìˆøœ¬(€€€€€€€€‹¦n‹žÞkžÚO¦¦_šržnÓš:—–*ƒ¦Ë–ÇžR£žÚO¦¦_šÆƒ¾ò0ˆ¬(€€€€€€€€‹š¾?–"¦B`ˆ­=1%9}aA}AI}5%9UQ¬‹¦î{¾ò0ˆ¬(€€€€€€€€‹šr–’k¢¢#žº\ã–Â?šfŽˆ¬(€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰Ý¥‘Ñ èÄÀÀ”íµ…É¥¸µÑ½ÀèÄÉÁàíÁ…‘‘¥¹œèÄÁÁàìˆœ¬((€€€€€€€€ (€€€€€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀðôÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰‘¥Í…‰±•ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€€¤¬((€€€€€€€€½¹±¥¬ô‰±…¥µ=™™±¥¹•áÀ ¤ˆøœ¬((€€€€€€€€ (€€€€€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀðôÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹žn»–&7šÊKšr'–>¿¦‚c–>[žj¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¦‚c–>Xˆ­Á•¹‘¥¹=™™±¥¹•áÀ¬‹¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€¤¬((€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3žr/–î–F((€€€€€€€€€€ƒ¦ng–7¦‚c–>[Ž7žjž²³’â–/ž’ëž¾žR£šÎW¾ò'¾òh(€€€€€€€€€€ƒ–>«šr'–r£šr'švÇ¢–ÿ–>¿’î—¦‚c–>[žjšf–gš&7¦†¿ž’è(€€€€€€€€€€ƒ¦g¦†š2'¦"W¾ò3–Fó–>­Í¡½ÝI•Ý…É‘•‘ §¾ò0(€€€€€€€€€€ƒš"C–*žj…±±‰…¯¢Ž‡–Fó–>¬(€€€€€€€€€€±…¥µ=™™±¥¹•áÀ¡ÑÉÕ”§¾ò#–’k’â–,(€€€€€€€€€€ƒ–>šVã–F+¢¢Ó¦‚c–>[–÷–ò?Ž3¦gš²‡šb¿¦ng–7Ž7¾ò'Ž(€€€€€€€€¨¼((€€€€€€€€ ((€€€€€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀøÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬(€€€€€€€€€€€€ÍÑå±”ô‰Ý¥‘Ñ èÄÀÀ”íµ…É¥¸µÑ½ÀèáÁàíÁ…‘‘¥¹œèÄÁÁàìœ¬(€€€€€€€€€€€€‰…­É½Õ¹é±¥¹•…ÈµÉ…‘¥•¹Ð ÄàÁ‘•œ°˜ÁˆÐÈä°ŒäÜäÅ”¤ìœ¬(€€€€€€€€€€€€½±½ÈèŒÉ„ÄÜÀØìˆœ¬(€€€€€€€€€€€€½¹±¥¬ô‰±…¥µ=™™±¥¹•áÁ]¥Ñ¡ ¤ˆøœ¬(€€€€€€€€€€€€‹žr/–î–F+¦ng–7¦‚c–>[¾ò ˆ¬(€€€€€€€€€€€€¡Á•¹‘¥¹=™™±¥¹•áÀ¨È¤¬(€€€€€€€€€€€€‰aC¾ò$ˆ¬(€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ((€€€€€€€€¤((€€€€¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkžr/–î–F+¦ng–7¦‚c–>[žj–—–>¾ò3–Fó–>¬(€€ƒ¦kžR£žjÍ¡½ÝI•Ý…É‘•‘ §¾ò3š"C–*š&7žržj(€€ƒ¦ng–7žfóšRû¾ò3–’ÇšV\¿–>[šÚ#žj¢¦Ç’î¦êó¦÷’â7šr(€€ƒžfóžR¾ò#’â7šrš&’îï’öWšvÇ¢–ÿ¾ò3–>«šb¿šÊKš.ÿ–"À(€€ƒ¦ng–7–*ƒš"C¾ò3–:šr³šÊKžr/–î–F+žjš¶–âã¦‚c–>X(€€±…¥µ=™™±¥¹•áÀ §¦
šb¿–>¿’î—žŸ–âã’öÿžR£¾ò'Ž(¨¼()™Õ¹Ñ¥½¸±…¥µ=™™±¥¹•áÁ]¥Ñ¡ ¥ì((€€€¥˜¡Á•¹‘¥¹=™™±¥¹•áÀðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í¡½ÝI•Ý…É‘•‘ (€€€€€€€€ ¤ôùì((€€€€€€€€€€€±…¥µ=™™±¥¹•áÀ (€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€¤ì((€€€€€€€ô°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€…‘‘	…ÑÑ±•1½œ (€€€€€€€€€€€€€€€€‹–î–F+šr«žr/–º3¾ò3ž‡šÎW¦‚c–>[¦ng–7ž6;–.×Žˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì()ô(()™Õ¹Ñ¥½¸±…¥µ=™™±¥¹•áÀ (€€€¥Í½Õ‰±•(¥ì((€€€¥˜¡Á•¹‘¥¹=™™±¥¹•áÀðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òk–*ƒ’ê¥Í½Õ‰±•“¦g–/–>šVã¾ò0(€€€€€€ƒžr/–î–F+š"C–*šf–
ÍÑÉÕ—¾ò3–¾›¦jo–¶c–—žÚO¦¦_šÆ€(€€€€€€ƒžjšVã–¶_’æc’î”Ë¾òo’â¢"³šÊKžr/–î–F+žj¦‚c–>X(€€€€€€ƒžÚ·š2–:šr³šVã–¶_’â7¢º+Ž(€€€€¨¼((€€€½¹ÍÐÉ•Ý…É‘µ½Õ¹Ðô((€€€€€€€¥Í½Õ‰±•(€€€€€€€€ü(€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀ¨È(€€€€€€€€è(€€€€€€€Á•¹‘¥¹=™™±¥¹•áÀì(((€€€Í¡…É•‘áÀô(€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€É•Ý…É‘µ½Õ¹Ðì(((€€€…‘‘	…ÑÑ±•1½œ ((€€€€€€€€ (€€€€€€€€€€€¥Í½Õ‰±•(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹–î–F+¦ng–7¦‚c–>[¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¦‚c–>[¦n‹žÞkžÚO¦¦\ˆ(€€€€€€€€¤¬(€€€€€€€É•Ý…É‘µ½Õ¹Ð¬(€€€€€€€€‹¦î{¾ò3–ÞË–¶c–—žÚO¦¦_šÆƒŽˆ((€€€€¤ì(((€€€Á•¹‘¥¹=™™±¥¹•áÀô(€€€€€€€€Àì(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(((€€€¥˜¡‰½‘å°¥ì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É=™™±¥¹•áÁ½¹Ñ•¹Ð ¤ì((€€€ô()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3’îï–.gšRçš"C–§–,(€€ƒ–"¦‚¾òkš¾?š^—’îï–.g¾ò?–žS¢¢_’îï–.g¾ò'¾òh(€€ƒ–:šr±É•¹‘•ÉEÕ•ÍÑ½¹Ñ•¹Ð §šVÓšº×¦
?¢ò¿š*÷š"@(€€ƒ¦kžR£ž&#šr±É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ §¾ò0(€€ƒ–BŽ3š*¢÷–ºkžú§šâ–Z¸¿ž.š/ž&§’îØ¿¦‚c–>[–÷–ò<(€€ƒ–B7ž¢ÇŽ7’â'–/–>šVã¾ò3š¾?š^—’îï–.gŽ–žS¢¢_’îï–.d(€€ƒ–ÇžR£–B3’â’î÷šâËš~O¦
?¢ò¿¾ò3’â7žR£–¾¯–§š²‡–æû’æ8(€€ƒ’âš¢žjž¢/–ò?žŠóŽ(¨¼()™Õ¹Ñ¥½¸™½Éµ…ÑEÕ•ÍÑI•Ý…É¡É•Ý…É¥ì((€€€½¹ÍÐÁ…ÉÑÌõmtì((€€€¥˜¡É•Ý…É¹½±¥ì(€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€‹¦G–æŒ€ˆ­É•Ý…É¹½±(€€€€€€€€¤ì€€€ô((€€€¥˜¡É•Ý…É¹•áÀ¥ì(€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€‰a@€ˆ­É•Ý…É¹•áÀ(€€€€€€€€¤ì(€€€ô((€€€É•ÑÕÉ¸Á…ÉÑÌ¹©½¥¸ ‹Ž ˆ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XàäƒŠPƒ’îï–.g–º3š"C–ê›ž6;–.×¦ª£šzØ(€€€´€ÈÀ€¼€ÐÀ€¼€ØÀ€¼€àÀ€¼€ÄÀÀƒ’êS¦j;šº×Ž(€€€´ƒžn»–&7–>«–îëž®,U$ƒ¢"–º3š"C–ê›¢¢#žº_¾ò3’â7žfóšRû’îï’öWž6;–.×Ž’â7–¾¯–—–¶cšªSŽ(€€€´ƒ–º3š"C–ê›’úwŽ3š&šr'’îï–.gžn»š¢gžjžÒ¿ž¦7¦Ë–ê˜€¼ƒš&šr'žn»š¢gžâ÷¦?Ž7¢¢#žº_¾ò0(€€€€ƒ¢ºOš¾?š^”€Ìƒ’îï–.gŽ–žS¢¢\€Èƒ’îï–.g’æ¢÷¢«žÛ¢Þ£¦8€ÈÀ”ƒ¦j;šº×Ž(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)½¹ÍÐEUMQ}=5A1Q%=9}5%1MQ=9Lõl(€€€€ÈÀ°ÐÀ°ØÀ°àÀ°ÄÀÀ)tì(()™Õ¹Ñ¥½¸•ÑEÕ•ÍÑ½µÁ±•Ñ¥½¹A•É•¹Ð (€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€ÍÑ…Ñ”(¥ì((€€€±•ÐÑ½Ñ…±½…°ôÀì(€€€±•ÐÑ½Ñ…±AÉ½É•ÍÌôÀì((€€€‘•™¥¹¥Ñ¥½¹Ì¹™½É… ¡™Õ¹Ñ¥½¸¡ÅÕ•ÍÐ¥ì((€€€€€€€½¹ÍÐ½…°ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€9Õµ‰•È¡ÅÕ•ÍÐ¹½…°¥ñðÀ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐÁÉ½É•ÍÌô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÁÉ½É•ÍÍmÅÕ•ÍÐ¹¥‘t(€€€€€€€€€€€€€€€€¥ñðÀ(€€€€€€€€€€€€¤ì((€€€€€€€Ñ½Ñ…±½…°¬õ½…°ì(€€€€€€€Ñ½Ñ…±AÉ½É•ÍÌ¬ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€½…°°(€€€€€€€€€€€€€€€ÁÉ½É•ÍÌ(€€€€€€€€€€€€¤ì((€€€ô¤ì((€€€¥˜¡Ñ½Ñ…±½…°ðôÀ¥ì(€€€€€€€É•ÑÕÉ¸€ÄÀÀì(€€€ô((€€€É•ÑÕÉ¸5…Ñ ¹µ¥¸ (€€€€€€€€ÄÀÀ°(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€Ñ½Ñ…±AÉ½É•ÍÌ½Ñ½Ñ…±½…°¨ÄÀÀ(€€€€€€€€¤(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€ÍÑ…Ñ”(¥ì((€€€½¹ÍÐÁ•É•¹Ðô(€€€€€€€•ÑEÕ•ÍÑ½µÁ±•Ñ¥½¹A•É•¹Ð (€€€€€€€€€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€ÍÑ…Ñ”(€€€€€€€€¤ì((€€€½¹ÍÐ‘¥ÍÁ±…åA•É•¹Ðô(€€€€€€€5…Ñ ¹™±½½È¡Á•É•¹Ð¤ì((€€€½¹ÍÐµ¥±•ÍÑ½¹•Ìô(€€€€€€€EUMQ}=5A1Q%=9}5%1MQ=9L(€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡Ñ¡É•Í¡½±¥ì((€€€€€€€€€€€½¹ÍÐÉ•…¡•ô(€€€€€€€€€€€€€€€Á•É•¹ÐøõÑ¡É•Í¡½±ì((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµµ¥±•ÍÑ½¹”œ¬(€€€€€€€€€€€€€€€€€€€€¡É•…¡•€ü€ˆÉ•…¡•ˆ€è€ˆˆ¤¬œˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµµ¥±•ÍÑ½¹”µÁ•É•¹Ðˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€Ñ¡É•Í¡½±¬œ”œ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµµ¥±•ÍÑ½¹”µÍ±½Ðˆ…É¥„µ±…‰•°ô‹ž6;–.×–ú¢¢·–ºhˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸û–ú–ºhð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œð½‘¥Øøœ(€€€€€€€€€€€€¤ì((€€€€€€€ô¤(€€€€€€€€¹©½¥¸ ˆˆ¤ì((€€€É•ÑÕÉ¸€ (€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µ¡•…ˆøœ¬(€€€€€€€€€€€€œñÍÁ…¸û–º3š"C–ê›ž6;–.Ôð½ÍÁ…¸øœ¬(€€€€€€€€€€€€œñÍÑÉ½¹œøœ­‘¥ÍÁ±…åA•É•¹Ð¬œ”ð½ÍÑÉ½¹œøœ¬(€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µÑÉ…¬ˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µ™¥±°ˆÍÑå±”ô‰Ý¥‘Ñ èœ­Á•É•¹Ð¬œ”ìˆøð½‘¥Øøœ¬(€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µµ¥±•ÍÑ½¹•Ìˆøœ¬(€€€€€€€€€€€µ¥±•ÍÑ½¹•Ì¬(€€€€€€€€œð½‘¥Øøœ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ (€€€‘•™¥¹¥Ñ¥½¹Ì°(€€€ÍÑ…Ñ”°(€€€±…¥µ¹9…µ”(¥ì((€€€±•Ð¡Ñµ°ô(€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ±¥ÍÐˆøœì(((€€€‘•™¥¹¥Ñ¥½¹Ì¹™½É…  (€€€€€€€ÅÕ•ÍÐôùì((€€€€€€€€€€€½¹ÍÐÁÉ½É•ÍÌô(€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÁÉ½É•ÍÍl(€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹¥(€€€€€€€€€€€€€€€uñðÀì((€€€€€€€€€€€½¹ÍÐ±…¥µ•ô(€€€€€€€€€€€€€€€€„…ÍÑ…Ñ”¹±…¥µ•‘l(€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹¥(€€€€€€€€€€€€€€€tì((€€€€€€€€€€€½¹ÍÐ‘½¹”ô(€€€€€€€€€€€€€€€ÁÉ½É•ÍÌøõÅÕ•ÍÐ¹½…°ì((€€€€€€€€€€€½¹ÍÐÍ…™•AÉ½É•ÍÌô(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€ÁÉ½É•ÍÌ°(€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹½…°(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÁ•É•¹Ðô(€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹½…°øÀ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€ÄÀÀ°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€€¡ÁÉ½É•ÍÌ½ÅÕ•ÍÐ¹½…°¤¨ÄÀÀ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ÄÀÀì((€€€€€€€€€€€½¹ÍÐÍÑ…ÑÕÍQ•áÐô(€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–ÞË¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–>¿¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‹¦Ë¢†3’â´ˆì((€€€€€€€€€€€½¹ÍÐÍÑ…ÑÕÍ±…ÍÌô(€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰±…¥µ•ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰É•…‘äˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‰ÁÉ½É•ÍÌˆì((€€€€€€€€€€€½¹ÍÐ‰ÕÑÑ½¹Q•áÐô(€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹–ÞË¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¦‚c–>Xˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€‹šr«¦Sš"@ˆì((€€€€€€€€€€€¡Ñµ°¬ô(€€€€€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰ÅÕ•ÍÐµ…É€œ­ÍÑ…ÑÕÍ±…ÍÌ¬œˆøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ¡•…ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ¹…µ”ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹¹…µ”¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÍÑ…ÑÕÌ€œ­ÍÑ…ÑÕÍ±…ÍÌ¬œˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÕÍQ•áÐ¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ‘•ÍŒˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€ÅÕ•ÍÐ¹‘•ÍŒ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÁÉ½É•ÍÌµ±¥¹”ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸û¦Ë–ê˜ð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÑÉ½¹œøœ­Í…™•AÉ½É•ÍÌ¬œ€¼€œ­ÅÕ•ÍÐ¹½…°¬œð½ÍÑÉ½¹œøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÁÉ½É•ÍÌµÑÉ…¬ˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÁÉ½É•ÍÌµ™¥±°ˆÍÑå±”ô‰Ý¥‘Ñ èœ­Á•É•¹Ð¬œ”ìˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ…Éµ™½½Ðˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÉ•Ý…Éˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰ÅÕ•ÍÐµÉ•Ý…Éµ±…‰•°ˆûž6;–.Ôð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸øœ­™½Éµ…ÑEÕ•ÍÑI•Ý…É¡ÅÕ•ÍÐ¹É•Ý…É¤¬œð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰ÅÕ•ÍÐµ±…¥´µ‰Ñ¸ˆœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…‘½¹”ñð±…¥µ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€œ½¹±¥¬ôˆœ­±…¥µ¹9…µ”¬œ¡pœœ­ÅÕ•ÍÐ¹¥¬pœ¤ˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¹Q•áÐ¬(€€€€€€€€€€€€€€€€€€€€€€€€œð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€€€€€œð½Í•Ñ¥½¸øœì((€€€€€€€ô(€€€€¤ì(((€€€¡Ñµ°¬ô(€€€€€€€€ˆð½‘¥Øøˆì((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(()™Õ¹Ñ¥½¸É•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¥ì((€€€É•ÑÕÉ¸É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ (€€€€€€€‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”°(€€€€€€€€‰±…¥µ…¥±åEÕ•ÍÐˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¥ì((€€€É•ÑÕÉ¸É•¹‘•ÉEÕ•ÍÑ1¥ÍÑ•¹•É¥Œ (€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”°(€€€€€€€€‰±…¥µ½µµ¥ÍÍ¥½¹EÕ•ÍÐˆ(€€€€¤ì()ô()™Õ¹Ñ¥½¸•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”¥ì(€€€É•ÑÕÉ¸€¡‘•™¥¹¥Ñ¥½¹Íññmt¤¹™¥±Ñ•È¡™Õ¹Ñ¥½¸¡ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ÅÕ•ÍÐ€˜˜€…ÍÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÐ¹¥‘t€˜˜(€€€€€€€€€€€€¡9Õµ‰•È¡ÍÑ…Ñ”¹ÁÉ½É•ÍÍmÅÕ•ÍÐ¹¥‘t¥ñðÀ¤øõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡ÅÕ•ÍÐ¹½…°¥ñðÄ¤ì(€€€ô¤¹µ…À¡™Õ¹Ñ¥½¸¡ÅÕ•ÍÐ¥ìÉ•ÑÕÉ¸ÅÕ•ÍÐ¹¥ìô¤ì)ô()™Õ¹Ñ¥½¸ØÄÜÌØÅMå¹EÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸¡¥Í½µµ¥ÍÍ¥½¸¥ì(€€€½¹ÍÐ‰ÕÑÑ½¸ô ‰ÅÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸ˆ¤ì(€€€¥˜ …‰ÕÑÑ½¸¥ìÉ•ÑÕÉ¸ìô(€€€½¹ÍÐ‘•™¥¹¥Ñ¥½¹Ìõ¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìé‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìì(€€€½¹ÍÐÍÑ…Ñ”õ¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”é‘…¥±åEÕ•ÍÑMÑ…Ñ”ì(€€€½¹ÍÐ½Õ¹Ðõ•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”¤¹±•¹Ñ ì(€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ½Õ¹ÐðôÀì(€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðõ½Õ¹ÐøÀü‹’â¦6×¦‚c–>[¾ò ˆ­½Õ¹Ð¬‹¾ò$ˆè‹’â¦6×¦‚c–>Xˆì(€€€‰ÕÑÑ½¸¹½¹±¥¬õ¥Í½µµ¥ÍÍ¥½¸ýØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌéØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌì)ô()™Õ¹Ñ¥½¸ØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…” ¥ì(€€€½¹ÍÐ‰½‘äô ‰ÅÕ•ÍÑQ…‰	½‘äˆ¤ì(€€€¥˜ …‰½‘ä¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€½¹ÍÐ½µµ¥ÍÍ¥½¹	Ñ¸ô ‰ÅÕ•ÍÑQ…‰	Ñ¹½µµ¥ÍÍ¥½¸ˆ¤ì(€€€½¹ÍÐ¥Í½µµ¥ÍÍ¥½¸ô„„¡½µµ¥ÍÍ¥½¹	Ñ¸˜™½µµ¥ÍÍ¥½¹	Ñ¸¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤¤ì(€€€½¹ÍÐÍÉ½±±Q½Àõ‰½‘ä¹ÍÉ½±±Q½Àì(€€€‰½‘ä¹¥¹¹•É!Q50õ¥Í½µµ¥ÍÍ¥½¸ýÉ•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤éÉ•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤ì(€€€½¹ÍÐ½µÁ±•Ñ¥½¹A…¹•°ô ‰ÅÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•°ˆ¤ì(€€€¥˜¡½µÁ±•Ñ¥½¹A…¹•°¥ì(€€€€€€€½µÁ±•Ñ¥½¹A…¹•°¹¥¹¹•É!Q50õÉ•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìé‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”é‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€¤ì(€€€ô(€€€‰½‘ä¹ÍÉ½±±Q½ÀõÍÉ½±±Q½Àì(€€€ØÄÜÌØÅMå¹EÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸¡¥Í½µµ¥ÍÍ¥½¸¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì)ô)Ý¥¹‘½Ü¹ØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…”õØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…”ì((((¼¨(€€Xàç¾òk’îï–.g¢š[žª_ž
ëŽ3–në–ºkš¢gžÆ“–"\€¬ƒ–Ÿ–Æ“’îï–.gšâ–Z¸€¬ƒ–në–ºk–º3š"C–ê›ž6;–.×Ž7šzÛšž/Ž(€€€ÅÕ•ÍÑQ…‰	½‘äƒšb¿’îï–.g–R¿’â ÍÉ½±°½Ý¹•Ë¾òoš¢g¦†3¢"–§–/š¢gžÆ“’â7¢Þ¢F_š6ËŽ(¨¼)™Õ¹Ñ¥½¸É•¹‘•ÉEÕ•ÍÑQ…‰½¹Ñ•¹Ð¡…Ñ¥Ù•Q…ˆ¥ì((€€€½¹ÍÐ¥Í½µµ¥ÍÍ¥½¸ô(€€€€€€€…Ñ¥Ù•Q…ˆôôô‰½µµ¥ÍÍ¥½¸ˆì((€€€É•ÑÕÉ¸€ (€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ¥¹Ñ•É™…”ˆøœ¬((€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµÑ…‰ÌˆÉ½±”ô‰Ñ…‰±¥ÍÐˆ…É¥„µ±…‰•°ô‹’îï–.g–"¦†xˆøœ¬((€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÅÕ•ÍÑQ…‰	Ñ¹…¥±äˆ±…ÍÌô‰ÅÕ•ÍÐµÑ…ˆœ¬(€€€€€€€€€€€€€€€€€€€€ …¥Í½µµ¥ÍÍ¥½¸€ü€ˆ…Ñ¥Ù”ˆ€è€ˆˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œÉ½±”ô‰Ñ…ˆˆ…É¥„µÍ•±•Ñ•ôˆœ¬ …¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œ½¹±¥¬ô‰ÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ¡p‘…¥±åpœ¤ˆøœ¬(€€€€€€€€€€€€€€€€€€€€‹š¾?š^—’îï–.dˆ¬(€€€€€€€€€€€€€€€€œð½‰ÕÑÑ½¸øœ¬((€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÅÕ•ÍÑQ…‰	Ñ¹½µµ¥ÍÍ¥½¸ˆ±…ÍÌô‰ÅÕ•ÍÐµÑ…ˆœ¬(€€€€€€€€€€€€€€€€€€€€¡¥Í½µµ¥ÍÍ¥½¸€ü€ˆ…Ñ¥Ù”ˆ€è€ˆˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œÉ½±”ô‰Ñ…ˆˆ…É¥„µÍ•±•Ñ•ôˆœ¬¡¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ¤¬œˆœ¬(€€€€€€€€€€€€€€€€€€€€œ½¹±¥¬ô‰ÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ¡p½µµ¥ÍÍ¥½¹pœ¤ˆøœ¬(€€€€€€€€€€€€€€€€€€€€‹–žS¢¢_’îï–.dˆ¬(€€€€€€€€€€€€€€€€œð½‰ÕÑÑ½¸øœ¬((€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÅÕ•ÍÐµ‰…Ñ µ…Ñ¥½¹Ìˆøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÅÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸ˆ±…ÍÌô‰ÅÕ•ÍÐµ±…¥´µ…±°µ‰Ñ¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ€œ¬(€€€€€€€€€€€€€€€€€€€€¡•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì (€€€€€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ìé‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸ý½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”é‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤¹±•¹Ñ üœœè‘¥Í…‰±•€œ¤¬(€€€€€€€€€€€€€€€€€€€€½¹±¥¬ôˆœ¬¡¥Í½µµ¥ÍÍ¥½¸üØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌ ¤œèØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌ ¤œ¤¬œˆû’â¦6×¦‚c–>Xð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€œñ‘¥Ø¥ô‰ÅÕ•ÍÑQ…‰	½‘äˆ±…ÍÌô‰ÅÕ•ÍÐµÑ…ˆµ‰½‘äˆÉ½±”ô‰Ñ…‰Á…¹•°ˆøœ¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€É•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€É•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€€€€€œñ‘¥Ø¥ô‰ÅÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•°ˆ±…ÍÌô‰ÅÕ•ÍÐµ½µÁ±•Ñ¥½¸µÁ…¹•°ˆøœ¬(€€€€€€€€€€€€€€€É•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€œð½‘¥Øøœ¬((€€€€€€€€œð½‘¥Øøœ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ¡Ñ…‰9…µ”¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰ÅÕ•ÍÑQ…‰	½‘äˆ¤ì((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ¥Í½µµ¥ÍÍ¥½¸ô(€€€€€€€Ñ…‰9…µ”ôôô‰½µµ¥ÍÍ¥½¸ˆì((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ô(€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€ü(€€€€€€€É•¹‘•É½µµ¥ÍÍ¥½¹EÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤(€€€€€€€€è(€€€€€€€É•¹‘•É…¥±åEÕ•ÍÑ1¥ÍÑ½¹Ñ•¹Ð ¤ì((€€€½¹Ñ…¥¹•È¹ÍÉ½±±Q½Àô(€€€€€€€€Àì((€€€½¹ÍÐ½µÁ±•Ñ¥½¹A…¹•°ô(€€€€€€€€ ‰ÅÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•°ˆ¤ì((€€€¥˜¡½µÁ±•Ñ¥½¹A…¹•°¥ì((€€€€€€€½µÁ±•Ñ¥½¹A…¹•°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•ÉEÕ•ÍÑ½µÁ±•Ñ¥½¹A…¹•±½¹Ñ•¹Ð (€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì(€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì°(€€€€€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€€€€€€€€€ü½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€€€€€è‘…¥±åEÕ•ÍÑMÑ…Ñ”(€€€€€€€€€€€€¤ì((€€€ô((€€€½¹ÍÐ‘…¥±å	Ñ¸ô(€€€€€€€€ ‰ÅÕ•ÍÑQ…‰	Ñ¹…¥±äˆ¤ì((€€€½¹ÍÐ½µµ¥ÍÍ¥½¹	Ñ¸ô(€€€€€€€€ ‰ÅÕ•ÍÑQ…‰	Ñ¹½µµ¥ÍÍ¥½¸ˆ¤ì((€€€¥˜¡‘…¥±å	Ñ¸¥ì(€€€€€€€‘…¥±å	Ñ¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€€…¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€¤ì(€€€€€€€‘…¥±å	Ñ¸¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µÍ•±•Ñ•ˆ°(€€€€€€€€€€€€…¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ(€€€€€€€€¤ì(€€€ô((€€€¥˜¡½µµ¥ÍÍ¥½¹	Ñ¸¥ì(€€€€€€€½µµ¥ÍÍ¥½¹	Ñ¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ°(€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸(€€€€€€€€¤ì(€€€€€€€½µµ¥ÍÍ¥½¹	Ñ¸¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µÍ•±•Ñ•ˆ°(€€€€€€€€€€€¥Í½µµ¥ÍÍ¥½¸€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ(€€€€€€€€¤ì(€€€ô((€€€ØÄÜÌØÅMå¹EÕ•ÍÑ±…¥µ±±	ÕÑÑ½¸¡¥Í½µµ¥ÍÍ¥½¸¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3šZÃ–Š{–&¿šr°½	=ML(€€ƒ–§–/–Â;¢š÷–"_¦‚žn»¾ò3–B¢¨Ë–/–"¦‚¾ò'¾òh(€€ƒžn»–&7–>«–#–k–ëŽ3–"¦‚–"š>oŽ7¦g––_¦ª£šzÛ¢Þ|(€€ƒ¢ª«šb;šZ–¶_¾ò3–¾›¦jožj–&¿šr°½	=MOš"Ã¦²—¢š?–&(€€ƒ¾ò#š«ž&§–òß–ê›Žž6;–.×Žš¾?–’§¢÷š2Gš"Ã–æûš²‡Ž(€€ƒ¢Þž>ûšr'žÞÓ–*–6žj–Þ»žVÃšb¿’î¦êó¾ò'¦÷¦
šÊK–ºkš†#¾ò0(€€ƒž¶'’öÿžR£¢š>C’úo¢š?–&–ú3–7–¾›¦još:—’â+š"Ã¦²”(€€ƒ¦
?¢ò¿ŠSŠS¦g¢Ž‡–#žŠë’þw–"–"¦‚žj’î/¦v‹šb¼(€€ƒ¦kžj¾ò3’æ/–ú3¢šš>o–Ÿ–ºç–>«¦r¢ššRä(€€É•¹‘•Ë–÷–ò?¾ò3’â7žR£–.U!Q53žÖCšž/Ž(¨¼()™Õ¹Ñ¥½¸É•¹‘•ÉÕ¹•½¹Q…‰½¹Ñ•¹Ð¡Ñ…‰9…µ”¥ì((€€€¥˜¡Ñ…‰9…µ”ôôô‰…‰åÍÌˆ¥ì((€€€€€€€É•ÑÕÉ¸€ ((€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€‹šÞÇšÞ×–&¿šr³–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€€€€€ˆð½‘¥Øøˆ((€€€€€€€€¤ì((€€€ô(((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€‹š^—–âã–&¿šr³–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€ˆð½‘¥Øøˆ((€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡Õ¹•½¹Q…ˆ¡Ñ…‰9…µ”¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰‘Õ¹•½¹Q…‰½¹Ñ•¹Ðˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ô((€€€€€€€É•¹‘•ÉÕ¹•½¹Q…‰½¹Ñ•¹Ð (€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€¤ì(((€€€l‰…¥±äˆ°‰‰åÍÌ‰t¹™½É…  (€€€€€€€¹…µ”ôùì((€€€€€€€€€€€½¹ÍÐ‰Ñ¸ô(€€€€€€€€€€€€€€€€ ‰‘Õ¹•½¹Q…‰	Ñ¸ˆ­¹…µ”¤ì(((€€€€€€€€€€€¥˜¡‰Ñ¸¥ì((€€€€€€€€€€€€€€€‰Ñ¸¹ÍÑå±”¹½Á…¥Ñäô((€€€€€€€€€€€€€€€€€€€¹…µ”¹Ñ½1½Ý•É…Í” ¤ôôô(€€€€€€€€€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆ¸ÔÔˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì((€€€Ý¥¹‘½Ü¹ØÄÐáMå¹½¹Ñ•áÑ9…Ù¥…Ñ¥½¸ü¸ ¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•É	½ÍÍQ…‰½¹Ñ•¹Ð¡Ñ…‰9…µ”¥ì((€€€¥˜¡Ñ…‰9…µ”ôôô‰¡•±°ˆ¥ì((€€€€€€€É•ÑÕÉ¸€ ((€€€€€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€‹–rÃž6	=MO–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€€€€€ˆð½‘¥Øøˆ((€€€€€€€€¤ì((€€€ô(((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€‹–/’êé	=MO–Âkšr«¢¢·¢¢#–º3š"CŽˆ¬(€€€€€€€€ˆð½‘¥Øøˆ((€€€€¤ì()ô(()™Õ¹Ñ¥½¸ÍÝ¥Ñ¡	½ÍÍQ…ˆ¡Ñ…‰9…µ”¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•Èô(€€€€€€€€ ‰‰½ÍÍQ…‰½¹Ñ•¹Ðˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ô((€€€€€€€É•¹‘•É	½ÍÍQ…‰½¹Ñ•¹Ð (€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€¤ì(((€€€l‰A•ÉÍ½¹…°ˆ°‰!•±°‰t¹™½É…  (€€€€€€€¹…µ”ôùì((€€€€€€€€€€€½¹ÍÐ‰Ñ¸ô(€€€€€€€€€€€€€€€€ ‰‰½ÍÍQ…‰	Ñ¸ˆ­¹…µ”¤ì(((€€€€€€€€€€€¥˜¡‰Ñ¸¥ì((€€€€€€€€€€€€€€€‰Ñ¸¹ÍÑå±”¹½Á…¥Ñäô((€€€€€€€€€€€€€€€€€€€¹…µ”¹Ñ½1½Ý•É…Í” ¤ôôô(€€€€€€€€€€€€€€€€€€€Ñ…‰9…µ”(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆ¸ÔÔˆì((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì()ô(((()™Õ¹Ñ¥½¸±…¥µ…¥±åEÕ•ÍÐ¡ÅÕ•ÍÑ%¥ì((€€€½¹ÍÐÅÕ•ÍÐô((€€€€€€€‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€ÄôùÄ¹¥ôôõÅÕ•ÍÑ%(€€€€€€€€¤ì(((€€€¥˜ …ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ½É•ÍÌô((€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÍl(€€€€€€€€€€€ÅÕ•ÍÑ%(€€€€€€€uñðÀì(((€€€¥˜ (€€€€€€€ÁÉ½É•ÍÌñÅÕ•ÍÐ¹½…°ñð(€€€€€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘t(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‘…¥±åEÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘tô(€€€€€€€ÑÉÕ”ì(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹½±¥ì((€€€€€€€½±ô(€€€€€€€€€€€½±¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹½±ì((€€€ô(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹•áÀ¥ì((€€€€€€€Í¡…É•‘áÀô(€€€€€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹•áÀì((€€€ô(((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òkšRçš"C–>«¦7žæ¨ÅÕ•ÍÑQ…‰	½‘ä(€€€€€€ƒ¦g–/–ºç–f£¾ò#žÚ·š2–r£Ž3š¾?š^—’îï–.gŽ7–"¦‚¾ò'¾ò0(€€€€€€ƒ’â7–7šVÓ–/¢š[žª_¦7’úŠSŠQÉ•¹‘•ÉEÕ•ÍÑ½¹Ñ•¹Ð ¤(€€€€€€ƒ¦g–/¢"+–÷–ò?–ÞËžÚOš.š"C–§–/–"¦‚–B¢«žj(€€€€€€ƒšâËš~O–÷–ò?¾ò3’â7–¶c–r£’êŽ(€€€€¨¼(€€€¥˜ …Ý¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´¥ìÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ ‰‘…¥±äˆ¤ìô()ô(()™Õ¹Ñ¥½¸±…¥µ½µµ¥ÍÍ¥½¹EÕ•ÍÐ¡ÅÕ•ÍÑ%¥ì((€€€½¹ÍÐÅÕ•ÍÐô((€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€ÄôùÄ¹¥ôôõÅÕ•ÍÑ%(€€€€€€€€¤ì(((€€€¥˜ …ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ½É•ÍÌô((€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹ÁÉ½É•ÍÍl(€€€€€€€€€€€ÅÕ•ÍÑ%(€€€€€€€uñðÀì(((€€€¥˜ (€€€€€€€ÁÉ½É•ÍÌñÅÕ•ÍÐ¹½…°ñð(€€€€€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘t(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”¹±…¥µ•‘mÅÕ•ÍÑ%‘tô(€€€€€€€ÑÉÕ”ì(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹½±¥ì((€€€€€€€½±ô(€€€€€€€€€€€½±¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹½±ì((€€€ô(((€€€¥˜¡ÅÕ•ÍÐ¹É•Ý…É¹•áÀ¥ì((€€€€€€€Í¡…É•‘áÀô(€€€€€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€€€€€ÅÕ•ÍÐ¹É•Ý…É¹•áÀì((€€€ô(((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(€€€¥˜ …Ý¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´¥ìÍÝ¥Ñ¡EÕ•ÍÑQ…ˆ ‰½µµ¥ÍÍ¥½¸ˆ¤ìô()ô(()™Õ¹Ñ¥½¸ØÄÜÌØÅ±…¥µ±±EÕ•ÍÑÉ½ÕÀ¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”±±…¥µ¸±Ñ¥Ñ±”¥ì(€€€½¹ÍÐ¥‘Ìõ•Ñ±…¥µ…‰±•EÕ•ÍÑ%‘Ì¡‘•™¥¹¥Ñ¥½¹Ì±ÍÑ…Ñ”¤ì(€€€¥˜ …¥‘Ì¹±•¹Ñ ¥ìØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…” ¤ìÉ•ÑÕÉ¸€Àìô(€€€Ý¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´õÑÉÕ”ì(€€€ÑÉåì¥‘Ì¹™½É… ¡™Õ¹Ñ¥½¸¡¥¥ì±…¥µ¸¡¥¤ìô¤ìô(€€€™¥¹…±±åìÝ¥¹‘½Ü¹}}ØÄÜÌØÅ	Õ±­EÕ•ÍÑ±…¥´õ™…±Í”ìô(€€€ØÄÜÌØÅI•™É•Í¡=Á•¹EÕ•ÍÑA…” ¤ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ù½¥Ý¥¹‘½Ü¹ÉÁ±•ÉÐ ‹–ÞË’â¦6×¦‚c–>X€ˆ­¥‘Ì¹±•¹Ñ ¬ˆƒ–,ˆ­Ñ¥Ñ±”¬‹ž6;–.×Žˆ±íÑ¥Ñ±”éÑ¥Ñ±”¬‹ž6;–.Ôˆ±½¹™¥ÉµQ•áÐè‹ž~—¦O’êˆ±Ñ½¹”è‰ÍÕ•ÍÌ‰ô¤ì(€€€ô(€€€É•ÑÕÉ¸¥‘Ì¹±•¹Ñ ì)ô)™Õ¹Ñ¥½¸ØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌ ¥ì(€€€É•ÑÕÉ¸ØÄÜÌØÅ±…¥µ±±EÕ•ÍÑÉ½ÕÀ¡‘…¥±åEÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì±‘…¥±åEÕ•ÍÑMÑ…Ñ”±±…¥µ…¥±åEÕ•ÍÐ°‹š¾?š^—’îï–.dˆ¤ì)ô)™Õ¹Ñ¥½¸ØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌ ¥ì(€€€É•ÑÕÉ¸ØÄÜÌØÅ±…¥µ±±EÕ•ÍÑÉ½ÕÀ¡½µµ¥ÍÍ¥½¹EÕ•ÍÑ•™¥¹¥Ñ¥½¹Ì±½µµ¥ÍÍ¥½¹EÕ•ÍÑMÑ…Ñ”±±…¥µ½µµ¥ÍÍ¥½¹EÕ•ÍÐ°‹–žS¢¢_’îï–.dˆ¤ì)ô)Ý¥¹‘½Ü¹ØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌõØÄÜÌØÅ±…¥µ±±…¥±åEÕ•ÍÑÌì)Ý¥¹‘½Ü¹ØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌõØÄÜÌØÅ±…¥µ±±½µµ¥ÍÍ¥½¹EÕ•ÍÑÌì((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒš"C–ÂÄ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É¡¥•Ù•µ•¹Ñ½¹Ñ•¹Ð ¥ì((€€€±•Ð¡Ñµ°ô(€€€€€€€€ˆˆì(((€€€…¡¥•Ù•µ•¹Ñ•™¥¹¥Ñ¥½¹Ì¹™½É…  (€€€€€€€…¡¥•Ù•µ•¹Ðôùì((€€€€€€€€€€€½¹ÍÐ‘½¹”ô((€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¡•¬ ¤ì(((€€€€€€€€€€€½¹ÍÐ±…¥µ•ô((€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹ÑMÑ…Ñ•l(€€€€€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¥(€€€€€€€€€€€€€€€tì(((€€€€€€€€€€€½¹ÍÐÉ•Ý…É‘Q•áÐô((€€€€€€€€€€€€€€€=‰©•Ð¹­•åÌ (€€€€€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹É•Ý…É(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€€­•äôø(€€€€€€€€€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹É•Ý…É‘m­•åt¬ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ‹Žˆ¤ì(((€€€€€€€€€€€¡Ñµ°¬ô((€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µÉ½Üˆøœ¬((€€€€€€€€€€€€€€€€ˆñÍÁ…¸øˆ¬(€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¹…µ”¬(€€€€€€€€€€€€€€€€ˆñ‰Èøˆ¬(€€€€€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÅÁàí½±½ÈèˆÍ„ÔáŒìˆøœ¬(€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹‘•ÍŒ¬(€€€€€€€€€€€€€€€€‹ž6;–.×¾òhˆ­É•Ý…É‘Q•áÐ¬(€€€€€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬(€€€€€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆœ¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€…‘½¹”ñð±…¥µ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‰‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤¬((€€€€€€€€€€€€€€€€½¹±¥¬ô‰±…¥µ¡¥•Ù•µ•¹Ð¡pœœ¬(€€€€€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹¥¬(€€€€€€€€€€€€€€€€pœ¤ˆøœ¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€±…¥µ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹–ÞË¦‚c–>Xˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€‘½¹”(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹¦‚c–>Xˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€‹šr«¦Sš"@ˆ(€€€€€€€€€€€€€€€€¤¬((€€€€€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆì((€€€€€€€ô(€€€€¤ì(((€€€É•ÑÕÉ¸¡Ñµ°ì()ô(()™Õ¹Ñ¥½¸±…¥µ¡¥•Ù•µ•¹Ð¡…¡¥•Ù•µ•¹Ñ%¥ì((€€€½¹ÍÐ…¡¥•Ù•µ•¹Ðô((€€€€€€€…¡¥•Ù•µ•¹Ñ•™¥¹¥Ñ¥½¹Ì¹™¥¹ (€€€€€€€€€€€„ôù„¹¥ôôõ…¡¥•Ù•µ•¹Ñ%(€€€€€€€€¤ì(((€€€¥˜ ……¡¥•Ù•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€€……¡¥•Ù•µ•¹Ð¹¡•¬ ¤ñð(€€€€€€€…¡¥•Ù•µ•¹ÑMÑ…Ñ•m…¡¥•Ù•µ•¹Ñ%‘t(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€…¡¥•Ù•µ•¹ÑMÑ…Ñ•m…¡¥•Ù•µ•¹Ñ%‘tô(€€€€€€€ÑÉÕ”ì(((€€€¥˜¡…¡¥•Ù•µ•¹Ð¹É•Ý…É¹½±¥ì((€€€€€€€½±ô(€€€€€€€€€€€½±¬(€€€€€€€€€€€…¡¥•Ù•µ•¹Ð¹É•Ý…É¹½±ì((€€€ô((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(((€€€¥˜¡‰½‘å°¥ì((€€€€€€€‰½‘å°¹¥¹¹•É!Q50ô(€€€€€€€€€€€É•¹‘•É¡¥•Ù•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€ô()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ–³–F((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¥ì((€€€½¹ÍÐÉ•±•…Í•UÁ‘…Ñ”ô(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”ì((€€€¥˜ (€€€€€€€É•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€ÑåÁ•½˜É•±•…Í•UÁ‘…Ñ”¹É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€½¹ÍÐÉ•±•…Í•½¹Ñ•¹Ðô(€€€€€€€€€€€É•±•…Í•UÁ‘…Ñ”¹É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¤ì((€€€€€€€¥˜¡É•±•…Í•½¹Ñ•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸É•±•…Í•½¹Ñ•¹Ðì(€€€€€€€ô(€€€ô((€€€É•ÑÕÉ¸€ ((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÍÁàí±¥¹”µ¡•¥¡ÐèÄ¸àìˆøœ¬((€€€€€€€€‹’âï–~;–£šZÃšRçž&#¾òñ‰Èøˆ¬(€€€€€€€€‹šZÃ–Š{–V–ê_Ž–r[¦FGŽš¾?š^—’îï–.gŽš"C–ÂÇžÎïžÖÇ¾ò0ˆ¬(€€€€€€€€‹š¶‡¢þ;š‹š‹¦o¦oŽñ‰Èøñ‰Èøˆ¬((€€€€€€€€‹¦Z/žfó’â·–*¢÷¾òhñ‰Èøˆ¬(€€€€€€€€‹šnÓ–’k¢Žw–
gŽšnÓ–’k–rÃ–6ŽšnÓ–’kš*¢÷¾ò0ˆ¬(€€€€€€€€‹¦fãžê3šnÓšZÃ’â·Žˆ¬((€€€€€€€€ˆð½‘¥Øøˆ((€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉMåÍÑ•µ½¹Ñ•¹Ð ¥ì((€€€É•ÑÕÉ¸€ (€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°ˆøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû¦+š"Ë–¶cšªPð½ÍÑÉ½¹œøñÍµ…±°ûžn»–&7¦+š"Ëšr¢«–.W–¶cšªS¾ò3’æ–>¿’î—ž®/–6Ïš&/–.W’þw–¶cŽð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰Í…Ù•…µ” ¤í…±•ÉÐ¡pŸ–ÞË–º3š"Cš&/–.W–¶cšªSŽ	pœ¤ˆûž®/–6Ï–¶cšªPð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû–âÏ¢fžº‡žBð½ÍÑÉ½¹œøñÍµ…±°ûš~—žr/žn»–&4¥É•‰…Í”U%Žžfï–ëš"[–"š>o–âÏ¢fŽð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä˜™Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä¹½Á•¹½Õ¹Ñ5…¹…•È ¤ˆû–"š>o–âÏ¢f¾ò?žÚ–ºk–âÏ¢f|ð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû–º‹šr7’þ‡žºÄð½ÍÑÉ½¹œøñÍµ…±°ûš~—žr/Ž+–no¢Æ‡šÆšæ[–
ÏŽ/–º‹šr7¢¿žÖ‡šZç–ò?Žð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰ÍåÍÑ•µMÕÁÁ½ÉÑµ…¥±	ÕÑÑ½¸ˆ±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÕÁÁ½ÉÐ¹Í¡½Ü ¤ˆûš~—žr/’þ‡žºÄð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ÍåÍÑ•´µÁ…¹•°µÉ½Ü‘…¹•Èˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œû–"«¦f“¢žK¢&Èð½ÍÑÉ½¹œøñÍµ…±°û–"«¦f“–£¦£¢žK¢&Ë¢"¦+š"Ë¦Ë–ê›¾ò3¢þS–n{–"w–ž/–&×¢žK¦‚¦v‹Žð½Íµ…±°øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ½¹±¥¬ô‰É•Í•Ñ…µ” ¤ˆû–"«¦f“¢žK¢&Èð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€œð½‘¥Øøœ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸É•ÍÑÑ!½µ” ¥ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š"Ã¦²—’â·ž‡šÎW’òGš¿Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ¹••‘ÍI•ÍÐõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹Í½µ”¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤ì(€€€€€€€É•ÑÕÉ¸¡…É…Ñ•È¹¡ÀñÍÑ…ÑÌ¹µ…á!@ñð¡…É…Ñ•È¹ÍÀñÍÑ…ÑÌ¹µ…áM@ì(€€€ô¤ì((€€€¥˜ …¹••‘ÍI•ÍÐ¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‰!CŽM@ƒ–ÞËžÚOšb¿šîÿžj’êŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹™½É… ¡¥¹‘•àôùì(€€€€€€€½¹ÍÐ¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤ì(€€€€€€€½¹ÍÐÍÑ…ÑÌõ•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤ì(€€€€€€€¡…É…Ñ•È¹¡ÀõÍÑ…ÑÌ¹µ…á!@ì(€€€€€€€¡…É…Ñ•È¹ÍÀõÍÑ…ÑÌ¹µ…áM@ì(€€€ô¤ì(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€…±•ÉÐ (€€€€€€€€‹’òGš¿–º3žV‹¾ò1!C¾ò=M@ƒ–ÞËžÚO–£¦£¢ŽsšîÿŽˆ(€€€€¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XäÈƒŠPƒ’âï–~;¦Z/žfóšâ³¢¦›–þ¯š6ß¦6Ô(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑ½±‘5¥±±¥½¸ ¥ì(€€€½±ô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡½±¥ñðÀ¤¤¬(€€€€€€€QMQ}=1}I9Pì((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(€€€ÕÁ‘…Ñ•U$ ¤ì(€€€Í…Ù•…µ” ¤ì((€€€…±•ÉÐ (€€€€€€€€‹¦G–æŒ€¬Ä°ÀÀÀ°ÀÀÃ¾ò3žn»–&7–Çšr$€ˆ¬(€€€€€€€½±¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤¬(€€€€€€€€ˆƒ¦G–æŽˆ(€€€€¤ì)ô()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑáÁQ•¹5¥±±¥½¸ ¥ì(€€€Í¡…É•‘áÀô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Í¡…É•‘áÀ¥ñðÀ¤¤¬(€€€€€€€QMQ}aA}A==1}I9Pì((€€€ÕÁ‘…Ñ•U$ ¤ì(€€€Í…Ù•…µ” ¤ì((€€€…±•ÉÐ (€€€€€€€€‹žÚO¦¦_šÆ€€¬Ä°ÀÀÀ°ÀÀÀ°ÀÀÃ¾ò3žn»–&7–Çšr$€ˆ¬(€€€€€€€Í¡…É•‘áÀ¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤¬(€€€€€€€€ˆaCŽˆ(€€€€¤ì)ô()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•!½µ•Q•ÍÑQ½½±Ì ¥ì(€€€½¹ÍÐ½±‘	ÕÑÑ½¸ô ‰Ñ•ÍÑ½±‘5¥±±¥½¹	ÕÑÑ½¸ˆ¤ì(€€€½¹ÍÐ•áÁ	ÕÑÑ½¸ô ‰Ñ•ÍÑáÁQ•¹5¥±±¥½¹	ÕÑÑ½¸ˆ¤ì((€€€¥˜¡½±‘	ÕÑÑ½¸¥ì(€€€€€€€½±‘	ÕÑÑ½¸¹¥¹¹•É!Q50ô‹¦G–æŒ€ñˆø¬ÄÀÃ¢B°ð½ˆøˆì(€€€ô((€€€¥˜¡•áÁ	ÕÑÑ½¸¥ì(€€€€€€€•áÁ	ÕÑÑ½¸¹¥¹¹•É!Q50ô‹žÚO¦¦_šÆ€€ñˆø¬ÄÃ–ð½ˆøˆì(€€€ô)ô(((¼¨(€€ƒŠbƒšâ³¢¦›žR£¾òkš*¢÷¦îx€¬ääçŽ((€€ƒžÒSžÊçšZç’úÿ’öƒšâ³¢¦›š*¢÷šV#šzs¾ò#–Â“–Ûšb¿žžK¦gž¢¸(€€ƒ¦r¢š’â¢Þ¿–6žÒkš&7žr/–ú_–ë–Þ»žVÃžjš*¢÷¾ò'¾ò0(€€ƒ’æ/–ú3š¶–ò?ž&#’â+žÞk–&7¢¢c–ú_š*+¦g–ò×–6‡ž&(€€ƒ¢Þ¦g–/–÷–ò?’â¢Ößš.ÿš:'Ž(¨¼()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑM­¥±±A½¥¹ÑÌ ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡–¾¯š¶ï–>«–*ƒžÖ™Á±…å•Ë¾ò#ž²³’â¢žK¢&Ë¾ò'¾ò0(€€€€€€ƒž²³’ê3¢žK¢&ËšÂã¦ƒšâ³¢¦›’â7–"ÃŽ3žÖ›¦î{šVãŽ7¦g–/š2'¦"W¾ò0(€€€€€€ƒ–ºçšbO¢ºO’êë¢ª“’î—ž
ëž²³’ê3¢žK¢&Ëžjš*¢÷¦î{šb¿–ú{–"—žj–rÃšZä(€€€€€€ƒ¾ò#žRk¢Í‰ÕŸ¾ò'–K–ë’úžjŽ(€€€€€€ƒšRçš"AÁ±…å•ÈË–¶c–r£žj¢¦Ç–§¦
+¦÷–B–*€ääç¾ò0(€€€€€€ƒšâ³¢¦›–N«–/¢žK¢&Ë¦÷šZç’úÿŽ(€€€€¨¼((€€€Á±…å•È¹Í­¥±±A½¥¹ÑÌ¬ôäääì(((€€€±•Ðµ•ÍÍ…”ô((€€€€€€€€‹š*¢÷¦îx€¬ääç¾ò3Ž0ˆ¬(€€€€€€€€¡Á±…å•È¹¥‘ñð‹ž²³’â¢žK¢&Èˆ¤¬(€€€€€€€€‹Ž7žn»–&7–Çšr$ˆ¬(€€€€€€€Á±…å•È¹Í­¥±±A½¥¹ÑÌ¬(€€€€€€€€‹¦î{Žˆì(((€€€¥˜¡Á±…å•ÈÈ¥ì((€€€€€€€Á±…å•ÈÈ¹Í­¥±±A½¥¹ÑÌ¬ôäääì(((€€€€€€€µ•ÍÍ…”¬ô((€€€€€€€€€€€€‰q»Ž0ˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹Ž7žn»–&7–Çšr$ˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹Í­¥±±A½¥¹ÑÌ¬(€€€€€€€€€€€€‹¦î{Žˆì((€€€ô((€€€¥˜¡Á±…å•ÈÌ¥ì((€€€€€€€Á±…å•ÈÌ¹Í­¥±±A½¥¹ÑÌ¬ôäääì((€€€€€€€µ•ÍÍ…”¬ô(€€€€€€€€€€€€‰q»Ž0ˆ¬(€€€€€€€€€€€Á±…å•ÈÌ¹¥¬(€€€€€€€€€€€€‹Ž7žn»–&7–Çšr$ˆ¬(€€€€€€€€€€€Á±…å•ÈÌ¹Í­¥±±A½¥¹ÑÌ¬(€€€€€€€€€€€€‹¦î{Žˆì((€€€ô(((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€…±•ÉÐ (€€€€€€€µ•ÍÍ…”(€€€€¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#šâ³¢¦›žR£¾ò'¾òkžÚO¦¦_šÆ€€¬ÄÀÀÀÀÃŽ((€€ƒžÒSžÊçšZç’úÿšâ³¢¦›–6žÒkŽš*¢÷¦Z/šRû¦Zšªï¦g¦†x(€€ƒ¦r¢šžÞÓ–*žÞÓ–ú#’æš&7žr/–ú_–"ÃšV#šzsžjšvÇ¢–ÿ¾ò0(€€ƒžnÓš:—š*+žÚO¦¦_–¶c¦Ë–ÇžR£žÚO¦¦_šÆƒ¾ò0(€€ƒ’æ/–ú3¢š’â7¢š–"žÖ›¢žK¢&Ë¦
šb¿žŸ–:šr³žjšZç–ò<(€€ƒ¢«–ÞÇ–:ï–"¦7Ž’æ/–ú3š¶–ò?ž&#’â+žÞk–&7¢¢c–ú\(€€ƒš*+¦g–/š2'¦"W¢Þ¦g–/–÷–ò?’â¢Ößš.ÿš:'Ž(¨¼()™Õ¹Ñ¥½¸É…¹ÑQ•ÍÑáÀ ¥ì((€€€Í¡…É•‘áÀ¬ôÄÀÀÀÀÀì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì(((€€€…±•ÉÐ (€€€€€€€€‹žÚO¦¦_šÆ€€¬ÄÀÀÀÀÃ¾ò3žn»–&7–Çšr$ˆ¬(€€€€€€€Í¡…É•‘áÀ¬(€€€€€€€€‹¦î{žÚO¦¦_–óŽˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•È ¥ì((€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È (€€€€€€€Á±…å•È(€€€€¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk–"¦7žÚO¦¦_–óžÖ›ž²³’ê3¢žK¢&ËŽ(€€ƒ¢Þ}‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•È §šb¿–B3’â––_¦
?¢ò¿¾ò0(€€ƒžnÓš:—–Fó–>¯–ÇžR£–÷–ò?¾ò3–>«šb¿š>o’â–/¢žK¢&Ëž&§’îÛŽ(¨¼()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÈ ¥ì((€€€¥˜ …Á±…å•ÈÈ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È (€€€€€€€Á±…å•ÈÈ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÌ ¥ì((€€€¥˜ …Á±…å•ÈÌ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È (€€€€€€€Á±…å•ÈÌ(€€€€¤ì()ô(((¼¨(€€ƒš*)‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•È §–:šr³žj¦
?¢ò¼(€€ƒš*÷š"C¦kžR£–÷–ò?¾ò1Á±…å•È½Á±…å•ÈË–ÇžR£–B3’â––_¾ò0(€€ƒ’â7žR£žÚ·¢¶ß–§’î÷–æû’æ;’âš¢žjž¢/–ò?žŠóŽ(¨¼()™Õ¹Ñ¥½¸‘¥ÍÑÉ¥‰ÕÑ•áÁQ½¡…É…Ñ•È¡¡…É…Ñ•È¥ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š"Ã¦²—’â·ž‡šÎW–"¦7žÚO¦¦_–óŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜¡Í¡…É•‘áÀðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³šb¿š*+žÚO¦¦_šÆƒŽ3–£¦£Ž7’âš²‡–†{žÖ›¢žK¢&Ë¾ò0(€€€€€€ƒ–>¿¢÷’âš²‡¦žê3–6––÷–æûžÒk¾ò0(€€€€€€ƒ¢3’âSšrš*+žÚO¦¦_šÆƒšâž¦ë¾ò0(€€€€€€ƒ–Â;¢Óž:§–ºÛšÊK¢ú›šÎWš*+–&§’â/žjžÚO¦¦\(€€€€€€ƒžVgžÖ›–Û’î[¢žK¢&ËŽ((€€€€€€ƒšRçš"C¾òkš¾?š2'’âš²‡¾ò3–>«¢ö'žžïŽ3–&o––÷–6’â+’â/’âžÒkŽ4(€€€€€€ƒš&¦r¢šžjžÚO¦¦_–ó¾ò3’âš²‡–>«–6’âžÒkŽ(€€€€€€ƒ–ššzsžÚO¦¦_šÆƒ’â7–’ƒ–6’âžÒk¾ò0(€€€€€€ƒ–ÂÇ’â7¢ö'žžïŽš>Cž’ë¦
–Þ»–’k–ÂG¾ò0(€€€€€€ƒ¦ÿ–7žÚO¦¦_–ó–6‡–r£’â–/’â7’â+’â7’â/žjž.š/Ž((€€€€€€ƒŠbƒšZÃ–Š{¦bË–F¾òh(€€€€€€ƒ–ššzs¢žK¢&Ëžj•áÃ’â7ž~—¦Ož
ë’î¦êó–ÞËžÚO¢Ú¦9•áÁ9•áÐ(€€€€€€ƒ¾ò#žB¢®[’â+’â7¢¦ËžfóžR¾ò3’ö–¶cšªS–>¿¢÷–nƒž
ëš~C’êošN7’öp(€€€€€€ƒžVg’â/’â7’â¢Óžj¢ÎšZg¾ò'¾ò1¹••‘•“šr¢º+š"C¢ÊƒšVãš"XÃ¾ò0(€€€€€€ƒ¦gš¢Ž1Í¡…É•‘áÀñ¹••‘•“Ž7¦g–/–"“šZßšÂã¦ƒšb½™…±Í—¾ò0(€€€€€€ƒž¶'šZóžf÷žf÷–ú{žÚO¦¦_šÆƒ¦
¢Ž‡Ž3–ßŽ7–"Á•áÃ¾ò0(€€€€€€ƒ¦
–>¿¢÷¢ºM¡•­1•Ù•±UÀ §’âš²‡¢ÞG–ú#–’k¢ò«¾ò0(€€€€€€ƒž3–ë¦n‹¢¶sžjš*¢÷¦îx¿–Æ³šŸ¦î{šVã–¶_Ž(€€€€€€ƒ¦g¢Ž‡–#š*)¹••‘•“–’û–r£šr–Â<Ç¾ò0(€€€€€€ƒ–úç–êW¦ÿ–7¦g–/šò?šÒ{Ž(€€€€¨¼((€€€½¹ÍÐ¹••‘•€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€Ä°(€€€€€€€€€€€¡…É…Ñ•È¹•áÁ9•áÐ´(€€€€€€€€€€€¡…É…Ñ•È¹•áÀ(€€€€€€€€¤ì(((€€€¥˜¡Í¡…É•‘áÀñ¹••‘•¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹žÚO¦¦_šÆƒ’â7¢ÚÏ’î—–6žÒk¾ò3¦
–Þ¸ˆ¬(€€€€€€€€€€€€¡¹••‘•µÍ¡…É•‘áÀ¤¬(€€€€€€€€€€€€‰aCŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¡…É…Ñ•È¹•áÀ€¬ô(€€€€€€€¹••‘•ì((€€€Í¡…É•‘áÀ€´ô(€€€€€€€¹••‘•ì(((€€€¡•­1•Ù•±UÀ (€€€€€€€¡…É…Ñ•È(€€€€¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐ ¥ì((€€€½¹ÍÐ½¹Ñ…¥¹•È€ô(€€€€€€€€ ‰•áÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐˆ¤ì(((€€€¥˜ …½¹Ñ…¥¹•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹Ñ…¥¹•È¹¥¹¹•É!Q50ôˆˆì(((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í•l(€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€uñð(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í”¹™¥É”ì(((€€€½¹ÍÐ¹••‘•€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€Á±…å•È¹•áÁ9•áÐ´(€€€€€€€€€€€Á±…å•È¹•áÀ(€€€€€€€€¤ì(((€€€½¹ÍÐµ…¥¹I½Ü€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€µ…¥¹I½Ü¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€¥ô‰‘¥ÍÑÉ¥‰ÕÑ•5…¥¹	ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰•áÀµ‘¥ÍÑÉ¥‰ÕÑ”µ‰ÕÑÑ½¸ˆ(€€€€€€€€ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ¥½¸ˆø‘í•±•µ•¹Ð¹¥½¹ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½Áäˆø(€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÁ±…å•È¹¥‘ññ•±•µ•¹Ð¹¡…É…Ñ•Éôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€ñÍµ…±°ù1Ø¸‘íÁ±…å•È¹±•Ù•±ôƒŠH1Ø¸‘íÁ±…å•È¹±•Ù•°¬Åôð½Íµ…±°ø(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½ÍÐˆø(€€€€€€€€€€€€€€€€ñˆø‘í¹••‘•¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¥ôð½ˆø(€€€€€€€€€€€€€€€€ñÍµ…±°ùa@ð½Íµ…±°ø(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€ì(((€€€½¹Ñ…¥¹•È¹…ÁÁ•¹‘¡¥± (€€€€€€€µ…¥¹I½Ü(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’âš²‡–>«–6’âžÒk¾òh(€€€€€€ƒžÚO¦¦_šÆƒ’â7–’ƒ–6’â/’âžÒkšfžnÓš:—¦:[’ö?š2'¦"W¾ò0(€€€€€€ƒ’â7šr¢ºOž:§–ºÛ¢ª“š2'–ú3š*+žÚO¦¦_šÆƒšâž¦è(€€€€€€ƒ–6ï–6’â7’êžÒkŽ(€€€€¨¼((€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•5…¥¹	ÕÑÑ½¸ˆ¤(€€€€€€€€¹‘¥Í…‰±•€ô(€€€€€€€Í¡…É•‘áÀñ¹••‘•ñð(€€€€€€€‰…ÑÑ±•Ñ¥Ù”ì(((€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•5…¥¹	ÕÑÑ½¸ˆ¤(€€€€€€€€¹½¹±¥¬€ô(€€€€€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•Èì(((€€€€¼¨(€€€€€€ƒŠbƒž²³’ê3¢žK¢&Ëžj–"¦7š2'¦"W¾ò#šZÃ–Š{¾ò'Ž(€€€€€€Á±…å•ÈË–¶c–r£žj¢¦Ç¦†¿ž’ëžrš¶–>¿’î—š2'žjš2'¦"W¾ò0(€€€€€€ƒ¦
?¢ò¿¢Þž²³’â¢žK¢&Ëžjš2'¦"W–º3–£–Â7ž¢ÇŽ(€€€€¨¼((€€€¥˜¡Á±…å•ÈÈ¥ì((€€€€€€€½¹ÍÐÁ±…å•ÈÉI½Üô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€½¹ÍÐ¹••‘•Èô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹•áÁ9•áÐ´(€€€€€€€€€€€€€€€Á±…å•ÈÈ¹•áÀ(€€€€€€€€€€€€¤ì(((€€€€€€€Á±…å•ÈÉI½Ü¹¥¹¹•É!Q50ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€¥ô‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÉ	ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÌô‰•áÀµ‘¥ÍÑÉ¥‰ÕÑ”µ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ¥½¸ˆûŠ^ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½Áäˆø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÁ±…å•ÈÈ¹¥‘ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù1Ø¸‘íÁ±…å•ÈÈ¹±•Ù•±ôƒŠH1Ø¸‘íÁ±…å•ÈÈ¹±•Ù•°¬Åôð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½ÍÐˆø(€€€€€€€€€€€€€€€€€€€€ñˆø‘í¹••‘•È¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¥ôð½ˆø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùa@ð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ì(((€€€€€€€½¹Ñ…¥¹•È¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€Á±…å•ÈÉI½Ü(€€€€€€€€¤ì(((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÉ	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€¹‘¥Í…‰±•ô((€€€€€€€€€€€Í¡…É•‘áÀñ¹••‘•Èñð(€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”ì(((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÉ	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€¹½¹±¥¬ô(€€€€€€€€€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÈì((€€€ô(((€€€¥˜¡Á±…å•ÈÌ¥ì((€€€€€€€½¹ÍÐÁ±…å•ÈÍI½Üô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ¹••‘•Ìô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€Á±…å•ÈÌ¹•áÁ9•áÐ´(€€€€€€€€€€€€€€€Á±…å•ÈÌ¹•áÀ(€€€€€€€€€€€€¤ì((€€€€€€€Á±…å•ÈÍI½Ü¹¥¹¹•É!Q50ô(€€€€€€€€€€€€(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€¥ô‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÍ	ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÌô‰•áÀµ‘¥ÍÑÉ¥‰ÕÑ”µ‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ¥½¸ˆûŠ^ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½Áäˆø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø‘íÁ±…å•ÈÌ¹¥‘ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù1Ø¸‘íÁ±…å•ÈÌ¹±•Ù•±ôƒŠH1Ø¸‘íÁ±…å•ÈÌ¹±•Ù•°¬Åôð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰•áÀµ¡…É…Ñ•Èµ½ÍÐˆø(€€€€€€€€€€€€€€€€€€€€ñˆø‘í¹••‘•Ì¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¥ôð½ˆø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùa@ð½Íµ…±°ø(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ì((€€€€€€€½¹Ñ…¥¹•È¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€Á±…å•ÈÍI½Ü(€€€€€€€€¤ì((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÍ	ÕÑÑ½¸ˆ¤¹‘¥Í…‰±•ô(€€€€€€€€€€€Í¡…É•‘áÀñ¹••‘•Ìñð(€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”ì((€€€€€€€€ ‰‘¥ÍÑÉ¥‰ÕÑ•A±…å•ÈÍ	ÕÑÑ½¸ˆ¤¹½¹±¥¬ô(€€€€€€€€€€€‘¥ÍÑÉ¥‰ÕÑ•áÁQ½A±…å•ÈÌì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒšÂÓš"Ã–Ž¯¾ò?¦Š£–òOš&/¦g–§–/¦:[–ºk’öS’ö7š2'¦"T(€€€€€€ƒ’úwžŸž:§–ºÛ¢ššÆšVÓ–/š.ÿš:'¾ò3’â7–7¦†¿ž’ë¾ò0(€€€€€€ƒ¦g–§–/žn»–&7šr³’ú–ÂÇšÊKšr'žrš¶žj¢žK¢&Ë¢ÎšZd(€€€€€€ƒ¾ò#¦f“¦v{ž:§–ºÛ–&×–îëž²³’ê3¢žK¢&Ëšf–&o––÷¦ã’ê–B3š¢–žÒƒ¾ò0(€€€€€€ƒ’ö¦
–/ššÎ’â/–¾›¦još:ožjšb½Á±…å•ÈË¾ò0(€€€€€€ƒ’â7šb¿¦g¢Ž‡žjšÂÐ¿¦Š£’öS’ö7ž²›¾ò'¾ò0(€€€€€€ƒžVg¢F_–>«šb¿–’k¦’cžj¢š[¢šë¦ns¢¢+Ž(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž.š/–*ƒ¦îx(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbƒž.š/¦‚–"š>o¢žK¢&Ë¾ò#šZÃ–Š{¾ò'Ž(€€ƒ–"š>ožjšf–g¢šš*)Á•¹‘¥¹MÑ…ÑÏšâž¦ë¾ò0(€€ƒ’â7žÛŽ3¦
šÊKžŠë¢ª7žj–*ƒ¦î{Ž7šr¢ª“–âÛ–"Ã–>›’â–/¢žK¢&Ë¢ê¯’â+Ž(¨¼()™Õ¹Ñ¥½¸¡…¹•MÑ…ÑÕÍ¡…É…Ñ•È¡‘¥É•Ñ¥½¸¥ì((€€€½¹ÍÐ¥¹‘•á•Ìõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤ì((€€€¥˜¡¥¹‘•á•Ì¹±•¹Ñ ðÈ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÕÉÉ•¹ÑA½Í¥Ñ¥½¸õ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€¥¹‘•á•Ì¹¥¹‘•á=˜¡ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•à¤(€€€€¤ì((€€€ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•àõ¥¹‘•á•Íl(€€€€€€€€¡ÕÉÉ•¹ÑA½Í¥Ñ¥½¸­‘¥É•Ñ¥½¸­¥¹‘•á•Ì¹±•¹Ñ ¤•¥¹‘•á•Ì¹±•¹Ñ (€€€tì(((€€€=‰©•Ð¹­•åÌ (€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€¤(€€€€¹™½É… ¡ÍÑ…Ðôùì((€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…ÑtôÀì((€€€ô¤ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–*ƒ¦î{¢ššZÃ–Šx(€€ƒ¦Vßš2'–þ¯¦–*ƒ¦î{š¾S¢òžÂ‡–Z»¾ò3¦
šb¿¦ngžº·¦‚·š2'’â’â,(€€€¬ÄÃš¾S¢òžÂ‡–Z»¾ò3–šÏžnÓš:—¦ã’â–/Ž7ŠSŠS¦ã’ê(€€ƒ¦Vßš2'šZçš†#¾ò'¾òh((€€ƒ–ÇžR£žjŽ3¦Vßš2'š2žê3¢žãžfóŽ7–Â?–Þ—–ßŽš2'’â,(€€ƒ¾ò!Ñ½Õ¡ÍÑ…ÉÐ½µ½ÕÍ•‘½Ý»¾ò'–#ž¶$ÔÀÃš¾¯žžH(€€ƒ¾ò#¦ÿ–7š&/šîG¢òW¦î{’æ¢Š¯žVÛš"C¦Vßš2'¾ò'¾ò3š:—¢F\(€€ƒš¾<ÄÈÃš¾¯žžK¢«–.W–Fó–>¯’âš²‡–
Ï¦Ë’úžj–÷–ò?¾ò0(€€ƒžnÓ–"ÃšRû¦Z,¿š&/š2žžï–è¿šîG¢ÖÃž
ëš¶ˆ(€€ƒ¾ò!Ñ½Õ¡•¹½Ñ½Õ¡…¹•°½µ½ÕÍ•ÕÀ¼(€€µ½ÕÍ•±•…Ù—–£¦£¦÷¢ššâš:'¢¢#šf–f£¾ò0(€€ƒ’îï’öW’âž¢»šRû¦Z/š&/š2žjšZç–ò?¦÷’â7¢÷šò?š:—¾ò0(€€ƒ’â7žÛ¢¢#šf–f£šr–6‡’ö?’âžnÓ–*ƒ’â/–:ï¾ò'Ž((€€€ÛžÖ¬¼·š2'¦"W¾ò#šRïšN(¿šfë–*l¿¦®S¢Î¨¿¢÷¦<¼(€€ƒ¦bËžš˜¿šV?š6ß¾ò'–£¦£–Fó–>¯¦g–/–÷–ò?¾ò3’â7žR (€€ƒš¾?¦†š2'¦"W–B–¾¯’â’î÷¦Vßš2'¦
?¢ò¿Ž(¨¼()™Õ¹Ñ¥½¸…ÑÑ…¡1½¹AÉ•ÍÌ¡•°±™¸¥ì((€€€¥˜ …•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•Ð¡½±‘Q¥µ•½ÕÐõ¹Õ±°ì((€€€±•ÐÉ•Á•…Ñ%¹Ñ•ÉÙ…°õ¹Õ±°ì(((€€€™Õ¹Ñ¥½¸ÍÑ½À ¥ì((€€€€€€€¥˜¡¡½±‘Q¥µ•½ÕÐ¥ì(€€€€€€€€€€€±•…ÉQ¥µ•½ÕÐ¡¡½±‘Q¥µ•½ÕÐ¤ì(€€€€€€€€€€€¡½±‘Q¥µ•½ÕÐõ¹Õ±°ì(€€€€€€€ô(((€€€€€€€¥˜¡É•Á•…Ñ%¹Ñ•ÉÙ…°¥ì(€€€€€€€€€€€±•…É%¹Ñ•ÉÙ…°¡É•Á•…Ñ%¹Ñ•ÉÙ…°¤ì(€€€€€€€€€€€É•Á•…Ñ%¹Ñ•ÉÙ…°õ¹Õ±°ì(€€€€€€€ô((€€€ô(((€€€™Õ¹Ñ¥½¸ÍÑ…ÉÐ¡”¥ì((€€€€€€€”¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì((€€€€€€€™¸ ¤ì(((€€€€€€€ÍÑ½À ¤ì(((€€€€€€€¡½±‘Q¥µ•½ÕÐô(€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€ ¤ôùì((€€€€€€€€€€€€€€€€€€€É•Á•…Ñ%¹Ñ•ÉÙ…°ô(€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€€€€™¸°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÔÔ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€ÈÔÀ(€€€€€€€€€€€€¤ì((€€€ô(((€€€•°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ñ½Õ¡ÍÑ…ÉÐˆ°(€€€€€€€ÍÑ…ÉÐ°(€€€€€€€íÁ…ÍÍ¥Ù”é™…±Í•ô(€€€€¤ì((€€€•°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰µ½ÕÍ•‘½Ý¸ˆ°(€€€€€€€ÍÑ…ÉÐ(€€€€¤ì(((€€€l(€€€€€€€€‰Ñ½Õ¡•¹ˆ°(€€€€€€€€‰Ñ½Õ¡…¹•°ˆ°(€€€€€€€€‰µ½ÕÍ•ÕÀˆ°(€€€€€€€€‰µ½ÕÍ•±•…Ù”ˆ(€€€t¹™½É… ¡•ÙÑ9…µ”ôùì((€€€€€€€•°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€•ÙÑ9…µ”°(€€€€€€€€€€€ÍÑ½À(€€€€€€€€¤ì((€€€ô¤ì()ô(()™Õ¹Ñ¥½¸…‘‘A½¥¹Ð¡ÍÑ…Ð¥ì((€€€¥˜ (€€€€€€€€…=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±° (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ°(€€€€€€€€€€€ÍÑ…Ð(€€€€€€€€¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑMÑ…ÑÕÍ¡…É…Ñ•É=‰©•Ð ¤ì(((€€€½¹ÍÐÕÍ•€ô(€€€€€€€=‰©•Ð¹Ù…±Õ•Ì (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€€€€€¤(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡ÍÕ´±Ù…±Õ”¤ôø(€€€€€€€€€€€€€€€ÍÕ´­Ù…±Õ”°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€ÕÍ•øô(€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñt¬¬ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢š2š¶¾ò'¾òh(€€ƒ’æ/–&7¦g¢Ž‡–>«šr%…‘‘A½¥¹Ð §¾ò3–º3–£šÊKšr'–Â7š'žj(€€ƒšâo¢f–÷–ò?¾ò3–Â;¢Óž.š/¦‚¦v‹–"¦7–6žÒk¦î{šVãžj–rÃšZä(€€ƒ–>«¢÷–*ƒŽ’â7¢÷š&¾ò3¢Þ–&×¢žK¦‚¦v‹¾ò#šr³’ú–ÂÇšr$(€€ƒ–*ƒšâo–§¦†š2'¦"W¾ò'’â7’â¢ÓŽ(€€ƒ¢Žs’â)É•µ½Ù•A½¥¹Ð §¾ò3–>«¢÷š&š:'Ž3¦gš²‡¦
šÊH(€€ƒžŠë¢ª7Žšj¯–¶c’â·Ž7žj¦î{šVã¾ò3’â7šr–.W–"Ã¢žK¢&È(€€ƒ–ÞËžÚOžRšV#žj–Æ³šŸ–ó¾ò3¦
?¢ò¿’â+¢Þ–&×¢žK¦‚¦v‹žj(€€É•…Ñ¥½¹‘¡ÍÑ…Ð°´Ä§šb¿–B3’âž¢»–kšÎWŽ(¨¼()™Õ¹Ñ¥½¸É•µ½Ù•A½¥¹Ð¡ÍÑ…Ð¥ì((€€€¥˜ (€€€€€€€€…=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±° (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ°(€€€€€€€€€€€ÍÑ…Ð(€€€€€€€€¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…ÑtðôÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñt´´ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦gšVÓ–/–÷–ò?¦÷–¾¯š¶ï¢ª5Á±…å•Ë¾ò0(€€€€€€ƒž²³’ê3¢žK¢&ËšÊK¢ú›šÎWžR£ž.š/¦‚–*ƒ¦î{Ž(€€€€€€ƒšRçš"C–#š*OŽ3žn»–&7¦ã’â·žj¢žK¢&ËŽ4(€€€€€€ƒ¾ò!Á±…å•Ëš"YÁ±…å•ÈË¾ò'¾ò0(€€€€€€ƒ’â/¦v‹š&šr'¢¢#žº_¦÷–Â7¦g–/¢žK¢&Ë–k¾ò0(€€€€€€ƒ’â7žR£šVÓ–/–÷–ò?¦7–¾¯–§’î÷Ž(€€€€¨¼((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑMÑ…ÑÕÍ¡…É…Ñ•É=‰©•Ð ¤ì(((€€€½¹ÍÐÕÉÉ•¹Ð€ôì((€€€€€€€…ÑÑ…¬è(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑ…¬¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹…ÑÑ…¬°((€€€€€€€Ù¥Ñ…±¥Ñäè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹Ù¥Ñ…±¥Ñä¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹Ù¥Ñ…±¥Ñä°((€€€€€€€•¹•Éäè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹•¹•Éä¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹•¹•Éä°((€€€€€€€¥¹Ñ•±±¥•¹”è(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¥¹Ñ•±±¥•¹”¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹¥¹Ñ•±±¥•¹”°((€€€€€€€‘•™•¹Í•A½¥¹ÑÌè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹‘•™•¹Í•A½¥¹ÑÌ¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹‘•™•¹Í•A½¥¹ÑÌ°((€€€€€€€…¥±¥Ñäè(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…¥±¥Ñä¬(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ¹…¥±¥Ñä((€€€ôì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¦î{šVã–"¦4(€€€€€€ƒ¦†¿ž’ëžVÛ–&7¢žK¢&Ëžj!CŽMCšŠw¾ò3–*ƒ¦î{¦®S¢Î¨¼(€€€€€€ƒ¢÷¦?šf–>¿’î—¦‚C¢š÷–Š{–*ƒžj–.WžV¯¾ò3¢†šŠwšr(€€€€€€ƒ–B#žBžâ»ž~·Ž7¾ò'¾òh(€€€€€€µ…á!@½µ…áMC–³–ò?¢Þ}•Ñ	…Í•MÑ…ÑÌ ¤(€€€€€€ƒ¢Ž‡žjžº_šÎW–º3–£’â¢Ó¾ò Ç¦®S¢Î¨ô¬ÔÁ!C¾ò0(€€€€€€€Ç¢÷¦<ô¬ÄÕMC¾ò'¾ò3–>«šb¿¦g¢Ž‡šRçš"C–B(€€€€€€Ñ…É•Ñ¡…É…Ñ•Ë¾ò#–>¿¢÷šb½Á±…å•Ëš"X(€€€€€€Á±…å•ÈË¾ò'¾ò3’â7¢÷žnÓš:—–Fó–>¬(€€€€€€•Ñ	…Í•MÑ…ÑÌ §¾ò#¦
–/–÷–ò?–¾¯š¶ïš*L(€€€€€€Á±…å•Ë¾ò'¾ò3¢«–ÞÇ¦7žº_’âš²‡Ž((€€€€€€ƒžn»–&5!@½MC¾ò!Ñ…É•Ñ¡…É…Ñ•È¹¡Ã¾ò<¹ÍÃ¾ò$(€€€€€€ƒ’â7šr–nƒž
ë¦‚C¢š÷–*ƒ¦î{¢3šRç¢º+¾ò3–>«šr'Ž3’â+¦fCŽ4(€€€€€€ƒšr¢Þ¢F]Á•¹‘¥¹MÑ…ÑÌ¹Ù¥Ñ…±¥Ñç¾ò<¹•¹•Éä(€€€€€€ƒ–6Ïšf¦‚C¢š÷¢º+–2[ŠSŠS¦gš¢¢†šŠw–¾³–ê˜(€€€€€€ƒ¾ò#ž>û–r¡!Cß¦‚C¢š÷–ú3’â+¦fC¾ò'–ÂÇšr¢«žØ(€€€€€€ƒ¦j£¢F_’â+¦fC¢º+–’Ÿ¢3žâ»ž~·¾ò3’â7žR£–>›–’[–¾¬(€€€€€€ƒŽ3žâ»ž~·–.WžV¯Ž7žjž&çšº+¦
?¢ò¿Ž(€€€€¨¼((€€€½¹ÍÐÁÉ•Ù¥•Ý5…á!@ô((€€€€€€€€ÄÀÀ¬(€€€€€€€ÕÉÉ•¹Ð¹Ù¥Ñ…±¥Ñä¨ÔÀ¬(€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹‰½¹ÕÍ!AñðÀ¤ì(((€€€½¹ÍÐÁÉ•Ù¥•Ý5…áM@ô((€€€€€€€€ÔÀ¬(€€€€€€€ÕÉÉ•¹Ð¹•¹•Éä¨ÄÔ¬(€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹‰½¹ÕÍMAñðÀ¤ì(((€€€½¹ÍÐÕÉÉ•¹Ñ!@ô((€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹¡ÁñðÀ°(€€€€€€€€€€€ÁÉ•Ù¥•Ý5…á!@(€€€€€€€€¤ì(((€€€½¹ÍÐÕÉÉ•¹ÑM@ô((€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹ÍÁñðÀ°(€€€€€€€€€€€ÁÉ•Ù¥•Ý5…áM@(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•Ý!ÁQ•áÐˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€ÕÉÉ•¹Ñ!@¬(€€€€€€€€‹¾ò<ˆ¬(€€€€€€€ÁÉ•Ù¥•Ý5…á!@ì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•ÝMÁQ•áÐˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€ÕÉÉ•¹ÑM@¬(€€€€€€€€‹¾ò<ˆ¬(€€€€€€€ÁÉ•Ù¥•Ý5…áM@ì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•Ý!Á¥±°ˆ¤(€€€€€€€€¹ÍÑå±”¹Ý¥‘Ñ ô((€€€€€€€€ (€€€€€€€€€€€ÁÉ•Ù¥•Ý5…á!@øÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€¡ÕÉÉ•¹Ñ!@½ÁÉ•Ù¥•Ý5…á!@¨ÄÀÀ¤(€€€€€€€€€€€€è(€€€€€€€€€€€€À(€€€€€€€€¤¬(€€€€€€€€ˆ”ˆì(((€€€€ ‰ÍÑ…ÑÕÍAÉ•Ù¥•ÝMÁ¥±°ˆ¤(€€€€€€€€¹ÍÑå±”¹Ý¥‘Ñ ô((€€€€€€€€ (€€€€€€€€€€€ÁÉ•Ù¥•Ý5…áM@øÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€¡ÕÉÉ•¹ÑM@½ÁÉ•Ù¥•Ý5…áM@¨ÄÀÀ¤(€€€€€€€€€€€€è(€€€€€€€€€€€€À(€€€€€€€€¤¬(€€€€€€€€ˆ”ˆì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òh(€€€€€€ƒž.š/¦‚¦v‹ž>û–r£šr¦†¿ž’è(€€€€€€ƒŽ3ž:§–ºÛ¦î{šVà€¬ƒ¢Žw–
g–*ƒš"@€ôƒžâ÷–B#Ž7¾ò0(€€€€€€ƒ¢3’â7šb¿–>«¦†¿ž’ëž:§–ºÛ¢«–ÞÇ–*ƒ¦î{žjšVã–¶_Ž(€€€€€€ƒ¢Žw–
g–*ƒš"Cš*O–Â7š'¢žK¢&Ëžj¢Žw–
gš²(€€€€€€ƒ¾ò!Á±…å•ËŠIÁ±…å•È¹•±•µ•¹ÓŽ(€€€€€€Á±…å•ÈËŠK–në–ºh‰Á±…å•ÈÈ‹¦g–-­•ç¾ò'¾ò0(€€€€€€ƒ¢Þ’âï–~;Ž¢3–2¦‚žr/–"Ãžj¦
?¢ò¿’â¢ÓŽ(€€€€¨¼((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ€ô€€€€€€€•ÑÅÕ¥Áµ•¹Ñ	½¹ÕÌ (€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É-•ä (€€€€€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É%¹‘•à¡Ñ…É•Ñ¡…É…Ñ•È¤(€€€€€€€€€€€€¤(€€€€€€€€¤ì(((€€€™Õ¹Ñ¥½¸™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€‰…Í•Y…±Õ”°(€€€€€€€‰½¹ÕÍY…±Õ”(€€€€¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ’æ/–&7¢Žw–
g–*ƒš"Cšb¼Ãžjšf–g–>«¦†¿ž’ë–Z»’âšVã–¶_¾ò0(€€€€€€€€€€ƒž:§–ºÛšÊK¢Žw–
gšvÇ¢–ÿšf–º3–£žr/’â7–è(€€€€€€€€€€ƒŽ3šr'–r£žº_¢Žw–
g–*ƒš"CŽ7¦g’îÛ’ê/¾ò0(€€€€€€€€€€ƒ’î—ž
ëšÊKžRšV#Ž(€€€€€€€€€€ƒšRçš"C’â–ú/¦†¿ž’ëŽ3–~ëž’8¯¢Žw–
d÷žâ÷–B#Ž7¾ò0(€€€€€€€€€€ƒ–ÂÇžº_¢Žw–
g–*ƒš"Cšb¼Ã’æ’âš¢¦†¿ž’ë¾ò0(€€€€€€€€€€ƒ’ú/–š€ä¬ÀôçŽ(€€€€€€€€¨¼((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€‰…Í•Y…±Õ”¬(€€€€€€€€€€€€ˆ¬ˆ¬(€€€€€€€€€€€‰½¹ÕÍY…±Õ”¬(€€€€€€€€€€€€ˆôˆ¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€‰…Í•Y…±Õ”¬(€€€€€€€€€€€€€€€‰½¹ÕÍY…±Õ”(€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€ô(((€€€€ ‰ÍÑ…ÑÕÍÑÑ…¬ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹…ÑÑ…¬°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹…ÑÑ…¬(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍY¥Ñ…±¥Ñäˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹Ù¥Ñ…±¥Ñä°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹Ù¥Ñ…±¥Ñä(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍ¹•Éäˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹•¹•Éä°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹•¹•Éä(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍ%¹Ñ•±±¥•¹”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹¥¹Ñ•±±¥•¹”°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹¥¹Ñ•±±¥•¹”(€€€€€€€€¤ì(((€€€€ ‰ÍÑ…ÑÕÍ•™•¹Í”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõ™½Éµ…ÑMÑ…Ñ1¥¹”¡ÕÉÉ•¹Ð¹‘•™•¹Í•A½¥¹ÑÌ±•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹‘•™•¹Í•A½¥¹ÑÌ¤ì(((€€€€ ‰ÍÑ…ÑÕÍ¥±¥Ñäˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€™½Éµ…ÑMÑ…Ñ1¥¹” (€€€€€€€€€€€ÕÉÉ•¹Ð¹…¥±¥Ñä°(€€€€€€€€€€€•ÅÕ¥Áµ•¹Ñ	½¹ÕÌ¹…¥±¥Ñä(€€€€€€€€¤ì(((€€€½¹ÍÐÕÍ•€ô(€€€€€€€=‰©•Ð¹Ù…±Õ•Ì (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€€€€€¤(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡ÍÕ´±Ù…±Õ”¤ôø(€€€€€€€€€€€€€€€ÍÕ´­Ù…±Õ”°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€€ ‰…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€À°(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌµÕÍ•(€€€€€€€€¤ì(((€€€€ ‰½¹™¥ÉµMÑ…ÑÕÍ	ÕÑÑ½¸ˆ¤(€€€€€€€€¹‘¥Í…‰±•€ô(€€€€€€€ÕÍ•ôôôÀì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶š*O–"ÃŽ3žº·¦‚·–6–†+š;¦êó¦^s¦÷¦^p(€€€€€€ƒ’â7š:'Ž7žj–:–nƒ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³ž‡šŠw’îÛ’úwžÁ±…å•ÈË–¶c’â7–¶c–r (€€€€€€ƒ¦7šZÃ¢¢·–ºk¦†¿ž’ëž.š/¾ò3–º3–£’â7ž~—¦O¦g–,(€€€€€€ƒ–6–†+ž>û–r£šb¿’â7šb¿š¶¢Š¯¢žK¢&Ë¢š[žª\(€€€€€€ƒ¾ò!ÍÝ¥Ñ¡¡…É…Ñ•ÉQ…ˆ §¾ò'šVš?–¢ÖÀ(€€€€€€ƒ¦jÇ¢^?ŠSŠS–>«¢šž:§–ºÛ¦î{’âš²„¬¼·š2'¦"W¾ò0(€€€€€€ƒ¦g¢Ž‡–ÂÇšrš*+¦jÇ¢^?žjšV#šzs¢N/š:'Ž¦7šZÀ(€€€€€€ƒ¦†¿ž’ë–ë’ú¾ò3¦gš&7šb¿Ž3š;¦êó¦jÇ¢^?¦÷šÊKžR£Ž4(€€€€€€ƒžjžrš¶–:–nƒŽ((€€€€€€ƒ–*ƒ’â–/–"“šZß¾òk–ššzs¦g–/–žÒƒš¶šb¼(€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É“¢¢c¦2žj(€€€€€€ƒ¦
’â–/¾ò#’î¢†£žn»–&7š¶¢Š¯¢žK¢&Ë¢š[žª_–¢ÖÃ¾ò'¾ò0(€€€€€€ƒ–ÂÇ¢ÞÏ¦;¦g¢Ž‡žj¦†¿ž’ë¦
?¢ò¿¾ò3žÚ·š2¦jÇ¢^?¾ò0(€€€€€€ƒ’â7¢š¢N/š:'Ž(€€€€¨¼((€€€½¹ÍÐÍÝ¥Ñ¡…Éô(€€€€€€€€ ‰ÍÑ…ÑÕÍ¡…É…Ñ•ÉMÝ¥Ñ¡…Éˆ¤ì(((€€€½¹ÍÐ¹…µ•	½àô(€€€€€€€€ ‰ÍÑ…ÑÕÍ¡…É…Ñ•É9…µ”ˆ¤ì(((€€€¥˜ (€€€€€€€ÍÝ¥Ñ¡…É€˜˜(€€€€€€€ÍÝ¥Ñ¡…É„ôô(€€€€€€€¡½µ••…ÑÕÉ•!¥‘‘•¹MÝ¥Ñ¡…É(€€€€¥ì((€€€€€€€ÍÝ¥Ñ¡…É¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹±•¹Ñ øÄ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰‰±½¬ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€¥˜¡¹…µ•	½à¥ì((€€€€€€€¹…µ•	½à¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€¡Ñ…É•Ñ¡…É…Ñ•È¹¥‘ñð‹–K¦j«¢ˆ¤¬(€€€€€€€€€€€€ˆ1Ø¸ˆ¬(€€€€€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹±•Ù•°ì((€€€ô()ô(()™Õ¹Ñ¥½¸½¹™¥ÉµMÑ…ÑÕÌ ¥ì((€€€½¹ÍÐÑ…É•Ñ¡…É…Ñ•Èô(€€€€€€€•ÑMÑ…ÑÕÍ¡…É…Ñ•É=‰©•Ð ¤ì(((€€€½¹ÍÐÕÍ•€ô(€€€€€€€=‰©•Ð¹Ù…±Õ•Ì (€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€€€€€¤(€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€¡ÍÕ´±Ù…±Õ”¤ôø(€€€€€€€€€€€€€€€ÍÕ´­Ù…±Õ”°(€€€€€€€€€€€€À(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€ÕÍ•ðôÀñð(€€€€€€€ÕÍ•ø(€€€€€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’âš²‡žŠë¢ª7–ú3–£¦£š¶ã¦nÛ¾ò0(€€€€€€ƒ’â7šr–ëž>û’æ/–&7Ž3žŠë¢ª7–ú3¦
¢÷’êš2'Ž7¦ƒš"CžVÛš¦Ž(€€€€¨¼((€€€=‰©•Ð¹­•åÌ (€€€€€€€Á•¹‘¥¹MÑ…ÑÌ(€€€€¤(€€€€¹™½É… ¡ÍÑ…Ðôùì((€€€€€€€Ñ…É•Ñ¡…É…Ñ•ÉmÍÑ…Ñt€¬ô(€€€€€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…Ñtì((€€€€€€€Á•¹‘¥¹MÑ…ÑÍmÍÑ…ÑtôÀì((€€€ô¤ì(((€€€Ñ…É•Ñ¡…É…Ñ•È¹…ÑÑÉ¥‰ÕÑ•A½¥¹ÑÌ€´ô(€€€€€€€ÕÍ•ì(((€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš*¢ô(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()½¹ÍÐM-%11}AIY%]}159QLõl‰™¥É”ˆ°‰Ý…Ñ•Èˆ°‰Ý¥¹ˆ°‰•…ÉÑ ‰tì()™Õ¹Ñ¥½¸•ÑM­¥±±AÉ•Ù¥•ÝMÕµµ…Éä¡Í­¥±°¥ì((€€€½¹ÍÐÍ½Á•Ìõì(€€€€€€€Í¥¹±”è‹šRïšN+–Z»’âšV×’êèˆ°(€€€€€€€ÑÉ¤è‹šRïšN+žnã¦Ãžj’âš:KšV×’êèˆ°(€€€€€€€É½Üè‹šRïšN+’âšVÓš:KšV×’êèˆ°(€€€€€€€½±Õµ¸è‹šRïšN+–B3’âžnÓ–"_šV×’êèˆ°(€€€€€€€…±°è‹šRïšN+šV×šZç–£¦®Pˆ°(€€€€€€€…±±äè‹šR¿š>Ó’â–B7–>/šZäˆ°(€€€€€€€…±±å±°è‹šR¿š>Óš"GšZç–£¦®Pˆ°(€€€€€€€‘•…‘±±äè‹–ú§šÒï’â–B7–K’â/žj–>/šZäˆ°(€€€€€€€¹½¹”è‹¢Š¯–.WžRšV ˆ(€€€ôì((€€€½¹ÍÐ•™™•ÑÌõmtì((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹¦ƒš"Cž&§žB–
ß–ºÌˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹¦ƒš"CšÎW¢†O–
ß–ºÌˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f–*ƒžžHˆ¤ìô(€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷’öÿžn»š¢g–Ã–Âˆ¤ìô(€€€¥˜¡Í­¥±°¹ÍÑÕ¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷’öÿžn»š¢gšj#žr§’â›¦f7’ö;–F÷’â´ˆ¤ìô(€€€¥˜¡Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢gšV?š6Üˆ¤ìô(€€€¥˜¡Í­¥±°¹‘…µ…•½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢g¦ƒš"Cžj–
ß–ºÌˆ¤ìô(€€€¥˜¡Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢g¦bËžš˜ˆ¤ìô(€€€¥˜¡Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿¢÷¦f7’ö;žn»š¢g–’k¦‚¢÷–*lˆ¤ìô(€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì•™™•ÑÌ¹ÁÕÍ  ‹–>¿–BãšRÛ–
ß–ºÏ–n{–ú§¢«¢ê¬ˆ¤ìô(€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°¥ì•™™•ÑÌ¹ÁÕÍ  ‹ž
ë¢«–ÞÇ–îëž®/¢¶ßžnøˆ¤ìô(€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì•™™•ÑÌ¹ÁÕÍ  ‹ž
ëš"GšZç–îëž®/¢¶ßžnøˆ¤ìô((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹–n{–ú§–>/šZçžR–F÷¢"¢÷¦<ˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹¢ºO–K’â/žj–>/šZç¦7šZÃ–>š"Àˆ¤ì(€€€ô(€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ  ‹šÂã’æ–òß–2[¢¦Ë–žÒƒžjš"Ã¦²—ž&ç¢&Èˆ¤ì(€€€ô((€€€½¹ÍÐ¹…µ•‘™™•ÑÌõì(€€€€€€€É…”è‹š>C–6š"GšZçž"šN+¢÷–*lˆ°(€€€€€€€‘½‘•M­¥±°è‹š>C–6š"GšZç¦Z¢êË¢÷–*lˆ°(€€€€€€€ÍÑ•…±Ñ¡M­¥±°è‹¢ºO–>/šZç¦Ë–—¦jÇ¢ê¬ˆ°(€€€€€€€‘¥¹¡…¥Í¡•¹é¡•¸è‹š>C–6š"GšZçžVÃ–âãž.š/š*_šœˆ°(€€€€€€€É½­]…±°è‹š>C–6š"GšZç¦bËžš›¢÷–*lˆ°(€€€€€€€•…ÉÑ¡M¡¥•±è‹¢Î›’ê#–>/šZç–>7–
ßšV#šzpˆ°(€€€€€€€‰…ÉÉ¥•Èè‹ž
ë–>/šZç–îëž®/–
ß–ºÏžÖCžV0ˆ(€€€ôì((€€€¥˜¡¹…µ•‘™™•ÑÍmÍ­¥±°¹¥‘t¥ì(€€€€€€€•™™•ÑÌ¹ÁÕÍ ¡¹…µ•‘™™•ÑÍmÍ­¥±°¹¥‘t¤ì(€€€ô((€€€É•ÑÕÉ¸l(€€€€€€€Í½Á•ÍmÍ­¥±°¹Ñ…É•ÑQåÁ•uñð‹ž&çšº+šV#šzpˆ°(€€€€€€€€¸¸¹•™™•ÑÌ(€€€t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ‹¾òlˆ¤¬‹Žˆì()ô()™Õ¹Ñ¥½¸É•¹‘•É±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü¡•±•µ•¹Ð¥ì((€€€½¹ÍÐ‰½‘äô ‰Í­¥±±AÉ•Ù¥•Ý	½‘äˆ¤ì(€€€½¹ÍÐÑ…‰Ìô ‰Í­¥±±AÉ•Ù¥•ÝQ…‰Ìˆ¤ì((€€€¥˜ …‰½‘äñð€…Ñ…‰Ì¥ìÉ•ÑÕÉ¸ìô((€€€½¹ÍÐÍ•±•Ñ•õM-%11}AIY%]}159QL¹¥¹±Õ‘•Ì¡•±•µ•¹Ð¤(€€€€€€€€ü•±•µ•¹Ð(€€€€€€€€è€‰™¥É”ˆì((€€€Ñ…‰Ì¹¥¹¹•É!Q50õM-%11}AIY%]}159QL¹µ…À¡­•äôùì(€€€€€€€½¹ÍÐ‘…Ñ„õ•±•µ•¹Ñ…Ñ…‰…Í•m­•åtì(€€€€€€€É•ÑÕÉ¸€œñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌôˆœ¬(€€€€€€€€€€€€¡­•äôôõÍ•±•Ñ•€ü€‰…Ñ¥Ù”ˆ€è€ˆˆ¤¬(€€€€€€€€€€€€œˆ½¹±¥¬ô‰É•¹‘•É±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü¡pœœ­­•ä¬pœ¤ˆøœ¬(€€€€€€€€€€€‘…Ñ„¹¹…µ”¬Ÿ–Æ³šœð½‰ÕÑÑ½¸øœì(€€€ô¤¹©½¥¸ ˆˆ¤ì((€€€½¹ÍÐ…Ñ•½Éå9…µ•Ìõì(€€€€€€€Á¡åÍ¥…°è‹ž&§žBˆ°(€€€€€€€µ…¥Œè‹šÎW¢†Lˆ°(€€€€€€€‰Õ™˜è‹–Š{žn(ˆ°(€€€€€€€¡•…°è‹–n{–ú¤ˆ°(€€€€€€€É•Ù¥Ù”è‹–ú§šÒìˆ°(€€€€€€€Á…ÍÍ¥Ù”è‹¢Š¯–.Tˆ(€€€ôì((€€€½¹ÍÐÍ­¥±±Ìõ=‰©•Ð¹Ù…±Õ•Ì¡Í­¥±±…Ñ…‰…Í”¤¹™¥±Ñ•È (€€€€€€€Í­¥±°ôùÍ­¥±°¹•±•µ•¹ÐôôõÍ•±•Ñ•(€€€€¤ì((€€€‰½‘ä¹¥¹¹•É!Q50õÍ­¥±±Ì¹µ…À¡Í­¥±°ôø(€€€€€€€€œñ…ÉÑ¥±”±…ÍÌô‰Í­¥±°µÁÉ•Ù¥•Üµ…Éˆøœ¬(€€€€€€€€€€€€œñ‘¥ØøñÍÑÉ½¹œøœ­Í­¥±°¹¹…µ”¬œð½ÍÑÉ½¹œøñÍÁ…¸øœ¬(€€€€€€€€€€€€¡…Ñ•½Éå9…µ•ÍmÍ­¥±°¹…Ñ•½Éåuñð‹ž&çšº(ˆ¤¬œð½ÍÁ…¸øð½‘¥Øøœ¬(€€€€€€€€€€€€œñÀøœ­•ÑM­¥±±AÉ•Ù¥•ÝMÕµµ…Éä¡Í­¥±°¤¬œð½Àøœ¬(€€€€€€€€œð½…ÉÑ¥±”øœ(€€€€¤¹©½¥¸ ˆˆ¤ì((€€€‰½‘ä¹ÍÉ½±±Q½ÀôÀì)ô()™Õ¹Ñ¥½¸½Á•¹±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü ¥ì((€€€½¹ÍÐµ½‘…°ô ‰…±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ý5½‘…°ˆ¤ì(€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸ìô((€€€É•¹‘•É±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü ‰™¥É”ˆ¤ì(€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰™…±Í”ˆ¤ì)ô()™Õ¹Ñ¥½¸±½Í•±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ü ¥ì((€€€½¹ÍÐµ½‘…°ô ‰…±±±•µ•¹ÑM­¥±±AÉ•Ù¥•Ý5½‘…°ˆ¤ì(€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸ìô((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì)ô()™Õ¹Ñ¥½¸¡…¹•M­¥±±¡…É…Ñ•ÉÉÉ½Ü¡‘¥É•Ñ¥½¸¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³šb¼ñÍ•±•Ðû’â/š.'¦ã–Z»¾ò0(€€€€€€ƒšRçš"C¢Þž.š/¦‚’â¢Óžj–Þ›–>Ïžº·¦‚·–"š>o¾ò0(€€€€€€ƒšÂÓš"Ã–Ž¬¿¦Š£–òOš&/¦g–§–/žn»–&7šÊKšr'žrš¶¢žK¢&Ë¢ÎšZgžj(€€€€€€ƒ¦ã¦‚’æ’â’ö×š.ÿš:'¾ò0(€€€€€€ƒ–>«–r¡™¥É—¾ò#ž²³’â¢žK¢&Ë¾ò'¢Þ}Á±…å•ÈË¾ò#ž²³’ê3¢žK¢&Ë¾ò0(€€€€€€ƒ–¶c–r£žj¢¦Ç¾ò'’æ/¦ZO–"š>o¾ò3š¾S¢ò’â7šr¢ª“–Â;ž:§–ºØ(€€€€€€ƒ’î—ž
ëšÂÐ¿¦Š£’æ¢÷š¶–âãžR£Ž(€€€€¨¼((€€€½¹ÍÐ­•åÌõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹µ…À (€€€€€€€¥¹‘•àôù•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¥¹‘•à¤(€€€€¤ì((€€€¥˜¡­•åÌ¹±•¹Ñ ðÈ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐÕÉÉ•¹ÑA½Í¥Ñ¥½¸õ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€­•åÌ¹¥¹‘•á=˜¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È¤(€€€€¤ì((€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èõ­•åÍl(€€€€€€€€¡ÕÉÉ•¹ÑA½Í¥Ñ¥½¸­‘¥É•Ñ¥½¸­­•åÌ¹±•¹Ñ ¤•­•åÌ¹±•¹Ñ (€€€tì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì()ô(()™Õ¹Ñ¥½¸•ÑM­¥±±¡…É…Ñ•É=‰©•Ð¡¡…É…Ñ•É%¥ì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾òh(€€€€€€ƒš*¢÷–¶ãžþH¿–6žÒk¢š¢*Çžjš*¢÷¦î{¾ò0(€€€€€€ƒžn»–&7–>«šr%Á±…å•Ë¾ò!™¥É—¾ò'¢Þ}Á±…å•ÈÈ(€€€€€€ƒ¦g–§–/¢žK¢&Ëšr'žrš¶ž6£ž®/žjÍ­¥±±A½¥¹ÑÏ¾ò0(€€€€€€Ý…Ñ•È½Ý¥¹“¦
–>«šb¿¢Žw–
gžR£žjž¦ëšºó¾ò0(€€€€€€ƒšÊKšr'¢3–ú3žj¢žK¢&Ë¢ÎšZg¾ò3–n{–
Í¹Õ±³¾ò0(€€€€€€ƒ–Fó–>¯žj–rÃšZç¢š¢«–ÞÇ–"“šZÝ¹Õ±³žjššÎŽ(€€€€¨¼((€€€¥˜¡¡…É…Ñ•É%ôôô‰™¥É”ˆ¥ì(€€€€€€€É•ÑÕÉ¸Á±…å•Èì(€€€ô(((€€€¥˜ (€€€€€€€¡…É…Ñ•É%ôôô‰Á±…å•ÈÈˆ˜˜(€€€€€€€Á±…å•ÈÈ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸Á±…å•ÈÈì(€€€ô((€€€¥˜ (€€€€€€€¡…É…Ñ•É%ôôô‰Á±…å•ÈÌˆ˜˜(€€€€€€€Á±…å•ÈÌ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸Á±…å•ÈÌì(€€€ô(((€€€É•ÑÕÉ¸¹Õ±°ì()ô(()±•ÐÍ•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆôˆˆì)±•ÐÍ•±•Ñ•‘M­¥±±±•µ•¹Ñ¡…É…Ñ•É-•äôˆˆì)½¹ÍÐM-%11}159Q}Q	}5Qõ=‰©•Ð¹™É••é”¡ì(€€€™¥É”éí±…‰•°è‹ž¯–žÒ€ˆ±•±•µ•¹Ðè‰™¥É”ˆ±±…ÍÍ9…µ”è‰™¥É”‰ô°(€€€Ý…Ñ•Èéí±…‰•°è‹šÂÓ–žÒ€ˆ±•±•µ•¹Ðè‰Ý…Ñ•Èˆ±±…ÍÍ9…µ”è‰Ý…Ñ•È‰ô°(€€€Ý¥¹éí±…‰•°è‹¦Š£–žÒ€ˆ±•±•µ•¹Ðè‰Ý¥¹ˆ±±…ÍÍ9…µ”è‰Ý¥¹‰ô°(€€€•…ÉÑ éí±…‰•°è‹–r–žÒ€ˆ±•±•µ•¹Ðè‰•…ÉÑ ˆ±±…ÍÍ9…µ”è‰•…ÉÑ ‰ô)ô¤ì()™Õ¹Ñ¥½¸•ÑM­¥±±1•…É¹½ÍÑ½ÉU¤¡¡…É…Ñ•È±Í­¥±°¥ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÍ•Ñ%¹¥Ñ¥…±1•…É¹½ÍÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€É•ÑÕÉ¸5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Ý¥¹‘½Ü¹ØÄÜÍ•Ñ%¹¥Ñ¥…±1•…É¹½ÍÐ¡¡…É…Ñ•È±Í­¥±°¤¥ñðÀ¤¤ì(€€€ô(€€€€¼¼Q¡”ÁÉ½É•ÍÍ¥½¸µ½‘Õ±”½Ý¹ÌÑ¡”Á±…å•Èµ™…¥¹œ½ÍÐ°¥¹±Õ‘¥¹œÉ½ÍÌµ•±•µ•¹ÐÉÕ±•Ì¸(€€€€¼¼-••ÀÑ¡¥Ì™…±±‰…¬‰…Í”µ½¹±äÍ¼„µ¥ÍÍ¥¹œµ½‘Õ±”…¹¹½ÐÉ•…Ñ”„Í•½¹™½ÉµÕ±„¸(€€€É•ÑÕÉ¸5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Í­¥±°˜™Í­¥±°¹±•…É¹½ÍÐ¥ñðÀ¤¤ì)ô()™Õ¹Ñ¥½¸•ÑM­¥±±1•…É¹±¥¥‰¥±¥Ñå½ÉU¤¡¡…É…Ñ•È±Í­¥±°±±•Ù•±Ì¥ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÍ•ÑM­¥±±1•…É¹±¥¥‰¥±¥Ñäôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€É•ÑÕÉ¸Ý¥¹‘½Ü¹ØÄÜÍ•ÑM­¥±±1•…É¹±¥¥‰¥±¥Ñä¡¡…É…Ñ•È±Í­¥±°±±•Ù•±Ì¤ì(€€€ô(€€€É•ÑÕÉ¸ì(€€€€€€€…±±½Ý•é™…±Í”±¥ÍÉ½ÍÍ±•µ•¹Ðé™…±Í”±¥Í9…Ñ¥Ù•±•µ•¹ÐéÑÉÕ”±±•Ù•±=¬é™…±Í”°(€€€€€€€ÁÉ•É•ÅÕ¥Í¥Ñ•I•ÅÕ¥É•é™…±Í”±ÁÉ•É•ÅÕ¥Í¥Ñ•=¬é™…±Í”±±•…É¹½ÍÐèÀ±Á½¥¹ÑÍ=¬é™…±Í”°(€€€€€€€É½ÍÍ…Ñ•=¬é™…±Í”±É•…Í½¸è‹š*¢÷¢š?–&¢ò'–—’â´ˆ(€€€ôì)ô()™Õ¹Ñ¥½¸É•¹‘•ÉM­¥±±±•µ•¹ÑQ…‰Ì¡¡…É…Ñ•È±Í­¥±±=Ý¹•È¥ì(€€€½¹ÍÐ¡½ÍÐô ‰Í­¥±±±•µ•¹ÑQ…‰Ìˆ¤ì(€€€¥˜ …¡½ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€½¹ÍÐ¹…Ñ¥Ù•±•µ•¹ÐõMÑÉ¥¹œ ¡Í­¥±±=Ý¹•È˜™Í­¥±±=Ý¹•È¹•±•µ•¹Ð¥ñð¡¡…É…Ñ•È˜™¡…É…Ñ•È¹•±•µ•¹Ð¥ñð‰™¥É”ˆ¤ì(€€€½¹ÍÐ¡…É…Ñ•É-•äõMÑÉ¥¹œ¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Éñðˆˆ¤ì(€€€¥˜¡Í•±•Ñ•‘M­¥±±±•µ•¹Ñ¡…É…Ñ•É-•ä„ôõ¡…É…Ñ•É-•ä¥ì(€€€€€€€Í•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆõ¹…Ñ¥Ù•±•µ•¹Ðì(€€€€€€€Í•±•Ñ•‘M­¥±±±•µ•¹Ñ¡…É…Ñ•É-•äõ¡…É…Ñ•É-•äì(€€€ô(€€€¥˜ …=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±°¡M-%11}159Q}Q	}5Q±Í•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆ¤¥ì(€€€€€€€Í•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆõ¹…Ñ¥Ù•±•µ•¹Ðì(€€€ô(€€€¡½ÍÐ¹¥¹¹•É!Q50õ=‰©•Ð¹­•åÌ¡M-%11}159Q}Q	}5Q¤¹µ…À¡­•äôùì(€€€€€€€½¹ÍÐµ•Ñ„õM-%11}159Q}Q	}5Qm­•åtì(€€€€€€€½¹ÍÐ…Ñ¥Ù”õ­•äôôõÍ•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆì(€€€€€€€É•ÑÕÉ¸€œñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆÉ½±”ô‰Ñ…ˆˆ±…ÍÌô‰Í­¥±°µ•±•µ•¹ÐµÑ…ˆ€œ­µ•Ñ„¹±…ÍÍ9…µ”¬¡…Ñ¥Ù”üœ…Ñ¥Ù”œèœœ¤¬œˆ…É¥„µÍ•±•Ñ•ôˆœ¬¡…Ñ¥Ù”üÑÉÕ”œè™…±Í”œ¤¬œˆ½¹±¥¬ô‰Í•±•ÑM­¥±±±•µ•¹ÑQ…ˆ¡pœœ­­•ä¬pœ¤ˆøœ­µ•Ñ„¹±…‰•°¬œð½‰ÕÑÑ½¸øœì(€€€ô¤¹©½¥¸ ˆˆ¤ì)ô()™Õ¹Ñ¥½¸Í•±•ÑM­¥±±±•µ•¹ÑQ…ˆ¡Ñ…ˆ¥ì(€€€¥˜ …=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±°¡M-%11}159Q}Q	}5Q±Ñ…ˆ¤¥ìÉ•ÑÕÉ¸ìô(€€€Í•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆõÑ…ˆì(€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì)ô)Ý¥¹‘½Ü¹Í•±•ÑM­¥±±±•µ•¹ÑQ…ˆõÍ•±•ÑM­¥±±±•µ•¹ÑQ…ˆì()™Õ¹Ñ¥½¸É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³šb¿šnÓšZÀñÍ•±•Ðû¢Ž‡–§–,ñ½ÁÑ¥½¸ûžjšZ–¶_¾ò0(€€€€€€ƒž>û–r¡U'šRçš"C–Þ›–>Ïžº·¦‚´¯’â–/–B7–¶_šZç–†+¾ò0(€€€€€€ƒšRçš"CžnÓš:—šnÓšZÃ¦
–/šZç–†+žjšZ–¶_¾ò0(€€€€€€ƒ¦†¿ž’ëžn»–&7¦ã’â·¢žK¢&Ëžj–B7–¶\¯ž¶'žÒk¾ò0(€€€€€€ƒ¢Þž.š/¦‚žj–"š>o–6‡ž&¦
?¢ò¿’â¢ÓŽ(€€€€¨¼((€€€½¹ÍÐ¹…µ•	½àô(€€€€€€€€ ‰Í­¥±±¡…É…Ñ•É9…µ•	½àˆ¤ì(((€€€¥˜¡¹…µ•	½à¥ì((€€€€€€€½¹ÍÐÍ•±•Ñ•‘%¹‘•àô(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èôôô‰Á±…å•ÈÌˆ(€€€€€€€€€€€€ü€È(€€€€€€€€€€€€èÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èôôô‰Á±…å•ÈÈˆ(€€€€€€€€€€€€ü€Ä(€€€€€€€€€€€€è€Àì((€€€€€€€½¹ÍÐÍ•±•Ñ•‘¡…É…Ñ•Èô(€€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡Í•±•Ñ•‘%¹‘•à¥ññÁ±…å•Èì((€€€€€€€¹…µ•	½à¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€¡Í•±•Ñ•‘¡…É…Ñ•È¹¥‘ñð‹¢žK¢&Èˆ¬¡Í•±•Ñ•‘%¹‘•à¬Ä¤¤¬(€€€€€€€€€€€€ˆ1Ø¸ˆ¬(€€€€€€€€€€€Í•±•Ñ•‘¡…É…Ñ•È¹±•Ù•°ì((€€€ô(((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ±½…‘½ÕÐ€ô(€€€€€€€€ ‰Í­¥±±1½…‘½ÕÐˆ¤ì(((€€€½¹ÍÐ…±±1¥ÍÐ€ô(€€€€€€€€ ‰…±±M­¥±±Í1¥ÍÐˆ¤ì(((€€€±½…‘½ÕÐ¹¥¹¹•É!Q50ôˆˆì((€€€…±±1¥ÍÐ¹¥¹¹•É!Q50ôˆˆì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š*¢÷¦7¢Žt(€€€€€€ƒ–>«¦†¿ž’é¥½»¢Þ–B7ž¢Ç¾ò3–Û¦’c¦÷žržV—¾ò3’âš:H(€€€€€€ƒ–no–/š:K’â¢ÖßŽ7¾ò'¾òh(€€€€€€ƒ–:šr³š¾?š‚ó–Ÿ–ºç’â–’Ÿ’âË¾ò#–"¦†x¿¢ª«šb8½M@¼(€€€€€€ƒžžï¦f“š2'¦"W¾ò'¾ò3šRçš"C–>«šr'–r[ž’è¯–B7ž¢Ç–§¢†3¾ò0(€€€€€€ƒ¦î{š‚ó–¶Cšr³¢ê¯žnÓš:—¢žãžfóžžï¦f“¾ò#šr'¢Žw–
gšf¾ò$(€€€€€€ƒ¾ò3’â7–7¦r¢š¦†7–’[žjžžï¦f“š2'¦"WšZ–¶_’öS’ö7žö»Ž(€€€€¨¼((€€€™½È (€€€€€€€±•Ð¤ôÀì(€€€€€€€¤ðÐì(€€€€€€€¤¬¬(€€€€¥ì((€€€€€€€½¹ÍÐÍ­¥±±%€ô(€€€€€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ím¥tì(((€€€€€€€½¹ÍÐ‰½à€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðˆì(((€€€€€€€¥˜¡Í­¥±±%˜™Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘t¥ì((€€€€€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€¥ô‰±½…‘½ÕÑ%½¹|‘íÍ­¥±±%‘ôˆ(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¥½¸ˆ(€€€€€€€€€€€€€€€ÍÑå±”ô‰‰…­É½Õ¹µ¥µ…”è‘í•ÑM­¥±±%½¹	…­É½Õ¹‘%µ…”¡Í­¥±±%¥ôìˆ(€€€€€€€€€€€€øð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¹…µ”ˆø(€€€€€€€€€€€€€€€€‘íÍ­¥±°¹¹…µ•ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì(((€€€€€€€€€€€‰½à¹½¹±¥¬ô(€€€€€€€€€€€€€€€€ ¤ôùÉ•µ½Ù•ÅÕ¥ÁÁ•‘M­¥±°¡¤¤ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€€€€€(€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¥½¸ˆøð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ±½…‘½ÕÐµÍ±½Ðµ¹…µ”ˆ(€€€€€€€€€€€€€€€ÍÑå±”ô‰½±½ÈèŒØÐÜÐáˆìˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€ƒž¦è(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ì((€€€€€€€ô(((€€€€€€€±½…‘½ÕÐ¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€‰½à(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7žR£ž&ç–"”(€€€€€€ƒ–7–k’â–/–ÞË–¶ãšrš*¢÷žjš†’ê¾ò3š.ÿš:'¾ò0(€€€€€€ƒž>û–r£š*¢÷–ÂÇšb¿žR£’âš:K’âš:K–F#ž>û¾ò3šÊK–¶ãžþH(€€€€€€ƒžj–ÂÇ¦†¿ž’ëšr«–¶ãžþK–ÂÇ––÷Ž7¾ò'¾òh(€€€€€€ƒ–:šr³Ž3–ÞË–¶ãšrš*¢÷Ž7Ž3–>¿–¶ãžþKš*¢÷Ž7šb¼(€€€€€€ƒ–§–/–B¢«ž6£ž®/žj™½É…£¢þÓ–r#¾ò3–B¢¨(€€€€€€…ÁÁ•¹‘¡¥±“–"Ã’â7–B3–ºç–f£Ž–B#’ö×š"C’â–,(€€€€€€ƒ¢þÓ–r#¾ò3’âš²‡¢ÞG¦;¦g–/¢žK¢&Ë–žÒƒ–êW’â/žj(€€€€€€ƒ–£¦£š*¢÷¾ò3š¾?’â–"_¢«–ÞÇ–"“šZßŽ3¦
šÊK–¶ã¾ò<(€€€€€€ƒ–ÞË–¶ãšr«šîÿžÒk¾ò?–ÞËšîÿžÒkŽ7¢¦Ë¦†¿ž’ë–N«ž¢»ž.š/¾ò0(€€€€€€ƒ–£¦¡…ÁÁ•¹“–"Ã–B3’â–-…±±1¥ÍÓ–ºç–f£Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±1•Ù•±Ì€ô(€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Íñð(€€€€€€€íôì(((€€€€¼¨(€€€€€€ƒŠbƒ¦g–/¢žK¢&Ë¢3–ú3žrš¶žj¢ÎšZgž&§’îØ(€€€€€€ƒ¾ò!Á±…å•Ëš"YÁ±…å•ÈË¾ò'¾ò0(€€€€€€ƒžR£’úš~—¢¦ˆ¿¦†¿ž’ëš*¢÷¦î{šVã¦?Ž(€€€€€€Ý…Ñ•È½Ý¥¹“žn»–&7¦
šÊKšr'žrš¶žj¢žK¢&Ë¢ÎšZg¾ò0(€€€€€€Í­¥±±=Ý¹•Ëšršb½¹Õ±³¾ò0(€€€€€€ƒ’â/¦v‹žR£–"Ãžj–rÃšZç¦÷¢š¦bË–F¢fWžB(€€€€€€ƒ¾ò#¢š[ž
èÃ¦î{š*¢÷¦î{¾ò3–£¦£š*¢÷¦÷’â7¢÷–¶à¿–6¾ò'Ž(€€€€¨¼((€€€½¹ÍÐÍ­¥±±=Ý¹•Èô(€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð (€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€¤ì((€€€É•¹‘•ÉM­¥±±±•µ•¹ÑQ…‰Ì¡¡…É…Ñ•È±Í­¥±±=Ý¹•È¤ì(((€€€½¹ÍÐ…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌõ5…Ñ ¹µ…à (€€€€€€€€À°(€€€€€€€9Õµ‰•È¡Í­¥±±=Ý¹•È€üÍ­¥±±=Ý¹•È¹Í­¥±±A½¥¹ÑÌ€è€À¥ñðÀ(€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š*¢÷š:Kž& (€€€€€€ƒ–Š{–*ƒ–ÞË–¶ãžþH¿šr«–¶ãžþKžjšZ–¶_–"¦jS–6–†+¾ò0(€€€€€€ƒ’â7žR£š†žÞk¾ò3–>«¢ššZ–¶_–6¦jS¾òošr«–¶ãžþKžj(€€€€€€ƒš*¢÷’âš^›–¶ãšr¾ò3¢«–.W¢ÞG–"Ã–ÞË–¶ãžþK¦
¦
+Ž7¾ò'¾òh(€€€€€€ƒ–:šr³šb¿–Z»’â–-™½É…£Ž’úw¢ÎšZg–ê¯–:–ž,(€€€€€€ƒ¦‚–ê?žnÓš:—š*+š¾?’â–"]…ÁÁ•¹“’â+–:ïŽšRçš"C– (€€€€€€ƒž¾§–ë¦g–/¢žK¢&Ë–žÒƒ–êW’â/žj–£¦£š*¢õ¥“¾ò0(€€€€€€ƒ–"š"CŽ3–ÞË–¶ãžþKŽ7Ž3šr«–¶ãžþKŽ7–§žÖ¦f–"_¾ò0(€€€€€€ƒ–/–"—šâËš~OŽ–nƒž
ëš¾?š²…É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤(€€€€€€ƒ¦÷šb¿¦7šZÃ–"žÖ¾ò#’â7šb¿–¶c’â’î÷Ž3–ÞË–¶ãžþH(€€€€€€ƒšâ–Z»Ž7–þ¯–>[¾ò'¾ò3–>«¢š–¶ã’êšZÃš*¢÷Ž(€€€€€€Í­¥±±1•Ù•±Ï¢º+’ê¾ò3’â/š²‡¦7žæ«–ÂÇšr¢«–.T(€€€€€€ƒ¢Š¯–"–"ÃŽ3–ÞË–¶ãžþKŽ7¦
žÖ¾ò3’â7žR£¦†7–’[–¾¬(€€€€€€ƒŽ3šB³žžïŽ7žj¦
?¢ò¿Ž(€€€€¨¼((€€€½¹ÍÐµ…Ñ¡¥¹M­¥±±%‘Ìô((€€€€€€€=‰©•Ð¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤(€€€€€€€€¹™¥±Ñ•È¡Í­¥±±%ôùì((€€€€€€€€€€€½¹ÍÐÍ­¥±°ô(€€€€€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€€€€€Í­¥±°€˜˜Í­¥±°¹•±•µ•¹Ð€˜˜(€€€€€€€€€€€€€€€=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±°¡Í­¥±°°‰±•…É¹1•Ù•°ˆ¤€˜˜(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éä„ôô‰µ½¹ÍÑ•Èˆ€˜˜(€€€€€€€€€€€€€€€Í­¥±°¹•±•µ•¹ÐôôõÍ•±•Ñ•‘M­¥±±±•µ•¹ÑQ…ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô¤ì(((€€€½¹ÍÐÁÉ½É•ÍÍ¥½¹=É‘•ÈõíÁ¡åÍ¥…°èÀ±µ…¥ŒèÄ±Ñ…Ñ¥…°èÈ±•àèÍôì(€€€µ…Ñ¡¥¹M­¥±±%‘Ì¹Í½ÉÐ ¡„±ˆ¤ôùì(€€€€€€€½¹ÍÐ…M­¥±°õÍ­¥±±…Ñ…‰…Í•m…uññíôì(€€€€€€€½¹ÍÐ‰M­¥±°õÍ­¥±±…Ñ…‰…Í•m‰uññíôì(€€€€€€€½¹ÍÐ…1•…É¹•ô¡Í­¥±±1•Ù•±Ím…uñðÀ¤øÀì(€€€€€€€½¹ÍÐ‰1•…É¹•ô¡Í­¥±±1•Ù•±Ím‰uñðÀ¤øÀì(€€€€€€€¥˜¡…1•…É¹•„ôõ‰1•…É¹•¥ìÉ•ÑÕÉ¸…1•…É¹•ü´ÄèÄìô(€€€€€€€½¹ÍÐ…É½ÕÀõÁÉ½É•ÍÍ¥½¹=É‘•ÉmMÑÉ¥¹œ¡…M­¥±°¹ÁÉ½É•ÍÍ¥½¹É½ÕÁñðˆˆ¥tüüääì(€€€€€€€½¹ÍÐ‰É½ÕÀõÁÉ½É•ÍÍ¥½¹=É‘•ÉmMÑÉ¥¹œ¡‰M­¥±°¹ÁÉ½É•ÍÍ¥½¹É½ÕÁñðˆˆ¥tüüääì(€€€€€€€¥˜¡…É½ÕÀ„ôõ‰É½ÕÀ¥ìÉ•ÑÕÉ¸…É½ÕÀµ‰É½ÕÀìô(€€€€€€€½¹ÍÐ…1•Ù•°õ9Õµ‰•È¡…M­¥±°¹±•…É¹1•Ù•°¥ñðÀì(€€€€€€€½¹ÍÐ‰1•Ù•°õ9Õµ‰•È¡‰M­¥±°¹±•…É¹1•Ù•°¥ñðÀì(€€€€€€€¥˜¡…1•Ù•°„ôõ‰1•Ù•°¥ìÉ•ÑÕÉ¸…1•Ù•°µ‰1•Ù•°ìô(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡…M­¥±°¹¹…µ•ññ„¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡‰M­¥±°¹¹…µ•ññˆ¤¤ì(€€€ô¤ì(((€€€€¼¨(€€€€€€ƒŠbƒš*+Ž3žÖ–ë’â–"_š*¢õÉ½ßŽ7¦gšº×¦
?¢ò¿š*÷š"@(€€€€€€ƒž6£ž®/–÷–ò?¾ò3–ÞË–¶ãžþH¿šr«–¶ãžþK–§žÖ¦÷–Fó–>¬(€€€€€€ƒ–B3’â’î÷¾ò3’â7žR£–¾¯–§š²‡’âš¢žj!Q53žÖ–¶_’âËŽ(€€€€¨¼((€€€™Õ¹Ñ¥½¸‰Õ¥±‘M­¥±±I½Ý±•µ•¹Ð¡Í­¥±±%¥ì((€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€½¹ÍÐ±•Ù•°€ô(€€€€€€€€€€€Í­¥±±1•Ù•±ÍmÍ­¥±±%‘uñð(€€€€€€€€€€€€Àì(((€€€€€€€½¹ÍÐ¥Í1•…É¹•€ô(€€€€€€€€€€€±•Ù•°øÀì(((€€€€€€€½¹ÍÐ•ÅÕ¥ÁÁ•€ô(€€€€€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€€€€€¹¥¹±Õ‘•Ì¡Í­¥±±%¤ì(((€€€€€€€½¹ÍÐ¥Í5…á1•Ù•°€ô(€€€€€€€€€€€¥Í1•…É¹•€˜˜(€€€€€€€€€€€±•Ù•°øô(€€€€€€€€€€€€¡Í­¥±°¹µ…á1•Ù•±ñðÄ¤ì(((€€€€€€€½¹ÍÐ•±¥¥‰¥±¥Ñäõ•ÑM­¥±±1•…É¹±¥¥‰¥±¥Ñå½ÉU¤¡Í­¥±±=Ý¹•È±Í­¥±°±Í­¥±±1•Ù•±Ì¤ì(€€€€€€€½¹ÍÐ±•…É¹½ÍÐõ•±¥¥‰¥±¥Ñä¹±•…É¹½ÍÐì(€€€€€€€½¹ÍÐ…¹™™½Éõ•±¥¥‰¥±¥Ñä¹Á½¥¹ÑÍ=¬ì(€€€€€€€½¹ÍÐÕÁÉ…‘•±¥¥‰¥±¥Ñäõ¥Í1•…É¹•€˜˜(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜˜(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÌØÑ•ÑM­¥±±UÁÉ…‘•±¥¥‰¥±¥Ñäôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ýÝ¥¹‘½Ü¹ØÄÜÌØÑ•ÑM­¥±±UÁÉ…‘•±¥¥‰¥±¥Ñä¡Í­¥±±=Ý¹•È±Í­¥±°±±•Ù•°¤(€€€€€€€€€€€€é¹Õ±°ì(((€€€€€€€½¹ÍÐ‰½à€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€‰Í­¥±°µÉ½Üˆì(€€€€€€€‰½à¹‘…Ñ…Í•Ð¹Í­¥±±%õÍ­¥±±%ì(((€€€€€€€±•Ð…Ñ¥½¹1…‰•°ì(€€€€€€€±•Ð…Ñ¥½¹=¹±¥¬ì(€€€€€€€±•Ð…Ñ¥½¹¥Í…‰±•ì(((€€€€€€€½¹ÍÐÁÉ•É•Å5•Ðõ•±¥¥‰¥±¥Ñä¹ÁÉ•É•ÅÕ¥Í¥Ñ•=¬ì(((€€€€€€€¥˜ …¥Í1•…É¹•¥ì((€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–&7žö¸(€€€€€€€€€€€€€€ƒš*¢÷¢š–¶ãžjš¦–"ÛŽ7¾ò3’âS¢šŽ3–º3–£’â7¢ô(€€€€€€€€€€€€€€ƒ¦î{Ž7¾ò'¾òh(€€€€€€€€€€€€€€ƒ–&7žö»šÊK¦Sš"Cšf–«–#¦†¿ž’ë¦:[’ö?ž.š/¾ò0(€€€€€€€€€€€€€€ƒ¢N/¦;–:šr³žjŽ3–¶ãžþK¾ò?¦î{šVã’â7¢ÚÏŽ4(€€€€€€€€€€€€€€ƒ–"“šZß¾ò3š2'¦"W–òß–"Ù‘¥Í…‰±•õÑÉÕ—¾ò0(€€€€€€€€€€€€€€ƒž:§–ºÛ¦¦î{¦÷¦î{’â7’ê¾ò!Í•—’â+¦vˆ(€€€€€€€€€€€€€€€¹Í­¥±°µ…Ñ¥½¸µ…É¹‘¥Í…‰±•“žj(€€€€€€€€€€€€€€Á½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹—¾ò3’æ/–&7¦g¢Ž„(€€€€€€€€€€€€€€ƒšr'–-±…ÍÏ–¶_’âË–ÂGš&O’â–/ž¦ëš‚óžj(€€€€€€€€€€€€€€‰ÕŸ¾ò3¦‚’úÿ’þ»š:'¾ò3’â7žÙ‘¥Í…‰±•(€€€€€€€€€€€€€€ƒš¢–ò?–Û–¾›–ú{’úšÊKžržjžRšV#¦;¾ò'Ž(€€€€€€€€€€€€¨¼((€€€€€€€€€€€…Ñ¥½¹1…‰•°õ•±¥¥‰¥±¥Ñä¹…±±½Ý•(€€€€€€€€€€€€€€€€ü‹–¶ãžþKŽìˆ­±•…É¹½ÍÐ¬‹¦îxˆ(€€€€€€€€€€€€€€€€é•±¥¥‰¥±¥Ñä¹É•…Í½¸ì((€€€€€€€€€€€…Ñ¥½¹=¹±¥¬ô(€€€€€€€€€€€€€€€€‰±•…É¹M­¥±° œˆ­Í­¥±±%¬ˆœ¤ˆì((€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•ô…•±¥¥‰¥±¥Ñä¹…±±½Ý•ì((€€€€€€€ô(€€€€€€€•±Í”¥˜¡¥Í5…á1•Ù•°¥ì((€€€€€€€€€€€…Ñ¥½¹1…‰•°ô‹–ÞËšîÿžÒhˆì((€€€€€€€€€€€…Ñ¥½¹=¹±¥¬ô(€€€€€€€€€€€€€€€€‰ÕÁÉ…‘•M­¥±° œˆ­Í­¥±±%¬ˆœ¤ˆì((€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•ô(€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€ô(€€€€€€€•±Í•ì((€€€€€€€€€€€…Ñ¥½¹1…‰•°õÕÁÉ…‘•±¥¥‰¥±¥Ñä(€€€€€€€€€€€€€€€€ü¡ÕÁÉ…‘•±¥¥‰¥±¥Ñä¹…±±½Ý•(€€€€€€€€€€€€€€€€€€€€ü‹–6žÒkŽìˆ­ÕÁÉ…‘•±¥¥‰¥±¥Ñä¹½ÍÐ¬‹¦îxˆ(€€€€€€€€€€€€€€€€€€€€éÕÁÉ…‘•±¥¥‰¥±¥Ñä¹É•…Í½¸¤(€€€€€€€€€€€€€€€€è¡…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌðÄü‹¦î{šVã’â7¢ÚÌˆè‹–6žÒhˆ¤ì((€€€€€€€€€€€…Ñ¥½¹=¹±¥¬ô(€€€€€€€€€€€€€€€€‰ÕÁÉ…‘•M­¥±° œˆ­Í­¥±±%¬ˆœ¤ˆì((€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•õÕÁÉ…‘•±¥¥‰¥±¥Ñä(€€€€€€€€€€€€€€€€ü…ÕÁÉ…‘•±¥¥‰¥±¥Ñä¹…±±½Ý•(€€€€€€€€€€€€€€€€é…Ù…¥±…‰±•M­¥±±A½¥¹ÑÌðÄì((€€€€€€€ô(((€€€€€€€½¹ÍÐÍ¡½ÝÅÕ¥Á	ÕÑÑ½¸ô((€€€€€€€€€€€¥Í1•…É¹•€˜˜(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œ‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰¡•…°‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ(€€€€€€€€€€€€¤ì(((€€€€€€€‰½à¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€¥ô‰Í­¥±±%½¹|‘íÍ­¥±±%‘ôˆ(€€€€€€€€€€€±…ÍÌô‰Í­¥±°µÉ½Üµ¥½¸ˆ(€€€€€€€€€€€ÍÑå±”ô‰‰…­É½Õ¹µ¥µ…”è‘í•ÑM­¥±±%½¹	…­É½Õ¹‘%µ…”¡Í­¥±±%¥ôìˆ(€€€€€€€€øð½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰Í­¥±°µÉ½ÜµÑ•áÐˆø(€€€€€€€€€€€€ñˆø‘íÍ­¥±°¹¹…µ•ôð½ˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í­¥±°µ…Ñ•½Éäµ‰…‘”€‘íÍ­¥±°¹…Ñ•½Éåôˆø‘í•ÑM­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€¥Í1•…É¹•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‰1Ø¸ˆ­±•Ù•°¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆ¼ˆ­Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ô(€€€€€€€€€€€€ñ‰Èø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í­¥±°µÉ½Üµ‘•ÍŒˆø(€€€€€€€€€€€€€€€€‘íÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€€…¥Í1•…É¹•€˜˜(€€€€€€€€€€€€€€€€…ÁÉ•É•Å5•Ð˜™•±¥¥‰¥±¥Ñä¹ÁÉ•É•ÅÕ¥Í¥Ñ•I•ÅÕ¥É•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€(€€€€€€€€€€€€€€€€ñ‰Èø(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ô‰½±½Èè˜Ôå”Áˆìˆø(€€€€€€€€€€€€€€€€€€€ƒÂ~RH€‘í•±¥¥‰¥±¥Ñä¹É•…Í½¹ô(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ô(€€€€€€€€€€€€ñÍÁ…¸(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µÉ½Üµ‘•Ñ…¥°µ±¥¹¬ˆ(€€€€€€€€€€€€€€€½¹±¥¬ô‰Í¡½ÝM­¥±±•Ñ…¥° œ‘íÍ­¥±±%‘ôœ¤ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€ƒŠ›Š›¢¦ÏžÒÃ
ì(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…É‘ì(€€€€€€€€€€€€€€€…Ñ¥½¹¥Í…‰±•(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆ‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ôˆ(€€€€€€€€€€€‘…Ñ„µÍ­¥±°µ…Ñ¥½¸ô‰É½ÝÑ ˆ(€€€€€€€€€€€€‘í…Ñ¥½¹¥Í…‰±•ü‘¥Í…‰±•…É¥„µ‘¥Í…‰±•ô‰ÑÉÕ”ˆœè…É¥„µ‘¥Í…‰±•ô‰™…±Í”ˆô(€€€€€€€€€€€½¹±¥¬ôˆ‘í…Ñ¥½¹=¹±¥­ôˆ(€€€€€€€€ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…Éµ±…‰•°ˆø‘í…Ñ¥½¹1…‰•±ôð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€‘ì(€€€€€€€€€€€Í¡½ÝÅÕ¥Á	ÕÑÑ½¸(€€€€€€€€€€€€ü(€€€€€€€€€€€€(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…É‘ì(€€€€€€€€€€€€€€€€€€€•ÅÕ¥ÁÁ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€ˆ‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€ôˆ(€€€€€€€€€€€€€€€‘…Ñ„µÍ­¥±°µ…Ñ¥½¸ô‰•ÅÕ¥Àˆ(€€€€€€€€€€€€€€€€‘í•ÅÕ¥ÁÁ•ü‘¥Í…‰±•…É¥„µ‘¥Í…‰±•ô‰ÑÉÕ”ˆœè…É¥„µ‘¥Í…‰±•ô‰™…±Í”ˆô(€€€€€€€€€€€€€€€½¹±¥¬ô‰•ÅÕ¥ÁM­¥±° œ‘íÍ­¥±±%‘ôœ¤ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÌô‰Í­¥±°µ…Ñ¥½¸µ…Éµ±…‰•°ˆø‘ì(€€€€€€€€€€€€€€€€€€€•ÅÕ¥ÁÁ•(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹–ÞË¢Žw–
dˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€‹¢Žw–
dˆ(€€€€€€€€€€€€€€€ôð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆ(€€€€€€€ô(€€€€€€€€ì(((€€€€€€€É•ÑÕÉ¸‰½àì((€€€ô(((€€€µ…Ñ¡¥¹M­¥±±%‘Ì¹™½É… ¡Í­¥±±%ôùì(€€€€€€€…±±1¥ÍÐ¹…ÁÁ•¹‘¡¥±¡‰Õ¥±‘M­¥±±I½Ý±•µ•¹Ð¡Í­¥±±%¤¤ì(€€€ô¤ì(((€€€€¼¨(€€€€€€ƒŠbƒš¾?š²‡¦7šZÃšâËš~Oš*¢÷¦‚¦v‹šf¾ò0(€€€€€€ƒ¦‚’úÿ–B3š¶—’âš²‡¢«–.Wš"Ã¦²—žjš*¢÷’â/š.'¦ã–Z»¾ò0(€€€€€€ƒ¦gš¢¢Žw–
g¢º+’êŽ–¶ãšZÃš*¢÷’ê¾ò0(€€€€€€ƒ¦ã–Z»¦÷šr¢«–.W¢Þ’â+¾ò3’â7žR£š¾?–/–Fó–>­É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤(€€€€€€ƒžj–rÃšZç¦÷–B¢«¢¢c–ú_–7–Fó–>¯’âš²‡Ž(€€€€¨¼(€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÔÉMå¹M­¥±±A½¥¹Ñ¥ÍÁ±…äôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÄÔÉMå¹M­¥±±A½¥¹Ñ¥ÍÁ±…ä ¤ì(€€€ô()ô((¼¨(€€ƒžÖ–ëš*¢÷žn»–&7ž¶'žÒkžjšV#šzsšZ–¶_¢ª«šb;¾ò0(€€ƒžR£–r£š*¢÷¦7¢Žw¦‚¦v‹žÖ›ž:§–ºÛ–>¢Ž(¨¼((¼¨(€€ƒŠbƒš*¢÷–"¦†{š¢gžÆ“¾ò#šZÃ–Š{¾ò'¾òh(€€ƒž&§žB’âï–.W¾ò?šÎW¢†O’âï–.W¾ò?–Š{žn+’âï–.W¾ò?¢Š¯–.W¾ò0(€€ƒžÖÇ’â–ú{¦g¢Ž‡žR‹žRšZ–¶_¾ò0(€€ƒš*¢÷¦7¢Žwš²Ž–ÞË–¶ãš*¢÷Ž–>¿–¶ãš*¢÷’â'–/–rÃšZç¦÷–ÇžR£¾ò0(€€ƒžŠë’þw¦†¿ž’ëšZç–ò?’â¢ÓŽ(¨¼()™Õ¹Ñ¥½¸•ÑM­¥±±…Ñ•½Éå1…‰•°¡…Ñ•½Éä¥ì((€€€¥˜¡…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹ž&§žBˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰µ…¥Œˆ¥ì(€€€€€€€É•ÑÕÉ¸‹šÎW¢†Lˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹–Š{žn(ˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰¡•…°ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹šÊïžfˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹–ú§šÒìˆì(€€€ô((€€€¥˜¡…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€É•ÑÕÉ¸‹¢Š¯–.Tˆì(€€€ô((€€€É•ÑÕÉ¸ˆˆì()ô(()™Õ¹Ñ¥½¸•ÑM­¥±±™™•ÑAÉ•Ù¥•ÝQ•áÐ¡Í­¥±°±±•Ù•°¥ì((€€€€¼¨(€€€€€€ƒŠbƒžÒSš:Ÿ–‚Óš*¢÷¾ò#žn»–&7šb¿–Ã–Â¾ò3šÊKšr%‰…Í•…µ…—¾ò$(€€€€€€ƒ¢š–r£Ž3šr'–
ß–ºÏžjž&§žB¿šÎW¢†Oš*¢÷Ž7–"“šZß’æ/–&4(€€€€€€ƒ–#šRSš"«¢fWžB¾ò3’â7žÛšr¢Š¯’â/¦v‹¦
–/–"“šZÜ(€€€€€€ƒ¢ª“–"“š"CŽ3–
ß–ºÌÃŽ7žjšRïšN+š*¢÷¾ò0(€€€€€€ƒ¦†¿ž’ë–ëŽ3žn»–&7–
ß–ºÏžÒÃŽ7¦gž¢»¢ª“–Â;šZ–¶_Ž(€€€€¨¼((€€€¥˜ (€€€€€€€€ (€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€€€€€¤€˜˜(€€€€€€€€…Í­¥±°¹‰…Í•…µ…”€˜˜(€€€€€€€Í­¥±°¹™É••é•¡…¹”(€€€€¥ì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬(€€€€€€€€€€€€ˆ—š¦ž:–Ã–Âžn»š¢g¾ò0ˆ¬(€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¬(€€€€€€€€€€€€‹–n{–B#ž‡šÎW¢†3–.Tˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜ (€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ¦g¢Ž‡’æ/–&7–>«¦†¿ž’ëš*¢÷–~ëž’;–
ß–ºÏ¾ò0(€€€€€€€€€€ƒ–º3–£šÊKšr'žº_¦Ëž¯–žÒc¢Š¯–.Wžj¬ÄÀ—–*ƒš"C¾ò0(€€€€€€€€€€ƒ–Â;¢Óž:§–ºÛ–¶ã’ê¢Š¯–.W’æ/–ú3¾ò0(€€€€€€€€€€ƒ–r£¦g–/¦‚C¢š÷šVã–¶_’â+–º3–£žr/’â7–ë–Þ»žVÃ¾ò0(€€€€€€€€€€ƒ’î—ž
ë¢Š¯–.WšÊKšr'žRšV (€€€€€€€€€€ƒ¾ò#–¾›¦jo’â+š"Ã¦²—šf	…ÍÑ…µ…•M­¥±° §¢Ž„(€€€€€€€€€€ƒšr'š¶žŠë––_žR£¾ò3–>«šb¿¦g–/¦‚C¢š÷šVã–¶_šÊK¢Þ’â+¾ò'Ž(€€€€€€€€€€ƒž>û–r£¢Žs’â+¾ò3¢ºOž:§–ºÛ¢÷žnÓš:—–r£¦g¢Ž„(€€€€€€€€€€ƒžr/–"Ã–¶ã¢Š¯–.W–&7–ú3šVã–¶_žj¢º+–2[Ž(€€€€€€€€¨¼((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€€€€€ƒ¦g¢Ž‡’æ/–&7–>«¦†¿ž’ëš*¢÷–~ëž’;–
ß–ºÏ¾ò0(€€€€€€€€€€ƒ–º3–£šÊKšr'žº_¦Ë–žÒc¢Š¯–.Wžj–*ƒš"C¾ò0(€€€€€€€€€€ƒ–Â;¢Óž:§–ºÛ–¶ã’ê¢Š¯–.W’æ/–ú3¾ò0(€€€€€€€€€€ƒ–r£¦g–/¦‚C¢š÷šVã–¶_’â+–º3–£žr/’â7–ë–Þ»žVÃ¾ò0(€€€€€€€€€€ƒ’î—ž
ë¢Š¯–.WšÊKšr'žRšV (€€€€€€€€€€ƒ¾ò#–¾›¦jo’â+š"Ã¦²—šf	…ÍÑ…µ…•M­¥±° §¢Ž„(€€€€€€€€€€ƒšr'š¶žŠë––_žR£¾ò3–>«šb¿¦g–/¦‚C¢š÷šVã–¶_šÊK¢Þ’â+¾ò'Ž(€€€€€€€€€€ƒž>û–r£¢Žs’â+¾ò3¢ºOž:§–ºÛ¢÷žnÓš:—–r£¦g¢Ž„(€€€€€€€€€€ƒžr/–"Ã–¶ã¢Š¯–.W–&7–ú3šVã–¶_žj¢º+–2[Ž(€€€€€€€€€€ƒ¢Þ}…ÍÑ…µ…•M­¥±° §’âš¢¾ò0(€€€€€€€€€€ƒšRçš"C–.Wš/žR£Ž3–žÒ€­cŽ7š~—¢†£¾ò0(€€€€€€€€€€ƒšÂÓ–žÒc’æ¢÷š¶žŠë–>7šbƒ–r£¦g¢Ž‡Ž(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ•áM­¥±±%€ô(€€€€€€€€€€€Í­¥±°¹•±•µ•¹Ð¬(€€€€€€€€€€€€‰`ˆì(((€€€€€€€½¹ÍÐ•áM­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•m•áM­¥±±%‘tì(((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–žÒ€(€€€€€€€€€€ƒ¢Š¯–.W–º3–£šÊKžRšV#Ž7¾ò3¦g–/¦‚C¢š÷šVã–¶\(€€€€€€€€€€ƒ¢Þ}…ÍÑ…µ…•M­¥±° §ž*¿’ê–B3’â–,(€€€€€€€€€€‰ÕŸ¾ò'¾òh(€€€€€€€€€€ƒ’â7¢÷žR¡Í­¥±°¹•±•µ•¹ÓžVÛ¢žK¢&Ëš²’ö4(€€€€€€€€€€­•ç¾ò3¦g¢Ž‡šRçžR¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€€€ƒ¾ò#žn»–&7žV¯¦v‹’â+¦†¿ž’ëžjšb¿–N«–/¢žK¢&Ëžj(€€€€€€€€€€ƒš*¢÷–"_¢†£¾ò0‰™¥É”‹š"X‰Á±…å•ÈÈ‹¾ò'¾ò0(€€€€€€€€€€ƒ¢Þž:§–ºÛ–¾›¦jo–r£žr/¢ªÃžjš*¢÷’þwš2’â¢ÓŽ(€€€€€€€€¨¼((€€€€€€€½¹ÍÐ•á1•Ù•°€ô(€€€€€€€€€€€•ÑM­¥±±1•Ù•° (€€€€€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È°(€€€€€€€€€€€€€€€•áM­¥±±%(€€€€€€€€€€€€¤ì((((€€€€€€€½¹ÍÐÁ…ÍÍ¥Ù•5Õ±Ñ¥Á±¥•È€ô(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€•áM­¥±°€˜˜(€€€€€€€€€€€€€€€•á1•Ù•°øÀ€˜˜(€€€€€€€€€€€€€€€•áM­¥±°¹‘…µ…•	½¹ÕÍA•É•¹Ð(€€€€€€€€€€€€¤(€€€€€€€€€€€€ü(€€€€€€€€€€€€Ä¬(€€€€€€€€€€€•áM­¥±°¹‘…µ…•	½¹ÕÍA•É•¹Ð¼(€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€è(€€€€€€€€€€€€Äì(((€€€€€€€½¹ÍÐÁÉ•Ù¥•Ý…µ…”€ô(€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€•ÑM­¥±±…µ…•Ñ1•Ù•° (€€€€€€€€€€€€€€€€€€€Í­¥±°°(€€€€€€€€€€€€€€€€€€€±•Ù•°(€€€€€€€€€€€€€€€€¤¨(€€€€€€€€€€€€€€€Á…ÍÍ¥Ù•5Õ±Ñ¥Á±¥•È(€€€€€€€€€€€€¤ì(((€€€€€€€±•ÐÑ•áÐ€ô(€€€€€€€€€€€€‹žn»–&7–
ß–ºÏžÒˆ¬(€€€€€€€€€€€ÁÉ•Ù¥•Ý…µ…”¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Á…ÍÍ¥Ù•5Õ±Ñ¥Á±¥•ÈøÄ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¾ò#–ÞË–B¬ˆ¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€•áM­¥±°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€•áM­¥±°¹¹…µ”(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€‹–*ƒš"C¾ò$ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì(((€€€€€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”¥ì((€€€€€€€€€€€Ñ•áÐ¬ô((€€€€€€€€€€€€€€€€‹¾öpˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—žžK¾ò ˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•±l(€€€€€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€€€€€t¬(€€€€€€€€€€€€€€€€ˆ—šr–’!C¾ò?–n{–B#¾ò$ˆì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì((€€€€€€€€€€€Ñ•áÐ¬ô((€€€€€€€€€€€€€€€€‹¾öpˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—–Ã–Â¾ò ˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¬(€€€€€€€€€€€€€€€€‹–n{–B#ž‡šÎW¢†3–.W¾ò$ˆì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾ös–Bã–>Xˆ­Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±m±•Ù•°´Åt¬ˆ—–
ß–ºÏ¾ò#–n{–ú¥!@½MC¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¬ˆ—¦f7šV<ˆ­Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹…¥±¥Ñå½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¬ˆ—¦f7¢÷–*lˆ­Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹ÍÑ…Ñ½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¬ˆ—¦f7¦bÈˆ­Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹‘•™•¹Í•½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹ÍÑÕ¹¡…¹”¬ˆ—šj#žr§¾ò15%ML€¬ˆ­Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò ˆ¬¡Í­¥±°¹ÍÑÕ¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾öpˆ­Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•±m±•Ù•°´Åt¬ˆ—ž~Ï–2[¾ò ˆ¬¡Í­¥±°¹Á•ÑÉ¥™åÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾ös¢«¢ê¯¢¶ßžnø€ˆ­Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•±m±•Ù•°´Åt¬‹¾ò ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Ñ•áÐ¬ô‹¾ös–£¦®S¢¶ßžnø€ˆ­Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•±m±•Ù•°´Åt¬‹¾ò ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò$ˆì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸Ñ•áÐì((€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€¥˜¡Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹ž"šN+ž:¾ò?ž"šN+–
ß–ºÌ€¬ˆ­Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•±m±•Ù•°´Åt¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹¦Z¢êËž:€¬ˆ­Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹¦bËžš›–*l€¬ˆ­Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹É•™±•ÑA•É•¹Ð¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹–>7–
Ü€ˆ­Í­¥±°¹É•™±•ÑA•É•¹Ð¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‹žVÃ–âãž.š/š*_šœ€¬ˆ­Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¬ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸ì(€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì((€€€€€€€½¹ÍÐ¡•…±µ½Õ¹Ð€ô(€€€€€€€€€€€Í­¥±°¹‰…Í•!•…°¬(€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°¨(€€€€€€€€€€€€¡±•Ù•°´Ä¤ì(((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€‹–n{–ú¥!C¾òk–~ëž’8ˆ¬(€€€€€€€€€€€¡•…±µ½Õ¹Ð¬(€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€!1%9}%9Q}=%%9P¬(€€€€€€€€€€€€‹¾òmMC¾òk–~ëž’8ˆ¬(€€€€€€€€€€€€¡Í­¥±°¹‰…Í•!•…±M@¬¡Í­¥±°¹¡•…±MAA•É1•Ù•±ñðÀ¤¨¡±•Ù•°´Ä¤¤¬(€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€MA}!1%9}%9Q}=%%9P¬(€€€€€€€€€€€€‹¾ò#šZ÷šRû¢šr³’êë’â7–n{–ú¥MC¾ò$ˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ¥ì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€‹–ú§šÒï–ú3š‹–ú¤ˆ¬(€€€€€€€€€€€Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•±l(€€€€€€€€€€€€€€€±•Ù•°´Ä(€€€€€€€€€€€t¬(€€€€€€€€€€€€ˆ—¢†¦<ˆ(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì((€€€€€€€É•ÑÕÉ¸Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸ì((€€€ô(((€€€É•ÑÕÉ¸ˆˆì()ô(()™Õ¹Ñ¥½¸±•…É¹M­¥±°¡Í­¥±±%¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾òh(€€€€€€ƒ–:šr³¦g¢Ž‡žnÓš:—š&Á±…å•È¹Í­¥±±A½¥¹ÑÏ¾ò0(€€€€€€ƒ’â7žº‡žn»–&7¦ãžjšb¿¢ªÃ¾ò3’â–ú/š&ž²³’â¢žK¢&Ëžj¦î{šVãŽ(€€€€€€ƒšRçš"C–#š~—–ëŽ3¦g–/¢žK¢&Ëžrš¶žj¢ÎšZgž&§’îÛŽ7¾ò0(€€€€€€Ý…Ñ•È½Ý¥¹“žn»–&7šÊKšr'žrš¶¢žK¢&Ë¢ÎšZg¾ò0(€€€€€€ƒžnÓš:—šN/š:'’â7¢÷–¶ã¾ò#¦†¿ž’ëš>Cž’ë¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ½Ý¹•Èô(€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð (€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€€…¡…É…Ñ•Èñð(€€€€€€€€…Í­¥±°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ …½Ý¹•È¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹¦g–/¢žK¢&Ë¦
šÊKšr'¦Z/šRûš*¢÷–¶ãžþK–*¢÷Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜ …¡…É…Ñ•È¹Í­¥±±1•Ù•±Ì¥ì((€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Ìõíôì((€€€ô(((€€€¥˜ (€€€€€€€€¡¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘uñðÀ¤øÀ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–&7žö»š*¢ô(€€€€€€ƒ¢š–¶ãžjš¦–"ÛŽ7¾ò'¾òh(€€€€€€U'’â+–ÞËžÚOš*+š2'¦"U‘¥Í…‰±•“šN/’ö?¦î{šN+’ê¾ò0(€€€€€€ƒ¦g¢Ž‡šb¿ž²³’ê3–Æ“¦bË¢¶ßŠSŠS¢B³’âšr'–"—žj–rÃšZä(€€€€€€ƒžæ{¦;žV¯¦v‹žnÓš:—–Fó–>­±•…É¹M­¥±° §¾ò0(€€€€€€ƒ–ú3ž®¿’âš¢¢ššN/’ö?¾ò3’â7¢÷–>«¦vƒ–&7ž®¿Ž(€€€€¨¼((€€€½¹ÍÐ•±¥¥‰¥±¥Ñäõ•ÑM­¥±±1•…É¹±¥¥‰¥±¥Ñå½ÉU¤ (€€€€€€€½Ý¹•È°(€€€€€€€Í­¥±°°(€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Ì(€€€€¤ì((€€€¥˜ …•±¥¥‰¥±¥Ñä¹…±±½Ý•¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€•±¥¥‰¥±¥Ñä¹É•…Í½¸¬(€€€€€€€€€€€€‹¾ò3š&7¢÷–¶ãžþKŽ0ˆ­Í­¥±°¹¹…µ”¬‹Ž7Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½¹ÍÐ±•…É¹½ÍÐõ•±¥¥‰¥±¥Ñä¹±•…É¹½ÍÐì(€€€½¹ÍÐ…Ù…¥±…‰±•A½¥¹ÑÌõ5…Ñ ¹µ…à À±9Õµ‰•È¡½Ý¹•È¹Í­¥±±A½¥¹ÑÌ¥ñðÀ¤ì((€€€¥˜¡…Ù…¥±…‰±•A½¥¹ÑÌñ±•…É¹½ÍÐ¥ì(€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š*¢÷¦î{’â7¢ÚÏ¾ò3¦r¢šˆ¬(€€€€€€€€€€€±•…É¹½ÍÐ¬(€€€€€€€€€€€€‹¦î{Žˆ(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½Ý¹•È¹Í­¥±±A½¥¹ÑÌõ…Ù…¥±…‰±•A½¥¹ÑÌµ±•…É¹½ÍÐì(((€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘tôÄì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸ÕÁÉ…‘•M­¥±°¡Í­¥±±%¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€½¹ÍÐ½Ý¹•Èô(€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð (€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€€¤ì(((€€€¥˜ (€€€€€€€€…¡…É…Ñ•Èñð(€€€€€€€€…Í­¥±°ñð(€€€€€€€€…¡…É…Ñ•È¹Í­¥±±1•Ù•±Ìñð(€€€€€€€€…½Ý¹•È(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÕÉÉ•¹Ñ1•Ù•°€ô(€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Íl(€€€€€€€€€€€Í­¥±±%(€€€€€€€uñð(€€€€€€€€Àì(((€€€¥˜¡ÕÉÉ•¹Ñ1•Ù•°ðôÀ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐµ…á1•Ù•°€ô(€€€€€€€Í­¥±°¹µ…á1•Ù•±ñð(€€€€€€€€Äì(((€€€¥˜¡ÕÉÉ•¹Ñ1•Ù•°øõµ…á1•Ù•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜¡½Ý¹•È¹Í­¥±±A½¥¹ÑÌðÄ¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š*¢÷¦î{’â7¢ÚÏŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€½Ý¹•È¹Í­¥±±A½¥¹ÑÌ´ôÄì(((€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘tô(€€€€€€€ÕÉÉ•¹Ñ1•Ù•°¬Äì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸•ÅÕ¥ÁM­¥±°¡Í­¥±±%¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€¹¥¹±Õ‘•Ì¡Í­¥±±%¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹±•¹Ñ øôÐ(€€€€¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹š¾?–/¢žK¢&Ëšr–’k–>«¢÷šRs–âØÓ–/š*¢÷Žˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€¹ÁÕÍ ¡Í­¥±±%¤ì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸É•µ½Ù•ÅÕ¥ÁÁ•‘M­¥±°¡¥¹‘•à¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€€€€€¹ÍÁ±¥” (€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€Ä(€€€€€€€€¤ì(((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢3–2¢žK¢&È€¼ƒžÚO–àIAƒ¢3–2(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð¥¹Ù•¹Ñ½Éå¥±Ñ•È€ô€‰•ÅÕ¥Áµ•¹Ðˆì)½¹ÍÐ%9Y9Q=Ie}Q=Ie}M1=Q}=U9P€ô€ÄÈÀì()™Õ¹Ñ¥½¸•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¥ì(€€€É•ÑÕÉ¸mÁ±…å•È°Á±…å•ÈÈ°Á±…å•ÈÍtì)ô()™Õ¹Ñ¥½¸•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¥ì(€€€É•ÑÕÉ¸•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¥m¥¹‘•átñð¹Õ±°ì)ô()™Õ¹Ñ¥½¸•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä¡¥¹‘•à¥ì(€€€É•ÑÕÉ¸•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¤(€€€€€€€€ü•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¥¹‘•à¤(€€€€€€€€è¹Õ±°ì)ô()™Õ¹Ñ¥½¸•Ñ%¹Ù•¹Ñ½ÉåÅÕ¥Áµ•¹ÑM±½Ð¡¥Ñ•µQåÁ”¥ì(€€€½¹ÍÐµ…Àõì(€€€€€€€Ý•…Á½¸è‰¡…¹ˆ°(€€€€€€€¡•±µ•Ðè‰¡•…ˆ°(€€€€€€€¡•…è‰¡•…ˆ°(€€€€€€€Í¡½Õ±‘•Èè‰Í¡½Õ±‘•Èˆ°(€€€€€€€…Éµ½Èè‰…Éµ½Èˆ°(€€€€€€€Í¡½•Ìè‰Í¡½•Ìˆ°(€€€€€€€…•ÍÍ½Éäè‰É¥¹œˆ°(€€€€€€€É¥¹œè‰É¥¹œˆ(€€€ôì(€€€É•ÑÕÉ¸µ…Ám¥Ñ•µQåÁ•tñð¹Õ±°ì)ô()™Õ¹Ñ¥½¸•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ¡¥¹‘•à¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¤ì(€€€¥˜ …¡…É…Ñ•È¤É•ÑÕÉ¸¹Õ±°ì((€€€¥˜¡¥¹‘•àôôôÀ¤É•ÑÕÉ¸•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì((€€€½¹ÍÐ­•äõ•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä¡¥¹‘•à¤ì(€€€É•ÑÕÉ¸•Ñ‘‘¥Ñ¥½¹…±¡…É…Ñ•É	…ÑÑ±•MÑ…ÑÌ¡¡…É…Ñ•È±­•ä¤ì)ô()™Õ¹Ñ¥½¸¡…¹•%¹Ù•¹Ñ½Éå¡…É…Ñ•È¡‘¥É•Ñ¥½¸¥ì(€€€½¹ÍÐÁ…ÉÑäõ•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¤ì(€€€±•Ð¹•áÐõ¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à­‘¥É•Ñ¥½¸ì(€€€¥˜¡¹•áÐðÀ¤¹•áÐõÁ…ÉÑä¹±•¹Ñ ´Äì(€€€¥˜¡¹•áÐøõÁ…ÉÑä¹±•¹Ñ ¤¹•áÐôÀì((€€€€¼¼ƒšr«–îëž®/žj¢žK¢&Ë’î7–>¿¦†¿ž’ëž²³’â'š‚ó¾ò3’ö’â7¢÷š*+ž¦ë¢žK¢&ËžVÛš"C–>¿¢Žw–
g¢žK¢&ËŽ(€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àõ¹•áÐì(€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€¥˜¡ÑåÁ•½˜Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä€ôôô€‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä¡¹•áÐ¤ì(€€€ô)ô()™Õ¹Ñ¥½¸Í•±•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•È¡¥¹‘•à¥ì(€€€½¹ÍÐÁ…ÉÑäõ•Ñ	…­Á…­A…ÉÑå¡…É…Ñ•ÉÌ ¤ì(€€€¥˜¡¥¹‘•àðÀñð¥¹‘•àøõÁ…ÉÑä¹±•¹Ñ ¤É•ÑÕÉ¸ì(€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àõ¥¹‘•àì(€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€¥˜¡Á…ÉÑåm¥¹‘•át€˜˜ÑåÁ•½˜Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä€ôôô€‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä¡¥¹‘•à¤ì(€€€ô)ô()™Õ¹Ñ¥½¸Íå¹¡…É…Ñ•ÉQ…‰ÍÉ½µ%¹Ù•¹Ñ½Éä¡¥¹‘•à¥ì(€€€¥˜¡¥¹‘•àôôôÀñð¥¹‘•àôôôÄñð¥¹‘•àôôôÈ¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ì€ôôô€‰™Õ¹Ñ¥½¸ˆ€˜˜(€€€€€€€€€€•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤¥ì(€€€€€€€€€€€€¼¼ƒ¦ÿ–4Í•±•Ñ¡…É…Ñ•É½ÉQ…‰Ìƒ–7š²‡¢žãžfðÉ•¹‘•É%¹Ù•¹Ñ½Éäƒ–ö‹š"C¦{¢þÓŽ(€€€€€€€€€€€ÍÑ…ÑÕÍ¡…É…Ñ•É%¹‘•àõ¥¹‘•àì(€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àõ¥¹‘•àì(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•Èõ•ÑA…ÉÑå¡…É…Ñ•É-•ä¡¥¹‘•à¤ì(€€€€€€€ô(€€€ô)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉQ…‰Ì ¥ì(€€€½¹ÍÐÝÉ…Àô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•ÉQ…‰Ìˆ¤ì(€€€¥˜ …ÝÉ…À¤É•ÑÕÉ¸ì((€€€½¹ÍÐ¡…É…Ñ•ÉÍ1¥ÍÐõmÁ±…å•È±Á±…å•ÈÈ±Á±…å•ÈÍtì(€€€½¹ÍÐ¡…É…Ñ•Èõ¡…É…Ñ•ÉÍ1¥ÍÑm¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•átì((€€€½¹ÍÐ±•™Ñ¥Í…‰±•õ¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àðôÀì(€€€½¹ÍÐÉ¥¡Ñ¥Í…‰±•õ¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•àøõ¡…É…Ñ•ÉÍ1¥ÍÐ¹±•¹Ñ ´Äñð€…¡…É…Ñ•ÉÍ1¥ÍÑm¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Åtì((€€€ÝÉ…À¹¥¹¹•É!Q50õ€(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ…ÉÉ½Üˆ(€€€€€€€€€€€…É¥„µ±…‰•°ô‹’â+’â–/¢žK¢&Èˆ(€€€€€€€€€€€€‘í±•™Ñ¥Í…‰±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬ô‰Í•±•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•È ‘í5…Ñ ¹µ…à À±¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à´Ä¥ô¤ˆûŠäð½‰ÕÑÑ½¸ø((€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ¹…µ”ˆø(€€€€€€€€€€€€ñÍÁ…¸ø‘í¡…É…Ñ•È€ü€¡¡…É…Ñ•È¹¥ñð€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¤¤€è€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€‘í¡…É…Ñ•È€ü€ñÍµ…±°±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ±•Ù•°ˆù1Ø¸‘í¡…É…Ñ•È¹±•Ù•°ñð€Åôð½Íµ…±°ù€€è€ñÍµ…±°±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ±•Ù•°ˆû–Âkšr«–îëž®,ð½Íµ…±°ùô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ…ÉÉ½Üˆ(€€€€€€€€€€€…É¥„µ±…‰•°ô‹’â/’â–/¢žK¢&Èˆ(€€€€€€€€€€€€‘íÉ¥¡Ñ¥Í…‰±•€ü€‰‘¥Í…‰±•ˆ€è€ˆ‰ô(€€€€€€€€€€€½¹±¥¬ô‰Í•±•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•È ‘í5…Ñ ¹µ¥¸¡¡…É…Ñ•ÉÍ1¥ÍÐ¹±•¹Ñ ´Ä±¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥ô¤ˆûŠèð½‰ÕÑÑ½¸ø(€€€€ì)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½ÉåMÑ…ÑÌ ¥ì(€€€½¹ÍÐÍÑ…ÑÌõ•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ•°ô ‰¥¹Ù•¹Ñ½ÉåMÑ…ÑÌˆ¤ì(€€€¥˜ …•°¤É•ÑÕÉ¸ì((€€€¥˜ …ÍÑ…ÑÌ¥ì(€€€€€€€•°¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•µÁÑäµ¡…É…Ñ•Èˆûž²³’â'¢žK¢&Ë–Âkšr«–îëž®,ð½‘¥Øøœì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¨(€€€€€€XÜß¾òh(€€€€€€ƒ¢3–2–âã¦žC¢Î¢¢+–>«žVd!@€¼MCŽ(€€€€€€ƒ–Û’î[¢÷–*ošRçžRÇž®/žæ«–>Ï’â+¢žKšRû–’Ÿ¦>‡¦Z/–V¢¦ÏžÒÃ¢Î¢¢+Ž(€€€€¨¼(€€€•°¹¥¹¹•É!Q50õ€(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÉ½Ü¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÁÉ¥µ…Éäˆø(€€€€€€€€€€€€ñÍÁ…¸ù!@ð½ÍÁ…¸øñˆø‘íÍÑ…ÑÌ¹µ…á!Aôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÉ½Ü¥¹Ù•¹Ñ½ÉäµÍÑ…ÐµÁÉ¥µ…Éäˆø(€€€€€€€€€€€€ñÍÁ…¸ùM@ð½ÍÁ…¸øñˆø‘íÍÑ…ÑÌ¹µ…áMAôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€ì)ô()™Õ¹Ñ¥½¸•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉÉ¥Ñ¥…±MÑ…ÑÌ¡¥¹‘•à¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•Ñ	…­Á…­¡…É…Ñ•È¡¥¹‘•à¤ì((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€€¼¼¥ÍÁ±…äÑ¡”•á¥ÍÑ¥¹œ¥¹‘•Á•¹‘•¹Ð½µ‰…Ð…ÑÑÉ¥‰ÕÑ•ÌìÉ•Ñ¥É•Í¥àµÍÑ…Ð(€€€€¼¼½•™™¥¥•¹ÑÌµÕÍÐ¹½Ð‰±½¬Ñ¡”!¥Ð€¼Ù…Í¥½¸‘•Ñ…¥°µ½‘…°¸(€€€½¹ÍÐÍÑ…ÑÌõ•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ¡¥¹‘•à¤ì(€€€½¹ÍÐÉ…•	Õ™˜ô¡¡…É…Ñ•È¹…Ñ¥Ù•	Õ™™Íññmt¤¹™¥¹¡‰Õ™˜ôù‰Õ™˜˜™‰Õ™˜¹ÑåÁ”ôôô‰É…”ˆ¤ì(€€€½¹ÍÐ•àõ¡…É…Ñ•È¹•±•µ•¹Ðôôô‰™¥É”ˆý•Ñ1•…É¹•‘±•µ•¹Ñ`¡¡…É…Ñ•È°‰™¥É”ˆ¤é¹Õ±°ì(€€€½¹ÍÐÁÉ½™¥±”õì(€€€€€€€¡…¹”é5…Ñ ¹µ¥¸¡I%Q}!9}5`±I%Q}!9}	M¬¡9Õµ‰•È¡ÍÑ…ÑÌ¹É¥Ñ¥…±¡…¹”¥ñðÀ¤¬¡9Õµ‰•È¡ÍÑ…ÑÌ¹ÍÑ…ÑÕÍÕÉ…ä¥ñðÀ¤¤¬(€€€€€€€€€€€€¡9Õµ‰•È¡•à˜™•à¹É¥Ñ¡…¹•	½¹ÕÍA•É•¹Ð¥ñðÀ¤¬¡9Õµ‰•È¡É…•	Õ™˜˜™É…•	Õ™˜¹‰½¹ÕÍA•É•¹Ð¥ñðÀ¤°(€€€€€€€µÕ±Ñ¥Á±¥•Èé5…Ñ ¹µ¥¸¡I%Q}5U1Q%A1%I}5`±I%Q}5U1Q%A1%I}	M¬¡9Õµ‰•È¡ÍÑ…ÑÌ¹É¥Ñ¥…±…µ…”¥ñðÀ¤¼ÄÀÀ¬(€€€€€€€€€€€€¡9Õµ‰•È¡•à˜™•à¹É¥Ñ…µ…•	½¹ÕÍA•É•¹Ð¥ñðÀ¤¼ÄÀÀ¬¡9Õµ‰•È¡É…•	Õ™˜˜™É…•	Õ™˜¹‰½¹ÕÍA•É•¹Ð¥ñðÀ¤¼ÄÀÀ¤(€€€ôì(€€€É•ÑÕÉ¸íÁ¡åÍ¥…°éì¸¸¹ÁÉ½™¥±•ô±µ…¥Œéì¸¸¹ÁÉ½™¥±•õôì)ô()™Õ¹Ñ¥½¸½Á•¹%¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥° ¥ì(€€€½¹ÍÐµ½‘…°ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±5½‘…°ˆ¤ì(€€€½¹ÍÐÑ¥Ñ±”ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±9…µ”ˆ¤ì(€€€½¹ÍÐ‰½‘äô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±MÑ…ÑÌˆ¤ì((€€€¥˜ …µ½‘…°ñð€…Ñ¥Ñ±”ñð€…‰½‘ä¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•È (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì((€€€½¹ÍÐÍÑ…ÑÌô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•ÉMÑ…ÑÌ (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì((€€€½¹ÍÐÉ¥Ñ¥…°ô(€€€€€€€•Ñ%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉÉ¥Ñ¥…±MÑ…ÑÌ (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì((€€€¥˜ …¡…É…Ñ•Èñð€…ÍÑ…ÑÌñð€…É¥Ñ¥…°¥ì(€€€€€€€Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ðô‹¢žK¢&Ë¢¦ÏžÒÃ¢Î¢¢(ˆì(€€€€€€€‰½‘ä¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•µÁÑäµ¡…É…Ñ•Èˆû¢žK¢&Ë–Âkšr«–îëž®,ð½‘¥Øøœì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€‘í¡…É…Ñ•È¹¥ñð€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥÷Ž1Ø¸‘í¡…É…Ñ•È¹±•Ù•±ñðÅõ€ì((€€€½¹ÍÐÉ½ÝÌõl(€€€€€€€l‰!@ˆ±ÍÑ…ÑÌ¹µ…á!At°(€€€€€€€l‰M@ˆ±ÍÑ…ÑÌ¹µ…áMAt°(€€€€€€€l‹šRïšN(ˆ±ÍÑ…ÑÌ¹…ÑÑ…­t°(€€€€€€€l‹¦bËžš˜ˆ±ÍÑ…ÑÌ¹‘•™•¹Í•t°(€€€€€€€l‹šfë–*lˆ±ÍÑ…ÑÌ¹¥¹Ñ•±±¥•¹•t°(€€€€€€€l‹¦®S¢Î¨ˆ±ÍÑ…ÑÌ¹Ù¥Ñ…±¥Ñåt°(€€€€€€€l‹¢÷¦<ˆ±ÍÑ…ÑÌ¹•¹•Éåt°(€€€€€€€l‹šV?š6Üˆ±ÍÑ…ÑÌ¹…¥±¥Ñåt°(€€€€€€€l‹–F÷’â´ˆ±ÍÑ…ÑÌ¹…ÕÉ…ä¬ˆ”‰t°(€€€€€€€l‹¦Z¦üˆ±ÍÑ…ÑÌ¹•Ù…Í¥½¸¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹žVÃ–âãš*_šœˆ±ÍÑ…ÑÌ¹ÍÑ…ÑÕÍI•Í¥ÍÑ…¹”¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹š*_šjÐˆ±ÍÑ…ÑÌ¹…¹Ñ¥É¥Ð¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹ž&§žBž"šN+ž:ˆ±É¥Ñ¥…°¹Á¡åÍ¥…°¹¡…¹”¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹ž&§žBž"šN+–
ß–ºÌˆ°¡É¥Ñ¥…°¹Á¡åÍ¥…°¹µÕ±Ñ¥Á±¥•È¨ÄÀÀ¤¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹šÎW¢†Ož"šN+ž:ˆ±É¥Ñ¥…°¹µ…¥Œ¹¡…¹”¹Ñ½¥á• Ä¤¬ˆ”‰t°(€€€€€€€l‹šÎW¢†Ož"šN+–
ß–ºÌˆ°¡É¥Ñ¥…°¹µ…¥Œ¹µÕ±Ñ¥Á±¥•È¨ÄÀÀ¤¹Ñ½¥á• Ä¤¬ˆ”‰t(€€€tì((€€€‰½‘ä¹¥¹¹•É!Q50ô(€€€€€€€É½ÝÌ¹µ…À (€€€€€€€€€€€€¡m¹…µ”±Ù…±Õ•t¤ôù€(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µÉ½Üˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø‘í¹…µ•ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñˆø‘íÙ…±Õ•ôð½ˆø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€(€€€€€€€€¤¹©½¥¸ ˆˆ¤¬(€€€€€€€€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¡…É…Ñ•Èµ‘•Ñ…¥°µ¹½Ñ”ˆø(€€€€€€€€€€€ƒšržÖ–F÷’â·ž:¾òtäÔ—¾ò/–F÷’â´—¾ò/šržÖ–F÷’â·–*ƒš"@—¾ò7žn»š¢g¦Z¦ü—¾ò7šržÖ–F÷’â·’â/¦f4—¾ò3šr–ú3¦fC–"ØÔ—¾öxää—Žñ‰Èø(€€€€€€€€€€€ƒ–F÷’â·Ž¦Z¦ÿŽžVÃ–âãš*_šŸ’ú¢«ž6£ž®/š"Ã¦²—¢¦{šŠwš"[šV#šzs¾òošV?š6ß–>«š>C¦®c–ëš&/¦–ê›Ž(€€€€€€€€ð½‘¥Øù€ì((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì)ô()™Õ¹Ñ¥½¸±½Í•%¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥° ¥ì(€€€½¹ÍÐµ½‘…°ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É•Ñ…¥±5½‘…°ˆ¤ì((€€€¥˜¡µ½‘…°¥ì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€ô)ô()™Õ¹Ñ¥½¸É•¹‘•ÉÅÕ¥Áµ•¹Ð ¥ì(€€€½¹ÍÐÉ¥ô ‰•ÅÕ¥Áµ•¹ÑÉ¥ˆ¤ì(€€€¥˜ …É¥¤É•ÑÕÉ¸ì(€€€É¥¹¥¹¹•É!Q50ôˆˆì((€€€½¹ÍÐ­•äõ•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ðõ­•ä€ü¡…É…Ñ•ÉÅÕ¥Áµ•¹Ñm­•åt€è¹Õ±°ì((€€€½¹ÍÐÍ±½ÑÌõl(€€€€€€€í­•äè‰¡•…ˆ±¹…µ”è‹¦‚´‰ô°(€€€€€€€í­•äè‰¡…¹ˆ±¹…µ”è‹š&,‰ô°(€€€€€€€í­•äè‰Í¡½Õ±‘•Èˆ±¹…µ”è‹¢¶ß¢T‰ô°(€€€€€€€í­•äè‰…Éµ½Èˆ±¹…µ”è‹¢†šr4‰ô°(€€€€€€€í­•äè‰Í¡½•Ìˆ±¹…µ”è‹¦z/–¶@‰ô°(€€€€€€€í­•äè‰É¥¹œˆ±¹…µ”è‹š"Kš2‰ô(€€€tì((€€€Í±½ÑÌ¹™½É… ¡Í±½Ðôùì(€€€€€€€½¹ÍÐ•±°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€•±°¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹Ðµ•±°ˆì((€€€€€€€½¹ÍÐ±…‰•°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€±…‰•°¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹ÐµÍ±½Ðµ±…‰•°ˆì(€€€€€€€±…‰•°¹Ñ•áÑ½¹Ñ•¹ÐõÍ±½Ð¹¹…µ”ì((€€€€€€€½¹ÍÐ‰½àõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€‰½à¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹ÐµÍ±½Ðˆì(€€€€€€€½¹ÍÐ¥Ñ•´õ•ÅÕ¥Áµ•¹Ð€ü•ÅÕ¥Áµ•¹ÑmÍ±½Ð¹­•åt€è¹Õ±°ì((€€€€€€€¥˜¡¥Ñ•´¥ì(€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹…‘ ‰¡…Ìµ¥Ñ•´ˆ¤ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹Ðµ¥½¸ˆø‘í¥Ñ•´¹¥½¸ñð€‹Š^‰ôð½‘¥Øù€ì(€€€€€€€€€€€‰½à¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹ØÄØäµ¥Ñ•´µ…ÉÐˆ¤¹™½É… ¡…ÉÐôù…ÉÐ¹±…ÍÍ1¥ÍÐ¹…‘ ‰¥¹Ù•¹Ñ½Éäµ‰…­Á…¬µÉ…É¥Ñäµ¹•ÕÑÉ…°ˆ¤¤ì(€€€€€€€€€€€‰½à¹Ñ¥Ñ±”õ¥Ñ•´¹¹…µ”ñðÍ±½Ð¹¹…µ”ì(€€€€€€€€€€€‰½à¹½¹±¥¬ô ¤ôù½Á•¹ÅÕ¥ÁÁ•‘%Ñ•´¡¥Ñ•´±Í±½Ð¹­•ä¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•ÅÕ¥Áµ•¹Ðµ¥½¸•µÁÑäˆû¾ò,ð½‘¥Øù€ì(€€€€€€€ô((€€€€€€€•±°¹…ÁÁ•¹‘¡¥±¡±…‰•°¤ì(€€€€€€€•±°¹…ÁÁ•¹‘¡¥±¡‰½à¤ì(€€€€€€€É¥¹…ÁÁ•¹‘¡¥±¡•±°¤ì(€€€ô¤ì)ô()™Õ¹Ñ¥½¸•Ñ¥±Ñ•É•‘%¹Ù•¹Ñ½Éå%Ñ•µÌ ¥ì(€€€½¹ÍÐ•ÅÕ¥Áµ•¹ÑQåÁ•Ìõl(€€€€€€€€‰Ý•…Á½¸ˆ°(€€€€€€€€‰¡•±µ•Ðˆ°(€€€€€€€€‰¡•…ˆ°(€€€€€€€€‰Í¡½Õ±‘•Èˆ°(€€€€€€€€‰…Éµ½Èˆ°(€€€€€€€€‰Í¡½•Ìˆ°(€€€€€€€€‰…•ÍÍ½Éäˆ°(€€€€€€€€‰É¥¹œˆ(€€€tì((€€€½¹ÍÐ™Õ¹Ñ¥½¹QåÁ•Ìõl(€€€€€€€€‰™Õ¹Ñ¥½¸ˆ°(€€€€€€€€‰ÕÑ¥±¥Ñäˆ°(€€€€€€€€‰­•äˆ°(€€€€€€€€‰ÅÕ•ÍÐˆ°(€€€€€€€€‰ÍÁ•¥…°ˆ(€€€tì((€€€É•ÑÕÉ¸¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹™¥±Ñ•È¡¥Ñ•´ôùì(€€€€€€€¥˜ …¥Ñ•´¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€¥˜¡IQ%I}	-A-}A=Q%=9}%L¹¡…Ì¡MÑÉ¥¹œ¡¥Ñ•´¹¥‘ñðˆˆ¤¤¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€¥˜¡¥¹Ù•¹Ñ½Éå¥±Ñ•Èôôô‰•ÅÕ¥Áµ•¹Ðˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸•ÅÕ¥Áµ•¹ÑQåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤ì(€€€€€€€ô((€€€€€€€¥˜¡¥¹Ù•¹Ñ½Éå¥±Ñ•Èôôô‰µ…Ñ•É¥…°ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸¥Ñ•´¹ÑåÁ”ôôô‰µ…Ñ•É¥…°ˆì(€€€€€€€ô((€€€€€€€¥˜¡¥¹Ù•¹Ñ½Éå¥±Ñ•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸™Õ¹Ñ¥½¹QåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤ì(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€€ƒŽ3ž&§–NŽ7š&ÿš:—¢^—šÂÓ¢"’â¢"³ž&§–NŽ(€€€€€€€€€€ƒšr«’ú–ššzsšZÃ–Š{–Âkšr«š¶ã¦†{žjšZÀÑåÁ—¾ò3’æ–#žVg–r£ž&§–N¦‚¾ò0(€€€€€€€€€€ƒ¦ÿ–7–nƒž
èU$ƒ–"¦†{šnÓšZÃ¦ƒš"Cš^‹šr'ž&§–NšGž¦ëžr/’â7–"ÃŽ(€€€€€€€€¨¼(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€…•ÅÕ¥Áµ•¹ÑQåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤€˜˜(€€€€€€€€€€€¥Ñ•´¹ÑåÁ”„ôô‰µ…Ñ•É¥…°ˆ€˜˜(€€€€€€€€€€€€…™Õ¹Ñ¥½¹QåÁ•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤(€€€€€€€€¤ì(€€€ô¤ì)ô()™Õ¹Ñ¥½¸Í•Ñ%¹Ù•¹Ñ½Éå¥±Ñ•È¡™¥±Ñ•È¥ì(€€€¥¹Ù•¹Ñ½Éå¥±Ñ•Èõ™¥±Ñ•Èì(€€€É•¹‘•É%¹Ù•¹Ñ½Éå%Ñ•µÌ ¤ì((€€€½¹ÍÐÍÉ½±±•Èô ‰¥¹Ù•¹Ñ½ÉåÉ¥‘MÉ½±°ˆ¤ì(€€€¥˜¡ÍÉ½±±•È¤ÍÉ½±±•È¹ÍÉ½±±Q½ÀôÀì)ô()½¹ÍÐ%9Y9Q=Ie}II%Qe}Q}Q=}U$õ=‰©•Ð¹™É••é”¡ì(€€€Ý¡¥Ñ”è‰Ý¡¥Ñ”ˆ±‰±Õ”è‰‰±Õ”ˆ±ÁÕÉÁ±”è‰ÁÕÉÁ±”ˆ±½É…¹”è‰½É…¹”ˆ°(€€€Á¥¹¬è‰É•ˆ°‰™½ÕÈµÍåµ‰½°ˆè‰µåÉ¥…ˆ±±½Üè‰Ý¡¥Ñ”ˆ±µ¥è‰‰±Õ”ˆ°(€€€¡¥ è‰ÁÕÉÁ±”ˆ±Á•É™•Ðè‰½É…¹”ˆ)ô¤ì()™Õ¹Ñ¥½¸•Ñ%¹Ù•¹Ñ½ÉåI…É¥Ñå…Ñ…-•ä¡¥Ñ•´¥ì(€€€¥˜ …¥Ñ•´¥ìÉ•ÑÕÉ¸€‰Ý¡¥Ñ”ˆìô(€€€½¹ÍÐÉ…Ý-•åÌõm¥Ñ•´¹É…É¥Ñå-•ä±¥Ñ•´¹ÅÕ…±¥Ñä±¥Ñ•´¹Ñ¥•É-•ä±¥Ñ•´¹±•…åQ¥•É-•åtì(€€€™½È¡½¹ÍÐÉ…Ü½˜É…Ý-•åÌ¥ì(€€€€€€€½¹ÍÐ­•äõMÑÉ¥¹œ¡É…Ýñðˆˆ¤¹Ñ½1½Ý•É…Í” ¤ì(€€€€€€€¥˜¡=‰©•Ð¹ÁÉ½Ñ½ÑåÁ”¹¡…Í=Ý¹AÉ½Á•ÉÑä¹…±°¡%9Y9Q=Ie}II%Qe}Q}Q=}U$±­•ä¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸­•äì(€€€€€€€ô(€€€ô(€€€É•ÑÕÉ¸€‰Ý¡¥Ñ”ˆì)ô()™Õ¹Ñ¥½¸•Ñ%¹Ù•¹Ñ½ÉåI…É¥Ñå-•ä¡¥Ñ•´¥ì(€€€É•ÑÕÉ¸%9Y9Q=Ie}II%Qe}Q}Q=}U%m•Ñ%¹Ù•¹Ñ½ÉåI…É¥Ñå…Ñ…-•ä¡¥Ñ•´¥uñð‰Ý¡¥Ñ”ˆì)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½Éå%Ñ•µÌ ¥ì(€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì(€€€½¹ÍÐÉ¥ô ‰¥¹Ù•¹Ñ½ÉåÉ¥ˆ¤ì(€€€¥˜ …É¥¤É•ÑÕÉ¸ì(€€€É¥¹¥¹¹•É!Q50ôˆˆì((€€€½¹ÍÐ¥Ñ•µÌõ•Ñ¥±Ñ•É•‘%¹Ù•¹Ñ½Éå%Ñ•µÌ ¤¹Í±¥” À±%9Y9Q=Ie}Q=Ie}M1=Q}=U9P¤ì((€€€™½È¡±•Ð¥¹‘•àôÀí¥¹‘•àñ%9Y9Q=Ie}Q=Ie}M1=Q}=U9Pí¥¹‘•à¬¬¥ì(€€€€€€€½¹ÍÐ¥Ñ•´õ¥Ñ•µÍm¥¹‘•átñð¹Õ±°ì(€€€€€€€½¹ÍÐ‰½àõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€‰½à¹±…ÍÍ9…µ”ô‰¥¹Ù•¹Ñ½Éäµ¥Ñ•´¥¹Ù•¹Ñ½Éäµ¥Ñ•´µ±…ÍÍ¥Œ€ˆ¬¡¥Ñ•´€ü€‰¡…Ìµ¥Ñ•´ˆè‰•µÁÑäˆ¤ì(€€€€€€€¥˜¡¥Ñ•´¥ì(€€€€€€€€€€€½¹ÍÐÉ…É¥Ñäõ•Ñ%¹Ù•¹Ñ½ÉåI…É¥Ñå-•ä¡¥Ñ•´¤ì(€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹…‘ ‰É…É¥Ñä´ˆ­É…É¥Ñä¤ì(€€€€€€€€€€€‰½à¹‘…Ñ…Í•Ð¹É…É¥ÑäõÉ…É¥Ñäì(€€€€€€€ô(€€€€€€€‰½à¹¥¹¹•É!Q50õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½ÉäµÍ±½Ðµ¹Õµ‰•Èˆø‘í¥¹‘•à¬Åôð½‘¥Øù€ì((€€€€€€€¥˜¡¥Ñ•´¥ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50¬õ€ñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ¥½¸ˆø‘í¥Ñ•´¹¥½¸ñð€‹Š^‰ôð½‘¥Øøñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ½Õ¹Ðˆø‘í¥Ñ•´¹½Õ¹ÐøÄ€ü€‹\ˆ­¥Ñ•´¹½Õ¹Ð€è€ˆ‰ôð½‘¥Øù€ì(€€€€€€€€€€€½¹ÍÐÉ•…±%¹‘•àõ¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹¥¹‘•á=˜¡¥Ñ•´¤ì(€€€€€€€€€€€‰½à¹½¹±¥¬ô ¤ôùì(€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¥¹Ù•¹Ñ½ÉåÉ¥€¹¥¹Ù•¹Ñ½Éäµ¥Ñ•´µ±…ÍÍ¥Œ¹¥ÌµÍ•±•Ñ•ˆ¤¹™½É… ¡Í•±•Ñ•ôùÍ•±•Ñ•¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰¥ÌµÍ•±•Ñ•ˆ¤¤ì(€€€€€€€€€€€€€€€‰½à¹±…ÍÍ1¥ÍÐ¹…‘ ‰¥ÌµÍ•±•Ñ•ˆ¤ì(€€€€€€€€€€€€€€€½Á•¹%Ñ•µ5½‘…°¡É•…±%¹‘•à¤ì(€€€€€€€€€€€ôì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€‰½à¹¥¹¹•É!Q50¬ôœñ‘¥Ø±…ÍÌô‰¥¹Ù•¹Ñ½Éäµ•µÁÑäµ‘½Ðˆû
Üð½‘¥Øøœì(€€€€€€€ô(€€€€€€€É¥¹…ÁÁ•¹‘¡¥±¡‰½à¤ì(€€€ô((€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¥¹Ù•¹Ñ½Éå…Ñ•½ÉåQ…‰Ìm‘…Ñ„µ™¥±Ñ•Étˆ¤¹™½É… ¡Ñ…ˆôùì(€€€€€€€½¹ÍÐ…Ñ¥Ù”õÑ…ˆ¹‘…Ñ…Í•Ð¹™¥±Ñ•Èôôõ¥¹Ù•¹Ñ½Éå¥±Ñ•Èì(€€€€€€€Ñ…ˆ¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ±…Ñ¥Ù”¤ì(€€€€€€€Ñ…ˆ¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µÍ•±•Ñ•ˆ±…Ñ¥Ù”€ü€‰ÑÉÕ”ˆ€è€‰™…±Í”ˆ¤ì(€€€ô¤ì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÌØÍMå¹Õ¹Ñ¥½¹…±¥á•Ìôôô‰™Õ¹Ñ¥½¸ˆ¥ìÝ¥¹‘½Ü¹ØÄÜÌØÍMå¹Õ¹Ñ¥½¹…±¥á•Ì ¤ìô)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹Ù•¹Ñ½Éä ¥ì(€€€½¹ÍÐ¡…É…Ñ•Èõ•Ñ	…­Á…­¡…É…Ñ•È¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¤ì(€€€½¹ÍÐ¹…µ•°ô ‰¥¹Ù•¹Ñ½Éå¡…É…Ñ•É9…µ”ˆ¤ì(€€€¥˜¡¹…µ•°¥ì(€€€€€€€¹…µ•°¹Ñ•áÑ½¹Ñ•¹Ðõ¡…É…Ñ•È€ü€‘í¡…É…Ñ•È¹¥ñð€‹¢žK¢&Èˆ¬¡¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Ä¥÷Ž1Ø¸‘í¡…É…Ñ•È¹±•Ù•±ñðÅõ€€èƒ¢žK¢&È‘í¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à¬Å÷Ž–Âkšr«–îëž®-€ì(€€€ô((€€€É•¹‘•É%¹Ù•¹Ñ½Éå¡…É…Ñ•ÉQ…‰Ì ¤ì(€€€É•¹‘•ÉÅÕ¥Áµ•¹Ð ¤ì(€€€É•¹‘•É%¹Ù•¹Ñ½Éå%Ñ•µÌ ¤ì(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÌÅMå¹%¹Ù•¹Ñ½ÉåA½ÉÑÉ…¥Ðôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€Ý¥¹‘½Ü¹ØÄÌÅMå¹%¹Ù•¹Ñ½ÉåA½ÉÑÉ…¥Ð ¤ì(€€€ô)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž&§–N¢¦ÏžÒÀ(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸•ÑMÑ…ÑQ•áÐ¡ÍÑ…ÑÌ¥ì((€€€¥˜ (€€€€€€€€…ÍÑ…ÑÌñð(€€€€€€€=‰©•Ð¹­•åÌ¡ÍÑ…ÑÌ¤¹±•¹Ñ ôôôÀ(€€€€¥ì((€€€€€€€É•ÑÕÉ¸‹šÊKšr'¦†7–’[¢÷–*o–*ƒš"CŽˆì((€€€ô(((€€€½¹ÍÐ¹…µ•Ì€ôì((€€€€€€€…ÑÑ…¬è‹šRïšN(ˆ°((€€€€€€€Ù¥Ñ…±¥Ñäè‹¦®S¢Î¨ˆ°((€€€€€€€•¹•Éäè‹¢÷¦<ˆ°((€€€€€€€¥¹Ñ•±±¥•¹”è‹šfë–*lˆ°((€€€€€€€‘•™•¹Í•A½¥¹ÑÌè‹¦bËžš˜ˆ°((€€€€€€€…¥±¥Ñäè‹šV?š6Üˆ°((€€€€€€€µ…á!@è‹šr–’!@ˆ°((€€€€€€€µ…áM@è‹šr–’M@ˆ°((€€€€€€€‘•™•¹Í”è‹¦bËžš˜ˆ((€€€ôì(((€€€±•Ð¡Ñµ°ôˆˆì(((€€€=‰©•Ð¹­•åÌ¡ÍÑ…ÑÌ¤(€€€€¹™½É… ¡­•äôùì((€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€ÍÑ…ÑÍm­•åtì(((€€€€€€€¥˜ …Ù…±Õ”¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€¡Ñµ°€¬ô((€€€€€€€€(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€‘í¹…µ•Ím­•åuññ­•å÷¾òh(€€€€€€€€€€€€ñˆø¬‘íÙ…±Õ•ô‘íl‰…ÕÉ…äˆ°‰•Ù…Í¥½¸‰t¹¥¹±Õ‘•Ì¡­•ä¤üˆ”ˆèˆ‰ôð½ˆø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ì((€€€ô¤ì(((€€€É•ÑÕÉ¸¡Ñµ°ñð(€€€€€€€€‹šÊKšr'¦†7–’[¢÷–*o–*ƒš"CŽˆì()ô(((¼¨(€€%Ñ•´ÁÉ•Í•¹Ñ…Ñ¥½¸±¥™•å±”½Ý¹•È¸(€€Q¡”µ½‘…°…±Ý…åÌ­••ÁÌ½¹”™É…µ”…¹½¹”ÍÉ½±°½¹ÑÉ…Ðì±…Ñ•È¥Ñ•´(€€™•…ÑÕÉ•Ìµ…äÍ•±•Ð„Í•µ…¹Ñ¥Œ½¹Ñ•¹Ðµ½‘”°‰ÕÐµÕÍÐ¹½ÐÉ•ÝÉ¥Ñ”™É…µ”(€€•½µ•ÑÉä½È¥¹™•ÈÑ¡”µ½‘”™É½´‰ÕÑÑ½¸Ñ•áÐ½‘¥Í…‰±•ÍÑ…Ñ”¸(¨¼)½¹ÍÐ%Q5}5=1}AIM9QQ%=9}5=L€ô¹•ÜM•Ð¡l(€€€€‰•ÅÕ¥Áµ•¹Ðˆ°(€€€€‰½µÁ…Ðˆ°(€€€€‰½µÁ…É¥Í½¸ˆ)t¤ì()™Õ¹Ñ¥½¸Í•Ñ%Ñ•µ5½‘…±AÉ•Í•¹Ñ…Ñ¥½¹5½‘”¡µ½‘”¥ì(€€€½¹ÍÐµ½‘…°ô ‰¥Ñ•µ5½‘…°ˆ¤ì(€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸€‰±½Í•ˆìô((€€€½¹ÍÐ¹½Éµ…±¥é•õ%Q5}5=1}AIM9QQ%=9}5=L¹¡…Ì¡µ½‘”¤(€€€€€€€€ýµ½‘”(€€€€€€€€è‰±½Í•ˆì((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€‰¥Ñ•´µµ½‘…°µµ½‘”µ•ÅÕ¥Áµ•¹Ðˆ°(€€€€€€€€‰¥Ñ•´µµ½‘…°µµ½‘”µ½µÁ…Ðˆ°(€€€€€€€€‰¥Ñ•´µµ½‘…°µµ½‘”µ½µÁ…É¥Í½¸ˆ(€€€€¤ì((€€€¥˜¡¹½Éµ…±¥é•ôôô‰±½Í•ˆ¥ì(€€€€€€€‘•±•Ñ”µ½‘…°¹‘…Ñ…Í•Ð¹ÁÉ•Í•¹Ñ…Ñ¥½¹5½‘”ì(€€€õ•±Í•ì(€€€€€€€µ½‘…°¹‘…Ñ…Í•Ð¹ÁÉ•Í•¹Ñ…Ñ¥½¹5½‘”õ¹½Éµ…±¥é•ì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰¥Ñ•´µµ½‘…°µµ½‘”´ˆ­¹½Éµ…±¥é•¤ì(€€€ô((€€€€¼¼Q¡”¹…Ñ¥Ù”¹…Ù¥…Ñ¥½¸¥Ì„Í•Á…É…Ñ”Á…¥¹ÐÁ±…¹”¸AÉ½©•Ðµ½‘…°ÍÑ…Ñ”(€€€€¼¼Ñ¡É½Õ ¥ÑÌ•á¥ÍÑ¥¹œ½¹Ñ•áÐ½Ý¹•È‰•™½É”•áÁ½Í¥¹œ¥Ñ•´½¹ÑÉ½±Ì¸(€€€Ý¥¹‘½Ü¹ØÄÐáMå¹½¹Ñ•áÑ9…Ù¥…Ñ¥½¸ü¸ ¤ì(€€€É•ÑÕÉ¸¹½Éµ…±¥é•ì)ô)Ý¥¹‘½Ü¹Í•Ñ%Ñ•µ5½‘…±AÉ•Í•¹Ñ…Ñ¥½¹5½‘”õÍ•Ñ%Ñ•µ5½‘…±AÉ•Í•¹Ñ…Ñ¥½¹5½‘”ì(()™Õ¹Ñ¥½¸½Á•¹%Ñ•µ5½‘…° (€€€Í±½Ñ%¹‘•à(¥ì((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍl(€€€€€€€€€€€Í±½Ñ%¹‘•à(€€€€€€€tì(((€€€¥˜ …¥Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð€ô(€€€€€€€Í±½Ñ%¹‘•àì(((€€€€ ‰¥Ñ•µ5½‘…±%½¸ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¥½¸ì(((€€€€ ‰¥Ñ•µ5½‘…±9…µ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¹…µ”ì(((€€€€ ‰¥Ñ•µ5½‘…±MÑ…ÑÌˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô((€€€€€€€€(€€€€€€€€‘ì(€€€€€€€€€€€¥Ñ•´¹ÑåÁ”ôôô‰Á½Ñ¥½¸ˆ(€€€€€€€€€€€€ü(€€€€€€€€€€€€ñ‘¥ØûšV#šzs¾òhñˆø‘í•ÑA½Ñ¥½¹™™•Ñ•ÍÉ¥ÁÑ¥½¸¡¥Ñ•´¹¥¥ôð½ˆøð½‘¥Øù€(€€€€€€€€€€€€è(€€€€€€€€€€€•ÑMÑ…ÑQ•áÐ¡¥Ñ•´¹ÍÑ…ÑÌ¤(€€€€€€€ô((€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€ÍÑå±”ôˆ(€€€€€€€€€€€€€€€µ…É¥¸µÑ½ÀèÝÁàì(€€€€€€€€€€€€€€€½±½ÈèˆÍ„ÔáŒì(€€€€€€€€€€€€ˆ(€€€€€€€€ø(€€€€€€€€€€€ƒ–R»–ç¾òh‘í¥Ñ•´¹ÁÉ¥•ñðÁôƒ¦G–æŒ(€€€€€€€€ð½‘¥Øø(€€€€€€€€ì(((€€€½¹ÍÐ•ÅÕ¥Á	ÕÑÑ½¸€ô(€€€€€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤ì((€€€½¹ÍÐ¥ÍÅÕ¥Áµ•¹Ðô(€€€€€€€ÑåÁ•½˜¥ÍÅÕ¥Áµ•¹Ñ%¹Ù•¹Ñ½ÉåQåÁ”ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ý¥ÍÅÕ¥Áµ•¹Ñ%¹Ù•¹Ñ½ÉåQåÁ”¡¥Ñ•´¹ÑåÁ”¤(€€€€€€€€€€€€è…l‰Á½Ñ¥½¸ˆ°‰µ…Ñ•É¥…°ˆ°‰¥Ñ•´ˆ°‰¡•ÍÐˆ°‰Ñ¥­•Ðˆ°‰‰±Õ•ÁÉ¥¹Ð‰t¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÑåÁ”¤ì((€€€Í•Ñ%Ñ•µ5½‘…±AÉ•Í•¹Ñ…Ñ¥½¹5½‘”¡¥ÍÅÕ¥Áµ•¹Ðü‰•ÅÕ¥Áµ•¹Ðˆè‰½µÁ…Ðˆ¤ì(((€€€•ÅÕ¥Á	ÕÑÑ½¸¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€‰‘…Ñ„µÍ±½Ðˆ(€€€€¤ì(((€€€¥˜ …¥ÍÅÕ¥Áµ•¹Ð¥ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€‹’â7–>¿¢Žw–
dˆì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½Á…¥Ñä€ô(€€€€€€€€€€€€ˆ¸Ðˆì((€€€ô(€€€•±Í•ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€‹ž¦ÿš"Ðˆì((€€€€€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½Á…¥Ñä€ô(€€€€€€€€€€€€ˆÄˆì((€€€ô(((€€€€ ‰¥Ñ•µ5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸½Á•¹ÅÕ¥ÁÁ•‘%Ñ•´ (€€€¥Ñ•´°(€€€Í±½Ð(¥ì((€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð€ô(€€€€€€€¹Õ±°ì(((€€€€ ‰¥Ñ•µ5½‘…±%½¸ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¥½¸ì(((€€€€ ‰¥Ñ•µ5½‘…±9…µ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€¥Ñ•´¹¹…µ”¬(€€€€€€€€‹¾ò#–ÞË¢Žw–
g¾ò$ˆì(((€€€€ ‰¥Ñ•µ5½‘…±MÑ…ÑÌˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô(€€€€€€€•ÑMÑ…ÑQ•áÐ (€€€€€€€€€€€¥Ñ•´¹ÍÑ…ÑÌ(€€€€€€€€¤ì(((€€€½¹ÍÐ•ÅÕ¥Á	ÕÑÑ½¸€ô(€€€€€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤ì(((€€€€¼¼I•½Á•¹¥¹œ•ÅÕ¥ÁÁ••…ÈµÕÍÐÉ•Ñ¥É”¡•ÍÐ½Ñ¥­•Ð…Ñ¥½¸Ù¥Í¥‰¥±¥Ñä¸(€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹‘¥ÍÁ±…äôˆˆì(€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì((€€€•ÅÕ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€‹¢¯’â,ˆì((€€€•ÅÕ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½Á…¥Ñä€ô(€€€€€€€€ˆÄˆì(((€€€•ÅÕ¥Á	ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Í±½Ð€ô(€€€€€€€Í±½Ðì((€€€Í•Ñ%Ñ•µ5½‘…±AÉ•Í•¹Ñ…Ñ¥½¹5½‘” ‰•ÅÕ¥Áµ•¹Ðˆ¤ì(((€€€€ ‰¥Ñ•µ5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•%Ñ•µ5½‘…° ¥ì((€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð€ô(€€€€€€€¹Õ±°ì(((€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤(€€€€€€€€¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰‘…Ñ„µÍ±½Ðˆ(€€€€€€€€¤ì(((€€€€ ‰¥Ñ•µ5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì((€€€Í•Ñ%Ñ•µ5½‘…±AÉ•Í•¹Ñ…Ñ¥½¹5½‘” ‰±½Í•ˆ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3šZ–¶_–’«–’h(€€ƒ–†{’â7’â/¾ò3–ÂÇžÊûžÂ‡¦†¿ž’ë¾ò3–ú3¦v‹žR£Š›Š›¢¦ÏžÒÀ(€€ƒ¢ºOž:§–ºÛ¦î{šN+¢ÞÏ–ë–º3šVÓ’î/žÒçŽ7¾ò'¾òh(€€ƒš*¢÷¢¦ÏžÒÃ¢Î¢¢+–ö#žª_¾ò3¢Þž&§–N¢¦ÏžÒÃ–ö#žª_–ÇžR (€€ƒ–B3’â––\¹¥Ñ•´µµ½‘…³š¢–ò?Ž	Í¡½ÝM­¥±±•Ñ…¥° ¤(€€ƒ–Bš*¢õ%¾ò3¢«–ÞÇ¦7šZÃš~—’âš²‡žn»–&7¢žK¢&È¿ž¶'žÒh(€€ƒž.š/¾ò3žÖ–ë–º3šVÓ¢ª«šb;šZ–¶_¾ò#’â7š"«šZß¾ò'Ž(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7žº‡š*¢÷šr'šÊKšr$(€€ƒ–¶ãžþK¾ò3¢¦ÏžÒÃ¢Î¢¢+¦÷¢šš*+š¾?š²‡–6žÒk–Š{–*ƒ–’k–ÂD(€€ƒ¦î{–
ß–ºÏŽš¦ž:—šVãš;¦êóš>C–6¾ò3–º3šVÓ¦†¿ž’ëŽ7¾ò'¾òh(€€ƒš*+š*¢÷–úy1Ø¸Ç–"ÃšîÿžÒkš¾?’âžÒkžjšVã–ó¦÷šR“¦Z/’ú(€€ƒ–"_–ë’ú¾ò3’â7žº‡ž:§–ºÛžn»–&7–¶ã’êšÊK–¶ãŽ–¶ã–"Ãž²°(€€ƒ–æûžÒk¾ò3¦g¢Ž‡¦÷šb¿–º3šVÓžj’â’î÷žâ÷¢†£ŠSŠS–
ß–ºÌ(€€ƒš*¢÷¦†7–’[š¢g–ëŽ3š¾?žÒh­cŽ7žj–në–ºk–Š{¦?¾ò0(€€ƒšZç’úÿž:§–ºÛ’âžróžr/–ëš"C¦Vß–æ–ê›¾ò3’â7žR£¢«–ÞÄ(€€ƒ’âžÒk’âžÒk–:ï–þžº_–Þ»–’k–ÂGŽ(¨¼()™Õ¹Ñ¥½¸‰Õ¥±‘M­¥±±1•Ù•±	É•…­‘½Ý¹!Q50¡Í­¥±°¥ì((€€€½¹ÍÐµ…á1•Ù•°ô(€€€€€€€Í­¥±°¹µ…á1•Ù•±ñð(€€€€€€€€Äì(((€€€±•Ð±¥¹•Ìô(€€€€€€€mtì(((€€€™½È (€€€€€€€±•Ð±ØôÄì(€€€€€€€±Øðõµ…á1•Ù•°ì(€€€€€€€±Ø¬¬(€€€€¥ì((€€€€€€€±•ÐÁ…ÉÑÌô(€€€€€€€€€€€mtì(((€€€€€€€¥˜ (€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°‰ñð(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ(€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€Í­¥±°¹‰…Í•…µ…”(€€€€€€€€¥ì((€€€€€€€€€€€½¹ÍÐ‘µœô(€€€€€€€€€€€€€€€•ÑM­¥±±…µ…•Ñ1•Ù•° (€€€€€€€€€€€€€€€€€€€Í­¥±°°(€€€€€€€€€€€€€€€€€€€±Ø(€€€€€€€€€€€€€€€€¤ì(((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–
ß–ºÌˆ¬(€€€€€€€€€€€€€€€5…Ñ ¹™±½½È¡‘µœ¤¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹‘…µ…•A•É1•Ù•°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹¾ò#š¾?žÒh¬ˆ¬(€€€€€€€€€€€€€€€€€€€Í­¥±°¹‘…µ…•A•É1•Ù•°¬(€€€€€€€€€€€€€€€€€€€€‹¾ò$ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”€˜˜(€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•°(€€€€€€€€¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—š¦ž:žžHˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•±m±Ø´Åt¬(€€€€€€€€€€€€€€€€ˆ—šr–’!C¾ò?–n{–B ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬(€€€€€€€€€€€€€€€€ˆ—š¦ž:–Ã–Âˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹™É••é•ÕÉ…Ñ¥½¸¬(€€€€€€€€€€€€€€€€‹–n{–B ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–Bã–>[–
ß–ºÌˆ­Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•±m±Ø´Åt¬ˆ—¾ò#–n{–ú¥!@½MC¾ò$ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¬ˆ—¦f7šV<ˆ­Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹…¥±¥Ñå½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¬ˆ—¦f7¢÷–*lˆ­Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹ÍÑ…Ñ½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¬ˆ—¦f7¦bÈˆ­Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹‘•™•¹Í•½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹ÍÑÕ¹¡…¹”¬ˆ—šj#žr§¾ò15%ML€¬ˆ­Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ¬¡Í­¥±°¹ÍÑÕ¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•±m±Ø´Åt¬ˆ—ž~Ï–2[¾ò0ˆ¬¡Í­¥±°¹Á•ÑÉ¥™åÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹¢«¢ê¯¢¶ßžnøˆ­Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•±m±Ø´Åt¬‹¦î{¾ò0ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹š"GšZç–£¦®S¢¶ßžnøˆ­Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•±m±Ø´Åt¬‹¦î{¾ò0ˆ¬¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ¤ì(€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•°¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹ž"šN+ž:¾ò?ž"šN+–
ß–ºÌ€¬ˆ­Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•±m±Ø´Åt¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹¦Z¢êËž:€¬ˆ­Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹¦bËžš›–*l€¬ˆ­Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹É•™±•ÑA•É•¹Ð¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–>7–
Ü€ˆ­Í­¥±°¹É•™±•ÑA•É•¹Ð¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ˜™Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹žVÃ–âãž.š/š*_šœ€¬ˆ­Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¬ˆ—¾ò0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸¤ì(€€€€€€€ô(((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì((€€€€€€€€€€€½¹ÍÐ¡•…±µ½Õ¹Ðô((€€€€€€€€€€€€€€€Í­¥±°¹‰…Í•!•…°¬(€€€€€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°¨(€€€€€€€€€€€€€€€€¡±Ø´Ä¤ì(((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€€‹–n{–ú¥!C–~ëž’8ˆ¬(€€€€€€€€€€€€€€€¡•…±µ½Õ¹Ð¬(€€€€€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€€€€€!1%9}%9Q}=%%9P¬((€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°(€€€€€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€€€€€‹¾ò#–~ëž’;š¾?žÒh¬ˆ¬(€€€€€€€€€€€€€€€€€€€Í­¥±°¹¡•…±A•É1•Ù•°¬(€€€€€€€€€€€€€€€€€€€€‹¾ò$ˆ(€€€€€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤¬(€€€€€€€€€€€€€€€€‹¾òmMC–~ëž’8ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹‰…Í•!•…±M@¬¡Í­¥±°¹¡•…±MAA•É1•Ù•±ñðÀ¤¨¡±Ø´Ä¤¤¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹¡•…±MAA•É1•Ù•°€ü€‹¾ò#–~ëž’;š¾?žÒh¬ˆ­Í­¥±°¹¡•…±MAA•É1•Ù•°¬‹¾ò$ˆ€è€ˆˆ¤¬(€€€€€€€€€€€€€€€€ˆ¯šfë–*o\ˆ¬(€€€€€€€€€€€€€€€MA}!1%9}%9Q}=%%9P¬(€€€€€€€€€€€€€€€€‹¾ò#šZ÷šRû¢šr³’êë’â7–n{–ú¥MC¾ò$ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ˜˜(€€€€€€€€€€€Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•°(€€€€€€€€¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ((€€€€€€€€€€€€€€€€‹–ú§šÒïš‹–ú¤ˆ¬(€€€€€€€€€€€€€€€Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•±m±Ø´Åt¬(€€€€€€€€€€€€€€€€ˆ—¢†¦<ˆ((€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜ (€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ(€€€€€€€€¥ì((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€¥˜¡Á…ÉÑÌ¹±•¹Ñ ðÄ¥ì(€€€€€€€€€€€½¹Ñ¥¹Õ”ì(€€€€€€€ô(((€€€€€€€±¥¹•Ì¹ÁÕÍ  ((€€€€€€€€€€€€œñ‘¥ØÍÑå±”ôˆœ¬(€€€€€€€€€€€€‘¥ÍÁ±…äé™±•àí…ÀèÙÁàíÁ…‘‘¥¹œèÍÁà€Àìœ¬(€€€€€€€€€€€€‰½É‘•Èµ‰½ÑÑ½´èÅÁàÍ½±¥É‰„ ÈÐÀ°ÄàÀ°ÐÄ°¸ÄÈ¤ìˆøœ¬((€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰™±•àèÀ€À€ÐÁÁàí½±½Èè˜ÁˆÐÈäí™½¹ÐµÝ•¥¡Ðé‰½±ìˆøœ¬(€€€€€€€€€€€€‰1Ø¸ˆ­±Ø¬(€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰™±•àèÄìˆøœ¬(€€€€€€€€€€€Á…ÉÑÌ¹©½¥¸ ‹¾öpˆ¤¬(€€€€€€€€€€€€ˆð½ÍÁ…¸øˆ¬((€€€€€€€€€€€€ˆð½‘¥Øøˆ((€€€€€€€€¤ì((€€€ô(((€€€É•ÑÕÉ¸±¥¹•Ì¹©½¥¸ ˆˆ¤ì()ô(()™Õ¹Ñ¥½¸Í¡½ÝM­¥±±•Ñ…¥°¡Í­¥±±%¥ì((€€€½¹ÍÐÍ­¥±°ô(€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€¥˜ …Í­¥±°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÍl(€€€€€€€€€€€ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È(€€€€€€€tì(((€€€½¹ÍÐ±•Ù•°ô((€€€€€€€€ (€€€€€€€€€€€¡…É…Ñ•È˜˜(€€€€€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±Ì˜˜(€€€€€€€€€€€¡…É…Ñ•È¹Í­¥±±1•Ù•±ÍmÍ­¥±±%‘t(€€€€€€€€¥ñð(€€€€€€€€Àì(((€€€½¹ÍÐÍÁ½ÍÐô((€€€€€€€Í­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•(€€€€€€€€ü(€€€€€€€Í­¥±°¹ÍÁ½ÍÐ(€€€€€€€€è(€€€€€€€Í­¥±°¹½ÍÐì(((€€€½¹ÍÐ¥½¹°ô(€€€€€€€€ ‰Í­¥±±•Ñ…¥±%½¸ˆ¤ì(((€€€¥˜¡¥½¹°¥ì((€€€€€€€¥½¹°¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ô((€€€€€€€€€€€Í­¥±±%½¹%µ…•Ì˜˜(€€€€€€€€€€€Í­¥±±%½¹%µ…•ÍmÍ­¥±±%‘t(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰ÕÉ° ˆ¬(€€€€€€€€€€€Í­¥±±%½¹%µ…•ÍmÍ­¥±±%‘t¬(€€€€€€€€€€€€ˆ¤ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€€€€€¥½¹°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€Í­¥±±%½¹%µ…•Ì˜˜(€€€€€€€€€€€Í­¥±±%½¹%µ…•ÍmÍ­¥±±%‘t(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€€ ‰Í­¥±±•Ñ…¥±9…µ”ˆ¤(€€€€€€€€¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€Í­¥±°¹¹…µ”¬((€€€€€€€€ (€€€€€€€€€€€±•Ù•°øÀ(€€€€€€€€€€€€ü(€€€€€€€€€€€€‹¾ò!1Ø¸ˆ­±•Ù•°¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€ˆ¼ˆ­Í­¥±°¹µ…á1•Ù•°(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¬(€€€€€€€€€€€€‹¾ò$ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‹¾ò#šr«–¶ãžþK¾ò$ˆ(€€€€€€€€¤ì(((€€€€ ‰Í­¥±±•Ñ…¥±MÑ…ÑÌˆ¤(€€€€€€€€¹¥¹¹•É!Q50ô((€€€€€€€€(€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µ‰½ÑÑ½´èÙÁàìˆø(€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”ôˆ(€€€€€€€€€€€€€€€‘¥ÍÁ±…äé¥¹±¥¹”µ‰±½¬ì(€€€€€€€€€€€€€€€‰…­É½Õ¹èŒÉ”ÈàÈÈì(€€€€€€€€€€€€€€€½±½Èè˜ÁˆÐÈäì(€€€€€€€€€€€€€€€™½¹ÐµÍ¥é”èÄÅÁàì(€€€€€€€€€€€€€€€™½¹ÐµÝ•¥¡Ðé‰½±ì(€€€€€€€€€€€€€€€Á…‘‘¥¹œèÉÁà€ÝÁàì(€€€€€€€€€€€€€€€‰½É‘•ÈµÉ…‘¥ÕÌèÄÁÁàì(€€€€€€€€€€€€ˆø(€€€€€€€€€€€€€€€€‘í•ÑM­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¥ô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰±¥¹”µ¡•¥¡ÐèÄ¸Üìˆø(€€€€€€€€€€€€‘íÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µÑ½ÀèáÁàí½±½ÈèˆÍ„ÔáŒìˆø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¢Š¯–.Wš*¢÷¾ò3’â7žR£¢Žw–
g¾ò3–¶ã’ê–ÂÇšÂã’æžRšV ˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€ÍÁ½ÍÐ¬‰M@ˆ(€€€€€€€€€€€ô(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€Í­¥±°¹±•…É¹½ÍÐ(€€€€€€€€€€€€€€€€ü(€€€€€€€€€€€€€€€€‹¾ös¦š[š²‡–¶ãžþK¦r¢šˆ­•ÑM­¥±±1•…É¹½ÍÑ½ÉU¤¡•ÑM­¥±±¡…É…Ñ•É=‰©•Ð¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È¤±Í­¥±°¤¬‹¦îxˆ(€€€€€€€€€€€€€€€€è(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µÑ½ÀèÄÁÁàí™½¹ÐµÍ¥é”èÄÅÁàí½±½Èè˜ÁˆÐÈäí™½¹ÐµÝ•¥¡Ðé‰½±ìˆø(€€€€€€€€€€€€ƒ–Bž¶'žÒkšVã–ð(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”ô‰µ…É¥¸µÑ½ÀèÑÁàí™½¹ÐµÍ¥é”èÄÉÁàìˆø(€€€€€€€€€€€€‘ì(€€€€€€€€€€€€€€€‰Õ¥±‘M­¥±±1•Ù•±	É•…­‘½Ý¹!Q50 (€€€€€€€€€€€€€€€€€€€Í­¥±°(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€ô(€€€€€€€€ð½‘¥Øø((€€€€€€€€ì(((€€€½¹ÍÐ‘•Ñ…¥±MÑ…ÑÌô ‰Í­¥±±•Ñ…¥±MÑ…ÑÌˆ¤ì((€€€¥˜¡‘•Ñ…¥±MÑ…ÑÌ¥ì(€€€€€€€‘•Ñ…¥±MÑ…ÑÌ¹ÍÉ½±±Q½ÀôÀì(€€€ô((€€€l(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€€ ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€€ ‰…µ”µÍÑ…”ˆ¤(€€€t¹™½É… ¡•°ôùì(€€€€€€€¥˜¡•°¥ì(€€€€€€€€€€€•°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í­¥±°µ‘•Ñ…¥°µÍÉ½±°µ…Ñ¥Ù”ˆ¤ì(€€€€€€€ô(€€€ô¤ì((€€€€ ‰Í­¥±±•Ñ…¥±5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•M­¥±±•Ñ…¥° ¥ì((€€€€ ‰Í­¥±±•Ñ…¥±5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì((€€€l(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€€ ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€€ ‰…µ”µÍÑ…”ˆ¤(€€€t¹™½É… ¡•°ôùì(€€€€€€€¥˜¡•°¥ì(€€€€€€€€€€€•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í­¥±°µ‘•Ñ…¥°µÍÉ½±°µ…Ñ¥Ù”ˆ¤ì(€€€€€€€ô(€€€ô¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢þS–n{š†š†(€€ƒš^¦
+–’k’â–/¾òš2'¦"W¾ò3¢ÞÏ–ë–Æ³šŸ¢ª«šb;Ž7¾ò'¾òh(€€ƒ–ö#žª_–Ÿ–ºç–në–ºk–¾¯š¶ï–r¡!Q53¢Ž‡¾ò3¦g–§–/–÷–ò<(€€ƒ–>«¢Êƒ¢Ê³¦Z/¦^s¾ò3¢Þ}±½Í•M­¥±±•Ñ…¥° §šb¼(€€ƒ–B3’âž¢»žÂ‡–Z»š¢‡–ò?Ž(¨¼()™Õ¹Ñ¥½¸Í¡½ÝMÑ…ÑÕÍ!•±À ¥ì((€€€€ ‰ÍÑ…ÑÕÍ!•±Á5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹…‘ ‰Í¡½Üˆ¤ì()ô(()™Õ¹Ñ¥½¸±½Í•MÑ…ÑÕÍ!•±À ¥ì((€€€€ ‰ÍÑ…ÑÕÍ!•±Á5½‘…°ˆ¤(€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€¹É•µ½Ù” ‰Í¡½Üˆ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž¦ÿš"Ð(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸•ÅÕ¥ÁM•±•Ñ•‘%Ñ•´ ¥ì((€€€½¹ÍÐ‰ÕÑÑ½¸€ô(€€€€€€€€ ‰¥Ñ•µÅÕ¥Á	ÕÑÑ½¸ˆ¤ì(((€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Í±½Ð¥ì((€€€€€€€Õ¹•ÅÕ¥Á%Ñ•´ (€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Í±½Ð(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥˜ (€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ðôôõ¹Õ±°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍl(€€€€€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð(€€€€€€€tì(((€€€¥˜ (€€€€€€€€…¥Ñ•´ñð(€€€€€€€¥Ñ•´¹ÑåÁ”ôôô‰Á½Ñ¥½¸ˆ(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•È (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ñ-•ä€ô(€€€€€€€•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ð€ô(€€€€€€€¡…É…Ñ•ÉÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹Ñ-•åtì(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹ÑM±½Ð€ô(€€€€€€€•Ñ%¹Ù•¹Ñ½ÉåÅÕ¥Áµ•¹ÑM±½Ð¡¥Ñ•´¹ÑåÁ”¤ì(((€€€¥˜ …•ÅÕ¥Áµ•¹ÑM±½Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ½±‘%Ñ•´€ô(€€€€€€€•ÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹ÑM±½Ñtì(((€€€¥˜¡½±‘%Ñ•´¥ì((€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÁÕÍ  (€€€€€€€€€€€½±‘%Ñ•´(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ…ÑÕ…±%¹‘•à€ô(€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹¥¹‘•á=˜ (€€€€€€€€€€€¥Ñ•´(€€€€€€€€¤ì(((€€€¥˜¡…ÑÕ…±%¹‘•àøôÀ¥ì((€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÍÁ±¥” (€€€€€€€€€€€…ÑÕ…±%¹‘•à°(€€€€€€€€€€€€Ä(€€€€€€€€¤ì((€€€ô(((€€€•ÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹ÑM±½Ñt€ô(€€€€€€€¥Ñ•´ì(((€€€±½Í•%Ñ•µ5½‘…° ¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢¯’â,(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸Õ¹•ÅÕ¥Á%Ñ•´¡Í±½Ð¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€•Ñ	…­Á…­¡…É…Ñ•È (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ñ-•ä€ô(€€€€€€€•Ñ	…­Á…­ÅÕ¥Áµ•¹Ñ-•ä (€€€€€€€€€€€¥¹Ù•¹Ñ½Éå¡…É…Ñ•É%¹‘•à(€€€€€€€€¤ì(((€€€½¹ÍÐ•ÅÕ¥Áµ•¹Ð€ô(€€€€€€€¡…É…Ñ•ÉÅÕ¥Áµ•¹Ñm•ÅÕ¥Áµ•¹Ñ-•åtì(((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€•ÅÕ¥Áµ•¹ÑmÍ±½Ñtì(((€€€¥˜ …¥Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ (€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹±•¹Ñ øôÄÈÀ(€€€€¥ì((€€€€€€€…±•ÉÐ (€€€€€€€€€€€€‹¢3–2–ÞËšîÿ¾ò3ž‡šÎW¢¯’â/¢Žw–
gŽˆ(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÁÕÍ  (€€€€€€€¥Ñ•´(€€€€¤ì(((€€€•ÅÕ¥Áµ•¹ÑmÍ±½Ñtõ¹Õ±°ì(((€€€±½Í•%Ñ•µ5½‘…° ¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–R»–è(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()…Íå¹Œ™Õ¹Ñ¥½¸Í•±±M•±•Ñ•‘%Ñ•´ ¥ì((€€€¥˜ (€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ðôôõ¹Õ±°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥Ñ•´€ô(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍl(€€€€€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ð(€€€€€€€tì(((€€€¥˜ …¥Ñ•´¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ¥”€ô(€€€€€€€¥Ñ•´¹ÁÉ¥•ñð(€€€€€€€€Àì(((€€€¥˜ (€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ½¹™¥É´„ôô‰™Õ¹Ñ¥½¸ˆñð(€€€€€€€€……Ý…¥ÐÝ¥¹‘½Ü¹ÉÁ½¹™¥É´ (€€€€€€€€€€€€‹žŠë–ºk¢š–ë–R¸ˆ¬(€€€€€€€€€€€¥Ñ•´¹¹…µ”¬(€€€€€€€€€€€€‹¾ò}q¸ˆ¬(€€€€€€€€€€€€‹ž6Ë–ú\ˆ¬(€€€€€€€€€€€ÁÉ¥”¬(€€€€€€€€€€€€‹¦G–æŽˆ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€Ñ¥Ñ±”è‹–ë–R»¢Žw–
dˆ°(€€€€€€€€€€€€€€€½¹™¥ÉµQ•áÐè‹žŠë–ºk–ë–R¸ˆ°(€€€€€€€€€€€€€€€…¹•±Q•áÐè‹¢þS–nxˆ(€€€€€€€€€€€ô(€€€€€€€€¤(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜ (€€€€€€€Í•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ðôôõ¹Õ±°ñð(€€€€€€€¥¹Ù•¹Ñ½ÉåM±½ÑÍmÍ•±•Ñ•‘%¹Ù•¹Ñ½ÉåM±½Ñt„ôõ¥Ñ•´(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ…ÑÕ…±%¹‘•à€ô(€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹¥¹‘•á=˜ (€€€€€€€€€€€¥Ñ•´(€€€€€€€€¤ì(((€€€¥˜¡…ÑÕ…±%¹‘•àøôÀ¥ì((€€€€€€€½¹ÍÐÍÑ½É•‘%Ñ•´õ¥¹Ù•¹Ñ½Éå%Ñ•µÍm…ÑÕ…±%¹‘•átì(€€€€€€€½¹ÍÐÕÉÉ•¹Ñ½Õ¹Ðõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡ÍÑ½É•‘%Ñ•´¹½Õ¹Ð¥ñðÄ¤ì((€€€€€€€¥˜¡ÕÉÉ•¹Ñ½Õ¹ÐøÄ¥ì(€€€€€€€€€€€ÍÑ½É•‘%Ñ•´¹½Õ¹ÐõÕÉÉ•¹Ñ½Õ¹Ð´Äì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€¥¹Ù•¹Ñ½Éå%Ñ•µÌ¹ÍÁ±¥” (€€€€€€€€€€€€€€€…ÑÕ…±%¹‘•à°(€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žrš¶š*O–"Ã–V?¦†3š‚çšêC¾ò'¾òh(€€€€€€ƒ’æ/–&7¦g¢Ž‡žjžŠë¢ª7¢¢+š¿’âžnÓ¢ª«Ž3ž6Ë–ú\(€€€€€€ac¦G–æŽ7¾ò3’ö–ú{¦‚·–"Ã–ÂûšÊKšr'’îï’öW’â¢†0(€€€€€€ƒž¢/–ò?žŠóžržjš*+¦g–/šVã–¶_–*ƒ¦Ë’îï’öW–rÃšZçŠSŠP(€€€€€€ƒ¦G–æžÎïžÖÇžVÛšfš‚çšr³’â7–¶c–r£¾ò3¦g–>—¢¦Çž¶'šZð(€€€€€€ƒšb¿ž¦ë¦‚·šR¿ž–£Žž>û–r£žržjšr%½±“¦g–/–ÇžR (€€€€€€ƒ¢ÎšêC’ê¾ò3¦g¢Ž‡¢Žs’â+žrš¶žj–*ƒ–óŽ(€€€€¨¼(€€€½±ô(€€€€€€€½±¬(€€€€€€€ÁÉ¥”ì(((€€€±½Í•%Ñ•µ5½‘…° ¤ì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì((€€€Í…Ù•…µ” ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ¢«–.Wš"Ã¦²—¢¢·–ºh(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼((¼¨(€€ƒŠbXÄÌß¾ò#šâ¦f“šºcžVg¦2¿¢ª“¢¢+š¿¾ò'¾òh(€€…ÕÑ½¹…‰±•“Ž…ÕÑ½M­¥±±!½µ—Ž¡ÁUÍ•AÑ!½µ—ŽÍÁUÍ•AÑ!½µ”(€€ƒšb¿¢"+ž&#’âï–~;–Ÿ–Ö3¢«–.W¢¢·–ºkžj–žÒƒ¾ò3ž>û¢†3¢¢·–ºk–ÞËšRçžRÄ(€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³–.Wš/¢†£–Z»¢fWžBŽ¢"+ž&!Í…™•	¥¹“’î7–r£š¾?š²‡¢ò'–”(€€ƒ’âï–.Wš*+¦g–no–/Ž3–ÞËž~—’â7–¶c–r£Ž7žj–žÒƒ¢¢cš"A½¹Í½±”¹•ÉÉ½Ë¾ò3šrš:§¢N/žrš¶Œ(€€ƒžj¦2¿¢ª“¾òo–nošº×ž‡šV#žÚ–ºk–ÞËžžï¦f“Ž((€€…ÕÑ½M­¥±±	…ÑÑ±—Ž¡ÁUÍ•AÑ	…ÑÑ±—ŽÍÁUÍ•AÑ	…ÑÑ±”(€€ƒ¦g’â'–/šb¿–ú#š^§šrž&#šr³Žš"Ã¦²—žV¯¦v‹–Ÿ–Ö3’â/š.'¦ã–Z»žj(€€ƒ¢"+–žÒ%¾ò3–ú3’ú¦7šZÃ¢¢·¢¢#š"Cž>û–r£¦gž¢¸(€€ƒŽ3š¢gžÆ¯–V–.T¿–sš¶ˆ¯¢¢·–ºkŽ7žj¢«–.Wš"Ã¦²—¦v‹švÿšf(€€ƒ–ÞËžÚOš.ÿš:'’ê¾ò3’ö¦g¢Ž‡žÚ–ºk’ê/’îÛžjž¢/–ò?žŠð(€€ƒšÊKšr'¢Þ¢F_šâ’æûšÞ£¾ò3–Â;¢Óš¾?š²‡¢ò'–—¦÷šr–b_¢¦›š&ø(€€ƒ¦g–æû–/’â7–¶c–r£žj–žÒƒŽ–6Ã–ë¦2¿¢ª“¢¢+š¼(€€ƒ¾ò#¦n[žÛšr'¦bË–F’â7šr¢ºO¦+š"ËžVÛš¦¾ò3’öžÖž¦Ûšb¿¦ns¢¢+¾ò'Ž(€€ƒ¦g¢Ž‡žnÓš:—–"«š:'¦g’â'šº×–ÞËžÚOšÊKšr'žn»š¢g–>¿’î—žÚžjž¢/–ò?žŠóŽ(¨¼(((¼¨(€€ƒŠbƒ¢«–.Wš"Ã¦²—š*¢÷’â/š.'¦ã–Z»šRçš"C–.Wš/žR‹žRŽ(€€ƒ’æ/–&7šb¿–¾¯š¶ï–r¡!Q53¢Ž‡žj–në–ºk¦ã¦‚¾ò#–>«šr'ž¯žº·Žšr–þ’âšN+¾ò'¾ò0(€€ƒž>û–r£š*¢÷šb¿ž:§–ºÛ¢«–ÞÇ–¶ãŽ¢«–ÞÇ¢Žw–
gžj¾ò0(€€ƒ¦ã–Z»¢š¢Þ¢F_Ž3žn»–&7¢Žw–
gžjš*¢÷Ž7–.Wš/šnÓšZÃ¾ò0(€€ƒ’â7žÛž:§–ºÛ¢Žw–
g’êšZÃš*¢÷¾ò3¦g¢Ž‡–6ï¦ã’â7–"ÃŽ((€€ƒ¢Š¯–.Wš*¢÷¢Þ–Š{žn+š*¢÷¾ò#šKž¯¾ò'’â7šRû¦Ë¢«–.W¦ã–Z»¾ò0(€€ƒ¢Š¯–.Wš*¢÷šÊKšr'Ž3’âï–.W’öÿžR£Ž7¦g–n{’ê/¾òl(€€ƒšKž¯–ššzsšRû¦Ë¢«–.W¦ã–Z»¾ò0(€€ƒ¢«–.Wš"Ã¦²—š¾?–n{–B#¦÷šr¦7šZÃšZ÷šRû¾ò0(€€ƒ¦
?¢ò¿šr¢º+–ú_–ú#––š«¾ò0(€€ƒš&’î—šKž¯žn»–&7–#–>«¢÷–r£š"Ã¦²—’â·š&/–.W¦î{š*¢÷¦ã–Z»šZ÷šRûŽ(¨¼()™Õ¹Ñ¥½¸Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¥ì((€€€½¹ÍÐ¡…É…Ñ•È€ô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹™¥É”ì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•Ð½ÁÑ¥½¹Í!Q50€ô((€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ô‰¹½Éµ…°ˆûšf»¦kšRïšN(ð½½ÁÑ¥½¸øœì(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€¹™½É… ¡Í­¥±±%ôùì((€€€€€€€½¹ÍÐÍ­¥±°€ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€¥˜ (€€€€€€€€€€€€…Í­¥±°ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€½ÁÑ¥½¹Í!Q50¬ô((€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ôˆœ¬(€€€€€€€€€€€Í­¥±±%¬(€€€€€€€€€€€€œˆøœ¬(€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€œð½½ÁÑ¥½¸øœì((€€€ô¤ì(((€€€½¹ÍÐ¡½µ•M•±•Ð€ô(€€€€€€€€ ‰…ÕÑ½M­¥±±!½µ”ˆ¤ì(((€€€½¹ÍÐ‰…ÑÑ±•M•±•Ð€ô(€€€€€€€€ ‰…ÕÑ½M­¥±±	…ÑÑ±”ˆ¤ì(((€€€½¹ÍÐÁÉ•Ù¥½ÕÍY…±Õ”€ô(€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ì(((€€€¥˜¡¡½µ•M•±•Ð¥ì((€€€€€€€¡½µ•M•±•Ð¹¥¹¹•É!Q50€ô(€€€€€€€€€€€½ÁÑ¥½¹Í!Q50ì((€€€ô(((€€€¥˜¡‰…ÑÑ±•M•±•Ð¥ì((€€€€€€€‰…ÑÑ±•M•±•Ð¹¥¹¹•É!Q50€ô(€€€€€€€€€€€½ÁÑ¥½¹Í!Q50ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒžržjš*O–"Ã–V?¦†3š‚çšêC’ê¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³–>«š&ÿ¢ª4‰¹½Éµ…°‹š"[Ž3žn»–&7¢Žw–
gžjš*¢÷Ž4(€€€€€€ƒšb¿–B#šÎW–ó¾ò0‰‘•™•¹‹¾ò#¦bËžš›¾ò'’â7–r£¦g–§ž¢»ššÎ–Ÿ¾ò0(€€€€€€ƒšr¢Š¯¦gšº×¦bË–F¦
?¢ò¿¢ª“–"“š"CŽ3’â7–B#šÎWžjšºcžVg–óŽ7¾ò0(€€€€€€ƒ–òß–"Û¦–n{Ž3šf»¦kšRïšN+Ž7ŠSŠP(€€€€€€ƒ¦gš¶šb¿Ž3šb;šb;¢¢·–ºk¦bËžš›¾ò3–6ï¢º+š"Cšf»¦kšRïšN+Ž4(€€€€€€ƒžjžrš¶–:–nƒ¾òi½¹™¥ÉµÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ì ¤(€€€€€€ƒš&7–&oš*)…ÕÑ½½¹™¥œ¹Í­¥±³š¶žŠë¢¢·š"@‰‘•™•¹‹¾ò0(€€€€€€ƒžÞ+š:—¢F_–Fó–>¯¦g–/–÷–ò?–k–B3š¶—¾ò0(€€€€€€ƒ¦g¢Ž‡–>#š*+–ºšÒ_–nx‰¹½Éµ…°‹¾ò0(€€€€€€ƒž¶'šZó’öÿžR£¢žj¦ãšN–r£–Ë–¶cžj’â/’â–"ï–ÂÇ¢Š¯¢š¢N/š:'Ž((€€€€€€ƒ’þ»š¶¾òkš*(‰‘•™•¹‹’æ¢š[ž
ë–B#šÎW–óŽ(€€€€¨¼((€€€½¹ÍÐÍÑ¥±±Y…±¥€ô(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰¹½Éµ…°‰ñð(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰‘•™•¹‰ñð(€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹¥¹±Õ‘•Ì (€€€€€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”(€€€€€€€€¤ì(((€€€¥˜ …ÍÑ¥±±Y…±¥¥ì((€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ô(€€€€€€€€€€€€‰¹½Éµ…°ˆì((€€€ô(((€€€¥˜¡¡½µ•M•±•Ð¥ì((€€€€€€€¡½µ•M•±•Ð¹Ù…±Õ”€ô(€€€€€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ì((€€€ô(((€€€¥˜¡‰…ÑÑ±•M•±•Ð¥ì((€€€€€€€‰…ÑÑ±•M•±•Ð¹Ù…±Õ”€ô(€€€€€€€€€€€…ÕÑ½½¹™¥œ¹Í­¥±°ì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkž²³’ê3¢žK¢&Ëž&#šr³žj¢«–.Wš*¢÷¦ã–Z»–B3š¶—Ž(€€ƒ¢Þ}Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì §¦
?¢ò¿–º3–£–Â7ž¢Ç¾ò0(€€ƒ¢º¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹Á±…å•ÈË¾ò0(€€ƒ–¾­…ÕÑ½½¹™¥œË¾ò3šN7’ösžj=7–’îÛ’æšb¼(€€ƒ–Â#–Æ³šZóž²³’ê3¢žK¢&Ë¦
žÖ¥“Ž(€€ƒ–B3šf¢Êƒ¢Ê³¦†¿ž’è¿¦jÇ¢^?šVÓ–ò×¢¢·–ºk–6‡ž&(€€ƒ¾ò!Á±…å•ÈË’â7–¶c–r£–ÂÇ’â7žR£¢ºOž:§–ºÛžr/–"Ã¦g–6–†+¾ò'Ž(¨¼()™Õ¹Ñ¥½¸Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¥ì((€€€½¹ÍÐ…Éô(€€€€€€€€ ‰Á±…å•ÈÉÕÑ½M•ÑÑ¥¹Í…Éˆ¤ì(((€€€¥˜ ……É¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€¥˜ …Á±…å•ÈÈ¥ì((€€€€€€€…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€€€€€É•ÑÕÉ¸ì((€€€ô(((€€€…É¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€‰‰±½¬ˆì(((€€€½¹ÍÐÑ¥Ñ±•°ô(€€€€€€€€ ‰Á±…å•ÈÉÕÑ½M•ÑÑ¥¹ÍQ¥Ñ±”ˆ¤ì(((€€€¥˜¡Ñ¥Ñ±•°¥ì((€€€€€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€ˆˆ¬(€€€€€€€€€€€Á±…å•ÈÈ¹¥¬(€€€€€€€€€€€€‹¢«–.Wš"Ã¦²—¢¢·–ºhˆì((€€€ô(((€€€½¹ÍÐ¡…É…Ñ•Èô(€€€€€€€¡…É…Ñ•ÉM­¥±±1½…‘½ÕÑÌ¹Á±…å•ÈÈì(((€€€¥˜ …¡…É…Ñ•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€±•Ð½ÁÑ¥½¹Í!Q50ô((€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ô‰¹½Éµ…°ˆûšf»¦kšRïšN(ð½½ÁÑ¥½¸øœì(((€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì(€€€€¹™½É… ¡Í­¥±±%ôùì((€€€€€€€½¹ÍÐÍ­¥±°ô(€€€€€€€€€€€Í­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(((€€€€€€€¥˜ (€€€€€€€€€€€€…Í­¥±°ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰¡•…°‰ñð(€€€€€€€€€€€Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(((€€€€€€€½ÁÑ¥½¹Í!Q50¬ô((€€€€€€€€€€€€œñ½ÁÑ¥½¸Ù…±Õ”ôˆœ¬(€€€€€€€€€€€Í­¥±±%¬(€€€€€€€€€€€€œˆøœ¬(€€€€€€€€€€€Í­¥±°¹¹…µ”¬(€€€€€€€€€€€€œð½½ÁÑ¥½¸øœì((€€€ô¤ì(((€€€½¹ÍÐÍ•±•Ðô(€€€€€€€€ ‰…ÕÑ½M­¥±±A±…å•ÈÈˆ¤ì(((€€€¥˜ …Í•±•Ð¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐÁÉ•Ù¥½ÕÍY…±Õ”ô(€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ì(((€€€Í•±•Ð¹¥¹¹•É!Q50ô(€€€€€€€½ÁÑ¥½¹Í!Q50ì(((€€€½¹ÍÐÍÑ¥±±Y…±¥ô(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰¹½Éµ…°‰ñð(€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”ôôô‰‘•™•¹‰ñð(€€€€€€€¡…É…Ñ•È¹•ÅÕ¥ÁÁ•‘M­¥±±Ì¹¥¹±Õ‘•Ì (€€€€€€€€€€€ÁÉ•Ù¥½ÕÍY…±Õ”(€€€€€€€€¤ì(((€€€¥˜ …ÍÑ¥±±Y…±¥¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ô(€€€€€€€€€€€€‰¹½Éµ…°ˆì((€€€ô(((€€€Í•±•Ð¹Ù…±Õ”ô(€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ì(((€€€½¹ÍÐ¡ÁM•±•Ðô(€€€€€€€€ ‰¡ÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€½¹ÍÐÍÁM•±•Ðô(€€€€€€€€ ‰ÍÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€¥˜¡¡ÁM•±•Ð¥ì((€€€€€€€¡ÁM•±•Ð¹Ù…±Õ”ô(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹¡Àì((€€€ô(((€€€¥˜¡ÍÁM•±•Ð¥ì((€€€€€€€ÍÁM•±•Ð¹Ù…±Õ”ô(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹ÍÀì((€€€ô(((€€€½¹ÍÐ•¹…‰±•‘¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½¹…‰±•‘A±…å•ÈÈˆ¤ì(((€€€¥˜¡•¹…‰±•‘¡•­‰½à¥ì((€€€€€€€•¹…‰±•‘¡•­‰½à¹¡•­•ô(€€€€€€€€€€€…ÕÑ½½¹™¥œÈ¹•¹…‰±•ì((€€€ô()ô(((¼¨(€€ƒŠbƒž²³’ê3¢žK¢&Ë¢«–.Wš"Ã¦²—¢¢·–ºkžj’â/š.'¦ã–Z¸(€€ƒžVÃ–.Wšf¾ò3š*+–ó–¾¯–ny…ÕÑ½½¹™¥œËŽ(¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•ÕÑ½½¹™¥œÉÉ½µU$ ¥ì((€€€½¹ÍÐ•¹…‰±•‘¡•­‰½àô(€€€€€€€€ ‰…ÕÑ½¹…‰±•‘A±…å•ÈÈˆ¤ì(((€€€½¹ÍÐÍ•±•Ðô(€€€€€€€€ ‰…ÕÑ½M­¥±±A±…å•ÈÈˆ¤ì(((€€€½¹ÍÐ¡ÁM•±•Ðô(€€€€€€€€ ‰¡ÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€½¹ÍÐÍÁM•±•Ðô(€€€€€€€€ ‰ÍÁUÍ•AÑA±…å•ÈÈˆ¤ì(((€€€¥˜¡•¹…‰±•‘¡•­‰½à¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹•¹…‰±•ô(€€€€€€€€€€€•¹…‰±•‘¡•­‰½à¹¡•­•ì((€€€ô(((€€€¥˜¡Í•±•Ð¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹Í­¥±°ô(€€€€€€€€€€€Í•±•Ð¹Ù…±Õ”ì((€€€ô(((€€€¥˜¡¡ÁM•±•Ð¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹¡Àô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€¡ÁM•±•Ð¹Ù…±Õ”(€€€€€€€€€€€€¤ì((€€€ô(((€€€¥˜¡ÍÁM•±•Ð¥ì((€€€€€€€…ÕÑ½½¹™¥œÈ¹ÍÀô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€ÍÁM•±•Ð¹Ù…±Õ”(€€€€€€€€€€€€¤ì((€€€ô(((€€€Í…Ù•…µ” ¤ì()ô(()™Õ¹Ñ¥½¸Íå¹	…ÑÑ±•ÕÑ½M•ÑÑ¥¹Ì ¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#žržjš*O–"Ã’â–/šržVÛš¦žj‰ÕŸ¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³šržnÓš:—–Â4(€€€€€€…ÕÑ½M­¥±±	…ÑÑ±”½¡ÁUÍ•AÑ	…ÑÑ±”½ÍÁUÍ•AÑ	…ÑÑ±”(€€€€€€ƒ¦g’â'–/¢"+ž&#š"Ã¦²—žV¯¦v‹–Ÿ–Ö3’â/š.'¦ã–Z»¢¢·–ó¾ò0(€€€€€€ƒ’ö¦gš²‡šRçž&#–ú3¾ò3¦g’â'–/’â/š.'¦ã–Z»–ÞËžÚOšVÓ–/š.ÿš:$(€€€€€€ƒ¾ò#žnã¦^s¢¢·–ºkžžï–"ÃŽ3¢¢·–ºkŽ7š2'¦"W–ÆW¦Z/žj(€€€€€€…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹ÍA…¹•³¢Ž‡’ê¾ò'¾ò0(€€€€€€=7¢Ž‡–ÞËžÚOš&û’â7–"Ã¦g’â'–/–žÒƒ¾ò0(€€€€€€ƒžnÓš:—–Â5¹Õ±°¹Ù…±Õ—¢Î›–óšržnÓš:—’â–ë¦2¿¢ª“¾ò0(€€€€€€ƒ–Â;¢Ó–Fó–>¯¦g–/–÷–ò?žj–rÃšZç–£¦£’â·šZß–~ß¢†3ŠSŠP(€€€€€€ƒ–2š.±‰•¥¹¡…É…Ñ•ÉQÕÉ¸ §¾ò0(€€€€€€ƒž¶'šZóš¾?š²‡¢ò«–"Ãž:§–ºÛ¢†3–.W¾ò0(€€€€€€ƒžV¯¦v‹¦÷šr'–>¿¢÷–nƒž
ë¦g¢Ž‡–fÓ¦2¿¢3–6‡’ö?Ž((€€€€€€ƒšZÃž&#¢¢·–ºk¦v‹švÿšb¿Ž3¦î{¢¢·–ºkš&7–ÆW¦Z/¾ò0(€€€€€€ƒ–ÆW¦Z/šfš&7žRÅÍÝ¥Ñ¡ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•È ¤(€€€€€€ƒ¢Êƒ¢Ê³–âÛ–—žn»–&7žj–óŽ7¾ò3’â7¦r¢š–r£¦g¢Ž„(€€€€€€ƒš¾?š²‡¦÷’âï–.W–B3š¶—¾ò3š&’î—žnÓš:—š*+¦g’â'¢†3š.ÿš:'¾ò0(€€€€€€ƒ–>«’þwžVg–B3š¶—Ž3–ÞË–¶ãš*¢÷¦ã¦‚Ž7¦g¦£–"(€€€€€€ƒ¾ò!Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÏžÎï–"_–÷–ò<(€€€€€€ƒ–¦£¦÷–ÞËžÚOšr%¹Õ±³šª‹š~—¾ò3’â7šršr'–B3š¢žj–V?¦†3¾ò'Ž(€€€€¨¼((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹Ì ¤ì((€€€Á½ÁÕ±…Ñ•ÕÑ½M­¥±±=ÁÑ¥½¹ÌÈ ¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒš"Ã¦²—¢Î¢¢((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•È ¥ì((€€€½¹ÍÐÍÑ…”ô ‰…µ”µÍÑ…”ˆ¤ì(€€€½¹ÍÐÁ…”ô ‰‰…ÑÑ±•A…”ˆ¤ì(€€€½¹ÍÐ‰½‘äõ‘½Õµ•¹Ð¹‰½‘äì(€€€¥˜ …Á…”¥ì(€€€€€€€¥˜¡‰½‘ä¥ì‰½‘ä¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰ØÄÜÐµ‰…ÑÑ±”µÉ•…‘¥¹œµ½Á•¸ˆ¤ìô(€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€ô((€€€½¹ÍÐÍÑ…ÑÕÍ•Ñ…¥°õÁ…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µÍÑ…ÑÕÌµ‘•Ñ…¥°µµ½‘…°é¹½Ð¡m¡¥‘‘•¹t¤ˆ¤ì(€€€½¹ÍÐÍ¥‘•É…Ý•ÈõÁ…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µ¥¹Í¥¡Ðµ‘É…Ý•È¹½Á•¸ˆ¤ì(€€€½¹ÍÐ‰…ÑÑ±•%¹™¼õÁ…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µ¥¹™¼µÉ•¥½¸¹¥Ìµ•áÁ…¹‘•ˆ¤ì(€€€½¹ÍÐ…Ñ¥Ù”õÁ…”¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤˜˜„„¡ÍÑ…ÑÕÍ•Ñ…¥±ññÍ¥‘•É…Ý•Éññ‰…ÑÑ±•%¹™¼¤ì((€€€¥˜¡ÍÑ…”¥ìÍÑ…”¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰‰…ÑÑ±”µÕ¤µÁÉ¥½É¥Ñäˆ¤ìô(€€€¥˜¡‰½‘ä¥ì‰½‘ä¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰ØÄÜÐµ‰…ÑÑ±”µÉ•…‘¥¹œµ½Á•¸ˆ±…Ñ¥Ù”¤ìô(€€€É•ÑÕÉ¸…Ñ¥Ù”ì()ô()¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€Ý¥¹‘½Ü¹Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•ÈõÍå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•Èì)ô()™Õ¹Ñ¥½¸Í•Ñ	…ÑÑ±•%¹™½áÁ…¹‘•¡•áÁ…¹‘•¥ì((€€€½¹ÍÐÉ•¥½¸õ‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ‰…ÑÑ±•A…”€¹‰…ÑÑ±”µ¥¹™¼µÉ•¥½¸ˆ¤ì(€€€½¹ÍÐÑ½±”ô ‰‰…ÑÑ±•%¹™½Q½±”ˆ¤ì((€€€¥˜ …É•¥½¹ñð…Ñ½±”¥ìÉ•ÑÕÉ¸™…±Í”ìô((€€€½¹ÍÐ¹•áÐô„…•áÁ…¹‘•ì(€€€É•¥½¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ•áÁ…¹‘•ˆ±¹•áÐ¤ì(€€€Ñ½±”¹Ñ•áÑ½¹Ñ•¹Ðõ¹•áÐü‹¢þS–nxˆè‹š"Ã¦²—¢Î¢¢(ˆì(€€€Ñ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ•áÁ…¹‘•ˆ±¹•áÐü‰ÑÉÕ”ˆè‰™…±Í”ˆ¤ì(€€€Ñ½±”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±¹•áÐü‹šRÛ–B#š"Ã¦²—¢Î¢¢(ˆè‹–ÆW¦Z/š"Ã¦²—¢Î¢¢(ˆ¤ì(€€€Íå¹	…ÑÑ±•U¥AÉ¥½É¥Ñå1…å•È ¤ì(€€€É•ÑÕÉ¸ÑÉÕ”ì()ô()™Õ¹Ñ¥½¸Ñ½±•	…ÑÑ±•%¹™½A…¹•° ¥ì((€€€½¹ÍÐÉ•¥½¸õ‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ‰…ÑÑ±•A…”€¹‰…ÑÑ±”µ¥¹™¼µÉ•¥½¸ˆ¤ì(€€€É•ÑÕÉ¸Í•Ñ	…ÑÑ±•%¹™½áÁ…¹‘• „¡É•¥½¸˜™É•¥½¸¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¥Ìµ•áÁ…¹‘•ˆ¤¤¤ì()ô()™Õ¹Ñ¥½¸±•…É	…ÑÑ±•1½œ ¥ì((€€€Í•Ñ	…ÑÑ±•%¹™½áÁ…¹‘•¡™…±Í”¤ì((€€€€ ‰‰…ÑÑ±•%¹™¼ˆ¤(€€€€€€€€¹¥¹¹•É!Q50ôˆˆì((€€€€¼¨XÄÜÌ¸ÐÈè±•µ•¹Ð	½à…¸ÕÍ”Á½Ñ¥½¹ÌÝ¡¥±”¹¼‰…ÑÑ±”¥ÌÉÕ¹¹¥¹œ¸(€€€€€€…ÉÉäÑ¡½Í”¹½Ñ¥•Ì¥¹Ñ¼Ñ¡”¹•áÐ‰…ÑÑ±”µ¥¹™¼Á…¹•°•á…Ñ±ä½¹”¸€¨¼(€€€½¹ÍÐÁ•¹‘¥¹±•µ•¹Ñ	½á9½Ñ¥•Ìô(€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜™ÉÉ…ä¹¥ÍÉÉ…ä¡Ý¥¹‘½Ü¹ØÄÜÌÐÉA•¹‘¥¹	…ÑÑ±•9½Ñ¥•Ì¤(€€€€€€€€€€€€üÝ¥¹‘½Ü¹ØÄÜÌÐÉA•¹‘¥¹	…ÑÑ±•9½Ñ¥•Ì¹ÍÁ±¥” À¤(€€€€€€€€€€€€èmtì(€€€Á•¹‘¥¹±•µ•¹Ñ	½á9½Ñ¥•Ì¹™½É… ¡µ•ÍÍ…”ôù…‘‘	…ÑÑ±•1½œ¡µ•ÍÍ…”¤¤ì(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡¦
?¦‚¦v‹žj(€€€€€€ƒš"Ã¦²—¢Î¢¢+¢š¢N/–Æ“¾ò'¾òh(€€€€€€ƒšZÃš"Ã¦²—¦Z/–ž/šâž¦ëžÒ¦2žj–B3šf¾ò0(€€€€€€ƒ–Þ‡¦
?¦‚¦v‹¦
’î÷’æ¢š’â¢Ößšâž¦ë¾ò0(€€€€€€ƒ’â7žÛšZÃš"Ã¦²—š&O–"Ã’â–6+¾ò3–Þ‡¦
?¦‚¦v‹–6ï¦
(€€€€€€ƒšºcžVg¢F_’â+’â+’â–‚Óžj¢"+žÒ¦2¾ò3–§¦
+šr–Â7’â7¢Öß’úŽ(€€€€¨¼((€€€½¹ÍÐµ…Á%¹™¼ô(€€€€€€€€ ‰µ…Á	…ÑÑ±•%¹™¼ˆ¤ì(((€€€¥˜¡µ…Á%¹™¼¥ì((€€€€€€€µ…Á%¹™¼¹¥¹¹•É!Q50ô(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€ƒšZÃš"Ã¦²—¦Z/–ž/¾ò3–në–ºk¦†¿ž’ëžj–n{–B#šVãš¢gžÆ(€€€€€€ƒ’æ¢š¦7žö»–n{ž²°Ç–n{–B#¾ò3’â7žÛšršºcžVd(€€€€€€ƒ’â+’â–‚Óš"Ã¦²—žÖCšvšfžj–n{–B#šVãŽ(€€€€¨¼((€€€½¹ÍÐÑÕÉ¹%¹‘¥…Ñ½Èô(€€€€€€€€ ‰‰…ÑÑ±•QÕÉ¹%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜¡ÑÕÉ¹%¹‘¥…Ñ½È¥ì((€€€€€€€ÑÕÉ¹%¹‘¥…Ñ½È¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹ž²°€Äƒ–n{–B ˆì((€€€ô(((€€€½¹ÍÐµ…ÁQÕÉ¹%¹‘¥…Ñ½Èô(€€€€€€€€ ‰µ…Á	…ÑÑ±•QÕÉ¹%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜¡µ…ÁQÕÉ¹%¹‘¥…Ñ½È¥ì((€€€€€€€µ…ÁQÕÉ¹%¹‘¥…Ñ½È¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€‹ž²°€Äƒ–n{–B ˆì((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒšÆë–ºk–n{–B#¢Î¢¢+–"_¾ò#ž²±c–n{–B#¾ò?–KšVã¾ò?žn»š¢g¾ò$(€€ƒ¢Þš"Ã¦²—š2’î“š2'¦"W–6¾ò#š*¢ô¿šf»¦kšRïšN(¿¦bËžš˜¼(€€ƒž&§–N¿¦¢¯¾ò'ž>û–r£¢¦Ë¦†¿ž’ë¦
šb¿¢¦Ë¢^?¢Öß’úŽ((€€ƒ¢š?–&¾òh(€€€´…ÕÑ½	…ÑÑ±—ž
éÑÉÕ—¾ò#¢«–.Wš"Ã¦²—š2žê3¦Z/¢F_¾ò'¾òh(€€€€ƒ’â7žº‡ž>û–r£šb¿–º–F+¦
šb¿žÖCžº_¦j;šº×¾ò3’â–ú/¢^?¢Öß’ú¾ò0(€€€€ƒ’â7šrš¾?–/¢žK¢&Ë¢†3–.W–º3–ÂÇ–"š>o’âš²‡Ž¦‚ïžæ¦Zž"7Ž(€€€´…ÕÑ½	…ÑÑ±—ž
é™…±Í—¾ò#š&/–.W¾ò'¾òh(€€€€ƒžÖCžº_¦j;šº×¾ò!‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”‹¾ò0(€€€€ƒ¦ngšZçš¶–r£’úw–ê?žrš¶–ëš&/¾ò'¢^?¢Öß’ú¾ò3šâo–ÂGžV¯¦vˆ(€€€€ƒ¦ns¢¢+¾òo–º–F+¦j;šº×¾ò!‰…ÑÑ±•A¡…Í”ôôô‰‘•±…É”‹¾ò0(€€€€ƒž¶'ž:§–ºÛ¢«–ÞÇ¦ãšN¢š–k’î¦êó¾ò'¦†¿ž’ë–ë’ú¾ò0(€€€€ƒ’â7žÛž:§–ºÛšržr/’â7–"Ãš2'¦"WŽ’â7ž~—¦O¢š¦î{–N«¢Ž‡Ž((€€ƒ¢^?¢Öß’úžjšf–g¦‚’úÿ¦^s¦Z'–>¿¢÷¦
¦Z/¢F_žjš*¢ô¼(€€ƒž&§–N–¶C¦ã–Z»¾ò!±½Í•5•¹ÕÌ §¾ò'¾ò3¦ÿ–7š2'¦"W–6 (€€ƒ¢Š¯¢^?¢Öß’úŽ–¶C¦ã–Z»–6ï¦
¦Ž–r£žV¯¦v‹’â+žjš«ž.šÎŽ(¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•Ñ¥½¹!Õ‘Y¥Í¥‰¥±¥Ñä ¥ì((€€€½¹ÍÐ…Ñ¥Ù•ÕÑ¼ô(€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì((€€€½¹ÍÐ‰…ÑÑ±•AÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ô„„ (€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆ˜˜(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü˜˜(€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù” ¤(€€€€¤ì((€€€½¹ÍÐÍ¡½Õ±‘!¥‘”ô(€€€€€€€…Ñ¥Ù•ÕÑ¼ñð‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”ˆñð‰…ÑÑ±•AÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢šúšâ¾ò3–#–&7žB¢ž¦2¿’ê¾ò'¾òh(€€€€€€ƒ–n{–B#¢Î¢¢+–"_¾ò#–B¯–n{–B#šVà¿¢¢#šf–f ¿žn»š¢g¾ò$(€€€€€€ƒ¢«–.Wš"Ã¦²—šfžŸ¢"+šVÓ–/¦jÇ¢^?¾ò3’â7ž&ç–"—žVd(€€€€€€ƒ–n{–B#šVã–r£¦g¢Ž‡ŠSŠS’öÿžR£¢¢šžjšb¿Ž3š"Ã¦²”(€€€€€€ƒ¢Î¢¢(£š"Ã¦²—žÒ¦2š†§šr³¢ê¯Ž7¦†¿ž’ëžn»–&7–n{–B#šVã¾ò0(€€€€€€ƒ’â7šb¿¦g–/š2'¦"W–"_žj’â¦£–"¾ò3šRç–n{–:šr°(€€€€€€ƒžjšVÓ¦®S¦jÇ¢^?¦
?¢ò¿Ž(€€€€¨¼((€€€½¹ÍÐÑÕÉ¹I½Üô(€€€€€€€€ ‰ÑÕÉ¹Q…É•ÑI½Üˆ¤ì(((€€€¥˜¡ÑÕÉ¹I½Ü¥ì((€€€€€€€ÑÕÉ¹I½Ü¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰‰…ÑÑ±”µ¡Õµ¡¥‘‘•¸ˆ°(€€€€€€€€€€€Í¡½Õ±‘!¥‘”(€€€€€€€€¤ì((€€€ô(((€€€½¹ÍÐ½µµ…¹‘I½Üô(€€€€€€€€ ‰‰…ÑÑ±•½µµ…¹‘I½Üˆ¤ì(((€€€¥˜¡½µµ…¹‘I½Ü¥ì((€€€€€€€½µµ…¹‘I½Ü¹±…ÍÍ1¥ÍÐ¹Ñ½±” (€€€€€€€€€€€€‰‰…ÑÑ±”µ¡Õµ¡¥‘‘•¸ˆ°(€€€€€€€€€€€Í¡½Õ±‘!¥‘”(€€€€€€€€¤ì(((€€€€€€€¥˜¡Í¡½Õ±‘!¥‘”¥ì((€€€€€€€€€€€±½Í•5•¹ÕÌ ¤ì(€€€€€€€€€€€±•…É	…ÑÑ±•Q…É•ÑM•±•Ñ¥½¹5½‘” ¤ì((€€€€€€€ô((€€€ô()ô(()™Õ¹Ñ¥½¸…‘‘	…ÑÑ±•1½œ¡Ñ•áÐ¥ì((€€€½¹ÍÐ¥¹™¼€ô(€€€€€€€€ ‰‰…ÑÑ±•%¹™¼ˆ¤ì(((€€€¥˜ …¥¹™¼¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€€€€€ƒ’æ/–&7š¾?–*ƒ’â¢†3šZÃ¢¢+š¿¾ò3–ÂÇ–òß–"Ûš*+š6Ë¢îãš.'–"À(€€€€€€ƒšr–êW¦£¾ò3–Â;¢Ó’öÿžR£¢–ú’â+šîGšÏžr/’æ/–&7žj(€€€€€€ƒžÒ¦2šf¾ò3’âšr'šZÃ¢¢+š¿¦Ë’ú–ÂÇ¢Š¯–òß–"Ûš.'–n{–:ï¾ò0(€€€€€€ƒ–º3–£žr/’â7–"ÃšÏžr/žj–Ÿ–ºçŽ((€€€€€€ƒšRçš"C–#–"“šZßŽ3’öÿžR£¢ž>û–r£šb¿’â7šb¿–ÞËžÚO–r (€€€€€€ƒš:—¢þG–êW¦£Ž7¾ò#–ºç¢¢ÄÈÁÁãžj¢ª“–Þ»¾ò'¾ò0(€€€€€€ƒ–>«šr'–r£Ž3–:šr³–ÂÇ–r£–êW¦£¦f¢þGŽ7žjššÎ’â/¾ò0(€€€€€€ƒš&7¢«–.Wš6Ë–"ÃšZÃ¢¢+š¿¾òo–ššzs’öÿžR£¢–ÞËžÚL(€€€€€€ƒ’âï–.W–ú’â+šîG¦Z/’âšº×¢Þw¦n‹¾ò3’î¢†£’î[š¶–r (€€€€€€ƒ–n{¦‚·žr/’æ/–&7žjžÒ¦2¾ò3¦gšf–gšZÃ¢¢+š¿¦Ë’ú(€€€€€€ƒ’â7šrš&OšZß’î[¾ò3š6Ë–.W’ö7žö»žÚ·š2’â7¢º+Ž(€€€€¨¼((€€€½¹ÍÐÝ…Í9•…É	½ÑÑ½´ô((€€€€€€€¥¹™¼¹ÍÉ½±±!•¥¡Ð´(€€€€€€€¥¹™¼¹ÍÉ½±±Q½À´(€€€€€€€¥¹™¼¹±¥•¹Ñ!•¥¡Ð(€€€€€€€€ðÈÀì(((€€€½¹ÍÐ±¥¹”€ô(€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€¤ì(((€€€±¥¹”¹±…ÍÍ9…µ”€ô(€€€€€€€€‰‰…ÑÑ±”µ±¥¹”ˆì(((€€€±¥¹”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€Ñ•áÐì(((€€€¥¹™¼¹…ÁÁ•¹‘¡¥± (€€€€€€€±¥¹”(€€€€¤ì(((€€€Ý¡¥±” (€€€€€€€¥¹™¼¹¡¥±‘É•¸¹±•¹Ñ øàÀ(€€€€¥ì((€€€€€€€¥¹™¼¹É•µ½Ù•¡¥± (€€€€€€€€€€€¥¹™¼¹™¥ÉÍÑ¡¥±(€€€€€€€€¤ì((€€€ô(((€€€¥˜¡Ý…Í9•…É	½ÑÑ½´¥ì((€€€€€€€¥¹™¼¹ÍÉ½±±Q½À€ô(€€€€€€€€€€€¥¹™¼¹ÍÉ½±±!•¥¡Ðì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡¦
?¦‚¦v‹žj(€€€€€€ƒš"Ã¦²—¢Î¢¢+¢š¢N/–Æ“¾ò'¾òh(€€€€€€ƒš¾?–*ƒ’â¢†3š"Ã¦²—žÒ¦2¾ò3–B3š¶—¢’¢Ž÷’â’î÷–"À(€€€€€€ƒ–Þ‡¦
?¦‚¦v‹¦
’î÷š"Ã¦²—¢Î¢¢+š†ŠSŠS¦gšb¿–R¿’â (€€€€€€ƒ¢Êƒ¢Ê³–¾¯–—š"Ã¦²—žÒ¦2šZ–¶_žj–rÃšZç¾ò0(€€€€€€ƒ–r£¦g¢Ž‡–B3š¶—šr–Z»žÒS¾ò3’â7žR£–>›–’[š&ø(€€€€€€ƒš¾?’â–/–Fó–>­…‘‘	…ÑÑ±•1½œ §žj–rÃšZä(€€€€€€ƒ–B¢«¢fWžBŽ¦g’î÷’â7žR£¢fWžBŽ3š6Ë–"Ã–êW¦£Ž4(€€€€€€ƒžj¦
?¢ò¿¾ò3ž:§–ºÛ¦n‹¦Z/š"Ã¦²—Ž–n{–"Ã–rÃ–r[’æ/–ú0(€€€€€€ƒš&7šržr/–"Ã¦g’î÷¾ò3’â7šršr'Ž3šZÃ¢¢+š¿’âžnÐ(€€€€€€ƒš&OšZßš¶–r£žr/žj–Ÿ–ºçŽ7žj–V?¦†3Ž(€€€€¨¼((€€€½¹ÍÐµ…Á%¹™¼ô(€€€€€€€€ ‰µ…Á	…ÑÑ±•%¹™¼ˆ¤ì(((€€€¥˜¡µ…Á%¹™¼¥ì((€€€€€€€½¹ÍÐµ…Á1¥¹”ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€¤ì(((€€€€€€€µ…Á1¥¹”¹±…ÍÍ9…µ”ô(€€€€€€€€€€€€‰‰…ÑÑ±”µ±¥¹”ˆì(((€€€€€€€µ…Á1¥¹”¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€Ñ•áÐì(((€€€€€€€µ…Á%¹™¼¹…ÁÁ•¹‘¡¥± (€€€€€€€€€€€µ…Á1¥¹”(€€€€€€€€¤ì(((€€€€€€€Ý¡¥±” (€€€€€€€€€€€µ…Á%¹™¼¹¡¥±‘É•¸¹±•¹Ñ øàÀ(€€€€€€€€¥ì((€€€€€€€€€€€µ…Á%¹™¼¹É•µ½Ù•¡¥± (€€€€€€€€€€€€€€€µ…Á%¹™¼¹™¥ÉÍÑ¡¥±(€€€€€€€€€€€€¤ì((€€€€€€€ô(((€€€€€€€µ…Á%¹™¼¹ÍÉ½±±Q½Àô(€€€€€€€€€€€µ…Á%¹™¼¹ÍÉ½±±!•¥¡Ðì((€€€ô()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒž:§–ºÛ¢Î¢¢((ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•A±…å•É!•…‘•È ¥ì((€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í•l(€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€t(€€€€€€€ñð(€€€€€€€•±•µ•¹Ñ…Ñ…‰…Í”¹™¥É”ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò1•µ½©§š>oš"@(€€€€€€MO–.WžV¯–r[ž’ë¾ò'¾òiÑ•áÑ½¹Ñ•¹ÓšRçš"@(€€€€€€¥¹¹•É!Q53¾ò3š&7¢÷žržjš*((€€€€€€€ñÍÁ…¸±…ÍÌô‰•±•µ•¹Ðµ¥½¸¸¸¸ˆø(€€€€€€ƒ¦gž¢¹!Q53š¢gžÆ“šâËš~O–ë’ú¾ò3’â7žÛšr¢Š¬(€€€€€€ƒžVÛš"CžÒSšZ–¶_–¶_¦v‹¦†¿ž’ëŽ(€€€€¨¼((€€€€ ‰Á±…å•É9…µ”ˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô((€€€€€€€•Ñ±•µ•¹Ñ%½¹!Q50 (€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€€¤¬(€€€€€€€€ˆˆ¬(€€€€€€€€ (€€€€€€€€€€€Á±…å•È¹¥‘ñð(€€€€€€€€€€€•±•µ•¹Ð¹¡…É…Ñ•È(€€€€€€€€¤ì(((€€€€ ‰•±•µ•¹ÑQ•áÐˆ¤(€€€€€€€€¹¥¹¹•É!Q50€ô((€€€€€€€•Ñ±•µ•¹Ñ%½¹!Q50 (€€€€€€€€€€€Á±…å•È¹•±•µ•¹Ð(€€€€€€€€¤¬(€€€€€€€€ˆˆ¬(€€€€€€€•±•µ•¹Ð¹¹…µ”ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒ–r£–Þ‡¦
?¾ò?–rÃ–r[¦‚¦v‹šf¾ò3šr’â+¦v‹¦
šŠwš¢g¦†3–"\(€€ƒ’â7¦†¿ž’ë¢žK¢&Ëžjž¶'žÒh½!@½MC¾ò3šRç¦†¿ž’ëŽ3–rÃ–rX(€€ƒ–B7ž¢ÇŽ7¾ò/Ž3š«ž&§¢Î¢¢+¾ò#–B7ž¢Ä¿–Æ³šœ¿¢†¦<¼(€€ƒšV?š6ß¾ò'Ž7Ž((€€ƒš«ž&§¢Î¢¢+š*Ožjšb¿žn»–&7–rÃ–r[’â+¾ò!µ½¹ÍÑ•ÉÍlÁuø(€€µ½¹ÍÑ•ÉÍm5a}QI%9%9}5=9MQIL´Åw¾ò$(€€ƒž²³’â¦jï¦
šÒï¢F_žjš«ž&§ŠSŠS¢Þ}ÉÕ¹ÕÑ½A…ÑÉ½±¡•¬ ¤(€€ƒ¢«–.W–Þ‡š«šfŽ3š&Ož²³’â¦jï¦
šÒï¢F_žjš«ž&§Ž7žR£žj(€€ƒšb¿–B3’â–/¦
?¢ò¿¾ò3¦g¢Ž‡¦†¿ž’ëžj–ÂÇšb¿Ž3–Þ‡š«š2'’â/–:ì(€€ƒšrš&O–"Ãžj¦
¦jïš«ž&§Ž7¾ò3’â7šb¿¦j£’úÿš*O’â¦jïŽ((€€ƒ–§žÖš¢g¦†3–"_¾ò#–:šr³žj¢žK¢&Ë¢Î¢¢+¾ò?¦g¢Ž‡šZÃ–Š{žj(€€ƒ–rÃ–rX¯š«ž&§¢Î¢¢+¾ò'–æÏ–âã–>«šr¦†¿ž’ë’âžÖ¾ò0(€€ƒ–r¡Í¡½ÝA…” §¢Ž‡–"š>o¦‚¦v‹šfšr–Fó–>¯¦g¢Ž„(€€ƒ¦7šZÃ–"“šZß¢š¦†¿ž’ë–N«’âžÖŽ(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3žÞÓ–*–6šRçž& (€€ƒ–ÇžR£¦
?¢ò¿¾ò'¾òh(€€ƒš*+Ž3–"_–ëš~C–/–rÃ–6–£¦£š«ž&§ž¢»¦†{žj–B7ž¢Ä¼(€€ƒž¶'žÒh¿šV?š6ßŽ7¦gšº×¦
?¢ò¿š*÷š"Cž6£ž®/–÷–ò?¾ò0(€€ƒ–rÃ–r[¦‚¦v‹žjš«ž&§šâ–Z»š†ŽžÞÓ–*–6šZÃžj(€€ƒ–rÃ–r[¢Î¢¢+–ö#žª_¾ò3–§¦
+¦÷¢šžR£–"Ã–B3’â––_¾ò0(€€ƒ’â7¢š–B¢«–¾¯’â’î÷–æû’æ;’âš¢žjž¢/–ò?žŠóŽ((€€ƒ–B3–B7š«ž&§¾ò#š.ÿš:'ž:,¿žj’â7žº_¾ò'–>«–"_’âš²‡¾ò0(€€ƒ’â7–"_¢†¦?¾ò3žR¡½¹™¥œ¹µ½¹ÍÑ•ÉÌ §š.ÿ–"À(€€ƒšVÓ’î÷–:–ž/–B7–Z»¾ò#’â7šb½ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ(€€ƒ¦gž¢»Ž3¦g–‚Óš"Ã¦²—š*÷–"Ã¢ªÃŽ7žjšâ–Z»¾ò'¾ò0(€€ƒžŠë’þw–ÂÇžº_š«ž&§–r£š"Ã¦²—¢Ž‡¢Š¯š&Oš¶ï¾ò3šâ–Z¸(€€ƒ¦
šb¿–º3šVÓ¦†¿ž’ë¦g–/–rÃ–6Ž3šr'–N«’êož¢»¦†{Ž7Ž(¨¼()™Õ¹Ñ¥½¸•Ñi½¹•5½¹ÍÑ•É1¥ÍÑ!Q50¡é½¹•-•ä¥ì((€€€½¹ÍÐ½¹™¥œô(€€€€€€€é½¹•½¹™¥mé½¹•-•åtì(((€€€¥˜ …½¹™¥œ¥ì(€€€€€€€É•ÑÕÉ¸ˆˆì(€€€ô(((€€€½¹ÍÐé½¹•5½¹ÍÑ•ÉÌô((€€€€€€€ÑåÁ•½˜½¹™¥œ¹µ½¹ÍÑ•ÉÌôôô(€€€€€€€€‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€ü(€€€€€€€½¹™¥œ¹µ½¹ÍÑ•ÉÌ ¤(€€€€€€€€è(€€€€€€€mtì(((€€€½¹ÍÐÍ••¹9…µ•Ìô(€€€€€€€¹•ÜM•Ð ¤ì(((€€€½¹ÍÐ±¥¹•Ìô(€€€€€€€mtì(((€€€é½¹•5½¹ÍÑ•ÉÌ¹™½É…  (€€€€€€€µ½¹ÍÑ•Èôùì((€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€…µ½¹ÍÑ•Èñð(€€€€€€€€€€€€€€€Í••¹9…µ•Ì¹¡…Ì (€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(((€€€€€€€€€€€Í••¹9…µ•Ì¹…‘ (€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”(€€€€€€€€€€€€¤ì(((€€€€€€€€€€€±¥¹•Ì¹ÁÕÍ  ((€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹¹…µ”¬(€€€€€€€€€€€€€€€€‰1Ø¸ˆ¬(€€€€€€€€€€€€€€€µ½¹ÍÑ•È¹±•Ù•°¬(€€€€€€€€€€€€€€€€‹šV?š6Üˆ¬(€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€•Ñ5½¹ÍÑ•É¥±¥Ñä (€€€€€€€€€€€€€€€€€€€€€€€µ½¹ÍÑ•È(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤((€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì(((€€€É•ÑÕÉ¸±¥¹•Ì(€€€€€€€€¹µ…À (€€€€€€€€€€€±¥¹”ôø(€€€€€€€€€€€€€€€€ˆñ‘¥Øøˆ¬(€€€€€€€€€€€€€€€±¥¹”¬(€€€€€€€€€€€€€€€€ˆð½‘¥Øøˆ(€€€€€€€€¤(€€€€€€€€¹©½¥¸ ˆˆ¤ì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3žÞÓ–*–6šRçž&#¾ò'¾òh(€€ƒš¾?–/–rÃ–6žj¢3šf¿žú;¢†O–r[¾ò3–#žVgž¦ë–¶_’âÈ(€€ƒ¾ò#’öÿžR£¢’æ/–ú3šr¢Žs’â)‰…Í”ØÓš"[–r[ž&žÚË–v¾ò0(€€ƒ–>«¢šš*+–Â7š'š²’ö7–†¯¦Ë–:ï–ÂÇšržRšV#¾ò0(€€…ÁÁ±åQÉ…¥¹¥¹i½¹•	…­É½Õ¹ §¢Þ¦g¢Ž„(€€ƒ–º3–£’â7žR£–7šRç¾ò'Ž(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–Þ‡š«¦‚¦vˆ(€€ƒ¾ò µ…ÁA…—¾ò'¢3šf¿šRçš"C’úw–rÃ–6–.Wš/–"š>o¾ò'¾òh(€€ƒ–:šr°µ…ÁA…—žj¢3šf¿šb¿–¾¯š¶ï–r¡MO¢Ž‡žj(€€ƒ–Z»’â–ò×šŽ»šz_–r[¾ò3’â7žº‡¦Ë–N«–/–rÃ–6¦÷¦Vß–ú\(€€ƒ’âš¢Ž¦g¢Ž‡šRçš"C¢ÞžÞÓ–*–6–rÃ–r[¦‚C¢š÷–B3’âž¢¸(€€ƒ¢¢·¢¢#ŠSŠS’â–/ž&§’îÛ¢Žw¢F_š¾?–/–rÃ–6–B¢«žj(€€ƒ¢3šf¿–r[¾ò1™½É•ÍÐ½‘•Í•ÉÓ–#šRû’â+’öÿžR£¢(€€ƒ¦gš²‡š>C’úožj–r[¾ò3–Û¦’c–rÃ–6žVgž¦ëŽ’æ/–ú0(€€ƒ’öÿžR£¢¢š¢Žs–r[ž&žnÓš:—–†¯¦Ë–Â7š'š²’ö7–ÂÇ––÷¾ò0(€€ƒ’â7žR£šRç’îï’öW–Û’î[ž¢/–ò?žŠóŽ((€€ƒ¦
šÊKšr'–Â#–Æ³–r[ž&žj–rÃ–6¾ò3––_žR¡…ÁÁ±å5…Ái½¹•	…­É½Õ¹ ¤(€€ƒšfšr¦–n{¦†¿ž’é™½É•ÍÓ¦g–ò×žVÛ¦‚C¢¢·–ó¾ò0(€€ƒ’â7šr–ëž>û’âž&¦îGžjžV¯¦v‹Ž(¨¼()½¹ÍÐµ…Ái½¹•	…­É½Õ¹‘%µ…•Ìõì((€€€™½É•ÍÐè‰…ÍÍ•ÑÌ½µ…ÁÌ½™½É•ÍÐ¹©Áœˆ°(€€€‘•Í•ÉÐè‰…ÍÍ•ÑÌ½µ…ÁÌ½‘•Í•ÉÐ¹©Áœˆ°(€€€¥”èˆˆ°(€€€é½¹”Ðèˆˆ°(€€€é½¹”Ôèˆˆ°(€€€é½¹”Øèˆˆ°(€€€é½¹”Üèˆˆ°(€€€é½¹”àèˆˆ°(€€€é½¹”äèˆˆ°(€€€é½¹”ÄÀèˆˆ()ôì(()™Õ¹Ñ¥½¸…ÁÁ±å5…Ái½¹•	…­É½Õ¹¡é½¹•-•ä¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3šRçš"CšN7’öp(€€€€€€ƒž6£ž®/žjÁ½Í¥Ñ¥½¸é™¥á•“¢3šf¿–r[–Æ“¾ò0(€€€€€€ƒ’â7–7žnÓš:—–Â4µ…ÁA…—šr³¢ê¯¢¢·–ºh(€€€€€€‰…­É½Õ¹µ¥µ…—¾ò'Ž(€€€€¨¼((€€€½¹ÍÐ‰1…å•Èô(€€€€€€€€ ‰µ…ÁA…•	1…å•Èˆ¤ì(((€€€¥˜ …‰1…å•È¥ì(€€€€€€€É•ÑÕÉ¸ì€€€ô(((€€€½¹ÍÐ¥µ…•UÉ°ô((€€€€€€€µ…Ái½¹•	…­É½Õ¹‘%µ…•Ímé½¹•-•åuñð(€€€€€€€µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì¹™½É•ÍÐì(((€€€‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ô((€€€€€€€€‰ÕÉ° ˆ¬(€€€€€€€¥µ…•UÉ°¬(€€€€€€€€ˆ¤ˆì()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3š*¢÷¦7¢Žt(€€ƒ–>«¦†¿ž’é¥½»¾ò3žn»–&7šÊKšr%¥½»–r[ž’ë–ÂÇ–#ž¦ë¢F_Ž7¾ò'¾òh(€€ƒš*¢÷–r[ž’ëžj¦‚CžVgš~—š&û¢†£¾ò1­•çšb¿š*¢õ%¾ò0(€€Ù…±Õ—–#–£¦£žVgž¦ë–¶_’âËŽ’æ/–ú3¢š–æ¯š*¢÷¢Žp(€€ƒ–r[ž’ë¾ò3žnÓš:—–Â7¦g–/ž&§’îÛ–†¯–—–Â7š'žj(€€‰…Í”ØÓš"[–r[ž&žÚË–v–ÂÇšržRšV#¾ò#š*¢÷–"_¢†£Ž(€€ƒ¢Žw–
gš²š‚ó–¶CŽš*¢÷¢¦ÏžÒÃ–ö#žª_’â'–/–rÃšZç¦ô(€€ƒšr¢«–.W––_žR£–B3’â–ò×–r[¾ò3’â7žR£–"–"—–:ïšRç¾ò'¾ò0(€€ƒ’â7žR£šRç’îï’öW–Û’î[ž¢/–ò?žŠóŽ(¨¼()½¹ÍÐÍ­¥±±%½¹%µ…•Ìõ•±•µ•¹ÑM­¥±±%½¹5…Àì(()½¹ÍÐé½¹•	…­É½Õ¹‘%µ…•Ìõì((€€€™½É•ÍÐèˆˆ°(€€€‘•Í•ÉÐèˆˆ°(€€€¥”èˆˆ°(€€€é½¹”Ðèˆˆ°(€€€é½¹”Ôèˆˆ°(€€€é½¹”Øèˆˆ°(€€€é½¹”Üèˆˆ°(€€€é½¹”àèˆˆ°(€€€é½¹”äèˆˆ°(€€€é½¹”ÄÀèˆˆ()ôì(()™Õ¹Ñ¥½¸…ÁÁ±åQÉ…¥¹¥¹i½¹•	…­É½Õ¹¡é½¹•-•ä¥ì((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò3šRçš"CšN7’öp(€€€€€€ƒž6£ž®/žjÁ½Í¥Ñ¥½¸é™¥á•“¢3šf¿–r[–Æ“¾ò'¾òh(€€€€€€ƒ¦g–/–r[–Æ“žjML±…ÍÏšr³¢ê¯–ÞËžÚO–Ÿ–îë’ê(€€€€€€ƒŽ3¢ªÿšj_šòã–Æ¯¦‚C¢¢·žâ÷¢š÷–r[Ž7¦g–/žÖ–B (€€€€€€ƒ¾ò#¢š,¹ÑÉ…¥¹¥¹œµ‰œµ™¥á•µ±…å•Ë¾ò'¾ò0(€€€€€€ƒ¦g¢Ž‡–ššzs–>«žR£¢†3–Ÿš¢–ò?¢N/’â–/–Z»žÒSžj(€€€€€€ÕÉ° ¸¸¸§’â+–:ï¾ò3šrš*+¢ªÿšj_šòã–Æ“’â¢Öß¢N/š:'Ž(€€€€€€ƒ–/–"—–rÃ–6žj–r[ž&šr¢º+š"CšÊKšr'¢ªÿšj_šV#šzs¾ò0(€€€€€€ƒ¢Þžâ÷¢š÷–r[’â7’â¢ÓŽš&’î—¦g¢Ž‡¢¢·–ºk¢†3–œ(€€€€€€ƒš¢–ò?šf¾ò3’âš¢¢šžR£Ž3šòã–Æ¯–r[ž&Ž7žj(€€€€€€ƒžÖ–B#–¾¯šÎW¾ò3’â7¢÷–>«–¾­ÕÉ° §Ž(€€€€¨¼((€€€½¹ÍÐ‰1…å•Èô(€€€€€€€€ ‰ÑÉ…¥¹¥¹A…•	1…å•Èˆ¤ì(((€€€¥˜ …‰1…å•È¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ¥µ…•UÉ°ô(€€€€€€€é½¹•	…­É½Õ¹‘%µ…•Ímé½¹•-•åtì(((€€€¥˜¡¥µ…•UÉ°¥ì((€€€€€€€½¹ÍÐ¹•áÑ	…­É½Õ¹ô(€€€€€€€€€€€€‰±¥¹•…ÈµÉ…‘¥•¹Ð¡É‰„ À°À°À°¸Ð¤±É‰„ À°À°À°¸Ð¤¤°ˆ¬(€€€€€€€€€€€€‰ÕÉ° ˆ¬(€€€€€€€€€€€¥µ…•UÉ°¬(€€€€€€€€€€€€ˆ¤ˆì((€€€€€€€¥˜¡‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”„ôõ¹•áÑ	…­É½Õ¹¥ì(€€€€€€€€€€€‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”õ¹•áÑ	…­É½Õ¹ì(€€€€€€€ô((€€€ô(€€€•±Í•ì((€€€€€€€€¼¨(€€€€€€€€€€Xäß¾òkšÊKšr'–Â#–Æ³–r[ž&šf–>«–r£žržj–¶c–r£¢†3–Ÿ¢3šf¿šfš&7šâ¦f“Ž(€€€€€€€€€€ƒ¦;–:ïš¾?š²‡š&O¦Z/–rÃ–6¢Î¢¢+¦÷¦7–¾­‰…­É½Õ¹‘%µ…—¾ò3¦7–B (€€€€€€€€€€M…µÍÕ¹œ	É½ÝÍ•ËžjÑÉ…¹Í™½É·žâ»šRû¢"™¥á•“¢3šf¿šr¢žãžfóšb¢ÊÓ¦7žæ«Ž(€€€€€€€€€€ƒž>û–r£¦ÿ–7ž‡š?žú§žjÍÑå±”µÕÑ…Ñ¥½»¾ò3žnÓš:—šÊÿžR¡MOžâ÷¢š÷¢3šf¿Ž(€€€€€€€€¨¼((€€€€€€€¥˜¡‰1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”¥ì(€€€€€€€€€€€‰1…å•È¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ‰‰…­É½Õ¹µ¥µ…”ˆ¤ì(€€€€€€€ô((€€€ô()ô(((¼¨(€€ƒŠbƒšZÃ–Š{¾òkžÞÓ–*–6–rÃ–6¢Î¢¢+–ö#žª_ŠSŠS¦î{šZ–¶\(€€ƒšf¢žãžfó¾ò3¦†¿ž’ë¦g–/–rÃ–6žjš«ž&§šâ–Z»¾ò0(€€ƒ’â›’úwžŸžn»–&7ž¶'žÒkšÆë–ºkŽ3¦Ë–—Ž7š2'¦"W¢÷’â7¢ô(€€ƒš2'Ž¢Þ’âï–~;¦
š&ç–ö#žª_–ÇžR£–B3’â––\(€€€¹¡½µ”µ™•…ÑÕÉ”µµ½‘…³š¢–ò?Ž(¨¼()™Õ¹Ñ¥½¸½Á•¹QÉ…¥¹¥¹i½¹•%¹™¼¡é½¹•-•ä¥ì((€€€½¹ÍÐ½¹™¥œô(€€€€€€€é½¹•½¹™¥mé½¹•-•åtì(((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…°ˆ¤ì((€€€½¹ÍÐÑ¥Ñ±•°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…±Q¥Ñ±”ˆ¤ì((€€€½¹ÍÐ‰½‘å°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…±	½‘äˆ¤ì(((€€€¥˜ (€€€€€€€€…½¹™¥œñð(€€€€€€€€…µ½‘…°ñð(€€€€€€€€…Ñ¥Ñ±•°ñð(€€€€€€€€…‰½‘å°(€€€€¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€…ÁÁ±åQÉ…¥¹¥¹i½¹•	…­É½Õ¹ (€€€€€€€é½¹•-•ä(€€€€¤ì(((€€€Ñ¥Ñ±•°¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€½¹™¥œ¹Ñ¥Ñ±•ñð‹–rÃ–6¢Î¢¢(ˆì(((€€€½¹ÍÐµ½¹ÍÑ•É1¥ÍÑ!Q50ô(€€€€€€€•Ñi½¹•5½¹ÍÑ•É1¥ÍÑ!Q50 (€€€€€€€€€€€é½¹•-•ä(€€€€€€€€¤ì(((€€€½¹ÍÐÕ¹±½­•ô((€€€€€€€Á±…å•È¹±•Ù•°øô(€€€€€€€½¹™¥œ¹É•ÅÕ¥É•‘1•Ù•°ì(((€€€‰½‘å°¹¥¹¹•É!Q50ô((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÙÁàí½±½Èè˜ÁˆÐÈäíµ…É¥¸µ‰½ÑÑ½´èáÁàìˆøœ¬(€€€€€€€€¡½¹™¥œ¹±•Ù•±I…¹•ñðˆˆ¤¬(€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€œñ‘¥ØÍÑå±”ô‰™½¹ÐµÍ¥é”èÄÙÁàí±¥¹”µ¡•¥¡ÐèÄ¸äíµ…É¥¸µ‰½ÑÑ½´èÄÙÁàìˆøœ¬(€€€€€€€€ (€€€€€€€€€€€µ½¹ÍÑ•É1¥ÍÑ!Q51ñð(€€€€€€€€€€€€œñÍÁ…¸ÍÑå±”ô‰½±½ÈèˆÍ„ÔáŒìˆû¾ò#–Âkž‡š«ž&§¢ÎšZg¾ò$ð½ÍÁ…¸øœ(€€€€€€€€¤¬(€€€€€€€€ˆð½‘¥Øøˆ¬((€€€€€€€€œñ‘¥ØÍÑå±”ô‰‘¥ÍÁ±…äé™±•àí…ÀèáÁàìˆøœ¬((€€€€€€€€ (€€€€€€€€€€€Õ¹±½­•(€€€€€€€€€€€€ü(€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÄÉÁàí™½¹ÐµÍ¥é”èÄÙÁàíµ¥¸µ¡•¥¡ÐèÐÙÁàìˆœ¬(€€€€€€€€€€€€½¹±¥¬ô‰±½Í•QÉ…¥¹¥¹i½¹•%¹™¼ ¤í•¹Ñ•Éi½¹”¡pœœ¬(€€€€€€€€€€€é½¹•-•ä¬(€€€€€€€€€€€€pœ¤ìˆøœ¬(€€€€€€€€€€€€‹¦Ë–”ˆ¬(€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁà€ÄÉÁàí™½¹ÐµÍ¥é”èÄÙÁàíµ¥¸µ¡•¥¡ÐèÐÙÁàì‰‘¥Í…‰±•øœ¬(€€€€€€€€€€€€‹¦r¢š1Ø¸ˆ¬(€€€€€€€€€€€½¹™¥œ¹É•ÅÕ¥É•‘1•Ù•°¬(€€€€€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ(€€€€€€€€¤¬((€€€€€€€€œñ‰ÕÑÑ½¸±…ÍÌô‰¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸‰ÍÑå±”ô‰™±•àèÄíÁ…‘‘¥¹œèÄÁÁàìˆœ¬(€€€€€€€€½¹±¥¬ô‰±½Í•QÉ…¥¹¥¹i½¹•%¹™¼ ¤ìˆøœ¬(€€€€€€€€‹¢þS–nxˆ¬(€€€€€€€€ˆð½‰ÕÑÑ½¸øˆ¬((€€€€€€€€ˆð½‘¥Øøˆì(((€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì()ô(()™Õ¹Ñ¥½¸±½Í•QÉ…¥¹¥¹i½¹•%¹™¼ ¥ì((€€€½¹ÍÐµ½‘…°ô(€€€€€€€€ ‰ÑÉ…¥¹¥¹i½¹•5½‘…°ˆ¤ì(((€€€¥˜¡µ½‘…°¥ì((€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€¤ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•5…ÁA…•!•…‘•È ¥ì((€€€½¹ÍÐµ…ÁA…•±•µ•¹Ðô(€€€€€€€€ ‰µ…ÁA…”ˆ¤ì(((€€€½¹ÍÐ¥Í5…ÁA…”ô((€€€€€€€µ…ÁA…•±•µ•¹Ð€˜˜(€€€€€€€µ…ÁA…•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì (€€€€€€€€€€€€‰…Ñ¥Ù”ˆ(€€€€€€€€¤ì(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â7šb¿¦jÇ¢^?¾ò0(€€€€€€ƒšb¿šVÓ–/š.ÿš:'¾ò3’â7¢šžVg’â–†+¦îG¢&Ëž¦ëžf÷Ž7¾ò'¾òh(€€€€€€ƒ¦g¢Ž‡–:šr³¢«–ÞÇ–ršÎWž'¦.ó–¾¯’ê’â’î÷Ž3’âï–~;šf(€€€€€€ƒ¦jÇ¢^?š¢g¦†3–"_Ž7žj¦
?¢ò¿¾ò3–>«žR¡‘¥ÍÁ±…äé¹½¹”(€€€€€€ƒ¢N/š:'–Ÿ–ºç¾ò3’ö¹½¹Ñ•¹Ó¦
–†+–6–~–:šr³šb¼(€€€€€€ƒžR¡Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÑ½ÀèØÉÁãžº_––ô(€€€€€€ƒŽ3š&š:'š¢g¦†3–"_¦®c–ê›–ú3Ž7žj’ö7žö»¾ò3š¢g¦†3–"\(€€€€€€ƒšÚ#–’Ç’êŽ¹½¹Ñ•¹ÓšÊKšr'¢Þ¢F_¢Žs’â+–:ï¾ò0(€€€€€€ƒš&7šrž¦ë–ë’â–†(ØÉÁã¦®cžj¦îG¢&Ë–6–~Ž((€€€€€€ƒ–ú3’úžfóž>ùÍ¡½ÝA…” §¢Ž‡–Û–¾›–ÞËžÚOšr'’â––\(€€€€€€ƒ–º3šVÓŽš¶žŠë¢fWžB¦g’îÛ’ê/žjš¦–"Ø(€€€€€€ƒ¾ò …ÁÃžj¹¼µ¡•…‘•Ë¦g–-±…ÍÏ¾ò3šB·¦4(€€€€€€MOžj¹½¹Ñ•¹ÑíÑ½ÀèÁ÷¾ò'¾ò3š.ÿš:'¦g¢Ž„(€€€€€€ƒšVÓšº×¢«–ÞÇ–¾¯žj¦
?¢ò¿¾ò3šRçš"Cš*(‰¡½µ”‹¾ò<(€€€€€€€‰ÑÉ…¥¹¥¹œ‹–*ƒ¦ÉÍ¡½ÝA…” §¢Ž‡žj(€€€€€€¡¥‘•!•…‘•ÉA…•Ïšâ–Z»¾ò3žnÓš:—žR£ž>ûš"CŽ(€€€€€€ƒš¶žŠëžjš¦–"Û¢fWžB¾ò3’â7šr–7žVg’â/ž¦ëžf÷–6–†+Ž(€€€€¨¼(((€€€½¹ÍÐ¹…µ•°ô(€€€€€€€€ ‰Á±…å•É9…µ”ˆ¤ì((€€€½¹ÍÐ¥¹™½°ô(€€€€€€€€ ‰Á±…å•É!•…‘•É%¹™¼ˆ¤ì((€€€½¹ÍÐé½¹•°ô(€€€€€€€€ ‰µ…Á!•…‘•Éi½¹•9…µ”ˆ¤ì((€€€½¹ÍÐµ½¹ÍÑ•É%¹™½°ô(€€€€€€€€ ‰µ…Á!•…‘•É5½¹ÍÑ•É%¹™¼ˆ¤ì(((€€€¥˜¡¹…µ•°¥ì((€€€€€€€¹…µ•°¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€¥Í5…ÁA…”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€¥˜¡¥¹™½°¥ì((€€€€€€€¥¹™½°¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€¥Í5…ÁA…”(€€€€€€€€€€€€ü(€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€ˆˆì((€€€ô(((€€€¥˜¡é½¹•°¥ì((€€€€€€€é½¹•°¹ÍÑå±”¹‘¥ÍÁ±…äô((€€€€€€€€€€€¥Í5…ÁA…”(€€€€€€€€€€€€ü(€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€è(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€¥˜¡µ½¹ÍÑ•É%¹™½°¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢^7¢&Ëš†(€€€€€€€€€€ƒ–Û’î[¦÷’â7¢šŽ7¾ò'¾òk¦g–/–ºç–f £ž¶'žÒkž¾–r4(€€€€€€€€€€ƒ¦
¢†0§’â7žº‡–r£’â7–r£–rÃ–r[¦‚¦v‹¾ò3’â–ú,(€€€€€€€€€€ƒ¦jÇ¢^?¾ò3–>«žVg–rÃ–r[–B7ž¢Ç¦
’â¢†3Ž(€€€€€€€€¨¼((€€€€€€€µ½¹ÍÑ•É%¹™½°¹ÍÑå±”¹‘¥ÍÁ±…äô(€€€€€€€€€€€€‰¹½¹”ˆì((€€€ô(((€€€¥˜ …¥Í5…ÁA…”¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€½¹ÍÐ½¹™¥œô((€€€€€€€é½¹•½¹™¥mÕÉÉ•¹Ñi½¹•t(€€€€€€€ñð(€€€€€€€é½¹•½¹™¥œ¹™½É•ÍÐì(((€€€¥˜¡é½¹•°¥ì((€€€€€€€€¼¨(€€€€€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3’â+¦vˆ(€€€€€€€€€€ƒ¢^7¢&Ëš†–>«žVg–rÃ–r[–B7–¶_–no–/–¶_¾ò3–Û’îX(€€€€€€€€€€ƒ¦÷’â7¢šŽ7¾ò'¾òh(€€€€€€€€€€½¹™¥œ¹Ñ¥Ñ±—šr³¢ê¯–âÛ¢F]•µ½©§–&7žÚÐ(€€€€€€€€€€ƒ¾ò#’ú/–š‹ŠnÃ¾â<ƒ–Þ£ž6ã¢6K–:|‹¾ò'¾ò3¦g¢Ž‡žR (€€€€€€€€€€ƒš¶¢š?¢†£¦S–ò?–:ïš:'¦Z/¦‚·žj•µ½©§¢Þ|(€€€€€€€€€€ƒž¦ëžf÷¾ò3–>«žVg’â/žÒS’â·šZ–rÃ–r[–B7ž¢ÇŽ(€€€€€€€€€€ƒ’æ’â7–7¢«–ÞÇ–*€‹Â~^ë¾â<€‹¦g–/–&7žÚÓŽ(€€€€€€€€¨¼((€€€€€€€é½¹•°¹Ñ•áÑ½¹Ñ•¹Ðô((€€€€€€€€€€€€¡½¹™¥œ¹Ñ¥Ñ±•ñðˆˆ¤(€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€½yqL­qÌ¨¼°(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3¢^7¢&Ëš†(€€€€€€ƒ–Û’î[¦÷’â7¢šŽ7Ž3š¦c¢&Ë¦£–"–>¿’î—š.ÿš:'Ž7¾ò'¾òh(€€€€€€ƒž¶'žÒkž¾–r7šZ–¶_Žš«ž&§šâ–Z»š†¾ò3–§–/¦ô(€€€€€€ƒšVÓ–/’â7–7¦†¿ž’ëŠSŠQµ…Á!•…‘•É5½¹ÍÑ•É%¹™¼(€€€€€€ƒ¦g–/–’[–Æ“–ºç–f£šr³’ú–ÂÇ–r£’â+¦v‹žj¥Í5…ÁA…”(€€€€€€ƒ–"“šZß–ò?¢Ž‡¢Š¯¢¢·š"C’â–ºk¦jÇ¢^<(€€€€€€ƒ¾ò!‘¥ÍÁ±…äé¹½¹—¾ò'¾ò3¦g¢Ž‡’â7žR£–7¢fWžB¾òl(€€€€€€ƒš«ž&§šâ–Z»š†¾ò!µ…Á5½¹ÍÑ•É1¥ÍÑ	½ã¾ò$(€€€€€€ƒžj–Ÿ–ºç’æ’â7žR£–7žR‹žR¾ò3žnÓš:—’â7–¾¯–—Ž(€€€€¨¼()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒšnÓšZÁU$(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()™Õ¹Ñ¥½¸ÕÁ‘…Ñ•U$ ¥ì((€€€‰ÕµÁ	…ÑÑ±•IÕ¹Ñ¥µ•5•ÑÉ¥Œ ‰ÕÁ‘…Ñ•U$ˆ¤ì((€€€½¹ÍÐÍÑ…ÑÌõ•Ñ5…¥¹¡…É…Ñ•ÉMÑ…ÑÌ ¤ì((€€€Á±…å•È¹¡Àõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡Á±…å•È¹¡À±ÍÑ…ÑÌ¹µ…á!@¤¤ì(€€€Á±…å•È¹ÍÀõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡Á±…å•È¹ÍÀ±ÍÑ…ÑÌ¹µ…áM@¤¤ì((€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€Á½ÁÕ±…Ñ•M­¥±±EÕ¥­	…È ¤ì((€€€€€€€¥˜ (€€€€€€€€€€€€ ‰¥Ñ•µ5•¹Ôˆ¤˜˜(€€€€€€€€€€€€ ‰¥Ñ•µ5•¹Ôˆ¤¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤(€€€€€€€€¥ì(€€€€€€€€€€€É•¹‘•É	…ÑÑ±•A½Ñ¥½¹5•¹Ô ¤ì(€€€€€€€ô((€€€€€€€ÕÉÉ•¹Ñ	…ÑÑ±•5½¹ÍÑ•ÉÌ¹™½É… ¡¥¹‘•àôùì(€€€€€€€€€€€ÕÁ‘…Ñ•5½¹ÍÑ•ÉU$¡¥¹‘•à¤ì(€€€€€€€ô¤ì((€€€€€€€ÕÁ‘…Ñ•	…ÑÑ±•A±…å•É	…ÉÌ ¤ì((€€€€€€€½¹ÍÐ‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•ÈõÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÍÍ	…ÑÑ±”é¹Õ±°ì(€€€€€€€¥˜¡‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È˜™ÑåÁ•½˜‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È¹Íå¹!Õôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‰½ÍÍAÉ•Í•¹Ñ…Ñ¥½¹=Ý¹•È¹Íå¹!Õ ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì(€€€ô((€€€ÕÁ‘…Ñ•!½µ•Q•ÍÑQ½½±Ì ¤ì(€€€ÕÁ‘…Ñ•QÉ…¥¹¥¹i½¹•1½­Ì ¤ì(€€€ÕÁ‘…Ñ•M•½¹‘¡…É…Ñ•É	…¹¹•È ¤ì(€€€ÕÁ‘…Ñ•½±‘¥ÍÁ±…ä ¤ì(€€€ÕÁ‘…Ñ•5…ÁA±…å•É…É ¤ì(€€€ÕÁ‘…Ñ•5…ÁA…•!•…‘•È ¤ì((€€€€ ‰Á±…å•É1•Ù•°ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÁ±…å•È¹±•Ù•°ì(€€€€ ‰¡•…‘•É!@ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÁ±…å•È¹¡Àì(€€€€ ‰¡•…‘•ÉM@ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÁ±…å•È¹ÍÀì((€€€€ ‰Í­¥±±A½¥¹ÑÌˆ¤¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€ (€€€€€€€€€€€•ÑM­¥±±¡…É…Ñ•É=‰©•Ð¡ÕÉÉ•¹ÑM­¥±±¡…É…Ñ•È¥ñð(€€€€€€€€€€€Á±…å•È(€€€€€€€€¤¹Í­¥±±A½¥¹ÑÌì((€€€€ ‰Í¡…É•‘áÁY…±Õ”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡Í¡…É•‘áÀ¥ñðÀ¤¤(€€€€€€€€€€€€¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì((€€€É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐ ¤ì(€€€ÕÁ‘…Ñ•MÑ…ÑÕÍAÉ•Ù¥•Ü ¤ì)ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒŠbƒ¢«–.W–¶cšªP((€€ƒ¦f“’ê–:šr³–r£ž&ç–ºk–.W’ös¦î{¾ò#–6žÒkŽ¢Žw–
gŽš"Ã¦²—–.w–"§Š›¾ò$(€€ƒšr–¶cšªS’æ/–’[¾ò3¦g¢Ž‡–7–*ƒ–§–Æ“’þw¦j«¾òh((€€€Ä¸ƒš¾<€ÈÀƒžžK–ºkšf¢«–.W–¶c’âš²‡¾ò0(€€€€€ƒ’â›–r£žV¯¦v‹–>Ï’â/¢žKž~·šj¯¦†¿ž’ëŽ3Â~Jøƒ–ÞË¢«–.W–¶cšªSŽ7¾ò0(€€€€€ƒ¢ºOž:§–ºÛž~—¦Ožržjšr'–r£–¶c¾ò3’â7šb¿šGž¦ëšRû–þŽ((€€€È¸ƒ–"–"Ã¢3šf¿¾ò#–"ÁÃŽ–"–"¦‚Ž¢z‹–æW¦:[–ºk¾ò$(€€€€€ƒžjžVÛ’â/ž®/–"ï–¶c’âš²‡¾ò0(€€€€€ƒ¦gšb¿šr–ºçšbOšò?š:'¦Ë–ê›žjššÎŠSŠP(€€€€€ƒž:§–ºÛ–ú#–>¿¢÷žªžÛ¢Š¯¦nï¢¦Çš&OšZßŽ(€€€€€ƒš"[žnÓš:—–"–ë–:ï–ny1%9¾ò0(€€€€€ƒ¦gšf–g’â7¢÷–>«¦v€ÈÃžžKžj–ºkšf–f£Ž((€€ƒ–§ž¢»ššÎ¦÷–Fó–>¯–B3’â–,…ÕÑ½M…Ù•9½Ü §¾ò0(€€ƒ–Ÿ¦£šr³¢ê¯šr%ÑÉä½…Ñ£¾ò0(€€ƒ–¶cšªS–’ÇšV_’â7šr¢ºO¦+š"ËžVÛš:'¾ò0(€€ƒ–>«šr–r¡½¹Í½±—žVg’â/¦2¿¢ª“¢¢+š¿šZç’úÿ’æ/–ú3¦f“¦2¿Ž(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()±•Ð…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•Èõ¹Õ±°ì()±•Ð…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%õ¹Õ±°ì(()™Õ¹Ñ¥½¸¥Í…µ•MÑ…ÉÑ• ¥ì((€€€É•ÑÕÉ¸€„„ (€€€€€€€Á±…å•È€˜˜(€€€€€€€Á±…å•È¹¥(€€€€¤ì()ô(()™Õ¹Ñ¥½¸Í¡½ÝÕÑ½Í…Ù•%¹‘¥…Ñ½È ¥ì((€€€½¹ÍÐ•°€ô(€€€€€€€€ ‰…ÕÑ½Í…Ù•%¹‘¥…Ñ½Èˆ¤ì(((€€€¥˜ …•°¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€•°¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€‰Í¡½Üˆ(€€€€¤ì(((€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•È(€€€€¤ì(((€€€…ÕÑ½Í…Ù•%¹‘¥…Ñ½ÉQ¥µ•È€ô(€€€€€€€Í•ÑQ¥µ•½ÕÐ  ¤ôùì((€€€€€€€€€€€•°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰Í¡½Üˆ(€€€€€€€€€€€€¤ì((€€€€€€€ô°ÄØÀÀ¤ì()ô(()™Õ¹Ñ¥½¸…ÕÑ½M…Ù•9½Ü¡Í¡½Ý%¹‘¥…Ñ½È¥ì((€€€¥˜ …¥Í…µ•MÑ…ÉÑ• ¤¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÑÉåì((€€€€€€€Í…Ù•…µ” ¤ì(((€€€€€€€¥˜¡Í¡½Ý%¹‘¥…Ñ½È¥ì((€€€€€€€€€€€Í¡½ÝÕÑ½Í…Ù•%¹‘¥…Ñ½È ¤ì((€€€€€€€ô((€€€ô(€€€…Ñ ¡•ÉÉ½È¥ì((€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€‹¢«–.W–¶cšªS–’ÇšV_¾òhˆ°(€€€€€€€€€€€•ÉÉ½È(€€€€€€€€¤ì((€€€ô()ô(()™Õ¹Ñ¥½¸ÍÑ…ÉÑÕÑ½M…Ù” ¥ì((€€€¥˜¡…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%¥ì((€€€€€€€±•…É%¹Ñ•ÉÙ…° (€€€€€€€€€€€…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%(€€€€€€€€¤ì((€€€ô(((€€€€¼¨(€€€€€€ƒš¾<ÈÃžžK–ºkšf–¶cšªS¾ò0(€€€€€€ƒ–>«šr'žrš¶¦Z/–ž/¦+š"Ë¾ò#–ÞË–&×¢žK¾ò'š&7šr–¾›¦jo–¾¯–—¾ò0(€€€€€€ƒ¦
–r£–&×¢žKžV¯¦v‹šf¦g¢Ž‡šržnÓš:—¢ÞÏ¦;Ž(€€€€¨¼((€€€…ÕÑ½Í…Ù•%¹Ñ•ÉÙ…±%€ô(€€€€€€€Í•Ñ%¹Ñ•ÉÙ…°  ¤ôùì((€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡ÑÉÕ”¤ì((€€€€€€€ô°ÈÀÀÀÀ¤ì(((€€€€¼¨(€€€€€€ƒ–"–"Ã¢3šf¿¾ò?–"–"¦‚šfž®/–"ï–¶c’âš²‡Ž(€€€€€€ƒ’â7¦†¿ž’ëš>Cž’ë¾ò3–nƒž
ëžV¯¦v‹¦gšf–d(€€€€€€ƒž:§–ºÛ¦k–âã–ÞËžÚOžr/’â7–"Ã’êŽ(€€€€¨¼((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ù¥Í¥‰¥±¥Ñå¡…¹”ˆ°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€¥˜¡‘½Õµ•¹Ð¹¡¥‘‘•¸¥ì((€€€€€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡™…±Í”¤ì(((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢–n{–‚Ç¾ò0(€€€€€€€€€€€€€€€€€€ƒŽ3–"–"Ã¢3šf¿–7–"–n{’ú–"Ã–êWšr'šÊKšr$(€€€€€€€€€€€€€€€€€€ƒžº_¦n‹žÞkžÚO¦¦_Ž7¾ò'¾òk–"–"Ã¢3šf¿žj(€€€€€€€€€€€€€€€€€€ƒžVÛ’â/¾ò3¢¢c¦2¦g–/šf¦ZO¦î{¾ò3ž¶$(€€€€€€€€€€€€€€€€€€ƒ–"–n{–&7šf¿šfš&7ž~—¦O¢š–ú{¦g¢Ž„(€€€€€€€€€€€€€€€€€€ƒ¦Z/–ž/žº_Ž3¦n‹¦Z/’ê–’k’æŽ7Ž(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀô(€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤ì((€€€€€€€€€€€ô(€€€€€€€€€€€•±Í•ì((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾òk–"–n{–&7šf¿šf¾ò3žR£–&o–&l(€€€€€€€€€€€€€€€€€€ƒ–"–"Ã¢3šf¿¢¢c¦2žjšf¦ZO¦î{¾ò3žº_–è(€€€€€€€€€€€€€€€€€€ƒ¦gšº×¦n‹žÞkšf¦ZO–Â7š'žj¦n‹žÞkžÚO¦¦_ŠSŠP(€€€€€€€€€€€€€€€€€€ƒ¦gš¢’â7žR£šVÓ–/¦7šZÃšVÓžB¦‚¦v‹Ž(€€€€€€€€€€€€€€€€€€ƒ–Z»žÒS–"¢3šf¿–7–"–n{’ú–ÂÇšržržj(€€€€€€€€€€€€€€€€€€ƒžº_–"Ã¾ò3–n{ž¶S’ê’öÿžR£¢žjžZG–V?Ž(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€…±Õ±…Ñ•=™™±¥¹•áÁM¥¹” (€€€€€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±…ÍÑ=™™±¥¹•¡•­Q¥µ•ÍÑ…µÀô(€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤ì(((€€€€€€€€€€€€€€€€¼¨(€€€€€€€€€€€€€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3–b_¢¦›¢fWžB(€€€€€€€€€€€€€€€€€€ƒŽ3žâ»–Â?¢š[žª\¿–"–"Ã¢3šf¿–7š&O¦Z/šr–6‡’ö?Ž4(€€€€€€€€€€€€€€€€€€ƒžj–V?¦†3¾ò'¾òh(€€€€€€€€€€€€€€€€€€ƒ’æ/–&7¦g¢Ž‡–>«¢fWžB’êŽ3–"–ë–:ïŽ7žj(€€€€€€€€€€€€€€€€€€ƒ¦
’â–6+¾ò#–¶cšªS¾ò'¾ò3–º3–£šÊKšr'¢fWžB(€€€€€€€€€€€€€€€€€€ƒŽ3–"–n{’úŽ7¢¦Ëš;¦êóš‹–ú§ŠSŠSš&/š¦ž?¢š÷–f (€€€€€€€€€€€€€€€€€€ƒ–r£¢3šf¿šfšr–’Ÿ–æ¦f7’ö;žRk¢Ïšj¯–s¢¢#šf–f (€€€€€€€€€€€€€€€€€€ƒžj–~ß¢†3¦–ê›¾ò3–n{–"Ã–&7šf¿žjšf–g¾ò0(€€€€€€€€€€€€€€€€€€ƒ¦+š"Ë–Ÿ¦£žj–n{–B#¢¢#šf–f£Ž(€€€€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÓš:Kž¢/–ú#–>¿¢÷–ÞËžÚO¢Þ|(€€€€€€€€€€€€€€€€€€ƒ–¾›¦jožÚO¦;žjšf¦ZO–Â7’â7’â+¾ò3¢º+š"C–6‡’ö<(€€€€€€€€€€€€€€€€€€ƒ’â7–.Wžjš¢–¶CŽ((€€€€€€€€€€€€€€€€€€ƒ¦g¢Ž‡šÊK¢ú›šÎW’þw¢¶$ÄÀÀ—’þ»––÷š¾?’âž¢¸(€€€€€€€€€€€€€€€€€€ƒ–6‡’ö?žjššÎ¾ò#¢3šf¿¦fC–"Ûšb¿ž?¢š÷–f (€€€€€€€€€€€€€€€€€€ƒ–Æ“žÒkžj¾ò3šr³’ú–ÂÇšr'’êož.šÎšÊK¢ú›šÎT(€€€€€€€€€€€€€€€€€€ƒ–º3–£¦ÿ–7¾ò'¾ò3’ö¢Ï–ÂG–k’ê’â–,(€€€€€€€€€€€€€€€€€€ƒ–B#žBžj¢ŽsšVG¾òk–n{–"Ã–&7šf¿šf¾ò3–ššzp(€€€€€€€€€€€€€€€€€€ƒš"Ã¦²—¦
–r£¦Ë¢†3Ž¢ò«–"Ã¦r¢šž:§–ºÛ¢«–ÞÄ(€€€€€€€€€€€€€€€€€€ƒ¦ãšNžj¢žK¢&Ë¾ò3¦7šZÃšVÓžB’âš²‡–KšVã¢¢#šf(€€€€€€€€€€€€€€€€€€ƒ¾ò#žÖ›’â–/–£šZÃžjÈÃžžK¾ò3¢3’â7šb¿–îÛžê0(€€€€€€€€€€€€€€€€€€ƒ’â–/–>¿¢÷–ÞËžÚO–r£¢3šf¿¢ÞG–º3žj¢"+–KšVã¾ò'¾ò0(€€€€€€€€€€€€€€€€€€ƒ’â›’âS¦7šZÃšVÓžB’âš²‡žV¯¦v‹¦†¿ž’ë¾ò0(€€€€€€€€€€€€€€€€€€ƒ¦f7’ö;–6‡’ö?žjš¦ž:Ž(€€€€€€€€€€€€€€€€¨¼((€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€‰…ÑÑ±•Ñ¥Ù”€˜˜(€€€€€€€€€€€€€€€€€€€‰…ÑÑ±•A¡…Í”ôôô(€€€€€€€€€€€€€€€€€€€€‰‘•±…É”ˆ(€€€€€€€€€€€€€€€€¥ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐ…ÕÑ½=¸ô(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•àôôôÀ(€€€€€€€€€€€€€€€€€€€€€€€€ü…ÕÑ½	…ÑÑ±”(€€€€€€€€€€€€€€€€€€€€€€€€è•ÑA…ÉÑåÕÑ½½¹™¥œ¡…Ñ¥Ù•	…ÑÑ±•¡…É…Ñ•É%¹‘•à¤¹•¹…‰±•ì(((€€€€€€€€€€€€€€€€€€€¥˜ ……ÕÑ½=¸¥ì((€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•ÈôÈÀì((€€€€€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•Q¥µ•È ¤ì((€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ô(((€€€€€€€€€€€€€€€¥˜¡‰…ÑÑ±•Ñ¥Ù”¥ì((€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•U$ ¤ì((€€€€€€€€€€€€€€€ô((€€€€€€€€€€€ô((€€€€€€€ô(€€€€¤ì(((€€€€¼¨(€€€€€€ƒ¦^s¦Z'–"¦‚¾ò?¦7šZÃšVÓžB–&7žn‡¦?–¶c’âš²‡Ž(€€€€€€ƒš&/š¦ž?¢š÷–f£’â7’â–ºkšržŠë–¾›¢žãžfó¦g–/’ê/’îÛ¾ò0(€€€€€€ƒ’ö–*ƒ’ê–º3–£ž‡–ºÏ¾ò3–’k’â–Æ“’þw¦j«Ž(€€€€¨¼((€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰‰•™½É•Õ¹±½…ˆ°(€€€€€€€€ ¤ôùì((€€€€€€€€€€€…ÕÑ½M…Ù•9½Ü¡™…±Í”¤ì((€€€€€€€ô(€€€€¤ì()ô(((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€ƒ–"w–ž/–2X(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼()ÑÉåì((€€€É•‰Õ¥±‘%¹Ù•¹Ñ½ÉåM±½ÑÌ ¤ì((€€€ÕÁ‘…Ñ•É•…Ñ¥½¹U$ ¤ì((€€€É•¹‘•ÉM­¥±±1½…‘½ÕÐ ¤ì((€€€É•¹‘•É%¹Ù•¹Ñ½Éä ¤ì((€€€ÕÁ‘…Ñ•A±…å•É!•…‘•È ¤ì((€€€ÕÁ‘…Ñ•U$ ¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¦+š"Ë–"w–ž/–2[žfóžR¦2¿¢ª“¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨5½‰¥±”¡…É‘Ý…É”½‰É½ÝÍ•È	…¬Õ…É¸Q¡”™¥ÉÍÐ	…¬ÁÉ•ÍÌ…Í­Ì™½È(€€½¹™¥Éµ…Ñ¥½¸ì½¹™¥Éµ¥¹œÁ•É™½ÉµÌÑ¡”É•…°¹…Ù¥…Ñ¥½¸°…¹•±±¥¹œ­••ÁÌ(€€Ñ¡”Á±…å•È¥¸Ñ¡”…µ”¸€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±5½‰¥±•	…­½¹™¥Éµ…Ñ¥½¸ ¥ì((€€€±•Ð…±±½Ý¥¹á¥Ðõ™…±Í”ì(€€€±•Ð•á¥ÑAÉ½µÁÑ=Á•¸õ™…±Í”ì((€€€Ý¥¹‘½Ü¹…±±½Ý…µ•9…Ù¥…Ñ¥½¸ô ¤ôùì(€€€€€€€…±±½Ý¥¹á¥ÐõÑÉÕ”ì(€€€ôì((€€€ÑÉåì(€€€€€€€¡¥ÍÑ½Éä¹ÁÕÍ¡MÑ…Ñ”¡íÉÁá¥ÑÕ…ÉéÑÉÕ•ô°ˆˆ±±½…Ñ¥½¸¹¡É•˜¤ì(€€€ô(€€€…Ñ ¡•ÉÉ½È¥ì(€€€€€€€½¹Í½±”¹Ý…É¸ ‹ž‡šÎW–îëž®/¢þS–n{¦bË–FžÒ¦2¾òhˆ±•ÉÉ½È¤ì(€€€ô((€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½ÁÍÑ…Ñ”ˆ±…Íå¹Œ ¤ôùì(€€€€€€€¥˜¡…±±½Ý¥¹á¥Ð¥ìÉ•ÑÕÉ¸ìô((€€€€€€€€¼¨9…Ñ¥Ù”½¹™¥É´ÕÍ•Ñ¼‰±½¬‰É½ÝÍ•È¡¥ÍÑ½ÉäÝ¡¥±”¥ÐÝ…Ì½Á•¸¸(€€€€€€€€€€Q¡”IA‘¥…±½œ¥Ì…Íå¹¡É½¹½ÕÌ°Í¼¥µµ•‘¥…Ñ•±äÉ•ÍÑ½É”„Õ…É(€€€€€€€€€€•¹ÑÉä‰•™½É”…Ý…¥Ñ¥¹œÑ¡”Á±…å•ÈÌ¡½¥”¸€¨¼(€€€€€€€±•ÐÕ…É‘I•ÍÑ½É•õ™…±Í”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¡¥ÍÑ½Éä¹ÁÕÍ¡MÑ…Ñ”¡íÉÁá¥ÑÕ…ÉéÑÉÕ•ô°ˆˆ±±½…Ñ¥½¸¹¡É•˜¤ì(€€€€€€€€€€€Õ…É‘I•ÍÑ½É•õÑÉÕ”ì(€€€€€€€õ…Ñ ¡|¥ìô((€€€€€€€¥˜ (€€€€€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”˜˜(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤(€€€€€€€€¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜¡•á¥ÑAÉ½µÁÑ=Á•¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•á¥ÑAÉ½µÁÑ=Á•¸õÑÉÕ”ì((€€€€€€€½¹ÍÐ½¹™¥Éµ•ô(€€€€€€€€€€€ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆ€˜˜(€€€€€€€€€€€…Ý…¥ÐÝ¥¹‘½Ü¹ÉÁ½¹™¥É´ (€€€€€€€€€€€€€€€€‹žŠë–ºk¢š¦n‹¦Z/¦+š"Ë–^;¾òžn»–&7¦Ë–ê›šr–#¢«–.W–¶cšªSŽˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€Ñ¥Ñ±”è‹¦n‹¦Z/–K¦j¨ˆ°(€€€€€€€€€€€€€€€€€€€½¹™¥ÉµQ•áÐè‹–Ë–¶c’â›¦n‹¦Z,ˆ°(€€€€€€€€€€€€€€€€€€€…¹•±Q•áÐè‹žæóžê3–K¦j¨ˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€•á¥ÑAÉ½µÁÑ=Á•¸õ™…±Í”ì((€€€€€€€¥˜¡½¹™¥Éµ•¥ì(€€€€€€€€€€€…±±½Ý¥¹á¥ÐõÑÉÕ”ì(€€€€€€€€€€€Í…Ù•…µ” ¤ì(€€€€€€€€€€€¡¥ÍÑ½Éä¹¼¡Õ…É‘I•ÍÑ½É•ü´Èè´Ä¤ì(€€€€€€€ô(€€€ô¤ì()ô¤ ¤ì(((¼¨(€€ƒŠbƒšZÃ–Š{¾òk–£¢z‹–æW–*¢÷Ž((€€ƒ¦7¢šžjš*¢†O¦fC–"Û–#¢ª«šâš–k¾òh(€€ƒž?¢š÷–f£–~ëšZó–º'–£¢¦?¾ò3Ž3žÖW–Â7’â7–¢¢ÇŽ7žÚË¦‚–r (€€ƒ–º3–£šÊKšr'’öÿžR£¢’êK–.WžjššÎ’â/¢«–.W¦Ë–—–£¢z‹–æW¾ò0(€€ƒ’â–ºk¢šž:§–ºÛ¢«–ÞÇ¦î{’â’â/žV¯¦v‹š&7¢÷¢žãžfóŠSŠP(€€ƒ¦gšb½¡É½µ—ŽM…™…É§Žš&šr'ž?¢š÷–f£–Ç¦kžj¦fC–"Û¾ò0(€€ƒ’â7šb¿¦g–/¦+š"Ë–k–ú_–"Ãš"[–k’â7–"Ãžj–V?¦†3¾ò0(€€ƒ’îï’öWžÚË¦‚¦+š"Ë¦÷žæ{’â7¦;¦g’â¦^sŽ((€€ƒ¦g¢Ž‡–kžjšb¿Ž3¦¢3šÆ–Ûš²‡Ž7’öšr¦‚š&/žj–kšÎW¾òh(€€ƒžn¢÷ž:§–ºÛ–r£žV¯¦v‹’â+Ž3ž²³’âš²‡Ž7žj¦î{šN+š"[¢žãš:Ÿ¾ò0(€€ƒ¦
’â’â/¦‚’úÿ’â¢Öß¢žãžfó–£¢z‹–æW¢®/šÆ¾ò0(€€ƒž:§–ºÛ–æû’æ;š¢šë’â7–"Ã–’k’â–/š¶—¦¦|(€€ƒ¾ò#’â7žº‡’î[¦î{žjšb¿–&×¢žKžV¯¦v‹žjš2'¦"W¾ò0(€€ƒ¦
šb¿–ÞËšr'–¶cšªSšf’âï–~;žV¯¦v‹žj’îï’öW–rÃšZç¾ò0(€€ƒ¦÷šr¢žãžfó¾ò3’æ/–ú3–ÂÇ’â7šr–7š&OšNû¾ò'Ž((€€ƒ–ššzsž:§–ºÛžjž?¢š÷–f£’â7šR¿š>Ó–£¢z‹–æUA'Ž(€€ƒš"[ž?¢š÷–f£–~ëšZóš~C’êo–:–nƒš.KžÖW¢®/šÆ¾ò0(€€ƒ¦g¢Ž‡žR¡ÑÉä½…Ñ£šVÓ–/–2¢Öß’ú¾ò0(€€ƒ–’ÇšV_’ê–ÂÇ¦îc¦îcšRûšŽ¾ò3’â7šr–öÇ¦~ÿ¦+š"Ëšr³¢ê¯š¶–âã¦/’ösŽ(¨¼()™Õ¹Ñ¥½¸É•ÅÕ•ÍÑ…µ•Õ±±ÍÉ••¸ ¥ì((€€€½¹ÍÐ•°ô(€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ðì(((€€€½¹ÍÐÉ•ÅÕ•ÍÐô((€€€€€€€•°¹É•ÅÕ•ÍÑÕ±±ÍÉ••¹ñð(€€€€€€€•°¹Ý•‰­¥ÑI•ÅÕ•ÍÑÕ±±ÍÉ••¹ñð(€€€€€€€•°¹µ½éI•ÅÕ•ÍÑÕ±±MÉ••¹ñð(€€€€€€€•°¹µÍI•ÅÕ•ÍÑÕ±±ÍÉ••¸ì(((€€€¥˜ …É•ÅÕ•ÍÐ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(((€€€ÑÉåì((€€€€€€€½¹ÍÐÉ•ÍÕ±Ðô(€€€€€€€€€€€É•ÅÕ•ÍÐ¹…±°¡•°¤ì(((€€€€€€€¥˜ (€€€€€€€€€€€É•ÍÕ±Ð€˜˜(€€€€€€€€€€€É•ÍÕ±Ð¹…Ñ (€€€€€€€€¥ì((€€€€€€€€€€€É•ÍÕ±Ð¹…Ñ   ¤ôùíô¤ì((€€€€€€€ô((€€€ô(€€€…Ñ ¡•ÉÉ½È¥íô()ô(()™Õ¹Ñ¥½¸•¹…‰±•Õ±±ÍÉ••¹=¹¥ÉÍÑQ…À ¥ì((€€€½¹ÍÐ¡…¹‘±•Èô ¤ôùì((€€€€€€€É•ÅÕ•ÍÑ…µ•Õ±±ÍÉ••¸ ¤ì((€€€ôì(((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰±¥¬ˆ°(€€€€€€€¡…¹‘±•È°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì(((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Ñ½Õ¡ÍÑ…ÉÐˆ°(€€€€€€€¡…¹‘±•È°(€€€€€€€í½¹”éÑÉÕ•ô(€€€€¤ì()ô(((¼¨(€€ƒŠbƒ’þ»š¶¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒ’â7¢š–7–òß–"Û–£¢z‹–æW¾ò3¦g¢Ž‡’â7–Fó–>¬(€€•¹…‰±•Õ±±ÍÉ••¹=¹¥ÉÍÑQ…À §¾ò0(€€ƒ–÷–ò?šr³¢ê¯’þwžVg¢F_¾ò3’æ/–ú3–ššzsšÏ¢š¦7šZÃš&O¦Z,(€€ƒ¦g–/–*¢÷¾ò3žnÓš:—š*+’â/¦v‹¦g¢†3–>[šÚ#¢¢ï¢ž–6Ï–>¿Ž(¨¼((¼¨XÄÈè¼¹½Ð…ÕÑ¼µ•¹Ñ•È‰É½ÝÍ•È™Õ±±ÍÉ••¸½¸™¥ÉÍÐÑ…À¸€¨¼(¼¨(€€ƒŠbƒšr–ú3š&7¢º–>[–¶cšªSŽ(€€ƒ¦gš¢ž²³’âš²‡–V–.W’â–ºkšr¦Ë–&×¢žK¾ò0(€€ƒšr'–¶cšªS–&’â–ºk¦Ë¦+š"ËŽ(€€±½…‘…µ—–Ÿ¦£šr³¢ê¯’æšr%ÑÉä½…Ñ£¾ò0(€€ƒ¦g¢Ž‡–7–2’â–Æ“šb¿¦ng¦7’þw¦j«¾ò0(€€ƒžŠë’þwž‡¢®[–š’öW¦÷’â7šr–6‡š¶ïšVÓ–/žÚË¦‚Ž(¨¼((¼¨(€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò'¾òh(€€ƒš*(Ó–/¢«–.Wš"Ã¦²—¢¢·–ºk¦v‹švÿ¢Ž‡žj–:žR|ñÍ•±•Ðø(€€ƒš>oš"C¢«¢¢–¦ã–Z»Ž¦dÓ–/–žÒƒ–r¡!Q53¢Ž„(€€ƒšr³’ú–ÂÇ–¶c–r£¾ò#’â7šb¿’æ/–ú3š&7–.Wš/žR‹žRžj¾ò'¾ò0(€€ƒ¦g¢Ž‡–>¿’î—šRû–þ–r£¦+š"Ë–V–.Wšf–ÂÇ–"w–ž/–2[’âš²‡¾ò0(€€ƒ’â7žR£ž¶'–"Ã¢¢·–ºk¦v‹švÿžržj¢Š¯š&O¦Z/Ž(¨¼()ÑÉåì((€€€l(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹Í¡…É…Ñ•ÉM•±•Ðˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹ÍÑ¥½¹M•±•Ðˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹Í!@ˆ°(€€€€€€€€‰…ÕÑ½M•ÑÑ¥¹ÍM@ˆ(€€€t¹™½É…  (€€€€€€€Í•±•Ñ%ôùì((€€€€€€€€€€€¥¹¥ÑÕÍÑ½µÉ½Á‘½Ý¸ (€€€€€€€€€€€€€€€Í•±•Ñ%(€€€€€€€€€€€€¤ì((€€€€€€€ô(€€€€¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¢«¢¢’â/š.'¦ã–Z»–"w–ž/–2[–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(()ÑÉåì((€€€€¼¨(€€€€€€ƒŠbƒšZÃ–Š{¾ò#’úwžŸ’öÿžR£¢¢ššÆ¾ò3Ž3–*ƒ¦î{¢š(€€€€€€ƒšZÃ–Š{¦Vßš2'–þ¯¦–*ƒ¦î{Ž7¾ò'¾òh(€€€€€€ƒ¦‚¦v‹¢ò'–—šf¾ò3š*(ÛžÖ–Æ³šŸžj¬¼·š2'¦"T(€€€€€€ƒ–£¦£žÚ’â+¦Vßš2'š2žê3¢žãžfó¾ò3’âš²‡šœ(€€€€€€ƒ¢¢·–ºk¾ò3’â7žR£–r£š¾?–/š2'¦"Wžj!Q53’â((€€€€€€ƒ–B¢«–¾¯’ê/’îÛŽ(€€€€¨¼((€€€l(€€€€€€€l‰…ÑÑ…¬ˆ°‰ÑÑ…¬‰t°(€€€€€€€l‰Ù¥Ñ…±¥Ñäˆ°‰Y¥Ñ…±¥Ñä‰t°(€€€€€€€l‰•¹•Éäˆ°‰¹•Éä‰t°(€€€€€€€l‰¥¹Ñ•±±¥•¹”ˆ°‰%¹Ñ•±±¥•¹”‰t°(€€€€€€€l‰‘•™•¹Í•A½¥¹ÑÌˆ°‰•™•¹Í”‰t°(€€€€€€€l‰…¥±¥Ñäˆ°‰¥±¥Ñä‰t(€€€t¹™½É…  ¡mÍÑ…Ñ-•ä±¥‘A…ÉÑt¤ôùì((€€€€€€€…ÑÑ…¡1½¹AÉ•ÍÌ (€€€€€€€€€€€€ ‰ÍÑ…ÑÕÍ	Ñ¸ˆ­¥‘A…ÉÐ¬‰5¥¹ÕÌˆ¤°(€€€€€€€€€€€€ ¤ôùÉ•µ½Ù•A½¥¹Ð¡ÍÑ…Ñ-•ä¤(€€€€€€€€¤ì(((€€€€€€€…ÑÑ…¡1½¹AÉ•ÍÌ (€€€€€€€€€€€€ ‰ÍÑ…ÑÕÍ	Ñ¸ˆ­¥‘A…ÉÐ¬‰A±ÕÌˆ¤°(€€€€€€€€€€€€ ¤ôù…‘‘A½¥¹Ð¡ÍÑ…Ñ-•ä¤(€€€€€€€€¤ì((€€€ô¤ì()ô)…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹–Æ³šŸ–*ƒ¦î{¦Vßš2'žÚ–ºk–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨MÑ…ÉÑÕÁMÑ…Ñ•5…¡¥¹”¥ÌÑ¡”½¹±ä½Ý¹•È…±±½Ý•Ñ¼Í•±•Ð…¹±½……¸…½Õ¹ÐÍ…Ù”¸€¨¼(((¼¨(€€ƒŠbƒ’â7žº‡–&×¢žKš"[¢ºšªS–N«šŠw¢Þ¿–úG¾ò0(€€ƒšr–ú3¦÷–V–.W¢«–.W–¶cšªSŽ(€€ÍÑ…ÉÑÕÑ½M…Ù” ¤ƒ–Ÿ¦£žj–ºkšf–f (€€ƒš¾?š²‡¢žãžfó¦÷šr¢«–ÞÇšª‹š~—¦+š"Ëšb¿–B›–ÞËžÚO¦Z/–ž/¾ò0(€€ƒš&’î—–ÂÇžº_¦gšf–gž:§–ºÛ¦
–r£–&×¢žKžV¯¦v‹¾ò0(€€ƒ’æ’â7šr–ë¦2¿š"[–¶c¦Ëž¦ë¢ÎšZgŽ(¨¼()ÑÉåì((€€€ÍÑ…ÉÑÕÑ½M…Ù” ¤ì()õ…Ñ ¡•ÉÉ½È¥ì((€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€‹¢«–.W–¶cšªS–V–.W–’ÇšV_¾òhˆ°(€€€€€€€•ÉÉ½È(€€€€¤ì()ô(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÄµÍÑ…”µØàµÑ½Õ µ±½¬¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€€¼¨5½‰¥±”¥¹ÁÕÐ½¹ÑÉ…Ð½Ý¹•È¸ÍÉ½±°½Ý¹•È‘•±…É•Ì(€€€€€€‘…Ñ„µÍÉ½±°µ½Ý¹•Èô‰áñåñ‰½Ñ ˆ¸1•…ä½Ý¹•ÉÌ…É”¥¹™•ÉÉ•½¹±ä™É½´(€€€€€€É•…°½µÁÕÑ•½Ù•É™±½Ü°¹•Ù•È™É½´„Í•±•Ñ½ÈÝ¡¥Ñ•±¥ÍÐ¸€¨¼(€€€½¹ÍÐQA}M1=A}MM}A`ôÄÀì(€€€½¹ÍÐ…Ñ¥Ù•A½¥¹Ñ•ÉÌõ¹•Ü5…À ¤ì(€€€€¼¼½µÁ±•Ñ••ÍÑÕÉ•Ì•áÁ¥É”•Ù•¸¥˜Ñ¡”‰É½ÝÍ•È•µ¥ÑÌ¹¼½µÁ…Ñ¥‰¥±¥Ñä±¥¬¸(€€€½¹ÍÐ1%-}1%Q%5}5LôÄÀÀÀì(€€€½¹ÍÐ½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌõ¹•Ü5…À ¤ì(€€€±•Ð±•…å±¥­•ÍÑÕÉ”õ¹Õ±°ì(€€€™Õ¹Ñ¥½¸¥Í…µ•MÕÉ™…•Q…É•Ð¡Ñ…É•Ð¥ìÉ•ÑÕÉ¸€„„¡Ñ…É•Ð˜™Ñ…É•Ð¹±½Í•ÍÐ˜™Ñ…É•Ð¹±½Í•ÍÐ ˆ…µ”µÍÑ…”ˆ¤¤ìô(€€€™Õ¹Ñ¥½¸¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡Ñ…É•Ð¥ìÉ•ÑÕÉ¸€„„¡Ñ…É•Ð˜™Ñ…É•Ð¹±½Í•ÍÐ˜™Ñ…É•Ð¹±½Í•ÍÐ ¥¹ÁÕÐ°Ñ•áÑ…É•„°m½¹Ñ•¹Ñ•‘¥Ñ…‰±”ô‰ÑÉÕ”‰tœ¤¤ìô(€€€™Õ¹Ñ¥½¸ÍÉ½±±á•Ì¡¹½‘”¥ì(€€€€€€€½¹ÍÐÍÑå±”õÝ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡¹½‘”¤ì(€€€€€€€½¹ÍÐ‘•±…É•õ¹½‘”¹•ÑÑÑÉ¥‰ÕÑ”˜™¹½‘”¹•ÑÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µÍÉ½±°µ½Ý¹•Èˆ¤ì(€€€€€€€½¹ÍÐ…¹dô¡ÍÑå±”¹½Ù•É™±½Ýdôôô‰…ÕÑ¼‰ññÍÑå±”¹½Ù•É™±½Ýdôôô‰ÍÉ½±°ˆ¤˜™¹½‘”¹ÍÉ½±±!•¥¡Ðù¹½‘”¹±¥•¹Ñ!•¥¡Ð¬Äì(€€€€€€€½¹ÍÐ…¹`ô¡ÍÑå±”¹½Ù•É™±½Ý`ôôô‰…ÕÑ¼‰ññÍÑå±”¹½Ù•É™±½Ý`ôôô‰ÍÉ½±°ˆ¤˜™¹½‘”¹ÍÉ½±±]¥‘Ñ ù¹½‘”¹±¥•¹Ñ]¥‘Ñ ¬Äì(€€€€€€€¥˜¡‘•±…É•ôôô‰äˆ¤É•ÑÕÉ¸…¹dü‰äˆé¹Õ±°ì(€€€€€€€¥˜¡‘•±…É•ôôô‰àˆ¤É•ÑÕÉ¸…¹`ü‰àˆé¹Õ±°ì(€€€€€€€¥˜¡‘•±…É•ôôô‰‰½Ñ ˆ¤É•ÑÕÉ¸…¹aññ…¹dü‰‰½Ñ ˆé¹Õ±°ì(€€€€€€€¥˜¡…¹`˜™…¹d¤É•ÑÕÉ¸€‰‰½Ñ ˆì(€€€€€€€É•ÑÕÉ¸…¹dü‰äˆé…¹`ü‰àˆé¹Õ±°ì(€€€ô(€€€™Õ¹Ñ¥½¸™¥¹‘MÉ½±±=Ý¹•È¡Ñ…É•Ð¥ì(€€€€€€€±•Ð¹½‘”õÑ…É•Ð˜™Ñ…É•Ð¹¹½‘•QåÁ”ôôôÄýÑ…É•ÐéÑ…É•Ð˜™Ñ…É•Ð¹Á…É•¹Ñ±•µ•¹Ðì(€€€€€€€Ý¡¥±”¡¹½‘”˜™¹½‘”„ôõ‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¥ì½¹ÍÐ…á•ÌõÍÉ½±±á•Ì¡¹½‘”¤ì¥˜¡…á•Ì¤É•ÑÕÉ¸í¹½‘”±…á•Íôì¹½‘”õ¹½‘”¹Á…É•¹Ñ±•µ•¹Ðìô(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô(€€€™Õ¹Ñ¥½¸¥¹Ñ•É…Ñ¥Ù•Q…É•Ð¡Ñ…É•Ð¥ìÉ•ÑÕÉ¸Ñ…É•Ð˜™Ñ…É•Ð¹±½Í•ÍÐ˜™Ñ…É•Ð¹±½Í•ÍÐ ‰‰ÕÑÑ½¸±„±mÉ½±”õ‰ÕÑÑ½¹t±¥¹ÁÕÐ±Í•±•Ð±Ñ•áÑ…É•„±m‘…Ñ„µ…Ñ¥½¹t±m½¹±¥­tˆ¤ìô(€€€™Õ¹Ñ¥½¸ÁÉÕ¹••ÍÑÕÉ•Ì ¥ì(€€€€€€€½¹ÍÐ¹½Üõ…Ñ”¹¹½Ü ¤ì(€€€€€€€™½È¡½¹ÍÐm¥±Á½¥¹Ñ•Ét½˜½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¥ì(€€€€€€€€€€€¥˜¡¹½ÜµÁ½¥¹Ñ•È¹™¥¹¥Í¡•‘Ðù1%-}1%Q%5}5MññÁ½¥¹Ñ•È¹¥¹Ñ•É…Ñ¥Ù•Q…É•Ð¹¥Í½¹¹•Ñ•ôôõ™…±Í”¥ì½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹‘•±•Ñ”¡¥¤ìô(€€€€€€€ô(€€€€€€€¥˜¡±•…å±¥­•ÍÑÕÉ”˜˜…½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹¡…Ì¡±•…å±¥­•ÍÑÕÉ”¹Á½¥¹Ñ•É%¤¥ì±•…å±¥­•ÍÑÕÉ”õ¹Õ±°ìô(€€€ô(€€€™Õ¹Ñ¥½¸É•µ•µ‰•É½µÁ±•Ñ¥½¸¡Á½¥¹Ñ•È¥ì(€€€€€€€Á½¥¹Ñ•È¹™¥¹¥Í¡•‘Ðõ…Ñ”¹¹½Ü ¤ì(€€€€€€€½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹Í•Ð¡Á½¥¹Ñ•È¹Á½¥¹Ñ•É%±Á½¥¹Ñ•È¤ì(€€€€€€€±•…å±¥­•ÍÑÕÉ”õÁ½¥¹Ñ•Èì(€€€ô(€€€™Õ¹Ñ¥½¸½¹ÍÕµ•MÕÁÁÉ•ÍÍ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€ÁÉÕ¹••ÍÑÕÉ•Ì ¤ì(€€€€€€€€¼¼-•å‰½…É½…ÍÍ¥ÍÑ¥Ù”½ÁÉ½É…µµ…Ñ¥Œ…Ñ¥Ù…Ñ¥½¸¥Ì¹½Ð„Á½¥¹Ñ•È•ÍÑÕÉ”¸(€€€€€€€¥˜¡•Ù•¹Ð¹‘•Ñ…¥°ôôôÀ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐ¡…ÍA½¥¹Ñ•É%õ9Õµ‰•È¹¥Í¥¹¥Ñ”¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤˜™•Ù•¹Ð¹Á½¥¹Ñ•É%øôÀì(€€€€€€€½¹ÍÐÁ½¥¹Ñ•Èõ¡…ÍA½¥¹Ñ•É%ý½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹•Ð¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤é±•…å±¥­•ÍÑÕÉ”ì(€€€€€€€¥˜ …Á½¥¹Ñ•È¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€€¼¼±•…ä5½ÕÍ•Ù•¹Ð…¹¹½Ð¥‘•¹Ñ¥™ä…¸½±Ñ½Õ …™Ñ•È„¹•Ü‘½Ý¸¸(€€€€€€€¥˜ …¡…ÍA½¥¹Ñ•É%˜™…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Í¥é”¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐÑ…É•Ðõ¥¹Ñ•É…Ñ¥Ù•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¥ññ•Ù•¹Ð¹Ñ…É•Ðì(€€€€€€€½¹ÍÐ¥¹¥Ñ¥…°õÁ½¥¹Ñ•È¹¥¹Ñ•É…Ñ¥Ù•Q…É•Ðì(€€€€€€€¥˜¡¥¹¥Ñ¥…°„ôõÑ…É•Ð˜˜„¡¥¹¥Ñ¥…°¹½¹Ñ…¥¹Ì˜™¥¹¥Ñ¥…°¹½¹Ñ…¥¹Ì¡Ñ…É•Ð¤¤˜˜„¡Ñ…É•Ð¹½¹Ñ…¥¹Ì˜™Ñ…É•Ð¹½¹Ñ…¥¹Ì¡¥¹¥Ñ¥…°¤¤¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹‘•±•Ñ”¡Á½¥¹Ñ•È¹Á½¥¹Ñ•É%¤ì(€€€€€€€¥˜¡±•…å±¥­•ÍÑÕÉ”ôôõÁ½¥¹Ñ•È¥ì±•…å±¥­•ÍÑÕÉ”õ¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸Á½¥¹Ñ•È¹ÍÑ…Ñ”„ôô‰Q@ˆì(€€€ô(€€€™Õ¹Ñ¥½¸±…ÍÍ¥™ä¡Á½¥¹Ñ•È±•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐ‘¥ÍÑ…¹”õ5…Ñ ¹¡åÁ½Ð¡•Ù•¹Ð¹±¥•¹Ñ`µÁ½¥¹Ñ•È¹ÍÑ…ÉÑ`±•Ù•¹Ð¹±¥•¹ÑdµÁ½¥¹Ñ•È¹ÍÑ…ÉÑd¤ì(€€€€€€€Á½¥¹Ñ•È¹ÕÉÉ•¹Ñ`õ•Ù•¹Ð¹±¥•¹Ñ`ìÁ½¥¹Ñ•È¹ÕÉÉ•¹Ñdõ•Ù•¹Ð¹±¥•¹ÑdìÁ½¥¹Ñ•È¹‘¥ÍÑ…¹”õ‘¥ÍÑ…¹”ì(€€€€€€€¥˜¡‘¥ÍÑ…¹”ñQA}M1=A}MM}AaññÁ½¥¹Ñ•È¹ÍÑ…Ñ”„ôô‰Q@ˆ¤É•ÑÕÉ¸ì(€€€€€€€Á½¥¹Ñ•È¹ÍÑ…Ñ”õÁ½¥¹Ñ•È¹‘É…=Ý¹•Èü‰IˆéÁ½¥¹Ñ•È¹ÍÉ½±±=Ý¹•Èü‰MI=10ˆè‰90ˆì(€€€ô(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½Ý¸ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€¥˜¡•Ù•¹Ð¹Á½¥¹Ñ•ÉQåÁ”ôôô‰Ñ½Õ ˆ˜™…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Í¥é”˜˜…¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤¥ì(€€€€€€€€€€€™½È¡½¹ÍÐÁ½¥¹Ñ•È½˜…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Ù…±Õ•Ì ¤¥ìÁ½¥¹Ñ•È¹ÍÑ…Ñ”ô‰90ˆìô(€€€€€€€ô(€€€€€€€¥˜ …¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¥ñð¡•Ù•¹Ð¹Á½¥¹Ñ•ÉQåÁ”ôôô‰µ½ÕÍ”ˆ˜™•Ù•¹Ð¹‰ÕÑÑ½¸„ôôÀ¤¤É•ÑÕÉ¸ì(€€€€€€€ÁÉÕ¹••ÍÑÕÉ•Ì ¤ì(€€€€€€€±•…å±¥­•ÍÑÕÉ”õ¹Õ±°ì(€€€€€€€½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹‘•±•Ñ”¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ì(€€€€€€€½¹ÍÐ¥¹¥Ñ¥…°õ¥¹Ñ•É…Ñ¥Ù•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¥ññ•Ù•¹Ð¹Ñ…É•Ðì(€€€€€€€…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Í•Ð¡•Ù•¹Ð¹Á½¥¹Ñ•É%±íÁ½¥¹Ñ•É%é•Ù•¹Ð¹Á½¥¹Ñ•É%±ÍÑ…ÉÑ`é•Ù•¹Ð¹±¥•¹Ñ`±ÍÑ…ÉÑdé•Ù•¹Ð¹±¥•¹Ñd±ÕÉÉ•¹Ñ`é•Ù•¹Ð¹±¥•¹Ñ`±ÕÉÉ•¹Ñdé•Ù•¹Ð¹±¥•¹Ñd±‘¥ÍÑ…¹”èÀ±¥¹¥Ñ¥…±Q…É•Ðé•Ù•¹Ð¹Ñ…É•Ð±¥¹Ñ•É…Ñ¥Ù•Q…É•Ðé¥¹¥Ñ¥…°±ÍÉ½±±=Ý¹•Èé™¥¹‘MÉ½±±=Ý¹•È¡•Ù•¹Ð¹Ñ…É•Ð¤±‘É…=Ý¹•Èé•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ˜™•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ ‰m‘…Ñ„µ‘É…œµ½Ý¹•Étˆ¤±ÍÑ…Ñ”è‰Q@‰ô¤ì(€€€€€€€¥˜¡…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Í¥é”øÄ¥ì™½È¡½¹ÍÐÁ½¥¹Ñ•È½˜…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Ù…±Õ•Ì ¤¥ìÁ½¥¹Ñ•È¹ÍÑ…Ñ”ô‰90ˆìôô(€€€ô±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•Éµ½Ù”ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì½¹ÍÐÁ½¥¹Ñ•Èõ…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹•Ð¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ì¥˜¡Á½¥¹Ñ•È¤±…ÍÍ¥™ä¡Á½¥¹Ñ•È±•Ù•¹Ð¤ìô±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€™Õ¹Ñ¥½¸™¥¹¥Í¡A½¥¹Ñ•È¡•Ù•¹Ð¥ì½¹ÍÐÁ½¥¹Ñ•Èõ…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹•Ð¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ì¥˜ …Á½¥¹Ñ•È¤É•ÑÕÉ¸ì±…ÍÍ¥™ä¡Á½¥¹Ñ•È±•Ù•¹Ð¤ì…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹‘•±•Ñ”¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ìÉ•µ•µ‰•É½µÁ±•Ñ¥½¸¡Á½¥¹Ñ•È¤ìô(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•ÉÕÀˆ±™¥¹¥Í¡A½¥¹Ñ•È±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€™Õ¹Ñ¥½¸…¹•±A½¥¹Ñ•È¡•Ù•¹Ð¥ì½¹ÍÐÁ½¥¹Ñ•Èõ…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹•Ð¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ì¥˜¡Á½¥¹Ñ•È¥ìÁ½¥¹Ñ•È¹ÍÑ…Ñ”ô‰90ˆì…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹‘•±•Ñ”¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ìÉ•µ•µ‰•É½µÁ±•Ñ¥½¸¡Á½¥¹Ñ•È¤ìôô(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É…¹•°ˆ±…¹•±A½¥¹Ñ•È±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€™Õ¹Ñ¥½¸¡…¹‘±•MÕÁÁÉ•ÍÍ•‘•ÍÑÕÉ•±¥¬¡•Ù•¹Ð¥ì¥˜¡½¹ÍÕµ•MÕÁÁÉ•ÍÍ¥½¸¡•Ù•¹Ð¤¥ì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ìôô(€€€½¹ÍÐÍÑ…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€¥˜¡ÍÑ…”¥ìÍÑ…”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±¡…¹‘±•MÕÁÁÉ•ÍÍ•‘•ÍÑÕÉ•±¥¬±ÑÉÕ”¤ìÍÑ…”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É±•…Ù”ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡•Ù•¹Ð¹Ñ…É•ÐôôõÍÑ…”¥ì…¹•±A½¥¹Ñ•È¡•Ù•¹Ð¤ìôô±ÑÉÕ”¤ìô(€€€™Õ¹Ñ¥½¸É•Í•Ñ•ÍÑÕÉ•Ì ¥ì…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹±•…È ¤ì½µÁ±•Ñ•‘A½¥¹Ñ•ÉÌ¹±•…È ¤ì±•…å±¥­•ÍÑÕÉ”õ¹Õ±°ìô(€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‰±ÕÈˆ±É•Í•Ñ•ÍÑÕÉ•Ì¤ì(€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á…•¡¥‘”ˆ±É•Í•Ñ•ÍÑÕÉ•Ì¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ù¥Í¥‰¥±¥Ñå¡…¹”ˆ±™Õ¹Ñ¥½¸ ¥ì¥˜¡‘½Õµ•¹Ð¹¡¥‘‘•¸¥ìÉ•Í•Ñ•ÍÑÕÉ•Ì ¤ìôô¤ì((€€€€¼¨A¥¹ ¥ÌÑ¡”Í½±”Ñ½Õ¡µ½Ù”…¹•±±…Ñ¥½¸¸M¥¹±”µ™¥¹•ÈÁ…¹¹¥¹œ¥Ì(€€€€€€‘•±¥‰•É…Ñ•±ä±•™ÐÑ¼Ñ¡”‰É½ÝÍ•È…¹Ñ¡”MÉ½±°=Ý¹•ÈML½¹ÑÉ…Ð¸€¨¼(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ñ½Õ¡µ½Ù”ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤˜™•Ù•¹Ð¹Ñ½Õ¡•Ì˜™•Ù•¹Ð¹Ñ½Õ¡•Ì¹±•¹Ñ øÄ¥ì™½È¡½¹ÍÐÁ½¥¹Ñ•È½˜…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹Ù…±Õ•Ì ¤¥ìÁ½¥¹Ñ•È¹ÍÑ…Ñ”ô‰90ˆìô•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìôô±íÁ…ÍÍ¥Ù”é™…±Í•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰½¹Ñ•áÑµ•¹Ôˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤˜˜…¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡•Ù•¹Ð¹Ñ…É•Ð¤¤•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìô±í…ÁÑÕÉ”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‘É…ÍÑ…ÉÐˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤˜˜…¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡•Ù•¹Ð¹Ñ…É•Ð¤¤•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìô±í…ÁÑÕÉ”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Í•±•ÑÍÑ…ÉÐˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤˜˜…¥Í‘¥Ñ…‰±•…µ•½¹ÑÉ½°¡•Ù•¹Ð¹Ñ…É•Ð¤¤•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìô±í…ÁÑÕÉ”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ý¡••°ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡•Ù•¹Ð¹ÑÉ±-•ä˜™¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤¤•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìô±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”é™…±Í•ô¤ì(€€€l‰•ÍÑÕÉ•ÍÑ…ÉÐˆ°‰•ÍÑÕÉ•¡…¹”‰t¹™½É… ¡¹…µ”ôùÝ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡¹…µ”±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì¥˜¡¥Í…µ•MÕÉ™…•Q…É•Ð¡•Ù•¹Ð¹Ñ…É•Ð¤¤•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìô±íÁ…ÍÍ¥Ù”é™…±Í•ô¤¤ì(€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í•ÍÑÕÉ•É‰¥Ñ•Èõ=‰©•Ð¹™É••é”¡íQA}M1=A}MM}A`±™¥¹‘MÉ½±±=Ý¹•È±•ÑMÑ…Ñ”éÁ½¥¹Ñ•É%ôù…Ñ¥Ù•A½¥¹Ñ•ÉÌ¹•Ð¡Á½¥¹Ñ•É%¥ññ¹Õ±±ô¤ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÈµÍÑ…”µØäµ¹…Ñ¥Ù”µ½½É‘¥¹…Ñ”µ…Á¤¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XäƒŠP9Q%Y€ÄÀàÃ\ÄäÈÀ==I%9QA$((€€9•Ü™•…ÑÕÉ•Ì5UMPÕÍ”Ñ¡•Í”¡•±Á•ÉÌ¥¹ÍÑ•…½˜‰É½ÝÍ•È(€€Ù¥•ÝÁ½ÉÐ½½É‘¥¹…Ñ•Ì¸((€€á¥ÍÑ¥¹œ…µ”±½¥Œ¥Ì¥¹Ñ•¹Ñ¥½¹…±±äÕ¹Ñ½Õ¡•¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±9…Ñ¥Ù•…µ•½½É‘¥¹…Ñ•A$ ¥ì(€€€½¹ÍÐ5}\€ô€ÄÀàÀì(€€€½¹ÍÐ5} €ô€ÄäÈÀì((€€€™Õ¹Ñ¥½¸•ÑMÑ…” ¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ=Ù•É±…ä ¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÉ••¹Q½…µ”¡±¥•¹Ñ`°±¥•¹Ñd¥ì(€€€€€€€½¹ÍÐÍÑ…”€ô•ÑMÑ…” ¤ì(€€€€€€€¥˜ …ÍÑ…”¥ì(€€€€€€€€€€€É•ÑÕÉ¸íàè±¥•¹Ñ`°äè±¥•¹Ñeôì(€€€€€€€ô((€€€€€€€½¹ÍÐÉ•Ð€ôÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(€€€€€€€½¹ÍÐÍ…±”€ôÝ¥¹‘½Ü¹…µ•MÑ…•M…±”ñð€Äì((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€àè€¡±¥•¹Ñ`€´É•Ð¹±•™Ð¤€¼Í…±”°(€€€€€€€€€€€äè€¡±¥•¹Ñd€´É•Ð¹Ñ½À¤€¼Í…±”(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸…µ•Q½MÉ••¸¡à°ä¥ì(€€€€€€€½¹ÍÐÍÑ…”€ô•ÑMÑ…” ¤ì(€€€€€€€¥˜ …ÍÑ…”¥ì(€€€€€€€€€€€É•ÑÕÉ¸íà°åôì(€€€€€€€ô((€€€€€€€½¹ÍÐÉ•Ð€ôÍÑ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€àèÉ•Ð¹±•™Ð€¬à€¨€¡É•Ð¹Ý¥‘Ñ €¼5}\¤°(€€€€€€€€€€€äèÉ•Ð¹Ñ½À€¬ä€¨€¡É•Ð¹¡•¥¡Ð€¼5} ¤(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸•Ù•¹ÑQ½…µ”¡•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐÁ½¥¹Ð€ô•Ù•¹Ð¹Ñ½Õ¡•Ì€˜˜•Ù•¹Ð¹Ñ½Õ¡•Ì¹±•¹Ñ (€€€€€€€€€€€€ü•Ù•¹Ð¹Ñ½Õ¡•ÍlÁt(€€€€€€€€€€€€è•Ù•¹Ð¹¡…¹•‘Q½Õ¡•Ì€˜˜•Ù•¹Ð¹¡…¹•‘Q½Õ¡•Ì¹±•¹Ñ (€€€€€€€€€€€€€€€€ü•Ù•¹Ð¹¡…¹•‘Q½Õ¡•ÍlÁt(€€€€€€€€€€€€€€€€è•Ù•¹Ðì((€€€€€€€É•ÑÕÉ¸ÍÉ••¹Q½…µ”¡Á½¥¹Ð¹±¥•¹Ñ`°Á½¥¹Ð¹±¥•¹Ñd¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•…Ñ•9…Ñ¥Ù•±•µ•¹Ð¡±…ÍÍ9…µ”¥ì(€€€€€€€½¹ÍÐ½Ù•É±…ä€ô•Ñ=Ù•É±…ä ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô((€€€€€€€½¹ÍÐ•°€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€•°¹±…ÍÍ9…µ”€ô€‰…µ”µ¹…Ñ¥Ù”µ•±•µ•¹Ð€ˆ€¬€¡±…ÍÍ9…µ”ñð€ˆˆ¤ì(€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡•°¤ì(€€€€€€€É•ÑÕÉ¸•°ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•Ñ9…Ñ¥Ù•I•Ð¡•°°à°ä°Ý¥‘Ñ °¡•¥¡Ð¥ì(€€€€€€€¥˜ …•°¤É•ÑÕÉ¸ì((€€€€€€€•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸€ô€‰…‰Í½±ÕÑ”ˆì(€€€€€€€•°¹ÍÑå±”¹±•™Ð€ôà€¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹Ñ½À€ôä€¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹Ý¥‘Ñ €ôÝ¥‘Ñ €¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹¡•¥¡Ð€ô¡•¥¡Ð€¬€‰Áàˆì(€€€ô((€€€™Õ¹Ñ¥½¸Í•Ñ9…Ñ¥Ù•A½Í¥Ñ¥½¸¡•°°à°ä¥ì(€€€€€€€¥˜ …•°¤É•ÑÕÉ¸ì((€€€€€€€•°¹ÍÑå±”¹Á½Í¥Ñ¥½¸€ô€‰…‰Í½±ÕÑ”ˆì(€€€€€€€•°¹ÍÑå±”¹±•™Ð€ôà€¬€‰Áàˆì(€€€€€€€•°¹ÍÑå±”¹Ñ½À€ôä€¬€‰Áàˆì(€€€ô((€€€Ý¥¹‘½Ü¹5}9Q%Y}]%Q €ô5}\ì(€€€Ý¥¹‘½Ü¹5}9Q%Y}!%!P€ô5} ì((€€€Ý¥¹‘½Ü¹ÍÉ••¹Q½…µ”€ôÍÉ••¹Q½…µ”ì(€€€Ý¥¹‘½Ü¹…µ•Q½MÉ••¸€ô…µ•Q½MÉ••¸ì(€€€Ý¥¹‘½Ü¹•Ù•¹ÑQ½…µ”€ô•Ù•¹ÑQ½…µ”ì(€€€Ý¥¹‘½Ü¹É•…Ñ•9…Ñ¥Ù•…µ•±•µ•¹Ð€ôÉ•…Ñ•9…Ñ¥Ù•±•µ•¹Ðì(€€€Ý¥¹‘½Ü¹Í•Ñ9…Ñ¥Ù•…µ•I•Ð€ôÍ•Ñ9…Ñ¥Ù•I•Ðì(€€€Ý¥¹‘½Ü¹Í•Ñ9…Ñ¥Ù•…µ•A½Í¥Ñ¥½¸€ôÍ•Ñ9…Ñ¥Ù•A½Í¥Ñ¥½¸ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÌµÍÑ…”µØÄÀµ‰…ÑÑ±”µ±½œµÍÉ½±°µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€™Õ¹Ñ¥½¸™¥¹‘MÉ½±±…‰±•	…ÑÑ±•A…¹•°¡Ñ…É•Ð¥ì(€€€€€€€¥˜ …Ñ…É•Ðñð€…Ñ…É•Ð¹±½Í•ÍÐ¤É•ÑÕÉ¸¹Õ±°ì((€€€€€€€É•ÑÕÉ¸Ñ…É•Ð¹±½Í•ÍÐ (€€€€€€€€€€€€m‘…Ñ„µ‰…ÑÑ±”µ±½œµÍÉ½±±t°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œµÍÉ½±±…‰±”°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œ°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ¥¹™¼°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ¥¹™¼µ‰½à°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œµ‰½à°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µ±½œµ½¹Ñ…¥¹•È°œ€¬(€€€€€€€€€€€€œ¹½µ‰…Ðµ±½œ°œ€¬(€€€€€€€€€€€€œ¹½µ‰…Ðµ±½œµ‰½à°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µÑ•áÐ°œ€¬(€€€€€€€€€€€€œ¹‰…ÑÑ±”µµ•ÍÍ…”µ±¥ÍÐœ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹MÉ½±±Y•ÉÑ¥…±±ä¡•°¥ì(€€€€€€€¥˜ …•°¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍÐÍÑå±”€ôÝ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡•°¤ì(€€€€€€€½¹ÍÐ½Ù•É™±½Ýd€ôÍÑå±”¹½Ù•É™±½Ýdì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€¡½Ù•É™±½Ýd€ôôô€‰…ÕÑ¼ˆñð½Ù•É™±½Ýd€ôôô€‰ÍÉ½±°ˆ¤€˜˜(€€€€€€€€€€€•°¹ÍÉ½±±!•¥¡Ð€ø•°¹±¥•¹Ñ!•¥¡Ð€¬€Ä(€€€€€€€€¤ì(€€€ô((€€€€¼¨(€€€€€¨5…É¬Ñ¡”…ÑÕ…°ÍÉ½±±…‰±”‰…ÑÑ±”±½œÍ¼Ñ¡”•á¥ÍÑ¥¹œ±½‰…°(€€€€€¨Ñ½Õ ±½¬…¸É•½¹¥é”¥Ð¸(€€€€€¨¼(€€€™Õ¹Ñ¥½¸µ…É­	…ÑÑ±•MÉ½±±•ÉÌ ¥ì(€€€€€€€½¹ÍÐÍ•±•Ñ½ÉÌ€ôl(€€€€€€€€€€€€m±…ÍÌ¨ô‰‰…ÑÑ±”‰um±…ÍÌ¨ô‰±½œ‰tœ°(€€€€€€€€€€€€m±…ÍÌ¨ô‰‰…ÑÑ±”‰um±…ÍÌ¨ô‰¥¹™¼‰tœ°(€€€€€€€€€€€€m±…ÍÌ¨ô‰½µ‰…Ð‰um±…ÍÌ¨ô‰±½œ‰tœ°(€€€€€€€€€€€€m¥¨ô‰‰…ÑÑ±”‰um¥¨ô‰±½œ‰tœ°(€€€€€€€€€€€€m¥¨ô‰‰…ÑÑ±”‰um¥¨ô‰¥¹™¼‰tœ°(€€€€€€€€€€€€m¥¨ô‰½µ‰…Ð‰um¥¨ô‰±½œ‰tœ(€€€€€€€tì((€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±°¡Í•±•Ñ½ÉÌ¹©½¥¸ ˆ°ˆ¤¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ‰…ÑÑ±”µ±½œµÍÉ½±°ˆ°€‰ÑÉÕ”ˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Ñ½Õ¡Ñ¥½¸€ô€‰Á…¸µäˆì(€€€€€€€ô¤ì(€€€ô((€€€€¼¨(€€€€€¨…ÁÑÕÉ”µÁ¡…Í”±¥ÍÑ•¹•ÈÉÕ¹Ì‰•™½É”Ñ¡”½±±½‰…°Ñ½Õ ±½¬¸(€€€€€¨½ÈÑ¡”…ÑÕ…°‰…ÑÑ±”±½œ°…±±½ÜÑ¡”‰É½ÝÍ•ÈÌÙ•ÉÑ¥…°ÍÉ½±°¸(€€€€€¨½È•Ù•ÉåÑ¡¥¹œ•±Í”°Ñ¡”•á¥ÍÑ¥¹œ…µ”µÝ¥‘”±½¬É•µ…¥¹ÌÕ¹¡…¹•¸(€€€€€¨¼(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ñ½Õ¡µ½Ù”ˆ°™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐÍÉ½±±•È€ô™¥¹‘MÉ½±±…‰±•	…ÑÑ±•A…¹•°¡•Ù•¹Ð¹Ñ…É•Ð¤ì((€€€€€€€¥˜¡ÍÉ½±±•È€˜˜…¹MÉ½±±Y•ÉÑ¥…±±ä¡ÍÉ½±±•È¤¥ì(€€€€€€€€€€€•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€ô°í…ÁÑÕÉ”éÑÉÕ”°Á…ÍÍ¥Ù”é™…±Í•ô¤ì((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•Éµ½Ù”ˆ°™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€¥˜¡•Ù•¹Ð¹Á½¥¹Ñ•ÉQåÁ”€„ôô€‰Ñ½Õ ˆ¤É•ÑÕÉ¸ì((€€€€€€€½¹ÍÐÍÉ½±±•È€ô™¥¹‘MÉ½±±…‰±•	…ÑÑ±•A…¹•°¡•Ù•¹Ð¹Ñ…É•Ð¤ì((€€€€€€€¥˜¡ÍÉ½±±•È€˜˜…¹MÉ½±±Y•ÉÑ¥…±±ä¡ÍÉ½±±•È¤¥ì(€€€€€€€€€€€•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€ô°í…ÁÑÕÉ”éÑÉÕ”°Á…ÍÍ¥Ù”é™…±Í•ô¤ì((€€€µ…É­	…ÑÑ±•MÉ½±±•ÉÌ ¤ì((€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•Í¥é”ˆ°µ…É­	…ÑÑ±•MÉ½±±•ÉÌ°íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÐµÍÑ…”µØÄÄµ¹…Ñ¥Ù”µ‰½ÑÑ½´µ¹…ØµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€€¼¼=¹”¹…Ñ¥Ù”Í¡•±°ì…µ•Á±…äµ…äÉ•Á±…”¥Ñ•µÌ‰ÕÐ…¹¹½ÐÁ½Í¥Ñ¥½¸…¹½Ñ¡•È¹…Ø¸(€€€½¹ÍÐ=9QaQ}9Y}%Q5Lõ=‰©•Ð¹™É••é”¡l(€€€€€€€=‰©•Ð¹™É••é”¡l‹¢žK¢&Èˆ°‰…ÍÍ•ÑÌ½Õ¤½¹…Øµ¡…É…Ñ•È¹Á¹œˆ°‰½Á•¹!½µ••…ÑÕÉ” ¡…É…Ñ•Èœ¤‰t¤°(€€€€€€€=‰©•Ð¹™É••é”¡l‹¢3–2ˆ°‰…ÍÍ•ÑÌ½Õ¤½¹…Øµ‰…­Á…¬¹Á¹œˆ°‰ØÄÐá=Á•¹½¹Ñ•áÑ%¹Ù•¹Ñ½Éä ¤‰t¤°(€€€€€€€=‰©•Ð¹™É••é”¡l‹žžc–¾Øˆ°‰…ÍÍ•ÑÌ½Õ¤½¹…ØµÉ•±¥ŒµØÄÜÔ¹Ý•‰Àˆ°‰ØÄÐá=Á•¹½¹Ñ•áÑI•±¥Œ ¤‰t¤°(€€€€€€€=‰©•Ð¹™É••é”¡l‹–žÒƒ–2Œˆ°‰…ÍÍ•ÑÌ½Õ¤½¹…Øµ•±•µ•¹Ðµ‰½à¹Á¹œˆ°‰½Á•¹!½µ••…ÑÕÉ” …ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ìœ¤‰t¤(€€€t¤ì(€€€±•Ðµ…¥¹	ÕÑÑ½¹Ìõ¹Õ±°ì(€€€±•ÐÍ¡•±°õ¹Õ±°ì(€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•M¡•±° ¥ì(€€€€€€€½¹ÍÐ¹…Øõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰½ÑÑ½µ9…Øˆ¤ì(€€€€€€€½¹ÍÐ½Ù•É±…äõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …¹…Ùñð…½Ù•É±…ä¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€¥˜ …µ…¥¹	ÕÑÑ½¹Ì¥ì(€€€€€€€€€€€µ…¥¹	ÕÑÑ½¹ÌõÉÉ…ä¹™É½´¡¹…Ø¹¡¥±‘É•¸¤ì(€€€€€€€€€€€µ…¥¹	ÕÑÑ½¹Ì¹™½É… ¡‰ÕÑÑ½¸ôùì(€€€€€€€€€€€€€€€½¹ÍÐ¥µ…”õ‰ÕÑÑ½¸¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¹…Øµ…ÉÐµ‰ÕÑÑ½¸ˆ¤ì(€€€€€€€€€€€€€€€¥˜¡¥µ…”˜˜…¥µ…”¹Á…É•¹Ñ±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¹…Øµ¥½¸µ™É…µ”ˆ¤¥ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ™É…µ”õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€€€€€€€€€€€€€™É…µ”¹±…ÍÍ9…µ”ô‰¹…Øµ¥½¸µ™É…µ”ˆì(€€€€€€€€€€€€€€€€€€€¥µ…”¹É•Á±…•]¥Ñ ¡™É…µ”¤ì(€€€€€€€€€€€€€€€€€€€™É…µ”¹…ÁÁ•¹‘¡¥±¡¥µ…”¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€€€¥˜ …Í¡•±°¥ì(€€€€€€€€€€€Í¡•±°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€€€€€Í¡•±°¹±…ÍÍ9…µ”ô‰¹…Ñ¥Ù”µ‰½ÑÑ½´µ¹…Øµ±…å•Èˆì(€€€€€€€€€€€Í¡•±°¹…ÁÁ•¹‘¡¥±¡¹…Ø¤ì(€€€€€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡Í¡•±°¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸¹…Øì(€€€ô(€€€™Õ¹Ñ¥½¸É•¹‘•É5…¥¸¡Á…”¥ì(€€€€€€€½¹ÍÐ¹…Øõ•¹ÍÕÉ•M¡•±° ¤ì(€€€€€€€¥˜ …¹…Ø¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡¹…Ø¹‘…Ñ…Í•Ð¹¹…ÙM¥¹…ÑÕÉ”„ôô‰µ…¥¸ˆ¥ì(€€€€€€€€€€€¹…Ø¹É•Á±…•¡¥±‘É•¸ ¸¸¹µ…¥¹	ÕÑÑ½¹Ì¤ì(€€€€€€€ô(€€€€€€€¹…Ø¹‘…Ñ…Í•Ð¹¹…ÙM¥¹…ÑÕÉ”ô‰µ…¥¸ˆì(€€€€€€€¹…Ø¹‘…Ñ…Í•Ð¹¹…Ù½¹Ñ•áÐô‰µ…¥¸ˆì(€€€€€€€½¹ÍÐÍ•±•Ñ•õí¡½µ”è‰¡½µ•9…Øˆ±ÑÉ…¥¹¥¹œè‰ÑÉ…¥¹¥¹9…Øˆ±¥¹Ù•¹Ñ½Éäè‰¥¹Ù•¹Ñ½Éå9…Øˆ°(€€€€€€€€€€€‘Õ¹•½¸è‰‘Õ¹•½¹9…Øˆ±…µ•Á±…äè‰‰½ÍÍ9…Øˆ±‰½ÍÌè‰‰½ÍÍ9…Øˆ±Ñ½Ý•Èè‰‰½ÍÍ9…Ø‰õmÁ…•uñð‰¡½µ•9…Øˆì(€€€€€€€µ…¥¹	ÕÑÑ½¹Ì¹™½É… ¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰…Ñ¥Ù”ˆ±‰ÕÑÑ½¸¹¥ôôõÍ•±•Ñ•¤¤ì(€€€€€€€Í¡•±°¹¡¥‘‘•¸õ™…±Í”ì(€€€ô(€€€™Õ¹Ñ¥½¸É•¹‘•É½¹Ñ•áÐ¡‰ÕÑÑ½¹Ì±½¹Ñ•áÐ¥ì(€€€€€€€½¹ÍÐ¹…Øõ•¹ÍÕÉ•M¡•±° ¤ì(€€€€€€€¥˜ …¹…Ø¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐ­•äõ½¹Ñ•áÐ¬ˆèˆ­‰ÕÑÑ½¹Ì¹µ…À¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹©½¥¸ ‰ðˆ¤¤¹©½¥¸ ˆìˆ¤ì(€€€€€€€¥˜¡¹…Ø¹‘…Ñ…Í•Ð¹¹…ÙM¥¹…ÑÕÉ”„ôõ­•ä¥ì(€€€€€€€€€€€¹…Ø¹É•Á±…•¡¥±‘É•¸ ¸¸¹‰ÕÑÑ½¹Ì¹µ…À ¡m±…‰•°±ÍÉŒ±…Ñ¥½¹t¤ôùì(€€€€€€€€€€€€€€€½¹ÍÐ‰ÕÑÑ½¸õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‰ÕÑÑ½¸ˆ¤ì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹ÑåÁ”ô‰‰ÕÑÑ½¸ˆì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹±…ÍÍ9…µ”ô‰¹…Øµ‰ÕÑÑ½¸¹…Øµ…ÉÐµ‰ÕÑÑ½¸µÝÉ…Àˆì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±±…‰•°¤ì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰½¹±¥¬ˆ±…Ñ¥½¸¤ì(€€€€€€€€€€€€€€€½¹ÍÐ¥µœõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰¥µœˆ¤ì(€€€€€€€€€€€€€€€¥µœ¹±…ÍÍ9…µ”ô‰¹…Øµ…ÉÐµ‰ÕÑÑ½¸ˆì(€€€€€€€€€€€€€€€¥µœ¹ÍÉŒõÍÉŒì(€€€€€€€€€€€€€€€¥µœ¹…±Ðôˆˆì(€€€€€€€€€€€€€€€½¹ÍÐ…ÍÍ¥ÍÑ¥Ù”õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€€€€€€€€€…ÍÍ¥ÍÑ¥Ù”¹±…ÍÍ9…µ”ô‰¹…ØµÍÈµ½¹±äˆì(€€€€€€€€€€€€€€€…ÍÍ¥ÍÑ¥Ù”¹Ñ•áÑ½¹Ñ•¹Ðõ±…‰•°ì(€€€€€€€€€€€€€€€½¹ÍÐ™É…µ”õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€€€€€€€€€™É…µ”¹±…ÍÍ9…µ”ô‰¹…Øµ¥½¸µ™É…µ”ˆì(€€€€€€€€€€€€€€€™É…µ”¹…ÁÁ•¹‘¡¥±¡¥µœ¤ì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹…ÁÁ•¹¡™É…µ”±…ÍÍ¥ÍÑ¥Ù”¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰ÕÑÑ½¸ì(€€€€€€€€€€€ô¤¤ì(€€€€€€€€€€€¹…Ø¹‘…Ñ…Í•Ð¹¹…ÙM¥¹…ÑÕÉ”õ­•äì(€€€€€€€ô(€€€€€€€¹…Ø¹‘…Ñ…Í•Ð¹¹…Ù½¹Ñ•áÐõ½¹Ñ•áÐì(€€€€€€€Í¡•±°¹¡¥‘‘•¸õ™…±Í”ì(€€€ô(€€€™Õ¹Ñ¥½¸…Ñ¥Ù•…µ•Á±…åA…•% ¥ì(€€€€€€€™½È¡½¹ÍÐ¥½˜l‰…µ•Á±…åA…”ˆ°‰‰½ÍÍA…”ˆ°‰Ñ½Ý•ÉA…”‰t¥ì(€€€€€€€€€€€½¹ÍÐÁ…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å%¡¥¤ì(€€€€€€€€€€€¥˜¡Á…”ü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤¥ìÉ•ÑÕÉ¸¥ìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€ô(€€€™Õ¹Ñ¥½¸É•¹‘•É…µ•Á±…å½¹Ñ•áÐ¡É•ÑÕÉ¹Ñ¥½¸±½¹Ñ•áÐ¥ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¹Ìõ=9QaQ}9Y}%Q5L¹µ…À¡¥Ñ•´ôù¥Ñ•´¹Í±¥” ¤¤ì(€€€€€€€‰ÕÑÑ½¹Ì¹ÁÕÍ ¡l‹¢þS–nxˆ°‰…ÍÍ•ÑÌ½Õ¤½µ…ÀµÉ•ÑÕÉ¸¹Á¹œˆ±É•ÑÕÉ¹Ñ¥½¹t¤ì(€€€€€€€É•¹‘•É½¹Ñ•áÐ¡‰ÕÑÑ½¹Ì±½¹Ñ•áÐ¤ì(€€€ô(€€€€¼¨½¹Ñ•áÐÍ•±•Ñ¥½¸¥Ì‘•±¥‰•É…Ñ•±ä…ÁÀµÍ¡•±°É•ÍÁ½¹Í¥‰¥±¥Ñä¸€%ÐµÕÍÐ‰”(€€€€€€½ÉÉ•Ð‰•™½É”±…éä…µ•Á±…ä‰Õ¹‘±•Ì•á¥ÍÐ°Í¼„½±ÑÉ…¥¹¥¹œ•¹ÑÉä…¸(€€€€€€¹•Ù•È•áÁ½Í”Ñ¡”µ…¥¸¹…Ù¥…Ñ¥½¸™¥ÉÍÐ…¹É•Á±…”¥Ð±…Ñ•È¸€¨¼(€€€™Õ¹Ñ¥½¸Íå¹½¹Ñ•áÐ ¥ì(€€€€€€€½¹ÍÐ…ÁÀõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…ÁÀˆ¤ì(€€€€€€€½¹ÍÐ‘Õ¹•½¹A…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‘Õ¹•½¹A…”ˆ¤ì(€€€€€€€½¹ÍÐÑÉ…¥¹¥¹A…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ÑÉ…¥¹¥¹A…”ˆ¤ì(€€€€€€€½¹ÍÐ…µ•Á±…åA…•%õ…Ñ¥Ù•…µ•Á±…åA…•% ¤ì(€€€€€€€½¹ÍÐ‘Õ¹•½¹Ñ¥Ù”ô„…‘Õ¹•½¹A…”ü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤ì(€€€€€€€½¹ÍÐÑÉ…¥¹¥¹Ñ¥Ù”ô„…ÑÉ…¥¹¥¹A…”ü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤ì(€€€€€€€½¹ÍÐ…µ•Á±…åÑ¥Ù”ô„……µ•Á±…åA…•%ì(€€€€€€€½¹ÍÐµ…ÁÑ¥Ù”ô„…‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…”ˆ¤ü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰…Ñ¥Ù”ˆ¤ì(€€€€€€€½¹ÍÐ½¹Ñ•áÑÑ¥Ù”õµ…ÁÑ¥Ù•ññ‘Õ¹•½¹Ñ¥Ù•ññ…µ•Á±…åÑ¥Ù•ññÑÉ…¥¹¥¹Ñ¥Ù”ì(€€€€€€€…ÁÀü¹±…ÍÍ1¥ÍÐü¹Ñ½±” ‰ØÄÐàµ½¹Ñ•áÐµ¹…Øµ…Ñ¥Ù”ˆ±½¹Ñ•áÑÑ¥Ù”¤ì((€€€€€€€¥˜¡…ÁÀü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰¥¹Ù•¹Ñ½Éäµ½Ù•É±…äµ½Á•¸ˆ¥ñð(€€€€€€€€€€…ÁÀü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰½¸µ¥¹Ù•¹Ñ½ÉäµÁ…”ˆ¥ñð(€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¥Ñ•µ5½‘…°ˆ¤ü¹‘…Ñ…Í•Ð¹ÁÉ•Í•¹Ñ…Ñ¥½¹5½‘”¥ì(€€€€€€€€€€€¡¥‘” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰¡¥‘‘•¸µ¥¹Ù•¹Ñ½Éäˆì(€€€€€€€ô(€€€€€€€¥˜ …½¹Ñ•áÑÑ¥Ù”¥ì(€€€€€€€€€€€¥˜¡…ÁÀü¹±…ÍÍ1¥ÍÐü¹½¹Ñ…¥¹Ì ‰¥¸µ‰…ÑÑ±”ˆ¤¥ì(€€€€€€€€€€€€€€€¡¥‘” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€‰¡¥‘‘•¸µ‰…ÑÑ±”ˆì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐµ…¥¹A…”õ‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ð€¹Á…”¹…Ñ¥Ù”ˆ¤ì(€€€€€€€€€€€É•¹‘•É5…¥¸¡µ…¥¹A…”ü¹¥¹É•Á±…” ½A…”¼°ˆˆ¥ñð‰¡½µ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰µ…¥¸ˆì(€€€€€€€ô((€€€€€€€½¹ÍÐ…‰åÍÍ5…ÁÑ¥Ù”ô„„¡‘Õ¹•½¹Ñ¥Ù”˜™‘Õ¹•½¹A…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄÐÄµ…‰åÍÌµÍ¡•±°ˆ¤¤ì(€€€€€€€½¹ÍÐ…‰åÍÍM•±•Ñ¥½¹Ñ¥Ù”ô„„¡‘Õ¹•½¹Ñ¥Ù”˜™‘Õ¹•½¹A…”¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ¹ØÄÜÐµ…‰åÍÌµÍ•±•Ñ¥½¸°¹ØÄÜÐµ…‰åÍÌµ½µÁ±•Ñ”°¹ØÄÐÄµ…‰åÍÌµ¥¹ÑÉ¼ˆ(€€€€€€€€¤¤ì(€€€€€€€½¹ÍÐÉ•ÑÕÉ¹Ñ¥½¸õµ…ÁÑ¥Ù”(€€€€€€€€€€€€ü‰±•…Ù•5…À ¤ˆ(€€€€€€€€€€€€éÑÉ…¥¹¥¹Ñ¥Ù”(€€€€€€€€€€€€ü‰Í¡½ÝA…” ¡½µ”œ¤ˆ(€€€€€€€€€€€€è¡…µ•Á±…åÑ¥Ù”˜˜…‘Õ¹•½¹Ñ¥Ù”(€€€€€€€€€€€€ü‰ØÄÐáI•ÑÕÉ¹É½µ…µ•Á±…ä ¤ˆ(€€€€€€€€€€€€è¡…‰åÍÍ5…ÁÑ¥Ù”(€€€€€€€€€€€€ü¡ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÑ‰åÍÍ	…­Q½M•±•Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆü‰ØÄÜÑ‰åÍÍ	…­Q½M•±•Ñ¥½¸ ¤ˆè‰ØÄÐÙá¥Ñ‰åÍÍ5…À ¤ˆ¤(€€€€€€€€€€€€è¡…‰åÍÍM•±•Ñ¥½¹Ñ¥Ù”ü‰ØÄÜÑ‰åÍÍ1•…Ù•Q½…µ•Á±…ä ¤ˆè‰Í¡½ÝA…” ¡½µ”œ¤ˆ¤¤¤ì(€€€€€€€½¹ÍÐ½¹Ñ•áÐõÑÉ…¥¹¥¹Ñ¥Ù”(€€€€€€€€€€€€ü‰ÑÉ…¥¹¥¹œˆ(€€€€€€€€€€€€è¡µ…ÁÑ¥Ù”ü‰Á…ÑÉ½°ˆè¡…µ•Á±…åÑ¥Ù”˜˜…‘Õ¹•½¹Ñ¥Ù”(€€€€€€€€€€€€ü‰…µ•Á±…äèˆ­…µ•Á±…åA…•%(€€€€€€€€€€€€è¡…‰åÍÍ5…ÁÑ¥Ù”ü‰…‰åÍÌµµ…Àˆè¡…‰åÍÍM•±•Ñ¥½¹Ñ¥Ù”ü‰…‰åÍÌµÍ•±•Ñ¥½¸ˆè‰‘…¥±äˆ¤¤¤¤ì(€€€€€€€É•¹‘•É…µ•Á±…å½¹Ñ•áÐ¡É•ÑÕÉ¹Ñ¥½¸±½¹Ñ•áÐ¤ì(€€€€€€€É•ÑÕÉ¸½¹Ñ•áÐì(€€€ô(€€€™Õ¹Ñ¥½¸¡¥‘” ¥ì¥˜¡•¹ÍÕÉ•M¡•±° ¤¥ìÍ¡•±°¹¡¥‘‘•¸õÑÉÕ”ìôô(€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í	½ÑÑ½µ9…Øõ=‰©•Ð¹™É••é”¡íÉ•¹‘•É5…¥¸±É•¹‘•É½¹Ñ•áÐ±Íå¹½¹Ñ•áÐ±¡¥‘”±•¹ÍÕÉ•M¡•±±ô¤ì(€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ° ¤ôùÉ•¹‘•É5…¥¸ ‰¡½µ”ˆ¤±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ìÉ•¹‘•É5…¥¸ ‰¡½µ”ˆ¤ìô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀØµÍÑ…”µØÌäµ‰…ÑÑ±”µµ…Àµ‰…­É½Õ¹µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÌàˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÌäˆì((€€€€¼¨(€€€€€¨XÌäµ…Àµ‰…­É½Õ¹‰É¥‘”¸(€€€€€¨(€€€€€¨AÉ¥½É¥Ñäè(€€€€€¨€€Ä¤á¥ÍÑ¥¹œÕÉÉ•¹ÐÁ…ÑÉ½°½µ…À‰…­É½Õ¹•±•µ•¹ÐÌ½µÁÕÑ•½ÕÉÉ•¹Ð(€€€€€¨€€€€‰…­É½Õ¹¥µ…”¸(€€€€€¨€€È¤á¥ÍÑ¥¹œµ…À‘…Ñ„½‰…­É½Õ¹Ù…É¥…‰±•Ì¥˜•áÁ½Í•‰äÑ¡”…µ”¸(€€€€€¨(€€€€€¨]”‘¼¹½ÐÉ•Á±…”Ñ¡”…µ”Ìµ…ÀÍÑ…Ñ”½È‰…ÑÑ±”ÍÑ…Ñ”¸(€€€€€¨¼((€€€™Õ¹Ñ¥½¸•Ñ	…ÑÑ±•A…” ¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑA…ÑÉ½±5…Á	…­É½Õ¹ ¥ì(€€€€€€€½¹ÍÐ…¹‘¥‘…Ñ•Ì€ôl(€€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰Á…ÑÉ½±A…”ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…”ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ÑÉ…¥¹¥¹A…”ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰µ…Á	…­É½Õ¹ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ð€¹µ…Àµ‰…­É½Õ¹ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ð€¹Á…ÑÉ½°µ‰…­É½Õ¹ˆ¤°(€€€€€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È ˆ…µ”µ½¹Ñ•¹Ð€¹ÑÉ…¥¹¥¹œµ‰…­É½Õ¹ˆ¤(€€€€€€€t¹™¥±Ñ•È¡	½½±•…¸¤ì((€€€€€€€™½È¡½¹ÍÐ•°½˜…¹‘¥‘…Ñ•Ì¥ì(€€€€€€€€€€€½¹ÍÐÌ€ô•Ñ½µÁÕÑ•‘MÑå±”¡•°¤ì(€€€€€€€€€€€½¹ÍÐ‰œ€ôÌ¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€¥˜¡‰œ€˜˜‰œ€„ôô€‰¹½¹”ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰œì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐ¥¹±¥¹”€ô•°¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€¥˜¡¥¹±¥¹”¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸¥¹±¥¹”ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ ¥ì(€€€€€€€½¹ÍÐ‰…ÑÑ±”€ô•Ñ	…ÑÑ±•A…” ¤ì(€€€€€€€¥˜ …‰…ÑÑ±”¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍÐ‰œ€ô•ÑA…ÑÉ½±5…Á	…­É½Õ¹ ¤ì(€€€€€€€¥˜ …‰œ¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µ¥µ…”ˆ°‰œ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÍ¥é”ˆ°€‰½Ù•Èˆ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÁ½Í¥Ñ¥½¸ˆ°€‰•¹Ñ•Èˆ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÉ•Á•…Ðˆ°€‰¹¼µÉ•Á•…Ðˆ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€€¼¨(€€€€€¨	…ÑÑ±”µ…ä‰”É•¹‘•É•…™Ñ•Èµ…À¹…Ù¥…Ñ¥½¸¸=‰Í•ÉÙ”½¹±äÑ¡”(€€€€€¨…µ”µ½¹Ñ•¹ÐÍÕ‰ÑÉ•”™½È‰…ÑÑ±•A…”½µ…ÀµÁ…”¡…¹•Ì…¹É•…ÁÁ±ä(€€€€€¨Ñ¡”ÕÉÉ•¹Ðµ…À¥µ…”¸Q¡¥Ì‘½•Ì¹½Ð…±Ñ•È‰…ÑÑ±”µ•¡…¹¥Ì¸(€€€€€¨¼(€€€™Õ¹Ñ¥½¸¥¹¥Ð ¥ì(€€€€€€€…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ ¤ì((€€€€€€€½¹ÍÐÉ½½Ð€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½¹Ñ•¹Ðˆ¤ñð(€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€¥˜ …É½½Ð¤É•ÑÕÉ¸ì((€€€€€€€½¹ÍÐ½‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€¥˜¡‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤¥ì(€€€€€€€€€€€€€€€…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡É½½Ð°í¡¥±‘1¥ÍÐéÑÉÕ”°ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì((€€€€€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•Í¥é”ˆ°…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹¤ì(€€€ô((€€€Ý¥¹‘½Ü¹Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À€ô…ÁÁ±åÕÉÉ•¹Ñ5…Á	…­É½Õ¹ì((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°¥¹¥Ð°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹¥Ð ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀÜµÍÑ…”µØÐÀµÉ½½Ðµ‰…ÑÑ±”µ‰…­É½Õ¹µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÌäˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐÀˆì((€€€½¹ÍÐ1e}]%Q €ô€ÐÈÀì(€€€½¹ÍÐ9Q%Y}]%Q €ô€ÄÀàÀì(€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•	…ÑÑ±•	…­É½Õ¹‘1…å•È ¥ì(€€€€€€€½¹ÍÐ‰…ÑÑ±”€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€€€€€¥˜ …‰…ÑÑ±”¤É•ÑÕÉ¸¹Õ±°ì((€€€€€€€±•Ð±…å•È€ô‰…ÑÑ±”¹ÅÕ•ÉåM•±•Ñ½È ˆéÍ½Á”€ø€¹‰…ÑÑ±”µ‰œµÍ¡…É•ˆ¤ì(€€€€€€€¥˜ …±…å•È¥ì(€€€€€€€€€€€±…å•È€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€€€€€±…å•È¹±…ÍÍ9…µ”€ô€‰‰…ÑÑ±”µ‰œµÍ¡…É•ˆì(€€€€€€€€€€€±…å•È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€€€€€‰…ÑÑ±”¹¥¹Í•ÉÑ	•™½É”¡±…å•È°‰…ÑÑ±”¹™¥ÉÍÑ¡¥±¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸±…å•Èì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑÑÕ…±A…ÑÉ½±	…­É½Õ¹ ¥ì(€€€€€€€€¼¨(€€€€€€€€€¨M=UI=QIUQ è(€€€€€€€€€¨•¹Ñ•É5…À ¤…±±Ì…ÁÁ±å5…Ái½¹•	…­É½Õ¹¡ÕÉÉ•¹Ñi½¹”¤°(€€€€€€€€€¨Ý¡¥ ÝÉ¥Ñ•ÌÑ¡”ÕÉÉ•¹Ðµ…À¥µ…”Ñ¼€µ…ÁA…•	1…å•È¸(€€€€€€€€€¨(€€€€€€€€€¨]”É•…Ñ¡…Ð•á…ÐÉ•¹‘•É•±…å•ÈÉ…Ñ¡•ÈÑ¡…¸Õ•ÍÍ¥¹œ(€€€€€€€€€¨™É½´€µ…ÁA…”¥ÑÍ•±˜¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍÐµ…Á1…å•È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…•	1…å•Èˆ¤ì(€€€€€€€¥˜¡µ…Á1…å•È¥ì(€€€€€€€€€€€½¹ÍÐ‰œ€ô•Ñ½µÁÕÑ•‘MÑå±”¡µ…Á1…å•È¤¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€¥˜¡‰œ€˜˜‰œ€„ôô€‰¹½¹”ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰œì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜¡µ…Á1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸µ…Á1…å•È¹ÍÑå±”¹‰…­É½Õ¹‘%µ…”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€¨…±±‰…¬½¹±ä¥˜Ñ¡”µ…À±…å•È¥Ì¹½Ð…Ù…¥±…‰±”è(€€€€€€€€€¨ÕÍ”Ñ¡”…µ”Ì…ÑÕ…°µ…Àµé½¹”Ñ…‰±”…¹ÕÉÉ•¹Ñi½¹”¸(€€€€€€€€€¨¼(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì€„ôô€‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€½¹ÍÐÕÉ°€ôµ…Ái½¹•	…­É½Õ¹‘%µ…•ÍmÕÉÉ•¹Ñi½¹•tñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì¹™½É•ÍÐì(€€€€€€€€€€€€€€€¥˜¡ÕÉ°¥ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€‰ÕÉ° ˆ€¬ÕÉ°€¬€ˆ¤ˆì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡”¥íô((€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À ¥ì(€€€€€€€½¹ÍÐ±…å•È€ô•¹ÍÕÉ•	…ÑÑ±•	…­É½Õ¹‘1…å•È ¤ì(€€€€€€€¥˜ …±…å•È¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍÐ‰œ€ô•ÑÑÕ…±A…ÑÉ½±	…­É½Õ¹ ¤ì(€€€€€€€¥˜ …‰œ¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µ¥µ…”ˆ°€‰±¥¹•…ÈµÉ…‘¥•¹Ð¡É‰„ À°À°À°¸ÔÈ¤°É‰„ À°À°À°¸ÔÈ¤¤°€ˆ€¬‰œ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÍ¥é”ˆ°€‰½Ù•Èˆ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÁ½Í¥Ñ¥½¸ˆ°€‰•¹Ñ•ÈÑ½Àˆ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€±…å•È¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰…­É½Õ¹µÉ•Á•…Ðˆ°€‰¹¼µÉ•Á•…Ðˆ°€‰¥µÁ½ÉÑ…¹Ðˆ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹¥Ð ¥ì(€€€€€€€•¹ÍÕÉ•	…ÑÑ±•	…­É½Õ¹‘1…å•È ¤ì(€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À ¤ì((€€€€€€€€¼¨(€€€€€€€€€¨]¡•¸ÕÉÉ•¹Ñi½¹”½µ…À‰…­É½Õ¹¡…¹•Ì°€µ…ÁA…•	1…å•È¥Ì(€€€€€€€€€¨ÕÁ‘…Ñ•‰ä…ÁÁ±å5…Ái½¹•	…­É½Õ¹ ¤¸5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È½¸Ñ¡”(€€€€€€€€€¨ÍÑå±”…ÑÑÉ¥‰ÕÑ”Õ…É…¹Ñ••Ì‰…ÑÑ±”É••¥Ù•ÌÑ¡”Í…µ”¥µ…”¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍÐµ…Á1…å•È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰µ…ÁA…•	1…å•Èˆ¤ì(€€€€€€€¥˜¡µ…Á1…å•È¥ì(€€€€€€€€€€€½¹ÍÐµ…Á=‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È (€€€€€€€€€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€µ…Á=‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡µ…Á1…å•È±í…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰ÍÑå±”‰uô¤ì(€€€€€€€ô((€€€€€€€€¼¨(€€€€€€€€€¨±Í¼É•Íå¹ŒÝ¡•¸Ñ¡”‰…ÑÑ±”Á…”¥ÌÉ•¹‘•É•½…Ñ¥Ù…Ñ•¸(€€€€€€€€€¨¼(€€€€€€€½¹ÍÐ½¹Ñ•¹Ð€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½¹Ñ•¹Ðˆ¤ì(€€€€€€€¥˜¡½¹Ñ•¹Ð¥ì(€€€€€€€€€€€½¹ÍÐÁ…•=‰Í•ÉÙ•È€ô¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€¥˜¡‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤¥ì(€€€€€€€€€€€€€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€Á…•=‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡½¹Ñ•¹Ð±í¡¥±‘1¥ÍÐéÑÉÕ”±ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì(€€€€€€€ô((€€€€€€€Ý¥¹‘½Ü¹Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…À€ô(€€€€€€€€€€€Íå¹	…ÑÑ±•	…­É½Õ¹‘Q½ÕÉÉ•¹Ñ5…Àì(€€€ô((€€€Ý¥¹‘½Ü¹•ÑXÐÁ	…ÑÑ±•Y¥ÍÕ…±¥…¹½ÍÑ¥Ì€ô™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍÐ±…å•È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€ˆ…µ”µÍÑ…”€ø€…ÁÀ€ø€…µ”µ½¹Ñ•¹Ð€‰…ÑÑ±•A…”€ø€¹‰…ÑÑ±”µ‰œµÍ¡…É•ˆ(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ÕÉÉ•¹Ñi½¹”è(€€€€€€€€€€€€€€€€¡ÑåÁ•½˜ÕÉÉ•¹Ñi½¹”€„ôô€‰Õ¹‘•™¥¹•ˆ€üÕÉÉ•¹Ñi½¹”€è¹Õ±°¤°(€€€€€€€€€€€‰…ÑÑ±•	…­É½Õ¹è(€€€€€€€€€€€€€€€±…å•È€ü•Ñ½µÁÕÑ•‘MÑå±”¡±…å•È¤¹‰…­É½Õ¹‘%µ…”€è¹Õ±°(€€€€€€€ôì(€€€ôì((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±¥¹¥Ð±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹¥Ð ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀàµÍÑ…”µØÐÄµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐÀˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐÄˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÀäµÍÑ…”µØÐÔµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐÄˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐÔˆì(€€€Ý¥¹‘½Ü¹5}	QQ1}	-I=U9}Q%9P€ô€‰É‰„ À°À°À°¸Ìà¤ˆì(€€€Ý¥¹‘½Ü¹5}MQ}M-%11}	}=9Q}M%i€ô€ˆÄÀÙÁàˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÀµÍÑ…”µØÐØµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐÔˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐØˆì(€€€Ý¥¹‘½Ü¹5}	QQ1}	-I=U9}Q%9P€ô€‰É‰„ À°À°À°¸ÔÈ¤ˆì(€€€Ý¥¹‘½Ü¹5}MQ}M-%11}	}=9Q}M%i€ô€ˆÄÌÉÁàˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÄµÍÑ…”µØÐÜµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐØˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐÜˆì(€€€Ý¥¹‘½Ü¹5}MQ}M-%11}	}M=UI}=9Q}M%i€ô€ˆÄÔÁÁàˆì(€€€Ý¥¹‘½Ü¹5}MQ}M-%11}	}M=UI}]%Q €ô€ˆäÀÁÁàˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÈµÍÑ…”µØÐàµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐÜˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐàˆì(€€€Ý¥¹‘½Ü¹5}MQ}M-%11}	}=9Q}M%i€ô€ˆÜÉÁàˆì(€€€Ý¥¹‘½Ü¹5}MQ}M-%11}	}MQI=-€ô€‰¹½¹”ˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÌµÍÑ…”µØÐäµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐàˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÐäˆì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÐµÍÑ…”µØÔÀµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÐäˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÔÀˆì((€€€™Õ¹Ñ¥½¸™¥á	…ÑÑ±•	…­É½Õ¹‘‘” ¥ì(€€€€€€€½¹ÍÐÍÑ…”€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€½¹ÍÐ‰…ÑÑ±”€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€€€€€½¹ÍÐ‰œ€ô‰…ÑÑ±”€˜˜‰…ÑÑ±”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹‰…ÑÑ±”µ‰œµÍ¡…É•ˆ¤ì(€€€€€€€¥˜ …ÍÑ…”ñð€…‰…ÑÑ±”ñð€…‰œ¤É•ÑÕÉ¸ì((€€€€€€€€¼¨UÍ”Ñ¡”…ÑÕ…°‰…ÑÑ±”Ù¥•ÝÁ½ÉÐ‘¥µ•¹Í¥½¹Ì°¹•Ù•È1•…ä€ÐÈÁÁà¸€¨¼(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±•™Ðˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ½Àˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ý¥‘Ñ ˆ°ˆÄÀÀ”ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰¡•¥¡Ðˆ°ˆÄÀÀ”ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰É¥¡Ðˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½ÑÑ½´ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½É‘•Èˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰½ÕÑ±¥¹”ˆ°ˆÀˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€‰œ¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½àµÍ¡…‘½Üˆ°‰¹½¹”ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì((€€€€€€€‰…ÑÑ±”¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰½Ù•É™±½Üˆ°‰¡¥‘‘•¸ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€ô((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°™¥á	…ÑÑ±•	…­É½Õ¹‘‘”°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€™¥á	…ÑÑ±•	…­É½Õ¹‘‘” ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÔµÍÑ…”µØÔÄµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÔÀˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XäÌˆì((€€€€¼¨(€€€€€I•ÍÑ½É”Ý¡¥Ñ”½ÕÑ±¥¹”½¹±ä½¸½µ‰…ÐÉ•ÍÕ±Ð¹½‘•Ì¸(€€€€€¼¹½ÐÑ½Õ Í­¥±°µ¹…µ”µ‰…‘”¸(€€€€¨¼(€€€½¹ÍÐ½µ‰…ÑI•ÍÕ±ÑM•±•Ñ½È€ôl(€€€€€€€€ˆ¹‰…ÑÑ±”µ‘…µ…”ˆ°(€€€€€€€€ˆ¹‰…ÑÑ±”µ‘…µ…”µ¹Õµ‰•Èˆ°(€€€€€€€€ˆ¹‘…µ…”µ¹Õµ‰•Èˆ°(€€€€€€€€ˆ¹‘…µ…”µÑ•áÐˆ°(€€€€€€€€ˆ¹½µ‰…Ðµ‘…µ…”ˆ°(€€€€€€€€ˆ¹½µ‰…ÐµÉ•ÍÕ±Ðˆ°(€€€€€€€€ˆ¹½µ‰…ÐµÉ•ÍÕ±ÐµÑ•áÐˆ°(€€€€€€€€ˆ¹‰…ÑÑ±”µµ¥ÍÌˆ°(€€€€€€€€ˆ¹µ¥ÍÌµÑ•áÐˆ°(€€€€€€€€ˆ¹‰…ÑÑ±”µ¡•…°ˆ°(€€€€€€€€ˆ¹¡•…°µ¹Õµ‰•Èˆ°(€€€€€€€€ˆ¹¡Àµ¡…¹”ˆ°(€€€€€€€€ˆ¹¡Àµ¡…¹”µ¹Õµ‰•Èˆ(€€€t¹©½¥¸ ˆ°ˆ¤ì((€€€™Õ¹Ñ¥½¸…ÁÁ±å½µ‰…ÑI•ÍÕ±ÑMÑÉ½­”¡É½½Ð¥ì(€€€€€€€½¹ÍÐ‰…Í”€ôÉ½½Ð€˜˜É½½Ð¹ÅÕ•ÉåM•±•Ñ½É±°€üÉ½½Ð€è‘½Õµ•¹Ðì(€€€€€€€‰…Í”¹ÅÕ•ÉåM•±•Ñ½É±°¡½µ‰…ÑI•ÍÕ±ÑM•±•Ñ½È¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ˆµÝ•‰­¥ÐµÑ•áÐµÍÑÉ½­”ˆ°ˆÍÁà€™™™™™˜ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ•áÐµÍÑÉ½­”ˆ°ˆÍÁà€™™™™™˜ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹¥Ð ¥ì(€€€€€€€…ÁÁ±å½µ‰…ÑI•ÍÕ±ÑMÑÉ½­”¡‘½Õµ•¹Ð¤ì((€€€€€€€½¹ÍÐÍÑ…”€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€¥˜¡ÍÑ…”¥ì(€€€€€€€€€€€¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€…ÁÁ±å½µ‰…ÑI•ÍÕ±ÑMÑÉ½­”¡ÍÑ…”¤ì(€€€€€€€€€€€ô¤¹½‰Í•ÉÙ”¡ÍÑ…”°í¡¥±‘1¥ÍÐéÑÉÕ”°ÍÕ‰ÑÉ•”éÑÉÕ•ô¤ì(€€€€€€€ô(€€€ô((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ°¥¹¥Ð°í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€¥¹¥Ð ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì½É•±¥ŒµÍÕµµ…Éäµ…Ñ…±½œ¹©Ì€¨¼(¼¨¥ÉÍÐµÍÉ••¸µÍ…™”Q•…´I•±¥ŒÍÕµµ…Éä…Ñ…±½œ¸(€€=Ý¹Ì½¹±äÑ¡”ÍÑ…Ñ¥Œ™¥•±‘ÌÉ•ÅÕ¥É•‰äÑ¡”µ…¥¸µ¥ÑäÍÕµµ…Éä…¹Ñ¡”™Õ±°É•±¥Œ…Ñ…±½œ¸€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±I•±¥MÕµµ…Éå…Ñ…±½œ¡±½‰…°¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€¥˜ …±½‰…±ññ±½‰…°¹½ÕÉMåµ‰½±ÍI•±¥MÕµµ…Éå…Ñ…±½œ¥ìÉ•ÑÕÉ¸ìô(€€€½¹ÍÐ•¹ÑÉ¥•Ìõl(€€€€€€€l‰É•±¥}Å¥…¹­Õ¹}™±…Í¬ˆ°‹’æû–v“ž:'–Žèˆ°‹––šVã–n{–B#žÖCšvšf‰t°(€€€€€€€l‰É•±¥}ÍÕ¹}½Éˆˆ°‹ž#¦f÷ž–{ž>€ˆ°‹–ÛšVã–n{–B#¦Z/–ž/šf‰t°(€€€€€€€l‰É•±¥}áÕ…¹ÝÕ}Í•…°ˆ°‹ž:š¶›¦v#–6Àˆ°‹š¾?ž²°Ï–n{–B#¦Z/–ž/šf‰t°(€€€€€€€l‰É•±¥}Í½Õ±}‰•±°ˆ°‹¦:»¦¶–>“¦B`ˆ°‹š¾?ž²°Ó–n{–B#¦Z/–ž/šf‰t°(€€€€€€€l‰É•±¥}Ñ¥…¹…¹}‰…¹¹•Èˆ°‹–’§žö‡š"Ãš^\ˆ°‹š"GšZçžÒ¿ž¦7–>_–"ÀÛš²‡šV×šZçšr'šV#šRïšN+–ú0‰t°(€€€€€€€l‰É•±¥}¹¥¹•}‘É…½¹}™¥É”ˆ°‹’æw¦ú7ž–{ž¯žö¤ˆ°‹šV×šZçžÒ¿ž¦7–º3š"@ßš²‡šr'šV#¢†3–.W–ú0‰t°(€€€€€€€l‰É•±¥}½±‘}ÍÁÉ¥¹}©…‘”ˆ°‹–¾KšÎ'ž:'ž>¸ˆ°‹’îï’âš"GšZç¢žK¢&É!CžRÄÌÔ—’î—’â+¦f7¢ÌÌÔ—’î—’â/šf‰t°(€€€€€€€l‰É•±¥}Å¥¹±…¹}™•…Ñ¡•Èˆ°‹¦vK–ÖCžú÷ž²˜ˆ°‹š"Ã¦²—¦Z/–ž/šf‰t°(€€€€€€€l‰É•±¥}É½­}µ½Õ¹Ñ…¥¹}Í•…°ˆ°‹–Ê§–ÊÏ¦:»–6Àˆ°‹¦Z/–‚Ó¾òo–>›šZóš"GšZçžÒ¿ž¦7–>\ãš²‡šr'šV#šRïšN+šf‰t°(€€€€€€€l‰É•±¥}É•ÑÕÉ¹¥¹}Ý¡••°ˆ°‹–n{–’§–¾Û¢ò¨ˆ°‹šr³–‚Óž²³’âš²‡šr'š"GšZç¢žK¢&Ë–Â–>_–"Ã¢Ó–F÷–
ß–ºÏšf‰t°(€€€€€€€l‰É•±¥}½É¥¥¹}Ñ…±¥Íµ…¸ˆ°‹–’«–"w¢[ž²˜ˆ°‹š¾?ž²°Ó–n{–B#žÖCšv|‰t°(€€€€€€€l‰É•±¥}‰É½­•¹}…Éµå}ÍÉ½±°ˆ°‹ž‚Ó¢î7šºc–6Üˆ°‹¢žK¢&ËšRïšN+¾ò?š*¢÷šN+šV_šV×’êë–ú0‰t°(€€€€€€€l‰É•±¥}É•‘}Í­å}Ý…É}µ…É¬ˆ°‹¢Ö“¦rš"ÃžÒ,ˆ°‹š"Ã¦²—¦Z/–ž/šf‰t°(€€€€€€€l‰É•±¥}¥•}µ¥ÉÉ½É}¡•…ÉÐˆ°‹ž:–Ã¦>‡–þˆ°‹š¾?ž²°Ï–n{–B#žÖCšv|‰t°(€€€€€€€l‰É•±¥}Ý¥¹‘}¡…Í¥¹}Ñ…±¥Íµ…¸ˆ°‹¢þ÷¦Š£¢†3ž²˜ˆ°‹š¾?ž²°Ï–n{–B#¦Z/–ž,‰t°(€€€€€€€l‰É•±¥}µ½Õ¹Ñ…¥¹}É¥Ù•É}…Õ±‘É½¸ˆ°‹–ÆÇšÊÏ–¾Û¦ò8ˆ°‹š"GšZçžÒ¿ž¦7–>\ßš²‡šr'šV#šRïšN+–ú0‰t°(€€€€€€€l‰É•±¥}‰ÕÉ¹¥¹}ÍÑ…É}µ…É¬ˆ°‹žkšbšºc–6Àˆ°‹–ÛšVã–n{–B#žÖCšv|‰t°(€€€€€€€l‰É•±¥}ÍÁ¥É¥Ñ}ÍÁÉ¥¹}‰½ÑÑ±”ˆ°‹¦v#šÎ'šÎWžNØˆ°‹š¾?ž²°Ï–n{–B#žÖCšv|‰t°(€€€€€€€l‰É•±¥}‘•µ½¹}ÍÕÁÁÉ•ÍÍ¥¹}Í•…°ˆ°‹’ò?¦¶S¦G–6Àˆ°‹š"Ã¦²—¦Z/–ž/¾òo¦š[š²‡š"C–*–>_–"Ã’â¢"³¢Êƒ¦v‹ž.š,‰t°(€€€€€€€l‰É•±¥}…±±}É•ÑÕÉ¹¥¹}…ÉÉ…äˆ°‹¢B³¢Æ‡š¶ã–žnˆ°‹š¾?ž²°Ó–n{–B#¦Z/–ž,‰t(€€€tì(€€€±½‰…°¹½ÕÉMåµ‰½±ÍI•±¥MÕµµ…Éå…Ñ…±½œõ=‰©•Ð¹™É••é”¡=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡•¹ÑÉ¥•Ì¹µ…À¡•¹ÑÉäôùl(€€€€€€€•¹ÑÉålÁt°(€€€€€€€=‰©•Ð¹™É••é”¡í¥é•¹ÑÉålÁt±¹…µ”é•¹ÑÉålÅt±ÑÉ¥•ÉQ•áÐé•¹ÑÉålÉuô¤(€€€t¤¤¤ì)ô¤¡ÑåÁ•½˜Ý¥¹‘½Ü„ôô‰Õ¹‘•™¥¹•ˆýÝ¥¹‘½Üé±½‰…±Q¡¥Ì¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄØµÍÑ…”µØÔÐµµ…¥¸µ¥ÑäµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9€ô€‰XÔÄˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8€ô€‰XÔÐˆì(€€€Ý¥¹‘½Ü¹5}9Q%Y}1MQ}M=A€ô€‰µ…¥¸µ¥Ñäµµ½‘•É…Ñ”µÍ…±”ˆì((€€€½¹ÍÐ}I}5=}1MLô‰…µ™É•”µÍ•ÉÙ¥”µ¥¹™¼µµ½‘”ˆì(€€€½¹ÍÐ}I}=9%}-dô‰M%a%9}}I}MIY%}=9%ˆì(€€€½¹ÍÐ}I}%MA1e}A=1%dõ=‰©•Ð¹™É••é”¡íµ½‘”è‰µ…¹Õ…°‰ô¤ì(€€€½¹ÍÐU1Q}}I}=9%õ=‰©•Ð¹™É••é”¡ì(€€€€€€€ÍÕÁÁ½ÉÑµ…¥°èˆˆ°(€€€€€€€É•™Õ¹‘A½±¥åUÉ°èˆˆ°(€€€€€€€Ñ•ÉµÍUÉ°èˆˆ°(€€€€€€€ÁÉ¥Ù…åA½±¥åUÉ°èˆˆ°(€€€€€€€ÁÕÉ¡…Í•UÉ°èˆˆ°(€€€€€€€ÁÕÉ¡…Í•¹…‰±•é™…±Í”(€€€ô¤ì((€€€™Õ¹Ñ¥½¸…ÁÁ±ä ¥ì(€€€€€€€½¹ÍÐ¡½µ”€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•A…”ˆ¤ì(€€€€€€€¥˜ …¡½µ”¤É•ÑÕÉ¸ì(€€€€€€€¡½µ”¹±…ÍÍ1¥ÍÐ¹…‘ ‰µ…¥¸µ¥Ñäµ±½‰‰äµÉ•…‘äˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•‘É••½¹™¥œ ¥ì(€€€€€€€½¹ÍÐ™½Éµ…±MÕÁÁ½ÉÑµ…¥°õMÑÉ¥¹œ¡Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÕÁÁ½ÉÐ˜™Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍMÕÁÁ½ÉÐ¹•µ…¥±ñðˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ•á¥ÍÑ¥¹œõÝ¥¹‘½Ým}I}=9%}-et˜™ÑåÁ•½˜Ý¥¹‘½Ým}I}=9%}-etôôô‰½‰©•Ðˆ(€€€€€€€€€€€€üÝ¥¹‘½Ým}I}=9%}-et(€€€€€€€€€€€€èíôì(€€€€€€€½¹ÍÐ½¹™¥œõ=‰©•Ð¹…ÍÍ¥¸¡íô±U1Q}}I}=9%±•á¥ÍÑ¥¹œ¤ì(€€€€€€€¥˜¡™½Éµ…±MÕÁÁ½ÉÑµ…¥°¥ì½¹™¥œ¹ÍÕÁÁ½ÉÑµ…¥°õ™½Éµ…±MÕÁÁ½ÉÑµ…¥°ìô(€€€€€€€Ý¥¹‘½Ým}I}=9%}-etõ½¹™¥œì(€€€€€€€É•ÑÕÉ¸½¹™¥œì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ5½‘…±A…ÉÑÌ ¥ì(€€€€€€€½¹ÍÐµ½‘…°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€€€€€¥˜ …µ½‘…°¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍÐ‰½àõµ½‘…°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡½µ”µ™•…ÑÕÉ”µµ½‘…°µ‰½àˆ¤ì(€€€€€€€½¹ÍÐÑ¥Ñ±”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘äõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(€€€€€€€¥˜ …‰½áñð…Ñ¥Ñ±•ñð…‰½‘ä¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸íµ½‘…°±‰½à±Ñ¥Ñ±”±‰½‘åôì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í½±Ù•½¹™¥ÕÉ•‘UÉ°¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐÉ…ÜõMÑÉ¥¹œ¡Ù…±Õ•ñðˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜ …É…Ü¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÕÉ°õ¹•ÜUI0¡É…Ü±Ý¥¹‘½Ü¹±½…Ñ¥½¸¹¡É•˜¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÕÉ°¹ÁÉ½Ñ½½°ôôô‰¡ÑÑÁÌè‰ññÕÉ°¹ÁÉ½Ñ½½°ôôô‰¡ÑÑÀèˆ€üÕÉ°¹¡É•˜€è€ˆˆì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸¡‰ÕÑÑ½¹%±½¹™¥ÕÉ•‘UÉ°±Ñ½‘½1…‰•°¥ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¸õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å%¡‰ÕÑÑ½¹%¤ì(€€€€€€€¥˜ …‰ÕÑÑ½¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐÕÉ°õÉ•Í½±Ù•½¹™¥ÕÉ•‘UÉ°¡½¹™¥ÕÉ•‘UÉ°¤ì(€€€€€€€¥˜ …ÕÉ°¥ì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€€€€€€€‰ÕÑÑ½¸¹Ñ¥Ñ±”ô‰Q=?¾òk–úš:—š¶–ò<ˆ­Ñ½‘½1…‰•°¬‹¦‚¦vˆˆì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€‰ÕÑÑ½¸¹Ñ¥Ñ±”ôˆˆì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹½Á•¸¡ÕÉ°°‰}‰±…¹¬ˆ°‰¹½½Á•¹•È±¹½É•™•ÉÉ•Èˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É‘É••M•ÉÙ¥•	½‘ä¡‰½‘ä¥ì(€€€€€€€½¹ÍÐ½¹™¥œõ•¹ÍÕÉ•‘É••½¹™¥œ ¤ì(€€€€€€€½¹ÍÐ½¹™¥ÕÉ•‘µ…¥°õMÑÉ¥¹œ¡½¹™¥œ¹ÍÕÁÁ½ÉÑµ…¥±ñðˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€‰½‘ä¹¥¹¹•É!Q50õl(€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁ…¹•°ˆ‘…Ñ„µ…µ™É•”µÍ•ÉÙ¥”µ¥¹™¼ô‰ÑÉÕ”ˆøœ°(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ¡•É¼ˆøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÍÕ‰Ñ¥Ñ±”ˆøÌÀƒ–’§–7–î–F+šr7–.dð½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁÉ¥”ˆ…É¥„µ±…‰•°ô‹–çš‚ð9Pääˆù9Pääð½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ‰…‘”ˆû–Z»š²‡¢Îó¢ÊßŽï¦v{¢«–.Wžê3¢¢ð½‘¥Øøœ°(€€€€€€€€€€€€€€€€œð½‘¥Øøœ°(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ½Áäˆøœ°(€€€€€€€€€€€€€€€€€€€€œñÀû’âš²‡’îcš²û¾ò3š>C’úl€ÌÀƒ–’§–7–î–F+š²+žn+Žð½Àøœ°(€€€€€€€€€€€€€€€€€€€€œñÀûšr³šr7–.gž
ë–Z»š²‡¢Îó¢Êß¾ò3’â7šr¢«–.Wžê3¢¢Žð½Àøœ°(€€€€€€€€€€€€€€€€€€€€œñÀû¢Îó¢Êßš"C–*–ú3¾ò3–7–î–F+š²+žn+–ÂžÚ–ºkž:§–ºÛ–âÏ¢f¾ò3¢«’îcš²ûš"C–*¢ÖßžRšV €ÌÀƒ–’§Žð½Àøœ°(€€€€€€€€€€€€€€€€€€€€œñÀûš¶“šr7–.g’â7š>C’úo¦†7–’[¢žK¢&ËŽ¢Žw–
gŽ¢÷–*oŽ¦+š"Ë–æš"[–Û’î[š"Ã–*o–*ƒš"CŽð½Àøœ°(€€€€€€€€€€€€€€€€œð½‘¥Øøœ°(€€€€€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÍÕÁÁ½ÉÐˆ…É¥„µ±…‰•°ô‹–º‹šr7¢"šŠwš²øˆøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÍÕÁÁ½ÉÐµÉ½Üˆøœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸û–º‹šr4µ…¥³¾òhð½ÍÁ…¸øœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñˆ¥ô‰…‘É••MÕÁÁ½ÉÑµ…¥°ˆøœ­½¹™¥ÕÉ•‘µ…¥°¬œð½ˆøœ°(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁ½±¥äµ…Ñ¥½¹Ìˆøœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••I•™Õ¹‘A½±¥å	ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš~—žr/¦š²û¢š?–&ð½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••Q•ÉµÍ	ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš~—žr/šr7–.gšŠwš²øð½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••AÉ¥Ù…å	ÕÑÑ½¸ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš~—žr/¦jÇžžš²+šRÿž¶Xð½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ°(€€€€€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÑ½‘¼µ¹½Ñ”ˆû¦š²û¢š?–&Žšr7–.gšŠwš²û¢"¦jÇžžš²+šRÿž¶[¦‚¦v‹–Âk–ú¢¢·–ºk¾òošr«¢¢·–ºk–&7’â7šr–Â;–BG’â7–¶c–r£žjžÚË–vŽð½Àøœ°(€€€€€€€€€€€€€€€€œð½Í•Ñ¥½¸øœ°(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ…Ñ¥½¹Ìˆøœ°(€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••AÕÉ¡…Í•	ÕÑÑ½¸ˆ±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µÁÕÉ¡…Í”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•…É¥„µ±…‰•°ô‹¢Îó¢ÊÜ€ÌÀƒ–’§–7–î–F(9Päç¾ò3žn»–&7’îcš²ûšr7–.gšê[–
g’â´ˆû’îcš²ûšr7–.gšê[–
g’â´ð½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰…‘É••­¹½Ý±•‘•	ÕÑÑ½¸ˆ±…ÍÌô‰…µ™É•”µÍ•ÉÙ¥”µ…­¹½Ý±•‘”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆûš"Gž~—¦O’êð½‰ÕÑÑ½¸øœ°(€€€€€€€€€€€€€€€€œð½‘¥Øøœ°(€€€€€€€€€€€€œð½Í•Ñ¥½¸øœ(€€€€€€€t¹©½¥¸ ˆˆ¤ì((€€€€€€€½¹ÍÐÍÕÁÁ½ÉÑµ…¥°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…‘É••MÕÁÁ½ÉÑµ…¥°ˆ¤ì(€€€€€€€¥˜¡ÍÕÁÁ½ÉÑµ…¥°¥ì(€€€€€€€€€€€ÍÕÁÁ½ÉÑµ…¥°¹Ñ•áÑ½¹Ñ•¹Ðõ½¹™¥ÕÉ•‘µ…¥°ì(€€€€€€€€€€€ÍÕÁÁ½ÉÑµ…¥°¹‘…Ñ…Í•Ð¹Ñ½‘¼ô‰™…±Í”ˆì(€€€€€€€ô((€€€€€€€½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸ ‰…‘É••I•™Õ¹‘A½±¥å	ÕÑÑ½¸ˆ±½¹™¥œ¹É•™Õ¹‘A½±¥åUÉ°°‹¦š²û¢š?–&ˆ¤ì(€€€€€€€½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸ ‰…‘É••Q•ÉµÍ	ÕÑÑ½¸ˆ±½¹™¥œ¹Ñ•ÉµÍUÉ°°‹šr7–.gšŠwš²øˆ¤ì(€€€€€€€½¹™¥ÕÉ•A½±¥å	ÕÑÑ½¸ ‰…‘É••AÉ¥Ù…å	ÕÑÑ½¸ˆ±½¹™¥œ¹ÁÉ¥Ù…åA½±¥åUÉ°°‹¦jÇžžš²+šRÿž¶Xˆ¤ì((€€€€€€€½¹ÍÐÁÕÉ¡…Í•	ÕÑÑ½¸õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…‘É••AÕÉ¡…Í•	ÕÑÑ½¸ˆ¤ì(€€€€€€€½¹ÍÐÁÕÉ¡…Í•UÉ°õÉ•Í½±Ù•½¹™¥ÕÉ•‘UÉ°¡½¹™¥œ¹ÁÕÉ¡…Í•UÉ°¤ì(€€€€€€€¥˜¡ÁÕÉ¡…Í•	ÕÑÑ½¸˜™½¹™¥œ¹ÁÕÉ¡…Í•¹…‰±•ôôõÑÉÕ”˜™ÁÕÉ¡…Í•UÉ°¥ì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ðô‹¢Îó¢ÊÜ€ÌÀƒ–’§–7–î–F(9Pääˆì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹¢Îó¢ÊÜ€ÌÀƒ–’§–7–î–F(9Pääˆ¤ì(€€€€€€€€€€€ÁÕÉ¡…Í•	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹½Á•¸¡ÁÕÉ¡…Í•UÉ°°‰}‰±…¹¬ˆ°‰¹½½Á•¹•È±¹½É•™•ÉÉ•Èˆ¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ…­¹½Ý±•‘•	ÕÑÑ½¸õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…‘É••­¹½Ý±•‘•	ÕÑÑ½¸ˆ¤ì(€€€€€€€¥˜¡…­¹½Ý±•‘•	ÕÑÑ½¸¥ì(€€€€€€€€€€€…­¹½Ý±•‘•	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…°¤ì(€€€€€€€ô((€€€€€€€€¼¼Q=<¡A…ä¤èƒ–†¯–—š¶–ò?¦š²û¢š?–&Žšr7–.gšŠwš²ûŽ¦jÇžžš²+šRÿž¶[žÚË–vŽ(€€€€€€€€¼¼Q=<¡A…ä¤èƒ–º3š"CžÚƒžV3’îcš²û¢"’îcš²ûžÖCšzs¦¦_¢¶'–ú3¾ò3š&7–>¿¢¢·–ºhÁÕÉ¡…Í•¹…‰±•õÑÉÕ”ƒ¢"ÁÕÉ¡…Í•UÉ³Ž(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹‘É••M•ÉÙ¥•%¹™½5½‘…° ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•Ñ5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ …Á…ÉÑÌ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤˜˜…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì¡}I}5=}1ML¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€Á…ÉÑÌ¹Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ðô‹Ž+–no¢Æ‡šÆšæ[–
ÏŽ,ˆì(€€€€€€€É•¹‘•É‘É••M•ÉÙ¥•	½‘ä¡Á…ÉÑÌ¹‰½‘ä¤ì(€€€€€€€Á…ÉÑÌ¹‰½‘ä¹ÍÉ½±±Q½ÀôÀì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘¡}I}5=}1ML¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰É½±”ˆ°‰‘¥…±½œˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µµ½‘…°ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•±±•‘‰äˆ°‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…° ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•Ñ5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ …Á…ÉÑÍñð…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì¡}I}5=}1ML¤¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹±½Í•!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹±½Í•!½µ••…ÑÕÉ” ¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€€€€€ô(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù”¡}I}5=}1ML¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰É½±”ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µµ½‘…°ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•±±•‘‰äˆ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€Ý¥¹‘½Ü¹}I}MIY%}%MA1e}A=1%dõ}I}%MA1e}A=1%dì(€€€Ý¥¹‘½Ü¹½Á•¹‘É••M•ÉÙ¥•%¹™½5½‘…°õ½Á•¹‘É••M•ÉÙ¥•%¹™½5½‘…°ì(€€€Ý¥¹‘½Ü¹±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…°õ±½Í•‘É••M•ÉÙ¥•%¹™½5½‘…°ì(((€€€™Õ¹Ñ¥½¸É½ÍÑ•É9Õµ‰•È¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐ¹Õµ‰•Èõ9Õµ‰•È¡Ù…±Õ”¤ì(€€€€€€€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹Õµ‰•È¤ý¹Õµ‰•ÈèÀì(€€€ô(€€€™Õ¹Ñ¥½¸É½ÍÑ•ÉÍ…Á”¡Ù…±Õ”¥ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ôõ¹Õ±°üˆˆéÙ…±Õ”¤(€€€€€€€€€€€€¹É•Á±…” ¼˜½œ°ˆ™…µÀìˆ¤¹É•Á±…” ¼ð½œ°ˆ™±Ðìˆ¤¹É•Á±…” ¼ø½œ°ˆ™Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ½pˆ½œ°ˆ™ÅÕ½Ðìˆ¤¹É•Á±…” ¼œ½œ°ˆ˜ŒÀÌäìˆ¤ì(€€€ô(€€€™Õ¹Ñ¥½¸É½ÍÑ•ÉI•Í½ÕÉ•Q•áÐ¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐÝ¡½±”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡Ù…±Õ”¤¤¤ì(€€€€€€€¥˜¡Ý¡½±”øôÄÀÀÀÀÀÀÀÀ¥ì(€€€€€€€€€€€½¹ÍÐ½µÁ…ÐõÝ¡½±”¼ÄÀÀÀÀÀÀÀÀì(€€€€€€€€€€€É•ÑÕÉ¸½µÁ…Ð¹Ñ½¥á•¡½µÁ…ÐøôÄÀüÄèÈ¤¹É•Á±…” ½p¸üÀ¬½œ°ˆˆ¤¬‹–ˆì(€€€€€€€ô(€€€€€€€¥˜¡Ý¡½±”øôÄÀÀÀÀ¥ìÉ•ÑÕÉ¸5…Ñ ¹™±½½È¡Ý¡½±”¼ÄÀÀÀÀ¤¬‹¢B°ˆìô(€€€€€€€É•ÑÕÉ¸Ý¡½±”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(€€€ô(€€€™Õ¹Ñ¥½¸Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡¹½‘”±Ù…±Õ”¥ì(€€€€€€€¥˜ …¹½‘”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐÝ¡½±”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡Ù…±Õ”¤¤¤ì(€€€€€€€½¹ÍÐ™Õ±°õÝ¡½±”¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤ì(€€€€€€€¹½‘”¹Ñ•áÑ½¹Ñ•¹ÐõÉ½ÍÑ•ÉI•Í½ÕÉ•Q•áÐ¡Ý¡½±”¤ì(€€€€€€€¹½‘”¹Ñ¥Ñ±”õ™Õ±°ì¹½‘”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±™Õ±°¤ì(€€€ô(€€€½¹ÍÐ!=5}I1%}MU55Ie}Q1=õÝ¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±¥MÕµµ…Éå…Ñ…±½ññ=‰©•Ð¹™É••é”¡íô¤ì(€€€±•Ð™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”õ¹Õ±°ì(€€€™Õ¹Ñ¥½¸¹•áÑA…¥¹Ð ¥ìÉ•ÑÕÉ¸¹•ÜAÉ½µ¥Í”¡É•Í½±Ù”ôùÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤ôùÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”¡É•Í½±Ù”¤¤¤ìô(€€€™Õ¹Ñ¥½¸ÕÉ±ÍÉ½µMÑå±”¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐÕÉ±Ìõmtì(€€€€€€€MÑÉ¥¹œ¡Ù…±Õ•ñðˆˆ¤¹É•Á±…” ½ÕÉ±p  üèˆ¡mx‰t¬¤‰ðœ¡mxt¬¤ð¡myp¥t¬¤¥p¤½œ°¡}…±°±‘½Õ‰±•EÕ½Ñ•±Í¥¹±•EÕ½Ñ•±Á±…¥¸¤ôùí½¹ÍÐÕÉ°ô¡‘½Õ‰±•EÕ½Ñ•‘ññÍ¥¹±•EÕ½Ñ•‘ññÁ±…¥¹ñðˆˆ¤¹ÑÉ¥´ ¤í¥˜¡ÕÉ°˜™ÕÉ°„ôô‰¹½¹”ˆ¥íÕÉ±Ì¹ÁÕÍ ¡ÕÉ°¤íõÉ•ÑÕÉ¸}…±°íô¤ì(€€€€€€€É•ÑÕÉ¸ÕÉ±Ìì(€€€ô(€€€™Õ¹Ñ¥½¸‘•½‘•%µ…•UÉ°¡ÕÉ°¥ì(€€€€€€€É•ÑÕÉ¸¹•ÜAÉ½µ¥Í” ¡É•Í½±Ù”±É•©•Ð¤ôùí½¹ÍÐ¥µ…”õ¹•Ü%µ…” ¤í¥µ…”¹‘•½‘¥¹œô‰…Íå¹Œˆí¥µ…”¹½¹±½…ô ¤ôùÑåÁ•½˜¥µ…”¹‘•½‘”ôôô‰™Õ¹Ñ¥½¸ˆý¥µ…”¹‘•½‘” ¤¹Ñ¡•¸¡É•Í½±Ù”±É•©•Ð¤éÉ•Í½±Ù” ¤í¥µ…”¹½¹•ÉÉ½Èô ¤ôùÉ•©•Ð¡¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?–r[ž&ž‡šÎW¢ò'–—¾òhˆ­ÕÉ°¤¤í¥µ…”¹ÍÉŒõÕÉ°íô¤ì(€€€ô(€€€™Õ¹Ñ¥½¸½±±•Ñ¥ÉÍÑMÉ••¹Y¥ÍÕ…±UÉ±Ì ¥ì(€€€€€€€½¹ÍÐÕÉ±Ìõ¹•ÜM•Ð ¤ì(€€€€€€€lˆ¡½µ•A…”ˆ°ˆ¡½µ•A…”€¹¡½µ”µ‰œµ™¥á•µ±…å•Èˆ°ˆ¡½µ•A…”€¹¡½µ”µ…Éµ¥½¸ˆ°ˆØÄÐÙ!½µ•I½ÍÑ•Èˆ°ˆ¡½µ•A…”¥µœˆ°ˆ‰½ÑÑ½µ9…Ø¥µœˆ°ˆµ…¥¹	½ÑÑ½µ9…Ø¥µœ‰t¹™½É… ¡Í•±•Ñ½Èôù‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±°¡Í•±•Ñ½È¤¹™½É… ¡¹½‘”ôùí¥˜¡¹½‘”¹Ñ…9…µ”ôôô‰%5ˆ˜™¹½‘”¹ÕÉÉ•¹ÑMÉŒ¥íÕÉ±Ì¹…‘¡¹½‘”¹ÕÉÉ•¹ÑMÉŒ¤íõÕÉ±ÍÉ½µMÑå±”¡•Ñ½µÁÕÑ•‘MÑå±”¡¹½‘”¤¹‰…­É½Õ¹‘%µ…”¤¹™½É… ¡ÕÉ°ôùÕÉ±Ì¹…‘¡ÕÉ°¤¤íô¤¤ì(€€€€€€€É•ÑÕÉ¸l¸¸¹ÕÉ±Ítì(€€€ô(€€€…Íå¹Œ™Õ¹Ñ¥½¸ÁÉ•Á…É•¥ÉÍÑMÉ••¹Y¥ÍÕ…±Ì ¥ì(€€€€€€€¥˜¡™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”¥íÉ•ÑÕÉ¸™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”íô(€€€€€€€™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”ô¡…Íå¹Œ ¤ôùì(€€€€€€€€€€€½¹ÍÐ¡½µ”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•A…”ˆ¤±É½ÍÑ•Èõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄÐÙ!½µ•I½ÍÑ•Èˆ¤ì(€€€€€€€€€€€¥˜ …¡½µ•ñð…É½ÍÑ•ÉññÉ½ÍÑ•È¹‘…Ñ…Í•Ð¹É•…‘ä„ôô‰ÑÉÕ”ˆ¥íÑ¡É½Ü¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?¢ÎšZg–Âkšr«–º3š"CŽ€ˆ¤íô(€€€€€€€€€€€½¹ÍÐÕÉ±Ìõ½±±•Ñ¥ÉÍÑMÉ••¹Y¥ÍÕ…±UÉ±Ì ¤ì¥˜ …ÕÉ±Ì¹±•¹Ñ ¥íÑ¡É½Ü¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?–r[ž&šâ–Z»ž
ëž¦ëŽ€ˆ¤íô(€€€€€€€€€€€½¹ÍÐ™½¹ÑÌõ‘½Õµ•¹Ð¹™½¹ÑÌ˜™‘½Õµ•¹Ð¹™½¹ÑÌ¹É•…‘äý‘½Õµ•¹Ð¹™½¹ÑÌ¹É•…‘äéAÉ½µ¥Í”¹É•Í½±Ù” ¤ì…Ý…¥ÐAÉ½µ¥Í”¹…±°¡m™½¹ÑÌ°¸¸¹ÕÉ±Ì¹µ…À¡‘•½‘•%µ…•UÉ°¥t¤ì…Ý…¥Ð¹•áÑA…¥¹Ð ¤ì(€€€€€€€€€€€½¹ÍÐ±¥Ù•UÉ±Ìõ¹•ÜM•Ð¡½±±•Ñ¥ÉÍÑMÉ••¹Y¥ÍÕ…±UÉ±Ì ¤¤ì¥˜¡ÕÉ±Ì¹Í½µ”¡ÕÉ°ôø…±¥Ù•UÉ±Ì¹¡…Ì¡ÕÉ°¤¤¥íÑ¡É½Ü¹•ÜÉÉ½È ‹’âï–~;¦š[–Æ?–r[ž&–r£žæ«¢Ž÷–&7¢Š¯šnÿš>oŽ€ˆ¤íô(€€€€€€€€€€€ÑÉåí¥˜¡Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±Ìéµ…¥¸µ¥ÑäµÙ¥ÍÕ…°µÉ•…‘äˆ¤íõõ…Ñ ¡|¥ìô(€€€€€€€€€€€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡í…ÍÍ•ÑÌéÕÉ±Ì¹±•¹Ñ¡ô¤ì(€€€€€€€ô¤ ¤¹…Ñ ¡•ÉÉ½Èôùí™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”õ¹Õ±°íÑ¡É½Ü•ÉÉ½Èíô¤ì(€€€€€€€É•ÑÕÉ¸™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸¡½µ•I½ÍÑ•ÉA±…•¡½±‘•È¡¥¹‘•à¥ì(€€€€€€€É•ÑÕÉ¸€œñ…ÉÑ¥±”±…ÍÌô‰ØÄÐØµ¡½µ”µ¡…É…Ñ•ÈØÄÐØµ¡½µ”µ¡…É…Ñ•ÈµÁ±…•¡½±‘•Èˆ‘…Ñ„µ¡½µ”µÉ½ÍÑ•ÈµÍ±½Ðôˆœ­¥¹‘•à¬œˆ…É¥„µ‰ÕÍäô‰ÑÉÕ”ˆøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µ…Ù…Ñ…Èˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µ¡…É…Ñ•Èµµ…¥¸ˆøñ‘¥Øøñˆû¦j+’ò7¢ÎšZg¢ò'–—’â´ð½ˆøñÍÁ…¸ø´´ð½ÍÁ…¸øð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µÉ•Í½ÕÉ”¡Àˆøñ¤ÍÑå±”ô‰Ý¥‘Ñ èÀ”ˆøð½¤øñÍÑÉ½¹œù!@€´´ð½ÍÑÉ½¹œøð½‘¥Øøœ¬(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µÉ•Í½ÕÉ”ÍÀˆøñ¤ÍÑå±”ô‰Ý¥‘Ñ èÀ”ˆøð½¤øñÍÑÉ½¹œùM@€´´ð½ÍÑÉ½¹œøð½‘¥Øøð½‘¥Øøð½…ÉÑ¥±”øœì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¥ì(€€€€€€€½¹ÍÐÁ…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•A…”ˆ¤ì(€€€€€€€½¹ÍÐÉ¥õÁ…”˜™Á…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹¡½µ”µ…ÉµÉ¥ˆ¤ì(€€€€€€€¥˜ …Á…•ñð…É¥¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€±•ÐÉ½ÍÑ•Èõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄÐÙ!½µ•I½ÍÑ•Èˆ¤ì(€€€€€€€¥˜ …É½ÍÑ•È¥ì(€€€€€€€€€€€É½ÍÑ•Èõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰Í•Ñ¥½¸ˆ¤ì(€€€€€€€€€€€É½ÍÑ•È¹¥ô‰ØÄÐÙ!½µ•I½ÍÑ•Èˆì(€€€€€€€€€€€É½ÍÑ•È¹±…ÍÍ9…µ”ô‰ØÄÐØµ¡½µ”µÉ½ÍÑ•Èˆì(€€€€€€€€€€€É½ÍÑ•È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹–K¦j«¦j+’ò4ˆ¤ì(€€€€€€€€€€€É¥¹¥¹Í•ÉÑ‘©…•¹Ñ±•µ•¹Ð ‰…™Ñ•É•¹ˆ±É½ÍÑ•È¤ì(€€€€€€€ô(€€€€€€€¥˜ …É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆéÍ½Á”€ø¡•…‘•Èˆ¤¥ì(€€€€€€€€€€€½¹ÍÐ¡•…‘•Èõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰¡•…‘•Èˆ¤ì(€€€€€€€€€€€½¹ÍÐÕÉÉ•¹Ñ½±õÑåÁ•½˜½±„ôô‰Õ¹‘•™¥¹•ˆ(€€€€€€€€€€€€€€€€ý5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡½±¤¤¤¹Ñ½1½…±•MÑÉ¥¹œ ‰é µQ\ˆ¤(€€€€€€€€€€€€€€€€èˆÀˆì(€€€€€€€€€€€¡•…‘•È¹¥¹¹•É!Q50ôœñˆû–K¦j«¦j+’ò4ð½ˆøñÍÁ…¸±…ÍÌô‰ØÄÐØµ¡½µ”µÉ½ÍÑ•Èµ½Õ¹Ðˆû¦j+’ò4€´´€¼€Øð½ÍÁ…¸øñÍÁ…¸±…ÍÌô‰ØÄÐØµ¡½µ”µÉ½ÍÑ•Èµ½±ˆû¦G–æŒ€ñÍÑÉ½¹œ¥ô‰ØÄÐÙ!½µ•I½ÍÑ•É½±‘Y…±Õ”ˆøœ­ÕÉÉ•¹Ñ½±¬œð½ÍÑÉ½¹œøð½ÍÁ…¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰Øµ™¥á•µ™½Éµ…Ñ¥½¸µ•¹ÑÉäˆ‘…Ñ„µ™•…ÑÕÉ”ô‰…µ•Á±…äµ½É”ˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡p™½Éµ…Ñ¥½¹pœ¤ˆû’ö#¦fŒð½‰ÕÑÑ½¸øœì(€€€€€€€€€€€É½ÍÑ•È¹…ÁÁ•¹‘¡¥±¡¡•…‘•È¤ì(€€€€€€€ô(€€€€€€€¥˜ …É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄÐØµ¡½µ”µ¡…É…Ñ•Èˆ¤¥ì(€€€€€€€€€€€™½È¡±•Ð¥¹‘•àôÀí¥¹‘•àðÌí¥¹‘•à¬¬¥ì(€€€€€€€€€€€€€€€É½ÍÑ•È¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰‰•™½É••¹ˆ±¡½µ•I½ÍÑ•ÉA±…•¡½±‘•È¡¥¹‘•à¤¤ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€±•ÐÉ•±¥M±½ÐõÉ½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ•…´µÉ•±¥Œµ±½…‘½ÕÐµÍ±½Ðˆ¤ì(€€€€€€€¥˜ …É•±¥M±½Ð¥ì(€€€€€€€€€€€É•±¥M±½Ðõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€€€€€É•±¥M±½Ð¹±…ÍÍ9…µ”ô‰Ñ•…´µÉ•±¥Œµ±½…‘½ÕÐµÍ±½Ðˆì(€€€€€€€€€€€É•±¥M±½Ð¹‘…Ñ…Í•Ð¹É•…‘äô‰™…±Í”ˆì(€€€€€€€€€€€É•±¥M±½Ð¹¥¹¹•É!Q50ôœñÍÁ…¸û¦j+’ò7žžc–¾Øð½ÍÁ…¸øñˆûžžc–¾Û¢ÎšZg¢ò'–—’â´ð½ˆøñÍµ…±°ûž¶'–úš¶–ò?–¶cšªS–º3š"C¢žšz@ð½Íµ…±°øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ™•…ÑÕÉ”ô‰É•±¥Œˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡pÉ•±¥pœ¤ˆ‘¥Í…‰±•û¦ãšNð½‰ÕÑÑ½¸øœì(€€€€€€€€€€€É½ÍÑ•È¹…ÁÁ•¹‘¡¥±¡É•±¥M±½Ð¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸É½ÍÑ•Èì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘!½µ•I•±¥M…Ù” ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÉ•Á½Í¥Ñ½ÉäõÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í½Õ¹ÑM…Ù”ì(€€€€€€€€€€€½¹ÍÐÕ¥õÉ•Á½Í¥Ñ½Éä˜™É•Á½Í¥Ñ½Éä¹•ÑÑ¥Ù•U¥ ¤ì(€€€€€€€€€€€¥˜ …É•Á½Í¥Ñ½Éåñð…Õ¥¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±ÐõÉ•Á½Í¥Ñ½Éä¹É•…‘½ÉU¥¡Õ¥¤ì(€€€€€€€€€€€É•ÑÕÉ¸É•ÍÕ±Ð˜™É•ÍÕ±Ð¹ÍÑ…ÑÕÌôôô‰É•…‘äˆ˜™É•ÍÕ±Ð¹Í…Ù”˜™ÑåÁ•½˜É•ÍÕ±Ð¹Í…Ù”ôôô‰½‰©•Ðˆ(€€€€€€€€€€€€€€€€ýÉ•ÍÕ±Ð¹Í…Ù”(€€€€€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹!½µ•I•±¥MÕµµ…Éä ¥ì(€€€€€€€½¹ÍÐÉ½ÍÑ•Èõ•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¤ì(€€€€€€€½¹ÍÐÍ±½ÐõÉ½ÍÑ•È˜™É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ•…´µÉ•±¥Œµ±½…‘½ÕÐµÍ±½Ðˆ¤ì(€€€€€€€¥˜ …Í±½Ð¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐÍ…Ù”õÉ•…‘!½µ•I•±¥M…Ù” ¤ì(€€€€€€€¥˜ …Í…Ù”¥ì(€€€€€€€€€€€Í±½Ð¹‘…Ñ…Í•Ð¹É•…‘äô‰™…±Í”ˆì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•±¥%õÍ…Ù”¹Ñ•…µ1½…‘½ÕÐ˜™ÑåÁ•½˜Í…Ù”¹Ñ•…µ1½…‘½ÕÐôôô‰½‰©•Ðˆ(€€€€€€€€€€€€ýMÑÉ¥¹œ¡Í…Ù”¹Ñ•…µ1½…‘½ÕÐ¹É•±¥%‘ñðˆˆ¤(€€€€€€€€€€€€èˆˆì(€€€€€€€½¹ÍÐ‘•™¥¹¥Ñ¥½¸õÉ•±¥%ý!=5}I1%}MU55Ie}Q1=mÉ•±¥%‘té¹Õ±°ì(€€€€€€€½¹ÍÐ½Ý¹•õÉ•±¥%˜™Í…Ù”¹Á±…å•ÉI•±¥Ì˜™ÑåÁ•½˜Í…Ù”¹Á±…å•ÉI•±¥Ìôôô‰½‰©•Ðˆ(€€€€€€€€€€€€ýÍ…Ù”¹Á±…å•ÉI•±¥ÍmÉ•±¥%‘t(€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€½¹ÍÐ±•Ù•°õ5…Ñ ¹µ…à Ä±5…Ñ ¹µ¥¸ ÈÀ±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡½Ý¹•˜™½Ý¹•¹±•Ù•°¥ñðÄ¤¤¤ì(€€€€€€€Í±½Ð¹¥¹¹•É!Q50õ‘•™¥¹¥Ñ¥½¸(€€€€€€€€€€€€üœñÍÁ…¸û¦j+’ò7žžc–¾Øð½ÍÁ…¸øñˆøœ­É½ÍÑ•ÉÍ…Á”¡‘•™¥¹¥Ñ¥½¸¹¹…µ”¤¬œ1Ø¸œ­±•Ù•°¬œð½ˆøñÍµ…±°øœ­É½ÍÑ•ÉÍ…Á”¡‘•™¥¹¥Ñ¥½¸¹ÑÉ¥•ÉQ•áÐ¤¬œð½Íµ…±°øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ™•…ÑÕÉ”ô‰É•±¥Œˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡pÉ•±¥pœ¤ˆûšnÓš>lð½‰ÕÑÑ½¸øœ(€€€€€€€€€€€€èœñÍÁ…¸û¦j+’ò7žžc–¾Øð½ÍÁ…¸øñˆû–Âkšr«¢Žw–
dð½ˆøñÍµ…±°ûš¾?¦j+–¢÷¢Žw–
dÇ’îÛžžc–¾Øð½Íµ…±°øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µ™•…ÑÕÉ”ô‰É•±¥Œˆ½¹±¥¬ô‰½Á•¹!½µ••…ÑÕÉ”¡pÉ•±¥pœ¤ˆû¦ãšNð½‰ÕÑÑ½¸øœì(€€€€€€€Í±½Ð¹‘…Ñ…Í•Ð¹É•…‘äô‰ÑÉÕ”ˆì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É!½µ•I½ÍÑ•È ¥ì(€€€€€€€™¥ÉÍÑMÉ••¹Y¥ÍÕ…±I•…‘åAÉ½µ¥Í”õ¹Õ±°ì(€€€€€€€½¹ÍÐÉ½ÍÑ•Èõ•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¤ì(€€€€€€€¥˜ …É½ÍÑ•ÉññÑåÁ•½˜•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐÁ…ÉÑå%¹‘•á•Ìõ•Ñá¥ÍÑ¥¹A…ÉÑå%¹‘•á•Ì ¤¹Í±¥” À°Ì¤ì(€€€€€€€½¹ÍÐ…Ù…¥±…‰±•áÀõÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÍ•ÑÙ…¥±…‰±•áÁA½½°ôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ýÝ¥¹‘½Ü¹ØÄÜÍ•ÑÙ…¥±…‰±•áÁA½½°¡…Ñ”¹¹½Ü ¤¤(€€€€€€€€€€€€è¡ÑåÁ•½˜Í¡…É•‘áÀ„ôô‰Õ¹‘•™¥¹•ˆýÍ¡…É•‘áÀèÀ¤ì(€€€€€€€Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•!Õ‘½±‘Y…±Õ”ˆ¤±ÑåÁ•½˜½±„ôô‰Õ¹‘•™¥¹•ˆý½±èÀ¤ì(€€€€€€€Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•!Õ‘áÁY…±Õ”ˆ¤±…Ù…¥±…‰±•áÀ¤ì(€€€€€€€Íå¹I½ÍÑ•ÉI•Í½ÕÉ”¡‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄÐÙ!½µ•I½ÍÑ•É½±‘Y…±Õ”ˆ¤±ÑåÁ•½˜½±„ôô‰Õ¹‘•™¥¹•ˆý½±èÀ¤ì(€€€€€€€½¹ÍÐ½Õ¹ÐõÉ½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄÐØµ¡½µ”µÉ½ÍÑ•Èµ½Õ¹Ðˆ¤ì(€€€€€€€¥˜¡½Õ¹Ð¥ì½Õ¹Ð¹Ñ•áÑ½¹Ñ•¹Ðô‹¦j+’ò4€ˆ­Á…ÉÑå%¹‘•á•Ì¹±•¹Ñ ¬ˆ€¼€Øˆìô((€€€€€€€½¹ÍÐ…É‘Ìõmtì(€€€€€€€™½È¡±•ÐÍ±½Ñ%¹‘•àôÀíÍ±½Ñ%¹‘•àðÌíÍ±½Ñ%¹‘•à¬¬¥ì(€€€€€€€€€€€½¹ÍÐ¥¹‘•àõÁ…ÉÑå%¹‘•á•ÍmÍ±½Ñ%¹‘•átì(€€€€€€€€€€€½¹ÍÐ¡…É…Ñ•ÈõÑåÁ•½˜¥¹‘•àôôô‰¹Õµ‰•Èˆ˜™ÑåÁ•½˜•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•àôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ý•ÑA…ÉÑå¡…É…Ñ•É	å%¹‘•à¡¥¹‘•à¤(€€€€€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€€€€€½¹ÍÐÍÑ…ÑÌõÑåÁ•½˜¥¹‘•àôôô‰¹Õµ‰•Èˆ˜™ÑåÁ•½˜•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ý•ÑA…ÉÑå	…ÑÑ±•MÑ…ÑÌ¡¥¹‘•à¤(€€€€€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€€€€€¥˜ …¡…É…Ñ•Éñð…ÍÑ…ÑÌ¥ì(€€€€€€€€€€€€€€€…É‘Ì¹ÁÕÍ  œñ…ÉÑ¥±”±…ÍÌô‰ØÄÐØµ¡½µ”µ¡…É…Ñ•ÈØÄÐØµ¡½µ”µ¡…É…Ñ•Èµ•µÁÑäˆ‘…Ñ„µ¡½µ”µÉ½ÍÑ•ÈµÍ±½Ðôˆœ­Í±½Ñ%¹‘•à¬œˆøñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µ…Ù…Ñ…Èˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøð½‘¥Øøñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µ¡…É…Ñ•Èµµ…¥¸ˆøñ‘¥Øøñˆû¦j+’ò7ž¦ë’ö4ð½ˆøñÍÁ…¸ø´´ð½ÍÁ…¸øð½‘¥Øøñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µÉ•Í½ÕÉ”¡Àˆøñ¤ÍÑå±”ô‰Ý¥‘Ñ èÀ”ˆøð½¤øñÍÑÉ½¹œù!@€´´ð½ÍÑÉ½¹œøð½‘¥Øøñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µÉ•Í½ÕÉ”ÍÀˆøñ¤ÍÑå±”ô‰Ý¥‘Ñ èÀ”ˆøð½¤øñÍÑÉ½¹œùM@€´´ð½ÍÑÉ½¹œøð½‘¥Øøð½‘¥Øøð½…ÉÑ¥±”øœ¤ì(€€€€€€€€€€€€€€€½¹Ñ¥¹Õ”ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐ¡Àõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤±É½ÍÑ•É9Õµ‰•È¡¡…É…Ñ•È¹¡À¤¤¤ì(€€€€€€€€€€€½¹ÍÐÍÀõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤±É½ÍÑ•É9Õµ‰•È¡¡…É…Ñ•È¹ÍÀ¤¤¤ì(€€€€€€€€€€€½¹ÍÐ¡ÁA•É•¹ÐõÉ½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤øÀý¡À½É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤¨ÄÀÀèÀì(€€€€€€€€€€€½¹ÍÐÍÁA•É•¹ÐõÉ½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤øÀýÍÀ½É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤¨ÄÀÀèÀì(€€€€€€€€€€€½¹ÍÐ…ÉÑÝ½É¬õÑåÁ•½˜•Ñ¡…É…Ñ•ÉÉÑÝ½É­A…Ñ ôôô‰™Õ¹Ñ¥½¸ˆý•Ñ¡…É…Ñ•ÉÉÑÝ½É­A…Ñ ¡¡…É…Ñ•È¤èˆˆì(€€€€€€€€€€€…É‘Ì¹ÁÕÍ  œñ…ÉÑ¥±”±…ÍÌô‰ØÄÐØµ¡½µ”µ¡…É…Ñ•Èˆ‘…Ñ„µ¡½µ”µÉ½ÍÑ•ÈµÍ±½Ðôˆœ­Í±½Ñ%¹‘•à¬œˆ‘…Ñ„µ•±•µ•¹Ðôˆœ­É½ÍÑ•ÉÍ…Á”¡¡…É…Ñ•È¹•±•µ•¹Ññð‰™¥É”ˆ¤¬œˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µ…Ù…Ñ…Èˆøñ¥µœÍÉŒôˆœ­É½ÍÑ•ÉÍ…Á”¡…ÉÑÝ½É¬¤¬œˆ…±Ðôˆœ­É½ÍÑ•ÉÍ…Á”¡¡…É…Ñ•È¹¥‘ñð‹¢žK¢&Èˆ¤¬Ÿ¦‚·–<ˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µ¡…É…Ñ•Èµµ…¥¸ˆøñ‘¥Øøñˆøœ­É½ÍÑ•ÉÍ…Á”¡¡…É…Ñ•È¹¥‘ñð ‹¢žK¢&Èˆ¬¡¥¹‘•à¬Ä¤¤¤¬œð½ˆøñÍÁ…¸ù1Ø¸œ­5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡¡…É…Ñ•È¹±•Ù•°¥ñðÄ¤¤¬œð½ÍÁ…¸øð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µÉ•Í½ÕÉ”¡Àˆøñ¤ÍÑå±”ô‰Ý¥‘Ñ èœ­¡ÁA•É•¹Ð¬œ”ˆøð½¤øñÍÑÉ½¹œù!@€œ­5…Ñ ¹™±½½È¡¡À¤¬œ€¼€œ­5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…á!@¤¤¬œð½ÍÑÉ½¹œøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰ØÄÐØµ¡½µ”µÉ•Í½ÕÉ”ÍÀˆøñ¤ÍÑå±”ô‰Ý¥‘Ñ èœ­ÍÁA•É•¹Ð¬œ”ˆøð½¤øñÍÑÉ½¹œùM@€œ­5…Ñ ¹™±½½È¡ÍÀ¤¬œ€¼€œ­5…Ñ ¹™±½½È¡É½ÍÑ•É9Õµ‰•È¡ÍÑ…ÑÌ¹µ…áM@¤¤¬œð½ÍÑÉ½¹œøð½‘¥Øøð½‘¥Øøð½…ÉÑ¥±”øœ¤ì(€€€€€€€ô((€€€€€€€É½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹ØÄÐØµ¡½µ”µ¡…É…Ñ•Èˆ¤¹™½É… ¡¹½‘”ôù¹½‘”¹É•µ½Ù” ¤¤ì(€€€€€€€½¹ÍÐÉ•±¥M±½ÐõÉ½ÍÑ•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Ñ•…´µÉ•±¥Œµ±½…‘½ÕÐµÍ±½Ðˆ¤ì(€€€€€€€¥˜¡É•±¥M±½Ð¥ìÉ•±¥M±½Ð¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰‰•™½É•‰•¥¸ˆ±…É‘Ì¹©½¥¸ ˆˆ¤¤ìô(€€€€€€€•±Í•ìÉ½ÍÑ•È¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰‰•™½É••¹ˆ±…É‘Ì¹©½¥¸ ˆˆ¤¤ìô(€€€€€€€É½ÍÑ•È¹‘…Ñ…Í•Ð¹É•…‘äô‰ÑÉÕ”ˆì(€€€€€€€Íå¹!½µ•I•±¥MÕµµ…Éä ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô(€€€Ý¥¹‘½Ü¹ØÔÑI•¹‘•É!½µ•I½ÍÑ•ÈõÉ•¹‘•É!½µ•I½ÍÑ•Èì(€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í!½µ•I•±¥MÕµµ…Éäõ=‰©•Ð¹™É••é”¡ì(€€€€€€€•¹ÍÕÉ•M¡•±°é•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±°°(€€€€€€€Íå¹ŒéÍå¹!½µ•I•±¥MÕµµ…Éä°(€€€€€€€ÁÉ•Á…É•¥ÉÍÑMÉ••¹Y¥ÍÕ…±Ì(€€€ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰™½ÕÈµÍåµ‰½±ÌéÍÑ…ÉÑÕÀµÉ•…‘äˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍÐÉ½ÍÑ•Èõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄÐÙ!½µ•I½ÍÑ•Èˆ¤ì(€€€€€€€¥˜ …É½ÍÑ•ÉññÉ½ÍÑ•È¹‘…Ñ…Í•Ð¹É•…‘ä„ôô‰ÑÉÕ”ˆ¥íÉ•¹‘•É!½µ•I½ÍÑ•È ¤íô(€€€€€€€Íå¹!½µ•I•±¥MÕµµ…Éä ¤ì(€€€ô¤ì((€€€™Õ¹Ñ¥½¸‰½½Ð ¥ì(€€€€€€€…ÁÁ±ä ¤ì(€€€€€€€•¹ÍÕÉ•‘É••½¹™¥œ ¤ì(€€€€€€€•¹ÍÕÉ•!½µ•I½ÍÑ•ÉM¡•±° ¤ì(€€€ô((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”€ôôô€‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±‰½½Ð±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€‰½½Ð ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄÜµÍÑ…”µØØÀµÑÉ…¥¹¥¹œµÉ•¹‘•ÈµÕ…É¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(‰ÕÍ”ÍÑÉ¥Ðˆì)Ý¥¹‘½Ü¹5}9Q%Y}=9%I5}	M1%9ô‰XÔÐˆì)Ý¥¹‘½Ü¹5}9Q%Y}UII9Q}YIM%=8ô‰XØÀˆì)Ý¥¹‘½Ü¹5}9Q%Y}1MQ}M=Aô‰ÑÉ…¥¹¥¹œµ™Õ±°µÍ½ÕÉ”µ…Õ‘¥Ðˆì()½¹ÍÐXÄÜÌÐÑ}i=9}IPõì(€€€‘•Í•ÉÐè‰…ÍÍ•ÑÌ½µ…ÁÌ½‘•Í•ÉÐµØÄÜÌÐÐ¹Á¹œˆ°(€€€¥”è‰…ÍÍ•ÑÌ½µ…ÁÌ½¥”µØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”Ðè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÐµØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”Ôè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÔµØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”Øè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ØµØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”Üè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÜµØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”àè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”àµØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”äè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”äµØÄÜÌÐÐ¹Á¹œˆ°(€€€é½¹”ÄÀè‰…ÍÍ•ÑÌ½µ…ÁÌ½é½¹”ÄÀµØÄÜÌÐÐ¹Á¹œˆ)ôì)ÑÉåì¥˜¡ÑåÁ•½˜é½¹•	…­É½Õ¹‘%µ…•Ì„ôô‰Õ¹‘•™¥¹•ˆ¥ì=‰©•Ð¹…ÍÍ¥¸¡é½¹•	…­É½Õ¹‘%µ…•Ì±XÄÜÌÐÑ}i=9}IP¤ìôõ…Ñ ¡|¥ìô)ÑÉåì¥˜¡ÑåÁ•½˜µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì„ôô‰Õ¹‘•™¥¹•ˆ¥ì=‰©•Ð¹…ÍÍ¥¸¡µ…Ái½¹•	…­É½Õ¹‘%µ…•Ì±XÄÜÌÐÑ}i=9}IP¤ìôõ…Ñ ¡|¥ìô()™Õ¹Ñ¥½¸•¹™½É•QÉ…¥¹¥¹I•¹‘•È ¥ì(€€€½¹ÍÐÁ…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ÑÉ…¥¹¥¹A…”ˆ¤ì(€€€¥˜¡Á…”¥ì(€€€€€€€Á…”¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹ÑÉ…¥¹¥¹œµé½¹”µ¥Ñ•´ˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡•°¥ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰™½¹ÐµÍ¥é”ˆ°ˆÈÁÁàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Á…‘‘¥¹œˆ°ˆÙÁà€ÄÑÁàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰µ¥¸µ¡•¥¡Ðˆ°ˆÐÉÁàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±¥¹”µ¡•¥¡Ðˆ°ˆÄ¸ÄÔˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€•°¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½àµÍ¥é¥¹œˆ°‰‰½É‘•Èµ‰½àˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€ô¤ì(€€€ô((€€€€¼¨(€€€€€€Q¡”ÑÉ…¥¹¥¹œé½¹”¥¹™½Éµ…Ñ¥½¸µ½‘…°ÕÍ•Ñ¼É••¥Ù”Ý¥‘Ñ ½µ…àµ¡•¥¡Ð¼(€€€€€€½Ù•É™±½Ü¥¹±¥¹”ÍÑå±•Ì¡•É”¸Q¡½Í”‘•±…É…Ñ¥½¹Ì™½Õ¡ÐÑ¡”Í¡…É•U$(€€€€€€Í¥é¥¹œ…ÕÑ¡½É¥Ñä…¹µ…‘”Ñ¡”Ý¡½±”™É…µ”Ñ¡”ÍÉ½±°½Ý¹•È¸•½µ•ÑÉä¥Ì(€€€€€€¹½Ü½Ý¹•‰äÍÌ¼ÈÀµÍÑ…”µØØÀµÑÉ…¥¹¥¹œµ½¹±äµÍ…™•Ñä¹ÍÌìÑ¡¥ÌÉÕ¹Ñ¥µ”Õ…É(€€€€€€¥¹Ñ•¹Ñ¥½¹…±±äÑ½Õ¡•Ì½¹±äÑ¡”ÑÉ…¥¹¥¹œµé½¹”±¥ÍÐ¥Ñ•µÌ…‰½Ù”¸(€€€€¨¼)ô)¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±•¹™½É•QÉ…¥¹¥¹I•¹‘•È±í½¹”éÑÉÕ•ô¤ì)õ•±Í•ì(€€€•¹™½É•QÉ…¥¹¥¹I•¹‘•È ¤ì)ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄàµÍÑ…”µØØÐµ¡…É…Ñ•ÈµÑ½Õ µ…Ñ¥½¸µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(‰ÕÍ”ÍÑÉ¥Ðˆì)™Õ¹Ñ¥½¸Í•Ñ¡…É…Ñ•ÉQ½Õ¡5½‘”¡…Ñ¥Ù”¥ì(€€€€¼¨I•Ñ¥É•‰É¥‘”è¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ð‘•±…É•Ì¥ÑÌ½Ý¸ÍÉ½±°½Ý¹•È¸€¨¼)ô)™Õ¹Ñ¥½¸Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¥ì(€€€½¹ÍÐµ½‘…°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€½¹ÍÐÑ…‰Ìõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡…É…Ñ•ÉQ…‰½¹Ñ•¹Ðˆ¤ì(€€€½¹ÍÐ…Ñ¥Ù”ô„„¡µ½‘…°€˜˜Ñ…‰Ì€˜˜•Ñ½µÁÕÑ•‘MÑå±”¡µ½‘…°¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆ€˜˜µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¤ì(€€€Í•Ñ¡…É…Ñ•ÉQ½Õ¡5½‘”¡…Ñ¥Ù”¤ì)ô)¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”±í½¹”éÑÉÕ•ô¤ì)•±Í”Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘” ¤ì)½¹ÍÐ¡…É…Ñ•É5½‘…°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì)¥˜¡¡…É…Ñ•É5½‘…°˜™ÑåÁ•½˜5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€½¹ÍÐ½‰Í•ÉÙ•Èõ¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”¤ì(€€€½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡¡…É…Ñ•É5½‘…°±íÍÕ‰ÑÉ•”éÑÉÕ”±¡¥±‘1¥ÍÐéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”±…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌˆ°‰ÍÑå±”‰uô¤ì)ô)Ý¥¹‘½Ü¹Íå¹¡…É…Ñ•ÉQ½Õ¡5½‘”õÍå¹¡…É…Ñ•ÉQ½Õ¡5½‘”ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÄäµÍÑ…”µØÜàµ¡…É…Ñ•Èµ¥¹Ù•¹Ñ½ÉäµÉÕ¹Ñ¥µ”¹©Ì€¨¼(¼¨XÄÜÜèÉ•Ñ¥É•¡…É…Ñ•Èµ±…å½ÕÐÝÉ¥Ñ•È­•ÁÐ½¹±ä…Ì„½µÁ…Ñ¥‰¥±¥Ñä•áÁ½ÉÐ¸€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€™Õ¹Ñ¥½¸…ÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐ ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€Ý¥¹‘½Ü¹ØÜáÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐõ…ÁÁ±å¡…É…Ñ•É%¹Ù•¹Ñ½Éå1…å½ÕÐì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÈÌµØÄÈÔµ¡…É…Ñ•ÈµÉ•…Ñ¥½¸µ‰½½ÑÍÑÉ…À¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XÄÜÐƒŠPAIµA%9P!IQHIQ%=8	==QMQI@€¬MYUI(€€Q¡”É•…Ñ¥½¸Á…”ÍÑ…ÉÑÌ¥¹Í¥‘”€…ÁÀ™½È±•…ä!Q50½µÁ…Ñ¥‰¥±¥Ñä¸((€€%5A=IQ9Pè(€€€´Q¡¥Ì‰½½ÑÍÑÉ…À½¹±äÁÉ•Á…É•ÌÑ¡”=4±½…Ñ¥½¸¸%Ð¹•Ù•È‘•¥‘•ÌÑ¡…Ð(€€€€¡…É…Ñ•ÈÉ•…Ñ¥½¸¥Ì…Ñ¥Ù”‰•™½É”Á•ÉÍ¥ÍÑ•‘…Ñ„¡…Ì‰••¸É•ÍÑ½É•¸(€€€´™…¥°µ±½Í•ÁÉ¥µ…Éäµ¡…É…Ñ•ÈÕ…ÉÁÉ•Ù•¹ÑÌ…¸…¥‘•¹Ñ…°É•…Ñ¥½¸(€€€€ÍÉ••¸…™Ñ•ÈÉ•±½…™É½´½Ù•ÉÝÉ¥Ñ¥¹œ…¸•á¥ÍÑ¥¹œÍ…Ù•Í±½Ð´Ä¡…É…Ñ•È¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸‰½½ÑÍÑÉ…Á9…Ñ¥Ù•É•…Ñ¥½¹A…” ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€½¹ÍÐÁ…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€½¹ÍÐ½Ù•É±…äõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì((€€€¥˜¡Á…”˜™½Ù•É±…ä˜™Á…”¹Á…É•¹Ñ±•µ•¹Ð„ôõ½Ù•É±…ä¥ì(€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡Á…”¤ì(€€€ô(€€€¥˜¡Á…”¥ì(€€€€€€€Á…”¹‘…Ñ…Í•Ð¹¹…Ñ¥Ù•AÉ•Á…¥¹Ðô‰ØÄÜÐµ‘½´µ½¹±äˆì(€€€ô((€€€™Õ¹Ñ¥½¸±½…‘É¥Ñ¥…±U¥MÑå±” ¥ì(€€€€€€€€¼¨AÉ½‘ÕÑ¥½¸…ÁÀµÍ¡•±°ML½Ý¹ÌÑ¡¥ÌÍÑå±”ì¹¼ÉÕ¹Ñ¥µ”ÍÑå±•Í¡••ÐÉ•ÅÕ•ÍÐ¸€¨¼(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸ÁÉ¥µ…ÉåMÑ…Ñ”¡ÍÑ…Ñ”±ÁÉ¥µ…Éä±É•…Í½¸¥ì(€€€€€€€É•ÑÕÉ¸íÍÑ…Ñ”±ÁÉ¥µ…ÉäéÁÉ¥µ…Éåññ¹Õ±°±É•…Í½¸éÉ•…Í½¹ñðˆ‰ôì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘A•ÉÍ¥ÍÑ•‘AÉ¥µ…Éå¡…É…Ñ•È ¥ì(€€€€€€€±•ÐÉ…Üôˆˆì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÉ•Á½Í¥Ñ½ÉäõÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í½Õ¹ÑM…Ù”ì(€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”õÉ•Á½Í¥Ñ½Éä˜™É•Á½Í¥Ñ½Éä¹É•…‘Ñ¥Ù” ¤ì(€€€€€€€€€€€¥˜ ……Ñ¥Ù•ññ…Ñ¥Ù”¹ÍÑ…ÑÕÌôôô‰¥¹…Ñ¥Ù”ˆ¥ìÉ•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰…½Õ¹ÐµÕ¹É•Í½±Ù•ˆ¤ìô(€€€€€€€€€€€¥˜¡…Ñ¥Ù”¹ÍÑ…ÑÕÌôôô‰•µÁÑäˆ¥ìÉ•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±¹Õ±°°‰¹¼µ…½Õ¹ÐµÍ…Ù”ˆ¤ìô(€€€€€€€€€€€É…Üõ)M=8¹ÍÑÉ¥¹¥™ä¡…Ñ¥Ù”¹Í…Ù”¤ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€€¼¨MÑ½É…”‰•¥¹œÕ¹É•…‘…‰±”µÕÍÐ¹•Ù•ÈÑÕÉ¸¥¹Ñ¼Á•Éµ¥ÍÍ¥½¸Ñ¼(€€€€€€€€€€€€€€½Ù•ÉÝÉ¥Ñ”¡…É…Ñ•È‘…Ñ„¸Q¡¥Ì¥Ì¥¹Ñ•¹Ñ¥½¹…±±ä™…¥°µ±½Í•¸€¨¼(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰ÍÑ½É…”µÕ¹É•…‘…‰±”ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜ …É…Ü¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±¹Õ±°°‰¹¼µÍ…Ù”ˆ¤ì(€€€€€€€ô((€€€€€€€±•ÐÍ…Ù•õ¹Õ±°ì(€€€€€€€ÑÉåì(€€€€€€€€€€€Í…Ù•õ)M=8¹Á…ÉÍ”¡É…Ü¤ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰Í…Ù”µ©Í½¸µ¥¹Ù…±¥ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜ …Í…Ù•‘ññÑåÁ•½˜Í…Ù•„ôô‰½‰©•Ð‰ññÉÉ…ä¹¥ÍÉÉ…ä¡Í…Ù•¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰Í…Ù”µÍ¡…Á”µ¥¹Ù…±¥ˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÁÉ¥µ…ÉäõÍ…Ù•¹Á±…å•Èì(€€€€€€€¥˜¡ÁÉ¥µ…ÉäôôõÕ¹‘•™¥¹•‘ññÁÉ¥µ…Éäôôõ¹Õ±°¥ì(€€€€€€€€€€€€¼¨¸•µÁÑä½‰©•Ð¥Ì„Ù…±¥ÁÉ”µ¡…É…Ñ•ÈÍÑ…Ñ”¥¸¡¥ÍÑ½É¥…°(€€€€€€€€€€€€€€ÍÑ…ÉÑÕÀ½Ñ•ÍÐ™±½ÝÌ¸€¨¼(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±¹Õ±°°‰¹¼µÁÉ¥µ…Éäˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÑåÁ•½˜ÁÉ¥µ…Éä„ôô‰½‰©•Ð‰ññÉÉ…ä¹¥ÍÉÉ…ä¡ÁÉ¥µ…Éä¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±¹Õ±°°‰ÁÉ¥µ…ÉäµÍ¡…Á”µ¥¹Ù…±¥ˆ¤ì(€€€€€€€ô((€€€€€€€€¼¨¡…É…Ñ•È%¥ÌÑ¡”…¹½¹¥…°É•…Ñ¥½¸¥‘•¹Ñ¥Ñä¸=¹”¥Ð•á¥ÍÑÌ°(€€€€€€€€€€Í±½Ð€Ä¥Ì½ÕÁ¥•É•…É‘±•ÍÌ½˜Ý¡•Ñ¡•È…¹½Ñ¡•È™¥•±€¡™½È•á…µÁ±”(€€€€€€€€€€±•Ù•°¤¡…Ì‰•½µ”µ…±™½Éµ•¸9•Ù•ÈÉ•ÅÕ¥É”±•Ù•°Ñ¼‰”¡•…±Ñ¡ä¥¸(€€€€€€€€€€½É‘•ÈÑ¼ÁÉ½Ñ•Ð…¸•á¥ÍÑ¥¹œ¡…É…Ñ•È¸€¨¼(€€€€€€€½¹ÍÐ¥õMÑÉ¥¹œ¡ÁÉ¥µ…Éä¹¥‘ñðˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜¡¥¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰½ÕÁ¥•ˆ±ÁÉ¥µ…Éä°‰ÁÉ¥µ…Éäµ¥µÁÉ•Í•¹Ðˆ¤ì(€€€€€€€ô((€€€€€€€€¼¨Q¡”…¹½¹¥…°Õ¹É•…Ñ•Ñ•µÁ±…Ñ”¥Ì¥èˆˆ°±•Ù•°èÄ°•áÀèÀ¸(€€€€€€€€€€%˜¥‘•¹Ñ¥Ñä¥Ìµ¥ÍÍ¥¹œ‰ÕÐÁÉ½É•ÍÌ½Í•½¹‘…Éäµ¡…É…Ñ•È•Ù¥‘•¹”¥Ì(€€€€€€€€€€ÁÉ•Í•¹Ð°ÑÉ•…ÐÑ¡”Í…Ù”…ÌÕ¹Í…™”¥¹ÍÑ•…½˜…ÍÍÕµ¥¹œÑ¡”Í±½Ð¥Ì(€€€€€€€€€€™É•”¸Q¡¥ÌÁÉ•Ù•¹ÑÌ„Á…ÉÑ¥…±±ä‘…µ…•Í…Ù”™É½´‰•¥¹œ½Ù•ÉÝÉ¥ÑÑ•¸¸€¨¼(€€€€€€€½¹ÍÐ±•Ù•°õ9Õµ‰•È¡ÁÉ¥µ…Éä¹±•Ù•°¤ì(€€€€€€€½¹ÍÐ•áÀõ9Õµ‰•È¡ÁÉ¥µ…Éä¹•áÀ¤ì(€€€€€€€½¹ÍÐÁÉ½É•ÍÍ•ô¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡±•Ù•°¤˜™±•Ù•°øÄ¥ñð¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡•áÀ¤˜™•áÀøÀ¤ì(€€€€€€€½¹ÍÐ¡…ÍM•½¹‘…Éäô„„ (€€€€€€€€€€€Í…Ù•¹Á±…å•ÈÈ˜™ÑåÁ•½˜Í…Ù•¹Á±…å•ÈÈôôô‰½‰©•Ðˆ˜™MÑÉ¥¹œ¡Í…Ù•¹Á±…å•ÈÈ¹¥‘ñðˆˆ¤¹ÑÉ¥´ ¤(€€€€€€€€¥ñð„„ (€€€€€€€€€€€Í…Ù•¹Á±…å•ÈÌ˜™ÑåÁ•½˜Í…Ù•¹Á±…å•ÈÌôôô‰½‰©•Ðˆ˜™MÑÉ¥¹œ¡Í…Ù•¹Á±…å•ÈÌ¹¥‘ñðˆˆ¤¹ÑÉ¥´ ¤(€€€€€€€€¤ì((€€€€€€€¥˜¡ÁÉ½É•ÍÍ•‘ññ¡…ÍM•½¹‘…Éä¥ì(€€€€€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰Õ¹Í…™”ˆ±ÁÉ¥µ…Éä°‰ÁÉ¥µ…Éäµ¥‘•¹Ñ¥Ñäµµ¥ÍÍ¥¹œˆ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÁÉ¥µ…ÉåMÑ…Ñ” ‰•µÁÑäˆ±ÁÉ¥µ…Éä°‰‰±…¹¬µÁÉ¥µ…ÉäµÑ•µÁ±…Ñ”ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½ÝAÉ¥µ…ÉåAÉ½Ñ•Ñ¥½¸¡ÍÑ…Ñ”¥ì(€€€€€€€½¹ÍÐÁÉ¥µ…ÉäõÍÑ…Ñ”˜™ÍÑ…Ñ”¹ÁÉ¥µ…Éäì(€€€€€€€½¹ÍÐ¥õMÑÉ¥¹œ¡ÁÉ¥µ…Éä˜™ÁÉ¥µ…Éä¹¥‘ñðˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ±•Ù•°õ9Õµ‰•È¡ÁÉ¥µ…Éä˜™ÁÉ¥µ…Éä¹±•Ù•°¤ì(€€€€€€€½¹ÍÐ½ÕÁ¥•õÍÑ…Ñ”˜™ÍÑ…Ñ”¹ÍÑ…Ñ”ôôô‰½ÕÁ¥•ˆì(€€€€€€€½¹ÍÐµ•ÍÍ…”õ½ÕÁ¥•(€€€€€€€€€€€€ü ‹–×šâ³–"Ãš^‹šr'’âï¢žK¢&Ë–¶cšªSŽ0ˆ­¥¬‹Ž4ˆ¬(€€€€€€€€€€€€€€€€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡±•Ù•°¤˜™±•Ù•°øôÄü‰1Ø¸ˆ­5…Ñ ¹™±½½È¡±•Ù•°¤èˆˆ¤¬‹Žž
ë¦ÿ–7¢š–¾¯–:¢žK¢&Ë¾ò3šr³š²‡–&×–îë–ÞË–>[šÚ#¾òo¢®/¦7šZÃšVÓžB–ú3žæóžê3¦+š"ËŽˆ¤(€€€€€€€€€€€€è‹–×šâ³–"Ã¢žK¢&Ë–¶cšªS¢º–>[žVÃ–âãš"[š^‹šr'¢žK¢&Ëž^W¢Þ‡Žž
ë¦ÿ–7’îï’öW¢žK¢&Ë¢ÎšZg¢Š¯¢š–¾¯¾ò3šr³š²‡–&×–îë–ÞË–>[šÚ#¾òo¢®/–#¦7šZÃšVÓžB¾ò3¢.—’î7–ëž>ûš¶“¢¢+š¿¢®/’þwžVg–¶cšªS’â›–sš¶‹–îëž®/¢žK¢&ËŽˆì(€€€€€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€Ù½¥Ý¥¹‘½Ü¹ÉÁ±•ÉÐ¡µ•ÍÍ…”±íÑ¥Ñ±”è‹¢žK¢&Ë–¶cšªS’þw¢¶Üˆ±½¹™¥ÉµQ•áÐè‹ž~—¦O’êˆ±‘…¹•ÈéÑÉÕ•ô¤ì(€€€€€€€õ•±Í”¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹…±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹…±•ÉÐ¡µ•ÍÍ…”¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¥¹ÍÑ…±±AÉ¥µ…ÉåÉ•…Ñ¥½¹M…Ù•Õ…É ¥ì(€€€€€€€½¹ÍÐÕÉÉ•¹ÐõÝ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èì(€€€€€€€¥˜¡ÑåÁ•½˜ÕÉÉ•¹Ð„ôô‰™Õ¹Ñ¥½¸‰ññÕÉÉ•¹Ð¹}}ØÄÜÑA•ÉÍ¥ÍÑ•‘AÉ¥µ…ÉåÕ…ÉôôõÑÉÕ”¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€™Õ¹Ñ¥½¸Õ…É‘•‘É•…Ñ•¡…É…Ñ•È ¥ì(€€€€€€€€€€€±•ÐÑ…É•ÑM±½ÐôÄì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜É•…Ñ¥½¹Q…É•ÑM±½Ð„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€€€€€Ñ…É•ÑM±½Ðõ5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È¡9Õµ‰•È¡É•…Ñ¥½¹Q…É•ÑM±½Ð¥ñðÄ¤¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡|¥ìô((€€€€€€€€€€€½¹ÍÐÁ•ÉÍ¥ÍÑ•õÉ•…‘A•ÉÍ¥ÍÑ•‘AÉ¥µ…Éå¡…É…Ñ•È ¤ì((€€€€€€€€€€€€¼¨¸Õ¹É•…‘…‰±”½½ÉÉÕÁÐ…¹½¹¥…°Í…Ù”‰±½­Ì•Ù•Éä¡…É…Ñ•È(€€€€€€€€€€€€€€É•…Ñ¥½¸Á…Ñ °‰•…ÕÍ”É•…Ñ•‘‘¥Ñ¥½¹…±¡…É…Ñ•È•Ù•¹ÑÕ…±±ä(€€€€€€€€€€€€€€Í…Ù•ÌÑ¡É½Õ Ñ¡”Í…µ”…¹½¹¥…°­•ä¸¡•…±Ñ¡ä½ÕÁ¥•ÁÉ¥µ…Éä(€€€€€€€€€€€€€€‰±½­Ì½¹±äÍ±½Ð€ÄìÍ±½Ð€È¼ÌÉ•µ…¥¸±•¥Ñ¥µ…Ñ”…‘‘¥Ñ¥½¹Ì¸€¨¼(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€Á•ÉÍ¥ÍÑ•¹ÍÑ…Ñ”ôôô‰Õ¹Í…™”‰ñð(€€€€€€€€€€€€€€€€¡Ñ…É•ÑM±½ÐôôôÄ˜™Á•ÉÍ¥ÍÑ•¹ÍÑ…Ñ”ôôô‰½ÕÁ¥•ˆ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€Í¡½ÝAÉ¥µ…ÉåAÉ½Ñ•Ñ¥½¸¡Á•ÉÍ¥ÍÑ•¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸ÕÉÉ•¹Ð¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€ô((€€€€€€€Õ…É‘•‘É•…Ñ•¡…É…Ñ•È¹}}ØÄÜÑA•ÉÍ¥ÍÑ•‘AÉ¥µ…ÉåÕ…ÉõÑÉÕ”ì(€€€€€€€Õ…É‘•‘É•…Ñ•¡…É…Ñ•È¹}}ØÄÜÑ=É¥¥¹…±É•…Ñ•¡…É…Ñ•ÈõÕÉÉ•¹Ðì(€€€€€€€Ý¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•ÈõÕ…É‘•‘É•…Ñ•¡…É…Ñ•Èì(€€€ô((€€€™Õ¹Ñ¥½¸™¥¹…±¥é•	½½ÑÍÑÉ…À ¥ì(€€€€€€€¥¹ÍÑ…±±AÉ¥µ…ÉåÉ•…Ñ¥½¹M…Ù•Õ…É ¤ì(€€€ô((€€€±½…‘É¥Ñ¥…±U¥MÑå±” ¤ì((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±™¥¹…±¥é•	½½ÑÍÑÉ…À±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€™¥¹…±¥é•	½½ÑÍÑÉ…À ¤ì(€€€ô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÈÐµØÄÈÔµ¡…É…Ñ•ÈµÉ•…Ñ¥½¸µ¹…Ñ¥Ù”µÉÕ¹Ñ¥µ”¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XÄÈàƒŠP%aQ]<µMQ@€ÄÀàÀƒ\€ÄäÈÀ!IQHIQ%=8IU9Q%5(€€€´UÍ•ÌÑ¡”XÄÈàÁÉ”µÁ…¥¹Ð¹…Ñ¥Ù”‰½½ÑÍÑÉ…ÀìÉ•Á…É•¹Ñ¥¹œ¥Ì½¹±ä„™…±±‰…¬(€€€´UÍ•ÌÉ•…°¹…Ñ¥Ù”½µÁ½¹•¹Ð‘¥µ•¹Í¥½¹Ì°¹•Ù•Èµ¥É…Ñ¥½¸Í…±”(€€€´•¹‘•È€¼Á½ÉÑÉ…¥ÐÍÝ¥Ñ¡¥¹œ(€€€´±•µ•¹ÐÁ½Í¥Ñ¥½¹¥¹œÝ¥Ñ ±…É•È•±•µ•¹Ð‘•ÍÉ¥ÁÑ¥½¹Ì(€€€´¥á•¹‘É½¥¡É½µ”…¹Ù…ÌÝ¥Ñ ¹¼Á…”ÍÉ½±°½ÈÁ¥¹ é½½´(€€€´QÝ¼µÍÑ•ÀÉ•…Ñ¥½¸™±½Üì…‰¥±¥Ñä…±±½…Ñ¥½¸±¥Ù•Ì½¸Á…”ÑÝ¼(€€á¥ÍÑ¥¹œ½µ‰…Ð½ÍÑ…Ð½Í­¥±°™½ÉµÕ±…Ì…É”¹½Ð¡…¹•¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸ ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€½¹ÍÐA=IQI%QLõì(€€€€€€€™•µ…±”éì(€€€€€€€€€€€™¥É”è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}™¥É”¹©Áœˆ°(€€€€€€€€€€€Ý…Ñ•Èè‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}Ý…Ñ•È¹©Áœˆ°(€€€€€€€€€€€Ý¥¹è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}Ý¥¹¹©Áœˆ°(€€€€€€€€€€€•…ÉÑ è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½™•µ…±•}•…ÉÑ ¹©Áœˆ(€€€€€€€ô°(€€€€€€€µ…±”éì(€€€€€€€€€€€™¥É”è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}™¥É”¹©Áœˆ°(€€€€€€€€€€€Ý…Ñ•Èè‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}Ý…Ñ•È¹©Áœˆ°(€€€€€€€€€€€Ý¥¹è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}Ý¥¹¹©Áœˆ°(€€€€€€€€€€€•…ÉÑ è‰…ÍÍ•ÑÌ½¡…É…Ñ•ÉÌ½µ…±•}•…ÉÑ ¹©Áœˆ(€€€€€€€ô(€€€ôì((€€€½¹ÍÐ5Qõì(€€€€€€€™¥É”éì(€€€€€€€€€€€±åÁ è‹ž¬ˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹ž#žÃ’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹ž"žfó¢òã–èƒ
Üƒž"šN(ƒ
ÜƒžžHˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹’î—¦®cž"žfóŽž"šN+¢"žžKš2žê3–
ß–ºÏ–ŽO–"ÛšV×’êë¾ò3ž&§žB¢"šÎW¢†O–§šŠw¢Þ¿žÞk¦÷–?–BG’âï–.W¦ËšRïŽˆ°(€€€€€€€€€€€Ñ…Ìél‹¦®cž"žfðˆ°‹ž"šN+–òß–2Xˆ°‹žžK–
ß–ºÌ‰t(€€€€€€€ô°(€€€€€€€Ý…Ñ•Èéì(€€€€€€€€€€€±åÁ è‹šÂÐˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹–¾KšÂÓ’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹–Bã–>[–n{–ú¤ƒ
Üƒ–Ã–Âƒ
ÜƒšÊïžf–ú§šÒìˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹–ó–ßžê3¢"«Žš:Ÿ–‚Ó¢"¦j+’ò7–n{–ú§¾òošRïšN+š*¢÷–>¿–Bã–>Y!C¢"MC¾ò3’â›šNšr'–Ã–ÂŽšÊïžf¢"–ú§šÒï¢÷–*oŽˆ°(€€€€€€€€€€€Ñ…Ìél‰!@½MC–Bã–>Xˆ°‹–Ã–Âš:Ÿ–‚Ðˆ°‹šÊïžf–ú§šÒì‰t(€€€€€€€ô°(€€€€€€€Ý¥¹éì(€€€€€€€€€€€±åÁ è‹¦Š ˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹žZû¦Š£’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹¦–ê›–æËšNøƒ
Üƒ–
ß–ºÏ–&+–òÄƒ
Üƒ¦Z¦ÿš:Ÿ–‚Ðˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹¦?¦;šV?š6ßš>C–6–ëš&/¦–ê›¾ò3’â›žRÇ–Â#–Æ³š*¢÷šZ÷–*ƒ–æËšNûŽ¦f7’ö;šV×šZç¢÷–*o¢"–
ß–ºÏ–>+šZ÷–*ƒšj#žr§Žˆ°(€€€€€€€€€€€Ñ…Ìél‹¦–ê›–æËšNøˆ°‹–Â#–Æ³š*¢ôˆ°‹šj#žr§¾ò?¦f7–
Ü‰t(€€€€€€€ô°(€€€€€€€•…ÉÑ éì(€€€€€€€€€€€±åÁ è‹–r|ˆ°(€€€€€€€€€€€Ñ¥Ñ±”è‹–:k–r’æ/¦Lˆ°(€€€€€€€€€€€É½±”è‹¢¶ßžnû¦bËžš˜ƒ
Üƒ¦f7¦bÈƒ
Üƒž~Ï–2[–>7–
Üˆ°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è‹¦7¢š[žR–¶c¢"¦j+’ò7¦bË¢¶ß¾ò3¢÷–îëž®/¢¶ßžnûŽ–>7–
ß¢"žÖCžV3¾ò3–B3šf’î—¦f7¦bË¢"ž~Ï–2[š:Ÿ–"ÛšV×šZçŽˆ°(€€€€€€€€€€€Ñ…Ìél‹¢¶ßžnû¦bË¢¶Üˆ°‹¦f7¦bËž~Ï–2Xˆ°‹–>7–
ßžÖCžV0‰t(€€€€€€€ô(€€€ôì((€€€±•ÐÍ•±•Ñ•‘•¹‘•Èô‰™•µ…±”ˆì(€€€±•ÐÍ•±•Ñ•‘É•…Ñ¥½¹MÑ•ÀôÄì((€€€™Õ¹Ñ¥½¸‰å%¡¥¥ì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å%¡¥¤ì(€€€ô((€€€™Õ¹Ñ¥½¸µ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¥ì(€€€€€€€½¹ÍÐÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€½¹ÍÐ½Ù•É±…äõ‰å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …Á…”ñð€…½Ù•É±…ä¥íÉ•ÑÕÉ¸¹Õ±°íô((€€€€€€€¥˜¡Á…”¹Á…É•¹Ñ±•µ•¹Ð„ôõ½Ù•É±…ä¥ì(€€€€€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡Á…”¤ì(€€€€€€€ô((€€€€€€€Á…”¹±…ÍÍ1¥ÍÐ¹…‘ ‰¹…Ñ¥Ù”µÉ•…Ñ¥½¸µÁ…”ˆ°‰…µ”µ¹…Ñ¥Ù”µÕ¤ˆ¤ì(€€€€€€€Á…”¹‘…Ñ…Í•Ð¹¹…Ñ¥Ù•]¥‘Ñ ôˆÄÀàÀˆì(€€€€€€€Á…”¹‘…Ñ…Í•Ð¹¹…Ñ¥Ù•!•¥¡ÐôˆÄäÈÀˆì(€€€€€€€Á…”¹‘…Ñ…Í•Ð¹¹…Ñ¥Ù•5¥É…Ñ¥½¸ô‰…ÑÕ…°µ‘¥µ•¹Í¥½¹Ìˆì((€€€€€€€l(€€€€€€€€€€€€‰±•™Ðˆ°‰Ñ½Àˆ°‰É¥¡Ðˆ°‰‰½ÑÑ½´ˆ°‰Ý¥‘Ñ ˆ°‰¡•¥¡Ðˆ°(€€€€€€€€€€€€‰µ¥¸µÝ¥‘Ñ ˆ°‰µ¥¸µ¡•¥¡Ðˆ°‰µ…àµÝ¥‘Ñ ˆ°‰µ…àµ¡•¥¡Ðˆ°(€€€€€€€€€€€€‰µ…É¥¸ˆ°‰ÑÉ…¹Í™½É´ˆ°‰ÑÉ…¹Í™½É´µ½É¥¥¸ˆ(€€€€€€€t¹™½É… ¡™Õ¹Ñ¥½¸¡ÁÉ½Á•ÉÑä¥ì(€€€€€€€€€€€Á…”¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä¡ÁÉ½Á•ÉÑä¤ì(€€€€€€€ô¤ì((€€€€€€€€¼¨Q¡¥Ì±…å•È½¹Ñ…¥¹Ì¥¹Ñ•É…Ñ¥Ù”¹…Ñ¥Ù”U$°Í¼¥Ð…¹¹½ÐÍÑ…ä(€€€€€€€€€€¡¥‘‘•¸™É½´…•ÍÍ¥‰¥±¥ÑäA%Ì¸A½¥¹Ñ•È½Ý¹•ÉÍ¡¥ÀÉ•µ…¥¹Ì½¸(€€€€€€€€€€€É•…Ñ¥½¹A…”ìÑ¡”½Ù•É±…ä¥ÑÍ•±˜ÍÑ¥±°ÕÍ•ÌÁ½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”¸€¨¼(€€€€€€€½Ù•É±…ä¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ¤ì(€€€€€€€É•ÑÕÉ¸Á…”ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•ÑÉ•…Ñ¥½¹Q½Õ¡5½‘”¡…Ñ¥Ù”¥ì(€€€€€€€½¹ÍÐ™¥á•‘9½‘•Ìõl(€€€€€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð°(€€€€€€€€€€€‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€€€€€‰å% ‰…µ”µÙ¥•ÝÁ½ÉÐˆ¤°(€€€€€€€€€€€‰å% ‰…µ”µÍÑ…”ˆ¤°(€€€€€€€€€€€‰å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤(€€€€€€€tì((€€€€€€€™¥á•‘9½‘•Ì¹™½É… ¡™Õ¹Ñ¥½¸¡¹½‘”¥ì(€€€€€€€€€€€¥˜¡¹½‘”¥ì(€€€€€€€€€€€€€€€¹½‘”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰É•…Ñ¥½¸µ™¥á•µ…Ñ¥Ù”ˆ°„……Ñ¥Ù”¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€™¥á•‘9½‘•Ì¹½¹…Ð¡‰å% ‰É•…Ñ¥½¹A…”ˆ¤¤¹™½É… ¡™Õ¹Ñ¥½¸¡¹½‘”¥ì(€€€€€€€€€€€€€€€¥˜¡¹½‘”¥ì(€€€€€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±Q½ÀôÀì(€€€€€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±1•™ÐôÀì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÑ…”õ‰å% ‰…µ”µÍÑ…”ˆ¤ì(€€€€€€€½¹ÍÐ…ÁÀõ‰å% ‰…ÁÀˆ¤ì((€€€€€€€¥˜¡ÍÑ…”¥ì(€€€€€€€€€€€ÍÑ…”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰É•…Ñ¥½¸µ¹…Ñ¥Ù”µ…Ñ¥Ù”ˆ°„……Ñ¥Ù”¤ì(€€€€€€€ô((€€€€€€€¥˜¡…ÁÀ¥ì(€€€€€€€€€€€…ÁÀ¹¥¹•ÉÐô„……Ñ¥Ù”ì(€€€€€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€€€€€…ÁÀ¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€…ÁÀ¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹ÍÉ½±±Q¼ À°À¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹É•…Ñ¥½¹Q½Õ¡5½‘” ¥ì(€€€€€€€½¹ÍÐÁ…”õµ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€€€€€½¹ÍÐÙ¥Í¥‰±”ô„…Á…”€˜˜Ý¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á…”¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆì(€€€€€€€Í•ÑÉ•…Ñ¥½¹Q½Õ¡5½‘”¡Ù¥Í¥‰±”¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹ÍÑ…±±É•…Ñ¥½¹•ÍÑÕÉ•1½¬ ¥ì(€€€€€€€½¹ÍÐÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€¥˜ …Á…”ñðÁ…”¹‘…Ñ…Í•Ð¹•ÍÑÕÉ•1½­I•…‘äôôô‰ÑÉÕ”ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€l‰Ñ½Õ¡µ½Ù”ˆ°‰Ý¡••°ˆ°‰•ÍÑÕÉ•ÍÑ…ÉÐˆ°‰•ÍÑÕÉ•¡…¹”ˆ°‰•ÍÑÕÉ••¹‰t¹™½É… ¡™Õ¹Ñ¥½¸¡•Ù•¹Ñ9…µ”¥ì(€€€€€€€€€€€Á…”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ù•¹Ñ9…µ”±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€€€€€ô±íÁ…ÍÍ¥Ù”é™…±Í•ô¤ì(€€€€€€€ô¤ì((€€€€€€€Á…”¹‘…Ñ…Í•Ð¹•ÍÑÕÉ•1½­I•…‘äô‰ÑÉÕ”ˆì(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±åÉ•…Ñ¥½¹MÑ•À¡ÍÑ•À¥ì(€€€€€€€½¹ÍÐÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•õ9Õµ‰•È¡ÍÑ•À¤ôôôÈüÈèÄì(€€€€€€€Í•±•Ñ•‘É•…Ñ¥½¹MÑ•Àõ¹½Éµ…±¥é•ì((€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆÉ•…Ñ¥½¹A…”m‘…Ñ„µÉ•…Ñ¥½¸µÍÑ•Átˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡Á…¹•°¥ì(€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”õ9Õµ‰•È¡Á…¹•°¹‘…Ñ…Í•Ð¹É•…Ñ¥½¹MÑ•À¤ôôõ¹½Éµ…±¥é•ì(€€€€€€€€€€€Á…¹•°¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ…Ñ¥Ù”ˆ±…Ñ¥Ù”¤ì(€€€€€€€€€€€Á…¹•°¹¡¥‘‘•¸ô……Ñ¥Ù”ì(€€€€€€€€€€€Á…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ±…Ñ¥Ù”ü‰™…±Í”ˆè‰ÑÉÕ”ˆ¤ì(€€€€€€€ô¤ì((€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆÉ•…Ñ¥½¹A…”m‘…Ñ„µÉ•…Ñ¥½¸µÍÑ•Àµ¥¹‘¥…Ñ½Étˆ¤¹™½É… ¡™Õ¹Ñ¥½¸¡¥¹‘¥…Ñ½È¥ì(€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”õ9Õµ‰•È¡¥¹‘¥…Ñ½È¹‘…Ñ…Í•Ð¹É•…Ñ¥½¹MÑ•Á%¹‘¥…Ñ½È¤ôôõ¹½Éµ…±¥é•ì(€€€€€€€€€€€¥¹‘¥…Ñ½È¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ…Ñ¥Ù”ˆ±…Ñ¥Ù”¤ì(€€€€€€€€€€€¥˜¡…Ñ¥Ù”¥ì(€€€€€€€€€€€€€€€¥¹‘¥…Ñ½È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µÕÉÉ•¹Ðˆ°‰ÍÑ•Àˆ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€¥¹‘¥…Ñ½È¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µÕÉÉ•¹Ðˆ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€¥˜¡Á…”¥ì(€€€€€€€€€€€Á…”¹‘…Ñ…Í•Ð¹ÍÑ•ÀõMÑÉ¥¹œ¡¹½Éµ…±¥é•¤ì(€€€€€€€€€€€Á…”¹ÍÉ½±±Q½ÀôÀì(€€€€€€€ô((€€€€€€€l‰…µ”µÙ¥•ÝÁ½ÉÐˆ°‰…µ”µÍÑ…”ˆ°‰…µ”µ½Ù•É±…äµ±…å•È‰t¹™½É… ¡™Õ¹Ñ¥½¸¡¥¥ì(€€€€€€€€€€€½¹ÍÐ¹½‘”õ‰å%¡¥¤ì(€€€€€€€€€€€¥˜¡¹½‘”¥ì(€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±Q½ÀôÀì(€€€€€€€€€€€€€€€¹½‘”¹ÍÉ½±±1•™ÐôÀì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€¥˜¡‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ð€˜˜ÑåÁ•½˜‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ð¹‰±ÕÈôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ð¹‰±ÕÈ ¤ì(€€€€€€€ô(€€€€€€€Ý¥¹‘½Ü¹ÍÉ½±±Q¼ À°À¤ì(€€€ô((€€€Ý¥¹‘½Ü¹Í•ÑÉ•…Ñ¥½¹MÑ•Àõ™Õ¹Ñ¥½¸¡ÍÑ•À¥ì(€€€€€€€…ÁÁ±åÉ•…Ñ¥½¹MÑ•À¡ÍÑ•À¤ì(€€€ôì((€€€™Õ¹Ñ¥½¸½É‘•É•‘M­¥±±Ì¡•±•µ•¹Ð±…Ñ•½Éä¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸mtì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸=‰©•Ð¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤(€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡¥¥íÉ•ÑÕÉ¸Í­¥±±…Ñ…‰…Í•m¥‘tíô¤(€€€€€€€€€€€€¹™¥±Ñ•È¡™Õ¹Ñ¥½¸¡Í­¥±°¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í­¥±°€˜˜Í­¥±°¹•±•µ•¹Ðôôõ•±•µ•¹Ð€˜˜Í­¥±°¹…Ñ•½Éäôôõ…Ñ•½Éäì(€€€€€€€€€€€ô¤(€€€€€€€€€€€€¹Í½ÉÐ¡™Õ¹Ñ¥½¸¡„±ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸9Õµ‰•È¡„¹Ñ¥•Éñðää¤µ9Õµ‰•È¡ˆ¹Ñ¥•Éñðää¤ì(€€€€€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÁ•¥…±M­¥±±Ì¡•±•µ•¹Ð¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸mtì(€€€€€€€ô(€€€€€€€½¹ÍÐ½É‘•Èõí‰Õ™˜èÄ±¡•…°èÈ±É•Ù¥Ù”èÌ±Á…ÍÍ¥Ù”èÑôì(€€€€€€€É•ÑÕÉ¸=‰©•Ð¹­•åÌ¡Í­¥±±…Ñ…‰…Í”¤(€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡¥¥íÉ•ÑÕÉ¸Í­¥±±…Ñ…‰…Í•m¥‘tíô¤(€€€€€€€€€€€€¹™¥±Ñ•È¡™Õ¹Ñ¥½¸¡Í­¥±°¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í­¥±°€˜˜Í­¥±°¹•±•µ•¹Ðôôõ•±•µ•¹Ð€˜˜½É‘•ÉmÍ­¥±°¹…Ñ•½Éåtì(€€€€€€€€€€€ô¤(€€€€€€€€€€€€¹Í½ÉÐ¡™Õ¹Ñ¥½¸¡„±ˆ¥ì(€€€€€€€€€€€€€€€½¹ÍÐ…Ðô¡½É‘•Ém„¹…Ñ•½Éåuñðää¤´¡½É‘•Émˆ¹…Ñ•½Éåuñðää¤ì(€€€€€€€€€€€€€€€¥˜¡…Ð„ôôÀ¥íÉ•ÑÕÉ¸…Ðíô(€€€€€€€€€€€€€€€É•ÑÕÉ¸9Õµ‰•È¡„¹Ñ¥•Éñðää¤µ9Õµ‰•È¡ˆ¹Ñ¥•Éñðää¤ì(€€€€€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉM­¥±±¡¥ÁÌ¡½¹Ñ…¥¹•É%±Í­¥±±Ì¥ì(€€€€€€€½¹ÍÐ‰½àõ‰å%¡½¹Ñ…¥¹•É%¤ì(€€€€€€€¥˜ …‰½à¥íÉ•ÑÕÉ¸íô(€€€€€€€‰½à¹¥¹¹•É!Q50ôˆˆì(€€€€€€€Í­¥±±Ì¹™½É… ¡™Õ¹Ñ¥½¸¡Í­¥±°±¥¹‘•à¥ì(€€€€€€€€€€€½¹ÍÐ¡¥Àõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‰ÕÑÑ½¸ˆ¤ì(€€€€€€€€€€€¡¥À¹ÑåÁ”ô‰‰ÕÑÑ½¸ˆì(€€€€€€€€€€€¡¥À¹±…ÍÍ9…µ”ô‰É•…Ñ¥½¸µÍ­¥±°µ¡¥Àˆ¬¡¥¹‘•àôôõÍ­¥±±Ì¹±•¹Ñ ´ÄüˆÍ¥¹…ÑÕÉ”ˆèˆˆ¤ì(€€€€€€€€€€€¡¥À¹‘…Ñ…Í•Ð¹Í­¥±±%õÍ­¥±°¹¥ì(€€€€€€€€€€€¡¥À¹Ñ•áÑ½¹Ñ•¹ÐõÍ­¥±°¹¹…µ”ì(€€€€€€€€€€€¡¥À¹Ñ¥Ñ±”õÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ññÍ­¥±°¹¹…µ”ì(€€€€€€€€€€€¡¥À¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡…ÍÁ½ÁÕÀˆ°‰‘¥…±½œˆ¤ì(€€€€€€€€€€€¡¥À¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ±Í­¥±°¹¹…µ”¬‹¾ò3¦î{šN+š~—žr/¢¦ÏžÒÃ’î/žÒäˆ¤ì(€€€€€€€€€€€¡¥À¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹Í¡½ÝÉ•…Ñ¥½¹M­¥±±•Ñ…¥°¡Í­¥±°¹¥¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€‰½à¹…ÁÁ•¹‘¡¥±¡¡¥À¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•Í…Á•!Q50¡Ù…±Õ”¥ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ôôõÕ¹‘•™¥¹•‘ññÙ…±Õ”ôôõ¹Õ±°üˆˆéÙ…±Õ”¤(€€€€€€€€€€€€¹É•Á±…” ¼˜½œ°ˆ™…µÀìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ð½œ°ˆ™±Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ø½œ°ˆ™Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ˆ½œ°ˆ™ÅÕ½Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼œ½œ°ˆ˜ŒÌäìˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Ù…±Õ•Ñ1•Ù•°¡Ù…±Õ•Ì±±•Ù•°¥ì(€€€€€€€¥˜ …ÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ•Ì¤ñðÙ…±Õ•Ì¹±•¹Ñ ðÄ¥ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸Ù…±Õ•Ím5…Ñ ¹µ¥¸¡±•Ù•°´Ä±Ù…±Õ•Ì¹±•¹Ñ ´Ä¥tì(€€€ô((€€€™Õ¹Ñ¥½¸É•…Ñ¥½¹M­¥±±…Ñ•½Éå1…‰•°¡…Ñ•½Éä¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜•ÑM­¥±±…Ñ•½Éå1…‰•°ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸•ÑM­¥±±…Ñ•½Éå1…‰•°¡…Ñ•½Éä¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€€€€€½¹ÍÐ±…‰•±Ìõì(€€€€€€€€€€€Á¡åÍ¥…°è‹ž&§žBˆ°(€€€€€€€€€€€µ…¥Œè‹šÎW¢†Lˆ°(€€€€€€€€€€€‰Õ™˜è‹–Š{žn(ˆ°(€€€€€€€€€€€¡•…°è‹–n{–ú¤ˆ°(€€€€€€€€€€€É•Ù¥Ù”è‹–ú§šÒìˆ°(€€€€€€€€€€€Á…ÍÍ¥Ù”è‹¢Š¯–.Tˆ(€€€€€€€ôì(€€€€€€€É•ÑÕÉ¸±…‰•±Ím…Ñ•½Éåuñð‹š*¢ôˆì(€€€ô((€€€™Õ¹Ñ¥½¸É•…Ñ¥½¹M­¥±±Q…É•Ñ1…‰•°¡Ñ…É•ÑQåÁ”¥ì(€€€€€€€½¹ÍÐ±…‰•±Ìõì(€€€€€€€€€€€Í¥¹±”è‹–Z»¦®SšV×’êèˆ°(€€€€€€€€€€€ÑÉ¤è‹–B3š¦¯š:Kšr–’hÏ–B7šV×’êèˆ°(€€€€€€€€€€€É½Üè‹’îï’âšV×šZçš¦¯š:Hˆ°(€€€€€€€€€€€…±°è‹šV×šZç–£¦®Pˆ°(€€€€€€€€€€€…±±äè‹–Z»’â–>/šZäˆ°(€€€€€€€€€€€…±±å±°è‹š"GšZç–£¦®Pˆ°(€€€€€€€€€€€‘•…‘±±äè‹š¶ï’ê‡–>/šZäˆ°(€€€€€€€€€€€¹½¹”è‹šÂã’æ¢Š¯–.Tˆ(€€€€€€€ôì(€€€€€€€É•ÑÕÉ¸±…‰•±ÍmÑ…É•ÑQåÁ•uñð‹’úwš*¢÷¢š?–&ˆì(€€€ô((€€€™Õ¹Ñ¥½¸Í­¥±±1•Ù•±A…ÉÑÌ¡Í­¥±°±±•Ù•°¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõmtì((€€€€€€€¥˜ (€€€€€€€€€€€€¡Í­¥±°¹…Ñ•½Éäôôô‰Á¡åÍ¥…°ˆñðÍ­¥±°¹…Ñ•½Éäôôô‰µ…¥Œˆ¤€˜˜(€€€€€€€€€€€Í­¥±°¹‰…Í•…µ…”„ôõÕ¹‘•™¥¹•(€€€€€€€€¥ì(€€€€€€€€€€€±•Ð‘…µ…”õ9Õµ‰•È¡Í­¥±°¹‰…Í•…µ…•ñðÀ¤­9Õµ‰•È¡Í­¥±°¹‘…µ…•A•É1•Ù•±ñðÀ¤¨¡±•Ù•°´Ä¤ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜•ÑM­¥±±…µ…•Ñ1•Ù•°ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€€€€€‘…µ…”õ•ÑM­¥±±…µ…•Ñ1•Ù•°¡Í­¥±°±±•Ù•°¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–
ß–ºÌˆ­5…Ñ ¹™±½½È¡‘…µ…”¤¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹‘…µ…•A•É1•Ù•°€ü€‹¾ò#š¾?žÒh¬ˆ­Í­¥±°¹‘…µ…•A•É1•Ù•°¬‹¾ò$ˆ€è€ˆˆ¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‰ÕÉ¹A•É•¹ÐõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹‰ÕÉ¹A•É•¹Ñ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í­¥±°¹‰ÕÉ¹¡…¹”„ôõÕ¹‘•™¥¹•€˜˜‰ÕÉ¹A•É•¹Ð„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‰ÕÉ¹¡…¹”¬ˆ—š¦ž:žžHˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹‰ÕÉ¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò3š¾?–n{–B#¦ƒš"Cšr–’!@€ˆ¬(€€€€€€€€€€€€€€€‰ÕÉ¹A•É•¹Ð¬ˆ—–
ß–ºÌˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜¡Í­¥±°¹™É••é•¡…¹”„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹™É••é•¡…¹”¬ˆ—š¦ž:–Ã–Âˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹™É••é•ÕÉ…Ñ¥½¹ñðÄ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ±¥™•ÍÑ•…°õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹±¥™•ÍÑ•…±A•É•¹Ñ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡±¥™•ÍÑ•…°„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–Bã–>[–
ß–ºÌˆ­±¥™•ÍÑ•…°¬ˆ—¾ò3ž¶'¦?–n{–ú§¢«¢ê­!C¢"M@ˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ…¥±¥Ñå½Ý¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹…¥±¥Ñå½Ý¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡…¥±¥Ñå½Ý¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹…¥±¥Ñå½Ý¹¡…¹”¬ˆ—š¦ž:¦f7’ö;šV?š6Üˆ¬(€€€€€€€€€€€€€€€…¥±¥Ñå½Ý¸¬ˆ—¾ò3š2žê0ˆ¬¡Í­¥±°¹…¥±¥Ñå½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÑ…Ñ½Ý¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹ÍÑ…Ñ½Ý¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡ÍÑ…Ñ½Ý¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹ÍÑ…Ñ½Ý¹¡…¹”¬ˆ—š¦ž:¦f7’ö;š&šr'¢÷–*lˆ¬(€€€€€€€€€€€€€€€ÍÑ…Ñ½Ý¸¬ˆ—¾ò3š2žê0ˆ¬¡Í­¥±°¹ÍÑ…Ñ½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‘…µ…•½Ý¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹‘…µ…•½Ý¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡‘…µ…•½Ý¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‘…µ…•½Ý¹¡…¹”¬ˆ—š¦ž:¦f7’ö;¦ƒš"C–
ß–ºÌˆ¬(€€€€€€€€€€€€€€€‘…µ…•½Ý¸¬ˆ—¾ò3š2žê0ˆ¬¡Í­¥±°¹‘…µ…•½Ý¹ÕÉ…Ñ¥½¹ñðÄ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‘•™•¹Í•½Ý¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹‘•™•¹Í•½Ý¹	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡‘•™•¹Í•½Ý¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹‘•™•¹Í•½Ý¹¡…¹”¬ˆ—š¦ž:¦f7’ö;¦bËžš˜ˆ¬(€€€€€€€€€€€€€€€‘•™•¹Í•½Ý¸¬ˆ—¾ò3š2žê0ˆ¬¡Í­¥±°¹‘•™•¹Í•½Ý¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ™¥¹…±!¥Ñ¡…¹•½Ý¸õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹µ¥ÍÍ	½¹ÕÍ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡™¥¹…±!¥Ñ¡…¹•½Ý¸„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Í­¥±°¹ÍÑÕ¹¡…¹”¬ˆ—š¦ž:šj#žr¤ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹ÍÑÕ¹ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B#¾ò3šržÖ–F÷’â·ž:¦f7’ö8ˆ­™¥¹…±!¥Ñ¡…¹•½Ý¸¬ˆ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÁ•ÑÉ¥™å¡…¹”õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹Á•ÑÉ¥™å¡…¹•	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Á•ÑÉ¥™å¡…¹”„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€Á•ÑÉ¥™å¡…¹”¬ˆ—š¦ž:ž~Ï–2Xˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹Á•ÑÉ¥™åÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍ•±™M¡¥•±õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹Í•±™M¡¥•±‘	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í•±™M¡¥•±„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹¢«¢ê¯¢¶ßžnøˆ­Í•±™M¡¥•±¬‹¦î{¾ò3š2žê0ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ…±±åM¡¥•±õÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹…±±åM¡¥•±‘	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡…±±åM¡¥•±„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹š"GšZç–£¦®S¢¶ßžnøˆ­…±±åM¡¥•±¬‹¦î{¾ò3š2žê0ˆ¬(€€€€€€€€€€€€€€€€¡Í­¥±°¹Í¡¥•±‘ÕÉ…Ñ¥½¹ñðÈ¤¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÉ¥Ñ	½¹ÕÌõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹É¥Ñ	½¹ÕÍ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜É¥Ñ	½¹ÕÌ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹š"GšZçž"šN+ž:¢"ž"šN+–
ß–ºÌ€¬ˆ­É¥Ñ	½¹ÕÌ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹¦Z¢êËž:€¬ˆ­Í­¥±°¹•Ù…Í¥½¹	½¹ÕÍA•É•¹Ð¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹¦bËžš›–*l€¬ˆ­Í­¥±°¹‘•™•¹Í•	½¹ÕÍA•É•¹Ð¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹É•™±•ÑA•É•¹Ð„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–>7–
Ü€ˆ­Í­¥±°¹É•™±•ÑA•É•¹Ð¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ€˜˜Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹žVÃ–âãž.š/š*_šœ€¬ˆ­Í­¥±°¹ÍÑ…ÑÕÍI•Í¥ÍÑ	½¹ÕÌ¬(€€€€€€€€€€€€€€€€ˆ—¾ò3š2žê0ˆ­Í­¥±°¹‘ÕÉ…Ñ¥½¸¬‹–n{–B ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰‰Õ™˜ˆ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸¤ì(€€€€€€€ô((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰¡•…°ˆ¥ì(€€€€€€€€€€€±•Ð¡Á½•™™¥¥•¹ÐôÄ¸ÈÔì(€€€€€€€€€€€±•ÐÍÁ½•™™¥¥•¹Ðô¸Ôì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜!1%9}%9Q}=%%9P„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€€€€€¡Á½•™™¥¥•¹Ðõ!1%9}%9Q}=%%9Pì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜MA}!1%9}%9Q}=%%9P„ôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€€€€€€€€€ÍÁ½•™™¥¥•¹ÐõMA}!1%9}%9Q}=%%9Pì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€€€€€€€€€½¹ÍÐ¡Á	…Í”õ9Õµ‰•È¡Í­¥±°¹‰…Í•!•…±ñðÀ¤­9Õµ‰•È¡Í­¥±°¹¡•…±A•É1•Ù•±ñðÀ¤¨¡±•Ù•°´Ä¤ì(€€€€€€€€€€€½¹ÍÐÍÁ	…Í”õ9Õµ‰•È¡Í­¥±°¹‰…Í•!•…±MAñðÀ¤­9Õµ‰•È¡Í­¥±°¹¡•…±MAA•É1•Ù•±ñðÀ¤¨¡±•Ù•°´Ä¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–n{–ú¥!C¾òk–~ëž’8ˆ­¡Á	…Í”¬‹¾ò/šfë–*o\ˆ­¡Á½•™™¥¥•¹Ð¬(€€€€€€€€€€€€€€€€‹¾òo–n{–ú¥MC¾òk–~ëž’8ˆ­ÍÁ	…Í”¬‹¾ò/šfë–*o\ˆ­ÍÁ½•™™¥¥•¹Ð¬(€€€€€€€€€€€€€€€€‹¾ò#šZ÷šRû¢šr³’êë’â7–n{–ú¥MC¾ò$ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÉ•Ù¥Ù•A•É•¹ÐõÙ…±Õ•Ñ1•Ù•°¡Í­¥±°¹É•Ù¥Ù•!•…±A•É•¹Ñ	å1•Ù•°±±•Ù•°¤ì(€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰É•Ù¥Ù”ˆ€˜˜É•Ù¥Ù•A•É•¹Ð„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  ‹–ú§šÒï’â›š‹–ú¤ˆ­É•Ù¥Ù•A•É•¹Ð¬ˆ—šr–’!@ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¸¤ì(€€€€€€€ô((€€€€€€€¥˜¡Á…ÉÑÌ¹±•¹Ñ ðÄ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ ¡Í­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ñð‹’úwš*¢÷¢ª«šb;žRšV#Žˆ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÉÉ…ä¹™É½´¡¹•ÜM•Ð¡Á…ÉÑÌ¹™¥±Ñ•È¡	½½±•…¸¤¤¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‰Õ¥±‘É•…Ñ¥½¹M­¥±±1•Ù•±I½ÝÌ¡Í­¥±°¥ì(€€€€€€€½¹ÍÐµ…á1•Ù•°õ5…Ñ ¹µ…à Ä±9Õµ‰•È¡Í­¥±°¹µ…á1•Ù•°¥ñðÄ¤ì(€€€€€€€½¹ÍÐÉ½ÝÌõmtì((€€€€€€€™½È¡±•Ð±•Ù•°ôÄí±•Ù•°ðõµ…á1•Ù•°í±•Ù•°¬¬¥ì(€€€€€€€€€€€½¹ÍÐ‘•Ñ…¥±ÌõÍ­¥±±1•Ù•±A…ÉÑÌ¡Í­¥±°±±•Ù•°¤ì(€€€€€€€€€€€É½ÝÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±•Ù•°µÉ½Üˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñˆù1Ø¸œ­±•Ù•°¬œð½ˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñÍÁ…¸øœ­‘•Ñ…¥±Ì¹µ…À¡•Í…Á•!Q50¤¹©½¥¸ ‹¾öpˆ¤¬œð½ÍÁ…¸øœ¬(€€€€€€€€€€€€€€€€œð½‘¥Øøœ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸É½ÝÌ¹©½¥¸ ˆˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…° ¥ì(€€€€€€€±•Ðµ½‘…°õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆ¤ì(€€€€€€€¥˜¡µ½‘…°¥ì(€€€€€€€€€€€É•ÑÕÉ¸µ½‘…°ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½Ù•É±…äõ‰å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤ì(€€€€€€€¥˜ …½Ù•É±…ä¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô((€€€€€€€µ½‘…°õ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰‘¥Øˆ¤ì(€€€€€€€µ½‘…°¹¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰É½±”ˆ°‰‘¥…±½œˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µµ½‘…°ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•±±•‘‰äˆ°‰É•…Ñ¥½¹M­¥±±•Ñ…¥±9…µ”ˆ¤ì(€€€€€€€µ½‘…°¹¥¹¹•É!Q50ô(€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ‰½àˆøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ¡•…‘•Èˆøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±åÁ ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±åÁ ˆûš* ð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ¡•…‘¥¹œˆøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±9…µ”ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ¹…µ”ˆûš*¢÷’î/žÒäð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±A…Ñ ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÁ…Ñ ˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±`ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µàˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ…É¥„µ±…‰•°ô‹¦^s¦Z'š*¢÷’î/žÒäˆû\ð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€€€€€œð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±Q…Ìˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÑ…Ìˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±•ÍÉ¥ÁÑ¥½¸ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ‘•ÍÉ¥ÁÑ¥½¸ˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5•Ñ„ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µµ•Ñ„ˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÍ•Ñ¥½¸µÑ¥Ñ±”ˆû–Bž¶'žÒkšVã–ðð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‘¥Ø¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±1•Ù•±Ìˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±•Ù•±Ìˆøð½‘¥Øøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸¥ô‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±½Í”ˆ±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ±½Í”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆû¦^s¦Z$ð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½‘¥Øøœì((€€€€€€€½Ù•É±…ä¹…ÁÁ•¹‘¡¥±¡µ½‘…°¤ì((€€€€€€€µ½‘…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€€€€€¥˜¡•Ù•¹Ð¹Ñ…É•Ðôôõµ½‘…°¥ì(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥° ¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±`ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±Ý¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥°¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±½Í”ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±Ý¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥°¤ì(€€€€€€€É•ÑÕÉ¸µ½‘…°ì(€€€ô((€€€±•ÐÉ•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌõ¹Õ±°ì((€€€Ý¥¹‘½Ü¹Í¡½ÝÉ•…Ñ¥½¹M­¥±±•Ñ…¥°õ™Õ¹Ñ¥½¸¡Í­¥±±%¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Í­¥±±…Ñ…‰…Í”ôôô‰Õ¹‘•™¥¹•ˆ¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍ­¥±°õÍ­¥±±…Ñ…‰…Í•mÍ­¥±±%‘tì(€€€€€€€½¹ÍÐµ½‘…°õ•¹ÍÕÉ•É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…° ¤ì(€€€€€€€½¹ÍÐÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€¥˜ …Í­¥±°ñð€…µ½‘…°ñð€…Á…”¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€É•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌõ‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ðì(€€€€€€€µ½‘…°¹‘…Ñ…Í•Ð¹•±•µ•¹ÐõÍ­¥±°¹•±•µ•¹Ññð‰™¥É”ˆì((€€€€€€€½¹ÍÐ•±•µ•¹Ñ1…‰•±Ìõí™¥É”è‹ž¬ˆ±Ý…Ñ•Èè‹šÂÐˆ±Ý¥¹è‹¦Š ˆ±•…ÉÑ è‹–r|‰ôì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±±åÁ ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõ•±•µ•¹Ñ1…‰•±ÍmÍ­¥±°¹•±•µ•¹Ñuñð‹š* ˆì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±9…µ”ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÍ­¥±°¹¹…µ”ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±A…Ñ ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðô(€€€€€€€€€€€€¡•±•µ•¹Ñ1…‰•±ÍmÍ­¥±°¹•±•µ•¹Ñuñð‹–žÒ€ˆ¤¬‹žÎìƒ
Ü€ˆ¬(€€€€€€€€€€€É•…Ñ¥½¹M­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±•ÍÉ¥ÁÑ¥½¸ˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÍ­¥±°¹‘•ÍÉ¥ÁÑ¥½¹ñðˆˆì((€€€€€€€½¹ÍÐÑ…Ìõl(€€€€€€€€€€€É•…Ñ¥½¹M­¥±±…Ñ•½Éå1…‰•°¡Í­¥±°¹…Ñ•½Éä¤°(€€€€€€€€€€€É•…Ñ¥½¹M­¥±±Q…É•Ñ1…‰•°¡Í­¥±°¹Ñ…É•ÑQåÁ”¤°(€€€€€€€€€€€€‹šr¦®`1Ø¸ˆ¬¡Í­¥±°¹µ…á1•Ù•±ñðÄ¤(€€€€€€€tì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±Q…Ìˆ¤¹¥¹¹•É!Q50õÑ…Ì(€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡Ñ•áÐ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€œñÍÁ…¸±…ÍÌô‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µÑ…œˆøœ­•Í…Á•!Q50¡Ñ•áÐ¤¬œð½ÍÁ…¸øœì(€€€€€€€€€€€ô¤(€€€€€€€€€€€€¹©½¥¸ ˆˆ¤ì((€€€€€€€½¹ÍÐµ•Ñ„õmtì(€€€€€€€½¹ÍÐÍÁ½ÍÐõÍ­¥±°¹ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•ýÍ­¥±°¹ÍÁ½ÍÐéÍ­¥±°¹½ÍÐì(€€€€€€€¥˜¡Í­¥±°¹…Ñ•½Éäôôô‰Á…ÍÍ¥Ù”ˆ¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  ‹¢Š¯–.Wš*¢÷¾ò3’â7žR£¢Žw–
g¾ò3–¶ãžþK–ú3šÂã’æžRšV ˆ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜¡ÍÁ½ÍÐ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  ‹šÚ#¢\€ˆ­ÍÁ½ÍÐ¬ˆM@ˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡Í­¥±°¹±•…É¹½ÍÐ„ôõÕ¹‘•™¥¹•¥ì(€€€€€€€€€€€½¹ÍÐ‰…Í•1•…É¹½ÍÐõÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÍ•Ñ%¹¥Ñ¥…±1•…É¹½ÍÐôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€ýÝ¥¹‘½Ü¹ØÄÜÍ•Ñ%¹¥Ñ¥…±1•…É¹½ÍÐ¡¹Õ±°±Í­¥±°¤(€€€€€€€€€€€€€€€€éÍ­¥±°¹±•…É¹½ÍÐì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  ‹–¶ãžþK¦r¢š€ˆ­‰…Í•1•…É¹½ÍÐ¬ˆƒš*¢÷¦îxˆ¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÉÉ…ä¹¥ÍÉÉ…ä¡Í­¥±°¹É•ÅÕ¥É•Ì¤€˜˜Í­¥±°¹É•ÅÕ¥É•Ì¹±•¹Ñ ¥ì(€€€€€€€€€€€µ•Ñ„¹ÁÕÍ  (€€€€€€€€€€€€€€€€‹–&7žö»š*¢÷¾òhˆ­Í­¥±°¹É•ÅÕ¥É•Ì(€€€€€€€€€€€€€€€€€€€€¹µ…À¡™Õ¹Ñ¥½¸¡¥¥ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í­¥±±…Ñ…‰…Í•m¥‘týÍ­¥±±…Ñ…‰…Í•m¥‘t¹¹…µ”é¥ì(€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€€€€€¹©½¥¸ ‹Žˆ¤(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5•Ñ„ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõµ•Ñ„¹©½¥¸ ‹¾öpˆ¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±1•Ù•±Ìˆ¤¹¥¹¹•É!Q50õ‰Õ¥±‘É•…Ñ¥½¹M­¥±±1•Ù•±I½ÝÌ¡Í­¥±°¤ì(€€€€€€€‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±1•Ù•±Ìˆ¤¹ÍÉ½±±Q½ÀôÀì((€€€€€€€Á…”¹±…ÍÍ1¥ÍÐ¹…‘ ‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ½Á•¸ˆ¤ì(€€€€€€€Á…”¹¥¹•ÉÐõÑÉÕ”ì(€€€€€€€Á…”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰™…±Í”ˆ¤ì((€€€€€€€Ý¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€½¹ÍÐ±½Í•	ÕÑÑ½¸õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±`ˆ¤ì(€€€€€€€€€€€¥˜¡±½Í•	ÕÑÑ½¸¥ì(€€€€€€€€€€€€€€€±½Í•	ÕÑÑ½¸¹™½ÕÌ¡íÁÉ•Ù•¹ÑMÉ½±°éÑÉÕ•ô¤ì(€€€€€€€€€€€ô(€€€€€€€ô°À¤ì(€€€ôì((€€€Ý¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥°õ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍÐµ½‘…°õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆ¤ì(€€€€€€€½¹ÍÐÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì((€€€€€€€¥˜¡µ½‘…°¥ì(€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€€€€€€€€€µ½‘…°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°‰ÑÉÕ”ˆ¤ì(€€€€€€€ô((€€€€€€€¥˜¡Á…”¥ì(€€€€€€€€€€€Á…”¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰É•…Ñ¥½¸µÍ­¥±°µ‘•Ñ…¥°µ½Á•¸ˆ¤ì(€€€€€€€€€€€Á…”¹¥¹•ÉÐõ™…±Í”ì(€€€€€€€€€€€Á…”¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ™½ÕÍQ…É•ÐõÉ•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌì(€€€€€€€É•…Ñ¥½¹M­¥±±•Ñ…¥±I•ÑÕÉ¹½ÕÌõ¹Õ±°ì(€€€€€€€Ý¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€™½ÕÍQ…É•Ð€˜˜(€€€€€€€€€€€€€€€™½ÕÍQ…É•Ð¹¥Í½¹¹•Ñ•€˜˜(€€€€€€€€€€€€€€€Á…”€˜˜(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á…”¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆ(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€™½ÕÍQ…É•Ð¹™½ÕÌ¡íÁÉ•Ù•¹ÑMÉ½±°éÑÉÕ•ô¤ì(€€€€€€€€€€€ô(€€€€€€€ô°À¤ì(€€€ôì((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ±™Õ¹Ñ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐµ½‘…°õ‰å% ‰É•…Ñ¥½¹M­¥±±•Ñ…¥±5½‘…°ˆ¤ì(€€€€€€€¥˜¡•Ù•¹Ð¹­•äôôô‰Í…Á”ˆ€˜˜µ½‘…°€˜˜µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ì(€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€€€€€Ý¥¹‘½Ü¹±½Í•É•…Ñ¥½¹M­¥±±•Ñ…¥° ¤ì(€€€€€€€ô(€€€ô¤ì((€€€™Õ¹Ñ¥½¸É•¹‘•ÉÉ•…Ñ¥½¹M¡½Ý…Í”¡•±•µ•¹Ð¥ì(€€€€€€€½¹ÍÐÁ…”õ‰å% ‰É•…Ñ¥½¹A…”ˆ¤ì(€€€€€€€¥˜ …Á…”¥íÉ•ÑÕÉ¸íô((€€€€€€€½¹ÍÐ¡½Í•¸õ5Qm•±•µ•¹Ñtý•±•µ•¹Ðè‰™¥É”ˆì(€€€€€€€½¹ÍÐµ•Ñ„õ5Qm¡½Í•¹tì(€€€€€€€Á…”¹‘…Ñ…Í•Ð¹•±•µ•¹Ðõ¡½Í•¸ì(€€€€€€€Á…”¹‘…Ñ…Í•Ð¹•¹‘•ÈõÍ•±•Ñ•‘•¹‘•Èì((€€€€€€€½¹ÍÐÁ½ÉÑÉ…¥Ðõ‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ðˆ¤ì(€€€€€€€¥˜¡Á½ÉÑÉ…¥Ð¥ì(€€€€€€€€€€€Á½ÉÑÉ…¥Ð¹ÍÉŒõA=IQI%QMmÍ•±•Ñ•‘•¹‘•Éum¡½Í•¹tì(€€€€€€€€€€€Á½ÉÑÉ…¥Ð¹…±Ðô¡¡½Í•¸ôôô‰™¥É”ˆü‹ž¬ˆé¡½Í•¸ôôô‰Ý…Ñ•Èˆü‹šÂÐˆé¡½Í•¸ôôô‰Ý¥¹ˆü‹¦Š ˆè‹–r|ˆ¤¬(€€€€€€€€€€€€€€€€‹–žÒ€ˆ¬¡Í•±•Ñ•‘•¹‘•Èôôô‰µ…±”ˆü‹žRßšœˆè‹––Ïšœˆ¤¬‹¢žK¢&Ëž®/žæ¨ˆì(€€€€€€€ô((€€€€€€€½¹ÍÐ±…‰•±5…Àõí™¥É”è‹ž¯–žÒ€ˆ±Ý…Ñ•Èè‹šÂÓ–žÒ€ˆ±Ý¥¹è‹¦Š£–žÒ€ˆ±•…ÉÑ è‹–r–žÒ€‰ôì(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ±•µ•¹Ðˆ¤¥í‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ±•µ•¹Ðˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõ±…‰•±5…Ám¡½Í•¹tíô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ•¹‘•Èˆ¤¥í‰å% ‰É•…Ñ¥½¹A½ÉÑÉ…¥Ñ•¹‘•Èˆ¤¹Ñ•áÑ½¹Ñ•¹ÐõÍ•±•Ñ•‘•¹‘•Èôôô‰µ…±”ˆü‹–ÂG’þ€ˆè‹––Ï’þ€ˆíô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ	…‘”ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ	…‘”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõµ•Ñ„¹±åÁ íô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹ÑQ¥Ñ±”ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹ÑQ¥Ñ±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõµ•Ñ„¹Ñ¥Ñ±”íô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹ÑI½±”ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹ÑI½±”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõµ•Ñ„¹É½±”íô(€€€€€€€¥˜¡‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ•ÍÉ¥ÁÑ¥½¸ˆ¤¥í‰å% ‰É•…Ñ¥½¹±•µ•¹Ñ•ÍÉ¥ÁÑ¥½¸ˆ¤¹Ñ•áÑ½¹Ñ•¹Ðõµ•Ñ„¹‘•ÍÉ¥ÁÑ¥½¸íô((€€€€€€€½¹ÍÐÑ…Ìõ‰å% ‰É•…Ñ¥½¹±•µ•¹ÑQ…Ìˆ¤ì(€€€€€€€¥˜¡Ñ…Ì¥ì(€€€€€€€€€€€Ñ…Ì¹¥¹¹•É!Q50ôˆˆì(€€€€€€€€€€€µ•Ñ„¹Ñ…Ì¹™½É… ¡™Õ¹Ñ¥½¸¡Ñ•áÐ¥ì(€€€€€€€€€€€€€€€½¹ÍÐÑ…œõ‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€€€€€€€€€Ñ…œ¹±…ÍÍ9…µ”ô‰É•…Ñ¥½¸µÉ½±”µÑ…œˆì(€€€€€€€€€€€€€€€Ñ…œ¹Ñ•áÑ½¹Ñ•¹ÐõÑ•áÐì(€€€€€€€€€€€€€€€Ñ…Ì¹…ÁÁ•¹‘¡¥±¡Ñ…œ¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€ô((€€€Ý¥¹‘½Ü¹Í•±•ÑÉ•…Ñ¥½¹•¹‘•Èõ™Õ¹Ñ¥½¸¡•¹‘•È¥ì(€€€€€€€Í•±•Ñ•‘•¹‘•Èõ•¹‘•Èôôô‰µ…±”ˆü‰µ…±”ˆè‰™•µ…±”ˆì((€€€€€€€½¹ÍÐ™•µ…±”õ‰å% ‰É•…Ñ¥½¹•¹‘•É•µ…±”ˆ¤ì(€€€€€€€½¹ÍÐµ…±”õ‰å% ‰É•…Ñ¥½¹•¹‘•É5…±”ˆ¤ì(€€€€€€€¥˜¡™•µ…±”¥í™•µ…±”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰Í•±•Ñ•ˆ±Í•±•Ñ•‘•¹‘•Èôôô‰™•µ…±”ˆ¤íô(€€€€€€€¥˜¡µ…±”¥íµ…±”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰Í•±•Ñ•ˆ±Í•±•Ñ•‘•¹‘•Èôôô‰µ…±”ˆ¤íô((€€€€€€€±•Ð•±•µ•¹Ðô‰™¥É”ˆì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜Í•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ð„ôô‰Õ¹‘•™¥¹•ˆ€˜˜5QmÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ñt¥ì(€€€€€€€€€€€€€€€•±•µ•¹ÐõÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ðì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô(€€€€€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½Ý…Í”¡•±•µ•¹Ð¤ì(€€€ôì((€€€€¼¨-••À½¹”Í½ÕÉ”½˜ÑÉÕÑ ™½È•±•µ•¹Ðµ•¡…¹¥ÌèÕÍ”Ñ¡”•á¥ÍÑ¥¹œÍ•±•Ñ±•µ•¹Ð ¤¸(€€€€€€Q¡¥ÌÝÉ…ÁÁ•È½¹±ä…‘‘ÌÑ¡”¹•ÜÉ•…Ñ¥½¸µÁ…”Ù¥ÍÕ…°É•™É•Í ¸€¨¼(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹Í•±•Ñ±•µ•¹Ðôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€½¹ÍÐ½É¥¥¹…±M•±•Ñ±•µ•¹ÐõÝ¥¹‘½Ü¹Í•±•Ñ±•µ•¹Ðì(€€€€€€€Ý¥¹‘½Ü¹Í•±•Ñ±•µ•¹Ðõ™Õ¹Ñ¥½¸¡•±•µ•¹Ð¥ì(€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ðõ½É¥¥¹…±M•±•Ñ±•µ•¹Ð¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€€€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½Ý…Í”¡•±•µ•¹Ð¤ì(€€€€€€€€€€€É•ÑÕÉ¸É•ÍÕ±Ðì(€€€€€€€ôì(€€€ô((€€€€¼¨•¹‘•È¥ÌÁÉ•Í•¹Ñ…Ñ¥½¸½ÁÉ½™¥±”‘…Ñ„½¹±ä¸%Ð‘½•Ì¹½Ð…±Ñ•È…¹ä™½ÉµÕ±…Ì¸(€€€€€€ÍÍ¥¸‰•™½É”Ñ¡”•á¥ÍÑ¥¹œÉ•…Ñ•¡…É…Ñ•È ¤Í…Ù•ÌÁ±…å•È¸€¨¼(€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€½¹ÍÐ½É¥¥¹…±É•…Ñ•¡…É…Ñ•ÈõÝ¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èì(€€€€€€€Ý¥¹‘½Ü¹É•…Ñ•¡…É…Ñ•Èõ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜Á±…å•È„ôô‰Õ¹‘•™¥¹•ˆ€˜˜(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜É•…Ñ¥½¹Q…É•ÑM±½Ðôôô‰Õ¹‘•™¥¹•ˆñð(€€€€€€€€€€€€€€€€€€€€€€€É•…Ñ¥½¹Q…É•ÑM±½ÐôôôÄ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€€€€€Á±…å•È¹•¹‘•ÈõÍ•±•Ñ•‘•¹‘•Èì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ…Ñ ¡•ÉÉ½È¥íô(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½É¥¥¹…±É•…Ñ•¡…É…Ñ•È¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€€€€€€¼¨ƒ¦¦_¢¶'–’ÇšV_šf–&×¢žK¦‚’î7šr¦†¿ž’ë¾ò3’â7¢÷š>C–&7¦^sš:'š&/š¦–zžnÓšîG–.WŽ€¨¼(€€€€€€€€€€€€€€€Íå¹É•…Ñ¥½¹Q½Õ¡5½‘” ¤ì(€€€€€€€€€€€ô(€€€€€€€ôì(€€€ô((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹Í¡½ÝÉ•…Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€½¹ÍÐ½É¥¥¹…±M¡½ÝÉ•…Ñ¥½¸õÝ¥¹‘½Ü¹Í¡½ÝÉ•…Ñ¥½¸ì(€€€€€€€Ý¥¹‘½Ü¹Í¡½ÝÉ•…Ñ¥½¸õ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€€€€€µ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½É¥¥¹…±M¡½ÝÉ•…Ñ¥½¸¹…ÁÁ±ä¡Ñ¡¥Ì±…ÉÕµ•¹ÑÌ¤ì(€€€€€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€€€€€Í•ÑÉ•…Ñ¥½¹Q½Õ¡5½‘”¡ÑÉÕ”¤ì(€€€€€€€€€€€€€€€¥¹ÍÑ…±±É•…Ñ¥½¹•ÍÑÕÉ•1½¬ ¤ì(€€€€€€€€€€€€€€€…ÁÁ±åÉ•…Ñ¥½¹MÑ•À Ä¤ì(€€€€€€€€€€€€€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½Ý…Í” (€€€€€€€€€€€€€€€€€€€€¡ÑåÁ•½˜Í•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ð„ôô‰Õ¹‘•™¥¹•ˆ€˜˜5QmÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ñt¤(€€€€€€€€€€€€€€€€€€€€üÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€è€‰™¥É”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ôì(€€€ô((€€€€¼¨á¥ÍÑ¥¹œÍ…Ù•Ì‘¼¹½Ð½¹Ñ…¥¸•¹‘•È¸•™…Õ±Ñ¥¹œÑ¼™•µ…±”¥Ì‰…­Ý…Éµ½µÁ…Ñ¥‰±”¸€¨¼(€€€ÑÉåì(€€€€€€€¥˜¡ÑåÁ•½˜Á±…å•È„ôô‰Õ¹‘•™¥¹•ˆ€˜˜Á±…å•È€˜˜€¡Á±…å•È¹•¹‘•Èôôô‰µ…±”ˆñðÁ±…å•È¹•¹‘•Èôôô‰™•µ…±”ˆ¤¥ì(€€€€€€€€€€€Í•±•Ñ•‘•¹‘•ÈõÁ±…å•È¹•¹‘•Èì(€€€€€€€ô(€€€õ…Ñ ¡•ÉÉ½È¥íô((€€€½¹ÍÐ¥¹¥Ñ¥…±±•µ•¹Ðô¡™Õ¹Ñ¥½¸ ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€É•ÑÕÉ¸€¡ÑåÁ•½˜Í•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ð„ôô‰Õ¹‘•™¥¹•ˆ€˜˜5QmÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ñt¤(€€€€€€€€€€€€€€€€üÍ•±•Ñ•‘É•…Ñ¥½¹±•µ•¹Ð(€€€€€€€€€€€€€€€€è€‰™¥É”ˆì(€€€€€€€õ…Ñ ¡•ÉÉ½È¥ì(€€€€€€€€€€€É•ÑÕÉ¸€‰™¥É”ˆì(€€€€€€€ô(€€€ô¤ ¤ì((€€€µ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€¥¹ÍÑ…±±É•…Ñ¥½¹•ÍÑÕÉ•1½¬ ¤ì(€€€…ÁÁ±åÉ•…Ñ¥½¹MÑ•À Ä¤ì(€€€Ý¥¹‘½Ü¹Í•±•ÑÉ•…Ñ¥½¹•¹‘•È¡Í•±•Ñ•‘•¹‘•È¤ì(€€€É•¹‘•ÉÉ•…Ñ¥½¹M¡½Ý…Í”¡¥¹¥Ñ¥…±±•µ•¹Ð¤ì(€€€Íå¹É•…Ñ¥½¹Q½Õ¡5½‘” ¤ì((€€€Ý¥¹‘½Ü¹•ÑÉ•…Ñ¥½¹9…Ñ¥Ù•1…å½ÕÑ¥…¹½ÍÑ¥Ìõ™Õ¹Ñ¥½¸ ¥ì(€€€€€€€½¹ÍÐÁ…”õµ¥É…Ñ•É•…Ñ¥½¹A…•Q½9…Ñ¥Ù•1…å•È ¤ì(€€€€€€€½¹ÍÐÍ¡•±°õÁ…”€˜˜Á…”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•…Ñ¥½¸µÁÉ•µ¥Õ´µÍ¡•±°ˆ¤ì(€€€€€€€¥˜ …Á…”¥íÉ•ÑÕÉ¸¹Õ±°íô(€€€€€€€½¹ÍÐÁ…•MÑå±”õÝ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á…”¤ì(€€€€€€€½¹ÍÐÍ¡•±±MÑå±”õÍ¡•±°ýÝ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Í¡•±°¤é¹Õ±°ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€Á…É•¹Ñ%éÁ…”¹Á…É•¹Ñ±•µ•¹ÐýÁ…”¹Á…É•¹Ñ±•µ•¹Ð¹¥é¹Õ±°°(€€€€€€€€€€€¹…Ñ¥Ù•]¥‘Ñ éÁ…•MÑå±”¹Ý¥‘Ñ °(€€€€€€€€€€€¹…Ñ¥Ù•!•¥¡ÐéÁ…•MÑå±”¹¡•¥¡Ð°(€€€€€€€€€€€ÑÉ…¹Í™½É´éÁ…•MÑå±”¹ÑÉ…¹Í™½É´°(€€€€€€€€€€€½Ù•É™±½ÝdéÁ…•MÑå±”¹½Ù•É™±½Ýd°(€€€€€€€€€€€Á½¥¹Ñ•ÉÙ•¹ÑÌéÁ…•MÑå±”¹Á½¥¹Ñ•ÉÙ•¹ÑÌ°(€€€€€€€€€€€Í¡•±±A…‘‘¥¹œéÍ¡•±±MÑå±”ýÍ¡•±±MÑå±”¹Á…‘‘¥¹œé¹Õ±°°(€€€€€€€€€€€µ¥É…Ñ¥½¸éÁ…”¹‘…Ñ…Í•Ð¹¹…Ñ¥Ù•5¥É…Ñ¥½¹ññ¹Õ±°°(€€€€€€€€€€€ÁÉ•Á…¥¹ÐéÁ…”¹‘…Ñ…Í•Ð¹¹…Ñ¥Ù•AÉ•Á…¥¹Ñññ¹Õ±°°(€€€€€€€€€€€™¥á•‘5½‘”é‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰É•…Ñ¥½¸µ™¥á•µ…Ñ¥Ù”ˆ¤°(€€€€€€€€€€€ÍÑ•ÀéÍ•±•Ñ•‘É•…Ñ¥½¹MÑ•À°(€€€€€€€€€€€Í­¥±±AÉ•Ù¥•ÝAÉ•Í•¹Ðè„…‰å% ‰É•…Ñ¥½¹A¡åÍ¥…±M­¥±±Ìˆ¤(€€€€€€€ôì(€€€ôì((€€€€¼¨ƒž²³’ê3¾ò?’â'¢žK¢&Ë–ÇžR£–&×¢žK¦‚šf¾ò3–>[šÚ#š"[–º3š"C–ú3’æ¢š¢÷’âï–.W¢ž¦f(€€€€€€¹‘É½¥ƒžj–në–ºk–&×¢žKš&/–.‹š¢‡–ò?Ž€¨¼(€€€Ý¥¹‘½Ü¹Íå¹É•…Ñ¥½¹Q½Õ¡5½‘”õÍå¹É•…Ñ¥½¹Q½Õ¡5½‘”ì((€€€€¼¨9¼5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È€¼•áÑÉ„Ñ½Õ ±¥ÍÑ•¹•ÉÌ¸(€€€€€€Í•½¹Íå¹Œ…™Ñ•ÈÕÉÉ•¹Ð…±°ÍÑ…¬½Ù•ÉÌ±½…‘…µ” ¤Ñ¥µ¥¹œÍ…™•±ä¸€¨¼(€€€Ý¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ¡Íå¹É•…Ñ¥½¹Q½Õ¡5½‘”°À¤ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ÈÀµ…¹½¹åµ½ÕÌ´ÈÀ¹©Ì€¨¼(¼¨É¥Ñ¥…°½™•…ÑÕÉ”‰½Õ¹‘…Éä½Ý¹•È¸9¼±½‰…°¥¹ÁÕÐ±½¬…¹¹¼¹•ÑÝ½É¬µ½É‘•ÈÁ…Ñ ¡…¥¸¸€¨¼)½¹ÍÐY}MMQ}YIM%=8ôˆÄÜÌ¸ÜÌˆì((¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±•…ÑÕÉ•%¹Ñ•¹Ñ	½Õ¹‘…Éä ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì(€€€¥˜¡Ý¥¹‘½Ü¹}}™½ÕÉMåµ‰½±Í•…ÑÕÉ•%¹Ñ•¹Ñ%¹ÍÑ…±±•¥ìÉ•ÑÕÉ¸ìô(€€€Ý¥¹‘½Ü¹}}™½ÕÉMåµ‰½±Í•…ÑÕÉ•%¹Ñ•¹Ñ%¹ÍÑ…±±•õÑÉÕ”ì((€€€½¹ÍÐÉÕ±•Ìõl(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½ÝA…•p¡lœ‰uµ…Áñ•¹Ñ•Éi½¹•ñ•¹Ñ•É5…Áñ½Á•¹5…ÁñÁ…ÑÉ½°½¤±™•…ÑÕÉ”è‰Á…ÑÉ½°ˆ±±…‰•°è‹–Þ‡š¨‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½ÝA…•p¡lœ‰u¥¹Ù•¹Ñ½Éåñ½Á•¸¸©¥¹Ù•¹Ñ½Éåñ‰…­Á…¬½¤±™•…ÑÕÉ”è‰¥¹Ù•¹Ñ½Éäˆ±±…‰•°è‹¢3–2‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½•ÅÕ¥Áµ•¹ÑñÉ•™½É”½¤±™•…ÑÕÉ”è‰•ÅÕ¥Áµ•¹Ðˆ±±…‰•°è‹¢Žw–
d‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½ÝA…•p¡lœ‰u‘Õ¹•½¹ñ‘Õ¹•½¸½¤±™•…ÑÕÉ”è‰‘Õ¹•½¸ˆ±±…‰•°è‹–&¿šr°‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½…‰åÍÌ½¤±™•…ÑÕÉ”è‰…‰åÍÌˆ±±…‰•°è‹šÞÇšÞÔ‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½‰½ÍÍñÑ½Ý•È½¤±™•…ÑÕÉ”è‰‰½ÍÌµÑ½Ý•Èˆ±±…‰•°è‹–no¢Æ‡–†P‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½É•±¥Œ½¤±™•…ÑÕÉ”è‰É•±¥Œˆ±±…‰•°è‹žžc–¾Ø‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í­¥±°½¤±™•…ÑÕÉ”è‰Í­¥±°ˆ±±…‰•°è‹š*¢ô‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Í¡½À½¤±™•…ÑÕÉ”è‰Í¡½Àˆ±±…‰•°è‹–V–ê\‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½Íå¹Ñ ½¤±™•…ÑÕÉ”è‰Íå¹Ñ¡•Í¥Ìˆ±±…‰•°è‹–B#š"@‰ô°(€€€€€€€íÁ…ÑÑ•É¸è½‰…ÑÑ±”½¤±™•…ÑÕÉ”è‰‰…ÑÑ±”ˆ±±…‰•°è‹š"Ã¦²”‰ô(€€€tì(€€€™Õ¹Ñ¥½¸Ñ…É•Ð¡•Ù•¹Ð¥ìÉ•ÑÕÉ¸•Ù•¹Ð¹Ñ…É•Ð˜™•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ˜™•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ ‰‰ÕÑÑ½¸±„±m‘…Ñ„µ™•…ÑÕÉ•tˆ¤ìô(€€€™Õ¹Ñ¥½¸¥Í	…ÑÑ±•IÕ¹Ñ¥µ•%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸€„„¡•±•µ•¹Ð˜™•±•µ•¹Ð¹±½Í•ÍÐ˜™•±•µ•¹Ð¹±½Í•ÍÐ ˆ‰…ÑÑ±•A…”ˆ¤¤ì(€€€ô(€€€™Õ¹Ñ¥½¸¥ÍáÁA½½±%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ð¥ì(€€€€€€€É•ÑÕÉ¸€„„¡•±•µ•¹Ð˜™•±•µ•¹Ð¹±½Í•ÍÐ˜™•±•µ•¹Ð¹±½Í•ÍÐ ˆ¡½µ•áÁA½½±…Éˆ¤¤ì(€€€ô(€€€™Õ¹Ñ¥½¸‘•ÍÉ¥ÁÑ½È¡•±•µ•¹Ð¥ì(€€€€€€€¥˜ …•±•µ•¹Ð¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€€¼¨ƒžÚO¦¦_šÆƒšr³¢ê¯–Æ³šZó’âï–~8…ÁÀµÍ¡•±³¾ò3’öŽ3¦‚C¢š÷–6žÒk¾ò/’ê3š²‡žŠë¢ª7Ž5½Ý¹•Èƒ–r (€€€€€€€€€€…µ•Á±…äµ½É—Ž¢«–úx…µ•Á±…äµ½É”ƒšRçš"@±…éäƒ–ú3¾ò3¢.—’â7–#¢ò'–”½Ý¹•Ë¾ò0(€€€€€€€€€€ƒ¢"+žj–6Ïšf–"¦7š2'¦"W–ÂÇ–>¿¢÷–r£¦bË–F–º'¢Žw–&7¢Š¯¦î{–"ÃŽ€¨¼(€€€€€€€¥˜¡¥ÍáÁA½½±%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ð¤¥ì(€€€€€€€€€€€É•ÑÕÉ¸í™•…ÑÕÉ”è‰‰…ÑÑ±”ˆ±±…‰•°è‹žÚO¦¦_šÆƒ–º'–£–6žÒhˆ±•áÁA½½°éÑÉÕ•ôì(€€€€€€€ô(€€€€€€€½¹ÍÐ•áÁ±¥¥Ðõ•±•µ•¹Ð¹‘…Ñ…Í•Ð˜™•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ”ì(€€€€€€€¥˜¡•áÁ±¥¥Ð¥ìÉ•ÑÕÉ¸í™•…ÑÕÉ”é•áÁ±¥¥Ð±±…‰•°é•±•µ•¹Ð¹•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ¥ññ•±•µ•¹Ð¹Ñ•áÑ½¹Ñ•¹Ñññ•áÁ±¥¥Ñôìô(€€€€€€€½¹ÍÐÍ¥¹…ÑÕÉ”õm•±•µ•¹Ð¹¥±•±•µ•¹Ð¹±…ÍÍ9…µ”±•±•µ•¹Ð¹•ÑÑÑÉ¥‰ÕÑ”˜™•±•µ•¹Ð¹•ÑÑÑÉ¥‰ÕÑ” ‰½¹±¥¬ˆ¤±•±•µ•¹Ð¹Ñ•áÑ½¹Ñ•¹Ñt¹©½¥¸ ˆ€ˆ¤ì(€€€€€€€É•ÑÕÉ¸ÉÕ±•Ì¹™¥¹¡ÉÕ±”ôùÉÕ±”¹Á…ÑÑ•É¸¹Ñ•ÍÐ¡Í¥¹…ÑÕÉ”¤¥ññ¹Õ±°ì(€€€ô(€€€™Õ¹Ñ¥½¸±½…‘•È ¥ìÉ•ÑÕÉ¸Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ììô(€€€™Õ¹Ñ¥½¸Í•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ð±…Ñ¥Ù”±±…‰•°¥ì(€€€€€€€¥˜ …•±•µ•¹Ð¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ™•…ÑÕÉ”µ±½…‘¥¹œˆ±…Ñ¥Ù”¤ì(€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ‰ÕÍäˆ±…Ñ¥Ù”ü‰ÑÉÕ”ˆè‰™…±Í”ˆ¤ì(€€€€€€€¥˜¡…Ñ¥Ù”¥ì•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•1½…‘¥¹1…‰•°ô‹š¶–r£¢ò'–”ˆ¬¡±…‰•±ñð‹–*¢ôˆ¤¬‹Š˜ˆìô(€€€€€€€•±Í•ì‘•±•Ñ”•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•1½…‘¥¹1…‰•°ìô(€€€ô(€€€™Õ¹Ñ¥½¸É•…Ñ•9…Ù¥…Ñ¥½¹%¹Ñ•¹Ð¡•±•µ•¹Ð±Í½ÕÉ•Ù•¹Ð¥ì(€€€€€€€±•Ð•á•ÕÑ•õ™…±Í”ì(€€€€€€€É•ÑÕÉ¸™Õ¹Ñ¥½¸•á•ÕÑ•9…Ù¥…Ñ¥½¹%¹Ñ•¹Ð ¥ì(€€€€€€€€€€€¥˜¡•á•ÕÑ•¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€€€€€•á•ÕÑ•õÑÉÕ”ì(€€€€€€€€€€€½¹ÍÐ¥¹±¥¹•Ñ¥½¸õ•±•µ•¹Ð˜™•±•µ•¹Ð¹½¹±¥¬ì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜¥¹±¥¹•Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€½¹ÍÐ¥¹Ñ•¹ÑÙ•¹Ðõ¹•Ü5½ÕÍ•Ù•¹Ð ‰±¥¬ˆ±í‰Õ‰‰±•Ìé™…±Í”±…¹•±…‰±”éÑÉÕ”±Ù¥•ÜéÝ¥¹‘½Ýô¤ì(€€€€€€€€€€€€€€€¥¹±¥¹•Ñ¥½¸¹…±°¡•±•µ•¹Ð±¥¹Ñ•¹ÑÙ•¹Ð¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€…¥¹Ñ•¹ÑÙ•¹Ð¹‘•™…Õ±ÑAÉ•Ù•¹Ñ•ì(€€€€€€€€€€€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹‘¥ÍÁ…Ñ¡Ù•¹Ð¡¹•ÜÕÍÑ½µÙ•¹Ð ‰™½ÕÈµÍåµ‰½±Ìé¹…Ù¥…Ñ¥½¸µ¥¹Ñ•¹Ðˆ±í‘•Ñ…¥°éí•±•µ•¹Ð±Í½ÕÉ•Ù•¹Ñõô¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ôì(€€€ô((€€€±•Ð•áÁA½½±AÉ¥µ•AÉ½µ¥Í”õ¹Õ±°ì(€€€±•Ð•áÁA½½±M…™•ÑåU¥I•…‘äõ™…±Í”ì(€€€™Õ¹Ñ¥½¸É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¥ì(€€€€€€€¥˜¡•áÁA½½±M…™•ÑåU¥I•…‘ä¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•áÁA½½±M…™•ÑåU¥I•…‘äõÑÉÕ”ì(€€€€€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹É•¹‘•ÉáÁ¥ÍÑÉ¥‰ÕÑ•1¥ÍÐ ¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹ØÄÜÍ•½É…Ñ•áÁA½½±¥ÍÑÉ¥‰ÕÑ¥½¹U¤ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€Ý¥¹‘½Ü¹ØÄÜÍ•½É…Ñ•áÁA½½±¥ÍÑÉ¥‰ÕÑ¥½¹U¤ ¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÁ½½°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•áÁA½½±…Éˆ¤ì(€€€€€€€¥˜¡Á½½°¥ìÁ½½°¹‘…Ñ…Í•Ð¹•áÁM…™•Ñå=Ý¹•Èô‰É•…‘äˆìô(€€€ô(€€€™Õ¹Ñ¥½¸ÁÉ¥µ•áÁA½½±M…™•Ñä ¥ì(€€€€€€€½¹ÍÐÁ½½°õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ•áÁA½½±…Éˆ¤ì(€€€€€€€½¹ÍÐ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜ …Á½½±ñð……Á¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐÙ¥Í¥‰±”ô…Á½½°¹¡¥‘‘•¸˜™Ý¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡Á½½°¤¹‘¥ÍÁ±…ä„ôô‰¹½¹”ˆ˜™Á½½°¹•Ñ±¥•¹ÑI•ÑÌ ¤¹±•¹Ñ øÀì(€€€€€€€¥˜ …Ù¥Í¥‰±”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡…Á¤¹¥ÍI•…‘ä ‰‰…ÑÑ±”ˆ¤¥ì(€€€€€€€€€€€É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡•áÁA½½±AÉ¥µ•AÉ½µ¥Í”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€Í•Ñ1½…±1½…‘¥¹œ¡Á½½°±ÑÉÕ”°‹žÚO¦¦_šÆƒ–º'–£–6žÒhˆ¤ì(€€€€€€€•áÁA½½±AÉ¥µ•AÉ½µ¥Í”õ…Á¤¹•¹ÍÕÉ” ‰‰…ÑÑ±”ˆ°‰•áÀµÁ½½°µÍ…™•Ñäˆ¤¹Ñ¡•¸  ¤ôùì(€€€€€€€€€€€Í•Ñ1½…±1½…‘¥¹œ¡Á½½°±™…±Í”¤ì(€€€€€€€€€€€É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¤ì(€€€€€€€ô¤¹…Ñ ¡•ÉÉ½Èôùì(€€€€€€€€€€€Í•Ñ1½…±1½…‘¥¹œ¡Á½½°±™…±Í”¤ì(€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È ‰a@Á½½°Í…™•Ñä½Ý¹•È™…¥±•Ñ¼±½…èˆ±•ÉÉ½È¤ì(€€€€€€€€€€€‘½Õµ•¹Ð¹‘¥ÍÁ…Ñ¡Ù•¹Ð¡¹•ÜÕÍÑ½µÙ•¹Ð ‰™½ÕÈµÍåµ‰½±Ìé™•…ÑÕÉ”µ±½…°µ•ÉÉ½Èˆ±í‘•Ñ…¥°éí™•…ÑÕÉ”è‰‰…ÑÑ±”ˆ±•ÉÉ½Éõô¤¤ì(€€€€€€€ô¤¹™¥¹…±±ä  ¤ôùì•áÁA½½±AÉ¥µ•AÉ½µ¥Í”õ¹Õ±°ìô¤ì(€€€ô(€€€™Õ¹Ñ¥½¸ÁÉ•™•Ñ ¡•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐ•±•µ•¹ÐõÑ…É•Ð¡•Ù•¹Ð¤ì¥˜¡¥Í	…ÑÑ±•IÕ¹Ñ¥µ•%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ð¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐ¥¹™¼õ‘•ÍÉ¥ÁÑ½È¡•±•µ•¹Ð¤ì½¹ÍÐ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜¡¥¹™¼˜™…Á¤˜˜……Á¤¹¥ÍI•…‘ä¡¥¹™¼¹™•…ÑÕÉ”¤¥ìÙ½¥…Á¤¹ÁÉ•™•Ñ ¡¥¹™¼¹™•…ÑÕÉ”±•Ù•¹Ð¹ÑåÁ”¤ìô(€€€ô(€€€™Õ¹Ñ¥½¸•¹Ñ•È¡•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐ•±•µ•¹ÐõÑ…É•Ð¡•Ù•¹Ð¤ì¥˜¡¥Í	…ÑÑ±•IÕ¹Ñ¥µ•%¹Ñ•É…Ñ¥½¸¡•±•µ•¹Ð¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐ¥¹™¼õ‘•ÍÉ¥ÁÑ½È¡•±•µ•¹Ð¤ì½¹ÍÐ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜ …¥¹™½ñð……Á¥ññ…Á¤¹¥ÍI•…‘ä¡¥¹™¼¹™•…ÑÕÉ”¥ññ•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•I•Á±…äôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€¥˜¡•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•1½…‘¥¹œôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•1½…‘¥¹œôˆÄˆìÍ•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ð±ÑÉÕ”±¥¹™¼¹±…‰•°¤ì(€€€€€€€½¹ÍÐ¥¹Ñ•¹ÐõÉ•…Ñ•9…Ù¥…Ñ¥½¹%¹Ñ•¹Ð¡•±•µ•¹Ð±•Ù•¹Ð¤ì(€€€€€€€…Á¤¹•¹ÍÕÉ”¡¥¹™¼¹™•…ÑÕÉ”±¥¹™¼¹•áÁA½½°ü‰•áÀµÁ½½°µÍ…™•Ñäˆè‰¹…Ù¥…Ñ¥½¸ˆ¤¹Ñ¡•¸  ¤ôùì(€€€€€€€€€€€‘•±•Ñ”•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•1½…‘¥¹œìÍ•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ð±™…±Í”¤ì(€€€€€€€€€€€¥˜¡¥¹™¼¹•áÁA½½°¥ì(€€€€€€€€€€€€€€€€¼¨ƒ’â4É•Á±…äƒ¢"(=4ƒ’â+–>¿¢÷’î7š2–BD¥µµ•‘¥…Ñ”‘¥ÍÑÉ¥‰ÕÑ”ƒžj¡…¹‘±•ËŽ(€€€€€€€€€€€€€€€€€€ƒ–#žRÇš¶–ò<½Ý¹•Èƒ¦7žæ«š"CŽ3¦‚C¢šôƒŠHƒžŠë¢ª7Ž5U'¾ò3ž:§–ºÛ–7¦î{’âš²‡š&7šr¢*ÄaCŽ€¨¼(€€€€€€€€€€€€€€€É•™É•Í¡áÁA½½±M…™•ÑåU¥=¹” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€€¼¨=¹”…•ÁÑ•¡Õµ…¸•ÍÑÕÉ”ÁÉ½‘Õ•Ì½¹”¥¹Ñ•¹Ð¸€¼¹½ÐÉ•Á±…ä(€€€€€€€€€€€€€€„Íå¹Ñ¡•Ñ¥Œ=4±¥¬è¥Ð…¸‰”¥¹Ñ•É•ÁÑ•…Ì„Í•½¹Ñ…À¸€¨¼(€€€€€€€€€€€¥¹Ñ•¹Ð ¤ì(€€€€€€€ô¤¹…Ñ ¡•ÉÉ½Èôùì(€€€€€€€€€€€‘•±•Ñ”•±•µ•¹Ð¹‘…Ñ…Í•Ð¹™•…ÑÕÉ•1½…‘¥¹œìÍ•Ñ1½…±1½…‘¥¹œ¡•±•µ•¹Ð±™…±Í”¤ì(€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È ‰•…ÑÕÉ”™…¥±•Ñ¼±½…èˆ±¥¹™¼¹™•…ÑÕÉ”±•ÉÉ½È¤ì(€€€€€€€€€€€‘½Õµ•¹Ð¹‘¥ÍÁ…Ñ¡Ù•¹Ð¡¹•ÜÕÍÑ½µÙ•¹Ð ‰™½ÕÈµÍåµ‰½±Ìé™•…ÑÕÉ”µ±½…°µ•ÉÉ½Èˆ±í‘•Ñ…¥°éí™•…ÑÕÉ”é¥¹™¼¹™•…ÑÕÉ”±•ÉÉ½Éõô¤¤ì(€€€€€€€ô¤ì(€€€ô(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½Ý¸ˆ±ÁÉ•™•Ñ ±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ñ½Õ¡ÍÑ…ÉÐˆ±ÁÉ•™•Ñ ±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±•¹Ñ•È±ÑÉÕ”¤ì(€€€Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í9…Ù¥…Ñ¥½¹%¹Ñ•¹Ðõ=‰©•Ð¹™É••é”¡íÉ•…Ñ”éÉ•…Ñ•9…Ù¥…Ñ¥½¹%¹Ñ•¹Ñô¤ì(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰™½ÕÈµÍåµ‰½±ÌéÍÑ…ÉÑÕÀµÉ•…‘äˆ° ¤ôùì(€€€€€€€½¹ÍÐ…Á¤õ±½…‘•È ¤ì(€€€€€€€¥˜¡…Á¤¥ì(€€€€€€€€€€€ÑÉåí¥˜¡Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±Ìé‰…­É½Õ¹µÁÉ•™•Ñ µÍÑ…ÉÐˆ¤íõõ…Ñ ¡|¥ìô(€€€€€€€€€€€…Á¤¹¥‘±”¡l‰¥¹Ù•¹Ñ½Éäˆ°‰Í¡½Àˆ°‰•ÅÕ¥Áµ•¹Ðˆ°‰Íå¹Ñ¡•Í¥Ìˆ°‰É•±¥Œ‰t±l‰É•±¥%½¹Ì‰t¤¹Ñ¡•¸¡É•ÍÕ±Ðôùì(€€€€€€€€€€€€€€€ÑÉåí¥˜¡ÉÉ…ä¹¥ÍÉÉ…ä¡É•ÍÕ±Ð¤˜™É•ÍÕ±Ð¹…Ð ´Ä¤˜™Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±ÌéÉ•±¥ŒµÁÉ•™•Ñ µÉ•…‘äˆ¤íõõ…Ñ ¡|¥ìô(€€€€€€€€€€€€€€€É•ÑÕÉ¸…Á¤¹¥‘±”¡l‰Á…ÑÉ½°ˆ°‰Í­¥±°‰t¤ì(€€€€€€€€€€€ô¤¹Ñ¡•¸  ¤ôùíÑÉåí¥˜¡Á•É™½Éµ…¹”˜™ÑåÁ•½˜Á•É™½Éµ…¹”¹µ…É¬ôôô‰™Õ¹Ñ¥½¸ˆ¥íÁ•É™½Éµ…¹”¹µ…É¬ ‰™½ÕÈµÍåµ‰½±Ìé‰…­É½Õ¹µÁÉ•™•Ñ µ¥‘±”ˆ¤íõõ…Ñ ¡|¥ìõô¤ì(€€€€€€€ô(€€€€€€€ÁÉ¥µ•áÁA½½±M…™•Ñä ¤ì(€€€ô±í½¹”éÑÉÕ•ô¤ì((€€€™Õ¹Ñ¥½¸ÁÉ¥µ•áÁA½½±M…™•Ñå]¡•¹½µI•…‘ä ¥ì(€€€€€€€ÁÉ¥µ•áÁA½½±M…™•Ñä ¤ì(€€€ô(€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±ÁÉ¥µ•áÁA½½±M…™•Ñå]¡•¹½µI•…‘ä±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€ÁÉ¥µ•áÁA½½±M…™•Ñå]¡•¹½µI•…‘ä ¤ì(€€€ô)ô¤ ¤ì((¡™Õ¹Ñ¥½¸¥¹¥Ñ	…ÑÑ±•±•µ•¹Ñ	½áÉ…œ ¥ì(€€€™Õ¹Ñ¥½¸‰¥¹ ¥ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¸õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•±•µ•¹Ñ	½á	ÕÑÑ½¸ˆ¤ì(€€€€€€€½¹ÍÐÁ…”õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰‰…ÑÑ±•A…”ˆ¤ì(€€€€€€€¥˜ …‰ÕÑÑ½¹ñð…Á…•ññ‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘É…I•…‘äôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘É…I•…‘äôˆÄˆì(€€€€€€€±•Ð‘É…œõ¹Õ±°ì±•ÐÍÕÁÁÉ•ÍÍ±¥¬õ™…±Í”ì½¹ÍÐÑ¡É•Í¡½±ôÔì(€€€€€€€™Õ¹Ñ¥½¸±½¥…±M…±” ¥ì(€€€€€€€€€€€½¹ÍÐÉ•ÐõÁ…”¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(€€€€€€€€€€€É•ÑÕÉ¸íÉ•Ð±ÍàéÉ•Ð¹Ý¥‘Ñ ýÁ…”¹±¥•¹Ñ]¥‘Ñ ½É•Ð¹Ý¥‘Ñ èÄ±ÍäéÉ•Ð¹¡•¥¡ÐýÁ…”¹±¥•¹Ñ!•¥¡Ð½É•Ð¹¡•¥¡ÐèÅôì(€€€€€€€ô(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½Ý¸ˆ±•Ù•¹Ðôùì(€€€€€€€€€€€¥˜¡•Ù•¹Ð¹Á½¥¹Ñ•ÉQåÁ”ôôô‰µ½ÕÍ”ˆ˜™•Ù•¹Ð¹‰ÕÑÑ½¸„ôôÀ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍÐÍ…±”õ±½¥…±M…±” ¤ì½¹ÍÐ‰½Õ¹‘Ìõ‰ÕÑÑ½¸¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(€€€€€€€€€€€‘É…œõíÁ½¥¹Ñ•É%é•Ù•¹Ð¹Á½¥¹Ñ•É%±àé•Ù•¹Ð¹±¥•¹Ñ`±äé•Ù•¹Ð¹±¥•¹Ñd±±•™Ðè¡‰½Õ¹‘Ì¹±•™ÐµÍ…±”¹É•Ð¹±•™Ð¤©Í…±”¹Íà±Ñ½Àè¡‰½Õ¹‘Ì¹Ñ½ÀµÍ…±”¹É•Ð¹Ñ½À¤©Í…±”¹Íä±ÍàéÍ…±”¹Íà±ÍäéÍ…±”¹Íä±µ½Ù•é™…±Í•ôì(€€€€€€€€€€€ÍÕÁÁÉ•ÍÍ±¥¬õ™…±Í”ì‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹…‘ ‰‘É…¥¹œˆ¤ì(€€€€€€€€€€€ÑÉåì‰ÕÑÑ½¸¹Í•ÑA½¥¹Ñ•É…ÁÑÕÉ”¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ìõ…Ñ ¡|¥ìô(€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€ô¤ì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•Éµ½Ù”ˆ±•Ù•¹Ðôùì(€€€€€€€€€€€¥˜ …‘É…ññ•Ù•¹Ð¹Á½¥¹Ñ•É%„ôõ‘É…œ¹Á½¥¹Ñ•É%¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍÐ‘àõ•Ù•¹Ð¹±¥•¹Ñ`µ‘É…œ¹à±‘äõ•Ù•¹Ð¹±¥•¹Ñdµ‘É…œ¹äì(€€€€€€€€€€€¥˜ …‘É…œ¹µ½Ù•˜™5…Ñ ¹¡åÁ½Ð¡‘à±‘ä¤øõÑ¡É•Í¡½±¥ì‘É…œ¹µ½Ù•õÑÉÕ”ìô(€€€€€€€€€€€¥˜ …‘É…œ¹µ½Ù•¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€½¹ÍÐ±•™Ðõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à À±Á…”¹±¥•¹Ñ]¥‘Ñ µ‰ÕÑÑ½¸¹½™™Í•Ñ]¥‘Ñ ¤±‘É…œ¹±•™Ð­‘à©‘É…œ¹Íà¤¤ì(€€€€€€€€€€€½¹ÍÐÑ½Àõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à À±Á…”¹±¥•¹Ñ!•¥¡Ðµ‰ÕÑÑ½¸¹½™™Í•Ñ!•¥¡Ð¤±‘É…œ¹Ñ½À­‘ä©‘É…œ¹Íä¤¤ì(€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰±•™Ðˆ±±•™Ð¬‰Áàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ½Àˆ±Ñ½À¬‰Áàˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰‰½ÑÑ½´ˆ°‰…ÕÑ¼ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€ô¤ì(€€€€€€€™Õ¹Ñ¥½¸™¥¹¥Í ¡•Ù•¹Ð¥ì(€€€€€€€€€€€¥˜ …‘É…ññ•Ù•¹Ð¹Á½¥¹Ñ•É%„ôõ‘É…œ¹Á½¥¹Ñ•É%¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€ÍÕÁÁÉ•ÍÍ±¥¬õ‘É…œ¹µ½Ù•ì‘É…œõ¹Õ±°ì‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰‘É…¥¹œˆ¤ì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€ô(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•ÉÕÀˆ±™¥¹¥Í ¤ì‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É…¹•°ˆ±™¥¹¥Í ¤ì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±•Ù•¹Ðôùì(€€€€€€€€€€€¥˜¡ÍÕÁÁÉ•ÍÍ±¥¬¥ìÍÕÁÁÉ•ÍÍ±¥¬õ™…±Í”ì•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€¥˜¡ÑåÁ•½˜½Á•¹!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì½Á•¹!½µ••…ÑÕÉ” ‰…ÕÑ½	…ÑÑ±•M•ÑÑ¥¹Ìˆ¤ìô(€€€€€€€ô¤ì(€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‘É…ÍÑ…ÉÐˆ±•Ù•¹Ðôù•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤¤ì(€€€ô(€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±‰¥¹±í½¹”éÑÉÕ•ô¤ìõ•±Í•ì‰¥¹ ¤ìô)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì¼ØÄµØÄÜÐµÕ¤µÉ•É•ÍÍ¥½¸µÕ…É‘Ì¹©Ì€¨¼(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô(€€XÄÜÐƒŠP‘å¹…µ¥ŒU$É•É•ÍÍ¥½¸Õ…É‘Ì(€€=Ý¹•È™½ÈÉ½ÍÌµÕÑÑ¥¹œU$¥¹Ù…É¥…¹ÑÌÉ•…Ñ•‰äµÕ±Ñ¥Á±”±…Ñ”ÉÕ¹Ñ¥µ•Ìè(€€€Ä¤‘…É¬Ñ•áÐ½¸‰É¥¡Ð½±½å•±±½Ü‰ÕÑÑ½¹ÌµÕÍÐ¹½Ð¡…Ù”„Ñ•áÐÍ¡…‘½Üì(€€€Ì¤ÍåÍÑ•´Í…Ù”½‘•±•Ñ”ÍÕ‰™±½ÝÌµÕÍÐ…±Ý…åÌ½™™•È…¸•áÁ±¥¥ÐÉ•ÑÕÉ¸Á…Ñ ¸((€€9¼…µ•Á±…ä°Í…Ù”°‰…ÑÑ±”°Í­¥±°µ½ÍÐ½È•ÅÕ¥Áµ•¹Ð‰ÕÍ¥¹•ÍÌÉÕ±•Ì±¥Ù”¡•É”¸(ôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±XÄÜÑU¥I•É•ÍÍ¥½¹Õ…É‘Ì ¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Üôôô‰Õ¹‘•™¥¹•‰ññÑåÁ•½˜‘½Õµ•¹Ðôôô‰Õ¹‘•™¥¹•‰ññÝ¥¹‘½Ü¹}}ØÄÜÑU¥I•É•ÍÍ¥½¹Õ…É‘Í%¹ÍÑ…±±•¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€ô(€€€Ý¥¹‘½Ü¹}}ØÄÜÑU¥I•É•ÍÍ¥½¹Õ…É‘Í%¹ÍÑ…±±•õÑÉÕ”ì((€€€±•ÐÉ…™%ôÀì((€€€™Õ¹Ñ¥½¸½±½ÉQÉ¥Á±•Ì¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐÑÉ¥Á±•Ìõmtì(€€€€€€€MÑÉ¥¹œ¡Ù…±Õ•ñðˆˆ¤¹É•Á±…” ½É‰„ýp¡qÌ¨¡q¬ üép¹q¬¤ü¥qÌ©l°uqÌ¨¡q¬ üép¹q¬¤ü¥qÌ©l°uqÌ¨¡q¬ üép¹q¬¤ü¤ üéqÌ©l°½uqÌ¨¡q¨ üép¹q¬¤ü¤¤ýqÌ©p¤½¤°(€€€€€€€€€€€™Õ¹Ñ¥½¸¡|±È±œ±ˆ±„¥ì(€€€€€€€€€€€€€€€½¹ÍÐ…±Á¡„õ„ôôôˆ‰ññ„ôôõÕ¹‘•™¥¹•üÄé9Õµ‰•È¡„¤ì(€€€€€€€€€€€€€€€ÑÉ¥Á±•Ì¹ÁÕÍ ¡íÈé9Õµ‰•È¡È¤±œé9Õµ‰•È¡œ¤±ˆé9Õµ‰•È¡ˆ¤±„é9Õµ‰•È¹¥Í¥¹¥Ñ”¡…±Á¡„¤ý…±Á¡„èÅô¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸|ì(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€€€€€É•ÑÕÉ¸ÑÉ¥Á±•Ìì(€€€ô((€€€™Õ¹Ñ¥½¸±Õµ¥¹…¹”¡½±½È¥ì(€€€€€€€É•ÑÕÉ¸½±½È¹È¨¸ÈÄÈØ­½±½È¹œ¨¸ÜÄÔÈ­½±½È¹ˆ¨¸ÀÜÈÈì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í	É¥¡Ñ½±¡½±½È¥ì(€€€€€€€É•ÑÕÉ¸½±½È¹„ø¸ÀÔ˜˜(€€€€€€€€€€€½±½È¹ÈøôÄÐÔ˜˜(€€€€€€€€€€€½±½È¹œøôäÀ˜˜(€€€€€€€€€€€½±½È¹œðôÈÈÔ˜˜(€€€€€€€€€€€½±½È¹ˆðôÄÐÔ˜˜(€€€€€€€€€€€½±½È¹Èøõ½±½È¹œ˜˜(€€€€€€€€€€€±Õµ¥¹…¹”¡½±½È¤øôÄÄÔì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í…É­Q•áÐ¡½±½È¥ì(€€€€€€€É•ÑÕÉ¸½±½È˜™½±½È¹„ø¸ÀÔ˜™±Õµ¥¹…¹”¡½±½È¤ðôÄÄÔì(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•½±‘	ÕÑÑ½¹Q•áÑM¡…‘½ÝÌ ¥ì(€€€€€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¡½µ••…ÑÕÉ•5½‘…°‰ÕÑÑ½¸°€…±±M­¥±±Í1¥ÍÐ‰ÕÑÑ½¸°€ØÄØåIÁ¥…±½1…å•È‰ÕÑÑ½¸°€É•…Ñ¥½¹A…”‰ÕÑÑ½¸ˆ¤¹™½É… ¡‰ÕÑÑ½¸ôùì(€€€€€€€€€€€½¹ÍÐÍÑå±”õÝ¥¹‘½Ü¹•Ñ½µÁÕÑ•‘MÑå±”¡‰ÕÑÑ½¸¤ì(€€€€€€€€€€€½¹ÍÐÑ•áÑ½±½Èõ½±½ÉQÉ¥Á±•Ì¡ÍÑå±”¹½±½È¥lÁtì(€€€€€€€€€€€½¹ÍÐ‰…­É½Õ¹‘½±½ÉÌõ½±½ÉQÉ¥Á±•Ì¡ÍÑå±”¹‰…­É½Õ¹‘½±½È¬ˆ€ˆ­ÍÑå±”¹‰…­É½Õ¹‘%µ…”¤ì(€€€€€€€€€€€½¹ÍÐÅÕ…±¥™¥•Ìõ¥Í…É­Q•áÐ¡Ñ•áÑ½±½È¤˜™‰…­É½Õ¹‘½±½ÉÌ¹Í½µ”¡¥Í	É¥¡Ñ½±¤ì((€€€€€€€€€€€¥˜¡ÅÕ…±¥™¥•Ì¥ì(€€€€€€€€€€€€€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑ…É­½±‘M¡…‘½Ü„ôôˆÄ‰ññÍÑå±”¹Ñ•áÑM¡…‘½Ü„ôô‰¹½¹”ˆ¥ì(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä ‰Ñ•áÐµÍ¡…‘½Üˆ°‰¹½¹”ˆ°‰¥µÁ½ÉÑ…¹Ðˆ¤ì(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑ…É­½±‘M¡…‘½ÜôˆÄˆì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€õ•±Í”¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑ…É­½±‘M¡…‘½ÜôôôˆÄˆ¥ì(€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä ‰Ñ•áÐµÍ¡…‘½Üˆ¤ì(€€€€€€€€€€€€€€€‘•±•Ñ”‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑ…É­½±‘M¡…‘½Üì(€€€€€€€€€€€ô(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•MÑå±•Í¡••Ñ1…ÍÐ ¥ì(€€€€€€€½¹ÍÐ±¥¹¬õ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄÜÐµÉ¥Ñ¥…°µÕ¤µÉ•É•ÍÍ¥½¸µÍÑå±”ˆ¤ì(€€€€€€€¥˜¡±¥¹¬˜™±¥¹¬¹Á…É•¹Ñ±•µ•¹Ðôôõ‘½Õµ•¹Ð¹¡•…˜™±¥¹¬„ôõ‘½Õµ•¹Ð¹¡•…¹±…ÍÑ±•µ•¹Ñ¡¥±¥ì(€€€€€€€€€€€‘½Õµ•¹Ð¹¡•…¹…ÁÁ•¹‘¡¥±¡±¥¹¬¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸ÍåÍÑ•µI½ÝQ¥Ñ±”¡‰ÕÑÑ½¸¥ì(€€€€€€€½¹ÍÐÉ½Üõ‰ÕÑÑ½¸˜™‰ÕÑÑ½¸¹±½Í•ÍÐ˜™‰ÕÑÑ½¸¹±½Í•ÍÐ ˆ¹ÍåÍÑ•´µÁ…¹•°µÉ½Üˆ¤ì(€€€€€€€½¹ÍÐÑ¥Ñ±”õÉ½Ü˜™É½Ü¹ÅÕ•ÉåM•±•Ñ½È ‰ÍÑÉ½¹œˆ¤ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ñ¥Ñ±”˜™Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ññðˆˆ¤¹ÑÉ¥´ ¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸•¹ÍÕÉ•IÁ¥…±½=Ý¹•È¡É•…Í½¸¥ì(€€€€€€€¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸ÑÉÕ”ìô(€€€€€€€¥˜¡Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì˜™ÑåÁ•½˜Ý¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì¹•¹ÍÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€ÑÉåì…Ý…¥ÐÝ¥¹‘½Ü¹½ÕÉMåµ‰½±Í•…ÑÕÉ•Ì¹•¹ÍÕÉ” ‰…µ•Á±…äµ½É”ˆ±É•…Í½¹ñð‰ÍåÍÑ•´µ‘¥…±½œˆ¤ìô(€€€€€€€€€€€…Ñ ¡•ÉÉ½È¥ì½¹Í½±”¹•ÉÉ½È ‰MåÍÑ•´‘¥…±½œ½Ý¹•È™…¥±•Ñ¼±½…èˆ±•ÉÉ½È¤ìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ˜™ÑåÁ•½˜Ý¥¹‘½Ü¹ÉÁ½¹™¥É´ôôô‰™Õ¹Ñ¥½¸ˆì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÉÕ¹MåÍÑ•µM…Ù•Ñ¥½¸¡‰ÕÑÑ½¸¥ì(€€€€€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑMåÍÑ•µ	ÕÍäôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑMåÍÑ•µ	ÕÍäôˆÄˆì(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÍ…Ù•õÑåÁ•½˜Ý¥¹‘½Ü¹Í…Ù•…µ”ôôô‰™Õ¹Ñ¥½¸ˆýÝ¥¹‘½Ü¹Í…Ù•…µ” ¤é™…±Í”ì(€€€€€€€€€€€½¹ÍÐÉ•…‘äõ…Ý…¥Ð•¹ÍÕÉ•IÁ¥…±½=Ý¹•È ‰ÍåÍÑ•´µÍ…Ù”µ™••‘‰…¬ˆ¤ì(€€€€€€€€€€€½¹ÍÐÍÕ•ÍÌõÍ…Ù•„ôõ™…±Í”ì(€€€€€€€€€€€¥˜¡É•…‘ä¥ì(€€€€€€€€€€€€€€€…Ý…¥ÐÝ¥¹‘½Ü¹ÉÁ±•ÉÐ (€€€€€€€€€€€€€€€€€€€ÍÕ•ÍÌü‹–ÞË–º3š"Cš&/–.W–¶cšªSŽˆè‹žn»–&7ž‡šÎW–º3š"Cš&/–.W–¶cšªSŽˆ°(€€€€€€€€€€€€€€€€€€€íÑ¥Ñ±”è‹¦+š"Ë–¶cšªPˆ±½¹™¥ÉµQ•áÐè‹¢þS–n{žÎïžÖÄˆ±Ñ½¹”éÍÕ•ÍÌü‰ÍÕ•ÍÌˆè‰¹½Éµ…°‰ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€õ•±Í”¥˜¡ÑåÁ•½˜Ý¥¹‘½Ü¹…±•ÉÐôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹…±•ÉÐ¡ÍÕ•ÍÌü‹–ÞË–º3š"Cš&/–.W–¶cšªSŽˆè‹žn»–&7ž‡šÎW–º3š"Cš&/–.W–¶cšªSŽˆ¤ì(€€€€€€€€€€€ô(€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€‘•±•Ñ”‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑMåÍÑ•µ	ÕÍäì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€ô(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÉÕ¹MåÍÑ•µ•±•Ñ•Ñ¥½¸¡‰ÕÑÑ½¸¥ì(€€€€€€€¥˜¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑMåÍÑ•µ	ÕÍäôôôˆÄˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑMåÍÑ•µ	ÕÍäôˆÄˆì(€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÉ•…‘äõ…Ý…¥Ð•¹ÍÕÉ•IÁ¥…±½=Ý¹•È ‰ÍåÍÑ•´µ‘•±•Ñ”µ½¹™¥É´ˆ¤ì(€€€€€€€€€€€¥˜¡É•…‘ä˜™ÑåÁ•½˜Ý¥¹‘½Ü¹É•Í•Ñ…µ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€…Ý…¥ÐÝ¥¹‘½Ü¹É•Í•Ñ…µ” ¤ì(€€€€€€€€€€€ô(€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€‘•±•Ñ”‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ØÄÜÑMåÍÑ•µ	ÕÍäì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¥¹Ñ•É•ÁÑMåÍÑ•µÑ¥½¸¡•Ù•¹Ð¥ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¸õ•Ù•¹Ð¹Ñ…É•Ð˜™•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ˜™•Ù•¹Ð¹Ñ…É•Ð¹±½Í•ÍÐ ˆ¹ÍåÍÑ•´µÁ…¹•°µÉ½Ü€¹¡½µ”µ™•…ÑÕÉ”µ‰Õäµ‰Ñ¸ˆ¤ì(€€€€€€€¥˜ …‰ÕÑÑ½¸¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐÑ¥Ñ±”õÍåÍÑ•µI½ÝQ¥Ñ±”¡‰ÕÑÑ½¸¤ì(€€€€€€€¥˜¡Ñ¥Ñ±”„ôô‹¦+š"Ë–¶cšªPˆ˜™Ñ¥Ñ±”„ôô‹–"«¦f“¢žK¢&Èˆ¥ìÉ•ÑÕÉ¸ìô((€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€•Ù•¹Ð¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ì(€€€€€€€¥˜¡Ñ¥Ñ±”ôôô‹¦+š"Ë–¶cšªPˆ¥ìÙ½¥ÉÕ¹MåÍÑ•µM…Ù•Ñ¥½¸¡‰ÕÑÑ½¸¤ìô(€€€€€€€•±Í•ìÙ½¥ÉÕ¹MåÍÑ•µ•±•Ñ•Ñ¥½¸¡‰ÕÑÑ½¸¤ìô(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•MåÍÑ•µ¥…±½9…Ù¥…Ñ¥½¸ ¥ì(€€€€€€€½¹ÍÐ±…å•Èõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄØåIÁ¥…±½1…å•Èˆ¤ì(€€€€€€€¥˜ …±…å•Éñð…±…å•È¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐÑ¥Ñ±”õ±…å•È¹ÅÕ•ÉåM•±•Ñ½È ˆØÄØåIÁ¥…±½Q¥Ñ±”ˆ¤ì(€€€€€€€¥˜¡MÑÉ¥¹œ¡Ñ¥Ñ±”˜™Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ññðˆˆ¤¹ÑÉ¥´ ¤„ôô‹–"«¦f“¢žK¢&Èˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐ…¹•°õ±…å•È¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ØÄØäµÉÁœµ‘¥…±½œµ…Ñ¥½¹Ì€¹ØÄØäµÉÁœµ‘¥…±½œµ‰ÕÑÑ½¸¹Í•½¹‘…Éäˆ¤ì(€€€€€€€¥˜¡…¹•°˜˜……¹•°¹¡¥‘‘•¸˜™…¹•°¹Ñ•áÑ½¹Ñ•¹Ð„ôô‹¢þS–n{žÎïžÖÄˆ¥ì(€€€€€€€€€€€…¹•°¹Ñ•áÑ½¹Ñ•¹Ðô‹¢þS–n{žÎïžÖÄˆì(€€€€€€€€€€€…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹¢þS–n{žÎïžÖÇ¾ò3’â7–"«¦f“¢žK¢&Èˆ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±ä ¥ì(€€€€€€€¹½Éµ…±¥é•½±‘	ÕÑÑ½¹Q•áÑM¡…‘½ÝÌ ¤ì(€€€€€€€¹½Éµ…±¥é•MåÍÑ•µ¥…±½9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€•¹ÍÕÉ•MÑå±•Í¡••Ñ1…ÍÐ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡•‘Õ±” ¥ì(€€€€€€€¥˜¡É…™%¥ìÉ•ÑÕÉ¸ìô(€€€€€€€É…™%õÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤ôùì(€€€€€€€€€€€É…™%ôÀì(€€€€€€€€€€€…ÁÁ±ä ¤ì(€€€€€€€ô¤ì(€€€ô((€€€½¹ÍÐÉ½½ÑÌõl(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤°(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰É•…Ñ¥½¹A…”ˆ¤°(€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰ØÄØåIÁ¥…±½1…å•Èˆ¤(€€€t¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€¥˜¡ÑåÁ•½˜5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È„ôô‰Õ¹‘•™¥¹•ˆ˜™É½½ÑÌ¹±•¹Ñ ¥ì(€€€€€€€½¹ÍÐ½‰Í•ÉÙ•Èõ¹•Ü5ÕÑ…Ñ¥½¹=‰Í•ÉÙ•È¡Í¡•‘Õ±”¤ì(€€€€€€€É½½ÑÌ¹™½É… ¡É½½Ðôù½‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡É½½Ð±ì(€€€€€€€€€€€¡¥±‘1¥ÍÐéÑÉÕ”°(€€€€€€€€€€€ÍÕ‰ÑÉ•”éÑÉÕ”°(€€€€€€€€€€€¡…É…Ñ•É…Ñ„éÑÉÕ”°(€€€€€€€€€€€…ÑÑÉ¥‰ÕÑ•ÌéÑÉÕ”°(€€€€€€€€€€€…ÑÑÉ¥‰ÕÑ•¥±Ñ•Èél‰±…ÍÌˆ°‰ÍÑå±”ˆ°‰‘¥Í…‰±•‰t(€€€€€€€ô¤¤ì(€€€ô((€€€½¹ÍÐÍåÍÑ•µI½½Ðõ‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€¥˜¡ÍåÍÑ•µI½½Ð¥ìÍåÍÑ•µI½½Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±¥¹Ñ•É•ÁÑMåÍÑ•µÑ¥½¸±ÑÉÕ”¤ìô(€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ØÄÜÌéÉÕ¹Ñ¥µ”µÉ•…‘äˆ±Í¡•‘Õ±”±íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì(€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•Í¥é”ˆ±Í¡•‘Õ±”±íÁ…ÍÍ¥Ù”éÑÉÕ•ô¤ì((€€€¥˜¡‘½Õµ•¹Ð¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥ì(€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±Í¡•‘Õ±”±í½¹”éÑÉÕ•ô¤ì(€€€õ•±Í•ì(€€€€€€€Í¡•‘Õ±” ¤ì(€€€ô((€€€Ý¥¹‘½Ü¹ØÄÜÑÁÁ±åU¥I•É•ÍÍ¥½¹Õ…É‘ÌõÍ¡•‘Õ±”ì)ô¤ ¤ì(((¼¨‰Õ¹‘±•Í½ÕÉ”è©Ì½É•±•…Í”µÕÁ‘…Ñ”µ¹½Ñ¥™¥…Ñ¥½¸¹©Ì€¨¼(¼¨(€€I•±•…Í”UÁ‘…Ñ”9½Ñ¥™¥…Ñ¥½¸MåÍÑ•´(€€€´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´(€€A±…å•Èµ™…¥¹œÉ•±•…Í”¹½Ñ¥•Ì…É”½Ý¹•‰äÉ•±•…Í”½É•±•…Í”µÕÁ‘…Ñ”¹©Í½¸¸(€€Q¡¥Ì…ÁÀµÍ¡•±°µ½‘Õ±”‘•±¥‰•É…Ñ•±äÉ•ÕÍ•Ì€¡½µ••…ÑÕÉ•5½‘…°…¹Ñ¡”¹…Ñ¥Ù”(€€€…µ”µ½Ù•É±…äµ±…å•Èì¥Ð‘½•Ì¹½Ð¥¹ÑÉ½‘Õ”„Í•½¹µ½‘…°½È…¹¹½Õ¹•µ•¹Ð(€€™É…µ•Ý½É¬¸(¨¼(¡™Õ¹Ñ¥½¸¥¹ÍÑ…±±I•±•…Í•UÁ‘…Ñ•9½Ñ¥™¥…Ñ¥½¸¡±½‰…°¥ì(€€€€‰ÕÍ”ÍÑÉ¥Ðˆì((€€€¥˜ …±½‰…±ññ±½‰…°¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¥ìÉ•ÑÕÉ¸ìô((€€€½¹ÍÐI1M}9=Q%}AQ ô‰É•±•…Í”½É•±•…Í”µÕÁ‘…Ñ”¹©Í½¸ˆì(€€€½¹ÍÐ!-}%9QIY1}5LôÐ¨ØÀ¨ÄÀÀÀì(€€€½¹ÍÐ5%9}!-}A}5LôÐÔ¨ÄÀÀÀì(€€€½¹ÍÐI5%9I}==1=]9}5LôÈÀ¨ØÀ¨ÄÀÀÀì(€€€½¹ÍÐIEUMQ}Q%5=UQ}5LôàÀÀÀì(€€€½¹ÍÐA9%9}I!-}5LôÄÔÀÀì(€€€½¹ÍÐMQ=I}95MAô‰™½ÕÈµÍåµ‰½±ÌéÉ•±•…Í”µÕÁ‘…Ñ”èˆì(€€€½¹ÍÐY}AIY%]}EUIdô‰É•±•…Í•UÁ‘…Ñ•AÉ•Ù¥•Üˆì(€€€½¹ÍÐY}AIY%]}!=MQLõ¹•ÜM•Ð¡l(€€€€€€€€‰‘•Ø¹™½ÕÈµÍåµ‰½±Ìµ‘•Ø¹Á…•Ì¹‘•Øˆ°(€€€€€€€€‰±½…±¡½ÍÐˆ°(€€€€€€€€ˆÄÈÜ¸À¸À¸Äˆ°(€€€€€€€€ˆèèÄˆ(€€€t¤ì((€€€½¹ÍÐÍÑ…Ñ”õì(€€€€€€€ÍÑ…ÉÑ•é™…±Í”°(€€€€€€€¡•­¥¹œé¹Õ±°°(€€€€€€€±…ÍÑ¡•­ÐèÀ°(€€€€€€€µ…¹¥™•ÍÐé¹Õ±°°(€€€€€€€±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸é¹Õ±°°(€€€€€€€µ…ÉÅÕ•”é¹Õ±°°(€€€€€€€Á½±±Q¥µ•Èé¹Õ±°°(€€€€€€€Á•¹‘¥¹Q¥µ•Èé¹Õ±°°(€€€€€€€Á•¹‘¥¹9½Éµ…±I•±½…é™…±Í”°(€€€€€€€Á•¹‘¥¹½É•‘UÁ‘…Ñ”é™…±Í”°(€€€€€€€Á•¹‘¥¹¹¹½Õ¹•µ•¹Ðé™…±Í”°(€€€€€€€±½¥¹¹¹½Õ¹•µ•¹ÑM¡½Ý¸é™…±Í”°(€€€€€€€™½É•‘5½‘…±1½¬é™…±Í”°(€€€€€€€µ½‘…±=Á•¸é™…±Í”°(€€€€€€€µ½‘…±-¥¹é¹Õ±°°(€€€€€€€‘•ÙAÉ•Ù¥•Ý5½‘”é¹Õ±°°(€€€€€€€É¥Ñ¥…±=Á•É…Ñ¥½¹Ìé¹•Ü5…À ¤°(€€€€€€€¹•áÑ=Á•É…Ñ¥½¹%èÄ(€€€ôì((€€€™Õ¹Ñ¥½¸¹½Ü ¥ìÉ•ÑÕÉ¸…Ñ”¹¹½Ü ¤ìô((€€€™Õ¹Ñ¥½¸•Ñ1½…Ñ¥½¹!½ÍÑ¹…µ” ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐ±½…Ñ¥½¸õ±½‰…°¹±½…Ñ¥½¸ì(€€€€€€€€€€€½¹ÍÐ¡½ÍÑ¹…µ”õMÑÉ¥¹œ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡½ÍÑ¹…µ•ñðˆˆ¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€¹É•Á±…” ½yqmñqt½œ°ˆˆ¤ì(€€€€€€€€€€€¥˜¡¡½ÍÑ¹…µ”¥ìÉ•ÑÕÉ¸¡½ÍÑ¹…µ”ìô(€€€€€€€€€€€½¹ÍÐ¡É•˜õMÑÉ¥¹œ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡É•™ñðˆˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸¡É•˜ý¹•ÜUI0¡¡É•˜¤¹¡½ÍÑ¹…µ”¹Ñ½1½Ý•É…Í” ¤¹É•Á±…” ½yqmñqt½œ°ˆˆ¤èˆˆì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ•ÙAÉ•Ù¥•Ý5½‘” ¥ì(€€€€€€€¥˜ …Y}AIY%]}!=MQL¹¡…Ì¡•Ñ1½…Ñ¥½¹!½ÍÑ¹…µ” ¤¤¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐ±½…Ñ¥½¸õ±½‰…°¹±½…Ñ¥½¸ì(€€€€€€€€€€€½¹ÍÐ‰…Í”ô¡±½‰…°¹‘½Õµ•¹Ð˜™±½‰…°¹‘½Õµ•¹Ð¹‰…Í•UI$¥ñð¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡É•˜¥ññÕ¹‘•™¥¹•ì(€€€€€€€€€€€½¹ÍÐµ½‘”õ¹•ÜUI0¡MÑÉ¥¹œ¡±½…Ñ¥½¸˜™±½…Ñ¥½¸¹¡É•™ñðˆˆ¤±‰…Í”¤(€€€€€€€€€€€€€€€€¹Í•…É¡A…É…µÌ(€€€€€€€€€€€€€€€€¹•Ð¡Y}AIY%]}EUId¤ì(€€€€€€€€€€€É•ÑÕÉ¸µ½‘”ôôô‰µ…ÉÅÕ•”‰ññµ½‘”ôôô‰µ½‘…°ˆýµ½‘”é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐÉ…ÜõMÑÉ¥¹œ¡Ù…±Õ”ôõ¹Õ±°üˆˆéÙ…±Õ”¤¹ÑÉ¥´ ¤¹É•Á±…” ½yX½¤°ˆˆ¤ì(€€€€€€€É•ÑÕÉ¸É…Ü€ü€‰Xˆ­É…Ü€è€ˆˆì(€€€ô((€€€™Õ¹Ñ¥½¸Á…ÉÍ•Y•ÉÍ¥½¸¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•õ¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¤¹É•Á±…” ½yX¼°ˆˆ¤ì(€€€€€€€¥˜ „½yq¬ üép¹q¬¤¬¼¹Ñ•ÍÐ¡¹½Éµ…±¥é•¤¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸¹½Éµ…±¥é•¹ÍÁ±¥Ð ˆ¸ˆ¤¹µ…À¡Á…ÉÐôù9Õµ‰•È¡Á…ÉÐ¤¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½µÁ…É•Y•ÉÍ¥½¹Ì¡±•™Ð±É¥¡Ð¥ì(€€€€€€€½¹ÍÐ„õÁ…ÉÍ•Y•ÉÍ¥½¸¡±•™Ð¤ì(€€€€€€€½¹ÍÐˆõÁ…ÉÍ•Y•ÉÍ¥½¸¡É¥¡Ð¤ì(€€€€€€€¥˜ ……ñð…ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍÐ±•¹Ñ õ5…Ñ ¹µ…à¡„¹±•¹Ñ ±ˆ¹±•¹Ñ ¤ì(€€€€€€€™½È¡±•Ð¥¹‘•àôÀí¥¹‘•àñ±•¹Ñ í¥¹‘•à¬¬¥ì(€€€€€€€€€€€½¹ÍÐ‘•±Ñ„ô¡…m¥¹‘•áuñðÀ¤´¡‰m¥¹‘•áuñðÀ¤ì(€€€€€€€€€€€¥˜¡‘•±Ñ„„ôôÀ¥ìÉ•ÑÕÉ¸‘•±Ñ„øÀüÄè´Äìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸€Àì(€€€ô((€€€™Õ¹Ñ¥½¸•Í…Á•!Ñµ°¡Ù…±Õ”¥ì(€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ôõ¹Õ±°üˆˆéÙ…±Õ”¤(€€€€€€€€€€€€¹É•Á±…” ¼˜½œ°ˆ™…µÀìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ð½œ°ˆ™±Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼ø½œ°ˆ™Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ½pˆ½œ°ˆ™ÅÕ½Ðìˆ¤(€€€€€€€€€€€€¹É•Á±…” ¼œ½œ°ˆ˜ŒÀÌäìˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¥ì(€€€€€€€½¹ÍÐ‰Õ¥±õ±½‰…°¹}}=UI}Me5	=1M}	U%1}|ì(€€€€€€€½¹ÍÐÙ…±Õ”õ‰Õ¥±˜™‰Õ¥±¹É•±•…Í”ì(€€€€€€€É•ÑÕÉ¸¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑMÑ½É…” ¥ì(€€€€€€€ÑÉåìÉ•ÑÕÉ¸±½‰…°¹±½…±MÑ½É…•ññ¹Õ±°ìô(€€€€€€€…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ½É…•-•ä¡ÍÕ™™¥à¥ì(€€€€€€€½¹ÍÐÉ•Á½Í¥Ñ½Éäõ±½‰…°¹½ÕÉMåµ‰½±Í½Õ¹ÑM…Ù”ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡É•Á½Í¥Ñ½Éä˜™ÑåÁ•½˜É•Á½Í¥Ñ½Éä¹…½Õ¹Ñ-•äôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸É•Á½Í¥Ñ½Éä¹…½Õ¹Ñ-•ä ‰É•±•…Í”µÕÁ‘…Ñ”´ˆ­ÍÕ™™¥à¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€€€€€É•ÑÕÉ¸MQ=I}95MA­ÍÕ™™¥àì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘MÑ½É…”¡ÍÕ™™¥à¥ì(€€€€€€€½¹ÍÐÍÑ½É…”õ•ÑMÑ½É…” ¤ì(€€€€€€€¥˜ …ÍÑ½É…”¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€ÑÉåìÉ•ÑÕÉ¸ÍÑ½É…”¹•Ñ%Ñ•´¡ÍÑ½É…•-•ä¡ÍÕ™™¥à¤¤ìô(€€€€€€€…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸ÝÉ¥Ñ•MÑ½É…”¡ÍÕ™™¥à±Ù…±Õ”¥ì(€€€€€€€½¹ÍÐÍÑ½É…”õ•ÑMÑ½É…” ¤ì(€€€€€€€¥˜ …ÍÑ½É…”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÑÉåìÍÑ½É…”¹Í•Ñ%Ñ•´¡ÍÑ½É…•-•ä¡ÍÕ™™¥à¤±MÑÉ¥¹œ¡Ù…±Õ”¤¤ìô(€€€€€€€…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸É•µ½Ù•MÑ½É…”¡ÍÕ™™¥à¥ì(€€€€€€€½¹ÍÐÍÑ½É…”õ•ÑMÑ½É…” ¤ì(€€€€€€€¥˜ …ÍÑ½É…”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜ÍÑ½É…”¹É•µ½Ù•%Ñ•´ôôô‰™Õ¹Ñ¥½¸ˆ¥ìÍÑ½É…”¹É•µ½Ù•%Ñ•´¡ÍÑ½É…•-•ä¡ÍÕ™™¥à¤¤ìô(€€€€€€€õ…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸±½…±…Ñ•-•ä¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐ‘…Ñ”õ¹•Ü…Ñ”¡Ù…±Õ”ôõ¹Õ±°ý¹½Ü ¤éÙ…±Õ”¤ì(€€€€€€€¥˜¡9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€€€€€½¹ÍÐåååäõ‘…Ñ”¹•ÑÕ±±e•…È ¤ì(€€€€€€€½¹ÍÐµ´õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¤ì(€€€€€€€½¹ÍÐ‘õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¤ì(€€€€€€€É•ÑÕÉ¸åååä¬ˆ´ˆ­µ´¬ˆ´ˆ­‘ì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘Q½‘…åMÕÁÁÉ•ÍÍ¥½¸ ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÙ…±Õ”õ)M=8¹Á…ÉÍ”¡É•…‘MÑ½É…” ‰ÍÕÁÁÉ•ÍÌµÑ½‘…äˆ¥ñð‰¹Õ±°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Ù…±Õ”˜™ÑåÁ•½˜Ù…±Õ”ôôô‰½‰©•ÐˆýÙ…±Õ”é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡µ…¹¥™•ÍÐ¥ì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐÙ…±Õ”õÉ•…‘Q½‘…åMÕÁÁÉ•ÍÍ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€Ù…±Õ”˜˜(€€€€€€€€€€€Ù…±Õ”¹¹½Ñ¥•%ôôõµ…¹¥™•ÍÐ¹¹½Ñ¥•%˜˜(€€€€€€€€€€€Ù…±Õ”¹‘…Ñ•-•äôôõ±½…±…Ñ•-•ä ¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•ÑÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡•¹…‰±•¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡•¹…‰±•¥ì(€€€€€€€€€€€ÝÉ¥Ñ•MÑ½É…” ‰ÍÕÁÁÉ•ÍÌµÑ½‘…äˆ±)M=8¹ÍÑÉ¥¹¥™ä¡ì(€€€€€€€€€€€€€€€¹½Ñ¥•%éµ…¹¥™•ÍÐ¹¹½Ñ¥•%°(€€€€€€€€€€€€€€€‘…Ñ•-•äé±½…±…Ñ•-•ä ¤(€€€€€€€€€€€ô¤¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€É•µ½Ù•MÑ½É…” ‰ÍÕÁÁÉ•ÍÌµÑ½‘…äˆ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Ù…±¥‘…Ñ•5…¹¥™•ÍÐ¡Ù…±Õ”¥ì(€€€€€€€¥˜ …Ù…±Õ•ññÑåÁ•½˜Ù…±Õ”„ôô‰½‰©•Ð‰ññÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ”¤¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍÐÉ•±•…Í•Y•ÉÍ¥½¸õ¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¹É•±•…Í•Y•ÉÍ¥½¸¤ì(€€€€€€€½¹ÍÐÕÁ‘…Ñ•5½‘”õÙ…±Õ”¹ÕÁ‘…Ñ•5½‘”ì(€€€€€€€½¹ÍÐµ¥¹¥µÕµY•ÉÍ¥½¸õÙ…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸ôôõ¹Õ±±ññÙ…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸ôôõÕ¹‘•™¥¹•‘ññÙ…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸ôôôˆˆ(€€€€€€€€€€€€ü¹Õ±°(€€€€€€€€€€€€è¹½Éµ…±¥é•Y•ÉÍ¥½¸¡Ù…±Õ”¹µ¥¹¥µÕµY•ÉÍ¥½¸¤ì(€€€€€€€½¹ÍÐ½¹Ñ•¹ÐõÉÉ…ä¹¥ÍÉÉ…ä¡Ù…±Õ”¹½¹Ñ•¹Ð¤ýÙ…±Õ”¹½¹Ñ•¹Ðé¹Õ±°ì(€€€€€€€¥˜ (€€€€€€€€€€€Ù…±Õ”¹Í¡•µ…Y•ÉÍ¥½¸„ôôÅñð(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹ÁÕ‰±¥9½Ñ¥”„ôô‰‰½½±•…¸‰ñð(€€€€€€€€€€€€…Á…ÉÍ•Y•ÉÍ¥½¸¡É•±•…Í•Y•ÉÍ¥½¸¥ñð(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹¹½Ñ¥•%„ôô‰ÍÑÉ¥¹œ‰ñð…Ù…±Õ”¹¹½Ñ¥•%¹ÑÉ¥´ ¥ñð(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹Ñ¥Ñ±”„ôô‰ÍÑÉ¥¹œ‰ñð…Ù…±Õ”¹Ñ¥Ñ±”¹ÑÉ¥´ ¥ñð(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹ÍÕµµ…Éä„ôô‰ÍÑÉ¥¹œ‰ñð…Ù…±Õ”¹ÍÕµµ…Éä¹ÑÉ¥´ ¥ñð(€€€€€€€€€€€€…½¹Ñ•¹Ñññ½¹Ñ•¹Ð¹±•¹Ñ ôôôÁññ½¹Ñ•¹Ð¹Í½µ”¡¥Ñ•´ôùÑåÁ•½˜¥Ñ•´„ôô‰ÍÑÉ¥¹œ‰ñð…¥Ñ•´¹ÑÉ¥´ ¤¥ñð(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”¹ÁÕ‰±¥Í¡•‘Ð„ôô‰ÍÑÉ¥¹œ‰ñð…Ù…±Õ”¹ÁÕ‰±¥Í¡•‘Ð¹ÑÉ¥´ ¥ñð(€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡…Ñ”¹Á…ÉÍ”¡Ù…±Õ”¹ÁÕ‰±¥Í¡•‘Ð¤¥ñð(€€€€€€€€€€€€¡ÕÁ‘…Ñ•5½‘”„ôô‰¹½Éµ…°ˆ˜™ÕÁ‘…Ñ•5½‘”„ôô‰™½É•ˆ¥ñð(€€€€€€€€€€€€¡µ¥¹¥µÕµY•ÉÍ¥½¸„ôõ¹Õ±°˜˜…Á…ÉÍ•Y•ÉÍ¥½¸¡µ¥¹¥µÕµY•ÉÍ¥½¸¤¤(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€Í¡•µ…Y•ÉÍ¥½¸èÄ°(€€€€€€€€€€€ÁÕ‰±¥9½Ñ¥”éÙ…±Õ”¹ÁÕ‰±¥9½Ñ¥”°(€€€€€€€€€€€É•±•…Í•Y•ÉÍ¥½¸°(€€€€€€€€€€€¹½Ñ¥•%éÙ…±Õ”¹¹½Ñ¥•%¹ÑÉ¥´ ¤°(€€€€€€€€€€€Ñ¥Ñ±”éÙ…±Õ”¹Ñ¥Ñ±”¹ÑÉ¥´ ¤°(€€€€€€€€€€€ÍÕµµ…ÉäéÙ…±Õ”¹ÍÕµµ…Éä¹ÑÉ¥´ ¤°(€€€€€€€€€€€½¹Ñ•¹Ðé½¹Ñ•¹Ð¹µ…À¡¥Ñ•´ôù¥Ñ•´¹ÑÉ¥´ ¤¤°(€€€€€€€€€€€ÁÕ‰±¥Í¡•‘ÐéÙ…±Õ”¹ÁÕ‰±¥Í¡•‘Ð°(€€€€€€€€€€€ÕÁ‘…Ñ•5½‘”°(€€€€€€€€€€€µ¥¹¥µÕµY•ÉÍ¥½¸(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸¡…ÍU¹É•…‘I•±•…Í•9½Ñ¥” ¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€½¹ÍÐ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñð…µ…¹¥™•ÍÐ¹ÁÕ‰±¥9½Ñ¥•ñð…±½…‘•¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤„ôôÀ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€É•…‘MÑ½É…” ‰±…ÍÐµÍ••¸µÙ•ÉÍ¥½¸ˆ¤„ôõµ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¹ñð(€€€€€€€€€€€É•…‘MÑ½É…” ‰±…ÍÐµÍ••¸µ¹½Ñ¥”ˆ¤„ôõµ…¹¥™•ÍÐ¹¹½Ñ¥•%(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÝÉ¥Ñ•MÑ½É…” ‰±…ÍÐµÍ••¸µÙ•ÉÍ¥½¸ˆ±µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤ì(€€€€€€€ÝÉ¥Ñ•MÑ½É…” ‰±…ÍÐµÍ••¸µ¹½Ñ¥”ˆ±µ…¹¥™•ÍÐ¹¹½Ñ¥•%¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Õ±‘ÕÑ½M¡½Ý1½¥¹¹¹½Õ¹•µ•¹Ð¡µ…¹¥™•ÍÐ¥ì(€€€€€€€½¹ÍÐ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€¥˜ (€€€€€€€€€€€ÍÑ…Ñ”¹±½¥¹¹¹½Õ¹•µ•¹ÑM¡½Ý¹ñð(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ññð(€€€€€€€€€€€€…µ…¹¥™•ÍÑñð(€€€€€€€€€€€€…µ…¹¥™•ÍÐ¹ÁÕ‰±¥9½Ñ¥•ñð(€€€€€€€€€€€€…±½…‘•‘ñð(€€€€€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤„ôôÀ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸€…¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡µ…¹¥™•ÍÐ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¥ÍM¡…É•‘5½‘…±Ù…¥±…‰±•½É¹¹½Õ¹•µ•¹Ð ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€Á…ÉÑÌ˜˜(€€€€€€€€€€€€ …Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÑñð…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•…‘I•µ¥¹‘•È ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€½¹ÍÐÙ…±Õ”õ)M=8¹Á…ÉÍ”¡É•…‘MÑ½É…” ‰±…ÍÐµÉ•µ¥¹‘•Èˆ¥ñð‰¹Õ±°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Ù…±Õ”˜™ÑåÁ•½˜Ù…±Õ”ôôô‰½‰©•ÐˆýÙ…±Õ”é¹Õ±°ì(€€€€€€€õ…Ñ ¡|¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Õ±‘M¡½ÝI•µ¥¹‘•È¡µ…¹¥™•ÍÐ¥ì(€€€€€€€½¹ÍÐÉ•µ¥¹‘•ÈõÉ•…‘I•µ¥¹‘•È ¤ì(€€€€€€€É•ÑÕÉ¸€…É•µ¥¹‘•ÉññÉ•µ¥¹‘•È¹¹½Ñ¥•%„ôõµ…¹¥™•ÍÐ¹¹½Ñ¥•%‘ññ¹½Ü ¤µ9Õµ‰•È¡É•µ¥¹‘•È¹…ÑñðÀ¤øõI5%9I}==1=]9}5Lì(€€€ô((€€€™Õ¹Ñ¥½¸É•µ•µ‰•ÉI•µ¥¹‘•È¡µ…¹¥™•ÍÐ¥ì(€€€€€€€ÝÉ¥Ñ•MÑ½É…” ‰±…ÍÐµÉ•µ¥¹‘•Èˆ±)M=8¹ÍÑÉ¥¹¥™ä¡í¹½Ñ¥•%éµ…¹¥™•ÍÐ¹¹½Ñ¥•%±…Ðé¹½Ü ¥ô¤¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑU¹Í…™•I•…Í½¹Ì ¥ì(€€€€€€€½¹ÍÐÉ•…Í½¹Ìõmtì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜‰…ÑÑ±•Ñ¥Ù”„ôô‰Õ¹‘•™¥¹•ˆ˜™‰…ÑÑ±•Ñ¥Ù”¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰‰…ÑÑ±”ˆ¤ìô(€€€€€€€€€€€¥˜¡ÑåÁ•½˜‰…ÑÑ±•A¡…Í”„ôô‰Õ¹‘•™¥¹•ˆ˜™‰…ÑÑ±•A¡…Í”ôôô‰É•Í½±Ù”ˆ¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰‰…ÑÑ±”µÉ•Í½±ÕÑ¥½¸ˆ¤ìô(€€€€€€€õ…Ñ ¡|¥ìô(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜ (€€€€€€€€€€€€€€€±½‰…°¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü˜˜(€€€€€€€€€€€€€€€ÑåÁ•½˜±½‰…°¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù”ôôô‰™Õ¹Ñ¥½¸ˆ˜˜(€€€€€€€€€€€€€€€±½‰…°¹½ÕÉMåµ‰½±Í	…ÑÑ±•±½Ü¹¥ÍAÉ•Í•¹Ñ…Ñ¥½¹Ñ¥Ù” ¤(€€€€€€€€€€€€¥ì(€€€€€€€€€€€€€€€É•…Í½¹Ì¹ÁÕÍ  ‰‰…ÑÑ±”µÁÉ•Í•¹Ñ…Ñ¥½¸ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹Í¥é”¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰É¥Ñ¥…°µ½Á•É…Ñ¥½¸ˆ¤ìô((€€€€€€€½¹ÍÐ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ðì(€€€€€€€¥˜ …‘½Õµ•¹ÑI•™ññÑåÁ•½˜‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å%„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸É•…Í½¹Ììô(€€€€€€€½¹ÍÐÉ•Ý…Éõ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰ØÄÌÉI•Ý…É‘5½‘…°ˆ¤ì(€€€€€€€¥˜¡É•Ý…É˜™É•Ý…É¹±…ÍÍ1¥ÍÐ˜™É•Ý…É¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰É•Ý…Éˆ¤ìô(€€€€€€€½¹ÍÐ‘¥…±½œõ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰ØÄØåIÁ¥…±½1…å•Èˆ¤ì(€€€€€€€¥˜¡‘¥…±½œ˜™‘¥…±½œ¹±…ÍÍ1¥ÍÐ˜™‘¥…±½œ¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤¥ìÉ•…Í½¹Ì¹ÁÕÍ  ‰ÑÉ…¹Í…Ñ¥½¸µ‘¥…±½œˆ¤ìô(€€€€€€€½¹ÍÐµ½‘…°õ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€€€€€¥˜ (€€€€€€€€€€€µ½‘…°˜™µ½‘…°¹±…ÍÍ1¥ÍÐ˜™µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¤˜˜(€€€€€€€€€€€€…µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰É•±•…Í”µÕÁ‘…Ñ”µµ½‘…°ˆ¤˜˜(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰ØÄÐÄµÍå¹Ñ¡•Í¥Ìµµ½‘…°ˆ¥ñð(€€€€€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰ØÄÌÄµÍ¡½Àµ½Á•¸ˆ¥ñð(€€€€€€€€€€€€€€€µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Ñ•…´µÉ•±¥Œµµ½‘…°ˆ¤(€€€€€€€€€€€€¤(€€€€€€€€¥ì(€€€€€€€€€€€É•…Í½¹Ì¹ÁÕÍ  ‰¡¥ µÙ…±Õ”µ™•…ÑÕÉ”ˆ¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸É•…Í½¹Ìì(€€€ô((€€€™Õ¹Ñ¥½¸…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¥ì(€€€€€€€É•ÑÕÉ¸•ÑU¹Í…™•I•…Í½¹Ì ¤¹±•¹Ñ ôôôÀì(€€€ô((€€€™Õ¹Ñ¥½¸‰•¥¹É¥Ñ¥…±=Á•É…Ñ¥½¸¡±…‰•°¥ì(€€€€€€€½¹ÍÐ½Á•É…Ñ¥½¹%õÍÑ…Ñ”¹¹•áÑ=Á•É…Ñ¥½¹%¬¬ì(€€€€€€€±•Ð…Ñ¥Ù”õÑÉÕ”ì(€€€€€€€ÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹Í•Ð¡½Á•É…Ñ¥½¹%±MÑÉ¥¹œ¡±…‰•±ñð‰É¥Ñ¥…°µ½Á•É…Ñ¥½¸ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸™Õ¹Ñ¥½¸•¹‘É¥Ñ¥…±=Á•É…Ñ¥½¸ ¥ì(€€€€€€€€€€€¥˜ ……Ñ¥Ù”¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€…Ñ¥Ù”õ™…±Í”ì(€€€€€€€€€€€ÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹‘•±•Ñ”¡½Á•É…Ñ¥½¹%¤ì(€€€€€€€€€€€É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¤ì(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ=Ù•É±…å1…å•È ¥ì(€€€€€€€½¹ÍÐ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ðì(€€€€€€€É•ÑÕÉ¸‘½Õµ•¹ÑI•˜˜™‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å%(€€€€€€€€€€€€ü‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰…µ”µ½Ù•É±…äµ±…å•Èˆ¤(€€€€€€€€€€€€è¹Õ±°ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•5…ÉÅÕ•” ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹µ…ÉÅÕ•”˜™ÍÑ…Ñ”¹µ…ÉÅÕ•”¹¥Í½¹¹•Ñ•„ôõ™…±Í”¥ìÉ•ÑÕÉ¸ÍÑ…Ñ”¹µ…ÉÅÕ•”ìô(€€€€€€€½¹ÍÐ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ðì(€€€€€€€½¹ÍÐ±…å•Èõ•Ñ=Ù•É±…å1…å•È ¤ì(€€€€€€€¥˜ …‘½Õµ•¹ÑI•™ñð…±…å•ÉññÑåÁ•½˜‘½Õµ•¹ÑI•˜¹É•…Ñ•±•µ•¹Ð„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍÐµ…ÉÅÕ•”õ‘½Õµ•¹ÑI•˜¹É•…Ñ•±•µ•¹Ð ‰‰ÕÑÑ½¸ˆ¤ì(€€€€€€€µ…ÉÅÕ•”¹ÑåÁ”ô‰‰ÕÑÑ½¸ˆì(€€€€€€€µ…ÉÅÕ•”¹¥ô‰É•±•…Í•UÁ‘…Ñ•5…ÉÅÕ•”ˆì(€€€€€€€µ…ÉÅÕ•”¹±…ÍÍ9…µ”ô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”ˆì(€€€€€€€µ…ÉÅÕ•”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±¥Ù”ˆ°‰Á½±¥Ñ”ˆ¤ì(€€€€€€€µ…ÉÅÕ•”¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°‹š~—žr/ž&#šr³šnÓšZÃ–Ÿ–ºäˆ¤ì(€€€€€€€µ…ÉÅÕ•”¹¥¹¹•É!Q50ô(€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ…œˆûšnÓšZÀð½ÍÁ…¸øœ¬(€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ•áÐˆøð½ÍÁ…¸øœ¬(€€€€€€€€€€€€œñÍÁ…¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µ…Ñ¥½¸ˆûš~—žr,ð½ÍÁ…¸øœì(€€€€€€€µ…ÉÅÕ•”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôùì(€€€€€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€¥˜¡ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•Ý5½‘”¥ì(€€€€€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥°¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ü‰™½É•ˆè‰ÁÉ•Ù¥•Üˆ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤˜˜……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ°‰™½É•µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥°¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ü‰™½É•ˆè‰ÕÁ‘…Ñ”ˆ¤ì(€€€€€€€ô¤ì(€€€€€€€±…å•È¹…ÁÁ•¹‘¡¥±¡µ…ÉÅÕ•”¤ì(€€€€€€€ÍÑ…Ñ”¹µ…ÉÅÕ•”õµ…ÉÅÕ•”ì(€€€€€€€É•ÑÕÉ¸µ…ÉÅÕ•”ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ±­¥¹¥ì(€€€€€€€½¹ÍÐµ…ÉÅÕ•”õ•¹ÍÕÉ•5…ÉÅÕ•” ¤ì(€€€€€€€¥˜ …µ…ÉÅÕ••ñð…µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€½¹ÍÐÑ…œõµ…ÉÅÕ•”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ…œˆ¤ì(€€€€€€€½¹ÍÐÑ•áÐõµ…ÉÅÕ•”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µÑ•áÐˆ¤ì(€€€€€€€½¹ÍÐ…Ñ¥½¸õµ…ÉÅÕ•”¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µµ…ÉÅÕ•”µ…Ñ¥½¸ˆ¤ì(€€€€€€€½¹ÍÐÁ•¹‘¥¹œõ­¥¹ôôô‰¹½Éµ…°µÁ•¹‘¥¹œ‰ññ­¥¹ôôô‰™½É•µÁ•¹‘¥¹œˆì(€€€€€€€¥˜¡Ñ…œ¥ìÑ…œ¹Ñ•áÑ½¹Ñ•¹Ðõ­¥¹˜™­¥¹¹¥¹‘•á=˜ ‰™½É•ˆ¤ôôôÀü‹¦7¢ššnÓšZÀˆè‹šnÓšZÀˆìô(€€€€€€€¥˜¡Ñ•áÐ¥ì(€€€€€€€€€€€Ñ•áÐ¹Ñ•áÑ½¹Ñ•¹ÐõÁ•¹‘¥¹œ(€€€€€€€€€€€€€€€€üµ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¬ˆƒ–ÞËžfó–â¾òožn»–&7šN7’ös–º3š"C–ú3–Â¢«–.W¦Ë¢†3šnÓšZÃŽˆ(€€€€€€€€€€€€€€€€èµ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¬ˆƒ–ÞËžfó–â¾ò0ˆ­µ…¹¥™•ÍÐ¹ÍÕµµ…Éäì(€€€€€€€ô(€€€€€€€¥˜¡…Ñ¥½¸¥ì…Ñ¥½¸¹Ñ•áÑ½¹Ñ•¹ÐõÁ•¹‘¥¹œü‹–úšnÓšZÀˆè‹š~—žr,ˆìô(€€€€€€€µ…ÉÅÕ•”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ™½É•ˆ±­¥¹˜™­¥¹¹¥¹‘•á=˜ ‰™½É•ˆ¤ôôôÀ¤ì(€€€€€€€µ…ÉÅÕ•”¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÁ•¹‘¥¹œˆ°„…Á•¹‘¥¹œ¤ì(€€€€€€€µ…ÉÅÕ•”¹¡¥‘‘•¸õ™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸¡¥‘•5…ÉÅÕ•” ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹µ…ÉÅÕ•”¥ìÍÑ…Ñ”¹µ…ÉÅÕ•”¹¡¥‘‘•¸õÑÉÕ”ìô(€€€ô((€€€™Õ¹Ñ¥½¸¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¥ì(€€€€€€€½¹ÍÐ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñð…±½…‘•¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡µ…¹¥™•ÍÐ¹ÕÁ‘…Ñ•5½‘”ôôô‰™½É•ˆ¥ìÉ•ÑÕÉ¸ÑÉÕ”ìô(€€€€€€€É•ÑÕÉ¸€„„ (€€€€€€€€€€€µ…¹¥™•ÍÐ¹µ¥¹¥µÕµY•ÉÍ¥½¸˜˜(€€€€€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍÐ¹µ¥¹¥µÕµY•ÉÍ¥½¸¤„ôõ¹Õ±°˜˜(€€€€€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍÐ¹µ¥¹¥µÕµY•ÉÍ¥½¸¤ðÀ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¥ì(€€€€€€€½¹ÍÐ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ðì(€€€€€€€¥˜ …‘½Õµ•¹ÑI•™ññÑåÁ•½˜‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å%„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€½¹ÍÐµ½‘…°õ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…°ˆ¤ì(€€€€€€€½¹ÍÐÑ¥Ñ±”õ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±Q¥Ñ±”ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘äõ‘½Õµ•¹ÑI•˜¹•Ñ±•µ•¹Ñ	å% ‰¡½µ••…ÑÕÉ•5½‘…±	½‘äˆ¤ì(€€€€€€€¥˜ …µ½‘…±ñð…Ñ¥Ñ±•ñð…‰½‘ä¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€É•ÑÕÉ¸íµ½‘…°±Ñ¥Ñ±”±‰½‘åôì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉI•±•…Í•½¹Ñ•¹Ð¡µ…¹¥™•ÍÐ±­¥¹¥ì(€€€€€€€½¹ÍÐ™½É•õ­¥¹ôôô‰™½É•ˆì(€€€€€€€½¹ÍÐÁÉ•Ù¥•Üõ­¥¹ôôô‰ÁÉ•Ù¥•Üˆì(€€€€€€€½¹ÍÐÕÁ‘…Ñ”õ­¥¹ôôô‰ÕÁ‘…Ñ”ˆì(€€€€€€€½¹ÍÐ¥¹ÑÉ¼õÁÉ•Ù¥•Ü(€€€€€€€€€€€€ü€‹žn»–&7ž
ë¦Z/žfó¦‚C¢š÷š¢‡–ò?¾òoš¶“žV¯¦v‹–>«žR£šZóšª‹š~—šnÓšZÃ–³–F+¾ò3’â7šr¦7šZÃ¢ò'–—¦+š"ËŽˆ(€€€€€€€€€€€€è™½É•(€€€€€€€€€€€€€€€€ü€‹žn»–&7ž&#šr³–ÞË–sš¶‹’öÿžR£¾ò3¢®/šnÓšZÃ–ú3žæóžê3¦+š"ËŽˆ(€€€€€€€€€€€€€€€€èÕÁ‘…Ñ”(€€€€€€€€€€€€€€€€€€€€ü€‹žfóž>ûšZÃž&#šr³Ž’öƒ–>¿–#–º3š"Cžn»–&7šN7’ös¾ò3–7šnÓšZÃ¢ÏšršZÃž&#šr³Žˆ(€€€€€€€€€€€€€€€€€€€€è€‹’î—’â/šb¿šr³š²‡š¶–ò?ž&#šr³šnÓšZÃ–Ÿ–ºçŽˆì(€€€€€€€½¹ÍÐ¹½Ñ•Ìõµ…¹¥™•ÍÐ¹½¹Ñ•¹Ð¹µ…À¡¥Ñ•´ôøˆñ±¤øˆ­•Í…Á•!Ñµ°¡¥Ñ•´¤¬ˆð½±¤øˆ¤¹©½¥¸ ˆˆ¤ì(€€€€€€€½¹ÍÐ…Ñ¥½¹ÌõÁÉ•Ù¥•Ü(€€€€€€€€€€€€ü€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰ÁÉ•Ù¥•Üµ±½Í”ˆû¦^s¦Z'¦‚C¢šôð½‰ÕÑÑ½¸øð½‘¥Øøœ(€€€€€€€€€€€€è™½É•(€€€€€€€€€€€€€€€€ü€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰É•±½…ˆûž®/–6ÏšnÓšZÀð½‰ÕÑÑ½¸øð½‘¥Øøœ(€€€€€€€€€€€€€€€€èÕÁ‘…Ñ”(€€€€€€€€€€€€€€€€€€€€ü€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰±…Ñ•Èˆûž¢7–ú3šnÓšZÀð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰É•±½…ˆûž®/–6ÏšnÓšZÀð½‰ÕÑÑ½¸øð½‘¥Øøœ(€€€€€€€€€€€€€€€€€€€€è€œñ‘¥Ø±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ô‰…­¹½Ý±•‘”ˆûš"Gž~—¦O’êð½‰ÕÑÑ½¸øð½‘¥Øøœì(€€€€€€€½¹ÍÐÍÕÁÁÉ•ÍÍQ½‘…äô…™½É•˜˜…ÕÁ‘…Ñ”(€€€€€€€€€€€€ü€œñ±…‰•°±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äˆøñ¥¹ÁÕÐ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äµ¥¹ÁÕÐˆÑåÁ”ô‰¡•­‰½àˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äô‰ÑÉÕ”ˆøñÍÁ…¸û’î+š^—’â7–7¢ÞÏ–ëš>C¦Hð½ÍÁ…¸øð½±…‰•°øœ(€€€€€€€€€€€€è€œœì(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ‘•Ñ…¥°ˆ‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ­¥¹ôˆœ­•Í…Á•!Ñµ°¡­¥¹¤¬œˆøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÙ•ÉÍ¥½¸ˆøœ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤¬ŸŽ œ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍÐ¹ÍÕµµ…Éä¤¬œð½Àøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ¥¹ÑÉ¼ˆøœ­•Í…Á•!Ñµ°¡¥¹ÑÉ¼¤¬œð½Àøœ¬(€€€€€€€€€€€€€€€€œñ ÌûšnÓšZÃ–Ÿ–ºäð½ Ìøœ¬(€€€€€€€€€€€€€€€€œñÕ°±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ¹½Ñ•Ìˆøœ­¹½Ñ•Ì¬œð½Õ°øœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÕ‰±¥Í¡•ˆûžfó–âšf¦ZO¾òhœ­•Í…Á•!Ñµ°¡™½Éµ…ÑAÕ‰±¥Í¡•‘Ð¡µ…¹¥™•ÍÐ¹ÁÕ‰±¥Í¡•‘Ð¤¤¬œð½Àøœ¬(€€€€€€€€€€€€€€€ÍÕÁÁÉ•ÍÍQ½‘…ä¬(€€€€€€€€€€€€€€€…Ñ¥½¹Ì¬(€€€€€€€€€€€€œð½Í•Ñ¥½¸øœ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑAÕ‰±¥Í¡•‘Ð¡Ù…±Õ”¥ì(€€€€€€€½¹ÍÐ‘…Ñ”õ¹•Ü…Ñ”¡Ù…±Õ”¤ì(€€€€€€€¥˜¡9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤¥ìÉ•ÑÕÉ¸Ù…±Õ”ìô(€€€€€€€½¹ÍÐåååäõ‘…Ñ”¹•ÑÕ±±e•…È ¤ì(€€€€€€€½¹ÍÐµ´õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¤ì(€€€€€€€½¹ÍÐ‘õMÑÉ¥¹œ¡‘…Ñ”¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¤ì(€€€€€€€É•ÑÕÉ¸åååä¬ˆ´ˆ­µ´¬ˆ´ˆ­‘ì(€€€ô((€€€™Õ¹Ñ¥½¸‰¥¹‘I•±•…Í•Ñ¥½¹Ì¡‰½‘ä±­¥¹¥ì(€€€€€€€¥˜ …‰½‘åññÑåÁ•½˜‰½‘ä¹ÅÕ•ÉåM•±•Ñ½É±°„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€‰½‘ä¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¹tˆ¤¹™½É… ¡‰ÕÑÑ½¸ôùì(€€€€€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ° ¤ôùì(€€€€€€€€€€€€€€€½¹ÍÐ…Ñ¥½¸õ‰ÕÑÑ½¸¹•ÑÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µÉ•±•…Í”µÕÁ‘…Ñ”µ…Ñ¥½¸ˆ¤ì(€€€€€€€€€€€€€€€¥˜¡…Ñ¥½¸ôôô‰É•±½…ˆ¥ìÉ•ÅÕ•ÍÑI•±½… ¤ìô(€€€€€€€€€€€€€€€•±Í”¥˜¡…Ñ¥½¸ôôô‰±…Ñ•Èˆ¥ì‘•™•É9½Éµ…±UÁ‘…Ñ” ¤ìô(€€€€€€€€€€€€€€€•±Í”¥˜¡…Ñ¥½¸ôôô‰…­¹½Ý±•‘”ˆ¥ì…­¹½Ý±•‘•ÕÉÉ•¹ÑI•±•…Í” ¤ìô(€€€€€€€€€€€€€€€•±Í”¥˜¡…Ñ¥½¸ôôô‰ÁÉ•Ù¥•Üµ±½Í”ˆ¥ì±½Í•I•±•…Í••Ñ…¥° ¤ìô(€€€€€€€€€€€ô¤ì(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹I•±•…Í••Ñ…¥°¡­¥¹¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñð…Á…ÉÑÌ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐ™½É•õ­¥¹ôôô‰™½É•ˆì(€€€€€€€¥˜¡™½É•˜˜……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õÑÉÕ”ì(€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ°‰™½É•µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€€¼¨á¥ÍÑ¥¹œ½Ý¹•ÈÁ•É™½ÉµÌ¥ÑÌ¹½Éµ…°‰½ÉÉ½Ý•µ•±•µ•¹Ð±•…¹ÕÀ™¥ÉÍÐ¸€¨¼(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹±½Í•!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€±½‰…°¹±½Í•!½µ••…ÑÕÉ” ¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ì(€€€€€€€ô((€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰É•±•…Í”µÕÁ‘…Ñ”µµ½‘…°ˆ¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰É•±•…Í”µÕÁ‘…Ñ”µ™½É•ˆ±™½É•¤ì(€€€€€€€Á…ÉÑÌ¹Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ðõµ…¹¥™•ÍÐ¹Ñ¥Ñ±”ì(€€€€€€€Á…ÉÑÌ¹‰½‘ä¹¥¹¹•É!Q50õÉ•¹‘•ÉI•±•…Í•½¹Ñ•¹Ð¡µ…¹¥™•ÍÐ±­¥¹¤ì(€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹…‘ ‰Í¡½Üˆ¤ì(€€€€€€€ÍÑ…Ñ”¹µ½‘…±=Á•¸õÑÉÕ”ì(€€€€€€€ÍÑ…Ñ”¹µ½‘…±-¥¹õ­¥¹ì(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™½É•ì(€€€€€€€¥˜¡­¥¹ôôô‰…­¹½Ý±•‘”ˆ¥ìÍÑ…Ñ”¹±½¥¹¹¹½Õ¹•µ•¹ÑM¡½Ý¸õÑÉÕ”ìô(€€€€€€€‰¥¹‘I•±•…Í•Ñ¥½¹Ì¡Á…ÉÑÌ¹‰½‘ä±­¥¹¤ì(€€€€€€€¥˜¡™½É•¥ì(€€€€€€€€€€€½¹ÍÐÁÉ¥µ…ÉäõÁ…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ¤ì(€€€€€€€€€€€¥˜¡ÁÉ¥µ…Éä˜™ÑåÁ•½˜ÁÉ¥µ…Éä¹™½ÕÌôôô‰™Õ¹Ñ¥½¸ˆ¥ìÁÉ¥µ…Éä¹™½ÕÌ ¤ìô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹M¡…É•‘5½‘…±±½Í• ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜¡Á…ÉÑÌ¥ì(€€€€€€€€€€€Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰É•±•…Í”µÕÁ‘…Ñ”µµ½‘…°ˆ°‰É•±•…Í”µÕÁ‘…Ñ”µ™½É•ˆ¤ì(€€€€€€€ô(€€€€€€€ÍÑ…Ñ”¹µ½‘…±=Á•¸õ™…±Í”ì(€€€€€€€ÍÑ…Ñ”¹µ½‘…±-¥¹õ¹Õ±°ì(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í” ¥ì(€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬˜™ÍÑ…Ñ”¹µ½‘…±=Á•¸ì(€€€ô((€€€™Õ¹Ñ¥½¸¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¥ì(€€€€€€€É•ÑÕÉ¸Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í” ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹¹½Õ¹•½É•‘1½¬ ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜¡Á…ÉÑÌ˜™Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰É•±•…Í”µÕÁ‘…Ñ”µ™½É•ˆ¤¥ì(€€€€€€€€€€€½¹ÍÐÁÉ¥µ…ÉäõÁ…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ¤ì(€€€€€€€€€€€¥˜¡ÁÉ¥µ…Éä˜™ÑåÁ•½˜ÁÉ¥µ…Éä¹™½ÕÌôôô‰™Õ¹Ñ¥½¸ˆ¥ìÁÉ¥µ…Éä¹™½ÕÌ ¤ìô(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸±½Í•I•±•…Í••Ñ…¥° ¥ì(€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹±½Í•!½µ••…ÑÕÉ”ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€±½‰…°¹±½Í•!½µ••…ÑÕÉ” ¤ì(€€€€€€€õ•±Í•ì(€€€€€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€€€€€¥˜¡Á…ÉÑÌ¥ìÁ…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰Í¡½Üˆ¤ìô(€€€€€€€€€€€½¹M¡…É•‘5½‘…±±½Í• ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸…­¹½Ý±•‘•ÕÉÉ•¹ÑI•±•…Í” ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€½¹ÍÐ¡•­‰½àõÁ…ÉÑÌ˜™Á…ÉÑÌ¹‰½‘ä˜™ÑåÁ•½˜Á…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½Èôôô‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€€€€€ýÁ…ÉÑÌ¹‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹É•±•…Í”µÕÁ‘…Ñ”µÍÕÁÁÉ•ÍÌµÑ½‘…äµ¥¹ÁÕÐˆ¤(€€€€€€€€€€€€é¹Õ±°ì(€€€€€€€Í•ÑÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä „„¡¡•­‰½à˜™¡•­‰½à¹¡•­•¤¤ì(€€€€€€€µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¤ì(€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ðõ™…±Í”ì(€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‘•™•É9½Éµ…±UÁ‘…Ñ” ¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•Ý5½‘”¥ì(€€€€€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¤ì(€€€€€€€¡¥‘•5…ÉÅÕ•” ¤ì(€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Á•É™½ÉµI•±½… ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡±½‰…°¹±½…Ñ¥½¸˜™ÑåÁ•½˜±½‰…°¹±½…Ñ¥½¸¹É•±½…ôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€±½‰…°¹±½…Ñ¥½¸¹É•±½… ¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸É•ÅÕ•ÍÑI•±½… ¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•Ý5½‘”¥ì(€€€€€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€µ…É­ÕÉÉ•¹Ñ9½Ñ¥•M••¸ ¤ì(€€€€€€€½¹ÍÐ™½É•õ¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ì(€€€€€€€¥˜ ……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€¥˜¡™½É•¥ìÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õÑÉÕ”ìô(€€€€€€€€€€€•±Í•ìÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…õÑÉÕ”ìô(€€€€€€€€€€€ÍÑ…Ñ”¹™½É•‘5½‘…±1½¬õ™…±Í”ì(€€€€€€€€€€€±½Í•I•±•…Í••Ñ…¥° ¤ì(€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ±™½É•ü‰™½É•µÁ•¹‘¥¹œˆè‰¹½Éµ…°µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€Á•É™½ÉµI•±½… ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸¡…ÍA•¹‘¥¹]½É¬ ¥ì(€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ•ññÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…‘ññÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ðì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¥ì(€€€€€€€¥˜ …¡…ÍA•¹‘¥¹]½É¬ ¥ññÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•È„ôõ¹Õ±°¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•Èõ±½‰…°¹Í•ÑQ¥µ•½ÕÐ  ¤ôùì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•Èõ¹Õ±°ì(€€€€€€€€€€€É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¤ì(€€€€€€€ô±A9%9}I!-}5L¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¥ì(€€€€€€€¥˜ …¡…ÍA•¹‘¥¹]½É¬ ¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜ ……¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õ™…±Í”ì(€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥° ‰™½É•ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…õ™…±Í”ì(€€€€€€€€€€€Á•É™½ÉµI•±½… ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ð¥ì(€€€€€€€€€€€¥˜¡¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡ÍÑ…Ñ”¹µ…¹¥™•ÍÐ¤¥ì(€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ðõ™…±Í”ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜ …¥ÍM¡…É•‘5½‘…±Ù…¥±…‰±•½É¹¹½Õ¹•µ•¹Ð ¤¥ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ðõ™…±Í”ì(€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥° ‰…­¹½Ý±•‘”ˆ¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¥ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹ØÄÐÅUÁ‘…Ñ•9½Ñ¥™¥…Ñ¥½¹½ÑÌôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€±½‰…°¹ØÄÐÅUÁ‘…Ñ•9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€€€€€€€€€ô(€€€€€€€õ…Ñ ¡|¥ìô(€€€ô((€€€™Õ¹Ñ¥½¸É•™É•Í¡¹¹½Õ¹•µ•¹ÑMÕÉ™…” ¥ì(€€€€€€€½¹ÍÐÁ…ÉÑÌõ•ÑM¡…É•‘5½‘…±A…ÉÑÌ ¤ì(€€€€€€€¥˜ (€€€€€€€€€€€€…Á…ÉÑÍññÍÑ…Ñ”¹µ½‘…±=Á•¹ñð…Á…ÉÑÌ¹µ½‘…°¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Í¡½Üˆ¥ñð(€€€€€€€€€€€Á…ÉÑÌ¹Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð„ôô‹–³–F(ˆ(€€€€€€€€¥ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍÐ½¹Ñ•¹ÐõÉ•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¤ì(€€€€€€€¥˜¡½¹Ñ•¹Ð¥ìÁ…ÉÑÌ¹‰½‘ä¹¥¹¹•É!Q50õ½¹Ñ•¹Ðìô(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð ¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€¥˜ …µ…¹¥™•ÍÑñð…µ…¹¥™•ÍÐ¹ÁÕ‰±¥9½Ñ¥”¥ìÉ•ÑÕÉ¸€ˆˆìô(€€€€€€€½¹ÍÐ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€½¹ÍÐ½µÁ…É¥Í½¸õ±½…‘•ý½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤é¹Õ±°ì(€€€€€€€½¹ÍÐ¹••‘ÍUÁ‘…Ñ”õ½µÁ…É¥Í½¸„ôõ¹Õ±°˜™½µÁ…É¥Í½¸ðÀì(€€€€€€€½¹ÍÐ…Ñ¥½¹1…‰•°õ¹••‘ÍUÁ‘…Ñ”ü‹š~—žr/šnÓšZÃ–Ÿ–ºäˆè‹š~—žr/šr³š²‡šnÓšZÀˆì(€€€€€€€½¹ÍÐÍÑ…ÑÕÌõ¹••‘ÍUÁ‘…Ñ”(€€€€€€€€€€€€ü€‹–ÞËšr'šZÃž&#šr³–>¿šnÓšZÃ¾òo–º3š"Cžn»–&7šN7’ös–ú3–6Ï–>¿šnÓšZÃŽˆ(€€€€€€€€€€€€è€‹žn»–&7š¶–ò?ž&#šr³žjšnÓšZÃ–Ÿ–ºçŽˆì(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€œñÍ•Ñ¥½¸±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…¹¹½Õ¹•µ•¹Ðˆøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…¹¹½Õ¹•µ•¹ÐµÙ•ÉÍ¥½¸ˆøœ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤¬œƒšnÓšZÀð½Àøœ¬(€€€€€€€€€€€€€€€€œñÀøœ­•Í…Á•!Ñµ°¡µ…¹¥™•ÍÐ¹ÍÕµµ…Éä¤¬œð½Àøœ¬(€€€€€€€€€€€€€€€€œñÀ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µ…¹¹½Õ¹•µ•¹ÐµÍÑ…ÑÕÌˆøœ­•Í…Á•!Ñµ°¡ÍÑ…ÑÕÌ¤¬œð½Àøœ¬(€€€€€€€€€€€€€€€€œñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰É•±•…Í”µÕÁ‘…Ñ”µÁÉ¥µ…Éäˆ½¹±¥¬ô‰Ý¥¹‘½Ü¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”¹½Á•¹É½µ¹¹½Õ¹•µ•¹Ð ¤ˆøœ­…Ñ¥½¹1…‰•°¬œð½‰ÕÑÑ½¸øœ¬(€€€€€€€€€€€€œð½Í•Ñ¥½¸øœ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹É½µ¹¹½Õ¹•µ•¹Ð ¥ì(€€€€€€€½¹ÍÐµ…¹¥™•ÍÐõÍÑ…Ñ”¹µ…¹¥™•ÍÐì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸™…±Í”ìô(€€€€€€€½¹ÍÐ±½…‘•õÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€½¹ÍÐ¹••‘ÍUÁ‘…Ñ”õ±½…‘•˜™½µÁ…É•Y•ÉÍ¥½¹Ì¡±½…‘•±µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤ðÀì(€€€€€€€É•ÑÕÉ¸½Á•¹I•±•…Í••Ñ…¥°¡¹••‘ÍUÁ‘…Ñ”˜™¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ü‰™½É•ˆé¹••‘ÍUÁ‘…Ñ”ü‰ÕÁ‘…Ñ”ˆè‰…­¹½Ý±•‘”ˆ¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸™•Ñ¡5…¹¥™•ÍÐ ¥ì(€€€€€€€½¹ÍÐ™•Ñ¡•ÈõÑåÁ•½˜±½‰…°¹™•Ñ ôôô‰™Õ¹Ñ¥½¸ˆý±½‰…°¹™•Ñ ¹‰¥¹¡±½‰…°¤é¹Õ±°ì(€€€€€€€¥˜ …™•Ñ¡•È¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€±•ÐÑ¥µ•½ÕÑ%õ¹Õ±°ì(€€€€€€€±•Ð½¹ÑÉ½±±•Èõ¹Õ±°ì(€€€€€€€ÑÉåì(€€€€€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹‰½ÉÑ½¹ÑÉ½±±•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€€€€€½¹ÑÉ½±±•Èõ¹•Ü±½‰…°¹‰½ÉÑ½¹ÑÉ½±±•È ¤ì(€€€€€€€€€€€€€€€Ñ¥µ•½ÕÑ%õ±½‰…°¹Í•ÑQ¥µ•½ÕÐ  ¤ôù½¹ÑÉ½±±•È¹…‰½ÉÐ ¤±IEUMQ}Q%5=UQ}5L¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€±•ÐÕÉ°õI1M}9=Q%}AQ ì(€€€€€€€€€€€ÑÉåì(€€€€€€€€€€€€€€€½¹ÍÐ‰…Í”ô¡±½‰…°¹‘½Õµ•¹Ð˜™±½‰…°¹‘½Õµ•¹Ð¹‰…Í•UI$¥ñð¡±½‰…°¹±½…Ñ¥½¸˜™±½‰…°¹±½…Ñ¥½¸¹¡É•˜¥ññÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€½¹ÍÐÁ…ÉÍ•õ¹•ÜUI0¡I1M}9=Q%}AQ ±‰…Í”¤ì(€€€€€€€€€€€€€€€Á…ÉÍ•¹Í•…É¡A…É…µÌ¹Í•Ð ‰É•±•…Í”µÕÁ‘…Ñ”µ¡•¬ˆ±MÑÉ¥¹œ¡¹½Ü ¤¤¤ì(€€€€€€€€€€€€€€€ÕÉ°õÁ…ÉÍ•¹Ñ½MÑÉ¥¹œ ¤ì(€€€€€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€€€€€ÕÉ°õI1M}9=Q%}AQ ¬ˆýÉ•±•…Í”µÕÁ‘…Ñ”µ¡•¬ôˆ­¹½Ü ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐÉ•ÍÁ½¹Í”õ…Ý…¥Ð™•Ñ¡•È¡ÕÉ°±ì(€€€€€€€€€€€€€€€…¡”è‰¹¼µÍÑ½É”ˆ°(€€€€€€€€€€€€€€€¡•…‘•ÉÌéì‰…¡”µ½¹ÑÉ½°ˆè‰¹¼µ…¡”‰ô°(€€€€€€€€€€€€€€€€¸¸¸¡½¹ÑÉ½±±•ÈýíÍ¥¹…°é½¹ÑÉ½±±•È¹Í¥¹…±ôéíô¤(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€¥˜ …É•ÍÁ½¹Í•ññÉ•ÍÁ½¹Í”¹½¬ôôõ™…±Í•ññÑåÁ•½˜É•ÍÁ½¹Í”¹©Í½¸„ôô‰™Õ¹Ñ¥½¸ˆ¥ìÉ•ÑÕÉ¸¹Õ±°ìô(€€€€€€€€€€€É•ÑÕÉ¸Ù…±¥‘…Ñ•5…¹¥™•ÍÐ¡…Ý…¥ÐÉ•ÍÁ½¹Í”¹©Í½¸ ¤¤ì(€€€€€€€õ…Ñ ¡|¥ì(€€€€€€€€€€€€¼¨=™™±¥¹”°Ñ¥µ•½ÕÐ°µ…±™½Éµ•)M=8…¹Ñ•µÁ½É…Éä‘•Á±½ä…ÁÌµÕÍÐ¹•Ù•È‰±½¬Á±…ä¸€¨¼(€€€€€€€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€€€€€õ™¥¹…±±åì(€€€€€€€€€€€¥˜¡Ñ¥µ•½ÕÑ%„ôõ¹Õ±°¥ì±½‰…°¹±•…ÉQ¥µ•½ÕÐ¡Ñ¥µ•½ÕÑ%¤ìô(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¡…¹‘±•5…¹¥™•ÍÐ¡µ…¹¥™•ÍÐ¥ì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÍÑ…Ñ”¹µ…¹¥™•ÍÐõµ…¹¥™•ÍÐì(€€€€€€€ÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸õ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤ì(€€€€€€€ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•Ý5½‘”õ¹Õ±°ì(€€€€€€€¥˜ …µ…¹¥™•ÍÐ¹ÁÕ‰±¥9½Ñ¥•ñð…ÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸¥ì(€€€€€€€€€€€¡¥‘•5…ÉÅÕ•” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‘•ÙAÉ•Ù¥•Ý5½‘”õ•Ñ•ÙAÉ•Ù¥•Ý5½‘” ¤ì(€€€€€€€¥˜¡‘•ÙAÉ•Ù¥•Ý5½‘”¥ì(€€€€€€€€€€€ÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•Ý5½‘”õ‘•ÙAÉ•Ù¥•Ý5½‘”ì(€€€€€€€€€€€¥˜¡‘•ÙAÉ•Ù¥•Ý5½‘”ôôô‰µ½‘…°ˆ¥ì(€€€€€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥°¡¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ü‰™½É•ˆè‰ÁÉ•Ù¥•Üˆ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ±¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ü‰™½É•ˆè‰ÕÁ‘…Ñ”ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍÐ½µÁ…É¥Í½¸õ½µÁ…É•Y•ÉÍ¥½¹Ì¡ÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸±µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¸¤ì(€€€€€€€¥˜¡½µÁ…É¥Í½¸ôôõ¹Õ±±ññ½µÁ…É¥Í½¸øÀ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€¥˜¡½µÁ…É¥Í½¸ôôôÀ¥ì(€€€€€€€€€€€É•™É•Í¡¹¹½Õ¹•µ•¹ÑMÕÉ™…” ¤ì(€€€€€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€€€€€€€€€¥˜¡Í¡½Õ±‘ÕÑ½M¡½Ý1½¥¹¹¹½Õ¹•µ•¹Ð¡µ…¹¥™•ÍÐ¤¥ì(€€€€€€€€€€€€€€€¥˜¡…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤˜™¥ÍM¡…É•‘5½‘…±Ù…¥±…‰±•½É¹¹½Õ¹•µ•¹Ð ¤¥ì(€€€€€€€€€€€€€€€€€€€½Á•¹I•±•…Í••Ñ…¥° ‰…­¹½Ý±•‘”ˆ¤ì(€€€€€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹ÐõÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ°‰…¹¹½Õ¹•µ•¹ÐµÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐ™½É•õ¥Í½É•‘½É1½…‘•‘Y•ÉÍ¥½¸¡µ…¹¥™•ÍÐ¤ì(€€€€€€€¥˜¡™½É•¥ì(€€€€€€€€€€€¥˜¡¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”õÑÉÕ”ì(€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ±…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤ü‰™½É•ˆè‰™½É•µÁ•¹‘¥¹œˆ¤ì(€€€€€€€€€€€¥˜¡…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ” ¤¥ì(€€€€€€€€€€€€€€€É•Í½±Ù•A•¹‘¥¹]¡•¹M…™” ¤ì(€€€€€€€€€€€õ•±Í•ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•A•¹‘¥¹I•Í½±ÕÑ¥½¸ ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜¡Í¡½Õ±‘M¡½ÝI•µ¥¹‘•È¡µ…¹¥™•ÍÐ¤¥ì(€€€€€€€€€€€É•µ•µ‰•ÉI•µ¥¹‘•È¡µ…¹¥™•ÍÐ¤ì(€€€€€€€€€€€Í¡½Ý5…ÉÅÕ•”¡µ…¹¥™•ÍÐ°‰ÕÁ‘…Ñ”ˆ¤ì(€€€€€€€ô(€€€€€€€É•™É•Í¡¹¹½Õ¹•µ•¹ÑMÕÉ™…” ¤ì(€€€€€€€É•™É•Í¡9½Ñ¥™¥…Ñ¥½¹½ÑÌ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¡•­½ÉUÁ‘…Ñ”¡É•…Í½¸±½ÁÑ¥½¹Ì¥ì(€€€€€€€½¹ÍÐ™½É”ô„„¡½ÁÑ¥½¹Ì˜™½ÁÑ¥½¹Ì¹™½É”¤ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹¡•­¥¹œ¥ìÉ•ÑÕÉ¸ÍÑ…Ñ”¹¡•­¥¹œìô(€€€€€€€¥˜ …™½É”˜™ÍÑ…Ñ”¹±…ÍÑ¡•­Ð˜™¹½Ü ¤µÍÑ…Ñ”¹±…ÍÑ¡•­Ðñ5%9}!-}A}5L¥ì(€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù”¡¹Õ±°¤ì(€€€€€€€ô(€€€€€€€ÍÑ…Ñ”¹±…ÍÑ¡•­Ðõ¹½Ü ¤ì(€€€€€€€ÍÑ…Ñ”¹¡•­¥¹œõ™•Ñ¡5…¹¥™•ÍÐ ¤¹Ñ¡•¸¡µ…¹¥™•ÍÐôùì(€€€€€€€€€€€¥˜¡µ…¹¥™•ÍÐ¥ì¡…¹‘±•5…¹¥™•ÍÐ¡µ…¹¥™•ÍÐ±É•…Í½¸¤ìô(€€€€€€€€€€€É•ÑÕÉ¸µ…¹¥™•ÍÐì(€€€€€€€ô¤¹™¥¹…±±ä  ¤ôùì(€€€€€€€€€€€ÍÑ…Ñ”¹¡•­¥¹œõ¹Õ±°ì(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹¡•­¥¹œì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ…ÉÐ ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹ÍÑ…ÉÑ•¥ìÉ•ÑÕÉ¸ìô(€€€€€€€ÍÑ…Ñ”¹ÍÑ…ÉÑ•õÑÉÕ”ì(€€€€€€€¡•­½ÉUÁ‘…Ñ” ‰‰½½Ðˆ±í™½É”éÑÉÕ•ô¤ì(€€€€€€€ÍÑ…Ñ”¹Á½±±Q¥µ•Èõ±½‰…°¹Í•Ñ%¹Ñ•ÉÙ…°  ¤ôù¡•­½ÉUÁ‘…Ñ” ‰Á½±°ˆ¤±!-}%9QIY1}5L¤ì(€€€€€€€½¹ÍÐ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ðì(€€€€€€€¥˜¡‘½Õµ•¹ÑI•˜˜™ÑåÁ•½˜‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ù¥Í¥‰¥±¥Ñå¡…¹”ˆ° ¤ôùì(€€€€€€€€€€€€€€€¥˜¡‘½Õµ•¹ÑI•˜¹¡¥‘‘•¹ññ‘½Õµ•¹ÑI•˜¹Ù¥Í¥‰¥±¥ÑåMÑ…Ñ”ôôô‰¡¥‘‘•¸ˆ¥ìÉ•ÑÕÉ¸ìô(€€€€€€€€€€€€€€€¡•­½ÉUÁ‘…Ñ” ‰Ù¥Í¥‰¥±¥Ñäˆ¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ±•Ù•¹Ðôùì(€€€€€€€€€€€€€€€¥˜¡•Ù•¹Ð˜™•Ù•¹Ð¹­•äôôô‰Í…Á”ˆ˜™¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ ¤¥ì(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡ÑåÁ•½˜•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ôôô‰™Õ¹Ñ¥½¸ˆ¥ì•Ù•¹Ð¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤ìô(€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•½É•‘1½¬ ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô±ÑÉÕ”¤ì(€€€€€€€ô(€€€€€€€¥˜¡ÑåÁ•½˜±½‰…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€€€€€±½‰…°¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰½¹±¥¹”ˆ° ¤ôù¡•­½ÉUÁ‘…Ñ” ‰½¹±¥¹”ˆ¤¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ½À ¥ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á½±±Q¥µ•È„ôõ¹Õ±°¥ì±½‰…°¹±•…É%¹Ñ•ÉÙ…°¡ÍÑ…Ñ”¹Á½±±Q¥µ•È¤ìÍÑ…Ñ”¹Á½±±Q¥µ•Èõ¹Õ±°ìô(€€€€€€€¥˜¡ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•È„ôõ¹Õ±°¥ì±½‰…°¹±•…ÉQ¥µ•½ÕÐ¡ÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•È¤ìÍÑ…Ñ”¹Á•¹‘¥¹Q¥µ•Èõ¹Õ±°ìô(€€€€€€€ÍÑ…Ñ”¹ÍÑ…ÉÑ•õ™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑMÑ…Ñ” ¥ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€±½…‘•‘I•±•…Í•Y•ÉÍ¥½¸éÍÑ…Ñ”¹±½…‘•‘I•±•…Í•Y•ÉÍ¥½¹ññ•Ñ1½…‘•‘I•±•…Í•Y•ÉÍ¥½¸ ¤°(€€€€€€€€€€€…Ù…¥±…‰±•I•±•…Í•Y•ÉÍ¥½¸éÍÑ…Ñ”¹µ…¹¥™•ÍÐ˜™ÍÑ…Ñ”¹µ…¹¥™•ÍÐ¹É•±•…Í•Y•ÉÍ¥½¹ññ¹Õ±°°(€€€€€€€€€€€¹½Ñ¥•%éÍÑ…Ñ”¹µ…¹¥™•ÍÐ˜™ÍÑ…Ñ”¹µ…¹¥™•ÍÐ¹¹½Ñ¥•%‘ññ¹Õ±°°(€€€€€€€€€€€Á•¹‘¥¹9½Éµ…±I•±½…éÍÑ…Ñ”¹Á•¹‘¥¹9½Éµ…±I•±½…°(€€€€€€€€€€€Á•¹‘¥¹½É•‘UÁ‘…Ñ”éÍÑ…Ñ”¹Á•¹‘¥¹½É•‘UÁ‘…Ñ”°(€€€€€€€€€€€Á•¹‘¥¹¹¹½Õ¹•µ•¹ÐéÍÑ…Ñ”¹Á•¹‘¥¹¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€±½¥¹¹¹½Õ¹•µ•¹ÑM¡½Ý¸éÍÑ…Ñ”¹±½¥¹¹¹½Õ¹•µ•¹ÑM¡½Ý¸°(€€€€€€€€€€€ÍÕÁÁÉ•ÍÍ•‘Q½‘…äé¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡ÍÑ…Ñ”¹µ…¹¥™•ÍÐ¤°(€€€€€€€€€€€É¥Ñ¥…±=Á•É…Ñ¥½¹½Õ¹ÐéÍÑ…Ñ”¹É¥Ñ¥…±=Á•É…Ñ¥½¹Ì¹Í¥é”°(€€€€€€€€€€€Õ¹Í…™•I•…Í½¹Ìé•ÑU¹Í…™•I•…Í½¹Ì ¤¹Í±¥” ¤°(€€€€€€€€€€€Á½±±%¹Ñ•ÉÙ…±5Ìé!-}%9QIY1}5L°(€€€€€€€€€€€µ¥¹¥µÕµ¡•­…Á5Ìé5%9}!-}A}5L°(€€€€€€€€€€€‘•ÙAÉ•Ù¥•Ý5½‘”éÍÑ…Ñ”¹‘•ÙAÉ•Ù¥•Ý5½‘”(€€€€€€€ôì(€€€ô((€€€±½‰…°¹½ÕÉMåµ‰½±ÍI•±•…Í•UÁ‘…Ñ”õ=‰©•Ð¹™É••é”¡ì(€€€€€€€ÍÑ…ÉÐ°(€€€€€€€ÍÑ½À°(€€€€€€€¡•­½ÉUÁ‘…Ñ”°(€€€€€€€•ÑMÑ…Ñ”°(€€€€€€€Á…ÉÍ•Y•ÉÍ¥½¸°(€€€€€€€½µÁ…É•Y•ÉÍ¥½¹Ì°(€€€€€€€…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ”°(€€€€€€€‰•¥¹É¥Ñ¥…±=Á•É…Ñ¥½¸°(€€€€€€€¹½Ñ¥™åM…™•MÑ…Ñ”éÉ•Í½±Ù•A•¹‘¥¹]¡•¹M…™”°(€€€€€€€¡…ÍU¹É•…‘I•±•…Í•9½Ñ¥”°(€€€€€€€¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…äè ¤ôù¥ÍÕÉÉ•¹Ñ9½Ñ¥•MÕÁÁÉ•ÍÍ•‘Q½‘…ä¡ÍÑ…Ñ”¹µ…¹¥™•ÍÐ¤°(€€€€€€€É•¹‘•É¹¹½Õ¹•µ•¹Ñ½¹Ñ•¹Ð°(€€€€€€€½Á•¹É½µ¹¹½Õ¹•µ•¹Ð°(€€€€€€€½Á•¹I•±•…Í••Ñ…¥°°(€€€€€€€É•ÅÕ•ÍÑI•±½…°(€€€€€€€¥Í½É•‘UÁ‘…Ñ•	±½­¥¹œ°(€€€€€€€Í¡½Õ±‘AÉ•Ù•¹ÑM¡…É•‘5½‘…±±½Í”°(€€€€€€€…¹¹½Õ¹•½É•‘1½¬°(€€€€€€€½¹M¡…É•‘5½‘…±±½Í•(€€€ô¤ì(€€€±½‰…°¹…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ”õ…¹M…™•±åI•±½…‘½ÉUÁ‘…Ñ”ì((€€€½¹ÍÐ‘½Õµ•¹ÑI•˜õ±½‰…°¹‘½Õµ•¹Ðì(€€€¥˜¡‘½Õµ•¹ÑI•˜˜™ÑåÁ•½˜‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•Èôôô‰™Õ¹Ñ¥½¸ˆ¥ì(€€€€€€€‘½Õµ•¹ÑI•˜¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰™½ÕÈµÍåµ‰½±ÌéÍÑ…ÉÑÕÀµÉ•…‘äˆ±ÍÑ…ÉÐ±í½¹”éÑÉÕ•ô¤ì(€€€ô(€€€ÑÉåì(€€€€€€€½¹ÍÐÍÑ…ÉÑÕÁMÑ…Ñ”õ±½‰…°¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä˜™±½‰…°¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä¹•ÑMÑ…Ñ”˜™±½‰…°¹½ÕÉMåµ‰½±ÍMÑ…ÉÑÕÁA½±¥ä¹•ÑMÑ…Ñ” ¤ì(€€€€€€€¥˜¡ÍÑ…ÉÑÕÁMÑ…Ñ”ôôô‰Id‰ññÍÑ…ÉÑÕÁMÑ…Ñ”ôôô‰=1%9}Idˆ¥ì(€€€€€€€€€€€±½‰…°¹Í•ÑQ¥µ•½ÕÐ¡ÍÑ…ÉÐ°À¤ì(€€€€€€€ô(€€€õ…Ñ ¡|¥ìô()ô¤¡Ý¥¹‘½Ü¤ì(