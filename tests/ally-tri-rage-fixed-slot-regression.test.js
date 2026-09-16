"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const ownerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const v148Source=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");

function makeRuntime(){
    let characters=[];
    const sandbox={console,setTimeout:()=>1,clearTimeout(){}};
    const context=vm.createContext(sandbox);
    context.window=context;
    context.self=context;
    context.globalThis=context;
    context.activeBattleCharacterIndex=0;
    context.getExistingPartyIndexes=()=>[0,1,2].filter(index=>!!characters[index]);
    context.getPartyCharacterByIndex=index=>characters[index]||null;
    context.getPartyCharacterKey=index=>"player"+index;
    context.getSkillLevel=(_key,id)=>id==="rage"?5:0;
    context.getPartyBattleStats=()=>({maxHP:500,maxSP:100,intelligence:0});
    context.updateUI=()=>{};
    context.finishPlayerAction=()=>{};
    context.lungePlayerCard=()=>{};
    context.showSkillNameBadge=()=>{};
    context.showPlayerSpPopup=()=>{};
    context.addBattleLog=()=>{};
    context.v173MarkPersistentStateName=(buff,skillId)=>{
        buff.statusName=skillId==="rage"?"怒火":String(skillId||"");
        return buff;
    };
    context.skillDatabase={
        rage:{
            id:"rage",name:"怒火",element:"fire",category:"buff",targetType:"allyTri",
            spCost:50,duration:3,
            critBonusByLevel:[5,10,15,20,25],
            critChanceBonusByLevel:[5,10,15,20,25],
            critDamageBonusByLevel:[10,20,30,40,50]
        }
    };
    vm.runInContext(ownerSource,context,{filename:"js/battlefield-slot-owner.js"});
    vm.runInContext(v148Source,context,{filename:"js/42-v148-combat-dungeon-fixes.js"});
    return {
        context,
        setCharacters(value){ characters=value; }
    };
}

function compact(character){
    return character.activeBuffs.map(buff=>({
        type:buff.type,statusName:buff.statusName,turnsLeft:buff.turnsLeft,
        chance:buff.critChanceBonusPercent,damage:buff.critDamageBonusPercent
    }));
}

{
    const runtime=makeRuntime();
    const characters=[
        {id:"中",hp:500,sp:100,activeBuffs:[{
            type:"rage",statusName:"怒火",turnsLeft:2,
            bonusPercent:5,critChanceBonusPercent:5,critDamageBonusPercent:10
        }],statusEffects:[]},
        {id:"左",hp:500,sp:100,activeBuffs:[],statusEffects:[]},
        {id:"右",hp:500,sp:100,activeBuffs:[],statusEffects:[]}
    ];
    runtime.setCharacters(characters);
    runtime.context.v148ResolveSupportAction(
        0,{action:"rage",targetAlly:0},runtime.context.skillDatabase.rage
    );
    assert.equal(characters[0].sp,50);
    assert.deepEqual(compact(characters[0]),[
        {type:"rage",statusName:"怒火",turnsLeft:2,chance:5,damage:10}
    ]);
    assert.deepEqual(compact(characters[1]),[
        {type:"rage",statusName:"怒火",turnsLeft:3,chance:25,damage:50}
    ]);
    assert.deepEqual(compact(characters[2]),[
        {type:"rage",statusName:"怒火",turnsLeft:3,chance:25,damage:50}
    ]);
}

{
    const runtime=makeRuntime();
    const characters=[
        {id:"中",hp:500,sp:100,activeBuffs:[],statusEffects:[]},
        {id:"左",hp:500,sp:100,activeBuffs:[],statusEffects:[]},
        {id:"右",hp:500,sp:100,activeBuffs:[],statusEffects:[]}
    ];
    runtime.setCharacters(characters);
    runtime.context.v148ResolveSupportAction(
        0,{action:"rage",targetAlly:2},runtime.context.skillDatabase.rage
    );
    assert.equal(characters[0].sp,50);
    characters.forEach(character=>assert.deepEqual(compact(character),[
        {type:"rage",statusName:"怒火",turnsLeft:3,chance:25,damage:50}
    ]));
}

console.log("Rage allyTri Fixed Slot edge regression passed.");
