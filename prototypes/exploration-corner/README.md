# 桃溪一隅 — isolated exploration sample

Work ID: EXPLORATION-CORNER-20261023
Branch: feature/exploration-corner-20261023
Base dev: bc7efd1c4e66c1cb412fab29d404123f5495ea86
Status: IMPLEMENTED SAMPLE, independent review corrections applied; user art/input acceptance pending. DO NOT MERGE OR DEPLOY.

This batch is an additive, opt-in prototype. It is deliberately absent from the production entry, feature manifest and build. No formal player/account, story, reward, battle, inventory or save code is invoked. Greeting copy demonstrates proximity + confirmation only; it is not the later real NPC dialogue integration. Four directions and one touch directional pad are provisional product experiments. All devices retain portrait view.

Run `node prototypes/exploration-corner/serve.mjs`, then open the printed local URL. Direction keys/WASD move; E or the touch button greets the NPC. All state resets on reload. Nothing persists. Stop the server with Ctrl+C.

Owners: `scene.mjs` owns sample dimensions, collision shapes and camera math; `runtime.mjs::mountCorner` owns input/frame/depth/proximity/lifecycle; `style.css` owns only `.explore-*` presentation; `art.svg` is original vector sample art, not imported game/third-party art. It is a visual direction sample, not a declaration of final art quality. No raster generation, dependency install or paid service.

The test host `serve.mjs::displaySource` reads the exact existing `js/00-main.js` Display declaration boundary. It executes that source unchanged with original css/00 and css/03. No copied fit formula, responsive layout or new production scaler. The existing gesture owner is loaded. This fixture does not prove final integrated gameplay compatibility; integration is a later authorized batch.

Existing production wrappers/overrides remain untouched. P0 identified #955 shared CSS/Adventure UI, #984 Adventure tutorial and #983 JS39 as concurrent Owners. Their heads remained ba2c451a/bfca39ba/83010b13 at start. This diff changes none of those files and does not unblock or work around #976 Chrome CI.

Verification: `node --test prototypes/exploration-corner/corner.test.mjs` checks solid collisions/tunnelling, spawn, direction/speed, camera bounds, proximity and isolated state boundary. `browser-qa.mjs` uses existing `runtime-browser-qa-support.mjs` Cdp/waitJson and original Chrome arguments/deadline; input is trusted CDP touch or keyboard/mouse, state is read-only. No character/resource/position injection. It only starts the sample server, not the helper's account/game fixture server.

Initial sandbox browser connection failed with EACCES; a scoped approved command used the same unchanged QA path. First approved run exposed a fixture URL 404; fixed the returned index URL. Both earlier failures remain in external evidence. First successful two-size run's tree-back label was not sufficient occlusion proof: the player stopped at the trunk. Follow-up explicitly walks around the trunk and asserts player depth < tree depth. Do not reuse the earlier label as occlusion acceptance.

Independent review inspected five actual v3 images and the bounded source diff. It found a stale dialog on remount (P2) and unscoped facing selectors (P3); both are corrected. The lifecycle check simulates pagehide/pageshow with a restored visible dialog; it does not establish real browser BFCache behavior. Tree-back evidence shows overlap; tree-front screenshot alone does not prove foreground overlap. Direction readability and art quality still require user acceptance.

External evidence: corner-evidence-v3 contains two-size screenshots/results; corner-recording/recording.html contains 427 real timestamped Chrome touch-emulation frames (14.48 seconds), recorded before the lifecycle/style review corrections. This is not physical-phone footage. No new game behavior was added by those corrections.

Draft PR creation was denied by automatic approval review for lacking explicit PR authorization. No PR exists, no alternate creation path was attempted, and Required CI is pending. Pending: real phone input/continuous animation acceptance and user visual direction. Existing PR Required CI remains required and is not replaced by local tests. No production build changes to verify here. Do not merge/deploy, expand to real NPC/battle/reward/save, complete village/forest, minimap or new engine without the next batch decision.
