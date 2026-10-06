# Wind EX low-HP evasion — 2026-10-05

Work ID: WIND-EX-LOW-HP-EVASION-20261005. Base dev `76f35f0014a6a87ef7d821eb243bfd892f9ed5c1` (Fire PR #805 integrated). Branch `fix/wind-ex-low-hp-evasion-20261005`, target dev; main forbidden. Game/Cache remain 173.73. Status IMPLEMENTED; Work PR owns subsequent exact-head CI, integration, deployment and cleanup checkpoints. Do not restart Fire/MonsterBalance migration or infer COMPLETE from functional evidence.

## Contract and owners

Only a native Wind character with learned Wind EX receives constant Final Evasion +15 and Final Accuracy +15. Current HP strictly below final Max HP × 0.25 adds 50 percentage points of Final Evasion (65 on a naked character). Exactly 25.00%, above the boundary, or healing to the boundary immediately removes the extra 50. Main, second and third characters derive independently; equipment Max HP changes the boundary immediately.

`js/00-main.js::getMainCharacterStats` and `getAdditionalCharacterBattleStats` settle Max HP once, then call `getWindEXFinalEvasionBonusPercent(character,maxHP)`. The helper uses the existing native/learned EX owner and current HP; no recursive stat getter, state, timer or wrapper. Existing Final Accuracy projection is unchanged. Dodge, equipment, relic and Frostbite retain their existing owners and add once; Final Evasion is uncapped, while `calculateHitChancePercent` still clamps the resulting Hit to 5–99.

`js/60-v173.64-skill-progression-rebalance.js` owns the final EX values and description. The old `lowHpFinalHitCapPercent` field and enemy Hit cap branch/text are physically retired; deprecated-code gate rejects reintroduction. No old/new parallel behavior. Dodge Lv1–5 remains +5/+10/+15/+20/+25 for three turns.

The production build refreshes hashed bundles, manifests and the existing generated cloud normal-attack shared Hit function/dependency digests. No Cloud authority, callable, persisted state, reward, MonsterBalance profile, level damage or save owner changes. Build removes obsolete hashed bundles according to the existing build owner.

## Executable evidence and remaining gates

- Formal full-production VM integration: 41/41 PASS, including all three native Wind characters; HP ratios 100%, 24.99%, 25.00%, 25.01%, healing/re-damage, unlearned/foreign EX, changed Max HP, additive equipment/Dodge/Frostbite, uncapped Evasion and preserved Hit bounds.
- Focused progression/Fire target/level/six-stat regressions: 67/67 PASS, skip 0. Existing isolated six-stat fixture now loads the real shared helper; Earth EX static assertion follows the settled Max HP expression in both original stat owners.
- Existing production Chrome Hit/Evasion runner now checks the same boundaries, relic + low-HP EX − Frostbite, incoming normal/skill calls through the actual Hit owner, description retirement and visible detail Evasion. Existing DEV live QA step runs that same runner with exact release-manifest SHA assertion. No check removed or bypassed.
- Local Chrome is blocked by socket EPERM. Local Browser PASS is not claimed. Exact-head CI production Browser, merged dev CI/Session, deployed SHA/live Browser evidence and restorable absorbed branch cleanup must pass before closeout. No physical-device acceptance claim.

Fire remains integrated at PR #805 / merge `76f35f0014a6a87ef7d821eb243bfd892f9ed5c1`. Its exact source `ce40e251b274c5b135d64f37d39ddd922ccf3d69` CI `37327507546` and Session `37327507328` passed; target artifact `11353460818` SHA256 `01022c927c12b084a6b1668a9243e58416dd7ad838acb9df33a1d7062386afa5` independently verifies all 48 cases and both mobile viewports. Final deployed verification can use the latest dev containing both changes; Fire deployment/cleanup is not claimed complete here.
