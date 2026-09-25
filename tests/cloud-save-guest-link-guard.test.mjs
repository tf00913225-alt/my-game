import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(new URL('../js/firebase/firebase-auth.js',import.meta.url),'utf8');
const start=source.indexOf('export async function signInWithGoogle(){');
const end=source.indexOf('export async function signInWithFacebook(){',start);
test('Google sign-in detects anonymous UID before the popup can replace a guest character',async()=>{
 assert.ok(start>=0&&end>start);
 let popupCalls=0;
 const context={initializeFirebaseAuth:async()=>({auth:{currentUser:{uid:'guest',isAnonymous:true}}}),
  GoogleAuthProvider:class{},signInWithPopup:async()=>{popupCalls++;},completedSignIn:()=>{}};
 vm.runInNewContext(source.slice(start,end).replace('export async function','async function'),context);
 await assert.rejects(context.signInWithGoogle(),error=>error.code==='auth/guest-link-required');
 assert.equal(popupCalls,0);
});
