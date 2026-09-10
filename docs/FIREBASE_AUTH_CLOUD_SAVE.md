# Firebase Authentication + Account Save

Firebase Authentication is a required identity gate for production character ownership. It is not optional telemetry and it does not run after character creation. The full boot contract is defined in `docs/BOOT_ARCHITECTURE.md`.

## Owners

- `js/firebase/firebase-config.js`: public Firebase Web App configuration validation.
- `js/firebase/firebase-auth.js`: durable Auth session, Google, Email/password, Anonymous Auth and sign-out.
- `js/firebase/firebase-auth-ui.js`: account-first player UI.
- `js/firebase/firebase-cloud-save.js`: authenticated cloud read and trusted callable boundary.
- `js/firebase/firebase-bootstrap.js`: identity lifecycle followed by UID cloud-save resolution.
- `js/startup/account-save-repository.js`: UID-namespaced local save, metadata, sidecars and legacy migration.
- `js/52-v173.20-startup-loader.js`: sole startup state machine and destination decision.

## Authentication contract

Fresh production sessions stop at the account UI until one of these Firebase identities exists:

- Google sign-in.
- Email/password sign-in.
- Email/password account creation.
- `訪客開始遊戲`, implemented with Firebase Anonymous Auth.

There is no production `先使用本機存檔` path. No UID means no save lookup and no first-character creation. Test doubles are confined to the local QA HTTP server in `.github/scripts/run-boot-architecture-browser-qa.mjs`; the deployed runtime contains no DEV auth bypass.

Google, Email/password and Anonymous providers must be enabled in Firebase Console. Every deployed custom domain used by popup sign-in must also be listed under Authentication → Settings → Authorized domains.

## Account and character order

1. Initialize Firebase Auth and restore persistence.
2. Resolve the current user.
3. If signed out, show account UI and wait.
4. After sign-in, capture the UID and activate only that UID's local repository.
5. Read `/users/{uid}/saves/current` and the UID-namespaced local save.
6. Resolve cloud/local/legacy status without silently overwriting any source.
7. Existing character → hydrate and enter the city. A successful authenticated read of the same UID returning a missing document (or an explicit same-UID empty sentinel) proves an empty account and permits creation. Error or conflict → fail closed.

Character creation is authorized only by `FourSymbolsStartupPolicy.canCreateCharacter()` while the state machine is in `NEED_CHARACTER`.

## Cloud security boundary

Current read path:

`/users/{uid}/saves/current`

The browser may authenticate and read only the signed-in player's own tree. It must not authoritatively create, update or delete official progression through Firestore client APIs. `CLOUD_SAVE_WRITE_POLICY` remains `trusted-backend-only`.

The existing callable backend may bootstrap account metadata or accept an untrusted legacy migration candidate for server-side review. Startup does not require a bootstrap write: a successful authenticated `getDoc` returning a missing same-UID document is already an authoritative empty read. A submitted legacy payload is not authoritative merely because the callable accepted it. If the trusted backend is unavailable, this client refactor does not weaken Firestore rules to simulate cloud write support.

A successful cloud read does **not** automatically hydrate or overwrite local gameplay state. The Startup owner first validates UID ownership, authoritative payload shape, local metadata, legacy state and conflicts; only that resolver may select a payload for hydration.

## Local ownership

The canonical gameplay payload schema remains unchanged. Ownership is stored separately:

- `four_symbols_save:{uid}` — gameplay save.
- `four_symbols_save_meta:{uid}` — `ownerUid`, ownership schema, source, local-dirty state and the verified cloud-base fingerprint.
- `four_symbols_account:{uid}:{suffix}` — inventory/equipment/abyss and other sidecar state.
- `four_symbols_active_uid` — active account pointer, never a substitute for Auth identity.

Payload and metadata must both exist and match the requested UID. An incomplete pair, corrupt JSON or owner mismatch raises an error. Account switching deactivates the old owner and reloads the document before the new UID can hydrate globals.

When a cloud character is first cached, the local metadata records a deterministic fingerprint of that authoritative snapshot. Hydration may add backward-compatible defaults without turning the save into an unrelated conflict, and later same-device gameplay remains a local descendant of that fingerprint. A warm start may select that UID-owned local descendant only while the freshly read cloud fingerprint is unchanged. If the cloud base changed, is absent from metadata, or cannot be verified, startup displays a conflict and refuses to choose or overwrite either copy.

## Legacy key

`battle_full_version_save_v5` is unowned legacy data. Sign-in never automatically binds it. Migration requires explicit confirmation, creates timestamped backups, preserves the original key, refuses any existing local/cloud character conflict and rolls back incomplete account writes. Cloud/legacy and local/cloud conflicts remain visible and blocked until explicitly resolved; they are never silently overwritten.

## Failure behavior

- Auth network/config error: `ERROR`; creation remains hidden.
- A successful same-UID cloud read returning a missing document: safe empty account; creation may proceed only after local/legacy checks also pass.
- Cloud read error with a verified, complete same-UID local save: `OFFLINE_READY`.
- Cloud read error without such a local save: `ERROR`.
- Cloud says authoritative but has no valid character payload: `ERROR`.
- Corrupt local or legacy storage: `ERROR`; original bytes are retained.
- Account changes during cloud read: discard the result and reload under the new identity.

## Firebase project

- Auth domain: `four-symbols-jianghu.firebaseapp.com`
- Project ID: `four-symbols-jianghu`
- Firebase Web SDK: `12.18.0`
- Cloud Functions region: `us-central1`

Firebase Web configuration values are public client identifiers, not Admin credentials. Service-account keys and privileged secrets must never be committed.

## Browser events and API

`window.FourSymbolsFirebaseLifecycle` exposes identity, cloud-read, sign-in/out and account UI methods. Important events are:

- `four-symbols:firebase-auth-state`
- `four-symbols:firebase-cloud-save-read`
- `four-symbols:firebase-module-ready`
- `four-symbols:startup-state`
- `four-symbols:startup-ready`
- `four-symbols:startup-error`

Firebase does not own `saveGame()` or `loadGame()`. It supplies identity and cloud read results to the startup owner; `FourSymbolsAccountSave` owns local selection, and the gameplay save owner serializes only under the active UID.
