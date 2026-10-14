import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
import {MonsterBalance,towerLevelForFloor,CHALLENGE_FLAT_HP} from '../js/combat/monster-balance-owner.mjs';

test('Tower level bands include boundary floors',()=>{
  for(const [floor,level] of [[1,40],[20,40],[21,60],[40,60],[41,80],[60,80],[61,100],[100,100]]){
    assert.equal(towerLevelForFloor(floor),level);
    const result=MonsterBalance.previewTower({name:'測試敵人',element:'fire',archetype:'balanced',rank:'regular'},floor);
    assert.equal(result.identity.level,level);
    assert.equal(result.identity.context,`tower/floor/${floor}`);
  }
  assert.throws(()=>towerLevelForFloor(0),RangeError);
  assert.throws(()=>towerLevelForFloor(101),RangeError);
});

test('Tower and Abyss use additive HP after existing profiles, once per monster',()=>{
  for(const rank of ['regular','elite','smallBoss']){
    const bonus={regular:1500,elite:4500,smallBoss:10000}[rank];
    assert.equal(CHALLENGE_FLAT_HP[rank],bonus);
    for(const [mode,level] of [['tower',40],['abyss',20],['abyss',40]]){
      const spec={monsterKey:`test.${mode}.${rank}`,name:'測試敵人',level,element:'fire',archetype:'balanced',rank,mode,context:mode==='tower'?'tower/floor/10':`abyss/${level}/east/stage/1`,
        ...(mode==='abyss'?{abyssDifficulty:level,abyssRegion:'east',abyssStage:0}:{})};
      const projection=MonsterBalance.preview(spec);
      const before=projection.breakdown.find(step=>step.step==='element').output.maxHP;
      assert.equal(projection.final.maxHP,before*projection.profiles.globalCalibration.hp+bonus);
      const entity=MonsterBalance.build(spec);
      assert.equal(entity.hp,projection.final.maxHP);
      assert.equal(entity.maxHP,projection.final.maxHP);
      assert.equal(MonsterBalance.debug(entity).final.maxHP,projection.final.maxHP);
    }
  }
});

test('Other modes do not receive challenge HP bonuses',()=>{
  for(const [mode,rank] of [['wild','regular'],['daily','regular'],['adventure','regular'],['personalBoss','boss'],['worldBoss','boss']]){
    const projection=MonsterBalance.preview({monsterKey:'isolation.'+mode,name:'其他玩法',level:40,element:'fire',archetype:'balanced',rank,mode,context:mode==='adventure'?'adventure/test/test':mode+'/isolation',...(mode==='adventure'?{chapterId:'test',encounterId:'test'}:{}),...(mode==='daily'?{dailyType:'exp',wave:1,slot:0,partySize:1,highestPartyLevel:40,skillFrequency:0.5}:{}),...(mode==='worldBoss'?{worldStage:1}:{})});
    const before=projection.breakdown.find(step=>step.step==='element').output.maxHP;
    assert.equal(projection.final.maxHP,before*projection.profiles.globalCalibration.hp);
  }
});


test('formal two-wave builders retain tier levels and one additive HP projection for every enemy',()=>{
  const {context:c}=loadLegacyRuntime();
  for(const element of ['fire','water','earth','wind'])for(const floor of [1,5,10,20,21,40,41,60,61,100]){
    c.__input={element,floor};
    vm.runInContext("{const state=GameplaySystem.getSerializableState();state.tower.element=__input.element;GameplaySystem.debugReloadState(state);}",c);
    c.__waves=vm.runInContext('GameplaySystem.buildTowerWaves(__input.floor)',c);
    assert.deepEqual(Array.from(c.__waves,w=>w.length),[6,6]);
    for(const monster of c.__waves.flat()){
      assert.equal(monster.level,towerLevelForFloor(floor));
      const p=MonsterBalance.preview(JSON.parse(JSON.stringify(monster.balanceProjection.identity)));
      assert.equal(monster.maxHP,p.final.maxHP);assert.equal(monster.hp,p.final.maxHP);
      assert.equal(p.final.maxHP,p.breakdown.find(step=>step.step==='element').output.maxHP*p.profiles.globalCalibration.hp+CHALLENGE_FLAT_HP[monster.rank]);
    }
  }
  for(const [difficulty,region,stage] of [[20,0,0],[20,0,4],[40,4,4]]){
    c.__waves=vm.runInContext('v174AbyssBuildWaves('+difficulty+','+region+','+stage+')',c);
    assert.deepEqual(Array.from(c.__waves,w=>w.length),[6,difficulty===40&&region===4?5:6]);
    for(const monster of c.__waves.flat()){
      const p=MonsterBalance.preview(JSON.parse(JSON.stringify(monster.balanceProjection.identity)));
      assert.equal(monster.level,difficulty);assert.equal(monster.maxHP,p.final.maxHP);assert.equal(monster.hp,p.final.maxHP);
      assert.equal(p.final.maxHP,p.breakdown.find(step=>step.step==='element').output.maxHP*p.profiles.globalCalibration.hp+CHALLENGE_FLAT_HP[monster.rank]);
    }
  }
});
