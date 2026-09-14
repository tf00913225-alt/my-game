from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label} anchor mismatch: {count}")
    return text.replace(old, new, 1)


# 1) Keep V143 as the single visual owner, but make sidecar mechanism cards
# authoritative geometry for every existing Sprite placement mode.
vfx_path = Path("js/39-v143-skill-animation.js")
vfx = vfx_path.read_text(encoding="utf-8")

field_anchor = '''    function fieldBounds(cards){
        const rects=cards.map(card=>visualRectForCard(card))
            .filter(rect=>rect&&rect.width&&rect.height);
        if(!rects.length){ return null; }
        const left=Math.min.apply(null,rects.map(rect=>rect.left));
        const top=Math.min.apply(null,rects.map(rect=>rect.top));
        const right=Math.max.apply(null,rects.map(rect=>rect.right));
        const bottom=Math.max.apply(null,rects.map(rect=>rect.bottom));
        return {left:left,top:top,width:right-left,height:bottom-top};
    }

'''
field_replacement = field_anchor + '''    function mechanismTargetBounds(current,indexes){
        if(!current||current.targetSide!=="monster"){ return null; }
        const cards=(indexes||[]).filter(isMechanismTarget)
            .map(index=>cardFor("monster",index)).filter(Boolean);
        const bounds=fieldBounds(cards);
        if(!bounds){ return null; }
        bounds.centerX=bounds.left+bounds.width/2;
        bounds.centerY=bounds.top+bounds.height/2;
        bounds.id="bossMechanismSlot";
        return bounds;
    }

'''
vfx = replace_once(vfx, field_anchor, field_replacement, "mechanismTargetBounds")

tri_anchor = '''    function fixedTriLayoutBounds(current,indexes){
        if(String(current.config.targetType||"")==="allyTri"&&current.targetSide==="player"){
'''
tri_replacement = '''    function fixedTriLayoutBounds(current,indexes){
        const mechanismBounds=mechanismTargetBounds(current,indexes);
        if(mechanismBounds){ return mechanismBounds; }
        if(String(current.config.targetType||"")==="allyTri"&&current.targetSide==="player"){
'''
vfx = replace_once(vfx, tri_anchor, tri_replacement, "fixedTri mechanism geometry")

group_anchor = '''    function groupLayoutBounds(current,indexes){
        if(/tri/i.test(String(current.config.targetType||""))){ return fixedTriLayoutBounds(current,indexes); }
'''
group_replacement = '''    function groupLayoutBounds(current,indexes){
        const mechanismBounds=mechanismTargetBounds(current,indexes);
        if(mechanismBounds){ return mechanismBounds; }
        if(/tri/i.test(String(current.config.targetType||""))){ return fixedTriLayoutBounds(current,indexes); }
'''
vfx = replace_once(vfx, group_anchor, group_replacement, "group mechanism geometry")

battlefield_anchor = '''        if(placement==="battlefield"){
            const bounds=sideAreaBounds(current.targetSide);
            if(!bounds){ return; }
'''
battlefield_replacement = '''        if(placement==="battlefield"){
            const bounds=mechanismTargetBounds(current,emittedSpriteTargets(current))||sideAreaBounds(current.targetSide);
            if(!bounds){ return; }
'''
vfx = replace_once(vfx, battlefield_anchor, battlefield_replacement, "battlefield mechanism geometry")

vfx_path.write_text(vfx, encoding="utf-8")


# 2) Mechanism battle integration owns only target routing. Start the already
# existing V142/V143 gate before a spread action is retargeted to core monsters,
# and apply function-card damage at the formal Sprite hit frame.
boss_path = Path("js/gameplay-boss-tower-system.js")
boss = boss_path.read_text(encoding="utf-8")

start = boss.index('    function damageMechanism(card,damage,sourceName,isCrit){')
end = boss.index('    function partyIndexes(){', start)
new_damage = '''    function damageMechanism(card,damage,sourceName,isCrit){
        if(!card||card.destroyed||card.hp<=0){ return 0; }
        const final=Math.max(1,Math.round(numeric(damage,1)));
        const applyDamage=function(){
            if(!card||card.destroyed||card.hp<=0){ return; }
            const node=document.querySelector('#bossMechanismSlot [data-id="'+card.id+'"]');
            if(node&&typeof showDamagePopup==="function"){
                showDamagePopup(node,"HP-"+final,"hp",!!isCrit);
            }
            card.hp=Math.max(0,card.hp-final);
            if(typeof addBattleLog==="function"){ addBattleLog((sourceName||"攻擊")+"命中【"+card.name+"】，造成"+final+"傷害。"); }
            if(card.hp<=0){ destroyMechanism(card,"destroyed"); }else{ renderMechanisms(); }
        };
        if(typeof window.v143RunAtTargetHit==="function"){
            window.v143RunAtTargetHit("monster","mechanism:"+card.id,applyDamage,true);
        }else{
            applyDamage();
        }
        return final;
    }
'''
boss = boss[:start] + new_damage + boss[end:]

result_anchor = '''        const result=calculateMechanismActionDamage(characterIndex,queued.action,card);
'''
result_replacement = '''        if(spreads&&skill&&numeric(skill.baseDamage)>0&&typeof window.v142PlaySkillAnimationFromBadge==="function"){
            /* Keep the selected sidecar target authoritative until the formal
               V142/V143 owner has created its Sprite. The core resolver may
               retarget the spread portion to living monsters afterwards. */
            window.v142PlaySkillAnimationFromBadge(
                "player",skill.name,skill.element||(character&&character.element)||"normal",characterIndex
            );
        }
        const result=calculateMechanismActionDamage(characterIndex,queued.action,card);
'''
boss = replace_once(boss, result_anchor, result_replacement, "spread mechanism VFX gate")

boss_path.write_text(boss, encoding="utf-8")


# 3) Runtime regression: every current direct-damage spread skill must create
# its formal Sprite on a selected function/mechanism card. This is deliberately
# broader than the reported Fire Flurry symptom.
test_path = Path("tests/mechanism-card-vfx-reliability-20260914.test.js")
test_path.write_text(r'''"use strict";

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
            querySelectorAll(){ return []; },
            addEventListener(){}
        },
        addEventListener(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(vfxSource,context,{filename:"js/39-v143-skill-animation.js"});
    const config={id:action,name:action,element:"normal",category:"physical",targetType,duration:1450,resolveDuration:1450};
    context.v142SkillAnimationDirector.play(config,{side:"player",actorIndex:0});
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
    if(placement==="trajectory"||placement==="targetTrajectory"){
        const actorRect=player0.getBoundingClientRect();
        const actorX=actorRect.left+actorRect.width/2;
        const actorY=actorRect.top+actorRect.height/2;
        assert.equal(sprite.style["--v143-sprite-dx"],targetX-actorX+"px",id+" must travel toward the function card X");
        assert.equal(sprite.style["--v143-sprite-dy"],targetY-actorY+"px",id+" must travel toward the function card Y");
    }else{
        assert.equal(sprite.style.left,targetX+"px",id+" must center on the function card X");
        assert.equal(sprite.style.top,targetY+"px",id+" must center on the function card Y");
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
''', encoding="utf-8")
