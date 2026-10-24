"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

const CASTS={
    stormFist:{file:"storm-fist-cast.png",duration:1200,placement:"single",status:"agilityDown",size:[1536,1024],hash:"89e7ce2b0b79c75ad3213b71f7a6350a2e9ffd79f66ad3ef671c19a30dfbc3f6"},
    stormFlurry:{file:"storm-flurry-cast.png",duration:1500,placement:"single",status:"damageDown",size:[1448,1086],hash:"3a6268f354f4fb4b2542adf4eb716f639bfba754c63bb1c75ab1548a36df41f9"},
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
    agilityDown:{file:"agility-down-loop.png",runtimeFile:"gravity-icon.webp",mode:"icon",collection:"statusEffects",hash:"fb1b42d3c0c87ab4e93b4fd495657852268cb15e9234bfefdeb2edf0546e7d7a"},
    damageDown:{file:"damage-down-loop.png",runtimeFile:"damage-down-icon.webp",mode:"icon",collection:"statusEffects",hash:"25e984ef5973616bc6f37cfc5842d445ff484f981a98902894febca59a92ae34"},
    stun:{file:"stun-loop.png",runtimeFile:"stun-stars-v2.webp",mode:"pulse",collection:"statusEffects",hash:"45903df26e32ddc265d45217639211bb9966fb69b3a02389f07afa0500d53071"},
    dodgeSkill:{file:"dodge-skill-loop.png",runtimeFile:"windwalk.webp",mode:"pulse",collection:"activeBuffs",hash:"397338dc6fc01967de860e285c1f65febe5248f0a111c01f789dfb676c141c5b"},
    stealthSkill:{file:"stealth-skill-loop.png",runtimeFile:"stealth.webp",mode:"none",collection:"activeBuffs",hash:"58523f3066068e2d7a784c309fe072c3cbb92361a0d703ed8b4d9b1da4a0a02b"},
    dinghaishenzhen:{file:"dinghaishenzhen-loop.png",runtimeFile:"calm-mind.webp",mode:"pulse",collection:"activeBuffs",hash:"3607d280f4ff4092d80b8ead216e410425815a4996b22437af556bf28673f31b"}
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
        insertBefore(child,next){child.parentNode=this;const index=next?this.children.indexOf(next):this.children.length;this.children.splice(index,0,child);return child;},
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
    const monsterRects=options.monsterRects||[
        {left:300,top:90,right:376,bottom:190,width:76,height:100},
        {left:420,top:90,right:496,bottom:190,width:76,height:100},
        {left:540,top:90,right:616,bottom:190,width:76,height:100}
    ];
    const playerRects=options.playerRects||[
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
            if(options.feedback){
                const animations=[];node.getAnimations=()=>animations;
                node.animate=(frames,timing)=>{const a={playState:"running",playbackRate:1,currentTime:0,
                    effect:{getTiming:()=>timing,getKeyframes:()=>frames},pause(){this.playState="paused";},play(){this.playState="running";},cancel(){this.playState="idle";}};animations.push(a);return a;};
            }
            if(tag==="canvas"){
                const context={
                    clearRect(){},closePath(){},lineTo(){},setTransform(){},save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},ellipse(){},stroke(){},moveTo(){},quadraticCurveTo(){},fill(){},fillRect(){},
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
        monsters,currentBattleMonsters:monsterRects.map((_,index)=>index),
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
    const slotRects={
        ENEMY_F1:monsterRects[0],ENEMY_F2:monsterRects[1],ENEMY_F3:monsterRects[2],
        ALLY_F1:playerRects[0],ALLY_F2:playerRects[1],ALLY_F3:playerRects[2]
    };
    monsterRects.forEach((rect,index)=>{ slotRects["ENEMY_F"+(index+1)]=rect; });
    playerRects.forEach((rect,index)=>{ slotRects["ALLY_F"+(index+1)]=rect; });
    function plainRect(rect,slots){
        return Object.assign({},rect,{centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2,slots:slots||[]});
    }
    context.FourSymbolsBattlefieldSlots={
        getSlotForCombatant(side,index){ return (side==="monster"?"ENEMY_F":"ALLY_F")+(Number(index)+1); },
        getSlotFromElement(element){
            const match=String(element&&element.id||"").match(/(?:battleMonster|battlePlayerCard)(\d+)/);
            if(!match){ return null; }
            return String(element.id).startsWith("battleMonster")?"ENEMY_F"+(Number(match[1])+1):"ALLY_F"+(Number(match[1])+1);
        },
        getSlotRect(slot){ return slotRects[slot]?plainRect(slotRects[slot],[slot]):null; },
        getSlotCenter(slot){
            const rect=this.getSlotRect(slot);
            return rect?{x:rect.centerX,y:rect.centerY,rect}:null;
        },
        getSideRect(side){
            const rect=side==="monster"?monsterArea.getBoundingClientRect():playerArea.getBoundingClientRect();
            return plainRect(rect,Object.keys(slotRects).filter(slot=>slot.startsWith(side==="monster"?"ENEMY":"ALLY")));
        },
        getGeometryRectFromShape(side,slot,shape){
            if(shape==="all"||shape==="allyAll"){ return this.getSideRect(side); }
            if(/tri|row|horizontal-3|allyTri/i.test(shape)){
                const rects=side==="monster"?monsterRects:playerRects;
                const left=Math.min(...rects.map(rect=>rect.left));
                const top=Math.min(...rects.map(rect=>rect.top));
                const right=Math.max(...rects.map(rect=>rect.right));
                const bottom=Math.max(...rects.map(rect=>rect.bottom));
                return plainRect({left,top,right,bottom,width:right-left,height:bottom-top},rects.map((_,index)=>(side==="monster"?"ENEMY_F":"ALLY_F")+(index+1)));
            }
            return this.getSlotRect(slot);
        }
    };
    if(options.renderGeometry){ context.FourSymbolsBattlefieldRenderGeometry=options.renderGeometry; }
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
    vm.runInContext(options.feedback?animation.replace("/* @battle-vfx-feedback-config */ null",fs.readFileSync("config/battle-vfx-feedback.json","utf8")):animation,context);
    return {
        context,body,cards,monsters,party,scheduled,raf,drawCalls,monsterHits,playerHits,cardEffects,
        setClock(value){
            // Paint the newly scheduled cast at its initial clock before
            // advancing to hit/completion; production starts its timeline on RAF.
            const pendingFrames=raf.splice(0);
            pendingFrames.forEach(callback=>callback(clock));
            clock=value;
        },
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
        const info=pngInfo("assets/vfx/wind/"+spec.file);
        assert.deepEqual(info.size,spec.size,spec.file);
        assert.equal(info.hash,spec.hash,spec.file);
    });
    Object.values(STATUSES).forEach(spec=>{
        const info=pngInfo("assets/vfx/wind/"+spec.file);
        assert.deepEqual(info.size,[1774,887],spec.file);
        assert.equal(info.hash,spec.hash,spec.file);
    });
});

test("stun head presentation uses the independently reviewed lossless stars candidate",()=>{
    const file=fs.readFileSync("assets/vfx/status/"+STATUSES.stun.runtimeFile);
    assert.equal(file.subarray(0,4).toString("ascii"),"RIFF");
    assert.equal(file.subarray(8,12).toString("ascii"),"WEBP");
    assert.equal(crypto.createHash("sha256").update(file).digest("hex"),"047e37bef6c86ad891662ffe2c93f33c7a30741779c159e9554476f4e23ea57b");
});

test("all eleven casts keep Sprite timing while six persistent states use low-motion visual modes",()=>{
    const runtime=loadRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    Object.entries(CASTS).forEach(([id,spec])=>{
        const model=manifest[id];
        assert.ok(model&&model.sprite,id);
        const expectedSource=id==="dinghaishenzhen"?"assets/vfx/wind/calm-mind-cast-person-v2.webp":id==="stormFlurry"?"assets/vfx/wind/storm-flurry-wide-v3.webp":id==="stormRain"?"assets/vfx/wind/storm-rain-recipient-v1.webp":id==="windSpell"?"assets/vfx/wind/wind-spell-wide-v2.webp":id==="stormCircle"?"assets/vfx/wind/storm-circle-wide-v2.webp":id==="dodgeSkill"?"assets/vfx/wind/dodge-recipient-v1.webp":"assets/vfx/wind/"+spec.file+"?v=173.24";
        assert.equal(model.sprite.src,expectedSource,id);
        assert.deepEqual(
            Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame]),
            [4,3,12,7],id
        );
        assert.equal(model.sprite.placement,spec.placement,id);
        assert.equal(model.sprite.renderer,"dom-sprite",id);
        assert.equal(model.hit,.5,id+" seventh-frame hit");
        assert.deepEqual(Array.from(model.deferredStatusTypes),[spec.status],id);
        assert.match(timing,new RegExp(id+":\\["+spec.duration+"(?:,|\\])"),id+" duration");
    });
    const statuses=runtime.context.v143StatusVisualManifest;
    Object.entries(STATUSES).forEach(([type,spec])=>{
        const visual=statuses[type];
        assert.ok(visual,type);
        assert.equal(visual.mode,spec.mode,type);
        assert.equal(visual.renderer,"dom-status-visual",type);
        assert.equal(visual.collection,spec.collection,type);
        assert.deepEqual(Array.from([visual.cropColumns,visual.cropRows]),[1,1],type);
        assert.equal(
            visual.src,
            spec.mode==="icon"||spec.mode==="none"?"":"assets/vfx/status/"+spec.runtimeFile,
            type
        );
        assert.equal(visual.frames,undefined,type+" must not own a persistent frame loop");
        assert.equal(visual.duration,undefined,type+" must not own a persistent frame clock");
    });
});

test("stormRain uses the reviewed lossless twelve-cell candidate while stormSpell retains its original sheet",()=>{
    const candidate="assets/vfx/wind/storm-rain-cast-v2.webp";
    const bytes=fs.readFileSync(candidate);
    const info=losslessWebpInfo(bytes);
    assert.deepEqual([info.width,info.height],[1448,1086]);
    assert.equal(info.alpha,1,"wind ribbons must retain alpha");
    assert.equal(info.width/4,362);assert.equal(info.height/3,362);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),"518147f7f9afca6a63b825e2caf0250698e8d9d4702207c3293e2318148aa792");
    const manifest=loadRuntime().context.v143SkillAnimationManifest;
    assert.equal(manifest.stormRain.sprite.src,"assets/vfx/wind/storm-rain-recipient-v1.webp");
    assert.equal(manifest.stormRain.sprite.presentation,"per-recipient");
    assert.equal(manifest.stormSpell.sprite.src,"assets/vfx/wind/storm-rain-cast.png?v=173.24");
    assert.equal(manifest.stormSpell.sprite.reusedFrom,"stormRain");
});

function losslessWebpInfo(file){
 const b=Buffer.isBuffer(file)?file:fs.readFileSync(file);
 assert.equal(b.toString("ascii",0,4),"RIFF");assert.equal(b.toString("ascii",8,12),"WEBP");
 for(let o=12;o+8<=b.length;){const type=b.toString("ascii",o,o+4),size=b.readUInt32LE(o+4),p=o+8;assert.ok(p+size<=b.length,"complete WebP chunk");if(type==="VP8L"){assert.equal(b[p],0x2f);const bits=b.readUInt32LE(p+1);return {width:1+(bits&16383),height:1+((bits>>>14)&16383),alpha:(bits>>>28)&1};}o=p+size+(size%2);}
 throw new Error("Expected lossless VP8L image");
}

test("windSpell wide source preserves native frame aspect before and after image metadata arrives",()=>{
    const candidate="assets/vfx/wind/wind-spell-wide-v2.webp",bytes=fs.readFileSync(candidate);
    const info=losslessWebpInfo(bytes);
    assert.deepEqual([info.width,info.height],[2172,724]);
    assert.equal(info.alpha,1);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),"73b005cb0199578af99938aa083b10cd6a465f6151b973ce6a57f5c6922df42c");
    const sprite=loadRuntime().context.v143SkillAnimationManifest.windSpell.sprite;
    assert.equal(sprite.src,candidate);
    const actualAspect=(info.width/sprite.columns)/(info.height/sprite.rows);
    assert.equal(actualAspect,2.25);
    assert.equal(sprite.cellAspect,actualAspect,'fallback agrees with the actual fractional-height cell');
    const start=animation.indexOf('function frameAspectFor('),end=animation.indexOf('function applySpriteBox(',start);
    assert.ok(start>=0&&end>start);
    const cache=new Map(),context={spriteFrameAspectCache:cache,Math,Number,String};
    vm.createContext(context);vm.runInContext(animation.slice(start,end),context);
    assert.equal(context.frameAspectFor(sprite),actualAspect,'cold-cache layout must already be wide');
    cache.set(candidate,actualAspect);
    assert.equal(context.frameAspectFor(sprite),actualAspect,'loaded metadata must not change source shape');
});

test("Wind casts use one DOM Sprite Sheet node and never invoke Canvas drawing",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:2}
    );
    const {stage,sprites}=stageSprites(runtime);
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.renderer,"dom-sprite");
    assert.equal(sprite.dataset.targetIndex,"2");
    assert.equal(sprite.style.left,"578px");
    assert.equal(sprite.style.top,"140px");
    assert.match(sprite.style.backgroundImage,/storm-fist-cast\.png\?v=173\.24/);
    assert.equal(stage.children.length,1,"no procedural charge, flight, field or hit node");
    assert.equal(runtime.drawCalls.length,0,"DOM Sprite renderer must never call Canvas drawImage");
});

test("single, three-lane and battlefield casts each own one correctly positioned sheet",()=>{
    const group=loadRuntime();
    group.context.v142SkillAnimationDirector.play(
        config("windSpell","tri","magic"),
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
        {side:"player",actorIndex:0,targetId:0,targetIds:[0,1,2],targetSide:"monster"}
    );
    const allSprites=stageSprites(all).sprites;
    assert.equal(allSprites.length,3,"one funnel per explicit battlefield recipient");
    assert.deepEqual(allSprites.map(n=>n.dataset.targetIndex),["0","1","2"]);
    assert.ok(allSprites.every(n=>n.dataset.placement==="single"));
    assert.equal(all.context.v143SkillAnimationState.current.targetType,"all");
});

test("three-target wind sheets keep their canonical three-slot artwork center after casualties",()=>{
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
        const targetIds=monsters.map((monster,index)=>monster.alive?index:null).filter(Number.isInteger);
        runtime.context.v142SkillAnimationDirector.play(
            config("windSpell","tri","magic"),
            {side:"player",actorIndex:0,targetId:1,targetIds,targetSide:"monster"}
        );
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        assert.equal(sprite.dataset.placement,"group");
        assert.equal(sprite.style.left,"458px","artwork remains centered on the canonical three-slot footprint");
        assert.equal(sprite.style.top,"140px");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"casualties do not shrink or move the three-target sheet");
});

test("non-recipient full-field wind sheets stay locked to the complete enemy area after casualties",()=>{
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
        const targetIds=(monsters||runtime.monsters).map((monster,index)=>monster.alive?index:null).filter(Number.isInteger);
        runtime.context.v142SkillAnimationDirector.play(
            {id:"stormSpell",name:"stormSpell",element:"wind",category:"magic",targetType:"all",duration:1700,resolveDuration:1700},
            {side:"player",actorIndex:0,targetId:targetIds[0],targetIds,targetSide:"monster"}
        );
        const sprite=stageSprites(runtime).sprites[0];
        assert.ok(sprite);
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(placements[1],placements[0],"full-field VFX does not follow survivor bounds");
});

test("enemy casts use the explicit player target instead of a fixed faction position",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"monster",actorIndex:0,targetId:1,targetIds:[1],targetSide:"player"}
    );
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetSide,"player");
    assert.equal(sprites[0].dataset.targetIndex,"1");
    assert.equal(sprites[0].style.left,"239px");
    assert.equal(sprites[0].style.top,"418px");
});

test("frame seven exposes formal attack feedback timing while buffs never create damage",()=>{
    const attack=loadRuntime();
    attack.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:2}
    );
    assert.equal(typeof attack.context.v143ResolveBattleFeedbackTiming,"function");
    const impact=attack.context.v143ResolveBattleFeedbackTiming("monster",2,"damage");
    assert.ok(impact.delayMs>0&&impact.delayMs<=700,"damage feedback must resolve at the authored hit frame");
    assert.equal(impact.critical,false);
    assert.equal(attack.cards.battleMonster2.classList.contains("v143-impact-target"),false,"raster owner must not recreate the retired procedural impact class");

    const buff=loadRuntime();
    buff.context.v142SkillAnimationDirector.play(
        config("dodgeSkill","allyAll","buff"),
        {side:"player",actorIndex:0,targetId:0,targetIds:[0,1,2],targetSide:"player"}
    );
    buff.party.forEach(character=>character.activeBuffs.push({type:"dodgeSkill",turnsLeft:2}));
    [0,1,2].forEach(index=>buff.context.v141PlayCardEffect("player",index,"buff"));
    buff.setClock(800);
    runTimers(buff,800);
    assert.equal(stageSprites(buff).sprites.length,3,"one buff sheet per explicit recipient");
    assert.equal(buff.monsterHits.length,0);
    assert.equal(buff.playerHits.length,0);
    [0,1,2].forEach(index=>{
        assert.equal(buff.cards["battlePlayerCard"+index].classList.contains("v143-impact-target"),false);
        assert.equal(buff.cards["battlePlayerCard"+index].classList.contains("v146-area-impact"),false);
    });
});

test("persistent status visuals start only on success, survive duplicate MISS, and clear with lifecycle",()=>{
    const applied=loadRuntime();
    applied.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:0}
    );
    assert.equal(applied.context.applyMonsterDebuff(applied.monsters[0],"agilityDown",2,15),true);
    assert.equal(applied.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown"),null,"visual waits for cast completion");
    applied.setClock(1200);
    runTimers(applied,1200);
    const gravity=applied.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown");
    assert.ok(gravity,"successful status starts its fixed icon");
    assert.equal(gravity.dataset.statusMode,"icon");

    applied.monsters[0].statusEffects.push({type:"damageDown",turnsLeft:1});
    applied.context.v143SyncStatusVisualEffects();
    assert.ok(applied.cards.battleMonster0.querySelector(".v143-status-icon-damageDown"),"different status icons may coexist");
    applied.monsters[0].statusEffects.forEach(effect=>{ effect.turnsLeft=0; });
    applied.context.v143SyncStatusVisualEffects();
    assert.equal(applied.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown"),null,"expired visual clears");
    assert.equal(applied.cards.battleMonster0.querySelector(".v143-status-icon-damageDown"),null,"all expired visuals clear");

    const duplicate=loadRuntime({
        monsters:[
            {alive:true,hp:100,statusEffects:[{type:"agilityDown",turnsLeft:2}],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
        ]
    });
    duplicate.context.v143SyncStatusVisualEffects();
    const existing=duplicate.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown");
    duplicate.context.v142SkillAnimationDirector.play(
        config("stormFist","single","physical"),
        {side:"player",actorIndex:0,targetId:0}
    );
    assert.equal(duplicate.context.applyMonsterDebuff(duplicate.monsters[0],"agilityDown",2,15),false);
    assert.strictEqual(duplicate.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown"),existing,"duplicate MISS preserves the same icon");
    duplicate.setClock(1200);
    runTimers(duplicate,1200);
    assert.strictEqual(duplicate.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown"),existing,"completion does not recreate it");
    duplicate.monsters[0].hp=0;
    duplicate.monsters[0].alive=false;
    duplicate.context.v143SyncStatusVisualEffects();
    assert.equal(duplicate.cards.battleMonster0.querySelector(".v143-status-icon-agilityDown"),null,"death clears the visual");

    applied.party[1].activeBuffs.push({type:"stealthSkill",turnsLeft:2});
    applied.context.v143SyncStatusVisualEffects();
    assert.equal(applied.cards.battlePlayerCard1.querySelector(".v143-status-visual-stealthSkill"),null,"stealth has no body visual");
    assert.equal(applied.cards.battlePlayerCard1.querySelector(".v143-status-icon-stealthSkill"),null,"stealth has no HUD icon");
    applied.context.v142SkillAnimationDirector.dispose();
    assert.equal(applied.body.querySelectorAll(".v143-status-visual").length,0,"battle disposal clears body visuals");
    assert.equal(applied.body.querySelectorAll(".v143-status-icon").length,0,"battle disposal clears status icons");
});

test("wind casts remain Sprite Sheets while persistent states use noninteractive low-motion visuals",()=>{
    assert.doesNotMatch(css,/data-skill="windCrossSlash"/);
    assert.doesNotMatch(css,/data-skill="stormRain"/);
    assert.match(css,/#game-stage #battlePage \.v143-status-visual\{[\s\S]*?z-index:var\(--v143-status-layer-rotating\);[\s\S]*?pointer-events:none;/);
    assert.match(css,/\.v143-status-visual--layer-hard-control-base\{[\s\S]*?z-index:var\(--v143-status-layer-hard-control-base\)/);
    assert.match(css,/@keyframes v143StatusImageBreath/);
    assert.match(css,/\.v143-status-icon--pulse\{[\s\S]*?animation:none !important/);
    assert.doesNotMatch(css,/v143StatusRasterFrames/);
    assert.match(animation,/node\.dataset\.renderer="dom-status-visual";/);
    assert.match(animation,/node\.style\.backgroundSize="contain"/);
    assert.doesNotMatch(animation,/getSpriteImage|frameX=frameIndex|frameY=Math\.floor/);
    assert.doesNotMatch(animation,/assets\/inbox\/[\s\S]{0,80}(?:base64|blob:)/i);
});

test("the development cache release is V173.39",()=>{
    assert.equal((loader.match(/const V_ASSET_VERSION="([^"]+)"/)||[])[1],releaseMeta.cacheVersion);
    assert.ok(index.includes('<title>四象江湖傳 V'+releaseMeta.version+'</title>'));
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
});


test("wide baseline bytes remain exact and active wide sources retain their native ratio",()=>{
    const manifest=loadRuntime().context.v143SkillAnimationManifest;
    const entries=[["dodgeSkill", "wind/dodge-skill-wide-v2.webp", "8a4aa1a86af263d47b613c6df6a3ffa875c02a476591c675bed1917defacca72"], ["stormCircle", "wind/storm-circle-wide-v2.webp", "3886439d276022db61ad22afb6656fab827fe45f946767c6f172ede253fa5c0e"]];
    entries.forEach(([id,file,hash])=>{
        const candidate="assets/vfx/"+file,bytes=fs.readFileSync(candidate),info=losslessWebpInfo(bytes);
        assert.deepEqual([info.width,info.height,info.alpha],[2172,724,1],id);
        assert.equal(require("node:crypto").createHash("sha256").update(bytes).digest("hex"),hash,id);
        if(!["dodgeSkill"].includes(id)){
        assert.equal(manifest[id].sprite.src,candidate,id);
        assert.equal((info.width/manifest[id].sprite.columns)/(info.height/manifest[id].sprite.rows),2.25,id);
        assert.equal(manifest[id].sprite.cellAspect,2.25,id+" cold-cache source ratio");
        }else{ assert.equal(manifest[id].sprite.presentation,"per-recipient",id); assert.notEqual(manifest[id].sprite.src,candidate,id+" rejected placement source is retired"); }
    });
});

test("stormFlurry reviewed wide source keeps paired-fist cast contract",()=>{
    const bytes=fs.readFileSync("assets/vfx/wind/storm-flurry-wide-v3.webp"),info=losslessWebpInfo(bytes);
    assert.deepEqual([info.width,info.height,info.alpha],[2172,724,1]);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),"60856e15c9f6474f1dbf07d60dc9f39081bf4f197444fbcc727a106e96141ade");
    assert.deepEqual(bytes,fs.readFileSync("tools/vfx-commercial-sample/assets/full/storm-flurry-wide-v3.webp"));
    const model=loadRuntime().context.v143SkillAnimationManifest.stormFlurry,s=model.sprite;
    assert.equal(s.src,"assets/vfx/wind/storm-flurry-wide-v3.webp");
    assert.deepEqual([s.columns,s.rows,s.frames,s.hitFrame],[4,3,12,7]);
    assert.equal(s.cellAspect,(info.width/4)/(info.height/3));
    assert.equal(s.cellAspect,2.25);
    assert.deepEqual([s.placement,s.scale,s.minSize,s.maxSize,s.presentation,s.recipientSlice],["single",1.4,96,184,"per-recipient","center-third"]);
    assert.equal(model.hit,.5);
    assert.deepEqual(Array.from(model.deferredStatusTypes),["damageDown"]);
});

test("calm recipient source remains exact transparent square 4x3 art",()=>{
 const bytes=fs.readFileSync("assets/vfx/wind/calm-mind-cast-person-v2.webp"),info=losslessWebpInfo(bytes);
 assert.deepEqual([info.width,info.height,info.alpha],[1448,1086,1]);
 assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),"72a44e3f6137481f928619b234a707e6a4c40f154da6a42834af791439b6be8f");
 assert.deepEqual(bytes,fs.readFileSync("tools/vfx-commercial-sample/assets/full/calm-mind-cast-person-v2.webp"));
 const sprite=loadRuntime().context.v143SkillAnimationManifest.dinghaishenzhen.sprite;
 assert.equal(sprite.presentation,"per-recipient");assert.equal(sprite.placement,"battlefield","formal authored declaration retained");
 assert.deepEqual([sprite.columns,sprite.rows,sprite.frames],[4,3,12]);assert.equal((info.width/4)/(info.height/3),1);
});

function calmFixture(count,indexes){
 const rects=Array.from({length:count},(_,i)=>({left:40+i*70,top:360,right:100+i*70,bottom:476,width:60,height:116}));
 const portraits=rects.map((r,i)=>({left:r.left+5,top:375,width:40,height:80}));
 const runtime=loadRuntime({playerRects:rects,renderGeometry:{getUnitGeometry(side,i){return side==="player"&&portraits[i]?{artworkProjection:{rect:portraits[i]}}:null;}}});
 runtime.setClock(100);
 const gate=runtime.context.v142SkillAnimationDirector.play(config("dinghaishenzhen","allyAll","buff"),{side:"player",actorIndex:0,targetSide:"player",targetId:indexes[0],targetIds:indexes});
 return {runtime,gate,portraits};
}

test("calm emits one portrait-centered node per actual recipient for three/six/partial parties",()=>{
 for(const [count,indexes] of [[3,[0,1,2]],[6,[0,1,2,3,4,5]],[6,[1,4]]]){
  const {runtime,portraits}=calmFixture(count,indexes),current=runtime.context.v143SkillAnimationState.current;
  const nodes=stageSprites(runtime).sprites;
  assert.equal(nodes.length,indexes.length);assert.equal(current.targetType,"allyAll");
  assert.deepEqual(nodes.map(n=>Number(n.dataset.targetIndex)),indexes);
  assert.deepEqual(Array.from(current.spriteNodes.keys()),indexes.map(String));
  indexes.forEach((i,j)=>{const n=nodes[j],p=portraits[i];assert.equal(n.dataset.targetIndexes,String(i));assert.equal(n.dataset.placement,"single");assert.equal(n.style.left,(p.left+p.width/2)+"px");assert.equal(n.style.top,(p.top+p.height/2)+"px");assert.ok(parseFloat(n.style.width)>0&&parseFloat(n.style.width)<=68,"portrait minor dimension caps configured battlefield minimum rather than retaining 280px");assert.equal(n.style.getPropertyValue("--v143-sprite-delay"),"0ms");});
  assert.equal(runtime.raf.length,1,"one common clock handoff");
  runtime.context.v142SkillAnimationDirector.dispose();assert.equal(runtime.context.v143SkillAnimationState.current,null);
  assert.equal(runtime.body.querySelectorAll("#v143-skill-stage").length,0);
 }
});

test("calm confirmation keys and callbacks remain independent and once-only on shared hit clock",()=>{
 const {runtime}=calmFixture(3,[0,2]),current=runtime.context.v143SkillAnimationState.current;let hits=[];
 for(const i of [0,2])runtime.context.v143RunAtTargetHit("player",i,()=>hits.push(i));
 assert.equal(current.spriteNodes.get("0").dataset.confirmedHit,"true");assert.equal(current.spriteNodes.get("2").dataset.confirmedHit,"true");
 assert.equal(current.spriteNodes.size,2,"confirmation reuses each correct recipient node");
 runtime.setClock(100);assert.equal(current.visualStartedAt,100);
 const hitJobs=runtime.scheduled.filter(j=>j.delay===1100);assert.equal(hitJobs.length,2);
 runtime.setClock(1200);hitJobs.forEach(j=>j.callback());runtime.setClock(1216);runtime.setClock(1233);
 assert.deepEqual(hits,[0,2]);hitJobs.forEach(j=>j.callback());runtime.setClock(1249);runtime.setClock(1266);assert.deepEqual(hits,[0,2],"repeat settle cannot replay drained callbacks");
 runtime.context.v142SkillAnimationDirector.dispose();assert.equal(current.hitCallbacks.size,0);
});

test("calm late valid recipient catches up without restarting siblings",()=>{
 const {runtime}=calmFixture(3,[0,2]),current=runtime.context.v143SkillAnimationState.current;
 runtime.setClock(100);const old=current.spriteNodes.get("0");
 current.spriteNodes.get("2").remove();current.spriteNodes.delete("2");current.emitted.delete(2);
 runtime.setClock(600);runtime.context.v143RunAtTargetHit("player",2,()=>{});
 const late=current.spriteNodes.get("2");assert.equal(late.dataset.emission,"late");assert.equal(late.style.getPropertyValue("--v143-sprite-delay"),"-500ms");assert.equal(current.visualStartedAt,100);assert.equal(current.spriteNodes.get("0"),old);assert.equal(current.spriteNodes.size,2);
 runtime.context.v142SkillAnimationDirector.dispose();
});

test("enemy calm uses the same opt-in recipient keys and cancels abandoned hit work",()=>{
 const runtime=loadRuntime({renderGeometry:{getUnitGeometry(side,i){return side==="monster"?{artworkProjection:{rect:{left:310+i*120,top:105,width:40,height:70}}}:null;}}});
 runtime.setClock(100);
 runtime.context.v142SkillAnimationDirector.play(config("dinghaishenzhen","allyAll","buff"),{side:"monster",actorIndex:0,targetSide:"monster",targetId:0,targetIds:[0,2]});
 const old=runtime.context.v143SkillAnimationState.current;let hits=0;
 runtime.context.v143RunAtTargetHit("monster",2,()=>hits++);
 assert.equal(old.spriteNodes.get("2").dataset.confirmedHit,"true");
 assert.equal(old.spriteNodes.get("0").dataset.confirmedHit,"false");
 assert.equal(old.spriteNodes.get("2").style.left,"570px");
 runtime.setClock(100);
 const abandoned=runtime.scheduled.filter(j=>j.delay===1100);
 runtime.context.v142SkillAnimationDirector.play(config("stormFist","single","physical"),{side:"player",actorIndex:0,targetSide:"monster",targetId:1,targetIds:[1]});
 assert.equal(old.done,true);assert.equal(old.hitCallbacks.size,0);
 abandoned.forEach(j=>j.callback());runtime.setClock(1216);runtime.setClock(1233);
 assert.equal(hits,0,"superseded calm cannot deliver abandoned feedback");
 runtime.context.v142SkillAnimationDirector.dispose();
});

test("calm explicit partial recipients reject unrelated late feedback nodes",()=>{
 const {runtime}=calmFixture(3,[0,2]),current=runtime.context.v143SkillAnimationState.current;
 runtime.context.v143ResolveBattleFeedbackTiming("player",1,"heal",false);
 assert.equal(current.spriteNodes.has("1"),false,"nonrecipient feedback must not expand explicit calm recipient art");
 assert.deepEqual(Array.from(current.emitted),[0,2]);runtime.context.v142SkillAnimationDirector.dispose();
});


const RECIPIENT_CAST_CASES=[
  {
    "id": "waterBall",
    "element": "water",
    "name": "water-orb-recipient-v1",
    "type": "tri",
    "category": "magic",
    "duration": 1400,
    "hash": "93cbbb60b0d796da8aa745fefbc20c5eddad53a23d8603e0927b20e4de81db97"
  },
  {
    "id": "healSpell",
    "element": "water",
    "name": "heal-recipient-v1",
    "type": "allyTri",
    "category": "heal",
    "duration": 1250,
    "hash": "2e29ad935f6206b9af7196799cf4fc72d89f17b9ede009fda43a1ad054cb3737"
  },
  {
    "id": "rage",
    "element": "fire",
    "name": "rage-recipient-v1",
    "type": "allyTri",
    "category": "buff",
    "duration": 1500,
    "hash": "b375c26a4682389f39f5e4f6de09c497e2202c7b8db7156db4015679c213d4fd"
  },
  {
    "id": "dodgeSkill",
    "element": "wind",
    "name": "dodge-recipient-v1",
    "type": "allyTri",
    "category": "buff",
    "duration": 1600,
    "hash": "b0c103f51eaf797e1bfae2f1978f97a3a61546a4183a4677ec7e911bcb5b6c72"
  },
  {
    "id": "rockWall",
    "element": "earth",
    "name": "rock-wall-recipient-v1",
    "type": "allyTri",
    "category": "buff",
    "duration": 1700,
    "hash": "63a72336806d201d97c45a45694348607dda1e41fc7c44fce2416ed962e47619"
  },
  {
    "id": "stormRain",
    "element": "wind",
    "name": "storm-rain-recipient-v1",
    "type": "all",
    "category": "magic",
    "duration": 1700,
    "hash": "14030ab012199d821152b8a3585233893a85c9fc6a4cb18b278ecccccf7bcb46"
  },
  {
    "id": "dinghaishenzhen",
    "element": "wind",
    "name": "calm-mind-cast-person-v2",
    "type": "allyAll",
    "category": "buff",
    "duration": 2200,
    "hash": "72a44e3f6137481f928619b234a707e6a4c40f154da6a42834af791439b6be8f"
  }
];
test("recipient replacements preserve exact lossless source bytes, alpha and square frame ratio",()=>{
 const manifest=loadRuntime().context.v143SkillAnimationManifest;
 for(const spec of RECIPIENT_CAST_CASES){
  const file="assets/vfx/"+spec.element+"/"+spec.name+".webp",bytes=fs.readFileSync(file),info=losslessWebpInfo(bytes),sprite=manifest[spec.id].sprite;
  assert.deepEqual([info.width,info.height,info.alpha],[1448,1086,1],spec.id);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),spec.hash,spec.id);
  assert.deepEqual(bytes,fs.readFileSync("tools/vfx-commercial-sample/assets/full/"+spec.name+".webp"),spec.id);
  assert.equal(sprite.src,file);assert.equal(sprite.presentation,"per-recipient");
  assert.deepEqual([sprite.columns,sprite.rows,sprite.frames,sprite.hitFrame],[4,3,12,7]);
  assert.equal((info.width/sprite.columns)/(info.height/sprite.rows),1);
 }
});
test("recipient casts preserve formal target sets across both sides, six-slot formations and casualties",()=>{
 for(const spec of RECIPIENT_CAST_CASES){for(const count of [3,6]){for(const partial of [false,true]){
  const all=/^(all|allyAll)$/.test(spec.type),indexes=partial?(count===3?[0,2]:[1,4]):count===3?[0,1,2]:all?[0,1,2,3,4,5]:[1,3,5];
  const side=/^ally/.test(spec.type)?"player":"monster";
  const rects=Array.from({length:count},(_,i)=>({left:30+i*65,top:360,right:90+i*65,bottom:476,width:60,height:116}));
  const portraits=rects.map(r=>({left:r.left+5,top:375,width:40,height:80}));
  const runtime=loadRuntime({playerRects:rects,monsterRects:rects,renderGeometry:{getUnitGeometry(s,i){return s===side&&portraits[i]?{artworkProjection:{rect:portraits[i]}}:null;}}});runtime.setClock(100);
  const config={id:spec.id,name:spec.id,element:spec.element,category:spec.category,targetType:spec.type,duration:spec.duration,resolveDuration:spec.duration};
  runtime.context.v142SkillAnimationDirector.play(config,{side:"player",actorIndex:0,targetSide:side,targetId:indexes[0],targetIds:indexes});
  const current=runtime.context.v143SkillAnimationState.current,nodes=stageSprites(runtime).sprites;
  assert.equal(nodes.length,indexes.length,spec.id);assert.equal(current.targetType,spec.type);
  assert.deepEqual(Array.from(current.targetIds),indexes);assert.deepEqual(nodes.map(n=>Number(n.dataset.targetIndex)),indexes);
  indexes.forEach((i,j)=>{const n=nodes[j],p=portraits[i];assert.equal(n.style.left,(p.left+p.width/2)+"px");assert.equal(n.style.top,(p.top+p.height/2)+"px");assert.equal(n.style.getPropertyValue("--v143-sprite-duration"),spec.duration+"ms");assert.equal(n.style.getPropertyValue("--v143-sprite-delay"),"0ms");});
  const outsider=Array.from({length:count},(_,i)=>i).find(i=>!indexes.includes(i));
  if(outsider!==undefined){runtime.context.v143ResolveBattleFeedbackTiming(side,outsider,"heal",false);assert.equal(current.spriteNodes.has(String(outsider)),false,spec.id+" does not expand recipient set");}
  assert.equal(runtime.raf.length,1);let delivered=0;runtime.context.v143RunAtTargetHit(side,indexes[0],()=>delivered++);runtime.context.v142SkillAnimationDirector.dispose();assert.equal(current.hitCallbacks.size,0);assert.equal(delivered,0);assert.equal(runtime.body.querySelectorAll("#v143-skill-stage").length,0);
 }}}
});

test("Freeze column and tri artwork follows only formal portrait recipients on both sides",()=>{
 for(const side of ["player","monster"]){for(const [type,indexes] of [["column",[0,3]],["tri",[0,1,2]]]){
  const rects=Array.from({length:6},(_,i)=>({left:40+(i%3)*100,top:120+Math.floor(i/3)*150,right:120+(i%3)*100,bottom:240+Math.floor(i/3)*150,width:80,height:120}));
  const portraits=rects.map(r=>({left:r.left+10,top:r.top+20,width:60,height:90}));
  const runtime=loadRuntime({playerRects:rects,monsterRects:rects,renderGeometry:{getUnitGeometry(s,i){return s===side?{artworkProjection:{rect:portraits[i]}}:null;}}});runtime.setClock(100);
  runtime.context.v142SkillAnimationDirector.play({id:"freeze",element:"water",category:"magic",targetType:type,duration:950},{side:side==="player"?"monster":"player",actorIndex:0,targetSide:side,targetId:indexes[0],targetIds:indexes});
  const current=runtime.context.v143SkillAnimationState.current,nodes=stageSprites(runtime).sprites;
  assert.equal(current.targetType,type);assert.deepEqual(Array.from(current.targetIds),indexes);
  assert.deepEqual(nodes.map(n=>Number(n.dataset.targetIndex)),indexes,"each formal target receives its own ice prison");
  indexes.forEach((i,j)=>{const p=portraits[i];assert.equal(nodes[j].style.left,(p.left+p.width/2)+"px");assert.equal(nodes[j].style.top,(p.top+p.height/2)+"px");});
  runtime.context.v143ResolveBattleFeedbackTiming(side,5,"hp",false);assert.equal(current.spriteNodes.has("5"),false,"nonrecipient feedback must not create another ice prison");
  assert.equal(runtime.raf.length,1);runtime.context.v142SkillAnimationDirector.dispose();assert.equal(runtime.body.querySelectorAll("#v143-skill-stage").length,0);
 }}
});

test("stormFlurry sample centers one original paired-fist slice on each formal recipient without a new hit clock",()=>{
 const portraits=[{left:301,top:80,width:70,height:98},{left:405,top:101,width:80,height:110},{left:520,top:87,width:64,height:102}];
 for(const side of ['monster','player']){
  const runtime=loadRuntime({renderGeometry:{getUnitGeometry(s,i){return s===side?{artworkProjection:{rect:portraits[i]}}:null;}}});
  runtime.setClock(100);
  const gate=runtime.context.v142SkillAnimationDirector.play(config('stormFlurry','tri','physical'),{side:side==='monster'?'player':'monster',actorIndex:0,targetSide:side,targetId:1,targetIds:[0,1,2]});
  const nodes=stageSprites(runtime).sprites;assert.equal(gate.config.duration,1500);assert.equal(gate.config.targetType,'tri');assert.equal(nodes.length,3);
  nodes.forEach((node,i)=>{const p=portraits[i];assert.equal(node.dataset.targetIndexes,String(i));assert.equal(node.style.left,(p.left+p.width/2)+'px');assert.equal(node.style.top,(p.top+p.height/2)+'px');assert.equal(node.dataset.recipientSlice,'center-third');assert.equal(node.style.clipPath,'inset(0 33.333333%)');assert.equal(node.style['--v143-sprite-duration'],'1500ms');});
  const before=runtime.scheduled.length;
  [0,1,2].forEach(i=>{const delay=runtime.context.v143RunAtTargetHit(side,i,()=>{},true);assert.ok(delay>=749&&delay<=751,'original .5 hit stays750ms');});
  assert.equal(runtime.scheduled.length,before,'recipient visuals reuse the existing per-target hit tasks');
  runtime.context.v143ResolveBattleFeedbackTiming(side,5,'hp',false);assert.equal(stageSprites(runtime).sprites.length,3,'unrelated feedback cannot add a target');
  runtime.context.v142SkillAnimationDirector.dispose();assert.equal(runtime.body.querySelectorAll('#v143-skill-stage').length,0,'dispose cleans recipient effects');
 }
});
test("stormFlurry casualties and effective Boss-single only paint explicit living recipients",()=>{
 for(const [type,targets] of [['tri',[0,2]],['single',[2]]]){
  const runtime=loadRuntime({monsters:[{alive:true,hp:100,statusEffects:[],activeBuffs:[]},{alive:false,hp:0,statusEffects:[],activeBuffs:[]},{alive:true,hp:100,statusEffects:[],activeBuffs:[]}]});
  const gate=runtime.context.v142SkillAnimationDirector.play(config('stormFlurry',type,'physical'),{side:'player',actorIndex:0,targetSide:'monster',targetId:2,targetIds:targets});
  assert.equal(gate.config.targetType,type);assert.deepEqual(stageSprites(runtime).sprites.map(n=>Number(n.dataset.targetIndex)),targets);runtime.context.v142SkillAnimationDirector.dispose();
 }
});

test("production config sweeps by screen position on both sides; callbacks remain target-local and gate unchanged",()=>{
 for(const side of ["monster","player"]){
  const rects=[300,100,200].map(left=>({left,top:90,right:left+70,bottom:190,width:70,height:100}));
  const runtime=loadRuntime({feedback:true,playerRects:rects,monsterRects:rects,renderGeometry:{getUnitGeometry(s,i){return {artworkProjection:{rect:rects[i]}};}}});
  runtime.setClock(100);const gate=runtime.context.v142SkillAnimationDirector.play(config("stormFlurry","tri","physical"),{side:side==="monster"?"player":"monster",targetSide:side,targetId:0,targetIds:[0,1,2]});runtime.setClock(100);
  const seen=[];[1,2,0].forEach((i,rank)=>assert.equal(runtime.context.v143RunAtTargetHit(side,i,()=>seen.push(i),true),750+rank*100));
  const fire=(delay,time)=>{runtime.setClock(time);runtime.scheduled.find(s=>s.delay===delay).callback();for(let n=0;n<2;n++)runtime.raf.splice(0).forEach(fn=>fn(time));};
  fire(750,850);assert.deepEqual(seen,[1]);runtime.context.v143RunAtTargetHit(side,2,()=>seen.push("late2"),true);assert.deepEqual(seen,[1]);
  fire(850,950);assert.deepEqual(seen,[1,2,"late2"]);fire(950,1050);assert.deepEqual(seen,[1,2,"late2",0]);
  assert.equal(gate.config.duration,1500);assert.equal(gate.done,false);runtime.context.v142SkillAnimationDirector.dispose();assert.equal(runtime.body.querySelectorAll("#v143-skill-stage").length,0);
 }
});

test("sweep weakening rings and icons require actual status success and disappear with the authoritative ledger",()=>{
 const rects=[100,200,300].map(left=>({left,top:90,right:left+70,bottom:190,width:70,height:100}));
 const runtime=loadRuntime({feedback:true,monsterRects:rects,renderGeometry:{getUnitGeometry(s,i){return {artworkProjection:{rect:rects[i]}};}}});
 runtime.setClock(100);runtime.context.v142SkillAnimationDirector.play(config("stormFlurry","tri","physical"),{side:"player",targetSide:"monster",targetId:0,targetIds:[0,1,2]});
 runtime.context.applyMonsterDebuff(runtime.monsters[1],"damageDown",2,30);runtime.setClock(100);
 for(const [delay,time] of [[750,850],[850,950],[950,1050]]){runtime.setClock(time);runtime.scheduled.find(s=>s.delay===delay).callback();for(let n=0;n<2;n++)runtime.raf.splice(0).forEach(fn=>fn(time));}
 const rings=runtime.context.v143SkillAnimationState.current.hitFeedback.snapshot().filter(n=>n.kind==="weaken");
 assert.deepEqual(Array.from(rings,n=>n.targetIndex),["1"]);assert.ok(runtime.cards.battleMonster1.querySelector(".v143-status-icon-damageDown"));
 assert.equal(runtime.cards.battleMonster0.querySelector(".v143-status-icon-damageDown"),null);
 runtime.monsters[1].statusEffects=[];runtime.context.v143SyncStatusVisualEffects();assert.equal(runtime.cards.battleMonster1.querySelector(".v143-status-icon-damageDown"),null);
 runtime.context.v142SkillAnimationDirector.dispose();
});

test("automatic support observes only a new expected successful named-buff entry, including identical refresh",()=>{
 for(const mode of ["blocked","unrelated","refresh"]){
  const rects=[100,200,300].map(left=>({left,top:90,right:left+70,bottom:190,width:70,height:100}));
  const r=loadRuntime({feedback:true,playerRects:rects,renderGeometry:{getUnitGeometry(s,i){return {artworkProjection:{rect:rects[i]}};}}});
  const prior={type:"rockWall",turnsLeft:4,percent:30};r.party[0].activeBuffs=[prior];r.setClock(100);
  r.context.v142SkillAnimationDirector.play({id:"rockWall",element:"earth",category:"buff",targetType:"ally",duration:1500,resolveDuration:1500},{side:"player",targetSide:"player",targetId:0,targetIds:[0]});r.setClock(100);
  const current=r.context.v143SkillAnimationState.current;let cues=0;current.hitFeedback.support=()=>{cues++;};
  if(mode!=="blocked")r.party[0].activeBuffs.push({type:mode==="refresh"?"rockWall":"rage",turnsLeft:4,percent:30});
  r.setClock(850);r.scheduled.find(j=>j.delay===750).callback();for(let n=0;n<2;n++)r.raf.splice(0).forEach(fn=>fn(850));
  assert.equal(cues,mode==="refresh"?1:0,mode);r.context.v142SkillAnimationDirector.dispose();
 }
});
console.log("\n"+passed+" V173.39 wind Sprite VFX tests passed.");
