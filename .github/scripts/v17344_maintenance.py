from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def once(content, old, new, label):
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return content.replace(old, new, 1)


# 1) Formal daily dungeons: all three unlock when any one character reaches Lv10.
path = "js/42-v148-combat-dungeon-fixes.js"
s = read(path)
s = once(
    s,
    '''    const DAILY_DUNGEON_META={
        exp:{title:"經驗副本",requirement:"任一角色達到10級",reward:"通關後可指定1名角色獲得EXP",legacyType:"exp"},
        material:{title:"材料副本",requirement:"任一角色達到20級",reward:"材料寶箱 ×1～3",legacyType:"material"},
        gold:{title:"金幣副本",requirement:"任一角色達到20級",reward:"大量金幣",legacyType:"equipment"}
    };''',
    '''    const DAILY_DUNGEON_META={
        exp:{title:"經驗副本",requirement:"任一角色達到10級",reward:"共用經驗池 EXP",legacyType:"exp"},
        material:{title:"材料副本",requirement:"任一角色達到10級",reward:"材料寶箱 ×1～3",legacyType:"material"},
        gold:{title:"金幣副本",requirement:"任一角色達到10級",reward:"大量金幣",legacyType:"equipment"}
    };''',
    "daily meta",
)
s = once(
    s,
    '''    function hasLevel20Character(){
        return partyIndexes().some(index=>numeric(getPartyCharacterByIndex(index)?.level)>=20);
    }''',
    '''    function hasLevel10Character(){
        return partyIndexes().some(index=>numeric(getPartyCharacterByIndex(index)?.level)>=10);
    }''',
    "daily level helper",
)
s = once(
    s,
    '''        if(type==="exp"){
            const ready=partyIndexes().some(index=>numeric(getPartyCharacterByIndex(index)?.level)>=10);
            if(!ready){ alert("經驗副本需要任一角色達到10級才能開啟。"); return; }
        }else if(!hasLevel20Character()){
            alert(meta.title+"需要任一角色達到20級才能開啟。");
            return;
        }''',
    '''        if(!hasLevel10Character()){
            alert(meta.title+"需要任一角色達到10級才能開啟。");
            return;
        }''',
    "daily gate",
)
start = s.index("    function showDailyExpReward(baseExp){")
end = s.index("    function showDailyGoldReward(amount){", start)
replacement = '''    function finishDailyExpReward(amount){
        const granted=Math.max(0,Math.floor(numeric(amount)));
        if(granted<=0){ return; }
        sharedExp=Math.max(0,numeric(sharedExp)+granted);
        if(typeof addBattleLog==="function"){
            addBattleLog("經驗副本：共用經驗池獲得"+granted+" EXP。");
        }
        pendingDailyExpReward=null;
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
        showPage("dungeon");
        if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
    }

    function showDailyExpReward(baseExp){
        pendingDailyExpReward={baseExp:Math.max(0,Math.floor(numeric(baseExp)))};
        const html='<div class="v132-reward-modal-inner"><h3>經驗副本挑戰成功！</h3>'+ 
            '<p>共用經驗池可獲得：<b>'+pendingDailyExpReward.baseExp.toLocaleString("zh-TW")+' EXP</b></p>'+ 
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v148ClaimDailyExpReward(false)">直接領取</button>'+ 
            '<button type="button" onclick="v148ClaimDailyExpReward(true)">看廣告雙倍領取</button>'+ 
            '<span class="v132-reward-note">獎勵直接加入共用經驗池，不再指定角色。</span></div></div>';
        if(typeof window.v132ShowRewardModal==="function"){ window.v132ShowRewardModal(html); }
    }

    window.v148ClaimDailyExpReward=function(doubled){
        const pending=pendingDailyExpReward;
        if(!pending){ return; }
        const grant=multiplier=>finishDailyExpReward(Math.floor(pending.baseExp*multiplier));
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        }else{
            grant(1);
        }
    };

'''
s = s[:start] + replacement + s[end:]
write(path, s)

# 2) Legacy fallback and older daily UI use the same Lv10 unlock rule.
path = "js/27-v132-content-expansion.js"
s = read(path)
s = s.replace("function hasTwoCharactersAtLevel20(){", "function hasLevel10CharacterForDailyDungeon(){")
s = s.replace("return character && (Number(character.level)||1)>=20;", "return character && (Number(character.level)||1)>=10;")
s = s.replace("}).length>=2;", "}).length>=1;", 1)
s = s.replace("hasTwoCharactersAtLevel20()", "hasLevel10CharacterForDailyDungeon()")
s = s.replace("材料副本需要至少兩名角色都達到20級才能開啟。", "材料副本需要任一角色達到10級才能開啟。")
s = s.replace("裝備副本需要至少兩名角色都達到20級才能開啟。", "裝備副本需要任一角色達到10級才能開啟。")
s = s.replace('"material","材料副本","至少兩名角色達到20級",', '"material","材料副本","任一角色達到10級",')
s = s.replace('"equipment","裝備副本","至少兩名角色達到20級",', '"equipment","裝備副本","任一角色達到10級",')
write(path, s)

path = "js/35-v141-ui-battle.js"
s = read(path)
s = s.replace('material:{title:"材料副本",requirement:"至少兩名角色達到20級"', 'material:{title:"材料副本",requirement:"任一角色達到10級"')
s = s.replace('equipment:{title:"裝備副本",requirement:"至少兩名角色達到20級"', 'equipment:{title:"裝備副本",requirement:"任一角色達到10級"')
s = s.replace('exp:{title:"經驗副本",requirement:"單一角色達到10級",reward:"當前升級需求平均值的33% EXP"', 'exp:{title:"經驗副本",requirement:"任一角色達到10級",reward:"共用經驗池 EXP"')
write(path, s)

# 3) Remove forced Lv10 for newly created second/third characters.
path = "js/28-v133-economy-rebalance.js"
s = read(path)
s, count = re.subn(
    r"\n    function grantFastStartToAdditionalCharacter\(character,slotNumber\)\{.*?\n    \}\n(?=\n    function )",
    "\n",
    s,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"fast-start function removal: {count}")
s = once(s, "            grantFastStartToAdditionalCharacter(character,slotNumber);\n", "", "fast-start call")
write(path, s)

# 4) Skill learning uses normalized numeric owner points/cost.
path = "js/00-main.js"
s = read(path)
s = once(
    s,
    '''    const availableSkillPoints=
        skillOwner
        ?
        skillOwner.skillPoints
        :
        0;''',
    '''    const availableSkillPoints=Math.max(
        0,
        Number(skillOwner ? skillOwner.skillPoints : 0)||0
    );''',
    "skill UI numeric points",
)
s = once(
    s,
    '''    if(
        owner.skillPoints<
        skill.learnCost
    ){

        alert(
            "技能點不足，需要"+
            skill.learnCost+
            "點。"
        );

        return;

    }


    owner.skillPoints-=
        skill.learnCost;''',
    '''    const learnCost=Math.max(0,Number(skill.learnCost)||0);
    const availablePoints=Math.max(0,Number(owner.skillPoints)||0);

    if(availablePoints<learnCost){
        alert(
            "技能點不足，需要"+
            learnCost+
            "點。"
        );
        return;
    }

    owner.skillPoints=availablePoints-learnCost;''',
    "core learnSkill numeric cost",
)
write(path, s)

# Water final-data owner: refresh the current skill page after authoritative values apply.
path = "js/50-v169-water-skill-rules.js"
s = read(path)
s = once(
    s,
    '''    applyFinalSkillData();
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){''',
    '''    applyFinalSkillData();
    if(typeof renderSkillLoadout==="function"){
        renderSkillLoadout();
    }
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){''',
    "water skill UI refresh",
)
write(path, s)

# 5) Maintenance version / home-city HUD and asset cache owner.
path = "index.html"
s = read(path).replace("173.42", "173.44")
write(path, s)
path = "js/20-anonymous-20.js"
s = read(path)
s = once(s, 'const V_ASSET_VERSION="173.42";', 'const V_ASSET_VERSION="173.44";', "asset cache version")
write(path, s)

# 6) Persistent dev deployment handoff for future chats/agents.
path = "AGENTS.md"
s = read(path)
note = '''\n## DEV 發布與測試位置
- `main` 仍是正式版來源，除非使用者明確要求，不得把開發修改直接推進 `main`。
- `dev` 每次 push 由 `.github/workflows/deploy-dev-cloudflare.yml` 自動部署到 Cloudflare Pages。
- DEV 唯一固定測試網址：`https://four-symbols-dev.pages.dev`。
- 不再使用 GitHack / RawCDN 作為 DEV 驗證來源。
'''
if "https://four-symbols-dev.pages.dev" not in s:
    s = s.rstrip() + "\n" + note
write(path, s)

# 7) Targeted regression suite.
Path("tests/v173.44-maintenance.test.js").write_text(r'''const assert=require("assert");
const fs=require("fs");
const read=p=>fs.readFileSync(p,"utf8");
const dungeon=read("js/42-v148-combat-dungeon-fixes.js");
const legacy=read("js/27-v132-content-expansion.js");
const economy=read("js/28-v133-economy-rebalance.js");
const main=read("js/00-main.js");
const water=read("js/50-v169-water-skill-rules.js");
const index=read("index.html");
const loader=read("js/20-anonymous-20.js");
const agents=read("AGENTS.md");
assert.match(dungeon,/material:\{title:"材料副本",requirement:"任一角色達到10級"/);
assert.match(dungeon,/gold:\{title:"金幣副本",requirement:"任一角色達到10級"/);
assert.match(dungeon,/function hasLevel10Character\(\)/);
assert.doesNotMatch(dungeon,/請指定1名角色領取/);
assert.match(dungeon,/sharedExp=Math\.max\(0,numeric\(sharedExp\)\+granted\)/);
assert.match(legacy,/function hasLevel10CharacterForDailyDungeon\(\)/);
assert.doesNotMatch(legacy,/至少兩名角色都達到20級才能開啟/);
assert.doesNotMatch(economy,/grantFastStartToAdditionalCharacter/);
assert.doesNotMatch(economy,/character\.level=10/);
assert.match(main,/function buildAdditionalCharacter[\s\S]*?level:1,[\s\S]*?exp:0,/);
assert.match(water,/floodBeast:\{[\s\S]*?learnCost:15[\s\S]*?requires:\["waterBall"\]/);
assert.match(main,/const learnCost=Math\.max\(0,Number\(skill\.learnCost\)\|\|0\)/);
assert.match(main,/owner\.skillPoints=availablePoints-learnCost/);
assert.match(water,/applyFinalSkillData\(\);[\s\S]*?renderSkillLoadout\(\)/);
assert.match(index,/<title>四象江湖傳 V173\.44<\/title>/);
assert.match(index,/aria-label="目前版本 V173\.44"[\s\S]*?>V173\.44<\/div>/);
assert.match(loader,/const V_ASSET_VERSION="173\.44"/);
assert.match(agents,/https:\/\/four-symbols-dev\.pages\.dev/);
console.log("V173.44 maintenance regression checks passed");
''', encoding="utf-8")

# Existing tests that explicitly follow the current release/cache number.
for test_path in Path("tests").glob("*.js"):
    if test_path.name == "v173.44-maintenance.test.js":
        continue
    text = test_path.read_text(encoding="utf-8")
    if "173.42" in text or "173\\.42" in text:
        text = text.replace("173\\.42", "173\\.44").replace("173.42", "173.44")
        test_path.write_text(text, encoding="utf-8")

print("V173.44 maintenance patch applied")
