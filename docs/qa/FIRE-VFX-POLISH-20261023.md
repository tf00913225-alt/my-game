# Fire representative sample — current checkpoint

Work ID: FIRE-VFX-POLISH-20261023
Branch: feature/fire-vfx-polish-20261023
Base: bc7efd1c4e66c1cb412fab29d404123f5495ea86
Status: IMPLEMENTED candidate, NOT visual/USB accepted; Draft only.

## Direct ownership and inventory

Final gameplay data: `js/60-v173.64-skill-progression-rebalance.js` FINAL_REBALANCE_DATA and skill definitions. Target authority: `FourSymbolsBattleSkillTargeting` / Fixed Slots, not effect names. Damage is settled in the original Core target loop (`castSecondaryCharacterSkill`, `settleBattleHpDamage`); V143 only presents its committed facts. No data, targeting, settlement or Core edits.

| Formal ID | Formal target | Direct damage per cast/recipient | Existing V142 authored duration |
|---|---|---|---|
| flameSlash | single | 1 | 760ms |
| fireCritical | single | 1 | 1050ms |
| explosiveFlurry | tri | 1 | 1450ms |
| dragonSlash | single | 1 | 2800ms |
| fireRocket | tri | 1; burn separate | 900ms |
| blazeSpell | single | 1; burn separate | 1150ms |
| flameTornado | single | 1; burn separate | 2100ms |
| phoenixCry | all | 1; burn separate | 3200ms |
| rage | allyTri | 0, buff | 1500ms |
| fireSoulResonance | self | 0, buff | existing V142 data/fallback, unchanged |
| bloodBurnArt | self | 0, buff/HP cost, not hostile damage | existing V142 data/fallback, unchanged |
| fireEX | passive | 0, no cast VFX | no new active cast |

`tri` is up to three eligible formal slot targets, not three hits. `all` uses actual eligible entities, not a fixed count. Boss restrictions remain the original primary-only rule except all/enemyAll. Physical critical/defeat follow-ups are distinct existing casts (max extra casts 1/1/1/2 for flameSlash/fireCritical/explosiveFlurry/dragonSlash), not extra impact frames or invented damage ticks. Burn remains original round/status processing, excluded from direct recoil.

Timing: original V142 duration (including any formal animationDuration override) remains authoritative. V143 fire direct clips use DEFAULT_HIT .5833333333 on the original visual timeline and existing targetHitTime; no extra clock, freeze, hit, delay or action-gate extension. Frame counts/clip duration/target offsets unchanged. No claim that presentation fixture constitutes complete primary/enemy/Core USB verification.

## #955 boundary

Live #955: Draft/open, ba2c451a43bf67f1f7a9371cce5d7051e97d2240, unmerged. Merge-base-to-Head diff confirms no edits in JS39, JS37 or battle-floating-feedback-owner. JS60 has display-copy/element-label changes, retained untouched here. Shared CSS00/CSS40/fixed-slot and other UI files are actively modified there: no CSS/layout/HUD/command/number skin edits in this segment. Generated bundles/manifests must later be regenerated from normally integrated sources, never overwrite another branch's generated output. Do not merge #955 or claim its Gates passed.

## First candidate actually implemented

Only flameSlash confirmed direct-hit recoil differs, on the same `.v174-action-motion` node (existing fallback retained): 140ms, short retreat 8px (critical 10px), lean 2deg with side direction, scale .985, then neutral translate/rotate/scale. Existing committed-hit identity, MISS/Shield/non-direct exclusions, reduced-motion suppression, lethal guard and cancellation remain original Owner. All other skills retain their existing frames/assets. No new asset, fake skeletal animation, damage-number change or battlefield shake yet. Existing newer fire sprites from base are reused unchanged.

## Evidence and limits

- Targeted Node suites: battle-feel-impact-20261008 and battle-direct-impact-overlay-20261011 PASS (2 files). Covers both sides, same delay/duration, neutral final frame, MISS/heal/shield/status exclusions and reduced motion; original overlay/terminal lifecycle suite retained.
- Official build and build --check PASS. No full local matrix repeated.
- Independent source reviewer fire_sample_review: no new safety blocker; accurately notes .985 scale, original lethal/cancel ownership retained. Review is source-only, not art/USB approval.
- USB/ADB stopped per user instruction; user will handle after waking. No reconnect, diagnostic, retry or security setting change in this segment.
- Browser picture/continuous recording, actual motion-child/lethal pictures, USB and human art-direction approval PENDING. Candidate is not ready to merge. No batch expansion to remaining fire skills.

Next: present/record this bounded candidate using isolated QA data; receive visual direction and physical-device availability before extending to range/multitarget representatives. Need genuine material gaps before generating anything. Latest Head required CI remains necessary but cannot replace art/USB Gates. Chrome #976 remains its existing Owner; no timeout workaround or repeated rerun here. Old #941/#958/#979 remain closed. Stop this segment after durable Draft checkpoint; do not merge pending visual Gates.
