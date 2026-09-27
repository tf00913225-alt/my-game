"use strict";

const {createHash}=require("node:crypto");
const {verifyCanonicalSnapshotAgainstSources}=
    require("./canonical-snapshot");

// The archive includes claimRecords, which the materialized snapshot omits.
// Leave room below Firestore's 1 MiB document limit for field names and metadata.
const MAX_ARCHIVE_BYTES=800*1024;
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
function stable(value){
    if(Array.isArray(value)){return value.map(stable);}
    if(object(value)){
        return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    }
    return value;
}

function inspectRecoveryArchive(archive,uid,revision,bundle){
    if(!object(archive)||archive.schemaVersion!==1||archive.ownerUid!==uid||
       archive.serverRevision!==revision||archive.readyForRestore!==false||
       !object(archive.sourceRecords)||
       !/^[a-f0-9]{64}$/.test(archive.sourceSha256||"")||
       !Number.isSafeInteger(archive.sourceByteLength)||
       archive.sourceByteLength<1||archive.sourceByteLength>MAX_ARCHIVE_BYTES||
       archive.snapshotSha256!==bundle?.sha256){
        throw new Error("Canonical recovery archive metadata is invalid.");
    }
    const serialized=JSON.stringify(stable(archive.sourceRecords));
    if(Buffer.byteLength(serialized,"utf8")!==archive.sourceByteLength||
       createHash("sha256").update(serialized,"utf8").digest("hex")!==archive.sourceSha256){
        throw new Error("Canonical recovery archive digest is invalid.");
    }
    verifyCanonicalSnapshotAgainstSources(bundle,uid,revision,archive.sourceRecords);
    return archive.sourceRecords;
}

function createRecoveryArchive(uid,revision,records,bundle){
    verifyCanonicalSnapshotAgainstSources(bundle,uid,revision,records);
    const serialized=JSON.stringify(stable(records));
    const sourceByteLength=Buffer.byteLength(serialized,"utf8");
    if(sourceByteLength>MAX_ARCHIVE_BYTES){
        throw new Error("Canonical recovery archive exceeds the document budget.");
    }
    return {schemaVersion:1,ownerUid:uid,serverRevision:revision,
        sourceRecords:records,sourceByteLength,
        sourceSha256:createHash("sha256").update(serialized,"utf8").digest("hex"),
        snapshotSha256:bundle.sha256,readyForRestore:false};
}

module.exports={createRecoveryArchive,inspectRecoveryArchive,MAX_ARCHIVE_BYTES};
