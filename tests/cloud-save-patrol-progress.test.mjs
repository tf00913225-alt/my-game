import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {applyPatrolProgress}=require('../functions/src/patrol-progress.js');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources.js');
const {assembleCanonicalSnapshot}=require('../functions/src/canonical-snapshot.js');
const goals=require('../functions/src/generated/patrol-progress-policy.json').quests;
const catalog=require('../functions/src/generated/patrol-source-catalog.json');
const now=Date.parse('2026-10-19T12:00:00Z'),member={entryId:'forest:0',rank:'regular'};
const clone=structuredClone;
function initial(){return makeInitialCharacterSources('patrol-progress-uid',2,'patrol-progress-initial-0001',{
    displayName:'森林角色',element:'fire',gender:'female',attributes:{attack:3,vitality:2,
        energy:1,intelligence:2,defensePoints:1,agility:1}},{recordedAt:now});}
function apply(records,options={}){return applyPatrolProgress(records,{kind:'member',member,serverNow:now,...options});}
function active(){const records=initial();records.progress=apply(records,{kind:'loss',member:undefined,initialLineageVerified:true}).progress;return records;}
function frozen(value){if(value&&typeof value==='object'){for(const row of Object.values(value))frozen(row);Object.freeze(value);}return value;}

test('actual new-account zero quests expand only formal keys and projection retries leave all input untouched',()=>{
    const records=frozen(initial()),before=clone(records),input=frozen({kind:'member',member,serverNow:now,initialLineageVerified:true});
    const first=applyPatrolProgress(records,input),retry=applyPatrolProgress(records,input);
    assert.deepEqual(first,retry);assert.deepEqual(records,before);
    assert.deepEqual(Object.keys(first.progress.dailyQuestState.progress),Object.keys(goals.daily));
    assert.deepEqual(Object.keys(first.progress.commissionQuestState.progress),Object.keys(goals.commission));
    assert.equal(first.progress.dailyQuestState.date,'2026-10-19');
    assert.equal(first.progress.dailyQuestState.progress.killMonsters,1);assert.equal(first.progress.dailyQuestState.progress.kill10,1);
    assert.equal(first.progress.dailyQuestState.progress.checkin,0);assert.equal(first.progress.dailyQuestState.progress.skills5,0);
    assert.equal(first.transitionEvidence.before.dailyQuestState.date,'');
    assert.deepEqual(records.claimRecords,[]);assert.equal(first.progress.economy,undefined);
    assert.equal(assembleCanonicalSnapshot(records.account.ownerUid,2,{...records,progress:first.progress}).readyForPublication,false);
});

test('same UTC period preserves every recorded claim, unrelated skill/check-in counter and milestone raw byte',()=>{
    const records=active();records.progress.dailyQuestState.claimed.checkin=true;
    records.progress.dailyQuestState.claimed.killMonsters=true;records.progress.dailyQuestState.progress.checkin=1;
    records.progress.dailyQuestState.progress.skills5=2;records.progress.commissionQuestState.progress.skills15=3;
    const raw=' { "date":"2026-10-18", "daily":{"20":true}, "commission":{"100":true} } ';
    records.progress.sidecars['quest-milestones'].raw=raw;
    records.progress.sidecars.progress.raw=' {"eliteKills":3,"dungeonWins":4,"abyssClears":5} ';
    const before=clone(records),result=apply(records);
    assert.deepEqual(result.progress.dailyQuestState.claimed,before.progress.dailyQuestState.claimed);
    assert.deepEqual(result.progress.commissionQuestState.claimed,before.progress.commissionQuestState.claimed);
    assert.equal(result.progress.dailyQuestState.progress.skills5,2);assert.equal(result.progress.dailyQuestState.progress.checkin,1);
    assert.equal(result.progress.commissionQuestState.progress.skills15,3);
    assert.equal(result.progress.sidecars['quest-milestones'].raw,raw);
    assert.equal(result.progress.sidecars.progress.raw,before.progress.sidecars.progress.raw);
    assert.equal(result.transitionEvidence.before.questMilestonesRaw,raw);
    assert.equal(result.transitionEvidence.before.questMilestonesSha256,createHash('sha256').update(raw).digest('hex'));
    assert.deepEqual(records,before);assert.deepEqual(result.progress.achievementState,before.progress.achievementState);
});

test('UTC rollover resets only the current quest view and retains old claims and milestone evidence',()=>{
    const records=active();
    for(const group of ['dailyQuestState','commissionQuestState']){
        records.progress[group].date='2026-10-18';
        for(const id of Object.keys(records.progress[group].progress)){
            records.progress[group].progress[id]=1;records.progress[group].claimed[id]=true;
        }
    }
    const raw=' {"date":"2026-10-18","daily":{"20":true},"commission":{"40":true}} ';
    records.progress.sidecars['quest-milestones'].raw=raw;
    const before=clone(records),result=apply(records);
    for(const group of ['dailyQuestState','commissionQuestState']){
        assert.equal(result.progress[group].date,'2026-10-19');
        assert.ok(Object.values(result.progress[group].claimed).every(value=>value===false));
        assert.deepEqual(result.transitionEvidence.before[group],before.progress[group]);
    }
    assert.equal(result.progress.dailyQuestState.progress.killMonsters,1);
    assert.equal(result.progress.dailyQuestState.progress.checkin,0);assert.equal(result.progress.dailyQuestState.progress.skills5,0);
    assert.equal(result.progress.sidecars['quest-milestones'].raw,raw);assert.deepEqual(records,before);
    assert.deepEqual(records.claimRecords,before.claimRecords);
});

test('Taipei midnight is not a quest boundary; UTC midnight is, even for loss or escape',()=>{
    const records=active();records.progress.dailyQuestState.claimed.checkin=true;
    records.progress.dailyQuestState.progress.killMonsters=2;
    for(const instant of ['2026-10-19T15:59:59.999Z','2026-10-19T16:00:00.000Z','2026-10-19T23:59:59.999Z']){
        const result=apply(records,{kind:'loss',member:undefined,serverNow:Date.parse(instant)});
        assert.equal(result.progress.dailyQuestState.progress.killMonsters,2);
        assert.equal(result.progress.dailyQuestState.claimed.checkin,true);assert.equal(result.transitionEvidence.changedPeriod.daily,false);
    }
    for(const kind of ['loss','escape']){
        const result=apply(records,{kind,member:undefined,serverNow:Date.parse('2026-10-20T00:00:00Z')});
        assert.equal(result.progress.dailyQuestState.date,'2026-10-20');
        assert.ok(Object.values(result.progress.dailyQuestState.progress).every(value=>value===0));
        assert.equal(result.transitionEvidence.before.dailyQuestState.claimed.checkin,true);
        assert.deepEqual(result.progress.playableState.bestiaryData,{});
    }
});

test('Forest duplicate positions aggregate one bestiary name; elite lifetime totals continue past quest goal clamps',()=>{
    const records=active(),name=catalog.zones.forest.mapEntries[0].name;
    for(const entryId of ['forest:0','forest:2','forest:4'])records.progress=apply(records,{member:{entryId,rank:'regular'}}).progress;
    assert.deepEqual(records.progress.playableState.bestiaryData[name],{seen:true,kills:3});
    for(let i=0;i<50;i++)records.progress=apply(records,{member:{entryId:'forest:0',rank:'elite'}}).progress;
    assert.equal(records.progress.playableState.bestiaryData[name].kills,53);
    assert.equal(JSON.parse(records.progress.sidecars.progress.raw).eliteKills,50);
    for(const [group,ids] of [['daily',['killMonsters','kill10']],['commission',['killMonsters','kill30','elite2']]]){
        const state=records.progress[group==='daily'?'dailyQuestState':'commissionQuestState'];
        for(const id of ids)assert.equal(state.progress[id],goals[group][id]);
    }
    assert.equal(records.progress.dailyQuestState.progress.winBattle,0);
});

test('only a complete win changes win counters; win settlement does not create kills, claims or skill progress',()=>{
    const records=active();
    for(let i=0;i<20;i++)records.progress=apply(records,{kind:'win',member:undefined}).progress;
    for(const [group,ids] of [['daily',['winBattle','win3']],['commission',['winBattle','win5']]]){
        const state=records.progress[group==='daily'?'dailyQuestState':'commissionQuestState'];
        for(const id of ids)assert.equal(state.progress[id],goals[group][id]);
        assert.ok(Object.values(state.claimed).every(value=>value===false));
    }
    assert.deepEqual(records.progress.playableState.bestiaryData,{});assert.deepEqual(records.claimRecords,[]);
    assert.equal(records.progress.dailyQuestState.progress.skills5,0);assert.equal(records.progress.commissionQuestState.progress.elite2,0);
});

test('historical, future, malformed or ambiguous progress and unsupported member inputs refuse without mutation',()=>{
    for(const mutate of [
        records=>{records.progress.dailyQuestState={};},
        records=>{records.progress.dailyQuestState.date='';records.progress.dailyQuestState.progress.checkin=1;},
        records=>{records.progress.dailyQuestState.date='2026-10-20';},
        records=>{records.progress.dailyQuestState.progress.unknown=0;records.progress.dailyQuestState.claimed.unknown=false;},
        records=>{delete records.progress.dailyQuestState.claimed.checkin;},
        records=>{records.progress.dailyQuestState.claimed.checkin='false';},
        records=>{records.progress.dailyQuestState.progress.checkin=-1;},
        records=>{records.progress.sidecars['quest-milestones'].raw='{"date":"2026-10-19","daily":{"20":false},"commission":{}}';},
        records=>{records.progress.sidecars.progress.raw='{}';},
        records=>{records.progress.playableState.bestiaryData.bad={seen:false,kills:1};},
    ]){
        const records=active();mutate(records);const before=clone(records);
        assert.throws(()=>apply(records,{initialLineageVerified:true}),error=>error.code==='data-loss');assert.deepEqual(records,before);
    }
    assert.throws(()=>apply(initial()),/lineage/);
    for(const options of [{member:{entryId:'forest:99',rank:'regular'}},{member:{...member,rank:'boss'}},
        {member:{...member,name:'forged'}},{member:{...member,level:99}},{member:{...member,kills:50}},
        {kind:'win'},{kind:'other'},{serverNow:NaN},{serverNow:'2026-10-19'},{count:99}]){
        const records=active(),before=clone(records);assert.throws(()=>apply(records,options),error=>error.code==='data-loss');assert.deepEqual(records,before);
    }
});
