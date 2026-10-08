"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const core=fs.readFileSync("js/00-main.js","utf8");
const functionSource=name=>core.slice(core.indexOf("function "+name+"("),core.indexOf("\nfunction ",core.indexOf("function "+name+"(")+1));
const constants=core.match(/const MANUAL_RESOLUTION_START_MS=250;[\s\S]*?const POST_ACTION_DELAY_MS=650;/)[0];
let remaining=520;
const context={window:{v142GetRemainingAnimationMs:()=>remaining}};
vm.createContext(context);vm.runInContext(constants+functionSource("getBattleAdvanceDelay"),context);
assert.equal(context.getBattleAdvanceDelay("declare",false),250);
assert.equal(context.getBattleAdvanceDelay("declare",true),100);
assert.equal(context.getBattleAdvanceDelay("resolve"),1170);
remaining=2800;assert.equal(context.getBattleAdvanceDelay("resolve"),3450);
remaining=0;assert.equal(context.getBattleAdvanceDelay("resolve"),650);
assert.doesNotMatch(core,/battleRoundPromptRelease|acquirePresentationLock\("auto-round-prompt"\)/);
assert.match(core,/\},AUTO_DECISION_DELAY_MS\)/);
let expiry,delay,locks=0;
const prompt={hidden:true,textContent:""};
const notice={clearBattleRoundPrompt(){prompt.hidden=true;},battleActive:true,battleToken:42,autoBattle:true,turn:2,
 document:{getElementById:id=>id==="battlePage"?{}:prompt},window:{FourSymbolsBattleFlow:{acquirePresentationLock(){locks++;}}},
 setTimeout(fn,ms){expiry=fn;delay=ms;return 1;}};
vm.createContext(notice);vm.runInContext("let battleRoundPromptTimeoutId;"+functionSource("showAutoBattleRoundPrompt"),notice);
assert.equal(notice.showAutoBattleRoundPrompt(42),true);assert.equal(delay,500);assert.equal(locks,0);
assert.equal(prompt.hidden,false);assert.equal(prompt.textContent,"第 2 回合");expiry();assert.equal(prompt.hidden,true);
assert.equal(notice.showAutoBattleRoundPrompt(41),false);
console.log("Battle feel: manual/auto handoff, unchanged visual gate and nonblocking tracked prompt PASS");
