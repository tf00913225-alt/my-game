# Permanent Image Asset Pipeline

This repository uses one irreversible provenance path for formal monster portraits:

`Master PNG (assets-library) → Runtime WebP (dev) → Asset Manifest / Registry → Browser / Battle Runtime`

## Master versus Runtime

- Master PNG is the original, immutable source in the `assets-library` branch. Its original canvas, proportion, alpha and bytes are preserved; a WebP derivative is never accepted as a Master.
- Runtime WebP is a generated derivative in `dev`: 1024×1536, transparent, aspect-preserving `contain`, centered, without crop or stretch. The generator recipe and both SHA-256 values are stored in `config/monster-asset-provenance.json`.
- A runtime-ready entry has to identify one verified Master by repository, branch, commit, path, SHA-256, original dimensions, source declaration and formal monster identity.

## Identity

`monsterId`, display name and `portraitKey` must agree in the provenance manifest and `config/monster-portrait-registry.json`. Image appearance and filename are not identity evidence. Missing evidence is `IDENTITY_UNRESOLVED`, which blocks merging.

## Ownership

`js/45-v154-dev-fixes.js` is the sole portrait owner. V159 is retired from portrait ownership and may not call, wrap, or be required by V154. New portrait fallback owners are forbidden.

## Completion gate

`node tests/permanent-image-asset-pipeline.test.mjs` is the mandatory CI gate. It emits every failing `monsterId`, display name, file, pipeline layer and reason. A failure means `BLOCKED` or `INCOMPLETE`, never Runtime Ready.
