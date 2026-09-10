"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const index=fs.readFileSync("index.html","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const intent=fs.readFileSync("js/20-anonymous-20.js","utf8");
const authUi=fs.readFileSync("js/firebase/firebase-auth-ui.js","utf8");
const headers=fs.readFileSync("_headers","utf8");
const abyssLiveQa=fs.readFileSync(".github/scripts/abyss-live-browser-qa-v2.mjs","utf8");
const abyssLiveQaRunner=fs.readFileSync(".github/scripts/run-abyss-live-browser-qa.mjs","utf8");
const mainCityRuntime=fs.readFileSync("js/16-stage-v54-main-city-runtime.js","utf8");
const productionBuild=fs.readFileSync("scripts/build-production.mjs","utf8");
const boot=JSON.parse(fs.readFileSync("config/boot-manifest.json","utf8"));
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));

const directScripts=[...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
const scriptTags=[...index.matchAll(/<script\b[^>]*>/g)];
const directStyles=[...index.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(directScripts,manifest.critical.scripts);
assert.deepEqual(directStyles,manifest.critical.styles);
assert.equal(directScripts.length,1);
assert.equal(scriptTags.length,directScripts.length,"index must not bypass Boot Core with inline executable scripts");
assert.equal(directStyles.length,1);
assert.match(directScripts[0],/^build\/boot-core\.[0-9a-f]{12}\.js$/);
assert.match(directStyles[0],/^build\/boot-core\.[0-9a-f]{12}\.css$/);

const forbiddenCritical=["patrol","battle","inventory","equipment","dungeon","abyss","relic","shop","synthesis","boss-tower"];
for(const name of forbiddenCritical){
    assert.ok(manifest.featureManifest.features[name],name+" must be feature-addressable");
    assert.ok(!JSON.stringify(manifest.critical).includes(manifest.featureManifest.features[name]),name+" bundle must not be a direct critical entry");
}
assert.doesNotMatch(startup,/ensure\("gameplay-core"/);
assert.match(startup,/async function resolveSaveFor\(user\)[\s\S]*?activeUser=user;[\s\S]*?startAppShell\(\);/);
const requireAuthPath=startup.slice(startup.indexOf("function requireAuth"),startup.indexOf("function fail"));
const bootPath=startup.slice(startup.indexOf("async function boot"),startup.indexOf("global.FourSymbolsStartupPolicy"));
assert.doesNotMatch(requireAuthPath,/startAppShell\(\);/,
    "the signed-out destination must not start the authenticated app shell");
assert.doesNotMatch(bootPath,/startAppShell\(\);/,
    "auth initialization itself must not start the authenticated app shell");
assert.doesNotMatch(startup,/MIN_DURATION|MAX_DURATION|12000|15000|totalDuration|runtimeReady|\*\s*90/);
assert.doesNotMatch(intent,/TOTAL_RUNTIME_MODULES|runtimeGate|createElement\(["']script["']\)/i);
assert.doesNotMatch(authUi,/先使用本機存檔|DEV_AUTH_BYPASS/i);
assert.ok(boot.maximumReadyTransitionMs<=800);
assert.match(headers,/^\/\s*\n\s+Cache-Control:\s*no-cache, no-store, must-revalidate$/m,
    "the root HTML route must always revalidate");
assert.match(headers,/^\/asset-manifest\.json\s*\n\s+Cache-Control:\s*no-cache, no-store, must-revalidate$/m,
    "the mutable asset manifest must always revalidate");
assert.match(headers,/^\/build\/\*\s*\n\s+Cache-Control:\s*public, max-age=31536000, immutable$/m,
    "content-hashed build assets must be immutable");
assert.doesNotMatch(abyssLiveQa,/v174-abyss-two-tier-style/,
    "live QA must not depend on the retired inline Abyss style owner");
assert.match(abyssLiveQa,/link\[data-feature-style=[^\]]*feature-abyss/,
    "live QA must verify the hashed feature stylesheet owner");
assert.ok((abyssLiveQa.match(/prepareAccountFirstRuntime\(client,\["abyss"\]\)/g)||[]).length>=3,
    "each live Abyss reload must re-enter through the account-first feature loader");
assert.doesNotMatch(abyssLiveQaRunner,/client\.eval\([^\n]*FourSymbolsFeatures\.ensure/,
    "the generated live QA must not call the feature loader before Boot Core exists");
assert.match(abyssLiveQaRunner,/saved player reload[\s\S]*prepareAccountFirstRuntime\(client,\["abyss"\]\)/,
    "the generated saved-player reload must wait for account-first startup before loading Abyss");
const appStyles=productionBuild.slice(productionBuild.indexOf("const appStyles="),productionBuild.indexOf("const gameplayStyles="));
assert.match(appStyles,/css\/ad-free-service-info-modal\.css/,
    "app-shell must include the ad-free modal style in its hashed stylesheet");
assert.doesNotMatch(mainCityRuntime,/createElement\(["']link["']\)|ad-free-service-info-modal\.css/,
    "app-shell runtime must not redownload bundled CSS through an unhashed URL");

const jsFiles=[];
function walk(directory){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
        const target=path.join(directory,entry.name);
        if(entry.isDirectory()){ walk(target); }
        else if(entry.name.endsWith(".js")){ jsFiles.push(target); }
    }
}
walk("js");
const scriptCreators=jsFiles.filter(file=>/createElement\(["']script["']\)/.test(fs.readFileSync(file,"utf8")));
assert.deepEqual(scriptCreators,[path.join("js","startup","feature-loader.js")],"one feature loader owns all dynamic scripts");
assert.equal(jsFiles.filter(file=>/^v131-patrol-sprite-(?:male-)?\d+\.js$/.test(path.basename(file))).length,0);
for(const file of jsFiles){
    const source=fs.readFileSync(file,"utf8");
    assert.doesNotMatch(source,/data:image\/(?:webp|png|jpeg);base64,/i,file+" embeds an image");
    assert.equal((source.match(/[A-Za-z0-9+/]{8192,}={0,2}/g)||[]).length,0,file+" contains a large Base64-like payload");
}

console.log("✓ critical boot boundary, loader ownership, real progress and sprite retirement");
