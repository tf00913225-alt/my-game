"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const legacyEarth=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
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
    defenseDown:{runtimeFile:"defense-down-icon.webp",mode:"icon",collection:"statusEffects"},
    shield:{runtimeFile:"shield.webp",mode:"static",collection:"activeBuffs"},
    petrify:{runtimeFile:"petrify.webp",mode:"static",collection:"statusEffects"},
    earthShield:{runtimeFile:"earth-shield.webp",mode:"static",collection:"activeBuffs"},
    rockWall:{runtimeFile:"rock-wall.webp",mode:"static",collection:"activeBuffs"},
    barrier:{runtimeFile:"barrier.webp",mode:"static",collection:"activeBuffs"},
    yuanZuBlessing:{runtimeFile:"yuan-zu-blessing.webp",mode:"pulse",collection:"activeBuffs",statusName:"元祖賜福"}
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

test("persistent states use the formal runtime WebP assets",()=>{
    Object.entries(STATUSES).forEach(([type,spec])=>{
        if(spec.mode==="icon"){
            assert.equal(spec.runtimeFile,"defense-down-icon.webp",type);
            return;
        }
        const runtimePath="assets/vfx/status/"+spec.runtimeFile;
        assert.ok(fs.existsSync(runtimePath),runtimePath);
        assert.ok(fs.statSync(runtimePath).size>0,runtimePath+" must not be empty");
    });
});

test("all casts use DOM Sprite Sheets, frame seven impact and the requested placement/timing",()=>{
    const runtime=statusRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    Object.entries(CASTS).forEach(([id,spec])=>{
        const model=manifest[id];
        assert.ok(model&&model.sprite,id);
        assert.equal(model.sprite.src,spec.file+"?v=173.39",id);
        assert.deepEqual(Array.from([
            model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame
        ]),[4,3,12,7],id);
        assert.equal(model.sprite.renderer,"dom-sprite",id);
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
    assert.match(animation,/owner\.getGeometryRectFromShape\(current\.targetSide,primarySlot,shape\)/);
    assert.match(animation,/const bounds=geometryBounds\(current,indexes,placement\)/);
    assert.match(animation,/const destination=bounds\.centerOnBounds&&placement!=="trajectory"[\s\S]*?\?\{x:bounds\.centerX,y:bounds\.centerY\}[\s\S]*?:primaryAnchor[\s\S]*?\?\{x:primaryAnchor\.x,y:primaryAnchor\.y\}/);
});

test("earth and light persistent states use low-motion modes without a frame clock",()=>{
    const runtime=statusRuntime();
    const manifest=runtime.context.v143StatusVisualManifest;
    Object.entries(STATUSES).forEach(([type,spec])=>{
        const model=manifest[type];
        assert.ok(model,type);
        assert.equal(model.mode,spec.mode,type);
        assert.equal(model.renderer,"dom-status-visual",type);
        assert.equal(model.collection,spec.collection,type);
        assert.deepEqual(Array.from([model.cropColumns,model.cropRows]),[1,1],type);
        assert.equal(model.src,spec.mode==="icon"?"":"assets/vfx/status/"+spec.runtimeFile,type);
        assert.equal(model.frames,undefined,type+" has no persistent frame loop");
        assert.equal(model.duration,undefined,type+" has no persistent frame clock");
        if(spec.statusName){ assert.equal(model.statusName,spec.statusName,type); }
        assert.equal(model.cellAspect,undefined,type+" uses a single contained image");
    });
    assert.match(animation,/node\.style\.backgroundSize="contain"/);
    assert.doesNotMatch(animation,/drawImage\(|getContext\(|canvas-crop/);
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
    runtime.context.v143SyncStatusVisualEffects();
    assert.ok(runtime.cards.battleMonster0.querySelector(".v143-status-icon-defenseDown"));
    assert.ok(runtime.cards.battleMonster0.querySelector(".v143-status-visual-petrify"));
    assert.ok(runtime.cards.battlePlayerCard0.querySelector(".v143-status-visual-shield"));
    assert.ok(runtime.cards.battlePlayerCard1.querySelector(".v143-status-visual-earthShield"));
    assert.ok(runtime.cards.battlePlayerCard2.querySelector(".v143-status-visual-rockWall"));
    assert.ok(runtime.cards.battleMonster1.querySelector(".v143-status-visual-barrier"));
    assert.ok(runtime.cards.battleMonster2.querySelector(".v143-status-visual-yuanZuBlessing"));
    assert.equal(runtime.cards.battleMonster0.querySelector(".v143-status-visual-petrify").dataset.statusMode,"static");
    assert.equal(runtime.cards.battleMonster0.querySelector(".v143-status-visual-petrify").dataset.statusLayer,"hard-control-base");
    assert.equal(runtime.cards.battlePlayerCard1.querySelector(".v143-status-visual-earthShield").dataset.statusMode,"static");
    assert.equal(runtime.cards.battlePlayerCard1.querySelector(".v143-status-visual-earthShield").dataset.statusLayer,"rotating");
    assert.equal(runtime.cards.battleMonster2.querySelector(".v143-status-visual-yuanZuBlessing").dataset.statusMode,"pulse");
});

test("Freeze stays fixed while ordinary body statuses rotate in strict two-second order",()=>{
    const runtime=statusRuntime();
    const monster=runtime.monsters[0];
    monster.statusEffects.push({type:"freeze",turnsLeft:3});
    monster.statusEffects.push({type:"burn",turnsLeft:3,percent:3});
    monster.activeBuffs.push({type:"rage",turnsLeft:3});

    runtime.context.v143SyncStatusVisualEffects(false);
    let card=runtime.cards.battleMonster0;
    assert.ok(card.querySelector(".v143-status-visual-freeze"),"Freeze base cover must render immediately");
    assert.ok(card.querySelector(".v143-status-visual-burn"),"first rotating status renders immediately");
    assert.equal(card.querySelector(".v143-status-visual-rage"),null);
    assert.equal(card.querySelector(".v143-status-visual-freeze").dataset.statusLayer,"hard-control-base");

    runtime.context.v143SyncStatusVisualEffects(true);
    assert.ok(card.querySelector(".v143-status-visual-freeze"),"Freeze must survive rotation advance");
    assert.equal(card.querySelector(".v143-status-visual-burn"),null);
    assert.ok(card.querySelector(".v143-status-visual-rage"),"second rotating status follows first");

    runtime.context.v143SyncStatusVisualEffects(true);
    assert.ok(card.querySelector(".v143-status-visual-freeze"),"Freeze remains continuous with no blank period");
    assert.ok(card.querySelector(".v143-status-visual-burn"),"rotation wraps back to first status");
    assert.equal(card.querySelector(".v143-status-visual-rage"),null);

    monster.hp=0;
    monster.alive=false;
    runtime.context.v143SyncStatusVisualEffects(false);
    assert.equal(card.querySelector(".v143-status-visual-freeze"),null,"death removes base cover immediately");

    monster.hp=100;
    monster.alive=true;
    monster.statusEffects=[{type:"petrify",turnsLeft:2}];
    monster.activeBuffs=[];
    runtime.context.v143SyncStatusVisualEffects(false);
    assert.ok(card.querySelector(".v143-status-visual-petrify"),"Petrify base cover renders without waiting for rotation");
    monster.statusEffects=[];
    runtime.context.v143SyncStatusVisualEffects(false);
    assert.equal(card.querySelector(".v143-status-visual-petrify"),null,"formal removal clears base cover immediately");
});

test("rock shield on the attacking caster is deferred until its cast sheet finishes",()=>{
    assert.match(animation,/deferredActorStatusTypes:\["shield"\]/);
    assert.match(animation,/current\.side===side&&current\.actorIndex===index/);
    assert.match(animation,/current\.statusAtStart&&current\.statusAtStart\.has\(side\+":"\+index\+":"\+type\)/);
});

test("Wanxiang uses a fixed image and the old procedural corner effect stays absent",()=>{
    assert.doesNotMatch(legacyEarth,/v143-earth-shield-effect/);
    assert.match(animation,/earthShield:statusVisual\("assets\/vfx\/status\/earth-shield\.webp","static","activeBuffs"/);
});

test("V173.39 cache version loads the new owner code without stale V173.38 browser assets",()=>{
    assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
    assert.ok(index.includes("<title>四象江湖傳 V"+releaseMeta.version+"</title>"));
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
});

console.log("\n"+passed+" V173.39 earth/light Sprite VFX tests passed.");
