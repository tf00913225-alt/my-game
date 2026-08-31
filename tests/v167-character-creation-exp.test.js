"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const main=fs.readFileSync("js/00-main.js","utf8");
const index=fs.readFileSync("index.html","utf8");

function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const opening=source.indexOf("{",start);
    let depth=0;
    let quote=null;
    let escaped=false;
    let lineComment=false;
    let blockComment=false;

    for(let cursor=opening;cursor<source.length;cursor++){
        const char=source[cursor];
        const next=source[cursor+1];
        if(lineComment){
            if(char==="\n"){ lineComment=false; }
            continue;
        }
        if(blockComment){
            if(char==="*"&&next==="/"){ blockComment=false; cursor++; }
            continue;
        }
        if(quote){
            if(escaped){ escaped=false; continue; }
            if(char==="\\"){ escaped=true; continue; }
            if(char===quote){ quote=null; }
            continue;
        }
        if(char==="/"&&next==="/"){ lineComment=true; cursor++; continue; }
        if(char==="/"&&next==="*"){ blockComment=true; cursor++; continue; }
        if(char==='"'||char==="'"||char==="`"){ quote=char; continue; }
        if(char==="{"){ depth++; }
        if(char==="}"&&--depth===0){ return source.slice(start,cursor+1); }
    }
    throw new Error("unterminated function "+name);
}

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("additional character step one has a return action while first creation does not",()=>{
    assert.match(index,/id="creationPrimaryNextButton"[\s\S]*?creation-cancel-additional/);
    assert.match(
        index,
        /id="creationAdditionalStepOneActions"[\s\S]*?hidden[\s\S]*?cancelAdditionalCharacterCreation\(\)[\s\S]*?返回角色頁/
    );

    const nodes={
        creationContextSubtitle:{textContent:""},
        creationSubmitLabel:{textContent:""},
        creationCancelButton:{hidden:true},
        creationPrimaryNextButton:{hidden:false},
        creationAdditionalStepOneActions:{hidden:true}
    };
    const context=vm.createContext({creationTargetSlot:1,$:id=>nodes[id]||null});
    vm.runInContext(extractFunction(main,"updateCreationScreenContext"),context);

    context.updateCreationScreenContext();
    assert.equal(nodes.creationPrimaryNextButton.hidden,false);
    assert.equal(nodes.creationAdditionalStepOneActions.hidden,true);
    assert.equal(nodes.creationCancelButton.hidden,true);

    context.creationTargetSlot=2;
    context.updateCreationScreenContext();
    assert.equal(nodes.creationPrimaryNextButton.hidden,true);
    assert.equal(nodes.creationAdditionalStepOneActions.hidden,false);
    assert.equal(nodes.creationCancelButton.hidden,false);

    context.creationTargetSlot=3;
    context.updateCreationScreenContext();
    assert.equal(nodes.creationAdditionalStepOneActions.hidden,false);

    const returnCalls=[];
    const returnNodes={
        creationPage:{style:{display:"block"}},
        gameInterface:{style:{display:"none"}}
    };
    const returnContext=vm.createContext({
        creationTargetSlot:2,
        $:id=>returnNodes[id]||null,
        updateCreationScreenContext:()=>returnCalls.push("sync"),
        window:{syncCreationTouchMode:()=>returnCalls.push("touch")},
        showPage:page=>returnCalls.push("page:"+page),
        openHomeFeature:feature=>returnCalls.push("feature:"+feature)
    });
    vm.runInContext(extractFunction(main,"cancelAdditionalCharacterCreation"),returnContext);
    returnContext.cancelAdditionalCharacterCreation();
    assert.equal(returnContext.creationTargetSlot,1);
    assert.equal(returnNodes.creationPage.style.display,"none");
    assert.equal(returnNodes.gameInterface.style.display,"block");
    assert.deepEqual(returnCalls,["sync","touch","page:home","feature:character"]);
});

test("second and third character IDs cannot duplicate an existing ID",()=>{
    const existingCharacters=[{id:"Hero"},{id:"寒泉"}];
    const context=vm.createContext({
        getCharacters:()=>existingCharacters
    });
    vm.runInContext(
        extractFunction(main,"normalizeCharacterIdForComparison")+"\n"+
        extractFunction(main,"isCharacterIdTaken"),
        context
    );

    assert.equal(context.isCharacterIdTaken("Hero"),true);
    assert.equal(context.isCharacterIdTaken(" hero "),true);
    assert.equal(context.isCharacterIdTaken("ＨＥＲＯ"),true);
    assert.equal(context.isCharacterIdTaken("寒泉"),true);
    assert.equal(context.isCharacterIdTaken("NewHero"),false);
    assert.match(
        extractFunction(main,"createAdditionalCharacter"),
        /if\(isCharacterIdTaken\(id\)\)[\s\S]*?角色 ID 不能與現有角色重複/
    );
    assert.match(
        extractFunction(main,"createSecondCharacter"),
        /if\(isCharacterIdTaken\(id\)\)[\s\S]*?角色 ID 不能與現有角色重複/
    );
});

test("the upper test tool grants exactly one billion EXP",()=>{
    assert.match(main,/const TEST_EXP_POOL_GRANT=1000000000;/);
    assert.match(index,/id="testExpTenMillionButton"[\s\S]*?經驗池 <b>\+10億<\/b>/);

    const alerts=[];
    let updateUICount=0;
    let saveCount=0;
    const context=vm.createContext({
        sharedExp:25,
        TEST_EXP_POOL_GRANT:1000000000,
        updateUI:()=>{ updateUICount++; },
        saveGame:()=>{ saveCount++; },
        alert(message){ alerts.push(String(message)); }
    });
    vm.runInContext(extractFunction(main,"grantTestExpTenMillion"),context);
    context.grantTestExpTenMillion();

    assert.equal(context.sharedExp,1000000025);
    assert.equal(updateUICount,1);
    assert.equal(saveCount,1);
    assert.match(alerts[0],/\+1,000,000,000/);
});

test("dynamic redraw keeps the upper EXP label at one billion",()=>{
    const nodes={
        testGoldMillionButton:{innerHTML:""},
        testExpTenMillionButton:{innerHTML:""}
    };
    const context=vm.createContext({$:id=>nodes[id]||null});
    vm.runInContext(extractFunction(main,"updateHomeTestTools"),context);
    context.updateHomeTestTools();
    assert.equal(nodes.testExpTenMillionButton.innerHTML,"經驗池 <b>+10億</b>");
    assert.match(index,/js\/00-main\.js\?v=173\.5/);
});

console.log("\nV167 character creation / EXP suite: "+passed+" tests passed.");
