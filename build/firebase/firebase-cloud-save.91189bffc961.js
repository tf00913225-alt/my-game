/*
 * Cloud-save client owner.
 *
 * Firestore remains read-only from the browser. Trusted mutations are callable
 * Cloud Functions which require Firebase Authentication and write with Admin SDK.
 * No function in this module wraps saveGame()/loadGame() or directly mutates
 * official Firestore progression.
 */

import {
    doc,
    getDoc,
    getDocFromServer,
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {CLOUD_FUNCTIONS_REGION,callProtectedFunction} from "./firebase-session.877a7842d6bd.js";

import {
    getFirebaseApp,
    getFirebaseAuth,
    initializeFirebaseAuth
} from "./firebase-auth.9f8c09942b79.js";

export const CLOUD_SAVE_WRITE_POLICY = "trusted-backend-only";
export {CLOUD_FUNCTIONS_REGION};
export const CURRENT_SAVE_SUBCOLLECTION = "saves";
export const CURRENT_SAVE_DOCUMENT = "current";
export const LEGACY_LOCAL_SAVE_KEY = "battle_full_version_save_v5";

let firestore = null;

async function ensureFirebaseApp(){
    await initializeFirebaseAuth();
    const app = getFirebaseApp();
    if(!app){
        const error = new Error("Firebase app is not initialized.");
        error.code = "firebase/app-not-initialized";
        throw error;
    }
    return app;
}

async function ensureFirestore(){
    const app = await ensureFirebaseApp();
    if(!firestore){ firestore = getFirestore(app); }
    return firestore;
}

function requireSignedInUid(){
    const auth = getFirebaseAuth();
    const uid = auth && auth.currentUser && auth.currentUser.uid;
    if(!uid){
        const error = new Error("A signed-in Firebase user is required for cloud-save access.");
        error.code = "firebase/auth-required";
        throw error;
    }
    return uid;
}

async function sha256(raw){
    const bytes=new TextEncoder().encode(raw);
    const digest=await window.crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function callTrustedFunction(name, payload){
    const expectedUid=requireSignedInUid();
    return callProtectedFunction(name,payload||{},expectedUid);
}

/* Read-only review of the current private candidate. The backend binds both
 * revisions to the active UID/session and returns blockers, never save bytes. */
export async function screenLegacyMigrationCandidate(candidateRevision,expectedRevision){
    if(!Number.isSafeInteger(candidateRevision)||candidateRevision<1||
       !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
        throw Object.assign(new Error("Current candidate and cloud revisions are required."),
            {code:"CLOUD_REVISION_REQUIRED"});
    }
    return callTrustedFunction("screenLegacyMigrationCandidate",{candidateRevision,expectedRevision});
}

export async function readCurrentCloudSave({serverOnly=false}={}){
    const db = await ensureFirestore();
    const uid = requireSignedInUid();
    const reference = doc(db, "users", uid, CURRENT_SAVE_SUBCOLLECTION, CURRENT_SAVE_DOCUMENT);
    const snapshot = await (serverOnly?getDocFromServer(reference):getDoc(reference));
    if(serverOnly&&(snapshot.metadata?.fromCache!==false||snapshot.metadata?.hasPendingWrites!==false)){
        throw Object.assign(new Error("Cloud save has not been confirmed by the server."),{code:"cloud-server-unconfirmed"});
    }

    if(!snapshot.exists()){
        return Object.freeze({ exists: false, uid, path: reference.path, data: null,...(serverOnly?{serverConfirmed:true}:{}) });
    }

    return Object.freeze({
        exists: true,
        uid,
        path: reference.path,
        data: snapshot.data(),...(serverOnly?{serverConfirmed:true}:{})
    });
}

export async function bootstrapTrustedCloudSave(){
    return callTrustedFunction("bootstrapCloudSave", {});
}

// Acquisition rights are independent of a restored local character snapshot.
// The server observes its own calendar date; no browser date/counter is sent.
export async function readHeroAcquisition(){
    return callTrustedFunction("readHeroAcquisition",{});
}
export async function claimHeroLoginReward({operationId,expectedRevision,milestoneDay}){
    return callTrustedFunction("claimHeroLoginReward",{operationId,expectedRevision,milestoneDay});
}
export async function claimHeroDailySupply({operationId,expectedRevision,periodDate}){
    return callTrustedFunction("claimHeroDailySupply",{operationId,expectedRevision,periodDate});
}
export async function readHeroGrowth(){return callTrustedFunction("readHeroGrowth",{});}
export async function mutateHeroGrowth({operationId,expectedRevision,heroId,action}){
    return callTrustedFunction("mutateHeroGrowth",{operationId,expectedRevision,heroId,action});
}
export async function observeHeroLogin(expectedRevision){
    return callTrustedFunction("observeHeroLogin",{expectedRevision});
}
export async function ensureHeroChapterTicket(expectedRevision){
    return callTrustedFunction("ensureHeroChapterTicket",{expectedRevision});
}
export async function completeHeroChapterNode({ticketId,nodeId,choiceId=null,expectedRevision}){
    return callTrustedFunction("completeHeroChapterNode",{ticketId,nodeId,choiceId,expectedRevision});
}

/* Explicit account intents retain the caller's operation ID for receipt retry. */
export async function mutateCanonicalSkillLoadout({operationId,expectedRevision,characterId,action,skillId}={}){
    return callTrustedFunction("mutateCanonicalSkillLoadout",{operationId,expectedRevision,characterId,action,skillId});
}
// Configuration only. The caller decides what to display; this never hydrates
// a save, caches a result or promotes a partial response to playable authority.
export async function readCanonicalSkillLoadout({expectedRevision}={}){
    return callTrustedFunction("readCanonicalSkillLoadout",{expectedRevision});
}
export async function createAdditionalCanonicalCharacter({operationId,expectedRevision,slotIndex,selection}={}){
    return callTrustedFunction("createAdditionalCanonicalCharacter",{operationId,expectedRevision,slotIndex,selection});
}
export async function allocateCanonicalSharedExp({operationId,expectedRevision,characterId}={}){
    return callTrustedFunction("allocateCanonicalSharedExp",{operationId,expectedRevision,...(characterId===undefined?{}:{characterId})});
}
export async function allocateCanonicalAttributePoint({operationId,expectedRevision,stat,characterId}={}){
    return callTrustedFunction("allocateCanonicalAttributePoint",{operationId,expectedRevision,stat,...(characterId===undefined?{}:{characterId})});
}
/* First-character choices require Auth, active session, empty canonical sources
 * and an expected revision; the backend generates all initial progression. */
export async function createInitialCanonicalCharacter(selection,expectedRevision){
    return callTrustedFunction("createInitialCanonicalCharacter",{selection,expectedRevision});
}

// Explicit intent services only. Stable operation IDs belong to the caller;
// transport failure never creates a replacement operation or replays a save.
export async function observeCanonicalAccountMode({operationId,expectedRevision,expectedSequence,intent,elementBox}){
    return callTrustedFunction("observeCanonicalAccountMode",{operationId,expectedRevision,expectedSequence,intent,elementBox});
}
export async function beginCanonicalElementBoxAd({operationId,expectedRevision,expectedSequence}){
    return callTrustedFunction("beginCanonicalElementBoxAd",{operationId,expectedRevision,expectedSequence});
}
export async function completeCanonicalElementBoxAd({operationId,expectedRevision,expectedSequence,sourceId}){
    return callTrustedFunction("completeCanonicalElementBoxAd",{operationId,expectedRevision,expectedSequence,sourceId});
}
export async function abandonCanonicalElementBoxAd({operationId,expectedRevision,expectedSequence,sourceId}){
    return callTrustedFunction("abandonCanonicalElementBoxAd",{operationId,expectedRevision,expectedSequence,sourceId});
}
export async function issueCanonicalPatrolTicket({operationId,expectedRevision,triggerEntryId,availableEntryIds}){
    return callTrustedFunction("issueCanonicalPatrolTicket",{operationId,expectedRevision,triggerEntryId,
        ...(availableEntryIds===undefined?{}:{availableEntryIds})});
}
export async function settleCanonicalPatrolMember({operationId,expectedRevision,ticketId,memberIndex}){
    return callTrustedFunction("settleCanonicalPatrolMember",{operationId,expectedRevision,ticketId,memberIndex});
}
export async function settleCanonicalPatrolTerminal({operationId,expectedRevision,ticketId,kind}){
    return callTrustedFunction("settleCanonicalPatrolTerminal",{operationId,expectedRevision,ticketId,kind});
}
export async function abandonCanonicalPatrolTicket({operationId,expectedRevision,ticketId}){
    return callTrustedFunction("abandonCanonicalPatrolTicket",{operationId,expectedRevision,ticketId});
}

/* Explicit, same-UID preference upload. Never sends the character save,
 * and never runs as part of saveGame, login or offline replay. */
export async function saveLocalAutoBattlePreferences(expectedRevision){
    const uid=requireSignedInUid();
    const repository=window.FourSymbolsAccountSave;
    if(!repository||repository.getActiveUid()!==uid){
        const error=new Error("The active local save belongs to another account.");
        error.code="ACCOUNT_CHANGED";
        throw error;
    }
    const local=repository.readForUid(uid);
    if(local.status!=="ready"){
        const error=new Error("No verified local character save is available.");
        error.code="LOCAL_SAVE_REQUIRED";
        throw error;
    }
    const {player,player2,player3}=local.save;
    const characterIds=[player,player2,player3].map(character=>character?.id||null);
    /* Old UID saves may contain only some of these fields. Project the five
     * approved settings with gameplay defaults; never forward other save data. */
    const projectConfig=(value)=>{
        if(value!==undefined&&value!==null&&(typeof value!=="object"||Array.isArray(value))){
            const error=new Error("Local auto-battle settings are invalid.");
            error.code="LOCAL_PREFERENCES_INVALID";
            throw error;
        }
        const config=value||{};
        return {
            enabled:config.enabled??false,
            skill:config.skill??"normal",
            hp:config.hp??50,
            sp:config.sp??25,
            returnToCityWhenEmpty:config.returnToCityWhenEmpty??false
        };
    };
    const preferences={
        characterIds,
        autoConfig:projectConfig(local.save.autoConfig),
        autoConfig2:projectConfig(local.save.autoConfig2),
        autoConfig3:projectConfig(local.save.autoConfig3)
    };
    return callTrustedFunction("saveCloudPreferences",{preferences,expectedRevision});
}

export async function submitLegacyMigrationCandidate(options={}){
    const uid=requireSignedInUid();
    const repository=window.FourSymbolsAccountSave;
    if(!repository||repository.getActiveUid()!==uid){
        throw Object.assign(new Error("Active UID changed."),{code:"ACCOUNT_CHANGED"});
    }
    // The caller selects a previously sealed backup. No live gameplay or legacy
    // key is read between owner confirmation and the protected callable.
    const backup=repository.verifyMigrationBackup(uid,options.backupKey);
    const sidecarManifest=JSON.stringify(backup.sidecars);
    const [backupDigest,manifestDigest]=await Promise.all([
        sha256(JSON.stringify({ownerUid:uid,mainRaw:backup.mainRaw,
            metadataRaw:backup.metadataRaw,sidecars:backup.sidecars})),
        sha256(sidecarManifest)
    ]);
    if(requireSignedInUid()!==uid||repository.getActiveUid()!==uid){
        throw Object.assign(new Error("Account changed during backup verification."),{code:"ACCOUNT_CHANGED"});
    }
    const clientVersion = String(options.clientVersion || "").trim() || null;
    if(!Number.isSafeInteger(options.expectedRevision)||options.expectedRevision<1){
        throw Object.assign(new Error("A current cloud revision is required."),{code:"CLOUD_REVISION_REQUIRED"});
    }
    return callTrustedFunction("submitLegacyMigrationCandidate", {
        expectedRevision:options.expectedRevision,
        backup:{schemaVersion:backup.schemaVersion,backupId:backup.backupKey,
            ownerUid:uid,mainFingerprint:backup.mainFingerprint,
            sidecarManifestFingerprint:backup.sidecarManifestFingerprint,
            mainRaw:backup.mainRaw,metadataRaw:backup.metadataRaw,
            sidecars:backup.sidecars,sidecarManifestSha256:manifestDigest,
            backupSha256:backupDigest},
        clientVersion
    });
}

/* Creates an explicit immutable UID backup before any future migration
 * consent. It does not upload, promote or restore gameplay state. */
export function createLocalMigrationBackup(){
    const uid=requireSignedInUid();
    const repository=window.FourSymbolsAccountSave;
    if(!repository||repository.getActiveUid()!==uid){
        const error=new Error("The active local save belongs to another account.");
        error.code="ACCOUNT_CHANGED";
        throw error;
    }
    return repository.createMigrationBackup(uid);
}

export async function readTeamFormation(){return callTrustedFunction("readTeamFormation",{});}
export async function saveTeamFormation(intent){return callTrustedFunction("saveTeamFormation",intent);}
