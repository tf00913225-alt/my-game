import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('js/00-main.js','utf8');
const owner=source.match(/^function getDamageLevelMultiplier\([\s\S]*?^\}/m)?.[0];
assert.ok(owner,'canonical Level Damage Owner exists');
const context=vm.createContext({});
vm.runInContext(owner,context);
const multiplier=context.getDamageLevelMultiplier;
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-12*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);

for(const diff of [0,1,-1,5,-5,10,-10,30,-30,99,-99]){
    test(`V2 exact multiplier at difference ${diff}`,()=>{
        const attacker=diff>=0?1+diff:1;
        const target=diff>=0?1:1-diff;
        near(multiplier(attacker,target),Math.pow(1.01,diff));
    });
}
test('all 100 levels change each adjacent level by 1.01 for each fixed target',()=>{
    for(const target of [1,70,100]){
        for(let level=2;level<=100;level++){
            const previous=multiplier(level-1,target),current=multiplier(level,target);
            assert.ok(current>previous,`Lv${level-1}/${level} vs ${target}`);
            near(current/previous,1.01);
        }
    }
});
test('all 10000 valid directed level pairs are positive, finite and reciprocal',()=>{
    for(let attacker=1;attacker<=100;attacker++)for(let target=1;target<=100;target++){
        const value=multiplier(attacker,target);
        assert.ok(Number.isFinite(value)&&value>0);
        near(value*multiplier(target,attacker),1);
    }
});
test('invalid Level Contract inputs use Lv1 fallback, never clamp the multiplier',()=>{
    for(const value of [undefined,null,NaN,Infinity,-Infinity,0,-1,101,1.5,Number.MAX_VALUE,'bad']){
        near(multiplier(value,70),Math.pow(1.01,-69));
        near(multiplier(70,value),Math.pow(1.01,69));
        assert.equal(multiplier(value,value),1);
    }
    assert.equal(multiplier('71','70'),1.01,'retain numeric-string compatibility');
});
test('retired linear/clamp tokens cannot return to the Level Damage owner or generated rules',()=>{
    assert.match(owner,/return Math\.pow\(1\.01,levelDiff\);/);
    assert.doesNotMatch(owner,/Math\.(?:min|max)|\b(?:0\.85|1\.15)\b/);
    const retired=/LEVEL_DIFF_FACTOR_(?:PER_LEVEL|MIN|MAX)_PHYSICAL/;
    assert.doesNotMatch(source,retired);
    assert.doesNotMatch(fs.readFileSync('functions/src/generated/plain-player-normal-attack-rules.js','utf8'),retired);
    const status=source.match(/^function calculateStatusEffectChance\([\s\S]*?^\}/m)[0];
    assert.match(status,/void casterLevel;/);assert.match(status,/void targetLevel;/);
    assert.equal((source.match(/^function getDamageLevelMultiplier\(/gm)||[]).length,1);
    for(const file of fs.readdirSync('js').filter(file=>file.endsWith('.js'))){
        assert.doesNotMatch(fs.readFileSync('js/'+file,'utf8'),/(?:^|[;\n])\s*(?:window\.)?getDamageLevelMultiplier\s*=(?!=)/m,file);
    }
});
