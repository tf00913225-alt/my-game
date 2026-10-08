/* Diagnostic only. Never imported by production bundles. Uses formal stat and skill owners. */
function prepareWildBalanceReferenceParty(level,partySize=3){
    // Preserve the canonical player-only balance baseline on the DEV preview host.
    if(typeof window!=='undefined'&&window.location?.hostname==='dev.four-symbols-dev.pages.dev'&&!battleActive){
        window.FourSymbolsHeroBattle?.setRoster([]);
    }
    const budget=START_ATTRIBUTE_POINTS+(level-1)*5;
    const intelligence=Math.floor(budget*.35),vitality=Math.floor(budget*.2),energy=Math.floor(budget*.1),defensePoints=Math.floor(budget*.15),agility=Math.floor(budget*.15);
    const make=id=>({...player,id,level,element:'fire',attack:budget-intelligence-vitality-energy-defensePoints-agility,intelligence,vitality,energy,defensePoints,agility,
        bonusHP:(level-1)*30,bonusSP:(level-1)*10,attributePoints:0,activeBuffs:[],statusEffects:[],isDefending:false});
    Object.assign(player,make('Wild reference A'));player2=partySize>=2?make('Wild reference B'):null;player3=partySize>=3?make('Wild reference C'):null;
    const skill=level>=30?'phoenixCry':'fireRocket';
    const skillLevel=level>=10?10:1;
    const skillLevels=skill==='phoenixCry'?{fireRocket:1,blazeSpell:1,flameTornado:1,phoenixCry:10}:{fireRocket:skillLevel};
    const cost=Object.entries(skillLevels).reduce((sum,[id,n])=>sum+skillDatabase[id].learnCost+(n-1),0);
    if(cost>level*2||Object.keys(skillLevels).some(id=>skillDatabase[id].learnLevel>level))throw new Error('Illegal reference skill budget');
    for(let i=0;i<partySize;i++){
        const key=getPartyCharacterKey(i);characterEquipment[key]={};
        characterSkillLoadouts[key]={skillLevels:{...skillLevels},equippedSkills:[skill]};
        const ch=getPartyCharacterByIndex(i),stats=getPartyBattleStats(i);ch.hp=stats.maxHP;ch.sp=stats.maxSP;ch.skillPoints=level*2-cost;
    }
    return {level,budget,skill,skillLevel,skillCost:cost,skillBudget:level*2,equipment:'none',party:getExistingPartyIndexes().map(i=>getPartyBattleStats(i))};
}
function buildWildBalanceReferenceRoster(level,element,elite){
    const zone=level===10?'forest':level===30?'ice':level===50?'zone5':level===70?'zone7':'zone10';
    const count=level===10?3:6;
    const types=level===10?['physical','magic','tank']:['physical','magic','tank','speedControl','support','balanced'];
    const originals=zoneConfig[zone].monsters();
    const roster=types.map((archetype,i)=>{
        const original=originals.find(m=>m.element===element)||originals[i];
        const identity={...original.balanceProjection.identity,monsterKey:'diagnostic/'+i,name:'Reference '+archetype,level,element,archetype,rank:elite&&archetype==='tank'?'elite':'regular'};
        const m=configureBuiltMonster(MonsterBalance.build(identity));m.portraitKey=original.portraitKey;if(zone==='forest')m.v173BeginnerForest=true;return m;
    });
    return {zone,count,roster};
}
function chooseWildBalanceReferenceAction(index,skill){
    const candidates=currentBattleMonsters.filter(i=>monsters[i].alive&&monsters[i].hp>0);
    if(!candidates.length)return {action:'defend'};
    const type=getEffectiveSkillTargetType(skillDatabase[skill],10);
    let target=candidates[0],count=-1;
    for(const candidate of candidates){const n=getSkillTargets(candidate,type).length;if(n>count){target=candidate;count=n;}}
    return {action:skill,target:type==='all'?null:target};
}
