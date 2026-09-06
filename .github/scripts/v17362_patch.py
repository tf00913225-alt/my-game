from pathlib import Path
import re

ROOT=Path('.')

def read(path):
    return (ROOT/path).read_text(encoding='utf-8')

def write(path,text):
    (ROOT/path).write_text(text,encoding='utf-8')

def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old,new,1)

def regex_once(text,pattern,repl,label,flags=0):
    out,count=re.subn(pattern,repl,text,count=1,flags=flags)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 regex match, got {count}')
    return out

# -----------------------------------------------------
# 1) Core inventory stack cap + starter equipment source
# -----------------------------------------------------
main=read('js/00-main.js')
main=replace_once(main,'const INVENTORY_MAX_STACK_DEFAULT=100;','const INVENTORY_MAX_STACK_DEFAULT=999;','inventory stack cap')
main=main.replace('其餘類型：每格最多 100 件。','其餘類型：每格最多 999 件。')

main=regex_once(
    main,
    r'(id:"ironSword",[\s\S]*?stats:\{\s*)attack:10(\s*\})',
    r'\1attack:3\2',
    'starter iron sword stats'
)
main=regex_once(
    main,
    r'(id:"woodStaff",[\s\S]*?stats:\{\s*)intelligence:12,\s*attack:3(\s*\})',
    r'\1intelligence:3\2',
    'starter staff stats'
)
main=regex_once(
    main,
    r'(id:"leatherArmor",[\s\S]*?stats:\{\s*)defense:10,\s*maxHP:20(\s*\})',
    r'\1vitality:2\2',
    'starter armor stats'
)
main=regex_once(
    main,
    r'(id:"leatherShoes",[\s\S]*?stats:\{\s*)agility:5(\s*\})',
    r'\1agility:2\2',
    'starter shoes stats'
)
write('js/00-main.js',main)

# -----------------------------------------------------
# 2) Existing starter gear migration + current white rules
# -----------------------------------------------------
equipment=read('js/equipment-progression.js')
anchor='''    const LEGACY_STARTER_EQUIPMENT_ART={\n        ironSword:{path:"assets/equipment/warrior/weapon-01.png",classType:"warrior"},\n        woodStaff:{path:"assets/equipment/mage/weapon-01.png",classType:"mage"},\n        leatherHelmet:{path:"assets/equipment/warrior/head-01.png"},\n        leatherArmor:{path:"assets/equipment/warrior/armor-01.png"},\n        leatherShoes:{path:"assets/equipment/warrior/shoes-01.png"},\n        powerRing:{ring:true}\n    };'''
insert=anchor+'''\n    /* V173.62: starter whites obey the same 1–3 single-stat band as ordinary white drops/shop gear. */\n    const STARTER_WHITE_STATS={\n        ironSword:{attack:3},\n        woodStaff:{intelligence:3},\n        leatherHelmet:{vitality:1},\n        leatherArmor:{vitality:2},\n        leatherShoes:{agility:2}\n    };\n    function repairStarterWhiteStats(item){\n        if(!item){ return false; }\n        const expected=STARTER_WHITE_STATS[String(item.id||"")];\n        if(!expected){ return false; }\n        const current=item.stats&&typeof item.stats==="object"?item.stats:{};\n        const currentKeys=Object.keys(current);\n        const expectedKeys=Object.keys(expected);\n        const same=currentKeys.length===expectedKeys.length&&expectedKeys.every(key=>Number(current[key])===Number(expected[key]));\n        if(same){ return false; }\n        item.stats={...expected};\n        return true;\n    }'''
equipment=replace_once(equipment,anchor,insert,'starter migration constants')

equipment=replace_once(
    equipment,
    '''            const spec=LEGACY_STARTER_EQUIPMENT_ART[String(item.id||"")];\n            if(!spec){ return; }''',
    '''            const spec=LEGACY_STARTER_EQUIPMENT_ART[String(item.id||"")];\n            if(!spec){ return; }\n            if(repairStarterWhiteStats(item)){ changed=true; }''',
    'inventory starter migration hook'
)

marker='''        });\n        return changed;\n    }\n    window.v17357RepairLegacyStarterEquipmentIcons=repairLegacyStarterEquipmentIcons;'''
replacement='''        });\n        /* Existing saves may already have a starter piece equipped rather than in inventory. */\n        if(typeof characterEquipment!=="undefined"&&characterEquipment&&typeof characterEquipment==="object"){\n            Object.values(characterEquipment).forEach(slots=>{\n                if(!slots||typeof slots!=="object"){ return; }\n                Object.values(slots).forEach(item=>{\n                    if(repairStarterWhiteStats(item)){ changed=true; }\n                });\n            });\n        }\n        return changed;\n    }\n    window.v17357RepairLegacyStarterEquipmentIcons=repairLegacyStarterEquipmentIcons;\n    window.v17362StarterWhiteStats=Object.fromEntries(Object.entries(STARTER_WHITE_STATS).map(([id,stats])=>[id,{...stats}]));'''
equipment=replace_once(equipment,marker,replacement,'equipped starter migration')
write('js/equipment-progression.js',equipment)

# -----------------------------------------------------
# 3) Inventory normalization + same-family quality sorting
# -----------------------------------------------------
qol=read('js/53-v173.50-inventory-qol.js')
qol_anchor='''    function readBulkSellThreshold(){'''
qol_block='''    const V17362_STACK_LIMIT=999;\n\n    function inventoryQualityRank(item){\n        const quality=equipmentQuality(item);\n        const rank=QUALITY_ORDER.indexOf(quality);\n        return rank>=0?rank:-1;\n    }\n\n    function inventoryFamilyKey(item){\n        if(!item){ return "zz:unknown"; }\n        const id=String(item.id||"");\n        const type=String(item.type||"item");\n        if(isInventoryEquipment(item)){\n            const slot=type==="hand"?"weapon":type==="helmet"?"head":type;\n            return "equipment:"+String(item.classType||"any")+":"+slot;\n        }\n        if(item.blueprintSlot){ return "material:blueprint:"+String(item.blueprintSlot); }\n        if(/^ore/i.test(id)){ return "material:ore"; }\n        if(item.talismanEffect){ return "talisman:"+String(item.talismanEffect); }\n        if(type==="potion"){ return "potion:"+id; }\n        if(type==="chest"){ return "chest:"+id; }\n        if(type==="ticket"){ return "ticket:"+String(item.setId||id); }\n        return type+":"+(id||String(item.name||""));\n    }\n\n    function cloneInventoryStack(item,count){\n        const copy={...item,count};\n        if(item.stats&&typeof item.stats==="object"){ copy.stats={...item.stats}; }\n        if(item.reforgeStats&&typeof item.reforgeStats==="object"){ copy.reforgeStats={...item.reforgeStats}; }\n        return copy;\n    }\n\n    function normalizeInventoryStacksAndOrder(){\n        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return false; }\n        const source=inventoryItems.filter(Boolean);\n        const familyOrder=new Map();\n        let nextFamily=0;\n        source.forEach(item=>{\n            const family=inventoryFamilyKey(item);\n            if(!familyOrder.has(family)){ familyOrder.set(family,nextFamily++); }\n        });\n\n        const exactStacks=new Map();\n        const output=[];\n        source.forEach((item,index)=>{\n            if(isInventoryEquipment(item)){\n                if(Number(item.count)!==1){ item.count=1; }\n                output.push(item);\n                return;\n            }\n            const id=String(item.id||"");\n            if(!id){\n                let remaining=Math.max(1,Math.floor(Number(item.count)||1));\n                while(remaining>0){\n                    const amount=Math.min(V17362_STACK_LIMIT,remaining);\n                    output.push(cloneInventoryStack(item,amount));\n                    remaining-=amount;\n                }\n                return;\n            }\n            const exactKey=String(item.type||"")+"::"+id;\n            let entry=exactStacks.get(exactKey);\n            if(!entry){\n                entry={template:item,total:0,first:index};\n                exactStacks.set(exactKey,entry);\n            }\n            entry.total+=Math.max(1,Math.floor(Number(item.count)||1));\n        });\n        exactStacks.forEach(entry=>{\n            let remaining=entry.total;\n            while(remaining>0){\n                const amount=Math.min(V17362_STACK_LIMIT,remaining);\n                output.push(cloneInventoryStack(entry.template,amount));\n                remaining-=amount;\n            }\n        });\n\n        output.sort((a,b)=>{\n            const familyA=inventoryFamilyKey(a);\n            const familyB=inventoryFamilyKey(b);\n            const familyDiff=(familyOrder.get(familyA)??999999)-(familyOrder.get(familyB)??999999);\n            if(familyDiff){ return familyDiff; }\n            const qualityDiff=inventoryQualityRank(b)-inventoryQualityRank(a);\n            if(qualityDiff){ return qualityDiff; }\n            const idDiff=String(a.id||"").localeCompare(String(b.id||""),"zh-Hant");\n            if(idDiff){ return idDiff; }\n            return String(a.name||"").localeCompare(String(b.name||""),"zh-Hant");\n        });\n\n        const changed=output.length!==inventoryItems.length||output.some((item,index)=>{\n            const previous=inventoryItems[index];\n            return previous!==item||Number(previous&&previous.count)!==Number(item.count);\n        });\n        if(changed){\n            inventoryItems.splice(0,inventoryItems.length,...output);\n        }\n        return changed;\n    }\n\n    window.v17362NormalizeInventoryStacksAndOrder=normalizeInventoryStacksAndOrder;\n    window.v17362InventoryFamilyKey=inventoryFamilyKey;\n\n    /* Normalize old saves immediately, then again whenever the inventory grid is rebuilt. */\n    normalizeInventoryStacksAndOrder();\n    if(typeof rebuildInventorySlots==="function"&&!rebuildInventorySlots.__v17362Normalized){\n        const previousRebuildInventorySlots=rebuildInventorySlots;\n        const normalizedRebuild=function(){\n            normalizeInventoryStacksAndOrder();\n            return previousRebuildInventorySlots.apply(this,arguments);\n        };\n        normalizedRebuild.__v17362Normalized=true;\n        rebuildInventorySlots=normalizedRebuild;\n        window.rebuildInventorySlots=normalizedRebuild;\n    }\n\n'''+qol_anchor
qol=replace_once(qol,qol_anchor,qol_block,'inventory normalization block')
write('js/53-v173.50-inventory-qol.js',qol)

# -----------------------------------------------------
# 4) Patrol/wild battle VFX visibility recovery
# -----------------------------------------------------
battleqa=read('js/54-v173.51-battle-qa.js')
battleqa=replace_once(
    battleqa,
    'const open=!!(tab&&visible(tab)&&(!shell||visible(shell)));',
    'const open=!inBattle()&&!!(tab&&visible(tab)&&(!shell||visible(shell)));',
    'management must not suppress VFX during battle'
)
write('js/54-v173.51-battle-qa.js',battleqa)

animation=read('js/39-v143-skill-animation.js')
animation=replace_once(
    animation,
    '''        stage.id="v143-skill-stage";\n        stage.className="v143-skill-stage";''',
    '''        stage.id="v143-skill-stage";\n        stage.className="v143-skill-stage";\n        /* V173.62: a stale non-battle management state must never leave combat VFX hidden. */\n        stage.style.visibility="visible";''',
    'v143 stage visibility hardening'
)
write('js/39-v143-skill-animation.js',animation)

# -----------------------------------------------------
# 5) Version/cache bump: V173.61 -> V173.62 only for current-version wiring
# -----------------------------------------------------
index=read('index.html').replace('V173.61','V173.62').replace('?v=173.61','?v=173.62')
write('index.html',index)

loader=read('js/20-anonymous-20.js')
loader=replace_once(loader,'const V_ASSET_VERSION="173.61";','const V_ASSET_VERSION="173.62";','loader version')
write('js/20-anonymous-20.js',loader)

for path in ROOT.glob('js/*.js'):
    if path.name=='20-anonymous-20.js':
        continue
    text=path.read_text(encoding='utf-8')
    if '?v=173.61' in text:
        path.write_text(text.replace('?v=173.61','?v=173.62'),encoding='utf-8')
for path in ROOT.glob('css/*.css'):
    text=path.read_text(encoding='utf-8')
    if '?v=173.61' in text:
        path.write_text(text.replace('?v=173.61','?v=173.62'),encoding='utf-8')
for path in ROOT.glob('tests/*.js'):
    text=path.read_text(encoding='utf-8')
    if '173.61' in text:
        path.write_text(text.replace('173.61','173.62'),encoding='utf-8')

# -----------------------------------------------------
# 6) V173.62 regression suite
# -----------------------------------------------------
test_path=ROOT/'tests/v173.62-inventory-patrol-starter.test.js'
test_path.write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const main=fs.readFileSync("js/00-main.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(main,/const INVENTORY_MAX_STACK_DEFAULT=999;/);
assert.match(qol,/const V17362_STACK_LIMIT=999;/);
assert.match(qol,/window\.v17362NormalizeInventoryStacksAndOrder=normalizeInventoryStacksAndOrder/);
assert.match(qol,/if\(isInventoryEquipment\(item\)\)[\s\S]*?item\.count=1/);
assert.match(qol,/entry\.total\+=Math\.max\(1,Math\.floor\(Number\(item\.count\)\|\|1\)\)/);
assert.match(qol,/Math\.min\(V17362_STACK_LIMIT,remaining\)/);
assert.match(qol,/const qualityDiff=inventoryQualityRank\(b\)-inventoryQualityRank\(a\)/);
assert.match(qol,/item\.blueprintSlot[\s\S]*?material:blueprint/);
assert.match(qol,/\/\^ore\/i\.test\(id\)[\s\S]*?material:ore/);

assert.match(main,/id:"ironSword"[\s\S]*?stats:\{\s*attack:3\s*\}/);
assert.match(main,/id:"woodStaff"[\s\S]*?stats:\{\s*intelligence:3\s*\}/);
assert.match(main,/id:"leatherHelmet"[\s\S]*?stats:\{\s*vitality:1\s*\}/);
assert.match(main,/id:"leatherArmor"[\s\S]*?stats:\{\s*vitality:2\s*\}/);
assert.match(main,/id:"leatherShoes"[\s\S]*?stats:\{\s*agility:2\s*\}/);
assert.doesNotMatch(main,/id:"woodStaff"[\s\S]{0,220}intelligence:12/);
assert.doesNotMatch(main,/id:"leatherArmor"[\s\S]{0,240}defense:10/);
assert.match(equipment,/const STARTER_WHITE_STATS=\{[\s\S]*?ironSword:\{attack:3\}[\s\S]*?woodStaff:\{intelligence:3\}[\s\S]*?leatherArmor:\{vitality:2\}/);
assert.match(equipment,/Object\.values\(characterEquipment\)[\s\S]*?repairStarterWhiteStats\(item\)/);

assert.match(battle,/const open=!inBattle\(\)&&!!\(tab&&visible\(tab\)&&\(!shell\|\|visible\(shell\)\)\);/);
assert.match(animation,/stage\.className="v143-skill-stage";[\s\S]*?stage\.style\.visibility="visible";/);

assert.ok(loader.includes('const V_ASSET_VERSION="173.62";'));
assert.ok(index.includes('<title>四象江湖傳 V173.62</title>'));
console.log("✓ V173.62 inventory / patrol VFX / starter gear regressions");
''',encoding='utf-8')

print('V173.62 patch prepared')
