import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

const sourcePath=path.resolve(".github/scripts/abyss-live-browser-qa-v2.mjs");
const source=fs.readFileSync(sourcePath,"utf8");
const needle='    window.v133GetHighestCreatedCharacterLevel=()=>${Number(level)};\n    return true;';
const replacement='    window.v133GetHighestCreatedCharacterLevel=()=>${Number(level)};\n'+
'    const creationPage=document.getElementById("creationPage");\n'+
'    if(creationPage){\n'+
'        creationPage.style.setProperty("display","none","important");\n'+
'        creationPage.hidden=true;\n'+
'        creationPage.setAttribute("aria-hidden","true");\n'+
'    }\n'+
'    [document.documentElement,document.body,document.getElementById("game-viewport"),document.getElementById("game-stage"),document.getElementById("game-overlay-layer")].forEach(node=>{\n'+
'        if(!node){ return; }\n'+
'        node.classList.remove("creation-scroll-active","creation-fixed-active");\n'+
'    });\n'+
'    const stage=document.getElementById("game-stage");\n'+
'    if(stage){ stage.classList.remove("creation-native-active"); }\n'+
'    const app=document.getElementById("app");\n'+
'    if(app){\n'+
'        app.inert=false;\n'+
'        app.removeAttribute("aria-hidden");\n'+
'        app.style.setProperty("display","block","important");\n'+
'        app.style.removeProperty("visibility");\n'+
'        app.style.removeProperty("opacity");\n'+
'    }\n'+
'    const gameContent=document.getElementById("game-content");\n'+
'    if(gameContent){ gameContent.style.setProperty("display","block","important"); }\n'+
'    return true;';

if(!source.includes(needle)){
    throw new Error("Live Abyss QA bootstrap could not find the player-session seed hook.");
}

const patched=source.replace(needle,replacement);
const target=path.join(os.tmpdir(),`abyss-live-browser-qa-visible-${process.pid}.mjs`);
fs.writeFileSync(target,patched,"utf8");
await import(pathToFileURL(target).href+`?run=${Date.now()}`);
