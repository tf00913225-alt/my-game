"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const ownerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const vfxSource=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const bossSource=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");

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
        removeChild(child){ this.children=this.children.filter(node=>node!==child); child.parentNode=null; child.parentElement=null; return child; },
        remove(){
            this.removed=true;
            if(this.parentNode&&Array.isArray(this.parentNode.children)){
                this.parentNode.children=this.parentNode.children.filter(node=>node!==this);
            }
        },
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
    const add=(slot,left,top,width,height,className)=>{
        const node=makeNode(slot,rect(left,top,width,height));
        node.dataset.slot=slot;
        node.classList.add(className);
        slotNodes[slot]=node;
        return node;
    };
    ["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5"].forEach((slot,index)=>add(slot,40+index*70,60,60,80,"v-fixed-enemy-slot"));
    ["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"].forEach((slot,index)=>add(slot,40+index*70,180,60,80,"v-fixed-enemy-slot"));
    ["ALLY_F1","ALLY_F2","ALLY_F3"].forEach((slot,index)=>add(slot,95+index*95,500,70,90,"v-fixed-ally-slot"));
    ["ALLY_B1","ALLY_B2","ALLY_B3"].forEach((slot,index)=>add(slot,95+index*95,610,70,90,"v-fixed-ally-slot"));
    add("MECH_L",30,300,90,70,"boss-mechanism-position");
    add("MECH_C",165,300,90,70,"boss-mechanism-position");
    add("MECH_R",300,300,90,70,"boss-mechanism-position");
    return slotNodes;
}

function createRuntime(action,targetType){
    const body=makeNode("body",rect(0,0,420,720));
    const battlePage=makeNode("battlePage",rect(0,0,420,720));
    const slotNodes=buildSlotDom();
    battlePage.querySelector=selector=>{
        const match=String(selector||"").match(/\[data-slot="([A-Z0-9_]+)"\]/);
        return match?slotNodes[match[1]]||null:null;
    };

    const monster0=makeNode("battleMonster0",rect(220,80,80,110));
    const monster1=makeNode("battleMonster1",rect(310,90,75,100));
    const player0=makeNode("battlePlayerCard0",rect(10,520,80,100));
    const player1=makeNode("battlePlayerCard1",rect(255,520,80,100));
    const monsterArea=makeNode("battleMonsterArea",rect(190,50,210,170));
    const playerArea=makeNode("battlePlayerRow",rect(40,475,340,175));
    const mechanism=makeNode("mechanismCard",rect(18,248,120,90));
    mechanism.dataset.id="mechanism-1";
    mechanism.classList.add("boss-mechanism-card");
    const mechanismHost=makeNode("bossMechanismSlot",rect(10,235,400,150));
    mechanismHost.appendChild(slotNodes.MECH_L);
    mechanismHost.appendChild(slotNodes.MECH_C);
    mechanismHost.appendChild(slotNodes.MECH_R);
    slotNodes.MECH_C.appendChild(mechanism);
    mechanismHost.querySelectorAll=selector=>selector===".boss-mechanism-card"?[mechanism]:[];

    const byId={
        battlePage,
        battleMonster0:monster0,battleMonster1:monster1,
        battlePlayerCard0:player0,battlePlayerCard1:player1,
        battleMonsterArea:monsterArea,battlePlayerRow:playerArea,bossMechanismSlot:mechanismHost
    };
    let gateId=0;
    const director={
        play(config){
            let resolve;
            const gate={id:++gateId,config,done:false,reason:null,promise:new Promise(r=>{ resolve=r; })};
            gate.complete=reason=>{
                if(gate.done){ return false; }
                gate.done=true;gate.reason=reason;resolve(gate);return true;
            };
            return gate;
        },
        dispose(){},
        getActive(){ return null; }
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
        queuedPlayerActions:[{action,target:"mechanism:mechanism-1",targetAlly:0}],
        getPartyCharacterByIndex(index){
            if(index===0)return {id:"P0",hp:100,alive:true,statusEffects:[],activeBuffs:[]};
            if(index===1)return {id:"P1",hp:100,alive:true,statusEffects:[],activeBuffs:[]};
            return null;
        },
        getSkillTargets(){ return [0,1]; },
        showMissEffect(){},showMonsterHit(){},showPlayerHit(){},v141PlayCardEffect(){},
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
    owner.ensureAllyFormation([0,1]);
    assert.equal(owner.getSlotFromElement(mechanism),"MECH_C","function card must inherit its formal mechanism Slot");
    assert.ok(owner.getAllySlotForCharacter(0),"player 0 must have a formal Ally Slot");
    vm.runInContext(vfxSource,context,{filename:"js/39-v143-skill-animation.js"});
    const config={id:action,name:action,element:"normal",category:"physical",targetType,duration:1450,resolveDuration:1450};
    context.v142SkillAnimationDirector.play(config,{side:"player",actorIndex:0});
    return {context,owner,snapshot,mechanism,player0,slotNodes};
}

const AFFECTED_SPREAD_DAMAGE_SKILLS=[
    ["explosiveFlurry","tri"],["fireRocket","tri"],["phoenixCry","all"],
    ["iceSpin","tri"],["waterBall","tri"],["iceArrowRain","all"],
    ["stormFlurry","tri"],["windSpell","tri"],["stormCircle","tri"],["stormRain","all"],
    ["petrifyFist","tri"],["earthquakeCrush","tri"],["stoneThrow","tri"],["sandWind","tri"],["flyingSandStrike","all"]
];

for(const [id,targetType] of AFFECTED_SPREAD_DAMAGE_SKILLS){
    const {context,owner,mechanism}=createRuntime(id,targetType);
    const current=context.v143SkillAnimationState.current;
    assert.ok(current,id+" must open the formal V143 cast");
    assert.deepEqual(Array.from(current.targetIndexes),["mechanism:mechanism-1"],id+" must preserve the selected function-card target");
    const nodes=Array.from(current.spriteNodes.values());
    assert.ok(nodes.length>0,id+" must create a formal Sprite on a function card");
    const sprite=nodes[0];
    assert.equal(sprite.style.visibility,"visible",id+" function-card Sprite must be visible");
    assert.equal(sprite.dataset.renderer,"dom-sprite",id+" must remain on the formal DOM Sprite owner");

    const placement=String(sprite.dataset.placement||"");
    const targetCenter=owner.getSlotCenter("MECH_C");
    assert.ok(targetCenter,id+" function-card target must expose formal mechanism Slot geometry");
    const cardCenter=centerOf(mechanism.getBoundingClientRect());
    assert.notDeepEqual({x:targetCenter.x,y:targetCenter.y},cardCenter,id+" regression fixture must keep card rect distinct from formal Slot center");
    if(placement==="trajectory"||placement==="targetTrajectory"){
        const allySlot=owner.getAllySlotForCharacter(0);
        const actorCenter=owner.getSlotCenter(allySlot);
        assert.ok(actorCenter,id+" trajectory actor must expose formal Ally Slot geometry");
        const start=pointFromSprite(sprite);
        assertPoint(start,{x:actorCenter.x,y:actorCenter.y},id+" must start from the formal Ally Slot");
        const dx=Number.parseFloat(sprite.style["--v143-sprite-dx"]);
        const dy=Number.parseFloat(sprite.style["--v143-sprite-dy"]);
        assertPoint({x:start.x+dx,y:start.y+dy},{x:targetCenter.x,y:targetCenter.y},id+" must travel toward the formal mechanism Slot");
    }else{
        assertPoint(pointFromSprite(sprite),{x:targetCenter.x,y:targetCenter.y},id+" must center on the formal mechanism Slot");
        assert.notDeepEqual(pointFromSprite(sprite),cardCenter,id+" must not use the retired function-card rect as VFX geometry");
    }
}

const resolverStart=bossSource.indexOf("    function resolveMechanismAction(characterIndex,queued,previous,that,args){");
const resolverEnd=bossSource.indexOf("    function inventoryDefinition(id){",resolverStart);
assert.ok(resolverStart>=0&&resolverEnd>resolverStart,"mechanism action owner must exist");
const resolver=bossSource.slice(resolverStart,resolverEnd);
const gateIndex=resolver.indexOf('window.v142PlaySkillAnimationFromBadge(');
const damageIndex=resolver.indexOf("const result=calculateMechanismActionDamage");
const retargetIndex=resolver.indexOf("queued.target=fallback");
assert.ok(gateIndex>=0,"spread function-card damage must explicitly open the existing formal animation gate");
assert.ok(gateIndex<damageIndex,"formal animation gate must start before function-card damage resolves");
assert.ok(gateIndex<retargetIndex,"formal animation gate must capture mechanism:* before core retargeting");
assert.match(resolver,/spreads&&skill&&numeric\(skill\.baseDamage\)>0/,"non-damaging spread skills must not fake a function-card hit VFX");

const damageStart=bossSource.indexOf("    function damageMechanism(card,damage,sourceName,isCrit){");
const damageEnd=bossSource.indexOf("    function partyIndexes(){",damageStart);
const damage=bossSource.slice(damageStart,damageEnd);
assert.match(damage,/v143RunAtTargetHit\("monster","mechanism:"\+card\.id,applyDamage,true\)/,"function-card damage must use the V143 target-hit boundary");
assert.ok(damage.indexOf("const applyDamage=function")<damage.indexOf("showDamagePopup"),"damage popup must live inside the hit-frame callback");
assert.ok(damage.indexOf("const applyDamage=function")<damage.indexOf("card.hp=Math.max"),"HP mutation must live inside the hit-frame callback");

assert.equal(AFFECTED_SPREAD_DAMAGE_SKILLS.length,15,"audit count changed; re-review function-card spread VFX coverage");
assert.doesNotMatch(vfxSource,/v174FireRocketTravel/,"retired single-skill Fire Rocket override must stay absent");
console.log("✓ mechanism-card VFX reliability: 15 spread damage skills covered");
