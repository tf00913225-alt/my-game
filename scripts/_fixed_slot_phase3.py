from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path,text):
    Path(path).write_text(text,encoding="utf-8")


def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)


# ---------------------------------------------------------------------------
# Canonical ally formation state lives beside enemy fixed slots.
# ---------------------------------------------------------------------------
p="js/battlefield-slot-owner.js"
s=read(p)
s=replace_once(s,
"""    function normalizeShape(shape){
        const raw=String(shape||\"single\");
        if(raw===\"horizontal-3\"||raw===\"allyTri\"){ return \"tri\"; }
        return raw;
    }
""",
"""    function normalizeShape(shape){
        const raw=String(shape||\"single\");
        if(raw===\"horizontal-3\"||raw===\"allyTri\"){ return \"tri\"; }
        if(raw===\"allyAll\"){ return \"all\"; }
        if(raw===\"ally\"){ return \"single\"; }
        return raw;
    }
""","slot shape aliases")
ally_block=r'''    function defaultAllySlots(characterIndexes){
        const indexes=(characterIndexes||[]).filter(Number.isInteger).slice(0,6);
        if(indexes.length===1){ return ["ALLY_F2"]; }
        if(indexes.length===2){ return ["ALLY_F1","ALLY_F3"]; }
        return ["ALLY_F1","ALLY_F2","ALLY_F3","ALLY_B1","ALLY_B2","ALLY_B3"].slice(0,indexes.length);
    }

    function normalizeAllyFormation(saved,characterIndexes){
        const indexes=(characterIndexes||[]).filter(Number.isInteger).slice(0,6);
        const allowedIndexes=new Set(indexes);
        const characterIndexToSlot={};
        const slotToCharacterIndex={};
        const savedMap=saved&&typeof saved==="object"&&saved.characterIndexToSlot&&typeof saved.characterIndexToSlot==="object"
            ?saved.characterIndexToSlot:{};

        indexes.forEach(index=>{
            const slot=savedMap[index]||savedMap[String(index)];
            if(ALLY_SLOTS.includes(slot)&&slotToCharacterIndex[slot]===undefined){
                characterIndexToSlot[index]=slot;
                slotToCharacterIndex[slot]=index;
            }
        });

        const defaults=defaultAllySlots(indexes);
        indexes.forEach((index,position)=>{
            if(characterIndexToSlot[index]){ return; }
            const preferred=defaults[position];
            const openPreferred=preferred&&slotToCharacterIndex[preferred]===undefined?preferred:null;
            const slot=openPreferred||ALLY_SLOTS.find(candidate=>slotToCharacterIndex[candidate]===undefined);
            if(!slot){ return; }
            characterIndexToSlot[index]=slot;
            slotToCharacterIndex[slot]=index;
        });

        Object.keys(characterIndexToSlot).forEach(key=>{
            if(!allowedIndexes.has(Number(key))){ delete characterIndexToSlot[key]; }
        });
        return {version:1,kind:"ally-formation",characterIndexToSlot,slotToCharacterIndex};
    }

    let allyFormationState=null;

    function hydrateAllyFormation(saved,characterIndexes){
        allyFormationState=normalizeAllyFormation(saved,characterIndexes);
        return allyFormationState;
    }

    function ensureAllyFormation(characterIndexes){
        allyFormationState=normalizeAllyFormation(allyFormationState,characterIndexes);
        return allyFormationState;
    }

    function getSerializableAllyFormation(){
        if(!allyFormationState){ return null; }
        return {
            version:1,
            characterIndexToSlot:Object.assign({},allyFormationState.characterIndexToSlot)
        };
    }

    function allySlotForCharacter(index){
        return allyFormationState&&allyFormationState.characterIndexToSlot
            ?allyFormationState.characterIndexToSlot[index]||null:null;
    }

    function characterAtAllySlot(slot){
        const value=allyFormationState&&allyFormationState.slotToCharacterIndex
            ?allyFormationState.slotToCharacterIndex[slot]:undefined;
        return Number.isInteger(value)?value:null;
    }

    function moveAllyCharacter(characterIndex,targetSlot){
        if(!allyFormationState||!Number.isInteger(characterIndex)||!ALLY_SLOTS.includes(targetSlot)){ return false; }
        const from=allySlotForCharacter(characterIndex);
        if(!from){ return false; }
        const occupant=characterAtAllySlot(targetSlot);
        if(from===targetSlot){ return true; }
        allyFormationState.characterIndexToSlot[characterIndex]=targetSlot;
        allyFormationState.slotToCharacterIndex[targetSlot]=characterIndex;
        if(Number.isInteger(occupant)){
            allyFormationState.characterIndexToSlot[occupant]=from;
            allyFormationState.slotToCharacterIndex[from]=occupant;
        }else{
            delete allyFormationState.slotToCharacterIndex[from];
        }
        return true;
    }

    function resolveAllyTargets(formation,primaryCharacterIndex,shape,isAlive){
        const state=formation&&formation.kind==="ally-formation"?formation:allyFormationState;
        if(!state){ return []; }
        const normalized=normalizeShape(shape);
        let slots;
        if(normalized==="all"){
            slots=ALLY_SLOTS.slice();
        }else{
            const primarySlot=state.characterIndexToSlot&&state.characterIndexToSlot[primaryCharacterIndex];
            if(!primarySlot){ return []; }
            slots=resolveSlotsFromShape("ally",primarySlot,normalized);
        }
        return slots.map(slot=>{
            const index=state.slotToCharacterIndex&&state.slotToCharacterIndex[slot];
            return Number.isInteger(index)&&(!isAlive||isAlive(index))?index:null;
        }).filter(Number.isInteger);
    }

'''
s=replace_once(s,"    let activeEnemySnapshot=null;\n",ally_block+"    let activeEnemySnapshot=null;\n","insert ally formation owner")
s=replace_once(s,
"""        getNextEnemyPrimaryTarget:nextEnemyPrimaryTarget,
        setActiveEnemySnapshot:setActiveEnemySnapshot,
""",
"""        getNextEnemyPrimaryTarget:nextEnemyPrimaryTarget,
        normalizeAllyFormation:normalizeAllyFormation,
        hydrateAllyFormation:hydrateAllyFormation,
        ensureAllyFormation:ensureAllyFormation,
        getSerializableAllyFormation:getSerializableAllyFormation,
        getAllySlotForCharacter:allySlotForCharacter,
        getCharacterAtAllySlot:characterAtAllySlot,
        moveAllyCharacter:moveAllyCharacter,
        resolveAllyTargets:resolveAllyTargets,
        setActiveEnemySnapshot:setActiveEnemySnapshot,
""","export ally formation api")
s=replace_once(s,
"""    window.FourSymbolsBattlefieldSlots=Object.freeze(api);
})();
""",
"""    window.FourSymbolsBattlefieldSlots=Object.freeze(api);
    if(Object.prototype.hasOwnProperty.call(window,"__fourSymbolsPendingAllyFormation")){
        const indexes=typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes():[];
        hydrateAllyFormation(window.__fourSymbolsPendingAllyFormation,indexes);
        delete window.__fourSymbolsPendingAllyFormation;
    }
})();
""","hydrate pending ally formation")
write(p,s)


# ---------------------------------------------------------------------------
# Persist through the existing UID-owned account save document.
# ---------------------------------------------------------------------------
p="js/00-main.js"
s=read(p)
s=replace_once(s,
"""            autoConfig3:
                autoConfig3,

            /*
               Team Relic persistence uses this same SAVE_KEY document.
""",
"""            autoConfig3:
                autoConfig3,

            allyFormation:
                (
                    typeof window!=="undefined" &&
                    window.FourSymbolsBattlefieldSlots &&
                    typeof window.FourSymbolsBattlefieldSlots.getSerializableAllyFormation==="function"
                )
                ? window.FourSymbolsBattlefieldSlots.getSerializableAllyFormation()
                : (
                    existingRelicSaveData &&
                    existingRelicSaveData.allyFormation
                ),

            /*
               Team Relic persistence uses this same SAVE_KEY document.
""","save ally formation")
load_marker="""        /*
           ★ 技能配裝資料（新增）
"""
hydrate_block="""        const savedAllyFormation=
            data.allyFormation && typeof data.allyFormation===\"object\"
            ? data.allyFormation
            : null;
        if(
            typeof window!==\"undefined\" &&
            window.FourSymbolsBattlefieldSlots &&
            typeof window.FourSymbolsBattlefieldSlots.hydrateAllyFormation===\"function\"
        ){
            window.FourSymbolsBattlefieldSlots.hydrateAllyFormation(
                savedAllyFormation,
                getExistingPartyIndexes()
            );
        }else if(typeof window!==\"undefined\"){
            window.__fourSymbolsPendingAllyFormation=savedAllyFormation;
        }


"""
s=replace_once(s,load_marker,hydrate_block+load_marker,"load ally formation migration")
# Manual allyTri must enter the same ally target-selection flow as ally/deadAlly.
old='skill.targetType==="ally" || skill.targetType==="deadAlly"'
count=s.count(old)
if count!=2:
    raise SystemExit(f"core ally target conditions: expected 2 matches, found {count}")
s=s.replace(old,'skill.targetType==="ally" || skill.targetType==="allyTri" || skill.targetType==="deadAlly"')
# Add formal formation modal route without changing other home UI branches.
s=replace_once(s,
"""    }
    else if(type==="offlineExp"){
""",
"""    }
    else if(type==="formation"){
        titleEl.textContent="佈陣";
        bodyEl.innerHTML=
            typeof window.vFixedRenderAllyFormationContent==="function"
            ? window.vFixedRenderAllyFormationContent()
            : "";
    }
    else if(type==="offlineExp"){
""","formation home modal route")
write(p,s)


# ---------------------------------------------------------------------------
# Additional characters: allyTri also requires a chosen centre target.
# ---------------------------------------------------------------------------
p="js/35-v141-ui-battle.js"
s=read(p)
s=replace_once(s,
'            if(skill.targetType==="ally"||skill.targetType==="deadAlly"){',
'            if(skill.targetType==="ally"||skill.targetType==="allyTri"||skill.targetType==="deadAlly"){',
"additional-character allyTri selection")
write(p,s)


# ---------------------------------------------------------------------------
# Player support and enemy rage both consume the canonical slot geometry.
# ---------------------------------------------------------------------------
p="js/42-v148-combat-dungeon-fixes.js"
s=read(p)
old_requested="""    function requestedBuffTargets(characterIndex,queued,skill){
        if(skill.targetType==="allyAll"){ return livingPartyIndexes(); }
        if(skill.targetType==="allyTri"){
            const living=livingPartyIndexes();
            if(living.length<=3){ return living; }
            const all=partyIndexes();
            const preferred=Number.isInteger(queued.targetAlly)?queued.targetAlly:all[Math.floor(all.length/2)];
            const position=Math.max(0,all.indexOf(preferred));
            return all.slice(Math.max(0,position-1),Math.min(all.length,position+2))
                .filter(index=>living.includes(index));
        }
        const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getPartyCharacterByIndex(selected);
        return target&&numeric(target.hp)>0?[selected]:[];
    }
"""
new_requested="""    function requestedBuffTargets(characterIndex,queued,skill){
        const owner=battlefieldSlots();
        const all=partyIndexes();
        const living=index=>{
            const target=getPartyCharacterByIndex(index);
            return !!(target&&numeric(target.hp)>0);
        };
        if(owner&&typeof owner.ensureAllyFormation==="function"&&typeof owner.resolveAllyTargets==="function"){
            const formation=owner.ensureAllyFormation(all);
            if(skill.targetType==="allyAll"){
                return owner.resolveAllyTargets(formation,null,"all",living);
            }
            if(skill.targetType==="allyTri"){
                const preferred=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
                return owner.resolveAllyTargets(formation,preferred,"allyTri",living);
            }
            const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
            return owner.resolveAllyTargets(formation,selected,"ally",living);
        }
        if(skill.targetType==="allyAll"){ return livingPartyIndexes(); }
        const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getPartyCharacterByIndex(selected);
        return target&&numeric(target.hp)>0?[selected]:[];
    }
"""
s=replace_once(s,old_requested,new_requested,"slot-based party support targets")
old_rage="""    function bestMonsterRageTargets(casterIndex){
        const indexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[];
        const alive=indexes.filter(index=>{
            const monster=monsters[index];
            return monster&&monster.alive!==false&&numeric(monster.hp)>0;
        });
        let best=[];
        let bestScore=-1;
        stableFormationRows(indexes).forEach(row=>{
            row.forEach((center,index)=>{
                if(!alive.includes(center)){ return; }
                const trio=row.slice(Math.max(0,index-1),Math.min(row.length,index+2))
                    .filter(target=>alive.includes(target));
                const eligible=trio.filter(target=>!activeMonsterTeamBuff(monsters[target],"rage"));
                const score=eligible.length*100+(center===casterIndex?20:(trio.includes(casterIndex)?10:0));
                if(score>bestScore){ best=trio; bestScore=score; }
            });
        });
        return best.slice(0,3);
    }
"""
new_rage="""    function bestMonsterRageTargets(casterIndex){
        const indexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[];
        const alive=indexes.filter(monsterAlive);
        const owner=battlefieldSlots();
        const snapshot=activeFormationSnapshot(indexes);
        let best=[];
        let bestScore=-1;
        alive.forEach(center=>{
            const trio=owner&&snapshot
                ?owner.resolveEnemyTargets(snapshot,center,"tri",monsterAlive)
                :[center];
            const eligible=trio.filter(target=>!activeMonsterTeamBuff(monsters[target],"rage"));
            const score=eligible.length*100+(center===casterIndex?20:(trio.includes(casterIndex)?10:0));
            if(score>bestScore){ best=trio; bestScore=score; }
        });
        return best.slice(0,3);
    }
"""
s=replace_once(s,old_rage,new_rage,"slot-based enemy rage targets")
write(p,s)


# ---------------------------------------------------------------------------
# Enemy heal/buff AI may choose its centre as before, but geometry cannot bridge
# an empty slot or borrow a unit from another row.
# ---------------------------------------------------------------------------
p="js/36-v141-content-systems.js"
s=read(p)
old_tri="""    function getMonsterAllyTriTargets(casterIndex,entries){
        const living=(entries||currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})))
            .filter(entry=>entry&&entry.monster&&entry.monster.alive!==false&&Number(entry.monster.hp)>0);
        const livingByIndex=new Map(living.map(entry=>[entry.index,entry]));
        const rows=typeof window.v148GetFormationRows==="function"
            ?window.v148GetFormationRows(currentBattleMonsters)
            :typeof window.v138GetFormationRows==="function"
            ?window.v138GetFormationRows(currentBattleMonsters)
            :[currentBattleMonsters.slice()];
        let best=[];
        let bestScore=-1;
        rows.forEach(row=>{
            row.forEach((center,position)=>{
                if(!livingByIndex.has(center)){ return; }
                const trio=row.slice(Math.max(0,position-1),Math.min(row.length,position+2))
                    .map(index=>livingByIndex.get(index)).filter(Boolean);
                const score=trio.reduce((sum,entry)=>{
                    const ally=entry.monster;
                    const hpNeed=(monsterBaseMaxHp(ally)-monsterBaseHp(ally))/monsterBaseMaxHp(ally);
                    const maxSP=Math.max(1,Number(ally.maxSP)||1);
                    const spNeed=(maxSP-Math.max(0,Number(ally.sp)||0))/maxSP;
                    return sum+Math.max(0,hpNeed)+Math.max(0,spNeed);
                },0)+(trio.some(entry=>entry.index===casterIndex)?0.0001:0);
                if(score>bestScore){ best=trio; bestScore=score; }
            });
        });
        return best.slice(0,3);
    }
"""
new_tri="""    function getMonsterAllyTriTargets(casterIndex,entries){
        const living=(entries||currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})))
            .filter(entry=>entry&&entry.monster&&entry.monster.alive!==false&&Number(entry.monster.hp)>0);
        const livingByIndex=new Map(living.map(entry=>[entry.index,entry]));
        const owner=window.FourSymbolsBattlefieldSlots||null;
        const snapshot=owner&&typeof owner.getActiveEnemySnapshot==="function"?owner.getActiveEnemySnapshot():null;
        let best=[];
        let bestScore=-1;
        living.forEach(centerEntry=>{
            const center=centerEntry.index;
            const indexes=owner&&snapshot&&typeof owner.resolveEnemyTargets==="function"
                ?owner.resolveEnemyTargets(snapshot,center,"tri",index=>livingByIndex.has(index))
                :[center];
            const trio=indexes.map(index=>livingByIndex.get(index)).filter(Boolean);
            const score=trio.reduce((sum,entry)=>{
                const ally=entry.monster;
                const hpNeed=(monsterBaseMaxHp(ally)-monsterBaseHp(ally))/monsterBaseMaxHp(ally);
                const maxSP=Math.max(1,Number(ally.maxSP)||1);
                const spNeed=(maxSP-Math.max(0,Number(ally.sp)||0))/maxSP;
                return sum+Math.max(0,hpNeed)+Math.max(0,spNeed);
            },0)+(trio.some(entry=>entry.index===casterIndex)?0.0001:0);
            if(score>bestScore){ best=trio; bestScore=score; }
        });
        return best.slice(0,3);
    }
"""
s=replace_once(s,old_tri,new_tri,"slot-based enemy allyTri")
write(p,s)


# ---------------------------------------------------------------------------
# Battle ally DOM is always a permanent 2x3 slot host.  Keep card IDs intact.
# Main-city formation UI uses the existing home modal and the same save owner.
# ---------------------------------------------------------------------------
p="js/25-v131-fix-batch.js"
s=read(p)
insert_marker="""    function applyPlayerElementFrames(){
"""
idx=s.find(insert_marker)
if idx<0: raise SystemExit("js25 applyPlayerElementFrames marker missing")
# Place helpers immediately before element-frame decoration.
helpers=r'''    function ensureAllyFormationState(){
        if(!fixedBattlefieldSlots||typeof fixedBattlefieldSlots.ensureAllyFormation!=="function"){ return null; }
        return fixedBattlefieldSlots.ensureAllyFormation(getExistingPartyIndexes());
    }

    function applyAllyBattleFormation(){
        const area=document.getElementById("battlePlayerRow");
        const formation=ensureAllyFormationState();
        if(!area||!formation){ return; }
        const cards=new Map();
        getExistingPartyIndexes().forEach(index=>{
            const card=document.getElementById("battlePlayerCard"+index);
            if(card){ cards.set(index,card); }
        });
        area.innerHTML="";
        area.classList.add("v-fixed-ally-formation");
        [fixedBattlefieldSlots.allyFrontSlots,fixedBattlefieldSlots.allyBackSlots].forEach((slots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-ally-row v-fixed-ally-row-"+(rowIndex===0?"front":"back");
            slots.forEach(slot=>{
                const wrapper=document.createElement("div");
                wrapper.className="v-fixed-unit-slot v-fixed-ally-slot";
                wrapper.dataset.slot=slot;
                const characterIndex=fixedBattlefieldSlots.getCharacterAtAllySlot(slot);
                const card=Number.isInteger(characterIndex)?cards.get(characterIndex):null;
                if(card){ wrapper.appendChild(card); }
                row.appendChild(wrapper);
            });
            area.appendChild(row);
        });
    }

    let vFixedFormationSelectedCharacter=null;
    function formationSlotLabel(slot){
        const labels={ALLY_F1:"前左",ALLY_F2:"前中",ALLY_F3:"前右",ALLY_B1:"後左",ALLY_B2:"後中",ALLY_B3:"後右"};
        return labels[slot]||slot;
    }
    function renderAllyFormationContent(){
        const formation=ensureAllyFormationState();
        if(!formation){ return '<div class="v-fixed-formation-empty">目前無法讀取佈陣資料。</div>'; }
        const renderRow=(label,slots)=>'<section class="v-fixed-formation-row"><header>'+label+'</header><div class="v-fixed-formation-slots">'+slots.map(slot=>{
            const index=fixedBattlefieldSlots.getCharacterAtAllySlot(slot);
            const character=Number.isInteger(index)?getPartyCharacterByIndex(index):null;
            const selected=Number.isInteger(index)&&index===vFixedFormationSelectedCharacter;
            return '<button type="button" class="v-fixed-formation-slot'+(selected?' selected':'')+'" data-slot="'+slot+'" onclick="vFixedSelectFormationSlot(\''+slot+'\')">'+
                '<small>'+formationSlotLabel(slot)+'</small><strong>'+(character?(character.id||('角色'+(index+1))):'空位')+'</strong></button>';
        }).join('')+'</div></section>';
        return '<div class="v-fixed-formation-panel"><p>先點角色，再點目標格位；若目標已有角色會直接交換。</p>'+renderRow('前排',fixedBattlefieldSlots.allyFrontSlots)+renderRow('後排',fixedBattlefieldSlots.allyBackSlots)+'</div>';
    }
    window.vFixedRenderAllyFormationContent=renderAllyFormationContent;
    window.vFixedSelectFormationSlot=function(slot){
        const formation=ensureAllyFormationState();
        if(!formation||!fixedBattlefieldSlots.allySlots.includes(slot)){ return; }
        const occupant=fixedBattlefieldSlots.getCharacterAtAllySlot(slot);
        if(!Number.isInteger(vFixedFormationSelectedCharacter)){
            if(!Number.isInteger(occupant)){ return; }
            vFixedFormationSelectedCharacter=occupant;
        }else{
            fixedBattlefieldSlots.moveAllyCharacter(vFixedFormationSelectedCharacter,slot);
            vFixedFormationSelectedCharacter=null;
            if(typeof saveGame==="function"){ saveGame({source:"ally-formation"}); }
            if(typeof window.v54RenderHomeRoster==="function"){ window.v54RenderHomeRoster(); }
        }
        const body=document.getElementById("homeFeatureModalBody");
        if(body){ body.innerHTML=renderAllyFormationContent(); }
    };

'''
s=s[:idx]+helpers+s[idx:]
s=replace_once(s,
"""            applyBattleFormation();
            applyPlayerElementFrames();
""",
"""            applyBattleFormation();
            applyAllyBattleFormation();
            applyPlayerElementFrames();
""","apply ally slot formation after render")
write(p,s)


# Main city: only add the requested formation entry beside the roster header.
p="js/16-stage-v54-main-city-runtime.js"
s=read(p)
s=replace_once(s,
"""        roster.innerHTML='<header><b>冒險隊伍</b><span>隊伍 '+partyIndexes.length+' / 3</span></header>'+cards;
""",
"""        roster.innerHTML='<header><b>冒險隊伍</b><span>隊伍 '+partyIndexes.length+' / 3</span><button type="button" class="v-fixed-formation-entry" onclick="openHomeFeature(\\'formation\\')">佈陣</button></header>'+cards;
""","home formation entry")
write(p,s)


# Minimal owner-level CSS for the new permanent ally rows and formation modal.
p="css/31-v131-fix-batch.css"
s=read(p)
css=r'''

/* Fixed battlefield ally slots: structural owner, not a positional workaround. */
#game-stage #battlePlayerRow.v-fixed-ally-formation{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
}
#game-stage #battlePlayerRow .v-fixed-ally-row{
    display:grid;
    grid-template-columns:repeat(3,76px);
    justify-content:center;
    gap:5px;
    min-height:102px;
}
#game-stage #battlePlayerRow .v-fixed-ally-slot{
    position:relative;
    width:76px;
    min-height:102px;
}
#game-stage #battlePlayerRow .v-fixed-ally-slot>.battle-player{
    width:76px;
    height:102px;
}
.v146-home-roster>header .v-fixed-formation-entry{
    margin-left:auto;
    min-width:54px;
    min-height:30px;
    border:1px solid rgba(223,187,95,.7);
    border-radius:8px;
    background:rgba(31,24,14,.92);
    color:#f2d783;
    font-weight:800;
}
.v-fixed-formation-panel{display:flex;flex-direction:column;gap:14px;}
.v-fixed-formation-panel>p{margin:0;text-align:center;line-height:1.5;}
.v-fixed-formation-row>header{margin-bottom:6px;font-weight:900;color:#e5c76f;}
.v-fixed-formation-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.v-fixed-formation-slot{
    min-height:72px;padding:8px 4px;border:1px solid rgba(198,165,78,.55);border-radius:10px;
    background:rgba(20,18,15,.82);color:#f5ead0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
}
.v-fixed-formation-slot small{font-size:12px;color:#bda96f;}
.v-fixed-formation-slot strong{font-size:15px;}
.v-fixed-formation-slot.selected{outline:2px solid #f2cf63;box-shadow:0 0 12px rgba(242,207,99,.35);}
'''
if "Fixed battlefield ally slots" in s: raise SystemExit("phase3 css already present")
s=s.rstrip()+css+"\n"
write(p,s)

print("phase 3 patch applied")
