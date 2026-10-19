import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildPatrolSourceCatalog,syncPatrolSourceCatalog,CATALOG_PATH}
    from '../scripts/lib/cloud-patrol-source-catalog.mjs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';

const root=process.cwd();
const inputs=['js/00-main.js','js/34-v141-core-systems.js','config/wild-monster-archetypes.json'];
function sourceFixture(t){
    const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'patrol-source-catalog-'));
    t.after(()=>{
        assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
        fs.rmSync(temporary,{recursive:true,force:true});
    });
    for(const file of inputs){
        const target=path.join(temporary,file);
        fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.copyFileSync(path.join(root,file),target);
    }
    return temporary;
}
function contents(directory){
    const files={};
    function visit(location){
        for(const entry of fs.readdirSync(location,{withFileTypes:true})){
            const target=path.join(location,entry.name);
            if(entry.isDirectory()){
                files[path.relative(directory,target)]={directory:true};visit(target);
            }
            else files[path.relative(directory,target)]={bytes:fs.readFileSync(target).toString('base64'),
                modified:fs.statSync(target).mtimeMs};
        }
    }
    visit(directory);return files;
}

test('Forest catalog matches all eight final Client positions and source bounds, without combat authority',async()=>{
    const catalog=await buildPatrolSourceCatalog(root);
    await syncPatrolSourceCatalog(root,true);
    const {context}=loadLegacyRuntime();
    const read=expression=>JSON.parse(vm.runInContext(`JSON.stringify(${expression})`,context));
    const forest=catalog.zones.forest;
    const actual=read(`forestMonsters.map((monster,index)=>({entryId:'forest:'+index,
        monsterKey:monster.balanceProjection.identity.monsterKey,name:monster.name,
        level:monster.level,element:monster.element,context:monster.balanceProjection.identity.context}))`);
    assert.deepEqual(forest.mapEntries,actual);
    assert.equal(actual.length,8);
    assert.deepEqual(actual.map(row=>row.element),['fire','water','fire','water','fire','water','wind','earth']);
    assert.equal(new Set(actual.map(row=>row.monsterKey)).size,4,'map-position weights must retain repeated identities');
    assert.deepEqual(actual.map(row=>row.level),[3,2,3,2,3,2,3,3]);
    assert.equal(forest.runtimeZone,'forest');assert.equal(forest.context,'wild/zone-01');
    assert.equal(forest.requiredLevel,read('zoneConfig.forest.requiredLevel'));
    assert.equal(forest.rank.eliteChance,read('v141SystemConfig.wildEliteRate'));
    assert.equal(forest.rank.otherwise,'regular');
    assert.equal(forest.selection.maxMapEntries,read('MAX_TRAINING_MONSTERS'));
    assert.equal(catalog.schemaVersion,1);assert.equal(catalog.scope,'patrol-source-data-only');
    assert.equal(catalog.outcomeVerified,false);assert.equal(catalog.rewardEligible,false);
    assert.match(catalog.sha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(catalog.sourceDigests).sort(),inputs.slice().sort());
});

test('selection bounds agree with the actual Client source slice in a fully loaded runtime',async()=>{
    const policy=(await buildPatrolSourceCatalog(root)).zones.forest.selection;
    const main=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
    const selection=main.match(/const alivePool =[\s\S]*?currentBattleMonsters = \[[\s\S]*?\]\s*\.sort\(\s*\(a,b\)=>a-b\s*\);/);
    assert.ok(selection,'formal startBattle selection source must remain identifiable');
    const {context}=loadLegacyRuntime();
    const run=source=>vm.runInContext(source,context);
    assert.deepEqual(policy,{maxMapEntries:8,triggerIncluded:true,sampleWithoutReplacement:true,
        groupMin:1,groupMax:3,shuffle:'fisher-yates-descending',outputOrder:'entry-index-ascending',
        eligiblePool:'alive-excluding-trigger'});
    for(const [sample,expected] of [[0,[2]],[.999999,[0,2,3]]]){
        run(`currentZone='forest';monsters=Array.from({length:9},(_,i)=>({alive:i!==1}));`);
        const draws=[];
        context.Math.random=()=>{draws.push(true);return draws.length<=5?.999999:sample;};
        run(`{const triggerIndex=2;${selection[0]}}`);
        const selected=JSON.parse(run('JSON.stringify(currentBattleMonsters)'));
        assert.deepEqual(selected,expected);assert.equal(draws.length,6);
        assert.ok(selected.includes(2));assert.ok(!selected.includes(1));assert.ok(!selected.includes(8));
        assert.equal(new Set(selected).size,selected.length);
    }
});

test('catalog digest is stable and checkOnly leaves missing, stale and current output untouched',async t=>{
    const directory=sourceFixture(t),output=path.join(directory,CATALOG_PATH);
    assert.deepEqual(await buildPatrolSourceCatalog(directory),await buildPatrolSourceCatalog(directory));
    let before=contents(directory);
    await assert.rejects(syncPatrolSourceCatalog(directory,true));
    assert.deepEqual(contents(directory),before);assert.equal(fs.existsSync(output),false);
    await syncPatrolSourceCatalog(directory);
    before=contents(directory);await syncPatrolSourceCatalog(directory,true);
    assert.deepEqual(contents(directory),before);
    const stored=JSON.parse(fs.readFileSync(output,'utf8'));stored.sha256='0'.repeat(64);
    fs.writeFileSync(output,JSON.stringify(stored)+'\n');before=contents(directory);
    await assert.rejects(syncPatrolSourceCatalog(directory,true));assert.deepEqual(contents(directory),before);
});

test('unsupported roster calls and malformed or foreign identity evidence fail closed',async t=>{
    const directory=sourceFixture(t),mainPath=path.join(directory,inputs[0]);
    const originalMain=fs.readFileSync(mainPath,'utf8');
    const changed=originalMain.replace('makeZoneMonster("哥布林",3,"fire","regular","wild.zone-01.fire-01"',
        'unsupportedMonsterFactory("哥布林",3,"fire","regular","wild.zone-01.fire-01"');
    assert.notEqual(changed,originalMain);fs.writeFileSync(mainPath,changed);
    await assert.rejects(buildPatrolSourceCatalog(directory));fs.writeFileSync(mainPath,originalMain);
    const identityPath=path.join(directory,inputs[2]),originalIdentity=fs.readFileSync(identityPath,'utf8');
    for(const mutate of [value=>delete value.entries['wild.zone-01.wind-01'],
        value=>{value.entries['wild.zone-01.fire-01'].zone='wild/zone-02';},
        value=>{value.entries=null;},value=>{value.entries=[];},
        value=>{value.schemaVersion=2;},value=>{delete value.schemaVersion;},
        value=>{value.entries['wild.zone-01.fire-01']=[];},
        value=>{value.entries['wild.zone-01.earth-01']=null;},
        value=>{value.entries['wild.zone-01.wind-01']='wild/zone-01';}]){
        const identity=JSON.parse(originalIdentity);mutate(identity);
        fs.writeFileSync(identityPath,JSON.stringify(identity));
        const before=contents(directory);
        await assert.rejects(buildPatrolSourceCatalog(directory));assert.deepEqual(contents(directory),before);
    }
});

test('unsupported sampling, append, access, and rank source shapes refuse generation without writes',async t=>{
    const directory=sourceFixture(t);
    for(const [file,oldText,newText] of [
        [inputs[0],'alivePool.length-1','alivePool.length-2'],
        [inputs[0],'const MAX_TRAINING_MONSTERS = 8;','const MAX_TRAINING_MONSTERS = 9;'],
        [inputs[0],'requiredLevel:0,','requiredLevel:getUnknownAccess(),'],
        [inputs[1],'const WILD_ELITE_RATE=0.10;','const WILD_ELITE_RATE=2;'],
        [inputs[1],'Math.random()<WILD_ELITE_RATE','Math.random()<=WILD_ELITE_RATE'],
        [inputs[1],'addWindAndEarthWildMonsters();','unsupportedAppendCall();'],
    ]){
        const target=path.join(directory,file),original=fs.readFileSync(target,'utf8');
        const mutated=original.replace(oldText,newText);assert.notEqual(mutated,original,oldText);
        fs.writeFileSync(target,mutated);const before=contents(directory);
        await assert.rejects(buildPatrolSourceCatalog(directory),undefined,oldText);
        assert.deepEqual(contents(directory),before);fs.writeFileSync(target,original);
    }
});

test('bounded source drift changes the seal while unrelated presentation and source changes do not',async t=>{
    const directory=sourceFixture(t),baseline=await buildPatrolSourceCatalog(directory);
    const extra=path.join(directory,inputs[1]),originalExtra=fs.readFileSync(extra,'utf8');
    fs.writeFileSync(extra,originalExtra.replace('const WILD_ELITE_RATE=0.10;','const WILD_ELITE_RATE=0.11;'));
    const changed=await buildPatrolSourceCatalog(directory);
    assert.equal(changed.zones.forest.rank.eliteChance,.11);
    assert.notEqual(changed.sha256,baseline.sha256);
    assert.notEqual(changed.sourceDigests[inputs[1]],baseline.sourceDigests[inputs[1]]);
    fs.writeFileSync(extra,originalExtra);
    await syncPatrolSourceCatalog(directory);
    const main=path.join(directory,inputs[0]),originalMain=fs.readFileSync(main,'utf8');
    fs.writeFileSync(main,originalMain.replace('title:"新手森林",','title:"Catalog presentation test",')+'\n// unrelated source note\n');
    assert.deepEqual(await buildPatrolSourceCatalog(directory),baseline);
    const before=contents(directory);await syncPatrolSourceCatalog(directory,true);
    assert.deepEqual(contents(directory),before);
});
