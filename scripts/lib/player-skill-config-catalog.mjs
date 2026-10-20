import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
import {verifySkillLoadoutPolicy} from './skill-learning-policy.mjs';

export const CATALOG_PATH='functions/src/generated/player-skill-config-catalog.json';
const MAIN='js/00-main.js',FINAL='js/60-v173.64-skill-progression-rebalance.js';
const FIELDS=new Set(['id','name','element','category','learnLevel','learnCost','maxLevel','requires']);
const fail=message=>{throw Error(`Player skill catalog: ${message}`);};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function semantic(value){
    return Array.isArray(value)?value.map(semantic):value&&typeof value==='object'
        ?Object.fromEntries(Object.entries(value).filter(([key])=>!['start','end','raw'].includes(key)).map(([key,v])=>[key,semantic(v)])):value;
}
function walk(node,visit,parent=null){
    if(!node||typeof node!=='object')return;
    if(node.type)visit(node,parent);
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(row=>walk(row,visit,node));else if(value&&typeof value==='object')walk(value,visit,node);
}
function one(rows,label){if(rows.length!==1)fail(`missing or ambiguous ${label}`);return rows[0];}
function variable(body,name){return one(body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations.filter(d=>d.id.name===name):[]),name).init;}
function object(node,label){
    if(node?.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&
       node.callee.object.name==='Object'&&node.callee.property.name==='freeze'&&node.arguments.length===1)node=node.arguments[0];
    if(node?.type!=='ObjectExpression')fail(`nonliteral ${label}`);
    const result=new Map();
    for(const p of node.properties){
        if(p.type!=='Property'||p.computed||p.method||p.shorthand||p.kind!=='init')fail(`unsupported ${label} property`);
        const key=p.key.name??p.key.value;
        if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||result.has(key))fail(`duplicate or unsafe ${label} key`);
        result.set(key,p.value);
    }
    return result;
}
function literal(node){
    if(node?.type==='Literal'&&(node.value===null||['string','boolean','number'].includes(typeof node.value))){
        if(typeof node.value==='number'&&!Number.isFinite(node.value))fail('nonfinite literal');return node.value;
    }
    if(node?.type==='ArrayExpression')return node.elements.map(literal);
    fail('unsupported selected data expression');
}
function projection(node,label){
    const result={};for(const [key,value] of object(node,label))if(FIELDS.has(key))result[key]=literal(value);return result;
}
function assertLiteralData(node,constants,seen=new Set()){
    if(node?.type==='Literal'){literal(node);return;}
    if(node?.type==='ArrayExpression'){node.elements.forEach(value=>assertLiteralData(value,constants,seen));return;}
    if(node?.type==='ObjectExpression'){
        for(const value of object(node,'literal data').values())assertLiteralData(value,constants,seen);return;
    }
    if(node?.type==='CallExpression'&&node.callee.object?.name==='Object'&&property(node.callee)==='freeze'&&node.arguments.length===1){
        assertLiteralData(node.arguments[0],constants,seen);return;
    }
    if(node?.type==='CallExpression'&&node.callee.object?.type==='Identifier'&&property(node.callee)==='slice'&&node.arguments.length===0){
        const name=node.callee.object.name;
        if(!constants.has(name)||seen.has(name))fail('unknown or cyclic literal copy');
        const next=new Set(seen);next.add(name);assertLiteralData(constants.get(name),constants,next);return;
    }
    fail('unsupported literal data operation');
}
const property=node=>node?.type==='MemberExpression'&&!node.computed?node.property.name:node?.type==='MemberExpression'&&node.property.type==='Literal'?node.property.value:null;
// These seals guard the bounded executable data-application/predicate shapes,
// not the game, battle engine or arbitrary source evaluation. Literal data is
// projected separately; adding a call/branch/write requires explicit review.
const APPLY_SHAPE='02b8c75c9834ae83676fd5762b30e601152836c208df74108c3c5466351efafc';
const SELECT_SHAPE='c52e9baaa524f9f69d86c99b2b30ec47a382e955270468e1a1f5707328bde706';
function shape(node){return hash(semantic(node));}
const MUTATION_SHAPES={
    "js/00-main.js": "e5c312f3416941e40c734dba9515121e882d0e137acf49065b20e504c3cbcb56",
    "js/24-v125-character-creation-native-runtime.js": "effa01fc6dac22efd9d90690c5b08b01646829e02b8d6fc7c613a469ac15f059",
    "js/27-v132-content-expansion.js": "5b1bb0a81ee9bddea865b532fed9a8e79724f2f732ca9a249621d4c95b276274",
    "js/30-v135-fixes.js": "544cfc417711f51f0ed2e376aaa0ad62b1ecac39f0d636a1454f9ec0de7f99a1",
    "js/31-v136-auto-battle-fix.js": "6d89015f53eef221a6b30ea1c6ab84cd119d9778c6ce541ad9d0df95448ad1e1",
    "js/33-v140-four-element-balance.js": "5206b0ed6ca2fb5eb1617308d08c0bf2a255be85ea8222a8620d7d30ee7f5c63",
    "js/34-v141-core-systems.js": "6f6f029d83f67647998483c9b68469c5552fbba2a76357eefeb9d1488b5a38ba",
    "js/36-v141-content-systems.js": "dc18c5ea1b18bc92a65ccb49cc84841eed2db8cf9a65d96680c85049cf8efc56",
    "js/37-v142-skill-animation.js": "1a9245f36dd9c2c561aa8364d8d4ec3cbc993a5f1697506528b150e183ae3be2",
    "js/40-v144-rules-and-abyss.js": "99f3a61e3ad198c96d06e380fe3eb255303d04df6de2bd3d9d366ba1335b88a0",
    "js/41-v146-system-polish.js": "b7503d8242fe2efea96e1d2c34a7818363f02e9b9cc8c4884a64c997dbbc6e47",
    "js/42-v148-combat-dungeon-fixes.js": "c35ba23ed1db351a43443df5ff8f80612c2a7f42fe80e25a77ff06a6ceae2ed8",
    "js/43-v149-skill-ui-rules.js": "6b3205e8e4264d5da76144650cddf58e49c4a771e9bf074dda6a9bb901619be9",
    "js/44-v152-dev-fixes.js": "0797b29a33757c15398bbf677daf5db461ec024e3f96137c60cb8df9a0d3fa3a",
    "js/46-v155-dev-fixes.js": "cf5ca18ce582a394ff8c19e89e865e3858832e4eb6025878b42d67db7360329f",
    "js/60-v173.64-skill-progression-rebalance.js": "60630b914cd25ba3a8072b721a7564866bf6eb9493718c717f7fd253a12ff49c"
};
function rooted(node,names){
    while(node?.type==='MemberExpression')node=node.object;
    return node?.type==='Identifier'&&names.has(node.name);
}
function retainedLoadoutReader(node){
    const callee=node.callee,owner=callee?.object;
    return node.type==='CallExpression'&&!node.optional&&callee?.type==='MemberExpression'&&!callee.computed&&!callee.optional&&
        callee.property?.type==='Identifier'&&callee.property.name==='getLoadoutRulesForVersion'&&
        owner?.type==='MemberExpression'&&!owner.computed&&!owner.optional&&owner.object?.type==='Identifier'&&owner.object.name==='window'&&
        owner.property?.type==='Identifier'&&owner.property.name==='FourSymbolsSkillProgressionCore'&&
        node.arguments.length===2&&node.arguments[0]?.type==='Literal'&&node.arguments[0].value==='v1'&&
        node.arguments[1]?.type==='Identifier'&&node.arguments[1].name==='skillDatabase';
}
// Closed compatibility for this mechanical delegation only. These are AST
// data-provenance identities, not hashes of the new raw source files.
const LOADOUT_DELEGATES={
    'js/00-main.js':{owner:null,selectors:['function:removeEquippedSkill'],sha256:'b2f3858bf497f0593bd4c2230b04b5d6fca107156909c75bc30af18e1fd3a81f'},
    'js/31-v136-auto-battle-fix.js':{owner:'installV136AutoBattleFix',selectors:['const:loadoutRules','function:normalizeAction',
        'function:isUnsupportedAutoCategory','function:rememberExplicitAction','function:migrateCurrentIntent',
        'function:restoreSkillAfterLegacySync','function:saveCurrentActionFromPanel','if:saveAutoSettingsFormToCharacter',
        'if:populateAutoSkillOptions','if:populateAutoSkillOptions2','migration'],sha256:'ff5691f28bbf4c2028a18f3b3b6a9ea9f9664b15afcc516616887d68ee546d6b',
        footprint:'fec835377b38d6a63d56c14f427545e7c3c13242b4ae9c74a400ad34e0d58e9a'},
    'js/60-v173.64-skill-progression-rebalance.js':{owner:'installV17364SkillProgression',selectors:['const:loadoutRules',
        'function:normalizeCrossElementEquip','function:normalizeAllCrossElementEquips','if:equipSkill'],sha256:'fe3d8105ecdca4bd3010d66f2f661d56e91ce2186a51e255291de72524f407b1',
        footprint:'1ae65815063a6979a56a0e1d326ad65adaef9d0979b3b6eee4e5a9852470fe75'}
};
function delegateLabel(node){
    if(node?.type==='FunctionDeclaration')return 'function:'+node.id.name;
    if(node?.type==='VariableDeclaration'&&node.kind==='const'&&node.declarations.length===1)return 'const:'+node.declarations[0].id.name;
    if(node?.type==='IfStatement'&&node.test?.type==='BinaryExpression'&&node.test.left?.type==='UnaryExpression'&&
        node.test.left.operator==='typeof'&&node.test.left.argument.type==='Identifier')return 'if:'+node.test.left.argument.name;
    const call=node?.expression;
    if(call?.type==='CallExpression'&&call.callee?.type==='MemberExpression'&&call.callee.object?.type==='ArrayExpression'&&
        property(call.callee)==='forEach'&&call.arguments[0]?.name==='migrateCurrentIntent')return 'migration';
    return node?.type??null;
}
function loadoutDelegateShape(ast,file){
    const policy=LOADOUT_DELEGATES[file];if(!policy)fail('unsupported loadout reader location');
    const owner=policy.owner?one(ast.body.filter(n=>n.type==='ExpressionStatement'&&n.expression?.type==='CallExpression'&&
        n.expression.callee?.type==='FunctionExpression'&&n.expression.callee.id?.name===policy.owner),'loadout lifecycle Owner').expression.callee.body:ast;
    const protectedNames=new Set(policy.selectors.filter(key=>key!=='migration').map(key=>key.split(':')[1])),allowedAssignments=new WeakSet(),readers=new Set();
    const selected=policy.selectors.map(label=>{
        const found=owner.body.map((node,index)=>({node,index})).filter(({node})=>delegateLabel(node)===label);
        const {node,index}=one(found,'loadout delegate '+label);
        walk(node,child=>{if(child.type==='AssignmentExpression'&&child.left.type==='Identifier'&&protectedNames.has(child.left.name))allowedAssignments.add(child);});
        walk(node,child=>{if(retainedLoadoutReader(child))readers.add(child);});
        return {label,before:delegateLabel(owner.body[index-1]),after:delegateLabel(owner.body[index+1]),node:semantic(node)};
    });
    walk(ast,node=>{if(node.type==='AssignmentExpression'&&node.left.type==='Identifier'&&protectedNames.has(node.left.name)&&!allowedAssignments.has(node)||
        node.type==='UpdateExpression'&&node.argument.type==='Identifier'&&protectedNames.has(node.argument.name))fail('loadout delegate cannot be rebound');});
    return {sha256:hash(selected),readers};
}
// Closed source-change guard, not an interpreter: existing runtime data
// mutators remain in their original Owners and are never executed here.
function mutationShapes(root,asts,apply){
    const build=parse(fs.readFileSync(path.join(root,'scripts/build-production.mjs'),'utf8'),{ecmaVersion:'latest',sourceType:'module'});
    const files=['appScripts','gameplayScripts'].flatMap(name=>literal(variable(build.body,name)));
    if(files.filter(file=>file===MAIN).length!==1||files.filter(file=>file===FINAL).length!==1||files.indexOf(MAIN)>files.indexOf(FINAL))fail('ambiguous formal load order');
    const result={},checkedLoadoutDelegates=new Map();
    for(const file of files){
        if(typeof file!=='string'||file.includes('..')||!file.endsWith('.js'))fail('unsupported source path');
        const ast=asts[file]||parse(fs.readFileSync(path.join(root,file),'utf8'),{ecmaVersion:'latest'});
        const aliases=new Set(['skillDatabase']);let changed=true;
        while(changed){changed=false;walk(ast,n=>{
            const target=n.type==='VariableDeclarator'?n.id:n.type==='AssignmentExpression'?n.left:null;
            const value=n.type==='VariableDeclarator'?n.init:n.type==='AssignmentExpression'?n.right:null;
            if(rooted(value,aliases)){
                if(target?.type!=='Identifier'){
                    if(target?.type!=='MemberExpression')fail('unsupported skill record destructuring');
                }else if(!aliases.has(target.name)){aliases.add(target.name);changed=true;}
            }
        });}
        const parents=new WeakMap();walk(ast,(n,parent)=>{if(parent)parents.set(n,parent);});
        const rows=[];walk(ast,n=>{
            if(file===FINAL&&n.start>=apply.start&&n.end<=apply.end)return;
            const left=n.type==='AssignmentExpression'?n.left:n.type==='UnaryExpression'&&n.operator==='delete'?n.argument:null;
            if(n.type==='AssignmentExpression'&&rooted(n.right,aliases)&&!rooted(n.left,aliases))rows.push({escape:semantic(n)});
            if(left?.type==='MemberExpression'&&rooted(left,aliases)&&
               (left.object.name==='skillDatabase'||FIELDS.has(property(left))||property(left)===null))rows.push(semantic(n));
            if(n.type!=='CallExpression')return;
            if(retainedLoadoutReader(n)){
                if(!checkedLoadoutDelegates.has(file)){
                    const sealed=loadoutDelegateShape(ast,file);
                    if(sealed.sha256!==LOADOUT_DELEGATES[file].sha256)fail('unsupported loadout delegate lifecycle');
                    checkedLoadoutDelegates.set(file,sealed.readers);
                }
                if(!checkedLoadoutDelegates.get(file).has(n))fail('unsupported loadout reader location');
                return;
            }
            if(n.callee.type==='Identifier'&&n.callee.name==='patchSkill'){
                if(n.arguments.length!==2)fail('unsupported historical patch call');
                rows.push({patchSkill:literal(n.arguments[0]),fields:projection(n.arguments[1],'historical patch fields')});
            }
            // A new opaque call receiving the catalogue/a record must not
            // silently become a data mutator. Existing call sites are sealed.
            if(n.arguments.some(arg=>rooted(arg,aliases))||rooted(n.callee.object,aliases)){
                const reader=n.callee.object?.name==='Object'&&['keys','values','entries'].includes(property(n.callee));
                if(reader){
                    let consumer=n;
                    while(['MemberExpression','CallExpression'].includes(parents.get(consumer)?.type))consumer=parents.get(consumer);
                    rows.push({enumeration:semantic(consumer)});
                }else rows.push({call:semantic(n.callee),arguments:n.arguments.map(arg=>rooted(arg,aliases)?semantic(arg):{type:arg.type})});
            }
        });
        if(rows.length)result[file]=hash(rows);
    }
    if(JSON.stringify(Object.keys(result))!==JSON.stringify(Object.keys(MUTATION_SHAPES)))fail('unsupported skill data mutator footprint');
    for(const file of Object.keys(result))if(result[file]!==MUTATION_SHAPES[file]){
        if(!checkedLoadoutDelegates.has(file)||!LOADOUT_DELEGATES[file].footprint||result[file]!==LOADOUT_DELEGATES[file].footprint)
            fail('unsupported skill data mutator footprint');
        result[file]=MUTATION_SHAPES[file];
    }
    return result;
}

export async function buildPlayerSkillConfigCatalog(root){
    verifySkillLoadoutPolicy(root);
    const source=Object.fromEntries([MAIN,FINAL].map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
    const main=parse(source[MAIN],{ecmaVersion:'latest'}),final=parse(source[FINAL],{ecmaVersion:'latest'});
    const owner=one(final.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='FunctionExpression'),'final data Owner').expression.callee.body.body;
    const constants=new Map(owner.flatMap(n=>n.type==='VariableDeclaration'?n.declarations.filter(d=>d.id.type==='Identifier').map(d=>[d.id.name,d.init]):[]));
    for(const node of [variable(main.body,'skillDatabase'),variable(owner,'FINAL_PROGRESSION'),variable(owner,'FINAL_REBALANCE_DATA')])assertLiteralData(node,constants);
    const base=object(variable(main.body,'skillDatabase'),'base skill table');
    const db=Object.fromEntries([...base].map(([id,node])=>[id,projection(node,id)]));
    const tabsNode=variable(main.body,'SKILL_ELEMENT_TAB_META');
    if(tabsNode.type!=='CallExpression'||tabsNode.callee.object?.name!=='Object'||property(tabsNode.callee)!=='freeze'||tabsNode.arguments.length!==1)fail('unsupported element tabs');
    const tabs=[...object(tabsNode.arguments[0],'element tabs')].map(([key,value])=>{
        if(literal(object(value,'element tab').get('element'))!==key)fail('ambiguous element tab');return key;
    });
    if(tabs.join('|')!=='fire|water|wind|earth')fail('unsupported formal element tabs');
    const matching=[];walk(main,n=>{if(n.type==='VariableDeclarator'&&n.id.name==='matchingSkillIds')matching.push(n);});
    const selector=one(matching,'renderer predicate').init;
    if(shape(selector)!==SELECT_SHAPE)fail('unsupported renderer predicate');
    const damageNode=variable(owner,'PLAYER_DAMAGE_SKILL_IDS');
    if(damageNode.type!=='CallExpression'||damageNode.callee.object?.name!=='Object'||property(damageNode.callee)!=='freeze'||damageNode.arguments.length!==1)fail('unsupported damage classifications');
    const damage=literal(damageNode.arguments[0]);
    if(new Set(damage).size!==damage.length||damage.some(id=>typeof id!=='string'))fail('ambiguous damage classifications');
    const progression=object(variable(owner,'FINAL_PROGRESSION'),'final progression'),rebalance=object(variable(owner,'FINAL_REBALANCE_DATA'),'final rebalance');
    const apply=one(owner.filter(n=>n.type==='FunctionDeclaration'&&n.id.name==='applyFinalProgressionData'),'final data application');
    if(shape(apply)!==APPLY_SHAPE)fail('unsupported final data application');
    const activations=[];walk(final,n=>{if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='applyFinalProgressionData')activations.push(n);});
    const activation=one(activations,'final data activation');
    if(activation.arguments.length||activation.start<apply.end||!owner.some(n=>n.type==='ExpressionStatement'&&n.expression===activation))fail('unsupported final data activation');
    const mutators=mutationShapes(root,{[MAIN]:main,[FINAL]:final},apply);
    // No unmodelled top-level override can hide after the final data function.
    const outside=[];walk(final,n=>{
        if(n.start>=apply.start&&n.end<=apply.end)return;
        if(n.type==='AssignmentExpression'&&source[FINAL].slice(n.left.start,n.left.end).startsWith('skillDatabase'))outside.push(n);
    });
    if(outside.length)fail('unrecognised skill table override');
    const purify=[];walk(apply,n=>{if(n.type==='AssignmentExpression'&&n.left.object?.name==='skillDatabase'&&property(n.left)==='purifyMind')purify.push(n.right);});
    if(!db.purifyMind)db.purifyMind=projection(one(purify,'Purify initial definition'),'Purify');
    for(const [id,node] of progression){
        const fields=projection(node,id);
        if(!db[id]){
            // Exactly the original creation branch; the shape seal above guards it.
            if(!['fireSoulResonance','bloodBurnArt'].includes(id))continue;
            db[id]={id};
        }
        Object.assign(db[id],fields);db[id].id=db[id].id||id;
        if(damage.includes(id))db[id].maxLevel=10;
    }
    // Original post-table aliases restore these prerequisites before rebalance.
    const requires=[];walk(apply,n=>{if(n.type==='AssignmentExpression'&&property(n.left)==='requires')requires.push(n);});
    const aliases=new Map();for(const n of apply.body.body)if(n.type==='VariableDeclaration')for(const d of n.declarations)
        if(d.init?.object?.name==='skillDatabase')aliases.set(d.id.name,property(d.init));
    for(const n of requires){const id=aliases.get(n.left.object?.name);if(!id||!db[id])fail('unknown prerequisite alias');db[id].requires=literal(n.right);}
    for(const [id,node] of rebalance)if(db[id])Object.assign(db[id],projection(node,id));
    const skills=Object.entries(db).filter(([,s])=>s&&s.element&&Object.hasOwn(s,'learnLevel')&&s.category!=='monster'&&tabs.includes(s.element))
        .map(([id,s])=>{
            if(s.id!==id||typeof s.name!=='string'||!s.name||typeof s.category!=='string'||
               !Number.isSafeInteger(s.learnLevel)||s.learnLevel<1||!Number.isSafeInteger(s.learnCost)||s.learnCost<0||
               !Number.isSafeInteger(s.maxLevel)||s.maxLevel<1||s.maxLevel>10||
               (s.requires!==undefined&&(!Array.isArray(s.requires)||new Set(s.requires).size!==s.requires.length||s.requires.some(key=>typeof key!=='string'||!db[key]))))fail('invalid final player skill data');
            return {...s,damageClassification:damage.includes(id)?'direct':'non-direct'};
        });
    if(!skills.length||damage.some(id=>!skills.some(s=>s.id===id)))fail('incomplete player catalogue');
    const catalog={schemaVersion:1,catalogId:'player-skill-config-v1',scope:'player-skill-configuration-only',skills,
        sourceDigests:{...mutators,[MAIN]:hash({base:[...base].map(([id,n])=>[id,projection(n,id)]),tabs,predicate:semantic(selector),mutator:mutators[MAIN]}),
            [FINAL]:hash({progression:[...progression].map(([id,n])=>[id,projection(n,id)]),rebalance:[...rebalance].map(([id,n])=>[id,projection(n,id)]),damage,apply:semantic(apply)})},
        rewardEligible:false,authoritativeStateReady:false};
    return {...catalog,sha256:hash(catalog)};
}
export async function syncPlayerSkillConfigCatalog(root,checkOnly=false){
    const file=path.join(root,CATALOG_PATH),expected=JSON.stringify(await buildPlayerSkillConfigCatalog(root),null,2)+'\n';
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===expected)return;
    if(checkOnly)fail('generated data is stale; regenerate from formal Client skill Owners');
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,expected);
}
