"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const slotOwnerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
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
        id:id||"",className:"",dataset:{},children:[],style:style(),classList:classList(),offsetParent:{},removed:false,
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        remove(){
            this.removed=true;
            if(this.parentNode&&Array.isArray(this.parentNode.children)){
                this.parentNode.children=this.parentNode.children.filter(node=>node!==this);
            }
        },
        setAttribute(){},
        querySelector(){ return null; },
        querySelectorAll(){ return []; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:80,bottom:100,width:80,height:100}; }
    };
}

function createRuntime(action,targetType){
    const body=makeNode("body",{left:0,top:0,right:420,bottom:720,width:420,height:720});
    const monster0=makeNode("battleMonster0",{left:220,top:80,right:300,bottom:190,width:80,height:110});
    const monster1=makeNode("battleMonster1",{left:310,top:90,right:385,bottom:190,width:75,height:100});
    const player0=makeNode("battlePlayerCard0",{left:170,top:520,right:250,bottom:620,width:80,height:100});
    const player1=makeNode("battlePlayerCard1",{left:255,top:520,right:335,bottom:620,width:80,height:100});
    const monsterArea=makeNode("battleMonsterArea",{left:190,top:50,right:400,bottom:220,width:210,height:170});
    const playerArea=makeNode("battlePlayerRow",{left:40,top:475,right:380,bottom:650,width:340,height:175});
    const mechanism=makeNode("mechanismCard",{left:18,top:248,right:138,bottom:338,width:120,height:90});
    mechanism.dataset.id="mechanism-1";
    mechanism.classList.add("boss-mechanism-card");
    const slot=makeNode("bossMechanismSlot",{left:10,top:235,right:410,bottom:390,width:400,height:155});
    const mechanismPosition=makeNode("mechanismPosition",{left:150,top:300,right:270,bottom:390,width:120,height:90});
    mechanismPosition.dataset.slot="MECH_C";
    mechanismPosition.className="boss-mechanism-position";
    mechanismPosition.appendChild(mechanism);
    slot.appendChild(mechanismPosition);
    slot.querySelectorAll=selector=>selector===".boss-mechanism-card"?[mechanism]:[];

    const byId={
        battleMonster0:monster0,battleMonster1:monster1,
        battlePlayerCard0:player0,battlePlayerCard1:player1,
        battleMonsterArea:monsterArea,battlePlayerRow:playerArea,bossMechanismSlot:slot
    };
    const fixedSlots={'.boss-mechanism-position[data-slot="MECH_C"]':mechanismPosition};
    [["MECH_L",18],["MECH_R",282]].forEach(([name,left])=>{
        const node=makeNode(name,{left,top:300,right:left+120,bottom:390,width:120,height:90});
        node.dataset.slot=name; node.className="boss-mechanism-position";
        fixedSlots['.boss-mechanism-position[data-slot="'+name+'"]']=node;
    });
    ["B","F"].forEach((row,rowIndex)=>{
        for(let column=1;column<=5;column++){
            const name="ENEMY_"+row+column,left=15+(column-1)*78,top=rowIndex===0?45:170;
            const node=makeNode(name,{left,top,right:left+72,bottom:top+112,width:72,height:112});
            node.dataset.slot=name; node.className="v-fixed-enemy-slot";
            fixedSlots['.v-fixed-enemy-slot[data-slot="'+name+'"]']=node;
        }
    });
    ["F","B"].forEach((row,rowIndex)=>{
        for(let column=1;column<=3;column++){
            const name="ALLY_"+row+column,left=55+(column-1)*110,top=rowIndex===0?470:595;
            const node=makeNode(name,{left,top,right:left+90,bottom:top+112,width:90,height:112});
            node.dataset.slot=name; node.className="v-fixed-ally-slot";
            fixedSlots['.v-fixed-ally-slot[data-slot="'+name+'"]']=node;
        }
    });
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
    const party=[
        {id:"P0",hp:100,alive:true,statusEffects:[],activeBuffs:[]},
        {id:"P1",hp:100,alive:true,statusEffects:[],activeBuffs:[]}
    ];
    const context={
        console,Promise,Set,Map,Array,Object,Number,String,Boolean,RegExp,Date,Math,Proxy,
        setTimeout,clearTimeout,innerWidth:420,innerHeight:720,
        v142SkillAnimationDirector:director,
        monsters:[
            {name:"Boss",rank:"boss",hp:5000,alive:true,statusEffects:[],activeBuffs:[]},
            {name:"Support",hp:500,alive:true,statusEffects:[],activeBuffs:[]}
        ],
        currentBattleMonsters:[0,1],
        queuedPlayerActions:[{action,target:"mechanism:mechanism-1",targetAlly:0}],
        getPartyCharacterByIndex(index){ return party[index]||null; },
        getSkillTargets(){ return [0,1]; },
        showMissEffect(){},showMonsterHit(){},showPlayerHit(){},v141PlayCardEffect(){},
        document:{
            body,readyState:"complete",
            createElement(tag){ return makeNode(tag); },
            getElementById(id){ return byId[id]||null; },
            querySelector(selector){ return fixedSlots[selector]||null; },
            querySelectorAll(){ return []; },
            addEventListener(){}
        },
        addEventListener(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(slotOwnerSource,context,{filename:"js/battlefield-slot-owner.js"});
    const owner=context.FourSymbolsBattlefieldSlots;
    owner.setActiveEnemySnapshot(owner.createEnemyFormationSnapshot([0,1],{originalFormationType:2}));
    owner.hydrateAllyFormation(null,[0,1]);
    vm.runInContext(vfxSource,context,{filename:"js/39-v143-skill-animation.js"});
    const config={id:action,name:action,element:"normal",category:"physical",targetType,duration:1450,resolveDuration:1450};
    context.v142SkillAnimationDirector.play(config,{side:"player",actorIndex:0});
    return {context,mechanism,player0,owner};
}

const AFFECTED_SPREAD_DAMAGE_SKILLS=[
    ["explosiveFlurry","tri"],["fireRocket","tri"],["phoenixCry","all"],
    ["iceSpin","tri"],["waterBall","tri"],["iceArrowRain","all"],
    ["stormFlurry","tri"],["windSpell","tri"],["stormCircle","tri"],["stormRain","all"],
    ["petrifyFist","tri"],["earthquakeCrush","tri"],["stoneThrow","tri"],["sandWind","tri"],["flyingSandStrike","all"]
];

for(const [id,targetType] of AFFECTED_SPREAD_DAMAGE_SKILLS){
    const {context,mechanism,player0,owner}=createRuntime(id,targetType);
    const current=context.v143SkillAnimationState.current;
    assert.ok(current,id+" must open the formal V143 cast");
    assert.deepEqual(Array.from(current.targetIndexes),["mechanism:mechanism-1"],id+" must preserve the selected function-card target");
    const nodes=Array.from(current.spriteNodes.values());
    assert.ok(nodes.length>0,id+" must create a formal Sprite on a function card");
    const sprite=nodes[0];
    assert.equal(sprite.style.visibility,"visible",id+" function-card Sprite must be visible");
    assert.equal(sprite.dataset.renderer,"dom-sprite",id+" must remain on the formal DOM Sprite owner");

    const placement=String(sprite.dataset.placement||"");
    const target=owner.getSlotCenter("MECH_C");
    if(placement==="trajectory"||placement==="targetTrajectory"){
        const actor=owner.getSlotCenter(owner.getSlotForCombatant("player",0));
        assert.equal(sprite.style.left,actor.x+"px",id+" must start at the caster Slot X");
        assert.equal(sprite.style.top,actor.y+"px",id+" must start at the caster Slot Y");
        assert.equal(sprite.style["--v143-sprite-dx"],target.x-actor.x+"px",id+" must travel toward the function Slot X");
        assert.equal(sprite.style["--v143-sprite-dy"],target.y-actor.y+"px",id+" must travel toward the function Slot Y");
    }else{
        assert.equal(sprite.style.left,target.x+"px",id+" must center on the function Slot X");
        assert.equal(sprite.style.top,target.y+"px",id+" must center on the function Slot Y");
    }
    const cardRect=mechanism.getBoundingClientRect();
    assert.notEqual(target.x,cardRect.left+cardRect.width/2,"mechanism card DOM center must not own formal VFX geometry");
    assert.notEqual(target.y,cardRect.top+cardRect.height/2,"mechanism card DOM center must not own formal VFX geometry");
    assert.ok(player0,"actor card stays present but is not the geometry owner");
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
assert.doesNotMatch(vfxSource,/function visualRectForCard\(|function fieldBounds\(|function sideAreaBounds\(/,"mechanism VFX must not regain card-bound geometry fallbacks");
console.log("✓ mechanism-card VFX reliability: 15 spread damage skills covered");
