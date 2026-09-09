# Firebase Trusted Cloud Save Backend

## Scope

This phase introduces the trusted server boundary for cloud-save migration without changing the existing local-save owner.

Authoritative owners:

- `functions/index.js`: Firebase Cloud Functions v2 callable entry points.
- `functions/src/cloud-save-policy.js`: validation and trust policy for legacy local-save migration candidates.
- `js/firebase/firebase-cloud-save.js`: browser cloud-save client. It may read owner-visible Firestore data and call trusted Functions, but must not write official Firestore progression directly.
- `firestore.rules`: web-client Firestore policy. Signed-in users may read their own `/users/{uid}` tree; browser create/update/delete stays denied.
- `js/00-main.js`: existing local `saveGame()` / `loadGame()` owner remains unchanged.

## Trusted functions

### `bootstrapCloudSave`

Requires Firebase Authentication. The function creates or repairs the server-owned account/save metadata for the authenticated UID. The public player-visible path is:

`/users/{uid}/saves/current`

Server-private metadata is stored under:

`/serverUsers/{uid}`

The browser cannot read or write `serverUsers` through Firestore Rules.

### `submitLegacyMigrationCandidate`

Requires Firebase Authentication and an already bootstrapped account. The browser may submit the current legacy local save for migration review, but the server stores it only as an **untrusted migration candidate** under the authenticated UID.

The candidate is validated for:

- supported top-level save fields;
- supported legacy save version;
- required primary character identity;
- character level range 1–100;
- non-negative bounded gold / shared EXP / timestamp values;
- JSON-only data;
- nesting, array, object-key, string-length and total-byte limits;
- forbidden prototype-pollution keys;
- SHA-256 fingerprinting.

A submitted candidate is explicitly stored with:

- `trustLevel: client-migration-candidate`
- `trusted: false`
- `reviewStatus: pending_server_validation`

It does **not** directly become authoritative gold, EXP, equipment, inventory, skills or progression.

## Security boundary

The current phase deliberately separates three states:

1. Local legacy save — existing `localStorage` save owned by `saveGame()`.
2. Migration candidate — browser-provided snapshot accepted only for server review.
3. Authoritative state — future server-validated progression. This phase does not promote a migration candidate into authoritative state.

The browser imports no Firestore write APIs (`setDoc`, `updateDoc`, `deleteDoc`, transactions, batches). Trusted writes are performed only inside Cloud Functions with the Admin SDK.

## Region and runtime

- Firebase Functions region: `us-central1`
- Functions runtime: Node.js 22
- Firebase project: `four-symbols-jianghu`

## Deployment

Repository integration alone does not deploy Cloud Functions. The Firebase backend must be deployed with credentials authorized for the Firebase project. Until Functions are deployed, the existing Authentication + read-only Firestore flow continues to work, while the new callable methods will return a network/not-found style error if invoked.

Firestore Rules in `firestore.rules` mirror the current deny-write policy and should be deployed together with the backend when the Firebase deployment step is performed.

## Next phase

After the trusted backend is deployed and callable verification succeeds, authoritative gameplay mutations should be migrated incrementally to server-validated operations. Priority order should be currencies/rewards, progression/EXP, inventory/equipment acquisition, crafting/reforge, then other protected progression.
