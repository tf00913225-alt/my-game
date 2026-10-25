const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

test("persistent body status owner keeps hard-control base fixed under the two-second rotating layer",()=>{
  const js=read("js/39-v143-skill-animation.js");
  const css=read("css/40-v143-combat-dungeon-polish.css");
  assert.match(js,/const STATUS_ROTATION_MS=2000/);
  assert.match(js,/const statusRotationByUnit=new Map\(\)/);
  assert.match(js,/HARD_CONTROL_BASE:"hard-control-base"/);
  assert.match(js,/ROTATING:"rotating"/);
  assert.match(js,/HUD:"hud"/);
  assert.match(js,/freeze:statusVisual\([\s\S]*?visualLayer:STATUS_VISUAL_LAYERS\.HARD_CONTROL_BASE/);
  assert.match(js,/petrify:statusVisual\([\s\S]*?visualLayer:STATUS_VISUAL_LAYERS\.HARD_CONTROL_BASE/);
  assert.match(js,/const rotatingBodyTypes=activeBodyStatusTypesForLayer\([\s\S]*?STATUS_VISUAL_LAYERS\.ROTATING/);
  assert.match(js,/rotation\.index=\(rotation\.index\+1\)%rotatingBodyTypes\.length/);
  assert.match(js,/baseBodyTypes\.includes\(type\)/);
  assert.match(js,/type===activeRotatingBodyType/);
  assert.match(js,/syncStatusVisualEffects\(true\)/);
  assert.doesNotMatch(js,/Math\.floor\(Date\.now\(\)\/STATUS_ROTATION_MS\)/);
  assert.match(js,/stun:statusVisual\("assets\/vfx\/status\/stun-stars-v2\.webp","pulse"/);
  assert.match(css,/--v143-status-layer-hard-control-base:4/);
  assert.match(css,/--v143-status-layer-rotating:5/);
  assert.match(css,/--v143-status-layer-hud:34/);
  assert.match(css,/\.v143-status-visual--layer-hard-control-base\{[\s\S]*?z-index:var\(--v143-status-layer-hard-control-base\)/);
  assert.match(css,/\.v143-status-icon\{[\s\S]*?width:24px;[\s\S]*?height:24px;/);
  assert.match(css,/\.v143-status-visual--pulse\{[\s\S]*?animation:v143StatusImageBreath 2s ease-in-out infinite/);
  assert.match(css,/\.v143-status-visual-freeze\{[\s\S]*?animation:none/);
  assert.match(css,/\.v143-status-visual-petrify\{[\s\S]*?animation:none/);
});

test("battle information is retired and turn timer remains visible",()=>{
  const html=read("index.html");
  const css=read("css/fixed-slot-battlefield-rendering-v2.css");
  const js=read("js/00-main.js");
  const stats=read("js/battle-statistics-system.js");
  assert.doesNotMatch(html,/battleInfoToggle/,"retired battle log UI must stay absent");
  assert.ok(html.indexOf('id="battleActionRegion"')<html.indexOf('id="turnTargetRow"'),"turn row should be inside the battle action region");
  assert.match(css,/#battleActionRegion > \.turn-target-row[\s\S]*?opacity:1/);
  assert.match(css,/\.turn-target-row\.skill-picker-open\{[\s\S]*?bottom:calc\(var\(--battle-command-visual-height\) \+ 44px\);[\s\S]*?opacity:1/);
  assert.match(css,/\.turn-target-row\.battle-item-open\{[\s\S]*?opacity:1/);
  assert.match(css,/#battleActionRegion\.target-selecting > \.turn-target-row\{[\s\S]*?top:auto;[\s\S]*?bottom:calc\(var\(--battle-target-prompt-height\) \+ var\(--battle-target-select-gap\)\);[\s\S]*?opacity:1/);
  assert.doesNotMatch(css,/battle-info-region/,"retired battle log UI must stay absent");
  assert.doesNotMatch(css,/battle-info-region/,"retired battle log UI must stay absent");
  assert.doesNotMatch(stats,/battleStatsEdgeButton|battleStatsDrawer|openStatistics/,"retired statistics UI must stay absent");
  assert.match(stats,/aria-label","查看 Boss 功能卡"/,"remaining Boss inspector must retain its entry");
  assert.match(js,/function syncBattleUiPriorityLayer\(\)/);
  assert.doesNotMatch(js,/function installBattleInfoHandleDrag\(\)|__battleInfoHandleDragInstalled|__suppressNextBattleInfoClick/);
  assert.doesNotMatch(css,/battleInfoToggle/,"retired battle log UI must stay absent");
  assert.doesNotMatch(css,/battle-info-toggle\.is-dragging|cursor:ew-resize/);
  assert.match(css,/#battleActionRegion > \.turn-target-row\{[\s\S]*?z-index:18070 !important/);
  const legacyBattleCss=read("css/31-v131-fix-batch.css");
  assert.doesNotMatch(
    legacyBattleCss,
    /#game-stage #battlePage button,\s*\n#game-stage #battlePage button img/,
    "legacy icon transparency must never clear every battle button background"
  );
  assert.doesNotMatch(css,/battle-info-region/,"retired battle log UI must stay absent");
  assert.doesNotMatch(css,/battle-info-region/,"retired battle log UI must stay absent");
  assert.doesNotMatch(js,/toggleBattleInfoPanel/);
  const mainCss=read("css/00-main.css");
  assert.match(mainCss,/\.skill-quick-button \.sq-sp-block\[hidden\]\{[\s\S]*?display:none;/);
  assert.match(mainCss,/#battlePage\{[\s\S]*?--battle-command-row-height:66px;[\s\S]*?--battle-command-art-overhang:0px;[\s\S]*?--battle-command-visual-height:calc\(var\(--battle-command-row-height\) \+ var\(--battle-command-art-overhang\)\);/);
  assert.doesNotMatch(mainCss,/--battle-center-min-height/);
  assert.doesNotMatch(css,/--battle-command-row-height:66px|--battle-command-art-overhang:0px/);
  assert.match(css,/grid-template-rows:[\s\S]*?minmax\(var\(--battle-center-min-height\),var\(--battle-center-region-track\)\)/);
  assert.match(css,/#battleActionRegion > \.turn-target-row\{[\s\S]*?position:absolute;[\s\S]*?top:0;[\s\S]*?bottom:auto;/);
});

test("battle reading state suppresses detached transient paint across stacking contexts",()=>{
  const mainCss=read("css/00-main.css");
  const fixedCss=read("css/fixed-slot-battlefield-rendering-v2.css");
  const statsCss=read("css/battle-statistics-system.css");
  const vfxCss=read("css/40-v143-combat-dungeon-polish.css");
  assert.doesNotMatch(mainCss,/#game-stage\.battle-ui-priority\{[\s\S]*?z-index:/);
  assert.match(mainCss,/body\.v174-battle-reading-open > \.v143-skill-stage,[\s\S]*?body\.v174-battle-reading-open > \.v-fixed-slot-popup,[\s\S]*?body\.v174-battle-reading-open > \.damage-popup,[\s\S]*?body\.v174-battle-reading-open > \.damage-popup\.v152-top-damage,[\s\S]*?body\.v174-battle-reading-open > \.battle-floating-feedback,[\s\S]*?body\.v174-battle-reading-open > \.skill-name-badge,[\s\S]*?body\.v174-battle-reading-open > \.team-relic-battle-presentation,[\s\S]*?body\.v174-battle-reading-open #game-stage \.team-relic-battle-banner\{[\s\S]*?visibility:hidden !important;[\s\S]*?opacity:0 !important;/);
  assert.doesNotMatch(mainCss,/body\.v174-battle-reading-open[\s\S]{0,900}display:none/);
  assert.doesNotMatch(fixedCss,/battle-info-region/,"retired battle log UI must stay absent");
  assert.match(statsCss,/z-index:18072/);
  assert.match(vfxCss,/\.battle-status-detail-modal\{[\s\S]*?z-index:18120/);
  assert.match(vfxCss,/\.v143-skill-stage\{[\s\S]*?z-index:16000/);
  assert.doesNotMatch(fixedCss,/battle-info-region/,"retired battle log UI must stay absent");
  assert.doesNotMatch(fixedCss,/battle-info-region/,"retired battle log UI must stay absent");
  assert.doesNotMatch(fixedCss,/battle-info-region/,"retired battle log UI must stay absent");
});

test("new skill icons and 4x3 cast sheets use dedicated WebP runtime assets",()=>{
  const main=read("js/00-main.js");
  const vfx=read("js/39-v143-skill-animation.js");
  const assets=[
    "assets/skills/fire-soul-resonance.webp",
    "assets/skills/fire-blood-burn.webp",
    "assets/skills/water-purify-mind.webp",
    "assets/vfx/fire/fire-soul-resonance-cast-v2.webp",
    "assets/vfx/fire/blood-burn-art-cast.webp",
    "assets/vfx/water/purify-mind-cast.webp",
    "assets/vfx/status/stun-stars-v2.webp"
  ];
  assert.match(main,/fireSoulResonance:"assets\/skills\/fire-soul-resonance\.webp"/);
  assert.match(main,/bloodBurnArt:"assets\/skills\/fire-blood-burn\.webp"/);
  assert.match(main,/purifyMind:"assets\/skills\/water-purify-mind\.webp"/);
  assert.match(vfx,/fireSoulResonance:\{[\s\S]*?fire-soul-resonance-cast-v2\.webp/);
  const soulSheet=losslessWebpInfo("assets/vfx/fire/fire-soul-resonance-cast-v2.webp");
  assert.deepEqual([soulSheet.width,soulSheet.height,soulSheet.alpha],[1448,1086,1]);
  assert.equal(soulSheet.width/4,soulSheet.height/3);
  assert.deepEqual(fs.readFileSync("assets/vfx/fire/fire-soul-resonance-cast-v2.webp"),fs.readFileSync("tools/vfx-commercial-sample/assets/full/fire-soul-resonance-v3.webp"),"runtime soul sheet preserves the reviewed candidate bytes");
  assert.match(vfx,/bloodBurnArt:\{[\s\S]*?blood-burn-art-cast\.webp/);
  assert.match(vfx,/purifyMind:\{[\s\S]*?purify-mind-cast\.webp/);
  for(const relative of assets){
    const data=fs.readFileSync(path.join(ROOT,relative));
    assert.equal(data.subarray(0,4).toString("ascii"),"RIFF",relative);
    assert.equal(data.subarray(8,12).toString("ascii"),"WEBP",relative);
  }
});

test("dense battle motion leaves geometry and filters static while only inner paint breathes",()=>{
  const css=read("css/fixed-slot-battlefield-rendering-v2.css");
  const artRule=css.match(/\.v-fixed-battle-slot > \.battle-monster > \.v174-battle-art,[\s\S]*?\.v-fixed-ally-slot > \.battle-player > \.v174-battle-art\{([\s\S]*?)\n\}/);
  assert.ok(artRule,"canonical portrait art rule should exist");
  assert.match(artRule[1],/animation:none !important/);
  assert.doesNotMatch(artRule[1],/will-change:transform,filter/);
  assert.match(css,/\.v174-portrait-paint\{[^}]*animation:v174BattleIdle 3\.4s/);
  assert.match(css,/data-motion="idle"[\s\S]*animation-play-state:paused/);
  assert.match(css,/\.v174-cardless-unit > \.v174-battle-art::after\{[\s\S]*?opacity:\.72/);
});

test("battle target selection avoids the dense compositor and unrelated global UI rebuild",()=>{
  const main=read("js/00-main.js");
  const fixed=read("css/fixed-slot-battlefield-rendering-v2.css");
  const start=main.indexOf("function selectBattleTarget(index)");
  const end=main.indexOf("function executeAction(",start);
  const selectBlock=main.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(selectBlock,/updateUI\(\)/);
  assert.match(fixed,/\.battle-monster\.v174-cardless-unit\.targetable::after,[\s\S]*?\.battle-player\.v174-cardless-unit\.ally-targetable:not\(\.active-turn\)::after\{[\s\S]*?content:none !important;[\s\S]*?display:none !important/);
  assert.match(fixed,/\.battle-player\.v174-cardless-unit\.ally-targetable::before\{/);
  const activeFrameRule=fixed.match(/#game-stage #battlePage\.v-fixed-slot-render-v2 \.battle-player\.v174-cardless-unit\.active-turn > \.v174-battle-art::before\{([^}]*)\}/);
  assert.ok(activeFrameRule,"Fixed Slot must own the manual active-character frame");
  assert.match(activeFrameRule[1],/border:1px solid rgb\(204,28,43\) !important/);
  assert.match(activeFrameRule[1],/box-shadow:[^;]+!important/);
  assert.match(activeFrameRule[1],/animation:v174ManualTurnFootBreath 2s ease-in-out infinite !important/);
  assert.match(activeFrameRule[1],/z-index:-1 !important/);
  assert.match(activeFrameRule[1],/bottom:-2px !important/);
  assert.match(activeFrameRule[1],/width:66% !important/);
  assert.match(activeFrameRule[1],/height:10px !important/);
  assert.match(fixed,/\.battle-player\.v174-cardless-unit\.active-turn::after\{\s*content:none !important;\s*display:none !important;\s*animation:none !important/,'the obsolete Unit-root frame must be explicitly disabled');
  assert.match(fixed,/\.v174-cardless-unit > \.v174-battle-art::after\{[\s\S]*?background:radial-gradient[\s\S]*?opacity:\.72/,'ground shadow keeps its original pseudo-element');
  assert.match(fixed,/@keyframes v174ManualTurnFootBreath\{[\s\S]*?50%\{[\s\S]*?opacity:\.75/);
  assert.doesNotMatch(fixed,/v174ManualActiveTurnFrameFlash/);
  assert.match(read("js/54-v173.51-battle-qa.js"),/kind==="player"&&!art\.querySelector\(":scope > \.v174-manual-turn-arrow"\)/);
  assert.match(fixed,/active-turn > \.v174-battle-art > \.v174-manual-turn-arrow\{display:block/);
  assert.doesNotMatch(activeFrameRule[1],/animation:none/);
});

test("manual active character highlight is unique and cleared for per-character auto control",()=>{
  const main=read("js/00-main.js");
  const beginStart=main.indexOf("function beginCharacterTurn(token)");
  const beginEnd=main.indexOf("function clearActiveCharacterHighlight()",beginStart);
  const beginBlock=main.slice(beginStart,beginEnd);
  assert.ok(beginStart>=0&&beginEnd>beginStart);
  assert.match(beginBlock,/const autoOn=[\s\S]*?getPartyAutoConfig\(activeBattleCharacterIndex\)\.enabled/);
  assert.match(beginBlock,/clearActiveCharacterHighlight\(\);[\s\S]*?if\(!autoOn\)\{[\s\S]*?updateActiveCharacterHighlight\(\)/);

  const cards=Array.from({length:6},()=>{
    const classes=new Set();
    return {classList:{remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name),contains:name=>classes.has(name)}};
  });
  let activeBattleCharacterIndex=0;
  const $=id=>cards[Number(id.slice(-1))]||null;
  const clearBody=main.match(/function clearActiveCharacterHighlight\(\)\{[\s\S]*?\n\}/)?.[0];
  const updateBody=main.match(/function updateActiveCharacterHighlight\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(clearBody&&updateBody,"canonical highlight functions must remain extractable");
  const clear=new Function("$","getExistingPartyIndexes",`${clearBody};return clearActiveCharacterHighlight;`)($,()=>cards.map((_,index)=>index));
  const update=new Function("$","getIndex",`${updateBody.replaceAll("activeBattleCharacterIndex","getIndex()")};return updateActiveCharacterHighlight;`)($,()=>activeBattleCharacterIndex);
  const active=()=>cards.map((card,index)=>card.classList.contains("active-turn")?index:null).filter(index=>index!==null);

  clear();update();assert.deepEqual(active(),[0]);
  activeBattleCharacterIndex=1;clear();update();assert.deepEqual(active(),[1]);
  activeBattleCharacterIndex=2;clear();update();assert.deepEqual(active(),[2]);
  for(const index of [3,4,5]){activeBattleCharacterIndex=index;clear();update();assert.deepEqual(active(),[index]);}
  clear();assert.deepEqual(active(),[],"auto-controlled character must not retain a manual-control flash");
});


function losslessWebpInfo(file){
 const b=Buffer.isBuffer(file)?file:fs.readFileSync(file);
 assert.equal(b.toString("ascii",0,4),"RIFF");assert.equal(b.toString("ascii",8,12),"WEBP");
 for(let o=12;o+8<=b.length;){const type=b.toString("ascii",o,o+4),size=b.readUInt32LE(o+4),p=o+8;assert.ok(p+size<=b.length,"complete WebP chunk");if(type==="VP8L"){assert.equal(b[p],0x2f);const bits=b.readUInt32LE(p+1);return {width:1+(bits&16383),height:1+((bits>>>14)&16383),alpha:(bits>>>28)&1};}o=p+size+(size%2);}
 throw new Error("Expected lossless VP8L image");
}

test("battle AUTO ring follows original auto state without replacing children or changing speed",()=>{
 const vm=require("node:vm"),js=read("js/00-main.js"),html=read("index.html"),css=read("css/fixed-slot-battlefield-rendering-v2.css");
 const start=js.indexOf("function updateAutoButton(){");let level=0,end=start;for(let i=js.indexOf("{",start);i<js.length;i++){if(js[i]==="{")level++;else if(js[i]==="}"&&--level===0){end=i+1;break;}}
 const attrs={},classes={};const button={classList:{toggle:(k,v)=>classes[k]=v},setAttribute:(k,v)=>attrs[k]=v};
 const context={autoBattle:false,$:id=>id==="battleAutoToggle"?button:null};vm.createContext(context);vm.runInContext(js.slice(start,end),context);
 for(const active of [false,true,false]){context.autoBattle=active;context.updateAutoButton();assert.equal(classes["is-active"],active);assert.equal(attrs["aria-pressed"],String(active));assert.equal(context.autoBattle,active);}
 assert.match(html,/id="battleAutoToggle"[^>]*onclick="toggleAutoBattle\(\)"/);assert.match(html,/id="battleSpeedControl"[^>]*disabled/);assert.doesNotMatch(html,/assets\/battle\/element-box\.png/);
 assert.match(css,/#battleAutoToggle\.is-active::before/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("more menu opens only in manual selection and cannot survive utility mode",()=>{
 const vm=require('node:vm'),js=read('js/00-main.js'),html=read('index.html'),bits=new Set(),attrs={};
 const region={dataset:{controlMode:'manual'},classList:{contains:k=>bits.has(k),toggle:(k,on)=>on?bits.add(k):bits.delete(k)}};
 const more={setAttribute:(k,v)=>attrs[k]=v};const ctx={$:id=>id==='battleActionRegion'?region:id==='battleMoreButton'?more:null};vm.createContext(ctx);
 vm.runInContext(js.slice(js.indexOf('function setBattleUtilityMenuOpen('),js.indexOf('function updateAutoButton(){')),ctx);
 ctx.toggleBattleUtilityMenu();assert.equal(attrs['aria-expanded'],'true');ctx.toggleBattleUtilityMenu();assert.equal(attrs['aria-expanded'],'false');
 bits.add('target-selecting');ctx.setBattleUtilityMenuOpen(true);assert.equal(attrs['aria-expanded'],'false');bits.delete('target-selecting');region.dataset.controlMode='utility';ctx.setBattleUtilityMenuOpen(true);assert.equal(attrs['aria-expanded'],'false');
 assert.match(html,/id="battleMoreButton"[^>]*aria-controls="battleUtilityTray"/);
 const owner=read('js/20-anonymous-20.js');assert.match(owner,/event.key!=="Escape"/);assert.match(owner,/pointerdown/);assert.doesNotMatch(owner,/initBattleElementBoxDrag/);
});


test("enemy selection uses one noninteractive sword seal without the superseded foot ring or arrow",()=>{
 const css=read("css/fixed-slot-battlefield-rendering-v2.css"),runtime=read("js/54-v173.51-battle-qa.js");
 assert.doesNotMatch(css,/v174-target-arrow/);assert.doesNotMatch(runtime,/v174-target-arrow/);
 const rule=css.match(/\.v174-target-reticle\{([^}]+)\}/)?.[1];assert.ok(rule);assert.match(rule,/width:54px;height:54px/);assert.match(rule,/pointer-events:none/);assert.match(rule,/data:image\/svg\+xml/);
 assert.match(runtime,/kind==="monster"&&!art.querySelector\(":scope > \.v174-target-reticle"\)/);
});
