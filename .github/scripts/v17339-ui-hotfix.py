from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old,new,1)

# Creation owner: enlarge typography again while reclaiming only internal vertical rhythm.
p=Path('css/29-v125-character-creation-native.css')
s=p.read_text()
repls=[
('    padding:10px 0 24px;','    padding:10px 0 18px;','creation header padding'),
('''#creationPage .creation-subtitle{\n    margin:12px 0 0;\n    font-size:32px;''','''#creationPage .creation-subtitle{\n    margin:9px 0 0;\n    font-size:36px;''','creation subtitle'),
('''    gap:20px;\n    margin-top:20px;\n    color:#786c5c;\n    font-size:24.5px;''','''    gap:20px;\n    margin-top:16px;\n    color:#786c5c;\n    font-size:27px;''','creation steps'),
('    font-size:23.143px;\n    color:#cdbb9d;','    font-size:26px;\n    color:#cdbb9d;','portrait caption'),
('''#creationPage .creation-portrait-caption b{\n    font-size:28.286px;''','''#creationPage .creation-portrait-caption b{\n    font-size:32px;''','portrait caption bold'),
('    padding:36px 30.857px 30.857px;','    padding:24px 30.857px 18px;','choice panel padding'),
('''#creationPage .creation-section-kicker{\n    margin-bottom:15.429px;\n    color:#c8b28e;\n    font-size:26.5px;''','''#creationPage .creation-section-kicker{\n    margin-bottom:10px;\n    color:#c8b28e;\n    font-size:30px;''','section kicker'),
('''#creationPage .creation-element-kicker{\n    margin-top:28.286px;''','''#creationPage .creation-element-kicker{\n    margin-top:16px;''','element kicker spacing'),
('''    color:#b9aa93;\n    font-size:32px;\n    font-weight:700;''','''    color:#b9aa93;\n    font-size:35px;\n    font-weight:700;''','gender text'),
('''    color:#efbc61;\n    font-size:37px;''','''    color:#efbc61;\n    font-size:40px;''','gender symbol'),
('''#creationPage .element-option .element-name{\n    margin:0;\n    font-size:24.5px;''','''#creationPage .element-option .element-name{\n    margin:0;\n    font-size:29px;''','element names'),
('''#creationPage .creation-role-card{\n    margin-top:25.714px;\n    padding:23.143px;''','''#creationPage .creation-role-card{\n    margin-top:14px;\n    padding:16px;''','role card rhythm'),
('''#creationPage .creation-role-title-row{\n    display:flex;\n    align-items:center;\n    gap:20.571px;''','''#creationPage .creation-role-title-row{\n    display:flex;\n    align-items:center;\n    gap:16px;''','role title gap'),
('''#creationPage .creation-role-title{\n    color:#fff2d8;\n    font-family:"Noto Serif TC",serif;\n    font-size:42px;''','''#creationPage .creation-role-title{\n    color:#fff2d8;\n    font-family:"Noto Serif TC",serif;\n    font-size:46px;''','role title'),
('''#creationPage .creation-role-subtitle{\n    margin-top:7px;\n    color:var(--creation-accent-light,#e7b85e);\n    font-size:29px;''','''#creationPage .creation-role-subtitle{\n    margin-top:5px;\n    color:var(--creation-accent-light,#e7b85e);\n    font-size:33px;''','role subtitle'),
('''#creationPage .creation-role-description{\n    margin-top:20px;\n    color:#b9aa93;\n    font-size:30px;\n    line-height:1.65;''','''#creationPage .creation-role-description{\n    margin-top:12px;\n    color:#b9aa93;\n    font-size:34px;\n    line-height:1.55;''','role description'),
('''#creationPage .creation-role-tags{\n    display:flex;\n    flex-wrap:wrap;\n    gap:10.286px;\n    margin-top:18px;''','''#creationPage .creation-role-tags{\n    display:flex;\n    flex-wrap:wrap;\n    gap:8px;\n    margin-top:10px;''','role tags rhythm'),
('''#creationPage .creation-role-tag{\n    padding:7.714px 15.429px;''','''#creationPage .creation-role-tag{\n    padding:5px 13px;''','role tag padding'),
('''    color:#d7c8b0;\n    font-size:23.5px;''','''    color:#d7c8b0;\n    font-size:26.5px;''','role tag font'),
('''    font-family:"Cinzel",serif;\n    font-size:23.143px;\n    font-weight:900;\n    border:2.571px solid rgba(210,157,72,.42);''','''    font-family:"Cinzel",serif;\n    font-size:26px;\n    font-weight:900;\n    border:2.571px solid rgba(210,157,72,.42);''','identity index'),
('''#creationPage .creation-label{\n    margin:0;\n    color:#f4e8d4;\n    font-size:34.5px;''','''#creationPage .creation-label{\n    margin:0;\n    color:#f4e8d4;\n    font-size:38px;''','identity label'),
('''#creationPage .creation-card-caption{\n    margin-top:5.143px;\n    color:#8f806c;\n    font-size:24.5px;''','''#creationPage .creation-card-caption{\n    margin-top:5.143px;\n    color:#8f806c;\n    font-size:28px;''','identity caption'),
('''    padding:0 30.857px;\n    outline:none;\n    font-size:39px;''','''    padding:0 30.857px;\n    outline:none;\n    font-size:42px;''','creation input'),
('''#creationPage .creation-next span,\n#creationPage .creation-back span{\n    font-family:"Noto Serif TC",serif;\n    font-size:36px;''','''#creationPage .creation-next span,\n#creationPage .creation-back span{\n    font-family:"Noto Serif TC",serif;\n    font-size:39px;''','next text'),
('''    color:#af9364;\n    font-family:"Cinzel",serif;\n    font-size:18px;''','''    color:#af9364;\n    font-family:"Cinzel",serif;\n    font-size:20px;''','next small'),
]
for old,new,label in repls:
    s=replace_once(s,old,new,label)
p.write_text(s)

# Main-city owner: robust home header suppression and vertical utility cards.
p=Path('css/00-main.css')
s=p.read_text()
s=replace_once(s,'''#app.no-header .header{\n    display:none;\n}''','''#app.no-header .header,\n#app:has(#homePage.active) #gameHeaderBar{\n    display:none;\n}''','home header fallback')
s=replace_once(s,'''#app.no-header .content{\n    top:0;\n}''','''#app.no-header .content,\n#app:has(#homePage.active) .content{\n    top:0;\n}''','home content fallback')
s=replace_once(s,'''    grid-template-columns:repeat(2,104px);\n    justify-content:space-between;\n    gap:0;\n    padding:0 68px;''','''    grid-template-columns:repeat(2,92px);\n    justify-content:space-between;\n    gap:0;\n    padding:0 74px;''','utility positions')
s=replace_once(s,'''#creationPage .unused-never-match{''','''#creationPage .unused-never-match{''','noop') if False else s
s=replace_once(s,'''#homePage .unused-never-match{''','''#homePage .unused-never-match{''','noop2') if False else s
old=''' .home-card-utility{'''
# Exact block replacement without adding a second override layer.
s=replace_once(s,''' .home-card-utility{''',''' .home-card-utility{''','utility anchor') if False else s
s=replace_once(s,''' .home-card-utility .home-card-icon{''',''' .home-card-utility .home-card-icon{''','icon anchor') if False else s
s=replace_once(s,''' .home-card-utility .home-card-label{''',''' .home-card-utility .home-card-label{''','label anchor') if False else s
s=replace_once(s,'''\n.home-card-utility{\n    display:grid;\n    grid-template-columns:40px minmax(0,1fr);\n    align-items:center;\n    height:46px;\n    overflow:hidden;\n    border:1px solid rgba(186,137,57,.76);\n    border-radius:8px;\n    background:linear-gradient(180deg,rgba(38,26,15,.96),rgba(9,8,6,.96));\n    box-shadow:0 3px 8px rgba(0,0,0,.46),inset 0 0 0 1px rgba(255,224,151,.05);\n}\n\n.home-card-utility .home-card-icon{\n    width:40px;\n    height:40px;\n    margin-left:0;\n    border-radius:7px 0 0 7px;\n    border-right:1px solid rgba(174,127,55,.55);\n}\n\n.home-card-utility .home-card-label{\n    padding:0;\n    font-size:16px;\n    line-height:44px;\n    text-align:center;\n    letter-spacing:-.75px;\n}\n''','''\n.home-card-utility{\n    display:grid;\n    grid-template-columns:1fr;\n    grid-template-rows:52px 24px;\n    align-items:stretch;\n    justify-items:stretch;\n    height:78px;\n    overflow:hidden;\n    border:1px solid rgba(186,137,57,.76);\n    border-radius:9px;\n    background:linear-gradient(180deg,rgba(38,26,15,.96),rgba(9,8,6,.96));\n    box-shadow:0 3px 8px rgba(0,0,0,.46),inset 0 0 0 1px rgba(255,224,151,.05);\n}\n\n.home-card-utility .home-card-icon{\n    width:100%;\n    height:52px;\n    margin:0;\n    border-radius:8px 8px 0 0;\n    border-right:0;\n    border-bottom:1px solid rgba(174,127,55,.55);\n}\n\n.home-card-utility .home-card-label{\n    align-self:stretch;\n    padding:0 4px;\n    background:linear-gradient(180deg,rgba(48,20,14,.98),rgba(14,9,6,.98));\n    font-size:15.5px;\n    line-height:23px;\n    text-align:center;\n    letter-spacing:.02em;\n}\n''','vertical utility block')
p.write_text(s)

# Update the two existing main-city regression owners to the superseding vertical-card spec.
p=Path('tests/v173.28-main-city-lobby.test.js')
s=p.read_text()
old='''test("offline experience and system use complete framed horizontal buttons",()=>{\n    assert.equal(count(actions,/class="home-card home-card-utility"/g),2);\n    assert.match(actions,/home-utility-actions[\\s\\S]*openHomeFeature\\('offlineExp'\\)[\\s\\S]*openHomeFeature\\('system'\\)/);\n    assert.match(baseCss,/\\.home-utility-actions\\{[\\s\\S]*position:absolute;[\\s\\S]*right:0;[\\s\\S]*left:0;[\\s\\S]*grid-template-columns:repeat\\(2,104px\\);[\\s\\S]*justify-content:space-between;[\\s\\S]*padding:0 68px/);\n    assert.doesNotMatch(baseCss,/\\.home-utility-actions\\{[\\s\\S]{0,360}(?:right:50%|transform:translateX\\(50%\\))/);\n    assert.match(baseCss,/\\.home-card-utility\\{[\\s\\S]*height:46px;[\\s\\S]*border:1px solid[\\s\\S]*border-radius:8px;[\\s\\S]*background:linear-gradient/);\n    assert.ok((104-86)/86>=.20&&(104-86)/86<=.22);\n    assert.ok((46-40)/40>=.15&&(46-40)/40<=.16);\n    assert.equal(396-(68*2)-(104*2),52);\n});'''
new='''test("offline experience and system use complete framed image-over-text buttons",()=>{\n    assert.equal(count(actions,/class="home-card home-card-utility"/g),2);\n    assert.match(actions,/home-utility-actions[\\s\\S]*openHomeFeature\\('offlineExp'\\)[\\s\\S]*openHomeFeature\\('system'\\)/);\n    assert.match(baseCss,/\\.home-utility-actions\\{[\\s\\S]*position:absolute;[\\s\\S]*right:0;[\\s\\S]*left:0;[\\s\\S]*grid-template-columns:repeat\\(2,92px\\);[\\s\\S]*justify-content:space-between;[\\s\\S]*padding:0 74px/);\n    assert.doesNotMatch(baseCss,/\\.home-utility-actions\\{[\\s\\S]{0,360}(?:right:50%|transform:translateX\\(50%\\))/);\n    assert.match(baseCss,/\\.home-card-utility\\{[\\s\\S]*grid-template-columns:1fr;[\\s\\S]*grid-template-rows:52px 24px;[\\s\\S]*height:78px;[\\s\\S]*border:1px solid/);\n    assert.match(baseCss,/\\.home-card-utility \\.home-card-icon\\{[\\s\\S]*width:100%;[\\s\\S]*height:52px;[\\s\\S]*border-bottom:1px solid/);\n    assert.match(baseCss,/\\.home-card-utility \\.home-card-label\\{[\\s\\S]*font-size:15\\.5px;[\\s\\S]*line-height:23px/);\n    assert.equal(396-(74*2)-(92*2),64);\n});'''
s=replace_once(s,old,new,'V173.28 utility test')
p.write_text(s)

p=Path('tests/v173.39-main-city-final-polish.test.js')
s=p.read_text()
old='''test("utility buttons are 104x46 with 40px icons and a 52px centre corridor",()=>{\n assert.match(base,/\\.home-utility-actions\\{[\\s\\S]*?bottom:0;[\\s\\S]*?grid-template-columns:repeat\\(2,104px\\);[\\s\\S]*?padding:0 68px;/);\n assert.match(base,/\\.home-card-utility\\{[\\s\\S]*?grid-template-columns:40px minmax\\(0,1fr\\);[\\s\\S]*?height:46px;/);\n assert.match(base,/\\.home-card-utility \\.home-card-icon\\{[\\s\\S]*?width:40px;[\\s\\S]*?height:40px;/);\n assert.match(base,/\\.home-card-utility \\.home-card-label\\{[\\s\\S]*?font-size:16px;[\\s\\S]*?letter-spacing:-\\.75px;/);\n assert.equal(396-(68*2)-(104*2),52);\n});'''
new='''test("utility buttons use image-over-text cards and preserve the centre passage",()=>{\n assert.match(base,/\\.home-utility-actions\\{[\\s\\S]*?bottom:0;[\\s\\S]*?grid-template-columns:repeat\\(2,92px\\);[\\s\\S]*?padding:0 74px;/);\n assert.match(base,/\\.home-card-utility\\{[\\s\\S]*?grid-template-columns:1fr;[\\s\\S]*?grid-template-rows:52px 24px;[\\s\\S]*?height:78px;/);\n assert.match(base,/\\.home-card-utility \\.home-card-icon\\{[\\s\\S]*?width:100%;[\\s\\S]*?height:52px;[\\s\\S]*?border-bottom:1px solid/);\n assert.match(base,/\\.home-card-utility \\.home-card-label\\{[\\s\\S]*?font-size:15\\.5px;[\\s\\S]*?line-height:23px;/);\n assert.match(base,/#app\\.no-header \\.header,\\s*#app:has\\(#homePage\\.active\\) #gameHeaderBar\\{[\\s\\S]*?display:none;/);\n assert.equal(396-(74*2)-(92*2),64);\n});'''
s=replace_once(s,old,new,'V173.39 utility test')
p.write_text(s)

# Extend the existing creation mobile suite instead of creating a parallel test owner.
p=Path('tests/v173.2-mobile-touch-scroll.test.js')
s=p.read_text()
marker='''test("The published mobile fix remains covered in the V173.39 cache release",()=>{'''
insert='''test("Creation step one keeps native geometry while using the larger readable typography",()=>{\n    assert.match(css,/#creationPage \\.creation-showcase\\{[\\s\\S]*height:820px;[\\s\\S]*min-height:820px;/);\n    assert.match(css,/#creationPage \\.creation-portrait-image\\{[\\s\\S]*width:108%;[\\s\\S]*height:104%;/);\n    assert.match(css,/#creationPage \\.creation-choice-panel\\{[\\s\\S]*padding:24px 30\\.857px 18px;/);\n    assert.match(css,/#creationPage \\.creation-subtitle\\{[\\s\\S]*font-size:36px;/);\n    assert.match(css,/#creationPage \\.creation-step-progress\\{[\\s\\S]*font-size:27px;/);\n    assert.match(css,/#creationPage \\.creation-section-kicker\\{[\\s\\S]*font-size:30px;/);\n    assert.match(css,/#creationPage \\.creation-gender-option\\{[\\s\\S]*height:90px;[\\s\\S]*font-size:35px;/);\n    assert.match(css,/#creationPage \\.creation-element-grid\\{[\\s\\S]*grid-template-columns:repeat\\(4,1fr\\)/);\n    assert.match(css,/#creationPage \\.element-option \\.element-name\\{[\\s\\S]*font-size:29px;/);\n    assert.match(css,/#creationPage \\.creation-role-title\\{[\\s\\S]*font-size:46px;/);\n    assert.match(css,/#creationPage \\.creation-role-description\\{[\\s\\S]*font-size:34px;[\\s\\S]*line-height:1\\.55;/);\n    assert.match(css,/#creationPage \\.creation-role-tag\\{[\\s\\S]*font-size:26\\.5px;/);\n    assert.match(css,/#creationPage \\.creation-input\\{[\\s\\S]*height:110\\.571px;[\\s\\S]*font-size:42px;/);\n    assert.match(css,/#creationPage \\.creation-next,[\\s\\S]*#creationPage \\.creation-back\\{[\\s\\S]*height:132px;/);\n});\n\n'''
if s.count(marker)!=1: raise SystemExit('creation test marker mismatch')
s=s.replace(marker,insert+marker,1)
p.write_text(s)

print('V173.39 UI hotfix applied')
