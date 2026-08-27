"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");

const baseUrl=process.argv[2]||"http://127.0.0.1:8899";

async function waitForV138(page){
    await page.goto(baseUrl+"/?v138-browser-smoke=1",{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>{
        return !!(
            window.v138BattlePacing &&
            window.v132ShowItemPreview &&
            window.v138GetEquipmentDungeonComposition &&
            window.v138GetExpDungeonRewardExp
        );
    },null,{timeout:20000});
}

async function seedParty(page){
    await page.evaluate(()=>{
        Object.assign(player,{
            id:"赤炎測試者",
            element:"fire",
            gender:"male",
            level:20,
            exp:0,
            expNext:50000,
            skillPoints:45,
            hp:2000,
            sp:1000,
            activeBuffs:[],
            statusEffects:[]
        });
        player2={
            id:"寒泉測試者",
            element:"water",
            gender:"female",
            level:21,
            exp:0,
            expNext:60000,
            attack:0,
            vitality:20,
            energy:20,
            intelligence:0,
            spirit:0,
            agility:0,
            bonusHP:0,
            bonusSP:0,
            attributePoints:0,
            skillPoints:20,
            hp:1100,
            sp:350,
            activeBuffs:[],
            statusEffects:[],
            isDefending:false
        };
        if(!characters.some(character=>character.id==="player2")){
            characters.push({id:"player2",name:player2.id});
        }
        characterEquipment.player2={head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
        characterSkillLoadouts.player2={name:player2.id,skillLevels:{},equippedSkills:[]};
        characterEquipment.fire={head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
        currentSkillCharacter="fire";
        inventoryCharacterIndex=0;
        renderSkillLoadout();
        updateUI();
    });
}

(async()=>{
    const executablePath=chromium.executablePath();
    if(!fs.existsSync(executablePath)){
        console.log("↷ V138 browser smoke skipped: Chromium executable is not installed");
        return;
    }
    const browser=await chromium.launch({
        headless:true,
        executablePath
    });
    const page=await browser.newPage({viewport:{width:420,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on("pageerror",error=>errors.push(String(error)));
    page.on("console",message=>{
        if(message.type()==="error"){ errors.push("console: "+message.text()); }
    });
    page.on("dialog",dialog=>dialog.accept());

    try{
        await waitForV138(page);
        await seedParty(page);

        const skillUi=await page.evaluate(()=>{
            const summary=document.querySelector(".v138-skill-point-summary");
            const point=document.getElementById("skillPoints");
            const costs=Array.from(document.querySelectorAll(".v138-skill-learn-cost"));
            return {
                label:summary ? summary.textContent.replace(/\s+/g," ").trim() : "",
                pointText:point ? point.textContent : "",
                pointFont:point ? parseFloat(getComputedStyle(point).fontSize) : 0,
                costs:costs.map(element=>element.textContent.trim())
            };
        });
        assert.match(skillUi.label,/剩餘技能點/);
        assert.equal(skillUi.pointText,"45");
        assert.ok(skillUi.pointFont>=22);
        assert.ok(skillUi.costs.length>=1);
        assert.ok(skillUi.costs.every(text=>/^學習需要 \d+ 技能點$/.test(text)));

        const expReward=await page.evaluate(()=>window.v138GetExpDungeonRewardExp());
        assert.equal(expReward,6050);

        await page.evaluate(()=>{
            inventoryItems.length=0;
            inventoryItems.push({
                id:"materialChest",
                name:"材料寶箱",
                icon:"📦",
                type:"chest",
                price:0,
                stats:{},
                count:2
            });
            rebuildInventorySlots();
            openItemModal(0);
        });
        const chestButtons=await page.evaluate(()=>
            Array.from(document.querySelectorAll("#itemModal .item-modal-buttons button"))
                .filter(button=>getComputedStyle(button).display!=="none")
                .map(button=>button.textContent.trim())
        );
        assert.deepEqual(chestButtons,["開啟","預覽"]);
        await page.click("#v132ItemPreviewButton");
        const chestPreview=await page.evaluate(()=>({
            rows:document.querySelectorAll("#v132RewardModal .v132-preview-row").length,
            text:document.getElementById("v132RewardModal").textContent.replace(/\s+/g," ")
        }));
        assert.equal(chestPreview.rows,24);
        assert.match(chestPreview.text,/低階礦石 ×10 40%/);
        assert.match(chestPreview.text,/低階頭部設計圖 ×10 8%/);
        assert.match(chestPreview.text,/極品衣服設計圖 ×5 2%/);
        await page.evaluate(()=>v132CloseRewardModal());

        await page.evaluate(()=>{
            closeItemModal();
            inventoryItems.length=0;
            inventoryItems.push({
                id:"ticketSetEarth",
                name:"岩岳裝備抽獎券",
                icon:"🎟️",
                type:"ticket",
                price:0,
                stats:{},
                count:1
            });
            rebuildInventorySlots();
            openItemModal(0);
        });
        const ticketButtons=await page.evaluate(()=>
            Array.from(document.querySelectorAll("#itemModal .item-modal-buttons button"))
                .filter(button=>getComputedStyle(button).display!=="none")
                .map(button=>button.textContent.trim())
        );
        assert.deepEqual(ticketButtons,["開啟","預覽"]);
        await page.click("#v132ItemPreviewButton");
        const ticketPreview=await page.evaluate(()=>({
            items:document.querySelectorAll("#v132RewardModal .v132-preview-item").length,
            chances:Array.from(document.querySelectorAll("#v132RewardModal .v132-preview-item b"))
                .map(element=>element.textContent.trim())
        }));
        assert.equal(ticketPreview.items,10);
        assert.ok(ticketPreview.chances.every(chance=>chance==="10%"));
        await page.evaluate(()=>v132CloseRewardModal());

        const setDisplay=await page.evaluate(()=>{
            const makePiece=(name,slot)=>({
                id:"test"+slot,
                name,
                icon:"◇",
                type:slot==="hand" ? "weapon" : slot,
                setId:"setEarth",
                stats:{}
            });
            characterEquipment.fire.head=makePiece("岩岳盔","head");
            characterEquipment.fire.hand=makePiece("岩岳刀","hand");
            characterEquipment.fire.armor=makePiece("岩岳鎧甲","armor");
            openEquippedItem(characterEquipment.fire.head,"head");
            return {
                title:document.querySelector(".v132-set-title")?.textContent||"",
                active:document.querySelector(".v132-set-bonus.active")?.textContent||"",
                inactive:document.querySelector(".v132-set-bonus.inactive")?.textContent||""
            };
        });
        assert.equal(setDisplay.title,"[岩岳]3/5");
        assert.match(setDisplay.active,/全能力\+1.*已啟動/);
        assert.match(setDisplay.inactive,/土元素技能傷害\+2%.*未啟動/);

        const confirmation=await page.evaluate(()=>{
            closeItemModal();
            let message="";
            const originalConfirm=window.confirm;
            window.confirm=text=>{ message=text; return false; };
            const before=battleActive;
            v132BeginExpDungeon();
            window.confirm=originalConfirm;
            return {message,before,after:battleActive};
        });
        assert.match(confirmation.message,/確定要進入「經驗副本」嗎/);
        assert.equal(confirmation.before,confirmation.after);

        await page.evaluate(()=>{
            inventoryItems.length=0;
            rebuildInventorySlots();
            window.confirm=()=>true;
            v132BeginEquipmentDungeon();
        });
        await page.waitForFunction(()=>document.querySelectorAll("#battleMonsterArea .battle-monster").length===5);
        const equipmentBattle=await page.evaluate(()=>{
            const row=Array.from(document.querySelectorAll("#battleMonsterArea .v131-monster-row"))[0];
            const cards=row ? Array.from(row.querySelectorAll(".battle-monster")) : [];
            return {
                ranks:cards.map(card=>card.dataset.rank),
                centerRanks:cards.slice(1,3).map(card=>card.dataset.rank),
                playerElements:Array.from(document.querySelectorAll("#battlePlayerRow .battle-player"))
                    .map(card=>card.dataset.element),
                bossNameColor:getComputedStyle(cards.find(card=>card.dataset.rank==="boss")
                    .querySelector(".battle-monster-name")).color,
                eliteNameColor:getComputedStyle(cards.find(card=>card.dataset.rank==="elite")
                    .querySelector(".battle-monster-name")).color,
                bossCount:currentBattleMonsters.filter(index=>getMonsterRank(monsters[index])==="boss").length,
                eliteCount:currentBattleMonsters.filter(index=>getMonsterRank(monsters[index])==="elite").length
            };
        });
        assert.equal(equipmentBattle.bossCount,2);
        assert.equal(equipmentBattle.eliteCount,3);
        assert.deepEqual(equipmentBattle.centerRanks,["boss","boss"]);
        assert.deepEqual(equipmentBattle.playerElements,["fire","water"]);
        assert.equal(equipmentBattle.bossNameColor,"rgb(255, 95, 162)");
        assert.equal(equipmentBattle.eliteNameColor,"rgb(255, 159, 67)");

        const pacing=await page.evaluate(()=>{
            battleActive=true;
            battlePhase="resolve";
            battleToken=999;
            timerId=null;
            battleAdvanceScheduled=false;
            battleAdvanceTimeoutId=null;
            processedInitiativeIndexes=new Set();
            currentBattleMonsters=[2];
            monsters[0]={alive:false};
            monsters[1]={alive:false};
            monsters[2]={alive:true};
            initiativeQueue=[
                {type:"player",characterIndex:0},
                {type:"monster",monsterIndex:0},
                {type:"monster",monsterIndex:1}
            ];
            initiativeIndex=0;
            const originalSetTimeout=window.setTimeout;
            const originalCheckBattleEnd=checkBattleEnd;
            const delays=[];
            window.setTimeout=(handler,delay)=>{ delays.push(delay); return 123; };
            checkBattleEnd=()=>false;
            finishPlayerAction();
            window.setTimeout=originalSetTimeout;
            checkBattleEnd=originalCheckBattleEnd;
            return {
                delays,
                initiativeIndex,
                pacing:window.v138BattlePacing
            };
        });
        assert.deepEqual(pacing.delays,[400]);
        assert.equal(pacing.initiativeIndex,3);
        assert.equal(pacing.pacing.actionDelayMs,1600);
        assert.equal(pacing.pacing.roundDelayMs,2000);
        assert.equal(pacing.pacing.roundHandoffDelayMs,400);

        assert.deepEqual(errors,[]);
        console.log("✓ V138 browser smoke passed");
    }finally{
        await browser.close();
    }
})().catch(error=>{
    console.error(error);
    process.exitCode=1;
});
