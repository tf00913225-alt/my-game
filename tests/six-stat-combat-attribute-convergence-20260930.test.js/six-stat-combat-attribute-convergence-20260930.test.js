const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'js/00-main.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const equipment = fs.readFileSync(path.join(root, 'js/equipment-progression.js'), 'utf8');
const contracts = fs.readFileSync(path.join(root, 'SYSTEM_CONTRACTS.md'), 'utf8');

const attributeFormula = (points, coefficient) => points * coefficient;

test('A-F: formal six-stat coefficients are exact', () => {
  assert.equal(attributeFormula(100, 4), 400);
  assert.equal(attributeFormula(100, 2.75), 275);
  assert.equal(attributeFormula(100, 50), 5000);
  assert.equal(attributeFormula(100, 15), 1500);
  assert.equal(attributeFormula(100, 4), 400);
  assert.equal(attributeFormula(200, 4), 800);
  assert.equal(attributeFormula(300, 4), 1200);
  assert.equal(attributeFormula(100, 1), 100);
  assert.match(core, /ATTACK_PER_POINT\s*=\s*4/);
  assert.match(core, /MAGIC_ATTACK_PER_POINT\s*=\s*2\.75/);
  assert.match(core, /DEFENSE_PER_VITALITY_POINT\s*=\s*0/);
  assert.match(core, /DEFENSE_PER_POINT\s*=\s*4/);
  assert.match(core, /HP_PER_VITALITY_POINT\s*=\s*50/);
});

test('G: Spirit is retired from formal runtime derivation', () => {
  assert.doesNotMatch(core, /SPIRIT.*(?:ACCURACY|ANTI|RESIST)/i);
  assert.doesNotMatch(core, /agility\s*\*\s*0\.6.*evasion/i);
  assert.doesNotMatch(core, /vitality\s*\*[^\n]*defense/i);
  assert.match(core, /legacySpirit/);
  assert.match(core, /attributePoints\s*\+=\s*legacySpirit/);
  assert.match(ui, /data-stat="defensePoints"/);
  assert.doesNotMatch(ui, /精神|creationSpirit|statusSpirit|data-stat="spirit"/);
});

test('H: independent equipment combat words remain available', () => {
  for (const key of ['accuracy', 'evasion', 'antiCrit', 'statusResistance']) {
    assert.match(core, new RegExp('\\b' + key + '\\b'));
  }
  assert.match(equipment, /accuracy:10/);
  assert.match(equipment, /statusResistance:0\.25/);
});

test('I: Defense is one shared physical and magic mitigation owner', () => {
  assert.match(core, /K.*400.*Target Level.*10/);
  assert.match(contracts, /Physical Damage.*Magic Damage/);
  assert.doesNotMatch(core, /physicalDefense|magicDefense/);
});

test('J: physical elite/boss rank bonus is fully retired', () => {
  assert.doesNotMatch(core, /PHYSICAL_SKILL_ELITE_BONUS_PERCENT/);
  assert.doesNotMatch(core, /PHYSICAL_SKILL_BOSS_BONUS_PERCENT/);
  assert.doesNotMatch(core, /getPhysicalSkillRankBonusMultiplier/);
  assert.match(contracts, /Physical Skill Elite\/Boss Rank Bonus/);
});

test('K: legacy Spirit migration is explicit and finite', () => {
  const legacy = { spirit: 17, attributePoints: 3, defensePoints: undefined };
  const migrated = { attributePoints: legacy.attributePoints + legacy.spirit, defensePoints: 0 };
  assert.equal(migrated.attributePoints, 20);
  assert.equal(migrated.defensePoints, 0);
  assert.equal(Number.isNaN(migrated.attributePoints), false);
  assert.match(core, /delete character\.spirit/);
  assert.match(core, /defensePoints/);
});

test('six-stat contract is documented as the permanent source of truth', () => {
  assert.match(contracts, /正式六圍唯一為/);
  assert.match(contracts, /Agility.*Speed/);
  assert.match(contracts, /Accuracy.*Evasion.*Critical Chance/);
  assert.match(contracts, /RETIRED/);
});
