import {scene,move,cameraFor,nearNpc} from './scene.mjs';

// One instance owns input, frame, camera, interaction and cleanup. No globals
// from Adventure, Patrol, Player, Save or Economy are accessed.
export function mountCorner(root){
  const world=root.querySelector('[data-world]'),actor=root.querySelector('[data-player]');
  const prompt=root.querySelector('[data-interact]'),dialog=root.querySelector('[data-dialog]');
  const directions=new Map(),abort=new AbortController(),signal=abort.signal;
  let state={...scene.spawn,facing:'up',moving:false},frame=0,last=0,opened=false,disposed=false;
  dialog.hidden=true; // A remounted sample starts closed, including BFCache return.
  for(const item of scene.objects){
    const el=document.createElement('div');el.className='explore-object';el.dataset.object=item.id;
    Object.assign(el.style,{left:item.x+'px',top:item.y+'px',width:item.width+'px',height:item.height+'px',zIndex:String(item.y)});
    el.innerHTML=`<svg viewBox="0 0 ${item.width} ${item.height}" aria-hidden="true"><use href="./art.svg#${item.art}"/></svg>`;
    world.append(el);
  }
  function clearInput(){directions.clear();state.moving=false;last=0;render();}
  function interact(){
    if(disposed||opened||!nearNpc(state))return;
    opened=true;clearInput();dialog.hidden=false;dialog.querySelector('button').focus();
  }
  function close(){opened=false;dialog.hidden=true;clearInput();root.focus({preventScroll:true});}
  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  root.addEventListener('keydown',e=>{
    if(keys[e.key]){e.preventDefault();if(!opened&&!e.repeat)directions.set('key:'+e.code,keys[e.key]);}
    if((e.key==='e'||e.key==='E')&&!e.repeat){e.preventDefault();interact();}
    if(e.key==='Escape'&&opened)close();
  },{signal});
  window.addEventListener('keyup',e=>{directions.delete('key:'+e.code);},{signal});
  for(const button of root.querySelectorAll('[data-direction]')){
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(opened)return;
      // Touch uses one directional pad; most recent held direction wins.
      button.setPointerCapture(e.pointerId);directions.set('pointer:'+e.pointerId,button.dataset.direction);
    },{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>directions.delete('pointer:'+e.pointerId),{signal});
  }
  prompt.addEventListener('click',interact,{signal});
  dialog.querySelector('button').addEventListener('click',close,{signal});
  window.addEventListener('blur',clearInput,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();},{signal});
  function render(){
    const camera=cameraFor(state);
    world.style.transform=`translate(${-camera.x}px,${-camera.y}px)`;
    actor.style.left=state.x+'px';actor.style.top=state.y+'px';actor.style.zIndex=String(Math.round(state.y));
    actor.dataset.facing=state.facing;actor.classList.toggle('is-walking',state.moving);
    prompt.disabled=opened||!nearNpc(state);prompt.textContent=nearNpc(state)?'與村民招呼 · E':'靠近村民可招呼';
    for(const button of root.querySelectorAll('[data-direction]'))button.classList.toggle('is-held',[...directions.values()].at(-1)===button.dataset.direction);
    // Read-only observable sample state for QA; not a setter or save surface.
    root.dataset.position=`${state.x.toFixed(2)},${state.y.toFixed(2)}`;
    root.dataset.camera=`${camera.x.toFixed(2)},${camera.y.toFixed(2)}`;
  }
  function tick(now){
    if(disposed)return;
    const seconds=last?(now-last)/1000:0;last=now;
    if(document.hidden||opened){state.moving=false;last=0;}
    else state=move(state,[...directions.values()].at(-1),seconds);
    render();frame=requestAnimationFrame(tick);
  }
  render();frame=requestAnimationFrame(tick);root.focus({preventScroll:true});
  return ()=>{disposed=true;cancelAnimationFrame(frame);abort.abort();directions.clear();state.moving=false;render();world.querySelectorAll('[data-object]').forEach(el=>el.remove());};
}
