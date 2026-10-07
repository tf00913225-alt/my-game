import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Extract only named data declarations, never execute a gameplay module or grant path.
export function buildItemAcquisitionProjection(root){
 const read=file=>fs.readFileSync(path.join(root,file),'utf8');
 function data(file,name,context={}){
  const source=read(file),matches=[...source.matchAll(new RegExp('\\bconst '+name+'\\s*=([\\s\\S]*?);\\r?\\n','g'))];
  if(matches.length!==1)throw Error('Missing/ambiguous acquisition data '+name);
  return vm.runInNewContext('('+matches[0][1]+')',context,{timeout:1000});
 }
 const boss='js/gameplay-boss-tower-system.js',relic='js/relic-progression-drop-system.js';
 const summaryContext={window:{}};
 vm.runInNewContext(read('js/relic-summary-catalog.js'),summaryContext,{timeout:1000});
 const summary=summaryContext.window.FourSymbolsRelicSummaryCatalog;
 const relics=data('js/60-team-relic-system.js','RELIC_CATALOG_LIST',{trigger:()=>null,effect:()=>null}).map(def=>({id:def.id,name:summary[def.id].name,rarity:def.rarity}));
 const tower=data(relic,'RELIC_TOWER_REWARD_CONFIG',{gameplayRuntime:{towerConfig:{floorCount:100}}});
 const towerOwner=read(relic).match(/    function towerEssenceForFloor\(floor\)\{[\s\S]*?\n    \}/)[0];
 const towerEssence=vm.runInNewContext('('+towerOwner.trim()+')',{RELIC_TOWER_REWARD_CONFIG:tower,integer:value=>Math.max(0,Math.floor(Number(value)||0))});
 return {
  series:data('js/36-v141-content-systems.js','SERIES'),seriesDismantleQuantity:data('js/36-v141-content-systems.js','SERIES_DISMANTLE_FRAGMENT_COUNT'),
  equipmentDungeonFragments:data('js/equipment-progression.js','EQUIPMENT_DUNGEON_FRAGMENT_REWARD'),
  equipmentChest:data('js/equipment-progression.js','EQUIPMENT_CHEST_DROP_TABLE'),
  materialChest:data('js/27-v132-content-expansion.js','MATERIAL_CHEST_DROP_TABLE'),
  eliteDrops:data('js/34-v141-core-systems.js','ELITE_DROP_TABLE'),
  wildDrops:data('js/27-v132-content-expansion.js','NORMAL_DROP_TABLE'),
  talismanGold:data('js/36-v141-content-systems.js','TALISMAN_GOLD'),
  shopPotions:data('js/40-v144-rules-and-abyss.js','SHOP_POTION_PRICES'),
  towerUnlockLevel:data(boss,'TOWER_UNLOCK_LEVEL'),
  personalBosses:data(boss,'PERSONAL_BOSSES'),worldBosses:data(boss,'WORLD_BOSSES'),
  relics,bossPools:data(relic,'RELIC_BOSS_DROP_TABLE'),
  rarityWeights:data(relic,'RARITY_WEIGHTS'),rarityChances:data(relic,'RARITY_FRAGMENT_DROP_CHANCE'),
  difficulties:data(relic,'BOSS_DIFFICULTY_CONFIG'),materials:data(relic,'MATERIAL_CONFIG'),
  tower:{...tower,essenceByFloor:Array.from({length:100},(_,i)=>towerEssence(i+1)),universal:{five:Array.from({length:100},(_,i)=>tower.universal.fiveFloor(i+1)),ten:Array.from({length:100},(_,i)=>tower.universal.tenFloor(i+1))}},
  abyssRegions:data('js/59-abyss-two-tier-runtime.js','ABYSS_REGIONS'),abyssDifficulties:data('js/59-abyss-two-tier-runtime.js','ABYSS_DIFFICULTIES'),
  adventureRewards:data('js/adventure/adventure-content-v1-20260915.js','rewards'),
  adventureMerchants:data('js/adventure/adventure-content-v1-20260915.js','merchantPool')
 };
}
export function syncItemAcquisitionProjection(root,checkOnly=false){
 const file=path.join(root,'js/generated-item-acquisition-data.js');
 const code='// GENERATED projection of canonical Reward Owners. DO NOT EDIT.\nwindow.FourSymbolsItemAcquisitionData='+JSON.stringify(buildItemAcquisitionProjection(root),null,2)+';\n';
 if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===code)return;
 if(checkOnly)throw Error('Item acquisition projection is stale');
 fs.writeFileSync(file,code);
}
