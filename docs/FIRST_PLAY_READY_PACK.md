# First Play Ready Pack

`first-play-core` is the install/first-boot resource preparation contract for 《四象江湖傳》.

## Owners

- Source manifest: `config/first-play-manifest.json`
- Production expansion / hashing: `scripts/build-production.mjs`
- Runtime download, verification, decode and completion record: `js/startup/first-play-resource-loader.js`
- Startup sequencing / presentation timing / Account-first transition: `js/52-v173.20-startup-loader.js`
- Privacy policy gate: `privacy-consent.html`
- Feature bundle dependency graph: `config/feature-manifest.json` → generated `asset-manifest.json`

Do not add First Play URLs ad hoc in startup JavaScript. Add a bundle or asset to `config/first-play-manifest.json`; the production build must resolve its content digest and byte size into `asset-manifest.json.firstPlay`. The generated pack size, resource count and fingerprint are authoritative build outputs rather than duplicated constants in QA or runtime source. The top-level `asset-manifest.json.assets` map remains reserved for content-addressed production outputs; unhashed First Play source paths live only inside the verified `firstPlay.resources` contract.

## Readiness contract

A resource is complete only after its HTTP response succeeds, its byte length and SHA-256 prefix match the deterministic production manifest, and (for render-critical images) `Image.decode()` or the equivalent fallback succeeds. `100%` means every resource in the current First Play manifest passed those checks.

Runtime progress uses downloaded bytes divided by deterministic total bytes. Task completion is the fallback if byte totals are unavailable. The runtime worker pool is limited by the manifest and currently uses 5 workers (hard-capped at 6).

The completion record is stored under `four_symbols_first_play_ready` and contains the game version, First Play manifest version, asset-pack version, manifest hash, completion time, and the content hash of each completed resource. A changed manifest does not make an old record current. Unchanged cached resources are reused; new, changed or missing resources are fetched and verified.

## First launch

1. Logo scene begins.
2. The second world scene becomes the loading presentation while `first-play-core` is prepared.
3. The real progress bar remains authoritative; presentation timing never bypasses readiness.
4. When the pack reaches verified 100%, the current privacy-policy version is required.
5. Firebase initialization / UID resolution is forbidden until privacy consent succeeds.
6. Account-first remains `Firebase UID → UID-scoped local/cloud save resolution → character creation or city`.

A required asset HTTP/decode/verification failure keeps the user in startup, shows `部分必要資源載入失敗`, and exposes `重新下載`. Retry operates only on the failed resource set.

## Returning launch

A device with a completed First Play record gets the deliberate brand presentation:

- Logo scene: about 5 seconds.
- World scene: about 5 seconds.

The 10 seconds are not idle. In parallel the runtime validates the current manifest/pack, warms First Play resources and core feature bundles, restores Firebase when the current privacy version is already accepted, and may pre-read the resolved UID's local save metadata. If resources are not ready after the second 5-second scene, the world scene remains visible and real update progress continues until readiness.

## Privacy

Current policy version: `2026-09-11-v2`.

Consent is stored as structured data under `four_symbols_privacy_consent`:

```json
{
  "privacyPolicyVersion": "2026-09-11-v2",
  "acceptedAt": "ISO-8601 timestamp"
}
```

A different policy version requires a new acceptance. The agree action remains disabled until the policy has been scrolled near the bottom. Declining blocks Firebase UID creation, account login and cloud-save use.

## Scope

The pack is intentionally smaller than the full repository. It prepares boot/auth/account owners, app shell, character creation, city/core navigation art, basic gameplay/battle dependencies and immediate patrol assets. Deep optional content such as Abyss, skill-progression and boss/relic feature bundles remains outside the First Play pack and continues through feature loading.

## QA

`.github/scripts/run-boot-architecture-browser-qa.mjs` covers fresh First Play, current returning 5+5 timing, stale-manifest continuation on scene 2, required-resource HTTP failure and retry, image decode failure and retry, privacy blocking before acceptance, policy-version re-consent, Account-first save isolation and the existing mobile creation/city regression checks.

After deterministic generated outputs are materialized, PR acceptance must be based on a fresh standard `Repository checks` run from the current branch head rather than the materialization workflow itself. The final merge must reference that exact verified head SHA.
