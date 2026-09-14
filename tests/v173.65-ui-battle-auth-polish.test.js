"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");

const boss=read("css/gameplay-boss-tower.css");
assert.match(boss,/gameplay-boss-card[\s\S]*?battle-monster-icon[\s\S]*?background-size:contain;/);
assert.match(boss,/boss-mechanism-card\{[\s\S]*?aspect-ratio:4 \/ 3;/);

const battle=read("js/54-v173.51-battle-qa.js");
assert.match(battle,/battle-player\.v174-cardless-unit>\.v174-battle-art\{[\s\S]*?background-size:contain!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-hp\{[\s\S]*?bottom:29px!important;[\s\S]*?display:block!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.monster-sp\{[\s\S]*?bottom:16px!important;[\s\S]*?display:block!important/);
assert.match(battle,/battle-monster\.v174-cardless-unit>\.battle-monster-name\{[\s\S]*?top:auto!important;bottom:0!important/);

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
