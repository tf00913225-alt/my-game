const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/00-main.js','utf8');const block=source.slice(source.indexOf('function positionBattleSkillNameBadge('),source.indexOf('function showSkillNameBadge('));
function fixture(blocked=false){const self={id:'battlePlayerCard3',getBoundingClientRect:()=>({left:100,top:500,width:120,height:120})},other={id:'battlePlayerCard0'};const projection={unitRect:{left:100,top:500,width:120,height:120},artworkProjection:{rect:{left:102,top:510,width:100,height:100}},hudSafeRect:{left:100,top:612,width:120,height:20}};const before={artworkProjection:{rect:{left:100,top:350,width:120,height:110}},hudSafeRect:{left:100,top:465,width:120,height:30}};const badge={dataset:{},textContent:'長技能名稱保持完整',offsetWidth:90,offsetHeight:38,style:{setProperty(k,v){this[k]=v}}};const c={window:{FourSymbolsBattlefieldRenderGeometry:{getUnitGeometry:(_s,i)=>i===3?projection:before}},document:{querySelectorAll:selector=>selector.includes("battleTurnIndicator")?[]:blocked?[self,other]:[self]}};vm.createContext(c);vm.runInContext(block,c);return {c,self,badge,projection};}
test('original badge reads actual portrait projection and keeps full long-name title',()=>{const f=fixture();f.c.positionBattleSkillNameBadge(f.badge,'player',3,f.self);assert.equal(f.badge.style.left,'152px');assert.equal(f.badge.style.top,'474px');assert.equal(f.badge.dataset.battleAnchor,'player:3');assert.equal(f.badge.title,'長技能名稱保持完整');assert.ok(parseFloat(f.badge.style['--skill-name-max-width'])<120);assert.equal(f.projection.artworkProjection.rect.top,510);});
test('dense rear-row label moves above blocking formal portrait and HUD, no gameplay clock',()=>{const f=fixture(true);f.c.positionBattleSkillNameBadge(f.badge,'player',3,f.self);assert.equal(f.badge.style.top,'344px');assert.doesNotMatch(block,/setTimeout|setInterval|\.animate\(|battlePhase\s*=|activeBattleCharacterIndex\s*=/);});

test('compact top row stays above its HUD without moving or covering it',()=>{const f=fixture();f.projection.artworkProjection.rect.top=47;f.projection.hudSafeRect.top=17;Object.defineProperty(f.badge,'offsetHeight',{get:()=>f.badge.dataset.compact?14:38});f.c.positionBattleSkillNameBadge(f.badge,'monster',3,f.self);assert.equal(f.badge.dataset.compact,'true');assert.equal(f.badge.style.top,'16px');});

test('visible top announcement uses free PC gutter without changing either owner geometry',()=>{
 const f=fixture();f.c.window.innerWidth=1280;f.projection.unitRect.left=440;f.projection.artworkProjection.rect={left:450,top:62,width:100,height:75};f.projection.hudSafeRect={left:450,top:17,width:100,height:25};
 const banner={left:450,top:11,width:375,height:50};
 f.c.document.querySelectorAll=s=>s.includes('battleTurnIndicator')?[{getBoundingClientRect:()=>banner}]:[f.self];
 Object.defineProperty(f.badge,'offsetHeight',{get:()=>f.badge.dataset.compact?14:38});
 f.c.positionBattleSkillNameBadge(f.badge,'monster',3,f.self);
 const x=parseFloat(f.badge.style.left),y=parseFloat(f.badge.style.top);
 assert.ok(y-14>=1&&y<62);assert.ok(x+45<=banner.left||x-45>=banner.left+banner.width);
 assert.deepEqual(banner,{left:450,top:11,width:375,height:50});assert.equal(f.projection.hudSafeRect.top,17);
});
