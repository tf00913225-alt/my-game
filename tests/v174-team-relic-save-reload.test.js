"use strict";

const assert=require("node:assert/strict");
const fs=require("fs");
const vm=require("vm");

const coreSource=fs.readFileSync("js/00-main.js","utf8");
const relicSource=fs.readFileSync("js/60-team-relic-system.js","utf8");
const repositorySource=fs.readFileSync("js/startup/account-save-repository.js","utf8");
const saveStart=coreSource.indexOf("function saveGame(){");
const saveEnd=coreSource.indexOf("function loadGame(){",saveStart);

assert.ok(saveStart>=0&&saveEnd>saveStart,"core saveGame source must be extractable");

const storedRelics={
    relic_qinglan_feather:{unlocked:true,level:4,exp:0,seen:true}
};
const storedLoadout={relicId:"relic_qinglan_feather",subRelicId:null};
const accountUid="relic-reload-uid";
const accountSaveKey="four_symbols_save:"+accountUid;
const store=new Map([
    [accountSaveKey,JSON.stringify({
        version:6,
        player:{id:"整合QA"},
        playerRelics:storedRelics,
        teamLoadout:storedLoadout
    })],
    ["four_symbols_save_meta:"+accountUid,JSON.stringify({schemaVersion:1,ownerUid:accountUid,source:"fixture"})]
]);
const localStorage={
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
};
const coreContext={
    console,JSON,Date,window:null,localStorage,SAVE_KEY:accountSaveKey,
    deleteAllCharactersInProgress:false,
    normalizeInventoryStacks(){},
    player:{id:"整合QA"},player2:null,player3:null,sharedExp:0,gold:100,
    dailyQuestState:{},commissionQuestState:{},bestiaryData:{},achievementState:{},
    selectedCreationElement:"fire",characterEquipment:{},characterSkillLoadouts:{},
    autoConfig:{},autoConfig2:{},autoConfig3:{},inventoryItems:[]
};

vm.createContext(coreContext);
coreContext.window=coreContext;
vm.runInContext(repositorySource,coreContext);
coreContext.FourSymbolsAccountSave.activate(accountUid);
vm.runInContext(coreSource.slice(saveStart,saveEnd),coreContext);
coreContext.saveGame();

const afterEarlyCoreSave=JSON.parse(store.get(accountSaveKey));
assert.deepEqual(
    JSON.parse(JSON.stringify(afterEarlyCoreSave.teamLoadout)),
    storedLoadout,
    "the early core save during reload must retain the late runtime loadout"
);
assert.equal(
    afterEarlyCoreSave.playerRelics.relic_qinglan_feather.level,
    4,
    "the early core save during reload must retain relic ownership and level"
);

const noop=()=>{};
const document={
    readyState:"complete",body:{appendChild:noop},head:{appendChild:noop},
    documentElement:{dataset:{}},getElementById(){return null;},querySelector(){return null;},
    createElement(){return {classList:{add:noop,remove:noop,contains(){return false;}},style:{},setAttribute:noop,appendChild:noop,querySelector(){return null;}};},
    addEventListener:noop
};
const party=[
    {id:"整合QA",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]},
    {id:"乙",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]},
    {id:"丙",level:30,hp:1000,sp:200,activeBuffs:[],statusEffects:[]}
];
const monsters=Array.from({length:10},(_,index)=>({
    name:"怪"+index,rank:"regular",alive:true,hp:2000,maxHP:2000,
    attack:100,magicAttack:100,accuracy:100,statusEffects:[],activeBuffs:[]
}));
const relicContext={
    console,Math,Number,Object,Array,Set,Map,JSON,Date,Promise,setTimeout,clearTimeout,
    document,localStorage,SAVE_KEY:accountSaveKey,gold:100,window:null,
    player:party[0],player2:party[1],player3:party[2],monsters,
    currentBattleMonsters:[0,1,2,3,4,5,6,7,8,9],battleActive:false,battleToken:0,
    turn:1,battlePhase:"resolve",initiativeIndex:0,initiativeQueue:[],
    getExistingPartyIndexes:()=>[0,1,2],getPartyCharacterByIndex:index=>party[index]||null,
    getPartyBattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
    getMainCharacterStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
    getPlayer2BattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
    getPlayer3BattleStats:()=>({maxHP:1000,maxSP:200,attack:100,magicAttack:100,defense:100,evasion:0,resistance:0}),
    getMonsterRank:monster=>monster.rank,isMonsterFrozen:()=>false,isMonsterPetrified:()=>false,
    applyBurnEffect:()=>true,showPlayerHit:noop,showMonsterHit:noop,addBattleLog:noop,
    updateUI:noop,updateGoldDisplay:noop,showPage:noop,openHomeFeature:noop,closeHomeFeature:noop,
    killMonster:noop,startTurn:noop,startBattle:noop,processNextCombatant:noop,
    processSingleMonsterAttack:noop,tickStatusEffects:noop,winBattle:noop,loseBattle:noop,
    saveGame:noop
};
relicContext.window=relicContext;
vm.createContext(relicContext);
vm.runInContext(repositorySource,relicContext);
relicContext.FourSymbolsAccountSave.activate(accountUid);
vm.runInContext(relicSource,relicContext);

assert.equal(
    relicContext.v174RelicSystem.getTeamLoadout().relicId,
    "relic_qinglan_feather",
    "a fresh late relic runtime must hydrate the equipped relic after reload"
);
assert.equal(
    relicContext.v174RelicSystem.getOwnedState().relic_qinglan_feather.level,
    4,
    "a fresh late relic runtime must hydrate the saved relic level after reload"
);

console.log("✓ Team Relic save/reload ownership regression tests passed.");
