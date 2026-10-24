const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const main=fs.readFileSync('js/00-main.js','utf8');
const start=main.indexOf('function normalizeHydratedRetiredSkillReferences(){');
const end=main.indexOf('function migrateLegacySixStats(',start);
assert.ok(start>=0&&end>start);
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.js')){let s=fs.readFileSync(p,'utf8');if(p===path.join('js','00-main.js'))s=s.slice(0,start)+s.slice(end);assert.doesNotMatch(s,/stormSpell|暴風術/,p+' must have no retired runtime data or consumers');}}}
scan('js');
for(const p of ['functions/src/generated/player-skill-config-catalog.json','functions/src/skill-learning-policy-v1.json'])assert.ok(!JSON.parse(fs.readFileSync(p,'utf8')).skills.some(s=>s.id==='stormSpell'));
console.log('✓ retired storm spell exists only in legacy hydration compatibility');
