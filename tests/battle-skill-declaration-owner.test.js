"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/00-main.js','utf8');
const extract=(name,next)=>source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'(',source.indexOf('function '+name+'(')));
const party=[0,1,2].map(()=>({hp:100,sp:100}));
let finished=0;
const ctx={battleActive:true,battlePhase:'declare',activeBattleCharacterIndex:0,autoBattle:false,actionReady:false,pendingAction:null,queuedPlayerActions:{},
    skillDatabase:{attack:{name:'攻擊',category:'magic',spCost:10,targetType:'single'},heal:{name:'治療',category:'heal',spCost:10,targetType:'ally'},buff:{name:'增益',category:'buff',spCost:10,targetType:'ally'},passive:{name:'被動',category:'passive'}},
    characterSkillLoadouts:Object.fromEntries([0,1,2].map(i=>[i,{skillLevels:{attack:1,heal:1,buff:1},equippedSkills:['attack','heal','buff']}])),
    getPartyCharacterByIndex:i=>party[i],getBattleCharacterByIndex:i=>party[i],getPartyCharacterKey:i=>i,getPartyAutoConfig:()=>({enabled:false}),
    addBattleLog(){},closeMenus(){},clearBattleTargetSelectionMode(){},setBattleTargetSelectionMode(){},setBattleAllyTargetSelectionMode(){},
    updateUI(){},finishPlayerAction(){finished++;ctx.actionReady=false;ctx.pendingAction=null;},populateSkillQuickBar(){},syncTurnTimerWithBattlePickers(){},
    isValidAllyTargetForSkill:(skill,character)=>character.hp>0,currentBattleMonsters:[0],canSelectHostileBattlePrimary:()=>true,getBattleActionTargetType:()=>"single",getBattleActionDisplayName:()=>"attack",
    $:()=>({textContent:'',classList:{add(){}}}),document:{querySelectorAll:()=>[]},monsters:[{alive:true,hp:100,name:'敵人'}]};
vm.createContext(ctx);
vm.runInContext(extract('prepareAction','selectBattleTarget')+extract('selectBattleTarget','executeAction'),ctx);
// Avoid loading unrelated combat functions; these selection helpers are source slices.
vm.runInContext(extract('selectBattleAllyTarget','returnFromBattleTargetSelection')+extract('returnFromBattleTargetSelection','clearActiveCharacterHighlight'),ctx);
for(let i=0;i<3;i++){
    ctx.activeBattleCharacterIndex=i;
    for(const skill of ['attack','heal','buff']){
        ctx.queuedPlayerActions={};ctx.prepareAction(skill);assert.equal(ctx.pendingAction,skill);
        ctx.returnFromBattleTargetSelection();assert.equal(ctx.actionReady,false);assert.equal(finished,0);
        ctx.prepareAction(skill);assert.equal(ctx.pendingAction,skill);ctx.prepareAction('attack');assert.equal(ctx.pendingAction,skill,'rapid second choice cannot replace pending action');
        if(skill==='attack'){ctx.selectBattleTarget(0);ctx.selectBattleTarget(0);}else{ctx.selectBattleAllyTarget(0);ctx.selectBattleAllyTarget(0);}
        assert.equal(ctx.queuedPlayerActions[i].action,skill);assert.equal(finished,1,'one action declaration completes once');finished=0;
    }
    ctx.characterSkillLoadouts[i].equippedSkills=[];ctx.prepareAction('heal');assert.equal(ctx.actionReady,false,'support skill cannot bypass equipment eligibility');
    ctx.characterSkillLoadouts[i].equippedSkills=['attack','heal','buff'];party[i].sp=0;ctx.prepareAction('attack');assert.equal(ctx.actionReady,false);party[i].sp=100;
}
ctx.activeBattleCharacterIndex=0;
ctx.autoBattle=true;ctx.prepareAction('attack');assert.equal(ctx.actionReady,false);ctx.autoBattle=false;
ctx.battlePhase='resolve';ctx.prepareAction('attack');assert.equal(ctx.actionReady,false);ctx.battlePhase='declare';
ctx.prepareAction('unknown');ctx.prepareAction('passive');assert.equal(ctx.actionReady,false);
for(const file of ['js/35-v141-ui-battle.js','js/42-v148-combat-dungeon-fixes.js']){assert.doesNotMatch(fs.readFileSync(file,'utf8'),/prepareAction\s*=\s*function/);}
console.log('✓ common declaration owner: three roles, attack/heal/buff, return, once-only submission, phase/auto/SP/equipment rejection');
