"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
(async()=>{
const {findChrome}=await import("../.github/scripts/runtime-browser-qa-support.mjs");
const css=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const directory=fs.mkdtempSync(path.join(os.tmpdir(),"portrait-row-clearance-")),fixture=path.join(directory,"fixture.html");
const markup=`<!doctype html><html><head><style>${css}</style><style>
html,body{margin:0}#game-stage{width:420px}#battlePage{height:360px}.battle-ally-region{height:100%}.v174-portrait-paint{animation:none!important}
</style></head><body><div id="game-stage"><div id="app"><div id="game-content"><div id="battlePage" class="v-fixed-slot-render-v2"><section class="battle-ally-region"><div id="battlePlayerRow" class="v-fixed-ally-zone"></div></section></div></div></div></div><pre id="result"></pre><script>
const zone=document.getElementById('battlePlayerRow');
for(const rowName of ['front','back']){const row=document.createElement('div');row.className='v-fixed-ally-slot-row';row.dataset.slotRow=rowName;for(let col=1;col<=3;col++){const slot=document.createElement('div');slot.className='v-fixed-ally-slot';slot.dataset.slot='ALLY_'+(rowName==='front'?'F':'B')+col;row.appendChild(slot);}zone.appendChild(row);}
function card(slot){const node=document.createElement('div');node.className='battle-player';node.innerHTML='<div class="v174-battle-art"><div class="v174-action-motion"><div class="v174-portrait-paint"></div></div></div>';slot.appendChild(node);return node;}
function snapshot(){return Array.from(zone.querySelectorAll('[data-slot-row="back"] > div')).map(slot=>{const unit=slot.firstElementChild,art=unit.firstElementChild,rect=art.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,depth:getComputedStyle(art).scale,unitBottom:unit.getBoundingClientRect().bottom,contain:getComputedStyle(art.querySelector('.v174-portrait-paint')).backgroundSize};});}
const cases=[];
for(const height of [280,360,440]){document.getElementById('battlePage').style.height=height+'px';zone.querySelectorAll('.battle-player').forEach(node=>node.remove());zone.querySelectorAll('[data-slot-row="back"] > div').forEach(card);const empty=snapshot(),fronts=Array.from(zone.querySelectorAll('[data-slot-row="front"] > div'));for(let i=0;i<3;i++){const node=card(fronts[i]),occupied=snapshot(),frontBottom=node.getBoundingClientRect().bottom;cases.push({height,col:i,empty,occupied,frontBottom});node.remove();}cases.push({height,restored:snapshot(),empty});}
document.getElementById('result').textContent=JSON.stringify(cases);
</script></body></html>`;
try{
    fs.writeFileSync(fixture,markup);
    const result=spawnSync(findChrome(),["--headless=new","--no-sandbox","--disable-gpu","--no-first-run","--user-data-dir="+path.join(directory,"profile"),"--dump-dom","file:///"+fixture.replace(/\\/g,"/")],{encoding:"utf8",timeout:30000,maxBuffer:2e6});
    assert.equal(result.status,0,result.stderr);
    const match=result.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(match,"browser must return actual CSS geometry");
    const cases=JSON.parse(match[1]);assert.equal(cases.length,12);
    for(const item of cases){
        if(item.restored){assert.deepEqual(item.restored,item.empty,"removing the foreground occupant restores the original silhouette");continue;}
        item.occupied.forEach((box,index)=>{
            const old=item.empty[index];
            assert.equal(box.depth,old.depth,"safety cap must not reset the approved depth");
            assert.equal(box.contain,"contain","source proportions remain intact");
            assert.ok(Math.abs(box.bottom-old.bottom)<.1,"portrait feet must stay fixed");
            assert.ok(Math.abs(box.width-old.width)<.1,"horizontal extent must not change");
            if(index===item.col){assert.ok(box.top>=item.frontBottom+5.8,"same-column rear portrait must leave real foreground HUD/idle clearance");assert.ok(box.height<old.height,"the demonstrated vertical collision must actually be constrained");}
            else assert.deepEqual(box,old,"other columns, including approved mixed formation, must remain unchanged");
        });
    }
    console.log("Portrait occupied-row clearance: 3 heights x 3 columns, empty/restored geometry PASS");
}finally{
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("portrait-row-clearance-"));
    fs.rmSync(directory,{recursive:true,force:true});
}
})().catch(error=>{console.error(error);process.exitCode=1;});
