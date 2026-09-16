const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const zlib=require("node:zlib");

const slotOwner=fs.readFileSync("js/battlefield-slot-owner.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const rules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
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

function rect(left,top,width,height){
    return {left,top,width,height,right:left+width,bottom:top+height};
}

function center(box){
    return {x:box.left+box.width/2,y:box.top+box.height/2};
}

function matches(node,selector){
    const slotMatch=String(selector||"").match(/^\.([\w-]+)\[data-slot="([^"]+)"\]$/);
    if(slotMatch){
        return String(node.className||"").split(/\s+/).includes(slotMatch[1])&&node.dataset.slot===slotMatch[2];
    }
    if(String(selector||"").startsWith("#")){ return node.id===selector.slice(1); }
    if(String(selector||"").startsWith(".")){
        const classes=selector.slice(1).split(".");
        const nodeClasses=String(node.className||"").split(/\s+/);
        return classes.every(name=>nodeClasses.includes(name));
    }
    return false;
}

function queryAll(root,selector){
    const selectors=String(selector||"").split(",").map(value=>value.trim()).filter(Boolean);
    const results=[];
    const visit=current=>{
        (current.children||[]).forEach(child=>{
            if(selectors.some(part=>matches(child,part))){ results.push(child); }
            visit(child);
        });
    };
    visit(root);
    return results;
}

function makeNode(box=null){
    const classes=new Set();
    const node={
        id:"",className:"",dataset:{},children:[],parentNode:null,parentElement:null,offsetParent:{},
        style:{
            setProperty(name,value){ this[name]=String(value); },
            getPropertyValue(name){ return this[name]||""; }
        },
        classList:{
            add(...names){ names.forEach(name=>classes.add(name)); },
            remove(...names){ names.forEach(name=>classes.delete(name)); },
            contains(name){ return classes.has(name)||String(node.className||"").split(/\s+/).includes(name); }
        },
        appendChild(child){ child.parentNode=this; child.parentElement=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(item=>item!==child); child.parentNode=null; child.parentElement=null; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } },
        setAttribute(name,value){ this[name]=String(value); },
        get childElementCount(){ return this.children.length; },
        getBoundingClientRect(){ return box||rect(0,0,0,0); },
        querySelector(selector){ return queryAll(this,selector)[0]||null; },
        querySelectorAll(selector){ return queryAll(this,selector); }
    };
    return node;
}

function loadRuntime(options={}){
    const body=makeNode();
    const battlePage=makeNode(rect(0,0,900,700));
    battlePage.id="battlePage";
    body.appendChild(battlePage);

    const slotNodes={};
    const enemyXs=[100,220,340,460,580];
    const allyXs=[180,340,500];
    ["B","F"].forEach((row,rowIndex)=>{
        enemyXs.forEach((left,index)=>{
            const id=`ENEMY_${row}${index+1}`;
            const node=makeNode(rect(left,rowIndex===0?60:180,80,100));
            node.className="v-fixed-enemy-slot";
            node.dataset.slot=id;
            slotNodes[id]=node;
            battlePage.appendChild(node);
        });
    });
    ["F","B"].forEach((row,rowIndex)=>{
        allyXs.forEach((left,index)=>{
            const id=`ALLY_${row}${index+1}`;
            const node=makeNode(rect(left,rowIndex===0?420:540,100,100));
            node.className="v-fixed-ally-slot";
            node.dataset.slot=id;
            slotNodes[id]=node;
            battlePage.appendChild(node);
        });
    });

    const cards={
        battleMonsterArea:makeNode(rect(250,40,600,270)),
        battlePlayerRow:makeNode(rect(20,330,600,140)),
        battlePlayerCard0:makeNode(rect(20,340,118,116)),
        battlePlayerCard1:makeNode(rect(160,340,118,116)),
        battlePlayerCard2:makeNode(rect(300,340,118,116)),
        battleMonster0:makeNode(rect(300,90,76,100)),
        battleMonster1:makeNode(rect(400,90,76,100)),
        battleMonster2:makeNode(rect(500,90,76,100))
    };
    for(let index=3;index<10;index++){
        const left=300+(index%5)*100;
        const top=index<5?90:205;
        cards["battleMonster"+index]=makeNode(rect(left,top,76,100));
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
    const currentBattleMonsters=options.currentBattleMonsters||monsters.map((_,index)=>index);
    let timerId=0;
    const scheduled=[];
    const monsterHits=[];
    const misses=[];
    let legacyRocketCalls=0;
    const allById={battlePage,...cards};
    const document={
        body,
        createElement(){ return makeNode(); },
        getElementById(id){ return allById[id]||null; },
        querySelector(selector){ return battlePage.querySelector(selector)||body.querySelector(selector); },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }
    };
    const context={
        window:null,document,console,Promise,Date,Math,Number,Object,Array,Set,Map,
        innerWidth:900,innerHeight:700,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout(callback,delay){
            const id=++timerId;
            scheduled.push({id,callback,delay});
            return id;
        },
        clearTimeout(){},
        showMonsterHit(){ monsterHits.push(Array.from(arguments)); },
        showMissEffect(){ misses.push(Array.from(arguments)); },
        applyBurnEffect(entity,duration,percent){
            entity.statusEffects=Array.isArray(entity.statusEffects)?entity.statusEffects:[];
            const existing=entity.statusEffects.find(effect=>effect&&effect.type==="burn");
            if(existing){ existing.turnsLeft=duration; existing.percent=percent; }
            else{ entity.statusEffects.push({type:"burn",turnsLeft:duration,percent}); }
        },
        v141PlayCardEffect(){},
        playFireRocketAnimation(){ legacyRocketCalls++; },
        monsters,currentBattleMonsters,
        queuedPlayerActions:{0:{target:1,targetAlly:1}},
        getSkillTargets(){ return [0,1,2].filter(index=>currentBattleMonsters.includes(index)); },
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
    vm.runInContext(slotOwner,context);
    const owner=context.FourSymbolsBattlefieldSlots;
    assert.ok(owner,"formal Fixed Slot owner must install");
    const snapshot=owner.createEnemyFormationSnapshot(
        currentBattleMonsters,
        {originalFormationType:Math.max(1,currentBattleMonsters.length)}
    );
    owner.setActiveEnemySnapshot(snapshot);
    owner.ensureAllyFormation([0,1,2]);
    vm.runInContext(animation,context);
    return {
        context,owner,snapshot,slotNodes,body,cards,monsters,party,scheduled,monsterHits,misses,
        legacyRocketCalls:()=>legacyRocketCalls
    };
}

function castConfig(id,duration,targetType,category="physical"){
    return {id,name:id,element:"fire",category,targetType,duration,resolveDuration:duration};
}

function stageSprites(runtime){
    const stage=runtime.body.children.find(node=>node.id==="v143-skill-stage");
    assert.ok(stage,"V143 stage must exist");
    return {stage,sprites:stage.children.filter(node=>String(node.className||"").includes("v143-vfx-sprite"))};
}

function enemySlot(runtime,index){
    return runtime.owner.getEnemySlotForMonster(runtime.snapshot,index);
}

function allySlot(runtime,index){
    return runtime.owner.getAllySlotForCharacter(index);
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
    assert.equal(enemySlot(tri,0),"ENEMY_F2");
    assert.equal(enemySlot(tri,1),"ENEMY_F3");
    assert.equal(enemySlot(tri,2),"ENEMY_F4");
    const triPrimary=enemySlot(tri,1);
    const triSlots=tri.owner.getGeometrySlotsFromShape("enemy",triPrimary,"tri");
    const triRect=tri.owner.getGeometryRectFromShape("enemy",triPrimary,"tri");
    assert.deepEqual(Array.from(triSlots),["ENEMY_F2","ENEMY_F3","ENEMY_F4"]);
    tri.context.v142SkillAnimationDirector.play(
        castConfig("explosiveFlurry",1450,"tri"),{side:"player",actorIndex:0}
    );
    const triResult=stageSprites(tri);
    assert.equal(triResult.sprites.length,1);
    assert.equal(triResult.sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(Number.parseFloat(triResult.sprites[0].style.left),triRect.centerX);
    assert.equal(Number.parseFloat(triResult.sprites[0].style.top),triRect.centerY);
    const oldCards=[0,1,2].map(index=>tri.cards["battleMonster"+index].getBoundingClientRect());
    const oldCenter={
        x:(Math.min(...oldCards.map(box=>box.left))+Math.max(...oldCards.map(box=>box.right)))/2,
        y:(Math.min(...oldCards.map(box=>box.top))+Math.max(...oldCards.map(box=>box.bottom)))/2
    };
    assert.notDeepEqual(oldCenter,{x:triRect.centerX,y:triRect.centerY});
    assert.equal(triResult.sprites[0].style.width,triResult.sprites[0].style.height,"sheet cells must stay square");
    assert.equal(triResult.stage.children.some(node=>node.className.includes("v143-skill-flight")),false);
    assert.equal(triResult.stage.children.some(node=>node.className.includes("v143-skill-field")),false);

    const all=loadRuntime({
        monsters:[
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]},
            {alive:false,hp:0,statusEffects:[],activeBuffs:[]},
            {alive:true,hp:100,statusEffects:[],activeBuffs:[]}
        ]
    });
    const sideRect=all.owner.getSideRect("monster");
    all.context.v142SkillAnimationDirector.play(
        castConfig("phoenixCry",3200,"all","magic"),{side:"player",actorIndex:0}
    );
    const phoenixes=stageSprites(all).sprites;
    assert.equal(phoenixes.length,1,"Phoenix Cry must never clone the phoenix per target");
    assert.equal(phoenixes[0].dataset.targetIndexes,"0,2");
    assert.equal(Number.parseFloat(phoenixes[0].style.left),sideRect.centerX);
    assert.equal(Number.parseFloat(phoenixes[0].style.top),sideRect.centerY);
    assert.notDeepEqual(center(all.cards.battleMonsterArea.getBoundingClientRect()),{x:sideRect.centerX,y:sideRect.centerY});

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
    const lonePhoenix=stageSprites(onlyOne).sprites[0];
    assert.equal(lonePhoenix.dataset.targetIndexes,"1");
    ["width","height","left","top"].forEach(property=>{
        assert.equal(lonePhoenix.style[property],phoenixes[0].style[property],
            "Phoenix Cry keeps its formal full-field placement when only one target remains");
    });
});

test("Fire Rocket uses one caster-to-target sheet and suppresses its legacy main projectile",()=>{
    const runtime=loadRuntime();
    const actorSlot=allySlot(runtime,0);
    const actorCenter=runtime.owner.getSlotCenter(actorSlot);
    const targetRect=runtime.owner.getGeometryRectFromShape("enemy",enemySlot(runtime,1),"tri");
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("fireRocket",900,"tri","magic"),{side:"player",actorIndex:0}
    );
    runtime.context.playFireRocketAnimation("battlePlayerCard0",[
        "battleMonster0","battleMonster1","battleMonster2"
    ]);
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.placement,"trajectory");
    assert.equal(sprites[0].dataset.travelToTargets,"true");
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(Number.parseFloat(sprites[0].style.left),actorCenter.x);
    assert.equal(Number.parseFloat(sprites[0].style.top),actorCenter.y);
    assert.equal(Number.parseFloat(sprites[0].style["--v143-sprite-dx"]),targetRect.centerX-actorCenter.x);
    assert.equal(Number.parseFloat(sprites[0].style["--v143-sprite-dy"]),targetRect.centerY-actorCenter.y);
    assert.notDeepEqual(center(runtime.cards.battlePlayerCard0.getBoundingClientRect()),{x:actorCenter.x,y:actorCenter.y});
    assert.notEqual(sprites[0].style["--v143-sprite-angle"],"0deg");
    assert.equal(sprites[0].style.width,sprites[0].style.height);
    const rocket=runtime.context.v143SkillAnimationManifest.fireRocket.sprite;
    const naturalSize=(Math.max(targetRect.width,targetRect.height)+40)*rocket.scale;
    const expectedSize=Math.round(Math.max(rocket.minSize,Math.min(rocket.maxSize,naturalSize)));
    assert.equal(Number.parseFloat(sprites[0].style.width),expectedSize,"Fire Rocket keeps its authored scale on formal Fixed Slot tri geometry");
    assert.equal(runtime.legacyRocketCalls(),0);
});

test("enemy Fire Rocket follows late target registration back to the player row",()=>{
    const runtime=loadRuntime();
    const actorCenter=runtime.owner.getSlotCenter(enemySlot(runtime,0));
    const playerPrimary=allySlot(runtime,1);
    const targetRect=runtime.owner.getGeometryRectFromShape("ally",playerPrimary,"tri");
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("fireRocket",900,"tri","magic"),{side:"monster",actorIndex:0}
    );
    const stage=stageSprites(runtime).stage;
    assert.equal(stage.children.filter(node=>node.className.includes("v143-vfx-sprite")).length,0);
    [0,1,2].forEach(index=>runtime.context.v141PlayCardEffect("player",index,"damage"));
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.targetIndexes,"0,1,2");
    assert.equal(Number.parseFloat(sprites[0].style.left),actorCenter.x);
    assert.equal(Number.parseFloat(sprites[0].style.top),actorCenter.y);
    assert.equal(Number.parseFloat(sprites[0].style["--v143-sprite-dx"]),targetRect.centerX-actorCenter.x);
    assert.equal(Number.parseFloat(sprites[0].style["--v143-sprite-dy"]),targetRect.centerY-actorCenter.y);
});

test("Fire Slash plays one sheet on the selected target and reaches damage at frame eight",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("flameSlash",760,"single"),{side:"player",actorIndex:0}
    );
    const {stage,sprites}=stageSprites(runtime);
    assert.equal(sprites.length,1);
    assert.equal(sprites[0].dataset.placement,"single");
    assert.equal(sprites[0].dataset.targetIndex,"1");
    const targetCenter=runtime.owner.getSlotCenter(enemySlot(runtime,1));
    assert.equal(Number.parseFloat(sprites[0].style.left),targetCenter.x);
    assert.equal(Number.parseFloat(sprites[0].style.top),targetCenter.y);
    assert.ok(parseFloat(sprites[0].style.width)<=220,"single-target VFX keeps the original scale ceiling");
    assert.equal(stage.children.some(node=>node.className.includes("v143-skill-flight")),false);
    const before=runtime.scheduled.length;
    runtime.context.showMonsterHit(1,17,"hp",false);
    assert.equal(runtime.monsterHits.length,0);
    assert.equal(runtime.scheduled.length,before+1);
    const damageTimer=runtime.scheduled[runtime.scheduled.length-1];
    assert.ok(damageTimer.delay>=425&&damageTimer.delay<=450);
});

test("MISS still plays the formal skill Sprite and keeps MISS feedback on hit timing",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("flameSlash",760,"single"),{side:"player",actorIndex:0}
    );
    const {stage}=stageSprites(runtime);
    const sprite=stage.children.find(node=>node.className.includes("v143-vfx-sprite"));
    assert.ok(sprite);
    assert.equal(sprite.style.visibility,"visible","a positioned cast Sprite is visible before outcome resolution");
    const before=runtime.scheduled.length;
    runtime.context.showMissEffect(false,1,"MISS");
    assert.equal(sprite.style.visibility,"visible","MISS must not suppress the attempted skill animation");
    assert.equal(sprite.dataset.confirmedHit,"true","MISS resolves the target through the formal V143 endpoint");
    assert.equal(runtime.scheduled.length,before+1);
    runtime.scheduled[runtime.scheduled.length-1].callback();
    assert.equal(sprite.style.visibility,"visible","skill VFX remains visible while MISS feedback resolves");
    assert.equal(runtime.misses.length,1);
    assert.equal(runtime.misses[0][2],"MISS");
});

test("Rage creates one cast sheet inside every affected card",()=>{
    const runtime=loadRuntime();
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("rage",1500,"allyAll","buff"),{side:"player",actorIndex:2}
    );
    const sprites=stageSprites(runtime).sprites;
    assert.equal(sprites.length,3);
    assert.deepEqual(sprites.map(node=>node.dataset.targetIndex),["0","1","2"]);
    sprites.forEach(node=>assert.equal(node.dataset.placement,"single"));
    sprites.forEach((node,index)=>{
        const formalCenter=runtime.owner.getSlotCenter(allySlot(runtime,index));
        assert.equal(Number.parseFloat(node.style.left),formalCenter.x);
        assert.equal(Number.parseFloat(node.style.top),formalCenter.y);
        assert.ok(parseFloat(node.style.width)>0);
        assert.ok(parseFloat(node.style.width)<=runtime.context.v143SkillAnimationManifest.rage.sprite.maxSize);
    });
});

test("enemy Rage allyTri waits for and animates only the three resolved targets",()=>{
    const monsters=Array.from({length:10},()=>({alive:true,hp:100,statusEffects:[],activeBuffs:[]}));
    const runtime=loadRuntime({monsters});
    runtime.context.v142SkillAnimationDirector.play(
        castConfig("rage",1500,"allyTri","buff"),{side:"monster",actorIndex:0}
    );
    const stage=stageSprites(runtime).stage;
    assert.equal(stage.children.filter(node=>node.className.includes("v143-vfx-sprite")).length,0);
    [4,5,6].forEach(index=>runtime.context.v141PlayCardEffect("monster",index,"buff"));
    const sprites=stage.children.filter(node=>node.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,3);
    assert.deepEqual(sprites.map(node=>node.dataset.targetIndex),["4","5","6"]);
    sprites.forEach((node,arrayIndex)=>{
        const monsterIndex=[4,5,6][arrayIndex];
        const formalCenter=runtime.owner.getSlotCenter(enemySlot(runtime,monsterIndex));
        assert.equal(Number.parseFloat(node.style.left),formalCenter.x);
        assert.equal(Number.parseFloat(node.style.top),formalCenter.y);
    });
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
    assert.match(css,/v143RasterCastFrames var\(--v143-sprite-duration,1200ms\) steps\(1,end\) var\(--v143-sprite-delay,0ms\) 1 both/);
    assert.doesNotMatch(css,/v143RasterCastFrames[^;]*infinite/);
    assert.match(css,/v143StatusRasterFrames var\(--v153-status-duration,1000ms\) steps\(1,end\) infinite/);
    assert.match(animation,/burn:statusSheet\("assets\/vfx\/fire\/burn-loop\.png\?v=165",800,"statusEffects"\)/);
    assert.match(animation,/rage:statusSheet\("assets\/vfx\/fire\/rage-buff-loop\.png\?v=165",1000,"activeBuffs"\)/);
    assert.match(loader,/const V_ASSET_VERSION="173\.65"/);
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
});

console.log(`\n${passed} V153 Fire VFX tests passed.`);