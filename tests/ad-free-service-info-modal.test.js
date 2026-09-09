"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const runtime=read("js/16-stage-v54-main-city-runtime.js");
const css=read("css/ad-free-service-info-modal.css");
const index=read("index.html");
const touchLock=read("js/01-stage-v8-touch-lock.js");

let passed=0;
function test(name,callback){
    callback();
    passed++;
    console.log("✓ "+name);
}

test("the feature reuses the existing shared home modal and keeps the original main-city owner",()=>{
    assert.match(index,/id="homeFeatureModal"[\s\S]*id="homeFeatureModalTitle"[\s\S]*id="homeFeatureModalBody"/);
    assert.match(runtime,/home\.classList\.add\("main-city-lobby-ready"\)/);
    assert.match(runtime,/getElementById\("homeFeatureModal"\)/);
    assert.match(runtime,/getElementById\("homeFeatureModalBody"\)/);
    assert.match(runtime,/window\.closeHomeFeature/);
    assert.doesNotMatch(runtime,/createTreeWalker|setProperty\(/);
});

test("all paid-service disclosure copy and controls are present",()=>{
    [
        "《四象江湖傳》",
        "30 天免廣告服務",
        "NT$99",
        "一次付款，提供 30 天免廣告權益。",
        "本服務為單次購買，不會自動續訂。",
        "購買成功後，免廣告權益將綁定玩家帳號，自付款成功起生效 30 天。",
        "此服務不提供額外角色、裝備、能力、遊戲幣或其他戰力加成。",
        "客服 Email：",
        "查看退款規則",
        "查看服務條款",
        "查看隱私權政策",
        "付款服務準備中",
        "我知道了"
    ].forEach(text=>assert.ok(runtime.includes(text),"missing disclosure text: "+text));
});

test("unconfigured support, policy and ECPay fields stay explicit TODOs without fake destinations",()=>{
    assert.match(runtime,/supportEmail:""/);
    assert.match(runtime,/refundPolicyUrl:""/);
    assert.match(runtime,/termsUrl:""/);
    assert.match(runtime,/privacyPolicyUrl:""/);
    assert.match(runtime,/purchaseUrl:""/);
    assert.match(runtime,/purchaseEnabled:false/);
    assert.match(runtime,/TODO\(ECPay\)/);
    assert.match(runtime,/button\.disabled=true/);
    assert.doesNotMatch(runtime,/mailto:|ecpay\.com|paymentUrl:\s*["'][^"']+/i);
});

test("the display policy is isolated and records only this page-entry session in memory",()=>{
    assert.match(runtime,/AD_FREE_DISPLAY_POLICY=Object\.freeze\(\{mode:"every-entry"\}\)/);
    assert.match(runtime,/shownThisEntry:false/);
    assert.match(runtime,/v173\.20:startup-entered/);
    assert.match(runtime,/startupLoader/);
    assert.match(runtime,/gameInterface/);
    assert.match(runtime,/homePage/);
    assert.match(runtime,/MutationObserver/);
    assert.doesNotMatch(runtime,/localStorage|sessionStorage/);
});

test("the scoped RPG modal style supports internal mobile scrolling without new important overrides",()=>{
    assert.equal(css.includes("!important"),false);
    assert.match(css,/#game-stage #homeFeatureModal\.ad-free-service-info-mode/);
    assert.match(css,/max-width:var\(--ui-medium-modal-max-width,360px\)/);
    assert.match(css,/max-height:calc\(100% - var\(--ui-medium-modal-safe-space,28px\)\)/);
    assert.match(css,/#homeFeatureModalBody\{[\s\S]*overflow-y:auto;[\s\S]*overscroll-behavior-y:contain;[\s\S]*touch-action:pan-y;/);
    assert.match(css,/border:2px solid #b98a3f/);
    assert.match(css,/rgba\(2,2,2,.84\)/);
    assert.match(touchLock,/#homeFeatureModalBody/);
});

test("the owner runtime opens once on a ready home screen and closes through the shared modal function",()=>{
    class FakeClassList{
        constructor(initial=""){this.values=new Set(String(initial).split(/\s+/).filter(Boolean));}
        add(...names){names.forEach(name=>this.values.add(name));}
        remove(...names){names.forEach(name=>this.values.delete(name));}
        contains(name){return this.values.has(name);}
    }
    class FakeElement{
        constructor(id="",className=""){
            this.id=id;
            this.classList=new FakeClassList(className);
            this.dataset={};
            this.attributes={};
            this.listeners={};
            this.children=[];
            this.hidden=false;
            this.disabled=false;
            this.textContent="";
            this.scrollTop=0;
            this._innerHTML="";
        }
        addEventListener(type,fn){(this.listeners[type]||(this.listeners[type]=[])).push(fn);}
        click(){if(this.disabled)return;(this.listeners.click||[]).forEach(fn=>fn({currentTarget:this}));}
        setAttribute(name,value){this.attributes[name]=String(value);}
        removeAttribute(name){delete this.attributes[name];}
        querySelector(selector){
            if(selector===".home-feature-modal-box")return this.box||null;
            if(selector===".ad-free-service-panel")return this.panel||null;
            return null;
        }
        set innerHTML(value){
            this._innerHTML=String(value);
            const ids=[
                ["adFreeSupportEmail","尚未設定",false],
                ["adFreeRefundPolicyButton","查看退款規則",false],
                ["adFreeTermsButton","查看服務條款",false],
                ["adFreePrivacyButton","查看隱私權政策",false],
                ["adFreePurchaseButton","付款服務準備中",true],
                ["adFreeAcknowledgeButton","我知道了",false]
            ];
            ids.forEach(([id,text,disabled])=>{
                const element=new FakeElement(id);
                element.textContent=text;
                element.disabled=disabled;
                elements.set(id,element);
            });
            this.panel=new FakeElement("","ad-free-service-panel");
        }
        get innerHTML(){return this._innerHTML;}
    }

    const elements=new Map();
    const home=new FakeElement("homePage","page active");
    const game=new FakeElement("gameInterface");
    const startup=new FakeElement("startupLoader");
    startup.hidden=true;
    const modal=new FakeElement("homeFeatureModal","home-feature-modal");
    const box=new FakeElement("","home-feature-modal-box");
    modal.box=box;
    const title=new FakeElement("homeFeatureModalTitle");
    const body=new FakeElement("homeFeatureModalBody");
    [home,game,startup,modal,title,body].forEach(element=>elements.set(element.id,element));

    const documentListeners={};
    const document={
        readyState:"complete",
        head:{appendChild(element){this.children=this.children||[];this.children.push(element);if(element.id)elements.set(element.id,element);}},
        getElementById(id){return elements.get(id)||null;},
        createElement(tag){return new FakeElement("",tag);},
        addEventListener(type,fn){(documentListeners[type]||(documentListeners[type]=[])).push(fn);},
        dispatchEvent(event){(documentListeners[event.type]||[]).forEach(fn=>fn(event));}
    };
    const windowListeners={};
    let closeCalls=0;
    const context={
        console,
        URL,
        document,
        MutationObserver:class{observe(){}disconnect(){this.disconnected=true;}},
        setTimeout(fn){fn();return 1;},
        clearTimeout(){},
        window:null
    };
    const window={
        document,
        location:{href:"https://game.example.test/"},
        getComputedStyle(element){
            if(element===game)return {display:"block",visibility:"visible"};
            return {display:"block",visibility:"visible"};
        },
        requestAnimationFrame(fn){fn();return 1;},
        setTimeout(fn){fn();return 1;},
        addEventListener(type,fn){(windowListeners[type]||(windowListeners[type]=[])).push(fn);},
        open(){throw new Error("unconfigured policy/payment must not navigate");},
        closeHomeFeature(){closeCalls++;modal.classList.remove("show");}
    };
    context.window=window;
    vm.runInNewContext(runtime,context,{filename:"js/16-stage-v54-main-city-runtime.js"});

    assert.equal(home.classList.contains("main-city-lobby-ready"),true);
    assert.equal(modal.classList.contains("show"),true);
    assert.equal(modal.classList.contains("ad-free-service-info-mode"),true);
    assert.equal(title.textContent,"《四象江湖傳》");
    assert.match(body.innerHTML,/30 天免廣告服務[\s\S]*NT\$99[\s\S]*一次付款，提供 30 天免廣告權益。/);
    assert.equal(elements.get("adFreePurchaseButton").disabled,true);
    assert.equal(elements.get("adFreeRefundPolicyButton").disabled,true);
    assert.equal(elements.get("adFreeTermsButton").disabled,true);
    assert.equal(elements.get("adFreePrivacyButton").disabled,true);
    assert.equal(elements.get("adFreeSupportEmail").textContent,"尚未設定");
    assert.ok(document.head.children.some(element=>element.id==="ad-free-service-info-style"));

    elements.get("adFreeAcknowledgeButton").click();
    assert.equal(closeCalls,1);
    assert.equal(modal.classList.contains("show"),false);
    assert.equal(modal.classList.contains("ad-free-service-info-mode"),false);
    document.dispatchEvent({type:"v173.20:startup-entered"});
    assert.equal(modal.classList.contains("show"),false,"auto policy does not reopen during the same page entry");

    assert.equal(window.openAdFreeServiceInfoModal(),true,"manual entry remains available for future shop/settings wiring");
    assert.equal(modal.classList.contains("show"),true);
    window.closeAdFreeServiceInfoModal();
    assert.equal(closeCalls,2);
});

test("the portrait sizing contract stays inside 420x747 and narrower phone widths",()=>{
    const widthFor=viewportWidth=>Math.min(viewportWidth-28,360);
    const maxHeightFor=viewportHeight=>viewportHeight-28;
    assert.equal(widthFor(420),360);
    assert.equal(maxHeightFor(746.6667),718.6667);
    assert.ok(widthFor(420)+28<=420);
    assert.ok(maxHeightFor(746.6667)+28<=746.6667);
    assert.equal(widthFor(360),332);
    assert.equal(widthFor(320),292);
    assert.match(css,/min-height:44px/);
    assert.match(css,/overflow-y:auto/);
    assert.match(css,/overflow:hidden/);
});

console.log("\n"+passed+" ad-free service info modal tests passed.");
