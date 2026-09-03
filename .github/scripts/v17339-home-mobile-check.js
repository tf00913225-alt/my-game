"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
const executablePath=process.env.BROWSER_PATH;

function character(id,element){
    return {id,element,gender:"male",level:50,exp:0,expNext:1000,attack:10,vitality:10,energy:10,intelligence:10,spirit:10,agility:10,bonusHP:0,bonusSP:0,attributePoints:0,skillPoints:0,hp:500,sp:200,activeBuffs:[],statusEffects:[],isDefending:false};
}

(async()=>{
    const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox"]});
    try{
        for(const viewport of [{width:1080,height:1920,label:"1080x1920"},{width:390,height:844,label:"390x844"}]){
            const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
            await page.goto("http://127.0.0.1:8899/?v17339-home-final-polish=1",{waitUntil:"domcontentloaded",timeout:30000});
            await page.waitForFunction(()=>window.__v146SystemPolishInstalled&&typeof updateUI==="function"&&typeof showPage==="function",null,{timeout:30000});
            await page.evaluate(({p1,p2,p3})=>{
                Object.assign(player,p1); player2=p2; player3=p3;
                if(Array.isArray(characters)){
                    [["player2",p2.id],["player3",p3.id]].forEach(([id,name])=>{ if(!characters.some(c=>c&&c.id===id)){ characters.push({id,name}); } });
                }
                const loader=document.getElementById("startupLoader"); if(loader){ loader.style.display="none"; }
                const creation=document.getElementById("creationPage"); if(creation){ creation.style.display="none"; }
                const gameInterface=document.getElementById("gameInterface"); if(gameInterface){ gameInterface.style.display="block"; }
                showPage("home");
                updateUI();
            },{p1:character("赤炎旅者","fire"),p2:character("寒泉旅者","water"),p3:character("青嵐旅者","wind")});
            await page.waitForFunction(()=>{
                const home=document.getElementById("homePage");
                return home&&home.getBoundingClientRect().height>0&&document.querySelectorAll("#v146HomeRoster .v146-home-character").length===3;
            },null,{timeout:10000});

            const m=await page.evaluate(()=>{
                const rect=node=>{ const r=node.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
                const home=document.getElementById("homePage"), hud=home.querySelector(".home-city-hud"), identity=home.querySelector(".home-hud-identity"), kicker=home.querySelector(".home-hud-kicker"), badge=home.querySelector(".home-version-badge"), roster=document.getElementById("v146HomeRoster"), nav=document.getElementById("bottomNav");
                const utility=[...home.querySelectorAll(".home-card-utility")].sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
                const icon=utility[0].querySelector(".home-card-icon"), label=utility[0].querySelector(".home-card-label");
                const hr=rect(home), hur=rect(hud), ir=rect(identity), rr=rect(roster), nr=rect(nav), ur=utility.map(rect);
                return {innerHeight:window.innerHeight,documentScroll:document.documentElement.scrollHeight,bodyScroll:document.body.scrollHeight,homeClient:home.clientHeight,homeScroll:home.scrollHeight,homeOverflow:getComputedStyle(home).overflow,kickerFont:parseFloat(getComputedStyle(kicker).fontSize),badgeFont:parseFloat(getComputedStyle(badge).fontSize),identityCenterOffset:Math.abs((ir.top+ir.height/2)-(hur.top+hur.height/2)),utilityVisualWidth:ur[0].width,utilityVisualHeight:ur[0].height,iconWidth:parseFloat(getComputedStyle(icon).width),iconHeight:parseFloat(getComputedStyle(icon).height),labelFont:parseFloat(getComputedStyle(label).fontSize),utilityCorridor:ur[1].left-ur[0].right,actionRosterGap:rr.top-Math.max(ur[0].bottom,ur[1].bottom),rosterNavGap:nr.top-rr.bottom,rosterMarginTop:parseFloat(getComputedStyle(roster).marginTop),homeRect:hr,hudRect:hur,rosterRect:rr,navRect:nr,rows:roster.querySelectorAll(".v146-home-character").length};
            });
            console.log("METRICS "+viewport.label+" "+JSON.stringify(m));
            assert.equal(m.rows,3,viewport.label+" roster rows");
            assert.equal(m.homeOverflow,"hidden",viewport.label+" home overflow");
            assert.ok(m.homeScroll<=m.homeClient+1,viewport.label+" home must not scroll");
            assert.ok(m.documentScroll<=m.innerHeight+1&&m.bodyScroll<=m.innerHeight+1,viewport.label+" page must not scroll");
            assert.ok(m.kickerFont>=10&&m.badgeFont>=9,viewport.label+" HUD identity sizing");
            assert.ok(m.identityCenterOffset<=5,viewport.label+" identity vertical centering");
            assert.ok(m.utilityVisualWidth>=99&&m.utilityVisualHeight>=46,viewport.label+" utility size");
            assert.ok(m.iconWidth>=40&&m.iconHeight>=44&&m.labelFont>=12,viewport.label+" utility content size");
            assert.ok(m.utilityCorridor>=m.utilityVisualWidth*.55,viewport.label+" central gate corridor");
            assert.ok(m.actionRosterGap>=-1&&m.rosterNavGap>=0,viewport.label+" no overlap");
            assert.ok(m.rosterMarginTop>=8,viewport.label+" roster downshift");
            assert.ok(m.hudRect.top>=m.homeRect.top-1&&m.hudRect.bottom<=m.homeRect.bottom+1&&m.rosterRect.bottom<=m.homeRect.bottom+1,viewport.label+" no crop");
            console.log("✓ "+viewport.label+" portrait layout verified");
            await page.close();
        }
    }finally{ await browser.close(); }
})().catch(error=>{ console.error(error); process.exit(1); });
