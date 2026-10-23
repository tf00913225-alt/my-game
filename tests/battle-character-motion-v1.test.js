const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/54-v173.51-battle-qa.js','utf8');
const css=fs.readFileSync('css/fixed-slot-battlefield-rendering-v2.css','utf8');
function fixture(){
    const classes=new Set(),motions=[];
    const entity={hp:100,alive:true};
    const action={animate(frames,options){const m={frames,options,cancelled:false,pause(){this.paused=true;},play(){this.played=true;},cancel(){this.cancelled=true;}};motions.push(m);return m;}};
    const art={dataset:{},querySelector:()=>action};
    const card={id:'battleMonster2',classList:{contains:n=>classes.has(n),remove:(...names)=>names.forEach(n=>classes.delete(n))},querySelector:()=>art};
    const context={window:{matchMedia:()=>({matches:false})},monsters:[null,null,entity],document:{querySelectorAll:()=>[card]}};
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('function syncUnitMotion('),source.indexOf('/* One real HUD')),context);
    return {context,art,card,entity,classes,motions,action};
}
test('Core classes drive one state; death and revive have no gameplay delay',()=>{
    const f=fixture(),sync=()=>f.context.syncUnitMotion(f.card);
    sync();assert.equal(f.art.dataset.motion,'idle');
    f.classes.add('attacker-lunge-down');sync();assert.equal(f.art.dataset.motion,'attacking');
    f.art.v143ImpactRecoil={};sync();assert.equal(f.art.dataset.motion,'hit');
    f.classes.add('dodge-back');sync();assert.equal(f.art.dataset.motion,'dodging');
    f.entity.hp=0;sync();assert.equal(f.art.dataset.motion,'dying');
    f.classes.clear();f.classes.add('dying');f.art.v143ImpactRecoil=null;f.entity.hp=35;sync();assert.equal(f.art.dataset.motion,'idle','HP authority wins over the old delayed death class');
    assert.equal(f.entity.hp,35);
});
test('cast uses existing duration without extending it and stale finish cannot clear replacement',()=>{
    const f=fixture(),config={id:'fireRocket',category:'magic',duration:1200};
    assert.doesNotThrow(()=>f.context.endCharacterCast(f.card,undefined),'late owner installation may have no cast handle');
    f.classes.add('attacker-lunge-down');
    const first=f.context.startCharacterCast(f.card,config,1200);
    assert.equal(first.options.duration,300);assert.equal(config.duration,1200);
    assert.equal(f.art.dataset.motion,'casting');assert.equal(f.classes.size,0);
    const second=f.context.startCharacterCast(f.card,config,2000);
    assert.ok(first.cancelled);first.onfinish();assert.equal(f.art.v174Cast,second);
    second.onfinish();assert.equal(f.art.v174Cast,null);assert.equal(f.art.dataset.motion,'idle');
    assert.equal(f.context.startCharacterCast(f.card,{id:'slash',category:'physical'},520),null);
});

test('normal short lean holds through original hit and returns in520ms with no aura or private clock',()=>{
 const f=fixture(),motion=f.context.startCharacterCast(f.card,{id:'normal',category:'physical'},520);
 assert.equal(motion.options.duration,520);assert.equal(motion.paused,true);assert.equal(motion.currentTime,0);
 assert.equal(motion.frames[1].offset,.17);assert.equal(motion.frames[2].offset,.57);assert.equal(motion.frames[1].transform,motion.frames[2].transform);
 assert.match(motion.frames[1].transform,/18px/);assert.equal(motion.frames.at(-1).transform,'translateY(0) scale(1)');assert.equal(motion.fireAura,undefined);
 f.context.endCharacterCast(f.card,motion);assert.ok(motion.cancelled);assert.equal(f.art.v174Cast,null);
 f.context.window.matchMedia=()=>({matches:true});assert.equal(f.context.startCharacterCast(f.card,{id:'normal'},520),null);
});
test('death, dispose and reduced motion cancel or suppress cast without changing resources',()=>{
    const f=fixture();
    const cast=f.context.startCharacterCast(f.card,{id:'heal',category:'heal'},1600);
    f.entity.hp=0;f.context.syncUnitMotion(f.card);
    assert.ok(cast.cancelled);assert.equal(f.art.dataset.motion,'dying');assert.equal(f.entity.hp,0);
    f.entity.hp=100;f.context.syncUnitMotion(f.card);
    const next=f.context.startCharacterCast(f.card,{id:'heal'},1600);
    f.context.clearCharacterMotions();assert.ok(next.cancelled);assert.equal(f.art.dataset.motion,'stopped');
    f.context.window.matchMedia=()=>({matches:true});assert.equal(f.context.startCharacterCast(f.card,{id:'heal'},1600),null);
});
test('one fire representative owns caster lunge/ring, MISS retreat and bounded paint-only critical shake',()=>{
    const f=fixture(),rings=[];
    f.context.document.createElement=()=>{const ring={style:{setProperty(){}},children:[],appendChild(node){this.children.push(node);},setAttribute(){},remove(){this.removed=true;},animate:()=>({cancel(){this.cancelled=true;}})};rings.push(ring);return ring;};
    f.art.insertBefore=()=>{};
    const cast=f.context.startCharacterCast(f.card,{id:'explosiveFlurry',category:'physical'},1450);
    assert.equal(cast.options.duration,450);assert.match(cast.frames[2].transform,/26px/);
    assert.equal(rings.length,7);assert.equal(rings[0].children.length,6,"one bounded six-ember emitter");cast.onfinish();assert.equal(f.art.v174Cast,cast,'ring owned until same cast cleanup');
    f.context.endCharacterCast(f.card,cast);assert.ok(cast.cancelled&&rings[0].removed);
    f.context.fireDodge(f.card);const dodge=f.art.v143ImpactRecoil;
    assert.equal(dodge.options.duration,300);assert.equal(dodge.frames[1].translate,'0px -24px');
    assert.equal(f.art.dataset.motion,'dodging');dodge.onfinish();assert.equal(f.art.v143ImpactRecoil,null);
    const paints=[];const paint={animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};paints.push(a);return a;}};
    f.context.document.querySelectorAll=selector=>selector.includes('portrait-paint')?[paint]:[f.card];
    f.context.fireCriticalShake(12);f.context.fireCriticalShake(12);
    assert.equal(paints.length,1);assert.equal(paints[0].options.duration,160);
    f.context.clearCharacterMotions();assert.ok(paints[0].cancelled);
    f.context.window.matchMedia=()=>({matches:true});
    const reduced=f.context.startCharacterCast(f.card,{id:'explosiveFlurry',category:'physical'},1450);
    assert.ok(reduced.fireAura);assert.equal(reduced.fireAura.animation,null);
    f.context.endCharacterCast(f.card,reduced);f.context.fireDodge(f.card);assert.equal(f.art.v143ImpactRecoil,null);
});
test('only paint breathes, action layer owns motion, fixed depth and shadow keep their frame',()=>{
    assert.match(css,/\.v174-action-motion\{[^}]*inset:0/);
    assert.match(css,/attacker-lunge-up > \.v174-battle-art > \.v174-action-motion\{animation:v174BattleLungeUp/);
    assert.match(css,/\.dodge-back\{animation:none/);
    assert.match(css,/\.dodge-back > \.v174-battle-art > \.v174-action-motion\{animation:dodgeBack/);
    assert.match(css,/22%\{transform:translateY\(2px\) scale\(\.99\)/);
    assert.match(css,/translateY\(-1\.5px\) scale\(1\.006\)/);
    assert.match(css,/\.v174-battle-art\{scale:var\(--battle-art-depth, \.94\)/,"far-row Boss/fallback depth remains the previous policy");
    assert.match(css,/\.v174-battle-art\{scale:var\(--battle-art-depth, 1\)/,"depth stays on the stationary art frame");
    assert.match(css,/prefers-reduced-motion:reduce[\s\S]*\.v174-action-motion[\s\S]*animation:none !important/);
    assert.doesNotMatch(source.slice(source.indexOf('function syncUnitMotion('),source.indexOf('/* One real HUD')),/setTimeout|setInterval|requestAnimationFrame|Math\.random/);
    const vfx=fs.readFileSync('js/39-v143-skill-animation.js','utf8');
    assert.match(vfx,/const motion=artwork\.querySelector\?\.\(":scope > \.v174-action-motion"\)\|\|artwork/);
    assert.match(vfx,/artwork\.v143ImpactRecoil=motion\.animate/);
});
