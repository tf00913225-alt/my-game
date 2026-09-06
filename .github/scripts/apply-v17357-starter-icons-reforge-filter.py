from pathlib import Path

# 1) Repair the six legacy starter equipment icons at runtime and mark them as
# white/non-refinable so both new games and old saves render consistently.
p=Path('js/equipment-progression.js')
s=p.read_text(encoding='utf-8')
anchor='''    function artMarkup(path,rarityKey){\n        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarityKey+'"><img src="'+path+'" alt="" draggable="false" onerror="this.hidden=true"></span>';\n    }\n'''
if anchor not in s:
    raise SystemExit('artMarkup anchor not found')
insert=r'''    const LEGACY_STARTER_EQUIPMENT_ART={
        ironSword:{path:"assets/equipment/warrior/weapon-01.png",classType:"warrior"},
        woodStaff:{path:"assets/equipment/mage/weapon-01.png",classType:"mage"},
        leatherHelmet:{path:"assets/equipment/warrior/head-01.png"},
        leatherArmor:{path:"assets/equipment/warrior/armor-01.png"},
        leatherShoes:{path:"assets/equipment/warrior/shoes-01.png"},
        powerRing:{ring:true}
    };
    function legacyStarterRingMarkup(){
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-white v17357-starter-ring"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style="width:100%;height:100%;display:block"><defs><radialGradient id="v17357RingGem" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#d49a36"/><stop offset="1" stop-color="#6f4517"/></radialGradient><linearGradient id="v17357RingGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8dd86"/><stop offset=".55" stop-color="#b97623"/><stop offset="1" stop-color="#674016"/></linearGradient></defs><ellipse cx="32" cy="38" rx="18" ry="15" fill="none" stroke="url(#v17357RingGold)" stroke-width="7"/><path d="M21 24l6-8h10l6 8-6 7H27z" fill="url(#v17357RingGem)" stroke="#f6d47a" stroke-width="2"/><circle cx="32" cy="22" r="3" fill="#fff6c8" opacity=".9"/></svg></span>';
    }
    function repairLegacyStarterEquipmentIcons(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return false; }
        let changed=false;
        inventoryItems.forEach(item=>{
            if(!item){ return; }
            const spec=LEGACY_STARTER_EQUIPMENT_ART[String(item.id||"")];
            if(!spec){ return; }
            const iconText=String(item.icon||"");
            const hasRealArt=/<(?:img|svg)\\b/i.test(iconText);
            if(!hasRealArt){
                item.icon=spec.ring?legacyStarterRingMarkup():artMarkup(spec.path,"white");
                changed=true;
            }
            if(spec.path&&item.assetPath!==spec.path){ item.assetPath=spec.path; changed=true; }
            if(spec.classType&&!item.classType){ item.classType=spec.classType; changed=true; }
            if(item.rarityKey!=="white"){ item.rarityKey="white"; changed=true; }
            if(item.quality!=="white"){ item.quality="white"; changed=true; }
            if(Number(item.reforgeSlots)!==0){ item.reforgeSlots=0; changed=true; }
            if(Number(item.reforgeUsed)!==0){ item.reforgeUsed=0; changed=true; }
        });
        return changed;
    }
    window.v17357RepairLegacyStarterEquipmentIcons=repairLegacyStarterEquipmentIcons;
'''
s=s.replace(anchor,anchor+insert,1)

sync_anchor='''    function syncFourElementSets(){\n        syncMainCharacterEquipmentStorage();\n'''
if sync_anchor not in s:
    raise SystemExit('syncFourElementSets anchor not found')
s=s.replace(sync_anchor,'''    function syncFourElementSets(){\n        repairLegacyStarterEquipmentIcons();\n        syncMainCharacterEquipmentStorage();\n''',1)

post_sync='''    syncFourElementSets();\n    window.v17346SyncFourElementSets=syncFourElementSets;\n'''
if post_sync not in s:
    raise SystemExit('post sync anchor not found')
post_insert=r'''    syncFourElementSets();
    window.v17346SyncFourElementSets=syncFourElementSets;
    if(typeof rebuildInventorySlots==="function"){
        const previousV17357RebuildInventorySlots=rebuildInventorySlots;
        rebuildInventorySlots=function(){ repairLegacyStarterEquipmentIcons(); return previousV17357RebuildInventorySlots.apply(this,arguments); };
    }
    if(typeof renderInventoryItems==="function"){
        const previousV17357RenderInventoryItems=renderInventoryItems;
        renderInventoryItems=function(){ repairLegacyStarterEquipmentIcons(); return previousV17357RenderInventoryItems.apply(this,arguments); };
    }
    if(typeof document!=="undefined"){
        const repairAfterLoad=()=>{ repairLegacyStarterEquipmentIcons(); };
        if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",repairAfterLoad,{once:true});
        else setTimeout(repairAfterLoad,0);
    }
'''
s=s.replace(post_sync,post_insert,1)
p.write_text(s,encoding='utf-8')

# 2) Reforge screen must only list equipment that is actually refinable now.
p=Path('js/36-v141-content-systems.js')
s=p.read_text(encoding='utf-8')
old=r'''    function allRefinableEquipment(){
        ensureEquipmentUids();
        const results=[];
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)){ results.push({item,source:"背包"}); }
        });
        Object.keys(characterEquipment||{}).forEach(characterKey=>{
            Object.values(characterEquipment[characterKey]||{}).forEach(item=>{
                if(item){ results.push({item,source:"已裝備"}); }
            });
        });
        return results;
    }
'''
new=r'''    function canActuallyReforge(item){
        if(!item||item.v17351Locked===true){ return false; }
        if(typeof window.v17346RemainingReforgeSlots==="function"){
            return window.v17346RemainingReforgeSlots(item)>0;
        }
        const slots=Math.max(0,Math.floor(Number(item.reforgeSlots)||0));
        const used=Math.max(0,Math.floor(Number(item.reforgeUsed)||0));
        return slots>used;
    }
    function allRefinableEquipment(){
        ensureEquipmentUids();
        const results=[];
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)&&canActuallyReforge(item)){ results.push({item,source:"背包"}); }
        });
        Object.keys(characterEquipment||{}).forEach(characterKey=>{
            Object.values(characterEquipment[characterKey]||{}).forEach(item=>{
                if(item&&canActuallyReforge(item)){ results.push({item,source:"已裝備"}); }
            });
        });
        return results;
    }
'''
if old not in s:
    raise SystemExit('allRefinableEquipment anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 3) V173.57 cache/version bump. Keep this explicit to avoid stale mobile runtime.
version_files=[
    Path('index.html'),
    Path('js/20-anonymous-20.js'),
    Path('js/51-v169-rpg-ui.js'),
    Path('js/equipment-progression.js'),
    Path('js/53-v173.50-inventory-qol.js'),
    Path('js/56-v173.51-shop-qa.js')
]
for p in version_files:
    t=p.read_text(encoding='utf-8')
    if '173.56' in t:
        p.write_text(t.replace('173.56','173.57'),encoding='utf-8')

# Keep existing release tests in sync with the current external version.
for p in Path('tests').glob('*.js'):
    t=p.read_text(encoding='utf-8')
    n=t.replace('173\\.56','173\\.57').replace('173.56','173.57')
    if n!=t:
        p.write_text(n,encoding='utf-8')

Path('tests/v173.57-starter-icons-reforge-filter.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const eq=fs.readFileSync("js/equipment-progression.js","utf8");
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

[
  ["ironSword","assets/equipment/warrior/weapon-01.png"],
  ["woodStaff","assets/equipment/mage/weapon-01.png"],
  ["leatherHelmet","assets/equipment/warrior/head-01.png"],
  ["leatherArmor","assets/equipment/warrior/armor-01.png"],
  ["leatherShoes","assets/equipment/warrior/shoes-01.png"]
].forEach(([id,path])=>{
  assert.ok(eq.includes(id+':{path:"'+path+'"'),id+" starter art mapping missing");
});
assert.ok(eq.includes('powerRing:{ring:true}'));
assert.match(eq,/function repairLegacyStarterEquipmentIcons\(\)/);
assert.match(eq,/item\.icon=spec\.ring\?legacyStarterRingMarkup\(\):artMarkup\(spec\.path,"white"\)/);
assert.match(eq,/item\.rarityKey="white"/);
assert.match(eq,/item\.quality="white"/);
assert.match(eq,/item\.reforgeSlots=0/);
assert.match(eq,/repairLegacyStarterEquipmentIcons\(\);\n\s*syncMainCharacterEquipmentStorage\(\)/);

assert.match(synthesis,/function canActuallyReforge\(item\)/);
assert.match(synthesis,/item\.v17351Locked===true/);
assert.match(synthesis,/v17346RemainingReforgeSlots\(item\)>0/);
assert.match(synthesis,/isEquipmentInventoryType\(item\.type\)&&canActuallyReforge\(item\)/);
assert.match(synthesis,/if\(item&&canActuallyReforge\(item\)\)\{ results\.push\(\{item,source:"已裝備"\}\); \}/);

assert.match(loader,/const V_ASSET_VERSION="173\.57"/);
assert.match(index,/<title>四象江湖傳 V173\.57<\/title>/);
console.log("✓ V173.57 starter equipment icons and reforge eligibility filter");
''',encoding='utf-8')

print('V173.57 starter icon + reforge filter patch prepared')
