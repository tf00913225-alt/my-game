import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
// Test host uses the exact current Display owner, not a copied fit formula.
// No account/runtime initialization is executed by this isolated sample host.
export function displaySource(){
 const source=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
 const start=source.indexOf('const displayTokens ='),end=source.indexOf('window.eventToGamePoint = getGamePointFromEvent;',start);
 if(start<0||end<0)throw Error('Canonical Display boundary changed; review fixture');
 return source.slice(start,end+'window.eventToGamePoint = getGamePointFromEvent;'.length);
}
export function sampleHtml(){
 const template=fs.readFileSync(path.join(root,'prototypes/exploration-corner/index.html'),'utf8');
 const marker='<!-- canonical-display-owner -->',source=displaySource();
 if(template.split(marker).length!==2||/<\/script/i.test(source))throw Error('Canonical Display insertion boundary changed; review fixture');
 return template.replace(marker,()=>`<script>${source}</script>`);
}
export function startSample(port=0){return new Promise(resolve=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative=pathname==='/'?'/prototypes/exploration-corner/index.html':pathname;
  const target=path.resolve(root,'.'+relative);
  if(!target.startsWith(root)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');
  if(relative==='/prototypes/exploration-corner/index.html'){
   try{res.end(sampleHtml());}catch(error){res.writeHead(500);res.end('Sample Display initialization failed');console.error(error);}
   return;
  }
  fs.createReadStream(target).pipe(res);
 });server.listen(port,'127.0.0.1',()=>resolve({server,url:`http://127.0.0.1:${server.address().port}/prototypes/exploration-corner/index.html`}));
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {url}=await startSample(Number(process.env.PORT)||56626);console.log(url);}
