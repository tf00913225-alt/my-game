"use strict";

const fs=require("node:fs");
const vm=require("node:vm");

const slotOwnerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");

const ENEMY_BACK=["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5"];
const ENEMY_FRONT=["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"];
const ALLY_FRONT=["ALLY_F1","ALLY_F2","ALLY_F3"];
const ALLY_BACK=["ALLY_B1","ALLY_B2","ALLY_B3"];
const MECHANISM=["MECH_L","MECH_C","MECH_R"];

function rect(left,top,width,height){
    return {left,top,right:left+width,bottom:top+height,width,height};
}

function formalSlotRect(slot){
    let index=ENEMY_BACK.indexOf(slot);
    if(index>=0){ return rect(15+index*78,45,72,112); }
    index=ENEMY_FRONT.indexOf(slot);
    if(index>=0){ return rect(15+index*78,170,72,112); }
    index=ALLY_FRONT.indexOf(slot);
    if(index>=0){ return rect(55+index*110,470,90,112); }
    index=ALLY_BACK.indexOf(slot);
    if(index>=0){ return rect(55+index*110,595,90,112); }
    index=MECHANISM.indexOf(slot);
    if(index>=0){ return rect(18+index*132,300,120,90); }
    throw new Error("Unknown formal battlefield slot: "+slot);
}

function selectorFor(slot){
    if(slot.startsWith("ENEMY_")){ return '.v-fixed-enemy-slot[data-slot="'+slot+'"]'; }
    if(slot.startsWith("ALLY_")){ return '.v-fixed-ally-slot[data-slot="'+slot+'"]'; }
    return '.boss-mechanism-position[data-slot="'+slot+'"]';
}

function slotClass(slot){
    if(slot.startsWith("ENEMY_")){ return "v-fixed-enemy-slot"; }
    if(slot.startsWith("ALLY_")){ return "v-fixed-ally-slot"; }
    return "boss-mechanism-position";
}

function defaultEnemyIndexes(context){
    if(Array.isArray(context.monsters)){
        return context.monsters.map((_,index)=>index).slice(0,10);
    }
    return Array.isArray(context.currentBattleMonsters)?context.currentBattleMonsters.slice(0,10):[];
}

function defaultAllyIndexes(context){
    const indexes=[];
    if(typeof context.getPartyCharacterByIndex!=="function"){ return indexes; }
    for(let index=0;index<6;index++){
        if(context.getPartyCharacterByIndex(index)){ indexes.push(index); }
    }
    return indexes;
}

function installFormalFixedSlotOwner(context,createNode,options={}){
    if(!context||!context.document){ throw new Error("Fixed Slot fixture requires a document"); }
    if(typeof createNode!=="function"){ throw new Error("Fixed Slot fixture requires a slot-node factory"); }

    const slotNodes={};
    const selectorNodes={};
    ENEMY_BACK.concat(ENEMY_FRONT,ALLY_FRONT,ALLY_BACK,MECHANISM).forEach(slot=>{
        const node=createNode(slot,formalSlotRect(slot));
        node.dataset=node.dataset||{};
        node.dataset.slot=slot;
        node.className=slotClass(slot);
        slotNodes[slot]=node;
        selectorNodes[selectorFor(slot)]=node;
    });

    const document=context.document;
    const previousQuerySelector=typeof document.querySelector==="function"
        ?document.querySelector.bind(document):()=>null;
    document.querySelector=selector=>selectorNodes[selector]||previousQuerySelector(selector);

    vm.runInContext(slotOwnerSource,context,{filename:"js/battlefield-slot-owner.js"});
    const owner=context.FourSymbolsBattlefieldSlots;
    if(!owner){ throw new Error("Formal FourSymbolsBattlefieldSlots owner failed to install"); }

    const enemyIndexes=Array.isArray(options.enemyIndexes)
        ?options.enemyIndexes.slice():defaultEnemyIndexes(context);
    if(enemyIndexes.length){
        const formationType=options.enemyFormationType===undefined
            ?Math.max(1,enemyIndexes.length):options.enemyFormationType;
        owner.setActiveEnemySnapshot(owner.createEnemyFormationSnapshot(enemyIndexes,{originalFormationType:formationType}));
    }

    const allyIndexes=Array.isArray(options.allyIndexes)
        ?options.allyIndexes.slice():defaultAllyIndexes(context);
    owner.hydrateAllyFormation(options.allyFormation||null,allyIndexes);

    return {owner,slotNodes,selectorNodes};
}

module.exports={
    installFormalFixedSlotOwner,
    formalSlotRect,
    ENEMY_BACK,ENEMY_FRONT,ALLY_FRONT,ALLY_BACK,MECHANISM
};
