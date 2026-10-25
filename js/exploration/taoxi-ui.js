(function(scope){
'use strict';
const C=scope.FourSymbolsTaoxiContent;
const progress=scope.FourSymbolsTaoxiProgress.create({
  uid:()=>scope.FourSymbolsAccountSave?.getActiveUid(),
  player:()=>typeof player!=='undefined'?player:null,
  transaction:fn=>scope.v132RunInventoryTransaction?scope.v132RunInventoryTransaction(fn):false,
  addItem:(id,n)=>typeof addPotionToInventory==='function'&&addPotionToInventory(id,n)===true,
  save:()=>typeof saveGame==='function'&&saveGame({source:'taoxi-local-provisional'})===true
});
let root=null,controller=null,origin='home',ownerUid=null,ownerPlayer=null,ownerCharacterId=null,current='map',returnPoint=null,opening=0,dialogCleanup=null;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=name=>'assets/exploration/taoxi-v1/'+name+'.webp';
function ensureRoot(){
  if(root?.isConnected)return root;
  root=document.createElement('section');root.id='explorationPage';root.className='page taoxi-page game-native-ui';root.hidden=true;root.tabIndex=0;root.setAttribute('aria-label','四象江湖探索');
  document.getElementById('game-overlay-layer').append(root);return root;
}
function sameOwner(){return ownerUid&&scope.FourSymbolsAccountSave?.getActiveUid()===ownerUid&&typeof player!=='undefined'&&player===ownerPlayer&&player.id===ownerCharacterId;}
function stop(){controller?.destroy();controller=null;dialogCleanup?.();dialogCleanup=null;}
function leave(){opening++;stop();if(root){root.hidden=true;root.classList.remove('active');}ownerUid=null;ownerPlayer=null;ownerCharacterId=null;}
function close(){const destination=origin;leave();if(destination==='adventure')scope.FourSymbolsAdventure?.open();else if(typeof showPage==='function')showPage('home');document.getElementById(destination==='home'?'taoxiHomeEntry':'taoxiStoryEntry')?.focus();}
function header(title){return '<header class="taoxi-heading"><button type="button" data-back aria-label="返回">←</button><div><small>四象江湖傳</small><h1>'+escape(title)+'</h1></div></header>';}
function bindBack(fn){root.querySelector('[data-back]').addEventListener('click',fn);}
function notify(message){root.querySelector('[data-status]').textContent=message;}
function map(){
  if(!sameOwner()){leave();return;}
  stop();current='map';root.dataset.scene='map';
  let s;try{s=progress.snapshot();}catch(error){root.innerHTML=header('探索紀錄待確認')+'<p class="taoxi-error">'+escape(error.message)+'</p>';bindBack(close);return;}
  const available=C.available(s.chapter);
  root.innerHTML='<div class="taoxi-map-art" role="img" aria-label="雲山溪谷與桃花村落"></div>'+header('四象江湖大地圖')+
    '<div class="taoxi-map-lock lock-one">尚未開放</div><div class="taoxi-map-lock lock-two">尚未開放</div><div class="taoxi-map-lock lock-three">黑松林 · 規劃中</div>'+
    '<button type="button" class="taoxi-region" data-village '+(!available?'disabled':'')+'><span aria-hidden="true">◇</span><strong>桃溪村</strong><small>'+(available?'進入探索':'完成前 5 關及新手教學後開放')+'</small></button>'+
    '<p class="taoxi-map-caption">點選亮起的區域，踏入江湖。</p>';
  bindBack(close);root.querySelector('[data-village]').addEventListener('click',()=>scene('village'));root.focus({preventScroll:true});
}
function objectMarkup(object){
  const arrow=object.autoInteract?'<span class="taoxi-entry-arrow" aria-hidden="true"><svg viewBox="0 0 64 96" focusable="false"><g stroke="#a56108" stroke-width="2" stroke-linejoin="round"><path fill="#fff5a0" d="M4 10 32 2 60 10 32 23Z"/><path fill="#ffe73e" d="M4 10 32 23 32 36 9 25Z"/><path fill="#ffb81f" d="M32 23 60 10 55 25 32 36Z"/><path fill="#fff388" d="M7 46 32 37 57 46 32 59Z"/><path fill="#ffe132" d="M7 46 32 59 32 93Z"/><path fill="#f5a714" d="M32 59 57 46 32 93Z"/></g><path d="M9 10 32 5 54 11M12 46 32 40 51 46" fill="none" stroke="#fffce0" stroke-width="3" stroke-linecap="round"/></svg></span>':'';
  if(object.art==='solid')return '';
  if(object.art==='gate')return '<img src="'+asset('gate')+'" alt="">';
  if(object.art==='house')return '<img src="'+asset('house')+'" alt=""><span class="taoxi-object-label">'+escape(object.name)+'</span>'+arrow;
  if(object.art==='npc')return '<span class="taoxi-npc-sprite" style="background-position:'+({elder:0,ayun:50,woodworker:100}[object.id])+'% 0"></span><span class="taoxi-object-label">'+escape(object.name)+'</span>';
  if(object.art==='door')return '<span class="taoxi-door">出口</span>'+arrow;
  const frames={bed:[0,0,620,624],desk:[640,0,621,610],chest:[0,624,560,623],peach:[560,610,701,637]};
  const frame=frames[object.art],clip='taoxi-frame-'+object.id;
  return '<svg class="taoxi-prop" viewBox="'+frame.join(' ')+'" style="overflow:hidden" aria-hidden="true"><defs><clipPath id="'+clip+'"><rect x="'+frame[0]+'" y="'+frame[1]+'" width="'+frame[2]+'" height="'+frame[3]+'"/></clipPath></defs><image clip-path="url(#'+clip+')" href="'+asset('props')+'" width="1261" height="1247"/></svg>';
}
function scene(id,spawn){
  if(!sameOwner()){leave();return;}
  const s=progress.snapshot();if(!C.available(s.chapter)){map();return;}
  if(id!=='village'&&!C.unlocked(C.houses.find(h=>h.id===id),s.chapter,s.state)){map();return;}
  stop();current=id;root.dataset.scene=id;delete root.dataset.area;
  const data=id==='village'?C.village(spawn):C.interior(id),appearance=C.appearance(s.player);
  for(const object of data.objects)if(object.interaction==='house')object.autoInteract=C.unlocked(object,s.chapter,s.state);
  root.innerHTML=header(id==='village'?'桃溪村':data.name)+
    '<div class="explore-viewport taoxi-viewport"><div class="explore-world taoxi-world" data-world style="width:'+data.width+'px;height:'+data.height+'px">'+
    '<div class="taoxi-ground '+(id==='village'?'taoxi-village-ground':'taoxi-room-ground')+'"></div>'+
    '<div class="explore-player taoxi-player" data-player><span class="explore-shadow"></span><span class="taoxi-character" style="background-image:url('+asset(appearance)+')"></span></div><span class="explore-destination" data-destination hidden></span></div></div>'+
    '<footer class="taoxi-controls"><div data-joystick class="taoxi-joystick" aria-label="虛擬搖桿"><span data-stick-thumb aria-hidden="true">✥</span></div><div><button type="button" data-interact disabled>靠近可互動</button><p data-status role="status">點地移動，也可拖動左側搖桿。</p></div></footer>'+
    '<p class="taoxi-save-note">本機探索紀錄 · 尚非雲端同步</p>';
  const character=root.querySelector('.taoxi-character');
  controller=scope.FourSymbolsExploration.mount(root,{
    scene:data,eventToPoint:event=>scope.eventToGamePoint(event),renderObject:objectMarkup,
    requestExit:()=>id==='village'?map():scene('village',returnPoint),
    onRender({state,pose}){
      if(!sameOwner()){queueMicrotask(leave);return;}
      const rows=appearance==='player_male_03'?{down:0,left:2,right:1,up:3}:{down:0,left:1,right:2,up:3};
      if(id==='village'){
        root.dataset.gateCutaway=String(Math.abs(state.x-900)<270&&state.y>2470&&state.y<3070);
        const area=state.y>2520?'村口':state.y>1680?'廣場':'民宅周圍';
        if(root.dataset.area!==area){root.dataset.area=area;root.querySelector('h1').textContent='桃溪村 · '+area;}
      }
      const row=rows[state.facing];character.style.backgroundPosition=(pose*50)+'% '+(row*100/3)+'%';
      character.style.transform=appearance==='player_female_03'&&state.facing==='left'&&pose>0?'scaleX(-1)':'';
    },
    onInteract({npcId,close:resume}){
      const object=data.objects.find(o=>o.id===npcId);if(!object||!sameOwner()){resume();return;}
      if(object.interaction==='house'){
        const state=progress.snapshot();
        if(!C.unlocked(object,state.chapter,state.state)){
          return scope.FourSymbolsAdventureUI.presentDialogue(root,{name:object.name,lines:[object.hint],onClose:resume});
        }
        returnPoint={x:object.approach.x,y:object.approach.y+85};resume();queueMicrotask(()=>scene(object.id));return;
      }
      if(object.interaction==='exit-map'){resume();queueMicrotask(map);return;}
      if(object.interaction==='exit'){resume();queueMicrotask(()=>scene('village',returnPoint));return;}
      const result=object.interaction==='talk'?progress.talk(object.id):progress.search(object.id);
      notify(result.ok?'已保存至本機探索紀錄。':result.message);
      const lines=result.ok?(object.interaction==='talk'?object.lines:[result.message]):[result.message];
      return scope.FourSymbolsAdventureUI.presentDialogue(root,{name:object.name,lines,onClose:resume});
    }
  });
  bindBack(()=>id==='village'?map():scene('village',returnPoint));controller.enter();
}
async function open(source){
  if(typeof battleActive!=='undefined'&&battleActive)return false;
  const token=++opening;const s=progress.snapshot();
  origin=source==='adventure'?'adventure':'home';ownerUid=s.uid;ownerPlayer=s.player;ownerCharacterId=s.player.id;
  ensureRoot();if(token!==opening)return false;
  if(typeof showPage!=='function')return false;showPage('exploration');root.hidden=false;map();return true;
}
window.addEventListener('pageshow',event=>{if(event.persisted&&root?.classList.contains('active')&&sameOwner()){if(current==='map')map();else scene(current);}});
scope.FourSymbolsTaoxi=Object.freeze({open,leave});
})(globalThis);
