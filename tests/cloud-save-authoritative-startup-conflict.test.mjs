import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {createRequire} from "node:module";
import {storeHarness,selection,copy} from "../scripts/test-helpers/canonical-store-harness.mjs";
const require=createRequire(import.meta.url);
const {assembleCanonicalPlayableProjection}=require("../functions/src/canonical-snapshot");

function deferredMigration(){
    const values=new Map([['battle_full_version_save_v5',JSON.stringify({player:{id:'legacy-original'}})]]),writes=[];
    const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push(key);values.set(key,String(value));},
        removeItem:key=>{writes.push(key);values.delete(key);},key:index=>[...values.keys()][index]??null,get length(){return values.size;}};
    const global={localStorage:store};global.window=global;vm.createContext(global);
    vm.runInContext(readFileSync(new URL('../js/startup/account-save-repository.js',import.meta.url),'utf8'),global);
    const repo=global.FourSymbolsAccountSave;repo.activate('migration-a');writes.length=0;
    let resume,reject;const shell=new Promise((yes,no)=>{resume=yes;reject=no;});
    const operations=readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8').split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */')[1].split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */')[0];
    const branch=source.slice(source.indexOf('                if(action==="confirm-migration"'),source.indexOf('                if(action==="cancel-migration"'));
    const failSource=source.slice(source.indexOf('    function fail('),source.indexOf('    function reloadForAccountTransition('));
    const make=new Function('global','shell','install',`
        let activeUser={uid:'migration-a'},transitionToken=1,state='MIGRATION_REQUIRED',cloudResult={data:{authoritativeStateReady:false}},saveResolved=false,lastError=null;
        let session={uid:'migration-a',status:'active',sessionId:'first'};
        const STATES={MIGRATION_REQUIRED:'MIGRATION_REQUIRED',ERROR:'ERROR'},errors=[],ready=[];
        const firebase={getUser:()=>activeUser,getGameSessionState:()=>session};
        const sessionView=()=>JSON.stringify(session),requireAppShell=()=>shell.then(install);
        const showCity=()=>{},showLoader=()=>{},status=()=>{},accountUi=()=>{};
        const transition=value=>{state=value;},emit=(name)=>{if(name==='four-symbols:startup-error')errors.push(lastError);};
        const enterReady=async save=>{ready.push(save);};
        ${failSource}
        return {run:async()=>{const action='confirm-migration';${branch}},
            cancel:()=>{++transitionToken;state='AUTH_REQUIRED';activeUser=null;},
            switchUid:()=>{++transitionToken;state='SAVE_LOADING';activeUser={uid:'migration-b'};},
            changeSession:()=>{session={uid:'migration-a',status:'blocked',sessionId:'replaced'};},
            state:()=>state,errors,ready};
    `);
    const f=make(global,shell,()=>vm.runInContext(operations,global));
    return {...f,repo,global,values,writes,resume,reject};
}

test('deferred original writer refuses unloaded migration and save before any writes',()=>{
    const f=deferredMigration(),before=JSON.stringify([...f.values]);
    assert.throws(()=>f.repo.writeForUid('migration-a',{player:{id:'a'}}),e=>e.code==='account-writer-unavailable');
    assert.throws(()=>f.repo.migrateLegacyToUid('migration-a',{confirmed:true}),e=>e.code==='account-writer-unavailable');
    assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([...f.values]),before);
});

test('actual confirmed-migration action waits for shell and rejects changed identity or bytes without writes',async()=>{
    for(const change of ['none','cancel','uid','session','legacy','local','shell-failure']){
        const f=deferredMigration(),pending=f.run();assert.deepEqual(f.writes,[]);
        if(change==='cancel')f.cancel();
        if(change==='uid')f.switchUid();
        if(change==='session')f.changeSession();
        if(change==='legacy')f.values.set('battle_full_version_save_v5',JSON.stringify({player:{id:'changed-legacy'}}));
        if(change==='local'){
            f.values.set(f.repo.saveKey('migration-a'),JSON.stringify({player:{id:'changed-local'}}));
            f.values.set(f.repo.metadataKey('migration-a'),JSON.stringify({ownerUid:'migration-a'}));
        }
        const before=JSON.stringify([...f.values]);
        if(change==='shell-failure')f.reject(Error('app-shell unavailable'));else f.resume();
        await pending;
        if(change==='none'){
            assert.equal(f.repo.readForUid('migration-a').save.player.id,'legacy-original');
            assert.equal(f.ready.length,1);assert.equal(f.errors.length,0);
        }else{
            assert.deepEqual(f.writes,[],change);assert.equal(JSON.stringify([...f.values]),before,change);assert.equal(f.ready.length,0,change);
        }
    }
});

test('late shell rejection after cancel or UID replacement cannot overwrite the new startup state',async()=>{
    for(const change of ['cancel','uid']){
        const f=deferredMigration(),pending=f.run();
        if(change==='cancel')f.cancel();else f.switchUid();
        const before=f.state();f.reject(Error('late old app-shell failure'));await pending;
        assert.equal(f.state(),before);assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);
    }
});

// Execute the real decision branch without booting the browser or Firebase.
const source=readFileSync(new URL("../js/52-v173.20-startup-loader.js",import.meta.url),"utf8");
const start=source.indexOf("        let selectedSave=authoritative;");
const end=source.indexOf("        if(authoritative){",start);
assert.ok(start>=0 && end>start);
const select=new Function("authoritative","local","repo","user","migration","fail","token",
    `${source.slice(start,end)}\nreturn {selectedSave};`);

function run(local){
    const cloud={player:{id:"a"},gold:100};
    const writes=[];
    const conflicts=[];
    const repo={
        fingerprint:save=>JSON.stringify(save),
        writeForUid:(...args)=>writes.push(args)
    };
    const result=select(cloud,local,repo,{uid:"uid-a"},(...args)=>{
        conflicts.push(args);
        return {blocked:true};
    },error=>{ throw error; },0);
    return {cloud,result,writes,conflicts};
}

test("an identical UID cache reads the cloud snapshot and repairs provenance only",()=>{
    const cloud={player:{id:"a"},gold:100};
    const fingerprint=JSON.stringify(cloud);
    const {result,writes,conflicts}=run({status:"ready",save:cloud,metadata:{cloudBaseFingerprint:fingerprint,localDirty:true}});
    assert.deepEqual(result.selectedSave,cloud);
    assert.equal(writes.length,1);
    assert.equal(writes[0][2].localDirty,false);
    assert.equal(conflicts.length,0);
});

test("a changed local save with a matching base stays intact and blocks gameplay",()=>{
    const cloud={player:{id:"a"},gold:100};
    const candidate={player:{id:"a"},gold:999999};
    const {result,writes,conflicts}=run({status:"ready",save:candidate,metadata:{cloudBaseFingerprint:JSON.stringify(cloud),localDirty:true}});
    assert.deepEqual(result,{blocked:true});
    assert.equal(writes.length,0);
    assert.equal(conflicts.length,1);
    assert.equal(conflicts[0][1],true);
    assert.deepEqual(candidate,{player:{id:"a"},gold:999999});
});

test("an unrelated local save also blocks without overwriting either copy",()=>{
    const {result,writes,conflicts}=run({status:"ready",save:{player:{id:"b"}},metadata:{cloudBaseFingerprint:null}});
    assert.deepEqual(result,{blocked:true});
    assert.equal(writes.length,0);
    assert.equal(conflicts.length,1);
});

test("suspend cannot overwrite a local candidate while startup is blocked",()=>{
    const main=readFileSync(new URL("../js/00-main.js",import.meta.url),"utf8");
    const start=main.indexOf("    function persistBeforeSuspend(reason){");
    const end=main.indexOf('    document.addEventListener("v173.20:startup-entered"',start);
    assert.ok(start>=0 && end>start);
    const calls=[];
    let state="MIGRATION_REQUIRED";
    const lifecycleDiagnostics={backgroundSaveCount:0};
    const make=new Function("window","saveGame","lifecycleDiagnostics",
        `${main.slice(start,end)}\nreturn persistBeforeSuspend;`);
    const persist=make({FourSymbolsStartupPolicy:{getState:()=>state}},value=>{calls.push(value);return true;},lifecycleDiagnostics);
    for(const blocked of ["MIGRATION_REQUIRED","SAVE_LOADING","ERROR","NEED_CHARACTER"]){
        state=blocked;persist("pagehide");
    }
    assert.equal(calls.length,0);
    state="READY";persist("pagehide");
    state="OFFLINE_READY";persist("pagehide");
    assert.equal(calls.length,2);
    assert.equal(lifecycleDiagnostics.backgroundSaveCount,2);
});

// Local transport rehearsal only. Backend envelopes remain unpublished/false;
// this substitute does not establish backup, publication or restore authority.
async function lawfulCuts(){
    const h=storeHarness(),cuts=[];
    const capture=()=>{
        const records=h.data.get(h.root+'/recoveryArchives/'+h.revision).sourceRecords;
        const bundle=assembleCanonicalPlayableProjection(h.uid,h.revision,records);
        assert.equal(bundle.projection.authoritativeStateReady,false);
        assert.equal(h.data.get(h.save).authoritativeStateReady,false);
        cuts.push({bundleVersion:1,ownerUid:h.uid,serverRevision:h.revision,canonicalRevision:h.revision,
            sourceSnapshotSha256:bundle.projection.sourceSnapshotSha256,
            gameSave:copy(bundle.projection.gameSave),sidecars:copy(bundle.projection.sidecars)});
    };
    await h.initial.commitInitialSources(h.request(),{operationId:'bundle-initial-00001',expectedRevision:1,selection});capture();
    h.advance(86400000);
    await h.initial.observeDailyPeriod(h.request(),{operationId:'bundle-observe-00001',expectedRevision:h.revision});
    const periodId='daily-period-'+require('../functions/src/daily-checkin-policy').taipeiDay(h.clock);
    await h.initial.applyDailyPeriod(h.request(),{operationId:'bundle-period-000001',periodId,expectedRevision:h.revision});capture();
    const acquisition=require('../functions/src/hero-acquisition').createHeroAcquisition(h.dependencies);
    const growth=require('../functions/src/hero-growth').createHeroGrowth({...h.dependencies,acquisition});
    const formation=require('../functions/src/team-formation').createTeamFormation({...h.dependencies,readContext:growth.readInTransaction});
    await formation.save({...h.request(),data:{...h.request().data,operationId:'bundle-formation-001',expectedRevision:h.revision,
        formation:{version:2,characterIndexToSlot:{0:'ALLY_B1'},heroIdToSlot:{}}}});capture();
    return {h,cuts};
}
function adoptionFixture(uid){
    const values=new Map(),ready=[],errors=[];let fault=()=>false;
    const storage={getItem:key=>values.get(key)??null,
        setItem(key,value){if(fault(key,value))throw Error('quota fixture');values.set(key,String(value));},
        removeItem(key){if(fault(key,null))throw Error('quota fixture');values.delete(key);}};
    const noop=()=>{},context={console,localStorage:storage,JSON,Date,Error,Object,Array,String,
        player:{},player2:null,player3:null,characters:[],characterEquipment:{fire:{}},characterSkillLoadouts:{fire:{skillLevels:{},equippedSkills:[]}},
        autoConfig:{},autoConfig2:{},autoConfig3:{},inventoryItems:[],sharedExp:0,gold:0,
        dailyQuestState:{},commissionQuestState:{},bestiaryData:{},achievementState:{},selectedCreationElement:'fire',
        deleteAllCharactersInProgress:false,elementDatabase:{fire:{},water:{},earth:{},wind:{}},skillDatabase:{flameSlash:{}},
        FourSymbolsHeroCore:require('../functions/src/hero-core'),FourSymbolsTeamFormationPolicy:require('../functions/src/team-formation-policy'),
        FourSymbolsEquipmentFactory:require('../js/equipment-factory'),
        normalizeAutoBattleThreshold:(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback,
        getExistingPartyIndexes:()=>[0],getMainCharacterStats:()=>({maxHP:1000000,maxSP:1000000}),
        getPartyCharacterByIndex:()=>null,getPartyBattleStats:()=>null,$:()=>({style:{}}),
        document:{dispatchEvent:()=>{}},CustomEvent:class{constructor(name){this.type=name;}},
        FourSymbolsHomeRelicSummary:{prepareFirstScreenVisuals:()=>{context.__visualEntered=true;return context.__visualWait||Promise.resolve();}}};
    // Unchanged rendering/stat/legacy helpers are dependencies, not the subject
    // of this save-adoption test. Execute the original save/load bodies fully.
    for(const name of ['migrateLegacySixStats','calculateOfflineExpSince','normalizeEquipmentSlots','migrateLegacyEquipmentStats',
        'hydrateEquipmentReforge','normalizePotionInventoryFromLegacy','rebuildInventorySlots','updatePlayerHeader','showPage',
        'updateUI','renderInventory','renderSkillLoadout','normalizeInventoryStacks'])context[name]=noop;
    context.window=context;vm.createContext(context);
    vm.runInContext((readFileSync(new URL('../js/startup/account-save-repository.js',import.meta.url),'utf8')+readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8').split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */')[1].split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */')[0]),context);
    const main=readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8'),ownerStart=main.indexOf('let SAVE_KEY=null;');
    vm.runInContext(main.slice(ownerStart,main.indexOf('\n});',ownerStart)+4),context);
    vm.runInContext(main.slice(main.indexOf('function saveGame(options={}){'),main.indexOf('function showCreation(){',main.indexOf('function loadGame(){'))),context);
    const repo=context.FourSymbolsAccountSave;let response,user={uid},session={uid,status:'active',sessionId:'session-one'};
    const firebase={getUser:()=>user,getGameSessionState:()=>session,resolveCloudSave:async()=>typeof response==='function'?response():response,
        setUiState:noop,closeAuth:noop};
    const payload=source.slice(source.indexOf('    function cloudPayload('),source.indexOf('    function domReady('));
    const empty=source.slice(source.indexOf('    function safeCloudEmpty('),source.indexOf('    function cloudPayload('));
    const resolver=source.slice(source.indexOf('    async function resolveSaveFor('),source.indexOf('    function requireAuth('));
    const enter=source.slice(source.indexOf('    async function enterReady('),source.indexOf('    async function enterCreation('));
    const make=new Function('global','firebase','ready','errors',`
        let transitionToken=0,activeUser,resolvedUid,saveResolved,cloudResult,lastError,state;
        const STATES={SAVE_LOADING:'SAVE_LOADING',READY:'READY',OFFLINE_READY:'OFFLINE_READY'},showCity=()=>{},startAppShell=()=>{},transition=value=>{state=value;},showLoader=()=>{},status=()=>{},accountUi=()=>{},mark=()=>{};
        const requireAppShell=()=>global.__appShellWait||Promise.resolve(),domReady=()=>Promise.resolve(),hideLoader=()=>Promise.resolve();
        const activateGameplaySaveOwner=()=>global.FourSymbolsGameSave.activate(activeUser.uid);
        const document=global.document,CustomEvent=global.CustomEvent,emit=(name,detail)=>{if(name==='four-symbols:startup-ready')ready.push(detail);};
        const sessionView=()=>JSON.stringify(firebase.getGameSessionState());
        const fail=error=>{errors.push(error);return {blocked:true,error};};
        const migration=()=>({blocked:true}),enterCreation=async()=>({creation:true});
        ${empty}\n${payload}\n${enter}\n${resolver}\nreturn resolveSaveFor;`);
    const resolve=make(context,firebase,ready,errors);
    return {repo,values,ready,errors,runtime:context,fault:fn=>{fault=fn;},session:value=>{session=value;},
        async load(bundle,{published=true,mutate,waiting}={}){
            const before=ready.length;
            response=waiting||{uid,exists:true,serverConfirmed:true,data:{ownerUid:uid,serverRevision:bundle.serverRevision,
                authoritativeStateReady:published,cloudBundle:copy(bundle)}};
            if(mutate)mutate(response);return resolve(user).then(result=>result||(ready.length>before?{ready:true}:undefined));
        }};
}
test('original lawful cuts traverse actual Boot/repository main and sidecars, preserve revisions and old bytes',async()=>{
    const {h,cuts}=await lawfulCuts(),f=adoptionFixture(h.uid);
    assert.notDeepEqual(cuts[0].sidecars,cuts[1].sidecars);
    assert.notDeepEqual(cuts[2].gameSave.allyFormation,cuts[1].gameSave.allyFormation,'formation comes from the original protected writer');
    let firstMain;
    for(const cut of cuts){
        const loaded=await f.load(cut);assert.equal(loaded.ready,true,loaded.error?.stack);
        const local=f.repo.readForUid(h.uid);
        const normalized=copy(cut.gameSave);normalized.lastSaveTimestamp=local.save.lastSaveTimestamp;
        delete normalized.characterSkillLoadouts.fire.name;
        for(const hero of require('../functions/src/hero-core').listHeroDefinitions())normalized.characterEquipment['heroNpc:'+hero.heroId]=
            {head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null};
        assert.deepEqual(local.save,normalized,'full original hydrate/save normalization preserves every other main field');
        assert.deepEqual(JSON.parse(JSON.stringify(f.runtime.player)),cut.gameSave.player);
        assert.equal(local.metadata.cloudBaseFingerprint,f.repo.fingerprint(cut.gameSave));
        assert.equal(local.metadata.cloudState.normalizedMainFingerprint,f.repo.fingerprint(local.save));
        assert.equal(local.metadata.cloudState.serverRevision,cut.serverRevision);
        assert.equal(local.metadata.cloudState.canonicalRevision,cut.canonicalRevision);
        for(const [name,row] of Object.entries(cut.sidecars))assert.equal(f.values.get(f.repo.accountKey(name,h.uid))??null,row.raw);
        const backupCount=[...f.values.keys()].filter(key=>key.startsWith('four_symbols_migration_backup:')).length;
        await f.load(cut);assert.equal(f.repo.readForUid(h.uid).metadata.cloudState.serverRevision,cut.serverRevision);
        assert.equal([...f.values.keys()].filter(key=>key.startsWith('four_symbols_migration_backup:')).length,backupCount,'duplicate adoption creates no new backup or revision; normal hydrate may update its cache timestamp');
        if(cut===cuts[0])firstMain=copy(f.repo.readForUid(h.uid).save);
    }
    assert.ok([...f.values.keys()].some(key=>key.startsWith('four_symbols_migration_backup:')));
    const backup=JSON.parse([...f.values].find(([key])=>key.startsWith('four_symbols_migration_backup:'))[1]);
    assert.deepEqual(JSON.parse(backup.mainRaw),firstMain);
    for(const [name,row] of Object.entries(cuts[0].sidecars))if(row.raw!==null)assert.equal(backup.sidecars[name].raw,row.raw);
    const before=[...f.values];assert.equal((await f.load(cuts[0])).blocked,true);assert.deepEqual([...f.values],before);
    f.repo.writeForUid(h.uid,{...cuts[2].gameSave,gold:1},{source:'gameplay'});
    assert.equal(f.repo.readForUid(h.uid).metadata.cloudState.serverRevision,cuts[2].serverRevision,'local writes do not invent a server revision');
    assert.equal((await f.load(cuts[2])).blocked,true,'dirty local progress is preserved');
});
test('complete bundles reject stale sessions, changed local data, sidecar divergence and same-cut digest changes',async()=>{
    const {h,cuts}=await lawfulCuts();
    for(const session of [{uid:h.uid,status:'blocked',sessionId:'old'},{uid:'foreign',status:'active',sessionId:'other'},
        {uid:h.uid,status:'pending'},{uid:h.uid,status:'active'}]){
        const f=adoptionFixture(h.uid);f.session(session);
        assert.equal((await f.load(cuts[0])).blocked,true);assert.equal(f.ready.length,0);
        assert.equal(f.values.has(f.repo.saveKey(h.uid)),false);
    }
    for(const fault of ['session','uid','local']){
        const f=adoptionFixture(h.uid);let deliver;
        const pending=f.load(cuts[0],{waiting:()=>new Promise(resolve=>{deliver=resolve;})});
        if(fault==='session')f.session({uid:h.uid,status:'blocked'});
        if(fault==='uid')f.repo.activate('another-uid');
        if(fault==='local')f.repo.writeForUid(h.uid,{player:{id:'local-player'}},{source:'local'});
        const before=[...f.values];deliver({uid:h.uid,exists:true,serverConfirmed:true,data:{ownerUid:h.uid,
            authoritativeStateReady:true,serverRevision:cuts[0].serverRevision,cloudBundle:cuts[0]}});
        assert.equal((await pending).blocked,true);assert.deepEqual([...f.values],before);assert.equal(f.ready.length,0);
    }
    for(const fault of ['sidecar','digest','downgrade','unconfirmed','missing-local-revision']){
        const f=adoptionFixture(h.uid);await f.load(cuts[0]);
        if(fault==='sidecar')f.values.set(f.repo.accountKey('progress',h.uid),'{"eliteKills":9}');
        if(fault==='missing-local-revision'){
            const key=f.repo.metadataKey(h.uid),meta=JSON.parse(f.values.get(key));delete meta.cloudState.serverRevision;f.values.set(key,JSON.stringify(meta));
        }
        const cut=copy(cuts[0]);if(fault==='digest')cut.sourceSnapshotSha256='f'.repeat(64);
        const before=[...f.values];
        const result=await f.load(cut,{mutate:r=>{
            if(fault==='downgrade'){delete r.data.cloudBundle;r.data.gameSave=cuts[0].gameSave;}
            if(fault==='unconfirmed')r.serverConfirmed=false;
        }});
        assert.equal(result.blocked,true);assert.deepEqual([...f.values],before);
    }
});
test('bundle failures never fall back to main-only and storage interruption preserves or blocks the cache',async()=>{
    const {h,cuts}=await lawfulCuts();
    for(const change of [b=>delete b.sidecars.progress,b=>b.sidecars.progress.raw='',b=>b.sidecars.progress.raw='null',
        b=>b.bundleVersion=2,b=>b.ownerUid='other',b=>b.canonicalRevision--]){
        const f=adoptionFixture(h.uid),broken=copy(cuts[0]);change(broken);
        assert.equal((await f.load(broken)).blocked,true);assert.equal(f.ready.length,0);
        assert.equal(f.values.has(f.repo.saveKey(h.uid)),false);
    }
    const unready=adoptionFixture(h.uid);await unready.load(cuts[0],{published:false});assert.equal(unready.ready.length,0);
    const f=adoptionFixture(h.uid);const first=await f.load(cuts[0]);assert.equal(first.ready,true,first.error?.stack);const originalMain=f.values.get(f.repo.saveKey(h.uid));
    let failed=false;f.fault((key)=>{if(!failed&&key===f.repo.accountKey('progress',h.uid)){failed=true;return true;}return false;});
    assert.equal((await f.load(cuts[1])).blocked,true);assert.equal(f.values.get(f.repo.saveKey(h.uid)),originalMain);
    for(const [name,row] of Object.entries(cuts[0].sidecars))assert.equal(f.values.get(f.repo.accountKey(name,h.uid))??null,row.raw);
    f.fault(key=>key===f.repo.accountKey('progress',h.uid));
    assert.equal((await f.load(cuts[1])).blocked,true);assert.equal(f.errors.at(-1).code,'account-cloud-rollback-failed');
    assert.throws(()=>f.repo.readForUid(h.uid),e=>e.code==='account-cloud-adoption-incomplete');
    assert.throws(()=>f.repo.writeForUid(h.uid,cuts[0].gameSave),e=>e.code==='account-cloud-adoption-incomplete');
    assert.ok([...f.values.keys()].some(key=>key.startsWith('four_symbols_migration_backup:')));
});

test('actual enterReady refuses Session takeover across app-shell and visual awaits',async()=>{
    const {h,cuts}=await lawfulCuts();
    for(const stage of ['app-shell','visual']){
        const f=adoptionFixture(h.uid);let resume;
        f.runtime[stage==='app-shell'?'__appShellWait':'__visualWait']=new Promise(resolve=>{resume=resolve;});
        const pending=f.load(cuts[0]);
        for(let i=0;i<15;i++)await Promise.resolve();
        if(stage==='visual')assert.equal(f.runtime.__visualEntered,true);
        f.session({uid:h.uid,status:'blocked',sessionId:'replaced'});resume();
        assert.equal((await pending).blocked,true);assert.equal(f.ready.length,0);
        if(stage==='app-shell')assert.deepEqual(f.runtime.player,{},'takeover before app-shell completion must not hydrate');
        assert.match(f.errors.at(-1).message,/Session changed before cloud/);
    }
});

test('legacy published bare payload still uses the original writer after shell, with current Session',async()=>{
    const {h,cuts}=await lawfulCuts();
    for(const blocked of [false,true]){
        const f=adoptionFixture(h.uid);let resume;
        f.runtime.__appShellWait=new Promise(resolve=>{resume=resolve;});
        const pending=f.load(cuts[0],{mutate:response=>{
            response.data.gameSave=response.data.cloudBundle.gameSave;delete response.data.cloudBundle;
        }});
        for(let i=0;i<15;i++)await Promise.resolve();
        const before=JSON.stringify([...f.values]);assert.equal(f.repo.readForUid(h.uid).status,'empty');
        if(blocked)f.session({uid:h.uid,status:'blocked',sessionId:'replaced'});
        resume();const result=await pending;
        if(blocked){assert.equal(result.blocked,true);assert.equal(JSON.stringify([...f.values]),before);assert.equal(f.ready.length,0);}
        else {assert.equal(result.ready,true);assert.equal(f.repo.readForUid(h.uid).save.player.id,cuts[0].gameSave.player.id);}
    }
});

test('legacy empty-envelope resolution tolerates initial Session activation without weakening bundle guards',async()=>{
    const {h,cuts}=await lawfulCuts(),f=adoptionFixture(h.uid);let deliver;
    f.session({uid:h.uid,status:'pending'});
    const pending=f.load(cuts[0],{waiting:()=>new Promise(resolve=>{deliver=resolve;})});
    f.session({uid:h.uid,status:'active',sessionId:'initial-session'});
    deliver({uid:h.uid,exists:true,data:{ownerUid:h.uid,authoritativeStateReady:false,
        status:'awaiting_authoritative_migration',migrationCandidateStatus:'none'}});
    assert.equal((await pending).creation,true);assert.equal(f.errors.length,0);
    assert.equal(f.values.has(f.repo.saveKey(h.uid)),false,'destination resolution never creates a real character');
});
