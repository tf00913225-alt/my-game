import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';

const {context:c}=loadLegacyRuntime();
const nodes=new Map();
for(const name of ['battleMonsterBar','battleMonsterSPBar','battleMonsterHPText','battleMonsterSPText','battleMonsterShieldBar']){
  nodes.set(name+'0',{style:{},textContent:''});
}
c.document.getElementById=id=>nodes.get(id)||null;
const run=source=>vm.runInContext(source,c);
const node=name=>nodes.get(name+'0');
const plain=value=>JSON.parse(JSON.stringify(value));
const integerText=text=>assert.match(text,/^\d+$/);
const lateSource=fs.readFileSync('js/54-v173.51-battle-qa.js','utf8');
run(lateSource.slice(lateSource.indexOf('function syncResourceNumbers(){'),lateSource.indexOf('function syncBattlePresentation(){')));
c.document.querySelectorAll=selector=>selector==="#battlePage .battle-monster[id^='battleMonster']"?[{id:'battleMonster0'}]:[];
const render=()=>{
  run('applyMonsterUiUpdate(0)');
  const hp=node('battleMonsterHPText').textContent,sp=node('battleMonsterSPText').textContent;
  integerText(hp);integerText(sp);
  run('syncResourceNumbers()');
  assert.equal(node('battleMonsterHPText').textContent,hp);
  assert.equal(node('battleMonsterSPText').textContent,sp);
};
const set=source=>run('monsters=['+source+'];currentBattleMonsters=[0]');

test('full production hooks project fractional resources without mutating combat state',()=>{
  set('{name:"QA",hp:95.5,maxHP:100.25,sp:37.25,maxSP:100.75,alive:true,statusEffects:[],activeBuffs:[]}');
  const before=run('JSON.stringify(monsters[0])');render();
  assert.equal(node('battleMonsterHPText').textContent,'95');
  assert.equal(node('battleMonsterSPText').textContent,'37');
  assert.equal(parseFloat(node('battleMonsterBar').style.width),95.5/100.25*100);
  assert.equal(parseFloat(node('battleMonsterSPBar').style.width),37.25/100.75*100);
  assert.equal(run('JSON.stringify(monsters[0])'),before);
  run('monsters[0].hp-=12;monsters[0].sp-=10');render();
  assert.equal(node('battleMonsterHPText').textContent,'83');
  assert.equal(node('battleMonsterSPText').textContent,'27');
  run('monsters[0].hp+=4.25;monsters[0].sp+=6.5');render();
  assert.equal(node('battleMonsterHPText').textContent,'87');
  assert.equal(node('battleMonsterSPText').textContent,'33');
});

test('zero/max and malformed input have finite bounded ratios and integer text',()=>{
  for(const [value,max,text,percent] of [[0,100,'0 / 100',0],[99.999999,100,'99 / 100',99.999999],[100.25,100.25,'100 / 100',100],[0,0,'0 / 0',0],[-3,100,'0 / 100',0],[110,100,'100 / 100',100],[NaN,100,'0 / 100',0],[Infinity,100,'0 / 100',0],[10,Infinity,'0 / 0',0],[10,-3,'0 / 0',0]]){
    const result=c.projectEnemyResource(value,max);
    assert.equal(result.text,text);assert.equal(result.percent,percent);
    assert.match(result.text,/^\d+ \/ \d+$/);assert.ok(Number.isFinite(result.percent));
    set('{hp:0,maxHP:0,sp:0,maxSP:0,alive:true,statusEffects:[],activeBuffs:[]}');
    const monster=run('monsters[0]');monster.hp=value;monster.maxHP=max;monster.sp=value;monster.maxSP=max;
    render();integerText(node('battleMonsterHPText').textContent);integerText(node('battleMonsterSPText').textContent);
    assert.equal(node('battleMonsterHPText').textContent,String(result.current));
    assert.equal(node('battleMonsterSPText').textContent,String(result.current));
  }
});

test('formal Abyss elite fractional SP survives state and mutations but never reaches HUD',()=>{
  set('MonsterBalance.build({monsterKey:"qa.abyss",name:"QA",level:40,element:"fire",archetype:"balanced",rank:"elite",mode:"abyss",context:"abyss/40/east/stage/1",abyssDifficulty:40,abyssRegion:"east",abyssStage:0})');
  assert.equal(run('monsters[0].maxSP'),727.5);render();
  assert.equal(node('battleMonsterSPText').textContent,'727');
  run('monsters[0].sp-=10');render();
  assert.equal(run('monsters[0].sp'),717.5);
  assert.equal(node('battleMonsterSPText').textContent,'717');
});

test('late presentation sync preserves current-only labels without repeated text writes',()=>{
  set('{hp:95.5,maxHP:100.25,sp:37.25,maxSP:100.75,alive:true,statusEffects:[],activeBuffs:[]}');
  let writes=0;
  const original=node('battleMonsterHPText');
  const label={style:{},get textContent(){return this.value||'';},set textContent(value){writes++;this.value=value;}};
  nodes.set('battleMonsterHPText0',label);
  try{
    render();assert.equal(label.textContent,'95');assert.equal(writes,1);
    render();run('syncResourceNumbers()');assert.equal(writes,1);
    run('monsters[0].hp-=1');render();assert.equal(label.textContent,'94');assert.equal(writes,2);
  }finally{nodes.set('battleMonsterHPText0',original);}
});

test('shield and barrier retain current-only labels and unrounded shield geometry',()=>{
  set('{name:"QA",hp:115.75,maxHP:120.75,sp:37.25,maxSP:100.75,alive:true,statusEffects:[],activeBuffs:[],v141Shield:{remaining:20.5,amount:20.5,baseHp:95.25,baseMaxHP:100.25}}');
  render();assert.equal(node('battleMonsterHPText').textContent,'115');
  assert.equal(parseFloat(node('battleMonsterBar').style.width),95.25/120.75*100);
  run('monsters[0].v141Shield.isBarrier=true;monsters[0].v141Shield.remainingBlocks=2');
  render();assert.equal(node('battleMonsterHPText').textContent,'115');
  integerText(node('battleMonsterHPText').textContent);integerText(node('battleMonsterSPText').textContent);
});

test('enemy details share projection while player details and player resource state stay unchanged',()=>{
  const fields=new Map(['element','name','hp','sp'].map(key=>[key,{textContent:''}]));
  const modal={querySelector:s=>fields.get(s.match(/data-field="(.*?)"/)?.[1])||null,setAttribute(){}};
  c.ensureBattleStatusDetailModal=()=>modal;c.isBattleStatusInspectionBlocked=()=>false;
  c.renderBattleStatusDetailList=()=>{};c.syncBattleUiPriorityLayer=()=>{};
  set('{name:"QA",hp:66.666666,maxHP:100.25,sp:37.25,maxSP:100.75,alive:true,statusEffects:[],activeBuffs:[]}');
  run('openBattleStatusDetailModal("monster",0)');
  assert.equal(fields.get('hp').textContent,'HP：66 / 100');
  assert.equal(fields.get('sp').textContent,'SP：37 / 100');
  run('monsters[0].maxHP=0;monsters[0].maxSP=0');
  run('openBattleStatusDetailModal("monster",0)');
  assert.equal(fields.get('hp').textContent,'HP：0 / 0');
  assert.equal(fields.get('sp').textContent,'SP：0 / 0');
  run('player.hp=95.5;player.sp=37.25');
  const before=plain(run('({hp:player.hp,sp:player.sp})'));
  run('openBattleStatusDetailModal("player",0)');
  assert.match(fields.get('hp').textContent,/^HP：95\.5 \/ /);
  assert.match(fields.get('sp').textContent,/^SP：37\.25 \/ /);
  assert.deepEqual(plain(run('({hp:player.hp,sp:player.sp})')),before);
});

test('Boss and legacy hooks cannot author an independent resource number format',()=>{
  const boss=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8');
  const sync=boss.slice(boss.indexOf('    function syncBossShieldHud(atImpact){'),boss.indexOf('    function objectDefinition('));
  assert.match(sync,/syncEnemyResourceHud\(index\)/);assert.doesNotMatch(sync,/textContent\s*=/);
  for(const file of ['js/35-v141-ui-battle.js','js/38-v143-system-fixes.js']){
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/hpText\.textContent\s*=|text\.textContent=Math\.floor\(numeric\(shield\.baseHp\)\)/);
  }
  assert.match(lateSource,/syncEnemyResourceHud\(index\)/);
  assert.doesNotMatch(lateSource,/numericValue\(monster\.(hp|sp)\)/);
});
