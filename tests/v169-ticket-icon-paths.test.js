"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const itemSource=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const rewardSource=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const abyssSource=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const cssSource=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const open=source.indexOf("{",start);
    let depth=0;
    let quote=null;
    let escaped=false;
    for(let index=open;index<source.length;index++){
        const char=source[index];
        if(quote){
            if(escaped){ escaped=false; continue; }
            if(char==="\\"){ escaped=true; continue; }
            if(char===quote){ quote=null; }
            continue;
        }
        if(char==='"'||char==="'"||char==='`'){ quote=char; continue; }
        if(char==="{"){ depth++; }
        if(char==="}" && --depth===0){ return source.slice(start,index+1); }
    }
    throw new Error("unterminated function "+name);
}

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("old saved equipment-ticket stacks hydrate to the four supplied raster icons",()=>{
    const context=vm.createContext({});
    vm.runInContext(`
        const ticketDefinitions=[
            {id:"ticketSetFire",name:"赤炎裝備抽獎券",type:"ticket",setId:"setFire",price:0,icon:'<span class="v169-ticket-art"><img src="assets/items/tickets/fire.png"></span>'},
            {id:"ticketSetWater",name:"寒泉裝備抽獎券",type:"ticket",setId:"setWater",price:0,icon:'<span class="v169-ticket-art"><img src="assets/items/tickets/water.png"></span>'},
            {id:"ticketSetEarth",name:"岩嶽裝備抽獎券",type:"ticket",setId:"setEarth",price:0,icon:'<span class="v169-ticket-art"><img src="assets/items/tickets/earth.png"></span>'},
            {id:"ticketSetWind",name:"青嵐裝備抽獎券",type:"ticket",setId:"setWind",price:0,icon:'<span class="v169-ticket-art"><img src="assets/items/tickets/wind.png"></span>'}
        ];
        const inventoryItems=[
            {id:"ticketSetFire",name:"old",icon:"<svg>old</svg>",type:"ticket",count:3},
            {id:"ticketSetWater",name:"old",icon:"",type:"ticket",count:2},
            {id:"setFire_blade",name:"赤炎刀",icon:"<svg>gear</svg>",type:"weapon",count:1}
        ];
        ${extractFunction(itemSource,"getTicketDefinition")}
        ${extractFunction(itemSource,"syncTicketPresentation")}
        ${extractFunction(itemSource,"hydrateOwnedTicketPresentation")}
        hydrateOwnedTicketPresentation();
        globalThis.result=inventoryItems;
    `,context);
    assert.match(context.result[0].icon,/assets\/items\/tickets\/fire\.png/);
    assert.match(context.result[1].icon,/assets\/items\/tickets\/water\.png/);
    assert.equal(context.result[0].count,3);
    assert.equal(context.result[2].icon,"<svg>gear</svg>","set equipment must keep its own icon");
});

test("merging a ticket stack refreshes presentation before increasing only its count",()=>{
    const context=vm.createContext({Math,Number});
    vm.runInContext(`
        const INVENTORY_MAX_STACK_DEFAULT=100;
        const ticketDefinitions=[
            {id:"ticketSetFire",name:"赤炎裝備抽獎券",type:"ticket",setId:"setFire",price:0,icon:'<span class="v169-ticket-art"><img src="assets/items/tickets/fire.png"></span>'}
        ];
        const inventoryItems=[{id:"ticketSetFire",name:"old",icon:"",type:"ticket",count:1}];
        function isEquipmentInventoryType(){ return false; }
        function canAddItemToInventory(){ return true; }
        function cloneInventoryStackItem(item,count){ return Object.assign({},item,{count}); }
        ${extractFunction(itemSource,"getTicketDefinition")}
        ${extractFunction(itemSource,"syncTicketPresentation")}
        ${extractFunction(itemSource,"addItemToInventory")}
        globalThis.added=addItemToInventory(ticketDefinitions[0],2);
        globalThis.result=inventoryItems[0];
    `,context);
    assert.equal(context.added,true);
    assert.equal(context.result.count,3);
    assert.equal(context.result.name,"赤炎裝備抽獎券");
    assert.match(context.result.icon,/assets\/items\/tickets\/fire\.png/);
});

test("Abyss reward forwards ticket identity and raster markup to an icon-sized toast",()=>{
    assert.match(abyssSource,/items:\[\{[\s\S]*?id:ticket\.id,[\s\S]*?icon:ticket\.icon/);
    assert.match(rewardSource,/V141_RASTER_TICKET_IDS=new Set\(\[/);
    assert.match(rewardSource,/window\.v132GetTicketDefinition\(item\.id\)/);
    assert.match(rewardSource,/class="v141-reward-item-icon"/);
    assert.match(cssSource,/\.v141-reward-toast \.v141-reward-item-icon\{[^}]*width:30px;[^}]*height:30px/);
});

test("reward toast renders canonical icons for only the four equipment tickets",()=>{
    const definitions=Object.fromEntries(
        ["Fire","Water","Earth","Wind"].map(label=>{
            const element=label.toLowerCase();
            const id="ticketSet"+label;
            return [id,{
                id,
                icon:'<span class="v169-item-art v169-ticket-art"><img src="assets/items/tickets/'+element+'.png"></span>'
            }];
        })
    );
    const toast={
        innerHTML:"",
        offsetWidth:100,
        classList:{add(){},remove(){}}
    };
    const context=vm.createContext({
        window:{v132GetTicketDefinition:id=>definitions[id]||null},
        document:{
            getElementById:id=>id==="v141RewardToast"?toast:null,
            body:{appendChild(){}}
        },
        clearTimeout(){},
        setTimeout(){ return 1; }
    });
    const ticketIds=JSON.stringify(Object.keys(definitions));
    vm.runInContext(`
        const V141_RASTER_TICKET_IDS=new Set(${ticketIds});
        function escapeHtml(value){ return String(value); }
        ${extractFunction(rewardSource,"getCanonicalTicketIcon")}
        ${extractFunction(rewardSource,"showBlackGoldReward")}
        showBlackGoldReward({
            exp:0,
            gold:0,
            items:[
                ...${ticketIds}.map(id=>({id,name:id,count:1,icon:"<svg>persisted-old-icon</svg>"})),
                {id:"setFire_blade",name:"赤炎刀",count:1,icon:'<img src="wrong.png">'}
            ]
        });
    `,context);
    ["fire","water","earth","wind"].forEach(element=>{
        assert.match(toast.innerHTML,new RegExp("assets/items/tickets/"+element+"\\.png"));
    });
    assert.doesNotMatch(toast.innerHTML,/persisted-old-icon|wrong\.png/);
    assert.equal((toast.innerHTML.match(/v141-reward-item-icon/g)||[]).length,4);
});

test("ticket art remains mapped only to tickets, never to the ten-piece set",()=>{
    assert.match(itemSource,/icon:ticketIcon\("fire"\)/);
    assert.match(itemSource,/icon:equipmentSetIcon\(set\.id,piece\.key\)/);
    assert.doesNotMatch(itemSource,/equipmentSetItemDefinitions[\s\S]{0,500}ticketIcon\(/);
});

console.log("\nV169 ticket icon paths suite: "+passed+" tests passed.");
