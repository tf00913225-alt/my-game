import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {ROOT,findChrome,startServer,waitJson,Cdp} from "./runtime-browser-qa-support.mjs";
// Uses the existing read-only account transport fixture, production index and
// all real gameplay bundles. No player/cloud data is read or written.
const expression=`(async()=>{
    const until=Date.now()+30000;
    while(Date.now()<until&&window.FourSymbolsStartupPolicy?.getState?.()!=="READY"){
        await new Promise(r=>setTimeout(r,50));
    }
    if(window.FourSymbolsStartupPolicy?.getState?.()!=="READY")throw new Error("Startup not READY");
    await FourSymbolsFeatures.ensure("gameplay-core","hit-evasion-v2-qa");
    await FourSymbolsFeatures.ensure("feature-boss-relic","hit-evasion-v2-qa");
    player.element="wind";player.level=100;player.activeBuffs=[];player.statusEffects=[];
    characterEquipment.fire={};characterEquipment.wind=characterEquipment.fire;
    characterSkillLoadouts.fire={skillLevels:{windEX:1},equippedSkills:[]};
    player.hp=getMainCharacterStats().maxHP;
    const wind={accuracy:getFinalAccuracyBonusPercent(player),evasion:getMainCharacterStats().evasion};
    player.hp=1;const lowCap=calculateHitChancePercent(1000,0,0,0,player);
    characterSkillLoadouts.fire.skillLevels.windEX=0;
    // Explicit Owner fixture replaces the retired ambiguous generic constructor.
    const qaMonster=level=>MonsterBalance.build({monsterKey:"qa.hit-evasion",name:"QA",level,element:"fire",archetype:"balanced",rank:"regular",mode:"wild",context:"qa/hit-evasion"});
    const levels=[1,100].map(level=>{player.level=level;return {hit:calculateHitChancePercent(getMainCharacterStats().accuracy,qaMonster(level).evasion,0,0),evasion:qaMonster(level).evasion};});
    const calm=[5,10,15,20,25].map(value=>{player.activeBuffs=[{type:"dinghaishenzhen",turnsLeft:3,accuracyBonusPercent:value}];return [getMainCharacterStats().accuracy,getFinalAccuracyBonusPercent(player),calculateHitChancePercent(0,40,0,getFinalAccuracyBonusPercent(player))];});
    const dodge=[5,10,15,20,25].map(value=>{player.activeBuffs=[{type:"dodgeSkill",turnsLeft:3,percent:value}];return getMainCharacterStats().evasion;});
    player.activeBuffs=[];player.statusEffects=[];
    const armor={id:"setWind_heavyArmor",setId:"setWind",type:"armor",stats:{accuracy:10,attack:7,antiCrit:0.5,statusResistance:0.25}};
    migrateLegacyEquipmentStats(armor);
    characterEquipment.fire={armor};characterEquipment.wind=characterEquipment.fire;
    const one=getEquipmentBonus("fire").evasion;
    characterEquipment.fire.head={setId:"setWind",stats:{}};
    characterEquipment.fire.hand={setId:"setWind",stats:{}};
    const three=getEquipmentBonus("fire").evasion;
    delete characterEquipment.fire.head;const two=getEquipmentBonus("fire").evasion;
    player.hp=getMainCharacterStats().maxHP;
    showPage("home");openInventoryCharacterDetail();
    const detail=document.getElementById("inventoryCharacterDetailStats").textContent;
    closeInventoryCharacterDetail();
    const legacyArmor={id:"setWind_heavyArmor",setId:"setWind",type:"armor",stats:{accuracy:10,spirit:10,antiCrit:0.5,statusResistance:0.25}};
    inventoryItems.push(legacyArmor);v17346SyncFourElementSets();v17346SyncFourElementSets();
    inventoryItems.splice(inventoryItems.indexOf(legacyArmor),1);
    const migrated=FourSymbolsEquipmentCombatMigration.projectItem({stats:{accuracy:20,antiCrit:1,statusResistance:0.5}});
    const repeated=FourSymbolsEquipmentCombatMigration.projectItem(migrated);
    // Explicit tower affinity survives the retired level-derived default.
    const towerState=GameplaySystem.getSerializableState();let windTime=Date.now();
    while(GameplaySystem.getWeekInfo(windTime).element!=="wind")windTime-=7*24*60*60*1000;
    const windState=structuredClone(towerState);windState.tower.weekKey=GameplaySystem.getWeekInfo(windTime).key;
    let tower;const realNow=Date.now;
    try{Date.now=()=>windTime;GameplaySystem.debugReloadState(windState,windTime);tower=GameplaySystem.buildTowerRoster(1).map(m=>getMonsterEvasion(m));}
    finally{Date.now=realNow;GameplaySystem.debugReloadState(towerState);}
    characterEquipment.fire={};characterEquipment.wind=characterEquipment.fire;
    player.activeBuffs=[{type:"dodgeSkill",turnsLeft:3,percent:40}];
    player.statusEffects=[{type:"frostbite",turnsLeft:2}];
    const frostbite=getMainCharacterStats().evasion;
    player.activeBuffs=[];player.statusEffects=[];player.hp=getMainCharacterStats().maxHP;
    const freshMonsters=async()=>{monsters=[qaMonster(1)];monsters[0].hp=monsters[0].maxHP=100000;monsters[0].alive=true;monsters[0].accuracy=0;currentZone="forest";mapCooldown=false;autoBattle=false;autoConfig.enabled=false;autoPatrolEnabled=false;startBattle(0);await waitRelic();const deadline=Date.now()+8000;while(Date.now()<deadline&&document.getElementById("battlePage")?.matches(".v141-preparing-entry,.v141-entry-moving"))await new Promise(r=>setTimeout(r,30));};
    const endBattle=async()=>{loseBattle();const deadline=Date.now()+8000;while(battleActive&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));if(battleActive)throw new Error("Battle exit did not finish");player.hp=getMainCharacterStats().maxHP;};
    const waitRelic=async()=>{const deadline=Date.now()+5000;while(!v174RelicDebugState()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));if(!v174RelicDebugState())throw new Error("Real relic battle did not initialize: "+JSON.stringify({battleActive,battleToken,turn,observers:Array.from(battleRoundStartObservers).map(fn=>String(fn).slice(0,800)),keys:Array.from(battleRoundBoundaryKeys),startSource:String(startBattle).slice(0,500),turnSource:String(startTurn).slice(0,500),logs:Array.from(document.querySelectorAll(".battle-log")).map(n=>n.textContent)}));};
    const relicOwned=v174RelicSystem.getOwnedState(),loadout=v174RelicSystem.getTeamLoadout();
    const feather=[],relicFrostbite=[];
    for(const level of [1,10,20]){
        Object.assign(relicOwned.relic_qinglan_feather,{unlocked:true,level});loadout.relicId="relic_qinglan_feather";
        await freshMonsters();await waitRelic();feather.push([getMainCharacterStats().evasion,getPartyBattleStats(0).evasion]);player.statusEffects=[{type:"frostbite",turnsLeft:2}];relicFrostbite.push([getMainCharacterStats().evasion,getPartyBattleStats(0).evasion]);player.statusEffects=[];await endBattle();
    }
    const bell=[];
    for(const level of [10,20]){
        Object.assign(relicOwned.relic_soul_bell,{unlocked:true,level});loadout.relicId="relic_soul_bell";
        await freshMonsters();await waitRelic();turn=4;v174RelicDebugDispatch("round_start",{sourceType:"system"});
        bell.push({accuracy:monsters[0].accuracy,reduction:getFinalHitReductionPercent(monsters[0]),hit:calculateHitChancePercent(monsters[0].accuracy,0,getFinalHitReductionPercent(monsters[0]),0)});
        await endBattle();
    }
    loadout.relicId=null;
    await freshMonsters();
    const casts={};
    for(const skillId of ["dodgeSkill","dinghaishenzhen"]){
        casts[skillId]=[];
        for(let level=1;level<=5;level++){
            characterSkillLoadouts.fire.skillLevels[skillId]=level;player.activeBuffs=[];player.v141TeamBuffs=[];player.sp=1000;activeBattleCharacterIndex=0;
            castBuffSkill(skillId);
            const buff=player.activeBuffs.find(b=>b.type===skillId);
            casts[skillId].push({value:skillId==="dodgeSkill"?getMainCharacterStats().evasion:getFinalAccuracyBonusPercent(player),duration:buff?.turnsLeft,accuracy:getMainCharacterStats().accuracy});
        }
    }
    player.activeBuffs=[];player.v141TeamBuffs=[];
    Object.assign(monsters[0],{name:"極帝天尊",element:"light",v141Abyss:true,v174TrueRealmFinal:true,v141SupportSkillIds:["yuanZuBlessing"],sp:1000,maxSP:1000,evasion:0,statusEffects:[]});
    const blessingApplied=v155ResolveExtremeEmperorAction(0,"yuanZuBlessing",false);
    const blessing={applied:blessingApplied,evasion:getMonsterEvasion(monsters[0]),duration:monsters[0].v155EvasionBlessing?.displayBuff?.turnsLeft};
    await endBattle();
    // Observe the existing owner during actual manual / auto / enemy resolution.
    const owner=calculateHitChancePercent,calls=[];
    calculateHitChancePercent=function(...args){const result=owner(...args);calls.push({args:args.slice(0,4),chance:result,side:args[4]?"monster":"player"});return result;};
    const combat={};
    try{
        await freshMonsters();selectedMonster=0;normalAttack();combat.manual=calls.splice(0);
        await endBattle();await freshMonsters();calls.splice(0);
        // Use the same time entitlement and toggle as real auto battle. Declaration,
        // initiative and animation must reach the player Hit Owner before inspection.
        v131GrantElementBoxHours(8,32);autoConfig.skill="normal";toggleAutoBattle();
        const autoDeadline=Date.now()+15000;
        while(!calls.some(call=>call.side==="player")&&battleActive&&Date.now()<autoDeadline)await new Promise(r=>setTimeout(r,30));
        if(!calls.some(call=>call.side==="player"))throw new Error("Natural auto player action did not reach Hit Owner: "+JSON.stringify({battleActive,battlePhase,autoBattle,turn,queued:queuedPlayerActions[0],calls}));
        if(autoBattle)toggleAutoBattle();combat.autoResolution=calls.splice(0).filter(call=>call.side==="player");
        await endBattle();await freshMonsters();calls.splice(0);
        monsters[0].skillChance=0;monsters[0].skill=null;monsters[0].skills=[];processSingleMonsterAttack(0,battleToken);combat.monster=calls.splice(0);
    }finally{calculateHitChancePercent=owner;await endBattle();}
    return {wind,lowCap,levels,calm,dodge,set:{one,three,two,armor},detail,migrated,repeated,legacyArmor,tower,frostbite,feather,relicFrostbite,bell,blessing,combat,casts,
        formula:[calculateHitChancePercent(0,0,0,0),calculateHitChancePercent(10,0,0,0),calculateHitChancePercent(10,40,0,0),calculateHitChancePercent(0,40,0,0),calculateHitChancePercent(0,1000,0,0)]};
})()`;
const server=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"hit-evasion-v2-"));
const port=9750+Math.floor(Math.random()*200);
const proc=spawn(findChrome(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"],{stdio:"ignore"});
let client,evidence;
const artifact=path.join(ROOT,"artifacts/browser-qa/hit-evasion-v2.json");
fs.mkdirSync(path.dirname(artifact),{recursive:true});
try{
    const targets=await waitJson(`http://127.0.0.1:${port}/json/list`);
    client=new Cdp(targets.find(x=>x.type==="page").webSocketDebuggerUrl);
    await client.send("Page.enable");await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:393,height:873,deviceScaleFactor:1,mobile:true});
    await client.send("Page.navigate",{url:server.url});
    evidence=await client.eval(expression);
    assert.deepEqual(evidence.wind,{accuracy:15,evasion:15});assert.equal(evidence.lowCap,50);
    assert.deepEqual(evidence.levels,[{hit:95,evasion:0},{hit:95,evasion:0}]);
    assert.deepEqual(evidence.calm,[5,10,15,20,25].map(v=>[0,v,55+v]));
    assert.deepEqual(evidence.dodge,[5,10,15,20,25]);
    assert.deepEqual([evidence.set.one,evidence.set.three,evidence.set.two],[10,12,10]);
    assert.match(evidence.detail,/命中\s*0%/);assert.match(evidence.detail,/閃避\s*10\.0%/);
    assert.match(evidence.detail,/5%～99%/);
    assert.equal(evidence.legacyArmor.stats.accuracy,3);assert.equal(evidence.legacyArmor.stats.evasion,10);assert.equal(evidence.legacyArmor.stats.antiCrit,1.5);assert.equal(evidence.legacyArmor.stats.statusResistance,0.75);
    assert.equal(evidence.migrated.stats.accuracy,3);assert.deepEqual(evidence.repeated,evidence.migrated);
    assert.deepEqual(evidence.formula,[95,99,65,55,5]);
    assert.ok(evidence.tower.length>0&&evidence.tower.every(v=>v===15));
    assert.equal(evidence.frostbite,15);assert.deepEqual(evidence.feather,[[8,8],[10,10],[12,12]]);assert.deepEqual(evidence.relicFrostbite,[[0,0],[0,0],[0,0]]);
    assert.deepEqual(evidence.bell,[{accuracy:0,reduction:5,hit:90},{accuracy:0,reduction:8,hit:87}]);
    for(const values of Object.values(evidence.casts))assert.deepEqual(values,[5,10,15,20,25].map(value=>({value,duration:3,accuracy:0})));
    assert.deepEqual(evidence.blessing,{applied:true,evasion:15,duration:2});
    for(const [mode,calls] of Object.entries(evidence.combat)){assert.ok(calls.length>0,mode+" reaches shared Hit Owner");assert.ok(calls.every(call=>call.chance>=5&&call.chance<=99));}
    await client.eval('characterEquipment.fire={armor:'+JSON.stringify(evidence.set.armor)+'};characterEquipment.wind=characterEquipment.fire;inventoryCharacterIndex=0;showPage("home");openInventoryCharacterDetail();');
    const screenshot=await client.send("Page.captureScreenshot",{format:"png"});
    fs.writeFileSync(artifact.replace(/\.json$/,".png"),Buffer.from(screenshot.data,"base64"));
    await client.eval('document.getElementById("inventoryCharacterDetailStats").scrollTop=10000');
    const noteScreenshot=await client.send("Page.captureScreenshot",{format:"png"});
    fs.writeFileSync(artifact.replace(/\.json$/,"-formula.png"),Buffer.from(noteScreenshot.data,"base64"));
    fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||"local",evidence},null,2)+"\n");
    console.log("V2 production mobile Runtime/UI/Save browser QA passed");
}catch(error){
    fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),evidence},null,2)+"\n");
    console.error(error);
    console.error(JSON.stringify(client?.events.filter(e=>e.method==="Runtime.consoleAPICalled").slice(-12)));
    throw error;
}finally{
    client?.close();proc.kill("SIGTERM");
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}
    await new Promise(resolve=>server.server.close(resolve));
}
