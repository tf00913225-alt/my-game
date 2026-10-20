// Immutable retained policy guard; verifies the original shared Owner only.
import {parse} from 'acorn';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

function semantic(value){
 if(Array.isArray(value))return value.map(semantic);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value)
  .filter(([key])=>!['start','end','loc','raw'].includes(key)).map(([key,row])=>[key,semantic(row)]));
 return value;
}
export function skillLearningRuleSemanticDigest(source){
 const program=parse(source,{ecmaVersion:2022});
 const wrapper=program.body.find(node=>node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&
  node.expression.callee.type==='FunctionExpression'&&node.expression.callee.id?.name==='installSkillProgressionCore');
 if(program.body.length!==1||!wrapper)throw Error('Skill progression original UMD Owner is unsupported.');
 const body=wrapper.expression.callee.body.body;
 const declaration=name=>body.filter(node=>node.type==='VariableDeclaration'&&node.kind==='const'&&
  node.declarations.length===1&&node.declarations[0].id.type==='Identifier'&&node.declarations[0].id.name===name);
 const factories=declaration('createRulesV1');
 const costs=body.filter(node=>node.type==='VariableDeclaration'&&node.declarations.length===1&&
  node.declarations[0].id.name==='SKILL_UPGRADE_COST_BY_TARGET_LEVEL');
 const selectors=declaration('getRulesForVersion');
 if(factories.length!==1||costs.length!==1||selectors.length!==1)throw Error('Retained v1 skill rules are missing or ambiguous.');
 const factory=factories[0].declarations[0].init,selector=selectors[0].declarations[0].init;
 if(factory?.type!=='FunctionExpression'||selector?.type!=='FunctionExpression'||
  JSON.stringify(semantic(selector.params))!==JSON.stringify(semantic(parse('(function(version,catalog,damageSkillIds){})',{ecmaVersion:2022}).body[0].expression.params)))
  throw Error('Retained v1 skill bindings are unsupported.');
 const expected=parse('(function(){if(version==="v1"){return createRulesV1(catalog,damageSkillIds);} throw new RangeError("Unsupported skill progression rules version");})',{ecmaVersion:2022}).body[0].expression.body.body;
 if(JSON.stringify(semantic(selector.body.body[0]))!==JSON.stringify(semantic(expected[0]))||
  JSON.stringify(semantic(selector.body.body.at(-1)))!==JSON.stringify(semantic(expected[1])))
  throw Error('Retained v1 selector must directly forward its original arguments.');
 const guarded=new Set(['createRulesV1','getRulesForVersion']);
 function rejectRebinding(node){
  if(!node||typeof node!=='object')return;
  if((node.type==='AssignmentExpression'&&node.left.type==='Identifier'&&guarded.has(node.left.name))||
   (node.type==='UpdateExpression'&&node.argument.type==='Identifier'&&guarded.has(node.argument.name)))
   throw Error('Retained v1 binding cannot be reassigned.');
  for(const child of Object.values(node))if(Array.isArray(child))child.forEach(rejectRebinding);else rejectRebinding(child);
 }
 rejectRebinding(wrapper);
 return createHash('sha256').update(JSON.stringify(semantic([costs[0],factories[0]]))).digest('hex');
}
export function verifySkillLearningPolicy(root){
 const policy=JSON.parse(readFileSync(join(root,'functions/src/skill-learning-policy-v1.json'),'utf8'));
 const source=readFileSync(join(root,'functions/src/skill-progression-core.js'),'utf8');
 if(policy.schemaVersion!==1||policy.ruleVersion!=='v1'||policy.policyVersion!=='player-skill-learning-v1'||
  policy.ruleSemanticSha256!==skillLearningRuleSemanticDigest(source)){
  throw Error('Retained skill learning v1 semantics changed; preserve v1 and add an explicit new version.');
 }
 return policy.ruleSemanticSha256;
}

// Separate versioned loadout policy; never rewrites retained learning v1.
export function skillLoadoutRuleSemanticDigest(source){
 const program=parse(source,{ecmaVersion:2022});
 const wrapper=program.body[0]?.expression;
 if(program.body.length!==1||wrapper?.type!=='CallExpression'||wrapper.callee?.id?.name!=='installSkillProgressionCore')
  throw Error('Skill loadout UMD Owner is unsupported.');
 const top=wrapper.callee.body.body,bindings=['SKILL_UPGRADE_COST_BY_TARGET_LEVEL','createRulesV1','createRules',
  'getRulesForVersion','createLoadoutRulesV1','getLoadoutRulesForVersion'];
 const commonJS=parse('if(typeof module!=="undefined"&&module.exports){module.exports=global.FourSymbolsSkillProgressionCore;}',{ecmaVersion:2022}).body[0];
 if(top.length!==9||top[0].directive!=='use strict'||bindings.some((name,index)=>{
  const node=top[index+1];return node?.type!=='VariableDeclaration'||node.kind!=='const'||node.declarations.length!==1||node.declarations[0].id.name!==name;
 })||top[7].type!=='ExpressionStatement'||JSON.stringify(semantic(top[8]))!==JSON.stringify(semantic(commonJS)))
  throw Error('Retained loadout export lifecycle is unsupported.');
 const names=['createLoadoutRulesV1','getLoadoutRulesForVersion'];
 const declarations=names.map(name=>wrapper.callee.body.body.filter(node=>node.type==='VariableDeclaration'&&node.kind==='const'&&
  node.declarations.length===1&&node.declarations[0].id.name===name));
 if(declarations.some(rows=>rows.length!==1||rows[0].declarations[0].init?.type!=='FunctionExpression'))
  throw Error('Retained loadout v1 bindings are missing or ambiguous.');
 const selector=declarations[1][0].declarations[0].init;
 const expected=parse('(function(version,catalog){if(version==="v1")return createLoadoutRulesV1(catalog);throw new RangeError("Unsupported skill loadout rules version");})',{ecmaVersion:2022}).body[0].expression;
 if(JSON.stringify(semantic(selector))!==JSON.stringify(semantic(expected)))throw Error('Retained loadout selector must directly forward its original arguments.');
 const exports=[];
 function findExports(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&!node.left.computed&&
   node.left.object?.name==='global'&&node.left.property?.name==='FourSymbolsSkillProgressionCore')exports.push(node);
  for(const child of Object.values(node))if(Array.isArray(child))child.forEach(findExports);else findExports(child);
 }
 findExports(wrapper);
 const output=exports[0]?.right;
 if(exports.length!==1||exports[0]!==top[7].expression||exports[0].operator!=='='||output?.type!=='CallExpression'||output.optional||
  output.callee?.type!=='MemberExpression'||output.callee.computed||output.callee.optional||
  output.callee.object?.name!=='Object'||output.callee.property?.name!=='freeze'||output.arguments.length!==1||
  output.arguments[0]?.type!=='ObjectExpression')throw Error('Retained loadout export must be one frozen object.');
 const properties=output.arguments[0].properties;
 if(properties.some(prop=>prop.type!=='Property'||prop.computed||prop.method||prop.kind!=='init')||
  new Set(properties.map(prop=>prop.key.name)).size!==properties.length)throw Error('Retained loadout export fields are unsupported.');
 const exported=properties.filter(prop=>prop.key.name==='getLoadoutRulesForVersion');
 if(exported.length!==1||exported[0].value.type!=='Identifier'||exported[0].value.name!=='getLoadoutRulesForVersion')
  throw Error('Retained loadout export must directly bind its original selector.');
 function rejectRebinding(node){
  if(!node||typeof node!=='object')return;
  if((node.type==='AssignmentExpression'&&node.left.type==='Identifier'&&names.includes(node.left.name))||
   (node.type==='UpdateExpression'&&node.argument.type==='Identifier'&&names.includes(node.argument.name)))
   throw Error('Retained loadout binding cannot be reassigned.');
  for(const child of Object.values(node))if(Array.isArray(child))child.forEach(rejectRebinding);else rejectRebinding(child);
 }
 rejectRebinding(wrapper);
 return createHash('sha256').update(JSON.stringify(semantic(declarations.flat()))).digest('hex');
}
// Fixed current Runtime branch: the unified panel owns selection, while the
// legacy secondary card/select are absent. Never accept a request DOM flag.
export function skillLoadoutRuntimeSemanticDigest(root){
 const main=readFileSync(join(root,'js/00-main.js'),'utf8'),legacy=readFileSync(join(root,'js/31-v136-auto-battle-fix.js'),'utf8');
 const html=readFileSync(join(root,'index.html'),'utf8');
 const ids=[...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match=>match[1]);
 if(['player2AutoSettingsCard','autoSkillPlayer2'].some(id=>ids.includes(id))||
  ['autoSettingsCharacterSelect','autoSettingsActionSelect'].some(id=>ids.filter(value=>value===id).length!==1))
  throw Error('Retained loadout formal DOM branch changed.');
 const ast=parse(main,{ecmaVersion:2022}),wrapper=parse(legacy,{ecmaVersion:2022}).body[0]?.expression?.callee?.body?.body;
 const legacyReads={player2AutoSettingsCard:0,player2AutoSettingsTitle:0,autoSkillPlayer2:0};
 function checkLegacyReads(node,parent){
  if(!node||typeof node!=='object')return;
  if(node.type==='Literal'&&Object.hasOwn(legacyReads,node.value)){
   if(parent?.type!=='CallExpression'||parent.callee?.type!=='Identifier'||parent.callee.name!=='$'||
    parent.arguments.length!==1||parent.arguments[0]!==node)throw Error('Retained loadout secondary DOM source changed.');
   legacyReads[node.value]++;
  }
  for(const row of Object.values(node))if(Array.isArray(row))row.forEach(value=>checkLegacyReads(value,node));else checkLegacyReads(row,node);
 }
 checkLegacyReads(ast);
 if(legacyReads.player2AutoSettingsCard!==1||legacyReads.player2AutoSettingsTitle!==1||legacyReads.autoSkillPlayer2!==2)
  throw Error('Retained loadout secondary DOM reads changed.');
 const functions=['populateAutoSkillOptions','populateAutoSkillOptions2','saveAutoSettingsFormToCharacter'];
 const selected=functions.map(name=>{
  const rows=ast.body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name===name);
  if(rows.length!==1)throw Error('Retained loadout Runtime Owner is ambiguous.');return rows[0];
 });
 if(!wrapper)throw Error('Retained loadout preference wrapper is missing.');
 const build=parse(readFileSync(join(root,'scripts/build-production.mjs'),'utf8'),{ecmaVersion:'latest',sourceType:'module'});
 const files=['appScripts','gameplayScripts'].flatMap(name=>{
  const node=build.body.flatMap(row=>row.type==='VariableDeclaration'?row.declarations:[]).find(row=>row.id.name===name)?.init;
  if(node?.type!=='ArrayExpression'||node.elements.some(row=>row.type!=='Literal'||typeof row.value!=='string'))throw Error('Retained loadout formal order is unsupported.');
  return node.elements.map(row=>row.value);
 });
 const core=files.indexOf('functions/src/skill-progression-core.js'),v136=files.indexOf('js/31-v136-auto-battle-fix.js');
 if(core<0||files.filter(file=>file==='functions/src/skill-progression-core.js').length!==1||
  files.indexOf('js/00-main.js')<=core||v136<=files.indexOf('js/00-main.js'))throw Error('Retained loadout formal order changed.');
 for(const file of files){
  if(!file.endsWith('.js')||file.includes('..'))throw Error('Retained loadout source is unsupported.');
  const source=readFileSync(join(root,file),'utf8');
  if(file!=='js/00-main.js'&&/player2AutoSettingsCard|autoSkillPlayer2/.test(source))throw Error('Retained loadout secondary DOM producer changed.');
 }
 return createHash('sha256').update(JSON.stringify(semantic({selected,wrapper,files,
  unifiedIds:['autoSettingsCharacterSelect','autoSettingsActionSelect'],legacySecondaryDom:'absent'}))).digest('hex');
}
export function verifySkillLoadoutPolicy(root){
 const policy=JSON.parse(readFileSync(join(root,'functions/src/skill-loadout-policy-v1.json'),'utf8'));
 const source=readFileSync(join(root,'functions/src/skill-progression-core.js'),'utf8');
 const learning=readFileSync(join(root,'functions/src/skill-learning-policy-v1.json'));
 if(Object.keys(policy).sort().join(',')!=='learningPolicySha256,policyVersion,ruleSemanticSha256,ruleVersion,runtimeSemanticSha256,schemaVersion'||
  policy.schemaVersion!==1||policy.ruleVersion!=='v1'||policy.policyVersion!=='player-skill-loadout-v1'||
  policy.learningPolicySha256!==createHash('sha256').update(learning).digest('hex')||
  policy.ruleSemanticSha256!==skillLoadoutRuleSemanticDigest(source)||
  policy.runtimeSemanticSha256!==skillLoadoutRuntimeSemanticDigest(root))
  throw Error('Retained skill loadout v1 changed; preserve v1 and add an explicit new version.');
 verifySkillLearningPolicy(root);
 return policy.ruleSemanticSha256;
}
