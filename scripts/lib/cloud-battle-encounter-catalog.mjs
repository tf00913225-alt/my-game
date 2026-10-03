import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const hash=value=>createHash('sha256').update(value).digest('hex');
export const CATALOG_PATH='functions/src/generated/battle-encounter-catalog.json';
// Deployment data, never a handwritten second balance formula. This deliberately
// seals only the two original Forest regular definitions, not a complete battle,
// random roster, skill loadout, rank draw, combat result or reward policy.
export async function buildBattleEncounterCatalog(root){
  const paths=['js/combat/level-base-contract.mjs','js/combat/monster-archetypes.mjs','js/combat/monster-balance-owner.mjs'];
  const sourceDigests=Object.fromEntries(paths.map(p=>[p,hash(fs.readFileSync(path.join(root,p),'utf8'))]));
  const {MonsterBalance}=await import(pathToFileURL(path.join(root,paths[2])).href);
  const identities=JSON.parse(fs.readFileSync(path.join(root,'config/wild-monster-archetypes.json'),'utf8')).entries;
  const runtime=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
  const block=runtime.match(/const forestMonsters = \[([\s\S]*?)\n\];/);
  if(!block)throw Error('Missing formal Forest roster');
  const calls=[...block[1].matchAll(/makeZoneMonster\("([^"]+)",(\d+),"([^"]+)","regular","([^"]+)",\{mode:"wild",context:"wild\/zone-01"\}\)/g)];
  if(calls.length!==6||(block[1].match(/makeZoneMonster/g)||[]).length!==calls.length)throw Error('Unsupported Forest roster contract');
  const entries={};
  for(const [,name,level,element,monsterKey] of calls){
    const identity=identities[monsterKey];
    if(!identity||identity.zone!=='wild/zone-01')throw Error('Unregistered Forest identity');
    const spec={monsterKey,name,level:Number(level),element,archetype:identity.archetype,rank:'regular',mode:'wild',context:identity.zone};
    const entity=MonsterBalance.build(spec);
    const definition={spec,stats:Object.fromEntries(['maxHP','maxSP','attack','magicAttack','defense','agility','accuracy','statusResistance','antiCrit','evasion'].map(key=>[key,entity[key]])),finalDamagePressure:entity.balanceProjection.finalDamagePressure};
    if(Object.values(definition.stats).some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid formal stat projection');
    if(entries[monsterKey]&&JSON.stringify(entries[monsterKey])!==JSON.stringify(definition))throw Error('Conflicting Forest identity');
    entries[monsterKey]=definition;
  }
  if(Object.keys(entries).length!==2)throw Error('Unsupported Forest identities');
  const policy={schemaVersion:1,policyId:'wild-forest-regular-stats-v1',scope:'single-enemy-stat-definition-only',projectionOwner:'MonsterBalance',sourceDigests,entries,combatRulesReady:false,outcomeVerified:false,rewardEligible:false};
  // Firestore map-order-independent canonical JSON; the server reader uses the
  // existing snapshot digest implementation for precisely the same algorithm.
  const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  return {...policy,sha256:hash(JSON.stringify(stable(policy)))};
}
export async function syncBattleEncounterCatalog(root,checkOnly=false){
  const expected=JSON.stringify(await buildBattleEncounterCatalog(root),null,2)+'\n';
  const file=path.join(root,CATALOG_PATH);
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
  if(checkOnly)throw Error('Server encounter projection is stale: regenerate from the formal MonsterBalance owner');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}
