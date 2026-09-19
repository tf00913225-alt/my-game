#!/usr/bin/env node
/*
   Internal release-planning helper. It intentionally prints changed paths only
   for the release owner; player-facing wording must be written into the single
   release/release-update.json manifest after the actual diff is inspected.
*/
import {execFileSync} from "node:child_process";

function argument(name,fallback){
    const index=process.argv.indexOf(name);
    return index>=0&&process.argv[index+1] ? process.argv[index+1] : fallback;
}

function runGit(args){
    try{
        return execFileSync("git",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
    }catch(error){
        const detail=String(error.stderr||error.message||"").trim();
        throw new Error(detail||("git "+args.join(" ")+" failed"));
    }
}

function isInternalOnlyPath(path){
    return (
        path==="AGENTS.md"||
        path==="CLAUDE.md"||
        path==="HANDOFF.md"||
        path==="ARCHITECTURE_RULES.md"||
        path==="SYSTEM_CONTRACTS.md"||
        path.startsWith("docs/")||
        path.startsWith(".github/")||
        path.startsWith("tests/")||
        path.startsWith("scripts/")||
        path==="package.json"||
        path==="package-lock.json"
    );
}

const base=argument("--base","origin/main");
const head=argument("--head","HEAD");
const range=base+"..."+head;
const nameStatus=runGit(["diff","--find-renames","--name-status",range]);
const stat=runGit(["diff","--stat",range]);
const entries=nameStatus
    ? nameStatus.split("\n").map(line=>{
        const columns=line.split("\t");
        return {status:columns[0],paths:columns.slice(1)};
    })
    : [];
const changedPaths=[...new Set(entries.flatMap(entry=>entry.paths))];
const playerCandidates=changedPaths.filter(path=>!isInternalOnlyPath(path));
const internalOnly=changedPaths.filter(path=>isInternalOnlyPath(path));

console.log("Release Update Planning Diff (internal only)");
console.log("Base: "+base);
console.log("Candidate: "+head);
console.log("Range: "+range);
console.log("");
console.log(stat||"No changed files.");
console.log("");
console.log("Player-impact candidates (inspect the actual diff; do not copy paths into player copy):");
console.log(playerCandidates.length ? playerCandidates.map(path=>"- "+path).join("\n") : "- none");
console.log("");
console.log("Internal-only paths:");
console.log(internalOnly.length ? internalOnly.map(path=>"- "+path).join("\n") : "- none");
console.log("");
console.log("Required release decision:");
console.log("- Summarize every player-perceivable change in this full range into release/release-update.json.");
console.log("- Never publish source paths, function names, commit SHA, CI, or debugging language to players.");
console.log("- Set publicNotice:false only when the requester explicitly says「本次不公告」and the whole range is player-invisible.");
