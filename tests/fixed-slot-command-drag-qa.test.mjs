import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../.github/scripts/run-fixed-slot-battlefield-browser-qa.mjs',import.meta.url),'utf8');
const context={assert};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function assertFloatingCommandReachability('),source.indexOf('function exerciseFloatingCommandReachability(')),context);
const check=context.assertFloatingCommandReachability;
const evidence=()=>({before:Array.from({length:5},()=>({hit:true})),after:Array.from({length:5},()=>({hit:true})),moreHit:true,moreRect:{width:48,height:48},utility:Array.from({length:3},()=>({hit:true,rect:{width:48,height:48}})),folded:true});
test('single-row controls require every complete center with utilities folded and expanded',()=>{assert.doesNotThrow(()=>check(evidence()));const e=evidence();e.before[4]={hit:false,blockedByElementBox:true};assert.throws(()=>check(e),/without dragging/);});
test('expanded utilities and more entry must be reachable',()=>{const e=evidence();e.moreHit=false;assert.throws(()=>check(e));e.moreHit=true;e.utility[1].hit=false;assert.throws(()=>check(e));});
test('undersized utility and failed collapse cannot pass',()=>{const e=evidence();e.utility[0].rect.width=43;assert.throws(()=>check(e));e.utility[0].rect.width=48;e.folded=false;assert.throws(()=>check(e));});

test("more cannot pass on a sub44px target",()=>{const e=evidence();e.moreRect.width=43;assert.throws(()=>check(e),/more physical touch/);});
const liveSource=fs.readFileSync(new URL('../.github/scripts/battle-layer-audio-live-qa.mjs',import.meta.url),'utf8');
const utilityAssertions=liveSource.slice(liveSource.indexOf('    assert.deepEqual(layout.utilities.map('),liveSource.indexOf('    assert.ok(layout.enemySlots.minHeight>92'));
function checkLiveUtilities(utilities){vm.runInNewContext('const layout='+JSON.stringify({utilities})+';'+utilityAssertions,{assert});}
const liveUtilities=()=>['battleAutoToggle','battleElementBoxButton','battleSpeedControl'].map(id=>({id,width:52,height:52,rect:{width:48,height:48},hit:true}));
test('live utility contract rejects folded zero sizes, missing controls and blocked centers',()=>{
 assert.doesNotThrow(()=>checkLiveUtilities(liveUtilities()));
 const folded=liveUtilities();folded[1].width=0;assert.throws(()=>checkLiveUtilities(folded),/logical width/);
 assert.throws(()=>checkLiveUtilities(liveUtilities().slice(0,2)),/must all exist/);
 const blocked=liveUtilities();blocked[0].hit=false;assert.throws(()=>checkLiveUtilities(blocked),/reachable/);
 const tiny=liveUtilities();tiny[2].rect.width=43;assert.throws(()=>checkLiveUtilities(tiny),/physical touch/);
});