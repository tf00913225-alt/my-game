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
function runtime(saved){
    let callback,saveMode=true,stored,roster,options,launches=0,skillEvent;
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
        getPotionCount:()=>3,addPotionToInventory:()=>true,
        v132LaunchDungeonBattle(enemies,fn,opts){roster=enemies;callback=fn;options=opts;launches++;c.battleActive=true;return true;}};
    c.window=c;vm.createContext(c);
    for(const path of ["js/adventure/adventure-content-v1-20260915.js","js/adventure/adventure-runtime-v1-20260915.js"])vm.runInContext(fs.readFileSync(path,"utf8"),c);
    return {c,api:c.FourSymbolsAdventure,state:()=>c.player.adventureProgress.chapters.chapter_v1,
        save:value=>{saveMode=value;},stored:()=>structuredClone(stored),roster:()=>roster,options:()=>options,launches:()=>launches,
        finish:result=>{c.battleActive=false;callback({result});},useSkill:()=>skillEvent({actor:player,actualSpent:1})};
}
function finishDialogue(h){let guard=30;while(h.state().dialogue&&guard-->0)assert.equal(h.api.advanceDialogue(),true);assert.ok(guard>0);}
function at(h,id){h.state().currentNodeId=id;h.state().onboarding={active:true,phase:"story",nodeId:"c1_01"};}

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
    assert.equal(h.api.confirmPreparation(),true);assert.equal(h.api.continueTutorial(),true);h.finish("win");
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
    const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{currentNodeId:"n08_truth",completedNodes:{n01_arrival:true},rewardClaims:{n02_roadfight:"ready"}}}};
    const h=runtime(saved);assert.equal(h.state().currentNodeId,"c1_11");assert.equal(h.state().onboarding.active,false);
    assert.equal(h.state().rewardClaims.n02_roadfight,"ready");assert.equal(h.state().rewardClaims.c1_02,"blocked-legacy");
    assert.equal(h.api.startFreshStory(),false);assert.equal(h.state().currentNodeId,"c1_11");
});
test("refused fresh-story save preserves the original onboarding state and opening intent",()=>{
    const h=runtime(),before=JSON.stringify(h.state());h.save(false);
    assert.equal(h.api.startFreshStory(),false);assert.equal(JSON.stringify(h.state()),before);
    assert.equal(h.c.player.adventureProgress.pendingStoryOpening,true);
});
test("retained boss ready or claimed receipt blocks the same new boss reward",()=>{
    for(const receipt of ["ready","claimed"]){
        const saved={schemaVersion:2,activeChapterId:"chapter_v1",chapters:{chapter_v1:{currentNodeId:"n10_finish",completedNodes:{n09_boss:true},rewardClaims:{n09_boss:receipt}}}};
        const h=runtime(saved);assert.equal(h.api.beginBattle("c1_20"),true);h.finish("win");
        assert.equal(h.state().rewardClaims.c1_20,"blocked-legacy");assert.equal(h.api.claimNodeReward("c1_20"),false);
        if(receipt==="ready"){
            assert.equal(h.api.openLegacyReward("n09_boss"),true);assert.equal(h.api.claimNodeReward("n09_boss"),true);
            const gold=h.c.gold,exp=h.c.sharedExp;assert.equal(h.api.claimNodeReward("n09_boss"),false);
            assert.equal(h.c.gold,gold);assert.equal(h.c.sharedExp,exp);
        }
    }
});
