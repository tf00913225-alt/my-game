const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const zlib=require("node:zlib");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const rules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

function pngInfo(buffer){
    assert.equal(buffer.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    const chunks=[];
    let offset=8;
    while(offset<buffer.length){
        const length=buffer.readUInt32BE(offset);
        const type=buffer.toString("ascii",offset+4,offset+8);
        chunks.push({type,data:buffer.subarray(offset+8,offset+8+length)});
        offset+=12+length;
        if(type==="IEND"){ break; }
    }
    const ihdr=chunks.find(chunk=>chunk.type==="IHDR").data;
    return {
        width:ihdr.readUInt32BE(0),height:ihdr.readUInt32BE(4),
        bitDepth:ihdr[8],colorType:ihdr[9],interlace:ihdr[12],chunks
    };
}

function alphaStats(info){
    assert.equal(info.bitDepth,8);
    assert.equal(info.colorType,6);
    assert.equal(info.interlace,0);
    const compressed=Buffer.concat(
        info.chunks.filter(chunk=>chunk.type==="IDAT").map(chunk=>chunk.data)
    );
    const raw=zlib.inflateSync(compressed);
    const bytesPerPixel=4;
    const stride=info.width*bytesPerPixel;
    const pixels=Buffer.alloc(info.height*stride);
    let sourceOffset=0;
    function paeth(a,b,c){
        const p=a+b-c;
        const pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
        return pa<=pb&&pa<=pc?a:(pb<=pc?b:c);
    }
    for(let y=0;y<info.height;y++){
        const filter=raw[sourceOffset++];
        for(let x=0;x<stride;x++){
            const value=raw[sourceOffset++];
            const left=x>=bytesPerPixel?pixels[y*stride+x-bytesPerPixel]:0;
            const up=y>0?pixels[(y-1)*stride+x]:0;
            const upperLeft=y>0&&x>=bytesPerPixel?pixels[(y-1)*stride+x-bytesPerPixel]:0;
            let predictor=0;
            if(filter===1){ predictor=left; }
            else if(filter===2){ predictor=up; }
            else if(filter===3){ predictor=Math.floor((left+up)/2); }
            else if(filter===4){ predictor=paeth(left,up,upperLeft); }
            else{ assert.equal(filter,0,"unsupported PNG filter"); }
            pixels[y*stride+x]=(value+predictor)&255;
        }
    }
    let transparent=0,partial=0,opaque=0;
    for(let offset=3;offset<pixels.length;offset+=4){
        const alpha=pixels[offset];
        if(alpha===0){ transparent++; }
        else if(alpha===255){ opaque++; }
        else{ partial++; }
    }
    return {transparent,partial,opaque,total:info.width*info.height};
}

function makeNode(rect){
    const classes=new Set();
    const node={
        id:"",className:"",dataset:{},children:[],parentNode:null,offsetParent:{},
        style:{
            setProperty(name,value){ this[name]=value; },
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
        querySelector(selector){
            if(!selector.startsWith(".")){ return null; }
            const name=selector.slice(1);
            return this.children.find(child=>String(child.className||"").split(/\s+/).includes(name))||null;
        },
        querySelectorAll(selector){
            const results=[];
            const visit=current=>{
                current.children.forEach(child=>{
                    const classMatch=selector.startsWith(".")&&String(child.className||"").split(/\s+/).includes(selector.slice(1));
                    const idMatch=selector.startsWith("#")&&child.id===selector.slice(1);
                    if(classMatch||idMatch){ results.push(child); }
                    visit(child);
                });
            };
            visit(this);
            return results;
        }
    };
    return node;
}

function loadRuntime(options={}){
    const body=makeNode();
    const cards={
        battleMonsterArea:makeNode({left:250,top:40,right:850,bottom:310,width:600,height:270}),
        battlePlayerRow:makeNode({left:20,top:330,right:620,bottom:470,width:600,height:140}),
        battlePlayerCard0:makeNode({left:20,top:340,right:138,bottom:456,width:118,height:116}),
        battlePlayerCard1:makeNode({left:160,top:340,right:278,bottom:456,width:118,height:116}),
        battlePlayerCard2:makeNode({left:300,top:340,right:418,bottom:456,width:118,height:116}),
        battleMonster0:makeNode({left:300,top:90,right:376,bottom:190,width:76,height:100}),
        battleMonster1:makeNode({left:400,top:90,right:476,bottom:190,width:76,height:100}),
        battleMonster2:makeNode({left:500,top:90,right:576,bottom:190,width:76,height:100})
    };
    for(let index=3;index<10;index++){
        const left=300+(index%5)*100;
        const top=index<5?90:205;
        cards["battleMonster"+index]=makeNode({left,top,right:left+76,bottom:top+100,width:76,height:100});
    }
    const monsters=options.monsters||[
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
        {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
    ];
    const party=options.party||[
        {hp:100,statusEffects:[],activeBuffs:[]},
        {hp:100,statusEffects:[],activeBuffs:[]},
        {hp:100,statusEffects:[],activeBuffs:[]}
    ];
    let timerId=0;
    const scheduled=[];
    const monsterHits=[];
    let legacyRocketCalls=0;
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
        showMonsterHit(){ monsterHits.push(Array.from(arguments)); },
        applyBurnEffect(entity,duration,percent){
            entity.statusEffects=Array.isArray(entity.statusEffects)?entity.statusEffects:[];
            const existing=entity.statusEffects.find(effect=>effect&&effect.type==="burn");
            if(existing){ existing.turnsLeft=duration; existing.percent=percent; }
            else{ entity.statusEffects.push({type:"burn",turnsLeft:duration,percent}); }
        },
        v141PlayCardEffect(){},
        playFireRocketAnimation(){ legacyRocketCalls++; },
        document:{
            body,
            createElement(){ return makeNode(); },
            getElementById(id){ return cards[id]||null; },
            querySelectorAll(selector){ return body.querySelectorAll(selector); }
        },
        monsters,
        currentBattleMonsters:[0,1,2],
        queuedPlayerActions:{0:{target:1,targetAlly:1}},
        getSkillTargets(){ return [0,1,2]; },
        getPartyCharacterByIndex(index){ return party[index]||null; }
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(config){
            let resolve;
            const gate={done:false,reason:null,config,promise:new Promise(done=>{ resolve=done; })};
            gate.complete=function(reason){
                if(gate.done){ return false; }
                gate.done=true;gate.reason=reason;resolve(gate);return true;
            };
            return gate;
        },
        dispose(){}
    };
    vm.createContext(context);
    vm.runInContext(animation,context);
    return {
        context,body,cards,monsters,party,scheduled,monsterHits,
        legacyRocketCalls:()=>legacyRocketCalls
    };
}

function castConfig(id,duration,targetType,category="physical"){
    return {id,name:id,element:"fire",category,targetType,duration,resolveDuration:duration};
}

test("all supplied cast and loop sheets are exact RGBA Sprite Sheet grids",()=>{
    const castAssets=[
        "flame-slash-cast.png","fire-critical-cast.png","explosive-flurry-cast.png","dragon-slash-cast.png",
        "fire-rocket-cast.png","blaze-spell-cast.png","flame-tornado-cast.png",
        "phoenix-cry-cast.png","rage-cast.png"
    ];
    castAssets.forEach(name=>{
        const info=pngInfo(fs.readFileSync("assets/vfx/fire/"+name));
        assert.deepEqual([info.width,info.height,info.colorType],[1536,1152,6],name);
        const alpha=alphaStats(info);
        assert.ok(alpha.transparent>alpha.total*.12,name+" needs transparent background pixels");
        assert.ok(alpha.partial>0,name+" needs partial-alpha glow edges");
    });
    ["burn-loop.png","rage-buff-loop.png"].forEach(name=>{
        const info=pngInfo(fs.readFileSync("assets/vfx/fire/"+name));
        assert.deepEqual([info.width,info.height,info.colorType],[1536,768,6],name);
        const alpha=alphaStats(info);
        assert.ok(alpha.transparent>alpha.total*.12);
        assert.ok(alpha.partial>0);
    });
});

test("shared metadata binds exact IDs, durations, hit frame and target modes",()=>{
    const runtime=loadRuntime().context;
    const manifest=runtime.v143SkillAnimationManifest;
    const expected={
        flameSlash:["flame-slash-cast.png","single"],
        fireCritical:["fire-critical-cast.png","single"],
        explosiveFlurry:["explosive-flurry-cast.png","group"],
        dragonSlash:["dragon-slash-cast.png","single"],
        fireRocket:["fire-rocket-cast.png","trajectory"],
        blazeSpell:["blaze-spell-cast.png","single"],
        flameTornado:["flame-tornado-cast.png","single"],
        phoenixCry:["phoenix-cry-cast.png","battlefield"],
        rage:["rage-cast.png","single"]
    };
    Object.entries(expected).forEach(([id,[filename,placement]])=>{
        const sprite=manifest[id].sprite;
        assert.ok(sprite.src.split("?")[0].endsWith(filename),id);
        if(id!=="flameSlash"){ assert.ok(sprite.src.endsWith("?v=165"),id); }
        assert.deepEqual([sprite.columns,sprite.rows,sprite.frames,sprite.hitFrame],[4,3,12,7],id);
        assert.equal(sprite.placement,placement,id);
        assert.equal(manifest[id].hit,.5833333333,id);
    });
    assert.equal(manifest.fireEX.sprite,undefined,"permanent passive must not cast a sheet");
    assert.match(timing,/flameSlash:\[760/);
    assert.match(timing,/fireCritical:\[1050/);
    assert.match(timing,/explosiveFlurry:\[1450/);
    assert.match(timing,/dragonSlash:\[2800/);
    assert.match(timing,/fireRocket:\[900/);
    assert.match(timing,/blazeSpell:\[1150/);
    assert.match(timing,/flameTornado:\[2100/);
    assert.match(timing,/phoenixCry:\[3200/);
    assert.match(timing,/rage:\[1500/);
    assert.match(rules,/flameTornado:\{[\s\S]*?targetType:"single"/);
    assert.match(rules,/phoenixCry:\{[\s\S]*?targetType:"all"/);
    assert.match(rules,/rage:\{[\s\S]*?targetType:"allyTri"/);
    assert.match(timing,/if\(config\.category==="passive"\|\|config\.targetType==="none"\)\{ return null; \}/);
});

test("tri skills follow valid targets while Phoenix Cry keeps one full-field sheet",()=>{
    const tri=loadRuntime();
    tri.context.v142SkillAnimationDirector.play(
        castConfig("explosiveFlurry",1450,"tri"),{side:"player",actorIndex:0}
    );
    const triStage=tri.body.children.find(node=>node.id==="v143-skill-stage");
    const triSprites=triStage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(triSprites.length,1);
    assert.equal(triSprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(triSprites[0].style.left,"438px");
    assert.equal(triSprites[0].style.top,"140px");
    assert.equal(triSprites[0].style.width,triSprites[0].style.height,"sheet cells must stay square");
    assert.equal(triStage.children.some(node=>node.className.includes("v143-skill-flight")),false);
    assert.equal(triStage.children.some(node=>node.className.includes("v143-skill-field")),false);

    const all=loadRuntime({
        monsters:[
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
        ]
    });
    all.context.v142SkillAnimationDirector.play(
        castConfig("phoenixCry",3200,"all","magic"),{side:"player",actorIndex:0}
    );
    const allStage=all.body.children.find(node=>node.id==="v143-skill-stage");
    const phoenixes=allStage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(phoenixes.length,1,"Phoenix Cry must never clone the phoenix per target");
    assert.equal(phoenixes[0].dataset.targetIndexes,"0,2");
    const onlyOne=loadRuntime({
        monsters:[
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]}
        ]
    });
    onlyOne.context.v142SkillAnimationDirector.play(
        castConfig("phoenixCry",3200,"all","magic"),{side:"player",actorIndex:0}
    );
    const lonePhoenix=onlyOne.body.children.find(node=>node.id==="v143-skill-stage")
        .children.find(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(lonePhoenix.dataset.targetIndexes,"1");
    ["width","height","left","top"].forEach(property=>{
        assert.equal(lonePhoenix.style[property],phoenixes[0].style[property],
            "Phoenix Cry keeps its full-field placement when only one target remains");
    });
});

test("Fire Rocket uses one caster-to-target sheet and suppresses its legacy main projectile",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("fireRocket",900,"tri","magic"),{side:"player",actorIndex:0}
    );
    runtime.context.playFireRocketAnimation("battlePlayerCard0",[
        "battleMonster0","battleMonster1","battleMonster2"
    ]);
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.placement,"trajectory");
    assert.equal(sprites[0].dataset.travelToTargets,"true");
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(sprites[0].style.left,"79px");
    assert.equal(sprites[0].style.top,"398px");
    assert.equal(sprites[0].style["--v143-sprite-dx"],"359px");
    assert.equal(sprites[0].style["--v143-sprite-dy"],"-258px");
    assert.notEqual(sprites[0].style["--v143-sprite-angle"],"0deg");
    assert.equal(sprites[0].style.width,sprites[0].style.height);
    assert.equal(sprites[0].style.width,"280px");
    assert.equal(runtime.legacyRocketCalls(),0);
});

test("enemy Fire Rocket follows late target registration back to the player row",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("fireRocket",900,"tri","magic"),{side:"monster",actorIndex:0}
    );
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.equal(stage.children.filter(node=>node.className.includes("v143-vfx-sprite")).length,0);
    [0,1,2].forEach(index=>runtime.context.v141PlayCardEffect("player",index,"damage"));
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(sprites[0].style.left,"338px");
    assert.equal(sprites[0].style.top,"140px");
    assert.equal(sprites[0].style["--v143-sprite-dx"],"-119px");
    assert.equal(sprites[0].style["--v143-sprite-dy"],"258px");
});

test("Fire Slash plays one sheet on the selected target and reaches damage at frame eight",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("flameSlash",760,"single"),{side:"player",actorIndex:0}
    );
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.placement,"single");
    assert.equal(sprites[0].dataset.targetIndex,"1");
    assert.ok(parseFloat(sprites[0].style.width)<=220);
    assert.equal(stage.children.some(node=>node.className.includes("v143-skill-flight")),false);
    const before=runtime.scheduled.length;
    runtime.context.showMonsterHit(1,17,"hp",false);
    assert.equal(runtime.monsterHits.length,0);
    assert.equal(runtime.scheduled.length,before+1);
    const damageTimer=runtime.scheduled[runtime.scheduled.length-1];
    assert.ok(damageTimer.delay>=425&&damageTimer.delay<=450);
});

test("Rage creates one cast sheet inside every affected card",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("rage",1500,"allyAll","buff"),{side:"player",actorIndex:2}
    );
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,3);
    assert.deepEqual(sprites.map(node=>node.dataset.targetIndex),["0","1","2"]);
    sprites.forEach(node=>assert.equal(node.dataset.placement,"single"));
    sprites.forEach(node=>{
        assert.ok(parseFloat(node.style.width)>=120);
        assert.ok(parseFloat(node.style.width)<=148);
    });
});

test("enemy Rage allyTri waits for and animates only the three resolved targets",()=>{
    const monsters=Array.from({length:10},()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const runtime=loadRuntime({monsters});
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("rage",1500,"allyTri","buff"),{side:"monster",actorIndex:0}
    );
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.equal(stage.children.filter(node=>node.className.includes("v143-vfx-sprite")).length,0);
    [4,5,6].forEach(index=>runtime.context.v141PlayCardEffect("monster",index,"buff"));
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,3);
    assert.deepEqual(sprites.map(node=>node.dataset.targetIndex),["4","5","6"]);
});

test("enemy Rage loop begins on the hit frame and follows its canonical ledger",()=>{
    const monsters=Array.from({length:10},()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const runtime=loadRuntime({monsters});
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("rage",1500,"allyTri","buff"),{side:"monster",actorIndex:0}
    );
    monsters[4].v141TeamBuffs=[{type:"rage",turnsLeft:2}];
    runtime.context.v141PlayCardEffect("monster",4,"buff");
    runtime.context.v143SyncStatusSpriteEffects();
    assert.equal(runtime.cards.battleMonster4.querySelector(".v153-status-vfx-rage"),null);

    const impactTimer=runtime.scheduled.find(timer=>timer.delay>=860&&timer.delay<=890);
    assert.ok(impactTimer,"frame-eight Rage impact timer");
    impactTimer.callback();
    assert.ok(runtime.cards.battleMonster4.querySelector(".v153-status-vfx-rage"));
});

test("frame eight delays hit numbers together and Fire Critical keeps its critical text reaction",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("fireCritical",1050,"single"),{side:"player",actorIndex:0}
    );
    const before=runtime.scheduled.length;
    runtime.context.showMonsterHit(1,55,"hp",false);
    assert.equal(runtime.monsterHits.length,0);
    assert.equal(runtime.scheduled.length,before+1);
    const numberTimer=runtime.scheduled[runtime.scheduled.length-1];
    assert.ok(numberTimer.delay>=590&&numberTimer.delay<=620);
    numberTimer.callback();
    assert.equal(runtime.monsterHits.length,1);
    assert.equal(runtime.monsterHits[0][3],true);
    assert.ok(runtime.scheduled.some(timer=>timer.delay>=1040),"full twelve-frame gate must remain active");
});

test("Burn and Rage loops follow live status records without owning an action gate",()=>{
    const runtime=loadRuntime({
        monsters:[
            {alive:true,hp:100,statusEffects:[{type:"burn",turnsLeft:2}],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[{type:"burn",turnsLeft:2}],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[],v141TeamBuffs:[{type:"rage",turnsLeft:2}]}
        ],
        party:[
            {hp:100,statusEffects:[],activeBuffs:[{type:"rage",turnsLeft:2}]},
            {hp:100,statusEffects:[],activeBuffs:[{type:"rage",turnsLeft:0}]},
            {hp:100,statusEffects:[],activeBuffs:[]}
        ]
    });
    runtime.context.v143SyncStatusSpriteEffects();
    assert.ok(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-burn"));
    assert.equal(runtime.cards.battleMonster1.querySelector(".v153-status-vfx-burn"),null);
    assert.ok(runtime.cards.battleMonster2.querySelector(".v153-status-vfx-rage"));
    assert.ok(runtime.cards.battlePlayerCard0.querySelector(".v153-status-vfx-rage"));
    assert.equal(runtime.cards.battlePlayerCard1.querySelector(".v153-status-vfx-rage"),null);
    assert.equal(runtime.context.v143SkillAnimationState.current,null,"status loops must not open an action gate");

    runtime.monsters[0].statusEffects[0].turnsLeft=0;
    runtime.monsters[2].v141TeamBuffs[0].turnsLeft=0;
    runtime.party[0].activeBuffs[0].turnsLeft=0;
    runtime.context.v143SyncStatusSpriteEffects();
    assert.equal(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-burn"),null);
    assert.equal(runtime.cards.battleMonster2.querySelector(".v153-status-vfx-rage"),null);
    assert.equal(runtime.cards.battlePlayerCard0.querySelector(".v153-status-vfx-rage"),null);
    assert.match(
        css,
        /battle-monster\.v152-abyss-portrait\s*>\s*\.v153-status-vfx\{[\s\S]*?position:absolute\s*!important;[\s\S]*?z-index:5\s*!important;/
    );
});

test("a newly applied Burn starts its loop on the exact target hit frame",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("flameTornado",2100,"single","magic"),{side:"player",actorIndex:0}
    );
    runtime.context.showMonsterHit(1,135,"hp",false);
    const beforeBurn=runtime.scheduled.length;
    runtime.context.applyBurnEffect(runtime.monsters[1],2,3);
    assert.equal(runtime.cards.battleMonster1.querySelector(".v153-status-vfx-burn"),null);
    assert.equal(runtime.scheduled.length,beforeBurn+1);
    const statusTimer=runtime.scheduled[runtime.scheduled.length-1];
    assert.ok(statusTimer.delay>0);
    statusTimer.callback();
    assert.ok(runtime.cards.battleMonster1.querySelector(".v153-status-vfx-burn"));
    assert.equal(runtime.cards.battleMonster0.querySelector(".v153-status-vfx-burn"),null);
    assert.equal(runtime.cards.battleMonster2.querySelector(".v153-status-vfx-burn"),null);
});

test("cast sheets are one-shot, status sheets loop, and cache version is V165",()=>{
    assert.match(css,/v153FireCastFrames var\(--v143-sprite-duration,1500ms\) steps\(1,end\) 1 both/);
    assert.doesNotMatch(css,/v153FireCastFrames[^;]*infinite/);
    assert.match(css,/v153StatusSpriteFrames var\(--v153-status-duration,800ms\) steps\(1,end\) infinite/);
    assert.match(animation,/burn:\{src:"assets\/vfx\/fire\/burn-loop\.png\?v=165",columns:4,rows:2,frames:8,duration:800,collection:"statusEffects"\}/);
    assert.match(animation,/rage:\{src:"assets\/vfx\/fire\/rage-buff-loop\.png\?v=165",columns:4,rows:2,frames:8,duration:1000,collection:"activeBuffs"\}/);
    assert.match(loader,/const V_ASSET_VERSION="173\.21"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.21/);
});

console.log(`\n${passed} V153 Fire VFX tests passed.`);
