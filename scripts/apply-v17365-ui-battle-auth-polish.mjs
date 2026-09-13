import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function write(path,value){ fs.writeFileSync(path,value,"utf8"); }
function replaceOnce(text,from,to,label){
  if(!text.includes(from)) throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(from,to);
}
function insertBefore(text,anchor,addition,label){
  if(!text.includes(anchor)) throw new Error(`Missing insert anchor: ${label}`);
  return text.replace(anchor,addition+anchor);
}

// 1. BOSS art: preserve the full portrait. Mechanism/function card returns to 4:3.
{
  const path="css/gameplay-boss-tower.css";
  let s=read(path);
  s=replaceOnce(s,
`    background-position:center 18%;
    background-repeat:no-repeat;
    background-size:cover;`,
`    background-position:center;
    background-repeat:no-repeat;
    background-size:contain;`,"boss portrait background contain");
  s=replaceOnce(s,
`    object-fit:cover;
    object-position:center 18%;`,
`    object-fit:contain;
    object-position:center;`,"boss portrait img contain");
  const mechanismAnchor=`#game-stage #battleMonsterArea .boss-mechanism-card{`;
  const start=s.indexOf(mechanismAnchor);
  if(start<0) throw new Error("Missing mechanism card rule");
  const end=s.indexOf("}",start);
  let rule=s.slice(start,end+1);
  if(!rule.includes("aspect-ratio:9 / 16;")) throw new Error("Mechanism card was not 9:16 at patch time");
  rule=rule.replace("aspect-ratio:9 / 16;","aspect-ratio:4 / 3;");
  s=s.slice(0,start)+rule+s.slice(end+1);
  s=s.replace("BOSS combat portrait and mechanism card stays 9:16 on mobile.","BOSS combat portrait stays vertical; the compact mechanism/function card uses 4:3.");
  write(path,s);
}

// 2+3. Cardless battle: stop over-zooming players and pin enemy HP/SP bars above artwork.
{
  const path="js/54-v173.51-battle-qa.js";
  let s=read(path);
  s=replaceOnce(s,
`    inset:-8px -8px 30px!important;
    background-size:150% auto!important;background-position:center bottom!important;`,
`    inset:-2px -2px 30px!important;
    background-size:contain!important;background-position:center bottom!important;`,"player battle art sane size");
  const anchor=`#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.battle-player-id{
    z-index:20!important;
}`;
  const add=`#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-hp{
    position:absolute!important;left:50%!important;bottom:13px!important;
    display:block!important;visibility:visible!important;opacity:1!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.monster-sp{
    position:absolute!important;left:50%!important;bottom:0!important;
    display:block!important;visibility:visible!important;opacity:1!important;
    margin:0!important;transform:translateX(-50%)!important;
}
`;
  s=insertBefore(s,anchor,add,"enemy resource bar anchors");
  write(path,s);
}

// 4. Main-city roster/HUD is first-screen UI. Move its renderer/style owner out of lazy gameplay-core.
{
  const lazyJsPath="js/41-v146-system-polish.js";
  let lazy=read(lazyJsPath);
  const startMarker="    /* ----- Main city: deduplicated HUD resources and complete party roster. ----- */";
  const endMarker="    /* ----- Progressive character growth guidance. ----- */";
  const a=lazy.indexOf(startMarker), b=lazy.indexOf(endMarker,a);
  if(a<0||b<0) throw new Error("Could not isolate lazy roster renderer");
  const delegate=`    /* Main-city roster is first-screen UI and is owned by the eager V54 city runtime. */\n    function renderHomeRoster(){\n        return typeof window.v54RenderHomeRoster===\"function\"?window.v54RenderHomeRoster():undefined;\n    }\n\n`;
  lazy=lazy.slice(0,a)+delegate+lazy.slice(b);
  write(lazyJsPath,lazy);

  const eagerJsPath="js/16-stage-v54-main-city-runtime.js";
  let eager=read(eagerJsPath);
  if(eager.includes("v54RenderHomeRoster")) throw new Error("Eager roster owner already installed unexpectedly");
  const addition=`\n    function rosterNumber(value){\n        const number=Number(value);\n        return Number.isFinite(number)?number:0;\n    }\n    function rosterEscape(value){\n        return String(value==null?\"\":value)\n            .replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\")\n            .replace(/\\\"/g,\"&quot;\").replace(/'/g,\"&#039;\");\n    }\n    function rosterResourceText(value){\n        const whole=Math.max(0,Math.floor(rosterNumber(value)));\n        if(whole>=100000000){\n            const compact=whole/100000000;\n            return compact.toFixed(compact>=10?1:2).replace(/\\.?0+$/g,\"\")+\"億\";\n        }\n        if(whole>=10000){ return Math.floor(whole/10000)+\"萬\"; }\n        return whole.toLocaleString(\"zh-TW\");\n    }\n    function syncRosterResource(node,value){\n        if(!node){ return; }\n        const whole=Math.max(0,Math.floor(rosterNumber(value)));\n        const full=whole.toLocaleString(\"zh-TW\");\n        node.textContent=rosterResourceText(whole);\n        node.title=full; node.setAttribute(\"aria-label\",full);\n    }\n    function renderHomeRoster(){\n        const page=document.getElementById(\"homePage\");\n        const grid=page&&page.querySelector(\".home-card-grid\");\n        if(!page||!grid||typeof getExistingPartyIndexes!==\"function\"){ return false; }\n        const partyIndexes=getExistingPartyIndexes().slice(0,3);\n        const availableExp=typeof window.v173GetAvailableExpPool===\"function\"\n            ?window.v173GetAvailableExpPool(Date.now())\n            :(typeof sharedExp!==\"undefined\"?sharedExp:0);\n        syncRosterResource(document.getElementById(\"homeHudGoldValue\"),typeof gold!==\"undefined\"?gold:0);\n        syncRosterResource(document.getElementById(\"homeHudExpValue\"),availableExp);\n        let roster=document.getElementById(\"v146HomeRoster\");\n        if(!roster){\n            roster=document.createElement(\"section\");\n            roster.id=\"v146HomeRoster\"; roster.className=\"v146-home-roster\";\n            roster.setAttribute(\"aria-label\",\"冒險隊伍\");\n            grid.insertAdjacentElement(\"afterend\",roster);\n        }\n        const cards=partyIndexes.map(index=>{\n            const character=typeof getPartyCharacterByIndex===\"function\"?getPartyCharacterByIndex(index):null;\n            const stats=typeof getPartyBattleStats===\"function\"?getPartyBattleStats(index):null;\n            if(!character||!stats){ return \"\"; }\n            const hp=Math.max(0,Math.min(rosterNumber(stats.maxHP),rosterNumber(character.hp)));\n            const sp=Math.max(0,Math.min(rosterNumber(stats.maxSP),rosterNumber(character.sp)));\n            const hpPercent=rosterNumber(stats.maxHP)>0?hp/rosterNumber(stats.maxHP)*100:0;\n            const spPercent=rosterNumber(stats.maxSP)>0?sp/rosterNumber(stats.maxSP)*100:0;\n            const artwork=typeof getCharacterArtworkPath===\"function\"?getCharacterArtworkPath(character):\"\";\n            return '<article class=\"v146-home-character\" data-element=\"'+rosterEscape(character.element||\"fire\")+'\">'+\n                '<div class=\"v146-home-avatar\"><img src=\"'+rosterEscape(artwork)+'\" alt=\"'+rosterEscape(character.id||\"角色\")+'頭像\"></div>'+\n                '<div class=\"v146-home-character-main\"><div><b>'+rosterEscape(character.id||(\"角色\"+(index+1)))+'</b><span>Lv.'+Math.max(1,Math.floor(rosterNumber(character.level)||1))+'</span></div>'+\n                '<div class=\"v146-home-resource hp\"><i style=\"width:'+hpPercent+'%\"></i><strong>HP '+Math.floor(hp)+' / '+Math.floor(rosterNumber(stats.maxHP))+'</strong></div>'+\n                '<div class=\"v146-home-resource sp\"><i style=\"width:'+spPercent+'%\"></i><strong>SP '+Math.floor(sp)+' / '+Math.floor(rosterNumber(stats.maxSP))+'</strong></div></div></article>';\n        }).join(\"\");\n        roster.innerHTML='<header><b>冒險隊伍</b><span>隊伍 '+partyIndexes.length+' / 3</span></header>'+cards;\n        roster.dataset.ready=\"true\";\n        return true;\n    }\n    window.v54RenderHomeRoster=renderHomeRoster;\n    document.addEventListener(\"four-symbols:startup-ready\",renderHomeRoster);\n`;
  const eagerAnchor="    function boot(){";
  eager=replaceOnce(eager,eagerAnchor,addition+"\n"+eagerAnchor,"eager main-city roster owner");
  write(eagerJsPath,eager);

  const lazyCssPath="css/42-v146-system-polish.css";
  let lazyCss=read(lazyCssPath);
  const cssStart=lazyCss.indexOf("/* Home party HUD:");
  const cssEnd=lazyCss.indexOf("#game-stage .shop-potion-purchase-row",cssStart);
  if(cssStart<0||cssEnd<0) throw new Error("Could not isolate roster CSS");
  const rosterCss=lazyCss.slice(cssStart,cssEnd).trim();
  lazyCss=lazyCss.slice(0,cssStart)+lazyCss.slice(cssEnd);
  write(lazyCssPath,lazyCss);
  const eagerCssPath="css/19-stage-v54-main-city-moderate-native-scale.css";
  let eagerCss=read(eagerCssPath);
  eagerCss += `\n\n/* Main-city party HUD is first-screen UI; keep its visual owner in app-shell. */\n${rosterCss}\n`;
  write(eagerCssPath,eagerCss);

  const startupPath="js/52-v173.20-startup-loader.js";
  let startup=read(startupPath);
  startup=replaceOnce(startup,
`        if(!loaded){ throw new Error("Resolved account save could not hydrate gameplay state."); }
        transition(offline?STATES.OFFLINE_READY:STATES.READY,{uid:resolvedUid});`,
`        if(!loaded){ throw new Error("Resolved account save could not hydrate gameplay state."); }
        if(typeof global.v54RenderHomeRoster==="function"){ global.v54RenderHomeRoster(); }
        await nextPaint();
        transition(offline?STATES.OFFLINE_READY:STATES.READY,{uid:resolvedUid});`,"roster rendered before destination reveal");
  write(startupPath,startup);
}

// 5. Skill detail must own a true upper overlay and use a contained icon instead of a repeated banner.
{
  const basePath="css/00-main.css";
  let base=read(basePath);
  base=replaceOnce(base,"#skillDetailModal{\n    z-index:6060;\n}","#skillDetailModal{\n    z-index:13000;\n}","skill detail z-index");
  write(basePath,base);

  const nativePath="css/09-stage-v15-native-character-shell.css";
  let native=read(nativePath);
  if(!native.includes("native-v18-skill-detail-layer.v17365-detail-front")){
    native += `\n\n/* Skill detail is a child dialog of the skill page and must paint above its V17 home-feature owner. */\n#game-stage > #game-overlay-layer .native-v18-skill-detail-layer{z-index:13000!important;}\n#game-stage > #game-overlay-layer .native-v18-status-help-layer{z-index:13010!important;}\n`;
  }
  write(nativePath,native);

  const detailPath="css/23-stage-v77-inventory-detail-ui.css";
  let detail=read(detailPath);
  detail += `\n\n/* Skill detail icon is an icon, not a full-width repeating banner. */\n#game-stage #skillDetailModal #skillDetailIcon{\n    width:88px!important;height:88px!important;min-height:88px!important;\n    align-self:center!important;margin:0 auto 8px!important;overflow:hidden!important;\n    border-radius:12px!important;background-position:center!important;\n    background-size:contain!important;background-repeat:no-repeat!important;\n    background-color:rgba(9,8,6,.88)!important;\n}\n#game-stage #skillDetailModal #skillDetailIcon img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;}\n`;
  write(detailPath,detail);
}

// 6. Resume label uses the real provider/email; switch account stays on the account page without a splash reload.
{
  const uiPath="js/firebase/firebase-auth-ui.js";
  let ui=read(uiPath);
  const providerStart=ui.indexOf("function providerLabel(user){");
  const providerEnd=ui.indexOf("\nfunction markup(){",providerStart);
  if(providerStart<0||providerEnd<0) throw new Error("Could not isolate providerLabel");
  const provider=`function resumeLoginText(user){\n    if(!user){ return \"正在登入帳號\"; }\n    if(user.isAnonymous){ return \"使用訪客帳號登入中\"; }\n    const ids=Array.isArray(user.providerIds)?user.providerIds:[];\n    if(ids.includes(\"google.com\")){ return \"使用 Google 登入中\"; }\n    if(ids.includes(\"facebook.com\")){ return \"使用 Facebook 登入中\"; }\n    if(ids.includes(\"password\")){ return user.email?\"使用 \"+user.email+\" 信箱登入中\":\"使用 Email 登入中\"; }\n    if(user.email){ return \"使用 \"+user.email+\" 信箱登入中\"; }\n    return \"正在登入帳號\";\n}\n`;
  ui=ui.slice(0,providerStart)+provider+ui.slice(providerEnd+1);
  ui=replaceOnce(ui,'if(provider){ provider.textContent="使用 "+providerLabel(state.user)+" 登入"; }','if(provider){ provider.textContent=resumeLoginText(state.user); }',"resume provider text");
  ui=replaceOnce(ui,'<strong id="firebaseAuthResumeProvider">使用帳號登入</strong>','<strong id="firebaseAuthResumeProvider">正在登入帳號</strong>',"resume initial label");
  const switchBlock=`    byId("firebaseSwitchAccountButton").addEventListener("click",()=>{\n        clearResumeTimer(); resumeActive=false; render();\n        void perform("正在切換帳號…",signOutFirebase);\n    });`;
  const switchNew=`    byId("firebaseSwitchAccountButton").addEventListener("click",()=>{\n        if(busy){ return; }\n        const previousState={...state};\n        clearResumeTimer(); resumeActive=false; resumeGraceUsed=true; interactiveAuthThisPage=true;\n        state={...state,user:null,mode:\"AUTH_REQUIRED\",message:\"請選擇登入或綁定的帳號。\",error:false};\n        render(); setBusy(true);\n        void signOutFirebase().catch(error=>{\n            console.error(\"Firebase account switch failed:\",error);\n            state={...previousState,message:errorText(error),error:true};\n        }).finally(()=>{ setBusy(false); render(); });\n    });`;
  ui=replaceOnce(ui,switchBlock,switchNew,"soft account switch UI");
  write(uiPath,ui);

  const startupPath="js/52-v173.20-startup-loader.js";
  let startup=read(startupPath);
  const onAuthOld=`        if(!user){\n            if(activeUser){\n                global.FourSymbolsAccountSave.deactivate();\n                global.location.reload(); return;\n            }\n            if(state===STATES.AUTH_RESOLVING){ requireAuth(); }\n            return;\n        }\n        if(activeUser&&activeUser.uid!==user.uid){ global.FourSymbolsAccountSave.deactivate(); global.location.reload(); return; }\n        if(state===STATES.AUTH_RESOLVING||state===STATES.AUTH_REQUIRED){ void resolveSaveFor(user); }`;
  const onAuthNew=`        if(!user){\n            if(activeUser){\n                ++transitionToken;\n                activeUser=null; resolvedUid=null; saveResolved=false; cloudResult=null; lastError=null;\n                if(global.FourSymbolsGameSave){ global.FourSymbolsGameSave.deactivate(); }else{ global.FourSymbolsAccountSave.deactivate(); }\n                if(state!==STATES.AUTH_REQUIRED){ transition(STATES.AUTH_REQUIRED,{reason:\"account-switch\"}); }\n                status(\"帳號服務已就緒\",\"請選擇登入或綁定的帳號\");\n                accountUi(\"AUTH_REQUIRED\",\"請選擇登入、建立帳號或使用訪客開始遊戲。\");\n                return;\n            }\n            if(state===STATES.AUTH_RESOLVING){ requireAuth(); }\n            return;\n        }\n        if(activeUser&&activeUser.uid!==user.uid){\n            ++transitionToken;\n            if(global.FourSymbolsGameSave){ global.FourSymbolsGameSave.deactivate(); }else{ global.FourSymbolsAccountSave.deactivate(); }\n            activeUser=null; resolvedUid=null; saveResolved=false; cloudResult=null; lastError=null;\n            if(state!==STATES.AUTH_REQUIRED){ transition(STATES.AUTH_REQUIRED,{reason:\"account-switch\"}); }\n            void resolveSaveFor(user); return;\n        }\n        if(state===STATES.AUTH_RESOLVING||state===STATES.AUTH_REQUIRED){ void resolveSaveFor(user); }`;
  startup=replaceOnce(startup,onAuthOld,onAuthNew,"soft account switch lifecycle");
  write(startupPath,startup);
}

// 7. Relic detail owns the header return slot; the shared close button must not overlap it.
{
  const jsPath="js/60-team-relic-system.js";
  let js=read(jsPath);
  js=replaceOnce(js,
`const nodes=prepareRelicModal(); if(!nodes){ return false; } nodes.body.innerHTML=renderRelicList();`,
`const nodes=prepareRelicModal(); if(!nodes){ return false; } nodes.modal.classList.remove("team-relic-detail-mode"); nodes.body.innerHTML=renderRelicList();`,"relic list mode class");
  js=replaceOnce(js,
`const nodes=prepareRelicModal(); if(!nodes){return false;} nodes.body.innerHTML=detailMarkup(def);`,
`const nodes=prepareRelicModal(); if(!nodes){return false;} nodes.modal.classList.add("team-relic-detail-mode"); nodes.body.innerHTML=detailMarkup(def);`,"relic detail mode class");
  write(jsPath,js);

  const cssPath="css/55-team-relic-system.css";
  let css=read(cssPath);
  css=replaceOnce(css,
`#game-stage #homeFeatureModal.team-relic-modal .home-feature-close-btn:not(#statusHelpButton):not(#skillPreviewHeaderButton){display:inline-flex!important;}`,
`#game-stage #homeFeatureModal.team-relic-modal:not(.team-relic-detail-mode) .home-feature-close-btn:not(#statusHelpButton):not(#skillPreviewHeaderButton){display:inline-flex!important;}`,
"relic shared close only in list mode");
  css=replaceOnce(css,
`#game-stage #homeFeatureModal.team-relic-modal:has(.team-relic-detail) .home-feature-close-btn{display:none!important;}`,
`#game-stage #homeFeatureModal.team-relic-modal.team-relic-detail-mode .home-feature-close-btn{display:none!important;}`,
"relic explicit detail mode");
  write(cssPath,css);
}

// 8. System account management wording.
{
  const path="js/00-main.js";
  let s=read(path);
  s=replaceOnce(s,
`<button class=\"home-feature-buy-btn\" onclick=\"window.FourSymbolsStartupPolicy&&window.FourSymbolsStartupPolicy.openAccountManager()\">開啟帳號</button>`,
`<button class=\"home-feature-buy-btn\" onclick=\"window.FourSymbolsStartupPolicy&&window.FourSymbolsStartupPolicy.openAccountManager()\">切換帳號／綁定帳號</button>`,
"system account button wording");
  write(path,s);
}

// Update existing regression expectations that intentionally changed in this request.
{
  const path="tests/v174-cardless-battle-browser.test.js";
  let s=read(path);
  s=s.replace('assert.equal(data.playerArtBackgroundSize,"150% auto");','assert.equal(data.playerArtBackgroundSize,"contain");');
  s=s.replace('enemySp:enemy.querySelector(\'.monster-sp .monster-bar-text\').textContent','enemySp:enemy.querySelector(\'.monster-sp .monster-bar-text\').textContent,\n      enemyHpRect:qaRect(\'#battleMonster0 > .monster-hp\'),\n      enemySpRect:qaRect(\'#battleMonster0 > .monster-sp\'),\n      enemyHpDisplay:getComputedStyle(enemy.querySelector(\'.monster-hp\')).display');
  s=s.replace('assert.equal(data.enemySp,"630");','assert.equal(data.enemySp,"630");\n    assert.equal(data.enemyHpDisplay,"block");\n    assert.ok(data.enemyHpRect.height>0&&data.enemySpRect.height>0,"enemy HP/SP bars must remain visible");\n    assert.ok(data.enemyHpRect.bottom<=data.enemySpRect.top+1,"enemy HP must sit above SP");');
  write(path,s);
}

for(const path of [
  "tests/boss-mechanism-vfx-card-ui-20260909.test.js",
  "tests/gameplay-ui-regressions-20260908.test.js",
  "tests/boss-mobile-portrait-browser.test.js"
]){
  if(!fs.existsSync(path)) continue;
  let s=read(path);
  write(path,s);
}

// Main-city tests now read roster behavior/style from its eager owners.
for(const path of ["tests/v173.28-main-city-lobby.test.js","tests/ui-typography-standard.test.js"]){
  if(!fs.existsSync(path)) continue;
  let s=read(path);
  if(path.includes("v173.28")){
    s=s.replace('const rosterRuntime=fs.readFileSync("js/41-v146-system-polish.js","utf8");','const rosterRuntime=fs.readFileSync("js/16-stage-v54-main-city-runtime.js","utf8");');
    s=s.replace('const rosterCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");','const rosterCss=fs.readFileSync("css/19-stage-v54-main-city-moderate-native-scale.css","utf8");');
  }else{
    s=s.replace('const homePolish=fs.readFileSync("css/42-v146-system-polish.css","utf8");','const homePolish=fs.readFileSync("css/19-stage-v54-main-city-moderate-native-scale.css","utf8");');
  }
  write(path,s);
}

// New focused regression contract for the eight reported issues.
write("tests/v173.65-ui-battle-auth-polish.test.js",`"use strict";\nconst assert=require("node:assert/strict");\nconst fs=require("node:fs");\nconst read=p=>fs.readFileSync(p,"utf8");\n\nconst boss=read("css/gameplay-boss-tower.css");\nassert.match(boss,/gameplay-boss-card[\\s\\S]*?battle-monster-icon[\\s\\S]*?background-size:contain;/);\nassert.match(boss,/boss-mechanism-card\\{[\\s\\S]*?aspect-ratio:4 \\/ 3;/);\n\nconst battle=read("js/54-v173.51-battle-qa.js");\nassert.match(battle,/battle-player\\.v174-cardless-unit>\\.v174-battle-art\\{[\\s\\S]*?background-size:contain!important/);\nassert.match(battle,/battle-monster\\.v174-cardless-unit>\\.monster-hp\\{[\\s\\S]*?bottom:13px!important;[\\s\\S]*?display:block!important/);\nassert.match(battle,/battle-monster\\.v174-cardless-unit>\\.monster-sp\\{[\\s\\S]*?bottom:0!important;[\\s\\S]*?display:block!important/);\n\nconst city=read("js/16-stage-v54-main-city-runtime.js");\nconst cityCss=read("css/19-stage-v54-main-city-moderate-native-scale.css");\nconst lazyCity=read("js/41-v146-system-polish.js");\nassert.match(city,/window\\.v54RenderHomeRoster=renderHomeRoster/);\nassert.match(city,/v146-home-roster/);\nassert.match(cityCss,/\\.v146-home-roster\\{/);\nassert.doesNotMatch(lazyCity,/function renderHomeRoster\\(\\)\\{[\\s\\S]{0,300}document\\.createElement\\(\"section\"\\)/);\n\nconst base=read("css/00-main.css"),native=read("css/09-stage-v15-native-character-shell.css"),detail=read("css/23-stage-v77-inventory-detail-ui.css");\nassert.match(base,/#skillDetailModal\\{\\s*z-index:13000;/);\nassert.match(native,/native-v18-skill-detail-layer\\{z-index:13000!important;/);\nassert.match(detail,/#skillDetailModal #skillDetailIcon\\{[\\s\\S]*?width:88px!important;[\\s\\S]*?background-size:contain!important;[\\s\\S]*?background-repeat:no-repeat!important;/);\n\nconst auth=read("js/firebase/firebase-auth-ui.js"),startup=read("js/52-v173.20-startup-loader.js");\nassert.match(auth,/Array\\.isArray\\(user\\.providerIds\\)/);\nassert.match(auth,/使用 Google 登入中/);\nassert.match(auth,/使用 \\"\\+user\\.email\\+\\" 信箱登入中/);\nassert.doesNotMatch(startup,/activeUser\\)\\{[\\s\\S]{0,180}location\\.reload\\(\\)/);\nassert.match(startup,/reason:\"account-switch\"/);\nassert.match(startup,/v54RenderHomeRoster/);\n\nconst relicJs=read("js/60-team-relic-system.js"),relicCss=read("css/55-team-relic-system.css");\nassert.match(relicJs,/classList\\.add\\(\"team-relic-detail-mode\"\\)/);\nassert.match(relicJs,/classList\\.remove\\(\"team-relic-detail-mode\"\\)/);\nassert.match(relicCss,/team-relic-modal\\.team-relic-detail-mode \\.home-feature-close-btn\\{display:none!important;/);\n\nconst main=read("js/00-main.js");\nassert.match(main,/帳號管理[\\s\\S]{0,360}切換帳號／綁定帳號/);\nconsole.log("V173.65 UI/battle/auth polish regression checks passed");\n`);

console.log("Applied V173.65 UI/battle/auth polish source patch.");
