import {pathToFileURL} from 'node:url';

// The public check name remains Repository checks. No upstream failure, queued
// job or cancellation can become a green required check.
export const CHILD_GATES = Object.freeze([
  'classify', 'core_checks', 'battle_browser', 'ui_browser', 'daily_browser',
  'tower_wild_browser', 'portrait_browser', 'adventure_ui_browser',
  'main_browser', 'abyss_balance', 'adventure_balance', 'boss_balance'
]);

export function requireChildGates(needs, {mainRequired = true} = {}) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) throw Error('Invalid aggregate input');
  const unexpected = Object.keys(needs).filter(key => !CHILD_GATES.includes(key));
  if (unexpected.length) throw Error(`Unknown aggregate dependencies: ${unexpected.join(', ')}`);
  for (const key of CHILD_GATES) {
    const result = needs[key]?.result;
    const permittedSkip = key === 'main_browser' && !mainRequired;
    if (result !== 'success' && !(permittedSkip && result === 'skipped')) {
      throw Error(`Required CI child ${key} did not pass: ${result ?? 'missing'}`);
    }
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!['true', 'false'].includes(process.env.CI_MAIN_REQUIRED)) throw Error('Missing main gate policy');
    requireChildGates(JSON.parse(process.env.CI_NEEDS_JSON), {
      mainRequired: process.env.CI_MAIN_REQUIRED === 'true'
    });
    console.log('Repository checks: every required child passed; only explicit main-only skip allowed.');
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
