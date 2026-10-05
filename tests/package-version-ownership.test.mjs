import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const gate=path.join(root,'.github/scripts/release-gate.mjs');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function fixture(run){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'package-version-ownership-'));
  try{
    for(const name of fs.readdirSync(root)){
      if(['.git','node_modules','package.json','package-lock.json','functions','release','_deploy','artifacts'].includes(name)) continue;
      fs.symlinkSync(path.join(root,name),path.join(directory,name));
    }
    fs.copyFileSync(path.join(root,'package.json'),path.join(directory,'package.json'));
    if(fs.existsSync(path.join(root,'package-lock.json'))) fs.copyFileSync(path.join(root,'package-lock.json'),path.join(directory,'package-lock.json'));
    fs.cpSync(path.join(root,'release'),path.join(directory,'release'),{recursive:true});
    fs.mkdirSync(path.join(directory,'functions'));
    for(const name of fs.readdirSync(path.join(root,'functions'))){
      if(['package.json','package-lock.json','node_modules'].includes(name)) continue;
      fs.symlinkSync(path.join(root,'functions',name),path.join(directory,'functions',name));
    }
    for(const name of ['package.json','package-lock.json']) fs.copyFileSync(path.join(root,'functions',name),path.join(directory,'functions',name));
    return run(directory);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
function check(directory,expectedFailure){
  const result=spawnSync(process.execPath,[gate,'ci'],{cwd:directory,encoding:'utf8',env:{...process.env,CI_BASE_SHA:''}});
  if(expectedFailure){
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,expectedFailure);
  }else assert.equal(result.status,0,result.stdout+result.stderr);
}
test('current source passes with optional root lock and independent Functions version',()=>fixture(directory=>{
  check(directory);
}));
test('old root metadata is rejected before it can become a release authority',()=>fixture(directory=>{
  const file=path.join(directory,'package.json');write(file,{...json(file),version:'173.69.0'});
  check(directory,/Root package metadata.*release-derived/);
}));
test('root version cannot advance the Game owner',()=>fixture(directory=>{
  const file=path.join(directory,'package.json');write(file,{...json(file),version:'173.74.0'});
  check(directory,/Root package metadata.*release-derived/);
}));
test('release advance requires its npm projection to follow',()=>fixture(directory=>{
  const file=path.join(directory,'release/release.json');write(file,{...json(file),version:'173.74',cacheVersion:'173.74'});
  check(directory,/release-derived 173\.74\.0/);
}));
test('malformed package JSON fails closed',()=>fixture(directory=>{
  fs.writeFileSync(path.join(directory,'package.json'),'{');check(directory,/Cannot read package\.json/);
}));
test('npm install and npm ci preserve metadata; npm-generated optional lock passes',()=>fixture(directory=>{
  const file=path.join(directory,'package.json'),before=fs.readFileSync(file,'utf8');
  for(const args of [['install','--offline','--ignore-scripts','--no-audit','--no-fund'],['ci','--offline','--ignore-scripts','--no-audit','--no-fund']]){
    const result=spawnSync('npm',args,{cwd:directory,encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(fs.readFileSync(file,'utf8'),before);
    check(directory);
  }
}));
for(const location of ['top','entry']) test(`root lock ${location} drift is rejected`,()=>fixture(directory=>{
  const pkg=json(path.join(directory,'package.json'));
  const lock={name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':{name:pkg.name,version:pkg.version}}};
  if(location==='top') lock.version='173.69.0';else lock.packages[''].version='173.69.0';
  write(path.join(directory,'package-lock.json'),lock);check(directory,/package-lock\.json.*metadata differs/);
}));
for(const location of ['top','entry']) test(`Functions lock ${location} drift is rejected`,()=>fixture(directory=>{
  const file=path.join(directory,'functions/package-lock.json'),lock=json(file);
  if(location==='top') lock.version='173.73.0';else lock.packages[''].version='173.73.0';
  write(file,lock);check(directory,/functions\/package-lock\.json.*metadata differs/);
}));
test('Functions may independently advance when its own lock agrees',()=>fixture(directory=>{
  const pkgFile=path.join(directory,'functions/package.json'),lockFile=path.join(directory,'functions/package-lock.json');
  write(pkgFile,{...json(pkgFile),version:'1.0.1'});
  const lock=json(lockFile);lock.version='1.0.1';lock.packages[''].version='1.0.1';write(lockFile,lock);
  check(directory);
}));
test('missing Functions lock fails closed',()=>fixture(directory=>{
  fs.rmSync(path.join(directory,'functions/package-lock.json'));check(directory,/Missing required file: functions\/package-lock\.json/);
}));
