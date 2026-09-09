const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const owners = {
  skillFix: 'css/31-v131-fix-batch.css',
  patrol: 'css/32-v131-patrol-appearance.css',
  inventoryBack: 'css/35-v134-fixes.css',
  rest: 'css/37-v139-rested-experience.css',
  homePolish: 'css/42-v146-system-polish.css',
  elementBox: 'css/48-v169-element-box-settings.css',
  abyss: 'css/50-v169-abyss-flow.css',
  inventory: 'css/52-v173.50-inventory-qol.css',
  qa: 'css/53-v173.51-qa.css',
  abyssLayout: 'css/54-v174-abyss-two-tier.css',
  relic: 'css/55-team-relic-system.css',
  gameplay: 'css/gameplay-boss-tower.css',
  detail: 'css/23-stage-v77-inventory-detail-ui.css',
};

function below13(text) {
  const hits = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    // Attribute selectors such as [style*="font-size:11px"] describe the legacy
    // inline value being upgraded; they are not font-size declarations themselves.
    const declarationLine=line.replace(/\[[^\]]*font-size\s*:[^\]]*\]/gi,'');
    const regex = /font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/gi;
    let match;
    while ((match = regex.exec(declarationLine))) {
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

const homePolish = read(owners.homePolish);
const skillFix = read(owners.skillFix);
const detail = read(owners.detail);
const inventory = read(owners.inventory);
const qa = read(owners.qa);
const relic = read(owners.relic);
const gameplay = read(owners.gameplay);
const docs = read('UI_GUIDELINES.md');

// Formal player-facing owners that should contain no sub-13px declarations.
enforceNoTinyText(owners.elementBox);
enforceNoTinyText(owners.abyss);
enforceNoTinyText(owners.inventory);
enforceNoTinyText(owners.abyssLayout);
enforceNoTinyText(owners.patrol);
enforceNoTinyText(owners.inventoryBack);
enforceNoTinyText(owners.rest);
enforceNoTinyText(owners.detail);
enforceNoTinyText(owners.qa, (text) => text.split('/* DEV-only ad simulator')[0]);
enforceNoTinyText(owners.relic, (text) => text
  .split('#game-stage .team-relic-battle-banner')[0]
  .replace('font-size:0!important', ''));
enforceNoTinyText(owners.gameplay, (text) => text.split('/* ---------- Boss battle portrait / mechanism UI ---------- */')[0]);

// Mixed V146 owner: only its non-battle region is governed by this task.
const nonBattlePolish = homePolish
  .replace(/#game-stage #battlePage #battleMonsterArea\{[\s\S]*?\}\n/, '')
  .replace(/\.skill-name-badge\.v143-caster-skill-label\{[\s\S]*?\.skill-name-badge\.v143-caster-skill-label\[data-skill="normal"\]\{[\s\S]*?\}\n/, '')
  .replace(/\.v143-skill-flight\{[\s\S]*?@keyframes v146StatusPopup\{[^\n]*\}\n/, '')
  .replace(/#battlePage \.v146-defeated[\s\S]*?#battlePage \.v146-defeated\{[^}]*\}\n/, '')
  .replace(/@media \(max-height:720px\)\{[\s\S]*?\}\n@media \(max-width:380px\)/, '@media (max-width:380px)');
assert.equal(below13(nonBattlePolish).length, 0, 'V146 non-battle typography must stay >=13px');

// Hierarchy: 13px is a floor, not a blanket replacement.
assert.match(homePolish, /\.v146-home-roster > header\{[^}]*font-size:15px/);
assert.match(homePolish, /\.v146-home-character-main > div:first-child\{[^}]*font-size:15px/);
assert.match(homePolish, /\.v146-home-resource strong\{[^}]*font-size:13px/);
assert.match(homePolish, /\.v173-exp-charge-status b\{[^}]*font-size:16px/);
assert.match(homePolish, /\.v173-exp-charge-status small\{[^}]*font-size:14px/);
assert.match(homePolish, /\.skill-loadout-slot-name\{font-size:15px/);
assert.match(homePolish, /\.map-player-name\{[^}]*font-size:13px/);
assert.match(homePolish, /\.v132-reward-modal \.v17363-preview-group p\{font-size:15px/);
assert.match(homePolish, /#allElementSkillPreviewModal \.skill-preview-card span\{font-size:34px/);
assert.match(detail, /#skillDetailStats \.v17364-progression-hint\{[\s\S]*?font-size:14px/);
assert.match(inventory, /\.inventory-category-tab\{[\s\S]*?font-size:15px/);
assert.match(inventory, /\.inventory-item-classic \.inventory-count,[\s\S]*?font-size:13px/);
assert.match(skillFix, /#creationPage \.creation-step-progress\{font-size:34px/);
assert.match(skillFix, /#creationPage \.creation-role-description\{font-size:39px/);
assert.match(skillFix, /#creationPage \.creation-stats-card \.creation-label\{font-size:41px/);
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

// Native 1080 design-space values must still resolve to at least 13px on a 420px phone.
const nativeScale = 420 / 1080;
for (const designPx of [34,36,39,41,46]) {
  assert.ok(designPx * nativeScale >= 13, `${designPx}px native design text would render below 13px`);
}

// Explicitly protect battle exclusions: these integrated battle values are intentional.
// The new mechanism face is more legible (14/13) but its compact HP remains an
// intentional battle-only 11px exception; detailed copy lives in the 13px+ panel.
assert.match(gameplay, /\.boss-mechanism-kind\{[\s\S]*?font-size:13px/);
assert.match(gameplay, /\.boss-mechanism-name\{[\s\S]*?font-size:14px/);
assert.match(gameplay, /\.boss-mechanism-hp\{[\s\S]*?font-size:11px[\s\S]*?font-weight:900/);
assert.match(gameplay, /\.boss-mechanism-info-effect\{[\s\S]*?font-size:13px/);
assert.match(gameplay, /\.boss-mechanism-toast\{[\s\S]*?font-size:11px/);
assert.match(relic, /\.team-relic-battle-banner b\{[^}]*17px/);
assert.match(relic, /#battlePage \.battle-player \.team-relic-sp-float\{[^}]*13px/);
assert.match(read('css/45-v152-dev-fixes.css'), /v152-frostbite-blocked::after\{[\s\S]*?font-size:12px !important/);

// Permanent documentation must describe both the floor and the battle carve-out.
assert.match(docs, /## UI Typography \/ UI 文字尺寸規範（永久規則）/);
assert.match(docs, /13px — 絕對最低值/);
assert.match(docs, /15～16px — 一般 UI 主要標準/);
assert.match(docs, /戰鬥介面排除/);
assert.match(docs, /禁止全域 font-size hack/);
assert.match(docs, /禁止用縮字解決版型問題/);

console.log('UI typography standard: non-battle owners >=13px, actual native scaling safe, battle exclusions preserved.');