"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const read=file=>fs.readFileSync(file,"utf8");
const main=read("js/00-main.js"),css=read("css/00-main.css");
const owner=main.slice(main.indexOf("const displayTokens ="),main.indexOf("/* =====================================================\n   基本設定"));
function fixture({tokens=true}={}){
    const values=Object.fromEntries([...css.matchAll(/--(stage-design-width|stage-design-height|legacy-design-width):([\d.]+);/g)].map(m=>["--"+m[1],m[2]]));
    const stage={style:{},rect:{left:467,top:0,width:432,height:768},getBoundingClientRect(){return this.rect;}};
    const content={style:{},rect:{left:467,top:0,width:432,height:768},getBoundingClientRect(){return this.rect;}};
    const viewport={clientWidth:1366,clientHeight:768},root={},elements={"game-stage":stage,"game-content":content,"game-viewport":viewport};
    const listeners=[],window={innerWidth:1366,innerHeight:768,addEventListener:(name,fn)=>listeners.push({target:"window",name,fn}),visualViewport:{addEventListener:(name,fn)=>listeners.push({target:"visualViewport",name,fn})}};
    const context=vm.createContext({window,document:{documentElement:root,getElementById:id=>elements[id]||null},getComputedStyle:()=>({getPropertyValue:key=>tokens?values[key]||"":""})});
    vm.runInContext(owner,context);
    vm.runInContext(read("js/02-stage-v9-native-coordinate-api.js"),context);
    return {window,stage,content,viewport,elements,listeners,context};
}
function near(point,x,y){assert.ok(Math.abs(point.x-x)<1e-7&&Math.abs(point.y-y)<1e-7,JSON.stringify({point,x,y}));}
test("native aliases share the sole owner and reproduce the diagnosed scaled-center roundtrip",()=>{
    const {window:w}=fixture();
    assert.equal(w.screenToGame,w.screenToGamePoint);assert.equal(w.gameToScreen,w.gameToScreenPoint);assert.equal(w.eventToGame,w.eventToGamePoint);
    near(w.gameToScreen(540,960),683,384);near(w.screenToGame(683,384),540,960);
    // Diagnostics and obsolete public property must not become a second source of geometry.
    w.gameStageScale=9;w.GAME_STAGE_SCALE=9;w.GAME_STAGE_LEFT=-100;
    near(w.screenToGame(683,384),540,960);
});
test("all presentation domains roundtrip after resize, offset and non-uniform measured bounds",()=>{
    const f=fixture(),w=f.window;
    for(const rect of [{left:17,top:41,width:390,height:693.333333},{left:96,top:0,width:576,height:1024},{left:81.1875,top:0,width:671.625,height:1194},{left:321.25,top:27.75,width:509.2,height:901.1}]){
        f.stage.rect=rect;f.content.rect={...rect,width:rect.width-0.01,height:rect.height-0.02};
        for(const surface of ["browser","native","legacy"]){
            const width=surface==="legacy"?420:1080,height=surface==="legacy"?1920*420/1080:1920;
            for(const [x,y] of [[0,0],[width,0],[0,height],[width,height],[width/2,height/2],[-5,-7]]){
                const p=w.FourSymbolsDisplay.surfaceToClient(surface,x,y);
                near(w.FourSymbolsDisplay.clientToSurface(surface,p.x,p.y),x,y);
                if(surface==="browser")near(p,x,y);
            }
        }
        near(w.screenToGame(rect.left+rect.width/2,rect.top+rect.height/2),540,960);
    }
    assert.throws(()=>w.FourSymbolsDisplay.clientToSurface("guess",0,0),/Unknown display surface/);
});
test("pointer, touchstart, touchend and omitted events consume the same conversion",()=>{
    const {window:w}=fixture(),p={clientX:683,clientY:384};
    for(const e of [p,{touches:[p]},{touches:[],changedTouches:[p]}])near(w.eventToGame(e),540,960);
    near(w.eventToGame(),-467/0.4,0);
});
test("one resize subscription per target and CSS alone owns the legacy transform/root lock",()=>{
    const f=fixture();
    assert.deepEqual(f.listeners.map(x=>x.target+":"+x.name),["window:resize","window:orientationchange","visualViewport:resize"]);
    assert.equal(f.content.style.transform,undefined);
    assert.doesNotMatch(owner,/content\.style\.transform|document\.body\.style|enforceViewportSurface|installViewportLock/);
    assert.equal((css.match(/transform:scale\(var\(--legacy-to-native\)\)/g)||[]).length,1);
    assert.equal(fs.existsSync("css/02-stage-v3-layout-fix.css"),false);
    assert.doesNotMatch(read("scripts/build-production.mjs"),/02-stage-v3-layout-fix/);
    assert.doesNotMatch(read("js/02-stage-v9-native-coordinate-api.js"),/getBoundingClientRect|gameStageScale/);
    assert.doesNotMatch(read("css/09-stage-v15-native-character-shell.css"),/--game-(?:native|legacy)-(?:width|height):/);
});
test("missing design tokens fail explicitly instead of silently inventing another dimension owner",()=>{
    assert.throws(()=>fixture({tokens:false}),/Display design tokens are unavailable/);
});
