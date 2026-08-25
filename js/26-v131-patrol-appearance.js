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

    const CELL_W=56;
    const CELL_H=84;

    function loadImageAsync(url){
        return new Promise(function(resolve,reject){
            const image=new Image();
            image.onload=function(){ resolve(image); };
            image.onerror=reject;
            image.src=url;
        });
    }

    const cropCanvas=document.createElement("canvas");
    cropCanvas.width=CELL_W;
    cropCanvas.height=CELL_H;
    const cropCtx=cropCanvas.getContext("2d");

    function cropCellDataUrl(sheetImage,col,row){
        cropCtx.clearRect(0,0,CELL_W,CELL_H);
        cropCtx.drawImage(
            sheetImage,
            col*CELL_W,row*CELL_H,CELL_W,CELL_H,
            0,0,CELL_W,CELL_H
        );
        return cropCanvas.toDataURL("image/png");
    }

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
        const cell=cellMap[element][facingBack ? "back" : "front"];

        if(sheetImage){
            const cropped=cropCellDataUrl(sheetImage,cell[0],cell[1]);
            img.src=cropped;
            updateSwitchIcon(cropped);
        }

        img.alt=(character.id||("角色"+(index+1)))+"巡怪形象";
        img.dataset.v131PatrolCharacter=String(index);
        img.dataset.v131Facing=facingBack ? "back" : "front";
    }

    /*
       ★ 修正（依照使用者要求，「形象切換按鈕圖片畫質太差、
       按鈕太小」）：
       原本形象切換按鈕的icon是寫死套用女角sprite的
       固定一格（不管玩家目前選的是誰），而且是拿
       background-image+background-position硬摳
       一小塊出來顯示，跟主要巡怪立繪原本踩到的白色
       方塊是同一種寫法（只是span沒有img那個bug，
       沒有整個裁到看不到而已）。
       這裡改成：每次套用巡怪立繪時，直接把「剛剛裁切好
       這一格」的裁切結果（跟主要立繪同一張圖）也套到
       按鈕icon上，永遠顯示「目前真正選中的角色」，
       不再寫死女角。畫質仍然受限於原始sprite本身的
       解析度（56x84，是為了控制檔案大小刻意壓縮的），
       放大顯示能改善的有限，如果需要更清晰的按鈕icon，
       需要另外提供一組解析度更高的素材專門給這個按鈕用。
    */
    function updateSwitchIcon(croppedDataUrl){
        const icon=document.querySelector(
            "#v131PatrolAppearanceSwitchWrap .v131-switch-icon-sprite"
        );
        if(!icon){ return; }
        icon.style.backgroundImage='url("'+croppedDataUrl+'")';
        icon.style.backgroundSize="cover";
        icon.style.backgroundPosition="center 20%";
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
