"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");

const boss=read("css/gameplay-boss-tower.css");
assert.match(boss,/gameplay-boss-card[\s\S]*?battle-monster-icon[\s\S]*?background-size:contain;/);
assert.match(boss,/boss-mechanism-card\{[\s\S]*?aspect-ratio:4 \/ 3;/);

const battle=read("js/54-v173.51-battle-qa.js");
const fixedSlotCss=read("css/fixed-slot-battlefield-rendering-v2.css");
assert.doesNotMatch(battle,/battle-player\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?(?:inset:|top:|bottom:|left:|right:)/,"V173.51 must not own player artwork geometry");
assert.match(fixedSlotCss,/\.v174-battle-art\{[\s\S]*?background-size:contain !important;/,"fixed Slot CSS must own no-crop artwork sizing");
assert.doesNotMatch(battle,/battle-monster\.v174-cardless-unit>\.monster-hp\{[\s\S]*?bottom:/,"V173.51 must not own monster HP position");
assert.doesNotMatch(battle,/battle-monster\.v174-cardless-unit>\.monster-sp\{[\s\S]*?bottom:/,"V173.51 must not own monster SP position");
assert.match(fixedSlotCss,/\.v-fixed-enemy-slot \.monster-hp,[\s\S]*\.v-fixed-ally-slot \.hp-bar\{bottom:11px !important;\}/,"fixed Slot CSS must own HP anchor");
assert.match(fixedSlotCss,/\.v-fixed-enemy-slot \.monster-sp,[\s\S]*\.v-fixed-ally-slot \.sp-bar\{bottom:1px !important;\}/,"fixed Slot CSS must own SP anchor");
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-hp,[\s\S]*battle-monster\.v174-cardless-unit>\.monster-sp\{[\s\S]*display:block!important;[\s\S]*visibility:visible!important/,"V173.51 may retain HP/SP presentation visibility");

const city=read("js/16-stage-v54-main-city-runtime.js");
const cityCss=read("css/19-stage-v54-main-city-moderate-native-scale.css");
const lazyCity=read("js/41-v146-system-polish.js");
assert.match(city,/window\.v54RenderHomeRoster=renderHomeRoster/);
assert.match(city,/v146-home-roster/);
assert.match(cityCss,/\.v146-home-roster\{/);
assert.doesNotMatch(lazyCity,/function renderHomeRoster\(\)\{[\s\S]{0,300}document\.createElement\("section"\)/);

const base=read("css/00-main.css"),native=read("css/09-stage-v15-native-character-shell.css"),detail=read("css/23-stage-v77-inventory-detail-ui.css");
assert.match(base,/#skillDetailModal\{\s*z-index:13000;/);
assert.match(native,/native-v18-skill-detail-layer\{z-index:13000!important;/);
assert.match(detail,/#skillDetailModal #skillDetailIcon\{[\s\S]*?width:88px!important;[\s\S]*?background-size:contain!important;[\s\S]*?background-repeat:no-repeat!important;/);

const auth=read("js/firebase/firebase-auth-ui.js"),startup=read("js/52-v173.20-startup-loader.js");
assert.match(auth,/Array\.isArray\(user\.providerIds\)/);
assert.match(auth,/使用 Google 登入中/);
assert.match(auth,/使用 \"\+user\.email\+\" 信箱登入中/);
assert.doesNotMatch(startup,/activeUser\)\{[\s\S]{0,180}location\.reload\(\)/);
assert.match(startup,/reason:"account-switch"/);
assert.match(startup,/v54RenderHomeRoster/);

const relicJs=read("js/60-team-relic-system.js"),relicCss=read("css/55-team-relic-system.css");
assert.match(relicJs,/classList\.add\("team-relic-detail-mode"\)/);
assert.match(relicJs,/classList\.remove\("team-relic-detail-mode"\)/);
assert.match(relicCss,/team-relic-modal\.team-relic-detail-mode \.home-feature-close-btn\{display:none!important;/);

const main=read("js/00-main.js");
assert.match(main,/帳號管理[\s\S]{0,360}切換帳號／綁定帳號/);
console.log("V173.65 UI/battle/auth polish regression checks passed");
