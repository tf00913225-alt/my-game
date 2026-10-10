'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');
const ids=['homePage','inventoryPage','homeFeatureModal','itemModal','inventoryCharacterDetailModal','skillDetailModal','statusHelpModal'];
test('all seven general surfaces migrate once to the browser boundary and preserve lifecycle',()=>{
 const source=read('js/00-main.js'),owner=source.slice(source.indexOf('(function setupBrowserGameUi()'),source.indexOf('/* Legacy V3 navigation'));
 const nodes=Object.fromEntries(ids.map(id=>[id,{id}]));let ui,observer;
 nodes.gameInterface={style:{display:'none'}};
 const context={document:{createElement:()=>ui={dataset:{},appendChild(n){n.parent=this;}},body:{appendChild(){}},getElementById:id=>nodes[id]},MutationObserver:class{constructor(f){observer=f}observe(){}}};
 vm.runInNewContext(owner,context);
 assert.equal(ui.id,'game-ui');assert.equal(ui.dataset.presentationDomain,'browser');
 for(const id of ids)assert.equal(nodes[id].parent,ui,id);
 assert.ok(ui.hidden);nodes.gameInterface.style.display='block';observer();assert.equal(ui.hidden,false);
 assert.doesNotMatch(owner,/transform|scale|game-stage/);
});
test('migrated IDs cannot regain stage-only presentation selectors, including injected CSS',()=>{
 const files=['index.html',...['css','js'].flatMap(dir=>fs.readdirSync(dir).filter(f=>/\.(css|js)$/.test(f)).map(f=>path.join(dir,f)))];
 const forbidden=new RegExp('#game-stage\\s+(?:[^{};\\n]*\\s)?#(?:'+ids.join('|')+'|characterTabContent)\\b');
 for(const file of files){const source=read(file).replace(/\/\*[\s\S]*?\*\//g,'');assert.doesNotMatch(source,forbidden,file);assert.doesNotMatch(source,/#game-stage\s+\.home-bg-fixed-layer\b/,file);}
});
test('the main-city owner has one canonical background and no old fallback',()=>{
 const css=read('css/00-main.css');
 assert.match(css,/\.home-bg-fixed-layer\{[^}]*background-image:url\(\.\.\/assets\/ui\/home-background-v17344\.png\)/);
 assert.doesNotMatch(css,/home-background\.jpg/);
 assert.doesNotMatch(read('css/46-v154-dev-fixes.css'),/\.home-bg-fixed-layer/);
});
test('character header rows cannot shrink behind their controls; content owns scroll',()=>{
 const css=read('css/49-v169-rpg-ui.css');
 for(const cls of ['character-showcase-row','character-tab-row'])assert.match(css,new RegExp('\\.'+cls+'\\{[^}]*flex:0 0 auto'));
 assert.match(read('js/00-main.js'),/class="character-tab-row"/);
 assert.match(css,/#characterTabContent\{[^}]*overflow-x:hidden !important;[^}]*overflow-y:auto !important;/);
});
