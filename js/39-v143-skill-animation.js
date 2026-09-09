/* =====================================================
   V143 — single-owner raster battle VFX runtime
   V174 cleanup: official PNG Sprite Sheets/status loops only.
   No Canvas, SVG, WebGL, shader, particle, glyph or procedural fallback.
===================================================== */
(function installV143SkillAnimationRuntime(){
    "use strict";

    if(typeof window==="undefined"||window.__v143SkillAnimationInstalled){ return; }
    if(!window.v142SkillAnimationDirector){ return; }
    window.__v143SkillAnimationInstalled=true;

    const VERSION="174-raster-owner";
    const DEFAULT_HIT=.5833333333;
    const MECHANISM_TARGET_PREFIX="mechanism:";
    let blockedManifestWrites=0;
    let blockedDirectorOverrides=0;
    let blockedCardEffectOverrides=0;
    const failedAssets=new Set();

    function castSheet(src,placement,options){
        return Object.assign({
            src:src,columns:4,rows:3,frames:12,hitFrame:7,
            placement:placement||"single",renderer:"dom-sprite"
        },options||{});
    }

    function statusSheet(src,duration,collection,options){
        return Object.assign({
            src:src,columns:4,rows:2,frames:8,
            duration:duration,collection:collection||"statusEffects",
            renderer:"dom-sprite"
        },options||{});
    }

    const RAW_MANIFEST={
        normal:{hit:.57,noVisual:true},

        flameSlash:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/flame-slash-cast.png","single",{scale:1.85,maxSize:220})},
        fireCritical:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-critical-cast.png?v=165","single",{scale:2.15,maxSize:260})},
        fireBurstStrike:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-critical-cast.png?v=165","single",{scale:2.15,maxSize:260,reusedFrom:"fireCritical"})},
        explosiveFlurry:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/explosive-flurry-cast.png?v=165","group",{scale:1.08,minSize:190,alignToSlots:true})},
        dragonSlash:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/dragon-slash-cast.png?v=165","single",{scale:2.35,maxSize:300})},
        fireRocket:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-rocket-cast.png?v=165","trajectory",{travelToTargets:true,scale:.72,minSize:180,maxSize:280})},
        blazeSpell:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/blaze-spell-cast.png?v=165","single",{scale:2.15,maxSize:260})},
        flameTornado:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/flame-tornado-cast.png?v=165","single",{scale:2.35,maxSize:300})},
        phoenixCry:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/phoenix-cry-cast.png?v=165","battlefield",{scale:1.12,minSize:280})},
        rage:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/rage-cast.png?v=165","single",{scale:1.08,minSize:96,maxSize:148})},
        fireEX:{hit:.74,noVisual:true,passive:true},

        waterKnife:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-blade-slash-vfx.png?v=166","single",{scale:2.05,maxSize:250})},
        frostPunch:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/frost-fist-vfx.png?v=166","single",{scale:2.15,maxSize:260})},
        iceSpin:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/frost-spinning-slash-vfx.png?v=166","single",{scale:1.95,maxSize:235})},
        frostCrush:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/freeze-heavy-strike-vfx.png?v=166","single",{scale:2.35,maxSize:290})},
        waterBall:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-orb-vfx.png?v=173.19","group",{scale:1.22,minSize:150,maxSize:500,alignToSlots:true})},
        floodBeast:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/tidal-beast-vfx.png?v=166","targetTrajectory",{travelToTargets:true,scale:1.85,minSize:175,maxSize:250})},
        iceArrowRain:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/frost-arrow-rain-vfx.png?v=173.19","battlefield",{fixedFormation:true,coverageScale:1.22,minWidth:140,minHeight:140})},
        freeze:{hit:DEFAULT_HIT,deferredStatusTypes:["freeze"],sprite:castSheet("assets/vfx/water/freeze-cast-vfx.png?v=166","single",{scale:2.2,maxSize:270})},
        healSpell:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-heal-vfx.png?v=166","single",{scale:2.05,maxSize:250})},
        revive:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-revive-vfx.png?v=166","single",{scale:2.3,maxSize:285})},
        waterEX:{hit:.74,noVisual:true,passive:true},

        stormFist:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/inbox/暴風拳-技能動態圖.png?v=173.24","single",{scale:2.15,maxSize:260})},
        stormFlurry:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/inbox/暴風亂擊-技能動態圖.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        windCrossSlash:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/inbox/風旋十字斬-技能動態圖.png?v=173.24","single",{scale:2.25,maxSize:280})},
        dizzyFist:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/inbox/暈眩猛擊-技能動態圖.png?v=173.24","single",{scale:2.35,maxSize:290})},
        windSpell:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/inbox/狂風術-技能動態圖.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stormCircle:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/inbox/風焰術-技能動態圖.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        windHowlLightning:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/inbox/風哮電擊-技能動態圖.png?v=173.24","single",{scale:2.35,maxSize:290})},
        stormRain:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/inbox/風起雲湧-技能動態圖.png?v=173.24","battlefield",{scale:1.08,minSize:280})},
        dodgeSkill:{hit:.5,deferredStatusTypes:["dodgeSkill"],sprite:castSheet("assets/inbox/閃躲術-技能動態圖.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stealthSkill:{hit:.5,deferredStatusTypes:["stealthSkill"],sprite:castSheet("assets/inbox/隱身術-技能動態圖.png?v=173.24","single",{scale:2.15,maxSize:260})},
        dinghaishenzhen:{hit:.5,deferredStatusTypes:["dinghaishenzhen"],sprite:castSheet("assets/inbox/氣定神閒-技能動態圖.png?v=173.24","battlefield",{scale:1.08,minSize:280})},
        windEX:{hit:.74,noVisual:true,passive:true},
        /* Monster-only legacy derivative: use an existing formal Wind sheet,
           never a generated text/particle fallback. */
        stormSpell:{hit:.5,sprite:castSheet("assets/inbox/風起雲湧-技能動態圖.png?v=173.24","battlefield",{scale:1.08,minSize:280,reusedFrom:"stormRain"})},
        windArrow:{hit:.5,sprite:castSheet("assets/inbox/狂風術-技能動態圖.png?v=173.24","targetTrajectory",{travelToTargets:true,scale:1.8,minSize:150,maxSize:230,reusedFrom:"windSpell"})},

        stoneSlash:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/stone-slash-cast.png?v=173.39","single",{scale:2.2,maxSize:270})},
        petrifyFist:{hit:.5,deferredActorStatusTypes:["shield"],sprite:castSheet("assets/vfx/earth/petrify-fist-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stoneBreakSky:{hit:.5,deferredActorStatusTypes:["shield"],sprite:castSheet("assets/vfx/earth/stone-break-sky-cast.png?v=173.39","single",{scale:2.35,maxSize:290})},
        earthquakeCrush:{hit:.5,deferredStatusTypes:["petrify"],sprite:castSheet("assets/vfx/earth/earthquake-crush-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stoneThrow:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/stone-throw-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        sandWind:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/sand-wind-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true,preserveSourceAspect:true})},
        flyingSandStrike:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/flying-sand-strike-cast.png?v=173.39","battlefield",{scale:1.08,minSize:280})},
        dustStorm:{hit:.5,deferredStatusTypes:["petrify"],sprite:castSheet("assets/vfx/earth/dust-storm-cast.png?v=173.39","single",{scale:2.4,maxSize:300})},
        earthShield:{hit:.5,deferredStatusTypes:["earthShield"],sprite:castSheet("assets/vfx/earth/earth-shield-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        rockWall:{hit:.5,deferredStatusTypes:["rockWall"],sprite:castSheet("assets/vfx/earth/rock-wall-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        barrier:{hit:.5,deferredStatusTypes:["barrier"],sprite:castSheet("assets/vfx/earth/barrier-cast.png?v=173.39","single",{scale:2.25,maxSize:280})},
        earthEX:{hit:.74,noVisual:true,passive:true},

        /* These Light support skills currently have no dedicated finished cast
           sheet. Their battle timing remains valid, but there is deliberately
           no procedural substitute. */
        yuanXiangGuangMing:{hit:.5,noVisual:true,missingDedicatedAsset:true},
        yuanGuangShield:{hit:.5,noVisual:true,missingDedicatedAsset:true},
        yuanZuBlessing:{hit:.5,deferredStatusTypes:["yuanZuBlessing"],sprite:castSheet("assets/vfx/light/yuan-zu-blessing-cast.png?v=173.39","battlefield",{scale:1.08,minSize:280})}
    };

    const RAW_STATUS_SPRITES={
        burn:statusSheet("assets/vfx/fire/burn-loop.png?v=165",800,"statusEffects"),
        rage:statusSheet("assets/vfx/fire/rage-buff-loop.png?v=165",1000,"activeBuffs"),
        frostbite:statusSheet("assets/vfx/water/frostbite-status-loop-vfx.png?v=166",1000,"statusEffects",{scale:1.22}),
        freeze:statusSheet("assets/vfx/water/frozen-status-loop-vfx.png?v=166",1100,"statusEffects",{scale:1.28}),
        agilityDown:statusSheet("assets/inbox/重力-狀態循環圖.png?v=173.24",1000,"statusEffects"),
        damageDown:statusSheet("assets/inbox/殤風-狀態循環圖.png?v=173.24",1100,"statusEffects"),
        stun:statusSheet("assets/inbox/暈眩-狀態循環圖.png?v=173.24",900,"statusEffects"),
        dodgeSkill:statusSheet("assets/inbox/風行-狀態循環圖.png?v=173.24",850,"activeBuffs"),
        stealthSkill:statusSheet("assets/inbox/隱身-狀態循環圖.png?v=173.24",1200,"activeBuffs"),
        dinghaishenzhen:statusSheet("assets/inbox/氣定神閒-狀態循環圖.png?v=173.24",1200,"activeBuffs"),
        defenseDown:statusSheet("assets/vfx/earth/defense-down-loop.png?v=173.39",1100,"statusEffects"),
        shield:statusSheet("assets/vfx/earth/rock-shield-loop.png?v=173.39",1200,"activeBuffs",{scale:1.22}),
        petrify:statusSheet("assets/vfx/earth/petrify-loop.png?v=173.39",1300,"statusEffects",{scale:1.22}),
        earthShield:statusSheet("assets/vfx/earth/earth-shield-loop.png?v=173.39",1000,"activeBuffs",{scale:1.20}),
        rockWall:statusSheet("assets/vfx/earth/rock-wall-loop.png?v=173.39",1400,"activeBuffs",{scale:1.20}),
        barrier:statusSheet("assets/vfx/earth/barrier-loop.png?v=173.39",1200,"activeBuffs",{scale:1.24,cellAspect:.75}),
        yuanZuBlessing:statusSheet("assets/vfx/light/yuan-zu-blessing-loop.png?v=173.39",1200,"activeBuffs",{statusName:"元祖賜福",scale:1.18})
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
    Object.keys(RAW_STATUS_SPRITES).forEach(type=>{
        RAW_STATUS_SPRITES[type]=protectObject(RAW_STATUS_SPRITES[type],"status:"+type);
    });

    const MANIFEST=typeof Proxy==="function"
        ?new Proxy(RAW_MANIFEST,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        })
        :RAW_MANIFEST;
    const STATUS_SPRITES=typeof Proxy==="function"
        ?new Proxy(RAW_STATUS_SPRITES,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        })
        :RAW_STATUS_SPRITES;

    window.v143SkillAnimationManifest=MANIFEST;
    window.v143StatusSpriteManifest=STATUS_SPRITES;
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
        const sprite=RAW_MANIFEST[id]&&RAW_MANIFEST[id].sprite;
        if(sprite&&sprite.src){ preflightAsset(sprite.src); }
    });
    Object.keys(RAW_STATUS_SPRITES).forEach(type=>preflightAsset(RAW_STATUS_SPRITES[type].src));

    const director=window.v142SkillAnimationDirector;
    const originalPlay=director.play.bind(director);
    const originalDispose=director.dispose.bind(director);
    const state={
        version:VERSION,current:null,stage:null,timers:new Set(),pendingUpdates:new Map(),
        metrics:{started:0,completed:0,missingVisuals:0,legacyNodesPurged:0,delayedNumbers:0,delayedDeaths:0}
    };
    window.v143SkillAnimationState=state;

    function setTimer(callback,delay){
        const id=setTimeout(()=>{ state.timers.delete(id); callback(); },Math.max(0,Number(delay)||0));
        state.timers.add(id);
        return id;
    }

    function clearTimers(){
        state.timers.forEach(id=>clearTimeout(id));
        state.timers.clear();
        state.pendingUpdates.clear();
    }

    function purgeLegacyCardVfx(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        let removed=0;
        document.querySelectorAll(".v141-card-effects,#v142-skill-stage").forEach(node=>{
            if(node&&typeof node.remove==="function"){ node.remove(); removed++; }
        });
        state.metrics.legacyNodesPurged+=removed;
    }

    function isMechanismTarget(index){
        return typeof index==="string"&&index.indexOf(MECHANISM_TARGET_PREFIX)===0&&index.length>MECHANISM_TARGET_PREFIX.length;
    }

    function mechanismCardFor(index){
        if(typeof document==="undefined"||!isMechanismTarget(index)){ return null; }
        const slot=document.getElementById("bossMechanismSlot");
        if(!slot||typeof slot.querySelectorAll!=="function"){ return null; }
        const mechanismId=index.slice(MECHANISM_TARGET_PREFIX.length);
        return Array.from(slot.querySelectorAll(".boss-mechanism-card")).find(card=>
            card&&card.dataset&&card.dataset.id===mechanismId
        )||null;
    }

    function cardFor(side,index){
        if(typeof document==="undefined"){ return null; }
        if(side==="monster"&&isMechanismTarget(index)){ return mechanismCardFor(index); }
        return document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
    }

    function entityFor(side,index){
        if(side==="monster"){
            return typeof monsters!=="undefined"&&monsters?monsters[index]:null;
        }
        return typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
    }

    function canReceive(config,side,index){
        if(side==="monster"&&isMechanismTarget(index)){
            const card=cardFor(side,index);
            return !!(card&&(!card.classList||!card.classList.contains("destroying")));
        }
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
            if(card&&card.offsetParent!==null&&canReceive(config,side,index)){ cards.push({index:index,card:card}); }
        }
        return cards;
    }

    function targetSideFor(config,side){
        const ally=/ally/i.test(String(config.targetType||""))||/heal|revive|buff/.test(String(config.category||""));
        return ally?side:(side==="player"?"monster":"player");
    }

    function queuedMechanismTarget(config,meta,targetSide){
        if(targetSide!=="monster"||!meta||meta.side!=="player"||typeof queuedPlayerActions==="undefined"){ return null; }
        const queued=queuedPlayerActions&&queuedPlayerActions[meta.actorIndex];
        const target=queued&&queued.target;
        return isMechanismTarget(target)&&canReceive(config,targetSide,target)?target:null;
    }

    function initialTargetIndexes(config,meta,targetSide){
        const targetType=String(config.targetType||"");
        const all=targetType==="all"||targetType==="allyAll";
        const formation=/row|tri|column/i.test(targetType);
        const explicit=Array.isArray(meta.targetIds)
            ?meta.targetIds
            :(meta.targetId!==undefined&&meta.targetId!==null?[meta.targetId]:[]);
        if(explicit.length){
            return Array.from(new Set(explicit.filter(index=>
                (Number.isInteger(index)||isMechanismTarget(index))&&canReceive(config,targetSide,index)
            )));
        }
        const mechanismTarget=queuedMechanismTarget(config,meta,targetSide);
        if(mechanismTarget){ return [mechanismTarget]; }
        const cards=activeCards(targetSide,config);
        if(all){ return cards.map(entry=>entry.index); }
        if(meta.side==="player"&&typeof queuedPlayerActions!=="undefined"){
            const queued=queuedPlayerActions&&queuedPlayerActions[meta.actorIndex];
            if(queued){
                if(
                    targetSide==="monster"&&formation&&Number.isInteger(queued.target)&&
                    typeof getSkillTargets==="function"
                ){
                    return getSkillTargets(queued.target,targetType).filter(index=>canReceive(config,targetSide,index));
                }
                if(targetSide==="monster"&&(Number.isInteger(queued.target)||isMechanismTarget(queued.target))&&canReceive(config,targetSide,queued.target)){
                    return [queued.target];
                }
                if(targetSide==="player"&&Number.isInteger(queued.targetAlly)&&canReceive(config,targetSide,queued.targetAlly)){
                    return [queued.targetAlly];
                }
            }
        }
        return [];
    }

    function fieldBounds(cards){
        const rects=cards.map(card=>card&&card.getBoundingClientRect?card.getBoundingClientRect():null)
            .filter(rect=>rect&&rect.width&&rect.height);
        if(!rects.length){ return null; }
        const left=Math.min.apply(null,rects.map(rect=>rect.left));
        const top=Math.min.apply(null,rects.map(rect=>rect.top));
        const right=Math.max.apply(null,rects.map(rect=>rect.right));
        const bottom=Math.max.apply(null,rects.map(rect=>rect.bottom));
        return {left:left,top:top,width:right-left,height:bottom-top};
    }

    function sideAreaBounds(side){
        const id=side==="monster"?"battleMonsterArea":"battlePlayerRow";
        const area=typeof document!=="undefined"?document.getElementById(id):null;
        const rect=area&&area.getBoundingClientRect?area.getBoundingClientRect():null;
        if(rect&&rect.width&&rect.height){
            return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,id:id};
        }
        const fallback=fieldBounds(activeCards(side,{category:""}).map(entry=>entry.card));
        return fallback?Object.assign({id:id},fallback):null;
    }

    function hasTimedEffect(entity,type){
        if(!entity){ return false; }
        const spec=STATUS_SPRITES[type];
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

    function snapshotTimedEffects(){
        const snapshot=new Set();
        [["monster",10],["player",3]].forEach(entry=>{
            for(let index=0;index<entry[1];index++){
                const entity=entityFor(entry[0],index);
                Object.keys(RAW_STATUS_SPRITES).forEach(type=>{
                    if(hasTimedEffect(entity,type)){ snapshot.add(entry[0]+":"+index+":"+type); }
                });
            }
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

    function statusNode(card,type){
        if(!card){ return null; }
        if(typeof card.querySelector==="function"){ return card.querySelector(".v153-status-vfx-"+type); }
        return Array.from(card.children||[]).find(node=>
            String(node.className||"").split(/\s+/).includes("v153-status-vfx-"+type)
        )||null;
    }

    function syncStatusSprite(side,index,type){
        const spec=STATUS_SPRITES[type];
        const card=cardFor(side,index);
        const entity=entityFor(side,index);
        const alive=!!(spec&&card&&entity&&Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false));
        const active=alive&&hasTimedEffect(entity,type);
        let node=statusNode(card,type);
        if(!active||deferredStatusDuringCast(side,index,type)){
            if(node&&typeof node.remove==="function"){ node.remove(); }
            else if(node&&node.parentNode){ node.parentNode.removeChild(node); }
            return;
        }
        if(!node){
            node=document.createElement("i");
            node.className="v153-status-vfx v153-status-vfx-"+type;
            node.dataset.statusType=type;
            node.dataset.frames=String(spec.frames);
            node.dataset.renderer="dom-sprite";
            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
            node.style.backgroundImage='url("'+String(spec.src).replace(/"/g,"%22")+'")';
            node.style.backgroundSize=(spec.columns*100)+"% "+(spec.rows*100)+"%";
            node.style.setProperty("--v153-status-duration",spec.duration+"ms");
            card.appendChild(node);
        }
        const rect=card.getBoundingClientRect?card.getBoundingClientRect():null;
        const scale=Number(spec.scale)||1.18;
        const size=Math.max(96,Math.max(Number(rect&&rect.width)||0,Number(rect&&rect.height)||0)*scale);
        const cellAspect=Math.max(.1,Number(spec.cellAspect)||1);
        if(cellAspect>=1){
            node.style.width=size+"px";
            node.style.height=(size/cellAspect)+"px";
        }else{
            node.style.width=(size*cellAspect)+"px";
            node.style.height=size+"px";
        }
    }

    function syncStatusSpriteEffects(){
        purgeLegacyCardVfx();
        const types=Object.keys(RAW_STATUS_SPRITES);
        for(let index=0;index<10;index++){ types.forEach(type=>syncStatusSprite("monster",index,type)); }
        for(let index=0;index<3;index++){ types.forEach(type=>syncStatusSprite("player",index,type)); }
    }

    function removeStatusSpriteEffects(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        document.querySelectorAll(".v153-status-vfx").forEach(node=>node.remove());
    }
    window.v143SyncStatusSpriteEffects=syncStatusSpriteEffects;

    function syncAppliedStatusSprite(entity,type){
        if(!entity){ return; }
        let side=null,index=-1;
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            index=monsters.indexOf(entity);
            if(index>=0){ side="monster"; }
        }
        if(!side&&typeof getPartyCharacterByIndex==="function"){
            for(let partyIndex=0;partyIndex<3;partyIndex++){
                if(getPartyCharacterByIndex(partyIndex)===entity){ side="player"; index=partyIndex; break; }
            }
        }
        if(!side||index<0){ return; }
        const current=state.current;
        if(current&&!current.done&&current.targetSide===side){
            const types=Array.isArray(current.model.deferredStatusTypes)?current.model.deferredStatusTypes:[];
            if(types.indexOf(type)>=0){
                let tracked=current.deferredStatusTargets.get(type);
                if(!tracked){ tracked=new Set(); current.deferredStatusTargets.set(type,tracked); }
                tracked.add(index);
                syncStatusSprite(side,index,type);
                return;
            }
        }
        const wait=existingTargetDelay(side,index);
        const invoke=()=>syncStatusSprite(side,index,type);
        if(wait>8){ setTimer(invoke,wait); } else{ invoke(); }
    }

    if(typeof applyBurnEffect==="function"){
        const previous=applyBurnEffect;
        applyBurnEffect=function(entity){
            const result=previous.apply(this,arguments);
            if(result!==false){ syncAppliedStatusSprite(entity,"burn"); }
            return result;
        };
    }
    if(typeof applyFreezeEffect==="function"){
        const previous=applyFreezeEffect;
        applyFreezeEffect=function(entity){
            const result=previous.apply(this,arguments);
            if(result!==false){ syncAppliedStatusSprite(entity,"freeze"); }
            return result;
        };
    }
    if(typeof applyMonsterDebuff==="function"){
        const previous=applyMonsterDebuff;
        applyMonsterDebuff=function(entity,type){
            const result=previous.apply(this,arguments);
            if(result!==false&&STATUS_SPRITES[type]){ syncAppliedStatusSprite(entity,type); }
            return result;
        };
    }

    function appendSpriteNode(current){
        const node=document.createElement("i");
        node.className="v143-vfx-sprite";
        node.dataset.skill=current.config.id||"unknown";
        node.dataset.targetSide=current.targetSide;
        node.dataset.renderer="dom-sprite";
        state.stage.appendChild(node);
        return node;
    }

    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

    function emittedSpriteTargets(current){
        return current.targetIndexes.filter(index=>
            current.emitted.has(index)&&current.validTargets.has(index)&&
            canReceive(current.config,current.targetSide,index)&&!!cardFor(current.targetSide,index)
        );
    }

    function formationRowsForVfx(indexes){
        const resolver=typeof window.v148GetFormationRows==="function"
            ?window.v148GetFormationRows
            :(typeof window.v138GetFormationRows==="function"?window.v138GetFormationRows:null);
        if(!resolver){ return []; }
        const rows=resolver(indexes||[]);
        return Array.isArray(rows)?rows.filter(row=>Array.isArray(row)&&row.length).map(row=>row.slice()):[];
    }

    function fixedTriLayoutBounds(current,indexes){
        if(String(current.config.targetType||"")==="allyTri"&&current.targetSide==="player"){
            const playerArea=sideAreaBounds("player");
            if(playerArea){
                playerArea.centerX=playerArea.left+playerArea.width/2;
                playerArea.centerY=playerArea.top+playerArea.height/2;
                return playerArea;
            }
        }
        const queued=current.side==="player"&&typeof queuedPlayerActions!=="undefined"
            ?queuedPlayerActions&&queuedPlayerActions[current.actorIndex]:null;
        let center=Number.isInteger(current.targetId)?current.targetId:null;
        if(center===null&&queued){
            if(current.targetSide==="monster"&&Number.isInteger(queued.target)){ center=queued.target; }
            if(current.targetSide==="player"&&Number.isInteger(queued.targetAlly)){ center=queued.targetAlly; }
        }
        if(center===null&&indexes.length){ center=indexes[Math.floor((indexes.length-1)/2)]; }
        const anchor=Number.isInteger(center)?cardCenter(cardFor(current.targetSide,center)):null;
        if(!anchor){
            const area=sideAreaBounds(current.targetSide);
            if(area){
                area.centerX=area.left+area.width/2;
                area.centerY=area.top+area.height/2;
            }
            return area;
        }
        let step=Math.max(1,anchor.rect.width+3);
        if(current.targetSide==="monster"&&typeof currentBattleMonsters!=="undefined"){
            const rows=formationRowsForVfx(currentBattleMonsters);
            const row=rows.find(candidate=>candidate.includes(center));
            if(row){
                const pos=row.indexOf(center);
                const distances=[row[pos-1],row[pos+1]].filter(Number.isInteger)
                    .map(i=>cardCenter(cardFor("monster",i))).filter(Boolean)
                    .map(p=>Math.abs(p.x-anchor.x)).filter(distance=>distance>1);
                if(distances.length){ step=Math.min.apply(null,distances); }
            }
        }else if(current.targetSide==="player"){
            const distances=[0,1,2].map(i=>cardCenter(cardFor("player",i))).filter(Boolean)
                .map(p=>Math.abs(p.x-anchor.x)).filter(distance=>distance>1);
            if(distances.length){ step=Math.min.apply(null,distances); }
        }
        const width=anchor.rect.width+step*2;
        return {
            left:anchor.x-width/2,top:anchor.rect.top,width:width,height:anchor.rect.height,
            centerX:anchor.x,centerY:anchor.y,id:"fixed-tri-slots"
        };
    }

    function groupLayoutBounds(current,indexes){
        if(/tri/i.test(String(current.config.targetType||""))){ return fixedTriLayoutBounds(current,indexes); }
        if(current.targetSide==="player"){ return sideAreaBounds("player"); }
        if(current.targetSide==="monster"&&typeof currentBattleMonsters!=="undefined"){
            const queued=current.side==="player"&&typeof queuedPlayerActions!=="undefined"
                ?queuedPlayerActions&&queuedPlayerActions[current.actorIndex]:null;
            const center=Number.isInteger(current.targetId)
                ?current.targetId
                :(queued&&Number.isInteger(queued.target)?queued.target:indexes[0]);
            const rows=formationRowsForVfx(currentBattleMonsters);
            const row=rows.find(candidate=>candidate.includes(center));
            if(row){
                const layout=fieldBounds(row.map(i=>cardFor("monster",i)).filter(Boolean));
                if(layout){ return layout; }
            }
        }
        return fieldBounds(indexes.map(i=>cardFor(current.targetSide,i)).filter(Boolean));
    }

    function placeSprite(current,node,index,target){
        const sprite=current.model.sprite;
        const placement=String(sprite.placement||"single");
        node.dataset.placement=placement;

        if(placement==="single"){
            const size=clamp(
                Math.max(target.rect.width,target.rect.height)*(Number(sprite.scale)||1.8),
                Number(sprite.minSize)||96,Number(sprite.maxSize)||184
            );
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.style.left=target.x+"px";
            node.style.top=target.y+"px";
            node.style.width=size+"px";
            node.style.height=size+"px";
            return;
        }

        if(placement==="targetTrajectory"){
            const actor=cardCenter(current.actorCard);
            if(!actor){ return; }
            const size=clamp(
                Math.max(target.rect.width,target.rect.height)*(Number(sprite.scale)||1.7),
                Number(sprite.minSize)||140,Number(sprite.maxSize)||240
            );
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.travel="true";
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            node.style.width=size+"px";
            node.style.height=size+"px";
            node.style.setProperty("--v143-sprite-dx",target.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",target.y-actor.y+"px");
            return;
        }

        if(placement==="battlefield"){
            const bounds=sideAreaBounds(current.targetSide);
            if(!bounds){ return; }
            const viewportWidth=Number(window.innerWidth)||960;
            const viewportHeight=Number(window.innerHeight)||720;
            const coverageScale=clamp(Number(sprite.coverageScale)||Number(sprite.scale)||1,1,1.4);
            const width=clamp(
                Math.round(bounds.width*coverageScale),Number(sprite.minWidth)||Number(sprite.minSize)||160,
                Number(sprite.maxWidth)||Math.max(240,viewportWidth*.94)
            );
            const height=clamp(
                Math.round(bounds.height*coverageScale),Number(sprite.minHeight)||Number(sprite.minSize)||160,
                Number(sprite.maxHeight)||Math.max(240,viewportHeight*.92)
            );
            node.dataset.areaId=bounds.id;
            node.dataset.targetIndexes=emittedSpriteTargets(current).join(",");
            if(sprite.fixedFormation){ node.dataset.fixedFormation="true"; }
            node.dataset.coverageScale=String(coverageScale);
            node.style.clipPath="none";
            node.style.left=(bounds.left+bounds.width/2)+"px";
            node.style.top=(bounds.top+bounds.height/2)+"px";
            node.style.width=width+"px";
            node.style.height=height+"px";
            return;
        }

        const indexes=emittedSpriteTargets(current);
        const targetCards=indexes.map(i=>cardFor(current.targetSide,i)).filter(Boolean);
        const targetBounds=sprite.alignToSlots?groupLayoutBounds(current,indexes):fieldBounds(targetCards);
        if(!targetBounds){ return; }
        const coverageCards=placement==="trajectory"&&current.actorCard?[current.actorCard].concat(targetCards):targetCards;
        const coverage=sprite.alignToSlots?targetBounds:(fieldBounds(coverageCards)||targetBounds);
        const naturalSize=(Math.max(coverage.width,coverage.height)+40)*(Number(sprite.scale)||1);
        const viewportWidth=Number(window.innerWidth)||960;
        const viewportHeight=Number(window.innerHeight)||720;
        const dynamicMaximum=Math.max(320,Math.min(1280,Math.max(viewportWidth,viewportHeight)*.96));
        const size=clamp(naturalSize,Number(sprite.minSize)||160,Number(sprite.maxSize)||dynamicMaximum);
        node.dataset.targetIndexes=indexes.join(",");
        node.style.width=size+"px";
        node.style.height=size+"px";
        const destination={
            x:targetBounds.left+targetBounds.width/2,
            y:targetBounds.top+targetBounds.height/2
        };
        const actor=placement==="trajectory"?cardCenter(current.actorCard):null;
        if(placement==="trajectory"&&sprite.travelToTargets&&actor){
            node.dataset.travel="true";
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            node.style.setProperty("--v143-sprite-dx",destination.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",destination.y-actor.y+"px");
            node.style.setProperty("--v143-sprite-angle",Math.atan2(destination.y-actor.y,destination.x-actor.x)*180/Math.PI+"deg");
        }else{
            node.style.left=(Number.isFinite(targetBounds.centerX)?targetBounds.centerX:coverage.left+coverage.width/2)+"px";
            node.style.top=(Number.isFinite(targetBounds.centerY)?targetBounds.centerY:coverage.top+coverage.height/2)+"px";
        }
    }

    function addSprite(current,index,target){
        const sprite=current.model.sprite;
        if(!sprite||!target||!state.stage){ return; }
        const placement=String(sprite.placement||"single");
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        let node=current.spriteNodes.get(key);
        if(!node){
            node=appendSpriteNode(current);
            node.dataset.columns=String(sprite.columns);
            node.dataset.rows=String(sprite.rows);
            node.dataset.frames=String(sprite.frames);
            node.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
            node.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
            node.style.setProperty("--v143-sprite-duration",current.duration+"ms");
            node.style.setProperty(
                "--v143-sprite-delay",
                -Math.min(current.duration,Math.max(0,Date.now()-current.startedAt))+"ms"
            );
            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
            current.spriteNodes.set(key,node);
        }
        placeSprite(current,node,index,target);
        if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }
    }

    function targetHitTime(current,index){
        return Math.min(
            current.startedAt+current.duration-120,
            current.startedAt+current.duration*(Number(current.model.hit)||DEFAULT_HIT)
        );
    }

    function settleTargetVisual(current,index){
        if(state.current!==current||current.done){ return; }
        const card=cardFor(current.targetSide,index);
        if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
        current.hitReached=true;
        syncStatusSpriteEffects();
    }

    function emitSprite(current,index,allowDefeated){
        if(!state.stage||current.emitted.has(index)||!current.validTargets.has(index)){ return; }
        if(!allowDefeated&&!canReceive(current.config,current.targetSide,index)){ return; }
        const targetCard=cardFor(current.targetSide,index);
        const target=cardCenter(targetCard);
        if(!target){ return; }
        current.emitted.add(index);
        if(current.targetIndexes.indexOf(index)<0){ current.targetIndexes.push(index); }
        if(targetCard.classList){ targetCard.classList.add("v143-effects-pending"); }
        if(current.model.sprite){ addSprite(current,index,target); }
        setTimer(()=>settleTargetVisual(current,index),Math.max(0,targetHitTime(current,index)-Date.now()));
    }

    function registerTarget(targetSide,index,allowDefeated){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide){ return null; }
        const single=String(current.config.targetType||"")==="single";
        if(single&&current.targetIndexes.length&&current.targetIndexes.indexOf(index)<0){ return null; }
        if(!current.validTargets.has(index)){ current.validTargets.add(index); }
        emitSprite(current,index,allowDefeated===true);
        return current.emitted.has(index)?current:null;
    }

    function cleanupCurrent(current,reason){
        if(!current||current.done){ return; }
        current.done=true;
        current.targetIndexes.forEach(index=>{
            const card=cardFor(current.targetSide,index);
            if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
        });
        if(state.stage&&state.stage.dataset.sequence===String(current.sequence)&&typeof state.stage.remove==="function"){
            state.stage.remove();
        }
        if(state.current===current){ state.current=null; state.stage=null; }
        syncStatusSpriteEffects();
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
        purgeLegacyCardVfx();

        const model=modelFor(config);
        const targetSide=targetSideFor(config,meta.side||"player");
        const duration=Math.max(520,Number(config.duration)||520);
        const validTargets=new Set(activeCards(targetSide,config).map(entry=>entry.index));
        const mechanismTarget=queuedMechanismTarget(config,meta,targetSide);
        if(mechanismTarget){ validTargets.add(mechanismTarget); }

        const current={
            sequence:++sequence,config:config,model:model,gate:gate,
            side:meta.side||"player",actorIndex:Number.isInteger(meta.actorIndex)?meta.actorIndex:0,
            targetId:meta.targetId!==undefined?meta.targetId:null,
            targetIds:Array.isArray(meta.targetIds)?meta.targetIds.slice():null,
            targetSide:targetSide,targetIndexes:[],emitted:new Set(),validTargets:validTargets,
            spriteNodes:new Map(),deferredStatusTargets:new Map(),statusAtStart:snapshotTimedEffects(),
            actorCard:cardFor(meta.side||"player",Number.isInteger(meta.actorIndex)?meta.actorIndex:0),
            startedAt:Date.now(),duration:duration,hitReached:false,done:false
        };
        current.targetIndexes=initialTargetIndexes(config,current,targetSide);

        const stage=document.createElement("div");
        stage.id="v143-skill-stage";
        stage.className="v143-skill-stage";
        stage.style.visibility="visible";
        stage.dataset.sequence=String(current.sequence);
        stage.dataset.skill=String(config.id||"unknown");
        stage.dataset.element=String(config.element||"normal");
        stage.dataset.renderer="raster-only";
        if(model.missingAsset||model.missingDedicatedAsset){ stage.dataset.missingVisual="true"; }
        document.body.appendChild(stage);

        state.stage=stage;
        state.current=current;
        state.metrics.started++;

        if(
            (Array.isArray(model.deferredStatusTypes)&&model.deferredStatusTypes.length)||
            (Array.isArray(model.deferredActorStatusTypes)&&model.deferredActorStatusTypes.length)
        ){ syncStatusSpriteEffects(); }

        if(model.noVisual||!model.sprite){
            if(!model.passive){ state.metrics.missingVisuals++; }
        }else{
            current.targetIndexes.slice().forEach(index=>emitSprite(current,index));
        }

        setTimer(()=>cleanupCurrent(current,"v143-raster-complete"),Math.max(duration,Number(config.resolveDuration)||duration));
        gate.promise.then(()=>{
            if(state.current===current&&!current.done){ cleanupCurrent(current,gate.reason||"gate-complete"); }
        });
        return current;
    }

    function officialPlay(config,meta){
        const safeMeta=Object.assign({},meta||{},{render:false});
        const gate=originalPlay(config,safeMeta);
        if(state.current&&state.current.gate===gate){ return gate; }
        render(config,Object.assign({side:"player",actorIndex:0},meta||{}),gate);
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
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"dispose"); }
        if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
            document.querySelectorAll("#v143-skill-stage").forEach(node=>node.remove());
        }
        removeStatusSpriteEffects();
        purgeLegacyCardVfx();
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

    window.v143RunAtTargetHit=function(targetSide,index,callback,allowDefeated){
        if(typeof callback!=="function"){ return 0; }
        const wait=delayFor(targetSide,index,allowDefeated===true);
        if(wait>8){ setTimer(callback,wait); }else{ callback(); }
        return wait;
    };

    if(typeof showMonsterHit==="function"){
        const previous=showMonsterHit;
        showMonsterHit=function(index){
            const args=Array.prototype.slice.call(arguments);
            const wait=delayFor("monster",index,true);
            const current=state.current;
            if(current&&!current.done&&current.config.id==="fireCritical"&&current.targetSide==="monster"){ args[3]=true; }
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previous.apply(this,args),wait);
                return;
            }
            return previous.apply(this,args);
        };
    }

    if(typeof showPlayerHit==="function"){
        const previous=showPlayerHit;
        showPlayerHit=function(amount,type,index){
            const args=Array.prototype.slice.call(arguments);
            const wait=delayFor("player",Number(index)||0,true);
            const current=state.current;
            if(current&&!current.done&&current.config.id==="fireCritical"&&current.targetSide==="player"&&!args[3]){ args[4]=true; }
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previous.apply(this,args),wait);
                return;
            }
            return previous.apply(this,args);
        };
    }

    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previous=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index){
            registerTarget("player",Number(index)||0,true);
            return previous.apply(this,arguments);
        };
    }

    if(typeof showMissEffect==="function"){
        const previous=showMissEffect;
        showMissEffect=function(isPlayerTarget,index){
            const args=arguments;
            const wait=delayFor(isPlayerTarget?"player":"monster",index,true);
            if(wait>8){ setTimer(()=>previous.apply(this,args),wait); return; }
            return previous.apply(this,args);
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
            syncStatusSpriteEffects();
            setTimer(syncStatusSpriteEffects,0);
        };
        if(wait>8){ setTimer(invoke,wait); }else{ invoke(); }
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

    if(typeof killMonster==="function"){
        const previous=killMonster;
        killMonster=function(index){
            const args=arguments;
            const wait=existingTargetDelay("monster",index);
            if(wait>8){
                state.metrics.delayedDeaths++;
                setTimer(()=>{
                    const monster=typeof monsters!=="undefined"?monsters[index]:null;
                    if(monster&&monster.hp>0){ return; }
                    previous.apply(this,args);
                },wait);
                return;
            }
            return previous.apply(this,args);
        };
    }

    if(typeof updateMonsterUI==="function"){
        const previous=updateMonsterUI;
        updateMonsterUI=function(index){
            const wait=existingTargetDelay("monster",index);
            if(wait>8){
                const key="monster:"+index;
                if(!state.pendingUpdates.has(key)){
                    const args=arguments;
                    state.pendingUpdates.set(key,true);
                    setTimer(()=>{
                        state.pendingUpdates.delete(key);
                        previous.apply(this,args);
                        syncStatusSpriteEffects();
                        setTimer(syncStatusSpriteEffects,0);
                    },wait);
                }
                return;
            }
            const result=previous.apply(this,arguments);
            syncStatusSpriteEffects();
            setTimer(syncStatusSpriteEffects,0);
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previous=updateUI;
        updateUI=function(){
            const result=previous.apply(this,arguments);
            syncStatusSpriteEffects();
            /* Later wrappers can synchronously recreate V141 legacy layers.
               Purge once more after the complete wrapper stack unwinds. */
            setTimer(syncStatusSpriteEffects,0);
            return result;
        };
    }

    if(typeof updateSingleCharacterStatusBadge==="function"){
        const previous=updateSingleCharacterStatusBadge;
        updateSingleCharacterStatusBadge=function(index){
            const wait=existingTargetDelay("player",index);
            if(wait>8){
                const key="player-status:"+index;
                if(!state.pendingUpdates.has(key)){
                    const args=arguments;
                    state.pendingUpdates.set(key,true);
                    setTimer(()=>{
                        state.pendingUpdates.delete(key);
                        previous.apply(this,args);
                        syncStatusSpriteEffects();
                        setTimer(syncStatusSpriteEffects,0);
                    },wait);
                }
                return;
            }
            const result=previous.apply(this,arguments);
            syncStatusSpriteEffects();
            setTimer(syncStatusSpriteEffects,0);
            return result;
        };
    }

    function wrapBadge(name){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const result=previous.apply(this,arguments);
            if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
                document.querySelectorAll(".skill-name-badge").forEach(badge=>badge.classList.add("v143-caster-skill-label"));
            }
            return result;
        };
    }
    wrapBadge("showSkillNameBadge");
    wrapBadge("showMonsterSkillNameBadge");

    if(typeof document!=="undefined"){
        const boot=function(){ purgeLegacyCardVfx(); syncStatusSpriteEffects(); };
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
            stageNodes:state.stage?state.stage.querySelectorAll("*").length:0
        });
    };
})();
