"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/23-v125-character-creation-bootstrap.js","utf8");

function harness(saved,targetSlot=1){
    let domReady=null;
    let calls=0;
    const alerts=[];
    const page={parentElement:null,dataset:{}};
    const overlay={appendChild(node){node.parentElement=this;}};
    const head={appendChild(){}};
    const body={appendChild(){}};
    const ids={creationPage:page,"game-overlay-layer":overlay};
    const document={
        readyState:"loading",head,body,documentElement:body,
        getElementById(id){return ids[id]||null;},
        createElement(){return {id:"",rel:"",href:"",src:"",async:false,dataset:{}};},
        addEventListener(name,fn){if(name==="DOMContentLoaded")domReady=fn;}
    };
    const storage=new Map();
    if(saved!==undefined&&saved!==null){storage.set("battle_full_version_save_v5",JSON.stringify(saved));}
    const context={
        document,
        localStorage:{getItem:key=>storage.has(key)?storage.get(key):null},
        creationTargetSlot:targetSlot,
        window:{
            createCharacter(){calls++;return "created";},
            rpgAlert(message){alerts.push(String(message));return Promise.resolve();},
            alert(message){alerts.push(String(message));}
        },
        console
    };
    vm.createContext(context);
    vm.runInContext(source,context);
    assert.equal(typeof domReady,"function");
    domReady();
    return {context,get calls(){return calls;},alerts};
}

{
    const h=harness({player:{id:"火測試",level:40,element:"fire"}},1);
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"existing primary must never delegate to destructive creation owner");
    assert.match(h.alerts.join("\n"),/既有主角色存檔/);
    assert.match(h.alerts.join("\n"),/Lv\.40/);
}
{
    const h=harness({player:{id:"火測試",level:40,element:"fire"}},2);
    assert.equal(h.context.window.createCharacter(),"created");
    assert.equal(h.calls,1,"secondary creation must remain available");
}
{
    const h=harness({},1);
    assert.equal(h.context.window.createCharacter(),"created");
    assert.equal(h.calls,1,"new game without a primary save must still create slot 1");
}
console.log("✓ persisted primary character overwrite guard");
