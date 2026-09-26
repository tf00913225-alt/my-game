import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'config/persisted-state-registry.json'),'utf8'));
const rows=registry.states;
const required=['key','ownerModule','storageType','scope','deviceOnly','gameplayCritical','rewardCoupled','economyCoupled','claimCoupled','cloudRequired','backupRequired','migrationRequired','authorityTier','authoritativeSource','schemaVersion','restoreOwner','deletionPolicy','corruptionBehavior','defaultBehavior','missingDataBehavior'];
const errors=[];
const keys=new Set();
for(const row of rows){
 for(const field of required){if(row[field]===undefined||row[field]===null||row[field]==='')errors.push(`${row.key||'?'}: missing ${field}`);}
 if(keys.has(row.key))errors.push(`duplicate registry key: ${row.key}`);
 keys.add(row.key);
 if(!fs.existsSync(path.join(root,row.ownerModule)))errors.push(`owner missing: ${row.ownerModule}`);
}
const writerCounts={
 'js/00-main.js':1,'js/25-v131-fix-batch.js':1,'js/26-v131-patrol-appearance.js':1,
 'js/27-v132-content-expansion.js':1,'js/28-v133-economy-rebalance.js':1,
 'js/32-v139-rested-experience.js':1,'js/34-v141-core-systems.js':1,
 'js/35-v141-ui-battle.js':3,'js/36-v141-content-systems.js':1,
 'js/51-v169-rpg-ui.js':1,'js/53-v173.50-inventory-qol.js':1,
 'js/55-v173.51-inventory-qa.js':1,'js/59-abyss-two-tier-runtime.js':1,
 'js/firebase/session-client.js':1,'js/release-update-notification.js':1,
 'js/startup/account-save-repository.js':9,'js/startup/first-play-resource-loader.js':1,
 'privacy-consent.html':1
};
const writer=/\b(?:localStorage|sessionStorage|storage\(\)|storage|global\.localStorage|window\.sessionStorage|storage\?)\??\.setItem\s*\(/g;
function inspect(file,source){
 const count=[...source.matchAll(writer)].length;
 if(count!==(writerCounts[file]||0))errors.push(`${file}: ${count} storage writes; expected ${writerCounts[file]||0}. Register the new state and review this guard.`);
 if(/\bindexedDB\b|\bcreateObjectStore\s*\(/.test(source))errors.push(`${file}: IndexedDB needs an explicit store registration and guard update.`);
 for(const [,suffix] of source.matchAll(/accountKey\s*\(\s*['"]([^'"]+)['"]/g)){
  if(suffix==='release-update-')continue;
  if(!keys.has(`four_symbols_account:<UID>:${suffix}`))errors.push(`${file}: unregistered account sidecar ${suffix}`);
  if(suffix==='equipment-shop-purchases'&&file!=='js/startup/account-save-repository.js'){
   errors.push(`${file}: historical-only equipment-shop-purchases requires an owner and claim-policy review before runtime use`);
  }
 }
 if(file!=='js/startup/account-save-repository.js'){
  for(const match of source.matchAll(/\baccountKey\s*\(\s*([^\s,)]+)/g)){
   if(!/^['"]/.test(match[1]))errors.push(`${file}: dynamic accountKey suffix requires an explicit registry policy`);
  }
 }
 for(const [,literal] of source.matchAll(/\b(?:localStorage|sessionStorage)\s*(?:\.|\?\.)\s*setItem\s*\(\s*['"]([^'"]+)['"]/g)){
  if(!keys.has(literal))errors.push(`${file}: unregistered literal storage key ${literal}`);
 }
 if(/\b(?:localStorage|sessionStorage|storage)\s*\[\s*['"]setItem['"]\s*\]/.test(source))errors.push(`${file}: bracket storage writer requires review`);
}
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const full=path.join(dir,item.name);
 if(item.isDirectory())walk(full);
 else if(item.name.endsWith('.js')){const file=path.relative(root,full).replaceAll('\\','/');inspect(file,fs.readFileSync(full,'utf8'));}
}}
walk(path.join(root,'js'));
inspect('privacy-consent.html',fs.readFileSync(path.join(root,'privacy-consent.html'),'utf8'));
const repository=fs.readFileSync(path.join(root,'js/startup/account-save-repository.js'),'utf8');
const block=repository.match(/const LEGACY_SIDECARS=Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1]||'';
for(const [,suffix] of block.matchAll(/:\s*"([^"]+)"/g)){
 if(!keys.has(`four_symbols_account:<UID>:${suffix}`))errors.push(`legacy sidecar not registered: ${suffix}`);
}
if(process.argv.includes('--self-test')){
 const before=errors.length;
 inspect('js/new-gameplay-writer.js',`localStorage.setItem('newReward', '1');`);
 inspect('js/new-db.js',`indexedDB.open('new-db');`);
 inspect('js/25-v131-fix-batch.js',`localStorage.setItem('newReward', '1');`);
 inspect('js/new-account-writer.js',`const key=accountKey(suffix);`);
 inspect('js/new-historical-writer.js',`const key=accountKey('equipment-shop-purchases');`);
 const probes=errors.slice(before).join('\n');
 if(!probes.includes('newReward')||!probes.includes('IndexedDB')||
    !probes.includes('dynamic accountKey')||!probes.includes('historical-only equipment-shop-purchases')){
  throw Error('Registry guard did not reject unknown or historical-only storage.');
 }
 errors.splice(before);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Persisted state registry: ${rows.length} entries; runtime storage writes and account keys covered.`);
