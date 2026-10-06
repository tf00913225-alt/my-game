import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyChanges, BROWSER_GATES, CHANGE_FLAGS} from '../.github/scripts/ci-change-classifier.mjs';
const classify = (paths, options = {}) => classifyChanges(paths, {enabled: true, ...options});
const all = plan => BROWSER_GATES.forEach(k => assert.equal(plan.gates[k], true, k));
for (const [name, paths] of [
  ['Battle', ['js/00-main.js']], ['MonsterBalance', ['js/combat/monster-balance-owner.mjs']],
  ['Release', ['release/requirements.json']], ['Workflow', ['.github/workflows/ci.yml']]
]) test(`${name} fixture fans out all required modes`, () => all(classify(paths)));
test('UI fixture runs UI and skips unrelated balance modes', () => {
  const p=classify(['css/23-stage-v77-inventory-detail-ui.css']);
  assert.equal(p.gates.ui_browser,true);
  for(const k of ['boss_balance','abyss_balance','tower_wild_browser']) assert.equal(p.gates[k],false);
});
test('Cloud fixture always requires Session Authority', () => assert.equal(classify(['functions/src/session-authority.js']).gates.session_authority,true));
test('Portrait fixture requires image/battle QA', () => {
  const p=classify(['config/monster-portrait-registry.json']);
  assert.equal(p.gates.portrait_browser,true);assert.equal(p.gates.battle_browser,true);
});
test('Docs fixture retains core and skips expensive browsers', () => {
  const p=classify(['docs/README.md','AGENTS.md','CLAUDE.md']);
  assert.equal(p.gates.core_checks,true);BROWSER_GATES.forEach(k=>assert.equal(p.gates[k],false,k));
});
test('unknown runtime / unowned CSS / framework / build / loader fail closed', () => {
  for(const path of ['js/new-runtime.js','docs/live.js','css/new-style.css','tests/unknown.test.js','scripts/build-production.mjs','config/feature-manifest.json','asset-manifest.json']) {
    const p=classify([path]);assert.equal(p.strictMode,true,path);all(p);
  }
});
test('new JS in an otherwise known owner is strict', () => all(classify(['js/firebase/new-helper.js'],{addedPaths:['js/firebase/new-helper.js']})));
test('invalid or unavailable paths never silently skip', () => {
  for(const paths of [[],null,['../bad'],['unknown.file']]) all(classify(paths));
  all(classify(['docs/readme.md'],{error:'API unavailable'}));
});
test('dev push and main PR ignore narrow PR skipping', () => {
  all(classify(['docs/readme.md'],{eventName:'push'}));
  const p=classify(['docs/readme.md'],{baseRef:'main'});all(p);assert.equal(p.gates.main_browser,true);
});
test('shadow shows proposed skips while preserving every original gate', () => {
  const p=classifyChanges(['docs/readme.md'],{enabled:false});
  assert.equal(p.shadow,true);all(p);assert.equal(p.predicted.boss_balance,false);
  assert.equal(p.gates.main_browser,false);
});
test('all required change flags exist as booleans', () => {
  const p=classify(['docs/readme.md']);
  CHANGE_FLAGS.forEach(k=>assert.equal(typeof p.flags[`${k}_changed`],'boolean',k));
});
