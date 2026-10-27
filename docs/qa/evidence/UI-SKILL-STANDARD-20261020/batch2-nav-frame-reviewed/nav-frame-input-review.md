# Nav frame independent input review

Reviewed four viewport nav-states/report/cleanup JSON sets and helper artifacts/nav-frame.mjs. Viewed actual PNGs via view_image:360 nav-pressed,393 home,412 dungeon,1280 returned-home. Head e4966289d0fdf41580363fb835f301b430d182e3. No browser or tracked changes.

All four sequence contexts main→daily→main. Each state has exactly five nav buttons, one native-bottom-nav-layer shell under game-overlay-layer, with the original panel border-image. Home and returned-home have 主城 active. Dungeon context labels are 角色/背包/秘寶/元素匣/返回. All fifteen measured button states per viewport have center EFP hit=true and both dimensions >=44: minimum72/72,78.60/78.60,82.40/82.40,90/90px respectively. This establishes one shell at each observation in its original owner, not a persistent DOM identity assertion.

Helper's actual sequence records home, dispatches original dungeonNav press, holds60ms and screenshots nav-pressed, releases and records dungeon, then dispatches original context 返回 and records returned-home. Desktop>=800 uses mousePressed/released; phone uses touchStart/end. The generic unused tap helper still uses touch, but exercised nav entry/return paths branch correctly. Inputs are not all persisted as coordinate/event traces in JSON; source plus resulting states qualify this narrow sequence. No claim every five-button action was clicked.

Images show readable gold icons/labels against textured frame, home active marker, original context icons in dungeon, and full bottom frame without displaced nav. Press screenshot is a held original input observation; helper does not explicitly assert :active/focus state, so this is not comprehensive active/focus acceptance. Reports all scenes small/overflow/clippedControls empty, within the measured presentation scope.

All reports dirty=false, initial/final status empty, manifestUnchanged=true; helper asserts unchanged Head/status/manifest. All cleanup profileRemoved=true and runtimeRestoreExact=false. Source cleanliness does not establish exact save/runtime restoration. CSS06 texture/ornament change is presentation scope; this review does not extend to all contexts, keyboard/focus, physical devices, transactions or production deployment.

No blocker found within four-size main→pressed original dungeon entry→daily→original context return sequence. Required latest-Head CI remains separate.
