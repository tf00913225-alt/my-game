import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../.github/scripts/battle-layer-audio-live-qa.mjs",import.meta.url),"utf8");
const start=source.indexOf("async function waitFor(client,");
const end=source.indexOf("async function prepareAccountFirstRuntime(",start);
assert.ok(start>=0&&end>start,"Test must execute the production QA wait Owner");
const owner=source.slice(start,end);

function harness({readyAt=500,replyDelay=0,predicateError=false,disconnected=false,hung=false,predicateCost=0}={}){
    let browserNow=0,hostNow=0;
    const timers=[];
    const window={};
    Object.defineProperty(window,"ready",{get(){
        if(predicateError){throw new Error("real predicate failure");}
        browserNow+=predicateCost;
        return browserNow>=readyAt;
    }});
    const browser={window,performance:{now:()=>browserNow},setTimeout(callback,ms){browserNow+=ms;callback();}};
    const client={events:[{text:"actual runtime event"}],async eval(expression){
        if(disconnected){throw new Error("CDP disconnected");}
        if(hung){return new Promise(()=>{});}
        const before=browserNow;
        const result=await vm.runInNewContext(expression,browser);
        hostNow+=browserNow-before+replyDelay;
        browserNow+=replyDelay;
        return result;
    }};
    const wait=vm.runInNewContext(owner+";waitFor",{
        performance:{now:()=>hostNow},Date:{now:()=>hostNow},
        sleep:async ms=>{hostNow+=ms;browserNow+=ms;},
        setTimeout(callback,ms){const timer={callback,ms,active:true};timers.push(timer);return timer;},
        clearTimeout(timer){if(timer){timer.active=false;}}
    });
    return {client,timers,run:(timeout=7000,label="test condition")=>wait(client,"window.ready",label,timeout)};
}

test("condition completes within the original browser budget",async()=>{
    const h=harness();
    await h.run();
    assert.equal(h.client.waitTimings[0].timeoutMs,7000);
    assert.equal(h.client.waitTimings[0].browserElapsedMs,540);
    assert.equal(h.timers.every(t=>!t.active),true,"Transport watchdog must be released");
});

test("delayed CDP response does not replace timely browser evidence with a stale false",async()=>{
    const h=harness({replyDelay:9000});
    await h.run();
    const timing=h.client.waitTimings[0];
    assert.equal(timing.ready,true);
    assert.equal(timing.browserElapsedMs,540);
    assert.ok(timing.hostElapsedMs>7000,"Regression must actually exceed the old host budget");
});

test("never-ready and late conditions still fail all existing phase budgets",async()=>{
    for(const budget of [7000,8000,9000,12000]){
        for(const readyAt of [Infinity,budget+1000]){
            const h=harness({readyAt});
            await assert.rejects(h.run(budget),/Timed out waiting/);
            assert.equal(h.client.waitTimings[0].timeoutMs,budget);
            assert.equal(h.client.waitTimings[0].ready,false);
            assert.equal(h.timers.every(t=>!t.active),true);
        }
    }
});

test("predicate errors remain failures with the original message",async()=>{
    const h=harness({predicateError:true});
    await assert.rejects(h.run(),/real predicate failure/);
    assert.equal(h.client.waitTimings[0].ready,false);
});

test("disconnected CDP fails closed and releases its watchdog",async()=>{
    const h=harness({disconnected:true});
    await assert.rejects(h.run(),/CDP disconnected/);
    assert.equal(h.timers.every(t=>!t.active),true);
});

test("hung CDP has a separate bounded transport watchdog",async()=>{
    const h=harness({hung:true});
    const request=h.run();
    assert.equal(h.timers.length,1);
    assert.equal(h.timers[0].ms,17000);
    h.timers[0].callback();
    await assert.rejects(request,/CDP transport stalled/);
    assert.equal(h.timers[0].active,false);
});

test("wait evidence remains bounded across repeated scenes",async()=>{
    const h=harness({readyAt:0});
    for(let i=0;i<45;i++){await h.run();}
    assert.equal(h.client.waitTimings.length,40);
    assert.equal(h.client.waitTimings.every(t=>t.ready&&t.browserElapsedMs===0),true);
});

test("startup failure retains runtime evidence",async()=>{
    const h=harness({readyAt:Infinity});
    await assert.rejects(h.run(7000,"App Shell character/save owners"),/Recent runtime events:.*actual runtime event/);
});

test("a predicate that blocks beyond the original deadline cannot return a late success",async()=>{
    const h=harness({readyAt:0,predicateCost:7100});
    await assert.rejects(h.run(7000),/Timed out waiting/);
    assert.equal(h.client.waitTimings[0].ready,false);
    assert.ok(h.client.waitTimings[0].browserElapsedMs>7000);
});
