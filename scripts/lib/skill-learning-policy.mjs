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
 const names=['createLoadoutRulesV1','getLoadoutRulesForVersion'];
 const declarations=names.map(name=>wrapper.callee.body.body.filter(node=>node.type==='VariableDeclaration'&&node.kind==='const'&&
  node.declarations.length===1&&node.declarations[0].id.name===name));
 if(declarations.some(rows=>rows.length!==1||rows[0].declarations[0].init?.type!=='FunctionExpression'))
  throw Error('Retained loadout v1 bindings are missing or ambiguous.');
 const selector=declarations[1][0].declarations[0].init;
 const expected=parse('(function(version,catalog){if(version==="v1")return createLoadoutRulesV1(catalog);throw new RangeError("Unsupported skill loadout rules version");})',{ecmaVersion:2022}).body[0].expression;
 if(JSON.stringify(semantic(selector))!==JSON.stringify(semantic(expected)))throw Error('Retained loadout selector must directly forward its original arguments.');
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
export function verifySkillLoadoutPolicy(root){
 const policy=JSON.parse(readFileSync(join(root,'functions/src/skill-loadout-policy-v1.json'),'utf8'));
 const source=readFileSync(join(root,'functions/src/skill-progression-core.js'),'utf8');
 const learning=readFileSync(join(root,'functions/src/skill-learning-policy-v1.json'));
 if(Object.keys(policy).sort().join(',')!=='learningPolicySha256,policyVersion,ruleSemanticSha256,ruleVersion,schemaVersion'||
  policy.schemaVersion!==1||policy.ruleVersion!=='v1'||policy.policyVersion!=='player-skill-loadout-v1'||
  policy.learningPolicySha256!==createHash('sha256').update(learning).digest('hex')||
  policy.ruleSemanticSha256!==skillLoadoutRuleSemanticDigest(source))
  throw Error('Retained skill loadout v1 changed; preserve v1 and add an explicit new version.');
 verifySkillLearningPolicy(root);
 return policy.ruleSemanticSha256;
}
