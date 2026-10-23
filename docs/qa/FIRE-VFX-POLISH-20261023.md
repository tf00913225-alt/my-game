# Fire representative sample — current checkpoint

## Current range continuation (2026-10-23; supersedes old pending rows)

User approved flameSlash direction and authorized ONE range representative, with phone recording before any batch expansion. Same Work ID/branch/#983. Product Head27426b4fd3a7b4c2bda6709f5568001e15cdaae6; only explosiveFlurry added. Existing flameSlash frames and all other skills/assets/data/CSS remain unchanged. Live #955 still ba2c451a/open Draft; shared UI boundary preserved.

Existing explosiveFlurry group raster receives one envelope (.90→.94→1 at original hit→.98), translated -50% before scaling to preserve fitted center. Original requestCastTimeline synchronizes its v143MotionAnimation, remeasure does not restart, late nodes catch up, disposal cancels the same track. It never grows outside the original fitted box. Hit recipients use the same140ms action layer: ordinary6px/critical7.5px,1deg/.99 then neutral. MISS/non-target/shield/heal/status exclusions and reduced-motion guard remain. Formal tri targets, one settlement per actual recipient,1450ms/7-of-12 hit and source pixels unchanged. No new procedural renderer/material/screen shake or extra damage.

Five focused suites PASS: new fire-range-envelope, battle-feel-impact, direct-impact-overlay, vfx-cast-clock and cold-clock. Official build/check/diffcheck PASS. Initial missing-config VM seam corrected with the existing optional-config convention, no relaxed assertion. Independent source review: no new blocker; final centering change separately reviewed with actual browser center samples.

Physical Samsung SM-N960F, production Chrome, isolated3v6: four uninterrupted cases player-hit / enemy-hit / player-mixed / player-all-MISS. Formal target resolver selected3 eligible recipients each; non-target enemy row remained unaffected. Recoil recipients observed3/3/2/0, all four original gates naturally completed, fixed unit/HUD before-after and unchanged HP, fitted source center stable within.5px, cleanup true, zero runtime exceptions. Actual sequence8126.6ms, native screenrecord16.014489s720x1280. SHA256 2B8F1D6AD73B4FE570350A5DEDD64D7F091D0A03EBAA2AC13FBC29446B572B0F.22 decoded frames include charge/spread/impact/tail, enemy3-recipient feedback, mixed -1HP/MISS/-1HP, allMISS. Preserve local artifacts/fire-range-usb/native-preview.mp4, native-decode.json, evidence.json, sequence-frames; compact loaded-bundle/source/rows evidence in FIRE-VFX-POLISH-20261023-range.json.

Desktop preliminary6ae snapshot passed same four cases; it is not relabeled final274 proof. Intermediate6ae phone footage retained separately, not final acceptance. Earlier QA primary-index assumption returned only2 legal targets; corrected QA to use original resolver's largest legal set, not product target rules. Host/phone wall clocks differ; native decoded pictures, not direct wall-clock subtraction, establish movie scope. Failed/initial candidates retained.

Limits: presentation director/feedback fixture using actual formal range resolution, not actual Core skill damage/lunge/transaction. -1HP is fixture display, HP does not change. No full-fire/fullCore/shield/lethal/reduced-motion USB acceptance claimed. User range-art direction still pending. Stop at this one representative, no batch expansion/merge. Latest274 CI39890347295 last observed pending; no rerun/cancel/timeout workaround. Evidence-only checkpoint must obtain its own required checks before future merge; Chrome #976 remains sole root-cause Owner.

Independent final source/picture review fire_sample_review actually viewed native frames0004/0010/0015/0020 and row evidence: no source safety or HUD/readability blocker in this subset. It explicitly notes the three white impact silhouettes are strong, and temporary torso occlusion is visible; the user decides that art strength. Mixed/all-MISS text positions are distinct and non-target row remains readable. Review does not constitute human art approval or true Core acceptance.

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

## Current continuation — actual desktop and USB evidence

Product remains exactly 938361014a711d3c3d9a0e1bbefc5bd4abb6af89. Evidence-only update; no additional VFX changes. User explicitly resumed physical verification; escalated devices query successfully read serial2858d1d9c23f7ece / Samsung SM-N960F device. This supersedes the earlier environment blocker, not a blanket permission grant.

Desktop Chrome412x915 isolated3v3 presentation fixture: original director + Floating Feedback, damage/criticalDamage/MISS, original760ms gates, stable unit/HUD before-after, HP unchanged, cleanup and zero runtime exceptions PASS. Desktop recording is timestamped sampled CDP screenshots re-encoded WebM, not native/frame-rate evidence.

Physical Chrome on SM-N960F: same three presentation cases, 53/54/58 samples with9/9/0 active recoil observations; all gates naturally v142-v143-visual-complete, same actual motion child, stable unit/HUD and unchanged HP, cleanup true. Native screenrecord12.019811s720x1280, SHA AA1ED5B8F44DAEBAB4C6804B70EC0068DF8A941D074EB5DA07DC780583D7C307. Decoded native frames show the sequence's first enemy slash, ordinary feedback, ally feedback and MISS; no source clock paused. Host/phone wall clocks differ, so their Date.now timestamps must not be directly subtracted to infer coverage. Native decoded pictures are the visual evidence.

Local evidence retained under artifacts/fire-sample-desktop and artifacts/fire-sample-usb; native-preview.mp4 / native-decode.json / sequence-frames. Earlier page-attachment/tab-registration/capture interference/recording QA failures and startup-only/incomplete clips are retained separately, excluded from acceptance. Fixes were scratch QA only. No actual Core cast/damage/lunge movie, lethal/shield USB, six-versus-six or all-fire acceptance claimed. Human art direction still pending; no batch extension or merge.

Durable compact evidence: FIRE-VFX-POLISH-20261023-representative.json. Targeted2 Node suites rerun PASS, product unchanged. Head93836101 CI39876607582 attempt1 FAILED: portrait120163938613, Abyss120163938876, Session boot120163939118 all Chrome startup before game; aggregate120173654599 downstream. No rerun used, no timeout/Chrome/product workaround; root-cause Owner remains #976. New evidence Head requires its own CI, old results cannot authorize it. Do not create a dummy commit or rerun to reset quota.
