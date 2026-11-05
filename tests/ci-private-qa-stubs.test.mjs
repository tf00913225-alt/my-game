import test from 'node:test';
import assert from 'node:assert/strict';
import {qaScriptStub,startServer} from '../.github/scripts/runtime-browser-qa-support.mjs';
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

test('private QA proxy loads the canonical homepage without following redirects', async () => {
  const original=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async (input,options)=>{
    const url=new URL(input);
    if(url.origin!=='https://dev.four-symbols-dev.pages.dev')return original(input,options);
    seen.push({path:url.pathname,redirect:options.redirect});
    if(url.pathname==='/index.html')return new Response(null,{status:308,headers:{location:'/'}});
    if(url.pathname==='/')return new Response('<!-- build:critical-script -->',{status:200});
    return new Response('asset',{status:200});
  };
  process.env.CF_ACCESS_CLIENT_ID='synthetic-id';
  process.env.CF_ACCESS_CLIENT_SECRET='synthetic-secret';
  let proxy;
  try {
    proxy=await startServer({baseUrl:'https://dev.four-symbols-dev.pages.dev'});
    for(const pathname of ['/','/index.html']) {
      const response=await original(new URL(pathname,proxy.url));
      assert.equal(response.status,200);
      assert.match(await response.text(),/four_symbols_active_uid/);
    }
    const asset=await original(new URL('/asset.js',proxy.url));
    assert.equal(await asset.text(),'asset');
    assert.deepEqual(seen.map(x=>x.path),['/','/','/asset.js']);
    assert.ok(seen.every(x=>x.redirect==='manual'));
  } finally {
    if(proxy)await new Promise(resolve=>proxy.server.close(resolve));
    globalThis.fetch=original;
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
  }
});

test('private QA proxy retrieves genuine privacy pages through canonical paths', async () => {
  const original=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async (input,options)=>{
    const url=new URL(input);
    if(url.origin!=='https://dev.four-symbols-dev.pages.dev')return original(input,options);
    seen.push({path:url.pathname,redirect:options.redirect});
    if(url.pathname==='/privacy-consent.html'||url.pathname==='/privacy.html')return new Response(null,{status:308});
    if(url.pathname==='/privacy-consent')return new Response('genuine-consent-page',{status:200});
    if(url.pathname==='/privacy')return new Response('genuine-privacy-page',{status:200});
    return new Response('other-asset',{status:200});
  };
  process.env.CF_ACCESS_CLIENT_ID='synthetic-id';
  process.env.CF_ACCESS_CLIENT_SECRET='synthetic-secret';
  let proxy;
  try {
    proxy=await startServer({baseUrl:'https://dev.four-symbols-dev.pages.dev'});
    for(const [path,expected] of [['/privacy-consent.html','genuine-consent-page'],['/privacy.html','genuine-privacy-page'],['/other.html','other-asset'],['/asset.js','other-asset']]){
      const response=await original(new URL(path,proxy.url));
      assert.equal(response.status,200);
      assert.equal(await response.text(),expected);
    }
    assert.deepEqual(seen.map(x=>x.path),['/privacy-consent','/privacy','/other.html','/asset.js']);
    assert.ok(seen.every(x=>x.redirect==='manual'));
  } finally {
    if(proxy)await new Promise(resolve=>proxy.server.close(resolve));
    globalThis.fetch=original;
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
  }
});
