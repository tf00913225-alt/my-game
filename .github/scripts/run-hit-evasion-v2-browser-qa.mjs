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
    const levels=[1,100].map(level=>{player.level=level;return {hit:calculateHitChancePercent(getMainCharacterStats().accuracy,makeZoneMonster("QA",level,"fire").evasion,0,0),evasion:makeZoneMonster("QA",level,"fire").evasion};});
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
    const migrated=FourSymbolsEquipmentCombatMigration.projectItem({stats:{accuracy:20,antiCrit:1,statusResistance:0.5}});
    const repeated=FourSymbolsEquipmentCombatMigration.projectItem(migrated);
    return {wind,lowCap,levels,calm,dodge,set:{one,three,two,armor},detail,migrated,repeated,
        formula:[calculateHitChancePercent(0,0,0,0),calculateHitChancePercent(10,0,0,0),calculateHitChancePercent(10,40,0,0),calculateHitChancePercent(0,40,0,0),calculateHitChancePercent(0,1000,0,0)]};
})()`;
const server=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"hit-evasion-v2-"));
const port=9750+Math.floor(Math.random()*200);
const proc=spawn(findChrome(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"],{stdio:"ignore"});
let client;
const artifact=path.join(ROOT,"artifacts/browser-qa/hit-evasion-v2.json");
fs.mkdirSync(path.dirname(artifact),{recursive:true});
try{
    const targets=await waitJson(`http://127.0.0.1:${port}/json/list`);
    client=new Cdp(targets.find(x=>x.type==="page").webSocketDebuggerUrl);
    await client.send("Page.enable");await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:393,height:873,deviceScaleFactor:1,mobile:true});
    await client.send("Page.navigate",{url:server.url});
    const evidence=await client.eval(expression);
    assert.deepEqual(evidence.wind,{accuracy:15,evasion:15});assert.equal(evidence.lowCap,50);
    assert.deepEqual(evidence.levels,[{hit:95,evasion:0},{hit:95,evasion:0}]);
    assert.deepEqual(evidence.calm,[5,10,15,20,25].map(v=>[0,v,55+v]));
    assert.deepEqual(evidence.dodge,[5,10,15,20,25]);
    assert.deepEqual([evidence.set.one,evidence.set.three,evidence.set.two],[10,12,10]);
    assert.match(evidence.detail,/命中0%/);assert.match(evidence.detail,/閃避10%/);
    assert.match(evidence.detail,/5%～99%/);
    assert.equal(evidence.migrated.stats.accuracy,3);assert.deepEqual(evidence.repeated,evidence.migrated);
    assert.deepEqual(evidence.formula,[95,99,65,55,5]);
    fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.GITHUB_SHA||"local",evidence},null,2)+"\n");
    console.log("V2 production mobile Runtime/UI/Save browser QA passed");
}catch(error){
    fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error)},null,2)+"\n");
    throw error;
}finally{
    client?.close();proc.kill("SIGTERM");fs.rmSync(profile,{recursive:true,force:true});
    await new Promise(resolve=>server.server.close(resolve));
}
