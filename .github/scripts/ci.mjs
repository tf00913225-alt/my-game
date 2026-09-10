#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const SCRIPT_PATH=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(SCRIPT_PATH),"../..");
const TEXT_EXTENSIONS=new Set([
    ".cjs",".css",".html",".js",".json",".md",".mjs",".sh",".txt",".yaml",".yml"
]);
const PROJECT_JS_EXTENSIONS=new Set([".js",".cjs",".mjs"]);
const RESOURCE_EXTENSIONS="png|jpe?g|webp|gif|svg|avif|ico|css|js|mjs|cjs|woff2?|ttf|otf|mp3|wav|ogg";
const RESOURCE_PATH_RE=new RegExp(
    "(?:\\.\\./|\\./|\\b)(?:assets|css|js)/[A-Za-z0-9_./\\-\\u0080-\\uFFFF ]+?\\.(?:"+
    RESOURCE_EXTENSIONS+
    ")(?:\\?[^\\s'\\\"`<>)]*)?(?:#[^\\s'\\\"`<>)]*)?",
    "gi"
);

process.chdir(ROOT);

function fail(message){
    console.error("\nCI check failed: "+message);
    process.exitCode=1;
}

function relative(file){
    return path.relative(ROOT,file).split(path.sep).join("/")||".";
}

function walk(directory,predicate=()=>true){
    const absolute=path.resolve(ROOT,directory);
    if(!fs.existsSync(absolute)){ return []; }
    const files=[];
    const visit=current=>{
        for(const entry of fs.readdirSync(current,{withFileTypes:true})){
            if(entry.name===".git" || entry.name==="node_modules"){ continue; }
            const target=path.join(current,entry.name);
            if(entry.isDirectory()){ visit(target); }
            else if(entry.isFile() && predicate(target)){ files.push(target); }
        }
    };
    visit(absolute);
    return files.sort((a,b)=>relative(a).localeCompare(relative(b),"en"));
}

function lineAt(source,index){
    let line=1;
    for(let i=0;i<index;i++){ if(source.charCodeAt(i)===10){ line++; } }
    return line;
}

function commandResult(command,args,options={}){
    return spawnSync(command,args,{
        cwd:ROOT,
        encoding:"utf8",
        maxBuffer:64*1024*1024,
        ...options
    });
}

function renderProcessFailure(result){
    const output=[result.stdout,result.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
    if(output){ console.error(output); }
    if(result.error){ console.error(result.error.message); }
}

function stripHtmlComments(source){
    return source.replace(/<!--[\s\S]*?-->/g,comment=>comment.replace(/[^\n]/g," "));
}

function stripCssComments(source){
    return source.replace(/\/\*[\s\S]*?\*\//g,comment=>comment.replace(/[^\n]/g," "));
}

function readQuoted(source,start,quote){
    let value="";
    let index=start+1;
    while(index<source.length){
        const character=source[index];
        if(character==="\\"){
            if(index+1<source.length){
                value+=source[index+1];
                index+=2;
                continue;
            }
            index++;
            continue;
        }
        if(character===quote){
            return {end:index+1,value};
        }
        value+=character;
        index++;
    }
    return {end:source.length,value};
}

function looksLikeRegexStart(source,start){
    let index=start-1;
    while(index>=0 && /\s/.test(source[index])){ index--; }
    if(index<0){ return true; }
    if(/[([{=,:;!?&|+\-*%^~<>]/.test(source[index])){ return true; }
    const prefix=source.slice(0,index+1).match(/([A-Za-z_$][\w$]*)$/)?.[1]||"";
    return /^(?:await|case|delete|do|else|in|instanceof|new|of|return|throw|typeof|void|yield)$/.test(prefix);
}

function skipRegexLiteral(source,start){
    let index=start+1;
    let inClass=false;
    while(index<source.length){
        const character=source[index];
        if(character==="\\"){ index+=2; continue; }
        if(character==="\n" || character==="\r"){ return start+1; }
        if(character==="["){ inClass=true; index++; continue; }
        if(character==="]" && inClass){ inClass=false; index++; continue; }
        if(character==="/" && !inClass){
            index++;
            while(index<source.length && /[A-Za-z]/.test(source[index])){ index++; }
            return index;
        }
        index++;
    }
    return start+1;
}

function skipTemplate(source,start){
    let index=start+1;
    while(index<source.length){
        const character=source[index];
        if(character==="\\"){ index+=2; continue; }
        if(character==="`"){ return index+1; }
        if(character==="$" && source[index+1]==="{"){
            index=skipExpression(source,index+2);
            continue;
        }
        index++;
    }
    return source.length;
}

function skipExpression(source,start){
    let depth=1;
    let index=start;
    while(index<source.length && depth>0){
        const character=source[index];
        const next=source[index+1];
        if(character==="'" || character==='"'){
            index=readQuoted(source,index,character).end;
            continue;
        }
        if(character==="`"){
            index=skipTemplate(source,index);
            continue;
        }
        if(character==="/" && next==="/"){
            index+=2;
            while(index<source.length && source[index]!=="\n"){ index++; }
            continue;
        }
        if(character==="/" && next==="*"){
            index+=2;
            while(index<source.length && !(source[index]==="*" && source[index+1]==="/")){ index++; }
            index=Math.min(source.length,index+2);
            continue;
        }
        if(character==="/" && looksLikeRegexStart(source,index)){
            index=skipRegexLiteral(source,index);
            continue;
        }
        if(character==="{"){ depth++; }
        else if(character==="}"){ depth--; }
        index++;
    }
    return index;
}

function readTemplateSegments(source,start){
    const segments=[];
    const expressions=[];
    let index=start+1;
    let segmentStart=index;
    let value="";
    const pushSegment=()=>{
        if(value){ segments.push({index:segmentStart,value}); }
        value="";
    };

    while(index<source.length){
        const character=source[index];
        if(character==="\\"){
            if(index+1<source.length){ value+=source[index+1]; index+=2; continue; }
            index++;
            continue;
        }
        if(character==="`"){
            pushSegment();
            return {end:index+1,expressions,segments};
        }
        if(character==="$" && source[index+1]==="{"){
            pushSegment();
            const expressionStart=index+2;
            const end=skipExpression(source,expressionStart);
            expressions.push({end:Math.max(expressionStart,end-1),start:expressionStart});
            index=end;
            segmentStart=index;
            continue;
        }
        value+=character;
        index++;
    }
    pushSegment();
    return {end:source.length,expressions,segments};
}

function extractJsStringLiterals(source){
    const literals=[];
    let index=0;
    while(index<source.length){
        const character=source[index];
        const next=source[index+1];
        if(character==="/" && next==="/"){
            index+=2;
            while(index<source.length && source[index]!=="\n"){ index++; }
            continue;
        }
        if(character==="/" && next==="*"){
            index+=2;
            while(index<source.length && !(source[index]==="*" && source[index+1]==="/")){ index++; }
            index=Math.min(source.length,index+2);
            continue;
        }
        if(character==="/" && looksLikeRegexStart(source,index)){
            index=skipRegexLiteral(source,index);
            continue;
        }
        if(character==="'" || character==='"'){
            const parsed=readQuoted(source,index,character);
            literals.push({index,line:lineAt(source,index),value:parsed.value});
            index=parsed.end;
            continue;
        }
        if(character==="`"){
            const parsed=readTemplateSegments(source,index);
            for(const segment of parsed.segments){
                literals.push({index:segment.index,line:lineAt(source,segment.index),value:segment.value});
            }
            for(const expression of parsed.expressions){
                const nestedSource=source.slice(expression.start,expression.end);
                for(const literal of extractJsStringLiterals(nestedSource)){
                    const literalIndex=expression.start+literal.index;
                    literals.push({index:literalIndex,line:lineAt(source,literalIndex),value:literal.value});
                }
            }
            index=parsed.end;
            continue;
        }
        index++;
    }
    return literals;
}

function extractResourcePaths(value){
    const paths=[];
    RESOURCE_PATH_RE.lastIndex=0;
    for(const match of value.matchAll(RESOURCE_PATH_RE)){
        paths.push({index:match.index||0,raw:match[0]});
    }
    return paths;
}

function isExternalReference(reference){
    return !reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference);
}

function cleanReference(reference){
    const trimmed=reference.trim();
    const query=trimmed.indexOf("?");
    const hash=trimmed.indexOf("#");
    const cut=[query,hash].filter(index=>index>=0).sort((a,b)=>a-b)[0];
    return (cut===undefined ? trimmed : trimmed.slice(0,cut)).replace(/\\([() ])/g,"$1");
}

function resolveReference(reference,sourceFile,mode){
    const clean=cleanReference(reference);
    if(isExternalReference(clean)){ return null; }
    let decoded=clean;
    try{ decoded=decodeURIComponent(clean); }catch(_){ }
    let target;
    if(decoded.startsWith("/")){
        target=path.resolve(ROOT,"."+decoded);
    }else if(mode==="css"){
        target=path.resolve(path.dirname(sourceFile),decoded);
    }else{
        target=path.resolve(ROOT,decoded.replace(/^\.\//,""));
    }
    const back=path.relative(ROOT,target);
    if(back===".." || back.startsWith(".."+path.sep) || path.isAbsolute(back)){
        return {escaped:true,target};
    }
    return {escaped:false,target};
}

function recordReference(errors,checked,sourceFile,line,raw,mode){
    const resolved=resolveReference(raw,sourceFile,mode);
    if(!resolved){ return; }
    checked.add(relative(resolved.target));
    if(resolved.escaped){
        errors.push(`${relative(sourceFile)}:${line}: path escapes repository: ${raw}`);
        return;
    }
    if(!fs.existsSync(resolved.target)){
        errors.push(`${relative(sourceFile)}:${line}: missing local resource ${raw} -> ${relative(resolved.target)}`);
        return;
    }
    if(!fs.statSync(resolved.target).isFile()){
        errors.push(`${relative(sourceFile)}:${line}: local resource is not a file: ${raw}`);
    }
}

function checkSyntax(){
    const files=[...walk("js",file=>PROJECT_JS_EXTENSIONS.has(path.extname(file))),
        ...walk("tests",file=>PROJECT_JS_EXTENSIONS.has(path.extname(file)))]
        .sort((a,b)=>relative(a).localeCompare(relative(b),"en"));
    const failures=[];
    for(const file of files){
        const result=commandResult(process.execPath,["--check",relative(file)]);
        if(result.status!==0){ failures.push({file,result}); }
    }
    if(failures.length){
        for(const failure of failures){
            console.error(`\nJavaScript syntax failed: ${relative(failure.file)}`);
            renderProcessFailure(failure.result);
        }
        fail(`${files.length-failures.length}/${files.length} JavaScript files passed syntax checks.`);
        return;
    }
    console.log(`✓ JavaScript syntax: ${files.length}/${files.length} files passed (js/ and tests/).`);
}

function checkTests(){
    const allTestJs=walk("tests",file=>PROJECT_JS_EXTENSIONS.has(path.extname(file)));
    const suites=allTestJs.filter(file=>/\.test\.(?:js|cjs|mjs)$/.test(file));
    const allowedNonSuites=new Set(["tests/v138-browser-smoke.js"]);
    const unclassified=allTestJs
        .map(relative)
        .filter(file=>!allowedNonSuites.has(file) && !/\.test\.(?:js|cjs|mjs)$/.test(file));
    if(unclassified.length){
        fail("Unclassified JavaScript under tests/ could be an undiscovered test:\n"+unclassified.map(file=>"  - "+file).join("\n"));
        return;
    }

    const identify=commandResult("identify",["-version"]);
    if(identify.error || identify.status!==0){
        renderProcessFailure(identify);
        fail("ImageMagick 'identify' is required by the existing asset test suites but is unavailable.");
        return;
    }

    let passed=0;
    for(const file of suites){
        const name=relative(file);
        const result=commandResult(process.execPath,[name]);
        if(result.status!==0){
            console.error(`\nNode test suite failed: ${name}`);
            renderProcessFailure(result);
            fail(`${passed}/${suites.length} Node test suites passed.`);
            return;
        }
        passed++;
        console.log(`✓ ${name}`);
    }
    console.log(`✓ Node tests: ${passed}/${suites.length} suites passed.`);
    console.log("ℹ Browser smoke was not run or counted: tests/v138-browser-smoke.js requires Playwright and Chromium.");
}

function checkResources(){
    const errors=[];
    const checked=new Set();
    const htmlFiles=walk(".",file=>path.extname(file)===".html");
    const cssFiles=walk("css",file=>path.extname(file)===".css");
    const jsFiles=walk("js",file=>PROJECT_JS_EXTENSIONS.has(path.extname(file)) &&
        !/^v131-patrol-sprite-(?:male-)?\d+\.js$/.test(path.basename(file)));

    for(const file of htmlFiles){
        const source=stripHtmlComments(fs.readFileSync(file,"utf8"));
        const attributeRe=/\b(src|href|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
        for(const match of source.matchAll(attributeRe)){
            const value=match[2]??match[3]??match[4]??"";
            const values=match[1].toLowerCase()==="srcset"
                ? value.split(",").map(part=>part.trim().split(/\s+/)[0])
                : [value];
            for(const raw of values){ recordReference(errors,checked,file,lineAt(source,match.index||0),raw,"document"); }
        }
        const urlRe=/url\(\s*(?:(["'])(.*?)\1|([^)'"\s]+))\s*\)/gi;
        for(const match of source.matchAll(urlRe)){
            recordReference(errors,checked,file,lineAt(source,match.index||0),match[2]??match[3]??"","document");
        }
    }

    for(const file of cssFiles){
        const source=stripCssComments(fs.readFileSync(file,"utf8"));
        const urlRe=/url\(\s*(?:(["'])(.*?)\1|([^)'"\s]+))\s*\)/gi;
        for(const match of source.matchAll(urlRe)){
            recordReference(errors,checked,file,lineAt(source,match.index||0),match[2]??match[3]??"","css");
        }
        const importRe=/@import\s+(?:"([^"]+)"|'([^']+)')/gi;
        for(const match of source.matchAll(importRe)){
            recordReference(errors,checked,file,lineAt(source,match.index||0),match[1]??match[2]??"","css");
        }
    }

    for(const file of jsFiles){
        const source=fs.readFileSync(file,"utf8");
        for(const literal of extractJsStringLiterals(source)){
            for(const found of extractResourcePaths(literal.value)){
                const line=literal.line+(literal.value.slice(0,found.index).match(/\n/g)||[]).length;
                recordReference(errors,checked,file,line,found.raw,"document");
            }
        }
    }

    const genders=["female","male"];
    const elements=["earth","fire","water","wind"];
    const dynamic=[];
    for(const gender of genders){
        for(const element of elements){
            dynamic.push({source:"js/00-main.js",line:4134,raw:`assets/characters/${gender}_${element}.jpg`});
            dynamic.push({source:"js/00-main.js",line:4159,raw:`assets/characters/battle_${gender}_${element}.png`});
        }
    }
    for(const element of elements){
        dynamic.push({source:"js/27-v132-content-expansion.js",line:195,raw:`assets/items/tickets/${element}.png`});
    }
    for(const candidate of dynamic){
        recordReference(errors,checked,path.join(ROOT,candidate.source),candidate.line,candidate.raw,"document");
    }

    if(errors.length){
        console.error(errors.map(error=>"  - "+error).join("\n"));
        fail(`${errors.length} local resource reference(s) are invalid.`);
        return;
    }
    console.log(`✓ Static resources: ${checked.size} unique local targets exist.`);
    console.log(`  Scanned ${htmlFiles.length} HTML, ${cssFiles.length} CSS and ${jsFiles.length} non-embedded JavaScript files.`);
}

function checkHtmlIds(){
    const htmlFiles=walk(".",file=>path.extname(file)===".html");
    const failures=[];
    let total=0;
    for(const file of htmlFiles){
        let source=stripHtmlComments(fs.readFileSync(file,"utf8"));
        source=source.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi,(whole,open,close)=>
            open+whole.slice(open.length,whole.length-close.length).replace(/[^\n]/g," ")+close
        );
        source=source.replace(/(<style\b[^>]*>)[\s\S]*?(<\/style\s*>)/gi,(whole,open,close)=>
            open+whole.slice(open.length,whole.length-close.length).replace(/[^\n]/g," ")+close
        );
        const ids=new Map();
        const idRe=/(?:^|[\s<])id\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/gim;
        for(const match of source.matchAll(idRe)){
            const id=match[1]??match[2]??match[3];
            const lines=ids.get(id)||[];
            lines.push(lineAt(source,match.index||0));
            ids.set(id,lines);
            total++;
        }
        for(const [id,lines] of ids){
            if(lines.length>1){ failures.push(`${relative(file)}: duplicate id "${id}" at lines ${lines.join(", ")}`); }
        }
    }
    if(failures.length){
        console.error(failures.map(error=>"  - "+error).join("\n"));
        fail(`${failures.length} duplicate HTML ID group(s) found.`);
        return;
    }
    console.log(`✓ HTML IDs: ${total} static IDs are unique across ${htmlFiles.length} HTML file(s).`);
}

function escapeRegExp(value){
    return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function checkLoader(){
    const indexFile=path.join(ROOT,"index.html");
    const loaderFile=path.join(ROOT,"js/20-anonymous-20.js");
    const indexSource=fs.readFileSync(indexFile,"utf8");
    const loaderSource=fs.readFileSync(loaderFile,"utf8");
    const errors=[];
    const buildCheck=commandResult(process.execPath,["scripts/build-production.mjs","--check"]);
    if(buildCheck.status!==0){
        renderProcessFailure(buildCheck);
        errors.push("Production build outputs are stale or non-deterministic.");
    }
    let manifest;
    try{ manifest=JSON.parse(fs.readFileSync(path.join(ROOT,"asset-manifest.json"),"utf8")); }
    catch(error){ errors.push(`asset-manifest.json is invalid: ${error.message}`); manifest={critical:{scripts:[],styles:[]},featureManifest:{bundles:{},features:{}},assets:{}}; }

    const localAttributes=(tag,attribute)=>Array.from(indexSource.matchAll(new RegExp(`<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'=<>]+))[^>]*>`,"gi")),match=>cleanReference(match[1]??match[2]??match[3])).filter(value=>!isExternalReference(value));
    const directScripts=localAttributes("script","src");
    const directStyles=Array.from(indexSource.matchAll(/<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))[^>]*>/gi),match=>cleanReference(match[1]??match[2]??match[3])).filter(value=>!isExternalReference(value));
    if(JSON.stringify(directScripts)!==JSON.stringify(manifest.critical?.scripts||[])){ errors.push("index.html scripts do not exactly match asset-manifest critical scripts."); }
    if(JSON.stringify(directStyles)!==JSON.stringify(manifest.critical?.styles||[])){ errors.push("index.html styles do not exactly match asset-manifest critical styles."); }
    if(directScripts.length!==1 || directStyles.length!==1){ errors.push(`Critical HTML must contain one JavaScript and one stylesheet; found ${directScripts.length}/${directStyles.length}.`); }

    const digest=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0,12);
    for(const [resource,metadata] of Object.entries(manifest.assets||{})){
        const target=path.join(ROOT,resource);
        if(!/\.[0-9a-f]{12}\.(?:js|css|webp|png|jpe?g)$/.test(resource)){ errors.push(`Build asset is not content hashed: ${resource}`); continue; }
        if(!fs.existsSync(target)){ errors.push(`Manifest build asset is missing: ${resource}`); continue; }
        const actualDigest=digest(target);
        const actualBytes=fs.statSync(target).size;
        if(actualDigest!==metadata.sha256 || !resource.includes(`.${actualDigest}.`)){ errors.push(`Build asset hash mismatch: ${resource}`); }
        if(actualBytes!==metadata.bytes){ errors.push(`Build asset byte count mismatch: ${resource}`); }
    }
    const referenced=new Set([...(manifest.critical?.scripts||[]),...(manifest.critical?.styles||[]),...(manifest.critical?.images||[]),manifest.critical?.firebaseBootstrap]);
    for(const bundle of Object.values(manifest.featureManifest?.bundles||{})){
        for(const resource of [...(bundle.scripts||[]),...(bundle.styles||[])]){ referenced.add(resource); }
    }
    for(const resource of referenced){ if(resource&&!manifest.assets?.[resource]){ errors.push(`Manifest reference is undeclared: ${resource}`); } }

    const criticalText=JSON.stringify(manifest.critical||{});
    for(const name of ["patrol","battle","inventory","equipment","dungeon","abyss","relic","shop","synthesis","boss-tower"]){
        const bundle=manifest.featureManifest?.features?.[name];
        if(!bundle){ errors.push(`Non-critical feature has no feature mapping: ${name}`); }
        else if(criticalText.includes(bundle)){ errors.push(`Non-critical feature escaped into Critical Boot: ${name}`); }
    }
    const scriptCreators=walk("js",file=>path.extname(file)===".js" && /createElement\(["']script["']\)/.test(fs.readFileSync(file,"utf8"))).map(relative);
    if(JSON.stringify(scriptCreators)!==JSON.stringify(["js/startup/feature-loader.js"])){ errors.push(`Dynamic script ownership escaped FeatureLoader: ${scriptCreators.join(", ")||"none"}`); }
    const startupSource=fs.readFileSync(path.join(ROOT,"js/52-v173.20-startup-loader.js"),"utf8");
    const intentSource=fs.readFileSync(path.join(ROOT,"js/20-anonymous-20.js"),"utf8");
    const authUiSource=fs.readFileSync(path.join(ROOT,"js/firebase/firebase-auth-ui.js"),"utf8");
    if(/MIN_DURATION|MAX_DURATION|12000|15000|totalDuration|runtimeReady|\*\s*90/.test(startupSource)){ errors.push("Startup contains an artificial or legacy full-runtime gate."); }
    if(/TOTAL_RUNTIME_MODULES|runtimeGate/i.test(intentSource)){ errors.push("Application intent owner still contains the global runtime gate."); }
    if(/先使用本機存檔|DEV_AUTH_BYPASS/i.test(authUiSource)){ errors.push("Production account UI exposes an unauthenticated local-save bypass."); }
    if(fs.existsSync(path.join(ROOT,"js")) && walk("js",file=>/^v131-patrol-sprite-(?:male-)?\d+\.js$/.test(path.basename(file))).length){ errors.push("Retired patrol Base64 chunks returned."); }
    for(const file of walk("js",file=>path.extname(file)===".js")){
        const source=fs.readFileSync(file,"utf8");
        if(/data:image\/(?:webp|png|jpeg);base64,/i.test(source)||(source.match(/[A-Za-z0-9+/]{8192,}={0,2}/g)||[]).length){ errors.push(`Large image/Base64 payload is embedded in ${relative(file)}.`); }
    }

    if(errors.length){
        console.error(errors.map(error=>"  - "+error).join("\n"));
        fail(`${errors.length} production boot/build integrity problem(s) found.`);
        return;
    }
    console.log(`✓ Production build is deterministic and all ${Object.keys(manifest.assets).length} build assets match their content hashes.`);
    console.log("✓ Critical Boot contains exactly one hashed script and one hashed stylesheet; gameplay features stay non-critical.");
    console.log("✓ FeatureLoader is the sole dynamic script owner; no artificial gate, local auth bypass or Base64 patrol chunks remain.");
}

function gitFiles(includeUntracked=false){
    const args=["ls-files","-z"];
    if(includeUntracked){ args.push("--cached","--others","--exclude-standard"); }
    const result=commandResult("git",args);
    if(result.status!==0){
        renderProcessFailure(result);
        throw new Error("Unable to enumerate repository files with git ls-files.");
    }
    return result.stdout.split("\0").filter(Boolean).map(file=>path.resolve(ROOT,file));
}

function checkConflictMarkers(){
    const failures=[];
    for(const file of gitFiles(true)){
        // A dirty-tree build may legitimately replace a tracked content-hash
        // artifact before the deletion is staged. Deleted paths have no text
        // to inspect and must not turn the whitespace gate into ENOENT.
        if(!fs.existsSync(file)){ continue; }
        if(!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())){ continue; }
        const source=fs.readFileSync(file,"utf8");
        const lines=source.split(/\r?\n/);
        lines.forEach((line,index)=>{
            if(/^<{7}(?: |$)/.test(line) || /^>{7}(?: |$)/.test(line)){
                failures.push(`${relative(file)}:${index+1}: ${line}`);
            }
        });
    }
    return failures;
}

function checkUntrackedWhitespace(){
    const result=commandResult("git",["ls-files","-z","--others","--exclude-standard"]);
    if(result.status!==0){ renderProcessFailure(result); return ["Unable to enumerate untracked files."]; }
    const failures=[];
    for(const name of result.stdout.split("\0").filter(Boolean)){
        const file=path.resolve(ROOT,name);
        if(!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())){ continue; }
        const lines=fs.readFileSync(file,"utf8").split(/\r?\n/);
        lines.forEach((line,index)=>{
            if(/[ \t]+$/.test(line)){ failures.push(`${name}:${index+1}: trailing whitespace`); }
        });
    }
    return failures;
}

function checkGitDiff(){
    const base=process.env.CI_BASE_SHA||"";
    const head=process.env.CI_HEAD_SHA||"";
    const shaRe=/^[0-9a-f]{40}$/i;
    let result;

    if(base && !shaRe.test(base)){
        fail(`CI_BASE_SHA is not a 40-character Git SHA: ${base}`);
        return;
    }
    if(head && !shaRe.test(head)){
        fail(`CI_HEAD_SHA is not a 40-character Git SHA: ${head}`);
        return;
    }

    if(base && !/^0{40}$/.test(base)){
        const exists=commandResult("git",["cat-file","-e",`${base}^{commit}`]);
        if(exists.status!==0){
            fail(`Git comparison base ${base} is not available in this checkout.`);
            return;
        }
        const target=head||"HEAD";
        result=commandResult("git",["diff","--check",base,target]);
    }else if(base && /^0{40}$/.test(base)){
        result=commandResult("git",["diff-tree","--check","--root","-r",head||"HEAD"]);
    }else{
        const working=commandResult("git",["diff","--check"]);
        const staged=commandResult("git",["diff","--cached","--check"]);
        if(working.status!==0 || staged.status!==0){
            renderProcessFailure(working);
            renderProcessFailure(staged);
            fail("Git whitespace errors found in the local working tree or staged changes.");
            return;
        }
        const untracked=checkUntrackedWhitespace();
        if(untracked.length){
            console.error(untracked.map(error=>"  - "+error).join("\n"));
            fail("Whitespace errors found in untracked text files.");
            return;
        }
        result={status:0};
    }

    if(result.status!==0){
        renderProcessFailure(result);
        fail("git diff --check found whitespace errors.");
        return;
    }

    const conflicts=checkConflictMarkers();
    if(conflicts.length){
        console.error(conflicts.map(error=>"  - "+error).join("\n"));
        fail(`${conflicts.length} unresolved Git conflict marker(s) found.`);
        return;
    }
    console.log("✓ Git diff whitespace check passed.");
    console.log("✓ No unresolved Git conflict markers found in repository text files.");
}

const commands=new Map([
    ["syntax",checkSyntax],
    ["tests",checkTests],
    ["resources",checkResources],
    ["html-ids",checkHtmlIds],
    ["loader",checkLoader],
    ["git-diff",checkGitDiff]
]);

const command=process.argv[2];
if(!commands.has(command)){
    console.error("Usage: node .github/scripts/ci.mjs <"+[...commands.keys()].join("|")+">");
    process.exitCode=2;
}else{
    try{
        commands.get(command)();
    }catch(error){
        console.error(error?.stack||error);
        fail(`Unexpected failure while running ${command}.`);
    }
}
