/* Shared player skill progression rules. No persistence, UI or combat execution. */
(function installSkillProgressionCore(global){
"use strict";
const SKILL_UPGRADE_COST_BY_TARGET_LEVEL=Object.freeze({
        2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1
    });
function createRules(catalog,damageSkillIds){
if(!catalog||typeof catalog!=="object"||Array.isArray(catalog)||!Array.isArray(damageSkillIds)){throw new TypeError("skill catalogue and damage classifications required");}
const PLAYER_DAMAGE_SKILL_ID_SET=new Set(damageSkillIds);
function numeric(value,fallback){
        const number=Number(value);
        return Number.isFinite(number)?number:(fallback===undefined?0:fallback);
    }
function skillById(id){ return catalog[id]||null; }
function skillLabel(skillId){
        const skill=skillById(skillId);
        return skill&&skill.name?skill.name:String(skillId||"");
    }
function getInitialLearnCost(character,skill){
        const base=Math.max(0,Math.floor(numeric(skill&&skill.learnCost)));
        const cross=!!(character&&skill&&character.element&&skill.element&&character.element!==skill.element);
        return base*(cross?2:1);
    }
function initialLearnCost(context,skill){ return Math.max(0,Math.floor(numeric(getInitialLearnCost(context&&context.character,skill)))); }
function getRequiredCharacterLevelForSkillLevel(skill,targetSkillLevel){
        const learnLevel=Math.max(1,Math.floor(numeric(skill&&skill.learnLevel,1)));
        const target=Math.max(1,Math.floor(numeric(targetSkillLevel,1)));
        if(target<=1){ return learnLevel; }
        /* Absolute character-level gates; never offset by learnLevel. */
        const maxLevel=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel,1)));
        if(maxLevel<=1){ return Infinity; }
        if(PLAYER_DAMAGE_SKILL_ID_SET.has(skill&&skill.id)){
            return Math.min(90,Math.max(10,(target-1)*10));
        }
        return Math.min(80,Math.max(20,(target-1)*20));
    }
function getUpgradeCostForTargetLevel(skill,targetSkillLevel){
        if(!skill||numeric(skill.maxLevel,1)<=1){ return 0; }
        return numeric(SKILL_UPGRADE_COST_BY_TARGET_LEVEL[Math.floor(numeric(targetSkillLevel))],0);
    }
function getSkillUpgradeEligibility(character,skill,currentSkillLevel){
        const current=Math.max(0,Math.floor(numeric(currentSkillLevel)));
        const maxLevel=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel,1)));
        const target=current+1;
        const requiredLevel=target<=maxLevel
            ?getRequiredCharacterLevelForSkillLevel(skill,target):Infinity;
        const characterLevel=Math.max(1,Math.floor(numeric(character&&character.level,1)));
        const cost=target<=maxLevel?getUpgradeCostForTargetLevel(skill,target):0;
        const points=Math.max(0,Math.floor(numeric(character&&character.skillPoints)));
        const learned=current>0;
        const atMax=learned&&current>=maxLevel;
        const levelOk=learned&&!atMax&&characterLevel>=requiredLevel;
        const pointsOk=learned&&!atMax&&points>=cost;
        let reason="";
        if(!skill){ reason="技能資料不存在"; }
        else if(!learned){ reason="請先學會此技能"; }
        else if(atMax){ reason="已達最高技能等級"; }
        else if(!levelOk){ reason="需要角色 Lv"+requiredLevel; }
        else if(!pointsOk){ reason="技能點不足，需要"+cost+"點"; }
        return Object.freeze({allowed:!!(skill&&levelOk&&pointsOk),currentLevel:current,
            targetLevel:target,maxLevel,requiredLevel,levelOk,pointsOk,cost,reason});
    }
function isCrossElementSkill(character,skill){
        return !!(character&&skill&&character.element&&skill.element&&character.element!==skill.element);
    }
function hasLearnedNativeSkill(context){
        const levels=context&&context.loadout&&context.loadout.skillLevels||{};
        return Object.keys(levels).some(id=>numeric(levels[id])>0&&skillById(id)&&skillById(id).element===context.character.element);
    }
function crossLearnGate(context,skill){
        if(!isCrossElementSkill(context.character,skill)){ return {ok:true,cross:false}; }
        if(/EX$/.test(String(skill.id||""))||skill.category==="passive"){
            return {ok:false,cross:true,reason:"本命元素限定"};
        }
        if(!hasLearnedNativeSkill(context)){
            return {ok:false,cross:true,reason:"需先學會至少 1 招本命元素技能"};
        }
        return {ok:true,cross:true};
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
function getSkillLearnEligibility(character,skill,levels){
        const safeCharacter=character||null;
        const safeSkill=skill||null;
        const safeLevels=levels||{};
        const cross=isCrossElementSkill(safeCharacter,safeSkill);
        const native=!cross;
        const crossGate=crossLearnGate({character:safeCharacter,loadout:{skillLevels:safeLevels}},safeSkill);
        const levelOk=!!(safeCharacter&&safeSkill&&
            Math.max(1,Math.floor(numeric(safeCharacter.level,1)))>=
            getRequiredCharacterLevelForSkillLevel(safeSkill,1));
        const prerequisiteRequired=!cross;
        const prerequisiteOk=!prerequisiteRequired||prerequisiteMet(safeLevels,safeSkill);
        const learnCost=initialLearnCost({character:safeCharacter},safeSkill);
        const points=Math.max(0,Math.floor(numeric(safeCharacter&&safeCharacter.skillPoints)));
        const pointsOk=points>=learnCost;
        const allowed=!!(safeSkill&&levelOk&&crossGate.ok&&prerequisiteOk&&pointsOk);
        let reason="";
        if(!safeSkill){ reason="技能資料不存在"; }
        else if(!levelOk){ reason="Lv"+safeSkill.learnLevel+" 解鎖"; }
        else if(!crossGate.ok){ reason=crossGate.reason; }
        else if(!prerequisiteOk){ reason="需先學習："+prerequisiteLabel(safeSkill); }
        else if(!pointsOk){ reason="需要"+learnCost+"點"; }
        return Object.freeze({
            isCrossElement:cross,
            isNativeElement:native,
            allowed,
            levelOk,
            prerequisiteRequired,
            prerequisiteOk,
            learnCost,
            pointsOk,
            crossGateOk:!!crossGate.ok,
            reason
        });
    }
return Object.freeze({getInitialLearnCost,initialLearnCost,getRequiredCharacterLevelForSkillLevel,getUpgradeCostForTargetLevel,getSkillUpgradeEligibility,isCrossElementSkill,prerequisiteLabel,getSkillLearnEligibility,upgradeCosts:SKILL_UPGRADE_COST_BY_TARGET_LEVEL});
}
global.FourSymbolsSkillProgressionCore=Object.freeze({createRules,upgradeCosts:SKILL_UPGRADE_COST_BY_TARGET_LEVEL});
if(typeof module!=="undefined"&&module.exports){module.exports=global.FourSymbolsSkillProgressionCore;}
})(typeof window!=="undefined"?window:globalThis);
