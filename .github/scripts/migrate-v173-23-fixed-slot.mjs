import fs from 'node:fs';

const path='tests/v173.23-wind-vfx.test.js';
let source=fs.readFileSync(path,'utf8');

if(source.includes('const slotOwner=fs.readFileSync("js/battlefield-slot-owner.js","utf8");')){
  console.log('V173.23 harness already migrated.');
  process.exit(0);
}

function replaceOnce(label,pattern,replacement){
  const next=source.replace(pattern,replacement);
  if(next===source){ throw new Error('migration pattern not found: '+label); }
  source=next;
}

replaceOnce(
  'load formal slot owner',
  'const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");',
  'const slotOwner=fs.readFileSync("js/battlefield-slot-owner.js","utf8");\nconst animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");'
);

replaceOnce(
  'install formal slot DOM',
  '    const body=makeNode();\n    const monsterArea=makeNode({left:260,top:40,right:700,bottom:300,width:440,height:260});',
  `    const body=makeNode();
    const slotNodes={};
    const enemyXs=[100,220,340,460,580];
    const allyXs=[180,340,500];
    ["B","F"].forEach((row,rowIndex)=>{
        enemyXs.forEach((left,index)=>{
            const id=\`ENEMY_\${row}\${index+1}\`;
            const top=rowIndex===0?60:180;
            const slot=makeNode({left,top,right:left+80,bottom:top+100,width:80,height:100});
            slot.className="v-fixed-enemy-slot";
            slot.dataset.slot=id;
            slotNodes[id]=slot;
            body.appendChild(slot);
        });
    });
    ["F","B"].forEach((row,rowIndex)=>{
        allyXs.forEach((left,index)=>{
            const id=\`ALLY_\${row}\${index+1}\`;
            const top=rowIndex===0?420:540;
            const slot=makeNode({left,top,right:left+100,bottom:top+100,width:100,height:100});
            slot.className="v-fixed-ally-slot";
            slot.dataset.slot=id;
            slotNodes[id]=slot;
            body.appendChild(slot);
        });
    });
    const monsterArea=makeNode({left:260,top:40,right:700,bottom:300,width:440,height:260});`
);

replaceOnce(
  'document slot lookup',
  '        getElementById(id){ return cards[id]||null; },\n        querySelectorAll(selector){ return body.querySelectorAll(selector); }',
  `        getElementById(id){ return cards[id]||null; },
        querySelector(selector){
            const match=String(selector||"").match(/\\[data-slot="([^"]+)"\\]/);
            return match?(slotNodes[match[1]]||null):body.querySelector(selector);
        },
        querySelectorAll(selector){ return body.querySelectorAll(selector); }`
);

replaceOnce(
  'install owner before V143',
  '    vm.createContext(context);\n    vm.runInContext(animation,context);\n    return {\n        context,body,cards,monsters,party,scheduled,raf,drawCalls,monsterHits,playerHits,cardEffects,',
  `    vm.createContext(context);
    vm.runInContext(slotOwner,context);
    const owner=context.FourSymbolsBattlefieldSlots;
    assert.ok(owner,"formal Fixed Slot owner must install");
    const snapshot=owner.createEnemyFormationSnapshot([0,1,2],{originalFormationType:3});
    owner.setActiveEnemySnapshot(snapshot);
    owner.ensureAllyFormation([0,1,2]);
    vm.runInContext(animation,context);
    return {
        context,owner,snapshot,slotNodes,body,cards,monsters,party,scheduled,raf,drawCalls,monsterHits,playerHits,cardEffects,`
);

replaceOnce(
  'formal position helpers',
  'function runTimers(runtime,delay){\n    runtime.scheduled.filter(timer=>Math.abs(timer.delay-delay)<2).forEach(timer=>timer.callback());\n}\n',
  `function runTimers(runtime,delay){
    runtime.scheduled.filter(timer=>Math.abs(timer.delay-delay)<2).forEach(timer=>timer.callback());
}

function positionOf(node){
    return [Number.parseFloat(node.style.left),Number.parseFloat(node.style.top)];
}
function enemySlot(runtime,index){
    return runtime.owner.getEnemySlotForMonster(runtime.snapshot,index);
}
function allySlot(runtime,index){
    return runtime.owner.getAllySlotForCharacter(index);
}
function formalPosition(runtime,side,index){
    const slot=side==="monster"?enemySlot(runtime,index):allySlot(runtime,index);
    const point=runtime.owner.getSlotCenter(slot);
    return [point.x,point.y];
}
`
);

replaceOnce(
  'single Wind cast geometry',
  '    assert.equal(sprite.style.left,"578px");\n    assert.equal(sprite.style.top,"140px");',
  `    assert.deepEqual(positionOf(sprite),formalPosition(runtime,"monster",2));
    assert.notDeepEqual(positionOf(sprite),[578,140],"must not use retired monster-card geometry");`
);

replaceOnce(
  'group Wind cast geometry',
  '    assert.equal(groupSprites[0].style.left,"458px");\n    assert.equal(groupSprites[0].style.top,"140px");',
  `    const groupRect=group.owner.getGeometryRectFromShape("monster",enemySlot(group,1),"tri");
    assert.deepEqual(positionOf(groupSprites[0]),[groupRect.centerX,groupRect.centerY]);`
);

replaceOnce(
  'battlefield Wind cast geometry',
  '    assert.equal(allSprites[0].dataset.areaId,"battleMonsterArea");\n    assert.equal(allSprites[0].dataset.targetIndexes,"0,1,2");\n    assert.equal(allSprites[0].style.left,"480px");\n    assert.equal(allSprites[0].style.top,"170px");',
  `    assert.equal(allSprites[0].dataset.areaId,"fixed-enemy-zone");
    assert.equal(allSprites[0].dataset.targetIndexes,"0,1,2");
    const allRect=all.owner.getSideRect("monster");
    assert.deepEqual(positionOf(allSprites[0]),[allRect.centerX,allRect.centerY]);`
);

replaceOnce(
  'fixed tri footprint',
  '        assert.equal(sprite.style.left,"458px","selected middle target remains the visual centre");\n        assert.equal(sprite.style.top,"140px");\n        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);',
  `        const triRect=runtime.owner.getGeometryRectFromShape("monster",enemySlot(runtime,1),"tri");
        assert.deepEqual(positionOf(sprite),[triRect.centerX,triRect.centerY],"selected middle Slot remains the visual centre");
        placements.push([sprite.style.left,sprite.style.top,sprite.style.width,sprite.style.height]);`
);

replaceOnce(
  'enemy Wind cast target geometry',
  '    assert.equal(sprites[0].style.left,"239px");\n    assert.equal(sprites[0].style.top,"418px");',
  `    assert.deepEqual(positionOf(sprites[0]),formalPosition(runtime,"player",1));
    assert.notDeepEqual(positionOf(sprites[0]),[239,418],"must not use retired player-card geometry");`
);

fs.writeFileSync(path,source);
console.log('Migrated V173.23 Wind VFX harness to formal Fixed Slot geometry.');
