const fs=require('node:fs');
const vm=require('node:vm');
// Reuse the established isolated battle fixture while executing current sources.
const fixture=fs.readFileSync('tests/v174-team-relic-system.test.js','utf8');
const start=fixture.indexOf('function createRuntime(');
const end=fixture.indexOf('\nconst runtime=createRuntime();',start);
const main=fs.readFileSync('js/00-main.js','utf8');
const shield=main.slice(main.indexOf('function getPlayerShieldRemaining('),main.indexOf('function showShieldAbsorb('));
const combat=main.slice(main.indexOf('const combatEventObservers='),main.indexOf('const battleBeforeCombatantObservers='));
const policy=main.slice(main.indexOf('const GENERAL_NEGATIVE_STATUS_TYPES='),main.indexOf('\n});',main.indexOf('const GENERAL_NEGATIVE_STATUS_TYPES='))+4);
const body=fixture.slice(start,end);
const factory=new Function('vm','repositorySource','summarySource','source','shieldSource','combatSource','policySource',body+';return createRuntime;');
module.exports=factory(vm,
  fs.readFileSync('js/startup/account-save-repository.js','utf8'),
  fs.readFileSync('js/relic-summary-catalog.js','utf8'),
  fs.readFileSync('js/60-team-relic-system.js','utf8'),shield,combat,policy);
