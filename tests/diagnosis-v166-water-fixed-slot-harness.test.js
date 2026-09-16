"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const slotOwnerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const animationSource=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

function rect(left,top,width,height){
    return {left,top,width,height,right:left+width,bottom:top+height};
}
function center(box){ return {x:box.left+box.width/2,y:box.top+box.height/2}; }

function matches(node,selector){
    const slotMatch=String(selector||"").match(/^\.([\w-]+)\[data-slot="([^"]+)"\]$/);
    if(slotMatch){
        return String(node.className||"").split(/\s+/).includes(slotMatch[1])&&node.dataset.slot===slotMatch[2];
    }
    if(String(selector||"").startsWith("#")){ return node.id===selector.slice(1); }
    if(String(selector||"").startsWith(".")){
        const names=selector.slice(1).split(".");
        const classes=String(node.className||"").split(/\s+/);
        return names.every(name=>classes.includes(name));
    }
    return false;
}
function queryAll(root,selector){
    const selectors=String(selector||"").split(",").map(value=>value.trim()).filter(Boolean);
    const results=[];
    const visit=current=>(current.children||[]).forEach(child=>{
        if(selectors.some(part=>matches(child,part))){ results.push(child); }
        visit(child);
    });
    visit(root);
    return results;
}
function makeNode(box=null){
    const classTokens=new Set();
    const node={
        id:"",className:"",dataset:{},children:[],parentNode:null,parentElement:null,offsetParent:{},
        style:{
            setProperty(name,value){ this[name]=String(value); },
            getPropertyValue(name){ return this[name]||""; }
        },
        classList:{
            add(...names){ names.forEach(name=>classTokens.add(name)); },
            remove(...names){ names.forEach(name=>classTokens.delete(name)); },
            contains(name){ return classTokens.has(name)||String(node.className||"").split(/\s+/).includes(name); }
        },
        appendChild(child){ child.parentNode=this; child.parentElement=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(item=>item!==child); child.parentNode=null; child.parentElement=null; return child; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){ return box||rect(0,0,0,0); },
        querySelector(selector){ return queryAll(this,selector)[0]||null; },
        querySelectorAll(selector){ return queryAll(this,selector); }
    };
    return node;
}

function loadRuntime(options={}){
    const body=makeNode();
    const battlePage=makeNode(rect(0,0,960,720));
    battlePage.id="battlePage";
    body.appendChild(battlePage);

    const enemyXs=[100,220,340,460,580];
    const allyXs=[180,340,500];
    const slotNodes={};
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

    // Deliberately keep legacy cards/areas away from formal Fixed Slot geometry.
    const cards={
        battleMonsterArea:makeNode(rect(260,40,440,260)),
        battlePlayerRow:makeNode(rect(20,340,440,160)),
        battleMonster0:makeNode(rect(300,90,76,100)),
        battleMonster1:makeNode(rect(420,90,76,100)),
        battleMonster2:makeNode(rect(540,90,76,100)),
        battlePlayerCard0:makeNode(rect(40,360,118,116)),
        battlePlayerCard1:makeNode(rect(180,360,118,116)),
        battlePlayerCard2:makeNode(rect(320,360,118,116))
    };
    Object.entries(cards).forEach(([id,node])=>{ node.id=id; battlePage.appendChild(node); });

    const monsters=options.monsters||[0,1,2].map(()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const party=options.party||[0,1,2].map(()=>({hp:100,statusEffects:[],activeBuffs:[]}));
    const targetIndexes=options.targetIndexes||[0,1,2];
    const currentBattleMonsters=[0,1,2];
    const scheduled=[];
    let timerId=0;
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
        innerWidth:960,innerHeight:720,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout(callback,delay){ const id=++timerId; scheduled.push({id,callback,delay}); return id; },
        clearTimeout(){},
        showMonsterHit(){},showPlayerHit(){},v141PlayCardEffect(){},playIceSpinProjectile(){},
        applyFreezeEffect(entity,duration){
            entity.statusEffects=Array.isArray(entity.statusEffects)?entity.statusEffects:[];
            entity.statusEffects.push({type:"freeze",turnsLeft:duration});
        },
        applySkillDebuffEffectsToPlayer(){},
        monsters,currentBattleMonsters,
        queuedPlayerActions:{0:{target:targetIndexes[0]??0,targetAlly:1}},
        getSkillTargets(){ return targetIndexes.slice(); },
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
    vm.runInContext(slotOwnerSource,context);
    const owner=context.FourSymbolsBattlefieldSlots;
    assert.ok(owner,"formal Fixed Slot owner installs");
    const snapshot=owner.createEnemyFormationSnapshot(currentBattleMonsters,{originalFormationType:3});
    owner.setActiveEnemySnapshot(snapshot);
    owner.ensureAllyFormation([0,1,2]);
    vm.runInContext(animationSource,context);
    return {context,owner,snapshot,body,cards,monsters,party,scheduled,slotNodes};
}

function cast(id,targetType,category="magic",duration=1000){
    return {id,name:id,element:"water",category,targetType,duration,resolveDuration:duration};
}
function sprites(runtime){
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.ok(stage,"formal V143 stage exists");
    return {stage,nodes:stage.children.filter(node=>String(node.className||"").includes("v143-vfx-sprite"))};
}
function enemySlot(runtime,index){ return runtime.owner.getEnemySlotForMonster(runtime.snapshot,index); }
function allySlot(runtime,index){ return runtime.owner.getAllySlotForCharacter(index); }

// Single target: formal target slot, not legacy card center.
{
    const runtime=loadRuntime({targetIndexes:[2]});
    runtime.context.v142SkillAnimationDirector.play(cast("waterKnife","single", "magic",800),{side:"player",actorIndex:0,targetId:2});
    const node=sprites(runtime).nodes[0];
    assert.ok(node,"waterKnife emits under formal owner");
    const formal=runtime.owner.getSlotCenter(enemySlot(runtime,2));
    const legacy=center(runtime.cards.battleMonster2.getBoundingClientRect());
    assert.deepEqual({x:Number(node.style.left.replace("px","")),y:Number(node.style.top.replace("px",""))},{x:formal.x,y:formal.y});
    assert.notDeepEqual(legacy,{x:formal.x,y:formal.y});
}

// Per-target single Sprite sheets remain bound to each real formal slot.
{
    const runtime=loadRuntime({targetIndexes:[0,2]});
    runtime.context.v142SkillAnimationDirector.play(cast("iceSpin","tri","magic",1000),{side:"player",actorIndex:0,targetIds:[0,2]});
    const nodes=sprites(runtime).nodes;
    assert.equal(nodes.length,2);
    nodes.forEach((node,arrayIndex)=>{
        const index=[0,2][arrayIndex];
        const formal=runtime.owner.getSlotCenter(enemySlot(runtime,index));
        assert.equal(Number(node.style.left.replace("px","")),formal.x);
        assert.equal(Number(node.style.top.replace("px","")),formal.y);
    });
}

// Group/tri geometry remains one sheet centered on the formal three-slot shape.
{
    const runtime=loadRuntime({targetIndexes:[0,2]});
    const primary=enemySlot(runtime,1);
    const shape=runtime.owner.getGeometryRectFromShape("enemy",primary,"tri");
    runtime.context.v142SkillAnimationDirector.play(cast("waterBall","tri","magic",1400),{side:"player",actorIndex:0,targetIds:[0,2]});
    const nodes=sprites(runtime).nodes;
    assert.equal(nodes.length,1);
    assert.equal(nodes[0].dataset.targetIndexes,"0,2");
    assert.equal(Number(nodes[0].style.left.replace("px","")),shape.centerX);
    assert.equal(Number(nodes[0].style.top.replace("px","")),shape.centerY);
}

// Battlefield placement uses full formal side geometry and is stable with fewer living targets.
{
    const many=loadRuntime({targetIndexes:[0,1,2]});
    const sideRect=many.owner.getSideRect("monster");
    many.context.v142SkillAnimationDirector.play(cast("iceArrowRain","all","magic",1600),{side:"player",actorIndex:0});
    const manyNode=sprites(many).nodes[0];
    assert.ok(manyNode);
    assert.equal(Number(manyNode.style.left.replace("px","")),sideRect.centerX);
    assert.equal(Number(manyNode.style.top.replace("px","")),sideRect.centerY);
    assert.equal(manyNode.dataset.areaId,"fixed-enemy-zone");

    const monsters=[
        {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
    ];
    const one=loadRuntime({monsters,targetIndexes:[1]});
    one.context.v142SkillAnimationDirector.play(cast("iceArrowRain","all","magic",1600),{side:"player",actorIndex:0});
    const oneNode=sprites(one).nodes[0];
    assert.ok(oneNode);
    ["left","top","width","height"].forEach(property=>assert.equal(oneNode.style[property],manyNode.style[property],property));
}

// Target trajectory starts/ends on formal actor/target slots.
{
    const runtime=loadRuntime({targetIndexes:[1]});
    const actor=runtime.owner.getSlotCenter(allySlot(runtime,0));
    const target=runtime.owner.getSlotCenter(enemySlot(runtime,1));
    runtime.context.v142SkillAnimationDirector.play(cast("floodBeast","single","magic",1350),{side:"player",actorIndex:0,targetId:1});
    const node=sprites(runtime).nodes[0];
    assert.ok(node);
    assert.equal(Number(node.style.left.replace("px","")),actor.x);
    assert.equal(Number(node.style.top.replace("px","")),actor.y);
    assert.equal(Number(node.style["--v143-sprite-dx"].replace("px","")),target.x-actor.x);
    assert.equal(Number(node.style["--v143-sprite-dy"].replace("px","")),target.y-actor.y);
}

// Enemy trajectory can discover a late real player endpoint and uses formal slots.
{
    const runtime=loadRuntime();
    const actor=runtime.owner.getSlotCenter(enemySlot(runtime,0));
    const target=runtime.owner.getSlotCenter(allySlot(runtime,2));
    runtime.context.v142SkillAnimationDirector.play(cast("floodBeast","single","magic",1350),{side:"monster",actorIndex:0});
    assert.equal(sprites(runtime).nodes.length,0);
    runtime.context.applySkillDebuffEffectsToPlayer(cast("floodBeast","single","magic",1350),1,runtime.party[2],2,1,1);
    const node=sprites(runtime).nodes[0];
    assert.ok(node);
    assert.equal(node.dataset.targetIndex,"2");
    assert.equal(Number(node.style.left.replace("px","")),actor.x);
    assert.equal(Number(node.style.top.replace("px","")),actor.y);
    assert.equal(Number(node.style["--v143-sprite-dx"].replace("px","")),target.x-actor.x);
    assert.equal(Number(node.style["--v143-sprite-dy"].replace("px","")),target.y-actor.y);
}

// Retained multi-target Freeze and ally support sheets use each formal target slot.
{
    const freeze=loadRuntime({targetIndexes:[0,2]});
    freeze.context.v142SkillAnimationDirector.play(cast("freeze","tri","magic",950),{side:"player",actorIndex:0,targetIds:[0,2]});
    const freezeNodes=sprites(freeze).nodes;
    assert.equal(freezeNodes.length,2);
    freezeNodes.forEach((node,arrayIndex)=>{
        const index=[0,2][arrayIndex];
        const formal=freeze.owner.getSlotCenter(enemySlot(freeze,index));
        assert.equal(Number(node.style.left.replace("px","")),formal.x);
        assert.equal(Number(node.style.top.replace("px","")),formal.y);
    });

    const heal=loadRuntime();
    heal.context.v142SkillAnimationDirector.play(cast("healSpell","allyAll","buff",1250),{side:"player",actorIndex:0});
    const healNodes=sprites(heal).nodes;
    assert.equal(healNodes.length,3);
    healNodes.forEach((node,index)=>{
        const formal=heal.owner.getSlotCenter(allySlot(heal,index));
        assert.equal(Number(node.style.left.replace("px","")),formal.x);
        assert.equal(Number(node.style.top.replace("px","")),formal.y);
    });
}

// Status loops still bind to live entities and carry the formal geometry slot identity.
{
    const monsters=[
        {alive:true,hp:100,statusEffects:[{type:"frostbite",turnsLeft:2}],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[{type:"freeze",turnsLeft:2}],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
    ];
    const runtime=loadRuntime({monsters});
    runtime.context.v143SyncStatusSpriteEffects();
    const frostbite=runtime.cards.battleMonster0.querySelector(".v153-status-vfx-frostbite");
    const frozen=runtime.cards.battleMonster1.querySelector(".v153-status-vfx-freeze");
    assert.ok(frostbite&&frozen);
    assert.equal(frostbite.dataset.slot,enemySlot(runtime,0));
    assert.equal(frozen.dataset.slot,enemySlot(runtime,1));
}

console.log("V166 Water Fixed Slot formal harness validation passed.");
