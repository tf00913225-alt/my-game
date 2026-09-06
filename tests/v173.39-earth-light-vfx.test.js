"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const legacyEarth=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

const CASTS={
    stoneSlash:{file:"assets/vfx/earth/stone-slash-cast.png",duration:1100,placement:"single",status:"defenseDown"},
    petrifyFist:{file:"assets/vfx/earth/petrify-fist-cast.png",duration:1400,placement:"group",actorStatus:"shield"},
    stoneBreakSky:{file:"assets/vfx/earth/stone-break-sky-cast.png",duration:1700,placement:"single",actorStatus:"shield"},
    earthquakeCrush:{file:"assets/vfx/earth/earthquake-crush-cast.png",duration:1800,placement:"group",status:"petrify"},
    stoneThrow:{file:"assets/vfx/earth/stone-throw-cast.png",duration:1300,placement:"group",status:"defenseDown"},
    sandWind:{file:"assets/vfx/earth/sand-wind-cast.png",duration:1500,placement:"group",status:"defenseDown"},
    flyingSandStrike:{file:"assets/vfx/earth/flying-sand-strike-cast.png",duration:2000,placement:"battlefield",status:"defenseDown"},
    dustStorm:{file:"assets/vfx/earth/dust-storm-cast.png",duration:2000,placement:"single",status:"petrify"},
    earthShield:{file:"assets/vfx/earth/earth-shield-cast.png",duration:1800,placement:"group",status:"earthShield"},
    rockWall:{file:"assets/vfx/earth/rock-wall-cast.png",duration:1700,placement:"group",status:"rockWall"},
    barrier:{file:"assets/vfx/earth/barrier-cast.png",duration:1900,placement:"single",status:"barrier"},
    yuanZuBlessing:{file:"assets/vfx/light/yuan-zu-blessing-cast.png",duration:2000,placement:"battlefield",status:"yuanZuBlessing"}
};

const STATUSES={
    defenseDown:{file:"assets/vfx/earth/defense-down-loop.png",duration:1100,collection:"statusEffects"},
    shield:{file:"assets/vfx/earth/rock-shield-loop.png",duration:1200,collection:"activeBuffs"},
    petrify:{file:"assets/vfx/earth/petrify-loop.png",duration:1300,collection:"statusEffects"},
    earthShield:{file:"assets/vfx/earth/earth-shield-loop.png",duration:1000,collection:"activeBuffs"},
    rockWall:{file:"assets/vfx/earth/rock-wall-loop.png",duration:1400,collection:"activeBuffs"},
    barrier:{file:"assets/vfx/earth/barrier-loop.png",duration:1200,collection:"activeBuffs"},
    yuanZuBlessing:{file:"assets/vfx/light/yuan-zu-blessing-loop.png",duration:1200,collection:"activeBuffs",statusName:"元祖賜福"}
};

function pngSize(path){
    const file=fs.readFileSync(path);
    assert.equal(file.subarray(0,8).toString("hex"),"89504e470d0a1a0a",path);
    assert.equal(file.toString("ascii",12,16),"IHDR",path);
    return [file.readUInt32BE(16),file.readUInt32BE(20)];
}

function makeNode(rect){
    const classes=new Set();
    return {
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
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}; },
        querySelector(selector){ return this.querySelectorAll(selector)[0]||null; },
        querySelectorAll(selector){
            const results=[];
            const className=selector.startsWith(".")?selector.slice(1):null;
            const visit=node=>node.children.forEach(child=>{
                if(className&&String(child.className||"").split(/\s+/).includes(className)){ results.push(child); }
                visit(child);
            });
            visit(this);
            return results;
        }
    };
}

function statusRuntime(){
    const body=makeNode();
    const cards={};
    const monsters=Array.from({length:3},()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const party=Array.from({length:3},()=>({hp:100,statusEffects:[],activeBuffs:[]}));
    for(let index=0;index<3;index++){
        const monster=makeNode({left:100+index*100,top:50,width:80,height:100});
        monster.id="battleMonster"+index; cards[monster.id]=monster; body.appendChild(monster);
        const player=makeNode({left:100+index*100,top:300,width:110,height:110});
        player.id="battlePlayerCard"+index; cards[player.id]=player; body.appendChild(player);
    }
    const document={
        body,
        createElement(){ return makeNode(); },
        getElementById(id){ return cards[id]||null; },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    class FakeImage{ set src(value){ this._src=value; this.complete=true; this.naturalWidth=1024; this.naturalHeight=512; if(this.onload){ this.onload(); } } }
    const context={
        window:null,document,Image:FakeImage,console,Promise,Math,Number,Object,Array,Set,Map,
        Date:{now:()=>0},navigator:{deviceMemory:4,hardwareConcurrency:4},innerWidth:960,innerHeight:720,
        setTimeout(){ return 1; },clearTimeout(){},requestAnimationFrame(){ return 1; },cancelAnimationFrame(){},
        monsters,currentBattleMonsters:[0,1,2],getPartyCharacterByIndex:index=>party[index]||null,
        updateUI(){},updateMonsterUI(){},v141PlayCardEffect(){},
        v142SkillAnimationDirector:{
            play(config){
                let resolve;
                const gate={done:false,config,promise:new Promise(done=>{ resolve=done; })};
                gate.complete=reason=>{ if(gate.done){ return false; } gate.done=true; gate.reason=reason; resolve(gate); return true; };
                return gate;
            },
            dispose(){}
        }
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(animation,context);
    return {context,cards,monsters,party};
}

test("earth and Yuan Zu cast sheets keep the supplied production dimensions and natural 4x3 grid",()=>{
    Object.entries(CASTS).forEach(([id,spec])=>{
        const expected=id==="sandWind"?[1536,1024]:[1448,1086];
        assert.deepEqual(pngSize(spec.file),expected,spec.file);
    });
});

test("persistent sheets keep the supplied production dimensions and natural 4x2 grid",()=>{
    Object.entries(STATUSES).forEach(([type,spec])=>{
        const expected=type==="barrier"?[1536,1024]:[1774,887];
        assert.deepEqual(pngSize(spec.file),expected,spec.file);
    });
});

test("all casts use row-major canvas cropping, frame seven impact and the requested placement/timing",()=>{
    const runtime=statusRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    Object.entries(CASTS).forEach(([id,spec])=>{
        const model=manifest[id];
        assert.ok(model&&model.sprite,id);
        assert.equal(model.sprite.src,spec.file+"?v=173.39",id);
        assert.deepEqual(Array.from([
            model.sprite.columns,model.sprite.rows,model.sprite.frames,
            model.sprite.frameWidth,model.sprite.frameHeight,model.sprite.hitFrame
        ]),[4,3,12,384,384,7],id);
        assert.equal(model.sprite.renderer,"canvas-crop",id);
        assert.equal(model.sprite.naturalGrid,true,id);
        assert.equal(model.sprite.placement,spec.placement,id);
        if(id==="sandWind"){ assert.equal(model.sprite.preserveSourceAspect,true,id); }
        assert.equal(model.hit,.5,id);
        assert.match(timing,new RegExp(id+":\\["+spec.duration+"(?:,|\\])"),id+" duration");
        if(spec.status){ assert.deepEqual(Array.from(model.deferredStatusTypes),[spec.status],id); }
        if(spec.actorStatus){ assert.deepEqual(Array.from(model.deferredActorStatusTypes),[spec.actorStatus],id); }
    });
});

test("earth trio sheets opt into fixed slot alignment and full-field earth stays formation-locked",()=>{
    const runtime=statusRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    ["petrifyFist","earthquakeCrush","stoneThrow","sandWind","earthShield","rockWall"].forEach(id=>{
        assert.equal(manifest[id].sprite.placement,"group",id);
        assert.equal(manifest[id].sprite.alignToSlots,true,id);
    });
    assert.equal(manifest.flyingSandStrike.sprite.placement,"battlefield");
    assert.equal(manifest.flyingSandStrike.sprite.targetBounds,undefined);
    assert.match(animation,/function fixedTriLayoutBounds\(current,indexes\)/);
    assert.match(animation,/const coverage=sprite\.alignToSlots\?targetBounds:/);
    assert.match(animation,/sprite\.alignToSlots&&Number\.isFinite\(targetBounds\.centerX\)/);
});

test("all seven persistent effects use 4x2 runtime cropping with the requested loop cadence",()=>{
    const runtime=statusRuntime();
    const manifest=runtime.context.v143StatusSpriteManifest;
    Object.entries(STATUSES).forEach(([type,spec])=>{
        const model=manifest[type];
        assert.ok(model,type);
        assert.equal(model.src,spec.file+"?v=173.39",type);
        assert.deepEqual(Array.from([model.columns,model.rows,model.frames,model.frameWidth,model.frameHeight]),[4,2,8,256,256],type);
        assert.equal(model.duration,spec.duration,type);
        assert.equal(model.collection,spec.collection,type);
        if(spec.statusName){ assert.equal(model.statusName,spec.statusName,type); }
        if(type==="barrier"){ assert.equal(model.cellAspect,.75,type); }
    });
    assert.match(animation,/sprite\.preserveSourceAspect&&sourceWidth>0&&sourceHeight>0/);
    assert.match(animation,/const cellAspect=Math\.max\(\.1,Number\(spec\.cellAspect\)\|\|1\)/);
});

test("persistent earth states and Yuan Zu blessing bind to their real combat state owners",()=>{
    const runtime=statusRuntime();
    runtime.monsters[0].statusEffects.push({type:"defenseDown",turnsLeft:2});
    runtime.monsters[0].statusEffects.push({type:"petrify",turnsLeft:2});
    runtime.party[0].activeBuffs.push({type:"shield",turnsLeft:2,remaining:100});
    runtime.party[1].activeBuffs.push({type:"earthShield",turnsLeft:3,percent:50});
    runtime.party[2].activeBuffs.push({type:"rockWall",turnsLeft:4,percent:35});
    runtime.monsters[1].activeBuffs.push({type:"barrier",turnsLeft:5,remainingBlocks:5});
    runtime.monsters[2].activeBuffs.push({type:"v141TeamBuff",statusName:"元祖賜福",turnsLeft:2});
    runtime.context.v143SyncStatusSpriteEffects();
    assert.ok(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-defenseDown"));
    assert.ok(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-petrify"));
    assert.ok(runtime.cards.battlePlayerCard0.querySelector(".v153-status-vfx-shield"));
    assert.ok(runtime.cards.battlePlayerCard1.querySelector(".v153-status-vfx-earthShield"));
    assert.ok(runtime.cards.battlePlayerCard2.querySelector(".v153-status-vfx-rockWall"));
    assert.ok(runtime.cards.battleMonster1.querySelector(".v153-status-vfx-barrier"));
    assert.ok(runtime.cards.battleMonster2.querySelector(".v153-status-vfx-yuanZuBlessing"));
});

test("rock shield on the attacking caster is deferred until its cast sheet finishes",()=>{
    assert.match(animation,/deferredActorStatusTypes:\["shield"\]/);
    assert.match(animation,/current\.side===side&&current\.actorIndex===index/);
    assert.match(animation,/current\.statusAtStart&&current\.statusAtStart\.has\(side\+":"\+index\+":"\+type\)/);
});

test("the new Wanxiang loop retires the old procedural text/frame effect instead of stacking both",()=>{
    assert.match(legacyEarth,/spriteOwnsEarthShield/);
    assert.match(legacyEarth,/window\.v143StatusSpriteManifest&&window\.v143StatusSpriteManifest\.earthShield/);
    assert.match(legacyEarth,/\(!active\|\|spriteOwnsEarthShield\)&&effect/);
});

test("V173.39 cache version loads the new owner code without stale V173.38 browser assets",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.52"/);
    assert.match(index,/<title>四象江湖傳 V173\.52<\/title>/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.52/);
});

console.log("\n"+passed+" V173.39 earth/light Sprite VFX tests passed.");
