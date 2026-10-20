import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildPlayerSkillConfigCatalog,syncPlayerSkillConfigCatalog,CATALOG_PATH} from '../scripts/lib/player-skill-config-catalog.mjs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
const root=process.cwd(),main='js/00-main.js',final='js/60-v173.64-skill-progression-rebalance.js';
const fields=['id','name','element','category','learnLevel','learnCost','maxLevel','requires'];
test('mechanical catalogue exactly matches the actual full-loaded renderer selection and fields in source order',async()=>{
    const {context}=loadLegacyRuntime(),db=vm.runInContext('skillDatabase',context);
    const tabs=vm.runInContext('Object.keys(SKILL_ELEMENT_TAB_META)',context);
    const damage=new Set();
    // Read the final Owner's own damage list, never infer direct effects from category or name.
    const source=fs.readFileSync(final,'utf8'),literal=source.match(/const PLAYER_DAMAGE_SKILL_IDS=Object.freeze\((\[[\s\S]*?\])\);/)[1];
    for(const id of JSON.parse(literal.replace(/,\s*\]/g,']')))damage.add(id);
    const selected=Object.keys(db).filter(id=>{const s=db[id];return !!(s&&s.element&&Object.hasOwn(s,'learnLevel')&&s.category!=='monster'&&tabs.includes(s.element));});
    const expected=selected.map(id=>Object.fromEntries([...fields.filter(key=>Object.hasOwn(db[id],key)).map(key=>[key,db[id][key]]),['damageClassification',damage.has(id)?'direct':'non-direct']]));
    const catalog=await buildPlayerSkillConfigCatalog(root);
    assert.deepEqual(catalog.skills,JSON.parse(JSON.stringify(expected)));
    assert.equal(catalog.skills.length,48,'current renderer result, not a generator admission limit');
    assert.equal(Object.keys(db).length,52,'the original full runtime eligibility inventory remains intact');
    for(const id of Object.keys(db).filter(id=>!selected.includes(id)))assert.equal(Object.hasOwn(db[id],'learnLevel'),false,id);
    assert.deepEqual(catalog,JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8')));
});
function temporary(){
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'player-skill-catalog-'));
    for(const file of [main,final,'scripts/build-production.mjs']){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(file,path.join(dir,file));}
    return dir;
}
test('generated catalogue is stale until rebuilt and selected literal drift is mechanical',async()=>{
    const dir=temporary();try{
        await assert.rejects(syncPlayerSkillConfigCatalog(dir,true),/stale/);
        await syncPlayerSkillConfigCatalog(dir);await syncPlayerSkillConfigCatalog(dir,true);
        const file=path.join(dir,final),source=fs.readFileSync(file,'utf8');fs.writeFileSync(file,source.replace('flameSlash:{learnLevel:1,learnCost:2','flameSlash:{learnLevel:1,learnCost:3'));
        await assert.rejects(syncPlayerSkillConfigCatalog(dir,true),/stale/);
        assert.equal((await buildPlayerSkillConfigCatalog(dir)).skills.find(s=>s.id==='flameSlash').learnCost,3);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unknown selected expressions, duplicate definitions, predicate changes and hidden overrides fail closed',async()=>{
    for(const [file,edit] of [
        [final,s=>s.replace('flameSlash:{learnLevel:1,learnCost:2','flameSlash:{learnLevel:1,learnCost:evil()')],
        [final,s=>s.replace('flameSlash:{learnLevel:1','flameSlash:{learnCost:3,learnLevel:1')],
        [main,s=>s.replace('skill.category!=="monster"','skill.category!=="buff"')],
        [final,s=>s+'\nskillDatabase.flameSlash.learnCost=1;\n'],
        [final,s=>s.replace('wall.requires=["petrifyFist","sandWind"]','wall.requires=getRequirements()')]
    ]){
        const dir=temporary();try{const location=path.join(dir,file);fs.writeFileSync(location,edit(fs.readFileSync(location,'utf8')));await assert.rejects(buildPlayerSkillConfigCatalog(dir),/Player skill catalog/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
    }
});
