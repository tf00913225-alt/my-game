import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function write(path,content){ fs.writeFileSync(path,content); }
function replaceExact(path,before,after,label){
  const source=read(path);
  const count=source.split(before).length-1;
  if(count!==1){ throw new Error(`${label}: expected 1 exact match in ${path}, got ${count}`); }
  write(path,source.replace(before,after));
}
function replaceRegex(path,pattern,replacement,label){
  const source=read(path);
  const matches=source.match(pattern);
  if(!matches){ throw new Error(`${label}: pattern not found in ${path}`); }
  write(path,source.replace(pattern,replacement));
}
function appendOnce(path,marker,content){
  const source=read(path);
  if(source.includes(marker)){ return; }
  write(path,source.trimEnd()+"\n\n"+content.trim()+"\n");
}

// 1) Character creation: the element description card is the scroll owner.
replaceExact(
  "js/01-stage-v8-touch-lock.js",
  '            ".content, .content-scrollable, .creation-page-scroll, .inventory-grid-scroll, .quest-tab-body, .battle-item-list, " +',
  '            ".content, .content-scrollable, .creation-page-scroll, .creation-role-card, .inventory-grid-scroll, .quest-tab-body, .battle-item-list, " +',
  "creation role-card touch whitelist"
);

appendOnce("css/56-v174-critical-ui-regressions.css","V174.1 mobile regression follow-up",String.raw`
/* V174.1 mobile regression follow-up — scoped to the five reported regressions. */

/* Main-city roster: preserve the three equal slots, but return enough horizontal
   room to the HP/SP labels and reduce the two bars instead of letting them bleed. */
#game-stage #homePage #v146HomeRoster .v146-home-character{
    grid-template-columns:32px minmax(0,1fr) !important;
    gap:3px !important;
    min-height:70px !important;
    padding:3px 2px !important;
}
#game-stage #homePage #v146HomeRoster .v146-home-avatar{
    width:32px !important;
    height:32px !important;
}
#game-stage #homePage #v146HomeRoster .v146-home-character-main{
    gap:2px !important;
}
#game-stage #homePage #v146HomeRoster .v146-home-resource{
    height:14px !important;
}
#game-stage #homePage #v146HomeRoster .v146-home-resource strong{
    font-size:11px !important;
    line-height:12px !important;
    letter-spacing:-.45px !important;
}

/* Character creation keeps the portrait fixed while the element explanation
   alone becomes a native vertical scroller.  The global touch owner explicitly
   whitelists .creation-role-card; no page-local touch listener is introduced. */
#creationPage .creation-choice-panel{
    min-height:0 !important;
    overflow:hidden !important;
}
#creationPage .creation-role-card{
    flex:1 1 auto !important;
    min-height:0 !important;
    max-height:100% !important;
    overflow-x:hidden !important;
    overflow-y:auto !important;
    touch-action:pan-y !important;
    -webkit-overflow-scrolling:touch !important;
    overscroll-behavior-y:contain !important;
    scrollbar-gutter:stable !important;
}

/* Skill rows keep only the short summary/action state.  Long progression data
   lives in the existing skill detail modal, so the right action column cannot
   consume or escape the description column. */
#game-stage #allSkillsList .skill-row{
    grid-template-columns:minmax(42px,auto) minmax(0,1fr) minmax(84px,104px) !important;
    min-width:0 !important;
    max-width:100% !important;
    overflow:hidden !important;
}
#game-stage #allSkillsList .skill-row .skill-row-text{
    min-width:0 !important;
    max-width:100% !important;
    overflow:hidden !important;
}
#game-stage #allSkillsList .skill-row .skill-action-card{
    width:104px !important;
    min-width:84px !important;
    max-width:104px !important;
    overflow:hidden !important;
}
`);

// 2) Gameplay Boss + mechanism card: paired 4:3 geometry, no transform sizing.
replaceExact(
  "css/gameplay-boss-tower.css",
`#game-stage #battleMonsterArea.gameplay-boss-active{
    margin-top:-32px;
    max-width:100%;
    overflow:visible;
}`,
`#game-stage #battleMonsterArea.gameplay-boss-active{
    --gameplay-boss-card-width:clamp(148px,36.5%,160px);
    --gameplay-mechanism-card-width:clamp(78px,19%,90px);
    margin-top:-16px;
    max-width:100%;
    overflow:visible;
}`,
  "boss shared card sizing owner"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    --v143-monster-card-width:clamp(154px,38.1%,166px);
    --v143-monster-card-height:auto;
    --v143-monster-icon-width:calc(100% - 12px);
    --v143-monster-icon-height:auto;
    --v143-monster-bar-width:calc(100% - 10px);
    aspect-ratio:9 / 16;
    box-sizing:border-box;
    align-self:start;`,
`    --v143-monster-card-width:var(--gameplay-boss-card-width);
    --v143-monster-card-height:auto;
    --v143-monster-icon-width:calc(100% - 12px);
    --v143-monster-icon-height:auto;
    --v143-monster-bar-width:calc(100% - 10px);
    aspect-ratio:4 / 3;
    box-sizing:border-box;
    align-self:start;
    overflow:hidden;`,
  "boss 4:3 card"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`#game-stage #battlePage .battle-monster.gameplay-boss-card .battle-monster-icon{
    aspect-ratio:3 / 4;
    overflow:hidden;`,
`#game-stage #battlePage .battle-monster.gameplay-boss-card .battle-monster-icon{
    aspect-ratio:3 / 1;
    overflow:hidden;`,
  "boss landscape crop"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    width:clamp(82px,20%,96px);
    min-width:82px;
    min-height:0;
    aspect-ratio:9 / 16;
    box-sizing:border-box;
    flex:0 0 clamp(82px,20%,96px);
    flex-direction:column;
    align-items:center;
    justify-content:flex-start;
    gap:5px;
    padding:8px 6px 7px;`,
`    width:var(--gameplay-mechanism-card-width);
    min-width:0;
    min-height:0;
    aspect-ratio:4 / 3;
    box-sizing:border-box;
    flex:0 0 var(--gameplay-mechanism-card-width);
    flex-direction:column;
    align-items:center;
    justify-content:flex-start;
    gap:2px;
    padding:3px 4px;`,
  "mechanism 4:3 card"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    padding:2px 6px;
    border:1px solid color-mix(in srgb,var(--mechanism-color) 62%,transparent);
    border-radius:999px;
    color:var(--mechanism-color);
    background:rgba(6,5,4,.62);
    font-family:"Noto Serif TC",serif;
    font-size:13px;
    font-weight:900;
    line-height:1.25;`,
`    padding:1px 5px;
    border:1px solid color-mix(in srgb,var(--mechanism-color) 62%,transparent);
    border-radius:999px;
    color:var(--mechanism-color);
    background:rgba(6,5,4,.62);
    font-family:"Noto Serif TC",serif;
    font-size:11px;
    font-weight:900;
    line-height:1.15;`,
  "mechanism kind compact"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    display:-webkit-box;
    max-width:100%;
    min-height:32px;
    overflow:hidden;
    color:#fff0c4;
    font-family:"Noto Serif TC",serif;
    font-size:14px;
    font-weight:900;
    line-height:1.25;`,
`    display:-webkit-box;
    max-width:100%;
    min-height:14px;
    overflow:hidden;
    color:#fff0c4;
    font-family:"Noto Serif TC",serif;
    font-size:12px;
    font-weight:900;
    line-height:14px;`,
  "mechanism name compact"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    -webkit-box-orient:vertical;
    -webkit-line-clamp:2;
}`,
`    -webkit-box-orient:vertical;
    -webkit-line-clamp:1;
}`,
  "mechanism name single line"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    min-height:20px;
    box-sizing:border-box;
    align-items:center;
    justify-content:center;
    padding:2px 3px;`,
`    min-height:14px;
    box-sizing:border-box;
    align-items:center;
    justify-content:center;
    padding:1px 2px;`,
  "mechanism hp compact"
);
replaceExact(
  "css/gameplay-boss-tower.css",
`    font-size:11px;
    font-weight:900;
    line-height:1.2;`,
`    font-size:10px;
    font-weight:900;
    line-height:1.1;`,
  "mechanism hp font"
);
replaceRegex(
  "css/gameplay-boss-tower.css",
  /#game-stage #battleMonsterArea \.boss-mechanism-card::after\{[\s\S]*?\n\}/,
`#game-stage #battleMonsterArea .boss-mechanism-card::after{
    display:none;
}`,
  "mechanism summary moves to detail panel"
);
appendOnce("css/gameplay-boss-tower.css","paired compact-height shrink",String.raw`
/* If the physical viewport is short, both battlefield cards shrink together.
   Never solve a collision by changing only one member of the pair. */
@media (max-height:840px){
    #game-stage #battleMonsterArea.gameplay-boss-active{
        --gameplay-boss-card-width:clamp(138px,34%,150px);
        --gameplay-mechanism-card-width:clamp(72px,18%,84px);
    }
}
`);

// 3) Skill summary: remove verbose duplicated progression text; details already
// render the complete requirements/costs through renderSkillDetailProgression().
replaceRegex(
  "js/60-v173.64-skill-progression-rebalance.js",
  /    function addProgressionHint\([\s\S]*?\n    }\n    function decorateSkillProgressionUi\(\)\{/,
  "    function decorateSkillProgressionUi(){",
  "remove verbose skill-row progression hint owner"
);
replaceExact(
  "js/60-v173.64-skill-progression-rebalance.js",
  "            addProgressionHint(row,skill,context,current);\n",
  "",
  "remove progression hint call"
);

// 4) EXP distribution: restore an explicit guard before the authoritative
// catch-up wrapper mutates EXP, levels, save data or UI.
const expBefore=`        window.v131ConfirmExpPreview=function(){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
            const counts=readPreviewCounts();
            const discounted=totalDiscountedPreviewCost(counts);
            const actual=Math.max(0,Number(sharedExp)||0);
            if(discounted<=0||discounted>actual){
                if(discounted>actual){ alert("經驗池不足，無法完成本次分配。"); }
                return false;
            }
            let completed=false;
            sharedExp=Number.MAX_SAFE_INTEGER/32;
            try{
                const result=previousConfirm.apply(this,arguments);
                completed=true;
                return result;
            }finally{
                sharedExp=completed?Math.max(0,actual-discounted):actual;
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                v173ScheduleExpPoolDecoration(viewport);
            }
        };`;
const expAfter=`        window.v131ConfirmExpPreview=async function(){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
            const counts=readPreviewCounts();
            const discounted=totalDiscountedPreviewCost(counts);
            const actual=Math.max(0,Number(sharedExp)||0);
            if(discounted<=0||discounted>actual){
                if(discounted>actual){ alert("經驗池不足，無法完成本次分配。"); }
                return false;
            }
            const levelCount=Object.values(counts).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
            const confirmMessage="確定要消耗 "+discounted.toLocaleString("zh-TW")+" EXP，完成 "+levelCount+" 次升級嗎？";
            let approved=true;
            if(typeof window.rpgConfirm==="function"){
                approved=await window.rpgConfirm(confirmMessage,{
                    title:"確認經驗池升級",
                    confirmText:"確定升級",
                    cancelText:"返回"
                });
            }else if(typeof window.confirm==="function"){
                approved=window.confirm(confirmMessage);
            }
            if(!approved){
                v173ScheduleExpPoolDecoration(viewport);
                return false;
            }
            let completed=false;
            sharedExp=Number.MAX_SAFE_INTEGER/32;
            try{
                const result=previousConfirm.apply(this,arguments);
                completed=true;
                return result;
            }finally{
                sharedExp=completed?Math.max(0,actual-discounted):actual;
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                v173ScheduleExpPoolDecoration(viewport);
            }
        };`;
replaceExact("js/28-v133-economy-rebalance.js",expBefore,expAfter,"EXP confirmation guard");

// 5) Additional-character reminder: prefer the current interactive slot cards
// instead of assuming the slot row is homeFeatureModalBody.firstElementChild.
replaceExact(
  "js/25-v131-fix-batch.js",
`        const title=document.getElementById("homeFeatureModalTitle");
        if(title && title.textContent!=="角色"){ return; }
        const row=body.firstElementChild;
        if(!row || !row.children){ return; }

        [1,2].forEach(slotIndex=>{
            const card=row.children[slotIndex];
            if(!card){ return; }`,
`        const title=document.getElementById("homeFeatureModalTitle");
        if(title && String(title.textContent||"").trim()!=="角色"){ return; }
        const legacyRow=body.firstElementChild;
        const cardsBySlot=new Map();
        Array.from(body.querySelectorAll('[onclick*="openCharacterCreation"]')).forEach(card=>{
            const match=String(card.getAttribute("onclick")||"").match(/openCharacterCreation\\(\\s*(2|3)\\s*\\)/);
            if(match){ cardsBySlot.set(Number(match[1]),card); }
        });

        [1,2].forEach(slotIndex=>{
            const slotNumber=slotIndex+1;
            const card=cardsBySlot.get(slotNumber) || (legacyRow&&legacyRow.children?legacyRow.children[slotIndex]:null);
            if(!card){ return; }`,
  "character slot resolver"
);
replaceExact(
  "js/25-v131-fix-batch.js",
  "            const slotNumber=slotIndex+1;\n            card.style.opacity=\"1\";",
  "            card.style.opacity=\"1\";",
  "dedupe slot number"
);
replaceExact(
  "css/31-v131-fix-batch.css",
`    right:2px;
    top:-3px;
    width:10px;
    height:10px;`,
`    right:4px;
    top:4px;
    z-index:8;
    width:10px;
    height:10px;`,
  "unlock red dot kept inside card"
);

// Browser/regression contracts.
replaceExact(
  "tests/boss-mobile-portrait-browser.test.js",
  "    const ratio=16/9;",
  "    const ratio=3/4;",
  "boss test ratio"
);
let bossTest=read("tests/boss-mobile-portrait-browser.test.js");
bossTest=bossTest
  .replace(/outside 38%-46%/g,"outside 33%-46%")
  .replace(/>=\.38&&data\.bossBattleWidthShare<=\.46/g,">=.33&&data.bossBattleWidthShare<=.46")
  .replace(/outside 20%-26%/g,"outside 18%-26%")
  .replace(/>=\.20&&data\.mechanismBattleWidthShare<=\.26/g,">=.18&&data.mechanismBattleWidthShare<=.26")
  .replace(/Boss is not 9:16/g,"Boss is not 4:3")
  .replace(/Mechanism card is not 9:16/g,"Mechanism card is not 4:3")
  .replace('assert.equal(data.bossComputed.aspectRatio,"9 / 16");','assert.equal(data.bossComputed.aspectRatio,"4 / 3");')
  .replace('assert.equal(data.mechanismComputed.aspectRatio,"9 / 16");','assert.equal(data.mechanismComputed.aspectRatio,"4 / 3");');
write("tests/boss-mobile-portrait-browser.test.js",bossTest);

replaceExact(
  ".github/scripts/run-skill-progression-browser-qa.mjs",
`    forbidden:["learnLevel","requires","tier","upgradeCost"].filter(function(word){return pageText.includes(word);}),
    rowCount:rows.length,`,
`    forbidden:["learnLevel","requires","tier","upgradeCost"].filter(function(word){return pageText.includes(word);}),
    progressionHints:document.querySelectorAll("#allSkillsList .v17364-progression-hint").length,
    rowCount:rows.length,`,
  "skill browser hint count"
);
replaceExact(
  ".github/scripts/run-skill-progression-browser-qa.mjs",
`    assert.deepEqual(data.forbidden,[]);
    assert.ok(data.rowCount>=8,"Water skill list is unexpectedly short");`,
`    assert.deepEqual(data.forbidden,[]);
    assert.equal(data.progressionHints,0,"Verbose progression text must live in skill details, not summary rows");
    assert.ok(data.rowCount>=8,"Water skill list is unexpectedly short");`,
  "skill browser hint assertion"
);

const staticTest=`"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const css=read("css/56-v174-critical-ui-regressions.css");
const touch=read("js/01-stage-v8-touch-lock.js");
const boss=read("css/gameplay-boss-tower.css");
const skill=read("js/60-v173.64-skill-progression-rebalance.js");
const exp=read("js/28-v133-economy-rebalance.js");
const slots=read("js/25-v131-fix-batch.js");
const slotCss=read("css/31-v131-fix-batch.css");
assert.match(css,/#creationPage \\.creation-role-card\\{[\\s\\S]*overflow-y:auto !important;[\\s\\S]*touch-action:pan-y !important;/);
assert.match(touch,/\\.creation-page-scroll, \\.creation-role-card, \\.inventory-grid-scroll/);
assert.match(css,/#v146HomeRoster \\.v146-home-resource\\{[\\s\\S]*height:14px !important;/);
assert.match(css,/#v146HomeRoster \\.v146-home-resource strong\\{[\\s\\S]*font-size:11px !important;/);
assert.match(boss,/gameplay-boss-card\\[data-rank="boss"\\]\\{[\\s\\S]*aspect-ratio:4 \\/ 3;/);
assert.match(boss,/\\.boss-mechanism-card\\{[\\s\\S]*aspect-ratio:4 \\/ 3;/);
assert.match(boss,/max-height:840px[\\s\\S]*--gameplay-boss-card-width[\\s\\S]*--gameplay-mechanism-card-width/);
assert.doesNotMatch(skill,/function addProgressionHint|addProgressionHint\\(/);
assert.match(skill,/renderSkillDetailProgression[\\s\\S]*最低學習等級[\\s\\S]*前置技能/);
assert.match(exp,/v131ConfirmExpPreview=async function/);
assert.match(exp,/await window\\.rpgConfirm\\(confirmMessage,[\\s\\S]*title:"確認經驗池升級"/);
assert.match(exp,/if\\(!approved\\)\\{[\\s\\S]*return false;[\\s\\S]*sharedExp=Number\\.MAX_SAFE_INTEGER/);
assert.match(slots,/querySelectorAll\\('\[onclick\\*="openCharacterCreation"\]'\\)/);
assert.match(slots,/cardsBySlot\\.get\\(slotNumber\\)/);
assert.match(slotCss,/\\.v131-unlock-dot\\{[\\s\\S]*right:4px;[\\s\\S]*top:4px;[\\s\\S]*z-index:8;/);
console.log("✓ V174 mobile UI + EXP guard source contracts passed");
`;
write("tests/v174-mobile-ui-exp-guards.test.js",staticTest);

const browserTest=`"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
function chrome(){ for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){ const p=spawnSync("bash",["-lc",\`command -v \${n}\`],{encoding:"utf8"}); if(p.status===0&&p.stdout.trim()) return p.stdout.trim(); } return ""; }
function decode(v){return v.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
const c=chrome(); if(!c){ if(process.env.CI) throw new Error("Chrome required"); console.log("mobile UI guards browser QA skipped"); process.exit(0); }
const fixture=path.join(process.cwd(),".v174-mobile-ui-guards-browser.html");
const filler=Array.from({length:18},(_,i)=>\`<p>元素說明第 \${i+1} 行：治療、控場與隊伍回復。</p>\`).join("");
fs.writeFileSync(fixture,\`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/42-v146-system-polish.css"><link rel="stylesheet" href="css/56-v174-critical-ui-regressions.css"><style>html,body{margin:0;width:1080px;height:1920px;background:#050505}#game-stage{width:396px;height:900px}#homePage{display:block!important;width:396px}.probe-choice{display:flex!important;flex-direction:column!important;width:480px!important;height:360px!important}.probe-role{height:auto!important}.probe-role p{margin:8px 0}</style></head><body><div id="game-stage"><div id="homePage"><div id="v146HomeRoster" class="v146-home-roster"><header>冒險隊伍</header><div class="v146-home-character"><div class="v146-home-avatar"></div><div class="v146-home-character-main"><div><b>火測試</b><span>Lv.30</span></div><div class="v146-home-resource"><i></i><strong>HP 2470 / 2470</strong></div><div class="v146-home-resource sp"><i></i><strong>SP 340 / 340</strong></div></div></div></div></div></div><div id="creationPage"><div class="creation-choice-panel probe-choice"><div style="flex:0 0 120px">性別／元素選擇</div><div class="creation-role-card probe-role">\${filler}</div></div></div><pre id="result"></pre><script>var bar=document.querySelector('.v146-home-resource'),text=bar.querySelector('strong'),role=document.querySelector('.creation-role-card');var before=role.scrollTop;role.scrollTop=role.scrollHeight;var s=getComputedStyle(role);document.getElementById('result').textContent=JSON.stringify({barHeight:getComputedStyle(bar).height,font:getComputedStyle(text).fontSize,textOverflow:text.scrollWidth>text.clientWidth+1,roleOverflow:s.overflowY,touch:s.touchAction,scrollHeight:role.scrollHeight,clientHeight:role.clientHeight,before:before,after:role.scrollTop});</script></body></html>\`,"utf8");
try{ const r=spawnSync(c,["--headless=new","--no-sandbox","--disable-gpu","--allow-file-access-from-files","--window-size=1100,1950","--dump-dom","file://"+fixture.replace(/\\\\/g,"/")],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024}); assert.equal(r.status,0,r.stderr); const m=r.stdout.match(/<pre id="result">([\\s\\S]*?)<\\/pre>/); assert.ok(m); const d=JSON.parse(decode(m[1])); assert.equal(d.barHeight,"14px"); assert.equal(d.font,"11px"); assert.equal(d.textOverflow,false,"HP/SP text still overflows the compact roster bar"); assert.match(d.roleOverflow,/auto|scroll/); assert.equal(d.touch,"pan-y"); assert.ok(d.scrollHeight>d.clientHeight&&d.after>d.before,"creation element explanation is not actually scrollable"); console.log("✓ V174 home HUD + creation scroll browser QA passed",d); } finally { try{fs.unlinkSync(fixture)}catch(_){} }
`;
write("tests/v174-mobile-ui-guards-browser.test.js",browserTest);

// Temporary preparation files must not survive the resulting work commit.
try{ fs.unlinkSync(".tmp/apply-mobile-ui-exp-guards.mjs"); }catch(_){ }
try{ fs.unlinkSync(".github/workflows/prepare-mobile-ui-exp-guards.yml"); }catch(_){ }
try{ fs.rmdirSync(".tmp"); }catch(_){ }

console.log("Applied mobile UI + EXP guard patch set.");
