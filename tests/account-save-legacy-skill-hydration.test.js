"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/00-main.js","utf8");
const helperStart=source.indexOf("function normalizeHydratedRetiredSkillReferences(){");
const helperEnd=source.indexOf("function loadGame(){",helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,"legacy skill hydration normalizer must exist before loadGame");

const context={
    Set,Object,Array,
    skillDatabase:{
        flameSlash:{id:"flameSlash",name:"火焰斬"},
        dragonSlash:{id:"dragonSlash",name:"霸龍裂天斬"}
    },
    characterSkillLoadouts:{
        fire:{
            skillLevels:{fireBurstStrike:3,flameSlash:2},
            equippedSkills:["fireBurstStrike","flameSlash","missingLegacySkill"]
        },
        player2:{
            skillLevels:{dragonSlash:1},
            equippedSkills:["dragonSlash"]
        }
    },
    autoConfig:{skill:"fireBurstStrike"},
    autoConfig2:{skill:"dragonSlash"},
    autoConfig3:{skill:"normal"}
};
vm.createContext(context);
vm.runInContext(source.slice(helperStart,helperEnd),context);
vm.runInContext("normalizeHydratedRetiredSkillReferences();",context);

assert.equal(context.characterSkillLoadouts.fire.skillLevels.fireBurstStrike,undefined,
    "retired player skill level must be removed during core hydration");
assert.deepEqual(
    Array.from(context.characterSkillLoadouts.fire.equippedSkills),
    ["flameSlash"],
    "retired and unknown equipped skill ids must be removed before first skill UI render"
);
assert.deepEqual(
    Array.from(context.characterSkillLoadouts.player2.equippedSkills),
    ["dragonSlash"],
    "valid equipped skills must survive legacy hydration cleanup"
);
assert.equal(context.autoConfig.skill,"normal",
    "retired auto-battle skill must fall back to normal during hydration");
assert.equal(context.autoConfig2.skill,"dragonSlash",
    "valid auto-battle skill must remain unchanged");

const loadStart=source.indexOf("function loadGame(){");
const loadEnd=source.indexOf("function showCreation(){",loadStart);
const loadSource=source.slice(loadStart,loadEnd);
assert.ok(
    loadSource.indexOf("normalizeHydratedRetiredSkillReferences();")>=0 &&
    loadSource.indexOf("normalizeHydratedRetiredSkillReferences();")<loadSource.indexOf("renderSkillLoadout();"),
    "legacy skill references must be normalized before the first skill UI render"
);
assert.match(source,/if\(skillId&&skillDatabase\[skillId\]\)/,
    "skill loadout renderer must tolerate a stale equipped id instead of throwing during account hydration");

console.log("✓ legacy account-save skill hydration compatibility passed");

// Retired storm data is an observation, never a playable loadout or auto action.
context.skillDatabase.stormSpell={id:'stormSpell'}; // even stale in-memory data must not resurrect it
context.characterSkillLoadouts.player3={skillLevels:{stormSpell:4,dragonSlash:2},equippedSkills:['stormSpell','dragonSlash']};
context.autoConfig={skill:'stormSpell',v136ActionIntent:'skill',v136LastSkill:'stormSpell'};
context.autoConfig2={skill:'defend',v136ActionIntent:'defend',v136LastSkill:'stormSpell'};
context.autoConfig3={skill:'dragonSlash',v136ActionIntent:'skill',v136LastSkill:'dragonSlash'};
const valid=JSON.stringify(context.autoConfig3);
vm.runInContext('normalizeHydratedRetiredSkillReferences();',context);
assert.equal(context.characterSkillLoadouts.player3.skillLevels.stormSpell,4,'preserve historical level without granting ownership');
assert.deepEqual(Array.from(context.characterSkillLoadouts.player3.equippedSkills),['dragonSlash']);
assert.equal(context.autoConfig.skill,'normal');
assert.equal(context.autoConfig.v136ActionIntent,'normal');
assert.equal(context.autoConfig.v136LastSkill,undefined);
assert.equal(context.autoConfig2.skill,'defend');
assert.equal(context.autoConfig2.v136ActionIntent,'defend');
assert.equal(context.autoConfig2.v136LastSkill,undefined);
assert.equal(JSON.stringify(context.autoConfig3),valid);
const normalized=JSON.stringify([context.characterSkillLoadouts,context.autoConfig,context.autoConfig2,context.autoConfig3]);
vm.runInContext('normalizeHydratedRetiredSkillReferences();',context);
assert.equal(JSON.stringify([context.characterSkillLoadouts,context.autoConfig,context.autoConfig2,context.autoConfig3]),normalized,'cleanup is idempotent');
