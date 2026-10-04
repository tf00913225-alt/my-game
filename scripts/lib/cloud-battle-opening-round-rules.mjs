import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const OPENING_RULES_PATH='functions/src/generated/forest-opening-round-rules.js';
export const OPENING_POLICY_PATH='functions/src/generated/forest-opening-round-policy.json';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function buildForestOpeningRoundRules(root){
  const runtime=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
  const declarations={};
  const constants=['HIT_CHANCE_BASE','HIT_CHANCE_MIN_PERCENT','HIT_CHANCE_MAX_PERCENT'];
  const functions=['buildInitiativeQueue','getMonsterAgility','getMonsterAccuracy',
    'calculateHitChancePercent','rollHitChance'];
  for(const name of [...constants,...functions]){
    const pattern=constants.includes(name)?'^const '+name+'\\s*=\\s*[\\s\\S]*?;'
      :'^function '+name+'\\([\\s\\S]*?^\\}';
    const matches=[...runtime.matchAll(new RegExp(pattern,'gm'))];
    if(matches.length!==1||new RegExp('(?:^|[;\\n])\\s*'+name+'\\s*=(?!=)','m').test(runtime)){
      throw Error('Ambiguous/overridden opening round owner: '+name);
    }
    declarations[name]=matches[0][0];
  }
  const tuningPath='js/47-v158-combat-tuning.js';
  const tuning=fs.readFileSync(path.join(root,tuningPath),'utf8');
  const assignments=[...tuning.matchAll(/^        rollBeginnerForestNormalAttackDamage=function\(\)\{[\s\S]*?^        \};/gm)];
  if(assignments.length!==1)throw Error('Ambiguous/missing final tutorial damage owner');
  const finalDamageAssignment=assignments[0][0];
  const allowedOverrides={buildInitiativeQueue:'js/40-v144-rules-and-abyss.js',
    rollBeginnerForestNormalAttackDamage:tuningPath};
  for(const file of fs.readdirSync(path.join(root,'js')).filter(file=>file.endsWith('.js'))){
    if(file==='00-main.js')continue;
    const relative='js/'+file,text=fs.readFileSync(path.join(root,relative),'utf8');
    for(const name of [...functions,'rollBeginnerForestNormalAttackDamage']){
      const overrides=[...text.matchAll(new RegExp('(?:^|[\\n])\\s*(?:window\\.)?'+name+'\\s*=(?!=)','gm'))];
      if(overrides.length&&(allowedOverrides[name]!==relative||overrides.length!==1)){
        throw Error('Unsupported later opening round override: '+name+' in '+relative);
      }
    }
  }
  declarations.rollBeginnerForestNormalAttackDamage=finalDamageAssignment.replace(
    'rollBeginnerForestNormalAttackDamage=function','const rollBeginnerForestNormalAttackDamage=function');
  // Exact browser owners, with zero-modifier bindings valid only after the
  // existing plain-player admission gate. Two combatants only: the browser
  // random sort comparator is intentionally not generalized to larger rosters.
  const code=`// GENERATED from js/00-main.js by production build. DO NOT EDIT.\n"use strict";\nfunction createForestOpeningRoundRules(player,stats,enemy,random){\n    const Math=Object.create(globalThis.Math);\n    Math.random=random;\n    const getExistingPartyIndexes=()=>[0];\n    const getPartyCharacterByIndex=index=>index===0?player:null;\n    const getPartyBattleStats=()=>stats;\n    const getPartyCharacterIndex=entity=>entity===player?0:-1;\n    const getLearnedElementEX=()=>null;\n    const getMonsterDebuffValue=()=>0;\n    const getStatDownPercentFor=()=>0;\n    const currentBattleMonsters=[0];\n    const monsters=[enemy];\n${Object.values(declarations).join('\n\n')}\n    return Object.freeze({\n        initiative:()=>buildInitiativeQueue(),\n        enemyHit:()=>rollHitChance(getMonsterAccuracy(enemy),stats.evasion,0,0,player),\n        enemyDamage:()=>rollBeginnerForestNormalAttackDamage()\n    });\n}\nmodule.exports={createForestOpeningRoundRules};\n`;
  const policy={schemaVersion:1,policyId:'forest-opening-round-v1',
    scope:'two-combatant-declared-normal-attacks-first-round-arithmetic-only',sourceOwner:'js/00-main.js',tutorialDamageOwner:tuningPath,
    compatibilityDigests:Object.fromEntries(['js/40-v144-rules-and-abyss.js',tuningPath].map(file=>
      [file,hash(fs.readFileSync(path.join(root,file),'utf8'))])),
    declarationDigests:Object.fromEntries(Object.entries(declarations).map(([n,v])=>[n,hash(v)])),
    rulesSha256:hash(code),combatRulesReady:false,outcomeVerified:false,rewardEligible:false};
  return {code,policy};
}
export function syncForestOpeningRoundRules(root,checkOnly=false){
  const {code,policy}=buildForestOpeningRoundRules(root);
  for(const [name,expected] of [[OPENING_RULES_PATH,code],[OPENING_POLICY_PATH,JSON.stringify(policy,null,2)+'\n']]){
    const file=path.join(root,name);
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)continue;
    if(checkOnly)throw Error('Server opening round rules are stale: '+name);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
  }
}
