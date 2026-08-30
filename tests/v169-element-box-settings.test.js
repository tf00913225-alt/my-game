"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const css=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function classList(){
    const values=new Set();
    return {
        toggle(name,force){
            const enabled=force===undefined?!values.has(name):!!force;
            if(enabled){ values.add(name); }else{ values.delete(name); }
            return enabled;
        },
        contains(name){ return values.has(name); }
    };
}

function element(id=""){
    const listeners={};
    return {
        id,
        value:"",
        checked:false,
        hidden:false,
        type:"",
        className:"",
        classList:classList(),
        dataset:{},
        style:{display:""},
        attributes:{},
        children:[],
        textContent:"",
        setAttribute(name,value){ this.attributes[name]=String(value); },
        addEventListener(type,handler){
            if(!listeners[type]){ listeners[type]=[]; }
            listeners[type].push(handler);
        },
        dispatch(type){
            (listeners[type]||[]).forEach(handler=>handler({target:this}));
        },
        appendChild(child){ this.children.push(child); child.parentNode=this; return child; },
        querySelector(){ return null; }
    };
}

function loadRuntime(options={}){
    const characters=[{id:"火"},{id:"水"},{id:"風"}];
    const configs=[
        {skill:"normal",hp:25,sp:25,returnToCityWhenEmpty:false},
        {skill:"defend",hp:50,sp:50,returnToCityWhenEmpty:false},
        {skill:"iceSpin",hp:75,sp:75,returnToCityWhenEmpty:true}
    ];
    const nodes={
        autoSettingsCharacterSelect:element("autoSettingsCharacterSelect"),
        autoSettingsActionSelect:element("autoSettingsActionSelect"),
        autoSettingsHP:element("autoSettingsHP"),
        autoSettingsSP:element("autoSettingsSP"),
        autoSettingsReturnCity:element("autoSettingsReturnCity"),
        autoBattleButton:element("autoBattleButton")
    };
    const status=element();
    status.className="auto-premium-status";
    const panel=element("autoBattleSettingsPanel");
    panel.style.display="flex";
    panel.querySelector=selector=>selector===".auto-premium-status"?status:null;
    nodes.autoBattleSettingsPanel=panel;

    let currentCharacter=0;
    let saveCalls=0;
    let confirmCalls=0;
    let toggleCalls=0;
    let active=!!options.active;

    function findNode(id){
        if(nodes[id]){ return nodes[id]; }
        return status.children.find(child=>child.id===id)||null;
    }
    const document={
        getElementById:findNode,
        createElement:()=>element()
    };

    function fillForm(index){
        const config=configs[index];
        nodes.autoSettingsActionSelect.value=config.skill;
        nodes.autoSettingsHP.value=String(config.hp);
        nodes.autoSettingsSP.value=String(config.sp);
        nodes.autoSettingsReturnCity.checked=!!config.returnToCityWhenEmpty;
    }
    fillForm(0);
    nodes.autoSettingsCharacterSelect.value="0";

    const context={
        window:null,document,console,Number,Object,Array,Set,Map,
        autoBattle:!!options.autoBattle,
        getPartyCharacterByIndex:index=>characters[index]||null,
        saveAutoSettingsFormToCharacter(index){
            const config=configs[index];
            config.skill=nodes.autoSettingsActionSelect.value;
            config.hp=Number(nodes.autoSettingsHP.value);
            config.sp=Number(nodes.autoSettingsSP.value);
            config.returnToCityWhenEmpty=nodes.autoSettingsReturnCity.checked;
        },
        saveGame(){ saveCalls++; },
        switchAutoSettingsCharacter(skipSave){
            if(!skipSave){ this.saveAutoSettingsFormToCharacter(currentCharacter); }
            currentCharacter=Number(nodes.autoSettingsCharacterSelect.value);
            fillForm(currentCharacter);
        },
        closeHomeFeature(){ panel.style.display="none"; },
        closeAutoBattleSettings(){ panel.style.display="none"; },
        openHomeFeature(){ panel.style.display="flex"; },
        openAutoBattleSettings(){ panel.style.display="flex"; },
        updateAutoButton(){
            nodes.autoBattleButton.textContent=context.autoBattle?"⏹ 停止":"套用並啟動";
        },
        confirmAutoBattleSettings(){ confirmCalls++; },
        toggleAutoBattle(){
            toggleCalls++;
            context.autoBattle=!context.autoBattle;
            active=context.autoBattle;
            context.updateAutoButton();
            return context.autoBattle;
        },
        v131GetElementBoxState:()=>({active})
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);

    return {
        context,nodes,status,configs,panel,
        get saveCalls(){ return saveCalls; },
        get confirmCalls(){ return confirmCalls; },
        get toggleCalls(){ return toggleCalls; },
        setActive(value){ active=!!value; }
    };
}

test("HP, SP, return and action changes save the selected character immediately",()=>{
    const runtime=loadRuntime();
    const {nodes,configs}=runtime;

    nodes.autoSettingsHP.value="90";
    nodes.autoSettingsHP.dispatch("change");
    assert.equal(configs[0].hp,90);

    nodes.autoSettingsCharacterSelect.value="1";
    runtime.context.switchAutoSettingsCharacter();
    nodes.autoSettingsSP.value="75";
    nodes.autoSettingsSP.dispatch("change");
    nodes.autoSettingsActionSelect.value="waterBall";
    nodes.autoSettingsActionSelect.dispatch("change");
    nodes.autoSettingsReturnCity.checked=true;
    nodes.autoSettingsReturnCity.dispatch("change");

    assert.deepEqual(configs.map(config=>config.hp),[90,50,75]);
    assert.equal(configs[1].sp,75);
    assert.equal(configs[1].skill,"waterBall");
    assert.equal(configs[1].returnToCityWhenEmpty,true);
    assert.ok(runtime.saveCalls>=5);
});

test("switching characters and closing both save the outgoing/current draft",()=>{
    const runtime=loadRuntime();
    const {nodes,configs,panel}=runtime;

    nodes.autoSettingsHP.value="100";
    nodes.autoSettingsCharacterSelect.value="1";
    runtime.context.switchAutoSettingsCharacter();
    assert.equal(configs[0].hp,100);

    nodes.autoSettingsHP.value="90";
    runtime.context.closeHomeFeature();
    assert.equal(configs[1].hp,90);
    assert.equal(panel.style.display,"none");

    panel.style.display="flex";
    nodes.autoSettingsHP.value="75";
    runtime.context.closeAutoBattleSettings();
    assert.equal(configs[1].hp,75);
});

test("an active Element Box saves without stopping and exposes a separate stop",()=>{
    const runtime=loadRuntime({active:true,autoBattle:true});
    runtime.context.updateAutoButton();

    const stopButton=runtime.status.children.find(child=>child.id==="v169ElementBoxStopButton");
    assert.ok(stopButton);
    assert.equal(runtime.nodes.autoBattleButton.textContent,"儲存設定");
    assert.equal(runtime.nodes.autoBattleButton.attributes.onclick,"v169SaveElementBoxSettings()");
    assert.equal(stopButton.hidden,false);
    assert.equal(stopButton.textContent,"停止元素匣");

    runtime.context.v169SaveElementBoxSettings();
    assert.equal(runtime.confirmCalls,1);
    assert.equal(runtime.toggleCalls,0);
    assert.equal(runtime.context.autoBattle,true);

    runtime.context.v169StopElementBox();
    assert.equal(runtime.toggleCalls,1);
    assert.equal(runtime.context.autoBattle,false);
    assert.equal(runtime.nodes.autoBattleButton.textContent,"套用並啟動");
    assert.equal(stopButton.hidden,true);
});

test("stop handles the transient active-session / autoBattle-off state",()=>{
    const runtime=loadRuntime({active:true,autoBattle:false});
    runtime.context.updateAutoButton();
    assert.equal(runtime.nodes.autoBattleButton.textContent,"儲存設定");

    runtime.context.v169StopElementBox();
    assert.equal(runtime.toggleCalls,1);
    assert.equal(runtime.context.autoBattle,false);
    assert.equal(runtime.nodes.autoBattleButton.textContent,"套用並啟動");
});

test("the separate stop control keeps the existing RPG panel language responsive",()=>{
    assert.match(css,/\.auto-premium-status\.v169-element-box-active/);
    assert.match(css,/\.v169-element-box-stop\{/);
    assert.match(css,/touch-action:manipulation/);
    assert.match(css,/@media \(max-width:380px\)/);
});

console.log("v169 element-box settings checks passed: "+passed);
