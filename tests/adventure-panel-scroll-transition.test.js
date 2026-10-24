const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('adventure opens inner titles, preserves same-page reading and resets the fixed map scroll',()=>{
    const body={innerHTML:'<div class="adventure-map-canvas"></div>',scrollTop:900,
        querySelector(selector){return selector==='.adventure-map-canvas'&&this.innerHTML.includes('class="adventure-map-canvas"')?{}:null;}};
    const title={},meta={},back={hidden:false};
    const root={isConnected:true,dataset:{},querySelector(selector){return selector==='#adventureView'?body:selector==='#adventureHeaderTitle'?title:selector==='#adventureHeaderMeta'?meta:selector==='.adventure-back-button'?back:null;}};
    const state={currentNodeId:'rest',completedNodes:{},rewardClaims:{},branchSelections:{},chapterCompleted:false};
    const view={panel:'map',chapter:{title:'山關初行',suggestedLevel:10,nodes:[{id:'rest',type:'rest',title:'山路驛站',x:50,y:50}],routes:[],hiddenNodes:[]},state};
    const document={readyState:'loading',addEventListener(){},getElementById(id){return id==='adventurePage'?root:null;}};
    const window={FourSymbolsAdventure:{getView:()=>view,getNodeStatus:()=>'current'}};
    const context={window,document};vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/adventure/adventure-content-v1-20260915.js','utf8'),context);
    vm.runInContext(fs.readFileSync('js/adventure/adventure-ui-v1-20260915.js','utf8'),context);
    const render=window.FourSymbolsAdventureUI.render;
    render();assert.equal(body.scrollTop,0,'the canonical fixed map cannot retain a retired scroll offset');
    view.panel='rest';render();assert.equal(body.scrollTop,0,'a long map offset cannot hide the new inner title');
    body.scrollTop=120;state.completedNodes.rest={completedAt:1};render();
    assert.equal(body.scrollTop,120,'an update to the same inner page preserves reading position');
    view.panel='event-result';render();assert.equal(body.scrollTop,0,'changing between inner pages starts at the new title');
    view.panel='map';render();assert.equal(body.scrollTop,0,'returning to the fixed map starts at its canonical viewport');
    body.scrollTop=950;render();assert.equal(body.scrollTop,0,'map rerender cannot inherit an inner page offset');
    view.panel='story';view.tutorial={active:true};render();
    assert.equal(back.hidden,true,'active onboarding does not offer a return rejected by the runtime guard');
    view.tutorial.active=false;render();
    assert.equal(back.hidden,false,'a story reader whose formal guard allows returning gets the original return control');
    view.tutorial.active=true;view.panel='rest';render();
    assert.equal(back.hidden,false,'leaving the story restores the original page-header control');
});

test('tutorial return reuses one button in the active system flow and hides it outside the tutorial systems',()=>{
    const nodes=[];
    const make=()=>{const n={children:[],parentElement:null,appendChild(child){if(child.parentElement){const a=child.parentElement.children;a.splice(a.indexOf(child),1);}this.children.push(child);child.parentElement=this;}};nodes.push(n);return n;};
    const host=make(),modal=make(),inventory=make();let returns=0;
    const tutorial={active:true,requiredAction:'skill'};
    const document={readyState:'loading',addEventListener(){},createElement:make,
        getElementById(id){return id==='game-ui'?host:nodes.find(n=>n.id===id)||null;},
        querySelector(selector){return selector==='#inventoryPage .inventory-classic-shell'?inventory:selector==='#homeFeatureModal.show .home-feature-modal-box'?modal:null;}};
    const window={FourSymbolsAdventure:{getView:()=>({tutorial}),returnFromTutorial(){returns++;}},FourSymbolsAdventureContent:{}};
    const context={window,document};vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/adventure/adventure-ui-v1-20260915.js','utf8'),context);
    const sync=window.FourSymbolsAdventureUI.syncTutorialReturn;
    sync('skill');const button=document.getElementById('adventureTutorialReturn');
    assert.equal(button.parentElement,modal);assert.equal(button.hidden,false);
    sync('skill');assert.equal(nodes.filter(n=>n.id==='adventureTutorialReturn').length,1);
    for(const action of ['equipment','recovery']){tutorial.requiredAction=action;sync('inventory');assert.equal(button.parentElement,inventory);assert.equal(button.hidden,false);}
    tutorial.requiredAction='equipment';sync('shop');
    assert.equal(button.parentElement,modal,'the original shop modal owns its borrowed return, not the hidden inventory');
    assert.equal(button.hidden,false);
    button.onclick();assert.equal(returns,1,'the original button delegates to the runtime return Owner');
    sync('adventure');assert.equal(button.hidden,true);
    tutorial.active=false;sync('inventory');assert.equal(button.hidden,true);
    window.FourSymbolsAdventure.getView=()=>{throw Error('Unrelated modal close must not read adventure state');};
    assert.doesNotThrow(()=>sync('home'));assert.equal(button.hidden,true);
    assert.equal(nodes.filter(n=>n.id==='adventureTutorialReturn').length,1);
});
