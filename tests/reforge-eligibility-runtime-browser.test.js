"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const read=p=>fs.readFileSync(p,"utf8");
const forge=read("js/36-v141-content-systems.js");
const progression=read("js/equipment-progression.js");
const inventory=read("js/55-v173.51-inventory-qa.js");
assert.doesNotMatch(progression,/selectedReforgeItem|previousStartReforge|previousResolveReforge/);
assert.doesNotMatch(inventory,/selectedForge|window\.v141StartReforge\s*=/);
const writers=fs.readdirSync("js").filter(p=>p.endsWith(".js")).filter(p=>/window\.v141StartReforge\s*=/.test(read("js/"+p)));
assert.deepEqual(writers,["36-v141-content-systems.js"],"one final runtime reforge owner");
const candidates=[process.env.CHROME_BIN,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe","/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean);
const chrome=candidates.find(p=>fs.existsSync(p));
if(!chrome){ console.log("reforge runtime browser: SKIPPED (Chrome unavailable)"); process.exit(0); }
const main=read("js/00-main.js"),v132=read("js/27-v132-content-expansion.js");
const itemOwner=main.slice(main.indexOf("const ITEM_MODAL_PRESENTATION_MODES = new Set(["),main.indexOf("function openEquippedItem("));
const transaction=v132.slice(v132.indexOf("    function cloneInventorySnapshot(){"),v132.indexOf("    /* =====================================================",v132.indexOf("window.v132RunInventoryTransaction=runInventoryTransaction;")));
const script=s=>"<script>"+s.replace(/<\/script/gi,"<\\/script")+"</script>";
const fixture=path.resolve(".reforge-eligibility-browser.html");
const profile=path.resolve(".reforge-browser-profile");
const setup=`
var inventoryItems=[],inventorySlots=Array(120).fill(null),characterEquipment={},selectedInventorySlot=null,gold=100000,skillDatabase={stormSpell:{}},saveFails=false,saved=null,alerts=[];
window.FourSymbolsAccountSave={accountKey:k=>'fixture:'+k};
window.v132GetContentDefinitions=()=>({ores:[{id:'oreWhite',type:'material',name:'白階礦石',tierKey:'white'}],equipmentSetItems:[],equipmentSets:[],talismans:[],blueprints:[],tickets:[]});
function $(id){return document.getElementById(id)}
function isEquipmentInventoryType(t){return ['weapon','hand','head','shoulder','shoes','armor'].includes(t)}
function getStatText(s){return Object.entries(s||{}).map(([k,v])=>'<div>'+k+' +'+v+'</div>').join('')}
function rebuildInventorySlots(){inventorySlots.fill(null);inventoryItems.forEach((i,n)=>inventorySlots[n]=i)}
function saveGame(){if(saveFails)return false;saved=JSON.stringify({inventoryItems,characterEquipment,gold});return true}
function updateUI(){} function updateGoldDisplay(){} function openHomeFeature(){} function closeHomeFeature(){} function closeItemModal(){$('itemModal').classList.remove('show')}
window.rpgAlert=(message)=>{alerts.push(message);return Promise.resolve()};window.alert=message=>alerts.push(message);
window.v132ShowRewardModal=()=>{};
`;
const cases=`
const ok=(x,m)=>{if(!x)throw Error(m)},eq=(a,b,m)=>ok(JSON.stringify(a)===JSON.stringify(b),m+': '+JSON.stringify(a));
const gear=(uid,rarity='purple',slots=1)=>({id:'fixture-'+uid,v141Uid:uid,type:'armor',name:rarity+' '+uid,rarityKey:rarity,stats:{vitality:7},reforgeStats:{attack:18},reforgeSlots:slots,reforgeUsed:0,icon:'◇'});
const bag=gear('bag'),worn=gear('worn','orange'),plain=gear('plain','white',0);plain.reforgeStats=null;
inventoryItems=[bag,plain,{id:'oreWhite',type:'material',count:1000,stats:{}}];characterEquipment={fixture:{armor:worn}};rebuildInventorySlots();
const stock=()=>inventoryItems.find(i=>i.id==='oreWhite').count;
const assets=()=>JSON.stringify({inventoryItems,characterEquipment,gold});
const open=()=>openHomeFeature('forge');
const choose=uid=>{const picker=$('homeFeatureModalBody').querySelector('details');picker.open=true;const b=[...picker.querySelectorAll('button')].find(b=>b.dataset.forgeValue===uid);ok(b,'picker option '+uid);b.click()};
const start=()=>{const b=$('homeFeatureModalBody').querySelector('.v141-synthesis-primary');ok(b&&!b.disabled,'start enabled');b.click();ok($('homeFeatureModalBody').textContent.includes('本次新效果'),'actual comparison appears')};
const resolve=apply=>{const b=[...$('homeFeatureModalBody').querySelectorAll('button')].find(b=>b.textContent===(apply?'套用新效果':'保留原效果'));ok(b,'resolve control');b.click()};
const beforeOwner=window.v141StartReforge;ok(!beforeOwner.toString().includes('select['),'final owner uses state');
open();choose('bag');const old={...bag.reforgeStats},base={...bag.stats};const firstGold=gold,firstStock=stock();start();eq(gold,firstGold-1000,'purple gold cost');eq(stock(),firstStock-50,'purple ore cost');
choose('worn');ok($('homeFeatureModalBody').textContent.includes('purple bag'),'pending target cannot be discarded by picker');resolve(false);eq(bag.reforgeStats,old,'keep original');eq(bag.stats,base,'original attributes');
choose('worn');start();resolve(true);ok(worn.reforgeStats.attack!==undefined||worn.reforgeStats.intelligence!==undefined,'equipped orange applied');eq(worn.stats,{vitality:7},'worn base unchanged');
choose('bag');start();resolve(true);ok(bag.reforgeStats.attack!==undefined||bag.reforgeStats.intelligence!==undefined,'bag purple applied');
openItemModal(0);ok($('itemModalStats').textContent.includes('可冶煉'),'detail eligible');$('v17351EquipmentLockButton').click();ok($('itemModalStats').textContent.includes('裝備已鎖定，無法冶煉'),'detail locked');ok($('itemModalStats').textContent.includes('冶煉槽'),'locked slots preserved');ok(!$('itemModalStats').textContent.includes('可冶煉'),'locked not eligible');ok(!$('homeFeatureModalBody').querySelector('[data-forge-value="bag"]'),'locked removed from picker');
let snapshot=assets();ok(v141StartReforge()===false,'locked execution blocked');eq(assets(),snapshot,'locked no spend');ok(alerts.at(-1).includes('鎖定'),'truthful locked reason');$('v17351EquipmentLockButton').click();ok($('itemModalStats').textContent.includes('可冶煉'),'unlock detail');ok($('homeFeatureModalBody').querySelector('[data-forge-value="bag"]'),'unlock picker');
openItemModal(1);ok(!$('itemModalStats').textContent.includes('可冶煉'),'no slots detail');snapshot=assets();v141SelectReforgeItem('plain');eq(assets(),snapshot,'no slots selection no spend');ok(alerts.at(-1).includes('沒有冶煉槽'),'truthful no slots reason');
choose('bag');inventoryItems.find(i=>i.id==='oreWhite').count=49;open();snapshot=assets();v141StartReforge();eq(assets(),snapshot,'insufficient ore no spend');inventoryItems.find(i=>i.id==='oreWhite').count=1000;gold=999;open();snapshot=assets();v141StartReforge();eq(assets(),snapshot,'insufficient gold no spend');gold=100000;
saveFails=true;snapshot=assets();ok(v141StartReforge()===false,'failed save blocks');eq(assets(),snapshot,'failed save restores gold and ore');saveFails=false;
// Transaction rollback legitimately restores bag object instances; resolve by UID again.
open();choose('bag');const current=inventoryItems.find(i=>i.v141Uid==='bag');start();const original=current.reforgeStats;saveFails=true;ok(v141ResolveReforge(true)===false,'resolve save failure');eq(current.reforgeStats,original,'resolve stats rollback');saveFails=false;resolve(true);
const duplicate={...current,stats:{...current.stats}};inventoryItems.push(duplicate);snapshot=assets();ok(!FourSymbolsReforge.canReforge(current),'duplicate UID rejected');ok(v141StartReforge()===false,'duplicate start blocked');eq(assets(),snapshot,'duplicate no spend');inventoryItems.pop();
const invalid={...current,v141Uid:22};inventoryItems.push(invalid);ok(!FourSymbolsReforge.canReforge(invalid),'numeric UID rejected');inventoryItems.pop();
current.reforgeSlots=Infinity;snapshot=assets();ok(v141StartReforge()===false,'malformed slots rejected');eq(assets(),snapshot,'malformed no spend');current.reforgeSlots=1;
inventoryItems.splice(inventoryItems.indexOf(current),1);snapshot=assets();ok(v141StartReforge()===false,'removed target blocked');eq(assets(),snapshot,'stale target never operates worn');inventoryItems.unshift(current);
open();choose('bag');start();current.v17351Locked=true;v141RenderSynthesis();ok(v141ResolveReforge(true)===false,'locked pending cannot apply');ok(v141ResolveReforge(false)===true,'locked pending can retain');current.v17351Locked=false;
open();choose('bag');start();const replacement={...current};inventoryItems[0]=replacement;ok(v141ResolveReforge(true)===false,'same UID replacement cannot receive pending result');ok(v141ResolveReforge(false)===true,'replacement can retain without mutation');
saveGame();const loaded=JSON.parse(saved);inventoryItems=loaded.inventoryItems;characterEquipment=loaded.characterEquipment;gold=loaded.gold;rebuildInventorySlots();closeHomeFeature();open();choose('bag');openItemModal(0);ok($('itemModalStats').textContent.includes('可冶煉'),'loaded detail');ok(FourSymbolsReforge.canReforge(inventoryItems[0]),'reload UID and affixes retained');start();resolve(false);
window.__qaResults={passed:12,alerts:alerts.length,ownerUnchanged:window.v141StartReforge===beforeOwner};
`;
const markup='<!doctype html><meta charset="utf-8"><div id="homeFeatureModal"><h2 id="homeFeatureModalTitle"></h2><div id="homeFeatureModalBody"></div></div><div id="itemModal"><div><div id="itemModalIcon"></div><div id="itemModalName"></div><div id="itemModalStats"></div><div class="item-modal-buttons"><button id="itemEquipButton">穿戴</button></div></div></div><pre id="result"></pre>'+
    script(setup+itemOwner+transaction)+script(forge)+script(progression)+script(inventory)+script('try{'+cases+'document.getElementById("result").textContent=JSON.stringify(window.__qaResults)}catch(e){document.getElementById("result").textContent=JSON.stringify({error:e.stack})}');
fs.writeFileSync(fixture,markup);
try{
    const run=cp.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--user-data-dir='+profile,'--dump-dom','file:///'+fixture.replace(/\\/g,'/')],{encoding:'utf8',timeout:45000,maxBuffer:12*1024*1024});
    assert.equal(run.status,0,run.stderr);
    const match=run.stdout.match(/<pre id="result">([^<]*)<\/pre>/);assert.ok(match,'browser result missing');
    const result=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
    assert.equal(result.error,undefined,result.error);assert.equal(result.passed,12);assert.equal(result.ownerUnchanged,true);
    console.log('PASS: 12 reforge acceptance groups, real button picker/detail/lock/transaction/comparison/reload and one final Owner');
}finally{
    fs.rmSync(fixture,{force:true});
    // Dedicated test profile is always inside this repository.
    if(path.dirname(profile)===process.cwd())fs.rmSync(profile,{recursive:true,force:true});
}
