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
 const factories=body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name==='createRulesV1');
 const costs=body.filter(node=>node.type==='VariableDeclaration'&&node.declarations.length===1&&
  node.declarations[0].id.name==='SKILL_UPGRADE_COST_BY_TARGET_LEVEL');
 const selectors=body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name==='getRulesForVersion');
 if(factories.length!==1||costs.length!==1||selectors.length!==1)throw Error('Retained v1 skill rules are missing or ambiguous.');
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
