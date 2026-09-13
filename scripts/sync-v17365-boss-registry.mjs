// One-off V173.65 registry synchronization for final CI gate.
import fs from "node:fs";

const file="config/monster-portrait-registry.json";
const registry=JSON.parse(fs.readFileSync(file,"utf8"));
const bossNames=new Map([
  ["赤曜焚牙君","赤焰君"],["燼天獄火侯","獄火侯"],["玄瀾凍海君","凍海君"],
  ["寒魄霜淵侯","霜淵侯"],["冥冰雪獄尊","雪獄尊"],["太陰寒劫尊","寒劫尊"],
  ["玄冥凍界皇","凍界皇"],["永夜霜天皇","霜天皇"],["無極寒獄帝","寒獄帝"],
  ["赤劫熔天災君","熔天君"],["玄劫冰海災皇","冰海皇"],["焚世九曜龍皇","九曜龍皇"],
  ["終劫滅世天魔","滅世天魔"],["炎極鎮天尊","炎天尊"],["赤曜鎮塔使","赤焰使"],
  ["玄冥鎮天尊","玄冥尊"],["寒泉鎮塔使","寒泉使"],["坤嶽鎮天尊","坤嶽尊"],
  ["岩岳鎮塔使","岩岳使"],["巽嵐鎮天尊","巽風尊"],["青嵐鎮塔使","青嵐使"],
  ["四象鎮塔尊","四象尊"]
]);

let changed=0;
for(const rows of Object.values(registry.groups||{})){
  for(const row of rows||[]){
    if(!Array.isArray(row)) continue;
    const next=bossNames.get(row[1]);
    if(next){ row[1]=next; changed++; }
  }
}

if(changed!==bossNames.size){
  throw new Error(`Boss registry sync expected ${bossNames.size} renames, got ${changed}`);
}

fs.writeFileSync(file,JSON.stringify(registry));
console.log(`Synchronized ${changed} simplified boss names into monster portrait registry.`);
