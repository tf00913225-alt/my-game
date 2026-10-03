/** Canonical future player/monster contract. Phase 1: pure shadow only. */
export const LEVEL_BASE = Object.freeze({physicalAttack:30,magicAttack:30,defense:30});
export const LEVEL_GROWTH = Object.freeze({physicalAttack:4,magicAttack:2.75,defense:4});
export const SIX_STAT_COEFFICIENTS = Object.freeze({attack:4,intelligence:2.75,vitality:50,energy:15,defense:4,agility:1});
export function validateLevel(level){
  if(!Number.isSafeInteger(level)||level<1||level>100) throw new RangeError('level must be an integer from 1 to 100');
  return level;
}
export function levelBase(level){
  validateLevel(level);
  return {...Object.fromEntries(Object.keys(LEVEL_BASE).map(key=>[key,LEVEL_BASE[key]+(level-1)*LEVEL_GROWTH[key]])),abilityPointBudget:(level-1)*5};
}
export const CombatLevelBase = Object.freeze({preview:levelBase,base:LEVEL_BASE,growth:LEVEL_GROWTH,coefficients:SIX_STAT_COEFFICIENTS});
