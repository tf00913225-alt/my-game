const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/39-v143-skill-animation.js'),'utf8');
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
function fn(name,next){return source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'('));}
function node(){return {dataset:{},style:{setProperty(k,v){this[k]=v;}},setAttribute(){}};}
function runtime(){
  const c={Math,String,document:{createElement:node},STATUS_VISUAL_LAYERS:{HARD_CONTROL_BASE:4,ROTATING:5},statusVisual:(src,mode,bucket,extra)=>({src,mode,bucket,visualLayer:mode==='icon'?34:5,...extra})};
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
    assert.ok(n.style.backgroundImage.includes(spec.src));
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
    statusVisualNode:(card,type)=>card&&card.bodies.get(type),createStatusIcon:type=>({type}),
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
