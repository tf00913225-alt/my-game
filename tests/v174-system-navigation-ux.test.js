"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const guard=read("js/61-v174-ui-regression-guards.js");
const main=read("js/00-main.js");

assert.match(main,/<strong>遊戲存檔<\/strong>[\s\S]{0,260}立即存檔/);
assert.match(main,/<strong>帳號管理<\/strong>[\s\S]{0,320}openAccountManager/);
assert.match(main,/<strong>刪除角色<\/strong>[\s\S]{0,300}resetGame\(\)/);

assert.match(guard,/systemRowTitle/);
assert.match(guard,/title!=="遊戲存檔"&&title!=="刪除角色"/);
assert.match(guard,/window\.saveGame\(\)/);
assert.match(guard,/confirmText:"返回系統"/);
assert.match(guard,/window\.FourSymbolsFeatures\.ensure\("gameplay-core"/);
assert.match(guard,/window\.resetGame\(\)/);
assert.match(guard,/v169RpgDialogTitle/);
assert.match(guard,/cancel\.textContent="返回系統"/);
assert.match(guard,/document\.addEventListener\("click",interceptSystemAction,true\)/);

console.log("✓ system save/delete flows keep explicit return navigation");
