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

        flameSlash:{
            glyph:"╱",motion:"arc-up",impact:"flame-cut",hit:.5833333333,pulses:1,spread:0,
            sprite:{
                src:"assets/vfx/fire/flame-slash-cast.png",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:1.85,maxSize:220
            }
        },
        fireCritical:{
            glyph:"拳",motion:"dash",impact:"ember-fist",hit:.5833333333,pulses:2,spread:0,
            sprite:{
                src:"assets/vfx/fire/fire-critical-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.15,maxSize:260
            }
        },
        explosiveFlurry:{
            glyph:"拳",motion:"zigzag",impact:"fire-combo",hit:.5833333333,pulses:4,spread:54,
            sprite:{
                src:"assets/vfx/fire/explosive-flurry-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"group",scale:1.08,minSize:190
            }
        },
        dragonSlash:{
            glyph:"龍",motion:"serpent",impact:"dragon-cleave",hit:.5833333333,pulses:3,spread:92,flightCount:2,
            sprite:{
                src:"assets/vfx/fire/dragon-slash-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.35,maxSize:300
            }
        },
        fireRocket:{
            glyph:"➶",motion:"arc-down",impact:"arrow-burst",hit:.5833333333,pulses:1,spread:42,
            sprite:{
                src:"assets/vfx/fire/fire-rocket-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"trajectory",travelToTargets:true,
                scale:.72,minSize:180,maxSize:280
            }
        },
        blazeSpell:{
            glyph:"火",motion:"orb",impact:"flame-bloom",hit:.5833333333,pulses:2,spread:30,
            sprite:{
                src:"assets/vfx/fire/blaze-spell-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.15,maxSize:260
            }
        },
        flameTornado:{
            glyph:"炎",motion:"spiral",impact:"fire-tornado",hit:.5833333333,pulses:5,spread:82,flightCount:3,
            sprite:{
                src:"assets/vfx/fire/flame-tornado-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.35,maxSize:300
            }
        },
        phoenixCry:{
            glyph:"鳳",motion:"swoop",impact:"phoenix-field",hit:.5833333333,pulses:6,spread:112,flightCount:2,
            sprite:{
                src:"assets/vfx/fire/phoenix-cry-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"battlefield",scale:1.12,minSize:280
            }
        },
        rage:{
            glyph:"怒",motion:"rise",impact:"rage-aura",hit:.5833333333,pulses:3,spread:55,
            sprite:{
                src:"assets/vfx/fire/rage-cast.png?v=165",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:1.08,minSize:96,maxSize:148
            }
        },
        fireEX:{glyph:"焰",motion:"orbit",impact:"fire-crown",hit:.74,pulses:7,spread:95},

        waterKnife:{
            glyph:"刃",motion:"wave",impact:"water-cut",hit:.5833333333,pulses:1,spread:0,
            sprite:{
                src:"assets/vfx/water/water-blade-slash-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.05,maxSize:250
            }
        },
        frostPunch:{
            glyph:"拳",motion:"dash",impact:"ice-fist",hit:.5833333333,pulses:2,spread:18,
            sprite:{
                src:"assets/vfx/water/frost-fist-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.15,maxSize:260
            }
        },
        iceSpin:{
            glyph:"輪",motion:"spin",impact:"ice-wheel",hit:.5833333333,pulses:3,spread:42,
            deferredStatusTypes:["frostbite"],
            sprite:{
                src:"assets/vfx/water/frost-spinning-slash-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:1.95,maxSize:235
            }
        },
        frostCrush:{
            glyph:"槌",motion:"drop",impact:"ice-crush",hit:.5833333333,pulses:4,spread:58,
            deferredStatusTypes:["frostbite"],
            sprite:{
                src:"assets/vfx/water/freeze-heavy-strike-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.35,maxSize:290
            }
        },
        waterBall:{
            glyph:"●",motion:"wave",impact:"water-splash",hit:.5833333333,pulses:1,spread:34,
            sprite:{
                src:"assets/vfx/water/water-orb-vfx.png?v=173.19",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",scale:1.22,minSize:150,maxSize:500
            }
        },
        floodBeast:{
            glyph:"獸",motion:"surge",impact:"flood-jaw",hit:.5833333333,pulses:4,spread:66,
            deferredStatusTypes:["frostbite"],
            sprite:{
                src:"assets/vfx/water/tidal-beast-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"targetTrajectory",travelToTargets:true,
                scale:1.85,minSize:175,maxSize:250
            }
        },
        iceArrowRain:{
            glyph:"➶",motion:"rain",impact:"ice-rain",hit:.5833333333,
            pulses:7,spread:104,flightCount:7,deferredStatusTypes:["frostbite"],
            sprite:{
                src:"assets/vfx/water/frost-arrow-rain-vfx.png?v=173.19",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"battlefield",renderer:"canvas-crop",fixedFormation:true,coverageScale:1.22,
                minWidth:140,minHeight:140
            }
        },
        freeze:{
            glyph:"晶",motion:"crystal",impact:"ice-prison",hit:.5833333333,pulses:3,spread:48,
            deferredStatusTypes:["freeze"],
            sprite:{
                src:"assets/vfx/water/freeze-cast-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.2,maxSize:270
            }
        },
        healSpell:{
            glyph:"癒",motion:"rise",impact:"healing-spring",hit:.5833333333,pulses:3,spread:46,
            sprite:{
                src:"assets/vfx/water/water-heal-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.05,maxSize:250
            }
        },
        revive:{
            glyph:"生",motion:"ascend",impact:"revive-pillar",hit:.5833333333,pulses:5,spread:70,
            sprite:{
                src:"assets/vfx/water/water-revive-vfx.png?v=166",
                columns:4,rows:3,frames:12,hitFrame:7,placement:"single",scale:2.3,maxSize:285
            }
        },
        waterEX:{glyph:"泉",motion:"orbit-reverse",impact:"tidal-crown",hit:.74,pulses:7,spread:95},

        stormFist:{
            glyph:"拳",motion:"dash",impact:"wind-fist",hit:.5,pulses:1,spread:0,
            deferredStatusTypes:["agilityDown"],
            sprite:{
                src:"assets/inbox/暴風拳-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.15,maxSize:260
            }
        },
        stormFlurry:{
            glyph:"迅",motion:"afterimage",impact:"wind-combo",hit:.5,pulses:4,spread:48,
            deferredStatusTypes:["damageDown"],
            sprite:{
                src:"assets/inbox/暴風亂擊-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        windCrossSlash:{
            glyph:"十",motion:"cross",impact:"cross-gale",hit:.5,pulses:2,spread:58,
            deferredStatusTypes:["damageDown"],
            sprite:{
                src:"assets/inbox/風旋十字斬-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.25,maxSize:280
            }
        },
        dizzyFist:{
            glyph:"雷",motion:"blink",impact:"thunder-fist",hit:.5,pulses:4,spread:62,
            deferredStatusTypes:["stun"],
            sprite:{
                src:"assets/inbox/暈眩猛擊-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.35,maxSize:290
            }
        },
        windSpell:{
            glyph:"➤",motion:"curve",impact:"wind-blade",hit:.5,pulses:1,spread:30,
            deferredStatusTypes:["agilityDown"],
            sprite:{
                src:"assets/inbox/狂風術-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        stormCircle:{
            glyph:"旋",motion:"spiral",impact:"gale-ring",hit:.5,pulses:3,spread:56,
            deferredStatusTypes:["damageDown"],
            sprite:{
                src:"assets/inbox/風焰術-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        windHowlLightning:{
            glyph:"⚡",motion:"bolt",impact:"lightning-fang",hit:.5,pulses:4,spread:62,
            deferredStatusTypes:["damageDown"],
            sprite:{
                src:"assets/inbox/風哮電擊-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.35,maxSize:290
            }
        },
        stormRain:{
            glyph:"風",sequence:"風起雲湧",motion:"tempest",impact:"storm-domain",hit:.5,pulses:7,spread:110,flightCount:4,
            deferredStatusTypes:["stun"],
            sprite:{
                src:"assets/inbox/風起雲湧-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"battlefield",renderer:"canvas-crop",naturalGrid:true,scale:1.08,minSize:280
            }
        },
        dodgeSkill:{
            glyph:"疾",motion:"afterimage",impact:"speed-aura",hit:.5,pulses:3,spread:50,
            deferredStatusTypes:["dodgeSkill"],
            sprite:{
                src:"assets/inbox/閃躲術-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        stealthSkill:{
            glyph:"隱",motion:"veil",impact:"vanish-mist",hit:.5,pulses:3,spread:52,
            deferredStatusTypes:["stealthSkill"],
            sprite:{
                src:"assets/inbox/隱身術-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.15,maxSize:260
            }
        },
        dinghaishenzhen:{
            glyph:"定",motion:"orbit",impact:"calm-seal",hit:.5,pulses:5,spread:72,
            deferredStatusTypes:["dinghaishenzhen"],
            sprite:{
                src:"assets/inbox/氣定神閒-技能動態圖.png?v=173.24",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"battlefield",renderer:"canvas-crop",naturalGrid:true,scale:1.08,minSize:280
            }
        },
        windEX:{glyph:"嵐",motion:"orbit-fast",impact:"wind-crown",hit:.74,pulses:7,spread:95},
        stormSpell:{glyph:"暴",motion:"tempest",impact:"storm-eye",hit:.72,pulses:6,spread:86},

        stoneSlash:{
            glyph:"斬",motion:"heavy-arc",impact:"stone-cut",hit:.5,pulses:1,spread:0,
            deferredStatusTypes:["defenseDown"],
            sprite:{
                src:"assets/vfx/earth/stone-slash-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.2,maxSize:270
            }
        },
        petrifyFist:{
            glyph:"岩",motion:"dash",impact:"petrify-fist",hit:.5,pulses:2,spread:28,
            deferredActorStatusTypes:["shield"],
            sprite:{
                src:"assets/vfx/earth/petrify-fist-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        stoneBreakSky:{
            glyph:"柱",motion:"erupt",impact:"stone-pillar",hit:.5,pulses:4,spread:78,
            deferredActorStatusTypes:["shield"],
            sprite:{
                src:"assets/vfx/earth/stone-break-sky-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.35,maxSize:290
            }
        },
        earthquakeCrush:{
            glyph:"裂",motion:"ground",impact:"earth-rift",hit:.5,pulses:6,spread:92,
            deferredStatusTypes:["petrify"],
            sprite:{
                src:"assets/vfx/earth/earthquake-crush-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        stoneThrow:{
            glyph:"◆",motion:"lob",impact:"rock-shatter",hit:.5,pulses:2,spread:42,
            deferredStatusTypes:["defenseDown"],
            sprite:{
                src:"assets/vfx/earth/stone-throw-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        sandWind:{
            glyph:"石",sequence:"滾石",motion:"swirl",impact:"sand-cloud",hit:.5,pulses:4,spread:72,
            deferredStatusTypes:["defenseDown"],
            sprite:{
                src:"assets/vfx/earth/sand-wind-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,preserveSourceAspect:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        flyingSandStrike:{
            glyph:"沙",sequence:"飛沙",motion:"burrow",impact:"petrify-spike",hit:.5,pulses:5,spread:88,
            deferredStatusTypes:["defenseDown"],
            sprite:{
                src:"assets/vfx/earth/flying-sand-strike-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"battlefield",renderer:"canvas-crop",naturalGrid:true,scale:1.08,minSize:280
            }
        },
        dustStorm:{
            glyph:"裂",sequence:"地牛猛襲",motion:"ground-wave",impact:"dust-quake",hit:.5,pulses:7,spread:112,
            deferredStatusTypes:["petrify"],
            sprite:{
                src:"assets/vfx/earth/dust-storm-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.4,maxSize:300
            }
        },
        earthShield:{
            glyph:"象",motion:"corner",impact:"four-earth-aura",hit:.5,pulses:4,spread:55,
            deferredStatusTypes:["earthShield"],
            sprite:{
                src:"assets/vfx/earth/earth-shield-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        rockWall:{
            glyph:"壁",motion:"erupt",impact:"rock-wall",hit:.5,pulses:4,spread:60,
            deferredStatusTypes:["rockWall"],
            sprite:{
                src:"assets/vfx/earth/rock-wall-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"group",renderer:"canvas-crop",naturalGrid:true,alignToSlots:true,scale:1.08,minSize:190
            }
        },
        barrier:{
            glyph:"界",motion:"seal",impact:"barrier-dome",hit:.5,pulses:5,spread:72,
            deferredStatusTypes:["barrier"],
            sprite:{
                src:"assets/vfx/earth/barrier-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"single",renderer:"canvas-crop",naturalGrid:true,scale:2.25,maxSize:280
            }
        },
        earthEX:{glyph:"岳",motion:"orbit-heavy",impact:"earth-crown",hit:.74,pulses:7,spread:95},

        yuanXiangGuangMing:{glyph:"光",motion:"ascend",impact:"holy-rain",hit:.66,pulses:6,spread:82},
        yuanGuangShield:{glyph:"護",motion:"seal",impact:"holy-dome",hit:.63,pulses:5,spread:70},
        yuanZuBlessing:{
            glyph:"賜",motion:"orbit",impact:"holy-blessing",hit:.5,pulses:7,spread:90,
            deferredStatusTypes:["yuanZuBlessing"],
            sprite:{
                src:"assets/vfx/light/yuan-zu-blessing-cast.png?v=173.39",
                columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,
                placement:"battlefield",renderer:"canvas-crop",naturalGrid:true,scale:1.08,minSize:280
            }
        },
        windArrow:{glyph:"➳",motion:"curve",impact:"wind-arrow",hit:.61,pulses:1,spread:18}
    };

    function hashString(value){
        let hash=2166136261;
        String(value||"").split("").forEach(char=>{ hash^=char.charCodeAt(0); hash=Math.imul(hash,16777619); });
        return hash>>>0;
    }

    function modelFor(config){
        const known=MANIFEST[config.id];
        if(known){
            const model=Object.assign({signature:config.id},known);
            if(config.id==="fireRocket"&&model.sprite&&typeof Image==="function"){
                const record=getSpriteImage(model.sprite.src);
                if(!record||record.failed||!record.ready){ model.sprite=null; }
            }
            return model;
        }
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

    const STATUS_SPRITES={
        burn:{src:"assets/vfx/fire/burn-loop.png?v=165",columns:4,rows:2,frames:8,duration:800,collection:"statusEffects"},
        rage:{src:"assets/vfx/fire/rage-buff-loop.png?v=165",columns:4,rows:2,frames:8,duration:1000,collection:"activeBuffs"},
        frostbite:{src:"assets/vfx/water/frostbite-status-loop-vfx.png?v=166",columns:4,rows:2,frames:8,duration:1000,collection:"statusEffects",scale:1.22},
        freeze:{src:"assets/vfx/water/frozen-status-loop-vfx.png?v=166",columns:4,rows:2,frames:8,duration:1100,collection:"statusEffects",scale:1.28},
        agilityDown:{src:"assets/inbox/重力-狀態循環圖.png?v=173.24",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1000,collection:"statusEffects"},
        damageDown:{src:"assets/inbox/殤風-狀態循環圖.png?v=173.24",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1100,collection:"statusEffects"},
        stun:{src:"assets/inbox/暈眩-狀態循環圖.png?v=173.24",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:900,collection:"statusEffects"},
        dodgeSkill:{src:"assets/inbox/風行-狀態循環圖.png?v=173.24",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:850,collection:"activeBuffs"},
        stealthSkill:{src:"assets/inbox/隱身-狀態循環圖.png?v=173.24",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1200,collection:"activeBuffs"},
        dinghaishenzhen:{src:"assets/inbox/氣定神閒-狀態循環圖.png?v=173.24",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1200,collection:"activeBuffs"},
        defenseDown:{src:"assets/vfx/earth/defense-down-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1100,collection:"statusEffects"},
        shield:{src:"assets/vfx/earth/rock-shield-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1200,collection:"activeBuffs",scale:1.22},
        petrify:{src:"assets/vfx/earth/petrify-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1300,collection:"statusEffects",scale:1.22},
        earthShield:{src:"assets/vfx/earth/earth-shield-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1000,collection:"activeBuffs",scale:1.20},
        rockWall:{src:"assets/vfx/earth/rock-wall-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1400,collection:"activeBuffs",scale:1.20},
        barrier:{src:"assets/vfx/earth/barrier-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1200,collection:"activeBuffs",scale:1.24,cellAspect:.75},
        yuanZuBlessing:{src:"assets/vfx/light/yuan-zu-blessing-loop.png?v=173.39",columns:4,rows:2,frames:8,frameWidth:256,frameHeight:256,duration:1200,collection:"activeBuffs",statusName:"元祖賜福",scale:1.18}
    };

    window.v143SkillAnimationManifest=MANIFEST;
    window.v143StatusSpriteManifest=STATUS_SPRITES;
    window.v143GetSkillAnimationModel=function(skillId){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        return modelFor({id:skillId,name:skill&&skill.name||skillId});
    };

    /*
       Shared image cache for the existing Sprite renderer. Water Ball and
       Ice Arrow Rain use the same VFX lifecycle but draw one fixed source
       cell on a canvas instead of exposing a CSS background sheet.
    */
    const spriteImageCache=new Map();
    function getSpriteImage(source){
        const key=String(source||"");
        if(!key||typeof Image!=="function"){ return null; }
        let record=spriteImageCache.get(key);
        if(record){ return record; }
        const image=new Image();
        record={image:image,ready:false,failed:false};
        image.decoding="async";
        image.onload=()=>{ record.ready=true; };
        image.onerror=()=>{ record.failed=true; };
        image.src=key;
        if(image.complete&&Number(image.naturalWidth)>0){ record.ready=true; }
        spriteImageCache.set(key,record);
        return record;
    }
    function isCanvasCropSprite(sprite){
        return !!(sprite&&sprite.renderer==="canvas-crop");
    }

    /* Warm shared Sprite Sheet assets without creating a second renderer. */
    Object.keys(MANIFEST).forEach(id=>{
        const sprite=MANIFEST[id]&&MANIFEST[id].sprite;
        if(sprite&&sprite.src){ getSpriteImage(sprite.src); }
    });
    Object.keys(STATUS_SPRITES).forEach(type=>getSpriteImage(STATUS_SPRITES[type].src));

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
        const all=targetType==="all"||targetType==="allyAll";
        const formation=/row|tri|column/i.test(targetType);
        const explicit=Array.isArray(meta.targetIds)
            ?meta.targetIds
            :(Number.isInteger(meta.targetId)?[meta.targetId]:[]);
        if(explicit.length){
            return Array.from(new Set(explicit.filter(index=>
                Number.isInteger(index)&&canReceive(config,targetSide,index)
            )));
        }
        const cards=activeCards(targetSide,config);
        if(all){ return cards.map(entry=>entry.index); }
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

    function sideAreaBounds(side){
        const id=side==="monster"?"battleMonsterArea":"battlePlayerRow";
        const area=document.getElementById(id);
        const rect=area&&area.getBoundingClientRect?area.getBoundingClientRect():null;
        if(rect&&rect.width&&rect.height){
            return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,id:id};
        }
        const cards=activeCards(side,{category:""}).map(entry=>entry.card);
        const fallback=fieldBounds(cards);
        return fallback?Object.assign({id:id},fallback):null;
    }

    function deferredStatusDuringCast(side,index,type){
        const current=state.current;
        if(!current||current.done){ return false; }
        const actorTypes=Array.isArray(current.model.deferredActorStatusTypes)?current.model.deferredActorStatusTypes:[];
        if(
            actorTypes.indexOf(type)>=0&&current.side===side&&current.actorIndex===index&&
            !(current.statusAtStart&&current.statusAtStart.has(side+":"+index+":"+type))&&
            hasTimedEffect(entityFor(side,index),type)
        ){
            return true;
        }
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

    function hasTimedEffect(entity,type){
        if(!entity){ return false; }
        const spec=STATUS_SPRITES[type];
        const collection=spec&&spec.collection==="statusEffects"?entity.statusEffects:entity.activeBuffs;
        if(Array.isArray(collection)&&collection.some(effect=>
            effect&&Number(effect.turnsLeft)>0&&(
                effect.type===type||spec&&spec.statusName&&effect.statusName===spec.statusName
            )
        )){ return true; }
        return type==="rage"&&Array.isArray(entity.v141TeamBuffs)&&entity.v141TeamBuffs.some(effect=>
            effect&&effect.type==="rage"&&Number(effect.turnsLeft)>0
        );
    }

    function snapshotTimedEffects(){
        const snapshot=new Set();
        [["monster",10],["player",3]].forEach(entry=>{
            const side=entry[0];
            for(let index=0;index<entry[1];index++){
                const entity=entityFor(side,index);
                Object.keys(STATUS_SPRITES).forEach(type=>{
                    if(hasTimedEffect(entity,type)){ snapshot.add(side+":"+index+":"+type); }
                });
            }
        });
        return snapshot;
    }

    function statusNode(card,type){
        if(!card){ return null; }
        if(typeof card.querySelector==="function"){
            return card.querySelector(".v153-status-vfx-"+type);
        }
        return Array.from(card.children||[]).find(node=>
            String(node.className||"").split(/\s+/).includes("v153-status-vfx-"+type)
        )||null;
    }

    function syncStatusSprite(side,index,type){
        const spec=STATUS_SPRITES[type];
        const card=cardFor(side,index);
        const entity=entityFor(side,index);
        const alive=!!(
            spec&&card&&entity&&Number(entity.hp)>0&&
            (side!=="monster"||entity.alive!==false)
        );
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
        const types=Object.keys(STATUS_SPRITES);
        for(let index=0;index<10;index++){
            types.forEach(type=>syncStatusSprite("monster",index,type));
        }
        for(let index=0;index<3;index++){
            types.forEach(type=>syncStatusSprite("player",index,type));
        }
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
                if(getPartyCharacterByIndex(partyIndex)===entity){
                    side="player";
                    index=partyIndex;
                    break;
                }
            }
        }
        if(!side||index<0){ return; }
        const current=state.current;
        if(
            current&&!current.done&&current.targetSide===side&&
            current.config.id==="freeze"&&!current.emitted.has(index)
        ){
            registerTarget(side,index,true);
        }
        const types=current&&Array.isArray(current.model.deferredStatusTypes)
            ?current.model.deferredStatusTypes:[];
        if(current&&!current.done&&current.targetSide===side&&types.indexOf(type)>=0){
            let tracked=current.deferredStatusTargets.get(type);
            if(!tracked){ tracked=new Set(); current.deferredStatusTargets.set(type,tracked); }
            tracked.add(index);
            syncStatusSprite(side,index,type);
            return;
        }
        const invoke=()=>syncStatusSprite(side,index,type);
        const wait=existingTargetDelay(side,index);
        if(wait>8){ setTimer(invoke,wait); }
        else{ invoke(); }
    }

    if(typeof applyBurnEffect==="function"){
        const previousApplyBurnEffect=applyBurnEffect;
        applyBurnEffect=function(entity){
            const result=previousApplyBurnEffect.apply(this,arguments);
            if(result!==false){ syncAppliedStatusSprite(entity,"burn"); }
            return result;
        };
    }

    if(typeof applyFreezeEffect==="function"){
        const previousApplyFreezeEffect=applyFreezeEffect;
        applyFreezeEffect=function(entity){
            const result=previousApplyFreezeEffect.apply(this,arguments);
            if(result!==false){ syncAppliedStatusSprite(entity,"freeze"); }
            return result;
        };
    }

    if(typeof applyMonsterDebuff==="function"){
        const previousApplyMonsterDebuff=applyMonsterDebuff;
        applyMonsterDebuff=function(entity,type){
            const result=previousApplyMonsterDebuff.apply(this,arguments);
            if(result!==false&&STATUS_SPRITES[type]){ syncAppliedStatusSprite(entity,type); }
            return result;
        };
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

    function appendNode(className,parent,tagName){
        const node=document.createElement(tagName||"i");
        node.className=className;
        (parent||state.stage).appendChild(node);
        if(state.stage){ state.metrics.peakNodes=Math.max(state.metrics.peakNodes,state.stage.childElementCount); }
        return node;
    }

    function stopCanvasCropSprite(node){
        const runtime=node&&node.__v173CanvasSprite;
        if(!runtime){ return; }
        runtime.stopped=true;
        if(
            runtime.usesAnimationFrame&&runtime.frameId&&typeof window!=="undefined"&&
            typeof window.cancelAnimationFrame==="function"
        ){
            window.cancelAnimationFrame(runtime.frameId);
        }
        runtime.frameId=0;
    }

    function canvasSpriteOpacity(progress){
        if(progress<.03){ return progress/.03; }
        if(progress>.95){ return Math.max(0,(1-progress)/.05); }
        return 1;
    }

    function scheduleCanvasCropSprite(runtime){
        if(!runtime||runtime.stopped||runtime.frameId){ return; }
        if(typeof window!=="undefined"&&typeof window.requestAnimationFrame==="function"){
            runtime.usesAnimationFrame=true;
            runtime.frameId=window.requestAnimationFrame(()=>{
                runtime.frameId=0;
                drawCanvasCropSprite(runtime);
            });
            return;
        }
        runtime.usesAnimationFrame=false;
        runtime.frameId=setTimer(()=>{
            runtime.frameId=0;
            drawCanvasCropSprite(runtime);
        },16);
    }

    function drawNaturalGridCanvasSprite(runtime){
        if(!runtime||runtime.stopped){ return; }
        const current=runtime.current;
        if(!current||current.done||state.current!==current){ return; }
        const node=runtime.node;
        const sprite=runtime.sprite||{};
        const columns=Math.max(1,Math.floor(Number(sprite.columns)||4));
        const rows=Math.max(1,Math.floor(Number(sprite.rows)||3));
        const frames=Math.max(1,Math.min(columns*rows,Math.floor(Number(sprite.frames)||columns*rows)));
        const duration=Math.max(1,Number(current.duration)||1);
        const progress=Math.min(1,Math.max(0,(Date.now()-current.startedAt)/duration));
        const frameIndex=Math.min(frames-1,Math.floor(progress*frames));
        const frameX=frameIndex%columns;
        const frameY=Math.floor(frameIndex/columns);
        const imageRecord=runtime.imageRecord||getSpriteImage(sprite.src);
        runtime.imageRecord=imageRecord;
        const image=imageRecord&&imageRecord.image;
        const ready=!!(
            image&&(
                imageRecord.ready||
                (image.complete&&Number(image.naturalWidth)>0&&Number(image.naturalHeight)>0)
            )
        );
        const sourceWidth=ready?Number(image.naturalWidth)/columns:0;
        const sourceHeight=ready?Number(image.naturalHeight)/rows:0;
        const sourceX=frameX*sourceWidth;
        const sourceY=frameY*sourceHeight;
        const context=node&&typeof node.getContext==="function"?node.getContext("2d"):null;
        node.dataset.frameIndex=String(frameIndex);
        node.dataset.frameX=String(frameX);
        node.dataset.frameY=String(frameY);
        node.dataset.sourceX=String(sourceX);
        node.dataset.sourceY=String(sourceY);
        node.dataset.sourceWidth=String(sourceWidth);
        node.dataset.sourceHeight=String(sourceHeight);
        node.style.opacity=String(canvasSpriteOpacity(progress));
        if(context&&image&&ready){
            context.clearRect(0,0,node.width,node.height);
            let destX=0,destY=0,destWidth=node.width,destHeight=node.height;
            if(sprite.preserveSourceAspect&&sourceWidth>0&&sourceHeight>0&&node.width>0&&node.height>0){
                const sourceAspect=sourceWidth/sourceHeight;
                const destinationAspect=node.width/node.height;
                if(sourceAspect>destinationAspect){
                    destHeight=node.width/sourceAspect;
                    destY=(node.height-destHeight)/2;
                }else if(sourceAspect<destinationAspect){
                    destWidth=node.height*sourceAspect;
                    destX=(node.width-destWidth)/2;
                }
            }
            node.dataset.destX=String(destX);
            node.dataset.destY=String(destY);
            node.dataset.destWidth=String(destWidth);
            node.dataset.destHeight=String(destHeight);
            context.drawImage(
                image,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                destX,
                destY,
                destWidth,
                destHeight
            );
        }
        if(progress<1){ scheduleCanvasCropSprite(runtime); }
    }

    /*
       Fixed 4×3 Canvas crop renderer. The source is always one 384×384 cell;
       CSS width/height on the existing VFX node are only the destination size.
    */
    function drawCanvasCropSprite(runtime){
        if(!runtime||runtime.stopped){ return; }
        if(runtime.sprite&&runtime.sprite.naturalGrid){
            drawNaturalGridCanvasSprite(runtime);
            return;
        }
        const current=runtime.current;
        if(!current||current.done||state.current!==current){ return; }
        const node=runtime.node;
        const duration=Math.max(1,Number(current.duration)||1);
        const progress=Math.min(1,Math.max(0,(Date.now()-current.startedAt)/duration));
        const frameIndex=Math.min(11,Math.floor(progress*12));
        const column=frameIndex%4;
        const row=Math.floor(frameIndex/4);
        const sourceX=column*384;
        const sourceY=row*384;
        const imageRecord=runtime.imageRecord||getSpriteImage(runtime.sprite.src);
        runtime.imageRecord=imageRecord;
        const image=imageRecord&&imageRecord.image;
        const ready=!!(
            image&&(
                imageRecord.ready||
                (image.complete&&Number(image.naturalWidth)>0)
            )
        );
        const context=node&&typeof node.getContext==="function"?node.getContext("2d"):null;
        node.dataset.frameIndex=String(frameIndex);
        node.dataset.sourceX=String(sourceX);
        node.dataset.sourceY=String(sourceY);
        node.dataset.sourceWidth="384";
        node.dataset.sourceHeight="384";
        node.style.opacity=String(canvasSpriteOpacity(progress));
        if(context&&image&&ready){
            context.clearRect(0,0,node.width,node.height);
            context.drawImage(
                image,
                sourceX,
                sourceY,
                384,
                384,
                0,
                0,
                node.width,
                node.height
            );
        }
        if(progress<1){ scheduleCanvasCropSprite(runtime); }
    }

    function startCanvasCropSprite(node){
        const runtime=node&&node.__v173CanvasSprite;
        if(!runtime||runtime.started||runtime.stopped){ return; }
        runtime.started=true;
        node.style.opacity="0";
        drawCanvasCropSprite(runtime);
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
        const beneficial=["buff","heal","revive"].includes(String(current.config.category||""));
        card.classList.remove("v143-effects-pending");
        if(!beneficial){
            card.classList.add("v143-impact-target");
            if(current.targetIndexes.length>1&&/all|row|tri/i.test(String(current.config.targetType||""))){
                card.classList.add("v146-area-impact");
                setTimer(()=>card.classList.remove("v146-area-impact"),680);
            }
        }
        if(typeof window.v143SyncEarthShieldEffects==="function"){
            window.v143SyncEarthShieldEffects();
            setTimer(()=>window.v143SyncEarthShieldEffects(),0);
        }
        syncStatusSpriteEffects();
        if(!beneficial){ setTimer(()=>card.classList.remove("v143-impact-target"),520); }
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

    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

    function emittedSpriteTargets(current){
        return current.targetIndexes.filter(index=>
            current.emitted.has(index)&&current.validTargets.has(index)&&
            canReceive(current.config,current.targetSide,index)&&
            !!cardFor(current.targetSide,index)
        );
    }

    function buildBattlefieldSpriteTiles(node,sprite,bounds){
        const tileSize=Math.max(1,Math.min(bounds.width,bounds.height));
        const columns=Math.max(1,Math.ceil(bounds.width/tileSize));
        const rows=Math.max(1,Math.ceil(bounds.height/tileSize));
        const geometry=[bounds.width,bounds.height,tileSize,columns,rows].join(":");
        if(node.dataset.tileGeometry===geometry){ return; }

        if(typeof node.querySelectorAll==="function"){
            node.querySelectorAll(".v166-water-battlefield-tile").forEach(tile=>tile.remove());
        }
        const startX=(bounds.width-columns*tileSize)/2;
        const startY=(bounds.height-rows*tileSize)/2;
        for(let row=0;row<rows;row++){
            for(let column=0;column<columns;column++){
                const tile=document.createElement("span");
                tile.className="v166-water-battlefield-tile";
                tile.style.left=(startX+column*tileSize)+"px";
                tile.style.top=(startY+row*tileSize)+"px";
                tile.style.width=tileSize+"px";
                tile.style.height=tileSize+"px";
                tile.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
                tile.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
                if(typeof tile.setAttribute==="function"){ tile.setAttribute("aria-hidden","true"); }
                node.appendChild(tile);
            }
        }
        node.dataset.tileGeometry=geometry;
        node.dataset.tileCount=String(columns*rows);
    }

    function formationRowsForVfx(indexes){
        const resolver=typeof window!=="undefined"&&typeof window.v148GetFormationRows==="function"
            ?window.v148GetFormationRows
            :(typeof window!=="undefined"&&typeof window.v138GetFormationRows==="function"
                ?window.v138GetFormationRows:null);
        if(!resolver){ return []; }
        const rows=resolver(indexes||[]);
        return Array.isArray(rows)
            ?rows.filter(row=>Array.isArray(row)&&row.length).map(row=>row.slice())
            :[];
    }

    function fixedTriLayoutBounds(current,indexes){
        const targetType=String(current.config.targetType||"");
        if(targetType==="allyTri"&&current.targetSide==="player"){
            const playerArea=sideAreaBounds("player");
            if(playerArea){
                playerArea.centerX=playerArea.left+playerArea.width/2;
                playerArea.centerY=playerArea.top+playerArea.height/2;
                playerArea.fixedSlots=3;
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
        if(center===null&&indexes.length){
            center=indexes[Math.floor((indexes.length-1)/2)];
        }
        const anchorCard=Number.isInteger(center)?cardFor(current.targetSide,center):null;
        const anchor=cardCenter(anchorCard);
        if(!anchor){
            const area=sideAreaBounds(current.targetSide);
            if(area){
                area.centerX=area.left+area.width/2;
                area.centerY=area.top+area.height/2;
                area.fixedSlots=3;
            }
            return area;
        }

        let step=Math.max(1,anchor.rect.width+3);
        if(current.targetSide==="monster"&&typeof currentBattleMonsters!=="undefined"){
            const rows=formationRowsForVfx(currentBattleMonsters);
            const row=rows.find(candidate=>candidate.includes(center));
            if(row){
                const position=row.indexOf(center);
                const neighborIndexes=[row[position-1],row[position+1]].filter(Number.isInteger);
                const distances=neighborIndexes.map(neighborIndex=>cardCenter(cardFor("monster",neighborIndex)))
                    .filter(Boolean).map(neighbor=>Math.abs(neighbor.x-anchor.x)).filter(distance=>distance>1);
                if(distances.length){ step=Math.min.apply(null,distances); }
            }
        }else if(current.targetSide==="player"){
            const partyCenters=[0,1,2].map(partyIndex=>cardCenter(cardFor("player",partyIndex))).filter(Boolean);
            const distances=partyCenters.map(candidate=>Math.abs(candidate.x-anchor.x)).filter(distance=>distance>1);
            if(distances.length){ step=Math.min.apply(null,distances); }
        }

        const width=anchor.rect.width+step*2;
        return {
            left:anchor.x-width/2,
            top:anchor.rect.top,
            width:width,
            height:anchor.rect.height,
            centerX:anchor.x,
            centerY:anchor.y,
            fixedSlots:3,
            id:"fixed-tri-slots"
        };
    }

    function groupLayoutBounds(current,indexes){
        const targetType=String(current.config.targetType||"");
        if(/tri/i.test(targetType)){ return fixedTriLayoutBounds(current,indexes); }
        if(current.targetSide==="player"){
            return sideAreaBounds("player");
        }
        if(current.targetSide==="monster"&&typeof currentBattleMonsters!=="undefined"){
            const queued=current.side==="player"&&typeof queuedPlayerActions!=="undefined"
                ?queuedPlayerActions&&queuedPlayerActions[current.actorIndex]:null;
            const center=Number.isInteger(current.targetId)
                ?current.targetId
                :(queued&&Number.isInteger(queued.target)?queued.target:indexes[0]);
            const rows=formationRowsForVfx(currentBattleMonsters);
            const row=rows.find(candidate=>candidate.includes(center));
            if(row){
                const layout=fieldBounds(row.map(index=>cardFor("monster",index)).filter(Boolean));
                if(layout){ return layout; }
            }
        }
        return fieldBounds(indexes.map(index=>cardFor(current.targetSide,index)).filter(Boolean));
    }

    function placeSprite(current,node,index,target){
        const sprite=current.model.sprite;
        const placement=String(sprite.placement||"single");
        if(placement==="single"){
            const scale=Number(sprite.scale)||1.8;
            const size=clamp(
                Math.max(target.rect.width,target.rect.height)*scale,
                Number(sprite.minSize)||96,
                Number(sprite.maxSize)||184
            );
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.style.left=target.x+"px";
            node.style.top=target.y+"px";
            node.style.width=size+"px";
            node.style.height=size+"px";
            node.style.setProperty("--v143-sprite-angle","0deg");
            return;
        }

        if(placement==="targetTrajectory"){
            const actor=cardCenter(current.actorCard);
            if(!actor){ return; }
            const scale=Number(sprite.scale)||1.7;
            const size=clamp(
                Math.max(target.rect.width,target.rect.height)*scale,
                Number(sprite.minSize)||140,
                Number(sprite.maxSize)||240
            );
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            node.style.width=size+"px";
            node.style.height=size+"px";
            node.style.setProperty("--v143-sprite-dx",target.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",target.y-actor.y+"px");
            node.style.setProperty("--v143-sprite-start-left",actor.x+"px");
            node.style.setProperty("--v143-sprite-start-top",actor.y+"px");
            node.style.setProperty("--v143-sprite-target-left",target.x+"px");
            node.style.setProperty("--v143-sprite-target-top",target.y+"px");
            node.style.setProperty("--v143-sprite-angle","0deg");
            return;
        }

        if(placement==="battlefield"){
            const indexes=emittedSpriteTargets(current);
            /*
               Most full-field skills (for example Phoenix Cry) intentionally
               cover the entire opposing formation even after casualties.
               Ice Arrow Rain opts into the living-card bounds below.
            */
            if(!sprite.targetBounds&&!sprite.fixedFormation){
                const bounds=sideAreaBounds(current.targetSide);
                if(!bounds){ return; }
                const viewportWidth=Number(window.innerWidth)||960;
                const viewportHeight=Number(window.innerHeight)||720;
                const dynamicMaximum=Math.max(320,Math.min(1280,Math.max(viewportWidth,viewportHeight)*.96));
                const size=clamp(
                    Math.max(bounds.width,bounds.height)*(Number(sprite.scale)||1),
                    Number(sprite.minSize)||160,
                    Number(sprite.maxSize)||dynamicMaximum
                );
                node.dataset.targetIndexes=indexes.join(",");
                node.dataset.areaId=bounds.id;
                node.style.left=(bounds.left+bounds.width/2)+"px";
                node.style.top=(bounds.top+bounds.height/2)+"px";
                node.style.width=size+"px";
                node.style.height=size+"px";
                node.style.clipPath="none";
                node.style.setProperty("--v143-sprite-dx","0px");
                node.style.setProperty("--v143-sprite-dy","0px");
                node.style.setProperty("--v143-sprite-angle","0deg");
                return;
            }

            if(sprite.fixedFormation){
                const bounds=sideAreaBounds(current.targetSide);
                if(!bounds){ return; }
                const viewportWidth=Number(window.innerWidth)||960;
                const viewportHeight=Number(window.innerHeight)||720;
                const coverageScale=clamp(Number(sprite.coverageScale)||1,1,1.4);
                const maxWidth=Math.max(240,Math.min(viewportWidth*.94,Number(sprite.maxWidth)||viewportWidth*.94));
                const maxHeight=Math.max(240,Math.min(viewportHeight*.92,Number(sprite.maxHeight)||viewportHeight*.92));
                const width=clamp(
                    Math.round(bounds.width*coverageScale),
                    Number(sprite.minWidth)||160,
                    maxWidth
                );
                const height=clamp(
                    Math.round(bounds.height*coverageScale),
                    Number(sprite.minHeight)||160,
                    maxHeight
                );
                node.dataset.targetIndexes=indexes.join(",");
                node.dataset.areaId=bounds.id;
                node.dataset.fixedFormation="true";
                node.dataset.coverageScale=String(coverageScale);
                node.style.left=(bounds.left+bounds.width/2)+"px";
                node.style.top=(bounds.top+bounds.height/2)+"px";
                node.style.width=width+"px";
                node.style.height=height+"px";
                node.style.clipPath="none";
                node.style.setProperty("--v143-sprite-dx","0px");
                node.style.setProperty("--v143-sprite-dy","0px");
                node.style.setProperty("--v143-sprite-angle","0deg");
                return;
            }

            /*
               Optional target-bounds battlefield mode remains available for
               skills that explicitly want a living-target footprint. Fixed
               formation skills never enter this branch.
            */
            const targetCards=indexes.map(targetIndex=>cardFor(current.targetSide,targetIndex))
                .filter(card=>card&&card.offsetParent!==null);
            const bounds=fieldBounds(targetCards);
            if(!bounds){ return; }
            const viewportWidth=Number(window.innerWidth)||960;
            const viewportHeight=Number(window.innerHeight)||720;
            const coverageScale=clamp(Number(sprite.coverageScale)||1.22,1.15,1.3);
            const maxWidth=Math.max(240,Math.min(viewportWidth*.94,Number(sprite.maxWidth)||viewportWidth*.94));
            const maxHeight=Math.max(240,Math.min(viewportHeight*.92,Number(sprite.maxHeight)||viewportHeight*.92));
            const width=clamp(
                Math.round(bounds.width*coverageScale),
                Number(sprite.minWidth)||140,
                maxWidth
            );
            const height=clamp(
                Math.round(bounds.height*coverageScale),
                Number(sprite.minHeight)||140,
                maxHeight
            );
            node.dataset.targetIndexes=indexes.join(",");
            node.dataset.areaId="living-targets";
            node.dataset.coverageScale=String(coverageScale);
            node.style.left=(bounds.left+bounds.width/2)+"px";
            node.style.top=(bounds.top+bounds.height/2)+"px";
            node.style.width=width+"px";
            node.style.height=height+"px";
            node.style.clipPath="none";
            node.style.setProperty("--v143-sprite-dx","0px");
            node.style.setProperty("--v143-sprite-dy","0px");
            node.style.setProperty("--v143-sprite-angle","0deg");
            return;
        }

        const indexes=emittedSpriteTargets(current);
        const targetCards=indexes.map(targetIndex=>cardFor(current.targetSide,targetIndex)).filter(Boolean);
        const targetBounds=sprite.alignToSlots
            ?groupLayoutBounds(current,indexes)
            :fieldBounds(targetCards);
        if(!targetBounds){ return; }
        const coverageCards=placement==="trajectory"&&current.actorCard
            ?[current.actorCard].concat(targetCards)
            :targetCards;
        const coverage=sprite.alignToSlots?targetBounds:(fieldBounds(coverageCards)||targetBounds);
        const scale=Number(sprite.scale)||1;
        const naturalSize=(Math.max(coverage.width,coverage.height)+40)*scale;
        const viewportWidth=Number(window.innerWidth)||960;
        const viewportHeight=Number(window.innerHeight)||720;
        const dynamicMaximum=Math.max(320,Math.min(1280,Math.max(viewportWidth,viewportHeight)*.96));
        const size=clamp(
            naturalSize,
            Number(sprite.minSize)||160,
            Number(sprite.maxSize)||dynamicMaximum
        );
        node.dataset.targetIndexes=indexes.join(",");
        node.style.width=size+"px";
        node.style.height=size+"px";
        let angle=0;
        const actor=placement==="trajectory"?cardCenter(current.actorCard):null;
        const destination={
            x:targetBounds.left+targetBounds.width/2,
            y:targetBounds.top+targetBounds.height/2
        };
        const travelsToTargets=!!(placement==="trajectory"&&sprite.travelToTargets&&actor);
        if(travelsToTargets){
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            node.style.setProperty("--v143-sprite-dx",destination.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",destination.y-actor.y+"px");
        }else{
            const centerX=sprite.alignToSlots&&Number.isFinite(targetBounds.centerX)
                ?targetBounds.centerX:coverage.left+coverage.width/2;
            const centerY=sprite.alignToSlots&&Number.isFinite(targetBounds.centerY)
                ?targetBounds.centerY:coverage.top+coverage.height/2;
            node.style.left=centerX+"px";
            node.style.top=centerY+"px";
            node.style.setProperty("--v143-sprite-dx","0px");
            node.style.setProperty("--v143-sprite-dy","0px");
        }
        if(actor){ angle=Math.atan2(destination.y-actor.y,destination.x-actor.x)*180/Math.PI; }
        node.style.setProperty("--v143-sprite-angle",angle+"deg");
    }

    function startSpriteAnimation(node){
        if(node&&node.__v173CanvasSprite){
            startCanvasCropSprite(node);
            return;
        }
        const animationClass=node&&node.__v143PendingAnimationClass;
        if(!animationClass){ return; }
        node.style.opacity="";
        node.className+=animationClass;
        node.__v143PendingAnimationClass="";
    }

    function scheduleSharedSpriteAnimation(current,node){
        if(!node||node.__v143AnimationStartScheduled){ return; }
        node.__v143AnimationStartScheduled=true;
        setTimer(()=>{
            node.__v143AnimationStartScheduled=false;
            if(state.current===current&&!current.done){ startSpriteAnimation(node); }
        },0);
    }

    function addSprite(current,index,target){
        const sprite=current.model.sprite;
        if(!sprite||!target){ return; }
        const placement=String(sprite.placement||"single");
        const key=placement==="single"||placement==="targetTrajectory"?index:"main";
        let node=current.spriteNodes.get(key);
        let animationClass="";
        let isNew=false;
        const canvasSprite=isCanvasCropSprite(sprite);
        if(!node){
            node=appendNode(
                "v143-vfx-sprite v143-vfx-sprite-"+current.config.id,
                null,
                canvasSprite?"canvas":undefined
            );
            if(!canvasSprite){
                animationClass=
                    (String(sprite.src).includes("/fire/")?" v153-fire-cast-sprite":"")+
                    (String(sprite.src).includes("/water/")?" v166-water-cast-sprite":"");
            }
            node.__v143PendingAnimationClass=animationClass;
            isNew=true;
            node.dataset.targetSide=current.targetSide;
            node.dataset.placement=placement;
            node.dataset.columns=String(sprite.columns);
            node.dataset.rows=String(sprite.rows);
            node.dataset.frames=String(sprite.frames);
            node.style.opacity="0";
            node.style.setProperty("--v143-sprite-duration",current.duration+"ms");
            node.style.setProperty(
                "--v143-sprite-delay",
                -Math.min(current.duration,Math.max(0,Date.now()-current.startedAt))+"ms"
            );
            if(canvasSprite){
                node.width=Math.max(1,Math.floor(Number(sprite.frameWidth)||384));
                node.height=Math.max(1,Math.floor(Number(sprite.frameHeight)||384));
                node.dataset.renderer="canvas-crop";
                node.style.backgroundImage="none";
                node.style.backgroundSize="auto";
                node.__v173CanvasSprite={
                    node:node,current:current,sprite:sprite,
                    imageRecord:getSpriteImage(sprite.src),
                    started:false,stopped:false,usesAnimationFrame:false,frameId:0
                };
            }else{
                node.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
                node.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
            }
            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
            current.spriteNodes.set(key,node);
        }
        placeSprite(current,node,index,target);
        /*
           Android browsers may snapshot custom-property fallbacks if the
           animation class is present before the real card coordinates.
        */
        if(isNew&&canvasSprite){
            if(!current.collectingInitialTargets){ startSpriteAnimation(node); }
        }else if(isNew&&(placement==="single"||placement==="targetTrajectory")){
            startSpriteAnimation(node);
        }else if(!current.collectingInitialTargets&&node.__v143PendingAnimationClass){
            scheduleSharedSpriteAnimation(current,node);
        }
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
        const single=String(current.config.targetType||"")==="single";
        if(single&&current.targetIndexes.length&&current.targetIndexes.indexOf(index)<0){ return null; }
        emitFlight(current,index,allowDefeated===true);
        return current.emitted.has(index)?current:null;
    }

    function cleanupCurrent(current,reason){
        if(!current||current.done){ return; }
        current.done=true;
        current.spriteNodes.forEach(stopCanvasCropSprite);
        current.actorCard&&current.actorCard.classList.remove("v143-caster-active");
        current.targetIndexes.forEach(index=>{
            const card=cardFor(current.targetSide,index);
            if(card){ card.classList.remove("v143-effects-pending","v143-impact-target"); }
        });
        if(state.stage&&state.stage.dataset.sequence===String(current.sequence)){ state.stage.remove(); }
        if(state.current===current){ state.current=null; state.stage=null; }
        syncStatusSpriteEffects();
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
            targetId:Number.isInteger(meta.targetId)?meta.targetId:null,
            targetIds:Array.isArray(meta.targetIds)?meta.targetIds.slice():null,
            targetSide:targetSide,targetIndexes:[],emitted:new Set(),
            validTargets:validTargets,spriteNodes:new Map(),deferredStatusTargets:new Map(),
            statusAtStart:snapshotTimedEffects(),
            actorCard:cardFor(meta.side||"player",Number.isInteger(meta.actorIndex)?meta.actorIndex:0),
            startedAt:Date.now(),duration:duration,hitReached:false,done:false,
            collectingInitialTargets:true
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
        if(
            Array.isArray(model.deferredStatusTypes)&&model.deferredStatusTypes.length||
            Array.isArray(model.deferredActorStatusTypes)&&model.deferredActorStatusTypes.length
        ){
            syncStatusSpriteEffects();
        }
        if(!model.sprite){
            addCharge(current);
            addField(current);
        }
        current.targetIndexes.slice().forEach(index=>emitFlight(current,index));
        current.collectingInitialTargets=false;
        current.spriteNodes.forEach(node=>startSpriteAnimation(node));
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

    /* Fire Rocket's official sheet already contains the complete three-arrow
       travel and burst. Keep the legacy projectile helper for non-sheet calls,
       but never stack it over this shared Sprite Sheet action. */
    if(typeof playFireRocketAnimation==="function"){
        const previousFireRocketAnimation=playFireRocketAnimation;
        playFireRocketAnimation=function(){
            const current=state.current;
            if(current&&!current.done&&current.config.id==="fireRocket"&&current.model.sprite){ return; }
            return previousFireRocketAnimation.apply(this,arguments);
        };
    }

    /* Ice Spin's official sheets already own every resolved target. */
    if(typeof playIceSpinProjectile==="function"){
        const previousIceSpinProjectile=playIceSpinProjectile;
        playIceSpinProjectile=function(){
            const current=state.current;
            if(current&&!current.done&&current.config.id==="iceSpin"&&current.model.sprite){ return; }
            return previousIceSpinProjectile.apply(this,arguments);
        };
    }

    director.dispose=function(){
        clearTimers();
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"dispose"); }
        document.querySelectorAll("#v143-skill-stage").forEach(node=>node.remove());
        removeStatusSpriteEffects();
        return originalDispose();
    };

    function delayFor(targetSide,index,allowDefeated){
        const current=registerTarget(targetSide,index,allowDefeated);
        if(!current){ return 0; }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    window.v143RunAtTargetHit=function(targetSide,index,callback,allowDefeated){
        if(typeof callback!=="function"){ return 0; }
        const wait=delayFor(targetSide,index,allowDefeated===true);
        if(wait>8){ setTimer(callback,wait); }
        else{ callback(); }
        return wait;
    };

    function existingTargetDelay(targetSide,index){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide||!current.emitted.has(index)){ return 0; }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    if(typeof showMonsterHit==="function"){
        const previousShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index){
            const args=Array.prototype.slice.call(arguments);
            const wait=delayFor("monster",index,true);
            const current=state.current;
            if(current&&!current.done&&current.config.id==="fireCritical"&&current.targetSide==="monster"){
                args[3]=true;
            }
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
            const args=Array.prototype.slice.call(arguments);
            const wait=delayFor("player",Number(index)||0,true);
            const current=state.current;
            if(
                current&&!current.done&&current.config.id==="fireCritical"&&
                current.targetSide==="player"&&!args[3]
            ){
                args[4]=true;
            }
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previousShowPlayerHit.apply(this,args),wait);
                return;
            }
            return previousShowPlayerHit.apply(this,args);
        };
    }

    /* Barrier can absorb an enemy hit before showPlayerHit() runs. The debuff
       settlement still exposes the real player endpoint for its VFX. */
    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previousPlayerDebuffEffects=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index){
            registerTarget("player",Number(index)||0,true);
            return previousPlayerDebuffEffects.apply(this,arguments);
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
            const invoke=()=>{
                const result=previousCardEffect.apply(this,args);
                syncStatusSpriteEffects();
                return result;
            };
            if(wait>8){ setTimer(invoke,wait); return; }
            return invoke();
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
                        syncStatusSpriteEffects();
                    },wait);
                }
                return;
            }
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncStatusSpriteEffects();
            return result;
        };
    }

    /* Status turns can expire in several combat paths. A completed UI refresh
       is the common boundary where stale loop nodes can be removed at once. */
    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncStatusSpriteEffects();
            return result;
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
                        syncStatusSpriteEffects();
                    },wait);
                }
                return;
            }
            const result=previousUpdatePlayerStatus.apply(this,arguments);
            syncStatusSpriteEffects();
            return result;
        };
    }

    /* Base badge lifetime now comes from V142's per-skill animation duration.
       This wrapper only applies the compact caster-label presentation. */
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
