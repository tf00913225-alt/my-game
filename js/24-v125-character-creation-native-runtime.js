/* =====================================================
   V128 — FIXED TWO-STEP 1080 × 1920 CHARACTER CREATION RUNTIME
   - Uses the V128 pre-paint native bootstrap; reparenting is only a fallback
   - Uses real native component dimensions, never migration scale
   - Gender / portrait switching
   - Element positioning with larger element descriptions
   - Fixed Android Chrome canvas with no page scroll or pinch zoom
   - Two-step creation flow; ability allocation lives on page two
   Existing combat/stat/skill formulas are not changed.
===================================================== */
(function(){
    "use strict";

    const PORTRAITS={
        female:{
            fire:"assets/characters/female_fire.jpg",
            water:"assets/characters/female_water.jpg",
            wind:"assets/characters/female_wind.jpg",
            earth:"assets/characters/female_earth.jpg"
        },
        male:{
            fire:"assets/characters/male_fire.jpg",
            water:"assets/characters/male_water.jpg",
            wind:"assets/characters/male_wind.jpg",
            earth:"assets/characters/male_earth.jpg"
        }
    };

    const META={
        fire:{
            glyph:"火",
            title:"烈焰之道",
            role:"爆發輸出 · 爆擊 · 燃燒",
            description:"以高爆發、爆擊與燃燒持續傷害壓制敵人，物理與法術兩條路線都偏向主動進攻。",
            tags:["高爆發","爆擊強化","燃燒傷害"]
        },
        water:{
            glyph:"水",
            title:"寒水之道",
            role:"吸取回復 · 冰封 · 治療復活",
            description:"兼具續航、控場與隊伍回復；攻擊技能可吸取HP與SP，並擁有冰封、治療與復活能力。",
            tags:["HP/SP吸取","冰封控場","治療復活"]
        },
        wind:{
            glyph:"風",
            title:"疾風之道",
            role:"速度干擾 · 傷害削弱 · 閃避控場",
            description:"透過敏捷、閃避與各式干擾掌握戰鬥節奏，可降低敵方能力、傷害與命中並施加暈眩。",
            tags:["敏捷干擾","閃避強化","暈眩／降傷"]
        },
        earth:{
            glyph:"土",
            title:"厚土之道",
            role:"護盾防禦 · 降防 · 石化反傷",
            description:"重視生存與隊伍防護，能建立護盾、反傷與結界，同時以降防與石化控制敵方。",
            tags:["護盾防護","降防石化","反傷結界"]
        }
    };

    let selectedGender="female";
    let selectedCreationStep=1;

    function byId(id){
        return document.getElementById(id);
    }

    function migrateCreationPageToNativeLayer(){
        const page=byId("creationPage");
        const overlay=byId("game-overlay-layer");
        if(!page || !overlay){return null;}

        if(page.parentElement!==overlay){
            overlay.appendChild(page);
        }

        page.classList.add("native-creation-page","game-native-ui");
        page.dataset.nativeWidth="1080";
        page.dataset.nativeHeight="1920";
        page.dataset.nativeMigration="actual-dimensions";

        [
            "left","top","right","bottom","width","height",
            "min-width","min-height","max-width","max-height",
            "margin","transform","transform-origin"
        ].forEach(function(property){
            page.style.removeProperty(property);
        });

        /* This layer contains interactive native UI, so it cannot stay
           hidden from accessibility APIs. Pointer ownership remains on
           #creationPage; the overlay itself still uses pointer-events:none. */
        overlay.removeAttribute("aria-hidden");
        return page;
    }

    function setCreationTouchMode(active){
        [
            document.documentElement,
            document.body,
            byId("game-viewport"),
            byId("game-stage"),
            byId("game-overlay-layer")
        ].forEach(function(node){
            if(node){
                node.classList.remove("creation-scroll-active");
                node.classList.toggle("creation-fixed-active",!!active);
            }
        });

        const stage=byId("game-stage");
        const app=byId("app");

        if(stage){
            stage.classList.toggle("creation-native-active",!!active);
        }

        if(app){
            app.inert=!!active;
            if(active){
                app.setAttribute("aria-hidden","true");
            }else{
                app.removeAttribute("aria-hidden");
            }
        }

        if(active){
            window.scrollTo(0,0);
        }
    }

    function syncCreationTouchMode(){
        const page=migrateCreationPageToNativeLayer();
        const visible=!!page && window.getComputedStyle(page).display!=="none";
        setCreationTouchMode(visible);
    }

    function installCreationGestureLock(){
        const page=byId("creationPage");
        if(!page || page.dataset.gestureLockReady==="true"){
            return;
        }

        ["touchmove","gesturestart","gesturechange","gestureend"].forEach(function(eventName){
            page.addEventListener(eventName,function(event){
                event.preventDefault();
            },{passive:false});
        });

        page.dataset.gestureLockReady="true";
    }

    function applyCreationStep(step){
        const page=byId("creationPage");
        const normalized=Number(step)===2?2:1;
        selectedCreationStep=normalized;

        document.querySelectorAll("#creationPage [data-creation-step]").forEach(function(panel){
            const active=Number(panel.dataset.creationStep)===normalized;
            panel.classList.toggle("is-active",active);
            panel.hidden=!active;
            panel.setAttribute("aria-hidden",active?"false":"true");
        });

        document.querySelectorAll("#creationPage [data-creation-step-indicator]").forEach(function(indicator){
            const active=Number(indicator.dataset.creationStepIndicator)===normalized;
            indicator.classList.toggle("is-active",active);
            if(active){
                indicator.setAttribute("aria-current","step");
            }else{
                indicator.removeAttribute("aria-current");
            }
        });

        if(page){
            page.dataset.step=String(normalized);
            page.scrollTop=0;
        }

        if(document.activeElement && typeof document.activeElement.blur==="function"){
            document.activeElement.blur();
        }
        window.scrollTo(0,0);
    }

    window.setCreationStep=function(step){
        applyCreationStep(step);
    };

    function orderedSkills(element,category){
        if(typeof skillDatabase==="undefined"){
            return [];
        }
        return Object.keys(skillDatabase)
            .map(function(id){return skillDatabase[id];})
            .filter(function(skill){
                return skill && skill.element===element && skill.category===category;
            })
            .sort(function(a,b){
                return Number(a.tier||99)-Number(b.tier||99);
            });
    }

    function specialSkills(element){
        if(typeof skillDatabase==="undefined"){
            return [];
        }
        const order={buff:1,heal:2,revive:3,passive:4};
        return Object.keys(skillDatabase)
            .map(function(id){return skillDatabase[id];})
            .filter(function(skill){
                return skill && skill.element===element && order[skill.category];
            })
            .sort(function(a,b){
                const cat=(order[a.category]||99)-(order[b.category]||99);
                if(cat!==0){return cat;}
                return Number(a.tier||99)-Number(b.tier||99);
            });
    }

    function renderSkillChips(containerId,skills){
        const box=byId(containerId);
        if(!box){return;}
        box.innerHTML="";
        skills.forEach(function(skill,index){
            const chip=document.createElement("button");
            chip.type="button";
            chip.className="creation-skill-chip"+(index===skills.length-1?" signature":"");
            chip.dataset.skillId=skill.id;
            chip.textContent=skill.name;
            chip.title=skill.description||skill.name;
            chip.setAttribute("aria-haspopup","dialog");
            chip.setAttribute("aria-label",skill.name+"，點擊查看詳細介紹");
            chip.addEventListener("click",function(){
                window.showCreationSkillDetail(skill.id);
            });
            box.appendChild(chip);
        });
    }

    function escapeHTML(value){
        return String(value===undefined||value===null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#39;");
    }

    function valueAtLevel(values,level){
        if(!Array.isArray(values) || values.length<1){
            return undefined;
        }
        return values[Math.min(level-1,values.length-1)];
    }

    function creationSkillCategoryLabel(category){
        try{
            if(typeof getSkillCategoryLabel==="function"){
                return getSkillCategoryLabel(category);
            }
        }catch(error){}

        const labels={
            physical:"物理",
            magic:"法術",
            buff:"增益",
            heal:"回復",
            revive:"復活",
            passive:"被動"
        };
        return labels[category]||"技能";
    }

    function creationSkillTargetLabel(targetType){
        const labels={
            single:"單體敵人",
            tri:"同橫排最多3名敵人",
            row:"任一敵方橫排",
            all:"敵方全體",
            ally:"單一友方",
            allyAll:"我方全體",
            deadAlly:"死亡友方",
            none:"永久被動"
        };
        return labels[targetType]||"依技能規則";
    }

    function skillLevelParts(skill,level){
        const parts=[];

        if(
            (skill.category==="physical" || skill.category==="magic") &&
            skill.baseDamage!==undefined
        ){
            let damage=Number(skill.baseDamage||0)+Number(skill.damagePerLevel||0)*(level-1);
            try{
                if(typeof getSkillDamageAtLevel==="function"){
                    damage=getSkillDamageAtLevel(skill,level);
                }
            }catch(error){}

            parts.push(
                "傷害"+Math.floor(damage)+
                (skill.damagePerLevel ? "（每級+"+skill.damagePerLevel+"）" : "")
            );
        }

        const burnPercent=valueAtLevel(skill.burnPercentByLevel,level);
        if(skill.burnChance!==undefined && burnPercent!==undefined){
            parts.push(
                skill.burnChance+"%機率燃燒"+
                (skill.burnDuration||2)+"回合，每回合造成最大HP "+
                burnPercent+"%傷害"
            );
        }

        if(skill.freezeChance!==undefined){
            parts.push(
                skill.freezeChance+"%機率冰封"+
                (skill.freezeDuration||1)+"回合"
            );
        }

        const lifesteal=valueAtLevel(skill.lifestealPercentByLevel,level);
        if(lifesteal!==undefined){
            parts.push("吸取傷害"+lifesteal+"%，等量回復自身HP與SP");
        }

        const agilityDown=valueAtLevel(skill.agilityDownByLevel,level);
        if(agilityDown!==undefined){
            parts.push(
                skill.agilityDownChance+"%機率降低敏捷"+
                agilityDown+"%，持續"+(skill.agilityDownDuration||2)+"回合"
            );
        }

        const statDown=valueAtLevel(skill.statDownByLevel,level);
        if(statDown!==undefined){
            parts.push(
                skill.statDownChance+"%機率降低所有能力"+
                statDown+"%，持續"+(skill.statDownDuration||2)+"回合"
            );
        }

        const damageDown=valueAtLevel(skill.damageDownByLevel,level);
        if(damageDown!==undefined){
            parts.push(
                skill.damageDownChance+"%機率降低造成傷害"+
                damageDown+"%，持續"+(skill.damageDownDuration||1)+"回合"
            );
        }

        const defenseDown=valueAtLevel(skill.defenseDownByLevel,level);
        if(defenseDown!==undefined){
            parts.push(
                skill.defenseDownChance+"%機率降低防禦"+
                defenseDown+"%，持續"+(skill.defenseDownDuration||2)+"回合"
            );
        }

        const missBonus=valueAtLevel(skill.missBonusByLevel,level);
        if(missBonus!==undefined){
            parts.push(
                skill.stunChance+"%機率暈眩"+
                (skill.stunDuration||2)+"回合，MISS率提高"+missBonus+"%"
            );
        }

        const petrifyChance=valueAtLevel(skill.petrifyChanceByLevel,level);
        if(petrifyChance!==undefined){
            parts.push(
                petrifyChance+"%機率石化"+
                (skill.petrifyDuration||2)+"回合"
            );
        }

        const selfShield=valueAtLevel(skill.selfShieldByLevel,level);
        if(selfShield!==undefined){
            parts.push(
                "自身護盾"+selfShield+"點，持續"+
                (skill.shieldDuration||2)+"回合"
            );
        }

        const allyShield=valueAtLevel(skill.allyShieldByLevel,level);
        if(allyShield!==undefined){
            parts.push(
                "我方全體護盾"+allyShield+"點，持續"+
                (skill.shieldDuration||2)+"回合"
            );
        }

        const critBonus=valueAtLevel(skill.critBonusByLevel,level);
        if(skill.category==="buff" && critBonus!==undefined){
            parts.push(
                "我方爆擊率與爆擊傷害 +"+critBonus+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.evasionBonusPercent!==undefined){
            parts.push(
                "閃躲率 +"+skill.evasionBonusPercent+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.defenseBonusPercent!==undefined){
            parts.push(
                "防禦力 +"+skill.defenseBonusPercent+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.reflectPercent!==undefined){
            parts.push(
                "反傷 "+skill.reflectPercent+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff" && skill.statusResistBonus!==undefined){
            parts.push(
                "異常狀態抗性 +"+skill.statusResistBonus+
                "%，持續"+skill.duration+"回合"
            );
        }
        else if(skill.category==="buff"){
            parts.push(skill.description);
        }

        if(skill.category==="heal"){
            let hpCoefficient=1.25;
            let spCoefficient=.5;
            try{
                if(typeof HEALING_INT_COEFFICIENT!=="undefined"){
                    hpCoefficient=HEALING_INT_COEFFICIENT;
                }
                if(typeof SP_HEALING_INT_COEFFICIENT!=="undefined"){
                    spCoefficient=SP_HEALING_INT_COEFFICIENT;
                }
            }catch(error){}

            const hpBase=Number(skill.baseHeal||0)+Number(skill.healPerLevel||0)*(level-1);
            const spBase=Number(skill.baseHealSP||0)+Number(skill.healSPPerLevel||0)*(level-1);
            parts.push(
                "回復HP：基礎"+hpBase+"＋智力×"+hpCoefficient+
                "；回復SP：基礎"+spBase+"＋智力×"+spCoefficient+
                "（施放者本人不回復SP）"
            );
        }

        const revivePercent=valueAtLevel(skill.reviveHealPercentByLevel,level);
        if(skill.category==="revive" && revivePercent!==undefined){
            parts.push("復活並恢復"+revivePercent+"%最大HP");
        }

        if(skill.category==="passive"){
            parts.push(skill.description);
        }

        if(parts.length<1){
            parts.push(skill.description||"依技能說明生效。");
        }

        return Array.from(new Set(parts.filter(Boolean)));
    }

    function buildCreationSkillLevelRows(skill){
        const maxLevel=Math.max(1,Number(skill.maxLevel)||1);
        const rows=[];

        for(let level=1;level<=maxLevel;level++){
            const details=skillLevelParts(skill,level);
            rows.push(
                '<div class="creation-skill-detail-level-row">'+
                    '<b>Lv.'+level+'</b>'+
                    '<span>'+details.map(escapeHTML).join("｜")+'</span>'+
                '</div>'
            );
        }

        return rows.join("");
    }

    function ensureCreationSkillDetailModal(){
        let modal=byId("creationSkillDetailModal");
        if(modal){
            return modal;
        }

        const overlay=byId("game-overlay-layer");
        if(!overlay){
            return null;
        }

        modal=document.createElement("div");
        modal.id="creationSkillDetailModal";
        modal.setAttribute("role","dialog");
        modal.setAttribute("aria-modal","true");
        modal.setAttribute("aria-hidden","true");
        modal.setAttribute("aria-labelledby","creationSkillDetailName");
        modal.innerHTML=
            '<div class="creation-skill-detail-box">'+
                '<div class="creation-skill-detail-header">'+
                    '<div id="creationSkillDetailGlyph" class="creation-skill-detail-glyph">技</div>'+
                    '<div class="creation-skill-detail-heading">'+
                        '<div id="creationSkillDetailName" class="creation-skill-detail-name">技能介紹</div>'+
                        '<div id="creationSkillDetailPath" class="creation-skill-detail-path"></div>'+
                    '</div>'+
                    '<button id="creationSkillDetailX" class="creation-skill-detail-x" type="button" aria-label="關閉技能介紹">×</button>'+
                '</div>'+
                '<div id="creationSkillDetailTags" class="creation-skill-detail-tags"></div>'+
                '<div id="creationSkillDetailDescription" class="creation-skill-detail-description"></div>'+
                '<div id="creationSkillDetailMeta" class="creation-skill-detail-meta"></div>'+
                '<div class="creation-skill-detail-section-title">各等級數值</div>'+
                '<div id="creationSkillDetailLevels" class="creation-skill-detail-levels"></div>'+
                '<button id="creationSkillDetailClose" class="creation-skill-detail-close" type="button">關閉</button>'+
            '</div>';

        overlay.appendChild(modal);

        modal.addEventListener("click",function(event){
            if(event.target===modal){
                window.closeCreationSkillDetail();
            }
        });

        byId("creationSkillDetailX").addEventListener("click",window.closeCreationSkillDetail);
        byId("creationSkillDetailClose").addEventListener("click",window.closeCreationSkillDetail);
        return modal;
    }

    let creationSkillDetailReturnFocus=null;

    window.showCreationSkillDetail=function(skillId){
        if(typeof skillDatabase==="undefined"){
            return;
        }

        const skill=skillDatabase[skillId];
        const modal=ensureCreationSkillDetailModal();
        const page=byId("creationPage");
        if(!skill || !modal || !page){
            return;
        }

        creationSkillDetailReturnFocus=document.activeElement;
        modal.dataset.element=skill.element||"fire";

        const elementLabels={fire:"火",water:"水",wind:"風",earth:"土"};
        byId("creationSkillDetailGlyph").textContent=elementLabels[skill.element]||"技";
        byId("creationSkillDetailName").textContent=skill.name;
        byId("creationSkillDetailPath").textContent=
            (elementLabels[skill.element]||"元素")+"系 · "+
            creationSkillCategoryLabel(skill.category);
        byId("creationSkillDetailDescription").textContent=skill.description||"";

        const tags=[
            creationSkillCategoryLabel(skill.category),
            creationSkillTargetLabel(skill.targetType),
            "最高 Lv."+(skill.maxLevel||1)
        ];
        byId("creationSkillDetailTags").innerHTML=tags
            .map(function(text){
                return '<span class="creation-skill-detail-tag">'+escapeHTML(text)+'</span>';
            })
            .join("");

        const meta=[];
        const spCost=skill.spCost!==undefined?skill.spCost:skill.cost;
        if(skill.category==="passive"){
            meta.push("被動技能，不用裝備，學習後永久生效");
        }
        else if(spCost!==undefined){
            meta.push("消耗 "+spCost+" SP");
        }
        if(skill.learnCost!==undefined){
            meta.push("學習需要 "+skill.learnCost+" 技能點");
        }
        if(Array.isArray(skill.requires) && skill.requires.length){
            meta.push(
                "前置技能："+skill.requires
                    .map(function(id){
                        return skillDatabase[id]?skillDatabase[id].name:id;
                    })
                    .join("、")
            );
        }
        byId("creationSkillDetailMeta").textContent=meta.join("｜");
        byId("creationSkillDetailLevels").innerHTML=buildCreationSkillLevelRows(skill);
        byId("creationSkillDetailLevels").scrollTop=0;

        page.classList.add("creation-skill-detail-open");
        page.inert=true;
        page.setAttribute("aria-hidden","true");
        modal.classList.add("show");
        modal.setAttribute("aria-hidden","false");

        window.setTimeout(function(){
            const closeButton=byId("creationSkillDetailX");
            if(closeButton){
                closeButton.focus({preventScroll:true});
            }
        },0);
    };

    window.closeCreationSkillDetail=function(){
        const modal=byId("creationSkillDetailModal");
        const page=byId("creationPage");

        if(modal){
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden","true");
        }

        if(page){
            page.classList.remove("creation-skill-detail-open");
            page.inert=false;
            page.removeAttribute("aria-hidden");
        }

        const focusTarget=creationSkillDetailReturnFocus;
        creationSkillDetailReturnFocus=null;
        window.setTimeout(function(){
            if(
                focusTarget &&
                focusTarget.isConnected &&
                page &&
                window.getComputedStyle(page).display!=="none"
            ){
                focusTarget.focus({preventScroll:true});
            }
        },0);
    };

    document.addEventListener("keydown",function(event){
        const modal=byId("creationSkillDetailModal");
        if(event.key==="Escape" && modal && modal.classList.contains("show")){
            event.preventDefault();
            window.closeCreationSkillDetail();
        }
    });

    function renderCreationShowcase(element){
        const page=byId("creationPage");
        if(!page){return;}

        const chosen=META[element]?element:"fire";
        const meta=META[chosen];
        page.dataset.element=chosen;
        page.dataset.gender=selectedGender;

        const portrait=byId("creationPortrait");
        if(portrait){
            portrait.src=PORTRAITS[selectedGender][chosen];
            portrait.alt=(chosen==="fire"?"火":chosen==="water"?"水":chosen==="wind"?"風":"土")+
                "元素"+(selectedGender==="male"?"男性":"女性")+"角色立繪";
        }

        const labelMap={fire:"火元素",water:"水元素",wind:"風元素",earth:"土元素"};
        if(byId("creationPortraitElement")){byId("creationPortraitElement").textContent=labelMap[chosen];}
        if(byId("creationPortraitGender")){byId("creationPortraitGender").textContent=selectedGender==="male"?"少俠":"女俠";}
        if(byId("creationElementBadge")){byId("creationElementBadge").textContent=meta.glyph;}
        if(byId("creationElementTitle")){byId("creationElementTitle").textContent=meta.title;}
        if(byId("creationElementRole")){byId("creationElementRole").textContent=meta.role;}
        if(byId("creationElementDescription")){byId("creationElementDescription").textContent=meta.description;}

        const tags=byId("creationElementTags");
        if(tags){
            tags.innerHTML="";
            meta.tags.forEach(function(text){
                const tag=document.createElement("span");
                tag.className="creation-role-tag";
                tag.textContent=text;
                tags.appendChild(tag);
            });
        }

    }

    window.selectCreationGender=function(gender){
        selectedGender=gender==="male"?"male":"female";

        const female=byId("creationGenderFemale");
        const male=byId("creationGenderMale");
        if(female){female.classList.toggle("selected",selectedGender==="female");}
        if(male){male.classList.toggle("selected",selectedGender==="male");}

        let element="fire";
        try{
            if(typeof selectedCreationElement!=="undefined" && META[selectedCreationElement]){
                element=selectedCreationElement;
            }
        }catch(error){}
        renderCreationShowcase(element);
    };

    /* Keep one source of truth for element mechanics: use the existing selectElement().
       This wrapper only adds the new creation-page visual refresh. */
    if(typeof window.selectElement==="function"){
        const originalSelectElement=window.selectElement;
        window.selectElement=function(element){
            const result=originalSelectElement.apply(this,arguments);
            renderCreationShowcase(element);
            return result;
        };
    }

    /* Gender is presentation/profile data only. It does not alter any formulas.
       Assign before the existing createCharacter() saves player. */
    if(typeof window.createCharacter==="function"){
        const originalCreateCharacter=window.createCharacter;
        window.createCharacter=function(){
            try{
                if(typeof player!=="undefined"){
                    player.gender=selectedGender;
                }
            }catch(error){}
            try{
                return originalCreateCharacter.apply(this,arguments);
            }finally{
                /* 驗證失敗時創角頁仍會顯示，不能提前關掉手機垂直滑動。 */
                syncCreationTouchMode();
            }
        };
    }

    if(typeof window.showCreation==="function"){
        const originalShowCreation=window.showCreation;
        window.showCreation=function(){
            migrateCreationPageToNativeLayer();
            try{
                return originalShowCreation.apply(this,arguments);
            }finally{
                setCreationTouchMode(true);
                installCreationGestureLock();
                applyCreationStep(1);
                renderCreationShowcase(
                    (typeof selectedCreationElement!=="undefined" && META[selectedCreationElement])
                    ? selectedCreationElement
                    : "fire"
                );
            }
        };
    }

    /* Existing saves do not contain gender. Defaulting to female is backward-compatible. */
    try{
        if(typeof player!=="undefined" && player && (player.gender==="male" || player.gender==="female")){
            selectedGender=player.gender;
        }
    }catch(error){}

    const initialElement=(function(){
        try{
            return (typeof selectedCreationElement!=="undefined" && META[selectedCreationElement])
                ? selectedCreationElement
                : "fire";
        }catch(error){
            return "fire";
        }
    })();

    migrateCreationPageToNativeLayer();
    installCreationGestureLock();
    applyCreationStep(1);
    window.selectCreationGender(selectedGender);
    renderCreationShowcase(initialElement);
    syncCreationTouchMode();

    window.getCreationNativeLayoutDiagnostics=function(){
        const page=migrateCreationPageToNativeLayer();
        const shell=page && page.querySelector(".creation-premium-shell");
        if(!page){return null;}
        const pageStyle=window.getComputedStyle(page);
        const shellStyle=shell?window.getComputedStyle(shell):null;
        return {
            parentId:page.parentElement?page.parentElement.id:null,
            nativeWidth:pageStyle.width,
            nativeHeight:pageStyle.height,
            transform:pageStyle.transform,
            overflowY:pageStyle.overflowY,
            pointerEvents:pageStyle.pointerEvents,
            shellPadding:shellStyle?shellStyle.padding:null,
            migration:page.dataset.nativeMigration||null,
            prepaint:page.dataset.nativePrepaint||null,
            fixedMode:document.documentElement.classList.contains("creation-fixed-active"),
            step:selectedCreationStep,
            skillPreviewPresent:!!byId("creationPhysicalSkills")
        };
    };

    /* No MutationObserver / extra touch listeners.
       A second sync after current call stack covers loadGame() timing safely. */
    window.setTimeout(syncCreationTouchMode,0);
})();
