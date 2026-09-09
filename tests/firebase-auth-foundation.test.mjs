import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path)=>fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const config = read("js/firebase/firebase-config.js");
const auth = read("js/firebase/firebase-auth.js");
const cloud = read("js/firebase/firebase-cloud-save.js");
const bootstrap = read("js/firebase/firebase-bootstrap.js");

test("Firebase project identity and pinned SDK owner are explicit", ()=>{
    assert.match(config, /projectId:\s*"four-symbols-jianghu"/);
    assert.match(config, /FIREBASE_SDK_VERSION\s*=\s*"12\.18\.0"/);
    assert.match(auth, /firebasejs\/12\.18\.0\/firebase-auth\.js/);
    assert.match(cloud, /firebasejs\/12\.18\.0\/firebase-firestore\.js/);
});

test("cloud-save browser module remains read-only", ()=>{
    for(const forbidden of ["setDoc", "addDoc", "updateDoc", "deleteDoc", "writeBatch", "runTransaction"]){
        assert.equal(cloud.includes(forbidden), false, `unexpected Firestore write API: ${forbidden}`);
    }
    assert.match(cloud, /CLOUD_SAVE_WRITE_POLICY\s*=\s*"trusted-backend-only"/);
});

test("Firebase layer does not wrap or mutate the existing local save owner", ()=>{
    const combined = [config, auth, cloud, bootstrap].join("\n");
    assert.equal(combined.includes("saveGame="), false);
    assert.equal(combined.includes("saveGame ="), false);
    assert.equal(combined.includes("loadGame="), false);
    assert.equal(combined.includes("localStorage.setItem"), false);
    assert.equal(combined.includes("battle_full_version_save_v5"), false);
});

test("bootstrap exposes only the narrow Firebase bridge", ()=>{
    assert.match(bootstrap, /window\.FourSymbolsFirebase\s*=\s*api/);
    assert.match(bootstrap, /four-symbols:firebase-auth-state/);
    assert.match(bootstrap, /four-symbols:firebase-config-missing/);
});
