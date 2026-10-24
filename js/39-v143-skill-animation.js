/* Subordinate presentation utility. V143 alone supplies committed hits/lifecycle.
   No damage, targeting, save, gate or gameplay-clock authority. */
(function installHitFeedback(){
    "use strict";
    if(typeof window==="undefined"||window.FourSymbolsHitFeedback){return;}
    // Build embeds the one editable JSON without another runtime request/clock.
    const CONFIG=/* @battle-vfx-feedback-config */ null;
    if(!CONFIG){return;}
    const pools=new Map(),active=new Set(),canvasPool=[],particlePool=[],texturePool=new Map();
    let quality=1,slowFrames=0;
    const approvedStatusEntries=new WeakSet();
    const bounded=(v,f,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
    function resolveProfile(skill,data){
        const d=data&&typeof data==="object"?data:{},auto=CONFIG.automatic||{};
        const description=String(d.description||d.name||"");
        const element=auto.elementAliases?.[String(d.element||"").toLowerCase()]||
            Object.keys(auto.elements||{}).find(key=>auto.elements[key].hints?.some(hint=>description.includes(hint)))||"neutral";
        const target=String(d.targetType||"single"),category=String(d.category||"");
        const kind=category==="heal"||Number(d.baseHeal)>0||!category&&/治療|恢復.*HP|healing/i.test(description)?"heal":
            category==="buff"||!category&&/護盾|護罩|增益|提升.*力|shield|buff/i.test(description)?(/護盾|護罩|減傷|shield/i.test(description)||d.reflectPercent||d.defenseBonusPercent?"shield":"buff"):
            /all/i.test(target)?"all":/tri|column|row|multi/i.test(target)||Number(d.targetCount)>1||Array.isArray(d.targets)&&d.targets.length>1?"multi":"single";
        const states=Object.keys(d).filter(k=>/Chance$/.test(k)&&Number(d[k])>0).map(k=>k.slice(0,-6));
        return {element,kind,states,passive:category==="passive"||target==="none",...auto.elements?.[element]};
    }
    function configFor(skill,data){
        const profile=resolveProfile(skill,data),auto=CONFIG.automatic||{};
        const eligible=auto.enabled===true&&!profile.passive&&skill!=="normal"&&
            (auto.rolloutAll===true||auto.previewSkills?.includes(skill));
        const c={...CONFIG.defaults,...(eligible?{enabled:true,...auto.elements?.[profile.element],...auto.types?.[profile.kind]}:{}),...CONFIG.skills[skill],profile};
        c.profile={...profile,shape:c.shape||profile.shape,direction:c.direction||profile.direction};
        c.enabled=CONFIG.enabled&&c.enabled===true;
        c.stopFrames=bounded(c.stopFrames,3,0,10);c.fps=bounded(c.fps,60,20,240);
        c.shakePx=bounded(c.shakePx,6,0,20);c.decay=bounded(c.decay,.85,0,1);
        c.shakeSteps=Math.floor(bounded(c.shakeSteps,12,1,30));c.stepMs=bounded(c.stepMs,16,8,100);
        c.referenceDamage=bounded(c.referenceDamage,168,1,1e9);
        c.minDamageScale=bounded(c.minDamageScale,.35,0,2);
        c.maxDamageScale=bounded(c.maxDamageScale,2,c.minDamageScale,4);
        c.brightness=bounded(c.brightness,2.5,1,4);c.flashMs=bounded(c.flashMs,80,0,500);
        c.hitFrameMultiplier=bounded(c.hitFrameMultiplier,2,1,8);
        c.poolLimit=Math.floor(bounded(c.poolLimit,24,0,64));
        c.canvasDpr=bounded(c.canvasDpr,1.5,1,2);
        c.canvasDpr=Math.min(c.canvasDpr,bounded(CONFIG.performance?.canvasDpr,1.5,1,2));
        c.criticalScale=bounded(c.criticalScale,1.25,1,1.5);c.maxStopMs=bounded(c.maxStopMs,75,0,100);
        c.supportMs=bounded(c.supportMs,480,100,700);c.supportRise=bounded(c.supportRise,.5,.1,1);
        c.shieldOpacity=bounded(c.shieldOpacity,.16,0,.3);
        c.sweepGapMs=bounded(c.sweepGapMs,100,0,150);
        const limits={maxEffectNodes:[48,0,48],windCount:[10,0,16],leafCount:[5,0,8],burstCount:[6,0,10],
            windMs:[900,100,1200],windSize:[2,1,6],leafSize:[7,2,12],windSpread:[.6,.1,1],
            glowPx:[3,0,6],glowBrightness:[1.18,1,2],particleOpacity:[.76,0,1],
            trailLength:[1.8,.2,3],trailWidth:[2,1,4],trailMs:[460,80,500],burstMs:[300,80,400],
            burstRadius:[.6,.1,1],shockwaveMs:[380,80,450],shockwaveScale:[1.45,.5,2],
            screenFlashOpacity:[.09,0,.15],screenFlashMs:[90,30,120],weakenMs:[420,80,450],weakenDrop:[.5,.1,.8]};
        Object.entries(limits).forEach(([key,[fallback,min,max]])=>{c[key]=bounded(c[key],fallback,min,max);});
        c.hitStrength=Array.from({length:3},(_,i)=>bounded(c.hitStrength?.[i],1,.1,1.5));
        c.colors=Array.isArray(c.colors)&&c.colors.length?c.colors.filter(color=>/^#[0-9a-f]{6}$/i.test(color)):[];
        if(!c.colors.length)c.colors=["#80f6d6","#efffff","#43c7bb"];
        if(c.blendMode!=="plus-lighter"&&c.blendMode!=="screen")c.blendMode="screen";
        if(typeof CSS!=="undefined"&&CSS.supports&&!CSS.supports("mix-blend-mode",c.blendMode))c.blendMode="screen";
        c.depth=Object.fromEntries(["far","mid","near","assignment"].map(key=>[key,{...CONFIG.depth?.[key],...c.depth?.[key]}]));
        return c;
    }
    function statusEnabled(type,entry){
        const auto=CONFIG.automatic;
        return !!(CONFIG.enabled&&auto?.enabled&&Number(entry?.turnsLeft)>0&&(auto.rolloutAll||approvedStatusEntries.has(entry)));
    }
    function decorateStatus(node,type,entry){
        const spec=CONFIG.automatic?.status;
        if(!node)return;
        if(!statusEnabled(type,entry)||!spec?.dot?.includes(type)||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
            node.querySelectorAll?.(".v143-feedback-dot").forEach(dot=>dot.remove());return;
        }
        if(node.querySelector?.(".v143-feedback-dot"))return;
        const globalLimit=Math.floor(bounded(spec.dotParticleCap,8,0,12)),count=Math.min(2,Math.floor(bounded(spec.dotPerState,2,0,2)*quality));
        const used=document.querySelectorAll?.(".v143-feedback-dot").length||0;
        const element=spec.dotElements?.[type]||"neutral",color=CONFIG.automatic.elements[element]?.colors?.[0]||"#ffffff";
        for(let i=0;i<Math.min(count,Math.max(0,globalLimit-used));i++){
            const dot=document.createElement("i");dot.className="v143-feedback-dot";dot.setAttribute("aria-hidden","true");
            const size=bounded(spec.dotSizePx,3,1,5),ms=bounded(spec.dotDurationMs,1000,400,2000),rise=bounded(spec.dotRisePx,18,4,30);
            Object.assign(dot.style,{position:"absolute",left:(30+i*35)+"%",bottom:"15%",width:size+"px",height:size+"px",background:color,borderRadius:"50%",pointerEvents:"none",boxShadow:"0 0 "+size+"px "+color,animationDuration:ms+"ms",animationDelay:(-i*ms/2)+"ms"});
            dot.style.setProperty("--v143-dot-rise",(-rise)+"px");node.appendChild(dot);
        }
    }
    function acquire(kind){
        const pool=pools.get(kind)||[];pools.set(kind,pool);
        return pool.pop()||document.createElement("i");
    }
    function release(kind,node,limit){
        node.getAnimations?.({subtree:true}).forEach(a=>a.cancel());node.remove();
        if(node.v143SheetNode){release("sheet",node.v143SheetNode,limit);delete node.v143SheetNode;}
        Array.from(node.attributes||[]).forEach(a=>node.removeAttribute(a.name));
        node.textContent="";delete node.v143MotionAnimation;delete node.v143FrameAnimation;
        const pool=pools.get(kind)||[];pools.set(kind,pool);
        if(pool.length<limit)pool.push(node);
    }
    // Dwell inputs are relative milliseconds; normalize on each side of the
    // authored hit boundary, so frame 7 still starts at .5 and the gate stays 1500ms.
    function frameTrack(sprite,c,hitRatio){
        const count=sprite.frames,hit=Math.max(0,Math.min(count-1,sprite.hitFrame-1));
        const weights=Array.from({length:count},(_,i)=>bounded(c.frameDurations?.[i],1,.001,1e6));
        const offsets=new Array(count+1);offsets[0]=0;
        const before=weights.slice(0,hit).reduce((a,b)=>a+b,0);let elapsed=0;
        for(let i=0;i<hit;i++){offsets[i]=hitRatio*elapsed/before;elapsed+=weights[i];}
        const after=weights.slice(hit).reduce((a,b)=>a+b,0);
        // Double the originally allocated hit dwell (125 -> 250ms by default),
        // distribute the remaining post-hit budget over the other frames.
        const hold=Math.min(1-hitRatio,(1-hitRatio)*weights[hit]/after*c.hitFrameMultiplier);
        offsets[hit]=hitRatio;elapsed=0;
        const tail=after-weights[hit];
        for(let i=hit+1;i<count;i++){offsets[i]=hitRatio+hold+(tail?(1-hitRatio-hold)*elapsed/tail:0);elapsed+=weights[i];}
        offsets[count]=1;
        const frames=weights.map((_,i)=>({transform:"translate("+(-(i%sprite.columns)*100/sprite.columns)+"%,"+(-Math.floor(i/sprite.columns)*100/sprite.rows)+"%)",offset:offsets[i],easing:"steps(1,end)"}));
        frames.push({...frames[count-1],offset:1});return frames;
    }
    function create(skill,data){
        const c=configFor(skill,data),seen=new Set(),motions=new Set(),effects=new Set();let stop=null,disposed=false,batch=false;
        let canvas=null,context=null,frontCanvas=null,frontContext=null,frame=0,lastDraw=0,pauseFrom=0,pauseUntil=0,area=null;
        const request=typeof requestAnimationFrame==="function"?requestAnimationFrame:null;
        const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true;
        function resume(){
            if(!stop)return;clearTimeout(stop.timer);
            stop.tracks.forEach(({animation,rate})=>{
                if(animation.playState!=="paused")return;
                // Cast tracks catch up gently within their original deadline;
                // pre-existing idle/UI tracks retain their original speed.
                const deadline=animation.hitFeedbackDeadline;
                if(deadline){
                    const remaining=deadline-Date.now();
                    const duration=Number(animation.effect?.getTiming().duration);
                    if(remaining>0&&duration>Number(animation.currentTime))animation.playbackRate=(duration-Number(animation.currentTime))/remaining;
                    else animation.playbackRate=rate;
                }else animation.playbackRate=rate;
                animation.play();
            });stop=null;
        }
        function ensureCanvas(host,front=false){
            if(front?frontCanvas:canvas)return true;
            const candidate=canvasPool.pop()||document.createElement("canvas");
            const ctx=candidate.getContext?.("2d",{alpha:true,desynchronized:true});
            if(!ctx)return false;
            if(front){frontCanvas=candidate;frontContext=ctx;}else{canvas=candidate;context=ctx;}
            const width=area?.width||window.innerWidth||document.documentElement?.clientWidth||1,height=area?.height||window.innerHeight||document.documentElement?.clientHeight||1;
            const dpr=Math.min(c.canvasDpr,window.devicePixelRatio||1);
            const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
            if(candidate.width!==w)candidate.width=w;if(candidate.height!==h)candidate.height=h;
            candidate.dataset.feedbackLayer=front?"wind-particles-near":"wind-particles";candidate.setAttribute("aria-hidden","true");
            Object.assign(candidate.style,{position:"fixed",left:(area?.left||0)+"px",top:(area?.top||0)+"px",width:width+"px",height:height+"px",pointerEvents:"none",mixBlendMode:c.blendMode,zIndex:front?"2":"0"});
            if(front)host.appendChild(candidate);else host.insertBefore(candidate,host.firstChild||null);
            ctx.setTransform(dpr,0,0,dpr,0,0);return true;
        }
        function queuePaint(){if(!frame&&request)frame=request(paint);}
        function advanceParticle(entry,now){
            const overlap=entry.kind==="screen-flash"?0:Math.max(0,Math.min(now,pauseUntil)-Math.max(entry.tick,pauseFrom));
            entry.elapsed+=Math.max(0,now-entry.tick-overlap);entry.tick=now;
        }
        function paint(){
            frame=0;if(disposed||!context)return;
            const now=Date.now();
            if(lastDraw&&CONFIG.performance?.adaptive){
                if(now-lastDraw>bounded(CONFIG.performance.slowFrameMs,28,17,100))slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
                if(slowFrames>=bounded(CONFIG.performance.slowFrames,4,2,12)){
                    quality=Math.max(bounded(CONFIG.performance.minQuality,.6,.3,1),quality-bounded(CONFIG.performance.step,.1,.01,.2));slowFrames=0;
                }
            }
            if(now-lastDraw<1000/c.fps*.8){queuePaint();return;}lastDraw=now;
            context.clearRect(0,0,canvas.width,canvas.height);context.globalCompositeOperation="lighter";
            if(frontContext){frontContext.clearRect(0,0,frontCanvas.width,frontCanvas.height);frontContext.globalCompositeOperation="lighter";}
            Array.from(effects).sort((a,b)=>(a.depthOrder||0)-(b.depthOrder||0)).forEach(entry=>{
                if(entry.dom){if(now>=Math.min(entry.tick+entry.duration,entry.deadline))entry.finish();return;}
                advanceParticle(entry,now);
                if(entry.elapsed>=entry.duration||now>=entry.deadline){entry.finish();return;}
                const progress=1-Math.pow(1-entry.elapsed/entry.duration,3),keys=entry.keys;
                let index=0;while(index<keys.length-2&&progress>keys[index+1].offset)index++;
                const a=keys[index],b=keys[index+1],span=b.offset-a.offset,t=span?Math.max(0,Math.min(1,(progress-a.offset)/span)):1;
                const lerp=k=>a[k]+(b[k]-a[k])*t,box=entry.box;
                const opacity=lerp("opacity");entry.opacity=opacity;
                const ctx=entry.layer==="near"?frontContext:context;
                ctx.save();ctx.translate(box.x+box.w/2+lerp("x")-(area?.left||0),box.y+box.h/2+lerp("y")-(area?.top||0));ctx.rotate(lerp("angle")*Math.PI/180);ctx.scale(lerp("scale"),lerp("scale"));
                ctx.globalAlpha=opacity;
                const texture=entry.texture;
                ctx.drawImage(texture.node,-texture.w/2,-texture.h/2,texture.w,texture.h);
                ctx.restore();
            });if(effects.size)queuePaint();
        }
        // Cache the glow raster once; moving frames only transform a bitmap.
        function textureFor(kind,box,color,depth){
            const blur=Math.max(c.glowPx,depth.blur),key=[kind,box.w,box.h,color,blur,c.trailWidth,c.profile.shape].join("|");
            if(texturePool.has(key))return texturePool.get(key);
            const pad=Math.ceil(blur*3+c.trailWidth+2),w=Math.ceil(box.w+pad*2),h=Math.ceil(box.h+pad*2);
            const node=document.createElement("canvas"),ctx=node.getContext("2d");
            node.width=w;node.height=h;ctx.translate(w/2,h/2);
            ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=c.trailWidth;ctx.shadowColor=color;ctx.shadowBlur=blur;
            if(kind==="shockwave"||kind==="weaken"||kind==="trail"||kind==="shield"){
                ctx.beginPath();ctx.ellipse(0,0,box.w/2,box.h/2,0,kind==="trail"?Math.PI:0,kind==="trail"?Math.PI*1.9:Math.PI*2);if(kind==="shield")ctx.fill();ctx.stroke();
            }else if(kind==="leaf"&&(c.profile.shape==="leaf"||!c.profile.shape)){
                ctx.beginPath();ctx.moveTo(-box.w/2,box.h/2);ctx.quadraticCurveTo(-box.w/2,-box.h,box.w/2,-box.h/2);ctx.quadraticCurveTo(box.w/2,box.h,-box.w/2,box.h/2);ctx.fill();
            }else if(c.profile.shape==="smoke"){
                ctx.beginPath();ctx.ellipse(0,0,box.w/2,box.h/2,0,0,Math.PI*2);ctx.fill();
            }else if(c.profile.shape==="arc"){
                ctx.beginPath();ctx.moveTo(-box.w/2,0);ctx.lineTo(0,-box.h/2);ctx.lineTo(-box.w*.1,box.h/2);ctx.lineTo(box.w/2,0);ctx.stroke();
            }else if(c.profile.shape==="crystal"||c.profile.shape==="stone"){
                ctx.beginPath();ctx.moveTo(0,-box.h/2);ctx.lineTo(box.w/2,0);ctx.lineTo(0,box.h/2);ctx.lineTo(-box.w/2,0);ctx.closePath();ctx.fill();
            }else ctx.fillRect(-box.w/2,-box.h/2,box.w,box.h);
            const texture={node,w,h};
            if(texturePool.size>=64)texturePool.delete(texturePool.keys().next().value);
            texturePool.set(key,texture);return texture;
        }
        function effect(host,kind,box,frames,duration,deadline,extra){
            if(disposed||!c.enabled||!c.sweepEnabled||reduced()||!host||typeof host.appendChild!=="function"||effects.size>=c.maxEffectNodes)return null;
            // The full-screen flash remains a compositor opacity overlay;
            // it must not inflate the particle bitmap to the entire viewport.
            if(kind==="screen-flash"||kind==="all-wave"){
                const node=acquire("screen-flash");node.dataset.feedbackEffect=kind;
                Object.assign(node.style,{position:"fixed",left:box.x+"px",top:box.y+"px",width:box.w+"px",height:box.h+"px",pointerEvents:"none",background:extra.background,opacity:"0",mixBlendMode:c.blendMode});
                if(kind==="all-wave")Object.assign(node.style,{border:c.trailWidth+"px solid "+c.colors[1],borderRadius:"50%",boxSizing:"border-box"});
                host.appendChild(node);
                const entry={kind,node,dom:true,elapsed:0,tick:Date.now(),deadline,duration};effects.add(entry);
                const animation=node.animate(frames,{duration:Math.max(1,Math.min(duration,deadline-Date.now())),fill:"none"});animation.hitFeedbackOwnEffect=true;
                entry.finish=()=>{if(!effects.delete(entry))return;animation.onfinish=null;animation.cancel();release("screen-flash",node,c.poolLimit);};
                animation.onfinish=entry.finish;return entry;
            }
            if(!ensureCanvas(host))return null;
            const layer=extra?.layer||c.depth?.assignment?.[kind]||"mid";
            const rawDepth=c.depth?.[layer]||{},depth={size:bounded(rawDepth.size,1,.25,3),speed:bounded(rawDepth.speed,1,.25,3),blur:bounded(rawDepth.blur,0,0,4),opacity:bounded(rawDepth.opacity,1,0,1)};
            const cap=Math.floor(bounded(rawDepth.cap,c.maxEffectNodes,0,c.maxEffectNodes));
            if(Array.from(effects).filter(e=>e.layer===layer).length>=Math.floor(cap*(layer==="mid"?1:quality)))return null;
            if(layer==="near"&&!ensureCanvas(host,true))return null;
            const entry=particlePool.pop()||{};
            const keys=frames.map((key,i)=>{
                const text=key.transform||"",move=text.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/),rotate=text.match(/rotate\(([-\d.]+)deg\)/),scale=text.match(/scale\(([-\d.]+)\)/);
                return {offset:key.offset??i/(frames.length-1),opacity:(key.opacity??1)*depth.opacity,x:move?Number(move[1]):0,y:move?Number(move[2]):0,angle:rotate?Number(rotate[1]):0,scale:(scale?Number(scale[1]):1)*depth.size};
            });
            Object.assign(entry,{kind,box,keys,color:extra?.color||(extra?.background&&extra.background!=="transparent"?extra.background:c.colors[effects.size%c.colors.length]),
                layer,depthOrder:layer==="far"?0:layer==="near"?2:1,node:{dataset:{feedbackEffect:kind,depth:layer}},elapsed:0,tick:Date.now(),opacity:0,duration:Math.max(1,Math.min(duration/depth.speed,deadline-Date.now())),deadline});effects.add(entry);
            entry.texture=textureFor(kind,box,entry.color,depth);
            entry.finish=()=>{if(!effects.delete(entry))return;Object.keys(entry).forEach(k=>delete entry[k]);if(particlePool.length<c.poolLimit)particlePool.push(entry);};
            queuePaint();return entry;
        }
        function wind(host,rects,deadline){
            if(!rects.length)return;
            const left=Math.min(...rects.map(r=>r.left)),right=Math.max(...rects.map(r=>r.left+r.width));
            const top=Math.min(...rects.map(r=>r.top)),height=Math.max(...rects.map(r=>r.height));
            const margin=Math.max(...rects.map(r=>r.width))*1.5+c.glowPx*3;
            const viewportWidth=window.innerWidth||right+margin,viewportHeight=window.innerHeight||top+height*3;
            const x=Math.max(0,left-margin),y=Math.max(0,top-height*.5-margin*.25);
            area={left:x,top:y,width:Math.max(1,Math.min(viewportWidth,right+margin)-x),height:Math.max(1,Math.min(viewportHeight,top+height*2)-y)};
            const count=Math.floor((c.windCount+c.leafCount)*quality);
            for(let i=0;i<count;i++){
                const leaf=i>=c.windCount,size=leaf?c.leafSize:c.windSize;
                const y=top+height*(.5+((i%5)/4-.5)*c.windSpread);
                const direction=c.profile.direction||"sweep",travel=Math.max(right-left,height*.8);
                const origin=left+(i/Math.max(1,count))*(right-left)*(direction==="sweep"?.2:1);
                const dx=direction==="sweep"?travel:direction==="in"?(left+right)/2-origin:0,dy=direction==="up"?-height*c.supportRise:direction==="down"?height*.6:0;
                effect(host,leaf?"leaf":"wind",{x:origin,y,w:leaf?size:size*5,h:size},[
                    {transform:"translate(0px,0px) rotate(0deg)",opacity:0},
                    {transform:"translate("+(dx*.25)+"px,"+(dy*.25-size)+"px) rotate(35deg)",opacity:c.particleOpacity,offset:.2},
                    {transform:"translate("+dx+"px,"+(dy+size*2)+"px) rotate("+(leaf?220:10)+"deg)",opacity:0}
                ],c.windMs,deadline,leaf?{borderRadius:"0 85% 0 85%"}:null);
            }
            // Depth accents are sparse and share the same bounded renderer.
            for(const layer of ["far","near"]){
                const limit=Math.min(layer==="near"?2:5,Math.floor(bounded(c.depth?.[layer]?.cap,2,0,5)*quality));
                for(let i=0;i<limit;i++){
                const x=left+(right-left)*i/Math.max(1,limit),direction=c.profile.direction||"sweep";
                const dx=direction==="sweep"?Math.max(right-left,height*.8):direction==="in"?(left+right)/2-x:0;
                const dy=direction==="up"?-height*c.supportRise:direction==="down"?height*.6:0;
                effect(host,"depth-fleck",{x,y:top+height*(.25+i*.35),w:c.windSize*8,h:c.windSize*2},[
                    {transform:"translate(0px,0px)",opacity:0},
                    {transform:"translate("+(dx*.3)+"px,"+(dy*.3)+"px)",opacity:c.particleOpacity,offset:.2},
                    {transform:"translate("+dx+"px,"+dy+"px)",opacity:0}
                ],c.windMs,deadline,{layer});
                }
            }
        }
        function weaken(host,rect,deadline){
            if(!rect)return;
            return effect(host,"weaken",{x:rect.left,y:rect.top+rect.height*.3,w:rect.width,h:rect.width/2},[
                {transform:"translate(0px,0px) scale(.7)",opacity:c.particleOpacity},
                {transform:"translate(0px,"+(rect.height*c.weakenDrop)+"px) scale(1)",opacity:0}
            ],c.weakenMs,deadline,{background:"transparent",color:CONFIG.automatic?.status?.debuff?.colors?.[0]||c.colors[0]});
        }
        function support(host,rect,kind,deadline){
            if(!rect)return null;
            const shield=kind==="shield";
            return effect(host,shield?"shield":"shockwave",{x:rect.left,y:rect.top+rect.height*.3,w:rect.width,h:rect.width*(shield?1:.5)},[
                {transform:"translate(0px,0px) scale(.7)",opacity:shield?c.shieldOpacity:c.particleOpacity},
                {transform:"translate(0px,"+(-rect.height*c.supportRise)+"px) scale(1)",opacity:0}
            ],c.supportMs,deadline,{background:c.colors[0],layer:"mid"});
        }
        function impact(host,rect,rank,last,weaken,deadline,damage=c.referenceDamage,critical=false){
            if(!rect)return;
            const x=rect.left+rect.width/2,y=rect.top+rect.height/2,scale=c.hitStrength[Math.min(rank,2)];
            const ring=(kind,ms,drop)=>effect(host,kind,{x:x-rect.width/2,y:y-rect.width/4,w:rect.width,h:rect.width/2},[
                {transform:"translate(0px,0px) scale(.25)",opacity:c.particleOpacity},
                {transform:"translate(0px,"+drop+"px) scale("+c.shockwaveScale+")",opacity:0}
            ],ms,deadline,{background:"transparent",border:c.trailWidth+"px solid "+c.colors[1%c.colors.length]});
            ring("shockwave",c.shockwaveMs,0);
            if(weaken)ring("weaken",c.weakenMs,rect.height*c.weakenDrop);
            const count=Math.min(10,Math.floor(c.burstCount*Math.max(1,Math.min(c.maxDamageScale,damage/c.referenceDamage))*(critical?c.criticalScale:1)*quality));
            for(let i=0;i<count;i++){
                const angle=(i/Math.max(1,count))*Math.PI*2,reach=rect.width*c.burstRadius*scale;
                effect(host,"burst",{x,y,w:c.windSize*3,h:c.windSize},[
                    {transform:"translate(0px,0px) rotate("+(angle*180/Math.PI)+"deg)",opacity:c.particleOpacity},
                    {transform:"translate("+(Math.cos(angle)*reach)+"px,"+(Math.sin(angle)*reach)+"px) rotate("+(angle*180/Math.PI+80)+"deg)",opacity:0}
                ],c.burstMs,deadline);
            }
            effect(host,"trail",{x:x-rect.width*c.trailLength/2,y:y-rect.height/4,w:rect.width*c.trailLength,h:rect.height/2},[
                {transform:"translate("+(-rect.width*.25)+"px,0px) rotate(-12deg)",opacity:0},
                {transform:"translate(0px,0px) rotate(0deg)",opacity:c.particleOpacity,offset:.15},
                {transform:"translate("+(rect.width*.3)+"px,0px) rotate(8deg)",opacity:0}
            ],c.trailMs,deadline,{background:"transparent",borderTop:c.trailWidth+"px solid "+c.colors[0],borderRadius:"50%"});
            if(last){
                const page=document.getElementById("battlePage"),b=page?.getBoundingClientRect();
                if(b)effect(host,"screen-flash",{x:b.left,y:b.top,w:b.width,h:b.height},[
                    {transform:"translate(0px,0px)",opacity:c.screenFlashOpacity},{transform:"translate(0px,0px)",opacity:0}
                ],c.screenFlashMs,deadline,{background:c.colors[1%c.colors.length],borderRadius:"0",boxShadow:"none"});
                if(b&&c.profile.kind==="all")effect(host,"all-wave",{x:b.left,y:b.top,w:b.width,h:b.height},[
                    {transform:"scale(.15)",opacity:c.particleOpacity},{transform:"scale(1)",opacity:0}
                ],c.shockwaveMs,deadline,{background:"transparent"});
            }
        }
        function hit({key,damage,roots,power=1,critical=false}){
            if(disposed||!c.enabled||["heal","buff","shield"].includes(c.profile.kind)||!(damage>0)||seen.has(key)||reduced())return false;
            seen.add(key);
            if(batch&&!c.sweepEnabled)return true;batch=true;
            resume();motions.forEach(a=>{a.onfinish=null;a.cancel();});motions.clear();
            const impactScale=Math.max(1,Math.min(c.maxDamageScale,damage/c.referenceDamage))*(critical?c.criticalScale:1);
            const stopMs=Math.min(c.maxStopMs,c.stopFrames*1000/c.fps*impactScale);
            const tracks=new Set();if(stopMs>0)roots.filter(Boolean).forEach(root=>root.getAnimations?.({subtree:true}).forEach(a=>tracks.add(a)));
            const stopped=[];tracks.forEach(animation=>{
                if(animation.hitFeedbackOwnEffect||animation.playState!=="running")return;
                stopped.push({animation,rate:animation.playbackRate});animation.pause();
            });
            stop=stopMs>0?{tracks:stopped,timer:setTimeout(resume,stopMs)}:null;
            const pausedAt=Date.now();
            // Consume the previous stop before replacing its interval, even
            // when a slow device painted no particle frame between two hits.
            Array.from(effects).forEach(entry=>{if(entry.dom)return;advanceParticle(entry,pausedAt);if(entry.elapsed>=entry.duration||pausedAt>=entry.deadline)entry.finish();});
            pauseFrom=pausedAt;pauseUntil=pausedAt+stopMs;
            const strength=c.shakePx*Math.max(c.minDamageScale,Math.min(c.maxDamageScale,damage/c.referenceDamage))*power*(critical?c.criticalScale:1);
            const frames=[{transform:"translate(0px,0px)"}];
            for(let i=0;i<c.shakeSteps;i++){
                const d=strength*Math.pow(c.decay,i);frames.push({transform:"translate("+(i%2?-d:d)+"px,"+(i%4<2?d:-d)*.5+"px)"});
            }frames.push({transform:"translate(0px,0px)"});
            // Additive transform preserves the stage fit transform; no style writes.
            roots.filter(Boolean).forEach(root=>{
                const a=root.animate?.(frames,{duration:(c.shakeSteps+1)*c.stepMs,composite:"add",easing:"linear"});
                if(a){motions.add(a);a.onfinish=()=>{motions.delete(a);a.cancel();};}
            });return true;
        }
        function dispose(){disposed=true;c.enabled=false;resume();motions.forEach(a=>{a.onfinish=null;a.cancel();});motions.clear();Array.from(effects).forEach(e=>e.finish());
            if(frame&&typeof cancelAnimationFrame==="function")cancelAnimationFrame(frame);frame=0;
            for(const [node,ctx] of [[canvas,context],[frontCanvas,frontContext]])if(node){ctx.clearRect(0,0,node.width,node.height);node.remove();if(canvasPool.length<2)canvasPool.push(node);}
            canvas=null;context=null;frontCanvas=null;frontContext=null;active.delete(api);}
        const api={config:c,pooling:c.enabled,hit,wind,impact,weaken,support,dispose,effectCount:()=>effects.size,
            snapshot:()=>Array.from(effects,e=>({kind:e.kind,...e.node.dataset,opacity:e.opacity}))};active.add(api);return api;
    }
    window.FourSymbolsHitFeedback={config:CONFIG,configFor,resolveProfile,statusEnabled,decorateStatus,
        markStatus(entry){if(entry&&typeof entry==="object")approvedStatusEntries.add(entry);},create,frameTrack,acquire,release,
        disposeAll(){Array.from(active).forEach(a=>a.dispose());},
        setEnabled(enabled){CONFIG.enabled=enabled===true;if(!CONFIG.enabled){
            this.disposeAll();document.querySelectorAll?.(".v143-feedback-dot").forEach(node=>node.remove());
            document.querySelectorAll?.(".v143-status-icon[data-remaining-turns]").forEach(node=>{delete node.dataset.remainingTurns;node.title=String(node.title||"").split(" · ")[0];});
        }},
        quality:()=>quality,poolSize(kind){return kind==="particle"?particlePool.length:kind==="particle-canvas"?canvasPool.length:pools.get(kind)?.length||0;}};
})();

/* =====================================================
   V143 — single-owner raster battle VFX runtime
   V174 cleanup: official PNG Sprite Sheets/status loops only.
   Fixed Slot geometry owns battle coverage; its formal artwork projection
   anchors explicitly authored recipient effects within that same formation.
   Cast bodies remain Sprite Sheets, with no Canvas/SVG/WebGL fallback.
   Explicit four-skill preview: pooled Canvas planes paint bounded accents;
   it never replaces the cast body, targeting, status or gameplay owners.
   Three persistent named buffs use the same status owner's CSS foot aura.
===================================================== */
(function installV143SkillAnimationRuntime(){
    "use strict";

    if(typeof window==="undefined"||window.__v143SkillAnimationInstalled){ return; }
    if(!window.v142SkillAnimationDirector){ return; }
    window.__v143SkillAnimationInstalled=true;

    const VERSION="174-slot-geometry-owner";
    const DEFAULT_HIT=.5833333333;
    let blockedManifestWrites=0;
    let blockedDirectorOverrides=0;
    let blockedCardEffectOverrides=0;
    const failedAssets=new Set();
    const SPRITE_SCALE_MULTIPLIER=1;
    /* Size the raster box before centering/travel. CSS independent scale also
       scales translate(-50%) and the travel vector, moving the visible hit. */
    const PLACEMENT_SIZE_SCALE=Object.freeze({single:.70,targetTrajectory:.72,trajectory:1,group:1,battlefield:1});
    const spriteFrameAspectCache=new Map();
    const spriteFrameAspectLoading=new Set();

    function castSheet(src,placement,options){
        return Object.assign({
            src:src,columns:4,rows:3,frames:12,hitFrame:7,
            placement:placement||"single",renderer:"dom-sprite"
        },options||{});
    }

    const STATUS_VISUAL_LAYERS=Object.freeze({
        HARD_CONTROL_BASE:"hard-control-base",
        ROTATING:"rotating",
        HUD:"hud"
    });

    function statusVisual(src,mode,collection,options){
        const resolvedMode=mode||"static";
        return Object.assign({
            src:src||"",
            mode:resolvedMode,
            collection:collection||"statusEffects",
            visualLayer:resolvedMode==="icon"?STATUS_VISUAL_LAYERS.HUD:STATUS_VISUAL_LAYERS.ROTATING,
            cropColumns:1,
            cropRows:1,
            renderer:"dom-status-visual"
        },options||{});
    }

    function relicSheet(src,hitFrame,options){
        const frame=Math.max(1,Math.min(12,Math.floor(Number(hitFrame)||7)));
        const frameIndex=frame-1;
        return {
            hit:frameIndex/12,
            authoredHitFrame:frame,
            lazyAsset:true,
            sprite:castSheet(src,"single",Object.assign({
                hitFrame:frameIndex,scale:2.05,maxSize:280
            },options||{}))
        };
    }

    const RAW_MANIFEST={
        normal:{hit:.57,projectile:{src:"assets/vfx/normal/normal-air-shot-v1.webp",minSize:52,maxSize:64},sprite:castSheet("assets/vfx/normal/normal-impact.webp","single",{hitFrame:6,scale:.85,maxSize:100,impactOnly:true})},

        flameSlash:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/flame-slash-cast-v2.webp","single",{scale:1.85,maxSize:220})},
        fireCritical:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-critical-cast.png?v=165","single",{scale:2.15,maxSize:260})},
        fireBurstStrike:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-critical-cast.png?v=165","single",{scale:2.15,maxSize:260,reusedFrom:"fireCritical"})},
        explosiveFlurry:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/explosive-flurry-wide-v2.webp","single",{scale:1.4,minSize:96,maxSize:184,presentation:"per-recipient",recipientSlice:"center-third",cellAspect:2.25})},
        dragonSlash:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/dragon-slash-cast-v2.webp","single",{scale:2.35,maxSize:300})},
        fireRocket:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-rocket-cast.png?v=165","trajectory",{travelToTargets:true,scale:.72,minSize:180,maxSize:280})},
        blazeSpell:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/blaze-spell-cast-v2.webp","single",{scale:2.15,maxSize:260})},
        flameTornado:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/flame-tornado-cast-v2.webp","single",{scale:2.35,maxSize:300})},
        phoenixCry:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/phoenix-cry-cast.png?v=165","battlefield",{scale:1.12,minSize:280})},
        rage:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/rage-recipient-v1.webp","single",{scale:1.08,minSize:96,maxSize:148,presentation:"per-recipient"})},
        fireSoulResonance:{hit:DEFAULT_HIT,deferredActorStatusTypes:["fireSoulResonance"],sprite:castSheet("assets/vfx/fire/fire-soul-resonance-cast-v2.webp","single",{scale:1.7,maxSize:225})},
        bloodBurnArt:{hit:DEFAULT_HIT,deferredActorStatusTypes:["bloodBurn"],sprite:castSheet("assets/vfx/fire/blood-burn-art-cast.webp","single",{scale:1.7,maxSize:225})},
        fireEX:{hit:.74,noVisual:true,passive:true},

        waterKnife:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-blade-slash-vfx.png?v=166","single",{scale:2.05,maxSize:250})},
        frostPunch:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/frost-fist-vfx.png?v=166","single",{scale:2.15,maxSize:260})},
        iceSpin:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/ice-spin-wide-v2.webp","single",{scale:1.95,maxSize:235,cellAspect:2.2448275862068967})},
        frostCrush:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/freeze-heavy-strike-vfx.png?v=166","single",{scale:2.35,maxSize:290})},
        waterBall:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-orb-recipient-v1.webp","group",{scale:1.22,minSize:150,maxSize:500,alignToSlots:true,presentation:"per-recipient"})},
        // Match each authored head angle to the travel direction; the splash
        // returns upright only after the complete source reaches its endpoint.
        floodBeast:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/tidal-beast-safe-v3.webp","targetTrajectory",{travelToTargets:true,scale:1.85,minSize:175,maxSize:250,motionPhases:{flightStart:2,turnFrame:5,impactStart:6,flightSourceAngle:0,turnSourceAngle:90}})},
        iceArrowRain:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/frost-arrow-rain-vfx.png?v=173.19","battlefield",{fixedFormation:true,coverageScale:1.22,minWidth:140,minHeight:140})},
        freeze:{hit:DEFAULT_HIT,deferredStatusTypes:["freeze"],sprite:castSheet("assets/vfx/water/freeze-cast-vfx.png?v=166","single",{scale:2.2,maxSize:270,presentation:"per-recipient"})},
        healSpell:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/heal-recipient-v1.webp","single",{scale:2.05,maxSize:250,presentation:"per-recipient"})},
        revive:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-revive-vfx.png?v=166","single",{scale:2.3,maxSize:285})},
        purifyMind:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/purify-mind-cast.webp","single",{scale:2.05,maxSize:250})},
        waterEX:{hit:.74,noVisual:true,passive:true},

        stormFist:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/vfx/wind/storm-fist-cast.png?v=173.24","single",{scale:2.15,maxSize:260})},
        stormFlurry:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/storm-flurry-wide-v3.webp","single",{scale:1.4,minSize:96,maxSize:184,presentation:"per-recipient",recipientSlice:"center-third",cellAspect:2.25})},
        windCrossSlash:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/wind-cross-slash-cast.png?v=173.24","single",{scale:2.25,maxSize:280})},
        dizzyFist:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/vfx/wind/dizzy-fist-cast.png?v=173.24","single",{scale:2.35,maxSize:290})},
        windSpell:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/vfx/wind/wind-spell-wide-v2.webp","group",{scale:1.08,minSize:190,alignToSlots:true,cellAspect:2.25})},
        stormCircle:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/storm-circle-wide-v2.webp","group",{scale:1.08,minSize:190,alignToSlots:true,cellAspect:2.25})},
        windHowlLightning:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/wind-howl-lightning-cast.png?v=173.24","single",{scale:2.35,maxSize:290})},
        stormRain:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/vfx/wind/storm-rain-recipient-v1.webp","battlefield",{scale:1.08,minSize:280,presentation:"per-recipient"})},
        dodgeSkill:{hit:.5,deferredStatusTypes:["dodgeSkill"],sprite:castSheet("assets/vfx/wind/dodge-recipient-v1.webp","group",{scale:1.08,minSize:190,alignToSlots:true,presentation:"per-recipient"})},
        stealthSkill:{hit:.5,deferredStatusTypes:["stealthSkill"],sprite:castSheet("assets/vfx/wind/stealth-skill-cast.png?v=173.24","single",{scale:2.15,maxSize:260})},
        dinghaishenzhen:{hit:.5,deferredStatusTypes:["dinghaishenzhen"],sprite:castSheet("assets/vfx/wind/calm-mind-cast-person-v2.webp","battlefield",{scale:1.08,minSize:280,presentation:"per-recipient"})},
        windEX:{hit:.74,noVisual:true,passive:true},
        /* Monster-only legacy derivative: use an existing formal Wind sheet,
           never a generated text/particle fallback. */
        windArrow:{hit:.5,sprite:castSheet("assets/vfx/wind/wind-spell-cast.png?v=173.24","targetTrajectory",{travelToTargets:true,scale:1.8,minSize:150,maxSize:230,reusedFrom:"windSpell"})},

        stoneSlash:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/stone-slash-cast.png?v=173.39","single",{scale:2.2,maxSize:270})},
        petrifyFist:{hit:.5,deferredActorStatusTypes:["shield"],sprite:castSheet("assets/vfx/earth/petrify-fist-wide-v2.webp","group",{scale:1.08,minSize:190,alignToSlots:true,cellAspect:2.25})},
        stoneBreakSky:{hit:.5,deferredActorStatusTypes:["shield"],sprite:castSheet("assets/vfx/earth/stone-break-sky-soft-edge-v2.webp","single",{scale:2.35,maxSize:290})},
        earthquakeCrush:{hit:.5,deferredStatusTypes:["petrify"],sprite:castSheet("assets/vfx/earth/earthquake-crush-wide-v2.webp","group",{scale:1.08,minSize:190,alignToSlots:true,cellAspect:2.25})},
        stoneThrow:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/stone-throw-wide-v2.webp","group",{scale:1.08,minSize:190,alignToSlots:true,cellAspect:2.25})},
        sandWind:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/rolling-stone-wide-v2.webp","group",{scale:1.08,minSize:190,alignToSlots:true,preserveSourceAspect:true,cellAspect:2.25})},
        flyingSandStrike:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/flying-sand-strike-cast.png?v=173.39","battlefield",{scale:1.08,minSize:280})},
        dustStorm:{hit:.5,deferredStatusTypes:["petrify"],sprite:castSheet("assets/vfx/earth/dust-storm-cast.png?v=173.39","single",{scale:2.4,maxSize:300})},
        earthShield:{hit:.5,deferredStatusTypes:["earthShield"],sprite:castSheet("assets/vfx/earth/earth-shield-cast-v2.webp","single",{scale:1.7,maxSize:225})},
        rockWall:{hit:.5,deferredStatusTypes:["rockWall"],sprite:castSheet("assets/vfx/earth/rock-wall-recipient-v1.webp","group",{scale:1.08,minSize:190,alignToSlots:true,presentation:"per-recipient"})},
        barrier:{hit:.5,deferredStatusTypes:["barrier"],sprite:castSheet("assets/vfx/earth/barrier-cast.png?v=173.39","single",{scale:2.25,maxSize:280})},
        earthEX:{hit:.74,noVisual:true,passive:true},

        /* Team Relic VFX — 4x3 / 12-frame lossless WebP sheets.
           These are lazy because only the equipped relic should be prefetched. */
        relic_qiankun_flask:relicSheet("assets/vfx/relic/relic_qiankun_flask.webp",7),
        relic_sun_orb:relicSheet("assets/vfx/relic/relic_sun_orb.webp",7),
        relic_xuanwu_seal:relicSheet("assets/vfx/relic/relic_xuanwu_seal.webp",8),
        relic_soul_bell:relicSheet("assets/vfx/relic/relic_soul_bell.webp",8),
        relic_tiangang_banner:relicSheet("assets/vfx/relic/relic_tiangang_banner.webp",9),
        relic_nine_dragon_fire:relicSheet("assets/vfx/relic/relic_nine_dragon_fire.webp?v=6a58936606a0",8),
        relic_cold_spring_jade:relicSheet("assets/vfx/relic/relic_cold_spring_jade.webp",7),
        relic_qinglan_feather:relicSheet("assets/vfx/relic/relic_qinglan_feather.webp",6),
        relic_rock_mountain_seal:relicSheet("assets/vfx/relic/relic_rock_mountain_seal.webp",7),
        relic_returning_wheel:relicSheet("assets/vfx/relic/relic_returning_wheel.webp",7),
        relic_origin_talisman:relicSheet("assets/vfx/relic/relic_origin_talisman.webp",7),
        relic_broken_army_scroll:relicSheet("assets/vfx/relic/relic_broken_army_scroll.webp",8),
        relic_red_sky_war_mark:relicSheet("assets/vfx/relic/relic_red_sky_war_mark.webp",7),
        relic_ice_mirror_heart:relicSheet("assets/vfx/relic/relic_ice_mirror_heart.webp",6),
        relic_wind_chasing_talisman:relicSheet("assets/vfx/relic/relic_wind_chasing_talisman.webp",6),
        relic_mountain_river_cauldron:relicSheet("assets/vfx/relic/relic_mountain_river_cauldron.webp",7),
        relic_burning_star_mark:relicSheet("assets/vfx/relic/relic_burning_star_mark.webp",7),
        relic_spirit_spring_bottle:relicSheet("assets/vfx/relic/relic_spirit_spring_bottle.webp",6),
        relic_demon_suppressing_seal:relicSheet("assets/vfx/relic/relic_demon_suppressing_seal.webp",6),
        relic_all_returning_array:relicSheet("assets/vfx/relic/relic_all_returning_array.webp",8),

        /* These Light support skills currently have no dedicated finished cast
           sheet. Their battle timing remains valid, but there is deliberately
           no procedural substitute. */
        yuanXiangGuangMing:{hit:.5,noVisual:true,missingDedicatedAsset:true},
        yuanGuangShield:{hit:.5,noVisual:true,missingDedicatedAsset:true},
        yuanZuBlessing:{hit:.5,deferredStatusTypes:["yuanZuBlessing"],sprite:castSheet("assets/vfx/light/yuan-zu-blessing-cast.png?v=173.39","battlefield",{scale:1.08,minSize:280})}
    };

    const STATUS_BODY_PRESENTATION=Object.freeze({
        burn:{anchor:"feet",width:1.12,height:.66,min:.42,max:.64},
        rage:{anchor:"feet",width:1.12,height:.14,min:.44,max:.60,aura:"red"},
        stun:{anchor:"head",width:.9,height:.22,min:.70,max:.86},
        freeze:{anchor:"feet",width:1.18,height:1.06,min:.68,max:.68},
        petrify:{anchor:"feet",width:1.16,height:1.04,min:.72,max:.72},
        dodgeSkill:{anchor:"feet",width:1.14,height:.13,min:.40,max:.58,aura:"green"},
        dinghaishenzhen:{anchor:"feet",width:1.12,height:.12,min:.40,max:.58,aura:"blue"},
        shield:{anchor:"feet",width:1.12,height:.94,min:.52,max:.52},
        earthShield:{anchor:"feet",width:1.12,height:1.08,min:.56,max:.56,shell:true},
        rockWall:{anchor:"feet",width:1.14,height:1.10,min:.58,max:.58,shell:true},
        barrier:{anchor:"feet",width:1.14,height:.92,min:.48,max:.48},
        yuanZuBlessing:{anchor:"feet",width:1.10,height:.66,min:.42,max:.62},
        fireSoulResonance:{anchor:"feet",width:1.10,height:.78,min:.40,max:.60},
        bloodBurn:{anchor:"feet",width:1.10,height:.70,min:.42,max:.64}
    });

    const RAW_STATUS_VISUALS={
        burn:statusVisual("assets/vfx/status/burn.webp","pulse","statusEffects",{label:"燃燒",statusName:"燃燒",iconSrc:"assets/vfx/status/burn.webp"}),
        rage:statusVisual("assets/vfx/status/rage-aura-v2.webp","pulse","activeBuffs",{label:"怒火",statusName:"怒火",iconSrc:"assets/vfx/status/rage-icon.webp"}),
        frostbite:statusVisual("","icon","statusEffects",{label:"凍傷",statusName:"凍傷",iconSrc:"assets/vfx/status/frostbite-icon.webp"}),
        freeze:statusVisual("assets/vfx/status/freeze.webp","static","statusEffects",{label:"冰封",statusName:"冰封",iconSrc:"assets/vfx/status/freeze.webp",visualLayer:STATUS_VISUAL_LAYERS.HARD_CONTROL_BASE}),
        agilityDown:statusVisual("","icon","statusEffects",{label:"重力",statusName:"重力",iconSrc:"assets/vfx/status/gravity-icon.webp"}),
        damageDown:statusVisual("","icon","statusEffects",{label:"殤風",statusName:"殤風",iconSrc:"assets/vfx/status/damage-down-icon.webp"}),
        stun:statusVisual("assets/vfx/status/stun-stars-v2.webp","pulse","statusEffects",{label:"暈眩",statusName:"暈眩",iconSrc:"assets/vfx/status/stun-icon.webp"}),
        dodgeSkill:statusVisual("assets/vfx/status/windwalk.webp","pulse","activeBuffs",{label:"風行",statusName:"風行",iconSrc:"assets/vfx/status/windwalk.webp"}),
        stealthSkill:statusVisual("","none","activeBuffs",{label:"隱身",statusName:"隱身",noBodyVisual:true,noHudIcon:true}),
        dinghaishenzhen:statusVisual("assets/vfx/status/calm-mind.webp","pulse","activeBuffs",{label:"氣定神閒",statusName:"氣定神閒",iconSrc:"assets/vfx/status/calm-mind.webp"}),
        defenseDown:statusVisual("","icon","statusEffects",{label:"破防",statusName:"破防",iconSrc:"assets/vfx/status/defense-down-icon.webp"}),
        shield:statusVisual("assets/vfx/status/shield.webp","static","activeBuffs",{label:"護盾",statusName:"岩盾",iconSrc:"assets/vfx/status/shield.webp"}),
        petrify:statusVisual("assets/vfx/status/petrify.webp","static","statusEffects",{label:"石化",statusName:"石化",iconSrc:"assets/vfx/status/petrify.webp",visualLayer:STATUS_VISUAL_LAYERS.HARD_CONTROL_BASE}),
        earthShield:statusVisual("assets/vfx/status/earth-shield.webp","static","activeBuffs",{label:"萬象土盾",statusName:"萬象土盾",iconSrc:"assets/vfx/status/earth-shield.webp"}),
        rockWall:statusVisual("assets/vfx/status/rock-wall.webp","static","activeBuffs",{label:"岩石壁壘",statusName:"岩石壁壘",iconSrc:"assets/vfx/status/rock-wall.webp"}),
        barrier:statusVisual("assets/vfx/status/barrier.webp","static","activeBuffs",{label:"結界",statusName:"結界",iconSrc:"assets/vfx/status/barrier.webp"}),
        yuanZuBlessing:statusVisual("assets/vfx/status/yuan-zu-blessing.webp","pulse","activeBuffs",{label:"元祖賜福",statusName:"元祖賜福",iconSrc:"assets/vfx/status/yuan-zu-blessing.webp"}),
        fireMomentum:statusVisual("","none","activeBuffs",{label:"炎勢",statusName:"炎勢",noBodyVisual:true,noHudIcon:true}),
        phoenixMight:statusVisual("","icon","activeBuffs",{label:"鳳威",statusName:"鳳威",iconSrc:"assets/vfx/status/phoenix-might-icon.webp"}),
        fireSoulResonance:statusVisual("assets/vfx/status/fire-soul-resonance.webp","pulse","activeBuffs",{label:"炎魂共鳴",statusName:"炎魂共鳴",iconSrc:"assets/vfx/status/fire-soul-resonance.webp"}),
        bloodBurn:statusVisual("assets/vfx/status/blood-burn.webp","pulse","activeBuffs",{label:"焚血",statusName:"焚血",iconSrc:"assets/vfx/status/blood-burn.webp"})
    };

    function protectObject(value,label){
        if(!value||typeof value!=="object"||typeof Proxy!=="function"){ return value; }
        return new Proxy(value,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        });
    }

    Object.keys(RAW_MANIFEST).forEach(id=>{
        const model=RAW_MANIFEST[id];
        if(model.sprite){ model.sprite=protectObject(model.sprite,"sprite:"+id); }
        RAW_MANIFEST[id]=protectObject(model,"model:"+id);
    });
    Object.keys(RAW_STATUS_VISUALS).forEach(type=>{
        RAW_STATUS_VISUALS[type]=protectObject(RAW_STATUS_VISUALS[type],"status:"+type);
    });

    const MANIFEST=typeof Proxy==="function"
        ?new Proxy(RAW_MANIFEST,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        })
        :RAW_MANIFEST;
    const STATUS_VISUALS=typeof Proxy==="function"
        ?new Proxy(RAW_STATUS_VISUALS,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        })
        :RAW_STATUS_VISUALS;

    window.v143SkillAnimationManifest=MANIFEST;
    window.v143StatusVisualManifest=STATUS_VISUALS;
    window.v143GetSkillAnimationModel=function(skillId){
        return MANIFEST[skillId]||{hit:DEFAULT_HIT,noVisual:true,missingAsset:true,signature:"missing-"+String(skillId||"unknown")};
    };

    function preflightAsset(source){
        if(!source||typeof Image!=="function"){ return; }
        const image=new Image();
        image.decoding="async";
        image.onerror=function(){ failedAssets.add(String(source)); };
        image.src=source;
    }
    Object.keys(RAW_MANIFEST).forEach(id=>{
        const model=RAW_MANIFEST[id];
        const sprite=model&&model.sprite;
        if(sprite&&sprite.src&&!model.lazyAsset){ preflightAsset(sprite.src); }
        if(model.projectile?.src&&!model.lazyAsset){ preflightAsset(model.projectile.src); }
    });
    Object.keys(RAW_STATUS_VISUALS).forEach(type=>{
        const source=RAW_STATUS_VISUALS[type]&&RAW_STATUS_VISUALS[type].src;
        if(source){ preflightAsset(source); }
    });
    window.v143PreloadBattleVfxAsset=function(effectId){
        const model=MANIFEST[effectId];
        const sprite=model&&model.sprite;
        if(!sprite||!sprite.src){ return false; }
        preflightAsset(sprite.src);
        if(model.projectile?.src){ preflightAsset(model.projectile.src); }
        return true;
    };

    const director=window.v142SkillAnimationDirector;
    const originalPlay=director.play.bind(director);
    const originalDispose=director.dispose.bind(director);
    const state={
        version:VERSION,current:null,stage:null,timers:new Set(),pendingUpdates:new Map(),hpSamples:new WeakMap(),hpTrails:new Map(),impactFlashes:new Map(),hitOverlay:null,impactEpoch:0,
        metrics:{started:0,completed:0,missingVisuals:0,legacyNodesPurged:0,delayedNumbers:0,delayedDeaths:0}
    };
    window.v143SkillAnimationState=state;

    function setTimer(callback,delay){
        const id=setTimeout(()=>{ state.timers.delete(id); callback(); },Math.max(0,Number(delay)||0));
        state.timers.add(id);
        return id;
    }

    function clearImpactOverlays(reason){
        if(reason!=="render"){ window.FourSymbolsHitFeedback?.disposeAll(); }
        if(reason==="render"&&impactPageVisible()){
            const hits=state.current?.impactHits;
            const retained=Array.from(hits?.values()||[]).some(hit=>hit.lethal&&validImpactHit(hit)&&
                (!hit.presented||Array.from(state.impactFlashes.values()).some(entry=>entry.hit===hit)));
            if(retained){
                state.impactFlashes.forEach(entry=>{ if(!validImpactHit(entry.hit)){ entry.cancel(); } });
                return;
            }
        }
        state.impactEpoch=(state.impactEpoch||0)+1;
        state.impactTerminalCurrent=null;
        Array.from(state.impactFlashes.values()).forEach(entry=>entry.cancel());
        state.impactFlashes.clear();
        if(state.hitOverlay){ state.hitOverlay.remove(); state.hitOverlay=null; }
    }
    function impactPageVisible(){
        const page=document.getElementById("battlePage");
        return !!page?.classList.contains("active")&&page.isConnected!==false&&!document.hidden;
    }
    function validImpactHit(hit){
        const token=typeof battleToken!=="undefined"?battleToken:null;
        return !!hit&&hit.epoch===state.impactEpoch&&impactPageVisible()&&
            (hit.battleToken===null||hit.battleToken===token||
                state.impactTerminalCurrent===hit.current&&state.impactTerminalToken===token)&&
            entityFor(hit.side,hit.index)===hit.entity&&
            hit.current.impactHits?.get(hit.index)===hit;
    }
    function captureImpactTarget(current,side,index){
        const entity=entityFor(side,index),card=cardFor(side,index);
        const artwork=card&&card.querySelector(".v174-battle-art");
        const projection=window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(side,index)?.artworkProjection;
        if(!entity||Number(entity.hp)<=0||entity.alive===false||!artwork||!projection){ return; }
        if(!current.impactTargets){ current.impactTargets=new Map(); }
        if(current.impactEpoch===undefined){ current.impactEpoch=state.impactEpoch; }
        // DOMRect properties are prototype getters, not enumerable fields.
        const rect=projection.rect;
        current.impactTargets.set(index,{entity,artwork,battleToken:typeof battleToken!=="undefined"?battleToken:null,
            projection:{...projection,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},portraitVariables:{...projection.portraitVariables}}});
    }
    function hasTerminalImpactPresentation(){
        // The core terminal decision can precede its existing exit owner's
        // battle_end notification. This query observes hits, not win/loss rules.
        const current=state.impactTerminalCurrent||state.current;
        return !!current&&Array.from(current.impactHits?.values()||[]).some(hit=>
            hit.lethal&&validImpactHit(hit)&&(hit.scheduled&&!hit.presented||
                Array.from(state.impactFlashes.values()).some(entry=>entry.hit===hit)));
    }
    function clearImpactTarget(side,index,reason){
        state.impactFlashes.forEach(entry=>{
            if(entry.side===side&&entry.index===index&&
               !(reason==="death"&&entry.hit?.lethal&&validImpactHit(entry.hit))){ entry.cancel(); }
        });
    }
    function syncImpactOverlays(){
        const page=document.getElementById("battlePage");
        if(!impactPageVisible()){ clearImpactOverlays(); return; }
        state.impactFlashes.forEach((entry,artwork)=>{
            const card=cardFor(entry.side,entry.index);
            const entity=entityFor(entry.side,entry.index);
            if(validImpactHit(entry.hit)&&(entry.hit.lethal||Number(entity.hp)>0&&entity.alive!==false)){ return; }
            if(entry.entity!==entity||!artwork.isConnected||!card||card.querySelector(".v174-battle-art")!==artwork||
               !entity||Number(entity.hp)<=0||entity.alive===false){ entry.cancel(); }
        });
    }
    function createImpactFlash(artwork,side,index,current,impactEpoch,hit){
        const page=document.getElementById("battlePage");
        const lethal=hit?.lethal&&validImpactHit(hit)&&!hit.presented;
        if(impactEpoch!==state.impactEpoch||!impactPageVisible()||
           typeof battleActive!=="undefined"&&!battleActive&&!(lethal&&state.impactTerminalCurrent===current)){ return null; }
        const geometry=window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(side,index);
        const projection=validImpactHit(hit)&&(lethal||!artwork.isConnected)?hit.projection:geometry&&geometry.artworkProjection;
        const entity=entityFor(side,index);
        if(!projection||!projection.rect.width||!projection.rect.height||
           (!projection.genericPortrait&&(!projection.backgroundImage||projection.backgroundImage==="none"))||
           !entity||!lethal&&(!artwork.isConnected&&!validImpactHit(hit)||Number(entity.hp)<=0||entity.alive===false)){ return null; }
        if(hit){ hit.presented=true; }
        const previous=state.impactFlashes.get(artwork);
        if(previous){ previous.cancel(); }
        if(!state.hitOverlay){
            state.hitOverlay=document.createElement("div");
            state.hitOverlay.className="v143-hit-feedback-overlay";
            state.hitOverlay.setAttribute("aria-hidden","true");
            document.body.appendChild(state.hitOverlay);
        }
        const feedback=hit&&current.hitFeedback?.config.enabled?current.hitFeedback:null;
        const node=feedback?window.FourSymbolsHitFeedback.acquire("flash"):document.createElement("i");
        node.className="v143-hit-feedback-art";
        if(projection.genericPortrait){
            node.className+=" v174-generic-portrait";
            Object.entries(projection.portraitVariables||{}).forEach(([name,value])=>{
                if(value){ node.style.setProperty(name,value); }
            });
        }
        node.dataset.side=side;
        node.dataset.index=String(index);
        node.dataset.sequence=String(current.sequence);
        const rect=projection.rect;
        Object.assign(node.style,{
            left:rect.left+"px",top:rect.top+"px",width:rect.width+"px",height:rect.height+"px",
            backgroundImage:projection.backgroundImage,backgroundSize:projection.backgroundSize,
            backgroundPosition:projection.backgroundPosition,backgroundRepeat:projection.backgroundRepeat
        });
        state.hitOverlay.appendChild(node);
        if(feedback){
            node.style.filter="brightness("+feedback.config.brightness+")";
            node.style.mixBlendMode=feedback.config.blendMode;
        }
        const animation=node.animate(feedback?[
            {opacity:1,offset:0,easing:"steps(1,end)"},{opacity:0,offset:1}
        ]:[
            {opacity:1,offset:0,easing:"steps(1, end)"},
            {opacity:0,offset:.4,easing:"steps(1, end)"},
            {opacity:1,offset:.6,easing:"steps(1, end)"},
            {opacity:0,offset:1}
        ],{duration:feedback?feedback.config.flashMs:200,easing:"linear"});
        if(feedback){ animation.hitFeedbackOwnEffect=true; }
        const entry={node,animation,side,index,entity,hit,sequence:current.sequence,cancel:()=>{
            animation.onfinish=null;
            animation.cancel();
            if(feedback){ window.FourSymbolsHitFeedback.release("flash",node,feedback.config.poolLimit); }
            else{ node.remove(); }
            if(state.impactFlashes.get(artwork)===entry){ state.impactFlashes.delete(artwork); }
            if(!state.impactFlashes.size&&state.hitOverlay){
                state.hitOverlay.remove(); state.hitOverlay=null;
                window.FourSymbolsBattlePresentation?.syncHud?.();
            }
        }};
        state.impactFlashes.set(artwork,entry);
        if(state.impactFlashes.size===1){ window.FourSymbolsBattlePresentation?.syncHud?.(); }
        animation.onfinish=entry.cancel;
        return entry;
    }
    window.v143ClearImpactOverlays=clearImpactOverlays;
    window.v143ClearImpactTarget=clearImpactTarget;
    window.v143SyncImpactOverlays=syncImpactOverlays;
    window.v143HasTerminalImpactPresentation=hasTerminalImpactPresentation;
    window.FourSymbolsCombatEvents?.subscribe("battle_end",()=>{
        const current=state.current;
        state.impactTerminalCurrent=current;
        state.impactTerminalToken=typeof battleToken!=="undefined"?battleToken+1:null;
        if(!hasTerminalImpactPresentation()){ clearImpactOverlays(); }
        else{ state.impactFlashes.forEach(entry=>{ if(!entry.hit?.lethal||!validImpactHit(entry.hit)){ entry.cancel(); } }); }
        window.FourSymbolsBattlePresentation?.syncHud?.();
    });
    window.FourSymbolsCombatEvents?.subscribe("hp_damage",event=>{
        const current=state.current;
        const indirect=["dot","relic","reflect","environment","self","hpCost"];
        if(current&&!current.done&&current.impactEpoch===state.impactEpoch&&!state.impactTerminalCurrent&&impactPageVisible()&&
           (current.config.id==="normal"||["physical","magic"].includes(current.config.category))&&
           event.damageKind==="direct"&&!indirect.includes(event.sourceType)&&
           event.previousHp>0&&event.actualHpLoss>0){
            current.impactTargets?.forEach((snapshot,index)=>{
                if(snapshot.entity!==event.target||entityFor(current.targetSide,index)!==event.target){ return; }
                if(current.impactHits?.get(index)?.lethal){ return; }
                if(!current.impactHits){ current.impactHits=new Map(); }
                current.impactHits.set(index,{...snapshot,side:current.targetSide,index,current,
                    fact:event,epoch:state.impactEpoch,lethal:event.hpAfterDamage<=0,scheduled:false,presented:false});
            });
        }
        if(!event.target||Number(event.target.hp)>0){ return; }
        state.impactFlashes.forEach(entry=>{
            if(entry.entity===event.target&&entry.hit?.fact!==event&&
               !(entry.hit?.lethal&&validImpactHit(entry.hit))){ entry.cancel(); }
        });
    });
    if(typeof document.addEventListener==="function"){
        document.addEventListener("visibilitychange",()=>{ if(document.hidden){ director.dispose(); } });
    }

    function clearTimers(){
        state.timers.forEach(id=>clearTimeout(id));
        state.timers.clear();
        state.pendingUpdates.clear();
        state.hpTrails.forEach(entry=>{ entry.animation.cancel(); entry.node.remove(); });
        state.hpTrails.clear();
        state.hpSamples=new WeakMap();
        clearImpactOverlays();
    }

    /* Read the final HUD projection, never delay or write gameplay HP. Boss
       shields change the bar denominator; only actual HP loss creates a trail. */
    window.v143PresentHpLoss=function(bar,entity,maxHP){
        if(!bar||!entity){ return; }
        const hp=Math.max(0,Number(entity.hp)||0);
        const percent=Math.max(0,Math.min(100,parseFloat(bar.style.width)||0));
        const previous=state.hpSamples.get(bar);
        state.hpSamples.set(bar,{entity,hp,percent});
        const clear=function(){
            const entry=state.hpTrails.get(bar);
            if(entry){ entry.animation.cancel(); entry.node.remove(); state.hpTrails.delete(bar); }
        };
        if(!previous||previous.entity!==entity||hp>previous.hp||hp===previous.hp&&percent!==previous.percent){ clear(); return; }
        if(hp>=previous.hp){ return; }
        clear();
        if(!bar.parentElement||typeof bar.animate!=="function"||
           typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){ return; }
        const denominator=hp>0&&percent>0?hp/percent*100:Math.max(1,Number(maxHP)||1);
        const loss=Math.min(100-percent,(previous.hp-hp)/denominator*100);
        if(loss<=0){ return; }
        const node=document.createElement("span");
        node.className="v143-hp-damage-trail";
        node.setAttribute("aria-hidden","true");
        node.style.left=percent+"%";
        node.style.width=loss+"%";
        bar.parentElement.appendChild(node);
        const animation=node.animate([{opacity:1},{opacity:1,offset:.2},{opacity:0}],{duration:260,easing:"ease-out"});
        const entry={node,animation};
        state.hpTrails.set(bar,entry);
        animation.onfinish=()=>{ node.remove(); if(state.hpTrails.get(bar)===entry){ state.hpTrails.delete(bar); } };
    };

    function purgeLegacyCardVfx(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        let removed=0;
        document.querySelectorAll(".v141-card-effects,#v142-skill-stage").forEach(node=>{
            if(node&&typeof node.remove==="function"){ node.remove(); removed++; }
        });
        state.metrics.legacyNodesPurged+=removed;
    }

    function purgeStaleRasterStages(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        document.querySelectorAll("#v143-skill-stage").forEach(node=>{
            if(node!==state.stage&&node&&typeof node.remove==="function"){ node.remove(); }
        });
    }

    function cardFor(side,index){
        if(typeof document==="undefined"){ return null; }
        return document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
    }

    function entityFor(side,index){
        if(side==="monster"){
            return typeof monsters!=="undefined"&&monsters?monsters[index]:null;
        }
        return typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
    }

    function canReceive(config,side,index){
        const entity=entityFor(side,index);
        if(!entity){ return false; }
        if(String(config&&config.category||"")==="revive"){
            return Number(entity.hp)<=0||entity.alive===false;
        }
        return Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false);
    }

    function geometryOwner(){
        const owner=window.FourSymbolsBattlefieldSlots;
        return owner&&typeof owner.getSlotRect==="function"?owner:null;
    }

    function slotForTarget(side,index,card){
        const owner=geometryOwner();
        if(!owner){ return null; }
        let slot=typeof owner.getSlotForCombatant==="function"?owner.getSlotForCombatant(side,index):null;
        if(!slot&&typeof owner.getSlotFromElement==="function"){
            slot=owner.getSlotFromElement(card||cardFor(side,index));
        }
        return slot||null;
    }

    function slotAnchor(side,index,card){
        const boss=window.FourSymbolsBossBattle;
        if(side==="monster"&&boss&&typeof boss.getTargetGeometry==="function"){
            const targetRect=boss.getTargetGeometry(index);
            if(targetRect){
                return {slot:isBossIndexForVfx(index)?"BOSS_FOOTPRINT":slotForTarget(side,index,card),x:targetRect.centerX,y:targetRect.centerY,rect:targetRect};
            }
        }
        const owner=geometryOwner();
        const slot=slotForTarget(side,index,card);
        if(!owner||!slot){ return null; }
        const center=typeof owner.getSlotCenter==="function"?owner.getSlotCenter(slot):null;
        const rect=center&&center.rect?center.rect:owner.getSlotRect(slot);
        if(!center||!rect){ return null; }
        return {slot:slot,x:center.x,y:center.y,rect:rect};
    }

    function isBossIndexForVfx(index){
        const boss=window.FourSymbolsBossBattle;
        return !!(boss&&typeof boss.isBossIndex==="function"&&boss.isBossIndex(index));
    }

    function activeCards(side,config){
        const cards=[];
        const indexes=side==="monster"&&typeof currentBattleMonsters!=="undefined"
            ?currentBattleMonsters.filter(Number.isInteger)
            :[0,1,2,3,4,5];
        indexes.forEach(index=>{
            const card=cardFor(side,index);
            if(card&&card.offsetParent!==null&&canReceive(config,side,index)){ cards.push({index:index,card:card}); }
        });
        return cards;
    }

    function targetSideFor(config,side){
        const ally=/ally/i.test(String(config.targetType||""))||/heal|revive|buff/.test(String(config.category||""));
        return ally?side:(side==="player"?"monster":"player");
    }

    function initialTargetIndexes(config,meta,targetSide){
        const explicit=Array.isArray(meta.targetIds)
            ?meta.targetIds
            :(meta.targetId!==undefined&&meta.targetId!==null?[meta.targetId]:[]);
        return Array.from(new Set(explicit.filter(index=>
            Number.isInteger(index)&&canReceive(config,targetSide,index)
        )));
    }

    function geometrySeedIndexes(current,indexes){
        if(Array.isArray(current&&current.targetIds)&&current.targetIds.length){ return current.targetIds.slice(); }
        if(current&&current.targetId!==undefined&&current.targetId!==null){ return [current.targetId]; }
        return Array.isArray(indexes)?indexes.slice():[];
    }

    function geometryPrimarySlot(current,indexes){
        const owner=geometryOwner();
        if(!owner||!current){ return null; }
        const seed=geometrySeedIndexes(current,indexes);
        const candidates=[];
        if(current.targetId!==undefined&&current.targetId!==null){ candidates.push(current.targetId); }
        seed.forEach(value=>candidates.push(value));
        for(const value of candidates){
            const slot=slotForTarget(current.targetSide,value,cardFor(current.targetSide,value));
            if(slot){ return slot; }
        }
        return null;
    }

    function geometryPrimaryAnchor(current,indexes){
        const seed=geometrySeedIndexes(current,indexes);
        const primary=current&&current.targetId!==undefined&&current.targetId!==null
            ?current.targetId:(seed.length?seed[0]:null);
        if(current&&current.targetSide==="monster"&&Number.isInteger(primary)){
            const boss=window.FourSymbolsBossBattle;
            const targetRect=boss&&typeof boss.getTargetGeometry==="function"?boss.getTargetGeometry(primary):null;
            if(targetRect){
                return {slot:isBossIndexForVfx(primary)?"BOSS_FOOTPRINT":slotForTarget("monster",primary,cardFor("monster",primary)),x:targetRect.centerX,y:targetRect.centerY,rect:targetRect};
            }
        }
        const owner=geometryOwner();
        const slot=geometryPrimarySlot(current,indexes);
        if(!owner||!slot){ return null; }
        const center=typeof owner.getSlotCenter==="function"?owner.getSlotCenter(slot):null;
        const rect=center&&center.rect?center.rect:owner.getSlotRect(slot);
        if(!rect){ return null; }
        return {
            slot:slot,
            x:center?center.x:rect.centerX,
            y:center?center.y:rect.centerY,
            rect:rect
        };
    }

    function geometryBounds(current,indexes,placement){
        const owner=geometryOwner();
        if(!owner||!current){ return null; }
        const seed=geometrySeedIndexes(current,indexes);
        const targetType=String(current.targetType||current.config&&current.config.targetType||"single");
        if(placement==="battlefield"||targetType==="all"||targetType==="allyAll"){
            const rect=typeof owner.getSideRect==="function"?owner.getSideRect(current.targetSide):null;
            if(rect){ rect.id=current.targetSide==="monster"?"fixed-enemy-zone":"fixed-ally-zone"; }
            return rect;
        }
        const primarySlot=geometryPrimarySlot(current,indexes);
        if(!primarySlot){ return null; }

        let shape=targetType;
        if(!/^(single|all|allyAll|row|column|tri|horizontal-3|allyTri)$/i.test(shape)){
            shape=placement==="group"||placement==="trajectory"?(current.targetSide==="player"?"all":"row"):"single";
        }
        const rect=typeof owner.getGeometryRectFromShape==="function"
            ?owner.getGeometryRectFromShape(current.targetSide,primarySlot,shape)
            :owner.getSlotRect(primarySlot);
        if(rect){
            const anchor=geometryPrimaryAnchor(current,indexes);
            if(anchor&&isBossIndexForVfx(current.targetId)&&!/^all$/i.test(shape)){
                rect.left=anchor.x-rect.width/2;
                rect.right=anchor.x+rect.width/2;
                rect.top=anchor.y-rect.height/2;
                rect.bottom=anchor.y+rect.height/2;
                rect.centerX=anchor.x;
                rect.centerY=anchor.y;
            }
            rect.id="fixed-slot-"+String(shape).toLowerCase();
        }
        return rect;
    }

    function placementFor(config,sprite,targetTypeOverride){
        const authored=String(sprite&&sprite.placement||"single");
        const targetType=String(targetTypeOverride||config&&config.targetType||"single");
        // Explicit recipient artwork reuses the existing single-node emitter.
        // The formal target type/recipient set and hit authority stay unchanged.
        if(sprite&&sprite.presentation==="per-recipient"){ return "single"; }
        if(/^(all|enemyAll|allyAll)$/i.test(targetType)){ return "battlefield"; }
        if(/^(tri|allyTri|row|column|horizontal-3)$/i.test(targetType)){
            return authored==="trajectory"?"trajectory":"group";
        }
        return authored;
    }

    function hasTimedEffect(entity,type){
        if(!entity){ return false; }
        const spec=STATUS_VISUALS[type];
        const collection=spec&&spec.collection==="statusEffects"?entity.statusEffects:entity.activeBuffs;
        if(Array.isArray(collection)&&collection.some(effect=>
            effect&&Number(effect.turnsLeft)>0&&(
                effect.type===type||(spec&&spec.statusName&&effect.statusName===spec.statusName)
            )
        )){ return true; }
        return type==="rage"&&Array.isArray(entity.v141TeamBuffs)&&entity.v141TeamBuffs.some(effect=>
            effect&&effect.type==="rage"&&Number(effect.turnsLeft)>0
        );
    }

    function snapshotTimedEffects(model){
        const snapshot=new Set();
        const relevantTypes=Array.from(new Set(
            []
                .concat(Array.isArray(model&&model.deferredStatusTypes)?model.deferredStatusTypes:[])
                .concat(Array.isArray(model&&model.deferredActorStatusTypes)?model.deferredActorStatusTypes:[])
        )).filter(type=>!!STATUS_VISUALS[type]);
        if(!relevantTypes.length){ return snapshot; }
        const groups=[
            ["monster",typeof currentBattleMonsters!=="undefined"?currentBattleMonsters.filter(Number.isInteger):[]],
            ["player",[0,1,2,3,4,5]]
        ];
        groups.forEach(entry=>{
            entry[1].forEach(index=>{
                const entity=entityFor(entry[0],index);
                relevantTypes.forEach(type=>{
                    if(hasTimedEffect(entity,type)){ snapshot.add(entry[0]+":"+index+":"+type); }
                });
            });
        });
        return snapshot;
    }

    function deferredStatusDuringCast(side,index,type){
        const current=state.current;
        if(!current||current.done){ return false; }
        const actorTypes=Array.isArray(current.model.deferredActorStatusTypes)?current.model.deferredActorStatusTypes:[];
        if(
            actorTypes.indexOf(type)>=0&&current.side===side&&current.actorIndex===index&&
            !(current.statusAtStart&&current.statusAtStart.has(side+":"+index+":"+type))&&
            hasTimedEffect(entityFor(side,index),type)
        ){ return true; }
        if(current.targetSide!==side){ return false; }
        if(current.settledTargets?.has(index)){ return false; }
        if(type==="rage"&&current.config.id==="rage"){
            const card=cardFor(side,index);
            if(card&&card.classList&&card.classList.contains("v143-effects-pending")){ return true; }
        }
        const types=Array.isArray(current.model.deferredStatusTypes)?current.model.deferredStatusTypes:[];
        if(types.indexOf(type)<0){ return false; }
        const tracked=current.deferredStatusTargets&&current.deferredStatusTargets.get(type);
        if(tracked&&tracked.has(index)){ return true; }
        const key=side+":"+index+":"+type;
        if(current.statusAtStart&&current.statusAtStart.has(key)){ return false; }
        if(hasTimedEffect(entityFor(side,index),type)){
            let targets=current.deferredStatusTargets.get(type);
            if(!targets){ targets=new Set(); current.deferredStatusTargets.set(type,targets); }
            targets.add(index);
            return true;
        }
        return false;
    }

    function statusVisualNode(card,type){
        if(!card){ return null; }
        const className="v143-status-visual-"+type;
        if(typeof card.querySelector==="function"){ return card.querySelector("."+className); }
        return Array.from(card.children||[]).find(node=>
            String(node.className||"").split(/\s+/).includes(className)
        )||null;
    }

    function statusIconHost(side,index,card){
        if(typeof document!=="undefined"&&typeof document.getElementById==="function"){
            const id=side==="monster"?"battleMonsterStatus"+index:"battlePlayerStatus"+index;
            const exact=document.getElementById(id);
            if(exact){ return exact; }
        }
        const nested=card&&typeof card.querySelector==="function"
            ?card.querySelector(".monster-status-badges")
            :null;
        return nested||card||null;
    }

    function statusIconNode(host,type){
        if(!host){ return null; }
        const className="v143-status-icon-"+type;
        if(typeof host.querySelector==="function"){ return host.querySelector("."+className); }
        return Array.from(host.children||[]).find(node=>
            String(node.className||"").split(/\s+/).includes(className)
        )||null;
    }

    function removeStatusVisual(card,side,index,type){
        const visual=statusVisualNode(card,type);
        if(visual&&typeof visual.remove==="function"){ visual.remove(); }
        else if(visual&&visual.parentNode){ visual.parentNode.removeChild(visual); }
        const host=statusIconHost(side,index,card);
        const icon=statusIconNode(host,type);
        if(icon&&typeof icon.remove==="function"){ icon.remove(); }
        else if(icon&&icon.parentNode){ icon.parentNode.removeChild(icon); }
    }

    function createBodyStatusVisual(type,spec){
        const node=document.createElement("i");
        node.className="v143-status-visual v143-status-visual-"+type+
            " v143-status-visual--"+spec.mode+
            " v143-status-visual--layer-"+spec.visualLayer;
        node.dataset.statusType=type;
        node.dataset.statusMode=spec.mode;
        node.dataset.statusLayer=spec.visualLayer;
        node.dataset.renderer="dom-status-visual";
        if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
        node.style.backgroundImage='url("'+String(spec.src).replace(/"/g,"%22")+'")';
        node.style.backgroundSize="contain";
        node.style.backgroundPosition="center";
        const profile=STATUS_BODY_PRESENTATION[type];
        if(profile?.aura){
            node.dataset.presentationRole="foot-aura";
            node.dataset.auraColor=profile.aura;
            node.style.backgroundImage="none";
            const rise=document.createElement("span");
            rise.className="v143-status-aura-rise";
            if(typeof rise.setAttribute==="function"){rise.setAttribute("aria-hidden","true");}
            node.appendChild(rise);
        }else if(profile?.shell){node.dataset.presentationRole="outer-shell";}
        return node;
    }

    function createStatusIcon(type,spec){
        const node=document.createElement("i");
        node.className="v143-status-icon v143-status-icon-"+type+" v143-status-icon--layer-hud";
        node.dataset.statusType=type;
        node.dataset.statusMode="icon";
        node.dataset.statusLayer=STATUS_VISUAL_LAYERS.HUD;
        node.dataset.renderer="dom-status-icon";
        const source=String(spec.iconSrc||spec.src||"");
        if(source){
            node.style.backgroundImage='url("'+source.replace(/"/g,"%22")+'")';
            node.style.backgroundSize="contain";
            node.style.backgroundPosition="center";
            node.style.backgroundRepeat="no-repeat";
        }
        node.title=spec.label||type;
        if(typeof node.setAttribute==="function"){ node.setAttribute("aria-label",spec.label||type); }
        return node;
    }

    const STATUS_ROTATION_MS=2000;
    let statusRotationTimer=null;
    const statusRotationByUnit=new Map();
    const hardControlContractViolationByUnit=new Map();

    function syncStatusVisual(side,index,type,showBody,presentationGeometry,presentationSnapshot){
        const spec=STATUS_VISUALS[type];
        const card=cardFor(side,index);
        const entity=entityFor(side,index);
        const alive=!!(spec&&card&&entity&&Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false));
        const active=alive&&hasTimedEffect(entity,type);
        if(!active||deferredStatusDuringCast(side,index,type)){
            removeStatusVisual(card,side,index,type);
            return;
        }
        if(spec.noBodyVisual&&spec.noHudIcon){
            removeStatusVisual(card,side,index,type);
            return;
        }

        const host=statusIconHost(side,index,card);
        const existingIcon=statusIconNode(host,type);
        const entry=[...(entity.statusEffects||[]),...(entity.activeBuffs||[])].filter(e=>
            Number(e.turnsLeft)>0&&(e.type===type||statusVisualTypeForEntry(e)===type)).slice(-1)[0];
        const automaticIcon=window.FourSymbolsHitFeedback?.statusEnabled(type,entry);
        if(spec.mode==="icon"||automaticIcon){
            if(host&&!existingIcon){ host.appendChild(createStatusIcon(type,spec)); }
        }else if(existingIcon){
            if(typeof existingIcon.remove==="function"){ existingIcon.remove(); }
            else if(existingIcon.parentNode){ existingIcon.parentNode.removeChild(existingIcon); }
        }
        const icon=statusIconNode(host,type);
        if(icon&&automaticIcon){
            const turns=Math.ceil(Number(entry?.turnsLeft)||0);
            if(turns>0&&turns<10000){icon.dataset.remainingTurns=String(turns);icon.title=(spec.label||type)+" · "+turns+" 回合";}
            else delete icon.dataset.remainingTurns;
        }else if(icon){delete icon.dataset.remainingTurns;}

        if(spec.mode==="icon"||showBody===false){
            const body=statusVisualNode(card,type);
            if(body&&typeof body.remove==="function"){ body.remove(); }
            return;
        }

        let node=statusVisualNode(card,type);
        if(!node){
            node=createBodyStatusVisual(type,spec);
            card.appendChild(node);
        }
        window.FourSymbolsHitFeedback?.decorateStatus(node,type,entry);

        const anchor=presentationSnapshot&&presentationSnapshot.anchor;
        if(!anchor){ return; }
        placeStatusBodyVisual(node,side,index,type,card,anchor,presentationGeometry,presentationSnapshot.cardRect,presentationSnapshot.pairedFrontHudRect);
    }

    function placeStatusBodyVisual(node,side,index,type,card,anchor,geometry,measuredCardRect,pairedFrontHudRect){
        const profile=STATUS_BODY_PRESENTATION[type];
        if(!profile){ return; }
        const cardRect=measuredCardRect||anchor.rect;
        const paint=geometry?.artworkProjection?.rect;
        const projected=geometry?.portraitRect;
        const portrait=paint&&paint.width>0&&paint.height>0?paint:
            projected&&projected.width>0&&projected.height>0?projected:anchor.rect;
        const scaleX=geometry?.hudSurface?.scaleX||1,scaleY=geometry?.hudSurface?.scaleY||1;
        // Character art uses a wide transparent carrier; its height limits the
        // body frame. Normalized monster paint already has a tight source box.
        const bodyWidth=side==="player"?Math.min(portrait.width,portrait.height):portrait.width;
        let width=Math.min(bodyWidth*profile.width,cardRect.width*.94);
        let height=portrait.height*profile.height;
        const x=portrait.left+portrait.width/2;
        const bottom=portrait.bottom===undefined?portrait.top+portrait.height:portrait.bottom;
        if(profile.shell){
            const ownHud=geometry?.hudSafeRect;
            const upperHud=pairedFrontHudRect&&pairedFrontHudRect.bottom<=bottom?pairedFrontHudRect:
                ownHud&&ownHud.bottom<=portrait.top?ownHud:null;
            const safeHeight=upperHud?Math.max(0,bottom-upperHud.bottom-2):portrait.height*profile.height;
            // These existing sources are square. Actual contain size is this
            // square budget; never claim a large carrier means a tall shell.
            const size=Math.min(portrait.height*profile.height,cardRect.width*.94,safeHeight);
            width=size;height=size;
            node.dataset.shellPaintSize=String(size);
            node.dataset.shellSourceAspect="1";
            node.dataset.shellHeightCoverage=String(size/Math.max(1,portrait.height));
            node.dataset.shellWidthCoverage=String(size/Math.max(1,bodyWidth));
        }
        let y=profile.anchor==="feet"?bottom-height/2:portrait.top+portrait.height/2;
        if(profile.anchor==="head"){
            y=portrait.top-height*.35;
            const hud=geometry?.hudSafeRect;
            if(hud&&hud.bottom<=portrait.top){ y=Math.max(y,hud.bottom+height/2+2); }
            // The adjacent front-row information band belongs to another unit.
            // Its rect is read in the shared pre-write snapshot, never here.
            const front=pairedFrontHudRect;
            if(front&&front.width>0&&front.height>0&&
               x+width/2>front.left&&x-width/2<front.right&&
               y+height/2>front.top-2&&y-height/2<front.bottom+2){
                y=Math.max(y,front.bottom+height/2+2);
            }
        }
        node.dataset.slot=anchor.slot;
        node.dataset.presentation=profile.anchor;
        node.style.left=((x-cardRect.left)/scaleX)+"px";
        node.style.top=((y-cardRect.top)/scaleY)+"px";
        node.style.width=(width/scaleX)+"px";
        node.style.height=(height/scaleY)+"px";
        node.style.setProperty("--v143-status-opacity-min",String(profile.min));
        node.style.setProperty("--v143-status-opacity-max",String(profile.max));
    }

    function activeBodyStatusTypesForLayer(entity,side,index,visualLayer){
        if(!entity){ return []; }
        return Object.keys(RAW_STATUS_VISUALS).filter(type=>{
            const spec=RAW_STATUS_VISUALS[type];
            return !!(
                spec&&spec.mode!=="icon"&&spec.src&&
                spec.visualLayer===visualLayer&&
                hasTimedEffect(entity,type)&&
                !deferredStatusDuringCast(side,index,type)
            );
        });
    }

    function reportHardControlVisualContractViolation(side,index,types){
        const key=side+":"+index;
        const signature=types.join("|");
        if(types.length<=1){
            hardControlContractViolationByUnit.delete(key);
            return;
        }
        if(hardControlContractViolationByUnit.get(key)===signature){ return; }
        hardControlContractViolationByUnit.set(key,signature);
        if(typeof console!=="undefined"&&typeof console.error==="function"){
            console.error(
                "[FourSymbols] Hard Control contract violation: Freeze and Petrify coexist.",
                {side:side,index:index,statusTypes:types.slice()}
            );
        }
    }

    function readStatusPresentation(side,index,geometryByUnit){
        const readGeometry=(targetSide,targetIndex)=>{
            const key=targetSide+":"+targetIndex;
            if(geometryByUnit?.has(key)){ return geometryByUnit.get(key); }
            const result=window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry?.(targetSide,targetIndex)||null;
            geometryByUnit?.set(key,result);
            return result;
        };
        const entity=entityFor(side,index);
        const card=cardFor(side,index);
        const baseBodyTypes=activeBodyStatusTypesForLayer(entity,side,index,STATUS_VISUAL_LAYERS.HARD_CONTROL_BASE);
        const rotatingBodyTypes=activeBodyStatusTypesForLayer(entity,side,index,STATUS_VISUAL_LAYERS.ROTATING);
        const hasBody=!!(card&&(baseBodyTypes.length||rotatingBodyTypes.length));
        const geometry=hasBody?readGeometry(side,index):null;
        const anchor=hasBody?slotAnchor(side,index,card):null;
        const cardRect=hasBody&&typeof card.getBoundingClientRect==="function"?card.getBoundingClientRect():anchor&&anchor.rect;
        let pairedFrontHudRect=null;
        const slot=String(anchor&&anchor.slot||"");
        if(side==="player"&&/^ALLY_B[123]$/.test(slot)&&
           baseBodyTypes.concat(rotatingBodyTypes).some(type=>STATUS_BODY_PRESENTATION[type]?.anchor==="head"||STATUS_BODY_PRESENTATION[type]?.shell)){
            const frontIndex=window.FourSymbolsBattlefieldSlots?.getCharacterAtAllySlot?.("ALLY_F"+slot.slice(-1));
            if(Number.isInteger(frontIndex)){pairedFrontHudRect=readGeometry("player",frontIndex)?.hudSafeRect||null;}
        }
        return {entity:entity,card:card,baseBodyTypes:baseBodyTypes,rotatingBodyTypes:rotatingBodyTypes,geometry:geometry,anchor:anchor,cardRect:cardRect,pairedFrontHudRect:pairedFrontHudRect};
    }

    function syncStatusVisualsForUnit(side,index,advanceRotation,presentationSnapshot){
        const snapshot=presentationSnapshot||readStatusPresentation(side,index);
        const {entity,card,baseBodyTypes,rotatingBodyTypes}=snapshot;
        const stealthActive=!!(
            entity&&Number(entity.hp)>0&&
            (side!=="monster"||entity.alive!==false)&&
            hasTimedEffect(entity,"stealthSkill")
        );
        if(card&&card.classList&&typeof card.classList.toggle==="function"){
            card.classList.toggle("v143-unit-stealthed",stealthActive);
        }
        reportHardControlVisualContractViolation(side,index,baseBodyTypes);

        const rotationKey=side+":"+index;
        const signature=rotatingBodyTypes.join("|");
        let rotation=statusRotationByUnit.get(rotationKey);
        if(!rotatingBodyTypes.length){
            statusRotationByUnit.delete(rotationKey);
            rotation=null;
        }else if(!rotation||rotation.signature!==signature){
            rotation={signature:signature,index:0};
            statusRotationByUnit.set(rotationKey,rotation);
        }else if(advanceRotation===true&&rotatingBodyTypes.length>1){
            rotation.index=(rotation.index+1)%rotatingBodyTypes.length;
        }
        const activeRotatingBodyType=rotation&&rotatingBodyTypes.length
            ?rotatingBodyTypes[rotation.index%rotatingBodyTypes.length]
            :null;
        const presentationGeometry=snapshot.geometry;

        Object.keys(RAW_STATUS_VISUALS).forEach(type=>{
            const spec=RAW_STATUS_VISUALS[type];
            const showBody=spec&&spec.visualLayer===STATUS_VISUAL_LAYERS.HARD_CONTROL_BASE
                ?baseBodyTypes.includes(type)
                :type===activeRotatingBodyType;
            syncStatusVisual(side,index,type,showBody,presentationGeometry,snapshot);
        });
    }

    function syncStatusVisualEffects(advanceRotation){
        const enemyIndexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters.filter(Number.isInteger):[];
        // Read the entire pass before any status removal/append/style write.
        // A new rotating body must not force layout for the next unit or layer.
        const geometryByUnit=new Map();
        const presentations=enemyIndexes.map(index=>({side:"monster",index:index,snapshot:readStatusPresentation("monster",index,geometryByUnit)}));
        for(let index=0;index<6;index++){
            presentations.push({side:"player",index:index,snapshot:readStatusPresentation("player",index,geometryByUnit)});
        }
        purgeLegacyCardVfx();
        presentations.forEach(entry=>syncStatusVisualsForUnit(entry.side,entry.index,advanceRotation===true,entry.snapshot));
    }

    function removeStatusVisualEffects(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        [".v143-status-visual",".v143-status-icon"].forEach(selector=>
            document.querySelectorAll(selector).forEach(node=>node.remove())
        );
        document.querySelectorAll(".v143-unit-stealthed").forEach(node=>
            node.classList.remove("v143-unit-stealthed")
        );
        statusRotationByUnit.clear();
        hardControlContractViolationByUnit.clear();
    }
    window.v143SyncStatusVisualEffects=syncStatusVisualEffects;
    window.v143StatusVisualLayers=STATUS_VISUAL_LAYERS;

    function ensureStatusRotationTimer(){
        if(statusRotationTimer||typeof window==="undefined"||typeof window.setInterval!=="function"){ return; }
        statusRotationTimer=window.setInterval(()=>{
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            syncStatusVisualEffects(true);
        },STATUS_ROTATION_MS);
    }
    ensureStatusRotationTimer();

    function statusVisualTypeForEntry(entry){
        if(!entry){ return null; }
        const direct=String(entry.type||"");
        if(RAW_STATUS_VISUALS[direct]){ return direct; }
        const named=String(entry.statusName||"");
        const buffType=String(entry.v141BuffType||"");
        if(buffType==="dodge"&&named==="元祖賜福"){ return "yuanZuBlessing"; }
        if(buffType==="dodge"){ return "dodgeSkill"; }
        if(buffType==="resistance"){ return "dinghaishenzhen"; }
        for(const type of Object.keys(RAW_STATUS_VISUALS)){
            const spec=RAW_STATUS_VISUALS[type];
            if(named&&(named===spec.statusName||named===spec.label)){ return type; }
        }
        return null;
    }

    function statusPercent(entry,key,fallback){
        const value=Number(entry&&entry[key]);
        if(Number.isFinite(value)&&value!==0){ return value; }
        const other=Number(entry&&entry[fallback]);
        return Number.isFinite(other)?other:0;
    }

    function statusEffectText(type,entry){
        const value=Number(entry&&entry.value)||0;
        if(type==="burn"){ return "每回合受到最大 HP "+(Number(entry.percent)||0)+"% 傷害"; }
        if(type==="rage"){
            const chance=statusPercent(entry,"critChanceBonusPercent","bonusPercent");
            const damage=statusPercent(entry,"critDamageBonusPercent","bonusPercent");
            return "爆擊率 +"+chance+"%，爆擊傷害 +"+damage+"%";
        }
        if(type==="frostbite"){ return "傷害 -30%、最終閃躲 -25%、最終異常狀態抗性 -25%"; }
        if(type==="freeze"){ return "無法行動"; }
        if(type==="agilityDown"){ return "敏捷降低 "+value+"%、出手速度降低 "+value+"%"; }
        if(type==="damageDown"){ return "造成傷害降低 "+value+"%"; }
        if(type==="stun"){ return "最終命中率降低 "+value+"%"; }
        if(type==="dodgeSkill"){
            const percent=statusPercent(entry,"bonusPercent","percent");
            return "最終閃躲提升 "+percent+"%";
        }
        if(type==="stealthSkill"){ return "無法被單體技能選中，仍會受到範圍技能"; }
        if(type==="dinghaishenzhen"){
            const resist=statusPercent(entry,"resistBonus","amount");
            const accuracy=Number(entry&&entry.accuracyBonusPercent)||0;
            const parts=[];
            if(resist){ parts.push("最終異常狀態抗性 +"+resist+"%"); }
            if(accuracy){ parts.push("最終命中率 +"+accuracy+"%"); }
            return parts.join("、")||"異常狀態抗性提升";
        }
        if(type==="defenseDown"){ return "防禦降低 "+value+"%"; }
        if(type==="shield"){
            const remaining=Math.max(0,Number(entry&&entry.remaining)||0);
            return remaining?"吸收傷害，剩餘護盾 "+Math.round(remaining):"吸收傷害";
        }
        if(type==="petrify"){ return "無法行動"; }
        if(type==="earthShield"){
            const percent=statusPercent(entry,"percent","reflectPercent");
            return "反彈受到傷害的 "+percent+"%";
        }
        if(type==="rockWall"){
            const percent=statusPercent(entry,"percent","defenseBonusPercent");
            return "防禦提升 "+percent+"%";
        }
        if(type==="barrier"){
            const blocks=Math.max(0,Number(entry&&entry.remainingBlocks)||0);
            return blocks?"完全抵擋傷害，剩餘 "+blocks+" 次":"完全抵擋傷害";
        }
        if(type==="yuanZuBlessing"){
            const percent=statusPercent(entry,"bonusPercent","evasionBonusPercent");
            return "最終閃躲提升 "+percent+"%";
        }
        if(type==="fireMomentum"){
            const percent=Number(entry&&entry.bonusPercent)||0;
            return "火系直接攻擊傷害提升 "+percent+"%";
        }
        if(type==="phoenixMight"){
            const percent=Number(entry&&entry.bonusPercent)||0;
            return "下一回合造成的所有傷害提升 "+percent+"%";
        }
        if(type==="fireSoulResonance"){
            const level=Math.max(1,Math.min(5,Number(entry&&entry.skillLevel)||1));
            const values=typeof skillDatabase!=="undefined"&&skillDatabase.fireSoulResonance&&skillDatabase.fireSoulResonance.momentumBonusByLevel;
            const percent=Array.isArray(values)?Number(values[level-1])||0:0;
            return "炎勢使火系直接攻擊傷害提升"+(percent?" "+percent+"%":"")+
                "；Lv5爆擊或成功新增燃燒可延長持續回合";
        }
        if(type==="bloodBurn"){
            const level=Math.max(1,Math.min(5,Number(entry&&entry.skillLevel)||1));
            const values=typeof skillDatabase!=="undefined"&&skillDatabase.bloodBurnArt&&skillDatabase.bloodBurnArt.directDamageBonusByLevel;
            const percent=Array.isArray(values)?Number(values[level-1])||0:0;
            return "火系攻擊傷害提升 "+percent+"%";
        }
        return "效果生效中";
    }

    function normalizedStatusEntry(entry,kind){
        if(entry&&entry.sourceType==="relic"){
            const parts=[];
            const labels={attackPercent:"攻擊",defensePercent:"防禦",evasionPercent:"最終閃避",resistancePercent:"最終異常抗性",ordinaryDamagePercent:"普通攻擊／主動技能直接傷害",critPercent:"最終爆擊",skillFinalPercent:"主動技能直接最終傷害"};
            Object.keys(labels).forEach(key=>{if(Number(entry[key])){parts.push(labels[key]+" +"+entry[key]+"%");}});
            if(Number(entry.damageReductionPercent)){parts.push("受到直接傷害 -"+entry.damageReductionPercent+"%");}
            if(entry.type==="relicArmor"){parts.push("剩餘 "+entry.charges+" 層，每敵方直接行動最多耗1層");}
            if(entry.type==="relicInsurance"){parts.push("下一個成功寫入的可淨化負面立即解除");}
            if(entry.sourceId==="wind_cycle_window"){parts.push("本回合首次完成主動技能返還實際SP消耗");}
            if(entry.type==="relicSuppression"){parts.push("直接最終傷害 -"+entry.finalDamageReductionPercent+"%、最終命中 -"+entry.finalHitReductionPercent+"%");}
            if(entry.type==="shield"){parts.push("剩餘護盾 "+Math.ceil(Math.max(0,Number(entry.remaining)||0)));}
            const turns=Math.max(0,Number(entry.turnsLeft)||0),persistent=turns>9999;
            return Object.freeze({type:entry.type,name:entry.statusName||"秘寶",iconSrc:entry.iconSrc||RAW_STATUS_VISUALS.shield.iconSrc,
                effect:parts.join("、")||"秘寶效果生效中",turnsLeft:persistent?null:Math.ceil(turns),
                remainingText:entry.untilNextAction?"至下一次行動開始":persistent?"觸發／耗盡後消失":Math.ceil(turns)+" 回合",kind});
        }
        const type=statusVisualTypeForEntry(entry);
        if(!type){ return null; }
        const spec=RAW_STATUS_VISUALS[type];
        const turns=Math.max(0,Number(entry&&entry.turnsLeft)||0);
        const oneShot=!!(entry&&entry.oneShot)||turns>9999;
        return Object.freeze({
            type:type,
            name:spec.label||spec.statusName||type,
            iconSrc:spec.iconSrc||spec.src||"",
            effect:statusEffectText(type,entry),
            turnsLeft:oneShot?null:Math.ceil(turns),
            remainingText:oneShot?"觸發後消失":Math.ceil(turns)+" 回合",
            kind:kind
        });
    }

    function authoritativeStatusBuffs(entity){
        if(!entity){ return []; }
        const entries=[];
        if(Array.isArray(entity.v141TeamBuffs)){ entries.push(...entity.v141TeamBuffs); }
        ["v155WindDodge","v155EvasionBlessing"].forEach(key=>{
            const state=entity[key];
            if(state&&Number(state.turnsLeft)>0){ entries.push(state); }
        });
        return entries;
    }

    window.v143GetBattleStatusSummary=function(entity){
        const buffs=[],debuffs=[],seen=new Set();
        function collect(list,kind){
            if(!Array.isArray(list)){ return; }
            list.forEach(entry=>{
                if(!entry||Number(entry.turnsLeft)<=0){ return; }
                const item=normalizedStatusEntry(entry,kind);
                if(!item){ return; }
                const key=kind+":"+item.type+":"+item.name;
                if(seen.has(key)){ return; }
                seen.add(key);
                (kind==="buff"?buffs:debuffs).push(item);
            });
        }
        /* Gameplay state is authoritative. Display-only activeBuffs are collected
           only after real sidecars/team buffs and are de-duplicated by status ID. */
        collect(authoritativeStatusBuffs(entity),"buff");
        collect(entity&&entity.activeBuffs,"buff");
        collect(entity&&entity.statusEffects,"debuff");
        if(entity&&entity.v141Shield&&Number(entity.v141Shield.turnsLeft)>0){
            const type=entity.v141Shield.isBarrier?"barrier":"shield";
            const item=normalizedStatusEntry(Object.assign({type:type},entity.v141Shield),"buff");
            if(item&&!seen.has("buff:"+item.type+":"+item.name)){ buffs.push(item); }
        }
        return Object.freeze({buffs:Object.freeze(buffs),debuffs:Object.freeze(debuffs)});
    };

    function syncAppliedStatusVisual(entity,type){
        if(!entity){ return; }
        let side=null,index=-1;
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            index=monsters.indexOf(entity);
            if(index>=0){ side="monster"; }
        }
        if(!side&&typeof getPartyCharacterByIndex==="function"){
            for(let partyIndex=0;partyIndex<6;partyIndex++){
                if(getPartyCharacterByIndex(partyIndex)===entity){ side="player"; index=partyIndex; break; }
            }
        }
        if(!side||index<0){ return; }
        const current=state.current;
        if(current&&!current.done&&current.targetSide===side){
            const types=Array.isArray(current.model.deferredStatusTypes)?current.model.deferredStatusTypes:[];
            const automatic=current.hitFeedback?.config.enabled&&current.targetIndexes.includes(index)&&
                (current.config.id===type||current.hitFeedback.config.profile.states.includes(type));
            if(types.indexOf(type)>=0||automatic){
                if(current.hitFeedback?.config.enabled){
                    const entry=[...(entity.statusEffects||[]),...(entity.activeBuffs||[])].filter(e=>Number(e.turnsLeft)>0&&
                        (e.type===type||statusVisualTypeForEntry(e)===type)).slice(-1)[0];
                    window.FourSymbolsHitFeedback.markStatus(entry);
                }
                registerTarget(side,index,false);
                confirmTargetVisual(current,index);
                let tracked=current.deferredStatusTargets.get(type);
                if(!tracked){ tracked=new Set(); current.deferredStatusTargets.set(type,tracked); }
                tracked.add(index);
                syncStatusVisualsForUnit(side,index,false);
                return;
            }
        }
        const wait=existingTargetDelay(side,index);
        const invoke=()=>syncStatusVisualsForUnit(side,index,false);
        if(!queueTargetHit(current,index,invoke,"projection",side)){
            if(wait>8){ setTimer(invoke,wait); } else{ invoke(); }
        }
    }

    if(typeof applyBurnEffect==="function"){
        const previous=applyBurnEffect;
        applyBurnEffect=function(entity){
            const result=previous.apply(this,arguments);
            if(result!==false){ syncAppliedStatusVisual(entity,"burn"); }
            return result;
        };
    }
    if(typeof applyFreezeEffect==="function"){
        const previous=applyFreezeEffect;
        applyFreezeEffect=function(entity){
            const result=previous.apply(this,arguments);
            if(result!==false){ syncAppliedStatusVisual(entity,"freeze"); }
            return result;
        };
    }
    if(typeof applyMonsterDebuff==="function"){
        const previous=applyMonsterDebuff;
        applyMonsterDebuff=function(entity,type){
            const result=previous.apply(this,arguments);
            if(result!==false&&STATUS_VISUALS[type]){ syncAppliedStatusVisual(entity,type); }
            return result;
        };
    }

    function appendSpriteNode(current){
        const feedback=current.hitFeedback?.config.enabled?current.hitFeedback:null;
        const node=feedback?window.FourSymbolsHitFeedback.acquire("sprite"):document.createElement("i");
        node.className="v143-vfx-sprite";
        node.dataset.skill=current.config.id||"unknown";
        node.dataset.targetSide=current.targetSide;
        node.dataset.renderer="dom-sprite";
        node.dataset.confirmedHit="false";
        node.dataset.geometryOwner="fixed-slot";
        node.style.visibility="hidden";
        if(feedback){
            node.style.zIndex="1";
            node.style.mixBlendMode=feedback.config.blendMode;
            node.style.filter="brightness("+feedback.config.glowBrightness+")"+
                (window.FourSymbolsHitFeedback.config.performance?.spriteShadow===true?" drop-shadow(0 0 "+feedback.config.glowPx+"px "+feedback.config.colors[0]+")":"");
        }
        state.stage.appendChild(node);
        return node;
    }

    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

    function frameAspectFor(sprite){
        const key=String(sprite&&sprite.src||"");
        const cached=key?spriteFrameAspectCache.get(key):null;
        return Math.max(.1,Number(cached)||Number(sprite&&sprite.cellAspect)||1);
    }

    function applySpriteBox(node,width,height,sprite,fit){
        const placementScale=PLACEMENT_SIZE_SCALE[node.dataset.placement]||1;
        const boxWidth=Math.max(1,Number(width)||1)*SPRITE_SCALE_MULTIPLIER*placementScale;
        const boxHeight=Math.max(1,Number(height)||1)*SPRITE_SCALE_MULTIPLIER*placementScale;
        const aspect=frameAspectFor(sprite);
        let renderWidth=boxWidth,renderHeight=boxHeight;
        if(fit==="cover"){
            if(renderWidth/renderHeight>aspect){ renderHeight=renderWidth/aspect; }
            else{ renderWidth=renderHeight*aspect; }
        }else if(renderWidth/renderHeight>aspect){ renderWidth=renderHeight*aspect; }
        else{ renderHeight=renderWidth/aspect; }
        node.style.width=Math.round(renderWidth)+"px";
        node.style.height=Math.round(renderHeight)+"px";
        node.dataset.frameAspect=String(Number(aspect.toFixed(4)));
        node.dataset.frameFit=fit==="stretch"?"stretch":fit==="cover"?"cover":"contain";
    }

    function requestSpriteAspect(sprite,current,node,index,target){
        const key=String(sprite&&sprite.src||"");
        if(!key||spriteFrameAspectCache.has(key)||spriteFrameAspectLoading.has(key)){ return; }
        const ImageCtor=typeof window!=="undefined"&&typeof window.Image==="function"?window.Image:(typeof Image==="function"?Image:null);
        if(!ImageCtor){ return; }
        spriteFrameAspectLoading.add(key);
        const image=new ImageCtor();
        image.onload=function(){
            spriteFrameAspectLoading.delete(key);
            const columns=Math.max(1,Number(sprite.columns)||1);
            const rows=Math.max(1,Number(sprite.rows)||1);
            const cellWidth=Number(image.naturalWidth||image.width||0)/columns;
            const cellHeight=Number(image.naturalHeight||image.height||0)/rows;
            if(cellWidth>0&&cellHeight>0){ spriteFrameAspectCache.set(key,cellWidth/cellHeight); }
            if(state.current===current&&!current.done){ placeSprite(current,node,index,target); }
        };
        image.onerror=function(){ spriteFrameAspectLoading.delete(key); };
        image.src=key;
    }

    function fitRangeArt(node,current,bounds,center){
        const overlay=window.FourSymbolsBattlefieldRenderGeometry?.getBattlefieldOverlayGeometry?.()?.rect;
        const side=geometryOwner()?.getSideRect?.(current.targetSide);
        if(!overlay||!side){ return; }
        const left=Math.max(overlay.left,side.left),right=Math.min(overlay.right,side.right);
        const top=Math.max(overlay.top,side.top),bottom=Math.min(overlay.bottom,side.bottom);
        const width=parseFloat(node.style.width),height=parseFloat(node.style.height);
        const availableWidth=2*Math.min(center.x-left,right-center.x);
        const availableHeight=2*Math.min(center.y-top,bottom-center.y);
        if(!(width>0&&height>0&&availableWidth>0&&availableHeight>0)){
            node.dataset.artFit="unavailable";
            node.style.visibility="hidden";
            return;
        }
        // The reused wide sheet is clipped to its central authored strike per recipient.
        // Fit its visible third, not the transparent/clipped neighbor regions.
        const visibleWidth=current.model.sprite.recipientSlice==="center-third"?width/3:width;
        const fit=Math.min(1,availableWidth/visibleWidth,availableHeight/height);
        node.style.width=(width*fit)+"px";
        node.style.height=(height*fit)+"px";
        node.dataset.artFit="safe";
        node.dataset.artFitScale=String(fit);
        node.dataset.semanticWidth=String(bounds.width);
        node.dataset.semanticHeight=String(bounds.height);
    }

    function emittedSpriteTargets(current){
        return current.targetIndexes.filter(index=>
            current.emitted.has(index)&&current.validTargets.has(index)&&
            canReceive(current.config,current.targetSide,index)&&!!cardFor(current.targetSide,index)
        );
    }

    function authoredSquareSize(sprite,geometry,defaults){
        const base=Math.max(1,Math.max(Number(geometry&&geometry.width)||0,Number(geometry&&geometry.height)||0));
        const scale=Number(sprite.scale)||defaults.scale;
        const configuredMin=Number(sprite.minSize)||defaults.min;
        const configuredMax=Number(sprite.maxSize)||defaults.max;
        const minSize=Math.min(configuredMin,base*defaults.minRatio);
        const maxSize=Math.max(minSize,Math.min(configuredMax,base*defaults.maxRatio));
        return clamp(base*scale,minSize,maxSize);
    }

    function placePhasedMotion(current,node,sprite,dx,dy,angle){
        const phases=sprite.motionPhases;
        const preserveSourceOrientation=!!sprite.preserveSourceOrientation;
        const start=phases.flightStart/sprite.frames;
        const turn=phases.turnFrame/sprite.frames;
        const impact=phases.impactStart/sprite.frames;
        const transform=(progress,rotation)=>"translate(calc(-50% + "+dx*progress+"px),calc(-50% + "+dy*progress+"px)) rotate("+rotation+"deg)";
        const turnProgress=(turn-start)/(impact-start);
        const frames=[
            {offset:0,transform:transform(0,0)},
            {offset:start,transform:transform(0,0)},
            {offset:start,transform:transform(0,preserveSourceOrientation?0:angle-phases.flightSourceAngle)},
            {offset:turn,transform:transform(turnProgress,preserveSourceOrientation?0:angle-phases.flightSourceAngle)},
            {offset:turn,transform:transform(turnProgress,preserveSourceOrientation?0:angle-phases.turnSourceAngle)},
            {offset:impact,transform:transform(1,preserveSourceOrientation?0:angle-phases.turnSourceAngle)},
            {offset:impact,transform:transform(1,0)},
            {offset:1,transform:transform(1,0)}
        ];
        node.dataset.motion="phased";
        // Re-measuring decoded aspect must not restart flight or Frame 1.
        const elapsed=node.v143MotionAnimation?node.v143MotionAnimation.currentTime:Math.max(0,Date.now()-current.visualStartedAt);
        if(node.v143MotionAnimation){ node.v143MotionAnimation.cancel(); }
        node.v143MotionAnimation=node.animate(frames,{duration:current.duration,fill:"both",easing:"linear"});
        node.v143MotionAnimation.currentTime=elapsed;
    }

    function placeSprite(current,node,index,target){
        const sprite=current.model.sprite;
        const placement=placementFor(current.config,sprite,current.targetType);
        node.dataset.placement=placement;

        if(placement==="single"){
            const portrait=sprite.presentation==="per-recipient"
                ?window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(current.targetSide,index)?.artworkProjection?.rect:null;
            const hasPortrait=portrait&&Number(portrait.width)>0&&Number(portrait.height)>0;
            const center=hasPortrait?{x:portrait.left+portrait.width/2,y:portrait.top+portrait.height/2}:target;
            const body=hasPortrait?Math.min(portrait.width,portrait.height):0;
            const size=authoredSquareSize(sprite,hasPortrait?{width:body,height:body}:target.rect,{scale:1.8,min:96,max:184,minRatio:1.18,maxRatio:1.68});
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.geometrySlot=target.slot;
            node.style.left=center.x+"px";
            node.style.top=center.y+"px";
            const sliced=sprite.recipientSlice==="center-third";
            applySpriteBox(node,sliced?size*3:size,sliced?size*3:size,sprite);
            if(sliced){ node.style.clipPath="inset(0 33.333333%)";node.dataset.recipientSlice="center-third"; }
            fitRangeArt(node,current,target.rect,center);
            return;
        }

        if(placement==="targetTrajectory"){
            const actor=slotAnchor(current.side,current.actorIndex,current.actorCard);
            if(!actor){ return; }
            const size=authoredSquareSize(sprite,target.rect,{scale:1.7,min:140,max:240,minRatio:1.12,maxRatio:1.56});
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.geometrySlot=target.slot;
            if(!sprite.motionPhases){ node.dataset.travel="true"; }
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            applySpriteBox(node,size,size,sprite);
            node.style.setProperty("--v143-sprite-dx",target.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",target.y-actor.y+"px");
            const trajectoryAngle=Math.atan2(target.y-actor.y,target.x-actor.x)*180/Math.PI;
            node.style.setProperty("--v143-sprite-angle",(sprite.preserveSourceOrientation?0:trajectoryAngle)+"deg");
            if(sprite.motionPhases){ placePhasedMotion(current,node,sprite,target.x-actor.x,target.y-actor.y,trajectoryAngle); }
            return;
        }

        const indexes=emittedSpriteTargets(current);
        const bounds=geometryBounds(current,indexes,placement);
        if(!bounds){ return; }
        const primaryAnchor=geometryPrimaryAnchor(current,indexes);
        node.dataset.geometrySlots=Array.isArray(bounds.slots)?bounds.slots.join(","):"";

        if(placement==="battlefield"){
            /* coverageScale is an authored multiplier over the complete fixed
               battlefield zone. It never measures currently surviving targets. */
            const coverageScale=clamp(Number(sprite.coverageScale)||Number(sprite.scale)||1,1,1.4);
            const width=Math.max(1,Math.round(bounds.width));
            const height=Math.max(1,Math.round(bounds.height));
            node.dataset.areaId=bounds.id||"fixed-battlefield";
            node.dataset.targetIndexes=indexes.join(",");
            if(sprite.fixedFormation){ node.dataset.fixedFormation="true"; }
            node.dataset.coverageScale=String(coverageScale);
            node.style.clipPath="none";
            node.style.left=bounds.centerX+"px";
            node.style.top=bounds.centerY+"px";
            /* Range effects fill the complete fixed-side rectangle but never
               extend into the independent operation track. The whole source
               frame remains visible; no card or Zone is a paint clip owner. */
            applySpriteBox(node,width,height,sprite,"cover");
            fitRangeArt(node,current,bounds,{x:bounds.centerX,y:bounds.centerY});
            return;
        }

        /* Group/row/tri/trajectory size is derived from the fixed geometry shape,
           never from the number or outer bounds of surviving target cards. */
        const width=Math.max(1,Math.round(bounds.width));
        const height=Math.max(1,Math.round(bounds.height));
        node.dataset.targetIndexes=indexes.join(",");
        applySpriteBox(node,width,height,sprite,"cover");
        /* Authored multi-target art spans the canonical shape, including when
           the selected primary is its edge slot. Hit callbacks retain the
           primary/individual target anchors; projectiles still fly to primary. */
        const destination=(placement==="group"||bounds.centerOnBounds)&&placement!=="trajectory"
            ?{x:bounds.centerX,y:bounds.centerY}
            :primaryAnchor
            ?{x:primaryAnchor.x,y:primaryAnchor.y}
            :{x:bounds.centerX,y:bounds.centerY};
        fitRangeArt(node,current,bounds,destination);
        if(primaryAnchor){ node.dataset.geometrySlot=primaryAnchor.slot; }
        const actor=placement==="trajectory"?slotAnchor(current.side,current.actorIndex,current.actorCard):null;
        if(placement==="trajectory"&&sprite.travelToTargets&&actor){
            node.dataset.travel="true";
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            node.style.setProperty("--v143-sprite-dx",destination.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",destination.y-actor.y+"px");
            node.style.setProperty("--v143-sprite-angle",Math.atan2(destination.y-actor.y,destination.x-actor.x)*180/Math.PI+"deg");
        }else{
            node.style.left=destination.x+"px";
            node.style.top=destination.y+"px";
        }
    }

    function addNormalProjectile(current,index,target){
        const projectile=current.model.projectile;
        if(current.config.id!=="normal"||!projectile||current.spriteNodes.has("air:"+index)){ return; }
        const actor=slotAnchor(current.side,current.actorIndex,current.actorCard);
        if(!actor){ return; }
        const node=appendSpriteNode(current);
        const size=clamp(Math.min(target.rect.width,target.rect.height)*.6,projectile.minSize,projectile.maxSize);
        const dx=target.x-actor.x,dy=target.y-actor.y;
        const angle=Math.atan2(dy,dx)*180/Math.PI;
        const transform=progress=>"translate(calc(-50% + "+dx*progress+"px),calc(-50% + "+dy*progress+"px)) rotate("+angle+"deg)";
        node.dataset.presentationRole="normal-projectile";
        node.dataset.actorSide=current.side;
        node.dataset.actorIndex=String(current.actorIndex);
        node.dataset.targetIndex=String(index);
        node.dataset.targetIndexes=String(index);
        node.style.left=actor.x+"px";
        node.style.top=actor.y+"px";
        node.style.width=size+"px";
        node.style.height=size+"px";
        node.style.backgroundImage='url("'+projectile.src+'")';
        node.style.backgroundSize="contain";
        node.style.backgroundPosition="center";
        node.setAttribute("aria-hidden","true");
        // The existing impact clock owns both this attempted flight and feedback.
        // A MISS still travels, but never reveals the confirmed impact sprite.
        node.v143MotionAnimation=node.animate([
            {offset:0,opacity:0,transform:transform(0)},
            {offset:.30,opacity:0,transform:transform(0)},
            {offset:.36,opacity:.85,transform:transform(.08)},
            {offset:.90,opacity:.85,transform:transform(.90)},
            {offset:1,opacity:0,transform:transform(1)}
        ],{duration:Math.max(1,targetHitTime(current,index)-(current.visualStartedAt||current.startedAt)),fill:"both",easing:"linear"});
        node.v143MotionAnimation.pause();
        node.v143MotionAnimation.currentTime=0;
        current.spriteNodes.set("air:"+index,node);
        if(current.firstVisibleFrameAt){ startNormalProjectiles(current); }
    }

    function addSprite(current,index,target){
        const sprite=current.model.sprite;
        if(!sprite||!target||!state.stage){ return; }
        const placement=placementFor(current.config,sprite,current.targetType);
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        let node=current.spriteNodes.get(key);
        if(!node){
            const initialSprite=!current.firstVisibleFrameAt;
            node=appendSpriteNode(current);
            node.dataset.columns=String(sprite.columns);
            node.dataset.rows=String(sprite.rows);
            node.dataset.frames=String(sprite.frames);
            node.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
            node.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
            node.style.setProperty("--v143-sprite-duration",current.duration+"ms");
            /* An ordinary cast starts at Frame 1; impact-only clips hold their
               registered impact frame while hidden. A later sprite
               for a separately delayed target may catch up to the visual
               timeline, but it must never rewrite the initial cast. */
            node.dataset.emission=initialSprite?"initial":"late";
            node.style.setProperty("--v143-sprite-delay",initialSprite
                ?"0ms"
                :-Math.min(current.duration,Math.max(0,Date.now()-(current.visualStartedAt||current.startedAt)))+"ms"
            );
            if(sprite.impactOnly){
                /* Hold the impact frame while hidden. DOM setup latency must not
                   leave transparent travel frames after the formal hit task. */
                node.style.setProperty("--v143-sprite-delay",-(current.duration*sprite.hitFrame/sprite.frames)+"ms");
                node.style.animationPlayState="paused";
            }
            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
            if(current.hitFeedback?.config.enabled&&typeof node.animate==="function"){
                node.style.setProperty("--v143-frame-animation","none");
                // Discrete frame selection translates a full sheet behind one
                // clipped viewport. No animated background-position/filter.
                const sheet=window.FourSymbolsHitFeedback.acquire("sheet");node.v143SheetNode=sheet;
                Object.assign(sheet.style,{position:"absolute",left:"0",top:"0",width:(sprite.columns*100)+"%",height:(sprite.rows*100)+"%",
                    backgroundImage:node.style.backgroundImage,backgroundSize:"100% 100%",backgroundRepeat:"no-repeat",pointerEvents:"none"});
                node.style.backgroundImage="none";node.style.overflow="hidden";node.appendChild(sheet);
                const hitRatio=(targetHitTime(current,index)-(current.visualStartedAt||current.startedAt))/current.duration;
                const timing=current.hitFeedback.config,rank=current.hitRanks?.get(index)||0;
                const dwell=timing.sweepEnabled?{...timing,hitFrameMultiplier:timing.hitFrameMultiplier*timing.hitStrength[Math.min(rank,2)]}:timing;
                node.v143FrameAnimation=sheet.animate(window.FourSymbolsHitFeedback.frameTrack(sprite,dwell,hitRatio),
                    {duration:current.duration,fill:"both",easing:"linear"});
            }
            current.spriteNodes.set(key,node);
        }
        placeSprite(current,node,index,target);
        // One range representative: contract inside the fitted source box,
        // reach authored size at the existing hit, then settle. Never grow
        // beyond the geometry owner's HUD-safe fit or restart on remeasure.
        if(current.config?.id==="explosiveFlurry"&&typeof node.animate==="function"&&!node.v143MotionAnimation&&
           !(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)){
            node.dataset.motion="fire-range-envelope";
            node.v143MotionAnimation=node.animate([
                {transform:"translate(-50%,-50%) scale(.90)",offset:0},
                {transform:"translate(-50%,-50%) scale(.94)",offset:.25},
                {transform:"translate(-50%,-50%) scale(1)",offset:Number(current.model.hit)||DEFAULT_HIT},
                {transform:"translate(-50%,-50%) scale(.98)",offset:1}
            ],{duration:current.duration,fill:"both",easing:"linear"});
            if(current.firstVisibleFrameAt){ node.v143MotionAnimation.currentTime=Math.max(0,Date.now()-current.visualStartedAt); }
        }
        requestSpriteAspect(sprite,current,node,index,target);
        if(current.config?.id==="normal"){ addNormalProjectile(current,index,target); }
        /* A formal cast Sprite represents the attempted skill, not only a landed hit.
           Reveal it as soon as the official owner has a real fixed-slot position.
           Outcome confirmation still marks the node and controls hit feedback, but
           MISS/status/custom Boss paths must not make the cast animation disappear. */
        if(node.style.left&&node.style.top){
            node.style.visibility=sprite.impactOnly||node.dataset.artFit==="unavailable"?"hidden":"visible";
            node.dataset.emittedVisual="true";
        }
        if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }
        /* Start the new impact-only lifetime after positioning, so slow DOM
           setup cannot expire the hit/recoil before its first painted frame. */
        if(sprite.impactOnly&&!current.firstVisibleFrameAt){ requestImpactTimeline(current); }
    }

    function queueTargetHit(current,index,callback,phase,side){
        if(!current||!current.model||!current.model.sprite){ return false; }
        if(side&&current.targetSide!==side){ return false; }
        if(!current.model.sprite.impactOnly&&!current.emitted?.has(index)){ return false; }
        if(current.done){ return true; }
        if(current.settledTargets?current.settledTargets.has(index):current.hitReached){ callback(); return true; }
        if(!current.hitCallbacks){ current.hitCallbacks=new Map(); }
        const callbacks=current.hitCallbacks.get(index)||[];
        callbacks.push({callback:callback,phase:phase||"feedback"});
        current.hitCallbacks.set(index,callbacks);
        return true;
    }

    function startNormalProjectiles(current){
        if(current.config.id==="normal"&&current.characterMotion&&!current.normalMotionStarted){
            current.normalMotionStarted=true;
            current.characterMotion.play();
            current.characterMotion.currentTime=Math.max(0,Date.now()-current.visualStartedAt);
        }
        current.spriteNodes.forEach(node=>{
            if(node.dataset?.presentationRole!=="normal-projectile"||node.dataset.flightStarted==="true"){ return; }
            node.dataset.flightStarted="true";
            node.style.visibility="visible";
            const animation=node.v143MotionAnimation;
            animation.play();
            animation.currentTime=Math.max(0,Date.now()-current.visualStartedAt);
        });
    }

    function requestCastTimeline(current){
        if(current.castTimelineRequested){ return; }
        current.castTimelineRequested=true;
        if(current.gate){ current.gate.visualTimelinePending=true; }
        const start=function(frameTime){
            if(state.current!==current||current.done){ return; }
            // Force CSS animation creation after the complete settlement/DOM
            // task, then align every raster and travel track to one paint clock.
            const tracks=[];
            current.spriteNodes.forEach(node=>{
                try{
                    const animations=typeof node.getAnimations==="function"?node.getAnimations():[];
                    animations.forEach(animation=>{ if(String(animation.animationName||"").startsWith("v143Raster")){ tracks.push(animation); } });
                    if(node.v143MotionAnimation){ tracks.push(node.v143MotionAnimation); }
                    if(node.v143FrameAnimation){ tracks.push(node.v143FrameAnimation); }
                }catch(_){ state.metrics.clockAlignmentFailures=(state.metrics.clockAlignmentFailures||0)+1; }
            });
            // performance.now and the default DocumentTimeline share a time
            // origin. Read after style creation, not the stale RAF frame stamp.
            const clockTime=Number.isFinite(frameTime)&&typeof performance!=="undefined"&&typeof performance.now==="function"
                ?performance.now():frameTime;
            tracks.forEach(animation=>{
                try{ if(Number.isFinite(clockTime)){ animation.startTime=clockTime; } }
                catch(_){ state.metrics.clockAlignmentFailures=(state.metrics.clockAlignmentFailures||0)+1; }
            });
            current.animationStartTimeline=Number.isFinite(clockTime)?clockTime:null;
            beginVisualTimeline(current);
            tracks.forEach(animation=>{ if(current.hitFeedback?.config.enabled){ animation.hitFeedbackDeadline=current.visualStartedAt+current.duration; } });
            current.targetIndexes.forEach(index=>setTimer(
                ()=>{
                    // A timer may run in the same render cycle as its RAF.
                    // A bounded two-frame fence crosses that cycle before hit;
                    // it never samples or renders an ongoing animation loop.
                    const presentHit=()=>settleTargetVisual(current,index);
                    if(typeof requestAnimationFrame==="function"){
                        requestAnimationFrame(()=>requestAnimationFrame(presentHit));
                    }
                    else{ presentHit(); }
                },Math.max(0,targetHitTime(current,index)-Date.now())
            ));
        };
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(start); }
        else{ start(); }
    }

    function requestImpactTimeline(current){
        if(current.timelineRequested){ return; }
        current.timelineRequested=true;
        if(current.gate){ current.gate.visualTimelinePending=true; }
        /* Finish the synchronous settlement/DOM task before arming the same
           authored clock. An expired pre-render safety timer cannot win over hit. */
        const start=function(){
            if(state.current!==current||current.done){ return; }
            beginVisualTimeline(current);
            startNormalProjectiles(current);
            current.targetIndexes.forEach(index=>setTimer(
                ()=>settleTargetVisual(current,index),Math.max(0,targetHitTime(current,index)-Date.now())
            ));
        };
        if(typeof queueMicrotask==="function"){ queueMicrotask(start); }
        else{ Promise.resolve().then(start); }
    }

    function confirmTargetVisual(current,index){
        if(!current||current.done||!current.model||!current.model.sprite){ return; }
        current.confirmedTargets.add(index);
        const placement=placementFor(current.config,current.model.sprite);
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        const node=current.spriteNodes.get(key);
        if(node){
            node.dataset.confirmedHit="true";
            if(!current.model.sprite.impactOnly||current.hitReached){
                node.style.visibility="visible";
                if(current.model.sprite.impactOnly){ node.style.animationPlayState="running"; }
            }
        }
    }

    function targetHitTime(current,index){
        const visualStartedAt=current.visualStartedAt||current.startedAt;
        const stagger=current.hitFeedback?.config.enabled&&current.hitFeedback.config.sweepEnabled
            ?(current.hitRanks?.get(index)||0)*current.hitFeedback.config.sweepGapMs:0;
        return Math.min(
            visualStartedAt+current.duration-120,
            visualStartedAt+current.duration*(Number(current.model.hit)||DEFAULT_HIT)+stagger
        );
    }

    function beginVisualTimeline(current){
        if(!current||current.firstVisibleFrameAt){ return false; }
        current.firstVisibleFrameAt=Date.now();
        current.visualStartedAt=current.firstVisibleFrameAt;
        if(current.gate){ current.gate.visualTimelinePending=false; }
        if(current.gate&&typeof current.gate.restartVisualTimeline==="function"){
            current.gate.restartVisualTimeline(current.duration);
        }
        if(current.hitFeedback?.config.sweepEnabled){
            const rects=current.targetIndexes.map(index=>window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(current.targetSide,index)?.artworkProjection?.rect).filter(Boolean);
            current.hitFeedback.wind(state.stage,rects,current.visualStartedAt+current.duration);
        }
        current.cleanupTimer=setTimer(
            ()=>cleanupCurrent(current,"v143-raster-complete"),
            current.duration
        );
        return true;
    }

    function settleTargetVisual(current,index){
        if(state.current!==current||current.done){ return; }
        if(current.settledTargets?.has(index)){ return; }
        current.settledTargets?.add(index);
        const card=cardFor(current.targetSide,index);
        if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
        current.hitReached=true;
        const projectile=current.spriteNodes.get("air:"+index);
        if(projectile){ projectile.style.visibility="hidden"; }
        const callbacks=current.hitCallbacks&&current.hitCallbacks.get(index)||[];
        if(current.hitCallbacks){ current.hitCallbacks.delete(index); }
        callbacks.filter(entry=>entry.phase==="projection").forEach(entry=>entry.callback());
        syncStatusVisualsForUnit(current.targetSide,index);
        const successfulStatus=current.hitFeedback?.config.sweepEnabled&&
            !["heal","buff","shield"].includes(current.hitFeedback.config.profile?.kind)&&
            Array.from(current.deferredStatusTargets).find(([type,targets])=>targets.has(index)&&hasTimedEffect(entityFor(current.targetSide,index),type));
        if(successfulStatus){
            const rect=window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(current.targetSide,index)?.artworkProjection?.rect;
            const ring=current.hitFeedback.weaken(state.stage,rect,current.visualStartedAt+current.duration);
            if(ring){ring.node.dataset.targetIndex=String(index);ring.node.dataset.targetSide=current.targetSide;ring.node.dataset.statusType=successfulStatus[0];}
        }
        if(current.model.sprite&&current.model.sprite.impactOnly&&current.confirmedTargets.has(index)){
            const node=current.spriteNodes.get(String(index));
            if(node){ node.style.visibility="visible"; node.style.animationPlayState="running"; }
        }
        window.FourSymbolsBattlePresentation?.syncHud?.();
        callbacks.filter(entry=>entry.phase!=="projection").forEach(entry=>entry.callback());
        const feedback=current.hitFeedback,profile=feedback?.config.profile;
        if(feedback?.config.enabled&&["heal","buff","shield"].includes(profile?.kind)){
            const entity=entityFor(current.targetSide,index),before=current.supportBefore?.get(index);
            const healed=before?.entity===entity&&(Number(entity?.hp)>before.hp||Number(entity?.sp)>before.sp);
            // The existing named-buff Owner appends a new entry only after
            // canApplyNamedPersistentState succeeds (including same-value refresh).
            // Observe that exact expected entry; unrelated state changes are not proof.
            const expected=new Set([current.config.id,...(current.model.deferredStatusTypes||[]),...profile.states]);
            const newBuff=before?.entity===entity&&(entity?.activeBuffs||[]).find(entry=>
                Number(entry.turnsLeft)>0&&expected.has(entry.type)&&!before.entries.has(entry));
            if(newBuff){
                let targets=current.deferredStatusTargets.get(newBuff.type);
                if(!targets){targets=new Set();current.deferredStatusTargets.set(newBuff.type,targets);}
                targets.add(index);window.FourSymbolsHitFeedback.markStatus(newBuff);
                syncStatusVisualsForUnit(current.targetSide,index);
            }
            const applied=before?.entity===entity&&Array.from(current.deferredStatusTargets).some(([type,targets])=>
                targets.has(index)&&hasTimedEffect(entity,type));
            if(profile.kind==="heal"?healed:applied){
                const rect=window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(current.targetSide,index)?.artworkProjection?.rect;
                feedback.support(state.stage,rect,profile.kind,current.visualStartedAt+current.duration);
            }
        }
        current.presentationReadyAt=Date.now();
    }

    function emitSprite(current,index,allowDefeated){
        if(!state.stage||current.emitted.has(index)||!current.validTargets.has(index)){ return; }
        if(current.recipientTargets&&!current.recipientTargets.has(index)){ return; }
        if(!allowDefeated&&!canReceive(current.config,current.targetSide,index)){ return; }
        const targetCard=cardFor(current.targetSide,index);
        const target=slotAnchor(current.targetSide,index,targetCard);
        if(!target){ return; }
        captureImpactTarget(current,current.targetSide,index);
        current.emitted.add(index);
        if(current.targetIndexes.indexOf(index)<0){ current.targetIndexes.push(index); }
        if(targetCard&&targetCard.classList){ targetCard.classList.add("v143-effects-pending"); }
        if(current.model.sprite){ addSprite(current,index,target); }
        if(!current.model.sprite||current.firstVisibleFrameAt){
            setTimer(()=>settleTargetVisual(current,index),Math.max(0,targetHitTime(current,index)-Date.now()));
        }
    }

    function registerTarget(targetSide,index,allowDefeated){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide){ return null; }
        if(current.recipientTargets&&!current.recipientTargets.has(index)){ return null; }
        const single=String(current.targetType||current.config.targetType||"")==="single";
        if(single&&current.targetIndexes.length&&current.targetIndexes.indexOf(index)<0){ return null; }
        if(!current.validTargets.has(index)){ current.validTargets.add(index); }
        emitSprite(current,index,allowDefeated===true);
        return current.emitted.has(index)?current:null;
    }

    function cleanupCurrent(current,reason){
        if(!current||current.done){ return; }
        if(current.model&&current.model.sprite&&current.model.sprite.impactOnly&&current.presentationReadyAt&&
           reason!=="dispose"&&reason!=="superseded"&&reason!=="v143-render-error"){
            const remaining=140-(Date.now()-current.presentationReadyAt);
            if(remaining>0){
                if(current.cleanupTimer){ clearTimeout(current.cleanupTimer); }
                current.cleanupTimer=setTimer(()=>cleanupCurrent(current,reason),remaining);
                return;
            }
        }
        current.done=true;
        current.hitFeedback?.dispose();
        current.pendingUpdateKeys?.forEach(key=>state.pendingUpdates?.delete(key));
        if(current.hitCallbacks){ current.hitCallbacks.clear(); }
        window.FourSymbolsBattlePresentation?.endCast?.(current.actorCard,current.characterMotion);
        current.spriteNodes.forEach(node=>{ if(node.v143MotionAnimation){ node.v143MotionAnimation.cancel(); } });
        if(current.hitFeedback?.pooling){
            current.spriteNodes.forEach(node=>window.FourSymbolsHitFeedback.release("sprite",node,current.hitFeedback.config.poolLimit));
            current.spriteNodes.clear();
        }
        current.targetIndexes.forEach(index=>{
            const card=cardFor(current.targetSide,index);
            if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
            const artwork=card&&card.querySelector(".v174-battle-art");
            if(artwork&&(reason==="dispose"||reason==="superseded"||reason==="v143-render-error")){
                const flash=state.impactFlashes.get(artwork);
                if(flash){ flash.cancel(); state.impactFlashes.delete(artwork); }
            }
            if(artwork&&artwork.v143ImpactRecoil){
                artwork.v143ImpactRecoil.cancel();
                artwork.v143ImpactRecoil=null;
                artwork.v174FireDodge=false;
                window.FourSymbolsBattlePresentation?.syncMotion?.(card);
            }
        });
        if(state.stage&&state.stage.dataset.sequence===String(current.sequence)&&typeof state.stage.remove==="function"){
            state.stage.remove();
        }
        if(state.current===current){ state.current=null; state.stage=null; }
        syncStatusVisualEffects();
        window.FourSymbolsBattlePresentation?.syncHud?.();
        state.metrics.completed++;
        if(current.gate&&!current.gate.done){ current.gate.complete(reason||"v143-raster-complete"); }
    }

    let sequence=0;
    function modelFor(config){
        const model=MANIFEST[config.id];
        if(model){ return model; }
        state.metrics.missingVisuals++;
        return {hit:DEFAULT_HIT,noVisual:true,missingAsset:true,signature:"missing-"+String(config.id||"unknown")};
    }

    function render(config,meta,gate){
        if(typeof document==="undefined"||!document.body){
            setTimer(()=>gate.complete("v143-headless"),config.resolveDuration||config.duration);
            return null;
        }
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"superseded"); }
        clearImpactOverlays();
        purgeLegacyCardVfx();
        purgeStaleRasterStages();
        window.FourSymbolsBattlePresentation?.syncHud?.();

        const model=modelFor(config);
        const contract=meta&&meta.targetContract&&meta.targetContract.version==="battle-target-contract-v1"
            ?meta.targetContract:null;
        const contractedSide=contract?contract.targetSide:meta&&meta.targetSide;
        const targetSide=contractedSide==="player"||contractedSide==="monster"
            ?contractedSide:targetSideFor(config,meta.side||"player");
        const targetType=String(contract&&contract.targetType||config&&config.targetType||"single");
        const duration=Math.max(520,Number(config.duration)||520);
        const validTargets=new Set(activeCards(targetSide,config).map(entry=>entry.index));
        const explicitTargets=Array.isArray(meta.targetIds)
            ?meta.targetIds
            :(meta.targetId!==undefined&&meta.targetId!==null?[meta.targetId]:[]);
        explicitTargets.forEach(index=>{
            if(Number.isInteger(index)&&cardFor(targetSide,index)){
                validTargets.add(index);
            }
        });

        const current={
            sequence:++sequence,config:config,model:model,gate:gate,
            impactEpoch:state.impactEpoch,
            side:meta.side||"player",actorIndex:Number.isInteger(meta.actorIndex)?meta.actorIndex:0,
            targetId:meta.targetId!==undefined?meta.targetId:null,
            targetIds:Array.isArray(meta.targetIds)?meta.targetIds.slice():null,
            targetSide:targetSide,targetType:targetType,targetIndexes:[],emitted:new Set(),validTargets:validTargets,
            hitFeedback:window.FourSymbolsHitFeedback?.create(config.id,typeof skillDatabase!=="undefined"?skillDatabase[config.id]||config:config),
            spriteNodes:new Map(),confirmedTargets:new Set(),deferredStatusTargets:new Map(),statusAtStart:snapshotTimedEffects(model),
            actorCard:cardFor(meta.side||"player",Number.isInteger(meta.actorIndex)?meta.actorIndex:0),
            startedAt:Date.now(),visualStartedAt:0,firstVisibleFrameAt:0,
            duration:duration,hitReached:false,done:false,cleanupTimer:0
        };
        current.targetIndexes=initialTargetIndexes(config,current,targetSide);
        current.supportBefore=new Map(current.targetIndexes.map(index=>{
            const entity=entityFor(targetSide,index);
            return [index,{entity,hp:Number(entity?.hp)||0,sp:Number(entity?.sp)||0,
                entries:new Set(entity?.activeBuffs||[])
                }];
        }));
        if(current.hitFeedback?.config.enabled&&current.hitFeedback.config.sweepEnabled){
            current.settledTargets=new Set();
            const ordered=current.targetIndexes.slice().sort((a,b)=>{
                const vertical=/column/i.test(targetType);
                const x=i=>window.FourSymbolsBattlefieldRenderGeometry?.getUnitGeometry(targetSide,i)?.artworkProjection?.rect?.[vertical?"top":"left"]??slotAnchor(targetSide,i,cardFor(targetSide,i))?.[vertical?"y":"x"]??i;
                return x(a)-x(b)||a-b;
            });
            current.hitRanks=new Map(ordered.map((index,rank)=>[index,rank]));
        }
        if(model.sprite&&model.sprite.presentation==="per-recipient"){
            current.recipientTargets=new Set(current.targetIndexes);
        }

        const stage=document.createElement("div");
        stage.id="v143-skill-stage";
        stage.className="v143-skill-stage";
        stage.style.visibility="visible";
        stage.dataset.sequence=String(current.sequence);
        stage.dataset.skill=String(config.id||"unknown");
        stage.dataset.element=config.id==="normal"?"normal":String(config.element||"normal");
        stage.dataset.renderer="raster-only";
        stage.dataset.geometryOwner="fixed-slot";
        if(model.missingAsset||model.missingDedicatedAsset){ stage.dataset.missingVisual="true"; }
        document.body.appendChild(stage);

        state.stage=stage;
        state.current=current;
        current.characterMotion=window.FourSymbolsBattlePresentation?.startCast?.(current.actorCard,config,duration);
        window.FourSymbolsBattlePresentation?.syncHud?.();
        state.metrics.started++;

        if(
            (Array.isArray(model.deferredStatusTypes)&&model.deferredStatusTypes.length)||
            (Array.isArray(model.deferredActorStatusTypes)&&model.deferredActorStatusTypes.length)
        ){ syncStatusVisualEffects(); }

        if(model.noVisual||!model.sprite){
            if(!model.passive){ state.metrics.missingVisuals++; }
        }else{
            current.targetIndexes.slice().forEach(index=>emitSprite(current,index));
            if(!model.sprite.impactOnly&&current.spriteNodes.size){ requestCastTimeline(current); }
        }

        if((model.noVisual||!model.sprite)&&current.hitFeedback?.config.enabled&&!model.passive){
            current.targetIndexes.slice().forEach(index=>emitSprite(current,index));
            beginVisualTimeline(current);
        }else if(model.noVisual||!model.sprite){
            current.cleanupTimer=setTimer(()=>cleanupCurrent(current,"v143-raster-complete"),duration);
        }
        gate.promise.then(()=>{
            if(state.current===current&&!current.done){ cleanupCurrent(current,gate.reason||"gate-complete"); }
        });
        return current;
    }

    function officialPlay(config,meta){
        const safeMeta=Object.assign({},meta||{},{render:false});
        const gate=originalPlay(config,safeMeta);
        if(state.current&&state.current.gate===gate){ return gate; }
        try{
            render(config,Object.assign({side:"player",actorIndex:0},meta||{}),gate);
        }catch(error){
            state.metrics.renderErrors=(state.metrics.renderErrors||0)+1;
            if(typeof console!=="undefined"&&typeof console.error==="function"){
                console.error("V143 raster render failed; combat timing recovered.",error);
            }
            if(!gate.done){ gate.complete("v143-render-error"); }
        }
        return gate;
    }

    /* V143 is the only battle-VFX owner. Later rule/dungeon modules may read
       the director, but cannot replace its renderer or create a fallback. */
    try{
        Object.defineProperty(director,"play",{
            configurable:false,enumerable:true,
            get:function(){ return officialPlay; },
            set:function(){ blockedDirectorOverrides++; }
        });
    }catch(_){
        director.play=officialPlay;
    }

    /* Formal sheets already include projectile/travel art. Legacy projectile
       helpers are intentionally no-op once this owner is installed. */
    if(typeof playFireRocketAnimation==="function"){ playFireRocketAnimation=function(){ return; }; }
    if(typeof playIceSpinProjectile==="function"){ playIceSpinProjectile=function(){ return; }; }

    director.dispose=function(){
        clearTimers();
        window.FourSymbolsBattlePresentation?.clearHud?.();
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"dispose"); }
        window.FourSymbolsBattlePresentation?.clearMotions?.();
        if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
            document.querySelectorAll("#v143-skill-stage").forEach(node=>node.remove());
        }
        removeStatusVisualEffects();
        purgeLegacyCardVfx();
        return originalDispose();
    };

    function delayFor(targetSide,index,allowDefeated,confirmHit){
        const current=registerTarget(targetSide,index,allowDefeated);
        if(!current){ return 0; }
        if(current.config.id!=="normal"||confirmHit===true){ confirmTargetVisual(current,index); }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    function existingTargetDelay(targetSide,index){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide||!current.emitted.has(index)){ return 0; }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    window.v143RunAtTargetHit=function(targetSide,index,callback,allowDefeated){
        if(typeof callback!=="function"){ return 0; }
        const wait=delayFor(targetSide,index,allowDefeated===true);
        if(queueTargetHit(state.current,index,callback,"feedback",targetSide)){ return wait; }
        if(wait>8){ setTimer(callback,wait); }else{ callback(); }
        return wait;
    };

    /* V143 owns hit timing only. Battle Floating Feedback owns popup DOM,
       geometry, collision lanes, typography and cleanup. */
    window.v143ResolveBattleFeedbackTiming=function(targetSide,index,kind,isCritical){
        const side=targetSide==="monster"?"monster":"player";
        const unitIndex=Number(index)||0;
        const damage=kind==="damage"||kind==="criticalDamage";
        const wait=delayFor(side,unitIndex,true,damage||kind==="shield");
        const current=state.current;
        const critical=isCritical===true||kind==="criticalDamage"||damage&&!!(
            current&&!current.done&&current.config&&current.config.id==="fireCritical"&&
            current.targetSide===side
        );
        const impactEpoch=state.impactEpoch;
        const fact=window.FourSymbolsCombatEvents?.lastDamageFor?.(entityFor(side,unitIndex));
        const hit=current?.impactHits?.get(unitIndex);
        const ownedHit=hit&&hit.fact===fact&&validImpactHit(hit)&&!hit.scheduled&&!hit.presented;
        const indirectSource=["dot","relic","reflect","environment","self","hpCost"];
        const direct=current&&!current.done&&current.targetSide===side&&(current.config.id==="normal"||
            current.config.category==="physical"||current.config.category==="magic")&&
            (current.impactEpoch===undefined||current.impactEpoch===impactEpoch)&&
            (!fact||fact.damageKind==="direct"&&!indirectSource.includes(fact.sourceType))&&
            !indirectSource.includes(window.__fourSymbolsBattleEffectSource);
        if(damage&&direct&&ownedHit){ hit.scheduled=true; }
        const entity=entityFor(side,unitIndex);
        const fireSample=current&&!current.done&&current.config.id==="explosiveFlurry"&&current.targetSide===side;
        if(fireSample&&kind==="miss")queueTargetHit(current,unitIndex,()=>{
            window.FourSymbolsBattlePresentation?.fireDodge?.(cardFor(side,unitIndex));
        },"feedback",side);
        const artworkAtSchedule=ownedHit?hit.artwork:cardFor(side,unitIndex)?.querySelector(".v174-battle-art");
        const present=function(){
            const audio=window.v141Audio;
            const playSound=function(){
                const sound=damage?(critical?"crit":"damage"):kind==="shield"?"block":kind==="miss"?"dodge":null;
                if(sound&&audio&&typeof audio.play==="function"){ audio.play(sound,audio.combatFeedbackVolumeScale); }
            };
            if(!damage||!direct||!entity||state.current!==current||current.done||impactEpoch!==state.impactEpoch||
               entityFor(side,unitIndex)!==entity||hit&&!ownedHit||ownedHit&&(hit.presented||!validImpactHit(hit))||
               (Number(entity?.hp)<=0||entity?.alive===false)&&!(ownedHit&&hit.lethal)){
                playSound(); return;
            }
            const card=cardFor(side,unitIndex);
            const artwork=ownedHit?hit.artwork:card&&card.querySelector(".v174-battle-art");
            if(artwork!==artworkAtSchedule){ playSound(); return; }
            if(!artwork||typeof artwork.animate!=="function"){ playSound(); return; }
            if(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){ playSound(); return; }
            if(artwork.v143ImpactRecoil){ artwork.v143ImpactRecoil.cancel(); }
            const distance=(critical?5:4)*(side==="monster"?-1:1);
            // The one hit callback owns both pulses; no new clock or gate.
            createImpactFlash(artwork,side,unitIndex,current,impactEpoch,ownedHit?hit:null);
            const rank=current.hitRanks?.get(unitIndex)||0;
            if(ownedHit){ current.hitFeedback?.hit({key:unitIndex,damage:hit.fact.actualHpLoss,
                critical,power:current.hitFeedback?.config.sweepEnabled?current.hitFeedback.config.hitStrength[Math.min(rank,2)]:1,
                roots:[document.getElementById("battlePage"),state.stage,state.hitOverlay,
                    ...document.querySelectorAll(".v174-battle-hud-layer,.battle-floating-feedback")]}); }
            if(ownedHit&&current.hitFeedback?.config.sweepEnabled){
                const rect=hit.projection?.rect;
                current.hitFeedback.impact(state.stage,rect,rank,rank===current.targetIndexes.length-1,false,current.visualStartedAt+current.duration,hit.fact.actualHpLoss,critical);
            }
            if(fireSample&&critical)window.FourSymbolsBattlePresentation?.fireCriticalShake?.(current.sequence);
            const motion=artwork.querySelector?.(":scope > .v174-action-motion")||artwork;
            // First fire sample: a short retreat/lean on the existing motion
            // layer, only after committed direct damage. No slot or hit clock moves.
            const slashSample=current.config.id==="flameSlash";
            const flurrySample=current.config.id==="explosiveFlurry";
            const recoilFrames=slashSample?[
                {translate:"0px 0px",rotate:"0deg",scale:1},
                {translate:"0px "+(distance*2)+"px",rotate:(side==="monster"?-2:2)+"deg",scale:.985,offset:.3},
                {translate:"0px "+(distance*.4)+"px",rotate:"0deg",scale:1,offset:.7},
                {translate:"0px 0px",rotate:"0deg",scale:1}
            ]:flurrySample?[
                {translate:"0px 0px",rotate:"0deg",scale:1},
                {translate:"0px "+(distance*1.5)+"px",rotate:(side==="monster"?-1:1)+"deg",scale:.99,offset:.3},
                {translate:"0px "+(-distance*.2)+"px",rotate:"0deg",scale:1,offset:.7},
                {translate:"0px 0px",rotate:"0deg",scale:1}
            ]:[
                {translate:"0px 0px",scale:1},
                {translate:"0px "+distance+"px",scale:critical?.975:.98,offset:.3},
                {translate:"0px "+(-distance*.3)+"px",scale:1,offset:.7},
                {translate:"0px 0px",scale:1}
            ];
            if(artwork.isConnected){ artwork.v143ImpactRecoil=motion.animate(recoilFrames,{duration:140,easing:"ease-out"});
            const recoil=artwork.v143ImpactRecoil;
            window.FourSymbolsBattlePresentation?.syncMotion?.(card);
            recoil.onfinish=()=>{ if(artwork.v143ImpactRecoil===recoil){ artwork.v143ImpactRecoil=null; window.FourSymbolsBattlePresentation?.syncMotion?.(card); } };
            }
            playSound();
        };
        if(!queueTargetHit(current,unitIndex,present,"feedback",side)){
            if(wait>8||current&&!current.done&&!current.hitReached){ setTimer(present,wait); }else{ present(); }
        }
        if(wait>8){ state.metrics.delayedNumbers++; }
        const scheduleImpact=current&&!current.done&&current.targetSide===side&&current.model&&current.model.sprite&&
            (current.model.sprite.impactOnly||current.emitted?.has(unitIndex))
            ?callback=>queueTargetHit(current,unitIndex,callback,"feedback",side):null;
        return Object.freeze({delayMs:wait,impactAt:Date.now()+wait,impactId:current&&!current.done?("v143:"+String(current.sequence)+":"+side+":"+String(unitIndex)):null,sequence:current&&!current.done?current.sequence:0,critical:critical,scheduleImpact:scheduleImpact,presentationStyle:fireSample&&(damage||kind==="miss")?"fire-sample":null});
    };

    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previous=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index){
            registerTarget("player",Number(index)||0,true);
            return previous.apply(this,arguments);
        };
    }

    function officialCardEffect(side,index){
        const args=Array.prototype.slice.call(arguments);
        const potionTarget=window.v143LastPotionEffectTarget;
        if(args[2]==="potion"&&potionTarget&&Date.now()-potionTarget.at<2000){
            side="player";
            index=potionTarget.index;
            window.v143LastPotionEffectTarget=null;
        }
        const wait=delayFor(side,index,false);
        const invoke=function(){
            const unitIndex=Number(index);
            if((side==="player"||side==="monster")&&Number.isInteger(unitIndex)){
                syncStatusVisualsForUnit(side,unitIndex);
            }else{
                syncStatusVisualEffects();
            }
        };
        if(!queueTargetHit(state.current,Number(index),invoke,"projection",side)){
            if(wait>8){ setTimer(invoke,wait); }else{ invoke(); }
        }
    }

    if(typeof window.v141PlayCardEffect==="function"){
        try{
            Object.defineProperty(window,"v141PlayCardEffect",{
                configurable:true,enumerable:true,
                get:function(){ return officialCardEffect; },
                set:function(){ blockedCardEffectOverrides++; }
            });
        }catch(_){
            window.v141PlayCardEffect=officialCardEffect;
        }
    }

    // Death settlement stays synchronous in the core owner. Only the captured
    // committed hit's artwork presentation may outlive that settlement.

    function scheduleStatusOwnedUiUpdate(side,index,keyPrefix,callback){
        if(typeof callback!=="function"){ return; }
        const wait=existingTargetDelay(side,index);
        const current=state.current;
        const awaitingImpact=current&&!current.done&&current.targetSide===side&&
            current.emitted.has(index)&&!(current.settledTargets?current.settledTargets.has(index):current.hitReached);
        if(wait>8||awaitingImpact){
            const key=keyPrefix+":"+index;
            if(!state.pendingUpdates.has(key)){
                state.pendingUpdates.set(key,true);
                const project=()=>{
                    state.pendingUpdates.delete(key);
                    current?.pendingUpdateKeys?.delete(key);
                    callback();
                };
                if(queueTargetHit(current,index,project,"projection",side)){
                    if(!current.pendingUpdateKeys){ current.pendingUpdateKeys=new Set(); }
                    current.pendingUpdateKeys.add(key);
                }else{ setTimer(project,wait); }
            }
            return;
        }
        return callback();
    }

    window.v143ScheduleMonsterUiUpdate=function(index,callback,projection){
        return scheduleStatusOwnedUiUpdate("monster",Number(index),"monster-"+(projection||"resources"),callback);
    };
    window.v143StatusAfterMonsterUiUpdate=function(index){
        syncStatusVisualsForUnit("monster",Number(index));
    };
    window.v143SchedulePlayerStatusUiUpdate=function(index,callback,projection){
        return scheduleStatusOwnedUiUpdate("player",Number(index),"player-"+(projection||"status"),callback);
    };
    window.v143StatusAfterPlayerUiUpdate=function(index){
        syncStatusVisualsForUnit("player",Number(index));
    };


    if(typeof document!=="undefined"){
        const boot=function(){ purgeLegacyCardVfx(); syncStatusVisualEffects(); };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",boot,{once:true}); }
        else{ boot(); }
    }

    window.v143GetAnimationDiagnostics=function(){
        return Object.assign({},state.metrics,{
            version:VERSION,active:!!state.current,
            activeSkill:state.current&&state.current.config.id,
            activeSide:state.current&&state.current.side,
            targetSide:state.current&&state.current.targetSide,
            blockedManifestWrites:blockedManifestWrites,
            blockedDirectorOverrides:blockedDirectorOverrides,
            blockedCardEffectOverrides:blockedCardEffectOverrides,
            failedAssets:Array.from(failedAssets),
            renderer:"dom-sprite-only",
            statusRenderer:"dom-status-visual",
            geometryOwner:"fixed-slot",
            stageNodes:state.stage?state.stage.querySelectorAll("*").length:0
        });
    };
})();
