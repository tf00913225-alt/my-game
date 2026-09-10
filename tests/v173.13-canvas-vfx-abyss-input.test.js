"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const legacyAbyssPatch=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
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
            getPropertyValue(name){ return this[name]||""; },
            removeProperty(name){ delete this[name]; }
        },
        children:[],parentNode:null,offsetParent:{},
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

function loadRasterRuntime(skillId,targetType,targetIds,duration){
    const timers=[];
    const body=makeNode();
    const nodes={};
    const monsterArea=makeNode({left:240,top:30,right:680,bottom:300,width:440,height:270});
    monsterArea.id="battleMonsterArea";
    nodes[monsterArea.id]=monsterArea;
    body.appendChild(monsterArea);
    const playerArea=makeNode({left:20,top:350,right:460,bottom:500,width:440,height:150});
    playerArea.id="battlePlayerRow";
    nodes[playerArea.id]=playerArea;
    body.appendChild(playerArea);
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
        set src(value){ this._src=value; this.complete=true; this.naturalWidth=1536; this.naturalHeight=1152; }
    }
    const document={
        body,readyState:"complete",
        createElement(){ return makeNode(); },
        getElementById(id){ return nodes[id]||null; },
        querySelectorAll(selector){ return body.querySelectorAll(selector); },
        addEventListener(){}
    };
    const context={
        window:null,document,console,Math,Number,Object,Array,Set,Map,Promise,Proxy,Image:FakeImage,
        Date,navigator:{deviceMemory:4,hardwareConcurrency:4},innerWidth:900,innerHeight:700,
        setTimeout(callback,delay){ timers.push({callback,delay}); return timers.length; },clearTimeout(){},
        monsters:[0,1,2].map(()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]})),
        currentBattleMonsters:[0,1,2],
        getPartyCharacterByIndex(){ return {hp:100,statusEffects:[],activeBuffs:[]}; },
        showMonsterHit(){},showPlayerHit(){},v141PlayCardEffect(){},addEventListener(){}
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
        context,
        stage:body.children.find(node=>node.id==="v143-skill-stage"),
        timers
    };
}

test("the selected Water sheets are both 1536×1152 4×3 sources",()=>{
    assert.deepEqual(pngDimensions("assets/vfx/water/water-orb-vfx.png"),[1536,1152]);
    assert.deepEqual(pngDimensions("assets/vfx/water/frost-arrow-rain-vfx.png"),[1536,1152]);
});

test("Water Ball and Ice Arrow Rain own DOM-raster manifests",()=>{
    const runtime=loadRasterRuntime("waterBall","tri",[0,1,2],1400);
    ["waterBall","iceArrowRain"].forEach(id=>{
        const model=runtime.context.v143SkillAnimationManifest[id];
        assert.ok(model&&model.sprite,id);
        assert.equal(model.sprite.renderer,"dom-sprite",id);
        assert.deepEqual(
            Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame]),
            [4,3,12,7],id
        );
    });
});

test("the raster renderer creates one shared Water Ball Sprite Sheet node without Canvas",()=>{
    const water=loadRasterRuntime("waterBall","tri",[0,1,2],1400);
    const sprites=water.stage.children.filter(node=>node.dataset.renderer==="dom-sprite");
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.columns,"4");
    assert.equal(sprite.dataset.rows,"3");
    assert.equal(sprite.dataset.frames,"12");
    assert.match(sprite.style.backgroundImage,/water-orb-vfx\.png\?v=173\.19/);
    assert.equal(sprite.style.left,"438px");
    assert.equal(sprite.style.top,"130px");
    assert.doesNotMatch(animation,/createElement\(["']canvas["']\)|getContext\(|drawImage\(|requestAnimationFrame\(/);
});

test("Ice Arrow Rain stays centered on the full monster battlefield",()=>{
    const rain=loadRasterRuntime("iceArrowRain","all",[0,1,2],1600);
    const sprites=rain.stage.children.filter(node=>node.dataset.renderer==="dom-sprite");
    assert.equal(sprites.length,1);
    const sprite=sprites[0];
    assert.equal(sprite.dataset.placement,"battlefield");
    assert.equal(sprite.dataset.areaId,"battleMonsterArea");
    assert.equal(sprite.style.left,"460px");
    assert.equal(sprite.style.top,"165px");
    assert.match(sprite.style.backgroundImage,/frost-arrow-rain-vfx\.png\?v=173\.19/);
});

test("CSS advances the formal 4×3 sheet row-major without procedural fallback nodes",()=>{
    assert.match(css,/@keyframes v143RasterCastFrames/);
    assert.match(css,/0%\{background-position:0 0\}/);
    assert.match(css,/25%\{background-position:100% 0\}/);
    assert.match(css,/33\.333333%\{background-position:0 50%\}/);
    assert.match(css,/66\.666667%\{background-position:0 100%\}/);
    assert.match(css,/91\.666667%,100%\{background-position:100% 100%\}/);
    assert.doesNotMatch(css,/\.v143-cast-charge|\.v143-skill-flight|\.v143-hit-impact|\.v143-hit-particle|\.v143-skill-field/);
});

test("shared target geometry keeps one group VFX node and excludes invalid targets",()=>{
    assert.match(animation,/const key=placement==="single"\|\|placement==="targetTrajectory"\?String\(index\):"main";/);
    assert.match(animation,/function emittedSpriteTargets\(current\)\{[\s\S]*?canReceive\(current\.config,current\.targetSide,index\)/);
    assert.match(animation,/const coverageScale=clamp\(Number\(sprite\.coverageScale\)\|\|Number\(sprite\.scale\)\|\|1,1,1\.4\);/);
});

test("Abyss dialogue is owned by the map and blank-area taps can advance it",()=>{
    assert.match(abyss,/function openAbyssBossDialogue\(\)[\s\S]*?launchAbyssBossBattle\(\)[\s\S]*?activeAbyssDialogueAdvance=advanceDialogue/);
    assert.match(abyss,/overlay\.onclick=event=>[\s\S]*?advanceDialogue\(\)/);
    assert.match(abyss,/window\.v141ChallengeAbyssBoss=function\(\)[\s\S]*?return openAbyssBossDialogue\(\);/);
    assert.match(abyss,/if\(activeAbyssDialogueAdvance\)[\s\S]*?activeAbyssDialogueAdvance\(\)/);
    assert.match(abyss,/function maybeTriggerFinalAbyssEncounter\(\)/);
    assert.doesNotMatch(legacyAbyssPatch,/v141ChallengeAbyssBoss=function/);
});

test("the published release metadata is still internally aligned before this branch version bump",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.64"/);
    assert.match(index,/<title>四象江湖傳 V173\.64<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.64"[\s\S]*?>V173\.64<\/div>/);
});

console.log("\n"+passed+" V173.39 raster VFX and Abyss input tests passed.");
