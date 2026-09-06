from pathlib import Path

p=Path('.github/scripts/apply-v17358-reforge-redesign.py')
s=p.read_text(encoding='utf-8')
start=s.find("# Replace the old additive/one-use wrapper with an unlimited compatibility guard.")
end=s.find("p.write_text(s,encoding='utf-8')",start)
if start<0 or end<0:
    raise SystemExit('patcher wrapper section not found')
end=end+len("p.write_text(s,encoding='utf-8')")
replacement=r'''# Replace only the two legacy reforge wrappers. Do NOT span to statLine: the
# original file has preview/shop/style owners between these wrappers and statLine.
old_wrapper=r''' + "'''" + r'''    if(typeof window.v141StartReforge==="function"){
        const previousStartReforge=window.v141StartReforge;
        window.v141StartReforge=function(){
            const item=selectedReforgeItem();
            if(!item||remainingReforgeSlots(item)<=0){
                if(typeof window.rpgAlert==="function"){ void window.rpgAlert("這件裝備沒有可用的［可冶煉］詞條槽。",{title:"無法冶煉"}); }
                else{ alert("這件裝備沒有可用的［可冶煉］詞條槽。"); }
                return;
            }
            activeReforgeSnapshot={uid:item.v141Uid,used:Math.max(0,Number(item.reforgeUsed)||0),stats:{...(item.reforgeStats||{})}};
            return previousStartReforge.apply(this,arguments);
        };
    }
    if(typeof window.v141ResolveReforge==="function"){
        const previousResolveReforge=window.v141ResolveReforge;
        window.v141ResolveReforge=function(apply){
            const snapshot=activeReforgeSnapshot;
            const item=snapshot?allEquipment().find(entry=>entry&&entry.v141Uid===snapshot.uid):null;
            const result=previousResolveReforge.apply(this,arguments);
            if(apply&&item&&snapshot){
                const rolled={...(item.reforgeStats||{})};
                const merged={...snapshot.stats};
                Object.entries(rolled).forEach(([key,value])=>{ merged[key]=(Number(merged[key])||0)+(Number(value)||0); });
                item.reforgeStats=merged;
                item.reforgeUsed=Math.min(Math.floor(Number(item.reforgeSlots)||0),snapshot.used+1);
                if(typeof saveGame==="function"){ saveGame(); }
                if(typeof window.v141RenderSynthesis==="function"){ window.v141RenderSynthesis(); }
            }
            activeReforgeSnapshot=null;
            return result;
        };
    }
''' + "'''" + r'''
new_wrapper=r''' + "'''" + r'''    if(typeof window.v141StartReforge==="function"){
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
            // V173.58: replacement semantics live in js/36. No additive merge and
            // no reforgeUsed attempt consumption here.
            return previousResolveReforge.apply(this,arguments);
        };
    }
''' + "'''" + r'''
s=replace_once(s,old_wrapper,new_wrapper,'legacy reforge wrappers')
p.write_text(s,encoding='utf-8')'''
s=s[:start]+replacement+s[end:]
p.write_text(s,encoding='utf-8')
print('V173.58 patcher boundary fixed')
