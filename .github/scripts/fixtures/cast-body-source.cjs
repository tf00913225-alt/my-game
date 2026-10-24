"use strict";
const assert=require("node:assert/strict");
// Approved pooled accent Canvas is subordinate; every cast body still has
// exactly one original DOM raster Owner. Never exempt any part of that Owner.
module.exports=function castBodySource(source){
 const start=source.indexOf("(function installV143SkillAnimationRuntime(){");
 assert.ok(start>=0,"formal cast-body Owner marker must exist");
 const body=source.slice(start);
 assert.match(body,/window\.v143SkillAnimationManifest=MANIFEST/);
 return body;
};
