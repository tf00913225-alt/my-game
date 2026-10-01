"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");

const source=fs.readFileSync("scripts/import-monster-portraits.mjs","utf8");
const finalize=fs.readFileSync("scripts/finalize-monster-portrait-registry.mjs","utf8");
const masterFinalize=fs.readFileSync("scripts/finalize-monster-portrait-from-master.mjs","utf8");
const generator=fs.readFileSync("scripts/generate-runtime-webp-from-master.mjs","utf8");
const spec=fs.readFileSync("MONSTER_PORTRAIT_SPEC.md","utf8");
const permanentDoc=fs.readFileSync("docs/PERMANENT_IMAGE_ASSET_PIPELINE.md","utf8");
const packageJson=JSON.parse(fs.readFileSync("package.json","utf8"));

assert.match(source,/refusing unscoped import/);
assert.match(source,/--keys=<portraitKey/);
assert.match(source,/--group=<group>/);
assert.match(source,/--reactivate-retired/);
assert.match(source,/target\.status!==\"existing\"/);
assert.match(source,/monster\.portraitKey=dailyMonsterPortraitKey\(type,rank\)/);
assert.match(source,/assets\/monsters\//);
assert.match(source,/webpCandidate/);
assert.match(source,/matching formal WebP is missing/);
assert.match(source,/ImageMagick identify failed/);
assert.match(source,/geometry mismatch/);
assert.match(source,/alpha channel missing/);
assert.match(source,/monster-portrait-runtime\.test\.js/);
assert.match(source,/statusCount\(\"planned\"\)/);
assert.doesNotMatch(finalize,/plannedTargets=rows\.length-existingTargets/);

assert.match(masterFinalize,/refusing unscoped finalize/);
assert.match(masterFinalize,/--master-commit/);
assert.match(masterFinalize,/registry\.dimensions/);
assert.match(masterFinalize,/Master PNG → Runtime WebP → Provenance → Registry existing/);
assert.match(masterFinalize,/transaction rolled back/);
assert.match(masterFinalize,/tests\/monster-portrait-runtime\.test\.js/);
assert.match(masterFinalize,/scripts\/audit-monster-portraits\.mjs/);
assert.match(masterFinalize,/tests\/permanent-image-asset-pipeline\.test\.mjs/);
assert.match(generator,/registry\.dimensions/);
assert.match(generator,/sizeClass/);
assert.doesNotMatch(generator,/-resize","1024x1536"/);

assert.equal(packageJson.scripts["portrait:import"],"node scripts/import-monster-portraits.mjs");
assert.equal(packageJson.scripts["portrait:finalize-master"],"node scripts/finalize-monster-portrait-from-master.mjs");
assert.match(spec,/已生成素材快速導入/);
assert.match(permanentDoc,/count-independent/);
assert.match(permanentDoc,/sizeClass=standard/);
assert.match(permanentDoc,/sizeClass=boss/);

for(const script of [
    "scripts/import-monster-portraits.mjs",
    "scripts/finalize-monster-portrait-from-master.mjs",
    "scripts/generate-runtime-webp-from-master.mjs"
]){
    const check=spawnSync(process.execPath,["--check",script],{encoding:"utf8"});
    assert.equal(check.status,0,check.stderr||check.stdout);
}

const help=spawnSync(process.execPath,["scripts/import-monster-portraits.mjs","--help"],{encoding:"utf8"});
assert.equal(help.status,0,help.stderr||help.stdout);
assert.match(help.stdout,/Monster Portrait Fast Import/);

const masterHelp=spawnSync(process.execPath,["scripts/finalize-monster-portrait-from-master.mjs","--help"],{encoding:"utf8"});
assert.equal(masterHelp.status,0,masterHelp.stderr||masterHelp.stdout);
assert.match(masterHelp.stdout,/Monster Portrait Master Finalizer/);
assert.match(masterHelp.stdout,/registry sizeClass dimensions/);

const generatorHelp=spawnSync(process.execPath,["scripts/generate-runtime-webp-from-master.mjs","--help"],{encoding:"utf8"});
assert.equal(generatorHelp.status,0,generatorHelp.stderr||generatorHelp.stdout);
assert.match(generatorHelp.stdout,/Monster Portrait Runtime WebP Generator/);
assert.match(generatorHelp.stdout,/not hardcoded to standard portraits/);

console.log("Monster portrait import/finalize workflow tests passed.");
