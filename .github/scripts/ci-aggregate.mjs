import {pathToFileURL} from 'node:url';

// The public check name remains Repository checks. No upstream failure, queued
// job or cancellation can become a green required check.
export const CHILD_GATES = Object.freeze([
  'classify', 'core_checks', 'battle_browser', 'ui_browser', 'daily_browser',
  'tower_wild_browser', 'portrait_browser', 'adventure_ui_browser',
  'main_browser', 'abyss_balance', 'adventure_balance', 'boss_balance', 'session_authority', 'promotion_health'
]);
export const DEPLOYMENT_GATES=Object.freeze(['publish_dev','responsive_live','battle_daily_live','tower_live','abyss_live','adventure_live','boss_live']);
export function requireDeploymentGates(needs) {
  if(!needs || typeof needs!=='object' || Array.isArray(needs)) throw Error('Invalid deployment aggregate input');
  if(Object.keys(needs).some(k=>!DEPLOYMENT_GATES.includes(k))) throw Error('Unknown deployment dependency');
  for(const key of DEPLOYMENT_GATES) if(needs[key]?.result!=='success') throw Error(`Required deployed QA ${key} did not pass: ${needs[key]?.result ?? 'missing'}`);
  return true;
}

export function requireChildGates(needs, {mainRequired = true, plan} = {}) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) throw Error('Invalid aggregate input');
  const unexpected = Object.keys(needs).filter(key => !CHILD_GATES.includes(key));
  if (unexpected.length) throw Error(`Unknown aggregate dependencies: ${unexpected.join(', ')}`);
  if (plan) {
    if (plan.policyVersion !== 1 || typeof plan.strictMode !== 'boolean' || typeof plan.shadow !== 'boolean' ||
        !plan.gates || plan.gates.core_checks !== true) throw Error('Invalid classifier policy');
    for (const key of CHILD_GATES.filter(k => k !== 'classify')) {
      if (typeof plan.gates[key] !== 'boolean') throw Error(`Missing classifier gate ${key}`);
      if (!['main_browser', 'promotion_health'].includes(key) && (plan.strictMode || plan.shadow || plan.eventName !== 'pull_request' || mainRequired) &&
          plan.gates[key] !== true) throw Error(`Full/strict policy cannot skip ${key}`);
    }
    if (plan.gates.promotion_health !== (plan.baseRef === 'main' && !plan.fullRegression)) throw Error('Promotion health policy mismatch');
    if (plan.gates.main_browser !== mainRequired) throw Error('Main browser policy mismatch');
  }
  for (const key of CHILD_GATES) {
    const result = needs[key]?.result;
    const permittedSkip = (['main_browser','promotion_health'].includes(key) && !mainRequired) ||
      (plan && key !== 'classify' && key !== 'core_checks' && plan.gates[key] === false);
    if (result !== 'success' && !(permittedSkip && result === 'skipped')) {
      throw Error(`Required CI child ${key} did not pass: ${result ?? 'missing'}`);
    }
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if(process.argv.includes('--dev-deployment')) {
      requireDeploymentGates(JSON.parse(process.env.CI_NEEDS_JSON));
      console.log('Exact-SHA deployed QA: every required group passed.');
    } else {
    if (!['true', 'false'].includes(process.env.CI_MAIN_REQUIRED)) throw Error('Missing main gate policy');
    const plan = JSON.parse(process.env.CI_PLAN_JSON);
    if (!plan) throw Error('Missing classifier plan');
    requireChildGates(JSON.parse(process.env.CI_NEEDS_JSON), {
      mainRequired: process.env.CI_MAIN_REQUIRED === 'true', plan
    });
    console.log('Repository checks: every required child passed; only explicit classifier/main-only skips accepted.');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
