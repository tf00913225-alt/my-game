/* =====================================================
   V143 — single-owner raster battle VFX runtime
   V174 cleanup: official PNG Sprite Sheets/status loops only.
   Fixed Slot geometry is the only battle position/coverage source.
   No Canvas, SVG, WebGL, shader, particle, glyph or procedural fallback.
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
    const PLACEMENT_SIZE_SCALE=Object.freeze({single:.88,targetTrajectory:.80,trajectory:1,group:1,battlefield:1});
    const spriteFrameAspectCache=new Map();
    const spriteFrameAspectLoading=new Set();

    function castSheet(src,placement,options){
        return Object.assign({
            src:src,columns:4,rows:3,frames:12,hitFrame:7,
            placement:placement||"single",renderer:"dom-sprite"
        },options||{});
    }

    function statusVisual(src,mode,collection,options){
        return Object.assign({
            src:src||"",
            mode:mode||"static",
            collection:collection||"statusEffects",
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
        fireSoulResonance:{hit:DEFAULT_HIT,deferredActorStatusTypes:["fireSoulResonance"],sprite:castSheet("assets/vfx/fire/fire-soul-resonance-cast.webp","single",{scale:1.7,maxSize:225})},
        bloodBurnArt:{hit:DEFAULT_HIT,deferredActorStatusTypes:["bloodBurn"],sprite:castSheet("assets/vfx/fire/blood-burn-art-cast.webp","single",{scale:1.7,maxSize:225})},
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
        purifyMind:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/purify-mind-cast.webp","single",{scale:2.05,maxSize:250})},
        waterEX:{hit:.74,noVisual:true,passive:true},

        stormFist:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/vfx/wind/storm-fist-cast.png?v=173.24","single",{scale:2.15,maxSize:260})},
        stormFlurry:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/storm-flurry-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        windCrossSlash:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/wind-cross-slash-cast.png?v=173.24","single",{scale:2.25,maxSize:280})},
        dizzyFist:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/vfx/wind/dizzy-fist-cast.png?v=173.24","single",{scale:2.35,maxSize:290})},
        windSpell:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/vfx/wind/wind-spell-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stormCircle:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/storm-circle-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        windHowlLightning:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/wind-howl-lightning-cast.png?v=173.24","single",{scale:2.35,maxSize:290})},
        stormRain:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/vfx/wind/storm-rain-cast.png?v=173.24","battlefield",{scale:1.08,minSize:280})},
        dodgeSkill:{hit:.5,deferredStatusTypes:["dodgeSkill"],sprite:castSheet("assets/vfx/wind/dodge-skill-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stealthSkill:{hit:.5,deferredStatusTypes:["stealthSkill"],sprite:castSheet("assets/vfx/wind/stealth-skill-cast.png?v=173.24","single",{scale:2.15,maxSize:260})},
        dinghaishenzhen:{hit:.5,deferredStatusTypes:["dinghaishenzhen"],sprite:castSheet("assets/vfx/wind/dinghaishenzhen-cast.png?v=173.24","battlefield",{scale:1.08,minSize:280})},
        windEX:{hit:.74,noVisual:true,passive:true},
        /* Monster-only legacy derivative: use an existing formal Wind sheet,
           never a generated text/particle fallback. */
        stormSpell:{hit:.5,sprite:castSheet("assets/vfx/wind/storm-rain-cast.png?v=173.24","battlefield",{scale:1.08,minSize:280,reusedFrom:"stormRain"})},
        windArrow:{hit:.5,sprite:castSheet("assets/vfx/wind/wind-spell-cast.png?v=173.24","targetTrajectory",{travelToTargets:true,scale:1.8,minSize:150,maxSize:230,reusedFrom:"windSpell"})},

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

        /* Team Relic VFX — 4x3 / 12-frame lossless WebP sheets.
           These are lazy because only the equipped relic should be prefetched. */
        relic_qiankun_flask:relicSheet("assets/vfx/relic/relic_qiankun_flask.webp",7),
        relic_sun_orb:relicSheet("assets/vfx/relic/relic_sun_orb.webp",7),
        relic_xuanwu_seal:relicSheet("assets/vfx/relic/relic_xuanwu_seal.webp",8),
        relic_soul_bell:relicSheet("assets/vfx/relic/relic_soul_bell.webp",8),
        relic_tiangang_banner:relicSheet("assets/vfx/relic/relic_tiangang_banner.webp",9),
        relic_nine_dragon_fire:relicSheet("assets/vfx/relic/relic_nine_dragon_fire.webp",8),
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

    const RAW_STATUS_VISUALS={
        burn:statusVisual("assets/vfx/status/burn.webp","pulse","statusEffects",{label:"燃燒",statusName:"燃燒",iconSrc:"assets/vfx/status/burn.webp"}),
        rage:statusVisual("assets/vfx/status/rage.webp","pulse","activeBuffs",{label:"怒火",statusName:"怒火",iconSrc:"assets/vfx/status/rage-icon.webp"}),
        frostbite:statusVisual("","icon","statusEffects",{label:"凍傷",statusName:"凍傷",iconSrc:"assets/vfx/status/frostbite-icon.webp"}),
        freeze:statusVisual("assets/vfx/status/freeze.webp","static","statusEffects",{label:"冰封",statusName:"冰封",iconSrc:"assets/vfx/status/freeze.webp"}),
        agilityDown:statusVisual("","icon","statusEffects",{label:"重力",statusName:"重力",iconSrc:"assets/vfx/status/gravity-icon.webp"}),
        damageDown:statusVisual("","icon","statusEffects",{label:"殤風",statusName:"殤風",iconSrc:"assets/vfx/status/damage-down-icon.webp"}),
        stun:statusVisual("assets/vfx/status/stun.webp","pulse","statusEffects",{label:"暈眩",statusName:"暈眩",iconSrc:"assets/vfx/status/stun-icon.webp"}),
        dodgeSkill:statusVisual("assets/vfx/status/windwalk.webp","pulse","activeBuffs",{label:"風行",statusName:"風行",iconSrc:"assets/vfx/status/windwalk.webp"}),
        stealthSkill:statusVisual("assets/vfx/status/stealth.webp","static","activeBuffs",{label:"隱身",statusName:"隱身",iconSrc:"assets/vfx/status/stealth.webp"}),
        dinghaishenzhen:statusVisual("assets/vfx/status/calm-mind.webp","pulse","activeBuffs",{label:"氣定神閒",statusName:"氣定神閒",iconSrc:"assets/vfx/status/calm-mind.webp"}),
        defenseDown:statusVisual("","icon","statusEffects",{label:"破防",statusName:"破防",iconSrc:"assets/vfx/status/defense-down-icon.webp"}),
        shield:statusVisual("assets/vfx/status/shield.webp","static","activeBuffs",{label:"護盾",statusName:"岩盾",iconSrc:"assets/vfx/status/shield.webp"}),
        petrify:statusVisual("assets/vfx/status/petrify.webp","static","statusEffects",{label:"石化",statusName:"石化",iconSrc:"assets/vfx/status/petrify.webp"}),
        earthShield:statusVisual("assets/vfx/status/earth-shield.webp","static","activeBuffs",{label:"萬象土盾",statusName:"萬象土盾",iconSrc:"assets/vfx/status/earth-shield.webp"}),
        rockWall:statusVisual("assets/vfx/status/rock-wall.webp","static","activeBuffs",{label:"岩石壁壘",statusName:"岩石壁壘",iconSrc:"assets/vfx/status/rock-wall.webp"}),
        barrier:statusVisual("assets/vfx/status/barrier.webp","static","activeBuffs",{label:"結界",statusName:"結界",iconSrc:"assets/vfx/status/barrier.webp"}),
        yuanZuBlessing:statusVisual("assets/vfx/status/yuan-zu-blessing.webp","pulse","activeBuffs",{label:"元祖賜福",statusName:"元祖賜福",iconSrc:"assets/vfx/status/yuan-zu-blessing.webp"}),
        fireMomentum:statusVisual("","icon","activeBuffs",{label:"炎勢",statusName:"炎勢",iconSrc:"assets/vfx/status/fire-momentum-icon.webp"}),
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
        return true;
    };

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
        const targetType=String(current.config&&current.config.targetType||"single");
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

    function placementFor(config,sprite){
        const authored=String(sprite&&sprite.placement||"single");
        const targetType=String(config&&config.targetType||"single");
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
        node.className="v143-status-visual v143-status-visual-"+type+" v143-status-visual--"+spec.mode;
        node.dataset.statusType=type;
        node.dataset.statusMode=spec.mode;
        node.dataset.renderer="dom-status-visual";
        if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
        node.style.backgroundImage='url("'+String(spec.src).replace(/"/g,"%22")+'")';
        node.style.backgroundSize="contain";
        node.style.backgroundPosition="center";
        return node;
    }

    function createStatusIcon(type,spec){
        const node=document.createElement("i");
        node.className="v143-status-icon v143-status-icon-"+type;
        node.dataset.statusType=type;
        node.dataset.statusMode="icon";
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

    function syncStatusVisual(side,index,type,showBody){
        const spec=STATUS_VISUALS[type];
        const card=cardFor(side,index);
        const entity=entityFor(side,index);
        const alive=!!(spec&&card&&entity&&Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false));
        const active=alive&&hasTimedEffect(entity,type);
        if(!active||deferredStatusDuringCast(side,index,type)){
            removeStatusVisual(card,side,index,type);
            return;
        }

        const host=statusIconHost(side,index,card);
        const existingIcon=statusIconNode(host,type);
        if(spec.mode==="icon"){
            if(host&&!existingIcon){ host.appendChild(createStatusIcon(type,spec)); }
        }else if(existingIcon){
            if(typeof existingIcon.remove==="function"){ existingIcon.remove(); }
            else if(existingIcon.parentNode){ existingIcon.parentNode.removeChild(existingIcon); }
        }

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

        const anchor=slotAnchor(side,index,card);
        if(!anchor){ return; }
        const cardRect=typeof card.getBoundingClientRect==="function"?card.getBoundingClientRect():anchor.rect;
        const regularEnemy=side==="monster"&&!isBossIndexForVfx(index);
        const width=regularEnemy
            ?Math.max(60,Math.min(anchor.rect.width*1.20,cardRect.width*1.20))
            :Math.max(44,Math.min(anchor.rect.width*1.16,cardRect.width*1.16));
        const height=regularEnemy
            ?Math.max(58,Math.min(anchor.rect.height*1.16,cardRect.height*1.16))
            :Math.max(52,Math.min(anchor.rect.height*1.14,cardRect.height*1.14));
        node.dataset.slot=anchor.slot;
        node.style.width=Math.round(width)+"px";
        node.style.height=Math.round(height)+"px";
    }

    function syncStatusVisualsForUnit(side,index,advanceRotation){
        const entity=entityFor(side,index);
        const bodyTypes=entity?Object.keys(RAW_STATUS_VISUALS).filter(type=>{
            const spec=RAW_STATUS_VISUALS[type];
            return !!(
                spec&&spec.mode!=="icon"&&spec.src&&
                hasTimedEffect(entity,type)&&
                !deferredStatusDuringCast(side,index,type)
            );
        }):[];
        const rotationKey=side+":"+index;
        const signature=bodyTypes.join("|");
        let rotation=statusRotationByUnit.get(rotationKey);
        if(!bodyTypes.length){
            statusRotationByUnit.delete(rotationKey);
            rotation=null;
        }else if(!rotation||rotation.signature!==signature){
            rotation={signature:signature,index:0};
            statusRotationByUnit.set(rotationKey,rotation);
        }else if(advanceRotation===true&&bodyTypes.length>1){
            rotation.index=(rotation.index+1)%bodyTypes.length;
        }
        const activeBodyType=rotation&&bodyTypes.length
            ?bodyTypes[rotation.index%bodyTypes.length]
            :null;
        Object.keys(RAW_STATUS_VISUALS).forEach(type=>
            syncStatusVisual(side,index,type,type===activeBodyType)
        );
    }

    function syncStatusVisualEffects(advanceRotation){
        purgeLegacyCardVfx();
        const enemyIndexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters.filter(Number.isInteger):[];
        enemyIndexes.forEach(index=>syncStatusVisualsForUnit("monster",index,advanceRotation===true));
        for(let index=0;index<6;index++){ syncStatusVisualsForUnit("player",index,advanceRotation===true); }
    }

    function removeStatusVisualEffects(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        [".v143-status-visual",".v143-status-icon"].forEach(selector=>
            document.querySelectorAll(selector).forEach(node=>node.remove())
        );
        statusRotationByUnit.clear();
    }
    window.v143SyncStatusVisualEffects=syncStatusVisualEffects;

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
        if(type==="frostbite"){ return "無法使用技能"; }
        if(type==="freeze"){ return "無法行動"; }
        if(type==="agilityDown"){ return "敏捷降低 "+value+"%"; }
        if(type==="damageDown"){ return "造成傷害降低 "+value+"%"; }
        if(type==="stun"){ return "最終命中率降低 "+value+"%"; }
        if(type==="dodgeSkill"){
            const percent=statusPercent(entry,"percent","bonusPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.dodgeSkill&&skillDatabase.dodgeSkill.evasionBonusPercent)||0;
            return "閃躲率提升 "+percent+"%";
        }
        if(type==="stealthSkill"){ return "無法被單體技能選中，仍會受到範圍技能"; }
        if(type==="dinghaishenzhen"){
            const resist=statusPercent(entry,"resistBonus","amount")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.dinghaishenzhen&&skillDatabase.dinghaishenzhen.statusResistBonus)||0;
            const accuracy=Number(entry&&entry.accuracyBonusPercent)||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.dinghaishenzhen&&skillDatabase.dinghaishenzhen.accuracyBonusPercent)||0;
            const parts=[];
            if(resist){ parts.push("異常狀態抗性 +"+resist+"%"); }
            if(accuracy){ parts.push("命中率 +"+accuracy+"%"); }
            return parts.join("、")||"異常狀態抗性提升";
        }
        if(type==="defenseDown"){ return "防禦降低 "+value+"%"; }
        if(type==="shield"){
            const remaining=Math.max(0,Number(entry&&entry.remaining)||0);
            return remaining?"吸收傷害，剩餘護盾 "+Math.round(remaining):"吸收傷害";
        }
        if(type==="petrify"){ return "無法行動"; }
        if(type==="earthShield"){
            const percent=statusPercent(entry,"percent","reflectPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.earthShield&&skillDatabase.earthShield.reflectPercent)||0;
            return "反彈受到傷害的 "+percent+"%";
        }
        if(type==="rockWall"){
            const percent=statusPercent(entry,"percent","defenseBonusPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.rockWall&&skillDatabase.rockWall.defenseBonusPercent)||0;
            return "防禦提升 "+percent+"%";
        }
        if(type==="barrier"){
            const blocks=Math.max(0,Number(entry&&entry.remainingBlocks)||0);
            return blocks?"完全抵擋傷害，剩餘 "+blocks+" 次":"完全抵擋傷害";
        }
        if(type==="yuanZuBlessing"){
            const percent=statusPercent(entry,"bonusPercent","evasionBonusPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.yuanZuBlessing&&skillDatabase.yuanZuBlessing.evasionBonusPercent)||0;
            return "閃躲率提升 "+percent+"%";
        }
        if(type==="fireMomentum"){
            const percent=Number(entry&&entry.bonusPercent)||0;
            return "下一次主動火系直接傷害提升 "+percent+"%";
        }
        if(type==="phoenixMight"){
            const percent=Number(entry&&entry.bonusPercent)||0;
            return "下一回合造成的所有傷害提升 "+percent+"%";
        }
        if(type==="fireSoulResonance"){
            const level=Math.max(1,Math.min(5,Number(entry&&entry.skillLevel)||1));
            const values=typeof skillDatabase!=="undefined"&&skillDatabase.fireSoulResonance&&skillDatabase.fireSoulResonance.momentumBonusByLevel;
            const percent=Array.isArray(values)?Number(values[level-1])||0:0;
            return "火系技能爆擊或新增燃燒時獲得炎勢"+(percent?"（傷害 +"+percent+"%）":"");
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
            if(types.indexOf(type)>=0){
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
        if(wait>8){ setTimer(invoke,wait); } else{ invoke(); }
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
        const node=document.createElement("i");
        node.className="v143-vfx-sprite";
        node.dataset.skill=current.config.id||"unknown";
        node.dataset.targetSide=current.targetSide;
        node.dataset.renderer="dom-sprite";
        node.dataset.confirmedHit="false";
        node.dataset.geometryOwner="fixed-slot";
        node.style.visibility="hidden";
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

    function placeSprite(current,node,index,target){
        const sprite=current.model.sprite;
        const placement=placementFor(current.config,sprite);
        node.dataset.placement=placement;

        if(placement==="single"){
            const size=authoredSquareSize(sprite,target.rect,{scale:1.8,min:96,max:184,minRatio:1.18,maxRatio:1.68});
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.geometrySlot=target.slot;
            node.style.left=target.x+"px";
            node.style.top=target.y+"px";
            applySpriteBox(node,size,size,sprite);
            return;
        }

        if(placement==="targetTrajectory"){
            const actor=slotAnchor(current.side,current.actorIndex,current.actorCard);
            if(!actor){ return; }
            const size=authoredSquareSize(sprite,target.rect,{scale:1.7,min:140,max:240,minRatio:1.12,maxRatio:1.56});
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.geometrySlot=target.slot;
            node.dataset.travel="true";
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            applySpriteBox(node,size,size,sprite);
            node.style.setProperty("--v143-sprite-dx",target.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",target.y-actor.y+"px");
            node.style.setProperty("--v143-sprite-angle",Math.atan2(target.y-actor.y,target.x-actor.x)*180/Math.PI+"deg");
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
            return;
        }

        /* Group/row/tri/trajectory size is derived from the fixed geometry shape,
           never from the number or outer bounds of surviving target cards. */
        const width=Math.max(1,Math.round(bounds.width));
        const height=Math.max(1,Math.round(bounds.height));
        node.dataset.targetIndexes=indexes.join(",");
        applySpriteBox(node,width,height,sprite,"cover");
        /* A group/row/tri Sprite keeps the fixed-shape bounds for sizing, but
           its visual center belongs to the explicitly selected primary card.
           Only full-battlefield effects remain centered on the whole side. */
        const destination=bounds.centerOnBounds&&placement!=="trajectory"
            ?{x:bounds.centerX,y:bounds.centerY}
            :primaryAnchor
            ?{x:primaryAnchor.x,y:primaryAnchor.y}
            :{x:bounds.centerX,y:bounds.centerY};
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

    function addSprite(current,index,target){
        const sprite=current.model.sprite;
        if(!sprite||!target||!state.stage){ return; }
        const placement=placementFor(current.config,sprite);
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        let node=current.spriteNodes.get(key);
        if(!node){
            const initialSprite=!current.firstVisibleFrameAt;
            if(initialSprite){ beginVisualTimeline(current); }
            node=appendSpriteNode(current);
            node.dataset.columns=String(sprite.columns);
            node.dataset.rows=String(sprite.rows);
            node.dataset.frames=String(sprite.frames);
            node.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
            node.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
            node.style.setProperty("--v143-sprite-duration",current.duration+"ms");
            /* The first normal cast always begins at Frame 1. A later sprite
               for a separately delayed target may catch up to the visual
               timeline, but it must never rewrite the initial cast. */
            node.dataset.emission=initialSprite?"initial":"late";
            node.style.setProperty("--v143-sprite-delay",initialSprite
                ?"0ms"
                :-Math.min(current.duration,Math.max(0,Date.now()-(current.visualStartedAt||current.startedAt)))+"ms"
            );
            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
            current.spriteNodes.set(key,node);
        }
        placeSprite(current,node,index,target);
        requestSpriteAspect(sprite,current,node,index,target);
        /* A formal cast Sprite represents the attempted skill, not only a landed hit.
           Reveal it as soon as the official owner has a real fixed-slot position.
           Outcome confirmation still marks the node and controls hit feedback, but
           MISS/status/custom Boss paths must not make the cast animation disappear. */
        if(node.style.left&&node.style.top){
            node.style.visibility="visible";
            node.dataset.emittedVisual="true";
        }
        if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }
    }

    function confirmTargetVisual(current,index){
        if(!current||current.done||!current.model||!current.model.sprite){ return; }
        current.confirmedTargets.add(index);
        const placement=placementFor(current.config,current.model.sprite);
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        const node=current.spriteNodes.get(key);
        if(node){ node.dataset.confirmedHit="true"; node.style.visibility="visible"; }
    }

    function targetHitTime(current,index){
        const visualStartedAt=current.visualStartedAt||current.startedAt;
        return Math.min(
            visualStartedAt+current.duration-120,
            visualStartedAt+current.duration*(Number(current.model.hit)||DEFAULT_HIT)
        );
    }

    function beginVisualTimeline(current){
        if(!current||current.firstVisibleFrameAt){ return false; }
        current.firstVisibleFrameAt=Date.now();
        current.visualStartedAt=current.firstVisibleFrameAt;
        if(current.gate&&typeof current.gate.restartVisualTimeline==="function"){
            current.gate.restartVisualTimeline(current.duration);
        }
        current.cleanupTimer=setTimer(
            ()=>cleanupCurrent(current,"v143-raster-complete"),
            current.duration
        );
        return true;
    }

    function settleTargetVisual(current,index){
        if(state.current!==current||current.done){ return; }
        const card=cardFor(current.targetSide,index);
        if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
        current.hitReached=true;
        syncStatusVisualsForUnit(current.targetSide,index);
    }

    function emitSprite(current,index,allowDefeated){
        if(!state.stage||current.emitted.has(index)||!current.validTargets.has(index)){ return; }
        if(!allowDefeated&&!canReceive(current.config,current.targetSide,index)){ return; }
        const targetCard=cardFor(current.targetSide,index);
        const target=slotAnchor(current.targetSide,index,targetCard);
        if(!target){ return; }
        current.emitted.add(index);
        if(current.targetIndexes.indexOf(index)<0){ current.targetIndexes.push(index); }
        if(targetCard&&targetCard.classList){ targetCard.classList.add("v143-effects-pending"); }
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
        syncStatusVisualEffects();
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
        purgeStaleRasterStages();

        const model=modelFor(config);
        const contractedSide=meta&&meta.targetContract&&meta.targetContract.version==="battle-target-contract-v1"
            ?meta.targetContract.targetSide:meta&&meta.targetSide;
        const targetSide=contractedSide==="player"||contractedSide==="monster"
            ?contractedSide:targetSideFor(config,meta.side||"player");
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
            side:meta.side||"player",actorIndex:Number.isInteger(meta.actorIndex)?meta.actorIndex:0,
            targetId:meta.targetId!==undefined?meta.targetId:null,
            targetIds:Array.isArray(meta.targetIds)?meta.targetIds.slice():null,
            targetSide:targetSide,targetIndexes:[],emitted:new Set(),validTargets:validTargets,
            spriteNodes:new Map(),confirmedTargets:new Set(),deferredStatusTargets:new Map(),statusAtStart:snapshotTimedEffects(model),
            actorCard:cardFor(meta.side||"player",Number.isInteger(meta.actorIndex)?meta.actorIndex:0),
            startedAt:Date.now(),visualStartedAt:0,firstVisibleFrameAt:0,
            duration:duration,hitReached:false,done:false,cleanupTimer:0
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
        stage.dataset.geometryOwner="fixed-slot";
        if(model.missingAsset||model.missingDedicatedAsset){ stage.dataset.missingVisual="true"; }
        document.body.appendChild(stage);

        state.stage=stage;
        state.current=current;
        state.metrics.started++;

        if(
            (Array.isArray(model.deferredStatusTypes)&&model.deferredStatusTypes.length)||
            (Array.isArray(model.deferredActorStatusTypes)&&model.deferredActorStatusTypes.length)
        ){ syncStatusVisualEffects(); }

        if(model.noVisual||!model.sprite){
            if(!model.passive){ state.metrics.missingVisuals++; }
        }else{
            current.targetIndexes.slice().forEach(index=>emitSprite(current,index));
        }

        if(model.noVisual||!model.sprite){
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
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"dispose"); }
        if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
            document.querySelectorAll("#v143-skill-stage").forEach(node=>node.remove());
        }
        removeStatusVisualEffects();
        purgeLegacyCardVfx();
        return originalDispose();
    };

    function delayFor(targetSide,index,allowDefeated){
        const current=registerTarget(targetSide,index,allowDefeated);
        if(!current){ return 0; }
        confirmTargetVisual(current,index);
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
        showMissEffect=function(isPlayerTarget,index,label){
            const args=Array.prototype.slice.call(arguments);
            const targetSide=isPlayerTarget?"player":"monster";
            /* MISS is still an attempted cast. Register the resolved target through
               the same formal V143 path so late-known monster/Boss targets get
               their real Sprite Sheet while the MISS popup keeps hit timing. */
            const wait=delayFor(targetSide,index,true);
            const invoke=()=>{
                const result=previous.apply(this,args);
                const card=cardFor(targetSide,index);
                if(card&&typeof card.querySelectorAll==="function"&&typeof document!=="undefined"&&document.body){
                    const popups=card.querySelectorAll(":scope > .damage-popup.miss-popup");
                    const popup=popups.length?popups[popups.length-1]:null;
                    const rect=popup&&card.getBoundingClientRect?card.getBoundingClientRect():null;
                    if(popup&&rect){
                        popup.classList.add("v152-top-damage");
                        popup.style.setProperty("left",(rect.left+rect.width/2)+"px","important");
                        popup.style.setProperty("top",(rect.top+rect.height*.26)+"px","important");
                        document.body.appendChild(popup);
                    }
                }
                return result;
            };
            if(wait>8){ setTimer(invoke,wait); return; }
            return invoke();
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
                        syncStatusVisualsForUnit("monster",Number(index));
                    },wait);
                }
                return;
            }
            const result=previous.apply(this,arguments);
            syncStatusVisualsForUnit("monster",Number(index));
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
                        syncStatusVisualsForUnit("player",Number(index));
                    },wait);
                }
                return;
            }
            const result=previous.apply(this,arguments);
            syncStatusVisualsForUnit("player",Number(index));
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