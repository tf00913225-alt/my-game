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
