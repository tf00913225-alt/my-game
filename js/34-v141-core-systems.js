/*
   V141 — core systems
   - explicit monster rank + 10% wild elite preparation hooks
   - monster carried-skill count/level rules
   - elite-only single-roll drop table
   - functional monster shields and support AI hook
   - highest-character offline EXP multiplier
   - expanded quests/achievements and procedural battle audio
*/
(function installV141CoreSystems(){
    "use strict";

    const INVENTORY_CAPACITY=120;
    const VALID_RANKS=new Set(["regular","elite","boss"]);
    const WILD_ELITE_RATE=0.10;
    const WILD_ZONE_STRENGTHS=window.v173WildZoneStrengthMultipliers;
    const V141_PROGRESS_KEY="v141_account_progress";

    window.V141_INVENTORY_CAPACITY=INVENTORY_CAPACITY;
    window.v141SystemConfig=Object.freeze({
        inventoryCapacity:INVENTORY_CAPACITY,
        inventoryPageSize:24,
        inventoryPages:5,
        wildEliteRate:WILD_ELITE_RATE,
        eliteSpecialDropRate:0.19
    });

    function getHighestCharacterLevel(){
        if(typeof getExistingPartyIndexes!=="function"){ return 1; }
        return Math.max(1,...getExistingPartyIndexes().map(index=>{
            const character=getPartyCharacterByIndex(index);
            return Math.max(1,Math.floor(Number(character&&character.level)||1));
        }));
    }
    window.v141GetHighestCharacterLevel=getHighestCharacterLevel;

    function loadAccountProgress(){
        try{
            const raw=JSON.parse(localStorage.getItem(V141_PROGRESS_KEY)||"{}");
            return {
                eliteKills:Math.max(0,Math.floor(Number(raw.eliteKills)||0)),
                dungeonWins:Math.max(0,Math.floor(Number(raw.dungeonWins)||0)),
                abyssClears:Math.max(0,Math.floor(Number(raw.abyssClears)||0))
            };
        }catch(_){
            return {eliteKills:0,dungeonWins:0,abyssClears:0};
        }
    }

    const accountProgress=loadAccountProgress();

    function persistAccountProgress(){
        try{ localStorage.setItem(V141_PROGRESS_KEY,JSON.stringify(accountProgress)); }
        catch(_){ }
    }
    window.v141GetAccountProgress=function(){ return Object.assign({},accountProgress); };
    window.v141RecordAbyssClear=function(){
        accountProgress.abyssClears++;
        persistAccountProgress();
    };

    /* =====================================================
       Wild roster expansion and explicit rank
    ===================================================== */
    function getWildZoneSpecs(){
        return [
            [typeof forestMonsters!=="undefined"?forestMonsters:null,3,"林間風靈","苔岩獸",WILD_ZONE_STRENGTHS[0]],
            [typeof desertMonsters!=="undefined"?desertMonsters:null,17,"風沙隼","岩甲蠍",WILD_ZONE_STRENGTHS[1]],
            [typeof iceMountainMonsters!=="undefined"?iceMountainMonsters:null,25,"霜風妖","凍岩獸",WILD_ZONE_STRENGTHS[2]],
            [typeof zone4Monsters!=="undefined"?zone4Monsters:null,35,"焰風鬼","熔岩石怪",WILD_ZONE_STRENGTHS[3]],
            [typeof zone5Monsters!=="undefined"?zone5Monsters:null,45,"蒼風巨獸","山岳巨獸",WILD_ZONE_STRENGTHS[4]],
            [typeof zone6Monsters!=="undefined"?zone6Monsters:null,55,"風刃修羅","岩鎧修羅",WILD_ZONE_STRENGTHS[5]],
            [typeof zone7Monsters!=="undefined"?zone7Monsters:null,65,"嵐影魔君","岳魂魔君",WILD_ZONE_STRENGTHS[6]],
            [typeof zone8Monsters!=="undefined"?zone8Monsters:null,75,"青嵐龍衛","岩岳龍衛",WILD_ZONE_STRENGTHS[7]],
            [typeof zone9Monsters!=="undefined"?zone9Monsters:null,85,"虛空風靈","虛空岩靈",WILD_ZONE_STRENGTHS[8]],
            [typeof zone10Monsters!=="undefined"?zone10Monsters:null,95,"終焉風神","終焉地神",WILD_ZONE_STRENGTHS[9]]
        ].filter(entry=>Array.isArray(entry[0]));
    }

    function strengthenNewWildMonster(monster,multiplier){
        if(!monster || monster._v131StrengthApplied){ return monster; }
        const strengthMultiplier=Number.isFinite(Number(multiplier))
            ? Number(multiplier)
            : WILD_ZONE_STRENGTHS[WILD_ZONE_STRENGTHS.length-1];
        monster._v131StrengthApplied=true;
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*strengthMultiplier));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    function addWindAndEarthWildMonsters(){
        getWildZoneSpecs().forEach(([zone,level,windName,earthName,strengthMultiplier])=>{
            zone.forEach(monster=>{
                if(monster){
                    monster.rank="regular";
                    monster.v141CurveEliteRate=WILD_ELITE_RATE;
                }
            });
            if(!zone.some(monster=>monster&&monster.name===windName)){
                const monster=strengthenNewWildMonster(
                    makeZoneMonster(windName,level,"wind","regular"),
                    strengthMultiplier
                );
                monster.v141CurveEliteRate=WILD_ELITE_RATE;
                zone.push(monster);
            }
            if(!zone.some(monster=>monster&&monster.name===earthName)){
                const monster=strengthenNewWildMonster(
                    makeZoneMonster(earthName,level,"earth","regular"),
                    strengthMultiplier
                );
                monster.v141CurveEliteRate=WILD_ELITE_RATE;
                zone.push(monster);
            }
        });
    }

    if(typeof getMonsterRank==="function"){
        getMonsterRank=function(monster){
            if(!monster){ return "regular"; }
            if(VALID_RANKS.has(monster.v141BattleRank)){ return monster.v141BattleRank; }
            if(VALID_RANKS.has(monster.rank)){ return monster.rank; }
            return "regular";
        };
    }

    /* =====================================================
       Monster carried skills
    ===================================================== */
    function getMonsterSkillCarryLimit(level){
        const lv=Math.max(1,Math.floor(Number(level)||1));
        if(lv<=20){ return 1; }
        if(lv<=40){ return 2; }
        return 3;
    }

    function getMonsterFixedSkillLevel(level){
        const lv=Math.max(1,Math.floor(Number(level)||1));
        if(lv<=20){ return 1; }
        if(lv<=40){ return 2; }
        if(lv<=60){ return 3; }
        if(lv<=80){ return 4; }
        return 5;
    }

    function shuffledCopy(values){
        const list=(values||[]).slice();
        for(let i=list.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [list[i],list[j]]=[list[j],list[i]];
        }
        return list;
    }

    function configureMonsterSkills(monster,options){
        if(!monster || monster.v141Abyss){ return monster; }
        const settings=options||{};
        const source=Array.isArray(settings.pool)
            ? settings.pool
            : Array.isArray(monster.skillIds)
            ? monster.skillIds
            : [];
        const eligible=[...new Set(source)].filter(id=>{
            const skill=typeof skillDatabase!=="undefined" ? skillDatabase[id] : null;
            return !!(
                skill &&
                (skill.category==="physical" || skill.category==="magic")
            );
        });
        const limit=getMonsterSkillCarryLimit(monster.level);
        monster.skillIds=(settings.keepOrder ? eligible : shuffledCopy(eligible)).slice(0,limit);
        monster.v141SkillLevel=getMonsterFixedSkillLevel(monster.level);
        return monster;
    }

    window.v141GetMonsterSkillCarryLimit=getMonsterSkillCarryLimit;
    window.v141GetMonsterFixedSkillLevel=getMonsterFixedSkillLevel;
    window.v141ConfigureMonsterSkills=configureMonsterSkills;

    if(typeof makeZoneMonster==="function"){
        const originalMakeZoneMonster=makeZoneMonster;
        makeZoneMonster=function(){
            const monster=originalMakeZoneMonster.apply(this,arguments);
            if(monster && !monster.rank){ monster.rank="regular"; }
            return configureMonsterSkills(monster);
        };
    }

    addWindAndEarthWildMonsters();
    getWildZoneSpecs().forEach(([zone])=>zone.forEach(configureMonsterSkills));

    /* V133早於本層載入；加入風／土怪與10%精英期望值後，立即用最終
       地圖資料重算目前等級需求。既有等級、已累積EXP與其他存檔不動。 */
    if(typeof window.v133GetExpNextForLevel==="function"){
        getExistingPartyIndexes().forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            if(character&&character.level<100){
                character.expNext=window.v133GetExpNextForLevel(character.level);
            }
        });
    }

    window.v141RollWildMonsterRanks=function(indexes){
        (indexes||[]).forEach(index=>{
            const monster=typeof monsters!=="undefined" ? monsters[index] : null;
            if(!monster){ return; }
            monster.rank="regular";
            monster.v141BattleRank=Math.random()<WILD_ELITE_RATE ? "elite" : "regular";
            configureMonsterSkills(monster);
        });
    };

    /* =====================================================
       Functional monster shield
    ===================================================== */
    function getMonsterShieldRemaining(monster){
        const shield=monster&&monster.v141Shield;
        return shield ? Math.max(0,Math.floor(Number(shield.remaining)||0)) : 0;
    }

    function removeMonsterShield(monster){
        const shield=monster&&monster.v141Shield;
        if(!shield){ return; }
        const remaining=getMonsterShieldRemaining(monster);
        const baseHp=Math.max(0,(Number(monster.hp)||0)-remaining);
        monster.maxHP=Math.max(1,Number(shield.baseMaxHP)||1);
        monster.hp=Math.min(monster.maxHP,baseHp);
        monster.v141Shield=null;
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==shield&&buff.type!=="shield");
    }

    function syncMonsterShield(monster){
        const shield=monster&&monster.v141Shield;
        if(!shield){ return 0; }
        shield.remaining=Math.max(
            0,
            Math.min(
                Number(shield.amount)||0,
                (Number(monster.hp)||0)-(Number(shield.baseHp)||0)
            )
        );
        if(shield.remaining<=0){
            const currentHp=Math.max(0,Number(monster.hp)||0);
            monster.maxHP=Math.max(1,Number(shield.baseMaxHP)||1);
            monster.hp=Math.min(monster.maxHP,currentHp);
            monster.v141Shield=null;
            monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==shield&&buff.type!=="shield");
            return 0;
        }
        return shield.remaining;
    }

    function applyMonsterShield(monster,amount,turns){
        if(!monster || !monster.alive){ return 0; }
        if(monster.v141Shield){ removeMonsterShield(monster); }
        const safeAmount=Math.max(1,Math.floor(Number(amount)||1));
        const shield={
            type:"shield",
            amount:safeAmount,
            remaining:safeAmount,
            turnsLeft:Math.max(1,Math.floor(Number(turns)||2)),
            baseMaxHP:Math.max(1,Number(monster.maxHP)||1),
            baseHp:Math.max(0,Number(monster.hp)||0),
            v141MonsterShield:true
        };
        monster.maxHP=shield.baseMaxHP+safeAmount;
        monster.hp=shield.baseHp+safeAmount;
        monster.v141Shield=shield;
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff.type!=="shield");
        monster.activeBuffs.push(shield);
        return safeAmount;
    }

    function healMonsterPreservingShield(monster,amount){
        if(!monster || !monster.alive){ return 0; }
        const shieldRemaining=syncMonsterShield(monster);
        const shield=monster.v141Shield;
        const baseMax=shield ? shield.baseMaxHP : monster.maxHP;
        const baseHp=shield
            ? Math.max(0,monster.hp-shieldRemaining)
            : Math.max(0,monster.hp);
        const healed=Math.max(0,Math.min(Math.floor(Number(amount)||0),baseMax-baseHp));
        monster.hp=baseHp+healed+shieldRemaining;
        if(shield){ shield.baseHp=baseHp+healed; }
        return healed;
    }

    window.v141GetMonsterShieldRemaining=getMonsterShieldRemaining;
    window.v141SyncMonsterShield=syncMonsterShield;
    window.v141ApplyMonsterShield=applyMonsterShield;
    window.v141HealMonsterPreservingShield=healMonsterPreservingShield;

    if(typeof skillDatabase!=="undefined"){
        if(!skillDatabase.yuanXiangGuangMing){
            skillDatabase.yuanXiangGuangMing={
                id:"yuanXiangGuangMing",name:"元相光明",element:"light",
                category:"heal",targetType:"allyAll",maxLevel:5,spCost:35,baseHeal:350,
                description:"我方全體回復350 HP。"
            };
        }
        if(!skillDatabase.yuanGuangShield){
            skillDatabase.yuanGuangShield={
                id:"yuanGuangShield",name:"元光護體",element:"light",
                category:"buff",targetType:"allyAll",maxLevel:5,spCost:40,
                shieldAmount:200,shieldDuration:2,
                description:"我方全體獲得200護盾，持續2回合。"
            };
        }
    }

    let lastMonsterSkillByIndex=new Map();

    /* =====================================================
       Procedural audio
    ===================================================== */
    const audioEngine=(function(){
        let context=null;
        let master=null;

        function ensure(){
            if(context){
                if(context.state==="suspended"){ context.resume().catch(()=>{}); }
                return context;
            }
            const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
            if(!AudioContextCtor){ return null; }
            context=new AudioContextCtor();
            master=context.createGain();
            master.gain.value=0.22;
            master.connect(context.destination);
            return context;
        }

        function tone(frequency,duration,options){
            const ctx=ensure();
            if(!ctx || !master){ return; }
            const opts=options||{};
            const now=ctx.currentTime+(Number(opts.delay)||0);
            const osc=ctx.createOscillator();
            const gain=ctx.createGain();
            osc.type=opts.wave||"sine";
            osc.frequency.setValueAtTime(Math.max(20,frequency),now);
            if(opts.to){ osc.frequency.exponentialRampToValueAtTime(Math.max(20,opts.to),now+duration); }
            gain.gain.setValueAtTime(0.0001,now);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.001,Number(opts.volume)||0.16),now+0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
            osc.connect(gain); gain.connect(master);
            osc.start(now); osc.stop(now+duration+0.02);
        }

        function noise(duration,options){
            const ctx=ensure();
            if(!ctx || !master){ return; }
            const opts=options||{};
            const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
            const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
            const data=buffer.getChannelData(0);
            for(let i=0;i<length;i++){
                const envelope=1-i/length;
                data[i]=(Math.random()*2-1)*envelope;
            }
            const source=ctx.createBufferSource();
            const filter=ctx.createBiquadFilter();
            const gain=ctx.createGain();
            filter.type=opts.filter||"bandpass";
            filter.frequency.value=Number(opts.frequency)||900;
            filter.Q.value=Number(opts.q)||0.8;
            gain.gain.value=Number(opts.volume)||0.14;
            source.buffer=buffer;
            source.connect(filter); filter.connect(gain); gain.connect(master);
            source.start(ctx.currentTime+(Number(opts.delay)||0));
        }

        function play(kind){
            switch(kind){
                case "swing": noise(.14,{frequency:1200,volume:.15}); tone(520,.13,{to:180,wave:"sawtooth",volume:.07}); break;
                case "hit": noise(.12,{frequency:260,volume:.22}); tone(110,.14,{to:55,wave:"triangle",volume:.18}); break;
                case "damage": noise(.15,{frequency:340,volume:.2}); tone(145,.18,{to:62,wave:"triangle",volume:.14}); break;
                case "heavy": noise(.28,{frequency:170,volume:.25}); tone(85,.32,{to:38,wave:"sine",volume:.25}); break;
                case "crit": tone(780,.12,{to:1560,wave:"square",volume:.12}); noise(.22,{frequency:1800,volume:.22,delay:.05}); break;
                case "block": tone(920,.11,{to:390,wave:"square",volume:.1}); noise(.13,{frequency:1900,volume:.13}); break;
                case "dodge": noise(.2,{filter:"highpass",frequency:2200,volume:.1}); tone(1050,.15,{to:520,wave:"sine",volume:.05}); break;
                case "magic": tone(240,.34,{to:920,wave:"sine",volume:.12}); tone(480,.28,{to:1280,wave:"triangle",volume:.08,delay:.04}); break;
                case "charge": tone(95,.55,{to:620,wave:"sawtooth",volume:.08}); break;
                case "explosion": noise(.38,{filter:"lowpass",frequency:480,volume:.26}); tone(92,.34,{to:35,wave:"square",volume:.18}); break;
                case "fire": noise(.42,{frequency:620,volume:.18}); tone(120,.36,{to:45,wave:"sawtooth",volume:.12,delay:.06}); break;
                case "ice": tone(1480,.25,{to:420,wave:"triangle",volume:.12}); noise(.25,{frequency:2300,volume:.16,delay:.06}); break;
                case "water": noise(.48,{filter:"lowpass",frequency:1100,volume:.13}); tone(330,.42,{to:190,wave:"sine",volume:.09}); break;
                case "wind": noise(.38,{filter:"highpass",frequency:1500,volume:.14}); tone(900,.25,{to:260,wave:"sine",volume:.06}); break;
                case "earth": tone(72,.36,{to:38,wave:"triangle",volume:.23}); noise(.3,{frequency:210,volume:.22}); break;
                case "buff": tone(390,.34,{to:760,wave:"sine",volume:.11}); tone(590,.32,{to:980,wave:"sine",volume:.08,delay:.08}); break;
                case "debuff": tone(340,.38,{to:95,wave:"sawtooth",volume:.11}); break;
                case "shield": tone(220,.38,{to:660,wave:"sine",volume:.12}); tone(880,.24,{to:440,wave:"triangle",volume:.08,delay:.08}); break;
                case "heal": tone(440,.46,{to:880,wave:"sine",volume:.12}); tone(660,.38,{to:1100,wave:"sine",volume:.08,delay:.1}); break;
                case "revive": tone(220,.65,{to:880,wave:"sine",volume:.14}); tone(440,.62,{to:1320,wave:"triangle",volume:.09,delay:.08}); break;
                case "boss": tone(58,.38,{to:34,wave:"sawtooth",volume:.18}); break;
                case "monster": tone(125,.19,{to:72,wave:"triangle",volume:.1}); break;
                case "death": tone(160,.5,{to:42,wave:"sawtooth",volume:.18}); noise(.32,{frequency:190,volume:.16}); break;
            }
        }

        function playSkill(skill,name){
            const label=String(name||skill&&skill.name||"");
            if(label==="普通攻擊"){ play("swing"); setTimeout(()=>play("hit"),55); return; }
            if(!skill){ play("hit"); return; }
            if(skill.category==="heal"){ play("heal"); return; }
            if(skill.category==="revive"){ play("revive"); return; }
            if(skill.category==="buff"){
                play(/盾|護體|結界/.test(label)?"shield":"buff");
                return;
            }
            play(skill.category==="physical"?"swing":"magic");
            setTimeout(()=>{
                const elementKind={fire:"fire",water:"water",wind:"wind",earth:"earth",light:"buff"}[skill.element];
                if(elementKind){ play(elementKind); }
                if(/爆|炸|鳳|龍/.test(label)){ setTimeout(()=>play("explosion"),45); }
                else{ play(/重|裂|猛|破/.test(label)?"heavy":"hit"); }
            },65);
        }

        return {ensure,play,playSkill};
    })();
    window.v141Audio=audioEngine;
    document.addEventListener("pointerdown",()=>audioEngine.ensure(),{once:true,passive:true});

    if(typeof showSkillNameBadge==="function"){
        const originalShowSkillNameBadge=showSkillNameBadge;
        let lastQuestSkillKey="";
        showSkillNameBadge=function(skillName,elementType,characterIndex){
            const result=originalShowSkillNameBadge.apply(this,arguments);
            const skill=Object.values(skillDatabase).find(data=>data&&data.name===skillName)||null;
            audioEngine.playSkill(skill,skillName);
            if(battleActive && skillName!=="普通攻擊"){
                const key=[battleToken,turn,typeof initiativeIndex!=="undefined"?initiativeIndex:0,characterIndex,skillName].join(":");
                if(key!==lastQuestSkillKey){
                    lastQuestSkillKey=key;
                    recordQuestProgress("skills5",1,"daily");
                    recordQuestProgress("skills15",1,"commission");
                }
            }
            return result;
        };
    }

    if(typeof showMonsterSkillNameBadge==="function"){
        const originalShowMonsterSkillNameBadge=showMonsterSkillNameBadge;
        showMonsterSkillNameBadge=function(skillName,elementType,monsterIndex){
            const skillId=Object.keys(skillDatabase).find(id=>skillDatabase[id]&&skillDatabase[id].name===skillName)||null;
            if(skillId){ lastMonsterSkillByIndex.set(monsterIndex,skillId); }
            audioEngine.playSkill(skillId?skillDatabase[skillId]:null,skillName);
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&typeof getMonsterRank==="function"&&getMonsterRank(monster)==="boss"){
                setTimeout(()=>audioEngine.play("boss"),28);
            }
            return originalShowMonsterSkillNameBadge.apply(this,arguments);
        };
    }

    if(typeof showMissEffect==="function"){
        const originalShowMissEffect=showMissEffect;
        showMissEffect=function(){
            audioEngine.play("dodge");
            return originalShowMissEffect.apply(this,arguments);
        };
    }

    if(typeof showShieldAbsorb==="function"){
        const originalShowShieldAbsorb=showShieldAbsorb;
        showShieldAbsorb=function(){
            audioEngine.play("block");
            return originalShowShieldAbsorb.apply(this,arguments);
        };
    }

    if(typeof showMonsterHit==="function"){
        const originalShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index,amount,type,isCrit){
            if(type==="hp"&&Number(amount)>0){ audioEngine.play(isCrit?"crit":"damage"); }
            return originalShowMonsterHit.apply(this,arguments);
        };
    }

    if(typeof showPlayerHit==="function"){
        const originalShowPlayerHit=showPlayerHit;
        showPlayerHit=function(amount,type,index,isPositive,isCrit){
            if(type==="hp"&&Number(amount)>0){ audioEngine.play(isCrit?"crit":"damage"); }
            return originalShowPlayerHit.apply(this,arguments);
        };
    }

    function applyMonsterSkillShield(monsterIndex,skillId,level){
        const skill=skillDatabase[skillId];
        const caster=monsters[monsterIndex];
        if(!skill || !caster || !caster.alive){ return; }
        const safeLevel=Math.max(1,Math.min(skill.maxLevel||1,Math.floor(Number(level)||1)));
        if(skill.selfShieldByLevel){
            const amount=skill.selfShieldByLevel[safeLevel-1];
            applyMonsterShield(caster,amount,skill.shieldDuration||2);
            addBattleLog(caster.name+"獲得"+amount+"點護盾。");
        }
        if(skill.allyShieldByLevel){
            const amount=skill.allyShieldByLevel[safeLevel-1];
            currentBattleMonsters.forEach(index=>{
                const ally=monsters[index];
                if(ally&&ally.alive){ applyMonsterShield(ally,amount,skill.shieldDuration||2); }
            });
            addBattleLog("敵方全體獲得"+amount+"點護盾，持續"+(skill.shieldDuration||2)+"回合。");
        }
    }

    function supportMonsterAction(monsterIndex){
        const monster=monsters[monsterIndex];
        if(!monster || !monster.alive){ finishPlayerAction(); return; }
        if((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster)) ||
           (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))){
            return null;
        }
        const allies=currentBattleMonsters.map(index=>monsters[index]).filter(ally=>ally&&ally.alive);
        const injured=allies.filter(ally=>{
            const shield=getMonsterShieldRemaining(ally);
            const max=ally.v141Shield?ally.v141Shield.baseMaxHP:ally.maxHP;
            return Math.max(0,ally.hp-shield)<max;
        });
        const healSkill=skillDatabase.yuanXiangGuangMing;
        const shieldSkill=skillDatabase.yuanGuangShield;

        if(injured.length>0 && monster.sp>=healSkill.spCost){
            monster.sp-=healSkill.spCost;
            showMonsterSkillNameBadge(healSkill.name,"light",monsterIndex);
            let total=0;
            allies.forEach(ally=>{ total+=healMonsterPreservingShield(ally,350); });
            addBattleLog(monster.name+"施放元相光明，敵方全體共回復"+total+" HP。");
            updateUI();
            finishPlayerAction();
            return true;
        }

        if(allies.some(ally=>getMonsterShieldRemaining(ally)<=0) && monster.sp>=shieldSkill.spCost){
            monster.sp-=shieldSkill.spCost;
            showMonsterSkillNameBadge(shieldSkill.name,"light",monsterIndex);
            allies.forEach(ally=>applyMonsterShield(ally,200,2));
            addBattleLog(monster.name+"施放元光護體，敵方全體獲得200護盾，持續2回合。");
            updateUI();
            finishPlayerAction();
            return true;
        }
        return false;
    }

    if(typeof processSingleMonsterAttack==="function"){
        const originalProcessSingleMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex,token){
            const monster=monsters[monsterIndex];
            if(
                monster&&monster.v141Abyss&&
                typeof window.v141TryMonsterSpecialAction==="function"
            ){
                const handled=window.v141TryMonsterSpecialAction(monsterIndex,token);
                if(handled===true){ return; }
            }
            if(monster&&monster.v141AbyssAi==="support"){
                const supportResult=supportMonsterAction(monsterIndex);
                if(supportResult!==false && supportResult!==null){ return supportResult; }
                if(supportResult===null){ return originalProcessSingleMonsterAttack.apply(this,arguments); }
            }

            if(!monster){ return originalProcessSingleMonsterAttack.apply(this,arguments); }
            lastMonsterSkillByIndex.delete(monsterIndex);
            const forcedLevel=monster.v141ForceSkillLevel||monster.v141SkillLevel||getMonsterFixedSkillLevel(monster.level);
            const backups=[];
            (monster.skillIds||[]).forEach(id=>{
                const skill=skillDatabase[id];
                if(!skill){ return; }
                backups.push([skill,skill.maxLevel]);
                skill.maxLevel=Math.min(Math.max(1,forcedLevel),Math.max(1,skill.maxLevel||1));
            });

            let result;
            try{ result=originalProcessSingleMonsterAttack.apply(this,arguments); }
            finally{ backups.forEach(([skill,maxLevel])=>{ skill.maxLevel=maxLevel; }); }

            const castSkillId=lastMonsterSkillByIndex.get(monsterIndex);
            if(castSkillId){
                applyMonsterSkillShield(monsterIndex,castSkillId,forcedLevel);
                if(typeof updateUI==="function"){ updateUI(); }
            }
            return result;
        };
    }

    let lastShieldTickKey="";
    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            const key=String(token)+":"+String(turn);
            if(key!==lastShieldTickKey){
                lastShieldTickKey=key;
                currentBattleMonsters.forEach(index=>{
                    const monster=monsters[index];
                    const shield=monster&&monster.v141Shield;
                    if(!shield){ return; }
                    if(turn>1){ shield.turnsLeft--; }
                    if(shield.turnsLeft<=0){ removeMonsterShield(monster); }
                    else{ syncMonsterShield(monster); }
                });
            }
            return originalStartTurn.apply(this,arguments);
        };
    }

    /* =====================================================
       Elite single-roll drops + quest progress
    ===================================================== */
    function addEliteSpecialDrop(monster){
        if(typeof window.v132AddItemToInventory!=="function"){ return null; }
        const roll=Math.random()*100;
        let definition=null;
        if(roll<1){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetFire"); }
        else if(roll<2){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetWater"); }
        else if(roll<3){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetEarth"); }
        else if(roll<4){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetWind"); }
        else if(roll<9){ definition=window.v132GetTalismanDefinition&&window.v132GetTalismanDefinition("freezeTalismanMid"); }
        else if(roll<14){ definition=window.v132GetTalismanDefinition&&window.v132GetTalismanDefinition("stealthTalismanMid"); }
        else if(roll<19){ definition=window.v132GetTalismanDefinition&&window.v132GetTalismanDefinition("barrierTalismanMid"); }
        if(!definition){ return null; }
        if(!window.v132AddItemToInventory(definition,1)){
            addBattleLog(monster.name+"出現特殊掉落，但背包已滿，未能放入。");
            return null;
        }
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        addBattleLog(monster.name+"掉落了"+definition.name+"×1。");
        return definition;
    }

    function recordQuestProgress(id,amount,type){
        if(typeof ensureDailyQuestsCurrent!=="function"){ return; }
        ensureDailyQuestsCurrent();
        const state=type==="commission"?commissionQuestState:dailyQuestState;
        const definitions=type==="commission"?commissionQuestDefinitions:dailyQuestDefinitions;
        const quest=definitions.find(item=>item.id===id);
        if(!quest){ return; }
        state.progress[id]=Math.min(quest.goal,(Number(state.progress[id])||0)+Math.max(0,Number(amount)||0));
    }
    window.v141RecordQuestProgress=recordQuestProgress;

    if(typeof killMonster==="function"){
        const originalKillMonster=killMonster;
        killMonster=function(index){
            const monster=monsters[index];
            const wasAlive=!!(monster&&monster.alive);
            const isWildElite=!!(
                wasAlive &&
                !window.v132ActiveDungeonRun &&
                currentZone!=="dungeon" &&
                getMonsterRank(monster)==="elite"
            );
            const previousDungeonRun=window.v132ActiveDungeonRun;
            if(isWildElite){ window.v132ActiveDungeonRun={v141EliteDropIsolation:true}; }
            let result;
            try{ result=originalKillMonster.apply(this,arguments); }
            finally{ window.v132ActiveDungeonRun=previousDungeonRun; }

            if(wasAlive){
                recordQuestProgress("kill10",1,"daily");
                recordQuestProgress("kill30",1,"commission");
                if(getMonsterRank(monster)==="elite"){
                    recordQuestProgress("elite2",1,"commission");
                    accountProgress.eliteKills++;
                    persistAccountProgress();
                }
                if(isWildElite){ addEliteSpecialDrop(monster); }
                audioEngine.play("death");
            }
            return result;
        };
    }

    /* =====================================================
       Expanded quests and achievements
    ===================================================== */
    const extraDailyQuests=[
        {id:"kill10",name:"清掃周邊",desc:"今天累計擊敗10隻怪物",goal:10,reward:{gold:130,exp:60}},
        {id:"win3",name:"連戰三場",desc:"今天打贏3場戰鬥",goal:3,reward:{gold:120,exp:80}},
        {id:"skills5",name:"熟練招式",desc:"今天在戰鬥中施放5次技能",goal:5,reward:{gold:90}}
    ];
    const extraCommissionQuests=[
        {id:"kill30",name:"委託：討伐30隻怪物",desc:"今天累計擊敗30隻怪物",goal:30,reward:{gold:350,exp:180}},
        {id:"win5",name:"委託：五戰告捷",desc:"今天打贏5場戰鬥",goal:5,reward:{gold:300,exp:220}},
        {id:"elite2",name:"委託：精英獵手",desc:"今天擊敗2隻精英怪",goal:2,reward:{gold:260,exp:120}},
        {id:"skills15",name:"委託：招式演練",desc:"今天在戰鬥中施放15次技能",goal:15,reward:{gold:220,exp:150}}
    ];
    extraDailyQuests.forEach(quest=>{
        if(!dailyQuestDefinitions.some(item=>item.id===quest.id)){ dailyQuestDefinitions.push(quest); }
    });
    extraCommissionQuests.forEach(quest=>{
        if(!commissionQuestDefinitions.some(item=>item.id===quest.id)){ commissionQuestDefinitions.push(quest); }
    });

    if(typeof ensureDailyQuestsCurrent==="function"){
        const originalEnsureDailyQuestsCurrent=ensureDailyQuestsCurrent;
        ensureDailyQuestsCurrent=function(){
            const result=originalEnsureDailyQuestsCurrent.apply(this,arguments);
            dailyQuestDefinitions.forEach(quest=>{
                if(!Object.prototype.hasOwnProperty.call(dailyQuestState.progress,quest.id)){ dailyQuestState.progress[quest.id]=0; }
                if(!Object.prototype.hasOwnProperty.call(dailyQuestState.claimed,quest.id)){ dailyQuestState.claimed[quest.id]=false; }
            });
            commissionQuestDefinitions.forEach(quest=>{
                if(!Object.prototype.hasOwnProperty.call(commissionQuestState.progress,quest.id)){ commissionQuestState.progress[quest.id]=0; }
                if(!Object.prototype.hasOwnProperty.call(commissionQuestState.claimed,quest.id)){ commissionQuestState.claimed[quest.id]=false; }
            });
            return result;
        };
        ensureDailyQuestsCurrent();
    }

    function highestLevelAtLeast(level){ return getHighestCharacterLevel()>=level; }
    const extraAchievements=[
        {id:"kill500",name:"百戰不殆",desc:"累計擊敗500隻怪物",reward:{gold:500},check:()=>getTotalMonsterKills()>=500},
        {id:"kill1000",name:"千軍辟易",desc:"累計擊敗1000隻怪物",reward:{gold:900},check:()=>getTotalMonsterKills()>=1000},
        {id:"elite10",name:"精英剋星",desc:"累計擊敗10隻精英怪",reward:{gold:300},check:()=>accountProgress.eliteKills>=10},
        {id:"elite50",name:"精英終結者",desc:"累計擊敗50隻精英怪",reward:{gold:800},check:()=>accountProgress.eliteKills>=50},
        {id:"level30",name:"行走江湖",desc:"任一角色達到30級",reward:{gold:250},check:()=>highestLevelAtLeast(30)},
        {id:"level60",name:"一代宗師",desc:"任一角色達到60級",reward:{gold:650},check:()=>highestLevelAtLeast(60)},
        {id:"level80",name:"登峰造極",desc:"任一角色達到80級",reward:{gold:1000},check:()=>highestLevelAtLeast(80)},
        {id:"level100",name:"百級傳說",desc:"任一角色達到100級",reward:{gold:1800},check:()=>highestLevelAtLeast(100)},
        {id:"gold5000",name:"積少成多",desc:"持有金幣達到5,000",reward:{gold:250},check:()=>gold>=5000},
        {id:"gold20000",name:"富甲一方",desc:"持有金幣達到20,000",reward:{gold:700},check:()=>gold>=20000}
    ];
    extraAchievements.forEach(achievement=>{
        if(!achievementDefinitions.some(item=>item.id===achievement.id)){ achievementDefinitions.push(achievement); }
    });

    let lastVictoryToken=null;
    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            if(battleActive && lastVictoryToken!==battleToken){
                lastVictoryToken=battleToken;
                recordQuestProgress("win3",1,"daily");
                recordQuestProgress("win5",1,"commission");
                if(window.v132ActiveDungeonRun){
                    accountProgress.dungeonWins++;
                    persistAccountProgress();
                }
            }
            return originalWinBattle.apply(this,arguments);
        };
    }

    /* =====================================================
       Offline EXP: highest-level character multiplier
    ===================================================== */
    function getOfflineLevelMultiplier(){
        const level=getHighestCharacterLevel();
        if(level<=10){ return 1; }
        if(level<=20){ return 1.2; }
        if(level<=30){ return 1.4; }
        if(level<=40){ return 1.6; }
        if(level<=50){ return 1.8; }
        return 2;
    }
    window.v141GetOfflineLevelMultiplier=getOfflineLevelMultiplier;

    if(typeof calculateOfflineExpSince==="function"){
        const originalCalculateOfflineExpSince=calculateOfflineExpSince;
        calculateOfflineExpSince=function(){
            const before=Math.max(0,Number(pendingOfflineExp)||0);
            const result=originalCalculateOfflineExpSince.apply(this,arguments);
            const baseGain=Math.max(0,(Number(pendingOfflineExp)||0)-before);
            if(baseGain>0){
                pendingOfflineExp=before+Math.round(baseGain*getOfflineLevelMultiplier()*3);
            }
            return result;
        };
    }

    /* Refined affixes are separate from original item stats but contribute in combat. */
    if(typeof getEquipmentBonus==="function"){
        const originalGetEquipmentBonus=getEquipmentBonus;
        getEquipmentBonus=function(characterId){
            const bonus=originalGetEquipmentBonus.apply(this,arguments);
            const equipment=characterEquipment&&characterEquipment[characterId];
            if(!equipment){ return bonus; }
            Object.values(equipment).forEach(item=>{
                const stats=item&&item.reforgeStats;
                if(!stats){ return; }
                Object.keys(stats).forEach(stat=>{
                    if(Object.prototype.hasOwnProperty.call(bonus,stat)){
                        bonus[stat]+=Number(stats[stat])||0;
                    }
                });
            });
            return bonus;
        };
    }
})();
