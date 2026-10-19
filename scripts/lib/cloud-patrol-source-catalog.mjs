import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const CATALOG_PATH='functions/src/generated/patrol-source-catalog.json';
const hash=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const compact=value=>value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
const fail=message=>{throw Error(`Patrol source catalog: ${message}`);};
function one(source,pattern,label){
  const matches=[...source.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
  if(matches.length!==1)fail(`unsupported ${label} source`);
  return matches[0];
}
// These fingerprints fence bounded executable shapes, not entire source files.
// Comments/formatting and unrelated gameplay edits do not require regeneration.
// A changed sampling/append algorithm requires explicit interpretation here.
const GROUP_SHAPE='ecc1f5d4203bdf56643cd11285a872ee515fc78e1da9f0fb40f35e1b8c531f7d';
const APPEND_SHAPE='a61d0f1f7110166fd947c9f79f5970e63777673783db45c14720e043b14e18d7';

// Pure deployment metadata: no combat projection, runtime evaluation or random
// sampling. This is neither the frozen encounter catalog nor a trusted ticket.
export async function buildPatrolSourceCatalog(root){
  const mainPath='js/00-main.js',extraPath='js/34-v141-core-systems.js';
  const identityPath='config/wild-monster-archetypes.json';
  const main=fs.readFileSync(path.join(root,mainPath),'utf8');
  const extra=fs.readFileSync(path.join(root,extraPath),'utf8');
  const identityConfig=JSON.parse(fs.readFileSync(path.join(root,identityPath),'utf8'));
  if(!identityConfig||typeof identityConfig!=='object'||Array.isArray(identityConfig)||
     identityConfig.schemaVersion!==1||!identityConfig.entries||
     typeof identityConfig.entries!=='object'||Array.isArray(identityConfig.entries))
    fail('unsupported identity configuration schema');
  const allIdentities=identityConfig.entries;
  const roster=one(main,/const forestMonsters\s*=\s*\[([\s\S]*?)\n\];/,'Forest roster');
  const rows=compact(roster[1]);
  const calls=[...rows.matchAll(/makeZoneMonster\("([^"\\]*)",(\d+),"(fire|water|wind|earth)","regular","([^"\\]*)",\{mode:"wild",context:"wild\/zone-01"\}\)/g)];
  const residue=rows.replace(/makeZoneMonster\("([^"\\]*)",(\d+),"(fire|water|wind|earth)","regular","([^"\\]*)",\{mode:"wild",context:"wild\/zone-01"\}\)/g,'').replace(/,/g,'');
  if(calls.length!==6||residue)fail('unsupported Forest roster entries');
  const initial=calls.map(([,name,level,element,monsterKey])=>({name,level:Number(level),element,monsterKey}));
  // Capture names from the original, uncompressed strings (spaces are data).
  const originalCalls=[...roster[1].matchAll(/makeZoneMonster\(\s*"([^"\\]*)"\s*,/g)];
  if(originalCalls.length!==initial.length)fail('unsupported Forest names');
  initial.forEach((entry,index)=>{entry.name=originalCalls[index][1];});
  const specs=one(extra,/function getWildZoneSpecs\(\)\{([\s\S]*?)\n    \}/,'Wild zone specs');
  const forestSpec=one(specs[1],/\[typeof forestMonsters!=="undefined"\?forestMonsters:null,(\d+),"([^"\\]*)","([^"\\]*)"\]/,'Forest append row');
  if(!/^return\[\[typeofforestMonsters/.test(compact(specs[1]))||
     !/\]\.filter\(entry=>Array\.isArray\(entry\[0\]\)\);$/.test(compact(specs[1])))fail('unsupported zone-spec inventory');
  const append=one(extra,/function addWindAndEarthWildMonsters\(\)\{([\s\S]*?)\n    \}/,'Wild append');
  if(hash(compact(append[0]))!==APPEND_SHAPE)fail('unsupported Wild append algorithm');
  if(!/\baddWindAndEarthWildMonsters\(\);/.test(extra))fail('Wild append is not activated');
  const appended=[['wind',forestSpec[2]],['earth',forestSpec[3]]].map(([element,name])=>({
    name,level:Number(forestSpec[1]),element,monsterKey:`wild.zone-01.${element}-01`}));
  if(appended.some(row=>initial.some(entry=>entry.name===row.name))||appended[0].name===appended[1].name)
    fail('Forest append names conflict with existing entries');
  const max=one(main,/const MAX_TRAINING_MONSTERS\s*=\s*(\d+)\s*;/,'map bound');
  if(Number(max[1])!==8)fail('unsupported Forest map bound');
  const selection=one(main,/const alivePool\s*=([\s\S]*?)\.sort\(\s*\(a,b\)=>a-b\s*\);/,'group selection');
  if(hash(compact(selection[0]))!==GROUP_SHAPE)fail('unsupported group sampling algorithm');
  const zone=one(main,/const zoneConfig\s*=\s*\{\s*forest:\s*\{([\s\S]*?)\n    \},/,'Forest access');
  const zoneCode=compact(zone[1]);
  const access=one(zoneCode,/^requiredLevel:(\d+),monsters:\(\)=>forestMonsters,title:"[^"\\]*",desc:"[^"\\]*",levelRange:"[^"\\]*"$/,'Forest access fields');
  const rate=one(extra,/const WILD_ELITE_RATE\s*=\s*(\d+(?:\.\d+)?)\s*;/,'rank chance');
  const eliteChance=Number(rate[1]);
  if(!Number.isFinite(eliteChance)||eliteChance<0||eliteChance>1)fail('invalid rank chance');
  const rank=one(extra,/window\.v141RollWildMonsterRanks=function\(indexes\)\{([\s\S]*?)\n    \};/,'rank draw');
  const rankCode=compact(rank[1]);
  if(rankCode!=='(indexes||[]).forEach(index=>{constmonster=typeofmonsters!=="undefined"?monsters[index]:null;if(!monster){return;}if(monster.mode!=="wild"){return;}constrank=Math.random()<WILD_ELITE_RATE?"elite":"regular";constentity=window.MonsterBalance.build({...monster.balanceProjection.identity,rank});Object.assign(monster,entity);monster.v141BattleRank=monster.rank;configureMonsterSkills(monster);if(typeofwindow.v144ConfigureMonsterEncounterSkills==="function"){window.v144ConfigureMonsterEncounterSkills(monster,"wild-"+battleToken);}});')fail('unsupported rank sampling algorithm');
  const identities={};
  const entries=[...initial,...appended].map((row,index)=>{
    const identity=allIdentities?.[row.monsterKey];
    if(!identity||identity.zone!=='wild/zone-01'||!row.name||row.level<1||row.level>100||
       !Number.isSafeInteger(row.level)||!new RegExp(`^wild\\.zone-01\\.${row.element}-\\d+$`).test(row.monsterKey))fail('invalid Forest identity or level');
    identities[row.monsterKey]={zone:identity.zone};
    return {entryId:`forest:${index}`,...row,context:'wild/zone-01'};
  });
  const catalog={schemaVersion:1,policyId:'wild-forest-patrol-source-v1',scope:'patrol-source-data-only',
    sourceDigests:{[mainPath]:hash(JSON.stringify([compact(roster[0]),compact(max[0]),compact(selection[0]),Number(access[1])])),
      [extraPath]:hash(JSON.stringify([compact(forestSpec[0]),compact(append[0]),compact(rate[0]),rankCode])),
      [identityPath]:hash(JSON.stringify(stable(identities)))},
    zones:{forest:{runtimeZone:'forest',context:'wild/zone-01',requiredLevel:Number(access[1]),mapEntries:entries,
      selection:{maxMapEntries:8,triggerIncluded:true,sampleWithoutReplacement:true,groupMin:1,groupMax:3,
        shuffle:'fisher-yates-descending',outputOrder:'entry-index-ascending',eligiblePool:'alive-excluding-trigger'},
      rank:{eliteChance,otherwise:'regular'}}},outcomeVerified:false,rewardEligible:false};
  return {...catalog,sha256:hash(JSON.stringify(stable(catalog)))};
}
export async function syncPatrolSourceCatalog(root,checkOnly=false){
  const expected=JSON.stringify(await buildPatrolSourceCatalog(root),null,2)+'\n';
  const file=path.join(root,CATALOG_PATH);
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
  if(checkOnly)fail('generated projection is stale; regenerate the Patrol source catalog');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}
