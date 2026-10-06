import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';

const expression=String.raw`(async()=>{
 const check=(v,m)=>{if(!v)throw Error(m);};
 const wait=async(fn)=>{const end=performance.now()+30000;while(!fn()&&performance.now()<end)await new Promise(r=>setTimeout(r,40));check(fn(),'Runtime readiness timeout');};
 await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'));
 await FourSymbolsFeatures.ensure('gameplay-core','portrait-convergence-qa');
 await FourSymbolsFeatures.ensure('feature-boss-relic','portrait-convergence-qa');
 await FourSymbolsFeatures.ensure('abyss','portrait-convergence-qa');
 await FourSymbolsFeatures.ensure('adventure','portrait-convergence-qa');
 await v154RequestMonsterPortraitRegistry();closeHomeFeature();autoBattle=false;autoPatrolEnabled=false;
 const registry=await fetch('config/monster-portrait-registry.json').then(r=>r.json());
 const targets=Object.values(registry.groups).flat().map(row=>Object.fromEntries(registry.tupleSchema.map((k,i)=>[k,row[i]])));
 const pool=registry.assetPool.entries.filter(e=>e.status==='adopted').map(e=>({portraitKey:e.assetId,name:e.displayName,element:e.element,rank:e.tier==='elite'?'elite':e.tier==='miniboss'?'smallBoss':'regular',status:'existing'}));
 const evidence={geometry:[],fallbacks:[],reentry:[],nativeRosters:[]};
 const measure=(m,i,label)=>{
  const card=document.getElementById('battleMonster'+i),art=card?.querySelector('.v174-battle-art'),paint=art?.querySelector('.v174-portrait-paint');
  const record=v154ResolveMonsterPortraitRecord(m);check(card&&art,'missing final presentation '+label);
  if(record.generic){
   const pseudo=getComputedStyle(art,'::before'),box=art.getBoundingClientRect(),cls=card.dataset.portraitSizeClass,contract=registry.presentation.classes[cls];
   const projection=box.height/parseFloat(getComputedStyle(art).height),bodyHeight=parseFloat(pseudo.height)*projection,bottomOffset=parseFloat(pseudo.bottom)*projection;
   check(!paint&&pseudo.content.includes('◇'),'generic fallback is visible');check(record.path===null,'fallback must not impersonate a monster');
   check(box.height>0&&Math.abs(bodyHeight/box.height-contract.bodyHeight)<.02,'generic class height '+label);
   check(Math.abs(bottomOffset/box.height-(1-contract.baseline))<.02,'generic bottom baseline');
   evidence.fallbacks.push({label,name:m.name,key:record.requestedPortraitKey,sizeClass:cls,reason:record.fallbackReason,slotHeight:box.height,visualBodyHeight:bodyHeight,baseline:box.bottom-bottomOffset,clipped:false});return;
  }
  check(paint,'missing normalized paint '+record.portraitKey);
  const a=art.getBoundingClientRect(),p=paint.getBoundingClientRect(),meta=registry.presentation.assets[record.path];
  const [l,t,r,b]=meta.alphaBounds,top=p.top+p.height*t/meta.height,bottom=p.top+p.height*b/meta.height,left=p.left+p.width*l/meta.width,right=p.left+p.width*r/meta.width;
  const baseline=a.top+a.height*.96,clipped=top<a.top-1||bottom>a.bottom+1||left<a.left-1||right>a.right+1;
  check(a.height>0&&p.height>0,'zero presentation geometry '+record.portraitKey);
  check(!clipped,'clipped alpha silhouette '+record.portraitKey+' '+JSON.stringify({a:a.toJSON(),p:p.toJSON(),top,bottom,left,right}));
  check(Math.abs(bottom-baseline)<1,'bottom baseline drift '+record.portraitKey);
  const cls=card.dataset.portraitSizeClass,target=registry.presentation.classes[cls].bodyHeight;
  const expected=Math.min(target*a.height,a.width/(r-l)*(b-t));
  check(Math.abs((bottom-top)-expected)<1.1,'body-height contract drift '+record.portraitKey);
  evidence.geometry.push({label,portraitKey:record.portraitKey,sizeClass:cls,slotHeight:a.height,visualBodyTop:top,visualBodyBottom:bottom,visualBodyHeight:bottom-top,baseline,clipped,overflow:false,widthLimited:expected<target*a.height-1});
 };
 async function scene(roster,label){
  monsters=roster;currentBattleMonsters=roster.map((m,i)=>i);battleActive=false;
  roster.forEach(m=>{m.alive=true;m.hp=m.hp||100;m.maxHP=m.maxHP||100;m.sp=m.sp||0;m.maxSP=m.maxSP||1;m.level=m.level||70;v154BindMonsterPortraitIdentity(m);});
  const prepared=await v154PreparePortraitsForEncounter(roster);check(prepared.state==='ready','portrait preparation '+label);
  FourSymbolsBattlefieldSlots.setActiveEnemySnapshot(FourSymbolsBattlefieldSlots.createEnemyFormationSnapshot(currentBattleMonsters,{originalFormationType:roster.length}));
  showPage('battle');renderBattle();v154SyncMonsterPortraits();
  roster.forEach((m,i)=>measure(m,i,label+'/first'));
  renderBattle();v154SyncMonsterPortraits();roster.forEach((m,i)=>measure(m,i,label+'/redraw'));
  showPage('home');showPage('battle');renderBattle();v154SyncMonsterPortraits();roster.forEach((m,i)=>measure(m,i,label+'/reentry'));
  evidence.reentry.push(label);
 }
 const wild=targets.filter(t=>t.portraitKey.startsWith('wild.')).slice(0,5).map(t=>({...t}));await scene(wild,'Wild');
 for(const type of ['exp','material','gold']){const waves=v148BuildDailyDungeonWaves(type).waves;for(let i=0;i<waves.length;i++){await scene(waves[i],'Daily/'+type+'/'+i);evidence.nativeRosters.push('Daily/'+type+'/'+i);}}
 for(const floor of [1,5,10,100]){await scene(GameplaySystem.buildTowerRoster(floor),'Tower/'+floor);evidence.nativeRosters.push('Tower/'+floor);}
 for(const region of [0,1,2,3,4])for(const stage of [0,4]){await scene(v174AbyssBuildRoster(40,region,stage),'Abyss/'+region+'/'+stage);evidence.nativeRosters.push('Abyss/'+region+'/'+stage);}
 for(const encounter of Object.values(FourSymbolsAdventureContent.encounters)){
  const roster=encounter.enemies.map(e=>MonsterBalance.build({...e,mode:'adventure',chapterId:'chapter_v1',encounterId:encounter.id,context:'adventure/chapter_v1/'+encounter.id}));
  await scene(roster,'Adventure/'+encounter.id);evidence.nativeRosters.push('Adventure/'+encounter.id);
 }
 for(const cls of ['STANDARD','ELITE','SMALL_BOSS','BIG_BOSS']){
  const rank=cls==='STANDARD'?'regular':cls==='ELITE'?'elite':'smallBoss';
  const all=[...targets,...pool];
  for(let start=0;start<all.length;start+=5){await scene(all.slice(start,start+5).map(t=>({...t,rank,v141BattleRank:rank,vGameplayBoss:cls==='BIG_BOSS',vGameplayTowerBoss:false})),cls+'/'+start);}
 }
 check(evidence.geometry.length>2000,'incomplete full portrait matrix');
 // Enter both Boss modes through the production entry owner and preserve its
 // central footprint. The isolated account never settles a reward or Cloud write.
 player.level=100;
 for(const mode of ['personal','world']){
  battleActive=false;window.v132ActiveDungeonRun=null;closeHomeFeature();
  for(const cfg of [autoConfig,autoConfig2,autoConfig3])cfg.enabled=false;
  const definition=(mode==='personal'?GameplaySystem.personalBosses:GameplaySystem.worldBosses)[0];
  if(mode==='world')GameplaySystem.debugReloadState({world:{[definition.id]:{completedStages:3}}});
  check(vGameplayStartBoss(mode,definition.id),'native Boss entry '+mode);
  await wait(()=>battleActive&&document.getElementById('battleMonster0'));
  await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
  await v154PreparePortraitsForEncounter(monsters);renderBattle();v154SyncMonsterPortraits();
  currentBattleMonsters.forEach(i=>measure(monsters[i],i,mode+'/first'));
  renderBattle();v154SyncMonsterPortraits();currentBattleMonsters.forEach(i=>measure(monsters[i],i,mode+'/redraw'));
  showPage('home');showPage('battle');renderBattle();v154SyncMonsterPortraits();currentBattleMonsters.forEach(i=>measure(monsters[i],i,mode+'/reentry'));
  evidence.nativeRosters.push(mode);
  if(mode==='world'){
   turn=10;GameplaySystem.debugProcessBossRound();
   const guards=currentBattleMonsters.filter(i=>monsters[i].unitKind==='boss-reinforcement');
   check(guards.length===2,'native reinforcement creation');
   await v154PreparePortraitsForEncounter(guards.map(i=>monsters[i]));renderBattle();v154SyncMonsterPortraits();
   guards.forEach(i=>measure(monsters[i],i,'Reinforcement/first'));
   renderBattle();v154SyncMonsterPortraits();guards.forEach(i=>measure(monsters[i],i,'Reinforcement/redraw'));
   evidence.nativeRosters.push('Reinforcement');
  }
 }
 check(!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'),'no account overlay over battle');
 return evidence;
})()`;

const bossStart=expression.indexOf(' // Enter both Boss modes');
const matrixExpression=expression.slice(0,bossStart)+' return evidence;\n})()';
const nativeBossExpression=mode=>(expression.slice(0,expression.indexOf(' async function scene'))+expression.slice(bossStart)).replace("['personal','world']",JSON.stringify([mode]));

const deployedBase=process.env.DEV_BASE_URL||'';
if(deployedBase){
 const manifest=await fetch(new URL('release-manifest.json',deployedBase)).then(r=>r.json());
 assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA,'exact deployed portrait SHA');
}
const server=await startServer({baseUrl:deployedBase});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'portrait-convergence-'));
const port=9700+Math.floor(Math.random()*100);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const artifact=path.join(ROOT,'artifacts/browser-qa/monster-portrait-convergence.json');fs.mkdirSync(path.dirname(artifact),{recursive:true});
let client;const evidence=[];
try{
 const targets=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await client.send('Page.enable');await client.send('Runtime.enable');
 for(const [width,height] of [[390,844],[412,915]]){
  // Reset only this isolated QA origin; no player or deployed origin is touched.
  await client.send('Storage.clearDataForOrigin',{origin:new URL(server.url).origin,storageTypes:'local_storage'});
  await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await client.send('Page.navigate',{url:server.url});
  const result=await client.eval(matrixExpression);
  // A fresh isolated origin per native Boss challenge preserves the production
  // pending receipt gate rather than bypassing it to enter the next mode.
  for(const mode of ['personal','world']){
   await client.send('Storage.clearDataForOrigin',{origin:new URL(server.url).origin,storageTypes:'local_storage'});
   await client.send('Page.navigate',{url:server.url});
   const native=await client.eval(nativeBossExpression(mode));
   for(const key of ['geometry','fallbacks','reentry','nativeRosters'])result[key].push(...native[key]);
   const nativeShot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-'+width+'-'+mode+'.png'),Buffer.from(nativeShot.data,'base64'));
  }
  evidence.push({width,height,...result});
  const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-'+width+'.png'),Buffer.from(shot.data,'base64'));
  console.log('Portrait bounds / baseline / first-frame / redraw / reentry PASS '+width+'x'+height+' measurements='+result.geometry.length);
 }
 fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||'local',evidence},null,2)+'\n');
}catch(error){fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),evidence,console:client?.events.filter(e=>e.method==='Runtime.consoleAPICalled').slice(-12)},null,2)+'\n');throw error;}
finally{client?.close();proc.kill();await new Promise(r=>server.server.close(r));}
