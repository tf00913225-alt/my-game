
/* bundled source: js/adventure/adventure-ui-v1-20260915.js */
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
                '<button type="button" id="taoxiStoryEntry" class="adventure-button" onclick="openTaoxiExploration(\'adventure\')">探索</button>'+
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
        return panelShell(event.title,"NPC／劇情事件",body,choices,"event-panel scene-"+esc(event.background||"road"));
    }

    function renderStory(view){
        const cursor=view.dialogue,node=view.chapter.nodes.find(n=>n.id===cursor?.nodeId);
        if(!node){return renderMap(view);}
        const lines=cursor.phase==="ending"?view.chapter.ending:cursor.phase==="guidance"?node.guidance:node.dialogue;
        const line=lines?.[cursor.lineIndex];if(!line){return renderMap(view);}
        const presentation=CONTENT().storyPresentation;
        const playerActive=line.speaker==="player";
        let portrait="",name="少俠";
        try{if(typeof player!=="undefined"){portrait=getCharacterArtworkPath(player);name=player.id||name;}}catch(_){}
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
        const state=runtimeView()?.tutorial,modal=document.getElementById('homeFeatureModal');
        const host=['skill','status','expPool'].includes(page)&&modal?.classList.contains('show')?modal:document.getElementById("game-ui");if(!host){return;}
        let button=document.getElementById("adventureTutorialReturn");
        if(!button){button=document.createElement("button");button.id="adventureTutorialReturn";button.type="button";button.className="adventure-tutorial-return";button.textContent="準備完成 · 返回故事";button.onclick=()=>API()?.returnFromTutorial();host.appendChild(button);}
        else if(button.parentElement!==host){host.appendChild(button);}
        button.hidden=!(state?.active&&state.requiredAction&&["inventory","skill","status"].includes(page));
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
    function firstLessonGuide(view){
        const f=view.firstLesson,step=(selector,text)=>({target:visibleGuideTarget(selector),text,battle:f.battleActive});
        if(f.battleActive&&!f.hasCheckpoint){
            return {target:null,text:'正在準備戰鬥，請稍候。',intro:true,battle:true,waiting:true};
        }
        const introductions={
            'attack-intro':'這裡是戰場，先練習普通攻擊。接著要親自選擇敵人，才會出招。',
            'city-intro':'普攻實戰完成了。主城可以整理角色與準備裝備，先從角色入口開始。',
            'character-intro':'角色視窗可以查看能力、分配經驗與管理技能。先認識經驗池分配。',
            'exp-intro':'戰鬥所得會進入共用經驗池。先預覽升級，再親自按「確定」完成。',
            'status-intro':'每升一級可獲得 5 點能力點，分配方式由你決定。這次不用花點，之後記得回來分配。',
            'skill-intro':'這裡可以學習並裝備技能。學會後還要裝上，戰鬥中才能使用。',
            'cast-intro':'已接回剛才同一場戰鬥。這次選擇剛裝好的技能，再點擊敵人施放。'
        };
        if(introductions[f.step]){
            return {target:guide.overlay?.querySelector('.adventure-guide-next')||null,text:introductions[f.step],
                intro:true,battle:f.battleActive,waiting:f.step==='attack-intro'&&!f.hasCheckpoint};
        }
        if(f.step==='finish-battle'){return null;}
        if(f.step==='city'){return step('#homePage.active [onclick="openHomeFeature(\'character\')"]','點「角色」，從平常的入口開啟角色視窗。');}
        if(f.step==='exp-tab'){return step('#characterTabBtnExpPool','點「經驗池分配」。');}
        if(f.step==='upgrade'){
            const confirm=visibleGuideTarget('#expDistributeList .v131-exp-confirm:not(:disabled)');
            return confirm?{target:confirm,text:'點「確定」，完成這次升級。'}:
                step('#expDistributeList .v131-exp-preview-btn:not(:disabled)','點「點擊預覽升級」，看看這次的成長。');
        }
        if(f.step==='status-tab'){return step('#characterTabBtnStatus','升級完成。點「能力值」，看看新得到的能力點。');}
        if(f.step==='skill-tab'){return step('#characterTabBtnSkill','點「技能」，認識技能頁面。');}
        if(f.step==='return'){return step('#adventureTutorialReturn','技能已裝好，接回剛才的戰鬥。');}
        if(f.step==='skill'){
            const native=visibleGuideTarget('#skillElementTabs [onclick="selectSkillElementTab(\''+CSS.escape(f.nativeElement)+'\')"]');
            if(native?.getAttribute('aria-selected')!=='true'){return {target:native,text:'點本命元素分類，找到自己的招式。'};}
            const learned=Object.keys(view.tutorialProgress?.loadout?.skillLevels||{}).find(id=>
                view.tutorialProgress.loadout.skillLevels[id]>0&&visibleGuideTarget('.skill-row[data-skill-id="'+CSS.escape(id)+'"] [data-skill-action="equip"]'));
            return learned?step('.skill-row[data-skill-id="'+CSS.escape(learned)+'"] [data-skill-action="equip"]','點「裝備」，把招式放進戰鬥技能欄。'):
                step('#skillPage .skill-row [data-skill-action="growth"]:not(:disabled)','點「學習」，學會第一個招式。');
        }
        if(f.step==='attack'||f.step==='cast'){
            if(f.battleActive&&typeof battlePhase!=='undefined'&&battlePhase==='declare'&&
               typeof pendingAction!=='undefined'&&pendingAction){return step('#battleMonsterArea [id^="battleMonster"]','點擊敵人，確認這次出招。');}
            if(!f.battleActive||typeof battlePhase==='undefined'||battlePhase!=='declare'||
               (typeof actionReady!=='undefined'&&actionReady)){return {target:null,text:'出招中，看看這一回合的結果。',battle:true,waiting:true};}
            if(f.step==='attack'){return step('#mainBattleMenu button[onclick*="normal"]','點「普通攻擊」。');}
            const skill=visibleGuideTarget('#skillQuickBar.show .skill-quick-button[data-skill-id]:not(:disabled)');
            return skill?{target:skill,text:'點剛裝好的技能，準備施放。',battle:true}:
                step('#mainBattleMenu button[onclick*="toggleSkillQuickBar"]','點「技能」。');
        }
        return {target:null,text:'正在準備下一步，請稍候。',waiting:true};
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
        const upgrading=view.firstLesson?.step==='upgrade'&&
            document.getElementById('v169RpgDialogTitle')?.textContent==='確認經驗池升級';
        const dialog=visibleGuideTarget('.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button'+(upgrading?':last-child':''));
        if(dialog){return {target:dialog,text:"讀完提示後，點這裡繼續。"};}
        if(view.firstLesson&&!view.dialogue){return firstLessonGuide(view);}
        const o=view.tutorial,p=view.tutorialProgress||{};
        if(o.flowVersion===3&&o.basicComplete&&['c1_02','c1_03'].includes(view.state.currentNodeId)){return null;}
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
        if(visibleGuideTarget('#skillPage.active')||visibleGuideTarget('#homeFeatureModal.show[data-character-tab="skill"] #skillPage')){
            if(p.skillReady){return step('#adventureTutorialReturn','技能已裝好，返回故事再挑戰。');}
            const nativeTab=p.nativeElement&&visibleGuideTarget('#skillElementTabs [onclick="selectSkillElementTab(\''+CSS.escape(p.nativeElement)+'\')"]');
            if(nativeTab&&nativeTab.getAttribute('aria-selected')!=='true'){
                return {target:nativeTab,text:'先點本命元素分類，找到自己的招式。'};
            }
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
        API()?.syncFirstLesson?.();
        let view=runtimeView();
        if(view?.firstLesson){
            const modal=visibleGuideTarget('#homeFeatureModal.show #characterTabContent');
            if(modal){
                const step=view.firstLesson.step;
                const page=step==='city'?'character':
                    visibleGuideTarget('#homeFeatureModal.show[data-character-tab="expPool"] #homeExpPoolCard')?'expPool':
                    visibleGuideTarget('#homeFeatureModal.show[data-character-tab="status"] #statusPage')?'status':
                    visibleGuideTarget('#homeFeatureModal.show[data-character-tab="skill"] #skillPage')?'skill':null;
                if(page){API()?.observeFirstLessonPage?.(page);syncTutorialReturn(page);view=runtimeView();}
            }
        }
        const step=guideStep(view);
        if(!step){clearGuide();return;}
        const host=document.getElementById('game-ui');if(!host){return;}
        if(!guide.overlay){
            const overlay=document.createElement('div');overlay.id='adventureInputGuide';
            overlay.innerHTML='<div class="adventure-guide-shade top"></div><div class="adventure-guide-shade left"></div><div class="adventure-guide-shade right"></div><div class="adventure-guide-shade bottom"></div><div class="adventure-guide-ring"></div><div class="adventure-guide-copy" role="status" aria-live="polite"><p class="adventure-guide-text"></p><button type="button" class="adventure-button primary adventure-guide-next" hidden>下一步</button></div><div class="adventure-guide-recovery" hidden><p>目前操作尚未就緒，請重試引導。</p><button type="button">重試目前引導</button></div>';
            overlay.querySelector('.adventure-guide-next').onclick=()=>API()?.advanceFirstLesson?.();
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
        recovery.hidden=!!target||!!step.intro||!!step.waiting||(!!step.reading&&!!ui.storyPortraitPending);
        // The original EXP Owner restores its viewport over two animation
        // frames after preview. Recheck the same target after that restoration;
        // its identity alone does not prove that the next action is visible.
        const scroller=target?.closest?.('#characterTabContent');
        const targetBox=target?.getBoundingClientRect(),scrollBox=scroller?.getBoundingClientRect();
        const clipped=scrollBox&&targetBox&&(targetBox.top<scrollBox.top||targetBox.bottom>scrollBox.bottom);
        if(target&&(target!==guide.target||clipped)){target.scrollIntoView({block:'nearest',inline:'nearest'});}
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
        ring.hidden=!target||!!step.intro;ring.style.cssText='left:'+x+'px;top:'+y+'px;width:'+(right-x)+'px;height:'+(bottom-y)+'px';
        const copy=guide.overlay.querySelector('.adventure-guide-copy');
        copy.hidden=!recovery.hidden;
        const text=guide.overlay.querySelector('.adventure-guide-text'),next=guide.overlay.querySelector('.adventure-guide-next');
        if(text.textContent!==step.text){text.textContent=step.text;}
        next.hidden=!step.intro;next.disabled=!!step.waiting;
        const sheet=visibleGuideTarget('#adventurePage.active[data-panel="map"] .adventure-node-sheet');
        const sheetTop=sheet?(sheet.getBoundingClientRect().top-base.top)/scale:null;
        const copyHeight=copy.offsetHeight||180;
        copy.style.top=(step.intro?height*.12:sheetTop!==null?Math.max(25,sheetTop-copyHeight-28):y>height*.52?Math.max(25,y-copyHeight-28):Math.min(height-copyHeight-28,bottom+28))+'px';
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
        return panelShell("山路分岔","第一次有選擇，長期沒有遺憾",'<p class="adventure-lead">兩條路最後都會回到主線。首次推進選定後不能立刻回頭；章節通關後可直接回溯另一條。</p><div class="adventure-route-grid">'+cards+'</div>',actions,"branch-panel");
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
        const title=root.querySelector("#adventureHeaderTitle"),meta=root.querySelector("#adventureHeaderMeta");
        if(title){ title.textContent="第一章 · "+view.chapter.title; }
        if(meta){ meta.innerHTML='<span>建議 Lv.'+esc(view.chapter.suggestedLevel)+'</span><span>'+view.chapter.nodes.filter(n=>view.state.completedNodes[n.id]).length+' / 20 關</span><progress max="20" value="'+view.chapter.nodes.filter(n=>view.state.completedNodes[n.id]).length+'" aria-label="章節進度"></progress>'; }
        if(ui.body){
            const selected=view.chapter.nodes.find(node=>node.id===view.selectedNodeId)||view.chapter.nodes.find(node=>node.id===view.state.currentNodeId);
            const mapKey=view.visible&&view.panel==='map'?JSON.stringify([view.chapter.id,selected?.id]):null;
            const picker=ui.body.querySelector('#adventureStagePicker');
            const list=picker?.querySelector('.adventure-stage-list');
            // Hero sync may update map actions while the player is browsing.
            // Preserve only this same map selection's native disclosure state.
            const browsing=mapKey&&mapKey===ui.lastMapKey&&picker?{open:picker.open,scrollTop:list?.scrollTop||0}:null;
            ui.body.innerHTML=renderPanel(view);
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

    // Pure presentation: transient exploration dialogue never obtains a story cursor.
    function presentDialogue(host,options){
        const box=document.createElement('section');box.className='adventure-transient-dialogue';
        box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',options.name);
        let index=0,closed=false;
        const dispose=()=>{if(closed)return;closed=true;box.remove();};
        const renderLine=()=>{box.innerHTML='<h2>'+esc(options.name)+'</h2><p>'+esc(options.lines[index])+'</p><button type="button">'+(index<options.lines.length-1?'下一句':'繼續探索')+'</button>';const button=box.querySelector('button');button.addEventListener('click',()=>{if(index<options.lines.length-1){index++;renderLine();}else{dispose();options.onClose();}});button.focus({preventScroll:true});};
        box.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();box.querySelector('button').focus();}});
        host.append(box);renderLine();return dispose;
    }
    window.FourSymbolsAdventureUI=Object.freeze({presentDialogue,show:show,hide:hide,render:render,syncTracker:syncTracker,syncTutorialReturn:syncTutorialReturn,
        retryStoryPortrait:function(){ui.storyPortraitAttempted=null;render();}});

    if(typeof document!=="undefined"){
        const ready=function(){ ensureRoot();ensureTracker();syncTracker(); };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",ready,{once:true}); }
        else{ ready(); }
        document.addEventListener("four-symbols:adventure-state-change",()=>{ render();syncTracker(); });
        document.addEventListener("four-symbols:hero-acquisition-state",()=>{ render(); });
    }
})();


/* bundled source: prototypes/exploration-corner/scene.js */
// Single geometry source shared by the prototype and future classic production bundle.
(function(scope){
'use strict';
// EXPLORATION-CORNER-20261023: temporary sample data, no gameplay/save identity.
const scene = Object.freeze({
  width:1400,height:2600,viewWidth:1080,viewHeight:1320,
  spawn:{x:720,y:1250},speed:320,radius:23,
  objects:[
    {id:'house',art:'house',x:880,y:1030,width:760,height:700,solid:{x:580,y:780,width:580,height:250}},
    {id:'tree',art:'tree',x:330,y:1420,width:650,height:750,solid:{x:298,y:1365,width:64,height:70}},
    {id:'npc',art:'npc',x:1060,y:1350,width:120,height:180,solid:{x:1035,y:1320,width:50,height:50}}
  ]
});

function canStand(x,y,data=scene){
  const r=data.radius;
  if(x<r||y<r||x>data.width-r||y>data.height-r)return false;
  return !data.objects.some(({solid:b})=>{
    if(!b)return false;
    const nx=Math.max(b.x,Math.min(x,b.x+b.width)),ny=Math.max(b.y,Math.min(y,b.y+b.height));
    return Math.hypot(x-nx,y-ny)<r;
  });
}
function move(state,direction,seconds,data=scene){
  const vector=typeof direction==='object'&&direction?direction:{up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];
  const length=vector?Math.hypot(...vector):0;
  if(!Number.isFinite(length)||!length)return {...state,moving:false};
  const delta=vector.map(n=>n/length);
  const facing=Math.abs(delta[0])>Math.abs(delta[1])?(delta[0]>0?'right':'left'):(delta[1]>0?'down':'up');
  const next={...state,facing,moving:false};
  // Small bounded spatial steps prevent tunnelling even after a slow frame.
  let distance=data.speed*Math.max(0,Math.min(seconds,.05));
  while(distance>0){
    const step=Math.min(distance,4),x=next.x+delta[0]*step,y=next.y+delta[1]*step;
    if(!clearSegment(next,{x,y},data))break;
    next.x=x;next.y=y;next.moving=true;distance-=step;
  }
  return next;
}
function cameraFor(state,data=scene){
  return {x:Math.max(0,Math.min(data.width-data.viewWidth,state.x-data.viewWidth/2)),
    y:Math.max(0,Math.min(data.height-data.viewHeight,state.y-data.viewHeight*.72))};
}
const nearNpc=state=>Math.hypot(state.x-1060,state.y-1350)<165;

// The bounded grid is planning only. Movement and route smoothing share an exact
// swept-circle clearance check, so diagonal segments cannot cut solid corners.
function pointSegmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function segmentDistance(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const overlap=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
  if(overlap&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return 0;
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function clearSegment(a,b,data){
  if(!canStand(a.x,a.y,data)||!canStand(b.x,b.y,data))return false;
  return !data.objects.some(({solid:r})=>{
    if(!r)return false;
    const points=[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
    return points.some((p,i)=>segmentDistance(a,b,p,points[(i+1)%4])<data.radius-1e-8);
  });
}
function connect(a,b,data){
  return clearSegment(a,b,data)?[b]:null;
}
function smoothRoute(start,route,data){
  const result=[];let anchor=start,index=0;
  while(index<route.length){
    let next=route.length-1;while(next>index&&!clearSegment(anchor,route[next],data))next--;
    if(Math.hypot(route[next].x-anchor.x,route[next].y-anchor.y)>.01)result.push(route[next]);
    anchor=route[next];index=next+1;
  }
  return result;
}
function findRoute(start,target,data=scene){
  if(!canStand(start.x,start.y,data)||!canStand(target.x,target.y,data))return null;
  const direct=connect(start,target,data);
  if(direct)return smoothRoute(start,direct,data);
  const cell=40,cols=Math.floor(data.width/cell),rows=Math.floor(data.height/cell);
  const nodes=Array.from({length:cols*rows},(_,i)=>({x:(i%cols+.5)*cell,y:(Math.floor(i/cols)+.5)*cell}));
  const nearest=point=>nodes.map((p,i)=>({p,i,d:Math.hypot(p.x-point.x,p.y-point.y)})).filter(n=>n.d<=cell*1.5&&canStand(n.p.x,n.p.y,data)).sort((a,b)=>a.d-b.d);
  const starts=nearest(start).map(n=>({...n,link:connect(start,n.p,data)})).filter(n=>n.link);
  const ends=new Map(nearest(target).map(n=>[n.i,connect(n.p,target,data)]).filter(([,link])=>link));
  const queue=[],parents=new Map(),links=new Map();
  for(const n of starts){queue.push(n.i);parents.set(n.i,null);links.set(n.i,n.link);}
  for(let cursor=0;cursor<queue.length;cursor++){
    const id=queue[cursor],p=nodes[id];
    if(ends.has(id)){
      const chain=[];let key=id;while(parents.get(key)!==null){chain.unshift(nodes[key]);key=parents.get(key);}
      const route=[...links.get(key),...chain,...ends.get(id)];
      return smoothRoute(start,route,data);
    }
    for(const next of [id-cols,id+cols,id%cols? id-1:-1,id%cols<cols-1?id+1:-1]){
      if(next<0||next>=nodes.length||parents.has(next)||!clearSegment(p,nodes[next],data))continue;
      parents.set(next,id);queue.push(next);
    }
  }
  return null;
}
function followRoute(state,route,seconds,data=scene){
  let next={...state,moving:false},remaining=data.speed*Math.max(0,Math.min(seconds,.05)),moved=false;
  while(route.length&&remaining>.001){
    const target=route[0],dx=target.x-next.x,dy=target.y-next.y;
    if(Math.hypot(dx,dy)<.01){route.shift();continue;}
    const distance=Math.min(remaining,Math.hypot(dx,dy));
    const step=move(next,[dx,dy],distance/data.speed,data),actual=Math.hypot(step.x-next.x,step.y-next.y);
    next=step;moved=moved||actual>0;remaining-=distance;
    if(actual<distance-.01){route.length=0;break;}
    if(Math.hypot(target.x-next.x,target.y-next.y)<.01)route.shift();
  }
  return {...next,moving:moved};
}
function npcRoute(start,data=scene){
  const npc=data.objects.find(o=>o.id==='npc');
  const candidates=[[0,120],[-120,0],[120,0],[0,-120]].map(([x,y])=>({x:npc.x+x,y:npc.y+y}));
  return candidates.map(p=>findRoute(start,p,data)).filter(Boolean).sort((a,b)=>{
    const length=r=>r.reduce((n,p,i)=>n+Math.hypot(p.x-(i?r[i-1]:start).x,p.y-(i?r[i-1]:start).y),0);
    return length(a)-length(b);
  })[0]||null;
}

scope.FourSymbolsExplorationGeometry=Object.freeze({scene,canStand,move,cameraFor,nearNpc,findRoute,followRoute,npcRoute});
})(globalThis);


/* bundled source: prototypes/exploration-corner/runtime.js */
// Single runtime source. UI owns routing/Display; services never mutate gameplay here.
(function(scope){
'use strict';
const {scene,move,cameraFor,nearNpc,findRoute,followRoute,npcRoute}=scope.FourSymbolsExplorationGeometry;
let mounted=null;

// One instance owns input, frame, camera, interaction and cleanup. No globals
// from Adventure, Patrol, Player, Save or Economy are accessed.
function mount(root,services={}){
  if(mounted){if(mounted.root===root)return mounted.controller;throw new Error('Exploration already mounted');}
  if(!root?.isConnected)throw new Error('Exploration requires a connected root');
  const eventToPoint=services.eventToPoint||scope.eventToGamePoint;
  if(typeof eventToPoint!=='function')throw new Error('Exploration requires the existing Display coordinate service');
  const data=services.scene||scene;
  const nearby=position=>services.scene?data.objects.filter(o=>o.interaction&&Math.hypot(position.x-o.approach.x,position.y-o.approach.y)<(o.range||145)).sort((a,b)=>Math.hypot(position.x-a.approach.x,position.y-a.approach.y)-Math.hypot(position.x-b.approach.x,position.y-b.approach.y))[0]:nearNpc(position)?{id:'npc',label:'與村民招呼 · E'}:null;
  let analog=null;
  const world=root.querySelector('[data-world]'),actor=root.querySelector('[data-player]');
  const sprites=[...actor.querySelectorAll('[data-pose]')];
  const prompt=root.querySelector('[data-interact]');
  const viewport=root.querySelector('.explore-viewport'),marker=root.querySelector('[data-destination]'),status=root.querySelector('[data-status]');
  const directions=new Map(),captures=new Map();
  let abort=null,active=false,generation=0,interactionGeneration=0,interactionCleanup=null;
  let state={...data.spawn,facing:'up',moving:false},frame=0,last=0,opened=false,disposed=false;
  let route=[],destination=null,gesture=null,walkTime=0;

  for(const item of data.objects){
    const el=document.createElement('div');el.className='explore-object';el.dataset.object=item.id;
    Object.assign(el.style,{left:item.x+'px',top:item.y+'px',width:item.width+'px',height:item.height+'px',zIndex:String(item.sortY??item.y)});
    el.innerHTML=services.renderObject?services.renderObject(item):`<svg viewBox="0 0 ${item.width} ${item.height}" aria-hidden="true"><use href="/prototypes/exploration-corner/art.svg#${item.art}"/></svg>`;
    world.append(el);
  }
  function cancelRoute(){route=[];destination=null;gesture=null;}
  function clearInput(){
    for(const [id,el] of captures){if(el.hasPointerCapture(id))el.releasePointerCapture(id);}
    captures.clear();directions.clear();analog=null;cancelRoute();state.moving=false;last=0;render();
  }
  function endInteraction(){
    interactionGeneration++;
    const cleanup=interactionCleanup;interactionCleanup=null;opened=false;
    cleanup?.();
  }
  function closeInteraction(){
    try{endInteraction();}finally{clearInput();if(active)root.focus({preventScroll:true});}
  }
  function interact(){
    if(!active||opened||!nearby(state))return;
    if(typeof services.onInteract!=='function'){status.textContent='對話尚未接通';return;}
    opened=true;clearInput();const token=generation,interactionToken=++interactionGeneration;
    const close=()=>{
      if(!active||token!==generation||interactionToken!==interactionGeneration||!opened)return;
      closeInteraction();
    };
    try{
      const cleanup=services.onInteract({npcId:nearby(state).id,close});
      if(cleanup!=null&&typeof cleanup!=='function')throw new TypeError('Interaction must return synchronous cleanup');
      if(!active||token!==generation||interactionToken!==interactionGeneration||!opened)cleanup?.();else interactionCleanup=cleanup;
    }catch(error){
      if(active&&token===generation&&interactionToken===interactionGeneration){endInteraction();status.textContent='對話載入失敗，請重試';}
      throw error;
    }
  }
  function requestExit(){
    if(!active)return;
    clearInput();services.requestExit?.();
  }
  function bindInput(){
  const signal=abort.signal;
  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  root.addEventListener('keydown',e=>{
    if(keys[e.key]){e.preventDefault();if(!opened&&!e.repeat){cancelRoute();analog=null;directions.set('key:'+e.code,keys[e.key]);status.textContent='方向控制中';}}
    if((e.key==='e'||e.key==='E')&&!e.repeat){e.preventDefault();interact();}
    if(e.key==='Escape'){e.preventDefault();if(opened)closeInteraction();else requestExit();}
  },{signal});
  window.addEventListener('keyup',e=>{directions.delete('key:'+e.code);},{signal});
  for(const button of root.querySelectorAll('[data-direction]')){
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(opened)return;
      cancelRoute();status.textContent='方向控制中';
      // Touch uses one directional pad; most recent held direction wins.
      button.setPointerCapture(e.pointerId);captures.set(e.pointerId,button);directions.set('pointer:'+e.pointerId,button.dataset.direction);
    },{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{captures.delete(e.pointerId);directions.delete('pointer:'+e.pointerId);},{signal});
  }
  viewport.addEventListener('pointerdown',e=>{
    if(opened||!e.isPrimary||e.button!==0)return;
    gesture={id:e.pointerId};viewport.setPointerCapture(e.pointerId);captures.set(e.pointerId,viewport);
    // Commit at contact, using the current position/camera. Release must not
    // replay a stale target after the character and camera have moved.
    e.preventDefault();directions.clear();analog=null;
    let point;
    try{
      point=eventToPoint(e);
      if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))throw new TypeError('Invalid Display point');
    }catch(_){clearInput();status.textContent='座標尚未就緒，請重試';return;}
    const camera=cameraFor(state,data);
    const target={x:point.x-viewport.offsetLeft+camera.x,y:point.y-viewport.offsetTop+camera.y};
    const npc=services.scene?data.objects.find(o=>{if(!o.interaction||(o.interaction==='talk'&&!o.solid))return false;const b=o.hitbox||{x:o.x-o.width/2,y:o.y-o.height,width:o.width,height:o.height};return target.x>=b.x&&target.x<=b.x+b.width&&target.y>=b.y&&target.y<=b.y+b.height;}):data.objects.find(o=>o.id==='npc');
    const npcHit=npc&&target.x>=npc.x-npc.width/2&&target.x<=npc.x+npc.width/2&&target.y>=npc.y-npc.height&&target.y<=npc.y;
    const planned=npcHit?(services.scene?findRoute(state,npc.approach,data):npcRoute(state,data)):findRoute(state,target,data);route=planned||[];
    destination=route.at(-1)||null;
    status.textContent=destination?(npcHit?'走近村民後，按招呼確認':'前往落點；再點可更改'):planned?'已在落點附近':'此處無法抵達，請另選落點';
    root.focus({preventScroll:true});render();
  },{signal});
  viewport.addEventListener('pointerup',e=>{captures.delete(e.pointerId);if(gesture?.id===e.pointerId)gesture=null;},{signal});
  viewport.addEventListener('pointercancel',e=>{if(gesture?.id===e.pointerId)clearInput();},{signal});
  const joystick=root.querySelector('[data-joystick]');
  if(joystick){
    let stickId=null;
    const point=e=>{const p=eventToPoint(e);return [p.x-joystick.offsetLeft-joystick.offsetWidth/2,p.y-(joystick.parentElement.offsetTop||0)-joystick.offsetTop-joystick.offsetHeight/2];};
    const update=e=>{if(e.pointerId!==stickId)return;e.preventDefault();const [x,y]=point(e);analog=Math.hypot(x,y)>18?[x,y]:null;};
    joystick.addEventListener('pointerdown',e=>{if(opened||stickId!==null||!e.isPrimary)return;e.preventDefault();stickId=e.pointerId;cancelRoute();directions.clear();joystick.setPointerCapture(e.pointerId);captures.set(e.pointerId,joystick);update(e);},{signal});
    joystick.addEventListener('pointermove',update,{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===stickId){stickId=null;analog=null;captures.delete(e.pointerId);}},{signal});
  }
  prompt.addEventListener('click',interact,{signal});
  root.querySelector('[data-exit]')?.addEventListener('click',requestExit,{signal});
  window.addEventListener('blur',clearInput,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();},{signal});
  window.addEventListener('pagehide',leave,{signal});
  }
  function render(){
    const camera=cameraFor(state,data);
    world.style.transform=`translate(${-camera.x}px,${-camera.y}px)`;
    actor.style.left=state.x+'px';actor.style.top=state.y+'px';actor.style.zIndex=String(Math.round(state.y));
    actor.dataset.facing=state.facing;actor.classList.toggle('is-walking',state.moving);
    const pose=state.moving?(Math.floor(walkTime/.16)%4===0?1:Math.floor(walkTime/.16)%4===2?2:0):0;
    // Keep external SVG instances stable: changing href briefly clears their
    // geometry in Chrome. The same render owner selects one preloaded pose.
    const activePose=`${state.facing}-${pose}`;
    for(const sprite of sprites){
      const visibility=sprite.dataset.pose===activePose?'visible':'hidden';
      if(sprite.getAttribute('visibility')!==visibility)sprite.setAttribute('visibility',visibility);
    }
    marker.hidden=!destination;if(destination){marker.style.left=destination.x+'px';marker.style.top=destination.y+'px';}
    const interaction=nearby(state);prompt.disabled=!active||opened||!interaction;prompt.textContent=interaction?(interaction.label||'交談'):(services.scene?'靠近可互動':'靠近村民可招呼');
    services.onRender?.({state,camera,walkTime,pose});
    for(const button of root.querySelectorAll('[data-direction]'))button.classList.toggle('is-held',[...directions.values()].at(-1)===button.dataset.direction);
    // Read-only observable sample state for QA; not a setter or save surface.
    root.dataset.position=`${state.x.toFixed(2)},${state.y.toFixed(2)}`;
    root.dataset.camera=`${camera.x.toFixed(2)},${camera.y.toFixed(2)}`;
    root.dataset.destination=destination?`${destination.x.toFixed(2)},${destination.y.toFixed(2)}`:'';
  }
  function tick(now){
    if(disposed||!active)return;
    const seconds=last?(now-last)/1000:0;last=now;
    if(document.hidden||opened){state.moving=false;last=0;}
    else if(analog){state=move(state,analog,seconds,data);}
    else if(directions.size){
      const pointer=[...directions].filter(([key])=>key.startsWith('pointer:')).at(-1);
      const held=new Set(directions.values());
      state=move(state,pointer?pointer[1]:[Number(held.has('right'))-Number(held.has('left')),Number(held.has('down'))-Number(held.has('up'))],seconds,data);
    }
    else if(route.length){state=followRoute(state,route,seconds,data);if(!route.length){destination=null;status.textContent=nearNpc(state)?'已走近，按招呼確認':'已抵達；點地面繼續走';}}
    else state={...state,moving:false};
    walkTime=state.moving?walkTime+Math.min(seconds,.05):0;
    render();frame=requestAnimationFrame(tick);
  }
  function enter(){
    if(disposed)throw new Error('Exploration instance destroyed');
    if(active)return;
    generation++;state={...data.spawn,facing:'up',moving:false};walkTime=0;
    active=true;abort=new AbortController();bindInput();clearInput();
    frame=requestAnimationFrame(tick);root.focus({preventScroll:true});
  }
  function leave(){
    if(!active)return;
    active=false;generation++;cancelAnimationFrame(frame);frame=0;abort.abort();
    try{endInteraction();}finally{clearInput();}
  }
  function destroy(){
    if(disposed)return;
    try{leave();}finally{
      disposed=true;world.querySelectorAll('[data-object]').forEach(el=>el.remove());
      if(mounted?.root===root)mounted=null;
    }
  }
  const controller=Object.freeze({enter,leave,destroy});
  mounted={root,controller};render();return controller;
}
scope.FourSymbolsExploration=Object.freeze({mount});
})(globalThis);


/* bundled source: js/exploration/taoxi-content.js */
/* EXPLORATION-CORNER-20261023: reversible Taoxi v1 content; no main-story writes. */
(function(scope){
'use strict';
const houses=[
  {id:'a',name:'桃枝居',x:470,y:2350,condition:'open',hint:'村口民宅，歡迎歇腳。'},
  {id:'b',name:'溪畔居',x:1330,y:2300,condition:'open',hint:'溪邊人家，門常開著。'},
  {id:'c',name:'藥農居',x:420,y:1530,condition:'clue',hint:'先與阿芸交談，並讀桃枝居的書信。'},
  {id:'d',name:'織戶居',x:1330,y:1450,condition:'c1_06',hint:'完成主線第 6 關「村民求援」後開放。'},
  {id:'e',name:'守望居',x:900,y:650,condition:'mixed',hint:'完成主線第 16 關「寨前情報」，並讀藥農居的手記。'}
];
const npcs=[
  {id:'elder',name:'周伯',x:840,y:2470,lines:['少俠，桃溪村就在前頭。村口的桃枝居與溪畔居都可進去歇腳。','各家留的補給只取一回。走累了，也可沿原路返回。']},
  {id:'ayun',name:'阿芸',x:940,y:1840,lines:['藥農託我照看門戶。讀過桃枝居桌上的書信，就能知道他留下的線索。','村中傳聞，還得回主線向當事人查證；閒聊不會替你完成關卡。']},
  {id:'woodworker',name:'陳叔',x:850,y:1060,lines:['山路的事，就依你親身走過的經歷來。','織戶等村民求援的事告一段落才開門；守望居還得等寨前情報。']}
];
const points=[
  {id:'a-chest',house:'a',name:'旅途補給',kind:'reward',item:'hpPotion10',count:1,text:'主人留下一包回春散，供過路人應急。'},
  {id:'a-letter',house:'a',name:'桌上書信',kind:'clue',text:'藥農留書：若阿芸已認得你，便可來藥農居翻閱手記。'},
  {id:'b-chest',house:'b',name:'竹籃補給',kind:'reward',item:'spPotion10',count:1,text:'竹籃裡留著一包凝氣散。'},
  {id:'b-note',house:'b',name:'溪畔舊記',kind:'clue',text:'溪水年年流過桃枝。紙上的舊事，只是村人的生活記錄。'},
  {id:'c-chest',house:'c',name:'藥箱',kind:'reward',item:'hpPotion10',count:1,text:'藥農留下的一包回春散。'},
  {id:'c-journal',house:'c',name:'藥農手記',kind:'clue',text:'手記：守望居的人關心寨前道路。知曉第十六關的情報後，可持此線索前往。'},
  {id:'d-chest',house:'d',name:'窗邊布包',kind:'reward',item:'spPotion10',count:1,text:'布包內有一包凝氣散。'},
  {id:'d-box',house:'d',name:'木櫃補給',kind:'reward',item:'hpPotion10',count:1,text:'一包收好的回春散。'},
  {id:'e-chest',house:'e',name:'守望補給',kind:'reward',item:'spPotion10',count:1,text:'守望人留下一包凝氣散。'},
  {id:'e-record',house:'e',name:'村中紀事',kind:'clue',text:'村中紀事：行走江湖，記得來處。你已走遍桃溪村五戶人家。'}
];
function unlocked(house,chapter,state){
  const done=id=>!!chapter?.completedNodes?.[id];
  if(house.condition==='open')return true;
  if(house.condition==='clue')return state.talked.ayun===true&&state.searched['a-letter']===true;
  if(house.condition==='mixed')return done('c1_16')&&state.searched['c-journal']===true;
  return done(house.condition);
}
function available(chapter){return [1,2,3,4,5].every(n=>!!chapter?.completedNodes?.['c1_'+String(n).padStart(2,'0')])&&chapter?.onboarding?.active===false&&chapter.onboarding.phase==='complete';}
function appearance(player){const index=['fire','water','wind','earth'].indexOf(player?.element);if(index<0)throw Error('無法辨識創角外觀');return 'player_'+(player.gender==='male'?'male':'female')+'_0'+(index+1);}
function village(spawn){
  return {id:'village',name:'桃溪村',width:1800,height:3100,viewWidth:1080,viewHeight:1420,radius:23,speed:320,spawn:spawn||{x:900,y:2800},objects:[
    {id:'village-exit',name:'桃溪村口',art:'gate',x:900,y:3070,width:600,height:600,approach:{x:900,y:2960},hitbox:{x:800,y:2990,width:200,height:80},interaction:'exit-map',label:'離開桃溪村'},
    {id:'gate-left',art:'solid',x:0,y:0,width:0,height:0,solid:{x:680,y:2910,width:65,height:65}},
    {id:'gate-right',art:'solid',x:0,y:0,width:0,height:0,solid:{x:1060,y:2980,width:70,height:70}},
    ...houses.map(h=>({...h,art:'house',width:660,height:660,sortY:h.y-65,solid:{x:h.x-260,y:h.y-370,width:520,height:305},approach:{x:h.x-30,y:h.y+40},hitbox:{x:h.x-260,y:h.y-580,width:520,height:590},interaction:'house',label:'進入 '+h.name})),
    ...npcs.map(n=>({...n,art:'npc',width:200,height:200,approach:{x:n.x,y:n.y+100},hitbox:{x:n.x-45,y:n.y-185,width:90,height:185},interaction:'talk',label:'交談 · '+n.name})),
    ...[[280,2810],[1520,2750],[130,1890],[1690,1710],[150,830],[1640,650]].map(([x,y],i)=>({id:'peach-'+i,art:'peach',x,y,width:480,height:600,solid:{x:x-23,y:y-50,width:46,height:50}}))
  ]};
}
function interior(id){
  const h=houses.find(h=>h.id===id);if(!h)throw Error('未知民宅');
  const layouts={a:{bed:[230,540],points:[[790,950],[330,570]]},b:{bed:[820,540],points:[[310,950],[760,570]]},c:{bed:[230,600],points:[[800,980],[760,590]]},d:{bed:[820,600],points:[[280,980],[330,590]]},e:{bed:[230,640],points:[[800,980],[720,650]]}};
  const layout=layouts[id],positions=layout.points;
  return {id,name:h.name,width:1080,height:1420,viewWidth:1080,viewHeight:1420,radius:23,speed:300,spawn:{x:540,y:1220},objects:[
    {id:'wall-back',art:'solid',x:0,y:0,width:0,height:0,solid:{x:0,y:0,width:1080,height:300}},
    {id:'wall-left',art:'solid',x:0,y:0,width:0,height:0,solid:{x:0,y:0,width:80,height:1420}},
    {id:'wall-right',art:'solid',x:0,y:0,width:0,height:0,solid:{x:1000,y:0,width:80,height:1420}},
    {id:'wall-front-left',art:'solid',x:0,y:0,width:0,height:0,solid:{x:0,y:1110,width:350,height:310}},
    {id:'wall-front-right',art:'solid',x:0,y:0,width:0,height:0,solid:{x:730,y:1110,width:350,height:310}},
    {id:'bed',art:'bed',x:layout.bed[0],y:layout.bed[1],width:430,height:430,solid:{x:layout.bed[0]-120,y:layout.bed[1]-330,width:240,height:330}},
    ...points.filter(p=>p.house===id).map((p,i)=>({...p,art:i?'desk':'chest',x:positions[i][0],y:positions[i][1],width:i?300:200,height:i?295:223,solid:{x:positions[i][0]-(i?115:70),y:positions[i][1]-(i?100:75),width:i?230:140,height:i?100:75},approach:{x:positions[i][0],y:positions[i][1]+85},interaction:'search',label:'搜尋 · '+p.name})),
    {id:'door',art:'door',x:540,y:1390,width:220,height:125,approach:{x:540,y:1250},interaction:'exit',label:'出屋'}
  ]};
}
scope.FourSymbolsTaoxiContent=Object.freeze({houses,npcs,points,unlocked,available,appearance,village,interior});
})(globalThis);


/* bundled source: js/exploration/taoxi-progress.js */
/* Local provisional play uses the existing UID main-save and Inventory Owner.
   This module never creates Cloud entitlement or calls a story progression API. */
(function(scope){
'use strict';
const C=scope.FourSymbolsTaoxiContent;
function read(player,uid){
  const raw=player?.explorationProgress;
  if(raw===undefined)return {version:1,ownerUid:uid,talked:{},searched:{}};
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(!record(raw)||raw.version!==1||raw.ownerUid!==uid||!record(raw.talked)||!record(raw.searched)||
    Object.entries(raw.talked).some(([k,v])=>!C.npcs.some(n=>n.id===k)||v!==true)||
    Object.entries(raw.searched).some(([k,v])=>!C.points.some(p=>p.id===k)||v!==true))throw Error('探索紀錄無法驗證，請保留存檔並聯絡支援。');
  return JSON.parse(JSON.stringify(raw));
}
function create(services){
  let busy=false;
  function snapshot(){const uid=services.uid(),player=services.player();if(!uid||!player?.id)throw Error('請先登入並載入角色');return {uid,player,state:read(player,uid),chapter:player.adventureProgress?.chapters?.chapter_v1};}
  function commit(kind,id){
    if(busy)return {ok:false,message:'正在保存，請稍候'};
    busy=true;
    try{
      const s=snapshot();if(!C.available(s.chapter))return {ok:false,message:'完成前五關與新手教學後開放'};
      const field=kind==='talk'?'talked':'searched',definition=(kind==='talk'?C.npcs:C.points).find(p=>p.id===id);
      if(!definition)return {ok:false,message:'未知互動'};
      if(kind!=='talk'&&!C.unlocked(C.houses.find(h=>h.id===definition.house),s.chapter,s.state))return {ok:false,message:'民宅尚未開放'};
      if(s.state[field][id]===true)return {ok:true,repeated:true,message:kind==='talk'?'已交談':definition.kind==='reward'?'此處補給已領取':definition.text};
      const old=s.player.explorationProgress,next=JSON.parse(JSON.stringify(s.state));next[field][id]=true;
      let ok=false;
      try{ok=services.transaction(()=>{
        // Source/UID checks occur again immediately before this synchronous commit.
        if(services.uid()!==s.uid||services.player()!==s.player)return false;
        if(definition.kind==='reward'&&services.addItem(definition.item,definition.count)!==true)return false;
        s.player.explorationProgress=next;
        return services.save()===true;
      })===true;}finally{if(!ok){if(old===undefined)delete s.player.explorationProgress;else s.player.explorationProgress=old;}}
      return {ok,message:ok?(definition.text||'已記下村民的話'):'保存失敗或背包已滿，紀錄與獎勵未提交，請重試'};
    }catch(error){return {ok:false,message:error.message};}finally{busy=false;}
  }
  return Object.freeze({snapshot,talk:id=>commit('talk',id),search:id=>commit('search',id)});
}
scope.FourSymbolsTaoxiProgress=Object.freeze({read,create});
})(globalThis);


/* bundled source: js/exploration/taoxi-ui.js */
(function(scope){
'use strict';
const C=scope.FourSymbolsTaoxiContent;
const progress=scope.FourSymbolsTaoxiProgress.create({
  uid:()=>scope.FourSymbolsAccountSave?.getActiveUid(),
  player:()=>typeof player!=='undefined'?player:null,
  transaction:fn=>scope.v132RunInventoryTransaction?scope.v132RunInventoryTransaction(fn):false,
  addItem:(id,n)=>typeof addPotionToInventory==='function'&&addPotionToInventory(id,n)===true,
  save:()=>typeof saveGame==='function'&&saveGame({source:'taoxi-local-provisional'})===true
});
let root=null,controller=null,origin='home',ownerUid=null,ownerPlayer=null,ownerCharacterId=null,current='map',returnPoint=null,opening=0,dialogCleanup=null;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=name=>'assets/exploration/taoxi-v1/'+name+'.webp';
function ensureRoot(){
  if(root?.isConnected)return root;
  root=document.createElement('section');root.id='explorationPage';root.className='page taoxi-page game-native-ui';root.hidden=true;root.tabIndex=0;root.setAttribute('aria-label','四象江湖探索');
  document.getElementById('game-overlay-layer').append(root);return root;
}
function sameOwner(){return ownerUid&&scope.FourSymbolsAccountSave?.getActiveUid()===ownerUid&&typeof player!=='undefined'&&player===ownerPlayer&&player.id===ownerCharacterId;}
function stop(){controller?.destroy();controller=null;dialogCleanup?.();dialogCleanup=null;}
function leave(){opening++;stop();if(root){root.hidden=true;root.classList.remove('active');}ownerUid=null;ownerPlayer=null;ownerCharacterId=null;}
function close(){const destination=origin;leave();if(destination==='adventure')scope.FourSymbolsAdventure?.open();else if(typeof showPage==='function')showPage('home');document.getElementById(destination==='home'?'taoxiHomeEntry':'taoxiStoryEntry')?.focus();}
function header(title){return '<header class="taoxi-heading"><button type="button" data-back aria-label="返回">←</button><div><small>四象江湖傳</small><h1>'+escape(title)+'</h1></div></header>';}
function bindBack(fn){root.querySelector('[data-back]').addEventListener('click',fn);}
function notify(message){root.querySelector('[data-status]').textContent=message;}
function map(){
  if(!sameOwner()){leave();return;}
  stop();current='map';root.dataset.scene='map';
  let s;try{s=progress.snapshot();}catch(error){root.innerHTML=header('探索紀錄待確認')+'<p class="taoxi-error">'+escape(error.message)+'</p>';bindBack(close);return;}
  const available=C.available(s.chapter);
  root.innerHTML='<div class="taoxi-map-art" role="img" aria-label="雲山溪谷與桃花村落"></div>'+header('四象江湖大地圖')+
    '<div class="taoxi-map-lock lock-one">尚未開放</div><div class="taoxi-map-lock lock-two">尚未開放</div><div class="taoxi-map-lock lock-three">黑松林 · 規劃中</div>'+
    '<button type="button" class="taoxi-region" data-village '+(!available?'disabled':'')+'><span aria-hidden="true">◇</span><strong>桃溪村</strong><small>'+(available?'進入探索':'完成前 5 關及新手教學後開放')+'</small></button>'+
    '<p class="taoxi-map-caption">點選亮起的區域，踏入江湖。</p>';
  bindBack(close);root.querySelector('[data-village]').addEventListener('click',()=>scene('village'));root.focus({preventScroll:true});
}
function objectMarkup(object){
  if(object.art==='solid')return '';
  if(object.art==='gate')return '<img src="'+asset('gate')+'" alt="">';
  if(object.art==='house')return '<img src="'+asset('house')+'" alt=""><span class="taoxi-object-label">'+escape(object.name)+'</span>';
  if(object.art==='npc')return '<span class="taoxi-npc-sprite" style="background-position:'+({elder:0,ayun:50,woodworker:100}[object.id])+'% 0"></span><span class="taoxi-object-label">'+escape(object.name)+'</span>';
  if(object.art==='door')return '<span class="taoxi-door">出口</span>';
  const frames={bed:[0,0,620,624],desk:[640,0,621,610],chest:[0,624,560,623],peach:[560,610,701,637]};
  const frame=frames[object.art],clip='taoxi-frame-'+object.id;
  return '<svg class="taoxi-prop" viewBox="'+frame.join(' ')+'" style="overflow:hidden" aria-hidden="true"><defs><clipPath id="'+clip+'"><rect x="'+frame[0]+'" y="'+frame[1]+'" width="'+frame[2]+'" height="'+frame[3]+'"/></clipPath></defs><image clip-path="url(#'+clip+')" href="'+asset('props')+'" width="1261" height="1247"/></svg>';
}
function scene(id,spawn){
  if(!sameOwner()){leave();return;}
  const s=progress.snapshot();if(!C.available(s.chapter)){map();return;}
  if(id!=='village'&&!C.unlocked(C.houses.find(h=>h.id===id),s.chapter,s.state)){map();return;}
  stop();current=id;root.dataset.scene=id;delete root.dataset.area;
  const data=id==='village'?C.village(spawn):C.interior(id),appearance=C.appearance(s.player);
  root.innerHTML=header(id==='village'?'桃溪村':data.name)+
    '<div class="explore-viewport taoxi-viewport"><div class="explore-world taoxi-world" data-world style="width:'+data.width+'px;height:'+data.height+'px">'+
    '<div class="taoxi-ground '+(id==='village'?'taoxi-village-ground':'taoxi-room-ground')+'"></div>'+
    '<div class="explore-player taoxi-player" data-player><span class="explore-shadow"></span><span class="taoxi-character" style="background-image:url('+asset(appearance)+')"></span></div><span class="explore-destination" data-destination hidden></span></div></div>'+
    '<footer class="taoxi-controls"><div data-joystick class="taoxi-joystick" aria-label="虛擬搖桿"><span aria-hidden="true">✥</span></div><div><button type="button" data-interact disabled>靠近可互動</button><p data-status role="status">點地移動，也可拖動左側搖桿。</p></div></footer>'+
    '<p class="taoxi-save-note">本機探索紀錄 · 尚非雲端同步</p>';
  const character=root.querySelector('.taoxi-character');
  controller=scope.FourSymbolsExploration.mount(root,{
    scene:data,eventToPoint:event=>scope.eventToGamePoint(event),renderObject:objectMarkup,
    requestExit:()=>id==='village'?map():scene('village',returnPoint),
    onRender({state,pose}){
      if(!sameOwner()){queueMicrotask(leave);return;}
      const rows=appearance==='player_male_03'?{down:0,left:2,right:1,up:3}:{down:0,left:1,right:2,up:3};
      if(id==='village'){
        root.dataset.gateCutaway=String(Math.abs(state.x-900)<270&&state.y>2470&&state.y<3070);
        const area=state.y>2520?'村口':state.y>1680?'廣場':'民宅周圍';
        if(root.dataset.area!==area){root.dataset.area=area;root.querySelector('h1').textContent='桃溪村 · '+area;}
      }
      const row=rows[state.facing];character.style.backgroundPosition=(pose*50)+'% '+(row*100/3)+'%';
      character.style.transform=appearance==='player_female_03'&&state.facing==='left'&&pose>0?'scaleX(-1)':'';
    },
    onInteract({npcId,close:resume}){
      const object=data.objects.find(o=>o.id===npcId);if(!object||!sameOwner()){resume();return;}
      if(object.interaction==='house'){
        const state=progress.snapshot();
        if(!C.unlocked(object,state.chapter,state.state)){
          return scope.FourSymbolsAdventureUI.presentDialogue(root,{name:object.name,lines:[object.hint],onClose:resume});
        }
        returnPoint={x:object.approach.x,y:object.approach.y+85};resume();queueMicrotask(()=>scene(object.id));return;
      }
      if(object.interaction==='exit-map'){resume();queueMicrotask(map);return;}
      if(object.interaction==='exit'){resume();queueMicrotask(()=>scene('village',returnPoint));return;}
      const result=object.interaction==='talk'?progress.talk(object.id):progress.search(object.id);
      notify(result.ok?'已保存至本機探索紀錄。':result.message);
      const lines=result.ok?(object.interaction==='talk'?object.lines:[result.message]):[result.message];
      return scope.FourSymbolsAdventureUI.presentDialogue(root,{name:object.name,lines,onClose:resume});
    }
  });
  bindBack(()=>id==='village'?map():scene('village',returnPoint));controller.enter();
}
async function open(source){
  if(typeof battleActive!=='undefined'&&battleActive)return false;
  const token=++opening;const s=progress.snapshot();
  origin=source==='adventure'?'adventure':'home';ownerUid=s.uid;ownerPlayer=s.player;ownerCharacterId=s.player.id;
  ensureRoot();if(token!==opening)return false;
  if(typeof showPage!=='function')return false;showPage('exploration');root.hidden=false;map();return true;
}
window.addEventListener('pageshow',event=>{if(event.persisted&&root?.classList.contains('active')&&sameOwner()){if(current==='map')map();else scene(current);}});
scope.FourSymbolsTaoxi=Object.freeze({open,leave});
})(globalThis);
