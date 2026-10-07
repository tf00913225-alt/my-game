"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");
const source=fs.readFileSync("js/36-v141-content-systems.js","utf8").replace(/\r\n/g,"\n");
const runtime=source.slice(0,source.indexOf("    /* =====================================================\n       Abyss dungeon"))+"})();";
const tiers=["white","blue","purple","orange","pink","four-symbol"];
function harness(){
    let writes=0,timers=0;
    const body={innerHTML:""};
    let html="";
    Object.defineProperty(body,"innerHTML",{get:()=>html,set:value=>{html=value;writes++;}});
    const modal={dataset:{},classList:{add(){},remove(){}},addEventListener(){}};
    const defs={talismans:[],ores:[],blueprints:[],tickets:[],equipmentSets:[],equipmentSetItems:[]};
    for(const effect of ["freeze","stealth","barrier"]){
        for(const [index,tier] of tiers.slice(0,4).entries()){
            defs.talismans.push({id:effect+"Talisman"+["Low","Mid","High","Perfect"][index],name:effect+" "+tier,tierKey:tier,talismanEffect:effect,type:"talisman",icon:'<span class="v169-talisman-art"><img src="assets/items/talismans/'+effect+'-icon.png"></span>'});
        }
    }
    for(const tier of tiers){
        defs.ores.push({id:"ore-"+tier,name:tier+"礦石",tierKey:tier,icon:"ore-art"});
        defs.blueprints.push({id:"blueprint-"+tier,name:"赤炎"+tier+"圖紙",tierKey:tier,setId:"setFire",blueprintSlot:"head",icon:"blueprint-art"});
    }
    defs.tickets.push({id:"ticketFire",setId:"setFire",name:"赤炎券",icon:"ticket-art"});
    const c={console,Math,Date,Map,Set,Promise,inventoryItems:[],characterEquipment:{},gold:100000,failAdd:false,
        FourSymbolsAccountSave:{accountKey:()=>"qa"},
        document:{getElementById:id=>id==="homeFeatureModalBody"?body:id==="homeFeatureModal"?modal:{},querySelectorAll:()=>[]},
        openHomeFeature(){},closeHomeFeature(){},isEquipmentInventoryType:()=>false,
        v132GetContentDefinitions:()=>defs,v132CanAddItemToInventory:()=>true,
        rebuildInventorySlots(){},updateGoldDisplay(){},saveGame(){},updateUI(){},alert(){},
        setTimeout(){timers++;return 1;},v132ShowRewardModal(){},
        v132ConsumeStackItem(id,n){const item=c.inventoryItems.find(item=>item.id===id);if(!item||item.count<n)return false;item.count-=n;return true;},
        v132AddItemToInventory(def,n){if(c.failAdd)return false;const item=c.inventoryItems.find(item=>item.id===def.id);if(item)item.count+=n;else c.inventoryItems.push({...def,count:n});return true;},
        v132RunInventoryTransaction(fn){const snapshot=JSON.stringify(c.inventoryItems);const success=fn();if(!success)c.inventoryItems=JSON.parse(snapshot);return success;}
    };
    c.window=c;vm.createContext(c);vm.runInContext(runtime,c);
    return {c,body,defs,get writes(){return writes;},get timers(){return timers;},put(id,count){c.inventoryItems.push({...defs.talismans.concat(defs.ores,defs.blueprints,defs.tickets).find(item=>item.id===id),id,count,icon:"stale-art"});},count(id){return c.inventoryItems.filter(item=>item.id===id).reduce((sum,item)=>sum+item.count,0);}};
}
test("first open and every selection/quantity/tab/reentry render final UI without decorators or timers",()=>{
    const h=harness();for(const effect of ["freeze","stealth","barrier"])h.put(effect+"TalismanLow",12);
    h.c.openHomeFeature("synthesis");
    assert.equal(h.writes,1);assert.equal(h.timers,0);
    assert.equal((h.body.innerHTML.match(/class="v143-item-picker"/g)||[]).length,1);
    assert.doesNotMatch(h.body.innerHTML,/<select|stale-art/);
    for(const effect of ["freeze","stealth","barrier"])assert.match(h.body.innerHTML,new RegExp(effect+"-icon\\.png"));
    h.c.v141SelectTalisman("barrierTalismanLow");h.c.v141AdjustTalismanQty(1);
    assert.match(h.body.innerHTML,/barrier white ×6/);
    h.c.v141AdjustTalismanQty("max");assert.match(h.body.innerHTML,/barrier white ×12/);
    h.c.v141AdjustTalismanQty(-1);assert.match(h.body.innerHTML,/barrier white ×9/);
    for(const tab of ["fragment","material","talisman"]){const before=h.writes;h.c.v141SwitchSynthesisTab(tab);assert.equal(h.writes,before+1);assert.doesNotMatch(h.body.innerHTML,/<select/);}
    h.c.closeHomeFeature();h.c.openHomeFeature("synthesis");assert.match(h.body.innerHTML,/barrier white ×9/);assert.equal(h.timers,0);
});
test("talisman costs and failure rollback survive canonical rendering",()=>{
    for(const [tier,cost] of [["Low",300],["Mid",1000],["High",3000]]){
        const h=harness();const id="freezeTalisman"+tier;h.put(id,12);h.c.openHomeFeature("synthesis");h.c.v141SelectTalisman(id);
        const before=h.c.gold;h.c.v141CraftTalismans();assert.equal(h.count(id),9);assert.equal(h.c.gold,before-cost);
        const snapshot=JSON.stringify(h.c.inventoryItems);h.c.failAdd=true;h.c.v141CraftTalismans();assert.equal(JSON.stringify(h.c.inventoryItems),snapshot);assert.equal(h.c.gold,before-cost);
        assert.match(h.body.innerHTML,/class="v143-item-picker"/);
    }
});
test("all five material promotions retain 50 to 10, IDs, options and rollback",()=>{
    for(const [index,tier] of tiers.slice(0,-1).entries()){
        for(const kind of ["ore","blueprint"]){
            const h=harness();h.put(kind+"-"+tier,50);h.c.openHomeFeature("synthesis");h.c.v141SwitchSynthesisTab("material");h.c.v17363ChooseMaterialOption(kind==="ore"?"oreTier":"blueprintTier",tier);
            assert.match(h.body.innerHTML,/role="listbox"/);assert.doesNotMatch(h.body.innerHTML,/<select/);
            const before=h.c.gold,snapshot=JSON.stringify(h.c.inventoryItems);h.c.failAdd=true;
            assert.equal(h.c.v17363CraftMaterial(kind),false);assert.equal(JSON.stringify(h.c.inventoryItems),snapshot);assert.equal(h.c.gold,before);
            h.c.failAdd=false;assert.equal(h.c.v17363CraftMaterial(kind),true);assert.equal(h.count(kind+"-"+tier),0);assert.equal(h.count(kind+"-"+tiers[index+1]),10);assert.equal(h.c.gold,before);
            assert.match(h.body.innerHTML,/0 \/ 50/);assert.equal(h.timers,0);
        }
    }
});
test("fragment quantity and transaction remain 100 fragments plus 500 gold per ticket",()=>{
    const h=harness();h.put("fragmentSetFire",400);h.c.openHomeFeature("synthesis");h.c.v141SwitchSynthesisTab("fragment");h.c.v141AdjustFragmentQty("setFire",1);
    h.c.v141CraftFragmentTicket("setFire");assert.equal(h.count("fragmentSetFire"),200);assert.equal(h.count("ticketFire"),2);assert.equal(h.c.gold,99000);
    const snapshot=JSON.stringify(h.c.inventoryItems);h.c.failAdd=true;h.c.v141CraftFragmentTicket("setFire");assert.equal(JSON.stringify(h.c.inventoryItems),snapshot);assert.equal(h.c.gold,99000);
});
test("legacy ordinary gear compatibility cannot strip canonical material blueprint identity",()=>{
    const h=harness();h.put("blueprint-white",50);
    const canonicalBefore=JSON.stringify(h.defs.blueprints),ownedBefore=JSON.stringify(h.c.inventoryItems);
    h.c.inventoryItems.push({id:"old-gear",name:"赤炎普通裝備",v141Crafted:true,setId:"setFire",requiredElement:"fire",stats:{attack:3},icon:"old-art"});
    const polish=fs.readFileSync("js/41-v146-system-polish.js","utf8");
    const block=polish.slice(polish.indexOf("    const SYNTHESIS_SET_PREFIX="),polish.indexOf('    if(typeof window.v141CraftEquipment==="function")'));
    vm.runInContext(block+"\nnormalizeOrdinarySynthesisData();",h.c);
    assert.equal(JSON.stringify(h.defs.blueprints),canonicalBefore);
    assert.equal(JSON.stringify(h.c.inventoryItems.slice(0,1)),ownedBefore);
    assert.equal(h.c.inventoryItems[1].setId,undefined);assert.equal(h.c.inventoryItems[1].requiredElement,undefined);
    assert.equal(h.c.inventoryItems[1].stats.attack,3);
    h.c.openHomeFeature("synthesis");h.c.v141SwitchSynthesisTab("material");
    assert.match(h.body.innerHTML,/data-material-value="setFire"/);assert.equal(h.c.v17363CraftMaterial("blueprint"),true);assert.equal(h.count("blueprint-blue"),10);
});
