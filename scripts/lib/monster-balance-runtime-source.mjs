import fs from 'node:fs';
import path from 'node:path';

// Classic App Shell must construct Wild rosters synchronously. This generated
// projection embeds the SAME ESM authority, without a second stat implementation.
export function syncMonsterBalanceRuntime(root,checkOnly=false){
  const modules=['level-base-contract','monster-archetypes','monster-balance-owner'];
  const sources=modules.map(name=>fs.readFileSync(path.join(root,'js/combat/'+name+'.mjs'),'utf8')
    .replace(/^import .*;\n/gm,'').replace(/\bexport (?=(?:const|function)\b)/g,''));
  const identities=JSON.parse(fs.readFileSync(path.join(root,'config/wild-monster-archetypes.json'),'utf8')).entries;
  const dailyIdentities=JSON.parse(fs.readFileSync(path.join(root,'config/daily-monster-archetypes.json'),'utf8')).entries;
  const begin='/* BEGIN GENERATED MONSTER BALANCE OWNER */';
  const end='/* END GENERATED MONSTER BALANCE OWNER */';
  const generated=begin+'\n(function installMonsterBalanceAuthority(){\n"use strict";\n'+sources.join('\n')+
    '\nwindow.MonsterBalance=MonsterBalance;\nwindow.MonsterBalanceWildIdentities=Object.freeze('+JSON.stringify(identities)+');\nwindow.MonsterBalanceDailyIdentities=Object.freeze('+JSON.stringify(dailyIdentities)+');\n})();\n'+end+'\n';
  const file=path.join(root,'js/00-main.js');
  const actual=fs.readFileSync(file,'utf8');
  const body=actual.startsWith(begin)?actual.slice(actual.indexOf(end)+end.length).replace(/^\n/,''):actual;
  const expected=generated+body;
  if(actual!==expected){
    if(checkOnly) throw new Error('Monster Balance generated Runtime is stale; run production build');
    fs.writeFileSync(file,expected);
  }
}
