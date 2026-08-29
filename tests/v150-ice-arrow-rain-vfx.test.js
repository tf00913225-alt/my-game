const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const zlib=require("node:zlib");

const assetPath="assets/vfx/water/ice-arrow-rain.png";
const asset=fs.readFileSync(assetPath);
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
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

test("official sheet is a 4x3 RGBA PNG with twelve exact 384px cells",()=>{
    const info=pngInfo(asset);
    assert.equal(info.width,384*4);
    assert.equal(info.height,384*3);
    assert.equal(info.colorType,6,"PNG must retain an RGBA alpha channel");
    const alpha=alphaStats(info);
    assert.ok(alpha.transparent>alpha.total*.2,"background must contain real transparent pixels");
    assert.ok(alpha.partial>0,"glow edges must retain partial alpha");
});

test("Ice Arrow Rain extends the shared V143 director with one-shot sprite metadata",()=>{
    assert.match(animation,/src:"assets\/vfx\/water\/ice-arrow-rain\.png"/);
    assert.match(animation,/columns:4,rows:3,frames:12,hitFrame:7/);
    assert.match(animation,/hit:\.5833333333/);
    assert.match(animation,/v143-vfx-sprite/);
    assert.doesNotMatch(css,/v150IceArrowRainFrames[^}]*infinite/);
    assert.match(css,/steps\(1,end\) 1 both/);
});

test("frame order is left-to-right then top-to-bottom and completes on frame twelve",()=>{
    const frameBlock=css.slice(
        css.indexOf("@keyframes v150IceArrowRainFrames"),
        css.indexOf("@keyframes v150IceArrowRainEnvelope")
    );
    const expected=[
        "0 0","33.333333% 0","66.666667% 0","100% 0",
        "0 50%","33.333333% 50%","66.666667% 50%","100% 50%",
        "0 100%","33.333333% 100%","66.666667% 100%","100% 100%"
    ];
    expected.forEach(position=>assert.ok(frameBlock.includes("background-position:"+position),position));
    assert.match(frameBlock,/91\.666667%,100%\{background-position:100% 100%\}/);
});

test("targets remain card-derived, validity-snapshotted and hit together at frame seven to eight",()=>{
    assert.match(animation,/const target=cardCenter\(targetCard\)/);
    assert.match(animation,/node\.dataset\.targetIndex=String\(index\)/);
    assert.match(animation,/validTargets:new Set|validTargets:validTargets/);
    assert.match(animation,/if\(!current\.validTargets\.has\(index\)\)\{ return; \}/);
    assert.match(animation,/const stagger=current\.model\.sprite\?0/);
    assert.match(animation,/setTimer\(\(\)=>addImpact\(current,index\),Math\.max\(0,hitAt-Date\.now\(\)\)\)/);
});

test("runtime places sprites on the two living target-card centres and skips the dead card",()=>{
    function node(rect){
        const classes=new Set();
        return {
            id:"",className:"",dataset:{},children:[],parentNode:null,offsetParent:{},
            style:{setProperty(name,value){ this[name]=value; }},
            classList:{
                add(...names){ names.forEach(name=>classes.add(name)); },
                remove(...names){ names.forEach(name=>classes.delete(name)); },
                contains(name){ return classes.has(name); }
            },
            appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
            remove(){ if(this.parentNode){ this.parentNode.children=this.parentNode.children.filter(child=>child!==this); } },
            get childElementCount(){ return this.children.length; },
            getBoundingClientRect(){ return rect||{left:0,top:0,right:0,bottom:0,width:0,height:0}; },
            querySelectorAll(){ return []; }
        };
    }
    const body=node();
    const cards={
        battlePlayerCard0:node({left:20,top:320,right:100,bottom:420,width:80,height:100}),
        battleMonster0:node({left:100,top:40,right:176,bottom:140,width:76,height:100}),
        battleMonster1:node({left:220,top:40,right:296,bottom:140,width:76,height:100}),
        battleMonster2:node({left:340,top:40,right:416,bottom:140,width:76,height:100})
    };
    let timerId=0;
    let hitCalls=0;
    const scheduled=[];
    const context={
        window:null,console,Promise,Date,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout(callback,delay){
            const id=++timerId;
            scheduled.push({id,callback,delay});
            return id;
        },
        clearTimeout(){},
        showMonsterHit(){ hitCalls++; },
        document:{
            body,
            createElement(){ return node(); },
            getElementById(id){ return cards[id]||null; },
            querySelectorAll(){ return []; }
        },
        monsters:[
            {alive:true,hp:100},{alive:false,hp:0},{alive:true,hp:100}
        ],
        getPartyCharacterByIndex(){ return {hp:100}; }
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(){
            let resolve;
            const gate={done:false,reason:null,promise:new Promise(done=>{ resolve=done; })};
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
    context.v142SkillAnimationDirector.play({
        id:"iceArrowRain",name:"冰霜箭雨",element:"water",category:"magic",
        targetType:"all",duration:2500,resolveDuration:2500
    },{side:"player",actorIndex:0});

    const stage=body.children.find(child=>child.id==="v143-skill-stage");
    const sprites=stage.children.filter(child=>child.className.includes("v143-vfx-sprite"));
    assert.equal(sprites.length,2);
    assert.deepEqual(sprites.map(sprite=>sprite.dataset.targetIndex),["0","2"]);
    assert.deepEqual(sprites.map(sprite=>sprite.style.left),["138px","378px"]);
    assert.ok(sprites.every(sprite=>sprite.style.backgroundImage.includes(assetPath)));
    assert.equal(stage.children.some(child=>child.className.includes("v143-skill-flight")),false);

    const beforeHit=scheduled.length;
    context.showMonsterHit(0);
    assert.equal(hitCalls,0,"damage number must wait for the sprite hit frame");
    assert.equal(scheduled.length,beforeHit+1);
    const numberTimer=scheduled[scheduled.length-1];
    assert.ok(numberTimer.delay>=1400&&numberTimer.delay<=1500,"hit must land at frame seven to eight");
    numberTimer.callback();
    assert.equal(hitCalls,1);
    assert.ok(scheduled.some(timer=>timer.delay>=2490),"full twelve-frame gate must stay alive for 2.5 seconds");
});

test("the shared action gate owns the full sprite duration under cache version 154",()=>{
    assert.match(animation,/setTimer\(\(\)=>cleanupCurrent\(current,"v143-animation-complete"\),Math\.max\(duration,Number\(config\.resolveDuration\)\|\|duration\)\)/);
    assert.match(animation,/current\.gate\.complete\(reason\|\|"v143-animation-complete"\)/);
    assert.match(loader,/const V_ASSET_VERSION="156"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=156/);
});

console.log(`\n${passed} V150 Ice Arrow Rain VFX tests passed.`);
