#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const BUILD=path.join(ROOT,"build");
const checkOnly=process.argv.includes("--check");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");
const bytes=file=>fs.readFileSync(path.join(ROOT,file));
const hash=value=>crypto.createHash("sha256").update(value).digest("hex").slice(0,12);
const slash=value=>value.split(path.sep).join("/");

const release=JSON.parse(read("release/release.json"));
const featureTemplate=JSON.parse(read("config/feature-manifest.json"));
const criticalLogoPath="assets/ui/startup-logo.4631c0bc3f2b.jpg";

const bootScripts=[
    "js/startup/support-contact.js",
    "js/startup/account-save-repository.js",
    "js/startup/feature-loader.js",
    "js/startup/startup-contract.js",
    "js/52-v173.20-startup-loader.js"
];
const appScripts=[
    "js/00-main.js",
    "js/01-stage-v8-touch-lock.js",
    "js/02-stage-v9-native-coordinate-api.js",
    "js/03-stage-v10-battle-log-scroll-runtime.js",
    "js/04-stage-v11-native-bottom-nav-runtime.js",
    "js/05-stage-v13-native-map-nav-runtime.js",
    "js/06-stage-v39-battle-map-background-runtime.js",
    "js/07-stage-v40-root-battle-background-runtime.js",
    "js/08-stage-v41-runtime.js",
    "js/09-stage-v45-runtime.js",
    "js/10-stage-v46-runtime.js",
    "js/11-stage-v47-runtime.js",
    "js/12-stage-v48-runtime.js",
    "js/13-stage-v49-runtime.js",
    "js/14-stage-v50-runtime.js",
    "js/15-stage-v51-runtime.js",
    "js/16-stage-v54-main-city-runtime.js",
    "js/17-stage-v60-training-render-guard.js",
    "js/18-stage-v64-character-touch-action-runtime.js",
    "js/19-stage-v78-character-inventory-runtime.js",
    "js/22-v124-character-creation-native-runtime.js",
    "js/23-v125-character-creation-bootstrap.js",
    "js/24-v125-character-creation-native-runtime.js",
    "js/20-anonymous-20.js",
    "js/61-v174-ui-regression-guards.js"
];
const gameplayScripts=[
    "js/25-v131-fix-batch.js",
    "js/27-v132-content-expansion.js",
    "js/28-v133-economy-rebalance.js",
    "js/29-v134-fixes.js",
    "js/30-v135-fixes.js",
    "js/31-v136-auto-battle-fix.js",
    "js/32-v139-rested-experience.js",
    "js/33-v140-four-element-balance.js",
    "js/34-v141-core-systems.js",
    "js/35-v141-ui-battle.js",
    "js/36-v141-content-systems.js",
    "js/37-v142-skill-animation.js",
    "js/38-v143-system-fixes.js",
    "js/39-v143-skill-animation.js",
    "js/40-v144-rules-and-abyss.js",
    "js/41-v146-system-polish.js",
    "js/42-v148-combat-dungeon-fixes.js",
    "js/43-v149-skill-ui-rules.js",
    "js/44-v152-dev-fixes.js",
    "js/45-v154-dev-fixes.js",
    "js/46-v155-dev-fixes.js",
    "js/47-v158-combat-tuning.js",
    "js/48-v159-abyss-battle-portraits.js",
    "js/49-v169-element-box-settings.js",
    "js/50-v169-water-skill-rules.js",
    "js/51-v169-rpg-ui.js",
    "js/equipment-progression.js",
    "js/53-v173.50-inventory-qol.js",
    "js/54-v173.51-battle-qa.js",
    "js/55-v173.51-inventory-qa.js",
    "js/56-v173.51-shop-qa.js",
    "js/57-v173.51-quest-qa.js",
    "js/58-v173.63-functional-fixes.js"
];
const patrolScripts=["js/26-v131-patrol-appearance.js"];
const abyssScripts=["js/59-abyss-two-tier-runtime.js"];
const skillScripts=["js/60-v173.64-skill-progression-rebalance.js"];
const bossRelicScripts=["js/gameplay-boss-tower-system.js","js/60-team-relic-system.js"];
const relicProgressionScripts=["js/relic-progression-drop-system.js"];

const criticalStyles=["css/00-main.css","css/29-v125-character-creation-native.css","css/51-v173.20-startup-loader.css","css/firebase-auth.css"];
const appStyles=[
    "css/01-stage-v8-map-page-fix.css","css/02-stage-v3-layout-fix.css","css/03-stage-v4-viewport-lock.css",
    "css/04-v119-ally-target-style.css","css/06-stage-v11-native-bottom-nav.css","css/07-stage-v13-native-map-nav.css",
    "css/08-stage-v14-character-scroll-fix.css","css/09-stage-v15-native-character-shell.css",
    "css/19-stage-v54-main-city-moderate-native-scale.css","css/20-stage-v60-training-only-safety.css",
    "css/21-stage-v64-character-touch-action-bridge.css","css/28-v124-character-creation-native.css",
    "css/30-v130-requested-updates.css","css/56-v174-critical-ui-regressions.css","css/ad-free-service-info-modal.css"
];
const gameplayStyles=[
    "css/05-stage-v10-battle-log-scroll-fix.css",
    "css/10-stage-v40-root-battle-background-and-cast-size.css",
    "css/11-stage-v41-cast-text-and-player-alpha.css",
    "css/12-stage-v45-battle-black-overlay-skill-text.css",
    "css/13-stage-v46-battle-frame-and-giant-skill-text.css",
    "css/14-stage-v47-root-cause-skill-size.css",
    "css/15-stage-v48-skill-text-final.css",
    "css/16-stage-v49-remove-all-skill-white-strokes.css",
    "css/17-stage-v50-remove-battle-right-edge.css",
    "css/18-stage-v51-combat-result-white-stroke.css",
    "css/22-stage-v78-character-inventory-core.css",
    "css/23-stage-v77-inventory-detail-ui.css",
    "css/24-stage-v85-inventory-inner-grid-scroll-root.css",
    "css/25-stage-v90-quest-interface-core.css","css/26-v110-auto-settings-premium.css",
    "css/31-v131-fix-batch.css",
    "css/33-v132-content-expansion.css",
    "css/34-v133-economy-rebalance.css",
    "css/35-v134-fixes.css",
    "css/36-v135-fixes.css",
    "css/37-v139-rested-experience.css",
    "css/38-v141-system-expansion.css",
    "css/39-v142-skill-animation.css",
    "css/40-v143-combat-dungeon-polish.css",
    "css/41-v144-rules-and-abyss.css",
    "css/42-v146-system-polish.css",
    "css/43-v148-combat-dungeon-fixes.css",
    "css/44-v149-skill-ui-rules.css",
    "css/45-v152-dev-fixes.css",
    "css/46-v154-dev-fixes.css",
    "css/47-v158-combat-tuning.css",
    "css/48-v169-element-box-settings.css",
    "css/49-v169-rpg-ui.css",
    "css/52-v173.50-inventory-qol.css",
    "css/53-v173.51-qa.css"
];
const patrolStyles=["css/32-v131-patrol-appearance.css"];
const abyssStyles=["css/50-v169-abyss-flow.css","css/54-v174-abyss-two-tier.css"];
const bossRelicStyles=["css/gameplay-boss-tower.css","css/55-team-relic-system.css"];
const relicProgressionStyles=["css/relic-progression-drop-system.css"];

function combineScripts(files,prefix=""){
    return prefix+files.map(file=>`\n/* bundled source: ${file} */\n${read(file).trim()}\n`).join("\n");
}
function combineStyles(files){
    return files.map(file=>`\n/* bundled source: ${file} */\n${read(file).trim()}\n`).join("\n");
}
function target(name,extension,content){
    const digest=hash(content); return {content,digest,path:`build/${name}.${digest}.${extension}`};
}
function writeTarget(output){
    const absolute=path.join(ROOT,output.path); fs.mkdirSync(path.dirname(absolute),{recursive:true});
    if(!checkOnly){ fs.writeFileSync(absolute,output.content); }
    return output.path;
}
function rewriteImports(source,mapping){
    return source.replace(/(from\s*["'])\.\/([^"']+)(["'])/g,(all,start,name,end)=>{
        const output=mapping[name]; if(!output){ throw new Error(`Missing Firebase dependency mapping for ${name}`); }
        return `${start}./${path.basename(output)}${end}`;
    });
}
function firebaseModule(source,mapping){
    const content=rewriteImports(read(`js/firebase/${source}`),mapping);
    const output=target(path.basename(source,".js"),"js",content);
    output.path=`build/firebase/${path.basename(output.path)}`;
    writeTarget(output); return output;
}

if(!checkOnly){
    fs.mkdirSync(BUILD,{recursive:true});
    for(const file of fs.readdirSync(BUILD)){
        if(/^(?:boot-core|app-shell|gameplay-core|feature-|asset-manifest\.)/.test(file)){
            fs.rmSync(path.join(BUILD,file),{recursive:true,force:true});
        }
    }
    fs.mkdirSync(path.join(BUILD,"firebase"),{recursive:true});
    for(const file of fs.readdirSync(path.join(BUILD,"firebase"))){ fs.rmSync(path.join(BUILD,"firebase",file)); }
}

const firebaseMap={};
const firebaseOutputs=[];
for(const name of ["firebase-config.js","firebase-auth.js","firebase-cloud-save.js","firebase-auth-ui.js","firebase-bootstrap.js"]){
    const module=firebaseModule(name,firebaseMap); firebaseMap[name]=module.path; firebaseOutputs.push(module);
}

const scriptOutputs={
    app:target("app-shell","js",combineScripts(appScripts)),
    gameplay:target("gameplay-core","js",combineScripts(gameplayScripts)),
    patrol:target("feature-patrol","js",combineScripts(patrolScripts)),
    abyss:target("feature-abyss","js",combineScripts(abyssScripts)),
    skill:target("feature-skill","js",combineScripts(skillScripts)),
    bossRelic:target("feature-boss-relic","js",combineScripts(bossRelicScripts)),
    relicProgression:target("feature-relic-progression","js",read(relicProgressionScripts[0]))
};
const styleOutputs={
    critical:target("boot-core","css",combineStyles(criticalStyles)),
    app:target("app-shell","css",combineStyles(appStyles)),
    gameplay:target("gameplay-core","css",combineStyles(gameplayStyles)),
    patrol:target("feature-patrol","css",combineStyles(patrolStyles)),
    abyss:target("feature-abyss","css",combineStyles(abyssStyles)),
    bossRelic:target("feature-boss-relic","css",combineStyles(bossRelicStyles)),
    relicProgression:target("feature-relic-progression","css",read(relicProgressionStyles[0]))
};
Object.values(scriptOutputs).forEach(writeTarget); Object.values(styleOutputs).forEach(writeTarget);

const patrolAssets=fs.readdirSync(path.join(ROOT,"assets/characters/patrol"))
    .filter(name=>/\.[0-9a-f]{12}\.webp$/.test(name)).sort().map(name=>`assets/characters/patrol/${name}`);
const replacements={
    __BUILD_APP_SHELL__:scriptOutputs.app.path,__BUILD_APP_SHELL_STYLE__:styleOutputs.app.path,
    __BUILD_GAMEPLAY_CORE__:scriptOutputs.gameplay.path,__BUILD_GAMEPLAY_CORE_STYLE__:styleOutputs.gameplay.path,
    __BUILD_PATROL__:scriptOutputs.patrol.path,__BUILD_PATROL_STYLE__:styleOutputs.patrol.path,
    __BUILD_ABYSS__:scriptOutputs.abyss.path,__BUILD_ABYSS_STYLE__:styleOutputs.abyss.path,
    __BUILD_SKILL__:scriptOutputs.skill.path,
    __BUILD_BOSS_RELIC__:scriptOutputs.bossRelic.path,__BUILD_BOSS_RELIC_STYLE__:styleOutputs.bossRelic.path,
    __BUILD_RELIC_PROGRESSION__:scriptOutputs.relicProgression.path,__BUILD_RELIC_PROGRESSION_STYLE__:styleOutputs.relicProgression.path
};
const featureManifest=JSON.parse(JSON.stringify(featureTemplate).replace(/__PATROL_ASSETS__/g,patrolAssets.join('\",\"')).replace(/__[A-Z0-9_]+__/g,key=>{
    if(!replacements[key]){ throw new Error(`Unresolved feature manifest token ${key}`); }
    return replacements[key];
}));

const bootPrefix=`window.__FOUR_SYMBOLS_BUILD__=Object.freeze(${JSON.stringify({
    release:release.version,
    firebaseBootstrap:firebaseMap["firebase-bootstrap.js"]
})});\n`;
const bootOutput=target("boot-core","js",combineScripts(bootScripts,bootPrefix));
writeTarget(bootOutput);

const criticalLogo={path:criticalLogoPath,content:bytes(criticalLogoPath),digest:hash(bytes(criticalLogoPath))};
if(!criticalLogoPath.includes(`.${criticalLogo.digest}.`)){ throw new Error("Critical logo filename is not content-addressed."); }
const declared=[bootOutput,...Object.values(scriptOutputs),...Object.values(styleOutputs),...firebaseOutputs,criticalLogo];
const assetManifest={
    schemaVersion:1,release:release.version,generatedAt:"deterministic",
    critical:{scripts:[bootOutput.path],styles:[styleOutputs.critical.path],images:[criticalLogoPath],firebaseBootstrap:firebaseMap["firebase-bootstrap.js"]},
    featureManifest,
    assets:Object.fromEntries(declared.map(item=>[item.path,{sha256:item.digest,bytes:Buffer.byteLength(item.content)}]))
};
const manifestContent=JSON.stringify(assetManifest,null,2)+"\n";
const manifestOutput=target("asset-manifest","json",manifestContent);
if(!checkOnly){
    fs.writeFileSync(path.join(ROOT,"asset-manifest.json"),manifestContent);
    fs.writeFileSync(path.join(ROOT,"build/asset-manifest.json"),manifestContent);
}

function normalizedIndex(source){
    const styleBlock=`<!-- build:critical-style -->\n<link id="boot-core-style" data-critical-style="true" rel="stylesheet" href="${styleOutputs.critical.path}">\n<!-- /build:critical-style -->`;
    const scriptBlock=`<!-- build:critical-script -->\n<script id="boot-core-runtime" src="${bootOutput.path}"></script>\n<!-- /build:critical-script -->`;
    if(source.includes("<!-- build:critical-style -->")){
        source=source.replace(/<!-- build:critical-style -->[\s\S]*?<!-- \/build:critical-style -->/,styleBlock);
        source=source.replace(/<!-- build:critical-script -->[\s\S]*?<!-- \/build:critical-script -->/,scriptBlock);
    }else{
        source=source.replace(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>\s*/gi,"");
        source=source.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>\s*/gi,"");
        source=source.replace("</head>",styleBlock+"\n</head>");
        source=source.replace("</body>",scriptBlock+"\n</body>");
    }
    source=source.replace(/<img\b[^>]*>/gi,tag=>{
        if(/startup-logo-image/.test(tag)){
            return /fetchpriority=/.test(tag)?tag:tag.replace(/>$/,' fetchpriority="high">');
        }
        let value=tag;
        if(!/\bloading=/.test(value)){ value=value.replace(/>$/,' loading="lazy">'); }
        if(!/\bdecoding=/.test(value)){ value=value.replace(/>$/,' decoding="async">'); }
        return value;
    });
    return source;
}
const nextIndex=normalizedIndex(read("index.html"));
if(checkOnly){
    if(nextIndex!==read("index.html")){ throw new Error("Production build output is stale; run npm run build."); }
    const existing=JSON.parse(read("asset-manifest.json"));
    if(JSON.stringify(existing)!==JSON.stringify(assetManifest)){ throw new Error("asset-manifest.json is stale."); }
    for(const output of declared){
        const absolute=path.join(ROOT,output.path);
        if(!fs.existsSync(absolute)||hash(bytes(slash(output.path)))!==output.digest){ throw new Error(`Stale build asset: ${output.path}`); }
    }
}else{
    fs.writeFileSync(path.join(ROOT,"index.html"),nextIndex);
    console.log(`Built ${bootOutput.path} and ${Object.keys(featureManifest.bundles).length} feature bundles.`);
}
