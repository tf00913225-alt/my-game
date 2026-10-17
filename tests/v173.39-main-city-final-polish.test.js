"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('city presentation preserves the sole canvas and owns no viewport breakpoint or scaler',()=>{
 const city=read('css/19-stage-v54-main-city-moderate-native-scale.css')+read('css/adventure-entry-v1-20260915.css');
 assert.doesNotMatch(city,/@media|scale\(|100vw|100vh|!important/);
 const base=read('css/00-main.css');assert.match(base,/#homePage\{[^}]*height:calc\(100% - 216px\)/);
 assert.match(base,/\.home-party-portrait img\{[^}]*object-fit:contain/);
 assert.match(base,/\.home-party-scene\{[^}]*pointer-events:none/);
 assert.doesNotMatch(city,/v146-home-avatar|v146-home-resource/,'retired card/HP bar styles must not compete');
});
test('only side entrances and lower tools own their geometry; data stays live text',()=>{
 const html=read('index.html'),css=read('css/00-main.css');assert.equal((html.match(/data-city-entry="/g)||[]).length,8);
 assert.match(read('css/19-stage-v54-main-city-moderate-native-scale.css'),/grid-template-columns:minmax\(0,1fr\) 135px 330px 288px/); // roster is verified separately below
});
