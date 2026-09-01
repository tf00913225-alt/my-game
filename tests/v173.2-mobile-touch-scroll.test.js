"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const css=fs.readFileSync("css/29-v125-character-creation-native.css","utf8");
const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

function ruleAfter(marker){
    const indexOfMarker=css.lastIndexOf(marker);
    assert.notEqual(indexOfMarker,-1,"missing CSS marker: "+marker);
    const end=css.indexOf("\n}\n",indexOfMarker);
    assert.notEqual(end,-1,"unterminated CSS rule: "+marker);
    return css.slice(indexOfMarker,end+3);
}

test("V173.2 creation stat controls retain a 44px-or-larger physical hit box on target phones",()=>{
    const statRule=ruleAfter("#creationPage .creation-stat{");
    const buttonRule=ruleAfter("#creationPage .creation-stat-button{");
    const rightRule=ruleAfter("#creationPage .creation-stat-right{");

    assert.match(statRule,/min-height:184px;/);
    assert.match(buttonRule,/width:136px;/);
    assert.match(buttonRule,/min-width:136px;/);
    assert.match(buttonRule,/height:136px;/);
    assert.match(buttonRule,/min-height:136px;/);
    assert.match(buttonRule,/padding:0;/);
    assert.doesNotMatch(buttonRule,/transform\s*:/);
    assert.match(rightRule,/gap:8px;/);

    for(const [width,height] of [[360,800],[390,844],[412,915],[390,932]]){
        const scale=Math.min(width/1080,height/1920);
        const physicalButtonSize=136*scale;
        assert.ok(
            physicalButtonSize>=44,
            `${width}×${height} renders a ${physicalButtonSize.toFixed(2)}px stat control`
        );
    }

    const statColumn=(1080-36*2-33.429*2-18)/2;
    const statContent=statColumn-20-18-2.571*2;
    const controls=136*2+8*2+36;
    assert.ok(
        statContent-controls-12>=64,
        "the two-column stat row retains room for a two-character ability label"
    );
});

test("Each native creation stat button keeps one action path",()=>{
    for(const stat of ["attack","vitality","energy","intelligence","spirit","agility"]){
        for(const amount of [-1,1]){
            const source=`onclick="creationAdd('${stat}',${amount})"`;
            assert.equal(
                index.split(source).length-1,
                1,
                `${stat} ${amount>0?"plus":"minus"} button must have one click handler`
            );
        }
    }
});

test("Only the real creation skill-level scroll owner bypasses the stage touch lock",()=>{
    const whitelist=touchLock.match(/const allowedSelector\s*=[\s\S]*?;\n\n\s*let node\s*=/);
    assert.ok(whitelist,"touch-lock whitelist must remain explicit");
    assert.match(whitelist[0],/\.creation-skill-detail-levels/);
    assert.doesNotMatch(whitelist[0],/\.creation-skill-detail-box/);
    assert.match(
        touchLock,
        /style\.overflowY==="auto"\s*\|\|\s*style\.overflowY==="scroll"[\s\S]*?node\.scrollHeight >\s*node\.clientHeight \+ 1/
    );
    const levelsRule=ruleAfter("#creationSkillDetailModal .creation-skill-detail-levels{");
    assert.match(levelsRule,/overflow-y:auto;/);
    assert.match(levelsRule,/overscroll-behavior-y:contain;/);
    assert.match(levelsRule,/touch-action:pan-y;/);
});

test("A touch inside skill levels is allowed once, while the modal background remains locked",()=>{
    const listeners=new Map();
    const documentElement={};
    const window={
        addEventListener(){},
        getComputedStyle(node){ return node.computedStyle||{overflowY:"visible"}; }
    };
    const document={
        documentElement,
        addEventListener(name,handler){ listeners.set(name,handler); }
    };
    vm.runInNewContext(touchLock,{document,window});

    const stage={};
    const levels={
        nodeType:1,parentElement:documentElement,scrollHeight:420,clientHeight:120,
        computedStyle:{overflowY:"auto"},
        matches:selector=>selector.includes(".creation-skill-detail-levels"),
        closest:selector=>selector==="#game-stage"?stage:null
    };
    const levelText={
        nodeType:1,parentElement:levels,matches:()=>false,
        closest:selector=>selector==="#game-stage"?stage:null
    };
    const modalBackground={
        nodeType:1,parentElement:documentElement,matches:()=>false,
        closest:selector=>selector==="#game-stage"?stage:null
    };
    const dispatch=(type,target,pointerType)=>{
        let prevented=false;
        listeners.get(type)({
            target,pointerType,
            preventDefault(){ prevented=true; }
        });
        return prevented;
    };

    assert.equal(window.isInsideAllowedScrollerV78(levelText),true);
    assert.equal(dispatch("touchmove",levelText),false);
    assert.equal(dispatch("pointermove",levelText,"touch"),false);
    assert.equal(dispatch("touchmove",modalBackground),true);
    assert.equal(dispatch("pointermove",modalBackground,"touch"),true);
});

test("The published mobile fix remains covered in the V173.26 cache release",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.26"/);
    assert.match(index,/css\/29-v125-character-creation-native\.css\?v=173\.26/);
    assert.match(index,/js\/01-stage-v8-touch-lock\.js\?v=173\.26/);
    assert.match(index,/aria-label="目前版本 V173\.26"[\s\S]*?>V173\.26<\/div>/);
});

console.log("\nV173.2 mobile touch and scroll suite: "+passed+" tests passed.");
