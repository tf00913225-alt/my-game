from pathlib import Path

def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text()
    assert old in s, label
    p.write_text(s.replace(old,new,1))

# Preserve the lazy feature boundary: startup may idle-prefetch bundles, but it
# must not execute the relic bundle merely to make its main-city button visible.
replace_once('js/20-anonymous-20.js', '''    document.addEventListener("four-symbols:startup-ready",()=>{\n        const api=loader();\n        if(!api){ return; }\n        /* 秘寶／元素匣是主城常駐入口。啟動完成後非阻塞預載 owner，\n           讓首次進入主城就同步插入按鈕，不必靠切頁才觸發 feature。 */\n        if(!api.isReady("relic")){\n            void api.ensure("relic","home-utilities").catch(error=>{\n                console.error("Home utility feature failed to preload:",error);\n            });\n        }\n        api.idle();\n    },{once:true});''', '''    document.addEventListener("four-symbols:startup-ready",()=>loader()&&loader().idle(),{once:true});''', 'startup relic eager-load block not found')

# Render the two persistent utility entrances in the app shell. Their feature
# code remains lazy and is executed only when the player actually taps them.
replace_once('index.html', '''        <button type="button" class="home-card home-card-secondary" onclick="openHomeFeature('system')" aria-label="系統">\n            <span id="homeIconSystem" class="home-card-icon" style="background-color:#000;background-image:url(assets/ui/home-system.png);"></span>\n            <span class="home-card-label">系統</span>\n        </button>\n    </div>\n\n</div>''', '''        <button type="button" class="home-card home-card-secondary" onclick="openHomeFeature('system')" aria-label="系統">\n            <span id="homeIconSystem" class="home-card-icon" style="background-color:#000;background-image:url(assets/ui/home-system.png);"></span>\n            <span class="home-card-label">系統</span>\n        </button>\n    </div>\n\n    <div class="home-utility-actions team-relic-home-tools" aria-label="主城常駐功能">\n        <button type="button" class="home-card home-card-utility team-relic-home-entry" data-feature="relic" onclick="openHomeFeature('relic')" aria-label="秘寶">\n            <span class="home-card-icon team-relic-home-glyph">寶</span><span class="home-card-label">秘寶</span>\n        </button>\n        <button type="button" class="home-card home-card-utility team-element-box-home-entry" data-feature="gameplay-core" onclick="openHomeFeature('autoBattleSettings')" aria-label="元素匣">\n            <span class="home-card-icon"><img src="assets/ui/nav-element-box.png" alt="" draggable="false"></span><span class="home-card-label">元素匣</span>\n        </button>\n    </div>\n\n</div>''', 'main-city system anchor not found')

p=Path('css/56-v174-critical-ui-regressions.css'); s=p.read_text()
marker='/* Main-city persistent utility shell: boot-visible before relic gameplay executes. */'
assert marker not in s, 'main-city shell CSS already present'
s += r'''

/* Main-city persistent utility shell: boot-visible before relic gameplay executes. */
#game-stage .team-relic-home-tools{
    position:absolute;left:50%;right:auto;bottom:0;z-index:5;display:grid;
    grid-template-columns:repeat(2,80px);width:192px;gap:32px;padding:0;
    box-sizing:border-box;transform:translateX(-50%);pointer-events:none;align-items:end;
}
#game-stage .team-relic-home-tools .home-card-utility{
    display:grid;grid-template-columns:1fr;grid-template-rows:58px 24px;align-content:stretch;
    justify-items:stretch;width:80px;height:84px;pointer-events:auto;position:relative;overflow:hidden;
    border:1px solid rgba(205,154,65,.82);border-radius:11px;
    background:linear-gradient(155deg,rgba(35,25,15,.96),rgba(8,7,5,.96));
    box-shadow:0 4px 10px rgba(0,0,0,.52),inset 0 0 0 1px rgba(255,224,151,.06);
}
#game-stage .team-relic-home-tools .home-card-utility:active{transform:translateY(1px) scale(.97);filter:brightness(1.12);}
#game-stage .team-relic-home-tools .home-card-icon{display:flex;align-items:center;justify-content:center;width:100%;height:58px;overflow:hidden;border:0;border-bottom:1px solid rgba(174,127,55,.55);border-radius:0;background-position:center;background-size:cover;background-repeat:no-repeat;}
#game-stage .team-relic-home-tools .home-card-label{align-self:stretch;padding:2px 3px 1px;background:linear-gradient(180deg,rgba(48,20,14,.98),rgba(14,9,6,.98));font-size:13px;line-height:18px;font-weight:900;}
#game-stage .team-relic-home-tools .home-card-icon img{width:100%;height:100%;object-fit:cover;display:block;}
#game-stage .team-relic-home-entry .home-card-icon{background-image:url("../assets/ui/home-relic-v174.eed14e806044.webp");}
#game-stage .team-relic-home-entry .team-relic-home-glyph{font-size:0;color:transparent;text-shadow:none;}
#game-stage .team-element-box-home-entry .home-card-icon{background-image:url("../assets/ui/home-element-box-v174.webp");}
#game-stage .team-element-box-home-entry .home-card-icon img{display:none;}
'''
p.write_text(s)

Path('tests/v173.65-dev-deploy-home-utilities.test.js').write_text(r'''const assert=require("node:assert/strict");
const fs=require("node:fs");
const index=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("js/20-anonymous-20.js","utf8");
const css=fs.readFileSync("css/56-v174-critical-ui-regressions.css","utf8");
assert.match(index,/team-relic-home-entry[^>]*data-feature="relic"/);
assert.match(index,/team-element-box-home-entry[^>]*data-feature="gameplay-core"/);
assert.match(index,/aria-label="主城常駐功能"/);
assert.doesNotMatch(app,/ensure\("relic","home-utilities"\)/);
assert.match(app,/four-symbols:startup-ready[\s\S]{0,120}\.idle\(\)/);
assert.match(css,/Main-city persistent utility shell/);
assert.match(css,/\.team-relic-home-tools\{[\s\S]*grid-template-columns:repeat\(2,80px\)/);
console.log("V173.65 dev-deploy home utility regression checks passed.");
''')

# Update historical assertions that specifically prohibited the old runtime
# utility layer. The original ten main-city entries remain intact; two static
# shell utility buttons are now intentionally present from first render.
p=Path('tests/v173.28-main-city-lobby.test.js'); s=p.read_text()
old='''test("offline experience and system join the existing side rails",()=>{\n    assert.equal(count(actions,/openHomeFeature\\('offlineExp'\\)/g),1);\n    assert.equal(count(actions,/openHomeFeature\\('system'\\)/g),1);\n    assert.equal(count(actions,/class="home-card home-card-utility"/g),0);\n    assert.doesNotMatch(actions,/home-utility-actions/);\n    assert.match(actions,/homeIconOfflineExp/);\n    assert.match(actions,/homeIconSystem/);\n});'''
new='''test("offline/system stay on the side rails while relic and element box are persistent shell utilities",()=>{\n    assert.equal(count(actions,/openHomeFeature\\('offlineExp'\\)/g),1);\n    assert.equal(count(actions,/openHomeFeature\\('system'\\)/g),1);\n    assert.equal(count(actions,/class="home-card home-card-utility/g),2);\n    assert.match(actions,/home-utility-actions team-relic-home-tools/);\n    assert.match(actions,/team-relic-home-entry[^>]*data-feature="relic"/);\n    assert.match(actions,/team-element-box-home-entry[^>]*data-feature="gameplay-core"/);\n    assert.match(actions,/homeIconOfflineExp/);\n    assert.match(actions,/homeIconSystem/);\n});'''
assert old in s, 'old lobby utility expectation not found'
s=s.replace(old,new,1).replace('assert.equal(count(actions,/<button type="button" class="home-card /g),10);','assert.equal(count(actions,/<button type="button" class="home-card /g),12);',1)
p.write_text(s)

p=Path('tests/v173.42-player-flow.test.js'); s=p.read_text()
old='assert.doesNotMatch(index,/home-utility-actions/);'
new='''assert.match(index,/home-utility-actions team-relic-home-tools/);\nassert.match(index,/team-relic-home-entry[^>]*data-feature="relic"/);\nassert.match(index,/team-element-box-home-entry[^>]*data-feature="gameplay-core"/);'''
assert old in s, 'old player-flow utility expectation not found'
p.write_text(s.replace(old,new,1))
