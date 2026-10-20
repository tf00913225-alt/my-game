"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawnSync}=require("node:child_process");
(async()=>{
const {findChrome}=await import("../.github/scripts/runtime-browser-qa-support.mjs");
const source=fs.readFileSync("js/60-team-relic-system.js","utf8"),css=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const presentationSource=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const clear=source.slice(source.indexOf("    function clearRelicTargetFocus(){"),source.indexOf("    function relicGeometryOwner(){"));
const reveal=source.slice(source.indexOf("    function revealRelicTargets(target){"),source.indexOf("    function loadBattleIdentityImage(path){"));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),"relic-hud-focus-")),fixture=path.join(directory,"fixture.html");
try{
fs.writeFileSync(fixture,`<!doctype html><html><head><style>${css}</style><style>
body{margin:0;height:2200px}.v174-unit-hud{background:blue;pointer-events:auto!important}.test-dim,.test-vfx{position:fixed;inset:0;background:black;z-index:18120}.test-vfx{background:green;z-index:18130}.test-card{position:relative}
</style></head><body><div id="cards"></div><script>
let relicCutinNode=null;const RELIC_TARGET_REVEAL_MS=0,waitMs=()=>Promise.resolve(),requestAnimationFrame=fn=>fn();
const syncRelicPresentationGeometry=()=>({left:0,top:0,width:600,height:700}),relicGeometryOwner=()=>({getUnitGeometry:(side,index)=>({hpProjection:{},artworkProjection:{}})}),appendRelicProjection=()=>{};
${clear}${reveal}
window.monsters=Array.from({length:6},()=>({hp:100,alive:true}));window.getPartyCharacterByIndex=()=>({hp:100});
${presentationSource}
const records=[];
function rect(node){const r=node.getBoundingClientRect();return [r.left,r.top,r.width,r.height];}
for(const count of [3,6]){
document.getElementById('cards').replaceChildren();document.querySelector('.v174-battle-hud-layer')?.remove();document.querySelector('.test-vfx')?.remove();
const huds=[],cards=document.getElementById('cards'),layer=document.createElement('div');layer.className='v174-battle-hud-layer';document.body.appendChild(layer);
for(const side of ['player','monster'])for(let i=0;i<count;i++){const card=document.createElement('div');card.id=(side==='monster'?'battleMonster':'battlePlayerCard')+i;card.className='test-card';cards.appendChild(card);FourSymbolsBattlePresentation.applyUnit(card,side,null);const hud=FourSymbolsBattlePresentation.getUnitHud(card);if(hud===card)throw Error('formal applyUnit must create its real HUD');hud.style.cssText='left:'+(i%3*100)+'px;top:'+(side==='player'?220+Math.floor(i/3)*50:40+Math.floor(i/3)*50)+'px;width:80px;height:20px;transform:scale(.9);';huds.push(hud);}
huds.forEach(h=>layer.appendChild(h));const before=huds.map(rect);
for(const target of [{targetSide:'monster',targetIds:Array.from({length:count},(_,i)=>i)},{targetSide:'monster',targetIds:[1]},{targetSide:'player',targetIds:[0,2]}]){
relicCutinNode=document.createElement('div');relicCutinNode.id='teamRelicBattlePresentation';relicCutinNode.innerHTML='<div class="test-dim"></div><div class="team-relic-target-projection-layer"></div>';document.body.appendChild(relicCutinNode);document.body.classList.add('team-relic-cinematic-active');
// Reveal before detach as in the real cinematic; the same HUD nodes later
// move to V174's fixed layer when VFX begins.
huds.forEach(h=>h.v174FixtureCard||(h.v174FixtureCard=document.getElementById((h.dataset.side==='monster'?'battleMonster':'battlePlayerCard')+h.dataset.index)));huds.forEach(h=>h.v174FixtureCard.appendChild(h));
revealRelicTargets(target);huds.forEach(h=>layer.appendChild(h));const vfx=document.createElement('div');vfx.className='test-vfx';document.body.appendChild(vfx);
const focused=huds.map(h=>h.dataset.relicTargetFocus==='true'),boxes=huds.map(rect),topmost=huds.map(h=>{const r=h.getBoundingClientRect();return document.elementFromPoint(r.left+10,r.top+10)===h;});
window.scrollTo(0,160);const scrolled=huds.map(rect);window.scrollTo(0,0);
cleanupRelicCutin();vfx.remove();records.push({count,target,before,boxes,scrolled,focused,topmost,clean:huds.every(h=>!h.dataset.relicTargetFocus)&&!document.body.classList.contains('team-relic-cinematic-active'),restored:huds.map(rect)});
}
}
const output=document.createElement('pre');output.id='result';output.textContent=JSON.stringify(records);document.body.appendChild(output);
</script></body></html>`);
const result=spawnSync(findChrome(),["--headless=new","--no-sandbox","--disable-gpu","--window-size=700,900","--user-data-dir="+path.join(directory,"profile"),"--dump-dom","file:///"+fixture.replace(/\\/g,"/")],{encoding:"utf8",timeout:30000,maxBuffer:3e6});
assert.equal(result.status,0,result.stderr);const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(match,"browser must execute formal relic focus lifecycle");
const records=JSON.parse(match[1]);assert.equal(records.length,6);
for(const row of records){
const expected=['player','monster'].flatMap(side=>Array.from({length:row.count},(_,index)=>side===row.target.targetSide&&row.target.targetIds.includes(index)));
assert.deepEqual(row.focused,expected,"focus must use both formal side and complete targetIds");
assert.deepEqual(row.topmost,expected,"only actual target HUDs may rise above cinematic and sprite paint");
assert.deepEqual(row.boxes,row.before,"display:contents must preserve fixed HUD geometry");
assert.deepEqual(row.scrolled,row.before,"scroll cannot move the fixed HUDs");
assert.deepEqual(row.restored,row.before,"cleanup preserves the original HUD rectangles");assert.ok(row.clean,"cleanup must remove every target marker and cinematic state");
}
console.log('Relic target HUD focus: formal side/IDs, late detach, 3/6 geometry, scroll, actual stacking and cleanup PASS');
}finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('relic-hud-focus-'));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
