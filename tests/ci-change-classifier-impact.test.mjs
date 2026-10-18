import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDocument} from 'yaml';
import {classifyChanges, classifySharedCss, classifySharedHtml, BROWSER_GATES} from '../.github/scripts/ci-change-classifier.mjs';
import {requireChildGates, CHILD_GATES} from '../.github/scripts/ci-aggregate.mjs';

const cssPath='css/49-v169-rpg-ui.css';
const oldCss='#game-ui #homeFeatureModal[data-character-tab="skill"] .home-feature-modal-title{background:#123;}';
const newCss='#game-ui #homeFeatureModal[data-character-tab="skill"] #homeFeatureModalTitle{height:114px;background:#456;}';
const plan=(paths,options={})=>classifyChanges(paths,{enabled:true,...options});
const onlyUi=p=>{
  assert.equal(p.strictMode,false);assert.equal(p.gates.ui_browser,true);assert.equal(p.gates.core_checks,true);
  for(const gate of BROWSER_GATES.filter(k=>k!=='ui_browser'))assert.equal(p.gates[gate],false,gate);
  assert.equal(p.gates.session_authority,false);assert.equal(p.bossMode,'none');
};

test('shared HTML isolates presentation labels and SVG paint, preserving event/data authority',()=>{
  const before='<!doctype html><html><head></head><body><div id="startupLoader">登入</div><div id="homeFeatureModal"><span id="homeFeatureModalTitle">技能</span><button onclick="closeHomeFeature()" class="old">返回</button><svg><path d="M0 0L1 1"/></svg><span id="gold">50</span><input value="1"><script>window.guard=1;</script></div></body></html>';
  const after=before.replace('>技能<','>角色<').replace('class="old"','class="bronze"').replace('M0 0L1 1','M0 0L2 2');
  const responsibilitiesByPath={'index.html':classifySharedHtml(before,after)};
  assert.deepEqual(responsibilitiesByPath['index.html'],['ui','ui_shared']);onlyUi(plan(['index.html'],{responsibilitiesByPath}));
  for(const changed of [
    before.replace('>登入<','>跳過登入<'),before.replace('closeHomeFeature()','claimReward()'),
    before.replace('id="gold"','id="other"'),before.replace('>50<','>9999<'),
    before.replace('value="1"','value="100"'),before.replace('window.guard=1','window.guard=0'),
    before.replace('<svg>','<svg onload="claimReward()">'),before.replace('<span id="gold">','<span id="gold" data-action="claim">'),
    before.replace('</head>','<style>body{display:none}</style></head>')
  ])assert.equal(classifySharedHtml(before,changed),null,changed);
  const real=fs.readFileSync('index.html','utf8');
  const label=real.replace(/(<span id="homeFeatureModalTitle">\s*)標題/,'$1技能');
  assert.notEqual(real,label);assert.deepEqual(classifySharedHtml(real,label),['ui','ui_shared']);
});

test('shared HTML ignores generated headers only with independently verified build evidence',()=>{
  const before='<!doctype html><html><head><!-- build:critical-style --><link href="old.css"><!-- /build:critical-style --></head><body><div id="homeFeatureModal"><button onclick="closeHomeFeature()">返回</button></div></body></html>';
  const after=before.replace('old.css','new.css').replace('>返回<','>關閉<');
  assert.equal(classifySharedHtml(before,after),null);
  assert.deepEqual(classifySharedHtml(before,after,{generatedVerified:true}),['ui','ui_shared']);
  assert.equal(classifySharedHtml(before,after.replace('</head>','<script>skipAuth()</script></head>'),{generatedVerified:true}),null);
  const generatedOnly=before.replace('old.css','new.css');
  assert.equal(classifySharedHtml(before,generatedOnly),null);
  assert.deepEqual(classifySharedHtml(before,generatedOnly,{generatedVerified:true}),[]);
  const css='css/00-main.css';
  onlyUi(plan([css,'index.html','build/asset-manifest.json'],{generatedVerified:true,
    responsibilitiesByPath:{[css]:['ui','skill_ui'],'index.html':[]}}));
  assert.equal(plan(['index.html','build/asset-manifest.json'],{generatedVerified:true,responsibilitiesByPath:{'index.html':[]}}).strictMode,true,'generated-only changes require a real source');
});

test('shared CSS uses changed selectors, never its mixed file name',()=>{
  assert.deepEqual(classifySharedCss(oldCss,newCss),['ui','skill_ui']);
  const responsibilitiesByPath={[cssPath]:classifySharedCss(oldCss,newCss)};
  for(const eventName of ['pull_request','push']) {
    const p=plan([cssPath,'.github/scripts/run-skill-progression-browser-qa.mjs',
      'assets/ui/skill-iron-bronze/title-short.example.webp','build/gameplay-core.example.css','asset-manifest.json'],
      {eventName,responsibilitiesByPath,generatedVerified:true});
    onlyUi(p);assert.equal(p.uiMode,'skill');assert.equal(p.flags.skill_changed,false);
  }
});

test('known UI test/QA edits do not masquerade as CI policy or skill formula changes',()=>{
  for(const eventName of ['pull_request','push']) {
    const p=plan(['tests/v169-rpg-ui.test.js','.github/scripts/run-skill-progression-browser-qa.mjs'],{eventName});
    onlyUi(p);assert.equal(p.flags.workflow_changed,false);assert.equal(p.uiMode,'all');
    const inventory=plan(['css/23-stage-v77-inventory-detail-ui.css','.github/scripts/run-forge-sockets-browser-qa.mjs'],{eventName});
    onlyUi(inventory);assert.equal(inventory.uiMode,'inventory');
    onlyUi(plan(['.github/scripts/run-skill-progression-browser-qa.mjs'],{eventName}));
  }
});

test('mixed UI and battle selectors retain battle and Boss Fast validation',()=>{
  const before=oldCss+'#battlePage .battle-title{color:red;}';
  const after=newCss+'#battlePage .battle-title{color:gold;}';
  const p=plan([cssPath],{responsibilitiesByPath:{[cssPath]:classifySharedCss(before,after)}});
  assert.equal(p.strictMode,false);assert.equal(p.gates.ui_browser,true);
  assert.equal(p.gates.battle_browser,true);assert.equal(p.bossMode,'fast');
  assert.equal(p.gates.abyss_balance,false);
});

test('real misleading skill-named stylesheet separates shop and revived-enemy effects',()=>{
  const file='css/44-v149-skill-ui-rules.css';
  const before=fs.readFileSync(file,'utf8');
  const shop=before.replace('padding:36px !important','padding:39px !important');
  const combat=before.replace('opacity:1 !important','opacity:.8 !important');
  assert.notEqual(shop,before);assert.notEqual(combat,before);
  onlyUi(plan([file],{responsibilitiesByPath:{[file]:classifySharedCss(before,shop)}}));
  const p=plan([file],{responsibilitiesByPath:{[file]:classifySharedCss(before,combat)}});
  assert.equal(p.gates.battle_browser,true);assert.equal(p.bossMode,'fast');
  // A file name alone is never evidence that combat selectors were untouched.
  assert.equal(plan([file]).strictMode,true);
});

test('global, opaque, reordered, escaped-scope and invalid shared CSS fail closed',()=>{
  const cases=[
    [oldCss,oldCss+':root{--ui-length-unit:2px;}'],
    [oldCss,oldCss+'@import "battle.css";'],
    [oldCss,oldCss+'@font-face{font-family:ui;src:url(x);}'],
    [oldCss,'body #homeFeatureModal + #battlePage{color:red;}'],
    [oldCss,':not(#homeFeatureModal){color:red;}'],
    [oldCss,':has(#homeFeatureModal){color:red;}'],
    [oldCss,'#homeFeatureModal,body{color:red;}'],
    [oldCss,'#homeFeatureModal{color:red;'],
    [oldCss,'#homeFeatureModal{.unknown{color:red;}}'],
    ['#homeFeatureModal{color:red;}#inventoryPage{color:blue;}',
      '#inventoryPage{color:blue;}#homeFeatureModal{color:red;}']
  ];
  for(const [a,b] of cases) {
    assert.equal(classifySharedCss(a,b),null,b);
    const p=plan([cssPath],{responsibilitiesByPath:{[cssPath]:classifySharedCss(a,b)}});
    assert.equal(p.strictMode,true);BROWSER_GATES.forEach(k=>assert.equal(p.gates[k],true,k));
    assert.equal(p.gates.session_authority,true);
  }
  const added=plan([cssPath],{addedPaths:[cssPath],responsibilitiesByPath:{[cssPath]:['ui','skill_ui']}});
  assert.equal(added.strictMode,true);
});

test('media-scoped known UI rules and duplicate declarations retain actual effects',()=>{
  const a='@media (prefers-reduced-motion:reduce){#homeFeatureModal{color:red;color:blue;}}';
  assert.deepEqual(classifySharedCss(a,a.replace('blue','gold')),['ui','ui_shared']);
  assert.deepEqual(classifySharedCss(oldCss,oldCss+'/* comment only */'),['ui','ui_shared']);
});

test('safety, mixed, unknown, parser-support and generated-only inputs retain conservative gates',()=>{
  for(const eventName of ['pull_request','push']) {
    for(const source of ['functions/src/session-authority.js','js/firebase/firebase-cloud-save.js','config/persisted-state-registry.json']) {
      const p=plan(['.github/scripts/run-skill-progression-browser-qa.mjs',source],{eventName});
      assert.equal(p.gates.session_authority,true);assert.equal(p.bossMode,'full');assert.equal(p.uiMode,'all');
      if(eventName==='push')BROWSER_GATES.forEach(k=>assert.equal(p.gates[k],true));
    }
    for(const source of ['js/unknown.js','.github/scripts/runtime-browser-qa-support.mjs','scripts/build-production.mjs','release/release.json']) {
      const p=plan(['.github/scripts/run-skill-progression-browser-qa.mjs',source],{eventName});
      assert.equal(p.strictMode,true);BROWSER_GATES.forEach(k=>assert.equal(p.gates[k],true));
    }
    for(const options of [{generatedVerified:false},{generatedVerified:true}]) {
      assert.equal(plan(['asset-manifest.json'],{eventName,...options}).strictMode,true);
    }
    assert.equal(plan(['.github/scripts/run-skill-progression-browser-qa.mjs','build/unknown.js'],{eventName,generatedVerified:false}).strictMode,true);
  }
});

test('CI policy retains Boss Full and required failure propagation; releases remain Full',()=>{
  for(const source of ['.github/workflows/ci.yml','.github/workflows/deploy-dev-cloudflare.yml','.github/scripts/ci-change-classifier.mjs','package.json']) {
    const p=plan([source]);assert.equal(p.flags.workflow_changed,true);
    assert.equal(p.gates.boss_balance,true);assert.equal(p.bossMode,'full');assert.equal(p.uiMode,'all');
    const needs=Object.fromEntries(CHILD_GATES.map(k=>[k,{result:p.gates[k]===false?'skipped':'success'}]));
    assert.equal(requireChildGates(needs,{mainRequired:false,plan:p}),true);
    for(const result of ['failure','cancelled','skipped',undefined]) {
      needs.boss_balance.result=result;
      assert.throws(()=>requireChildGates(needs,{mainRequired:false,plan:p}),/boss_balance/);
    }
  }
  for(const options of [{baseRef:'main'},{eventName:'workflow_dispatch'},{eventName:'schedule',fullRegression:true}]) {
    const p=plan(['.github/scripts/run-skill-progression-browser-qa.mjs'],options);
    BROWSER_GATES.forEach(k=>assert.equal(p.gates[k],true));assert.equal(p.uiMode,'all');
  }
});

test('UI mode flows unchanged to exact-SHA deployment with safe manual defaults',()=>{
  const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
  const deploy=fs.readFileSync('.github/workflows/deploy-dev-cloudflare.yml','utf8');
  assert.match(ci,/ui_mode: \$\{\{ steps.classify.outputs.ui_mode \}\}/);
  assert.match(ci,/ui_mode: \$\{\{ needs.classify.outputs.ui_mode \}\}/);
  assert.match(deploy,/ui_mode:\n        type: string\n        default: all/);
  assert.match(deploy,/UI_QA_MODE: \$\{\{ github.event_name == 'workflow_dispatch' && 'all' \|\| inputs.ui_mode \}\}/);
  assert.match(deploy,/case "\$UI_QA_MODE" in all\|inventory\|skill\|smoke\)/);
  assert.match(deploy,/Verify affected deployed skill page[\s\S]*?run-skill-progression-browser-qa.mjs/);
  assert.match(fs.readFileSync('.github/scripts/run-skill-progression-browser-qa.mjs','utf8'),/startServer\(\{baseUrl:process.env.DEV_BASE_URL\}\)/);
  // Empty means full responsive coverage: the existing runner checks truthiness.
  assert.match(ci,/RESPONSIVE_GENERAL_UI_ONLY:[^\n]+&& '1' \|\| ''/);
  assert.match(deploy,/RESPONSIVE_GENERAL_UI_ONLY:[^\n]+&& '1' \|\| ''/);
});

test('actual workflow conditions select UI work without battle/formula/reward groups',()=>{
  const source=fs.readFileSync('.github/workflows/ci.yml','utf8');
  const core=source.split('\n  core_checks:')[1].split('\n  battle_browser:')[0];
  const ui=source.split('\n  ui_browser:')[1].split('\n  daily_browser:')[0];
  const steps=text=>text.split(/\n      - name: /).slice(1);
  const outputs=p=>Object.fromEntries([...Object.entries(p.flags),...Object.entries(p.gates),['ui_mode',p.uiMode],['full_node','false']].map(([k,v])=>[k,String(v)]));
  const selected=(text,o)=>steps(text).filter(step=>step.startsWith('Run ')).filter(step=>{
    const condition=step.match(/\n        if: ([^\n]+)/)?.[1];
    return !condition||new Function('o','success',`return ${condition.replaceAll('needs.classify.outputs.','o.')}`)(o,()=>true);
  }).map(step=>step.split('\n')[0]);
  const p=plan(['.github/scripts/run-skill-progression-browser-qa.mjs']);
  const o=outputs(p),coreSteps=selected(core,o),uiSteps=selected(ui,o);
  for(const name of ['Run Fixed Slot battlefield rendering regression','Run battle layout, timing and range-VFX regressions',
    'Run skill and relic owner convergence regressions','Run relic lifecycle and battle input regressions',
    'Run affected monster balance contracts','Run affected inventory and reforge regressions','Run all Node unit and integration suites']) {
    assert.ok(!coreSteps.includes(name),'unrelated core group ran: '+name);
  }
  assert.ok(coreSteps.includes('Run Cloud Save Phase 3 UID isolation regressions'),'baseline UID safety remains');
  assert.ok(coreSteps.includes('Run affected presentation contracts'));
  assert.ok(uiSteps.includes('Run skill progression mobile browser QA'));
  for(const name of ['Run affected inventory and hero presentation','Run affected foreground item interaction',
    'Run Backpack visual composition browser QA','Run Release Update Notification mobile browser QA'])assert.ok(!uiSteps.includes(name),name);
  const full=selected(core,{...o,full_node:'true'});
  assert.ok(full.includes('Run all Node unit and integration suites'));
  for(const name of coreSteps.filter(n=>n.startsWith('Run ')))assert.ok(!full.includes(name),'Full duplicates targeted work: '+name);
  const inventory=selected(ui,outputs(plan(['css/23-stage-v77-inventory-detail-ui.css'])));
  assert.ok(inventory.includes('Run affected inventory and hero presentation'));
  assert.ok(!inventory.includes('Run skill progression mobile browser QA'));
});

test('workflow YAML, mode outputs and baseline safety barriers remain valid',()=>{
  const load=file=>{const doc=parseDocument(fs.readFileSync(file,'utf8'),{uniqueKeys:true});assert.deepEqual(doc.errors,[]);return doc.toJS();};
  const ci=load('.github/workflows/ci.yml'),deploy=load('.github/workflows/deploy-dev-cloudflare.yml');
  for(const flag of ['skill_ui_changed','ui_shared_changed','ui_mode'])assert.ok(ci.jobs.classify.outputs[flag],flag);
  assert.equal(deploy.on.workflow_call.inputs.ui_mode.default,'all');
  const steps=ci.jobs.core_checks.steps;
  for(const name of ['Verify CI aggregate failure propagation','Enforce permanent image asset pipeline gate',
    'Reject unregistered persistent state','Enforce Battle Runtime architecture guard',
    'Verify production build is synchronized','Check static local resources','Check duplicate HTML IDs',
    'Check release entries and loader integrity','Enforce release, cache, checklist and deprecated-code gates',
    'Verify immutable deployment artifact','Check Git whitespace and conflict markers']) {
    const step=steps.find(s=>s.name===name);assert.ok(step,name);assert.equal(step.if,undefined,'baseline guard was made conditional: '+name);
  }
  for(const [key,job] of Object.entries(ci.jobs)) {
    for(const step of job.steps||[])if(step.run)assert.equal(step['continue-on-error'],undefined,key+'/'+step.name);
  }
  for(const uiMode of [undefined,'','unknown']) {
    const p=plan(['docs/readme.md']);p.uiMode=uiMode;
    const needs=Object.fromEntries(CHILD_GATES.map(k=>[k,{result:p.gates[k]===false?'skipped':'success'}]));
    assert.throws(()=>requireChildGates(needs,{mainRequired:false,plan:p}),/Invalid classifier policy/);
  }
});
