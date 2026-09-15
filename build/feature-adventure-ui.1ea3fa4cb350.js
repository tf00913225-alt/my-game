/* =====================================================
   出城冒險 V1 — shared UI renderer owner
   One renderer for map/events/objective/merchant/reward views.
===================================================== */
(function installAdventureUiV1(){
    "use strict";
    if(typeof window==="undefined"||window.FourSymbolsAdventureUI){ return; }

    const API=()=>window.FourSymbolsAdventure;
    const CONTENT=()=>window.FourSymbolsAdventureContent;
    const ui={root:null,body:null,tracker:null,lastFocusNodeId:null};

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
            root.className="adventure-page";
            root.hidden=true;
            root.setAttribute("aria-label","出城冒險章節地圖");
            root.innerHTML=
                '<div class="adventure-scene-decor" aria-hidden="true">'+
                    '<span class="adventure-world-bg"></span><span class="adventure-world-far"></span><span class="adventure-world-mid"></span><span class="adventure-world-near"></span>'+
                    '<span class="adventure-mist mist-a"></span><span class="adventure-mist mist-b"></span>'+
                    '<span class="adventure-lantern-glow glow-a"></span><span class="adventure-lantern-glow glow-b"></span>'+
                '</div>'+
                '<header class="adventure-header">'+
                    '<button type="button" class="adventure-back-button" onclick="FourSymbolsAdventure.closeToCity()" aria-label="返回主城">返回主城</button>'+
                    '<div class="adventure-heading"><span>出城冒險</span><strong id="adventureHeaderTitle">章節</strong></div>'+
                    '<div class="adventure-header-meta" id="adventureHeaderMeta"></div>'+
                '</header>'+
                '<div class="adventure-view" id="adventureView"></div>';
            stage.appendChild(root);
        }
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

    function mapRoadSvg(){
        const mainA="M194 1613 C255 1545 305 1490 356 1440 C414 1385 475 1328 529 1267";
        const safe="M529 1267 C470 1208 395 1134 335 1075 C385 1016 456 946 540 883";
        const bold="M529 1267 C590 1206 659 1134 724 1075 C676 1008 612 942 540 883";
        const mainB="M540 883 C474 818 391 749 324 691 C389 642 477 596 551 557 C625 516 696 470 756 422 C718 359 654 299 594 250 C527 205 446 165 367 134";
        const hidden="M540 883 C648 860 754 824 853 787";
        function pair(path,branch){
            return '<path class="'+(branch?'adventure-road-branch-bed':'adventure-road-bed')+'" d="'+path+'"/>'+
                '<path class="'+(branch?'adventure-road-branch':'adventure-road-main')+'" d="'+path+'"/>';
        }
        return '<svg class="adventure-road-layer" viewBox="0 0 1080 1920" preserveAspectRatio="none" aria-hidden="true">'+
            pair(mainA,false)+pair(safe,true)+pair(bold,true)+pair(mainB,false)+
            '<path class="adventure-road-hidden" d="'+hidden+'"/>'+
        '</svg>';
    }

    function mapNodeButton(node,status,hidden){
        const locked=status==="locked"||status==="hidden";
        if(status==="hidden"){ return ""; }
        const style='style="--node-x:'+Number(node.x||50)+'%;--node-y:'+Number(node.y||50)+'%;"';
        const type=hidden&&status==="hidden-available"?"hidden":node.type;
        const badge=status==="reward-unclaimed"?'<span class="adventure-node-reward-badge">獎</span>':
            status==="objective-ready"?'<span class="adventure-node-ready-badge">✓</span>':"";
        return '<button type="button" data-node-id="'+attr(node.id)+'" class="adventure-node '+nodeTypeClass(type)+' status-'+esc(status)+'" '+style+
            (locked?' disabled aria-disabled="true"':' onclick="FourSymbolsAdventure.openNode(\''+attr(node.id)+'\')"')+
            ' aria-label="'+attr(node.title)+'，'+attr(statusLabel(status))+'">'+
                '<span class="adventure-node-icon">'+esc(nodeGlyph(node.type,status))+'</span>'+badge+
                '<span class="adventure-node-copy"><strong>'+esc(status==="hidden-available"?"未知之處":node.title)+'</strong><small>'+esc(status==="hidden-available"?"靠近查看":node.subtitle||statusLabel(status))+'</small></span>'+
            '</button>';
    }

    function renderMap(view){
        const chapter=view.chapter,state=view.state;
        const mainNodes=chapter.nodes.map(node=>mapNodeButton(node,API().getNodeStatus(node.id),false)).join("");
        const hiddenNodes=(chapter.hiddenNodes||[]).map(node=>mapNodeButton(node,API().getNodeStatus(node.id),true)).join("");
        const branch=chapter.nodes.find(node=>node.type==="branch");
        const selected=branch&&state.branchSelections[branch.branchId];
        const backtrack=state.chapterCompleted?'<div class="adventure-backtrack-ribbon"><b>回溯探索已開放</b><span>可直接補走第一次未選的岔路，不必重跑整章。</span></div>':"";
        return '<section class="adventure-map-screen">'+
            '<div class="adventure-map-caption"><span>第一章 · '+esc(chapter.title)+'</span><b>建議 Lv.'+esc(chapter.suggestedLevel)+'</b></div>'+backtrack+
            '<div class="adventure-map-canvas">'+
                '<div class="adventure-map-depth adventure-map-far" aria-hidden="true"></div>'+
                '<div class="adventure-map-depth adventure-map-mid" aria-hidden="true"></div>'+
                '<div class="adventure-boss-landscape" aria-hidden="true"></div>'+
                mapRoadSvg()+mainNodes+hiddenNodes+
                '<div class="adventure-landmark landmark-village" aria-hidden="true"><i></i><span>村落</span></div>'+
                '<div class="adventure-landmark landmark-bridge" aria-hidden="true"><i></i><span>石橋</span></div>'+
                '<div class="adventure-landmark landmark-fort" aria-hidden="true"><i></i><span>山寨</span></div>'+
                '<div class="adventure-map-fog" aria-hidden="true"></div>'+
                '<div class="adventure-map-depth adventure-map-near" aria-hidden="true"></div>'+
            '</div>'+
            '<footer class="adventure-map-footer">'+
                '<span>首次岔路：'+(selected?esc(selected==="safe"?"林間小徑":"山寨正門"):"尚未選擇")+'</span>'+
                '<span>主線與野怪區分開：推進卡住時，可先回野怪區養成。</span>'+
            '</footer>'+
        '</section>';
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
        const node=currentPanelNode(view,"objective")||view.chapter.nodes.find(n=>n.type==="objective");
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
        const node=view.chapter.nodes.find(n=>view.state.rewardClaims[n.id]==="ready"&&(ui.lastFocusNodeId?n.id===ui.lastFocusNodeId:true))||
            view.chapter.nodes.find(n=>view.state.rewardClaims[n.id]==="ready");
        if(!node){ return renderMap(view); }
        ui.lastFocusNodeId=node.id;
        const typeLabel=node.type==="boss"?"Boss 首通獎勵":node.type==="elite"?"精英首通獎勵":"節點首通獎勵";
        const actions='<button type="button" class="adventure-button primary attention" onclick="FourSymbolsAdventure.claimNodeReward(\''+attr(node.id)+'\')">領取首通獎勵</button>'+
            '<button type="button" class="adventure-button secondary" onclick="FourSymbolsAdventure.setPanel(\'map\')">稍後領取</button>';
        return panelShell(node.title,typeLabel,'<div class="adventure-reward-seal">賞</div><p class="adventure-lead">首通獎勵只能領一次；之後可以重新挑戰，但不會重複取得主線首通獎勵。</p>',actions,"reward-panel");
    }

    function renderChapterComplete(view){
        const claimed=view.state.chapterRewardClaimed;
        const body='<div class="adventure-chapter-seal">章</div><h3>'+esc(view.chapter.title)+' · 完成</h3>'+
            '<p>山路重新通行。你現在可以直接回到岔路，補走第一次沒有選的路線，不必從第一節重打。</p>'+
            '<div class="adventure-result-box"><b>回溯探索</b><span>另一條岔路的節點仍可取得它自己的首次獎勵。</span></div>';
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
        const title=root.querySelector("#adventureHeaderTitle"),meta=root.querySelector("#adventureHeaderMeta");
        if(title){ title.textContent=view.chapter.title; }
        if(meta){ meta.innerHTML='<span>建議 Lv.'+esc(view.chapter.suggestedLevel)+'</span><span>主線章節</span>'; }
        if(ui.body){ ui.body.innerHTML=renderPanel(view); }
        syncTracker(view);
    }

    function show(options){
        const root=ensureRoot();
        if(!root){ return; }
        const opts=options||{};
        if(opts.focusNodeId){ ui.lastFocusNodeId=opts.focusNodeId; }
        root.hidden=false;
        root.classList.add("is-visible");
        render();
    }
    function hide(){
        const root=ensureRoot();
        if(!root){ return; }
        root.classList.remove("is-visible");
        root.hidden=true;
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

    window.FourSymbolsAdventureUI=Object.freeze({show:show,hide:hide,render:render,syncTracker:syncTracker});

    if(typeof document!=="undefined"){
        const ready=function(){ ensureRoot();ensureTracker();syncTracker(); };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",ready,{once:true}); }
        else{ ready(); }
        document.addEventListener("four-symbols:adventure-state-change",()=>{ render();syncTracker(); });
    }
})();
