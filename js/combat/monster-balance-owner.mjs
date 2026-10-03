import {levelBase,validateLevel,SIX_STAT_COEFFICIENTS} from './level-base-contract.mjs';
import {ARCHETYPES,allocatePoints} from './monster-archetypes.mjs';
export const MODES=Object.freeze(['wild','daily','tower','abyss','adventure','personalBoss','worldBoss']);
export const RANKS=Object.freeze(['regular','elite','smallBoss']);
export const GLOBAL_CALIBRATION=Object.freeze({hp:1,sp:1,damage:1,defense:1});
// Resource baseline retained explicitly for shadow comparison; per-level +30/+10 is pending, never applied.
export const RESOURCE_BASE=Object.freeze({hp:100,sp:50,provenance:'00-main legacy resource baseline'});
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
  if(mode==='wild' && rank==='smallBoss') throw new TypeError('Wild has no formal smallBoss runtime');
  return {...(spec.monsterKey?{monsterKey:spec.monsterKey}:{}),name,level,element,archetype,rank,mode,context};
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
  // Neutral rank/mode are diagnostic placeholders, never approval of final multipliers.
  const rank=identity.mode==='wild'
    ?{id:identity.rank,status:'RANK_V1',hp:identity.rank==='elite'?1.5:1,defense:identity.rank==='elite'?1.1:1,finalDamagePressure:identity.rank==='elite'?1.1:1,skillFrequency:null}
    :{id:identity.rank,status:'PENDING_PRODUCT_CALIBRATION',hp:1,defense:1,finalDamagePressure:null,skillFrequency:null};
  const mode={id:identity.mode,status:identity.mode==='wild'?'RUNTIME_V1':'SHADOW_BASELINE_ONLY',hp:1,sp:1,damage:1,defense:1,ttkTarget:['wild','daily'].includes(identity.mode)?{maxRounds:2,player:'normal same-level progression',scope:'kill/clear wave'}:null};
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
  const afterRank={...derived,maxHP:derived.maxHP*rank.hp,defense:derived.defense*rank.defense};
  const afterMode={...afterRank,maxHP:afterRank.maxHP*mode.hp,maxSP:afterRank.maxSP*mode.sp,physicalAttack:afterRank.physicalAttack*mode.damage,magicAttack:afterRank.magicAttack*mode.damage,defense:afterRank.defense*mode.defense};
  const afterElement={...afterMode,maxHP:Math.round(afterMode.maxHP*element.hp),defense:identity.mode==='wild'?afterMode.defense:Math.round(afterMode.defense*element.defense),speed:afterMode.speed*element.speed};
  const final={...afterElement,maxHP:afterElement.maxHP*globalCalibration.hp,maxSP:afterElement.maxSP*globalCalibration.sp,physicalAttack:afterElement.physicalAttack*globalCalibration.damage,magicAttack:afterElement.magicAttack*globalCalibration.damage,defense:afterElement.defense*globalCalibration.defense};
  return {identity,base,allocation,derived,profiles,final,aiIntent:clone(ARCHETYPES[identity.archetype].aiIntent),pendingProductDecisions:identity.mode==='wild'?[]:['monster per-level bonusHP +30 / bonusSP +10','rank and mode final calibration','Tower/Abyss TTK'],breakdown:[
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
  if(spec.mode!=='wild'||!spec.monsterKey) throw new TypeError('Runtime build requires explicit Wild identity');
  const projection=preview(spec),{final,allocation,identity}=projection;
  return {...identity,...allocation,maxHP:final.maxHP,hp:final.maxHP,maxSP:final.maxSP,sp:final.maxSP,
    attack:final.physicalAttack,magicAttack:final.magicAttack,defense:final.defense,agility:final.speed,
    accuracy:0,statusResistance:0,antiCrit:0,evasion:0,alive:true,
    balanceOwner:'MonsterBalance',balanceProjection:projection};
}
function debug(entity){
  if(!entity||entity.balanceOwner!=='MonsterBalance'||!entity.balanceProjection) throw new TypeError('Owner entity required');
  return clone(entity.balanceProjection);
}
export const MonsterBalance=Object.freeze({preview,build,debug,previewTower,previewTowerRoster,archetypes:ARCHETYPES,modes:MODES,ranks:RANKS,globalCalibration:GLOBAL_CALIBRATION});
