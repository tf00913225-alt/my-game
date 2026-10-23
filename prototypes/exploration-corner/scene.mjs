// EXPLORATION-CORNER-20261023: temporary sample data, no gameplay/save identity.
export const scene = Object.freeze({
  width:1400,height:2600,viewWidth:1080,viewHeight:1320,
  spawn:{x:720,y:1250},speed:320,radius:23,
  objects:[
    {id:'house',art:'house',x:880,y:1030,width:760,height:700,solid:{x:580,y:780,width:580,height:250}},
    {id:'tree',art:'tree',x:330,y:1420,width:650,height:750,solid:{x:298,y:1365,width:64,height:70}},
    {id:'npc',art:'npc',x:1060,y:1350,width:120,height:180,solid:{x:1035,y:1320,width:50,height:50}}
  ]
});

export function canStand(x,y,data=scene){
  const r=data.radius;
  if(x<r||y<r||x>data.width-r||y>data.height-r)return false;
  return !data.objects.some(({solid:b})=>{
    const nx=Math.max(b.x,Math.min(x,b.x+b.width)),ny=Math.max(b.y,Math.min(y,b.y+b.height));
    return Math.hypot(x-nx,y-ny)<r;
  });
}
export function move(state,direction,seconds,data=scene){
  const delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];
  if(!delta)return {...state,moving:false};
  const next={...state,facing:direction,moving:false};
  // Small bounded spatial steps prevent tunnelling even after a slow frame.
  let distance=data.speed*Math.max(0,Math.min(seconds,.05));
  while(distance>0){
    const step=Math.min(distance,4),x=next.x+delta[0]*step,y=next.y+delta[1]*step;
    if(!canStand(x,y,data))break;
    next.x=x;next.y=y;next.moving=true;distance-=step;
  }
  return next;
}
export function cameraFor(state,data=scene){
  return {x:Math.max(0,Math.min(data.width-data.viewWidth,state.x-data.viewWidth/2)),
    y:Math.max(0,Math.min(data.height-data.viewHeight,state.y-data.viewHeight*.72))};
}
export const nearNpc=state=>Math.hypot(state.x-1060,state.y-1350)<165;

// Bounded four-neighbour grid, only for this corner. Every edge uses the same
// collision owner as manual movement, including connections to exact endpoints.
function clearSegment(a,b,data){
  const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(distance/4);
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0;if(!canStand(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,data))return false;}
  return true;
}
function connect(a,b,data){
  for(const corner of [{x:b.x,y:a.y},{x:a.x,y:b.y}]){
    if(clearSegment(a,corner,data)&&clearSegment(corner,b,data))return [corner,b];
  }
  return null;
}
export function findRoute(start,target,data=scene){
  if(!canStand(start.x,start.y,data)||!canStand(target.x,target.y,data))return null;
  const direct=connect(start,target,data);
  if(direct)return direct.filter((p,i)=>Math.hypot(p.x-(i?direct[i-1]:start).x,p.y-(i?direct[i-1]:start).y)>.01);
  const cell=40,cols=Math.floor(data.width/cell),rows=Math.floor(data.height/cell);
  const nodes=Array.from({length:cols*rows},(_,i)=>({x:(i%cols+.5)*cell,y:(Math.floor(i/cols)+.5)*cell}));
  const nearest=point=>nodes.map((p,i)=>({p,i,d:Math.hypot(p.x-point.x,p.y-point.y)})).filter(n=>n.d<=cell*1.5&&canStand(n.p.x,n.p.y,data)).sort((a,b)=>a.d-b.d);
  const starts=nearest(start).map(n=>({...n,link:connect(start,n.p,data)})).filter(n=>n.link);
  const ends=new Map(nearest(target).map(n=>[n.i,connect(n.p,target,data)]).filter(([,link])=>link));
  const queue=[],parents=new Map(),links=new Map();
  for(const n of starts){queue.push(n.i);parents.set(n.i,null);links.set(n.i,n.link);}
  for(let cursor=0;cursor<queue.length;cursor++){
    const id=queue[cursor],p=nodes[id];
    if(ends.has(id)){
      const chain=[];let key=id;while(parents.get(key)!==null){chain.unshift(nodes[key]);key=parents.get(key);}
      const route=[...links.get(key),...chain,...ends.get(id)];
      return route.filter((p,i)=>Math.hypot(p.x-(i?route[i-1]:start).x,p.y-(i?route[i-1]:start).y)>.01);
    }
    for(const next of [id-cols,id+cols,id%cols? id-1:-1,id%cols<cols-1?id+1:-1]){
      if(next<0||next>=nodes.length||parents.has(next)||!clearSegment(p,nodes[next],data))continue;
      parents.set(next,id);queue.push(next);
    }
  }
  return null;
}
export function followRoute(state,route,seconds,data=scene){
  let next={...state,moving:false},remaining=data.speed*Math.max(0,Math.min(seconds,.05)),moved=false;
  while(route.length&&remaining>.001){
    const target=route[0],dx=target.x-next.x,dy=target.y-next.y;
    if(Math.hypot(dx,dy)<.01){route.shift();continue;}
    const direction=Math.abs(dx)>.01?(dx>0?'right':'left'):(dy>0?'down':'up');
    const distance=Math.min(remaining,Math.abs(dx)>.01?Math.abs(dx):Math.abs(dy));
    const step=move(next,direction,distance/data.speed,data),actual=Math.hypot(step.x-next.x,step.y-next.y);
    next=step;moved=moved||actual>0;remaining-=distance;
    if(actual<distance-.01){route.length=0;break;}
    if(Math.hypot(target.x-next.x,target.y-next.y)<.01)route.shift();
  }
  return {...next,moving:moved};
}
export function npcRoute(start,data=scene){
  const npc=data.objects.find(o=>o.id==='npc');
  const candidates=[[0,120],[-120,0],[120,0],[0,-120]].map(([x,y])=>({x:npc.x+x,y:npc.y+y}));
  return candidates.map(p=>findRoute(start,p,data)).filter(Boolean).sort((a,b)=>{
    const length=r=>r.reduce((n,p,i)=>n+Math.hypot(p.x-(i?r[i-1]:start).x,p.y-(i?r[i-1]:start).y),0);
    return length(a)-length(b);
  })[0]||null;
}
