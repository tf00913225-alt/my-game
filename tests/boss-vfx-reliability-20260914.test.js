"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
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
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        remove(){ this.removed=true; if(this.parentNode&&Array.isArray(this.parentNode.children)){ this.parentNode.children=this.parentNode.children.filter(x=>x!==this); } },
        setAttribute(){},
        querySelector(){ return null; },
        querySelectorAll(){ return []; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:80,bottom:100,width:80,height:100}; }
    };
}
function createRuntime(){
    const body=makeNode("body",{left:0,top:0,right:420,bottom:720,width:420,height:720});
    const boss=makeNode("battleMonster0",{left:250,top:100,right:330,bottom:210,width:80,height:110});
    boss.dataset.rank="boss";
    const bossArt=makeNode("bossArt",{left:225,top:72,right:355,bottom:232,width:130,height:160});
    bossArt.classList.add("v174-battle-art");
    boss.querySelector=selector=>selector===":scope > .v174-battle-art"?bossArt:null;
    const monster1=makeNode("battleMonster1",{left:150,top:120,right:225,bottom:215,width:75,height:95});
    const player0=makeNode("battlePlayerCard0",{left:92,top:500,right:172,bottom:600,width:80,height:100});
    const player1=makeNode("battlePlayerCard1",{left:180,top:500,right:260,bottom:600,width:80,height:100});
    const monsterArea=makeNode("battleMonsterArea",{left:120,top:60,right:385,bottom:255,width:265,height:195});
    const playerArea=makeNode("battlePlayerRow",{left:35,top:455,right:385,bottom:635,width:350,height:180});
    const byId={battleMonster0:boss,battleMonster1:monster1,battlePlayerCard0:player0,battlePlayerCard1:player1,battleMonsterArea:monsterArea,battlePlayerRow:playerArea};
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
            querySelectorAll(){ return []; },
            addEventListener(){}
        },
        addEventListener(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context,{filename:"js/39-v143-skill-animation.js"});
    return {context,bossArt};
}
function spriteNodes(current){ return Array.from(current.spriteNodes.values()); }
function config(id,targetType="single",duration=760){
    return {id,name:id,element:id.startsWith("fire")||id==="flameSlash"?"fire":"wind",category:"physical",targetType,duration,resolveDuration:duration};
}

{
    const {context,bossArt}=createRuntime();
    const gate=context.v142SkillAnimationDirector.play(config("flameSlash"),{side:"player",actorIndex:0});
    const current=context.v143SkillAnimationState.current;
    const [sprite]=spriteNodes(current);
    assert.ok(sprite,"Boss single-target cast must create a Sprite");
    assert.equal(sprite.style.visibility,"visible","positioned Boss Sprite must not wait for damage confirmation");
    const rect=bossArt.getBoundingClientRect();
    assert.equal(sprite.style.left,(rect.left+rect.width/2)+"px","Boss artwork bounds own VFX X position");
    assert.equal(sprite.style.top,(rect.top+rect.height/2)+"px","Boss artwork bounds own VFX Y position");
    gate.complete("test-end");
}

{
    const {context}=createRuntime();
    context.v142SkillAnimationDirector.play(config("flameSlash"),{side:"monster",actorIndex:0});
    let current=context.v143SkillAnimationState.current;
    assert.equal(spriteNodes(current).length,0,"monster single target waits until the actual target is known");
    context.showMissEffect(true,0,"MISS");
    current=context.v143SkillAnimationState.current;
    const [sprite]=spriteNodes(current);
    assert.ok(sprite,"MISS must still register the attempted target and emit the formal Sprite");
    assert.equal(sprite.style.visibility,"visible","MISS Sprite must be visible");
    assert.equal(sprite.dataset.confirmedHit,"true","MISS target registration uses the same authoritative endpoint");
}

{
    const {context}=createRuntime();
    context.queuedPlayerActions[0]={action:"fireRocket",target:0,targetAlly:0};
    context.v142SkillAnimationDirector.play(config("fireRocket"),{side:"player",actorIndex:0});
    const [sprite]=spriteNodes(context.v143SkillAnimationState.current);
    assert.ok(sprite,"travel skill must create a Sprite against Boss");
    assert.equal(sprite.dataset.travel,"true");
    assert.equal(sprite.style.visibility,"visible");
}

{
    const {context}=createRuntime();
    context.v142SkillAnimationDirector.play(config("explosiveFlurry","all",1450),{side:"player",actorIndex:0});
    const current=context.v143SkillAnimationState.current;
    const [sprite]=spriteNodes(current);
    assert.ok(sprite,"multi-target group skill must create its shared Sprite");
    assert.equal(sprite.style.visibility,"visible");
    assert.deepEqual(current.targetIndexes,[0,1]);
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
