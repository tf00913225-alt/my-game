# Master PNG Contract

`assets-library` is the sole, version-controlled home for every formal Master PNG.

## Rules

1. A Master is the immutable original PNG: retain its original bytes, canvas, aspect ratio and alpha. Never resize, crop, pad, compress, overwrite, or reconstruct it for gameplay.
2. A Runtime WebP is a derivative only. It must never be promoted back to Master status.
3. Every Master must have one identity record in `assets/MASTER_ASSET_INDEX.json` containing `monsterId`, display name, `portraitKey`, path, SHA-256, original dimensions, PNG/alpha/decode evidence, source reference, rights/source declaration, identity status, and deterministic Runtime recipe.
4. Runtime output belongs to `dev`, not this branch. The only legal monster portrait transform is aspect-preserving `contain`, transparent 1024×1536 canvas, centered, without crop or stretch.
5. A missing or unverified identity is `IDENTITY_UNRESOLVED`. It is a merge blocker, never a reason to invent a name from an image or filename.

## Current recovery batch

The 18 Wild Fire Masters recovered in assets-library PR #686 are the declared identity authority for this batch. Their original files stay under `assets/monsters/wild/**/fire-*.png`; their derivatives must be reproducible from the recipe stored alongside each record.
