import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const require=createRequire(import.meta.url);
const policy=require("../functions/src/patrol-reward-policy.js");
const {newcomerExpNext}=require("../functions/src/canonical-newcomer-exp.js");

// Frozen pre-extraction settlement arithmetic from 07402d4c's v131 EXP
// owner and final v133 gold override. It deliberately has no runtime dependency
// on Git or on the new shared policy, so future formula drift breaks parity.
const before={
    exp(rows,progressionLevel){
        const adjusted=(Array.isArray(rows)?rows:[]).reduce((sum,monster)=>{
            if(!monster)return sum;
            const base=Math.max(0,Math.floor((Number(monster.level)||0)*35));
            const rank=monster.rank==="boss"?3:monster.rank==="elite"?1.5:1;
            return sum+base*rank;
        },0);
        const level=Math.max(1,Math.floor(Number(progressionLevel)||1));
        return Math.max(0,Math.floor(adjusted*(level<20?3:1)));
    },
    mode(exp,options){
        const safe=Math.max(0,Math.floor(Number(exp)||0));
        const mode=options&&typeof options==="object"?options:{};
        if(mode.elementBox)return Math.round(safe*.70);
        if(mode.rested)return Math.round(safe*2);
        return safe;
    },
    gold(level,rank,random){
        const safe=Math.max(1,Math.floor(Number(level)||1));
        const multiplier=rank==="boss"?5:rank==="elite"?2:1;
        return Math.max(1,Math.floor((safe*2+3)*multiplier*(.85+random*.30)));
    },
    award(base){
        const amount=Math.max(0,Number(base)||0);
        return amount+Math.max(0,Math.floor(amount*4));
    }
};

test("canonical newcomer thresholds retain the actual first-forest reward and fallback",()=>{
    const thresholds=Array.from({length:9},(_,i)=>newcomerExpNext(i+1));
    assert.deepEqual(thresholds,[300,375,450,525,600,720,840,960,1080]);
    assert.equal(thresholds.reduce((a,b)=>a+b),5850);
    const battle=policy.beginnerForestBattleExp(thresholds);
    assert.equal(battle,293);
    assert.equal(policy.beginnerForestMonsterExpUnit(battle),98);
    for(const [weight,expected] of [[0,294],[1,294],[1.5,441],[2,588],[3,882],[4.5,1323],[9,2646]]){
        assert.equal(policy.beginnerForestExp(battle,weight),expected);
    }
    assert.equal(policy.beginnerForestBattleExp(null),690);
    assert.equal(policy.beginnerForestBattleExp(),690);
    assert.equal(policy.beginnerForestMonsterExpUnit(690),230);
    assert.equal(policy.beginnerForestExp(690,1),690);
    assert.equal(policy.beginnerForestBattleExp([]),1);
    assert.equal(policy.beginnerForestBattleExp(Array(9).fill(2.5)),2);
    const exactNine=new Proxy(thresholds,{get(target,key){
        if(/^\d+$/.test(String(key)))assert.ok(Number(key)<9);
        return Reflect.get(target,key);
    }});
    assert.equal(policy.beginnerForestBattleExp(exactNine),293);
});

test("rank, newcomer boundary and final-sum rounding match established EXP tables",()=>{
    assert.deepEqual(["normal","elite","boss","unknown",undefined].map(policy.expRankMultiplier),
        [1,1.5,3,1,1]);
    for(const [level,expected] of [[1,35],[19,665],[20,700],[100,3500],[1.99,69],[0,0],[-1,0]]){
        assert.equal(policy.formalMonsterBaseExp(level),expected);
    }
    for(const [level,expected] of [[1,3],[19,3],[19.99,3],[20,1],[100,1]]){
        assert.equal(policy.progressionExpMultiplier(level),expected);
    }
    const elite={level:1,rank:"elite"};
    assert.equal(policy.standardPatrolExp([elite],1),157);
    assert.equal(policy.standardPatrolExp([elite,elite],1),315);
    assert.equal(policy.standardPatrolExp([{level:1,rank:"normal"},elite,{level:1,rank:"boss"}],19),577);
    assert.equal(policy.standardPatrolExp([{level:1,rank:"normal"},elite,{level:1,rank:"boss"}],20),192);
    assert.equal(policy.standardPatrolExp([],1),0);
    assert.equal(policy.standardPatrolExp(null,1),0);
});

test("all patrol levels, rank combinations and party sizes preserve pre-extraction EXP",()=>{
    const ranks=["normal","elite","boss"];
    const progression=[1,9,19,19.9,20,50,100];
    for(let level=1;level<=100;level++)for(const a of ranks)for(const b of ranks)for(const c of ranks){
        const group=[{level,rank:a},{level:level+.5,rank:b},{level:Math.max(1,level-1),rank:c}];
        for(let size=1;size<=3;size++)for(const p of progression){
            const rows=group.slice(0,size);
            assert.equal(policy.standardPatrolExp(rows,p),before.exp(rows,p),`${level}/${a}/${b}/${c}/${size}/${p}`);
        }
    }
});

test("mode priority preserves element-box 70 percent before rested doubling",()=>{
    for(const [exp,options,expected] of [
        [294,{},294],[294,{elementBox:true},206],[294,{rested:true},588],
        [294,{elementBox:true,rested:true},206],[5,{elementBox:true},4],
        [1,{elementBox:true},1],[3.9,{rested:true},6],[-3,{rested:true},0]
    ])assert.equal(policy.applyExpMode(exp,options),expected);
    for(const exp of [0,1,2,5,52.5,157,192,294,577,100000,"294",undefined,null,-1]){
        for(const options of [undefined,null,false,{}, {elementBox:true},{rested:true},
            {elementBox:true,rested:true},{elementBox:false,rested:true}]){
            assert.equal(policy.applyExpMode(exp,options),before.mode(exp,options));
        }
    }
});

test("final gold owner keeps ranks 1/2/5, variance and the separate fivefold award",()=>{
    const randoms=[0,.5,1-Number.EPSILON];
    const expected=[
        [1,"normal",[4,5,5]],[1,"elite",[8,10,11]],[1,"boss",[21,25,28]],
        [20,"normal",[36,43,49]],[20,"elite",[73,86,98]],[20,"boss",[182,215,247]],
        [100,"normal",[172,203,233]],[100,"elite",[345,406,466]],[100,"boss",[862,1015,1167]]
    ];
    for(const [level,rank,values] of expected){
        randoms.forEach((sample,i)=>{
            const base=policy.baseGold(level,rank,sample);
            assert.equal(base,values[i],`${level}/${rank}/${sample}`);
            assert.equal(policy.awardedGoldFromBase(base),values[i]*5);
        });
    }
    for(let level=1;level<=100;level++)for(const rank of ["normal","elite","boss"]){
        for(const random of [0,.125,.5,.875,1-Number.EPSILON]){
            const base=policy.baseGold(level,rank,random);
            assert.equal(base,before.gold(level,rank,random));
            assert.equal(policy.awardedGoldFromBase(base),before.award(base));
        }
    }
    // Existing award coercion is preserved independently of integer drops.
    for(const base of [0,1,1.25,2.9,"5",null,undefined,-2]){
        assert.equal(policy.awardedGoldFromBase(base),before.award(base));
    }
});

test("browser UMD and CommonJS expose identical pure arithmetic without RNG or clock consumption",()=>{
    const source=readFileSync(new URL("../functions/src/patrol-reward-policy.js",import.meta.url),"utf8");
    let randomCalls=0,clockCalls=0;
    const math=Object.create(Math);
    math.random=()=>{randomCalls++;throw Error("implicit randomness");};
    const context=vm.createContext({window:{},Math:math,Date:{now(){clockCalls++;throw Error("implicit time");}}});
    vm.runInContext(source,context);
    const browser=context.window.FourSymbolsPatrolRewardPolicy;
    assert.deepEqual(Object.keys(browser).sort(),Object.keys(policy).sort());
    assert.equal(JSON.stringify(browser.constants),JSON.stringify(policy.constants));
    assert.ok(Object.isFrozen(browser));assert.ok(Object.isFrozen(browser.constants));
    assert.ok(Object.isFrozen(policy));assert.ok(Object.isFrozen(policy.constants));
    const cases={beginnerForestBattleExp:[Array(9).fill(300)],beginnerForestMonsterExpUnit:[293],
        expRankMultiplier:["elite"],formalMonsterBaseExp:[19.5],progressionExpMultiplier:[20],
        standardPatrolExp:[[{level:1,rank:"elite"},{level:2,rank:"boss"}],19],
        beginnerForestExp:[293,4.5],applyExpMode:[294,{elementBox:true,rested:true}],
        baseGold:[20,"boss",.5],awardedGoldFromBase:[215]};
    for(const [name,args] of Object.entries(cases))assert.equal(browser[name](...args),policy[name](...args),name);
    assert.equal(randomCalls,0);assert.equal(clockCalls,0);
});
