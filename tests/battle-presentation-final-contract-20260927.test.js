"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const relic=read("js/60-team-relic-system.js"),geometry=read("js/battlefield-render-geometry-adapter.js"),feedback=read("js/battle-floating-feedback-owner.js"),css=read("css/battle-floating-feedback-owner.css"),main=read("js/00-main.js"),skillCss=read("css/battle-skill-name-presentation-owner.css");
assert(!relic.includes("team-relic-mask-holes"));assert(!relic.includes('createElementNS(namespace,"rect")'));assert(relic.includes("team-relic-target-projection-art"));assert(relic.includes("team-relic-target-projection-hp"));assert(geometry.includes("artworkProjection")&&geometry.includes("hpProjection"));
assert(feedback.includes('return "💥 "+'));assert(!feedback.includes('return "爆擊 "'));assert(!feedback.includes("--battle-feedback-status-color"));assert(css.includes('color:#fff'));
assert(main.includes('reason:existingName===requestedName?"sameNameDuplicate":"exclusiveConflict"'));assert(main.includes('conflict.reason==="sameNameDuplicate"'));
for(const e of ["fire","water","wind","earth"]){assert(skillCss.includes('[data-skill-element="'+e+'"]'));}assert(main.includes("badge.dataset.skillElement"));
console.log("battle presentation final contract passed");
