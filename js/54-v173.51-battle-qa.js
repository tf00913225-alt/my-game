/* V173.51 — battle / targeting / EXP visibility / ad QA */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351BattleQaInstalled)return;
window.__v17351BattleQaInstalled=true;
let lastBlockedAt=0,adRunning=false;
const visible=el=>{if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden";};
const alertRpg=(m,o)=>typeof window.rpgAlert==="function"?window.rpgAlert(m,o||{}):Promise.resolve(window.alert?.(m));
function inBattle(){try{return typeof battleActive!=="undefined"&&!!battleActive}catch(_){return false}}
function blocked(){const now=Date.now();if(now-lastBlockedAt<600)return;lastBlockedAt=now;void alertRpg("戰鬥進行中無法調整能力值，也無法學習或升級技能。\n請先結束戰鬥後再操作。",{title:"戰鬥中禁止養成操作",confirmText:"知道了",danger:true});}
function guard(name){const old=window[name];if(typeof old!=="function"||old.__v17351Guard)return;const fn=function(){if(inBattle()){blocked();return false}return old.apply(this,arguments)};fn.__v17351Guard=true;window[name]=fn;}
["addPoint","removePoint","confirmStatus","learnSkill","upgradeSkill"].forEach(guard);
document.addEventListener("click",e=>{if(!inBattle())return;const b=e.target?.closest?.("button,[role=button]");if(!b)return;const s=String(b.getAttribute?.("onclick")||"");if(!/(addPoint|removePoint|confirmStatus|learnSkill|upgradeSkill)\s*\(/.test(s))return;e.preventDefault();e.stopImmediatePropagation();blocked();},true);

function fivePriority(indexes){const list=(indexes||[]).filter(Number.isInteger);if(list.length!==5)return null;let rows=null;try{if(typeof window.v148GetFormationRows==="function")rows=window.v148GetFormationRows(list);else if(typeof window.v138GetFormationRows==="function")rows=window.v138GetFormationRows(list)}catch(_){}const row=Array.isArray(rows)&&Array.isArray(rows[0])&&rows[0].length===5?rows[0].slice():list.slice();return [row[2],row[1],row[3],row[0],row[4]].filter(Number.isInteger);}
if(typeof window.v148GetAutoTargetPriority==="function"){const old=window.v148GetAutoTargetPriority;window.v148GetAutoTargetPriority=function(indexes){return fivePriority(indexes)||old.apply(this,arguments)}}
window.v17351FiveEnemyAutoTargetPriority=fivePriority;

/* V173.51: the EXP-row metadata is injected by V133 after the V131 list render.
   A later list rerender could replace those rows and momentarily/permanently remove
   the "目前 EXP / 升下一級需求" line. Decorate synchronously after every render
   so the requirement never disappears while the EXP pool is open. */
function decorateExpRows(){
    if(typeof window.v173DecorateExpPoolDistributionUi==="function"){
        window.v173DecorateExpPoolDistributionUi();
    }
}
if(typeof renderExpDistributeList==="function"&&!renderExpDistributeList.__v17351ExpStable){
    const previousRenderExpDistributeList=renderExpDistributeList;
    const stableRender=function(){
        const result=previousRenderExpDistributeList.apply(this,arguments);
        decorateExpRows();
        return result;
    };
    stableRender.__v17351ExpStable=true;
    renderExpDistributeList=stableRender;
    window.renderExpDistributeList=stableRender;
}
function ensureExpRowsVisible(){
    const list=document.getElementById("expDistributeList");
    if(!list)return;
    const rows=Array.from(list.querySelectorAll(".v131-exp-row"));
    if(rows.length&&rows.some(row=>!row.querySelector(".v173-exp-row-meta")))decorateExpRows();
}
decorateExpRows();

function syncManagement(){const shell=document.getElementById("characterPage")||document.getElementById("characterModal");const tab=document.getElementById("characterTabContent");const open=!inBattle()&&!!(tab&&visible(tab)&&(!shell||visible(shell)));if(document.body.classList.contains("v17351-management-open")!==open)document.body.classList.toggle("v17351-management-open",open);const stage=document.getElementById("v143-skill-stage");if(stage){const nextVisibility=open?"hidden":"";if(stage.style.visibility!==nextVisibility)stage.style.visibility=nextVisibility;}document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice")});ensureExpRowsVisible();}
window.v17351SyncManagement=syncManagement;

function adLayer(){let l=document.getElementById("v17351AdSimulator");if(l)return l;l=document.createElement("div");l.id="v17351AdSimulator";l.className="v17351-ad-simulator";l.setAttribute("aria-hidden","true");l.innerHTML='<section class="v17351-ad-panel" role="dialog" aria-modal="true"><div class="v17351-ad-badge">AD</div><h2>模擬觀看廣告</h2><p>測試模式：播放完成後才發放獎勵。</p><strong id="v17351AdCountdown">3</strong><span id="v17351AdStatus">秒後完成</span></section>';document.body.appendChild(l);return l;}
window.showRewardedAd=function(onSuccess,onFail){if(adRunning)return false;adRunning=true;const l=adLayer(),num=l.querySelector("#v17351AdCountdown"),status=l.querySelector("#v17351AdStatus");l.classList.add("show");l.setAttribute("aria-hidden","false");let remain=3;num.textContent="3";status.textContent="秒後完成";const timer=setInterval(()=>{remain--;if(remain>0){num.textContent=String(remain);return}clearInterval(timer);num.textContent="✓";status.textContent="觀看完成";setTimeout(()=>{l.classList.remove("show");l.setAttribute("aria-hidden","true");adRunning=false;try{if(typeof onSuccess==="function")onSuccess()}catch(err){console.error(err);if(typeof onFail==="function")onFail(err)}},280)},1000);return true;};

const observer=new MutationObserver(syncManagement);observer.observe(document.body,{subtree:true,childList:true});setInterval(syncManagement,300);syncManagement();
})();
