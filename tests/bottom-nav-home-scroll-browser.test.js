"use strict";
const cp=require("node:child_process");
const fs=require("node:fs");
const configured=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const chrome=(configured&&fs.existsSync(configured))||["google-chrome","google-chrome-stable","chromium","chromium-browser"].some(name=>cp.spawnSync("which",[name]).status===0);
if(!chrome&&!process.env.CI){console.log("Navigation browser QA unavailable locally: Chrome absent; CI Runtime QA remains required.");}
else{
 const result=cp.spawnSync(process.execPath,[".github/scripts/run-bottom-nav-runtime-browser-qa.mjs"],{stdio:"inherit",timeout:240000});
 if(result.error)throw result.error;
 process.exitCode=result.status===0?0:1;
}
