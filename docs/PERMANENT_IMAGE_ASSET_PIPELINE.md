# Permanent Image Asset Pipeline

This repository uses one irreversible provenance path for formal monster portraits:

`Master PNG (assets-library) → Runtime WebP (dev) → Provenance / Registry → Browser / Battle Runtime`

## Master versus Runtime

- Master PNG is the original, immutable source in the `assets-library` branch. Its original canvas, proportion, alpha and bytes are preserved; a WebP derivative is never accepted as a Master.
- Runtime WebP is a generated derivative in `dev`: transparent, aspect-preserving `contain`, centered, without crop or stretch.
- Runtime canvas is **not hardcoded**. It is derived from `config/monster-portrait-registry.json`:
  - `sizeClass=standard` → 1024×1536.
  - `sizeClass=boss` → 1536×2048.
- The generator recipe and Master/Runtime SHA-256 values are stored in `config/monster-asset-provenance.json`.
- A runtime-ready entry has to identify one verified Master by repository, branch, commit, path, SHA-256, original dimensions, source declaration and formal monster identity.

## Preferred scoped workflow

For a monster that already has a Registry target, the preferred workflow is one scoped transaction:

```bash
npm run portrait:finalize-master -- \
  --master-root=/absolute/path/to/assets-library \
  --master-commit=<assets-library full SHA> \
  --keys=<portraitKey,portraitKey,...>
```

The command performs:

1. Resolve the selected Registry target.
2. Derive the Master path from the Registry target stem with `.png`.
3. Validate Master PNG decode, alpha and transparency.
4. Derive the Runtime canvas from Registry `sizeClass`.
5. Generate lossless Runtime WebP.
6. Create or update immutable provenance metadata.
7. Promote the Registry target to `existing` and normalize its path to WebP.
8. Run Runtime contract, portrait audit and Permanent Image Asset Gate.
9. If any post-check fails, restore Registry, provenance and generated Runtime files to their pre-command state.

This command is intentionally scoped. `--keys` or `--group` is mandatory; an unscoped all-target finalize is forbidden.

## Already-generated WebP fast import

If an approved Runtime WebP already exists at the formal Registry target path and no Master conversion is required, use:

```bash
npm run portrait:import -- --keys=<portraitKey,portraitKey,...>
```

This validates the Runtime file and promotes eligible Registry targets without regenerating artwork.

## Provenance-managed regeneration

Existing provenance-managed portraits can be regenerated from verified Master PNG files with:

```bash
node scripts/generate-runtime-webp-from-master.mjs \
  --master-root=/absolute/path/to/assets-library \
  --keys=<portraitKey,portraitKey,...>
```

The generator uses Registry `sizeClass` dimensions. It must never assume every monster is 1024×1536.

## Identity

`monsterId`, display name and `portraitKey` must agree in the provenance manifest and `config/monster-portrait-registry.json`. Image appearance and filename are not identity evidence. Missing evidence is `IDENTITY_UNRESOLVED`, which blocks merging.

## Ownership

`js/45-v154-dev-fixes.js` is the sole portrait owner. V159 is retired from portrait ownership and may not call, wrap, or be required by V154. New portrait fallback owners are forbidden.

## Completion gate

Import／Master finalization also runs `scripts/measure-monster-portraits.mjs --write` to update the same Registry presentation metadata. The visual contract and sole presentation owner are defined in `docs/MONSTER_PORTRAIT_SPEC_V1.md` section 8; Alpha analysis occurs only offline. Metadata does not alter immutable Master or Runtime bytes. CI re-decodes with `--check`, validates hashes and runs full mobile bounds/baseline/redraw/reentry QA.

`node tests/permanent-image-asset-pipeline.test.mjs` is the mandatory CI gate.

The gate is **count-independent**. It validates every entry currently marked `runtimeReady=true`; it must not encode historical batch sizes such as “18 Wild Fire portraits”.

For each provenance-managed Runtime Ready entry it verifies:

- unique `monsterId`, `portraitKey` and Runtime path;
- verified assets-library Master provenance;
- Registry identity, path and `existing` state;
- Runtime dimensions against Registry `sizeClass`;
- WebP container, decode, alpha/transparency and SHA-256;
- V154 sole-owner / V159 retirement contract.

A failure means `BLOCKED` or `INCOMPLETE`, never Runtime Ready.
