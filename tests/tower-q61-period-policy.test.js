"use strict";

const assert=require("node:assert/strict");
const {test}=require("node:test");
const {execFileSync}=require("node:child_process");
const vm=require("node:vm");
const {towerPeriodInfo:period,classifyTowerCalendarTransition:classify}=
    require("../js/gameplay-boss-tower-system.js");
const source=(version,key,element)=>({version,tower:{weekKey:key,element,
    completedFloor:50,claimedFloors:{50:true},historicalHighest:80,
    pendingRelicChoice:true},pending:{outcome:"unknown"}});

test("Taipei Monday midnight changes week eight hours before legacy UTC",()=>{
    const before=period("2026-11-01T15:59:59.999Z","taipei-v2");
    const after=period("2026-11-01T16:00:00.000Z","taipei-v2");
    assert.equal(before.key,"2026-10-26");
    assert.equal(after.key,"2026-11-02");
    assert.equal(after.startMs,Date.parse("2026-11-01T16:00:00Z"));
    assert.equal(after.endMs,Date.parse("2026-11-08T16:00:00Z"));
    assert.equal(period("2026-11-01T23:59:59.999Z","utc-v1").key,"2026-10-26");
    assert.equal(period("2026-11-02T00:00:00Z","utc-v1").key,after.key);
    assert.equal(period("2026-11-02T00:00:00Z","taipei-v2").periodId,after.periodId);
});

test("four elements, leap year, year boundary and pre-anchor modulo",()=>{
    assert.deepEqual([0,1,2,3].map(n=>period(Date.UTC(1970,0,5+7*n)-28800000,"taipei-v2").element),
        ["fire","earth","water","wind"]);
    assert.equal(period("1969-12-28T16:00:00Z","taipei-v2").element,"wind");
    assert.equal(period("2024-02-29T12:00:00Z","taipei-v2").key,"2024-02-26");
    assert.equal(period("2026-12-31T12:00:00Z","taipei-v2").key,"2026-12-28");
});

test("calendar does not depend on host timezone",()=>{
    const code="console.log(JSON.stringify(require('./js/gameplay-boss-tower-system.js').towerPeriodInfo('2026-11-01T16:00:00Z','taipei-v2')))";
    const outputs=["UTC","America/Los_Angeles","Asia/Taipei"].map(TZ=>
        execFileSync(process.execPath,["-e",code],{cwd:process.cwd(),env:{...process.env,TZ},encoding:"utf8"}));
    assert.equal(outputs[0],outputs[1]);
    assert.equal(outputs[1],outputs[2]);
});

test("only unambiguous real instants are accepted",()=>{
    const expected=period("2026-11-01T16:00:00Z","taipei-v2");
    for(const input of ["2026-11-02T00:00:00+08:00",Date.parse("2026-11-01T16:00:00Z"),
        new Date("2026-11-01T16:00:00Z"),
        vm.runInNewContext("new Date('2026-11-01T16:00:00Z')")]){
        assert.deepEqual(period(input,"taipei-v2"),expected);
    }
    for(const input of [true,false,[],[2026],{},NaN,Infinity,new Date(NaN),
        "2026-11-02T00:30:00","2026-11-02","2026-02-30T00:00:00Z",
        "2026-11-02T24:00:00Z","2026-11-02T00:00:00+24:00"]){
        assert.throws(()=>period(input,"taipei-v2"),RangeError);
    }
});

test("legacy calendar retains original formula across representative dates",()=>{
    for(let ms=Date.UTC(1969,11,1);ms<Date.UTC(2028,1,1);ms+=37*86400000+12345){
        const d=new Date(ms),monday=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-
            ((d.getUTCDay()+6)%7)*86400000;
        const index=Math.floor((monday-Date.UTC(1970,0,5))/(7*86400000));
        const actual=period(ms,"utc-v1");
        assert.equal(actual.key,new Date(monday).toISOString().slice(0,10));
        assert.equal(actual.index,index);
        assert.equal(actual.element,["fire","earth","water","wind"][((index%4)+4)%4]);
    }
});

test("new week classification resets without erasing old pending or granting rewards",()=>{
    const old=source(1,"2026-10-26",period("2026-10-26T00:00:00Z","utc-v1").element);
    const snapshot=JSON.stringify(old),result=classify(old,"2026-11-01T16:00:00Z");
    assert.equal(result.action,"reset");
    assert.notEqual(result.prior.periodId,result.target.periodId);
    assert.equal(result.migrationEvent,"tower-taipei-week-v2");
    assert.equal(result.requiresSettlement,true);
    assert.equal(JSON.stringify(old),snapshot);
    assert.equal("rewards" in result,false);
    assert.deepEqual(classify(old,"2026-11-01T16:00:00Z"),result);
});

test("same logical week and migrated accounts do not get an update-only reset",()=>{
    const week=period("2026-11-02T12:00:00Z","taipei-v2");
    for(const version of [1,2]){
        const result=classify(source(version,week.key,week.element),"2026-11-02T12:00:00Z");
        assert.equal(result.action,"retain");
        assert.equal(result.migrationEvent,version===1?"tower-taipei-week-v2":null);
    }
    assert.equal(classify(source(2,week.key,week.element),"2026-11-08T16:00:00Z").action,"reset");
});

test("missing, malformed calendar, future and conflicting period metadata block",()=>{
    const now="2026-11-02T12:00:00Z";
    for(const input of [null,{},source(3,"2026-11-02","fire"),
        source(1,"2026-02-30","fire"),source(1,"0001-01-01","fire"),source(1,"2026-11-03","fire"),
        source(1,"2026-11-09",period("2026-11-09T00:00:00Z","utc-v1").element),
        source(1,"2026-11-02","invalid")]){
        assert.equal(classify(input,now).action,"blocked");
    }
    assert.throws(()=>period(now,"unrecognized"),RangeError);
    assert.throws(()=>period(null,"taipei-v2"),RangeError);
    assert.throws(()=>period("invalid","taipei-v2"),RangeError);
});
