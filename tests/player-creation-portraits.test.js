"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const runtime=fs.readFileSync("js/24-v125-character-creation-native-runtime.js","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const firstPlay=JSON.parse(fs.readFileSync("config/first-play-manifest.json","utf8"));
const portraits=vm.runInNewContext("("+runtime.match(/const PORTRAITS=(\{[\s\S]*?\n    \});/)[1]+")");
const preloaded=vm.runInNewContext("("+startup.match(/const CREATION_PORTRAITS=([\s\S]*?);/)[1]+")");
const expected=[];
for(const gender of ["female","male"]){
    ["fire","water","wind","earth"].forEach((element,index)=>{
        const path=`assets/characters/player_${gender}_0${index+1}.webp`;
        assert.equal(portraits[gender][element],path,`${gender}/${element} creation mapping`);
        assert.ok(fs.existsSync(path),`${path} exists`);
        const entry=firstPlay.assets.filter(asset=>asset.path===path);
        assert.equal(entry.length,1,`${path} has one preload entry`);
        assert.equal(entry[0].priority,"P1");
        assert.equal(entry[0].decode,true);
        expected.push(path);
    });
}
assert.deepEqual(Array.from(preloaded),expected,"startup decodes every selectable portrait");
assert.match(html,/id="creationPortrait"[\s\S]*?src="assets\/characters\/player_female_01\.webp"/);
assert.match(runtime,/portrait\.src=PORTRAITS\[selectedGender\]\[chosen\]/);
assert.match(runtime,/window\.selectCreationGender=function\(gender\)/);
assert.doesNotMatch(runtime,/assets\/characters\/(?:female|male)_(?:fire|water|wind|earth)\.jpg/);
console.log("✓ eight WebP creation choices agree with initial rendering and startup preloads");

// Normal player displays must agree with creation, while actual battle art stays separate.
const main=fs.readFileSync("js/00-main.js","utf8");
const generalSource=main.slice(main.indexOf("function getCharacterArtworkPath("),main.indexOf("function getCharacterBattleArtworkPath("));
const generalContext={elementDatabase:{fire:{},water:{},wind:{},earth:{}}};
vm.runInNewContext(generalSource+";this.resolve=getCharacterArtworkPath",generalContext);
for(const gender of ["female","male"])for(const element of ["fire","water","wind","earth"]){
    assert.equal(generalContext.resolve({gender,element}),portraits[gender][element],`${gender}/${element} shared display agrees with creation`);
}
assert.equal(generalContext.resolve(null),"");
assert.equal(generalContext.resolve({gender:"unknown",element:"unknown"}),portraits.female.fire);
for(const file of ["js/16-stage-v54-main-city-runtime.js","js/25-v131-fix-batch.js","js/adventure/adventure-ui-v1-20260915.js"]){
    const display=fs.readFileSync(file,"utf8");
    assert.match(display,/getCharacterArtworkPath\(/,`${file} uses normal portraits`);
    assert.doesNotMatch(display,/getCharacterBattleArtworkPath\(/,`${file} does not borrow battle poses`);
}
assert.match(main,/return "assets\/characters\/battle_"\+gender\+"_"\+element\+"\.png";/,"actual battle resolver retains independent assets");
console.log("✓ shared normal portraits replace old city/inventory/formation/story art; battle stays separate");

const heroArtworkSource=main.slice(main.indexOf("function getCharacterBattleArtworkPath("),main.indexOf("function getCharacterDisplayNameByIndex("));
vm.runInNewContext(heroArtworkSource,generalContext);
for(const [heroId,path] of [["divineDogHongbao","assets/heroes/divine-dog-hongbao.webp"],["vajraHeavenlyKing","assets/heroes/vajra-heavenly-king.webp"]]){
    assert.equal(generalContext.resolve({combatantKind:"heroNpc",heroId}),path,"hero inventory keeps its dedicated artwork: "+heroId);
}
assert.equal(generalContext.resolve({combatantKind:"heroNpc",heroId:"unknown"}),"","unknown hero is not silently rendered as a normal female character");
