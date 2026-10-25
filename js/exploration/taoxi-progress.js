/* Local provisional play uses the existing UID main-save and Inventory Owner.
   This module never creates Cloud entitlement or calls a story progression API. */
(function(scope){
'use strict';
const C=scope.FourSymbolsTaoxiContent;
function read(player,uid){
  const raw=player?.explorationProgress;
  if(raw===undefined)return {version:1,ownerUid:uid,talked:{},searched:{}};
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(!record(raw)||raw.version!==1||raw.ownerUid!==uid||!record(raw.talked)||!record(raw.searched)||
    Object.entries(raw.talked).some(([k,v])=>!C.npcs.some(n=>n.id===k)||v!==true)||
    Object.entries(raw.searched).some(([k,v])=>!C.points.some(p=>p.id===k)||v!==true))throw Error('探索紀錄無法驗證，請保留存檔並聯絡支援。');
  return JSON.parse(JSON.stringify(raw));
}
function create(services){
  let busy=false;
  function snapshot(){const uid=services.uid(),player=services.player();if(!uid||!player?.id)throw Error('請先登入並載入角色');return {uid,player,state:read(player,uid),chapter:player.adventureProgress?.chapters?.chapter_v1};}
  function commit(kind,id){
    if(busy)return {ok:false,message:'正在保存，請稍候'};
    busy=true;
    try{
      const s=snapshot();if(!C.available(s.chapter))return {ok:false,message:'完成前五關與新手教學後開放'};
      const field=kind==='talk'?'talked':'searched',definition=(kind==='talk'?C.npcs:C.points).find(p=>p.id===id);
      if(!definition)return {ok:false,message:'未知互動'};
      if(kind!=='talk'&&!C.unlocked(C.houses.find(h=>h.id===definition.house),s.chapter,s.state))return {ok:false,message:'民宅尚未開放'};
      if(s.state[field][id]===true)return {ok:true,repeated:true,message:kind==='talk'?'已交談':definition.kind==='reward'?'此處補給已領取':definition.text};
      const old=s.player.explorationProgress,next=JSON.parse(JSON.stringify(s.state));next[field][id]=true;
      let ok=false;
      try{ok=services.transaction(()=>{
        // Source/UID checks occur again immediately before this synchronous commit.
        if(services.uid()!==s.uid||services.player()!==s.player)return false;
        if(definition.kind==='reward'&&services.addItem(definition.item,definition.count)!==true)return false;
        s.player.explorationProgress=next;
        return services.save()===true;
      })===true;}finally{if(!ok){if(old===undefined)delete s.player.explorationProgress;else s.player.explorationProgress=old;}}
      return {ok,message:ok?(definition.text||'已記下村民的話'):'保存失敗或背包已滿，紀錄與獎勵未提交，請重試'};
    }catch(error){return {ok:false,message:error.message};}finally{busy=false;}
  }
  return Object.freeze({snapshot,talk:id=>commit('talk',id),search:id=>commit('search',id)});
}
scope.FourSymbolsTaoxiProgress=Object.freeze({read,create});
})(globalThis);
