"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const authoredUiCss=require("../.github/scripts/fixtures/native-ui-css-contract.cjs");
const vm=require("node:vm");

const rpgUi=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const relicCss=authoredUiCss(fs.readFileSync("css/55-team-relic-system.css","utf8"));
const relicRuntime=fs.readFileSync("js/60-team-relic-system.js","utf8");
const abyss=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");

assert.match(rpgUi,/confirmButton\.className="v169-rpg-dialog-button secondary"/,
    "normal RPG confirmation must inherit the same dark gradient as the cancel button");
assert.match(rpgUi,/primary:supplied\.primary===true/,
    "only an explicit primary boolean may opt into the emphasized confirmation");
assert.match(rpgUi,/confirmButton\.classList\.toggle\("primary",options\.primary\|\|options\.tone==="danger"\)/,
    "normal confirmation stays dark; explicit primary actions and danger confirmations are emphasized");
assert.match(rpgUi,/confirmButton\.classList\.toggle\("danger",options\.tone==="danger"\)/);
assert.doesNotMatch(rpgUi,/confirmButton\.className="v169-rpg-dialog-button primary"/);

// Execute the public dialog entry for each tone. A new default dialog must
// clear the previous danger/primary state, including on a reused modal.
const created=[];
const document={readyState:"loading",activeElement:null,addEventListener(){},getElementById(){return null;}};
document.createElement=tag=>{
    const classes=new Set(),listeners={};
    const node={tagName:tag,dataset:{},children:[],isConnected:true,
        classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},
        setAttribute(){},focus(){},addEventListener:(type,fn)=>{listeners[type]=fn;},
        click(){listeners.click();},appendChild(child){this.children.push(child);return child;},
        append(...children){children.forEach(child=>this.appendChild(child));},querySelector(){return null;},querySelectorAll(){return [];}
    };
    created.push(node);return node;
};
document.body=document.createElement("body");
const context=vm.createContext({document,console,Promise,FourSymbolsAccountSave:{accountKey:name=>"test-uid:"+name}});
context.window=context;
vm.runInContext(rpgUi,context);
for(const [options,primary,danger] of [[{},false,false],[{danger:true},true,true],[{},false,false],[{primary:true},true,false],[{primary:"true"},false,false]]){
    context.rpgConfirm("確認",options);
    const buttons=created.filter(node=>node.tagName==="button");
    const confirm=buttons[1];
    assert.equal(confirm.classList.contains("primary"),primary);
    assert.equal(confirm.classList.contains("danger"),danger);
    confirm.click();
}
assert.equal(created.filter(node=>node.id==="v169RpgDialogLayer").length,1,"all tones reuse one dialog layer");

assert.doesNotMatch(relicCss,/map-return\.png/);
assert.match(authoredUiCss(fs.readFileSync("css/56-v174-critical-ui-regressions.css","utf8")),/\.team-relic-home-tools\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\);[^}]*grid-row:2;/,'four lower tools retain their canonical city row');
assert.match(relicCss,/#statusHelpButton\{display:none!important;\}/, "relic modal hides status help");
assert.match(relicCss,/\.team-relic-modal:not\(\.team-relic-detail-mode\) \.home-feature-close-btn:not\(#statusHelpButton\)\{display:inline-flex!important;\}/,
    "only the real modal return button may be forced visible in relic list mode");
assert.match(relicCss,/\.team-relic-modal\.team-relic-detail-mode \.home-feature-close-btn\{display:none!important;\}/,
    "explicit detail mode removes the redundant modal return control");
assert.match(relicRuntime,/classList\.add\("team-relic-detail-mode"\)/,
    "detail runtime must explicitly enter relic detail mode before rendering the detail view");
assert.match(relicRuntime,/classList\.remove\("team-relic-detail-mode"\)/,
    "returning to the list must explicitly leave relic detail mode");
assert.match(relicCss,/#game-ui #homeFeatureModal\.team-relic-modal \.team-relic-detail-back\{[^}]*height:44px;[^}]*font-size:15px;/,
    "the native-stage return control must preserve its readable 15px label and 44px height");
assert.match(relicRuntime,/class="team-relic-detail-back" onclick="v174OpenRelicPage\(\)">‹ 返回秘寶列表<\/button>/,
    "the detail return label must come directly from its actionable button");
assert.doesNotMatch(relicCss,/\.team-relic-detail-back::after\{/,
    "the return label must not be duplicated by generated text");

assert.match(abyss,/function buildEncounterWaves\([\s\S]*?const first=Array\.from\(\{length:6\}/,
    "normal emperor stages must begin with the formal six-enemy first wave");
assert.match(abyss,/if\(bossStage\)\{ second\.push\(makeAbyssMonster\(region\.emperor,config,region,"smallBoss",stage,true\)\); \}[\s\S]*?while\(second\.length<6\)[\s\S]*?return \[first,second\];/,
    "normal emperor second wave must retain the fixed emperor plus five elites within six slots");
assert.doesNotMatch(abyss,/for\(let index=0;index<10;index\+\+\)/,
    "legacy one-boss plus nine-elite construction must be removed");
assert.match(abyss,/function buildTrueRealmFinalRoster\(config\)[\s\S]*?FINAL_TRUE_REALM_EMPERORS\.forEach\(definition=>\{[\s\S]*?FINAL_TRUE_REALM_LOADOUTS\[definition\.name\]/,
    "Lv40 final five emperors must retain their canonical fixed loadouts");
assert.match(abyss,/if\(final\)\{ return \[first,buildTrueRealmFinalRoster\(config\)\]; \}/,
    "Lv40 final five emperors must enter only the second wave");

console.log("✓ relic navigation, dialog button and Abyss boss polish tests passed");

require('node:test')('opening a relic from a scrolled list reveals its identity before the first detail paint',async()=>{
    const body={innerHTML:'list',scrollTop:1346};
    const nodes={body,modal:{classList:{contains:()=>true,add(){}}}};
    const painted=[];
    const sandbox={relicCatalog:{known:{id:'known'}},currentDetailId:null,
        prepareRelicModal:()=>nodes,renderRelicLoading(){},
        prepareRelicVisuals:()=>Promise.resolve(),detailMarkup:()=>'<h2>秘寶名稱</h2>',
        nextVisualPaint:async()=>{painted.push({scrollTop:body.scrollTop,markup:body.innerHTML});},
        window:{},performance:{mark(){}},document:{dispatchEvent(){}},CustomEvent:function(){}};
    const start=relicRuntime.indexOf('function openRelicDetail(id)');
    const end=relicRuntime.indexOf('function renderRelicPage(',start);
    const open=vm.runInNewContext('('+relicRuntime.slice(start,end).trim()+')',sandbox);
    assert.equal(open('missing'),false);
    assert.equal(body.scrollTop,1346,'an invalid detail must leave the current list intact');
    assert.equal(open('known'),true);
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(painted,[{scrollTop:0,markup:'<h2>秘寶名稱</h2>'}],
        'detail identity must be visible before paint, without a later corrective scroll');
});
