"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const vm=require("node:vm");

const slotOwnerSource=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

const CASTS={
    stormFist:{file:"storm-fist-cast.png",duration:1200,placement:"single",status:"agilityDown",size:[1536,1024],hash:"89e7ce2b0b79c75ad3213b71f7a6350a2e9ffd79f66ad3ef671c19a30dfbc3f6"},
    stormFlurry:{file:"storm-flurry-cast.png",duration:1500,placement:"group",status:"damageDown",size:[1448,1086],hash:"3a6268f354f4fb4b2542adf4eb716f639bfba754c63bb1c75ab1548a36df41f9"},
    windCrossSlash:{file:"wind-cross-slash-cast.png",duration:1700,placement:"single",status:"damageDown",size:[1448,1086],hash:"b60928d85d758321bc147d0ea68b7f6de89875d83512a6a614063cb4e5e68d0a"},
    dizzyFist:{file:"dizzy-fist-cast.png",duration:1800,placement:"single",status:"stun",size:[1448,1086],hash:"e2e7142956c54b8d8f8e3a1c7b8a2b9a4896b527df42b64cd1923cec6ed8c453"},
    windSpell:{file:"wind-spell-cast.png",duration:1400,placement:"group",status:"agilityDown",size:[1448,1086],hash:"84679f1561dfa36f47f3efc805e4c5f082a7808c54b987946d09b4155fa01973"},
    stormCircle:{file:"storm-circle-cast.png",duration:1600,placement:"group",status:"damageDown",size:[1536,1024],hash:"a9e24871d2ac32cc03e3d76529cf87389dc0d063f4833a074e105fd23953521a"},
    windHowlLightning:{file:"wind-howl-lightning-cast.png",duration:1900,placement:"single",status:"damageDown",size:[1448,1086],hash:"6593627d59d8330cd756d2b21123f662fa8e472b08111c37938f49aaa17a7a36"},
    stormRain:{file:"storm-rain-cast.png",duration:2600,placement:"battlefield",status:"stun",size:[1448,1086],hash:"da41b91ae4bdd5540f3b0288240f89aef7ab8791f383318d01c993979d08668c"},
    dodgeSkill:{file:"dodge-skill-cast.png",duration:1600,placement:"group",status:"dodgeSkill",size:[1448,1086],hash:"6bc6caf956b211295901bf17d191f0773117ef34672763df75296edf62549a88"},
    stealthSkill:{file:"stealth-skill-cast.png",duration:1700,placement:"single",status:"stealthSkill",size:[1448,1086],hash:"d0d45604e25455a8a66823c547b94b7114e80d20159e131c90cee65b2fab0ee9"},
    dinghaishenzhen:{file:"dinghaishenzhen-cast.png",duration:2200,placement:"battlefield",status:"dinghaishenzhen",size:[1448,1086],hash:"a5318a3a4dea702203b30cb06221df086004caacc2aa8162fe17076195f535b7"}
};

const STATUSES={
    agilityDown:{file:"agility-down-loop.png",duration:1000,collection:"statusEffects",hash:"fb1b42d3c0c87ab4e93b4fd495657852268cb15e9234bfefdeb2edf0546e7d7a"},
    damageDown:{file:"damage-down-loop.png",duration:1100,collection:"statusEffects",hash:"25e984ef5973616bc6f37cfc5842d445ff484f981a98902894febca59a92ae34"},
    stun:{file:"stun-loop.png",duration:900,collection:"statusEffects",hash:"45903df26e32ddc265d45217639211bb9966fb69b3a02389f07afa0500d53071"},
    dodgeSkill:{file:"dodge-skill-loop.png",duration:850,collection:"activeBuffs",hash:"397338dc6fc01967de860e285c1f65febe5248f0a111c01f789dfb676c141c5b"},
    stealthSkill:{file:"stealth-skill-loop.png",duration:1200,collection:"activeBuffs",hash:"58523f3066068e2d7a784c309fe072c3cbb92361a0d703ed8b4d9b1da4a0a02b"},
    dinghaishenzhen:{file:"dinghaishenzhen-loop.png",duration:1200,collection:"activeBuffs",hash:"3607d280f4ff4092d80b8ead216e410425815a4996b22437af556bf28673f31b"}
};

function pngInfo(path){
    const file=fs.readFileSync(path);
    assert.equal(file.subarray(0,8).toString("hex"),"89504e470d0a1a0a",path);
    assert.equal(file.toString("ascii",12,16),"IHDR",path);
    return {size:[file.readUInt32BE(16),file.readUInt32BE(20)],hash:crypto.createHash("sha256").update(file).digest("hex")};
}

function makeNode(rect){
    const classes=new Set();
    const node={
        id:"",className:"",dataset:{},children:[],parentNode:null,offsetParent:{},
        style:{setProperty(name,value){ this[name]=String(value); },getPropertyValue(name){ return this[name]||""; },removeProperty(name){ delete this[name]; }},
        classList:{add(...names){ names.forEach(name=>classes.add(name)); },remove(...names){ names.forEach(name=>classes.delete(name)); },contains(name){ return classes.has(name); }},
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(candidate=>candidate!==child); child.parentNode=null; return child; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}; },
        querySelector(selector){ return this.querySelectorAll(selector)[0]||null; },
        querySelectorAll(selector){
            const results=[];
            const match=candidate=>selector.startsWith("#")?candidate.id===selector.slice(1):(selector.startsWith(".")&&String(candidate.className||"").split(/\s+/).includes(selector.slice(1)));
            const visit=current=>current.children.forEach(child=>{ if(match(child)){ results.push(child); } visit(child); });
            visit(this);
            return results;
        }
    };
    return node;
}

function loadRuntime(options={}){
    let clock=0;
    let timerId=0;
    let imageCount=0;
    const scheduled=[];
    const raf=[];
    const drawCalls=[];
    const monsterHits=[];
    const playerHits=[];
    const cardEffects=[];
    const body=makeNode();
    const monsterArea=makeNode({left:260,top:40,right:700,bottom:300,width:440,height:260});
    monsterArea.id="battleMonsterArea";
    const playerArea=makeNode({left:20,top:340,right:460,bottom:500,width:440,height:160});
    playerArea.id="battlePlayerRow";
    body.appendChild(monsterArea);
    body.appendChild(playerArea);
    const cards={battleMonsterArea:monsterArea,battlePlayerRow:playerArea};
    const monsterRects=[{left:300,top:90,right:376,bottom:190,width:76,height:100},{left:420,top:90,right:496,bottom:190,width:76,height:100},{left:540,top:90,right:616,bottom:190,width:76,height:100}];
    const playerRects=[{left:40,top:360,right:158,bottom:476,width:118,height:116},{left:180,top:360,right:298,bottom:476,width:118,height:116},{left:320,top:360,right:438,bottom:476,width:118,height:116}];
    monsterRects.forEach((rect,index)=>{ const card=makeNode(rect); card.id="battleMonster"+index; cards[card.id]=card; monsterArea.appendChild(card); });
    playerRects.forEach((rect,index)=>{ const card=makeNode(rect); card.id="battlePlayerCard"+index; cards[card.id]=card; playerArea.appendChild(card); });

    const fixedSlots={};
    ["B","F"].forEach((row,rowIndex)=>{
        for(let column=1;column<=5;column++){
            const slot="ENEMY_"+row+column;
            const left=260+(column-1)*91;
            const top=rowIndex===0?40:210;
            const node=makeNode({left,top,right:left+76,bottom:top+100,width:76,height:100});
            node.dataset.slot=slot; node.className="v-fixed-enemy-slot";
            fixedSlots['.v-fixed-enemy-slot[data-slot="'+slot+'"]']=node;
        }
    });
    ["F","B"].forEach((row,rowIndex)=>{
        for(let column=1;column<=3;column++){
            const slot="ALLY_"+row+column;
            const left=20+(column-1)*140;
            const top=rowIndex===0?340:485;
            const node=makeNode({left,top,right:left+118,bottom:top+116,width:118,height:116});
            node.dataset.slot=slot; node.className="v-fixed-ally-slot";
            fixedSlots['.v-fixed-ally-slot[data-slot="'+slot+'"]']=node;
        }
    });

    const monsters=options.monsters||monsterRects.map(()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const party=options.party||playerRects.map(()=>({hp:100,statusEffects:[],activeBuffs:[]}));
    const sourceSizes=new Map(Object.values(CASTS).map(spec=>[spec.file,spec.size]).concat(Object.values(STATUSES).map(spec=>[spec.file,[1774,887]])));
    class FakeImage{
        constructor(){ imageCount++; this.complete=false; this.naturalWidth=0; this.naturalHeight=0; }
        set src(value){
            this._src=value;
            const filename=decodeURI(String(value).split("/").pop().split("?")[0]);
            const size=sourceSizes.get(filename)||[1536,1152];
            this.naturalWidth=size[0]; this.naturalHeight=size[1]; this.complete=true;
            if(this.onload){ this.onload(); }
        }
        get src(){ return this._src; }
    }
    const document={
        body,
        createElement(tag){
            const node=makeNode();
            if(tag==="canvas"){
                const context={clearRect(){},drawImage(...args){ drawCalls.push({node,args}); }};
                node.getContext=()=>context;
            }
            return node;
        },
        getElementById(id){ return cards[id]||null; },
        querySelector(selector){ return fixedSlots[selector]||body.querySelector(selector); },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    const context={
        window:null,document,console,Promise,Math,Number,Object,Array,Set,Map,Image:FakeImage,
        Date:{now:()=>clock},innerWidth:960,innerHeight:720,navigator:{deviceMemory:4,hardwareConcurrency:4},
        requestAnimationFrame(callback){ raf.push(callback); return raf.length; },cancelAnimationFrame(){},
        setTimeout(callback,delay){ const id=++timerId; scheduled.push({id,callback,delay}); return id; },clearTimeout(){},
        monsters,currentBattleMonsters:[0,1,2],queuedPlayerActions:{0:{target:1,targetAlly:1}},
        getSkillTargets(center,targetType){
            const living=[0,1,2].filter(index=>monsters[index]&&monsters[index].alive!==false&&monsters[index].hp>0);
            if(targetType==="all"){ return living; }
            if(targetType==="tri"||targetType==="row"){ return living; }
            return living.includes(center)?[center]:[];
        },
        v138GetFormationRows(){ return [[0,1,2],[]]; },getPartyCharacterByIndex(index){ return party[index]||null; },
        showMonsterHit(){ monsterHits.push(Array.from(arguments)); },showPlayerHit(){ playerHits.push(Array.from(arguments)); },
        v141PlayCardEffect(){ cardEffects.push(Array.from(arguments)); },
        applyMonsterDebuff(entity,type,duration,value){
            entity.statusEffects=entity.statusEffects||[];
            if(entity.statusEffects.some(effect=>effect.type===type&&effect.turnsLeft>0)){ return false; }
            entity.statusEffects.push({type,turnsLeft:duration,value});
            return true;
        },
        updateUI(){},updateMonsterUI(){},killMonster(index){ if(monsters[index]){ monsters[index].alive=false; } }
    };
    context.window=context;
    context.v142SkillAnimationDirector={play(config){ let resolve; const gate={done:false,reason:null,config,promise:new Promise(done=>{ resolve=done; })}; gate.complete=reason=>{ if(gate.done){ return false; } gate.done=true; gate.reason=reason; resolve(gate); return true; }; return gate; },dispose(){}};
    vm.createContext(context);
    vm.runInContext(slotOwnerSource,context,{filename:"js/battlefield-slot-owner.js"});
    const owner=context.FourSymbolsBattlefieldSlots;
    owner.setActiveEnemySnapshot(owner.createEnemyFormationSnapshot([0,1,2],{originalFormationType:3}));
    owner.hydrateAllyFormation(null,[0,1,2]);
    vm.runInContext(animation,context,{filename:"js/39-v143-skill-animation.js"});
    return {
        context,body,cards,monsters,party,scheduled,raf,drawCalls,monsterHits,playerHits,cardEffects,owner,
        setClock(value){ clock=value; },imageCount(){ return imageCount; },
        tick(value){ clock=value; const callback=raf.shift(); assert.ok(callback,"scheduled Canvas frame"); callback(); }
    };
}

function config(id,targetType,category){ const duration=CASTS[id].duration; return {id,name:id,element:"wind",category:category||"magic",targetType,duration,resolveDuration:duration}; }
function stageSprites(runtime){ const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage"); assert.ok(stage,"skill stage"); return {stage,sprites:stage.children.filter(node=>String(node.className).includes("v143-vfx-sprite"))}; }
function runTimers(runtime,delay){ runtime.scheduled.filter(timer=>Math.abs(timer.delay-delay)<2).forEach(timer=>timer.callback()); }
function slotCenter(runtime,side,index){ const slot=runtime.owner.getSlotForCombatant(side,index); const center=runtime.owner.getSlotCenter(slot); assert.ok(slot&&center,side+":"+index+" formal Slot center"); return {slot,center}; }
function triBounds(runtime,side){ const centerSlot=runtime.owner.getSlotForCombatant(side,1); const bounds=runtime.owner.getGeometryRectFromShape(side,centerSlot,"tri"); assert.ok(centerSlot&&bounds,side+" formal tri bounds"); return bounds; }
function sideBounds(runtime,side){ const bounds=runtime.owner.getSideRect(side); assert.ok(bounds,side+" formal side bounds"); return bounds; }

test("the supplied wind PNG files remain byte-identical and keep their actual source dimensions",()=>{
    Object.values(CASTS).forEach(spec=>{ const info=pngInfo("assets/vfx/wind/"+spec.file); assert.deepEqual(info.size,spec.size,spec.file); assert.equal(info.hash,spec.hash,spec.file); });
    Object.values(STATUSES).forEach(spec=>{ const info=pngInfo("assets/vfx/wind/"+spec.file); assert.deepEqual(info.size,[1774,887],spec.file); assert.equal(info.hash,spec.hash,spec.file); });
});

test("all eleven casts and six loops use the requested mapping, timing and shared Sprite renderer",()=>{
    const runtime=loadRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    Object.entries(CASTS).forEach(([id,spec])=>{
        const model=manifest[id];
        assert.ok(model&&model.sprite,id);
        assert.equal(model.sprite.src,"assets/vfx/wind/"+spec.file+"?v=173.24",id);
        assert.deepEqual(Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame]),[4,3,12,7],id);
        assert.equal(model.sprite.placement,spec.placement,id);
        assert.equal(model.sprite.renderer,"dom-sprite",id);
        assert.equal(model.hit,.5,id+" seventh-frame hit");
        assert.deepEqual(Array.from(model.deferredStatusTypes),[spec.status],id);
        assert.match(timing,new RegExp(id+":\\["+spec.duration+"(?:,|\\])"),id+" duration");
    });
    const statuses=runtime.context.v143StatusSpriteManifest;
    Object.entries(STATUSES).forEach(([type,spec])=>{
        const sprite=statuses[type];
        assert.equal(sprite.src,"assets/vfx/wind/"+spec.file+"?v=173.24",type);
        assert.deepEqual(Array.from([sprite.columns,sprite.rows,sprite.frames]),[4,2,8],type);
        assert.equal(sprite.renderer,"dom-sprite",type);
        assert.equal(sprite.duration,spec.duration,type);
        assert.equal(sprite.collection,spec.collection,type);
    });
});

test("Wind single-target cast uses the formal target Slot and never the legacy card bounds",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(config("stormFist","single","physical"),{side:"player",actorIndex:0,targetId:2});
    const {stage,sprites}=stageSprites(runtime);
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.renderer,"dom-sprite");
    assert.equal(sprite.dataset.targetIndex,"2");
    const target=slotCenter(runtime,"monster",2);
    assert.equal(sprite.dataset.geometrySlot,target.slot);
    assert.equal(sprite.style.left,target.center.x+"px");
    assert.equal(sprite.style.top,target.center.y+"px");
    const cardRect=runtime.cards.battleMonster2.getBoundingClientRect();
    assert.notEqual(target.center.x,cardRect.left+cardRect.width/2,"fixture card X must differ from formal Slot X");
    assert.notEqual(target.center.y,cardRect.top+cardRect.height/2,"fixture card Y must differ from formal Slot Y");
    assert.match(sprite.style.backgroundImage,/storm-fist-cast\.png\?v=173\.24/);
    assert.equal(stage.children.length,1,"no procedural charge, flight, field or hit node");
    assert.equal(runtime.drawCalls.length,0,"DOM Sprite renderer must never call Canvas drawImage");
});

test("single, formal tri and battlefield casts each own one correctly positioned sheet",()=>{
    const group=loadRuntime();
    group.context.v142SkillAnimationDirector.play(config("stormFlurry","tri","physical"),{side:"player",actorIndex:0,targetId:1,targetIds:[0,1,2]});
    [0,1,2].forEach(index=>group.context.showMonsterHit(index,10,"hp"));
    const groupSprites=stageSprites(group).sprites;
    assert.equal(groupSprites.length,1,"one three-lane sheet, not nine effects");
    const groupSprite=groupSprites[0];
    assert.equal(groupSprite.dataset.placement,"group");
    assert.equal(groupSprite.dataset.targetIndexes,"0,1,2");
    const tri=triBounds(group,"monster");
    assert.equal(groupSprite.dataset.geometrySlots,tri.slots.join(","));
    assert.equal(groupSprite.style.left,tri.centerX+"px");
    assert.equal(groupSprite.style.top,tri.centerY+"px");

    const all=loadRuntime();
    all.context.v142SkillAnimationDirector.play(config("stormRain","all","magic"),{side:"player",actorIndex:0});
    const allSprites=stageSprites(all).sprites;
    assert.equal(allSprites.length,1,"one battlefield sheet");
    const allSprite=allSprites[0];
    const side=sideBounds(all,"monster");
    assert.equal(allSprite.dataset.placement,"battlefield");
    assert.equal(allSprite.dataset.areaId,"fixed-enemy-zone");
    assert.equal(allSprite.dataset.geometrySlots,side.slots.join(","));
    assert.equal(allSprite.dataset.targetIndexes,"0,1,2");
    assert.equal(allSprite.style.left,side.centerX+"px");
    assert.equal(allSprite.style.top,side.centerY+"px");
});

test("three-target wind sheets keep the formal three-Slot footprint after casualties",()=>{
    const placements=[];
    [
        [{alive:true,hp:100,statusEffects:[],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]}],
        [{alive:false,hp:0,statusEffects:[],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]},{alive:false,hp:0,statusEffects:[],activeBuffs:[]}]
    ].forEach(monsters=>{
        const runtime=loadRuntime({monsters});
        runtime.context.v142SkillAnimationDirector.play(config("stormFlurry","tri","physical"),{side:"player",actorIndex:0});
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        const bounds=triBounds(runtime,"monster");
        assert.equal(sprite.dataset.placement,"group");
        assert.equal(sprite.dataset.geometrySlots,bounds.slots.join(","));
        assert.equal(sprite.style.left,bounds.centerX+"px","formal middle Slot remains the visual centre");
        assert.equal(sprite.style.top,bounds.centerY+"px");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"casualties do not shrink or move the formal three-Slot sheet");
});

test("full-field wind sheets stay locked to the complete formal enemy side after casualties",()=>{
    const placements=[];
    [undefined,[{alive:false,hp:0,statusEffects:[],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]},{alive:false,hp:0,statusEffects:[],activeBuffs:[]}]].forEach(monsters=>{
        const runtime=loadRuntime(monsters?{monsters}:{});
        runtime.context.v142SkillAnimationDirector.play(config("stormRain","all","magic"),{side:"player",actorIndex:0});
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        const bounds=sideBounds(runtime,"monster");
        assert.equal(sprite.dataset.areaId,"fixed-enemy-zone");
        assert.equal(sprite.dataset.geometrySlots,bounds.slots.join(","));
        assert.equal(sprite.style.left,bounds.centerX+"px");
        assert.equal(sprite.style.top,bounds.centerY+"px");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"full-field VFX does not follow survivor/card bounds");
});

test("enemy casts discover the real player target on its formal Slot instead of a fixed faction/card position",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(config("stormFist","single","physical"),{side:"monster",actorIndex:0});
    assert.equal(stageSprites(runtime).sprites.length,0,"no guessed player target");
    runtime.context.showPlayerHit(20,"hp",1);
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    const target=slotCenter(runtime,"player",1);
    assert.equal(sprite.dataset.targetSide,"player");
    assert.equal(sprite.dataset.targetIndex,"1");
    assert.equal(sprite.dataset.geometrySlot,target.slot);
    assert.equal(sprite.style.left,target.center.x+"px");
    assert.equal(sprite.style.top,target.center.y+"px");
});

test("frame seven releases resolved attack results once, while buffs never shake or show damage",()=>{
    const attack=loadRuntime();
    attack.context.v142SkillAnimationDirector.play(config("stormFist","single","physical"),{side:"player",actorIndex:0,targetId:2});
    attack.context.showMonsterHit(2,33,"hp");
    assert.equal(attack.monsterHits.length,0);
    attack.setClock(600);
    runTimers(attack,600);
    assert.equal(attack.monsterHits.length,1,"damage result appears once at frame seven");
    assert.equal(attack.cards.battleMonster2.classList.contains("v143-impact-target"),false,"raster owner must not recreate the retired procedural impact class");

    const buff=loadRuntime();
    buff.context.v142SkillAnimationDirector.play(config("dodgeSkill","allyAll","buff"),{side:"player",actorIndex:0});
    buff.party.forEach(character=>character.activeBuffs.push({type:"dodgeSkill",turnsLeft:2}));
    [0,1,2].forEach(index=>buff.context.v141PlayCardEffect("player",index,"buff"));
    buff.setClock(800);
    runTimers(buff,800);
    const buffSprites=stageSprites(buff).sprites;
    assert.equal(buffSprites.length,1,"one shared three-position buff sheet");
    const allySide=sideBounds(buff,"player");
    assert.equal(buffSprites[0].dataset.geometrySlots,allySide.slots.join(","),"allyAll geometry comes from the full formal ally side");
    assert.equal(buff.monsterHits.length,0);
    assert.equal(buff.playerHits.length,0);
    [0,1,2].forEach(index=>{
        assert.equal(buff.cards["battlePlayerCard"+index].classList.contains("v143-impact-target"),false);
        assert.equal(buff.cards["battlePlayerCard"+index].classList.contains("v146-area-impact"),false);
    });
});

test("status loops start only on success, stay anchored to formal Slots, never restart on duplicate MISS, and clear with lifecycle",()=>{
    const applied=loadRuntime();
    applied.context.v142SkillAnimationDirector.play(config("stormFist","single","physical"),{side:"player",actorIndex:0,targetId:0});
    assert.equal(applied.context.applyMonsterDebuff(applied.monsters[0],"agilityDown",2,15),true);
    assert.equal(applied.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),null,"loop waits for cast completion");
    applied.setClock(1200);
    runTimers(applied,1200);
    const gravity=applied.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown");
    assert.ok(gravity,"successful status starts its loop");
    assert.equal(gravity.dataset.slot,applied.owner.getSlotForCombatant("monster",0));
    assert.ok(gravity.style.backgroundImage.includes("agility-down-loop.png?v=173.24"));
    assert.equal(gravity.style["--v153-status-duration"],"1000ms");

    applied.monsters[0].statusEffects.push({type:"damageDown",turnsLeft:1});
    applied.context.v143SyncStatusSpriteEffects();
    const damageDown=applied.cards.battleMonster0.querySelector(".v153-status-vfx-damageDown");
    assert.ok(damageDown,"different states may coexist");
    assert.equal(damageDown.dataset.slot,applied.owner.getSlotForCombatant("monster",0));
    applied.monsters[0].statusEffects.forEach(effect=>{ effect.turnsLeft=0; });
    applied.context.updateUI();
    assert.equal(applied.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),null,"expired loop clears");
    assert.equal(applied.cards.battleMonster0.querySelector(".v153-status-vfx-damageDown"),null,"all expired loops clear");

    const duplicate=loadRuntime({monsters:[{alive:true,hp:100,statusEffects:[{type:"agilityDown",turnsLeft:2}],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]}]});
    duplicate.context.v143SyncStatusSpriteEffects();
    const existing=duplicate.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown");
    assert.equal(existing.dataset.slot,duplicate.owner.getSlotForCombatant("monster",0));
    duplicate.context.v142SkillAnimationDirector.play(config("stormFist","single","physical"),{side:"player",actorIndex:0,targetId:0});
    assert.equal(duplicate.context.applyMonsterDebuff(duplicate.monsters[0],"agilityDown",2,15),false);
    assert.strictEqual(duplicate.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),existing,"duplicate MISS preserves the same node");
    duplicate.setClock(1200);
    runTimers(duplicate,1200);
    assert.strictEqual(duplicate.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),existing,"completion does not restart it");
    duplicate.monsters[0].hp=0;
    duplicate.monsters[0].alive=false;
    duplicate.context.updateUI();
    assert.equal(duplicate.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),null,"death clears the loop");

    applied.party[1].activeBuffs.push({type:"stealthSkill",turnsLeft:2});
    applied.context.v143SyncStatusSpriteEffects();
    const stealth=applied.cards.battlePlayerCard1.querySelector(".v153-status-vfx-stealthSkill");
    assert.ok(stealth);
    assert.equal(stealth.dataset.slot,applied.owner.getSlotForCombatant("player",1));
    applied.context.v142SkillAnimationDirector.dispose();
    assert.equal(applied.body.querySelectorAll(".v153-status-vfx").length,0,"battle disposal clears every loop");
});

test("wind sheets replace procedural wind effects and keep noninteractive status layering",()=>{
    assert.doesNotMatch(css,/data-skill="windCrossSlash"/);
    assert.doesNotMatch(css,/data-skill="stormRain"/);
    assert.match(css,/#game-stage #battlePage \.v153-status-vfx\{[\s\S]*?z-index:4;[\s\S]*?pointer-events:none;/);
    assert.match(css,/@keyframes v143StatusRasterFrames\{[\s\S]*?87\.5%,100%\{background-position:100% 100%\}/);
    assert.match(animation,/node\.dataset\.renderer="dom-sprite";/);
    assert.match(animation,/node\.style\.backgroundSize=\(spec\.columns\*100\)\+"% "\+\(spec\.rows\*100\)\+"%";/);
    assert.doesNotMatch(animation,/getSpriteImage|frameX=frameIndex|frameY=Math\.floor/);
    assert.doesNotMatch(animation,/assets\/inbox\/[\s\S]{0,80}(?:base64|blob:)/i);
});

test("the development cache release is V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.65"/);
    assert.match(index,/<title>四象江湖傳 V173\.65<\/title>/);
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
});

console.log("\n"+passed+" V173.39 wind Sprite VFX tests passed.");