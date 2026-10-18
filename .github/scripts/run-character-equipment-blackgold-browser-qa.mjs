import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,findChrome,waitJson,Cdp,collectStartupFailure} from './runtime-browser-qa-support.mjs';

// Local production bundles and real UI/transfer/save Owners. Only the existing
// disposable account transport is used; it rejects all external cloud writes.
// Fixture equipment/party below exist only in the fresh browser profile.
const out=process.env.CHARACTER_EQUIPMENT_QA_OUTPUT||'artifacts/character-equipment-blackgold';
fs.mkdirSync(out,{recursive:true});
const local=await startServer();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'character-equipment-qa-'));
const port=9900+Math.floor(Math.random()*200);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const results=[];let c,phase='launch';
const wait=expression=>c.eval(`(async()=>{const end=Date.now()+45000;while(!(${expression})&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(!(${expression}))throw Error('Character equipment QA timeout');return true;})()`);
async function tap(selector){
    const point=await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control: '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(e.disabled||!hit||!(e===hit||e.contains(hit)))throw Error('Control obstructed: '+${JSON.stringify(selector)}+' by '+hit?.id);return {x,y};})()`);
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1}]});
    await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await c.eval('new Promise(r=>setTimeout(r,120))');
}
const model=`JSON.stringify({player,player2,player3,equipment:characterEquipment,items:inventoryItems})`;
const resources=`(()=>({shown:[...document.querySelectorAll('#inventoryStats b')].map(e=>e.textContent),expected:[getBackpackCharacterStats(inventoryCharacterIndex).maxHP,getBackpackCharacterStats(inventoryCharacterIndex).maxSP].map(String)}))()`;
const visualGeometry=`(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const ui=document.getElementById('game-ui'),scale=ui.getBoundingClientRect().width/ui.offsetWidth;
    const summary=document.getElementById('inventoryCharacterSummary'),frame=document.getElementById('inventoryPortraitFrame'),image=frame.querySelector('img.v131-inventory-portrait'),grid=document.getElementById('equipmentGrid');
    const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
    const leaves=[...summary.querySelectorAll('*')].filter(e=>!e.children.length&&e.textContent.trim()&&visible(e));
    return {scale,summary:rect(summary),summaryClientHeight:summary.clientHeight,summaryScrollHeight:summary.scrollHeight,grid:rect(grid),frame:rect(frame),
        portrait:image?{rect:rect(image),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,complete:image.complete,objectFit:getComputedStyle(image).objectFit,objectPosition:getComputedStyle(image).objectPosition}:null,
        text:leaves.map(e=>({text:e.textContent,rect:rect(e),fontSize:parseFloat(getComputedStyle(e).fontSize),visualFontSize:parseFloat(getComputedStyle(e).fontSize)*scale})),
        typography:[...document.querySelectorAll('#inventoryCharacterTabs .inventory-character-name span,#inventoryCharacterTabs small,#inventoryCharacterSummary h3,#inventoryCharacterSummary p,#inventoryStats span,#inventoryStats b,#equipmentGrid .inventory-equipment-slot-label,#equipmentGrid .equipment-rarity-name,#inventoryCharacterDetailButton')].filter(visible).map(e=>({text:e.textContent,visualFontSize:parseFloat(getComputedStyle(e).fontSize)*scale})),
        equipmentCells:[...grid.querySelectorAll('.inventory-equipment-cell')].map(cell=>{const label=cell.querySelector('.inventory-equipment-slot-label'),slot=cell.querySelector('.inventory-equipment-slot');return {cell:rect(cell),slot:rect(slot),label:rect(label),text:label.textContent,lineHeight:parseFloat(getComputedStyle(label).lineHeight)*scale};}),
        controls:[...grid.querySelectorAll('.has-item'),document.getElementById('inventoryCharacterDetailButton')].map(e=>{const r=rect(e),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {label:e.title||e.getAttribute('aria-label'),rect:r,hit:!!hit&&(e===hit||e.contains(hit))};})};
})()`;
function assertVisualGeometry(g){
    const inside=(a,b)=>a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
    assert.ok(g.portrait?.complete&&g.portrait.naturalWidth>0&&g.portrait.naturalHeight>0,'formal portrait must decode');
    assert.equal(g.portrait.objectFit,'contain');
    assert.ok(inside(g.portrait.rect,g.frame),'portrait element must not overflow its clipping frame: '+JSON.stringify(g));
    assert.ok(g.summaryScrollHeight<=g.summaryClientHeight+1,'summary content must fit without clipping: '+JSON.stringify(g));
    assert.ok(g.summary.bottom<=g.grid.top+1||g.summary.top>=g.grid.bottom-1||g.summary.right<=g.grid.left+1||g.summary.left>=g.grid.right-1,'summary cannot intersect equipment row');
    for(const text of g.text){assert.ok(inside(text.rect,g.summary),'summary child escapes its frame: '+JSON.stringify(text));assert.ok(text.visualFontSize>=12.95,'actual summary text must be at least 13px: '+JSON.stringify(text));}
    g.typography.forEach(text=>assert.ok(text.visualFontSize>=12.95,'actual character/equipment text must be at least 13px: '+JSON.stringify(text)));
    assert.equal(g.equipmentCells.length,6);
    const slotHeight=g.equipmentCells[0].slot.height;
    for(const cell of g.equipmentCells){
        assert.ok(Math.abs(cell.slot.width-cell.slot.height)<=1,'equipment slot must stay square: '+JSON.stringify(cell));
        assert.ok(Math.abs(cell.slot.height-slotHeight)<=1,'six equipment slots must keep the same height: '+JSON.stringify(cell));
        assert.ok(Number.isFinite(cell.lineHeight)&&cell.label.height+0.5>=cell.lineHeight,'equipment label must not flex below its line height: '+JSON.stringify(cell));
        assert.ok(inside(cell.label,cell.cell)&&inside(cell.label,g.grid),'equipment label must fit cell and grid: '+JSON.stringify(cell));
    }
    g.controls.forEach(control=>assert.equal(control.hit,true,'equipment/detail touch hit obstructed: '+JSON.stringify(control)));
}
try{
    const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');
    c=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__characterQaErrors=[];addEventListener('error',e=>__characterQaErrors.push(e.message));"});
    for(const [width,height] of [[360,800],[390,844],[412,915]]){
        phase='startup-'+width;
        await c.send('Storage.clearDataForOrigin',{origin:new URL(local.url).origin,storageTypes:'local_storage'});
        await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});
        await c.send('Page.navigate',{url:local.url});
        await wait("window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')");
        await c.eval(`(async()=>{closeHomeFeature();await FourSymbolsFeatures.ensure('inventory','character-equipment-qa');showPage('inventory');
            player2={...player,id:'裝備驗收乙',element:'water',vitality:23,energy:19,bonusHP:137,bonusSP:83,activeBuffs:[],statusEffects:[]};player3=null;
            const slots=['head','hand','shoulder','armor','shoes'],types=['head','weapon','shoulder','armor','shoes'];
            characterEquipment[getPartyCharacterKey(1)]={head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
            characterEquipment[getPartyCharacterKey(0)].ring=null;
            window.__characterQaGear={};slots.forEach((slot,i)=>{const item=v17346GenerateEquipment(()=>0,{slot:types[i],classType:'warrior',rarity:['white','blue','purple','orange','white'][i]});characterEquipment[getPartyCharacterKey(0)][slot]=item;__characterQaGear[slot]=item.v141Uid;});
            inventoryItems.splice(0,inventoryItems.length);inventoryCharacterIndex=0;renderInventory();})();`);
        phase='read-and-switch-'+width;
        const before=await c.eval(model);
        const first=await c.eval(resources);assert.deepEqual(first.shown,first.expected,'HP/SP must come from formal getter');
        assert.equal(await c.eval("document.querySelectorAll('#equipmentGrid .inventory-equipment-cell').length"),6,'all six formal equipment slots remain rendered');
        assert.equal(await c.eval("document.querySelectorAll('#equipmentGrid .has-item').length"),5,'five generated catalog slots and empty ring remain distinct');
        await wait("[...document.querySelectorAll('#inventoryPortraitFrame img,#equipmentGrid img')].every(image=>image.complete&&image.naturalWidth>0)");
        const visual=await c.eval(visualGeometry);assertVisualGeometry(visual);
        // Every worn part must open its own real detail dialog by touch.
        for(let i=1;i<=5;i++){
            await tap('#equipmentGrid .inventory-equipment-cell:nth-child('+i+') .has-item');
            assert.equal(await c.eval("document.getElementById('itemModal').classList.contains('show')"),true);
            await tap('#itemModal .close-item-button');
        }
        await tap('#inventoryCharacterTabs button[aria-label="下一個角色"]');
        assert.equal(await c.eval('inventoryCharacterIndex'),1);
        const second=await c.eval(resources);assert.deepEqual(second.shown,second.expected);
        assert.notDeepEqual(second.expected,first.expected,'fixture subjects must have different real resource maxima');
        assert.equal(await c.eval("document.querySelectorAll('#equipmentGrid .has-item').length"),0,'second character must not inherit first gear');
        await tap('#inventoryCharacterTabs button[aria-label="上一個角色"]');
        assert.equal(await c.eval(model),before,'display and switching must not mutate player/equipment data');
        await tap('#inventoryCharacterDetailButton');
        assert.equal(await c.eval("document.getElementById('inventoryCharacterDetailModal').classList.contains('show')"),true);
        await tap('#inventoryCharacterDetailModal .close-item-button');
        assert.equal(await c.eval(model),before,'reading details must not mutate game data');
        phase='equipment-transfer-'+width;
        await tap('#equipmentGrid .inventory-equipment-cell:first-child .has-item');
        assert.equal(await c.eval("document.getElementById('itemEquipButton').textContent.trim()"),'脫下');
        await tap('#itemEquipButton');
        assert.equal(await c.eval("characterEquipment[getPartyCharacterKey(0)].head===null"),true,'formal unequip must clear correct slot');
        assert.equal(await c.eval("inventoryItems.filter(i=>i.v141Uid===__characterQaGear.head).length"),1,'unequip must preserve one physical instance');
        await tap('#inventoryCategoryTabs [data-filter="equipment"]');
        await tap('#inventoryGrid .inventory-item-classic:not(.empty)');
        assert.equal(await c.eval("document.getElementById('itemEquipButton').textContent.trim()"),'穿戴');
        await tap('#itemEquipButton');
        assert.equal(await c.eval("characterEquipment[getPartyCharacterKey(0)].head?.v141Uid===__characterQaGear.head"),true);
        assert.equal(await c.eval("inventoryItems.some(i=>i.v141Uid===__characterQaGear.head)"),false);
        assert.equal(await c.eval("FourSymbolsEquipmentFactory.validateOwnership(inventoryItems,characterEquipment)!==false"),true);
        const afterTransfer=await c.eval(resources);assert.deepEqual(afterTransfer.shown,afterTransfer.expected);
        phase='backpack-'+width;
        // Overflow fixture uses the real inventory renderer and gesture owner.
        await c.eval("inventoryItems.push(...Array.from({length:80},(_,i)=>({id:'qa-character-material-'+i,name:'驗收材料'+i,type:'material',rarityKey:'white',count:1})));renderInventory();");
        await tap('#inventoryCategoryTabs [data-filter="material"]');
        const bag=await c.eval(`(()=>{const e=document.getElementById('inventoryGridScroll');return {count:document.getElementById('inventoryGrid').children.length,client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY,owner:FourSymbolsGestureArbiter.findScrollOwner(e)?.node.id};})()`);
        assert.ok(bag.count>0);assert.ok(bag.client>0);assert.ok(['auto','scroll'].includes(bag.overflow));
        if(bag.scroll>bag.client+1){
            assert.equal(bag.owner,'inventoryGridScroll');
            const r=await c.eval("(()=>{const r=inventoryGridScroll.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.7};})()");
            await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});
            for(let i=1;i<=6;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x,y:r.y-i*14}]});
            await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            assert.ok(await c.eval('inventoryGridScroll.scrollTop>0'),'single-finger backpack scroll remains usable');
        }
        await tap('#inventoryRefreshButton');
        await tap('#inventoryCategoryTabs [data-filter="equipment"]');
        const geometry=await c.eval(`(()=>{const page=document.getElementById('inventoryPage'),summary=document.getElementById('inventoryCharacterSummary');return {roots:document.querySelectorAll('#inventoryPage').length,summaryCount:document.querySelectorAll('#inventoryCharacterSummary').length,horizontalOverflow:page.scrollWidth>page.clientWidth+1,summaryWidth:summary?.getBoundingClientRect().width,errors:__characterQaErrors};})()`);
        assert.equal(geometry.roots,1);assert.equal(geometry.summaryCount,1);assert.equal(geometry.horizontalOverflow,false);assert.deepEqual(geometry.errors,[]);
        const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`character-equipment-${width}x${height}.png`),Buffer.from(shot.data,'base64'));
        await tap('#inventoryPage .map-inventory-overlay-close');
        assert.equal(await c.eval("document.getElementById('inventoryPage').classList.contains('active')"),false,'original return control remains functional');
        results.push({width,height,first,second,afterTransfer,bag,geometry,visual});
        console.log('PASS character equipment',width,height);
    }
    fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({passed:true,commitSha:process.env.GITHUB_SHA||'local',transport:'isolated local account; cloud mutations forbidden',results},null,2));
}catch(error){
    const diagnostics=c?await collectStartupFailure(c,{phase}):{phase};
    if(c)try{diagnostics.visual=await c.eval(visualGeometry);}catch{}
    fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({passed:false,error:String(error.stack||error),results,diagnostics},null,2));throw error;
}finally{c?.close();proc.kill();await new Promise(resolve=>local.server.close(resolve));}
