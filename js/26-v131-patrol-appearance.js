/* V131 — Q版巡怪形象 + 已創建角色形象切換。 */
(function installV131PatrolAppearance(){
    "use strict";

    const STORAGE_KEY="v131_patrol_character_index";

    /*
       ★ 修正（巡怪空白方塊 bug 的根源修法）：
       原本用「img.src設1x1透明GIF佔位 +
       CSS background-image疊上真正的圖」這招，
       在Chromium（至少目前這個版本）上，
       只要<img>的src是一張能成功解碼的圖片
       （就算只有1x1、全透明），背景圖大部分
       區域就會被畫成不透明白色，跟
       object-fit、素材內容都無關——用最小
       重現案例驗證過：同樣的background-image
       套在完全沒有src的<div>上完全正常，
       套在有合法src的<img>上就會出現白色。

       遊戲原本（V131之前）的巡怪立繪就是直接
       img.src=PATROL_CHAR_FRONT_B64，不透過
       CSS背景疊圖，所以沒有踩到這個問題。

       改成同樣的作法：不用CSS背景疊圖，
       而是用一個共用的<canvas>把sprite sheet
       裡需要的那一格「裁」成一張獨立的圖片
       （canvas.toDataURL()），直接設定
       img.src，這樣<img>顯示的就是它自己
       真正的內容，不會再有背景圖被蓋掉的問題。
    */

    /*
       ★ 修正（依照使用者要求，「巡怪立繪的解析度變得那麼
       低，幫我徹底修好」）：
       女角sprite原本跟男角共用同一組56x84裁切格，這個
       尺寸是刻意壓縮控制檔案大小，但70x105顯示、手機
       螢幕通常又是2~3倍DPI，56x84的來源在螢幕上等於只有
       不到1倍的實際像素，看起來明顯模糊。女角這次重新
       用更高解析度的來源圖建置sprite，格子尺寸放大到
       140x210（等於顯示尺寸的2倍，retina螢幕下依然清晰）。
       男角sprite沒有一起換新素材，維持原本56x84不變，
       所以裁切格尺寸不能再共用同一個常數/同一張裁切用
       canvas，改成裁切函式接受cellW/cellH參數，各自
       建立自己尺寸的canvas。
    */
    const FEMALE_CELL_W=140;
    const FEMALE_CELL_H=210;
    const MALE_CELL_W=56;
    const MALE_CELL_H=84;

    function loadImageAsync(url){
        return new Promise(function(resolve,reject){
            const image=new Image();
            image.onload=function(){ resolve(image); };
            image.onerror=reject;
            image.src=url;
        });
    }

    function makeCropper(cellW,cellH){
        const canvas=document.createElement("canvas");
        canvas.width=cellW;
        canvas.height=cellH;
        const ctx=canvas.getContext("2d");
        return function cropCellDataUrl(sheetImage,col,row){
            ctx.clearRect(0,0,cellW,cellH);
            ctx.drawImage(
                sheetImage,
                col*cellW,row*cellH,cellW,cellH,
                0,0,cellW,cellH
            );
            return canvas.toDataURL("image/png");
        };
    }

    const cropFemaleCell=makeCropper(FEMALE_CELL_W,FEMALE_CELL_H);
    const cropMaleCell=makeCropper(MALE_CELL_W,MALE_CELL_H);

    const chunks=Array.isArray(window.V131_PATROL_SPRITE_CHUNKS)
        ? window.V131_PATROL_SPRITE_CHUNKS
        : [];

    if(chunks.length<43 || chunks.some(chunk=>!chunk)){
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
       ★ 男角 Q 版（新增，2026-08-25 補上背面後更新）：
       4 欄（火/水/風/土）× 2 列（正面/背面）的 sprite，
       跟女角那組一樣支援移動方向切換正背面。
       缺這組資料時（尚未載入或載入失敗）就自動退回
       只用女角那組 sprite，不影響既有行為。
    */
    const maleChunks=Array.isArray(window.V131_PATROL_SPRITE_MALE_CHUNKS)
        ? window.V131_PATROL_SPRITE_MALE_CHUNKS
        : [];
    const maleSpriteReady=maleChunks.length>=18 && maleChunks.every(chunk=>!!chunk);
    const maleSpriteUrl=maleSpriteReady
        ? "data:image/webp;base64,"+maleChunks.join("")
        : null;
    const maleSpriteCells={
        fire:{front:[0,0],back:[0,1]},
        water:{front:[1,0],back:[1,1]},
        wind:{front:[2,0],back:[2,1]},
        earth:{front:[3,0],back:[3,1]}
    };

    function isMaleCharacter(character){
        return !!(character && character.gender==="male");
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

    let femaleSheetImage=null;
    let maleSheetImage=null;

    const spritesReady=Promise.all([
        loadImageAsync(spriteUrl).then(function(image){ femaleSheetImage=image; }),
        maleSpriteUrl
            ? loadImageAsync(maleSpriteUrl).then(function(image){ maleSheetImage=image; }).catch(function(){ maleSheetImage=null; })
            : Promise.resolve()
    ]).catch(function(error){
        console.error("V131 巡怪 sprite 圖片載入失敗：",error);
    });

    function applyPatrolArt(facingBack){
        const img=document.getElementById("patrolCharacterImg");
        if(!img){ return; }
        const index=normalizeSelection();
        const character=getCharacter(index);
        if(!character){ return; }
        const element=getElementKey(character);

        img.classList.add("v131-patrol-q-art");
        img.style.setProperty("width","70px","important");
        img.style.setProperty("height","105px","important");

        const useMale=!!(maleSheetImage && isMaleCharacter(character));
        const sheetImage=useMale ? maleSheetImage : femaleSheetImage;
        const cellMap=useMale ? maleSpriteCells : spriteCells;
        const cropCell=useMale ? cropMaleCell : cropFemaleCell;
        const cell=cellMap[element][facingBack ? "back" : "front"];

        if(sheetImage){
            const cropped=cropCell(sheetImage,cell[0],cell[1]);
            img.src=cropped;
        }

        img.alt=(character.id||("角色"+(index+1)))+"巡怪形象";
        img.dataset.v131PatrolCharacter=String(index);
        img.dataset.v131Facing=facingBack ? "back" : "front";
    }

    /*
       ★ 修正（依照使用者要求，「形象切換按鈕圖片畫質太差、
       按鈕太小」，這次再依照使用者要求「有形象切換icon，
       幫我換上去」）：
       原本按鈕icon是拿目前選中角色sprite裁切出來的一小格
       （56x84低解析度來源），放大後仍然模糊。使用者改為
       提供一張專屬的「形象切換」功能徽章圖（固定圖案，
       不隨角色改變），改用這張高畫質靜態圖當按鈕icon，
       不再每次套用巡怪立繪時動態更換icon內容。
    */
    const SWITCH_BUTTON_ICON_URL="assets/ui/patrol-appearance-switch-icon.png";

    function updateSwitchIcon(){
        const icon=document.querySelector(
            "#v131PatrolAppearanceSwitchWrap .v131-switch-icon-sprite"
        );
        if(!icon){ return; }
        icon.style.backgroundImage='url("'+SWITCH_BUTTON_ICON_URL+'")';
        icon.style.backgroundSize="cover";
        icon.style.backgroundPosition="center center";
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
        updateSwitchIcon();
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
        spritesReady.then(function(){
            applyPatrolArt(false);
        });
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{
        boot();
    }
})();
