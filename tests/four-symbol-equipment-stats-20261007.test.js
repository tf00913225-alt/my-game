"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const main=fs.readFileSync("js/00-main.js","utf8");
const expansion=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const progression=fs.readFileSync("js/equipment-progression.js","utf8");
const polish=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const between=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const clean=value=>JSON.parse(JSON.stringify(value));
const ctx=vm.createContext({window:{},characterEquipment:{fire:{}},equipmentSetIcon:()=>"ART",
    getEquipmentBonus:()=>({}),getCharacterSkillKey:character=>character?.key||null,
    migrateLegacyEquipmentStats:require("../functions/src/equipment-combat-percent-migration").migrateItem,
    Math:Object.assign(Object.create(Math),{random:()=>0.5}),
    NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX:1.5,FINAL_CRITICAL_MULTIPLIER_MAX:2.5,
    getDamageLevelMultiplier:()=>1,getElementalDamageMultiplier:()=>1,getDamageFormulaConstant:()=>1000,
    getEnemyPressureMultiplier:()=>1,getTowerDirectDamageMultiplier:()=>1,getDamageBudgetMultiplier:()=>1,
    getRelicDirectDamageMultiplier:()=>1,
    elementDatabase:{fire:{name:"火"},water:{name:"水"},earth:{name:"土"},wind:{name:"風"}},
    inventorySlots:[],selectedInventorySlot:0,inventoryCharacterIndex:0,
    getBackpackCharacter:()=>ctx.actor,document:{getElementById:()=>({dataset:{}})},
    alert:message=>ctx.alerts.push(message),alerts:[],equipSelectedItem:()=>{ctx.equipped++;},equipped:0
});
vm.runInContext(between(expansion,"    const EQUIPMENT_SET_PIECES=","    function getEquipmentSetItemDefinitions("),ctx);
vm.runInContext("window.v132GetContentDefinitions=()=>({equipmentSetItems:equipmentSetItemDefinitions});",ctx);
vm.runInContext(between(expansion,"    function getEquipmentSetCounts(","\n\n    /* =====================================================\n       11."),ctx);
vm.runInContext(between(progression,"    function addOrangeClass(","    /*\n       First-character equipment"),ctx);
const normalize=ctx.window.v132NormalizeEquipmentSetItem;
const definitions=ctx.window.v132GetContentDefinitions().equipmentSetItems;
const expected={blade:{attack:30},fan:{intelligence:30},heavyArmor:{defensePoints:25,agility:5},robe:{defensePoints:25,agility:5},boots:{attack:20,defensePoints:10},shoes:{intelligence:20,defensePoints:10},helm:{attack:25,vitality:5},crown:{intelligence:25,vitality:5},wristguard:{attack:25},focus:{intelligence:25}};
const families={setFire:"fire",setWater:"water",setEarth:"earth",setWind:"wind"};
assert.equal(definitions.length,40);
for(const [setId,element] of Object.entries(families)){
    for(const [piece,stats] of Object.entries(expected)){
        const def=definitions.find(item=>item.id===setId+"_"+piece);
        assert.deepEqual(clean(def.stats),stats);
        assert.equal(def.requiredElement,element);assert.equal(def.levelRequirement,20);
        const legacy={id:def.id,setId,stats:{attack:15,vitality:-2,evasion:10,antiCrit:0.5,statusResistance:0.25},reforgeStats:{attack:3,spirit:10},sockets:["gemVitalityI"],v141Uid:"KEEP",count:1};
        ctx.applySetRule(legacy);ctx.applySetRule(legacy);
        assert.deepEqual(clean(legacy.stats),stats,"old base must not leak into the new base");
        assert.deepEqual(clean(legacy.reforgeStats),{attack:3,accuracy:3,antiCrit:1,statusResistance:0.5});
        assert.deepEqual(legacy.sockets,["gemVitalityI"]);assert.equal(legacy.v141Uid,"KEEP");
        assert.match(legacy.name,/\[(攻|法)\]$/);
    }
    ctx.actor={element,key:"fire",level:20};
    for(const role of ["attack","magic"]){
        const pieces=definitions.filter(item=>item.setId===setId&&item.setVariant===role);
        for(let count=0;count<=5;count++){
            ctx.characterEquipment.fire=Object.fromEntries(pieces.slice(0,count).map((item,i)=>["slot"+i,item]));
            const bonus=ctx.getEquipmentBonus("fire");
            for(const stat of ["attack","intelligence","vitality","energy","defensePoints","agility"]){assert.equal(bonus[stat]||0,count>=3?5:0);}
            assert.equal(bonus.evasion,undefined);assert.equal(bonus.antiCrit,undefined);assert.equal(bonus.statusResistance,undefined);
            assert.equal(ctx.window.v132GetEquipmentSetSkillDamageBonusPercent(ctx.actor,{element}),count===5?5:0);
        }
        ctx.characterEquipment.fire=Object.fromEntries([pieces[0],pieces[1],...definitions.filter(item=>item.setId===setId&&item.setVariant!==role).slice(0,3)].map((item,i)=>["slot"+i,item]));
        assert.equal(ctx.getEquipmentBonus("fire").defensePoints,5,"only the same-role three pieces activate");
        assert.equal(ctx.window.v132GetEquipmentSetSkillDamageBonusPercent(ctx.actor,{element}),0,"mixed five pieces never activate five-piece effect");
    }
    vm.runInContext(between(expansion,'    if(typeof equipSelectedItem==="function"){','\n\n    /* =====================================================\n       12.'),ctx);
    ctx.inventorySlots=[definitions.find(item=>item.setId===setId)];
    ctx.actor.level=19;const before=ctx.equipped;ctx.equipSelectedItem();assert.equal(ctx.equipped,before);
    ctx.actor.level=20;ctx.actor.element=element==="fire"?"water":"fire";ctx.equipSelectedItem();assert.equal(ctx.equipped,before);
    ctx.actor.element=element;ctx.equipSelectedItem();assert.equal(ctx.equipped,before+1);
}
vm.runInContext(between(main,"function getDamageContextAttacker(","function isPartyDamageTarget("),ctx);
vm.runInContext(between(main,"function getBattleDamageSource(","function getFormalDamageContext("),ctx);
vm.runInContext(between(main,"function calculateDamage(","/* =====================================================\n   命中／閃躲"),ctx);
ctx.actor={element:"fire",key:"fire"};ctx.characterEquipment.fire=Object.fromEntries(definitions.filter(item=>item.setId==="setFire"&&item.setVariant==="attack").map((item,i)=>["slot"+i,item]));
const damage=options=>ctx.calculateDamage(1000,0,20,20,"fire","fire",{attacker:ctx.actor,...options});
assert.equal(damage({}),1000,"normal attack receives no set skill damage");
assert.equal(damage({skill:{element:"fire",category:"physical"}}),1050);
assert.equal(damage({skill:{element:"fire",category:"magic"}}),1050,"role does not restrict skill category");
assert.equal(damage({skill:{element:"water"}}),1000);
assert.equal(damage({skill:{element:"fire"},sourceType:"activeSkill",damageKind:"dot"}),1000);
assert.equal(damage({skill:{element:"fire"},sourceType:"followUp"}),1050);
for(const sourceType of ["normalAttack","dot","reflect","environment","relic"]){assert.equal(damage({skill:{element:"fire"},sourceType}),1000);}
ctx.escapeHtml=value=>String(value);
let modalHtml="";
ctx.document.getElementById=()=>({insertAdjacentHTML:(_position,html)=>{modalHtml=html;}});
ctx.getBackpackEquipmentKey=()=>"fire";
vm.runInContext(between(expansion,"    function getSetLabel(","    window.v132GetOreDefinition="),ctx);
vm.runInContext(between(expansion,"    function appendEquipmentSetInfo(","    if(typeof openItemModal==="),ctx);
ctx.appendEquipmentSetInfo(definitions.find(item=>item.id==="setFire_blade"));
assert.match(modalHtml,/\[赤炎•攻\]5\/5/);assert.match(modalHtml,/全能力\+5/);assert.match(modalHtml,/火元素技能傷害\+5%/);
modalHtml="";ctx.appendEquipmentSetInfo({id:"ticketSetFire",setId:"setFire"});assert.equal(modalHtml,"","tickets are not equipment set pieces");
assert.doesNotMatch(polish,/const PIECE_RULES=|variantCountsForEquipment|getEquipmentBonus\s*=|getElementDamagePassiveMultiplier\s*=/,"late correction owners retired");
assert.doesNotMatch(progression,/const SET_RULES=/);
assert.match(expansion,/裝備三件　全能力\+5/);assert.match(expansion,/元素技能傷害\+5%/);
console.log("PASS: all 40 pieces, 8 independent sets, thresholds, old saves/reforge/sockets, Lv19/20, element locks and actual direct-damage formula");
