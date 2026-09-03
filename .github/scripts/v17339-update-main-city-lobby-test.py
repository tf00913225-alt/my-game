from pathlib import Path

path=Path("tests/v173.28-main-city-lobby.test.js")
text=path.read_text()
replacements=[
    ('grid-template-columns:repeat\\(2,100px\\);','grid-template-columns:repeat\\(2,104px\\);'),
    ('\\.home-card-utility\\{[\\s\\S]*height:47px;','\\.home-card-utility\\{[\\s\\S]*height:46px;'),
    ('assert.ok((100-86)/86>=.15&&(100-86)/86<=.20);','assert.ok((104-86)/86>=.20&&(104-86)/86<=.22);'),
    ('assert.ok((47-40)/40>=.15&&(47-40)/40<=.20);','assert.ok((46-40)/40>=.15&&(46-40)/40<=.16);'),
    ('assert.equal(82-68,14);','assert.equal(396-(68*2)-(104*2),52);'),
    ('\\.v146-home-character\\{[\\s\\S]*grid-template-columns:43px minmax\\(0,1fr\\);[\\s\\S]*height:46px','\\.v146-home-character\\{[\\s\\S]*grid-template-columns:43px minmax\\(0,1fr\\);[\\s\\S]*height:47px'),
    ('const rosterHeight=8+(3*2)+2+14+(3*2)+(3*46);','const rosterHeight=45.5+171;'),
    ('assert.equal(hudHeight+actionHeight+rosterHeight,575);','assert.equal(hudHeight+actionHeight+rosterHeight,617.5);'),
    ('assert.match(rosterCss,/\\.v146-home-character\\{[\\s\\S]*height:46px/);','assert.match(rosterCss,/\\.v146-home-character\\{[\\s\\S]*height:47px/);')
]
for old,new in replacements:
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"stale V173.28 expectation mismatch: {old!r} found {count}")
    text=text.replace(old,new,1)
path.write_text(text)
