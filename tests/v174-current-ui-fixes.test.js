"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");

const read=file=>fs.readFileSync(file,"utf8");
const css=read("css/57-v174-current-ui-fixes.css");
const js=read("js/62-v174-current-ui-fixes.js");
const build=read("scripts/build-production.mjs");
const template=JSON.parse(read("config/feature-manifest.json"));
const manifest=JSON.parse(read("asset-manifest.json"));
const builtManifest=read("build/asset-manifest.json");

assert.match(css,/inventoryPage[\s\S]*v169-item-art\.v169-equipment-art[\s\S]*object-fit:contain !important/);
assert.match(css,/v17361-reward-preview[\s\S]*v17361-reward-icon[\s\S]*display:none !important/);
assert.match(css,/裝備寶箱  ×2/);
assert.match(css,/allElementSkillPreviewModal[\s\S]*font-size:16px !important/);
assert.match(css,/土剋水・水剋火・火剋風・風剋土/);
assert.match(css,/team-relic-home-tools \.home-card-label[\s\S]*font-size:15\.5px !important[\s\S]*line-height:23px !important/);
assert.match(css,/v146-home-roster[\s\S]*margin-top:4px !important/);
assert.match(js,/className="gameplay-back-button v174-gameplay-home-back"/);
assert.match(js,/window\.showPage\("home"\)/);
assert.match(build,/uiFixScripts=\["js\/62-v174-current-ui-fixes\.js"\]/);
assert.match(build,/uiFixStyles=\["css\/57-v174-current-ui-fixes\.css"\]/);
assert.match(build,/__BUILD_UI_FIXES__/);
assert.match(build,/__BUILD_UI_FIXES_STYLE__/);
assert.deepEqual(template.bundles["app-shell"].scripts,["__BUILD_APP_SHELL__","__BUILD_UI_FIXES__"]);
assert.deepEqual(template.bundles["app-shell"].styles,["__BUILD_APP_SHELL_STYLE__","__BUILD_UI_FIXES_STYLE__"]);
assert.equal(read("asset-manifest.json"),builtManifest,"root/build asset manifests must stay identical");

const buildCheck=spawnSync(process.execPath,["scripts/build-production.mjs","--check"],{encoding:"utf8"});
assert.equal(buildCheck.status,0,buildCheck.stderr||buildCheck.stdout||"production build check failed");

for(const type of ["scripts","styles"]){
    const entries=manifest.featureManifest.bundles["app-shell"][type];
    assert.equal(entries.length,2,`app-shell ${type} must include the V174 patch after the existing bundle`);
    const patch=entries[1];
    assert.match(patch,/^build\/feature-ui-fixes\.[0-9a-f]{12}\.(?:js|css)$/);
    const bytes=fs.readFileSync(patch);
    const digest=crypto.createHash("sha256").update(bytes).digest("hex").slice(0,12);
    assert.ok(patch.includes(`.${digest}.`),`${patch} filename must match content hash`);
    assert.equal(manifest.assets[patch].sha256,digest);
    assert.equal(manifest.assets[patch].bytes,bytes.length);
}

const relic=fs.readFileSync("assets/ui/home-relic-v174.webp");
assert.equal(relic.subarray(0,4).toString("ascii"),"RIFF");
assert.equal(relic.subarray(8,12).toString("ascii"),"WEBP");
assert.ok(relic.length>6000,"new relic art should not be an empty/placeholder WebP");

console.log("✓ V174 current UI source/build regression checks passed");
