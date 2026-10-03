import test from "node:test";
import assert from "node:assert/strict";
import {inspectFirestoreBackups} from "../scripts/firestore-backup-readiness.mjs";

const now=Date.parse("2026-09-30T00:00:00Z");
const database={name:"projects/four-symbols-jianghu/databases/(default)",
    uid:"database-incarnation-a"};
const backup={name:"projects/four-symbols-jianghu/locations/asia-east1/backups/backup-a",
    database:database.name,databaseUid:database.uid,state:"READY",
    snapshotTime:"2026-09-29T12:00:00Z",expireTime:"2026-10-06T12:00:00Z"};

test("only an unexpired READY backup of the exact database incarnation counts",()=>{
    assert.equal(inspectFirestoreBackups(database,[backup],now).status,"READY");
    for(const altered of [
        {...backup,state:"CREATING"},
        {...backup,databaseUid:"old-database-incarnation"},
        {...backup,database:"projects/four-symbols-jianghu/databases/other"},
        {...backup,expireTime:"2026-09-29T00:00:00Z"},
        {...backup,snapshotTime:"2026-10-01T00:00:00Z"},
        {...backup,name:"projects/other/locations/asia-east1/backups/backup-a"}
    ]){
        assert.equal(inspectFirestoreBackups(database,[altered],now).status,"UNVERIFIED");
    }
    assert.equal(inspectFirestoreBackups(database,null,now).status,"UNVERIFIED");
    assert.equal(inspectFirestoreBackups({...database,uid:""},[backup],now).status,"UNVERIFIED");
});
