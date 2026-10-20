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
    const mainSource=fs.readFileSync(main,'utf8'),start=mainSource.indexOf('    const matchingSkillIds='),end=mainSource.indexOf('    const progressionOrder=',start);
    assert(start>=0&&end>start);
    const visible=new Set(tabs.flatMap(element=>vm.runInContext(`selectedSkillElementTab=${JSON.stringify(element)};(()=>{${mainSource.slice(start,end)}return matchingSkillIds;})()`,context)));
    const selected=Object.keys(db).filter(id=>visible.has(id));
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
    const build=fs.readFileSync('scripts/build-production.mjs','utf8'),files=new Set([main,final,'scripts/build-production.mjs',
        'functions/src/skill-learning-policy-v1.json','functions/src/skill-loadout-policy-v1.json']);
    for(const list of ['appScripts','gameplayScripts'])for(const match of build.match(new RegExp('const '+list+'=\\[([\\s\\S]*?)\\];'))[1].matchAll(/"([^"]+\.js)"/g))files.add(match[1]);
    for(const file of files){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(file,path.join(dir,file));}
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

test('only sealed original loadout delegate readers preserve normalized v1 data provenance',async()=>{
    const dir=temporary();
    try{
        const before=fs.readFileSync(CATALOG_PATH,'utf8');
        assert.equal(JSON.stringify(await buildPlayerSkillConfigCatalog(dir),null,2)+'\n',before);
        const core='functions/src/skill-progression-core.js';
        for(const [file,edit] of [
            [core,s=>s.replace('getRulesForVersion,getLoadoutRulesForVersion,','getRulesForVersion,getLoadoutRulesForVersion:createRules,')],
            [core,s=>s.replace('getRulesForVersion,getLoadoutRulesForVersion,','getRulesForVersion,getLoadoutRulesForVersion,getLoadoutRulesForVersion,')],
            [core,s=>s.replace('return createLoadoutRulesV1(catalog);','return createRulesV1(catalog,[]);')],
            [core,s=>s.replace('equipped.length>=4','equipped.length>=3')],
            [main,s=>s.replace('.getLoadoutRulesForVersion("v1",skillDatabase)','.getLoadoutRulesForVersion("v2",skillDatabase)')],
            [main,s=>s.replace('.getLoadoutRulesForVersion("v1",skillDatabase)','.getLoadoutRulesForVersion("v1",skillDatabase,null)')],
            [main,s=>s.replace('.getLoadoutRulesForVersion("v1",skillDatabase)','["getLoadoutRulesForVersion"]("v1",skillDatabase)')],
            [main,s=>s.replace('.getLoadoutRulesForVersion("v1",skillDatabase)','.getLoadoutRulesForVersion?.("v1",skillDatabase)')],
            [main,s=>s.replace('window.FourSymbolsSkillProgressionCore\n        .getLoadoutRulesForVersion("v1",skillDatabase)','selectLoadout("v1",skillDatabase)')],
            [main,s=>s.replace('.getLoadoutRulesForVersion("v1",skillDatabase)','.getRulesForVersion("v1",skillDatabase)')],
            [main,s=>s+'\nwindow.FourSymbolsSkillProgressionCore.getLoadoutRulesForVersion("v1",skillDatabase);\n'],
            [final,s=>s.replace('finalizeSkillMutation();\n            return true;\n        };\n    }\n\n    if(typeof getSkillEffectPreviewText','return true;\n        };\n    }\n\n    if(typeof getSkillEffectPreviewText')],
            ['js/31-v136-auto-battle-fix.js',s=>s+'\nrememberExplicitAction=function(){};\n'],
            [final,s=>s+'\nskillDatabase.flameSlash.learnCost=999;\n'],
            [final,s=>s+'\nconst escapedLoadoutData=skillDatabase.flameSlash;unknownMutation(escapedLoadoutData);\n'],
            [final,s=>s+'\nObject.values(skillDatabase).forEach(skill=>{skill.learnCost=999;});\n']
        ]){
            const pathName=path.join(dir,file),original=fs.readFileSync(pathName,'utf8'),changed=edit(original);
            assert.notEqual(changed,original,file+' mutation anchor');fs.writeFileSync(pathName,changed);
            try{await assert.rejects(buildPlayerSkillConfigCatalog(dir));}finally{fs.writeFileSync(pathName,original);}
        }
        assert.equal(fs.readFileSync(CATALOG_PATH,'utf8'),before);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unknown selected expressions, duplicate definitions, predicate changes and hidden overrides fail closed',async()=>{
    for(const [file,edit] of [
        [final,s=>s.replace('flameSlash:{learnLevel:1,learnCost:2','flameSlash:{learnLevel:1,learnCost:evil()')],
        [final,s=>s.replace('flameSlash:{learnLevel:1','flameSlash:{learnCost:3,learnLevel:1')],
        [main,s=>s.replace('skill.category!=="monster"','skill.category!=="buff"')],
        [final,s=>s+'\nskillDatabase.flameSlash.learnCost=1;\n'],
        [main,s=>s+'\nskillDatabase.flameSlash.learnCost=1;\n'],
        ['js/50-v169-water-skill-rules.js',s=>s+'\nconst selected=skillDatabase.flameSlash;selected.learnLevel=1;\n'],
        ['js/50-v169-water-skill-rules.js',s=>s+'\nlet late;late=skillDatabase;late.flameSlash.learnCost=1;\n'],
        ['js/50-v169-water-skill-rules.js',s=>s+'\nconst {flameSlash:late}=skillDatabase;late.learnCost=1;\n'],
        ['js/50-v169-water-skill-rules.js',s=>s+'\nglobalThis.late=skillDatabase.flameSlash;\n'],
        ['js/50-v169-water-skill-rules.js',s=>s+'\nObject.values(skillDatabase).forEach(s=>{s.learnCost=1;});\n'],
        [final,s=>s.replace('applyFinalProgressionData();','if(false)applyFinalProgressionData();')],
        [final,s=>s.replace('applyFinalProgressionData();','')],
        ['scripts/build-production.mjs',s=>s.replace('"js/36-v141-content-systems.js"','"SWAP"').replace('"js/60-v173.64-skill-progression-rebalance.js"','"js/36-v141-content-systems.js"').replace('"SWAP"','"js/60-v173.64-skill-progression-rebalance.js"')],
        ['js/44-v152-dev-fixes.js',s=>s.replace('patchSkill("yuanXiangGuangMing",{','patchSkill("yuanXiangGuangMing",{learnLevel:1,')],
        [final,s=>s+'\nunknownMutation(skillDatabase.flameSlash);\n'],
        [final,s=>s.replace('wall.requires=["petrifyFist","sandWind"]','wall.requires=getRequirements()')],
        [main,s=>s.replace('spCost:8,','spCost:unknownSideEffect(),')]
    ]){
        const dir=temporary();try{const location=path.join(dir,file);fs.writeFileSync(location,edit(fs.readFileSync(location,'utf8')));await assert.rejects(buildPlayerSkillConfigCatalog(dir),/Player skill catalog/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
    }
});
test('formatting and unrelated literal combat values cannot alter the projected configuration',async()=>{
    const dir=temporary();try{
        const original=await buildPlayerSkillConfigCatalog(dir),file=path.join(dir,final),source=fs.readFileSync(file,'utf8');
        fs.writeFileSync(file,source.replace('const FINAL_PROGRESSION={','/* formatting only */\nconst FINAL_PROGRESSION = {').replace('baseDamage:28,damagePerLevel:6,spCost:60','baseDamage:29,damagePerLevel:7,spCost:61'));
        assert.deepEqual(await buildPlayerSkillConfigCatalog(dir),original);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
