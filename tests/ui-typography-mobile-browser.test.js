"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()) return result.stdout.trim();
    }
    return "";
}
const chrome=findChrome();
if(!chrome){ console.log("Typography mobile browser QA skipped: Chrome not available"); process.exit(0); }

const root=process.cwd();
const fixture=path.join(root,".ui-typography-mobile-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const css=[
    "css/00-main.css","css/22-stage-v78-character-inventory-core.css","css/23-stage-v77-inventory-detail-ui.css",
    "css/31-v131-fix-batch.css","css/32-v131-patrol-appearance.css","css/33-v132-content-expansion.css",
    "css/35-v134-fixes.css","css/37-v139-rested-experience.css","css/38-v141-system-expansion.css",
    "css/42-v146-system-polish.css","css/48-v169-element-box-settings.css","css/49-v169-rpg-ui.css",
    "css/50-v169-abyss-flow.css","css/52-v173.50-inventory-qol.css","css/53-v173.51-qa.css",
    "css/54-v174-abyss-two-tier.css","css/55-team-relic-system.css","css/gameplay-boss-tower.css"
].map(href=>`<link rel="stylesheet" href="${href}">`).join("\n");

const html=`<!doctype html><html><head><meta charset="utf-8">${css}<style>
html,body{margin:0;width:420px;min-height:900px;background:#050505;overflow-x:hidden}#game-stage{position:relative!important;left:auto!important;top:auto!important;transform:none!important;width:420px!important;height:auto!important;min-height:900px!important;overflow:visible!important}.qa{width:420px;box-sizing:border-box;padding:8px;display:grid;gap:8px}.qa-section{width:100%;box-sizing:border-box;padding:6px;border:1px solid #444;overflow:hidden}.qa-row{display:flex;gap:6px;align-items:center;min-width:0}.qa-row>*{min-width:0}.qa-wide{width:100%;box-sizing:border-box}.v132-reward-modal{position:static!important;display:block!important;background:transparent!important;padding:0!important}.v169-rpg-dialog-layer{position:static!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;padding:0!important;background:transparent!important}.v169-rpg-dialog{height:auto!important;max-height:none!important}
</style></head><body><div id="game-stage"><div class="qa">
<section id="homePage" class="qa-section"><div class="home-version-badge">V173.64</div><div class="v146-home-roster"><header>冒險隊伍<span>隊伍 3 / 3</span></header><div class="v146-home-character"><div class="v146-home-avatar"></div><div class="v146-home-character-main"><div><b>赤炎測試者</b><span>Lv.100</span></div><div class="v146-home-resource"><strong>9999 / 9999</strong></div></div></div></div></section>
<section id="inventoryPage" class="qa-section"><div class="qa-row"><button class="inventory-category-tab">裝備</button><button class="map-inventory-overlay-close">返回</button></div><div class="inventory-item-classic"><span class="inventory-count">99</span><span class="inventory-slot-number">18</span></div><div class="v17350-bulk-sell-bar"><b>批次出售</b><select><option>白階</option></select><button>出售</button><small>只會出售未鎖定裝備</small></div></section>
<section id="itemModal" class="qa-section v17351-equipment-comparison"><div class="v17351-equipment-compare"><div class="v17351-compare-header"><div><small>EQUIPMENT</small><b>裝備比較</b><span>比較目前與新裝備</span></div><button class="v17351-compare-back">返回</button></div><div class="v17351-compare-grid"><div class="v17351-compare-pane"><em>目前裝備</em><strong>赤炎長刀</strong><div class="v17351-compare-stats"><div class="v17351-compare-stat"><span>攻擊</span><b>+100</b></div></div></div><div class="v17351-compare-pane"><em>選擇裝備</em><strong>寒泉長刀</strong><div class="v17351-compare-stats"><div class="v17351-compare-stat"><span>攻擊</span><b>+120</b></div></div></div></div></div></section>
<section id="homeFeatureModal" class="qa-section v131-shop-open quest-mode"><div class="v17346-shop-card"><div class="v17346-shop-name">青嵐護腕</div><div class="v17346-shop-slot">護腕</div><div class="v17346-stat">攻擊 +12</div><div class="v17346-reforge-mini">未冶煉</div><button class="v17346-shop-buy">購買</button></div><div class="quest-card"><div class="quest-card-name">每日任務</div><div class="quest-card-desc">完成指定巡怪與副本目標。</div><div class="quest-progress-line">進度 <strong>3 / 5</strong></div><div class="quest-reward">獎勵：金幣</div><button class="quest-claim-btn">領取</button></div><div class="v141-synthesis"><div class="v141-synthesis-wallet"><span>合成</span><b>金幣 999999</b></div><div class="v141-synthesis-tabs"><button>裝備冶煉</button><button>符咒合成</button><button>材料合成</button></div><div class="v141-synthesis-body"><div class="v17363-material-card"><p>選擇材料與階級</p><div class="v17363-material-field"><span class="v17363-material-field-label">材料類型</span><button class="v17363-game-select-trigger"><span>礦石</span><b>⌄</b></button></div><button class="v17363-craft-button">合成</button></div></div></div></section>
<section id="skillPage" class="qa-section"><div class="skill-loadout-slot"><div class="skill-loadout-slot-name">霸龍裂天斬</div></div></section>
<section id="skillDetailModal" class="qa-section"><div id="skillDetailStats"><div class="v17364-progression-hint">Lv.20 可學習</div><div class="v17364-progression-detail"><div>下一級需要 2 技能點</div></div></div></section>
<section id="dungeonPage" class="qa-section"><div class="v141-dungeon-cover-info"><b>裝備副本</b><span>每日可挑戰 3 次</span></div><div class="v141-dungeon-cover-actions"><button>獎勵預覽</button><button>進入副本</button></div><div class="v141-dungeon-remaining">剩餘次數 3 / 3</div></section>
<section class="qa-section"><div class="team-relic-page"><div class="team-relic-card"><div class="team-relic-card-name">青嵐羽符</div><div class="team-relic-card-meta">風系・輔助</div></div><div class="team-relic-detail"><section><h3>秘寶效果</h3><p>提升隊伍風屬性能力。</p></section><div class="team-relic-detail-actions"><button>裝備秘寶</button></div></div></div></section>
</div></div>
<div class="v132-reward-modal"><div class="v132-reward-modal-inner v17363-text-reward-preview"><div class="v17363-preview-heading"><small>REWARD PREVIEW</small><h3>副本獎勵</h3></div><section class="v17363-preview-group"><b>材料寶箱</b><em>×3</em><p>依結算取得材料與設計圖。</p></section><div class="v17363-preview-note">寶箱數量依規則決定。</div><div class="v132-reward-actions"><button>返回</button></div></div></div>
<div class="v169-rpg-dialog-layer show"><div class="v169-rpg-dialog"><h2>確認操作</h2><div class="v169-rpg-dialog-message">確定要進行這項操作嗎？</div><div class="v169-rpg-dialog-actions"><button class="v169-rpg-dialog-button primary">確認</button></div></div></div>
<pre id="result"></pre><script>(function(){
 const q=s=>document.querySelector(s), px=s=>parseFloat(getComputedStyle(q(s)).fontSize), h=s=>q(s).getBoundingClientRect().height;
 const selectors={homeRoster:'#homePage .v146-home-character-main>div:first-child',homeLevel:'#homePage .v146-home-character-main span',inventoryTab:'#inventoryPage .inventory-category-tab',inventoryCount:'#inventoryPage .inventory-count',inventoryBack:'#inventoryPage .map-inventory-overlay-close',equipmentName:'#itemModal .v17351-compare-pane>strong',equipmentStat:'#itemModal .v17351-compare-stat span',shopName:'#homeFeatureModal .v17346-shop-name',shopBuy:'#homeFeatureModal .v17346-shop-buy',questDesc:'#homeFeatureModal .quest-card-desc',questClaim:'#homeFeatureModal .quest-claim-btn',synthTab:'#homeFeatureModal .v141-synthesis-tabs button',synthField:'#homeFeatureModal .v17363-material-field-label',skillLoadout:'#skillPage .skill-loadout-slot-name',skillHint:'#skillDetailStats .v17364-progression-hint',dungeonName:'#dungeonPage .v141-dungeon-cover-info b',dungeonInfo:'#dungeonPage .v141-dungeon-cover-info span',dungeonButton:'#dungeonPage .v141-dungeon-cover-actions button',relicName:'.team-relic-card-name',relicSection:'.team-relic-detail section h3',relicButton:'.team-relic-detail-actions button',rewardBody:'.v132-reward-modal .v17363-preview-group p',rewardButton:'.v132-reward-actions button',dialogBody:'.v169-rpg-dialog-message',dialogButton:'.v169-rpg-dialog-button'};
 const fonts=Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,px(s)]));
 const heights={inventoryBack:h(selectors.inventoryBack),shopBuy:h(selectors.shopBuy),questClaim:h(selectors.questClaim),synthTab:h(selectors.synthTab),dungeonButton:h(selectors.dungeonButton),relicButton:h(selectors.relicButton),rewardButton:h(selectors.rewardButton),dialogButton:h(selectors.dialogButton)};
 const roots=[...document.querySelectorAll('.qa-section,.v132-reward-modal-inner,.v169-rpg-dialog')];
 const overflows=roots.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.id||el.className);
 document.getElementById('result').textContent=JSON.stringify({fonts,heights,overflows,bodyWidth:document.documentElement.scrollWidth});
})();</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,900","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome typography fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"typography browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    Object.entries(data.fonts).forEach(([name,value])=>assert.ok(value>=13,`${name} computed font ${value}px is below 13px`));
    ["homeRoster","inventoryTab","inventoryBack","shopBuy","questClaim","synthTab","skillLoadout","dungeonButton","relicButton","rewardButton","dialogBody","dialogButton"].forEach(name=>assert.ok(data.fonts[name]>=15,`${name} should use normal actionable/body typography`));
    ["inventoryBack","shopBuy","questClaim","synthTab","dungeonButton","relicButton","rewardButton","dialogButton"].forEach(name=>assert.ok(data.heights[name]>=34,`${name} control is too short after typography growth`));
    assert.deepEqual(data.overflows,[],`representative UI gained horizontal overflow: ${data.overflows.join(', ')}`);
    assert.ok(data.bodyWidth<=420,"page-level horizontal overflow detected");
    console.log("Headless Chrome 420x900: representative non-battle typography, controls and horizontal overflow verified");
}finally{ try{fs.unlinkSync(fixture);}catch(_){ } }
