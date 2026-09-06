from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start=text.find(start_marker)
    if start<0:
        raise SystemExit(f"missing start: {label}")
    end=text.find(end_marker,start)
    if end<0:
        raise SystemExit(f"missing end: {label}")
    return text[:start]+replacement+text[end:]

# ---------------------------------------------------------------------------
# Equipment progression: reforgeSlots are AFFINX SLOT COUNT, not attempt count.
# Reforging is unlimited; old reforgeUsed data no longer consumes eligibility.
# ---------------------------------------------------------------------------
p=Path('js/equipment-progression.js')
s=p.read_text(encoding='utf-8')

old='''        item.reforgeSlots=Math.max(1,Math.floor(Number(item.reforgeSlots)||0));\n        const hasRecordedUse=Object.prototype.hasOwnProperty.call(item,"reforgeUsed");\n        const migratedUse=hasRecordedUse\n            ?Math.max(0,Math.floor(Number(item.reforgeUsed)||0))\n            :(item.reforgeStats&&Object.keys(item.reforgeStats).length?1:0);\n        item.reforgeUsed=Math.min(item.reforgeSlots,migratedUse);\n'''
new='''        const legacyAffixCount=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;\n        item.reforgeSlots=Math.max(1,legacyAffixCount,Math.floor(Number(item.reforgeSlots)||0));\n        // V173.58: reforgeUsed is retained only for old-save compatibility.\n        // Reforging is now unlimited; reforgeSlots means affix-slot count.\n        item.reforgeUsed=0;\n'''
s=replace_once(s,old,new,'set-rule reforge migration')

old='''    function remainingReforgeSlots(item){\n        return Math.max(0,Math.floor(Number(item&&item.reforgeSlots)||0)-Math.floor(Number(item&&item.reforgeUsed)||0));\n    }\n'''
new='''    function remainingReforgeSlots(item){\n        if(!item){ return 0; }\n        const explicit=Math.max(0,Math.floor(Number(item.reforgeSlots)||0));\n        const existing=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;\n        return Math.max(explicit,existing);\n    }\n'''
s=replace_once(s,old,new,'remaining reforge slots')

# Replace the old additive/one-use wrapper with an unlimited compatibility guard.
start='''    if(typeof window.v141StartReforge==="function"){\n        const previousStartReforge=window.v141StartReforge;\n'''
end='''    function statLine(item){\n'''
replacement=r'''    if(typeof window.v141StartReforge==="function"){
        const previousStartReforge=window.v141StartReforge;
        window.v141StartReforge=function(){
            const item=selectedReforgeItem();
            if(!item||remainingReforgeSlots(item)<=0){
                if(typeof window.rpgAlert==="function"){ void window.rpgAlert("這件裝備沒有冶煉槽。",{title:"無法冶煉"}); }
                else{ alert("這件裝備沒有冶煉槽。"); }
                return false;
            }
            return previousStartReforge.apply(this,arguments);
        };
    }
    if(typeof window.v141ResolveReforge==="function"){
        const previousResolveReforge=window.v141ResolveReforge;
        window.v141ResolveReforge=function(){
            // V173.58: do not merge old/new affixes and never consume an attempt.
            // js/36 owns replacement + locked-affix preservation.
            return previousResolveReforge.apply(this,arguments);
        };
    }

'''
s=replace_between(s,start,end,replacement,'legacy reforge wrapper')
p.write_text(s,encoding='utf-8')

# ---------------------------------------------------------------------------
# Synthesis/reforge authority.
# - Equipment tier no longer decides usable material tier.
# - Selected material tier decides roll ranges + gold cost.
# - Base material cost 50/50; one locked affix 100/100; two 150/150.
# - Unlimited rerolls. Every unlocked slot rerolls together.
# ---------------------------------------------------------------------------
p=Path('js/36-v141-content-systems.js')
s=p.read_text(encoding='utf-8')

old='''    const synthesisState={\n        tab:"reforge",blueprintId:null,seriesId:"setFire",reforgeUid:null,\n        talismanId:null,talismanQty:1,fragmentQty:{setFire:1,setWater:1,setEarth:1,setWind:1},\n        pendingReforge:null\n    };\n'''
new='''    const synthesisState={\n        tab:"reforge",blueprintId:null,seriesId:"setFire",reforgeUid:null,\n        reforgeMaterialTier:"low",lockedReforgeKeys:[],\n        talismanId:null,talismanQty:1,fragmentQty:{setFire:1,setWater:1,setEarth:1,setWind:1},\n        pendingReforge:null\n    };\n'''
s=replace_once(s,old,new,'synthesis state')

old='''    function canActuallyReforge(item){\n        if(!item||item.v17351Locked===true){ return false; }\n        if(typeof window.v17346RemainingReforgeSlots==="function"){\n            return window.v17346RemainingReforgeSlots(item)>0;\n        }\n        const slots=Math.max(0,Math.floor(Number(item.reforgeSlots)||0));\n        const used=Math.max(0,Math.floor(Number(item.reforgeUsed)||0));\n        return slots>used;\n    }\n'''
new=r'''    function reforgeSlotCount(item){
        if(!item){ return 0; }
        const explicit=Math.max(0,Math.floor(Number(item.reforgeSlots)||0));
        const existing=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;
        const slots=Math.max(explicit,existing);
        if(slots>explicit){ item.reforgeSlots=slots; }
        if(item.reforgeUsed){ item.reforgeUsed=0; }
        return slots;
    }
    function canActuallyReforge(item){
        return !!(item&&item.v17351Locked!==true&&reforgeSlotCount(item)>0);
    }
    function reforgeMaterialInfo(tierKey){
        const tier=TIER_META[tierKey]?tierKey:"low";
        const meta=TIER_META[tier];
        const ore=definitions().ores.find(item=>item.tierKey===tier)||null;
        const blueprintCount=countMatching(item=>item&&item.blueprintSlot&&item.tierKey===tier);
        const oreCount=ore?countItem(ore.id):0;
        return {tier,meta,ore,blueprintCount,oreCount};
    }
    function reforgeMaterialCost(lockCount){
        const locks=Math.max(0,Math.min(2,Math.floor(Number(lockCount)||0)));
        return locks===0?50:(locks===1?100:150);
    }
    function normalizeReforgeLocks(item){
        const current=item&&item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats):[];
        const maxLocks=Math.min(2,Math.max(0,reforgeSlotCount(item)-1));
        synthesisState.lockedReforgeKeys=(synthesisState.lockedReforgeKeys||[])
            .filter(key=>current.includes(key)).slice(0,maxLocks);
        return synthesisState.lockedReforgeKeys;
    }
'''
s=replace_once(s,old,new,'canActuallyReforge')

# Add the slot-aware reroll function while keeping rollAffixes() for crafting.
anchor='''    window.v141RollCraftAffixes=rollAffixes;\n\n'''
insert=r'''    window.v141RollCraftAffixes=rollAffixes;

    function reforgeRangeForSlot(tierKey,slotIndex){
        const meta=TIER_META[tierKey]||TIER_META.low;
        if(slotIndex<=0){ return meta.reforgeMain; }
        return meta.reforgeSub||meta.reforgeMain;
    }
    function reforgeRangeText(tierKey,slotCount){
        const meta=TIER_META[tierKey]||TIER_META.low;
        const main=meta.reforgeMain;
        const sub=meta.reforgeSub||meta.reforgeMain;
        return slotCount<=1
            ?"詞條 "+main[0]+"～"+main[1]
            :"主槽 "+main[0]+"～"+main[1]+"・其餘槽 "+sub[0]+"～"+sub[1];
    }
    function rollReforgeAffixes(item,tierKey,lockedKeys){
        const slots=reforgeSlotCount(item);
        const current=item&&item.reforgeStats&&typeof item.reforgeStats==="object"?item.reforgeStats:{};
        const result={};
        const used=new Set();
        const locks=(lockedKeys||[]).filter(key=>Object.prototype.hasOwnProperty.call(current,key)).slice(0,Math.min(2,Math.max(0,slots-1)));
        locks.forEach(key=>{ result[key]=current[key]; used.add(key); });
        const meta=TIER_META[tierKey]||TIER_META.low;
        const unlockedCount=Math.max(0,slots-locks.length);
        const forceDualPeak=locks.length===0&&slots>=2&&!!meta.reforgeSub&&Math.random()<.05;
        let generated=0;
        while(Object.keys(result).length<slots){
            const needMain=!Array.from(used).some(key=>MAIN_STATS.includes(key));
            const slotIndex=needMain?0:Math.max(1,Object.keys(result).length);
            let pool=needMain?MAIN_STATS:SUB_STATS;
            let available=pool.filter(key=>!used.has(key));
            if(!available.length){ available=MAIN_STATS.concat(SUB_STATS).filter(key=>!used.has(key)); }
            if(!available.length){ break; }
            const key=available[Math.floor(Math.random()*available.length)%available.length];
            const range=reforgeRangeForSlot(tierKey,slotIndex);
            let value;
            if(forceDualPeak&&generated<2){ value=range[1]; }
            else if(!meta.reforgeSub||slots===1){ value=rollSinglePeak(range); }
            else{ value=rollUniform(range[0],range[1]); }
            result[key]=value;
            used.add(key);
            generated++;
        }
        if(!forceDualPeak&&locks.length===0&&slots>=2&&meta.reforgeSub){
            const mainKey=Object.keys(result).find(key=>MAIN_STATS.includes(key));
            const subKey=Object.keys(result).find(key=>SUB_STATS.includes(key));
            if(mainKey&&subKey&&result[mainKey]===meta.reforgeMain[1]&&result[subKey]===meta.reforgeSub[1]){
                if(Math.random()<.5){ result[mainKey]=rollUniform(meta.reforgeMain[0],Math.max(meta.reforgeMain[0],meta.reforgeMain[1]-1)); }
                else{ result[subKey]=rollUniform(meta.reforgeSub[0],Math.max(meta.reforgeSub[0],meta.reforgeSub[1]-1)); }
            }
        }
        return result;
    }
    window.v17358RollReforgeAffixes=rollReforgeAffixes;

'''
s=replace_once(s,anchor,insert,'reforge roll helper anchor')

render_start='''    function renderReforgeTab(){\n'''
render_end='''    function availableTalismans(){\n'''
render_new=r'''    function renderReforgeTab(){
        const entries=allRefinableEquipment();
        if(!entries.length){ return '<div class="v141-synthesis-empty">沒有可冶煉的裝備。<small>只有具備至少 1 個冶煉槽、且未鎖定的裝備會出現在這裡。</small></div>'; }
        if(!entries.some(entry=>entry.item.v141Uid===synthesisState.reforgeUid)){
            synthesisState.reforgeUid=entries[0].item.v141Uid;
            synthesisState.lockedReforgeKeys=[];
        }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        const slotCount=reforgeSlotCount(item);
        const locks=normalizeReforgeLocks(item);
        const lockSet=new Set(locks);
        const maxLocks=Math.min(2,Math.max(0,slotCount-1));
        const tier=TIER_META[synthesisState.reforgeMaterialTier]?synthesisState.reforgeMaterialTier:"low";
        synthesisState.reforgeMaterialTier=tier;
        const material=reforgeMaterialInfo(tier);
        const materialCost=reforgeMaterialCost(locks.length);
        const currentEntries=Object.entries(item.reforgeStats||{});
        const can=!!material.ore&&material.blueprintCount>=materialCost&&material.oreCount>=materialCost&&gold>=material.meta.reforgeGold&&slotCount>locks.length;
        let compare="";
        if(synthesisState.pendingReforge&&synthesisState.pendingReforge.uid===item.v141Uid){
            const pending=synthesisState.pendingReforge;
            const pendingLabel=(TIER_META[pending.materialTier]||material.meta).label;
            compare='<div class="v141-reforge-compare"><section><small>目前冶煉效果</small>'+statsHtml(item.reforgeStats)+'</section><b>VS</b><section><small>本次新效果・'+pendingLabel+'材料</small>'+statsHtml(pending.stats)+'</section>'+
                '<div><button onclick="v141ResolveReforge(false)">保留原效果</button><button onclick="v141ResolveReforge(true)">套用新效果</button></div></div>';
        }
        const tierButtons=TIER_ORDER.map(key=>{
            const info=reforgeMaterialInfo(key);
            return '<button type="button" class="v17358-reforge-tier '+(key===tier?'active':'')+'" onclick="v141SelectReforgeMaterialTier(\''+key+'\')">'+
                '<b>'+info.meta.label+'材料</b><span>圖紙 '+info.blueprintCount+'・礦石 '+info.oreCount+'</span><small>'+reforgeRangeText(key,slotCount)+'</small></button>';
        }).join("");
        const lockHtml=currentEntries.length
            ?currentEntries.map(([key,value])=>{
                const selected=lockSet.has(key);
                return '<button type="button" class="v17358-affix-lock '+(selected?'locked':'')+'" '+(synthesisState.pendingReforge?'disabled':'')+' onclick="v141ToggleReforgeLock(\''+escapeHtml(key)+'\')">'+
                    '<span>'+(selected?'🔒':'◇')+'</span><b>'+escapeHtml(STAT_LABEL[key]||key)+' +'+value+'</b><small>'+(selected?'已鎖定':'點擊鎖定')+'</small></button>';
            }).join("")
            :'<div class="v17358-no-affix-lock">首次冶煉尚無詞條可鎖定。</div>';
        return '<div class="v141-synthesis-card v17358-reforge-card">'+
            '<label>選擇裝備<select onchange="v141SelectReforgeItem(this.value)">'+entries.map(entry=>
                '<option value="'+entry.item.v141Uid+'" '+(entry.item.v141Uid===item.v141Uid?'selected':'')+'>'+escapeHtml(entry.item.name)+'［'+entry.source+'］</option>'
            ).join("")+'</select></label>'+
            '<section class="v141-reforge-current"><b>'+escapeHtml(item.name)+'</b><small>冶煉槽 '+slotCount+' 格・可不限次數重洗</small><div><em>原始詞條</em>'+statsHtml(item.stats)+'</div><div><em>目前冶煉</em>'+statsHtml(item.reforgeStats)+'</div></section>'+
            '<section class="v17358-reforge-material"><div class="v17358-section-title"><b>選擇冶煉材料階級</b><span>裝備品質不限制材料；材料階級只決定本次數值範圍。</span></div><div class="v17358-reforge-tiers">'+tierButtons+'</div></section>'+
            '<section class="v17358-reforge-lock-panel"><div class="v17358-section-title"><b>鎖定詞條</b><span>最多鎖 2 條，且至少保留 1 個槽位重新冶煉。</span></div><div class="v17358-reforge-lock-list">'+lockHtml+'</div><small>目前鎖定 '+locks.length+' / '+maxLocks+' 條</small></section>'+
            '<div class="v141-material-lines v17358-reforge-cost"><span>設計圖 <b class="'+(material.blueprintCount>=materialCost?'ok':'lack')+'">'+material.blueprintCount+' / '+materialCost+'</b></span>'+
            '<span>'+escapeHtml(material.ore&&material.ore.name||material.meta.label+'礦石')+' <b class="'+(material.oreCount>=materialCost?'ok':'lack')+'">'+material.oreCount+' / '+materialCost+'</b></span>'+
            '<span>金幣 <b class="'+(gold>=material.meta.reforgeGold?'ok':'lack')+'">'+material.meta.reforgeGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<div class="v17358-reforge-cost-note">未鎖定：50 圖紙＋50 礦石・鎖 1 條：100＋100・鎖 2 條：150＋150</div>'+
            '<button type="button" class="v141-synthesis-primary" '+(can&&!synthesisState.pendingReforge?'':'disabled')+' onclick="v141StartReforge()">開始冶煉</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">ⓘ 冶煉規則</button>'+compare+'</div>';
    }

'''
s=replace_between(s,render_start,render_end,render_new,'renderReforgeTab')

old='''    window.v141SelectReforgeItem=function(uid){ synthesisState.reforgeUid=uid; synthesisState.pendingReforge=null; renderSynthesis(); };\n'''
new=r'''    window.v141SelectReforgeItem=function(uid){
        synthesisState.reforgeUid=uid;
        synthesisState.pendingReforge=null;
        synthesisState.lockedReforgeKeys=[];
        renderSynthesis();
    };
    window.v141SelectReforgeMaterialTier=function(tier){
        if(!TIER_META[tier]||synthesisState.pendingReforge){ return; }
        synthesisState.reforgeMaterialTier=tier;
        renderSynthesis();
    };
    window.v141ToggleReforgeLock=function(key){
        if(synthesisState.pendingReforge){ return; }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||!Object.prototype.hasOwnProperty.call(item.reforgeStats||{},key)){ return; }
        const locks=normalizeReforgeLocks(item).slice();
        const at=locks.indexOf(key);
        if(at>=0){ locks.splice(at,1); }
        else{
            const maxLocks=Math.min(2,Math.max(0,reforgeSlotCount(item)-1));
            if(locks.length>=maxLocks){
                alert(maxLocks<=0?"這件裝備只有 1 個冶煉槽，不能把唯一詞條鎖住。":"至少要保留 1 個未鎖定槽位才能重新冶煉。");
                return;
            }
            locks.push(key);
        }
        synthesisState.lockedReforgeKeys=locks;
        renderSynthesis();
    };
'''
s=replace_once(s,old,new,'reforge selection handlers')

show_start='''    window.v141ShowAffixInfo=function(){\n'''
show_end='''    window.v141CraftEquipment=function(){\n'''
show_new=r'''    window.v141ShowAffixInfo=function(){
        const lines=TIER_ORDER.map(tier=>'<div><b>'+TIER_META[tier].label+'材料</b>　'+reforgeRangeText(tier,2)+'　／　金幣 '+TIER_META[tier].reforgeGold.toLocaleString('zh-TW')+'</div>').join('');
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>冶煉規則</h3><p>裝備品質不限制材料階級。選用哪一階材料，本次重洗就使用哪一階的數值範圍。</p>'+lines+'<p>每次會重洗所有未鎖定的冶煉槽；已鎖定詞條保持原數值。冶煉次數不限。</p><p>消耗：未鎖定 50 張設計圖＋50 礦石；鎖 1 條各 100；鎖 2 條各 150。最多鎖 2 條，且至少保留 1 個槽位重洗。</p><p>單槽最高值固定10%；具副詞條範圍的材料，雙詞條同時最高固定5%。</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">返回</button></div></div>');
    };

'''
s=replace_between(s,show_start,show_end,show_new,'affix info')

start='''    window.v141StartReforge=function(){\n'''
end='''    window.v141ResolveReforge=function(applyNew){\n'''
new_start=r'''    window.v141StartReforge=function(){
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||synthesisState.pendingReforge){ return; }
        const slotCount=reforgeSlotCount(item);
        if(slotCount<=0){ alert("這件裝備沒有冶煉槽。"); return; }
        const locks=normalizeReforgeLocks(item).slice();
        if(locks.length>=slotCount){ alert("至少要保留 1 個未鎖定槽位才能重新冶煉。"); return; }
        const tier=TIER_META[synthesisState.reforgeMaterialTier]?synthesisState.reforgeMaterialTier:"low";
        const info=reforgeMaterialInfo(tier);
        const cost=reforgeMaterialCost(locks.length);
        if(!info.ore||info.blueprintCount<cost||info.oreCount<cost||gold<info.meta.reforgeGold){
            alert(info.meta.label+"冶煉材料或金幣不足。");
            return;
        }
        const success=runInventoryTransaction(()=>
            consumeMatching(candidate=>candidate&&candidate.blueprintSlot&&candidate.tierKey===tier,cost)&&
            window.v132ConsumeStackItem(info.ore.id,cost)
        );
        if(!success){ alert("冶煉素材扣除失敗，已自動還原。"); return; }
        gold-=info.meta.reforgeGold;
        synthesisState.pendingReforge={
            uid:item.v141Uid,
            stats:rollReforgeAffixes(item,tier,locks),
            materialTier:tier,
            lockedKeys:locks.slice(),
            materialCost:cost
        };
        rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
    };

'''
s=replace_between(s,start,end,new_start,'start reforge')

resolve_start='''    window.v141ResolveReforge=function(applyNew){\n'''
resolve_end='''    window.v141CraftTalismans=function(){\n'''
resolve_new=r'''    window.v141ResolveReforge=function(applyNew){
        const pending=synthesisState.pendingReforge;
        if(!pending){ return; }
        const item=findEquipmentByUid(pending.uid);
        if(applyNew&&item){
            // Replace the unlocked result as one full roll; locked keys were already
            // copied into pending.stats by rollReforgeAffixes(). No additive stacking.
            item.reforgeStats=Object.assign({},pending.stats);
            item.reforgeUsed=0;
        }
        synthesisState.pendingReforge=null;
        if(item){ normalizeReforgeLocks(item); }
        saveGame(); updateUI(); renderSynthesis();
        showSynthesisResult(applyNew?"已套用新冶煉效果":"已保留原冶煉效果",applyNew&&item?'<div class="v141-result-item"><b>'+escapeHtml(item.name)+'</b>'+statsHtml(item.reforgeStats)+'</div>':'<p>本次材料與金幣已消耗，原有效果維持不變。</p>');
    };

'''
s=replace_between(s,resolve_start,resolve_end,resolve_new,'resolve reforge')

p.write_text(s,encoding='utf-8')

# ---------------------------------------------------------------------------
# Black-gold UI for material tier selection and affix locking.
# ---------------------------------------------------------------------------
p=Path('css/38-v141-system-expansion.css')
css=p.read_text(encoding='utf-8')
marker='/* V173.58 — FREE-MATERIAL REFORGE UI */'
if marker not in css:
    css=css.rstrip()+r'''

/* V173.58 — FREE-MATERIAL REFORGE UI */
#game-stage .v17358-reforge-card{gap:8px!important;}
#game-stage .v17358-section-title{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;color:#f4dfb0;}
#game-stage .v17358-section-title>b{font-size:14px;line-height:18px;}
#game-stage .v17358-section-title>span{color:#aa9a7e;font-size:10px;line-height:14px;}
#game-stage .v17358-reforge-material,
#game-stage .v17358-reforge-lock-panel{padding:8px;border:1px solid rgba(177,128,57,.62);border-radius:9px;background:linear-gradient(180deg,rgba(36,27,16,.82),rgba(13,10,7,.9));}
#game-stage .v17358-reforge-tiers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
#game-stage .v17358-reforge-tier{display:flex!important;min-height:58px!important;flex-direction:column;align-items:flex-start!important;justify-content:center!important;gap:1px;padding:6px 8px!important;border:1px solid #72552d!important;border-radius:7px!important;background:linear-gradient(180deg,#291f13,#110d08)!important;color:#e8d6ae!important;text-align:left!important;}
#game-stage .v17358-reforge-tier.active{border-color:#efbd55!important;background:linear-gradient(180deg,#5b3d16,#231506)!important;box-shadow:inset 0 0 0 1px rgba(255,224,151,.32),0 0 9px rgba(224,161,56,.22)!important;}
#game-stage .v17358-reforge-tier>b{font-size:12px;line-height:15px;}
#game-stage .v17358-reforge-tier>span{font-size:10px;line-height:13px;color:#d9c49a;}
#game-stage .v17358-reforge-tier>small{font-size:9px;line-height:12px;color:#9e8d72;}
#game-stage .v17358-reforge-lock-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
#game-stage .v17358-affix-lock{display:grid!important;grid-template-columns:22px minmax(0,1fr);grid-template-rows:auto auto;min-height:48px!important;padding:5px 7px!important;border:1px solid #625039!important;border-radius:7px!important;background:#15100a!important;color:#d9c8a5!important;text-align:left!important;}
#game-stage .v17358-affix-lock>span{grid-row:1/3;align-self:center;font-size:17px;}
#game-stage .v17358-affix-lock>b{overflow:hidden;font-size:11px;line-height:14px;text-overflow:ellipsis;white-space:nowrap;}
#game-stage .v17358-affix-lock>small{font-size:9px;line-height:11px;color:#8d8069;}
#game-stage .v17358-affix-lock.locked{border-color:#e5ac45!important;background:linear-gradient(180deg,#39250d,#171006)!important;color:#ffe1a0!important;box-shadow:inset 0 0 9px rgba(239,189,85,.12)!important;}
#game-stage .v17358-no-affix-lock{grid-column:1/-1;padding:8px;border:1px dashed rgba(165,128,72,.42);border-radius:6px;color:#9f927d;font-size:10px;text-align:center;}
#game-stage .v17358-reforge-lock-panel>small{display:block;margin-top:5px;color:#a9997d;font-size:9px;}
#game-stage .v17358-reforge-cost{margin-top:0!important;}
#game-stage .v17358-reforge-cost-note{margin-top:-2px;color:#a9997d;font-size:9px;line-height:13px;text-align:center;}
'''+"\n"
    p.write_text(css,encoding='utf-8')

# ---------------------------------------------------------------------------
# External version/cache bump to V173.58. Keep old historical asset versions.
# ---------------------------------------------------------------------------
for p in [Path('index.html'),*Path('js').glob('*.js'),*Path('tests').glob('*.js')]:
    text=p.read_text(encoding='utf-8')
    newer=text.replace('173\\.57','173\\.58').replace('173.57','173.58')
    if newer!=text:
        p.write_text(newer,encoding='utf-8')

# Update obsolete assertions in the old V173.46 spec that enforced one-use additive reforging.
p=Path('tests/v173.46-equipment-progression.test.js')
t=p.read_text(encoding='utf-8')
for line in [
    'assert.match(source,/remainingReforgeSlots\\(item\\)<=0/);\n',
    'assert.match(source,/item\\.reforgeUsed=Math\\.min/);\n',
    'assert.match(source,/merged\\[key\\]=\\(Number\\(merged\\[key\\]\\)\\|\\|0\\)\\+\\(Number\\(value\\)\\|\\|0\\)/);\n',
    'assert.match(source,/hasRecordedUse=Object\\.prototype\\.hasOwnProperty\\.call\\(item,"reforgeUsed"\\)/);\n',
    'assert.match(source,/item\\.reforgeStats&&Object\\.keys\\(item\\.reforgeStats\\)\\.length\\?1:0/);\n'
]:
    t=t.replace(line,'')
t=t.replace('assert.match(source,/reforgeUsed/);','assert.match(source,/reforgeUsed=0/);')
t += '\n// V173.58: reforgeSlots are affix-slot capacity; attempts are unlimited.\nassert.match(source,/return Math\\.max\\(explicit,existing\\)/);\nassert.doesNotMatch(source,/item\\.reforgeUsed=Math\\.min/);\n'
p.write_text(t,encoding='utf-8')

# V173.57 test now expects the new unlimited eligibility helper rather than old "remaining attempts" semantics.
p=Path('tests/v173.57-starter-icons-reforge-filter.test.js')
t=p.read_text(encoding='utf-8')
t=t.replace('assert.match(synthesis,/v17346RemainingReforgeSlots\\(item\\)>0/);','assert.match(synthesis,/reforgeSlotCount\\(item\\)>0/);')
p.write_text(t,encoding='utf-8')

Path('tests/v173.58-reforge-redesign.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const synthesis=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const css=fs.readFileSync("css/38-v141-system-expansion.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(synthesis,/reforgeMaterialTier:"low",lockedReforgeKeys:\[\]/);
assert.match(synthesis,/function reforgeMaterialCost\(lockCount\)/);
assert.match(synthesis,/return locks===0\?50:\(locks===1\?100:150\)/);
assert.match(synthesis,/function reforgeSlotCount\(item\)/);
assert.match(synthesis,/return !!\(item&&item\.v17351Locked!==true&&reforgeSlotCount\(item\)>0\)/);
assert.match(synthesis,/v141SelectReforgeMaterialTier/);
assert.match(synthesis,/v141ToggleReforgeLock/);
assert.match(synthesis,/candidate&&candidate\.blueprintSlot&&candidate\.tierKey===tier,cost/);
assert.match(synthesis,/v132ConsumeStackItem\(info\.ore\.id,cost\)/);
assert.match(synthesis,/stats:rollReforgeAffixes\(item,tier,locks\)/);
assert.match(synthesis,/item\.reforgeStats=Object\.assign\(\{\},pending\.stats\)/);
assert.match(synthesis,/item\.reforgeUsed=0/);
assert.doesNotMatch(synthesis,/const tier=inferTier\(item\);[\s\S]{0,500}v141StartReforge/);
assert.match(synthesis,/裝備品質不限制材料階級/);
assert.match(synthesis,/未鎖定 50 張設計圖＋50 礦石/);
assert.match(synthesis,/鎖 1 條各 100/);
assert.match(synthesis,/鎖 2 條各 150/);
assert.match(equipment,/return Math\.max\(explicit,existing\)/);
assert.doesNotMatch(equipment,/merged\[key\]=/);
assert.doesNotMatch(equipment,/item\.reforgeUsed=Math\.min/);
assert.match(css,/V173\.58 — FREE-MATERIAL REFORGE UI/);
assert.match(css,/\.v17358-reforge-tiers/);
assert.match(css,/\.v17358-affix-lock\.locked/);
assert.match(loader,/const V_ASSET_VERSION="173\.58"/);
assert.match(index,/<title>四象江湖傳 V173\.58<\/title>/);
console.log("✓ V173.58 unlimited free-material reforge redesign");
''',encoding='utf-8')

print('V173.58 reforge redesign patch prepared')
