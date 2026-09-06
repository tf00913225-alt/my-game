"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const zlib=require("node:zlib");

const assetPath="assets/vfx/water/frost-arrow-rain-vfx.png";
const asset=fs.readFileSync(assetPath);
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("\u2713 "+name); }

function decodePng(buffer){
    assert.equal(buffer.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    const idat=[];
    let width=0,height=0,bitDepth=0,colorType=0,interlace=0,sawEnd=false;
    for(let offset=8;offset<buffer.length;){
        assert.ok(offset+12<=buffer.length,"truncated PNG chunk header");
        const length=buffer.readUInt32BE(offset);
        assert.ok(offset+12+length<=buffer.length,"truncated PNG chunk payload");
        const type=buffer.toString("ascii",offset+4,offset+8);
        const data=buffer.subarray(offset+8,offset+8+length);
        if(type==="IHDR"){
            width=data.readUInt32BE(0);
            height=data.readUInt32BE(4);
            bitDepth=data[8];
            colorType=data[9];
            interlace=data[12];
        }else if(type==="IDAT"){
            idat.push(data);
        }else if(type==="IEND"){
            sawEnd=true;
        }
        offset+=length+12;
        if(type==="IEND"){ break; }
    }
    assert.equal(sawEnd,true);
    assert.deepEqual([width,height,bitDepth,colorType,interlace],[1536,1152,8,6,0]);
    const raw=zlib.inflateSync(Buffer.concat(idat));
    assert.equal(raw.length,height*(width*4+1),"all image data must zlib-decode");
    return {width,height};
}

function makeNode(rect){
    const classes=new Set();
    return {
        id:"",className:"",dataset:{},children:[],parentNode:null,offsetParent:{},
        style:{
            setProperty(name,value){ this[name]=String(value); },
            getPropertyValue(name){ return this[name]||""; }
        },
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
            const visit=current=>current.children.forEach(child=>{
                const match=selector==="*"||
                    (selector.startsWith("#")&&child.id===selector.slice(1))||
                    (selector.startsWith(".")&&String(child.className||"").split(/\s+/).includes(selector.slice(1)));
                if(match){ results.push(child); }
                visit(child);
            });
            visit(this);
            return results;
        }
    };
}

function loadRuntime(livingIndexes){
    const body=makeNode();
    const monsterArea=makeNode({left:240,top:30,right:680,bottom:300,width:440,height:270});
    monsterArea.id="battleMonsterArea";
    const playerArea=makeNode({left:20,top:350,right:460,bottom:500,width:440,height:150});
    playerArea.id="battlePlayerRow";
    body.appendChild(monsterArea);
    body.appendChild(playerArea);
    const cards={battleMonsterArea:monsterArea,battlePlayerRow:playerArea};
    const monsterRects=[
        {left:280,top:80,right:356,bottom:180,width:76,height:100},
        {left:400,top:80,right:476,bottom:180,width:76,height:100},
        {left:520,top:80,right:596,bottom:180,width:76,height:100}
    ];
    monsterRects.forEach((rect,index)=>{
        const card=makeNode(rect);
        card.id="battleMonster"+index;
        cards[card.id]=card;
        monsterArea.appendChild(card);
    });
    const player=makeNode({left:40,top:370,right:158,bottom:486,width:118,height:116});
    player.id="battlePlayerCard0";
    cards[player.id]=player;
    playerArea.appendChild(player);
    const monsters=[0,1,2].map(index=>({
        alive:livingIndexes.includes(index),hp:livingIndexes.includes(index)?100:0,
        statusEffects:[],activeBuffs:[]
    }));
    const scheduled=[];
    let timerId=0;
    let hitCalls=0;
    const context={
        window:null,console,Promise,Date,Math,Number,Object,Array,Set,Map,
        innerWidth:900,innerHeight:700,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout(callback,delay){
            const id=++timerId;
            scheduled.push({id,callback,delay});
            return id;
        },
        clearTimeout(){},
        showMonsterHit(){ hitCalls++; },
        v141PlayCardEffect(){},
        document:{
            body,
            createElement(){ return makeNode(); },
            getElementById(id){ return cards[id]||null; },
            querySelectorAll(selector){ return body.querySelectorAll(selector); }
        },
        monsters,
        currentBattleMonsters:[0,1,2],
        queuedPlayerActions:{0:{target:livingIndexes[0]||0}},
        getSkillTargets(){ return livingIndexes.slice(); },
        getPartyCharacterByIndex(){ return {hp:100,statusEffects:[],activeBuffs:[]}; }
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(){
            let resolve;
            const gate={done:false,reason:null,promise:new Promise(done=>{ resolve=done; })};
            gate.complete=function(reason){
                if(gate.done){ return false; }
                gate.done=true;
                gate.reason=reason;
                resolve(gate);
                return true;
            };
            return gate;
        },
        dispose(){}
    };
    vm.createContext(context);
    vm.runInContext(animation,context);
    return {context,body,scheduled,hitCalls:()=>hitCalls};
}

test("official Ice Arrow Rain sheet is a complete 4x3 RGBA PNG",()=>{
    const info=decodePng(asset);
    assert.equal(info.width/4,384);
    assert.equal(info.height/3,384);
});

test("manifest keeps one 4x3 sheet and frame-eight hit",()=>{
    const runtime=loadRuntime([0,1,2]);
    const model=runtime.context.v143SkillAnimationManifest.iceArrowRain;
    assert.equal(model.sprite.src,assetPath+"?v=173.19");
    assert.equal(model.sprite.renderer,"canvas-crop");
    assert.deepEqual([model.sprite.frameWidth,model.sprite.frameHeight],[384,384]);
    assert.deepEqual(
        [model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame],
        [4,3,12,7]
    );
    assert.equal(model.sprite.placement,"battlefield");
    assert.equal(model.sprite.fixedFormation,true);
    assert.equal(model.sprite.targetBounds,undefined);
    assert.equal(model.sprite.coverageScale,1.22);
    assert.deepEqual([model.sprite.minWidth,model.sprite.minHeight],[140,140]);
    assert.equal(model.hit,.5833333333);
    assert.match(timing,/iceArrowRain:\[1600/);
});

test("Canvas crops exactly one 384×384 frame left-to-right, top-to-bottom, once",()=>{
    assert.match(animation,/const frameIndex=Math\.min\(11,Math\.floor\(progress\*12\)\);/);
    assert.match(animation,/const column=frameIndex%4;[\s\S]*?const row=Math\.floor\(frameIndex\/4\);/);
    assert.match(animation,/const sourceX=column\*384;[\s\S]*?const sourceY=row\*384;/);
    assert.match(
        animation,
        /context\.drawImage\([\s\S]*?image,[\s\S]*?sourceX,[\s\S]*?sourceY,[\s\S]*?384,[\s\S]*?384,[\s\S]*?0,[\s\S]*?0,[\s\S]*?node\.width,[\s\S]*?node\.height/
    );
    assert.doesNotMatch(css,/data-skill="iceArrowRain"[\s\S]*?v166-water-cast-sprite/);
});

test("one shared sheet stays locked to the complete enemy formation after casualties",()=>{
    const placements=[];
    [[1],[0,1,2]].forEach(indexes=>{
        const runtime=loadRuntime(indexes);
        runtime.context.v142SkillAnimationDirector.play({
            id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",
            targetType:"all",duration:1600,resolveDuration:1600
        },{side:"player",actorIndex:0});
        const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
        const sprites=stage.children.filter(node=>String(node.className).includes("v143-vfx-sprite"));
        assert.equal(sprites.length,1,indexes.join(","));
        const sprite=sprites[0];
        assert.equal(sprite.dataset.placement,"battlefield");
        assert.equal(sprite.dataset.targetSide,"monster");
        assert.equal(sprite.dataset.areaId,"battleMonsterArea");
        assert.equal(sprite.dataset.fixedFormation,"true");
        assert.equal(sprite.dataset.targetIndexes,indexes.join(","));
        assert.equal(sprite.style.left,"460px");
        assert.equal(sprite.style.top,"165px");
        assert.equal(sprite.style.clipPath||sprite.style["clip-path"],"none");
        assert.equal(sprite.dataset.renderer,"canvas-crop");
        assert.equal(sprite.style.backgroundImage,"none","the sheet is never a CSS background");
        assert.equal(sprite.querySelectorAll(".v166-water-battlefield-tile").length,0,"no tiled copies");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);
        assert.ok(runtime.scheduled.some(timer=>timer.delay>=1590),"full 1.6 second action gate");
    });
    assert.deepEqual(placements[0],["460px","165px","537px","329px"]);
    assert.deepEqual(placements[1],placements[0],"one survivor and three survivors use the same full-formation footprint");
});

test("all damage numbers share frame eight while remaining target-specific",()=>{
    const runtime=loadRuntime([0,2]);
    runtime.context.v142SkillAnimationDirector.play({
        id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",
        targetType:"all",duration:1600,resolveDuration:1600
    },{side:"player",actorIndex:0});
    const before=runtime.scheduled.length;
    runtime.context.showMonsterHit(0,10,"hp");
    runtime.context.showMonsterHit(2,10,"hp");
    const candidates=runtime.scheduled.slice(before).filter(timer=>timer.delay>=920&&timer.delay<=950);
    const timers=[];
    candidates.forEach(timer=>{
        const hitsBefore=runtime.hitCalls();
        timer.callback();
        if(runtime.hitCalls()>hitsBefore){ timers.push(timer); }
    });
    assert.equal(timers.length,2);
    assert.ok(Math.abs(timers[0].delay-timers[1].delay)<=3,"all living enemies hit together");
    assert.equal(runtime.hitCalls(),2,"each real card owns its own damage number");
});

test("the current cache version publishes the 1.6 second battlefield choreography",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.58"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.58/);
    assert.match(animation,/frost-arrow-rain-vfx\.png\?v=173\.19/);
});

console.log("\n"+passed+" V150 Ice Arrow Rain VFX tests passed.");
