import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

// Compare complete top-level declarations, never diff hunk line numbers. Any
// change outside explicitly owned existing functions is unknown shared runtime.
const SHARED_FUNCTIONS = {
  renderShopContent: ['ui','inventory'],
  openInventoryCharacterDetail: ['ui','inventory'],
  renderBattle: ['battle'],
  applyMonsterUiUpdate: ['battle'],
  openBattleStatusDetailModal: ['battle'],
  projectEnemyResource: ['battle'],
  syncEnemyResourceHud: ['battle']
};
const SHARED_MODULES = {
  'js/00-main.js': SHARED_FUNCTIONS,
  'js/36-v141-content-systems.js': Object.fromEntries(['renderReforgeTab','renderSynthesisTabs','renderMaterialSynthesis','renderSynthesis'].map(k=>[k,['ui','inventory']])),
  'js/equipment-progression.js': Object.fromEntries(['remainingReforgeSlots','appendReforgeMarkers','renderEquipmentShop','equipmentChestOddsText'].map(k=>[k,['ui','inventory']]))
};
export function classifySharedSource(before, after, sourcePath='js/00-main.js') {
  try {
    const owners=SHARED_MODULES[sourcePath];if(!owners)return null;
    // The aggregate consumes only native policy helpers. Its minimal job does
    // not install the parser; load Acorn only for actual source classification.
    const {parse}=createRequire(import.meta.url)('acorn');
    const inspect = source => {
      const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
      const functions={}, pieces=[];let cursor=0;
      const nodes=[];
      const collect=value=>{if(!value||typeof value!=='object')return;
        if(value.type==='FunctionDeclaration'&&owners[value.id?.name]){nodes.push(value);return;}
        for(const child of Object.values(value))if(Array.isArray(child))child.forEach(collect);else collect(child);
      };collect(ast);nodes.sort((a,b)=>a.start-b.start);
      for(const node of nodes) {
        if(functions[node.id.name]) throw Error('Duplicate owner');
        const effects=[],bindings=[],mathCalls=[],catchParams=[],references=new Map();let effectCount=0;
        const canonical=value=>JSON.stringify(value,function(key,item){return ['start','end'].includes(key)||(key==='raw'&&this.type==='Literal')?undefined:item;});
        const visit=value=>{
          if(!value || typeof value!=='object') return;
          if(value.type==='Identifier')references.set(value.name,(references.get(value.name)||0)+1);
          if(value.type==='VariableDeclarator')bindings.push(value);
          if(['FunctionDeclaration','ClassDeclaration'].includes(value.type))bindings.push({id:value.id,init:value});
          if(['IfStatement','ConditionalExpression','WhileStatement','DoWhileStatement','ForStatement','SwitchStatement','SwitchCase'].includes(value.type))effects.push(canonical({type:value.type,test:value.test,init:value.init,update:value.update,discriminant:value.discriminant}));
          if(['ForInStatement','ForOfStatement','LogicalExpression'].includes(value.type))effects.push(canonical({type:value.type,operator:value.operator,left:value.left,right:value.type==='LogicalExpression'?undefined:value.right,await:value.await}));
          if(value.type==='CatchClause'){catchParams.push(value.param);effects.push(canonical({type:value.type,param:value.param}));}
          if(['ReturnStatement','BreakStatement','ContinueStatement','TryStatement'].includes(value.type))effects.push(canonical({type:value.type,label:value.label,handler:!!value.handler,finalizer:!!value.finalizer}));
          if(value.type==='ThrowStatement'){effects.push(canonical(value));effectCount++;}
          if(['WithStatement','DebuggerStatement'].includes(value.type)){effects.push(canonical(value));effectCount++;}
          if(['ForInStatement','ForOfStatement','SpreadElement'].includes(value.type)){effects.push(canonical(value));effectCount++;}
          if(['TaggedTemplateExpression','ImportExpression'].includes(value.type)){effects.push(canonical(value));effectCount++;}
          if(value.type==='CallExpression' || value.type==='NewExpression') {
            const callee=source.slice(value.callee.start,value.callee.end).replace(/\s/g,'');
            if(/^Math\.(?:floor|ceil|round|trunc)$/.test(callee)&&value.arguments.every(n=>n.type==='Literal'&&typeof n.value==='number'))mathCalls.push(value);
            else{effects.push(canonical(value));effectCount++;}
          }
          if(['AssignmentExpression','UpdateExpression','AwaitExpression','YieldExpression'].includes(value.type)||(value.type==='UnaryExpression'&&value.operator==='delete')){effects.push(canonical(value));effectCount++;}
          for(const child of Object.values(value)) if(Array.isArray(child)) child.forEach(visit);else visit(child);
        };
        visit(node.body);
        if(JSON.stringify([...node.params,...catchParams,...bindings.map(b=>b.id)]).includes('"name":"Math"'))for(const call of mathCalls){effects.push(canonical(call));effectCount++;}
        // Inputs reached through local aliases/default parameters must stay fixed,
        // too. An unused pure diagnostic local cannot change an existing effect.
        const presentationRows=b=>node.id.name==='openInventoryCharacterDetail' && b.id.name==='rows' && references.get('rows')===2 && b.init?.type==='ArrayExpression' && b.init.elements.every(row=>row?.type==='ArrayExpression' && row.elements.length===2 && row.elements[0]?.type==='Literal' && typeof row.elements[0].value==='string');
        const usedBindings=bindings.filter(b=>(b.id.type!=='Identifier'||(references.get(b.id.name)||0)>1) && !presentationRows(b) && !(effectCount===0&&b.id.name!=='Math'&&b.init?.type==='Literal'&&(b.init.value===null||['string','number','boolean'].includes(typeof b.init.value))));
        const signature={params:node.params,async:node.async,generator:node.generator,directives:node.body.body.filter(n=>n.directive).map(n=>n.directive)};
        functions[node.id.name]={text:source.slice(node.start,node.end),effects:canonical({effects,bindings:usedBindings,...signature})};
        pieces.push(source.slice(cursor,node.start),`FUNCTION:${node.id.name}`);cursor=node.end;
      }
      pieces.push(source.slice(cursor));return {functions,rest:pieces.join('')};
    };
    const a=inspect(before),b=inspect(after);
    if(a.rest!==b.rest || JSON.stringify(Object.keys(a.functions))!==JSON.stringify(Object.keys(b.functions))) return null;
    if(Object.keys(a.functions).some(k=>a.functions[k].effects!==b.functions[k].effects)) return null;
    const changed=Object.keys(a.functions).filter(k=>a.functions[k].text!==b.functions[k].text);
    return changed.length ? [...new Set(changed.flatMap(k=>owners[k]))] : null;
  } catch {return null;}
}
const GENERATED=/^(?:build\/|asset-manifest\.json$|functions\/src\/generated\/restricted-forest-instance-policy\.json$)/;

const SHARED_CSS = new Set(['css/00-main.css','css/30-v130-requested-updates.css',
  'css/31-v131-fix-batch.css','css/38-v141-system-expansion.css','css/42-v146-system-polish.css','css/44-v149-skill-ui-rules.css','css/49-v169-rpg-ui.css']);

// Compare actual rule/declaration changes in shared files. Global tokens,
// imports, unknown selectors, cascade reordering and parser failures stay Full.
// Parsers are lazy: the minimal aggregate checkout needs no dependencies.
export function classifySharedCss(before, after) {
  try {
    const require=createRequire(import.meta.url);
    const postcss=require('postcss'), selectors=require('postcss-selector-parser');
    const inspect=source=>{
      const rows=[],counts=new Map();
      const add=(key,value,selector=null)=>{
        const occurrence=counts.get(key)||0;counts.set(key,occurrence+1);
        rows.push({key:key+'#'+occurrence,value,selector});
      };
      const visit=(parent,context='')=>{
        for(const node of parent.nodes||[]) {
          if(node.type==='comment')continue;
          if(node.type==='atrule'&&['media','supports'].includes(node.name)&&node.nodes) {
            visit(node,context+'@'+node.name+' '+node.params+'/');continue;
          }
          if(node.type==='rule'&&node.nodes.every(n=>['decl','comment'].includes(n.type))) {
            add(context+node.selector,JSON.stringify(node.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,!!n.important])),node.selector);
          } else add(context+node.type+':'+(node.name||node.prop||''),node.toString());
        }
      };
      visit(postcss.parse(source));return rows;
    };
    const a=inspect(before),b=inspect(after),am=new Map(a.map(n=>[n.key,n])),bm=new Map(b.map(n=>[n.key,n]));
    if(JSON.stringify(a.filter(n=>bm.has(n.key)).map(n=>n.key))!==JSON.stringify(b.filter(n=>am.has(n.key)).map(n=>n.key)))return null;
    const changed=[...a.filter(n=>bm.get(n.key)?.value!==n.value),...b.filter(n=>am.get(n.key)?.value!==n.value)];
    if(!changed.length)return ['ui','ui_shared'];
    const responsibilities=new Set();
    for(const row of changed) {
      if(!row.selector)return null;
      const ast=selectors().astSync(row.selector);
      for(const selector of ast.nodes) {
        // Sibling combinators could escape an otherwise positive ancestor scope.
        if(selector.nodes.some(n=>n.type==='combinator'&&!['','>'].includes(n.value.trim())))return null;
        const ids=selector.nodes.filter(n=>n.type==='id').map(n=>n.value);
        const classes=selector.nodes.filter(n=>n.type==='class').map(n=>n.value);
        let scope;
        if(ids.includes('battlePage')||ids.includes('autoBattleSettingsPanel'))scope=['ui','battle'];
        else if(ids.includes('mapPage'))scope=['ui','tower','battle'];
        else if(ids.includes('skillPage')||ids.includes('homeFeatureModal')&&selector.nodes.some(n=>n.type==='attribute'&&n.attribute==='data-character-tab'&&n.operator==='='&&n.value==='skill'))scope=['ui','skill_ui'];
        else if(ids.includes('inventoryPage'))scope=['ui','inventory'];
        else if(ids.some(id=>['homeFeatureModal','homePage','skillDetailModal','statusHelpModal','inventoryCharacterDetailModal','itemModal'].includes(id))||classes.some(c=>['home-feature-modal-box','item-modal-box','creation-skill-detail-box','v169-rpg-dialog'].includes(c)))scope=['ui','ui_shared'];
        else return null;
        scope.forEach(k=>responsibilities.add(k));
      }
    }
    return [...responsibilities];
  } catch {return null;}
}

// Only presentation inside established UI roots may be isolated from the
// shared document. Events, IDs, data bindings, form controls and executable
// content retain their complete fingerprint; Startup/Auth/outside bytes stay fixed.
export function classifySharedHtml(before, after, {generatedVerified=false}={}) {
  try {
    const html=createRequire(import.meta.url)('parse5');
    const roots=new Map([
      ['homePage',['ui','ui_shared']],['homeFeatureModal',['ui','ui_shared']],
      ['inventoryPage',['ui','inventory']],['skillPage',['ui','skill_ui']],
      ['skillDetailModal',['ui','skill_ui']],['statusHelpModal',['ui','ui_shared']]
    ]);
    const visualTags=new Set(['div','span','p','h1','h2','h3','h4','button','section','header','footer','label','strong','b','small','ul','li','a','img','svg','g','path','circle','ellipse','rect','line','polyline','polygon']);
    const visualAttrs=new Set(['class','style','title','width','height','alt']);
    const svgAttrs=new Set(['viewBox','viewbox','d','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','cx','cy','r','rx','ry','x','y','x1','x2','y1','y2','points','transform','xmlns']);
    const fingerprint=(node,labelContext=false)=>{
      if(node.nodeName==='#comment')return null;
      if(node.nodeName==='#text')return labelContext&&!/[0-9]/.test(node.value)?'#label':node.value;
      if(!visualTags.has(node.tagName))return html.serializeOuter(node);
      const label=labelContext||['button','label','h1','h2','h3','h4'].includes(node.tagName)||node.attrs?.some(a=>a.name==='id'&&a.value==='homeFeatureModalTitle');
      return [node.tagName,(node.attrs||[]).filter(a=>!visualAttrs.has(a.name)&&!(node.tagName==='img'&&['src','srcset'].includes(a.name))&&!(node.namespaceURI==='http://www.w3.org/2000/svg'&&svgAttrs.has(a.name))),
        (node.childNodes||[]).map(child=>fingerprint(child,label)).filter(n=>n!==null)];
    };
    const inspect=input=>{
      const source=generatedVerified?input.replace(/<!-- build:(critical-style|critical-script) -->[\s\S]*?<!-- \/build:\1 -->/g,(_,name)=>`<!-- build:${name} --><!-- /build:${name} -->`):input;
      const errors=[],parts=[];
      const tree=html.parse(source,{sourceCodeLocationInfo:true,onParseError:e=>errors.push(e.code)});
      const visit=node=>{
        const id=node.attrs?.find(a=>a.name==='id')?.value;
        if(roots.has(id)) {
          const loc=node.sourceCodeLocation;if(!loc?.endTag)throw Error('Unclosed UI scope');
          parts.push({id,start:loc.startOffset,end:loc.endOffset,effect:JSON.stringify(fingerprint(node))});return;
        }
        (node.childNodes||[]).forEach(visit);
      };visit(tree);
      if(new Set(parts.map(p=>p.id)).size!==parts.length)throw Error('Duplicate UI scope');
      let rest='',cursor=0;
      for(const p of parts){rest+=source.slice(cursor,p.start)+`UI:${p.id}`;p.text=source.slice(p.start,p.end);cursor=p.end;}
      rest+=source.slice(cursor);return {rest,parts,errors};
    };
    const a=inspect(before),b=inspect(after);
    if(a.rest!==b.rest||JSON.stringify(a.errors)!==JSON.stringify(b.errors)||a.parts.length!==b.parts.length)return null;
    const result=new Set();
    for(let i=0;i<a.parts.length;i++) {
      const x=a.parts[i],y=b.parts[i];if(x.id!==y.id||x.effect!==y.effect)return null;
      if(x.text!==y.text)roots.get(x.id).forEach(k=>result.add(k));
    }
    return result.size?[...result]:generatedVerified&&before!==after?[]:null;
  } catch {return null;}
}

// Single policy owner. Rollback conditional PR gates by setting this false.
export const PR_GATES_ENABLED = true;

// User-authorized, one-work exception (2026-10-11): no Boss Gate for this
// already visually accepted lethal-hit repair. No other gate is relaxed.
const LETHAL_BOSS_EXCEPTION = Object.freeze({
  workId: 'BATTLE-LETHAL-HIT-OVERLAY-20261011',
  sourceCommit: '87216848b406a5c96e6862c4e133bd6df1b86c9f',
  expires: '2026-10-18T00:00:00Z'
});
const LETHAL_EXCEPTION_POLICY_PATHS = new Set([
  '.github/scripts/ci-change-classifier.mjs', '.github/scripts/ci-aggregate.mjs',
  'tests/ci-boss-routing.test.mjs', 'tests/ci-aggregate.test.mjs',
  // This existing acceptance fixture corrects pre-start HP overwritten by the
  // formal roster builder; the accepted gameplay/artwork/build stays pinned.
  '.github/scripts/run-hit-evasion-v2-browser-qa.mjs'
]);
const LETHAL_EXCEPTION_SOURCE_PATH = /^(?:js\/(?:00-main|37-v142-skill-animation|39-v143-skill-animation|54-v173\.51-battle-qa)\.js|SYSTEM_CONTRACTS\.md|tests\/battle-direct-impact-overlay-20261011\.test\.js|\.github\/scripts\/(?:fixtures\/direct-impact-overlay-vm\.cjs|lethal-impact-overlay-browser-qa\.mjs)|asset-manifest\.json|build\/(?:asset-manifest\.json|(?:app-shell|gameplay-core-primary|gameplay-core-secondary)\.[a-f0-9]+\.js)|functions\/src\/generated\/restricted-forest-instance-policy\.json)$/;

export function isAuthorizedLethalBossException(plan, now = new Date()) {
  const e = plan?.bossException;
  return !!e && plan.baseRef === 'dev' && ['pull_request', 'push'].includes(plan.eventName) &&
    !plan.fullRegression && !plan.shadow && now.getTime() < Date.parse(LETHAL_BOSS_EXCEPTION.expires) &&
    Object.entries(LETHAL_BOSS_EXCEPTION).every(([key, value]) => e[key] === value) &&
    /^[a-f0-9]{40}$/.test(e.baseSha || '') && /^[a-f0-9]{40}$/.test(e.headSha || '');
}

export function applyAuthorizedLethalBossException(plan, {
  baseSha, headSha, paths, generatedVerified = false, now = new Date(),
  runGit = args => execFileSync('git', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
} = {}) {
  const candidate = {...plan, bossException: {...LETHAL_BOSS_EXCEPTION, baseSha, headSha}};
  if (!isAuthorizedLethalBossException(candidate, now) || !paths?.length ||
      plan.reasons.some(reason => /unavailable|invalid|unreliable/i.test(reason)) ||
      paths.some(p => !LETHAL_EXCEPTION_POLICY_PATHS.has(p) && !LETHAL_EXCEPTION_SOURCE_PATH.test(p))) return plan;
  const manifests = new Set(['asset-manifest.json', 'build/asset-manifest.json']);
  if (paths.some(p => manifests.has(p)) && !generatedVerified) return plan;
  try {
    // Applies only when introducing the accepted checkpoint, never a later dev
    // push that already contains it. New combat/artwork/build changes revoke it.
    runGit(['merge-base', '--is-ancestor', LETHAL_BOSS_EXCEPTION.sourceCommit, headSha]);
    let alreadyIntegrated = false;
    try {runGit(['merge-base', '--is-ancestor', LETHAL_BOSS_EXCEPTION.sourceCommit, baseSha]); alreadyIntegrated = true;}
    catch (error) {if (error.status !== 1) throw error;}
    if (alreadyIntegrated || runGit(['diff', '--name-only', LETHAL_BOSS_EXCEPTION.sourceCommit, headSha, '--',
      // Manifests can absorb unrelated latest-dev boot CSS; the formal build
      // must verify them, while every affected shipped JS bundle stays pinned.
      ...paths.filter(p => !LETHAL_EXCEPTION_POLICY_PATHS.has(p) && !manifests.has(p))]).trim()) return plan;
    return {...candidate, gates: {...plan.gates, boss_balance: false}, bossMode: 'none'};
  } catch {return plan;}
}
export const CHANGE_FLAGS = Object.freeze([
  'core', 'battle', 'monster_balance', 'tower', 'daily', 'abyss', 'adventure',
  'boss', 'ui', 'ui_shared', 'inventory', 'skill', 'skill_ui', 'portrait', 'cloud', 'persistence',
  'release', 'workflow', 'unknown_runtime'
]);
export const BROWSER_GATES = Object.freeze([
  'battle_browser', 'ui_browser', 'daily_browser', 'tower_wild_browser',
  'portrait_browser', 'adventure_ui_browser', 'abyss_balance',
  'adventure_balance', 'boss_balance'
]);

// Narrow owners only. Anything outside these routes is strict, including new
// runtime files. Generated build/manifest changes are deliberately strict.
const QA_OWNERS = {
  '.github/scripts/run-skill-progression-browser-qa.mjs':['ui','skill_ui'],
  '.github/scripts/run-responsive-item-browser-qa.mjs':['ui','ui_shared'],
  '.github/scripts/run-touch-scroll-navigation-browser-qa.mjs':['ui','ui_shared'],
  '.github/scripts/run-release-update-notification-browser-qa.mjs':['ui','ui_shared'],
  '.github/scripts/run-forge-sockets-browser-qa.mjs':['ui','inventory'],
  '.github/scripts/run-hero-page-browser-qa.mjs':['ui','ui_shared'],
  '.github/scripts/run-foreground-potion-browser-qa.mjs':['ui','inventory'],
  '.github/scripts/run-fixed-slot-battlefield-browser-qa.mjs':['battle'],
  '.github/scripts/run-battle-target-lifecycle-browser-qa.mjs':['battle'],
  '.github/scripts/run-daily-balance-browser-qa.mjs':['daily','battle'],
  '.github/scripts/run-abyss-balance-browser-qa.mjs':['abyss','battle'],
  '.github/scripts/run-adventure-browser-qa.mjs':['adventure','ui'],
  'tests/v169-rpg-ui.test.js':['ui','ui_shared'],
  'tests/ui-black-gold-window-skin.test.js':['ui','ui_shared'],
  'tests/ui-typography-standard.test.js':['ui','ui_shared'],
  'tests/ui-typography-mobile-browser.test.js':['ui','ui_shared'],
  'tests/ui-element-box-medium-modal.test.js':['ui','ui_shared'],
  // Existing self-contained preview; no runtime/build consumer. New prototype
  // paths still fail closed, as do mixed runtime or deployment changes.
  'prototypes/ui-shared-samples-20261030/index.html':['ui','ui_shared']
};
// Former Session Authority path filters, retained by the single CI Owner.
export const SESSION_PATHS = [
  /^functions\//, /^js\/firebase\//, /^firestore\.rules$/, /^firebase[^/]*\.json$/,
  /^scripts\/test-session-authority-emulator\.mjs$/, /^tests\/session-[^/]*\.test\.mjs$/,
  /^tests\/cloud-save-[^/]*\.test\.mjs$/, /^tests\/firebase-trusted-cloud-save-backend\.test\.mjs$/,
  /^scripts\/firestore-backup-readiness\.mjs$/, /^scripts\/storage-recovery-readiness\.mjs$/,
  /^tests\/firestore-backup-readiness\.test\.mjs$/, /^\.github\/workflows\/session-authority\.yml$/,
  /^\.github\/scripts\/wait-session-repository-checks\.mjs$/, /^tests\/session-repository-checks-wait\.test\.mjs$/
];
const OWNERS = [
  [/^(?:functions\/|js\/firebase\/|firestore\.rules$|firebase.*\.json$)/, ['cloud', 'persistence']],
  [/^js\/startup\//, ['cloud', 'persistence']],
  [/^config\/persisted-state-registry\.json$/, ['persistence', 'cloud']],
  [/^(?:config\/monster-(?:portrait-registry|asset-provenance)\.json|assets\/monsters\/)/, ['portrait', 'battle']],
  [/^config\/daily-monster-archetypes\.json$/, ['daily', 'battle']],
  [/^config\/wild-monster-archetypes\.json$/, ['tower', 'battle']],
  [/^js\/59-abyss-two-tier-runtime\.js$/, ['abyss', 'battle']],
  [/^js\/adventure\/adventure-(?:ui|entry|items|content|runtime)-v1-20260915\.js$/, ['adventure', 'battle', 'ui']],
  [/^js\/(?:04-stage-v11-native-bottom-nav-runtime|19-stage-v78-character-inventory-runtime|53-v173\.50-inventory-qol|55-v173\.51-inventory-qa|56-v173\.51-shop-qa|release-update-notification)\.js$/, ['ui', 'inventory']],
  [/^css\/(?:06-stage-v11-native-bottom-nav|08-stage-v14-character-scroll-fix|09-stage-v15-native-character-shell|22-stage-v78-character-inventory-core|23-stage-v77-inventory-detail-ui|24-stage-v85-inventory-inner-grid-scroll-root|52-v173\.50-inventory-qol|release-update-notification|ad-free-service-info-modal)\.css$/, ['ui', 'inventory']],
  [/^css\/battle-(?:floating-feedback|skill-name-presentation)-owner\.css$/, ['ui', 'battle']],
  [/^css\/adventure-(?:entry-v1|v1)-20260915\.css$/, ['adventure', 'ui']],
  [/^tests\/(?:cloud-save-|session-|firebase-|account-save-|auth-before-)/, ['cloud', 'persistence']],
  [/^tests\/(?:backpack-|responsive-window-|bottom-nav-|starter-potion-|forge-sockets-|reforge-eligibility-|ui-synthesis-|v173\.(?:46-equipment-progression|51-qa|57-starter-icons-reforge-filter|58-reforge-redesign)|ui-critical-)/, ['ui', 'inventory']],
  [/^tests\/(?:monster-portrait-|daily-dungeon-portrait-|water-wild-portrait-|wind-tower-portrait-)/, ['portrait', 'battle']],
  [/^assets\/ui\/skill-iron-bronze\//, ['ui', 'skill_ui']],
  [/^assets\/(?:icons|items|relics|ui|fonts)\//, ['ui', 'ui_shared']],
  [/^assets\/(?:skills|vfx|audio)\//, ['battle', 'skill', 'portrait']]
];

export function classifyChanges(paths, {eventName = 'pull_request', baseRef = 'dev',
  enabled = PR_GATES_ENABLED, addedPaths = [], error = '', fullRegression = false,
  responsibilities = null, responsibilitiesByPath = {}, generatedVerified = false} = {}) {
  const flags = Object.fromEntries(CHANGE_FLAGS.map(k => [`${k}_changed`, false]));
  const reasons = [];
  const mark = (...keys) => {
    keys.forEach(k => {flags[`${k}_changed`] = true;});
    if(keys.includes('ui')&&!keys.some(k=>['inventory','skill_ui','ui_shared'].includes(k)))flags.ui_shared_changed=true;
  };
  const strict = (reason, ...keys) => {reasons.push(reason); mark('core', ...keys);};
  if (!Array.isArray(paths) || !paths.length || error) strict(error || 'No reliable changed-path input', 'unknown_runtime');
  for (const p of Array.isArray(paths) ? paths : []) {
    if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('..') || p.includes('\\')) {
      strict('Invalid changed path', 'unknown_runtime'); continue;
    }
    if (GENERATED.test(p)) {
      if(!generatedVerified || !paths.some(x=>/^(?:js\/|css\/|assets\/|config\/)/.test(x))) strict(`Unexplained generated output: ${p}`, 'unknown_runtime');
      continue;
    }
    const responsibility=p==='js/00-main.js'?responsibilities:responsibilitiesByPath[p];
    if(SHARED_MODULES[p] && Array.isArray(responsibility) && responsibility.length && responsibility.every(k=>['ui','inventory','battle','boss','monster_balance'].includes(k))) {mark(...responsibility);continue;}
    if(SHARED_CSS.has(p)&&!addedPaths.includes(p)&&Array.isArray(responsibility)&&responsibility.length&&responsibility.every(k=>['ui','ui_shared','inventory','skill_ui','battle','tower'].includes(k))) {mark(...responsibility);continue;}
    if(p==='index.html'&&generatedVerified&&Array.isArray(responsibility)&&responsibility.length===0&&paths.some(x=>/^(?:js\/|css\/|assets\/|config\/)/.test(x)))continue;
    if(p==='index.html'&&!addedPaths.includes(p)&&Array.isArray(responsibility)&&responsibility.length&&responsibility.every(k=>['ui','ui_shared','inventory','skill_ui'].includes(k))) {mark(...responsibility);continue;}
    if(QA_OWNERS[p]&&(!addedPaths.includes(p)||p==='prototypes/ui-shared-samples-20261030/index.html')){mark(...QA_OWNERS[p]);continue;}
    if (/^(?:\.github\/scripts\/(?:ci-(?:change-classifier|aggregate)|full-regression-health)\.mjs|tests\/(?:ci-(?:boss-routing|change-classifier|aggregate|concurrency).*|full-regression-health.test)\.mjs|\.github\/workflows\/(?:ci|deploy-dev-cloudflare)\.yml|package\.json|package-lock\.json)$/.test(p)) {mark('workflow');continue;}
    if (/^(?:\.github\/|ci\/|package(?:-lock)?\.json$|scripts\/.*(?:build|deployment|release)|release\/|feature-manifest\.json$|config\/(?:boot|feature|first-play)-manifest\.json$)/.test(p)) {
      strict(`CI/build/release owner: ${p}`, 'workflow', 'release'); continue;
    }
    if (/^js\/combat\/monster-(?:balance-owner|archetypes)\.mjs$/.test(p)) {
      mark('monster_balance','battle'); continue;
    }
    if(p==='js/gameplay-boss-tower-system.js' || p==='tests/gameplay-boss-tower-system.test.js') {mark('boss','tower','battle');continue;}
    if (/^(?:js\/(?:00-main|gameplay-boss-tower-system|.*(?:skill|battle|relic).*)\.js|functions\/.*battle.*|tests\/fixtures\/|tests\/.*(?:battle|monster-balance|skill-progression|level-suppression|hit-evasion).*)$/.test(p)) {
      strict(`Shared battle/test owner: ${p}`, 'battle'); continue;
    }
    if ((p.startsWith('docs/') && !/\.(?:js|mjs|cjs|css|html|json|ya?ml)$/i.test(p)) ||
        (/\.md$/i.test(p) && !p.startsWith('release/'))) continue;
    if (addedPaths.includes(p) && /\.(?:js|mjs|cjs)$/.test(p)) {
      strict(`New runtime/test source: ${p}`, 'unknown_runtime'); continue;
    }
    const owner = OWNERS.find(([pattern]) => pattern.test(p));
    if (owner) mark(...owner[1]);
    else strict(`Unclassified owner: ${p}`, 'unknown_runtime');
  }
  const strictMode = reasons.length > 0;
  const nightly = fullRegression && eventName !== 'pull_request';
  const highRiskIntegration = eventName==='push' && (flags.cloud_changed || flags.persistence_changed);
  const mainRequired = baseRef === 'main' || nightly || highRiskIntegration || (eventName==='push' && strictMode) || !['pull_request','push'].includes(eventName);
  const full = mainRequired || strictMode;
  const f = key => flags[`${key}_changed`];
  const predicted = {
    core_checks: true,
    battle_browser: full || f('battle') || f('skill') || f('monster_balance'),
    ui_browser: full || f('ui') || f('inventory') || f('skill') || f('skill_ui'),
    daily_browser: full || f('daily') || f('monster_balance'),
    tower_wild_browser: full || f('tower') || f('monster_balance'),
    portrait_browser: full || f('portrait'),
    adventure_ui_browser: full || f('adventure'),
    abyss_balance: full || f('abyss') || f('monster_balance'),
    adventure_balance: full || f('adventure') || f('monster_balance'),
    boss_balance: full || f('boss') || f('monster_balance') || f('battle') || f('skill'),
    main_browser: mainRequired,
    promotion_health: baseRef === 'main' && !nightly,
    session_authority: full || f('cloud') || f('persistence')
  };
  const shadow = eventName === 'pull_request' && !mainRequired && !enabled;
  const gates = shadow ? Object.fromEntries(Object.keys(predicted).map(k => [k, ['main_browser','promotion_health'].includes(k) ? false : true])) : predicted;
  const bossFull=full || f('boss') || f('monster_balance') || f('workflow') || f('cloud') || f('persistence');
  const bossMode=shadow || bossFull ? 'full' : gates.boss_balance ? 'fast' : 'none';
  // Gate policy edits must exercise the retained Full capability themselves.
  if(bossFull){predicted.boss_balance=true;gates.boss_balance=true;}
  const uiMode=full||shadow||f('workflow')||f('cloud')||f('persistence')||f('ui_shared')||f('inventory')&&(f('skill_ui')||f('skill')) ? 'all' : f('inventory') ? 'inventory' : f('skill_ui')||f('skill') ? 'skill' : 'smoke';
  const sessionDeploy = error || !Array.isArray(paths) || !paths.length || paths.some(p=>typeof p!=='string'||p.startsWith('/')||p.includes('..')||p.includes('\\')) ? 'blocked' :
    String(paths.some(p=>SESSION_PATHS.some(pattern=>pattern.test(p))));
  return {policyVersion: 1, eventName, baseRef, strictMode, shadow, fullRegression: nightly, flags, reasons, predicted, gates, bossMode, uiMode, sessionDeploy};
}

export function changedPaths(base, head, added = false, eventName = 'pull_request') {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/.test(sha) || /^0+$/.test(sha)) throw Error('Missing exact comparison SHA');
    try {execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {stdio: 'ignore'});}
    catch {execFileSync('git', ['fetch', '--no-tags', 'origin', sha], {stdio: 'pipe', timeout: 60_000});}
  }
  // Only the classifier checkout has complete ancestry. Genuine unrelated
  // histories still throw and retain strict fallback. Push compares exact trees.
  if(eventName==='pull_request') execFileSync('git',['merge-base',base,head],{stdio:'pipe'});
  return execFileSync('git', ['diff', '--name-only', '--no-renames', ...(added ? ['--diff-filter=A'] : []), '-z', `${base}${eventName==='pull_request'?'...':'..'}${head}`],
    {encoding: 'utf8', timeout: 30_000}).split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let paths = [], addedPaths = [], error = '', responsibilities=null, responsibilitiesByPath={}, generatedVerified=false;
  try {
    paths = changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA, false, process.env.CI_EVENT_NAME);
    addedPaths = changedPaths(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA, true, process.env.CI_EVENT_NAME);
    const comparisonBase=process.env.CI_EVENT_NAME==='pull_request' ? execFileSync('git',['merge-base',process.env.CI_BASE_SHA,process.env.CI_HEAD_SHA],{encoding:'utf8'}).trim() : process.env.CI_BASE_SHA;
    for(const p of paths.filter(p=>SHARED_MODULES[p])) responsibilitiesByPath[p]=classifySharedSource(
      execFileSync('git',['show',`${comparisonBase}:${p}`],{encoding:'utf8',maxBuffer:8*1024*1024}),
      execFileSync('git',['show',`${process.env.CI_HEAD_SHA}:${p}`],{encoding:'utf8',maxBuffer:8*1024*1024}),p);
    responsibilities=responsibilitiesByPath['js/00-main.js'];
    for(const p of paths.filter(p=>SHARED_CSS.has(p)&&!addedPaths.includes(p)))responsibilitiesByPath[p]=classifySharedCss(
      execFileSync('git',['show',`${comparisonBase}:${p}`],{encoding:'utf8',maxBuffer:8*1024*1024}),
      execFileSync('git',['show',`${process.env.CI_HEAD_SHA}:${p}`],{encoding:'utf8',maxBuffer:8*1024*1024}));
    if(paths.some(p=>GENERATED.test(p))) {
      // Build --check certifies manifests, every shipped bundle and generated
      // policy against actual formal source, without executing changed outputs.
      execFileSync(process.execPath,['scripts/build-production.mjs','--check'],{stdio:'pipe',timeout:120_000,maxBuffer:8*1024*1024});
      const manifest=JSON.parse(fs.readFileSync('asset-manifest.json','utf8'));
      const previous=JSON.parse(execFileSync('git',['show',`${comparisonBase}:asset-manifest.json`],{encoding:'utf8',maxBuffer:8*1024*1024}));
      for(const p of paths.filter(p=>p.startsWith('build/') && p!=='build/asset-manifest.json')) {
        if(!Object.hasOwn(manifest.assets,p) && !(Object.hasOwn(previous.assets,p) && !fs.existsSync(p))) throw Error(`Unregistered generated output: ${p}`);
      }
      generatedVerified=true;
    }
    if(paths.includes('index.html')&&!addedPaths.includes('index.html'))responsibilitiesByPath['index.html']=classifySharedHtml(
      execFileSync('git',['show',`${comparisonBase}:index.html`],{encoding:'utf8',maxBuffer:8*1024*1024}),
      execFileSync('git',['show',`${process.env.CI_HEAD_SHA}:index.html`],{encoding:'utf8',maxBuffer:8*1024*1024}),{generatedVerified});
  } catch (e) {error = `Comparison unavailable; strict fallback: ${e.message}`;}
  const plan = applyAuthorizedLethalBossException(classifyChanges(paths, {eventName: process.env.CI_EVENT_NAME, baseRef: process.env.CI_BASE_REF, addedPaths, error, responsibilities, responsibilitiesByPath, generatedVerified, fullRegression: process.env.CI_FULL_REGRESSION === 'true'}),
    {baseSha: process.env.CI_BASE_SHA, headSha: process.env.CI_HEAD_SHA, paths, generatedVerified});
  const outputs = {plan_json: JSON.stringify(plan), strict: plan.strictMode, cloud_gate: plan.gates.session_authority, full_node: plan.shadow || plan.strictMode || plan.fullRegression || !['pull_request','push'].includes(plan.eventName) || plan.baseRef === 'main' || plan.flags.monster_balance_changed || plan.flags.workflow_changed || plan.flags.cloud_changed || plan.flags.persistence_changed,
    boss_mode:plan.bossMode, ui_mode:plan.uiMode, session_deploy:plan.sessionDeploy, ...plan.flags, ...plan.gates};
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    Object.entries(outputs).map(([k,v]) => `${k}=${v}\n`).join(''));
  const report = `## CI change classifier (${plan.shadow ? 'SHADOW — all original gates retained' : 'ENFORCED'})\n`+
    `Base: ${process.env.CI_BASE_SHA || 'unavailable'}; Head: ${process.env.CI_HEAD_SHA || 'unavailable'}; Boss mode: ${plan.bossMode}\n\n`+
    '| Gate | Predicted | Effective |\n|---|---|---|\n'+Object.entries(plan.gates).map(([k,v]) => `| ${k} | ${plan.predicted[k] ? 'RUN' : 'SKIP'} | ${v ? 'RUN' : 'SKIP'} |`).join('\n')+'\n\n'+plan.reasons.join('\n')+'\n'+
    (plan.bossException ? `User-authorized Boss exemption: ${JSON.stringify(plan.bossException)}\n` : '');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  console.log(report);
}
