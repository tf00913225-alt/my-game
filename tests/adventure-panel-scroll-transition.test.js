const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('adventure opens a different inner page at its title and preserves same-page/map positions',()=>{
    const body={innerHTML:'<div class="adventure-map-canvas"></div>',scrollTop:900,
        querySelector(selector){return selector==='.adventure-map-canvas'&&this.innerHTML.includes('class="adventure-map-canvas"')?{}:null;}};
    const title={},meta={};
    const root={isConnected:true,querySelector(selector){return selector==='#adventureView'?body:selector==='#adventureHeaderTitle'?title:selector==='#adventureHeaderMeta'?meta:null;}};
    const state={currentNodeId:'rest',completedNodes:{},rewardClaims:{},branchSelections:{},chapterCompleted:false};
    const view={panel:'map',chapter:{title:'山關初行',suggestedLevel:10,nodes:[{id:'rest',type:'rest',title:'山路驛站',x:50,y:50}],routes:[],hiddenNodes:[]},state};
    const document={readyState:'loading',addEventListener(){},getElementById(id){return id==='adventurePage'?root:null;}};
    const window={FourSymbolsAdventure:{getView:()=>view,getNodeStatus:()=>'current'},FourSymbolsAdventureContent:{}};
    const context={window,document};vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/adventure/adventure-ui-v1-20260915.js','utf8'),context);
    const render=window.FourSymbolsAdventureUI.render;
    render();assert.equal(body.scrollTop,900,'initial map position remains');
    view.panel='rest';render();assert.equal(body.scrollTop,0,'a long map offset cannot hide the new inner title');
    body.scrollTop=120;state.completedNodes.rest={completedAt:1};render();
    assert.equal(body.scrollTop,120,'an update to the same inner page preserves reading position');
    view.panel='event-result';render();assert.equal(body.scrollTop,0,'changing between inner pages starts at the new title');
    view.panel='map';render();assert.equal(body.scrollTop,900,'returning to the map restores its own saved position');
    body.scrollTop=950;render();assert.equal(body.scrollTop,950,'map rerender keeps the latest position');
});
