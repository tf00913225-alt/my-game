"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");
const baseUrl=process.argv[2]||"http://127.0.0.1:8899";

(async()=>{
    const executablePath=chromium.executablePath();
    if(!fs.existsSync(executablePath)) throw new Error("Chromium executable is required for skill progression browser QA");
    const browser=await chromium.launch({headless:true,executablePath});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    const errors=[];
    page.on("pageerror",error=>errors.push(String(error)));
    page.on("console",message=>{ if(message.type()==="error") errors.push("console: "+message.text()); });
    page.on("dialog",dialog=>dialog.accept());
    try{
        await page.goto(baseUrl+"/?skill-progression-browser-qa=1",{waitUntil:"domcontentloaded"});
        await page.waitForFunction(()=>window.__v17364SkillProgressionInstalled&&window.__v174TwoTierAbyssInstalled,null,{timeout:30000});
        await page.evaluate(()=>{
            Object.assign(player,{id:"寒泉一號",element:"water",level:19,skillPoints:999,hp:1000,sp:1000,activeBuffs:[],statusEffects:[]});
            player2={id:"寒泉二號",element:"water",level:10,skillPoints:999,hp:1000,sp:1000,activeBuffs:[],statusEffects:[]};
            if(!characters.some(character=>character.id==="player2")) characters.push({id:"player2",name:player2.id});
            characterSkillLoadouts.water={name:player.id,skillLevels:{healSpell:1},equippedSkills:[]};
            characterSkillLoadouts.player2={name:player2.id,skillLevels:{healSpell:1},equippedSkills:[]};
            currentSkillCharacter="water";
            openHomeFeature("character");
            switchCharacterTab("skill");
            renderSkillLoadout();
        });
        await page.waitForTimeout(100);
        const rowState=async()=>page.evaluate(()=>{
            const row=Array.from(document.querySelectorAll("#allSkillsList .skill-row")).find(item=>item.querySelector("#skillIcon_revive"));
            if(!row) return null;
            const card=Array.from(row.querySelectorAll(".skill-action-card"))[0];
            const label=card&&card.querySelector(".skill-action-card-label");
            const rect=row.getBoundingClientRect();
            const cardRect=card&&card.getBoundingClientRect();
            return {
                text:row.textContent.replace(/\s+/g," ").trim(),label:label&&label.textContent.replace(/\s+/g," ").trim(),
                disabled:card&&card.classList.contains("disabled"),onclick:card&&card.getAttribute("onclick"),
                overflowX:row.scrollWidth>row.clientWidth+1,
                overlap:!!(cardRect&&cardRect.left<rect.left-1||cardRect&&cardRect.right>rect.right+1)
            };
        });
        let state=await rowState();
        assert.ok(state);assert.equal(state.disabled,true);assert.match(state.label,/Lv20/);assert.equal(state.overflowX,false);assert.equal(state.overlap,false);

        await page.evaluate(()=>{ player.level=20; currentSkillCharacter="water"; renderSkillLoadout(); });
        state=await rowState();
        assert.equal(state.disabled,false);assert.match(state.onclick,/learnSkill\('revive'\)/);

        await page.evaluate(()=>{ currentSkillCharacter="player2"; renderSkillLoadout(); });
        state=await rowState();
        assert.equal(state.disabled,true);assert.match(state.label,/Lv20/);

        const ui=await page.evaluate(()=>{
            currentSkillCharacter="water";player.level=20;renderSkillLoadout();showSkillDetail("revive");
            const details=document.getElementById("skillDetailStats");
            const list=document.getElementById("allSkillsList");
            const allText=document.getElementById("skillPage").textContent;
            const forbidden=["learnLevel","requires","tier","upgradeCost"].filter(word=>allText.includes(word));
            return {
                details:details.textContent.replace(/\s+/g," ").trim(),
                forbidden,
                listExists:!!list,
                listScrollHeight:list?list.scrollHeight:0,
                viewportHeight:document.getElementById("characterTabContent")?.clientHeight||0,
                horizontalOverflow:Array.from(document.querySelectorAll("#allSkillsList .skill-row")).some(row=>row.scrollWidth>row.clientWidth+1),
                visibleRows:document.querySelectorAll("#allSkillsList .skill-row").length
            };
        });
        for(const label of ["最低學習等級","目前技能等級","下一級角色需求","學習成本","升級成本","前置技能"]) assert.match(ui.details,new RegExp(label));
        assert.deepEqual(ui.forbidden,[]);assert.equal(ui.horizontalOverflow,false);assert.ok(ui.visibleRows>=8);
        assert.ok(ui.listScrollHeight>0&&ui.viewportHeight>0);
        assert.deepEqual(errors,[]);
        console.log("✓ skill progression mobile browser QA passed");
    }finally{ await browser.close(); }
})().catch(error=>{ console.error(error);process.exitCode=1; });
