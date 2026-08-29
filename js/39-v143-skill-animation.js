/* =====================================================
   V143 — card-to-card, per-skill battle animation runtime
   Skill names are short caster labels. The action itself travels from the
   caster card to the real target card and owns the action gate until done.
===================================================== */
(function installV143SkillAnimationRuntime(){
    "use strict";

    if(typeof window==="undefined"||window.__v143SkillAnimationInstalled){ return; }
    if(!window.v142SkillAnimationDirector){ return; }
    window.__v143SkillAnimationInstalled=true;

    const VERSION="143";
    const COLORS={
        fire:["#ff4e24","#ffd064"],water:["#44c9ff","#e2fbff"],
        wind:["#63efb2","#effff7"],earth:["#d5a252","#fff0a1"],
        light:["#ffe578","#ffffff"],dark:["#ae82ff","#efdfff"],
        normal:["#e7dbc5","#ffffff"]
    };

    /*
       The engine is shared, the choreography is not. Every known ID owns a
       distinct signature (shape, path, impact, cadence and hit frame).
    */
    const MANIFEST={
        normal:{glyph:"✦",motion:"line",impact:"spark",hit:.57,pulses:1,spread:0},

        flameSlash:{glyph:"╱",motion:"arc-up",impact:"flame-cut",hit:.58,pulses:1,spread:0},
        fireCritical:{glyph:"拳",motion:"dash",impact:"ember-fist",hit:.62,pulses:2,spread:0},
        explosiveFlurry:{glyph:"拳",motion:"zigzag",impact:"fire-combo",hit:.68,pulses:4,spread:54},
        dragonSlash:{glyph:"龍",motion:"serpent",impact:"dragon-cleave",hit:.73,pulses:3,spread:92,flightCount:2},
        fireRocket:{glyph:"➶",motion:"arc-down",impact:"arrow-burst",hit:.64,pulses:1,spread:42},
        blazeSpell:{glyph:"火",motion:"orb",impact:"flame-bloom",hit:.61,pulses:2,spread:30},
        flameTornado:{glyph:"炎",motion:"spiral",impact:"fire-tornado",hit:.72,pulses:5,spread:82,flightCount:3},
        phoenixCry:{glyph:"鳳",motion:"swoop",impact:"phoenix-field",hit:.76,pulses:6,spread:112,flightCount:2},
        rage:{glyph:"怒",motion:"rise",impact:"rage-aura",hit:.52,pulses:3,spread:55},
        fireEX:{glyph:"焰",motion:"orbit",impact:"fire-crown",hit:.74,pulses:7,spread:95},

        waterKnife:{glyph:"刃",motion:"wave",impact:"water-cut",hit:.57,pulses:1,spread:0},
        frostPunch:{glyph:"拳",motion:"dash",impact:"ice-fist",hit:.61,pulses:2,spread:18},
        iceSpin:{glyph:"輪",motion:"spin",impact:"ice-wheel",hit:.67,pulses:3,spread:42},
        frostCrush:{glyph:"槌",motion:"drop",impact:"ice-crush",hit:.71,pulses:4,spread:58},
        waterBall:{glyph:"●",motion:"wave",impact:"water-splash",hit:.62,pulses:1,spread:34},
        floodBeast:{glyph:"獸",motion:"surge",impact:"flood-jaw",hit:.68,pulses:4,spread:66},
        iceArrowRain:{
            glyph:"➶",motion:"rain",impact:"ice-rain",hit:.5833333333,
            pulses:7,spread:104,flightCount:7,
            sprite:{
                src:"assets/vfx/water/ice-arrow-rain.png",
                columns:4,rows:3,frames:12,hitFrame:7
            }
        },
        freeze:{glyph:"晶",motion:"crystal",impact:"ice-prison",hit:.69,pulses:3,spread:48},
        healSpell:{glyph:"癒",motion:"rise",impact:"healing-spring",hit:.58,pulses:3,spread:46},
        revive:{glyph:"生",motion:"ascend",impact:"revive-pillar",hit:.70,pulses:5,spread:70},
        waterEX:{glyph:"泉",motion:"orbit-reverse",impact:"tidal-crown",hit:.74,pulses:7,spread:95},

        stormFist:{glyph:"拳",motion:"dash",impact:"wind-fist",hit:.56,pulses:1,spread:0},
        stormFlurry:{glyph:"迅",motion:"afterimage",impact:"wind-combo",hit:.64,pulses:4,spread:48},
        windCrossSlash:{glyph:"十",motion:"cross",impact:"cross-gale",hit:.68,pulses:2,spread:58},
        dizzyFist:{glyph:"雷",motion:"blink",impact:"thunder-fist",hit:.70,pulses:4,spread:62},
        windSpell:{glyph:"➤",motion:"curve",impact:"wind-blade",hit:.60,pulses:1,spread:30},
        stormCircle:{glyph:"旋",motion:"spiral",impact:"gale-ring",hit:.66,pulses:3,spread:56},
        windHowlLightning:{glyph:"⚡",motion:"bolt",impact:"lightning-fang",hit:.68,pulses:4,spread:62},
        stormRain:{glyph:"風",sequence:"風起雲湧",motion:"tempest",impact:"storm-domain",hit:.75,pulses:7,spread:110,flightCount:4},
        dodgeSkill:{glyph:"疾",motion:"afterimage",impact:"speed-aura",hit:.54,pulses:3,spread:50},
        stealthSkill:{glyph:"隱",motion:"veil",impact:"vanish-mist",hit:.59,pulses:3,spread:52},
        dinghaishenzhen:{glyph:"定",motion:"orbit",impact:"calm-seal",hit:.67,pulses:5,spread:72},
        windEX:{glyph:"嵐",motion:"orbit-fast",impact:"wind-crown",hit:.74,pulses:7,spread:95},
        stormSpell:{glyph:"暴",motion:"tempest",impact:"storm-eye",hit:.72,pulses:6,spread:86},

        stoneSlash:{glyph:"斬",motion:"heavy-arc",impact:"stone-cut",hit:.59,pulses:1,spread:0},
        petrifyFist:{glyph:"岩",motion:"dash",impact:"petrify-fist",hit:.64,pulses:2,spread:28},
        stoneBreakSky:{glyph:"柱",motion:"erupt",impact:"stone-pillar",hit:.70,pulses:4,spread:78,flightCount:3},
        earthquakeCrush:{glyph:"裂",motion:"ground",impact:"earth-rift",hit:.74,pulses:6,spread:92},
        stoneThrow:{glyph:"◆",motion:"lob",impact:"rock-shatter",hit:.62,pulses:2,spread:42,flightCount:3},
        sandWind:{glyph:"石",sequence:"滾石",motion:"swirl",impact:"sand-cloud",hit:.66,pulses:4,spread:72,flightCount:4},
        flyingSandStrike:{glyph:"沙",sequence:"飛沙",motion:"burrow",impact:"petrify-spike",hit:.71,pulses:5,spread:88,flightCount:5},
        dustStorm:{glyph:"裂",sequence:"地牛猛襲",motion:"ground-wave",impact:"dust-quake",hit:.76,pulses:7,spread:112,flightCount:4},
        earthShield:{glyph:"象",motion:"corner",impact:"four-earth-aura",hit:.57,pulses:4,spread:55},
        rockWall:{glyph:"壁",motion:"erupt",impact:"rock-wall",hit:.64,pulses:4,spread:60},
        barrier:{glyph:"界",motion:"seal",impact:"barrier-dome",hit:.68,pulses:5,spread:72},
        earthEX:{glyph:"岳",motion:"orbit-heavy",impact:"earth-crown",hit:.74,pulses:7,spread:95},

        yuanXiangGuangMing:{glyph:"光",motion:"ascend",impact:"holy-rain",hit:.66,pulses:6,spread:82},
        yuanGuangShield:{glyph:"護",motion:"seal",impact:"holy-dome",hit:.63,pulses:5,spread:70},
        yuanZuBlessing:{glyph:"賜",motion:"orbit",impact:"holy-blessing",hit:.69,pulses:7,spread:90},
        windArrow:{glyph:"➳",motion:"curve",impact:"wind-arrow",hit:.61,pulses:1,spread:18}
    };

    function hashString(value){
        let hash=2166136261;
        String(value||"").split("").forEach(char=>{ hash^=char.charCodeAt(0); hash=Math.imul(hash,16777619); });
        return hash>>>0;
    }

    function modelFor(config){
        const known=MANIFEST[config.id];
        if(known){ return Object.assign({signature:config.id},known); }
        const hash=hashString(config.id+"|"+config.name);
        const motions=["line","curve","arc-up","zigzag","spin","surge","drop","ground-wave"];
        const impacts=["spark","burst","ring","shatter","bloom","wave","pillar","flare"];
        return {
            signature:"generated-"+String(config.id||"skill"),
            glyph:String(config.name||"技").slice(0,1),
            motion:motions[hash%motions.length],
            impact:impacts[(hash>>>4)%impacts.length],
            hit:.56+((hash>>>8)%18)/100,
            pulses:1+((hash>>>12)%5),
            spread:20+((hash>>>16)%68),
            generated:true
        };
    }

    window.v143SkillAnimationManifest=MANIFEST;
    window.v143GetSkillAnimationModel=function(skillId){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        return modelFor({id:skillId,name:skill&&skill.name||skillId});
    };

    /* Warm the one external frame asset without creating a second renderer. */
    if(typeof Image==="function"){
        Object.keys(MANIFEST).forEach(id=>{
            const sprite=MANIFEST[id]&&MANIFEST[id].sprite;
            if(!sprite||!sprite.src){ return; }
            const image=new Image();
            image.decoding="async";
            image.src=sprite.src;
        });
    }

    const director=window.v142SkillAnimationDirector;
    const originalPlay=director.play.bind(director);
    const originalDispose=director.dispose.bind(director);
    const state={
        version:VERSION,current:null,stage:null,timers:new Set(),pendingUpdates:new Map(),
        metrics:{started:0,completed:0,peakNodes:0,delayedNumbers:0,delayedDeaths:0}
    };
    window.v143SkillAnimationState=state;

    function setTimer(callback,delay){
        const id=setTimeout(()=>{ state.timers.delete(id); callback(); },Math.max(0,delay));
        state.timers.add(id);
        return id;
    }

    function clearTimers(){
        state.timers.forEach(id=>clearTimeout(id));
        state.timers.clear();
        state.pendingUpdates.clear();
    }

    function cardFor(side,index){
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

    function cardCenter(card){
        const rect=card&&card.getBoundingClientRect?card.getBoundingClientRect():null;
        return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2,rect:rect}:null;
    }

    function activeCards(side,config){
        const cards=[];
        const max=side==="monster"?10:3;
        for(let index=0;index<max;index++){
            const card=cardFor(side,index);
            if(card&&card.offsetParent!==null&&canReceive(config,side,index)){
                cards.push({index:index,card:card});
            }
        }
        return cards;
    }

    function targetSideFor(config,side){
        const ally=/ally/i.test(String(config.targetType||""))||/heal|revive|buff/.test(String(config.category||""));
        return ally?side:(side==="player"?"monster":"player");
    }

    function initialTargetIndexes(config,meta,targetSide){
        const targetType=String(config.targetType||"");
        const all=/all/i.test(targetType);
        const formation=/row|tri|column/i.test(targetType);
        if(meta.side==="player"&&typeof queuedPlayerActions!=="undefined"){
            const queued=queuedPlayerActions&&queuedPlayerActions[meta.actorIndex];
            if(queued){
                if(
                    targetSide==="monster"&&formation&&
                    Number.isInteger(queued.target)&&typeof getSkillTargets==="function"
                ){
                    return getSkillTargets(queued.target,targetType)
                        .filter(index=>canReceive(config,targetSide,index));
                }
                if(targetSide==="monster"&&Number.isInteger(queued.target)&&canReceive(config,targetSide,queued.target)){
                    return [queued.target];
                }
                if(targetSide==="player"&&Number.isInteger(queued.targetAlly)&&canReceive(config,targetSide,queued.targetAlly)){
                    return [queued.targetAlly];
                }
            }
        }
        const cards=activeCards(targetSide,config);
        if(all){ return cards.map(entry=>entry.index); }
        /* Enemy row/tri actions do not expose their chosen centre before the
           engine resolves the hit list.  Let the real hit callbacks register
           those cards; treating a row as all targets was the old mismatch. */
        if(formation){ return []; }
        /* Single support actions register the exact recipient when their card
           effect is applied.  Guessing the caster here created a second,
           incorrect target for Barrier and other single-target buffs. */
        return [];
    }

    function fieldBounds(cards){
        const rects=cards.map(card=>card.getBoundingClientRect()).filter(rect=>rect.width&&rect.height);
        if(!rects.length){ return null; }
        const left=Math.min.apply(null,rects.map(rect=>rect.left));
        const top=Math.min.apply(null,rects.map(rect=>rect.top));
        const right=Math.max.apply(null,rects.map(rect=>rect.right));
        const bottom=Math.max.apply(null,rects.map(rect=>rect.bottom));
        return {left:left,top:top,width:right-left,height:bottom-top};
    }

    function makePath(dx,dy,motion){
        const bend=Math.max(28,Math.min(110,Math.hypot(dx,dy)*.28));
        if(/arc-up|lob|swoop/.test(motion)){ return "M 0 0 Q "+(dx*.48)+" "+(dy*.48-bend)+" "+dx+" "+dy; }
        if(/arc-down|burrow/.test(motion)){ return "M 0 0 Q "+(dx*.48)+" "+(dy*.48+bend)+" "+dx+" "+dy; }
        if(/zigzag|afterimage|bolt/.test(motion)){
            return "M 0 0 L "+(dx*.25)+" "+(dy*.25-bend*.35)+" L "+(dx*.48)+" "+(dy*.48+bend*.28)+" L "+(dx*.72)+" "+(dy*.72-bend*.2)+" L "+dx+" "+dy;
        }
        if(/wave|curve|serpent|surge|spiral|swirl|tempest|orbit/.test(motion)){
            return "M 0 0 C "+(dx*.2)+" "+(dy*.55-bend)+" "+(dx*.72)+" "+(dy*.25+bend)+" "+dx+" "+dy;
        }
        return "M 0 0 L "+dx+" "+dy;
    }

    function appendNode(className,parent){
        const node=document.createElement("i");
        node.className=className;
        (parent||state.stage).appendChild(node);
        if(state.stage){ state.metrics.peakNodes=Math.max(state.metrics.peakNodes,state.stage.childElementCount); }
        return node;
    }

    function flightMarkup(skillId,glyph){
        const id=String(skillId||"");
        if(id==="dragonSlash"){
            return '<svg class="v146-flight-art" viewBox="0 0 92 52" aria-hidden="true"><path d="M5 34C17 4 38 49 52 18C61-2 76 7 86 20C72 17 73 30 62 32C48 35 38 19 30 31C22 44 13 45 5 34Z" fill="currentColor"/><circle cx="76" cy="18" r="2.4" fill="#fff7b0"/><path d="M57 15L61 4L66 14M71 15L78 6L80 19" fill="none" stroke="currentColor" stroke-width="3"/></svg>';
        }
        if(id==="phoenixCry"){
            return '<svg class="v146-flight-art" viewBox="0 0 96 58" aria-hidden="true"><path d="M48 26C32 0 14 2 3 13C21 15 25 29 38 35L20 51L46 39L48 57L54 38L80 52L61 34C73 29 78 14 94 11C77 0 62 5 48 26Z" fill="currentColor"/><path d="M44 24L49 13L55 24L50 34Z" fill="#fff3a2"/></svg>';
        }
        if(id==="iceArrowRain"||id==="fireRocket"||id==="windArrow"){
            return '<svg class="v146-flight-art" viewBox="0 0 72 32" aria-hidden="true"><path d="M4 16H58M48 7L66 16L48 25M16 9L7 16L16 23" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        if(/stoneThrow|stoneBreakSky|sandWind|flyingSandStrike|dustStorm/.test(id)){
            return '<svg class="v146-flight-art" viewBox="0 0 52 52" aria-hidden="true"><path d="M8 15L23 4L43 11L49 29L35 47L13 43L3 28Z" fill="currentColor"/><path d="M14 18L27 12L39 19M12 31L26 25L38 36" fill="none" stroke="#fff0a1" stroke-opacity=".62" stroke-width="3"/></svg>';
        }
        return null;
    }

    function addCharge(current){
        const actor=cardCenter(current.actorCard);
        if(!actor||!state.stage){ return; }
        const charge=appendNode("v143-cast-charge motion-"+current.model.motion);
        charge.textContent=current.model.glyph;
        charge.style.left=actor.x+"px";
        charge.style.top=actor.y+"px";
        charge.style.setProperty("--v143-charge",Math.max(240,current.duration*.28)+"ms");
        current.actorCard.classList.add("v143-caster-active");
    }

    function addField(current){
        if(!state.stage){ return; }
        const cards=current.targetIndexes.map(index=>cardFor(current.targetSide,index)).filter(Boolean);
        const bounds=fieldBounds(cards);
        if(!bounds||cards.length<2){ return; }
        const field=appendNode("v143-skill-field impact-"+current.model.impact);
        field.style.left=(bounds.left-8)+"px";
        field.style.top=(bounds.top-8)+"px";
        field.style.width=(bounds.width+16)+"px";
        field.style.height=(bounds.height+16)+"px";
        field.style.setProperty("--v143-field-delay",Math.round(current.duration*.18)+"ms");
        field.style.setProperty("--v143-field-duration",Math.round(current.duration*.72)+"ms");
    }

    function targetHitTime(current,index){
        const position=Math.max(0,current.targetIndexes.indexOf(index));
        const stagger=current.model.sprite?0:
            (current.targetIndexes.length>1?Math.min(210,position*55):0);
        return Math.min(
            current.startedAt+current.duration-140,
            current.startedAt+current.duration*current.model.hit+stagger
        );
    }

    function addImpact(current,index){
        if(!state.stage||state.current!==current||current.done){ return; }
        const card=cardFor(current.targetSide,index);
        const target=cardCenter(card);
        if(!target){ return; }
        card.classList.remove("v143-effects-pending");
        card.classList.add("v143-impact-target");
        if(current.targetIndexes.length>1&&/all|row|tri/i.test(String(current.config.targetType||""))){
            card.classList.add("v146-area-impact");
            setTimer(()=>card.classList.remove("v146-area-impact"),680);
        }
        if(typeof window.v143SyncEarthShieldEffects==="function"){
            window.v143SyncEarthShieldEffects();
            setTimer(()=>window.v143SyncEarthShieldEffects(),0);
        }
        setTimer(()=>card.classList.remove("v143-impact-target"),520);
        if(current.model.sprite){
            current.hitReached=true;
            return;
        }
        const impact=appendNode("v143-hit-impact impact-"+current.model.impact);
        impact.textContent=current.model.glyph;
        impact.style.left=target.x+"px";
        impact.style.top=target.y+"px";
        impact.style.setProperty("--v143-spread",current.model.spread+"px");
        const remaining=Math.max(140,current.startedAt+current.duration-Date.now()-18);
        const impactDuration=Math.min(540,remaining);
        impact.style.setProperty("--v143-impact-duration",impactDuration+"ms");

        const device=typeof navigator!=="undefined"?navigator:{};
        const lowQuality=(Number(device.deviceMemory)||4)<=2||(Number(device.hardwareConcurrency)||4)<=2;
        const particleBudget=lowQuality?32:72;
        const perTargetBudget=Math.max(4,Math.floor(particleBudget/Math.max(1,current.targetIndexes.length)));
        const particleCount=Math.min(perTargetBudget,lowQuality?10:24,Math.max(6,current.model.pulses*3));
        for(let particleIndex=0;particleIndex<particleCount;particleIndex++){
            const particle=appendNode("v143-hit-particle",impact);
            const angle=particleIndex/particleCount*Math.PI*2+(hashString(current.model.signature)%21)/10;
            const radius=current.model.spread*(.45+(particleIndex%4)*.14);
            particle.style.setProperty("--px",Math.cos(angle)*radius+"px");
            particle.style.setProperty("--py",Math.sin(angle)*radius+"px");
            particle.style.setProperty("--pd",(particleIndex%5)*18+"ms");
            particle.style.setProperty("--v143-particle-duration",Math.max(120,impactDuration-40)+"ms");
        }
        current.hitReached=true;
    }

    function addSprite(current,index,target){
        const sprite=current.model.sprite;
        if(!sprite||!target||current.spriteNodes.has(index)){ return; }
        const size=Math.max(
            96,
            Math.min(184,Math.max(target.rect.width,target.rect.height)*1.8)
        );
        const node=appendNode("v143-vfx-sprite v143-vfx-sprite-"+current.config.id);
        node.dataset.targetSide=current.targetSide;
        node.dataset.targetIndex=String(index);
        node.dataset.frames=String(sprite.frames);
        node.style.left=target.x+"px";
        node.style.top=target.y+"px";
        node.style.width=size+"px";
        node.style.height=size+"px";
        node.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
        node.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
        node.style.setProperty("--v143-sprite-duration",current.duration+"ms");
        current.spriteNodes.set(index,node);
    }

    function emitFlight(current,index,allowDefeated){
        if(!state.stage||current.emitted.has(index)){ return; }
        if(!current.validTargets.has(index)){ return; }
        if(!allowDefeated&&!canReceive(current.config,current.targetSide,index)){ return; }
        const actor=cardCenter(current.actorCard);
        const targetCard=cardFor(current.targetSide,index);
        const target=cardCenter(targetCard);
        if(!actor||!target){ return; }
        current.emitted.add(index);
        if(current.targetIndexes.indexOf(index)<0){ current.targetIndexes.push(index); }
        targetCard.classList.add("v143-effects-pending");
        const hitAt=targetHitTime(current,index);
        const startDelay=Math.max(40,current.duration*.2+Math.max(0,current.targetIndexes.indexOf(index))*30);
        const travel=Math.max(150,hitAt-current.startedAt-startDelay);
        if(current.model.sprite){
            addSprite(current,index,target);
            setTimer(()=>addImpact(current,index),Math.max(0,hitAt-Date.now()));
            return;
        }
        const device=typeof navigator!=="undefined"?navigator:{};
        const lowQuality=(Number(device.deviceMemory)||4)<=2||(Number(device.hardwareConcurrency)||4)<=2;
        const requested=Math.max(1,Number(current.model.flightCount)||Math.min(4,current.model.pulses));
        const totalFlightBudget=lowQuality?30:54;
        const perTargetFlightBudget=Math.max(1,Math.floor(totalFlightBudget/Math.max(1,current.targetIndexes.length)));
        const repeats=Math.max(1,requested);
        const sequence=Array.from(String(current.model.sequence||current.model.glyph||"技"));
        for(let repeat=0;repeat<repeats;repeat++){
            const flight=appendNode("v143-skill-flight motion-"+current.model.motion);
            const symbol=sequence[repeat%sequence.length]||current.model.glyph;
            const art=flightMarkup(current.config.id,symbol);
            if(art){ flight.innerHTML=art; }
            else{ flight.textContent=symbol; }
            flight.dataset.targetSide=current.targetSide;
            flight.dataset.targetIndex=String(index);
            flight.dataset.order=String(repeat);
            flight.style.left=actor.x+"px";
            flight.style.top=actor.y+"px";
            flight.style.offsetPath='path("'+makePath(target.x-actor.x,target.y-actor.y,current.model.motion)+'")';
            flight.style.setProperty("--v143-flight-delay",Math.round(startDelay+repeat*45)+"ms");
            flight.style.setProperty("--v143-flight-duration",Math.max(130,Math.round(travel-repeat*18))+"ms");
            flight.style.setProperty("--v143-flight-scale",String(1+repeat*.08));
        }
        setTimer(()=>addImpact(current,index),Math.max(0,hitAt-Date.now()));
    }

    function registerTarget(targetSide,index,allowDefeated){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide){ return null; }
        emitFlight(current,index,allowDefeated===true);
        return current.emitted.has(index)?current:null;
    }

    function cleanupCurrent(current,reason){
        if(!current||current.done){ return; }
        current.done=true;
        current.actorCard&&current.actorCard.classList.remove("v143-caster-active");
        current.targetIndexes.forEach(index=>{
            const card=cardFor(current.targetSide,index);
            if(card){ card.classList.remove("v143-effects-pending","v143-impact-target"); }
        });
        if(state.stage&&state.stage.dataset.sequence===String(current.sequence)){ state.stage.remove(); }
        if(state.current===current){ state.current=null; state.stage=null; }
        state.metrics.completed++;
        if(current.gate&&!current.gate.done){ current.gate.complete(reason||"v143-animation-complete"); }
    }

    let sequence=0;
    function render(config,meta,gate){
        if(typeof document==="undefined"||!document.body){
            setTimer(()=>gate.complete("v143-headless"),config.resolveDuration||config.duration);
            return null;
        }
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"superseded"); }
        const model=modelFor(config);
        const targetSide=targetSideFor(config,meta.side||"player");
        const duration=Math.max(520,Number(config.duration)||520);
        const validTargets=new Set(
            activeCards(targetSide,config).map(entry=>entry.index)
        );
        const current={
            sequence:++sequence,config:config,model:model,gate:gate,
            side:meta.side||"player",actorIndex:Number.isInteger(meta.actorIndex)?meta.actorIndex:0,
            targetSide:targetSide,targetIndexes:[],emitted:new Set(),
            validTargets:validTargets,spriteNodes:new Map(),
            actorCard:cardFor(meta.side||"player",Number.isInteger(meta.actorIndex)?meta.actorIndex:0),
            startedAt:Date.now(),duration:duration,hitReached:false,done:false
        };
        current.targetIndexes=initialTargetIndexes(config,current,targetSide);
        const stage=document.createElement("div");
        stage.id="v143-skill-stage";
        stage.className="v143-skill-stage";
        stage.dataset.sequence=String(current.sequence);
        stage.dataset.skill=String(config.id||"unknown");
        stage.dataset.signature=model.signature;
        stage.dataset.element=config.element||"normal";
        stage.dataset.motion=model.motion;
        stage.dataset.impact=model.impact;
        const colors=COLORS[config.element]||COLORS.normal;
        stage.style.setProperty("--v143-color",colors[0]);
        stage.style.setProperty("--v143-soft",colors[1]);
        document.body.appendChild(stage);
        state.stage=stage;
        state.current=current;
        state.metrics.started++;
        if(!model.sprite){
            addCharge(current);
            addField(current);
        }
        current.targetIndexes.slice().forEach(index=>emitFlight(current,index));
        setTimer(()=>cleanupCurrent(current,"v143-animation-complete"),Math.max(duration,Number(config.resolveDuration)||duration));
        gate.promise.then(()=>{
            if(state.current===current&&!current.done){ cleanupCurrent(current,gate.reason||"gate-complete"); }
        });
        return current;
    }

    director.play=function(config,meta){
        const safeMeta=Object.assign({},meta||{}, {render:false});
        const gate=originalPlay(config,safeMeta);
        if(state.current&&state.current.gate===gate){ return gate; }
        render(config,Object.assign({side:"player",actorIndex:0},meta||{}),gate);
        return gate;
    };

    director.dispose=function(){
        clearTimers();
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"dispose"); }
        document.querySelectorAll("#v143-skill-stage").forEach(node=>node.remove());
        return originalDispose();
    };

    function delayFor(targetSide,index,allowDefeated){
        const current=registerTarget(targetSide,index,allowDefeated);
        if(!current){ return 0; }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    function existingTargetDelay(targetSide,index){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide||!current.emitted.has(index)){ return 0; }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    if(typeof showMonsterHit==="function"){
        const previousShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index){
            const args=arguments;
            const wait=delayFor("monster",index,true);
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previousShowMonsterHit.apply(this,args),wait);
                return;
            }
            return previousShowMonsterHit.apply(this,args);
        };
    }

    if(typeof showPlayerHit==="function"){
        const previousShowPlayerHit=showPlayerHit;
        showPlayerHit=function(amount,type,index){
            const args=arguments;
            const wait=delayFor("player",Number(index)||0,true);
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previousShowPlayerHit.apply(this,args),wait);
                return;
            }
            return previousShowPlayerHit.apply(this,args);
        };
    }

    if(typeof showMissEffect==="function"){
        const previousShowMiss=showMissEffect;
        showMissEffect=function(isPlayerTarget,index){
            const args=arguments;
            const wait=delayFor(isPlayerTarget?"player":"monster",index,true);
            if(wait>8){ setTimer(()=>previousShowMiss.apply(this,args),wait); return; }
            return previousShowMiss.apply(this,args);
        };
    }

    if(typeof window.v141PlayCardEffect==="function"){
        const previousCardEffect=window.v141PlayCardEffect;
        window.v141PlayCardEffect=function(side,index){
            const args=Array.prototype.slice.call(arguments);
            const potionTarget=window.v143LastPotionEffectTarget;
            if(args[2]==="potion"&&potionTarget&&Date.now()-potionTarget.at<2000){
                args[0]="player";
                args[1]=potionTarget.index;
                side="player";
                index=potionTarget.index;
                window.v143LastPotionEffectTarget=null;
            }
            const wait=delayFor(side,index,false);
            if(wait>8){ setTimer(()=>previousCardEffect.apply(this,args),wait); return; }
            return previousCardEffect.apply(this,args);
        };
    }

    if(typeof killMonster==="function"){
        const previousKillMonster=killMonster;
        killMonster=function(index){
            const args=arguments;
            const wait=existingTargetDelay("monster",index);
            if(wait>8){
                state.metrics.delayedDeaths++;
                setTimer(()=>{
                    const monster=typeof monsters!=="undefined"?monsters[index]:null;
                    if(monster&&monster.hp>0){ return; }
                    previousKillMonster.apply(this,args);
                },wait);
                return;
            }
            return previousKillMonster.apply(this,args);
        };
    }

    /* Keep HP/status DOM changes on the same target-specific hit frame. */
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            const wait=existingTargetDelay("monster",index);
            if(wait>8){
                const key="monster:"+index;
                if(!state.pendingUpdates.has(key)){
                    const args=arguments;
                    state.pendingUpdates.set(key,true);
                    setTimer(()=>{
                        state.pendingUpdates.delete(key);
                        previousUpdateMonsterUI.apply(this,args);
                    },wait);
                }
                return;
            }
            return previousUpdateMonsterUI.apply(this,arguments);
        };
    }


    if(typeof updateSingleCharacterStatusBadge==="function"){
        const previousUpdatePlayerStatus=updateSingleCharacterStatusBadge;
        updateSingleCharacterStatusBadge=function(index){
            const wait=existingTargetDelay("player",index);
            if(wait>8){
                const key="player-status:"+index;
                if(!state.pendingUpdates.has(key)){
                    const args=arguments;
                    state.pendingUpdates.set(key,true);
                    setTimer(()=>{
                        state.pendingUpdates.delete(key);
                        previousUpdatePlayerStatus.apply(this,args);
                    },wait);
                }
                return;
            }
            return previousUpdatePlayerStatus.apply(this,arguments);
        };
    }

    /* Base badges used 72px / 2.2s. V143 keeps them as brief caster labels. */
    function wrapBadge(name){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const before=new Set(document.querySelectorAll(".skill-name-badge"));
            const result=previous.apply(this,arguments);
            document.querySelectorAll(".skill-name-badge").forEach(badge=>{
                if(before.has(badge)){ return; }
                badge.classList.add("v143-caster-skill-label");
                badge.style.setProperty("font-size","15px","important");
                badge.style.setProperty("line-height","1.25","important");
                badge.style.setProperty("font-weight","800","important");
                badge.style.setProperty("min-width","0","important");
                badge.style.setProperty("max-width","160px","important");
                badge.style.setProperty("padding","2px 5px","important");
                badge.style.setProperty("background","transparent","important");
                badge.style.setProperty("border","0","important");
                badge.style.setProperty("box-shadow","none","important");
                badge.style.setProperty("overflow","visible","important");
                badge.style.setProperty("-webkit-text-stroke","1.15px #050403","important");
                badge.style.setProperty("paint-order","stroke fill","important");
                if(badge.classList.contains("badge-normal")||badge.textContent.trim()==="普通攻擊"){
                    badge.style.setProperty("color","#fff","important");
                    badge.style.setProperty("text-shadow","0 1px 2px #000,0 0 5px #000","important");
                }
                setTimer(()=>{ if(badge.parentNode){ badge.remove(); } },650);
            });
            return result;
        };
    }
    wrapBadge("showSkillNameBadge");
    wrapBadge("showMonsterSkillNameBadge");

    /* Every current normal-attack path already emits its own badge.  Do not
       add a second one here: duplicate badges produced a black empty-looking
       frame and superseded the first 520ms gate. */

    window.v143GetAnimationDiagnostics=function(){
        return Object.assign({},state.metrics,{
            version:VERSION,active:!!state.current,
            activeSkill:state.current&&state.current.config.id,
            stageNodes:state.stage?state.stage.querySelectorAll("*").length:0
        });
    };
})();
