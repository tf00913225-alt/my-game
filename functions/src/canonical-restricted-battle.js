"use strict";

const {createCanonicalBattleEncounter,inspectPolicy}=require('./canonical-battle-encounter');
const {resolvePlainPlayerNormalAttack}=require('./canonical-battle-normal-attack');
const {claimRecordsDigest:digest}=require('./canonical-snapshot');
const restrictedPolicy=require('./generated/restricted-forest-instance-policy.json');
const openingPolicy=require('./generated/forest-opening-round-policy.json');
const playerPolicy=require('./generated/plain-player-normal-attack-policy.json');
const catalog=require('./generated/battle-encounter-catalog.json');
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const HASH=/^[a-f0-9]{64}$/;
const KIND='restricted-battle-instance';
const flags={combatRulesReady:false,outcomeVerified:false,rewardEligible:false,creditedToCharacter:false};
const copy=v=>JSON.parse(JSON.stringify(v));
const stamped=v=>v?.createdAt&&typeof v.createdAt.toMillis==='function';
const fields=['schemaVersion','kind','ownerUid','operationId','battleId','attemptId','attemptSha256',
  'encounterSha256','characterId','sourceRevision','snapshotSha256','creationSessionId','preparedAtMs',
  'expiresAtMs','policySha256','initialState',...Object.keys(flags)];
const recordDigest=v=>digest(Object.fromEntries(fields.map(k=>[k,v[k]])));
const noAuthority=v=>v&&Object.keys(flags).every(k=>v[k]===false);

function inspectBundle(bundle,sha256,encounterPolicy,encounterKey){
  if(!bundle||Object.keys(bundle).sort().join('|')!=='encounter|opening|player|restricted'||
    digest(bundle)!==sha256||inspectPolicy(bundle.encounter).sha256!==encounterPolicy.sha256){
    throw Error('Invalid original restricted battle policy bundle');
  }
  const {restricted:r,opening:o,player:p}=bundle;
  const entry=r?.entries?.[encounterKey];
  if(!noAuthority(r)||r.schemaVersion!==1||r.policyId!=='restricted-forest-instance-v1'||
    r.scope!=='private-initial-state-only'||!entry||entry.specSha256!==digest(encounterPolicy.entries[encounterKey].spec)||
    !Array.isArray(entry.attackSkills)||entry.attackSkills.length||
    !Array.isArray(entry.supportSkills)||entry.supportSkills.length||entry.skillChance!==0||
    r.roster?.players!==1||r.roster?.enemies!==1||r.roster.rankDraw!==false||
    r.lifecycle?.state!=='PREPARED'||r.lifecycle.round!==0||r.lifecycle.roundVersion!==0||
    r.lifecycle.acceptsRoundSubmission!==false||r.lifecycle.randomnessRequired!==false||
    !r.sourceDigests||Object.values(r.sourceDigests).some(h=>!HASH.test(h))||
    o?.schemaVersion!==1||o.policyId!=='forest-opening-round-v1'||!HASH.test(o.rulesSha256||'')||
    p?.schemaVersion!==1||p.policyId!=='plain-player-normal-attack-v1'||!HASH.test(p.rulesSha256||'')||
    [o,p].some(v=>v.combatRulesReady!==false||v.outcomeVerified!==false||v.rewardEligible!==false)){
    throw Error('Unsupported or corrupted restricted battle policy');
  }
  return bundle;
}

// Internal protected INITIAL STATE ONLY. No rounds, callable, gameplay writer,
// entropy, verdict or settlement. #791 observations are never consumed here.
function createCanonicalRestrictedBattle(dependencies){
  const {db,FieldValue,HttpsError,runProtected,now=Date.now}=dependencies;
  const encounters=createCanonicalBattleEncounter(dependencies);
  const fail=(code,message)=>{throw new HttpsError(code,message);};
  async function begin(request,args){
    if(!args||typeof args!=='object'||Array.isArray(args)||
      Object.keys(args).sort().join('|')!=='attemptId|expectedRevision|operationId'||
      typeof args.operationId!=='string'||typeof args.attemptId!=='string'||
      !ID.test(args.operationId||'')||!ID.test(args.attemptId||'')||
      args.operationId===args.attemptId||!Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<1||
      Object.keys(request?.data||{}).some(k=>!['uid','session'].includes(k))){
      fail('invalid-argument','Only preparation/operation IDs and source revision are accepted.');
    }
    const time=now();
    if(!Number.isSafeInteger(time)||time<1)fail('internal','Server clock is unavailable.');
    return runProtected(request,async(tx,session)=>{
      const uid=session.uid,{attemptId,operationId,expectedRevision}=args;
      const root=db.collection('serverUsers').doc(uid);
      const original=await encounters.readSeal(tx,session,{attemptId,expectedRevision},time);
      const {attempt,sealed,policy,snapshot,archive}=original;
      const ref=root.collection('restrictedBattles').doc(attemptId);
      const markerRef=root.collection('restrictedBattleAttempts').doc(attemptId);
      const receiptRef=root.collection('operations').doc(operationId);
      const [battleSnap,markerSnap,receiptSnap,accountSnap,envelopeSnap,grantSnap,ledgerSnap,otherAttemptSnap]=
        await Promise.all([tx.get(ref),tx.get(markerRef),tx.get(receiptRef),
          tx.get(root.collection('account').doc('current')),
          tx.get(db.collection('users').doc(uid).collection('saves').doc('current')),
          tx.get(root.collection('grantOperations').doc(operationId)),
          tx.get(root.collection('ledgerEntries').doc(operationId)),
          tx.get(root.collection('battleAttempts').doc(operationId))]);
      if(battleSnap.exists&&battleSnap.data().operationId!==operationId){
        fail('already-exists','Preparation already has a restricted battle instance.');
      }
      if(battleSnap.exists||markerSnap.exists||receiptSnap.exists){
        const b=battleSnap.exists?battleSnap.data():null;
        const m=markerSnap.exists?markerSnap.data():null;
        const receipt=receiptSnap.exists?receiptSnap.data():null;
        if(!b||!m||!receipt||grantSnap.exists||ledgerSnap.exists||otherAttemptSnap.exists||
          b.schemaVersion!==1||b.kind!==KIND||b.ownerUid!==uid||b.operationId!==operationId||
          b.battleId!==attemptId||b.attemptId!==attemptId||b.attemptSha256!==attempt.sha256||
          b.encounterSha256!==sealed.sha256||b.characterId!==attempt.characterId||
          b.sourceRevision!==expectedRevision||b.snapshotSha256!==snapshot.sha256||
          b.creationSessionId!==session.sessionId||!Number.isSafeInteger(b.preparedAtMs)||
          b.preparedAtMs<sealed.sealedAtMs||b.preparedAtMs>=attempt.expiresAtMs||
          b.expiresAtMs!==attempt.expiresAtMs||!HASH.test(b.policySha256||'')||
          !noAuthority(b)||b.sha256!==recordDigest(b)||
          receipt.schemaVersion!==1||receipt.kind!==KIND||receipt.ownerUid!==uid||
          receipt.operationId!==operationId||receipt.battleId!==attemptId||
          receipt.sourceRevision!==expectedRevision||receipt.battleSha256!==b.sha256||
          receipt.creditedToCharacter!==false||
          m.schemaVersion!==1||m.ownerUid!==uid||m.attemptId!==attemptId||
          m.operationId!==operationId||m.battleSha256!==b.sha256||
          [b,m,receipt].some(v=>!stamped(v))){
          fail('data-loss','Original battle instance, receipt or consumption marker is inconsistent.');
        }
        const pinnedSnap=await tx.get(root.collection('restrictedBattlePolicies').doc(b.policySha256));
        try{
          const pinned=pinnedSnap.exists?pinnedSnap.data():null;
          if(!pinned||pinned.schemaVersion!==1||pinned.ownerUid!==uid||!stamped(pinned))throw Error('policy record');
          inspectBundle(pinned.bundle,b.policySha256,policy,sealed.encounterKey);
          const state=b.initialState,source=archive.sourceRecords.characters[0].state;
          const stats=policy.entries[sealed.encounterKey].stats;
          if(!state||Object.keys(state).sort().join('|')!=='enemy|player|round|roundVersion|status'||
            state.status!=='PREPARED'||state.round!==0||state.roundVersion!==0||
            digest(state.player)!==digest({slot:'player-0',characterId:attempt.characterId,
              hp:source.hp,sp:source.sp,alive:true,visible:true,defending:false,skills:[],passives:[],effects:[]})||
            digest(state.enemy)!==digest({slot:'enemy-0',encounterKey:sealed.encounterKey,
              definitionSha256:sealed.definitionSha256,hp:stats.maxHP,sp:stats.maxSP,
              alive:true,visible:true,defending:false,skills:[],passives:[],effects:[]}))throw Error('state binding');
        }catch(_){fail('data-loss','Original pinned policy or restricted initial state is inconsistent.');}
        // Replay reads original PRIVATE evidence; never evaluates new deployment
        // formulas or regenerates a missing source/policy/instance.
        return result(b,true,time);
      }
      if(grantSnap.exists||ledgerSnap.exists||otherAttemptSnap.exists){
        fail('failed-precondition','Operation ID is already used.');
      }
      if(time<sealed.sealedAtMs||time>=attempt.expiresAtMs){
        fail('failed-precondition','Preparation is outside its original time window.');
      }
      if(accountSnap.data().serverRevision!==expectedRevision||
        envelopeSnap.data().serverRevision!==expectedRevision||accountSnap.data().snapshotSha256!==snapshot.sha256){
        fail('aborted','CLOUD_REVISION_CONFLICT');
      }
      const bundle={restricted:restrictedPolicy,opening:openingPolicy,player:playerPolicy,encounter:catalog};
      const policySha256=digest(bundle);
      try{inspectBundle(bundle,policySha256,policy,sealed.encounterKey);}catch(_){
        fail('failed-precondition','Original encounter is unsupported by current restricted rules.');
      }
      try{
        // Sole existing admission/stat owner. A guaranteed MISS is a pure query,
        // NOT a formal action, observed random sample or arithmetic proof.
        resolvePlainPlayerNormalAttack({uid,revision:expectedRevision,snapshot,archive,
          encounterPolicy:policy,encounterKey:sealed.encounterKey,randomTape:[0.999999999999]});
      }catch(_){fail('failed-precondition','Source skills, effects or modifiers are unsupported.');}
      const policyRef=root.collection('restrictedBattlePolicies').doc(policySha256);
      const pinnedSnap=await tx.get(policyRef);
      if(pinnedSnap.exists){
        try{const pinned=pinnedSnap.data();
          if(pinned.schemaVersion!==1||pinned.ownerUid!==uid||!stamped(pinned))throw Error('policy record');
          inspectBundle(pinned.bundle,policySha256,policy,sealed.encounterKey);
        }catch(_){fail('data-loss','Existing restricted policy evidence is inconsistent.');}
      }
      const source=archive.sourceRecords.characters[0].state,stats=policy.entries[sealed.encounterKey].stats;
      const initialState={status:'PREPARED',round:0,roundVersion:0,
        player:{slot:'player-0',characterId:attempt.characterId,hp:source.hp,sp:source.sp,
          alive:true,visible:true,defending:false,skills:[],passives:[],effects:[]},
        enemy:{slot:'enemy-0',encounterKey:sealed.encounterKey,definitionSha256:sealed.definitionSha256,
          hp:stats.maxHP,sp:stats.maxSP,alive:true,visible:true,defending:false,skills:[],passives:[],effects:[]}};
      const battle={schemaVersion:1,kind:KIND,ownerUid:uid,operationId,battleId:attemptId,attemptId,
        attemptSha256:attempt.sha256,encounterSha256:sealed.sha256,characterId:attempt.characterId,
        sourceRevision:expectedRevision,snapshotSha256:snapshot.sha256,creationSessionId:session.sessionId,
        preparedAtMs:time,expiresAtMs:attempt.expiresAtMs,policySha256,initialState,...flags};
      battle.sha256=recordDigest(battle);
      const createdAt=FieldValue.serverTimestamp();
      if(!pinnedSnap.exists)tx.create(policyRef,{schemaVersion:1,ownerUid:uid,bundle:copy(bundle),createdAt});
      tx.create(ref,{...battle,createdAt});
      tx.create(markerRef,{schemaVersion:1,ownerUid:uid,attemptId,operationId,battleSha256:battle.sha256,createdAt});
      tx.create(receiptRef,{schemaVersion:1,kind:KIND,ownerUid:uid,operationId,battleId:attemptId,
        sourceRevision:expectedRevision,battleSha256:battle.sha256,creditedToCharacter:false,createdAt});
      return result(battle,false,time);
    });
  }
  function result(b,unchanged,time){
    return {operationId:b.operationId,battleId:b.battleId,sourceRevision:b.sourceRevision,
      battleSha256:b.sha256,policySha256:b.policySha256,status:'PREPARED',round:0,roundVersion:0,
      expiresAtMs:b.expiresAtMs,expired:time>=b.expiresAtMs,unchanged,...flags};
  }
  return Object.freeze({begin});
}
module.exports={createCanonicalRestrictedBattle};
