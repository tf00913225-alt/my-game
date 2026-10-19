import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
import {assertWildRosterAppendSource} from './cloud-patrol-source-catalog.mjs';

export const THRESHOLDS_PATH='functions/src/generated/character-exp-thresholds.json';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const fail=message=>{throw Error(`Character EXP thresholds: ${message}`);};
const ast=source=>parse(source,{ecmaVersion:'latest'});
const literal=node=>{
    if(node?.type==='Literal'&&['number','string','boolean'].includes(typeof node.value))return node.value;
    if(node?.type==='ArrayExpression')return node.elements.map(literal);
    if(node?.type==='ObjectExpression')return Object.fromEntries(node.properties.map(property=>{
        if(property.type!=='Property'||property.computed||property.method||property.shorthand)fail('nonliteral table');
        return [property.key.name??property.key.value,literal(property.value)];
    }));
    fail('unsupported nonliteral data');
};
function unique(rows,label){if(rows.length!==1)fail(`missing/ambiguous ${label}`);return rows[0];}
function variable(body,name){return unique(body.flatMap(node=>node.type==='VariableDeclaration'
    ?node.declarations.filter(row=>row.id.name===name):[]),name);}
function ownerBody(program){return unique(program.body.filter(node=>node.type==='ExpressionStatement'&&
    node.expression.type==='CallExpression'&&node.expression.callee.type==='FunctionExpression'),'owner IIFE').expression.callee.body.body;}
const functionNode=(body,name)=>unique(body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name===name),name);
function semantic(node){
    if(Array.isArray(node))return node.map(semantic);
    return node&&typeof node==='object'?Object.fromEntries(Object.entries(node)
        .filter(([key])=>!['start','end','raw'].includes(key)).map(([key,value])=>[key,semantic(value)])):node;
}

// Build-time projection only: execute the existing pure curve functions against
// formal static roster DTOs. Never construct a battle, monster stats or rewards.
export async function buildCharacterExpThresholds(root){
    const paths={main:'js/00-main.js',extra:'js/34-v141-core-systems.js',curve:'js/28-v133-economy-rebalance.js',adapter:'js/25-v131-fix-batch.js',
        reward:'functions/src/patrol-reward-policy.js'};
    const sources=Object.fromEntries(Object.entries(paths).map(([key,file])=>[key,fs.readFileSync(path.join(root,file),'utf8')]));
    const main=ast(sources.main).body,extra=ownerBody(ast(sources.extra)),curve=ownerBody(ast(sources.curve));
    // Reuse the existing metadata Owner's exact generic append-algorithm guard.
    // It validates original row tagging plus wind/earth append semantics.
    assertWildRosterAppendSource(sources.extra);
    const arrayNames=['TRAINING_ZONE_EXP_PROFILES','TARGET_BATTLE_ANCHORS','NEWCOMER_EXP_REQUIREMENT_ANCHORS'];
    const arrays=arrayNames.map(name=>variable(curve,name));
    arrays.forEach(row=>literal(row.init));
    const profiles=literal(arrays[0].init),maximum=literal(variable(curve,'MAX_CHARACTER_LEVEL').init);
    if(maximum!==100||profiles.length!==10)fail('unsupported level/profile inventory');
    const zoneConfig=variable(main,'zoneConfig').init;
    if(zoneConfig.type!=='ObjectExpression')fail('unsupported zone configuration');
    const specs=functionNode(extra,'getWildZoneSpecs');
    const returnNode=unique(specs.body.body.filter(node=>node.type==='ReturnStatement'),'zone specs return');
    const specArray=returnNode.argument?.callee?.object;
    if(specArray?.type!=='ArrayExpression'||specArray.elements.length!==profiles.length)fail('unsupported append specs');
    const appendSpecs=specArray.elements.map(row=>{
        if(row?.type!=='ArrayExpression'||row.elements.length!==4||row.elements[0]?.type!=='ConditionalExpression')fail('unsupported append row');
        const [reference,level,wind,earth]=row.elements;
        if(reference.consequent.type!=='Identifier')fail('unsupported append reference');
        return {roster:reference.consequent.name,level:literal(level),names:[literal(wind),literal(earth)]};
    });
    const rate=literal(variable(extra,'WILD_ELITE_RATE').init);
    if(!Number.isFinite(rate)||rate<0||rate>1)fail('invalid elite rate');
    const data={},dependencies=[];
    for(const profile of profiles){
        const zone=unique(zoneConfig.properties.filter(row=>row.key.name===profile.key),`zone ${profile.key}`);
        const getter=unique(zone.value.properties.filter(row=>row.key.name==='monsters'),'roster getter').value;
        if(getter.type!=='ArrowFunctionExpression'||getter.params.length||getter.body.type!=='Identifier')fail('dynamic roster getter');
        const rosterName=getter.body.name,roster=variable(main,rosterName).init;
        if(roster.type!=='ArrayExpression'||!roster.elements.length)fail('missing static roster');
        const rows=roster.elements.map(call=>{
            if(call?.type!=='CallExpression'||call.callee.name!=='makeZoneMonster'||call.arguments.length!==6)fail('unsupported static monster');
            const values=call.arguments.map(literal),[name,level,element,rank,,options]=values;
            if(typeof name!=='string'||!Number.isSafeInteger(level)||level<1||level>100||
               !['regular','elite','boss'].includes(rank)||options.mode!=='wild')fail('invalid static monster metadata');
            return {name,level,element,rank,v141CurveEliteRate:rate};
        });
        const added=unique(appendSpecs.filter(row=>row.roster===rosterName),`append ${rosterName}`);
        for(const [index,name] of added.names.entries())if(!rows.some(row=>row.name===name))
            rows.push({name,level:added.level,element:index?'earth':'wind',rank:'regular',v141CurveEliteRate:rate});
        if(rows.some(row=>!Number.isSafeInteger(row.level)||row.level<1||row.level>100))fail('invalid appended level');
        data[profile.key]={monsters:()=>rows};
        dependencies.push({zone:profile.key,roster:rosterName,initialRows:rows.slice(0,roster.elements.length)
            .map(({name,level,element,rank})=>({name,level,element,rank}))});
    }
    const functionNames=['interpolateAnchors','getCurveMonsterRankMultiplier','getTrainingExpProfile',
        'getTrainingZoneRoster','getTrainingZoneAverageExpForLevel','getTargetBattlesForLevel','getExpNextForLevel'];
    const functions=functionNames.map(name=>functionNode(curve,name));
    const adapterBody=ownerBody(ast(sources.adapter)),adapter=functionNode(adapterBody,'getFormalMonsterBaseExp');
    const compact=value=>value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
    if(compact(sources.adapter.slice(adapter.start,adapter.end))!==
       'functiongetFormalMonsterBaseExp(monster){returnrewardPolicy.formalMonsterBaseExp(monster&&monster.level);}'||
       compact(sources.adapter.slice(variable(adapterBody,'rewardPolicy').start,variable(adapterBody,'rewardPolicy').end))!==
       'rewardPolicy=window.FourSymbolsPatrolRewardPolicy')fail('unsupported formal EXP adapter');
    const exported=unique(adapterBody.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression'&&
        node.expression.left.type==='MemberExpression'&&node.expression.left.object.name==='window'&&
        node.expression.left.property.name==='v173GetFormalMonsterBaseExp'),'formal EXP export');
    if(exported.expression.right.type!=='Identifier'||exported.expression.right.name!=='getFormalMonsterBaseExp')fail('unsupported formal EXP export');
    const math=Object.create(Math);math.random=()=>fail('RNG is not a curve dependency');
    const rewardFunction=functionNode(ownerBody(ast(sources.reward)),'formalMonsterBaseExp');
    // Evaluate the shared pure Owner's exact function bytes, not a require-cache
    // copy that could hide same-process source changes during build checking.
    const formalBase=vm.runInNewContext(`(${sources.reward.slice(rewardFunction.start,rewardFunction.end)})`,
        {Math:math,Date:undefined},{timeout:1000});
    const context=vm.createContext({zoneConfig:data,Math:math,Date:undefined,
        window:{v173GetFormalMonsterBaseExp:monster=>formalBase(monster.level)},
        getMonsterRank:monster=>monster.rank});
    const code=arrays.map(row=>`const ${sources.curve.slice(row.start,row.end)};`).join('\n')+'\n'+
        functions.map(node=>sources.curve.slice(node.start,node.end)).join('\n')+
        '\nArray.from({length:100},(_,index)=>getExpNextForLevel(index+1));';
    const thresholds=Array.from(vm.runInContext(code,context,{timeout:1000}));
    if(thresholds.length!==100||thresholds.some(value=>!Number.isSafeInteger(value)||value<1))fail('invalid threshold result');
    const table={schemaVersion:1,policyId:'character-exp-thresholds-v1',scope:'character-level-threshold-data-only',
        maxLevel:maximum,thresholds,
        sourceDigests:{[paths.main]:hash(dependencies),[paths.extra]:hash({appendSpecs,rate}),
            [paths.curve]:hash([...arrays,...functions].map(semantic)),[paths.adapter]:hash(semantic(adapter)),
            [paths.reward]:hash(semantic(rewardFunction))}};
    return {...table,sha256:hash(table)};
}
export async function syncCharacterExpThresholds(root,checkOnly=false){
    const expected=JSON.stringify(await buildCharacterExpThresholds(root),null,2)+'\n',file=path.join(root,THRESHOLDS_PATH);
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
    if(checkOnly)fail('generated thresholds are stale; regenerate from formal Client sources');
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}
