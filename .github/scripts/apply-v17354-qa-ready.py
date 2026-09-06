from pathlib import Path

# V173.54 — make the late QA modules own their readiness lifecycle.
# Do not fail after an arbitrary 5s polling window: on slow Android Chrome that
# can falsely lock the startup screen even though the scripts are still loading.

p=Path('js/53-v173.50-inventory-qol.js')
s=p.read_text(encoding='utf-8')
old='''        let index=0;
        const next=function(){
            if(index>=queue.length){ return; }
            const pair=queue[index++];
            if(document.getElementById(pair[0])){ next(); return; }
            const script=document.createElement("script");
            script.id=pair[0];
            script.src=pair[1];
            script.async=false;
            script.onload=function(){
                if(typeof window.__v173ReportRuntimeProgress==="function"){
                    window.__v173ReportRuntimeProgress(pair[0],pair[1]);
                }
                next();
            };
            script.onerror=function(){
                if(typeof window.__v17347RuntimeGateFail==="function"){
                    window.__v17347RuntimeGateFail("V173.51 功能載入失敗，請重新整理。");
                }
            };
            document.head.appendChild(script);
        };
        next();
'''
new='''        let index=0;
        let readySent=false;
        const finish=function(){
            if(readySent){ return; }
            readySent=true;
            window.__v17351QaReady=true;
            try{ document.dispatchEvent(new CustomEvent("v17351:qa-ready",{detail:{loaded:queue.length,total:queue.length}})); }catch(_){ }
        };
        const failed=function(pair){
            if(typeof window.__v17347RuntimeGateFail==="function"){
                window.__v17347RuntimeGateFail("功能模組載入失敗："+String(pair&&pair[0]||"未知模組")+"。請重新整理。");
            }
        };
        const reportAndNext=function(pair,script){
            if(script){ script.dataset.loaded="1"; }
            if(typeof window.__v173ReportRuntimeProgress==="function"){
                window.__v173ReportRuntimeProgress(pair[0],pair[1]);
            }
            next();
        };
        const next=function(){
            if(index>=queue.length){ finish(); return; }
            const pair=queue[index++];
            const existing=document.getElementById(pair[0]);
            if(existing){
                if(existing.dataset.loaded==="1"){
                    if(typeof window.__v173ReportRuntimeProgress==="function"){
                        window.__v173ReportRuntimeProgress(pair[0],pair[1]);
                    }
                    next();
                    return;
                }
                existing.addEventListener("load",()=>reportAndNext(pair,existing),{once:true});
                existing.addEventListener("error",()=>failed(pair),{once:true});
                return;
            }
            const script=document.createElement("script");
            script.id=pair[0];
            script.src=pair[1];
            script.async=false;
            script.addEventListener("load",()=>reportAndNext(pair,script),{once:true});
            script.addEventListener("error",()=>failed(pair),{once:true});
            document.head.appendChild(script);
        };
        next();
'''
if old not in s: raise SystemExit('QA queue anchor not found')
s=s.replace(old,new,1)
s=s.replace('css/53-v173.51-qa.css?v=173.53','css/53-v173.51-qa.css?v=173.54')
for name in ['54-v173.51-battle-qa.js','55-v173.51-inventory-qa.js','56-v173.51-shop-qa.js','57-v173.51-quest-qa.js']:
    s=s.replace(name+'?v=173.53',name+'?v=173.54')
p.write_text(s,encoding='utf-8')

p=Path('js/equipment-progression.js')
s=p.read_text(encoding='utf-8')
old='''        const startedAt=Date.now();
        (function waitForV17351(){
            if(window.__v17351QaReady){ releaseV17350RuntimeGate(); return; }
            if(Date.now()-startedAt>5000){ failV17350RuntimeGate("V173.51 功能載入逾時，請重新整理。"); return; }
            setTimeout(waitForV17351,25);
        })();
'''
new='''        if(window.__v17351QaReady){
            releaseV17350RuntimeGate();
            return;
        }
        let qaSettled=false;
        const onQaReady=function(){
            if(qaSettled){ return; }
            qaSettled=true;
            document.removeEventListener("v17351:qa-ready",onQaReady);
            releaseV17350RuntimeGate();
        };
        document.addEventListener("v17351:qa-ready",onQaReady,{once:true});
        setTimeout(function(){
            if(qaSettled||window.__v17351QaReady){
                if(!qaSettled){ onQaReady(); }
                return;
            }
            qaSettled=true;
            document.removeEventListener("v17351:qa-ready",onQaReady);
            failV17350RuntimeGate("功能模組載入時間過長，請重新整理後再試。");
        },30000);
'''
if old not in s: raise SystemExit('5 second QA timeout anchor not found')
s=s.replace(old,new,1)
s=s.replace('css/52-v173.50-inventory-qol.css?v=173.53','css/52-v173.50-inventory-qol.css?v=173.54')
s=s.replace('js/53-v173.50-inventory-qol.js?v=173.53','js/53-v173.50-inventory-qol.js?v=173.54')
p.write_text(s,encoding='utf-8')

p=Path('js/20-anonymous-20.js')
s=p.read_text(encoding='utf-8')
if 'const V_ASSET_VERSION="173.53";' not in s: raise SystemExit('V_ASSET_VERSION 173.53 not found')
s=s.replace('const V_ASSET_VERSION="173.53";','const V_ASSET_VERSION="173.54";',1)
s=s.replace('document.documentElement.dataset.runtimeReady="173.52";','document.documentElement.dataset.runtimeReady="173.54";',1)
p.write_text(s,encoding='utf-8')

p=Path('js/51-v169-rpg-ui.js')
s=p.read_text(encoding='utf-8').replace('js/equipment-progression.js?v=173.53','js/equipment-progression.js?v=173.54')
p.write_text(s,encoding='utf-8')

p=Path('index.html')
s=p.read_text(encoding='utf-8').replace('173.53','173.54')
p.write_text(s,encoding='utf-8')

for p in Path('tests').glob('*.js'):
    s=p.read_text(encoding='utf-8')
    n=s.replace('173\\.53','173\\.54').replace('173.53','173.54')
    if n!=s: p.write_text(n,encoding='utf-8')

Path('tests/v173.54-qa-readiness.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.match(qol,/const finish=function\(\)\{[\s\S]*?window\.__v17351QaReady=true;[\s\S]*?v17351:qa-ready/);
assert.match(qol,/existing\.dataset\.loaded==="1"/);
assert.match(qol,/existing\.addEventListener\("load"/);
assert.match(qol,/script\.dataset\.loaded="1"/);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","56-v173.51-shop-qa.js","57-v173.51-quest-qa.js"]){assert.ok(qol.includes(name+"?v=173.54"));}
assert.doesNotMatch(equipment,/Date\.now\(\)-startedAt>5000/);
assert.doesNotMatch(equipment,/V173\.51 功能載入逾時/);
assert.match(equipment,/document\.addEventListener\("v17351:qa-ready",onQaReady,\{once:true\}\)/);
assert.match(equipment,/30000/);
assert.match(loader,/const V_ASSET_VERSION="173\.54"/);
assert.match(loader,/dataset\.runtimeReady="173\.54"/);
assert.match(ui,/equipment-progression\.js\?v=173\.54/);
assert.match(index,/<title>四象江湖傳 V173\.54<\/title>/);
console.log("✓ V173.54 explicit QA readiness without false 5s timeout");
''',encoding='utf-8')

print('V173.54 QA readiness patch applied')
