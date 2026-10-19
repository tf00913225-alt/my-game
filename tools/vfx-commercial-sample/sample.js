"use strict";
// Isolated asset review only. Never installs/overrides a combat owner.
const samples={
 slash:{name:"火焰斬",old:"../../assets/vfx/fire/flame-slash-cast.png",asset:"assets/flame-slash.webp",duration:760,oldSize:400,newSize:300,targets:1,note:"火焰斬：參考圖框由 400 縮至 300 邏輯像素（寬高各 −25%）。以單一斬痕及第八幀集中亮點取代大片爆炎，播放仍為 760ms。"},
 ice:{name:"冰箭雨",old:"../../assets/vfx/water/frost-arrow-rain-vfx.png",asset:"assets/ice-arrow-rain.webp",duration:1600,oldSize:880,newSize:690,targets:3,note:"冰箭雨：參考圖框由 880 縮至 690（寬高各 −22%）。保留群體箭雨意象，移除大片藍色霧幕，命中收在地面碎冰，播放仍為 1600ms。"},
 relic:{name:"九龍火秘寶",old:"assets/nine-dragon-fire-original.webp",asset:"assets/nine-dragon-fire-v3.webp",impactAsset:"assets/nine-dragon-fire-impact-v3.webp",duration:2550,oldSize:520,newSize:500,targets:3,note:"九龍火第三版歷史預覽：保留九龍纏繞與獨立命中圖。正式施工候選另由 USB 對照頁呈現；此預覽不代表目前遊戲版本。"}
};
let selected="slash",playing=true,start=performance.now(),speed=1,pausedElapsed=0;
const articles=[...document.querySelectorAll("article")],range=document.querySelector("#frame");
const preload=Object.values(samples).flatMap(s=>[s.old,s.asset,...(s.impactAsset?[s.impactAsset]:[])]).map(src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(src);im.onerror=()=>reject(Error("Asset failed: "+src));im.src=src;}));
window.vfxSampleReady=Promise.all(preload);
function fit(){articles.forEach(a=>a.querySelector(".scene").style.transform="scale("+(a.querySelector(".viewport").clientWidth/1080)+")");}
new ResizeObserver(fit).observe(document.querySelector(".comparison"));
function draw(frame,progress=(frame+.5)/12){
 range.value=frame;document.querySelector("#frameLabel").value=(frame+1)+" / 12";
 articles.forEach(a=>{const effect=a.querySelector(".effect"),sample=samples[selected],after=a.dataset.variant==="after",impact=after&&sample.impactAsset&&frame===7;
 const source=impact?sample.impactAsset:after?sample.asset:sample.old;
 if(effect.dataset.source!==source){effect.style.backgroundImage='url("'+source+'")';effect.dataset.source=source;}
 effect.style.backgroundSize=impact?"100% 100%":"400% 300%";
 effect.style.backgroundPosition=impact?"center":((frame%4)*100/3)+"% "+(Math.floor(frame/4)*50)+"%";
 // Candidate-only visual envelope; the shared frame and hit timeline stay unchanged.
 let opacity=1;
 if(selected==="relic"&&a.dataset.variant==="after"){
  opacity=progress<.5?.58+.42*Math.min(1,progress/.5):progress<=8/12?1:Math.pow(Math.max(0,(1-progress)/(1-8/12)),1.35);
 }
 effect.style.opacity=String(opacity);a.querySelector(".damage").style.opacity=frame===7?"1":"0";a.dataset.frame=frame;});
}
function select(key){
 selected=key;const s=samples[key];start=performance.now();pausedElapsed=0;
 document.querySelectorAll("[data-sample]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.sample===key));
 document.querySelector("#note").textContent=s.note;
 document.querySelector('article[data-variant="after"] header small').textContent=key==="relic"?"龍形重繪 · 聚龍／命中／散火":"較小尺寸 · 集中亮部";
 articles.forEach(a=>{const after=a.dataset.variant==="after",effect=a.querySelector(".effect"),size=after?s.newSize:s.oldSize;effect.style.backgroundImage='url("'+(after?s.asset:s.old)+'")';effect.style.width=size+"px";effect.style.height=size+"px";
 const positions=s.targets===1?[452]:[230,452,674];a.querySelector(".targets").replaceChildren(...positions.map((left,i)=>{const target=document.createElement("div");target.className="target";target.style.left=left+"px";const im=document.createElement("img");im.src="../../assets/characters/battle_male_"+["earth","water","wind"][i]+".png";im.alt="比例參考角色";const hp=document.createElement("div");hp.className="hp";const label=document.createElement("span");label.textContent="目標 "+(i+1);target.append(im,hp,label);return target;}));});draw(0);fit();
}
function pause(){if(playing){pausedElapsed=(performance.now()-start)*speed;playing=false;}document.querySelector("#play").textContent=playing?"暫停":"播放";}
document.querySelectorAll("[data-sample]").forEach(b=>b.onclick=()=>select(b.dataset.sample));
document.querySelectorAll("[data-mode]").forEach(b=>{if(b.tagName!=="BUTTON")return;b.onclick=()=>{document.querySelector(".comparison").dataset.mode=b.dataset.mode;document.querySelectorAll("button[data-mode]").forEach(x=>x.setAttribute("aria-pressed",x===b));fit();};});
document.querySelector("#play").onclick=()=>{if(playing)pause();else{start=performance.now()-pausedElapsed/speed;playing=true;document.querySelector("#play").textContent="暫停";}};
document.querySelector("#replay").onclick=()=>{start=performance.now();pausedElapsed=0;playing=true;document.querySelector("#play").textContent="暫停";};
range.oninput=()=>{pause();pausedElapsed=Number(range.value)/12*samples[selected].duration;draw(Number(range.value));};
document.querySelector("#impact").onclick=()=>{pause();pausedElapsed=7/12*samples[selected].duration;draw(7);};
document.querySelector("#speed").onchange=e=>{const elapsed=playing?(performance.now()-start)*speed:pausedElapsed;speed=Number(e.target.value);start=performance.now()-elapsed/speed;};
function tick(now){if(playing){const s=samples[selected],elapsed=((now-start)*speed)%(s.duration+700);draw(Math.min(11,Math.floor(elapsed/s.duration*12)),Math.min(1,elapsed/s.duration));}requestAnimationFrame(tick);}
select(selected);requestAnimationFrame(tick);
