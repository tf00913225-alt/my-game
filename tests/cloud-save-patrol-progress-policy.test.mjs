import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {POLICY_PATH,buildPatrolProgressPolicy,syncPatrolProgressPolicy}
    from '../scripts/lib/cloud-patrol-progress-policy.mjs';

const root=process.cwd(),inputs=['js/00-main.js','js/34-v141-core-systems.js'];
const read=(directory,file)=>fs.readFileSync(path.join(directory,file),'utf8');
function temporary(t){
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'patrol-progress-policy-'));
    t.after(()=>{assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true});});
    for(const file of inputs){const target=path.join(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
    return directory;
}
function snapshot(directory){
    const result={};
    function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
        const file=path.join(folder,entry.name),key=path.relative(directory,file);
        if(entry.isDirectory()){result[key]={directory:true};walk(file);}
        else result[key]={bytes:fs.readFileSync(file).toString('base64'),mtime:fs.statSync(file).mtimeMs};
    }}
    walk(directory);return result;
}
function literal(source,name){
    const match=source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
    assert.ok(match,name);return `const ${name}=${match[1]};`;
}

test('generated keysets and goals equal the actual bounded Client definition arrays and registration',async()=>{
    const policy=await buildPatrolProgressPolicy(root);await syncPatrolProgressPolicy(root,true);
    const main=read(root,inputs[0]),extra=read(root,inputs[1]);
    // Evaluate only four original literal arrays and their registration; never
    // load gameplay, execute counter writers or use a frozen encounter catalog.
    const registration=extra.match(/extraDailyQuests\.forEach\(quest=>\{[\s\S]*?extraCommissionQuests\.forEach\(quest=>\{[\s\S]*?\n    \}\);/)[0];
    const actual=vm.runInNewContext([
        literal(main,'dailyQuestDefinitions'),literal(main,'commissionQuestDefinitions'),
        literal(extra,'extraDailyQuests'),literal(extra,'extraCommissionQuests'),registration,
        'JSON.stringify({daily:Object.fromEntries(dailyQuestDefinitions.map(q=>[q.id,q.goal])),commission:Object.fromEntries(commissionQuestDefinitions.map(q=>[q.id,q.goal]))})'
    ].join('\n'),{}, {timeout:1000});
    assert.deepEqual(policy.quests,JSON.parse(actual));
    for(const [group,id] of [['daily','checkin'],['daily','skills5'],['commission','skills15']])assert.ok(Object.hasOwn(policy.quests[group],id));
    assert.equal(policy.scope,'quest-progress-data-only');assert.equal(policy.outcomeVerified,false);assert.equal(policy.rewardEligible,false);
    assert.match(policy.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(Object.keys(policy.sourceDigests),inputs);
});

test('period metadata follows actual UTC reset rather than the Taipei dungeon boundary',async()=>{
    const policy=await buildPatrolProgressPolicy(root),main=read(root,inputs[0]);
    assert.deepEqual(policy.period,{timeZone:'UTC',dateFormat:'YYYY-MM-DD',boundary:'00:00:00Z'});
    const reset=main.match(/^function ensureDailyQuestsCurrent\(\)\{[\s\S]*?^\}/m)[0];
    for(const [instant,changed] of [['2026-10-19T15:59:59.999Z',false],['2026-10-19T16:00:00.000Z',false],
        ['2026-10-19T23:59:59.999Z',false],['2026-10-20T00:00:00.000Z',true]]){
        class PinnedDate extends Date{constructor(...args){super(...(args.length?args:[Date.parse(instant)]));}}
        const context={Date:PinnedDate,
            dailyQuestState:{date:'2026-10-19',progress:{checkin:1,killMonsters:2,winBattle:1},claimed:{checkin:true,killMonsters:false,winBattle:true}},
            commissionQuestState:{date:'2026-10-19',progress:{killMonsters:2,winBattle:1},claimed:{killMonsters:false,winBattle:true}}};
        const before=structuredClone(context.dailyQuestState);
        vm.runInNewContext(reset+';ensureDailyQuestsCurrent();',context,{timeout:1000});
        assert.equal(context.dailyQuestState.date,changed?'2026-10-20':'2026-10-19');
        if(changed){assert.equal(context.dailyQuestState.progress.killMonsters,0);assert.equal(context.dailyQuestState.claimed.checkin,false);}
        else assert.deepEqual(context.dailyQuestState,before);
    }
});

test('unrelated source, display and reward churn is stable while formal goals and keysets change the seal',async t=>{
    const directory=temporary(t),baseline=await buildPatrolProgressPolicy(directory),mainPath=path.join(directory,inputs[0]);
    const original=read(directory,inputs[0]);
    fs.writeFileSync(mainPath,original.replace('name:"今日簽到"','name:"display only"').replace('reward:{gold:50}','reward:{gold:51}')+'\n// unrelated gameplay note\n');
    assert.deepEqual(await buildPatrolProgressPolicy(directory),baseline);
    fs.writeFileSync(mainPath,original.replace('goal:5,','goal:6,'));
    const changed=await buildPatrolProgressPolicy(directory);
    assert.equal(changed.quests.daily.killMonsters,baseline.quests.daily.killMonsters+1);assert.notEqual(changed.sha256,baseline.sha256);
    const extraPath=path.join(directory,inputs[1]),extra=read(directory,inputs[1]);fs.writeFileSync(mainPath,original);
    fs.writeFileSync(extraPath,extra.replace('id:"skills15"','id:"skills16"'));
    const renamed=await buildPatrolProgressPolicy(directory);
    assert.ok(!Object.hasOwn(renamed.quests.commission,'skills15'));assert.ok(Object.hasOwn(renamed.quests.commission,'skills16'));
    assert.notEqual(renamed.sha256,baseline.sha256);
});

test('missing, current and stale checkOnly paths perform no filesystem writes',async t=>{
    const directory=temporary(t),output=path.join(directory,POLICY_PATH);
    assert.deepEqual(await buildPatrolProgressPolicy(directory),await buildPatrolProgressPolicy(directory));
    let before=snapshot(directory);await assert.rejects(syncPatrolProgressPolicy(directory,true));assert.deepEqual(snapshot(directory),before);
    assert.equal(fs.existsSync(output),false);await syncPatrolProgressPolicy(directory);
    before=snapshot(directory);await syncPatrolProgressPolicy(directory,true);assert.deepEqual(snapshot(directory),before);
    const stored=JSON.parse(fs.readFileSync(output,'utf8'));stored.sha256='0'.repeat(64);fs.writeFileSync(output,JSON.stringify(stored)+'\n');
    before=snapshot(directory);await assert.rejects(syncPatrolProgressPolicy(directory,true));assert.deepEqual(snapshot(directory),before);
});

test('ambiguous declarations, identities and unsupported executable or period shapes fail closed',async t=>{
    const directory=temporary(t);
    for(const [file,oldText,newText] of [
        [inputs[0],'const dailyQuestDefinitions=[','const dailyQuestDefinitions=[];\nconst dailyQuestDefinitions=['],
        [inputs[0],'goal:5,','goal:Math.max(5,1),'],
        [inputs[0],'goal:5,','goal:9007199254740992,'],
        [inputs[0],'goal:5,','goal:0,'],
        [inputs[0],'id:"killMonsters",','id:"checkin",'],
        [inputs[0],'.toISOString()','.toLocaleDateString()'],
        [inputs[1],'id:"kill10",','id:"killMonsters",'],
        [inputs[1],'dailyQuestDefinitions.push(quest);','dailyQuestDefinitions.unshift(quest);'],
        [inputs[1],'goal:10,','goal:10,unknown:true,'],
    ]){
        const target=path.join(directory,file),original=fs.readFileSync(target,'utf8');
        const mutated=original.replace(oldText,newText);assert.notEqual(mutated,original,oldText);fs.writeFileSync(target,mutated);
        const before=snapshot(directory);await assert.rejects(buildPatrolProgressPolicy(directory),undefined,oldText);
        assert.deepEqual(snapshot(directory),before);fs.writeFileSync(target,original);
    }
});
