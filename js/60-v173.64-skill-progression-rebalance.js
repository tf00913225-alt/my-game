/* =====================================================
   V173.64 — 四元素技能成長節奏正式 owner
   玩家技能樹專用：學習資格、境界門檻、技能點成本、技能頁提示。
   怪物／深淵／符咒不經過本層 learn/upgrade gate。
===================================================== */
(function installV17364SkillProgression(){
    "use strict";

    if(typeof window==="undefined"||window.__v17364SkillProgressionInstalled){ return; }
    window.__v17364SkillProgressionInstalled=true;

    const SKILL_UPGRADE_COST_BY_TARGET_LEVEL=Object.freeze({2:1,3:2,4:3,5:4});
    const FIRE_MOMENTUM_BY_LEVEL=Object.freeze([12,15,18,21,25]);
    const BLOOD_BURN_BY_LEVEL=Object.freeze([20,25,30,35,40]);
    const DODGE_BY_LEVEL=Object.freeze([30,40,50,60,70]);
    const ROCK_WALL_BY_LEVEL=Object.freeze([15,20,25,30,35]);
    const EARTH_SHIELD_BY_LEVEL=Object.freeze([20,30,35,40,50]);
    const GROUP_ORDER=Object.freeze({physical:0,magic:1,tactical:2,ex:3});

    function numeric(value,fallback){
        const number=Number(value);
        return Number.isFinite(number)?number:(fallback===undefined?0:fallback);
    }
    function clampLevel(value,maxLevel){
        return Math.max(1,Math.min(Math.max(1,numeric(maxLevel,1)),Math.floor(numeric(value,1))));
    }
    function notify(message){
        if(typeof alert==="function"){ alert(message); }
        return false;
    }
    function copyArray(value){ return Array.isArray(value)?value.slice():value; }
    function skillById(skillId){
        return typeof skillDatabase!=="undefined"&&skillDatabase?skillDatabase[skillId]:null;
    }
    function skillLabel(skillId){
        const skill=skillById(skillId);
        return skill&&skill.name?skill.name:String(skillId||"");
    }
    function sanitizeDescription(value){
        return String(value||"")
            .replace(/初次學習需\s*\d+\s*技能點[。；，,]?/g,"")
            .replace(/每升\s*1\s*級消耗\s*1\s*技能點[。；，,]?/g,"")
            .replace(/最高\s*5\s*級，\s*(?=傷害|效果|$)/g,"最高5級，")
            .replace(/\s{2,}/g," ")
            .trim();
    }

    const FINAL_PROGRESSION={
        flameSlash:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        fireCritical:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        explosiveFlurry:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        dragonSlash:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        fireRocket:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        blazeSpell:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        flameTornado:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        phoenixCry:{learnLevel:30,learnCost:16,progressionGroup:"magic"},
        rage:{learnLevel:18,learnCost:10,maxLevel:5,progressionGroup:"tactical"},
        fireSoulResonance:{
            id:"fireSoulResonance",name:"炎魂共鳴",element:"fire",category:"buff",targetType:"self",
            learnLevel:25,learnCost:14,maxLevel:5,spCost:35,duration:3,requires:["rage"],progressionGroup:"tactical",
            momentumBonusByLevel:FIRE_MOMENTUM_BY_LEVEL.slice(),icon:"炎",
            iconAssetPath:null,vfxAssetPath:null,
            description:"需先學習怒火。自身進入炎魂共鳴3回合。期間火元素技能發生爆擊，或成功新增燃燒時，若尚未持有炎勢則獲得炎勢；炎勢使下一次玩家主動施放的火元素直接傷害主施放提高12%/15%/18%/21%/25%，使用後消失。炎勢不強化燃燒持續傷害與免費追擊。"
        },
        bloodBurnArt:{
            id:"bloodBurnArt",name:"焚血訣",element:"fire",category:"buff",targetType:"self",
            learnLevel:35,learnCost:18,maxLevel:5,spCost:20,duration:2,requires:["fireSoulResonance"],progressionGroup:"tactical",
            directDamageBonusByLevel:BLOOD_BURN_BY_LEVEL.slice(),icon:"血",
            iconAssetPath:null,vfxAssetPath:null,
            description:"需先學習炎魂共鳴。自身目前HP高於最大HP的20%時可施放，立即消耗最大HP的10%並獲得焚血，最多持續2回合。焚血使下一次玩家主動施放的火元素直接傷害主施放提高20%/25%/30%/35%/40%，使用後消失；不強化燃燒持續傷害與免費追擊。"
        },
        fireEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"},

        waterKnife:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        frostPunch:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        iceSpin:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        frostCrush:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        waterBall:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        floodBeast:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        iceArrowRain:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        healSpell:{learnLevel:15,learnCost:8,maxLevel:5,requires:["frostPunch","floodBeast"],progressionGroup:"tactical"},
        revive:{learnLevel:20,learnCost:10,maxLevel:5,requires:["healSpell"],progressionGroup:"tactical"},
        freeze:{learnLevel:25,learnCost:14,maxLevel:1,requires:["iceSpin","iceArrowRain"],progressionGroup:"tactical"},
        purifyMind:{learnLevel:35,learnCost:18,maxLevel:1,requires:["healSpell"],progressionGroup:"tactical"},
        waterEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"},

        stormFist:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        stormFlurry:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        windCrossSlash:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        dizzyFist:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        windSpell:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        stormCircle:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        windHowlLightning:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        stormRain:{learnLevel:30,learnCost:16,progressionGroup:"magic"},
        dodgeSkill:{
            learnLevel:18,learnCost:10,maxLevel:5,progressionGroup:"tactical",
            evasionBonusPercentByLevel:DODGE_BY_LEVEL.slice()
        },
        stealthSkill:{learnLevel:25,learnCost:14,maxLevel:1,progressionGroup:"tactical"},
        dinghaishenzhen:{learnLevel:35,learnCost:18,maxLevel:1,progressionGroup:"tactical"},
        windEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"},

        stoneSlash:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        petrifyFist:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        stoneBreakSky:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        earthquakeCrush:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        stoneThrow:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        sandWind:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        flyingSandStrike:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        dustStorm:{learnLevel:30,learnCost:16,progressionGroup:"magic"},
        rockWall:{
            learnLevel:18,learnCost:10,maxLevel:5,requires:["petrifyFist","sandWind"],progressionGroup:"tactical",
            defenseBonusPercentByLevel:ROCK_WALL_BY_LEVEL.slice()
        },
        earthShield:{
            learnLevel:25,learnCost:14,maxLevel:5,requires:["rockWall"],progressionGroup:"tactical",
            reflectPercentByLevel:EARTH_SHIELD_BY_LEVEL.slice()
        },
        barrier:{learnLevel:35,learnCost:18,maxLevel:1,requires:["earthShield"],progressionGroup:"tactical"},
        earthEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"}
    };

    function applyFinalProgressionData(){
        if(typeof skillDatabase==="undefined"||!skillDatabase){ return false; }
        Object.entries(FINAL_PROGRESSION).forEach(([skillId,fields])=>{
            if(!skillDatabase[skillId]){
                if(skillId!=="fireSoulResonance"&&skillId!=="bloodBurnArt"){ return; }
                skillDatabase[skillId]={id:skillId};
            }
            const skill=skillDatabase[skillId];
            Object.entries(fields).forEach(([key,value])=>{ skill[key]=copyArray(value); });
            skill.id=skill.id||skillId;
            if(skill.maxLevel===5){
                skill.upgradeCostByTargetLevel=SKILL_UPGRADE_COST_BY_TARGET_LEVEL;
            }else{
                delete skill.upgradeCostByTargetLevel;
            }
            skill.description=sanitizeDescription(skill.description);
        });
        const dodge=skillDatabase.dodgeSkill;
        if(dodge){
            dodge.evasionBonusPercentByLevel=DODGE_BY_LEVEL.slice();
            dodge.description="提升我方指定範圍角色閃躲率30%/40%/50%/60%/70%。持續時間、目標數量與SP消耗沿用正式設定。";
        }
        const wall=skillDatabase.rockWall;
        if(wall){
            wall.defenseBonusPercentByLevel=ROCK_WALL_BY_LEVEL.slice();
            wall.description="提升我方指定範圍角色防禦15%/20%/25%/30%/35%。持續時間、目標數量與SP消耗沿用正式設定。";
        }
        const shield=skillDatabase.earthShield;
        if(shield){
            shield.reflectPercentByLevel=EARTH_SHIELD_BY_LEVEL.slice();
            shield.description="使我方指定範圍角色獲得萬象土盾，反傷比例20%/30%/35%/40%/50%。持續時間、目標數量與SP消耗沿用正式設定；同名狀態不可疊加或刷新。";
        }
        return true;
    }

    function getRequiredCharacterLevelForSkillLevel(skill,targetSkillLevel){
        const learnLevel=Math.max(1,Math.floor(numeric(skill&&skill.learnLevel,1)));
        const target=Math.max(1,Math.floor(numeric(targetSkillLevel,1)));
        if(target<=1){ return learnLevel; }
        if(target===2){ return Math.max(learnLevel+8,15); }
        if(target===3){ return Math.max(learnLevel+18,30); }
        if(target===4){ return Math.max(learnLevel+30,50); }
        return Math.max(learnLevel+45,80);
    }
    function getUpgradeCostForTargetLevel(skill,targetSkillLevel){
        if(!skill||numeric(skill.maxLevel,1)<=1){ return 0; }
        return numeric(SKILL_UPGRADE_COST_BY_TARGET_LEVEL[Math.floor(numeric(targetSkillLevel))],0);
    }
    function getSkillContext(characterKey){
        const key=characterKey!==undefined&&characterKey!==null?characterKey:
            (typeof currentSkillCharacter!=="undefined"?currentSkillCharacter:null);
        const loadout=typeof characterSkillLoadouts!=="undefined"&&characterSkillLoadouts&&key!==null
            ?characterSkillLoadouts[key]:null;
        let character=null;
        if(typeof getSkillCharacterObject==="function"&&key!==null){ character=getSkillCharacterObject(key); }
        if(!character&&key!==null){
            if(key==="player2"&&typeof player2!=="undefined"){ character=player2; }
            else if(key==="player3"&&typeof player3!=="undefined"){ character=player3; }
            else if(typeof player!=="undefined"){ character=player; }
        }
        return {key,character,loadout};
    }
    function learnedLevel(context,skillId){
        return Math.max(0,Math.floor(numeric(context&&context.loadout&&context.loadout.skillLevels&&context.loadout.skillLevels[skillId])));
    }
    function prerequisiteMet(levels,skill){
        const required=Array.isArray(skill&&skill.requires)?skill.requires.filter(Boolean):[];
        if(!required.length){ return true; }
        return required.some(skillId=>numeric(levels&&levels[skillId])>0);
    }
    function prerequisiteLabel(skill){
        const required=Array.isArray(skill&&skill.requires)?skill.requires.filter(Boolean):[];
        if(!required.length){ return "無"; }
        return required.map(skillLabel).join(" 或 ");
    }
    function finalizeSkillMutation(){
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
        if(typeof updateUI==="function"){ updateUI(); }
    }

    applyFinalProgressionData();

    if(typeof learnSkill==="function"){
        learnSkill=function(skillId){
            const skill=skillById(skillId);
            const context=getSkillContext();
            if(!skill||!context.character||!context.loadout){ return notify("目前無法取得角色技能資料。"); }
            context.loadout.skillLevels=context.loadout.skillLevels||{};
            if(learnedLevel(context,skillId)>0){ return true; }
            const characterLevel=Math.max(1,Math.floor(numeric(context.character.level,1)));
            const requiredLevel=getRequiredCharacterLevelForSkillLevel(skill,1);
            const levels=context.loadout.skillLevels;
            const prereqOk=prerequisiteMet(levels,skill);
            if(characterLevel<requiredLevel){
                return notify(prereqOk
                    ?("角色 Lv"+requiredLevel+" 才能學習「"+skill.name+"」。")
                    :("需要 Lv"+requiredLevel+"・前置："+prerequisiteLabel(skill)));
            }
            if(!prereqOk){ return notify("需要前置："+prerequisiteLabel(skill)); }
            const learnCost=Math.max(0,Math.floor(numeric(skill.learnCost)));
            const points=Math.max(0,Math.floor(numeric(context.character.skillPoints)));
            if(points<learnCost){ return notify("技能點不足，需要"+learnCost+"點。"); }
            context.character.skillPoints=points-learnCost;
            context.loadout.skillLevels[skillId]=1;
            finalizeSkillMutation();
            return true;
        };
    }

    if(typeof upgradeSkill==="function"){
        upgradeSkill=function(skillId){
            const skill=skillById(skillId);
            const context=getSkillContext();
            if(!skill||!context.character||!context.loadout){ return notify("目前無法取得角色技能資料。"); }
            context.loadout.skillLevels=context.loadout.skillLevels||{};
            const current=learnedLevel(context,skillId);
            const maxLevel=Math.max(1,Math.floor(numeric(skill.maxLevel,1)));
            if(current<=0){ return notify("請先學會「"+skill.name+"」。"); }
            if(current>=maxLevel){ return notify("「"+skill.name+"」已達最高技能等級。"); }
            const target=current+1;
            const requiredLevel=getRequiredCharacterLevelForSkillLevel(skill,target);
            const characterLevel=Math.max(1,Math.floor(numeric(context.character.level,1)));
            if(characterLevel<requiredLevel){
                return notify("角色 Lv"+requiredLevel+" 可升至技能 Lv"+target+"。");
            }
            const cost=getUpgradeCostForTargetLevel(skill,target);
            const points=Math.max(0,Math.floor(numeric(context.character.skillPoints)));
            if(points<cost){ return notify("技能點不足，升至技能 Lv"+target+"需要"+cost+"點。"); }
            context.character.skillPoints=points-cost;
            context.loadout.skillLevels[skillId]=target;
            finalizeSkillMutation();
            return true;
        };
    }

    function actionCardForRow(row){
        const cards=Array.from(row&&row.querySelectorAll?row.querySelectorAll(".skill-action-card"):[]);
        return cards.find(card=>{
            const onclick=String(card.getAttribute&&card.getAttribute("onclick")||"");
            const label=card.querySelector&&card.querySelector(".skill-action-card-label");
            const text=String(label&&label.textContent||"");
            return /learnSkill|upgradeSkill/.test(onclick)||/學習|升級|技能點|滿級/.test(text);
        })||cards[0]||null;
    }
    function setActionCard(card,enabled,label,onclick){
        if(!card){ return; }
        const target=card.querySelector(".skill-action-card-label");
        if(target){ target.textContent=label; }
        card.classList.toggle("disabled",!enabled);
        card.setAttribute("aria-disabled",enabled?"false":"true");
        if(enabled&&onclick){ card.setAttribute("onclick",onclick); }
        else{ card.removeAttribute("onclick"); }
    }
    function rowSkillId(row){
        const icon=row&&row.querySelector?row.querySelector("[id^='skillIcon_']"):null;
        return icon?icon.id.slice("skillIcon_".length):"";
    }
    function decorateSkillProgressionUi(){
        if(typeof document==="undefined"){ return; }
        const list=document.getElementById("allSkillsList");
        const context=getSkillContext();
        if(!list||!context.character||!context.loadout){ return; }
        context.loadout.skillLevels=context.loadout.skillLevels||{};
        const rows=Array.from(list.querySelectorAll(".skill-row"));
        rows.forEach(row=>{
            const skillId=rowSkillId(row);
            if(skillId==="stormSpell"){
                row.remove();
                return;
            }
            const skill=skillById(skillId);
            if(!skill||!Object.prototype.hasOwnProperty.call(skill,"learnLevel")){ return; }
            const current=learnedLevel(context,skillId);
            const level=Math.max(1,Math.floor(numeric(context.character.level,1)));
            const points=Math.max(0,Math.floor(numeric(context.character.skillPoints)));
            const card=actionCardForRow(row);
            const levels=context.loadout.skillLevels;
            if(current<=0){
                const prereqOk=prerequisiteMet(levels,skill);
                const levelOk=level>=skill.learnLevel;
                const costOk=points>=numeric(skill.learnCost);
                if(levelOk&&prereqOk&&costOk){
                    setActionCard(card,true,"學習・"+skill.learnCost+"點","learnSkill('"+skillId+"')");
                }else{
                    const reasons=[];
                    if(!levelOk){ reasons.push("Lv"+skill.learnLevel+" 解鎖"); }
                    if(!prereqOk){ reasons.push("前置："+prerequisiteLabel(skill)); }
                    if(levelOk&&prereqOk&&!costOk){ reasons.push("需要 "+skill.learnCost+" 技能點"); }
                    setActionCard(card,false,reasons.join("・"),"");
                }
            }else if(current<numeric(skill.maxLevel,1)){
                const target=current+1;
                const required=getRequiredCharacterLevelForSkillLevel(skill,target);
                const cost=getUpgradeCostForTargetLevel(skill,target);
                if(level<required){
                    setActionCard(card,false,"角色 Lv"+required+" 可升至技能 Lv"+target,"");
                }else if(points<cost){
                    setActionCard(card,false,"升至 Lv"+target+" 需要 "+cost+" 技能點","");
                }else{
                    setActionCard(card,true,"升至 Lv"+target+"・"+cost+"點","upgradeSkill('"+skillId+"')");
                }
            }
        });
        const sorted=Array.from(list.querySelectorAll(".skill-row")).sort((left,right)=>{
            const a=skillById(rowSkillId(left))||{};
            const b=skillById(rowSkillId(right))||{};
            const ga=numeric(GROUP_ORDER[a.progressionGroup],9),gb=numeric(GROUP_ORDER[b.progressionGroup],9);
            if(ga!==gb){ return ga-gb; }
            const la=numeric(a.learnLevel,999),lb=numeric(b.learnLevel,999);
            if(la!==lb){ return la-lb; }
            return String(a.name||a.id||"").localeCompare(String(b.name||b.id||""),"zh-Hant");
        });
        sorted.forEach(row=>list.appendChild(row));
    }

    if(typeof renderSkillLoadout==="function"){
        const previousRenderSkillLoadout=renderSkillLoadout;
        renderSkillLoadout=function(){
            const result=previousRenderSkillLoadout.apply(this,arguments);
            decorateSkillProgressionUi();
            return result;
        };
    }

    function renderSkillDetailProgression(skillId){
        if(typeof document==="undefined"){ return; }
        const skill=skillById(skillId);
        if(!skill||!Object.prototype.hasOwnProperty.call(skill,"learnLevel")){ return; }
        const host=document.getElementById("skillDetailStats");
        const context=getSkillContext();
        if(!host||!context.loadout){ return; }
        const old=host.querySelector(".v17364-progression-detail");
        if(old){ old.remove(); }
        const current=learnedLevel(context,skillId);
        const next=current>0&&current<numeric(skill.maxLevel,1)?current+1:null;
        const block=document.createElement("div");
        block.className="v17364-progression-detail";
        let upgradeText="—";
        if(numeric(skill.maxLevel,1)>1){
            upgradeText=next
                ?getUpgradeCostForTargetLevel(skill,next)+" 技能點"
                :"Lv2 1・Lv3 2・Lv4 3・Lv5 4 技能點";
        }
        const rows=[
            ["最低學習等級","Lv"+skill.learnLevel],
            ["目前技能等級",current>0?"Lv"+current:"尚未學習"],
            ["下一級角色需求",next?"角色 Lv"+getRequiredCharacterLevelForSkillLevel(skill,next):"—"],
            ["學習成本",skill.learnCost+" 技能點"],
            ["升級成本",upgradeText],
            ["前置技能",prerequisiteLabel(skill)]
        ];
        rows.forEach(([label,value])=>{
            const row=document.createElement("div");
            const strong=document.createElement("strong");
            const span=document.createElement("span");
            strong.textContent=label;
            span.textContent=value;
            row.appendChild(strong);row.appendChild(span);block.appendChild(row);
        });
        host.appendChild(block);
    }

    if(typeof showSkillDetail==="function"){
        const previousShowSkillDetail=showSkillDetail;
        showSkillDetail=function(skillId){
            const result=previousShowSkillDetail.apply(this,arguments);
            renderSkillDetailProgression(skillId);
            return result;
        };
    }

    function actorByPartyIndex(index){
        if(typeof getPartyCharacterByIndex==="function"){ return getPartyCharacterByIndex(index); }
        if(index===1&&typeof player2!=="undefined"){ return player2; }
        if(index===2&&typeof player3!=="undefined"){ return player3; }
        return typeof player!=="undefined"?player:null;
    }
    function keyByPartyIndex(index,actor){
        if(typeof getPartyCharacterKey==="function"){
            const key=getPartyCharacterKey(index);
            if(key!==undefined&&key!==null){ return key; }
        }
        if(typeof getCharacterSkillKey==="function"&&actor){
            const key=getCharacterSkillKey(actor);
            if(key!==undefined&&key!==null){ return key; }
        }
        if(index===1){ return "player2"; }
        if(index===2){ return "player3"; }
        return actor&&actor.element?actor.element:(typeof currentSkillCharacter!=="undefined"?currentSkillCharacter:null);
    }
    function partySkillLevel(index,skillId){
        const actor=actorByPartyIndex(index);
        const context=getSkillContext(keyByPartyIndex(index,actor));
        return learnedLevel(context,skillId);
    }
    function activeBuff(actor,type){
        return actor&&Array.isArray(actor.activeBuffs)
            ?actor.activeBuffs.find(buff=>buff&&buff.type===type&&numeric(buff.turnsLeft,1)>0)||null:null;
    }
    function removeBuff(actor,buff){
        if(!actor||!buff||!Array.isArray(actor.activeBuffs)){ return; }
        actor.activeBuffs=actor.activeBuffs.filter(entry=>entry!==buff);
    }
    function canAddNamedBuff(actor,type,index,label){
        if(activeBuff(actor,type)){ return false; }
        if(typeof window.v173CanApplyNamedPersistentState==="function"){
            return window.v173CanApplyNamedPersistentState(actor,type,"player",index,label)!==false;
        }
        return true;
    }
    function addNamedBuff(actor,type,index,label,turns,extra){
        if(!canAddNamedBuff(actor,type,index,label)){ return null; }
        actor.activeBuffs=Array.isArray(actor.activeBuffs)?actor.activeBuffs:[];
        const buff=Object.assign({type,turnsLeft:Math.max(1,Math.floor(numeric(turns,1)))},extra||{});
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(buff,type);
        }
        actor.activeBuffs.push(buff);
        return buff;
    }
    function actorMaxHp(actor,index){
        let max=numeric(actor&&actor.maxHP);
        if(max<=0&&typeof getPartyBattleStats==="function"){
            const stats=getPartyBattleStats(index);
            max=numeric(stats&&(stats.maxHP||stats.maxHp||stats.hpMax));
        }
        if(max<=0){ max=Math.max(1,numeric(actor&&actor.hp,1)); }
        return Math.max(1,max);
    }
    function announceSkill(actorIndex,skill){
        if(typeof showSkillNameBadge==="function"){ showSkillNameBadge(skill.name,"fire",actorIndex); }
        if(typeof addBattleLog==="function"){ addBattleLog((actorByPartyIndex(actorIndex)?.id||"角色")+"施放「"+skill.name+"」。"); }
    }
    function finishTacticalAction(){
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
    }
    function castNewFireTactical(actorIndex,skillId){
        const actor=actorByPartyIndex(actorIndex);
        const skill=skillById(skillId);
        const level=partySkillLevel(actorIndex,skillId);
        if(!actor||!skill||level<=0){ return notify("尚未學會「"+(skill&&skill.name||skillId)+"」。"); }
        const cost=Math.max(0,numeric(skill.spCost));
        if(numeric(actor.sp)<cost){ return notify("SP不足，需要"+cost+"點。"); }
        if(skillId==="fireSoulResonance"){
            if(!canAddNamedBuff(actor,"fireSoulResonance",actorIndex,"炎魂共鳴")){
                return notify("炎魂共鳴仍在持續中，無法重複施放或刷新。");
            }
            actor.sp=numeric(actor.sp)-cost;
            addNamedBuff(actor,"fireSoulResonance",actorIndex,"炎魂共鳴",3,{skillLevel:level});
            announceSkill(actorIndex,skill);finishTacticalAction();return true;
        }
        if(skillId==="bloodBurnArt"){
            if(activeBuff(actor,"bloodBurn")){
                return notify("焚血尚未消耗，無法重複施放或刷新。");
            }
            const maxHp=actorMaxHp(actor,actorIndex);
            if(numeric(actor.hp)<=maxHp*.20){ return notify("目前HP必須高於最大HP的20%才能施放焚血訣。"); }
            if(!canAddNamedBuff(actor,"bloodBurn",actorIndex,"焚血")){
                return notify("焚血尚未消耗，無法重複施放或刷新。");
            }
            actor.sp=numeric(actor.sp)-cost;
            const hpCost=Math.max(1,Math.round(maxHp*.10));
            actor.hp=Math.max(1,numeric(actor.hp)-hpCost);
            addNamedBuff(actor,"bloodBurn",actorIndex,"焚血",2,{skillLevel:level,hpCost});
            announceSkill(actorIndex,skill);finishTacticalAction();return true;
        }
        return false;
    }

    const SCALED_SUPPORT={
        dodgeSkill:{field:"evasionBonusPercent",values:DODGE_BY_LEVEL},
        rockWall:{field:"defenseBonusPercent",values:ROCK_WALL_BY_LEVEL},
        earthShield:{field:"reflectPercent",values:EARTH_SHIELD_BY_LEVEL}
    };
    let scaledSupportDepth=0;
    function withScaledSupport(actorIndex,skillId,invoke){
        const config=SCALED_SUPPORT[skillId];
        const skill=skillById(skillId);
        if(!config||!skill||scaledSupportDepth>0){ return invoke(); }
        const level=clampLevel(partySkillLevel(actorIndex,skillId),skill.maxLevel);
        const had=Object.prototype.hasOwnProperty.call(skill,config.field);
        const old=skill[config.field];
        skill[config.field]=config.values[level-1];
        scaledSupportDepth++;
        try{ return invoke(); }
        finally{
            scaledSupportDepth--;
            if(had){ skill[config.field]=old; }else{ delete skill[config.field]; }
        }
    }

    let fireCastContext=null;
    function isPlayerFireDirectSkill(skill){
        return !!(skill&&skill.element==="fire"&&(skill.category==="physical"||skill.category==="magic"));
    }
    function createMomentum(actor,index,resonance){
        if(!resonance||activeBuff(actor,"fireMomentum")){ return null; }
        const level=clampLevel(resonance.skillLevel,5);
        return addNamedBuff(actor,"fireMomentum",index,"炎勢",Number.MAX_SAFE_INTEGER,{skillLevel:level,bonusPercent:FIRE_MOMENTUM_BY_LEVEL[level-1],oneShot:true});
    }
    function withFireActiveCast(actorIndex,skillId,invoke){
        const skill=skillById(skillId);
        if(!isPlayerFireDirectSkill(skill)||fireCastContext){ return invoke(); }
        const actor=actorByPartyIndex(actorIndex);
        if(!actor){ return invoke(); }
        const resonance=activeBuff(actor,"fireSoulResonance");
        const momentum=activeBuff(actor,"fireMomentum");
        const blood=activeBuff(actor,"bloodBurn");
        const bonus=numeric(momentum&&momentum.bonusPercent)+
            (blood?BLOOD_BURN_BY_LEVEL[clampLevel(blood.skillLevel,5)-1]:0);
        const hadDamageBonus=Object.prototype.hasOwnProperty.call(skill,"damageBonusPercent");
        const previousDamageBonus=skill.damageBonusPercent;
        if(bonus){ skill.damageBonusPercent=numeric(previousDamageBonus)+bonus; }
        const beforeSp=numeric(actor.sp);
        const context={actor,actorIndex,skillId,resonance,momentum,blood,critical:false,burnAdded:false,finished:false};
        fireCastContext=context;
        let result;
        try{ result=invoke(); }
        finally{
            fireCastContext=null;
            if(bonus){
                if(hadDamageBonus){ skill.damageBonusPercent=previousDamageBonus; }
                else{ delete skill.damageBonusPercent; }
            }
        }
        const succeeded=context.finished||numeric(actor.sp)<beforeSp;
        if(succeeded){
            if(momentum){ removeBuff(actor,momentum); }
            if(blood){ removeBuff(actor,blood); }
            if(!momentum&&resonance&&(context.critical||context.burnAdded)&&activeBuff(actor,"fireSoulResonance")){
                createMomentum(actor,actorIndex,resonance);
            }
        }
        return result;
    }

    if(typeof rollCritical==="function"){
        const previousRollCritical=rollCritical;
        rollCritical=function(){
            const result=previousRollCritical.apply(this,arguments);
            if(fireCastContext&&result&&result.isCrit){ fireCastContext.critical=true; }
            return result;
        };
    }
    if(typeof applyBurnEffect==="function"){
        const previousApplyBurnEffect=applyBurnEffect;
        applyBurnEffect=function(){
            const result=previousApplyBurnEffect.apply(this,arguments);
            if(fireCastContext&&result===true){ fireCastContext.burnAdded=true; }
            return result;
        };
    }
    if(typeof finishPlayerAction==="function"){
        const previousFinishPlayerAction=finishPlayerAction;
        finishPlayerAction=function(){
            if(fireCastContext){ fireCastContext.finished=true; }
            return previousFinishPlayerAction.apply(this,arguments);
        };
    }

    if(typeof castDamageSkill==="function"){
        const previousCastDamageSkill=castDamageSkill;
        castDamageSkill=function(skillId){
            return withFireActiveCast(0,skillId,()=>previousCastDamageSkill.apply(this,arguments));
        };
    }
    if(typeof castSecondaryCharacterSkill==="function"){
        const previousCastSecondaryCharacterSkill=castSecondaryCharacterSkill;
        castSecondaryCharacterSkill=function(characterIndex,skillId){
            if(skillId==="fireSoulResonance"||skillId==="bloodBurnArt"){
                return castNewFireTactical(characterIndex,skillId);
            }
            return withScaledSupport(characterIndex,skillId,()=>
                withFireActiveCast(characterIndex,skillId,()=>previousCastSecondaryCharacterSkill.apply(this,arguments))
            );
        };
    }
    if(typeof castPlayer2Skill==="function"){
        const previousCastPlayer2Skill=castPlayer2Skill;
        castPlayer2Skill=function(skillId){
            if(skillId==="fireSoulResonance"||skillId==="bloodBurnArt"){
                return castNewFireTactical(1,skillId);
            }
            return withScaledSupport(1,skillId,()=>
                withFireActiveCast(1,skillId,()=>previousCastPlayer2Skill.apply(this,arguments))
            );
        };
    }
    if(typeof castBuffSkill==="function"){
        const previousCastBuffSkill=castBuffSkill;
        castBuffSkill=function(skillId){
            const actorIndex=typeof activeBattleCharacterIndex!=="undefined"&&Number.isInteger(activeBattleCharacterIndex)
                ?activeBattleCharacterIndex:0;
            if(skillId==="fireSoulResonance"||skillId==="bloodBurnArt"){
                return castNewFireTactical(actorIndex,skillId);
            }
            return withScaledSupport(actorIndex,skillId,()=>previousCastBuffSkill.apply(this,arguments));
        };
    }

    if(typeof document!=="undefined"&&!document.getElementById("v17364-skill-progression-style")){
        const style=document.createElement("style");
        style.id="v17364-skill-progression-style";
        style.textContent=
            ".v17364-progression-hint{display:block;margin-top:4px;white-space:normal;overflow-wrap:anywhere;line-height:1.35;opacity:.86;font-size:.82em;}"+
            ".v17364-progression-detail{display:grid;gap:6px;margin-top:10px;}"+
            ".v17364-progression-detail>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}"+
            ".v17364-progression-detail strong{flex:0 0 auto;}"+
            ".v17364-progression-detail span{text-align:right;overflow-wrap:anywhere;}";
        document.head.appendChild(style);
    }

    window.v17364SkillUpgradeCostByTargetLevel=SKILL_UPGRADE_COST_BY_TARGET_LEVEL;
    window.v17364GetRequiredCharacterLevelForSkillLevel=getRequiredCharacterLevelForSkillLevel;
    window.v17364GetUpgradeCostForTargetLevel=getUpgradeCostForTargetLevel;
    window.v17364ApplyFinalProgressionData=applyFinalProgressionData;
    window.v17364CastNewFireTactical=castNewFireTactical;
    window.v17364DecorateSkillProgressionUi=decorateSkillProgressionUi;
    window.v17364SkillProgression={
        version:"173.64",upgradeCosts:SKILL_UPGRADE_COST_BY_TARGET_LEVEL,
        fireMomentumByLevel:FIRE_MOMENTUM_BY_LEVEL,bloodBurnByLevel:BLOOD_BURN_BY_LEVEL,
        dodgeByLevel:DODGE_BY_LEVEL,rockWallByLevel:ROCK_WALL_BY_LEVEL,earthShieldByLevel:EARTH_SHIELD_BY_LEVEL,
        getRequiredCharacterLevelForSkillLevel,getUpgradeCostForTargetLevel,applyFinalProgressionData,
        castNewFireTactical,decorateSkillProgressionUi
    };

    if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
})();
