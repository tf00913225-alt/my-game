const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "js", "00-main.js"), "utf8");
const guidance = fs.readFileSync(path.join(root, "js", "41-v146-system-polish.js"), "utf8");
const start = main.indexOf("function buildSkillRowElement");
assert.notEqual(start, -1, "Canonical skill row renderer is present");
const renderer = main.slice(start);

assert.match(renderer,/<button[\s\S]*?type="button"[\s\S]*?class="skill-action-card/);
assert.match(renderer,/<span class="skill-action-card-label">/);
assert.match(renderer,/data-skill-action="growth"/);
assert.match(renderer,/data-skill-action="equip"/);
assert.match(renderer,/disabled aria-disabled="true"/);
assert.doesNotMatch(renderer,/<div\s+class="skill-action-card/);
assert.equal(renderer.includes("availableSkillPoints<1"), true, "Point-insufficient upgrade state remains covered");
assert.equal(renderer.includes("eligibility.reason"), true, "Level/prerequisite-ineligible learn state remains covered");
for (const label of ["學習", "升級", "裝備", "已裝備", "已滿級"]) {
    assert.equal(renderer.includes(label), true, "Skill action state remains represented: " + label);
}
assert.equal(main.includes(".skill-action-card-top:empty"), false);
assert.equal(guidance.includes("v146-growth-guidance-dot"), true);
console.log("skill-action-empty-top-regression: PASS");
