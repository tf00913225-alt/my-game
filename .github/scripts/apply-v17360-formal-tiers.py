from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old,new,1)


def replace_between(text,start_marker,end_marker,replacement,label):
    start=text.find(start_marker)
    if start<0:
        raise SystemExit(f"{label}: start marker not found")
    end=text.find(end_marker,start)
    if end<0:
        raise SystemExit(f"{label}: end marker not found")
    return text[:start]+replacement+text[end:]


# ---------------------------------------------------------------------------
# 1) Static item/content authority: formal tiers + two-stage talisman resolution
# ---------------------------------------------------------------------------
p="js/27-v132-content-expansion.js"
s=read(p)

old='''    const TIER_COLORS={\n        low:{main:"#8a9a8a",glow:"#c9d6c9"},\n        mid:{main:"#4a90d9",glow:"#9ecbf5"},\n        high:{main:"#a25fd9",glow:"#d9b3f5"},\n        perfect:{main:"#e8a93c",glow:"#ffe08a"}\n    };\n'''
new='''    const TIER_COLORS={\n        white:{main:"#D8D8D8",glow:"#F2F2F2"},\n        blue:{main:"#42A5FF",glow:"#7CC7FF"},\n        purple:{main:"#B05CFF",glow:"#D49BFF"},\n        orange:{main:"#FF9F38",glow:"#FFC46B"},\n        pink:{main:"#FF4FA7",glow:"#FF8CC7"},\n        "four-symbol":{main:"#E5C06B",glow:"#FFFFFF"}\n    };\n'''
s=replace_once(s,old,new,"v132 tier colors")

old='''    function oreIcon(tier){\n        const c=TIER_COLORS[tier]||TIER_COLORS.low;\n        return svgWrap(\n            '<polygon points="32,6 52,22 44,56 20,56 12,22" '+\n            'fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2.5"/>'+\n            '<polygon points="32,6 44,56 20,56" fill="'+c.glow+'" opacity="0.28"/>',\n            c.glow\n        );\n    }\n'''
new='''    function oreIcon(tier){\n        if(tier==="four-symbol"){\n            return svgWrap(\n                '<polygon points="32,6 52,22 44,56 20,56 12,22" fill="#181716" stroke="#f2dfb1" stroke-width="2.5"/>'+\n                '<path d="M32 6L52 22L32 32Z" fill="#FF5A36" opacity=".9"/>'+\n                '<path d="M52 22L44 56L32 32Z" fill="#42A5FF" opacity=".9"/>'+\n                '<path d="M44 56H20L32 32Z" fill="#47D6A3" opacity=".9"/>'+\n                '<path d="M20 56L12 22L32 32Z" fill="#C89B45" opacity=".9"/>',\n                "#FFFFFF"\n            );\n        }\n        const c=TIER_COLORS[tier]||TIER_COLORS.white;\n        return svgWrap(\n            '<polygon points="32,6 52,22 44,56 20,56 12,22" '+\n            'fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2.5"/>'+\n            '<polygon points="32,6 44,56 20,56" fill="'+c.glow+'" opacity="0.28"/>',\n            c.glow\n        );\n    }\n'''
s=replace_once(s,old,new,"v132 ore icon")
s=replace_once(s,'        const c=TIER_COLORS.mid;','        const c=TIER_COLORS.blue;',"v132 chest color")

start='''    /* =====================================================\n       2. 符咒（3種效果 × 4階，共12件）\n    ===================================================== */\n'''
end='''    /* =====================================================\n       5. 裝備套裝抽獎券（赤炎／寒泉／岩岳／青嵐）\n    ===================================================== */\n'''
replacement='''    /* =====================================================\n       2. 正式階級與符咒（符咒固定只到橙階）\n       - 舊 Low/Mid/High/Perfect 僅保留在穩定 id，兼容舊存檔。\n       - 正式 tierKey 一律使用 white/blue/purple/orange/pink/four-symbol。\n    ===================================================== */\n\n    const FORMAL_ITEM_TIERS=[\n        {key:"white",label:"白階",legacyKey:"low",idSuffix:"Low",available:true},\n        {key:"blue",label:"藍階",legacyKey:"mid",idSuffix:"Mid",available:true},\n        {key:"purple",label:"紫階",legacyKey:"high",idSuffix:"High",available:true},\n        {key:"orange",label:"橙階",legacyKey:"perfect",idSuffix:"Perfect",available:true},\n        {key:"pink",label:"桃紅階",legacyKey:null,idSuffix:"Pink",available:false,planned:true},\n        {key:"four-symbol",label:"四象階",legacyKey:null,idSuffix:"FourSymbol",available:false,planned:true}\n    ];\n    const TALISMAN_ACTIVATION_CHANCES=[35,55,75,100];\n    const TALISMAN_TIERS=FORMAL_ITEM_TIERS.slice(0,4).map((tier,index)=>\n        Object.assign({},tier,{chance:TALISMAN_ACTIVATION_CHANCES[index]})\n    );\n    const RESOURCE_TIERS=FORMAL_ITEM_TIERS.slice();\n\n    window.v17360FormalItemTiers=FORMAL_ITEM_TIERS.map(tier=>Object.assign({},tier));\n\n    const TALISMAN_EFFECTS=[\n        {key:"freeze",label:"冰封符",duration:4},\n        {key:"stealth",label:"隱身符",duration:2},\n        {key:"barrier",label:"結界符",duration:4}\n    ];\n\n    const talismanDefinitions=[];\n    TALISMAN_EFFECTS.forEach(effect=>{\n        TALISMAN_TIERS.forEach(tier=>{\n            talismanDefinitions.push({\n                // Stable legacy id is intentional: old saves and old drop pools keep resolving.\n                id:effect.key+"Talisman"+tier.idSuffix,\n                name:tier.label+effect.label,\n                icon:talismanIcon(effect.key,tier.key),\n                type:"talisman",\n                talismanEffect:effect.key,\n                talismanDuration:effect.duration,\n                tierChance:tier.chance,\n                tierKey:tier.key,\n                legacyTierKey:tier.legacyKey,\n                price:0,\n                stats:{}\n            });\n        });\n    });\n\n    function getTalismanDefinition(id){\n        return talismanDefinitions.find(def=>def.id===id)||null;\n    }\n    window.v132GetTalismanDefinition=getTalismanDefinition;\n\n\n    /* =====================================================\n       3. 礦石材料（正式六階；桃紅／四象先規劃、不進目前掉落）\n    ===================================================== */\n\n    const oreDefinitions=RESOURCE_TIERS.map(tier=>({\n        id:"ore"+tier.idSuffix,\n        name:tier.label+"礦石",\n        icon:oreIcon(tier.key),\n        type:"material",\n        tierKey:tier.key,\n        legacyTierKey:tier.legacyKey,\n        available:tier.available!==false,\n        planned:tier.planned===true,\n        price:0,\n        stats:{}\n    }));\n\n    function getOreDefinition(id){\n        return oreDefinitions.find(def=>def.id===id)||null;\n    }\n    function getOreDefinitionByTier(tierKey){\n        return oreDefinitions.find(def=>def.tierKey===tierKey)||null;\n    }\n    window.v132GetOreDefinitionByTier=getOreDefinitionByTier;\n\n\n    /* =====================================================\n       4. 裝備設計圖紙（5部位 × 正式六階 × 4系列）\n       桃紅／四象先建立資料結構；目前材料寶箱不會抽到。\n    ===================================================== */\n\n    const BLUEPRINT_SLOTS=[\n        {key:"head",label:"頭部"},\n        {key:"shoulder",label:"護腕"},\n        {key:"shoes",label:"鞋子"},\n        {key:"hand",label:"武器"},\n        {key:"armor",label:"衣服"}\n    ];\n\n    const BLUEPRINT_SERIES=[\n        {id:"setFire",label:"赤炎"},\n        {id:"setWater",label:"寒泉"},\n        {id:"setEarth",label:"岩岳"},\n        {id:"setWind",label:"青嵐"}\n    ];\n\n    const blueprintDefinitions=[];\n    BLUEPRINT_SLOTS.forEach(slot=>{\n        RESOURCE_TIERS.forEach(tier=>{\n            BLUEPRINT_SERIES.forEach(series=>{\n                blueprintDefinitions.push({\n                    id:"blueprint"+series.id.replace("set","")+slot.key.charAt(0).toUpperCase()+slot.key.slice(1)+tier.idSuffix,\n                    name:series.label+tier.label+slot.label+"設計圖",\n                    icon:blueprintIcon(slot.key,tier.key),\n                    type:"material",\n                    blueprintSlot:slot.key,\n                    tierKey:tier.key,\n                    legacyTierKey:tier.legacyKey,\n                    available:tier.available!==false,\n                    planned:tier.planned===true,\n                    setId:series.id,\n                    price:0,\n                    stats:{}\n                });\n            });\n        });\n    });\n\n    function getBlueprintDefinitionsByTier(tierKey){\n        return blueprintDefinitions.filter(def=>def.tierKey===tierKey);\n    }\n\n\n'''
s=replace_between(s,start,end,replacement,"v132 formal definitions")

old='''            "name","icon","type","price","setId","tierKey","blueprintSlot",\n            "talismanEffect","talismanDuration","tierChance"\n'''
new='''            "name","icon","type","price","setId","tierKey","legacyTierKey","available","planned","blueprintSlot",\n            "talismanEffect","talismanDuration","tierChance","sharedSkillId","talismanSkillLevel"\n'''
s=replace_once(s,old,new,"v132 hydration fields")

old='''    const CHEST_TIER_WEIGHTS=[\n        {key:"low",label:"低階",weight:40},\n        {key:"mid",label:"中階",weight:30},\n        {key:"high",label:"高階",weight:20},\n        {key:"perfect",label:"極品",weight:10}\n    ];\n'''
new='''    const CHEST_TIER_WEIGHTS=[\n        {key:"white",label:"白階",weight:40},\n        {key:"blue",label:"藍階",weight:30},\n        {key:"purple",label:"紫階",weight:20},\n        {key:"orange",label:"橙階",weight:10}\n    ];\n'''
s=replace_once(s,old,new,"v132 chest weights")
s=s.replace('getOreDefinition(\n                    "ore"+tier.key.charAt(0).toUpperCase()+tier.key.slice(1)\n                )','getOreDefinitionByTier(tier.key)')
s=s.replace('tier.key==="perfect" ? 5 : 10','tier.key==="orange" ? 5 : 10')
s=s.replace('const oreDef=getOreDefinition("ore"+oreTier.charAt(0).toUpperCase()+oreTier.slice(1));','const oreDef=getOreDefinitionByTier(oreTier);')
s=s.replace('const oreAmount=oreTier==="perfect" ? 5 : 10;','const oreAmount=oreTier==="orange" ? 5 : 10;')
s=s.replace('const blueprintAmount=blueprintTier==="perfect" ? 5 : 10;','const blueprintAmount=blueprintTier==="orange" ? 5 : 10;')

old='''    /* =====================================================\n       9. 符咒使用（戰鬥中消耗品，命中率＝階級機率＋角色\n          智力加成，依角色素質判定是否命中）\n    ===================================================== */\n\n    function getTalismanHitChance(definition,character){\n        const intelligence=(character && Number(character.intelligence))||0;\n        const bonus=Math.floor(intelligence/10);\n        return Math.min(100,Math.max(0,definition.tierChance+bonus));\n    }\n'''
new='''    /* =====================================================\n       9. 符咒使用：兩段判定\n       1) 階級只決定「畫符／生效啟動」機率：35/55/75/100%。\n       2) 畫符成功後，再以施放角色素質走對應滿級技能的命中規則。\n       橙階 100% 代表一定畫符成功，不代表控制／符術一定命中。\n    ===================================================== */\n\n    function getTalismanActivationChance(definition){\n        return Math.max(0,Math.min(100,Number(definition&&definition.tierChance)||0));\n    }\n\n    function getTalismanSharedSkill(definition){\n        if(!definition||typeof skillDatabase==="undefined"){ return null; }\n        const fallback={freeze:"freeze",stealth:"stealthSkill",barrier:"barrier"};\n        const skillId=definition.sharedSkillId||fallback[definition.talismanEffect];\n        return skillId?skillDatabase[skillId]||null:null;\n    }\n\n    function getTalismanCasterStats(characterIndex,character){\n        if(typeof getPartyBattleStats==="function"){\n            const stats=getPartyBattleStats(characterIndex);\n            if(stats){ return stats; }\n        }\n        if(characterIndex===0&&typeof getMainCharacterStats==="function"){\n            const stats=getMainCharacterStats();\n            if(stats){ return stats; }\n        }\n        return character||{};\n    }\n\n    function rollTalismanSkillHit(definition,characterIndex,targetMonster){\n        const character=getPartyCharacterByIndex(characterIndex);\n        if(!character){ return false; }\n        const stats=getTalismanCasterStats(characterIndex,character);\n        const skill=getTalismanSharedSkill(definition);\n        if(skill){\n            definition.talismanSkillLevel=Math.max(1,Math.floor(Number(skill.maxLevel)||1));\n        }\n\n        if(definition.talismanEffect==="freeze"&&targetMonster){\n            const baseChance=Math.max(0,Number(skill&&skill.freezeChance)||0);\n            const intelligence=Number(stats.intelligence!==undefined?stats.intelligence:character.intelligence)||0;\n            const targetSpirit=typeof getMonsterEffectiveSpiritPoints==="function"\n                ?Number(getMonsterEffectiveSpiritPoints(targetMonster))||0\n                :Number(targetMonster.spiritPoints||targetMonster.spirit)||0;\n            const rank=typeof getMonsterRank==="function"?getMonsterRank(targetMonster):"regular";\n            if(typeof rollStatusEffectHit==="function"){\n                return rollStatusEffectHit(\n                    baseChance,Number(character.level)||1,Number(targetMonster.level)||1,\n                    intelligence,targetSpirit,true,rank,0\n                );\n            }\n        }\n\n        // 隱身／結界是友方符術，不拿友軍閃避懲罰施放者；使用角色自身命中值。\n        const accuracy=Number(stats.accuracy);\n        if(Number.isFinite(accuracy)&&typeof rollHitChance==="function"){\n            return rollHitChance(accuracy,0,0);\n        }\n        const intelligence=Number(stats.intelligence!==undefined?stats.intelligence:character.intelligence)||0;\n        if(typeof rollStatusEffectHit==="function"){\n            return rollStatusEffectHit(100,Number(character.level)||1,Number(character.level)||1,intelligence,0,false,"regular",0);\n        }\n        return true;\n    }\n\n    window.v17360GetTalismanActivationChance=getTalismanActivationChance;\n    window.v17360RollTalismanSkillHit=rollTalismanSkillHit;\n'''
s=replace_once(s,old,new,"v132 talisman two-stage helpers")

old='''        const hitChance=getTalismanHitChance(definition,character);\n        const success=Math.random()*100<hitChance;\n\n        if(!success){\n            addBattleLog((character.id||"你")+"使用"+definition.name+"，畫符失敗！");\n            showMissEffect(true,characterIndex,"畫符失敗");\n            finishPlayerAction();\n            return;\n        }\n\n        if(definition.talismanEffect==="freeze"){\n'''
new='''        const activationChance=getTalismanActivationChance(definition);\n        if(Math.random()*100>=activationChance){\n            addBattleLog((character.id||"你")+"使用"+definition.name+"，畫符失敗！");\n            showMissEffect(true,characterIndex,"畫符失敗");\n            finishPlayerAction();\n            return;\n        }\n\n        if(!rollTalismanSkillHit(definition,characterIndex,targetMonster)){\n            if(definition.talismanEffect==="freeze"&&targetMonster){\n                addBattleLog(targetMonster.name+"抵抗了"+definition.name+"的冰封效果。");\n            }else{\n                addBattleLog((character.id||"你")+"的"+definition.name+"畫符成功，但符術未命中。");\n            }\n            showMissEffect(true,characterIndex,"MISS");\n            finishPlayerAction();\n            return;\n        }\n\n        if(definition.talismanEffect==="freeze"){\n'''
s=replace_once(s,old,new,"v132 talisman two-stage resolution")
write(p,s)


# ---------------------------------------------------------------------------
# 2) Synthesis/reforge authority: formal tiers, legacy alias support, future gates
# ---------------------------------------------------------------------------
p="js/36-v141-content-systems.js"
s=read(p)
start='''    const ABYSS_STORAGE_KEY="v141_abyss_state";\n'''
end='''    const SLOT_META={\n'''
replacement='''    const ABYSS_STORAGE_KEY="v141_abyss_state";\n    const TIER_ALIASES={low:"white",mid:"blue",high:"purple",perfect:"orange"};\n    const TIER_ORDER=["white","blue","purple","orange","pink","four-symbol"];\n    const TALISMAN_TIER_ORDER=["white","blue","purple","orange"];\n    const TIER_META={\n        white:{label:"白階",available:true,craftGold:500,reforgeGold:1000,main:[1,5],reforgeMain:[1,3]},\n        blue:{label:"藍階",available:true,craftGold:1500,reforgeGold:3000,main:[3,8],reforgeMain:[2,5]},\n        purple:{label:"紫階",available:true,craftGold:4000,reforgeGold:8000,main:[5,11],sub:[1,3],reforgeMain:[4,7],reforgeSub:[1,2]},\n        orange:{label:"橙階",available:true,craftGold:10000,reforgeGold:20000,main:[7,14],sub:[2,5],reforgeMain:[6,10],reforgeSub:[2,4]},\n        pink:{label:"桃紅階",available:false,planned:true},\n        "four-symbol":{label:"四象階",available:false,planned:true}\n    };\n    function normalizeTierKey(value){\n        const key=String(value||"").toLowerCase();\n        return TIER_ALIASES[key]||key;\n    }\n'''
s=replace_between(s,start,end,replacement,"v141 tier authority")
s=replace_once(s,'    const TALISMAN_GOLD={low:300,mid:1000,high:3000};','    const TALISMAN_GOLD={white:300,blue:1000,purple:3000};',"v141 talisman gold")
s=replace_once(s,'        reforgeMaterialTier:"low",lockedReforgeKeys:[],','        reforgeMaterialTier:"white",lockedReforgeKeys:[],',"v141 default reforge tier")

old='''    function reforgeMaterialInfo(tierKey){\n        const tier=TIER_META[tierKey]?tierKey:"low";\n        const meta=TIER_META[tier];\n        const ore=definitions().ores.find(item=>item.tierKey===tier)||null;\n        const blueprintCount=countMatching(item=>item&&item.blueprintSlot&&item.tierKey===tier);\n        const oreCount=ore?countItem(ore.id):0;\n        return {tier,meta,ore,blueprintCount,oreCount};\n    }\n'''
new='''    function reforgeMaterialInfo(tierKey){\n        const normalized=normalizeTierKey(tierKey);\n        const tier=TIER_META[normalized]?normalized:"white";\n        const meta=TIER_META[tier];\n        const ore=definitions().ores.find(item=>normalizeTierKey(item.tierKey)===tier)||null;\n        const blueprintCount=countMatching(item=>item&&item.blueprintSlot&&normalizeTierKey(item.tierKey)===tier);\n        const oreCount=ore?countItem(ore.id):0;\n        return {tier,meta,ore,blueprintCount,oreCount};\n    }\n'''
s=replace_once(s,old,new,"v141 reforge material info")

old='''    function inferTier(item){\n        if(item&&TIER_META[item.tierKey]){ return item.tierKey; }\n        if(item&&item.setId){ return "high"; }\n        const total=Object.values(item&&item.stats||{}).reduce((sum,value)=>sum+Math.abs(Number(value)||0),0);\n        if(total>=18){ return "perfect"; }\n        if(total>=10){ return "high"; }\n        if(total>=5){ return "mid"; }\n        return "low";\n    }\n'''
new='''    function inferTier(item){\n        const declared=normalizeTierKey(item&&item.tierKey);\n        if(TIER_META[declared]){ return declared; }\n        if(item&&item.setId){ return "orange"; }\n        const total=Object.values(item&&item.stats||{}).reduce((sum,value)=>sum+Math.abs(Number(value)||0),0);\n        if(total>=18){ return "orange"; }\n        if(total>=10){ return "purple"; }\n        if(total>=5){ return "blue"; }\n        return "white";\n    }\n'''
s=replace_once(s,old,new,"v141 infer tier")

s=replace_once(s,'        const meta=TIER_META[tierKey];\n        const mainRange=isReforge?meta.reforgeMain:meta.main;','        const tier=normalizeTierKey(tierKey);\n        const meta=TIER_META[tier];\n        if(!meta||meta.available===false||!Array.isArray(meta.main)){ throw new Error("此階級尚未開放數值設定："+tier); }\n        const mainRange=isReforge?meta.reforgeMain:meta.main;',"v141 roll affixes tier")

old='''    function reforgeRangeForSlot(tierKey,slotIndex){\n        const meta=TIER_META[tierKey]||TIER_META.low;\n        if(slotIndex<=0){ return meta.reforgeMain; }\n        return meta.reforgeSub||meta.reforgeMain;\n    }\n    function reforgeRangeText(tierKey,slotCount){\n        const meta=TIER_META[tierKey]||TIER_META.low;\n        const main=meta.reforgeMain;\n        const sub=meta.reforgeSub||meta.reforgeMain;\n        return slotCount<=1\n            ?"詞條 "+main[0]+"～"+main[1]\n            :"主槽 "+main[0]+"～"+main[1]+"・其餘槽 "+sub[0]+"～"+sub[1];\n    }\n'''
new='''    function reforgeRangeForSlot(tierKey,slotIndex){\n        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;\n        if(meta.available===false||!Array.isArray(meta.reforgeMain)){ return null; }\n        if(slotIndex<=0){ return meta.reforgeMain; }\n        return meta.reforgeSub||meta.reforgeMain;\n    }\n    function reforgeRangeText(tierKey,slotCount){\n        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;\n        if(meta.available===false||!Array.isArray(meta.reforgeMain)){ return "尚未開放・數值待定"; }\n        const main=meta.reforgeMain;\n        const sub=meta.reforgeSub||meta.reforgeMain;\n        return slotCount<=1\n            ?"詞條 "+main[0]+"～"+main[1]\n            :"主槽 "+main[0]+"～"+main[1]+"・其餘槽 "+sub[0]+"～"+sub[1];\n    }\n'''
s=replace_once(s,old,new,"v141 reforge ranges")

s=replace_once(s,'        const meta=TIER_META[tierKey]||TIER_META.low;\n        const unlockedCount=','        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;\n        if(meta.available===false){ throw new Error("此階級冶煉尚未開放"); }\n        const unlockedCount=',"v141 roll reforge meta")

old='''    function rangeText(tierKey,isReforge){\n        const meta=TIER_META[tierKey];\n        const main=isReforge?meta.reforgeMain:meta.main;\n        const sub=isReforge?meta.reforgeSub:meta.sub;\n        return '主詞條 '+main[0]+'～'+main[1]+(sub?'・副詞條 '+sub[0]+'～'+sub[1]:'');\n    }\n'''
new='''    function rangeText(tierKey,isReforge){\n        const meta=TIER_META[normalizeTierKey(tierKey)];\n        if(!meta||meta.available===false){ return "尚未開放・數值待定"; }\n        const main=isReforge?meta.reforgeMain:meta.main;\n        const sub=isReforge?meta.reforgeSub:meta.sub;\n        return '主詞條 '+main[0]+'～'+main[1]+(sub?'・副詞條 '+sub[0]+'～'+sub[1]:'');\n    }\n'''
s=replace_once(s,old,new,"v141 range text")

old='''        inventoryItems.forEach(item=>{\n            if(!item||!item.blueprintSlot||!TIER_META[item.tierKey]){ return; }\n            if(!byId.has(item.id)){ byId.set(item.id,item); }\n        });\n'''
new='''        inventoryItems.forEach(item=>{\n            if(!item||!item.blueprintSlot){ return; }\n            const tier=normalizeTierKey(item.tierKey);\n            if(!TIER_META[tier]||TIER_META[tier].available===false){ return; }\n            item.tierKey=tier;\n            if(!byId.has(item.id)){ byId.set(item.id,item); }\n        });\n'''
s=replace_once(s,old,new,"v141 held blueprints")

s=replace_once(s,'        const tier=blueprint.tierKey;\n        const meta=TIER_META[tier];','        const tier=normalizeTierKey(blueprint.tierKey);\n        const meta=TIER_META[tier];',"v141 craft render normalize")

old='''        const tier=TIER_META[synthesisState.reforgeMaterialTier]?synthesisState.reforgeMaterialTier:"low";\n        synthesisState.reforgeMaterialTier=tier;\n'''
new='''        const requestedTier=normalizeTierKey(synthesisState.reforgeMaterialTier);\n        const tier=TIER_META[requestedTier]&&TIER_META[requestedTier].available!==false?requestedTier:"white";\n        synthesisState.reforgeMaterialTier=tier;\n'''
s=replace_once(s,old,new,"v141 render reforge selected tier")

old='''        const can=!!material.ore&&material.blueprintCount>=materialCost&&material.oreCount>=materialCost&&gold>=material.meta.reforgeGold&&slotCount>locks.length;\n'''
new='''        const can=material.meta.available!==false&&!!material.ore&&material.blueprintCount>=materialCost&&material.oreCount>=materialCost&&gold>=material.meta.reforgeGold&&slotCount>locks.length;\n'''
s=replace_once(s,old,new,"v141 render reforge can")

old='''        const tierButtons=TIER_ORDER.map(key=>{\n            const info=reforgeMaterialInfo(key);\n            return '<button type="button" class="v17358-reforge-tier '+(key===tier?'active':'')+'" onclick="v141SelectReforgeMaterialTier(\\''+key+'\\')">'+\n                '<b>'+info.meta.label+'材料</b><span>圖紙 '+info.blueprintCount+'・礦石 '+info.oreCount+'</span><small>'+reforgeRangeText(key,slotCount)+'</small></button>';\n        }).join("");\n'''
new='''        const tierButtons=TIER_ORDER.map(key=>{\n            const info=reforgeMaterialInfo(key);\n            const unavailable=info.meta.available===false;\n            return '<button type="button" class="v17358-reforge-tier '+(key===tier?'active ':'')+(unavailable?'planned':'')+'" '+\n                (unavailable?'disabled aria-disabled="true"':'onclick="v141SelectReforgeMaterialTier(\\''+key+'\\')"')+'>'+\n                '<b>'+info.meta.label+'材料</b><span>'+(unavailable?'尚未開放':'圖紙 '+info.blueprintCount+'・礦石 '+info.oreCount)+'</span><small>'+reforgeRangeText(key,slotCount)+'</small></button>';\n        }).join("");\n'''
s=replace_once(s,old,new,"v141 reforge tier buttons")

old='''    function availableTalismans(){\n        return definitions().talismans.filter(item=>item.tierKey!=="perfect"&&countItem(item.id)>0);\n    }\n    function nextTalisman(source){\n        if(!source){ return null; }\n        const nextTier=TIER_ORDER[TIER_ORDER.indexOf(source.tierKey)+1];\n        return definitions().talismans.find(item=>item.talismanEffect===source.talismanEffect&&item.tierKey===nextTier)||null;\n    }\n'''
new='''    function availableTalismans(){\n        return definitions().talismans.filter(item=>TALISMAN_TIER_ORDER.slice(0,3).includes(normalizeTierKey(item.tierKey))&&countItem(item.id)>0);\n    }\n    function nextTalisman(source){\n        if(!source){ return null; }\n        const sourceTier=normalizeTierKey(source.tierKey);\n        const nextTier=TALISMAN_TIER_ORDER[TALISMAN_TIER_ORDER.indexOf(sourceTier)+1];\n        return definitions().talismans.find(item=>item.talismanEffect===source.talismanEffect&&normalizeTierKey(item.tierKey)===nextTier)||null;\n    }\n'''
s=replace_once(s,old,new,"v141 talisman order")
s=s.replace('沒有可升階的低／中／高階符咒。','沒有可升階的白／藍／紫階符咒。')

old='''    window.v141SelectReforgeMaterialTier=function(tier){\n        if(!TIER_META[tier]||synthesisState.pendingReforge){ return; }\n        synthesisState.reforgeMaterialTier=tier;\n        renderSynthesis();\n    };\n'''
new='''    window.v141SelectReforgeMaterialTier=function(tier){\n        const normalized=normalizeTierKey(tier);\n        if(!TIER_META[normalized]||TIER_META[normalized].available===false||synthesisState.pendingReforge){ return; }\n        synthesisState.reforgeMaterialTier=normalized;\n        renderSynthesis();\n    };\n'''
s=replace_once(s,old,new,"v141 select material tier")

old='''    window.v141ShowAffixInfo=function(){\n        const lines=TIER_ORDER.map(tier=>'<div><b>'+TIER_META[tier].label+'材料</b>　'+reforgeRangeText(tier,2)+'　／　金幣 '+TIER_META[tier].reforgeGold.toLocaleString('zh-TW')+'</div>').join('');\n        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>冶煉規則</h3><p>裝備品質不限制材料階級。選用哪一階材料，本次重洗就使用哪一階的數值範圍。</p>'+lines+'<p>每次會重洗所有未鎖定的冶煉槽；已鎖定詞條保持原數值。冶煉次數不限。</p><p>消耗：未鎖定 50 張設計圖＋50 礦石；鎖 1 條各 100；鎖 2 條各 150。最多鎖 2 條，且至少保留 1 個槽位重洗。</p><p>單槽最高值固定10%；具副詞條範圍的材料，雙詞條同時最高固定5%。</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">返回</button></div></div>');\n    };\n'''
new='''    window.v141ShowAffixInfo=function(){\n        const lines=TIER_ORDER.map(tier=>{\n            const meta=TIER_META[tier];\n            const cost=meta.available===false?'尚未開放・數值待定':'金幣 '+meta.reforgeGold.toLocaleString('zh-TW');\n            return '<div><b>'+meta.label+'材料</b>　'+reforgeRangeText(tier,2)+'　／　'+cost+'</div>';\n        }).join('');\n        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>冶煉規則</h3><p>裝備品質不限制材料階級。選用哪一階材料，本次重洗就使用哪一階的數值範圍。</p>'+lines+'<p>桃紅階、四象階已預留正式階級，但目前不開放數值與取得來源。</p><p>每次會重洗所有未鎖定的冶煉槽；已鎖定詞條保持原數值。冶煉次數不限。</p><p>消耗：未鎖定 50 張設計圖＋50 礦石；鎖 1 條各 100；鎖 2 條各 150。最多鎖 2 條，且至少保留 1 個槽位重洗。</p><p>單槽最高值固定10%；具副詞條範圍的材料，雙詞條同時最高固定5%。</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">返回</button></div></div>');\n    };\n'''
s=replace_once(s,old,new,"v141 affix info")

# Two occurrences: legacy craft path and reforge start path.
s=s.replace('        const tier=blueprint.tierKey;\n        const meta=TIER_META[tier];','        const tier=normalizeTierKey(blueprint.tierKey);\n        const meta=TIER_META[tier];',1)

old='''        const tier=TIER_META[synthesisState.reforgeMaterialTier]?synthesisState.reforgeMaterialTier:"low";\n        const info=reforgeMaterialInfo(tier);\n'''
new='''        const tier=normalizeTierKey(synthesisState.reforgeMaterialTier);\n        const info=reforgeMaterialInfo(tier);\n        if(!info.meta||info.meta.available===false){ alert("此材料階級尚未開放。"); return; }\n'''
s=replace_once(s,old,new,"v141 start reforge tier")
write(p,s)


# ---------------------------------------------------------------------------
# 3) Historical compatibility crafting seam: understand formal tier keys
# ---------------------------------------------------------------------------
p="js/38-v143-system-fixes.js"
s=read(p)
old='''    const TIER_META={\n        low:{label:"低階",craftGold:500,main:[1,5],color:"#b88b58"},\n        mid:{label:"中階",craftGold:1500,main:[3,8],color:"#5fb7df"},\n        high:{label:"高階",craftGold:4000,main:[5,11],sub:[1,3],color:"#b788ed"},\n        perfect:{label:"極品",craftGold:10000,main:[7,14],sub:[2,5],color:"#f0c35b"}\n    };\n'''
new='''    const TIER_ALIASES={low:"white",mid:"blue",high:"purple",perfect:"orange"};\n    const TIER_META={\n        white:{label:"白階",available:true,craftGold:500,main:[1,5],color:"#D8D8D8"},\n        blue:{label:"藍階",available:true,craftGold:1500,main:[3,8],color:"#42A5FF"},\n        purple:{label:"紫階",available:true,craftGold:4000,main:[5,11],sub:[1,3],color:"#B05CFF"},\n        orange:{label:"橙階",available:true,craftGold:10000,main:[7,14],sub:[2,5],color:"#FF9F38"},\n        pink:{label:"桃紅階",available:false,planned:true,color:"#FF4FA7"},\n        "four-symbol":{label:"四象階",available:false,planned:true,color:"#E5C06B"}\n    };\n    function normalizeTierKey(value){\n        const key=String(value||"").toLowerCase();\n        return TIER_ALIASES[key]||key;\n    }\n'''
s=replace_once(s,old,new,"v143 compatibility tiers")
s=s.replace('TIER_META[tier]','TIER_META[normalizeTierKey(tier)]')
s=s.replace('        const tier=blueprint.tierKey;','        const tier=normalizeTierKey(blueprint.tierKey);')
s=s.replace('        if(!meta||!ore||countItem(blueprint.id)<50','        if(!meta||meta.available===false||!ore||countItem(blueprint.id)<50')
write(p,s)


# ---------------------------------------------------------------------------
# 4) Equipment progression owner: six-tier registry, future tiers inactive
# ---------------------------------------------------------------------------
p="js/equipment-progression.js"
s=read(p)
old='''    const RARITIES=[\n        {key:"white",label:"白裝",chance:40,min:1,max:3,reforgeSlots:0,shopPrice:500,color:"#d8d8d8"},\n        {key:"blue",label:"藍裝",chance:40,min:4,max:6,reforgeSlots:0,shopPrice:1500,color:"#42a5ff"},\n        {key:"purple",label:"紫裝",chance:15,min:7,max:9,reforgeSlots:1,shopPrice:4000,color:"#b05cff"},\n        {key:"orange",label:"橙裝",chance:5,min:10,max:12,reforgeSlots:1,shopPrice:10000,color:"#ff9f38"}\n    ];\n'''
new='''    const RARITIES=[\n        {key:"white",label:"白階",chance:40,min:1,max:3,reforgeSlots:0,shopPrice:500,color:"#D8D8D8",available:true},\n        {key:"blue",label:"藍階",chance:40,min:4,max:6,reforgeSlots:0,shopPrice:1500,color:"#42A5FF",available:true},\n        {key:"purple",label:"紫階",chance:15,min:7,max:9,reforgeSlots:1,shopPrice:4000,color:"#B05CFF",available:true},\n        {key:"orange",label:"橙階",chance:5,min:10,max:12,reforgeSlots:1,shopPrice:10000,color:"#FF9F38",available:true},\n        {key:"pink",label:"桃紅階",chance:0,available:false,planned:true,color:"#FF4FA7"},\n        {key:"four-symbol",label:"四象階",chance:0,available:false,planned:true,fourSymbol:true,color:null}\n    ];\n'''
s=replace_once(s,old,new,"equipment formal rarities")
old='''    function generateEquipment(random=Math.random,forced={}){\n        const rarity=forced.rarity?RARITY_BY_KEY[forced.rarity]||rarityFromRandom(random):rarityFromRandom(random);\n'''
new='''    function generateEquipment(random=Math.random,forced={}){\n        const forcedRarity=forced.rarity?RARITY_BY_KEY[forced.rarity]:null;\n        const rarity=forcedRarity&&forcedRarity.available!==false?forcedRarity:rarityFromRandom(random);\n'''
s=replace_once(s,old,new,"equipment generation future gate")
s=s.replace('白裝40%・藍裝40%・紫裝15%・橙裝5%','白階40%・藍階40%・紫階15%・橙階5%')
old='''.v17346-rarity-white{border:2px solid #d8d8d8!important;box-shadow:0 0 7px rgba(216,216,216,.55)!important}\n.v17346-rarity-blue{border:2px solid #42a5ff!important;box-shadow:0 0 9px rgba(66,165,255,.7)!important}\n.v17346-rarity-purple{border:2px solid #b05cff!important;box-shadow:0 0 10px rgba(176,92,255,.75)!important}\n.v17346-rarity-orange{border:3px solid #ff8a1f!important;box-shadow:0 0 5px #ff7a16,0 0 14px rgba(255,136,31,.95),inset 0 0 8px rgba(255,159,56,.3)!important}\n'''
new='''.v17346-rarity-white{border:2px solid #D8D8D8!important;box-shadow:0 0 7px rgba(216,216,216,.55)!important}\n.v17346-rarity-blue{border:2px solid #42A5FF!important;box-shadow:0 0 9px rgba(66,165,255,.7)!important}\n.v17346-rarity-purple{border:2px solid #B05CFF!important;box-shadow:0 0 10px rgba(176,92,255,.75)!important}\n.v17346-rarity-orange{border:3px solid #FF9F38!important;box-shadow:0 0 5px #FF9F38,0 0 14px rgba(255,159,56,.9),inset 0 0 8px rgba(255,159,56,.3)!important}\n.v17346-rarity-pink{border:3px solid #FF4FA7!important;box-shadow:0 0 6px #FF4FA7,0 0 16px rgba(255,79,167,.88),inset 0 0 9px rgba(255,79,167,.42)!important}\n.v17346-rarity-four-symbol{border:3px solid transparent!important;background:linear-gradient(#090807,#090807) padding-box,conic-gradient(from 0deg,#42A5FF 0 25%,#47D6A3 25% 50%,#C89B45 50% 75%,#FF5A36 75% 100%) border-box!important;box-shadow:0 0 8px rgba(255,90,54,.34),0 0 12px rgba(66,165,255,.32),0 0 16px rgba(71,214,163,.26)!important;animation:v17360FourSymbolRarityBreath 2.8s ease-in-out infinite!important}\n@keyframes v17360FourSymbolRarityBreath{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.14)}}\n'''
s=replace_once(s,old,new,"equipment rarity styles")
s=s.replace('js/equipment-progression.js?v=173.58','js/equipment-progression.js?v=173.60')
s=s.replace('css/52-v173.50-inventory-qol.css?v=173.58','css/52-v173.50-inventory-qol.css?v=173.60')
s=s.replace('js/53-v173.50-inventory-qol.js?v=173.58','js/53-v173.50-inventory-qol.js?v=173.60')
write(p,s)


# ---------------------------------------------------------------------------
# 5) Inventory quality recognition and future bulk-sell support
# ---------------------------------------------------------------------------
p="js/53-v173.50-inventory-qol.js"
s=read(p)
s=replace_once(s,'    const QUALITY_ORDER=["white","blue","purple","orange"];','    const QUALITY_ORDER=["white","blue","purple","orange","pink","four-symbol"];',"inventory quality order")
s=replace_once(s,'    const QUALITY_LABEL={white:"白裝",blue:"藍裝",purple:"紫裝",orange:"橙裝"};','    const QUALITY_LABEL={white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"};',"inventory quality labels")
s=replace_once(s,'    const TIER_TO_QUALITY={low:"white",mid:"blue",high:"purple",perfect:"orange"};','    const TIER_TO_QUALITY={white:"white",blue:"blue",purple:"purple",orange:"orange",pink:"pink","four-symbol":"four-symbol",low:"white",mid:"blue",high:"purple",perfect:"orange"};',"inventory legacy tier mapping")
s=s.replace('<option value="white">白裝以下</option>','<option value="white">白階以下</option>')
s=s.replace('<option value="blue">藍裝以下</option>','<option value="blue">藍階以下</option>')
s=s.replace('<option value="purple">紫裝以下</option>','<option value="purple">紫階以下</option>')
s=s.replace('<option value="orange">橙裝以下</option>','<option value="orange">橙階以下</option>\' +\n                    \'<option value="pink">桃紅階以下</option>\' +\n                    \'<option value="four-symbol">四象階以下</option>')
s=s.replace('這次一鍵售出包含橙裝。','這次一鍵售出包含橙階以上裝備。')
s=s.replace('橙裝售出後無法復原','高階裝備售出後無法復原')
write(p,s)


# ---------------------------------------------------------------------------
# 6) Shared rarity visual layer: formal six colors + legacy aliases
# ---------------------------------------------------------------------------
p="css/50-v169-abyss-flow.css"
s=read(p)
old='''.v169-talisman-art.v169-rarity-low,.v169-blueprint-art.v169-rarity-low{border-color:#3ba7ff;box-shadow:0 0 5px #3ba7ff,0 0 12px rgba(59,167,255,.72),inset 0 0 7px rgba(59,167,255,.38);}\n.v169-talisman-art.v169-rarity-mid,.v169-blueprint-art.v169-rarity-mid{border-color:#a855f7;box-shadow:0 0 5px #a855f7,0 0 13px rgba(168,85,247,.76),inset 0 0 7px rgba(168,85,247,.4);}\n.v169-talisman-art.v169-rarity-high,.v169-blueprint-art.v169-rarity-high{border-color:#ff9f38;box-shadow:0 0 6px #ff9f38,0 0 14px rgba(255,159,56,.8),inset 0 0 8px rgba(255,159,56,.42);}\n.v169-talisman-art.v169-rarity-perfect,.v169-blueprint-art.v169-rarity-perfect{border-color:#ff4fa7;box-shadow:0 0 7px #ff4fa7,0 0 16px rgba(255,79,167,.88),inset 0 0 9px rgba(255,79,167,.48);}\n'''
new='''.v169-talisman-art.v169-rarity-white,.v169-blueprint-art.v169-rarity-white,.v169-talisman-art.v169-rarity-low,.v169-blueprint-art.v169-rarity-low{border-color:#D8D8D8;box-shadow:0 0 5px rgba(216,216,216,.7),inset 0 0 6px rgba(216,216,216,.24);}\n.v169-talisman-art.v169-rarity-blue,.v169-blueprint-art.v169-rarity-blue,.v169-talisman-art.v169-rarity-mid,.v169-blueprint-art.v169-rarity-mid{border-color:#42A5FF;box-shadow:0 0 5px #42A5FF,0 0 12px rgba(66,165,255,.72),inset 0 0 7px rgba(66,165,255,.38);}\n.v169-talisman-art.v169-rarity-purple,.v169-blueprint-art.v169-rarity-purple,.v169-talisman-art.v169-rarity-high,.v169-blueprint-art.v169-rarity-high{border-color:#B05CFF;box-shadow:0 0 5px #B05CFF,0 0 13px rgba(176,92,255,.76),inset 0 0 7px rgba(176,92,255,.4);}\n.v169-talisman-art.v169-rarity-orange,.v169-blueprint-art.v169-rarity-orange,.v169-talisman-art.v169-rarity-perfect,.v169-blueprint-art.v169-rarity-perfect{border-color:#FF9F38;box-shadow:0 0 6px #FF9F38,0 0 14px rgba(255,159,56,.8),inset 0 0 8px rgba(255,159,56,.42);}\n.v169-talisman-art.v169-rarity-pink,.v169-blueprint-art.v169-rarity-pink{border-color:#FF4FA7;box-shadow:0 0 7px #FF4FA7,0 0 16px rgba(255,79,167,.88),inset 0 0 9px rgba(255,79,167,.48);}\n.v169-talisman-art.v169-rarity-four-symbol,.v169-blueprint-art.v169-rarity-four-symbol{border:2px solid transparent;background:linear-gradient(#090b0f,#090b0f) padding-box,conic-gradient(from 0deg,#42A5FF 0 25%,#47D6A3 25% 50%,#C89B45 50% 75%,#FF5A36 75% 100%) border-box;box-shadow:0 0 8px rgba(255,90,54,.28),0 0 12px rgba(66,165,255,.28),0 0 14px rgba(71,214,163,.24);animation:v169FourSymbolRarityBreath 2.8s ease-in-out infinite;}\n@keyframes v169FourSymbolRarityBreath{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.14)}}\n'''
s=replace_once(s,old,new,"shared rarity css")
write(p,s)


# ---------------------------------------------------------------------------
# 7) Existing late skill sync points: explicit max-level talisman metadata
# ---------------------------------------------------------------------------
p="js/33-v140-four-element-balance.js"
s=read(p)
s=s.replace('階級命中率仍是符咒自己的屬性。','階級機率只負責畫符啟動；畫符成功後再依角色素質套用對應技能命中規則。')
s=replace_once(s,'                definition.sharedSkillId=effect.skillId;\n                if(effect.duration>0){','                definition.sharedSkillId=effect.skillId;\n                definition.talismanSkillLevel=Math.max(1,numeric(skillDatabase[effect.skillId]&&skillDatabase[effect.skillId].maxLevel)||1);\n                if(effect.duration>0){',"v140 talisman max level sync")
write(p,s)

p="js/50-v169-water-skill-rules.js"
s=read(p)
s=s.replace('                freezeTalisman.sharedSkillId="freeze";\n                freezeTalisman.talismanDuration=', '                freezeTalisman.sharedSkillId="freeze";\n                freezeTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.freeze.maxLevel)||1);\n                freezeTalisman.talismanDuration=')
s=s.replace('                stealthTalisman.sharedSkillId="stealthSkill";\n                stealthTalisman.talismanDuration=', '                stealthTalisman.sharedSkillId="stealthSkill";\n                stealthTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.stealthSkill.maxLevel)||1);\n                stealthTalisman.talismanDuration=')
s=s.replace('                barrierTalisman.sharedSkillId="barrier";\n                barrierTalisman.talismanDuration=', '                barrierTalisman.sharedSkillId="barrier";\n                barrierTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.barrier.maxLevel)||1);\n                barrierTalisman.talismanDuration=')
write(p,s)


# ---------------------------------------------------------------------------
# 8) Permanent rarity spec: six-tier default, four-tier talisman exception
# ---------------------------------------------------------------------------
p="docs/ITEM_RARITY_UI_SPEC.md"
s=read(p)
s=replace_once(s,'所有裝備、材料、設計圖、礦石、符咒、寶箱與其他可分階級道具，全部統一使用這套階級。','所有裝備、材料、設計圖、礦石、寶箱與其他一般可分階級道具，全部統一使用這套六階。\n\n**符咒為唯一明確例外：冰封符、隱身符、結界符只使用白階、藍階、紫階、橙階，不設桃紅階與四象階符咒。** 符咒四階仍必須使用本文件對應的白／藍／紫／橙色彩與階級名稱。',"rarity spec talisman exception")
s=replace_once(s,'**白、藍、紫、橙、桃紅、四象**\n\n這六階制度。','**白、藍、紫、橙、桃紅、四象**\n\n這六階制度。\n\n符咒依專案正式規則只開放 **白、藍、紫、橙** 四階；這是內容階級上限的例外，不是另一套顏色或命名制度。',"rarity spec system exception")
write(p,s)


# ---------------------------------------------------------------------------
# 9) Version wiring. Keep historical v17358 class names/comments intact.
# ---------------------------------------------------------------------------
p="index.html"
s=read(p)
s=s.replace('V173.58','V173.60').replace('173.58','173.60')
write(p,s)

p="js/20-anonymous-20.js"
s=read(p)
s=s.replace('dataset.runtimeReady="173.58"','dataset.runtimeReady="173.60"')
s=s.replace('const V_ASSET_VERSION="173.58";','const V_ASSET_VERSION="173.60";')
write(p,s)

p="js/51-v169-rpg-ui.js"
s=read(p)
s=s.replace('js/equipment-progression.js?v=173.58','js/equipment-progression.js?v=173.60')
write(p,s)

# Update existing version-sensitive tests without touching historical v17358 class names.
for path in Path("tests").glob("*.js"):
    text=path.read_text(encoding="utf-8")
    changed=text.replace('173\\.58','173\\.60').replace('173.58','173.60')
    if changed!=text:
        path.write_text(changed,encoding="utf-8")

# Update the V173.46 expectations to formal names and future tier registry.
p="tests/v173.46-equipment-progression.test.js"
s=read(p)
s=s.replace('label:"白裝"','label:"白階"').replace('label:"藍裝"','label:"藍階"').replace('label:"紫裝"','label:"紫階"').replace('label:"橙裝"','label:"橙階"')
s=s.replace('白裝40%・藍裝40%・紫裝15%・橙裝5%','白階40%・藍階40%・紫階15%・橙階5%')
write(p,s)

# New V173.60 regression coverage.
Path("tests/v173.60-formal-tiers-talismans.test.js").write_text(r'''"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const content=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const rarityCss=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");
const spec=fs.readFileSync("docs/ITEM_RARITY_UI_SPEC.md","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const html=fs.readFileSync("index.html","utf8");

test("formal item tiers are six, while talismans stop at orange",()=>{
  for(const [key,label] of [["white","白階"],["blue","藍階"],["purple","紫階"],["orange","橙階"],["pink","桃紅階"],["four-symbol","四象階"]]){
    assert.ok(content.includes(`key:"${key}",label:"${label}"`),key);
    assert.ok(synthesis.includes(`${key==="four-symbol"?'"four-symbol"':key}:`),key);
  }
  assert.match(content,/TALISMAN_ACTIVATION_CHANCES=\[35,55,75,100\]/);
  assert.match(content,/TALISMAN_TIERS=FORMAL_ITEM_TIERS\.slice\(0,4\)/);
  assert.match(spec,/符咒為唯一明確例外/);
});

test("legacy item ids survive while player-facing tierKey is formal",()=>{
  assert.match(content,/id:effect\.key\+"Talisman"\+tier\.idSuffix/);
  assert.match(content,/legacyKey:"low",idSuffix:"Low"/);
  assert.match(content,/legacyKey:"perfect",idSuffix:"Perfect"/);
  assert.match(synthesis,/TIER_ALIASES=\{low:"white",mid:"blue",high:"purple",perfect:"orange"\}/);
  assert.match(qol,/low:"white",mid:"blue",high:"purple",perfect:"orange"/);
});

test("talisman resolution is two stage and max-skill aware",()=>{
  assert.match(content,/getTalismanActivationChance/);
  assert.match(content,/Math\.random\(\)\*100>=activationChance/);
  assert.match(content,/畫符失敗/);
  assert.match(content,/rollTalismanSkillHit/);
  assert.match(content,/rollStatusEffectHit/);
  assert.match(content,/definition\.talismanSkillLevel=Math\.max/);
  assert.doesNotMatch(content,/definition\.tierChance\+bonus/);
});

test("pink and four-symbol are planned but not silently injected into current drops",()=>{
  assert.match(equipment,/key:"pink",label:"桃紅階",chance:0,available:false,planned:true/);
  assert.match(equipment,/key:"four-symbol",label:"四象階",chance:0,available:false,planned:true/);
  const chest=content.match(/const CHEST_TIER_WEIGHTS=\[([\s\S]*?)\];/)[1];
  assert.ok(chest.includes('key:"white"')&&chest.includes('key:"orange"'));
  assert.ok(!chest.includes('key:"pink"')&&!chest.includes('key:"four-symbol"'));
  assert.match(synthesis,/尚未開放・數值待定/);
});

test("rarity visuals use the locked palette and four-symbol border",()=>{
  for(const hex of ["#D8D8D8","#42A5FF","#B05CFF","#FF9F38","#FF4FA7","#FF5A36","#47D6A3","#C89B45"]){
    assert.ok(rarityCss.includes(hex),hex);
  }
  assert.match(rarityCss,/v169-rarity-four-symbol/);
  assert.match(rarityCss,/2\.8s ease-in-out infinite/);
});

test("release wiring is V173.60",()=>{
  assert.ok(loader.includes('const V_ASSET_VERSION="173.60";'));
  assert.ok(html.includes("四象江湖傳 V173.60"));
});
''',encoding="utf-8")

# Handoff: record the authoritative owner decisions and no temporary runtime layer.
p="HANDOFF.md"
s=read(p)
entry='''\n## V173.60 正式物品階級／符咒判定重構（目前 dev）\n- 正式一般物品階級統一為：白階（white）→藍階（blue）→紫階（purple）→橙階（orange）→桃紅階（pink）→四象階（four-symbol）；固定色號依 `docs/ITEM_RARITY_UI_SPEC.md`。\n- 符咒為正式例外：冰封符／隱身符／結界符只到白、藍、紫、橙四階；畫符啟動率固定 35%／55%／75%／100%。舊 `*TalismanLow/Mid/High/Perfect` id 保留只為舊存檔／舊掉落相容，玩家資料 `tierKey` 與名稱改為正式階級。\n- 符咒改為兩段判定：先以符咒階級擲「畫符」；失敗固定顯示「畫符失敗」。成功後再用施放角色素質走對應滿級技能命中規則；橙階 100% 不等於控制／符術必中。\n- `js/27-v132-content-expansion.js` 是符咒／礦石／設計圖與符咒結算 owner；`js/36-v141-content-systems.js` 是合成／冶煉階級數值 owner；`js/equipment-progression.js` 是普通裝備品質／生成 owner。`js/33` 與 `js/50` 僅保留既有技能資料晚覆蓋同步，不新增第三層 runtime。\n- 礦石、設計圖、裝備資料結構已預留桃紅與四象；本輪不擅自設定尚未提供的高階數值／價格／掉落來源，因此兩階目前 `available:false`、普通裝備掉落 chance=0，材料寶箱仍只出白／藍／紫／橙。\n- 舊 `low/mid/high/perfect` 僅作資料兼容映射為 white/blue/purple/orange，不再作玩家可見正式階級。\n- 版本與快取同步 V173.60；僅修改 dev，main 不動。\n\n'''
s=entry+s.lstrip("\n")
write(p,s)

print("V173.60 formal tier migration patch applied")
