import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const RULES_PATH='functions/src/generated/plain-player-normal-attack-rules.js';
export const POLICY_PATH='functions/src/generated/plain-player-normal-attack-policy.json';
const hash=value=>createHash('sha256').update(value).digest('hex');
const functions=[
  'getEffectivePlayerAbilityPoints','calculateCharacterBaseStats',
  'getDamageFormulaConstant','getDamageLevelMultiplier','getElementalDamageMultiplier',
  'getDamageContextAttacker','getOrdinaryDamageBonusPercent','getOrdinaryDamageMultiplier',
  'isPartyDamageTarget','getEnemyPressureMultiplier','getDamageBudgetMultiplier',
  'getTowerDirectDamageMultiplier','calculateDamage','calculateHitChancePercent',
  'getCriticalStatPoints','rollCritical'
];
const constants=[
  'BASE_PHYSICAL_ATTACK','BASE_MAGIC_ATTACK','BASE_DEFENSE','ATTACK_PER_LEVEL',
  'MAGIC_ATTACK_PER_LEVEL','DEFENSE_PER_LEVEL','ATTACK_PER_POINT','MAGIC_ATTACK_PER_POINT',
  'DEFENSE_PER_POINT','HP_PER_VITALITY_POINT',
  'DAMAGE_FORMULA_BASE_CONSTANT','DAMAGE_FORMULA_PER_TARGET_LEVEL',
  'NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX','FINAL_CRITICAL_MULTIPLIER_MAX',
  'ELEMENT_COUNTER_MAP','ELEMENT_ADVANTAGE_MULTIPLIER','ELEMENT_DISADVANTAGE_MULTIPLIER',
  'ENEMY_PRESSURE_RANK_BONUS','ENEMY_PRESSURE_DAILY_DUNGEON_BONUS','ENEMY_PRESSURE_ABYSS_BONUS',
  'HIT_CHANCE_BASE','HIT_CHANCE_MIN_PERCENT','HIT_CHANCE_MAX_PERCENT',
  'CRIT_CHANCE_BASE','CRIT_CHANCE_MAX','CRIT_MULTIPLIER_BASE','CRIT_MULTIPLIER_MAX'
];

// Copy exact named canonical declarations, never rewrite their formulas. The
// admission layer only allows an unmodified player attacking a regular enemy.
// These zero-effect bindings are valid ONLY under that enforced admission gate.
export function buildPlainPlayerNormalAttackRules(root){
  const runtime=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
  const declarations={};
  for(const name of constants){
    const matches=[...runtime.matchAll(new RegExp('^const '+name+'\\s*=\\s*[\\s\\S]*?;','gm'))];
    if(matches.length!==1)throw Error('Ambiguous/missing canonical constant: '+name);
    declarations[name]=matches[0][0];
  }
  for(const name of functions){
    const matches=[...runtime.matchAll(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}','gm'))];
    if(matches.length!==1)throw Error('Ambiguous/missing canonical function: '+name);
    declarations[name]=matches[0][0];
  }
  // Later assignment to one of these owners invalidates projection, rather
  // than silently extracting a retired implementation.
  for(const name of [...constants,...functions]){
    if(new RegExp('(?:^|[;\\n])\\s*'+name+'\\s*=(?!=)','m').test(runtime)){
      throw Error('Canonical rule has a later override: '+name);
    }
  }
  const source=Object.values(declarations).join('\n\n');
  const code=`// GENERATED from js/00-main.js by production build. DO NOT EDIT.\n"use strict";\nfunction createPlainPlayerRules(player,random){\n    const Math=Object.create(globalThis.Math);\n    Math.random=random;\n    const window=Object.freeze({});\n    const getStatDownPercentFor=()=>0;\n    const getMonsterDebuffValue=()=>0;\n    const getLearnedElementEX=()=>null;\n    const getPartyCharacterIndex=entity=>entity===player?0:-1;\n    const getPartyBattleStats=()=>stats;\n    const battleStatisticsRecordCriticalByActor=()=>{};\n${source}\n    const stats=calculateCharacterBaseStats(player,{});\n    return Object.freeze({stats,\n        hit:enemy=>random()*100<calculateHitChancePercent(stats.accuracy,enemy.evasion,0,0),\n        critical:enemy=>rollCritical(player,"physical",enemy.antiCrit,enemy),\n        damage:(enemy,critical)=>calculateDamage(stats.attack,enemy.defense,player.level,enemy.level,\n            player.element,enemy.element,{attacker:player,target:enemy,critMultiplier:critical.multiplier})\n    });\n}\nmodule.exports={createPlainPlayerRules};\n`;
  const policy={schemaVersion:1,policyId:'plain-player-normal-attack-v1',
    scope:'single-plain-player-normal-attack-arithmetic-only',
    sourceOwner:'js/00-main.js',
    compatibilityDigests:Object.fromEntries(['js/33-v140-four-element-balance.js','js/43-v149-skill-ui-rules.js',
      'js/44-v152-dev-fixes.js','js/60-v173.64-skill-progression-rebalance.js'].map(file=>
        [file,hash(fs.readFileSync(path.join(root,file),'utf8'))])),
    declarationDigests:Object.fromEntries(Object.entries(declarations).map(([name,value])=>[name,hash(value)])),
    rulesSha256:hash(code),combatRulesReady:false,outcomeVerified:false,rewardEligible:false};
  return {code,policy};
}

export function syncPlainPlayerNormalAttackRules(root,checkOnly=false){
  const {code,policy}=buildPlainPlayerNormalAttackRules(root);
  for(const [name,expected] of [[RULES_PATH,code],[POLICY_PATH,JSON.stringify(policy,null,2)+'\n']]){
    const file=path.join(root,name);
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)continue;
    if(checkOnly)throw Error('Server normal attack rules are stale: '+name);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
  }
}
