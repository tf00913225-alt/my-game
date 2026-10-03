const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");

function installOwner(){
    const source=fs.readFileSync("js/battle-floating-feedback-owner.js","utf8");
    let nextTimer=0;
    const timers=new Map();
    const emitted=[];
    const document={
        body:{appendChild(node){node.parentNode=this;emitted.push(node);}},
        createElement(){return {dataset:{},style:{setProperty(){}},remove(){this.parentNode=null;}};},
        querySelectorAll(){return [];}
    };
    const window={
        FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(){return {unitRect:{},feedbackSafeRect:{left:0,top:0,width:120,height:100,bottom:100},feedbackAnchor:{x:60,y:90}};}},
        v143ResolveBattleFeedbackTiming(side,index,kind){
            return {impactId:"impact:"+side+":"+index,impactAt:0,delayMs:kind==="status"?0:20,critical:kind==="damage"};
        }
    };
    const context={window,document,Date,Promise,Math,Object,Number,String,Array,Map,Set,RegExp,console,
        setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay:Number(delay)||0});return id;},
        clearTimeout(id){timers.delete(id);},
        queueMicrotask(fn){Promise.resolve().then(fn);}
    };
    vm.runInNewContext(source,context,{filename:"battle-floating-feedback-owner.js"});
    return {
        feedback:window.FourSymbolsBattleFloatingFeedback,emitted,timers,
        flushNext(){const entry=[...timers.entries()].sort((a,b)=>a[1].delay-b[1].delay)[0];if(!entry){return false;}timers.delete(entry[0]);entry[1].fn();return true;}
    };
}

test("impact batches phase-order damage and status despite different legacy timing",()=>{
    const harness=installOwner();
    harness.feedback.emit({side:"monster",index:0,kind:"damage",text:"888"});
    harness.feedback.emit({side:"monster",index:0,kind:"status",text:"燃燒",statusType:"burn"});
    assert.equal(harness.timers.size,1);
    harness.flushNext();
    assert.deepEqual(harness.emitted.map(node=>node.dataset.feedbackKind),["damage","status"]);
    assert.equal(harness.emitted[0].textContent,"💥 888");
});

test("impact batches shield, critical damage, and status; pure status and targets remain independent",()=>{
    const harness=installOwner();
    harness.feedback.emit({side:"monster",index:0,kind:"status",text:"冰封",statusType:"freeze"});
    harness.feedback.emit({side:"monster",index:0,kind:"shield",text:"護盾"});
    harness.feedback.emit({side:"monster",index:0,kind:"damage",text:"456"});
    harness.feedback.emit({side:"monster",index:1,kind:"status",text:"石化",statusType:"petrify"});
    assert.equal(harness.timers.size,2);
    harness.flushNext();
    assert.deepEqual(harness.emitted.slice(0,3).map(node=>node.dataset.feedbackKind),["shield","damage","status"]);
    harness.flushNext();
    assert.equal(harness.emitted[3].dataset.feedbackKind,"status");
});

test("clear cancels every pending impact batch before it can create DOM",()=>{
    const harness=installOwner();
    harness.feedback.emit({side:"player",index:0,kind:"damage",text:"100"});
    harness.feedback.emit({side:"player",index:0,kind:"status",text:"凍傷",statusType:"freeze"});
    assert.equal(harness.feedback.getPendingImpactBatchCount(),1);
    harness.feedback.clear();
    assert.equal(harness.timers.size,0);
    assert.equal(harness.emitted.length,0);
});
