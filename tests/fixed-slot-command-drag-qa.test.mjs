import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../.github/scripts/run-fixed-slot-battlefield-browser-qa.mjs',import.meta.url),'utf8');
const context={assert};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function assertFloatingCommandReachability('),source.indexOf('function exerciseFloatingCommandReachability(')),context);
const check=context.assertFloatingCommandReachability;
const evidence=()=>({before:Array.from({length:5},()=>({hit:true,blockedByElementBox:false})),after:Array.from({length:5},()=>({hit:true})),dragReady:true,moved:true});

test('approved default floating overlap still requires all five original command centers after the production drag',()=>{
    const e=evidence();e.before[4]={hit:false,blockedByElementBox:true};
    assert.doesNotThrow(()=>check(e));
    e.moved=false;assert.throws(()=>check(e),/actually move/);
    e.moved=true;e.dragReady=false;assert.throws(()=>check(e),/drag Owner/);
});
test('an unrelated overlay cannot acquire the floating Element Box exception',()=>{
    const e=evidence();e.before[4]={hit:false,blockedByElementBox:false,interceptor:{id:'unrelated-overlay'}};
    assert.throws(()=>check(e),/only the approved floating Element Box/);
});
test('a fully covering or unsuccessfully dragged Element Box cannot pass with edge or single-pixel reachability',()=>{
    const e=evidence();e.before[4]={hit:false,blockedByElementBox:true};e.after[4]={hit:false,blockedByElementBox:true};
    assert.throws(()=>check(e),/every complete command center/);
    e.after.pop();assert.throws(()=>check(e));
});
