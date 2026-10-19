import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {preparePatrolMembers,patrolVictoryExp}=require('../functions/src/patrol-ticket-policy');
const catalog=require('../functions/src/generated/patrol-source-catalog.json');
const entries=catalog.zones.forest.mapEntries;
function seeded(seed){let state=seed>>>0;return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);}
const source=fs.readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
const start=source.indexOf('    const alivePool =');
const end=source.indexOf('\n    /*',source.indexOf('.sort(',start));
const selection=source.slice(start,end);
assert(start>0&&selection.includes('currentBattleMonsters ='));

test('server bounded source selection matches original Client shuffle, count and map order',()=>{
    for(let seed=1;seed<=300;seed++){
        const trigger=seed%8,available=entries.filter((_,index)=>index===trigger||((seed>>index)&1)).map(row=>row.entryId);
        const draw=seeded(seed),clientDraw=seeded(seed);
        const result=preparePatrolMembers({triggerEntryId:entries[trigger].entryId,availableEntryIds:available},draw);
        const context={monsters:entries.map(row=>({alive:available.includes(row.entryId)})),triggerIndex:trigger,
            MAX_TRAINING_MONSTERS:8,currentZone:'forest',Math:Object.create(Math),currentBattleMonsters:[]};
        context.Math.random=clientDraw;vm.runInNewContext(selection,context);
        assert.deepEqual(result.map(row=>row.entryId),Array.from(context.currentBattleMonsters,index=>entries[index].entryId));
        for(const row of result)assert.equal(row.rank,clientDraw()<.1?'elite':'regular');
        assert.equal(new Set(result.map(row=>row.entryId)).size,result.length);
    }
});
test('member rewards remain server-computed, independently rolled and bounded by original source policies',()=>{
    const normalSamples=[.99,.99,0,0,0,0,0];let i=0;
    const normal=preparePatrolMembers({triggerEntryId:'forest:0',availableEntryIds:['forest:0']},()=>normalSamples[i++]??0);
    assert.equal(normal.length,1);assert.equal(normal[0].rank,'regular');
    assert.equal(normal[0].gold,35);assert.equal(normal[0].drops.length,4);
    const elite=preparePatrolMembers({triggerEntryId:'forest:0',availableEntryIds:['forest:0']},()=>0);
    assert.equal(elite[0].rank,'elite');assert.equal(elite[0].gold,75);
    assert.deepEqual(elite[0].drops.map(row=>row.itemId),['ticketSetFire']);
});
test('victory EXP preserves newcomer, rank, highest-created level and mode precedence',()=>{
    const row={...entries[0],rank:'regular'};
    assert.equal(patrolVictoryExp([row],[{level:1}],{}),294);
    assert.equal(patrolVictoryExp([row],[{level:1}],{rested:true}),588);
    assert.equal(patrolVictoryExp([row],[{level:1}],{elementBox:true,rested:true}),206);
    assert.equal(patrolVictoryExp([{...row,rank:'elite'}],[{level:9},{level:50}],{}),441);
    assert.equal(patrolVictoryExp([row],[{level:10}],{}),315);
    assert.equal(patrolVictoryExp([row],[{level:10},{level:20}],{}),105);
});
test('unknown sources, duplicates, malformed server samples and forged EXP identities refuse',()=>{
    for(const args of [{triggerEntryId:'forest:9'},{triggerEntryId:'forest:0',availableEntryIds:[]},
        {triggerEntryId:'forest:0',availableEntryIds:['forest:0','forest:0']},
        {triggerEntryId:'forest:0',availableEntryIds:['forest:1']}]){
        assert.throws(()=>preparePatrolMembers(args,()=>.5));
    }
    for(const sample of [-1,1,NaN,Infinity,'0.5',null])assert.throws(()=>
        preparePatrolMembers({triggerEntryId:'forest:0',availableEntryIds:['forest:0']},()=>sample));
    const row={...entries[0],rank:'regular'};
    for(const rows of [[{...row,level:100}],[{...row,rank:'boss'}],[row,row],[]]){
        assert.throws(()=>patrolVictoryExp(rows,[{level:1}],{}));
    }
});
