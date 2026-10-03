import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
const require=createRequire(import.meta.url);
/** Reuse existing DOM fixture; execute actual current app/gameplay sources, not a copied stat formula. */
export function loadLegacyRuntime(){
  const source=fs.readFileSync('tests/v170-final-spec-integration.test.js','utf8');
  const fixture=source.slice(source.indexOf('function makeUniversalNode()'),source.indexOf('function loadFinalRuntime()'));
  const context=new Function('vm',fixture+';return makeContext();')(vm);
  context.document.createDocumentFragment=()=>context.document.createElement('fragment');
  vm.runInContext(fs.readFileSync('js/startup/account-save-repository.js','utf8'),context);
  vm.runInContext('FourSymbolsAccountSave.activate("monster-shadow-isolated-fixture")',context);
  const build=fs.readFileSync('scripts/build-production.mjs','utf8');
  const paths=[];
  for(const list of ['appScripts','gameplayScripts']){
    const block=build.match(new RegExp('const '+list+'=\\[([\\s\\S]*?)\\];'))[1];
    for(const m of block.matchAll(/"([^"]+\.js)"/g)){paths.push(m[1]);vm.runInContext(fs.readFileSync(m[1],'utf8'),context,{filename:m[1],timeout:3000});}
  }
  // Expose private production builders ONLY inside isolated diagnostic VM; repository source is never changed.
  const tower=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8').replace('    window.GameplaySystem=Object.freeze({','    window.__shadowTower={troop:buildTowerTroop,boss:buildTowerBossMonster};\n    window.GameplaySystem=Object.freeze({');
  vm.runInContext(tower,context,{filename:'js/gameplay-boss-tower-system.js',timeout:3000});
  paths.push('js/gameplay-boss-tower-system.js');
  paths.push('js/59-abyss-two-tier-runtime.js');
  vm.runInContext(fs.readFileSync('js/59-abyss-two-tier-runtime.js','utf8'),context,{filename:'js/59-abyss-two-tier-runtime.js'});
  const wild=fs.readFileSync('js/25-v131-fix-batch.js','utf8');
  vm.runInContext('const V173_32_WILD_ZONE_STRENGTHS=window.v173WildZoneStrengthMultipliers;'+wild.slice(wild.indexOf('    function strengthenMonster('),wild.indexOf('    function strengthenAllZoneMonsters(')),context);
  return {context,paths};
}
const select=monster=>({maxHP:monster.maxHP,maxSP:monster.maxSP,physicalAttack:monster.attack,magicAttack:monster.magicAttack,defense:monster.defense,speed:monster.agility});
export function buildMatrix(){
 const {context,paths}=loadLegacyRuntime();
 const rows=[];
 const levels=[1,10,30,50,70,100];
 for(const level of levels)for(const archetype of Object.keys(MonsterBalance.archetypes))for(const rank of MonsterBalance.ranks)for(const mode of ['wild','daily','tower','abyss','adventure']){
  const zone=Math.min(9,Math.floor((level-1)/10));
  const spec={name:'Shadow specimen',level,element:'fire',archetype,rank,mode,context:mode==='wild'?'wild/zone/'+zone:mode==='tower'?'tower/floor/'+level:mode+'/diagnostic'};
  const shadow=mode==='tower'?MonsterBalance.previewTower(spec,level):MonsterBalance.preview(spec);
  const legacyRank=rank==='smallBoss'?'boss':rank;
  context.__spec={...spec,rank:legacyRank};
  let provenance,monster;
  if(mode==='tower'){
   const legacyLevel=Math.max(30,Math.min(100,Math.round(29+level*.71)));
   monster=rank==='smallBoss'?context.__shadowTower.boss({id:'tower-'+level,name:spec.name,level:legacyLevel,element:'fire'},level):context.__shadowTower.troop(legacyLevel,'fire',legacyRank,level,0);
   provenance='actual Tower builders; smallBoss outside 10-multiple floor is diagnostic only';
  }else if(mode==='daily'){
   monster=context.v132BuildDungeonMonster(spec.name,level,'fire',legacyRank);
   monster.v173DailyDungeonType='exp';
   context.v132ActiveDungeonRun={partySize:3,highestPartyLevel:level};
   context.v17342NormalizeDailyDungeonMonster(monster);
   provenance='actual V132 + V158 exp; explicit three-member party, stage unspecified';
  }else if(mode==='abyss'){
   // Current Abyss officially permits only Lv20/40. Preserve these actual compatibility targets.
   const difficulty=level<=30?20:40;
   const roster=context.v174AbyssBuildRoster(difficulty,0,rank==='smallBoss'?4:0);
   monster=roster.find(m=>m.rank===legacyRank);
   provenance='actual V174 east-region '+difficulty+' encounter; different level/element explicitly recorded, NOT same-level TTK comparison';
  }else{
   monster=context.makeZoneMonster(spec.name,level,'fire',legacyRank);
   provenance='actual final makeZoneMonster (Adventure direct construction contract)';
   if(mode==='wild'){
    context.strengthenMonster(monster,context.v173WildZoneStrengthMultipliers[zone]);
    if(zone===0)context.v17342NormalizeBeginnerForestMonster(monster);
    if(rank==='elite'){monster.rank='regular';monster.v141BattleRank='elite';}
    provenance='actual V131/V158, diagnostic zone band '+zone+'; wild smallBoss direct rank is comparison only';
   }
  }
  const legacy=select(monster);
  const legacyAllocation=Object.fromEntries(Object.keys(shadow.allocation).map(key=>[key,monster[key]]));
  const differencePercent=Object.fromEntries(Object.keys(legacy).map(key=>[key,legacy[key]===0?null:Number(((shadow.final[key]/legacy[key]-1)*100).toFixed(4))]));
  rows.push({spec,legacyContext:{provenance,actualLevel:monster.level,actualElement:monster.element,rank:monster.rank,battleRank:monster.v141BattleRank||null,sameLevel:monster.level===level,archetype:'not represented by legacy runtime'},legacy,legacyAllocation,legacyAbilityPointTotal:Object.values(legacyAllocation).reduce((a,b)=>a+b,0),shadowBase:shadow.base,shadowAllocation:shadow.allocation,shadow:shadow.final,differencePercent});
 }
 const compatibility=[];
 for(const difficulty of [20,40])for(const region of [0,1,2,3,4])for(const stage of [0,1,2,3,4]){
  compatibility.push({difficulty,region,stage,roster:context.v174AbyssBuildRoster(difficulty,region,stage).map(m=>({name:m.name,level:m.level,element:m.element,rank:m.rank,...select(m)}))});
 }
 return JSON.parse(JSON.stringify({workId:'MONSTER-BALANCE-OWNER-P1-20261003',runtimePolicy:'SHADOW ONLY; rank/mode neutral factors unratified; no formal TTK claim',matrixRows:rows.length,axes:{levels,archetypes:Object.keys(MonsterBalance.archetypes),ranks:MonsterBalance.ranks,modes:['wild','daily','tower','abyss','adventure']},comparisonNotes:['Legacy has no archetype; repeats across archetype axis are intentional.','Abyss supports only Lv20/Lv40; actual level/element and sameLevel flags must accompany differences.','Synthetic requested ranks/floors/levels are builder diagnostics, not proof of playable encounters.','NULL difference means zero legacy denominator, not zero percent.','No party simulation or TTK verification is claimed.'],sourceHashes:Object.fromEntries([...new Set(paths)].map(path=>[path,crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')])),rows,abyssCompatibility:compatibility}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=buildMatrix();
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');else process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
