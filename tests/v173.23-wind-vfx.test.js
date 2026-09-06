"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

const CASTS={
    stormFist:{file:"暴風拳-技能動態圖.png",duration:1200,placement:"single",status:"agilityDown",size:[1536,1024],hash:"89e7ce2b0b79c75ad3213b71f7a6350a2e9ffd79f66ad3ef671c19a30dfbc3f6"},
    stormFlurry:{file:"暴風亂擊-技能動態圖.png",duration:1500,placement:"group",status:"damageDown",size:[1448,1086],hash:"3a6268f354f4fb4b2542adf4eb716f639bfba754c63bb1c75ab1548a36df41f9"},
    windCrossSlash:{file:"風旋十字斬-技能動態圖.png",duration:1700,placement:"single",status:"damageDown",size:[1448,1086],hash:"b60928d85d758321bc147d0ea68b7f6de89875d83512a6a614063cb4e5e68d0a"},
    dizzyFist:{file:"暈眩猛擊-技能動態圖.png",duration:1800,placement:"single",status:"stun",size:[1448,1086],hash:"e2e7142956c54b8d8f8e3a1c7b8a2b9a4896b527df42b64cd1923cec6ed8c453"},
    windSpell:{file:"狂風術-技能動態圖.png",duration:1400,placement:"group",status:"agilityDown",size:[1448,1086],hash:"84679f1561dfa36f47f3efc805e4c5f082a7808c54b987946d09b4155fa01973"},
    stormCircle:{file:"風焰術-技能動態圖.png",duration:1600,placement:"group",status:"damageDown",size:[1536,1024],hash:"a9e24871d2ac32cc03e3d76529cf87389dc0d063f4833a074e105fd23953521a"},
    windHowlLightning:{file:"風哮電擊-技能動態圖.png",duration:1900,placement:"single",status:"damageDown",size:[1448,1086],hash:"6593627d59d8330cd756d2b21123f662fa8e472b08111c37938f49aaa17a7a36"},
    stormRain:{file:"風起雲湧-技能動態圖.png",duration:2600,placement:"battlefield",status:"stun",size:[1448,1086],hash:"da41b91ae4bdd5540f3b0288240f89aef7ab8791f383318d01c993979d08668c"},
    dodgeSkill:{file:"閃躲術-技能動態圖.png",duration:1600,placement:"group",status:"dodgeSkill",size:[1448,1086],hash:"6bc6caf956b211295901bf17d191f0773117ef34672763df75296edf62549a88"},
    stealthSkill:{file:"隱身術-技能動態圖.png",duration:1700,placement:"single",status:"stealthSkill",size:[1448,1086],hash:"d0d45604e25455a8a66823c547b94b7114e80d20159e131c90cee65b2fab0ee9"},
    dinghaishenzhen:{file:"氣定神閒-技能動態圖.png",duration:2200,placement:"battlefield",status:"dinghaishenzhen",size:[1448,1086],hash:"a5318a3a4dea702203b30cb06221df086004caacc2aa8162fe17076195f535b7"}
};

const STATUSES={
    agilityDown:{file:"重力-狀態循環圖.png",duration:1000,collection:"statusEffects",hash:"fb1b42d3c0c87ab4e93b4fd495657852268cb15e9234bfefdeb2edf0546e7d7a"},
    damageDown:{file:"殤風-狀態循環圖.png",duration:1100,collection:"statusEffects",hash:"25e984ef5973616bc6f37cfc5842d445ff484f981a98902894febca59a92ae34"},
    stun:{file:"暈眩-狀態循環圖.png",duration:900,collection:"statusEffects",hash:"45903df26e32ddc265d45217639211bb9966fb69b3a02389f07afa0500d53071"},
    dodgeSkill:{file:"風行-狀態循環圖.png",duration:850,collection:"activeBuffs",hash:"397338dc6fc01967de860e285c1f65febe5248f0a111c01f789dfb676c141c5b"},
    stealthSkill:{file:"隱身-狀態循環圖.png",duration:1200,collection:"activeBuffs",hash:"58523f3066068e2d7a784c309fe072c3cbb92361a0d703ed8b4d9b1da4a0a02b"},
    dinghaishenzhen:{file:"氣定神閒-狀態循環圖.png",duration:1200,collection:"activeBuffs",hash:"3607d280f4ff4092d80b8ead216e410425815a4996b22437af556bf28673f31b"}
};

function pngInfo(path){
    const file=fs.readFileSync(path);
    assert.equal(file.subarray(0,8).toString("hex"),"89504e470d0a1a0a",path);
    assert.equal(file.toString("ascii",12,16),"IHDR",path);
    return {
        size:[file.readUInt32BE(16),file.readUInt32BE(20)],
        hash:crypto.createHash("sha256").update(file).digest("hex")
    };
}

function makeNode(rect){
    const classes=new Set();
    const node={
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
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        removeChild(child){
            this.children=this.children.filter(candidate=>candidate!==child);
            child.parentNode=null;
            return child;
        },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}; },
        querySelector(selector){ return this.querySelectorAll(selector)[0]||null; },
        querySelectorAll(selector){
            const results=[];
            const match=candidate=>{
                if(selector.startsWith("#")){ return candidate.id===selector.slice(1); }
                if(selector.startsWith(".")){
                    return String(candidate.className||"").split(/\s+/).includes(selector.slice(1));
                }
                return false;
            };
            const visit=current=>current.children.forEach(child=>{
                if(match(child)){ results.push(child); }
                visit(child);
            });
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
    const monsterRects=[
        {left:300,top:90,right:376,bottom:190,width:76,height:100},
        {left:420,top:90,right:496,bottom:190,width:76,height:100},
        {left:540,top:90,right:616,bottom:190,width:76,height:100}
    ];
    const playerRects=[
        {left:40,top:360,right:158,bottom:476,width:118,height:116},
        {left:180,top:360,right:298,bottom:476,width:118,height:116},
        {left:320,top:360,right:438,bottom:476,width:118,height:116}
    ];
    monsterRects.forEach((rect,index)=>{
        const card=makeNode(rect);
        card.id="battleMonster"+index;
        cards[card.id]=card;
        monsterArea.appendChild(card);
    });
    playerRects.forEach((rect,index)=>{
        const card=makeNode(rect);
        card.id="battlePlayerCard"+index;
        cards[card.id]=card;
        playerArea.appendChild(card);
    });

    const monsters=options.monsters||monsterRects.map(()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const party=options.party||playerRects.map(()=>({hp:100,statusEffects:[],activeBuffs:[]}));
    const sourceSizes=new Map(
        Object.values(CASTS).map(spec=>[spec.file,spec.size]).concat(
            Object.values(STATUSES).map(spec=>[spec.file,[1774,887]])
        )
    );
    class FakeImage{
        constructor(){ imageCount++; this.complete=false; this.naturalWidth=0; this.naturalHeight=0; }
        set src(value){
            this._src=value;
            const filename=decodeURI(String(value).split("/").pop().split("?")[0]);
            const size=sourceSizes.get(filename)||[1536,1152];
            this.naturalWidth=size[0];
            this.naturalHeight=size[1];
            this.complete=true;
            if(this.onload){ this.onload(); }
        }
        get src(){ return this._src; }
    }
    const document={
        body,
        createElement(tag){
            const node=makeNode();
            if(tag==="canvas"){
                const context={
                    clearRect(){},
                    drawImage(...args){ drawCalls.push({node,args}); }
                };
                node.getContext=()=>context;
            }
            return node;
        },
        getElementById(id){ return cards[id]||null; },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    const context={
        window:null,document,console,Promise,Math,Number,Object,Array,Set,Map,Image:FakeImage,
        Date:{now:()=>clock},innerWidth:960,innerHeight:720,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        requestAnimationFrame(callback){ raf.push(callback); return raf.length; },
        cancelAnimationFrame(){},
        setTimeout(callback,delay){ const id=++timerId; scheduled.push({id,callback,delay}); return id; },
        clearTimeout(){},
        monsters,currentBattleMonsters:[0,1,2],
        queuedPlayerActions:{0:{target:1,targetAlly:1}},
        getSkillTargets(center,targetType){
            const living=[0,1,2].filter(index=>monsters[index]&&monsters[index].alive!==false&&monsters[index].hp>0);
            if(targetType==="all"){ return living; }
            if(targetType==="tri"||targetType==="row"){ return living; }
            return living.includes(center)?[center]:[];
        },
        v138GetFormationRows(){ return [[0,1,2],[]]; },
        getPartyCharacterByIndex(index){ return party[index]||null; },
        showMonsterHit(){ monsterHits.push(Array.from(arguments)); },
        showPlayerHit(){ playerHits.push(Array.from(arguments)); },
        v141PlayCardEffect(){ cardEffects.push(Array.from(arguments)); },
        applyMonsterDebuff(entity,type,duration,value){
            entity.statusEffects=entity.statusEffects||[];
            if(entity.statusEffects.some(effect=>effect.type===type&&effect.turnsLeft>0)){ return false; }
            entity.statusEffects.push({type,turnsLeft:duration,value});
            return true;
        },
        updateUI(){},
        updateMonsterUI(){},
        killMonster(index){ if(monsters[index]){ monsters[index].alive=false; } }
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(config){
            let resolve;
            const gate={done:false,reason:null,config,promise:new Promise(done=>{ resolve=done; })};
            gate.complete=reason=>{
                if(gate.done){ return false; }
                gate.done=true; gate.reason=reason; resolve(gate); return true;
            };
            return gate;
        },
        dispose(){}
    };
    vm.createContext(context);
    vm.runInContext(animation,context);
    return {
        context,body,cards,monsters,party,scheduled,raf,drawCalls,monsterHits,playerHits,cardEffects,
        setClock(value){ clock=value; },
        imageCount(){ return imageCount; },
        tick(value){
            clock=value;
            const callback=raf.shift();
            assert.ok(callback,"scheduled Canvas frame");
            callback();
        }
    };
}

function config(id,targetType,category){
    const duration=CASTS[id].duration;
    return {id,name:id,element:"wind",category:category||"magic",targetType,duration,resolveDuration:duration};
}

function stageSprites(runtime){
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.ok(stage,"skill stage");
    return {
        stage,
        sprites:stage.children.filter(node=>String(node.className).includes("v143-vfx-sprite"))
    };
}

function runTimers(runtime,delay){
    runtime.scheduled.filter(timer=>Math.abs(timer.delay-delay)<2).forEach(timer=>timer.callback());
}

test("the supplied wind PNG files remain byte-identical and keep their actual source dimensions",()=>{
    Object.values(CASTS).forEach(spec=>{
        const info=pngInfo("assets/inbox/"+spec.file);
        assert.deepEqual(info.size,spec.size,spec.file);
        assert.equal(info.hash,spec.hash,spec.file);
    });
    Object.values(STATUSES).forEach(spec=>{
        const info=pngInfo("assets/inbox/"+spec.file);
        assert.deepEqual(info.size,[1774,887],spec.file);
        assert.equal(info.hash,spec.hash,spec.file);
    });
});

test("all eleven casts and six loops use the requested mapping, timing and shared Sprite renderer",()=>{
    const runtime=loadRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    Object.entries(CASTS).forEach(([id,spec])=>{
        const model=manifest[id];
        assert.ok(model&&model.sprite,id);
        assert.equal(model.sprite.src,"assets/inbox/"+spec.file+"?v=173.24",id);
        assert.deepEqual(
            Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.frameWidth,model.sprite.frameHeight,model.sprite.hitFrame]),
            [4,3,12,384,384,7],id
        );
        assert.equal(model.sprite.placement,spec.placement,id);
        assert.equal(model.sprite.renderer,"canvas-crop",id);
        assert.equal(model.sprite.naturalGrid,true,id);
        assert.equal(model.hit,.5,id+" seventh-frame hit");
        assert.deepEqual(Array.from(model.deferredStatusTypes),[spec.status],id);
        assert.match(timing,new RegExp(id+":\\["+spec.duration+"(?:,|\\])"),id+" duration");
    });
    const statuses=runtime.context.v143StatusSpriteManifest;
    Object.entries(STATUSES).forEach(([type,spec])=>{
        const sprite=statuses[type];
        assert.equal(sprite.src,"assets/inbox/"+spec.file+"?v=173.24",type);
        assert.deepEqual(
            Array.from([sprite.columns,sprite.rows,sprite.frames,sprite.frameWidth,sprite.frameHeight]),
            [4,2,8,256,256],type
        );
        assert.equal(sprite.duration,spec.duration,type);
        assert.equal(sprite.collection,spec.collection,type);
    });
});

test("natural-grid Canvas crops exactly one row-major frame and reuses the preload cache",()=>{
    const runtime=loadRuntime();
    const preloaded=runtime.imageCount();
    runtime.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:2}
    );
    const {stage,sprites}=stageSprites(runtime);
    assert.equal(runtime.imageCount(),preloaded,"cast reuses the warmed image record");
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.renderer,"canvas-crop");
    assert.equal(sprite.dataset.targetIndex,"2");
    assert.equal(sprite.style.left,"578px");
    assert.equal(sprite.style.top,"140px");
    assert.equal(sprite.width,384);
    assert.equal(sprite.height,384);
    assert.equal(stage.children.length,1,"no procedural charge, flight, field or hit node");
    assert.deepEqual(runtime.drawCalls[0].args.slice(1),[0,0,384,1024/3,0,0,384,384]);
    runtime.tick(600);
    assert.equal(sprite.dataset.frameIndex,"6");
    assert.equal(sprite.dataset.frameX,"2");
    assert.equal(sprite.dataset.frameY,"1");
    assert.deepEqual(runtime.drawCalls.at(-1).args.slice(1),[768,1024/3,384,1024/3,0,0,384,384]);
});

test("single, three-lane and battlefield casts each own one correctly positioned sheet",()=>{
    const group=loadRuntime();
    group.context.v142SkillAnimationDirector.play(
        config("stormFlurry","tri","physical"),
        {side:"player",actorIndex:0,targetId:1,targetIds:[0,1,2]}
    );
    [0,1,2].forEach(index=>group.context.showMonsterHit(index,10,"hp"));
    const groupSprites=stageSprites(group).sprites;
    assert.equal(groupSprites.length,1,"one three-lane sheet, not nine effects");
    assert.equal(groupSprites[0].dataset.placement,"group");
    assert.equal(groupSprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(groupSprites[0].style.left,"458px");
    assert.equal(groupSprites[0].style.top,"140px");

    const all=loadRuntime();
    all.context.v142SkillAnimationDirector.play(
        config("stormRain","all","magic"),
        {side:"player",actorIndex:0}
    );
    const allSprites=stageSprites(all).sprites;
    assert.equal(allSprites.length,1,"one battlefield sheet");
    assert.equal(allSprites[0].dataset.placement,"battlefield");
    assert.equal(allSprites[0].dataset.areaId,"battleMonsterArea");
    assert.equal(allSprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(allSprites[0].style.left,"480px");
    assert.equal(allSprites[0].style.top,"170px");
});

test("three-target wind sheets keep a fixed three-slot footprint centered on the selected target",()=>{
    const placements=[];
    [
        [
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
        ],
        [
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
        ]
    ].forEach(monsters=>{
        const runtime=loadRuntime({monsters});
        runtime.context.v142SkillAnimationDirector.play(
            config("stormFlurry","tri","physical"),
            {side:"player",actorIndex:0}
        );
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        assert.equal(sprite.dataset.placement,"group");
        assert.equal(sprite.style.left,"458px","selected middle target remains the visual centre");
        assert.equal(sprite.style.top,"140px");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"casualties do not shrink or move the three-target sheet");
});

test("full-field wind sheets stay locked to the complete enemy area after casualties",()=>{
    const placements=[];
    [
        undefined,
        [
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
        ]
    ].forEach(monsters=>{
        const runtime=loadRuntime(monsters?{monsters}:{});
        runtime.context.v142SkillAnimationDirector.play(
            config("stormRain","all","magic"),
            {side:"player",actorIndex:0}
        );
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"full-field VFX does not follow survivor bounds");
});

test("enemy casts discover the real player target instead of using a fixed faction position",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"monster",actorIndex:0}
    );
    assert.equal(stageSprites(runtime).sprites.length,0,"no guessed player target");
    runtime.context.showPlayerHit(20,"hp",1);
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetSide,"player");
    assert.equal(sprites[0].dataset.targetIndex,"1");
    assert.equal(sprites[0].style.left,"239px");
    assert.equal(sprites[0].style.top,"418px");
});

test("frame seven releases resolved attack results once, while buffs never shake or show damage",()=>{
    const attack=loadRuntime();
    attack.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:2}
    );
    attack.context.showMonsterHit(2,33,"hp");
    assert.equal(attack.monsterHits.length,0);
    attack.setClock(600);
    runTimers(attack,600);
    assert.equal(attack.monsterHits.length,1,"damage result appears once at frame seven");
    assert.equal(attack.cards.battleMonster2.classList.contains("v143-impact-target"),true);

    const buff=loadRuntime();
    buff.context.v142SkillAnimationDirector.play(
        config("dodgeSkill","allyAll","buff"),
        {side:"player",actorIndex:0}
    );
    buff.party.forEach(character=>character.activeBuffs.push({type:"dodgeSkill",turnsLeft:2}));
    [0,1,2].forEach(index=>buff.context.v141PlayCardEffect("player",index,"buff"));
    buff.setClock(800);
    runTimers(buff,800);
    assert.equal(stageSprites(buff).sprites.length,1,"one shared three-position buff sheet");
    assert.equal(buff.monsterHits.length,0);
    assert.equal(buff.playerHits.length,0);
    [0,1,2].forEach(index=>{
        assert.equal(buff.cards["battlePlayerCard"+index].classList.contains("v143-impact-target"),false);
        assert.equal(buff.cards["battlePlayerCard"+index].classList.contains("v146-area-impact"),false);
    });
});

test("status loops start only on success, never restart on duplicate MISS, and clear with lifecycle",()=>{
    const applied=loadRuntime();
    applied.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:0}
    );
    assert.equal(applied.context.applyMonsterDebuff(applied.monsters[0],"agilityDown",2,15),true);
    assert.equal(applied.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),null,"loop waits for cast completion");
    applied.setClock(1200);
    runTimers(applied,1200);
    const gravity=applied.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown");
    assert.ok(gravity,"successful status starts its loop");
    assert.ok(gravity.style.backgroundImage.includes("重力-狀態循環圖.png?v=173.24"));
    assert.equal(gravity.style["--v153-status-duration"],"1000ms");

    applied.monsters[0].statusEffects.push({type:"damageDown",turnsLeft:1});
    applied.context.v143SyncStatusSpriteEffects();
    assert.ok(applied.cards.battleMonster0.querySelector(".v153-status-vfx-damageDown"),"different states may coexist");
    applied.monsters[0].statusEffects.forEach(effect=>{ effect.turnsLeft=0; });
    applied.context.updateUI();
    assert.equal(applied.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown"),null,"expired loop clears");
    assert.equal(applied.cards.battleMonster0.querySelector(".v153-status-vfx-damageDown"),null,"all expired loops clear");

    const duplicate=loadRuntime({
        monsters:[
            {alive:true,hp:100,statusEffects:[{type:"agilityDown",turnsLeft:2}],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
        ]
    });
    duplicate.context.v143SyncStatusSpriteEffects();
    const existing=duplicate.cards.battleMonster0.querySelector(".v153-status-vfx-agilityDown");
    duplicate.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:0}
    );
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
    assert.ok(applied.cards.battlePlayerCard1.querySelector(".v153-status-vfx-stealthSkill"));
    applied.context.v142SkillAnimationDirector.dispose();
    assert.equal(applied.body.querySelectorAll(".v153-status-vfx").length,0,"battle disposal clears every loop");
});

test("wind sheets replace procedural wind effects and keep noninteractive status layering",()=>{
    assert.doesNotMatch(css,/data-skill="windCrossSlash"/);
    assert.doesNotMatch(css,/data-skill="stormRain"/);
    assert.match(css,/#game-stage #battlePage \.v153-status-vfx\{[\s\S]*?z-index:4;[\s\S]*?pointer-events:none;/);
    assert.match(css,/@keyframes v153StatusSpriteFrames\{[\s\S]*?87\.5%,100%\{background-position:100% 100%\}/);
    assert.match(animation,/const frameX=frameIndex%columns;/);
    assert.match(animation,/const frameY=Math\.floor\(frameIndex\/columns\);/);
    assert.match(animation,/Object\.keys\(MANIFEST\)\.forEach[\s\S]*?getSpriteImage\(sprite\.src\)/);
    assert.doesNotMatch(animation,/assets\/inbox\/[\s\S]{0,80}(?:base64|blob:)/i);
});

test("the development cache release is V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.55"/);
    assert.match(index,/<title>四象江湖傳 V173\.55<\/title>/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.55/);
});

console.log("\n"+passed+" V173.39 wind Sprite VFX tests passed.");
