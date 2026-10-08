"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const rpgUi=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
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
assert.match(fs.readFileSync("css/56-v174-critical-ui-regressions.css","utf8"),/\.team-relic-home-tools\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[^}]*width:100%;[^}]*gap:12px;/);
assert.match(relicCss,/#statusHelpButton,\s*\n#game-ui #homeFeatureModal\.team-relic-modal #skillPreviewHeaderButton\{display:none!important;\}/,
    "relic modal must never expose the character status-help or all-skill-preview header controls");
assert.match(relicCss,/\.team-relic-modal:not\(\.team-relic-detail-mode\) \.home-feature-close-btn:not\(#statusHelpButton\):not\(#skillPreviewHeaderButton\)\{display:inline-flex!important;\}/,
    "only the real modal return button may be forced visible in relic list mode");
assert.match(relicCss,/\.team-relic-modal\.team-relic-detail-mode \.home-feature-close-btn\{display:none!important;\}/,
    "explicit detail mode removes the redundant modal return control");
assert.match(relicRuntime,/classList\.add\("team-relic-detail-mode"\)/,
    "detail runtime must explicitly enter relic detail mode before rendering the detail view");
assert.match(relicRuntime,/classList\.remove\("team-relic-detail-mode"\)/,
    "returning to the list must explicitly leave relic detail mode");
assert.match(relicCss,/#game-ui #homeFeatureModal\.team-relic-modal \.team-relic-detail-back\{[^}]*font-size:0!important/,
    "the original detail button text must be suppressed with enough specificity to beat shared button CSS");
assert.match(relicCss,/#game-ui #homeFeatureModal\.team-relic-modal \.team-relic-detail-back::after\{content:"返回秘寶列表";[^}]*font-size:15px/,
    "the detail return label must have exactly one visible 15px action source");

assert.match(abyss,/for\(let position=0;position<5;position\+\+\)[\s\S]*?for\(let position=1;position<=3;position\+\+\)/,
    "normal emperor stages must keep the five-slot front row and only three centered rear elites");
assert.doesNotMatch(abyss,/for\(let index=0;index<10;index\+\+\)/,
    "legacy one-boss plus nine-elite construction must be removed");
assert.match(abyss,/function buildTrueRealmFinalRoster\(config\)[\s\S]*?for\(let position=0;position<5;position\+\+\)/,
    "Lv40 true-realm final five-emperor formation remains separately owned and unchanged");

console.log("✓ relic navigation, dialog button and Abyss boss polish tests passed");
