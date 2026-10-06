import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

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
  enabled = PR_GATES_ENABLED, addedPaths = [], error = '', fullRegression = false} = {}) {
  const flags = Object.fromEntries(CHANGE_FLAGS.map(k => [`${k}_changed`, false]));
  const reasons = [];
  const mark = (...keys) => keys.forEach(k => {flags[`${k}_changed`] = true;});
  const strict = (reason, ...keys) => {reasons.push(reason); mark('core', ...keys);};
  if (!Array.isArray(paths) || !paths.length || error) strict(error || 'No reliable changed-path input', 'unknown_runtime');
  for (const p of Array.isArray(paths) ? paths : []) {
    if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('..') || p.includes('\\')) {
      strict('Invalid changed path', 'unknown_runtime'); continue;
    }
    if (/^(?:\.github\/|ci\/|package(?:-lock)?\.json$|scripts\/.*(?:build|deployment|release)|release\/|build\/|asset-manifest\.json$|feature-manifest\.json$|config\/(?:boot|feature|first-play)-manifest\.json$)/.test(p)) {
      strict(`CI/build/release owner: ${p}`, 'workflow', 'release'); continue;
    }
    if (/^js\/combat\/monster-(?:balance-owner|archetypes)\.mjs$/.test(p)) {
      strict(`Shared MonsterBalance: ${p}`, 'monster_balance', 'battle'); continue;
    }
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
  const mainRequired = baseRef === 'main' || eventName !== 'pull_request';
  const full = eventName !== 'pull_request' || mainRequired || strictMode;
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

function changedPaths(base, head, added = false) {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/.test(sha) || /^0+$/.test(sha)) throw Error('Missing exact comparison SHA');
    try {execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {stdio: 'ignore'});}
    catch {execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], {stdio: 'pipe', timeout: 60_000});}
  }
  return execFileSync('git', ['diff', '--name-only', '--no-renames', ...(added ? ['--diff-filter=A'] : []), '-z', `${base}...${head}`],
    {encoding: 'utf8', timeout: 30_000}).split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let paths = [], addedPaths = [], error = '';
  try {
    paths = changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA);
    addedPaths = changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA, true);
  } catch (e) {error = `Comparison unavailable; strict fallback: ${e.message}`;}
  const plan = classifyChanges(paths, {eventName: process.env.CI_EVENT_NAME, baseRef: process.env.CI_BASE_REF, addedPaths, error, fullRegression: process.env.CI_FULL_REGRESSION === 'true'});
  const outputs = {plan_json: JSON.stringify(plan), strict: plan.strictMode, cloud_gate: plan.gates.session_authority, full_node: plan.shadow || plan.strictMode || plan.eventName !== 'pull_request' || plan.baseRef === 'main' || plan.flags.cloud_changed || plan.flags.persistence_changed,
    ...plan.flags, ...plan.gates};
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    Object.entries(outputs).map(([k,v]) => `${k}=${v}\n`).join(''));
  const report = `## CI change classifier (${plan.shadow ? 'SHADOW — all original gates retained' : 'ENFORCED'})\n`+
    `Base: ${process.env.CI_BASE_SHA || 'unavailable'}; Head: ${process.env.CI_HEAD_SHA || 'unavailable'}\n\n`+
    '| Gate | Predicted | Effective |\n|---|---|---|\n'+Object.entries(plan.gates).map(([k,v]) => `| ${k} | ${plan.predicted[k] ? 'RUN' : 'SKIP'} | ${v ? 'RUN' : 'SKIP'} |`).join('\n')+'\n\n'+plan.reasons.join('\n')+'\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  console.log(report);
}
