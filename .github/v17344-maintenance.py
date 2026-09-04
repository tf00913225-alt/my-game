from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def one(text, old, new, label, expected=1):
    count=text.count(old)
    if count!=expected:
        raise SystemExit(f"{label}: expected {expected}, got {count}")
    return text.replace(old,new)


# Daily dungeons: all formal normal dungeons unlock when any one role reaches Lv10.
p="js/42-v148-combat-dungeon-fixes.js"
s=read(p)
s=one(s,'requirement:"任一角色達到20級"','requirement:"任一角色達到10級"',"daily requirements",2)
s=one(s,'reward:"通關後可指定1名角色獲得EXP"','reward:"通關EXP直接存入經驗池"',"exp reward copy")
s,n=re.subn(r'    function hasLevel20Character\(\)\{.*?\n    \}',
'''    function hasLevel10Character(){
        return partyIndexes().some(index=>numeric(getPartyCharacterByIndex(index)?.level)>=10);
    }''',s,count=1,flags=re.S)
if n!=1: raise SystemExit("daily helper")
s,n=re.subn(r'        if\(type==="exp"\)\{.*?\n        \}else if\(!hasLevel20Character\(\)\)\{.*?\n        \}',
'''        if(!hasLevel10Character()){
            alert(meta.title+"需要任一角色達到10級才能開啟。");
            return;
        }''',s,count=1,flags=re.S)
if n!=1: raise SystemExit("daily gate")

start=s.index("    function showDailyExpReward(baseExp){")
end=s.index("    function goldDungeonReward(level){",start)
exp='''    function showDailyExpReward(baseExp){
        pendingDailyExpReward={baseExp:Math.max(0,Math.floor(numeric(baseExp)))};
        const html='<div class="v132-reward-modal-inner"><h3>經驗副本挑戰成功！</h3>'+\
            '<p>EXP：<b>'+pendingDailyExpReward.baseExp.toLocaleString("zh-TW")+'</b>，獎勵將直接存入經驗池。</p>'+\
            '<div class="v132-reward-actions">'+\
            '<button type="button" onclick="v148ClaimDailyExpReward(false)">存入經驗池</button>'+\
            '<button type="button" onclick="v148ClaimDailyExpReward(true)">看廣告雙倍存入</button></div></div>';
        if(typeof window.v132ShowRewardModal==="function"){ window.v132ShowRewardModal(html); }
    }

    window.v148ClaimDailyExpReward=function(doubled){
        const pending=pendingDailyExpReward;
        if(!pending){ return; }
        const grant=multiplier=>{
            const amount=Math.max(0,Math.floor(pending.baseExp*multiplier));
            sharedExp=Math.max(0,numeric(sharedExp)+amount);
            pendingDailyExpReward=null;
            if(typeof saveGame==="function"){ saveGame(); }
            if(typeof updateUI==="function"){ updateUI(); }
            if(typeof renderExpDistributeList==="function"){ renderExpDistributeList(); }
            if(typeof addBattleLog==="function"){ addBattleLog("經驗副本結算："+amount+" EXP 已存入經驗池。"); }
            if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
            showPage("dungeon");
            if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
        };
        if(doubled&&typeof showRewardedAd==="function"){ showRewardedAd(()=>grant(2),()=>grant(1)); }
        else{ grant(1); }
    };

'''
s=s[:start]+exp+s[end:]
write(p,s)

# Fix stale V132 compatibility export so the historical layer loads and follows Lv10.
p="js/27-v132-content-expansion.js"
s=read(p)
s=one(s,'    window.v132HasTwoCharactersAtLevel20=hasTwoCharactersAtLevel20;',
'''    window.v132HasLevel10CharacterForDailyDungeon=hasLevel10CharacterForDailyDungeon;
    window.v132HasTwoCharactersAtLevel20=hasLevel10CharacterForDailyDungeon;''',"v132 export")
write(p,s)

# Additional roles start at Lv1; keep only EXP-based catch-up.
p="js/28-v133-economy-rebalance.js"
s=read(p)
s,n=re.subn(r'\n    function grantFastStartToAdditionalCharacter\(character,slotNumber\)\{.*?\n    \}\n\n    function grantDirectCatchUpExp','\n    function grantDirectCatchUpExp',s,count=1,flags=re.S)
if n!=1: raise SystemExit("fast start function")
s=one(s,'            grantFastStartToAdditionalCharacter(character,slotNumber);\n','',"fast start call")
write(p,s)

# Water learning backend is already correct: selected role owner + prerequisite + skill points.
# Make the lock reason explicit so Flood Beast clearly says it needs Water Ball.
p="js/00-main.js"
s=read(p)
s=one(s,'                "🔒 未解鎖"','                "🔒 "+getSkillPrereqLabel(skill)',"skill lock label")
write(p,s)

# V173.44 main-city UHD asset/cache/version.
p="css/46-v154-dev-fixes.css"
s=one(read(p),'home-background-v17343.png','home-background-v17344.png',"home UHD path")
write(p,s)
p="js/20-anonymous-20.js"
s=one(read(p),'const V_ASSET_VERSION="173.42";','const V_ASSET_VERSION="173.44";',"cache version")
write(p,s)
p="index.html"
s=read(p)
if '?v=173.42' not in s: raise SystemExit("index cache key")
s=s.replace('?v=173.42','?v=173.44')
s=one(s,'aria-label="目前版本 V173.42"','aria-label="目前版本 V173.44"',"version aria")
s=one(s,'>V173.42</div>','>V173.44</div>',"version badge")
write(p,s)

# Update existing regression expectations.
p="tests/v173.42-player-flow.test.js"
s=read(p)
s=s.replace('/* Second / third character catch-up is EXP-only after the Lv10 fast start and ends at Lv20. */','/* Second / third character starts at Lv1; catch-up is EXP-only and ends at Lv20. */')
s=one(s,'assert.match(economy,/function grantFastStartToAdditionalCharacter\\(character,slotNumber\\)/);\nassert.match(economy,/character\\.level=10/);','assert.doesNotMatch(economy,/function grantFastStartToAdditionalCharacter\\(character,slotNumber\\)/);\nassert.doesNotMatch(economy,/啟用追趕養成，從 Lv\\.10 開始冒險/);',"fast-start test")
s=one(s,'assert.match(dungeonPolish,/v173GrantCharacterCatchUpExp/);','assert.match(dungeonPolish,/sharedExp=Math\\.max\\(0,numeric\\(sharedExp\\)\\+amount\\)/);\nassert.doesNotMatch(dungeonPolish,/請指定1名角色領取/);',"exp-pool test")
s=s.replace('home-background-v17343\\.png','home-background-v17344\\.png').replace('"assets/ui/home-background-v17343.png"','"assets/ui/home-background-v17344.png"')
write(p,s)

p="tests/v173.44-current-request.test.js"
s=read(p)
anchor='const v131=fs.readFileSync("js/25-v131-fix-batch.js","utf8");'
s=one(s,anchor,anchor+'\nconst economy=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");\nconst main=fs.readFileSync("js/00-main.js","utf8");\nconst water=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");\nconst v132=fs.readFileSync("js/27-v132-content-expansion.js","utf8");\nconst loader=fs.readFileSync("js/20-anonymous-20.js","utf8");\nconst index=fs.readFileSync("index.html","utf8");',"test imports")
s=one(s,'assert.match(battle,/material:\\{title:"材料副本",requirement:"任一角色達到20級"/);','assert.match(battle,/material:\\{title:"材料副本",requirement:"任一角色達到10級"/);',"material test")
s=one(s,'assert.match(battle,/gold:\\{title:"金幣副本",requirement:"任一角色達到20級"/);','assert.match(battle,/gold:\\{title:"金幣副本",requirement:"任一角色達到10級"/);',"gold test")
checks=r'''
assert.match(battle,/exp:\{title:"經驗副本",requirement:"任一角色達到10級",reward:"通關EXP直接存入經驗池"/);
assert.match(battle,/function hasLevel10Character\(\)/);
assert.doesNotMatch(battle,/hasLevel20Character/);
assert.match(battle,/sharedExp=Math\.max\(0,numeric\(sharedExp\)\+amount\)/);
assert.doesNotMatch(battle,/請指定1名角色領取/);
assert.doesNotMatch(economy,/grantFastStartToAdditionalCharacter/);
assert.match(v132,/v132HasTwoCharactersAtLevel20=hasLevel10CharacterForDailyDungeon/);
assert.match(main,/"🔒 "\+getSkillPrereqLabel\(skill\)/);
assert.match(water,/floodBeast:\{[\s\S]*?learnCost:15[\s\S]*?requires:\["waterBall"\]/);
assert.match(main,/function learnSkill\(skillId\)[\s\S]*?isSkillPrereqMet\(character\.skillLevels,skill\)[\s\S]*?availablePoints<learnCost[\s\S]*?owner\.skillPoints=availablePoints-learnCost/);
assert.match(abyssCss,/home-background-v17344\.png/);
assert.equal(fs.existsSync("assets/ui/home-background-v17344.png"),true,"assets/ui/home-background-v17344.png");
assert.match(loader,/const V_ASSET_VERSION="173\.44"/);
assert.match(index,/id="homeVersionBadge"[\s\S]*?aria-label="目前版本 V173\.44"[\s\S]*?>V173\.44<\/div>/);
'''
s=one(s,'console.log("✓ V173.44 current request regression passed");',checks+'\nconsole.log("✓ V173.44 current request regression passed");',"test tail")
write(p,s)

# Persist dev deployment truth for future conversations/agents.
note='''\n\n## DEV 預覽發布規則（2026-09-04 起）\n- `dev` 仍是唯一開發分支；預覽需求不得改動 `main`。\n- `dev` 每次 push 後，由 `.github/workflows/deploy-dev-cloudflare.yml` 自動部署 Cloudflare Pages。\n- 固定 DEV 測試網址：`https://four-symbols-dev.pages.dev`。\n- 不再使用 GitHack / RawGitHack / RawCDN 作為 `dev` 測試站，避免大量 CSS/JS/素材請求遭 429 限流造成裸 HTML 或新舊資源混載。\n- `assets-library` 與 `assets-library/assets/inbox/` 仍留在 GitHub，素材讀取與整理流程不受 Cloudflare Pages 影響。\n'''
for doc in ("HANDOFF.md","AGENTS.md"):
    q=Path(doc)
    if q.exists():
        t=q.read_text(encoding="utf-8")
        if 'https://four-symbols-dev.pages.dev' not in t:
            q.write_text(t.rstrip()+note,encoding="utf-8")
