"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const css=fs.readFileSync("css/29-v125-character-creation-native.css","utf8");
const touchLock=fs.readFileSync("js/01-stage-v8-touch-lock.js","utf8");
const viewportCss=fs.readFileSync("css/03-stage-v4-viewport-lock.css","utf8");

assert.match(touchLock,/const TAP_SLOP_CSS_PX=10/);
assert.match(touchLock,/data-scroll-owner="x\|y\|both"/);
assert.doesNotMatch(touchLock,/allowedSelector|isInsideAllowedScroller/);
assert.doesNotMatch(touchLock,/pointermove[\s\S]{0,500}preventDefault\(\)/);
assert.match(touchLock,/event\.touches&&event\.touches\.length>1\)\{[\s\S]*?event\.preventDefault\(\)/);
assert.match(touchLock,/pointer\.state=pointer\.dragOwner\?"DRAG":pointer\.scrollOwner\?"SCROLL":"CANCEL"/);
assert.match(touchLock,/return pointer\.state!=="TAP"/);
assert.match(viewportCss,/touch-action:pan-x pan-y/);
assert.doesNotMatch(viewportCss,/touch-action:none/);
assert.match(css,/#creationPage \.creation-stat-button\{[\s\S]*?min-height:136px;/);
for(const [width,height] of [[360,800],[390,844],[412,915],[390,932]]){
  const scale=Math.min(width/1080,height/1920);
  assert.ok(136*scale>=44,`${width}×${height} native controls keep a 44px hitbox`);
}
console.log("✓ declarative scroll-owner and CSS-pixel gesture arbitration regression");
