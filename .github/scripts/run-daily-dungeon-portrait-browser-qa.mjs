import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {chromium} from "playwright";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts/browser-qa");
fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
function chromePath(){
 const configured=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
 if(configured&&fs.existsSync(configured))return configured;
 for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  const p=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
  if(p.status===0&&p.stdout.trim())return p.stdout.trim();
 }
 return undefined;
}
const base=String(process.env.DEV_BASE_URL||"").trim();
if(!base)throw new Error("DEV_BASE_URL is required");
const browser=await chromium.launch({headless:true,executablePath:chromePath()});
const report={base,viewports:{},types:["exp","material","gold"]};
for(const [width,height] of [[360,800],[393,873],[412,915]]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.goto(base,{waitUntil:"networkidle"});
 const evidence=await page.evaluate(async()=>{
  const registry=await (await fetch("config/monster-portrait-registry.json",{cache:"no-store"})).json();
  const fields=registry.tupleSchema;
  const rows=Object.values(registry.groups).flatMap(group=>(group||[]).map(row=>Object.fromEntries(fields.map((field,i)=>[field,row[i]]))));
  const byKey=new Map(rows.filter(row=>row.status==="existing").map(row=>[row.portraitKey,row]));
  const pageNode=document.getElementById("battlePage")||document.body.appendChild(Object.assign(document.createElement("section"),{id:"battlePage"}));
  let area=document.getElementById("battleMonsterArea");
  if(!area){area=document.createElement("div");area.id="battleMonsterArea";pageNode.appendChild(area);}
  const output={};
  for(const type of ["exp","material","gold"]){
   output[type]={};
   for(const rank of ["regular","elite","boss"]){
    window.monsters=[{name:type+"-"+rank,portraitKey:"daily."+type+"."+rank,rank}];
    window.currentBattleMonsters=[0];
    area.replaceChildren();
    const card=document.createElement("div");card.id="battleMonster0";card.className="battle-monster";
    const art=document.createElement("div");art.className="v174-battle-art";card.appendChild(art);area.appendChild(card);
    window.v154InstallMonsterPortraitRegistry(registry);
    window.v154SyncMonsterPortraits();
    if(typeof window.vFixedSlotAfterBattleRender==="function"){try{window.vFixedSlotAfterBattleRender();}catch(_){}}
    const node=card.querySelector(".v174-battle-art");
    const style=getComputedStyle(node),rect=node.getBoundingClientRect(),record=byKey.get("daily."+type+"."+rank);
    const image=String(style.backgroundImage||"");
    const evidence={portraitKey:card.dataset.monsterPortraitKey||null,path:card.dataset.monsterPortraitPath||null,expectedPath:record&&record.path||null,backgroundImage:image,display:style.display,visibility:style.visibility,opacity:Number(style.opacity),width:rect.width,height:rect.height};
    assert.equal(evidence.portraitKey,"daily."+type+"."+rank);
    assert.equal(evidence.path,evidence.expectedPath);
    assert.ok(image.includes(record.path));
    assert.notEqual(evidence.display,"none");assert.notEqual(evidence.visibility,"hidden");
    assert.ok(evidence.opacity>0&&evidence.width>0&&evidence.height>0);
    output[type][rank]=evidence;
   }
  }
  return output;
 });
 report.viewports[width+"x"+height]=evidence;
 await page.screenshot({path:path.join(ARTIFACT_DIR,"daily-dungeon-portraits-"+width+"x"+height+".png"),fullPage:false});
 await page.close();
}
await browser.close();
fs.writeFileSync(path.join(ARTIFACT_DIR,"daily-dungeon-monster-portrait-browser-qa.json"),JSON.stringify(report,null,2));
console.log("Daily Dungeon Monster Portrait Browser QA: PASS");
