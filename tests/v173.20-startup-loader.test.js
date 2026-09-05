"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {execFileSync}=require("node:child_process");

const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("css/51-v173.20-startup-loader.css","utf8");
const source=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function makeNode(id){
    const classes=new Set();
    const listeners={};
    return {
        id,hidden:false,dataset:{},attributes:{},textContent:"",listeners,
        style:{},
        classList:{
            add(...names){ names.forEach(name=>classes.add(name)); },
            remove(...names){ names.forEach(name=>classes.delete(name)); },
            contains(name){ return classes.has(name); }
        },
        addEventListener(type,handler){ listeners[type]=handler; },
        setAttribute(name,value){ this.attributes[name]=String(value); },
        removeAttribute(name){ delete this.attributes[name]; }
    };
}

function startupHarness(randomValue){
    const ids=[
        "startupLoader","startupLogoScene","startupCityScene","startupStatusTitle",
        "startupStatusDetail","startupPercent","startupProgress","startupProgressFill",
        "startupEnterPrompt"
    ];
    const nodes=Object.fromEntries(ids.map(id=>[id,makeNode(id)]));
    nodes.startupLogoScene.classList.add("is-active");
    nodes.startupEnterPrompt.hidden=true;

    let time=0;
    let timerId=0;
    const timers=[];
    const events=[];
    const schedule=(handler,delay)=>{
        const timer={at:time+Number(delay||0),handler,id:++timerId};
        timers.push(timer);
        return timer.id;
    };
    const runUntil=target=>{
        for(;;){
            timers.sort((a,b)=>a.at-b.at||a.id-b.id);
            const timer=timers[0];
            if(!timer || timer.at>target){ break; }
            timers.shift();
            time=timer.at;
            timer.handler();
        }
        time=target;
    };
    const math=Object.create(Math);
    math.random=()=>randomValue;
    const document={
        getElementById(id){ return nodes[id]||null; },
        dispatchEvent(event){ events.push(event.type); }
    };
    const window={
        document,
        performance:{now:()=>time},
        setTimeout:schedule
    };
    const context={
        window,document,Math:math,Date,
        CustomEvent:function(type){ this.type=type; }
    };
    vm.createContext(context);
    vm.runInContext(source,context);
    return {events,nodes,runUntil,get time(){ return time; }};
}

test("two supplied 9:16 JPEG images are preserved as correctly named startup assets",()=>{
    const files=[
        "assets/ui/startup-logo-v173.20.jpg",
        "assets/ui/startup-main-city-v173.20.jpg"
    ];
    for(const file of files){
        const details=execFileSync("identify",["-format","%m %w %h",file],{encoding:"utf8"});
        assert.equal(details,"JPEG 864 1536",file);
    }
});

test("the native startup layer is first, versioned, and starts before the game runtime",()=>{
    assert.ok(html.indexOf('id="startupLoader"')<html.indexOf('id="app"'));
    assert.ok(html.indexOf("js/52-v173.20-startup-loader.js?v=173.20")<html.indexOf("js/00-main.js?v=173.49"));
    assert.match(html,/css\/51-v173\.20-startup-loader\.css\?v=173\.20/);
    assert.match(html,/startup-logo-v173\.20\.jpg\?v=173\.20/);
    assert.match(html,/startup-main-city-v173\.20\.jpg\?v=173\.20/);
    assert.match(loader,/const V_ASSET_VERSION="173\.49"/);
});

test("Logo light choreography cycles fire, water, wind, and earth independently",()=>{
    for(const element of ["fire","water","wind","earth"]){
        assert.match(html,new RegExp('startup-element-light '+element));
        assert.match(css,new RegExp('\\.startup-element-light\\.'+element+'\\{'));
    }
    assert.match(css,/@keyframes startupElementCycle/);
    assert.match(css,/\.fire\{[\s\S]*?animation-delay:0s;/);
    assert.match(css,/\.water\{[\s\S]*?animation-delay:\.95s;/);
    assert.match(css,/\.wind\{[\s\S]*?animation-delay:1\.9s;/);
    assert.match(css,/\.earth\{[\s\S]*?animation-delay:2\.85s;/);
});

test("minimum random roll waits 12 seconds and never auto-enters",()=>{
    const harness=startupHarness(0);
    assert.equal(harness.nodes.startupLoader.dataset.totalDuration,"12000");
    harness.nodes.startupLoader.listeners.click({type:"click"});
    assert.equal(harness.nodes.startupLoader.hidden,false);
    harness.runUntil(11999);
    assert.equal(harness.nodes.startupLoader.classList.contains("is-ready"),false);
    harness.runUntil(12000);
    assert.equal(harness.nodes.startupPercent.textContent,"100%");
    assert.equal(harness.nodes.startupEnterPrompt.hidden,false);
    assert.equal(harness.nodes.startupLoader.hidden,false);
});

test("maximum random roll waits 15 seconds, then only a click dismisses the loader",()=>{
    const harness=startupHarness(.999999);
    assert.equal(harness.nodes.startupLoader.dataset.totalDuration,"15000");
    harness.runUntil(14999);
    assert.equal(harness.nodes.startupLoader.classList.contains("is-ready"),false);
    harness.runUntil(15000);
    assert.equal(harness.nodes.startupLoader.classList.contains("is-ready"),true);
    assert.equal(harness.nodes.startupLoader.hidden,false);
    harness.nodes.startupLoader.listeners.click({type:"click"});
    assert.equal(harness.nodes.startupLoader.classList.contains("is-leaving"),true);
    harness.runUntil(15760);
    assert.equal(harness.nodes.startupLoader.hidden,true);
    assert.deepEqual(harness.events,["v173.20:startup-entered"]);
});

test("the ready prompt remains visibly blinking on the main-city scene",()=>{
    assert.match(html,/〔點擊空白處 進入遊戲〕/);
    assert.match(css,/\.startup-enter-prompt\{[\s\S]*?animation:startupEnterBlink 1\.15s ease-in-out infinite;/);
    assert.match(css,/@keyframes startupEnterBlink/);
    assert.match(source,/showMainCityScene\(\);[\s\S]*?renderProgress\(100\);[\s\S]*?prompt\.hidden=false;/);
});

console.log("\n"+passed+" V173.20 startup loader tests passed.");
