"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
const executablePath=process.env.BROWSER_PATH;

function makeCharacter(id,element,level){
    return {
        id,element,gender:"male",level,exp:0,expNext:1000,
        attack:10,vitality:10,energy:10,intelligence:10,spirit:10,agility:10,
        bonusHP:0,bonusSP:0,attributePoints:0,skillPoints:0,
        hp:500,sp:200,activeBuffs:[],statusEffects:[],isDefending:false
    };
}

(async()=>{
    const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox"]});
    try{
        for(const viewport of [{width:1080,height:1920,label:"1080x1920"},{width:390,height:844,label:"390x844"}]){
            const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
            await page.goto("http://127.0.0.1:8899/?v17339-home-final-polish=1",{waitUntil:"domcontentloaded",timeout:30000});
            await page.waitForFunction(()=>window.__v146SystemPolishInstalled&&typeof updateUI==="function",null,{timeout:30000});
            await page.evaluate(({make1,make2,make3})=>{
                Object.assign(player,make1);
                player2=make2;
                player3=make3;
                if(Array.isArray(characters)){
                    [["player2",make2.id],["player3",make3.id]].forEach(([id,name])=>{
                        if(!characters.some(character=>character&&character.id===id)){ characters.push({id,name}); }
                    });
                }
                updateUI();
                const loader=document.getElementById("startupLoader");
                if(loader){ loader.style.display="none"; }
                const creation=document.getElementById("creationPage");
                if(creation){ creation.style.display="none"; }
                document.querySelectorAll(".page").forEach(node=>node.classList.toggle("active",node.id==="homePage"));
            },{
                make1:makeCharacter("赤炎旅者","fire",50),
                make2:makeCharacter("寒泉旅者","water",50),
                make3:makeCharacter("青嵐旅者","wind",50)
            });
            await page.waitForFunction(()=>document.querySelectorAll("#v146HomeRoster .v146-home-character").length===3,null,{timeout:10000});

            const m=await page.evaluate(()=>{
                const rect=node=>{ const r=node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
                const home=document.getElementById("homePage");
                const hud=home.querySelector(".home-city-hud");
                const identity=home.querySelector(".home-hud-identity");
                const kicker=home.querySelector(".home-hud-kicker");
                const badge=home.querySelector(".home-version-badge");
                const utility=[...home.querySelectorAll(".home-card-utility")].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
                const icon=utility[0].querySelector(".home-card-icon");
                const label=utility[0].querySelector(".home-card-label");
                const roster=document.getElementById("v146HomeRoster");
                const nav=document.getElementById("bottomNav");
                const hr=rect(home),hur=rect(hud),ir=rect(identity),rr=rect(roster),nr=rect(nav);
                const ur=utility.map(rect);
                return {
                    innerHeight:window.innerHeight,
                    documentScroll:document.documentElement.scrollHeight,
                    bodyScroll:document.body.scrollHeight,
                    homeClient:home.clientHeight,
                    homeScroll:home.scrollHeight,
                    homeOverflow:getComputedStyle(home).overflow,
                    kickerFont:parseFloat(getComputedStyle(kicker).fontSize),
                    badgeFont:parseFloat(getComputedStyle(badge).fontSize),
                    identityCenterOffset:Math.abs((ir.top+ir.height/2)-(hur.top+hur.height/2)),
                    utilityWidth:parseFloat(getComputedStyle(utility[0]).width),
                    utilityHeight:parseFloat(getComputedStyle(utility[0]).height),
                    iconWidth:parseFloat(getComputedStyle(icon).width),
                    iconHeight:parseFloat(getComputedStyle(icon).height),
                    labelFont:parseFloat(getComputedStyle(label).fontSize),
                    utilityCorridor:ur[1].left-ur[0].right,
                    utilityVisualWidth:ur[0].width,
                    actionRosterGap:rr.top-Math.max(ur[0].bottom,ur[1].bottom),
                    rosterNavGap:nr.top-rr.bottom,
                    rosterMarginTop:parseFloat(getComputedStyle(roster).marginTop),
                    homeRect:hr,hudRect:hur,rosterRect:rr,navRect:nr,
                    rows:roster.querySelectorAll(".v146-home-character").length
                };
            });

            assert.equal(m.rows,3,viewport.label+" roster rows");
            assert.equal(m.homeOverflow,"hidden",viewport.label+" home overflow");
            assert.ok(m.homeScroll<=m.homeClient+1,viewport.label+" home must not scroll");
            assert.ok(m.documentScroll<=m.innerHeight+1,viewport.label+" document must not scroll");
            assert.ok(m.bodyScroll<=m.innerHeight+1,viewport.label+" body must not scroll");
            assert.ok(m.kickerFont>=10,viewport.label+" city identity font");
            assert.ok(m.badgeFont>=9,viewport.label+" version font");
            assert.ok(m.identityCenterOffset<=5,viewport.label+" identity vertical centering");
            assert.ok(m.utilityWidth>=99&&m.utilityHeight>=46,viewport.label+" utility size");
            assert.ok(m.iconWidth>=40&&m.iconHeight>=44,viewport.label+" utility icon size");
            assert.ok(m.labelFont>=12,viewport.label+" utility label size");
            assert.ok(m.utilityCorridor>=m.utilityVisualWidth*.55,viewport.label+" central gate corridor");
            assert.ok(m.actionRosterGap>=-1,viewport.label+" utility/roster overlap");
            assert.ok(m.rosterNavGap>=0,viewport.label+" roster/nav overlap");
            assert.ok(m.rosterMarginTop>=8,viewport.label+" roster downshift");
            assert.ok(m.hudRect.top>=m.homeRect.top-1&&m.hudRect.bottom<=m.homeRect.bottom+1,viewport.label+" HUD crop");
            assert.ok(m.rosterRect.top>=m.homeRect.top-1&&m.rosterRect.bottom<=m.homeRect.bottom+1,viewport.label+" roster crop");
            console.log("✓ "+viewport.label+" portrait layout "+JSON.stringify({
                utility:[m.utilityWidth,m.utilityHeight],corridor:m.utilityCorridor,
                rosterNavGap:m.rosterNavGap,home:[m.homeClient,m.homeScroll]
            }));
            await page.close();
        }
    }finally{
        await browser.close();
    }
})().catch(error=>{ console.error(error); process.exit(1); });
