from pathlib import Path
import json
import re


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: exact replacement expected 1 match, got {count}")
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    updated, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{path}: regex replacement expected 1 match, got {count}: {pattern[:80]}")
    write(path, updated)


# -----------------------------------------------------------------------------
# js/28: authoritative EXP requirement owner.
# Lv1->20 stays on the current newcomer curve. Lv20->21 and later are derived
# from the live training-zone average standard patrol EXP x target battle count.
# -----------------------------------------------------------------------------
replace_once(
    "js/28-v133-economy-rebalance.js",
    """    /* Lv1~20快速期；20後以少量錨點線性銜接，49→50只有約7.5%增加。 */
    const EXP_REQUIREMENT_ANCHORS=[
        {level:1,value:300},{level:5,value:600},{level:10,value:1200},
        {level:15,value:2500},{level:20,value:8000},{level:30,value:60000},
        {level:40,value:120000},{level:49,value:200000},{level:50,value:215000},
        {level:60,value:400000},{level:70,value:650000},{level:80,value:1000000},
        {level:90,value:1500000},{level:95,value:2000000},{level:99,value:2800000}
    ];""",
    """    /* Lv1→20 快速期維持既有靜態需求；從 Lv20→21 起，expNext 唯一依據
       為「該級練功區正式平均戰鬥 EXP × TARGET_BATTLE_ANCHORS」。 */
    const NEWCOMER_EXP_REQUIREMENT_ANCHORS=[
        {level:1,value:300},{level:5,value:600},{level:10,value:1200},
        {level:15,value:2500},{level:20,value:8000}
    ];""",
)

replace_once(
    "js/28-v133-economy-rebalance.js",
    """    function getExpNextForLevel(level){
        const safe=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        return Math.max(1,Math.round(interpolateAnchors(safe,EXP_REQUIREMENT_ANCHORS)));
    }""",
    """    function getExpNextForLevel(level){
        const safe=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        if(safe<20){
            return Math.max(1,Math.round(interpolateAnchors(safe,NEWCOMER_EXP_REQUIREMENT_ANCHORS)));
        }
        const averageBattleExp=getTrainingZoneAverageExpForLevel(safe);
        const targetBattles=getTargetBattlesForLevel(safe);
        return Math.max(1,Math.round(averageBattleExp*targetBattles));
    }""",
)

replace_once(
    "js/28-v133-economy-rebalance.js",
    """    window.v139GetExpCurveAudit=function(){
        const checkpoints=[10,20,30,40,49,50,60,70,80,90,95,99].map(level=>({
            level:level,averageBattleExp:getTrainingZoneAverageExpForLevel(level),
            targetBattles:getTargetBattlesForLevel(level),expNext:getExpNextForLevel(level),
            naturalLevelsPerDay:getNaturalChargeLevelsPerDay(level),dailyQuestLevelsPerDay:getDailyQuestLevelsPerDay(level),
            dailyTotalTarget:getDailyTotalTarget(level)
        }));""",
    """    window.v139GetExpCurveAudit=function(){
        const checkpoints=[10,20,30,40,49,50,60,70,80,90,95,98,99].map(level=>{
            const averageBattleExp=getTrainingZoneAverageExpForLevel(level);
            const targetBattles=getTargetBattlesForLevel(level);
            const expNext=getExpNextForLevel(level);
            const theoreticalBattles=averageBattleExp>0?expNext/averageBattleExp:0;
            const differencePercent=targetBattles>0?((theoreticalBattles-targetBattles)/targetBattles)*100:0;
            return {
                level:level,averageBattleExp:averageBattleExp,targetBattles:targetBattles,expNext:expNext,
                theoreticalBattles:theoreticalBattles,differencePercent:differencePercent,
                naturalLevelsPerDay:getNaturalChargeLevelsPerDay(level),dailyQuestLevelsPerDay:getDailyQuestLevelsPerDay(level),
                dailyTotalTarget:getDailyTotalTarget(level)
            };
        });""",
)


# -----------------------------------------------------------------------------
# js/25: authoritative standard patrol reward calculation.
# V173.42 x3 is explicitly newcomer-only (<Lv20). No reciprocal correction is
# introduced. Element Box/rested modes consume the same standard reward owner.
# -----------------------------------------------------------------------------
replace_once(
    "js/25-v131-fix-batch.js",
    """    function getMonsterExpRankMultiplier(monster){
        const rank=getMonsterRank(monster);
        if(rank===\"boss\"){ return 3; }
        if(rank===\"elite\"){ return 1.5; }
        return 1;
    }
""",
    """    function getMonsterExpRankMultiplier(monster){
        const rank=getMonsterRank(monster);
        if(rank===\"boss\"){ return 3; }
        if(rank===\"elite\"){ return 1.5; }
        return 1;
    }

    function getPatrolProgressionExpMultiplier(level){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        return safeLevel<20 ? V17342_GLOBAL_EXP_REWARD_MULTIPLIER : 1;
    }

    function getPatrolProgressionReferenceLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel===\"function\"){
            return Math.max(1,Math.floor(Number(window.v133GetHighestCreatedCharacterLevel())||1));
        }
        if(typeof getExistingPartyIndexes===\"function\"&&typeof getPartyCharacterByIndex===\"function\"){
            const indexes=getExistingPartyIndexes();
            if(indexes&&indexes.length){
                return indexes.reduce((highest,index)=>{
                    const character=getPartyCharacterByIndex(index);
                    return character?Math.max(highest,Math.floor(Number(character.level)||1)):highest;
                },1);
            }
        }
        return typeof player!==\"undefined\"&&player ? Math.max(1,Math.floor(Number(player.level)||1)) : 1;
    }

    function calculateStandardPatrolExp(monsterList,progressionLevel){
        const rankAdjustedExp=(Array.isArray(monsterList)?monsterList:[]).reduce((total,monster)=>{
            if(!monster){ return total; }
            return total+(Number(monster.level)||0)*10*getMonsterExpRankMultiplier(monster);
        },0);
        return Math.max(0,Math.floor(
            rankAdjustedExp*V131_EXP_MULTIPLIER*getPatrolProgressionExpMultiplier(progressionLevel)
        ));
    }

    function applyPatrolExpMode(standardExp,options){
        const safeExp=Math.max(0,Math.floor(Number(standardExp)||0));
        const mode=options&&typeof options===\"object\"?options:{};
        if(mode.elementBox){ return Math.round(safeExp*ELEMENT_BOX_EXP_RATIO); }
        if(mode.rested){ return Math.round(safeExp*2); }
        return safeExp;
    }

    window.v173GetPatrolProgressionExpMultiplier=getPatrolProgressionExpMultiplier;
    window.v173GetPatrolProgressionReferenceLevel=getPatrolProgressionReferenceLevel;
    window.v173CalculateStandardPatrolExp=calculateStandardPatrolExp;
    window.v173ApplyPatrolExpMode=applyPatrolExpMode;
""",
)

replace_once(
    "js/25-v131-fix-batch.js",
    """            /* rankAdjustedExp：這裡才是真正決定最終獎勵的基準，
               每隻怪先各自套rank倍率（普通×1／精英×1.5／BOSS×3），
               再統一乘上既有的3.5倍加成——兩個倍率是「疊乘」，
               不是額外多加一次3.5。 */
            const rankAdjustedExp=currentBattleMonsters.reduce(
                (total,index)=>{
                    const monster=monsters[index];
                    if(!monster){ return total; }
                    return total+(Number(monster.level)||0)*10*getMonsterExpRankMultiplier(monster);
                },
                0
            );

            let finalExp=Math.floor(
                rankAdjustedExp*V131_EXP_MULTIPLIER*V17342_GLOBAL_EXP_REWARD_MULTIPLIER
            );""",
    """            /* 正式巡怪 EXP 只走 calculateStandardPatrolExp()：
               怪物基礎 EXP × rank × 3.5；V173.42 ×3 僅保留 Lv1～19 快速期。
               Lv20 起不再有第二個全域 ×3。 */
            const progressionLevel=getPatrolProgressionReferenceLevel();
            let finalExp=calculateStandardPatrolExp(
                currentBattleMonsters.map(index=>monsters[index]).filter(Boolean),
                progressionLevel
            );""",
)
replace_once(
    "js/25-v131-fix-batch.js",
    "                finalExp=Math.round(finalExp*ELEMENT_BOX_EXP_RATIO);",
    "                finalExp=applyPatrolExpMode(finalExp,{elementBox:true});",
)
replace_once(
    "js/25-v131-fix-batch.js",
    "                    finalExp=Math.round(finalExp*2);",
    "                    finalExp=applyPatrolExpMode(finalExp,{rested:true});",
)


# Keep the EXP dungeon runtime unchanged; correct only the stale explanatory comment.
p = Path("js/27-v132-content-expansion.js")
text = p.read_text(encoding="utf-8")
old_comment = """       落在使用者指定的每日約10～12%區間。看廣告雙倍仍沿用既有
       流程，因此一般領取約11%、雙倍領取約22%。"""
if old_comment in text:
    text = text.replace(
        old_comment,
        """       正式維持「隊伍當級 expNext 平均 ×33%」；看廣告雙倍沿用既有
       流程，因此一般領取約33%、雙倍領取約66%。""",
        1,
    )
    p.write_text(text, encoding="utf-8")


# -----------------------------------------------------------------------------
# Existing economy/rested suite: remove the obsolete assertion that target
# battles are audit-only and assert the coupled requirement instead.
# -----------------------------------------------------------------------------
regex_once(
    "tests/v139-economy-rested-exp.test.js",
    r'test\("formal growth curve keeps the legacy zone audit but uses the new fast/smooth EXP requirements",\(\)=>\{[\s\S]*?\n\}\);\n\ntest\("monster EXP keeps ×3\.5, rank multipliers, and element-box 70%",\(\)=>\{[\s\S]*?\n\}\);',
    """test(\"formal growth curve is owned by runtime zone EXP × target battle anchors from Lv20\",()=>{
    const context=makeEconomyContext();
    const audit=vm.runInContext(\"v139GetExpCurveAudit()\",context);
    assert.equal(audit.totalEffectiveBattles,69760);
    assert.equal(audit.beginnerTotalExp,37950);

    const formalLevels=new Set([20,30,40,50,60,70,80,90,95,98,99]);
    for(const checkpoint of audit.checkpoints.filter(row=>formalLevels.has(row.level))){
        assert.ok(checkpoint.averageBattleExp>0,\"zone EXP audit must be live\");
        assert.equal(checkpoint.expNext,Math.round(checkpoint.averageBattleExp*checkpoint.targetBattles),\"Lv\"+checkpoint.level+\" expNext must be coupled\");
        assert.ok(Math.abs(checkpoint.theoreticalBattles-checkpoint.targetBattles)<0.001,\"Lv\"+checkpoint.level+\" battle count\");
        assert.ok(Math.abs(checkpoint.differencePercent)<0.001,\"Lv\"+checkpoint.level+\" difference\");
    }
    assert.ok(vm.runInContext(\"v133GetExpNextForLevel(50)/v133GetExpNextForLevel(49)\",context)<1.08,\"Lv49→50 must not cliff\");
    assert.equal(vm.runInContext(\"v173GetNaturalChargeLevelsPerDay(20)\",context),1.30);
    assert.equal(vm.runInContext(\"v173GetNaturalChargeLevelsPerDay(50)\",context),1.00);
    assert.equal(vm.runInContext(\"v173GetNaturalChargeLevelsPerDay(99)\",context),0.32);
});

test(\"monster EXP keeps ×3.5, rank multipliers, newcomer-only ×3, and element-box 70%\",()=>{
    assert.match(v131Source,/const V131_EXP_MULTIPLIER=3\\.5/);
    assert.match(v131Source,/const ELEMENT_BOX_EXP_RATIO=0\\.70/);
    assert.match(v131Source,/rank===\"boss\"\\)\\{ return 3; \\}/);
    assert.match(v131Source,/rank===\"elite\"\\)\\{ return 1\\.5; \\}/);
    assert.match(v131Source,/safeLevel<20 \\? V17342_GLOBAL_EXP_REWARD_MULTIPLIER : 1/);
    assert.match(v131Source,/finalExp=applyPatrolExpMode\\(finalExp,\\{elementBox:true\\}\\)/);
});""",
)
replace_once(
    "tests/v139-economy-rested-exp.test.js",
    "    assert.match(v131Source,/finalExp=Math\\.round\\(finalExp\\*2\\)/);",
    "    assert.match(v131Source,/finalExp=applyPatrolExpMode\\(finalExp,\\{rested:true\\}\\)/);",
)


# -----------------------------------------------------------------------------
# Natural charge/daily Growth tests must derive expected absolute EXP from the
# new formal expNext while preserving the original levels/day design.
# -----------------------------------------------------------------------------
p = Path("tests/v173.43-growth-charge.test.js")
text = p.read_text(encoding="utf-8")
changes = {
    "const h=harness({levels:[20]});h.setNow(h.getNow()+DAY/2);assert.equal(h.context.v173PreviewExpPoolCharge().gain,5200);":
        "const h=harness({levels:[20]});h.setNow(h.getNow()+DAY/2);assert.equal(h.context.v173PreviewExpPoolCharge().gain,Math.floor(h.context.v133GetExpNextForLevel(20)*h.context.v173GetNaturalChargeLevelsPerDay(20)*.5));",
    "assert.equal(h.context.sharedExp,10400);":
        "assert.equal(h.context.sharedExp,Math.floor(h.context.v133GetExpNextForLevel(20)*h.context.v173GetNaturalChargeLevelsPerDay(20)));",
    "const h=harness({levels:[30]});h.setNow(h.getNow()+DAY);assert.equal(h.context.v173PreviewExpPoolCharge().gain,Math.floor(60000*h.context.v173GetNaturalChargeLevelsPerDay(30)));":
        "const h=harness({levels:[30]});h.setNow(h.getNow()+DAY);assert.equal(h.context.v173PreviewExpPoolCharge().gain,Math.floor(h.context.v133GetExpNextForLevel(30)*h.context.v173GetNaturalChargeLevelsPerDay(30)));",
    "assert.equal(p.elapsedMs,72*3600000);assert.equal(p.gain,31200);assert.equal(p.capped,true);":
        "assert.equal(p.elapsedMs,72*3600000);assert.equal(p.gain,Math.floor(h.context.v133GetExpNextForLevel(20)*h.context.v173GetNaturalChargeLevelsPerDay(20)*3));assert.equal(p.capped,true);",
    "const h=harness({levels:[20],sharedExp:9_999_999});h.setNow(h.getNow()+5*DAY);assert.equal(h.context.v173GetAvailableExpPool(),9_999_999+31200);":
        "const h=harness({levels:[20],sharedExp:9_999_999});h.setNow(h.getNow()+5*DAY);assert.equal(h.context.v173GetAvailableExpPool(),9_999_999+Math.floor(h.context.v133GetExpNextForLevel(20)*h.context.v173GetNaturalChargeLevelsPerDay(20)*3));",
    "h.setNow(base+3600000);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),Math.floor(10400/24));":
        "h.setNow(base+3600000);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),Math.floor(h.context.v133GetExpNextForLevel(20)*h.context.v173GetNaturalChargeLevelsPerDay(20)/24));",
    "const b=harness({levels:[50]}).context.v173GetDailyGrowthRewardBreakdown(50);assert.equal(b.totalExp,148350);assert.equal(b.taskExp,103845);assert.equal(Number((b.taskExp/b.totalExp).toFixed(2)),.70);":
        "const h=harness({levels:[50]});const b=h.context.v173GetDailyGrowthRewardBreakdown(50);assert.equal(b.totalExp,Math.round(h.context.v133GetExpNextForLevel(50)*h.context.v173GetDailyQuestLevelsPerDay(50)));assert.equal(b.taskExp,Math.round(b.totalExp*.70));assert.equal(Number((b.taskExp/b.totalExp).toFixed(2)),.70);",
    "const b=harness({levels:[50]}).context.v173GetDailyGrowthRewardBreakdown(50);assert.equal(b.chestExp,44505);assert.equal(b.taskExp+b.chestExp,b.totalExp);assert.match(growth,/type===\"daily\"&&Number\\(threshold\\)===100/);":
        "const b=harness({levels:[50]}).context.v173GetDailyGrowthRewardBreakdown(50);assert.equal(b.chestExp,b.totalExp-b.taskExp);assert.equal(b.taskExp+b.chestExp,b.totalExp);assert.match(growth,/type===\"daily\"&&Number\\(threshold\\)===100/);",
    "const h=harness({levels:[20]});h.setNow(h.getNow()+DAY);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),10400);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),0);":
        "const h=harness({levels:[20]});h.setNow(h.getNow()+DAY);const expected=Math.floor(h.context.v133GetExpNextForLevel(20)*h.context.v173GetNaturalChargeLevelsPerDay(20));assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),expected);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),0);",
}
for old, new in changes.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"tests/v173.43-growth-charge.test.js: expected one match, got {count}: {old[:80]}")
    text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")


# -----------------------------------------------------------------------------
# Current final-runtime integration suite: verify the entire chain rather than
# comparing disconnected arrays. The test emits the exact numeric report used
# for the completion report.
# -----------------------------------------------------------------------------
p = Path("tests/v170-final-spec-integration.test.js")
text = p.read_text(encoding="utf-8")
marker = 'console.log("\\nV170 final integration suite: "+passed+" tests passed.");'
if text.count(marker) != 1:
    raise SystemExit("tests/v170-final-spec-integration.test.js: final marker mismatch")
block = r'''

test("formal EXP chain couples actual patrol reward to target battles from Lv20",()=>{
    const runtime=loadFinalRuntime();
    const report=evaluateJson(runtime.context,`(function(){
        const checkpoints=[20,30,40,50,60,70,80,90,95,98,99];
        const profiles=[
            {min:11,max:20,key:"desert",size:2},{min:21,max:30,key:"ice",size:4.5},
            {min:31,max:40,key:"zone4",size:4.5},{min:41,max:50,key:"zone5",size:4.5},
            {min:51,max:60,key:"zone6",size:4.5},{min:61,max:70,key:"zone7",size:4.5},
            {min:71,max:80,key:"zone8",size:4.5},{min:81,max:90,key:"zone9",size:4.5},
            {min:91,max:99,key:"zone10",size:4.5}
        ];
        function runtimeAverage(level){
            const profile=profiles.find(value=>level>=value.min&&level<=value.max);
            const source=zoneConfig[profile.key].monsters;
            const roster=typeof source==="function"?source():source;
            const expectedUnit=roster.reduce((sum,monster)=>{
                if(Number.isFinite(Number(monster.v141CurveEliteRate))){
                    const rate=Math.max(0,Math.min(1,Number(monster.v141CurveEliteRate)));
                    const regular=Object.assign({},monster,{rank:"regular"});
                    const elite=Object.assign({},monster,{rank:"elite"});
                    return sum+v173CalculateStandardPatrolExp([regular],level)*(1-rate)+
                        v173CalculateStandardPatrolExp([elite],level)*rate;
                }
                return sum+v173CalculateStandardPatrolExp([monster],level);
            },0)/roster.length;
            return Math.round(expectedUnit*profile.size);
        }
        const rows=checkpoints.map(level=>{
            const averageBattleExp=v139GetTrainingZoneAverageExpForLevel(level);
            const expNext=v133GetExpNextForLevel(level);
            const targetBattles=v139GetTargetBattlesForLevel(level);
            const theoreticalBattles=expNext/averageBattleExp;
            return {level:level,expNext:expNext,averageBattleExp:averageBattleExp,
                runtimeAverage:runtimeAverage(level),targetBattles:targetBattles,
                theoreticalBattles:theoreticalBattles,
                differencePercent:(theoreticalBattles-targetBattles)/targetBattles*100};
        });
        const rankMonster={level:20,element:"fire"};
        const rank=["regular","elite","boss"].map(rank=>
            v173CalculateStandardPatrolExp([Object.assign({},rankMonster,{rank:rank})],20)
        );
        const standard=rank[0];
        const modes={
            manual:v173ApplyPatrolExpMode(standard,{}),
            elementBox:v173ApplyPatrolExpMode(standard,{elementBox:true}),
            rested:v173ApplyPatrolExpMode(standard,{rested:true}),
            blockedStack:v173ApplyPatrolExpMode(standard,{elementBox:true,rested:true})
        };
        const phase={level19:v173GetPatrolProgressionExpMultiplier(19),level20:v173GetPatrolProgressionExpMultiplier(20)};
        const charge=[20,50,99].map(level=>[level,v173GetNaturalChargeLevelsPerDay(level)]);
        const daily=[20,50,99].map(level=>{
            const reward=v173GetDailyGrowthRewardBreakdown(level);
            return [level,reward.totalExp/v133GetExpNextForLevel(level),v173GetDailyQuestLevelsPerDay(level)];
        });
        Object.assign(player,{level:20,exp:0,expNext:v133GetExpNextForLevel(20)});player2=null;player3=null;
        const dungeonNormal=v139GetExpDungeonRewardExp();
        return {rows:rows,rank:rank,modes:modes,phase:phase,charge:charge,daily:daily,
            dungeonNormal:dungeonNormal,dungeonRatio:dungeonNormal/player.expNext};
    })()`);

    report.rows.forEach(row=>{
        assert.ok(Math.abs(row.theoreticalBattles-row.targetBattles)<0.001,"Lv"+row.level+" target battles");
        assert.ok(Math.abs(row.differencePercent)<0.001,"Lv"+row.level+" difference");
        assert.ok(Math.abs(row.runtimeAverage-row.averageBattleExp)/row.averageBattleExp<.01,"Lv"+row.level+" battle owner/audit mismatch");
    });
    assert.deepEqual(report.rank,[700,1050,2100]);
    assert.deepEqual(report.modes,{manual:700,elementBox:490,rested:1400,blockedStack:490});
    assert.deepEqual(report.phase,{level19:3,level20:1});
    assert.deepEqual(report.charge,[[20,1.3],[50,1],[99,.32]]);
    report.daily.forEach(([level,actual,expected])=>assert.ok(Math.abs(actual-expected)<.000001,"Lv"+level+" daily growth ratio"));
    assert.ok(Math.abs(report.dungeonRatio-.33)<.001);
    const dungeonSource=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
    const dailyDungeonSource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
    assert.match(dungeonSource,/const DUNGEON_DAILY_LIMIT_ENABLED=false/);
    assert.match(dailyDungeonSource,/showRewardedAd\(\(\)=>grant\(2\)/);
    console.log("EXP_GROWTH_REPORT="+JSON.stringify(report));
});

'''
text = text.replace(marker, block + marker, 1)
p.write_text(text, encoding="utf-8")


# -----------------------------------------------------------------------------
# Latest authoritative handoff section; historical notes remain intact.
# -----------------------------------------------------------------------------
p = Path("HANDOFF.md")
text = p.read_text(encoding="utf-8")
heading = "## 2026-09-07 — EXP 成長曲線正式收斂"
if heading not in text:
    text += """

## 2026-09-07 — EXP 成長曲線正式收斂

本段為目前 EXP／成長規則的最新正式 owner 規格；若前文歷史版本敘述與本段衝突，以本段與實際 runtime owner 為準。

- 升級需求唯一長期 owner：`js/28-v133-economy-rebalance.js` 的 `v133GetExpNextForLevel()`。
- Lv1→20：新手快速期，保留既有 newcomer bonus／新手森林／新手任務節奏，正常流程目標約 20～30 分鐘到 Lv20。`v133GetExpNextForLevel(1..19)` 維持既有新手靜態需求。
- 從 Lv20→21 開始：`expNext = 該等級練功區正式平均標準巡怪 EXP × TARGET_BATTLE_ANCHORS`，不得再用另一套高等級靜態 EXP anchors 覆蓋。
- `TARGET_BATTLE_ANCHORS` 正式控制 expNext：Lv20=45、Lv30=100、Lv40=250、Lv50=400、Lv60=650、Lv70=900、Lv80=1200、Lv90=1700、Lv95=2600、Lv98=3500、Lv99=4000；中間等級平滑插值。
- 一般巡怪正式 EXP owner：`js/25-v131-fix-batch.js`。Lv20+ 標準巡怪 = 怪物基礎 EXP（等級×10）× rank（普通1／精英1.5／BOSS3）× 練功倍率3.5；V173.42 全域 EXP ×3 僅保留 Lv1～19 快速期，不得在 Lv20+ 再疊加。
- 元素匣：同條件正式巡怪 EXP 的 70%；不吃休息經驗。
- 休息經驗：一般巡怪同條件 200%；每約離線2分鐘累積1場、最多300場；元素匣與休息經驗禁止疊加。
- 自然充能：Lv20+ 仍依 `expNext × levelsPerDay`，既有 levels/day 意圖不重做（Lv20約1.30、Lv50約1.00、Lv99約0.32）。
- 每日 Growth EXP：仍依新 `expNext × levelsPerDay` 動態計算，不得硬寫舊 EXP，也不得再額外乘全域 ×3。
- 經驗副本：維持全隊當級 `expNext` 平均 ×33%，廣告雙倍約66%；`DUNGEON_DAILY_LIMIT_ENABLED=false` 是目前 DEV QA 刻意設定，禁止當成 Bug 恢復次數限制。
- 傳統離線 EXP：仍由 `js/00-main.js` 基礎 10 EXP/分鐘（最多480分鐘）＋`js/34-v141-core-systems.js` 最高角色等級倍率與 V173.42 ×3 計算；本次評估相對新長期 expNext 並未破壞定位，因此不修改。廣告領取仍為雙倍。
- EXP 場數健檢必須走真正 runtime：實際怪物／rank → 戰鬥 EXP → mode（手動／元素匣／休息）→ `expNext`，不得只比較 UI、註解、anchor array。
- 回歸 owner：`tests/v170-final-spec-integration.test.js` 驗證完整最終 runtime；`tests/v139-economy-rested-exp.test.js` 驗證曲線與休息經驗；`tests/v173.43-growth-charge.test.js` 驗證自然充能／每日 Growth／新手期。
"""
    p.write_text(text, encoding="utf-8")


# Requirement batch for this multi-requirement core-growth change.
batch_path = Path("release/requirement-batches/2026-09-07-exp-growth-curve-convergence.json")
batch = {
    "schemaVersion": 1,
    "batchId": "2026-09-07-exp-growth-curve-convergence",
    "baseBranch": "dev",
    "baseCommit": "cb269fef7f28e54161b9abda9cfcb66bfbfbe74f",
    "officialVersion": "173.63",
    "officialVersionBumpAllowed": False,
    "overallStatus": "IMPLEMENTED",
    "requirements": [
        {"id": "EXP-CURVE-01", "status": "IMPLEMENTED", "requirement": "Lv1→20維持約20～30分鐘新手快速期；Lv20→21起由正式練功區平均EXP×TARGET_BATTLE_ANCHORS決定expNext。", "evidence": ["js/28-v133-economy-rebalance.js", "tests/v173.43-growth-charge.test.js", "tests/v170-final-spec-integration.test.js"]},
        {"id": "EXP-BATTLE-01", "status": "IMPLEMENTED", "requirement": "Lv20+一般巡怪只使用基礎EXP×rank×3.5；V173.42×3僅限Lv1～19。", "evidence": ["js/25-v131-fix-batch.js", "tests/v170-final-spec-integration.test.js"]},
        {"id": "EXP-MODES-01", "status": "IMPLEMENTED", "requirement": "手動100%、元素匣70%、休息200%，元素匣不得與休息經驗疊加；rank維持1/1.5/3。", "evidence": ["js/25-v131-fix-batch.js", "js/32-v139-rested-experience.js", "tests/v170-final-spec-integration.test.js", "tests/v139-economy-rested-exp.test.js"]},
        {"id": "EXP-GROWTH-01", "status": "IMPLEMENTED", "requirement": "自然充能與每日Growth繼續以新expNext×既有levels/day計算，不重做比例。", "evidence": ["js/28-v133-economy-rebalance.js", "tests/v173.43-growth-charge.test.js", "tests/v170-final-spec-integration.test.js"]},
        {"id": "EXP-DUNGEON-01", "status": "IMPLEMENTED", "requirement": "經驗副本維持約33%，廣告雙倍約66%，DUNGEON_DAILY_LIMIT_ENABLED保持false。", "evidence": ["js/27-v132-content-expansion.js", "js/42-v148-combat-dungeon-fixes.js", "tests/v170-final-spec-integration.test.js"]},
        {"id": "EXP-OFFLINE-01", "status": "IMPLEMENTED", "requirement": "傳統離線EXP完整檢查後維持現行基礎、最高等級倍率、V173.42×3與廣告雙倍，不因本次曲線修正擅改。", "evidence": ["js/00-main.js", "js/34-v141-core-systems.js", "HANDOFF.md"]},
        {"id": "EXP-DOCS-01", "status": "IMPLEMENTED", "requirement": "HANDOFF同步最新正式EXP owner與規則，禁止未來再把target battle audit與expNext拆成矛盾兩套。", "evidence": ["HANDOFF.md"]},
    ],
    "automatedVerification": "PENDING_PR_REPOSITORY_CHECKS",
    "verificationRun": None,
    "targetedVerificationRun": None,
    "finalDevVerificationRun": None,
    "visualVerification": "NOT_REQUIRED_LOGIC_ONLY",
    "promotionApproval": "NOT_REQUESTED_MAIN_MUST_REMAIN_UNCHANGED",
    "verifiedOnDevVersion": None,
    "releasedAs": None,
}
batch_path.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("EXP branch edits applied")
