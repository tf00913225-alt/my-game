const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/00-main.js','utf8');const block=source.slice(source.indexOf('function positionBattleSkillNameBadge('),source.indexOf('function showSkillNameBadge('));
function fixture(blocked=false){const self={id:'battlePlayerCard3',getBoundingClientRect:()=>({left:100,top:500,width:120,height:120})},other={id:'battlePlayerCard0'};const projection={unitRect:{left:100,top:500,width:120,height:120},artworkProjection:{rect:{left:102,top:510,width:100,height:100}},hudSafeRect:{left:100,top:612,width:120,height:20}};const before={artworkProjection:{rect:{left:100,top:350,width:120,height:110}},hudSafeRect:{left:100,top:465,width:120,height:30}};const badge={dataset:{},textContent:'長技能名稱保持完整',offsetWidth:90,offsetHeight:38,style:{setProperty(k,v){this[k]=v}}};const c={window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry:(_s,i)=>i===3?projection:before}},document:{querySelectorAll:selector=>selector.includes("battleTurnIndicator")?[]:blocked?[self,other]:[self]}};vm.createContext(c);vm.runInContext(block,c);return {c,self,badge,projection};}
test('original badge reads actual portrait projection and keeps full long-name title',()=>{const f=fixture();f.c.positionBattleSkillNameBadge(f.badge,'player',3,f.self);assert.equal(f.badge.style.left,'152px');assert.equal(f.badge.style.top,'504px');assert.equal(f.badge.dataset.battleAnchor,'player:3');assert.equal(f.badge.title,'長技能名稱保持完整');assert.ok(parseFloat(f.badge.style['--skill-name-max-width'])<120);assert.equal(f.projection.artworkProjection.rect.top,510);});
test('dense rear-row label stays at its caster instead of walking into the front row',()=>{const f=fixture(true);f.c.positionBattleSkillNameBadge(f.badge,'player',3,f.self);assert.ok(parseFloat(f.badge.style.top)>=500&&parseFloat(f.badge.style.top)<=610);assert.ok(parseFloat(f.badge.style.top)-38*1.05>=495);assert.doesNotMatch(block,/setTimeout|setInterval|\.animate\(|battlePhase\s*=|activeBattleCharacterIndex\s*=/);});

test('top-row label uses its caster upper portrait band without covering HUD',()=>{const f=fixture();f.projection.artworkProjection.rect.top=47;f.projection.hudSafeRect.top=17;Object.defineProperty(f.badge,'offsetHeight',{get:()=>f.badge.dataset.compact?14:38});f.c.positionBattleSkillNameBadge(f.badge,'monster',3,f.self);assert.ok(parseFloat(f.badge.style.top)-38*1.05>=37);assert.ok(parseFloat(f.badge.style.top)<=147);});

test('visible announcement keeps the name by its caster rather than in PC gutter',()=>{
 const f=fixture();f.c.window.innerWidth=1280;f.projection.unitRect.left=440;f.projection.artworkProjection.rect={left:450,top:62,width:100,height:75};f.projection.hudSafeRect={left:450,top:17,width:100,height:25};
 const banner={left:450,top:11,width:375,height:50};
 f.c.document.querySelectorAll=s=>s.includes('battleTurnIndicator')?[{getBoundingClientRect:()=>banner}]:[f.self];
 Object.defineProperty(f.badge,'offsetHeight',{get:()=>f.badge.dataset.compact?14:38});
 f.c.positionBattleSkillNameBadge(f.badge,'monster',3,f.self);
 const x=parseFloat(f.badge.style.left),y=parseFloat(f.badge.style.top);
 assert.ok(x>=440&&x<=560);assert.ok(y-38*1.05>=61&&y<=137);
 assert.deepEqual(banner,{left:450,top:11,width:375,height:50});assert.equal(f.projection.hudSafeRect.top,17);
});

test('both formal badge callers anchor caster identity and retain independent impact recipients',()=>{
 const anchored=[],impacts=[],timers=[],nodes=[];
 const body={appendChild:n=>{n.parentNode=body;nodes.push(n)},removeChild:n=>{nodes.splice(nodes.indexOf(n),1);n.parentNode=null}};
 const c={window:{v142PlaySkillAnimationFromBadge:(...args)=>impacts.push(args)},document:{body,createElement:()=>({dataset:{},style:{setProperty(){}}})},$:id=>({id,getBoundingClientRect:()=>({left:10,top:10,width:100,height:100})}),createBattleTargetContract:(_side,_name,_element,_actor,id,ids)=>({targetId:id,targetIds:ids}),getSkillNameBadgeDuration:()=>500,positionBattleSkillNameBadge:(_badge,side,index,element)=>anchored.push({side,index,id:element.id}),setTimeout:fn=>timers.push(fn)};
 vm.createContext(c);
 for(const name of ['showSkillNameBadge','showMonsterSkillNameBadge']){
  const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start)+2;assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),c);
 }
 c.showSkillNameBadge('暴風亂擊','wind',4,1,[0,1,2],'monster','tri');
 c.showMonsterSkillNameBadge('狂風術','wind',5,2,[2],'player','single');
 assert.deepEqual(anchored,[{side:'player',index:4,id:'battlePlayerCard4'},{side:'monster',index:5,id:'battleMonster5'}]);
 assert.deepEqual(impacts.map(a=>[a[0],a[3],a[4],Array.from(a[5])]),[['player',4,1,[0,1,2]],['monster',5,2,[2]]]);
 assert.equal(nodes.length,2);timers.forEach(fn=>fn());assert.equal(nodes.length,0,'original label lifecycle clears both transient badges');
});
