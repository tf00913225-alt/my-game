"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const indexBytes=fs.statSync("index.html").size;
const logoBytes=fs.statSync(manifest.critical.images[0]).size;
const criticalFiles=[...manifest.critical.scripts,...manifest.critical.styles];
const firebaseFiles=Object.keys(manifest.assets).filter(file=>file.startsWith("build/firebase/"));
const localCriticalBytes=criticalFiles.concat(firebaseFiles).reduce((total,file)=>total+fs.statSync(file).size,0)+indexBytes+logoBytes;

assert.ok(fs.statSync(manifest.critical.scripts[0]).size<=70_000,"boot JavaScript budget exceeded");
assert.ok(fs.statSync(manifest.critical.styles[0]).size<=250_000,"boot CSS source budget exceeded");
assert.ok(localCriticalBytes<=690_000,"signed-out local critical source budget exceeded: "+localCriticalBytes);
assert.equal(firebaseFiles.length,5,"all local Firebase lifecycle modules must be hashed and declared");
for(const bundle of Object.values(manifest.featureManifest.bundles)){
    for(const file of [...(bundle.scripts||[]),...(bundle.styles||[])]){
        assert.ok(!criticalFiles.includes(file),file+" escaped the feature boundary");
    }
}
assert.ok(Object.keys(manifest.assets).every(file=>/\.[0-9a-f]{12}\.(?:js|css|webp|png|jpe?g)$/.test(file)),"every production asset uses a content hash");

console.log("✓ critical feature request and source-byte budgets");
