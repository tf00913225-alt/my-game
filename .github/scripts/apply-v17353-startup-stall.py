from pathlib import Path

# 1) Fix the two QA observers that can self-trigger forever by observing the
#    same class/style mutations they write themselves. This can starve the
#    main thread immediately after module 29/32 and prevent module 30 from
#    completing on Android Chrome.

p=Path('js/54-v173.51-battle-qa.js')
s=p.read_text(encoding='utf-8')
old='function syncManagement(){const shell=document.getElementById("characterPage")||document.getElementById("characterModal");const tab=document.getElementById("characterTabContent");const open=!!(tab&&visible(tab)&&(!shell||visible(shell)));document.body.classList.toggle("v17351-management-open",open);const stage=document.getElementById("v143-skill-stage");if(stage)stage.style.visibility=open?"hidden":"";document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>n.classList.add("v17351-large-use-notice"));ensureExpRowsVisible();}'
new='function syncManagement(){const shell=document.getElementById("characterPage")||document.getElementById("characterModal");const tab=document.getElementById("characterTabContent");const open=!!(tab&&visible(tab)&&(!shell||visible(shell)));if(document.body.classList.contains("v17351-management-open")!==open)document.body.classList.toggle("v17351-management-open",open);const stage=document.getElementById("v143-skill-stage");if(stage){const nextVisibility=open?"hidden":"";if(stage.style.visibility!==nextVisibility)stage.style.visibility=nextVisibility;}document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice")});ensureExpRowsVisible();}'
if old not in s: raise SystemExit('battle QA syncManagement anchor not found')
s=s.replace(old,new,1)
old='const observer=new MutationObserver(syncManagement);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});setInterval(syncManagement,300);syncManagement();'
new='const observer=new MutationObserver(syncManagement);observer.observe(document.body,{subtree:true,childList:true});setInterval(syncManagement,300);syncManagement();'
if old not in s: raise SystemExit('battle QA observer anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=Path('js/55-v173.51-inventory-qa.js')
s=p.read_text(encoding='utf-8')
old='function fullscreen(){const inv=document.getElementById("inventoryPage"),shell=document.getElementById("characterPage")||document.getElementById("characterModal"),shellOpen=!shell||visible(shell),open=!!(inv&&visible(inv)&&(inv.classList.contains("map-inventory-overlay-open")||shellOpen));document.body.classList.toggle("v17351-inventory-fullscreen",open);if(open)picker();}'
new='function fullscreen(){const inv=document.getElementById("inventoryPage"),shell=document.getElementById("characterPage")||document.getElementById("characterModal"),shellOpen=!shell||visible(shell),open=!!(inv&&visible(inv)&&(inv.classList.contains("map-inventory-overlay-open")||shellOpen));if(document.body.classList.contains("v17351-inventory-fullscreen")!==open)document.body.classList.toggle("v17351-inventory-fullscreen",open);if(open)picker();}'
if old not in s: raise SystemExit('inventory QA fullscreen anchor not found')
s=s.replace(old,new,1)
old='const obs=new MutationObserver(()=>{fullscreen();picker();syncSellUi()});obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});setInterval(()=>{fullscreen();picker();syncSellUi()},500);fullscreen();picker();'
new='const obs=new MutationObserver(()=>{fullscreen();picker();syncSellUi()});obs.observe(document.body,{subtree:true,childList:true});setInterval(()=>{fullscreen();picker();syncSellUi()},500);fullscreen();picker();'
if old not in s: raise SystemExit('inventory QA observer anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 2) Bump the runtime cache chain so Android Chrome cannot keep the looping
#    V173.52 QA modules.
p=Path('js/20-anonymous-20.js')
s=p.read_text(encoding='utf-8')
if 'const V_ASSET_VERSION="173.52";' not in s: raise SystemExit('loader 173.52 version anchor not found')
s=s.replace('const V_ASSET_VERSION="173.52";','const V_ASSET_VERSION="173.53";',1)
p.write_text(s,encoding='utf-8')

p=Path('js/51-v169-rpg-ui.js')
s=p.read_text(encoding='utf-8').replace('js/equipment-progression.js?v=173.52','js/equipment-progression.js?v=173.53')
p.write_text(s,encoding='utf-8')

p=Path('js/equipment-progression.js')
s=p.read_text(encoding='utf-8').replace('css/52-v173.50-inventory-qol.css?v=173.52','css/52-v173.50-inventory-qol.css?v=173.53').replace('js/53-v173.50-inventory-qol.js?v=173.52','js/53-v173.50-inventory-qol.js?v=173.53')
p.write_text(s,encoding='utf-8')

p=Path('js/53-v173.50-inventory-qol.js')
s=p.read_text(encoding='utf-8').replace('css/53-v173.51-qa.css?v=173.52','css/53-v173.51-qa.css?v=173.53')
for name in ['54-v173.51-battle-qa.js','55-v173.51-inventory-qa.js','56-v173.51-shop-qa.js','57-v173.51-quest-qa.js']:
    s=s.replace(name+'?v=173.52',name+'?v=173.53')
p.write_text(s,encoding='utf-8')

p=Path('index.html')
s=p.read_text(encoding='utf-8').replace('173.52','173.53')
p.write_text(s,encoding='utf-8')

# 3) Current-version test expectations.
for p in Path('tests').glob('*.js'):
    s=p.read_text(encoding='utf-8')
    n=s.replace('173\\.52','173\\.53').replace('173.52','173.53')
    if n!=s: p.write_text(n,encoding='utf-8')

# 4) Regression test for the exact 29/32 stall.
Path('tests/v173.53-startup-stall-regression.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const inventory=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.doesNotMatch(battle,/observer\.observe\(document\.body,\{subtree:true,childList:true,attributes:true/);
assert.match(battle,/observer\.observe\(document\.body,\{subtree:true,childList:true\}\)/);
assert.match(battle,/stage\.style\.visibility!==nextVisibility/);
assert.doesNotMatch(inventory,/obs\.observe\(document\.body,\{subtree:true,childList:true,attributes:true/);
assert.match(inventory,/obs\.observe\(document\.body,\{subtree:true,childList:true\}\)/);
assert.match(inventory,/classList\.contains\("v17351-inventory-fullscreen"\)!==open/);
assert.match(loader,/const V_ASSET_VERSION="173\.53"/);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","56-v173.51-shop-qa.js","57-v173.51-quest-qa.js"]){
  assert.ok(qol.includes(name+"?v=173.53"),name+" fresh cache key");
}
assert.match(index,/<title>四象江湖傳 V173\.53<\/title>/);
console.log("✓ V173.53 fixes 29/32 startup microtask starvation");
''',encoding='utf-8')

print('V173.53 startup stall patch applied')
