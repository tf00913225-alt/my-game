/* Hero System V1 Phase 1. Pure domain: no storage, rewards, UI or battle hooks. */
(function installHeroCore(global){
    "use strict";
    const freeze=value=>{
        if(value&&typeof value==="object"){ Object.values(value).forEach(freeze); Object.freeze(value); }
        return value;
    };
    const weights=freeze({
        physical:{attack:30,intelligence:10,agility:15,defensePoints:15,vitality:15,energy:15},
        magic:{attack:10,intelligence:30,agility:15,defensePoints:15,vitality:15,energy:15}
    });
    const registry=freeze({
        divineDogHongbao:{heroId:"divineDogHongbao",name:"神犬紅包",element:"fire",archetype:"magic",role:"法師",rageSkillId:"phoenixCry",passive:{id:"basicAttackBurnMomentum",trigger:"basicAttackActionCompleted",burnChanceBonusPercent:15,stackable:true,preserveOnDeath:true,resetOn:"successfulPhoenixCryCast",scope:"heroSpecificModifier"},acquisition:{kind:"mainStoryChapterClear",chapter:1,directUnlock:true}},
        vajraHeavenlyKing:{heroId:"vajraHeavenlyKing",name:"金剛天王",element:"wind",archetype:"magic",role:"法師／輔助",rageSkillId:"windHowlLightning",passive:{id:"basicAttackStealthLowestHp",trigger:"basicAttackActionCompleted",skillId:"stealth",durationRounds:1,target:"livingAllyLowestAbsoluteCurrentHp",includeSelf:true,includeHeroes:true,tieBreak:"battlefieldSlotOrder"},acquisition:{kind:"cumulativeLoginDay",day:7,directUnlock:true}}
    });
    const starCosts=freeze([25,50,75,100,150]);
    const contract=freeze({combatantKind:"heroNpc",runtimeReady:false,maxHeroes:3,maxPlayerCharacters:3,unlockCost:100,pointsPerLevel:5,pointsPerStar:15,maxStars:5,allocationVersion:1,rerollItem:{id:"heroMarrowPill",name:"洗髓丹",cost:1,consumptionIntegrated:false},rage:{min:0,max:12,battleStart:0,skillThreshold:4,skillCost:4,basicAttackActionCompleted:1,enemyAttackOrSkillActionReceived:1,oncePerAction:true,includeMiss:true,includeShieldAbsorption:true,exclude:["burn","dot","reflect","selfDamage","environmentDamage"],preserveOnDeath:true,nextOwnActionMustUseSkill:true,persisted:false}});
    function definition(id){
        if(!Object.hasOwn(registry,id)){ throw new TypeError("unknown heroId"); }
        return registry[id];
    }
    function integer(value,min,max,label){
        if(!Number.isSafeInteger(value)||value<min||value>max){ throw new RangeError(label); }
        return value;
    }
    function seed(value){ return integer(value,1,0xffffffff,"allocationSeed must be a nonzero uint32"); }
    function defaultState(id){ return {heroId:id,unlocked:false,specificFragments:0,stars:0,allocationSeed:1,allocationVersion:1}; }
    function normalizeAccountState(input){
        if(input===undefined||input===null){ return {schemaVersion:1,heroes:Object.fromEntries(Object.keys(registry).map(id=>[id,defaultState(id)]))}; }
        if(input.schemaVersion!==1||!input.heroes||typeof input.heroes!=="object"||Array.isArray(input.heroes)){ throw new TypeError("unsupported/corrupt hero schema"); }
        if(Object.keys(input.heroes).some(id=>!Object.hasOwn(registry,id))){ throw new TypeError("unknown persisted hero"); }
        const heroes={};
        for(const id of Object.keys(registry)){
            const row=input.heroes[id];
            if(row===undefined){ heroes[id]=defaultState(id); continue; }
            if(!row||row.heroId!==id||typeof row.unlocked!=="boolean"||row.allocationVersion!==1){ throw new TypeError("corrupt hero state"); }
            heroes[id]={heroId:id,unlocked:row.unlocked,specificFragments:integer(row.specificFragments,0,Number.MAX_SAFE_INTEGER,"fragments"),stars:integer(row.stars,0,5,"stars"),allocationSeed:seed(row.allocationSeed),allocationVersion:1};
            if(!row.unlocked&&row.stars!==0){ throw new TypeError("locked hero cannot have stars"); }
        }
        return {schemaVersion:1,heroes};
    }
    function allocate(id,budget,allocationSeed){
        const entry=definition(id); seed(allocationSeed); integer(budget,0,570,"allocation budget");
        const result=Object.fromEntries(Object.keys(weights[entry.archetype]).map(stat=>[stat,0]));
        // Version 1: hero identity mixed into xorshift32; each point consumes one roll.
        let random=allocationSeed;
        for(const char of id){ random=Math.imul(random^char.charCodeAt(0),16777619)>>>0; }
        if(!random){ random=0x9e3779b9; }
        for(let point=0;point<budget;point++){
            random^=random<<13; random^=random>>>17; random^=random<<5; random>>>=0;
            const roll=random/4294967296*100;
            let cumulative=0;
            for(const [stat,weight] of Object.entries(weights[entry.archetype])){
                cumulative+=weight;
                if(roll<cumulative){ result[stat]++; break; }
            }
        }
        return result;
    }
    function createDomain(account,characters,projectPlayerStats,getSkillDefinition){
        const state=normalizeAccountState(account);
        const row=id=>{ definition(id); return state.heroes[id]; };
        const level=id=>{
            definition(id);
            const created=characters().filter(character=>character&&String(character.id||"").trim());
            if(!created.length){ throw new Error("hero projection requires a created player character"); }
            return Math.min(...created.map(character=>integer(character.level,1,100,"player level")));
        };
        const budget=id=>(level(id)-1)*5+row(id).stars*15;
        const canUnlock=id=>!row(id).unlocked&&row(id).specificFragments>=contract.unlockCost;
        const canStar=id=>row(id).unlocked&&row(id).stars<5&&row(id).specificFragments>=starCosts[row(id).stars];
        const canReroll=(id,availablePills)=>row(id).unlocked&&Number.isSafeInteger(availablePills)&&availablePills>=1;
        // Mutations return a new canonical account. Caller owns persistence/atomic consumption.
        const mutate=(id,operation)=>{ const next=normalizeAccountState(state); operation(next.heroes[id]); return next; };
        return Object.freeze({
            getHeroDefinition:definition,listHeroDefinitions:()=>Object.values(registry),
            getHeroAccountState:id=>({...row(id)}),isHeroUnlocked:id=>row(id).unlocked,
            getHeroLevel:level,getHeroSkillLevel:id=>Math.min(10,1+Math.floor(level(id)/10)),
            getHeroStarCost:currentStar=>starCosts[integer(currentStar,0,5,"currentStar")]??null,
            getHeroTotalAllocatablePoints:budget,getHeroAllocatedStats:id=>allocate(id,budget(id),row(id).allocationSeed),
            getHeroBaseStats:id=>projectPlayerStats({level:level(id),...allocate(id,budget(id),row(id).allocationSeed)},{}),
            getHeroSkillProjection:id=>({skillId:definition(id).rageSkillId,level:Math.min(10,1+Math.floor(level(id)/10)),definition:getSkillDefinition(definition(id).rageSkillId)}),
            canUnlockHero:canUnlock,canStarUpHero:canStar,canReroll,
            unlockHero:(id,allocationSeed)=>{ if(!canUnlock(id)){ throw new Error("hero unlock unavailable"); } seed(allocationSeed); return mutate(id,r=>{r.unlocked=true;r.specificFragments-=100;r.allocationSeed=allocationSeed;}); },
            unlockHeroDirect:(id,allocationSeed)=>{ if(row(id).unlocked){ throw new Error("hero already unlocked"); } seed(allocationSeed); return mutate(id,r=>{r.unlocked=true;r.allocationSeed=allocationSeed;}); },
            starUpHero:id=>{ if(!canStar(id)){ throw new Error("hero star up unavailable"); } return mutate(id,r=>{r.specificFragments-=starCosts[r.stars];r.stars++;}); },
            rerollHeroAllocation:(id,allocationSeed,availablePills)=>{ if(!canReroll(id,availablePills)){ throw new Error("hero reroll unavailable"); } seed(allocationSeed); if(allocationSeed===row(id).allocationSeed){ throw new Error("reroll requires a new seed"); } return mutate(id,r=>{r.allocationSeed=allocationSeed;}); },
            addSpecificFragments:(id,amount)=>{row(id);integer(amount,1,Number.MAX_SAFE_INTEGER,"fragment amount");return mutate(id,r=>{r.specificFragments=integer(r.specificFragments+amount,0,Number.MAX_SAFE_INTEGER,"fragment total");});},
            serialize:()=>normalizeAccountState(state)
        });
    }
    global.FourSymbolsHeroCore=Object.freeze({getHeroDefinition:definition,listHeroDefinitions:()=>Object.values(registry),weights,contract,normalizeAccountState,allocate,createDomain});
})(typeof window!=="undefined"?window:globalThis);
