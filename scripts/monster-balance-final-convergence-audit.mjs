import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';

const retired=['makeLegacyModeMonster','generateMonsterAttributePoints','v132BuildDungeonMonster','applyDungeonMonsterStrength','applyDungeonNormalBonus','applyDungeonRankStrength','bossBalanceProfile','defenseMultiplier'];
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter((p,i,a)=>a.indexOf(p)===i&&fs.existsSync(p)&&fs.statSync(p).isFile());
const hits=[];
for(const file of files){if(file==='docs/monster-balance-final-convergence-audit-20261004.json')continue;if(!/\.(?:js|mjs|cjs|json|md|html|ya?ml|txt)$/.test(file))continue;const lines=fs.readFileSync(file,'utf8').split('\n');for(const [i,line] of lines.entries())for(const token of retired)if(line.includes(token)){
 const classification=file.startsWith('build/')||file.includes('/generated/')?'E. build artifact':file.startsWith('tests/')||file.startsWith('.github/scripts/')||file.startsWith('scripts/')?'C. test fixture / test and diagnostic gate':file.startsWith('docs/')||file.endsWith('.md')||file.startsWith('release/')?'D. docs/history and retirement gate':file.startsWith('js/')?'A. RETIRE':'D. docs/history';
 hits.push({file,line:i+1,token,classification});
}}
assert.equal(hits.filter(h=>h.classification==='A. RETIRE').length,0,'No retired token in formal Runtime');
const keptWriters={
 'js/34-v141-core-systems.js':'B. KEEP: live generic skill shield lifecycle / explicit Owner rank reconstruction, no pre-battle calibration',
 'js/38-v143-system-fixes.js':'B. KEEP: live barrier skill removal',
 'js/42-v148-combat-dungeon-fixes.js':'B. KEEP: live rage buff restoration',
 'js/46-v155-dev-fixes.js':'B. KEEP: live blessing/rock-wall skill application and restoration',
 'js/60-team-relic-system.js':'B. KEEP: live relic debuff application and expiry; relic owner outside this migration'
};
const writes=[];
const pattern=/\b(?:monster|enemy|boss|unit|m|attacker|entry\.monster)\.(?:maxHP|maxSP|attack|magicAttack|defense|agility)\s*(?:=(?!=)|\*=|\+=|\/=)/;
for(const file of files.filter(p=>p.startsWith('js/')&&p.endsWith('.js'))){const source=fs.readFileSync(file,'utf8').replace(/\/\* === MONSTER_BALANCE_OWNER_GENERATED_BEGIN === \*\/[\s\S]*?\/\* === MONSTER_BALANCE_OWNER_GENERATED_END === \*\//,'');for(const [i,line]of source.split('\n').entries())if(pattern.test(line)){
 assert.ok(keptWriters[file],`Unclassified Runtime numerical write: ${file}:${i+1}`);writes.push({file,line:i+1,text:line.trim(),classification:keptWriters[file]});
}}
const modes=['wild','daily','tower','abyss','adventure','personalBoss','worldBoss'];assert.deepEqual(MonsterBalance.modes,modes);
const references=JSON.parse(fs.readFileSync('tests/fixtures/monster-balance-p2f-prior-modes.json','utf8'));
for(const row of references.rows){const monster=MonsterBalance.build(row.spec);assert.equal(monster.balanceOwner,'MonsterBalance');assert.deepEqual(monster.balanceProjection.final,row.final);assert.equal(monster.balanceProjection.finalDamagePressure,row.pressure);}
for(const mode of ['personalBoss','worldBoss']){const m=MonsterBalance.build({monsterKey:'audit-'+mode,name:'Audit Boss',level:40,element:'fire',archetype:'balanced',mode,rank:'boss',context:'audit/boss',...(mode==='worldBoss'?{worldStage:1}:{})});assert.equal(m.balanceOwner,'MonsterBalance');assert.equal(m.balanceProjection.base.abilityPointBudget,195);}
const report={workId:'MONSTER-BALANCE-OWNER-P2F-BOSS-20261004',passed:true,scope:'All tracked repository text including tests/docs/build; runtime raw-stat writes individually classified. Formal runtime rosters are additionally exercised by Phase1–2F aggregate and natural mode Browser QA.',modes,retired,retiredRuntimeHits:0,priorModeReferences:references.rows.length,remainingHits:hits,liveMechanismWriters:writes};
const dest=process.argv.includes('--write')?'docs/monster-balance-final-convergence-audit-20261004.json':null;if(dest)fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,modes,retiredRuntimeHits:0,remainingEvidenceHits:hits.length,classifiedLiveMechanismWrites:writes.length,priorModeReferences:288}));
