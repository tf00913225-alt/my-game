from pathlib import Path
import re


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)

# ---------------------------------------------------------
# Core: beginner forest monster data, 10-15 normal hits,
# and the two patrol fight frames displayed +90deg clockwise.
# ---------------------------------------------------------
p=Path('js/00-main.js')
s=p.read_text()

old='''const forestMonsters = [\n\n    makeZoneMonster("哥布林",3,"fire"),\n    makeZoneMonster("史萊姆",2,"water"),\n    makeZoneMonster("哥布林",3,"fire"),\n    makeZoneMonster("史萊姆",2,"water"),\n    makeZoneMonster("哥布林",3,"fire"),\n    makeZoneMonster("史萊姆",2,"water")\n\n];'''
new='''const BEGINNER_FOREST_NORMAL_DAMAGE_MIN=10;\nconst BEGINNER_FOREST_NORMAL_DAMAGE_MAX=15;\n\nfunction rollBeginnerForestNormalAttackDamage(){\n    return BEGINNER_FOREST_NORMAL_DAMAGE_MIN+\n        Math.floor(\n            Math.random()*\n            (BEGINNER_FOREST_NORMAL_DAMAGE_MAX-BEGINNER_FOREST_NORMAL_DAMAGE_MIN+1)\n        );\n}\n\nfunction makeBeginnerForestMonster(name,level,element){\n    const monster=makeZoneMonster(name,level,element);\n    monster.agilityPoints=0;\n    monster.agility=0;\n    monster.v173BeginnerForest=true;\n    return monster;\n}\n\nconst forestMonsters = [\n\n    makeBeginnerForestMonster("哥布林",3,"fire"),\n    makeBeginnerForestMonster("史萊姆",2,"water"),\n    makeBeginnerForestMonster("哥布林",3,"fire"),\n    makeBeginnerForestMonster("史萊姆",2,"water"),\n    makeBeginnerForestMonster("哥布林",3,"fire"),\n    makeBeginnerForestMonster("史萊姆",2,"water")\n\n];'''
s=replace_once(s,old,new,'beginner forest roster')

old='''    if(img){\n\n        img.style.width=\n            "70px";\n\n        img.src=\n            PATROL_CHAR_FRONT_B64;\n\n    }'''
new='''    if(img){\n\n        img.style.width=\n            "70px";\n\n        img.style.transform=\n            "none";\n\n        img.src=\n            PATROL_CHAR_FRONT_B64;\n\n    }'''
s=replace_once(s,old,new,'patrol idle rotation reset')

old='''    img.src=\n        (movingUp ? PATROL_CHAR_BACK_B64 : PATROL_CHAR_FRONT_B64);'''
new='''    img.style.transform=\n        "none";\n\n    img.src=\n        (movingUp ? PATROL_CHAR_BACK_B64 : PATROL_CHAR_FRONT_B64);'''
s=replace_once(s,old,new,'patrol walking rotation reset')

old='''    if(img){\n\n        img.style.width=\n            "120px";\n\n        img.src=\n            PATROL_FIGHT1_B64;\n\n    }'''
new='''    if(img){\n\n        img.style.width=\n            "120px";\n\n        img.style.transform=\n            "rotate(90deg)";\n\n        img.src=\n            PATROL_FIGHT1_B64;\n\n    }'''
s=replace_once(s,old,new,'patrol fight frame one rotation')

old='''            if(img){\n\n                img.src=\n                    PATROL_FIGHT2_B64;\n\n            }'''
new='''            if(img){\n\n                img.style.transform=\n                    "rotate(90deg)";\n\n                img.src=\n                    PATROL_FIGHT2_B64;\n\n            }'''
s=replace_once(s,old,new,'patrol fight frame two rotation')

old='''            /* 怪物爆擊先完成判定，倍率由唯一傷害 owner 依正式順序套用。 */\n            const rageCriticalBonuses=getActiveRageCriticalBonuses(monster);\n            const monsterCritChance=\n                Math.max(\n                    CRIT_CHANCE_MIN_AFTER_ANTI_CRIT,\n                    10+rageCriticalBonuses.chance-(targetStats.antiCrit||0)\n                );\n            const monsterCrit=Math.random()*100<monsterCritChance;\n            const monsterCritMultiplier=monsterCrit\n                ?Math.min(CRIT_MULTIPLIER_MAX,1.5+rageCriticalBonuses.damage/100)\n                :1;\n\n            let damage=\n                isPureControlSkill\n                ?0\n                :castSkillData2\n                ?calculateSkillDamage({'''
new='''            const isBeginnerForestNormalAttack=\n                currentZone==="forest" &&\n                !castSkillData2 &&\n                monster &&\n                monster.v173BeginnerForest===true;\n\n            /* 新手森林普通攻擊是教學保護值：不吃爆擊，未防禦時固定10～15。 */\n            const rageCriticalBonuses=getActiveRageCriticalBonuses(monster);\n            const monsterCritChance=isBeginnerForestNormalAttack\n                ?0\n                :Math.max(\n                    CRIT_CHANCE_MIN_AFTER_ANTI_CRIT,\n                    10+rageCriticalBonuses.chance-(targetStats.antiCrit||0)\n                );\n            const monsterCrit=!isBeginnerForestNormalAttack&&Math.random()*100<monsterCritChance;\n            const monsterCritMultiplier=monsterCrit\n                ?Math.min(CRIT_MULTIPLIER_MAX,1.5+rageCriticalBonuses.damage/100)\n                :1;\n\n            let damage=\n                isPureControlSkill\n                ?0\n                :isBeginnerForestNormalAttack\n                ?rollBeginnerForestNormalAttackDamage()\n                :castSkillData2\n                ?calculateSkillDamage({'''
s=replace_once(s,old,new,'beginner forest normal damage')

p.write_text(s)

# ---------------------------------------------------------
# Existing EXP reward owner: normal forest training is tuned so the current
# Lv1->10 curve totals roughly twenty ordinary wins. Element Box stays 70%;
# rested EXP still doubles through the existing downstream rule.
# ---------------------------------------------------------
p=Path('js/25-v131-fix-batch.js')
s=p.read_text()
old='''    const ELEMENT_BOX_EXP_RATIO=0.70;\n\n    function getMonsterExpRankMultiplier(monster){'''
new='''    const ELEMENT_BOX_EXP_RATIO=0.70;\n    const V173_BEGINNER_FOREST_TARGET_BATTLES=20;\n    const V173_BEGINNER_FOREST_FALLBACK_EXP=690;\n\n    function getBeginnerForestBattleExp(){\n        if(typeof window.v133GetExpNextForLevel!=="function"){\n            return V173_BEGINNER_FOREST_FALLBACK_EXP;\n        }\n        let totalRequired=0;\n        for(let level=1;level<=9;level++){\n            totalRequired+=Math.max(1,Math.round(Number(window.v133GetExpNextForLevel(level))||0));\n        }\n        return Math.max(1,Math.ceil(totalRequired/V173_BEGINNER_FOREST_TARGET_BATTLES));\n    }\n\n    window.v173GetBeginnerForestBattleExp=getBeginnerForestBattleExp;\n\n    function getMonsterExpRankMultiplier(monster){'''
s=replace_once(s,old,new,'beginner forest exp helper')

old='''            let finalExp=Math.floor(rankAdjustedExp*V131_EXP_MULTIPLIER);\n\n            /* 元素匣（自動掛機）只給70%EXP，金幣/掉落/材料不受影響'''
new='''            let finalExp=Math.floor(rankAdjustedExp*V131_EXP_MULTIPLIER);\n\n            const isBeginnerForestBattle=\n                currentZone==="forest" &&\n                typeof player!=="undefined" &&\n                player &&\n                Math.max(1,Number(player.level)||1)<10;\n\n            if(isBeginnerForestBattle){\n                finalExp=getBeginnerForestBattleExp();\n            }\n\n            /* 元素匣（自動掛機）只給70%EXP，金幣/掉落/材料不受影響'''
s=replace_once(s,old,new,'beginner forest exp reward')
p.write_text(s)

# ---------------------------------------------------------
# Release/cache: this changes js/00 and the dynamically loaded js/25, so the
# authoritative cache version moves to V173.40.
# ---------------------------------------------------------
p=Path('js/20-anonymous-20.js')
s=p.read_text()
s=replace_once(s,'const V_ASSET_VERSION="173.39";','const V_ASSET_VERSION="173.40";','asset cache version')
p.write_text(s)

p=Path('index.html')
s=p.read_text()
if '173.39' not in s:
    raise SystemExit('index version: 173.39 not found')
s=s.replace('173.39','173.40')
p.write_text(s)

# Update only current-release assertions; hard-coded VFX asset versions such as
# earth ?v=173.39 intentionally remain unchanged.
for test_path in Path('tests').glob('*.js'):
    text=test_path.read_text()
    original=text
    text=text.replace('V_ASSET_VERSION="173\\.39"','V_ASSET_VERSION="173\\.40"')
    text=text.replace('V_ASSET_VERSION="173.39"','V_ASSET_VERSION="173.40"')
    text=text.replace('V173\\.39','V173\\.40')
    text=text.replace('V173.39','V173.40')
    for asset in [
        'js\\/00-main\\.js\\?v=173\\.39',
        'js\\/20-anonymous-20\\.js\\?v=173\\.39',
        'css\\/00-main\\.css\\?v=173\\.39',
        'css\\/29-v125-character-creation-native\\.css\\?v=173\\.39',
        'js/00-main.js?v=173.39',
        'js/20-anonymous-20.js?v=173.39',
        'css/00-main.css?v=173.39',
        'css/29-v125-character-creation-native.css?v=173.39'
    ]:
        text=text.replace(asset,asset.replace('173\\.39','173\\.40').replace('173.39','173.40'))
    if text!=original:
        test_path.write_text(text)

# New focused regression.
Path('tests/v173.40-beginner-balance.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const main=fs.readFileSync("js/00-main.js","utf8");
const rewards=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const curve=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
let passed=0;function test(name,fn){fn();passed++;console.log("✓ "+name);}

test("newbie forest owns zero agility monsters",()=>{
    assert.match(main,/function makeBeginnerForestMonster\(name,level,element\)[\s\S]*?monster\.agilityPoints=0;[\s\S]*?monster\.agility=0;[\s\S]*?monster\.v173BeginnerForest=true;/);
    assert.equal((main.match(/makeBeginnerForestMonster\("(?:哥布林|史萊姆)"/g)||[]).length,6);
});

test("newbie forest normal attacks are final 10 to 15 before defend or shields and cannot crit",()=>{
    assert.match(main,/const BEGINNER_FOREST_NORMAL_DAMAGE_MIN=10;/);
    assert.match(main,/const BEGINNER_FOREST_NORMAL_DAMAGE_MAX=15;/);
    assert.match(main,/function rollBeginnerForestNormalAttackDamage\(\)[\s\S]*?Math\.random\(\)[\s\S]*?BEGINNER_FOREST_NORMAL_DAMAGE_MAX-BEGINNER_FOREST_NORMAL_DAMAGE_MIN\+1/);
    assert.match(main,/const isBeginnerForestNormalAttack=[\s\S]*?currentZone==="forest"[\s\S]*?!castSkillData2[\s\S]*?monster\.v173BeginnerForest===true/);
    assert.match(main,/const monsterCritChance=isBeginnerForestNormalAttack[\s\S]*?\?0/);
    assert.match(main,/:isBeginnerForestNormalAttack\s*\?rollBeginnerForestNormalAttackDamage\(\)/);
});

test("newbie EXP is tied to the current Lv1-to-10 curve and twenty normal wins",()=>{
    assert.match(rewards,/const V173_BEGINNER_FOREST_TARGET_BATTLES=20;/);
    assert.match(rewards,/const V173_BEGINNER_FOREST_FALLBACK_EXP=690;/);
    assert.match(rewards,/for\(let level=1;level<=9;level\+\+\)[\s\S]*?v133GetExpNextForLevel\(level\)/);
    assert.match(rewards,/Math\.ceil\(totalRequired\/V173_BEGINNER_FOREST_TARGET_BATTLES\)/);
    assert.match(rewards,/currentZone==="forest"[\s\S]*?player[\s\S]*?player\.level\)\|\|1\)<10[\s\S]*?finalExp=getBeginnerForestBattleExp\(\)/);
    // Current forest curve sanity: avg battle EXP 184; level target-battles 3,4,6,7,8,10,11,12,14.
    const targetBattles=[3,4,6,7,8,10,11,12,14];
    const total=targetBattles.reduce((sum,battles)=>sum+184*battles,0);
    assert.equal(total,13800);
    assert.equal(Math.ceil(total/20),690);
    assert.match(curve,/TRAINING_EXP_MULTIPLIER=3\.5/);
});

test("both patrol fight frames display rotated clockwise ninety degrees and walking resets rotation",()=>{
    assert.match(main,/PATROL_FIGHT1_B64[\s\S]*?function playPatrolFightAnimation[\s\S]*?img\.style\.transform=\s*"rotate\(90deg\)";[\s\S]*?PATROL_FIGHT1_B64/);
    assert.match(main,/setTimeout\(\(\)=>\{[\s\S]*?img\.style\.transform=\s*"rotate\(90deg\)";[\s\S]*?PATROL_FIGHT2_B64/);
    assert.ok((main.match(/img\.style\.transform=\s*"none";/g)||[]).length>=2);
});

test("range VFX fixes remain fixed-size and centered after casualties",()=>{
    assert.match(animation,/iceArrowRain:[\s\S]*?placement:"battlefield",renderer:"canvas-crop",fixedFormation:true/);
    ["stormFlurry","windSpell","stormCircle","petrifyFist","earthquakeCrush","stoneThrow","sandWind"].forEach(id=>{
        assert.match(animation,new RegExp(id+':[\\s\\S]*?placement:"group"[\\s\\S]*?alignToSlots:true'));
    });
    ["stormRain","flyingSandStrike"].forEach(id=>{
        assert.match(animation,new RegExp(id+':[\\s\\S]*?placement:"battlefield"'));
    });
    assert.match(animation,/function fixedTriLayoutBounds\([\s\S]*?centerX:anchor\.x[\s\S]*?fixedSlots:3/);
    assert.match(animation,/if\(placement==="battlefield"\)[\s\S]*?sideAreaBounds\(current\.targetSide\)/);
});

test("release/cache advances to V173.40",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.40"/);
    assert.match(index,/<title>四象江湖傳 V173\.40<\/title>/);
    assert.match(index,/js\/00-main\.js\?v=173\.40/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.40/);
});
console.log("\n"+passed+" V173.40 beginner balance and patrol tests passed.");
''')

# Handoff only; no gameplay code outside the two authoritative owners above.
p=Path('HANDOFF.md')
h=p.read_text()
entry='''\n## V173.40 新手森林生存／EXP與巡怪打架圖方向\n- 新手森林六隻怪物的敏捷與敏捷點數固定為0。\n- 新手森林普通攻擊（非技能）不爆擊，未防禦／未被盾吸收前固定10～15傷害。\n- 一般新手森林勝利EXP依目前Lv1→10正式曲線反推為約20場；目前基準690 EXP/場。元素匣70%與休息EXP×2沿用既有規則。\n- 巡怪進戰鬥前的patrol-fight-1/2顯示時統一順時針90°；走路／待機恢復0°。\n- 土／風三人、全體與冰霜箭雨固定範圍VFX規則未改，新增回歸保護。\n'''
if '## V173.40 新手森林生存／EXP與巡怪打架圖方向' not in h:
    h=entry+h
p.write_text(h)

print('V173.40 beginner balance patch applied')
