"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/58-v173.63-visible-ui-repairs.js","utf8");

function styleBag(){
    const values=new Map();
    return {
        setProperty(name,value,priority){ values.set(name,{value:String(value),priority:String(priority||"")}); },
        value(name){ return values.get(name)?.value; },
        priority(name){ return values.get(name)?.priority; }
    };
}

function classList(values){
    const set=new Set(values||[]);
    return {
        contains(name){ return set.has(name); },
        toggle(name,force){
            const enabled=force===undefined?!set.has(name):!!force;
            if(enabled){ set.add(name); }else{ set.delete(name); }
            return enabled;
        }
    };
}

const powerSave={removed:false,remove(){ this.removed=true; }};
const synthBox={style:styleBag()};
const modal={
    style:styleBag(),
    classList:classList(["v141-synthesis-modal"]),
    querySelector(selector){ return selector===".home-feature-modal-box"?synthBox:null; }
};
const shell={style:styleBag()};
const inventory={
    style:styleBag(),
    classList:classList(["map-inventory-overlay-open","v169-dungeon-inventory-overlay"]),
    querySelector(selector){ return selector===".inventory-classic-shell"?shell:null; }
};
const app={classList:classList(["v141-dungeon-active"])};
const select={value:"oreWhite",options:[{value:"oreWhite",textContent:"白階礦石"}]};
const iconHost={innerHTML:"GENERIC"};
const pickerButton={
    dataset:{},
    classList:classList(),
    querySelector(selector){ return selector==="i"?iconHost:null; }
};
const label={querySelector(selector){ return selector==="select"?select:null; }};
const picker={
    closest(selector){ return selector==="label"?label:null; },
    querySelectorAll(selector){ return selector==="button"?[pickerButton]:[]; }
};

const body={};
const document={
    body,
    readyState:"complete",
    getElementById(id){
        return {
            quickPowerSavingToggle:powerSave,
            homeFeatureModal:modal,
            app,
            inventoryPage:inventory
        }[id]||null;
    },
    querySelectorAll(selector){ return selector===".v143-item-picker"?[picker]:[]; },
    addEventListener(){}
};

class MutationObserver{
    constructor(handler){ this.handler=handler; }
    observe(){}
}

const context={
    window:null,document,MutationObserver,console,Map,Set,Object,Array,String,Number,
    inventoryItems:[{id:"oreWhite",icon:"GENERIC"}],
    characterEquipment:{},
    requestAnimationFrame(callback){ callback(); return 1; },
    setTimeout(callback){ callback(); return 1; }
};
context.window=context;
context.window.addEventListener=()=>{};
context.window.v132GetContentDefinitions=()=>({
    talismans:[],
    ores:[{id:"oreWhite",icon:'<span class="v169-item-art"><img src="ore-white.png"></span>'}],
    blueprints:[],tickets:[],equipmentSetItems:[]
});

vm.createContext(context);
vm.runInContext(source,context,{filename:"js/58-v173.63-visible-ui-repairs.js"});

assert.equal(powerSave.removed,true,"patrol power-saving UI entry must be physically removed");
assert.match(iconHost.innerHTML,/v169-item-art/);
assert.match(iconHost.innerHTML,/ore-white\.png/);
assert.equal(modal.style.value("padding"),"4px");
assert.equal(synthBox.style.value("width"),"calc(100% - 8px)");
assert.equal(synthBox.style.value("max-width"),"none");
assert.equal(inventory.style.value("inset"),"0");
assert.equal(inventory.style.value("width"),"100%");
assert.equal(inventory.style.value("height"),"100%");
assert.equal(shell.style.value("width"),"100%");
assert.equal(inventory.style.priority("width"),"important");
assert.equal(typeof context.v17363RunVisibleUiRepairs,"function");

console.log("✓ V173.63 visible UI owner repairs execute against real runtime owners");
