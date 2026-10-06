import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';

const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
if(baseUrl){
  const manifest=await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'}).then(r=>r.json());
  assert.equal(manifest.commitSha,expected,'QA must use the exact deployed dev SHA');
}
const reference=fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8');
const expression=`(async()=>{
  const wait=async(fn,ms=30000)=>{const end=Date.now()+ms;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,40));if(!fn())throw Error('Runtime wait '+fn);};
  await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY');
  await FourSymbolsFeatures.ensure('boss-tower','enemy-resource-integer-qa');
  await FourSymbolsFeatures.ensure('gameplay-core','enemy-resource-integer-qa');
  closeHomeFeature();autoBattle=false;autoConfig.enabled=false;autoPatrolEnabled=false;
  prepareWildBalanceReferenceParty(40,3);
  const make=()=>MonsterBalance.build({monsterKey:'qa.abyss',name:'整數顯示驗證',level:40,element:'fire',archetype:'balanced',rank:'elite',mode:'abyss',context:'abyss/40/east/stage/1',abyssDifficulty:40,abyssRegion:'east',abyssStage:0});
  monsters=[make()];currentZone='forest';mapCooldown=false;startBattle(0);
  await wait(()=>battleActive&&document.getElementById('battleMonster0'));
  await wait(()=>!document.getElementById('battlePage').matches('.v141-preparing-entry,.v141-entry-moving'));
  const evidence=[];
  const capture=async(label,index=0)=>{
    const m=monsters[index],before=[m.hp,m.maxHP,m.sp,m.maxSP],party=getExistingPartyIndexes().map(i=>{const p=getPartyCharacterByIndex(i);return [p.hp,p.sp];});
    updateMonsterUI(index);
    const mutationHp=document.getElementById('battleMonsterHPText'+index).textContent,mutationSp=document.getElementById('battleMonsterSPText'+index).textContent;
    FourSymbolsBattlePresentation.sync();await new Promise(r=>setTimeout(r,120));
    const text=id=>document.getElementById(id+index).textContent;
    const width=id=>parseFloat(document.getElementById(id+index).style.width);
    openBattleStatusDetailModal('monster',index);
    const modal=document.getElementById('battleStatusDetailModal');
    const hpDetail=modal.querySelector('[data-field="hp"]').textContent,spDetail=modal.querySelector('[data-field="sp"]').textContent;
    closeBattleStatusDetailModal();
    const after=[m.hp,m.maxHP,m.sp,m.maxSP],partyAfter=getExistingPartyIndexes().map(i=>{const p=getPartyCharacterByIndex(i);return [p.hp,p.sp];});
    const card=document.getElementById('battleMonster'+index),rect=card.getBoundingClientRect();
    const result={label,before,after,party,partyAfter,mutationHp,mutationSp,hp:text('battleMonsterHPText'),sp:text('battleMonsterSPText'),hpWidth:width('battleMonsterBar'),spWidth:width('battleMonsterSPBar'),hpDetail,spDetail,visible:rect.width>0&&rect.height>0&&getComputedStyle(card).display!=='none'};
    evidence.push(result);return result;
  };
  await capture('formal-abyss-elite');
  Object.assign(monsters[0],{hp:95.5,maxHP:100.25,sp:37.25,maxSP:100.75});await capture('fractional');
  const damage=calculateDamage(20,0,40,40,'fire','fire',{attacker:player,target:monsters[0]});
  monsters[0].hp=Math.max(0,monsters[0].hp-damage);monsters[0].sp=Math.max(0,monsters[0].sp-10);await capture('damage-and-cost');
  monsters[0].hp=Math.min(monsters[0].maxHP,monsters[0].hp+4.25);monsters[0].sp=Math.min(monsters[0].maxSP,monsters[0].sp+6.5);await capture('recovery');
  monsters[0].hp=0;monsters[0].sp=0;await capture('zero');
  monsters[0].hp=monsters[0].maxHP;monsters[0].sp=monsters[0].maxSP;await capture('max');
  monsters[0].hp=95.5;v141ApplyMonsterShield(monsters[0],20,2);await capture('shield');
  monsters[0].v141Shield.isBarrier=true;monsters[0].v141Shield.remainingBlocks=2;await capture('barrier');
  monsters[0].v141Shield=null;Object.assign(monsters[0],{hp:NaN,maxHP:100,sp:Infinity,maxSP:0});await capture('invalid');
  Object.assign(monsters[0],{hp:100,maxHP:100,sp:100,maxSP:100});
  window.enemyResourceQaCapture='normal';
  loseBattle();await wait(()=>!battleActive);
  prepareWildBalanceReferenceParty(20,2);v131GrantElementBoxHours(8,32);
  vGameplayOpenBoss();vGameplayOpenBossDetail('personal','personal-20');
  const button=document.querySelector('#bossTabContent .boss-detail .gameplay-primary-action');if(!button||button.disabled)throw Error('formal Boss entry unavailable');button.click();
  await wait(()=>battleActive&&FourSymbolsBossBattle.isActive());
  await wait(()=>!document.getElementById('battlePage').matches('.v141-preparing-entry,.v141-entry-moving'));
  const index=FourSymbolsBossBattle.getBossIndex(),boss=monsters[index];
  boss.hp=boss.maxHP-.5;boss.sp=boss.maxSP-.25;FourSymbolsBossBattle.syncHud();await capture('personal-boss',index);
  window.enemyResourceQaCapture='boss';
  return evidence;
})()`;
const server=await startServer({baseUrl});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'enemy-resource-integer-'));
const port=9700+Math.floor(Math.random()*200);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const artifact=path.join(ROOT,'artifacts/browser-qa/enemy-resource-integer.json');
fs.mkdirSync(path.dirname(artifact),{recursive:true});
let client,evidence;
try{
  const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');
  client=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await client.send('Page.enable');await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride',{width:393,height:873,deviceScaleFactor:1,mobile:true});
  await client.send('Page.navigate',{url:server.url});
  evidence=await client.eval(reference+'\n'+expression);
  for(const row of evidence){
    assert.match(row.hp,/^\d+$/,row.label);
    assert.match(row.sp,/^\d+$/,row.label);
    assert.equal(row.mutationHp,row.hp,row.label+' mutation and late HP owner agree');
    assert.equal(row.mutationSp,row.sp,row.label+' mutation and late SP owner agree');
    assert.match(row.hpDetail,/^HP：\d+ \/ \d+$/);assert.match(row.spDetail,/^SP：\d+ \/ \d+$/);
    // JSON serialization maps non-finite fixture numbers to null on both sides.
    assert.deepEqual(row.after,row.before,row.label+' must not mutate resources');
    assert.deepEqual(row.partyAfter,row.party,row.label+' must not mutate players');
    assert.ok(row.visible,row.label+' visible final DOM');
    assert.ok(Number.isFinite(row.hpWidth)&&row.hpWidth>=0&&row.hpWidth<=100);
    assert.ok(Number.isFinite(row.spWidth)&&row.spWidth>=0&&row.spWidth<=100);
    if(!['shield','barrier','invalid'].includes(row.label)){
      assert.ok(Math.abs(row.hpWidth-row.before[0]/row.before[1]*100)<.0001,row.label+' HP ratio');
      assert.ok(Math.abs(row.spWidth-row.before[2]/row.before[3]*100)<.0001,row.label+' SP ratio');
    }
  }
  assert.equal(evidence[0].before[3],727.5);assert.equal(evidence[0].sp,'727');
  assert.equal(evidence.find(r=>r.label==='fractional').hp,'95');
  assert.equal(evidence.find(r=>r.label==='zero').hpWidth,0);
  assert.equal(evidence.find(r=>r.label==='max').hpWidth,100);
  const screenshot=await client.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(artifact.replace(/\.json$/,'.png'),Buffer.from(screenshot.data,'base64'));
  fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:expected,baseUrl,evidence},null,2)+'\n');
  console.log('Enemy resource production Chrome: '+evidence.length+' final HUD/detail scenes PASS');
}catch(error){
  fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),evidence,events:client?.events.filter(e=>e.method==='Runtime.exceptionThrown').slice(-5)},null,2)+'\n');
  throw error;
}finally{
  client?.close();proc.kill();
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(_){}
  await new Promise(resolve=>server.server.close(resolve));
}
