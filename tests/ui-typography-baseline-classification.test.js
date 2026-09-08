"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const path=require("node:path");

const BASE="39767ce2b9dbfa59650b7c5fd4d52a57a2642ea5";
const EXTENSIONS=new Set([".css",".html",".js",".mjs"]);

function run(args){ return cp.execFileSync("git",args,{encoding:"utf8",maxBuffer:32*1024*1024}); }
function sourceAt(file){ return run(["show",`${BASE}:${file}`]); }
function selectorContext(lines,index){
    for(let i=index;i>=Math.max(0,index-20);i--){
        const text=lines[i].trim();
        if(!text||text.startsWith("/*")||text.startsWith("*")||text.startsWith("//")) continue;
        if(text.includes("{")||text.includes("style=")||text.includes("cssText")||text.includes("fontSize")){
            return text.replace(/\s+/g," ").slice(0,320);
        }
    }
    return lines[index].trim().replace(/\s+/g," ").slice(0,320);
}

const paths=run(["ls-tree","-r","--name-only",BASE]).split(/\r?\n/).filter(Boolean)
    .filter(file=>EXTENSIONS.has(path.extname(file)));
const records=[];
for(const file of paths){
    const lines=sourceAt(file).split(/\r?\n/);
    lines.forEach((line,index)=>{
        const regex=/font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/gi;
        let match;
        while((match=regex.exec(line))){
            const value=Number(match[1]);
            if(value<13){ records.push({file,line:index+1,value,context:selectorContext(lines,index),source:line.trim()}); }
        }
    });
}

const battleRe=/(?:#battlePage|\.battle-|battleMonsterArea|battleTurnIndicator|battle-target|battle-item|skill-quick-button|\.sq-|#mainBattleMenu|v141-effect|v143-skill|v149-barrier|v149-reflect|v146-status-popup|boss-mechanism|team-relic-battle|abyss-battle|v135-sq-scope|monster-status-badges|monster-bar-text|auto-battle-button)/i;
const exceptionRe=/(?:home-test-button|v17351-ad-|debug|dev-only|aria-hidden|REWARD PREVIEW|display\s*:\s*none|visibility\s*:\s*hidden|screen-reader|sr-only|assistive|::before|::after)/i;

const buckets={general_ui:[],battle_ui:[],decorative_exception:[],test_non_runtime:[]};
for(const record of records){
    if(record.file.startsWith("tests/")||record.file.startsWith(".github/")){
        buckets.test_non_runtime.push(record);
    }else if(battleRe.test(record.context)){
        buckets.battle_ui.push(record);
    }else if(exceptionRe.test(record.context)){
        buckets.decorative_exception.push(record);
    }else{
        buckets.general_ui.push(record);
    }
}

assert.equal(records.length,345,"baseline <13px declaration count changed; audit base must stay reproducible");
assert.equal(Object.values(buckets).reduce((sum,list)=>sum+list.length,0),records.length);
const counts=Object.fromEntries(Object.entries(buckets).map(([key,list])=>[key,list.length]));
console.log("BASELINE_UI_TYPOGRAPHY_CLASSIFICATION="+JSON.stringify(counts));
for(const [key,list] of Object.entries(buckets)){
    console.log(`--- ${key} (${list.length}) ---`);
    list.slice(0,16).forEach(item=>console.log(`${item.value}px ${item.file}:${item.line} ${item.context} :: ${item.source}`));
}
assert.fail("CLASSIFICATION_CAPTURE="+JSON.stringify(counts));
