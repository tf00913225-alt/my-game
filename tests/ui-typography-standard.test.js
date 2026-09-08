const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const owners = {
  elementBox: 'css/48-v169-element-box-settings.css',
  abyss: 'css/50-v169-abyss-flow.css',
  inventory: 'css/52-v173.50-inventory-qol.css',
  qa: 'css/53-v173.51-qa.css',
  abyssLayout: 'css/54-v174-abyss-two-tier.css',
  relic: 'css/55-team-relic-system.css',
  gameplay: 'css/gameplay-boss-tower.css',
};

function below13(text) {
  const hits = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const regex = /font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/gi;
    let match;
    while ((match = regex.exec(line))) {
      const value = Number(match[1]);
      if (value < 13) hits.push(`${index + 1}:${value}px:${line.trim()}`);
    }
  }
  return hits;
}

function enforceNoTinyText(file, transform = (text) => text) {
  const hits = below13(transform(read(file)));
  assert.equal(hits.length, 0, `${file} has player-facing text below 13px:\n${hits.join('\n')}`);
}

// These are the formal player-facing owners touched by the typography migration.
enforceNoTinyText(owners.elementBox);
enforceNoTinyText(owners.abyss);
enforceNoTinyText(owners.inventory);
enforceNoTinyText(owners.abyssLayout);

enforceNoTinyText(owners.qa, (text) => text.split('/* DEV-only ad simulator')[0]);
enforceNoTinyText(owners.relic, (text) => text
  .split('#game-stage .team-relic-battle-banner')[0]
  // The real readable back label is ::after at 15px; the 0px hides the legacy text node.
  .replace('font-size:0!important', ''));
enforceNoTinyText(owners.gameplay, (text) => text.split('/* ---------- Boss mechanism slot ---------- */')[0]);

const qa = read(owners.qa);
const relic = read(owners.relic);
const gameplay = read(owners.gameplay);
const docs = read('UI_GUIDELINES.md');

// Hierarchy: 13px is a floor, not a blanket replacement.
assert.match(relic, /\.team-relic-card-name\{[^}]*font-size:16px/);
assert.match(relic, /\.team-relic-detail section h3\{[^}]*font-size:18px/);
assert.match(relic, /\.team-relic-tabs button\{[^}]*font-size:15px/);
assert.match(gameplay, /\.gameplay-mode-copy h3\{[^}]*font-size:22px/);
assert.match(gameplay, /\.gameplay-fixed-tabs button\{[^}]*font-size:16px/);
assert.match(gameplay, /\.boss-detail-grid h4\{[^}]*font-size:18px/);
assert.match(qa, /\.v17346-shop-name\{font-size:16px!important/);
assert.match(qa, /\.v17346-shop-buy\{[^}]*font-size:15px!important/);
assert.match(qa, /\.quest-card-desc\{font-size:15px!important/);
assert.match(qa, /\.v17363-preview-group p\{font-size:15px!important/);
assert.match(qa, /\.v17363-game-select-option\{[^}]*font-size:15px!important/);
assert.match(qa, /\.v141-synthesis-tabs button\{[^}]*font-size:15px!important/);

// Explicitly protect battle exclusions: these existing small battle values are intentional.
assert.match(gameplay, /\.boss-mechanism-kind\{[\s\S]*?font-size:12px/);
assert.match(gameplay, /\.boss-mechanism-name\{[\s\S]*?font-size:10px/);
assert.match(gameplay, /\.boss-mechanism-hp,[\s\S]*?font-size:8px/);
assert.match(gameplay, /\.boss-mechanism-toast\{[\s\S]*?font-size:11px/);
assert.match(relic, /\.team-relic-battle-banner b\{[^}]*17px/);
assert.match(relic, /#battlePage \.battle-player \.team-relic-sp-float\{[^}]*13px/);

// Permanent documentation must describe both the floor and the battle carve-out.
assert.match(docs, /## UI Typography \/ UI 文字尺寸規範（永久規則）/);
assert.match(docs, /13px — 絕對最低值/);
assert.match(docs, /15～16px — 一般 UI 主要標準/);
assert.match(docs, /戰鬥介面排除/);
assert.match(docs, /禁止全域 font-size hack/);
assert.match(docs, /禁止用縮字解決版型問題/);

console.log('UI typography standard: targeted non-battle owners >=13px; hierarchy and battle exclusions preserved.');
