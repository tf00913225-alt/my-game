from pathlib import Path

lazy_path=Path('css/42-v146-system-polish.css')
eager_path=Path('css/19-stage-v54-main-city-moderate-native-scale.css')
lazy=lazy_path.read_text(encoding='utf-8')
eager=eager_path.read_text(encoding='utf-8')
block='''/* Keep the complete three-character roster plus relic loadout above the fixed\n   bottom navigation on short phone viewports. */\n@media (max-height:920px){\n    #game-stage #homePage .v146-home-roster{\n        gap:2px;\n        margin-top:4px;\n        padding:4px 7px;\n    }\n    #game-stage #homePage .v146-home-character{\n        min-height:78px;\n        padding-top:3px;\n        padding-bottom:3px;\n    }\n}'''
if block in lazy:
    lazy=lazy.replace(block,'')
if block not in eager:
    eager=eager.rstrip()+'\n\n'+block+'\n'
lazy_path.write_text(lazy,encoding='utf-8')
eager_path.write_text(eager,encoding='utf-8')
print('Moved compact main-city roster rules to eager app-shell owner.')
