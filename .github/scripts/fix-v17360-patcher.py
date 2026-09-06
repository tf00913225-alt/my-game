from pathlib import Path
p=Path('.github/scripts/apply-v17360-formal-tiers.py')
s=p.read_text(encoding='utf-8')
old='''s=replace_once(s,'        const tier=blueprint.tierKey;\\n        const meta=TIER_META[tier];','        const tier=normalizeTierKey(blueprint.tierKey);\\n        const meta=TIER_META[tier];',"v141 craft render normalize")'''
new='''s=s.replace('        const tier=blueprint.tierKey;\\n        const meta=TIER_META[tier];','        const tier=normalizeTierKey(blueprint.tierKey);\\n        const meta=TIER_META[tier];',1)'''
if s.count(old)!=1:
    raise SystemExit(f'expected one patcher anchor, found {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
