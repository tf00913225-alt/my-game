import {scene,move,cameraFor,nearNpc,findRoute,followRoute,npcRoute} from './scene.mjs';

// One instance owns input, frame, camera, interaction and cleanup. No globals
// from Adventure, Patrol, Player, Save or Economy are accessed.
export function mountCorner(root){
  const world=root.querySelector('[data-world]'),actor=root.querySelector('[data-player]');
  const prompt=root.querySelector('[data-interact]'),dialog=root.querySelector('[data-dialog]');
  const viewport=root.querySelector('.explore-viewport'),marker=root.querySelector('[data-destination]'),status=root.querySelector('[data-status]');
  const directions=new Map(),abort=new AbortController(),signal=abort.signal;
  let state={...scene.spawn,facing:'up',moving:false},frame=0,last=0,opened=false,disposed=false;
  let route=[],destination=null,gesture=null,walkTime=0;
  dialog.hidden=true; // A remounted sample starts closed, including BFCache return.
  for(const item of scene.objects){
    const el=document.createElement('div');el.className='explore-object';el.dataset.object=item.id;
    Object.assign(el.style,{left:item.x+'px',top:item.y+'px',width:item.width+'px',height:item.height+'px',zIndex:String(item.y)});
    el.innerHTML=`<svg viewBox="0 0 ${item.width} ${item.height}" aria-hidden="true"><use href="./art.svg#${item.art}"/></svg>`;
    world.append(el);
  }
  function cancelRoute(){route=[];destination=null;}
  function clearInput(){directions.clear();cancelRoute();gesture=null;state.moving=false;last=0;render();}
  function interact(){
    if(disposed||opened||!nearNpc(state))return;
    opened=true;clearInput();dialog.hidden=false;dialog.querySelector('button').focus();
  }
  function close(){opened=false;dialog.hidden=true;clearInput();root.focus({preventScroll:true});}
  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  root.addEventListener('keydown',e=>{
    if(keys[e.key]){e.preventDefault();if(!opened&&!e.repeat){cancelRoute();directions.set('key:'+e.code,keys[e.key]);status.textContent='方向控制中';}}
    if((e.key==='e'||e.key==='E')&&!e.repeat){e.preventDefault();interact();}
    if(e.key==='Escape'&&opened)close();
  },{signal});
  window.addEventListener('keyup',e=>{directions.delete('key:'+e.code);},{signal});
  for(const button of root.querySelectorAll('[data-direction]')){
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(opened)return;
      cancelRoute();status.textContent='方向控制中';
      // Touch uses one directional pad; most recent held direction wins.
      button.setPointerCapture(e.pointerId);directions.set('pointer:'+e.pointerId,button.dataset.direction);
    },{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>directions.delete('pointer:'+e.pointerId),{signal});
  }
  viewport.addEventListener('pointerdown',e=>{
    if(opened||!e.isPrimary||e.button!==0){gesture=null;return;}
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY};
  },{signal});
  viewport.addEventListener('pointercancel',()=>{gesture=null;},{signal});
  viewport.addEventListener('pointerup',e=>{
    const tap=gesture;gesture=null;
    if(opened||!tap||tap.id!==e.pointerId||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>12)return;
    e.preventDefault();directions.clear();
    const point=window.eventToGamePoint(e),camera=cameraFor(state);
    const target={x:point.x-viewport.offsetLeft+camera.x,y:point.y-viewport.offsetTop+camera.y};
    const npc=scene.objects.find(o=>o.id==='npc');
    const npcHit=target.x>=npc.x-npc.width/2&&target.x<=npc.x+npc.width/2&&target.y>=npc.y-npc.height&&target.y<=npc.y;
    const planned=npcHit?npcRoute(state):findRoute(state,target);route=planned||[];
    destination=route.at(-1)||null;
    status.textContent=destination?(npcHit?'走近村民後，按招呼確認':'前往落點；再點可更改'):planned?'已在落點附近':'此處無法抵達，請另選落點';
    root.focus({preventScroll:true});render();
  },{signal});
  prompt.addEventListener('click',interact,{signal});
  dialog.querySelector('button').addEventListener('click',close,{signal});
  window.addEventListener('blur',clearInput,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();},{signal});
  function render(){
    const camera=cameraFor(state);
    world.style.transform=`translate(${-camera.x}px,${-camera.y}px)`;
    actor.style.left=state.x+'px';actor.style.top=state.y+'px';actor.style.zIndex=String(Math.round(state.y));
    actor.dataset.facing=state.facing;actor.classList.toggle('is-walking',state.moving);
    const pose=state.moving?(Math.floor(walkTime/.16)%4===0?1:Math.floor(walkTime/.16)%4===2?2:0):0;
    const sprite=actor.querySelector('use'),href=`./traveller.svg#${state.facing}-${pose}`;
    if(sprite.getAttribute('href')!==href)sprite.setAttribute('href',href);
    marker.hidden=!destination;if(destination){marker.style.left=destination.x+'px';marker.style.top=destination.y+'px';}
    prompt.disabled=opened||!nearNpc(state);prompt.textContent=nearNpc(state)?'與村民招呼 · E':'靠近村民可招呼';
    for(const button of root.querySelectorAll('[data-direction]'))button.classList.toggle('is-held',[...directions.values()].at(-1)===button.dataset.direction);
    // Read-only observable sample state for QA; not a setter or save surface.
    root.dataset.position=`${state.x.toFixed(2)},${state.y.toFixed(2)}`;
    root.dataset.camera=`${camera.x.toFixed(2)},${camera.y.toFixed(2)}`;
    root.dataset.destination=destination?`${destination.x.toFixed(2)},${destination.y.toFixed(2)}`:'';
  }
  function tick(now){
    if(disposed)return;
    const seconds=last?(now-last)/1000:0;last=now;
    if(document.hidden||opened){state.moving=false;last=0;}
    else if(directions.size)state=move(state,[...directions.values()].at(-1),seconds);
    else if(route.length){state=followRoute(state,route,seconds);if(!route.length){destination=null;status.textContent=nearNpc(state)?'已走近，按招呼確認':'已抵達；點地面繼續走';}}
    else state={...state,moving:false};
    walkTime=state.moving?walkTime+Math.min(seconds,.05):0;
    render();frame=requestAnimationFrame(tick);
  }
  render();frame=requestAnimationFrame(tick);root.focus({preventScroll:true});
  return ()=>{disposed=true;cancelAnimationFrame(frame);abort.abort();directions.clear();state.moving=false;render();world.querySelectorAll('[data-object]').forEach(el=>el.remove());};
}
