import {MonsterBalance,towerLevelForFloor} from '../../js/combat/monster-balance-owner.mjs';

// Win/loss is difficulty evidence. This gate still rejects invalid combat data.
export function evaluateChallengeDiagnostic(rows,mode){
  if(!['tower','abyss'].includes(mode))throw new TypeError('Challenge mode required');
  const expectedCases=mode==='tower'?60:150;
  const seen=new Set(),invalidCases=[];
  if(rows.length!==expectedCases)invalidCases.push({reason:'matrix coverage'});
  for(const row of rows){
    const key=mode==='tower'?[row.element,row.floor,row.kind].join('/'):[row.difficulty,row.partyLevel,row.region,row.stage].join('/');
    const reasons=[];
    if(seen.has(key))reasons.push('duplicate case');seen.add(key);
    if(!Number.isInteger(row.rounds)||row.rounds<1||row.rounds>60||typeof row.clear!=='boolean'||!Number.isInteger(row.survivors)||row.survivors<0||row.survivors>row.partySize)reasons.push('invalid outcome');
    if(row.initialParty.length!==row.partySize||row.finalParty.length!==row.partySize||[...row.initialParty,...row.finalParty].some(hp=>!Number.isFinite(hp)||hp<0))reasons.push('invalid party resources');
    if(row.reference.skillCost>row.reference.skillBudget)reasons.push('illegal reference skill budget');
    const expectedUnits=mode==='tower'?10:(row.difficulty===40&&row.region===4&&row.stage===4?11:12);
    if(row.initialMonsters.length!==expectedUnits)reasons.push('roster size');
    for(const monster of row.initialMonsters){
      try{
        const p=MonsterBalance.preview(monster.spec);
        const level=mode==='tower'?towerLevelForFloor(row.floor):row.difficulty;
        if(monster.owner!=='MonsterBalance'||p.identity.mode!==mode||p.identity.level!==level||monster.level!==level)reasons.push('owner/level');
        for(const [field,projected] of Object.entries({hp:'maxHP',sp:'maxSP',attack:'physicalAttack',magicAttack:'magicAttack',defense:'defense',speed:'speed'})){
          if(!Number.isFinite(monster[field])||monster[field]<0||monster[field]!==p.final[projected])reasons.push('projection '+field);
        }
        if(monster.pressure!==p.finalDamagePressure)reasons.push('pressure');
      }catch{reasons.push('invalid formal spec');}
    }
    for(const roll of row.controlUsage?.rolls||[]){
      const cap=roll.targetRank==='regular'?90:roll.targetRank==='elite'?75:60;
      if(!Number.isFinite(roll.chance)||roll.chance<0||roll.chance>cap)reasons.push('hard-control cap');
    }
    if(reasons.length)invalidCases.push({key,reasons});
  }
  const instantWipes=mode==='abyss'?rows.filter(r=>r.firstRoundParty.every(hp=>hp<=0)):[];
  return {passed:invalidCases.length===0&&instantWipes.length===0,policy:'Unequipped reference losses are permitted difficulty evidence; formal projections, finite resources, legal skills, control caps and bounded execution remain required. Abyss retains no first-round wipe.',invalidCases,instantWipes};
}
