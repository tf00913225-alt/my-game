from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# V142: recover from a partial sentinel state and export a stable direct trigger.
p = Path("js/37-v142-skill-animation.js")
s = p.read_text(encoding="utf-8")
old_guard = '''    if(typeof window==="undefined" || window.__v142SkillAnimationInstalled){ return; }\n    window.__v142SkillAnimationInstalled=true;'''
new_guard = '''    if(typeof window==="undefined"){ return; }\n    /* Recover if an earlier runtime load set only the sentinel before it failed. */\n    if(window.__v142SkillAnimationInstalled && window.v142SkillAnimationDirector &&\n        typeof window.v142PlaySkillAnimationFromBadge==="function"){ return; }\n    window.__v142SkillAnimationInstalled=true;'''
s = replace_once(s, old_guard, new_guard, "V142 initialization guard")

old_hooks = '''    if(typeof showSkillNameBadge==="function"){\n        const previous=showSkillNameBadge;\n        showSkillNameBadge=function(name,element,characterIndex){\n            const result=previous.apply(this,arguments);\n            const index=Number.isInteger(characterIndex)?characterIndex:\n                (typeof activeBattleCharacterIndex!=="undefined"?activeBattleCharacterIndex:0);\n            startFromBadge("player",name,element,index);\n            return result;\n        };\n    }\n    if(typeof showMonsterSkillNameBadge==="function"){\n        const previous=showMonsterSkillNameBadge;\n        showMonsterSkillNameBadge=function(name,element,monsterIndex){\n            const result=previous.apply(this,arguments);\n            startFromBadge("monster",name,element,monsterIndex);\n            return result;\n        };\n    }'''
new_hooks = '''    /* Battle's source badge functions own the action boundary. Export one\n       direct trigger there instead of depending on a wrapper chain that later\n       runtimes can temporarily replace. */\n    window.v142PlaySkillAnimationFromBadge=function(side,name,element,actorIndex){\n        return startFromBadge(side,name,element,actorIndex);\n    };'''
s = replace_once(s, old_hooks, new_hooks, "V142 badge wrappers")
p.write_text(s, encoding="utf-8")


# Base badge functions directly own animation triggering.
p = Path("js/00-main.js")
s = p.read_text(encoding="utf-8")
end_anchor = '''    },badgeDuration);\n\n}'''

def patch_badge(text, start_marker, end_marker, call, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker missing")
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f"{label}: end marker missing")
    chunk = text[start:end]
    if chunk.count(end_anchor) != 1:
        raise SystemExit(f"{label}: expected one end anchor, found {chunk.count(end_anchor)}")
    replacement = '''    },badgeDuration);\n\n    if(typeof window!=="undefined" && typeof window.v142PlaySkillAnimationFromBadge==="function"){\n        ''' + call + '''\n    }\n\n}'''
    chunk = chunk.replace(end_anchor, replacement, 1)
    return text[:start] + chunk + text[end:]

s = patch_badge(
    s,
    "function showSkillNameBadge(skillName,elementType,characterIndex){",
    "function showMonsterSkillNameBadge(",
    'window.v142PlaySkillAnimationFromBadge("player",skillName,elementType,characterIndex||0);',
    "player badge",
)
s = patch_badge(
    s,
    "function showMonsterSkillNameBadge(",
    "function showPlayerSpPopup(",
    'window.v142PlaySkillAnimationFromBadge("monster",skillName,elementType,monsterIndex||0);',
    "monster badge",
)
p.write_text(s, encoding="utf-8")


# Restore the proven P0 regression contract at the current V173.62 release.
Path("tests/v173.6-p0-runtime-recovery.test.js").write_text(
'''"use strict";\n\nconst assert=require("node:assert/strict");\nconst fs=require("node:fs");\n\nconst main=fs.readFileSync("js/00-main.js","utf8");\nconst v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");\nconst animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");\nconst loader=fs.readFileSync("js/20-anonymous-20.js","utf8");\nconst index=fs.readFileSync("index.html","utf8");\n\nassert.match(v142,/__v142SkillAnimationInstalled && window\\.v142SkillAnimationDirector &&[\\s\\S]*?v142PlaySkillAnimationFromBadge/);\nassert.match(v142,/window\\.v142PlaySkillAnimationFromBadge=function/);\nassert.doesNotMatch(v142,/const previous=showSkillNameBadge/);\nassert.match(main,/v142PlaySkillAnimationFromBadge\\("player",skillName,elementType,characterIndex\\|\\|0\\)/);\nassert.match(main,/v142PlaySkillAnimationFromBadge\\("monster",skillName,elementType,monsterIndex\\|\\|0\\)/);\nassert.match(animation,/water-orb-vfx\\.png\\?v=173\\.19/);\nassert.match(loader,/const V_ASSET_VERSION="173\\.62"/);\nassert.match(index,/<title>四象江湖傳 V173\\.62<\\/title>/);\n\nconsole.log("V173.62 P0 direct animation runtime recovery: 8 tests passed.");\n''',
encoding="utf-8",
)

Path("tests/v173.62-direct-skill-animation-trigger.test.js").write_text(
'''"use strict";\nconst assert=require("node:assert/strict");\nconst fs=require("node:fs");\n\nconst main=fs.readFileSync("js/00-main.js","utf8");\nconst v142=fs.readFileSync("js/37-v142-skill-animation.js","utf8");\nconst v140=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");\nconst v143=fs.readFileSync("js/39-v143-skill-animation.js","utf8");\n\nassert.match(v140,/showSkillNameBadge=function\\(skillName\\)/);\nassert.match(v142,/window\\.v142PlaySkillAnimationFromBadge=function/);\nassert.doesNotMatch(v142,/showSkillNameBadge=function\\(name,element,characterIndex\\)/);\nassert.match(main,/function showSkillNameBadge[\\s\\S]*?v142PlaySkillAnimationFromBadge\\("player"/);\nassert.match(main,/function showMonsterSkillNameBadge[\\s\\S]*?v142PlaySkillAnimationFromBadge\\("monster"/);\nassert.match(v143,/if\\(!window\\.v142SkillAnimationDirector\\)\\{ return; \\}/);\nassert.match(v143,/director\\.play=function\\(config,meta\\)/);\n\nconsole.log("✓ direct skill animation trigger survives later badge wrapper order");\n''',
encoding="utf-8",
)

print("restored direct skill animation runtime ownership")
