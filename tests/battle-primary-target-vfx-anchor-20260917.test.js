"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const timingSource=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const vfxSource=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const mainSource=fs.readFileSync("js/00-main.js","utf8");

function makeNode(rect){
    const classes=new Set();
    return {
        id:"",className:"",dataset:{},children:[],parentNode:null,offsetParent:{},
        style:{
            setProperty(name,value){ this[name]=String(value); },
            getPropertyValue(name){ return this[name]||""; },
            removeProperty(name){ delete this[name]; }
        },
        classList:{
            add(...names){ names.forEach(name=>classes.add(name)); },
            remove(...names){ names.forEach(name=>classes.delete(name)); },
            contains(name){ return classes.has(name); }
        },
        appendChild(child){ child.parentNode=this;this.children.push(child);return child; },
        removeChild(child){ this.children=this.children.filter(item=>item!==child);child.parentNode=null; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}; },
        querySelector(selector){ return this.querySelectorAll(selector)[0]||null; },
        querySelectorAll(selector){
            const selectors=String(selector).split(",").map(value=>value.trim());
            const results=[];
            const matches=(node,value)=>value==="*"||
                (value.startsWith("#")&&node.id===value.slice(1))||
                (value.startsWith(".")&&String(node.className||"").split(/\s+/).includes(value.slice(1)));
            const visit=node=>node.children.forEach(child=>{
                if(selectors.some(selectorValue=>matches(child,selectorValue))){ results.push(child); }
                visit(child);
            });
            visit(this);
            return results;
        }
    };
}

function geometryRect(left,top,width,height,slots){
    return {left,top,right:left+width,bottom:top+height,width,height,centerX:left+width/2,centerY:top+height/2,slots:slots||[]};
}

function loadRuntime(){
    const body=makeNode();
    const nodes={};
    const slots={
        MONSTER_0:geometryRect(560,80,80,100),
        PLAYER_0:geometryRect(40,300,80,100),
        PLAYER_1:geometryRect(160,300,80,100),
        PLAYER_2:geometryRect(280,300,80,100)
    };
    const playerZone=geometryRect(40,300,320,100,["PLAYER_0","PLAYER_1","PLAYER_2"]);
    const monsterZone=geometryRect(560,80,80,100,["MONSTER_0"]);

    const monsterCard=makeNode(slots.MONSTER_0);
    monsterCard.id="battleMonster0";monsterCard.dataset.slot="MONSTER_0";
    nodes[monsterCard.id]=monsterCard;body.appendChild(monsterCard);
    [0,1,2].forEach(index=>{
        const card=makeNode(slots["PLAYER_"+index]);
        card.id="battlePlayerCard"+index;card.dataset.slot="PLAYER_"+index;
        nodes[card.id]=card;body.appendChild(card);
    });

    let timerId=0;
    const timers=new Map();
    const party=[0,1,2].map(()=>({hp:100,statusEffects:[],activeBuffs:[]}));
    const context={
        console,Promise,Date,Math,Number,String,Boolean,Object,Array,Set,Map,RegExp,Error,TypeError,Proxy,
        battleActive:true,battleToken:9,turn:1,battlePhase:"resolve",initiativeIndex:0,
        activeBattleCharacterIndex:0,innerWidth:900,innerHeight:700,
        skillDatabase:{
            stormFist:{id:"stormFist",name:"疾風拳",element:"wind",category:"physical",targetType:"single",tier:1},
            stormFlurry:{id:"stormFlurry",name:"暴風連擊",element:"wind",category:"physical",targetType:"tri",tier:2},
            stormRain:{id:"stormRain",name:"風起雲湧",element:"wind",category:"magic",targetType:"all",tier:4}
        },
        monsters:[{hp:100,alive:true,statusEffects:[],activeBuffs:[]}],
        currentBattleMonsters:[0],queuedPlayerActions:{},
        getPartyCharacterByIndex(index){ return party[index]||null; },
        setTimeout(callback,delay){ const id=++timerId;timers.set(id,{callback,delay});return id; },
        clearTimeout(id){ timers.delete(id); },
        document:{
            body,readyState:"complete",hidden:false,
            createElement(){ return makeNode(); },
            getElementById(id){
                if(nodes[id]){ return nodes[id]; }
                if(body.id===id){ return body; }
                return body.querySelector("#"+id);
            },
            querySelector(selector){ return body.querySelector(selector); },
            querySelectorAll(selector){ return body.querySelectorAll(selector); },
            addEventListener(){},removeEventListener(){}
        }
    };
    context.window=context;
    context.globalThis=context;
    context.FourSymbolsBattlefieldSlots={
        getSlotForCombatant(side,index){ return side==="monster"?"MONSTER_"+index:"PLAYER_"+index; },
        getSlotFromElement(element){ return element&&element.dataset?element.dataset.slot:null; },
        getSlotRect(slot){ return slots[slot]||null; },
        getSlotCenter(slot){
            const rect=slots[slot];
            return rect?{x:rect.centerX,y:rect.centerY,rect}:null;
        },
        getRectForSlots(slotIds){
            const selected=slotIds.map(slot=>slots[slot]).filter(Boolean);
            if(!selected.length){ return null; }
            const left=Math.min(...selected.map(rect=>rect.left));
            const top=Math.min(...selected.map(rect=>rect.top));
            const right=Math.max(...selected.map(rect=>rect.right));
            const bottom=Math.max(...selected.map(rect=>rect.bottom));
            return geometryRect(left,top,right-left,bottom-top,slotIds.slice());
        },
        getGeometryRectFromShape(side,slot,shape){
            if(String(shape).toLowerCase()==="single"){ return slots[slot]||null; }
            return side==="player"?Object.assign({},playerZone):Object.assign({},monsterZone);
        },
        getSideRect(side){ return side==="player"?Object.assign({},playerZone):Object.assign({},monsterZone); }
    };
    vm.createContext(context);
    vm.runInContext(timingSource,context,{filename:"js/37-v142-skill-animation.js"});
    vm.runInContext(vfxSource,context,{filename:"js/39-v143-skill-animation.js"});
    return {context,body};
}

function currentSprite(runtime){
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.ok(stage,"the formal VFX stage must exist");
    const sprites=stage.children.filter(node=>String(node.className).includes("v143-vfx-sprite"));
    assert.equal(sprites.length,1,"the skill must own one formal Sprite");
    return sprites[0];
}

{
    const runtime=loadRuntime();
    runtime.context.v142PlaySkillAnimationFromBadge("monster","疾風拳","wind",0,2,[2],{
        version:"battle-target-contract-v1",side:"monster",targetSide:"player",targetType:"single",actorIndex:0,targetId:2,targetIds:[2]
    });
    const current=runtime.context.v143SkillAnimationState.current;
    const sprite=currentSprite(runtime);
    assert.equal(current.targetId,2);
    assert.deepEqual(Array.from(current.targetIds),[2]);
    assert.equal(sprite.dataset.geometrySlot,"PLAYER_2");
    assert.equal(sprite.style.left,"320px");
    assert.equal(sprite.style.top,"350px");
}

{
    const runtime=loadRuntime();
    runtime.context.v142PlaySkillAnimationFromBadge("monster","暴風連擊","wind",0,2,[0,1,2],{
        version:"battle-target-contract-v1",side:"monster",targetSide:"player",targetType:"tri",actorIndex:0,targetId:2,targetIds:[0,1,2]
    });
    const current=runtime.context.v143SkillAnimationState.current;
    const sprite=currentSprite(runtime);
    assert.equal(current.targetId,2);
    assert.deepEqual(Array.from(current.targetIds),[0,1,2]);
    assert.equal(sprite.dataset.geometrySlot,"PLAYER_2","tri VFX must retain the selected primary slot");
    assert.equal(sprite.style.left,"320px","tri VFX must center on the actually selected card");
    assert.notEqual(sprite.style.left,"200px","tri VFX must not fall back to the row center");
}

{
    const runtime=loadRuntime();
    runtime.context.v142PlaySkillAnimationFromBadge("monster","暴風連擊","wind",0,2,[2],{
        version:"battle-target-contract-v1",side:"monster",targetSide:"player",targetType:"tri",actorIndex:0,targetId:2,targetIds:[2]
    });
    const sprite=currentSprite(runtime);
    assert.equal(sprite.dataset.geometrySlot,"PLAYER_2");
    assert.equal(sprite.style.width,"320px","one survivor must not collapse a three-slot footprint");
}

{
    const runtime=loadRuntime();
    runtime.context.v142PlaySkillAnimationFromBadge("monster","風起雲湧","wind",0,null,[2],{
        version:"battle-target-contract-v1",side:"monster",targetSide:"player",targetType:"all",actorIndex:0,targetId:null,targetIds:[2]
    });
    const sprite=currentSprite(runtime);
    assert.equal(sprite.dataset.placement,"battlefield");
    assert.equal(sprite.dataset.areaId,"fixed-ally-zone");
    assert.equal(sprite.style.left,"200px","all-target VFX stays centered on the complete formation");
    assert.equal(sprite.style.top,"350px");
    assert.equal(sprite.dataset.geometrySlot,undefined);
}

const monsterAction=mainSource.slice(
    mainSource.indexOf("function processSingleMonsterAttack"),
    mainSource.indexOf("function checkBattleEnd")
);
assert.match(mainSource,/function showMonsterSkillNameBadge\([\s\S]*?targetId,[\s\S]*?targetIds/);
assert.match(mainSource,/v142PlaySkillAnimationFromBadge\("monster",skillName,elementType,[\s\S]*?targetContract\.targetId,targetContract\.targetIds,targetContract/);
assert.doesNotMatch(vfxSource,/queuedPlayerActions/,"the VFX runtime must not infer targets from the combat queue");
assert.ok(
    monsterAction.indexOf("const attackTargetIndexes")<monsterAction.indexOf("showMonsterSkillNameBadge("),
    "monster target selection must complete before the badge starts the VFX gate"
);
assert.match(monsterAction,/skillTargetType==="all"\?null:primaryTargetIndex,[\s\S]*?attackTargetIndexes/);

console.log("Primary-target battle VFX anchor regression passed.");
