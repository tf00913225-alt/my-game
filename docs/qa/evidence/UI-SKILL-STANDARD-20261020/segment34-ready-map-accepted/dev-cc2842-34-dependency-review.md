#Read-only dev advance190d249e→cc2842c5 review

Remote tracking ref inspectedcc2842c546e5b278dd6ef64ac1ecd86f5016e7d6. No merge/source changes performed. UI34 product candidate remains7025fe96.

Actual js00 delta is14added/1removed lines confined to battle-status-detail portrait, agility readout and same-task panel scroll reset. No incoming change to skill loadout/equip/remove/learning/hero/busy/character/abyss renderer functions. js31auto-action,js60skill-progression,functions skill-progression-core/canonical-skill-loadout andfirebase bootstrap/cloud-save have no delta in this range. Thus this advance does not add another skill-config authority change like#974; avoid claiming it does.

Feature manifest,feature-loader,patrol source,41/42/59 Abyss sources have no incoming delta.34 original map resolution/portrait dependency/return fixes therefore remain source-disjoint. Existing34 evidence is still valid for its7025 snapshot only. Its after QA is not automatically current-head evidence after a future merge.

Builder target() now canonicalizesCRLF/CR→LF BEFORE hashing. Correct build provenance matters: generated JS/CSS/manifests must regenerate normally from merged authored sources; do not reuse either branch's generated output or compare raw filesystemCRLF against normalized bundle bytes without accounting for builder normalization. Asset manifest/hash/name conflicts are likely mechanical. Preserve original UIindex critical references via builder, not manual stale-name resolution.

Incoming#958 also changes sharedbattle CSS40/fixed-slot CSS,js54,geometry adapter andtouch-lock lifecycle; those require original battle Owner/related focused checks when merging. They do not authorize expanding34 into actual combat. Incoming#975 changes canonical-current-recovery/recovery-audit andcontracts; those sources must equal accepted upstream result, not be repaired in UIbranch. Latest-head Actions owns required SDK/emulator validation; no localfullSDK repetition proposed.

Merge risks: js00shared file may auto-merge but independently prove original UIhero/busy/skill detail scroll/copy vsbattle-status changes preserved; shared CSS40/fixedslot retain both branches' accepted UI declarations and upstream battle presentation.34 CSS42/46/50/54/59/config should retain own fixes exactly. After merge build/check, relevant focused regressions and minimal dependency/load evidence as dictated by changed asset output; no blind rerun of all past UI subsets. No Cloud/recovery authority changes by this reviewer.
