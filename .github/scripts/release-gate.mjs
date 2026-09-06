import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const RELEASE_PATH=path.join(ROOT,'release','release.json');
const REQUIREMENTS_PATH=path.join(ROOT,'release','requirements.json');
const DEPRECATED_PATH=path.join(ROOT,'release','deprecated-code.json');

function fail(message){ throw new Error(message); }
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){fail(`Cannot read ${path.relative(ROOT,file)}: ${error.message}`);}
}
function readText(root,relative){
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){fail(`Missing required file: ${relative}`);}
  return fs.readFileSync(file,'utf8');
}
function normalizeVersion(value){return String(value??'').replace(/^V/i,'').trim();}
function escapeRegex(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function getConfig(){
  const release=readJson(RELEASE_PATH);
  const requirements=readJson(REQUIREMENTS_PATH);
  const deprecated=readJson(DEPRECATED_PATH);
  if(release.schemaVersion!==1) fail('release/release.json schemaVersion must be 1.');
  const version=normalizeVersion(release.version);
  const cacheVersion=normalizeVersion(release.cacheVersion);
  if(!/^\d+(?:\.\d+)+$/.test(version)) fail(`Invalid release version: ${release.version}`);
  if(version!==cacheVersion) fail(`Game Version V${version} != Cache Version ${cacheVersion}.`);
  if(requirements.releaseVersion && normalizeVersion(requirements.releaseVersion)!==version){
    fail(`requirements releaseVersion ${requirements.releaseVersion} != V${version}.`);
  }
  return {release,requirements,deprecated,version,cacheVersion};
}
function validateRequirements(requirements){
  const items=Array.isArray(requirements.requirements)?requirements.requirements:[];
  if(items.length===0) fail('Requirement Checklist is empty.');
  const allowed=new Set(['TODO','IMPLEMENTED','VERIFIED','BLOCKED']);
  const ids=new Set();
  for(const item of items){
    if(!item || !item.id || !item.title) fail('Every requirement needs id and title.');
    if(ids.has(item.id)) fail(`Duplicate requirement id: ${item.id}`);
    ids.add(item.id);
    if(!allowed.has(item.status)) fail(`${item.id} has invalid status ${item.status}.`);
    const evidence=item.evidence||{};
    if(item.status==='VERIFIED'){
      if(!Array.isArray(evidence.files)||evidence.files.length===0) fail(`${item.id} VERIFIED without evidence.files.`);
      if(!evidence.verification || !evidence.result) fail(`${item.id} VERIFIED without verification/result evidence.`);
      for(const file of evidence.files){
        if(!fs.existsSync(path.join(ROOT,file))) fail(`${item.id} evidence file does not exist: ${file}`);
      }
    }
  }
  const verified=items.filter(item=>item.status==='VERIFIED').length;
  return {items,verified,total:items.length,allVerified:verified===items.length};
}
function checkVersionMarkers(root,config){
  const {release,version,cacheVersion}=config;
  const index=readText(root,'index.html');
  const loader=readText(root,release.loaderFile||'js/20-anonymous-20.js');
  const requiredIndexPatterns=[
    ['title',new RegExp(`<title>四象江湖傳 V${escapeRegex(version)}<\\/title>`) ],
    ['HUD version',new RegExp(`aria-label=["']目前版本 V${escapeRegex(version)}["'][^>]*>V${escapeRegex(version)}<`) ]
  ];
  for(const [label,pattern] of requiredIndexPatterns){if(!pattern.test(index)) fail(`${label} is not V${version}.`);}
  const cachePattern=new RegExp(`const\\s+V_ASSET_VERSION=["']${escapeRegex(cacheVersion)}["']`);
  if(!cachePattern.test(loader)) fail(`V_ASSET_VERSION is not ${cacheVersion}.`);
  const readyPattern=new RegExp(`dataset\\.runtimeReady=["']${escapeRegex(version)}["']`);
  if(!readyPattern.test(loader)) fail(`runtimeReady is not ${version}.`);
  for(const relative of release.managedCacheReferences||[]){
    const pattern=new RegExp(`${escapeRegex(relative)}\\?v=${escapeRegex(cacheVersion)}(?:["'&#]|$)`);
    if(!pattern.test(index)) fail(`Managed cache reference is not ${cacheVersion}: ${relative}`);
  }
}
function walkFiles(root,relative,extensions,out=[]){
  const full=path.join(root,relative);
  if(!fs.existsSync(full)) return out;
  const stat=fs.statSync(full);
  if(stat.isFile()){
    if(extensions.some(ext=>relative.endsWith(ext))) out.push(relative);
    return out;
  }
  for(const name of fs.readdirSync(full)) walkFiles(root,path.join(relative,name),extensions,out);
  return out;
}
function checkDeprecated(root,deprecated){
  const roots=deprecated.scanRoots||['index.html','js','css'];
  const extensions=deprecated.extensions||['.html','.js','.css'];
  const files=[...new Set(roots.flatMap(entry=>walkFiles(root,entry,extensions)))];
  const hits=[];
  for(const rule of deprecated.assertions||[]){
    if(rule.enabled===false) continue;
    for(const file of files){
      const text=fs.readFileSync(path.join(root,file),'utf8');
      for(const token of rule.forbidden||[]){
        if(text.includes(token)) hits.push(`${rule.id}: ${token} in ${file}`);
      }
    }
  }
  if(hits.length) fail(`Deprecated-code assertion failed:\n${hits.map(v=>`- ${v}`).join('\n')}`);
}
function gitShowJson(baseSha,relative){
  if(!/^[0-9a-f]{40}$/i.test(baseSha||'')) return null;
  try{
    const text=execFileSync('git',['show',`${baseSha}:${relative}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    return JSON.parse(text);
  }catch{return null;}
}
function checkVersionAdvanceGuard(config,summary){
  const previous=gitShowJson(process.env.CI_BASE_SHA||'','release/release.json');
  if(!previous) return;
  const previousVersion=normalizeVersion(previous.version);
  if(previousVersion!==config.version){
    if(config.release.status!=='READY') fail(`Version changed V${previousVersion} -> V${config.version}, but release.status is not READY.`);
    if(!summary.allVerified) fail(`Version changed before Requirement Checklist reached 100% VERIFIED (${summary.verified}/${summary.total}).`);
  }
}
function ensureReleaseReady(config,summary){
  if(config.release.status!=='READY') fail(`Release status is ${config.release.status}; final release requires READY.`);
  if(!summary.allVerified) fail(`Requirements ${summary.verified}/${summary.total} VERIFIED; final release requires ${summary.total}/${summary.total}.`);
}
function writeDeployManifest(root,config,summary){
  const commitSha=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'';
  if(!/^[0-9a-f]{40}$/i.test(commitSha)) fail('EXPECTED_COMMIT_SHA/GITHUB_SHA must be a 40-character commit SHA.');
  const branch=process.env.EXPECTED_BRANCH||process.env.GITHUB_REF_NAME||'';
  const manifest={schemaVersion:1,version:`V${config.version}`,commitSha,branch,cacheVersion:config.cacheVersion,includedRequirements:summary.items.map(item=>({id:item.id,title:item.title,status:item.status})),verificationResult:`${summary.verified}/${summary.total} VERIFIED`,releaseStatus:config.release.status,deployResult:'PENDING_VERIFICATION',deploymentShaVerified:false};
  fs.writeFileSync(path.join(root,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
function validateArtifactManifest(root,config,summary){
  const manifest=readJson(path.join(root,'release-manifest.json'));
  const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'';
  if(manifest.commitSha!==expected) fail(`Artifact commit ${manifest.commitSha} != expected ${expected}.`);
  if(normalizeVersion(manifest.version)!==config.version) fail('Artifact Game Version mismatch.');
  if(normalizeVersion(manifest.cacheVersion)!==config.cacheVersion) fail('Artifact Cache Version mismatch.');
  if(manifest.verificationResult!==`${summary.verified}/${summary.total} VERIFIED`) fail('Artifact requirement result mismatch.');
}
async function verifyDeployed(config){
  const base=(process.env.DEPLOY_BASE_URL||'').replace(/\/$/,'');
  const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'';
  if(!base) fail('DEPLOY_BASE_URL is required.');
  const response=await fetch(`${base}/release-manifest.json?sha=${encodeURIComponent(expected)}`,{cache:'no-store'});
  if(!response.ok) fail(`Cannot fetch deployed manifest: HTTP ${response.status}`);
  const manifest=await response.json();
  if(manifest.commitSha!==expected) fail(`Cloudflare deploy SHA ${manifest.commitSha} != branch commit ${expected}.`);
  if(normalizeVersion(manifest.version)!==config.version) fail(`Deployed Game Version ${manifest.version} != V${config.version}.`);
  if(normalizeVersion(manifest.cacheVersion)!==config.cacheVersion) fail(`Deployed Cache Version ${manifest.cacheVersion} != ${config.cacheVersion}.`);
  const finalManifest={...manifest,deployResult:'SUCCESS',deploymentShaVerified:true,verifiedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(ROOT,'release-manifest.final.json'),JSON.stringify(finalManifest,null,2)+'\n');
  console.log(`✓ Deployment SHA verified: ${expected}`);
}

async function main(){
  const mode=process.argv[2]||'ci';
  const config=getConfig();
  const summary=validateRequirements(config.requirements);
  if(mode==='ci'){
    checkVersionMarkers(ROOT,config);
    checkDeprecated(ROOT,config.deprecated);
    checkVersionAdvanceGuard(config,summary);
    console.log(`✓ Release source coherence: V${config.version}, cache ${config.cacheVersion}.`);
    console.log(`✓ Requirements: ${summary.verified}/${summary.total} VERIFIED.`);
    return;
  }
  if(mode==='release-ready'){
    checkVersionMarkers(ROOT,config);
    checkDeprecated(ROOT,config.deprecated);
    ensureReleaseReady(config,summary);
    console.log(`✓ Final release gate: ${summary.total}/${summary.total} VERIFIED.`);
    return;
  }
  if(mode==='prepare-artifact'){
    checkVersionMarkers(ROOT,config);
    checkDeprecated(ROOT,config.deprecated);
    const deployRoot=path.resolve(process.env.DEPLOY_DIR||path.join(ROOT,'_deploy'));
    checkVersionMarkers(deployRoot,config);
    checkDeprecated(deployRoot,config.deprecated);
    writeDeployManifest(deployRoot,config,summary);
    validateArtifactManifest(deployRoot,config,summary);
    console.log(`✓ Dev preview artifact bound to ${process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA}; requirements ${summary.verified}/${summary.total} VERIFIED.`);
    return;
  }
  if(mode==='verify-deployed'){
    await verifyDeployed(config);
    return;
  }
  fail(`Unknown mode: ${mode}`);
}

main().catch(error=>{console.error(`release-gate: ${error.message}`);process.exit(1);});
