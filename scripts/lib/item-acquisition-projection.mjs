import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

export const PATROL_ITEM_CATALOG_PATH='functions/src/generated/patrol-item-catalog.json';
const patrolHash=value=>createHash('sha256').update(value).digest('hex');
const patrolStable=value=>Array.isArray(value)?value.map(patrolStable):value&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,patrolStable(value[key])])):value;
function patrolSlice(source,pattern,label){
 const rows=[...source.matchAll(new RegExp(pattern.source,'g'))];
 if(rows.length!==1)throw Error('Unsupported patrol item source: '+label);
 return rows[0][0];
}
function patrolPure(code){
 // Only bounded pure definition/helper declarations run in the sandbox. Reject
 // new runtime dependencies instead of supplying gameplay/DOM/clock stubs.
 const tokens=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')
  .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
 if(/\b(?:window|document|globalThis|process|require|Function|eval|Date|Math|fetch|setTimeout|constructor|prototype|__proto__)\b|`/.test(tokens))
  throw Error('Unsupported impure patrol item definition');
 return code;
}
export function buildPatrolItemCatalog(root){
 const sourcePath='js/27-v132-content-expansion.js',dropPath='functions/src/patrol-drop-policy.js';
 const source=fs.readFileSync(path.join(root,sourcePath),'utf8');
 const drops=fs.readFileSync(path.join(root,dropPath),'utf8');
 const declaration=name=>patrolSlice(source,new RegExp('\\bconst '+name+'\\s*=[\\s\\S]*?;\\r?\\n'),name);
 const helper=name=>patrolSlice(source,new RegExp('    function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n    \\}'),name);
 const talismans=patrolSlice(source,/    const talismanDefinitions=\[\];[\s\S]*?\n    \}\);/,'talisman construction');
 const blocks=[declaration('TALISMAN_ART'),helper('rasterItemIcon'),helper('talismanIcon'),helper('ticketIcon'),
  declaration('FORMAL_ITEM_TIERS'),declaration('TALISMAN_ACTIVATION_CHANCES'),declaration('TALISMAN_TIERS'),
  declaration('RESOURCE_TIERS'),declaration('TALISMAN_EFFECTS'),talismans,declaration('oreDefinitions'),declaration('ticketDefinitions')];
 const dropBlocks=['normalRows','eliteRows'].map(name=>patrolSlice(drops,
  new RegExp('\\bconst '+name+'\\s*=[\\s\\S]*?;\\r?\\n'),name));
 const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
 const result=vm.runInContext(patrolPure(blocks.join('\n')+'\n'+dropBlocks.join('\n'))+
  '\n({definitions:[...talismanDefinitions,...oreDefinitions,...ticketDefinitions],rows:[...normalRows,...eliteRows]})',
  context,{timeout:1000});
 const plain=JSON.parse(JSON.stringify(result)),byId=new Map();
 for(const item of plain.definitions){
  if(!item||typeof item.id!=='string'||byId.has(item.id))throw Error('Invalid/duplicate patrol item definition');
  byId.set(item.id,item);
 }
 const ids=[...new Set(plain.rows.map(row=>{
  if(!row||typeof row.itemId!=='string'||row.quantity!==1||!Number.isFinite(row.chance)||row.chance<=0||row.chance>1)
   throw Error('Unsupported patrol drop definition');
  return row.itemId;
 }))];
 const items=Object.fromEntries(ids.map(id=>{
  const item=byId.get(id);
  if(!item||!['talisman','material','ticket'].includes(item.type)||typeof item.name!=='string'||
   typeof item.icon!=='string'||!item.icon||item.price!==0||!item.stats||Array.isArray(item.stats)||
   item.available===false||item.planned===true)throw Error('Unsupported or unresolved patrol item: '+id);
  return [id,item];
 }));
 const catalog={schemaVersion:1,policyId:'patrol-item-definitions-v1',scope:'patrol-item-definition-data-only',
  sourceDigests:{[sourcePath]:patrolHash(blocks.join('\n')),[dropPath]:patrolHash(dropBlocks.join('\n'))},
  items,outcomeVerified:false,rewardEligible:false};
 return {...catalog,sha256:patrolHash(JSON.stringify(patrolStable(catalog)))};
}
export function syncPatrolItemCatalog(root,checkOnly=false){
 const expected=JSON.stringify(buildPatrolItemCatalog(root),null,2)+'\n',file=path.join(root,PATROL_ITEM_CATALOG_PATH);
 if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
 if(checkOnly)throw Error('Patrol item catalog is stale');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}

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
  equipmentShop:data('js/equipment-progression.js','EQUIPMENT_SHOP_DROP_TABLE'),
  equipmentChest:data('js/equipment-progression.js','EQUIPMENT_CHEST_DROP_TABLE'),
  materialChest:data('js/27-v132-content-expansion.js','MATERIAL_CHEST_DROP_TABLE'),
  eliteDrops:data('functions/src/patrol-drop-policy.js','eliteRows'),
  wildDrops:data('functions/src/patrol-drop-policy.js','normalRows'),
  talismanGold:data('js/36-v141-content-systems.js','TALISMAN_GOLD'),
  shopPotions:data('js/40-v144-rules-and-abyss.js','SHOP_POTION_PRICES'),
  towerUnlockLevel:data(boss,'TOWER_UNLOCK_LEVEL'),
  personalBosses:data(boss,'PERSONAL_BOSSES'),worldBosses:data(boss,'WORLD_BOSSES'),
  firstCharacterRelicUnlock:{level:data(relic,'FIRST_CHARACTER_RELIC_UNLOCK_LEVEL'),relicIds:data(relic,'FIRST_CHARACTER_BLUE_RELICS')},
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
