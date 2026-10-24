const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(ROOT,"js/00-main.js"),"utf8");

function functionSource(name,text=source){
    const start=text.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const brace=text.indexOf("{",start);
    let depth=0;
    for(let index=brace;index<text.length;index++){
        if(text[index]==="{"){ depth++; }
        else if(text[index]==="}"&&--depth===0){ return text.slice(start,index+1); }
    }
    throw new Error("unterminated function "+name);
}

function makeClassList(initial=[]){
    const values=new Set(initial);
    return {
        add(...names){ names.forEach(name=>values.add(name)); },
        remove(...names){ names.forEach(name=>values.delete(name)); },
        toggle(name,force){ force?values.add(name):values.delete(name);return !!force; },
        contains(name){ return values.has(name); }
    };
}

test("the active battle page owns one reading state until its final surface closes",()=>{
    const body={classList:makeClassList()};
    const stage={classList:makeClassList(["battle-ui-priority"])};
    const page={
        classList:makeClassList(["active"]),
        surfaces:new Set(),
        querySelector(selector){ return this.surfaces.has(selector)?{}:null; }
    };
    const context={window:{},document:{body},$:(id)=>id==="game-stage"?stage:id==="battlePage"?page:null};
    vm.runInNewContext(functionSource("syncBattleUiPriorityLayer")+";this.syncBattleUiPriorityLayer=syncBattleUiPriorityLayer;",context);

    const selectors=[
        ".battle-insight-drawer.open",
        ".battle-status-detail-modal:not([hidden])"
    ];
    for(const selector of selectors){
        page.surfaces.add(selector);
        assert.equal(context.syncBattleUiPriorityLayer(),true);
        assert.equal(body.classList.contains("v174-battle-reading-open"),true);
    }
    page.surfaces.clear();
    assert.equal(context.syncBattleUiPriorityLayer(),false);
    assert.equal(body.classList.contains("v174-battle-reading-open"),false);
    assert.equal(stage.classList.contains("battle-ui-priority"),false,"retired stage z-index flag must not survive");

    page.surfaces.add(selectors[0]);
    page.classList.remove("active");
    assert.equal(context.syncBattleUiPriorityLayer(),false,"inactive battle pages cannot retain reading state");
    assert.equal(body.classList.contains("v174-battle-reading-open"),false);
});

test("original settings lifecycle shares reading state and closing preserves other reading surfaces",()=>{
    const body={classList:makeClassList()},page={classList:makeClassList(["active"]),surfaces:new Set(),querySelector(s){return this.surfaces.has(s)?{}:null;}};
    const context={window:{},document:{body},$:(id)=>id==="battlePage"?page:null};
    const fixes=fs.readFileSync(path.join(ROOT,"js/45-v154-dev-fixes.js"),"utf8");
    vm.runInNewContext(functionSource("syncBattleUiPriorityLayer")+";window.syncBattleUiPriorityLayer=syncBattleUiPriorityLayer;"+functionSource("setElementBoxSettingsLayer",fixes)+";this.setSettings=setElementBoxSettingsLayer;",context);
    context.setSettings(true);
    assert.equal(body.classList.contains("v174-battle-reading-open"),true);
    page.surfaces.add(".battle-insight-drawer.open");
    context.setSettings(false);
    assert.equal(body.classList.contains("v174-battle-reading-open"),true,"closing settings cannot expose effects over a remaining drawer");
    page.surfaces.clear();context.setSettings(false);
    assert.equal(body.classList.contains("v174-battle-reading-open"),false);
    page.classList.remove("active");context.setSettings(true);
    assert.equal(body.classList.contains("v174-battle-reading-open"),false,"settings outside the battle page cannot retain battle reading state");
    assert.doesNotMatch(functionSource("setElementBoxSettingsLayer",fixes),/clearTimeout|clearInterval|battleActive\s*=|acquirePauseLock/);
});

test("reading state is paint-only and is synchronized at rebuild, teardown and navigation boundaries",()=>{
    const syncBody=functionSource("syncBattleUiPriorityLayer");
    const finishBody=functionSource("finishBattleStatisticsSession");
    assert.match(syncBody,/v174-battle-reading-open/);
    assert.doesNotMatch(syncBody,/FourSymbolsBattleFlow|acquirePresentationLock|acquirePauseLock|battleActive\s*=|clearTimeout|clearInterval/);
    assert.match(finishBody,/closeBattleStatusDetailModal\(\);[\s\S]*syncBattleUiPriorityLayer\(\);/);
    assert.match(source,/runBattleRenderHooks\("after",this,arguments\);\s*if\(typeof syncBattleUiPriorityLayer==="function"\)\{\s*syncBattleUiPriorityLayer\(\);\s*\}/);
    assert.match(source,/target\.classList\.add\([\s\S]*?"active"[\s\S]*?\);[\s\S]*?syncBattleUiPriorityLayer\(\);/);
});
