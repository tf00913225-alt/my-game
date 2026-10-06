import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parse} from 'acorn';
import {classifyChanges, classifySharedSource, changedPaths} from '../.github/scripts/ci-change-classifier.mjs';
const plan=(paths,options={})=>classifyChanges(paths,{enabled:true,...options});
test('nine routing acceptance cases',()=>{
  for(const name of ['renderShopContent','openInventoryCharacterDetail']) {
    const responsibilities=classifySharedSource(`function ${name}(){return 1;}`,`function ${name}(){return 2;}`);
    assert.equal(plan(['js/00-main.js'],{responsibilities}).gates.boss_balance,false,name);
  }
  const responsibilities=classifySharedSource('function renderBattle(){return 1;}','function renderBattle(){return 2;}');
  const p=plan(['js/00-main.js','build/example.js'],{responsibilities,generatedVerified:true});
  assert.equal(p.gates.battle_browser,true);assert.equal(p.gates.boss_balance,false);
  assert.equal(plan(['js/gameplay-boss-tower-system.js']).gates.boss_balance,true);
  const balance=plan(['js/combat/monster-balance-owner.mjs']);
  for(const k of ['boss_balance','tower_wild_browser','abyss_balance','adventure_balance']) assert.equal(balance.gates[k],true,k);
  assert.equal(plan(['js/unknown.js']).strictMode,true);
  assert.equal(plan(['build/example.js']).strictMode,true);
  assert.equal(plan(['docs/readme.md'],{eventName:'schedule',fullRegression:true}).gates.boss_balance,true);
  assert.equal(plan(['docs/readme.md'],{baseRef:'main'}).gates.boss_balance,true);
});
test('shared source fails closed for globals, unknown functions, added functions and parse errors',()=>{
  for(const [a,b] of [['let x=1;','let x=2;'],['function winBattle(){}','function winBattle(){return 1;}'],['','function renderBattle(){}'],['function renderBattle(){}','invalid {'],['function renderBattle(){}','function renderBattle(){MonsterBalance.build({});}'],['function renderBattle(){}','function renderBattle(){monsters[0].hp=0;}']])
    assert.equal(classifySharedSource(a,b),null);
});
test('dev integration uses affected paths, dispatch retains full safety',()=>{
  assert.equal(plan(['css/23-stage-v77-inventory-detail-ui.css'],{eventName:'push'}).gates.boss_balance,false);
  assert.equal(plan(['docs/readme.md'],{eventName:'workflow_dispatch'}).gates.boss_balance,true);
});
test('real main source character rows and enemy numeric presentation stay targeted; external effects stay strict',()=>{
  const source=fs.readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
  const character=source.replace('["攻擊",stats.attackPoints]','["攻擊",stats.attack]');
  assert.notEqual(character,source);
  assert.deepEqual(classifySharedSource(character,source),['ui','inventory']);
  // Use the formal declaration boundary rather than pinning old HP writer text:
  // concurrent #810 legitimately delegates that writer to its projection owner.
  const owner=parse(source,{ecmaVersion:'latest'}).body.find(n=>n.type==='FunctionDeclaration' && n.id.name==='applyMonsterUiUpdate');
  assert.ok(owner);
  const offset=owner.body.start+1;
  const enemy=source.slice(0,offset)+'\nconst numericPresentationFixture=Math.floor(1.5);\n'+source.slice(offset);
  assert.notEqual(enemy,source);
  assert.deepEqual(classifySharedSource(source,enemy),['battle']);
  assert.equal(plan(['js/00-main.js','build/asset-manifest.json'],{responsibilities:classifySharedSource(source,enemy),generatedVerified:true}).gates.boss_balance,false);
  assert.equal(classifySharedSource(source,enemy+'\nwindow.externalOwner=1;'),null);
});
test('real shallow PR reproduces no merge base; classifier checkout ancestry recovers exact paths',()=>{
  const previous=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ci-routing-'));
  const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'}).trim();
  try {
    const source=path.join(temp,'source'),shallow=path.join(temp,'shallow');fs.mkdirSync(source);
    git(source,'init','-b','dev');git(source,'config','user.email','ci@example.invalid');git(source,'config','user.name','CI fixture');
    const commit=(file,value)=>{fs.writeFileSync(path.join(source,file),value);git(source,'add','.');git(source,'commit','-m',value);return git(source,'rev-parse','HEAD');};
    commit('base.txt','base');git(source,'switch','-c','feature');
    commit('ui.txt','ui-1');const head=commit('ui.txt','ui-2');
    git(source,'switch','dev');const base=commit('base.txt','base-2');
    git(temp,'clone','--depth=1','--branch','feature',new URL('file:///'+source.replaceAll('\\','/')).href,shallow);
    git(shallow,'fetch','--depth=1','origin',base);
    process.chdir(shallow);
    assert.throws(()=>changedPaths(base,head),/merge-base|Command failed/);
    git(shallow,'fetch','--unshallow','origin');
    assert.deepEqual(changedPaths(base,head),['ui.txt']);
    assert.deepEqual(changedPaths(base,head,false,'push').sort(),['base.txt','ui.txt']);
  } finally {process.chdir(previous);fs.rmSync(temp,{recursive:true,force:true});}
});

