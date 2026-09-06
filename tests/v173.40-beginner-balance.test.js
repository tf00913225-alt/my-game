"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const main=fs.readFileSync("js/00-main.js","utf8");
const rewards=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const curve=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
let passed=0;function test(name,fn){fn();passed++;console.log("✓ "+name);}

test("newbie forest owns zero agility monsters while preserving the six canonical monster rows",()=>{
    const forest=(main.match(/const forestMonsters = \[[\s\S]*?\n\];/)||[])[0]||"";
    assert.equal((forest.match(/makeZoneMonster\("(?:哥布林|史萊姆)"/g)||[]).length,6);
    assert.match(main,/forestMonsters\.forEach\(monster=>\{[\s\S]*?monster\.agilityPoints=0;[\s\S]*?monster\.agility=0;[\s\S]*?monster\.v173BeginnerForest=true;/);
});

test("newbie forest normal attacks are final 10 to 15 before defend or shields and cannot crit",()=>{
    assert.match(main,/const BEGINNER_FOREST_NORMAL_DAMAGE_MIN=10;/);
    assert.match(main,/const BEGINNER_FOREST_NORMAL_DAMAGE_MAX=15;/);
    assert.match(main,/function rollBeginnerForestNormalAttackDamage\(\)[\s\S]*?Math\.random\(\)[\s\S]*?BEGINNER_FOREST_NORMAL_DAMAGE_MAX-BEGINNER_FOREST_NORMAL_DAMAGE_MIN\+1/);
    assert.match(main,/const isBeginnerForestNormalAttack=[\s\S]*?currentZone==="forest"[\s\S]*?!castSkillData2[\s\S]*?monster\.v173BeginnerForest===true/);
    assert.match(main,/const monsterCritChance=isBeginnerForestNormalAttack[\s\S]*?\?0/);
    assert.match(main,/:isBeginnerForestNormalAttack\s*\?rollBeginnerForestNormalAttackDamage\(\)/);
});

test("newbie EXP keeps the Lv1-to-10 reference but now pays per monster and follows global x3",()=>{
    assert.match(rewards,/const V173_BEGINNER_FOREST_TARGET_BATTLES=20;/);
    assert.match(rewards,/const V173_BEGINNER_FOREST_FALLBACK_EXP=690;/);
    assert.match(rewards,/for\(let level=1;level<=9;level\+\+\)[\s\S]*?v133GetExpNextForLevel\(level\)/);
    assert.match(rewards,/Math\.ceil\(totalRequired\/V173_BEGINNER_FOREST_TARGET_BATTLES\)/);
    assert.match(rewards,/function getBeginnerForestMonsterExpUnit\(\)[\s\S]*?getBeginnerForestBattleExp\(\)\/3/);
    assert.match(rewards,/if\(isBeginnerForestBattle\)\{[\s\S]*?currentBattleMonsters\.reduce[\s\S]*?getBeginnerForestMonsterExpUnit\(\)[\s\S]*?V17342_GLOBAL_EXP_REWARD_MULTIPLIER/);
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
    assert.match(loader,/const V_ASSET_VERSION="173\.57"/);
    assert.match(index,/<title>四象江湖傳 V173\.57<\/title>/);
    assert.match(index,/js\/00-main\.js\?v=173\.57/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.57/);
});
console.log("\n"+passed+" V173.40 beginner balance and patrol tests passed.");
