import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

export const RESTRICTED_POLICY_PATH='functions/src/generated/restricted-forest-instance-policy.json';
const hash=value=>createHash('sha256').update(value).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const owners=['js/00-main.js','js/34-v141-core-systems.js','js/40-v144-rules-and-abyss.js'];
// Certify the actual carried-skill owners. Empty skill data is deliberate:
// this scope must return BEFORE consulting any skill or drawing loadout RNG.
export function buildRestrictedBattlePolicy(root){
  const main=fs.readFileSync(path.join(root,owners[0]),'utf8');
  const core=fs.readFileSync(path.join(root,owners[1]),'utf8');
  const declarations=[];
  for(const [source,names,indent] of [[main,['getMonsterSkillTierAndChance','getMonsterSkillPoolForLevel'],''],
    [core,['getMonsterSkillCarryLimit','getMonsterFixedSkillLevel','shuffledCopy','configureMonsterSkills'],'    ']]){
    for(const name of names){
      const matches=[...source.matchAll(new RegExp('^'+indent+'function '+name+'\\([\\s\\S]*?^'+indent+'\\}','gm'))];
      if(matches.length!==1)throw Error('Ambiguous restricted loadout owner: '+name);
      declarations.push(matches[0][0]);
    }
  }
  const context=vm.createContext({skillDatabase:{},
    Math:Object.assign(Object.create(Math),{random(){throw Error('Unexpected restricted loadout RNG');}})});
  context.window=context;
  vm.runInContext(declarations.join('\n'),context,{timeout:1000});
  vm.runInContext(fs.readFileSync(path.join(root,owners[2]),'utf8'),context,{timeout:1000});
  context.skillDatabase=new Proxy({}, {get(){throw Error('Unsupported skill lookup');},
    ownKeys(){throw Error('Unsupported skill enumeration');}});
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'functions/src/generated/battle-encounter-catalog.json'),'utf8'));
  const entries={};
  for(const key of ['wild.zone-01.fire-01','wild.zone-01.water-01']){
    const spec=catalog.entries[key]?.spec;
    if(!spec||spec.level>10||spec.rank!=='regular'||spec.mode!=='wild'||spec.context!=='wild/zone-01'){
      throw Error('Unsupported restricted Forest definition: '+key);
    }
    const tier=context.getMonsterSkillTierAndChance(spec.level);
    const monster={...spec,balanceOwner:'MonsterBalance',
      skillIds:context.getMonsterSkillPoolForLevel(spec.element,spec.level),skillChance:tier.chance};
    context.configureMonsterSkills(monster);
    context.v144ConfigureMonsterEncounterSkills(monster,'restricted-policy-check');
    if(tier.maxTier!==0||monster.skillChance!==0||monster.skillIds.length||
      monster.v141SupportSkillIds.length||monster.v144LegalSkillPool.length){
      throw Error('Restricted enemy is not naturally normal-attack-only');
    }
    entries[key]={specSha256:hash(JSON.stringify(stable(spec))),attackSkills:[],supportSkills:[],skillChance:0};
  }
  const protectedNames={getMonsterSkillTierAndChance:owners[0],getMonsterSkillPoolForLevel:owners[0],
    v141ConfigureMonsterSkills:owners[1],v144ConfigureMonsterEncounterSkills:owners[2]};
  for(const file of fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'))){
    const relative='js/'+file,text=fs.readFileSync(path.join(root,relative),'utf8');
    for(const [name,owner] of Object.entries(protectedNames)){
      if(relative!==owner&&new RegExp('(?:^|[\\n])\\s*(?:window\\.)?'+name+'\\s*=(?!=)','m').test(text)){
        throw Error('Unsupported restricted loadout override: '+name+' in '+relative);
      }
    }
  }
  return {schemaVersion:1,policyId:'restricted-forest-instance-v1',scope:'private-initial-state-only',
    sourceDigests:Object.fromEntries(owners.map(p=>[p,hash(fs.readFileSync(path.join(root,p),'utf8'))])),
    entries,roster:{players:1,enemies:1,enemySource:'original-private-encounter-seal',rankDraw:false},
    initialResources:{player:'original-private-source-hp-sp',enemy:'sealed-definition-max-hp-sp'},
    allowedFutureIntent:{type:'normal-attack',actor:'player-0',target:'enemy-0'},
    enemyIntent:{type:'normal-attack',target:'player-0',selection:'sole-living-visible-player'},
    unsupported:['skills','passives','buffs','debuffs','equipment','relics','defend','items','follow-up',
      'shield','reflect','lifesteal','revive','additional-actors','post-battle-effects'],
    lifecycle:{state:'PREPARED',round:0,roundVersion:0,acceptsRoundSubmission:false,randomnessRequired:false},
    combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
}
export function syncRestrictedBattlePolicy(root,checkOnly=false){
  const expected=JSON.stringify(buildRestrictedBattlePolicy(root),null,2)+'\n';
  const file=path.join(root,RESTRICTED_POLICY_PATH);
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
  if(checkOnly)throw Error('Restricted battle policy is stale');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}
