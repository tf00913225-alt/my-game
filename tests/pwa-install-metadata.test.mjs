import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const manifest=JSON.parse(fs.readFileSync('app.webmanifest','utf8'));
test('installed launch identity and icons remain same-origin and in scope at root or project prefix',()=>{
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.name&&manifest.short_name);
 assert.match(fs.readFileSync('index.html','utf8'),/<link rel="manifest" href="app\.webmanifest">/);
 for(const base of ['https://qa.invalid/','https://qa.invalid/my-game/']){
  const url=new URL('app.webmanifest',base),scope=new URL(manifest.scope,url),start=new URL(manifest.start_url,url),id=new URL(manifest.id,url);
  assert.equal(start.origin,url.origin);assert.equal(id.origin,url.origin);
  assert.equal(scope.href,base);assert(start.pathname.startsWith(scope.pathname));
  assert.equal(start.pathname,new URL('index.html',base).pathname);
  assert.equal(start.search,'');assert.equal(start.hash,'');assert.equal(id.href,base);
  for(const icon of manifest.icons){assert.equal(new URL(icon.src,url).origin,url.origin);assert(new URL(icon.src,url).pathname.startsWith(scope.pathname));}
 }
});
test('PWA WebP icons have truthful dimensions within desktop installability bounds',()=>{
 assert.ok(manifest.icons.length);
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes).sort(),['192x192','512x512']);
 for(const icon of manifest.icons){
  const file=path.resolve(icon.src);assert(file.startsWith(path.resolve('assets')+path.sep));
  const bytes=fs.readFileSync(file);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  let width,height;const kind=bytes.toString('ascii',12,16);
  if(kind==='VP8X'){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}
  else if(kind==='VP8L'){const n=bytes.readUInt32LE(21);width=(n&16383)+1;height=((n>>>14)&16383)+1;}
  else{assert.equal(kind,'VP8 ');width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}
   assert.equal(icon.sizes,width+'x'+height);assert.equal(width,height);assert(width>=144&&width<=1024);assert.equal(icon.type,'image/webp');assert.equal(icon.purpose,'any');
 }
 assert.match(fs.readFileSync('_headers','utf8'),/\/app\.webmanifest\r?\n  Content-Type: application\/manifest\+json\r?\n  Cache-Control: no-cache, no-store, must-revalidate/);
});
