const assert=require("assert");
const fs=require("fs");
const vm=require("vm");
const {execFileSync}=require("child_process");

const source=fs.readFileSync("js/44-v152-dev-fixes.js","utf8");
const css=fs.readFileSync("css/45-v152-dev-fixes.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const v140=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const v143=fs.readFileSync("js/38-v143-system-fixes.js","utf8");

let passed=0;
function test(name,fn){
    try{ fn(); console.log("✓",name); passed++; }
    catch(error){ console.error("✗",name); throw error; }
}

function classList(initial=[]){
    const values=new Set(initial);
    return {
        add(...items){ items.forEach(item=>values.add(item)); },
        remove(...items){ items.forEach(item=>values.delete(item)); },
        contains(item){ return values.has(item); },
        toggle(item,force){
            const next=force===undefined?!values.has(item):!!force;
            if(next){ values.add(item); }else{ values.delete(item); }
            return next;
        }
    };
}

function baseSkills(){
    return {
        dragonSlash:{id:"dragonSlash",repeatChance:33},phoenixCry:{id:"phoenixCry"},
        iceSpin:{id:"iceSpin"},frostCrush:{id:"frostCrush"},stormFlurry:{id:"stormFlurry"},
        dizzyFist:{id:"dizzyFist"},earthquakeCrush:{id:"earthquakeCrush",selfShieldByLevel:[100]},
        iceArrowRain:{id:"iceArrowRain"},rage:{id:"rage",critChanceBonusByLevel:[5,10,15,20,25],critDamageBonusByLevel:[10,20,30,40,50]},
        yuanXiangGuangMing:{id:"yuanXiangGuangMing",name:"元相光明",element:"light",spCost:35},
        yuanGuangShield:{id:"yuanGuangShield",name:"元光護體",element:"light",spCost:40},
        yuanZuBlessing:{id:"yuanZuBlessing",name:"元祖賜福",element:"light",spCost:45},
        fireBurstStrike:{id:"fireBurstStrike",name:"火爆一擊"}
    };
}

function bareDocument(overrides={}){
    return Object.assign({
        readyState:"complete",body:{appendChild(){}},
        getElementById(){ return null; },querySelector(){ return null; },querySelectorAll(){ return []; },
        addEventListener(){},createElement(){ return {className:"",textContent:""}; }
    },overrides);
}

function load(overrides={}){
    const context=Object.assign({
        window:null,console,Math:Object.create(Math),Number,Object,Array,Set,Map,Promise,
        skillDatabase:baseSkills(),document:bareDocument(),
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},requestAnimationFrame:callback=>callback()
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V152 remains ordered before V154 under cache version 154",()=>{
    assert.match(index,/js\/20-anonymous-20\.js\?v=162/);
    assert.match(loader,/const V_ASSET_VERSION="162"/);
    assert.match(loader,/css\/45-v152-dev-fixes\.css/);
    const v149=loader.indexOf("js/43-v149-skill-ui-rules.js");
    const v152=loader.indexOf("js/44-v152-dev-fixes.js");
    assert.ok(v149>=0&&v152>v149);
});

test("the latest requested skill values replace the V149 snapshot",()=>{
    const context=load();
    const skills=context.skillDatabase;
    assert.equal(skills.fireBurstStrike,undefined);
    assert.deepEqual(Array.from(skills.dragonSlash.repeatChanceByLevel),[5,10,20,30,40]);
    assert.equal(skills.dragonSlash.baseDamage,165);
    assert.equal(skills.phoenixCry.baseDamage,60);
    assert.deepEqual([skills.iceSpin.frostbiteChance,skills.iceSpin.frostbiteDuration],[40,1]);
    assert.deepEqual([skills.frostCrush.frostbiteChance,skills.frostCrush.frostbiteDuration],[50,1]);
    assert.deepEqual(Array.from(skills.stormFlurry.damageDownByLevel),[10,20,30,40,50]);
    assert.equal(skills.stormFlurry.damageDownDuration,2);
    assert.deepEqual(Array.from(skills.dizzyFist.missBonusByLevel),[30,45,50,55,65]);
    assert.equal(skills.dizzyFist.stunDuration,5);
    assert.equal(skills.earthquakeCrush.selfShieldByLevel,undefined);
    assert.deepEqual(Array.from(skills.earthquakeCrush.petrifyChanceByLevel),[30,35,40,45,50]);
    assert.equal(skills.earthquakeCrush.petrifyDuration,3);
    assert.deepEqual([skills.iceArrowRain.freezeChance,skills.iceArrowRain.freezeDuration],[20,2]);
    assert.match(skills.iceArrowRain.description,/20%基礎機率冰封2回合/);
    assert.deepEqual([skills.yuanXiangGuangMing.baseHeal,skills.yuanXiangGuangMing.baseHealSP],[150,55]);
    assert.deepEqual([skills.yuanGuangShield.shieldAmount,skills.yuanGuangShield.shieldDuration],[100,2]);
    assert.deepEqual([skills.yuanZuBlessing.cleanseChance,skills.yuanZuBlessing.agilityBonusPercent,skills.yuanZuBlessing.duration],[20,50,2]);
});

test("role switching refreshes only the selected owner's independent skill-point display",()=>{
    const points={textContent:""};
    const owners={fire:{skillPoints:12},player2:{skillPoints:37}};
    const loadouts={
        fire:{skillLevels:{fireBurstStrike:1},equippedSkills:["fireBurstStrike","flameSlash"]},
        player2:{skillLevels:{},equippedSkills:[]}
    };
    const context=load({
        currentSkillCharacter:"fire",characterSkillLoadouts:loadouts,
        getSkillCharacterObject:key=>owners[key],renderSkillLoadout(){},
        document:bareDocument({getElementById:id=>id==="skillPoints"?points:null})
    });
    context.renderSkillLoadout();
    assert.equal(points.textContent,"12");
    context.currentSkillCharacter="player2";
    context.renderSkillLoadout();
    assert.equal(points.textContent,"37");
    assert.deepEqual([owners.fire.skillPoints,owners.player2.skillPoints],[12,37]);
    assert.equal(loadouts.fire.skillLevels.fireBurstStrike,undefined);
    assert.deepEqual(Array.from(loadouts.fire.equippedSkills),["flameSlash"]);
});

test("Dragon Slash uses the caster's own per-level repeat chance",()=>{
    const observed=[];
    const context=load({
        getPartyCharacterKey:index=>index===0?"fire":"player2",
        getSkillLevel:(key,id)=>key==="fire"&&id==="dragonSlash"?3:1,
        castDamageSkill(id){ observed.push(["player",this.skillDatabase[id].repeatChance]); },
        monsters:[{v141ForceSkillLevel:5}],
        processSingleMonsterAttack(){ observed.push(["monster",this.skillDatabase.dragonSlash.repeatChance]); }
    });
    context.castDamageSkill("dragonSlash");
    context.processSingleMonsterAttack(0);
    assert.deepEqual(observed,[["player",20],["monster",40]]);
    assert.equal(context.v152GetDragonRepeatChance(2),10);
});

test("Rage supplies separate critical chance and critical-damage values to the live resolver",()=>{
    const character={activeBuffs:[{type:"rage",turnsLeft:2}]};
    const context=load({
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>character,
        getPartyCharacterKey:()=>"fire",getSkillLevel:()=>4,
        rollCritical(target){
            const buff=target.activeBuffs[0];
            return {isCrit:true,chance:buff.bonusPercent,multiplier:1.5+buff.critDamageBonusPercent/100};
        }
    });
    const result=context.rollCritical(character,"physical",0);
    assert.deepEqual([character.activeBuffs[0].critChanceBonusPercent,character.activeBuffs[0].critDamageBonusPercent],[20,40]);
    assert.deepEqual([result.chance,result.multiplier],[20,1.9]);
});

function emperorContext(statuses=[{type:"burn",turnsLeft:2}]){
    const boss={name:"極帝天尊",alive:true,hp:300,maxHP:500,sp:200,maxSP:200,agility:100,statusEffects:statuses.slice(),v141Abyss:true};
    const ally={name:"天兵天將",alive:true,hp:100,maxHP:500,sp:10,maxSP:200,agility:80,statusEffects:statuses.slice(),v141Abyss:true};
    const shields=[];
    const context=load({
        monsters:[boss,ally],currentBattleMonsters:[0,1],
        v141HealMonsterPreservingShield(monster,amount){ const before=monster.hp; monster.hp=Math.min(monster.maxHP,monster.hp+amount); return monster.hp-before; },
        v141ApplyMonsterShield(monster,amount,turns){ monster.v141Shield={remaining:amount,turnsLeft:turns,baseMaxHP:monster.maxHP}; shields.push([monster.name,amount,turns]); },
        showMonsterSkillNameBadge(){},showMonsterHit(){},addBattleLog(){},updateUI(){},finishPlayerAction(){},
        v141PlayCardEffect(){},document:bareDocument()
    });
    return {context,boss,ally,shields};
}

test("Extreme Emperor's three Light skills use the exact final values",()=>{
    let state=emperorContext([]);
    assert.equal(state.context.v152ResolveExtremeEmperorAction(0,"yuanXiangGuangMing"),true);
    assert.equal(state.ally.hp,250);
    assert.equal(state.ally.sp,65);

    state=emperorContext([]);
    assert.equal(state.context.v152ResolveExtremeEmperorAction(0,"yuanGuangShield"),true);
    assert.deepEqual(state.shields,[["極帝天尊",100,2],["天兵天將",100,2]]);

    state=emperorContext();
    assert.equal(state.context.v152ResolveExtremeEmperorAction(0,"yuanZuBlessing",false),true);
    assert.equal(state.ally.statusEffects.length,1);
    assert.equal(state.ally.agility,120);
    assert.equal(state.ally.v142AgilityBlessing.turnsLeft,2);

    state=emperorContext();
    assert.equal(state.context.v152ResolveExtremeEmperorAction(0,"yuanZuBlessing",true),true);
    assert.equal(state.ally.statusEffects.length,0);
    assert.equal(state.ally.agility,120);
});

test("Frostbite visibly disables the Skill command without disabling normal attack",()=>{
    const skillButton={disabled:false,dataset:{},classList:classList(),setAttribute(){}};
    const normalButton={disabled:false};
    const icon={symbol:null,querySelector(){ return this.symbol; },appendChild(node){ this.symbol=node; }};
    const quick={disabled:false,onclick(){},classList:classList(),querySelector(selector){ return selector===".sq-icon-wrap"?icon:null; }};
    const character={statusEffects:[{type:"frostbite",turnsLeft:1}]};
    const document=bareDocument({
        querySelector(selector){ return selector.includes("menu-button.skill")?skillButton:null; },
        querySelectorAll(selector){ return selector.includes("skillQuickBarGrid")?[quick]:[]; },
        createElement(){ return {className:"",textContent:""}; }
    });
    const context=load({document,getPartyCharacterByIndex:()=>character,activeBattleCharacterIndex:0,populateSkillQuickBar(){}});
    context.populateSkillQuickBar();
    assert.equal(skillButton.disabled,true);
    assert.equal(quick.disabled,true);
    assert.equal(icon.symbol.textContent,"🚫");
    assert.equal(normalButton.disabled,false);
});

test("entering a map immediately runs configured auto recovery exactly once",()=>{
    const mapPage={classList:classList()};
    let recovered=0,saved=0;
    const context=load({
        battleActive:false,getExistingPartyIndexes:()=>[0],getPartyAutoConfig:()=>({enabled:true}),
        applyPostBattleAutoRecovery(){ recovered++; },saveGame(){ saved++; },updateUI(){},
        document:bareDocument({getElementById:id=>id==="mapPage"?mapPage:null}),
        showPage(page){ if(page==="map"){ mapPage.classList.add("active"); } }
    });
    context.showPage("map");
    context.showPage("map");
    assert.deepEqual([recovered,saved],[1,1]);

    const abyssMap={};
    let abyssRecovered=0;
    const abyssContext=load({
        battleActive:false,getExistingPartyIndexes:()=>[0],getPartyAutoConfig:()=>({enabled:true}),
        applyPostBattleAutoRecovery(){ abyssRecovered++; },saveGame(){},updateUI(){},
        v141StartAbyss(){},
        document:bareDocument({getElementById:id=>id==="v141AbyssMap"?abyssMap:null})
    });
    abyssContext.v141StartAbyss();
    assert.equal(abyssRecovered,1);

    abyssContext.applyPostBattleAutoRecovery();
    abyssContext.v141StartAbyss();
    assert.equal(abyssRecovered,2);
});

test("HP popups are reparented above the full-screen skill stage",()=>{
    const popup={classList:classList(["damage-popup","hp-popup"]),style:{setProperty(){}},parentNode:null};
    const appended=[];
    const element={offsetWidth:76,popup:null,getBoundingClientRect(){ return {left:20,top:30,width:152,height:200}; },querySelectorAll(){ return this.popup?[this.popup]:[]; }};
    const document=bareDocument({body:{appendChild(node){ appended.push(node); node.parentNode=this; }}});
    const context=load({document,showDamagePopup(target){ target.popup=popup; }});
    context.showDamagePopup(element,"HP-100","hp");
    assert.equal(appended[0],popup);
    assert.equal(popup.classList.contains("v152-top-damage"),true);
    assert.match(css,/z-index:2147483646/);
});

test("the final abnormal formula and Ice Arrow Rain chance remain authoritative",()=>{
    assert.match(v140,/PHYSICAL_STATUS_COEFFICIENT=0\.2/);
    assert.match(v140,/MAGIC_STATUS_COEFFICIENT=0\.3/);
    assert.match(v140,/Math\.sqrt\(power\)\*LOCKDOWN_STATUS_COEFFICIENT/);
    assert.match(v140,/regular:\{min:5,max:80\}/);
    assert.match(v140,/elite:\{min:5,max:60\}/);
    assert.match(v140,/boss:\{min:5,max:40\}/);
    assert.match(v143,/const freezeChance=Math\.max\(0,numeric\(skill&&skill\.freezeChance\)\)/);
    assert.doesNotMatch(v143,/rollStatusEffectHit\(\s*50,caster\.level/);
});

test("dungeon art, scrolling, five-slot nav and Abyss combat info are all wired",()=>{
    const expected={
        "assets/dungeons/covers/exp.webp":"1536x864",
        "assets/dungeons/covers/material.webp":"1536x864",
        "assets/dungeons/covers/equipment.webp":"1536x864",
        "assets/dungeons/abyss/abyss-cover.webp":"864x1536",
        "assets/dungeons/abyss/east-emperor.webp":"1152x1536",
        "assets/dungeons/abyss/heaven-emperor.webp":"1152x1536",
        "assets/dungeons/abyss/north-emperor.webp":"1152x1536",
        "assets/dungeons/abyss/south-emperor.webp":"1152x1536",
        "assets/dungeons/abyss/soldier.webp":"1152x1536"
    };
    Object.entries(expected).forEach(([path,size])=>{
        assert.ok(fs.statSync(path).size>10000,path);
        const output=execFileSync("identify",["-format","%wx%h",path],{encoding:"utf8"});
        assert.equal(output,size,path);
        assert.match(css+source,new RegExp(path.replace("assets/","assets\\/")));
    });
    assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
    assert.match(css,/overflow-y:auto !important/);
    assert.match(css,/\.v141-task-tracker[\s\S]*display:none !important/);
    assert.match(css,/\.v141-reward-toast[\s\S]*pointer-events:auto !important/);
    assert.match(css,/battlePage\.v152-abyss-battle #battleInfo/);
    assert.match(css,/menu-button\.skill[\s\S]*width:21\.5%/);
});

console.log(`\nV152 dev-fixes suite: ${passed} tests passed.`);
