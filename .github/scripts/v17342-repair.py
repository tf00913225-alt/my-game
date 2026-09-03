from pathlib import Path

p=Path('.github/scripts/v17342-player-flow.py')
s=p.read_text()

# The HP/SP explanatory copy appears twice by design. Replace them sequentially.
old='''s=once(s,\n''' + "'''                <small>戰鬥結束後低於門檻時使用補品</small>'''" + ''',\n''' + "'''                <small>低於門檻時自動使用補品</small>'''" + ''',\n"HP shared copy")\ns=once(s,\n''' + "'''                <small>戰鬥結束後低於門檻時使用補品</small>'''" + ''',\n''' + "'''                <small>低於門檻時自動使用補品</small>'''" + ''',\n"SP shared copy")'''
new='''s=s.replace(\n''' + "'''                <small>戰鬥結束後低於門檻時使用補品</small>'''" + ''',\n''' + "'''                <small>低於門檻時自動使用補品</small>'''" + ''',1)\ns=s.replace(\n''' + "'''                <small>戰鬥結束後低於門檻時使用補品</small>'''" + ''',\n''' + "'''                <small>低於門檻時自動使用補品</small>'''" + ''',1)'''
if old in s:
    s=s.replace(old,new,1)

# Literal replacement text must not be parsed as regex escapes.
s=s.replace(
    'new,count=re.subn(pattern,repl,text,count=1,flags=flags)',
    'new,count=re.subn(pattern,lambda _match: repl,text,count=1,flags=flags)',
    1
)

# Replace the brittle old-test regex migration with deterministic block slicing.
marker='p=Path("tests/v173.28-main-city-lobby.test.js")\nt=p.read_text()\nt=rx_once(t,'
start=s.find(marker)
stop=s.find('\n# Replace V169 tests',start)
if start>=0 and stop>=0:
    replacement='''p=Path("tests/v173.28-main-city-lobby.test.js")
t=p.read_text()
block_start=t.find('test("offline experience and system use complete framed horizontal buttons"')
if block_start>=0:
    block_end=t.find("\\n});",block_start)
    if block_end<0:
        raise SystemExit("home utility test end not found")
    block_end+=len("\\n});")
    new_block="""test(\"offline experience and system join the existing side rails\",()=>{
    assert.equal(count(actions,/openHomeFeature\\\\('(offlineExp|system)'\\\\)/g),2);
    assert.doesNotMatch(actions,/home-utility-actions/);
    assert.match(actions,/homeIconAchievement[\\\\s\\\\S]*homeIconAnnouncement[\\\\s\\\\S]*homeIconOfflineExp[\\\\s\\\\S]*homeIconSystem/);
});"""
    t=t[:block_start]+new_block+t[block_end:]
p.write_text(t)
'''
    s=s[:start]+replacement+s[stop:]
else:
    raise SystemExit('home utility migration source block not found')

p.write_text(s)
print('V173.42 staging repair applied')
