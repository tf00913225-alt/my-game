/* V131 — Q版巡怪形象 + 已創建角色形象切換。 */
(function installV131PatrolAppearance(){
    "use strict";

    const STORAGE_KEY="v131_patrol_character_index";
    const TRANSPARENT_PIXEL="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    const chunks=Array.isArray(window.V131_PATROL_SPRITE_CHUNKS)
        ? window.V131_PATROL_SPRITE_CHUNKS
        : [];

    if(chunks.length<6 || chunks.some(chunk=>!chunk)){
        console.warn("V131 patrol sprite data incomplete; keep legacy patrol artwork.");
        return;
    }

    const spriteUrl="data:image/webp;base64,"+chunks.join("");
    const spriteCells={
        fire:{front:[0,0],back:[1,0]},
        water:{front:[2,0],back:[0,1]},
        wind:{front:[1,1],back:[2,1]},
        earth:{front:[0,2],back:[1,2]}
    };

    /*
       ★ 男角 Q 版（新增）：目前上傳素材只有正面（沒有背面），
       所以只用一張 2x2 sprite（火/水/風/土 各一格），
       front/back 都指向同一格，移動方向不影響顯示。
       缺這組資料時（尚未載入或載入失敗）就自動退回
       只用女角那組 sprite，不影響既有行為。
    */
    const maleChunks=Array.isArray(window.V131_PATROL_SPRITE_MALE_CHUNKS)
        ? window.V131_PATROL_SPRITE_MALE_CHUNKS
        : [];
    const maleSpriteReady=maleChunks.length>=9 && maleChunks.every(chunk=>!!chunk);
    const maleSpriteUrl=maleSpriteReady
        ? "data:image/webp;base64,"+maleChunks.join("")
        : null;
    const maleSpriteCells={
        fire:[0,0],
        water:[1,0],
        wind:[0,1],
        earth:[1,1]
    };

    function isMaleCharacter(character){
        return !!(character && character.gender==="male");
    }

    function maleBackgroundPosition(cell){
        return (cell[0]===0?"0%":"100%")+" "+(cell[1]===0?"0%":"100%");
    }

    let selectedIndex=Number(localStorage.getItem(STORAGE_KEY));
    if(!Number.isInteger(selectedIndex)){ selectedIndex=0; }

    function existingIndexes(){
        if(typeof getExistingPartyIndexes==="function"){
            return getExistingPartyIndexes().filter(index=>{
                return typeof getPartyCharacterByIndex==="function" && !!getPartyCharacterByIndex(index);
            });
        }
        return [0,1,2].filter(index=>{
            const character=index===0 ? player : index===1 ? player2 : player3;
            return !!character;
        });
    }

    function getCharacter(index){
        if(typeof getPartyCharacterByIndex==="function"){
            return getPartyCharacterByIndex(index);
        }
        return index===0 ? player : index===1 ? player2 : player3;
    }

    function normalizeSelection(){
        const indexes=existingIndexes();
        if(indexes.length===0){ selectedIndex=0; return 0; }
        if(!indexes.includes(selectedIndex)){
            selectedIndex=indexes[0];
            localStorage.setItem(STORAGE_KEY,String(selectedIndex));
        }
        return selectedIndex;
    }

    function getElementKey(character){
        const key=String((character && (character.element||character.elementType))||"fire").toLowerCase();
        return spriteCells[key] ? key : "fire";
    }

    function backgroundPosition(cell){
        const col=cell[0];
        const row=cell[1];
        return (col===0?"0%":col===1?"50%":"100%")+" "+
               (row===0?"0%":row===1?"50%":"100%");
    }

    function applyPatrolArt(facingBack){
        const img=document.getElementById("patrolCharacterImg");
        if(!img){ return; }
        const index=normalizeSelection();
        const character=getCharacter(index);
        if(!character){ return; }
        const element=getElementKey(character);

        img.src=TRANSPARENT_PIXEL;
        img.classList.add("v131-patrol-q-art");
        img.style.setProperty("width","70px","important");
        img.style.setProperty("height","105px","important");
        img.style.setProperty("background-repeat","no-repeat","important");

        if(maleSpriteUrl && isMaleCharacter(character)){
            const cell=maleSpriteCells[element];
            img.style.setProperty("background-image",'url("'+maleSpriteUrl+'")',"important");
            img.style.setProperty("background-size","200% 200%","important");
            img.style.setProperty("background-position",maleBackgroundPosition(cell),"important");
        }
        else{
            const cell=spriteCells[element][facingBack ? "back" : "front"];
            img.style.setProperty("background-image",'url("'+spriteUrl+'")',"important");
            img.style.setProperty("background-size","300% 300%","important");
            img.style.setProperty("background-position",backgroundPosition(cell),"important");
        }

        img.alt=(character.id||("角色"+(index+1)))+"巡怪形象";
        img.dataset.v131PatrolCharacter=String(index);
        img.dataset.v131Facing=facingBack ? "back" : "front";
    }

    function refreshChoicePanel(){
        const panel=document.getElementById("v131PatrolAppearancePanel");
        if(!panel){ return; }
        normalizeSelection();
        panel.innerHTML="";
        existingIndexes().forEach(index=>{
            const character=getCharacter(index);
            if(!character){ return; }
            const button=document.createElement("button");
            button.type="button";
            button.className="v131-patrol-choice"+(index===selectedIndex?" active":"");
            button.textContent=character.id||("角色"+(index+1));
            button.setAttribute("aria-pressed",index===selectedIndex?"true":"false");
            button.addEventListener("click",function(event){
                event.preventDefault();
                event.stopPropagation();
                selectPatrolCharacter(index);
                panel.classList.remove("show");
            });
            panel.appendChild(button);
        });
    }

    function selectPatrolCharacter(index){
        const candidate=Number(index);
        if(!existingIndexes().includes(candidate)){ return; }
        selectedIndex=candidate;
        localStorage.setItem(STORAGE_KEY,String(selectedIndex));
        const img=document.getElementById("patrolCharacterImg");
        const facingBack=!!(img && img.dataset.v131Facing==="back");
        applyPatrolArt(facingBack);
        refreshChoicePanel();
    }
    window.v131SelectPatrolCharacter=selectPatrolCharacter;

    function installSwitcher(){
        const page=document.getElementById("mapPage");
        if(!page || document.getElementById("v131PatrolAppearanceSwitchWrap")){ return; }

        const wrap=document.createElement("div");
        wrap.id="v131PatrolAppearanceSwitchWrap";
        wrap.style.setProperty("--v131-patrol-sprite",'url("'+spriteUrl+'")');

        const button=document.createElement("button");
        button.id="v131PatrolAppearanceSwitch";
        button.type="button";
        button.setAttribute("aria-label","形象切換");
        button.title="形象切換";

        const iconViewport=document.createElement("span");
        iconViewport.className="v131-switch-icon-viewport";
        const icon=document.createElement("span");
        icon.className="v131-switch-icon-sprite";
        iconViewport.appendChild(icon);
        button.appendChild(iconViewport);

        const panel=document.createElement("div");
        panel.id="v131PatrolAppearancePanel";
        panel.setAttribute("aria-label","選擇巡怪角色形象");

        button.addEventListener("click",function(event){
            event.preventDefault();
            event.stopPropagation();
            refreshChoicePanel();
            panel.classList.toggle("show");
        });

        wrap.addEventListener("click",function(event){ event.stopPropagation(); });
        page.addEventListener("click",function(){ panel.classList.remove("show"); });

        wrap.appendChild(button);
        wrap.appendChild(panel);
        page.appendChild(wrap);
        refreshChoicePanel();
    }

    if(typeof resetPatrolCharacterToIdle==="function"){
        const originalResetPatrolCharacterToIdle=resetPatrolCharacterToIdle;
        resetPatrolCharacterToIdle=function(){
            const result=originalResetPatrolCharacterToIdle.apply(this,arguments);
            applyPatrolArt(false);
            refreshChoicePanel();
            return result;
        };
    }

    if(typeof movePatrolCharacterRandomly==="function"){
        const originalMovePatrolCharacterRandomly=movePatrolCharacterRandomly;
        movePatrolCharacterRandomly=function(){
            if(typeof patrolInFightAnimation!=="undefined" && patrolInFightAnimation){
                return originalMovePatrolCharacterRandomly.apply(this,arguments);
            }
            const before=typeof patrolCurrentTop==="number" ? patrolCurrentTop : 37;
            const result=originalMovePatrolCharacterRandomly.apply(this,arguments);
            const after=typeof patrolCurrentTop==="number" ? patrolCurrentTop : before;
            applyPatrolArt(after<before);
            return result;
        };
    }

    function boot(){
        normalizeSelection();
        installSwitcher();
        applyPatrolArt(false);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{
        boot();
    }
})();
