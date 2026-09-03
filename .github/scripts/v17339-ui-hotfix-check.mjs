import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const executablePath=process.env.CHROME_PATH;
if(!executablePath||!fs.existsSync(executablePath)) throw new Error("CHROME_PATH missing");
const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{ if(m.type()==="error"&&!m.text().includes("404")) errors.push(m.text()); });
page.on("dialog",d=>d.accept());
const url=process.argv[2]||"http://127.0.0.1:8899";

function close(actual,expected,tolerance,label){
    assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected}`);
}

try{
    await page.goto(url+"/?ui-hotfix="+Date.now(),{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(()=>document.getElementById("creationPage")&&typeof window.selectElement==="function",null,{timeout:30000});

    await page.evaluate(()=>{
        const startup=document.getElementById("startupLoader"); if(startup) startup.style.display="none";
        const stage=document.getElementById("game-stage");
        const overlay=document.getElementById("game-overlay-layer");
        const creation=document.getElementById("creationPage");
        if(overlay&&creation.parentElement!==overlay) overlay.appendChild(creation);
        if(overlay){ overlay.style.display="block"; overlay.removeAttribute("aria-hidden"); }
        creation.classList.add("native-creation-page");
        creation.hidden=false; creation.style.display="block"; creation.style.visibility="visible";
        stage?.classList.add("creation-native-active","creation-fixed-active");
        document.documentElement.classList.add("creation-fixed-active");
        document.body.classList.add("creation-fixed-active");
        const gi=document.getElementById("gameInterface"); if(gi) gi.style.display="none";
        try{ setCreationStep(1); }catch(_){ }
        try{ selectElement("water"); }catch(_){ }
    });
    await page.waitForTimeout(250);

    const creation=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const font=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize)||0;
        const showcase=document.querySelector("#creationPage .creation-showcase");
        const choice=document.querySelector("#creationPage .creation-choice-panel");
        const role=document.querySelector("#creationPage .creation-role-card");
        const tags=document.getElementById("creationElementTags");
        const page=document.getElementById("creationPage");
        const next=document.getElementById("creationPrimaryNextButton");
        const input=document.getElementById("creationId");
        return {
            subtitleFont:font("#creationPage .creation-subtitle"),
            stepFont:font("#creationPage .creation-step-progress"),
            kickerFont:font("#creationPage .creation-section-kicker"),
            genderFont:font("#creationPage .creation-gender-option"),
            elementFont:font("#creationPage .element-option .element-name"),
            roleTitleFont:font("#creationPage .creation-role-title"),
            roleBodyFont:font("#creationPage .creation-role-description"),
            tagFont:font("#creationPage .creation-role-tag"),
            inputFont:font("#creationPage .creation-input"),
            showcase:rect(showcase),choice:rect(choice),role:rect(role),tags:rect(tags),page:rect(page),next:rect(next),input:rect(input),
            choiceScroll:choice.scrollHeight,choiceClient:choice.clientHeight,
            pageScrollWidth:page.scrollWidth,pageClientWidth:page.clientWidth,
            tagCount:tags.children.length,
            elementRows:[...document.querySelectorAll("#creationPage .creation-element-grid .element-option")].map(rect),
            genderRows:[...document.querySelectorAll("#creationPage .creation-gender-grid .creation-gender-option")].map(rect),
            portrait:{width:getComputedStyle(document.querySelector("#creationPage .creation-portrait-image")).width,height:getComputedStyle(document.querySelector("#creationPage .creation-portrait-image")).height}
        };
    });

    close(creation.subtitleFont,36,.2,"creation subtitle");
    close(creation.stepFont,27,.2,"creation step");
    close(creation.kickerFont,30,.2,"creation kicker");
    close(creation.genderFont,35,.2,"gender");
    close(creation.elementFont,29,.2,"element label");
    close(creation.roleTitleFont,46,.2,"role title");
    close(creation.roleBodyFont,34,.2,"role description");
    close(creation.tagFont,26.5,.2,"role tag");
    close(creation.inputFont,42,.2,"creation input");
    assert.ok(creation.tagCount>=3,"role tags should be rendered");
    assert.ok(creation.role.bottom<=creation.showcase.bottom+1,"role card clipped by showcase");
    assert.ok(creation.tags.bottom<=creation.showcase.bottom-2,"role tags clipped by showcase");
    assert.ok(creation.choiceScroll<=creation.choiceClient+2,"choice panel content overflows vertically");
    assert.ok(creation.pageScrollWidth<=creation.pageClientWidth+1,"creation page horizontal overflow");
    assert.ok(creation.next.bottom<=creation.page.bottom+1,"next button leaves creation canvas");
    assert.equal(creation.elementRows.length,4);
    creation.elementRows.forEach(r=>close(r.top,creation.elementRows[0].top,1,"element row alignment"));
    assert.equal(creation.genderRows.length,2);
    creation.genderRows.forEach(r=>close(r.top,creation.genderRows[0].top,1,"gender row alignment"));

    await page.evaluate(()=>{
        const creation=document.getElementById("creationPage"); creation.style.display="none";
        document.documentElement.classList.remove("creation-fixed-active");
        document.body.classList.remove("creation-fixed-active");
        const stage=document.getElementById("game-stage"); stage?.classList.remove("creation-native-active","creation-fixed-active");
        const app=document.getElementById("app"); app?.classList.remove("no-header");
        const gi=document.getElementById("gameInterface"); if(gi) gi.style.display="block";
        document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
        document.getElementById("homePage")?.classList.add("active");
    });
    await page.waitForTimeout(120);

    const home=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,centerX:r.left+r.width/2,centerY:r.top+r.height/2};};
        const header=document.getElementById("gameHeaderBar");
        const content=document.getElementById("game-content")||document.querySelector(".content");
        const offline=document.querySelector('.home-card-utility[aria-label="離線經驗"]');
        const system=document.querySelector('.home-card-utility[aria-label="系統"]');
        const oi=document.getElementById("homeIconOfflineExp"), si=document.getElementById("homeIconSystem");
        const ol=offline.querySelector(".home-card-label"), sl=system.querySelector(".home-card-label");
        return {
            headerDisplay:getComputedStyle(header).display,
            contentTop:getComputedStyle(content).top,
            offline:rect(offline),system:rect(system),oi:rect(oi),si:rect(si),ol:rect(ol),sl:rect(sl),
            offlineHeight:parseFloat(getComputedStyle(offline).height),systemHeight:parseFloat(getComputedStyle(system).height),
            labelFont:parseFloat(getComputedStyle(ol).fontSize),
            docScrollWidth:document.documentElement.scrollWidth,innerWidth
        };
    });
    assert.equal(home.headerDisplay,"none","legacy player HUD must stay hidden on home");
    assert.equal(home.contentTop,"0px","home content must reclaim header space");
    close(home.offlineHeight,78,.2,"offline card height");
    close(home.systemHeight,78,.2,"system card height");
    close(home.labelFont,15.5,.2,"utility label font");
    assert.ok(home.oi.bottom<=home.ol.top+2,"offline image must be above text");
    assert.ok(home.si.bottom<=home.sl.top+2,"system image must be above text");
    assert.ok(home.system.left-home.offline.right>40,"central passage remains visible");
    assert.ok(home.docScrollWidth<=home.innerWidth+1,"home horizontal overflow");
    assert.equal(errors.length,0,"browser errors: "+errors.join(" | "));
    console.log("V173.39 creation/main-city browser hotfix checks passed");
} finally {
    await browser.close();
}
