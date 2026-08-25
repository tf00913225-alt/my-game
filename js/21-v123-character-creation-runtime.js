/* =====================================================
   V123 — CHARACTER CREATION RUNTIME
   - Gender / portrait switching
   - Element positioning + live skill preview from skillDatabase
   - Android Chrome creation-page native scroll mode
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

    function byId(id){
        return document.getElementById(id);
    }

    function setCreationTouchMode(active){
        [
            document.documentElement,
            document.body,
            byId("game-viewport"),
            byId("game-stage")
        ].forEach(function(node){
            if(node){
                node.classList.toggle("creation-scroll-active",!!active);
            }
        });
    }

    function syncCreationTouchMode(){
        const page=byId("creationPage");
        const visible=!!page && window.getComputedStyle(page).display!=="none";
        setCreationTouchMode(visible);
    }

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
            const chip=document.createElement("span");
            chip.className="creation-skill-chip"+(index===skills.length-1?" signature":"");
            chip.textContent=skill.name;
            chip.title=skill.description||skill.name;
            box.appendChild(chip);
        });
    }

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

        renderSkillChips("creationPhysicalSkills",orderedSkills(chosen,"physical"));
        renderSkillChips("creationMagicSkills",orderedSkills(chosen,"magic"));
        renderSkillChips("creationSpecialSkills",specialSkills(chosen));
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
            const result=originalCreateCharacter.apply(this,arguments);
            /* 驗證失敗時創角頁仍會顯示，不能提前關掉手機垂直滑動。 */
            syncCreationTouchMode();
            return result;
        };
    }

    if(typeof window.showCreation==="function"){
        const originalShowCreation=window.showCreation;
        window.showCreation=function(){
            const result=originalShowCreation.apply(this,arguments);
            setCreationTouchMode(true);
            renderCreationShowcase(
                (typeof selectedCreationElement!=="undefined" && META[selectedCreationElement])
                ? selectedCreationElement
                : "fire"
            );
            return result;
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

    window.selectCreationGender(selectedGender);
    renderCreationShowcase(initialElement);
    syncCreationTouchMode();

    /* No MutationObserver / extra touch listeners.
       A second sync after current call stack covers loadGame() timing safely. */
    window.setTimeout(syncCreationTouchMode,0);
})();
