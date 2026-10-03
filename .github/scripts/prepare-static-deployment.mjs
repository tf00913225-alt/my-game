import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// One packaging policy for DEV Cloudflare and Production Pages. Release manifest
// schema, hashes, version and readiness remain owned by release-gate.mjs.
const root=process.cwd();
const sha=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'';
const branch=process.env.EXPECTED_BRANCH||'';
const destination=path.join(root,'_deploy');
if(!/^[0-9a-f]{40}$/i.test(sha)||!['dev','main'].includes(branch)) throw Error('Exact commit SHA and dev/main branch are required');
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha) throw Error('Checkout HEAD differs from deployment SHA');
execFileSync('git',['diff','--exit-code','HEAD','--'],{stdio:'inherit'});
const files=execFileSync('git',['ls-tree','-rz','--name-only','HEAD']);
fs.rmSync(destination,{recursive:true,force:true});
fs.mkdirSync(destination);
const excludes=['.git/','.github/','tests/','node_modules/','functions/',
 '.firebaserc','firebase.json','firestore.rules','_deploy/',
 'artifacts/','assets/inbox/','release-manifest.json','release-manifest.final.json'];
execFileSync('rsync',['-a','--from0','--files-from=-',...excludes.map(p=>'--exclude='+p),'./',destination+'/'],{input:files,stdio:['pipe','inherit','inherit']});
if(!fs.existsSync(path.join(destination,'index.html'))) throw Error('Deployment index.html is missing');
// Pages artifacts forbid links. Reject them for both providers instead of silently
// dereferencing a source outside the immutable tracked deployment.
function rejectLinks(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isSymbolicLink()) throw Error('Deployment contains a symbolic link: '+path.relative(root,file));
  if(entry.isDirectory()) rejectLinks(file);
 }
}
rejectLinks(destination);
execFileSync(process.execPath,['.github/scripts/release-gate.mjs','prepare-artifact'],{
 env:{...process.env,DEPLOY_DIR:destination,EXPECTED_COMMIT_SHA:sha,EXPECTED_BRANCH:branch},stdio:'inherit'
});
console.log('Immutable static artifact prepared for '+branch+'@'+sha);
