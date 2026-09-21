"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");

const source=fs.readFileSync("scripts/import-monster-portraits.mjs","utf8");
const finalize=fs.readFileSync("scripts/finalize-monster-portrait-registry.mjs","utf8");
const spec=fs.readFileSync("MONSTER_PORTRAIT_SPEC.md","utf8");
const packageJson=JSON.parse(fs.readFileSync("package.json","utf8"));

assert.match(source,/refusing unscoped import/);
assert.match(source,/--keys=<portraitKey/);
assert.match(source,/--group=<group>/);
assert.match(source,/--reactivate-retired/);
assert.match(source,/target\.status!==\"existing\"/);
assert.match(source,/monster\.portraitKey=dailyMonsterPortraitKey\(type,rank\)/);
assert.match(source,/assets\\/monsters\\//);\nassert.match(source,/webpCandidate/);\nassert.match(source,/matching formal WebP is missing/);
assert.match(source,/ImageMagick identify failed/);
assert.match(source,/geometry mismatch/);
assert.match(source,/alpha channel missing/);
assert.match(source,/monster-portrait-runtime\.test\.js/);
assert.match(source,/statusCount\(\"planned\"\)/);
assert.doesNotMatch(finalize,/plannedTargets=rows\.length-existingTargets/);
assert.equal(packageJson.scripts["portrait:import"],"node scripts/import-monster-portraits.mjs");
assert.match(spec,/已生成素材快速導入/);

const check=spawnSync(process.execPath,["--check","scripts/import-monster-portraits.mjs"],{encoding:"utf8"});
assert.equal(check.status,0,check.stderr||check.stdout);

const help=spawnSync(process.execPath,["scripts/import-monster-portraits.mjs","--help"],{encoding:"utf8"});
assert.equal(help.status,0,help.stderr||help.stdout);
assert.match(help.stdout,/Monster Portrait Fast Import/);

console.log("Monster portrait fast import workflow tests passed.");
