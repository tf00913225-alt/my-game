/* V131 — targeted gameplay/UI fixes for request batch 17. */
(function installV131FixBatch(){
    "use strict";

    /*
       ★ V138：節奏拆成兩個明確規則。
       - 每一位有效角色／怪物出手後，等 1.6 秒才輪下一位。
       - 一整輪最後一位出手到下一輪第一位出手，總共固定 2 秒。

       舊版共用一個 1.25 秒常數，而且已死亡的佇列成員仍會逐個
       呼叫 finishPlayerAction()、每個再多等一次，尾端剛好有
       2～3 個死亡成員時就會累積成玩家感受到的 3～5 秒。
       V138 會在排程前一次略過所有已死亡空位。2 秒總轉場由
       0.4 秒的回合交接＋1.6 秒的首位出手等待組成，不會錯疊成
       2+1.6＝3.6 秒，也不會再隨死亡數量越拖越久。
    */
    /* Historical diagnostic metadata only. The live timing owner is 00-main. */
    const V138_ACTION_DELAY_MS=1250;
    const V138_ROUND_TRANSITION_MS=1250;
    const V138_ROUND_HANDOFF_DELAY_MS=800;
    const V138_ROUND_ANNOUNCEMENT_DELAY_MS=450;
    const ELEMENT_BOX_REWARD_MS=8*60*60*1000;
    const ELEMENT_BOX_KEY=window.FourSymbolsAccountSave.accountKey("element-box-state");

    /*
       ★ 新增（依照使用者要求，經濟／養成重新設計第一輪）：
       1. 精英/BOSS的戰鬥EXP要比普通怪高（精英×1.5、BOSS×3），
          正式怪物 EXP 直接以怪物資料公式產生，再套 rank 倍率；不再
          透過全域歷史倍率補正。
       2. 元素匣（自動掛機）戰鬥的EXP只給70%，金幣/掉落/材料
          完全不受影響（那些是另外獨立的函式，這裡完全沒有動）。
          目的是讓「掛機」明顯比「手動玩」慢，避免無腦掛機
          就能在短時間衝到滿等。
    */
    const ELEMENT_BOX_EXP_RATIO=0.70;
    const V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3;
    const V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5;
    const V173_BEGINNER_FOREST_TARGET_BATTLES=20;
    const V173_BEGINNER_FOREST_FALLBACK_EXP=690;

    function getBeginnerForestBattleExp(){
        if(typeof window.v133GetExpNextForLevel!=="function"){
            return V173_BEGINNER_FOREST_FALLBACK_EXP;
        }
        let totalRequired=0;
        for(let level=1;level<=9;level++){
            totalRequired+=Math.max(1,Math.round(Number(window.v133GetExpNextForLevel(level))||0));
        }
        return Math.max(1,Math.ceil(totalRequired/V173_BEGINNER_FOREST_TARGET_BATTLES));
    }

    window.v173GetBeginnerForestBattleExp=getBeginnerForestBattleExp;

    function getBeginnerForestMonsterExpUnit(){
        /* V173.40 targeted ~20 battles using one flat battle reward.
           V173.42 keeps that old 3-monster reference value, but pays per
           defeated monster so 1 / 2 / 3 monsters are no longer identical. */
        return Math.max(1,Math.ceil(getBeginnerForestBattleExp()/3));
    }
    window.v17342GetBeginnerForestMonsterExpUnit=getBeginnerForestMonsterExpUnit;

    function getMonsterExpRankMultiplier(monster){
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    /* Formal base EXP: a normal monster's own reward before rank/mode rules.
       35 is the established Lv×10 × historical 3.5 result, now encoded at
       this data owner so every player-facing reward remains unchanged. */
    function getFormalMonsterBaseExp(monster){
        return Math.max(0,Math.floor((Number(monster&&monster.level)||0)*35));
    }

    function getPatrolProgressionExpMultiplier(level){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        return safeLevel<20 ? V17342_GLOBAL_EXP_REWARD_MULTIPLIER : 1;
    }

    function getPatrolProgressionReferenceLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel==="function"){
            return Math.max(1,Math.floor(Number(window.v133GetHighestCreatedCharacterLevel())||1));
        }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const indexes=getExistingPartyIndexes();
            if(indexes&&indexes.length){
                return indexes.reduce((highest,index)=>{
                    const character=getPartyCharacterByIndex(index);
                    return character?Math.max(highest,Math.floor(Number(character.level)||1)):highest;
                },1);
            }
        }
        return typeof player!=="undefined"&&player ? Math.max(1,Math.floor(Number(player.level)||1)) : 1;
    }

    function calculateStandardPatrolExp(monsterList,progressionLevel){
        const rankAdjustedExp=(Array.isArray(monsterList)?monsterList:[]).reduce((total,monster)=>{
            if(!monster){ return total; }
            return total+getFormalMonsterBaseExp(monster)*getMonsterExpRankMultiplier(monster);
        },0);
        return Math.max(0,Math.floor(
            rankAdjustedExp*getPatrolProgressionExpMultiplier(progressionLevel)
        ));
    }

    function applyPatrolExpMode(standardExp,options){
        const safeExp=Math.max(0,Math.floor(Number(standardExp)||0));
        const mode=options&&typeof options==="object"?options:{};
        if(mode.elementBox){ return Math.round(safeExp*ELEMENT_BOX_EXP_RATIO); }
        if(mode.rested){ return Math.round(safeExp*2); }
        return safeExp;
    }

    window.v173GetPatrolProgressionExpMultiplier=getPatrolProgressionExpMultiplier;
    window.v173GetFormalMonsterBaseExp=getFormalMonsterBaseExp;
    window.v173GetPatrolProgressionReferenceLevel=getPatrolProgressionReferenceLevel;
    window.v173CalculateStandardPatrolExp=calculateStandardPatrolExp;
    window.v173ApplyPatrolExpMode=applyPatrolExpMode;

    function getFormationRankWeight(monsterIndex){
        const monster=monsters[monsterIndex];
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 2; }
        return 1;
    }

    function fixedBattlefieldSlots(){
        return window.FourSymbolsBattlefieldSlots||null;
    }

    function bossEnemyFormationAuthority(owner){
        const boss=window.FourSymbolsBossBattle||null;
        if(!owner||!boss){ return {owns:false,snapshot:null}; }
        const existing=owner.getActiveEnemySnapshot();
        const active=typeof boss.isActive==="function"&&boss.isActive();
        const ownsExisting=typeof boss.ownsEnemyFormationSnapshot==="function"&&
            boss.ownsEnemyFormationSnapshot(existing);
        if(!active&&!ownsExisting){ return {owns:false,snapshot:null}; }
        const snapshot=typeof boss.getEnemyFormationSnapshot==="function"
            ?boss.getEnemyFormationSnapshot():existing;
        return {owns:true,snapshot:snapshot||null};
    }

    function ensureEnemyFormationSnapshot(indexes){
        const owner=fixedBattlefieldSlots();
        if(!owner){ return null; }
        const bossAuthority=bossEnemyFormationAuthority(owner);
        if(bossAuthority.owns){ return bossAuthority.snapshot; }
        const requested=(Array.isArray(indexes)?indexes:currentBattleMonsters||[])
            .filter(index=>Number.isInteger(index)).slice(0,10);
        if(!requested.length){ return null; }
        const existing=owner.getActiveEnemySnapshot();
        const activeMatches=existing&&requested.every(index=>!!owner.getEnemySlotForMonster(existing,index));
        if(activeMatches){ return existing; }
        if(!requested.length){ return null; }
        const snapshot=owner.createEnemyFormationSnapshot(requested,{
            encounterMode:owner.getCurrentEncounterMode(),
            originalFormationType:requested.length,
            rankWeight:getFormationRankWeight
        });
        owner.setActiveEnemySnapshot(snapshot);
        return snapshot;
    }

    function getFormationRows(indexes){
        const owner=fixedBattlefieldSlots();
        const requested=(indexes||[]).filter(index=>Number.isInteger(index)).slice(0,10);
        if(!owner){ return requested.length?[requested,[]]:[[],[]]; }
        const bossAuthority=bossEnemyFormationAuthority(owner);
        let snapshot=bossAuthority.owns?bossAuthority.snapshot:owner.getActiveEnemySnapshot();
        if(bossAuthority.owns&&!snapshot){ return [[],[]]; }
        const activeMatches=snapshot&&requested.every(index=>!!owner.getEnemySlotForMonster(snapshot,index));
        if(!bossAuthority.owns&&!activeMatches){
            snapshot=owner.createEnemyFormationSnapshot(requested,{
                encounterMode:owner.getCurrentEncounterMode(),
                originalFormationType:Math.max(1,requested.length),
                rankWeight:getFormationRankWeight
            });
        }
        const rows=owner.getAssignedEnemyRows(snapshot);
        while(rows.length<2){ rows.push([]); }
        return rows;
    }

    function currentFormationRows(){
        const snapshot=ensureEnemyFormationSnapshot(currentBattleMonsters);
        const owner=fixedBattlefieldSlots();
        if(snapshot&&owner){
            const rows=owner.getAssignedEnemyRows(snapshot);
            while(rows.length<2){ rows.push([]); }
            return rows;
        }
        return getFormationRows(currentBattleMonsters);
    }

    window.v138EnsureEnemyFormationSnapshot=ensureEnemyFormationSnapshot;

    function formatDuration(ms){
        const safe=Math.max(0,Math.floor(Number(ms)||0));
        const totalMinutes=Math.floor(safe/60000);
        const hours=Math.floor(totalMinutes/60);
        const minutes=totalMinutes%60;
        return hours+"小時 "+minutes+"分鐘";
    }

    /* Queue advancement belongs exclusively to 00-main.js. Earlier pacing
       wrappers duplicated finishPlayerAction/processNextCombatant and could
       strand an initiative entry when a visual Promise completed out of order. */


    function applyBattleFormation(){
        const area=document.getElementById("battleMonsterArea");
        const owner=fixedBattlefieldSlots();
        if(!area||!owner){ return; }
        /* Large Boss enemy geometry belongs to FourSymbolsBossBattle for the
           complete battle lifecycle. V131 still renders allies and its other
           presentation responsibilities, but it must never rebuild or project
           a normal enemy formation over the Boss-owned snapshot. */
        if(bossEnemyFormationAuthority(owner).owns){ return; }
        const indexes=currentBattleMonsters.slice(0,10);
        const snapshot=ensureEnemyFormationSnapshot(indexes);
        if(!snapshot){ return; }
        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battleMonster"+index);
            if(card){
                const monster=monsters[index];
                const rank=getMonsterRank(monster);
                card.dataset.element=(monster&&monster.element)||"unknown";
                card.dataset.rank=rank==="boss"?"boss":(rank==="elite"?"elite":"regular");
                cards.set(index,card);
            }
        });
        area.innerHTML="";
        area.classList.add("v131-formation","v-fixed-enemy-zone");
        area.dataset.monsterCount=String(indexes.length);
        area.dataset.formationType=String(snapshot.originalFormationType);
        owner.getEnemyRenderSlotRows(snapshot).forEach((rowSlots,rowIndex)=>{
            const rowEl=document.createElement("div");
            rowEl.className="v131-monster-row v131-monster-row-"+(rowIndex+1)+" v-fixed-enemy-row";
            rowSlots.forEach(slot=>{
                const slotEl=document.createElement("div");
                slotEl.className="v-fixed-battle-slot v-fixed-enemy-slot";
                slotEl.dataset.slot=slot;
                const index=owner.getAssignedMonsterAtEnemySlot(snapshot,slot);
                const card=Number.isInteger(index)?cards.get(index):null;
                if(card){
                    card.dataset.slot=slot;
                    slotEl.appendChild(card);
                }
                rowEl.appendChild(slotEl);
            });
            area.appendChild(rowEl);
        });
    }

    function ensureAllyFormationState(){
        const owner=fixedBattlefieldSlots();
        if(!owner||typeof owner.ensureAllyFormation!=="function"){ return null; }
        return owner.ensureAllyFormation(getExistingPartyIndexes());
    }

    function applyAllyBattleFormation(){
        const area=document.getElementById("battlePlayerRow");
        const formation=ensureAllyFormationState();
        if(!area||!formation){ return; }
        const cards=new Map();
        getExistingPartyIndexes().forEach(index=>{
            const card=document.getElementById("battlePlayerCard"+index);
            if(card){ cards.set(index,card); }
        });
        area.innerHTML="";
        area.classList.add("v-fixed-ally-formation");
        const owner=fixedBattlefieldSlots();
        [owner.allyFrontSlots,owner.allyBackSlots].forEach((slots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-ally-row v-fixed-ally-row-"+(rowIndex===0?"front":"back");
            slots.forEach(slot=>{
                const wrapper=document.createElement("div");
                wrapper.className="v-fixed-unit-slot v-fixed-ally-slot";
                wrapper.dataset.slot=slot;
                const characterIndex=owner.getCharacterAtAllySlot(slot);
                const card=Number.isInteger(characterIndex)?cards.get(characterIndex):null;
                if(card){ wrapper.appendChild(card); }
                row.appendChild(wrapper);
            });
            area.appendChild(row);
        });
    }

    let formationSelectedUnit=null;
    let formationInputAbort=null;
    let formationDrag=null;
    let formationMessage="";
    function formationPlayerIndexes(){
        return [0,1,2].filter(index=>getPartyCharacterByIndex(index)?.id);
    }
    function formationSlotLabel(slot){
        const meta=fixedBattlefieldSlots().slotMeta[slot];
        return (meta.row==="front"?"前":"後")+["左","中","右"][meta.column-1];
    }
    function formationPreview(){
        const confirmed=window.FourSymbolsTeamFormation.getConfirmed();
        if(confirmed)return confirmed;
        const indexes=formationPlayerIndexes();
        const state=fixedBattlefieldSlots().ensureAllyFormation(indexes);
        return {version:2,characterIndexToSlot:{...state.characterIndexToSlot},heroIdToSlot:{}};
    }
    function formationUnitAt(value,slot){
        const hero=Object.keys(value.heroIdToSlot).find(id=>value.heroIdToSlot[id]===slot);
        if(hero)return "hero:"+hero;
        const player=Object.keys(value.characterIndexToSlot).find(id=>value.characterIndexToSlot[id]===slot);
        return player===undefined?null:"player:"+player;
    }
    function formationUnitData(unit){
        if(!unit)return null;
        if(unit.startsWith("hero:")){
            const hero=getHeroPageSnapshot().heroes.find(row=>row.owned&&row.definition.heroId===unit.slice(5));
            return hero?{name:hero.definition.name,artwork:hero.artwork}:null;
        }
        const index=Number(unit.slice(7));
        const character=[0,1,2].includes(index)?getPartyCharacterByIndex(index):null;
        return character?.id?{name:character.id,artwork:getCharacterBattleArtworkPath(character)}:null;
    }
    function formationUnitContent(unit){
        const row=formationUnitData(unit);
        return row?'<img src="'+heroPageHtml(row.artwork)+'" alt="'+heroPageHtml(row.name)+'立繪" draggable="false"><b>'+heroPageHtml(row.name)+'</b>':'<span>空位</span>';
    }
    function formationEditingAllowed(){
        const status=window.FourSymbolsTeamFormation.getStatus();
        const indexes=formationPlayerIndexes();
        return !battleActive&&status.ready&&!status.busy&&!status.pending&&JSON.stringify(indexes)===JSON.stringify(status.playerIndexes);
    }
    function renderAllyFormationContent(){
        const value=formationPreview(),status=window.FourSymbolsTeamFormation.getStatus(),owner=fixedBattlefieldSlots();
        const row=(label,slots)=>'<section class="v-fixed-formation-row"><header>'+label+'</header><div data-drag-owner="formation" class="v-fixed-formation-slots">'+slots.map(slot=>{
            const unit=formationUnitAt(value,slot);
            return '<button type="button" class="v-fixed-formation-slot'+(unit===formationSelectedUnit&&unit?' selected':'')+'" data-slot="'+slot+'"'+(unit?' data-unit="'+heroPageHtml(unit)+'"':'')+' aria-label="'+formationSlotLabel(slot)+(unit?' '+heroPageHtml(formationUnitData(unit)?.name||''):' 空位')+'">'+formationUnitContent(unit)+'</button>';
        }).join('')+'</div></section>';
        const candidates=getHeroPageSnapshot().heroes.filter(hero=>hero.owned&&!Object.hasOwn(value.heroIdToSlot,hero.definition.heroId));
        const bg=typeof mapZoneBackgroundImages!=="undefined"?mapZoneBackgroundImages.forest:null;
        const background=bg?' style="background-image:linear-gradient(#09090955,#09090999),url(&quot;'+heroPageHtml(bg)+'&quot;)"':'';
        return '<div class="hero-page-shell v-fixed-formation-panel"><button type="button" class="main-button" onclick="returnFromFormation()">‹ 返回</button>'+
            '<div id="formationContent"><p class="hero-page-note">點擊角色再點格位，或拖曳交換位置。</p>'+
            '<div class="formation-battlefield"'+background+'>'+row('前排',owner.allyFrontSlots)+row('後排',owner.allyBackSlots)+'</div>'+
            '<div class="formation-candidates" aria-label="候選英雄">'+candidates.map(hero=>{
                const unit='hero:'+hero.definition.heroId;
                return '<button type="button" data-drag-owner="formation" class="formation-candidate'+(unit===formationSelectedUnit?' selected':'')+'" data-unit="'+heroPageHtml(unit)+'">'+formationUnitContent(unit)+'</button>';
            }).join('')+(candidates.length?'':'<p class="hero-page-note">目前沒有未上陣的已擁有英雄。</p>')+'</div>'+
            '</div>'+
            '<div class="formation-footer"><button type="button" class="formation-remove" data-remove="true">移出英雄</button><p role="status">'+heroPageHtml(formationMessage||status.error||(status.busy?'正在確認雲端紀錄…':status.pending?'前次保存結果尚未確認。':window.FourSymbolsTeamFormation.getConfirmed()?'已確認保存的佈陣。':'尚未保存佈陣；首次操作將建立紀錄。'))+'</p>'+
            '<button type="button" class="main-button" onclick="FourSymbolsTeamFormation.read()"'+(status.busy?' disabled':'')+'>同步佈陣</button>'+
            (status.pending?'<button type="button" class="main-button" onclick="FourSymbolsTeamFormation.retry()"'+(status.busy?' disabled':'')+'>確認前次保存</button>':'')+'</div></div>';
    }
    window.vFixedRenderAllyFormationContent=renderAllyFormationContent;
    async function placeFormationUnit(unit,targetSlot,remove=false){
        if(!formationEditingAllowed()||!formationUnitData(unit))return false;
        const value=formationPreview(),hero=unit.startsWith("hero:"),id=unit.slice(hero?5:7);
        const map=hero?value.heroIdToSlot:value.characterIndexToSlot,from=map[id];
        if(remove){if(!hero||!from)return false;delete map[id];}
        else{
            if(!fixedBattlefieldSlots().allySlots.includes(targetSlot))return false;
            const occupant=formationUnitAt(value,targetSlot);
            if(occupant&&occupant!==unit){
                if(!from)return false;
                const otherHero=occupant.startsWith("hero:"),otherMap=otherHero?value.heroIdToSlot:value.characterIndexToSlot;
                otherMap[occupant.slice(otherHero?5:7)]=from;
            }
            if(from===targetSlot)return true;
            map[id]=targetSlot;
        }
        formationSelectedUnit=null;formationMessage="";
        const ok=await window.FourSymbolsTeamFormation.save(value);
        // Only the protected client publishes a confirmed result; no optimistic
        // roster/slot write or Save success is manufactured by this renderer.
        window.refreshFormationPage();return ok;
    }
    window.vFixedPlaceFormationUnit=placeFormationUnit;
    window.refreshFormationPage=function(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body?.querySelector('.v-fixed-formation-panel'))return;
        const scroll=document.getElementById("formationContent")?.scrollTop||0;
        window.vFixedCleanupFormationInput();body.innerHTML=renderAllyFormationContent();
        document.getElementById("formationContent").scrollTop=scroll;window.vFixedBindFormationInput();
    };
    function finishDrag(){
        if(formationDrag){
            const drag=formationDrag;formationDrag=null;drag.ghost?.remove();
            if(drag.node.hasPointerCapture?.(drag.pointerId))drag.node.releasePointerCapture(drag.pointerId);
        }
        document.querySelectorAll('.formation-drop-target,.formation-drag-source').forEach(node=>node.classList.remove('formation-drop-target','formation-drag-source'));
    }
    window.vFixedCleanupFormationInput=function(){finishDrag();formationInputAbort?.abort();formationInputAbort=null;};
    window.vFixedBindFormationInput=function(){
        window.vFixedCleanupFormationInput();
        const root=document.querySelector('.v-fixed-formation-panel');if(!root)return;
        formationInputAbort=new AbortController();const signal=formationInputAbort.signal;
        function activate(node){
            if(!formationEditingAllowed())return;
            if(node.closest('[data-remove]')){if(formationSelectedUnit)void placeFormationUnit(formationSelectedUnit,null,true);return;}
            const slot=node.closest('[data-slot]')?.dataset.slot,unit=node.closest('[data-unit]')?.dataset.unit;
            if(formationSelectedUnit&&slot&&unit!==formationSelectedUnit){void placeFormationUnit(formationSelectedUnit,slot);return;}
            if(unit){formationSelectedUnit=unit===formationSelectedUnit?null:unit;window.refreshFormationPage();}
        }
        root.addEventListener('click',event=>{if(event.detail===0&&event.target.closest('[data-unit],[data-slot],[data-remove]'))activate(event.target);},{signal});
        root.addEventListener('pointerdown',event=>{
            if(!event.isPrimary||event.button!==0||!formationEditingAllowed())return;
            const node=event.target.closest('[data-unit],[data-slot],[data-remove]');if(!node)return;
            const unit=node.dataset.unit||null;
            formationDrag={node,unit,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,ghost:null};
            node.setPointerCapture(event.pointerId);event.preventDefault();
        },{signal});
        root.addEventListener('pointermove',event=>{
            const drag=formationDrag;if(!drag||event.pointerId!==drag.pointerId)return;
            if(!drag.unit||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8&&!drag.moved)return;
            drag.moved=true;
            if(!drag.ghost){
                drag.ghost=document.createElement('div');drag.ghost.className='formation-drag-preview';drag.ghost.innerHTML=formationUnitContent(drag.unit);
                root.appendChild(drag.ghost);drag.node.classList.add('formation-drag-source');
            }
            const point=window.FourSymbolsDisplay.clientToSurface('native',event.clientX,event.clientY);
            drag.ghost.style.left=point.x+'px';drag.ghost.style.top=point.y+'px';
            root.querySelectorAll('.formation-drop-target').forEach(node=>node.classList.remove('formation-drop-target'));
            const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot],[data-remove]');
            const preview=formationPreview(),from=drag.unit.startsWith('hero:')?preview.heroIdToSlot[drag.unit.slice(5)]:preview.characterIndexToSlot[drag.unit.slice(7)];
            if(target&&(target.dataset.remove?drag.unit.startsWith('hero:')&&from:!formationUnitAt(preview,target.dataset.slot)||from))target.classList.add('formation-drop-target');
            event.preventDefault();
        },{signal});
        root.addEventListener('pointerup',event=>{
            const drag=formationDrag;if(!drag||event.pointerId!==drag.pointerId)return;
            const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-slot],[data-remove]');
            finishDrag();
            if(drag.moved){if(target)void placeFormationUnit(drag.unit,target.dataset.slot,!!target.dataset.remove);}
            else activate(drag.node);
            event.preventDefault();
        },{signal});
        root.addEventListener('pointercancel',finishDrag,{signal});
        root.addEventListener('lostpointercapture',finishDrag,{signal});
        window.addEventListener('blur',finishDrag,{signal});
        document.addEventListener('visibilitychange',()=>{if(document.hidden)finishDrag();},{signal});
    };

    function applyPlayerElementFrames(){
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const card=document.getElementById("battlePlayerCard"+characterIndex);
            if(card){
                card.dataset.element=(character && character.element)||"unknown";
            }
        });
    }

    let elementBoxBattleStartExp=null;

    function v131AfterBattleRender(){
        applyBattleFormation();
        applyAllyBattleFormation();
        applyPlayerElementFrames();
        elementBoxBattleStartExp=Math.max(0,Number(sharedExp)||0);
    }
    window.v131AfterBattleRender=v131AfterBattleRender;

    window.v138GetFormationRows=getFormationRows;
    window.v138BattlePacing={
        actionDelayMs:V138_ACTION_DELAY_MS,
        roundDelayMs:V138_ROUND_TRANSITION_MS,
        roundHandoffDelayMs:V138_ROUND_HANDOFF_DELAY_MS,
        roundAnnouncementDelayMs:V138_ROUND_ANNOUNCEMENT_DELAY_MS
    };

    function syncInventoryPortrait(){
        const frame=document.getElementById("inventoryPortraitFrame");
        if(!frame || typeof getPartyCharacterByIndex!=="function"){ return; }
        const character=getBackpackCharacter(inventoryCharacterIndex);
        const placeholder=frame.querySelector(".inventory-portrait-placeholder");
        if(!character){
            frame.querySelector(".v131-inventory-portrait")?.remove();
            if(placeholder){ placeholder.style.display=""; }
            return;
        }
        if(placeholder){ placeholder.style.display="none"; }
        let img=frame.querySelector(".v131-inventory-portrait");
        if(!img){
            img=document.createElement("img");
            img.className="v131-inventory-portrait";
            img.alt="角色立繪";
            img.draggable=false;
            frame.insertBefore(img,frame.firstChild);
        }
        img.src=getCharacterBattleArtworkPath(character);
        img.alt=(character.id||"角色")+"立繪";
    }

    window.v131SyncInventoryPortrait=syncInventoryPortrait;

    function syncCharacterCreationAvailability(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const title=document.getElementById("homeFeatureModalTitle");
        if(title && String(title.textContent||"").trim()!=="角色"){ return; }
        const legacyRow=body.firstElementChild;
        const cardsBySlot=new Map();
        Array.from(body.querySelectorAll('[onclick*="openCharacterCreation"]')).forEach(card=>{
            const match=String(card.getAttribute("onclick")||"").match(/openCharacterCreation\(\s*(2|3)\s*\)/);
            if(match){ cardsBySlot.set(Number(match[1]),card); }
        });

        [1,2].forEach(slotIndex=>{
            const slotNumber=slotIndex+1;
            const card=cardsBySlot.get(slotNumber) || (legacyRow&&legacyRow.children?legacyRow.children[slotIndex]:null);
            if(!card){ return; }
            const character=slotIndex===1 ? player2 : player3;
            if(character){
                card.classList.remove("v131-unlock-ready");
                const oldDot=card.querySelector(".v131-unlock-dot");
                if(oldDot){ oldDot.remove(); }
                return;
            }
            const eligible=slotIndex===1
                ? player.level>=10
                : isThirdCharacterUnlocked();
            if(!eligible){ return; }
            card.style.opacity="1";
            card.style.position="relative";
            card.style.cursor="pointer";
            card.classList.add("v131-unlock-ready");
            card.onclick=function(){
                closeHomeFeature();
                openCharacterCreation(slotNumber);
            };
            const labels=card.querySelectorAll("div");
            if(labels.length>=3){
                labels[1].textContent="可創建";
                labels[2].textContent="點擊創建";
            }
            if(!card.querySelector(".v131-unlock-dot")){
                const dot=document.createElement("span");
                dot.className="v131-unlock-dot";
                dot.setAttribute("aria-label","有新角色可創建");
                card.appendChild(dot);
            }
        });
    }

    if(typeof refreshCharacterAvatarLevels==="function"){
        const originalRefreshAvatarLevels=refreshCharacterAvatarLevels;
        refreshCharacterAvatarLevels=function(){
            originalRefreshAvatarLevels.apply(this,arguments);
            syncCharacterCreationAvailability();
        };
    }

    // setupNativeGameUi owns the preview's single native host.

    const expPreviewCounts={0:0,1:0,2:0};
    const originalDistributeExpToCharacter=
        typeof distributeExpToCharacter==="function" ? distributeExpToCharacter : null;

    function previewCostForCharacter(character,count){
        if(!character || count<=0){ return 0; }
        const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
        const startLevel=Math.max(1,Math.floor(Number(character.level)||1));
        if(startLevel+count>maxLevel){ return Infinity; }

        let exp=Math.max(0,Number(character.exp)||0);
        let expNext=Math.max(1,Number(character.expNext)||100);
        let previewLevel=startLevel;
        let total=0;
        for(let i=0;i<count;i++){
            const need=Math.max(1,expNext-exp);
            total+=need;
            exp=0;
            previewLevel++;
            expNext=typeof window.v133GetExpNextForLevel==="function"
                ? window.v133GetExpNextForLevel(previewLevel)
                : Math.max(expNext+1,Math.floor(expNext*1.2));
        }
        return total;
    }
    window.v131PreviewCostForCharacter=previewCostForCharacter;

    function totalPreviewCost(){
        return [0,1,2].reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            return sum+previewCostForCharacter(character,expPreviewCounts[index]||0);
        },0);
    }

    function hasExpPreview(){
        return [0,1,2].some(index=>(expPreviewCounts[index]||0)>0);
    }

    function previewExpLevel(index){
        const character=getPartyCharacterByIndex(index);
        if(!character){ return; }
        const current=expPreviewCounts[index]||0;
        const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
        if(character.level+current>=maxLevel){
            alert("這名角色已達 Lv."+maxLevel+" 滿等。");
            return;
        }
        const beforeCost=previewCostForCharacter(character,current);
        const afterCost=previewCostForCharacter(character,current+1);
        const extra=afterCost-beforeCost;
        if(totalPreviewCost()+extra>sharedExp){
            alert("經驗池不足，無法再預覽這一級。還需要 "+Math.max(0,totalPreviewCost()+extra-sharedExp)+" EXP。");
            return;
        }
        expPreviewCounts[index]=current+1;
        renderExpDistributeList();
        syncCharacterPreviewLevels();
    }

    function syncCharacterPreviewLevels(){
        [0,1,2].forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            const el=document.getElementById("characterAvatarLevel"+index);
            if(character && el){
                el.textContent="Lv."+(character.level+(expPreviewCounts[index]||0));
                el.classList.toggle("v131-preview-level",(expPreviewCounts[index]||0)>0);
            }
        });
    }

    function cancelExpPreview(){
        [0,1,2].forEach(index=>{ expPreviewCounts[index]=0; });
        renderExpDistributeList();
        if(typeof refreshCharacterAvatarLevels==="function"){
            refreshCharacterAvatarLevels();
        }
    }

    function confirmExpPreview(){
        if(!hasExpPreview() || !originalDistributeExpToCharacter){ return; }
        const plan=[0,1,2].map(index=>({
            index,
            character:getPartyCharacterByIndex(index),
            count:Math.min(
                expPreviewCounts[index]||0,
                Math.max(
                    0,
                    (Number(window.v133MaxLevel)||Infinity)-
                    ((getPartyCharacterByIndex(index)||{}).level||1)
                )
            )
        })).filter(entry=>entry.character && entry.count>0);
        [0,1,2].forEach(index=>{ expPreviewCounts[index]=0; });
        plan.forEach(entry=>{
            for(let n=0;n<entry.count;n++){
                originalDistributeExpToCharacter(entry.character);
            }
        });
        renderExpDistributeList();
        syncCharacterCreationAvailability();
    }

    window.v131PreviewExpLevel=previewExpLevel;
    window.v131ConfirmExpPreview=confirmExpPreview;
    window.v131CancelExpPreview=cancelExpPreview;

    if(typeof renderExpDistributeList==="function"){
        renderExpDistributeList=function(){
            const container=document.getElementById("expDistributeList");
            if(!container){ return; }
            const rows=getExistingPartyIndexes().map(index=>{
                const character=getPartyCharacterByIndex(index);
                const count=expPreviewCounts[index]||0;
                const previewLevel=character.level+count;
                const cost=previewCostForCharacter(character,count);
                const nextExtra=previewCostForCharacter(character,count+1)-cost;
                const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
                const isMaxLevel=previewLevel>=maxLevel;
                const canPreview=!isMaxLevel && totalPreviewCost()+nextExtra<=sharedExp;
                return (
                    '<div class="v131-exp-row">'+
                        '<div class="v131-exp-name">'+(character.id||("角色"+(index+1)))+'</div>'+
                        '<div class="v131-exp-level'+(count>0?' preview':'')+'">Lv.'+character.level+
                            (count>0 ? ' → Lv.'+previewLevel : '')+
                        '</div>'+
                        '<button type="button" class="v131-exp-preview-btn" '+
                            (canPreview?'':'disabled ')+
                            'onclick="v131PreviewExpLevel('+index+')">'+
                            (isMaxLevel ? '已達滿等' : '點擊預覽升級')+'</button>'+
                    '</div>'
                );
            }).join("");
            const planned=hasExpPreview();
            const reserved=totalPreviewCost();
            container.innerHTML=
                rows+
                '<div class="v131-exp-preview-summary">預覽消耗：'+reserved.toLocaleString("zh-TW")+' EXP</div>'+
                '<div class="v131-exp-actions">'+
                    '<button type="button" class="v131-exp-confirm" '+(planned?'':'disabled ')+
                        'onclick="v131ConfirmExpPreview()">確定</button>'+
                    '<button type="button" class="v131-exp-back" '+(planned?'':'disabled ')+
                        'onclick="v131CancelExpPreview()">返回</button>'+
                '</div>';
            syncCharacterPreviewLevels();
        };
    }

    function loadElementBoxState(){
        try{
            const parsed=JSON.parse(localStorage.getItem(ELEMENT_BOX_KEY)||"{}");
            return {
                remainingMs:Math.min(
                    32*60*60*1000,
                    Math.max(0,Number(parsed.remainingMs)||0)
                )
            };
        }catch(_){
            return {remainingMs:0};
        }
    }

    const elementBoxState=loadElementBoxState();

    function hasAnyAutoBattleEnabled(){
        return !!(
            autoBattle ||
            autoConfig.enabled ||
            (player2 && autoConfig2.enabled) ||
            (player3 && autoConfig3.enabled)
        );
    }

    /*
       V137：V136會保存自動戰鬥開關，但元素匣舊版每次重新載入都把
       active寫死成false。結果同一份已啟用的自動設定在reload後仍會
       自動出手，卻不扣元素匣時數、EXP也恢復100%。只要還有時數且
       任一角色的自動設定為開，就恢復同一個元素匣啟用狀態。
    */
    let elementBoxActive=
        elementBoxState.remainingMs>0 &&
        hasAnyAutoBattleEnabled();
    let elementBoxLastTick=Date.now();
    let elementBoxLastPersist=0;
    const elementBoxSession={activeMs:0,battles:0,exp:0,gold:0};

    function persistElementBoxState(){
        try{
            localStorage.setItem(ELEMENT_BOX_KEY,JSON.stringify({
                remainingMs:Math.max(0,Math.floor(elementBoxState.remainingMs))
            }));
        }catch(_){ }
    }

    function stopElementBoxWhenTimeEnds(message){
        elementBoxActive=false;
        autoConfig.enabled=false;
        if(player2){ autoConfig2.enabled=false; }
        if(player3){ autoConfig3.enabled=false; }
        autoBattle=false;
        if(typeof updateAutoButton==="function"){ updateAutoButton(); }
        if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
        addBattleLog(message||"元素匣時數已用完，自動戰鬥已停止。");
        if(typeof saveGame==="function"){ saveGame(); }
    }

    function syncElementBoxForBattle(options){
        const silent=!!(options && options.silent);
        if(hasAnyAutoBattleEnabled() && elementBoxState.remainingMs<=0){
            stopElementBoxWhenTimeEnds(
                silent
                    ? "元素匣沒有可用時數，自動戰鬥已停止。"
                    : "元素匣沒有可用時數，自動戰鬥已停止；請先取得時數。"
            );
            return false;
        }

        elementBoxActive=
            elementBoxState.remainingMs>0 &&
            hasAnyAutoBattleEnabled();
        elementBoxLastTick=Date.now();
        persistElementBoxState();
        return elementBoxActive;
    }
    window.v131SyncElementBoxForBattle=syncElementBoxForBattle;
    window.v131GetElementBoxState=function(){
        return {
            active:elementBoxActive,
            remainingMs:Math.max(0,Math.floor(elementBoxState.remainingMs))
        };
    };
    window.v131GrantElementBoxHours=function(hours,maxHours){
        const safeHours=Math.max(0,Number(hours)||0);
        const capMs=Math.max(0,Number(maxHours)||32)*60*60*1000;
        elementBoxState.remainingMs=Math.min(
            capMs,
            Math.max(0,elementBoxState.remainingMs)+safeHours*60*60*1000
        );
        persistElementBoxState();
        updateElementBoxStatsUI();
        return Math.max(0,Math.floor(elementBoxState.remainingMs));
    };

    function tickElementBoxClock(){
        const now=Date.now();
        const delta=Math.max(0,now-elementBoxLastTick);
        elementBoxLastTick=now;
        if(elementBoxActive && elementBoxState.remainingMs>0){
            const used=Math.min(delta,elementBoxState.remainingMs);
            elementBoxState.remainingMs-=used;
            elementBoxSession.activeMs+=used;
            if(elementBoxState.remainingMs<=0){
                elementBoxState.remainingMs=0;
                stopElementBoxWhenTimeEnds();
            }
        }
        if(now-elementBoxLastPersist>=5000){
            elementBoxLastPersist=now;
            persistElementBoxState();
        }
        updateElementBoxStatsUI();
    }

    function ensureElementBoxStatsUI(){
        const panel=document.getElementById("autoBattleSettingsPanel");
        if(!panel){ return; }
        panel.classList.add("v131-element-box-panel");
        const saveBtn=panel.querySelector(".auto-save-btn");
        if(saveBtn){ saveBtn.textContent="套用並啟動"; }
        const cancelBtn=panel.querySelector(".auto-cancel-btn");
        if(cancelBtn){ cancelBtn.style.display="none"; }
        let stats=document.getElementById("v131ElementBoxStats");
        if(!stats){
            stats=document.createElement("section");
            stats.id="v131ElementBoxStats";
            stats.className="v131-element-box-stats";
            stats.innerHTML=
                '<div class="v131-element-box-title">本次上線元素匣紀錄</div>'+
                '<div><span>啟動總時數</span><strong id="v131EbActiveTime">0小時 0分鐘</strong></div>'+
                '<div><span>戰鬥次數</span><strong id="v131EbBattles">0</strong></div>'+
                '<div><span>獲得經驗</span><strong id="v131EbExp">0</strong></div>'+
                '<div><span>獲得金幣</span><strong id="v131EbGold">0</strong></div>'+
                '<div class="remaining"><span>元素匣剩餘使用時間</span><strong id="v131EbRemaining">0小時 0分鐘</strong></div>';
            const actions=panel.querySelector(".auto-settings-actions") || (saveBtn && saveBtn.parentElement);
            if(actions){ panel.insertBefore(stats,actions); }
            else{ panel.appendChild(stats); }
        }
        updateElementBoxStatsUI();
    }

    function updateElementBoxStatsUI(){
        const pairs={
            v131EbActiveTime:formatDuration(elementBoxSession.activeMs),
            v131EbBattles:String(elementBoxSession.battles),
            v131EbExp:Math.floor(elementBoxSession.exp).toLocaleString("zh-TW"),
            v131EbGold:Math.floor(elementBoxSession.gold).toLocaleString("zh-TW"),
            v131EbRemaining:formatDuration(elementBoxState.remainingMs)
        };
        Object.keys(pairs).forEach(id=>{
            const el=document.getElementById(id);
            if(el){ el.textContent=pairs[id]; }
        });
    }

    /*
       元素匣的「本次上線獲得金幣」只記錄一般巡怪中實際入帳的怪物掉落。
       副本會設置 v132ActiveDungeonRun；V141 的野外精英掉落隔離旗標不是副本，
       仍維持和既有巡怪戰鬥統計相同的涵蓋範圍。
    */
    function isElementBoxNormalPatrolGoldTrackingActive(){
        const dungeonRun=window.v132ActiveDungeonRun;
        return !!(
            elementBoxActive &&
            (!dungeonRun || dungeonRun.v141EliteDropIsolation===true)
        );
    }

    function recordElementBoxMonsterGold(amount){
        const safeAmount=Math.max(0,Math.floor(Number(amount)||0));
        if(safeAmount<=0 || !isElementBoxNormalPatrolGoldTrackingActive()){
            return;
        }
        elementBoxSession.gold+=safeAmount;
        updateElementBoxStatsUI();
    }

    if(typeof awardMonsterGoldDrop==="function"){
        const originalAwardMonsterGoldDrop=awardMonsterGoldDrop;
        awardMonsterGoldDrop=function(){
            const baseAmount=Math.max(0,Number(originalAwardMonsterGoldDrop.apply(this,arguments))||0);
            const bonusAmount=Math.max(0,Math.floor(baseAmount*(V17342_GLOBAL_GOLD_REWARD_MULTIPLIER-1)));
            if(bonusAmount>0){
                gold+=bonusAmount;
                if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
            }
            const amount=baseAmount+bonusAmount;
            recordElementBoxMonsterGold(amount);
            return amount;
        };
    }

    const originalConfirmAutoBattleSettings=
        typeof confirmAutoBattleSettings==="function" ? confirmAutoBattleSettings : null;

    if(originalConfirmAutoBattleSettings){
        confirmAutoBattleSettings=async function(){
            /*
               ★ 修正（依照使用者回報，「戰鬥中開啟元素匣，
               套用啟動才是沒反應」）：
               這顆按鈕的文字被ensureElementBoxStatsUI()改成
               「套用並啟動」，但這裡原本只呼叫
               originalConfirmAutoBattleSettings()儲存表單設定，
               從頭到尾沒有真的把autoBattle打開——玩家看到的
               就是「按了套用並啟動，畫面卻什麼都沒變、戰鬥
               還是要自己手動操作」，跟按鈕文字承諾的行為對
               不起來。這裡補上：套用設定之後，如果目前還沒
               開自動戰鬥，直接呼叫既有的toggleAutoBattle()
               （跟按面板最上面「啟動」按鈕完全同一套邏輯，
               autoConfig/autoConfig2/autoConfig3、UI、戰鬤
               紀錄都會一起正確同步），讓「套用並啟動」名符
               其實。如果玩家點的當下自動戰鬥其實已經是開著的
               （只是想改設定），就不要再呼叫一次toggle，
               避免反而把它關掉。
            */
            const activate=()=>{
                originalConfirmAutoBattleSettings.apply(this,arguments);
                if(!autoBattle && typeof toggleAutoBattle==="function"){
                    toggleAutoBattle();
                }
                elementBoxActive=true;
                elementBoxLastTick=Date.now();
                persistElementBoxState();
                addBattleLog("元素匣已啟動，剩餘 "+formatDuration(elementBoxState.remainingMs)+"。");
            };
            if(elementBoxState.remainingMs<=0){
                const watch=
                    typeof window.rpgConfirm==="function" &&
                    await window.rpgConfirm(
                        "元素匣目前沒有可用時數。\n觀看廣告可獲得 8 小時元素匣啟動時數。\n\n要觀看廣告嗎？",
                        {
                            title:"補充元素匣時數",
                            confirmText:"觀看廣告",
                            cancelText:"稍後再說"
                        }
                    );
                if(!watch){ return; }
                showRewardedAd(
                    ()=>{
                        window.v131GrantElementBoxHours(8,32);
                        ensureElementBoxStatsUI();
                        activate();
                    },
                    ()=>{
                        alert("廣告未完成，未獲得元素匣時數。");
                    }
                );
                return;
            }
            activate();
        };
    }

    /*
       所有能開啟自動戰鬥的入口都必須經過元素匣檢查。舊版只攔
       「套用並啟動」，戰鬥HUD上的直接切換鍵可以完全繞過廣告與
       時數。沒有時數時保留手動狀態並打開設定面板；有時數時才讓
       原本切換邏輯執行。
    */
    if(typeof toggleAutoBattle==="function"){
        const originalToggleAutoBattle=toggleAutoBattle;
        toggleAutoBattle=function(){
            const isTurningOn=!autoBattle;
            if(isTurningOn && elementBoxState.remainingMs<=0){
                alert("元素匣目前沒有可用時數，請先觀看廣告取得8小時時數。");
                if(typeof openHomeFeature==="function"){
                    openHomeFeature("autoBattleSettings");
                }
                return false;
            }

            const result=originalToggleAutoBattle.apply(this,arguments);
            syncElementBoxForBattle({silent:true});
            return result;
        };
    }

    /* startBattle()會從存檔的autoConfig重新打開自動狀態；每一場開始
       後再同步一次，避免reload或舊存檔直接繞過元素匣。 */
    if(typeof startBattle==="function"){
        const originalStartBattle=startBattle;
        startBattle=function(){
            const slotOwner=fixedBattlefieldSlots();
            if(slotOwner){ slotOwner.clearActiveEnemySnapshot(); }
            if(hasAnyAutoBattleEnabled() && elementBoxState.remainingMs<=0){
                stopElementBoxWhenTimeEnds("元素匣沒有可用時數，自動戰鬥已停止。");
            }
            const result=originalStartBattle.apply(this,arguments);
            if(battleActive){
                ensureEnemyFormationSnapshot(currentBattleMonsters);
                syncElementBoxForBattle({silent:true});
            }
            return result;
        };
    }

    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=originalOpenHomeFeature.apply(this,arguments);
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.toggle("v131-shop-open",type==="shop"); }
            if(type==="character"){ syncCharacterCreationAvailability(); }
            if(type==="autoBattleSettings"){ ensureElementBoxStatsUI(); }
            return result;
        };
    }

    if(typeof closeHomeFeature==="function"){
        const originalCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.remove("v131-shop-open"); }
            return originalCloseHomeFeature.apply(this,arguments);
        };
    }

    let v131PendingExpToast=0;
    if(typeof showExpToast==="function"){
        const originalShowExpToast=showExpToast;
        showExpToast=function(amount){
            const displayAmount=v131PendingExpToast>0 ? v131PendingExpToast : amount;
            v131PendingExpToast=0;
            return originalShowExpToast.call(this,displayAmount);
        };
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            if(!battleActive){ return originalWinBattle.apply(this,arguments); }

            /*
               flatExpGain：跟原本winBattle()內部自己會算、
               直接加進sharedExp的數字完全一樣算法（等級×10，
               不含rank倍率、不含正式怪物 EXP 差額）——用來推算「原本
               函式這次會自己加多少」，才能正確算出還要「補多少
               差額」，不會跟原本的計算重複疊加。
            */
            const flatExpGain=currentBattleMonsters.reduce(
                (total,index)=>total+(monsters[index] ? (Number(monsters[index].level)||0)*10 : 0),
                0
            );

            /* 正式巡怪 EXP 只走 calculateStandardPatrolExp()：
               正式怪物 EXP × rank；V173.42 ×3 僅保留 Lv1～19 快速期。
               Lv20 起不再有第二個全域 ×3。 */
            const progressionLevel=getPatrolProgressionReferenceLevel();
            let finalExp=calculateStandardPatrolExp(
                currentBattleMonsters.map(index=>monsters[index]).filter(Boolean),
                progressionLevel
            );

            const isBeginnerForestBattle=
                currentZone==="forest" &&
                typeof player!=="undefined" &&
                player &&
                Math.max(1,Number(player.level)||1)<10;

            if(isBeginnerForestBattle){
                const beginnerMonsterUnits=currentBattleMonsters.reduce((total,index)=>{
                    const monster=monsters[index];
                    return monster ? total+getMonsterExpRankMultiplier(monster) : total;
                },0);
                finalExp=Math.max(1,Math.round(
                    getBeginnerForestMonsterExpUnit()*
                    Math.max(1,beginnerMonsterUnits)*
                    V17342_GLOBAL_EXP_REWARD_MULTIPLIER
                ));
            }

            /* 元素匣（自動掛機）只給70%EXP，金幣/掉落/材料不受影響
               （那些各自獨立的函式完全沒有被這裡動到）。 */
            const isElementBoxBattle=elementBoxActive;
            let restedExpResult=null;
            if(isElementBoxBattle){
                /* ★ 用Math.round不用Math.floor：700*0.7在浮點數運算下
                   會是489.999999...，Math.floor會誤差扣掉1點EXP，
                   Math.round才會正確算出490。 */
                finalExp=applyPatrolExpMode(finalExp,{elementBox:true});
            }else if(typeof window.v139TryConsumeRestedBattle==="function"){
                /* V139休息經驗只允許一般練功戰鬥使用。副本勝利由
                   js/27先攔截，不會走進這個一般winBattle wrapper；
                   元素匣則在上面的分支明確排除，不會消耗場數。 */
                restedExpResult=window.v139TryConsumeRestedBattle();
                if(restedExpResult && restedExpResult.applied){
                    finalExp=applyPatrolExpMode(finalExp,{rested:true});
                }
            }

            const bonusExp=finalExp-flatExpGain;
            const result=originalWinBattle.apply(this,arguments);
            if(bonusExp!==0){
                sharedExp=Math.max(0,sharedExp+bonusExp);
                addBattleLog(
                    (isElementBoxBattle
                        ? "戰鬥經驗（元素匣收益70%）："
                        : restedExpResult && restedExpResult.applied
                        ? "戰鬥經驗（含休息經驗加成）："
                        : "戰鬥經驗：")+
                    "本場共 "+finalExp+" EXP。"
                );
                if(restedExpResult && restedExpResult.applied){
                    addBattleLog(
                        "休息經驗已生效，剩餘 "+
                        restedExpResult.remainingBattles+
                        " 場。"
                    );
                }
                saveGame();
            }
            v131PendingExpToast=finalExp;
            if(elementBoxActive){
                elementBoxSession.battles++;
                elementBoxSession.exp+=finalExp;
                updateElementBoxStatsUI();
            }
            elementBoxBattleStartExp=null;
            return result;
        };
    }

    function initialSync(){
        syncElementBoxForBattle({silent:true});
        applyBattleFormation();
        syncInventoryPortrait();
        syncCharacterCreationAvailability();
        renderExpDistributeList();
        ensureElementBoxStatsUI();
    }

    setInterval(tickElementBoxClock,1000);
    window.addEventListener("beforeunload",persistElementBoxState);
    document.addEventListener("visibilitychange",()=>{ tickElementBoxClock(); });
    setTimeout(initialSync,0);
})();
