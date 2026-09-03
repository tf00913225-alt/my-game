#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
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

function versionForIndexReference(indexSource,resource){
    const re=new RegExp(`\\b(?:src|href)\\s*=\\s*["']${escapeRegExp(resource)}\\?v=([^"'&#\\s]+)["']`,"gi");
    return Array.from(indexSource.matchAll(re),match=>match[1]);
}

function checkLoader(){
    const indexFile=path.join(ROOT,"index.html");
    const loaderFile=path.join(ROOT,"js/20-anonymous-20.js");
    const indexSource=fs.readFileSync(indexFile,"utf8");
    const loaderSource=fs.readFileSync(loaderFile,"utf8");
    const errors=[];

    const versionMatches=Array.from(loaderSource.matchAll(/\bconst\s+V_ASSET_VERSION\s*=\s*["']([^"']+)["']/g));
    if(versionMatches.length!==1){
        errors.push(`js/20-anonymous-20.js must define exactly one V_ASSET_VERSION; found ${versionMatches.length}.`);
    }
    const release=versionMatches[0]?.[1];
    if(release && !/^[A-Za-z0-9._-]+$/.test(release)){
        errors.push(`V_ASSET_VERSION contains unsupported characters: ${release}`);
    }

    const releaseEntries=[
        "css/00-main.css",
        "css/19-stage-v54-main-city-moderate-native-scale.css",
        "js/00-main.js",
        "js/16-stage-v54-main-city-runtime.js",
        "js/19-stage-v78-character-inventory-runtime.js",
        "js/20-anonymous-20.js"
    ];
    for(const entry of releaseEntries){
        const versions=versionForIndexReference(indexSource,entry);
        if(versions.length!==1){
            errors.push(`index.html must reference ${entry}?v=... exactly once; found ${versions.length}.`);
        }else if(release && versions[0]!==release){
            errors.push(`index.html uses ${entry}?v=${versions[0]}, but Loader uses V_ASSET_VERSION=${release}.`);
        }
        const target=path.join(ROOT,entry);
        if(!fs.existsSync(target) || !fs.statSync(target).isFile()){
            errors.push(`Required release entry is missing: ${entry}`);
        }
    }

    if(release){
        const badgeRe=/<([a-z][\w:-]*)\b([^>]*\bid\s*=\s*["']homeVersionBadge["'][^>]*)>([\s\S]*?)<\/\1\s*>/i;
        const badge=indexSource.match(badgeRe);
        if(!badge){
            errors.push("index.html is missing #homeVersionBadge.");
        }else{
            const aria=badge[2].match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1]||"";
            const text=badge[3].replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
            if(aria!==`目前版本 V${release}`){ errors.push(`#homeVersionBadge aria-label is "${aria}", expected "目前版本 V${release}".`); }
            if(text!==`V${release}`){ errors.push(`#homeVersionBadge text is "${text}", expected "V${release}".`); }
        }
        const styleId=`v${release}-home-version-badge-style`;
        const styleMatches=indexSource.match(new RegExp(`\\bid\\s*=\\s*["']${escapeRegExp(styleId)}["']`,"g"))||[];
        if(styleMatches.length!==1){ errors.push(`index.html must contain exactly one release badge style id ${styleId}; found ${styleMatches.length}.`); }
    }

    const directScripts=[];
    const scriptRe=/<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))[^>]*>/gi;
    for(const match of indexSource.matchAll(scriptRe)){
        const raw=match[1]??match[2]??match[3];
        if(isExternalReference(raw)){ continue; }
        directScripts.push(cleanReference(raw));
    }
    for(const required of ["js/00-main.js","js/20-anonymous-20.js"]){
        const count=directScripts.filter(item=>item===required).length;
        if(count!==1){ errors.push(`index.html must load ${required} exactly once; found ${count}.`); }
    }
    const directDuplicates=directScripts.filter((item,index)=>directScripts.indexOf(item)!==index);
    if(directDuplicates.length){ errors.push(`index.html has duplicate script loads: ${[...new Set(directDuplicates)].join(", ")}`); }

    const loaderDependencies=[];
    for(const literal of extractJsStringLiterals(loaderSource)){
        for(const found of extractResourcePaths(literal.value)){
            const clean=cleanReference(found.raw);
            if(/\.(?:js|mjs|cjs|css)$/i.test(clean)){ loaderDependencies.push(clean); }
        }
    }
    const uniqueDependencies=[...new Set(loaderDependencies)];
    if(!uniqueDependencies.length){ errors.push("Loader has no discoverable local JavaScript/CSS dependencies."); }
    for(const dependency of uniqueDependencies){
        const target=path.join(ROOT,dependency);
        if(!fs.existsSync(target) || !fs.statSync(target).isFile()){
            errors.push(`Loader dependency is missing: ${dependency}`);
        }
    }
    const duplicateDependencies=loaderDependencies.filter((item,index)=>loaderDependencies.indexOf(item)!==index);
    if(duplicateDependencies.length){ errors.push(`Loader repeats dependencies: ${[...new Set(duplicateDependencies)].join(", ")}`); }
    const overlap=uniqueDependencies.filter(item=>directScripts.includes(item));
    if(overlap.length){ errors.push(`Scripts are loaded both directly and by Loader: ${overlap.join(", ")}`); }

    const runtimeRows=[];
    const runtimeRe=/\{\s*id\s*:\s*["']([^"']+)["']\s*,\s*src\s*:\s*["']([^"']+)["']\s*\}/g;
    for(const match of loaderSource.matchAll(runtimeRe)){ runtimeRows.push({id:match[1],src:match[2]}); }
    if(!runtimeRows.length){ errors.push("Loader ordered runtime list is empty or cannot be parsed."); }
    for(const field of ["id","src"]){
        const values=runtimeRows.map(row=>row[field]);
        const duplicates=values.filter((value,index)=>values.indexOf(value)!==index);
        if(duplicates.length){ errors.push(`Loader runtime ${field} values are duplicated: ${[...new Set(duplicates)].join(", ")}`); }
    }
    const missingRuntimeDependency=runtimeRows.map(row=>row.src).filter(src=>!uniqueDependencies.includes(src));
    if(missingRuntimeDependency.length){ errors.push(`Ordered runtime sources escaped dependency validation: ${missingRuntimeDependency.join(", ")}`); }

    if(errors.length){
        console.error(errors.map(error=>"  - "+error).join("\n"));
        fail(`${errors.length} release/Loader integrity problem(s) found.`);
        return;
    }
    console.log(`✓ Release version coherence: V${release}.`);
    console.log(`✓ Index entries: ${directScripts.length} direct scripts exist without duplicate loads.`);
    console.log(`✓ Loader dependencies: ${uniqueDependencies.length} JavaScript/CSS files exist, including ${runtimeRows.length} ordered runtimes.`);
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
