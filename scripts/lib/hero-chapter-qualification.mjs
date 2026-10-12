import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

export const HERO_CHAPTER_PATH='functions/src/generated/hero-chapter-qualification.json';
// Only chapter identities/transitions are projected from the existing data
// Owner. No encounter stats, combat execution, victory proof or reward amounts.
export function syncHeroChapterQualification(root,checkOnly){
 const sourcePath='js/adventure/adventure-content-v1-20260915.js';
 const source=fs.readFileSync(path.join(root,sourcePath),'utf8');
 const context={window:{}};vm.runInNewContext(source,context,{timeout:1000});
 const chapter=context.window.FourSymbolsAdventureContent.chapters.chapter_v1;
 const nodes=chapter.nodes.filter(node=>node.availability!=='planned').map(node=>({
  id:node.id,type:node.type,next:node.next||null,
  branches:(node.branches||[]).map(choice=>({id:choice.id,nodeId:choice.nodeId}))}));
 if(!nodes.some(node=>node.id===chapter.startNodeId)||
    !nodes.some(node=>node.id===chapter.endNodeId&&node.type==='finish')||nodes.length>32){
  throw Error('Unsupported chapter-one qualification graph');
 }
 const policy={schemaVersion:1,chapterId:chapter.id,startNodeId:chapter.startNodeId,
  endNodeId:chapter.endNodeId,nodes,sourcePath,
  sourceSha256:createHash('sha256').update(source).digest('hex'),outcomeVerified:false};
 const text=JSON.stringify(policy,null,2)+'\n',target=path.join(root,HERO_CHAPTER_PATH);
 if(checkOnly){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==text)throw Error('Hero chapter qualification projection is stale');}
 else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);}
}
