"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const growth=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const css=fs.readFileSync("css/49-v169-rpg-ui.css","utf8");
const featureBoundary=fs.readFileSync("js/20-anonymous-20.js","utf8");
const loader=featureBoundary+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(growth,/function v173CaptureExpPoolViewport\(\)/);
assert.match(growth,/function v173RestoreExpPoolViewport\(snapshot\)/);
assert.match(growth,/requestAnimationFrame\(function\(\)\{[\s\S]*?requestAnimationFrame\(restore\)/);
assert.match(growth,/window\.v131PreviewExpLevel=function\(index\)\{[\s\S]*?v173CaptureExpPoolViewport\(\)[\s\S]*?v173ScheduleExpPoolDecoration\(viewport\)/);
assert.match(growth,/window\.v131ConfirmExpPreview=async function\(\)\{[\s\S]*?v173CaptureExpPoolViewport\(\)[\s\S]*?v173ScheduleExpPoolDecoration\(viewport\)/);
assert.match(growth,/window\.v131CancelExpPreview=function\(\)\{[\s\S]*?v173CaptureExpPoolViewport\(\)[\s\S]*?v173ScheduleExpPoolDecoration\(viewport\)/);
assert.match(css,/V173\.49 — EXP POOL TAP \/ SCROLL STABILITY/);
assert.match(css,/#homeExpPoolCard #expDistributeList \*\{[\s\S]*?overflow-anchor:none !important;/);
assert.match(css,/\.v131-exp-preview-btn,[\s\S]*?\.v131-exp-confirm,[\s\S]*?\.v131-exp-back\{[\s\S]*?touch-action:none !important;/);

// The pool shell is app-shell, but its safe preview/confirm owner is gameplay-core.
// Lazy loading must never let an old immediate-distribute control spend EXP first.
assert.match(featureBoundary,/closest\("#homeExpPoolCard"\)/);
assert.match(featureBoundary,/feature:"battle",label:"經驗池安全升級",expPool:true/);
assert.match(featureBoundary,/api\.ensure\("battle","exp-pool-safety"\)/);
assert.match(featureBoundary,/let expPoolSafetyUiReady=false/);
assert.match(featureBoundary,/function refreshExpPoolSafetyUiOnce\(\)\{[\s\S]*?if\(expPoolSafetyUiReady\)\{ return; \}[\s\S]*?expPoolSafetyUiReady=true/);
assert.match(featureBoundary,/if\(info\.expPool\)\{[\s\S]*?refreshExpPoolSafetyUiOnce\(\);[\s\S]*?return;/);
assert.match(featureBoundary,/new MutationObserver\(\(\)=>\{[\s\S]*?if\(expPoolSafetyUiReady\)\{ return; \}/);
assert.doesNotMatch(featureBoundary,/if\(info\.expPool\)[\s\S]{0,260}element\.click\(\)/,"old EXP-pool DOM must never be replayed after lazy owner install");

assert.ok(loader.includes('const V_ASSET_VERSION="173.70";'));
assert.ok(index.includes('<title>四象江湖傳 V173.70</title>'));

console.log("V173.50 EXP pool scroll stability + lazy safety-owner regression checks passed");
