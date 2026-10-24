import vm from 'node:vm';
import crypto from 'node:crypto';
import {loadLegacyRuntime} from '../../../scripts/monster-balance-shadow-matrix.mjs';

// Actual fully loaded Client entry points. Save/update observers isolate the
// affected domain; original renderers and auto-option lifecycle still execute.
export function loadoutParity({displayLiteralReversals=[]}={}){
    const {context}=loadLegacyRuntime(),digest=crypto.createHash('sha256');let cases=0;
    const display=value=>Array.isArray(value)?value.map(display):typeof value==='string'?displayLiteralReversals.reduce((text,[oldText,acceptedText])=>text.split(acceptedText).join(oldText),value):value;
    const record=value=>{if(displayLiteralReversals.length)value[5]=display(value[5]);digest.update(JSON.stringify(value)+'\n');cases++;};
    const catalog=vm.runInContext('skillDatabase',context),ids=Object.keys(catalog).sort();
    const nativeCreate=context.document.createElement.bind(context.document),nativeGet=context.document.getElementById.bind(context.document),nodes=new Map();
    function node(){
        const values=new Map([['innerHTML',''],['textContent',''],['children',[]]]),base=nativeCreate('div');
        return new Proxy(base,{get:(target,key)=>key==='appendChild'?child=>{values.get('children').push(child);return child;}:values.has(key)?values.get(key):Reflect.get(target,key),
            set:(_target,key,value)=>{values.set(key,value);if(key==='innerHTML')values.set('children',[]);return true;}});
    }
    const tracked=new Set(['skillLoadout','allSkillsList','skillCharacterNameBox','autoSkillHome','autoSkillBattle','autoSkillPlayer2']);
    context.document.createElement=()=>node();context.document.getElementById=id=>{
        if(!tracked.has(id))return nativeGet(id);if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);
    };
    vm.runInContext(`
        globalThis.__loadoutEvents=[];
        saveGame=function(){__loadoutEvents.push(['save',JSON.stringify({characterSkillLoadouts,autoConfig,autoConfig2,autoConfig3})]);};
        updateUI=function(){__loadoutEvents.push(['update']);};
        alert=function(message){__loadoutEvents.push(['alert',String(message)]);};
        const originalLoadoutRender=renderSkillLoadout;
        renderSkillLoadout=function(){__loadoutEvents.push(['render']);return originalLoadoutRender.apply(this,arguments);};
    `,context);
    for(const [slot,element] of ['fire','water','wind'].entries()){
        const key=['fire','player2','player3'][slot],native=ids.filter(id=>catalog[id].element===element),cross=ids.filter(id=>catalog[id].element!==element);
        const equipped=[[],native.slice(0,4),[native[0],cross[0],cross[1],native[1]],[cross[0],native[0],cross[1],native[1],native[2]],['missing-old-id',native[0]]];
        const configs=[{skill:'normal'},{skill:'defend',v136ActionIntent:'defend',v136LastSkill:native[0]},
            {skill:'normal',v136ActionIntent:'skill',v136LastSkill:native[0]},{skill:native[0],v136ActionIntent:'normal'},
            {skill:'normal',v136ActionIntent:'skill',v136LastSkill:'missing-old-id'}];
        for(const carried of equipped)for(const preference of configs)for(const operation of [
            ...[native[0],cross[0],cross[1],'missing-old-id'].map(id=>({kind:'equip',id})),
            ...[0,1,-1,9].map(index=>({kind:'remove',index}))]){
            context.__loadoutCase={slot,key,element,carried,preference,operation,ids};
            const result=vm.runInContext(`(()=>{
                const c=__loadoutCase,actors=[player,player2,player3];
                for(let i=0;i<3;i++)actors[i]=Object.assign({},player,{id:'loadout-'+i,level:100,skillPoints:999,element:['fire','water','wind'][i]});
                Object.assign(player,actors[0]);player2=actors[1];player3=actors[2];[player,player2,player3][c.slot].element=c.element;
                Object.keys(characterSkillLoadouts).forEach(key=>delete characterSkillLoadouts[key]);
                Object.assign(characterSkillLoadouts,{fire:{name:'first',skillLevels:{},equippedSkills:[]},player2:{name:'second',skillLevels:{},equippedSkills:[]},player3:{name:'third',skillLevels:{},equippedSkills:[]}});
                const loadout=characterSkillLoadouts[c.key];loadout.skillLevels=Object.fromEntries(c.ids.map(id=>[id,1]));loadout.equippedSkills=c.carried.slice();
                currentSkillCharacter=c.key;
                [autoConfig,autoConfig2,autoConfig3].forEach(config=>{Object.keys(config).forEach(key=>delete config[key]);Object.assign(config,{enabled:true,skill:'normal',hp:50,sp:25,returnToCityWhenEmpty:false});});
                Object.assign([autoConfig,autoConfig2,autoConfig3][c.slot],c.preference);__loadoutEvents.length=0;
                const result=c.operation.kind==='equip'?equipSkill(c.operation.id):removeEquippedSkill(c.operation.index);
                return JSON.stringify({result:result===undefined?'undefined':result,loadouts:characterSkillLoadouts,configs:[autoConfig,autoConfig2,autoConfig3],events:__loadoutEvents});
            })()`,context);
            record([slot,carried,preference,operation,result,[...nodes].map(([id,n])=>[id,n.innerHTML,n.textContent,n.value,
                n.children.map(child=>[child.className,child.innerHTML])])]);
        }
    }
    return {cases,sha256:digest.digest('hex')};
}
