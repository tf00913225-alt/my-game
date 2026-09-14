"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const root=process.cwd();
const batchDir=path.join(root,"release/monster-portrait-batches");
const registryPath=path.join(root,"config/monster-portrait-registry.json");
const liveBatchRel="release/monster-portrait-batches/2026-09-11-batch-01.json";
const liveBatchPath=path.join(root,liveBatchRel);
const tempCompleteRel="release/monster-portrait-batches/.test-complete-batch.json";
const tempIncompleteRel="release/monster-portrait-batches/.test-incomplete-batch.json";
const tempCompletePath=path.join(root,tempCompleteRel);
const tempIncompletePath=path.join(root,tempIncompleteRel);

function run(script,args=[]){
    return spawnSync(process.execPath,[script,...args],{
        cwd:root,
        encoding:"utf8",
        maxBuffer:32*1024*1024
    });
}

function writeManifest(file,data){
    fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n");
}

const registryBefore=fs.readFileSync(registryPath,"utf8");
const liveBatchBefore=fs.readFileSync(liveBatchPath,"utf8");

try{
    fs.mkdirSync(batchDir,{recursive:true});
    writeManifest(tempCompletePath,{
        batch:9991,
        status:"COMPLETE",
        committed:["soldier.fire","soldier.water","soldier.wind","soldier.earth"],
        pending:[]
    });
    writeManifest(tempIncompletePath,{
        batch:9992,
        status:"IN_PROGRESS",
        committed:["soldier.fire"],
        pending:["daily.exp.regular"]
    });

    const complete=run("scripts/audit-monster-portrait-batch.mjs",[
        "--strict",
        "--json",
        "--batch="+tempCompleteRel
    ]);
    assert.equal(complete.status,0,complete.stderr||complete.stdout);
    const completeReport=JSON.parse(complete.stdout);
    assert.equal(completeReport.ok,true);
    assert.equal(completeReport.pending,0);
    assert.equal(completeReport.batchTargets,4);

    const incomplete=run("scripts/audit-monster-portrait-batch.mjs",[
        "--strict",
        "--json",
        "--batch="+tempIncompleteRel
    ]);
    assert.notEqual(incomplete.status,0,"incomplete batch must fail strict audit");
    const incompleteReport=JSON.parse(incomplete.stdout);
    assert.equal(incompleteReport.ok,false);
    assert.ok(incompleteReport.errors.some(message=>message.includes("pending=[]")));

    const unscopedFinalize=run("scripts/finalize-monster-portrait-registry.mjs");
    assert.notEqual(unscopedFinalize.status,0,"unscoped finalize must be refused");
    assert.match(unscopedFinalize.stderr,/refusing unscoped finalize/);
    assert.equal(fs.readFileSync(registryPath,"utf8"),registryBefore,"unscoped finalize must not mutate registry");

    const scopedDryRun=run("scripts/finalize-monster-portrait-registry.mjs",[
        "--dry-run",
        "--batch="+liveBatchRel
    ]);
    assert.equal(scopedDryRun.status,0,scopedDryRun.stderr||scopedDryRun.stdout);
    assert.equal(fs.readFileSync(registryPath,"utf8"),registryBefore,"dry-run must not mutate registry");
    assert.equal(fs.readFileSync(liveBatchPath,"utf8"),liveBatchBefore,"dry-run must not mutate batch manifest");

    console.log("Monster portrait batch workflow tests passed");
}finally{
    for(const file of [tempCompletePath,tempIncompletePath]){
        if(fs.existsSync(file)){ fs.unlinkSync(file); }
    }
}
