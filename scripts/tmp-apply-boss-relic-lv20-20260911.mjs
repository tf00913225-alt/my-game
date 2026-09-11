import fs from "node:fs";
import path from "node:path";

const ROOT=process.cwd();
function file(rel){ return path.join(ROOT,rel); }
function replaceOnce(rel,before,after){
    const target=file(rel);
    const source=fs.readFileSync(target,"utf8");
    const first=source.indexOf(before);
    if(first<0){ throw new Error(`Patch anchor missing in ${rel}: ${before.slice(0,100)}`); }
    if(source.indexOf(before,first+before.length)>=0){ throw new Error(`Patch anchor is not unique in ${rel}`); }
    fs.writeFileSync(target,source.slice(0,first)+after+source.slice(first+before.length));
}
function writeNew(rel,content){
    const target=file(rel);
    if(fs.existsSync(target)){ throw new Error(`Refusing to overwrite existing ${rel}`); }
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,content.endsWith("\n")?content:content+"\n");
}

// 1) Boss mechanism durability: these sidecar cards must survive meaningful focused damage.
replaceOnce("js/gameplay-boss-tower-system.js",
`        shield:Object.freeze({type:"shield",kind:"護盾",name:"金剛護體",hpRatio:.18,defenseRatio:.85,priority:100,effect:"存在期間 BOSS 無法被指定或受到新的直接傷害／異常。"}),
        charge:Object.freeze({type:"charge",kind:"蓄力",name:"滅魂陣",hpRatio:.14,defenseRatio:.72,priority:90,countdown:2,effect:"倒數歸零時發動有預告的大型攻擊；破壞可取消。"}),
        heal:Object.freeze({type:"heal",kind:"圖騰",name:"血祭圖騰",hpRatio:.13,defenseRatio:.68,priority:80,healRatio:.04,effect:"存在期間，每回合恢復 BOSS 4% 最大生命。"}),
        amplify:Object.freeze({type:"amplify",kind:"法陣",name:"煞氣法陣",hpRatio:.12,defenseRatio:.72,priority:70,damageMultiplier:1.25,effect:"存在期間，BOSS 造成傷害提高 25%。"}),
        seal:Object.freeze({type:"seal",kind:"封鎖",name:"鎖脈禁制",hpRatio:.12,defenseRatio:.72,priority:60,healingMultiplier:.6,effect:"存在期間，我方治療與 SP 回復效果降低 40%。"})`,
`        shield:Object.freeze({type:"shield",kind:"護盾",name:"金剛護體",hpRatio:.32,defenseRatio:.95,priority:100,effect:"存在期間 BOSS 無法被指定或受到新的直接傷害／異常。"}),
        charge:Object.freeze({type:"charge",kind:"蓄力",name:"滅魂陣",hpRatio:.26,defenseRatio:.88,priority:90,countdown:2,effect:"倒數歸零時發動有預告的大型攻擊；破壞可取消。"}),
        heal:Object.freeze({type:"heal",kind:"圖騰",name:"血祭圖騰",hpRatio:.24,defenseRatio:.82,priority:80,healRatio:.04,effect:"存在期間，每回合恢復 BOSS 4% 最大生命。"}),
        amplify:Object.freeze({type:"amplify",kind:"法陣",name:"煞氣法陣",hpRatio:.22,defenseRatio:.85,priority:70,damageMultiplier:1.25,effect:"存在期間，BOSS 造成傷害提高 25%。"}),
        seal:Object.freeze({type:"seal",kind:"封鎖",name:"鎖脈禁制",hpRatio:.22,defenseRatio:.85,priority:60,healingMultiplier:.6,effect:"存在期間，我方治療與 SP 回復效果降低 40%。"})`);

// 2) Level-20 starter relic guarantee belongs to the acquisition/progression owner.
replaceOnce("js/relic-progression-drop-system.js",
`    const ACTIVE_UID=accountRepository.getActiveUid();
    const STATE_VERSION=1;
    const RECEIPT_STALE_MS=6*60*60*1000;`,
`    const ACTIVE_UID=accountRepository.getActiveUid();
    const STATE_VERSION=1;
    const RECEIPT_STALE_MS=6*60*60*1000;
    const STARTER_RELIC_LEVEL=20;
    const STARTER_RELIC_IDS=Object.freeze(["relic_qiankun_flask","relic_xuanwu_seal"]);`);

replaceOnce("js/relic-progression-drop-system.js",
`    function readMainSave(){
        if(!ACTIVE_UID){ return null; }
        try{
            const result=accountRepository.readForUid(ACTIVE_UID);
            return result.status==="ready"?result.save:null;
        }catch(_){ return null; }
    }

    function initializeOwnershipPolicy(){`,
`    function readMainSave(){
        if(!ACTIVE_UID){ return null; }
        try{
            const result=accountRepository.readForUid(ACTIVE_UID);
            return result.status==="ready"?result.save:null;
        }catch(_){ return null; }
    }
    function firstCharacterLevel(){
        const host=progressionHost();
        return Math.max(1,integer(host&&host.level,1));
    }
    function ensureStarterRelics(){
        if(firstCharacterLevel()<STARTER_RELIC_LEVEL){ return false; }
        const owned=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        if(!owned||typeof owned!=="object"){ return false; }
        const changed=[];
        STARTER_RELIC_IDS.forEach(id=>{
            const def=catalog[id],entry=owned[id];
            if(!def||def.runtimeReady!==true||def.rarity!=="blue"||!entry||entry.unlocked===true){ return; }
            changed.push({entry:entry,unlocked:entry.unlocked,level:entry.level,seen:entry.seen});
            entry.unlocked=true;
            entry.level=Math.max(1,integer(entry.level,1));
            entry.seen=false;
        });
        if(!changed.length){ return false; }
        if(persistCore()){ return true; }
        changed.forEach(snapshot=>{
            snapshot.entry.unlocked=snapshot.unlocked;
            snapshot.entry.level=snapshot.level;
            snapshot.entry.seen=snapshot.seen;
        });
        console.error("Lv20 初始藍階秘寶解鎖寫入失敗，已還原本次變更。");
        return false;
    }

    function initializeOwnershipPolicy(){`);

replaceOnce("js/relic-progression-drop-system.js",
`        window.v174OpenRelicPage=function(){ currentRelicDetailId=null;const result=originalOpenRelicPage.apply(this,arguments);decorateRelicSurface();return result; };`,
`        window.v174OpenRelicPage=function(){ ensureStarterRelics();currentRelicDetailId=null;const result=originalOpenRelicPage.apply(this,arguments);decorateRelicSurface();return result; };`);

replaceOnce("js/relic-progression-drop-system.js",
`        window.openHomeFeature=function(type){
            const result=original.apply(this,arguments);
            if(type==="relic"){ currentRelicDetailId=null;decorateRelicSurface(); }
            return result;
        };`,
`        window.openHomeFeature=function(type){
            if(type==="relic"){ ensureStarterRelics(); }
            const result=original.apply(this,arguments);
            if(type==="relic"){ currentRelicDetailId=null;decorateRelicSurface(); }
            return result;
        };`);

replaceOnce("js/relic-progression-drop-system.js",
`    function decorateAllSurfaces(){ decorateRelicSurface();decorateBossSurface();decorateTowerSurface(); }`,
`    function decorateAllSurfaces(){ ensureStarterRelics();decorateRelicSurface();decorateBossSurface();decorateTowerSurface(); }`);

replaceOnce("js/relic-progression-drop-system.js",
`    window.RelicProgressionSystem=Object.freeze({
        stateVersion:STATE_VERSION,`,
`    window.RelicProgressionSystem=Object.freeze({
        stateVersion:STATE_VERSION,
        starterRelicLevel:STARTER_RELIC_LEVEL,
        starterRelicIds:STARTER_RELIC_IDS,
        ensureStarterRelics:ensureStarterRelics,`);

replaceOnce("js/relic-progression-drop-system.js",
`    hydrateOwnedItemPresentation();
    initializeOwnershipPolicy();
    reconcilePending();`,
`    hydrateOwnedItemPresentation();
    initializeOwnershipPolicy();
    ensureStarterRelics();
    reconcilePending();`);

// 3) Extend Boss runtime tests with real element metadata and this batch's balance guarantees.
replaceOnce("tests/gameplay-boss-tower-system.test.js",
`            strike:{id:"strike",name:"破陣斬",element:"fire",category:"physical",targetType:"single",baseDamage:100,spCost:5}
        },`,
`            strike:{id:"strike",name:"破陣斬",element:"fire",category:"physical",targetType:"single",baseDamage:100,spCost:5},
            fireRocket:{id:"fireRocket",element:"fire",category:"magic"},
            explosiveFlurry:{id:"explosiveFlurry",element:"fire",category:"physical"},
            dragonSlash:{id:"dragonSlash",element:"fire",category:"physical"},
            rage:{id:"rage",element:"fire",category:"buff"},
            stoneSlash:{id:"stoneSlash",element:"earth",category:"physical"},
            flyingSandStrike:{id:"flyingSandStrike",element:"earth",category:"magic"},
            dustStorm:{id:"dustStorm",element:"earth",category:"magic"},
            rockWall:{id:"rockWall",element:"earth",category:"buff"},
            waterKnife:{id:"waterKnife",element:"water",category:"physical"},
            frostPunch:{id:"frostPunch",element:"water",category:"physical"},
            floodBeast:{id:"floodBeast",element:"water",category:"magic"},
            healSpell:{id:"healSpell",element:"water",category:"heal"},
            stormFlurry:{id:"stormFlurry",element:"wind",category:"physical"},
            windCrossSlash:{id:"windCrossSlash",element:"wind",category:"physical"},
            windHowlLightning:{id:"windHowlLightning",element:"wind",category:"magic"},
            dodgeSkill:{id:"dodgeSkill",element:"wind",category:"buff"}
        },`);

const bossTests=String.raw`
test("Boss balance is calibrated to same-level two-character early teams and three-character late teams",()=>{
    const {context}=load();
    const personal=value(context,"GameplaySystem.personalBosses");
    const world=value(context,"GameplaySystem.worldBosses");
    assert.deepEqual(personal.slice(0,4).map(item=>item.recommendedParty),[2,2,2,2]);
    assert.ok(personal.slice(4).every(item=>item.recommendedParty===3));
    assert.equal(world[0].recommendedParty,2);
    assert.ok(world.slice(1).every(item=>item.recommendedParty===3));
    assert.ok(personal.every(item=>item.hpMultiplier>=7.2&&item.defenseMultiplier>=1.28));
    assert.ok(world.every(item=>item.hpMultiplier>=10&&item.defenseMultiplier>=1.5));
    const names=[...personal,...world].map(item=>item.name);
    assert.equal(new Set(names).size,names.length,"all fixed Boss names must be distinct");
    assert.ok(names.every(name=>name.includes("・")&&!/天兵天將|野怪|精英/.test(name)),"Boss names must stay visually distinct from generic monster naming");
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    assert.equal(context.monsters[0].maxHP,7200);
    assert.equal(context.monsters[0].attack,122);
    assert.equal(context.monsters[0].defense,128);
});

test("every Boss action loadout is filtered to the Boss element",()=>{
    for(const type of ["personal","world"]){
        const probe=load();
        const ids=value(probe.context,type==="personal"?"GameplaySystem.personalBosses.map(item=>item.id)":"GameplaySystem.worldBosses.map(item=>item.id)");
        for(const id of ids){
            const {context}=load();
            assert.equal(context.vGameplayStartBoss(type,id),true);
            const boss=context.monsters[0];
            for(const skillId of [...boss.skillIds,...(boss.v141SupportSkillIds||[])]){
                assert.equal(context.skillDatabase[skillId].element,boss.element,`${id} contains cross-element skill ${skillId}`);
            }
        }
    }
    const {context}=load();
    const towerBoss=context.GameplaySystem.buildTowerRoster(100)[0];
    for(const skillId of [...towerBoss.skillIds,...(towerBoss.v141SupportSkillIds||[])]){
        assert.equal(context.skillDatabase[skillId].element,towerBoss.element);
    }
});

test("mechanism cards have meaningful durability instead of one-token HP",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-20");
    context.turn=2;context.startTurn(context.battleToken);
    const boss=context.monsters[0];
    const shield=value(context,"GameplaySystem.getActiveBattleState().mechanisms[0]");
    assert.equal(shield.type,"shield");
    assert.ok(shield.maxHP>=Math.round(boss.maxHP*.31));
    assert.ok(shield.defense>=Math.round(boss.defense*.9));
});

test("selected Boss encounters summon two real same-element elite reinforcements",()=>{
    const {context}=load();
    context.vGameplayStartBoss("personal","personal-30");
    const boss=context.monsters[0];
    boss.hp=Math.floor(boss.maxHP*.49);
    context.turn=2;context.startTurn(context.battleToken);
    assert.equal(context.monsters.length,3);
    assert.deepEqual(context.currentBattleMonsters,[0,1,2]);
    const guards=context.monsters.slice(1);
    assert.ok(guards.every(unit=>unit.vGameplayBossSummon===true&&unit.rank==="elite"&&unit.element===boss.element));
    assert.equal(new Set(guards.map(unit=>unit.name)).size,2);
    guards.forEach(unit=>[...unit.skillIds,...(unit.v141SupportSkillIds||[])].forEach(skillId=>{
        assert.equal(context.skillDatabase[skillId].element,boss.element);
    }));
});
`;
replaceOnce("tests/gameplay-boss-tower-system.test.js",
`console.log(\`All \${passed} Gameplay / BOSS / Tower runtime tests passed.\`);`,
bossTests+`\nconsole.log(\`All \${passed} Gameplay / BOSS / Tower runtime tests passed.\`);`);

// 4) Verify the first-character Lv20 guarantee inside the existing progression test owner.
replaceOnce("tests/v174-relic-progression-drop-system.test.js",
`{
    const {owned}=makeContext({explicitRelics:true});
    assert.equal(owned.relic_qiankun_flask.unlocked,true,"existing explicit relic ownership must never be revoked");
}

/* 100 specific;`,
`{
    const {owned}=makeContext({explicitRelics:true});
    assert.equal(owned.relic_qiankun_flask.unlocked,true,"existing explicit relic ownership must never be revoked");
}
{
    const {context,owned,saveDoc}=makeContext({savedPlayer:{id:"QA",level:20}});
    assert.equal(context.RelicProgressionSystem.starterRelicLevel,20);
    assert.deepEqual(Array.from(context.RelicProgressionSystem.starterRelicIds),["relic_qiankun_flask","relic_xuanwu_seal"]);
    assert.equal(owned.relic_qiankun_flask.unlocked,true,"Lv20 must guarantee the first blue starter relic");
    assert.equal(owned.relic_xuanwu_seal.unlocked,true,"Lv20 must guarantee the second blue starter relic");
    assert.equal(owned.relic_qinglan_feather.unlocked,false,"the Lv20 guarantee must not silently unlock every blue relic");
    assert.equal(context.v174RelicSystem.catalog.relic_qiankun_flask.rarity,"blue");
    assert.equal(context.v174RelicSystem.catalog.relic_xuanwu_seal.rarity,"blue");
    assert.equal(saveDoc.playerRelics.relic_qiankun_flask.unlocked,true,"starter relic ownership must persist through the existing main save");
    assert.equal(saveDoc.playerRelics.relic_xuanwu_seal.unlocked,true);
}

/* 100 specific;`);

// 5) Actual headless-mobile browser QA for the 16:9 covers and element-counter layout.
writeNew("tests/gameplay-ui-mobile-browser.test.js",String.raw`"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const candidates=[process.env.CHROME_PATH,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean);
const chrome=candidates.find(candidate=>fs.existsSync(candidate));
assert.ok(chrome,"Headless Chrome/Chromium is required for Gameplay mobile UI QA");
const css=["css/gameplay-boss-tower.css","css/56-v174-critical-ui-regressions.css"].map(file=>fs.readFileSync(file,"utf8")).join("\n");
const html="<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"+
"<style>html,body{margin:0;width:390px;min-height:844px;background:#000}#game-stage{width:390px;height:844px}"+css.replace(/<\\/style/gi,"<\\\\/style")+"</style>"+
"<div id='game-stage'><div class='gameplay-hub-grid'><button class='gameplay-mode-card boss'><span class='gameplay-mode-copy'><h3>BOSS</h3><p>個人 BOSS・世界 BOSS</p><span class='gameplay-mode-status'>測試</span></span><span class='gameplay-mode-seal'>戰</span></button></div></div>"+
"<div id='allElementSkillPreviewModal'><div class='skill-preview-body'></div></div>"+
"<script>(function(){var card=document.querySelector('.gameplay-mode-card');var r=card.getBoundingClientRect();var hint=getComputedStyle(document.querySelector('.skill-preview-body'),'::before');var out={width:r.width,height:r.height,ratio:r.width/r.height,content:hint.content,whiteSpace:hint.whiteSpace,textAlign:hint.textAlign,fontSize:parseFloat(hint.fontSize),overflowX:document.documentElement.scrollWidth-window.innerWidth};document.body.setAttribute('data-qa',encodeURIComponent(JSON.stringify(out)));})();<\\/script>";
const temp=path.join(os.tmpdir(),"four-symbols-gameplay-ui-qa.html");
fs.writeFileSync(temp,html);
const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars","--window-size=390,844","--virtual-time-budget=1000","--dump-dom","file://"+temp],{encoding:"utf8",maxBuffer:16*1024*1024});
if(result.status!==0){ console.error(result.stderr); }
assert.equal(result.status,0,"headless mobile browser QA must launch successfully");
const match=result.stdout.match(/data-qa="([^"]+)"/);
assert.ok(match,"mobile QA payload must be present in dumped DOM");
const metrics=JSON.parse(decodeURIComponent(match[1].replace(/&amp;/g,"&")));
assert.ok(metrics.width>300&&metrics.height>150,"gameplay cover must have real mobile geometry");
assert.ok(Math.abs(metrics.ratio-(16/9))<0.03,"activity cover must render at 16:9, got "+metrics.ratio);
assert.match(metrics.content,/克制：/);
assert.match(metrics.content,/被克制：/);
assert.equal(metrics.whiteSpace,"pre-line");
assert.equal(metrics.textAlign,"left");
assert.ok(metrics.fontSize>=15);
assert.ok(metrics.overflowX<=1,"focused mobile fixture must not create horizontal overflow");
console.log("✓ Gameplay mobile browser QA: 16:9 covers and directional element-counter copy verified.");
`);

// 6) Requirement checklist for this four-item batch. Integration/deployment stay pending by instruction.
writeNew("release/requirement-batches/2026-09-11-boss-balance-gameplay-relic-lv20.json",JSON.stringify({
    date:"2026-09-11",
    title:"Boss balance, Gameplay 16:9 covers, element-counter copy, Lv20 starter relics",
    base_branch:"dev",
    base_sha:"eb9e9d78911ca5d72693c33aaab6002238291494",
    work_branch:"feature/boss-balance-gameplay-relic-lv20-20260911",
    officialVersion:"173.65",
    status:"IMPLEMENTED",
    requirements:[
        {id:"boss-balance",status:"IMPLEMENTED",request:"Recalibrate all BOSS strength to same-level party size, raise mechanism durability, allow selected encounters to summon two same-element elites, enforce Boss element/skill consistency, and use distinctive Boss names.",owner:["js/gameplay-boss-tower-system.js"],verification:["tests/gameplay-boss-tower-system.test.js","Repository checks / CI pending"]},
        {id:"gameplay-cover-16-9",status:"IMPLEMENTED",request:"Change Gameplay activity covers to 16:9.",owner:["css/gameplay-boss-tower.css"],verification:["tests/gameplay-ui-mobile-browser.test.js","Repository checks / CI pending"]},
        {id:"element-counter-preview-copy",status:"IMPLEMENTED",request:"Improve all-element skill preview counter layout and explain countering versus being countered.",owner:["css/56-v174-critical-ui-regressions.css"],verification:["tests/gameplay-ui-mobile-browser.test.js","Repository checks / CI pending"]},
        {id:"lv20-starter-relics",status:"IMPLEMENTED",request:"When the first character reaches Lv20, guarantee at least two blue relics are unlocked and usable.",owner:["js/relic-progression-drop-system.js"],verification:["tests/v174-relic-progression-drop-system.test.js","Repository checks / CI pending"]}
    ],
    pending:["Do not merge this branch into dev in this task.","DEV deployment/live verification is intentionally pending until an explicit later integration request."]
},null,2));

console.log("Focused 2026-09-11 Boss / Gameplay / Relic patches applied.");
