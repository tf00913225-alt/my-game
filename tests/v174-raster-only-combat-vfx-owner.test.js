"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const v141=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const v143fixes=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const v155=fs.readFileSync("js/46-v155-dev-fixes.js","utf8");
const css141=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const css146=fs.readFileSync("css/42-v146-system-polish.css","utf8");
const v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const v143=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css142=fs.readFileSync("css/39-v142-skill-animation.css","utf8");
const css143=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const v149=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const abyss=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
const css149=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function classList(){
    const values=new Set();
    return {
        add(...names){ names.forEach(name=>values.add(name)); },
        remove(...names){ names.forEach(name=>values.delete(name)); },
        contains(name){ return values.has(name); }
    };
}

function node(id,rect){
    return {
        id:id||"",dataset:{},children:[],style:{
            setProperty(){},removeProperty(){}
        },classList:classList(),offsetParent:{},
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        remove(){ this.removed=true; },
        setAttribute(){},
        querySelector(){ return null; },
        querySelectorAll(){ return []; },
        getBoundingClientRect(){ return rect||{left:0,top:0,right:80,bottom:100,width:80,height:100}; }
    };
}

function runtime(){
    const body=node("body",{left:0,top:0,right:420,bottom:720,width:420,height:720});
    const monster=node("battleMonster0",{left:240,top:100,right:320,bottom:200,width:80,height:100});
    const player=node("battlePlayerCard0",{left:100,top:500,right:180,bottom:600,width:80,height:100});
    const monsterArea=node("battleMonsterArea",{left:210,top:80,right:390,bottom:250,width:180,height:170});
    const playerArea=node("battlePlayerRow",{left:40,top:460,right:380,bottom:630,width:340,height:170});
    const byId={battleMonster0:monster,battlePlayerCard0:player,battleMonsterArea:monsterArea,battlePlayerRow:playerArea};
    let gateId=0;
    const director={
        play(config){
            let resolve;
            const gate={id:++gateId,config,done:false,reason:null,promise:new Promise(r=>{resolve=r;})};
            gate.complete=reason=>{
                if(gate.done){ return false; }
                gate.done=true; gate.reason=reason; resolve(gate); return true;
            };
            return gate;
        },
        dispose(){},getActive(){ return null; }
    };
    const context={
        console,Promise,Set,Map,Array,Object,Number,String,Boolean,RegExp,Date,Math,Proxy,
        setTimeout,clearTimeout,
        innerWidth:420,innerHeight:720,
        v142SkillAnimationDirector:director,
        monsters:[{name:"測試怪",hp:100,alive:true,statusEffects:[],activeBuffs:[]}],
        currentBattleMonsters:[0],
        getPartyCharacterByIndex(index){ return index===0?{id:"角色",hp:100,statusEffects:[],activeBuffs:[]}:null; },
        document:{
            body,readyState:"complete",
            createElement(tag){ return node(tag); },
            getElementById(id){ return byId[id]||null; },
            querySelectorAll(){ return []; },
            addEventListener(){}
        },
        v141PlayCardEffect(){},
        addEventListener(){}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(v143,context,{filename:"js/39-v143-skill-animation.js"});
    return context;
}

test("V142 is timing-only and contains no legacy visual renderer",()=>{
    [
        /createElement\(["']canvas["']\)/,
        /getContext\s*\(/,
        /requestAnimationFrame\s*\(/,
        /v142-particle-canvas/,
        /<svg\b/i,
        /v142-skill-stage/
    ].forEach(pattern=>assert.doesNotMatch(v142,pattern));
    assert.match(v142,/V143 owns all battle VFX/);
    assert.doesNotMatch(css142,/@keyframes|animation\s*:|#v142-skill-stage/);
});

test("V143 production VFX contains no procedural/Canvas/SVG fallback",()=>{
    [
        /createElement\(["']canvas["']\)/,
        /getContext\s*\(/,
        /drawImage\s*\(/,
        /requestAnimationFrame\s*\(/,
        /<svg\b/i,
        /v149-word-/,
        /v143-cast-charge/,
        /v143-skill-flight/,
        /v143-hit-impact/,
        /v143-hit-particle/,
        /canvas-crop/
    ].forEach(pattern=>assert.doesNotMatch(v143,pattern));
    assert.match(v143,/renderer:"dom-sprite"/);
    assert.match(v143,/No Canvas, SVG, WebGL, shader, particle, glyph or procedural fallback/);
});

test("old procedural CSS choreography and word-circle CSS are gone",()=>{
    [
        /\.v143-cast-charge/,
        /\.v143-skill-flight/,
        /\.v143-hit-impact/,
        /\.v143-hit-particle/,
        /\.v143-skill-field/,
        /v143EarthCornerBreath/,
        /v143Particle/
    ].forEach(pattern=>assert.doesNotMatch(css143,pattern));
    assert.doesNotMatch(css149,/v149-word-circle-stage|v149BarrierCornerPulse/);
    assert.match(css143,/v143RasterCastFrames/);
    assert.match(css143,/v143StatusRasterFrames/);
});

test("all formal four-element active skills resolve to raster Sprite Sheets",()=>{
    const context=runtime();
    const manifest=context.v143SkillAnimationManifest;
    const active=[
        "flameSlash","fireCritical","fireBurstStrike","explosiveFlurry","dragonSlash","fireRocket","blazeSpell","flameTornado","phoenixCry","rage",
        "waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain","freeze","healSpell","revive",
        "stormFist","stormFlurry","windCrossSlash","dizzyFist","windSpell","stormCircle","windHowlLightning","stormRain","dodgeSkill","stealthSkill","dinghaishenzhen","stormSpell","windArrow",
        "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush","stoneThrow","sandWind","flyingSandStrike","dustStorm","earthShield","rockWall","barrier"
    ];
    active.forEach(id=>{
        assert.ok(manifest[id]&&manifest[id].sprite,id+" missing sprite");
        assert.equal(manifest[id].sprite.renderer,"dom-sprite",id);
        assert.equal(manifest[id].sprite.frames,12,id);
        assert.match(manifest[id].sprite.src,/\.(?:png|webp)(?:\?|$)/i,id);
    });
    ["fireEX","waterEX","windEX","earthEX"].forEach(id=>assert.equal(manifest[id].passive,true,id));
});

test("V143 blocks later manifest and director fallback overrides",()=>{
    const context=runtime();
    const manifest=context.v143SkillAnimationManifest;
    const beforePlay=context.v142SkillAnimationDirector.play;
    manifest.explosiveFlurry.sprite.renderer="canvas-crop";
    manifest.fakeFallback={sprite:{renderer:"canvas-crop"}};
    context.v142SkillAnimationDirector.play=function(){ return "legacy"; };
    assert.equal(manifest.explosiveFlurry.sprite.renderer,"dom-sprite");
    assert.equal(manifest.fakeFallback,undefined);
    assert.equal(context.v142SkillAnimationDirector.play,beforePlay);
    const diagnostics=context.v143GetAnimationDiagnostics();
    assert.ok(diagnostics.blockedManifestWrites>=2);
    assert.ok(diagnostics.blockedDirectorOverrides>=1);
});

test("the same raster owner dispatches player-to-enemy and enemy-to-player",()=>{
    const context=runtime();
    const config={
        id:"flameSlash",name:"火焰斬",element:"fire",category:"physical",
        targetType:"single",duration:760,resolveDuration:760
    };
    context.v142SkillAnimationDirector.play(config,{side:"player",actorIndex:0});
    assert.equal(context.v143SkillAnimationState.current.side,"player");
    assert.equal(context.v143SkillAnimationState.current.targetSide,"monster");
    context.v142SkillAnimationDirector.play(config,{side:"monster",actorIndex:0});
    assert.equal(context.v143SkillAnimationState.current.side,"monster");
    assert.equal(context.v143SkillAnimationState.current.targetSide,"player");
    context.v142SkillAnimationDirector.dispose();
});


test("secondary status owners cannot recreate procedural combat VFX",()=>{
    assert.doesNotMatch(v143fixes,/v143-earth-shield-effect/);
    assert.doesNotMatch(v155,/v143SkillAnimationManifest/);
    assert.doesNotMatch(css141,/\.v141-effect-canvas|\.v141-effect-burn|v141BurnFlicker|v141StunOrbit/);
    assert.doesNotMatch(css143,/v143-earth-shield-effect|v143EarthCornerBreath/);
    assert.doesNotMatch(css146,/v143-earth-shield-effect/);
    assert.doesNotMatch(css149,/v149-barrier-corners|v149BarrierCornerPulse/);
    assert.doesNotMatch([v141,v142,v143,v143fixes,v149,v155,abyss].join("\n"),/WebGLRenderingContext|createShader|shaderSource|getContext\(["']webgl/i);
});

console.log("\nV174 raster-only combat VFX owner suite: "+passed+" tests passed.");

assert.doesNotMatch(v141,/playCanvasParticles|v141-effect-canvas|getContext\(|createElement\(["']canvas["']\)/);
assert.doesNotMatch(v149,/installWordCircleDirector|v149-word-|v149-word-circle-stage/);
assert.doesNotMatch(abyss,/v143SkillAnimationManifest|patchExistingV143ExplosiveFlurryRenderer|canvas-crop/);
