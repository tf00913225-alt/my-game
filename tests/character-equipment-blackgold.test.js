'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/00-main.js','utf8');
function formalFunction(name){
    const start=source.indexOf('function '+name+'(');
    assert.ok(start>=0,'formal function missing: '+name);
    const end=source.indexOf('\nfunction ',start+1);
    return source.slice(start,end<0?source.length:end);
}
function element(){
    return {children:[],dataset:{},style:{},textContent:'',className:'',
        append(...nodes){this.children.push(...nodes);},appendChild(node){this.children.push(node);},
        replaceChildren(...nodes){this.children=[...nodes];}};
}
const nodes=Object.fromEntries(['inventoryCharacterSummary','inventorySummaryElement','inventorySummaryLevel','inventoryStats','inventoryCharacterTabs'].map(id=>[id,element()]));
const nameNode=element(),levelNode=element();
nodes.inventoryCharacterTabs.querySelector=selector=>selector.includes('name span')?nameNode:levelNode;
const characters=[
    Object.freeze({id:'<img src=x onerror="danger()">',level:17,element:'fire',hp:1,sp:2}),
    Object.freeze({id:'寒泉乙',level:31,element:'water',hp:3,sp:4}),null
];
const stats=[Object.freeze({maxHP:1701,maxSP:172}),Object.freeze({maxHP:3101,maxSP:312}),null];
const model=JSON.stringify({characters,stats});let saves=0;
const context=vm.createContext({inventoryCharacterIndex:0,elementDatabase:{fire:{name:'火'},water:{name:'水'}},
    $:id=>nodes[id],document:{createElement:()=>element()},
    getBackpackCharacter:index=>characters[index],getBackpackCharacterStats:index=>stats[index],
    getBackpackPartyCharacters:()=>characters,saveGame:()=>{saves++;throw Error('presentation must never save');}});
vm.runInContext(['renderInventoryStats','renderInventoryCharacterSummary','renderInventoryCharacterTabs'].map(formalFunction).join('\n'),context);
function render(index){context.inventoryCharacterIndex=index;vm.runInContext('renderInventoryCharacterSummary()',context);}
function resourceRows(){return nodes.inventoryStats.children.map(row=>row.children.map(child=>child.textContent));}
render(0);
assert.equal(nodes.inventorySummaryElement.textContent,'火');
assert.equal(nodes.inventorySummaryLevel.textContent,'等級 17');
assert.deepEqual(resourceRows(),[['最大 HP','1701'],['最大 SP','172']],'limits must use formal getter, not current hp/sp or fixture constants');
vm.runInContext('renderInventoryCharacterTabs()',context);
assert.equal(nameNode.textContent,characters[0].id,'player-provided name must remain literal text');
assert.ok(!nodes.inventoryCharacterTabs.innerHTML.includes(characters[0].id),'untrusted player name cannot enter HTML');
render(1);
assert.equal(nodes.inventoryCharacterSummary.dataset.element,'water');
assert.equal(nodes.inventorySummaryElement.textContent,'水');
assert.deepEqual(resourceRows(),[['最大 HP','3101'],['最大 SP','312']],'switching must refresh selected character values');
render(2);
assert.equal(nodes.inventoryCharacterSummary.dataset.element,'');
assert.equal(nodes.inventorySummaryElement.textContent,'尚未建立');
assert.equal(nodes.inventorySummaryLevel.textContent,'');
assert.deepEqual(resourceRows(),[],'empty subject must clear previous resources');
assert.equal(JSON.stringify({characters,stats}),model,'presentation cannot mutate character/stat data');
assert.equal(saves,0);

// Exercise the existing portrait Owner at the same empty-subject boundary.
const portraitSource=fs.readFileSync('js/25-v131-fix-batch.js','utf8');
const start=portraitSource.indexOf('    function syncInventoryPortrait(){');
const end=portraitSource.indexOf('    window.v131SyncInventoryPortrait=',start);
assert.ok(start>=0&&end>start);
let removed=false,created=0;
const placeholder={style:{display:'none'}};
const oldPortrait={remove(){removed=true;}};
const frame={querySelector:selector=>selector.includes('placeholder')?placeholder:oldPortrait};
const portraitContext=vm.createContext({inventoryCharacterIndex:2,getBackpackCharacter:()=>null,
    getPartyCharacterByIndex:()=>null,document:{getElementById:()=>frame,createElement(){created++;throw Error('empty portrait cannot create art');}}});
vm.runInContext(portraitSource.slice(start,end)+'\nsyncInventoryPortrait();',portraitContext);
assert.equal(removed,true,'empty subject must remove the previous character image');
assert.equal(placeholder.style.display,'');assert.equal(created,0);
console.log('PASS: formal character summary getters, switching, safe name, empty resources/portrait and no state writes');
