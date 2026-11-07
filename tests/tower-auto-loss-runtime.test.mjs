import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const fixture=readFileSync(new URL('./gameplay-boss-tower-system.test.js',import.meta.url),'utf8');
const load=new Function('require',fixture.slice(0,fixture.indexOf('let passed=0;'))+'\nreturn load;')(require);

test('Tower loss cancels an existing countdown and stale tick cannot launch another battle',()=>{
 const {context:c}=load(),timers=[],cleared=[];let launches=0;
 const launch=c.v132LaunchDungeonBattle;c.v132LaunchDungeonBattle=(...args)=>{launches++;return launch(...args);};
 c.saveGame=()=>true;c.setTimeout=(fn,ms)=>{if(ms===1000)timers.push(fn);return timers.length;};c.clearTimeout=id=>cleared.push(id);
 assert.equal(c.vGameplayToggleTowerAutoAdvance(true),true);
 assert.equal(c.vGameplaySelectTowerBand(1),true);c.battleActive=false;c.lastBattleCallback({result:'win'});
 assert.equal(timers.length,1,'confirmed win must schedule the existing countdown');
 const staleTick=timers[0];assert.equal(c.vGameplaySelectTowerBand(2),true);c.battleActive=false;c.lastBattleCallback({result:'lose'});
 assert.equal(c.GameplaySystem.getActiveBattleState(),null);assert.ok(cleared.length>0,'loss must cancel the countdown');
 assert.equal(timers.length,1,'loss must not schedule another countdown');staleTick();
 assert.equal(launches,2,'cancelled stale tick must not launch another battle');
});
