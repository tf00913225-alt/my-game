import {pathToFileURL} from "node:url";

// A READY backup of this exact database incarnation is evidence of a
// completed database backup. It does not prove a restore rehearsal.
const TARGET="projects/four-symbols-jianghu/databases/(default)";
export function inspectFirestoreBackups(database,backups,now=Date.now()){
    if(!database||database.name!==TARGET||typeof database.uid!=="string"||
       !database.uid||!Array.isArray(backups)||!Number.isFinite(now)){
        return {status:"UNVERIFIED",reason:"DATABASE_OR_BACKUP_LIST_UNAVAILABLE"};
    }
    const valid=backups.filter(backup=>{
        const snapshot=Date.parse(backup?.snapshotTime||"");
        const expiry=Date.parse(backup?.expireTime||"");
        return typeof backup?.name==="string"&&
            /^projects\/four-symbols-jianghu\/locations\/[^/]+\/backups\/[^/]+$/.test(backup.name)&&
            backup.database===TARGET&&backup.databaseUid===database.uid&&
            backup.state==="READY"&&Number.isFinite(snapshot)&&snapshot<=now&&
            Number.isFinite(expiry)&&expiry>now;
    }).sort((a,b)=>Date.parse(b.snapshotTime)-Date.parse(a.snapshotTime));
    if(!valid.length){return {status:"UNVERIFIED",reason:"NO_READY_UNEXPIRED_MATCHING_BACKUP"};}
    const latest=valid[0];
    return {status:"READY",name:latest.name,snapshotTime:latest.snapshotTime,
        expireTime:latest.expireTime,matchingReadyCount:valid.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    let database,backups;
    try{database=JSON.parse(process.env.FIRESTORE_DATABASE_JSON||"null");}
    catch(_){database=null;}
    try{backups=JSON.parse(process.env.FIRESTORE_BACKUPS_JSON||"null");}
    catch(_){backups=null;}
    const result=inspectFirestoreBackups(database,backups);
    if(result.status==="READY"){
        console.log(`Completed backup: READY; matching count: ${result.matchingReadyCount}; name: ${result.name}; snapshot: ${result.snapshotTime}; expiry: ${result.expireTime}`);
    }else{
        console.log(`Completed backup: UNVERIFIED (${result.reason})`);
    }
    console.log("Restore rehearsal: UNVERIFIED");
}
