import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {parse} from 'acorn';
import {buildCharacterExpThresholds,syncCharacterExpThresholds,THRESHOLDS_PATH} from '../scripts/lib/character-exp-thresholds.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const committed=require('../functions/src/generated/character-exp-thresholds.json');
const {newcomerExpNext}=require('../functions/src/canonical-newcomer-exp');
const main=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
const extra=fs.readFileSync(path.join(root,'js/34-v141-core-systems.js'),'utf8');
const curve=fs.readFileSync(path.join(root,'js/28-v133-economy-rebalance.js'),'utf8');
const rewards=require('../functions/src/patrol-reward-policy');
const program=source=>parse(source,{ecmaVersion:'latest'});
const body=source=>program(source).body[0].expression.callee.body.body;
const declaration=(nodes,name)=>nodes.flatMap(row=>row.type==='VariableDeclaration'?row.declarations:[]).find(row=>row.id.name===name);
const functionSource=(source,name)=>{const node=body(source).find(row=>row.type==='FunctionDeclaration'&&row.id.name===name);return source.slice(node.start,node.end);};
function finalClient(){
    const players=[{id:'Primary',level:1,exp:0,expNext:300}],storage=new Map();
    const context=vm.createContext({players,player:players[0],player2:null,player3:null,
        getExistingPartyIndexes:()=>players.map((_,index)=>index),getPartyCharacterByIndex:index=>players[index],
        getMonsterRank:monster=>monster.rank||'regular',
        makeZoneMonster:(name,level,element,rank)=>({name,level,element,rank}),
        FourSymbolsAccountSave:{accountKey:key=>'test:'+key},
        localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
        potionDefinitions:[],setInterval:()=>0,setTimeout:()=>0,saveGame:()=>{},alert:()=>{},console,
        FourSymbolsPatrolRewardPolicy:rewards});
    context.window=context;
    const mainNodes=program(main).body,zone=declaration(mainNodes,'zoneConfig');
    const rosterNames=zone.init.properties.map(row=>row.value.properties.find(property=>property.key.name==='monsters').value.body.name);
    vm.runInContext(rosterNames.map(name=>{const row=declaration(mainNodes,name);return `const ${main.slice(row.start,row.end)};`;}).join('\n')+
        `\nconst ${main.slice(zone.start,zone.end)};`,context);
    // Execute the actual final adapter, rather than duplicating its arithmetic.
    const source=fs.readFileSync(path.join(root,'js/25-v131-fix-batch.js'),'utf8');
    vm.runInContext('const rewardPolicy=FourSymbolsPatrolRewardPolicy;\n'+functionSource(source,'getFormalMonsterBaseExp')+
        '\nwindow.v173GetFormalMonsterBaseExp=getFormalMonsterBaseExp;',context);
    vm.runInContext(curve,context);
    const beforeAppend=context.v133GetExpNextForLevel(21);
    const rate=declaration(body(extra),'WILD_ELITE_RATE');
    vm.runInContext(`const ${extra.slice(rate.start,rate.end)};\n`+functionSource(extra,'getWildZoneSpecs')+'\n'+
        functionSource(extra,'addWindAndEarthWildMonsters')+'\naddWindAndEarthWildMonsters();',context);
    return {context,players,beforeAppend};
}
function fixture(t){
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'character-exp-policy-'));
    for(const file of ['js/00-main.js','js/34-v141-core-systems.js','js/28-v133-economy-rebalance.js','js/25-v131-fix-batch.js','functions/src/patrol-reward-policy.js']){
        fs.mkdirSync(path.dirname(path.join(directory,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(directory,file));
    }
    t.after(()=>{
        const resolved=fs.realpathSync(directory);
        assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
        assert.ok(path.basename(resolved).startsWith('character-exp-policy-'));
        fs.rmSync(resolved,{recursive:true,force:true});
    });
    return directory;
}
const edit=(directory,file,change)=>{const target=path.join(directory,file);fs.writeFileSync(target,change(fs.readFileSync(target,'utf8')));};

test('all100 generated thresholds match the actual final Client curve with late Wild roster expansion',async()=>{
    const generated=await buildCharacterExpThresholds(root),{context,beforeAppend}=finalClient();
    assert.deepEqual(generated,committed);
    assert.notEqual(beforeAppend,context.v133GetExpNextForLevel(21),'late roster must materially affect the curve');
    for(let level=1;level<=100;level++){
        assert.equal(generated.thresholds[level-1],context.v133GetExpNextForLevel(level),`level${level}`);
        assert.equal(newcomerExpNext(level),generated.thresholds[level-1]);
    }
    assert.equal(newcomerExpNext(19),6900);assert.equal(newcomerExpNext(20),52515);
    assert.equal(newcomerExpNext(50),2960400);assert.equal(newcomerExpNext(99),62676000);
    assert.equal(newcomerExpNext(100),newcomerExpNext(99));
    await syncCharacterExpThresholds(root,true);
});

test('thresholds ignore account, party, modes, time and current battle rank randomization',()=>{
    const {context,players}=finalClient();
    for(const level of [1,50,100]){
        players[0].level=level;players[1]={id:'Second',level:100};
        context.player2=players[1];context.elementBoxMode=true;context.restedBattles=300;
        for(let index=1;index<=100;index++)assert.equal(context.v133GetExpNextForLevel(index),newcomerExpNext(index));
    }
    vm.runInContext('Object.values(zoneConfig).forEach(zone=>zone.monsters().forEach(row=>row.rank="boss"));',context);
    for(let level=1;level<=100;level++)assert.equal(context.v133GetExpNextForLevel(level),newcomerExpNext(level));
    for(const level of [0,-1,101,1.5,NaN,Infinity,'10',null])assert.throws(()=>newcomerExpNext(level));
});

test('source seals exclude unrelated selection/account formatting and preserve existing Patrol catalog bytes',async t=>{
    const directory=fixture(t),before=await buildCharacterExpThresholds(directory);
    edit(directory,'js/00-main.js',source=>source.replace('const MAX_TRAINING_MONSTERS = 8;','const MAX_TRAINING_MONSTERS = 7;')+'\n// unrelated account adapter\n');
    edit(directory,'js/28-v133-economy-rebalance.js',source=>source.replace('function getExpNextForLevel(level){','function getExpNextForLevel( level ) {'));
    assert.deepEqual(await buildCharacterExpThresholds(directory),before);
    const {buildPatrolSourceCatalog}=await import('../scripts/lib/cloud-patrol-source-catalog.mjs');
    assert.deepEqual(await buildPatrolSourceCatalog(root),require('../functions/src/generated/patrol-source-catalog.json'));
});

test('formal roster/rate/curve changes require regenerated data and unsupported dynamic sources fail closed',async t=>{
    const directory=fixture(t);
    await syncCharacterExpThresholds(directory);
    edit(directory,'js/00-main.js',source=>source.replace('makeZoneMonster("赤炎修羅",52,','makeZoneMonster("赤炎修羅",53,'));
    await assert.rejects(()=>syncCharacterExpThresholds(directory,true),/stale/);
    const changed=await buildCharacterExpThresholds(directory);
    assert.notEqual(changed.thresholds[54],committed.thresholds[54]);assert.equal(changed.thresholds[0],300);
    edit(directory,'js/34-v141-core-systems.js',source=>source.replace('const WILD_ELITE_RATE=0.10;','const WILD_ELITE_RATE=0.20;'));
    assert.notEqual((await buildCharacterExpThresholds(directory)).thresholds[49],changed.thresholds[49]);
    edit(directory,'js/00-main.js',source=>source.replace('monsters:()=>zone6Monsters,','monsters:()=>zone6Monsters.slice(),'));
    await assert.rejects(()=>buildCharacterExpThresholds(directory),/dynamic roster/);
});

test('shared formal-base source changes are observed without module-cache reuse and unknown adapters are rejected',async t=>{
    const directory=fixture(t),before=await buildCharacterExpThresholds(directory);
    edit(directory,'functions/src/patrol-reward-policy.js',source=>source.replace('(Number(level)||0)*35','(Number(level)||0)*36'));
    const changed=await buildCharacterExpThresholds(directory);
    assert.notEqual(changed.thresholds[49],before.thresholds[49]);assert.equal(changed.thresholds[18],before.thresholds[18]);
    edit(directory,'js/25-v131-fix-batch.js',source=>source.replace('rewardPolicy.formalMonsterBaseExp(monster&&monster.level);',
        'rewardPolicy.formalMonsterBaseExp(monster&&monster.level)*2;'));
    await assert.rejects(()=>buildCharacterExpThresholds(directory),/unsupported formal EXP adapter/);
});
