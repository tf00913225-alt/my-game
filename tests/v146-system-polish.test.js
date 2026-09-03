/* HISTORICAL SPEC SNAPSHOT (V146): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const ui=fs.readFileSync("js/35-v141-ui-battle.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const fixes=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const rules=fs.readFileSync("js/40-v144-rules-and-abyss.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const source=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const css=fs.readFileSync("css/42-v146-system-polish.css","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

function element(extra={}){
    return Object.assign({
        style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},
        querySelector:()=>null,querySelectorAll:()=>[],offsetParent:{},
        getBoundingClientRect:()=>({left:0,top:0,width:400,height:500})
    },extra);
}

function baseContext(overrides={}){
    const listeners={};
    const context=Object.assign({
        window:null,console,Math,Date,Number,Object,Array,Set,Map,Promise,
        setTimeout:()=>1,clearTimeout(){},alert(){},gold:100,
        document:{
            readyState:"loading",body:element(),
            addEventListener(type,handler){ listeners[type]=handler; },
            getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]
        }
    },overrides);
    context.window=context;
    context.__listeners=listeners;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V146 remains ordered before V149 under the current cache key",()=>{
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.41/);
    assert.match(loader,/const V_ASSET_VERSION="173\.41"/);
    assert.match(loader,/css\/42-v146-system-polish\.css/);
    const paths=[
        "js/39-v143-skill-animation.js","js/40-v144-rules-and-abyss.js","js/41-v146-system-polish.js"
    ].map(path=>loader.indexOf(path));
    assert.ok(paths.every(position=>position>=0));
    assert.deepEqual(paths.slice().sort((a,b)=>a-b),paths);
});

test("latest skill table contains every exact requested value",()=>{
    [
        /baseHeal:350,healPerLevel:30,baseHealSP:35,healSPPerLevel:30/,
        /defenseBonusPercent:30,requires:\["barrier"\]/,
        /reflectPercent:50,requires:\["stoneBreakSky","flyingSandStrike"\]/,
        /damageBonusPercent:5,healBonusPercent:10,statusResistBonus:10/,
        /baseDamage:100,damagePerLevel:15,spCost:50/,
        /freezeChance:75,freezeDuration:2,lifestealPercentByLevel:\[4,5,6,7,8\]/,
        /freezeChance:50,freezeDuration:2,freezeSingleTarget:false/,
        /critChanceBonusByLevel:\[5,10,15,20,25\]/,
        /critDamageBonusByLevel:\[10,20,30,40,50\]/,
        /burnChance:70,burnDuration:2,burnPercentByLevel:\[5,7,9,11,13\]/
    ].forEach(pattern=>assert.match(rules,pattern));
});

test("battle timing, dead-target filtering and named choreography are enforced",()=>{
    assert.match(timing,/earliestAt:Math\.max\([\s\S]*boundaryGate\?boundaryGate\.deadline:0/);
    assert.match(animation,/function canReceive\(config,side,index\)/);
    assert.match(animation,/entity\.hp\)>0/);
    assert.match(animation,/getSkillTargets\(queued\.target,targetType\)/);
    assert.match(animation,/sequence:"風起雲湧"/);
    assert.match(animation,/id==="dragonSlash"[\s\S]*<svg class="v146-flight-art"/);
    assert.match(animation,/id==="phoenixCry"[\s\S]*<svg class="v146-flight-art"/);
    assert.match(animation,/id==="iceArrowRain"\|\|id==="fireRocket"/);
    assert.match(css,/background:transparent !important/);
    assert.match(css,/\.badge-normal[\s\S]*color:#fff !important/);
    assert.match(css,/@keyframes v146AreaImpact/);
    assert.match(css,/\.v146-status-popup/);
    assert.match(source,/rect\.top\+rect\.height\*\.86/);
    assert.match(source,/setTimeout\(\(\)=>popup\.remove\(\),1300\)/);
    assert.match(css,/animation:v146StatusPopup 1\.25s ease-out both/);
    assert.match(css,/10%,90%\{opacity:1/);
});

test("shop quantity calculates and disables against the live total",()=>{
    const button={disabled:false};
    const parent={querySelector:()=>button};
    const input={value:"7",dataset:{unitPrice:"45"},parentElement:parent};
    const output={textContent:"",dataset:{}};
    const context=baseContext({
        gold:300,
        document:{
            readyState:"loading",body:element(),addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],
            getElementById:id=>id==="shopQuantity-hpPotion20"?input:id==="shopTotal-hpPotion20"?output:null
        }
    });
    assert.equal(context.v146UpdateShopTotal("hpPotion20"),315);
    assert.equal(output.textContent,"315 金幣");
    assert.equal(output.dataset.total,"315");
    assert.equal(button.disabled,true);
});

test("all forty set pieces receive exact stats, role names and element locks",()=>{
    const pieceKeys=["blade","fan","heavyArmor","robe","boots","shoes","helm","crown","wristguard","focus"];
    const setIds=["setFire","setWater","setEarth","setWind"];
    const definitions=setIds.flatMap(setId=>pieceKeys.map(key=>({id:setId+"_"+key,setId,stats:{}})));
    const context=baseContext({
        inventoryItems:[],characterEquipment:{},
        v132GetContentDefinitions:()=>({equipmentSetItems:definitions})
    });
    assert.equal(definitions.length,40);
    assert.deepEqual(JSON.parse(JSON.stringify(definitions.find(item=>item.id==="setFire_blade").stats)),{attack:10,vitality:-2});
    assert.deepEqual(JSON.parse(JSON.stringify(definitions.find(item=>item.id==="setWater_boots").stats)),{attack:2,agility:10});
    assert.deepEqual(JSON.parse(JSON.stringify(definitions.find(item=>item.id==="setEarth_shoes").stats)),{intelligence:2,agility:10});
    assert.deepEqual(JSON.parse(JSON.stringify(definitions.find(item=>item.id==="setWind_heavyArmor").stats)),{attack:5,spirit:5});
    assert.equal(definitions.find(item=>item.id==="setWater_crown").name,"寒泉冠[法]");
    assert.equal(definitions.find(item=>item.id==="setEarth_wristguard").requiredElement,"earth");
    assert.ok(definitions.every(item=>item.levelRequirement===20));
    assert.ok(context.v146Diagnostics().setElementRestriction);
});

test("turning on auto outside combat immediately consumes configured recovery",()=>{
    let recovered=0,updated=0,saved=0;
    const context=baseContext({
        battleActive:false,autoBattle:false,
        toggleAutoBattle(){ this.autoBattle=!this.autoBattle; },
        applyPostBattleAutoRecovery(){ recovered++; },
        updateUI(){ updated++; },saveGame(){ saved++; }
    });
    context.toggleAutoBattle();
    assert.equal(context.autoBattle,true);
    assert.equal(recovered,1);
    assert.equal(updated,1);
    assert.equal(saved,1);
});

test("Abyss rapid taps are locked, one step is bounded and NPC portrait remains directly clickable",()=>{
    let moves=0,challenges=0;
    const map=element({
        dataset:{},classList:{add(){},remove(){}},
        querySelector:selector=>selector===".v141-abyss-boss"?boss:null,
        getBoundingClientRect:()=>({left:0,top:0,width:400,height:500})
    });
    const player=element({style:{left:"18%",top:"78%"}});
    const boss=element({style:{left:"70%",top:"26%"}});
    const message={textContent:""};
    const context=baseContext({
        v141AbyssMoveByEvent(event){
            moves++;
            player.style.left=(event.clientX/400*100)+"%";
            player.style.top=(event.clientY/500*100)+"%";
        },
        v141ChallengeAbyssBoss(){ challenges++; },
        document:{
            readyState:"loading",body:element(),addEventListener(){},querySelector:()=>message,querySelectorAll:()=>[],
            getElementById:id=>id==="v141AbyssMap"?map:id==="v141AbyssPlayer"?player:null
        }
    });
    const event={clientX:390,clientY:30,target:{closest:()=>null}};
    context.v141AbyssMoveByEvent(event);
    context.v141AbyssMoveByEvent(event);
    assert.equal(moves,1,"the second rapid tap is ignored while walking");
    assert.ok(Math.hypot(parseFloat(player.style.left)-18,parseFloat(player.style.top)-78)<=24.001);
    map.dataset.v146Moving="0";
    context.v141ChallengeAbyssBoss();
    assert.equal(challenges,1);
    assert.equal(message.textContent,"");
});

test("inventory, home, synthesis, nav and slow exit all use the latest mobile contract",()=>{
    assert.match(ui,/const INVENTORY_PAGE_SIZE=18/);
    assert.match(ui,/←/); assert.match(ui,/→/);
    assert.match(ui,/\},2700\)/);
    assert.match(css,/grid-template-rows:repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(source,/v146-home-roster/);
    assert.match(source,/root\.querySelectorAll\("\.v141-blueprint-series"\).*remove/);
    assert.match(source,/buttons\.push\(\["返回"/);
    assert.match(css,/#v141DungeonNav\[data-v146-columns="4"\]/);
    assert.match(css,/\.v146-abyss-return/);
    assert.match(rules,/"戰鬥失敗"/);
    assert.match(index,/assets\/ui\/home-shop\.png/);
    [fixes,source].forEach(file=>assert.match(file,/assets\/ui\/home-shop-v147\.png/));
    const shopIcon=fs.readFileSync("assets/ui/home-shop-v147.png");
    assert.equal(shopIcon.subarray(1,4).toString(),"PNG");
    assert.equal(shopIcon[25],6,"shop icon must retain an RGBA alpha channel");
});

console.log("\nV146 system polish suite: "+passed+" tests passed.");
