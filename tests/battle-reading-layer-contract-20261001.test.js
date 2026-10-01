const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(ROOT,"js/00-main.js"),"utf8");

function functionSource(name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const brace=source.indexOf("{",start);
    let depth=0;
    for(let index=brace;index<source.length;index++){
        if(source[index]==="{"){ depth++; }
        else if(source[index]==="}"&&--depth===0){ return source.slice(start,index+1); }
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
    const context={document:{body},$:(id)=>id==="game-stage"?stage:id==="battlePage"?page:null};
    vm.runInNewContext(functionSource("syncBattleUiPriorityLayer")+";this.syncBattleUiPriorityLayer=syncBattleUiPriorityLayer;",context);

    const selectors=[
        ".battle-info-region.is-expanded",
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

test("reading state is paint-only and is synchronized at rebuild, teardown and navigation boundaries",()=>{
    const syncBody=functionSource("syncBattleUiPriorityLayer");
    const finishBody=functionSource("finishBattleStatisticsSession");
    assert.match(syncBody,/v174-battle-reading-open/);
    assert.doesNotMatch(syncBody,/FourSymbolsBattleFlow|acquirePresentationLock|acquirePauseLock|battleActive\s*=|clearTimeout|clearInterval/);
    assert.match(finishBody,/closeBattleStatusDetailModal\(\);[\s\S]*setBattleInfoExpanded\(false\);[\s\S]*syncBattleUiPriorityLayer\(\);/);
    assert.match(source,/runBattleRenderHooks\("after",this,arguments\);\s*syncBattleUiPriorityLayer\(\);/);
    assert.match(source,/target\.classList\.add\([\s\S]*?"active"[\s\S]*?\);[\s\S]*?syncBattleUiPriorityLayer\(\);/);
});
