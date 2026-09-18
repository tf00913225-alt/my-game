"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

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
    const slot=makeNode("bossMechanismSlot",{left:10,top:235,right:150,bottom:350,width:140,height:115});
    slot.appendChild(mechanism);
    slot.querySelectorAll=selector=>selector===".boss-mechanism-card"?[mechanism]:[];

    const byId={
        battleMonster0:monster0,battleMonster1:monster1,
        battlePlayerCard0:player0,battlePlayerCard1:player1,
        battleMonsterArea:monsterArea,battlePlayerRow:playerArea,bossMechanismSlot:slot
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
        v142SkillAnimationDirector:director,
        FourSymbolsBattlefieldSlots:{
            getSlotForCombatant(side,index){ return (side==="monster"?"MONSTER_":"PLAYER_")+index; },
            getSlotFromElement(element){ return element===mechanism?"MECHANISM_1":element&&element.dataset?element.dataset.slot:null; },
            getSlotRect(slotId){
                if(slotId==="MECHANISM_1"){
                    const rect=mechanism.getBoundingClientRect();
                    return Object.assign({},rect,{centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2});
                }
                const match=String(slotId).match(/^(MONSTER|PLAYER)_(\d+)$/);
                if(!match){ return null; }
                const node=byId[(match[1]==="MONSTER"?"battleMonster":"battlePlayerCard")+match[2]];
                const rect=node&&node.getBoundingClientRect();
                return rect?Object.assign({},rect,{centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2}):null;
            },
            getSlotCenter(slotId){
                const rect=this.getSlotRect(slotId);
                return rect?{x:rect.centerX,y:rect.centerY,rect}:null;
            },
            getRectForSlots(slotIds){ return this.getSlotRect(slotIds[0]); },
            getGeometryRectFromShape(side,slotId,shape){
                if(slotId==="MECHANISM_1"&&shape!=="single"){
                    return Object.assign({slots:["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"]},this.getSideRect(side));
                }
                return this.getSlotRect(slotId)||this.getSideRect(side);
            },
            getSideRect(side){
                const rect=(side==="monster"?monsterArea:playerArea).getBoundingClientRect();
                return Object.assign({},rect,{centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2});
            }
        },
        monsters:[
            {name:"Boss",rank:"boss",hp:5000,alive:true,statusEffects:[],activeBuffs:[]},
            {name:"Support",hp:500,alive:true,statusEffects:[],activeBuffs:[]}
        ],
        currentBattleMonsters:[0,1],
        getPartyCharacterByIndex(index){
            if(index===0)return {id:"P0",hp:100,alive:true,statusEffects:[],activeBuffs:[]};
            if(index===1)return {id:"P1",hp:100,alive:true,statusEffects:[],activeBuffs:[]};
            return null;
        },
        showMissEffect(){},showMonsterHit(){},showPlayerHit(){},v141PlayCardEffect(){},
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
    vm.runInContext(vfxSource,context,{filename:"js/39-v143-skill-animation.js"});
    const config={id:action,name:action,element:"normal",category:"physical",targetType,duration:1450,resolveDuration:1450};
    const targetId="mechanism:mechanism-1";
    context.v142SkillAnimationDirector.play(config,{
        side:"player",actorIndex:0,targetSide:"monster",targetId,targetIds:[targetId]
    });
    return {context,mechanism,player0};
}

const AFFECTED_SPREAD_DAMAGE_SKILLS=[
    ["explosiveFlurry","tri"],["fireRocket","tri"],["phoenixCry","all"],
    ["iceSpin","tri"],["waterBall","tri"],["iceArrowRain","all"],
    ["stormFlurry","tri"],["windSpell","tri"],["stormCircle","tri"],["stormRain","all"],
    ["petrifyFist","tri"],["earthquakeCrush","tri"],["stoneThrow","tri"],["sandWind","tri"],["flyingSandStrike","all"]
];

for(const [id,targetType] of AFFECTED_SPREAD_DAMAGE_SKILLS){
    const {context,mechanism,player0}=createRuntime(id,targetType);
    const current=context.v143SkillAnimationState.current;
    assert.ok(current,id+" must open the formal V143 cast");
    assert.deepEqual(Array.from(current.targetIndexes),["mechanism:mechanism-1"],id+" must preserve the selected function-card target");
    const nodes=Array.from(current.spriteNodes.values());
    assert.ok(nodes.length>0,id+" must create a formal Sprite on a function card");
    const sprite=nodes[0];
    assert.equal(sprite.style.visibility,"visible",id+" function-card Sprite must be visible");
    assert.equal(sprite.dataset.renderer,"dom-sprite",id+" must remain on the formal DOM Sprite owner");

    const placement=String(sprite.dataset.placement||"");
    const targetRect=mechanism.getBoundingClientRect();
    const targetX=targetRect.left+targetRect.width/2;
    const targetY=targetRect.top+targetRect.height/2;
    const rangeRect=context.FourSymbolsBattlefieldSlots.getSideRect("monster");
    assert.equal(sprite.dataset.frameFit,"cover",id+" must preserve its authored per-frame aspect");
    assert.ok(Number.parseFloat(sprite.style.width)>=rangeRect.width,id+" range width must cover the enemy side");
    assert.ok(Number.parseFloat(sprite.style.height)>=rangeRect.height,id+" range height must cover the enemy side");
    if(placement==="trajectory"||placement==="targetTrajectory"){
        const actorRect=player0.getBoundingClientRect();
        const actorX=actorRect.left+actorRect.width/2;
        const actorY=actorRect.top+actorRect.height/2;
        assert.equal(sprite.style["--v143-sprite-dx"],targetX-actorX+"px",id+" must preserve the function-card projectile endpoint X");
        assert.equal(sprite.style["--v143-sprite-dy"],targetY-actorY+"px",id+" must preserve the function-card projectile endpoint Y");
    }else{
        assert.equal(sprite.style.left,rangeRect.centerX+"px",id+" function-card range VFX must center on the enemy side X");
        assert.equal(sprite.style.top,rangeRect.centerY+"px",id+" function-card range VFX must center on the enemy side Y");
    }
}

const resolverStart=bossSource.indexOf("    function resolveMechanismAction(characterIndex,queued,previous,that,args){");
const resolverEnd=bossSource.indexOf("    function inventoryDefinition(id){",resolverStart);
assert.ok(resolverStart>=0&&resolverEnd>resolverStart,"mechanism action owner must exist");
const resolver=bossSource.slice(resolverStart,resolverEnd);
const gateIndex=resolver.indexOf('showSkillNameBadge(');
const damageIndex=resolver.indexOf("const result=calculateMechanismActionDamage");
assert.ok(gateIndex>=0,"spread function-card damage must enter the formal badge/target-contract owner");
assert.ok(gateIndex<damageIndex,"formal animation gate must start before function-card damage resolves");
assert.match(resolver,/showSkillNameBadge\(skill\.name,skill\.element,characterIndex,queued\.target,\[queued\.target\]\)/,
    "formal animation gate must carry the selected mechanism:* target explicitly");
assert.match(resolver,/if\(result\.damage>0\)\{ damageMechanism\(/,
    "non-damaging skills may present their cast but must not fake a function-card hit");

const damageStart=bossSource.indexOf("    function damageMechanism(card,damage,sourceName,isCrit){");
const damageEnd=bossSource.indexOf("    function partyIndexes(){",damageStart);
const damage=bossSource.slice(damageStart,damageEnd);
assert.match(damage,/v143RunAtTargetHit\("monster","mechanism:"\+card\.id,applyDamage,true\)/,"function-card damage must use the V143 target-hit boundary");
assert.ok(damage.indexOf("const applyDamage=function")<damage.indexOf("showDamagePopup"),"damage popup must live inside the hit-frame callback");
assert.ok(damage.indexOf("const applyDamage=function")<damage.indexOf("card.hp=Math.max"),"HP mutation must live inside the hit-frame callback");

assert.equal(AFFECTED_SPREAD_DAMAGE_SKILLS.length,15,"audit count changed; re-review function-card spread VFX coverage");
assert.doesNotMatch(vfxSource,/v174FireRocketTravel/,"retired single-skill Fire Rocket override must stay absent");
console.log("✓ mechanism-card VFX reliability: 15 spread damage skills covered");
