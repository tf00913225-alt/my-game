import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parse} from 'acorn';

// Compare complete top-level declarations, never diff hunk line numbers. Any
// change outside explicitly owned existing functions is unknown shared runtime.
const SHARED_FUNCTIONS = {
  renderShopContent: ['ui','inventory'],
  openInventoryCharacterDetail: ['ui','inventory'],
  renderBattle: ['battle'],
  updateMonsterBars: ['battle'],
  openBattleStatusDetailModal: ['battle'],
  projectEnemyResource: ['battle'],
  syncEnemyResourceHud: ['battle']
};
export function classifySharedSource(before, after) {
  try {
    const inspect = source => {
      const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
      const functions={}, pieces=[];let cursor=0;
      for(const node of ast.body) {
        if(node.type!=='FunctionDeclaration' || !SHARED_FUNCTIONS[node.id?.name]) continue;
        if(functions[node.id.name]) throw Error('Duplicate owner');
        const effects=[];
        const canonical=value=>JSON.stringify(value,(key,item)=>['start','end','raw'].includes(key)?undefined:item);
        const visit=value=>{
          if(!value || typeof value!=='object') return;
          if(value.type==='CallExpression' || value.type==='NewExpression') {
            const callee=source.slice(value.callee.start,value.callee.end).replace(/\s/g,'');
            if(!/^Math\.(?:floor|ceil|round|trunc)$/.test(callee)) effects.push(canonical(value.callee));
          }
          if(['AssignmentExpression','UpdateExpression','AwaitExpression','YieldExpression'].includes(value.type)) effects.push(canonical(value.left || value.argument));
          for(const child of Object.values(value)) if(Array.isArray(child)) child.forEach(visit);else visit(child);
        };
        visit(node.body);
        functions[node.id.name]={text:source.slice(node.start,node.end),effects:JSON.stringify(effects)};
        pieces.push(source.slice(cursor,node.start),`FUNCTION:${node.id.name}`);cursor=node.end;
      }
      pieces.push(source.slice(cursor));return {functions,rest:pieces.join('')};
    };
    const a=inspect(before),b=inspect(after);
    if(a.rest!==b.rest || JSON.stringify(Object.keys(a.functions))!==JSON.stringify(Object.keys(b.functions))) return null;
    if(Object.keys(a.functions).some(k=>a.functions[k].effects!==b.functions[k].effects)) return null;
    const changed=Object.keys(a.functions).filter(k=>a.functions[k].text!==b.functions[k].text);
    return changed.length ? [...new Set(changed.flatMap(k=>SHARED_FUNCTIONS[k]))] : null;
  } catch {return null;}
}
const GENERATED=/^(?:build\/|asset-manifest\.json$|functions\/src\/generated\/restricted-forest-instance-policy\.json$)/;

// Single policy owner. Rollback conditional PR gates by setting this false.
export const PR_GATES_ENABLED = true;
export const CHANGE_FLAGS = Object.freeze([
  'core', 'battle', 'monster_balance', 'tower', 'daily', 'abyss', 'adventure',
  'boss', 'ui', 'inventory', 'skill', 'portrait', 'cloud', 'persistence',
  'release', 'workflow', 'unknown_runtime'
]);
export const BROWSER_GATES = Object.freeze([
  'battle_browser', 'ui_browser', 'daily_browser', 'tower_wild_browser',
  'portrait_browser', 'adventure_ui_browser', 'abyss_balance',
  'adventure_balance', 'boss_balance'
]);

// Narrow owners only. Anything outside these routes is strict, including new
// runtime files. Generated build/manifest changes are deliberately strict.
const OWNERS = [
  [/^(?:functions\/|js\/firebase\/|firestore\.rules$|firebase.*\.json$)/, ['cloud', 'persistence']],
  [/^js\/startup\//, ['cloud', 'persistence']],
  [/^config\/persisted-state-registry\.json$/, ['persistence', 'cloud']],
  [/^(?:config\/monster-(?:portrait-registry|asset-provenance)\.json|assets\/monsters\/)/, ['portrait', 'battle']],
  [/^config\/daily-monster-archetypes\.json$/, ['daily', 'battle']],
  [/^config\/wild-monster-archetypes\.json$/, ['tower', 'battle']],
  [/^js\/59-abyss-two-tier-runtime\.js$/, ['abyss', 'battle']],
  [/^js\/adventure\/adventure-(?:ui|entry|items|content|runtime)-v1-20260915\.js$/, ['adventure', 'battle', 'ui']],
  [/^js\/(?:04-stage-v11-native-bottom-nav-runtime|19-stage-v78-character-inventory-runtime|53-v173\.50-inventory-qol|55-v173\.51-inventory-qa|release-update-notification)\.js$/, ['ui', 'inventory']],
  [/^css\/(?:06-stage-v11-native-bottom-nav|08-stage-v14-character-scroll-fix|09-stage-v15-native-character-shell|22-stage-v78-character-inventory-core|23-stage-v77-inventory-detail-ui|24-stage-v85-inventory-inner-grid-scroll-root|52-v173\.50-inventory-qol|release-update-notification|ad-free-service-info-modal)\.css$/, ['ui', 'inventory']],
  [/^css\/44-v149-skill-ui-rules\.css$/, ['ui', 'skill']],
  [/^css\/adventure-(?:entry-v1|v1)-20260915\.css$/, ['adventure', 'ui']],
  [/^tests\/(?:cloud-save-|session-|firebase-|account-save-|auth-before-)/, ['cloud', 'persistence']],
  [/^tests\/(?:backpack-|responsive-window-|bottom-nav-|starter-potion-|forge-sockets-|ui-critical-)/, ['ui', 'inventory']],
  [/^tests\/(?:monster-portrait-|daily-dungeon-portrait-|water-wild-portrait-|wind-tower-portrait-)/, ['portrait', 'battle']],
  [/^assets\/(?:icons|items|relics|ui|fonts)\//, ['ui', 'inventory']],
  [/^assets\/(?:skills|vfx|audio)\//, ['battle', 'skill', 'portrait']]
];

export function classifyChanges(paths, {eventName = 'pull_request', baseRef = 'dev',
  enabled = PR_GATES_ENABLED, addedPaths = [], error = '', fullRegression = false,
  responsibilities = null, generatedVerified = false} = {}) {
  const flags = Object.fromEntries(CHANGE_FLAGS.map(k => [`${k}_changed`, false]));
  const reasons = [];
  const mark = (...keys) => keys.forEach(k => {flags[`${k}_changed`] = true;});
  const strict = (reason, ...keys) => {reasons.push(reason); mark('core', ...keys);};
  if (!Array.isArray(paths) || !paths.length || error) strict(error || 'No reliable changed-path input', 'unknown_runtime');
  for (const p of Array.isArray(paths) ? paths : []) {
    if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('..') || p.includes('\\')) {
      strict('Invalid changed path', 'unknown_runtime'); continue;
    }
    if (GENERATED.test(p)) {
      if(!generatedVerified || !paths.some(x=>/^(?:js\/|css\/|assets\/)/.test(x))) strict(`Unexplained generated output: ${p}`, 'unknown_runtime');
      continue;
    }
    if(p==='js/00-main.js' && Array.isArray(responsibilities) && responsibilities.length && responsibilities.every(k=>['ui','inventory','battle','boss','monster_balance'].includes(k))) {mark(...responsibilities);continue;}
    if (/^(?:\.github\/scripts\/(?:ci-(?:change-classifier|aggregate)|full-regression-health)\.mjs|tests\/(?:ci-(?:boss-routing|change-classifier|aggregate|concurrency).*|full-regression-health.test)\.mjs|\.github\/workflows\/(?:ci|deploy-dev-cloudflare)\.yml|package\.json|package-lock\.json)$/.test(p)) {mark('workflow');continue;}
    if (/^(?:\.github\/|ci\/|package(?:-lock)?\.json$|scripts\/.*(?:build|deployment|release)|release\/|feature-manifest\.json$|config\/(?:boot|feature|first-play)-manifest\.json$)/.test(p)) {
      strict(`CI/build/release owner: ${p}`, 'workflow', 'release'); continue;
    }
    if (/^js\/combat\/monster-(?:balance-owner|archetypes)\.mjs$/.test(p)) {
      mark('monster_balance','battle'); continue;
    }
    if(p==='js/gameplay-boss-tower-system.js' || p==='tests/gameplay-boss-tower-system.test.js') {mark('boss','tower','battle');continue;}
    if (/^(?:js\/(?:00-main|gameplay-boss-tower-system|.*(?:skill|battle|relic).*)\.js|functions\/.*battle.*|tests\/fixtures\/|tests\/.*(?:battle|monster-balance|skill-progression|level-suppression|hit-evasion).*)$/.test(p)) {
      strict(`Shared battle/test owner: ${p}`, 'battle'); continue;
    }
    if ((p.startsWith('docs/') && !/\.(?:js|mjs|cjs|css|html|json|ya?ml)$/i.test(p)) ||
        (/\.md$/i.test(p) && !p.startsWith('release/'))) continue;
    if (addedPaths.includes(p) && /\.(?:js|mjs|cjs)$/.test(p)) {
      strict(`New runtime/test source: ${p}`, 'unknown_runtime'); continue;
    }
    const owner = OWNERS.find(([pattern]) => pattern.test(p));
    if (owner) mark(...owner[1]);
    else strict(`Unclassified owner: ${p}`, 'unknown_runtime');
  }
  const strictMode = reasons.length > 0;
  const nightly = fullRegression && eventName !== 'pull_request';
  const mainRequired = baseRef === 'main' || nightly || (eventName==='push' && strictMode) || !['pull_request','push'].includes(eventName);
  const full = mainRequired || strictMode;
  const f = key => flags[`${key}_changed`];
  const predicted = {
    core_checks: true,
    battle_browser: full || f('battle') || f('skill') || f('monster_balance'),
    ui_browser: full || f('ui') || f('inventory') || f('skill'),
    daily_browser: full || f('daily') || f('monster_balance'),
    tower_wild_browser: full || f('tower') || f('monster_balance'),
    portrait_browser: full || f('portrait'),
    adventure_ui_browser: full || f('adventure'),
    abyss_balance: full || f('abyss') || f('monster_balance'),
    adventure_balance: full || f('adventure') || f('monster_balance'),
    boss_balance: full || f('boss') || f('monster_balance'),
    main_browser: mainRequired,
    promotion_health: baseRef === 'main' && !nightly,
    session_authority: full || f('cloud') || f('persistence')
  };
  const shadow = eventName === 'pull_request' && !mainRequired && !enabled;
  const gates = shadow ? Object.fromEntries(Object.keys(predicted).map(k => [k, ['main_browser','promotion_health'].includes(k) ? false : true])) : predicted;
  return {policyVersion: 1, eventName, baseRef, strictMode, shadow, fullRegression: nightly, flags, reasons, predicted, gates};
}

export function changedPaths(base, head, added = false, eventName = 'pull_request') {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/.test(sha) || /^0+$/.test(sha)) throw Error('Missing exact comparison SHA');
    try {execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {stdio: 'ignore'});}
    catch {execFileSync('git', ['fetch', '--no-tags', 'origin', sha], {stdio: 'pipe', timeout: 60_000});}
  }
  // Only the classifier checkout has complete ancestry. Genuine unrelated
  // histories still throw and retain strict fallback. Push compares exact trees.
  if(eventName==='pull_request') execFileSync('git',['merge-base',base,head],{stdio:'pipe'});
  return execFileSync('git', ['diff', '--name-only', '--no-renames', ...(added ? ['--diff-filter=A'] : []), '-z', `${base}${eventName==='pull_request'?'...':'..'}${head}`],
    {encoding: 'utf8', timeout: 30_000}).split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let paths = [], addedPaths = [], error = '', responsibilities=null, generatedVerified=false;
  try {
    paths = changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA, false, process.env.CI_EVENT_NAME);
    addedPaths = changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA, true, process.env.CI_EVENT_NAME);
    const comparisonBase=process.env.CI_EVENT_NAME==='pull_request' ? execFileSync('git',['merge-base',process.env.CI_BASE_SHA,process.env.CI_HEAD_SHA],{encoding:'utf8'}).trim() : process.env.CI_BASE_SHA;
    if(paths.includes('js/00-main.js')) responsibilities=classifySharedSource(
      execFileSync('git',['show',`${comparisonBase}:js/00-main.js`],{encoding:'utf8',maxBuffer:8*1024*1024}),
      execFileSync('git',['show',`${process.env.CI_HEAD_SHA}:js/00-main.js`],{encoding:'utf8',maxBuffer:8*1024*1024}));
    if(paths.some(p=>GENERATED.test(p))) {
      // Build --check certifies manifests, every shipped bundle and generated
      // policy against actual formal source, without executing changed outputs.
      execFileSync(process.execPath,['scripts/build-production.mjs','--check'],{stdio:'pipe',timeout:120_000,maxBuffer:8*1024*1024});
      const manifest=JSON.parse(fs.readFileSync('asset-manifest.json','utf8'));
      const previous=JSON.parse(execFileSync('git',['show',`${comparisonBase}:asset-manifest.json`],{encoding:'utf8',maxBuffer:8*1024*1024}));
      for(const p of paths.filter(p=>p.startsWith('build/') && p!=='build/asset-manifest.json')) {
        if(!Object.hasOwn(manifest.assets,p) && !(Object.hasOwn(previous.assets,p) && !fs.existsSync(p))) throw Error(`Unregistered generated output: ${p}`);
      }
      generatedVerified=true;
    }
  } catch (e) {error = `Comparison unavailable; strict fallback: ${e.message}`;}
  const plan = classifyChanges(paths, {eventName: process.env.CI_EVENT_NAME, baseRef: process.env.CI_BASE_REF, addedPaths, error, responsibilities, generatedVerified, fullRegression: process.env.CI_FULL_REGRESSION === 'true'});
  const outputs = {plan_json: JSON.stringify(plan), strict: plan.strictMode, cloud_gate: plan.gates.session_authority, full_node: plan.shadow || plan.strictMode || plan.fullRegression || !['pull_request','push'].includes(plan.eventName) || plan.baseRef === 'main' || plan.flags.monster_balance_changed || plan.flags.workflow_changed || plan.flags.cloud_changed || plan.flags.persistence_changed,
    ...plan.flags, ...plan.gates};
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    Object.entries(outputs).map(([k,v]) => `${k}=${v}\n`).join(''));
  const report = `## CI change classifier (${plan.shadow ? 'SHADOW — all original gates retained' : 'ENFORCED'})\n`+
    `Base: ${process.env.CI_BASE_SHA || 'unavailable'}; Head: ${process.env.CI_HEAD_SHA || 'unavailable'}\n\n`+
    '| Gate | Predicted | Effective |\n|---|---|---|\n'+Object.entries(plan.gates).map(([k,v]) => `| ${k} | ${plan.predicted[k] ? 'RUN' : 'SKIP'} | ${v ? 'RUN' : 'SKIP'} |`).join('\n')+'\n\n'+plan.reasons.join('\n')+'\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  console.log(report);
}
