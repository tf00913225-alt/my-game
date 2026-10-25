/* =====================================================
   出城冒險 V1 — Adventure Runtime owner
   Owns chapter/node/event/objective/merchant progression only.
   Reuses existing battle, inventory, HP/SP and save owners.
===================================================== */
(function installAdventureRuntimeV1(){
    "use strict";
    if(typeof window==="undefined"||window.FourSymbolsAdventure){ return; }

    const CONTENT=window.FourSymbolsAdventureContent;
    if(!CONTENT){
        console.error("[adventure] missing FourSymbolsAdventureContent");
        return;
    }

    const STATE_VERSION=3;
    const DEFAULT_CHAPTER_ID="chapter_v1";
    const OBJECTIVE_POLL_MS=750;
    const BATTLE_RESOURCE_POLL_MS=80;
    const PENDING_BATTLE_POLL_MS=200;
    const FIRST_LESSON_STEPS=['attack-intro','attack','city-intro','city','character-intro','exp-tab','exp-intro','upgrade',
        'status-tab','status-intro','skill-tab','skill-intro','skill','return','cast-intro','cast','finish-battle','complete'];
    const runtime={
        visible:false,
        activePanel:"map",
        selectedNodeId:null,
        objectiveTimer:null,
        battleResourceTimer:null,
        battleResourceSnapshot:null,
        activeAdventureBattle:null,
        battleWasActive:false,
        pendingBattleTimer:null,
        dialogue:null,
        tutorialSkillUsed:false,
        firstLessonCommitting:false,
        firstLessonOpeningRelease:null
    };

    function numeric(value,fallback=0){
        const number=Number(value);
        return Number.isFinite(number)?number:fallback;
    }
    function integer(value,fallback=0){ return Math.max(0,Math.floor(numeric(value,fallback))); }
    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
    function clone(value){ return value==null?value:JSON.parse(JSON.stringify(value)); }
    function now(){ return Date.now(); }

    function playerOwner(){
        try{ return typeof player!=="undefined"&&player?player:null; }
        catch(_){ return null; }
    }

    function makeChapterState(chapter){
        return {
            currentNodeId:chapter.startNodeId,
            completedNodes:{},
            rewardClaims:{},
            branchSelections:{},
            chapterCompleted:false,
            chapterRewardClaimed:false,
            objective:null,
            pendingAdventureBuff:null,
            hidden:{rolled:false,merchantAppears:false,merchantRevealed:false},
            merchant:{purchases:{}},
            lastViewedAt:0
        };
    }

    function normalizeChapterState(raw,chapter){
        const state=raw&&typeof raw==="object"?raw:{};
        const normalized={
            currentNodeId:typeof state.currentNodeId==="string"?state.currentNodeId:chapter.startNodeId,
            completedNodes:state.completedNodes&&typeof state.completedNodes==="object"?Object.assign({},state.completedNodes):{},
            rewardClaims:state.rewardClaims&&typeof state.rewardClaims==="object"?Object.assign({},state.rewardClaims):{},
            branchSelections:state.branchSelections&&typeof state.branchSelections==="object"?Object.assign({},state.branchSelections):{},
            chapterCompleted:state.chapterCompleted===true,
            chapterRewardClaimed:state.chapterRewardClaimed===true,
            objective:state.objective&&typeof state.objective==="object"?Object.assign({},state.objective):null,
            pendingAdventureBuff:state.pendingAdventureBuff&&typeof state.pendingAdventureBuff==="object"?Object.assign({},state.pendingAdventureBuff):null,
            hidden:state.hidden&&typeof state.hidden==="object"?Object.assign({rolled:false,merchantAppears:false,merchantRevealed:false},state.hidden):{rolled:false,merchantAppears:false,merchantRevealed:false},
            merchant:{purchases:state.merchant&&state.merchant.purchases&&typeof state.merchant.purchases==="object"?Object.assign({},state.merchant.purchases):{}},
            lastViewedAt:integer(state.lastViewedAt),
            storySchemaVersion:chapter.storySchemaVersion||1,
            storyKeys:clone(state.storyKeys||{}),
            dialogue:clone(state.dialogue||null),
            onboarding:clone(state.onboarding||{active:false,phase:"complete",source:"existing-character"}),
            legacyMigration:state.legacyMigration||null,
            grantedEquipmentUid:state.grantedEquipmentUid||null,
            equipmentLessonFunding:clone(state.equipmentLessonFunding||null),
            equipmentLessonPurchase:clone(state.equipmentLessonPurchase||null)
        };
        if(chapter.storySchemaVersion===2&&raw&&state.storySchemaVersion!==2){
            const map={n01_arrival:1,n02_roadfight:2,n03_fork:6,n04a_path:6,n04b_gate:6,n05_commission:6,n06_rest:9,n07_chest:8,n08_truth:11,n09_boss:20,n10_finish:20};
            const stage=map[state.currentNodeId];
            if(!stage){throw new Error("Adventure legacy progress cannot be resolved safely.");}
            normalized.currentNodeId="c1_"+String(stage).padStart(2,"0");
            for(let i=1;i<stage+(state.chapterCompleted?1:0);i++){
                const id="c1_"+String(i).padStart(2,"0");
                normalized.completedNodes[id]={migrated:true};normalized.rewardClaims[id]="blocked-legacy";
            }
            if(stage>11){normalized.storyKeys.blackPineToken={sourceNodeId:"c1_11",migration:true};}
            normalized.onboarding={active:false,phase:"complete",source:"legacy"};
            normalized.legacyMigration=2;
        }
        if(!chapter.nodes.some(node=>node.id===normalized.currentNodeId)){
            normalized.currentNodeId=chapter.startNodeId;
        }
        return normalized;
    }

    function validateChapterState(state,chapter){
        const record=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
        if(!record(state)||![undefined,1,2].includes(state.storySchemaVersion)||
           !record(state.completedNodes)||!record(state.rewardClaims)||!record(state.branchSelections)||
           typeof state.chapterCompleted!=="boolean"||typeof state.chapterRewardClaimed!=="boolean"||
           Object.values(state.rewardClaims).some(value=>!["ready","claimed","blocked-legacy"].includes(value))||
           Object.values(state.completedNodes).some(value=>typeof value!=="boolean"&&!record(value))){throw new Error("Adventure claim history requires recovery.");}
        if((state.objective!=null&&!record(state.objective))||(state.merchant!=null&&(!record(state.merchant)||!record(state.merchant.purchases)))||
           (state.hidden!=null&&!record(state.hidden))||(state.pendingAdventureBuff!=null&&!record(state.pendingAdventureBuff))){throw new Error("Adventure retained state requires recovery.");}
        if(state.storySchemaVersion===2){
            const funding=state.equipmentLessonFunding,purchase=state.equipmentLessonPurchase;
            if(funding!=null&&(!record(funding)||funding.source!=="chapter1-equipment-funding-v1"||funding.sourceNodeId!=="c1_03"||funding.definitionId!=="leatherArmor"||!Number.isSafeInteger(funding.amount)||funding.amount<=0||state.rewardClaims.c1_03!=="claimed")){
                throw new Error("Adventure equipment funding requires recovery.");
            }
            if(purchase!=null&&(!record(purchase)||!funding||purchase.source!=="chapter1-equipment-purchase-v1"||purchase.definitionId!==funding.definitionId||typeof purchase.equipmentUid!=="string"||!purchase.equipmentUid||purchase.equipmentUid!==state.grantedEquipmentUid||purchase.paidGold!==funding.amount)){
                throw new Error("Adventure equipment purchase requires recovery.");
            }
            if(!chapter.nodes.some(n=>n.id===state.currentNodeId)||!record(state.storyKeys)||!record(state.onboarding)||typeof state.onboarding.active!=="boolean"||
               !["story","battle","guidance","system","retry","complete"].includes(state.onboarding.phase)){
                throw new Error("Adventure story state requires recovery.");
            }
            if(state.storyKeys.blackPineToken&&(!record(state.storyKeys.blackPineToken)||state.storyKeys.blackPineToken.sourceNodeId!=="c1_11")){throw new Error("Adventure Story Key requires recovery.");}
            if(state.dialogue){
                const cursor=state.dialogue,node=chapter.nodes.find(n=>n.id===cursor.nodeId);
                const lines=cursor.phase==="ending"?chapter.ending:cursor.phase==="guidance"?node?.guidance:node?.dialogue;
                if(!node||!["before","guidance","ending"].includes(cursor.phase)||!Number.isInteger(cursor.lineIndex)||!lines||cursor.lineIndex<0||cursor.lineIndex>=lines.length){throw new Error("Adventure dialogue requires recovery.");}
            }
            const o=state.onboarding;
            if(o.flowVersion!==undefined&&(o.flowVersion!==3||o.source!=='new-character'||
               !FIRST_LESSON_STEPS.includes(o.firstBattleStep)||typeof o.battleId!=='string'||o.battleId.length<8||
               !Number.isInteger(o.startingLevel)||o.startingLevel<1)){
                throw new Error('Adventure first lesson requires recovery.');
            }
            if(o.flowVersion===3&&o.battleCheckpoint&&
               (o.battleCheckpoint.version!==1||o.battleCheckpoint.battleId!==o.battleId||
                !Number.isSafeInteger(o.battleCheckpoint.sequence)||o.battleCheckpoint.sequence<1)){
                throw new Error('Adventure first battle checkpoint requires recovery.');
            }
        }
    }
    function ensureState(options){
        const owner=playerOwner();
        if(!owner){ return null; }
        const opts=options||{};
        const original=owner.adventureProgress,exists=original!=null;
        if(exists&&(!original||typeof original!=="object"||Array.isArray(original)||![1,2,3].includes(original.schemaVersion)||
           !original.chapters||typeof original.chapters!=="object"||Array.isArray(original.chapters)||!CONTENT.chapters[original.activeChapterId])){throw new Error("Adventure save requires recovery.");}
        let current=exists&&original.schemaVersion===STATE_VERSION;
        for(const chapter of Object.values(CONTENT.chapters)){
            const raw=original?.chapters?.[chapter.id];
            if(exists&&Object.prototype.hasOwnProperty.call(original.chapters,chapter.id)&&!raw){throw new Error("Adventure chapter source requires recovery.");}
            if(raw){validateChapterState(raw,chapter);}
            if(!raw||raw.storySchemaVersion!==(chapter.storySchemaVersion||1)){current=false;}
        }
        if(current){return original;}
        // Validate and normalize a detached candidate. Legacy receipt bytes in
        // memory and in the UID save remain intact if the single save refuses.
        const root=exists?clone(original):{schemaVersion:STATE_VERSION,activeChapterId:DEFAULT_CHAPTER_ID,chapters:{}};
        root.schemaVersion=STATE_VERSION;
        Object.values(CONTENT.chapters).forEach(chapter=>{
            const raw=root.chapters[chapter.id];
            const normalized=normalizeChapterState(raw,chapter);
            root.chapters[chapter.id]=normalized;
            if(root.pendingStoryOpening===true&&!raw){normalized.onboarding={active:true,phase:"story",nodeId:chapter.startNodeId,source:"new-character",
                flowVersion:3,firstBattleStep:'attack-intro',startingLevel:integer(owner.level,1),
                battleId:'c1-first-'+(window.crypto?.randomUUID?.()||now())};}
            if(!normalized.hidden.rolled){
                normalized.hidden.rolled=true;
                normalized.hidden.merchantAppears=Math.random()<clamp(numeric(chapter.merchantAppearanceChance,.25),0,1);
            }
        });
        owner.adventureProgress=root;
        if((exists||opts.persist!==false)&&!persist({render:false})){
            if(exists){owner.adventureProgress=original;}else{delete owner.adventureProgress;}
            throw new Error("Adventure progress could not be committed; original state retained.");
        }
        return root;
    }

    function chapterDefinition(chapterId){ return CONTENT.chapters[chapterId||DEFAULT_CHAPTER_ID]||CONTENT.chapters[DEFAULT_CHAPTER_ID]; }
    function rootState(){ return ensureState({persist:false}); }
    function activeChapterId(){
        const root=rootState();
        return root&&CONTENT.chapters[root.activeChapterId]?root.activeChapterId:DEFAULT_CHAPTER_ID;
    }
    function chapterState(chapterId){
        const root=ensureState({persist:false});
        if(!root){ return null; }
        const id=chapterId||activeChapterId();
        return root.chapters[id]||null;
    }
    function nodeById(chapter,nodeId){ return chapter&&chapter.nodes.find(node=>node.id===nodeId)||null; }
    function hiddenNodeById(chapter,nodeId){ return chapter&&chapter.hiddenNodes&&chapter.hiddenNodes.find(node=>node.id===nodeId)||null; }

    function attentionNeeded(){
        const root=rootState();
        if(!root){ return false; }
        return Object.values(root.chapters).some(state=>{
            if(!state){ return false; }
            if(state.chapterCompleted&&!state.chapterRewardClaimed){ return true; }
            if(state.objective&&state.objective.active&&state.objective.ready&&!state.objective.turnedIn){ return true; }
            return Object.values(state.rewardClaims||{}).some(status=>status==="ready");
        });
    }

    function dispatchStateChange(){
        if(typeof document==="undefined"||typeof document.dispatchEvent!=="function"){ return; }
        let event;
        const detail={attention:attentionNeeded(),chapterId:activeChapterId()};
        try{ event=new CustomEvent("four-symbols:adventure-state-change",{detail:detail}); }
        catch(_){
            event=document.createEvent("CustomEvent");
            event.initCustomEvent("four-symbols:adventure-state-change",false,false,detail);
        }
        document.dispatchEvent(event);
    }

    function render(){
        if(window.FourSymbolsAdventureUI&&typeof window.FourSymbolsAdventureUI.render==="function"){
            window.FourSymbolsAdventureUI.render();
        }
    }

    function persist(options){
        const opts=options||{};
        try{if(typeof saveGame!=="function"||saveGame()!==true){return false;}}
        catch(error){console.error("[adventure] saveGame failed",error);return false;}
        dispatchStateChange();
        if(opts.render!==false){ render(); }
        return true;
    }

    // One UID main-save commit. Inventory changes use its existing transaction
    // Owner; failure never leaves a claimed receipt with an uncommitted grant.
    function commitChange(change){
        const owner=playerOwner();if(!owner){return false;}
        const before=clone(owner.adventureProgress),resources=captureResources();
        const oldGold=typeof gold!=="undefined"?gold:null,oldExp=typeof sharedExp!=="undefined"?sharedExp:null;
        const attempt=()=>change()!==false&&persist({render:false});
        let ok=false;
        try{ok=window.v132RunInventoryTransaction?window.v132RunInventoryTransaction(attempt):attempt();}
        catch(error){console.error("[adventure] change refused",error);}
        if(!ok){
            owner.adventureProgress=before;
            if(oldGold!==null){gold=oldGold;}if(oldExp!==null){sharedExp=oldExp;}
            resources.forEach(row=>{const c=getPartyCharacter(row.index);if(c){c.hp=row.hp;c.sp=row.sp;}});
        }
        if(typeof updateUI==="function"){updateUI();}render();return !!ok;
    }

    function getPartyIndexes(){
        if(typeof getExistingPartyIndexes==="function"){ return getExistingPartyIndexes().slice(0,3); }
        return [0,1,2].filter(index=>{
            if(typeof getPartyCharacterByIndex==="function"){ return !!getPartyCharacterByIndex(index); }
            if(index===0){ return typeof player!=="undefined"&&!!player; }
            if(index===1){ return typeof player2!=="undefined"&&!!player2; }
            return typeof player3!=="undefined"&&!!player3;
        });
    }
    function getPartyCharacter(index){
        if(typeof getPartyCharacterByIndex==="function"){ return getPartyCharacterByIndex(index); }
        if(index===0){ return typeof player!=="undefined"?player:null; }
        if(index===1){ return typeof player2!=="undefined"?player2:null; }
        return typeof player3!=="undefined"?player3:null;
    }
    function getPartyStats(index){
        if(typeof getPartyBattleStats==="function"){ return getPartyBattleStats(index); }
        if(index===0&&typeof getMainCharacterStats==="function"){ return getMainCharacterStats(); }
        return null;
    }
    function highestPartyLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel==="function"){
            return Math.max(1,integer(window.v133GetHighestCreatedCharacterLevel(),1));
        }
        return getPartyIndexes().reduce((max,index)=>{
            const character=getPartyCharacter(index);
            return character?Math.max(max,integer(character.level,1)):max;
        },1);
    }

    function hiddenMerchantVisible(chapter,state){
        return !!(chapter&&state&&state.hidden&&state.hidden.rolled&&state.hidden.merchantAppears&&!state.chapterCompleted);
    }

    function branchLockReason(chapter,state,node){
        if(!node||!node.branchId||!node.branchChoice){ return null; }
        const selected=state.branchSelections[node.branchId];
        if(!selected||selected===node.branchChoice||state.chapterCompleted){ return null; }
        return "首次推進已選擇另一條路；章節通關後可回溯探索。";
    }

    function nodeStatus(chapter,state,nodeId){
        const hidden=hiddenNodeById(chapter,nodeId);
        if(hidden){
            if(!hiddenMerchantVisible(chapter,state)){ return "hidden"; }
            return state.hidden.merchantRevealed?"merchant":"hidden-available";
        }
        const node=nodeById(chapter,nodeId);
        if(!node){ return "locked"; }
        if(node.availability==="planned"){ return "planned"; }
        if(state.completedNodes[nodeId]){
            if(state.rewardClaims[nodeId]==="ready"){ return "reward-unclaimed"; }
            if(node.type==="boss"){ return "boss"; }
            if(node.branchId&&node.branchChoice){ return "branch-selected"; }
            return "completed";
        }
        const branchReason=branchLockReason(chapter,state,node);
        if(branchReason){ return "locked"; }
        if(state.chapterCompleted&&node.branchId&&node.branchChoice){ return "available"; }
        if(node.id===state.currentNodeId){
            if(node.type==="objective"&&state.objective){ return state.objective.ready?"objective-ready":"objective-active"; }
            if(node.type==="boss"){ return "boss"; }
            return "current";
        }
        return "locked";
    }

    function markRewardReady(state,node){
        if(!node||!node.rewardId||state.rewardClaims[node.id]==="claimed"){ return; }
        if(state.legacyMigration&&(CONTENT.legacyNodes||[]).some(old=>old.rewardId===(node.legacyRewardId||node.rewardId)&&["ready","claimed"].includes(state.rewardClaims[old.id]))){state.rewardClaims[node.id]="blocked-legacy";return;}
        state.rewardClaims[node.id]="ready";
    }

    function canAddPotion(id,count){
        if(typeof getPotionDefinition==="function"&&typeof window.v132CanAddItemToInventory==="function"){
            const def=getPotionDefinition(id);
            if(def){ return !!window.v132CanAddItemToInventory(def,count); }
        }
        return true;
    }

    function addPotion(id,count){
        const amount=Math.max(1,integer(count,1));
        if(window.FourSymbolsAdventureItems&&window.FourSymbolsAdventureItems.definitions[id]){
            return window.FourSymbolsAdventureItems.add(id,amount);
        }
        if(typeof addPotionToInventory==="function"){ return !!addPotionToInventory(id,amount); }
        return false;
    }

    function grantRewardObject(reward){
        if(!reward){ return {ok:true,summary:[]}; }
        const potions=Array.isArray(reward.potions)?reward.potions:[];
        if((potions.length||reward.starterEquipment||reward.materials?.length)&&typeof window.v132RunInventoryTransaction!=="function"){return {ok:false,message:"背包交易系統尚未就緒。"};}
        for(const entry of potions){
            if(!canAddPotion(entry.id,Math.max(1,integer(entry.count,1)))){
                return {ok:false,message:"背包沒有足夠空間領取獎勵。"};
            }
        }
        const summary=[];let starterEquipmentUid=null,equipmentLessonFunding=null;
        if(reward.starterEquipmentFunding){
            const state=chapterState(),factory=window.FourSymbolsEquipmentFactory;
            if(state.grantedEquipmentUid||state.equipmentLessonFunding||state.equipmentLessonPurchase||!factory){return {ok:false,message:"護具教學資金紀錄需要確認。"};}
            const item=factory.starter(reward.starterEquipmentFunding),amount=factory.prices(item).shop;
            if(item.definitionId!=="leatherArmor"||!Number.isSafeInteger(amount)||amount<=0||typeof gold==="undefined"){return {ok:false,message:"護具價格尚未就緒。"};}
            gold+=amount;
            equipmentLessonFunding={source:"chapter1-equipment-funding-v1",sourceNodeId:"c1_03",definitionId:item.definitionId,amount};
            summary.push("護具購置金 +"+amount.toLocaleString("zh-TW"));
        }
        for(const entry of reward.materials||[]){
            const def=window.v132GetOreDefinition?.(entry.id);
            if(!def||!window.v132AddItemToInventory?.(def,integer(entry.count,1))){return {ok:false,message:"材料獎勵尚未加入背包，請整理空間後再試。"};}
            summary.push(def.name+" ×"+integer(entry.count,1));
        }
        if(reward.starterEquipment){
            if(!window.FourSymbolsEquipmentFactory||!window.v132AddItemToInventory){return {ok:false,message:"裝備系統尚未就緒。"};}
            const item=window.FourSymbolsEquipmentFactory.starter(reward.starterEquipment);
            if(!window.v132AddItemToInventory(item,1)){return {ok:false,message:"請先整理背包，再領取護具。"};}
            starterEquipmentUid=item.v141Uid;
            summary.push(item.name);
        }
        for(const entry of potions){
            const amount=Math.max(1,integer(entry.count,1));
            if(!addPotion(entry.id,amount)){ return {ok:false,message:"補品獎勵加入背包失敗。"}; }
            const def=typeof getPotionDefinition==="function"?getPotionDefinition(entry.id):null;
            summary.push((def&&def.name||entry.id)+" ×"+amount);
        }
        const goldAmount=integer(reward.gold);
        if(goldAmount>0&&typeof gold!=="undefined"){
            gold=Math.max(0,integer(gold)+goldAmount);
            summary.push("金幣 +"+goldAmount.toLocaleString("zh-TW"));
        }
        const expAmount=integer(reward.sharedExp);
        if(expAmount>0&&typeof sharedExp!=="undefined"){
            sharedExp=Math.max(0,integer(sharedExp)+expAmount);
            summary.push("經驗池 +"+expAmount.toLocaleString("zh-TW"));
        }
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        return {ok:true,summary:summary,starterEquipmentUid,equipmentLessonFunding};
    }

    function grantReward(rewardId){
        return grantRewardObject(CONTENT.rewards[rewardId]);
    }

    function recordHeroChapterNode(nodeId,choiceId=null){
        // Qualification is a bounded online intent. Never send local save,
        // chapterCompleted, battle result, amounts or completion timestamps.
        window.FourSymbolsHeroAcquisition?.observeChapterNode(chapterDefinition().id,nodeId,choiceId);
    }

    function completeNode(nodeId,options){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node){ return false; }
        const opts=options||{};
        const first=!state.completedNodes[node.id];
        if(!first){return false;}
        if(state.currentNodeId!==node.id){return false;}
        if(node.requiresStoryKey&&!state.storyKeys?.[node.requiresStoryKey]){return false;}
        const committed=commitChange(()=>{
        if(first){
            state.completedNodes[node.id]={completedAt:now()};
            if(opts.rewardReady!==false){ markRewardReady(state,node); }
            if(node.grantsStoryKey){state.storyKeys[node.grantsStoryKey]={sourceNodeId:node.id};}
            if(node.id==='c1_01'&&state.onboarding.flowVersion===3){
                state.onboarding.firstBattleStep='complete';state.onboarding.basicComplete=true;
                delete state.onboarding.battleCheckpoint;
            }
        }
        if(!state.chapterCompleted&&state.currentNodeId===node.id&&node.next){ state.currentNodeId=node.next; }
        if(!state.chapterCompleted&&node.type==="branch"&&opts.nextNodeId){ state.currentNodeId=opts.nextNodeId; }
        if(node.id===chapter.endNodeId){state.chapterCompleted=true;state.onboarding.active=false;}
        if(node.stage===5){state.onboarding.active=false;state.onboarding.phase="complete";}
        else if(state.onboarding.active){state.onboarding.phase="story";state.onboarding.battleNodeId=null;state.onboarding.requiredAction=null;state.onboarding.nodeId=node.next||node.id;}
        state.dialogue=null;
        });
        if(!committed){return false;}
        recordHeroChapterNode(node.id);
        runtime.selectedNodeId=state.rewardClaims[node.id]==="ready"?node.id:state.currentNodeId;
        return first;
    }

    function claimNodeReward(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId)||(CONTENT.legacyNodes||[]).find(n=>n.id===nodeId);
        if(!state||!node||!node.rewardId||state.rewardClaims[node.id]!=="ready"){ return false; }
        let granted;
        const committed=commitChange(()=>{
        granted=grantReward(node.rewardId);
        if(!granted.ok){return false;}
        state.rewardClaims[node.id]="claimed";
        state.lastRewardSummary=granted.summary;
        if(granted.starterEquipmentUid){state.grantedEquipmentUid=granted.starterEquipmentUid;}
        if(granted.equipmentLessonFunding){state.equipmentLessonFunding=granted.equipmentLessonFunding;}
        if(node.id==="c1_05"&&state.onboarding?.active&&state.onboarding.requiredAction==="recovery"){
            state.onboarding.preparation={hpCount:getPotionCount("hpPotion10"),spCount:getPotionCount("spPotion10")};
        }
        });
        if(!committed){return false;}
        if(!granted.ok){ showMessage(granted.message||"獎勵領取失敗。");return false; }
        runtime.selectedNodeId=state.currentNodeId;
        runtime.activePanel=state.onboarding?.active&&state.onboarding.requiredAction?"tutorial":"map";
        render();
        return true;
    }

    function claimChapterReward(){
        const chapter=chapterDefinition();
        const state=chapterState();
        if(!state||!state.chapterCompleted||state.chapterRewardClaimed){ return false; }
        const committed=commitChange(()=>{
        const granted=grantReward(chapter.chapterRewardId);
        if(!granted.ok){ showMessage(granted.message||"章節獎勵領取失敗。");return false; }
        state.chapterRewardClaimed=true;
        state.lastRewardSummary=granted.summary;
        });
        return committed;
    }

    function showMessage(message,title){
        if(window.rpgAlert&&typeof window.rpgAlert==="function"){
            return window.rpgAlert(String(message||""),{title:title||"出城冒險",confirmText:"知道了"});
        }
        if(typeof alert==="function"){ alert(String(message||"")); }
        return Promise.resolve();
    }

    function open(options){
        const root=ensureState({persist:true});
        if(!root){ showMessage("請先建立角色後再出城冒險。");return false; }
        const opts=options||{};
        if(opts.chapterId&&CONTENT.chapters[opts.chapterId]){ root.activeChapterId=opts.chapterId; }
        const state=chapterState();
        if(firstLessonState()&&state.onboarding.battleCheckpoint&&!state.dialogue){return restoreFirstLessonPage();}
        if(firstLessonState()&&state.onboarding.phase==='battle'&&!state.onboarding.battleCheckpoint&&
           !(typeof battleActive!=='undefined'&&battleActive)){
            return beginBattle('c1_01');
        }
        if(state?.onboarding?.active&&state.onboarding.requiredAction==="recovery"&&state.currentNodeId==="c1_05"&&!state.rewardClaims.c1_05){
            if(!commitChange(()=>{markRewardReady(state,nodeById(chapterDefinition(),"c1_05"));})){return false;}
        }
        if(state?.onboarding?.active&&state.onboarding.phase==="battle"&&!(typeof battleActive!=="undefined"&&battleActive)){
            const o=state.onboarding,node=nodeById(chapterDefinition(),o.battleNodeId);
            if(!commitChange(()=>{
                getPartyIndexes().forEach(i=>{const c=getPartyCharacter(i),s=getPartyStats(i);if(c&&s){c.hp=s.maxHP;c.sp=s.maxSP;}});
                o.phase=node&&[2,4].includes(node.stage)?"guidance":"story";
                if(o.phase==="guidance"){o.nodeId=node.id;o.requiredAction=node.stage===2?"skill":"equipment";}
            })){return false;}
        }
        if(state&&!commitChange(()=>{state.lastViewedAt=now();})){return false;}
        window.FourSymbolsHeroAcquisition?.beginChapter(activeChapterId());
        runtime.visible=true;
        runtime.activePanel=opts.panel||"map";
        runtime.selectedNodeId=opts.focusNodeId||state&&state.currentNodeId||null;
        if(state?.dialogue){runtime.activePanel="story";runtime.selectedNodeId=state.dialogue.nodeId;}
        else if(state?.onboarding?.active&&["guidance","system"].includes(state.onboarding.phase)){runtime.activePanel="tutorial";}
        if(window.FourSymbolsAdventureUI&&typeof window.FourSymbolsAdventureUI.show==="function"){
            window.FourSymbolsAdventureUI.show(opts);
        }
        startObjectiveWatcher();
        render();
        if(opts.story&&!state.dialogue&&runtime.activePanel!=="tutorial"){startStory(state.currentNodeId);}
        return true;
    }

    function closeToCity(){
        const state=chapterState();
        if(state?.onboarding?.active&&!(state.onboarding.flowVersion===3&&state.onboarding.basicComplete&&['c1_02','c1_03'].includes(state.currentNodeId))){
            if(state.onboarding.requiredAction){runtime.activePanel="tutorial";render();}
            else{startStory(state.currentNodeId);}
            return false;
        }
        runtime.visible=false;
        runtime.activePanel="map";
        runtime.selectedNodeId=null;
        if(typeof showPage==="function"){ showPage("home"); }
        return true;
    }

    function hideOverlay(){
        runtime.visible=false;
        if(window.FourSymbolsAdventureUI&&typeof window.FourSymbolsAdventureUI.hide==="function"){ window.FourSymbolsAdventureUI.hide(); }
    }

    function revealHiddenNode(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const hidden=hiddenNodeById(chapter,nodeId);
        if(!state||!hidden||hidden.type!=="merchant"||!hiddenMerchantVisible(chapter,state)){ return false; }
        if(!state.hidden.merchantRevealed){ state.hidden.merchantRevealed=true;persist(); }
        runtime.activePanel="merchant";
        render();
        return true;
    }

    function selectBranch(nodeId,choiceId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||node.type!=="branch"||nodeStatus(chapter,state,node.id)!=="current"){ return false; }
        const choice=(node.branches||[]).find(entry=>entry.id===choiceId);
        if(!choice){ return false; }
        state.branchSelections[node.branchId]=choice.id;
        state.completedNodes[node.id]={completedAt:now(),choiceId:choice.id};
        state.currentNodeId=choice.nodeId;
        persist();
        recordHeroChapterNode(node.id,choice.id);
        return true;
    }

    function resolveEvent(nodeId,choiceId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||node.type!=="event"||state.completedNodes[node.id]){ return false; }
        const event=CONTENT.events[node.eventId];
        const choice=event&&event.choices&&event.choices.find(entry=>entry.id===choiceId);
        if(!event||!choice){ return false; }
        let rewardSummary=[];
        if(choice.reward){
            const granted=grantRewardObject(choice.reward);
            if(!granted.ok){ showMessage(granted.message||"事件獎勵無法領取。");return false; }
            rewardSummary=granted.summary;
        }
        if(choice.buff){
            state.pendingAdventureBuff={
                type:String(choice.buff.type||""),
                percent:numeric(choice.buff.percent),
                label:String(choice.buff.label||"下一場戰鬥有效"),
                sourceEventId:event.id,
                createdAt:now()
            };
        }
        state.lastEventResult={eventId:event.id,choiceId:choice.id,text:choice.result||"",rewardSummary:rewardSummary,buff:choice.buff||null};
        completeNode(node.id,{rewardReady:false});
        runtime.activePanel="event-result";
        render();
        return true;
    }

    function restAtNode(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||node.type!=="rest"||state.completedNodes[node.id]){ return false; }
        if(state.currentNodeId!==node.id){return false;}
        const restored=[];
        const ok=commitChange(()=>{
        getPartyIndexes().forEach(index=>{
            const character=getPartyCharacter(index),stats=getPartyStats(index);
            if(!character||!stats||numeric(character.hp)<=0){ return; }
            const hpBefore=numeric(character.hp),spBefore=numeric(character.sp);
            character.hp=Math.min(numeric(stats.maxHP),hpBefore+Math.round(numeric(stats.maxHP)*.30));
            character.sp=Math.min(numeric(stats.maxSP),spBefore+Math.round(numeric(stats.maxSP)*.30));
            restored.push({index:index,hp:Math.max(0,character.hp-hpBefore),sp:Math.max(0,character.sp-spBefore)});
        });
        state.lastRestSummary=restored;
        state.completedNodes[node.id]={completedAt:now()};if(node.next){state.currentNodeId=node.next;}
        });
        if(ok){recordHeroChapterNode(node.id);runtime.selectedNodeId=state.currentNodeId;runtime.activePanel="map";}
        if(typeof updateUI==="function"){ updateUI(); }
        if(ok){render();}
        return ok;
    }

    function openChest(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||node.type!=="chest"||state.completedNodes[node.id]){ return false; }
        const ok=completeNode(node.id,{rewardReady:true});
        if(ok){runtime.activePanel="node-reward";render();}return ok;
    }

    function finishChapter(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||node.type!=="finish"||state.chapterCompleted){ return false; }
        if(state.currentNodeId!==node.id){ return false; }
        state.completedNodes[node.id]={completedAt:now()};
        state.chapterCompleted=true;
        state.currentNodeId=node.id;
        runtime.activePanel="chapter-complete";
        persist();
        recordHeroChapterNode(node.id);
        return true;
    }

    function skillLoadout(){
        const owner=playerOwner();
        return typeof characterSkillLoadouts!=="undefined"&&owner?characterSkillLoadouts[getPartyCharacterKey(0)]:null;
    }
    function firstLessonState(){
        const state=chapterState(),o=state?.onboarding;
        const activeRetry=o?.phase==='retry'&&runtime.activeAdventureBattle?.nodeId==='c1_01'&&
            typeof battleActive!=='undefined'&&battleActive;
        return o?.active&&o.flowVersion===3&&(o.phase!=='retry'||activeRetry)&&state.currentNodeId==='c1_01'&&o.firstBattleStep!=='complete'?o:null;
    }
    function firstLessonIdentity(){
        const o=firstLessonState();return o?{uid:window.FourSymbolsAccountSave?.getActiveUid?.(),battleId:o.battleId}:null;
    }
    function canRestartFirstLessonOpening(){
        const root=rootState(),state=chapterState(),o=firstLessonState(),owner=playerOwner();
        // The initial declaration is saved before its first safe checkpoint.
        // No input can advance attack-intro until that checkpoint commits, so
        // only this exact pre-input state may use the original launch again.
        // A present-but-invalid checkpoint or any later lesson remains closed.
        return !!(o&&root.pendingStoryOpening===false&&root.activeChapterId===DEFAULT_CHAPTER_ID&&
            o.source==='new-character'&&o.phase==='battle'&&o.firstBattleStep==='attack-intro'&&
            o.nodeId==='c1_01'&&o.battleNodeId==='c1_01'&&!o.requiredAction&&!o.basicComplete&&
            !Object.prototype.hasOwnProperty.call(o,'battleCheckpoint')&&
            !Object.prototype.hasOwnProperty.call(o,'battleKillReward')&&
            !state.dialogue&&!state.chapterCompleted&&!state.chapterRewardClaimed&&!state.pendingAdventureBuff&&
            !Object.keys(state.completedNodes).length&&!Object.keys(state.rewardClaims).length&&
            owner.level===o.startingLevel&&
            window.FourSymbolsBattleFlow?.canRestartFirstTutorialBattle?.(firstLessonIdentity())===true);
    }
    function releaseFirstLessonOpeningHold(){
        const release=runtime.firstLessonOpeningRelease;runtime.firstLessonOpeningRelease=null;
        if(release){release();}
    }
    function commitFirstLesson(change){
        if(runtime.firstLessonCommitting||!firstLessonState()){return false;}
        runtime.firstLessonCommitting=true;
        try{return commitChange(()=>change(chapterState(),firstLessonState())!==false);}
        finally{runtime.firstLessonCommitting=false;}
    }
    function firstLessonView(){
        const o=firstLessonState(),owner=playerOwner();
        return o?{step:o.firstBattleStep,level:owner.level,attributePoints:owner.attributePoints,
            nativeElement:owner.element,skillReady:hasTutorialAction('skill'),
            hasCheckpoint:!!o.battleCheckpoint,battleActive:typeof battleActive!=='undefined'&&battleActive}:null;
    }
    function advanceFirstLesson(){
        const o=firstLessonState();if(!o){return false;}
        if(o.firstBattleStep==='attack-intro'&&!o.battleCheckpoint){return false;}
        const next={'attack-intro':'attack','city-intro':'city','character-intro':'exp-tab','exp-intro':'upgrade',
            'status-intro':'skill-tab','skill-intro':'skill','cast-intro':'cast'}[o.firstBattleStep];
        if(!next){return false;}
        if(o.firstBattleStep==='cast-intro'&&!(typeof battleActive!=='undefined'&&battleActive)&&!resumeFirstLessonBattle()){return false;}
        return commitFirstLesson((state,current)=>{current.firstBattleStep=next;});
    }
    function observeFirstLessonPage(page){
        const o=firstLessonState();if(!o){return false;}
        const next={city:{character:'character-intro'},'exp-tab':{expPool:'exp-intro'},
            'status-tab':{status:'status-intro'},'skill-tab':{skill:'skill-intro'}}[o.firstBattleStep]?.[page];
        return next?commitFirstLesson((state,current)=>{current.firstBattleStep=next;}):false;
    }
    function restoreFirstLessonPage(){
        const o=firstLessonState();if(!o){return false;}
        if(['attack-intro','attack','cast-intro','cast','finish-battle'].includes(o.firstBattleStep)){
            return resumeFirstLessonBattle();
        }
        hideOverlay();showPage('home');
        if(!['city-intro','city'].includes(o.firstBattleStep)){
            const tab=['exp-intro','upgrade','status-tab'].includes(o.firstBattleStep)?'expPool':
                ['status-intro','skill-tab'].includes(o.firstBattleStep)?'status':
                ['skill-intro','skill','return'].includes(o.firstBattleStep)?'skill':'status';
            openHomeFeature('character');switchCharacterTab(tab);
            window.FourSymbolsAdventureUI?.syncTutorialReturn?.(tab);
        }
        return true;
    }
    function resumeFirstLessonBattle(){
        const o=firstLessonState();
        if(!o?.battleCheckpoint||typeof window.FourSymbolsBattleFlow?.restoreFirstTutorialBattle!=='function'){return false;}
        const identity=firstLessonIdentity(),checkpoint=o.battleCheckpoint;
        if(!window.FourSymbolsBattleFlow.restoreFirstTutorialBattle(checkpoint,identity,outcome=>finishAdventureBattle('c1_01',outcome))){
            showMessage('戰鬥進度未能安全續接，請保留原存檔。');return false;
        }
        runtime.activeAdventureBattle={chapterId:activeChapterId(),nodeId:'c1_01',replay:false,startedAt:checkpoint.startedAt};
        runtime.tutorialSkillUsed=o.firstBattleStep==='finish-battle';startBattleResourceMonitor();
        return true;
    }
    function syncFirstLesson(){
        const o=firstLessonState();if(!o||runtime.firstLessonCommitting){return false;}
        if(o.firstBattleStep==='upgrade'&&playerOwner().level>=2){
            return commitFirstLesson((state,current)=>{current.firstBattleStep='status-tab';});
        }
        if(o.firstBattleStep==='skill'&&hasTutorialAction('skill')){
            return commitFirstLesson((state,current)=>{current.firstBattleStep='return';});
        }
        if(!(typeof battleActive!=='undefined'&&battleActive)||runtime.activeAdventureBattle?.nodeId!=='c1_01'||
           !['attack-intro','attack','cast-intro','cast','finish-battle'].includes(o.firstBattleStep)||
           typeof window.FourSymbolsBattleFlow?.checkpointFirstTutorialBattle!=='function'){return false;}
        const round=typeof turn==='number'?turn:0;
        if(o.battleCheckpoint&&round<=o.battleCheckpoint.turn){return false;}
        const opening=!o.battleCheckpoint;
        const leaving=o.firstBattleStep==='attack'&&!!o.battleCheckpoint&&round>o.battleCheckpoint.turn;
        const accepted=window.FourSymbolsBattleFlow.checkpointFirstTutorialBattle(firstLessonIdentity(),checkpoint=>
            commitFirstLesson((state,current)=>{
                current.battleCheckpoint=checkpoint;
                if(opening){current.phase='battle';}
                if(leaving){
                    // The existing unique source/receipt commits together with
                    // the pre-upgrade checkpoint, not after the later cast.
                    if(!Object.prototype.hasOwnProperty.call(state.rewardClaims,'c1_01')&&
                       current.startingLevel===1&&playerOwner().level===1){
                        const reward=CONTENT.rewards.story_first_growth;
                        if(!Number.isSafeInteger(reward.firstTutorialSharedExp)||reward.firstTutorialSharedExp<=0){return false;}
                        const granted=grantRewardObject({sharedExp:reward.firstTutorialSharedExp});if(!granted.ok){return false;}
                        state.rewardClaims.c1_01='claimed';state.lastRewardSummary=granted.summary;
                    }
                    current.firstBattleStep='city-intro';current.phase='system';current.requiredAction='skill';
                }else if(current.firstBattleStep==='cast'&&runtime.tutorialSkillUsed){current.firstBattleStep='finish-battle';}
            }),leaving);
        if(accepted&&opening){releaseFirstLessonOpeningHold();}
        if(accepted&&leaving){stopBattleResourceMonitor();runtime.activeAdventureBattle=null;hideOverlay();showPage('home');}
        return accepted;
    }
    function hasTutorialAction(action){
        const owner=playerOwner(),state=chapterState();
        if(!state?.onboarding?.active){return true;}
        if(action==="skill"){
            const loadout=skillLoadout();
            return !!loadout&&Object.entries(loadout.skillLevels||{}).some(([id,level])=>level>0&&loadout.equippedSkills?.includes(id));
        }
        if(action==="equipment"){
            const gear=typeof characterEquipment!=="undefined"?characterEquipment[getPartyCharacterKey(0)]:null;
            return !!state.grantedEquipmentUid&&!!gear&&Object.values(gear).some(item=>item?.v141Uid===state.grantedEquipmentUid);
        }
        if(action==="recovery"){
            const preparation=state.onboarding.preparation;
            return !!preparation&&((typeof getPotionCount==="function"&&
                (getPotionCount("hpPotion10")<preparation.hpCount||getPotionCount("spPotion10")<preparation.spCount)));
        }
        return true;
    }
    function recoveryNeedsPractice(){
        const state=chapterState(),owner=playerOwner(),stats=getPartyStats(0);
        return !!(state?.onboarding?.active&&state.onboarding.requiredAction==="recovery"&&
            !hasTutorialAction("recovery")&&owner&&stats&&owner.hp>=stats.maxHP&&owner.sp>=stats.maxSP&&
            typeof getPotionCount==="function"&&(getPotionCount("hpPotion10")>0||getPotionCount("spPotion10")>0));
    }
    function startFreshStory(){
        const owner=playerOwner();if(!owner||!owner.adventureProgress?.pendingStoryOpening){return false;}
        ensureState({persist:false});const state=chapterState();
        if(!commitChange(()=>{
            if(state.onboarding.flowVersion!==3){
                state.onboarding={active:true,phase:"story",nodeId:"c1_01",source:"new-character",
                    flowVersion:3,firstBattleStep:'attack-intro',startingLevel:integer(owner.level,1),
                    battleId:'c1-first-'+(window.crypto?.randomUUID?.()||now())};
            }
            owner.adventureProgress.pendingStoryOpening=false;
        })){return false;}
        return open({story:true});
    }
    function startStory(nodeId,phase){
        const state=chapterState(),chapter=chapterDefinition(),node=nodeById(chapter,nodeId);
        if(!node||!state||nodeStatus(chapter,state,nodeId)==="locked"){return false;}
        if(node.requiresStoryKey&&!state.storyKeys[node.requiresStoryKey]){showMessage("需要先取得黑松腰牌，再前往側門。");return false;}
        const lines=phase==="ending"?chapter.ending:phase==="guidance"?node.guidance:node.dialogue;
        if(!lines?.length){return false;}
        runtime.selectedNodeId=node.id;
        if(!commitChange(()=>{state.dialogue={nodeId:node.id,lineIndex:0,phase:phase||"before"};})){return false;}
        runtime.activePanel="story";render();return true;
    }
    function advanceDialogue(){
        const state=chapterState(),chapter=chapterDefinition(),cursor=state?.dialogue;
        const node=cursor&&nodeById(chapter,cursor.nodeId);if(!node||runtime.activePanel!=="story"){return false;}
        const lines=cursor.phase==="ending"?chapter.ending:cursor.phase==="guidance"?node.guidance:node.dialogue;
        if(cursor.lineIndex<lines.length-1){return commitChange(()=>{cursor.lineIndex++;});}
        if(cursor.phase==="guidance"){
            if(!commitChange(()=>{state.dialogue=null;state.onboarding.phase="guidance";})){return false;}
            runtime.activePanel="tutorial";render();return true;
        }
        if(cursor.phase==="ending"){
            if(!commitChange(()=>{state.dialogue=null;})){return false;}
            recordHeroChapterNode(node.id);
            runtime.activePanel="chapter-complete";render();return true;
        }
        if(state.completedNodes[node.id]){
            recordHeroChapterNode(node.id);
            if(!commitChange(()=>{state.dialogue=null;})){return false;}
            runtime.activePanel="map";render();return true;
        }
        if(["battle","elite","boss"].includes(node.type)){
            if(node.stage===5&&state.onboarding.active&&!state.onboarding.recoveryPrepared){
                const resumingRecovery=state.onboarding.requiredAction==="recovery"&&state.onboarding.nodeId===node.id;
                if(!commitChange(()=>{state.dialogue=null;state.onboarding.nodeId=node.id;state.onboarding.requiredAction="recovery";state.onboarding.phase="guidance";
                    if(!resumingRecovery||!state.onboarding.preparation){state.onboarding.preparation={hpCount:typeof getPotionCount==="function"?getPotionCount("hpPotion10"):0,spCount:typeof getPotionCount==="function"?getPotionCount("spPotion10"):0};}
                    markRewardReady(state,node);})){return false;}
                runtime.activePanel="tutorial";render();return true;
            }
            if(!commitChange(()=>{state.dialogue=null;})){return false;}
            return beginBattle(node.id);
        }
        if(node.type==="event"){
            if(!completeNode(node.id,{rewardReady:true})){return false;}
            runtime.activePanel="map";render();return true;
        }
        if(!commitChange(()=>{state.dialogue=null;})){return false;}
        runtime.activePanel=node.type;render();return true;
    }
    function getEquipmentLessonOfferIntent(){
        const state=chapterState(),o=state?.onboarding,funding=state?.equipmentLessonFunding;
        const owner=playerOwner(),ownerUid=window.FourSymbolsAccountSave?.getActiveUid?.();
        if(!ownerUid||window.FourSymbolsStartupPolicy?.getUid?.()!==ownerUid||!owner||!o?.active||o.requiredAction!=="equipment"||o.nodeId!=="c1_04"||state.currentNodeId!=="c1_04"||
            !["guidance","system","retry"].includes(o.phase)||state.completedNodes.c1_04||state.rewardClaims.c1_03!=="claimed"||
            !funding||state.grantedEquipmentUid||state.equipmentLessonPurchase){return null;}
        return {ownerUid,characterId:owner.id,source:funding.source,definitionId:funding.definitionId,amount:funding.amount};
    }
    function recordEquipmentLessonPurchase(instance,cost,intent){
        const current=getEquipmentLessonOfferIntent(),factory=window.FourSymbolsEquipmentFactory;
        if(!current||!intent||Object.keys(current).some(key=>current[key]!==intent[key])||!factory?.validUid(instance?.v141Uid)||
            instance.definitionId!==current.definitionId||factory.prices(instance).shop!==cost||cost!==current.amount){return false;}
        const state=chapterState();
        state.grantedEquipmentUid=instance.v141Uid;
        state.equipmentLessonPurchase={source:"chapter1-equipment-purchase-v1",definitionId:instance.definitionId,equipmentUid:instance.v141Uid,paidGold:cost};
        return true;
    }
    function openTutorialSystem(){
        const state=chapterState(),o=state?.onboarding;if(!o?.active||!o.requiredAction){return false;}
        if(o.requiredAction==="skill"){
            if(typeof currentSkillCharacter!=="undefined"){currentSkillCharacter=getPartyCharacterKey(0);}
            hideOverlay();showPage("home");openHomeFeature('character');switchCharacterTab('skill');
        }else if(o.requiredAction==="equipment"&&!state.grantedEquipmentUid){
            if(!getEquipmentLessonOfferIntent()){showMessage("請先領取追兵一戰的護具購置金。");return false;}
            hideOverlay();showPage("home");openHomeFeature("shop");
        }else{
            hideOverlay();showPage("inventory");
            if(typeof renderInventory==="function"){renderInventory();}
        }
        window.FourSymbolsAdventureUI?.syncTutorialReturn(o.requiredAction==="skill"?"skill":o.requiredAction==="equipment"&&!state.grantedEquipmentUid?"shop":"inventory");
        return true;
    }
    function returnFromTutorial(){
        const o=firstLessonState();
        if(o&&o.firstBattleStep==='return'){
            if(!hasTutorialAction('skill')){return false;}
            if(typeof closeHomeFeature==='function'){closeHomeFeature();}
            if(typeof document!=='undefined'&&document.getElementById('homeFeatureModal')?.classList.contains('show')){return false;}
            if(!commitFirstLesson((state,current)=>{current.firstBattleStep='cast-intro';current.phase='battle';})){return false;}
            return resumeFirstLessonBattle();
        }
        if(typeof closeHomeFeature==='function'){closeHomeFeature();}
        if(typeof document!=='undefined'&&document.getElementById('homeFeatureModal')?.classList.contains('show')){return false;}
        return open({panel:"tutorial"});
    }
    function continueTutorial(){
        const state=chapterState(),o=state?.onboarding;if(!o?.active||!o.requiredAction||o.nodeId!==state.currentNodeId||state.completedNodes[o.nodeId]){return false;}
        const practice=recoveryNeedsPractice();
        if(!hasTutorialAction(o.requiredAction)&&!practice){showMessage(o.requiredAction==="skill"?"請先實際學習並裝上技能。":o.requiredAction==="equipment"?"請先穿上剛取得的護具。":"請先使用補品完成實作。");return false;}
        if(!commitChange(()=>{
            o.phase="retry";if(o.requiredAction==="recovery"&&!practice){o.recoveryPrepared=true;}state.dialogue=null;
            // Training recovery is explicit and bounded to the onboarding fight.
            if(!practice){getPartyIndexes().forEach(i=>{const c=getPartyCharacter(i),s=getPartyStats(i);if(c&&s){c.hp=s.maxHP;c.sp=s.maxSP;}});}
        })){return false;}
        return beginBattle(o.nodeId);
    }
    function confirmPreparation(){
        const o=chapterState()?.onboarding;if(!o?.active||o.requiredAction!=="recovery"){return false;}
        // Acknowledging text cannot stand in for using the original potion owner.
        return hasTutorialAction("recovery");
    }
    function buildTutorialEncounter(node){
        const profile=CONTENT.tutorialEncounters[node.tutorialEncounterId],state=chapterState(),stats=getPartyStats(0),owner=playerOwner();
        if(!profile||!stats||!owner){return null;}
        const unprepared=state.onboarding.active&&profile.lesson&&!hasTutorialAction(profile.lesson);
        const config=unprepared?profile.unprepared:profile;
        const hp=Math.ceil(stats.attack*(config.hpRatio||profile.hpRatio));
        const constant=typeof getDamageFormulaConstant==="function"?getDamageFormulaConstant(owner.level):100;
        const desired=config.damageRatio?stats.maxHP*config.damageRatio:profile.damage;
        return [{name:profile.name,portraitName:profile.portraitName,monsterKey:"tutorial."+node.id,
            portraitKey:profile.portraitKey,
            level:owner.level,element:owner.element,rank:"regular",mode:"tutorial",tutorialEncounter:true,
            hp,maxHP:hp,sp:0,maxSP:0,attack:desired*(constant+stats.defense)/constant,magicAttack:0,defense:0,
            agility:0,speed:0,accuracy:0,evasion:0,criticalChance:0,skillIds:[],skillChance:0,statusEffects:[],activeBuffs:[],alive:true,
            vAdventure:true,vAdventureEncounterId:node.tutorialEncounterId}];
    }

    function buildEncounter(encounterId){
        const encounter=CONTENT.encounters[encounterId];
        if(!encounter||!Array.isArray(encounter.enemies)||!window.MonsterBalance||typeof window.MonsterBalance.build!=="function"){ return null; }
        return encounter.enemies.map((entry,index)=>{
            const chapter=chapterDefinition();
            const monster=window.MonsterBalance.build({monsterKey:entry.monsterKey,name:entry.name,level:entry.level,element:entry.element,archetype:entry.archetype,rank:entry.rank,mode:"adventure",chapterId:chapter.id,encounterId:encounter.id,context:"adventure/"+chapter.id+"/"+encounter.id});
            if(entry.portraitKey){monster.portraitKey=entry.portraitKey;}
            monster.skillIds=getMonsterSkillPoolForLevel(entry.element,entry.level);
            monster.skillChance=getMonsterSkillTierAndChance(entry.level).chance;
            configureBuiltMonster(monster);
            monster.vAdventure=true;
            monster.vAdventureEncounterId=encounterId;
            monster.vAdventureSlot=index;
            return monster;
        });
    }

    function captureResources(){
        return getPartyIndexes().map(index=>{
            const character=getPartyCharacter(index);
            return character?{index:index,hp:numeric(character.hp),sp:numeric(character.sp)}:null;
        }).filter(Boolean);
    }

    function startBattleResourceMonitor(){
        stopBattleResourceMonitor();
        runtime.battleResourceSnapshot=captureResources();
        if(typeof setInterval!=="function"){ return; }
        runtime.battleResourceTimer=setInterval(()=>{
            if(!runtime.activeAdventureBattle){ return; }
            if(typeof battleActive!=="undefined"&&battleActive){ runtime.battleResourceSnapshot=captureResources(); }
        },BATTLE_RESOURCE_POLL_MS);
    }
    function stopBattleResourceMonitor(){
        if(runtime.battleResourceTimer&&typeof clearInterval==="function"){ clearInterval(runtime.battleResourceTimer); }
        runtime.battleResourceTimer=null;
    }
    function restoreLastBattleResources(){
        (runtime.battleResourceSnapshot||[]).forEach(entry=>{
            const character=getPartyCharacter(entry.index),stats=getPartyStats(entry.index);
            if(!character){ return; }
            character.hp=Math.max(0,Math.min(numeric(stats&&stats.maxHP,entry.hp),numeric(entry.hp)));
            character.sp=Math.max(0,Math.min(numeric(stats&&stats.maxSP,entry.sp),numeric(entry.sp)));
        });
        if(typeof updateUI==="function"){ updateUI(); }
    }

    function consumePendingAdventureBuff(){
        const state=chapterState();
        const buff=state&&state.pendingAdventureBuff;
        if(!state||!buff){ return null; }
        const applied=clone(buff);
        if(buff.type==="sp-start"){
            getPartyIndexes().forEach(index=>{
                const character=getPartyCharacter(index),stats=getPartyStats(index);
                if(!character||!stats||numeric(character.hp)<=0){ return; }
                const amount=Math.round(numeric(stats.maxSP)*clamp(numeric(buff.percent),0,100)/100);
                character.sp=Math.min(numeric(stats.maxSP),numeric(character.sp)+amount);
            });
        }
        state.pendingAdventureBuff=null;
        state.lastConsumedAdventureBuff={type:buff.type,label:buff.label||"",consumedAt:now()};
        persist({render:false});
        if(typeof updateUI==="function"){ updateUI(); }
        return applied;
    }

    function beginBattle(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||!["battle","elite","boss"].includes(node.type)){ return false; }
        if(nodeId==='c1_01'&&firstLessonState()?.battleCheckpoint){return restoreFirstLessonPage();}
        if(nodeId==='c1_01'&&firstLessonState()?.phase==='battle'&&!state.onboarding.battleCheckpoint&&
           !(typeof battleActive!=='undefined'&&battleActive)&&!canRestartFirstLessonOpening()){
            showMessage('尚無可安全續接的戰鬥紀錄，請保留原存檔。');return false;
        }
        const status=nodeStatus(chapter,state,node.id);
        const replay=state.completedNodes[node.id]===true||!!state.completedNodes[node.id];
        if(status==="locked"||(!replay&&!state.chapterCompleted&&node.id!==state.currentNodeId)){ return false; }
        if(typeof battleActive!=="undefined"&&battleActive){ showMessage("目前正在戰鬥中，無法開始新的冒險戰鬥。");return false; }
        if(typeof window.v132LaunchDungeonBattle!=="function"){ showMessage("正式戰鬥 Runtime 尚未就緒。");return false; }
        const firstOpening=node.id==='c1_01'&&state.currentNodeId===node.id&&!state.completedNodes[node.id]&&
            state.onboarding.active&&state.onboarding.flowVersion===3;
        if(firstOpening&&(!['story','retry','battle'].includes(state.onboarding.phase)||
           (state.onboarding.phase==='retry'?!['attack-intro','finish-battle'].includes(state.onboarding.firstBattleStep):
               state.onboarding.firstBattleStep!=='attack-intro')||
           Object.prototype.hasOwnProperty.call(state.onboarding,'battleCheckpoint')||
           typeof window.FourSymbolsBattleFlow?.acquireInputGuideHold!=='function'||
           window.FourSymbolsBattleFlow?.canRestartFirstTutorialBattle?.({uid:window.FourSymbolsAccountSave?.getActiveUid?.(),battleId:state.onboarding.battleId})!==true)){
            showMessage('尚無可安全續接的戰鬥紀錄，請保留原存檔。');return false;
        }
        if(node.requiresStoryKey&&!state.storyKeys?.[node.requiresStoryKey]){return false;}
        if(state.onboarding?.active&&state.onboarding.nodeId===node.id&&state.onboarding.requiredAction&&!hasTutorialAction(state.onboarding.requiredAction)&&!recoveryNeedsPractice()){
            runtime.activePanel="tutorial";render();return false;
        }
        const roster=node.tutorialEncounterId?buildTutorialEncounter(node):buildEncounter(node.encounterId);
        if(!roster||!roster.length){ showMessage("此節點的敵人編成無法建立。");return false; }
        if(state.onboarding.active&&!commitChange(()=>{
            // Until the first DTO commits, a reload must retain the original
            // story/retry entry. This also retires old pre-DTO battle writes.
            state.onboarding.phase=firstOpening?(state.onboarding.phase==='retry'?'retry':'story'):'battle';
            state.onboarding.battleNodeId=node.id;
        })){return false;}

        consumePendingAdventureBuff();
        runtime.activeAdventureBattle={chapterId:chapter.id,nodeId:node.id,replay:replay,startedAt:now()};
        runtime.tutorialSkillUsed=false;
        startBattleResourceMonitor();
        hideOverlay();

        if(window.FourSymbolsBattlefieldSlots){ window.FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot(); }
        const started=window.v132LaunchDungeonBattle(roster,outcome=>finishAdventureBattle(node.id,outcome),
            {mode:"adventure",normalizeFailureResources:false,tutorial:!!node.tutorialEncounterId&&state.onboarding?.active===true});
        if(!started){
            releaseFirstLessonOpeningHold();
            stopBattleResourceMonitor();runtime.activeAdventureBattle=null;runtime.visible=true;
            if(window.FourSymbolsAdventureUI&&typeof window.FourSymbolsAdventureUI.show==="function"){ window.FourSymbolsAdventureUI.show(); }
            return false;
        }
        if(firstOpening){
            releaseFirstLessonOpeningHold();
            // Launch is synchronous and uses manual tutorial controls. Hold
            // its original timer before yielding, even if rAF is suspended.
            runtime.firstLessonOpeningRelease=window.FourSymbolsBattleFlow.acquireInputGuideHold('chapter1-opening');
        }
        try{
            if(window.v132ActiveDungeonRun){window.v132ActiveDungeonRun.adventure=true;window.v132ActiveDungeonRun.adventureNodeId=node.id;}
        }catch(_){ }
        return true;
    }
    // Both the original launch and a retained first-battle checkpoint use this
    // same settlement callback; restoring never manufactures a second battle.
    function finishAdventureBattle(nodeId,outcome){
            const chapter=chapterDefinition(),state=chapterState(),node=nodeById(chapter,nodeId);
            if(!state||!node){return;}
            const battleInfo=runtime.activeAdventureBattle;
            releaseFirstLessonOpeningHold();
            stopBattleResourceMonitor();
            runtime.activeAdventureBattle=null;
            if(!battleInfo){ return; }
            if(outcome&&outcome.result==="win"){
                if(node.stage===5&&state.onboarding.active&&!hasTutorialAction("recovery")){
                    if(!commitChange(()=>{state.onboarding.phase="guidance";state.dialogue=null;})){return;}
                    runtime.visible=true;runtime.selectedNodeId=node.id;runtime.activePanel="tutorial";
                    window.FourSymbolsAdventureUI?.show({focusNodeId:node.id});return;
                }
                if(node.stage===3&&state.onboarding.active&&!state.onboarding.basicComplete&&!runtime.tutorialSkillUsed){
                    showMessage("這次請實際使用剛學會的技能，再突破追兵。");
                    runtime.visible=true;runtime.activePanel="map";
                    window.FourSymbolsAdventureUI?.show({focusNodeId:node.id});return;
                }
                if(!battleInfo.replay&&!state.completedNodes[node.id]){
                    if(!completeNode(node.id,{rewardReady:true})){showMessage("進度未能保存，請保留原帳號並重試。");}
                }else{ persist({render:false}); }
            }else{
                if(state.onboarding?.active&&[2,4].includes(node.stage)&&!(node.stage===2&&state.onboarding.basicComplete)){
                    const ok=commitChange(()=>{state.onboarding.nodeId=node.id;state.onboarding.requiredAction=node.stage===2?"skill":"equipment";state.onboarding.phase="guidance";state.currentNodeId=node.id;});
                    runtime.visible=true;runtime.activePanel="tutorial";window.FourSymbolsAdventureUI?.show();
                    if(ok){startStory(node.id,"guidance");}return;
                }
                /* v132 generic dungeon failure historically normalizes party resources.
                   Restore the last live combat snapshot so Adventure never grants a free refill. */
                restoreLastBattleResources();
                if(node.id==='c1_01'&&state.onboarding.flowVersion===3){
                    // A terminal loss cannot resurrect a prior live snapshot.
                    // Return to the original visible retry entry, rather than
                    // leaving a battle phase without a restorable checkpoint.
                    if(!commitChange(()=>{
                        delete state.onboarding.battleCheckpoint;
                        state.onboarding.phase='retry';state.onboarding.requiredAction=null;
                        state.onboarding.firstBattleStep=state.rewardClaims.c1_01==='claimed'?'finish-battle':'attack-intro';
                        state.dialogue=null;
                    })){showMessage('戰鬥結束進度未能保存，請保留原存檔。');return;}
                }
                state.currentNodeId=node.id;
                persist({render:false});
            }
            if(typeof showPage==="function"){ showPage("home"); }
            runtime.visible=true;
            const rewardReady=state.rewardClaims[node.id]==="ready";
            runtime.selectedNodeId=rewardReady?node.id:state.currentNodeId;
            runtime.activePanel=rewardReady?"node-reward":"map";
            if(window.FourSymbolsAdventureUI&&typeof window.FourSymbolsAdventureUI.show==="function"){
                window.FourSymbolsAdventureUI.show({battleOutcome:outcome&&outcome.result||"lose",focusNodeId:runtime.selectedNodeId});
            }
            render();
            if(outcome?.result==="win"&&state.chapterCompleted&&node.id===chapter.endNodeId){startStory(node.id,"ending");}
    }

    function unlockedZoneProfiles(){
        const result=[];
        if(typeof zoneConfig==="undefined"||!zoneConfig||typeof zoneConfig!=="object"){ return result; }
        const highest=highestPartyLevel();
        Object.keys(zoneConfig).forEach((key,index)=>{
            const config=zoneConfig[key];
            let roster=[];
            try{
                const source=config&&config.monsters;
                roster=typeof source==="function"?source():source;
            }catch(_){ roster=[]; }
            if(!Array.isArray(roster)||!roster.length){ return; }
            const valid=roster.filter(Boolean);
            const minLevel=valid.reduce((min,monster)=>Math.min(min,Math.max(1,integer(monster.level,1))),Infinity);
            if(!Number.isFinite(minLevel)||minLevel>highest){ return; }
            result.push({
                key:key,index:index,minLevel:minLevel,
                label:String(config&&config.name||config&&config.title||key),
                monsters:valid
            });
        });
        result.sort((a,b)=>a.minLevel-b.minLevel||a.index-b.index);
        return result;
    }

    function chooseObjectiveTarget(objectiveDef,rng){
        const random=typeof rng==="function"?rng:Math.random;
        const zones=unlockedZoneProfiles();
        if(!zones.length){ return null; }
        const zone=objectiveDef&&objectiveDef.preferHighestUnlocked?zones[zones.length-1]:zones[Math.floor(clamp(random(),0,.999999)*zones.length)];
        const allowed=new Set(objectiveDef&&Array.isArray(objectiveDef.allowedRanks)?objectiveDef.allowedRanks:["regular"]);
        const regular=zone.monsters.filter(monster=>(monster.rank||"regular")==="regular"&&allowed.has("regular"));
        const candidates=regular.length?regular:zone.monsters.filter(monster=>allowed.has(monster.rank||"regular"));
        const safeCandidates=candidates.length?candidates:zone.monsters;
        const target=safeCandidates[Math.floor(clamp(random(),0,.999999)*safeCandidates.length)]||safeCandidates[0];
        if(!target){ return null; }
        return {
            zoneKey:zone.key,
            zoneLabel:zone.label,
            zoneMinLevel:zone.minLevel,
            monsterName:String(target.name||"指定怪物"),
            monsterRank:String(target.rank||"regular")
        };
    }

    function possibleKillCount(value,name){
        if(value==null){ return null; }
        if(typeof value==="number"){ return Math.max(0,integer(value)); }
        if(Array.isArray(value)){
            const match=value.find(entry=>entry&&typeof entry==="object"&&[entry.name,entry.monsterName,entry.id].some(field=>String(field||"")===name));
            return match?possibleKillCount(match,name):null;
        }
        if(typeof value!=="object"){ return null; }
        for(const key of ["kills","killCount","count","defeated","defeatCount"]){
            if(Number.isFinite(Number(value[key]))){ return Math.max(0,integer(value[key])); }
        }
        return null;
    }

    function readBestiaryKillCount(monsterName){
        if(typeof bestiaryData==="undefined"||!bestiaryData){ return 0; }
        const name=String(monsterName||"");
        if(!name){ return 0; }
        if(typeof bestiaryData==="object"&&!Array.isArray(bestiaryData)){
            if(Object.prototype.hasOwnProperty.call(bestiaryData,name)){
                const direct=possibleKillCount(bestiaryData[name],name);
                if(direct!==null){ return direct; }
            }
            for(const [key,value] of Object.entries(bestiaryData)){
                if(String(key)===name){
                    const direct=possibleKillCount(value,name);
                    if(direct!==null){ return direct; }
                }
                if(value&&typeof value==="object"&&[value.name,value.monsterName,value.id].some(field=>String(field||"")===name)){
                    const found=possibleKillCount(value,name);
                    if(found!==null){ return found; }
                }
            }
        }
        const arrayCount=possibleKillCount(bestiaryData,name);
        return arrayCount===null?0:arrayCount;
    }

    function processDropAttempts(objective,count,rng){
        const random=typeof rng==="function"?rng:Math.random;
        const attempts=Math.max(0,integer(count));
        let changed=false;
        for(let i=0;i<attempts&&objective.current<objective.target;i++){
            const guaranteed=integer(objective.missesSinceDrop)>=integer(objective.pityMisses,3);
            const drop=guaranteed||random()<clamp(numeric(objective.dropRate,.4),0,1);
            if(drop){
                objective.current=Math.min(objective.target,integer(objective.current)+1);
                objective.missesSinceDrop=0;
                changed=true;
            }else{
                objective.missesSinceDrop=integer(objective.missesSinceDrop)+1;
                changed=true;
            }
        }
        objective.ready=integer(objective.current)>=integer(objective.target);
        return changed;
    }

    function ensureObjective(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId);
        if(!state||!node||node.type!=="objective"){ return null; }
        if(state.objective&&state.objective.sourceNodeId===node.id&&!state.objective.turnedIn){ return state.objective; }
        const definition=CONTENT.objectives[node.objectiveId];
        const target=chooseObjectiveTarget(definition);
        if(!definition||!target){
            showMessage("目前找不到可安全生成的已開放野怪委託。請稍後再試。");
            return null;
        }
        const count=readBestiaryKillCount(target.monsterName);
        state.objective={
            id:definition.id,
            sourceNodeId:node.id,
            active:true,
            turnedIn:false,
            ready:false,
            current:0,
            target:clamp(integer(definition.target,5),integer(definition.minTarget,3),integer(definition.maxTarget,8)),
            dropRate:clamp(numeric(definition.dropRate,.4),0,1),
            pityMisses:Math.max(1,integer(definition.pityMisses,3)),
            missesSinceDrop:0,
            zoneKey:target.zoneKey,
            zoneLabel:target.zoneLabel,
            zoneMinLevel:target.zoneMinLevel,
            monsterName:target.monsterName,
            monsterRank:target.monsterRank,
            itemLabel:target.monsterName+"的委託信物",
            observedKillCount:count,
            createdAt:now()
        };
        persist();
        startObjectiveWatcher();
        return state.objective;
    }

    function syncObjectiveProgress(){
        const state=chapterState();
        const objective=state&&state.objective;
        if(!objective||!objective.active||objective.turnedIn||objective.ready){ return false; }
        const currentCount=readBestiaryKillCount(objective.monsterName);
        const observed=Math.max(0,integer(objective.observedKillCount));
        if(currentCount<observed){
            objective.observedKillCount=currentCount;
            persist({render:false});
            return true;
        }
        const delta=currentCount-observed;
        if(delta<=0){ return false; }
        objective.observedKillCount=currentCount;
        const changed=processDropAttempts(objective,delta,Math.random);
        if(changed){ persist({render:true}); }
        return changed;
    }

    function reportPatrolKill(monster){
        const state=chapterState();
        const objective=state&&state.objective;
        const name=typeof monster==="string"?monster:String(monster&&monster.name||"");
        if(!objective||!objective.active||objective.turnedIn||objective.ready||name!==objective.monsterName){ return false; }
        const changed=processDropAttempts(objective,1,Math.random);
        if(changed){ objective.observedKillCount=Math.max(integer(objective.observedKillCount),readBestiaryKillCount(name));persist(); }
        return changed;
    }

    function startObjectiveWatcher(){
        if(runtime.objectiveTimer||typeof setInterval!=="function"){ return; }
        runtime.objectiveTimer=setInterval(syncObjectiveProgress,OBJECTIVE_POLL_MS);
    }

    function turnInObjective(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,nodeId)||(CONTENT.legacyNodes||[]).find(n=>n.id===nodeId);
        const objective=state&&state.objective;
        if(!state||!node||node.type!=="objective"||!objective||objective.sourceNodeId!==node.id||!objective.ready||objective.turnedIn){ return false; }
        const ok=commitChange(()=>{
        objective.turnedIn=true;
        objective.active=false;
        state.completedNodes[node.id]={completedAt:now()};
        markRewardReady(state,node);
        if(!state.chapterCompleted&&state.currentNodeId===node.id&&node.next){ state.currentNodeId=node.next; }
        });
        if(ok){recordHeroChapterNode(node.id);}return ok;
    }

    function goToPatrol(){
        const state=chapterState();
        const objective=state&&state.objective;
        if(!objective||!objective.active||objective.turnedIn){ return false; }
        hideOverlay();
        if(typeof showPage==="function"){ showPage("training"); }
        if(typeof window.v173AdventureObjectiveTarget==="undefined"){
            window.v173AdventureObjectiveTarget={zoneKey:objective.zoneKey,monsterName:objective.monsterName};
        }else{
            window.v173AdventureObjectiveTarget.zoneKey=objective.zoneKey;
            window.v173AdventureObjectiveTarget.monsterName=objective.monsterName;
        }
        return true;
    }

    function returnFromPatrol(){
        if(typeof battleActive!=="undefined"&&battleActive){
            showMessage("戰鬥結束後可返回冒險。");
            return false;
        }
        const patrolLifecycle=window.FourSymbolsPatrolLifecycle;
        if(!patrolLifecycle||typeof patrolLifecycle.exit!=="function"){
            showMessage("巡怪離場狀態尚未就緒，請稍後再返回冒險。");
            return false;
        }
        if(!patrolLifecycle.exit("adventure-return")){
            showMessage("戰鬥結束後可返回冒險。");
            return false;
        }
        const state=chapterState();
        const objective=state&&state.objective;
        if(!objective){ return open(); }
        return open({panel:"objective",focusNodeId:objective.sourceNodeId});
    }

    function merchantStock(){ return CONTENT.merchantPool.slice(0,6).map(item=>Object.assign({},item)); }
    function buyMerchantItem(itemId){
        const chapter=chapterDefinition();
        const state=chapterState();
        if(!state||!hiddenMerchantVisible(chapter,state)||!state.hidden.merchantRevealed){ return false; }
        const item=CONTENT.merchantPool.find(entry=>entry.id===itemId);
        if(!item||state.merchant.purchases[item.id]){ return false; }
        const price=Math.max(0,integer(item.price));
        if(typeof gold==="undefined"||integer(gold)<price){ showMessage("金幣不足。");return false; }
        if(!canAddPotion(item.id,Math.max(1,integer(item.quantity,1)))){ showMessage("背包空間不足。");return false; }
        if(!addPotion(item.id,Math.max(1,integer(item.quantity,1)))){ showMessage("商品加入背包失敗。");return false; }
        gold=Math.max(0,integer(gold)-price);
        state.merchant.purchases[item.id]={purchasedAt:now(),quantity:Math.max(1,integer(item.quantity,1)),price:price};
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        if(typeof updateUI==="function"){ updateUI(); }
        persist();
        return true;
    }

    function selectNode(nodeId){
        const chapter=chapterDefinition();
        const state=chapterState();
        if(!state){ return false; }
        const hidden=hiddenNodeById(chapter,nodeId);
        if(hidden){ return revealHiddenNode(nodeId); }
        const node=nodeById(chapter,nodeId);
        if(!node){ return false; }
        const status=nodeStatus(chapter,state,node.id);
        if(status==="locked"){ showMessage(branchLockReason(chapter,state,node)||"這個節點尚未解鎖。");return false; }
        runtime.selectedNodeId=node.id;
        runtime.activePanel="map";
        render();
        return true;
    }

    function activateSelectedNode(){
        const chapter=chapterDefinition();
        const state=chapterState();
        const node=nodeById(chapter,runtime.selectedNodeId);
        if(!state||!node){ return false; }
        if(node.id==='c1_01'&&firstLessonState()?.battleCheckpoint){return restoreFirstLessonPage();}
        const status=nodeStatus(chapter,state,node.id);
        if(status==="locked"||status==="planned"){
            showMessage(status==="planned"?"此段江湖旅程仍在整備中。":branchLockReason(chapter,state,node)||"這個節點尚未解鎖。");
            return false;
        }
        if(node.dialogue){
            if(state.rewardClaims[node.id]==="ready"){runtime.activePanel="node-reward";render();return true;}
            return startStory(node.id);
        }
        runtime.activePanel=node.type;
        if(node.type==="battle"||node.type==="elite"||node.type==="boss"){
            if(state.rewardClaims[node.id]==="ready"){
                runtime.activePanel="node-reward";render();return true;
            }
            return beginBattle(node.id);
        }
        if(node.type==="event"){
            runtime.activePanel=state.completedNodes[node.id]?"event-view":"event";render();return true;
        }
        if(node.type==="branch"){
            runtime.activePanel="branch";render();return true;
        }
        if(node.type==="objective"){
            ensureObjective(node.id);runtime.activePanel="objective";render();return true;
        }
        if(node.type==="rest"){
            runtime.activePanel="rest";render();return true;
        }
        if(node.type==="chest"){
            runtime.activePanel="chest";render();return true;
        }
        if(node.type==="finish"){
            if(!state.chapterCompleted){ finishChapter(node.id); }
            else{ runtime.activePanel="chapter-complete";render(); }
            return true;
        }
        return false;
    }

    function openNode(nodeId){ return selectNode(nodeId); }
    function setPanel(panel){ runtime.activePanel=String(panel||"map");render(); }
    function getRuntimeView(){
        const chapter=chapterDefinition();
        const state=chapterState();
        return {
            visible:runtime.visible,
            panel:runtime.activePanel,
            selectedNodeId:runtime.selectedNodeId,
            dialogue:state&&state.dialogue||null,
            tutorial:state&&state.onboarding||null,
            firstLesson:firstLessonView(),
            tutorialProgress:state?.onboarding?.active?{
                nativeElement:playerOwner()?.element,
                skillReady:hasTutorialAction("skill"),equipmentReady:hasTutorialAction("equipment"),
                equipmentAcquired:!!state.grantedEquipmentUid,equipmentNeedsPurchase:!!getEquipmentLessonOfferIntent(),
                recoveryReady:hasTutorialAction("recovery"),recoveryNeedsPractice:recoveryNeedsPractice(),skillUsed:runtime.tutorialSkillUsed,
                loadout:clone(skillLoadout()),resources:clone(getPartyStats(0))
            }:null,
            chapter:chapter,
            state:state,
            objective:state&&state.objective||null,
            pendingAdventureBuff:state&&state.pendingAdventureBuff||null,
            merchantVisible:hiddenMerchantVisible(chapter,state),
            attention:attentionNeeded()
        };
    }

    function startPendingBattleWatcher(){
        if(runtime.pendingBattleTimer||typeof setInterval!=="function"){ return; }
        runtime.pendingBattleTimer=setInterval(()=>{
            const active=typeof battleActive!=="undefined"&&!!battleActive;
            if(active&&!runtime.battleWasActive&&!runtime.activeAdventureBattle){ consumePendingAdventureBuff(); }
            runtime.battleWasActive=active;
        },PENDING_BATTLE_POLL_MS);
    }

    ensureState({persist:false});
    startObjectiveWatcher();
    startPendingBattleWatcher();
    if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
        document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ syncObjectiveProgress(); } });
    }
    if(typeof window.addEventListener==="function"){
        window.addEventListener("pageshow",syncObjectiveProgress);
    }
    window.FourSymbolsCombatEvents?.subscribe("skill_spent",event=>{
        if(runtime.activeAdventureBattle&&event.actor===playerOwner()&&event.actualSpent>0){runtime.tutorialSkillUsed=true;}
    });

    window.FourSymbolsAdventure=Object.freeze({
        syncFirstLesson,advanceFirstLesson,observeFirstLessonPage,
        getEquipmentLessonOfferIntent,recordEquipmentLessonPurchase,
        stateVersion:STATE_VERSION,
        startFreshStory:startFreshStory,startStory:startStory,advanceDialogue:advanceDialogue,
        continueTutorial:continueTutorial,openTutorialSystem:openTutorialSystem,returnFromTutorial:returnFromTutorial,
        confirmPreparation:confirmPreparation,
        openLegacyReward:function(id){if(!(CONTENT.legacyNodes||[]).some(n=>n.id===id)||chapterState()?.rewardClaims[id]!=="ready"){return false;}runtime.selectedNodeId=id;runtime.activePanel="node-reward";render();return true;},
        open:open,
        closeToCity:closeToCity,
        hide:hideOverlay,
        openNode:openNode,
        selectNode:selectNode,
        activateSelectedNode:activateSelectedNode,
        setPanel:setPanel,
        selectBranch:selectBranch,
        resolveEvent:resolveEvent,
        restAtNode:restAtNode,
        openChest:openChest,
        beginBattle:beginBattle,
        ensureObjective:ensureObjective,
        syncObjectiveProgress:syncObjectiveProgress,
        reportPatrolKill:reportPatrolKill,
        turnInObjective:turnInObjective,
        goToPatrol:goToPatrol,
        returnFromPatrol:returnFromPatrol,
        revealHiddenNode:revealHiddenNode,
        merchantStock:merchantStock,
        buyMerchantItem:buyMerchantItem,
        claimNodeReward:claimNodeReward,
        claimChapterReward:claimChapterReward,
        finishChapter:finishChapter,
        getView:getRuntimeView,
        getChapterState:function(id){ return clone(chapterState(id)); },
        getNodeStatus:function(nodeId){ const chapter=chapterDefinition();return nodeStatus(chapter,chapterState(),nodeId); },
        getUnlockedZones:function(){ return clone(unlockedZoneProfiles()); },
        __test:Object.freeze({
            processDropAttempts:processDropAttempts,
            readBestiaryKillCount:readBestiaryKillCount,
            chooseObjectiveTarget:chooseObjectiveTarget,
            nodeStatus:function(nodeId){ const chapter=chapterDefinition();return nodeStatus(chapter,chapterState(),nodeId); },
            captureResources:captureResources,
            consumePendingAdventureBuff:consumePendingAdventureBuff
        })
    });

    dispatchStateChange();
})();
