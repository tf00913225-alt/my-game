import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {loadoutParity} from '../.github/scripts/fixtures/skill-loadout-parity.mjs';
import {skillLearningRuleSemanticDigest,skillLoadoutRuleSemanticDigest,verifySkillLoadoutPolicy} from '../scripts/lib/skill-learning-policy.mjs';
const require=createRequire(import.meta.url),core=require('../functions/src/skill-progression-core');
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/skill-loadout-runtime-v1.json',import.meta.url),'utf8'));
const learning=JSON.parse(fs.readFileSync(new URL('../functions/src/skill-learning-policy-v1.json',import.meta.url),'utf8'));
const catalog=Object.fromEntries(learning.skills.map(row=>[row.id,row])),rules=core.getLoadoutRulesForVersion('v1',catalog);
const json=value=>JSON.parse(JSON.stringify(value));
function original(){
    const context={skillDatabase:catalog,character:{element:'fire'},loadout:{},config:{},alerts:[],events:[]};
    context.getSkillContext=()=>({character:context.character,loadout:context.loadout});
    context.skillById=id=>catalog[id]||null;
    context.isCrossElementSkill=core.getRulesForVersion('v1',catalog,[]).isCrossElementSkill;
    context.notify=message=>{context.alerts.push(message);return false;};
    context.populateAutoSkillOptions=()=>context.events.push('options0');context.populateAutoSkillOptions2=()=>context.events.push('options1');
    context.finalizeSkillMutation=()=>context.events.push('finalize');
    context.getPartyCharacterByIndex=()=>context.character;context.getPartyCharacterKey=()=> 'fire';context.getPartyAutoConfig=()=>context.config;
    context.characterSkillLoadouts={fire:context.loadout};context.renderSkillLoadout=()=>{};context.updateUI=()=>{};context.saveGame=()=>{};
    context.window=context;vm.createContext(context);vm.runInContext(Object.values(baseline.sources).join('\n'),context);return context;
}
test('loadout extraction preserves600 full-loaded Client domain/save-boundary/DOM cases from original Head',()=>{
    assert.deepEqual(loadoutParity(),baseline.fullRuntime);
});
test('pure equip, first-cross normalization, splice ordering and no-ops match frozen original runtime functions',()=>{
    const old=original(),ids=Object.keys(catalog);let cases=0;
    for(const element of ['fire','water','wind','earth'])for(const id of ids){
        const native=ids.filter(key=>catalog[key].element===element),cross=ids.filter(key=>catalog[key].element!==element);
        for(const equippedSkills of [[],[id],native.slice(0,4),[cross[0],cross[1],native[0]],['missing-old-id',native[0]],native.slice(0,6)]){
            for(const level of [0,1,'1',NaN,Infinity]){
                const input={skillLevels:{[id]:level},equippedSkills:equippedSkills.slice()};
                old.character={element};old.loadout=structuredClone(input);old.alerts.length=0;old.events.length=0;
                const returned=old.equipSkill(id),next=rules.equipSkill({element},input,id);
                assert.deepEqual(json(next.equippedSkills??input.equippedSkills),json(old.loadout.equippedSkills));
                assert.equal(returned,next.status==='equipped'||next.status==='already-equipped');
                assert.equal(old.events.includes('finalize'),next.status==='equipped');
                assert.deepEqual(input.equippedSkills,equippedSkills);cases++;
            }
            old.character={element};const carried={equippedSkills:equippedSkills.slice()},changed=old.normalizeCrossElementEquip(carried,old.character);
            assert.deepEqual(rules.normalizeCrossElementEquip(equippedSkills,{element}),{equippedSkills:json(carried.equippedSkills),changed});
            for(const index of [0,1,-1,9,undefined,'1']){
                old.characterSkillLoadouts.fire={equippedSkills:equippedSkills.slice()};old.currentSkillCharacter='fire';
                old.removeEquippedSkill(index);assert.deepEqual(rules.removeEquippedSkill(equippedSkills,index),json(old.characterSkillLoadouts.fire.equippedSkills));cases++;
            }
        }
    }
    assert(cases>10000);
});
test('v136 explicit intent, original migration and restoration preserve absent fields and remembered skills exactly',()=>{
    const old=original(),configs=[{}, {skill:'normal'}, {skill:'defend',v136LastSkill:'flameSlash'},
        {skill:'normal',v136ActionIntent:'skill',v136LastSkill:'flameSlash'},
        {skill:'normal',v136ActionIntent:'skill'}, {skill:'flameSlash',v136ActionIntent:'normal'},
        {skill:'normal',v136ActionIntent:'unknown-old-intent',v136LastSkill:'unknown-old-id'}];
    for(const config of configs){
        for(const action of [undefined,null,'','normal','defend','flameSlash','unknown-old-id']){
            old.config=structuredClone(config);old.rememberExplicitAction(0,action);
            assert.deepEqual(rules.rememberExplicitAction(config,action),json(old.config));
        }
        old.config=structuredClone(config);old.migrateCurrentIntent(0);
        assert.deepEqual(rules.migrateCurrentIntent(config),json(old.config));
        for(const id of ['flameSlash','rage','healSpell','revive','unknown-old-id'])for(const level of [0,1,'1',NaN,Infinity]){
            const input={...config,v136LastSkill:id},loadout={skillLevels:{[id]:level},equippedSkills:[id]};
            old.config=structuredClone(input);old.characterSkillLoadouts.fire=loadout;
            const restored=old.restoreSkillAfterLegacySync(0),next=rules.restoreSkillAfterLegacySync(input,loadout);
            assert.equal(next.restored,restored);assert.deepEqual(next.config,json(old.config));assert.deepEqual(input,{...config,v136LastSkill:id});
        }
    }
});
test('separate retained loadout version fails closed while original learning policy/seal bytes remain unchanged',()=>{
    const source=fs.readFileSync(new URL('../functions/src/skill-progression-core.js',import.meta.url),'utf8');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../functions/src/skill-learning-policy-v1.json',import.meta.url))).digest('hex'),baseline.learningPolicySha256);
    assert.equal(skillLearningRuleSemanticDigest(source),learning.ruleSemanticSha256);verifySkillLoadoutPolicy(process.cwd());
    assert(Object.isFrozen(rules));assert.throws(()=>core.getLoadoutRulesForVersion('v2',catalog),/Unsupported/);
    assert.throws(()=>core.getLoadoutRulesForVersion('v1',null),/catalogue/);
    assert.notEqual(skillLoadoutRuleSemanticDigest(source.replace('equipped.length>=4','equipped.length>=3')),skillLoadoutRuleSemanticDigest(source));
    for(const replacement of ['return createLoadoutRulesV1();','return createRulesV1(catalog,[]);'])
        assert.throws(()=>skillLoadoutRuleSemanticDigest(source.replace('return createLoadoutRulesV1(catalog);',replacement)),/selector/);
});
test('loadout decisions preserve frozen inputs and use no clock, randomness, storage or DOM',()=>{
    const source=fs.readFileSync(new URL('../functions/src/skill-progression-core.js',import.meta.url),'utf8');
    const forbidden=()=>{throw Error('unexpected side effect');},math=Object.create(Math);math.random=forbidden;
    const context={Math:math,Date:forbidden,localStorage:new Proxy({},{get:forbidden}),document:new Proxy({},{get:forbidden})};
    vm.createContext(context);vm.runInContext(source,context);
    const pure=context.FourSymbolsSkillProgressionCore.getLoadoutRulesForVersion('v1',catalog);
    const actor=Object.freeze({element:'fire'}),carried=Object.freeze(['flameSlash']),levels=Object.freeze({flameSlash:1}),
        loadout=Object.freeze({skillLevels:levels,equippedSkills:carried}),config=Object.freeze({skill:'normal',v136ActionIntent:'skill',v136LastSkill:'flameSlash'});
    assert.equal(pure.equipSkill(actor,loadout,'flameSlash').status,'already-equipped');
    assert.deepEqual(json(pure.removeEquippedSkill(carried,0)),[]);
    assert.equal(pure.normalizeCrossElementEquip(carried,actor).changed,false);
    assert.equal(pure.restoreSkillAfterLegacySync(config,loadout).restored,true);
    assert.equal(pure.rememberExplicitAction(config,'defend').v136LastSkill,'flameSlash');
    assert.equal(pure.migrateCurrentIntent(config).skill,'normal');
    assert.deepEqual(carried,['flameSlash']);assert.equal(config.skill,'normal');
});
