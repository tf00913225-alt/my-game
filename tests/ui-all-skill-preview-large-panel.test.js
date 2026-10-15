'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const paths=['index.html',...['js','css'].flatMap(d=>fs.readdirSync(d).filter(f=>/\.(js|css)$/.test(f)).map(f=>d+'/'+f))];
for(const p of paths){const source=fs.readFileSync(p,'utf8').replace(/\/\*[^]*?\*\//g,'');assert.doesNotMatch(source,/allElementSkillPreviewModal|skillPreviewHeaderButton|skill-preview-|(?:open|close|render)AllElementSkillPreview|getSkillPreviewSummary|SKILL_PREVIEW_ELEMENTS/,p);}
const html=fs.readFileSync('index.html','utf8'),main=fs.readFileSync('js/00-main.js','utf8');
assert.match(html,/id="allSkillsList"/);assert.match(html,/id="skillDetailModal"/);
for(const name of ['renderSkillLoadout','showSkillDetail','learnSkill','upgradeSkill'])assert.match(main,new RegExp('function '+name+'\\('));
console.log('Skill preview removal: no retired DOM, handlers or CSS; normal skill owners retained.');
