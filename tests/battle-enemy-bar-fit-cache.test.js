"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
function fixture(){
 const source=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
 const fontEvents=new Map();const context={window:{},WeakMap,document:{fonts:{addEventListener:(name,fn)=>fontEvents.set(name,fn)}}};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf("    const enemyBarFitCache="),source.indexOf("    function decorateEnemyCards(")),context);
 let writes=0;const values=new Map(),priorities=new Map();
 const node={textContent:"1234567890",clientWidth:36,glyphWidth:.6,dataset:{},style:{
  getPropertyValue:k=>values.get(k)||"",getPropertyPriority:k=>priorities.get(k)||"",
  removeProperty(k){writes++;values.delete(k);priorities.delete(k);},setProperty(k,v,p){writes++;values.set(k,v);priorities.set(k,p||"");}
 }};
 Object.defineProperty(node,"scrollWidth",{get(){return Math.max(node.clientWidth,Math.ceil(node.textContent.length*(parseFloat(values.get("font-size"))||13)*node.glyphWidth));}});
 const card={querySelectorAll:()=>[node]};return {node,fit:()=>context.fitEnemyBars(card),writes:()=>writes,fontLoaded:()=>fontEvents.get("loadingdone")()};
}
test("unchanged enemy HP text performs zero repeated style writes while original fit stays exact",()=>{
 const f=fixture();f.fit();assert.equal(f.node.style.getPropertyValue("font-size"),"11px");assert.equal(f.node.style.getPropertyValue("transform"),"scaleX(0.82)");
 const count=f.writes();for(let i=0;i<50;i++)f.fit();assert.equal(f.writes(),count);assert.equal(f.node.dataset.v143FontSize,"11");
});
test("changed text, available width, glyph metrics and external styles invalidate the cache",()=>{
 const f=fixture();f.fit();let count=f.writes();f.node.clientWidth=120;f.fit();assert.ok(f.writes()>count);assert.equal(f.node.style.getPropertyValue("font-size"),"13px");assert.equal(f.node.style.getPropertyValue("transform"),"");
 count=f.writes();f.node.textContent="1";f.fit();assert.ok(f.writes()>count);
 count=f.writes();f.node.glyphWidth=2;f.fontLoaded();f.fit();assert.ok(f.writes()>count);
 f.node.style.setProperty("font-size","9px");f.fit();assert.equal(f.node.style.getPropertyValue("font-size"),"13px");
 f.node.style.setProperty("transform","scaleX(.1)");f.fit();assert.equal(f.node.style.getPropertyValue("transform"),"");
});
test("a narrower newly loaded font invalidates even when scrollWidth remains clamped to clientWidth",()=>{
 const f=fixture();f.node.clientWidth=70;f.fit();assert.equal(f.node.style.getPropertyValue("font-size"),"11px");assert.equal(f.node.scrollWidth,70);
 f.node.glyphWidth=.5;assert.equal(f.node.scrollWidth,70);f.fontLoaded();f.fit();assert.equal(f.node.style.getPropertyValue("font-size"),"13px");
});
