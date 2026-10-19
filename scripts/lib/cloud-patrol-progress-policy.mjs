import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const POLICY_PATH='functions/src/generated/patrol-progress-policy.json';
const hash=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const compact=value=>value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
const fail=message=>{throw Error(`Patrol progress policy: ${message}`);};
const UTC_RESET_SHAPE='d72125ed23a8f239a1c73cca6a3c706d947add691bf947b94bbbd03b16086653';
const STRING='"(?:[^"\\\\\r\n]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
function one(source,pattern,label){
    const matches=[...source.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
    if(matches.length!==1)fail(`missing or ambiguous ${label}`);
    return matches[0];
}
function table(source,name){
    const block=one(source,new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`),name)[1];
    // Literal rows only: never execute Client code or accept expressions,
    // spreads, methods or unknown fields. Display/reward values are not policy.
    const row=new RegExp(`\\{\\s*id\\s*:\\s*(${STRING})\\s*,\\s*name\\s*:\\s*(${STRING})\\s*,\\s*desc\\s*:\\s*(${STRING})\\s*,\\s*goal\\s*:\\s*(\\d+)\\s*,\\s*reward\\s*:\\s*\\{\\s*((?:gold|exp)\\s*:\\s*\\d+(?:\\s*,\\s*(?:gold|exp)\\s*:\\s*\\d+)?)\\s*\\}\\s*\\}`,'g');
    const result=[],ids=new Set();let end=0;
    for(const match of block.matchAll(row)){
        const gap=block.slice(end,match.index);
        if(!(result.length?/^\s*,\s*$/:/^\s*$/).test(gap))fail(`unsupported ${name} rows`);
        const id=JSON.parse(match[1]),goal=Number(match[4]);
        const rewardKeys=[...match[5].matchAll(/(gold|exp)\s*:/g)].map(value=>value[1]);
        if(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id)||['constructor','prototype'].includes(id)||
            ids.has(id)||!Number.isSafeInteger(goal)||goal<1||new Set(rewardKeys).size!==rewardKeys.length){
            fail(`invalid or duplicate ${name} identity/goal`);
        }
        ids.add(id);result.push({id,goal});end=match.index+match[0].length;
    }
    if(!result.length||!/^\s*,?\s*$/.test(block.slice(end)))fail(`unsupported ${name} rows`);
    return result;
}
function appendShape(source,extra,base){
    const expression=new RegExp(`${extra}\\.forEach\\(quest=>\\{([\\s\\S]*?)\\n    \\}\\);`);
    const actual=compact(one(source,expression,`${extra} registration`)[0]);
    const expected=`${extra}.forEach(quest=>{if(!${base}.some(item=>item.id===quest.id)){${base}.push(quest);}});`;
    if(actual!==expected)fail(`unsupported ${extra} registration`);
    return actual;
}

// Generated source data only. The Forest earning Owner controls counters,
// UTC view transitions, retained claims and atomic settlement separately.
export async function buildPatrolProgressPolicy(root){
    const mainPath='js/00-main.js',extraPath='js/34-v141-core-systems.js';
    const main=fs.readFileSync(path.join(root,mainPath),'utf8');
    const extra=fs.readFileSync(path.join(root,extraPath),'utf8');
    const daily=table(main,'dailyQuestDefinitions'),commission=table(main,'commissionQuestDefinitions');
    const extraDaily=table(extra,'extraDailyQuests'),extraCommission=table(extra,'extraCommissionQuests');
    const reset=compact(one(main,/^function ensureDailyQuestsCurrent\(\)\{[\s\S]*?^\}/m,'UTC quest reset')[0]);
    if(hash(reset)!==UTC_RESET_SHAPE)fail('unsupported UTC quest reset algorithm');
    const registrations=[appendShape(extra,'extraDailyQuests','dailyQuestDefinitions'),
        appendShape(extra,'extraCommissionQuests','commissionQuestDefinitions')];
    const merge=(base,added)=>{
        const rows=[...base,...added];
        if(new Set(rows.map(row=>row.id)).size!==rows.length)fail('ambiguous base/expanded quest identity');
        return Object.fromEntries(rows.map(row=>[row.id,row.goal]));
    };
    const policy={schemaVersion:1,policyId:'wild-patrol-progress-v1',scope:'quest-progress-data-only',
        period:{timeZone:'UTC',dateFormat:'YYYY-MM-DD',boundary:'00:00:00Z'},
        quests:{daily:merge(daily,extraDaily),commission:merge(commission,extraCommission)},
        sourceDigests:{[mainPath]:hash(JSON.stringify(stable({daily,commission,reset}))),
            [extraPath]:hash(JSON.stringify(stable({daily:extraDaily,commission:extraCommission,registrations})))},
        outcomeVerified:false,rewardEligible:false};
    return {...policy,sha256:hash(JSON.stringify(stable(policy)))};
}
export async function syncPatrolProgressPolicy(root,checkOnly=false){
    const expected=JSON.stringify(await buildPatrolProgressPolicy(root),null,2)+'\n';
    const file=path.join(root,POLICY_PATH);
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
    if(checkOnly)fail('generated data is stale; regenerate from Client quest definitions');
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}
