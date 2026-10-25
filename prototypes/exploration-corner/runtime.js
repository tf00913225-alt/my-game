// Single runtime source. UI owns routing/Display; services never mutate gameplay here.
(function(scope){
'use strict';
const {scene,move,cameraFor,nearNpc,findRoute,followRoute,npcRoute}=scope.FourSymbolsExplorationGeometry;
let mounted=null;

// One instance owns input, frame, camera, interaction and cleanup. No globals
// from Adventure, Patrol, Player, Save or Economy are accessed.
function mount(root,services={}){
  if(mounted){if(mounted.root===root)return mounted.controller;throw new Error('Exploration already mounted');}
  if(!root?.isConnected)throw new Error('Exploration requires a connected root');
  const eventToPoint=services.eventToPoint||scope.eventToGamePoint;
  if(typeof eventToPoint!=='function')throw new Error('Exploration requires the existing Display coordinate service');
  const data=services.scene||scene;
  const nearby=position=>services.scene?data.objects.filter(o=>o.interaction&&Math.hypot(position.x-o.approach.x,position.y-o.approach.y)<(o.range||145)).sort((a,b)=>Math.hypot(position.x-a.approach.x,position.y-a.approach.y)-Math.hypot(position.x-b.approach.x,position.y-b.approach.y))[0]:nearNpc(position)?{id:'npc',label:'與村民招呼 · E'}:null;
  let analog=null;
  const world=root.querySelector('[data-world]'),actor=root.querySelector('[data-player]');
  const sprites=[...actor.querySelectorAll('[data-pose]')];
  const prompt=root.querySelector('[data-interact]');
  const viewport=root.querySelector('.explore-viewport'),marker=root.querySelector('[data-destination]'),status=root.querySelector('[data-status]');
  const directions=new Map(),captures=new Map();
  let abort=null,active=false,generation=0,interactionGeneration=0,interactionCleanup=null;
  let state={...data.spawn,facing:'up',moving:false},frame=0,last=0,opened=false,disposed=false;
  let route=[],destination=null,gesture=null,walkTime=0;

  for(const item of data.objects){
    const el=document.createElement('div');el.className='explore-object';el.dataset.object=item.id;
    Object.assign(el.style,{left:item.x+'px',top:item.y+'px',width:item.width+'px',height:item.height+'px',zIndex:String(item.y)});
    el.innerHTML=services.renderObject?services.renderObject(item):`<svg viewBox="0 0 ${item.width} ${item.height}" aria-hidden="true"><use href="/prototypes/exploration-corner/art.svg#${item.art}"/></svg>`;
    world.append(el);
  }
  function cancelRoute(){route=[];destination=null;gesture=null;}
  function clearInput(){
    for(const [id,el] of captures){if(el.hasPointerCapture(id))el.releasePointerCapture(id);}
    captures.clear();directions.clear();analog=null;cancelRoute();state.moving=false;last=0;render();
  }
  function endInteraction(){
    interactionGeneration++;
    const cleanup=interactionCleanup;interactionCleanup=null;opened=false;
    cleanup?.();
  }
  function closeInteraction(){
    try{endInteraction();}finally{clearInput();if(active)root.focus({preventScroll:true});}
  }
  function interact(){
    if(!active||opened||!nearby(state))return;
    if(typeof services.onInteract!=='function'){status.textContent='對話尚未接通';return;}
    opened=true;clearInput();const token=generation,interactionToken=++interactionGeneration;
    const close=()=>{
      if(!active||token!==generation||interactionToken!==interactionGeneration||!opened)return;
      closeInteraction();
    };
    try{
      const cleanup=services.onInteract({npcId:nearby(state).id,close});
      if(cleanup!=null&&typeof cleanup!=='function')throw new TypeError('Interaction must return synchronous cleanup');
      if(!active||token!==generation||interactionToken!==interactionGeneration||!opened)cleanup?.();else interactionCleanup=cleanup;
    }catch(error){
      if(active&&token===generation&&interactionToken===interactionGeneration){endInteraction();status.textContent='對話載入失敗，請重試';}
      throw error;
    }
  }
  function requestExit(){
    if(!active)return;
    clearInput();services.requestExit?.();
  }
  function bindInput(){
  const signal=abort.signal;
  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  root.addEventListener('keydown',e=>{
    if(keys[e.key]){e.preventDefault();if(!opened&&!e.repeat){cancelRoute();analog=null;directions.set('key:'+e.code,keys[e.key]);status.textContent='方向控制中';}}
    if((e.key==='e'||e.key==='E')&&!e.repeat){e.preventDefault();interact();}
    if(e.key==='Escape'){e.preventDefault();if(opened)closeInteraction();else requestExit();}
  },{signal});
  window.addEventListener('keyup',e=>{directions.delete('key:'+e.code);},{signal});
  for(const button of root.querySelectorAll('[data-direction]')){
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(opened)return;
      cancelRoute();status.textContent='方向控制中';
      // Touch uses one directional pad; most recent held direction wins.
      button.setPointerCapture(e.pointerId);captures.set(e.pointerId,button);directions.set('pointer:'+e.pointerId,button.dataset.direction);
    },{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{captures.delete(e.pointerId);directions.delete('pointer:'+e.pointerId);},{signal});
  }
  viewport.addEventListener('pointerdown',e=>{
    if(opened||!e.isPrimary||e.button!==0)return;
    gesture={id:e.pointerId};viewport.setPointerCapture(e.pointerId);captures.set(e.pointerId,viewport);
    // Commit at contact, using the current position/camera. Release must not
    // replay a stale target after the character and camera have moved.
    e.preventDefault();directions.clear();analog=null;
    let point;
    try{
      point=eventToPoint(e);
      if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))throw new TypeError('Invalid Display point');
    }catch(_){clearInput();status.textContent='座標尚未就緒，請重試';return;}
    const camera=cameraFor(state,data);
    const target={x:point.x-viewport.offsetLeft+camera.x,y:point.y-viewport.offsetTop+camera.y};
    const npc=services.scene?data.objects.find(o=>o.interaction&&target.x>=o.x-o.width/2&&target.x<=o.x+o.width/2&&target.y>=o.y-o.height&&target.y<=o.y):data.objects.find(o=>o.id==='npc');
    const npcHit=npc&&target.x>=npc.x-npc.width/2&&target.x<=npc.x+npc.width/2&&target.y>=npc.y-npc.height&&target.y<=npc.y;
    const planned=npcHit?(services.scene?findRoute(state,npc.approach,data):npcRoute(state,data)):findRoute(state,target,data);route=planned||[];
    destination=route.at(-1)||null;
    status.textContent=destination?(npcHit?'走近村民後，按招呼確認':'前往落點；再點可更改'):planned?'已在落點附近':'此處無法抵達，請另選落點';
    root.focus({preventScroll:true});render();
  },{signal});
  viewport.addEventListener('pointerup',e=>{captures.delete(e.pointerId);if(gesture?.id===e.pointerId)gesture=null;},{signal});
  viewport.addEventListener('pointercancel',e=>{if(gesture?.id===e.pointerId)clearInput();},{signal});
  const joystick=root.querySelector('[data-joystick]');
  if(joystick){
    let stickId=null;
    const point=e=>{const p=eventToPoint(e);return [p.x-joystick.offsetLeft-joystick.offsetWidth/2,p.y-(joystick.parentElement.offsetTop||0)-joystick.offsetTop-joystick.offsetHeight/2];};
    const update=e=>{if(e.pointerId!==stickId)return;e.preventDefault();const [x,y]=point(e);analog=Math.hypot(x,y)>18?[x,y]:null;};
    joystick.addEventListener('pointerdown',e=>{if(opened||stickId!==null||!e.isPrimary)return;e.preventDefault();stickId=e.pointerId;cancelRoute();directions.clear();joystick.setPointerCapture(e.pointerId);captures.set(e.pointerId,joystick);update(e);},{signal});
    joystick.addEventListener('pointermove',update,{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===stickId){stickId=null;analog=null;captures.delete(e.pointerId);}},{signal});
  }
  prompt.addEventListener('click',interact,{signal});
  root.querySelector('[data-exit]')?.addEventListener('click',requestExit,{signal});
  window.addEventListener('blur',clearInput,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();},{signal});
  window.addEventListener('pagehide',leave,{signal});
  }
  function render(){
    const camera=cameraFor(state,data);
    world.style.transform=`translate(${-camera.x}px,${-camera.y}px)`;
    actor.style.left=state.x+'px';actor.style.top=state.y+'px';actor.style.zIndex=String(Math.round(state.y));
    actor.dataset.facing=state.facing;actor.classList.toggle('is-walking',state.moving);
    const pose=state.moving?(Math.floor(walkTime/.16)%4===0?1:Math.floor(walkTime/.16)%4===2?2:0):0;
    // Keep external SVG instances stable: changing href briefly clears their
    // geometry in Chrome. The same render owner selects one preloaded pose.
    const activePose=`${state.facing}-${pose}`;
    for(const sprite of sprites){
      const visibility=sprite.dataset.pose===activePose?'visible':'hidden';
      if(sprite.getAttribute('visibility')!==visibility)sprite.setAttribute('visibility',visibility);
    }
    marker.hidden=!destination;if(destination){marker.style.left=destination.x+'px';marker.style.top=destination.y+'px';}
    const interaction=nearby(state);prompt.disabled=!active||opened||!interaction;prompt.textContent=interaction?(interaction.label||'交談'):(services.scene?'靠近可互動':'靠近村民可招呼');
    services.onRender?.({state,camera,walkTime,pose});
    for(const button of root.querySelectorAll('[data-direction]'))button.classList.toggle('is-held',[...directions.values()].at(-1)===button.dataset.direction);
    // Read-only observable sample state for QA; not a setter or save surface.
    root.dataset.position=`${state.x.toFixed(2)},${state.y.toFixed(2)}`;
    root.dataset.camera=`${camera.x.toFixed(2)},${camera.y.toFixed(2)}`;
    root.dataset.destination=destination?`${destination.x.toFixed(2)},${destination.y.toFixed(2)}`:'';
  }
  function tick(now){
    if(disposed||!active)return;
    const seconds=last?(now-last)/1000:0;last=now;
    if(document.hidden||opened){state.moving=false;last=0;}
    else if(analog){state=move(state,analog,seconds,data);}
    else if(directions.size){
      const pointer=[...directions].filter(([key])=>key.startsWith('pointer:')).at(-1);
      const held=new Set(directions.values());
      state=move(state,pointer?pointer[1]:[Number(held.has('right'))-Number(held.has('left')),Number(held.has('down'))-Number(held.has('up'))],seconds,data);
    }
    else if(route.length){state=followRoute(state,route,seconds,data);if(!route.length){destination=null;status.textContent=nearNpc(state)?'已走近，按招呼確認':'已抵達；點地面繼續走';}}
    else state={...state,moving:false};
    walkTime=state.moving?walkTime+Math.min(seconds,.05):0;
    render();frame=requestAnimationFrame(tick);
  }
  function enter(){
    if(disposed)throw new Error('Exploration instance destroyed');
    if(active)return;
    generation++;state={...data.spawn,facing:'up',moving:false};walkTime=0;
    active=true;abort=new AbortController();bindInput();clearInput();
    frame=requestAnimationFrame(tick);root.focus({preventScroll:true});
  }
  function leave(){
    if(!active)return;
    active=false;generation++;cancelAnimationFrame(frame);frame=0;abort.abort();
    try{endInteraction();}finally{clearInput();}
  }
  function destroy(){
    if(disposed)return;
    try{leave();}finally{
      disposed=true;world.querySelectorAll('[data-object]').forEach(el=>el.remove());
      if(mounted?.root===root)mounted=null;
    }
  }
  const controller=Object.freeze({enter,leave,destroy});
  mounted={root,controller};render();return controller;
}
scope.FourSymbolsExploration=Object.freeze({mount});
})(globalThis);
