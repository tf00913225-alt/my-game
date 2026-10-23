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
