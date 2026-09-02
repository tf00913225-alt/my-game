"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=path=>fs.readFileSync(path,"utf8");
const index=read("index.html");
const baseCss=read("css/00-main.css");
const v54Css=read("css/19-stage-v54-main-city-moderate-native-scale.css");
const v54Runtime=read("js/16-stage-v54-main-city-runtime.js");
const rosterCss=read("css/42-v146-system-polish.css");
const rosterRuntime=read("js/41-v146-system-polish.js");
const loader=read("js/20-anonymous-20.js");

const actionStart=index.indexOf('<div class="home-card-grid"');
const actionEnd=index.indexOf('<div\n    id="homeRestCard"',actionStart);
assert.ok(actionStart>=0&&actionEnd>actionStart,"main-city action markup exists");
const actions=index.slice(actionStart,actionEnd);

let passed=0;
function test(name,callback){
    callback();
    passed++;
    console.log("✓ "+name);
}

function count(source,pattern){
    return (source.match(pattern)||[]).length;
}

test("the compact HUD exposes one dynamic list for up to three real characters",()=>{
    assert.match(index,/class="home-city-hud"[^>]*aria-label="主城角色與資源資訊"/);
    assert.match(index,/id="homeHudCharacterList" class="home-hud-character-list"/);
    assert.match(index,/id="homeHudCharacterName"/);
    assert.match(index,/id="homeHudCharacterLevel"/);
    assert.match(index,/id="homeHudGoldValue"/);
    assert.match(index,/id="homeHudExpValue"/);
    assert.doesNotMatch(index,/<h2>主城<\/h2>/);
    assert.match(baseCss,/\.home-city-hud\{[\s\S]*min-height:64px;[\s\S]*background:/);
    assert.match(baseCss,/\.home-hud-character-row\{[\s\S]*grid-template-columns:12px minmax\(0,1fr\) auto/);
});

test("character and shop are the only two primary entrances",()=>{
    assert.equal(count(actions,/class="home-card home-card-primary"/g),2);
    assert.match(actions,/home-primary-actions[\s\S]*openHomeFeature\('character'\)[\s\S]*openHomeFeature\('shop'\)/);
    assert.match(baseCss,/\.home-primary-actions\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,46%\)\);[\s\S]*width:93%/);
    assert.match(baseCss,/\.home-card-primary\{[\s\S]*height:78px;[\s\S]*border:1px solid rgba\(222,170,70,.9\)/);
    assert.match(baseCss,/\.home-card-primary::after\{[\s\S]*linear-gradient/);
    assert.doesNotMatch(baseCss,/\.home-card-primary \.home-card-label\{[\s\S]{0,220}background:/);
});

test("six secondary entrances form inward-stepping pairs around the city gate",()=>{
    assert.equal(count(actions,/class="home-card home-card-secondary"/g),6);
    ["rest","synthesis","quest","bestiary","achievement","announcement"].forEach(type=>{
        assert.match(actions,new RegExp("openHomeFeature\\('"+type+"'\\)"));
    });
    assert.match(baseCss,/\.home-secondary-actions\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*grid-template-rows:repeat\(3,58px\);[\s\S]*min-height:174px/);
    assert.match(baseCss,/\.home-card-secondary:nth-child\(3\)\{margin-inline-start:34px;\}/);
    assert.match(baseCss,/\.home-card-secondary:nth-child\(4\)\{margin-inline-end:34px;\}/);
    assert.match(baseCss,/\.home-card-secondary:nth-child\(5\)\{margin-inline-start:68px;\}/);
    assert.match(baseCss,/\.home-card-secondary:nth-child\(6\)\{margin-inline-end:68px;\}/);
    assert.match(baseCss,/\.home-card-secondary\{[\s\S]*background:transparent;[\s\S]*box-shadow:none/);
    assert.match(baseCss,/\.home-card-secondary \.home-card-icon\{[\s\S]*width:44px;[\s\S]*height:44px/);
});

test("offline experience and system stay in a low-weight utility row",()=>{
    assert.equal(count(actions,/class="home-card home-card-utility"/g),2);
    assert.match(actions,/home-utility-actions[\s\S]*openHomeFeature\('offlineExp'\)[\s\S]*openHomeFeature\('system'\)/);
    assert.match(baseCss,/\.home-utility-actions\{[\s\S]*grid-template-columns:repeat\(2,108px\);[\s\S]*justify-content:center/);
    assert.match(baseCss,/\.home-card-utility\{[\s\S]*height:40px;[\s\S]*border-radius:999px;[\s\S]*background:rgba\(8,7,6,.42\)/);
});

test("all ten existing entry IDs and click contracts remain intact",()=>{
    const entries={
        Character:"character",Shop:"shop",Rest:"rest",Synthesis:"synthesis",Quest:"quest",
        Bestiary:"bestiary",Achievement:"achievement",Announcement:"announcement",
        OfflineExp:"offlineExp",System:"system"
    };
    Object.entries(entries).forEach(([id,type])=>{
        assert.equal(count(actions,new RegExp('id="homeIcon'+id+'"','g')),1);
        assert.equal(count(actions,new RegExp("openHomeFeature\\('"+type+"'\\)",'g')),1);
    });
    assert.equal(count(actions,/<button type="button" class="home-card /g),10);
});

test("DEV gold and EXP shortcuts remain direct but visually recessive",()=>{
    assert.match(index,/id="testGoldMillionButton" onclick="grantTestGoldMillion\(\)"/);
    assert.match(index,/id="testExpTenMillionButton" onclick="grantTestExpTenMillion\(\)"/);
    assert.match(baseCss,/\.home-test-button\{[\s\S]*height:16px;[\s\S]*opacity:.78/);
    assert.doesNotMatch(baseCss,/\.home-test-button\{[\s\S]{0,260}height:34px/);
});

test("the historical V54 bridge no longer flattens hierarchy with inline important fonts",()=>{
    assert.doesNotMatch(v54Runtime,/createTreeWalker|font-size|setProperty\(/);
    assert.match(v54Runtime,/home\.classList\.add\("main-city-lobby-ready"\)/);
    assert.doesNotMatch(v54Css,/#game-stage #homePage button,[\s\S]*font-size:18px !important/);
});

test("the roster renderer maps all existing characters once into both HUD and party cards",()=>{
    assert.match(rosterRuntime,/const partyIndexes=getExistingPartyIndexes\(\)\.slice\(0,3\)/);
    assert.match(rosterRuntime,/const hudCharacters=document\.getElementById\("homeHudCharacterList"\)/);
    assert.match(rosterRuntime,/hudCharacters\.innerHTML=partyIndexes\.map\(\(index,position\)=>/);
    assert.doesNotMatch(rosterRuntime,/primaryCharacter=partyIndexes/);
    assert.match(rosterRuntime,/homeHudGoldValue/);
    assert.match(rosterRuntime,/homeHudExpValue/);
    assert.match(rosterRuntime,/隊伍 '\+partyIndexes\.length\+' \/ 3/);
    assert.match(rosterRuntime,/class="v146-home-avatar"/);
    assert.match(rosterCss,/\.v146-home-roster\{[\s\S]*display:grid;[\s\S]*gap:5px;[\s\S]*background:linear-gradient\(155deg,rgba\(28,19,12,.64\),rgba\(5,5,4,.56\)\)/);
    assert.match(rosterCss,/\.v146-home-character\{[\s\S]*grid-template-columns:36px minmax\(0,1fr\);[\s\S]*height:38px/);
    assert.match(rosterCss,/\.v146-home-avatar\{[\s\S]*transform:translateX\(-4px\)/);
    ["fire","water","wind","earth"].forEach(element=>assert.match(rosterCss,new RegExp('data-element="'+element+'"')));
});

test("gold and EXP share one compact formatter without ellipsis",()=>{
    const numericSource=rosterRuntime.match(/function numeric\(value\)\{[\s\S]*?\n    \}/)[0];
    const formatterSource=rosterRuntime.match(/function formatHomeResourceValue\(value\)\{[\s\S]*?\n    \}/)[0];
    const formatValues=Function(numericSource+"\n"+formatterSource+"\nreturn [formatHomeResourceValue(12485243),formatHomeResourceValue(104852430),formatHomeResourceValue(1248524300)];");
    assert.deepEqual(formatValues(),["1248萬","1.05億","12.5億"]);
    assert.match(rosterRuntime,/syncHomeResourceValue\(hudGold,[^\n]+\);[\s\S]*syncHomeResourceValue\(hudExp,[^\n]+\);/);
    assert.doesNotMatch(formatterSource,/\.\.\./);
    assert.doesNotMatch(baseCss,/\.home-hud-resources b\{[\s\S]{0,180}text-overflow:ellipsis/);
});

test("the fixed 9:16 home keeps one compact non-scrolling layout owner",()=>{
    assert.match(baseCss,/#homePage\{[\s\S]{0,420}height:100%;[\s\S]{0,120}overflow:hidden/);
    assert.match(baseCss,/\.home-card-grid\{[\s\S]*display:flex;[\s\S]*flex:0 0 auto/);
    assert.match(baseCss,/\.home-card-primary\{[\s\S]*height:78px/);
    assert.match(baseCss,/\.home-secondary-actions\{[\s\S]*min-height:174px/);
    assert.doesNotMatch(baseCss,/\.home-card-grid\{[\s\S]{0,220}grid-template-columns:repeat\(4,1fr\)/);
});

test("development cache and visible version advance to V173.31",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.31"/);
    assert.match(index,/<title>四象江湖傳 V173\.31<\/title>/);
    assert.match(index,/aria-label="目前版本 V173\.31"[\s\S]*?>V173\.31<\/div>/);
    assert.match(index,/css\/00-main\.css\?v=173\.31/);
    assert.match(index,/css\/19-stage-v54-main-city-moderate-native-scale\.css\?v=173\.31/);
    assert.match(index,/js\/00-main\.js\?v=173\.31/);
    assert.match(index,/js\/16-stage-v54-main-city-runtime\.js\?v=173\.31/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.31/);
});

console.log("\n"+passed+" V173.31 main-city lobby tests passed.");
