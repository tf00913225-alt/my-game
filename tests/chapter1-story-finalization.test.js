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
        FourSymbolsEquipmentFactory:{starter:id=>({definitionId:id,name:id,v141Uid:"qa-starter-armor"})},
        v132AddItemToInventory(item){c.inventoryItems.push(item);return true;},
        v132RunInventoryTransaction(fn){const before=JSON.parse(JSON.stringify(c.inventoryItems));const ok=fn();if(!ok)c.inventoryItems=before;return ok;},
        getPotionCount:id=>potionCounts[id]||0,addPotionToInventory:()=>true,
        v132LaunchDungeonBattle(enemies,fn,opts){roster=enemies;callback=fn;options=opts;launches++;c.battleActive=true;return true;}};
    c.window=c;vm.createContext(c);
    for(const path of ["js/adventure/adventure-content-v1-20260915.js","js/adventure/adventure-runtime-v1-20260915.js"])vm.runInContext(fs.readFileSync(path,"utf8"),c);
    return {c,api:c.FourSymbolsAdventure,state:()=>c.player.adventureProgress.chapters.chapter_v1,
        save:value=>{saveMode=value;},stored:()=>structuredClone(stored),roster:()=>roster,options:()=>options,launches:()=>launches,
        finish:result=>{c.battleActive=false;callback({result});},useSkill:()=>skillEvent({actor:player,actualSpent:1}),
        consumePotion:id=>{assert.ok(potionCounts[id]>0);potionCounts[id]--;}};
}
function finishDialogue(h){let guard=30;while(h.state().dialogue&&guard-->0)assert.equal(h.api.advanceDialogue(),true);assert.ok(guard>0);}
function at(h,id){h.state().currentNodeId=id;h.state().onboarding={active:true,phase:"story",nodeId:"c1_01"};}

function installUi(h){
    const body={innerHTML:"",querySelector:()=>null};
    const root={isConnected:true,dataset:{},classList:{contains:()=>false},querySelector:selector=>selector==="#adventureView"?body:null};
    h.c.document.getElementById=id=>id==="adventurePage"?root:null;
    vm.runInContext(fs.readFileSync("js/adventure/adventure-ui-v1-20260915.js","utf8"),h.c);
    return ()=>body.innerHTML;
}

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
    assert.equal((html().match(/class="adventure-node type-/g)||[]).length,20);
    assert.match(html(),/class="adventure-map-viewport" data-scroll-owner="y"/);
    assert.match(html(),/<\/div><\/div><aside class="adventure-node-sheet/,'fixed action sheet is outside the scroll viewport');
    assert.match(html(),/onclick="FourSymbolsAdventure.activateSelectedNode\(\)"[^>]*>前往第 2 關 · 山道惡徒/);
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

function guideHarness(){
    const listeners=new Map(),frames=[],targets=new Map(),children=new Map();let acquired=0,released=0,overlay;
    const element=()=>{const classes=new Set();return {disabled:false,style:{},classList:{contains:name=>classes.has(name),toggle(name,force){const enabled=force===undefined?!classes.has(name):!!force;if(enabled)classes.add(name);else classes.delete(name);return enabled;}},getBoundingClientRect:()=>({left:20,top:100,right:100,bottom:140,width:80,height:40}),scrollIntoView(){},contains(other){return other?.parent===this;}};};
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
            createElement(){return {...element(),querySelector(selector){if(!children.has(selector))children.set(selector,{style:{},textContent:"",hidden:false});return children.get(selector);}};}}};
    c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/adventure/adventure-ui-v1-20260915.js","utf8"),c);
    let timestamp=0;
    return {c,view,element,targets,children,overlay:()=>overlay,holds:()=>({acquired,released}),frame(){assert.ok(frames.length);timestamp+=100;frames.shift()(timestamp);},
        dispatch(type,target,key){const event={type,target,key,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listeners.get(type)(event);if(!event.stopped)target.action?.();return event;}};
}

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

test("story reading guide keeps the real Next target and toggles reading presentation without an acknowledgement step",()=>{
    const h=guideHarness(),story=h.element(),next=h.element(),other=h.element();let advances=0;
    h.c.battleActive=false;next.action=()=>{advances++;};
    h.targets.set('#adventurePage.active[data-panel="story"]',[story]);
    h.targets.set('#adventurePage [onclick*="advanceDialogue"]',[next]);
    h.frame();assert.equal(h.overlay().classList.contains('is-reading'),true);
    assert.equal(advances,0);assert.equal(h.dispatch('click',other).stopped,true);
    assert.equal(h.dispatch('click',next).stopped,false);assert.equal(advances,1,'the existing story Next advances directly');
    h.targets.delete('#adventurePage.active[data-panel="story"]');
    h.targets.set('#adventurePage .adventure-button.primary',[other]);
    h.frame();assert.equal(h.overlay().classList.contains('is-reading'),false,'leaving story restores the normal guide presentation');
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
    assert.equal(h.api.continueTutorial(),false);assert.equal(h.api.confirmPreparation(),false);
    h.consumePotion("hpPotion10");assert.equal(h.api.confirmPreparation(),true);
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
