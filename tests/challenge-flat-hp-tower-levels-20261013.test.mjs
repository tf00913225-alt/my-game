import assert from 'node:assert/strict';
import {test} from 'node:test';
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
    const bonus=CHALLENGE_FLAT_HP[rank];
    for(const mode of ['tower','abyss']){
      const spec={monsterKey:`test.${mode}.${rank}`,name:'測試敵人',level:40,element:'fire',archetype:'balanced',rank,mode,context:mode==='tower'?'tower/floor/10':'abyss/40/east/stage/1',
        ...(mode==='abyss'?{abyssDifficulty:40,abyssRegion:'east',abyssStage:0}:{})};
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
  const projection=MonsterBalance.preview({name:'一般野怪',level:40,element:'fire',archetype:'balanced',rank:'regular',mode:'wild',context:'wild/zone-01'});
  const before=projection.breakdown.find(step=>step.step==='element').output.maxHP;
  assert.equal(projection.final.maxHP,before*projection.profiles.globalCalibration.hp);
});
