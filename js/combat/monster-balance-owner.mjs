import {levelBase,validateLevel,SIX_STAT_COEFFICIENTS} from './level-base-contract.mjs';
import {ARCHETYPES,allocatePoints} from './monster-archetypes.mjs';
export const MODES=Object.freeze(['wild','daily','tower','abyss','adventure','personalBoss','worldBoss']);
export const RANKS=Object.freeze(['regular','elite','smallBoss','boss']);
export const GLOBAL_CALIBRATION=Object.freeze({hp:1,sp:1,damage:1,defense:1});
// Wild resources are HP100/SP50 plus allocation only; player per-level bonuses never apply.
export const RESOURCE_BASE=Object.freeze({hp:100,sp:50,provenance:'00-main legacy resource baseline'});
export const DAILY_PARTY_DURABILITY=Object.freeze({1:0.04,2:0.08,3:0.12});
export const DAILY_MODE_PROFILE=Object.freeze({hp:1,defense:1,damage:1,sp:1,skillFrequency:1});
// Ten-enemy Tower calibration: keep raw six-stat conversion and rank ratios intact.
export const TOWER_MODE_PROFILE=Object.freeze({hp:0.2,sp:1,damage:0.25,defense:1,speed:1});
export const ABYSS_MODE_PROFILE=Object.freeze({hp:0.45,sp:1,damage:0.22,defense:1,speed:1,trueRealmFinalDamage:0.18,trueRealmFinalHp:0.9});
export const ABYSS_RANK_PROFILES=Object.freeze({
  regular:Object.freeze({hp:1,sp:1,defense:1,finalDamagePressure:1}),
  elite:Object.freeze({hp:1.8,sp:1.5,defense:1.15,finalDamagePressure:1.1}),
  smallBoss:Object.freeze({hp:3.2,sp:2,defense:1.25,finalDamagePressure:1.2})
});
// Chapter exploration calibration is independent of Wild/Daily/Tower/Abyss.
export const ADVENTURE_MODE_PROFILE=Object.freeze({hp:0.5,sp:1,damage:1,defense:1,speed:1});
export const ADVENTURE_RANK_PROFILES=Object.freeze({
  regular:Object.freeze({hp:1,sp:1,defense:1,finalDamagePressure:1}),
  elite:Object.freeze({hp:1.4,sp:1,defense:1.05,finalDamagePressure:1.1}),
  smallBoss:Object.freeze({hp:2,sp:1,defense:1.10,finalDamagePressure:1.2})
});
export const BIG_BOSS_RANK_PROFILE=Object.freeze({hp:3,sp:2,defense:1.25,finalDamagePressure:1.2});
export const BOSS_MODE_PROFILES=Object.freeze({
  personalBoss:Object.freeze({hp:1,sp:1,damage:0.4,defense:1,speed:1}),
  worldBoss:Object.freeze({hp:1.15,sp:1,damage:0.45,defense:1,speed:1})
});
// Formal stage stat intent; objects, summoning and skills stay in GameplaySystem.
export const WORLD_BOSS_STAGE_PROFILES=Object.freeze([
  Object.freeze({number:1,hp:0.78,damage:0.92}),
  Object.freeze({number:2,hp:0.88,damage:1}),
  Object.freeze({number:3,hp:0.96,damage:1.06}),
  Object.freeze({number:4,hp:1,damage:1.12})
]);
export const ABYSS_STAGE_HP=Object.freeze([0.90,0.95,1,1.05,1.10]);
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
  if(rank==='boss'&&!['daily','personalBoss','worldBoss'].includes(mode)) throw new TypeError('boss requires Daily or explicit Big Boss mode');
  if(['personalBoss','worldBoss'].includes(mode)&&!['boss','elite'].includes(rank))throw new TypeError('Big Boss mode requires boss or reinforcement elite');
  const daily={};
  if(['personalBoss','worldBoss'].includes(mode)){
    if(!spec.monsterKey)throw new TypeError('explicit Boss identity required');
    if(mode==='worldBoss'){
      if(!Number.isInteger(spec.worldStage)||spec.worldStage<1||spec.worldStage>4)throw new TypeError('explicit World stage required');
      daily.worldStage=spec.worldStage;
    }
  }
  if(mode==='abyss'){
    if(!spec.monsterKey||![20,40].includes(level)||spec.abyssDifficulty!==level||!['east','south','heaven','north','extreme'].includes(spec.abyssRegion)||!Number.isInteger(spec.abyssStage)||spec.abyssStage<0||spec.abyssStage>4||context!==`abyss/${level}/${spec.abyssRegion}/stage/${spec.abyssStage+1}`||rank==='boss') throw new TypeError('explicit formal Abyss encounter required');
    Object.assign(daily,{abyssDifficulty:level,abyssRegion:spec.abyssRegion,abyssStage:spec.abyssStage});
  }
  if(mode==='adventure'){
    if(!spec.monsterKey||typeof spec.chapterId!=='string'||!spec.chapterId||typeof spec.encounterId!=='string'||!spec.encounterId||context!==`adventure/${spec.chapterId}/${spec.encounterId}`)throw new TypeError('explicit Adventure encounter required');
    Object.assign(daily,{chapterId:spec.chapterId,encounterId:spec.encounterId});
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
  const migrated=MODES.includes(identity.mode);
  const smallBoss=identity.mode==='tower'&&identity.rank==='smallBoss';
  const boss=identity.rank==='boss';
  const rank=migrated
    ?{id:identity.rank,status:'RANK_V1',hp:smallBoss?3:boss?2:identity.rank==='elite'?1.5:1,defense:(smallBoss||boss)?1.15:identity.rank==='elite'?1.1:1,finalDamagePressure:(smallBoss||boss)?1.15:identity.rank==='elite'?1.1:1,skillFrequency:null}
    :{id:identity.rank,status:'PENDING_PRODUCT_CALIBRATION',hp:1,defense:1,finalDamagePressure:null,skillFrequency:null};
  if(identity.mode==='abyss') Object.assign(rank,ABYSS_RANK_PROFILES[identity.rank],{status:'ABYSS_RUNTIME_V1'});
  if(['personalBoss','worldBoss'].includes(identity.mode)&&identity.rank==='boss')Object.assign(rank,BIG_BOSS_RANK_PROFILE,{status:'BIG_BOSS_RUNTIME_V1'});
  if(identity.mode==='adventure')Object.assign(rank,ADVENTURE_RANK_PROFILES[identity.rank],{status:'ADVENTURE_RUNTIME_V1'});
  const mode={id:identity.mode,status:identity.mode==='wild'||identity.mode==='tower'?'RUNTIME_V1':'SHADOW_BASELINE_ONLY',hp:identity.mode==='wild'?0.32:identity.mode==='tower'?TOWER_MODE_PROFILE.hp:1,sp:1,damage:identity.mode==='tower'?TOWER_MODE_PROFILE.damage:1,defense:1,speed:identity.mode==='wild'&&identity.context==='wild/zone-01'?0:1,ttkTarget:['wild','daily'].includes(identity.mode)?{maxRounds:2,player:'normal same-level progression',scope:'kill/clear wave'}:identity.mode==='tower'?{player:'normal same-floor progression',scope:'challenge floor',floorEqualsLevel:true}:null};
  if(identity.mode==='daily'){
    const solo=identity.partySize===1&&identity.highestPartyLevel<=20;
    Object.assign(mode,{...DAILY_MODE_PROFILE,status:'RUNTIME_V1',damage:solo?.5:1,partySizeDurability:DAILY_PARTY_DURABILITY[identity.partySize],skillFrequency:solo?(identity.wave===1?0:Math.min(.45,identity.skillFrequency*.60)):identity.skillFrequency,protection:{solo,noAccuracyCritBoost:solo,bossSkillCooldown:solo}});
  }
  if(identity.mode==='abyss'){
    const final=identity.level===40&&identity.abyssRegion==='extreme'&&identity.abyssStage===4;
    Object.assign(mode,ABYSS_MODE_PROFILE,{status:'RUNTIME_V1',hp:ABYSS_MODE_PROFILE.hp*ABYSS_STAGE_HP[identity.abyssStage]*(final?ABYSS_MODE_PROFILE.trueRealmFinalHp:1),damage:final?ABYSS_MODE_PROFILE.trueRealmFinalDamage:ABYSS_MODE_PROFILE.damage,ttkTarget:{scope:'challenge encounter; no two-round cap',reference:'formal unequipped party at unlock/+10/+20',trueRealmFinal:final}});
  }
  if(identity.mode==='adventure')Object.assign(mode,ADVENTURE_MODE_PROFILE,{status:'RUNTIME_V1',ttkTarget:{scope:'chapter exploration encounter; no two-round cap',reference:'formal suggested level/+5/+10; solo and two members'}});
  if(['personalBoss','worldBoss'].includes(identity.mode))Object.assign(mode,BOSS_MODE_PROFILES[identity.mode],{status:'RUNTIME_V1',ttkTarget:{scope:'Big Boss challenge; diagnostic ranges, no fixed round target'}});
  const stage=identity.mode==='worldBoss'&&identity.rank==='boss'?{...WORLD_BOSS_STAGE_PROFILES[identity.worldStage-1]}:{number:null,hp:1,damage:1};
  const element={id:identity.element,hp:1,defense:1,speed:1,metadata:{},provenance:'identity only'};
  if(identity.mode==='tower'){
    element.provenance='existing Tower Element Profile (pre-battle only)';
    if(identity.element==='earth'){element.hp=1.15;element.defense=1.15;}
    if(identity.element==='wind'){element.speed=1.15;element.metadata={evasionBonusPercent:15};}
    if(identity.element==='fire') element.metadata={criticalBonusPercent:15,directDamageMultiplier:1.15};
    if(identity.element==='water') element.metadata={healingMultiplier:1.15,statusAccuracyPercent:15,aiPreference:'support'};
  }
  const globalCalibration={...GLOBAL_CALIBRATION};
  const profiles={rank,mode,stage,element,globalCalibration};
  const afterRank={...derived,maxSP:derived.maxSP*(rank.sp||1),maxHP:derived.maxHP*rank.hp,defense:derived.defense*rank.defense};
  const afterMode={...afterRank,maxHP:afterRank.maxHP*mode.hp*(mode.partySizeDurability||1)*stage.hp,maxSP:afterRank.maxSP*mode.sp,physicalAttack:afterRank.physicalAttack*(identity.mode!=='wild'?1:mode.damage),magicAttack:afterRank.magicAttack*(identity.mode!=='wild'?1:mode.damage),defense:afterRank.defense*mode.defense,speed:afterRank.speed*mode.speed};
  const afterElement={...afterMode,maxHP:Math.round(afterMode.maxHP*element.hp),defense:['wild','daily'].includes(identity.mode)?afterMode.defense:Math.round(afterMode.defense*element.defense),speed:afterMode.speed*element.speed};
  const final={...afterElement,maxHP:afterElement.maxHP*globalCalibration.hp,maxSP:afterElement.maxSP*globalCalibration.sp,physicalAttack:afterElement.physicalAttack*globalCalibration.damage,magicAttack:afterElement.magicAttack*globalCalibration.damage,defense:afterElement.defense*globalCalibration.defense};
  return {identity,base,resourceBase:{...RESOURCE_BASE,speed:0},allocation,derived,profiles,final,finalDamagePressure:rank.finalDamagePressure===null?null:rank.finalDamagePressure*mode.damage*stage.damage,legacyMultiplier:'NONE',...(identity.mode==='daily'?{skillFrequency:mode.skillFrequency}:{}),provenance:{stats:'MonsterBalance',damagePressure:'MonsterBalance Rank Profile consumed once by core damage settlement'},aiIntent:clone(ARCHETYPES[identity.archetype].aiIntent),pendingProductDecisions:MODES.includes(identity.mode)?[]:['monster per-level bonusHP +30 / bonusSP +10','rank and mode final calibration','Abyss TTK'],breakdown:[
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
  if(!MODES.includes(spec.mode)||!spec.monsterKey) throw new TypeError('Runtime build requires explicit migrated identity');
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
export const MonsterBalance=Object.freeze({preview,build,debug,previewTower,previewTowerRoster,archetypes:ARCHETYPES,modes:MODES,ranks:RANKS,globalCalibration:GLOBAL_CALIBRATION});
