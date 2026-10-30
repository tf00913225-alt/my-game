"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/00-main.js","utf8");
const start=source.indexOf("function getCharacterArtworkPath(");
const end=source.indexOf("function getCharacterDisplayNameByIndex(",start);
const context=vm.createContext({elementDatabase:{fire:{},water:{},wind:{},earth:{}}});
vm.runInContext(source.slice(start,end)+";globalThis.normal=getCharacterArtworkPath;globalThis.battle=getCharacterBattleArtworkPath;",context);
const preload=JSON.parse(fs.readFileSync("config/first-play-manifest.json","utf8")).assets;
for(const gender of ["male","female"]){
    ["fire","water","wind","earth"].forEach((element,index)=>{
        const actor={gender,element},number=String(index+1).padStart(2,"0");
        const expected=`assets/characters/battle/player_battle_${gender}_${number}.webp`;
        assert.equal(context.battle(actor),expected,`${gender}/${element}`);
        assert.ok(fs.existsSync(expected),expected+" exists");
        assert.equal(context.normal(actor),`assets/characters/player_${gender}_${number}.webp`,"normal artwork remains independent");
        const matches=preload.filter(item=>item.path===expected);
        assert.equal(matches.length,1,"one preload for "+expected);
        assert.equal(matches[0].priority,"P2");assert.equal(matches[0].decode,true);
    });
}
assert.equal(context.battle(null),"");
assert.equal(context.battle({gender:"invalid",element:"invalid"}),"assets/characters/battle/player_battle_female_01.webp");
for(const [heroId,path] of [["divineDogHongbao","assets/heroes/divine-dog-hongbao.webp"],["vajraHeavenlyKing","assets/heroes/vajra-heavenly-king.webp"]]){
    assert.equal(context.battle({combatantKind:"heroNpc",heroId}),path,"hero-specific artwork preserved");
}
assert.equal(context.battle({combatantKind:"heroNpc",heroId:"unknown"}),"","unknown hero does not fall back to player artwork");
console.log("Player battle portraits: eight dedicated mappings, preload, normal-art isolation and hero branches PASS");
