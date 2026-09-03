from pathlib import Path

p=Path('css/29-v125-character-creation-native.css')
s=p.read_text()

def once(old,new,label):
    global s
    c=s.count(old)
    if c!=1: raise SystemExit(f'{label}: expected 1 match, found {c}')
    s=s.replace(old,new,1)

# Keep the larger type; reclaim vertical room only from decorative spacing.
once('    padding:24px 30.857px 18px;','    padding:12px 30.857px 8px;','choice padding')
once('''#creationPage .creation-section-kicker{\n    margin-bottom:10px;''','''#creationPage .creation-section-kicker{\n    margin-bottom:6px;''','kicker margin')
once('''#creationPage .creation-element-kicker{\n    margin-top:16px;''','''#creationPage .creation-element-kicker{\n    margin-top:8px;''','element margin')
once('''#creationPage .creation-role-card{\n    margin-top:14px;\n    padding:16px;''','''#creationPage .creation-role-card{\n    margin-top:6px;\n    padding:10px;''','role card spacing')
once('''#creationPage .creation-role-title-row{\n    display:flex;\n    align-items:center;\n    gap:16px;''','''#creationPage .creation-role-title-row{\n    display:flex;\n    align-items:center;\n    gap:12px;''','role row gap')
once('''#creationPage .creation-role-subtitle{\n    margin-top:5px;''','''#creationPage .creation-role-subtitle{\n    margin-top:2px;''','role subtitle margin')
once('''#creationPage .creation-role-description{\n    margin-top:12px;\n    color:#b9aa93;\n    font-size:34px;\n    line-height:1.55;''','''#creationPage .creation-role-description{\n    margin-top:6px;\n    color:#b9aa93;\n    font-size:34px;\n    line-height:1.48;''','role description rhythm')
once('''#creationPage .creation-role-tags{\n    display:flex;\n    flex-wrap:wrap;\n    gap:8px;\n    margin-top:10px;''','''#creationPage .creation-role-tags{\n    display:flex;\n    flex-wrap:wrap;\n    gap:6px;\n    margin-top:5px;''','role tags rhythm')
once('''#creationPage .creation-role-tag{\n    padding:5px 13px;''','''#creationPage .creation-role-tag{\n    padding:3px 12px;''','role tag padding')
p.write_text(s)

# The focused creation suite is intentionally extended by the first script.
# Keep its geometry expectations synchronized with this final, tighter fit.
t=Path('tests/v173.2-mobile-touch-scroll.test.js')
txt=t.read_text()
def test_once(old,new,label):
    global txt
    c=txt.count(old)
    if c!=1: raise SystemExit(f'{label}: expected 1 test match, found {c}')
    txt=txt.replace(old,new,1)

test_once(r'padding:24px 30\.857px 18px;',r'padding:12px 30\.857px 8px;','choice padding expectation')
test_once(r'line-height:1\.55;',r'line-height:1\.48;','role line-height expectation')
t.write_text(txt)

print('creation fit tightened and regression synchronized')
