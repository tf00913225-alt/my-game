# Fire Follow-up Lethal Retarget

Work ID: FIRE-FOLLOWUP-LETHAL-RETARGET-20261005
Base dev: a9e3cc0c14c74005f517a594b96c1886665ff469
Branch: fix/fire-followup-lethal-retarget-20261005
Target: dev; main forbidden. Status: IMPLEMENTED / NOT COMPLETE.

The #804 core resolver rejected a defeated primary and returned an empty targeted array. That rule is correct for an original queued action but incorrectly cancelled defeat-triggered free fire casts.

Core `retargetEnemyFollowUpSnapshot` replaces only a defeated primary and shares the exact frozen `targets` array, token, round and actor identities. Current identity, HP and formal hostile-primary eligibility filter survivors. A living primary is never rerolled; stealth or replaced identity never triggers lethal fallback. V149 reuses this core decision before the next cast; formal target shape is resolved afresh. No new wrapper, queue, AI owner or permanent state.

#804 planning snapshots, original-action validation, late-revival exclusion, cancel/token/round/actor guards remain. Dragon original +2 free casts; other three original +1. Existing SP/cast-ID/finish interception unchanged.

Tests: 30/30 executable core+complete V149 cases PASS, including A/B/C/D revival, cast caps, SP, finish and geometry. Related Skill/Tower/Abyss/Boss regressions 35/35 PASS. Build/build:check PASS. Local Chrome absent from PATH; recovered installed executable, but CDP startup ECONNREFUSED before Browser execution. Browser PASS not claimed. Existing production runner now asserts 48 scenarios over manual/auto, regular/Boss and lethal/revival/dragon cases; existing CI and exact deployed QA entry points unchanged.

Pending: exact Head CI and production Browser, functional requirement verification, fresh dev check, normal merge, merged CI, exact DEV SHA/live QA and safe absorbed branch cleanup. PR owns durable current status. No main release.
