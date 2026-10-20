import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';

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
function walk(node,visit){
    if(!node||typeof node!=='object')return;
    if(node.type)visit(node);
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(row=>walk(row,visit));else if(value&&typeof value==='object')walk(value,visit);
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
const property=node=>node?.type==='MemberExpression'&&!node.computed?node.property.name:node?.type==='MemberExpression'&&node.property.type==='Literal'?node.property.value:null;
// These seals guard the bounded executable data-application/predicate shapes,
// not the game, battle engine or arbitrary source evaluation. Literal data is
// projected separately; adding a call/branch/write requires explicit review.
const APPLY_SHAPE='02b8c75c9834ae83676fd5762b30e601152836c208df74108c3c5466351efafc';
const SELECT_SHAPE='c52e9baaa524f9f69d86c99b2b30ec47a382e955270468e1a1f5707328bde706';
function shape(node){return hash(semantic(node));}

export async function buildPlayerSkillConfigCatalog(root){
    const source=Object.fromEntries([MAIN,FINAL].map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
    const main=parse(source[MAIN],{ecmaVersion:'latest'}),final=parse(source[FINAL],{ecmaVersion:'latest'});
    const owner=one(final.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.type==='FunctionExpression'),'final data Owner').expression.callee.body.body;
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
        sourceDigests:{[MAIN]:hash({base:[...base].map(([id,n])=>[id,projection(n,id)]),tabs,predicate:semantic(selector)}),
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
