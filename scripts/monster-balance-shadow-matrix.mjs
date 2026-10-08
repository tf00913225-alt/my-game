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
  const context=new Function('vm','fs',fixture+';return makeContext();')(vm,fs);
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
  return {context,paths};
}
const select=monster=>({maxHP:monster.maxHP,maxSP:monster.maxSP,physicalAttack:monster.attack,magicAttack:monster.magicAttack,defense:monster.defense,speed:monster.agility});
export function buildMatrix(){
 const evidence=JSON.parse(fs.readFileSync('docs/monster-balance-shadow-evidence.json','utf8'));
 const lines=fs.readFileSync('docs/monster-balance-shadow-matrix.csv','utf8').trim().split('\n');
 const split=line=>line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,''));
 const header=split(lines.shift());
 const rows=lines.map(line=>{
  const row=Object.fromEntries(split(line).map((v,i)=>[header[i],v]));
  return {spec:Object.fromEntries(['mode','context','name','element','rank','archetype'].map(k=>[k,row[k]]).concat([['level',Number(row.level)]])),
    legacyContext:{sameLevel:row.sameLevel==='True'},
    shadowBase:{abilityPointBudget:Number(row.shadowAbilityPointBudget)},
    shadowAllocation:Object.fromEntries(['attack','intelligence','vitality','energy','defense','agility'].map(k=>[k+'Points',Number(row[k+'Points'])]))};
 });
 return {...evidence,rows};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=buildMatrix();
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');else process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
