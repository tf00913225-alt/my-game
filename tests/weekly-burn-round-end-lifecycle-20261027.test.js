"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const main=fs.readFileSync(path.join(root,"js/00-main.js"),"utf8");

/* Exercise the actual dev BattleFlow boundary and Burn duration sources, not
   a copied damage formula or a fabricated status-chance roll. */
function sourceFunction(name){
    const start=main.indexOf("function "+name+"(");
    assert.ok(start>=0,"missing formal source: "+name);
    const end=main.indexOf("\n}",start);
    assert.ok(end>start,"missing formal function end: "+name);
    return main.slice(start,end+2);
}

function burnRoundFixture(){
    const monster={
        name:"測試怪",alive:true,hp:500,maxHP:1000,
        activeBuffs:[],statusEffects:[{type:"burn",turnsLeft:2,percent:10}]
    };
    const character={
        id:"測試角色",hp:500,maxHP:1000,
        activeBuffs:[],statusEffects:[{type:"burn",turnsLeft:2,percent:10}]
    };
    const dotCalls=[],visualCalls=[];
    const context={
        console,Math,Number,String,Array,Set,
        battleActive:true,battleToken:42,turn:1,
        battleRoundBoundaryKeys:new Set(),
        battleRoundStartObservers:[],battleRoundEndObservers:[],
        currentBattleMonsters:[0],monsters:[monster],
        getExistingPartyIndexes(){return [0];},
        getPartyCharacterByIndex(index){return index===0?character:null;},
        getPartyBattleStats(){return {maxHP:1000};},
        settleBattleHpDamage(target,amount,details){
            assert.equal(details.sourceType,"dot");
            assert.equal(details.damageKind,"dot");
            dotCalls.push({side:target===monster?"monster":"player",amount});
            target.hp=Math.max(0,target.hp-amount);
        },
        showMonsterHit(index,amount,type){
            assert.equal(index,0);
            assert.equal(type,"hp");
            visualCalls.push({side:"monster",amount});
        },
        showPlayerHit(amount,type,index){
            assert.equal(index,0);
            assert.equal(type,"hp");
            visualCalls.push({side:"player",amount});
        },
        addBattleLog(){},
        battleStatisticsRecordDamageDealtByActor(){},
        battleStatisticsRecordDamageTakenByIndex(){},
        killMonster(){throw Error("Target should survive both DoT rounds");},
        expireBattleActionBuff(){},
        expireBattleActionStatus(){throw Error("Burn expiry belongs to tickStatusEffects");},
        tickPlayerBuffs(){},
        updateUI(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext([
        "notifyBattleRoundBoundary",
        "tickStatusEffects",
        "shouldConsumeRoundEndState",
        "consumeRoundEndDurations"
    ].map(sourceFunction).join("\n"),context,{filename:"burn-round-end-sources.js"});
    return {context,monster,character,dotCalls,visualCalls};
}

test("Burn ticks exactly twice on real round_end for player and monster, then expires",()=>{
    const f=burnRoundFixture();
    const endRound=round=>{
        f.context.turn=round;
        assert.equal(f.context.notifyBattleRoundBoundary("round_end",42),true);
    };

    endRound(1);
    assert.equal(f.monster.hp,400);
    assert.equal(f.character.hp,400);
    assert.equal(f.monster.statusEffects[0].turnsLeft,1);
    assert.equal(f.character.statusEffects[0].turnsLeft,1);

    assert.equal(f.context.notifyBattleRoundBoundary("round_end",42),false,
        "same battle/round end must not tick Burn again");
    assert.equal(f.dotCalls.length,2);
    assert.equal(f.context.notifyBattleRoundBoundary("round_start",42),true);
    assert.equal(f.dotCalls.length,2,"round_start does not apply Burn DoT");

    endRound(2);
    assert.equal(f.monster.hp,300);
    assert.equal(f.character.hp,300);
    assert.equal(f.monster.statusEffects.length,0);
    assert.equal(f.character.statusEffects.length,0);

    endRound(3);
    assert.equal(f.dotCalls.length,4,"expired Burn must not tick a third time");
    assert.deepEqual(f.dotCalls.map(call=>call.amount),[100,100,100,100]);
    assert.equal(f.visualCalls.length,4);

    const inactive=burnRoundFixture();
    inactive.context.battleActive=false;
    inactive.context.consumeRoundEndDurations();
    assert.equal(inactive.dotCalls.length,0,"battle teardown must not tick an unexpired Burn");
    assert.equal(inactive.monster.hp,500);
    assert.equal(inactive.character.hp,500);
    assert.equal(inactive.monster.statusEffects[0].turnsLeft,2);
    assert.equal(inactive.character.statusEffects[0].turnsLeft,2);
});
