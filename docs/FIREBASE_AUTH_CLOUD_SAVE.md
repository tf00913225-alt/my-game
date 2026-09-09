# Firebase Authentication + Cloud Save Foundation

## Scope

This phase adds a dedicated Firebase client boundary without changing the current local-save owner or Firestore write rules.

Owners:

- `js/firebase/firebase-config.js`: Firebase Web client configuration and readiness validation.
- `js/firebase/firebase-auth.js`: Firebase Authentication initialization and providers.
- `js/firebase/firebase-cloud-save.js`: authenticated read-only access to the player's cloud-save document.
- `js/firebase/firebase-bootstrap.js`: narrow browser bridge (`window.FourSymbolsFirebase`) for future login UI/runtime integration.

## Firebase project

Confirmed project identity:

- projectId: `four-symbols-jianghu`
- authDomain: `four-symbols-jianghu.firebaseapp.com`
- messagingSenderId: `86885650222`
- measurementId: `G-4PZCMLJC8L`

The console screenshot did not expose the complete `apiKey`, `appId`, or `storageBucket`, so those fields remain intentionally blank. Do not guess them. Copy the exact Web App config values from Firebase Console before enabling runtime integration.

## Security boundary

The browser is allowed to authenticate and read only the signed-in player's own Firestore tree. The browser must not authoritatively create, update, or delete official game progression.

Current cloud save read path reserved by this foundation:

`/users/{uid}/saves/current`

Authoritative cloud-save writes will be implemented through a trusted backend (Cloud Functions/Cloud Run/Admin SDK) and must keep the current client-write-deny Firestore policy intact.

## Runtime integration status

The modules are intentionally not loaded by `index.html` yet. This prevents an incomplete Firebase Web config from changing game startup or local-save behavior. After the exact Web App config is filled, the next phase should load only `firebase-bootstrap.js` from the game entry point and then add the login UI against the public bridge.

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

No local save function is wrapped by this layer.
