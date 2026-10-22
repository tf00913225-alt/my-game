/* =====================================================
   出城冒險 V1 — shared UI renderer owner
   One renderer for map/events/objective/merchant/reward views.
===================================================== */
(function installAdventureUiV1(){
    "use strict";
    if(typeof window==="undefined"||window.FourSymbolsAdventureUI){ return; }

    const API=()=>window.FourSymbolsAdventure;
    const CONTENT=()=>window.FourSymbolsAdventureContent;
    const ui={root:null,body:null,tracker:null,lastFocusNodeId:null,lastMapKey:null};

    function esc(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function attr(value){ return esc(value).replace(/`/g,"&#096;"); }
    function runtimeView(){ return API()&&API().getView?API().getView():null; }
    function globalGold(){ try{ return typeof gold!=="undefined"?Math.max(0,Math.floor(Number(gold)||0)):0; }catch(_){ return 0; } }
    function potionCount(id){
        if(window.FourSymbolsAdventureItems&&window.FourSymbolsAdventureItems.count){ return window.FourSymbolsAdventureItems.count(id); }
        try{ return typeof getPotionCount==="function"?Math.max(0,Number(getPotionCount(id))||0):0; }catch(_){ return 0; }
    }

    function ensureRoot(){
        if(ui.root&&ui.root.isConnected){ return ui.root; }
        if(typeof document==="undefined"){ return null; }
        const stage=document.getElementById("game-content")||document.getElementById("game-stage")||document.body;
        let root=document.getElementById("adventurePage");
        if(!root){
            root=document.createElement("section");
            root.id="adventurePage";
            root.className="page adventure-page";
            root.hidden=true;
            root.setAttribute("aria-label","出城冒險章節地圖");
            root.innerHTML=
                '<div class="adventure-scene-decor" aria-hidden="true"><span class="adventure-world-bg"></span><span class="adventure-world-near"></span></div>'+
                '<header class="adventure-header">'+
                    '<button type="button" class="adventure-back-button" onclick="FourSymbolsAdventure.closeToCity()" aria-label="返回主城">←</button>'+
                    '<div class="adventure-heading"><span>出城冒險</span><strong id="adventureHeaderTitle">章節</strong><small>踏出城門 · 初入山關 · 前路未明，江湖自此展開</small></div>'+
                    '<div class="adventure-header-meta" id="adventureHeaderMeta"></div>'+
                '</header>'+
                '<div class="adventure-view" id="adventureView"></div>';
            stage.appendChild(root);
        }
        ui.lastMapKey=null;
        ui.root=root;
        ui.body=root.querySelector("#adventureView");
        return root;
    }

    function statusLabel(status){
        const labels={
            locked:"未解鎖",available:"可探索",current:"目前節點",completed:"已完成",
            "branch-selected":"路線已完成","objective-active":"委託進行中","objective-ready":"委託完成",
            boss:"Boss","hidden-available":"？",merchant:"神秘商人","reward-unclaimed":"獎勵待領"
        };
        return labels[status]||status;
    }

    function nodeGlyph(type,status){
        if(status==="hidden-available"){ return "？"; }
        const glyph={battle:"戰",elite:"精",event:"人",objective:"令",rest:"休",chest:"箱",branch:"岔",boss:"首",finish:"旗",merchant:"商"};
        return glyph[type]||"路";
    }

    function nodeTypeClass(type){ return "type-"+String(type||"road").replace(/[^a-z-]/g,""); }

    function routeState(view,route){
        const from=API().getNodeStatus(route.from),to=API().getNodeStatus(route.to);
        if(from==="completed"||from==="branch-selected"||from==="boss"){
            if(to!=="locked"&&to!=="planned"){ return "completed"; }
            return "next";
        }
        if(from==="current"||to==="current"){ return "current"; }
        return to==="planned"?"planned":"locked";
    }
    function mapRoadSvg(view){
        const routes=Array.isArray(view.chapter.routes)?view.chapter.routes:[];
        const nodes=new Map(view.chapter.nodes.map(node=>[node.id,node]));
        const paths=routes.map(route=>{
            const from=nodes.get(route.from),to=nodes.get(route.to);
            if(!from||!to){ return ""; }
            const state=routeState(view,route),midX=Number(route.bendX||((Number(from.x)+Number(to.x))/2)),midY=Number(route.bendY||((Number(from.y)+Number(to.y))/2));
            return '<path class="adventure-route adventure-route-'+state+'" d="M '+Number(from.x*10.8)+' '+Number(from.y*19.2)+' Q '+(midX*10.8)+' '+(midY*19.2)+' '+Number(to.x*10.8)+' '+Number(to.y*19.2)+'"/>';
        }).join("");
        return '<svg class="adventure-road-layer" viewBox="0 0 1080 1920" preserveAspectRatio="none" aria-hidden="true">'+paths+'</svg>';
    }

    function mapNodeIcon(type,done){
        const paths=done?'<path d="m5 12 5 5L20 6"/>':
            type==='boss'?'<path d="m5 3 3 5-2 3 2 7 4 3 4-3 2-7-2-3 3-5-1 9-6 5-6-5Z"/><path d="m8 11 2 2m6-2-2 2m-4 4h4"/>':
            type==='rest'?'<path d="M13 3c2 5-1 5 2 8 2-2 2-3 2-4 6 8 1 13-5 13S3 14 7 9c0 4 3 4 3 1 0-3 3-4 3-7Z"/><path d="m4 21 16-2M4 19l16 2"/>':
            type==='chest'?'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 12h18M7 7V4h10v3M10 11v5h4v-5"/>':
            type==='event'||type==='objective'?'<path d="M8 8a4 4 0 1 1 6 3c-2 1-2 2-2 4m0 3v1"/>':
            '<path d="m4 3 13 12-2 2L3 4Zm16 0L7 15l2 2L21 4ZM13 16l5 5m-2-2 4-4M11 16l-5 5m2-2-4-4"/>';
        return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
    }

    function mapNodeButton(node,status,major,selected){
        if(status==="hidden"){return "";}
        const style='style="--node-x:'+Number(node.x||50)+'%;--node-y:'+Number(node.y||50)+'%;"';
        const locked=status==="locked"||status==="planned";
        const done=status==="completed"||status==="branch-selected";
        const classes='adventure-node '+nodeTypeClass(node.type)+' status-'+esc(status)+(selected?' is-selected':'');
        if(!major){return '<span class="adventure-route-pip status-'+esc(status)+'" '+style+' aria-hidden="true"></span>';}
        return '<button type="button" data-node-id="'+attr(node.id)+'" class="'+classes+'" '+style+
            (locked?' disabled':' onclick="FourSymbolsAdventure.openNode(\''+attr(node.id)+'\')"')+
            ' aria-label="第'+attr(node.stage)+'關 '+attr(node.title)+'，'+attr(statusLabel(status))+'">'+
            '<span class="adventure-node-icon" aria-hidden="true">'+mapNodeIcon(node.type,done)+'</span>'+
            (selected?'<span class="adventure-current-position" aria-hidden="true"></span>':'')+
            '<span class="adventure-node-copy"><strong>'+esc(node.stage+'. '+node.title)+'</strong></span></button>';
    }

    function mapRewardPreview(node){
        const reward=CONTENT().rewards[node.rewardId];
        if(!reward){return '<span class="adventure-reward-note">沿途探索</span>';}
        const entries=[];
        const coin='<i class="adventure-reward-coin" aria-hidden="true">◆</i>';
        if(reward.gold){entries.push('<span title="金幣 '+reward.gold+'">'+coin+'<b>'+reward.gold+'</b></span>');}
        if(reward.sharedExp){entries.push('<span title="共用經驗 '+reward.sharedExp+'"><i class="adventure-reward-exp" aria-hidden="true">EXP</i><b>'+reward.sharedExp+'</b></span>');}
        if(reward.starterEquipmentFunding){entries.push('<span title="護具購置金">'+coin+'<b>置裝</b></span>');}
        for(const potion of reward.potions||[]){
            const definition=typeof potionDefinitions!=="undefined"?potionDefinitions.find(p=>p.id===potion.id):null;
            entries.push('<span title="'+attr((definition?.name||potion.id)+' ×'+potion.count)+'">'+(definition?.icon||'藥')+'<b>×'+potion.count+'</b></span>');
        }
        if(reward.materials?.length){entries.push('<span title="素材">礦<b>×'+reward.materials.reduce((n,p)=>n+p.count,0)+'</b></span>');}
        return entries.join('');
    }

    function nodeDetailSheet(view){
        const node=view.chapter.nodes.find(entry=>entry.id===view.selectedNodeId)||view.chapter.nodes.find(entry=>entry.id===view.state.currentNodeId);
        if(!node){return "";}
        const status=API().getNodeStatus(node.id),disabled=status==='locked'||status==='planned';
        const labels={battle:'普通戰鬥',event:'江湖事件',chest:'旅途寶箱',rest:'休息驛站',elite:'精英戰',boss:'章節頭目',branch:'路線選擇',objective:'江湖委託',finish:'章節終點'};
        const action=status==='reward-unclaimed'?'領獎':view.state.completedNodes[node.id]?'重訪':'進入';
        const options=view.chapter.nodes.map(n=>{const st=API().getNodeStatus(n.id);return '<button type="button" data-stage-id="'+attr(n.id)+'"'+(['locked','planned'].includes(st)?' disabled':' onclick="FourSymbolsAdventure.openNode(\''+attr(n.id)+'\')"')+' aria-label="'+attr('第'+n.stage+'關 '+n.title+'，'+statusLabel(st))+'">'+esc(n.stage+'. '+n.title)+'</button>';}).join('');

        const required=window.FourSymbolsHeroAcquisition?.getRequiredStoryNode?.();
        const replay=required&&view.state.completedNodes[required]?'<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.startStory(\''+attr(required)+'\')">補看故事紀錄</button>':'';
        const scene=CONTENT().storyPresentation.scenes[node.scene]||CONTENT().storyPresentation.scenes.road;
        const reward=CONTENT().rewards[node.rewardId];
        const rewardLabel=reward?(view.state.rewardClaims[node.id]==='claimed'?'首次獎勵 · 已領取':'首次獎勵'):'';
        return '<aside class="adventure-node-sheet is-'+esc(status)+'" aria-live="polite">'+
            '<img class="adventure-sheet-preview" src="'+attr(scene)+'" alt="'+attr(node.title)+'場景">'+
            '<div class="adventure-sheet-content"><div class="adventure-sheet-title"><span class="adventure-sheet-icon" aria-hidden="true">'+mapNodeIcon(node.type,false)+'</span><h2>'+esc(node.title)+'</h2><small>'+esc(labels[node.type]||'章節節點')+'</small></div>'+
            '<p>'+esc(node.detail||node.subtitle||'沿山路前行，探訪江湖。')+'</p>'+
            '<div class="adventure-sheet-actions"><div class="adventure-reward-block">'+(rewardLabel?'<span class="adventure-reward-caption">'+esc(rewardLabel)+'</span>':'')+'<div class="adventure-reward-preview" aria-label="關卡獎勵">'+mapRewardPreview(node)+'</div></div><details class="adventure-stage-picker" id="adventureStagePicker"><summary aria-label="選擇已解鎖關卡">關卡一覽 ▴</summary><div class="adventure-stage-list" data-scroll-owner="y">'+replay+options+'</div></details>'+
            '<button type="button" class="adventure-button primary" aria-label="'+attr(action+'第 '+node.stage+' 關 · '+node.title)+'" '+(disabled?'disabled':'onclick="FourSymbolsAdventure.activateSelectedNode()"')+'>'+action+' <span aria-hidden="true">›</span></button></div></div></aside>';
    }

    function renderMap(view){
        const selected=view.chapter.nodes.find(n=>n.id===view.selectedNodeId)||view.chapter.nodes.find(n=>n.id===view.state.currentNodeId);
        const milestones=[1,3,5,10,12,14,16,18,20];
        const mainNodes=view.chapter.nodes.map(node=>{
            // Reserve the full title width as well as the circular hit target in
            // the original 420px scene; nearby milestones remain route pips.
            const close=selected&&node.id!==selected.id&&Math.abs((node.x-selected.x)*4.2)<140&&Math.abs((node.y-selected.y)*(746.6666667/100))<58;
            const major=node.id===selected?.id||(milestones.includes(node.stage)&&!close);
            return mapNodeButton(node,API().getNodeStatus(node.id),major,node.id===selected?.id);
        }).join('');
        const legacy=(CONTENT().legacyNodes||[]).filter(n=>view.state.rewardClaims[n.id]==='ready').map(n=>'<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.openLegacyReward(\''+attr(n.id)+'\')">舊旅程待領 · '+esc(n.title)+'</button>').join('');
        return '<section class="adventure-map-screen"><div class="adventure-map-canvas" role="region" aria-label="第一章二十關路線">'+mapRoadSvg(view)+mainNodes+'</div>'+nodeDetailSheet(view)+(legacy?'<div class="adventure-legacy-rewards">'+legacy+'</div>':'')+'</section>';
    }

    function panelShell(title,kicker,body,actions,extraClass){
        return '<section class="adventure-panel '+esc(extraClass||'')+'">'+
            '<div class="adventure-panel-scene" aria-hidden="true"></div>'+
            '<div class="adventure-panel-card">'+
                '<div class="adventure-panel-title"><small>'+esc(kicker||"江湖旅程")+'</small><h2>'+esc(title||"出城冒險")+'</h2></div>'+body+
                '<div class="adventure-panel-actions">'+(actions||'')+'</div>'+
            '</div></section>';
    }

    function currentPanelNode(view,type){
        const selected=view.chapter.nodes.find(node=>node.id===view.selectedNodeId&&(!type||node.type===type));
        if(selected){return selected;}
        if(ui.lastFocusNodeId){
            const focused=view.chapter.nodes.find(node=>node.id===ui.lastFocusNodeId&&(!type||node.type===type));
            if(focused){ return focused; }
        }
        const current=view.chapter.nodes.find(node=>node.id===view.state.currentNodeId&&(!type||node.type===type));
        if(current){ return current; }
        return view.chapter.nodes.find(node=>!type||node.type===type)||null;
    }

    function renderEvent(view,completedView){
        const node=currentPanelNode(view,"event")||view.chapter.nodes.find(n=>n.eventId&&CONTENT().events[n.eventId]&&!view.state.completedNodes[n.id]);
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const event=CONTENT().events[node.eventId];
        const paragraphs=(event.paragraphs||[]).slice(0,3).map(text=>'<p>'+esc(text)+'</p>').join("");
        const portrait='<div class="adventure-event-portrait portrait-'+esc(event.portrait||"traveler")+'" aria-hidden="true"><span>'+esc((event.portrait||"旅").slice(0,1))+'</span></div>';
        let choices="";
        if(!completedView&&!view.state.completedNodes[node.id]){
            choices=(event.choices||[]).slice(0,2).map(choice=>
                '<button type="button" class="adventure-choice" onclick="FourSymbolsAdventure.resolveEvent(\''+attr(node.id)+'\',\''+attr(choice.id)+'\')">'+esc(choice.label)+'</button>'
            ).join("");
        }else{
            choices='<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">返回章節地圖</button>';
        }
        const body='<div class="adventure-event-layout">'+portrait+'<div class="adventure-dialogue"><b>'+esc(event.speaker||"旅人")+'</b>'+paragraphs+'</div></div>';
        return panelShell(event.title,"江湖事件",body,choices,"event-panel scene-"+esc(event.background||"road"));
    }

    function renderStory(view){
        const cursor=view.dialogue,node=view.chapter.nodes.find(n=>n.id===cursor?.nodeId);
        if(!node){return renderMap(view);}
        const lines=cursor.phase==="ending"?view.chapter.ending:cursor.phase==="guidance"?node.guidance:node.dialogue;
        const line=lines?.[cursor.lineIndex];if(!line){return renderMap(view);}
        const presentation=CONTENT().storyPresentation;
        const playerActive=line.speaker==="player";
        let portrait="",name="少俠";
        try{if(typeof player!=="undefined"){portrait=getCharacterBattleArtworkPath(player);name=player.id||name;}}catch(_){}
        const portraitKey=presentation.npcs[line.npcAssetId||node.npc];
        const npc=window.v154ResolveMonsterPortraitRecord?.({portraitKey})?.path||"";
        if(!npc&&ui.storyPortraitAttempted!==portraitKey){
            ui.storyPortraitAttempted=portraitKey;ui.storyPortraitPending=true;
            Promise.resolve(window.v154RequestMonsterPortraitRegistry?.()).then(()=>{
                ui.storyPortraitPending=false;
                if(runtimeView()?.panel==='story'){render();}
            }).catch(()=>{ui.storyPortraitPending=false;if(runtimeView()?.panel==='story'){render();}});
        }
        return '<section class="adventure-story scene-'+attr(node.scene)+'" aria-label="'+attr(node.title)+'">'+
            '<img class="adventure-story-background" src="'+attr(presentation.scenes[node.scene])+'" alt="">'+
            '<div class="adventure-story-shade" aria-hidden="true"></div>'+
            '<span class="adventure-story-chapter">第一章 · 山關初行</span>'+
            '<div class="adventure-story-cast">'+
            '<img class="adventure-story-player '+(playerActive?'is-speaking':'')+'" src="'+attr(portrait)+'" alt="'+attr(name)+'">'+
            (npc?'<img class="adventure-story-npc '+(!playerActive?'is-speaking':'')+'" src="'+attr(npc)+'" alt="'+attr(playerActive?'同行之人':line.name)+'">':'')+
            '</div><div class="adventure-story-dialogue" aria-live="polite">'+
            '<span class="adventure-story-speaker">'+esc(playerActive?name:line.name)+'</span>'+
            '<p>'+esc(line.text)+'</p>'+(!npc?'<small role="status">'+(ui.storyPortraitPending?'人物載入中…':'人物載入未完成，請重試。')+'</small>':'')+
            (!npc&&!ui.storyPortraitPending?'<button type="button" data-story-portrait-retry class="adventure-button primary" onclick="FourSymbolsAdventureUI.retryStoryPortrait()">重新載入人物</button>':'')+
            '<button type="button" class="adventure-button primary" '+(!npc?'disabled ':'')+'onclick="FourSymbolsAdventure.advanceDialogue()">'+
            (cursor.lineIndex<lines.length-1?'下一句':cursor.phase==="ending"?'第一章完成':'繼續')+'　›</button></div></section>';
    }
    function renderTutorial(view){
        const action=view.tutorial?.requiredAction||"skill";
        const copy={skill:['招式與成長','先在技能頁學習並裝上本門技能，再回來挑戰同一名惡徒。'],
            equipment:view.state.grantedEquipmentUid?['穿上護具','護具已備好，接著從背包穿上，再回來挑戰寨外守衛。']:['購買護具','先到主城商店購買護具，再從背包穿上，回來挑戰寨外守衛。'],
            recovery:['上路前的準備','紅色是 HP，藍色是 SP。接著會帶你從背包選擇補品並使用，實際恢復後再出發。']}[action];
        const owner=typeof player!=="undefined"?player:null;
        const resources=owner?'<p class="adventure-preparation-resources">HP '+esc(Math.floor(owner.hp))+'　SP '+esc(Math.floor(owner.sp))+'</p>':'';
        const actions='<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.openTutorialSystem()">'+(action==="skill"?'前往技能頁':action==="equipment"&&!view.state.grantedEquipmentUid?'前往商店':'前往背包')+'</button>'+
            (action==="equipment"&&view.state.rewardClaims.c1_03==="ready"?'<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.claimNodeReward(\'c1_03\')">領取置裝費</button>':'')+
            (action==="recovery"&&view.state.rewardClaims.c1_05==="ready"?'<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.claimNodeReward(\'c1_05\')">領取旅途補給</button>':'')+
            '<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.continueTutorial()">'+(view.tutorialProgress?.recoveryNeedsPractice?'進戰實作補品':action==="recovery"?'準備好，繼續上路':'返回原關重試')+'</button>';
        return panelShell(copy[0],"初入江湖",'<p class="adventure-lead">'+copy[1]+'</p>'+resources,actions,"tutorial-panel");
    }
    function syncTutorialReturn(page){
        const host=document.getElementById("game-ui");if(!host){return;}
        let button=document.getElementById("adventureTutorialReturn");
        if(!["inventory","skill","status","shop"].includes(page)){
            if(button){button.hidden=true;}
            return;
        }
        const state=runtimeView()?.tutorial;
        if(!button&&!(state?.active&&state.requiredAction)){return;}
        if(!button){button=document.createElement("button");button.id="adventureTutorialReturn";button.type="button";button.className="adventure-tutorial-return";button.textContent="準備完成 · 返回故事";button.onclick=()=>API()?.returnFromTutorial();host.appendChild(button);}
        button.hidden=!(state?.active&&state.requiredAction&&["inventory","skill","status","shop"].includes(page));
        if(!button.hidden){
            const destination=page==="inventory"?document.querySelector("#inventoryPage .inventory-classic-shell"):
                document.querySelector("#homeFeatureModal.show .home-feature-modal-box");
            if(destination){destination.appendChild(button);}
            else{button.hidden=true;}
        }
    }

    // One presentation of the existing onboarding state. This never clicks,
    // learns, equips, consumes, or completes an action on the player's behalf.
    const guide={target:null,overlay:null,release:null,battle:null,frame:0};
    function visibleGuideTarget(selector){
        return Array.from(document.querySelectorAll(selector)).find(el=>{
            const rect=el.getBoundingClientRect();
            return rect.width>0&&rect.height>0&&!el.disabled&&getComputedStyle(el).visibility!=="hidden";
        })||null;
    }
    function guideStep(view){
        if(!view?.tutorial?.active){return null;}
        // Account/startup owners must finish before game input can be guided.
        if(visibleGuideTarget('#firebaseAuthOverlay,#startupLoader,#homeFeatureModal.release-update-forced.show')){return null;}
        const step=(selector,text)=>({target:visibleGuideTarget(selector),text});
        const inventoryStep=(identity,selector,text)=>{
            const location=window.v141LocateInventoryItem?.(identity);
            return location?.direction?step('#v141InventoryPager button[onclick="v141ChangeInventoryPage('+location.direction+')"]','先翻到補品或護具所在的那一頁。'):step(selector,text);
        };
        const dialog=visibleGuideTarget('.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button');
        if(dialog){return {target:dialog,text:"讀完提示後，點這裡繼續。"};}
        const o=view.tutorial,p=view.tutorialProgress||{};
        if(o.requiredAction==="equipment"&&visibleGuideTarget('#homeFeatureModal.show')){
            if(!view.state.grantedEquipmentUid&&!visibleGuideTarget('#homeFeatureModal.show .v17345-equipment-shop')){
                return step("#homeFeatureModal [onclick=\"v169SwitchShopPage('equipment')\"]",'先點「裝備」分類，找到護具。');
            }
            return view.state.grantedEquipmentUid?step('#homeFeatureModal [onclick="closeHomeFeature()"]','護具已買好，先關閉商店，再到背包穿戴。'):
                step('#chapter1TutorialArmorBuy','點「購買護具」，支付金幣取得這件護具。');
        }
        const battle=typeof battleActive!=="undefined"&&battleActive;
        if(battle){
            const declaring=typeof battlePhase!=="undefined"&&battlePhase==="declare";
            if(declaring&&typeof pendingAction!=="undefined"&&pendingAction){
                if(pendingAction==='__v143PotionTarget'){
                    return Object.assign(step('#battlePlayerRow .ally-targetable','點擊我方角色，確認使用補品。'),{battle:true});
                }
                return Object.assign(step('#battleMonsterArea [id^="battleMonster"]','點擊敵人，確認這次出招。'),{battle:true});
            }
            if(!declaring||(typeof actionReady!=="undefined"&&actionReady)){return {target:null,text:"出招中，看看這一回合的結果。",battle:true,waiting:true};}
            const node=view.chapter.nodes.find(n=>n.id===o.battleNodeId);
            if(node?.stage===5&&!p.recoveryReady){
                const hp=typeof player!=="undefined"?Number(player.hp):0,sp=typeof player!=="undefined"?Number(player.sp):0;
                const id=hp<Number(p.resources?.maxHP)&&potionCount('hpPotion10')>0?'hpPotion10':sp<Number(p.resources?.maxSP)&&potionCount('spPotion10')>0?'spPotion10':null;
                if(id){
                    const potion=visibleGuideTarget('#battlePotionList button[onclick*="'+id+'"]');
                    return {target:potion||visibleGuideTarget('#mainBattleMenu button[onclick*="openItemMenu"]'),text:potion?'點補品，實際恢復剛消耗的資源。':'資源已消耗，點「背包」練習使用補品。',battle:true};
                }
            }
            if(node?.stage>=2&&p.skillReady&&!p.skillUsed){
                const skill=visibleGuideTarget('#skillQuickBar.show .skill-quick-button[data-skill-id]:not(:disabled)');
                return {target:skill||visibleGuideTarget('#mainBattleMenu button[onclick*="toggleSkillQuickBar"]'),text:skill?"點亮起的技能，準備施放。":"點技能，看看剛學會的招式。",battle:true};
            }
            return Object.assign(step('#mainBattleMenu button[onclick*="normal"]','先點「普通攻擊」。'),{battle:true});
        }
        if(visibleGuideTarget('#adventurePage.active[data-panel="story"]')){
            return Object.assign(step('#adventurePage [data-story-portrait-retry],#adventurePage [onclick*="advanceDialogue"]','讀完這句，點這裡繼續故事。'),{reading:true});
        }
        if(visibleGuideTarget('#itemModal.show')){
            if(o.requiredAction==="equipment"){
                return step('#itemEquipButton','點「穿戴」，把護具裝到角色身上。');
            }
            return step('#v17342InventoryPotionUse','點「使用」，恢復角色資源。');
        }
        if(visibleGuideTarget('#skillPage.active')){
            if(p.skillReady){return step('#adventureTutorialReturn','技能已裝好，返回故事再挑戰。');}
            const learned=Object.keys(p.loadout?.skillLevels||{}).find(id=>p.loadout.skillLevels[id]>0&&visibleGuideTarget('.skill-row[data-skill-id="'+CSS.escape(id)+'"] [data-skill-action="equip"]'));
            if(learned){return step('.skill-row[data-skill-id="'+CSS.escape(learned)+'"] [data-skill-action="equip"]','點「裝備」，把招式放進戰鬥技能欄。');}
            return step('#skillPage .skill-row [data-skill-action="growth"]:not(:disabled)','點「學習」，學會第一個招式。');
        }
        if(visibleGuideTarget('#inventoryPage.active')){
            if(o.requiredAction==="equipment"?p.equipmentReady:p.recoveryReady){
                return step('#adventureTutorialReturn','操作完成，點這裡返回故事。');
            }
            const filter=o.requiredAction==="equipment"?"equipment":"item";
            const tab=visibleGuideTarget('#inventoryCategoryTabs [data-filter="'+filter+'"]');
            if(tab?.getAttribute('aria-selected')!=="true"){return {target:tab,text:o.requiredAction==="equipment"?"先點「裝備」分類。":"先點「物品」分類，找到補品。"};}
            if(o.requiredAction==="equipment"){
                return inventoryStep({uid:view.state.grantedEquipmentUid},'#inventoryGrid [data-item-uid="'+CSS.escape(view.state.grantedEquipmentUid||'missing')+'"]','點擊剛取得的護具，查看詳情。');
            }
            const hp=typeof player!=="undefined"?Number(player.hp):0,sp=typeof player!=="undefined"?Number(player.sp):0;
            const id=hp<Number(p.resources?.maxHP)&&potionCount('hpPotion10')>0?"hpPotion10":sp<Number(p.resources?.maxSP)&&potionCount('spPotion10')>0?"spPotion10":"missing";
            return inventoryStep({id},'#inventoryGrid [data-item-id="'+id+'"]',id==="hpPotion10"?"點回春散，準備恢復 HP。":"點凝氣散，準備恢復 SP。");
        }
        if(o.requiredAction==="equipment"&&view.state.grantedEquipmentUid&&visibleGuideTarget('#homePage.active')){
            return step('#inventoryNav','點「背包」，找到剛買的護具。');
        }
        if(view.panel==="tutorial"){
            if(o.requiredAction==="recovery"&&view.state.rewardClaims.c1_05==="ready"){
                return step('#adventurePage [onclick*="claimNodeReward"]','先領取旅人準備的補品，再練習使用。');
            }
            if(o.requiredAction==="equipment"&&view.state.rewardClaims.c1_03==="ready"){
                return step('#adventurePage [onclick*="claimNodeReward"]','先領取旅人提供的置裝費。');
            }
            const ready=o.requiredAction==="skill"?p.skillReady:o.requiredAction==="equipment"?p.equipmentReady:p.recoveryReady;
            if(o.requiredAction==="recovery"&&p.recoveryNeedsPractice){return step('#adventurePage [onclick*="continueTutorial"]','目前 HP／SP 都是滿的，先進戰練習，再實際用補品恢復。');}
            return ready?step('#adventurePage [onclick*="continueTutorial"]',o.requiredAction==='recovery'?'準備完成，出發救援旅人。':'準備完成，現在回到原關挑戰。'):
                step('#adventurePage [onclick*="openTutorialSystem"]',o.requiredAction==="skill"?"先前往技能頁，學會並裝上招式。":o.requiredAction==="equipment"&&!view.state.grantedEquipmentUid?"前往主城商店，練習購買護具。":"打開背包，跟著亮框操作。");
        }
        return step('#adventurePage .adventure-button.primary',view.panel==="node-reward"?"點這裡領取獎勵，再前往下一關。":"點這裡前往目前關卡。");
    }
    function clearGuide(){
        guide.target=null;
        if(guide.overlay){guide.overlay.hidden=true;}
        if(guide.release){guide.release();guide.release=null;}
        guide.battle=null;
    }
    function syncGuide(){
        const view=runtimeView(),step=guideStep(view);
        if(!step){clearGuide();return;}
        const host=document.getElementById('game-ui');if(!host){return;}
        if(!guide.overlay){
            const overlay=document.createElement('div');overlay.id='adventureInputGuide';
            overlay.innerHTML='<div class="adventure-guide-shade top"></div><div class="adventure-guide-shade left"></div><div class="adventure-guide-shade right"></div><div class="adventure-guide-shade bottom"></div><div class="adventure-guide-ring"></div><p class="adventure-guide-copy" role="status" aria-live="polite"></p><div class="adventure-guide-recovery" hidden><p>目前操作尚未就緒，請重試引導。</p><button type="button">重試目前引導</button></div>';
            overlay.querySelector('.adventure-guide-recovery button').onclick=()=>{
                if(typeof battleActive!=="undefined"&&battleActive){window.location.reload();}
                else if(runtimeView()?.tutorial?.requiredAction){API()?.returnFromTutorial();}
                else{API()?.open({story:true});}
            };
            host.appendChild(overlay);guide.overlay=overlay;
        }
        guide.overlay.hidden=false;
        guide.overlay.classList.toggle('is-reading',!!step.reading);
        const target=step.target;
        const recovery=guide.overlay.querySelector('.adventure-guide-recovery');
        recovery.hidden=!!target||!!step.waiting||(!!step.reading&&!!ui.storyPortraitPending);
        if(target&&target!==guide.target){target.scrollIntoView({block:'nearest',inline:'nearest'});}
        guide.target=target;
        const inBattle=step.battle&&typeof battleActive!=="undefined"&&battleActive;
        if(inBattle&&!guide.release){guide.release=window.FourSymbolsBattleFlow?.acquireInputGuideHold('adventure');}
        if(!inBattle&&guide.release){guide.release();guide.release=null;}
        const base=host.getBoundingClientRect(),scale=base.width/host.clientWidth;
        const rect=target?.getBoundingClientRect();
        const width=host.clientWidth,height=host.clientHeight;
        const x=rect?Math.max(0,(rect.left-base.left)/scale-5):0;
        const y=rect?Math.max(0,(rect.top-base.top)/scale-5):0;
        const right=rect?Math.min(width,(rect.right-base.left)/scale+5):0;
        const bottom=rect?Math.min(height,(rect.bottom-base.top)/scale+5):0;
        const boxes={top:[0,0,width,y],left:[0,y,x,bottom-y],right:[right,y,width-right,bottom-y],bottom:[0,bottom,width,height-bottom]};
        for(const [name,b] of Object.entries(boxes)){guide.overlay.querySelector('.'+name).style.cssText='left:'+b[0]+'px;top:'+b[1]+'px;width:'+b[2]+'px;height:'+b[3]+'px';}
        const ring=guide.overlay.querySelector('.adventure-guide-ring');
        ring.hidden=!target;ring.style.cssText='left:'+x+'px;top:'+y+'px;width:'+(right-x)+'px;height:'+(bottom-y)+'px';
        const copy=guide.overlay.querySelector('.adventure-guide-copy');
        copy.hidden=!recovery.hidden;
        if(copy.textContent!==step.text){copy.textContent=step.text;}
        const sheet=visibleGuideTarget('#adventurePage.active[data-panel="map"] .adventure-node-sheet');
        const sheetTop=sheet?(sheet.getBoundingClientRect().top-base.top)/scale:null;
        const copyHeight=copy.offsetHeight||180;
        copy.style.top=(sheetTop!==null?Math.max(25,sheetTop-copyHeight-28):y>height*.52?Math.max(25,y-copyHeight-28):Math.min(height-copyHeight-28,bottom+28))+'px';
    }
    function installGuide(){
        const block=event=>{
            if(!runtimeView()?.tutorial?.active){return;}
            const step=guideStep(runtimeView()),target=step?.target;
            if(!step){return;}
            const recovery=guide.overlay?.querySelector('.adventure-guide-recovery');
            if(recovery&&!recovery.hidden&&recovery.querySelector('button')?.contains(event.target)){return;}
            if(target&&(target===event.target||target.contains(event.target))){return;}
            if(event.type==='keydown'&&(event.ctrlKey||event.metaKey||event.key==='F5')){return;}
            event.preventDefault();event.stopImmediatePropagation();
        };
        ['pointerdown','click','keydown'].forEach(type=>document.addEventListener(type,block,true));
        window.addEventListener('pagehide',clearGuide);
        let last=0;
        const frame=time=>{if(!last||time-last>=100){syncGuide();last=time;}guide.frame=requestAnimationFrame(frame);};
        guide.frame=requestAnimationFrame(frame);
    }
    if(typeof requestAnimationFrame==='function'){installGuide();}

    function renderEventResult(view){
        const result=view.state.lastEventResult||{};
        const parts=[];
        if(result.text){ parts.push('<p>'+esc(result.text)+'</p>'); }
        if(result.rewardSummary&&result.rewardSummary.length){ parts.push('<div class="adventure-result-box"><b>獲得</b><span>'+result.rewardSummary.map(esc).join(" · ")+'</span></div>'); }
        if(result.buff){ parts.push('<div class="adventure-result-box buff"><b>下一場戰鬥</b><span>'+esc(result.buff.label||"效果已準備")+'</span></div>'); }
        return panelShell("事件結果","旅途中",parts.join("")||'<p>事件已結束。</p>',
            '<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.setPanel(\'map\')">繼續上路</button>',"result-panel");
    }

    function renderBranch(view){
        const node=currentPanelNode(view,"branch");
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const selected=view.state.branchSelections[node.branchId];
        const cards=(node.branches||[]).map(choice=>{
            const isSelected=selected===choice.id;
            const locked=selected&&!view.state.chapterCompleted&&!isSelected;
            return '<button type="button" class="adventure-route-choice '+(isSelected?'selected ':'')+(locked?'locked':'')+'" '+
                (locked?'disabled':'onclick="FourSymbolsAdventure.selectBranch(\''+attr(node.id)+'\',\''+attr(choice.id)+'\')"')+'>'+
                '<span class="adventure-route-risk">'+esc(choice.risk)+'</span><strong>'+esc(choice.title)+'</strong><p>'+esc(choice.description)+'</p>'+
                (isSelected?'<small>首次已選</small>':locked?'<small>章節通關後可回溯</small>':'<small>選擇此路線</small>')+'</button>';
        }).join("");
        const actions='<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">先看看地圖</button>';
        return panelShell("山路分岔","路線選擇",'<p class="adventure-lead">兩條路最後都會回到主線。首次推進選定後不能立刻回頭；章節通關後可直接回溯另一條。</p><div class="adventure-route-grid">'+cards+'</div>',actions,"branch-panel");
    }

    function progressDots(current,target){
        let html="";
        const safeTarget=Math.max(1,Math.min(10,Number(target)||1));
        for(let i=0;i<safeTarget;i++){ html+='<i class="'+(i<current?'filled':'')+'"></i>'; }
        return '<span class="adventure-progress-dots" aria-hidden="true">'+html+'</span>';
    }

    function renderObjective(view){
        const node=currentPanelNode(view,"objective")||view.chapter.nodes.find(n=>n.type==="objective")||(CONTENT().legacyNodes||[]).find(n=>n.id===view.objective?.sourceNodeId);
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const objective=view.state.objective;
        if(!objective){
            return panelShell(node.title,"野怪區委託",'<p>正在從你目前已開放的野怪區建立安全目標。</p>',
                '<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.ensureObjective(\''+attr(node.id)+'\')">建立委託</button><button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">返回地圖</button>',"objective-panel");
        }
        const ready=objective.ready===true;
        const turned=objective.turnedIn===true;
        const rewardReady=view.state.rewardClaims[node.id]==="ready";
        const body='<div class="adventure-objective-paper">'+
            '<span class="adventure-objective-zone">已開放區域 · '+esc(objective.zoneLabel||objective.zoneKey)+'</span>'+
            '<h3>'+esc(objective.itemLabel)+'</h3><p>擊敗 <b>'+esc(objective.monsterName)+'</b> 時有 40% 基礎機率取得；連續 3 隻未掉，第 4 隻必掉。</p>'+
            progressDots(objective.current,objective.target)+'<strong class="adventure-objective-count">'+esc(objective.current)+' / '+esc(objective.target)+(ready?' ✓':'')+'</strong>'+
            '<small>任務物品只記錄委託進度，不佔一般背包。</small></div>';
        let actions="";
        if(!turned&&ready){
            actions='<button type="button" class="adventure-button primary attention" onclick="FourSymbolsAdventure.turnInObjective(\''+attr(node.id)+'\')">交付委託</button>';
        }else if(!turned){
            actions='<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.goToPatrol()">前往野怪區</button>';
        }else if(rewardReady){
            actions='<button type="button" class="adventure-button primary attention" onclick="FourSymbolsAdventure.claimNodeReward(\''+attr(node.id)+'\')">領取委託首通獎勵</button>';
        }
        actions+='<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">返回地圖</button>';
        return panelShell(node.title,"野怪區委託",body,actions,"objective-panel");
    }

    function renderRest(view){
        const node=currentPanelNode(view,"rest")||view.chapter.nodes.find(n=>n.type==="rest");
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const done=!!view.state.completedNodes[node.id];
        const body='<div class="adventure-rest-fire" aria-hidden="true"><i></i></div><p class="adventure-lead">全隊存活角色恢復最大 HP 的 30% 與最大 SP 的 30%。本節點只可使用一次，不會復活倒下角色。</p>';
        const actions=(done?'<span class="adventure-used-mark">此驛站已休息過</span>':'<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.restAtNode(\''+attr(node.id)+'\')">休息</button>')+
            '<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">返回地圖</button>';
        return panelShell(node.title,"休息節點",body,actions,"rest-panel");
    }

    function renderChest(view){
        const node=currentPanelNode(view,"chest")||view.chapter.nodes.find(n=>n.type==="chest");
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const done=!!view.state.completedNodes[node.id];
        const ready=view.state.rewardClaims[node.id]==="ready";
        const body='<div class="adventure-chest-art" aria-hidden="true"><span>寶</span></div><p class="adventure-lead">旅途中的一次性寶箱。內容不會提前顯示，領取後不會再次刷新。</p>';
        let actions="";
        if(!done){ actions='<button type="button" class="adventure-button primary" onclick="FourSymbolsAdventure.openChest(\''+attr(node.id)+'\')">開啟寶箱</button>'; }
        else if(ready){ actions='<button type="button" class="adventure-button primary attention" onclick="FourSymbolsAdventure.claimNodeReward(\''+attr(node.id)+'\')">領取寶箱</button>'; }
        else{ actions='<span class="adventure-used-mark">寶箱已領取</span>'; }
        actions+='<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">返回地圖</button>';
        return panelShell(node.title,"旅途寶箱",body,actions,"chest-panel");
    }

    function renderNodeReward(view){
        const all=[...view.chapter.nodes,...(CONTENT().legacyNodes||[])];
        const node=all.find(n=>view.state.rewardClaims[n.id]==="ready"&&n.id===view.selectedNodeId)||all.find(n=>view.state.rewardClaims[n.id]==="ready");
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const typeLabel=node.type==="boss"?"Boss 首通獎勵":node.type==="elite"?"精英首通獎勵":"節點首通獎勵";
        const actions='<button type="button" class="adventure-button primary attention" onclick="FourSymbolsAdventure.claimNodeReward(\''+attr(node.id)+'\')">領取首通獎勵</button>'+
            '<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">稍後領取</button>';
        return panelShell(node.title,typeLabel,'<div class="adventure-reward-seal">賞</div><p class="adventure-lead">首通獎勵只能領一次；之後可以重新挑戰，但不會重複取得主線首通獎勵。</p>',actions,"reward-panel");
    }

    function renderChapterComplete(view){
        const claimed=view.state.chapterRewardClaimed;
        const heroStatus=window.FourSymbolsHeroAcquisition?.getStatus?.();
        const heroOwned=!!window.FourSymbolsHeroAcquisition?.getEntitlement?.("divineDogHongbao");
        const heroNote=heroOwned?"神犬紅包已永久取得，可到休息 → 英雄安排出戰。":
            heroStatus?.busy?"神犬紅包取得紀錄同步中。":
            heroStatus?.error||"神犬紅包需完成線上章節資格確認；舊本機通關紀錄不會自動補發。";
        const body='<div class="adventure-chapter-seal">章</div><h3>'+esc(view.chapter.title)+' · 完成</h3>'+
            '<p>黑松寨撤去了路障，山關重新通行。第一章的二十段旅程已告一段落。</p>'+
            '<div class="adventure-result-box"><b>山關初行</b><span>可回看沿途故事，首通獎勵不會重複發放。</span></div>'+
            '<p>'+esc(heroNote)+'</p><button type="button" class="adventure-button secondary" onclick="FourSymbolsHeroAcquisition.refresh()">同步英雄取得紀錄</button>';
        const actions=(claimed?'<span class="adventure-used-mark">章節獎勵已領取</span>':'<button type="button" class="adventure-button primary attention" onclick="FourSymbolsAdventure.claimChapterReward()">領取章節獎勵</button>')+
            '<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">回到地圖探索</button>';
        return panelShell("章節完成","旅程告一段落",body,actions,"chapter-complete-panel");
    }

    function renderMerchant(view){
        if(!view.merchantVisible){ return renderMap(view); }
        const purchases=view.state.merchant&&view.state.merchant.purchases||{};
        const items=API().merchantStock().map(item=>{
            const bought=!!purchases[item.id],owned=potionCount(item.id);
            return '<article class="adventure-merchant-item tier-'+esc(item.tierKey||"white")+(item.rare?' rare':'')+'">'+
                '<div class="adventure-merchant-icon" aria-hidden="true">'+(item.rare?'丹':'藥')+'</div>'+
                '<div class="adventure-merchant-copy"><small>'+esc(item.tierKey==="orange"?"橙階珍稀":"旅途補給")+'</small><strong>'+esc(item.name)+'</strong><span>數量 ×'+esc(item.quantity)+' · 持有 '+esc(owned)+'</span></div>'+
                '<button type="button" '+(bought?'disabled':'onclick="FourSymbolsAdventure.buyMerchantItem(\''+attr(item.id)+'\')"')+'>'+ (bought?'已購買':esc(item.price.toLocaleString("zh-TW"))+" 金")+'</button>'+
            '</article>';
        }).join("");
        const body='<div class="adventure-merchant-hero"><div class="adventure-merchant-portrait" aria-hidden="true"><span>商</span></div><div><b>無名旅商</b><p>路過才會遇見的少量補給。不是最有效率的養成來源，也沒有商人限定核心戰力。</p><strong>持有 '+esc(globalGold().toLocaleString("zh-TW"))+' 金幣</strong></div></div>'+
            '<div class="adventure-merchant-grid">'+items+'</div>';
        return panelShell("神秘商人","燈影下的旅商",body,'<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">離開攤位</button>',"merchant-panel");
    }

    function renderPanel(view){
        switch(view.panel){
            case "story":return renderStory(view);
            case "tutorial":return renderTutorial(view);
            case "event": return renderEvent(view,false);
            case "event-view": return renderEvent(view,true);
            case "event-result": return renderEventResult(view);
            case "branch": return renderBranch(view);
            case "objective": return renderObjective(view);
            case "rest": return renderRest(view);
            case "chest": return renderChest(view);
            case "node-reward": return renderNodeReward(view);
            case "chapter-complete": return renderChapterComplete(view);
            case "merchant": return renderMerchant(view);
            default: return renderMap(view);
        }
    }

    function render(){
        const root=ensureRoot(),view=runtimeView();
        if(!root||!view||!view.chapter||!view.state){ return; }
        root.dataset.panel=view.panel;
        const back=root.querySelector(".adventure-back-button");
        if(back){back.hidden=view.panel==="story"&&!!view.tutorial?.active;}
        const title=root.querySelector("#adventureHeaderTitle"),meta=root.querySelector("#adventureHeaderMeta");
        if(title){ title.textContent="第一章 · "+view.chapter.title; }
        if(meta){ meta.innerHTML='<span>建議 Lv.'+esc(view.chapter.suggestedLevel)+'</span><span>'+view.chapter.nodes.filter(n=>view.state.completedNodes[n.id]).length+' / 20 關</span><progress max="20" value="'+view.chapter.nodes.filter(n=>view.state.completedNodes[n.id]).length+'" aria-label="章節進度"></progress>'; }
        if(ui.body){
            const samePanel=ui.renderedPanel===view.panel;
            const panelScrollTop=ui.body.scrollTop;
            const selected=view.chapter.nodes.find(node=>node.id===view.selectedNodeId)||view.chapter.nodes.find(node=>node.id===view.state.currentNodeId);
            const mapKey=view.visible&&view.panel==='map'?JSON.stringify([view.chapter.id,selected?.id]):null;
            const picker=ui.body.querySelector('#adventureStagePicker');
            const list=picker?.querySelector('.adventure-stage-list');
            // Hero sync may update map actions while the player is browsing.
            // Preserve only this same map selection's native disclosure state.
            const browsing=mapKey&&mapKey===ui.lastMapKey&&picker?{open:picker.open,scrollTop:list?.scrollTop||0}:null;
            ui.body.innerHTML=renderPanel(view);
            ui.body.scrollTop=view.panel==="map"?0:(samePanel?panelScrollTop:0);
            ui.renderedPanel=view.panel;
            ui.lastMapKey=mapKey;
            if(browsing){
                const nextPicker=ui.body.querySelector('#adventureStagePicker');
                if(nextPicker){
                    nextPicker.open=browsing.open;
                    const nextList=nextPicker.querySelector('.adventure-stage-list');
                    if(nextList){nextList.scrollTop=browsing.scrollTop;}
                }
            }
        }
        syncTracker(view);
    }

    function show(options){
        const root=ensureRoot();
        if(!root){ return; }
        const opts=options||{};
        if(opts.focusNodeId){ ui.lastFocusNodeId=opts.focusNodeId; }
        ui.lastMapKey=null;
        showPage("adventure");
        render();

    }
    function hide(){
        const root=ensureRoot();
        if(!root){ return; }
        if(root.classList.contains("active")){ showPage("home"); }
    }

    function ensureTracker(){
        if(ui.tracker&&ui.tracker.isConnected){ return ui.tracker; }
        if(typeof document==="undefined"){ return null; }
        const map=document.getElementById("mapPage");
        if(!map){ return null; }
        let tracker=document.getElementById("adventureObjectiveTracker");
        if(!tracker){
            tracker=document.createElement("aside");
            tracker.id="adventureObjectiveTracker";
            tracker.className="adventure-objective-tracker";
            tracker.hidden=true;
            map.appendChild(tracker);
        }
        ui.tracker=tracker;
        return tracker;
    }

    function syncTracker(viewArg){
        const tracker=ensureTracker();
        const view=viewArg||runtimeView();
        if(!tracker||!view){ return; }
        const objective=view.state&&view.state.objective;
        if(!objective||!objective.active||objective.turnedIn){ tracker.hidden=true;return; }
        const inBattle=typeof battleActive!=="undefined"&&!!battleActive;
        tracker.hidden=false;
        tracker.classList.toggle("is-ready",!!objective.ready);
        tracker.innerHTML='<button type="button" class="adventure-tracker-main" onclick="FourSymbolsAdventure.returnFromPatrol()" '+(inBattle?'aria-disabled="true"':'')+'>'+
            '<small>出城冒險</small><strong>'+esc(objective.itemLabel)+'</strong>'+progressDots(objective.current,objective.target)+
            '<b>'+esc(objective.current)+' / '+esc(objective.target)+(objective.ready?' ✓':'')+'</b>'+
            '<span>'+esc(objective.monsterName)+' · '+esc(objective.zoneLabel||objective.zoneKey)+'</span>'+
            '<em>'+(inBattle?'戰鬥結束後可返回':objective.ready?'返回章節':'返回冒險')+'</em></button>';
    }

    window.FourSymbolsAdventureUI=Object.freeze({show:show,hide:hide,render:render,syncTracker:syncTracker,syncTutorialReturn:syncTutorialReturn,
        retryStoryPortrait:function(){ui.storyPortraitAttempted=null;render();}});

    if(typeof document!=="undefined"){
        const ready=function(){ ensureRoot();ensureTracker();syncTracker(); };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",ready,{once:true}); }
        else{ ready(); }
        document.addEventListener("four-symbols:adventure-state-change",()=>{ render();syncTracker(); });
        document.addEventListener("four-symbols:hero-acquisition-state",()=>{ render(); });
    }
})();
