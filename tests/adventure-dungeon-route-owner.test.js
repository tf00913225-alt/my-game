"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const core=read("js/00-main.js");
const start=core.indexOf("function showPage(page,options={}){");
const end=core.indexOf("/* =====================================================\n   地圖",start);
assert.ok(start>=0&&end>start);
function element(id){
    const classes=new Set();
    return {id,hidden:id==="adventurePage",classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x);}}};
}
const pages=["home","adventure","dungeon","training","battle"].map(x=>element(x+"Page"));
const app=element("app"),root=element("root");
let hidden=0,daily=0;
const c={window:null,battleActive:false,inventoryOpenContext:null,$:id=>pages.find(x=>x.id===id)||null,
document:{querySelectorAll:()=>pages,getElementById:id=>id==="app"?app:null,documentElement:root,body:root},
updateMapPageHeader(){},updateUI(){},stopMapPatrolLoop(){},resetPatrolCharacterToIdle(){},
switchDungeonTab(tab){assert.equal(tab,"daily");daily++;},
FourSymbolsAdventure:{hide(){hidden++;}},FourSymbolsBottomNav:{syncContext(){}}};
c.window=c;vm.createContext(c);vm.runInContext(core.slice(start,end),c);
const active=()=>pages.filter(p=>p.classList.contains("active")).map(p=>p.id);
for(let n=0;n<3;n++){
    c.showPage("home");c.showPage("adventure");
    assert.deepEqual(active(),["adventurePage"]);
    assert.equal(pages[1].hidden,false);
    c.showPage("home");c.showPage("dungeon");
    assert.deepEqual(active(),["dungeonPage"]);
    assert.equal(pages[1].hidden,true,"dungeon must never expose an old Adventure surface");
    assert.equal(pages[1].classList.contains("is-visible"),false);
}
assert.equal(daily,3);assert.ok(hidden>=3);
c.showPage("missing");assert.deepEqual(active(),["dungeonPage"],"unknown routes cannot clear the active screen");
c.battleActive=true;c.showPage("adventure");assert.deepEqual(active(),["dungeonPage"],"existing battle navigation guard remains effective");
const entry=read("js/adventure/adventure-entry-v1-20260915.js"),ui=read("js/adventure/adventure-ui-v1-20260915.js");
assert.match(entry,/onclick="openAdventureMap\(\)"/);
assert.match(read("index.html"),/id="dungeonNav"[\s\S]*?data-feature="dungeon"\s+onclick="openDungeonHub\(\)"/);
assert.match(ui,/root.className="page adventure-page"/);
assert.match(ui,/showPage\("adventure"\)/);
assert.doesNotMatch(ui,/root\.hidden=false|classList\.add\("is-visible"\)/);
assert.doesNotMatch(entry,/window\.openAdventure=/);
assert.doesNotMatch(read("js/gameplay-boss-tower-system.js"),/vGameplayOpenDailyDungeons/);
const runtimeSource=read("js/adventure/adventure-runtime-v1-20260915.js");
const closeSource=runtimeSource.slice(runtimeSource.indexOf("    function closeToCity(){"),runtimeSource.indexOf("    function hideOverlay(){"));
let returns=0;
const closeContext={runtime:{visible:true,activePanel:"event",selectedNodeId:"n01_arrival"},showPage(page){assert.equal(page,"home");returns++;}};
vm.createContext(closeContext);vm.runInContext(closeSource,closeContext);closeContext.closeToCity();
assert.equal(returns,1,"city return selects its route exactly once");
assert.equal(closeContext.runtime.visible,false);
console.log("Adventure and Dungeon share one screen authority; distinct entries and repeated transitions passed");
