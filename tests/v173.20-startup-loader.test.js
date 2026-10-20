"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");

const html=fs.readFileSync("index.html","utf8");
const source=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const contract=fs.readFileSync("js/startup/startup-contract.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));

for(const file of ["assets/ui/startup-logo.4631c0bc3f2b.jpg","assets/ui/startup-main-city.d43e67af1c1c.jpg"]){
    const details=execFileSync("identify",["-format","%m %w %h",file],{encoding:"utf8"});
    assert.equal(details,"JPEG 864 1536",file);
}
assert.ok(html.indexOf('id="startupLoader"')<html.indexOf('id="game-viewport"'),"boot shell must escape the transformed stage");
assert.equal((html.match(/<script\b[^>]*\bsrc=/g)||[]).length,1);
assert.match(html,/build\/boot-core\.[0-9a-f]{12}\.js/);
assert.match(html,/build\/boot-core\.[0-9a-f]{12}\.css/);
assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
assert.doesNotMatch(loader,/TOTAL_RUNTIME_MODULES|__v173ReportRuntimeProgress|createElement\(["']script["']\)/);
assert.match(source,/Sole StartupStateMachine owner/);
for(const state of ["BOOT_LOADING","AUTH_RESOLVING","AUTH_REQUIRED","SAVE_LOADING","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"]){
    assert.match(contract,new RegExp(`${state}:["']${state}["']`));
}
assert.match(contract,/AUTH_REQUIRED:Object\.freeze\(\["SAVE_LOADING","ERROR"\]\)/);
assert.match(contract,/SAVE_LOADING:Object\.freeze\(\["AUTH_REQUIRED","MIGRATION_REQUIRED","NEED_CHARACTER","READY","OFFLINE_READY","ERROR"\]\)/);
assert.match(source,/safeCloudEmpty/);
assert.match(source,/canShowCharacterCreation:\(\)=>contract\.canCreateCharacter/);
assert.match(source,/global\.getComputedStyle\(root\)\.transitionDuration/);
assert.doesNotMatch(source,/12000|15000|MIN_DURATION|totalDuration|runtimeReady/);
assert.equal(manifest.featureManifest.features.patrol,"feature-patrol");
assert.match(html,/startupCityScene/);
assert.match(html,/startup-main-city\.d43e67af1c1c\.jpg/);
assert.match(source,/showCity/);
assert.match(html,/data-logo-target-ms="900"/);
assert.doesNotMatch(source,/cityTargetMs|await presentation|await delay\(logoTargetMs\)/);
assert.match(source,/function runOpeningPresentation[\s\S]*?global\.setTimeout/);
assert.match(source,/CREATION_PORTRAITS/);
assert.match(source,/await prepareCreationRender\(\)/);
console.log("✓ account-first startup state machine with real readiness");

// A read failure must expose the account retry surface rather than leave it
// behind the full-viewport loader. This presentation handoff cannot resolve save
// authority or turn ERROR into a creation/gameplay destination.
{
    const vm=require('node:vm'),classes=new Set(),calls=[],timers=[];
    const root={hidden:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(){}};
    const context={root,transitionToken:7,state:'SAVE_LOADING',saveResolved:true,lastError:null,
        activeUser:{uid:'failed-read'},STATES:{ERROR:'ERROR',SAVE_LOADING:'SAVE_LOADING'},
        global:{getComputedStyle:()=>({transitionDuration:'0.36s'}),setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}},
        showCity(){},status(){},emit(){},Promise,parseFloat,String,
        firebase:{setUiState(s){calls.push(['state',s.mode,s.error]);},openAuth(){calls.push(['account']);},closeAuth(){calls.push(['close']);}}
    };
    context.transition=next=>{context.state=next;};
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('    let exit=null;'),source.indexOf('    function safeCloudEmpty('))+
        source.slice(source.indexOf('    function fail('),source.indexOf('    function reloadForAccountTransition('))+'this.failRead=fail;',context);
    const error=new Error('read failed');context.failRead(error,'Cannot read safely.',7);
    assert.deepEqual(calls,[['state','ERROR',true],['account']]);
    assert.equal(context.state,'ERROR');assert.equal(context.saveResolved,false);assert.equal(context.lastError,error);
    assert.ok(classes.has('is-leaving'),'account retry must not remain behind the loader');
    timers.at(-1)();assert.equal(root.hidden,true);
    const count=calls.length;context.failRead(new Error('stale'),'stale',6);assert.equal(calls.length,count);
    context.firebase=null;context.failRead(error,'Auth unavailable.',7);
    assert.equal(root.hidden,false,'without an account UI the original error loader remains');
    assert.equal(classes.has('is-leaving'),false);assert.equal(context.state,'ERROR');assert.equal(context.saveResolved,false);
    console.log('✓ read-error account retry handoff remains fail-closed');
}

// Presentation cannot hold real readiness or overwrite a later destination.
{
    const vm=require('node:vm'),timers=new Map(),calls=[];let id=0;
    const context={root:{dataset:{}},logoTargetMs:900,openingDone:false,state:'BOOT_LOADING',
        STATES:{BOOT_LOADING:'BOOT_LOADING'},progress:{getAttribute:()=>30},
        showCity:reason=>calls.push(reason),status:()=>calls.push('status'),
        global:{setTimeout(fn,ms){assert.equal(ms,900);timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);}}};
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('    let openingTimer=null;'),source.indexOf('    function renderFirstPlayProgress('))+'this.present=runOpeningPresentation;',context);
    assert.equal(context.present(true,false),undefined,'presentation must return without a pending promise');
    assert.deepEqual(calls,[]);
    context.state='AUTH_REQUIRED';timers.get(1)();
    assert.deepEqual(calls,[],'late presentation timer cannot change the account destination');
    context.state='BOOT_LOADING';context.present(false,false);timers.get(2)();
    assert.deepEqual(calls,['first-boot-logo-complete','status'],'real resource loading retains scene two');
    context.present(true,false);context.present(true,true);
    assert.equal(timers.has(3),false,'retry cancels the old presentation timer');
    assert.equal(calls.at(-1),'resource-retry');
    context.showLoader=()=>{};context.retryButton=null;context.emit=()=>{};
    vm.runInContext(source.slice(source.indexOf('    function showResourceFailure('),source.indexOf('    async function startFirebaseLifecycle('))+'this.resourceFail=showResourceFailure;',context);
    context.present(false,false);context.resourceFail(new Error('resource failure'));
    assert.equal(timers.has(4),false,'a failed resource cancels presentation before it can overwrite the error');
    console.log('✓ opening presentation is non-blocking and destination-safe');
}

// Exercise the real presentation lifecycle, including a callback already queued
// when a new destination requests the shell again.
(async()=>{
    const vm=require("node:vm");
    const classes=new Set(),timers=new Map();let nextTimer=0;
    const root={hidden:false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},setAttribute(){}};
    const global={
        getComputedStyle:()=>({transitionDuration:"0.36s, 0s"}),
        setTimeout(fn,ms){assert.equal(ms,360);timers.set(++nextTimer,fn);return nextTimer;},
        clearTimeout(){}
    };
    const lifecycle=source.slice(source.indexOf("    let exit=null;"),source.indexOf("    function accountUi("));
    const context={root,global,Promise,parseFloat,showCity(){}};
    vm.runInNewContext(lifecycle+"this.show=showLoader;this.hide=hideLoader;",context);
    const first=context.hide();assert.equal(context.hide(),first,"one active exit per shell");
    const stale=timers.get(1);
    context.show();await first;stale();
    assert.equal(root.hidden,false,"cancelled exit cannot hide the next loading destination");
    assert.equal(classes.has("is-leaving"),false);
    const second=context.hide();timers.get(2)();await second;
    assert.equal(root.hidden,true);
    context.show();assert.equal(root.hidden,false,"retry restores the same shell");
    console.log("✓ startup exit cancellation, idempotence and retry");
})().catch(error=>{console.error(error);process.exitCode=1;});
