"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {spawnSync}=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=spawnSync("bash",["-lc","command -v "+name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){return result.stdout.trim();}
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    if(process.env.CI){throw new Error("CI must provide Chrome for battle input geometry QA");}
    console.log("Battle input browser QA skipped: Chrome not available");
    process.exit(0);
}

const mainCss=fs.readFileSync("css/00-main.css","utf8");
function cssRule(selector){
    const start=mainCss.indexOf(selector+"{");
    assert.ok(start>=0,"missing formal geometry owner: "+selector);
    const end=mainCss.indexOf("}",start);
    assert.ok(end>start,"unterminated geometry owner: "+selector);
    return mainCss.slice(start,end+1);
}
const css=[
    cssRule("#mainBattleMenu"),
    cssRule("#mainBattleMenu > .menu-button"),
    cssRule("#mainBattleMenu > .menu-button.skill"),
    cssRule("#mainBattleMenu > .menu-button:nth-of-type(2)"),
    cssRule("#mainBattleMenu > .menu-button.item"),
    cssRule("#mainBattleMenu > .menu-button.defend"),
    cssRule("#mainBattleMenu > .menu-button.run")
].join("\n");
const ui=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const rippleStart=ui.indexOf("let globalTapRippleNode=null;");
const rippleEnd=ui.indexOf("    function boot(){",rippleStart);
assert.ok(rippleStart>=0&&rippleEnd>rippleStart);
const rippleRuntime=ui.slice(rippleStart,rippleEnd);

function run(width,height){
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),"four-symbols-battle-input-"));
    const file=path.join(directory,"qa.html");
    const fixtureCss=[
        "html,body{margin:0;width:"+width+"px;height:"+height+"px;overflow:hidden;background:#111}",
        "#game-stage{position:relative!important;width:"+width+"px!important;height:"+height+"px!important;transform:none!important;overflow:hidden!important}",
        "#battlePage{display:block!important;position:relative!important;width:100%!important;height:240px!important;padding:0!important;overflow:visible!important;box-sizing:border-box!important}",
        "#mainBattleMenu{position:absolute!important;left:10px!important;top:60px!important;width:calc(100% - 20px)!important;margin:0!important}",
        "#outside{position:absolute;left:10px;top:210px;width:80px;height:30px}"
    ].join("\n");
    const qaScript=rippleRuntime+"\n"+
        'const order=["skill","normal","item","defend","run"];'+
        'const menu=document.getElementById("mainBattleMenu");'+
        'const menuRect=menu.getBoundingClientRect();'+
        'const rects=order.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,center:(r.left+r.right)/2,ratio:((r.left+r.right)/2-menuRect.left)/menuRect.width};});'+
        'let normalClicks=0;document.getElementById("normal").addEventListener("click",()=>normalClicks++);'+
        'const normal=document.getElementById("normal");'+
        'for(let i=0;i<20;i++){normal.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerType:"touch",clientX:rects[1].center,clientY:(rects[1].top+rects[1].bottom)/2}));normal.click();}'+
        'const battleRippleCount=document.querySelectorAll(".v141-tap-ripple").length;'+
        'const outside=document.getElementById("outside");'+
        'for(let i=0;i<20;i++){outside.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerType:"touch",clientX:20+i,clientY:220}));}'+
        'const outsideRippleCount=document.querySelectorAll(".v141-tap-ripple").length;'+
        'const centerOwners=rects.map(rect=>{const node=document.elementFromPoint(rect.center,(rect.top+rect.bottom)/2);return node&&node.id;});'+
        'document.getElementById("result").textContent=JSON.stringify({rects,centerOwners,normalClicks,battleRippleCount,outsideRippleCount,menuWidth:menuRect.width});';
    const html='<!doctype html><html><head><meta charset="utf-8"><style>'+css+"\n"+fixtureCss+
        '</style></head><body><div id="game-stage"><div id="battlePage"><div id="mainBattleMenu" class="battle-menu">'+
        '<button id="skill" class="menu-button skill">技能</button>'+
        '<button id="normal" class="menu-button">普通攻擊</button>'+
        '<button id="defend" class="menu-button defend">防禦</button>'+
        '<button id="item" class="menu-button item">背包</button>'+
        '<button id="run" class="menu-button run">逃脫</button>'+
        '</div></div><button id="outside">外部</button></div><pre id="result"></pre><script>'+
        qaScript+'</script></body></html>';
    fs.writeFileSync(file,html);
    const result=spawnSync(chrome,[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
        "--allow-file-access-from-files","--force-device-scale-factor=1",
        "--window-size="+width+","+height,"--virtual-time-budget=100",
        "--dump-dom",pathToFileURL(file).href
    ],{encoding:"utf8",timeout:30000,maxBuffer:25*1024*1024});
    fs.rmSync(directory,{recursive:true,force:true});
    assert.equal(result.status,0,result.stderr);
    const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
    assert.ok(match,"browser QA result missing");
    return JSON.parse(match[1].replaceAll("&quot;",'"').replaceAll("&amp;","&"));
}

for(const [width,height] of [[390,844],[412,915]]){
    const data=run(width,height);
    assert.ok(data.menuWidth>0,"battle command panel must have measurable geometry at "+width+"px: "+JSON.stringify(data));
    for(let index=0;index<data.rects.length-1;index++){
        assert.ok(data.rects[index].right<=data.rects[index+1].left+.05,"hitboxes overlap at "+width+"px");
    }
    const expected=[.156,.331,.503,.673,.847];
    data.rects.forEach((rect,index)=>assert.ok(Math.abs(rect.ratio-expected[index])<.008,rect.id+" center does not match artwork at "+width+"px"));
    assert.deepEqual(data.centerOwners,["skill","normal","item","defend","run"],"each artwork center must resolve to its own command at "+width+"px");
    assert.equal(data.normalClicks,20,"rapid pointer input must preserve normal-attack onclick behavior");
    assert.equal(data.battleRippleCount,0,"battle input must not allocate global ripple DOM");
    assert.ok(data.outsideRippleCount<=1,"global non-battle feedback must reuse at most one ripple node");
}

console.log("✓ battle command hitboxes and bounded tap feedback passed at 390×844 and 412×915");
