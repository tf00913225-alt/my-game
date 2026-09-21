"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const index=fs.readFileSync("assets/ASSET_INDEX.md","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function makeNode(rect){
    const classes=new Set();
    const node={
        id:"",className:"",dataset:{},children:[],parentNode:null,offsetParent:{},
        style:{setProperty(name,value){ this[name]=String(value); }},
        classList:{
            add(...names){ names.forEach(name=>classes.add(name)); },
            remove(...names){ names.forEach(name=>classes.delete(name)); },
            contains(name){ return classes.has(name); }
        },
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(item=>item!==child); child.parentNode=null; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        querySelector(selector){ return this.querySelectorAll(selector)[0]||null; },
        querySelectorAll(selector){
            const results=[];
            const matches=child=>{
                if(selector.startsWith(".")){ return String(child.className||"").split(/\s+/).includes(selector.slice(1)); }
                if(selector.startsWith("#")){ return child.id===selector.slice(1); }
                return false;
            };
            const visit=current=>current.children.forEach(child=>{ if(matches(child)){ results.push(child); } visit(child); });
            visit(this);
            return results;
        },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}; }
    };
    return node;
}

function loadRuntime(){
    const body=makeNode();
    const cards={};
    const monsters=[{alive:true,hp:100,statusEffects:[{type:"burn",turnsLeft:2}],activeBuffs:[]}];
    const party=[{hp:100,statusEffects:[],activeBuffs:[]}];
    ["battleMonster0","battlePlayerCard0"].forEach((id,index)=>{
        const card=makeNode({left:100+index*140,top:80+index*180,right:220+index*140,bottom:200+index*180,width:120,height:120});
        card.id=id; cards[id]=card; body.appendChild(card);
    });
    const raf=[];
    const document={
        body,
        createElement(){ return makeNode(); },
        getElementById(id){ return cards[id]||null; },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    const context={
        window:null,document,console,Promise,Math,Number,Object,Array,Set,Map,
        Date:{now:()=>0},navigator:{deviceMemory:4,hardwareConcurrency:4},innerWidth:390,innerHeight:844,
        requestAnimationFrame(callback){ raf.push(callback); return raf.length; },
        cancelAnimationFrame(){},setTimeout(){ return 1; },clearTimeout(){},
        monsters,currentBattleMonsters:[0],getPartyCharacterByIndex(index){ return party[index]||null; }
    };
    context.window=context;
    context.FourSymbolsBattlefieldSlots={
        getSlotForCombatant(side,index){ return (side==="monster"?"ENEMY_F":"ALLY_F")+(index+1); },
        getSlotFromElement(element){ return element&&element.id&&element.id.includes("Monster")?"ENEMY_F1":"ALLY_F1"; },
        getSlotRect(){ return {left:100,top:100,right:220,bottom:220,width:120,height:120,centerX:160,centerY:160}; },
        getSlotCenter(){ return {x:160,y:160,rect:this.getSlotRect()}; },
        getSideRect(){ return {left:80,top:80,right:240,bottom:240,width:160,height:160,centerX:160,centerY:160}; }
    };
    context.v142SkillAnimationDirector={
        play(){ return {complete(){},promise:Promise.resolve()}; },
        dispose(){}
    };
    vm.createContext(context);
    vm.runInContext(animation,context);
    return {context,body,cards,monsters,raf};
}

const MIGRATED={
    burn:"fire",rage:"fire",fireSoulResonance:"fire",bloodBurn:"fire",phoenixMight:"fire",
    frostbite:"water",agilityDown:"wind",damageDown:"wind",dodgeSkill:"wind",
    stealthSkill:"wind",dinghaishenzhen:"wind",defenseDown:"earth",shield:"earth",petrify:"earth",
    earthShield:"earth",rockWall:"earth",barrier:"earth"
};

test("the formal registry owns every supplied Front/Back pair and never points migrated states at inbox",()=>{
    const runtime=loadRuntime();
    const registry=runtime.context.window.v143StatusSpriteManifest;
    assert.deepEqual(Object.keys(MIGRATED).sort(),Object.keys(registry).filter(type=>registry[type].layers).sort());
    Object.keys(MIGRATED).forEach(type=>{
        const spec=registry[type];
        assert.match(spec.src,/\.webp\?v=174-front-back-webp$/,type);
        assert.match(spec.layers.front,/\.webp\?v=174-front-back-webp$/,type);
        assert.match(spec.layers.back,/\.webp\?v=174-front-back-webp$/,type);
        assert.doesNotMatch(spec.src,/assets\/inbox|\.png/i,type);
    });
    assert.doesNotMatch(animation,/assets\/inbox\//);
    assert.match(index,/焚血訣 技能釋放\.png/);
    assert.equal((index.match(/\| `assets\/vfx\/status\//g)||[]).length,34);
});

test("a paired status creates one Back and one Front node driven by one RAF",()=>{
    const runtime=loadRuntime();
    runtime.context.window.v143SyncStatusSpriteEffects();
    const card=runtime.cards.battleMonster0;
    const front=card.querySelector(".v153-status-vfx-burn");
    const back=card.querySelector(".v153-status-vfx-back-burn");
    assert.ok(front&&back);
    assert.equal(front.dataset.statusLayer,"front");
    assert.equal(back.dataset.statusLayer,"back");
    assert.equal(runtime.raf.length,1,"Front and Back share one animation clock");
    runtime.context.window.v143SyncStatusSpriteEffects();
    assert.equal(card.querySelectorAll(".v153-status-vfx-burn").length,1,"refresh does not duplicate Front");
    assert.equal(card.querySelectorAll(".v153-status-vfx-back-burn").length,1,"refresh does not duplicate Back");
    const tick=runtime.raf.shift();
    tick(1000);
    assert.equal(front.style.backgroundPosition,back.style.backgroundPosition);
    assert.equal(front.dataset.frame,back.dataset.frame);
    assert.equal(front.dataset.loopProgress,back.dataset.loopProgress);
});

test("paired status removal clears both layers and the global clock record",()=>{
    const runtime=loadRuntime();
    runtime.context.window.v143SyncStatusSpriteEffects();
    runtime.monsters[0].statusEffects[0].turnsLeft=0;
    runtime.context.v143SyncStatusSpriteEffects();
    assert.equal(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-burn"),null);
    assert.equal(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-back-burn"),null);
    assert.equal(runtime.body.querySelectorAll(".v153-status-vfx").length,0);
    assert.equal(runtime.body.querySelectorAll(".v153-status-vfx-back").length,0);
});

test("the three new cast sheets are formal 4x3 WebP assets",()=>{
    const runtime=loadRuntime();
    [
        ["bloodBurnArt","assets/vfx/fire/blood-burn-cast.webp"],
        ["fireSoulResonance","assets/vfx/fire/fire-soul-resonance-cast.webp"],
        ["purifyMind","assets/vfx/water/purify-mind-cast.webp"]
    ].forEach(([id,path])=>{
        const sprite=runtime.context.window.v143SkillAnimationManifest[id].sprite;
        assert.equal(sprite.src.split("?")[0],path,id);
        assert.deepEqual([sprite.columns,sprite.rows,sprite.frames],[4,3,12],id);
        assert.match(sprite.src,/\.webp\?v=174-front-back-webp$/,id);
    });
});

console.log(`\n${passed} V174 Front/Back status VFX tests passed.`);
