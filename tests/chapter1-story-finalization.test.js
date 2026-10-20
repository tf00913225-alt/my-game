"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");

// Load the live data Owner. Legacy branching tests use their own explicit
// fixture; they cannot stand in for the released Chapter 1 graph.
function content(){
    const context={window:null};context.window=context;vm.createContext(context);
    vm.runInContext(fs.readFileSync("js/adventure/adventure-content-v1-20260915.js","utf8"),context);
    return context.FourSymbolsAdventureContent;
}
const nodeIds=Array.from({length:20},(_,i)=>"c1_"+String(i+1).padStart(2,"0"));
const titles=["山前初戰","山道惡徒","追兵","寨外守衛","受困旅人","村民求援","山道巡哨","荒驛舊箱","落雁驛","黑松斥候",
    "寨下石橋","石橋伏兵","旅途整備","寨外側門","斷嶺哨所","寨前情報","寨門攻防","寨中頭目","寨主現身","黑松寨主"];

test("live Chapter 1 contains twenty playable story nodes in the prescribed single route",()=>{
    const chapter=content().chapters.chapter_v1;
    assert.equal(chapter.storySchemaVersion,2);
    assert.equal(chapter.startNodeId,nodeIds[0]);assert.equal(chapter.endNodeId,nodeIds.at(-1));
    assert.equal(chapter.nodes.length,20);assert.equal(new Set(chapter.nodes.map(n=>n.id)).size,20);
    assert.deepEqual(Array.from(chapter.nodes,n=>n.id),nodeIds);
    assert.deepEqual(Array.from(chapter.nodes,n=>n.title),titles);
    for(let i=0;i<chapter.nodes.length;i++){
        const node=chapter.nodes[i];assert.notEqual(node.availability,"planned");assert.notEqual(node.type,"branch");
        assert.equal(node.next||null,nodeIds[i+1]||null,"only the next canonical stage is reachable from "+node.id);
    }
});

test("Chapter 1 formal combat, rest and chest placement follows the authored pacing",()=>{
    const nodes=content().chapters.chapter_v1.nodes,byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
    for(const index of [1,2,3,4,5,7,10,12,17])assert.equal(byId[nodeIds[index-1]].type,"battle");
    assert.equal(byId.c1_08.type,"chest");assert.equal(byId.c1_09.type,"rest");
    assert.equal(byId.c1_15.type,"elite");assert.equal(byId.c1_18.type,"elite");assert.equal(byId.c1_20.type,"boss");
});

test('map geometry audit rejects complete text ranges cut by a narrower overflow ancestor',()=>{
    const source=fs.readFileSync('.github/scripts/run-adventure-browser-qa.mjs','utf8'),start=source.indexOf('function overflowClips('),end=source.indexOf('\nfunction measure(',start);
    assert.ok(start>=0&&end>start);const context={getComputedStyle:node=>node.style};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
    const node=(id,width,overflow,parentElement)=>({id,parentElement,style:{overflowX:overflow,overflowY:overflow},getBoundingClientRect:()=>({left:0,top:0,right:width,bottom:200})});
    const canvas=node('map',420,'hidden',null),button=node('button',54,'hidden',canvas),label=node('label',105,'visible',button),fullText={left:0,right:105,top:20,bottom:38};
    const clipped=context.overflowClips(label,[fullText]);assert.equal(clipped.length,1);assert.equal(clipped[0].ancestor,'button');
    button.style={overflowX:'visible',overflowY:'visible'};assert.equal(context.overflowClips(label,[fullText]).length,0);
    assert.equal(context.overflowClips(label,[{...fullText,right:425}])[0].ancestor,'map','overflow-visible labels still cannot escape the real canvas');
});

test("canonical Hero qualification seals the same twenty-node Chapter 1 route",()=>{
    const policy=JSON.parse(fs.readFileSync("functions/src/generated/hero-chapter-qualification.json","utf8"));
    assert.equal(policy.chapterId,"chapter_v1");assert.equal(policy.outcomeVerified,false);
    assert.equal(policy.startNodeId,nodeIds[0]);assert.equal(policy.endNodeId,nodeIds.at(-1));
    assert.deepEqual(policy.nodes.map(n=>n.id),nodeIds);
    for(let i=0;i<policy.nodes.length;i++)assert.equal(policy.nodes[i].next||null,nodeIds[i+1]||null);
});

// Unit boundary: production Adventure Owner, explicit simulated battle callback.
// These tests verify state transitions and never claim real combat coverage.
function runtime(saved,initialSave=true){
    let callback,saveMode=initialSave,stored,roster,options,launches=0,skillEvent;
    const potionCounts={hpPotion10:3,spPotion10:3};
    const player={id:"QA",element:"fire",level:1,hp:100,sp:40,adventureProgress:saved||{schemaVersion:3,pendingStoryOpening:true,activeChapterId:"chapter_v1",chapters:{}}};
    const c={window:null,console,Math,Date,Number,String,Boolean,Object,Array,Set,Map,Promise,JSON,
        document:{hidden:false,addEventListener(){},dispatchEvent(){},getElementById(){return null;}},CustomEvent:function(){},
        player,player2:null,player3:null,gold:100,sharedExp:0,battleActive:false,inventoryItems:[],
        characterSkillLoadouts:{fire:{skillLevels:{},equippedSkills:[]}},characterEquipment:{fire:{}},
        setTimeout(){},clearTimeout(){},setInterval(){return 1;},clearInterval(){},addEventListener(){},alert(){},
        saveGame(){if(saveMode==="throw")throw Error("save denied");if(!saveMode)return false;stored=JSON.parse(JSON.stringify(player.adventureProgress));return true;},
        updateUI(){},updateGoldDisplay(){},rebuildInventorySlots(){},showPage(){},
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>player,
        getPartyBattleStats:()=>({maxHP:100,maxSP:40,attack:15,magicAttack:10,defense:5}),
        MonsterBalance:{build:spec=>({...spec,hp:50,maxHP:50,sp:0,maxSP:0})},
        getMonsterSkillPoolForLevel:()=>[],getMonsterSkillTierAndChance:()=>({chance:0}),configureBuiltMonster:m=>m,
        FourSymbolsCombatEvents:{subscribe(_name,fn){skillEvent=fn;}},
        FourSymbolsEquipmentFactory:require("../js/equipment-factory"),
        FourSymbolsAccountSave:{getActiveUid:()=>"chapter-qa"},FourSymbolsStartupPolicy:{getUid:()=>"chapter-qa"},
        v132AddItemToInventory(item){c.inventoryItems.push(item);return true;},
        v132RunInventoryTransaction(fn){const before=JSON.parse(JSON.stringify(c.inventoryItems)),potions={...potionCounts};const restore=()=>{c.inventoryItems=before;Object.assign(potionCounts,potions);};try{const ok=fn();if(!ok)restore();return ok;}catch(error){restore();throw error;}},
        getPotionCount:id=>potionCounts[id]||0,addPotionToInventory:(id,n)=>{potionCounts[id]=(potionCounts[id]||0)+n;return true;},
        v132LaunchDungeonBattle(enemies,fn,opts){roster=enemies;callback=fn;options=opts;launches++;c.battleActive=true;return true;}};
    c.window=c;vm.createContext(c);
    for(const path of ["js/adventure/adventure-content-v1-20260915.js","js/adventure/adventure-runtime-v1-20260915.js"])vm.runInContext(fs.readFileSync(path,"utf8"),c);
    return {c,api:c.FourSymbolsAdventure,state:()=>c.player.adventureProgress.chapters.chapter_v1,
        save:value=>{saveMode=value;},stored:()=>structuredClone(stored),roster:()=>roster,options:()=>options,launches:()=>launches,
        finish:result=>{c.battleActive=false;callback({result});},useSkill:()=>skillEvent({actor:player,actualSpent:1}),
        potions:potionCounts,consumePotion:id=>{assert.ok(potionCounts[id]>0);potionCounts[id]--;}};
}
function finishDialogue(h){let guard=30;while(h.state().dialogue&&guard-->0)assert.equal(h.api.advanceDialogue(),true);assert.ok(guard>0);}
function at(h,id){h.state().currentNodeId=id;h.state().onboarding={active:true,phase:"story",nodeId:"c1_01"};}
function installCanonicalInventoryFilter(c){
    const source=fs.readFileSync('js/00-main.js','utf8'),start=source.indexOf('function getFilteredInventoryItems('),end=source.indexOf('\nfunction ',start+1);
    const retired=source.match(/const RETIRED_BACKPACK_POTION_IDS=new Set\(\[[\s\S]*?\]\);/);
    assert.ok(start>=0&&end>start&&retired);vm.runInContext(retired[0]+'\n'+source.slice(start,end),c);
}

function installUi(h){
    const body={innerHTML:"",querySelector:()=>null};
    const root={isConnected:true,dataset:{},classList:{contains:()=>false},querySelector:selector=>selector==="#adventureView"?body:null};
    h.c.document.getElementById=id=>id==="adventurePage"?root:null;
    vm.runInContext(fs.readFileSync("js/adventure/adventure-ui-v1-20260915.js","utf8"),h.c);
    return ()=>body.innerHTML;
}
function formalMapAt(id){
    const h=runtime(),nodes=content().chapters.chapter_v1.nodes,index=nodes.findIndex(n=>n.id===id);
    h.state().currentNodeId=id;h.state().completedNodes=Object.fromEntries(nodes.slice(0,index).map(n=>[n.id,true]));
    h.state().onboarding={active:false,phase:'complete'};h.c.player.adventureProgress.pendingStoryOpening=false;
    if(index>=13)h.state().storyKeys.blackPineToken={sourceNodeId:'c1_11'};
    h.c.v154ResolveMonsterPortraitRecord=()=>({path:'assets/ready-npc.webp'});h.c.getCharacterBattleArtworkPath=()=> 'assets/player.webp';
    const html=installUi(h);assert.equal(h.api.open({panel:'map',focusNodeId:id}),true);return {...h,html};
}

test('every authored dialogue node enters through the map activation with the full UI renderer installed',()=>{
    for(const node of content().chapters.chapter_v1.nodes){
        const h=formalMapAt(node.id);assert.equal(h.api.openNode(node.id),true);
        assert.doesNotThrow(()=>assert.equal(h.api.activateSelectedNode(),true),node.id+' must not render a generic event before its story commit');
        assert.equal(h.api.getView().panel,'story');assert.equal(h.api.getView().dialogue.nodeId,node.id);assert.match(h.html(),/class="adventure-story /);
    }
});

test('map activation save refusal or exception preserves the original map panel and cursor for all dialogue types',()=>{
    for(const id of ['c1_06','c1_09','c1_08','c1_07'])for(const mode of [false,'throw']){
        const h=formalMapAt(id),before=JSON.stringify(h.state()),panel=h.api.getView().panel,cursor=JSON.stringify(h.api.getView().dialogue);
        h.save(mode);assert.equal(h.api.activateSelectedNode(),false,id);
        assert.equal(h.api.getView().panel,panel);assert.equal(JSON.stringify(h.api.getView().dialogue),cursor);assert.equal(JSON.stringify(h.state()),before);assert.equal(h.c.battleActive,false);
        assert.match(h.html(),/adventure-map-screen/);
    }
});

test('story event map activation advances 6 to 7, key 11 to 12 and other authored events once',()=>{
    for(const [id,next] of [['c1_06','c1_07'],['c1_11','c1_12'],['c1_16','c1_17'],['c1_19','c1_20']]){
        const h=formalMapAt(id);assert.equal(h.api.activateSelectedNode(),true);finishDialogue(h);
        assert.equal(h.state().currentNodeId,next);assert.equal(h.api.getView().selectedNodeId,next);assert.equal(h.api.getView().panel,'map');
        const completed=JSON.stringify(h.state().completedNodes),key=JSON.stringify(h.state().storyKeys),gold=h.c.gold;
        if(id==='c1_11')assert.equal(h.state().storyKeys.blackPineToken.sourceNodeId,id);
        assert.equal(h.api.openNode(id),true);assert.equal(h.api.activateSelectedNode(),true);finishDialogue(h);
        assert.equal(h.state().currentNodeId,next);assert.equal(JSON.stringify(h.state().completedNodes),completed);assert.equal(JSON.stringify(h.state().storyKeys),key);assert.equal(h.c.gold,gold);
    }
});

test('map stage14 activation requires the actual stage11 key and its story replay cannot advance twice',()=>{
    const h=formalMapAt('c1_14');delete h.state().storyKeys.blackPineToken;
    assert.equal(h.api.activateSelectedNode(),false);assert.equal(h.api.getView().panel,'map');assert.equal(h.api.getView().dialogue,null);assert.equal(h.state().completedNodes.c1_14,undefined);
    h.state().storyKeys.blackPineToken={sourceNodeId:'c1_11'};assert.equal(h.api.activateSelectedNode(),true);finishDialogue(h);
    assert.equal(h.state().currentNodeId,'c1_15');assert.equal(h.api.getView().selectedNodeId,'c1_15');
    h.api.openNode('c1_14');h.api.activateSelectedNode();finishDialogue(h);assert.equal(h.state().currentNodeId,'c1_15');
});

test('authored rest and chest stories use their real map actions and do not replenish or grant on replay',()=>{
    for(const id of ['c1_09','c1_13']){
        const h=formalMapAt(id);assert.equal(content().chapters.chapter_v1.nodes.find(n=>n.id===id).type,'rest');
        h.api.activateSelectedNode();finishDialogue(h);assert.equal(h.api.getView().panel,'rest');assert.match(h.html(),/restAtNode/);
        h.c.player.hp=1;h.c.player.sp=1;assert.equal(h.api.restAtNode(id),true);const hp=h.c.player.hp,sp=h.c.player.sp,next=h.state().currentNodeId;
        assert.equal(h.api.getView().selectedNodeId,next);assert.equal(h.api.getView().panel,'map');assert.match(h.html(),/adventure-map-screen/);
        assert.equal(h.api.restAtNode(id),false);h.api.openNode(id);h.api.activateSelectedNode();finishDialogue(h);assert.equal(h.state().currentNodeId,next);assert.equal(h.c.player.hp,hp);assert.equal(h.c.player.sp,sp);
    }
    const h=formalMapAt('c1_08');h.c.v132GetOreDefinition=id=>({id,type:'material',name:'白階礦石'});h.api.activateSelectedNode();finishDialogue(h);assert.equal(h.api.getView().panel,'chest');
    assert.equal(h.api.openChest('c1_08'),true);assert.equal(h.state().rewardClaims.c1_08,'ready');assert.equal(h.api.getView().selectedNodeId,'c1_08');
    assert.equal(h.api.claimNodeReward('c1_08'),true);assert.equal(h.state().currentNodeId,'c1_09');assert.equal(h.api.getView().selectedNodeId,'c1_09');
    const gold=h.c.gold,potions={...h.potions};assert.equal(h.api.openChest('c1_08'),false);assert.equal(h.api.claimNodeReward('c1_08'),false);assert.equal(h.c.gold,gold);assert.deepEqual(h.potions,potions);
});

test('later rest rendering chooses selected stage13 instead of the previously visited stage9',()=>{
    const h=formalMapAt('c1_09');h.api.activateSelectedNode();finishDialogue(h);assert.match(h.html(),/restAtNode\('c1_09'\)/);h.api.restAtNode('c1_09');
    h.state().currentNodeId='c1_13';for(const id of ['c1_10','c1_11','c1_12'])h.state().completedNodes[id]=true;
    h.api.openNode('c1_13');h.api.activateSelectedNode();finishDialogue(h);
    assert.match(h.html(),/restAtNode\('c1_13'\)/);assert.doesNotMatch(h.html(),/restAtNode\('c1_09'\)/);
    assert.equal(h.api.restAtNode('c1_13'),true);assert.equal(h.state().currentNodeId,'c1_14');assert.equal(h.api.getView().selectedNodeId,'c1_14');assert.match(h.html(),/adventure-map-screen/);
});

test('refused or throwing rest save cannot heal complete or leave the original selected rest panel',()=>{
    for(const id of ['c1_09','c1_13'])for(const mode of [false,'throw']){
        const h=formalMapAt(id);h.api.activateSelectedNode();finishDialogue(h);h.c.player.hp=1;h.c.player.sp=1;const before=JSON.stringify(h.state());h.save(mode);
        assert.equal(h.api.restAtNode(id),false);assert.equal(h.c.player.hp,1);assert.equal(h.c.player.sp,1);assert.equal(JSON.stringify(h.state()),before);
        assert.equal(h.api.getView().panel,'rest');assert.equal(h.api.getView().selectedNodeId,id);assert.match(h.html(),new RegExp("restAtNode\\('"+id+"'\\)"));
    }
});

test("first victory exposes its reward then a successful claim selects the next fixed-sheet action",()=>{
    const h=runtime(),html=installUi(h);
    assert.equal(h.api.startFreshStory(),true);finishDialogue(h);h.finish("win");
    assert.equal(h.api.getView().panel,"node-reward");
    assert.equal(h.api.getView().selectedNodeId,"c1_01");
    assert.equal(h.state().currentNodeId,"c1_02");
    assert.match(html(),/claimNodeReward\('c1_01'\)/);
    assert.match(html(),/領取首通獎勵/);
    assert.equal(h.api.claimNodeReward("c1_01"),true);
    assert.equal(h.api.getView().panel,"map");assert.equal(h.api.getView().selectedNodeId,"c1_02");
    assert.equal(h.state().rewardClaims.c1_01,"claimed");
    assert.equal((html().match(/data-stage-id=/g)||[]).length,20);
    assert.match(html(),/id="adventureStagePicker"/);assert.doesNotMatch(html(),/<select\b/);
    assert.match(html(),/data-stage-id="c1_02" onclick="FourSymbolsAdventure.openNode\('c1_02'\)"/);assert.match(html(),/data-stage-id="c1_03" disabled/);
    assert.doesNotMatch(html(),/adventure-map-viewport/);assert.match(html(),/class="adventure-stage-list" data-scroll-owner="y"/);
    assert.match(html(),/onclick="FourSymbolsAdventure.activateSelectedNode\(\)"[^>]*>進入/);
    assert.doesNotMatch(html(),/class="adventure-node[^>]*onclick="FourSymbolsAdventure.beginBattle/);
    const gold=h.c.gold,exp=h.c.sharedExp;
    assert.equal(h.api.claimNodeReward("c1_01"),false);assert.equal(h.c.gold,gold);assert.equal(h.c.sharedExp,exp);
    assert.equal(h.api.activateSelectedNode(),true);assert.equal(h.api.getView().dialogue.nodeId,"c1_02");
});

test("refused first reward save keeps the reward action and cannot select the next sheet",()=>{
    const h=runtime(),html=installUi(h);h.api.startFreshStory();finishDialogue(h);h.finish("win");
    const gold=h.c.gold,exp=h.c.sharedExp;h.save(false);
    assert.equal(h.api.claimNodeReward("c1_01"),false);
    assert.equal(h.state().rewardClaims.c1_01,"ready");assert.equal(h.api.getView().panel,"node-reward");
    assert.equal(h.api.getView().selectedNodeId,"c1_01");assert.equal(h.c.gold,gold);assert.equal(h.c.sharedExp,exp);
    assert.match(html(),/claimNodeReward\('c1_01'\)/);
});

test("pending story portrait requests once and rerenders the same cursor when the registry becomes ready",async()=>{
    const h=runtime();let ready=false,calls=0,resolve;
    h.c.getCharacterBattleArtworkPath=()=>"assets/player.webp";
    h.c.v154ResolveMonsterPortraitRecord=()=>ready?{path:"assets/monsters/shared/npc-shared-029.webp"}:null;
    h.c.v154RequestMonsterPortraitRegistry=()=>{calls++;return new Promise(done=>{resolve=done;});};
    const html=installUi(h);assert.equal(h.api.startFreshStory(),true);
    const cursor=JSON.stringify(h.api.getView().dialogue),stored=JSON.stringify(h.stored());
    assert.equal(calls,1);assert.match(html(),/人物載入中/);
    assert.doesNotMatch(html(),/class="adventure-story-npc/);assert.match(html(),/disabled onclick="FourSymbolsAdventure.advanceDialogue/);
    h.c.FourSymbolsAdventureUI.render();assert.equal(calls,1,"rerender cannot duplicate a pending registry request");
    ready=true;resolve({});await new Promise(setImmediate);
    assert.match(html(),/class="adventure-story-npc[^>]*src="assets\/monsters\/shared\/npc-shared-029.webp"/);
    assert.doesNotMatch(html(),/disabled onclick="FourSymbolsAdventure.advanceDialogue/);
    assert.equal(JSON.stringify(h.api.getView().dialogue),cursor);assert.equal(JSON.stringify(h.stored()),stored,"portrait readiness does not save or advance gameplay");
});

test("failed story portrait exposes a presentation retry and its success never advances the dialogue",async()=>{
    const h=runtime();let ready=false,calls=0,reject,resolve;
    h.c.getCharacterBattleArtworkPath=()=>"assets/player.webp";
    h.c.v154ResolveMonsterPortraitRecord=()=>ready?{path:"assets/retried-npc.webp"}:null;
    h.c.v154RequestMonsterPortraitRegistry=()=>{calls++;return new Promise((done,fail)=>{resolve=done;reject=fail;});};
    const html=installUi(h);h.api.startFreshStory();const cursor=JSON.stringify(h.api.getView().dialogue);
    reject(Error("registry unavailable"));await new Promise(setImmediate);
    assert.equal(calls,1);assert.match(html(),/data-story-portrait-retry/);assert.match(html(),/人物載入未完成/);
    assert.doesNotMatch(html(),/class="adventure-story-npc/);assert.match(html(),/disabled onclick="FourSymbolsAdventure.advanceDialogue/);
    h.c.FourSymbolsAdventureUI.retryStoryPortrait();assert.equal(calls,2);assert.match(html(),/人物載入中/);
    ready=true;resolve({});await new Promise(setImmediate);
    assert.match(html(),/src="assets\/retried-npc.webp"/);assert.doesNotMatch(html(),/data-story-portrait-retry/);
    assert.equal(JSON.stringify(h.api.getView().dialogue),cursor);
});

function guideHarness(){
    const listeners=new Map(),frames=[],targets=new Map(),children=new Map();let acquired=0,released=0,overlay;
    const element=()=>{const classes=new Set();return {disabled:false,style:{},classList:{contains:name=>classes.has(name),toggle(name,force){const enabled=force===undefined?!classes.has(name):!!force;if(enabled)classes.add(name);else classes.delete(name);return enabled;}},getBoundingClientRect:()=>({left:20,top:100,right:100,bottom:140,width:80,height:40}),scrollIntoView(){},contains(other){return other===this||other?.parent===this;}};};
    const child=selector=>{if(!children.has(selector)){const node=element();node.hidden=false;node.textContent='';node.querySelector=s=>child(selector+' '+s);children.set(selector,node);}return children.get(selector);};
    const host={...element(),clientWidth:1080,clientHeight:1920,appendChild(child){overlay=child;}};
    const view={tutorial:{active:true,battleNodeId:"c1_01"},tutorialProgress:{},chapter:{nodes:[{id:"c1_01",stage:1}]},state:{rewardClaims:{}},panel:"map"};
    const c={window:null,console,Math,Object,Array,Set,Map,String,Number,Boolean,
        battleActive:true,battlePhase:"declare",actionReady:false,pendingAction:null,
        FourSymbolsAdventure:{getView:()=>view},
        FourSymbolsBattleFlow:{acquireInputGuideHold(){acquired++;return ()=>{released++;};}},
        CSS:{escape:value=>value},getComputedStyle:()=>({visibility:"visible"}),
        requestAnimationFrame(fn){frames.push(fn);return frames.length;},addEventListener(){},
        document:{readyState:"loading",addEventListener(type,fn,capture){if(capture)listeners.set(type,fn);},
            querySelectorAll:selector=>targets.get(selector)||[],
            getElementById:id=>id==="game-ui"?host:null,
            createElement(){return {...element(),querySelector:child};}}};
    c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/adventure/adventure-ui-v1-20260915.js","utf8"),c);
    let timestamp=0;
    return {c,view,element,targets,children,overlay:()=>overlay,holds:()=>({acquired,released}),frame(){assert.ok(frames.length);timestamp+=100;frames.shift()(timestamp);},
        dispatch(type,target,key){const event={type,target,key,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners.get(type)(event);if(!event.stopped){target.action?.();target.onclick?.();}return event;}};
}

test('recovery guide chooses stocked SP when HP has a deficit but no HP potion',()=>{
    const h=guideHarness(),page=h.element(),tab=h.element(),sp=h.element(),hp=h.element(),wrongTab=h.element();
    h.c.battleActive=false;h.c.player={hp:30,sp:10};h.c.inventoryItems=[{id:'spPotion10',type:'potion',count:2}];h.c.inventoryFilter='function';installCanonicalInventoryFilter(h.c);
    h.c.getPotionCount=id=>h.c.inventoryItems.filter(i=>i.id===id).reduce((n,i)=>n+i.count,0);
    assert.equal(h.c.getFilteredInventoryItems().length,0,'the original function category has no potions');
    h.view.tutorial.requiredAction='recovery';h.view.tutorialProgress.resources={maxHP:100,maxSP:40};tab.getAttribute=()=>h.c.inventoryFilter==='item'?'true':'false';tab.action=()=>{h.c.inventoryFilter='item';};
    h.targets.set('#inventoryPage.active',[page]);h.targets.set('#inventoryCategoryTabs [data-filter="item"]',[tab]);
    const query=h.c.document.querySelectorAll;h.c.document.querySelectorAll=selector=>selector==='#inventoryGrid [data-item-id="spPotion10"]'?(h.c.getFilteredInventoryItems().some(i=>i.id==='spPotion10')?[sp]:[]):query(selector);
    h.frame();assert.equal(h.dispatch('click',wrongTab).stopped,true);assert.equal(h.dispatch('click',sp).stopped,true);assert.equal(h.dispatch('click',tab).stopped,false);
    assert.equal(h.c.getFilteredInventoryItems()[0].id,'spPotion10','the original item category exposes the stocked potion');
    h.frame();assert.equal(h.dispatch('click',sp).stopped,false);assert.equal(h.dispatch('click',hp).stopped,true);
    assert.equal(h.children.get('.adventure-guide-recovery').hidden,true);
});

test('the default potion shop requires the original equipment tab click before the lesson purchase',()=>{
    const h=guideHarness(),modal=h.element(),tab=h.element(),offer=h.element();let tabs=0,bought=0;
    h.c.battleActive=false;h.view.tutorial.requiredAction='equipment';h.view.tutorialProgress.equipmentNeedsPurchase=true;
    h.targets.set('#homeFeatureModal.show',[modal]);h.targets.set('#homeFeatureModal [onclick="v169SwitchShopPage(\'equipment\')"]',[tab]);
    tab.action=()=>{tabs++;h.targets.set('#homeFeatureModal.show .v17345-equipment-shop',[h.element()]);};offer.action=()=>{bought++;};
    h.targets.set('#chapter1TutorialArmorBuy',[offer]);h.frame();assert.equal(tabs,0);assert.equal(bought,0,'guide does not switch tabs or purchase automatically');
    assert.equal(h.dispatch('click',offer).stopped,true);assert.equal(h.dispatch('click',tab).stopped,false);assert.equal(tabs,1);
    h.frame();assert.equal(h.dispatch('click',tab).stopped,true);assert.equal(h.dispatch('click',offer).stopped,false);assert.equal(bought,1);
});

test('pending battle potion permits the original ally target and blocks an enemy target',()=>{
    const h=guideHarness(),ally=h.element(),enemy=h.element();let used=0;
    h.c.pendingAction='__v143PotionTarget';h.c.actionReady=true;ally.action=()=>{used++;h.c.pendingAction=null;};
    h.targets.set('#battlePlayerRow .ally-targetable',[ally]);h.targets.set('#battleMonsterArea [id^="battleMonster"]',[enemy]);
    h.frame();assert.equal(h.dispatch('click',enemy).stopped,true);assert.equal(h.dispatch('click',ally).stopped,false);assert.equal(used,1);
});

test('missing non-waiting target exposes a real recovery action while resolving combat cannot skip',()=>{
    const h=guideHarness();let returned=0;h.c.battleActive=false;h.view.tutorial.requiredAction='skill';h.c.FourSymbolsAdventure.returnFromTutorial=()=>{returned++;};
    h.frame();const fallback=h.children.get('.adventure-guide-recovery'),button=h.children.get('.adventure-guide-recovery button');
    assert.equal(fallback.hidden,false);assert.equal(h.dispatch('click',button).stopped,false);assert.equal(returned,1);
    h.c.battleActive=true;h.c.battlePhase='resolve';h.frame();assert.equal(fallback.hidden,true);
    assert.equal(h.dispatch('click',button).stopped,true);assert.equal(returned,1);
});

test('zero-gold zero-potion recovery receives existing supplies once before practice and preserves its baseline on reload',()=>{
    const h=runtime();h.c.gold=0;h.potions.hpPotion10=0;h.potions.spPotion10=0;at(h,'c1_05');h.api.startStory('c1_05');finishDialogue(h);
    assert.equal(h.state().rewardClaims.c1_05,'ready');assert.equal(h.api.confirmPreparation(),false);
    assert.equal(h.api.claimNodeReward('c1_05'),true);assert.deepEqual({...h.state().onboarding.preparation},{hpCount:2,spCount:2});
    assert.equal(h.potions.hpPotion10,2);assert.equal(h.potions.spPotion10,2);assert.equal(h.api.claimNodeReward('c1_05'),false);
    const saved=h.stored(),reloaded=runtime(saved);Object.assign(reloaded.potions,{hpPotion10:2,spPotion10:1});
    reloaded.api.startStory('c1_05');finishDialogue(reloaded);assert.deepEqual({...reloaded.state().onboarding.preparation},{hpCount:2,spCount:2});
    assert.equal(reloaded.api.confirmPreparation(),true);assert.equal(reloaded.api.continueTutorial(),true);reloaded.finish('win');
    assert.equal(reloaded.state().rewardClaims.c1_05,'claimed');assert.equal(reloaded.potions.spPotion10,1);assert.equal(reloaded.api.claimNodeReward('c1_05'),false);
});

test('recovery supply save refusal or throw rolls back receipt baseline resources and inventory atomically',()=>{
    for(const mode of [false,'throw']){
        const h=runtime();h.c.gold=0;h.potions.hpPotion10=0;h.potions.spPotion10=0;at(h,'c1_05');h.api.startStory('c1_05');finishDialogue(h);
        const before=JSON.stringify(h.state());h.save(mode);assert.equal(h.api.claimNodeReward('c1_05'),false);
        assert.equal(JSON.stringify(h.state()),before);assert.equal(h.potions.hpPotion10,0);assert.equal(h.potions.spPotion10,0);assert.equal(h.c.gold,0);
    }
});

test('the final loaded v141 renderer marks exact item identity and its read-only locator agrees with real paging',()=>{
    let opened=null,children=[];const label={textContent:''};
    const grid={set innerHTML(_value){children=[];},appendChild:node=>children.push(node)};
    const element=()=>({dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},querySelector:()=>null});
    const c={window:null,console,Math,Number,String,Array,Object,Set,Map,Date,JSON,
        FourSymbolsAccountSave:{accountKey:key=>'test:'+key},FourSymbolsItemSlot:{apply(){},neutralizeArt(){}},
        inventoryItems:Array.from({length:30},(_,i)=>({id:'armor-'+i,v141Uid:'gear-'+i,type:'armor',name:'護具'+i,count:1})),inventoryFilter:'equipment',
        renderInventoryItems(){throw Error('early renderer must be replaced');},rebuildInventorySlots(){},getInventoryRarityKey:()=> 'white',
        openItemModal:index=>{opened=index;},setInventoryFilter:filter=>{c.inventoryFilter=filter;c.renderInventoryItems();},setTimeout(){},clearTimeout(){},addEventListener(){},
        document:{readyState:'loading',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>id==='inventoryGrid'?grid:id==='v141InventoryPageLabel'?label:null,createElement:element}};
    c.window=c;c.inventorySlots=c.inventoryItems;
    vm.createContext(c);installCanonicalInventoryFilter(c);vm.runInContext(fs.readFileSync('js/35-v141-ui-battle.js','utf8'),c);
    c.renderInventoryItems();assert.equal(children.length,24);assert.equal(children[0].dataset.itemId,'armor-0');assert.equal(children[0].dataset.itemUid,'gear-0');
    assert.deepEqual({...c.v141LocateInventoryItem({uid:'gear-26'})},{page:1,currentPage:0,direction:1});assert.equal(label.textContent,'1 / 5');
    c.v141LocateInventoryItem({uid:'gear-26'});assert.equal(label.textContent,'1 / 5','location does not change the page');
    c.v141ChangeInventoryPage(1);assert.equal(label.textContent,'2 / 5');assert.equal(children[2].dataset.itemUid,'gear-26');
    assert.deepEqual({...c.v141LocateInventoryItem({uid:'gear-26'})},{page:1,currentPage:1,direction:0});children[2].onclick();assert.equal(opened,26);
    c.inventoryItems=[{id:'hpPotion10',type:'potion',name:'回春散',count:2}];c.inventorySlots=c.inventoryItems;
    c.setInventoryFilter('function');assert.equal(c.getFilteredInventoryItems().length,0);assert.equal(c.v141LocateInventoryItem({id:'hpPotion10'}),null);
    assert.ok(children.every(child=>!child.dataset.itemId));c.setInventoryFilter('item');assert.equal(children[0].dataset.itemId,'hpPotion10');assert.equal(label.textContent,'1 / 5');
});

test("guide capture requires the real attack then target and releases locks when onboarding ends",()=>{
    const h=guideHarness(),attack=h.element(),enemy=h.element(),unrelated=h.element();let attacks=0,selected=0,other=0;
    attack.action=()=>{attacks++;h.c.pendingAction="normal";h.c.actionReady=true;};enemy.action=()=>{selected++;h.c.pendingAction=null;h.c.battlePhase="resolve";};unrelated.action=()=>{other++;};
    h.targets.set('#mainBattleMenu button[onclick*="normal"]',[attack]);h.targets.set('#battleMonsterArea [id^="battleMonster"]',[enemy]);
    h.frame();assert.equal(h.overlay().hidden,false);assert.equal(attacks,0,'guide never executes the highlighted action');
    assert.equal(h.children.get('.adventure-guide-ring').hidden,false);assert.deepEqual(h.holds(),{acquired:1,released:0});
    for(const type of ["pointerdown","click"]){assert.equal(h.dispatch(type,unrelated).stopped,true);}
    assert.equal(h.dispatch("keydown",unrelated,"Escape").prevented,true,'no dismiss/skip confirmation can bypass the guide');assert.equal(other,0);
    assert.equal(h.dispatch("click",attack).stopped,false);assert.equal(attacks,1);
    h.frame();assert.equal(h.dispatch("click",attack).stopped,true,'actionReady must still highlight the pending enemy target');
    assert.equal(h.dispatch("click",enemy).stopped,false);assert.equal(selected,1);
    h.frame();assert.equal(h.children.get('.adventure-guide-ring').hidden,true);assert.equal(h.dispatch("click",unrelated).stopped,true,'resolution cannot be skipped');
    h.view.tutorial.active=false;h.frame();assert.equal(h.overlay().hidden,true);assert.deepEqual(h.holds(),{acquired:1,released:1});
    assert.equal(h.dispatch("click",unrelated).stopped,false);assert.equal(other,1,'normal input is restored after onboarding');
    h.frame();assert.deepEqual(h.holds(),{acquired:1,released:1},'release executes once');
});

test('tutorial return button opts into pointer input under the original noninteractive UI host',()=>{
    const main=fs.readFileSync('css/00-main.css','utf8'),css=fs.readFileSync('css/adventure-v1-20260915.css','utf8');
    assert.match(main.match(/#game-ui\{[\s\S]*?\}/)[0],/pointer-events\s*:\s*none/);
    const rule=css.match(/\.adventure-tutorial-return\{([^}]+)\}/);assert.ok(rule);
    assert.match(rule[1],/pointer-events\s*:\s*auto\s*;/,'original floating return control must receive real pointer input');
});

test('pointer fixture preserves the generated armor offer price expression and refuses missing prices',()=>{
    const source=fs.readFileSync('tests/fixtures/run-chapter1-guided-pointer-qa.mjs','utf8');
    const literal=source.match(/const offer=target\.id==='chapter1TutorialArmorBuy'\?await client\.eval\((String\.raw`[^`]+`)\)/);assert.ok(literal);
    const expression=vm.runInNewContext(literal[1]);new vm.Script(expression);
    const evaluate=text=>vm.runInNewContext(expression,{document:{getElementById:id=>{assert.equal(id,'chapter1TutorialArmorBuy');return {textContent:text,closest:selector=>{assert.equal(selector,'[data-tutorial-offer]');return {querySelector:selector=>{assert.equal(selector,'.v17346-shop-name');return {textContent:' 蒼雷戰甲 '};}};}};}}});
    for(const [label,price] of [['購買護具 · 750 金幣',750],['購買護具 · 1,250 金幣',1250]]){const offer=evaluate(label);assert.equal(offer.cost,price);assert.equal(offer.name,'蒼雷戰甲');}
    assert.throws(()=>evaluate('購買護具'),/formal armor offer price missing/);
});

test('pointer creation waits for actual original input hit ownership after startup authority is ready',()=>{
    const source=fs.readFileSync('tests/fixtures/run-chapter1-guided-pointer-qa.mjs','utf8');
    const match=source.match(/await wait\(`([^`]+)`,'original creation input receives pointer after startup presentation'\)/);assert.ok(match);
    const expression=vm.runInNewContext('`'+match[1]+'`');new vm.Script(expression);
    let hit,disabled=false,visibility='visible';const input={get disabled(){return disabled;},getBoundingClientRect:()=>({x:10,y:20,width:100,height:40}),contains:node=>node===input};
    const context={document:{getElementById:id=>{assert.equal(id,'creationId');return input;},elementFromPoint:()=>hit},getComputedStyle:()=>({visibility,display:'block'}),innerWidth:393,innerHeight:873};
    hit={id:'startupLoader'};assert.equal(vm.runInNewContext(expression,context),false,'canCreate does not bypass a painted startup blocker');
    hit=input;assert.equal(vm.runInNewContext(expression,context),true,'original center hit admits the later strict pointer tap');
    disabled=true;assert.equal(vm.runInNewContext(expression,context),false);disabled=false;visibility='hidden';assert.equal(vm.runInNewContext(expression,context),false);
    assert.ok(source.indexOf("'fresh creation ready'")<source.indexOf(match[0]));assert.ok(source.indexOf(match[0])<source.indexOf("await tap('#creationId')"));
});

test('pointer acknowledgement excludes the original hidden cancel without accepting return or confirmations',()=>{
    const fixture=fs.readFileSync('tests/fixtures/run-chapter1-guided-pointer-qa.mjs','utf8'),owner=fs.readFileSync('js/51-v169-rpg-ui.js','utf8');
    assert.match(owner,/cancelButton\.hidden=activeDialog\.kind!=="confirm"/);
    const block=fixture.slice(fixture.indexOf('const dismiss=async()=>'),fixture.indexOf('const reveal=async selector=>'));
    const selector=block.match(/const selector='([^']+)'/)[1];assert.equal(selector,'.v169-rpg-dialog-layer.show .v169-rpg-dialog-actions button:not([hidden])');
    const expression=block.match(/assert\.match\(text,(\/[^/]+\/),'only a visible ordinary acknowledgement/)[1],ack=vm.runInNewContext(expression);
    const buttons=[{hidden:true,textContent:'返回'},{hidden:false,textContent:'知道了'}],selected=buttons.find(button=>!selector.includes(':not([hidden])')||!button.hidden);
    assert.equal(selected.textContent,'知道了');assert.equal(ack.test(selected.textContent),true);assert.equal(ack.test('返回'),false);
    assert.match(block,/v169GetRpgDialogState\(\)\.active/);assert.match(block,/'alert','only original alert acknowledgements/);assert.match(block,/await tap\(selector\)/,'original strict visible hit-test tap remains required');
});

test('pointer scroll readiness requires stable owner and target samples before a single original tap',()=>{
    const source=fs.readFileSync('tests/fixtures/run-chapter1-guided-pointer-qa.mjs','utf8'),fn=source.match(/function stableScrollSample\(previous,sample,now\)\{[\s\S]*?\n\}/);assert.ok(fn);
    const context={};vm.createContext(context);vm.runInContext(fn[0],context);
    const sample={valid:true,scrollTop:400,scrollLeft:0,left:10,top:100,width:100,height:52};let state;
    for(const now of [0,80,160]){state=context.stableScrollSample(state,sample,now);assert.equal(state.ready,false);}
    state=context.stableScrollSample(state,sample,240);assert.equal(state.ready,true);
    for(const change of [{scrollTop:405},{top:105},{valid:false,disabled:true},{valid:false,hit:{id:'occluding-overlay'}}])assert.equal(context.stableScrollSample(state,{...sample,...change},320).ready,false);
    let overshoot;for(const now of [0,80,160,240])overshoot=context.stableScrollSample(overshoot,{...sample,valid:false,top:-100},now);
    assert.equal(overshoot.settled,true,'an idle overshoot is settled even though it cannot be clicked');assert.equal(overshoot.ready,false,'settled outside target must resume physical adjustments');
    let recovered=context.stableScrollSample(overshoot,sample,320);assert.equal(recovered.ready,false,'new visible geometry must settle again');
    for(const now of [400,480,560])recovered=context.stableScrollSample(recovered,sample,now);assert.equal(recovered.ready,true);
    assert.match(source,/if\(stable\?\.settled\)continue;/,'settled invalid target resumes bounded outer scroll loop with fresh geometry');
    const reveal=source.slice(source.indexOf('const reveal=async selector=>'),source.indexOf("await wait('window.FourSymbolsStartupPolicy"));
    assert.match(reveal,/type:'touchMove'/);assert.match(reveal,/setTimeout\(resolve,40\)/);assert.match(reveal,/i<16/);assert.match(reveal,/Date\.now\(\)\+45000/);
    assert.doesNotMatch(reveal,/\.scrollTop\s*=(?!=)|\.click\s*\(|FourSymbolsAdventure\./,'scroll reachability uses original physical input and observations only');
    assert.match(source,/!e\.disabled&&e\.checkVisibility/);assert.match(source,/hit===e\|\|e\.contains\(hit\)/);assert.match(source,/original scroll target never became stable and pointer ready/);
});

test("story reading guide keeps the real Next target and toggles reading presentation without an acknowledgement step",()=>{
    const h=guideHarness(),story=h.element(),next=h.element(),other=h.element();let advances=0;
    h.c.battleActive=false;next.action=()=>{advances++;};
    h.targets.set('#adventurePage.active[data-panel="story"]',[story]);
    h.targets.set('#adventurePage [data-story-portrait-retry],#adventurePage [onclick*="advanceDialogue"]',[next]);
    h.frame();assert.equal(h.overlay().classList.contains('is-reading'),true);
    assert.equal(advances,0);assert.equal(h.dispatch('click',other).stopped,true);
    assert.equal(h.dispatch('click',next).stopped,false);assert.equal(advances,1,'the existing story Next advances directly');
    h.targets.delete('#adventurePage.active[data-panel="story"]');
    h.targets.set('#adventurePage .adventure-button.primary',[other]);
    h.frame();assert.equal(h.overlay().classList.contains('is-reading'),false,'leaving story restores the normal guide presentation');
});

test("visible account or startup owner suspends guide capture until the game is ready again",()=>{
    const h=guideHarness(),auth=h.element(),attack=h.element(),login=h.element();let entered=0;
    login.action=()=>{entered++;};h.targets.set('#mainBattleMenu button[onclick*="normal"]',[attack]);
    h.targets.set('#firebaseAuthOverlay,#startupLoader,#homeFeatureModal.release-update-forced.show',[auth]);h.frame();
    assert.equal(h.overlay(),undefined,'no gameplay overlay is created over login');
    assert.equal(h.dispatch('click',login).stopped,false);assert.equal(entered,1);
    assert.deepEqual(h.holds(),{acquired:0,released:0});
    h.targets.delete('#firebaseAuthOverlay,#startupLoader,#homeFeatureModal.release-update-forced.show');h.frame();
    assert.equal(h.overlay().hidden,false);assert.equal(h.dispatch('click',login).stopped,true,'normal guide resumes after login');
    assert.equal(h.dispatch('click',attack).stopped,false);assert.deepEqual(h.holds(),{acquired:1,released:0});
    h.targets.set('#firebaseAuthOverlay,#startupLoader,#homeFeatureModal.release-update-forced.show',[h.element()]);h.frame();
    assert.equal(h.overlay().hidden,true,'startup owner can regain presentation without a stale guide');
    assert.equal(h.dispatch('click',login).stopped,false);assert.equal(entered,2);
    assert.deepEqual(h.holds(),{acquired:1,released:1});
});

test('forced release update keeps its own input and visibility while the tutorial guide is suspended',()=>{
    const h=guideHarness(),forced=h.element(),update=h.element(),attack=h.element();let updates=0;forced.visible=true;update.action=()=>{updates++;};
    h.targets.set('#mainBattleMenu button[onclick*="normal"]',[attack]);
    h.targets.set('#firebaseAuthOverlay,#startupLoader,#homeFeatureModal.release-update-forced.show',[forced]);h.frame();
    assert.equal(h.overlay(),undefined);assert.equal(updates,0);assert.equal(forced.visible,true,'guide never hides or acknowledges a forced release');
    assert.equal(h.dispatch('click',update).stopped,false);assert.equal(updates,1);
    h.targets.delete('#firebaseAuthOverlay,#startupLoader,#homeFeatureModal.release-update-forced.show');h.frame();
    assert.equal(h.overlay().hidden,false);assert.equal(h.dispatch('click',update).stopped,true);assert.equal(h.dispatch('click',attack).stopped,false);
});

test("tutorial defeat requires learned equipped skill and equipped starter armor before same-node retry",()=>{
    for(const [id,action] of [["c1_02","skill"],["c1_04","equipment"]]){
        const h=runtime();at(h,id);assert.equal(h.api.beginBattle(id),true);assert.equal(h.options().tutorial,true);
        h.finish("lose");finishDialogue(h);assert.equal(h.state().currentNodeId,id);assert.equal(h.state().onboarding.requiredAction,action);
        assert.equal(h.state().completedNodes[id],undefined);assert.equal(h.api.continueTutorial(),false);
        if(action==="skill"){
            h.c.characterSkillLoadouts.fire.skillLevels.flameSlash=1;
            assert.equal(h.api.continueTutorial(),false,"learning without equipping is insufficient");
            h.c.characterSkillLoadouts.fire.equippedSkills.push("flameSlash");
        }else{
            h.state().rewardClaims.c1_03="ready";assert.equal(h.api.claimNodeReward("c1_03"),true);
            assert.equal(h.state().equipmentLessonFunding.amount,750);assert.equal(h.c.inventoryItems.length,0);
            const item=h.c.FourSymbolsEquipmentFactory.starter("leatherArmor"),cost=h.c.FourSymbolsEquipmentFactory.prices(item).shop;
            h.c.gold-=cost;h.c.inventoryItems.push(item);
            assert.equal(h.api.recordEquipmentLessonPurchase(item,cost,h.api.getEquipmentLessonOfferIntent()),true);
            assert.equal(h.api.continueTutorial(),false,"carrying armor is insufficient");
            h.c.characterEquipment.fire.armor={definitionId:"leatherArmor",v141Uid:"unrelated-armor"};
            assert.equal(h.api.continueTutorial(),false,"an unrelated copy cannot satisfy the tutorial grant");
            h.c.characterEquipment.fire.armor=h.c.inventoryItems.find(item=>item.v141Uid===h.state().grantedEquipmentUid);
        }
        assert.equal(h.api.continueTutorial(),true,id+" permits a prepared retry");assert.equal(h.state().currentNodeId,id);
        h.finish("win");assert.ok(h.state().completedNodes[id]);assert.notEqual(h.state().currentNodeId,id);
    }
});

test("stage 3 skill-use gate and stage 5 recovery preparation close onboarding",()=>{
    const h=runtime();at(h,"c1_03");assert.equal(h.api.beginBattle("c1_03"),true);h.finish("win");
    assert.equal(h.state().completedNodes.c1_03,undefined,"callback victory without skill use cannot complete lesson");
    assert.equal(h.api.beginBattle("c1_03"),true);h.useSkill();h.finish("win");assert.ok(h.state().completedNodes.c1_03);
    at(h,"c1_05");assert.equal(h.api.startStory("c1_05"),true);finishDialogue(h);
    h.c.player.sp=39;
    assert.equal(h.state().onboarding.requiredAction,"recovery");assert.equal(h.api.continueTutorial(),false);
    assert.equal(h.api.confirmPreparation(),false,"confirmation cannot replace actual recovery consumption");
    h.consumePotion("spPotion10");assert.equal(h.api.confirmPreparation(),true);assert.equal(h.api.continueTutorial(),true);h.finish("win");
    assert.equal(h.state().onboarding.active,false);assert.equal(h.state().currentNodeId,"c1_06");
});

test("story key first completion grants one durable key; repeated dialogue cannot grant or advance again",()=>{
    const h=runtime();at(h,"c1_11");assert.equal(h.api.startStory("c1_11"),true);finishDialogue(h);
    assert.deepEqual(JSON.parse(JSON.stringify(h.state().storyKeys)),{blackPineToken:{sourceNodeId:"c1_11"}});
    const key=JSON.stringify(h.state().storyKeys);assert.equal(h.state().currentNodeId,"c1_12");
    assert.equal(h.api.startStory("c1_11"),true);finishDialogue(h);assert.equal(JSON.stringify(h.state().storyKeys),key);
    h.state().currentNodeId="c1_14";delete h.state().storyKeys.blackPineToken;
    assert.equal(h.api.startStory("c1_14"),false);assert.equal(h.state().completedNodes.c1_14,undefined);
    h.state().storyKeys.blackPineToken={sourceNodeId:"c1_11"};assert.equal(h.api.startStory("c1_14"),true);finishDialogue(h);
    assert.ok(h.state().completedNodes.c1_14);assert.equal(h.state().currentNodeId,"c1_15");
});

test("save refusal rolls back story cursor, key, reward receipt, resources and inventory",()=>{
    for(const mode of [false,"throw"]){
        const h=runtime();at(h,"c1_11");h.api.startStory("c1_11");
        const lines=h.c.FourSymbolsAdventureContent.chapters.chapter_v1.nodes.find(n=>n.id==="c1_11").dialogue;
        for(let i=1;i<lines.length;i++)h.api.advanceDialogue();
        const before=JSON.stringify(h.state());h.save(mode);assert.equal(h.api.advanceDialogue(),false);assert.equal(JSON.stringify(h.state()),before);
        h.save(true);h.state().rewardClaims.c1_03="ready";const gold=h.c.gold,exp=h.c.sharedExp,inventory=JSON.stringify(h.c.inventoryItems);
        h.save(mode);assert.equal(h.api.claimNodeReward("c1_03"),false);
        assert.equal(h.state().rewardClaims.c1_03,"ready");assert.equal(h.c.gold,gold);assert.equal(h.c.sharedExp,exp);assert.equal(JSON.stringify(h.c.inventoryItems),inventory);
    }
});

test("tutorial guidance and dialogue reload retain exact cursor and required action",()=>{
    const h=runtime();at(h,"c1_02");h.api.beginBattle("c1_02");h.finish("lose");h.api.advanceDialogue();
    const saved=h.stored(),restored=runtime(saved);assert.deepEqual(JSON.parse(JSON.stringify(restored.state())),saved.chapters.chapter_v1);
    assert.equal(restored.api.open(),true);assert.equal(restored.state().dialogue.lineIndex,1);finishDialogue(restored);
    assert.equal(restored.api.continueTutorial(),false);assert.equal(restored.state().currentNodeId,"c1_02");
});

test("legacy character migrates its current node and preserves old ready receipts without restarting tutorial",()=>{
    const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{chapterCompleted:false,chapterRewardClaimed:false,branchSelections:{},currentNodeId:"n08_truth",completedNodes:{n01_arrival:true},rewardClaims:{n02_roadfight:"ready"}}}};
    const h=runtime(saved);assert.equal(h.state().currentNodeId,"c1_11");assert.equal(h.state().onboarding.active,false);
    assert.equal(h.state().rewardClaims.n02_roadfight,"ready");assert.equal(h.state().rewardClaims.c1_02,"blocked-legacy");
    assert.equal(h.api.startFreshStory(),false);assert.equal(h.state().currentNodeId,"c1_11");
});
test("refused fresh-story save preserves the original onboarding state and opening intent",()=>{
    const h=runtime(),before=JSON.stringify(h.state());h.save(false);
    assert.equal(h.api.startFreshStory(),false);assert.equal(JSON.stringify(h.state()),before);
    assert.equal(h.c.player.adventureProgress.pendingStoryOpening,true);
});
test("preparation from prior equipment retry cannot bypass the stage 5 recovery lesson",()=>{
    const h=runtime();h.state().currentNodeId="c1_05";
    h.state().onboarding={active:true,phase:"retry",nodeId:"c1_04",requiredAction:"equipment",prepared:true};
    assert.equal(h.api.startStory("c1_05"),true);finishDialogue(h);
    assert.equal(h.c.battleActive,false,"stage 5 must show recovery before battle even after a prepared stage 4");
    assert.equal(h.state().onboarding.nodeId,"c1_05");assert.equal(h.state().onboarding.requiredAction,"recovery");
    h.c.player.hp=99;
    assert.equal(h.api.continueTutorial(),false);assert.equal(h.api.confirmPreparation(),false);
    h.consumePotion("hpPotion10");assert.equal(h.api.confirmPreparation(),true);
});

test("full resources permit recovery practice but victory without consuming a potion cannot complete stage 5",()=>{
    const h=runtime();at(h,"c1_05");assert.equal(h.api.startStory("c1_05"),true);finishDialogue(h);
    assert.equal(h.api.getView().tutorialProgress.recoveryNeedsPractice,true);
    assert.equal(h.api.continueTutorial(),true);assert.equal(h.c.battleActive,true);
    assert.equal(h.c.player.hp,100);assert.equal(h.c.player.sp,40);
    assert.notEqual(h.state().onboarding.recoveryPrepared,true);
    const gold=h.c.gold,exp=h.c.sharedExp;
    // This unit fixture models the ordinary battle's SP expenditure.
    h.c.player.sp=30;h.finish("win");
    assert.equal(h.state().currentNodeId,"c1_05");assert.equal(h.state().onboarding.active,true);
    assert.equal(h.state().completedNodes.c1_05,undefined);assert.equal(h.state().rewardClaims.c1_05,"ready");
    assert.equal(h.c.gold,gold);assert.equal(h.c.sharedExp,exp);assert.equal(h.c.player.sp,30);
    assert.equal(h.api.getView().panel,"tutorial");assert.equal(h.api.getView().tutorialProgress.recoveryNeedsPractice,false);
    assert.equal(h.api.continueTutorial(),false,"resource use in battle is not potion consumption");
    h.consumePotion("spPotion10");
    assert.equal(h.api.continueTutorial(),true);h.finish("win");
    assert.ok(h.state().completedNodes.c1_05);assert.equal(h.state().onboarding.active,false);
});
test("retained boss ready or claimed receipt blocks the same new boss reward",()=>{
    for(const receipt of ["ready","claimed"]){
        const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{chapterCompleted:false,chapterRewardClaimed:false,branchSelections:{},currentNodeId:"n10_finish",completedNodes:{n09_boss:true},rewardClaims:{n09_boss:receipt}}}};
        const h=runtime(saved);assert.equal(h.api.beginBattle("c1_20"),true);h.finish("win");
        assert.equal(h.state().rewardClaims.c1_20,"blocked-legacy");assert.equal(h.api.claimNodeReward("c1_20"),false);
        if(receipt==="ready"){
            assert.equal(h.api.openLegacyReward("n09_boss"),true);assert.equal(h.api.claimNodeReward("n09_boss"),true);
            const gold=h.c.gold,exp=h.c.sharedExp;assert.equal(h.api.claimNodeReward("n09_boss"),false);
            assert.equal(h.c.gold,gold);assert.equal(h.c.sharedExp,exp);
        }
    }
});
test("legacy chapter endpoint maps to stage 20 without recreating onboarding or erasing receipts",()=>{
    const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{chapterRewardClaimed:false,branchSelections:{},currentNodeId:"n10_finish",chapterCompleted:true,
        completedNodes:{n09_boss:true,n10_finish:true},rewardClaims:{n09_boss:"ready"}}}};
    const h=runtime(saved);assert.equal(h.state().currentNodeId,"c1_20");assert.equal(h.state().chapterCompleted,true);
    assert.equal(h.state().onboarding.active,false);assert.equal(h.state().rewardClaims.n09_boss,"ready");
    assert.ok(h.state().storyKeys.blackPineToken);assert.equal(h.api.startFreshStory(),false);
});
test("invalid progress shapes and unknown versions refuse recovery without changing the original save",()=>{
    const baseline={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{chapterCompleted:false,chapterRewardClaimed:false,branchSelections:{},currentNodeId:"n10_finish",completedNodes:{},rewardClaims:{n09_boss:"ready"}}}};
    for(const corrupt of [s=>{s.schemaVersion=99;},s=>{s.chapters.chapter_v1.currentNodeId="unknown-node";},
        s=>{s.chapters.chapter_v1.rewardClaims="claimed";},s=>{s.chapters.chapter_v1.rewardClaims=[];},
        s=>{s.chapters.chapter_v1.rewardClaims.n09_boss="unknown-receipt";},s=>{s.chapters.chapter_v1.completedNodes=[];},
        s=>{delete s.chapters.chapter_v1.chapterRewardClaimed;},s=>{delete s.chapters.chapter_v1.rewardClaims;}]){
        const saved=structuredClone(baseline);corrupt(saved);const before=JSON.stringify(saved);
        assert.throws(()=>runtime(saved),/Adventure|progress|save|recovery|receipt|state/i);assert.equal(JSON.stringify(saved),before);
    }
});
test("refused legacy migration never mutates or opens the original root",()=>{
    for(const mode of [false,"throw"]){
        const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{chapterCompleted:false,chapterRewardClaimed:false,branchSelections:{},currentNodeId:"n10_finish",completedNodes:{n09_boss:true},rewardClaims:{n09_boss:"ready"}}}};
        const before=JSON.stringify(saved);
        assert.throws(()=>runtime(saved,mode),/Adventure|progress|save|recovery|receipt|state/i);
        assert.equal(JSON.stringify(saved),before,"failed migration retains original raw root");
    }
});
test("completed tutorial actions cannot replay a prior lesson for another free refill",()=>{
    const h=runtime();at(h,"c1_02");h.api.beginBattle("c1_02");h.finish("lose");finishDialogue(h);
    h.c.characterSkillLoadouts.fire={skillLevels:{flameSlash:1},equippedSkills:["flameSlash"]};
    assert.equal(h.api.continueTutorial(),true);h.finish("win");h.c.player.hp=19;h.c.player.sp=7;
    const launches=h.launches();assert.equal(h.api.continueTutorial(),false);assert.equal(h.launches(),launches);
    assert.equal(h.c.player.hp,19);assert.equal(h.c.player.sp,7);
});
test("a genuine retained mission objective turns in and claims once after story migration",()=>{
    const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{currentNodeId:"n05_commission",chapterCompleted:false,chapterRewardClaimed:false,
        branchSelections:{fork_1:"safe"},completedNodes:{n01_arrival:true,n02_roadfight:true,n03_fork:{choiceId:"safe"},n04a_path:true},rewardClaims:{n02_roadfight:"claimed"},
        objective:{sourceNodeId:"n05_commission",active:true,ready:true,turnedIn:false,current:5,target:5,monsterName:"山狼",zoneKey:"forest"}}}};
    const h=runtime(saved),gold=h.c.gold,exp=h.c.sharedExp;
    assert.equal(h.api.turnInObjective("n05_commission"),true);assert.equal(h.state().objective.turnedIn,true);
    assert.equal(h.api.turnInObjective("n05_commission"),false);assert.equal(h.state().rewardClaims.n05_commission,"ready");
    assert.equal(h.api.openLegacyReward("n05_commission"),true);assert.equal(h.api.claimNodeReward("n05_commission"),true);
    const reward=h.c.FourSymbolsAdventureContent.rewards.commission_turnin;
    assert.equal(h.c.gold-gold,reward.gold||0);assert.equal(h.c.sharedExp-exp,reward.sharedExp||0);
    const committed=JSON.stringify(h.c.player.adventureProgress),goldAfter=h.c.gold;
    assert.equal(h.api.claimNodeReward("n05_commission"),false);assert.equal(h.api.turnInObjective("n05_commission"),false);
    assert.equal(h.c.gold,goldAfter);assert.equal(JSON.stringify(h.c.player.adventureProgress),committed);
});
