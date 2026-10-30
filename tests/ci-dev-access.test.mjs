import test from 'node:test';
import assert from 'node:assert/strict';
import { devAccessFetch, accessContinueParams } from '../.github/scripts/dev-access-fetch.mjs';

test('DEV credential headers remain scoped to the exact origin and redirects are not followed', async () => {
  const original = globalThis.fetch;
  const calls = [];
  process.env.CF_ACCESS_CLIENT_ID = 'test-id';
  process.env.CF_ACCESS_CLIENT_SECRET = 'test-secret';
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return new Response('', { status: 200 }); };
  try {
    await devAccessFetch('https://dev.four-symbols-dev.pages.dev/release-manifest.json');
    assert.equal(calls[0].options.headers.get('CF-Access-Client-Id'), 'test-id');
    assert.equal(calls[0].options.headers.get('CF-Access-Client-Secret'), 'test-secret');
    assert.equal(calls[0].options.redirect, 'manual');
    await devAccessFetch('https://example.org/');
    assert.equal(calls[1].options.headers, undefined);
    const devRequest = {requestId:'1',request:{url:'https://dev.four-symbols-dev.pages.dev/file.js',headers:{Accept:'*/*'}}};
    const continued = accessContinueParams(devRequest);
    assert.deepEqual(continued.headers.map(x => x.name).sort(), ['Accept','CF-Access-Client-Id','CF-Access-Client-Secret'].sort());
    assert.deepEqual(accessContinueParams({requestId:'2',request:{url:'https://firebase.google.com/file.js',headers:{}}}),{requestId:'2'});
    assert.deepEqual(accessContinueParams({requestId:'3',request:{url:'https://dev.four-symbols-dev.pages.dev.evil.example/file.js',headers:{}}}),{requestId:'3'});
    delete process.env.CF_ACCESS_CLIENT_SECRET;
    await assert.rejects(devAccessFetch('https://dev.four-symbols-dev.pages.dev/'), /Incomplete/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = original;
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
    delete process.env.CF_ACCESS_REQUIRED;
  }
});

test('required credentials fail closed before making a DEV request', async () => {
  process.env.CF_ACCESS_REQUIRED='1';
  try {
    await assert.rejects(devAccessFetch('https://dev.four-symbols-dev.pages.dev/'), /credentials are required/);
  } finally { delete process.env.CF_ACCESS_REQUIRED; }
});

test('invalid credential format fails without exposing values or sending requests', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  process.env.CF_ACCESS_CLIENT_ID = 'synthetic-id';
  process.env.CF_ACCESS_CLIENT_SECRET = 'synthetic-secret-marker\ninside';
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected request'); };
  const safeError = (error) => error.message === 'Invalid DEV Access credentials format' && !error.message.includes('synthetic-secret-marker');
  try {
    await assert.rejects(devAccessFetch('https://dev.four-symbols-dev.pages.dev/'), safeError);
    assert.throws(() => accessContinueParams({requestId:'1',request:{url:'https://dev.four-symbols-dev.pages.dev/',headers:{}}}), safeError);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
  }
});

