import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {ROOT,findChrome,startServer,waitJson,Cdp} from "./runtime-browser-qa-support.mjs";
const ARTIFACT_DIR=path.join(ROOT,"artifacts","browser-qa");
const VIEWPORTS=[[360,800],[393,873],[412,915],[1280,960]];
const QA_LABELS=Object.freeze({
    heal:"治療術",
    revive:"復活術",
    freeze:"冰封",
    purifyMind:"淨心訣",
    learn:"學習・",
    upgrade:"升級・",
    fireCharacter:"QA 火角色",
    waterCharacter:"QA 水角色"
});
const WATER_CASES=[
    ["healSpell",QA_LABELS.heal],
    ["revive",QA_LABELS.revive],
    ["freeze",QA_LABELS.freeze],
    ["purifyMind",QA_LABELS.purifyMind]
];
const ELEMENT_CASES=[["fire","fireRocket"],["water","healSpell"],["wind","stormFist"],["earth","stoneThrow"]];
const PREPARE_RUNTIME=`(async()=>{
    // Keep hydration failures observable in the browser artifact.
    const runtimeErrors=[];
    const originalConsoleError=console.error;
    console.error=(...args)=>{runtimeErrors.push(args.map(value=>String(value&&value.stack||value)).join(" "));originalConsoleError(...args);};
    window.addEventListener("error",event=>runtimeErrors.push(String(event.message||event.error||"window error")));
    window.addEventListener("unhandledrejection",event=>runtimeErrors.push(String(event.reason||"unhandled rejection")));
    const waitFor=async predicate=>{
        const until=Date.now()+30000;
        while(Date.now()<until){ if(predicate()){ return true; } await new Promise(resolve=>setTimeout(resolve,50)); }
        return false;
    };
    if(!await waitFor(()=>window.FourSymbolsFeatures&&typeof window.FourSymbolsFeatures.ensure==="function")){
        throw new Error("feature loader was not initialized");
    }
    if(!await waitFor(()=>window.FourSymbolsStartupPolicy?.getState?.()==="READY"&&document.getElementById("startupLoader")?.hidden===true&&getComputedStyle(document.getElementById("gameInterface")).display!=="none")){
        throw new Error("formal account-first startup did not reach READY: "+JSON.stringify({
            state:window.FourSymbolsStartupPolicy?.getState?.(),
            loaderHidden:document.getElementById("startupLoader")?.hidden,
            gameDisplay:getComputedStyle(document.getElementById("gameInterface")).display,
            startupError:String(window.FourSymbolsStartupPolicy?.getLastError?.()?.message||""),
            runtimeErrors:runtimeErrors.slice(-8)
        }));
    }
    await window.FourSymbolsFeatures.ensure("skill","skill-runtime-browser-qa");
    if(!await waitFor(()=>typeof renderSkillLoadout==="function"&&typeof window.v173GetSkillLearnEligibility==="function"&&typeof window.v17364GetSkillUpgradeEligibility==="function")){
        throw new Error("formal Skill Runtime owners were not initialized: "+JSON.stringify({
            skillFeatureReady:window.FourSymbolsFeatures.isReady("skill"),
            gameplayCoreReady:window.FourSymbolsFeatures.isReady("gameplay-core"),
            progressionInstalled:!!window.__v17364SkillProgressionInstalled,
            renderer:typeof renderSkillLoadout,
            learnEligibility:typeof window.v173GetSkillLearnEligibility,
            upgradeEligibility:typeof window.v17364GetSkillUpgradeEligibility,
            errors:runtimeErrors.slice(-8)
        }));
    }
    document.getElementById("firebaseDirectEnterButton")?.click();
    if(!await waitFor(()=>!document.querySelector('.firebase-auth-overlay.show'))){
        throw new Error("account resume overlay still blocks skill page");
    }
    player.id="QA 火角色";player.element="fire";player.level=70;player.skillPoints=999;
    player2={id:"QA 水角色",element:"water",level:70,skillPoints:999};
    player3=null;
    currentSkillCharacter="fire";
    // Cross-element learning keeps its formal native-skill gate. Seed one
    // legitimate native level so the water cases exercise the real cross
    // element learn actions rather than a separate locked-state scenario.
    characterSkillLoadouts.fire={skillLevels:{fireRocket:1},equippedSkills:[]};
    selectedSkillElementCharacterKey="fire";
    showPage("home");
    openHomeFeature("character");
    switchCharacterTab("skill");
    selectedSkillElementTab="water";
    renderSkillLoadout();
    if(!await waitFor(()=>{
        const list=document.getElementById("allSkillsList");
        const modal=document.getElementById("homeFeatureModal");
        const rect=list?.getBoundingClientRect();
        return !!(modal?.classList.contains("show")&&rect&&rect.width>0&&rect.height>0);
    })){
        const describe=id=>{
            const node=document.getElementById(id);
            if(!node){return {id,exists:false};}
            const style=getComputedStyle(node),rect=node.getBoundingClientRect();
            return {id,exists:true,className:node.className,hidden:node.hidden,inlineDisplay:node.style.display,display:style.display,visibility:style.visibility,opacity:style.opacity,rect:{width:rect.width,height:rect.height,left:rect.left,top:rect.top}};
        };
        throw new Error("formal Character Skill surface did not enter the player viewport: "+JSON.stringify({
            startupState:window.FourSymbolsStartupPolicy?.getState?.(),
            nodes:["game-viewport","game-stage","app","game-content","homePage","homeFeatureModal","homeFeatureModalBody","characterTabContent","skillPage","allSkillsList"].map(describe)
        }));
    }
    if(typeof window.v146SyncCharacterAttentionDots==="function"){ window.v146SyncCharacterAttentionDots(); }
    return true;
})()`;

const COLLECT_EVIDENCE=`(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const visible=node=>{
        if(!node){ return {exists:false}; }
        node.scrollIntoView({block:"center",inline:"nearest"});
        const style=getComputedStyle(node),r=rect(node);
        const width=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));
        const height=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
        const label=node.querySelector(".skill-action-card-label"),lr=label?rect(label):null;
        const hasVisualSurface=style.backgroundImage!=="none"||style.backgroundColor!=="rgba(0, 0, 0, 0)"||parseFloat(style.borderTopWidth)>0;
        return {exists:true,tagName:node.tagName,type:node.getAttribute("type"),disabled:node.disabled,ariaDisabled:node.getAttribute("aria-disabled"),display:style.display,visibility:style.visibility,opacity:Number(style.opacity),rect:r,visibleRectWidth:width,visibleRectHeight:height,label:{exists:!!label,text:String(label?.textContent||"").trim(),rect:lr},hasVisualSurface};

// GitHub UI synchronization marker; no Runtime behavior change.
    };
    const findAction=skillId=>document.querySelector('[data-skill-id="'+skillId+'"] button.skill-action-card[data-skill-action="growth"]');
    const water={};
    ${JSON.stringify(WATER_CASES)}.forEach(([id,name])=>{water[name]=visible(findAction(id));});
    const elements={};
    ${JSON.stringify(ELEMENT_CASES)}.forEach(([element,id])=>{
        if(element==="fire"){ characterSkillLoadouts.fire.skillLevels={}; }
        selectedSkillElementTab=element;renderSkillLoadout();
        const card=findAction(id);elements[element]={skillId:id,action:visible(card)};
    });
    characterSkillLoadouts.fire.skillLevels={fireRocket:1};
    selectedSkillElementTab="water";renderSkillLoadout();
    if(typeof window.v146SyncCharacterAttentionDots==="function"){ window.v146SyncCharacterAttentionDots(); }
    player.skillPoints=0;renderSkillLoadout();
    const disabledLearn=visible(findAction("healSpell"));
    player.skillPoints=999;selectedSkillElementTab="fire";
    characterSkillLoadouts.fire.skillLevels={fireRocket:1};renderSkillLoadout();
    const upgrade=visible(findAction("fireRocket"));
    const equip=visible(document.querySelector('[data-skill-id="fireRocket"] button.skill-action-card[data-skill-action="equip"]'));
    characterSkillLoadouts.fire.skillLevels={fireRocket:(skillDatabase.fireRocket.maxLevel||1)};renderSkillLoadout();
    const maxLevel=visible(findAction("fireRocket"));
    selectedSkillElementTab="water";renderSkillLoadout();
    if(typeof window.v146SyncCharacterAttentionDots==="function"){ window.v146SyncCharacterAttentionDots(); }
    const guidance=[];
    document.querySelectorAll("#allSkillsList .v146-growth-guidance-dot").forEach(dot=>{
        const parent=dot.closest("button.skill-action-card");
        guidance.push({parent:visible(parent),dot:visible(dot)});
    });
    const cards=[...document.querySelectorAll("#allSkillsList .skill-action-card")];
    return {runtime:{renderer:String(renderSkillLoadout).includes("data-skill-action=\\\"growth\\\"")},water,elements,disabledLearn,upgrade,equip,maxLevel,guidance,allCards:cards.map(visible)};
})()`;

function assertVisibleAction(name,evidence){
    assert.equal(evidence.exists,true,`${name}: action card is missing`);
    assert.equal(evidence.tagName,"BUTTON",`${name}: action card must be BUTTON`);
    assert.equal(evidence.type,"button",`${name}: action button type is wrong`);
    assert.notEqual(evidence.display,"none",`${name}: display:none`);
    assert.notEqual(evidence.visibility,"hidden",`${name}: visibility:hidden`);
    assert.ok(evidence.opacity>0,`${name}: transparent`);
    assert.ok(evidence.rect.width>0&&evidence.rect.height>0,`${name}: zero geometry`);
    assert.ok(evidence.visibleRectWidth>0&&evidence.visibleRectHeight>0,`${name}: outside player viewport`);
    assert.equal(evidence.label.exists,true,`${name}: label is missing`);
    assert.ok(evidence.label.rect.width>0&&evidence.label.rect.height>0,`${name}: label has zero geometry`);
    assert.ok(evidence.label.text.length>0,`${name}: label is blank`);
    assert.equal(evidence.hasVisualSurface,true,`${name}: button has no background or border`);
}

async function runViewport(chrome,url,width,height,capture){
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),"skill-runtime-browser-qa-"));
    const port=9400+Math.floor(Math.random()*300);
    const proc=spawn(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--remote-debugging-address=127.0.0.1","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"],{stdio:"ignore"});
    let client=null;
    let latestEvidence=null;
    try{
        const targets=await waitJson(`http://127.0.0.1:${port}/json/list`);
        const page=targets.find(item=>item.type==="page");
        assert.ok(page?.webSocketDebuggerUrl);
        client=new Cdp(page.webSocketDebuggerUrl);
        await client.send("Page.enable");await client.send("Runtime.enable");await client.send("Log.enable");
        // This is the production account repository's persisted owner key, seeded before
        // any formal bundle evaluates.  It supplies a syntactically valid, isolated QA
        // identity without replacing Firebase, the feature loader, or any Skill Runtime
        // owner.  Feature modules call accountKey() during installation, so setting this
        // only after navigation is too late and produces a false bootstrap failure.
        await client.send("Page.addScriptToEvaluateOnNewDocument",{source:'localStorage.setItem("four_symbols_active_uid","skill-runtime-browser-qa");'});
        await client.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<700,screenWidth:width,screenHeight:height,screenOrientation:{type:"portraitPrimary",angle:0}});
        await client.send("Page.navigate",{url});
        await client.eval(PREPARE_RUNTIME);
        const skin=await client.eval(String.raw`(async()=>{
            const modal=document.getElementById('homeFeatureModal');
            const box=modal.querySelector('.home-feature-modal-box');
            const rectangle=()=>{const r=box.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
            const frames=[rectangle()];
            for(const tab of ['status','expPool','skill']){switchCharacterTab(tab);frames.push(rectangle());}
            const decode=async value=>{
                const urls=[...value.matchAll(/url\("([^"]+)"\)/g)].map(match=>match[1]);
                for(const url of urls){const image=new Image();image.src=url;await image.decode();}
                return urls;
            };
            const chrome=[...await decode(getComputedStyle(box).borderImageSource),...await decode(getComputedStyle(box.querySelector('#homeFeatureModalTitle')).backgroundImage)];
            const art=[];
            for(const node of document.querySelectorAll('.character-showcase-avatar,#skillPage .skill-row-icon,#skillPage .skill-loadout-slot-icon')){
                art.push(...await decode(getComputedStyle(node).backgroundImage));
            }
            const scroll={content:getComputedStyle(document.getElementById('characterTabContent')).overflowY,page:getComputedStyle(document.getElementById('skillPage')).overflowY,list:getComputedStyle(document.getElementById('allSkillsList')).overflowY};
            const title=box.querySelector('#homeFeatureModalTitle');
            const back=box.querySelector('.character-header-actions button[onclick="closeHomeFeature()"]');
            const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
            const titleStyle=getComputedStyle(title),titleRect=rect(title);
            const range=document.createRange();range.selectNodeContents(title);
            const textRect=range.getBoundingClientRect(),scale=titleRect.w/title.offsetWidth;
            const center=titleRect.x+(parseFloat(titleStyle.paddingLeft)+(title.offsetWidth-parseFloat(titleStyle.paddingLeft)-parseFloat(titleStyle.paddingRight))/2)*scale;
            const header={title:titleRect,back:rect(back),row:rect(title.parentElement),centerError:Math.abs(textRect.x+textRect.width/2-center)};
            const selected=modal.dataset.characterTab;
            closeHomeFeature();const cleared=!modal.hasAttribute('data-character-tab');
            openHomeFeature('character');switchCharacterTab('skill');selectedSkillElementTab='water';renderSkillLoadout();
            return {frames,chrome,art,scroll,selected,cleared,header};
        })()`);
        assert.ok(Math.abs(skin.header.title.h-skin.header.back.h)<.1,'skill title and return must share a height');
        assert.ok(skin.header.title.w/skin.header.row.w<.5,'skill plaque must stay compact');
        assert.ok(skin.header.title.x+skin.header.title.w<skin.header.back.x,'title overlaps return');
        assert.ok(skin.header.centerError<4,'skill text must center inside its usable plaque region');
        assert.equal(skin.selected,'skill');assert.equal(skin.cleared,true,'skill chrome leaks after closing');
        assert.ok(skin.frames.every(frame=>frame.every((value,i)=>Math.abs(value-skin.frames[0][i])<.1)),'shared character frame jumps between tabs');
        assert.equal(skin.chrome.length,2,'both generated decorative assets must decode');
        assert.ok(skin.art.length>=3&&skin.art.every(url=>!url.includes('/build/assets/')),'character/skill illustration URLs must remain document-relative');
        assert.deepEqual(skin.scroll,{content:'auto',page:'visible',list:'visible'},'only the original character viewport may scroll');
        const evidence=await client.eval(COLLECT_EVIDENCE);
        evidence.skin=skin;
        latestEvidence=evidence;
        assert.equal(evidence.runtime.renderer,true,"QA did not execute the formal renderSkillLoadout owner");
        for(const [name,action] of Object.entries(evidence.water)){ assertVisibleAction(name,action); }
        for(const [element,item] of Object.entries(evidence.elements)){ assertVisibleAction(element+"/"+item.skillId,item.action); }
        assertVisibleAction("disabled learn",evidence.disabledLearn);assert.equal(evidence.disabledLearn.disabled,true,"locked action must use native disabled");
        assertVisibleAction("upgrade",evidence.upgrade);assert.ok(evidence.upgrade.label.text.includes(QA_LABELS.upgrade),"upgrade label is missing");
        assertVisibleAction("equip",evidence.equip);assert.equal(evidence.equip.disabled,false,"equip action should be enabled");
        assertVisibleAction("max level",evidence.maxLevel);assert.equal(evidence.maxLevel.disabled,true,"max-level action must use native disabled");
        assert.ok(evidence.water[QA_LABELS.heal].label.text.includes(QA_LABELS.learn),"cross-element learn label is missing");
        assert.ok(evidence.guidance.length>0,"learnable action has no Guidance Dot");
        for(const item of evidence.guidance){ assertVisibleAction("Guidance Dot parent",item.parent);assert.ok(item.dot.visibleRectWidth>0&&item.dot.visibleRectHeight>0,"Guidance Dot is not visible"); }
        for(const card of evidence.allCards){ assert.equal(card.tagName,"BUTTON","div.skill-action-card is forbidden in formal Runtime"); }
        const layout=await client.eval(`(()=>{
            const failures=[];
            const rect=node=>node.getBoundingClientRect();
            for(const element of ['fire','water','wind','earth']){
                selectedSkillElementTab=element;renderSkillLoadout();
                for(const row of document.querySelectorAll('#allSkillsList .skill-row')){
                    const bounds=rect(row),text=row.querySelector('.skill-row-text'),icon=row.querySelector('.skill-row-icon');
                    if(row.scrollWidth>row.clientWidth+1)failures.push(element+': row overflow');
                    if(rect(icon).right>rect(text).left+1)failures.push(element+': icon overlaps text');
                    const actions=[...row.querySelectorAll('button')];
                    for(const action of actions){
                        const r=rect(action);
                        if(r.left<bounds.left||r.right>bounds.right+1)failures.push(element+': action escapes row');
                        if(r.top<rect(text).bottom-1)failures.push(element+': action overlaps description');
                        if(action.scrollWidth>action.clientWidth+1||action.scrollHeight>action.clientHeight+1)failures.push(element+': clipped action');
                    }
                    const scale=bounds.width/row.offsetWidth;
                    for(const node of row.querySelectorAll('b,.skill-row-meta,.skill-row-desc,.skill-action-card-label,.skill-row-detail-link')){
                        if(parseFloat(getComputedStyle(node).fontSize)*scale<12.9)failures.push(element+': projected text below minimum');
                    }
                }
            }
            return {failures};
        })()`);
        assert.deepEqual(layout.failures,[],"skill presentation must remain readable without overlapping controls");
        evidence.layout=layout;
        const retirement=await client.eval(`(async()=>{
            const absent=!document.querySelector('#allElementSkillPreviewModal,#skillPreviewHeaderButton,.skill-preview-modal');
            const detail=document.querySelector('#allSkillsList [onclick^="showSkillDetail"]');
            if(!detail)throw Error('normal skill detail action missing');
            detail.scrollIntoView({block:"center"});
            await new Promise(resolve=>{const timer=setTimeout(resolve,250);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve();}));});
            const r=detail.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            if(!hit||!(hit===detail||detail.contains(hit)))throw Error('normal detail action blocked '+JSON.stringify({rect:r.toJSON(),hit:hit?.outerHTML.slice(0,250)}));
            detail.click();
            const shown=document.getElementById('skillDetailModal').classList.contains('show');
            closeSkillDetail();
            const closed=!document.getElementById('skillDetailModal').classList.contains('show');
            return {absent,shown,closed,skillList:!!document.getElementById('allSkillsList')};
        })()`);
        assert.deepEqual(retirement,{absent:true,shown:true,closed:true,skillList:true});
        evidence.retirement=retirement;
        if(capture){
            await client.eval(`(()=>{
                player.id='赤炎行者';player2.id='寒泉行者';
                renderCharacterShowcaseContent();
                characterSkillLoadouts.fire={skillLevels:{fireRocket:1},equippedSkills:['fireRocket']};
                selectedSkillElementTab='fire';renderSkillLoadout();
                document.getElementById('characterTabContent').scrollTop=0;
            })()`);
            await client.eval(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
            const screenshot=await client.send("Page.captureScreenshot",{format:"png"});
            fs.writeFileSync(path.join(ARTIFACT_DIR,"skill-393x873.png"),Buffer.from(screenshot.data,"base64"));
            await client.eval(`document.querySelector('#allSkillsList .skill-row').scrollIntoView({block:'start'})`);
            await client.eval(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
            const listScreenshot=await client.send("Page.captureScreenshot",{format:"png"});
            fs.writeFileSync(path.join(ARTIFACT_DIR,"skill-list-393x873.png"),Buffer.from(listScreenshot.data,"base64"));
        }
        return {viewport:{width,height},evidence};
    }catch(error){
        error.skillRuntimeEvidence=latestEvidence;
        throw error;
    }finally{
        client?.close();proc.kill("SIGTERM");
        try{fs.rmSync(profile,{recursive:true,force:true});}catch(_){}
    }
}

fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
const chrome=findChrome();
const server=await startServer({baseUrl:process.env.DEV_BASE_URL});
try{
    const results=[];
    for(const [width,height] of VIEWPORTS){ results.push(await runViewport(chrome,server.url,width,height,width===393)); }
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,"build","asset-manifest.json"),"utf8"));
    const evidence={suite:"skill-runtime-browser-qa",passed:true,commitSha:process.env.GITHUB_SHA||"unknown",runtimeUrl:server.url,deploymentBaseUrl:process.env.DEV_BASE_URL||null,productionCascade:[...manifest.critical.styles,...manifest.featureManifest.bundles["app-shell"].styles,...manifest.featureManifest.bundles["gameplay-core"].styles],results};
    fs.writeFileSync(path.join(ARTIFACT_DIR,"skill-inventory-semantic-browser-qa.json"),JSON.stringify(evidence,null,2)+"\n","utf8");
    console.log("Real Skill Runtime mobile browser QA passed:",VIEWPORTS.map(item=>item.join("x")).join(", "));
}catch(error){
    fs.writeFileSync(path.join(ARTIFACT_DIR,"skill-inventory-semantic-browser-qa.json"),JSON.stringify({suite:"skill-runtime-browser-qa",passed:false,error:String(error?.stack||error),evidence:error?.skillRuntimeEvidence||null},null,2)+"\n","utf8");
    throw error;
}finally{ await new Promise(resolve=>server.server.close(resolve)); }
// CI synchronization marker for the current six-stat convergence validation head.
