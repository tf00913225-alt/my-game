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
