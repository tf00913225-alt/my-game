import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const policy=require('../functions/src/account-mode-time-policy.js');
const source=fs.readFileSync('functions/src/account-mode-time-policy.js','utf8');

// Frozen pre-extraction references from dev 4f97e25439372f1aec4fa892c706ea7f1bb54d93:
// js/32-v139-rested-experience.js::accrueRestedMilliseconds and
// js/25-v131-fix-batch.js::v131GrantElementBoxHours/tickElementBoxClock.
// Already-sanitized rested state and caller-owned clock/mode checks remain
// outside these formulas. These references never read the extracted Owner.
function oldAccrue(battles,progressMs,elapsedMs){
    const safeElapsed=Math.max(0,Math.floor(Number(elapsedMs)||0));
    if(safeElapsed<=0||battles>=300){
        if(battles>=300)progressMs=0;
        return {battles,progressMs,accepted:0};
    }
    const cappedElapsed=Math.min(safeElapsed,300*120000);
    const totalMs=progressMs+cappedElapsed;
    const earned=Math.floor(totalMs/120000);
    const accepted=Math.min(earned,300-battles);
    battles+=accepted;
    progressMs=battles>=300?0:totalMs-earned*120000;
    return {battles,progressMs,accepted};
}
function oldGrant(remainingMs,hours,maxHours){
    const safeHours=Math.max(0,Number(hours)||0);
    const capMs=Math.max(0,Number(maxHours)||32)*60*60*1000;
    return Math.min(capMs,Math.max(0,remainingMs)+safeHours*60*60*1000);
}
function oldDebit(remainingMs,elapsedMs,active){
    let used=0,exhausted=false;
    if(active&&remainingMs>0){
        const delta=Math.max(0,elapsedMs);
        used=Math.min(delta,remainingMs);
        remainingMs-=used;
        if(remainingMs<=0){remainingMs=0;exhausted=true;}
    }
    return {remainingMs,used,exhausted};
}

test('rested time agrees with frozen reference over thresholds, caps, remainders and elapsed coercion',()=>{
    const elapsed=[undefined,null,NaN,'NaN','120000','-1','bad',-Infinity,-120000,-.5,0,.99,
        1,1.99,119999,119999.99,120000,120001,239999,240000,36000000,Number.MAX_SAFE_INTEGER,Infinity];
    for(const battles of [0,1,17,298,299,300]){
        for(const remainder of [0,1,59999,119998,119999]){
            for(const time of elapsed){
                assert.deepEqual(policy.accrueRested(battles,remainder,time),oldAccrue(battles,remainder,time),
                    `battles=${battles}, remainder=${remainder}, elapsed=${String(time)}`);
            }
        }
    }
    assert.deepEqual(policy.accrueRested(0,0,119999),{battles:0,progressMs:119999,accepted:0});
    assert.deepEqual(policy.accrueRested(0,0,120000),{battles:1,progressMs:0,accepted:1});
    assert.deepEqual(policy.accrueRested(299,119999,1),{battles:300,progressMs:0,accepted:1});
    assert.deepEqual(policy.accrueRested(299,0,240001),{battles:300,progressMs:0,accepted:1});
    assert.deepEqual(policy.accrueRested(300,119999,0),{battles:300,progressMs:0,accepted:0});
    assert.deepEqual(policy.accrueRested(1,119999,120002),{battles:3,progressMs:1,accepted:2});
});

test('element-box grant preserves raw fractions, coercion and the existing maxHours zero default',()=>{
    for(const remaining of [-1,0,.25,.999,1,28800000,115199999.75,115200000,115200001,NaN,Infinity]){
        for(const hours of [undefined,null,NaN,'bad','0.5','-1',-8,-.5,0,.0000001,.25,8,32,Infinity]){
            for(const cap of [undefined,null,NaN,'bad','0','32',-1,0,.5,8,32,Infinity]){
                assert.equal(policy.grantElementBox(remaining,hours,cap),oldGrant(remaining,hours,cap));
            }
        }
    }
    assert.equal(policy.grantElementBox(115199999.5,8,0),115200000);
    assert.equal(policy.grantElementBox(0,8,0),28800000,'zero maxHours retains the original 32-hour default');
    assert.equal(policy.grantElementBox(0,8,-1),0,'negative maxHours has a zero cap');
    assert.equal(policy.grantElementBox(.25,.0000001,32),.6100000000000001,'grant retains the original floating result before persistence');
});

test('element-box debit preserves raw fractions, NaN and inactive state rather than sanitizing them',()=>{
    for(const remaining of [undefined,null,NaN,'1.5','bad',-3,0,.125,.75,1,28800000,Infinity]){
        for(const elapsed of [undefined,null,NaN,'NaN','0.25','-1',-Infinity,-1,0,.125,.5,1,28800000,Infinity]){
            for(const active of [false,true]){
                assert.deepEqual(policy.debitElementBox(remaining,elapsed,active),oldDebit(remaining,elapsed,active));
            }
        }
    }
    assert.deepEqual(policy.debitElementBox(.75,.125,true),{remainingMs:.625,used:.125,exhausted:false});
    assert.deepEqual(policy.debitElementBox(.75,1,true),{remainingMs:0,used:.75,exhausted:true});
    assert.deepEqual(policy.debitElementBox(.75,Infinity,false),{remainingMs:.75,used:0,exhausted:false});
    assert.deepEqual(policy.debitElementBox(0,1,true),{remainingMs:0,used:0,exhausted:false});
});

test('storage boundary alone floors remaining milliseconds and exported constants retain existing limits',()=>{
    for(const remaining of [undefined,null,NaN,'bad','1.9',-Infinity,-1,-.5,0,.99,1.99,115200000,Infinity]){
        assert.equal(policy.elementBoxStoredMs(remaining),Math.max(0,Math.floor(remaining)));
    }
    assert.equal(policy.elementBoxStoredMs(policy.grantElementBox(.25,.0000001,32)),0);
    assert.deepEqual(policy.constants,{restedMsPerBattle:120000,restedMaxBattles:300,
        elementBoxRewardMs:28800000,elementBoxMaxMs:115200000});
});

test('single-win rested consumption preserves the actual Client subtraction and zero-state result',()=>{
    function previous(battles){
        if(battles<=0)return {applied:false,remainingBattles:0};
        battles--;
        return {applied:true,remainingBattles:battles};
    }
    for(const battles of [0,1,2,299,300,-1,undefined,null,NaN,'1','2',false,true]){
        assert.deepEqual(policy.consumeRestedBattle(battles),previous(battles));
    }
    assert.deepEqual(policy.consumeRestedBattle(2),{applied:true,remainingBattles:1});
    assert.deepEqual(policy.consumeRestedBattle(1),{applied:true,remainingBattles:0});
    assert.deepEqual(policy.consumeRestedBattle(0),{applied:false,remainingBattles:0});
});

test('frozen browser and CommonJS exports evaluate and calculate without clock, RNG or persistent state',()=>{
    for(const commonjs of [false,true]){
        const math=Object.create(Math);
        Object.defineProperty(math,'random',{get(){throw Error('RNG forbidden in pure time policy');}});
        const context={Math:math,...(commonjs?{module:{exports:{}}}:{window:{}})};
        for(const forbidden of ['Date','localStorage','fetch']){
            Object.defineProperty(context,forbidden,{get(){throw Error(`${forbidden} forbidden in pure time policy`);}});
        }
        vm.createContext(context);vm.runInContext(source,context);
        const api=commonjs?context.module.exports:context.window.FourSymbolsAccountModeTimePolicy;
        assert.ok(Object.isFrozen(api));assert.ok(Object.isFrozen(api.constants));
        assert.deepEqual(Object.keys(api).sort(),['constants','accrueRested','grantElementBox','debitElementBox','elementBoxStoredMs','consumeRestedBattle'].sort());
        assert.equal(api.accrueRested(0,0,120000).accepted,1);
        assert.equal(api.grantElementBox(0,8,32),28800000);
        assert.equal(api.debitElementBox(100,.5,true).remainingMs,99.5);
        assert.equal(api.elementBoxStoredMs(99.5),99);
        assert.equal(api.consumeRestedBattle(2).remainingBattles,1);
        assert.throws(()=>{api.constants.restedMaxBattles=1;},TypeError);
    }
});
