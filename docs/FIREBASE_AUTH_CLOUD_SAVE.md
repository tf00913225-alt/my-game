# Firebase Authentication + Cloud Save Foundation

## Scope

This phase adds a dedicated Firebase client boundary without changing the current local-save owner or Firestore write rules.

Owners:

- `js/firebase/firebase-config.js`: Firebase Web client configuration and readiness validation.
- `js/firebase/firebase-auth.js`: Firebase Authentication initialization and providers.
- `js/firebase/firebase-cloud-save.js`: authenticated read-only access to the player's cloud-save document.
- `js/firebase/firebase-auth-ui.js`: native-stage login/account overlay for Google, Email/password and anonymous sign-in.
- `js/firebase/firebase-bootstrap.js`: narrow browser bridge (`window.FourSymbolsFirebase`) and auth/cloud-read state coordination.
- `js/52-v173.20-startup-loader.js`: startup entry that dynamically imports the Firebase bootstrap as optional infrastructure. Firebase is deliberately not counted as a core runtime-readiness module.
- `js/01-stage-v8-touch-lock.js`: global gesture owner; `.firebase-auth-dialog` is registered there as the only authentication vertical scroll owner.

## Firebase project

Confirmed Web App configuration copied from Firebase Console:

- authDomain: `four-symbols-jianghu.firebaseapp.com`
- projectId: `four-symbols-jianghu`
- storageBucket: `four-symbols-jianghu.firebasestorage.app`
- messagingSenderId: `86885650222`
- appId: `1:86885650222:web:8ffcbb5c07dc2a691b34bf`
- measurementId: `G-4PZCMLJC8L`
- Firebase Web SDK: `12.18.0`

The Firebase Web `apiKey` is stored in `firebase-config.js` with the rest of the public Web App identifiers. This is not an Admin SDK credential. Service-account keys, private server secrets and privileged credentials must never be committed to this repository.

Firebase Analytics is not initialized by this phase. The `measurementId` is retained only as part of the Console-provided Web App config.

## Authentication behavior

The account overlay is installed inside `#game-stage`, so it follows the official 1080×1920 stage transform without changing game page dimensions. Its content scrolls inside `.firebase-auth-dialog`, which is explicitly registered in the existing global touch-lock whitelist instead of adding another page-specific touch handler.

Available flows:

- Google sign-in.
- Email/password sign-in.
- Email/password account creation.
- Anonymous guest sign-in.
- Sign-out.
- Local-only fallback so an Authentication provider/configuration problem cannot block the existing single-player local save.

A signed-in account displays its Firebase UID and then attempts a read of the current cloud-save document.

Google, Email/password and Anonymous providers must also be enabled in Firebase Console Authentication. Any deployed custom game domain used by Google sign-in must be present in Authentication → Settings → Authorized domains.

## Security boundary

The browser is allowed to authenticate and read only the signed-in player's own Firestore tree. The browser must not authoritatively create, update, or delete official game progression.

Current cloud-save read path:

`/users/{uid}/saves/current`

Authoritative cloud-save writes will be implemented through a trusted backend (Cloud Functions/Cloud Run/Admin SDK) and must keep the client-write-deny Firestore policy intact.

A successful read does **not** automatically hydrate or overwrite the current local game save in this phase. Cross-device save selection/conflict handling must be designed explicitly before hydration is enabled.

## Runtime integration

`js/52-v173.20-startup-loader.js` dynamically imports `js/firebase/firebase-bootstrap.js`.

Firebase initialization is intentionally optional infrastructure:

- failure does not alter the existing `DEFAULT_RUNTIME_TOTAL=32` gate;
- failure does not block the normal local game;
- `saveGame()` / `loadGame()` are untouched;
- the local `SAVE_KEY` and save schema are untouched;
- no Firestore browser write API is imported.

## Public bridge

When `firebase-bootstrap.js` is loaded, it exposes `window.FourSymbolsFirebase` with:

- `initialize()`
- `getConfigStatus()`
- `getUser()`
- `observeAuthState(listener)`
- `signInWithGoogle()`
- `signInWithEmail(email, password)`
- `createAccountWithEmail(email, password)`
- `signInAsAnonymous()`
- `signOut()`
- `readCurrentCloudSave()`
- `openAuth()`
- `closeAuth()`
- `cloudSaveWritePolicy` (`trusted-backend-only`)

Browser events:

- `four-symbols:firebase-ready`
- `four-symbols:firebase-auth-state`
- `four-symbols:firebase-cloud-save-read`
- `four-symbols:firebase-config-missing`
- `four-symbols:firebase-bootstrap-failed`

No local save function is wrapped by this layer.
