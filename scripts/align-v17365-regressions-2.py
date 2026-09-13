from pathlib import Path

p=Path('tests/v174-boss-balance-gameplay-cover-relic-lv20.test.js')
s=p.read_text(encoding='utf-8')
s=s.replace('mechanism cards retain the newer dev-approved 9:16 combat geometry.', 'BOSS card retains 9:16 while the mechanism card uses the requested 4:3 combat geometry.')
s=s.replace('assert.match(gameplayCss,/\\.boss-mechanism-card\\{[^}]*aspect-ratio:9\\s*\\/\\s*16;/);', 'assert.match(gameplayCss,/\\.boss-mechanism-card\\{[^}]*aspect-ratio:4\\s*\\/\\s*3;/);')
p.write_text(s,encoding='utf-8')

p=Path('tests/v174-mobile-ui-exp-guards.test.js')
s=p.read_text(encoding='utf-8')
s=s.replace('assert.match(boss,/\\.boss-mechanism-card\\{[\\s\\S]*aspect-ratio:9 \\/ 16;/);', 'assert.match(boss,/\\.boss-mechanism-card\\{[\\s\\S]*aspect-ratio:4 \\/ 3;/);')
p.write_text(s,encoding='utf-8')

print('Aligned remaining V173.65 mechanism-ratio contracts.')
