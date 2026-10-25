const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/39-v143-skill-animation.js'),'utf8');
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
function fn(name,next){return source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'('));}
function node(){return {dataset:{},children:[],appendChild(n){this.children.push(n);},style:{setProperty(k,v){this[k]=v;}},setAttribute(){}};}
function runtime(){
  const c={Math,String,state:{},window:{},document:{createElement:node},STATUS_VISUAL_LAYERS:{HARD_CONTROL_BASE:4,ROTATING:5},statusVisual:(src,mode,bucket,extra)=>({src,mode,bucket,visualLayer:mode==='icon'?34:5,...extra})};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('const STATUS_BODY_PRESENTATION='),source.indexOf('function protectObject('))+'\nthis.profiles=STATUS_BODY_PRESENTATION;this.specs=RAW_STATUS_VISUALS;'+fn('placeStatusBodyVisual','activeBodyStatusTypesForLayer')+fn('createBodyStatusVisual','createStatusIcon'),c);
  return c;
}
function place(c,type,side,scale=1,cardWidth=300){
  const cardRect=rect(50,40,cardWidth*scale,420*scale);
  const art=rect(100,120,120*scale,200*scale);
  const geometry={artworkProjection:{rect:art},portraitRect:rect(50,40,900,900),hudSurface:{scaleX:scale,scaleY:scale},hudSafeRect:rect(50,art.bottom+8,cardWidth,24)};
  const n=node();
  c.placeStatusBodyVisual(n,side,0,type,{getBoundingClientRect:()=>{throw Error('paint must not read layout');}},{slot:'F1',rect:cardRect},geometry,cardRect);
  const width=parseFloat(n.style.width)*scale,height=parseFloat(n.style.height)*scale;
  return {n,art,geometry,box:rect(cardRect.left+parseFloat(n.style.left)*scale-width/2,cardRect.top+parseFloat(n.style.top)*scale-height/2,width,height)};
}
test('status placement follows projected artwork across card scale and both sides, not the card carrier',()=>{
  const c=runtime();
  for(const side of ['player','monster'])for(const scale of [.6,1,1.6]){
    const a=place(c,'burn',side,scale),b=place(c,'burn',side,scale,600);
    assert.deepEqual(a.box,b.box,'extra transparent card width must not enlarge or move the status');
    assert.ok(Math.abs(a.box.bottom-a.art.bottom)<1e-8,'feet remain at artwork feet after client/local conversion');
    assert.ok(a.box.bottom<a.geometry.hudSafeRect.top,'feet do not drop into HP/HUD below artwork');
    assert.ok(a.box.height<a.art.height,'burn remains a lower-body effect');
    assert.ok(Math.abs(a.box.left+a.box.width/2-(a.art.left+a.art.width/2))<1e-8);
  }
});
test('head symbol clears overhead HP and hard-control frames still enclose the full artwork height',()=>{
  const c=runtime();
  for(const side of ['player','monster'])for(const scale of [.7,1.4]){
    for(const type of ['freeze','petrify']){
      const {box,art}=place(c,type,side,scale);
      assert.ok(box.top<=art.top&&box.bottom>=art.bottom-1e-8,'hard control must not become a foot-only ring');
      assert.ok(box.width>=art.width,'enclosure retains character width');
    }
    const art=rect(100,140,100,200),hud=rect(90,95,120,20),n=node();
    c.placeStatusBodyVisual(n,side,0,'stun',{}, {slot:'F1'}, {artworkProjection:{rect:art},hudSafeRect:hud},rect(0,0,300,400));
    assert.ok(parseFloat(n.style.top)-parseFloat(n.style.height)/2>=hud.bottom,'head symbol must clear overhead HP');
    assert.ok(parseFloat(n.style.top)<art.top+art.height/4,'head symbol stays in the head region');
  }
});
test('21 status identities retain 14 varied body presentations, five icons and two invisible states',()=>{
  const c=runtime(),specs=c.specs;
  assert.equal(Object.keys(specs).length,21);
  const bodies=Object.keys(specs).filter(k=>specs[k].src&&specs[k].mode!=='icon');
  assert.deepEqual(Object.keys(c.profiles).sort(),bodies.sort());
  assert.equal(bodies.length,14);
  assert.equal(Object.values(specs).filter(s=>s.mode==='icon').length,5);
  assert.equal(Object.values(specs).filter(s=>s.mode==='none').length,2);
  assert.equal(new Set(Object.values(c.profiles).map(p=>JSON.stringify(p))).size,14,'profiles preserve the fourteen distinct body presentations');
  for(const [type,spec] of Object.entries(specs)){
    if(spec.mode==='icon'||spec.mode==='none'){assert.equal(c.profiles[type],undefined);continue;}
    const n=c.createBodyStatusVisual(type,spec);
    assert.equal(n.style.backgroundSize,'contain','whole source ratio remains visible, without cover cropping');
    assert.equal(n.style.backgroundPosition,'center');
    if(c.profiles[type].aura){
      assert.equal(n.style.backgroundImage,'none');assert.equal(n.dataset.presentationRole,'foot-aura');
      assert.equal(n.children.length,1);assert.equal(n.children[0].className,'v143-status-aura-rise');
    }else assert.ok(n.style.backgroundImage.includes(spec.src));
  }
});
test('sync never creates body nodes for icon-only or invisible states',()=>{
  const c=runtime(),created=[],icons=[],removed=[];
  Object.assign(c,{STATUS_VISUALS:c.specs,cardFor:()=>({appendChild:n=>created.push(n)}),entityFor:()=>({hp:100}),hasTimedEffect:()=>true,deferredStatusDuringCast:()=>false,
    removeStatusVisual:(card,side,index,type)=>removed.push(type),statusIconHost:()=>({appendChild:n=>icons.push(n)}),statusIconNode:()=>null,statusVisualNode:()=>null,createStatusIcon:type=>type,slotAnchor:()=>{throw Error('non-body state requested body geometry');}});
  vm.runInContext(fn('syncStatusVisual','placeStatusBodyVisual'),c);
  for(const [type,spec] of Object.entries(c.specs))if(spec.mode==='icon'||spec.mode==='none')c.syncStatusVisual('player',0,type,true,{});
  assert.deepEqual(created,[]);
  assert.equal(icons.length,5);
  assert.deepEqual(removed.sort(),['fireMomentum','stealthSkill']);
});
test('a unit shares one geometry snapshot across rotating and fixed body states',()=>{
  const c=runtime(),calls=[],synced=[];
  const snapshot={portraitRect:rect(0,0,100,200)};
  Object.assign(c,{entityFor:()=>({hp:100}),cardFor:()=>({classList:{toggle(){}},getBoundingClientRect:()=>rect(0,0,100,200)}),slotAnchor:()=>({slot:'F1',rect:rect(0,0,100,200)}),hasTimedEffect:()=>false,
    activeBodyStatusTypesForLayer:(entity,side,index,layer)=>layer===4?['freeze']:['burn','rage'],reportHardControlVisualContractViolation(){},
    statusRotationByUnit:new Map(),window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(...args){calls.push(args);return snapshot;}}},
    syncStatusVisual:(side,index,type,showBody,geometry)=>synced.push({type,showBody,geometry})});
  vm.runInContext(fn('readStatusPresentation','syncStatusVisualEffects'),c);
  c.syncStatusVisualsForUnit('player',0,false);
  assert.equal(calls.length,1);
  assert.ok(synced.every(s=>s.geometry===snapshot));
  const visible=synced.filter(s=>s.showBody).map(s=>s.type);
  assert.ok(visible.includes('freeze')&&visible.includes('burn')&&!visible.includes('rage'));
  synced.length=0;c.syncStatusVisualsForUnit('player',0,true);
  assert.ok(synced.find(s=>s.type==='rage').showBody,'rotation advances without replacing fixed hard control');
  assert.ok(synced.find(s=>s.type==='freeze').showBody);
});

test('a full rotation reads every unit before DOM writes and refreshes one snapshot per unit on the next pass',()=>{
  const c=runtime(),cards=new Map(),log=[],geometryReads=new Map(),anchorReads=new Map(),cardReads=new Map();
  const active=new Set(['freeze','burn','rage','frostbite','agilityDown','damageDown','defenseDown','phoenixMight']);
  let wrote=false,offset=0;
  const read=(kind,key)=>{assert.equal(wrote,false,kind+' after a status DOM mutation forces synchronous layout');log.push('read:'+kind+':'+key);};
  const write=()=>{wrote=true;log.push('write');};
  for(const side of ['monster','player'])for(let i=0;i<3;i++){
    const key=side+':'+i,box=()=>rect(i*150,side==='monster'?0:250+offset,120,200);
    const card={key,bodies:new Map(),icons:new Map(),classList:{toggle:write},getBoundingClientRect(){read('cardRect',key);cardReads.set(key,(cardReads.get(key)||0)+1);return box();},appendChild(n){write();this.bodies.set(n.dataset.statusType,n);n.remove=()=>{write();this.bodies.delete(n.dataset.statusType);};}};
    card.host={appendChild(n){write();card.icons.set(n.type,n);}};cards.set(key,card);
  }
  Object.assign(c,{STATUS_VISUALS:c.specs,currentBattleMonsters:[0,1,2],statusRotationByUnit:new Map(),reportHardControlVisualContractViolation(){},
    cardFor:(side,i)=>cards.get(side+':'+i)||null,entityFor:(side,i)=>cards.has(side+':'+i)?{hp:100}:null,hasTimedEffect:(e,type)=>!!e&&active.has(type),deferredStatusDuringCast:()=>false,
    purgeLegacyCardVfx:write,statusIconHost:(side,i,card)=>card&&card.host,statusIconNode:(host,type)=>{const card=[...cards.values()].find(c=>c.host===host);return card&&card.icons.get(type);},
    statusVisualNode:(card,type)=>card&&card.bodies.get(type),createStatusIcon:type=>({type,dataset:{}}),
    removeStatusVisual:(card,side,i,type)=>{const n=card&&card.bodies.get(type);if(n)n.remove();},
    slotAnchor(side,i){const key=side+':'+i;read('anchor',key);anchorReads.set(key,(anchorReads.get(key)||0)+1);return {slot:key,rect:rect(i*150,side==='monster'?0:250+offset,120,200)};},
    window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(side,i){const key=side+':'+i;read('geometry',key);geometryReads.set(key,(geometryReads.get(key)||0)+1);return {artworkProjection:{rect:rect(i*150,side==='monster'?0:250+offset,120,200)}};}}}});
  vm.runInContext(fn('syncStatusVisual','placeStatusBodyVisual')+fn('activeBodyStatusTypesForLayer','reportHardControlVisualContractViolation')+fn('readStatusPresentation','removeStatusVisualEffects'),c);
  c.syncStatusVisualEffects(false);
  const firstTop=parseFloat(cards.get('player:0').bodies.get('freeze').style.top);
  assert.equal([...cards.values()].reduce((n,c)=>n+c.bodies.size,0),12);
  assert.equal([...cards.values()].reduce((n,c)=>n+c.icons.size,0),30);
  const lastRead=log.map((v,i)=>v.startsWith('read:')?i:-1).reduce((a,b)=>Math.max(a,b));
  assert.ok(lastRead<log.indexOf('write'),'all units must be measured before even the first unit mutates');
  offset=30;wrote=false;log.length=0;c.syncStatusVisualEffects(true);
  for(const key of cards.keys()){
    assert.equal(geometryReads.get(key),2);assert.equal(anchorReads.get(key),2);assert.equal(cardReads.get(key),2);
    assert.ok(cards.get(key).bodies.has('freeze'),'hard control remains fixed while rotating body changes');
    assert.ok(cards.get(key).bodies.has('rage'));
  }
  // Card and portrait both moved 30px, so local paint position stays identical.
  assert.equal(parseFloat(cards.get('player:0').bodies.get('freeze').style.top),firstTop,'second pass refreshes both card and portrait rather than mixing an old card rect with new art');
  assert.equal([...cards.values()].reduce((n,c)=>n+c.bodies.size,0),12);
  assert.equal([...cards.values()].reduce((n,c)=>n+c.icons.size,0),30);
});

test('only a head symbol intersecting the cached paired HUD moves, without changing its size or other status profiles',()=>{
  const c=runtime();
  for(const scale of [.7,1,1.4]){
    const art=rect(100*scale,150*scale,100*scale,160*scale),cardRect=rect(0,0,300*scale,400*scale);
    const geometry={artworkProjection:{rect:art},hudSurface:{scaleX:scale,scaleY:scale},hudSafeRect:rect(0,350*scale,300*scale,40*scale)};
    const placeCached=(type,hud)=>{const n=node();c.placeStatusBodyVisual(n,'player',3,type,{}, {slot:'ALLY_B1',rect:cardRect},geometry,cardRect,hud);const w=parseFloat(n.style.width)*scale,h=parseFloat(n.style.height)*scale;return {n,box:rect(parseFloat(n.style.left)*scale-w/2,parseFloat(n.style.top)*scale-h/2,w,h)};};
    const original=placeCached('stun'),front=rect(90*scale,original.box.top+3*scale,130*scale,18*scale);
    const moved=placeCached('stun',front);
    assert.ok(moved.box.top>=front.bottom+2-1e-8,'full existing head frame clears the paired HUD');
    assert.equal(moved.box.width,original.box.width);assert.equal(moved.box.height,original.box.height);
    assert.equal(moved.n.style['--v143-status-opacity-min'],original.n.style['--v143-status-opacity-min']);
    assert.deepEqual(placeCached('stun',rect(400*scale,front.top,front.width,front.height)).box,original.box,'a neighboring column must not move this head symbol');
    assert.deepEqual(placeCached('stun',rect(front.left,original.box.top-100*scale,front.width,10*scale)).box,original.box,'a nonintersecting same-column HUD keeps its accepted placement');
    for(const type of ['burn','freeze','petrify'])assert.deepEqual(placeCached(type,front).box,placeCached(type).box,'feet/full-body hard control must not receive the head-only clamp');
  }
});

test('paired front HUD geometry shares the entire pre-write pass cache even when its unit is visited later',()=>{
  const c=runtime(),reads=new Map(),snapshots=[];let wrote=false,hudOffset=0;
  const card={classList:{toggle(){wrote=true;}},getBoundingClientRect(){assert.equal(wrote,false);return rect(0,100,150,200);}};
  Object.assign(c,{currentBattleMonsters:[],entityFor:(side,index)=>({hp:100,index}),cardFor:()=>card,
    activeBodyStatusTypesForLayer:(entity,side,index,layer)=>layer===5?(index===0?['stun']:index===4?['burn']:[]):[],
    slotAnchor:(side,index)=>{assert.equal(wrote,false);return {slot:index===0?'ALLY_B1':'ALLY_F1',rect:rect(0,100,150,200)};},
    statusRotationByUnit:new Map(),reportHardControlVisualContractViolation(){},hasTimedEffect:()=>false,purgeLegacyCardVfx(){wrote=true;},
    syncStatusVisual:(side,index,type,show,geometry,snapshot)=>snapshots.push({index,type,snapshot}),
    window:{FourSymbolsBattlefieldSlots:{getCharacterAtAllySlot:slot=>slot==='ALLY_F1'?4:null},FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(side,index){assert.equal(wrote,false,'paired HUD read must not follow any DOM write');reads.set(index,(reads.get(index)||0)+1);return {artworkProjection:{rect:rect(0,150,100,160)},hudSafeRect:rect(0,110+hudOffset,150,25)};}}}});
  vm.runInContext(fn('readStatusPresentation','removeStatusVisualEffects'),c);
  c.syncStatusVisualEffects(false);
  const first=snapshots.find(row=>row.index===0&&row.type==='stun').snapshot;
  assert.equal(first.pairedFrontHudRect.bottom,135);
  assert.deepEqual([...reads.entries()].sort(),[[0,1],[4,1]],'paired read and later own-unit read share one geometry result');
  const firstFront=snapshots.find(row=>row.index===4&&row.type==='burn').snapshot;
  assert.equal(first.pairedFrontHudRect,firstFront.geometry.hudSafeRect,'clamp consumes the same formal HUD snapshot as its actual front recipient');
  wrote=false;hudOffset=30;snapshots.length=0;c.syncStatusVisualEffects(false);
  assert.equal(snapshots.find(row=>row.index===0&&row.type==='stun').snapshot.pairedFrontHudRect.bottom,165,'next pass must refresh rather than reuse an earlier layout');
  assert.deepEqual([...reads.entries()].sort(),[[0,2],[4,2]]);
});

test('the three named buffs are low foot auras and keep their formal state identities',()=>{
  const c=runtime();
  for(const [type,color] of Object.entries({rage:'red',dodgeSkill:'green',dinghaishenzhen:'blue'})){
    for(const side of ['player','monster']){
      const result=place(c,type,side);
      assert.ok(result.box.height<=result.art.height*.16,'aura must stay low, away from the face');
      assert.ok(Math.abs(result.box.bottom-result.art.bottom)<1e-8);
      const visual=c.createBodyStatusVisual(type,c.specs[type]);
      assert.equal(visual.dataset.statusType,type);assert.equal(visual.dataset.auraColor,color);
      assert.equal(visual.dataset.presentationRole,'foot-aura');assert.equal(visual.children.length,1);
    }
  }
  assert.equal(c.profiles.fireCritical,undefined,'the attack must not become a persistent buff');
  assert.equal(c.profiles.relicBuff,undefined,'aggregate relic/total stats must not invent a named buff');
});

test('existing square shell sources expand around narrow portraits but accurately report the HUD-limited contain result',()=>{
  const c=runtime(),art=rect(100,100,60,100),cardRect=rect(50,0,150,260),geometry={artworkProjection:{rect:art},hudSafeRect:rect(50,70,150,24),hudSurface:{scaleX:1,scaleY:1}};
  for(const type of ['earthShield','rockWall']){
    const render=front=>{const n=c.createBodyStatusVisual(type,c.specs[type]);c.placeStatusBodyVisual(n,'monster',0,type,{}, {slot:'ENEMY_F1',rect:cardRect},geometry,cardRect,front);const w=parseFloat(n.style.width),h=parseFloat(n.style.height);return {n,w,h,top:parseFloat(n.style.top)-h/2,bottom:parseFloat(n.style.top)+h/2};};
    const roomy=render();assert.equal(roomy.n.dataset.presentationRole,'outer-shell');assert.equal(roomy.w,roomy.h);
    assert.ok(roomy.w>art.width*1.5,'source must no longer collapse to the narrow portrait width');
    assert.ok(roomy.h>=art.height);assert.equal(roomy.bottom,art.bottom);assert.ok(roomy.top>=geometry.hudSafeRect.bottom+2);
    assert.equal(roomy.n.style.backgroundSize,'contain');assert.ok(roomy.n.style.backgroundImage.includes(c.specs[type].src));
    const tight=render(rect(50,90,150,30));assert.equal(tight.w,tight.h);assert.equal(tight.bottom,art.bottom);assert.ok(tight.top>=122);
    assert.ok(Number(tight.n.dataset.shellHeightCoverage)<1,'a short HUD-limited square must be reported honestly, not called a full-height shell');
    assert.equal(Number(tight.n.dataset.shellPaintSize),tight.w);
  }
});

test('outer shells remain visible behind portrait paint while hard controls keep their foreground plane in three and six-unit layouts',async()=>{
  const os=require('node:os'),{spawnSync}=require('node:child_process');
  const {findChrome}=await import('../.github/scripts/runtime-browser-qa-support.mjs');
  const css=fs.readFileSync(path.join(__dirname,'../css/40-v143-combat-dungeon-polish.css'),'utf8');
  const fixed=fs.readFileSync(path.join(__dirname,'../css/fixed-slot-battlefield-rendering-v2.css'),'utf8');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'status-shell-plane-'));
  try{
    const fixture=path.join(directory,'fixture.html');
    fs.writeFileSync(fixture,`<!doctype html><style>${fixed}\n${css}</style><style>
    /* Geometry is fixed for hit-testing; production CSS still owns all planes,
       card isolation/transparency and role selectors. */
    #battlePage{display:block!important} .v-fixed-ally-slot,.v-fixed-battle-slot{position:relative!important;width:120px!important;height:130px!important;display:inline-block!important}
    .battle-player,.battle-monster{position:relative!important;width:120px!important;height:130px!important}
    .v174-battle-art{left:35px!important;right:auto!important;top:20px!important;bottom:auto!important;width:50px!important;height:90px!important;background:red!important}
    .v143-status-visual{left:60px!important;top:65px!important;width:110px!important;height:110px!important;background:gold!important;pointer-events:auto!important;opacity:1!important}
    </style><div id="game-stage"><div id="app"><div id="game-content"><div id="battlePage" class="v-fixed-slot-render-v2"></div></div></div></div><script>
    const records=[],page=document.getElementById('battlePage');
    for(const count of [3,6]){page.replaceChildren();for(const side of ['player','monster'])for(let i=0;i<count;i++){
      const slot=document.createElement('div');slot.className=side==='player'?'v-fixed-ally-slot':'v-fixed-battle-slot v-fixed-enemy-slot';
      slot.innerHTML='<div class="'+(side==='player'?'battle-player':'battle-monster')+' v174-cardless-unit"><div class="v174-battle-art"></div><div class="v143-status-visual v143-status-visual--layer-rotating" data-presentation-role="outer-shell"></div></div>';page.appendChild(slot);
      const card=slot.firstChild,art=card.firstChild,shell=card.lastChild;
      for(const [key,value] of Object.entries({position:'fixed',left:(20+(i%3)*140)+'px',top:(20+(side==='player'?350:0)+Math.floor(i/3)*150)+'px',width:'120px',height:'130px'}))slot.style.setProperty(key,value,'important');
      for(const [key,value] of Object.entries({left:'35px',right:'auto',top:'20px',bottom:'auto',width:'50px',height:'90px'}))art.style.setProperty(key,value,'important');
      // Hit testing observes paint order only; real presentation stays inert.
      art.style.setProperty('pointer-events','auto','important');shell.style.setProperty('pointer-events','auto','important');
      const r=shell.getBoundingClientRect(),a=art.getBoundingClientRect(),hit=(x,y)=>document.elementFromPoint(x,y);
      const center=hit(a.left+a.width/2,a.top+a.height/2)===art,edge=hit(r.left+2,r.top+r.height/2)===shell;
      const before=[r.left,r.top,r.width,r.height];shell.removeAttribute('data-presentation-role');shell.className='v143-status-visual v143-status-visual--layer-hard-control-base';
      const hardControl=hit(a.left+a.width/2,a.top+a.height/2)===shell,after=shell.getBoundingClientRect();
      records.push({count,side,center,edge,hardControl,before,art:[a.left,a.top,a.width,a.height],artZ:getComputedStyle(art).zIndex,after:[after.left,after.top,after.width,after.height],background:getComputedStyle(card).backgroundColor,isolation:getComputedStyle(card).isolation});
    }}
    const out=document.createElement('pre');out.id='result';out.textContent=JSON.stringify(records);document.body.appendChild(out);
    </script>`);
    const result=spawnSync(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--window-size=1600,1200','--user-data-dir='+path.join(directory,'profile'),'--dump-dom','file:///'+fixture.replace(/\\/g,'/')],{encoding:'utf8',timeout:30000,maxBuffer:3e6});
    assert.equal(result.status,0,result.stderr);const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(match,'browser must execute stacking checks');
    const rows=JSON.parse(match[1]);assert.equal(rows.length,18);
    for(const row of rows){assert.ok(row.center,'portrait must occlude shell front ribbons');assert.ok(row.edge,'shell perimeter must remain visible');assert.ok(row.hardControl,'freeze/petrify foreground must remain intact');assert.deepEqual(row.after,row.before,'plane change must not resize or move source');assert.equal(row.background,'rgba(0, 0, 0, 0)');assert.equal(row.isolation,'isolate');}
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('Wind status narrow reads preserve the full fallback for all other skills',()=>{
 const c=runtime(),calls=[];const snapshot={portraitRect:rect(0,0,100,200)};
 Object.assign(c,{entityFor:()=>({hp:100}),cardFor:()=>({getBoundingClientRect:()=>rect(0,0,100,200)}),slotAnchor:()=>({slot:'F1',rect:rect(0,0,100,200)}),
 activeBodyStatusTypesForLayer:()=>['freeze'],window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(){calls.push('full');return snapshot;},getStatusGeometry(){calls.push('status');return snapshot;}}}});
 vm.runInContext(fn('readStatusPresentation','syncStatusVisualsForUnit'),c);
 c.state.current={hitFeedback:{config:{enabled:true,profile:{element:'wind'}}}};assert.equal(c.readStatusPresentation('player',0).geometry,snapshot);
 c.state.current.hitFeedback.config.profile.element='fire';c.readStatusPresentation('player',0);
 c.state.current.hitFeedback.config.profile.element='wind';c.state.current.hitFeedback.config.enabled=false;c.readStatusPresentation('player',0);
 assert.deepEqual(calls,['status','full','full']);
});
