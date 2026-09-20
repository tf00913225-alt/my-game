"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

const main=read("js/00-main.js");
const adventure=read("js/adventure/adventure-content-v1-20260915.js");
const offlineUi=read("js/35-v141-ui-battle.js");
const home=read("js/16-stage-v54-main-city-runtime.js");
const homeCss=read("css/19-stage-v54-main-city-moderate-native-scale.css");
const shopUi=read("js/51-v169-rpg-ui.js");
const equipment=read("js/equipment-progression.js");
const shopCss=read("css/49-v169-rpg-ui.css");
const support=read("js/startup/support-contact.js");
const privacy=read("privacy.html");
const authUi=read("js/firebase/firebase-auth-ui.js");
const auth=read("js/firebase/firebase-auth.js");

assert.match(main,/RETIRED_BACKPACK_POTION_IDS=new Set\(\[[\s\S]*"hpPotion50"[\s\S]*"spPotion50"/);
assert.match(main,/RETIRED_BACKPACK_POTION_IDS\.has\(String\(item\.id\|\|""\)\)/);
assert.doesNotMatch(adventure,/id:"(?:hp|sp)Potion50"/);
assert.match(adventure,/road_chest:\{gold:420,potions:\[\{id:"hpPotion30",count:1\}\]\}/);
assert.match(adventure,/id:"hpPotion30",name:"大還丹"/);
assert.match(adventure,/id:"spPotion30",name:"歸元丹"/);

assert.match(shopUi,/v17345-equipment-wallet"><span>目前金幣<\/span><b>'\+goldText\+'/);
assert.match(equipment,/v17345-equipment-wallet"><span>目前金幣<\/span><b>'\+goldText\+'/);
assert.match(shopCss,/\.v17345-equipment-wallet\{[\s\S]{0,260}display:flex !important/);
assert.doesNotMatch(shopCss,/\.v17345-equipment-wallet\{\s*display:none !important/);
assert.match(shopCss,/grid-template-rows:32px minmax\(0,1fr\) 58px !important/);

assert.match(home,/id="v146HomeRosterGoldValue"/);
assert.match(home,/class="v146-home-roster-gold">金幣/);
assert.match(homeCss,/\.v146-home-roster-gold strong\{[^{}]*font-size:13px/);
assert.match(main,/\$\("v146HomeRosterGoldValue"\)/);

assert.match(offlineUi,/onclick="claimOfflineExpWithAd\(\)">廣告雙倍<\/button>/);
assert.doesNotMatch(offlineUi,/watchOfflineExpAd/);
assert.match(main,/function claimOfflineExpWithAd\(\)[\s\S]*showRewardedAd\([\s\S]*claimOfflineExp\([\s\S]*true/);

assert.match(support,/const EMAIL="foursymbols\.support@gmail\.com"/);
assert.doesNotMatch(support,/tf00913225@gmail\.com/);
assert.match(privacy,/mailto:foursymbols\.support@gmail\.com/);
assert.doesNotMatch(privacy,/tf00913225@gmail\.com/);

assert.doesNotMatch(authUi,/firebaseFacebookButton|Facebook 登入|signInWithFacebook/);
assert.match(authUi,/firebaseGoogleButton/);
assert.match(authUi,/firebaseEmailSignInButton/);
assert.match(authUi,/firebaseGuestButton/);
assert.match(auth,/export async function signInWithFacebook\(\)/);

console.log("✓ 2026-09-20 six-fix regression contracts passed");
