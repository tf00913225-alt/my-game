'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/35-v141-ui-battle.js','utf8');
const block=source.slice(source.indexOf('    if(typeof startTurn==="function"){'),source.indexOf('    function collectRewardSummary()'));
function fixture(){
 const timers=[],events=[],locks=new Set();const classes={add(){},remove(){}};const page={classList:classes};
 const c={battleActive:true,battleToken:1,window:null,document:{getElementById:()=>page},setTimeout:(fn,ms)=>{timers.push({fn,ms});},startTurn(token){events.push(['initialize',token,locks.size]);},ensureBattleTransitionOverlay:()=>({classList:classes}),FourSymbolsBattleFlow:{acquirePresentationLock(owner){const lock={owner};locks.add(lock);events.push(['acquire',owner]);return ()=>{locks.delete(lock);events.push(['release',locks.size]);};}}};c.window=c;vm.createContext(c);vm.runInContext('const startedEntryTokens=new Set();let transitionRunning=false;'+block,c);return {c,timers,events,locks};
}
test('entry keeps input locked through first round initialization, then releases',()=>{const f=fixture();f.c.startTurn(1);assert.equal(f.locks.size,1);assert.deepEqual(f.events,[['acquire','battle-entry']]);f.timers.shift().fn();assert.equal(f.locks.size,1);f.timers.shift().fn();assert.deepEqual(f.events,[['acquire','battle-entry'],['initialize',1,1],['release',0]]);});
test('obsolete entry does not initialize or release a newer battle lock',()=>{const f=fixture();f.c.startTurn(1);f.locks.clear();f.c.battleToken=2;f.c.startTurn(2);assert.equal(f.locks.size,1);f.timers.shift().fn();const oldEnd=f.timers.pop();oldEnd.fn();assert.equal(f.locks.size,1);assert.equal(f.events.filter(x=>x[0]==='initialize').length,0);});
