import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';

// Execute the actual successful-race assertion, not a mirrored comparator.
const source=readFileSync(new URL('../scripts/test-session-authority-emulator.mjs',import.meta.url),'utf8');
const program=parse(source,{ecmaVersion:2022,sourceType:'module'}),branches=[];
function walk(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='IfStatement'&&node.test.type==='BinaryExpression'&&
  node.test.operator==='==='&&node.test.left.type==='MemberExpression'&&
  node.test.left.object.name==='writerResult'&&node.test.left.property.name==='status'&&
  node.test.right.value==='fulfilled')branches.push(node);
 for(const child of Object.values(node))if(Array.isArray(child))child.forEach(walk);else walk(child);
}
walk(program);assert.equal(branches.length,1);
const helpers=program.body.filter(node=>node.type==='FunctionDeclaration'&&node.id.name==='assertRecoveryFenceCommitOrder');
assert(helpers.length<=1);
const actual=vm.runInNewContext('(function(committedProbe,committedFence){'+
 helpers.map(node=>source.slice(node.start,node.end)).join('\n')+'\n'+
 source.slice(branches[0].consequent.start,branches[0].consequent.end)+'})',{assert});
const stamp=(seconds,nanoseconds)=>({seconds,nanoseconds,toMillis(){throw Error('Commit comparison must retain nanoseconds');}});
function snapshot(updateTime,fieldTime){return {exists:true,createTime:stamp(10,1),updateTime,
 readTime:stamp(20,2),get:()=>fieldTime};}

test('request-time inversion cannot reject an ordinary write committed before the fence',()=>{
 assert.doesNotThrow(()=>actual(snapshot(stamp(15,123000001),stamp(14,900000000)),
  snapshot(stamp(15,123000002),stamp(14,800000000))));
});
test('a writer committed one nanosecond after the fence is rejected even when request fields suggest the opposite',()=>{
 assert.throws(()=>actual(snapshot(stamp(15,123000002),stamp(14,700000000)),
  snapshot(stamp(15,123000001),stamp(14,800000000))),{code:'ERR_ASSERTION'});
});
test('equal commit metadata and exact cross-second ordering preserve before-or-equal semantics',()=>{
 assert.doesNotThrow(()=>actual(snapshot(stamp(15,999999999),stamp(1,0)),snapshot(stamp(16,0),stamp(1,1))));
 assert.doesNotThrow(()=>actual(snapshot(stamp(15,123),stamp(1,0)),snapshot(stamp(15,123),stamp(1,1))));
});
test('missing or malformed commit metadata cannot fall back to request/create/read time',()=>{
 for(const invalid of [undefined,null,{},stamp(15,-1),stamp(15,1000000000),stamp(15,0.1),stamp('15',1),
  stamp(-62135596801,0),stamp(253402300800,0)]){
  for(const side of ['probe','fence']){
   const probe=snapshot(side==='probe'?invalid:stamp(15,1),stamp(1,0));
   const fence=snapshot(side==='fence'?invalid:stamp(15,2),stamp(1,1));
   assert.throws(()=>actual(probe,fence),{code:'ERR_ASSERTION'});
  }
 }
});

test('failed ordering includes both document metadata clocks and request-field diagnostics without changing their authority',()=>{
 assert.throws(()=>actual(snapshot(stamp(15,2),stamp(14,1)),snapshot(stamp(15,1),stamp(14,2))),error=>{
  for(const key of ['probe','fence','createTime','updateTime','readTime','committedAt','createdAt'])assert.match(error.message,new RegExp('"'+key+'"'));
  assert.match(error.message,/"nanoseconds":2/);return error.code==='ERR_ASSERTION';
 });
});
