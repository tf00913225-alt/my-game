/* =====================================================
   V158 — final skill, hit, damage and monster evasion tuning
===================================================== */
(function installV158CombatTuning(){
    "use strict";

    if(typeof window==="undefined"||window.__v158CombatTuningInstalled){ return; }
    window.__v158CombatTuningInstalled=true;

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clamp(value,min,max){
        return Math.max(min,Math.min(max,value));
    }

    /* Hit chance is owned by js/00-main.js. V158 must not override it. */

    function normalizeMonsterDefaultEvasion(monster){
        if(!monster){ return monster; }
        if(monster.evasion===undefined){ monster.evasion=0; }
        return monster;
    }

    function normalizeBeginnerForestMonster(monster){
        if(!monster){ return monster; }
        monster.v173BeginnerForest=true;
        normalizeMonsterDefaultEvasion(monster);
        return monster;
    }

    window.v158NormalizeMonsterDefaultEvasion=normalizeMonsterDefaultEvasion;
    window.v17342NormalizeBeginnerForestMonster=normalizeBeginnerForestMonster;
    window.v17344IsFormalDailyDungeonMonster=monster=>!!(monster&&monster.mode==="daily");

    if(typeof zoneConfig!=="undefined"){
        Object.keys(zoneConfig).forEach(key=>{
            const config=zoneConfig[key];
            const entries=config&&typeof config.monsters==="function"
                ?config.monsters()
                :[];
            (entries||[]).forEach(monster=>{
                normalizeMonsterDefaultEvasion(monster);
                if(key==="forest"){ normalizeBeginnerForestMonster(monster); }
            });
        });
    }

    if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
        monsters.forEach(monster=>{
            normalizeMonsterDefaultEvasion(monster);
            if(monster&&monster.v173BeginnerForest===true){ normalizeBeginnerForestMonster(monster); }
        });
    }

    if(typeof rollBeginnerForestNormalAttackDamage==="function"){
        rollBeginnerForestNormalAttackDamage=function(){
            return 5+Math.floor(Math.random()*4);
        };
    }

    /* getMonsterEvasion() remains the single core owner; no late V158 wrapper. */


    /* Solo Lv1-20 formal daily protection: wave 1 is normal-attack only.
       From wave 2 onward skills are allowed at a reduced rate; a BOSS that just
       used a skill must perform one non-skill action before another skill. */
    if(typeof processSingleMonsterAttack==="function"){
        const previousDailyProtectedMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(!monster||monster.v173DailySoloProtected!==true||monster.v141Abyss===true){
                return previousDailyProtectedMonsterAttack.apply(this,arguments);
            }
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster.rank||"regular");
            const forceNormal=Number(monster.v141DungeonStage)===1||
                (rank==="boss"&&monster.v173DailyBossUsedSkillLastAction===true);
            const savedSkillIds=monster.skillIds;
            const savedSupports=monster.v141SupportSkillIds;
            const savedChance=monster.skillChance;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            let usedSkill=false;
            if(forceNormal){
                monster.skillIds=[];
                monster.v141SupportSkillIds=[];
                monster.skillChance=0;
            }
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(String(name||"")!=="普通攻擊"){ usedSkill=true; }
                    return previousBadge.apply(this,arguments);
                };
            }
            try{
                return previousDailyProtectedMonsterAttack.apply(this,arguments);
            }finally{
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(forceNormal){
                    monster.skillIds=savedSkillIds;
                    monster.v141SupportSkillIds=savedSupports;
                    monster.skillChance=savedChance;
                }
                if(rank==="boss"){ monster.v173DailyBossUsedSkillLastAction=usedSkill; }
            }
        };
    }

    /* Freeze/Hard Control execution is owned by js/00-main.js.
       V158 keeps only combat tuning and must not wrap player skill casts. */

})();
