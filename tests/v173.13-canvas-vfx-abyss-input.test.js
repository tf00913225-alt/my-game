"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const legacyAbyssPatch=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function pngDimensions(path){
    const file=fs.readFileSync(path);
    assert.equal(file.toString("hex",0,8),"89504e470d0a1a0a",path);
    assert.equal(file.toString("ascii",12,16),"IHDR",path);
    return [file.readUInt32BE(16),file.readUInt32BE(20)];
}

function makeNode(rect){
    const classes=new Set();
    return {
        id:"",className:"",dataset:{},style:{
            setProperty(name,value){ this[name]=String(value); },
            getPropertyValue(name){ return this[name]||""; }
        },
        children:[],parentNode:null,offsetParent:{},width:0,height:0,
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
            const matches=[];
            const visit=parent=>parent.children.forEach(child=>{
                if(
                    (selector.startsWith(".")&&String(child.className||"").split(/\s+/).includes(selector.slice(1)))||
                    (selector.startsWith("#")&&child.id===selector.slice(1))
                ){ matches.push(child); }
                visit(child);
            });
            visit(this);
            return matches;
        }
    };
}

function loadCanvasRuntime(skillId,targetType,targetIds,duration){
    let clock=0;
    const drawCalls=[];
    const raf=[];
    const body=makeNode();
    const nodes={};
    const monsterRects=[
        {left:280,top:80,right:356,bottom:180,width:76,height:100},
        {left:400,top:80,right:476,bottom:180,width:76,height:100},
        {left:520,top:80,right:596,bottom:180,width:76,height:100}
    ];
    const player=makeNode({left:40,top:370,right:158,bottom:486,width:118,height:116});
    player.id="battlePlayerCard0";
    nodes[player.id]=player;
    body.appendChild(player);
    monsterRects.forEach((rect,index)=>{
        const card=makeNode(rect);
        card.id="battleMonster"+index;
        nodes[card.id]=card;
        body.appendChild(card);
    });
    class FakeImage{
        constructor(){ this.complete=false; this.naturalWidth=0; this.naturalHeight=0; }
        set src(value){
            this._src=value;
            this.complete=true;
            this.naturalWidth=1536;
            this.naturalHeight=1152;
            if(this.onload){ this.onload(); }
        }
    }
    const document={
        body,
        createElement(tag){
            const node=makeNode();
            if(tag==="canvas"){
                node.width=384;
                node.height=384;
                node.getContext=()=>({
                    clearRect(){},
                    drawImage(...args){ drawCalls.push(args); }
                });
            }
            return node;
        },
        getElementById(id){ return nodes[id]||null; },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    const context={
        window:null,document,console,Math,Number,Object,Array,Set,Map,Promise,Image:FakeImage,
        Date:{now:()=>clock},navigator:{deviceMemory:4,hardwareConcurrency:4},
        innerWidth:900,innerHeight:700,
        requestAnimationFrame(callback){ raf.push(callback); return raf.length; },
        cancelAnimationFrame(){},
        setTimeout(){ return 1; },clearTimeout(){},
        monsters:[0,1,2].map(()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]})),
        currentBattleMonsters:[0,1,2],
        getPartyCharacterByIndex(){ return {hp:100,statusEffects:[],activeBuffs:[]}; },
        showMonsterHit(){},showPlayerHit(){},v141PlayCardEffect(){}
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(){
            let resolve;
            const gate={done:false,reason:null,promise:new Promise(done=>{ resolve=done; })};
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
    context.v142SkillAnimationDirector.play({
        id:skillId,name:skillId,element:"water",category:"magic",
        targetType,duration,resolveDuration:duration
    },{side:"player",actorIndex:0,targetIds});
    return {
        drawCalls,
        stage:body.children.find(node=>node.id==="v143-skill-stage"),
        tick(nextClock){
            clock=nextClock;
            const callback=raf.shift();
            assert.ok(callback,"scheduled Canvas frame");
            callback();
        }
    };
}

test("the selected inbox sheets are both 1536×1152 4×3 sources",()=>{
    assert.deepEqual(pngDimensions("assets/vfx/water/water-orb-vfx.png"),[1536,1152]);
    assert.deepEqual(pngDimensions("assets/vfx/water/frost-arrow-rain-vfx.png"),[1536,1152]);
});

test("Water Ball and Ice Arrow Rain own Canvas-crop manifests",()=>{
    ["waterBall","iceArrowRain"].forEach(id=>{
        const block=animation.slice(animation.indexOf(id+":{"),animation.indexOf("},",animation.indexOf(id+":{"))+2);
        assert.match(block,/renderer:"canvas-crop"/,id);
        assert.match(block,/columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7/,id);
    });
});

test("the Canvas renderer crops only one exact source cell at runtime",()=>{
    const water=loadCanvasRuntime("waterBall","tri",[0,1,2],1400);
    const waterCanvas=water.stage.children.find(node=>node.dataset.renderer==="canvas-crop");
    assert.ok(waterCanvas);
    assert.equal(water.stage.children.filter(node=>node.dataset.renderer==="canvas-crop").length,1);
    assert.deepEqual(water.drawCalls[0].slice(1),[0,0,384,384,0,0,384,384]);
    water.tick(817);
    assert.deepEqual(water.drawCalls.at(-1).slice(1),[1152,384,384,384,0,0,384,384]);

    const rain=loadCanvasRuntime("iceArrowRain","all",[0,1,2],1600);
    const rainCanvas=rain.stage.children.find(node=>node.dataset.renderer==="canvas-crop");
    assert.ok(rainCanvas);
    assert.equal(rain.stage.children.filter(node=>node.dataset.renderer==="canvas-crop").length,1);
    assert.equal(rainCanvas.dataset.areaId,"living-targets");
    assert.equal(rainCanvas.dataset.targetIndexes,"0,1,2");
});

test("the Canvas renderer crops one fixed cell in row-major order",()=>{
    assert.match(animation,/const frameIndex=Math\.min\(11,Math\.floor\(progress\*12\)\);/);
    assert.match(animation,/const column=frameIndex%4;[\s\S]*?const row=Math\.floor\(frameIndex\/4\);/);
    assert.match(animation,/const sourceX=column\*384;[\s\S]*?const sourceY=row\*384;/);
    assert.match(
        animation,
        /context\.drawImage\([\s\S]*?image,[\s\S]*?sourceX,[\s\S]*?sourceY,[\s\S]*?384,[\s\S]*?384,[\s\S]*?0,[\s\S]*?0,[\s\S]*?node\.width,[\s\S]*?node\.height/
    );
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v166-water-cast-sprite/);
    assert.doesNotMatch(css,/data-skill="iceArrowRain"[\s\S]*?v166-water-cast-sprite/);
});

test("shared target geometry excludes dead cards and keeps one VFX node",()=>{
    assert.match(animation,/const key=placement==="single"\|\|placement==="targetTrajectory"\?index:"main";/);
    assert.match(animation,/function emittedSpriteTargets\(current\)\{[\s\S]*?canReceive\(current\.config,current\.targetSide,index\)/);
    assert.match(animation,/const coverageScale=clamp\(Number\(sprite\.coverageScale\)\|\|1\.22,1\.15,1\.3\);/);
});

test("Abyss dialogue is owned directly by the map source and has pointer plus click fallback",()=>{
    assert.match(abyss,/function openAbyssBossDialogue\(\)[\s\S]*?overlay\.onclick=[\s\S]*?launchAbyssBossBattle\(\)/);
    assert.match(abyss,/window\.v141ChallengeAbyssBoss=function\(\)[\s\S]*?return openAbyssBossDialogue\(\);/);
    assert.match(abyss,/\["pointerup","click"\]\.forEach\(type=>map\.addEventListener\(type,event=>/);
    assert.match(abyss,/event\.target&&typeof event\.target\.closest==="function"&&event\.target\.closest\("\.v143-abyss-dialogue"\)\)\{ return; \}/);
    assert.doesNotMatch(legacyAbyssPatch,/v141ChallengeAbyssBoss=function/);
});

test("the published release is V173.37",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.37"/);
    assert.match(index,/<title>四象江湖傳 V173\.37<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.37"[\s\S]*?>V173\.37<\/div>/);
});

console.log("\n"+passed+" V173.37 Canvas VFX and Abyss input tests passed.");
