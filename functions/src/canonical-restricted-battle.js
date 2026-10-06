"use strict";

const {randomBytes:cryptoRandomBytes}=require('node:crypto');
const {sampleForestRepeatedRound}=require('./canonical-battle-opening-round');
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

// Internal protected restricted lifecycle. No callable, character writer,
// verdict or settlement. #791 observations are never consumed here.
function createCanonicalRestrictedBattle(dependencies){
  const {db,FieldValue,HttpsError,runProtected,now=Date.now,randomBytes=cryptoRandomBytes}=dependencies;
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
        const verified=await inspectInstance(tx,session,args,time,original,{battleSnap,markerSnap,receiptSnap,grantSnap,ledgerSnap,otherAttemptSnap});
        return result(verified.battle,true,time);
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
  async function inspectInstance(tx,session,args,time,original,snaps){
    const {attemptId,operationId,expectedRevision}=args,uid=session.uid;
    const root=db.collection('serverUsers').doc(uid);
    const {attempt,sealed,policy,snapshot,archive}=original;
    const {battleSnap,markerSnap,receiptSnap,grantSnap,ledgerSnap,otherAttemptSnap}=snaps;
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
        let pinnedBundle;
        const pinnedSnap=await tx.get(root.collection('restrictedBattlePolicies').doc(b.policySha256));
        try{
          const pinned=pinnedSnap.exists?pinnedSnap.data():null;
          if(!pinned||pinned.schemaVersion!==1||pinned.ownerUid!==uid||!stamped(pinned))throw Error('policy record');
          pinnedBundle=inspectBundle(pinned.bundle,b.policySha256,policy,sealed.encounterKey);
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
        return {battle:b,marker:m,bundle:pinnedBundle,original};
  }
  async function readInstance(tx,session,args,time){
    const root=db.collection('serverUsers').doc(session.uid);
    const original=await encounters.readSeal(tx,session,args,time);
    const battleSnap=await tx.get(root.collection('restrictedBattles').doc(args.attemptId));
    if(!battleSnap.exists)fail('data-loss','Original restricted instance is missing.');
    const operationId=battleSnap.data().operationId;
    const [markerSnap,receiptSnap,grantSnap,ledgerSnap,otherAttemptSnap]=await Promise.all([
      tx.get(root.collection('restrictedBattleAttempts').doc(args.attemptId)),
      tx.get(root.collection('operations').doc(operationId)),
      tx.get(root.collection('grantOperations').doc(operationId)),
      tx.get(root.collection('ledgerEntries').doc(operationId)),
      tx.get(root.collection('battleAttempts').doc(operationId))]);
    return inspectInstance(tx,session,{...args,operationId},time,original,
      {battleSnap,markerSnap,receiptSnap,grantSnap,ledgerSnap,otherAttemptSnap});
  }

  const roundPolicy={schemaVersion:1,policyId:'restricted-normal-round-writer-v1',maxRounds:128,
    action:'normal-attack',playerSlot:'player-0',targetSlot:'enemy-0',entropyBytes:42,...flags};
  const roundKind='restricted-battle-round';
  const roundFields=['schemaVersion','kind','ownerUid','operationId','battleId','battleSha256',
    'sourceRevision','creationSessionId','expiresAtMs','committedAtMs','policySha256','writerPolicy',
    'priorRoundSha256','projection',...Object.keys(flags)];
  const roundDigest=v=>digest(Object.fromEntries(roundFields.map(k=>[k,v[k]])));
  const initialRoundState=b=>({round:0,roundVersion:0,playerHP:b.initialState.player.hp,
    playerSP:b.initialState.player.sp,enemyHP:b.initialState.enemy.hp,enemySP:b.initialState.enemy.sp});
  function inspectRound(r,receipt,b,bundle,priorState,priorHash,version,priorTime){
    try{
      const p=r?.projection,{sha256,...body}=p||{};
      if(!r||!receipt||r.schemaVersion!==1||r.kind!==roundKind||r.ownerUid!==b.ownerUid||
        !ID.test(r.operationId||'')||r.battleId!==b.battleId||r.battleSha256!==b.sha256||
        r.sourceRevision!==b.sourceRevision||r.creationSessionId!==b.creationSessionId||
        r.expiresAtMs!==b.expiresAtMs||!Number.isSafeInteger(r.committedAtMs)||
        r.committedAtMs<priorTime||r.committedAtMs>=b.expiresAtMs||r.policySha256!==b.policySha256||
        digest(r.writerPolicy)!==digest(roundPolicy)||r.priorRoundSha256!==priorHash||
        !noAuthority(r)||r.sha256!==roundDigest(r)||!stamped(r)||!stamped(receipt)||
        digest(Object.fromEntries(Object.keys(roundReceipt(r)).map(k=>[k,receipt[k]])))!==digest(roundReceipt(r))||
        !p||p.schemaVersion!==1||p.kind!=='restricted-forest-round-arithmetic'||!noAuthority(p)||
        sha256!==digest(body)||p.ownerUid!==b.ownerUid||p.sourceRevision!==b.sourceRevision||
        p.characterId!==b.characterId||p.snapshotSha256!==b.snapshotSha256||
        p.encounterKey!==b.initialState.enemy.encounterKey||
        p.definitionSha256!==b.initialState.enemy.definitionSha256||
        p.encounterPolicySha256!==bundle.encounter.sha256||
        p.openingRulesPolicySha256!==digest(bundle.opening)||p.playerRulesPolicySha256!==digest(bundle.player)||
        p.restrictedPolicySha256!==digest(bundle.restricted)||digest(p.priorState)!==digest(priorState)||
        p.priorStateSha256!==digest(priorState)||p.nextStateSha256!==digest(p.nextState)||
        p.nextState?.round!==version||p.nextState.roundVersion!==version||
        Object.keys(p.nextState).sort().join('|')!=='enemyHP|enemySP|playerHP|playerSP|round|roundVersion'||
        !Array.isArray(p.randomTape)||p.randomTape.length<3||p.randomTape.length>7||
        p.randomSamplesConsumed!==p.randomTape.length||
        p.randomTape.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)||
        !Array.isArray(p.initiative)||p.initiative.length!==2||
        new Set(p.initiative.map(a=>a.type)).size!==2||p.initiative.some(a=>!['player','monster'].includes(a.type))||
        !Array.isArray(p.actions)||p.actions.length!==2)throw Error('binding');
      let playerHP=priorState.playerHP,enemyHP=priorState.enemyHP,samples=2;
      if(playerHP<1||enemyHP<1)throw Error('terminal predecessor');
      for(let i=0;i<2;i++){
        const a=p.actions[i];
        if(a.actor!==p.initiative[i].type)throw Error('initiative');
        if(!playerHP||!enemyHP){
          if(digest(a)!==digest({actor:a.actor,skipped:true,reason:'combatant-dead'}))throw Error('dead skip');
          continue;
        }
        const hp=a.actor==='player'?enemyHP:playerHP;
        const count=a.hit?(a.actor==='player'?3:2):1;
        if(a.skipped!==false||typeof a.hit!=='boolean'||typeof a.isCrit!=='boolean'||
          !Number.isSafeInteger(a.damage)||a.damage<0||a.damage>1000000000||
          (!a.hit&&(a.damage!==0||a.isCrit))||(a.actor==='monster'&&a.isCrit)||
          a.hpBefore!==hp||a.hpAfter!==Math.max(0,hp-a.damage)||a.randomSamplesConsumed!==count)throw Error('action');
        samples+=count;if(a.actor==='player')enemyHP=a.hpAfter;else playerHP=a.hpAfter;
      }
      if(samples!==p.randomSamplesConsumed||p.playerHPBefore!==priorState.playerHP||
        p.enemyHPBefore!==priorState.enemyHP||p.playerHPAfter!==playerHP||p.enemyHPAfter!==enemyHP||
        digest(p.nextState)!==digest({...priorState,round:version,roundVersion:version,playerHP,enemyHP}))throw Error('resources');
    }catch(_){fail('data-loss','Committed round, receipt or original version chain is inconsistent.');}
    return r;
  }
  function roundReceipt(r){
    return {schemaVersion:1,kind:roundKind,ownerUid:r.ownerUid,operationId:r.operationId,
      battleId:r.battleId,sourceRevision:r.sourceRevision,expectedRoundVersion:r.projection.priorState.roundVersion,
      roundVersion:r.projection.nextState.roundVersion,roundSha256:r.sha256,creditedToCharacter:false};
  }
  async function readRounds(tx,root,verified){
    const {battle:b,marker:m,bundle}=verified,head=m.roundHead;
    const count=head?.roundVersion??0;
    if((head&&(!Number.isSafeInteger(count)||count<1||count>roundPolicy.maxRounds||
      Object.keys(head).sort().join('|')!=='roundSha256|roundVersion'||!HASH.test(head.roundSha256||'')))||
      (Object.hasOwn(m,'roundHead')&&!head))fail('data-loss','Round head is invalid.');
    const roundRef=v=>root.collection('restrictedBattleRounds').doc(b.battleId+'_'+v);
    // Always inspect the successor: a lost/rewound pointer cannot overwrite it.
    const snaps=await Promise.all(Array.from({length:count+1},(_,i)=>tx.get(roundRef(i+1))));
    if(snaps[count].exists)fail('data-loss','Round head omits committed successor evidence.');
    let state=initialRoundState(b),hash=b.sha256,time=b.preparedAtMs;
    const rounds=[];
    for(let i=0;i<count;i++){
      if(!snaps[i].exists)fail('data-loss','Committed round is missing.');
      const r=snaps[i].data();
      if(typeof r.operationId!=='string'||!ID.test(r.operationId))fail('data-loss','Round operation is invalid.');
      const receiptSnap=await tx.get(root.collection('operations').doc(r.operationId));
      inspectRound(r,receiptSnap.exists?receiptSnap.data():null,b,bundle,state,hash,i+1,time);
      rounds.push(r);state=r.projection.nextState;hash=r.sha256;time=r.committedAtMs;
    }
    if(head&&hash!==head.roundSha256)fail('data-loss','Round head digest is inconsistent.');
    return {state,hash,time,rounds,roundRef};
  }
  async function advance(request,args){
    if(!args||typeof args!=='object'||Array.isArray(args)||
      Object.keys(args).sort().join('|')!=='action|attemptId|expectedRevision|expectedRoundVersion|operationId'||
      typeof args.operationId!=='string'||typeof args.attemptId!=='string'||
      !ID.test(args.operationId)||!ID.test(args.attemptId)||args.operationId===args.attemptId||
      !Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<1||
      !Number.isSafeInteger(args.expectedRoundVersion)||args.expectedRoundVersion<0||
      args.expectedRoundVersion>=roundPolicy.maxRounds||
      digest(args.action)!==digest({type:'normal-attack',actor:'player-0',target:'enemy-0'})||
      Object.keys(request?.data||{}).some(k=>!['uid','session'].includes(k))){
      fail('invalid-argument','Only original IDs, expected versions and the restricted normal attack declaration are accepted.');
    }
    const requestTime=now();
    if(!Number.isSafeInteger(requestTime)||requestTime<1)fail('internal','Server clock is unavailable.');
    // One cryptographic pool per invocation, outside all transaction retries.
    const bytes=randomBytes(42);
    if(!Buffer.isBuffer(bytes)||bytes.length!==42)fail('internal','Server entropy is unavailable.');
    const pool=Array.from({length:7},(_,i)=>bytes.readUIntBE(i*6,6)/281474976710656);
    return runProtected(request,async(tx,session)=>{
      const time=now();
      if(!Number.isSafeInteger(time)||time<1)fail('internal','Server clock is unavailable.');
      const {attemptId,operationId,expectedRevision,expectedRoundVersion}=args;
      const root=db.collection('serverUsers').doc(session.uid);
      const verified=await readInstance(tx,session,{attemptId,expectedRevision},time);
      const {battle:b,bundle,original}=verified;
      const chain=await readRounds(tx,root,verified);
      const receiptRef=root.collection('operations').doc(operationId);
      const [receiptSnap,grantSnap,ledgerSnap,attemptSnap,accountSnap,envelopeSnap]=await Promise.all([
        tx.get(receiptRef),tx.get(root.collection('grantOperations').doc(operationId)),
        tx.get(root.collection('ledgerEntries').doc(operationId)),tx.get(root.collection('battleAttempts').doc(operationId)),
        tx.get(root.collection('account').doc('current')),
        tx.get(db.collection('users').doc(session.uid).collection('saves').doc('current'))]);
      if(grantSnap.exists||ledgerSnap.exists||attemptSnap.exists)fail('failed-precondition','Operation ID is already used.');
      const replay=chain.rounds.find(r=>r.operationId===operationId);
      if(replay){
        if(replay.projection.priorState.roundVersion!==expectedRoundVersion)fail('failed-precondition','Operation intent differs.');
        return roundResult(replay,true,time);
      }
      if(receiptSnap.exists)fail('data-loss','Operation receipt lacks matching committed round evidence.');
      if(expectedRoundVersion!==chain.state.roundVersion)fail('aborted','BATTLE_ROUND_VERSION_CONFLICT');
      if(time<chain.time||time>=b.expiresAtMs)fail('failed-precondition','Battle is outside its original time window.');
      if(!chain.state.playerHP||!chain.state.enemyHP)fail('failed-precondition','Terminal resources cannot advance.');
      if(accountSnap.data()?.serverRevision!==expectedRevision||envelopeSnap.data()?.serverRevision!==expectedRevision||
        accountSnap.data()?.snapshotSha256!==b.snapshotSha256)fail('aborted','CLOUD_REVISION_CONFLICT');
      if(digest(bundle)!==digest({restricted:restrictedPolicy,opening:openingPolicy,player:playerPolicy,encounter:catalog})){
        fail('failed-precondition','New execution requires the original deployment policy.');
      }
      let cursor=0,projection;
      try{projection=sampleForestRepeatedRound({uid:session.uid,revision:expectedRevision,
        snapshot:original.snapshot,archive:original.archive,encounterPolicy:original.policy,
        encounterKey:original.sealed.encounterKey,currentState:chain.state},()=>pool[cursor++]);
      }catch(_){fail('failed-precondition','Restricted round sources or action are unsupported.');}
      const r={schemaVersion:1,kind:roundKind,ownerUid:session.uid,operationId,battleId:attemptId,
        battleSha256:b.sha256,sourceRevision:expectedRevision,creationSessionId:session.sessionId,
        expiresAtMs:b.expiresAtMs,committedAtMs:time,policySha256:b.policySha256,
        writerPolicy:copy(roundPolicy),priorRoundSha256:chain.hash,projection,...flags};
      r.sha256=roundDigest(r);
      // A retry or slow source read must not commit beyond the original window.
      const commitTime=now();
      if(!Number.isSafeInteger(commitTime)||commitTime<time||commitTime>=b.expiresAtMs){
        fail('failed-precondition','Battle expired before commit.');
      }
      const createdAt=FieldValue.serverTimestamp(),receipt=roundReceipt(r);
      inspectRound({...r,createdAt},{...receipt,createdAt},b,bundle,chain.state,chain.hash,
        expectedRoundVersion+1,chain.time);
      tx.create(chain.roundRef(expectedRoundVersion+1),{...r,createdAt});
      tx.create(receiptRef,{...receipt,createdAt});
      tx.update(root.collection('restrictedBattleAttempts').doc(attemptId),
        {roundHead:{roundVersion:expectedRoundVersion+1,roundSha256:r.sha256}});
      return roundResult(r,false,time);
    });
  }
  function roundResult(r,unchanged,time){
    return {operationId:r.operationId,battleId:r.battleId,sourceRevision:r.sourceRevision,
      roundVersion:r.projection.nextState.roundVersion,roundSha256:r.sha256,policySha256:r.policySha256,
      expiresAtMs:r.expiresAtMs,expired:time>=r.expiresAtMs,unchanged,...flags};
  }

  function result(b,unchanged,time){
    return {operationId:b.operationId,battleId:b.battleId,sourceRevision:b.sourceRevision,
      battleSha256:b.sha256,policySha256:b.policySha256,status:'PREPARED',round:0,roundVersion:0,
      expiresAtMs:b.expiresAtMs,expired:time>=b.expiresAtMs,unchanged,...flags};
  }
  return Object.freeze({begin,advance});
}
module.exports={createCanonicalRestrictedBattle};
