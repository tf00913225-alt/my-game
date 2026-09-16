"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const ownerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const animationSource=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

function rect(left,top,width,height){
    return {left,top,width,height,right:left+width,bottom:top+height};
}

function center(value){
    return {x:value.left+value.width/2,y:value.top+value.height/2};
}

function makeNode(box=null){
    const classes=new Set();
    const node={
        id:"",className:"",dataset:{},children:[],parentNode:null,parentElement:null,offsetParent:{},
        style:{
            setProperty(name,value){ this[name]=String(value); },
            getPropertyValue(name){ return this[name]||""; }
        },
        classList:{
            add(...names){ names.forEach(name=>classes.add(name)); },
            remove(...names){ names.forEach(name=>classes.delete(name)); },
            contains(name){ return classes.has(name)||String(node.className||"").split(/\s+/).includes(name); }
        },
        appendChild(child){ child.parentNode=this; child.parentElement=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(item=>item!==child); child.parentNode=null; child.parentElement=null; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){ return box||rect(0,0,0,0); },
        querySelector(selector){ return queryAll(this,selector)[0]||null; },
        querySelectorAll(selector){ return queryAll(this,selector); }
    };
    return node;
}

function matches(node,selector){
    const slotMatch=selector.match(/^\.([\w-]+)\[data-slot="([^"]+)"\]$/);
    if(slotMatch){
        return String(node.className||"").split(/\s+/).includes(slotMatch[1])&&node.dataset.slot===slotMatch[2];
    }
    if(selector.startsWith("#")){ return node.id===selector.slice(1); }
    if(selector.startsWith(".")){
        const classNames=selector.slice(1).split(".");
        const nodeClasses=String(node.className||"").split(/\s+/);
        return classNames.every(name=>nodeClasses.includes(name));
    }
    return false;
}

function queryAll(root,selector){
    const simple=String(selector||"").split(",").map(value=>value.trim()).filter(Boolean);
    const results=[];
    const visit=current=>{
        (current.children||[]).forEach(child=>{
            if(simple.some(part=>matches(child,part))){ results.push(child); }
            visit(child);
        });
    };
    visit(root);
    return results;
}

function castConfig(id,duration,targetType,category="physical"){
    return {id,name:id,element:"fire",category,targetType,duration,resolveDuration:duration};
}

function makeHarness(options={}){
    const body=makeNode();
    const battlePage=makeNode(rect(0,0,900,700));
    battlePage.id="battlePage";
    body.appendChild(battlePage);

    const slotNodes={};
    const enemyXs=[100,220,340,460,580];
    const allyXs=[180,340,500];
    ["B","F"].forEach((row,rowIndex)=>{
        enemyXs.forEach((left,index)=>{
            const id=`ENEMY_${row}${index+1}`;
            const node=makeNode(rect(left,rowIndex===0?60:180,80,100));
            node.className="v-fixed-enemy-slot";
            node.dataset.slot=id;
            slotNodes[id]=node;
            battlePage.appendChild(node);
        });
    });
    ["F","B"].forEach((row,rowIndex)=>{
        allyXs.forEach((left,index)=>{
            const id=`ALLY_${row}${index+1}`;
            const node=makeNode(rect(left,rowIndex===0?420:540,100,100));
            node.className="v-fixed-ally-slot";
            node.dataset.slot=id;
            slotNodes[id]=node;
            battlePage.appendChild(node);
        });
    });

    const cards={
        battleMonsterArea:makeNode(rect(250,40,600,270)),
        battlePlayerRow:makeNode(rect(20,330,600,140)),
        battlePlayerCard0:makeNode(rect(20,340,118,116)),
        battlePlayerCard1:makeNode(rect(160,340,118,116)),
        battlePlayerCard2:makeNode(rect(300,340,118,116)),
        battleMonster0:makeNode(rect(300,90,76,100)),
        battleMonster1:makeNode(rect(400,90,76,100)),
        battleMonster2:makeNode(rect(500,90,76,100))
    };
    for(let index=3;index<10;index++){
        const left=300+(index%5)*100;
        const top=index<5?90:205;
        cards["battleMonster"+index]=makeNode(rect(left,top,76,100));
    }

    const monsters=options.monsters||[
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
    ];
    const party=options.party||[
        {hp:100,statusEffects:[],activeBuffs:[]},
        {hp:100,statusEffects:[],activeBuffs:[]},
        {hp:100,statusEffects:[],activeBuffs:[]}
    ];
    const currentBattleMonsters=options.currentBattleMonsters||monsters.map((_,index)=>index);
    let timerId=0;
    const scheduled=[];
    let legacyRocketCalls=0;
    const allById={battlePage,...cards};
    const document={
        body,
        createElement(){ return makeNode(); },
        getElementById(id){ return allById[id]||null; },
        querySelector(selector){ return battlePage.querySelector(selector)||body.querySelector(selector); },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    const context={
        window:null,document,console,Promise,Date,Math,Number,Object,Array,Set,Map,
        innerWidth:900,innerHeight:700,navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout(callback,delay){ const id=++timerId; scheduled.push({id,callback,delay}); return id; },
        clearTimeout(){},
        showMonsterHit(){},showMissEffect(){},v141PlayCardEffect(){},
        playFireRocketAnimation(){ legacyRocketCalls++; },
        monsters,currentBattleMonsters,queuedPlayerActions:{0:{target:1,targetAlly:1}},
        getSkillTargets(){ return [0,1,2].filter(index=>currentBattleMonsters.includes(index)); },
        getPartyCharacterByIndex(index){ return party[index]||null; }
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(config){
            let resolve;
            const gate={done:false,reason:null,config,promise:new Promise(done=>{ resolve=done; })};
            gate.complete=function(reason){ if(gate.done){ return false; } gate.done=true; gate.reason=reason; resolve(gate); return true; };
            return gate;
        },
        dispose(){}
    };
    vm.createContext(context);
    vm.runInContext(ownerSource,context);
    const owner=context.FourSymbolsBattlefieldSlots;
    assert.ok(owner,"formal Fixed Slot owner must install");
    const snapshot=owner.createEnemyFormationSnapshot(currentBattleMonsters,{originalFormationType:Math.max(1,currentBattleMonsters.length)});
    owner.setActiveEnemySnapshot(snapshot);
    owner.ensureAllyFormation([0,1,2]);
    vm.runInContext(animationSource,context);
    return {context,owner,snapshot,slotNodes,cards,body,monsters,party,scheduled,legacyRocketCalls:()=>legacyRocketCalls};
}

function spriteNodes(runtime){
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.ok(stage,"V143 stage must exist");
    return {stage,sprites:stage.children.filter(node=>String(node.className||"").includes("v143-vfx-sprite"))};
}

{
    const runtime=makeHarness();
    const owner=runtime.owner;
    assert.equal(owner.getEnemySlotForMonster(runtime.snapshot,0),"ENEMY_F2");
    assert.equal(owner.getEnemySlotForMonster(runtime.snapshot,1),"ENEMY_F3");
    assert.equal(owner.getEnemySlotForMonster(runtime.snapshot,2),"ENEMY_F4");
    assert.ok(owner.getAllySlotForCharacter(0));
    assert.ok(owner.getAllySlotForCharacter(1));
    assert.ok(owner.getAllySlotForCharacter(2));

    const primarySlot=owner.getEnemySlotForMonster(runtime.snapshot,1);
    const formalSlots=owner.getGeometrySlotsFromShape("enemy",primarySlot,"tri");
    const formalRect=owner.getGeometryRectFromShape("enemy",primarySlot,"tri");
    assert.deepEqual(Array.from(formalSlots),["ENEMY_F2","ENEMY_F3","ENEMY_F4"]);

    runtime.context.v142SkillAnimationDirector.play(castConfig("explosiveFlurry",1450,"tri"),{side:"player",actorIndex:0});
    const {sprites}=spriteNodes(runtime);
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(Number.parseFloat(sprites[0].style.left),formalRect.centerX);
    assert.equal(Number.parseFloat(sprites[0].style.top),formalRect.centerY);
    const oldCards=[0,1,2].map(index=>runtime.cards["battleMonster"+index].getBoundingClientRect());
    const oldRect={
        left:Math.min(...oldCards.map(value=>value.left)),top:Math.min(...oldCards.map(value=>value.top)),
        right:Math.max(...oldCards.map(value=>value.right)),bottom:Math.max(...oldCards.map(value=>value.bottom))
    };
    oldRect.width=oldRect.right-oldRect.left; oldRect.height=oldRect.bottom-oldRect.top;
    const oldCenter=center(oldRect);
    console.log("OLD CARD GROUP CENTER =",oldCenter.x,oldCenter.y);
    console.log("FIXED SLOT TRI CENTER =",formalRect.centerX,formalRect.centerY);
    console.log("SPRITE CENTER =",Number.parseFloat(sprites[0].style.left),Number.parseFloat(sprites[0].style.top));
    assert.notDeepEqual(oldCenter,{x:formalRect.centerX,y:formalRect.centerY});
}

{
    const many=makeHarness({monsters:[
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
    ]});
    const sideRect=many.owner.getSideRect("monster");
    many.context.v142SkillAnimationDirector.play(castConfig("phoenixCry",3200,"all","magic"),{side:"player",actorIndex:0});
    const manyResult=spriteNodes(many).sprites;
    assert.equal(manyResult.length,1);
    assert.equal(manyResult[0].dataset.targetIndexes,"0,2");
    assert.equal(Number.parseFloat(manyResult[0].style.left),sideRect.centerX);
    assert.equal(Number.parseFloat(manyResult[0].style.top),sideRect.centerY);

    const one=makeHarness({monsters:[
        {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
    ]});
    one.context.v142SkillAnimationDirector.play(castConfig("phoenixCry",3200,"all","magic"),{side:"player",actorIndex:0});
    const oneResult=spriteNodes(one).sprites;
    assert.equal(oneResult.length,1);
    assert.equal(oneResult[0].dataset.targetIndexes,"1");
    ["width","height","left","top"].forEach(property=>assert.equal(oneResult[0].style[property],manyResult[0].style[property]));
    assert.notEqual(sideRect.centerX,center(many.cards.battleMonsterArea.getBoundingClientRect()).x);
}

{
    const runtime=makeHarness();
    const owner=runtime.owner;
    const actorSlot=owner.getAllySlotForCharacter(0);
    const actorCenter=owner.getSlotCenter(actorSlot);
    const primarySlot=owner.getEnemySlotForMonster(runtime.snapshot,1);
    const targetRect=owner.getGeometryRectFromShape("enemy",primarySlot,"tri");
    runtime.context.v142SkillAnimationDirector.play(castConfig("fireRocket",900,"tri","magic"),{side:"player",actorIndex:0});
    runtime.context.playFireRocketAnimation("battlePlayerCard0",["battleMonster0","battleMonster1","battleMonster2"]);
    const {sprites}=spriteNodes(runtime);
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.placement,"trajectory");
    assert.equal(sprite.dataset.travelToTargets,"true");
    assert.equal(sprite.dataset.targetIndexes,"0,1,2");
    assert.equal(Number.parseFloat(sprite.style.left),actorCenter.x);
    assert.equal(Number.parseFloat(sprite.style.top),actorCenter.y);
    assert.equal(Number.parseFloat(sprite.style["--v143-sprite-dx"]),targetRect.centerX-actorCenter.x);
    assert.equal(Number.parseFloat(sprite.style["--v143-sprite-dy"]),targetRect.centerY-actorCenter.y);
    const oldActor=center(runtime.cards.battlePlayerCard0.getBoundingClientRect());
    assert.notDeepEqual(oldActor,{x:actorCenter.x,y:actorCenter.y});
    assert.equal(runtime.legacyRocketCalls(),0);
}

console.log("V153 Fixed Slot formal harness validation passed.");
