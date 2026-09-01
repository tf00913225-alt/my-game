"use strict";

/* HISTORICAL SPEC SNAPSHOT (V166): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const vm=require("node:vm");
const zlib=require("node:zlib");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const support=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const waterRules=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const finalRules=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("\u2713 "+name); }

const CAST_ASSETS={
    waterKnife:"water-blade-slash-vfx.png",
    frostPunch:"frost-fist-vfx.png",
    iceSpin:"frost-spinning-slash-vfx.png",
    frostCrush:"freeze-heavy-strike-vfx.png",
    waterBall:"water-orb-vfx.png",
    floodBeast:"tidal-beast-vfx.png",
    freeze:"freeze-cast-vfx.png",
    healSpell:"water-heal-vfx.png",
    revive:"water-revive-vfx.png",
    iceArrowRain:"frost-arrow-rain-vfx.png"
};

const DURATIONS={
    waterKnife:800,
    frostPunch:900,
    iceSpin:1000,
    frostCrush:1150,
    waterBall:1400,
    floodBeast:1350,
    freeze:950,
    healSpell:1250,
    revive:1800,
    iceArrowRain:1600
};

const FINAL_HASHES={
    "freeze-cast-vfx.png":"4624d96ba55ec561687403e937dd55329ff7eb0efb0ad667ad6230146313eff8",
    "freeze-heavy-strike-vfx.png":"21067d404c0fe6405e4b2378652997a02ae144173bf9c00b23a2c3016015192d",
    "frost-arrow-rain-vfx.png":"1fd0ba6f5a8a701e426e1e317ea530ac28bd2914736acb8f17d930fe23fb9c17",
    "frost-fist-vfx.png":"aa8a39bd8987a93193f5c28c3a6f3ff4d617719e5b237407565b44ff610e7922",
    "frost-spinning-slash-vfx.png":"67f09f0f65c5aefb32d254054b0ee2af7d04a158e78a733a395208a5685b88e0",
    "frostbite-status-loop-vfx.png":"eb8e35d7de239d84cdfec48c8412afe8135683942dbb0b91cf5d5e8e30a1428b",
    "frozen-status-loop-vfx.png":"b153178e503614235e5bc807c8ee98e8777c903ba60588203bb1e7e2e436869b",
    "tidal-beast-vfx.png":"bfb1a3520a5bb95104e98d3dc6d2b3d1d6c9b2bb686b6e64a0f4840e6fcc7327",
    "water-blade-slash-vfx.png":"e2b370417926f9380ff2c3aa8762b7ff7d534ebfb8cf8d011da463e708a45bc6",
    "water-heal-vfx.png":"e927ade2449d536f6d1b68218bbcef33a257dbc8269493363dbf45137f2d445c",
    "water-orb-vfx.png":"d3bdcafbd65965a9c54c9785baa1922849f11f1c1fc905bf6c4723024c745c2d",
    "water-revive-vfx.png":"955cca67c156d0848d704ab12adf59d9692e0b46aa15b38b140cde9efeaa600d"
};

function decodeRgbaPng(path,columns,rows){
    const file=fs.readFileSync(path);
    assert.equal(file.subarray(0,8).toString("hex"),"89504e470d0a1a0a",path);
    const idat=[];
    let width=0,height=0,bitDepth=0,colorType=0,interlace=0;
    let sawEnd=false;
    for(let offset=8;offset<file.length;){
        assert.ok(offset+12<=file.length,path+" truncated PNG chunk header");
        const length=file.readUInt32BE(offset);
        assert.ok(offset+12+length<=file.length,path+" truncated PNG chunk payload");
        const type=file.toString("ascii",offset+4,offset+8);
        const data=file.subarray(offset+8,offset+8+length);
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
    assert.equal(sawEnd,true,path+" must contain IEND");
    assert.deepEqual([bitDepth,colorType,interlace],[8,6,0],path+" must be non-interlaced RGBA");
    assert.ok(width>0&&height>0,path+" dimensions");
    assert.equal(width%columns,0,path+" columns");
    assert.equal(height%rows,0,path+" rows");
    assert.equal(width/columns,height/rows,path+" cells must be square");

    const compressed=Buffer.concat(idat);
    assert.ok(compressed.length>0,path+" must contain IDAT data");
    const raw=zlib.inflateSync(compressed);
    const bytesPerPixel=4;
    const stride=width*bytesPerPixel;
    assert.equal(raw.length,height*(stride+1),path+" complete zlib decode");
    const previous=Buffer.alloc(stride);
    const current=Buffer.alloc(stride);
    let sourceOffset=0;
    let transparent=0,partial=0;
    function paeth(a,b,c){
        const estimate=a+b-c;
        const da=Math.abs(estimate-a),db=Math.abs(estimate-b),dc=Math.abs(estimate-c);
        return da<=db&&da<=dc?a:(db<=dc?b:c);
    }
    for(let y=0;y<height;y++){
        const filter=raw[sourceOffset++];
        assert.ok(filter>=0&&filter<=4,path+" PNG filter "+filter);
        for(let x=0;x<stride;x++){
            const value=raw[sourceOffset++];
            const left=x>=bytesPerPixel?current[x-bytesPerPixel]:0;
            const up=y?previous[x]:0;
            const upperLeft=y&&x>=bytesPerPixel?previous[x-bytesPerPixel]:0;
            let predictor=0;
            if(filter===1){ predictor=left; }
            else if(filter===2){ predictor=up; }
            else if(filter===3){ predictor=Math.floor((left+up)/2); }
            else if(filter===4){ predictor=paeth(left,up,upperLeft); }
            current[x]=(value+predictor)&255;
        }
        for(let x=3;x<stride;x+=4){
            const alpha=current[x];
            if(alpha===0){ transparent++; }
            else if(alpha<255){ partial++; }
        }
        current.copy(previous);
    }
    return {
        width,height,transparent,partial,total:width*height,
        sha256:crypto.createHash("sha256").update(file).digest("hex")
    };
}

function makeNode(rect){
    const classes=new Set();
    const node={
        id:"",dataset:{},children:[],parentNode:null,offsetParent:{},
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
        removeChild(child){
            this.children=this.children.filter(candidate=>candidate!==child);
            child.parentNode=null;
            return child;
        },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){
            return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0};
        },
        querySelector(selector){ return this.querySelectorAll(selector)[0]||null; },
        querySelectorAll(selector){
            const results=[];
            const matcher=candidate=>{
                if(selector==="*"){ return true; }
                if(selector.startsWith("#")){ return candidate.id===selector.slice(1); }
                if(selector.startsWith(".")){
                    return String(candidate.className||"").split(/\s+/).includes(selector.slice(1));
                }
                return false;
            };
            const visit=current=>current.children.forEach(child=>{
                if(matcher(child)){ results.push(child); }
                visit(child);
            });
            visit(this);
            return results;
        }
    };
    let className="";
    Object.defineProperty(node,"className",{
        configurable:true,enumerable:true,
        get(){ return className; },
        set(value){
            className=String(value||"");
            if(
                !node.animationStartSnapshot&&
                /(?:^|\s)(?:v153-fire-cast-sprite|v166-water-cast-sprite)(?:\s|$)/.test(className)
            ){
                node.animationStartSnapshot={
                    startLeft:node.style["--v143-sprite-start-left"]||"",
                    startTop:node.style["--v143-sprite-start-top"]||"",
                    targetLeft:node.style["--v143-sprite-target-left"]||"",
                    targetTop:node.style["--v143-sprite-target-top"]||""
                };
            }
        }
    });
    node.className="";
    return node;
}

function loadRuntime(options={}){
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

    const monsters=options.monsters||monsterRects.map(()=>({
        alive:true,hp:100,statusEffects:[],activeBuffs:[]
    }));
    const party=options.party||playerRects.map(()=>({
        hp:100,statusEffects:[],activeBuffs:[]
    }));
    const targetIndexes=options.targetIndexes||[0,1,2];
    const scheduled=[];
    const monsterHits=[];
    const playerHits=[];
    let timerId=0;
    let playCalls=0;
    let legacyIceSpinCalls=0;
    const context={
        window:null,console,Promise,Date,Math,Number,Object,Array,Set,Map,
        innerWidth:960,innerHeight:720,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout(callback,delay){
            const id=++timerId;
            scheduled.push({id,callback,delay});
            return id;
        },
        clearTimeout(){},
        showMonsterHit(){ monsterHits.push(Array.from(arguments)); },
        showPlayerHit(){ playerHits.push(Array.from(arguments)); },
        v141PlayCardEffect(){},
        playIceSpinProjectile(){ legacyIceSpinCalls++; },
        applyFreezeEffect(entity,duration){
            entity.statusEffects=Array.isArray(entity.statusEffects)?entity.statusEffects:[];
            entity.statusEffects.push({type:"freeze",turnsLeft:duration});
        },
        applySkillDebuffEffectsToPlayer(){},
        document:{
            body,
            createElement(){ return makeNode(); },
            getElementById(id){ return cards[id]||null; },
            querySelectorAll(selector){ return body.querySelectorAll(selector); }
        },
        monsters,
        currentBattleMonsters:[0,1,2],
        queuedPlayerActions:{0:{target:targetIndexes[0]||0,targetAlly:1}},
        getSkillTargets(){ return targetIndexes.slice(); },
        getPartyCharacterByIndex(index){ return party[index]||null; }
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(config){
            playCalls++;
            let resolve;
            const gate={done:false,reason:null,config,promise:new Promise(done=>{ resolve=done; })};
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
    return {
        context,body,cards,monsterArea,playerArea,monsters,party,scheduled,monsterHits,playerHits,
        playCalls:()=>playCalls,
        legacyIceSpinCalls:()=>legacyIceSpinCalls
    };
}

function castConfig(id,targetType){
    return {
        id,name:id,element:"water",category:id==="revive"?"revive":"magic",
        targetType,duration:DURATIONS[id],resolveDuration:DURATIONS[id]
    };
}

function stageSprites(runtime){
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.ok(stage,"skill stage");
    return {
        stage,
        sprites:stage.children.filter(node=>String(node.className).includes("v143-vfx-sprite"))
    };
}

test("all ten cast sheets and both status sheets fully decode as transparent RGBA grids",()=>{
    Object.values(CAST_ASSETS).forEach(filename=>{
        const path="assets/vfx/water/"+filename;
        const image=decodeRgbaPng(path,4,3);
        assert.deepEqual(
            [image.width,image.height],
            [1536,1152],
            filename
        );
        if(!["water-orb-vfx.png","frost-arrow-rain-vfx.png"].includes(filename)){
            assert.equal(image.sha256,FINAL_HASHES[filename],filename+" normalized asset hash");
        }
        assert.ok(image.transparent>image.total*.1,filename+" needs real transparent pixels");
        assert.ok(image.partial>0,filename+" needs partial alpha");
    });
    ["frostbite-status-loop-vfx.png","frozen-status-loop-vfx.png"].forEach(filename=>{
        const path="assets/vfx/water/"+filename;
        const image=decodeRgbaPng(path,4,2);
        assert.deepEqual([image.width,image.height],[1776,888],filename);
        assert.equal(image.sha256,FINAL_HASHES[filename],filename+" normalized asset hash");
        assert.ok(image.transparent>0,filename+" needs real transparent pixels");
        assert.ok(image.partial>0,filename+" needs partial alpha");
    });
});

test("water manifest uses the exact files, twelve frames, frame-eight hit and requested durations",()=>{
    const runtime=loadRuntime();
    const manifest=runtime.context.v143SkillAnimationManifest;
    Object.entries(CAST_ASSETS).forEach(([id,filename])=>{
        const model=manifest[id];
        assert.ok(model&&model.sprite,id+" sprite metadata");
        assert.equal(model.sprite.src.split("?")[0],"assets/vfx/water/"+filename,id);
        const cacheVersion=["waterBall","iceArrowRain"].includes(id)?"?v=173.19":"?v=166";
        assert.ok(model.sprite.src.endsWith(cacheVersion),id+" cache version");
        if(["waterBall","iceArrowRain"].includes(id)){
            assert.equal(model.sprite.renderer,"canvas-crop",id+" Canvas renderer");
            assert.deepEqual([model.sprite.frameWidth,model.sprite.frameHeight],[384,384],id+" fixed source crop");
        }
        assert.deepEqual(
            [model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame],
            [4,3,12,7],id
        );
        assert.equal(model.hit,.5833333333,id+" hit timing");
    });
    Object.entries(DURATIONS).forEach(([id,duration])=>{
        assert.match(timing,new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+":\\["+duration+"(?:,|\\])"),id);
    });
});

test("single-target sheets stay centered on the actual selected card",()=>{
    [
        ["waterKnife",800],
        ["frostPunch",900],
        ["frostCrush",1150]
    ].forEach(([id,duration])=>{
        const runtime=loadRuntime();
        runtime.context.v142SkillAnimationDirector.play(
            castConfig(id,"single"),
            {side:"player",actorIndex:0,targetId:2}
        );
        const {stage,sprites}=stageSprites(runtime);
        assert.equal(sprites.length,1,id);
        assert.equal(sprites[0].dataset.targetIndex,"2",id);
        assert.equal(sprites[0].style.left,"578px",id);
        assert.equal(sprites[0].style.top,"140px",id);
        assert.equal(sprites[0].style.width,sprites[0].style.height,id+" cells stay square");
        assert.equal(stage.children.some(node=>String(node.className).includes("v143-skill-flight")),false,id);
        assert.equal(sprites[0].style["--v143-sprite-duration"],duration+"ms",id);
    });
});

test("Ice Spin creates one synchronized sheet for every real target and never for an empty slot",()=>{
    [[1],[0,2],[0,1,2]].forEach(indexes=>{
        const monsters=[0,1,2].map(index=>({
            alive:indexes.includes(index),hp:indexes.includes(index)?100:0,
            statusEffects:[],activeBuffs:[]
        }));
        const runtime=loadRuntime({monsters,targetIndexes:indexes});
        runtime.context.v142SkillAnimationDirector.play(
            castConfig("iceSpin","tri"),
            {side:"player",actorIndex:0,targetIds:indexes}
        );
        const {sprites}=stageSprites(runtime);
        assert.equal(sprites.length,indexes.length,indexes.join(","));
        assert.deepEqual(
            sprites.map(node=>Number(node.dataset.targetIndex)),
            indexes,indexes.join(",")
        );
        assert.deepEqual(
            sprites.map(node=>node.style.left),
            indexes.map(index=>["338px","458px","578px"][index]),
            indexes.join(",")
        );
        indexes.forEach(index=>runtime.context.showMonsterHit(index,10,"hp"));
        const delayedNumbers=runtime.scheduled.slice(-indexes.length);
        assert.equal(delayedNumbers.length,indexes.length);
        const delays=delayedNumbers.map(timer=>Math.round(timer.delay));
        assert.ok(Math.max(...delays)-Math.min(...delays)<=3,"all real targets hit together");
        assert.ok(delays.every(delay=>delay>=570&&delay<=595),"damage waits for frames seven to eight");
    });
});

test("Water Ball renders one sheet centered on the actual living target group",()=>{
    [[1],[0,2],[0,1,2]].forEach(indexes=>{
        const monsters=[0,1,2].map(index=>({
            alive:indexes.includes(index),hp:indexes.includes(index)?100:0,
            statusEffects:[],activeBuffs:[]
        }));
        const runtime=loadRuntime({monsters,targetIndexes:indexes});
        runtime.context.v142SkillAnimationDirector.play(
            castConfig("waterBall","tri"),
            {side:"player",actorIndex:0,targetIds:indexes}
        );
        const sprites=stageSprites(runtime).sprites;
        assert.equal(sprites.length,1,indexes.join(","));
        assert.equal(sprites[0].dataset.placement,"group");
        assert.equal(sprites[0].dataset.targetIndexes,indexes.join(","));
        assert.equal(sprites[0].style.left,"458px");
        assert.equal(sprites[0].style.top,"140px");
        assert.equal(sprites[0].style["--v143-sprite-dx"],"0px");
        assert.equal(sprites[0].style["--v143-sprite-dy"],"0px");
        assert.equal(sprites[0].style["--v143-sprite-duration"],"1400ms");
    });

    const beast=loadRuntime();
    beast.context.v142SkillAnimationDirector.play(
        castConfig("floodBeast","single"),
        {side:"player",actorIndex:0,targetId:1}
    );
    const beastSprites=stageSprites(beast).sprites;
    assert.equal(beastSprites.length,1);
    assert.equal(beastSprites[0].dataset.targetIndex,"1");
    assert.ok(beastSprites[0].style["--v143-sprite-dx"]);
    assert.match(css,/@keyframes v166WaterTargetTravel\{/);
});

test("enemy Water Ball keeps one live-target group while endpoints resolve",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("waterBall","tri"),
        {side:"monster",actorIndex:0}
    );
    assert.equal(stageSprites(runtime).sprites.length,0,"enemy targets are not guessed");
    runtime.context.v141PlayCardEffect("player",0,"damage");
    runtime.context.v141PlayCardEffect("player",2,"damage");
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.placement,"group");
    assert.equal(sprites[0].dataset.targetIndexes,"0,2");
    assert.equal(sprites[0].style["--v143-sprite-dx"],"0px");
    assert.equal(sprites[0].style["--v143-sprite-dy"],"0px");
});

test("Ice Arrow Rain uses one living-target bounding box",()=>{
    const results=[];
    [[1],[0,1,2]].forEach(indexes=>{
        const monsters=[0,1,2].map(index=>({
            alive:indexes.includes(index),hp:indexes.includes(index)?100:0,
            statusEffects:[],activeBuffs:[]
        }));
        const runtime=loadRuntime({monsters,targetIndexes:indexes});
        runtime.context.v142SkillAnimationDirector.play(
            castConfig("iceArrowRain","all"),
            {side:"player",actorIndex:0}
        );
        const {sprites}=stageSprites(runtime);
        assert.equal(sprites.length,1,indexes.join(","));
        const sprite=sprites[0];
        assert.equal(sprite.dataset.targetSide,"monster");
        assert.equal(sprite.dataset.placement,"battlefield");
        assert.equal(sprite.dataset.areaId,"living-targets");
        assert.equal(sprite.dataset.targetIndexes,indexes.join(","));
        assert.equal(sprite.style.left,"458px");
        assert.equal(sprite.style.top,"140px");
        assert.equal(sprite.style.clipPath||sprite.style["clip-path"],"none");
        assert.equal(sprite.querySelectorAll(".v166-water-battlefield-tile").length,0);
        results.push([sprite.style.width,sprite.style.height]);
    });
    assert.deepEqual(results,[["140px","140px"],["386px","140px"]]);
});

test("enemy Ice Arrow Rain uses living player cards only",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("iceArrowRain","all"),{side:"monster",actorIndex:0}
    );
    const {sprites}=stageSprites(runtime);
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetSide,"player");
    assert.equal(sprites[0].dataset.areaId,"living-targets");
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(sprites[0].style.clipPath||sprites[0].style["clip-path"],"none");
    assert.equal(sprites[0].querySelectorAll(".v166-water-battlefield-tile").length,0);
});

test("enemy Tidal Beast discovers one real player endpoint even when damage is absorbed",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("floodBeast","single"),{side:"monster",actorIndex:0}
    );
    assert.equal(stageSprites(runtime).sprites.length,0);
    runtime.context.applySkillDebuffEffectsToPlayer(
        castConfig("floodBeast","single"),1,runtime.party[2],2,1,1
    );
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetIndex,"2");
    assert.equal(sprites[0].style["--v143-sprite-target-left"],"379px");
    assert.equal(sprites[0].style["--v143-sprite-target-top"],"418px");
});

test("late callbacks cannot expand a single-target Tidal Beast cast",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("floodBeast","single"),{side:"player",actorIndex:0,targetId:1}
    );
    assert.deepEqual(stageSprites(runtime).sprites.map(node=>node.dataset.targetIndex),["1"]);
    runtime.context.showMonsterHit(2,10,"hp");
    assert.deepEqual(stageSprites(runtime).sprites.map(node=>node.dataset.targetIndex),["1"]);
});

test("the retained tri-target Freeze and ally-all Heal still follow each actual card",()=>{
    const freeze=loadRuntime({targetIndexes:[0,2]});
    freeze.context.v142SkillAnimationDirector.play(
        castConfig("freeze","tri"),
        {side:"player",actorIndex:0,targetIds:[0,2]}
    );
    const freezeSprites=stageSprites(freeze).sprites;
    assert.deepEqual(freezeSprites.map(node=>node.dataset.targetIndex),["0","2"]);
    assert.deepEqual(freezeSprites.map(node=>node.style.left),["338px","578px"]);

    const heal=loadRuntime();
    heal.context.v142SkillAnimationDirector.play(
        castConfig("healSpell","allyAll"),
        {side:"player",actorIndex:0}
    );
    const healSprites=stageSprites(heal).sprites;
    assert.deepEqual(healSprites.map(node=>node.dataset.targetIndex),["0","1","2"]);
    assert.deepEqual(healSprites.map(node=>node.style.left),["99px","239px","379px"]);
});

test("Freeze and Frostbite loops mirror statusEffects only and never open an action gate",()=>{
    const monsters=[
        {alive:true,hp:100,statusEffects:[{type:"frostbite",turnsLeft:2}],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[{type:"freeze",turnsLeft:2}],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[
            {type:"frostbite",turnsLeft:2},{type:"freeze",turnsLeft:2}
        ]}
    ];
    const party=[
        {hp:100,statusEffects:[{type:"freeze",turnsLeft:2}],activeBuffs:[]},
        {hp:100,statusEffects:[{type:"frostbite",turnsLeft:2}],activeBuffs:[]},
        {hp:100,statusEffects:[],activeBuffs:[]}
    ];
    const runtime=loadRuntime({monsters,party});
    const beforePlay=runtime.playCalls();
    const hpBefore=monsters.map(monster=>monster.hp);
    runtime.context.v143SyncStatusSpriteEffects();
    assert.equal(runtime.playCalls(),beforePlay,"status rendering must not open an action gate");
    assert.deepEqual(monsters.map(monster=>monster.hp),hpBefore,"visual loops must not resolve DOT");

    const frostbite=runtime.cards.battleMonster0.querySelector(".v153-status-vfx-frostbite");
    const frozen=runtime.cards.battleMonster1.querySelector(".v153-status-vfx-freeze");
    assert.ok(frostbite,"Frostbite loop");
    assert.ok(frozen,"Frozen loop");
    assert.equal(runtime.cards.battleMonster2.querySelector(".v153-status-vfx-frostbite"),null);
    assert.equal(runtime.cards.battleMonster2.querySelector(".v153-status-vfx-freeze"),null);
    assert.ok(runtime.cards.battlePlayerCard0.querySelector(".v153-status-vfx-freeze"));
    assert.ok(runtime.cards.battlePlayerCard1.querySelector(".v153-status-vfx-frostbite"));
    assert.ok(frostbite.style.backgroundImage.includes("frostbite-status-loop-vfx.png?v=166"));
    assert.ok(frozen.style.backgroundImage.includes("frozen-status-loop-vfx.png?v=166"));
    assert.equal(frostbite.style["--v153-status-duration"],"1000ms");
    assert.equal(frozen.style["--v153-status-duration"],"1100ms");

    monsters[0].statusEffects[0].turnsLeft=0;
    monsters[1].statusEffects=[];
    runtime.context.v143SyncStatusSpriteEffects();
    assert.equal(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-frostbite"),null);
    assert.equal(runtime.cards.battleMonster1.querySelector(".v153-status-vfx-freeze"),null);
    assert.match(css,/v153-status-vfx-frostbite[\s\S]*?infinite/);
    assert.match(css,/v153-status-vfx-freeze[\s\S]*?infinite/);
});

test("existing Frozen and Frostbite loops do not restart during a duplicate cast",()=>{
    [
        {id:"freeze",type:"freeze",duration:950},
        {id:"frostCrush",type:"frostbite",duration:1150}
    ].forEach(({id,type,duration})=>{
        const monsters=[
            {alive:true,hp:100,statusEffects:[{type,turnsLeft:2}],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
        ];
        const runtime=loadRuntime({monsters,targetIndexes:[0]});
        runtime.context.v143SyncStatusSpriteEffects();
        const existing=runtime.cards.battleMonster0.querySelector(".v153-status-vfx-"+type);
        assert.ok(existing);
        runtime.context.v142SkillAnimationDirector.play(
            castConfig(id,id==="freeze"?"tri":"single"),
            {side:"player",actorIndex:0,targetId:0}
        );
        assert.strictEqual(
            runtime.cards.battleMonster0.querySelector(".v153-status-vfx-"+type),
            existing,
            id+" duplicate cast must preserve the existing loop"
        );
        const completion=runtime.scheduled.find(timer=>timer.delay>=duration-2&&timer.delay<=duration+2);
        assert.ok(completion,id+" full cast timer");
        completion.callback();
        assert.strictEqual(
            runtime.cards.battleMonster0.querySelector(".v153-status-vfx-"+type),
            existing,
            id+" duplicate cast must not restart the loop after completion"
        );
    });
});

test("enemy Freeze discovers its successful player target from the applied status",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("freeze","tri"),
        {side:"monster",actorIndex:0}
    );
    assert.equal(stageSprites(runtime).sprites.length,0);
    runtime.context.applyFreezeEffect(runtime.party[1],4);
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetIndex,"1");
    assert.equal(sprites[0].style.left,"239px");
    assert.equal(sprites[0].style.top,"418px");
    assert.equal(runtime.cards.battlePlayerCard1.querySelector(".v153-status-vfx-freeze"),null);
});

test("legacy Ice Spin projectile is suppressed while its official sheet is active",()=>{
    const runtime=loadRuntime({targetIndexes:[0,1,2]});
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("iceSpin","tri"),
        {side:"player",actorIndex:0,targetIds:[0,1,2]}
    );
    runtime.context.playIceSpinProjectile("battlePlayerCard0",[
        "battleMonster0","battleMonster1","battleMonster2"
    ]);
    assert.equal(runtime.legacyIceSpinCalls(),0);
});

test("revive activation and its HP popup wait for the frame-eight hit",()=>{
    assert.match(animation,/v143RunAtTargetHit/);
    assert.match(support,/resolvePartyRevive[\s\S]*?v143RunAtTargetHit/);
    assert.match(support,/const reviveAtImpact=\(\)=>\{[\s\S]*?target\.hp=restoredHP[\s\S]*?showPlayerHit\(restoredHP/);
    assert.match(support,/v143RunAtTargetHit\("player",targetIndex,reviveAtImpact,true\)/);
    assert.doesNotMatch(
        support,
        /target\.hp=Math\.max\([\s\S]{0,500}?setTimeout\(\(\)=>showPlayerHit/
    );
});

test("final combat targeting and Frostbite rules use the Water owner",()=>{
    assert.doesNotMatch(finalRules,/patchSkill\("freeze"/);
    assert.doesNotMatch(finalRules,/patchSkill\("healSpell"/);
    assert.match(waterRules,/freeze:\{[\s\S]*?targetType:"column"/);
    assert.match(waterRules,/healSpell:\{[\s\S]*?targetType:"allyTri"/);
    assert.match(waterRules,/frostCrush:\{[\s\S]*?frostbiteChance:25/);
    assert.match(waterRules,/iceSpin:\{[\s\S]*?frostbiteChance:20/);
});

test("the current cache version publishes the water sheets, choreography and CSS",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.24"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.24/);
    assert.match(loader,/40-v143-combat-dungeon-polish\.css/);
    assert.match(loader,/39-v143-skill-animation\.js/);
});

console.log("\nV166 Water VFX suite: "+passed+" tests passed.");
