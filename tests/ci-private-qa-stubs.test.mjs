import test from 'node:test';
import assert from 'node:assert/strict';
import {qaScriptStub} from '../.github/scripts/runtime-browser-qa-support.mjs';
import {accessContinueParams} from '../.github/scripts/dev-access-fetch.mjs';

test('QA account scripts are substituted only for script loads, never integrity fetches', () => {
  const url='https://dev.four-symbols-dev.pages.dev/index.html';
  const path='/build/firebase/firebase-auth.123456789abc.js';
  const stubs=new Map([[path,'isolated-account-stub']]);
  const request=resourceType=>({resourceType,requestId:'request-1',request:{url:new URL(path,url).href,headers:{Accept:'*/*'}}});
  process.env.CF_ACCESS_CLIENT_ID='synthetic-id';
  process.env.CF_ACCESS_CLIENT_SECRET='synthetic-secret';
  try {
    assert.equal(qaScriptStub(request('Script'),stubs,url),'isolated-account-stub');
    for(const resourceType of ['Fetch','XHR','Other']) {
      const paused=request(resourceType);
      assert.equal(qaScriptStub(paused,stubs,url),undefined);
      assert.ok(accessContinueParams(paused).headers.some(h=>h.name==='CF-Access-Client-Id'));
    }
  } finally {
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
  }
});
