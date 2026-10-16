import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('.github/scripts/battle-layer-audio-live-qa.mjs','utf8').replace(/\r\n/g,'\n');
const declarations=['captureIdentitySnapshot','captureFocusSnapshot'].map(name=>{
    const match=source.match(new RegExp('^    function '+name+'\\([\\s\\S]*?^    }$','m'));
    assert.ok(match,'Execute the actual browser snapshot implementation: '+name);
    return match[0];
}).join('\n');
const rect=(left=10)=>({left,top:10,width:20,height:20});
function fixture({id='relic_test',canonical=rect(),actual=rect(),missing=false}={}){
    const overlay={left:0,top:0,width:100,height:100},selectors=[],escapeCalls=[];
    const cssEscape=value=>String(value).replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c.codePointAt(0).toString(16)+' ');
    const sprite={dataset:{skill:id,geometryOwner:'fixed-slot',targetSide:'player',targetIndexes:'4'}};
    const stage={dataset:{sequence:'7',geometryOwner:'fixed-slot'},querySelector(selector){
        selectors.push(selector);return selector===`.v143-vfx-sprite[data-skill="${cssEscape(id)}"]`?sprite:null;
    },querySelectorAll:()=>[sprite]};
    const body={classList:{contains:()=>true}};
    const node={parentElement:body,classList:{contains:()=>true},getBoundingClientRect:()=>overlay,
        querySelector(selector){return selector.includes(' img')?{complete:true,naturalWidth:64,getAttribute:()=>'/relic.webp'}:{textContent:'Test relic'};},
        querySelectorAll(selector){return selector.includes('outline')?[]:[{getBoundingClientRect:()=>actual}];}};
    const browser={window:{FourSymbolsBattlefieldRenderGeometry:{getBattlefieldOverlayGeometry:()=>({rect:overlay}),
        getUnitGeometry:()=>({slot:'ALLY_F2',artworkProjection:missing?null:{rect:canonical},hpProjection:{rect:canonical}})},
        v143SkillAnimationState:{current:{config:{id},sequence:7,targetSide:'player',targetIndexes:[4],done:false}},
        FourSymbolsBattleFlow:{isPresentationActive:()=>true},FourSymbolsBattleStatistics:{setBossMechanisms:()=>{},openBossMechanisms:()=>true}},
        document:{body,getElementById:name=>name==='teamRelicBattlePresentation'?node:name==='v143-skill-stage'?stage:{dataset:{slot:'ALLY_F2'}}},
        getComputedStyle:()=>({visibility:'hidden',opacity:'0'}),CSS:{escape:value=>{escapeCalls.push(value);return cssEscape(value);}},
        MutationObserver:class{constructor(callback){this.callback=callback;}observe(){this.callback();}disconnect(){}},Date};
    const context=vm.createContext(browser);vm.runInContext(declarations,context);
    return {context,selectors,escapeCalls,id,capture:()=>context.captureFocusSnapshot(id)};
}
test('actual observer evaluates and returns both identity and focus snapshots',()=>{
    const f=fixture();let expression;
    const line=source.split('\n').find(line=>line.includes('window.__relicQaProbe={calls:0}'));
    assert.ok(line);
    const host=vm.createContext({id:JSON.stringify(f.id),identityExpression:`(${f.context.captureIdentitySnapshot.toString()})()`,
        focusExpression:`(${f.context.captureFocusSnapshot.toString()})(${JSON.stringify(f.id)})`,client:{eval:value=>{expression=value;}}});
    vm.runInContext(line.replace('await client.eval','client.eval'),host);
    vm.runInContext(expression,f.context);
    assert.equal(f.context.window.__relicQaIdentitySnapshot.name,'Test relic');
    assert.equal(f.context.window.__relicQaIdentitySnapshot.icon,'/relic.webp');
    assert.equal(f.context.window.__relicQaFocusSnapshot.artGeometryMatches,true);
    assert.match(source,/return \{relicId,targetKind,identity,focus,cleanup\};/);
});
test('untrusted relic identifiers reach CSS.escape and cannot add a selector',()=>{
    const f=fixture({id:'x"] .unexpected, [data-skill="'});const result=f.capture();
    assert.equal(f.escapeCalls.length,1);assert.equal(f.escapeCalls[0],f.id);
    assert.equal(f.selectors.length,1);assert.equal(result.skillId,f.id);
    assert.equal(result.artGeometryMatches,true);
});
test('clipped-outside targets retain their index, source and explicit failure',()=>{
    const result=fixture({canonical:rect(150)}).capture();
    assert.equal(result.targetDiagnostics.length,1);
    assert.equal(result.targetDiagnostics[0].index,4);
    assert.equal(result.artGeometryDiagnostics.expectedCount,1);
    assert.equal(result.artGeometryMatches,false);
    assert.equal(result.artGeometryDiagnostics.failures[0].reason,'clipped-outside-overlay');
    assert.equal(result.artGeometryDiagnostics.failures[0].targetIndex,4);
    assert.equal(result.artGeometryDiagnostics.failures[0].source.left,150);
});
test('partial clipping compares the clipped rectangle using the original tolerance',()=>{
    const result=fixture({canonical:rect(-5),actual:{left:0,top:10,width:15,height:20}}).capture();
    assert.equal(result.artGeometryMatches,true);
    assert.equal(result.targetDiagnostics[0].artwork.source.left,-5);
    assert.equal(result.targetDiagnostics[0].artworkProjection.width,15);
});
test('missing canonical projections fail explicitly without dropping targets',()=>{
    const result=fixture({missing:true}).capture();
    assert.equal(result.artGeometryDiagnostics.expectedCount,1);
    assert.equal(result.artGeometryDiagnostics.failures[0].reason,'missing-canonical-projection');
    assert.equal(result.artGeometryDiagnostics.failures[0].targetIndex,4);
});
test('geometry mismatch includes target index, expected rect, actual rect and deltas',()=>{
    const result=fixture({actual:rect(14)}).capture();const failure=result.artGeometryDiagnostics.failures[0];
    assert.equal(result.artGeometryMatches,false);assert.equal(failure.targetIndex,4);
    assert.equal(failure.expected.left,10);assert.equal(failure.nearestActual.rect.left,14);
    assert.equal(failure.nearestActual.actualIndex,0);assert.equal(failure.nearestActual.delta.left,4);
    assert.equal(result.artGeometryDiagnostics.tolerance,1.5);
});
