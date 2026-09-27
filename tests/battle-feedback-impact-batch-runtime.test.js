"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/battle-floating-feedback-owner.js","utf8");

function makeRuntime(){
  let now=0,id=0;
  const timers=[];
  const microtasks=[];
  class Node{
    constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.style={setProperty(){}};this.dataset={};this.className="";this.textContent="";this.classList={};}
    appendChild(node){node.parentNode=this;this.children.push(node);return node;}
    remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(item=>item!==this);this.parentNode=null;}}
    querySelectorAll(){return [];}
    closest(){return null;}
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100,right:100,bottom:100};}
  }
  const body=new Node("body");
  const document={body,createElement:tag=>new Node(tag),querySelectorAll:selector=>selector===".battle-floating-feedback"?body.children.slice():[]};
  const window={
    __battleFloatingFeedbackOwnerInstalled:false,
    FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry(){return {unitRect:{left:0,top:0,width:100,height:100},feedbackSafeRect:{left:0,top:0,right:100,bottom:90,width:100,height:90},feedbackAnchor:{x:50,y:80}};}},
    v143ResolveBattleFeedbackTiming(side,index,kind){return {impactId:"impact:"+side+":"+index,impactAt:now+10,delayMs:10,critical:false};}
  };
  function setTimeoutFake(fn,delay){const item={id:++id,at:now+Math.max(0,Number(delay)||0),fn,cancelled:false};timers.push(item);return item;}
  function clearTimeoutFake(item){if(item)item.cancelled=true;}
  function flushMicrotasks(){while(microtasks.length)microtasks.shift()();}
  const context={window,document,Date:{now:()=>now},setTimeout:setTimeoutFake,clearTimeout:clearTimeoutFake,queueMicrotask:fn=>microtasks.push(fn),console};
  vm.runInNewContext(source,context);
  function advance(ms){now+=ms;let next;while((next=timers.filter(item=>!item.cancelled&&item.at<=now).sort((a,b)=>a.at-b.at)[0])){next.cancelled=true;next.fn();flushMicrotasks();}}
  return {api:window.FourSymbolsBattleFloatingFeedback,body,advance};
}
function texts(body){return body.children.map(node=>node.textContent);}
{
  const r=makeRuntime();
  r.api.emit({side:"player",index:0,kind:"damage",text:"888",critical:true});
  r.api.emit({side:"player",index:0,kind:"status",statusType:"burn",text:"燃燒"});
  r.advance(10);
  assert.deepEqual(texts(r.body),["💥 888","燃燒"]);
}
{
  const r=makeRuntime();
  r.api.emit({side:"player",index:0,kind:"status",text:"殤風"});
  r.api.emit({side:"player",index:0,kind:"damage",text:"456"});
  r.advance(10);
  assert.deepEqual(texts(r.body),["456","殤風"]);
}
{
  const r=makeRuntime();
  r.api.emit({side:"player",index:0,kind:"shield",text:"護盾"});
  r.api.emit({side:"player",index:0,kind:"damage",text:"100"});
  r.api.emit({side:"player",index:0,kind:"status",text:"冰封"});
  r.advance(10);
  assert.deepEqual(texts(r.body),["護盾","100","冰封"]);
}
{
  const r=makeRuntime();
  r.api.emit({side:"player",index:0,kind:"status",text:"冰封"});
  r.advance(10);
  assert.deepEqual(texts(r.body),["冰封"]);
}
{
  const r=makeRuntime();
  r.api.emit({side:"player",index:0,kind:"damage",text:"A",impactId:"a"});
  r.api.emit({side:"player",index:1,kind:"damage",text:"B",impactId:"b"});
  r.advance(10);
  assert.deepEqual(texts(r.body),["A","B"]);
}
{
  const r=makeRuntime();
  r.api.emit({side:"player",index:0,kind:"damage",text:"late"});
  r.api.clear();
  r.advance(20);
  assert.deepEqual(texts(r.body),[]);
}
console.log("Impact batch runtime timing race regression passed.");
