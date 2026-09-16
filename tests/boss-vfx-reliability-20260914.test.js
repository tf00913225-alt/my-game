"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ownerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const source=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

function classList(){
    const values=new Set();
    return {
        add(...names){ names.forEach(name=>values.add(name)); },
        remove(...names){ names.forEach(name=>values.delete(name)); },
        contains(name){ return values.has(name); }
    };
}
function style(){
    return {
        setProperty(name,value){ this[name]=String(value); },
        removeProperty(name){ delete this[name]; }
    };
}
function makeNode(id,rect){
    return {
        id:id||"",dataset:{},children:[],style:style(),classList:classList(),offsetParent:{},removed:false,
        appendChild(child){ child.parentNode=this; child.parentElement=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(x=>x!==child); child.parentNode=null; child.parentElement=null; return child; },
        remove(){ this.removed=true; if(this.parentNode&&Array.isArray(this.parentNode.children)){ this.parentNode.children=this.parentNode.children.filter(x=>x!==this); } },
        setAttribute(){},
        querySelector(){ return null; },
        querySelectorAll(){ return []; },
        closest(){ return null; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:80,bottom:100,width:80,height:100}; }
    };
}
function rect(left,top,width,height){
    return {left,top,width,height,right:left+width,bottom:top+height};
}
function centerOf(rectangle){
    return {x:rectangle.left+rectangle.width/2,y:rectangle.top+rectangle.height/2};
}
function pointFromSprite(sprite){
    return {x:Number.parseFloat(sprite.style.left),y:Number.parseFloat(sprite.style.top)};
}
function assertPoint(actual,expected,message){
    assert.equal(actual.x,expected.x,message+" X");
    assert.equal(actual.y,expected.y,message+" Y");
}
function buildSlotDom(){
    const slotNodes={};
    const enemyBack=["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5"];
    const enemyFront=["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"];
    const allyFront=["ALLY_F1","ALLY_F2","ALLY_F3"];
    const allyBack=["ALLY_B1","ALLY_B2","ALLY_B3"];
    enemyBack.forEach((slot,index)=>{
        const node=makeNode(slot,rect(40+index*70,60,60,80));
        node.dataset.slot=slot;
        node.classList.add("v-fixed-enemy-slot");
        slotNodes[slot]=node;
    });
    enemyFront.forEach((slot,index)=>{
        const node=makeNode(slot,rect(40+index*70,180,60,80));
        node.dataset.slot=slot;
        node.classList.add("v-fixed-enemy-slot");
        slotNodes[slot]=node;
    });
    allyFront.forEach((slot,index)=>{
        const node=makeNode(slot,rect(95+index*95,500,70,90));
        node.dataset.slot=slot;
        node.classList.add("v-fixed-ally-slot");
        slotNodes[slot]=node;
    });
    allyBack.forEach((slot,index)=>{
        const node=makeNode(slot,rect(95+index*95,610,70,90));
        node.dataset.slot=slot;
        node.classList.add("v-fixed-ally-slot");
        slotNodes[slot]=node;
    });
    return slotNodes;
}
function createRuntime(){
    const body=makeNode("body",rect(0,0,420,720));
    const battlePage=makeNode("battlePage",rect(0,0,420,720));
    const slotNodes=buildSlotDom();
    battlePage.querySelector=selector=>{
        const match=String(selector||"").match(/\[data-slot="([A-Z0-9_]+)"\]/);
        return match?slotNodes[match[1]]||null:null;
    };

    const boss=makeNode("battleMonster0",rect(250,100,80,110));
    boss.dataset.rank="boss";
    const bossArt=makeNode("bossArt",rect(225,72,130,160));
    bossArt.classList.add("v174-battle-art");
    boss.querySelector=selector=>selector===":scope > .v174-battle-art"?bossArt:null;
    const monster1=makeNode("battleMonster1",rect(150,120,75,95));
    const player0=makeNode("battlePlayerCard0",rect(300,500,80,100));
    const player1=makeNode("battlePlayerCard1",rect(10,500,80,100));
    const monsterArea=makeNode("battleMonsterArea",rect(120,60,265,195));
    const playerArea=makeNode("battlePlayerRow",rect(35,455,350,180));
    const byId={
        battlePage,
        battleMonster0:boss,battleMonster1:monster1,
        battlePlayerCard0:player0,battlePlayerCard1:player1,
        battleMonsterArea:monsterArea,battlePlayerRow:playerArea
    };
    let gateId=0;
    const director={
        play(config){
            let resolve;
            const gate={id:++gateId,config,done:false,reason:null,promise:new Promise(r=>{resolve=r;})};
            gate.complete=reason=>{ if(gate.done)return false; gate.done=true; gate.reason=reason; resolve(gate); return true; };
            return gate;
        },
        dispose(){},getActive(){ return null; }
    };
    const context={
        console,Promise,Set,Map,Array,Object,Number,String,Boolean,RegExp,Date,Math,Proxy,
        setTimeout,clearTimeout,innerWidth:420,innerHeight:720,
        localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
        v142SkillAnimationDirector:director,
        monsters:[
            {name:"Boss",rank:"boss",hp:5000,alive:true,statusEffects:[],activeBuffs:[]},
            {name:"Support",hp:500,alive:true,statusEffects:[],activeBuffs:[]}
        ],
        currentBattleMonsters:[0,1],
        queuedPlayerActions:[{action:"flameSlash",target:0,targetAlly:0}],
        getPartyCharacterByIndex(index){
            if(index===0)return {id:"P0",hp:100,alive:true,statusEffects:[],activeBuffs:[]};
            if(index===1)return {id:"P1",hp:100,alive:true,statusEffects:[],activeBuffs:[]};
            return null;
        },
        showMissEffect(){ return "base-miss"; },
        showMonsterHit(){ return "base-monster-hit"; },
        showPlayerHit(){ return "base-player-hit"; },
        v141PlayCardEffect(){},
        document:{
            body,readyState:"complete",
            createElement(tag){ return makeNode(tag); },
            getElementById(id){ return byId[id]||null; },
            querySelector(selector){ return battlePage.querySelector(selector); },
            querySelectorAll(){ return []; },
            addEventListener(){}
        },
        addEventListener(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(ownerSource,context,{filename:"js/battlefield-slot-owner.js"});
    const owner=context.FourSymbolsBattlefieldSlots;
    assert.ok(owner,"formal Fixed Slot owner must install");
    const snapshot=owner.createEnemyFormationSnapshot([0,1],{originalFormationType:2});
    owner.setActiveEnemySnapshot(snapshot);
    const allyFormation=owner.ensureAllyFormation([0,1]);
    assert.ok(owner.getAllySlotForCharacter(0),"player 0 must have a formal Ally Slot");
    assert.ok(owner.getAllySlotForCharacter(1),"player 1 must have a formal Ally Slot");
    vm.runInContext(source,context,{filename:"js/39-v143-skill-animation.js"});
    return {context,owner,snapshot,allyFormation,bossArt,player0,monsterArea,slotNodes};
}
function spriteNodes(current){ return Array.from(current.spriteNodes.values()); }
function config(id,targetType="single",duration=760){
    return {id,name:id,element:id.startsWith("fire")||id==="flameSlash"?"fire":"wind",category:"physical",targetType,duration,resolveDuration:duration};
}

{
    const {context,owner,snapshot,bossArt}=createRuntime();
    const monster0Slot=owner.getEnemySlotForMonster(snapshot,0);
    const monster1Slot=owner.getEnemySlotForMonster(snapshot,1);
    assert.ok(monster0Slot,"monster 0 must have a formal Enemy Slot");
    assert.ok(monster1Slot,"monster 1 must have a formal Enemy Slot");
    const slotCenter=owner.getSlotCenter(monster0Slot);
    assert.ok(slotCenter,"monster 0 formal Slot must expose geometry");
    const artCenter=centerOf(bossArt.getBoundingClientRect());
    assert.notDeepEqual(slotCenter&&{x:slotCenter.x,y:slotCenter.y},artCenter,"diagnosis requires Boss artwork center to differ from Fixed Slot center");

    const gate=context.v142SkillAnimationDirector.play(config("flameSlash"),{side:"player",actorIndex:0});
    const current=context.v143SkillAnimationState.current;
    const [sprite]=spriteNodes(current);
    assert.ok(sprite,"Boss single-target cast must create a Sprite");
    assert.equal(sprite.style.visibility,"visible","positioned Boss Sprite must not wait for damage confirmation");
    const spriteCenter=pointFromSprite(sprite);
    assertPoint(spriteCenter,{x:slotCenter.x,y:slotCenter.y},"Boss VFX must use formal Fixed Slot center");
    assert.notDeepEqual(spriteCenter,artCenter,"Boss artwork bounds must not own VFX position");
    console.log("BOSS_VFX_FIXED_SLOT_DIAG="+JSON.stringify({monster0Slot,monster1Slot,bossArtCenter:artCenter,fixedSlotCenter:{x:slotCenter.x,y:slotCenter.y},spriteCenter}));
    gate.complete("test-end");
}

{
    const {context,owner}=createRuntime();
    context.v142SkillAnimationDirector.play(config("flameSlash"),{side:"monster",actorIndex:0});
    let current=context.v143SkillAnimationState.current;
    assert.equal(spriteNodes(current).length,0,"monster single target waits until the actual target is known");
    context.showMissEffect(true,0,"MISS");
    current=context.v143SkillAnimationState.current;
    const [sprite]=spriteNodes(current);
    assert.ok(sprite,"MISS must still register the attempted target and emit the formal Sprite");
    assert.equal(sprite.style.visibility,"visible","MISS Sprite must be visible");
    assert.equal(sprite.dataset.confirmedHit,"true","MISS target registration uses the same authoritative endpoint");
    const allySlot=owner.getAllySlotForCharacter(0);
    const allyCenter=owner.getSlotCenter(allySlot);
    assert.ok(allyCenter,"MISS player target must have formal Ally Slot geometry");
    assertPoint(pointFromSprite(sprite),{x:allyCenter.x,y:allyCenter.y},"MISS VFX must use formal Ally Slot center");
}

{
    const {context,owner,snapshot}=createRuntime();
    context.queuedPlayerActions[0]={action:"fireRocket",target:0,targetAlly:0};
    context.v142SkillAnimationDirector.play(config("fireRocket"),{side:"player",actorIndex:0});
    const [sprite]=spriteNodes(context.v143SkillAnimationState.current);
    assert.ok(sprite,"travel skill must create a Sprite against Boss");
    assert.equal(sprite.dataset.travel,"true");
    assert.equal(sprite.style.visibility,"visible");
    const allySlot=owner.getAllySlotForCharacter(0);
    const actorCenter=owner.getSlotCenter(allySlot);
    const enemySlot=owner.getEnemySlotForMonster(snapshot,0);
    const endpoint=owner.getSlotCenter(enemySlot);
    assert.ok(actorCenter&&endpoint,"trajectory endpoints require formal Ally and Enemy Slot centers");
    assertPoint(pointFromSprite(sprite),{x:actorCenter.x,y:actorCenter.y},"travel Sprite must start from formal Ally Slot center");
    const dx=Number.parseFloat(sprite.style["--v143-sprite-dx"]);
    const dy=Number.parseFloat(sprite.style["--v143-sprite-dy"]);
    assertPoint({x:actorCenter.x+dx,y:actorCenter.y+dy},{x:endpoint.x,y:endpoint.y},"travel endpoint must use formal Enemy Slot center");
}

{
    const {context,owner,monsterArea}=createRuntime();
    context.v142SkillAnimationDirector.play(config("explosiveFlurry","all",1450),{side:"player",actorIndex:0});
    const current=context.v143SkillAnimationState.current;
    const [sprite]=spriteNodes(current);
    assert.ok(sprite,"multi-target group skill must create its shared Sprite");
    assert.equal(sprite.style.visibility,"visible");
    assert.deepEqual(Array.from(current.targetIndexes),[0,1]);
    const enemySideRect=owner.getSideRect("monster");
    assert.ok(enemySideRect,"group VFX requires complete formal Enemy Slot geometry");
    assertPoint(pointFromSprite(sprite),{x:enemySideRect.centerX,y:enemySideRect.centerY},"group VFX must use formal Enemy side geometry");
    assert.notDeepEqual(pointFromSprite(sprite),centerOf(monsterArea.getBoundingClientRect()),"legacy monster area rect must not own group VFX position");
}

{
    const {context}=createRuntime();
    const first=context.v142SkillAnimationDirector.play(config("flameSlash"),{side:"player",actorIndex:0});
    const firstStage=context.v143SkillAnimationState.stage;
    context.queuedPlayerActions[0]={action:"fireRocket",target:0,targetAlly:0};
    context.v142SkillAnimationDirector.play(config("fireRocket"),{side:"player",actorIndex:0});
    const secondStage=context.v143SkillAnimationState.stage;
    assert.notEqual(firstStage,secondStage);
    assert.equal(firstStage.removed,true,"superseded stage is cleaned");
    assert.equal(secondStage.removed,false,"new stage survives previous cleanup");
    first.complete("late-old-gate");
    assert.equal(secondStage.removed,false,"an older gate cannot remove the next cast");
}

{
    const {context}=createRuntime();
    const manifest=context.v143SkillAnimationManifest;
    const formalActive=Object.entries(manifest).filter(([,entry])=>entry&&entry.sprite);
    for(const [id,entry] of formalActive){
        const asset=String(entry.sprite.src||"").split("?")[0];
        assert.ok(asset,id+" must expose an asset path");
        assert.ok(fs.existsSync(asset),id+" asset missing: "+asset);
        assert.equal(entry.sprite.renderer,"dom-sprite",id+" must remain on formal DOM Sprite renderer");
    }
    assert.equal(manifest.yuanXiangGuangMing.missingDedicatedAsset,true);
    assert.equal(manifest.yuanGuangShield.missingDedicatedAsset,true);
    assert.equal(manifest.yuanXiangGuangMing.noVisual,true);
    assert.equal(manifest.yuanGuangShield.noVisual,true);
}

assert.doesNotMatch(source,/function missDelayFor\(/,"MISS must not bypass target registration");
assert.doesNotMatch(source,/v174FireRocketTravel/,"single-skill Fire Rocket override must stay retired");
console.log("✓ Boss VFX reliability regression suite passed");
