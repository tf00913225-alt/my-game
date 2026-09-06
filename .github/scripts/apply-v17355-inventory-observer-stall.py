from pathlib import Path

p=Path('js/55-v173.51-inventory-qa.js')
s=p.read_text(encoding='utf-8')
start=s.index('function syncSellUi(){')
end=s.index('window.v17350BulkSellEquipment=async function()', start)
old=s[start:end]
new='''function syncSellUi(){const bar=document.getElementById("v17350BulkSellBar");if(!bar)return;const q=readQ(),s=summary(q),b=document.getElementById("v17351BulkQualityButton"),sell=bar.querySelector("#v17350BulkSellButton"),meta=bar.querySelector("#v17350BulkSellMeta");if(b){const text=QL[q]+"以下 ▾";if(b.textContent!==text)b.textContent=text;}document.querySelectorAll("#v17351BulkQualityPicker [data-q]").forEach(o=>{const yes=o.dataset.q===q;if(o.classList.contains("selected")!==yes)o.classList.toggle("selected",yes);const aria=yes?"true":"false";if(o.getAttribute("aria-selected")!==aria)o.setAttribute("aria-selected",aria)});if(sell){if(sell.disabled!==(s.units<=0))sell.disabled=s.units<=0;const text="售出 "+s.units+" 件";if(sell.textContent!==text)sell.textContent=text;if(sell.classList.contains("danger")!==s.orange)sell.classList.toggle("danger",s.orange)}if(meta){const lc=typeof inventoryItems!=="undefined"?inventoryItems.filter(i=>equipment(i)&&locked(i)).length:0;const text=s.units?"預計獲得 "+s.gold.toLocaleString("zh-TW")+" 金幣"+(lc?"・略過 "+lc+" 件鎖定":""):"目前沒有符合條件且未鎖定的裝備";if(meta.textContent!==text)meta.textContent=text}}
'''
s=s[:start]+new+s[end:]
old_tail='''const obs=new MutationObserver(()=>{fullscreen();picker();syncSellUi()});obs.observe(document.body,{subtree:true,childList:true});setInterval(()=>{fullscreen();picker();syncSellUi()},500);fullscreen();picker();'''
new_tail='''let inventorySyncQueued=false;function scheduleInventorySync(){if(inventorySyncQueued)return;inventorySyncQueued=true;const run=()=>{inventorySyncQueued=false;fullscreen();picker();syncSellUi()};if(typeof requestAnimationFrame==="function")requestAnimationFrame(run);else setTimeout(run,0)}const obs=new MutationObserver(scheduleInventorySync);obs.observe(document.body,{subtree:true,childList:true});setInterval(scheduleInventorySync,500);scheduleInventorySync();'''
if old_tail not in s: raise SystemExit('inventory observer tail anchor not found')
s=s.replace(old_tail,new_tail,1)
p.write_text(s,encoding='utf-8')

# bump the full cache chain so Android cannot reuse V173.54
p=Path('js/20-anonymous-20.js')
s=p.read_text(encoding='utf-8')
if 'const V_ASSET_VERSION="173.54";' not in s: raise SystemExit('V_ASSET_VERSION 173.54 not found')
s=s.replace('const V_ASSET_VERSION="173.54";','const V_ASSET_VERSION="173.55";',1)
s=s.replace('dataset.runtimeReady="173.54"','dataset.runtimeReady="173.55"',1)
p.write_text(s,encoding='utf-8')

p=Path('js/51-v169-rpg-ui.js')
s=p.read_text(encoding='utf-8').replace('js/equipment-progression.js?v=173.54','js/equipment-progression.js?v=173.55')
p.write_text(s,encoding='utf-8')

p=Path('js/equipment-progression.js')
s=p.read_text(encoding='utf-8').replace('css/52-v173.50-inventory-qol.css?v=173.54','css/52-v173.50-inventory-qol.css?v=173.55').replace('js/53-v173.50-inventory-qol.js?v=173.54','js/53-v173.50-inventory-qol.js?v=173.55')
p.write_text(s,encoding='utf-8')

p=Path('js/53-v173.50-inventory-qol.js')
s=p.read_text(encoding='utf-8').replace('css/53-v173.51-qa.css?v=173.54','css/53-v173.51-qa.css?v=173.55')
for name in ['54-v173.51-battle-qa.js','55-v173.51-inventory-qa.js','56-v173.51-shop-qa.js','57-v173.51-quest-qa.js']:
    s=s.replace(name+'?v=173.54',name+'?v=173.55')
p.write_text(s,encoding='utf-8')

p=Path('index.html')
s=p.read_text(encoding='utf-8').replace('173.54','173.55')
p.write_text(s,encoding='utf-8')

for p in Path('tests').glob('*.js'):
    s=p.read_text(encoding='utf-8')
    n=s.replace('173\\.54','173\\.55').replace('173.54','173.55')
    if n!=s:p.write_text(n,encoding='utf-8')

Path('tests/v173.55-inventory-observer-stall.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const inv=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.match(inv,/if\(b\.textContent!==text\)b\.textContent=text/);
assert.match(inv,/if\(meta\.textContent!==text\)meta\.textContent=text/);
assert.match(inv,/let inventorySyncQueued=false/);
assert.match(inv,/new MutationObserver\(scheduleInventorySync\)/);
assert.doesNotMatch(inv,/new MutationObserver\(\(\)=>\{fullscreen\(\);picker\(\);syncSellUi\(\)\}\)/);
assert.match(loader,/const V_ASSET_VERSION="173\.55"/);
for(const name of ["54-v173.51-battle-qa.js","55-v173.51-inventory-qa.js","56-v173.51-shop-qa.js","57-v173.51-quest-qa.js"]){assert.ok(qol.includes(name+"?v=173.55"));}
assert.match(index,/<title>四象江湖傳 V173\.55<\/title>/);
console.log("✓ V173.55 inventory observer no longer self-triggers at module 30");
''',encoding='utf-8')
print('V173.55 patch applied')
