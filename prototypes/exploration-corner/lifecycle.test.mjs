import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the exact classic sources as the existing production builder will.
function fixture(){
  class Element extends EventTarget{
    constructor(){super();this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.isConnected=true;this.nodes=new Map();this.children=[];this.captures=new Set();this.attrs={};this.focusCount=0;this.classList={toggle(){}};}
    querySelector(key){return this.nodes.get(key);}
    querySelectorAll(key){if(key==='[data-object]')return this.children;return this.nodes.get(key)||[];}
    append(el){this.children.push(el);el.remove=()=>{this.children=this.children.filter(x=>x!==el);};}
    setAttribute(k,v){this.attrs[k]=v;}
    getAttribute(k){return this.attrs[k];}
    focus(){this.focusCount++;}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
  }
  const root=new Element(),world=new Element(),actor=new Element(),viewport=new Element(),prompt=new Element(),exit=new Element();
  viewport.offsetLeft=0;viewport.offsetTop=0;
  const poses=['up','down','left','right'].flatMap(direction=>[0,1,2].map(n=>{const el=new Element();el.dataset.pose=direction+'-'+n;return el;}));
  actor.nodes.set('[data-pose]',poses);
  const pads=['up','down','left','right'].map(direction=>{const el=new Element();el.dataset.direction=direction;return el;});
  for(const [k,v] of Object.entries({'[data-world]':world,'[data-player]':actor,'[data-interact]':prompt,'.explore-viewport':viewport,'[data-destination]':new Element(),'[data-status]':new Element(),'[data-direction]':pads,'[data-exit]':exit}))root.nodes.set(k,v);
  const window=new EventTarget(),document=new EventTarget();document.createElement=()=>new Element();document.hidden=false;
  let clock=0,serial=0;const frames=new Map();
  const context=vm.createContext({window,document,AbortController,console,requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
  for(const file of ['scene.js','runtime.js'])vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context);
  const emit=(el,type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,props);el.dispatchEvent(event);};
  const step=(count=1)=>{for(let i=0;i<count;i++){clock+=16;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(clock));}};
  return {api:context.FourSymbolsExploration,root,world,viewport,prompt,exit,pads,frames,window,document,emit,step,services:{eventToPoint:e=>({x:e.x,y:e.y})}};
}

test('transparent scene-object padding cannot redirect ground taps to an interaction',()=>{
  const f=fixture();
  const data={width:1080,height:1420,viewWidth:1080,viewHeight:1420,radius:23,speed:320,spawn:{x:540,y:1000},objects:[
    {id:'gate',art:'gate',x:500,y:600,width:500,height:500,hitbox:{x:400,y:500,width:200,height:80},approach:{x:500,y:650},interaction:'exit',label:'離開'}
  ]};
  const c=f.api.mount(f.root,{...f.services,scene:data,renderObject:()=>''});c.enter();
  f.emit(f.viewport,'pointerdown',{pointerId:1,isPrimary:true,button:0,x:350,y:300});
  assert.equal(f.root.dataset.destination,'350.00,300.00');
  f.emit(f.viewport,'pointerup',{pointerId:1});
  f.emit(f.viewport,'pointerdown',{pointerId:2,isPrimary:true,button:0,x:500,y:540});
  assert.equal(f.root.dataset.destination,'500.00,650.00');c.destroy();
});

test('passable NPC taps keep the ground destination and object depth uses its explicit base line',()=>{
  const f=fixture(),data={width:1080,height:1420,viewWidth:1080,viewHeight:1420,radius:23,speed:320,spawn:{x:540,y:1000},objects:[
    {id:'npc',x:540,y:700,width:200,height:200,sortY:650,hitbox:{x:495,y:515,width:90,height:185},approach:{x:540,y:800},interaction:'talk'}
  ]};
  const c=f.api.mount(f.root,{...f.services,scene:data,renderObject:()=>''});c.enter();
  assert.equal(f.world.children[0].style.zIndex,'650');
  f.emit(f.viewport,'pointerdown',{pointerId:1,isPrimary:true,button:0,x:540,y:600});
  assert.equal(f.root.dataset.destination,'540.00,600.00','no automatic stop at NPC approach');c.destroy();
});

test('classic single owner mounts dormant, enters once, leaves without input/RAF, reenters and destroys',()=>{
  const f=fixture(),c=f.api.mount(f.root,f.services);
  assert.equal(f.frames.size,0);assert.equal(f.world.children.length,3);
  assert.equal(f.api.mount(f.root,f.services),c);
  assert.throws(()=>f.api.mount({...f.root},f.services),/already mounted/);
  c.enter();c.enter();assert.equal(f.frames.size,1);
  const start=f.root.dataset.position;
  f.emit(f.pads[3],'pointerdown',{pointerId:7});f.step(4);assert.notEqual(f.root.dataset.position,start);
  assert.equal(f.pads[3].hasPointerCapture(7),true);
  c.leave();c.leave();assert.equal(f.frames.size,0);assert.equal(f.pads[3].hasPointerCapture(7),false);assert.equal(f.root.dataset.destination,'');
  const stopped=f.root.dataset.position;
  f.emit(f.root,'keydown',{key:'ArrowDown',code:'ArrowDown'});f.step(4);assert.equal(f.root.dataset.position,stopped);
  c.enter();assert.equal(f.root.dataset.position,start);f.step(4);assert.equal(f.root.dataset.position,start);
  f.emit(f.window,'pagehide');assert.equal(f.frames.size,0);
  c.destroy();c.destroy();assert.equal(f.world.children.length,0);assert.throws(()=>c.enter(),/destroyed/);
  const next=f.api.mount(f.root,f.services);assert.notEqual(next,c);assert.equal(f.world.children.length,3);next.destroy();
});

test('exit delegates to UI once per active event; old interaction close cannot affect a new entry',()=>{
  const f=fixture();let exits=0,closed=0,lateClose;
  const c=f.api.mount(f.root,{...f.services,requestExit(){exits++;c.leave();},onInteract({close}){lateClose=close;return ()=>closed++;}});
  c.enter();f.emit(f.exit,'click');assert.equal(exits,1);f.emit(f.exit,'click');assert.equal(exits,1);
  c.enter();f.emit(f.root,'keydown',{key:'Escape',code:'Escape'});assert.equal(exits,2);
  c.enter();f.emit(f.pads[3],'pointerdown',{pointerId:1});f.step(45);f.emit(f.pads[3],'pointerup',{pointerId:1});
  assert.equal(f.prompt.disabled,false);f.emit(f.prompt,'click');assert.equal(typeof lateClose,'function');
  const position=f.root.dataset.position;f.emit(f.root,'keydown',{key:'ArrowDown',code:'ArrowDown'});f.step(5);assert.equal(f.root.dataset.position,position);
  const firstClose=lateClose;firstClose();assert.equal(closed,1);f.emit(f.prompt,'click');
  const secondClose=lateClose;firstClose();assert.equal(closed,1,'old close must not close a later interaction in the same entry');
  c.leave();assert.equal(closed,2);c.enter();const focus=f.root.focusCount;secondClose();assert.equal(f.root.focusCount,focus);assert.equal(closed,2);c.destroy();
});

test('background clears route/capture and missing dialogue service never invokes story or save',()=>{
  const f=fixture(),c=f.api.mount(f.root,f.services);c.enter();
  f.emit(f.viewport,'pointerdown',{pointerId:9,isPrimary:true,button:0,x:400,y:1100});assert.notEqual(f.root.dataset.destination,'');
  f.document.hidden=true;f.emit(f.document,'visibilitychange');assert.equal(f.root.dataset.destination,'');assert.equal(f.viewport.hasPointerCapture(9),false);
  f.document.hidden=false;f.emit(f.document,'visibilitychange');const start=f.root.dataset.position;f.step(5);assert.equal(f.root.dataset.position,start);
  f.emit(f.pads[3],'pointerdown',{pointerId:3});f.step(45);f.emit(f.pads[3],'pointerup',{pointerId:3});f.emit(f.prompt,'click');
  assert.equal(f.root.querySelector('[data-status]').textContent,'對話尚未接通');c.destroy();
});

test('Display service failure cancels old movement and releases the new pointer capture',()=>{
  const f=fixture();let fail=false;
  const c=f.api.mount(f.root,{eventToPoint(e){if(fail)throw new Error('Display unavailable');return {x:e.x,y:e.y};}});c.enter();
  const click=id=>f.emit(f.viewport,'pointerdown',{pointerId:id,isPrimary:true,button:0,x:400,y:1100});
  click(1);f.emit(f.viewport,'pointerup',{pointerId:1});assert.notEqual(f.root.dataset.destination,'');f.step(4);
  fail=true;click(2);assert.equal(f.root.dataset.destination,'');assert.equal(f.viewport.hasPointerCapture(2),false);
  const stopped=f.root.dataset.position;f.step(4);assert.equal(f.root.dataset.position,stopped);
  assert.equal(f.root.querySelector('[data-status]').textContent,'座標尚未就緒，請重試');c.destroy();
});

test('throwing interaction cleanup cannot skip local close/focus cleanup',()=>{
  const f=fixture();let close;
  const c=f.api.mount(f.root,{...f.services,onInteract(request){close=request.close;return ()=>{throw new Error('service cleanup failed');};}});
  c.enter();f.emit(f.pads[3],'pointerdown',{pointerId:1});f.step(45);f.emit(f.pads[3],'pointerup',{pointerId:1});f.emit(f.prompt,'click');
  const focus=f.root.focusCount;assert.throws(()=>close(),/service cleanup failed/);
  assert.equal(f.root.focusCount,focus+1);assert.equal(f.prompt.disabled,false);assert.equal(f.root.dataset.destination,'');
  close();c.destroy();assert.equal(f.frames.size,0);
});
