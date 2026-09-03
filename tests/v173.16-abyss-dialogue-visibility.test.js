"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function sourceFunction(source,signature){
    const start=source.indexOf(signature);
    assert.notEqual(start,-1,signature+" source");
    let depth=0;
    for(let index=source.indexOf("{",start);index<source.length;index++){
        if(source[index]==="{"){ depth++; }
        if(source[index]==="}"&&--depth===0){ return source.slice(start,index+1); }
    }
    throw new Error(signature+" closing brace");
}

function dialogueHarness(){
    const mapRect={left:12,top:7.5,width:420,height:660,right:432,bottom:667.5};
    const bossRect={left:18,top:30,width:72,height:150,right:90,bottom:180};
    const text={textContent:""};
    const hint={textContent:""};
    const boss={
        getBoundingClientRect(){ return bossRect; },
        querySelector(selector){ return selector==="b"?{textContent:"東帝"}:null; }
    };
    const map={
        dataset:{},children:[],offsetWidth:1080,offsetHeight:1697,
        getBoundingClientRect(){ return mapRect; },
        querySelector(selector){
            if(selector===".v141-abyss-boss"){ return boss; }
            if(selector===".v143-abyss-dialogue"){
                return this.children.find(child=>child.className==="v143-abyss-dialogue")||null;
            }
            return null;
        },
        appendChild(child){ child.parentNode=this; this.children.push(child); return child; },
        removeChild(child){ this.children=this.children.filter(item=>item!==child); child.parentNode=null; }
    };
    const overlay={
        className:"",style:{setProperty(name,value){ this[name]=String(value); }},offsetWidth:330,offsetHeight:104,parentNode:null,disabled:false,
        setAttribute(name,value){ this[name]=String(value); },
        querySelector(selector){ return selector==="b"?text:selector==="span"?hint:null; },
        remove(){ if(this.parentNode){ this.parentNode.removeChild(this); } }
    };
    let launches=0;
    const context={
        Math,Number,
        abyssBattleStarting:false,
        abyssState:{phase:"boss",floor:1},
        ABYSS_DIALOGUE:{1:["第一句","第二句","第三句"]},
        escapeHtml:value=>String(value),
        document:{
            getElementById(id){ return id==="v141AbyssMap"?map:null; },
            createElement(tag){ assert.equal(tag,"button"); return overlay; }
        },
        launchAbyssBossBattle(){ launches++; return true; },
        setTimeout(callback){ callback(); return 1; }
    };
    vm.createContext(context);
    vm.runInContext(
        sourceFunction(abyss,"function positionAbyssBossDialogue(")+"\n"+
        sourceFunction(abyss,"function openAbyssBossDialogue(")+"\n"+
        "this.runPosition=positionAbyssBossDialogue;this.runOpen=openAbyssBossDialogue;",
        context
    );
    return {boss,context,hint,map,mapRect,overlay,text,get launches(){ return launches; }};
}

test("Abyss dialogue and battle launch have one direct runtime owner",()=>{
    const owners=fs.readdirSync("js")
        .filter(file=>file.endsWith(".js"))
        .reduce((count,file)=>count+(fs.readFileSync("js/"+file,"utf8").match(/window\.v141ChallengeAbyssBoss\s*=\s*function/g)||[]).length,0);
    assert.equal(owners,1);
    assert.match(abyss,/window\.v141ChallengeAbyssBoss=function\(\)\{\s*return openAbyssBossDialogue\(\);\s*\}/);
    assert.match(abyss,/map\.appendChild\(overlay\);\s*positionAbyssBossDialogue\(map,overlay,bossButton\);/);
    const css=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");
    assert.match(css,/left:var\(--v141-abyss-dialogue-left,50%\) !important;/);
    assert.match(css,/top:var\(--v141-abyss-dialogue-top,112px\) !important;/);
});

test("scaled-stage coordinates keep the entire dialogue inside the map",()=>{
    const harness=dialogueHarness();
    assert.equal(harness.context.runPosition(harness.map,harness.overlay,harness.boss),true);
    assert.equal(harness.overlay.style["--v141-abyss-dialogue-left"],harness.overlay.style.left);
    assert.equal(harness.overlay.style["--v141-abyss-dialogue-top"],harness.overlay.style.top);
    const logicalLeft=parseFloat(harness.overlay.style.left);
    const logicalTop=parseFloat(harness.overlay.style.top);
    const scaleX=harness.map.offsetWidth/harness.mapRect.width;
    const scaleY=harness.map.offsetHeight/harness.mapRect.height;
    const screenLeft=harness.mapRect.left+(logicalLeft-harness.overlay.offsetWidth/2)/scaleX;
    const screenRight=harness.mapRect.left+(logicalLeft+harness.overlay.offsetWidth/2)/scaleX;
    const screenTop=harness.mapRect.top+(logicalTop-harness.overlay.offsetHeight)/scaleY;
    const screenBottom=harness.mapRect.top+logicalTop/scaleY;
    assert.ok(screenLeft>=harness.mapRect.left);
    assert.ok(screenRight<=harness.mapRect.right);
    assert.ok(screenTop>=harness.mapRect.top);
    assert.ok(screenBottom<=harness.mapRect.bottom);
});

test("one guardian tap shows dialogue and three dialogue taps launch battle",()=>{
    const harness=dialogueHarness();
    assert.equal(harness.context.runOpen(),true);
    assert.equal(harness.map.children.length,1);
    assert.equal(harness.text.textContent,"第一句");
    assert.match(harness.overlay.style.left,/px$/);
    assert.match(harness.overlay.style.top,/px$/);
    const click={preventDefault(){},stopPropagation(){}};
    harness.overlay.onclick(click);
    assert.equal(harness.text.textContent,"第二句");
    harness.overlay.onclick(click);
    assert.equal(harness.text.textContent,"第三句");
    harness.overlay.onclick(click);
    assert.equal(harness.launches,1);
    assert.equal(harness.map.children.length,0);
});

test("the published cache release is V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.42"/);
    assert.match(index,/<title>四象江湖傳 V173\.42<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.42"[\s\S]*?>V173\.42<\/div>/);
});

console.log("\n"+passed+" V173.39 Abyss dialogue visibility tests passed.");
