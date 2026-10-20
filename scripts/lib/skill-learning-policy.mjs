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
