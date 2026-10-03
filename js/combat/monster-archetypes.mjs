/** One registry for allocation and AI intent; no skill execution or invented skills. */
const define=(weights,priority,requiredCapabilities=[])=>Object.freeze({
  weights:Object.freeze(weights),aiIntent:Object.freeze({priority:Object.freeze(priority),requiredCapabilities:Object.freeze(requiredCapabilities),policy:'only-existing-carried-legal-affordable-skills'})
});
export const ARCHETYPES=Object.freeze({
  physical:define({attack:30,vitality:15,defense:15,energy:15,agility:15,intelligence:10},['physicalAttack','attack']),
  magic:define({attack:10,vitality:15,defense:15,energy:15,agility:15,intelligence:30},['magicAttack','attack']),
  tank:define({vitality:30,defense:30,attack:15,energy:10,agility:10,intelligence:5},['protectAlly','shield','reduceDamage','attack'],['shield-or-protection-or-damage-reduction-or-taunt']),
  speedControl:define({agility:30,intelligence:20,energy:15,vitality:15,defense:10,attack:10},['openingBuffOrSupport','hardControlOrDebuff','attack'],['opening-support-or-control-or-debuff']),
  support:define({intelligence:25,energy:25,agility:20,vitality:15,defense:10,attack:5},['healLowHpAlly','missingImportantBuff','cleanseDebuff','attack']),
  balanced:define({attack:20,vitality:20,defense:20,intelligence:15,energy:15,agility:10},['contextAppropriateLegalSkill','attack'])
});
// Canonical tie order, independent of registry property order or creation order.
export const STAT_ORDER=Object.freeze(['attack','intelligence','vitality','energy','defense','agility']);
export function allocatePoints(budget,archetype){
  if(!Number.isSafeInteger(budget)||budget<0) throw new RangeError('budget must be a nonnegative integer');
  const entry=ARCHETYPES[archetype];
  if(!Object.hasOwn(ARCHETYPES,archetype)) throw new TypeError('unknown archetype');
  const shares=STAT_ORDER.map((stat,index)=>({stat,index,points:Math.floor(budget*entry.weights[stat]/100),remainder:budget*entry.weights[stat]%100}));
  const left=budget-shares.reduce((sum,row)=>sum+row.points,0);
  [...shares].sort((a,b)=>b.remainder-a.remainder||a.index-b.index).slice(0,left).forEach(row=>row.points++);
  return Object.fromEntries(shares.map(row=>[row.stat+'Points',row.points]));
}
