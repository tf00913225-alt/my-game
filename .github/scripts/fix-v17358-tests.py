from pathlib import Path

p=Path('tests/v141-system-expansion.test.js')
s=p.read_text(encoding='utf-8')
old='''    assert.match(contentSource,/consumeMatching\\([^\\n]+,100\\)/);\n    assert.match(contentSource,/ConsumeStackItem\\(ore\\.id,100\\)/);\n'''
new='''    assert.match(contentSource,/return locks===0\\?50:\\(locks===1\\?100:150\\)/);\n    assert.match(contentSource,/consumeMatching\\([^\\n]+,cost\\)/);\n    assert.match(contentSource,/ConsumeStackItem\\(info\\.ore\\.id,cost\\)/);\n    assert.match(contentSource,/reforgeMaterialTier:\"low\"/);\n    assert.match(contentSource,/裝備品質不限制材料階級/);\n'''
if old not in s:
    raise SystemExit('old V141 reforge cost assertions not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('V173.58 V141 reforge test expectations updated')
