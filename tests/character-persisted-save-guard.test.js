"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("js/23-v125-character-creation-bootstrap.js","utf8");
const accountSource=fs.readFileSync("js/startup/account-save-repository.js","utf8");
const TEST_UID="creation-guard-test";

function harness(options={}){
    let domReady=null;
    let calls=0;
    const alerts=[];
    const targetSlot=options.targetSlot??1;
    const runtimePlayer=options.runtimePlayer||{id:""};
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
    const localStorage={
        getItem(key){
            if(options.throwOnGet){ throw new Error("storage unavailable"); }
            return storage.has(key)?storage.get(key):null;
        },
        setItem(key,value){storage.set(key,String(value));},
        removeItem(key){storage.delete(key);}
    };
    const context={
        document,localStorage,creationTargetSlot:targetSlot,player:runtimePlayer,
        window:{localStorage,
            createCharacter(){calls++;return "created";},
            rpgAlert(message){alerts.push(String(message));return Promise.resolve();},
            alert(message){alerts.push(String(message));}
        },
        console
    };
    vm.createContext(context);
    vm.runInContext(accountSource,context);
    context.window.FourSymbolsAccountSave.activate(TEST_UID);
    const saveKey=context.window.FourSymbolsAccountSave.saveKey(TEST_UID);
    const metadataKey=context.window.FourSymbolsAccountSave.metadataKey(TEST_UID);
    if(Object.prototype.hasOwnProperty.call(options,"raw")){
        storage.set(saveKey,String(options.raw));
        storage.set(metadataKey,JSON.stringify({schemaVersion:1,ownerUid:TEST_UID}));
    }else if(Object.prototype.hasOwnProperty.call(options,"saved")){
        context.window.FourSymbolsAccountSave.writeForUid(TEST_UID,options.saved,{source:"test"});
    }
    vm.runInContext(source,context);
    assert.equal(typeof domReady,"function");
    domReady();
    return {context,get calls(){return calls;},alerts,storage};
}

{
    const h=harness({saved:{player:{id:"火測試",level:40,element:"fire"}},targetSlot:1});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"existing primary must never delegate to destructive creation owner");
    assert.match(h.alerts.join("\n"),/既有主角色存檔/);
    assert.match(h.alerts.join("\n"),/Lv\.40/);
}
{
    const h=harness({saved:{player:{id:"火測試",element:"fire"}},targetSlot:1});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"primary identity must stay protected even when level is missing/corrupt");
    assert.match(h.alerts.join("\n"),/既有主角色存檔/);
}
{
    const h=harness({raw:"{broken-json",targetSlot:1});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"malformed canonical save must fail closed");
    assert.match(h.alerts.join("\n"),/存檔讀取異常/);
}
{
    const h=harness({saved:{player:{id:"",level:40,exp:0,element:"fire"}},targetSlot:1});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"progressed primary with damaged identity must fail closed");
    assert.match(h.alerts.join("\n"),/既有角色痕跡/);
}
{
    const h=harness({saved:{player:{id:"",level:1,exp:0},player2:{id:"水測試",level:40}},targetSlot:1});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"secondary-character evidence must prevent primary overwrite when id is damaged");
}
{
    const h=harness({throwOnGet:true,targetSlot:1});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"storage read failure must never become permission to create over slot 1");
    assert.match(h.alerts.join("\n"),/存檔讀取異常/);
}
{
    const h=harness({raw:"{broken-json",targetSlot:2});
    assert.equal(h.context.window.createCharacter(),false);
    assert.equal(h.calls,0,"corrupt canonical save must block additional-character creation too");
}
{
    const h=harness({saved:{player:{id:"火測試",level:40,element:"fire"}},targetSlot:2});
    assert.equal(h.context.window.createCharacter(),"created");
    assert.equal(h.calls,1,"healthy primary save must still allow legitimate secondary creation");
}
{
    const h=harness({saved:{},targetSlot:1});
    assert.equal(h.context.window.createCharacter(),"created");
    assert.equal(h.calls,1,"new game without a primary save must still create slot 1");
}
{
    const h=harness({saved:{player:{id:"",element:"fire",level:1,exp:0,expNext:100}},targetSlot:1});
    assert.equal(h.context.window.createCharacter(),"created");
    assert.equal(h.calls,1,"canonical blank pre-creation template must remain creatable");
}

console.log("✓ persisted primary character overwrite guard fails closed on unsafe saves");
