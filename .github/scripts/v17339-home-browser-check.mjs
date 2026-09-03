import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const mode=process.argv[2];
const baseUrl=process.argv[3]||"http://127.0.0.1:8899";
const snapshotPath=process.argv[4]||"/tmp/v17339-home-baseline.json";
if(!["baseline","final"].includes(mode)){
    throw new Error("usage: node v17339-home-browser-check.mjs baseline|final [url] [snapshot]");
}
const executablePath=process.env.CHROME_PATH;
if(!executablePath||!fs.existsSync(executablePath)){
    throw new Error("CHROME_PATH is missing or invalid: "+String(executablePath));
}

const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await browser.newPage({viewport:{width:420,height:747},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];
page.on("pageerror",error=>errors.push(String(error)));
page.on("console",message=>{ if(message.type()==="error"){ errors.push("console: "+message.text()); } });
page.on("dialog",dialog=>dialog.accept());

async function prepareHome(){
    await page.goto(baseUrl+"/?v17339-home-pixel-check="+Date.now(),{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(()=>
        typeof window.updateUI==="function"&&typeof window.showPage==="function"&&
        !!document.querySelector(".home-city-hud")&&!!window.__v146SystemPolishInstalled,
        null,{timeout:30000}
    );
    await page.evaluate(()=>{
        const makeCharacter=(id,element,level)=>({
            id,element,gender:"male",level,exp:0,expNext:50000,
            attack:10,vitality:20,energy:20,intelligence:10,spirit:10,agility:10,
            bonusHP:0,bonusSP:0,attributePoints:0,skillPoints:20,
            hp:1200,sp:420,maxHP:1200,maxSP:420,
            activeBuffs:[],statusEffects:[],isDefending:false
        });
        Object.assign(player,makeCharacter("赤炎測試者","fire",50));
        player2=makeCharacter("寒泉測試者","water",50);
        player3=makeCharacter("青嵐測試者","wind",50);
        if(Array.isArray(characters)){
            [{id:"player2",name:player2.id},{id:"player3",name:player3.id}].forEach(entry=>{
                if(!characters.some(character=>character&&character.id===entry.id)){ characters.push(entry); }
            });
        }
        if(typeof characterEquipment==="object"&&characterEquipment){
            ["fire","player2","player3"].forEach(key=>{
                characterEquipment[key]=characterEquipment[key]||{head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
            });
        }
        if(typeof characterSkillLoadouts==="object"&&characterSkillLoadouts){
            characterSkillLoadouts.fire=characterSkillLoadouts.fire||{name:player.id,skillLevels:{},equippedSkills:[]};
            characterSkillLoadouts.player2=characterSkillLoadouts.player2||{name:player2.id,skillLevels:{},equippedSkills:[]};
            characterSkillLoadouts.player3=characterSkillLoadouts.player3||{name:player3.id,skillLevels:{},equippedSkills:[]};
        }
        try{ showPage("home"); }catch(_){ }
        try{ updateUI(); }catch(_){ }
        const startup=document.getElementById("startupLoader");
        if(startup){ startup.style.setProperty("display","none","important"); }
        const creation=document.getElementById("creationPage");
        if(creation){ creation.style.setProperty("display","none","important"); }
        const home=document.getElementById("homePage")||document.querySelector(".home-city-hud")?.closest(".page");
        if(home){
            home.hidden=false;
            home.style.setProperty("display","block","important");
            home.style.setProperty("visibility","visible","important");
        }
        document.querySelectorAll(".page").forEach(node=>{
            if(node!==home){ node.style.setProperty("display","none","important"); }
        });
        try{ updateUI(); }catch(_){ }
    });
    await page.evaluate(async()=>{ if(document.fonts&&document.fonts.ready){ await document.fonts.ready; } });
    await page.waitForTimeout(180);
    await page.waitForFunction(()=>document.querySelectorAll("#homePage .v146-home-character").length===3,null,{timeout:10000});
}

async function measure(){
    return await page.evaluate(()=>{
        const app=document.querySelector("#game-stage > #app")||document.getElementById("app");
        if(!app){ throw new Error("app not found"); }
        const appRect=app.getBoundingClientRect();
        const sx=420/appRect.width;
        const sy=746.6666667/appRect.height;
        const logicalRect=element=>{
            if(!element){ return null; }
            const r=element.getBoundingClientRect();
            return {
                left:(r.left-appRect.left)*sx,
                top:(r.top-appRect.top)*sy,
                width:r.width*sx,
                height:r.height*sy,
                right:(r.right-appRect.left)*sx,
                bottom:(r.bottom-appRect.top)*sy,
                centerX:(r.left+r.width/2-appRect.left)*sx,
                centerY:(r.top+r.height/2-appRect.top)*sy
            };
        };
        const font=element=>parseFloat(getComputedStyle(element).fontSize)||0;
        const title=document.querySelector("#homePage .home-hud-kicker > span");
        const version=document.querySelector("#homePage .home-version-badge");
        const hud=document.querySelector("#homePage .home-city-hud");
        const offline=document.querySelector('#homePage .home-card-utility[aria-label="離線經驗"]');
        const system=document.querySelector('#homePage .home-card-utility[aria-label="系統"]');
        const offlineIcon=document.getElementById("homeIconOfflineExp");
        const systemIcon=document.getElementById("homeIconSystem");
        const offlineLabel=offline&&offline.querySelector(".home-card-label");
        const systemLabel=system&&system.querySelector(".home-card-label");
        const roster=document.querySelector("#homePage .v146-home-roster");
        const nav=document.querySelector("#game-stage > #app .bottom-nav")||document.querySelector(".bottom-nav");
        const home=document.getElementById("homePage");
        const data={
            titleFont:font(title),versionFont:font(version),hud:logicalRect(hud),
            offline:logicalRect(offline),system:logicalRect(system),
            offlineIcon:logicalRect(offlineIcon),systemIcon:logicalRect(systemIcon),
            offlineFont:font(offlineLabel),systemFont:font(systemLabel),
            roster:logicalRect(roster),nav:logicalRect(nav),
            corridor:logicalRect(system).left-logicalRect(offline).right,
            rosterNavGap:logicalRect(nav).top-logicalRect(roster).bottom,
            rosterRows:Array.from(document.querySelectorAll("#homePage .v146-home-character")).map(logicalRect),
            homeClientHeight:home?home.clientHeight:0,
            homeScrollHeight:home?home.scrollHeight:0,
            appClientHeight:app.clientHeight,
            appScrollHeight:app.scrollHeight,
            bodyScrollHeight:document.body.scrollHeight,
            viewport:{width:innerWidth,height:innerHeight},
            appPhysical:{width:appRect.width,height:appRect.height}
        };
        return data;
    });
}

function close(actual,expected,tolerance,label){
    assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected} ±${tolerance}`);
}

try{
    await prepareHome();
    const data=await measure();
    if(mode==="baseline"){
        fs.writeFileSync(snapshotPath,JSON.stringify(data,null,2));
        await page.screenshot({path:"/tmp/v17339-home-baseline.png",fullPage:false});
        console.log("HOME_BASELINE "+JSON.stringify(data));
    }else{
        const baseline=JSON.parse(fs.readFileSync(snapshotPath,"utf8"));
        close(data.titleFont,15,.25,"title font");
        close(data.versionFont,11,.25,"version font");
        assert.ok(data.hud.height>=46&&data.hud.height<=50,"HUD height "+data.hud.height);
        close(data.offline.width,104,4,"offline width");
        close(data.offline.height,46,4,"offline height");
        close(data.system.width,104,4,"system width");
        close(data.system.height,46,4,"system height");
        close(data.offlineFont,16,.25,"offline font");
        close(data.systemFont,16,.25,"system font");
        close(data.offlineIcon.width,40,2,"offline icon width");
        close(data.offlineIcon.height,40,2,"offline icon height");
        close(data.systemIcon.width,40,2,"system icon width");
        close(data.systemIcon.height,40,2,"system icon height");
        close(data.offline.centerX,132,4,"offline center X");
        close(data.system.centerX,288,4,"system center X");
        assert.ok(data.corridor>=50&&data.corridor<=55,"centre corridor "+data.corridor);
        const utilityShift=(data.offline.centerY-baseline.offline.centerY+data.system.centerY-baseline.system.centerY)/2;
        assert.ok(utilityShift>=4&&utilityShift<=6,"utility Y shift "+utilityShift);
        const rosterShift=data.roster.top-baseline.roster.top;
        assert.ok(rosterShift>=38&&rosterShift<=46,"roster Y shift "+rosterShift);
        const rosterGrowth=data.roster.height-baseline.roster.height;
        assert.ok(rosterGrowth>=9&&rosterGrowth<=13,"roster height growth "+rosterGrowth);
        assert.ok(data.rosterNavGap>=35&&data.rosterNavGap<=45,"roster/nav gap "+data.rosterNavGap);
        close(data.nav.top,baseline.nav.top,.5,"bottom nav top unchanged");
        close(data.nav.height,baseline.nav.height,.5,"bottom nav height unchanged");
        assert.ok(data.roster.bottom<data.nav.top,"roster must not overlap bottom nav");
        assert.ok(data.homeScrollHeight<=data.homeClientHeight+1,"home page scroll overflow");
        assert.ok(data.appScrollHeight<=data.appClientHeight+1,"app scroll overflow");
        data.rosterRows.forEach((row,index)=>assert.ok(row.height>0&&row.bottom<=data.roster.bottom+1,"roster row "+index+" clipped"));
        assert.equal(errors.length,0,"browser errors: "+errors.join(" | "));
        await page.screenshot({path:"/tmp/v17339-home-final.png",fullPage:false});
        console.log("HOME_FINAL "+JSON.stringify({...data,utilityShift,rosterShift,rosterGrowth}));
    }
}finally{
    await browser.close();
}
