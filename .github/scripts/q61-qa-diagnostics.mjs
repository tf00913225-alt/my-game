// QA-only bounded, allow-listed trace. Never accepts raw save or identity data.
export function createQ61DiagnosticTrace(){
    const stages=new Set(['before-entry','entry-returned','entry-threw','wait-battle-active','wait-entry-animation','completed','capture-failed']);
    const modes=new Set(['tower','normal','daily','abyss','personal','world']);
    const elements=new Set(['fire','earth','water','wind']);
    const relics=new Set(['relic_cold_spring_jade','relic_qiankun_flask','relic_sun_orb','relic_nine_dragon_fire']);
    const results=new Set(['true','false','other','throw','not-observed']);
    const rows=[];
    return Object.freeze({
        record(value){
            try{
                const input=value&&typeof value==='object'?value:{};
                const row={
                    stage:stages.has(input.stage)?input.stage:'capture-failed',
                    mode:modes.has(input.mode)?input.mode:'tower',
                    sceneIndex:Number.isInteger(input.sceneIndex)&&input.sceneIndex>=0&&input.sceneIndex<100?input.sceneIndex:null,
                    element:elements.has(input.element)?input.element:null,
                    relicId:relics.has(input.relicId)?input.relicId:null,
                    floor:Number.isInteger(input.floor)&&input.floor>=1&&input.floor<=100?input.floor:null,
                    weekKey:typeof input.weekKey==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.weekKey)?input.weekKey:null,
                    entryResult:results.has(input.entryResult)?input.entryResult:'not-observed',
                    battleActive:typeof input.battleActive==='boolean'?input.battleActive:null,
                    pendingKind:'not-observed',pendingPhase:'not-observed',
                    preparation:'not-observed',save:'not-observed',launcher:'not-observed'
                };
                rows.push(row);if(rows.length>8)rows.shift();
            }catch(_){
                rows.push({stage:'capture-failed'});if(rows.length>8)rows.shift();
            }
        },
        capture(context,read){
            try{
                const observed=read();
                this.record({stage:context.stage,mode:context.mode,sceneIndex:context.sceneIndex,element:context.element,
                    relicId:context.relicId,floor:context.floor,entryResult:context.entryResult,
                    weekKey:observed?.weekKey,battleActive:observed?.battleActive});
            }catch(_){this.record({stage:'capture-failed'});}
        },
        snapshot(){return rows.map(row=>({...row}));}
    });
}

export function captureQ61Event(events){
    try{
        if(!Array.isArray(events)){ return {status:'capture-failed'}; }
        const event=events.slice(-128).reverse().find(item=>item?.method==='Runtime.consoleAPICalled'&&item?.params?.args?.[0]?.value==='Q61_TOWER_DIAGNOSTICS');
        const rows=JSON.parse(event?.params?.args?.[1]?.value);
        if(!Array.isArray(rows)){ return {status:'capture-failed'}; }
        const trace=createQ61DiagnosticTrace();
        for(const row of rows.slice(-8))trace.record(row);
        return {status:'captured',rows:trace.snapshot()};
    }catch(_){ return {status:'capture-failed'}; }
}
